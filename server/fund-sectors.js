import { mapPool } from '../src/pool.js';
import { EQUITY_ASSET_CLASSES, ISHARES_SCREENER, holdingsUrl, parseFundSectors, parseScreener } from '../src/fund-lookthrough.js';
import { normalizeTicker } from '../src/benchmark.js';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  Accept: 'text/csv,application/json,*/*',
};
const DAY = 24 * 60 * 60 * 1000;
const MAX_SYMBOLS = 40;
// Caches hold the in-flight promise, not just the settled value. A deck asks
// for every ticker at once, so caching only the result let fifteen requests
// each start their own copy of the same fetch -- the provider rate-limited the
// duplicates and those symbols came back unresolved.
let screener;                 // {promise, time}
const funds = new Map();      // symbol -> {promise, time}

function fundIndex(fetcher) {
  if (screener && Date.now() - screener.time < DAY) return screener.promise;
  const promise = (async () => {
    const response = await fetcher(ISHARES_SCREENER, {headers: HEADERS, signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw Error(`The provider's fund list returned HTTP ${response.status}.`);
    return parseScreener(await response.json());
  })();
  screener = {promise, time: Date.now()};
  // A failed lookup must not be cached as if it had succeeded.
  promise.catch(() => { if (screener?.promise === promise) screener = undefined; });
  return promise;
}

export function fetchFundSectors(symbol, fetcher = fetch) {
  const hit = funds.get(symbol);
  if (hit && Date.now() - hit.time < 6 * 60 * 60 * 1000) return hit.promise;
  const promise = resolveFund(symbol, fetcher);
  funds.set(symbol, {promise, time: Date.now()});
  promise.catch(() => { if (funds.get(symbol)?.promise === promise) funds.delete(symbol); });
  return promise;
}

async function resolveFund(symbol, fetcher) {
  const index = await fundIndex(fetcher);
  const product = index[symbol];
  const remember = result => result;
  // Not an iShares product: reported as unavailable rather than the app
  // inventing a look-through for it.
  if (!product) return remember({symbol, available: false, reason: 'not-listed'});
  // The provider's own classification settles the funds that cannot have an
  // equity sector breakdown, without fetching anything.
  if (!EQUITY_ASSET_CLASSES.has(product.assetClass))
    return remember({symbol, available: true, sectors: null, assetClass: product.assetClass, asOf: null});
  const response = await fetcher(holdingsUrl(product.path), {headers: HEADERS, signal: AbortSignal.timeout(20000)});
  if (!response.ok) throw Error(`${symbol}: the provider returned HTTP ${response.status}.`);
  return remember({...parseFundSectors(await response.text(), symbol), available: true, assetClass: product.assetClass});
}

export async function fundSectorsResponse(request, fetcher = fetch) {
  if (request.method !== 'GET') return Response.json({error: 'Use GET.'}, {status: 405, headers: {Allow: 'GET'}});
  const requested = (new URL(request.url).searchParams.get('symbols') || '').split(',').map(s => s.trim()).filter(Boolean);
  const symbols = [...new Set(requested.map(normalizeTicker))].filter(s => /^[A-Z][A-Z0-9-]{0,14}$/.test(s));
  if (!symbols.length) return Response.json({error: 'Supply at least one ticker.'}, {status: 400});
  if (symbols.length > MAX_SYMBOLS) return Response.json({error: `Supply at most ${MAX_SYMBOLS} tickers.`}, {status: 400});
  try {
    const results = await mapPool(symbols, async symbol => {
      // One fund failing must not lose the look-through for the others.
      try { return await fetchFundSectors(symbol, fetcher); }
      catch (error) { console.warn('fund_sectors_failed', symbol, error.message); return {symbol, available: false, reason: 'error', detail: error.message}; }
    });
    // A transient failure must not be cached like a settled answer, or a brief
    // provider hiccup keeps a fund looking unknown long after it recovered.
    const transient = results.some(r => r.reason === 'error');
    return Response.json({
      source: 'iShares daily fund holdings',
      funds: Object.fromEntries(results.map(r => [r.symbol, r])),
      ...(transient ? {warning: 'Some funds could not be reached and are shown as unavailable.'} : {}),
    }, {headers: {
      'Cache-Control': transient ? 'no-store' : 'public, max-age=900, s-maxage=21600',
      'X-Content-Type-Options': 'nosniff',
    }});
  } catch (error) {
    const message = `Fund sector look-through is unavailable. ${error.name === 'TimeoutError' ? 'The provider timed out.' : error.message}`;
    console.warn('fund_sectors_unavailable', message);
    return Response.json({error: message}, {status: 502, headers: {'Cache-Control': 'no-store'}});
  }
}
