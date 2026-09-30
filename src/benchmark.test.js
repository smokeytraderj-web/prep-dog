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
test('provider share-class spaces match dotted or hyphenated uploaded tickers',()=>{
 const data=parseBenchmark(fixture.replace('T0,','BRK B,'),'2026-09-29T15:00:00Z');
 assert.equal(data.constituents[0].ticker,'BRK-B');
 assert.equal(comparePortfolio([{ticker:'BRK.B',value:100}],data).coverage,100);
 assert.ok(comparePortfolio([{ticker:'BRK-B',value:100}],data).data);
});
test('endpoint exposes failure and disallows mutation',async()=>{
 assert.equal((await benchmarkResponse(new Request('https://example.com',{method:'POST'}))).status,405);
 const res=await benchmarkResponse(new Request('https://example.com'),async()=>new Response('Provider unavailable',{status:503}));
 assert.equal(res.status,502);assert.equal(res.headers.get('cache-control'),'no-store');
});

test('a constituent with no standard sector is dropped and disclosed, not fatal', () => {
  // The provider files the odd name under "Other"; one such row used to throw
  // the whole file away and leave the benchmark permanently stale.
  const lines = fixture.split('\r\n');
  lines.splice(lines.length - 1, 0, 'DASH,"DOORDASH CLASS A",Other,Equity,"1,000.00",0.22');
  const result = parseBenchmark(lines.join('\r\n'), '2026-09-29T15:00:00Z');
  assert.equal(result.constituents.length, 451);
  assert.ok(!result.constituents.some(c => c.ticker === 'DASH'));
  assert.deepEqual(result.unclassified, ['DASH']);
  assert.match(result.warning, /DASH/);
  assert.match(result.warning, /carries no standard sector/);
  assert.ok(Math.abs(result.sectors.reduce((n, s) => n + s.weight, 0) - 100) < 0.0001);
});

test('a clean file carries no unclassified warning', () => {
  const result = snapshot();
  assert.deepEqual(result.unclassified, []);
  assert.equal(result.warning, undefined);
});

test('a wholesale sector-format change still fails loudly', () => {
  // Beyond a handful, an unmapped sector means the format moved, not a stray row.
  assert.throws(() => parseBenchmark(fixture.replaceAll(',Materials,', ',Mystery,'), '2026-09-29T15:00:00Z'),
    /incomplete equity classifications/);
});
