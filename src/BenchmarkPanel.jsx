import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, ChevronDown, ExternalLink, ChartNoAxesColumnIncreasing } from 'lucide-react';
import { isBenchmarkStale } from './benchmark.js';
export function useBenchmark() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const active = useRef(false);
  async function refresh() {
    if (active.current) return;
    active.current = true; setLoading(true); setError('');
    try {
      const response = await fetch('/api/benchmark/sp500', {signal: AbortSignal.timeout(25000)});
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      if (!result.asOf || result.sectors?.length !== 11 || !result.constituents?.length) throw Error('Incomplete benchmark response.');
      setSnapshot(result);
    } catch { setError('Benchmark unavailable. Please retry.'); }
    finally { active.current = false; setLoading(false); }
  }
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return {snapshot, loading, error, refresh};
}
export default function BenchmarkPanel({benchmark}) {
  const [expanded, setExpanded] = useState(false);
  const {snapshot, loading, error, refresh} = benchmark;
  const stale = snapshot && isBenchmarkStale(snapshot);
  const date = snapshot && new Date(`${snapshot.asOf}T12:00:00Z`).toLocaleDateString('en-US', {month:'short', day:'numeric',year:'numeric',timeZone:'UTC'});
  return <section className="benchmark-panel" aria-label="S&P 500 benchmark">
    <div className="benchmark-top">
      <div className="benchmark-identity"><span className="benchmark-icon"><ChartNoAxesColumnIncreasing size={19}/></span><div><h2>S&P 500 <span>Benchmark</span></h2><p aria-live="polite">{loading && !snapshot ? 'Fetching daily exposure…' : snapshot ? `Holdings as of ${date} · IVV proxy` : error}</p></div></div>
      <div className="benchmark-actions">
        {snapshot && <span className={`data-badge ${stale || error ? 'warning' : ''}`}><i/>{stale ? 'Older snapshot' : error ? 'Refresh failed' : 'Daily data'}</span>}
        <button className="icon-button" aria-label="Refresh benchmark" disabled={loading} onClick={refresh}><RefreshCw size={16} className={loading ? 'spin' : ''}/></button>
        {snapshot && <button className="text-button benchmark-expand" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>Sectors <ChevronDown size={15} style={{transform: expanded ? 'rotate(180deg)' : undefined}}/></button>}
      </div>
    </div>
    {error && snapshot && <p role="status" className="benchmark-warning">{error} Showing the previously loaded snapshot.</p>}
    {expanded && snapshot && <div className="benchmark-details">
      <div className="benchmark-sector-grid">{[...snapshot.sectors].sort((a,b)=>b.weight-a.weight).map(s=><div key={s.name} className="benchmark-sector"><div><span>{s.name}</span><b>{s.weight.toFixed(2)}%</b></div><div className="sector-track"><span style={{width:`${s.weight}%`}}/></div></div>)}</div>
      <div className="benchmark-method"><p>{snapshot.constituents.length} equity holdings. {snapshot.basis} Checked {new Date(snapshot.retrievedAt).toLocaleString()}. Refreshes hourly while open. Published daily, not intraday.</p><a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">iShares source <ExternalLink size={13}/></a></div>
    </div>}
  </section>;
}
