import test from 'node:test';
import assert from 'node:assert/strict';
import { alignHistories, parseYahooHistory, validSymbol, historySymbol, trailingYieldPct, MIN_PERIODS } from './price-history.js';

const months = (count, start = 0) => Array.from({length: count}, (_, i) => Date.UTC(2021 + Math.floor((start + i) / 12), (start + i) % 12, 1) / 1000);
const chart = (timestamps, closes) => ({chart: {result: [{timestamp: timestamps, indicators: {adjclose: [{adjclose: closes}], quote: [{close: closes}]}}]}});

test('parses monthly adjusted closes and rejects thin history', () => {
  const stamps = months(30);
  const closes = stamps.map((_, i) => 100 + i);
  const parsed = parseYahooHistory(chart(stamps, closes), 'AAPL');
  assert.equal(parsed.series.length, 30);
  assert.equal(parsed.series[0].date, '2021-01');
  assert.equal(parsed.series.at(-1).close, 129);
  assert.throws(() => parseYahooHistory(chart(months(5), [1, 2, 3, 4, 5]), 'AAPL'), /too little price history/);
});

test('drops non-positive and non-finite prices rather than carrying them', () => {
  const stamps = months(30);
  const closes = stamps.map((_, i) => (i === 3 ? null : i === 4 ? 0 : 100 + i));
  const parsed = parseYahooHistory(chart(stamps, closes), 'MSFT');
  assert.equal(parsed.series.length, 28);
  assert.ok(parsed.series.every(point => point.close > 0));
});

test('alignment intersects shared dates and refuses a short overlap', () => {
  const build = (symbol, count, start) => ({symbol, series: months(count, start).map((stamp, i) => ({date: new Date(stamp * 1000).toISOString().slice(0, 7), close: 100 + i}))});
  const aligned = alignHistories([build('A', 40, 0), build('B', 36, 4)], '2026-09-30');
  assert.equal(aligned.dates.length, 36);
  assert.ok(aligned.dates.every(date => /^\d{4}-\d{2}-01$/.test(date)));
  assert.equal(aligned.series.A.length, aligned.series.B.length);
  assert.equal(alignHistories([build('A', 40, 0), build('B', MIN_PERIODS - 1, 38)], '2026-09-30'), null);
});

test('alignment excludes periods after the as-of date', () => {
  const build = symbol => ({symbol, series: months(40, 0).map((stamp, i) => ({date: new Date(stamp * 1000).toISOString().slice(0, 7), close: 100 + i}))});
  const aligned = alignHistories([build('A'), build('B')], '2023-06-15');
  assert.ok(aligned.dates.every(date => date <= '2023-06-01'));
});

test('symbol validation and normalization', () => {
  assert.ok(validSymbol('BRK.B'));
  assert.equal(historySymbol('brk.b'), 'BRK-B');
  assert.ok(validSymbol('^GSPC'.replace('^', 'X')));
  assert.ok(!validSymbol('1AAPL'));
  assert.ok(!validSymbol('AAPL; DROP'));
  assert.ok(!validSymbol(''));
});

test('trailing yield uses unadjusted closes and counts only the last twelve months', () => {
  const now = Date.UTC(2026, 8, 30) / 1000;
  const div = (y, m, amount) => ({date: Date.UTC(y, m, 1) / 1000, amount});
  const payload = {chart: {result: [{
    timestamp: months(30),
    indicators: {
      adjclose: [{adjclose: months(30).map(() => 90)}],   // dividend-adjusted, lower
      quote: [{close: months(30).map(() => 100)}],        // raw close: the denominator
    },
    events: {dividends: {
      a: div(2026, 2, 1), b: div(2026, 5, 1), c: div(2026, 8, 1),
      old: div(2024, 1, 5),                               // outside the window
    }},
  }]}};
  // 3 x 1.00 inside the window over a 100 close.
  assert.equal(trailingYieldPct(payload, now), 3);
});

test('no dividend in the window is a measured zero, and a broken payload is null', () => {
  const now = Date.UTC(2026, 8, 30) / 1000;
  const bare = {chart: {result: [{timestamp: months(30), indicators: {adjclose: [{adjclose: months(30).map(() => 50)}], quote: [{close: months(30).map(() => 50)}]}}]}};
  assert.equal(trailingYieldPct(bare, now), 0);
  assert.equal(trailingYieldPct({chart: {result: []}}, now), null);
  assert.equal(trailingYieldPct({chart: {result: [{indicators: {quote: [{close: [0]}]}}]}}, now), null);
});
