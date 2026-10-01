// S&P 500 index-level earnings per share.
//
// Unlike every other number in this deck, these are NOT fetched. Index EPS
// actuals and forward estimates are licensed data (S&P, FactSet, LSEG); the
// free Yahoo chart endpoint the rest of the app uses carries prices and
// dividends only, not index earnings. So this table is maintained by hand and
// the slide prints `asOf` and `source` so the figures are never mistaken for a
// live feed.
//
// Update the table and `asOf` together. `kind` drives the chart: 'Actual' bars
// are solid, 'Estimate' bars are tinted, and the growth callouts are computed
// from the series rather than typed, so they cannot disagree with the bars.
export const SP500_EARNINGS = {
  asOf: '2026-07-31',
  source: 'S&P 500 operating earnings per share. Actuals as reported; forward years are consensus estimates.',
  note: 'Estimates may change. Reported and estimated periods are shown separately.',
  series: [
    {period: '2019', eps: 160, kind: 'Actual'},
    {period: '2020', eps: 143, kind: 'Actual'},
    {period: '2021', eps: 212, kind: 'Actual'},
    {period: '2022', eps: 220, kind: 'Actual'},
    {period: '2023', eps: 222, kind: 'Actual'},
    {period: '2024', eps: 247, kind: 'Actual'},
    {period: '2025', eps: 280, kind: 'Actual'},
    {period: '2026E', eps: 355, kind: 'Estimate'},
    {period: '2027E', eps: 405, kind: 'Estimate'},
  ],
  points: [
    'Q1 earnings grew +29% year over year, the strongest growth since 2021. Q2 earnings are on track to grow +47% year over year.',
    'Earnings are expected to grow +27% in 2026 and +14% in 2027.',
  ],
};

// Growth between consecutive periods, so a callout can never contradict the
// bars it sits above. `from` is the index the arrow starts at.
export function earningsGrowth(series, count = 3) {
  const steps = series.slice(1).map((entry, i) => ({
    from: i,
    to: i + 1,
    growth: (entry.eps / series[i].eps - 1) * 100,
  }));
  return steps.slice(-count);
}
