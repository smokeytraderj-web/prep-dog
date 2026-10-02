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
// Every page in the deck sets its date the same way: the long form, so one
// slide cannot read as though a different hand made it.
export function longDate(value) {
  if (!value) return '';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'});
}

export function DwyerRisk({s}) {
  const scaleMax = s.scale_max || 99;
  const score = Math.max(0, Math.min(scaleMax, Number(s.risk_score) || 0));
  const allocation = [...(s.allocation || [])].sort((a, b) => b.percent - a.percent);
  const r = s.range || {};
  const costs = Object.values(s.costs || {});
  const costTotal = costs.length && costs.every(Number.isFinite)
    ? costs.reduce((a, b) => a + b, 0) : null;
  const span = (Math.max(0, r.upside_pct || 0) - Math.min(0, r.downside_pct || 0)) || 1;
  const zero = (-Math.min(0, r.downside_pct || 0) / span) * 100;
  const measures = [
    ['Risk-adjusted grade (4.3 is best)', s.metrics?.grade == null ? null : `${s.metrics.grade.toFixed(1)} / 4.3`],
    ['Annual dividend', s.metrics?.annual_dividend_pct == null ? null : `${s.metrics.annual_dividend_pct.toFixed(2)}%`],
    ['Centre of the modeled annual range', s.metrics?.annual_range_midpoint_pct == null ? null : `${s.metrics.annual_range_midpoint_pct.toFixed(2)}%`],
    ['Annualized volatility', s.metrics?.annual_volatility_pct == null ? null : `${s.metrics.annual_volatility_pct.toFixed(2)}%`],
    ['Maximum drawdown', s.metrics?.max_drawdown_pct == null ? null : `${s.metrics.max_drawdown_pct.toFixed(2)}%`],
    ['Total annual cost', costTotal == null ? null : `${costTotal.toFixed(2)}%`],
  ].filter(([, v]) => v != null && !String(v).includes('undefined')).slice(0, 4);

  // The score on its own tells a client nothing: 42 out of 99 is only meaningful
  // next to what the scale means and what is driving it.
  const band = score < 34 ? 'Conservative' : score < 67 ? 'Moderate' : 'Aggressive';
  const lead = allocation[0];
  const reading = `${band} — ${score < 50 ? 'below' : score > 50 ? 'above' : 'at'} the midpoint of the 1–${scaleMax} scale`
    + (lead ? `, driven by a ${lead.percent.toFixed(0)}% ${lead.name.toLowerCase()} sleeve.` : '.');

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
      {s.as_of && <span className="navy-meta">AS OF {longDate(s.as_of)}</span>}
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
        <p className="dw-risk-read">{reading}</p>
        <div className="dw-risk-total">
          <div className="dw-eyebrow">PORTFOLIO TOTAL</div>
          <b>{usd(s.total_value)}</b>
        </div>
      </section>

      <section className="dw-risk-side">
        {Number.isFinite(r.downside_pct) && Number.isFinite(r.upside_pct) && <>
          <div className="dw-eyebrow">WHERE THIS PORTFOLIO COULD SIT IN SIX MONTHS</div>
          <div className="dw-range">
            <div className="dw-range-ends">
              <div>
                <span>DOWNSIDE {r.downside_pct.toFixed(1)}%</span>
                <b className="is-down">{usd(s.total_value + r.downside_value)}</b>
              </div>
              <div className="dw-range-today">
                <span>TODAY</span>
                <b>{usd(s.total_value)}</b>
              </div>
              <div className="dw-range-up">
                <span>UPSIDE +{r.upside_pct.toFixed(1)}%</span>
                <b className="is-up">{usd(s.total_value + r.upside_value)}</b>
              </div>
            </div>
            <div className="dw-range-track">
              <i className="dw-range-down" style={{width: `${zero}%`}}/>
              <i className="dw-range-up-fill" style={{width: `${100 - zero}%`}}/>
              <span className="dw-range-mark" style={{left: `${zero}%`}}/>
            </div>
            <p className="dw-range-note">A 90% central range from six months of this portfolio's own history. Outcomes can fall outside it; it is not a guarantee and not a maximum loss.</p>
          </div>
        </>}

        {allocation.length > 0 && <>
          <div className="dw-eyebrow">WHAT IT HOLDS</div>
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

        {measures.length > 0 && <><div className="dw-eyebrow">THE MEASURES BEHIND IT</div><dl className="dw-measures">
          {measures.map(([label, value]) => <div key={label}>
            <dt>{label}</dt><dd>{value}</dd>
          </div>)}
        </dl></>}
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
  {name: 'Next steps', ids: ['notes']},
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
      <span className="navy-meta">{slides.length} slides</span>
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


// --- the closing discussion page ------------------------------------------
// The advisor's own points, set as the deck sets everything else. Numbered so
// they can be referred to across the table, and spaced so four of them fill
// the page rather than huddling at the top.
export function DwyerDiscussion({points = [], heading = 'What we will cover'}) {
  return <div className="dw-slide is-discussion">
    <div className="navy-head">
      <h2>{heading}</h2>
    </div>
    <ol className="dw-discussion">
      {points.map((point, i) => <li key={i}>
        <span className="dw-discussion-index">{String(i + 1).padStart(2, '0')}</span>
        <p>{point}</p>
      </li>)}
    </ol>
  </div>;
}

// --- how the portfolio itself did ------------------------------------------
// The page the deck was missing. Everything else said what markets did; this
// says what the client's own money did, and against a benchmark built to their
// mix rather than an index they do not hold.
//
// Both figures are estimates and the slide says so: the app is given today's
// positions, not a transaction history, so a return can only be computed as
// though every position were held all year. That assumption is stated on the
// page rather than buried, because for a book that traded it is wrong.
export function DwyerPerformance({result, blend, asOf, source, navy = false}) {
  const pct = n => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
  const lead = result?.portfolioReturn;
  return <div className="dw-slide">
    <div className="navy-head">
      <h2>How your portfolio did</h2>
      {asOf && <span className="navy-meta">YEAR TO DATE THROUGH {String(asOf).toUpperCase()}</span>}
    </div>

    {/* Two figures, not three. A difference tile beside the headline would be
        read as the headline minus the benchmark, and it is not: the headline is
        the whole book, while the comparison can only speak for the classes an
        index exists for. The table carries the like-for-like difference, with
        its own total, so the arithmetic on the page is arithmetic the client
        can follow. */}
    <div className="dw-perf-lead">
      <div className="dw-perf-figure">
        <div className="dw-eyebrow">YOUR PORTFOLIO, ESTIMATED</div>
        <strong className={lead >= 0 ? 'is-up' : 'is-down'}>{pct(lead)}</strong>
      </div>
      {blend && <div className="dw-perf-figure">
        <div className="dw-eyebrow">A PORTFOLIO BUILT LIKE YOURS</div>
        <strong>{pct(blend.benchmarkReturn)}</strong>
        <small>{blend.coverage >= 99.5
          ? 'Your own asset class weights, each at its index'
          : `Your own weights across ${blend.coverage.toFixed(0)}% of the book`}</small>
      </div>}
    </div>

    {blend && <table className="dw-perf-table">
      <thead>
        <tr>
          <th>ASSET CLASS</th><th>WEIGHT</th><th>YOURS</th><th>BENCHMARK</th><th>DIFFERENCE</th>
        </tr>
      </thead>
      <tbody>
        {blend.rows.map(row => <tr key={row.name}>
          <td>{row.name}<small>{row.benchmarkLabel}</small></td>
          <td>{row.weight.toFixed(1)}%</td>
          <td>{pct(row.portfolioReturn)}</td>
          <td>{pct(row.benchmarkReturn)}</td>
          <td className={row.difference >= 0 ? 'is-up' : 'is-down'}>
            {`${row.difference > 0 ? '+' : ''}${row.difference.toFixed(2)}`}
          </td>
        </tr>)}
      </tbody>
      <tfoot>
        <tr>
          <td>{blend.coverage >= 99.5 ? 'Whole portfolio' : 'Classes compared'}</td>
          <td>100.0%</td>
          <td>{pct(blend.portfolioReturn)}</td>
          <td>{pct(blend.benchmarkReturn)}</td>
          <td className={blend.difference >= 0 ? 'is-up' : 'is-down'}>
            {`${blend.difference > 0 ? '+' : ''}${blend.difference.toFixed(2)}`}
          </td>
        </tr>
      </tfoot>
    </table>}

    <p className="dw-source">
      Estimated from the positions you hold now, measured from the prior year-end close, as though each
      had been held all year; a position bought or sold during the year is not reflected.
      {blend && blend.coverage < 99.5 &&
        ` The comparison covers ${blend.coverage.toFixed(0)}% of the priced book${blend.excluded.length ? `; ${blend.excluded.join(' and ').toLowerCase()} have no index proxy and are excluded from both sides` : ''}.`}
      {result?.unpriced?.length ? ` No price history for ${result.unpriced.join(', ')}.` : ''}
      {source ? ` ${source}` : ''}
    </p>
  </div>;
}

// --- what it pays, and what it costs ---------------------------------------
// The advisory fee is the one figure the app cannot know, so it is typed on the
// slide the way the cover and the admin page are, and stays out of the total
// until it has been. Everything else comes from published yields and expense
// ratios already fetched for the risk snapshot.
export function DwyerIncome({data, advisoryFee, onAdvisoryFee, edit = false, asOf}) {
  const money = n => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(n);
  const pct = n => `${n.toFixed(2)}%`;
  const top = data.rows.filter(row => row.income > 0).slice(0, 4);
  return <div className="dw-slide">
    <div className="navy-head">
      <h2>What it pays, and what it costs</h2>
      {asOf && <span className="navy-meta">AS OF {String(asOf).toUpperCase()}</span>}
    </div>

    <div className="dw-money-lead">
      <div className="dw-perf-figure">
        <div className="dw-eyebrow">ESTIMATED ANNUAL INCOME</div>
        <strong>{data.annualIncome == null ? '--' : money(data.annualIncome)}</strong>
        <small>{data.yieldPct == null ? 'No published yields' : `${pct(data.yieldPct)} on the positions that publish a yield`}</small>
      </div>
      <div className="dw-perf-figure">
        <div className="dw-eyebrow">WHAT YOU PAY TO HOLD IT</div>
        <strong>{pct(data.totalCostPct)}</strong>
        <small>{data.advisoryPct == null
          ? 'Fund expenses only; add the advisory fee below'
          : `${money(data.totalCostValue)} a year, fund expenses and advisory fee`}</small>
      </div>
    </div>

    <div className="dw-money-split">
      <section>
        <div className="dw-eyebrow">WHERE THE INCOME COMES FROM</div>
        <dl className="dw-money-list">
          {top.map(row => <div key={row.ticker}>
            <dt>{row.ticker}<small>{row.name !== row.ticker ? row.name : ''}</small></dt>
            <dd>{money(row.income)}<small>{pct(row.yieldPct)}</small></dd>
          </div>)}
        </dl>
      </section>
      <section>
        <div className="dw-eyebrow">THE COST OF HOLDING IT</div>
        <dl className="dw-money-list">
          <div>
            <dt>Fund expenses</dt>
            <dd>{data.fundCostValue == null ? '--' : money(data.fundCostValue)}
              <small>{data.fundCostPct == null ? '' : pct(data.fundCostPct)}</small></dd>
          </div>
          <div>
            <dt>Advisory fee</dt>
            <dd>
              {edit
                ? <span className="slide-field-row dw-fee-input">
                    <input className="slide-field" inputMode="decimal" placeholder="0.00"
                      value={advisoryFee ?? ''} onChange={(e) => onAdvisoryFee?.(e.target.value)}/>
                    <span>%</span>
                  </span>
                : <>{data.advisoryValue == null ? 'Not stated' : money(data.advisoryValue)}
                    <small>{data.advisoryPct == null ? '' : pct(data.advisoryPct)}</small></>}
            </dd>
          </div>
          {data.netIncome != null && <div className="dw-money-net">
            <dt>Income after those costs</dt>
            <dd>{money(data.netIncome)}</dd>
          </div>}
        </dl>
      </section>
    </div>

    <p className="dw-source">
      Estimated from each holding's published yield and expense ratio, not from distributions received or
      fees billed. Income is measured on the {data.incomeCoverage.toFixed(0)}% of the portfolio that publishes a
      yield, and fund expenses on the {data.costCoverage.toFixed(0)}% that publishes a ratio.
      {data.taxDragPct != null && ` Estimated tax drag of ${pct(data.taxDragPct)} a year is modelled separately and is not included above.`}
    </p>
  </div>;
}
