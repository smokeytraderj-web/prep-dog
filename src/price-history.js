// Monthly adjusted closes for arbitrary holdings, aligned onto shared dates so the
// risk model can build a real blended portfolio series instead of falling back to
// the documented class-correlation assumptions. Mirrors market-indexes.js, which
// reads the same Yahoo chart payload for the index slide.
const finite = value => typeof value === 'number' && Number.isFinite(value);

export const HISTORY_RANGE = '5y';
export const DAYS_PER_YEAR = 365;
export const HISTORY_INTERVAL = '1mo';
export const PERIODS_PER_YEAR = 12;
// Enough periods for a usable volatility and drawdown estimate.
export const MIN_PERIODS = 24;
export const MAX_SYMBOLS = 60;

// Yahoo uses dashes where the holdings parser and the iShares file may use dots.
export const historySymbol = ticker => ticker.trim().toUpperCase().replace(/[./\s]+/g, '-');

export function validSymbol(ticker) {
  return typeof ticker === 'string' && /^[A-Z][A-Z0-9^-]{0,14}$/.test(historySymbol(ticker));
}

// Trailing-twelve-month distributions over the latest unadjusted close. A
// successful fetch that carries no dividend in the window means the holding
// paid none, which is a measured zero rather than a missing value -- adjusted
// closes are dividend-adjusted, so the raw close is the correct denominator.
export function trailingYieldPct(payload, asOfSeconds = Date.now() / 1000) {
  const result = payload?.chart?.result?.[0];
  if (!result) return null;
  const closes = (result.indicators?.quote?.[0]?.close || []).filter(price => finite(price) && price > 0);
  const price = closes.at(-1);
  if (!finite(price) || price <= 0) return null;
  const events = Object.values(result.events?.dividends || {});
  const cutoff = asOfSeconds - DAYS_PER_YEAR * 86400;
  const paid = events
    .filter(event => finite(event?.date) && event.date > cutoff && finite(event?.amount) && event.amount >= 0)
    .reduce((sum, event) => sum + event.amount, 0);
  return (paid / price) * 100;
}

export function parseYahooHistory(payload, symbol) {
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const adjusted = result?.indicators?.adjclose?.[0]?.adjclose || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const points = timestamps.map((timestamp, index) => ({
    timestamp,
    close: finite(adjusted[index]) ? adjusted[index] : closes[index],
  })).filter(point => finite(point.timestamp) && finite(point.close) && point.close > 0);
  if (points.length < MIN_PERIODS) throw Error(`Yahoo Finance returned too little price history for ${symbol}.`);
  const seen = new Set();
  const series = [];
  for (const point of points) {
    // Monthly bars are stamped at the period start; keep one close per month.
    const date = new Date(point.timestamp * 1000).toISOString().slice(0, 7);
    if (seen.has(date)) series[series.length - 1] = {date, close: point.close};
    else {seen.add(date); series.push({date, close: point.close});}
  }
  return {symbol, series, yield_pct: trailingYieldPct(payload)};
}

// Intersect on the dates every holding shares. The model only takes the aligned
// path when every history has the same length, so a partial overlap is dropped
// rather than silently padded.
export function alignHistories(histories, asOf) {
  if (!histories.length) return null;
  const shared = histories
    .map(history => new Set(history.series.map(point => point.date)))
    .reduce((a, b) => new Set([...a].filter(date => b.has(date))));
  const dates = [...shared].sort().filter(date => !asOf || date <= asOf.slice(0, 7));
  if (dates.length < MIN_PERIODS) return null;
  return {
    // The model validates history_dates as full YYYY-MM-DD through as_of.
    dates: dates.map(date => `${date}-01`),
    series: Object.fromEntries(histories.map(history => {
      const byDate = new Map(history.series.map(point => [point.date, point.close]));
      return [history.symbol, dates.map(date => byDate.get(date))];
    })),
    yields: Object.fromEntries(histories.map(history => [history.symbol, history.yield_pct])),
  };
}
