import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRiskSnapshot, riskInputTemplate } from './risk-snapshot.js';
const sample=()=>JSON.parse(readFileSync(new URL('../docs/slide-skills/risk-snapshot/assets/sample-input.json',import.meta.url),'utf8'));
test('risk integration matches the active portfolio and preserves the supplied skill calculations',()=>{
  const input=sample(), holdings=input.holdings.map(({ticker,value})=>({ticker,value}));
  const result=createRiskSnapshot(input,holdings);
  assert.equal(result.total_value,6797908);
  assert.equal(result.range.confidence,'90% probability range');
  assert.throws(()=>createRiskSnapshot(input,[{ticker:'AAPL',value:100}]),/every holding/);
  holdings[0].value+=1;
  assert.throws(()=>createRiskSnapshot(input,holdings),/must match/);
});
test('missing measures remain missing and incomplete templates cannot generate scores',()=>{
  const input=sample(), holdings=input.holdings.map(({ticker,value})=>({ticker,value}));
  delete input.risk_free_pct;delete input.advisory_fee_pct;
  input.holdings.forEach(h=>{delete h.yield_pct;delete h.expense_ratio_pct;delete h.tax_drag_pct;delete h.max_drawdown_pct;});
  const result=createRiskSnapshot(input,holdings);
  assert.equal(result.metrics.grade,null);assert.equal(result.metrics.annual_dividend_pct,null);assert.equal(result.metrics.max_drawdown_pct,null);
  assert.ok(Object.values(result.costs).every(v=>v===null));
  assert.throws(()=>createRiskSnapshot(riskInputTemplate(holdings,[],input.as_of,''),holdings));
});
test('history validation rejects invalid prices and mismatched period dates',()=>{
  const input=sample(), holdings=input.holdings.map(({ticker,value})=>({ticker,value}));
  input.holdings[0].history=[100,105,null];
  assert.throws(()=>createRiskSnapshot(input,holdings),/positive history/);
  input.holdings[0].history=[100,105,110];
  assert.throws(()=>createRiskSnapshot(input,holdings),/history_dates/);
});
