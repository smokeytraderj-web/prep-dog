import React from 'react';
// Light values are the fallbacks, so an unthemed deck is unchanged; the dark
// theme defines --series-* and the chart follows it.
export const indexColors = [
  'var(--series-1, #1b3a5c)', 'var(--series-2, #b8762f)',
  'var(--series-3, #2f8777)', 'var(--series-4, #8a5fa8)',
];
// The slide gives this panel a fixed share of a 16:9 page, so the chart is drawn
// wide and shallow: at full column width its natural height lands inside that
// share instead of pushing the readout and footer off the bottom.
const VIEW_W = 590, VIEW_H = 196;
const PLOT_TOP = 12, PLOT_BOTTOM = 166, PLOT_H = PLOT_BOTTOM - PLOT_TOP;
const AXIS_Y = 187, PLOT_LEFT = 54, PLOT_RIGHT = 564, PLOT_W = PLOT_RIGHT - PLOT_LEFT;
export default function MarketChart({indexes}) {
  const series = indexes.map(index => ({...index, points:(index.points || []).filter(point => Number.isFinite(point.return) && Number.isFinite(Date.parse(point.date)))}));
  const hasHistory = series.every(index => index.points.length > 1 && Math.abs(index.points.at(-1).return - Number(index.return)) < .01);
  const values = hasHistory ? series.flatMap(index => index.points.map(point => point.return)) : indexes.map(index => Number(index.return));
  const low = Math.min(0, ...values), high = Math.max(0, ...values), padding = (high - low || 2) * .12;
  const min = low-padding, max=high+padding, y=value => PLOT_BOTTOM-(value-min)/(max-min)*PLOT_H;
  const times = hasHistory ? series.flatMap(index => index.points.map(point => Date.parse(point.date))) : [];
  const start = hasHistory ? Math.min(...times) : 0, end = hasHistory ? Math.max(...times) : 1;
  const x = date => PLOT_LEFT+(Date.parse(date)-start)/(end-start || 1)*PLOT_W;
  const dateLabel = time => new Date(time).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
  return <div className="index-chart-panel"><h3>{hasHistory ? 'YTD return over time' : 'YTD return comparison'}</h3>
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={hasHistory ? 'Daily cumulative YTD returns for the four benchmarks' : 'Bar chart comparing the four supplied YTD returns'}>
      {Array.from({length:5},(_,i)=>min+(max-min)*i/4).map(value=><g key={value}><line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y(value)} y2={y(value)} stroke="var(--c-dce5ef, #dce5ef)"/><text x="44" y={y(value)+4} textAnchor="end" fill="var(--c-526c86, #526c86)" fontSize="12">{value.toFixed(0)}%</text></g>)}
      <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y(0)} y2={y(0)} stroke="var(--c-9baec2, #9baec2)" strokeDasharray="4 4"/>
      {hasHistory ? series.map((index,i)=><polyline key={index.id} points={index.points.map(point=>`${x(point.date)},${y(point.return)}`).join(' ')} stroke={indexColors[i]} strokeWidth="2.8" fill="none" strokeLinejoin="round"/>) : indexes.map((index,i)=><g key={index.id}><rect x={PLOT_LEFT+31+i*125} y={Math.min(y(0),y(Number(index.return)))} width="62" height={Math.abs(y(Number(index.return))-y(0))} rx="3" fill={indexColors[i]}/><text x={PLOT_LEFT+62+i*125} y={AXIS_Y} textAnchor="middle" fontSize="12" fill="var(--c-365873, #365873)">{index.symbol || ['S&P 500','Nasdaq','EM','EAFE'][i]}</text></g>)}
      {hasHistory && [0,.5,1].map(fraction=><text key={fraction} x={PLOT_LEFT+PLOT_W*fraction} y={AXIS_Y} textAnchor={fraction===0?'start':fraction===1?'end':'middle'} fill="var(--c-526c86, #526c86)" fontSize="12">{dateLabel(start+(end-start)*fraction)}</text>)}
    </svg>
    <div className="index-legend">{indexes.map((index,i)=><span key={index.id}><i style={{background:indexColors[i]}}/>{index.label}{index.proxy?' (ETF proxy)':''}</span>)}</div>
  </div>;
}
