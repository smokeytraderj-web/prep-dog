import { MARKET_INDEXES, marketSnapshotFromYahoo } from '../src/market-indexes.js';

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/';
let cached;

const unix = date => Math.floor(date.getTime() / 1000);

export async function marketResponse(request, fetcher = fetch, clock = () => new Date()) {
  if (request.method !== 'GET') return Response.json({error:'Use GET.'}, {status:405, headers:{Allow:'GET'}});
  try {
    if (!cached || Date.now() - cached.time > 60 * 60 * 1000) {
      const now = clock();
      const start = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 20));
      const period1 = unix(start);
      const period2 = unix(new Date(now.getTime() + 24 * 60 * 60 * 1000));
      const entries = await Promise.all(MARKET_INDEXES.map(async definition => {
        const url = `${YAHOO_CHART}${encodeURIComponent(definition.symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
        const response = await fetcher(url, {headers:{Accept:'application/json','User-Agent':'Prep-Dog/2.0'}});
        if (!response.ok) throw Error(`Yahoo Finance unavailable for ${definition.symbol}.`);
        return [definition.id, await response.json()];
      }));
      cached = {data:marketSnapshotFromYahoo(Object.fromEntries(entries), now), time:Date.now()};
    }
    return Response.json(cached.data, {headers:{'Cache-Control':'public, max-age=300, s-maxage=3600','X-Content-Type-Options':'nosniff'}});
  } catch {
    return Response.json({error:'YTD market data is temporarily unavailable. Retry or upload a verified market snapshot.'}, {status:502, headers:{'Cache-Control':'no-store'}});
  }
}
