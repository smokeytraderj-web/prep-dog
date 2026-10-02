// A benchmark built to the client's own mix.
//
// Comparing a 56/32/12 portfolio with the S&P 500 is the comparison every
// client can see is unfair, in both directions: it flatters a stock-heavy book
// in a bond year and buries a balanced one in an equity year. The honest
// comparison is against a portfolio built the way theirs is -- their own asset
// class weights, each priced at that class's index.
//
// What the app cannot map, it does not guess. Alternatives have no free index
// proxy, cash has no board, and an equity sleeve whose region was never
// supplied could be either index, so all three stay out of the blend and out of
// the portfolio side of the comparison. The slide reports how much of the book
// the comparison therefore covers, the same way the equity slide reports its
// classification coverage.

export const BENCHMARK_PROXIES = [
  {className: 'Domestic Equity', board: 'indexes', id: 'sp500'},
  {className: 'International Equity', board: 'indexes', id: 'msci'},
  {className: 'Fixed Income', board: 'fixed-income', id: 'aggregate'},
];

const finite = n => typeof n === 'number' && Number.isFinite(n);

function proxyReturn(proxy, boards) {
  const index = boards?.[proxy.board]?.indexes?.find(entry => entry.id === proxy.id);
  if (!index || !finite(Number(index.return))) return null;
  return {label: index.label, symbol: index.symbol, return: Number(index.return)};
}

/**
 * @param classRows rows from assetClassPerformance: {name, start, value, ytdReturn}
 * @param boards    {indexes, 'fixed-income'} as the market service returns them
 */
export function blendedBenchmark(classRows = [], boards = {}) {
  const rows = [];
  let covered = 0, supplied = 0;
  for (const row of classRows) {
    const start = Number(row.start);
    if (!finite(start) || start <= 0) continue;
    supplied += start;
    const proxy = BENCHMARK_PROXIES.find(p => p.className === row.name);
    const index = proxy && proxyReturn(proxy, boards);
    if (!index) continue;
    covered += start;
    rows.push({
      name: row.name,
      start,
      portfolioReturn: Number(row.ytdReturn),
      benchmarkReturn: index.return,
      benchmarkLabel: index.label,
      benchmarkSymbol: index.symbol,
      difference: Number(row.ytdReturn) - index.return,
    });
  }
  if (!rows.length || covered <= 0) return null;
  // Weighted on start-of-year value, which is what an allocation to a benchmark
  // would have been set at, and the same base the class returns are measured on.
  const weigh = pick => rows.reduce((total, row) => total + (row.start / covered) * pick(row), 0);
  const portfolioReturn = weigh(row => row.portfolioReturn);
  const benchmarkReturn = weigh(row => row.benchmarkReturn);
  return {
    rows: rows.map(row => ({...row, weight: (row.start / covered) * 100})).sort((a, b) => b.weight - a.weight),
    portfolioReturn,
    benchmarkReturn,
    difference: portfolioReturn - benchmarkReturn,
    // Share of the priced book this comparison speaks for.
    coverage: (covered / supplied) * 100,
    excluded: classRows
      .filter(row => finite(Number(row.start)) && Number(row.start) > 0)
      .filter(row => !BENCHMARK_PROXIES.some(p => p.className === row.name))
      .map(row => row.name),
  };
}
