import React from 'react';

// Sector weights read across the page as a single wide row per sector, above a
// full-width over/underweight chart. The weights and the chart used to sit in
// two narrow columns, which repeated every sector name and left the table
// squeezed into a third of the slide.
const GRID = {w: 1160, rowH: 17, labelW: 250, barLabelW: 200};
// Numeric columns are right-aligned on these x positions so the table spans the
// full page instead of bunching against the sector names.
const COLS = [560, 830, 1100];

export default function EquitySlide({data, example = false}) {
  const diffs = data.sectors.map(sector => sector.portfolio - sector.benchmark);
  const extent = Math.max(1, ...diffs.map(Math.abs));
  const benchmarkLabel = data.benchmark_short || data.benchmark_label;

  const rows = data.sectors.length;
  const tableH = 21 + rows * GRID.rowH;
  const barsTop = tableH + 34;
  const barH = 11;
  const barRowH = 16;
  const chartH = 22 + rows * barRowH;
  // The over and underweight sides are rarely symmetric, so the bar scale is
  // whichever side runs out of room first -- both stay on the page and keep a
  // shared scale, which is what makes the two sides comparable.
  const maxOver = Math.max(0, ...diffs);
  const maxUnder = Math.max(0, ...diffs.map(d => -d));
  const zero = GRID.barLabelW + 250;
  const scale = Math.min(
    maxOver > 0 ? (GRID.w - zero - 60) / maxOver : Infinity,
    maxUnder > 0 ? (zero - GRID.barLabelW - 20) / maxUnder : Infinity,
  );

  return <div className="equity-slide">
    <div className="equity-heading"><h2>Equity Sector Exposure</h2><span>{data.as_of}</span></div>
    {example && <p className="example-banner">EXAMPLE ONLY · Supplied sample data, not your portfolio</p>}
    <svg className="equity-board" viewBox={`0 0 ${GRID.w} ${barsTop + chartH}`} role="img"
      aria-label={`Portfolio and ${benchmarkLabel} weights by sector, with over and underweights in percentage points`}>

      {/* Sector weights, full width */}
      <text x="0" y="9" className="eq-kicker">SECTOR WEIGHTS</text>
      <text x={COLS[0]} y="9" className="eq-kicker" textAnchor="end">PORTFOLIO</text>
      <text x={COLS[1]} y="9" className="eq-kicker" textAnchor="end">{(benchmarkLabel || 'BENCHMARK').toUpperCase()}</text>
      <text x={COLS[2]} y="9" className="eq-kicker" textAnchor="end">DIFFERENCE</text>
      <line x1="0" x2={GRID.w} y1="15" y2="15" className="eq-rule-strong"/>
      {data.sectors.map((sector, i) => {
        const y = 21 + i * GRID.rowH;
        const value = diffs[i];
        return <g key={sector.name}>
          {i % 2 === 1 && <rect x="-8" y={y} width={GRID.w + 16} height={GRID.rowH} className="eq-zebra"/>}
          <text x="0" y={y + 12} className="eq-sector">{sector.name}</text>
          <text x={COLS[0]} y={y + 12} className="eq-num" textAnchor="end">{sector.portfolio.toFixed(2)}%</text>
          <text x={COLS[1]} y={y + 12} className="eq-num" textAnchor="end">{sector.benchmark.toFixed(2)}%</text>
          <text x={COLS[2]} y={y + 12} textAnchor="end"
            className={`eq-num eq-diff ${value >= 0 ? 'is-over' : 'is-under'}`}>{value > 0 ? '+' : ''}{value.toFixed(2)}</text>
        </g>;
      })}
      <line x1="0" x2={GRID.w} y1={tableH} y2={tableH} className="eq-rule-strong"/>

      {/* Over / underweight, same row order so the eye can track across */}
      <text x="0" y={barsTop - 10} className="eq-kicker">RELATIVE WEIGHT VS. {(benchmarkLabel || 'BENCHMARK').toUpperCase()} · PERCENTAGE POINTS</text>
      <text x={zero - 10} y={barsTop + 4} className="eq-axis" textAnchor="end">UNDERWEIGHT</text>
      <text x={zero + 10} y={barsTop + 4} className="eq-axis">OVERWEIGHT</text>
      <line x1={zero} x2={zero} y1={barsTop + 10} y2={barsTop + chartH - 4} className="eq-zeroline"/>
      {data.sectors.map((sector, i) => {
        const value = diffs[i];
        const width = Math.abs(value) * scale;
        const y = barsTop + 16 + i * barRowH;
        return <g key={sector.name}>
          <text x="0" y={y + barH - 3} className="eq-sector">{sector.name}</text>
          <rect x={value < 0 ? zero - width : zero} y={y} width={width} height={barH} rx="2"
            className={value < 0 ? 'eq-bar-under' : 'eq-bar-over'}/>
          <text x={value < 0 ? zero - width - 8 : zero + width + 8} y={y + barH - 3}
            textAnchor={value < 0 ? 'end' : 'start'} className="eq-num">{value > 0 ? '+' : ''}{value.toFixed(2)}</text>
        </g>;
      })}
    </svg>
    <p className="equity-source">{data.source_note}</p>
  </div>;
}
