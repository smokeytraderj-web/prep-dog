// What the portfolio pays, and what it costs to hold.
//
// Both figures already exist inside the risk snapshot and neither has ever
// reached a slide: the published yield and expense ratio of every holding, and
// the weighted figures the model builds from them. A client with two million
// dollars asks what it throws off and what they are paying long before they ask
// about annualised volatility.
//
// These are estimates from published rates, not distributions actually received
// or fees actually billed, and the slide says so. The advisory fee is the one
// number the app cannot know, so it is typed on the slide and left out of the
// total until it is.

const finite = n => typeof n === 'number' && Number.isFinite(n);
const rate = n => (finite(n) && n >= 0 && n < 100 ? n : null);

export function incomeAndCost(snapshot, advisoryFeePct = null) {
  const holdings = snapshot?.model_input?.holdings || [];
  const total = Number(snapshot?.total_value);
  if (!finite(total) || total <= 0 || !holdings.length) return null;

  const rows = [];
  let income = 0, incomeBase = 0, fundCost = 0, fundCostBase = 0;
  for (const holding of holdings) {
    const value = Number(holding.value);
    if (!finite(value) || value <= 0) continue;
    const yieldPct = rate(holding.yield_pct);
    const expense = rate(holding.expense_ratio_pct);
    if (yieldPct !== null) { income += value * (yieldPct / 100); incomeBase += value; }
    if (expense !== null) { fundCost += value * (expense / 100); fundCostBase += value; }
    if (yieldPct !== null || expense !== null) {
      rows.push({
        ticker: holding.ticker,
        name: holding.name || holding.ticker,
        value,
        yieldPct,
        expensePct: expense,
        income: yieldPct === null ? null : value * (yieldPct / 100),
      });
    }
  }
  if (!incomeBase && !fundCostBase) return null;

  const advisory = rate(advisoryFeePct);
  const advisoryValue = advisory === null ? null : total * (advisory / 100);
  const costPct = (fundCostBase ? (fundCost / fundCostBase) * 100 : 0) + (advisory || 0);
  return {
    total,
    annualIncome: incomeBase ? income : null,
    // Yield on the positions a rate was published for, not on the whole book:
    // dividing by the total would read every unrated position as yielding zero.
    yieldPct: incomeBase ? (income / incomeBase) * 100 : null,
    incomeCoverage: (incomeBase / total) * 100,
    fundCostPct: fundCostBase ? (fundCost / fundCostBase) * 100 : null,
    fundCostValue: fundCostBase ? fundCost : null,
    costCoverage: (fundCostBase / total) * 100,
    advisoryPct: advisory,
    advisoryValue,
    totalCostPct: costPct,
    totalCostValue: fundCost + (advisoryValue || 0),
    netIncome: incomeBase ? income - fundCost - (advisoryValue || 0) : null,
    taxDragPct: rate(snapshot?.costs?.est_tax_drag_pct),
    rows: rows.sort((a, b) => (b.income || 0) - (a.income || 0)),
  };
}
