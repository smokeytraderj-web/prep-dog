import { benchmarkResponse } from '../../server/benchmark.js';
export default async function handler(req, res) {
  const response = await benchmarkResponse(new Request('https://prep-dog.local/api/benchmark/sp500', {method: req.method}));
  for (const [key, value] of response.headers) res.setHeader(key, value);
  res.status(response.status).send(await response.text());
}
