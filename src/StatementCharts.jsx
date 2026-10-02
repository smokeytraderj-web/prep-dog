import React from 'react';
import { allocationRows, allocationNote, assetClassPerformance } from './allocation.js';

// Style F's own charts. The Statement deck shows the same figures as every
// other style, but draws them differently: small multiples instead of one
// tangled line chart, a ranked diverging list instead of columns, a hundred-
// square grid instead of a donut, and dots on a line instead of filled bars.
// Each falls back to nothing the others would not also fall back to; the
// caller only routes here once the same data the navy slide needs is ready.

const usd = n => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(n);
const signed = n => `${Number(n) > 0 ? '+' : ''}${Number(n).toFixed(1)}%`;
const WAFFLE = ['st-c1', 'st-c2', 'st-c3', 'st-c4', 'st-c5', 'st-c6'];

function Head({title, meta}) {
  return <div className="navy-head"><h2>{title}</h2>{meta && <span className="navy-meta">{meta}</span>}</div>;
}

// Where a value sits on a track that always includes zero, in percent.
function scale(values) {
  const low = Math.min(0, ...values), high = Math.max(0, ...values);
  const span = (high - low) || 1;
  return {at: v => (v - low) / span * 100, zero: (0 - low) / span * 100};
}

// --- market and bond boards: one row per index, each with its own line -----
function Spark({points, lead}) {
  const vals = points.map(p => p.return);
  const times = points.map(p => Date.parse(p.date));
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), span = (hi - lo) || 1;
  const t0 = Math.min(...times), t1 = Math.max(...times);
  const x = t => (t - t0) / ((t1 - t0) || 1) * 300;
  const y = v => 46 - (v - lo) / span * 42;
  const line = points.map((p, i) => `${x(times[i]).toFixed(1)},${y(p.return).toFixed(1)}`).join(' ');
  return <svg className="st-spark" viewBox="0 0 300 50" preserveAspectRatio="none" aria-hidden="true">
    <line x1="0" x2="300" y1={y(0)} y2={y(0)} className="st-spark-zero"/>
    <polygon points={`0,${y(0)} ${line} 300,${y(0)}`} className={lead ? 'st-spark-area is-lead' : 'st-spark-area'}/>
    <polyline points={line} className={lead ? 'st-spark-line is-lead' : 'st-spark-line'} vectorEffect="non-scaling-stroke"/>
  </svg>;
}

export function StatementMarket({data, title = 'The year so far', note}) {
  const series = data.indexes.map(index => ({
    ...index,
    points: (index.points || []).filter(p => Number.isFinite(p.return) && Number.isFinite(Date.parse(p.date))),
  }));
  const lead = series[0];
  const r = Number(lead.return);
  return <div className="navy-slide-body st-body">
    <Head title={title} meta={data.asOf ? `YTD ${data.asOf}` : ''}/>
    <p className="st-statement">
      The {lead.label} is {r >= 0 ? 'up' : 'down'} <em>{Math.abs(r).toFixed(1)}%</em> this year.
    </p>
    <div className="st-multiples">
      {series.map((index, i) => <div className={`st-multiple ${i === 0 ? 'is-lead' : ''}`} key={index.id}>
        <div className="st-multiple-name">{index.label}<small>{index.region}{index.proxy ? ' · ETF proxy' : ''}</small></div>
        {index.points.length > 1 ? <Spark points={index.points} lead={i === 0}/> : <span/>}
        <div className="st-multiple-fig">{signed(index.return)}</div>
      </div>)}
    </div>
    <p className="navy-source">{note ? `${note} ` : ''}{data.source || ''} Through {data.asOf}. Unmanaged indices; past performance does not guarantee future results.</p>
  </div>;
}

// --- sectors: ranked best to worst, bars either side of zero ---------------
export function StatementSectors({data}) {
  const ranked = [...data.indexes].sort((a, b) => Number(b.return) - Number(a.return));
  const {at, zero} = scale(ranked.map(i => Number(i.return)));
  const best = ranked[0], worst = ranked[ranked.length - 1];
  return <div className="navy-slide-body st-body">
    <Head title="Sector performance, year to date" meta={data.asOf ? `YTD ${data.asOf}` : ''}/>
    <p className="st-statement st-statement-sm">
      {best.region || best.label} led at <em>{signed(best.return)}</em>; {worst.region || worst.label} trailed at {signed(worst.return)}.
    </p>
    <div className="st-diverging">
      {ranked.map(index => {
        const v = Number(index.return), up = v >= 0;
        const left = up ? zero : at(v), width = Math.abs(at(v) - zero);
        return <div className="st-div-row" key={index.id}>
          <span className="st-div-name">{index.region || index.label}</span>
          <span className="st-div-track">
            <i className="st-div-zero" style={{left: `${zero}%`}}/>
            <i className={`st-div-bar ${up ? 'is-up' : 'is-down'}`} style={{left: `${left}%`, width: `${Math.max(width, 0.4)}%`}}/>
          </span>
          <span className={`st-div-fig ${up ? '' : 'is-down'}`}>{signed(v)}</span>
        </div>;
      })}
    </div>
    <p className="navy-source">{data.source || ''} All indices are unmanaged, and investors cannot invest directly into an index. Past performance does not guarantee future results.</p>
  </div>;
}

// --- allocation: a hundred squares, one per percent ------------------------
function squares(rows) {
  // Largest remainder, so the grid always holds exactly 100 and every class
  // over half a percent gets at least one square.
  const base = rows.map(r => Math.floor(r.percent));
  let left = 100 - base.reduce((n, v) => n + v, 0);
  [...rows.keys()].sort((a, b) => (rows[b].percent % 1) - (rows[a].percent % 1))
    .forEach(i => { if (left > 0) { base[i] += 1; left -= 1; } });
  return base.flatMap((n, i) => Array.from({length: n}, () => i));
}

export function StatementAllocation({positions, asOf, source}) {
  const {rows, total} = allocationRows(positions);
  if (!total) return null;
  const cells = squares(rows);
  const note = allocationNote({rows, total});
  return <div className="navy-slide-body st-body">
    <Head title="Overall asset allocation" meta={asOf ? `AS OF ${asOf}` : ''}/>
    <div className="st-alloc">
      <div className="st-waffle" role="img" aria-label={`Allocation: ${rows.map(r => `${r.name} ${r.percent.toFixed(1)}%`).join(', ')}`}>
        {cells.map((c, i) => <i key={i} className={WAFFLE[c % WAFFLE.length]}/>)}
      </div>
      <div className="st-alloc-list">
        {rows.map((row, i) => <div className="st-alloc-row" key={row.name}>
          <i className={WAFFLE[i % WAFFLE.length]}/>
          <span className="st-alloc-name">{row.name}<small>{usd(row.value)}</small></span>
          <span className="st-alloc-fig">{row.percent.toFixed(1)}<small>%</small></span>
        </div>)}
        <div className="st-alloc-total"><span>Total portfolio</span><b>{usd(total)}</b></div>
        {note && <p className="st-alloc-note">{note}</p>}
      </div>
    </div>
    <p className="navy-source">{source ? `Source: ${source}. ` : ''}One square is one percent of the portfolio. Estimated values apply allocation percentages to the confirmed portfolio value of {usd(total)}.</p>
  </div>;
}

// --- performance by asset class: a dot on a line ---------------------------
export function StatementClassPerformance({positions, returns, asOf, source}) {
  const result = assetClassPerformance(positions, returns);
  if (!result.rows.length) return null;
  const weight = result.rows.reduce((n, r) => n + r.value, 0);
  const {at, zero} = scale([...result.rows.map(r => r.ytdReturn), result.portfolioReturn]);
  return <div className="navy-slide-body st-body">
    <Head title="Performance by asset class" meta={asOf ? `YTD ${asOf}` : ''}/>
    <div className="st-classperf">
      <div className="st-classperf-lead">
        <div className="navy-eyebrow">PORTFOLIO, YEAR TO DATE</div>
        <div className="st-big">{signed(result.portfolioReturn)}</div>
      </div>
      <div className="st-dots">
        {result.rows.map(row => {
          const v = row.ytdReturn, up = v >= 0;
          const from = Math.min(at(v), zero), to = Math.max(at(v), zero);
          return <div className="st-dot-row" key={row.name}>
            <span className="st-div-name">{row.name}<small>{weight > 0 ? `${(row.value / weight * 100).toFixed(0)}% of the book` : ''}</small></span>
            <span className="st-dot-track">
              <i className="st-div-zero" style={{left: `${zero}%`}}/>
              <i className="st-dot-mark is-portfolio" style={{left: `${at(result.portfolioReturn)}%`}}/>
              <i className="st-dot-stem" style={{left: `${from}%`, width: `${to - from}%`}}/>
              <i className={`st-dot ${up ? 'is-up' : 'is-down'}`} style={{left: `${at(v)}%`}}/>
            </span>
            <span className={`st-div-fig ${up ? '' : 'is-down'}`}>{signed(v)}</span>
          </div>;
        })}
        <div className="st-dot-key"><i className="st-dot-mark is-portfolio"/>Portfolio, {signed(result.portfolioReturn)}</div>
      </div>
    </div>
    <p className="navy-source">{source ? `${source}. ` : ''}Class returns are each class's gain over its own start-of-year value, the same basis as the attribution slide.
      {result.coverage < 99.5 && ` Covers ${result.coverage.toFixed(1)}% of portfolio value.`}</p>
  </div>;
}
