import { test } from "node:test";
import assert from "node:assert/strict";
import { blendedBenchmark } from "./blended-benchmark.js";

const boards = {
  indexes: {indexes: [
    {id: "sp500", symbol: "^GSPC", label: "S&P 500", return: 12},
    {id: "msci", symbol: "EFA", label: "MSCI EAFE", return: 6},
  ]},
  "fixed-income": {indexes: [{id: "aggregate", symbol: "AGG", label: "U.S. Aggregate Bond", return: 2}]},
};
const rows = [
  {name: "Domestic Equity", start: 500, ytdReturn: 14},
  {name: "Fixed Income", start: 500, ytdReturn: 1},
];

test("blends the benchmark on the client's own weights", () => {
  const result = blendedBenchmark(rows, boards);
  assert.equal(result.benchmarkReturn, 7);        // half at 12, half at 2
  assert.equal(result.portfolioReturn, 7.5);      // half at 14, half at 1
  assert.equal(result.difference, 0.5);
  assert.equal(result.coverage, 100);
});

test("weights on start-of-year value, not today's", () => {
  // The same two classes, but the equity sleeve started far smaller. A blend
  // weighted on today's value would read the benchmark as mostly equity.
  const result = blendedBenchmark(
    [{name: "Domestic Equity", start: 100, ytdReturn: 14}, {name: "Fixed Income", start: 900, ytdReturn: 1}],
    boards,
  );
  assert.equal(result.benchmarkReturn, 3);        // 10% at 12, 90% at 2
  assert.equal(Math.round(result.rows.find(r => r.name === "Fixed Income").weight), 90);
});

test("a class with no index proxy is left out of both sides, and said so", () => {
  const result = blendedBenchmark([...rows, {name: "Alternative", start: 1000, ytdReturn: 30}], boards);
  // The alternative sleeve neither flatters the portfolio nor the benchmark.
  assert.equal(result.portfolioReturn, 7.5);
  assert.equal(Math.round(result.coverage), 50);
  assert.deepEqual(result.excluded, ["Alternative"]);
});

test("an unpriced board leaves that class out rather than scoring it zero", () => {
  const result = blendedBenchmark(rows, {indexes: boards.indexes});
  assert.equal(result.rows.length, 1);
  assert.equal(result.benchmarkReturn, 12);
  assert.deepEqual(result.rows.map(r => r.name), ["Domestic Equity"]);
});

test("nothing to compare returns nothing, rather than a zero", () => {
  assert.equal(blendedBenchmark([], boards), null);
  assert.equal(blendedBenchmark([{name: "Alternative", start: 10, ytdReturn: 5}], boards), null);
  assert.equal(blendedBenchmark(rows, {}), null);
});
