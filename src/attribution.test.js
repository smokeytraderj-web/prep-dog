import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAttribution, contributors } from './attribution.js';

const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} !== ${b}`);

test('contributions sum to the portfolio return', () => {
  const holdings = [
    {ticker: 'AAA', value: 150},   // +50%
    {ticker: 'BBB', value: 90},    // -10%
    {ticker: 'CCC', value: 200},   // flat
  ];
  const result = computeAttribution(holdings, {AAA: 50, BBB: -10, CCC: 0});
  const summed = result.rows.reduce((n, row) => n + row.contribution, 0);
  close(summed, result.portfolioReturn);
  // start = 100 + 100 + 200 = 400; gain = 50 - 10 + 0 = 40 => +10%
  close(result.startTotal, 400);
  close(result.portfolioReturn, 10);
});

test('weight is the start-of-period weight, not today\'s', () => {
  // A doubled position is 2/3 of today's value but was half at the start.
  const result = computeAttribution([
    {ticker: 'UP', value: 200},
    {ticker: 'FLAT', value: 100},
  ], {UP: 100, FLAT: 0});
  const up = result.rows.find(row => row.ticker === 'UP');
  close(up.weight, 50);
  close(up.contribution, 50);
});

test('a position with no return is excluded and reported, not treated as flat', () => {
  const result = computeAttribution([
    {ticker: 'AAA', value: 100},
    {ticker: 'NONE', value: 100},
  ], {AAA: 10});
  assert.deepEqual(result.unpriced, ['NONE']);
  assert.equal(result.rows.length, 1);
  // Coverage reports the half of today's value the table actually explains.
  close(result.coverage, 50);
});

test('a return of -100% or worse is not usable', () => {
  const result = computeAttribution([{ticker: 'DEAD', value: 1}], {DEAD: -100});
  assert.deepEqual(result.unpriced, ['DEAD']);
  assert.equal(result.rows.length, 0);
  assert.equal(result.portfolioReturn, 0);
});

test('non-positive and non-numeric values are skipped without being called unpriced', () => {
  const result = computeAttribution([
    {ticker: 'ZERO', value: 0},
    {ticker: 'BAD', value: 'x'},
    {ticker: 'OK', value: 100},
  ], {ZERO: 5, BAD: 5, OK: 5});
  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.unpriced, []);
});

test('contributors splits the ranked ends and never repeats a row', () => {
  const holdings = Array.from({length: 12}, (_, i) => ({ticker: `T${i}`, value: 100}));
  const returns = Object.fromEntries(holdings.map((h, i) => [h.ticker, i - 6]));
  const result = computeAttribution(holdings, returns);
  const {positive, negative} = contributors(result, 3);
  assert.equal(positive.length, 3);
  assert.equal(negative.length, 3);
  assert.ok(positive.every(p => p.contribution > 0));
  assert.ok(negative.every(n => n.contribution < 0));
  const overlap = positive.filter(p => negative.some(n => n.ticker === p.ticker));
  assert.deepEqual(overlap, []);
  // Detractors read worst-first.
  assert.ok(negative[0].contribution <= negative.at(-1).contribution);
});

test('an empty portfolio returns zeroes rather than NaN', () => {
  const result = computeAttribution([], {});
  assert.equal(result.portfolioReturn, 0);
  assert.equal(result.coverage, 0);
  assert.deepEqual(result.rows, []);
});
