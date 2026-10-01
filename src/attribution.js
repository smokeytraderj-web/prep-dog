// Per-position contribution to the portfolio's year-to-date return.
//
// The naive version of this is weight x return, where weight is today's weight.
// That is wrong, and wrong in a direction that flatters winners: a position
// that doubled carries a larger weight today than it did on January 1st, so
// multiplying by today's weight overstates what it contributed.
//
// Given a position's current value V and its YTD return r, its value at the
// start of the year was V / (1 + r). So:
//
//   gain_i  = V_i - V_i / (1 + r_i)
//   start   = sum of V_i / (1 + r_i)
//   contrib = gain_i / start
//
// Those contributions sum exactly to the portfolio's own YTD return, which is
// the property that makes an attribution table an attribution table rather than
// a list of numbers that nearly add up.
//
// This holds only for a position held unchanged all year. A position bought or
// sold mid-year breaks it, and nothing in a holdings file says which those are,
// so the slide discloses the assumption rather than hiding it.

// A return at or below -100% would put the start value at or below zero.
const usable = r => Number.isFinite(r) && r > -99.999;

export function computeAttribution(holdings, returns) {
  const rows = [];
  const unpriced = [];
  for (const holding of holdings) {
    const value = Number(holding.value);
    const ret = returns?.[holding.ticker];
    if (!Number.isFinite(value) || value <= 0) continue;
    if (!usable(ret)) { unpriced.push(holding.ticker); continue; }
    const start = value / (1 + ret / 100);
    rows.push({
      ticker: holding.ticker,
      name: holding.securityName || holding.name || '',
      value,
      start,
      ytdReturn: ret,
      gain: value - start,
    });
  }
  const startTotal = rows.reduce((n, row) => n + row.start, 0);
  const gainTotal = rows.reduce((n, row) => n + row.gain, 0);
  const priced = rows.map(row => ({
    ...row,
    contribution: startTotal > 0 ? (row.gain / startTotal) * 100 : 0,
    weight: startTotal > 0 ? (row.start / startTotal) * 100 : 0,
  })).sort((a, b) => b.contribution - a.contribution);

  return {
    rows: priced,
    // The portfolio return these contributions sum to, by construction.
    portfolioReturn: startTotal > 0 ? (gainTotal / startTotal) * 100 : 0,
    startTotal,
    gainTotal,
    unpriced,
    // Share of today's value the table actually covers, so a slide can say so
    // when some positions have no price history.
    coverage: coverageOf(holdings, priced),
  };
}

function coverageOf(holdings, rows) {
  const total = holdings.reduce((n, h) => n + (Number(h.value) > 0 ? Number(h.value) : 0), 0);
  if (!total) return 0;
  return (rows.reduce((n, row) => n + row.value, 0) / total) * 100;
}

// The ends of the ranked list: what carried the portfolio and what held it back.
export function contributors(result, count = 5) {
  const positive = result.rows.filter(row => row.contribution > 0).slice(0, count);
  const negative = result.rows.filter(row => row.contribution < 0).slice(-count).reverse();
  return {positive, negative};
}
