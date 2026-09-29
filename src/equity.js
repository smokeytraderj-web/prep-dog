export const SECTOR_ORDER = [
  "Materials",
  "Cons Discr",
  "Financial Svcs",
  "REITs",
  "Comms Svcs",
  "Energy",
  "Industrials",
  "Info Tech",
  "Cons Staples",
  "Healthcare",
  "Utilities",
];
export function validateEquity(data) {
  if (!data || !Array.isArray(data.sectors) || data.sectors.length !== 11)
    throw Error(
      "Include exactly 11 sectors from the equity-exposure data format.",
    );
  if (
    !["as_of", "portfolio_label", "benchmark_label", "source_note"].every(
      (k) => typeof data[k] === "string" && data[k].trim(),
    )
  )
    throw Error(
      "Include the as-of date, portfolio label, benchmark label, and source note.",
    );
  const sectors = SECTOR_ORDER.map((name) => {
    const matches = data.sectors.filter((s) => s.name === name);
    if (matches.length !== 1) throw Error(`Include ${name} exactly once.`);
    const s = matches[0];
    if (
      !["portfolio", "benchmark"].every(
        (k) =>
          typeof s[k] === "number" &&
          Number.isFinite(s[k]) &&
          s[k] >= 0 &&
          s[k] <= 100,
      )
    )
      throw Error(`${name}: weights must be percentages between 0 and 100.`);
    return s;
  });
  for (const key of ["portfolio", "benchmark"])
    if (Math.abs(sectors.reduce((a, s) => a + s[key], 0) - 100) > 0.2)
      throw Error(`${key} sector weights must total approximately 100%.`);
  return { ...data, sectors };
}
