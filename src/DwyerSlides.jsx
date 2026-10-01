import React from 'react';

// Light-deck slides built to the Dwyer file's own layouts.
// ===========================================================================
// The light and navy decks share most components, with the palette doing the
// work. A few of the file's slides are not the navy slide recoloured though —
// they are a different arrangement — and those live here, rendered for the
// light deck only. Every position below is the file's own pixel value at
// 1280x720, which is the size this deck already renders at.

const title = v => String(v || '').replace(/^./, c => c.toUpperCase());

const usd = n => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(n);

// --- Riskalyze snapshot (file slide 9) -------------------------------------
// A panel on the left carrying the gauge and the portfolio total, and a right
// column of range, allocation and measures:
//
//   panel        x58  y173  435x454
//   RISK SCORE   y201, centred
//   gauge        x128 y243  294x294, a half circle
//   score        y314, 48pt
//   1 / 99       y397, Conservative / Aggressive at y422
//   divider      y467, accent bar 6x92 at y493
//   total        y498 label, y524 value at 28pt
//   right column x538: range y179, allocation y282, bar y314, legend y349,
//                measures from y429
export function DwyerRisk({s}) {
  const scaleMax = s.scale_max || 99;
  const score = Math.max(0, Math.min(scaleMax, Number(s.risk_score) || 0));
  const allocation = [...(s.allocation || [])].sort((a, b) => b.percent - a.percent);
  const r = s.range || {};
  const costs = Object.values(s.costs || {});
  const costTotal = costs.length && costs.every(Number.isFinite)
    ? costs.reduce((a, b) => a + b, 0) : null;
  const measures = [
    ['Risk-adjusted grade', s.metrics?.grade == null ? null : `${s.metrics.grade.toFixed(1)} / 4.3`],
    ['Annual dividend', s.metrics?.annual_dividend_pct == null ? null : `${s.metrics.annual_dividend_pct.toFixed(2)}%`],
    ['Annual range midpoint', s.metrics?.annual_range_midpoint_pct == null ? null : `${s.metrics.annual_range_midpoint_pct.toFixed(2)}%`],
    ['Annualized volatility', s.metrics?.annual_volatility_pct == null ? null : `${s.metrics.annual_volatility_pct.toFixed(2)}%`],
    ['Maximum drawdown', s.metrics?.max_drawdown_pct == null ? null : `${s.metrics.max_drawdown_pct.toFixed(2)}%`],
    ['Total annual cost', costTotal == null ? null : `${costTotal.toFixed(2)}%`],
  ].filter(([, v]) => v != null && !String(v).includes('undefined')).slice(0, 4);

  // The gauge is a half circle drawn as one stroked arc with the filled part
  // laid over it, so the score's share of the scale is the arc's own length
  // rather than a value converted twice.
  const R = 118, CX = 147, CY = 150, SW = 26;
  const semi = Math.PI * R;
  const filled = (score / scaleMax) * semi;
  const arc = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

  // The head is the deck's shared one, so this slide carries the same title,
  // as-of and gold rule as every other page rather than starting bare.
  return <div className="dw-slide">
    <div className="navy-head">
      <h2>How much risk you are carrying</h2>
      {s.as_of && <span className="navy-meta">As of {s.as_of}</span>}
    </div>
    <div className="dw-risk">
      <section className="dw-risk-panel">
        <div className="dw-eyebrow dw-centre">RISK SCORE</div>
        <figure className="dw-gauge">
          <svg viewBox="0 0 294 172" role="img"
            aria-label={`Risk score ${score} out of ${scaleMax}`}>
            <path d={arc} className="dw-gauge-track" strokeWidth={SW} fill="none" strokeLinecap="butt"/>
            <path d={arc} className="dw-gauge-fill" strokeWidth={SW} fill="none" strokeLinecap="butt"
              strokeDasharray={`${filled} ${semi - filled}`}/>
            <text x={CX} y={CY - 8} textAnchor="middle" className="dw-gauge-score">{score}</text>
          </svg>
          <figcaption>
            <span><b>1</b>Conservative</span>
            <span><b>{scaleMax}</b>Aggressive</span>
          </figcaption>
        </figure>
        <div className="dw-risk-total">
          <div className="dw-eyebrow">PORTFOLIO TOTAL</div>
          <b>{usd(s.total_value)}</b>
        </div>
      </section>

      <section className="dw-risk-side">
        {Number.isFinite(r.downside_pct) && Number.isFinite(r.upside_pct) && <>
          <div className="dw-eyebrow">95% HISTORICAL RANGE (6 MONTHS)</div>
          <p className="dw-risk-range">
            <span className="is-down">{usd(s.total_value + r.downside_value)} ({r.downside_pct.toFixed(2)}%)</span>
            <i>to</i>
            <span className="is-up">+{usd(s.total_value + r.upside_value)} ({'+'}{r.upside_pct.toFixed(2)}%)</span>
          </p>
        </>}

        {allocation.length > 0 && <>
          <div className="dw-eyebrow">ALLOCATION</div>
          <div className="dw-alloc-bar">
            {allocation.map((a, i) => <i key={a.name} className={`dw-fill-${i % 4}`}
              style={{width: `${a.percent}%`}}/>)}
          </div>
          <div className="dw-alloc-keys">
            {allocation.map((a, i) => <span key={a.name}>
              <i className={`dw-fill-${i % 4}`}/>{title(a.name)}<b>{a.percent.toFixed(2)}%</b>
            </span>)}
          </div>
        </>}

        {measures.length > 0 && <dl className="dw-measures">
          {measures.map(([label, value]) => <div key={label}>
            <dt>{label}</dt><dd>{value}</dd>
          </div>)}
        </dl>}
      </section>
    </div>
    <p className="dw-source">
      In-house model, not a Riskalyze or Nitrogen Risk Number or GPA. Six-month modeled range;
      outcomes may fall outside it, and it is neither a guarantee nor a maximum loss.
    </p>
  </div>;
}

// --- Contents (file slide 2) ----------------------------------------------
// The file's agenda is two columns of numbered sections, each section a gold
// heading over its slides with a hairline under every row:
//
//   col 1 x58 / col 2 x675, sections at y173, 443 and 173, 324, 476
//   number  x58  14pt serif gold
//   heading x106 10pt caps gold, rule under the heading at +34
//   rows    x106 14pt, rule under each row
//
// The sections are the deck's own, not the file's: a slide is grouped by what
// it answers, and anything outside those groups is listed under Appendix
// rather than being forced into one.
const CONTENTS_SECTIONS = [
  {name: 'Portfolio overview', ids: ['account-summary', 'allocation', 'asset-class-performance', 'risk']},
  {name: 'Market review', ids: ['market-indexes', 'fixed-income', 'sector-ytd']},
  {name: 'Portfolio positioning', ids: ['equity', 'regional-attribution']},
  {name: 'Market outlook', ids: ['earnings-expectations', 'midterm']},
  {name: 'Wealth planning & administration', ids: ['admin']},
];

export function DwyerContents({slides = []}) {
  const entries = slides
    .map((s, i) => ({...s, page: i + 1}))
    .filter(s => s.id !== 'cover' && s.id !== 'contents');
  const used = new Set();
  const groups = CONTENTS_SECTIONS.map(section => {
    const rows = entries.filter(e => section.ids.includes(e.id));
    rows.forEach(r => used.add(r));
    return {name: section.name, rows};
  }).filter(g => g.rows.length);
  const rest = entries.filter(e => !used.has(e));
  if (rest.length) groups.push({name: 'Appendix', rows: rest});

  // Two columns balanced by the rows they carry, not by how many groups they
  // hold: splitting five groups three and two put every long section on the
  // left, where it ran into the footer, and left the right column half empty.
  // A heading costs about as much height as two rows.
  const weigh = g => g.rows.length + 2;
  const total = groups.reduce((n, g) => n + weigh(g), 0);
  const columns = [[], []];
  let carried = 0;
  for (const group of groups) {
    const side = carried < total / 2 ? 0 : 1;
    columns[side].push(group);
    carried += weigh(group);
  }
  const numbered = groups.map((g, i) => [g, i + 1]);
  const numberOf = g => numbered.find(([x]) => x === g)[1];

  return <div className="dw-slide">
    <div className="navy-head">
      <h2>Contents</h2>
      <span className="navy-meta">{entries.length} slides</span>
    </div>
    <div className="dw-contents">
      {columns.filter(c => c.length).map((column, ci) => <div className="dw-contents-col" key={ci}>
        {column.map((group) => <section className="dw-group" key={group.name}>
          <header>
            <span className="dw-group-no">{String(numberOf(group)).padStart(2, '0')}</span>
            <span className="dw-group-name">{group.name.toUpperCase()}</span>
          </header>
          {group.rows.map(row => <div className="dw-group-row" key={`${row.id}${row.page}`}>
            <span>{row.name}</span>
            <b>{String(row.page).padStart(2, '0')}</b>
          </div>)}
        </section>)}
      </div>)}
    </div>
  </div>;
}
