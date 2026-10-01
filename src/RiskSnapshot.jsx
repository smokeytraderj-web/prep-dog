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
// The two themes are different presentations, not one layout in two palettes.
// Light is a stacked document: hero row, range band, two-column split. Navy is
// a console: a fixed left rail carrying the score and the value, with the range
// and the measures laid out as tiles in the field beside it. They share the
// model and the wording, not the composition.
export function RiskSnapshotSlide({data, theme}) {
  return theme === 'dark' ? <RiskConsole s={data}/> : <RiskDocument s={data}/>;
}

function useRiskParts(s) {
  const allocation = [...s.allocation].sort((a, b) => b.percent - a.percent);
  const r = s.range;
  const costs = Object.values(s.costs);
  const costTotal = costs.every(Number.isFinite) ? costs.reduce((a, b) => a + b, 0) : null;
  const measures = [
    ['Annualized volatility', s.metrics.annual_volatility_pct],
    ['Drawdown', s.metrics.max_drawdown_pct],
    ['Annual range midpoint', s.metrics.annual_range_midpoint_pct],
    ['Annual dividend', s.metrics.annual_dividend_pct],
    ['Total annual cost', costTotal],
  ].filter(([, v]) => v != null);
  if (s.metrics.grade != null) measures.push(['Risk-adjusted grade', s.metrics.grade, '/ 4.3']);
  const min = Math.min(0, r.downside_pct), max = Math.max(0, r.upside_pct);
  const span = max - min || 1, zero = (-min / span) * 100;
  const basis = `${s.basis.method} Six-month modeled 90% range. ${s.basis.covariance}. ${s.basis.drawdown_basis} ${s.basis.risk_free_pct != null ? `Risk-free rate ${s.basis.risk_free_pct.toFixed(2)}%.` : ''} ${s.warnings.join(' ')}`;
  return {allocation, r, measures, span, zero, basis};
}

function ScoreRing({score, size}) {
  return <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`In-house risk score ${score} of 99`}>
    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--c-e7eef5, #e7eef5)" strokeWidth="7"/>
    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--ramp-1, #142f49)" strokeWidth="7"
      strokeDasharray={`${(score - 1) / 98 * 314.16} 314.16`} strokeLinecap="round" transform="rotate(-90 60 60)"/>
    <text x="60" y="71" textAnchor="middle" fontSize="34" fill="var(--c-142f49, #142f49)">{score}</text>
  </svg>;
}

// --- navy: a console, not a document ---------------------------------------
function RiskConsole({s}) {
  const {allocation, r, measures, span, zero, basis} = useRiskParts(s);
  return <div className="risk-console">
    <div className="report-heading"><div><span className="slide-kicker">IN-HOUSE PORTFOLIO ANALYTICS</span><h2>Risk snapshot</h2></div><span>As of {s.as_of}</span></div>
    <div className="risk-console-grid">

      <aside className="rc-rail">
        <div className="rc-score"><ScoreRing score={s.risk_score} size={116}/></div>
        <span className="slide-kicker">Risk score</span>
        <p className="rc-scale">{s.risk_score} <em>of 99</em></p>
        <div className="rc-rule"/>
        <span className="slide-kicker">{s.portfolio_label}</span>
        <strong className="rc-value">{usd(s.total_value)}</strong>
        {s.client_label && <p className="rc-client">{s.client_label}</p>}
        <div className="rc-rule"/>
        <span className="slide-kicker">Allocation</span>
        <ul className="rc-alloc">{allocation.map((a, i) => <li key={a.name}>
          <i style={{background: ramp[i]}}/><span>{a.name}</span><b>{a.percent.toFixed(1)}%</b>
        </li>)}</ul>
      </aside>

      <div className="rc-field">
        <section className="rc-range">
          <span className="slide-kicker">Six-month modeled range</span>
          <div className="rc-range-row">
            <div className="rc-stop"><em>Downside</em><b>{usd(s.total_value + r.downside_value)}</b><i>{pct(r.downside_pct)}</i></div>
            <div className="rc-stop is-mid"><em>Today</em><b>{usd(s.total_value)}</b><i>Starting value</i></div>
            <div className="rc-stop is-end"><em>Upside</em><b>{usd(s.total_value + r.upside_value)}</b><i>{pct(r.upside_pct)}</i></div>
          </div>
          <div className="rc-rail-bar">
            <div className="rc-fill is-down" style={{width: `${(0 - r.downside_pct) / span * 100}%`}}/>
            <div className="rc-fill is-up" style={{left: `${zero}%`, width: `${r.upside_pct / span * 100}%`}}/>
            <div className="rc-now" style={{left: `${zero}%`}}/>
          </div>
          <p className="rc-note">90% central coverage · outcomes may fall outside this range · not a guarantee or maximum loss</p>
        </section>

        <section className="rc-tiles">
          <span className="slide-kicker">Portfolio measures</span>
          <div className="rc-tile-grid">{measures.map(([label, value, suffix]) => <div className="rc-tile" key={label}>
            <b>{value.toFixed(suffix ? 1 : 2)}{suffix ? '' : '%'}{suffix && <em>{suffix}</em>}</b>
            <span>{label}</span>
          </div>)}</div>
        </section>
      </div>
    </div>
    <p className="context-source">{basis}</p>
  </div>;
}

// --- light: the stacked document -------------------------------------------
function RiskDocument({s}) {
  const allocation=[...s.allocation].sort((a,b)=>b.percent-a.percent), r=s.range;
  const costs=Object.values(s.costs), costTotal=costs.every(Number.isFinite)?costs.reduce((a,b)=>a+b,0):null;
  const measures=[['Annualized volatility',s.metrics.annual_volatility_pct],['Drawdown',s.metrics.max_drawdown_pct],['Annual range midpoint',s.metrics.annual_range_midpoint_pct],['Annual dividend',s.metrics.annual_dividend_pct],['Total annual cost',costTotal]].filter(([,value])=>value!=null);
  const min=Math.min(0,r.downside_pct),max=Math.max(0,r.upside_pct),span=max-min||1,zero=(-min/span)*100;
  const costLine=[['Tax drag',s.costs.est_tax_drag_pct],['Expense ratio',s.costs.expense_ratio_pct],['Advisory fee',s.costs.advisory_fees_pct]].filter(([,v])=>v!=null).map(([k,v])=>`${k} ${v.toFixed(2)}%`).join(' · ');
  // Three stacked zones -- what it is worth, how far it could move, what it is
  // made of -- instead of one dense band the eye has to unpick.
  return <div className="risk-snapshot-slide">
    <div className="report-heading"><div><span className="slide-kicker">IN-HOUSE PORTFOLIO ANALYTICS</span><h2>Risk snapshot</h2></div><span>As of {s.as_of}</span></div>

    <section className="snapshot-hero">
      <div className="hero-value">
        <span className="slide-kicker">{s.portfolio_label}</span>
        <strong>{usd(s.total_value)}</strong>
        {s.client_label && <p>{s.client_label}</p>}
      </div>
      <div className="hero-score">
        <svg viewBox="0 0 120 120" role="img" aria-label={`In-house risk score ${s.risk_score} of 99`}>
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--c-e7eef5, #e7eef5)" strokeWidth="7"/>
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--ramp-1, #142f49)" strokeWidth="7" strokeDasharray={`${(s.risk_score-1)/98*314.16} 314.16`} transform="rotate(-90 60 60)"/>
          <text x="60" y="70" textAnchor="middle" fontSize="36" fill="var(--c-142f49, #142f49)">{s.risk_score}</text>
        </svg>
        <div><span className="slide-kicker">Risk score</span><p>{s.risk_score} of 99</p></div>
      </div>
    </section>

    <section className="snapshot-band">
      <h3>Six-month modeled range</h3>
      <div className="range-anchors">
        <div className="range-anchor is-down"><span>Downside</span><b>{usd(s.total_value+r.downside_value)}</b><small>{pct(r.downside_pct)}</small></div>
        <div className="range-anchor is-today"><span>Today</span><b>{usd(s.total_value)}</b><small>Starting value</small></div>
        <div className="range-anchor is-up"><span>Upside</span><b>{usd(s.total_value+r.upside_value)}</b><small>{pct(r.upside_pct)}</small></div>
      </div>
      <div className="range-scale">
        <div className="range-band is-down" style={{width:`${(0-r.downside_pct)/span*100}%`}}/>
        <div className="range-today" style={{left:`${zero}%`}}/>
        <div className="range-band is-up" style={{left:`${zero}%`,width:`${r.upside_pct/span*100}%`}}/>
      </div>
      <div className="range-ticks"><span>5th percentile</span><span>90% central coverage · not a guarantee or maximum loss</span><span>95th percentile</span></div>
    </section>

    <div className="snapshot-split">
      <section>
        <h3>Allocation</h3>
        <div className="snapshot-allocation">{allocation.map((a,i)=><i key={a.name} style={{width:`${a.percent}%`,background:ramp[i]}}/>)}</div>
        <div className="snapshot-legend">{allocation.map((a,i)=><span key={a.name}><i style={{background:ramp[i]}}/>{a.name} <b>{a.percent.toFixed(1)}%</b></span>)}</div>
      </section>
      <section>
        <h3>Portfolio measures</h3>
        <dl className="snapshot-measures">
          {measures.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value.toFixed(2)}%</dd></div>)}
          {s.metrics.grade!=null && <div><dt>Risk-adjusted grade</dt><dd>{s.metrics.grade.toFixed(1)} / 4.3</dd></div>}
          {costLine && <div><dt>Costs</dt><dd>{costLine}</dd></div>}
        </dl>
      </section>
    </div>

    <p className="context-source">{s.basis.method} Six-month modeled 90% range. {s.basis.covariance}. {s.basis.drawdown_basis} {s.basis.risk_free_pct!=null?`Risk-free rate ${s.basis.risk_free_pct.toFixed(2)}%.`:''} {s.warnings.join(' ')}</p>
  </div>;
}
