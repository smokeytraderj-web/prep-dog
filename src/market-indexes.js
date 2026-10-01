export const MARKET_INDEXES = [
  {id:'sp500', symbol:'^GSPC', label:'S&P 500', region:'U.S. large cap', proxy:false},
  {id:'nasdaq', symbol:'^IXIC', label:'Nasdaq Composite', region:'U.S. growth', proxy:false},
  {id:'emerging', symbol:'EEM', label:'MSCI Emerging Markets', region:'Emerging markets', proxy:true},
  {id:'msci', symbol:'EFA', label:'MSCI EAFE', region:'International developed', proxy:true},
];

// The fixed income board mirrors the equity one: four sleeves an advisor would
// actually talk through, each an ETF proxy because the underlying bond indexes
// are not freely quoted.
export const FIXED_INCOME_INDEXES = [
  {id:'aggregate', symbol:'AGG', label:'U.S. Aggregate Bond', region:'Core taxable', proxy:true},
  {id:'treasury', symbol:'IEF', label:'7-10 Year Treasury', region:'Treasuries', proxy:true},
  {id:'corporate', symbol:'LQD', label:'Investment Grade Corporate', region:'Corporate credit', proxy:true},
  {id:'municipal', symbol:'MUB', label:'Municipal Bond', region:'Municipals', proxy:true},
];

// The eleven GICS sectors, as the sector SPDRs. Returns are adjusted-close, so
// they are total returns including distributions, not price returns.
export const SECTOR_INDEXES = [
  {id:'materials', symbol:'XLB', label:'Materials', region:'Materials', proxy:true},
  {id:'discretionary', symbol:'XLY', label:'Cons. Disc.', region:'Consumer Discretionary', proxy:true},
  {id:'financials', symbol:'XLF', label:'Financials', region:'Financials', proxy:true},
  {id:'realestate', symbol:'XLRE', label:'Real Estate', region:'Real Estate', proxy:true},
  {id:'communication', symbol:'XLC', label:'Comm. Services', region:'Communication Services', proxy:true},
  {id:'energy', symbol:'XLE', label:'Energy', region:'Energy', proxy:true},
  {id:'industrials', symbol:'XLI', label:'Industrials', region:'Industrials', proxy:true},
  {id:'technology', symbol:'XLK', label:'Info. Tech', region:'Information Technology', proxy:true},
  {id:'staples', symbol:'XLP', label:'Cons. Staples', region:'Consumer Staples', proxy:true},
  {id:'healthcare', symbol:'XLV', label:'Health Care', region:'Health Care', proxy:true},
  {id:'utilities', symbol:'XLU', label:'Utilities', region:'Utilities', proxy:true},
];

// Each board is one request to /api/market/ytd?board=<key>, parsed by the same
// code. `source` and `basis` travel with the board so every slide can print the
// provenance of the numbers it shows rather than a generic line.
export const BOARDS = {
  indexes: {
    definitions: MARKET_INDEXES,
    source: 'Yahoo Finance historical chart data; EEM and EFA are ETF proxies for MSCI benchmarks.',
    basis: 'YTD from prior year-end close. Price returns for indexes; adjusted-close returns for ETF proxies',
  },
  'fixed-income': {
    definitions: FIXED_INCOME_INDEXES,
    source: 'Yahoo Finance historical chart data. AGG, IEF, LQD and MUB are ETF proxies for their bond market segments.',
    basis: 'YTD from prior year-end close. Adjusted-close total returns, so coupon income is included',
  },
  sectors: {
    definitions: SECTOR_INDEXES,
    source: 'Yahoo Finance historical chart data. The Select Sector SPDR funds are proxies for the eleven S&P 500 GICS sectors.',
    basis: 'YTD from prior year-end close. Adjusted-close total returns, so distributions are included',
  },
};
export const boardFor = key => BOARDS[key] || BOARDS.indexes;

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

export function marketSnapshotFromYahoo(payloads, now = new Date(), boardKey = 'indexes', explicit = null) {
  const board = explicit || boardFor(boardKey);
  const indexes = board.definitions.map(definition => parseYahooChart(payloads[definition.id], definition, now.getUTCFullYear()));
  const asOf = indexes.map(index => index.endDate).sort().at(-1);
  return {
    asOf,
    board: boardKey,
    source: board.source,
    basis: board.basis,
    indexes:indexes.map(({id,label,region,return:startReturn,startDate,endDate,symbol,proxy,points}) => ({id,label,region,return:startReturn,startDate,endDate,symbol,proxy,points})),
    retrievedAt:now.toISOString(),
  };
}
