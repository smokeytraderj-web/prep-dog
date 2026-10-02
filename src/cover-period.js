// The quarter a review reports on: the last one to have finished on the report
// date. Deriving it from the meeting's own month labelled a deck held two days
// into October as Q4, a quarter that had barely started.
export function completedQuarter(date) {
  const q = Math.floor(date.getMonth() / 3);
  // Day 0 of the following month is the last day of this quarter.
  const quarterEnd = new Date(date.getFullYear(), q * 3 + 3, 0);
  const index = date >= quarterEnd ? q : q - 1;
  return index < 0
    ? {quarter: 4, year: date.getFullYear() - 1}
    : {quarter: index + 1, year: date.getFullYear()};
}
