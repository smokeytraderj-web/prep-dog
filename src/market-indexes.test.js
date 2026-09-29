import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MARKET_INDEXES, parseYahooChart, marketSnapshotFromYahoo} from './market-indexes.js';
import {marketResponse} from '../server/market.js';

const chart = (start, end) => ({
 chart:{result:[{timestamp:[Date.parse(start)/1000,Date.parse(end)/1000],indicators:{quote:[{close:[100,110]}],adjclose:[{adjclose:[100,111]}]}}]}
});

test('Yahoo chart parsing prefers adjusted close and returns the observed dates',()=>{
 const parsed=parseYahooChart(chart('2025-12-31','2026-09-29'),MARKET_INDEXES[0],2026);
 assert.ok(Math.abs(parsed.return-11)<1e-9);
 assert.equal(parsed.startDate,'2025-12-31');
 assert.equal(parsed.endDate,'2026-09-29');
});

test('market snapshot keeps direct indexes separate from labeled ETF proxies',()=>{
 const payloads=Object.fromEntries(MARKET_INDEXES.map((definition,i)=>[definition.id,chart('2025-12-31',`2026-09-${10+i}`)]));
 const snapshot=marketSnapshotFromYahoo(payloads,new Date('2026-09-29T16:00:00Z'));
 assert.equal(snapshot.indexes.length,4);
 assert.equal(snapshot.indexes.find(i=>i.id==='emerging').proxy,true);
 assert.equal(snapshot.indexes.find(i=>i.id==='sp500').proxy,false);
 assert.match(snapshot.source,/Yahoo Finance/);
});

test('market endpoint rejects mutation and returns a four-index snapshot',async()=>{
 const methodResponse=await marketResponse(new Request('https://prep-dog.local/api/market/ytd',{method:'POST'}),async()=>new Response('not called'));
 assert.equal(methodResponse.status,405);
 const snapshotResponse=await marketResponse(new Request('https://prep-dog.local/api/market/ytd'),async url=>{
   const symbol=decodeURIComponent(new URL(url).pathname.split('/').at(-1));
   return new Response(JSON.stringify(chart('2025-12-31','2026-09-29')),{status:200,headers:{'content-type':'application/json'}});
 },()=>new Date('2026-09-29T16:00:00Z'));
 assert.equal(snapshotResponse.status,200);
 const snapshot = await snapshotResponse.json();
 assert.equal(snapshot.indexes.length,4);
 assert.equal(snapshot.indexes[0].points[0].return,0);
 assert.equal(snapshot.indexes[0].points.at(-1).return,snapshot.indexes[0].return);
});

test('YTD includes the first trading session and rejects a missing year-end baseline',()=>{
 const payload={chart:{result:[{timestamp:['2025-12-30','2025-12-31','2026-01-02','2026-09-29'].map(date=>Date.parse(date)/1000),indicators:{quote:[{close:[90,100,105,110]}]}}]}};
 const parsed=parseYahooChart(payload,MARKET_INDEXES[0],2026);
 assert.ok(Math.abs(parsed.return-10)<1e-9);
 assert.equal(parsed.points.length,3);
 assert.ok(Math.abs(parsed.points[1].return-5)<1e-9);
 assert.throws(()=>parseYahooChart(chart('2026-01-02','2026-09-29'),MARKET_INDEXES[0],2026),/year-end/);
});
