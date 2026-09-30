import { BENCHMARK_URL, parseBenchmark } from '../src/benchmark.js';
let cached;
export async function benchmarkResponse(request, fetcher = fetch) {
  if (request.method !== 'GET') return Response.json({error: 'Use GET.'}, {status: 405, headers: {Allow: 'GET'}});
  try {
    if (!cached || Date.now() - cached.time > 60 * 60 * 1000) {
      const response = await fetcher(BENCHMARK_URL, {signal: AbortSignal.timeout(10000), headers: {Accept: 'text/csv', 'User-Agent': 'Prep-Dog/2.0'}});
      if (!response.ok) throw Error(`iShares returned HTTP ${response.status}.`);
      if (Number(response.headers.get('content-length')) > 2_000_000) throw Error('Provider file too large.');
      const text = await response.text();
      if (text.length > 2_000_000) throw Error('Provider file too large.');
      cached = {data: parseBenchmark(text), time: Date.now()};
    }
    return Response.json(cached.data, {headers: {'Cache-Control': 'public, max-age=300, s-maxage=3600', 'X-Content-Type-Options': 'nosniff'}});
  } catch(error) {
    const reason = error.name==='TimeoutError' || error.name==='AbortError' ? 'The iShares request timed out.' : error.message;
    const message = `Daily benchmark refresh failed. ${reason}`;
    console.warn('benchmark_refresh_failed', reason);
    if (cached) return Response.json({...cached.data,delivery:'cached',warning:message},{headers:{'Cache-Control':'no-store'}});
    return Response.json({error:message}, {status: 502, headers: {'Cache-Control': 'no-store'}});
  }
}
