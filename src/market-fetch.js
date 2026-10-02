import { SNAPSHOT_PATH, boardFromSnapshot, requestedBoard } from './market-snapshot.js';

export async function fetchMarketJson(path, fetcher = fetch) {
  let lastError;
  for (let attempt=0;attempt<2;attempt++) {
    try {
      const response = await fetcher(path,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(25000)});
      if (response.status===401 || response.status===403) throw Error('Your site session needs refreshing. Reload Prep Dog and sign in again if asked.');
      const body=await response.text();
      if (/^\s*</.test(body)) throw Error('The data request returned a sign-in page instead of market data. Reload Prep Dog to restore your session.');
      let data;
      try { data=JSON.parse(body); } catch { throw Error('The market service returned an unreadable response. Please retry.'); }
      if (!response.ok) throw Error(data.error || `Market service returned HTTP ${response.status}.`);
      return data;
    } catch(error) {
      lastError = error.name==='TimeoutError' || error.name==='AbortError' ? Error('The market-data request timed out. Please retry.') : error;
      if (/session|sign-in/.test(lastError.message)) break;
    }
  }
  // Yahoo refuses most datacentre addresses, so a deployed deck would lose
  // every market slide to a failure the advisor cannot do anything about. The
  // saved snapshot stands in, dated and flagged, rather than nothing at all.
  // A broken session is not that failure: it is fixed by signing in, and
  // standing in for it would hide the one thing the advisor has to act on.
  if (!/session|sign-in/.test(lastError?.message || '')) {
    const saved = await snapshotBoard(path, fetcher);
    if (saved) return saved;
  }
  throw lastError;
}

async function snapshotBoard(path, fetcher) {
  try {
    const response = await fetcher(SNAPSHOT_PATH, {cache: 'no-store', signal: AbortSignal.timeout(8000)});
    if (!response.ok) return null;
    const {board, symbols} = requestedBoard(path);
    return boardFromSnapshot(await response.json(), board, symbols);
  } catch { return null; }
}
