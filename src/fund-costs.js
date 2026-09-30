// Published net expense ratios, in percent, for the funds the fund-class table
// covers. These are the providers' stated annual figures; they move rarely, but
// they are a maintained list, not live data -- check a rate before it goes on a
// client deck if the fund has recently changed its fee.
//
// A common stock has no fund expense, so an equity identified from the IVV
// constituent file is a measured 0 rather than an assumption. A fund that is not
// listed here has no rate, which omits the measure for the whole portfolio
// rather than guessing one.
//
// Sourced from provider fact sheets, 2026-09.
export const EXPENSE_RATIOS = {
  // Broad equity
  IVV: 0.03, VOO: 0.03, SPY: 0.0945, VTI: 0.03, ITOT: 0.03, SCHB: 0.03,
  QQQ: 0.20, QQQM: 0.15, DIA: 0.16, IWM: 0.19, IJH: 0.05, IJR: 0.06,
  VXUS: 0.05, VEA: 0.03, VWO: 0.07, IEFA: 0.07, IEMG: 0.09, EFA: 0.33, EEM: 0.70,
  VGT: 0.09, VIG: 0.05, VYM: 0.06, SCHD: 0.06, DGRO: 0.08, VUG: 0.04, VTV: 0.04,
  // Sector
  XLK: 0.09, XLF: 0.09, XLV: 0.09, XLE: 0.09, XLI: 0.09, XLY: 0.09,
  XLP: 0.09, XLU: 0.09, XLB: 0.09, XLC: 0.09, XLRE: 0.09,
  // Core bonds
  AGG: 0.03, BND: 0.03, BNDX: 0.07, BIV: 0.03, BSV: 0.03, BLV: 0.03,
  VCIT: 0.03, VCSH: 0.03, VCLT: 0.03, VGIT: 0.03, VGSH: 0.03, VGLT: 0.03,
  LQD: 0.14, HYG: 0.49, JNK: 0.40, USHY: 0.08, SHYG: 0.30, EMB: 0.39,
  TIP: 0.18, VTIP: 0.03, SCHP: 0.03, STIP: 0.03,
  IEF: 0.15, TLT: 0.15, SHY: 0.15, IEI: 0.15, TLH: 0.15, GOVT: 0.05,
  MBB: 0.04, VMBS: 0.03, IUSB: 0.06, ISTB: 0.06, SCHZ: 0.03,
  SPAB: 0.03, SPTL: 0.03, SPTS: 0.03, SPSB: 0.04, SPIB: 0.04,
  FLOT: 0.15, IGSB: 0.04, IGIB: 0.04, NEAR: 0.25, ICSH: 0.08,
  BKLN: 0.65, SRLN: 0.70, ANGL: 0.35, FIXD: 0.36, BOND: 0.55, FBND: 0.36,
  // Municipal
  MUB: 0.07, VTEB: 0.03, TFI: 0.23, SUB: 0.07, SHM: 0.20, ITM: 0.18,
  PZA: 0.28, HYD: 0.32, BAB: 0.28,
  // Cash and ultra-short
  BIL: 0.1352, SGOV: 0.09, SHV: 0.15, USFR: 0.15, TBIL: 0.15,
  GBIL: 0.12, TFLO: 0.15, JPST: 0.18, MINT: 0.35,
  // Commodities, real assets, digital
  GLD: 0.40, GLDM: 0.10, IAU: 0.25, SLV: 0.50, SGOL: 0.17,
  PDBC: 0.59, DBC: 0.87, GSG: 0.75, COMT: 0.48, FTGC: 0.65,
  VNQ: 0.13, VNQI: 0.12, SCHH: 0.07, IYR: 0.38, REET: 0.14,
  IBIT: 0.25, FBTC: 0.25, ARKB: 0.21, BITO: 0.95,
  // Factor and other
  MTUM: 0.15, QUAL: 0.15, USMV: 0.15, VLUE: 0.15, SIZE: 0.15,
  MOAT: 0.46, AMLP: 0.85, MLPA: 0.45,
};

export const normalizeCostTicker = ticker => String(ticker || '').trim().toUpperCase().replace(/[./\s]+/g, '-');

// Returns the percent, 0 for a known common stock, or null when unknown.
export function expenseRatioPct(ticker, isEquityConstituent) {
  const symbol = normalizeCostTicker(ticker);
  if (Object.prototype.hasOwnProperty.call(EXPENSE_RATIOS, symbol)) return EXPENSE_RATIOS[symbol];
  if (isEquityConstituent) return 0;
  return null;
}
