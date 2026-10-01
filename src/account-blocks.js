// Reading several accounts out of one pasted block.
//
// An advisor's notes look like this:
//
//   Holdings
//   Joint :
//
//   IVV 2000000
//   AAPL 5000
//
//   Trust :
//   AGG 1000000
//
// A line ending in a colon names the account that follows it. Everything after
// it belongs to that account until the next such line.
//
// A bare label like "Holdings" is dropped, but only when it cannot be a ticker
// someone forgot to price: a plausible ticker is short and upper case, so
// "Holdings" is a heading and "AAPL" on its own is still an error the parser
// will report. Silently dropping a holding would be worse than refusing one.

const HEADER = /^\s*(.{1,60}?)\s*:\s*$/;
const PLAUSIBLE_TICKER = /^[A-Z][A-Z0-9.^/-]{0,5}$/;

export function isAccountHeader(line) {
  const match = HEADER.exec(line);
  if (!match) return null;
  const name = match[1].trim();
  // "Total:" and the like name a summary row, not an account.
  if (!name || /^(total|grand total|subtotal|sum)$/i.test(name)) return null;
  return name;
}

export function isStrayLabel(line) {
  const text = line.trim();
  if (!text || /\d/.test(text)) return false;
  if (PLAUSIBLE_TICKER.test(text)) return false;   // a ticker missing its value
  return /^[A-Za-z][A-Za-z0-9 &'().\-/]*$/.test(text);
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
    if (!current && isStrayLabel(raw)) continue;   // a title above the first account
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
