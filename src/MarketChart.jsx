import React from 'react';
export const indexColors = ['#183452', '#3976b6', '#648c9e', '#8cabe0'];
export default function MarketChart({indexes}) {
  const series = indexes.map(index => ({...index, points:(index.points || []).filter(point => Number.isFinite(point.return) && Number.isFinite(Date.parse(point.date)))}));
  const hasHistory = series.every(index => index.points.length > 1 && Math.abs(index.points.at(-1).return - Number(index.return)) < .01);
  const values = hasHistory ? series.flatMap(index => index.points.map(point => point.return)) : indexes.map(index => Number(index.return));
  const low = Math.min(0, ...values), high = Math.max(0, ...values), padding = (high - low || 2) * .12;
  const min = low-padding, max=high+padding, y=value => 254-(value-min)/(max-min)*230;
  const times = hasHistory ? series.flatMap(index => index.points.map(point => Date.parse(point.date))) : [];
  const start = hasHistory ? Math.min(...times) : 0, end = hasHistory ? Math.max(...times) : 1;
  const x = date => 54+(Date.parse(date)-start)/(end-start || 1)*500;
  const dateLabel = time => new Date(time).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
  return <div className="index-chart-panel"><h3>{hasHistory ? 'YTD return over time' : 'YTD return comparison'}</h3>
    <svg viewBox="0 0 590 292" role="img" aria-label={hasHistory ? 'Daily cumulative YTD returns for the four benchmarks' : 'Bar chart comparing the four supplied YTD returns'}>
      {Array.from({length:5},(_,i)=>min+(max-min)*i/4).map(value=><g key={value}><line x1="54" x2="564" y1={y(value)} y2={y(value)} stroke="#dce5ef"/><text x="44" y={y(value)+4} textAnchor="end" fill="#526c86" fontSize="12">{value.toFixed(0)}%</text></g>)}
      <line x1="54" x2="564" y1={y(0)} y2={y(0)} stroke="#9baec2" strokeDasharray="4 4"/>
      {hasHistory ? series.map((index,i)=><polyline key={index.id} points={index.points.map(point=>`${x(point.date)},${y(point.return)}`).join(' ')} stroke={indexColors[i]} strokeWidth="2.8" fill="none" strokeLinejoin="round"/>) : indexes.map((index,i)=><g key={index.id}><rect x={85+i*125} y={Math.min(y(0),y(Number(index.return)))} width="62" height={Math.abs(y(Number(index.return))-y(0))} rx="3" fill={indexColors[i]}/><text x={116+i*125} y="278" textAnchor="middle" fontSize="12" fill="#365873">{index.symbol || ['S&P 500','Nasdaq','EM','EAFE'][i]}</text></g>)}
      {hasHistory && [0,.5,1].map(fraction=><text key={fraction} x={54+500*fraction} y="278" textAnchor={fraction===0?'start':fraction===1?'end':'middle'} fill="#526c86" fontSize="12">{dateLabel(start+(end-start)*fraction)}</text>)}
    </svg>
    <div className="index-legend">{indexes.map((index,i)=><span key={index.id}><i style={{background:indexColors[i]}}/>{index.label}{index.proxy?' (ETF proxy)':''}</span>)}</div>
  </div>;
}
