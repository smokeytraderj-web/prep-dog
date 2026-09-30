// Builds the risk snapshot straight from the confirmed holdings, the way the
// equity slide builds sector exposure from them: asset class comes from the IVV
// constituent file, and return, volatility, covariance and drawdown come from
// aligned monthly price history. Nothing is uploaded.
//
// Measures that price history cannot supply -- dividend yield, expense ratio,
// tax drag, advisory fee, risk-free rate -- stay omitted rather than assumed,
// per the skill's rules. The slide footer discloses that.
import { buildSnapshot } from '../docs/slide-skills/risk-snapshot/scripts/model.mjs';
import { classifyHoldings, normalize } from './asset-class.js';
import { expenseRatioPct } from './fund-costs.js';
import { MIN_PERIODS, PERIODS_PER_YEAR } from './price-history.js';

const num = value => typeof value === 'number' && Number.isFinite(value);

export function buildRiskInput({holdings, benchmark, history, positions, asOf, client, label = 'Current portfolio'}) {
  if (!holdings?.length) throw Error('Confirm holdings before building the risk snapshot.');
  if (!history?.dates?.length || !history.series) throw Error('Price history is required to model this portfolio.');
  if (history.dates.length < MIN_PERIODS) throw Error('These holdings do not share enough overlapping monthly history to model together.');

  const {classified, unclassified} = classifyHoldings(holdings, benchmark, positions);
  const constituents = new Set((benchmark?.constituents || []).map(c => normalize(c.ticker)));
  // A fund with no published rate on file omits the measure for the whole
  // portfolio; the model already refuses to average a partial set.
  const expenses = classified.map(holding => expenseRatioPct(holding.ticker, constituents.has(normalize(holding.ticker))));
  const unpricedFunds = classified.filter((_, i) => expenses[i] == null).map(holding => holding.ticker);
  const missing = classified.filter(holding => {
    const series = history.series[normalize(holding.ticker)];
    return !Array.isArray(series) || series.length !== history.dates.length || series.some(price => !num(price) || price <= 0);
  });
  if (missing.length) throw Error(`No usable price history for ${missing.map(h => h.ticker).join(', ')}. Remove the position or supply a proxy ticker.`);

  return {
    input: {
      as_of: asOf,
      portfolio_label: label,
      client_label: client || null,
      periods_per_year: PERIODS_PER_YEAR,
      history_dates: history.dates,
      risk_free_pct: typeof history.risk_free_pct === 'number' && Number.isFinite(history.risk_free_pct) ? history.risk_free_pct : null,
      holdings: classified.map((holding, i) => {
        const yieldPct = history.yields?.[normalize(holding.ticker)];
        return {
          ticker: holding.ticker,
          value: holding.value,
          asset_class: holding.asset_class,
          history: history.series[normalize(holding.ticker)],
          // A fetched holding with no distribution in the window measured zero.
          ...(num(yieldPct) ? {yield_pct: yieldPct} : yieldPct === 0 ? {yield_pct: 0} : {}),
          ...(expenses[i] == null ? {} : {expense_ratio_pct: expenses[i]}),
        };
      }),
    },
    unclassified,
    unpricedFunds,
  };
}

export function createAutoRiskSnapshot(options) {
  const {input, unclassified, unpricedFunds} = buildRiskInput(options);
  const snapshot = buildSnapshot(input);
  const values = [snapshot.risk_score, snapshot.range.downside_pct, snapshot.range.upside_pct, snapshot.metrics.annual_volatility_pct];
  if (!values.every(num) || snapshot.range.downside_pct < -100)
    throw Error('The supplied price history produces an invalid modeled range. Review the holdings for an unusual position.');
  if (unclassified.length)
    snapshot.warnings = [...snapshot.warnings, `Grouped as other pending a sourced asset class: ${unclassified.join(', ')}.`];
  if (unpricedFunds.length)
    snapshot.warnings = [...snapshot.warnings, `Expense ratio omitted: no published rate on file for ${unpricedFunds.join(', ')}.`];
  snapshot.basis = {
    ...snapshot.basis,
    history_source: options.history.source || 'Yahoo Finance monthly adjusted closes',
    periods: input.history_dates.length,
    risk_free_source: options.history.risk_free_source || null,
    yield_basis: 'Trailing twelve-month distributions over the latest close.',
    expense_basis: 'Published net expense ratios; common stocks carry none.',
  };
  return snapshot;
}

export async function fetchRiskHistory(holdings, fetcher = fetch) {
  const symbols = [...new Set(holdings.map(holding => normalize(holding.ticker)))];
  const response = await fetcher(`/api/history?symbols=${encodeURIComponent(symbols.join(','))}`, {headers: {Accept: 'application/json'}});
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw Error(payload?.error || 'Price history is unavailable right now.');
  if (!payload?.dates?.length || !payload.series) throw Error('The price-history service returned an incomplete response.');
  return payload;
}
