import { test } from "node:test";
import assert from "node:assert/strict";
import { completedQuarter } from "./cover-period.js";

// A review carries the quarter it reports on, which is the last one to have
// finished. Deriving it from the meeting's own month labelled a deck held two
// days into October as Q4 -- a quarter that had barely started.
test("the cover reports the quarter that has finished, not the one in progress", () => {
  const at = (y, m, d) => completedQuarter(new Date(y, m - 1, d));
  assert.deepEqual(at(2026, 10, 2), {quarter: 3, year: 2026});
  assert.deepEqual(at(2026, 9, 30), {quarter: 3, year: 2026});  // the quarter closes
  assert.deepEqual(at(2026, 9, 29), {quarter: 2, year: 2026});  // one day short
  assert.deepEqual(at(2026, 12, 31), {quarter: 4, year: 2026});
  assert.deepEqual(at(2026, 11, 20), {quarter: 3, year: 2026});
});

test("a review in January reports the fourth quarter of the year before", () => {
  assert.deepEqual(completedQuarter(new Date(2026, 0, 15)), {quarter: 4, year: 2025});
  assert.deepEqual(completedQuarter(new Date(2026, 2, 31)), {quarter: 1, year: 2026});
});
