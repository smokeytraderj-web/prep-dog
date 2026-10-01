// Combining several account files into one portfolio.
//
// Each file is one account, and the advisor names it. That name is what the
// deck groups by, so it overrides any account column the file happens to carry
// — the point of naming it is that the file's own label is absent, wrong, or a
// custodian's internal number.
//
// Two tickers that are the same security in two accounts are one line of the
// portfolio and two lines of the account breakdown, so the holdings total
// combines them while the positions stay apart.

export const MIN_ACCOUNTS = 2;
export const MAX_ACCOUNTS = 10;

export function accountErrors(entries) {
  const filled = (entries || []).filter(e => e.positions?.length);
  const errors = [];
  if (filled.length < MIN_ACCOUNTS) {
    errors.push(`Add at least ${MIN_ACCOUNTS} accounts, each with a file.`);
  }
  if (filled.length > MAX_ACCOUNTS) {
    errors.push(`This builds from at most ${MAX_ACCOUNTS} accounts.`);
  }
  const named = filled.map(e => (e.name || '').trim());
  if (named.some(n => !n)) errors.push('Name every account before building the deck.');
  const seen = new Set();
  for (const name of named) {
    const key = name.toLowerCase();
    if (!key) continue;
    // Two accounts with one name would merge into a single row on the account
    // slide, which quietly understates how many accounts the client holds.
    if (seen.has(key)) { errors.push(`Two accounts are both called "${name}". Give each one its own name.`); break; }
    seen.add(key);
  }
  return errors;
}

export function mergeAccounts(entries) {
  const filled = (entries || []).filter(e => e.positions?.length && (e.name || '').trim());
  const positions = [];
  const totals = new Map();
  for (const entry of filled) {
    const account = entry.name.trim();
    for (const position of entry.positions) {
      const value = Number(position.value);
      if (!Number.isFinite(value) || value <= 0) continue;
      positions.push({...position, account});
      totals.set(position.ticker, (totals.get(position.ticker) || 0) + value);
    }
  }
  return {
    positions,
    holdings: [...totals].map(([ticker, value]) => ({ticker, value})),
    accounts: filled.map(e => e.name.trim()),
    // Not "account files": an account can be pasted, and a source line that
    // names a file for it would be wrong.
    source: `${filled.length} accounts: ${filled.map(e => e.fileName ? e.fileName : `${e.name.trim()} (pasted)`).join(', ')}`,
  };
}
