import React from 'react';
import { SP500_EARNINGS, earningsGrowth } from './earnings-data.js';
import { contributors } from './attribution.js';

// The two slides the firm's existing deck already has: sector leadership as a
// ranked bar chart, and the S&P 500 earnings path. Each is written once and
// themed by the caller passing `navy`, because unlike the six core slides these
// two ARE the same composition in both decks — the firm's own layout is the
// reference, and it reads the same way on either ground.

const signed = n => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
const signed0 = n => `${n > 0 ? '+' : ''}${n.toFixed(0)}%`;

// ---------------------------------------------------------------- sectors

// `base` is the bottom of the plot and `names` the label band below it. The gap
// between them has to clear a negative bar's value label, which sits 20 below
// the bar's foot — otherwise the deepest sector's number lands on its own name.
const S = {w: 1160, h: 420, top: 40, base: 296, names: 342, lineH: 13, fill: 0.62};

export function SectorYtdSlide({data, navy = false}) {
  const ready = data?.indexes?.length && data.indexes.every(i => Number.isFinite(Number(i.return)));
  if (!ready) return <Waiting navy={navy} kicker="MARKET CONTEXT" title="Sector performance, year to date"
    body="This slide builds from the Select Sector SPDR funds as soon as the market service responds. No sector returns are invented from the holdings."/>;

  // Ascending, the way the firm's deck ranks them: the leader reads last.
  const ranked = [...data.indexes].sort((a, b) => Number(a.return) - Number(b.return));
  const values = ranked.map(i => Number(i.return));
  const low = Math.min(0, ...values), high = Math.max(0, ...values);
  const span = (high - low) || 1;
  const zero = S.base - (0 - low) / span * (S.base - S.top);
  const y = v => S.base - (v - low) / span * (S.base - S.top);
  const track = S.w / ranked.length;
  const bar = track * S.fill;

  return <div className={`context-board ${navy ? 'is-navy' : ''}`}>
    <Head navy={navy} kicker="MARKET CONTEXT" title="Sector performance, year to date"
      meta={data.asOf ? `Year-to-date through ${data.asOf}` : ''}/>
    <div className="board-chart">
      <svg viewBox={`0 0 ${S.w} ${S.h}`} preserveAspectRatio="xMidYMid meet" role="img"
        aria-label="S&P 500 sector total returns year to date, ranked lowest to highest">
        <line x1="0" x2={S.w} y1={zero} y2={zero} className="board-zero"/>
        {ranked.map((index, i) => {
          const v = Number(index.return), cx = i * track + track / 2;
          const up = v >= 0, top = up ? y(v) : zero, height = Math.abs(y(v) - zero);
          return <g key={index.id}>
            <rect x={cx - bar / 2} y={top} width={bar} height={Math.max(height, 1)}
              className={up ? 'board-bar' : 'board-bar is-down'}/>
            <text x={cx} y={up ? top - 10 : top + height + 20} textAnchor="middle" className="board-value">
              {signed(v)}</text>
            {index.label.split(' ').map((word, n) =>
              <text key={word + n} x={cx} y={S.names + n * S.lineH} textAnchor="middle" className="board-name">
                {word}</text>)}
          </g>;
        })}
      </svg>
    </div>
    <p className="board-source">All indices are unmanaged, and investors cannot invest directly into an index. Unlike
      investments, indices do not incur management fees, charges or expenses. Past performance does not guarantee
      future results. {data.source}</p>
  </div>;
}

// --------------------------------------------------------------- earnings

const E = {w: 760, h: 430, top: 44, base: 360, left: 54, lineH: 13};

export function EarningsExpectationsSlide({data = SP500_EARNINGS, navy = false}) {
  const series = data.series || [];
  if (series.length < 2) return <Waiting navy={navy} kicker="MARKET CONTEXT" title="S&P 500 earnings expectations"
    body="This slide needs the earnings table to carry at least two periods."/>;

  const max = Math.max(...series.map(s => s.eps));
  // A round ceiling so the gridlines land on readable numbers.
  const step = max > 400 ? 50 : max > 200 ? 25 : 10;
  const ceiling = Math.ceil(max / step) * step;
  const y = v => E.base - (v / ceiling) * (E.base - E.top);
  const ticks = Array.from({length: Math.floor(ceiling / step) + 1}, (_, i) => i * step);
  const track = (E.w - E.left) / series.length;
  const bar = track * 0.44;
  const cx = i => E.left + i * track + track / 2;
  const steps = earningsGrowth(series, 3);

  return <div className={`context-board earnings-board ${navy ? 'is-navy' : ''}`}>
    <Head navy={navy} kicker="MARKET CONTEXT" title="S&P 500 earnings expectations"
      meta={data.asOf ? `As of ${data.asOf}` : ''}/>
    <div className="earnings-split">
      <ul className="earnings-points">
        {(data.points || []).map(point => <li key={point}>{point}</li>)}
      </ul>
      <div className="board-chart">
        <svg viewBox={`0 0 ${E.w} ${E.h}`} preserveAspectRatio="xMidYMid meet" role="img"
          aria-label="S&P 500 earnings per share by year, with consensus estimates for the forward years">
          {ticks.map(v => <g key={v}>
            <line x1={E.left} x2={E.w} y1={y(v)} y2={y(v)} className="board-grid"/>
            <text x={E.left - 10} y={y(v) + 4} textAnchor="end" className="board-axis">{v}</text>
          </g>)}
          {series.map((entry, i) => {
            const estimate = entry.kind === 'Estimate';
            return <g key={entry.period}>
              <rect x={cx(i) - bar / 2} y={y(entry.eps)} width={bar} height={E.base - y(entry.eps)}
                className={estimate ? 'board-bar is-estimate' : 'board-bar'}/>
              <text x={cx(i)} y={E.base + 20} textAnchor="middle" className="board-name">{entry.period}</text>
            </g>;
          })}
          {/* Growth callouts are drawn from the series, so an arrow can never
              disagree with the bars it spans. */}
          <defs>
            <marker id="earn-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="board-arrow-head"/>
            </marker>
          </defs>
          {steps.map(stepItem => {
            const x1 = cx(stepItem.from) + bar * 0.6, x2 = cx(stepItem.to) - bar * 0.6;
            const y1 = y(series[stepItem.from].eps) - 16, y2 = y(series[stepItem.to].eps) - 16;
            return <g key={stepItem.to}>
              <line x1={x1} x2={x2} y1={y1} y2={y2} className="board-arrow" markerEnd="url(#earn-arrow)"/>
              <text x={(x1 + x2) / 2} y={Math.min(y1, y2) - 12} textAnchor="middle" className="board-growth">
                {signed0(stepItem.growth)}</text>
            </g>;
          })}
        </svg>
      </div>
    </div>
    <p className="board-source">{data.source} {data.note} Estimates are not a forecast of your portfolio's results.</p>
  </div>;
}


// ---------------------------------------------------------------- contents

// The contents page is built from the deck itself rather than a written list,
// so it cannot fall out of step with what follows it. Page numbers are the
// slide's position, counting the cover, which is what the footer and folio use.
export function ContentsSlide({slides = [], navy = false}) {
  const entries = slides
    .map((slide, i) => ({name: slide.name, page: i + 1, id: slide.id}))
    .filter(entry => entry.id !== 'cover' && entry.id !== 'contents');
  // Two columns once the deck is long enough that one would run off the page.
  const split = entries.length > 8 ? Math.ceil(entries.length / 2) : entries.length;
  const columns = [entries.slice(0, split), entries.slice(split)].filter(c => c.length);

  return <div className={`context-board contents-board ${navy ? 'is-navy' : ''}`}>
    <Head navy={navy} kicker="IN THIS REVIEW" title="Contents" meta={`${entries.length} slides`}/>
    <div className="contents-columns" style={{gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`}}>
      {columns.map((column, c) => <ol key={c} className="contents-list">
        {column.map(entry => <li key={entry.id + entry.page}>
          <span className="contents-page">{String(entry.page).padStart(2, '0')}</span>
          <span className="contents-name">{entry.name}</span>
          <span className="contents-rule" aria-hidden="true"/>
        </li>)}
      </ol>)}
    </div>
  </div>;
}


// ------------------------------------------------------------- attribution

const usd = n => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(n);
const pp = n => `${n > 0 ? '+' : ''}${n.toFixed(2)}`;

export function AttributionSlide({result, asOf, source, navy = false}) {
  if (!result || !result.rows.length) return <Waiting navy={navy} kicker="ATTRIBUTION PERFORMANCE"
    title="What moved the portfolio"
    body="This slide builds once the market service returns a year-to-date return for the confirmed holdings."/>;

  const {positive, negative} = contributors(result, 5);
  const column = (rows, heading) => <section>
    <h3>{heading}</h3>
    <div className="attrib-rows">
      {rows.map(row => <div className="attrib-row" key={row.ticker}>
        <span className="attrib-ticker">{row.ticker}{row.name && <small>{row.name}</small>}</span>
        <span className="attrib-fig">{pp(row.ytdReturn)}%</span>
        <span className="attrib-contribution">{pp(row.contribution)}</span>
      </div>)}
      {!rows.length && <p className="attrib-empty">None in the confirmed holdings.</p>}
    </div>
  </section>;

  return <div className={`context-board attrib-board ${navy ? 'is-navy' : ''}`}>
    <Head navy={navy} kicker="ATTRIBUTION PERFORMANCE" title="What moved the portfolio"
      meta={asOf ? `Year-to-date through ${asOf}` : ''}/>

    <div className="attrib-lede">
      <div>
        <div className={navy ? 'navy-eyebrow is-gold' : 'attrib-label'}>PORTFOLIO RETURN, YEAR TO DATE</div>
        <div className="attrib-headline">{pp(result.portfolioReturn)}%</div>
      </div>
      <p className="attrib-note">
        {positive[0] ? `${positive[0].ticker} added the most at ${pp(positive[0].contribution)} points. ` : ''}
        {negative[0] ? `${negative[0].ticker} cost the most at ${pp(negative[0].contribution)}. ` : ''}
        Gains are {usd(result.gainTotal)} on a starting value of {usd(result.startTotal)}.
      </p>
    </div>

    <div className="attrib-columns">
      <div className="attrib-head"><span>POSITION</span><span>YTD RETURN</span><span>CONTRIBUTION (PP)</span></div>
      <div className="attrib-head"><span>POSITION</span><span>YTD RETURN</span><span>CONTRIBUTION (PP)</span></div>
      {column(positive, 'Top contributors')}
      {column(negative, 'Top detractors')}
    </div>

    <p className="board-source">
      Contribution is each position’s share of the portfolio’s year-to-date return, in percentage points, and the
      figures sum to that return. It is calculated from each position’s start-of-year value, so a position held
      unchanged all year is measured exactly; a position bought or sold during the year is not, and the holdings file
      does not say which those are.
      {result.unpriced.length > 0 && ` ${result.unpriced.length} position${result.unpriced.length === 1 ? '' : 's'} (${result.unpriced.slice(0, 6).join(', ')}) had no year-to-date price history and are excluded; the table covers ${result.coverage.toFixed(1)}% of portfolio value.`}
      {source ? ` ${source}` : ''}
    </p>
  </div>;
}

// ----------------------------------------------------------------- shared

function Head({navy, kicker, title, meta}) {
  return <div className={navy ? 'navy-head board-head' : 'board-head'}>
    <div>
      {!navy && <span className="slide-kicker">{kicker}</span>}
      <h2>{title}</h2>
    </div>
    {meta && <span className={navy ? 'navy-meta' : 'board-meta'}>{navy ? meta.toUpperCase() : meta}</span>}
  </div>;
}

function Waiting({navy, kicker, title, body}) {
  return <div className={`context-board ${navy ? 'is-navy' : ''}`}>
    <Head navy={navy} kicker={kicker} title={title} meta=""/>
    <p className={navy ? 'navy-pending' : 'board-pending'}>{body}</p>
  </div>;
}
