import React from 'react';
export default function EquitySlide({data, example=false}) {
  const diffs = data.sectors.map(sector => sector.portfolio-sector.benchmark);
  const extent = Math.max(1, ...diffs.map(Math.abs));
  const scale = 155/extent, zero=350;
  return <div className="equity-slide">
    <div className="equity-heading"><h2>Equity Sector Exposure</h2><span>{data.as_of}</span></div>
    {example && <p className="example-banner">EXAMPLE ONLY · Supplied sample data, not your portfolio</p>}
    <div className="equity-visual-layout">
      <div className="equity-chart-panel"><p className="chart-caption">Relative weight vs. {data.benchmark_short || data.benchmark_label} · percentage points</p>
        <svg viewBox="0 0 570 366" role="img" aria-label="Sector over and underweights versus the benchmark in percentage points">
          <text x="265" y="17" textAnchor="middle" fontSize="11" fill="var(--c-547796, #547796)">UNDERWEIGHT</text><text x="435" y="17" textAnchor="middle" fontSize="11" fill="var(--c-254c75, #254c75)">OVERWEIGHT</text>
          <line x1={zero} x2={zero} y1="27" y2="358" stroke="var(--c-a9bcd0, #a9bcd0)"/>
          {data.sectors.map((sector,i)=>{const value=diffs[i], width=Math.abs(value)*scale, y=32+i*29;return <g key={sector.name}>
            <text x="0" y={y+15} fontSize="13" fill="var(--c-254562, #254562)">{sector.name}</text>
            <rect x={value<0 ? zero-width : zero} y={y} width={width} height="20" rx="2" fill={value<0?'var(--ramp-2, #91b2d2)':'var(--ramp-1, #254e7a)'}/>
            <text x={value<0?zero-width-7:zero+width+7} y={y+15} textAnchor={value<0?'end':'start'} fontSize="12" fill="var(--c-254562, #254562)">{value>0?'+':''}{value.toFixed(2)}</text>
          </g>;})}
        </svg>
      </div>
      <div className="equity-table-panel"><span className="slide-kicker">SECTOR WEIGHTS</span><table className="sector-table sector-table-compact">
        <thead><tr><th>Sector</th><th>Portfolio</th><th>{data.benchmark_short || 'Benchmark'}</th></tr></thead>
        <tbody>{data.sectors.map(sector=><tr key={sector.name}><td>{sector.name}</td><td>{sector.portfolio.toFixed(2)}%</td><td>{sector.benchmark.toFixed(2)}%</td></tr>)}</tbody>
      </table></div>
    </div>
    <p className="equity-source">{data.source_note}</p>
  </div>;
}
