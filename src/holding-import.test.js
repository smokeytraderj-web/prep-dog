import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectTable,extractHoldings,textToSheets} from './holding-import.js';
import {validateSupporting,groupPositions} from './supporting-data.js';
test('broker export detects header below preamble, uses market value rather than price and keeps account/class detail',()=>{
 const rows=[['Portfolio export'],['As of','2026-09-29'],['Symbol','Quantity','Price','Market Value','Account','Asset Class','Region','Currency','Description'],['AAPL',10,200,2000,'Individual','Domestic Equity','U.S. large cap','USD','Apple'],['AAPL',5,200,1000,'Trust','Domestic Equity','U.S. large cap','USD','Apple'],['Total','','',3000]];
 const m=detectTable(rows);assert.equal(m.header,2);assert.equal(m.value,3);
 const r=extractHoldings(rows,m);assert.deepEqual(r.holdings,[{ticker:'AAPL',value:3000}]);assert.equal(r.errors.length,0);assert.equal(r.skipped.length,1);
 assert.equal(groupPositions(r.positions,'account').length,2);assert.equal(groupPositions(r.positions,'assetClass')[0].value,3000);
 assert.equal(r.positions[0].region,'U.S. large cap');
});
test('explicit quantity × price calculation and negative/currency safety',()=>{
 const rows=[['Ticker','Quantity','Price','Currency'],['MSFT',3,100,'USD']];
 assert.equal(extractHoldings(rows,detectTable(rows)).holdings[0].value,300);
 assert.equal(extractHoldings([...rows,['AAPL',-3,-100,'USD']],detectTable(rows)).errors.length,1);
 assert.equal(extractHoldings([...rows,['NVDA',2,100,'EUR']],detectTable(rows)).errors.length,1);
});
test('price-only and missing ticker exports cannot silently become holdings',()=>{
 const rows=[['Ticker','Price'],['AAPL',200]];
 assert.equal(extractHoldings(rows,detectTable(rows)).holdings.length,0);
 const bad=[['Ticker','Market Value'],['N/A',100],['MSFT',''],['AAPL',300]];
 assert.equal(extractHoldings(bad,detectTable(bad)).errors.length,2);
});
test('CSV quoted currency and tabular workbook rows preserve values',()=>{
 const [s]=textToSheets('Symbol,Market Value,Account\nAAPL,"$1,234.50",Trust');
 assert.equal(extractHoldings(s.data,detectTable(s.data)).holdings[0].value,1234.5);
 const [p]=textToSheets('AAPL 300\nMSFT 200');assert.equal(extractHoldings(p.data,detectTable(p.data)).holdings.length,2);
});
test('report data requires actual sourced numbers and correct reporting periods',()=>{
 assert.throws(()=>validateSupporting({risk:{asOf:'2026-09-29',source:'Risk export',accounts:[{name:'A',value:100,score:null}]}}));
 const a={periodStart:'2026-01-01',periodEnd:'2026-09-29',source:'Performance export',feeBasis:'Gross',accounts:[{name:'A',holdings:[{ticker:'TST',contribution:-.2,return:-10}]}]};
 assert.equal(validateSupporting({attribution:a}).attribution.accounts[0].holdings[0].contribution,-.2);
 assert.throws(()=>validateSupporting({attribution:{...a,periodEnd:'2025-01-01'}}));
 assert.throws(()=>validateSupporting({earnings:{}}));
});
