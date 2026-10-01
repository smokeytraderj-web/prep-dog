import React from 'react';
import { groupPositions } from './supporting-data.js';

// Navy is a separate deck, not the light deck repainted. Light is an inset
// document: white page, margins, a rule under the title, a brand lockup on top
// and a source line in the footer. Navy is a spine: a fixed left column
// carrying the mark, the section label and the page number, with the content
// hanging off it in one wide field. Each slide promotes exactly one figure to
// display size and says in a sentence why it matters; everything else is
// separated by hairlines and air rather than by boxes.
//
// These components render instead of the light ones, so nothing here inherits
// a light layout. That is deliberate: the previous navy theme was CSS painted
// over the light DOM, which is why its header band could cut through a title it
// could not see.

const usd = n => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(n);
const signed = n => `${Number(n) > 0 ? '+' : ''}${Number(n).toFixed(1)}%`;
const signed2 = n => `${Number(n) > 0 ? '+' : ''}${Number(n).toFixed(2)}`;

// A display figure splits into the number and its unit so the unit can sit
// small beside it, the way the reference sets a statistic.
function Display({value, unit, gold = false, className = ''}) {
  return <div className={`navy-display ${gold ? 'is-gold' : ''} ${className}`}>
    {value}{unit && <span className="navy-display-unit">{unit}</span>}
  </div>;
}

function Lede({label, value, unit, gold, note}) {
  return <div className="navy-lede">
    <div>
      <div className={`navy-eyebrow ${gold ? 'is-gold' : ''}`}>{label}</div>
      <Display value={value} unit={unit} gold={gold}/>
    </div>
    {note && <p className="navy-lede-note">{note}</p>}
  </div>;
}

export function NavyCover({title, preparedFor, advisor, reportDate, total}) {
  const date = reportDate
    ? new Date(`${reportDate}T12:00:00`).toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'})
    : '';
  const [first, ...rest] = (title || 'Portfolio review').split(' ');
  return <div className="navy-cover">
    <div className="navy-cover-top">
      <div>
        <div className="navy-wordmark">GOTTFRIED &amp; SOMBERG</div>
        <div className="navy-wordmark-sub">WEALTH MANAGEMENT</div>
      </div>
      {date && <span className="navy-meta">{date.toUpperCase()}</span>}
    </div>
    <div className="navy-cover-title">
      <h2>{first}{rest.length > 0 && <><br/><em>{rest.join(' ')}</em></>}</h2>
      <p>Allocation, market context and risk, built from your confirmed holdings.</p>
    </div>
    <div className="navy-cover-meta">
      {preparedFor && <div><div className="navy-eyebrow">PREPARED FOR</div><b>{preparedFor}</b></div>}
      {advisor && <div><div className="navy-eyebrow">ADVISOR</div><b>{advisor}</b></div>}
      {total > 0 && <div className="navy-cover-value"><div className="navy-eyebrow">PORTFOLIO VALUE</div><b>{usd(total)}</b></div>}
    </div>
  </div>;
}

const assetBucket = value => {
  const v = String(value || '').toLowerCase();
  if (/fixed|bond|income|treas|municipal|muni/.test(v)) return 'Fixed income';
  if (/cash|money market|cd\b|certificate/.test(v)) return 'Cash';
  if (/equity|stock|common|preferred|reit|etf|large cap|small cap|mid cap/.test(v)) return 'Equities';
  return 'Other';
};
const bucketOrder = ['Equities', 'Fixed income', 'Other', 'Cash'];

export function NavyAccountSummary({positions, source, asOf}) {
  const total = positions.reduce((n, p) => n + p.value, 0);
  const buckets = groupPositions(positions.map(p => ({...p, bucket: assetBucket(p.assetClass)})), 'bucket')
    .sort((a, b) => bucketOrder.indexOf(a.name) - bucketOrder.indexOf(b.name));
  const allAccounts = groupPositions(positions, 'account');
  // A file without an account column groups into a single "Unclassified" row
  // holding the whole portfolio, which tells the client nothing. Fall back to
  // the largest positions instead of printing a row that restates the total.
  const named = allAccounts.filter(g => g.name !== 'Unclassified');
  const accounts = named.slice(0, 4);
  const byAccount = named.length > 0;
  const largest = [...positions].sort((a, b) => b.value - a.value).slice(0, 4);
  return <div className="navy-slide-body">
    <div className="navy-head">
      <h2>What you hold, and where</h2>
      {asOf && <span className="navy-meta">AS OF {asOf}</span>}
    </div>

    <div className="navy-lede">
      <div>
        <div className="navy-eyebrow">TOTAL PORTFOLIO</div>
        <Display value={usd(total)}/>
      </div>
      <div className="navy-lede-aside">
        <div className="navy-eyebrow">POSITIONS</div>
        <b>{positions.length}<span>{byAccount ? ` across ${accounts.length} account${accounts.length === 1 ? '' : 's'}` : ' supplied'}</span></b>
      </div>
    </div>

    {total > 0 && <div className="navy-allocation">
      <div className="navy-allocation-bar">
        {buckets.map(g => <i key={g.name} className={`navy-fill-${g.name.split(' ')[0].toLowerCase()}`} style={{width: `${g.value / total * 100}%`}}/>)}
      </div>
      <div className="navy-allocation-keys">
        {buckets.map(g => <span key={g.name}>
          <i className={`navy-fill-${g.name.split(' ')[0].toLowerCase()}`}/>{g.name}
          <b>{(g.value / total * 100).toFixed(1)}%</b>
        </span>)}
      </div>
    </div>}

    <div className="navy-rows navy-rows-accounts">
      <div className="navy-row navy-row-head">
        <span/><span>{byAccount ? 'ACCOUNT' : 'LARGEST POSITIONS'}</span>
        <span>{byAccount ? 'POSITIONS' : 'WEIGHT'}</span><span>VALUE</span>
      </div>
      {byAccount
        ? accounts.map((g, i) => <div className="navy-row" key={g.name}>
            <span className="navy-index">{String(i + 1).padStart(2, '0')}</span>
            <span className="navy-row-name">{g.name}</span>
            <span className="navy-row-fig">{g.count}</span>
            <span className="navy-row-display">{usd(g.value)}</span>
          </div>)
        : largest.map((p, i) => <div className="navy-row" key={p.ticker}>
            <span className="navy-index">{String(i + 1).padStart(2, '0')}</span>
            <span className="navy-row-name">{p.ticker}{p.name && <small>{p.name}</small>}</span>
            <span className="navy-row-fig">{total ? `${(p.value / total * 100).toFixed(1)}%` : '—'}</span>
            <span className="navy-row-display">{usd(p.value)}</span>
          </div>)}
    </div>

    <p className="navy-source">Source: {source || 'Confirmed holdings'}. Asset class is derived from the fund table and index constituents; a class supplied in your file is never overwritten.</p>
  </div>;
}

const NAVY_SERIES = ['var(--navy-series-1)', 'var(--navy-series-2)', 'var(--navy-series-3)', 'var(--navy-series-4)'];
const CHART = {w: 1068, h: 268, left: 50, right: 1060, top: 20, bottom: 250};

export function NavyMarketIndexes({data}) {
  const ready = data?.indexes?.length && data.indexes.every(i => Number.isFinite(Number(i.return)));
  if (!ready) return <div className="navy-slide-body">
    <div className="navy-head"><h2>Year-to-date market snapshot</h2><span className="navy-meta">AWAITING SOURCED DATA</span></div>
    <p className="navy-pending">This automatic slide is ready for the sourced index file. No market values are invented from the holdings file.</p>
  </div>;

  const series = data.indexes.map(index => ({
    ...index,
    points: (index.points || []).filter(p => Number.isFinite(p.return) && Number.isFinite(Date.parse(p.date))),
  }));
  const hasHistory = series.every(i => i.points.length > 1);
  const values = hasHistory ? series.flatMap(i => i.points.map(p => p.return)) : series.map(i => Number(i.return));
  const low = Math.min(0, ...values), high = Math.max(0, ...values), pad = (high - low || 2) * 0.12;
  const min = low - pad, max = high + pad;
  const y = v => CHART.bottom - (v - min) / (max - min) * (CHART.bottom - CHART.top);
  const times = hasHistory ? series.flatMap(i => i.points.map(p => Date.parse(p.date))) : [];
  const start = hasHistory ? Math.min(...times) : 0, end = hasHistory ? Math.max(...times) : 1;
  const x = d => CHART.left + (Date.parse(d) - start) / (end - start || 1) * (CHART.right - CHART.left);
  const ticks = Array.from({length: 5}, (_, i) => min + (max - min) * i / 4);
  const dateLabel = t => new Date(t).toLocaleDateString('en-US', {month: 'short', timeZone: 'UTC'}).toUpperCase();
  const lead = series[0];

  return <div className="navy-slide-body">
    <div className="navy-head">
      <h2>The year so far</h2>
      {data.asOf && <span className="navy-meta">YTD {data.asOf}</span>}
    </div>

    <Lede label={`${lead.label} · YEAR TO DATE`} value={signed(lead.return).replace('%', '')} unit="%" gold
      note="Index returns are cumulative and unmanaged. They set the context for the portfolio, and are not its return."/>

    <div className="navy-chart">
      <svg viewBox={`0 0 ${CHART.w} ${CHART.h}`} preserveAspectRatio="none" role="img"
        aria-label="Cumulative year-to-date returns for the supplied benchmarks">
        {ticks.map(v => <g key={v}>
          <line x1={CHART.left} x2={CHART.right} y1={y(v)} y2={y(v)} className="navy-grid"/>
          <text x={CHART.left - 8} y={y(v) + 4} textAnchor="end" className="navy-axis">{v.toFixed(0)}%</text>
        </g>)}
        <line x1={CHART.left} x2={CHART.right} y1={y(0)} y2={y(0)} className="navy-zero"/>
        {hasHistory && series.map((index, i) => <polyline key={index.id} fill="none"
          points={index.points.map(p => `${x(p.date)},${y(p.return)}`).join(' ')}
          stroke={NAVY_SERIES[i % 4]} strokeWidth={i === 0 ? 3.4 : 2.2}
          strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>)}
        {hasHistory && [0, 0.5, 1].map(f => <text key={f} x={CHART.left + (CHART.right - CHART.left) * f} y={CHART.h - 4}
          textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'} className="navy-axis">
          {dateLabel(start + (end - start) * f)}</text>)}
      </svg>
    </div>

    <div className="navy-stat-strip">
      {series.map((index, i) => <div key={index.id}>
        <div className="navy-stat-key"><i style={{background: NAVY_SERIES[i % 4]}}/>{index.label}{index.proxy ? ' (ETF proxy)' : ''}</div>
        <div className="navy-stat-figure">{signed(index.return)}</div>
      </div>)}
    </div>

    <p className="navy-source">{data.source || 'Sourced market context.'} Through {data.asOf}. Unmanaged indices; past performance does not guarantee future results.</p>
  </div>;
}

export function NavyRegional({positions, data}) {
  const total = positions.reduce((n, p) => n + p.value, 0);
  const groups = groupPositions(positions, 'region');
  const hasRegion = groups.some(g => g.name !== 'Unclassified');
  const indexes = data?.indexes || [];
  const rows = indexes.map(index => {
    const match = groups.find(g => g.name.toLowerCase() === String(index.region).toLowerCase());
    const weight = match ? match.value / total * 100 : 0;
    const ret = Number(index.return);
    return {...index, weight, contribution: Number.isFinite(ret) ? weight * ret / 100 : null};
  });
  const totalContribution = rows.reduce((n, r) => n + (r.contribution || 0), 0);
  const leader = [...rows].sort((a, b) => (b.contribution || 0) - (a.contribution || 0))[0];

  return <div className="navy-slide-body">
    <div className="navy-head">
      <h2>Where the portfolio participated</h2>
      {data?.asOf && <span className="navy-meta">YTD {data.asOf}</span>}
    </div>

    {!hasRegion ? <p className="navy-pending">Add a Region / Geography column to the holdings file. The slide will then compare each client weight with the corresponding index return without inferring a region from a ticker.</p> : <>
      <Lede label="TOTAL WEIGHTED CONTRIBUTION" value={signed(totalContribution).replace('%', '')} unit="%" gold
        note={leader ? `${leader.region} did most of the work — not because it returned the most, but because it carries the most weight.` : undefined}/>

      <div className="navy-rows">
        <div className="navy-row navy-row-5 navy-row-head">
          <span/><span>REGION / INDEX</span><span>WEIGHT</span><span>RETURN</span><span>CONTRIBUTION</span>
        </div>
        {rows.map((row, i) => <div className="navy-row navy-row-5" key={row.id}>
          <span className="navy-index">{String(i + 1).padStart(2, '0')}</span>
          <span className="navy-row-name">{row.region}<small>{row.label}</small></span>
          <span className="navy-row-fig">{row.weight ? `${row.weight.toFixed(1)}%` : '—'}</span>
          <span className="navy-row-fig">{Number.isFinite(Number(row.return)) ? signed(row.return) : '—'}</span>
          <span className={`navy-row-display ${row === leader ? 'is-gold' : ''}`}>{row.contribution == null ? '—' : signed(row.contribution)}</span>
        </div>)}
      </div>
    </>}

    <p className="navy-source">Illustrative exposure contribution = client regional weight × supplied YTD index return. It is not security-level performance attribution. {data?.source || ''} Regional weights are calculated from the confirmed holdings; unmapped positions are not silently reassigned.</p>
  </div>;
}

const GROUPS = [{name: 'Cyclical', span: 4}, {name: 'Sensitive', span: 4}, {name: 'Defensive', span: 3}];
// The page is a fixed 1280x720, so the field under the table is deterministic.
// The viewBox width is that field's content width in page pixels, which is what
// makes a viewBox unit equal a CSS pixel: the 150-unit label column below then
// lines up with the table's 150px one, and the bars sit on the same centres as
// the sector columns. The height is the chart box's, so nothing letterboxes.
// Zero sits below centre because the deeper deviations are underweights.
const BARS = {w: 1092, h: 293, zero: 152, max: 108, labels: 150, gap: 4};

export function NavyEquity({data}) {
  const diffs = data.sectors.map(s => s.portfolio - s.benchmark);
  const extent = Math.max(0.5, ...diffs.map(Math.abs));
  const scale = BARS.max / extent;
  const cols = data.sectors.length;
  const track = (BARS.w - BARS.labels - cols * BARS.gap) / cols;
  const centre = i => BARS.labels + BARS.gap + i * (track + BARS.gap) + track / 2;
  const style = {gridTemplateColumns: `${BARS.labels}px repeat(${cols}, minmax(0, 1fr))`};

  return <div className="navy-slide-body">
    <div className="navy-head">
      <h2>Equity sector exposure</h2>
      {data.as_of && <span className="navy-meta">{data.as_of}</span>}
    </div>

    <div className="navy-sector-table">
      <div className="navy-sector-groups" style={style}>
        <span/>
        {GROUPS.map(g => <span key={g.name} style={{gridColumn: `span ${g.span}`}}>{g.name.toUpperCase()}</span>)}
      </div>
      <div className="navy-sector-names" style={style}>
        <span className="navy-eyebrow">ALLOCATION (%)</span>
        {data.sectors.map(s => <span key={s.name}>{s.name}</span>)}
      </div>
      <div className="navy-sector-row is-portfolio" style={style}>
        <span>{data.portfolio_label || 'Portfolio'}</span>
        {data.sectors.map(s => <span key={s.name}>{s.portfolio.toFixed(2)}</span>)}
      </div>
      <div className="navy-sector-row" style={style}>
        <span>{data.benchmark_label || 'Benchmark'}</span>
        {data.sectors.map(s => <span key={s.name}>{s.benchmark.toFixed(2)}</span>)}
      </div>
    </div>

    <div className="navy-bars">
      <div className="navy-bars-head">
        <span className="navy-eyebrow">RELATIVE TO {(data.benchmark_short || data.benchmark_label || 'BENCHMARK').toUpperCase()} — PERCENTAGE POINTS</span>
        <div className="navy-legend">
          <span><i className="navy-over"/>Overweight</span>
          <span><i className="navy-under"/>Underweight</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${BARS.w} ${BARS.h}`} preserveAspectRatio="xMidYMid meet" role="img"
        aria-label="Portfolio sector weight relative to the benchmark, in percentage points">
        <line x1={BARS.labels} x2={BARS.w} y1={BARS.zero} y2={BARS.zero} className="navy-zero"/>
        {data.sectors.map((s, i) => {
          const v = diffs[i], h = Math.abs(v) * scale, up = v >= 0, cx = centre(i);
          return <g key={s.name}>
            <rect x={cx - track / 2} y={up ? BARS.zero - h : BARS.zero} width={track} height={h}
              className={up ? 'navy-over' : 'navy-under'}/>
            <text x={cx} y={up ? BARS.zero - h - 9 : BARS.zero + h + 17} textAnchor="middle" className="navy-bar-value">
              {signed2(v)}</text>
          </g>;
        })}
      </svg>
    </div>

    <p className="navy-source">{data.source_note}{data.firm ? ` ${data.firm}` : ''}</p>
  </div>;
}

export function NavyRisk({s}) {
  const allocation = [...s.allocation].sort((a, b) => b.percent - a.percent);
  const r = s.range;
  const costs = Object.values(s.costs);
  const costTotal = costs.every(Number.isFinite) ? costs.reduce((a, b) => a + b, 0) : null;
  const measures = [
    ['ANNUALIZED VOLATILITY', `${s.metrics.annual_volatility_pct?.toFixed(2)}%`],
    ['MAXIMUM DRAWDOWN', `${s.metrics.max_drawdown_pct?.toFixed(2)}%`],
    ['ANNUAL RANGE MIDPOINT', `${s.metrics.annual_range_midpoint_pct?.toFixed(2)}%`],
    ['ANNUAL DIVIDEND', `${s.metrics.annual_dividend_pct?.toFixed(2)}%`],
    ['TOTAL ANNUAL COST', costTotal == null ? null : `${costTotal.toFixed(2)}%`],
    ['RISK-ADJUSTED GRADE', s.metrics.grade == null ? null : `${s.metrics.grade.toFixed(1)} / 4.3`],
    ['RISK-FREE RATE', s.basis.risk_free_pct == null ? null : `${s.basis.risk_free_pct.toFixed(2)}%`],
  ].filter(([, v]) => v != null && !v.includes('undefined')).slice(0, 6);
  const min = Math.min(0, r.downside_pct), max = Math.max(0, r.upside_pct);
  const span = max - min || 1, zero = (-min / span) * 100;

  return <div className="navy-slide-body">
    <div className="navy-head">
      <h2>How much risk you are carrying</h2>
      {s.as_of && <span className="navy-meta">AS OF {s.as_of}</span>}
    </div>

    <div className="navy-lede">
      <div>
        <div className="navy-eyebrow is-gold">RISK SCORE</div>
        <Display value={s.risk_score} unit={`/ ${s.scale_max || 99}`} className="is-score"/>
      </div>
      <p className="navy-lede-note">
        {s.risk_score < 50 ? 'Moderate, and below the midpoint of the scale.' : 'Above the midpoint of the scale.'}
        {allocation[0] && ` Driven by a ${allocation[0].percent.toFixed(0)}% ${allocation[0].name} sleeve.`}
      </p>
      <div className="navy-lede-aside">
        <div className="navy-eyebrow">CURRENT PORTFOLIO</div>
        <b className="navy-value">{usd(s.total_value)}</b>
      </div>
    </div>

    <div className="navy-section">
      <div className="navy-eyebrow">SIX-MONTH MODELED RANGE · 90% CENTRAL COVERAGE</div>
      <div className="navy-range-anchors">
        <div>
          <div className="navy-eyebrow">DOWNSIDE {r.downside_pct.toFixed(2)}%</div>
          <b>{usd(s.total_value + r.downside_value)}</b>
        </div>
        <div className="navy-range-today">
          <div className="navy-eyebrow is-gold">TODAY</div>
          <b>{usd(s.total_value)}</b>
        </div>
        <div className="navy-range-up">
          <div className="navy-eyebrow">UPSIDE +{r.upside_pct.toFixed(2)}%</div>
          <b>{usd(s.total_value + r.upside_value)}</b>
        </div>
      </div>
      <div className="navy-range-track">
        <i className="navy-range-down" style={{width: `${zero}%`}}/>
        <i className="navy-range-upper" style={{left: `${zero}%`}}/>
        <em style={{left: `${zero}%`}}/>
      </div>
    </div>

    <div className="navy-section navy-measures">
      {measures.map(([label, value]) => <div key={label}>
        <div className="navy-measure-figure">{value}</div>
        <div className="navy-eyebrow">{label}</div>
      </div>)}
    </div>

    <p className="navy-source">{s.basis.method} Six-month modeled 90% range; outcomes may fall outside it, and it is neither a guarantee nor a maximum loss. {s.basis.drawdown_basis} {s.warnings.join(' ')}</p>
  </div>;
}

// Navy carries no brand lockup or footer sentence. The section label is a gold
// kicker above the title and the page number is a folio in the corner, so the
// content gets the whole page rather than sharing it with a rail.
export function NavyFrame({label, page, children, cover = false}) {
  return <div className={`navy-shell ${cover ? 'is-cover' : ''}`}>
    <div className="navy-field">
      {!cover && <div className="navy-kicker">{label}</div>}
      {children}
      <span className="navy-folio" aria-hidden="true">{page}</span>
    </div>
  </div>;
}
