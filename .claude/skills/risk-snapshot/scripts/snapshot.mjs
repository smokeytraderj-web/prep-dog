// Build a risk snapshot from a holdings file. See SKILL.md for the contract.
import {
  allocation, blendedVolPct, grade, maxDrawdownPct, riskScore, seriesStats,
  sixMonthRange, annualRangeMidpointPct, toReturns, weightedBy, CLASSES,
} from "./lib.mjs";

const num = (v) => typeof v === "number" && Number.isFinite(v);

export function validate(input) {
  if (!input || !Array.isArray(input.holdings) || !input.holdings.length)
    throw Error("Supply at least one holding.");
  for (const k of ["as_of", "portfolio_label"])
    if (typeof input[k] !== "string" || !input[k].trim())
      throw Error(`Supply ${k}.`);
  const seen = new Set();
  input.holdings.forEach((h, i) => {
    const at = `Holding ${i + 1}${h.ticker ? ` (${h.ticker})` : ""}`;
    if (typeof h.ticker !== "string" || !h.ticker.trim())
      throw Error(`${at}: supply a ticker.`);
    if (seen.has(h.ticker.toUpperCase()))
      throw Error(`${at}: combine duplicate tickers into one row.`);
    seen.add(h.ticker.toUpperCase());
    if (!num(h.value) || h.value <= 0)
      throw Error(`${at}: supply a positive position value.`);
    if (!CLASSES.includes(h.asset_class))
      throw Error(`${at}: asset_class must be one of ${CLASSES.join(", ")}.`);
    const hasHistory = Array.isArray(h.history) && h.history.length > 2;
    if (!hasHistory && !(num(h.annual_return_pct) && num(h.annual_vol_pct)))
      throw Error(
        `${at}: supply history, or both annual_return_pct and annual_vol_pct.`,
      );
  });
  return input;
}

export function buildSnapshot(rawInput) {
  const input = validate(rawInput);
  const periodsPerYear = input.periods_per_year ?? 12;
  const riskFreePct = input.risk_free_pct ?? 4;
  const total = input.holdings.reduce((s, h) => s + h.value, 0);

  const positions = input.holdings.map((h) => {
    const history = Array.isArray(h.history) && h.history.length > 2 ? h.history : null;
    const stats = history
      ? seriesStats(toReturns(history), periodsPerYear)
      : { annualReturnPct: h.annual_return_pct, annualVolPct: h.annual_vol_pct };
    return {
      ticker: h.ticker.toUpperCase(),
      name: h.name ?? h.ticker.toUpperCase(),
      value: h.value,
      weight: h.value / total,
      assetClass: h.asset_class,
      history,
      annualReturnPct: stats.annualReturnPct,
      annualVolPct: stats.annualVolPct,
      yieldPct: h.yield_pct ?? 0,
      expenseRatioPct: h.expense_ratio_pct ?? 0,
      taxDragPct: h.tax_drag_pct ?? 0,
    };
  });

  // A single portfolio series is preferred; it carries real covariance and a
  // real drawdown. It is only available when every holding supplies history of
  // the same length.
  const lengths = new Set(positions.map((p) => p.history?.length ?? 0));
  const aligned = lengths.size === 1 && !lengths.has(0);
  const warnings = [];

  let annualReturnPct;
  let annualVolPct;
  let drawdownPct;
  let drawdownBasis;

  if (aligned) {
    const periods = positions[0].history.length;
    const series = [];
    for (let t = 0; t < periods; t += 1)
      series.push(
        positions.reduce(
          (s, p) => s + (p.weight * p.history[t]) / p.history[0],
          0,
        ),
      );
    const stats = seriesStats(toReturns(series), periodsPerYear);
    annualReturnPct = stats.annualReturnPct;
    annualVolPct = stats.annualVolPct;
    drawdownPct = maxDrawdownPct(series);
    drawdownBasis = `Actual worst peak-to-trough decline of the blended portfolio over ${periods} supplied periods.`;
  } else {
    if (positions.some((p) => p.history))
      warnings.push(
        "Price history was ignored: it must cover the same periods for every holding.",
      );
    annualReturnPct = weightedBy(positions, "annualReturnPct");
    annualVolPct = blendedVolPct(positions, input.correlation);
    const supplied = input.holdings.every((h) => num(h.max_drawdown_pct));
    drawdownPct = supplied
      ? input.holdings.reduce(
          (s, h, i) => s + positions[i].weight * h.max_drawdown_pct,
          0,
        )
      : -(annualVolPct * 0.95);
    drawdownBasis = supplied
      ? "Weighted average of supplied holding drawdowns; not a blended-portfolio drawdown."
      : "Modeled from portfolio volatility; no drawdown history was supplied.";
    warnings.push(
      "No aligned price history: volatility uses the documented class correlation assumptions.",
    );
  }

  const range = sixMonthRange(annualReturnPct, annualVolPct);
  const midpoint = annualRangeMidpointPct(range.downsidePct, range.upsidePct);
  const advisoryFeePct = input.advisory_fee_pct ?? 0;

  return {
    as_of: input.as_of,
    portfolio_label: input.portfolio_label,
    client_label: input.client_label ?? null,
    total_value: total,
    risk_score: riskScore(range.downsidePct),
    range: {
      horizon_months: 6,
      confidence: "95% probability range",
      downside_pct: range.downsidePct,
      upside_pct: range.upsidePct,
      downside_value: (total * range.downsidePct) / 100,
      upside_value: (total * range.upsidePct) / 100,
    },
    allocation: allocation(positions),
    metrics: {
      grade: grade(midpoint, annualVolPct, riskFreePct),
      annual_dividend_pct: weightedBy(positions, "yieldPct"),
      max_drawdown_pct: drawdownPct,
      annual_range_midpoint_pct: midpoint,
      annual_volatility_pct: annualVolPct,
    },
    costs: {
      est_tax_drag_pct: weightedBy(positions, "taxDragPct"),
      expense_ratio_pct: weightedBy(positions, "expenseRatioPct"),
      advisory_fees_pct: advisoryFeePct,
    },
    basis: {
      method: "In-house model; not a Riskalyze/Nitrogen Risk Number or GPA.",
      risk_free_pct: riskFreePct,
      periods_per_year: periodsPerYear,
      covariance: aligned ? "blended portfolio price history" : "class correlation assumptions",
      drawdown_basis: drawdownBasis,
    },
    warnings,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import("node:fs");
  const [, , inPath, outPath] = process.argv;
  if (!inPath) {
    console.error("usage: node scripts/snapshot.mjs <input.json> [out.json]");
    process.exit(1);
  }
  const snapshot = buildSnapshot(JSON.parse(fs.readFileSync(inPath, "utf8")));
  const text = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (outPath) fs.writeFileSync(outPath, text);
  else process.stdout.write(text);
  for (const w of snapshot.warnings) console.error(`warning: ${w}`);
}
