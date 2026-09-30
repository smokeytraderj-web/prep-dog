import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRiskInput, createAutoRiskSnapshot } from './risk-auto.js';
import { classifyHoldings, suppliedClass } from './asset-class.js';

const PERIODS = 60;
const dates = Array.from({length: PERIODS}, (_, i) => `${2021 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`);
// Deterministic, mildly volatile series so the model has something real to measure.
const walk = (seed, drift) => {
  let price = 100, value = seed;
  return dates.map(() => {
    value = (value * 1103515245 + 12345) % 2147483648;
    price *= 1 + drift + ((value / 2147483648) - 0.5) * 0.12;
    return price;
  });
};
const history = () => ({
  dates,
  source: 'test monthly closes',
  series: {AAPL: walk(1, 0.010), AGG: walk(2, 0.002), BIL: walk(3, 0.0003)},
});
const holdings = [{ticker: 'AAPL', value: 60000}, {ticker: 'AGG', value: 30000}, {ticker: 'BIL', value: 10000}];
const benchmark = {constituents: [{ticker: 'AAPL', sector: 'Info Tech'}]};
const build = (over = {}) => createAutoRiskSnapshot({holdings, benchmark, history: history(), asOf: '2026-09-30', client: 'Test Client', ...over});

test('classifies equities from the benchmark and funds from the table', () => {
  const {classified, unclassified} = classifyHoldings(holdings, benchmark);
  assert.deepEqual(classified.map(h => h.asset_class), ['stocks', 'bonds', 'cash']);
  assert.deepEqual(unclassified, []);
});

test('an unknown ticker becomes other and is named, never guessed into stocks', () => {
  const {classified, unclassified} = classifyHoldings([{ticker: 'ZZZQ', value: 100}], benchmark);
  assert.equal(classified[0].asset_class, 'other');
  assert.deepEqual(unclassified, ['ZZZQ']);
  const snapshot = createAutoRiskSnapshot({holdings: [...holdings, {ticker: 'ZZZQ', value: 5000}], benchmark,
    history: {...history(), series: {...history().series, ZZZQ: walk(4, 0.004)}}, asOf: '2026-09-30'});
  assert.ok(snapshot.warnings.some(w => /ZZZQ/.test(w) && /other/.test(w)));
});

test('a supplied asset class outranks the lookup table', () => {
  assert.equal(suppliedClass([{ticker: 'AAPL', assetClass: 'Fixed income'}], 'AAPL'), 'bonds');
  // Conflicting labels for one ticker are not resolved by guessing.
  assert.equal(suppliedClass([{ticker: 'AAPL', assetClass: 'stocks'}, {ticker: 'AAPL', assetClass: 'cash'}], 'AAPL'), '');
  const {classified} = classifyHoldings(holdings, benchmark, [{ticker: 'AAPL', assetClass: 'other'}]);
  assert.equal(classified[0].asset_class, 'other');
});

test('uses the aligned-history path, so covariance and drawdown are real', () => {
  const snapshot = build();
  assert.equal(snapshot.basis.covariance, 'blended portfolio price history');
  assert.equal(snapshot.basis.periods, PERIODS);
  assert.ok(snapshot.metrics.max_drawdown_pct < 0);
  assert.ok(!snapshot.warnings.some(w => /class correlation assumptions/.test(w)));
  assert.equal(snapshot.total_value, 100000);
  assert.ok(snapshot.risk_score >= 1 && snapshot.risk_score <= 99);
});

test('measures with no source stay missing, not zero', () => {
  // build() supplies neither a risk-free rate nor per-holding yields.
  const snapshot = build();
  assert.equal(snapshot.metrics.grade, null);
  assert.equal(snapshot.metrics.annual_dividend_pct, null);
  // Tax drag and the advisory fee have no derivable source at all.
  assert.equal(snapshot.costs.est_tax_drag_pct, null);
  assert.equal(snapshot.costs.advisory_fees_pct, null);
  assert.ok(snapshot.warnings.some(w => /omitted, not treated as zero/.test(w)));
  assert.ok(snapshot.warnings.some(w => /grade omitted/.test(w)));
});

test('the modeled range is consistent with the portfolio total', () => {
  const s = build();
  assert.ok(Math.abs(s.range.downside_value - s.total_value * s.range.downside_pct / 100) < 0.01);
  assert.ok(Math.abs(s.range.upside_value - s.total_value * s.range.upside_pct / 100) < 0.01);
  assert.ok(s.range.downside_pct < s.range.upside_pct);
  assert.equal(s.range.horizon_months, 6);
});

test('refuses to model a holding without usable history rather than dropping it', () => {
  const partial = history();
  delete partial.series.AGG;
  assert.throws(() => createAutoRiskSnapshot({holdings, benchmark, history: partial, asOf: '2026-09-30'}), /No usable price history for AGG/);
  const ragged = history();
  ragged.series.AGG = ragged.series.AGG.slice(0, 40);
  assert.throws(() => createAutoRiskSnapshot({holdings, benchmark, history: ragged, asOf: '2026-09-30'}), /No usable price history for AGG/);
  const negative = history();
  negative.series.AGG = negative.series.AGG.map((p, i) => (i === 5 ? -1 : p));
  assert.throws(() => createAutoRiskSnapshot({holdings, benchmark, history: negative, asOf: '2026-09-30'}), /No usable price history for AGG/);
});

test('refuses to build without holdings or with too little shared history', () => {
  assert.throws(() => buildRiskInput({holdings: [], benchmark, history: history(), asOf: '2026-09-30'}), /Confirm holdings/);
  const short = {...history(), dates: dates.slice(0, 10)};
  assert.throws(() => buildRiskInput({holdings, benchmark, history: short, asOf: '2026-09-30'}), /overlapping monthly history/);
  assert.throws(() => buildRiskInput({holdings, benchmark, history: null, asOf: '2026-09-30'}), /Price history is required/);
});

test('allocation reflects the classified weights and totals 100', () => {
  const snapshot = build();
  const total = snapshot.allocation.reduce((sum, a) => sum + a.percent, 0);
  assert.ok(Math.abs(total - 100) < 0.001);
  assert.equal(snapshot.allocation.find(a => a.name === 'stocks').percent, 60);
  assert.equal(snapshot.allocation.find(a => a.name === 'bonds').percent, 30);
  assert.equal(snapshot.allocation.find(a => a.name === 'cash').percent, 10);
});

// --- measures sourced from market data and the published-rate table ---------
const withCosts = (over = {}) => createAutoRiskSnapshot({
  holdings: [{ticker: 'IVV', value: 60000}, {ticker: 'AGG', value: 30000}, {ticker: 'BIL', value: 10000}],
  benchmark, asOf: '2026-09-30',
  history: {dates, source: 'test', risk_free_pct: 4, risk_free_source: '13-week Treasury bill (^IRX)',
    series: {IVV: walk(1, 0.010), AGG: walk(2, 0.002), BIL: walk(3, 0.0003)},
    yields: {IVV: 1.2, AGG: 4.0, BIL: 3.6}, ...over},
});

test('equity funds classify as stocks rather than falling through to other', () => {
  const {classified, unclassified} = classifyHoldings(
    [{ticker: 'IVV', value: 1}, {ticker: 'VXUS', value: 1}, {ticker: 'GLD', value: 1}], benchmark);
  assert.deepEqual(classified.map(h => h.asset_class), ['stocks', 'stocks', 'other']);
  assert.deepEqual(unclassified, []);
});

test('a supplied risk-free rate produces the grade', () => {
  assert.notEqual(withCosts().metrics.grade, null);
  assert.equal(withCosts({risk_free_pct: null}).metrics.grade, null);
});

test('dividend yield is weighted from the per-holding trailing yields', () => {
  const s = withCosts();
  // 0.6*1.2 + 0.3*4.0 + 0.1*3.6 = 2.28
  assert.ok(Math.abs(s.metrics.annual_dividend_pct - 2.28) < 1e-9);
  // A holding with no yield figure omits the measure rather than assuming zero.
  assert.equal(withCosts({yields: {IVV: 1.2, AGG: 4.0}}).metrics.annual_dividend_pct, null);
});

test('a measured zero yield counts, and is not treated as missing', () => {
  const s = withCosts({yields: {IVV: 0, AGG: 0, BIL: 0}});
  assert.equal(s.metrics.annual_dividend_pct, 0);
});

test('expense ratio uses published rates, with common stocks at zero', () => {
  const s = withCosts();
  // IVV .03, AGG .03, BIL .1352 -> 0.6*.03 + 0.3*.03 + 0.1*.1352
  assert.ok(Math.abs(s.costs.expense_ratio_pct - (0.6 * 0.03 + 0.3 * 0.03 + 0.1 * 0.1352)) < 1e-9);
  const equity = createAutoRiskSnapshot({holdings: [{ticker: 'AAPL', value: 100}], benchmark,
    history: {dates, series: {AAPL: walk(1, 0.01)}, yields: {AAPL: 0.5}, risk_free_pct: 4}, asOf: '2026-09-30'});
  assert.equal(equity.costs.expense_ratio_pct, 0);
});

test('an unlisted fund omits the expense ratio and says which holding caused it', () => {
  const s = createAutoRiskSnapshot({holdings: [{ticker: 'IVV', value: 50}, {ticker: 'ZZZQ', value: 50}], benchmark,
    history: {dates, series: {IVV: walk(1, 0.01), ZZZQ: walk(2, 0.01)}, yields: {IVV: 1, ZZZQ: 1}, risk_free_pct: 4}, asOf: '2026-09-30'});
  assert.equal(s.costs.expense_ratio_pct, null);
  assert.ok(s.warnings.some(w => /Expense ratio omitted/.test(w) && /ZZZQ/.test(w)));
});

test('tax drag and advisory fee stay omitted, never defaulted to zero', () => {
  const s = withCosts();
  assert.equal(s.costs.est_tax_drag_pct, null);
  assert.equal(s.costs.advisory_fees_pct, null);
  assert.ok(s.warnings.some(w => /omitted, not treated as zero/.test(w)));
});
