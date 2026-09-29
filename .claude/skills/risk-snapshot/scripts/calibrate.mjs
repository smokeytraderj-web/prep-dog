// Fit the Risk Score anchor table to observed (downside, score) pairs.
//
//   node scripts/calibrate.mjs assets/calibration.json
//
// Prints the residual of the current anchors against every observation and, if
// there are enough observations, the re-fitted anchor table to paste into
// lib.mjs. Calibration is an empirical fit to figures a vendor published; it
// does not recover their formula and does not make our score theirs.
import { readFileSync } from "node:fs";
import { RISK_ANCHORS, interpolate } from "./lib.mjs";

const file = process.argv[2] ?? new URL("../assets/calibration.json", import.meta.url);
const { observations } = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(observations) || !observations.length)
  throw Error("Supply at least one observation.");

const rows = observations
  .map((o) => {
    if (!Number.isFinite(o.downside_pct) || !Number.isFinite(o.score))
      throw Error("Each observation needs a numeric downside_pct and score.");
    const predicted = interpolate(RISK_ANCHORS, Math.abs(o.downside_pct));
    return { ...o, predicted: Math.round(predicted), error: Math.round(predicted) - o.score };
  })
  .sort((a, b) => Math.abs(a.downside_pct) - Math.abs(b.downside_pct));

console.log("downside%  observed  current  error  source");
for (const r of rows)
  console.log(
    `${r.downside_pct.toFixed(2).padStart(8)}  ${String(r.score).padStart(8)}  ${String(r.predicted).padStart(7)}  ${String(r.error).padStart(5)}  ${r.source ?? ""}`,
  );
const mae = rows.reduce((a, r) => a + Math.abs(r.error), 0) / rows.length;
const worst = Math.max(...rows.map((r) => Math.abs(r.error)));
console.log(`\nobservations ${rows.length} · mean absolute error ${mae.toFixed(2)} · worst ${worst}`);

if (rows.length < 4) {
  console.log(
    "\nToo few observations to re-fit. Collect pairs spread across the range\n" +
      "(low, middle and high downside) before changing the anchors.",
  );
  process.exit(0);
}
// Re-fit: keep the endpoints, snap each interior anchor to the observations
// bracketing it, so the table stays monotonic and continuous.
const fitted = RISK_ANCHORS.map(([x, y], i) => {
  if (i === 0 || i === RISK_ANCHORS.length - 1) return [x, y];
  const near = rows.filter((r) => Math.abs(Math.abs(r.downside_pct) - x) <= 2.5);
  if (!near.length) return [x, y];
  return [x, Math.round(near.reduce((a, r) => a + r.score, 0) / near.length)];
});
for (let i = 1; i < fitted.length; i += 1)
  if (fitted[i][1] <= fitted[i - 1][1]) fitted[i][1] = fitted[i - 1][1] + 1;
console.log(
  `\nRe-fitted RISK_ANCHORS (paste into scripts/lib.mjs after review):\n${JSON.stringify(fitted)}`,
);
