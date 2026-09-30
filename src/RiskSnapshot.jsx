import React, { useEffect, useRef, useState } from 'react';
import { createAutoRiskSnapshot, fetchRiskHistory } from './risk-auto';
const usd = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const pct = value => `${value>0?'+':''}${value.toFixed(2)}%`;
const ramp=['var(--ramp-1, #142f49)','var(--ramp-2, #385875)','var(--ramp-3, #7892a7)','var(--ramp-4, #b9cce4)'];

// The snapshot is derived from the confirmed holdings the same way the equity
// slide is: asset class from the benchmark constituents, and return, volatility,
// covariance and drawdown from aligned monthly price history. Nothing is uploaded.
export function RiskSnapshotStatus({holdings, positions, benchmark, asOf, client, data, onChange, onStatus}) {
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [attempt,setAttempt]=useState(0);
  // Rebuild whenever the portfolio, its classifications or the report date change.
  const key=JSON.stringify([holdings.map(h=>[h.ticker,h.value]),asOf,client,positions.map(p=>[p.ticker,p.assetClass||''])]);
  const built=useRef('');
  useEffect(() => {
    if (!holdings.length || built.current===key) return;
    built.current=key;
    let cancelled=false;
    (async () => {
      setBusy(true); setError('');
      try {
        const history=await fetchRiskHistory(holdings);
        if (cancelled) return;
        onChange(createAutoRiskSnapshot({holdings,benchmark,history,positions,asOf,client}));
      } catch(e) { if (!cancelled) { onChange(null); setError(e.message); } }
      finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled=true; };
  }, [key, benchmark, attempt]);
  function retry() { built.current=''; setError(''); onChange(null); setAttempt(n=>n+1); }
  useEffect(() => { onStatus?.({busy, error, retry}); }, [busy, error]);
  return <section className="market-editor"><div className="editor-heading"><div><h3>Risk snapshot</h3><p>Modeled from the confirmed holdings and their price history.</p></div></div>
    {busy && <p className="live-status">Building the model from {holdings.length} holdings&hellip;</p>}
    {error && <div><p className="errors" role="alert">{error}</p><button className="secondary" onClick={retry}>Try again</button></div>}
    {data && <div className="risk-model-review"><b>Ready for review &middot; In-house score {data.risk_score}/99</b>
      <p>{usd(data.total_value)} &middot; {data.holdings.length} holdings &middot; As of {data.as_of}</p>
      <p>Six-month 90% modeled range: {pct(data.range.downside_pct)} to {pct(data.range.upside_pct)}.</p>
      <p>{data.basis.periods} months of {data.basis.history_source}.{data.basis.risk_free_pct != null && ` Risk-free ${data.basis.risk_free_pct.toFixed(2)}% from the ${data.basis.risk_free_source}.`}</p>
      {data.warnings.map(warning=><p key={warning}>{warning}</p>)}</div>}
  </section>;
}
export function RiskSnapshotSlide({data:s}) {
  const allocation=[...s.allocation].sort((a,b)=>b.percent-a.percent), r=s.range;
  const costs=Object.values(s.costs), costTotal=costs.every(Number.isFinite)?costs.reduce((a,b)=>a+b,0):null;
  const measures=[['Annualized volatility',s.metrics.annual_volatility_pct],['Drawdown',s.metrics.max_drawdown_pct],['Annual range midpoint',s.metrics.annual_range_midpoint_pct],['Annual dividend',s.metrics.annual_dividend_pct],['Total annual cost',costTotal]].filter(([,value])=>value!=null);
  const min=Math.min(0,r.downside_pct),max=Math.max(0,r.upside_pct),span=max-min||1,zero=(-min/span)*100;
  return <div className="risk-snapshot-slide"><div className="report-heading"><div><span className="slide-kicker">IN-HOUSE PORTFOLIO ANALYTICS</span><h2>Risk snapshot</h2></div><span>As of {s.as_of}</span></div>
    <div className="snapshot-lede"><div><span className="slide-kicker">{s.portfolio_label}</span><strong>{usd(s.total_value)}</strong><p>{s.client_label}</p></div><div className="snapshot-outcomes"><div><strong>{pct(r.downside_pct)}</strong><span>Lower outcome</span><p>{usd(r.downside_value)}</p></div><div><strong>{pct(r.upside_pct)}</strong><span>Upper outcome</span><p>{usd(r.upside_value)}</p></div></div>
      <svg viewBox="0 0 120 120" role="img" aria-label={`In-house risk score ${s.risk_score} of 99`}><circle cx="60" cy="60" r="50" fill="none" stroke="var(--c-e7eef5, #e7eef5)" strokeWidth="7"/><circle cx="60" cy="60" r="50" fill="none" stroke="var(--ramp-1, #142f49)" strokeWidth="7" strokeDasharray={`${(s.risk_score-1)/98*314.16} 314.16`} transform="rotate(-90 60 60)"/><text x="60" y="42" textAnchor="middle" fontSize="8" fill="var(--c-385875, #385875)">RISK SCORE</text><text x="60" y="77" textAnchor="middle" fontSize="34" fill="var(--c-142f49, #142f49)">{s.risk_score}</text><text x="60" y="92" textAnchor="middle" fontSize="9" fill="var(--c-385875, #385875)">of 99</text></svg>
    </div>
    <div className="snapshot-grid"><div><h3>Six-month modeled range</h3><div className="snapshot-endpoints"><b>{usd(s.total_value+r.downside_value)}<small>5th percentile</small></b><b>{usd(s.total_value+r.upside_value)}<small>95th percentile</small></b></div><div className="snapshot-range-track"><i style={{left:`${(r.downside_pct-min)/span*100}%`,width:`${(r.upside_pct-r.downside_pct)/span*100}%`}}/><em style={{left:`${zero}%`}}/></div><p className="snapshot-explain">90% central coverage under the model. Outcomes may fall outside this range; it is not a guarantee or maximum loss.</p><h3>Allocation</h3><div className="snapshot-allocation">{allocation.map((a,i)=><i key={a.name} style={{width:`${a.percent}%`,background:ramp[i]}}/>)}</div><div className="snapshot-legend">{allocation.map((a,i)=><span key={a.name}><i style={{background:ramp[i]}}/>{a.name} <b>{a.percent.toFixed(1)}%</b></span>)}</div></div>
      <div><h3>Portfolio measures</h3><dl className="snapshot-measures">{measures.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value.toFixed(2)}%</dd></div>)}{s.metrics.grade!=null && <div><dt>Risk-adjusted grade</dt><dd>{s.metrics.grade.toFixed(1)} / 4.3</dd></div>}</dl><p className="snapshot-costs">{[['Tax drag',s.costs.est_tax_drag_pct],['Expense ratio',s.costs.expense_ratio_pct],['Advisory fee',s.costs.advisory_fees_pct]].filter(([,v])=>v!=null).map(([k,v])=>`${k} ${v.toFixed(2)}%`).join(' · ')}</p></div></div>
    <p className="context-source">{s.basis.method} Six-month modeled 90% range; not a guarantee or maximum loss. {s.basis.covariance}. {s.basis.drawdown_basis} {s.basis.risk_free_pct!=null?`Risk-free rate ${s.basis.risk_free_pct.toFixed(2)}%.`:''} {s.warnings.join(' ')}</p>
  </div>;
}
