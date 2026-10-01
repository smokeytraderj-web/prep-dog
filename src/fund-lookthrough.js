// Sector look-through for a fund, taken from the provider's own daily holdings
// file rather than asked of the advisor. iShares publishes one per product in
// the same format as the IVV benchmark file, so the same parser serves both.
import { parseCsv, normalizeTicker, SECTOR_NAMES } from './benchmark.js';
import { SECTOR_ORDER } from './equity.js';

export const ISHARES_ORIGIN = 'https://www.ishares.com';
export const ISHARES_SCREENER = `${ISHARES_ORIGIN}/us/product-screener/product-screener-v3.1.jsn`
  + '?dcrPath=/templatedata/config/product-screener-v3/data/en/us-ishares/ishares-product-screener-backend-config'
  + '&siteEntryPassthrough=true';

export const holdingsUrl = productPageUrl => `${ISHARES_ORIGIN}${productPageUrl}/latest-holdings.csv`;

// Asset classes whose funds hold securities with equity sectors. A bond,
// commodity or money-market fund has no equity sleeve by definition, so its
// holdings file is never fetched -- and a bullion trust does not publish one.
export const EQUITY_ASSET_CLASSES = new Set(['Equity', 'Real Estate']);

// {TICKER: {path, assetClass}} from the provider's own product list.
export function parseScreener(payload) {
  const index = {};
  for (const product of Object.values(payload || {})) {
    const ticker = normalizeTicker(product?.localExchangeTicker || '');
    const path = product?.productPageUrl;
    if (ticker && typeof path === 'string' && path.startsWith('/'))
      index[ticker] = {path, assetClass: product?.aladdinAssetClass || ''};
  }
  if (Object.keys(index).length < 100) throw Error('The fund list from the provider was incomplete.');
  return index;
}

// Equity sector weights for one fund, in percent, keyed by the app's sector
// names. A fund holding no equity returns null -- a bond or commodity sleeve
// has no equity sector exposure, which is different from an unknown one.
export function parseFundSectors(csv, symbol) {
  if (/^\s*</.test(csv)) throw Error(`${symbol}: the provider returned a webpage instead of holdings.`);
  const rows = parseCsv(csv.replace(/^﻿/, ''));
  // Equity funds head their table with Ticker, bond funds with Name, so the
  // table is found by the columns the look-through actually reads.
  const header = rows.findIndex(r => r.includes('Market Value') && r.includes('Asset Class'));
  if (header < 0) throw Error(`${symbol}: the provider changed its holdings format.`);
  const columns = rows[header];
  const asOf = rows.find(r => r[0] === 'Fund Holdings as of')?.[1] || null;
  // No Sector column means no equity sleeve to look through -- an absence, not
  // a broken file.
  if (!columns.includes('Sector')) return {symbol, asOf, sectors: null, equityShare: 0};
  const at = (row, name) => row[columns.indexOf(name)];

  const totals = Object.fromEntries(SECTOR_ORDER.map(name => [name, 0]));
  let equity = 0;
  let unmapped = 0;
  for (const row of rows.slice(header + 1)) {
    if (at(row, 'Asset Class') !== 'Equity') continue;
    const value = Number(String(at(row, 'Market Value') ?? '').replace(/,/g, ''));
    if (!Number.isFinite(value) || value <= 0) continue;
    const sector = SECTOR_NAMES[at(row, 'Sector')];
    if (!sector) { unmapped += value; continue; }
    totals[sector] += value;
    equity += value;
  }
  if (equity <= 0) return {symbol, asOf, sectors: null, equityShare: 0};
  // Weights are of the fund's classified equity, so they total 100 and can be
  // applied to whatever share of the position is equity.
  return {
    symbol,
    asOf,
    sectors: Object.fromEntries(SECTOR_ORDER.map(name => [name, totals[name] / equity * 100])),
    unmappedShare: unmapped / (equity + unmapped) * 100,
  };
}
