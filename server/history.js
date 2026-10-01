import { mapPool } from '../src/pool.js';
import { HISTORY_INTERVAL, HISTORY_RANGE, MAX_SYMBOLS, alignHistories, historySymbol, parseYahooHistory, validSymbol } from '../src/price-history.js';

// 13-week Treasury bill yield: the risk-free rate the model needs for a grade.
const RISK_FREE_SYMBOL = '^IRX';

const YAHOO_CHARTS = ['https://query1.finance.yahoo.com/v8/finance/chart/', 'https://query2.finance.yahoo.com/v8/finance/chart/'];
const cache = new Map();
const TTL = 6 * 60 * 60 * 1000;

export async function fetchHistory(symbol, fetcher = fetch) {
  let lastError;
  for (const origin of YAHOO_CHARTS) {
    try {
      const url = `${origin}${encodeURIComponent(symbol)}?range=${HISTORY_RANGE}&interval=${HISTORY_INTERVAL}&includeAdjustedClose=true&events=div`;
      const response = await fetcher(url, {signal: AbortSignal.timeout(9000), headers: {Accept: 'application/json', 'User-Agent': 'Prep-Dog/2.0'}});
      if (!response.ok) throw Error(`${symbol}: Yahoo returned HTTP ${response.status}.`);
      return parseYahooHistory(await response.json(), symbol);
    } catch (error) { lastError = error; }
  }
  throw lastError;
}

// A missing risk-free rate only costs the grade, so a failure here is reported
// as an absent measure rather than failing the whole snapshot.
export async function fetchRiskFreePct(fetcher = fetch) {
  for (const origin of YAHOO_CHARTS) {
    try {
      const url = `${origin}${encodeURIComponent(RISK_FREE_SYMBOL)}?range=5d&interval=1d`;
      const response = await fetcher(url, {signal: AbortSignal.timeout(9000), headers: {Accept: 'application/json', 'User-Agent': 'Prep-Dog/2.0'}});
      if (!response.ok) continue;
      const payload = await response.json();
      const closes = (payload?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [])
        .filter(value => typeof value === 'number' && Number.isFinite(value) && value >= 0);
      if (closes.length) return closes.at(-1);
    } catch { /* fall through to the next origin */ }
  }
  return null;
}

export async function historyResponse(request, fetcher = fetch, clock = () => new Date()) {
  if (request.method !== 'GET') return Response.json({error: 'Use GET.'}, {status: 405, headers: {Allow: 'GET'}});
  const requested = (new URL(request.url).searchParams.get('symbols') || '').split(',').map(s => s.trim()).filter(Boolean);
  const symbols = [...new Set(requested.map(historySymbol))];
  if (!symbols.length) return Response.json({error: 'Supply at least one ticker.'}, {status: 400});
  if (symbols.length > MAX_SYMBOLS) return Response.json({error: `Supply at most ${MAX_SYMBOLS} tickers.`}, {status: 400});
  const invalid = symbols.filter(symbol => !validSymbol(symbol));
  if (invalid.length) return Response.json({error: `Unsupported ticker: ${invalid.join(', ')}.`}, {status: 400});

  const asOf = clock().toISOString().slice(0, 10);
  try {
    const histories = await mapPool(symbols, async symbol => {
      const hit = cache.get(symbol);
      if (hit && Date.now() - hit.time < TTL) return hit.history;
      const history = await fetchHistory(symbol, fetcher);
      cache.set(symbol, {history, time: Date.now()});
      return history;
    });
    const aligned = alignHistories(histories, asOf);
    if (!aligned) return Response.json({error: 'These holdings do not share enough overlapping monthly history to model together.'}, {status: 422, headers: {'Cache-Control': 'no-store'}});
    const riskFree = await fetchRiskFreePct(fetcher);
    return Response.json({as_of: asOf, source: 'Yahoo Finance monthly adjusted closes', risk_free_pct: riskFree, risk_free_source: riskFree == null ? null : '13-week Treasury bill (^IRX)', ...aligned},
      {headers: {'Cache-Control': 'public, max-age=300, s-maxage=3600', 'X-Content-Type-Options': 'nosniff'}});
  } catch (error) {
    const message = `Price history is unavailable. ${error.name === 'TimeoutError' ? 'The market provider timed out.' : error.message}`;
    console.warn('history_fetch_failed', message);
    return Response.json({error: message}, {status: 502, headers: {'Cache-Control': 'no-store'}});
  }
}
