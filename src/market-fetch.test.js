import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchMarketJson} from './market-fetch.js';
import {fetchIndexChart} from '../server/market.js';
import {MARKET_INDEXES} from './market-indexes.js';
test('market client retries a transient outage and preserves the provider error',async()=>{
  let calls=0;
  const data=await fetchMarketJson('/api/benchmark/sp500',async()=>++calls===1?Response.json({error:'Timed out'},{status:502}):Response.json({asOf:'2026-09-28'}));
  assert.equal(calls,2);assert.equal(data.asOf,'2026-09-28');
  await assert.rejects(()=>fetchMarketJson('/api/benchmark/sp500',async()=>Response.json({error:'iShares returned HTTP 503.'},{status:502})),/HTTP 503/);
});
test('market client identifies a sign-in response without retrying it as a data outage',async()=>{
  let calls=0;
  await assert.rejects(()=>fetchMarketJson('/api/benchmark/sp500',async()=>{calls++;return new Response('<html>Sign in</html>');}),/sign-in page/);
  assert.equal(calls,1);
});
test('YTD fetch switches Yahoo endpoints after rate limiting and validates the history',async()=>{
  const origins=[];
  const payload={chart:{result:[{timestamp:[Date.parse('2025-12-31')/1000,Date.parse('2026-09-29')/1000],indicators:{quote:[{close:[100,110]}]}}]}};
  const result=await fetchIndexChart(MARKET_INDEXES[0],1,2,2026,async url=>{
    origins.push(new URL(url).hostname);
    return origins.length===1?new Response('Rate limited',{status:429}):Response.json(payload);
  });
  assert.deepEqual(origins,['query1.finance.yahoo.com','query2.finance.yahoo.com']);assert.deepEqual(result,payload);
});
