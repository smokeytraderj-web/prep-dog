import { BOARDS, boardFor, marketSnapshotFromYahoo, parseYahooChart } from '../src/market-indexes.js';

const YAHOO_CHARTS = ['https://query1.finance.yahoo.com/v8/finance/chart/', 'https://query2.finance.yahoo.com/v8/finance/chart/'];
// One cache entry per board, so a sector refresh cannot evict the equity one.
const cached = new Map();
// A per-position request is one chart call per symbol, so this bounds the fan-out.
const MAX_SYMBOLS = 60;

const unix = date => Math.floor(date.getTime() / 1000);
export async function fetchIndexChart(definition, period1, period2, year, fetcher=fetch) {
  let lastError;
  for (const origin of YAHOO_CHARTS) {
    try {
      const url = `${origin}${encodeURIComponent(definition.symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
      const response=await fetcher(url,{signal:AbortSignal.timeout(9000),headers:{Accept:'application/json','User-Agent':'Prep-Dog/2.0'}});
      if (!response.ok) throw Error(`${definition.label}: Yahoo returned HTTP ${response.status}.`);
      const payload=await response.json();
      parseYahooChart(payload,definition,year);
      return payload;
    } catch(error) {lastError=error;}
  }
  throw lastError;
}

export async function marketResponse(request, fetcher = fetch, clock = () => new Date()) {
  if (request.method !== 'GET') return Response.json({error:'Use GET.'}, {status:405, headers:{Allow:'GET'}});
  // An unknown board falls back to the equity one rather than erroring, so an
  // older client asking without a board keeps working.
  const params = new URL(request.url).searchParams;
  // An explicit symbol list builds an ad-hoc board: the attribution slide needs
  // a YTD return for each position the client actually holds, which no fixed
  // board can know in advance.
  const symbols = (params.get('symbols') || '')
    .split(',')
    .map(symbol => symbol.trim().toUpperCase())
    .filter(symbol => /^[A-Z][A-Z0-9.^-]{0,14}$/.test(symbol));
  const unique = [...new Set(symbols)].slice(0, MAX_SYMBOLS);
  const requested = params.get('board') || 'indexes';
  const key = unique.length ? `symbols:${unique.join(',')}` : BOARDS[requested] ? requested : 'indexes';
  const board = unique.length
    ? {definitions: unique.map(symbol => ({id: symbol, symbol, label: symbol, region: '', proxy: false})),
       source: 'Yahoo Finance historical chart data, by position.',
       basis: 'YTD from prior year-end adjusted close, so distributions are included'}
    : boardFor(key);
  const hit = cached.get(key);
  try {
    if (!hit || Date.now() - hit.time > 60 * 60 * 1000) {
      const now = clock();
      const start = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 20));
      const period1 = unix(start);
      const period2 = unix(new Date(now.getTime() + 24 * 60 * 60 * 1000));
      const entries = await Promise.all(board.definitions.map(async definition => {
        return [definition.id, await fetchIndexChart(definition,period1,period2,now.getUTCFullYear(),fetcher)];
      }));
      cached.set(key, {data:marketSnapshotFromYahoo(Object.fromEntries(entries), now, key, board), time:Date.now()});
    }
    return Response.json(cached.get(key).data, {headers:{'Cache-Control':'public, max-age=300, s-maxage=3600','X-Content-Type-Options':'nosniff'}});
  } catch(error) {
    const message=`YTD refresh failed. ${error.name==='TimeoutError'?'The market provider timed out.':error.message}`;
    console.warn('market_refresh_failed',message);
    const stale = cached.get(key);
    if (stale && stale.data.asOf.startsWith(String(clock().getUTCFullYear()))) return Response.json({...stale.data,warning:message},{headers:{'Cache-Control':'no-store'}});
    return Response.json({error:message}, {status:502, headers:{'Cache-Control':'no-store'}});
  }
}
