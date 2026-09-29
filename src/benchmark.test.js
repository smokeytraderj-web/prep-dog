import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv, parseBenchmark, comparePortfolio, isBenchmarkStale, SECTOR_NAMES} from './benchmark.js';
import {benchmarkResponse} from '../server/benchmark.js';
const names = Object.keys(SECTOR_NAMES).filter(n => n !== 'Communication');
const fixture = ['iShares Core S&P 500 ETF','Fund Holdings as of,"Sep 28, 2026"','Ticker,Name,Sector,Asset Class,Market Value,Weight (%)',...Array.from({length:451},(_,i)=>`T${i},"Company ${i}, Inc.",${names[i%11]},Equity,"1,000.00",0.22`),'USD,Cash,Cash and/or Derivatives,Cash,500,0.1'].join('\r\n');
const snapshot = () => parseBenchmark(fixture,'2026-09-29T15:00:00Z');
test('CSV preserves quoted commas, escaped quotes and multiline fields',()=>assert.deepEqual(parseCsv('A,"B,C","D""E"\r\nX,"Y\nZ",3'),[['A','B,C','D"E'],['X','Y\nZ','3']]));
test('validates provider date and complete sectors; normalizes equity market values excluding cash',()=>{
 const result=snapshot(); assert.equal(result.asOf,'2026-09-28'); assert.equal(result.constituents.length,451); assert.equal(result.sectors.length,11);
 assert.ok(Math.abs(result.sectors.reduce((n,s)=>n+s.weight,0)-100)<0.0001);
 assert.equal(result.constituents[0].name,'Company 0, Inc.');
 for(const broken of ['<html>blocked</html>',fixture.replace('Fund Holdings as of','Unknown'),fixture.replaceAll('Materials','-'),fixture.split('\r\n').slice(0,10).join('\r\n')]) assert.throws(()=>parseBenchmark(broken));
});
test('portfolio exposure comes from user position values and never copies benchmark weights',()=>{
 const {data}=comparePortfolio([{ticker:'T0',value:300},{ticker:'T1',value:100}],snapshot());
 assert.equal(data.sectors[0].portfolio,75); assert.equal(data.sectors[1].portfolio,25);
 assert.notEqual(data.sectors[0].portfolio,data.sectors[0].benchmark);
});
test('unknown funds and tickers block a partial comparison; IVV has explicit look-through',()=>{
 const result=comparePortfolio([{ticker:'T0',value:300},{ticker:'UNKNOWN',value:100}],snapshot());
 assert.equal(result.data,null);assert.equal(result.coverage,75);assert.equal(result.unmatched[0].ticker,'UNKNOWN');
 const ivv=comparePortfolio([{ticker:'IVV',value:100}],snapshot());
 assert.ok(ivv.data.sectors.every(s=>Math.abs(s.portfolio-s.benchmark)<0.00001));
});
test('staleness uses provider date, not the retrieval timestamp',()=>{
 assert.equal(isBenchmarkStale(snapshot(),Date.parse('2026-09-29')),false);
 assert.equal(isBenchmarkStale(snapshot(),Date.parse('2026-10-05')),true);
});
test('endpoint exposes failure and disallows mutation',async()=>{
 assert.equal((await benchmarkResponse(new Request('https://example.com',{method:'POST'}))).status,405);
 const res=await benchmarkResponse(new Request('https://example.com'),async()=>new Response('Provider unavailable',{status:503}));
 assert.equal(res.status,502);assert.equal(res.headers.get('cache-control'),'no-store');
});
