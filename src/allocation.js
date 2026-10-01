// Overall asset allocation, and performance by asset class.
//
// The firm's deck splits equity into domestic and international rather than
// showing one "Equities" number, so the class a position lands in depends on
// both its asset class and its region. Both columns come from the holdings
// file; neither is inferred from a ticker, so a file without a region column
// reports plain "Equity" instead of guessing which half of the world a holding
// sits in.

export const CLASS_ORDER = [
  'Domestic Equity',
  'International Equity',
  'Equity',
  'Fixed Income',
  'Alternative',
  'Cash and Equivalents',
];

const DOMESTIC = /\b(u\.?s\.?|usa|united states|domestic|north america)\b/i;
const INTERNATIONAL = /\b(international|developed|emerging|ex-?us|ex-?u\.?s\.?|eafe|global|europe|asia|japan|pacific)\b/i;

// Order matters: "municipal bond" must reach fixed income before "muni" can be
// read as anything else, and cash must be tested before equity so a "cash
// equivalent ETF" is not filed as a stock.
export function allocationClass(assetClass, region) {
  const a = String(assetClass || '').toLowerCase().trim();
  if (!a) return 'Unclassified';
  if (/cash|money market|\bcd\b|certificate/.test(a)) return 'Cash and Equivalents';
  if (/fixed|bond|treas|municipal|muni|credit|debt/.test(a)) return 'Fixed Income';
  if (/alternative|commodit|gold|real estate|reit|infrastructure|hedge|private/.test(a)) return 'Alternative';
  if (/equity|stock|common|preferred|large cap|small cap|mid cap/.test(a)) {
    const r = String(region || '').trim();
    if (!r) return 'Equity';
    if (INTERNATIONAL.test(r)) return 'International Equity';
    if (DOMESTIC.test(r)) return 'Domestic Equity';
    return 'Equity';
  }
  return 'Alternative';
}

function rank(name) {
  const i = CLASS_ORDER.indexOf(name);
  return i === -1 ? CLASS_ORDER.length : i;
}

export function allocationRows(positions) {
  const groups = new Map();
  let total = 0;
  for (const p of positions || []) {
    const value = Number(p.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    const name = allocationClass(p.assetClass, p.region);
    groups.set(name, (groups.get(name) || 0) + value);
    total += value;
  }
  const rows = [...groups.entries()]
    .map(([name, value]) => ({ name, value, percent: total > 0 ? (value / total) * 100 : 0 }))
    .sort((a, b) => rank(a.name) - rank(b.name) || b.value - a.value);
  return { rows, total };
}

// The sentence under the table in the firm's own deck. It restates the table
// rather than interpreting it, so there is nothing here that the figures above
// it do not already say.
export function allocationNote({ rows, total }) {
  if (!total || !rows.length) return '';
  const pct = name => rows.find(r => r.name === name)?.percent || 0;
  const equity = pct('Domestic Equity') + pct('International Equity') + pct('Equity');
  const fixed = pct('Fixed Income');
  if (equity <= 0) return '';
  const split = pct('Domestic Equity') > 0 && pct('International Equity') > 0
    ? ` (domestic ${pct('Domestic Equity').toFixed(2)}%, international ${pct('International Equity').toFixed(2)}%)`
    : '';
  const balance = fixed > 0 ? `, balanced by a ${fixed.toFixed(2)}% fixed income allocation` : '';
  return `Equity exposure totals ${equity.toFixed(2)}%${split}${balance}.`;
}

// Performance by asset class, on the same start-value basis as the per-position
// attribution: a class's return is its total gain over what it was worth at the
// start of the year, never an average of its holdings' returns, which would
// weight a $5,000 position the same as a $500,000 one.
export function assetClassPerformance(positions, returns) {
  const groups = new Map();
  const unpriced = [];
  let covered = 0, supplied = 0;
  for (const p of positions || []) {
    const value = Number(p.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    supplied += value;
    const ret = returns?.[p.ticker];
    if (!Number.isFinite(ret) || ret <= -99.999) { unpriced.push(p.ticker); continue; }
    const start = value / (1 + ret / 100);
    const name = allocationClass(p.assetClass, p.region);
    const g = groups.get(name) || { name, value: 0, start: 0 };
    g.value += value; g.start += start;
    groups.set(name, g);
    covered += value;
  }
  const rows = [...groups.values()]
    .map(g => ({ ...g, gain: g.value - g.start, ytdReturn: g.start > 0 ? ((g.value - g.start) / g.start) * 100 : 0 }))
    .sort((a, b) => b.ytdReturn - a.ytdReturn);
  const start = rows.reduce((n, r) => n + r.start, 0);
  const gain = rows.reduce((n, r) => n + r.gain, 0);
  return {
    rows,
    portfolioReturn: start > 0 ? (gain / start) * 100 : 0,
    unpriced,
    coverage: supplied > 0 ? (covered / supplied) * 100 : 0,
  };
}
