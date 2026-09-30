import { MARKET_INDEXES, marketSnapshotFromYahoo, parseYahooChart } from '../src/market-indexes.js';

const YAHOO_CHARTS = ['https://query1.finance.yahoo.com/v8/finance/chart/', 'https://query2.finance.yahoo.com/v8/finance/chart/'];
let cached;

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
  try {
    if (!cached || Date.now() - cached.time > 60 * 60 * 1000) {
      const now = clock();
      const start = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 20));
      const period1 = unix(start);
      const period2 = unix(new Date(now.getTime() + 24 * 60 * 60 * 1000));
      const entries = await Promise.all(MARKET_INDEXES.map(async definition => {
        return [definition.id, await fetchIndexChart(definition,period1,period2,now.getUTCFullYear(),fetcher)];
      }));
      cached = {data:marketSnapshotFromYahoo(Object.fromEntries(entries), now), time:Date.now()};
    }
    return Response.json(cached.data, {headers:{'Cache-Control':'public, max-age=300, s-maxage=3600','X-Content-Type-Options':'nosniff'}});
  } catch(error) {
    const message=`YTD refresh failed. ${error.name==='TimeoutError'?'The market provider timed out.':error.message}`;
    console.warn('market_refresh_failed',message);
    if (cached && cached.data.asOf.startsWith(String(clock().getUTCFullYear()))) return Response.json({...cached.data,warning:message},{headers:{'Cache-Control':'no-store'}});
    return Response.json({error:message}, {status:502, headers:{'Cache-Control':'no-store'}});
  }
}
