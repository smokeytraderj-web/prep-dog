// Asset class for the risk model's allocation bar. Equities come from the IVV
// constituent file the app already fetches daily; funds that are not equity
// constituents are matched against this table. An unmatched ticker becomes
// "other" and is named in a warning -- never guessed into stocks or bonds.
//
// With aligned price history the model derives volatility and covariance from
// the blended series, so asset_class drives the allocation display only, not
// the risk figures.
export const FUND_CLASSES = {
  // Equity funds are not constituents of the index they track, so they need
  // their own list -- without it a plain S&P 500 ETF would fall through to
  // "other" and understate the book's equity weight.
  stocks: ['IVV','VOO','SPY','SPLG','SPTM','VTI','ITOT','SCHB','SCHX','QQQ','QQQM','DIA','IWM','IWB','IWF','IWD','IJH','IJR','MDY','VO','VB','RSP','SPYG','SPYV','SPYD','IVW','IVE','VXUS','VEA','VWO','IEFA','IEMG','EFA','EEM','ACWI','ACWX','VEU','VT','SCHF','SCHE','SPDW','SPEM','VGK','VPL','EWJ','MCHI','FXI','INDA','EWZ','EWY','EWT','VGT','VHT','VFH','VDE','VIS','VDC','VCR','VAW','VOX','VPU','XLK','XLF','XLV','XLE','XLI','XLY','XLP','XLU','XLB','XLC','VIG','VYM','SCHD','DGRO','NOBL','HDV','DVY','SDY','VUG','VTV','MTUM','QUAL','USMV','VLUE','SIZE','MOAT'],
  bonds: ['AGG','BND','BNDX','BIV','BSV','BLV','VCIT','VCSH','VCLT','VGIT','VGSH','VGLT','VTEB','MUB','TFI','SUB','SHM','LQD','HYG','JNK','SHYG','USHY','EMB','PCY','TIP','VTIP','SCHP','STIP','IEF','TLT','SHY','IEI','TLH','GOVT','SPTL','SPTS','SPAB','FBND','TOTL','BOND','PTTRX','ANGL','SRLN','BKLN','FLOT','IGSB','IGIB','NEAR','ICSH','JPST','MINT','SPSB','SPIB','SPHY','HYD','NUV','PZA','ITM','BAB','MBB','VMBS','GNMA','CMBS','SJNK','SHYD','FMB','EMLC','LEMB','IBND','BWX','IGOV','WIP','ISTB','IUSB','SCHZ','SCHR','SCHO','SCHQ','FIXD','AVIG','AVSF'],
  cash: ['BIL','SGOV','SHV','USFR','TBIL','CLIP','XHLF','GBIL','TFLO','VUSXX','SPAXX','FDRXX','SWVXX','VMFXX','FZDXX','SNSXX','SNVXX','CASH','USD'],
  other: ['GLD','IAU','SLV','GLDM','SGOL','PPLT','PALL','DBC','PDBC','GSG','DJP','COMT','BCI','FTGC','USO','UNG','VNQ','VNQI','SCHH','IYR','RWR','XLRE','REET','RWX','ICF','BTC','IBIT','FBTC','GBTC','ETHE','BITO','ARKB','BRRR','HODL','EZBC','BTCO','MSTY','PSP','BIZD','MLPA','AMLP','MLPX','ALTY','QAI','MNA','BTAL','TAIL','VIXY','SVXY','UUP','FXE','FXY','FXB','CEW','DBA','CORN','WEAT','SOYB','CPER','JJC','REMX','LIT','URA','PICK','WOOD','MOO'],
};

const LOOKUP = new Map();
for (const [assetClass, tickers] of Object.entries(FUND_CLASSES))
  for (const ticker of tickers) LOOKUP.set(ticker, assetClass);

export const normalize = ticker => String(ticker || '').trim().toUpperCase().replace(/[./\s]+/g, '-');

// Money-market and cash sweep symbols the custodians emit, beyond the table above.
const CASH_PATTERN = /^(CASH|USD|MMF|SWEEP|MONEY[-_]?MARKET)$/;

export function classifyHolding(ticker, constituentTickers) {
  const symbol = normalize(ticker);
  if (CASH_PATTERN.test(symbol)) return 'cash';
  if (constituentTickers?.has(symbol)) return 'stocks';
  return LOOKUP.get(symbol) || 'other';
}

// An asset class the user supplied in an imported holdings file outranks any
// lookup: it is sourced, the table is not.
export function suppliedClass(positions, ticker) {
  const matches = (positions || []).filter(position => normalize(position.ticker) === normalize(ticker));
  const labels = new Set(matches.map(position => String(position.assetClass || '').trim().toLowerCase()).filter(Boolean));
  if (labels.size !== 1) return '';
  const [label] = [...labels];
  if (/^(stock|stocks|equity|equities)$/.test(label)) return 'stocks';
  if (/^(bond|bonds|fixed income)$/.test(label)) return 'bonds';
  if (label === 'cash' || label === 'other') return label;
  return '';
}

// Returns {classified:[{ticker, asset_class}], unclassified:[ticker]}
export function classifyHoldings(holdings, benchmark, positions) {
  const constituentTickers = new Set((benchmark?.constituents || []).map(c => normalize(c.ticker)));
  const unclassified = [];
  const classified = holdings.map(holding => {
    const supplied = suppliedClass(positions, holding.ticker);
    if (supplied) return {...holding, asset_class: supplied};
    const symbol = normalize(holding.ticker);
    const known = CASH_PATTERN.test(symbol) || constituentTickers.has(symbol) || LOOKUP.has(symbol);
    if (!known) unclassified.push(holding.ticker);
    return {...holding, asset_class: classifyHolding(holding.ticker, constituentTickers)};
  });
  return {classified, unclassified};
}

// Region for the attribution slide. The market snapshot's own region labels are
// the only ones that slide can match, so these are exactly those strings. An
// individual equity in the benchmark is U.S. large cap; everything else has to
// be listed or it stays unmapped rather than being guessed from a ticker.
export const FUND_REGIONS = {
  'U.S. large cap': ['IVV','VOO','SPY','SPLG','SPTM','VTI','ITOT','SCHB','SCHX','DIA','IWM','IWB','IWD','IJH','IJR','MDY','VO','VB','RSP','SPYV','IVE','VTV','VYM','SCHD','DGRO','NOBL','HDV','DVY','SDY','USMV','VLUE'],
  'U.S. growth': ['QQQ','QQQM','IWF','VUG','SPYG','IVW','MTUM','VGT','XLK'],
  'International developed': ['VEA','IEFA','EFA','SCHF','SPDW','VGK','VPL','EWJ','IDEV','EFG','EFV'],
  'Emerging markets': ['VWO','IEMG','EEM','SCHE','SPEM','MCHI','FXI','INDA','EWZ','EWY','EWT'],
};
const REGION_LOOKUP = new Map();
for (const [region, tickers] of Object.entries(FUND_REGIONS))
  for (const ticker of tickers) REGION_LOOKUP.set(ticker, region);

export function classifyRegion(ticker, constituentTickers) {
  const symbol = normalize(ticker);
  if (REGION_LOOKUP.has(symbol)) return REGION_LOOKUP.get(symbol);
  if (constituentTickers?.has(symbol)) return 'U.S. large cap';
  return '';
}

// Fills in asset class and region for positions that arrived without them, so a
// pasted list still drives the account and regional slides. A supplied value
// always wins, and anything that cannot be resolved is left blank rather than
// guessed, which is what keeps those slides honest about coverage.
export function enrichPositions(positions, benchmark) {
  const constituents = new Set((benchmark?.constituents || []).map(c => normalize(c.ticker)));
  const CLASS_LABELS = {stocks: 'Equity', bonds: 'Fixed income', cash: 'Cash', other: 'Other'};
  return (positions || []).map(position => {
    const next = {...position};
    if (!String(position.assetClass || '').trim()) {
      const symbol = normalize(position.ticker);
      const known = CASH_PATTERN.test(symbol) || constituents.has(symbol) || LOOKUP.has(symbol);
      if (known) next.assetClass = CLASS_LABELS[classifyHolding(position.ticker, constituents)];
    }
    if (!String(position.region || '').trim()) {
      const region = classifyRegion(position.ticker, constituents);
      if (region) next.region = region;
    }
    return next;
  });
}
