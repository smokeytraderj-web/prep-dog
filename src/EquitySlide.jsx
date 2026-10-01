import React from 'react';

// Matches the firm's Equity Sector Exposure page: an allocation table reading
// across the page with the eleven GICS sectors as columns grouped into
// Cyclical / Sensitive / Defensive, over a vertical relative-weight chart.
// SECTOR_ORDER is already in that grouping order, so the spans are positional.
const GROUPS = [
  {name: 'Cyclical', span: 4},
  {name: 'Sensitive', span: 4},
  {name: 'Defensive', span: 3},
];

// Zones are fixed so a deep negative bar and its value label can never reach
// the sector names: bars are capped at maxBar, the label sits 14 below that,
// and the names start below the deepest possible label.
const CHART = {w: 1160, h: 234, zero: 100, maxBar: 70, labelGap: 14, names: 206};

export default function EquitySlide({data, example = false}) {
  const diffs = data.sectors.map(sector => sector.portfolio - sector.benchmark);
  const extent = Math.max(0.5, ...diffs.map(Math.abs));
  const scale = CHART.maxBar / extent;
  const step = CHART.w / data.sectors.length;
  const portfolioLabel = data.portfolio_label || 'Portfolio';
  const benchmarkLabel = data.benchmark_label || 'Benchmark';

  return <div className="equity-slide">
    {/* Same heading structure as every other slide: kicker, title, as-of. */}
    <div className="report-heading">
      <div><span className="slide-kicker">EQUITY EXPOSURE</span><h2>Equity Sector Exposure</h2></div>
      <span>{data.as_of}</span>
    </div>
    {example && <p className="example-banner">EXAMPLE ONLY · Supplied sample data, not your portfolio</p>}

    <p className="equity-caption">Allocation (%)</p>
    <table className="equity-allocation">
      <thead>
        <tr className="equity-groups">
          <th/>
          {GROUPS.map(group => <th key={group.name} colSpan={group.span}>{group.name}</th>)}
        </tr>
        <tr className="equity-sectors">
          <th/>
          {data.sectors.map(sector => <th key={sector.name}>{sector.name}</th>)}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">{portfolioLabel}</th>
          {data.sectors.map(sector => <td key={sector.name}>{sector.portfolio.toFixed(2)}</td>)}
        </tr>
        <tr>
          <th scope="row">{benchmarkLabel}</th>
          {data.sectors.map(sector => <td key={sector.name}>{sector.benchmark.toFixed(2)}</td>)}
        </tr>
      </tbody>
    </table>

    <p className="equity-caption">Portfolio relative to {benchmarkLabel} (percentage points)</p>
    <svg className="equity-diff" viewBox={`0 0 ${CHART.w} ${CHART.h}`} role="img"
      aria-label={`Portfolio weight relative to ${benchmarkLabel} by sector, in percentage points`}>
      <line x1="0" x2={CHART.w} y1={CHART.zero} y2={CHART.zero} className="eq-zero"/>
      {data.sectors.map((sector, i) => {
        const value = diffs[i];
        const height = Math.abs(value) * scale;
        const x = i * step + step / 2;
        const up = value >= 0;
        return <g key={sector.name}>
          <rect x={x - 26} y={up ? CHART.zero - height : CHART.zero} width="52" height={height}
            className={up ? 'eq-up' : 'eq-down'}/>
          <text x={x} y={up ? CHART.zero - height - 8 : CHART.zero + height + CHART.labelGap} textAnchor="middle"
            className="eq-value">{up ? '+' : ''}{value.toFixed(2)}</text>
          {sector.name.split(' ').map((word, w) =>
            <text key={word + w} x={x} y={CHART.names + w * 11} textAnchor="middle" className="eq-label">{word}</text>)}
        </g>;
      })}
    </svg>

    <p className="equity-source">{data.source_note}{data.firm ? ` ${data.firm}` : ''}</p>
  </div>;
}
