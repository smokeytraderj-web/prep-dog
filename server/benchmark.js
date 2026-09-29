import { BENCHMARK_URL, parseBenchmark } from '../src/benchmark.js';
let cached;
export async function benchmarkResponse(request, fetcher = fetch) {
  if (request.method !== 'GET') return Response.json({error: 'Use GET.'}, {status: 405, headers: {Allow: 'GET'}});
  try {
    if (!cached || Date.now() - cached.time > 60 * 60 * 1000) {
      const response = await fetcher(BENCHMARK_URL, {signal: AbortSignal.timeout(20000), headers: {Accept: 'text/csv', 'User-Agent': 'Prep-Dog/2.0'}});
      if (!response.ok) throw Error('Provider unavailable.');
      if (Number(response.headers.get('content-length')) > 2_000_000) throw Error('Provider file too large.');
      const text = await response.text();
      if (text.length > 2_000_000) throw Error('Provider file too large.');
      cached = {data: parseBenchmark(text), time: Date.now()};
    }
    return Response.json(cached.data, {headers: {'Cache-Control': 'public, max-age=300, s-maxage=3600', 'X-Content-Type-Options': 'nosniff'}});
  } catch {
    return Response.json({error: 'Daily S&P 500 benchmark is temporarily unavailable. Retry or import verified sector data.'}, {status: 502, headers: {'Cache-Control': 'no-store'}});
  }
}
