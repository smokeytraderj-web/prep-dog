import { SECTOR_ORDER, validateEquity } from './equity.js';

export const BENCHMARK_URL = 'https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf/latest-holdings.csv';
export const BENCHMARK_PAGE = 'https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf';
export const SECTOR_NAMES = {
  'Materials': 'Materials', 'Consumer Discretionary': 'Cons Discr',
  'Financials': 'Financial Svcs', 'Real Estate': 'REITs',
  'Communication': 'Comms Svcs', 'Communication Services': 'Comms Svcs',
  'Energy': 'Energy', 'Industrials': 'Industrials',
  'Information Technology': 'Info Tech', 'Consumer Staples': 'Cons Staples',
  'Health Care': 'Healthcare', 'Utilities': 'Utilities',
};
export const normalizeTicker = ticker => ticker.trim().toUpperCase().replace(/[./\s]+/g, '-');

// RFC 4180 quoting, including escaped quotes, commas and newlines in fields.
export function parseCsv(text, delimiter = ',') {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === delimiter && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (quoted) throw Error('The benchmark file is incomplete.');
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

export function parseBenchmark(csv, retrievedAt = new Date().toISOString()) {
  if (/^\s*</.test(csv)) throw Error('The provider returned a webpage instead of holdings.');
  const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
  const date = rows.find(r => r[0] === 'Fund Holdings as of')?.[1];
  const dateMatch = date?.match(/^([A-Za-z]{3}) (\d{1,2}), (\d{4})$/);
  const month = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ').indexOf(dateMatch?.[1]);
  if (!dateMatch || month < 0) throw Error('The provider did not supply a valid holdings date.');
  const asOf = `${dateMatch[3]}-${String(month + 1).padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
  if (new Date(asOf).getTime() > new Date(retrievedAt).getTime() + 86400000) throw Error('The benchmark date is in the future.');
  const header = rows.findIndex(r => r[0] === 'Ticker' && r.includes('Sector') && r.includes('Market Value'));
  if (header < 0) throw Error('The provider changed its holdings format.');
  const columns = rows[header];
  const at = (r, name) => r[columns.indexOf(name)];
  const constituents = rows.slice(header + 1).filter(r => at(r, 'Asset Class') === 'Equity').map(r => {
    const sector = SECTOR_NAMES[at(r, 'Sector')];
    const value = Number(at(r, 'Market Value')?.replace(/,/g, ''));
    const ticker = normalizeTicker(at(r, 'Ticker') || '');
    if (!sector || !ticker || !Number.isFinite(value) || value <= 0) throw Error('The provider returned incomplete equity classifications.');
    return { ticker, name: at(r, 'Name'), sector, value };
  });
  if (constituents.length < 450 || constituents.length > 550) throw Error('The benchmark does not contain a complete S&P 500 equity universe.');
  if (new Set(constituents.map(h => h.ticker)).size !== constituents.length) throw Error('Duplicate benchmark holdings were returned.');
  const total = constituents.reduce((n, h) => n + h.value, 0);
  const sectors = SECTOR_ORDER.map(name => ({name, weight: constituents.filter(h => h.sector === name).reduce((n, h) => n + h.value, 0) / total * 100}));
  if (sectors.some(s => s.weight <= 0)) throw Error('All 11 equity sectors are required.');
  return { asOf, retrievedAt, source: 'iShares IVV daily holdings', sourceUrl: BENCHMARK_PAGE,
    basis: 'IVV equity holdings, normalized to 100%; cash and derivatives excluded.',
    sectors, constituents: constituents.map(({value, ...h}) => ({...h, weight: value / total * 100})) };
}

export function comparePortfolio(holdings, snapshot) {
  const totals = Object.fromEntries(SECTOR_ORDER.map(n => [n, 0]));
  const map = new Map(snapshot.constituents.map(h => [h.ticker, h.sector]));
  const unmatched = []; let total = 0;
  for (const h of holdings) {
    const ticker = normalizeTicker(h.ticker); total += h.value;
    if (ticker === 'IVV') for (const s of snapshot.sectors) totals[s.name] += h.value * s.weight / 100;
    else if (map.has(ticker)) totals[map.get(ticker)] += h.value;
    else unmatched.push(h);
  }
  const coverage = total ? 100 * (total - unmatched.reduce((n, h) => n + h.value, 0)) / total : 0;
  if (unmatched.length || !total) return { data: null, unmatched, coverage };
  const data = validateEquity({title: 'Equity Sector Exposure', as_of: `Benchmark as of ${snapshot.asOf}`,
    portfolio_label: 'Your portfolio', benchmark_label: 'S&P 500 (IVV)', benchmark_short: 'S&P 500 (IVV proxy)',
    source_note: `Benchmark: iShares IVV equity holdings, ${snapshot.asOf}, normalized to 100%. Portfolio: supplied position values; classifications from IVV.`,
    sectors: SECTOR_ORDER.map(name => ({name, portfolio: totals[name] / total * 100, benchmark: snapshot.sectors.find(s => s.name === name).weight}))});
  return {data, unmatched, coverage};
}

export function isBenchmarkStale(snapshot, now = Date.now()) {
  // Allow weekends and normal publication lag, while exposing the provider date at all times.
  return now - Date.parse(`${snapshot.asOf}T23:59:59Z`) > 4 * 86400000;
}
