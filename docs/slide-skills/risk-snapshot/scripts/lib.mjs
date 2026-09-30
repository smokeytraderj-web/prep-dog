// Risk snapshot computation library.
// Pure functions, no dependencies. See reference/methodology.md for every formula.

export const Z95 = 1.645; // one-tailed 5%/95% normal quantile
export const CLASSES = ["stocks", "bonds", "other", "cash"];

// Average cross-class correlation used only when per-holding price history is
// absent. Within a class, holdings are assumed to share the same factor.
export const DEFAULT_CORRELATION = {
  stocks: { stocks: 0.85, bonds: 0.15, other: 0.5, cash: 0 },
  bonds: { stocks: 0.15, bonds: 0.8, other: 0.25, cash: 0 },
  other: { stocks: 0.5, bonds: 0.25, other: 0.6, cash: 0 },
  cash: { stocks: 0, bonds: 0, other: 0, cash: 1 },
};

// Risk Score anchors: six-month 95% downside (absolute %) -> 1..99 score.
export const RISK_ANCHORS = [
  [0, 1],
  [2.5, 15],
  [5, 27],
  [10, 51],
  [15, 68],
  [20, 79],
  [30, 90],
  [45, 99],
];

// Risk-adjusted grade anchors: (annual range midpoint - risk free) / annual
// volatility -> 0.0..4.3 grade.
export const GRADE_ANCHORS = [
  [-0.25, 0],
  [0, 1],
  [0.1, 1.8],
  [0.2, 2.6],
  [0.3, 3.6],
  [0.4, 4.3],
];

export function interpolate(anchors, x) {
  const [minX, minY] = anchors[0];
  const [maxX, maxY] = anchors[anchors.length - 1];
  if (x <= minX) return minY;
  if (x >= maxX) return maxY;
  for (let i = 1; i < anchors.length; i += 1) {
    const [x0, y0] = anchors[i - 1];
    const [x1, y1] = anchors[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return maxY;
}

export function riskScore(downsidePct) {
  return Math.min(99, Math.max(1, Math.round(interpolate(RISK_ANCHORS, Math.max(0, -downsidePct)))));
}

export function grade(annualMidpointPct, annualVolPct, riskFreePct) {
  if (!(annualVolPct > 0)) return 4.3;
  const ratio = (annualMidpointPct - riskFreePct) / annualVolPct;
  return Math.round(interpolate(GRADE_ANCHORS, ratio) * 10) / 10;
}

// Annualized mean and volatility from a series of periodic simple returns.
export function seriesStats(returns, periodsPerYear) {
  const n = returns.length;
  if (n < 2) throw Error("A return series needs at least two periods.");
  const mean = returns.reduce((a, r) => a + r, 0) / n;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (n - 1);
  const vol = Math.sqrt(variance * periodsPerYear);
  const annualMean = (1 + mean) ** periodsPerYear - 1;
  return { annualReturnPct: annualMean * 100, annualVolPct: vol * 100 };
}

export function toReturns(prices) {
  const out = [];
  for (let i = 1; i < prices.length; i += 1) {
    if (!(prices[i - 1] > 0)) throw Error("Price history must be positive.");
    out.push(prices[i] / prices[i - 1] - 1);
  }
  return out;
}

export function maxDrawdownPct(prices) {
  let peak = -Infinity;
  let worst = 0;
  for (const p of prices) {
    peak = Math.max(peak, p);
    worst = Math.min(worst, p / peak - 1);
  }
  return worst * 100;
}

// Six-month 90% probability range, expressed in percent.
export function sixMonthRange(annualReturnPct, annualVolPct) {
  const mu6 = (1 + annualReturnPct / 100) ** 0.5 - 1;
  const sigma6 = (annualVolPct / 100) / Math.SQRT2;
  return {
    downsidePct: (mu6 - Z95 * sigma6) * 100,
    upsidePct: (mu6 + Z95 * sigma6) * 100,
  };
}

export function annualRangeMidpointPct(downsidePct, upsidePct) {
  const mid = (downsidePct + upsidePct) / 200;
  return ((1 + mid) ** 2 - 1) * 100;
}

// Portfolio volatility from per-holding volatilities and a correlation matrix
// keyed by asset class. Used only when aligned price history is unavailable.
export function blendedVolPct(positions, correlation = DEFAULT_CORRELATION) {
  let variance = 0;
  for (const a of positions)
    for (const b of positions) {
      const rho =
        a === b ? 1 : (correlation[a.assetClass]?.[b.assetClass] ?? 0);
      variance += a.weight * b.weight * a.annualVolPct * b.annualVolPct * rho;
    }
  return Math.sqrt(Math.max(0, variance));
}

export const weightedBy = (positions, key) =>
  positions.reduce((sum, p) => sum + p.weight * (p[key] ?? 0), 0);

export function allocation(positions) {
  const buckets = Object.fromEntries(CLASSES.map((c) => [c, 0]));
  for (const p of positions) buckets[p.assetClass] += p.weight * 100;
  return CLASSES.map((name) => ({ name, percent: buckets[name] })).filter(
    (b) => b.percent > 0,
  );
}
