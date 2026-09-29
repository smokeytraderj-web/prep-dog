export const MARKET_INDEXES = [
  {id:'sp500', symbol:'^GSPC', label:'S&P 500', region:'U.S. large cap', proxy:false},
  {id:'nasdaq', symbol:'^IXIC', label:'Nasdaq Composite', region:'U.S. growth', proxy:false},
  {id:'emerging', symbol:'EEM', label:'MSCI Emerging Markets', region:'Emerging markets', proxy:true},
  {id:'msci', symbol:'EFA', label:'MSCI EAFE', region:'International developed', proxy:true},
];

const finite = value => typeof value === 'number' && Number.isFinite(value);

export function parseYahooChart(payload, definition, year = new Date().getUTCFullYear()) {
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const adjusted = result?.indicators?.adjclose?.[0]?.adjclose || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const points = timestamps.map((timestamp, index) => ({
    timestamp,
    value: finite(adjusted[index]) ? adjusted[index] : closes[index],
  })).filter(point => finite(point.timestamp) && finite(point.value) && point.value > 0);
  if (points.length < 2) throw Error(`Yahoo Finance returned insufficient data for ${definition.symbol}.`);
  const yearStart = Date.UTC(year, 0, 1) / 1000;
  const first = points.filter(point => point.timestamp < yearStart).at(-1);
  const currentPoints = points.filter(point => point.timestamp >= yearStart && point.timestamp < Date.UTC(year + 1, 0, 1) / 1000);
  if (!first || !currentPoints.length) throw Error(`Missing prior year-end close or current-year data for ${definition.symbol}.`);
  const last = currentPoints.at(-1);
  const firstValue = first.value;
  return {
    ...definition,
    return: ((last.value / first.value) - 1) * 100,
    startDate: new Date(first.timestamp * 1000).toISOString().slice(0, 10),
    endDate: new Date(last.timestamp * 1000).toISOString().slice(0, 10),
    points: [first, ...currentPoints].map(point => ({
      date: new Date(point.timestamp * 1000).toISOString().slice(0, 10),
      return: ((point.value / firstValue) - 1) * 100,
    })),
  };
}

export function emptyMarketSnapshot() {
  return {asOf:'', source:'', basis:'', indexes:MARKET_INDEXES.map(({id,label,region}) => ({id,label,region,return:''}))};
}

export function marketSnapshotFromYahoo(payloads, now = new Date()) {
  const indexes = MARKET_INDEXES.map(definition => parseYahooChart(payloads[definition.id], definition, now.getUTCFullYear()));
  const asOf = indexes.map(index => index.endDate).sort().at(-1);
  return {
    asOf,
    source:'Yahoo Finance historical chart data; EEM and EFA are ETF proxies for MSCI benchmarks.',
    basis:'YTD from prior year-end close. Price returns for indexes; adjusted-close returns for ETF proxies',
    indexes:indexes.map(({id,label,region,return:startReturn,startDate,endDate,symbol,proxy,points}) => ({id,label,region,return:startReturn,startDate,endDate,symbol,proxy,points})),
    retrievedAt:now.toISOString(),
  };
}
