import { test } from "node:test";
import assert from "node:assert/strict";
import { incomeAndCost } from "./portfolio-income.js";

const snapshot = (holdings, total) => ({total_value: total, model_input: {holdings}, costs: {est_tax_drag_pct: 0.4}});
const book = snapshot([
  {ticker: "IVV", name: "iShares Core S&P 500", value: 600000, yield_pct: 1.3, expense_ratio_pct: 0.03},
  {ticker: "AGG", name: "iShares Core Aggregate", value: 400000, yield_pct: 3.8, expense_ratio_pct: 0.03},
], 1000000);

test("income is the sum of each holding's own published yield", () => {
  const result = incomeAndCost(book);
  assert.equal(Math.round(result.annualIncome), 600000 * 0.013 + 400000 * 0.038);
  assert.equal(Number(result.yieldPct.toFixed(2)), 2.3);
  assert.equal(Number(result.fundCostPct.toFixed(4)), 0.03);
  assert.equal(Math.round(result.fundCostValue), 300);
});

test("a holding with no published rate is left out of the base, not scored zero", () => {
  // Dividing by the whole book would report a yield a third lower than the
  // rated positions actually pay.
  const result = incomeAndCost(snapshot([
    {ticker: "IVV", value: 600000, yield_pct: 2},
    {ticker: "PRIVATE", value: 400000},
  ], 1000000));
  assert.equal(result.yieldPct, 2);
  assert.equal(result.annualIncome, 12000);
  assert.equal(Math.round(result.incomeCoverage), 60);
});

test("the advisory fee only counts once it has been supplied", () => {
  const without = incomeAndCost(book);
  assert.equal(without.advisoryPct, null);
  assert.equal(without.advisoryValue, null);
  assert.equal(Number(without.totalCostPct.toFixed(2)), 0.03);

  const with1 = incomeAndCost(book, 1);
  assert.equal(with1.advisoryValue, 10000);
  assert.equal(Number(with1.totalCostPct.toFixed(2)), 1.03);
  assert.equal(Math.round(with1.netIncome), Math.round(without.annualIncome - 300 - 10000));
});

test("a nonsense fee is ignored rather than printed", () => {
  for (const bad of [-1, 250, NaN, null, undefined, "1"]) {
    assert.equal(incomeAndCost(book, bad).advisoryPct, null, `${bad} should not be accepted`);
  }
});

test("nothing to report returns nothing", () => {
  assert.equal(incomeAndCost(null), null);
  assert.equal(incomeAndCost(snapshot([], 1000)), null);
  assert.equal(incomeAndCost(snapshot([{ticker: "X", value: 100}], 100)), null);
  assert.equal(incomeAndCost(snapshot([{ticker: "X", value: 100, yield_pct: 2}], 0)), null);
});
