import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHoldings} from './holdings.js';
test('handles pasted markdown, currency, CSV and combines duplicate positions',()=>{
 const result=parseHoldings('| Ticker | Value |\n| --- | --- |\n| AAPL | $1,200.50 |\nMSFT,500\naapl 99.50');
 assert.deepEqual(result,{holdings:[{ticker:'AAPL',value:1300},{ticker:'MSFT',value:500}],errors:[]});
});
test('does not silently accept ambiguous multiple values or invalid positions',()=>{
 const r=parseHoldings('AAPL 20 200\nMSFT -20\nNVDA 0\nhello\nJPM 100');
 assert.equal(r.errors.length,4);assert.deepEqual(r.holdings,[{ticker:'JPM',value:100}]);
});
import {validateEquity,SECTOR_ORDER} from './equity.js';
test('requires complete sector data and rejects duplicates',()=>{
 const data={as_of:'As of test',portfolio_label:'Test',benchmark_label:'Test',source_note:'Test',sectors:SECTOR_ORDER.map(name=>({name,portfolio:100/11,benchmark:100/11}))};
 assert.equal(validateEquity(data).sectors.length,11);
 assert.throws(()=>validateEquity({...data,sectors:data.sectors.map((s,i)=>i===1?data.sectors[0]:s)}));
 assert.throws(()=>validateEquity({...data,sectors:data.sectors.map(s=>({...s,benchmark:0}))}));
});
