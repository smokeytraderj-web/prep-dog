import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { benchmarkResponse } from './server/benchmark.js';
import { marketResponse } from './server/market.js';
import { historyResponse } from './server/history.js';
const benchmarkApi = {
  name: 'benchmark-api',
  configureServer(server) {
    server.middlewares.use('/api/benchmark/sp500', async (req, res) => {
      const response = await benchmarkResponse(new Request('http://localhost/api/benchmark/sp500', {method: req.method}));
      res.statusCode = response.status;
      for (const [key, value] of response.headers) res.setHeader(key, value);
      res.end(await response.text());
    });
    server.middlewares.use('/api/history', async (req, res) => {
      const response = await historyResponse(new Request(`http://localhost${req.originalUrl || req.url}`, {method: req.method}));
      res.statusCode = response.status;
      for (const [key, value] of response.headers) res.setHeader(key, value);
      res.end(await response.text());
    });
    server.middlewares.use('/api/market/ytd', async (req, res) => {
      const response = await marketResponse(new Request('http://localhost/api/market/ytd', {method: req.method}));
      res.statusCode = response.status;
      for (const [key, value] of response.headers) res.setHeader(key, value);
      res.end(await response.text());
    });
  },
};
export default defineConfig({plugins: [react(), tailwindcss(), benchmarkApi]});
