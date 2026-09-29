import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSnapshot } from "./snapshot.mjs";
import { renderSlide } from "./render.mjs";
import {
  annualRangeMidpointPct, maxDrawdownPct, riskScore, seriesStats,
  sixMonthRange, toReturns,
} from "./lib.mjs";

const sample = () =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL("../assets/sample-input.json", import.meta.url)), "utf8"),
  );

// Reference report: 8.22% annual midpoint and 12.29% annualized volatility
// produce a -10.27%/+18.33% six-month range and a Risk Score of 52.
test("reproduces the reference range, midpoint and score", () => {
  const r = sixMonthRange(8.22, 12.29);
  assert.equal(r.downsidePct.toFixed(2), "-10.27");
  assert.equal(r.upsidePct.toFixed(2), "18.32");
  assert.equal(annualRangeMidpointPct(r.downsidePct, r.upsidePct).toFixed(2), "8.22");
  assert.equal(riskScore(r.downsidePct), 52);
});

test("risk score stays inside 1..99 and rises with downside", () => {
  assert.equal(riskScore(0), 1);
  assert.equal(riskScore(-200), 99);
  assert.ok(riskScore(-15) > riskScore(-5));
});

test("series stats and drawdown read a price history", () => {
  const prices = [100, 110, 99, 105];
  const stats = seriesStats(toReturns(prices), 12);
  assert.ok(stats.annualVolPct > 0);
  assert.equal(maxDrawdownPct(prices).toFixed(2), "-10.00");
});

test("builds a complete snapshot from the sample holdings", () => {
  const s = buildSnapshot(sample());
  assert.equal(s.total_value, 6797908);
  assert.equal(s.allocation.reduce((a, b) => a + b.percent, 0).toFixed(2), "100.00");
  assert.ok(s.range.downside_pct < 0 && s.range.upside_pct > 0);
  assert.equal(
    Math.round(s.range.downside_value),
    Math.round((s.total_value * s.range.downside_pct) / 100),
  );
  assert.ok(s.risk_score >= 1 && s.risk_score <= 99);
  assert.ok(s.warnings.length, "assumption-based runs must warn");
});

test("aligned price history uses the blended portfolio series", () => {
  const input = sample();
  input.periods_per_year = 12;
  input.holdings = input.holdings.map((h, i) => ({
    ...h,
    history: Array.from({ length: 24 }, (_, t) => 100 * (1 + 0.01 * i) ** t),
  }));
  const s = buildSnapshot(input);
  assert.equal(s.basis.covariance, "blended portfolio price history");
  assert.equal(s.warnings.length, 0);
});

test("rejects incomplete holdings", () => {
  for (const mutate of [
    (i) => { i.holdings[0].value = 0; },
    (i) => { i.holdings[0].asset_class = "crypto"; },
    (i) => { delete i.holdings[0].annual_vol_pct; },
    (i) => { i.holdings[1].ticker = i.holdings[0].ticker; },
    (i) => { i.as_of = " "; },
  ]) {
    const input = sample();
    mutate(input);
    assert.throws(() => buildSnapshot(input));
  }
});

test("renders a self-contained slide carrying the exact figures", () => {
  const s = buildSnapshot(sample());
  const html = renderSlide(s);
  assert.ok(html.includes("$6,797,908"));
  assert.ok(html.includes(`>${s.risk_score}<`));
  assert.ok(html.includes("not a guarantee"));
  assert.ok(!/<script/i.test(html));
});
