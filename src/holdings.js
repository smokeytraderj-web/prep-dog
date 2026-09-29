export function parseHoldings(input) {
  const holdings = new Map();
  const errors = [];
  input.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (
      !line ||
      /^[|\s:-]+$/.test(line) ||
      /^(\|\s*)?(ticker|symbol)\b/i.test(line)
    )
      return;
    const clean = line
      .replace(/"/g, "")
      .replace(/^\|\s*|\s*\|$/g, "")
      .replace(/\$/g, "");
    const match = clean.match(
      /^([A-Za-z][A-Za-z0-9.^-]{0,14})\s*(?:\||,|;|\t|\s)\s*([\d,]+(?:\.\d+)?)\s*$/,
    );
    if (
      !match ||
      !Number.isFinite(Number(match[2].replace(/,/g, ""))) ||
      Number(match[2].replace(/,/g, "")) <= 0
    ) {
      errors.push(`Line ${i + 1}: use a ticker and a positive value only.`);
      return;
    }
    const ticker = match[1].toUpperCase(),
      value = Number(match[2].replace(/,/g, ""));
    holdings.set(ticker, (holdings.get(ticker) || 0) + value);
  });
  return {
    holdings: [...holdings].map(([ticker, value]) => ({ ticker, value })),
    errors,
  };
}
export const totalValue = (holdings) =>
  holdings.reduce((sum, h) => sum + h.value, 0);
