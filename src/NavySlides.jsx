import React from 'react';
import { completedQuarter } from './cover-period';
import { groupPositions } from './supporting-data.js';
import { allocationRows, allocationNote, assetClassPerformance } from './allocation.js';

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

// The cover is the client's name over what the deck is, not a generic title:
// whoever it was prepared for reads first, and "Account review" says what it
// is. The deck title is the fallback for a deck with no client named yet.
// Navy's own cover, unchanged. Only the light deck was rebuilt on the Dwyer
// file's split layout, so navy keeps the cover it already had.
export function NavyCoverClassic({title, preparedFor, advisor, reportDate, total}) {
  const date = reportDate
    ? new Date(`${reportDate}T12:00:00`).toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'})
    : '';
  const headline = preparedFor?.trim() || title?.trim() || 'Account review';
  const subject = preparedFor?.trim() ? (title?.trim() || 'Account review') : '';
  return <div className="navy-cover is-classic">
    <div className="navy-cover-top">
      <div>
        <div className="navy-wordmark">GOTTFRIED &amp; SOMBERG</div>
        <div className="navy-wordmark-sub">WEALTH MANAGEMENT</div>
      </div>
      {date && <span className="navy-meta">{date.toUpperCase()}</span>}
    </div>
    <div className="navy-cover-title">
      <h2>{headline}{subject && <><br/><em>{subject}</em></>}</h2>
      <p>Your allocation, how markets moved, and the risk you are carrying.</p>
    </div>
    <div className="navy-cover-meta">
      {!preparedFor?.trim() && <div><div className="navy-eyebrow">REVIEW</div><b>{title?.trim() || 'Account review'}</b></div>}
      {advisor && <div><div className="navy-eyebrow">ADVISOR</div><b>{advisor}</b></div>}
      {total > 0 && <div className="navy-cover-value"><div className="navy-eyebrow">PORTFOLIO VALUE</div><b>{usd(total)}</b></div>}
    </div>
  </div>;
}

// The cover, measured from the Dwyer file rather than invented. It is a split
// page at 1280x720: a gold rule down x=840 with the review block to its right,
// the firm name at y=96, the deck title at 226, a 125px gold rule at 374, and
// the client at 434. The quarter is the one thing the file states that the app
// does not store, so it is derived from the report date rather than asked for.
export function NavyCover({title, preparedFor, advisor, reportDate, total}) {
  const parsed = reportDate ? new Date(`${reportDate}T12:00:00`) : null;
  const valid = parsed && !Number.isNaN(parsed.getTime());
  const date = valid
    ? parsed.toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'})
    : '';
  const period = valid ? completedQuarter(parsed) : null;
  const quarter = period ? `Q${period.quarter}` : '';
  const year = period ? String(period.year) : '';
  return <div className="navy-cover is-split">
    <div className="navy-cover-main">
      <div className="navy-cover-firm">GOTTFRIED &amp; SOMBERG WEALTH MANAGEMENT, LLC</div>
      <h2 className="navy-cover-head">{title?.trim() || 'Portfolio Review'}</h2>
      <p className="navy-cover-sub">Your allocation, how markets moved, and the risk you are carrying.</p>
      <div className="navy-cover-rule"/>
      <div className="navy-eyebrow is-gold">PREPARED FOR</div>
      <div className="navy-cover-client">{preparedFor?.trim() || 'Account review'}</div>
      {advisor?.trim() && <div className="navy-cover-advisor">
        <div className="navy-eyebrow">ADVISOR</div><b>{advisor}</b>
      </div>}
      <p className="navy-cover-confidential">Confidential. Prepared exclusively for the client named herein.</p>
    </div>
    <div className="navy-cover-aside">
      {quarter && <>
        <div className="navy-eyebrow is-gold">QUARTERLY REVIEW</div>
        <div className="navy-cover-quarter">{quarter}</div>
        <div className="navy-cover-year">{year}</div>
      </>}
      <div className="navy-cover-aside-rule"/>
      {date && <>
        <div className="navy-eyebrow">MEETING DATE</div>
        <div className="navy-cover-date">{date}</div>
      </>}
      {total > 0 && <>
        <div className="navy-eyebrow navy-cover-gap">PORTFOLIO VALUE</div>
        <div className="navy-cover-date">{usd(total)}</div>
      </>}
    </div>
  </div>;
}


export function NavyAccountSummary({positions, source, asOf}) {
  const total = positions.reduce((n, p) => n + p.value, 0);
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

export function NavyMarketIndexes({data, title = 'The year so far', note = 'Index returns are cumulative and unmanaged. They set the context for the portfolio, and are not its return.', heading = 'Year-to-date market snapshot'}) {
  const ready = data?.indexes?.length && data.indexes.every(i => Number.isFinite(Number(i.return)));
  if (!ready) return <div className="navy-slide-body">
    <div className="navy-head"><h2>{heading}</h2><span className="navy-meta">AWAITING SOURCED DATA</span></div>
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
      <h2>{title}</h2>
      {data.asOf && <span className="navy-meta">YTD {data.asOf}</span>}
    </div>

    <Lede label={`${lead.label} · YEAR TO DATE`} value={signed(lead.return).replace('%', '')} unit="%" gold
      note={note}/>

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
        {/* Without a history the chart used to draw its gridlines and nothing
            else: an empty plot above a legend of live returns, which reads as
            a failure on a client's page. The returns are known either way, so
            they are drawn as bars instead. */}
        {!hasHistory && series.map((index, i) => {
          const slot = (CHART.right - CHART.left) / series.length;
          const w = Math.min(74, slot * 0.4);
          const cx = CHART.left + slot * i + slot / 2;
          const value = Number(index.return);
          const top = Math.min(y(value), y(0)), height = Math.abs(y(value) - y(0));
          return <g key={index.id || index.label}>
            <rect x={cx - w / 2} y={top} width={w} height={Math.max(2, height)} fill={NAVY_SERIES[i % 4]}/>
            <text x={cx} y={CHART.h - 4} textAnchor="middle" className="navy-axis">{index.label}</text>
          </g>;
        })}
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

    <p className="navy-source">Illustrative exposure contribution = client regional weight × supplied YTD index return. It is not security-level performance attribution. {data?.source || ''} Regional weights are calculated from your holdings; unmapped positions are not silently reassigned.</p>
  </div>;
}

const GROUPS = [{name: 'Cyclical', span: 4}, {name: 'Sensitive', span: 4}, {name: 'Defensive', span: 3}];
// The page is a fixed 1280x720, so the field under the table is deterministic.
// The viewBox width is that field's content width in page pixels, which is what
// makes a viewBox unit equal a CSS pixel: the 150-unit label column below then
// lines up with the table's 150px one, and the bars sit on the same centres as
// the sector columns. The height is the chart box's, so nothing letterboxes.
// Zero sits below centre because the deeper deviations are underweights.
// The chart used to reserve a 150-unit gutter so its bars lined up with the
// table's sector columns, which left it sitting off-centre with an empty
// left-hand margin. It carries its own sector labels now, so it no longer has
// to borrow the table's grid: the columns divide the full width evenly and the
// chart is centred on the page.
//
// The band below `names` is reserved for those labels, and the geometry keeps
// bars out of it at both extremes: an all-positive chart puts its tallest value
// label at zero-max-9, an all-negative one its deepest at zero+max+17.
const BARS = {w: 1166, h: 288, zero: 130, max: 100, names: 262, lineH: 12, fill: 0.68};
// The table still needs a column for its row labels ("Your portfolio", the
// benchmark). That is the table's own measurement, not the chart's.
const TABLE_LABELS = 150;

// Sector names are split onto at most two lines so a long one stays inside its
// column instead of running into its neighbours.
function nameLines(name) {
  const words = name.split(' ');
  if (words.length < 2) return [name];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

export function NavyEquity({data}) {
  const diffs = data.sectors.map(s => s.portfolio - s.benchmark);
  const extent = Math.max(0.5, ...diffs.map(Math.abs));
  const scale = BARS.max / extent;
  const cols = data.sectors.length;
  const track = BARS.w / cols;
  const bar = track * BARS.fill;
  const centre = i => i * track + track / 2;
  const style = {gridTemplateColumns: `${TABLE_LABELS}px repeat(${cols}, minmax(0, 1fr))`};

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
        <line x1="0" x2={BARS.w} y1={BARS.zero} y2={BARS.zero} className="navy-zero"/>
        {data.sectors.map((s, i) => {
          const v = diffs[i], h = Math.abs(v) * scale, up = v >= 0, cx = centre(i);
          return <g key={s.name}>
            <rect x={cx - bar / 2} y={up ? BARS.zero - h : BARS.zero} width={bar} height={h}
              className={up ? 'navy-over' : 'navy-under'}/>
            <text x={cx} y={up ? BARS.zero - h - 9 : BARS.zero + h + 17} textAnchor="middle" className="navy-bar-value">
              {signed2(v)}</text>
            {nameLines(s.name).map((line, n) =>
              <text key={line + n} x={cx} y={BARS.names + n * BARS.lineH} textAnchor="middle" className="navy-bar-name">
                {line}</text>)}
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
      {/* Only style 3 shows this; CSS hides it everywhere else. The white deck
          is a document and signs each page, which is one of the things that
          keeps it from being the navy deck repainted. */}
      <div className="brand-lockup">
        <img src="/gswm-logo.png" alt=""/>
        <span>Gottfried &amp; Somberg<small>Wealth Management</small></span>
      </div>
      {!cover && <div className="navy-kicker">{label}</div>}
      {children}
      {/* The Dwyer file signs every page along the foot: the firm's name at
          x=58 and the folio at x=1174, both gold, on the same baseline. Navy
          carries the folio alone, so the name only shows on the light deck. */}
      <div className="navy-foot">
        <span className="navy-foot-firm">GOTTFRIED &amp; SOMBERG WEALTH MANAGEMENT, LLC</span>
        <span className="navy-foot-page">{page}</span>
      </div>
      <span className="navy-folio" aria-hidden="true">{page}</span>
    </div>
  </div>;
}

// --- Overall asset allocation ---------------------------------------------
// The firm's own slide: a donut with the total in its hole, the class table
// beside it, and a sentence underneath restating the equity split. The donut is
// drawn as stroked arcs on one circle rather than as paths, so a class worth
// 0.56% still renders as a visible sliver instead of a rounding error.
const SLICE = ['navy-slice-1', 'navy-slice-2', 'navy-slice-3', 'navy-slice-4', 'navy-slice-5', 'navy-slice-6'];

export function NavyAllocation({positions, asOf, source}) {
  const {rows, total} = allocationRows(positions);
  if (!total) return <div className="navy-slide-body">
    <div className="navy-head"><h2>Overall asset allocation</h2></div>
    <p className="navy-pending">Confirm holdings with an asset class column to build this slide. Classes are read from the file and are never inferred from a ticker.</p>
  </div>;
  const note = allocationNote({rows, total});
  const R = 54, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = rows.map((row, i) => {
    const len = (row.percent / 100) * C;
    const arc = {key: row.name, cls: SLICE[i % SLICE.length], dash: `${len} ${C - len}`, off: -offset};
    offset += len;
    return arc;
  });
  return <div className="navy-slide-body">
    <div className="navy-head">
      <h2>Overall asset allocation</h2>
      {asOf && <span className="navy-meta">AS OF {asOf}</span>}
    </div>
    <div className="navy-allocation-layout">
      <figure className="navy-donut">
        <svg viewBox="0 0 140 140" role="img" aria-label={`Allocation by asset class: ${rows.map(r => `${r.name} ${r.percent.toFixed(2)}%`).join(', ')}`}>
          <g transform="rotate(-90 70 70)">
            {arcs.map(a => <circle key={a.key} className={a.cls} cx="70" cy="70" r={R}
              strokeDasharray={a.dash} strokeDashoffset={a.off}/>)}
          </g>
        </svg>
        <figcaption>
          <b>{total >= 1e6 ? `$${(total / 1e6).toFixed(2)}M` : usd(total)}</b>
          <span className="navy-eyebrow">TOTAL PORTFOLIO</span>
        </figcaption>
      </figure>
      <div className="navy-allocation-table">
        <div className="navy-eyebrow is-gold">ASSET CLASS PRIMARY</div>
        <div className="navy-rows navy-rows-allocation">
          <div className="navy-row navy-row-head"><span>ASSET CLASS</span><span>ALLOCATION</span><span>EST. VALUE</span></div>
          {rows.map((row, i) => <div className="navy-row" key={row.name}>
            <span className="navy-swatch-cell"><i className={SLICE[i % SLICE.length]}/>{row.name}</span>
            <span><b>{row.percent.toFixed(2)}%</b></span>
            <span>{usd(row.value)}</span>
          </div>)}
          <div className="navy-row navy-row-total">
            <span>Total</span><span><b>100.00%</b></span><span>{usd(total)}</span>
          </div>
        </div>
        {note && <p className="navy-allocation-note">{note}</p>}
      </div>
    </div>
    <p className="navy-source">{source ? `Source: ${source}. ` : ''}Estimated values apply allocation percentages to the confirmed portfolio value of {usd(total)}. Asset class and region are read from your file.</p>
  </div>;
}

// --- Performance by asset class -------------------------------------------
// Sector performance answers what the market did; this answers what the
// client's own classes did, on the same start-value basis as the per-position
// attribution so the two slides cannot disagree.
export function NavyAssetClassPerformance({positions, returns, asOf, source}) {
  const result = assetClassPerformance(positions, returns);
  if (!result.rows.length) return <div className="navy-slide-body">
    <div className="navy-head"><h2>Performance by asset class</h2></div>
    <p className="navy-pending">This slide builds once year-to-date returns load for the confirmed holdings. No class return is estimated from a current snapshot.</p>
  </div>;
  const span = Math.max(...result.rows.map(r => Math.abs(r.ytdReturn)), 1);
  return <div className="navy-slide-body">
    <div className="navy-head">
      <h2>Performance by asset class</h2>
      {asOf && <span className="navy-meta">YTD {asOf}</span>}
    </div>
    <div className="navy-lede">
      <div>
        <div className="navy-eyebrow">PORTFOLIO, YEAR TO DATE</div>
        <Display value={signed(result.portfolioReturn)} gold={result.portfolioReturn >= 0}/>
      </div>
    </div>
    <div className="navy-rows navy-rows-classperf">
      <div className="navy-row navy-row-head"><span>ASSET CLASS</span><span>WEIGHT</span><span/><span>YTD RETURN</span></div>
      {result.rows.map(row => {
        const weight = result.rows.reduce((n, r) => n + r.value, 0);
        return <div className="navy-row" key={row.name}>
          <span>{row.name}</span>
          <span className="navy-index">{weight > 0 ? `${(row.value / weight * 100).toFixed(1)}%` : ''}</span>
          <span className="navy-classperf-track">
            <i className={row.ytdReturn >= 0 ? 'is-up' : 'is-down'}
               style={{width: `${Math.abs(row.ytdReturn) / span * 100}%`}}/>
          </span>
          <span><b>{signed(row.ytdReturn)}</b></span>
        </div>;
      })}
    </div>
    <p className="navy-source">
      {source ? `${source}. ` : ''}Class returns are each class's gain over its own start-of-year value, the same basis as the attribution slide — not an average of its holdings' returns.
      {result.coverage < 99.5 && ` Covers ${result.coverage.toFixed(1)}% of portfolio value; ${result.unpriced.length} position${result.unpriced.length === 1 ? '' : 's'} without price history ${result.unpriced.length === 1 ? 'is' : 'are'} excluded.`}
    </p>
  </div>;
}

// --- Administrative updates ------------------------------------------------
// A standing slide for the custodian move. Everything on it is editable in the
// review step: the names are a specific client's professional contacts, so
// nothing is hardcoded into every deck, and a card with nothing in it is left
// off rather than printed empty.
// The admin slide is edited on the slide itself. Every field is the line it
// will print, so there is no form to keep in step with the page, and nothing
// to open before the slide can be changed. `edit` is only ever true in the
// preview; the printed deck renders plain text.
function AdminField({value, onChange, placeholder, tag = 'span', className = '', edit}) {
  const Tag = tag;
  if (!edit) return value?.trim() ? <Tag className={className}>{value}</Tag> : null;
  return <Tag className={className}>
    <input
      className="slide-field"
      value={value || ''}
      placeholder={placeholder}
      size={Math.max((value || placeholder || '').length, 6)}
      onChange={(e) => onChange(e.target.value)}
    />
  </Tag>;
}

function AdminList({items, onChange, label, edit}) {
  const shown = edit ? items : items.filter((s) => s.trim());
  if (!shown.length && !edit) return null;
  return <section className="navy-admin-col">
    <div className="navy-eyebrow is-gold">{label}</div>
    <ul>
      {shown.map((item, i) => <li key={i}>
        {edit ? <span className="slide-field-row">
          <input className="slide-field" value={item} placeholder="Add a line"
            onChange={(e) => onChange(items.map((x, j) => j === i ? e.target.value : x))}/>
          <button type="button" className="slide-field-drop" aria-label={`Remove line ${i + 1}`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}>&times;</button>
        </span> : item}
      </li>)}
      {edit && <li className="slide-field-add">
        <button type="button" onClick={() => onChange([...items, ''])}>+ Add a line</button>
      </li>}
    </ul>
  </section>;
}

export function NavyAdmin({admin = {}, edit = false, onChange}) {
  // In edit mode nothing is filtered out: an empty field is the one that still
  // needs typing into, and hiding it would leave no way to fill it in.
  const set = (patch) => onChange?.({...admin, ...patch});
  // Two moves, not a four-step chain. Rendering the four cards in one row of
  // arrows read as NFS becoming LPL becoming Investor360 becoming Account View,
  // which is not what happens: the custodian changes, and separately the portal
  // does. Each is its own before-and-after, labelled with what is moving.
  const moves = [
    {label: 'CUSTODIAN', from: 'fromCustodian', to: 'toCustodian'},
    {label: 'CLIENT PORTAL', from: 'fromPortal', to: 'toPortal'},
  ];
  const shownMoves = edit ? moves : moves.filter(m => admin[m.from]?.trim() || admin[m.to]?.trim());
  const contacts = admin.contacts || [];
  const shownContacts = edit ? contacts : contacts.filter(c => c.name?.trim());
  const chip = (key, placeholder, isNew) => <div className={`navy-admin-chip ${isNew ? 'is-new' : ''}`}>
    {edit
      ? <b><input className="slide-field" value={admin[key] || ''} placeholder={placeholder}
          onChange={(e) => set({[key]: e.target.value})}/></b>
      : <b>{admin[key]}</b>}
    <small>{isNew ? 'New' : 'Current'}</small>
  </div>;
  return <div className={`navy-slide-body ${edit ? 'is-editable' : ''}`}>
    <div className="navy-head"><h2>Admin</h2></div>
    <div className="navy-admin-head">
      {edit
        ? <h3><input className="slide-field" value={admin.heading || ''} placeholder="Administrative updates"
            onChange={(e) => set({heading: e.target.value})}/></h3>
        : <h3>{admin.heading?.trim() || 'Administrative updates'}</h3>}
      {edit
        ? <span className="navy-admin-when"><input className="slide-field" value={admin.when || ''}
            placeholder="WHEN" onChange={(e) => set({when: e.target.value})}/></span>
        : admin.when?.trim() && <span className="navy-admin-when">{admin.when.toUpperCase()}</span>}
    </div>
    {shownMoves.length > 0 && <div className="navy-admin-moves">
      {shownMoves.map(move => <section key={move.label} className="navy-admin-move">
        <div className="navy-eyebrow is-gold">{move.label}</div>
        <div className="navy-admin-flow">
          {chip(move.from, 'Current', false)}
          <span className="navy-admin-arrow" aria-hidden="true">&rarr;</span>
          {chip(move.to, 'New', true)}
        </div>
      </section>)}
    </div>}
    {/* Boxes floating in the lower half read as leftovers, however they are
        spaced. These are columns of one band instead: a rule across the page,
        hairlines between them running the full height, and the band carried to
        the foot of the slide. Two columns or three, the page is used. */}
    <div className="navy-admin-columns">
      <AdminList items={admin.staysTheSame || []} edit={edit} label="WHAT STAYS THE SAME"
        onChange={(staysTheSame) => set({staysTheSame})}/>
      <AdminList items={admin.whatYouSee || []} edit={edit} label="WHAT YOU WILL SEE"
        onChange={(whatYouSee) => set({whatYouSee})}/>
      {(shownContacts.length > 0) && <section className="navy-admin-col">
        <div className="navy-eyebrow is-gold">PROFESSIONAL CONTACTS</div>
        <dl>{shownContacts.map((c, i) => <React.Fragment key={i}>
          <dt>{edit
            ? <input className="slide-field" value={c.role} placeholder="Role"
                onChange={(e) => set({contacts: contacts.map((x, j) => j === i ? {...x, role: e.target.value} : x)})}/>
            : c.role}</dt>
          <dd>{edit
            ? <span className="slide-field-row">
                <input className="slide-field" value={c.name} placeholder="Name"
                  onChange={(e) => set({contacts: contacts.map((x, j) => j === i ? {...x, name: e.target.value} : x)})}/>
                <button type="button" className="slide-field-drop" aria-label={`Remove ${c.role || 'contact'}`}
                  onClick={() => set({contacts: contacts.filter((_, j) => j !== i)})}>&times;</button>
              </span>
            : c.name}</dd>
        </React.Fragment>)}</dl>
        {edit && <button type="button" className="slide-field-add-inline"
          onClick={() => set({contacts: [...contacts, {role: 'Contact', name: ''}]})}>+ Add a contact</button>}
      </section>}
      {edit && shownContacts.length === 0 && <section className="navy-admin-col">
        <div className="navy-eyebrow is-gold">PROFESSIONAL CONTACTS</div>
        <button type="button" className="slide-field-add-inline"
          onClick={() => set({contacts: [{role: 'CPA', name: ''}]})}>+ Add a contact</button>
      </section>}
    </div>
  </div>;
}

