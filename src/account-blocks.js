// Reading several accounts out of one pasted block.
//
// An advisor's notes look like either of these:
//
//   Holdings            Joint Taxable
//   Joint :             IVV 2000000
//   IVV 2000000         AAPL 5000
//   AAPL 5000
//                       Roth IRA
//   Trust :             IEMG 92000
//   AGG 1000000         AGG 300000
//
// A line that names an account — with or without a trailing colon — opens one,
// and the holdings under it belong to it until the next such line. A heading
// that never gets any holdings, like "Holdings" above, ends up an empty
// account and is dropped.

const HEADER = /^\s*(.{1,60}?)\s*:\s*$/;
const PLAUSIBLE_TICKER = /^[A-Z][A-Z0-9.^/-]{0,5}$/;
const SUMMARY = /^(total|grand total|sub ?total|sum|portfolio)$/i;
const NAMEABLE = /^[A-Za-z][A-Za-z0-9 &'().\-/]*$/;

// A colon is the explicit form. A bare line is read as an account name only
// when it cannot be a holding whose value was left off: a ticker has no spaces
// and is written in capitals, so "Roth IRA" and "Joint Taxable" are accounts
// while "AAPL" and "MU" stay the errors they were. Losing a position silently
// would be worse than any convenience here.
export function isAccountHeader(line) {
  const colon = HEADER.exec(line);
  const text = (colon ? colon[1] : line).trim();
  if (!text || SUMMARY.test(text)) return null;
  if (colon) return text;
  if (/\d/.test(text)) return null;
  if (!NAMEABLE.test(text)) return null;
  // One word, in capitals, short enough to be a symbol: that is a holding
  // missing its value, and the parser must still refuse it.
  const bare = !/\s/.test(text);
  if (bare && PLAUSIBLE_TICKER.test(text)) return null;
  if (bare && text === text.toUpperCase() && text.length <= 6) return null;
  return text;
}

// Returns one entry per named account. A paste with no headers at all returns
// a single unnamed block, so an ordinary single-portfolio paste is unchanged.
export function splitAccountBlocks(text) {
  const blocks = [];
  let current = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const name = isAccountHeader(raw);
    if (name) {
      current = {name, lines: []};
      blocks.push(current);
      continue;
    }
    if (!raw.trim()) continue;
    if (!current) {
      current = {name: '', lines: []};
      blocks.push(current);
    }
    current.lines.push(raw);
  }
  return blocks
    .filter(b => b.lines.length)
    .map(b => ({name: b.name, text: b.lines.join('\n')}));
}

// True when the paste is describing more than one named account, which is the
// only case that should turn a single portfolio into several.
export function hasNamedAccounts(text) {
  const blocks = splitAccountBlocks(text);
  return blocks.length > 1 && blocks.every(b => b.name);
}
