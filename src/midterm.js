// The midterm study, computed rather than quoted.
//
// For every year since 1970 this finds the US general-election date (or the
// hypothetical one, in years with no election), indexes the S&P 500 to 100 on
// that date, and follows it forward for 126 trading days — roughly six months.
// The paths are then averaged across midterm years and across every other
// year, which is the comparison the slide makes.
//
// One honest limitation, stated on the slide itself: ^GSPC is a PRICE index.
// Dividends are not in it, so these are average price returns. A total-return
// version of the same study reads a few points higher and needs a licensed
// total-return series.

export const HORIZON = 126;            // trading days, about six months
export const FIRST_YEAR = 1970;

// US general elections fall on the first Tuesday after the first Monday in
// November, which is the first Tuesday on or after November 2nd.
export function electionDate(year) {
  const date = new Date(Date.UTC(year, 10, 2));
  while (date.getUTCDay() !== 2) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

// Presidential years are divisible by four, so midterms are the even years
// between them: 1970, 1974, 1978 and so on.
export const isMidterm = year => year % 4 === 2;

// `series` is ascending [{date: 'YYYY-MM-DD', close: number}].
export function midtermStudy(series, {horizon = HORIZON, firstYear = FIRST_YEAR, lastYear} = {}) {
  const rows = series.filter(point => Number.isFinite(point.close) && point.close > 0);
  if (rows.length < horizon + 2) return empty();
  const times = rows.map(point => Date.parse(point.date));
  const end = Number.isFinite(lastYear) ? lastYear : new Date(times.at(-1)).getUTCFullYear();

  const midterm = [], other = [];
  for (let year = firstYear; year <= end; year++) {
    const target = electionDate(year).getTime();
    // The first session on or after the election date.
    const start = times.findIndex(time => time >= target);
    if (start < 0 || start + horizon >= rows.length) continue;
    const base = rows[start].close;
    const path = [];
    for (let step = 0; step <= horizon; step++) path.push((rows[start + step].close / base) * 100);
    (isMidterm(year) ? midterm : other).push({year, path});
  }
  if (!midterm.length || !other.length) return empty();

  const average = sets => Array.from({length: horizon + 1}, (_, step) =>
    sets.reduce((sum, item) => sum + item.path[step], 0) / sets.length);
  const midtermPath = average(midterm), otherPath = average(other);

  return {
    horizon,
    midtermPath,
    otherPath,
    midtermReturn: midtermPath.at(-1) - 100,
    otherReturn: otherPath.at(-1) - 100,
    midtermYears: midterm.map(item => item.year),
    otherYears: other.map(item => item.year),
    asOf: rows.at(-1).date,
  };
}

function empty() {
  return {horizon: HORIZON, midtermPath: [], otherPath: [], midtermReturn: null, otherReturn: null,
    midtermYears: [], otherYears: [], asOf: ''};
}
