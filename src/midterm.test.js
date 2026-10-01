import test from 'node:test';
import assert from 'node:assert/strict';
import { electionDate, isMidterm, midtermStudy } from './midterm.js';

const iso = date => date.toISOString().slice(0, 10);

test('election day is the first Tuesday after the first Monday in November', () => {
  // Known dates.
  assert.equal(iso(electionDate(2022)), '2022-11-08');
  assert.equal(iso(electionDate(2024)), '2024-11-05');
  assert.equal(iso(electionDate(2018)), '2018-11-06');
  // November 1st is itself a Tuesday in 2022-style years: the rule must still
  // skip to the Tuesday after the first Monday, never the 1st.
  assert.equal(iso(electionDate(1988)), '1988-11-08');
  assert.equal(iso(electionDate(2016)), '2016-11-08');
});

test('every election date is a Tuesday between the 2nd and the 8th', () => {
  for (let year = 1970; year <= 2030; year++) {
    const date = electionDate(year);
    assert.equal(date.getUTCDay(), 2, `${year} is not a Tuesday`);
    assert.ok(date.getUTCDate() >= 2 && date.getUTCDate() <= 8, `${year} out of range`);
  }
});

test('midterms are the even years that are not presidential', () => {
  assert.ok(isMidterm(1970) && isMidterm(2022) && isMidterm(2026));
  assert.ok(!isMidterm(2024) && !isMidterm(2020));  // presidential
  assert.ok(!isMidterm(2023) && !isMidterm(2021));  // odd
});

// A synthetic series: every midterm year rises 10% over the horizon, every
// other year falls 5%, so the averages are known exactly.
function build({horizon = 10, firstYear = 1970, lastYear = 1990} = {}) {
  const rows = [];
  let close = 100;
  for (let year = firstYear - 1; year <= lastYear + 2; year++) {
    for (let month = 0; month < 12; month++) {
      for (let day = 1; day <= 28; day++) {
        rows.push({date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, close});
      }
    }
  }
  // Apply the step after each election date.
  for (let year = firstYear; year <= lastYear; year++) {
    const target = electionDate(year).getTime();
    const start = rows.findIndex(row => Date.parse(row.date) >= target);
    const factor = year % 4 === 2 ? 1.10 : 0.95;
    const base = rows[start].close;
    for (let i = 0; i <= horizon; i++) rows[start + i].close = base * (1 + (factor - 1) * (i / horizon));
    for (let i = start + horizon + 1; i < rows.length; i++) rows[i].close = rows[start + horizon].close;
  }
  return rows;
}

test('averages the two groups and keeps them apart', () => {
  const result = midtermStudy(build(), {horizon: 10, firstYear: 1970, lastYear: 1990});
  assert.ok(result.midtermYears.length > 0 && result.otherYears.length > 0);
  assert.ok(result.midtermYears.every(y => y % 4 === 2));
  assert.ok(result.otherYears.every(y => y % 4 !== 2));
  assert.ok(Math.abs(result.midtermReturn - 10) < 1e-6, `${result.midtermReturn}`);
  assert.ok(Math.abs(result.otherReturn - -5) < 1e-6, `${result.otherReturn}`);
});

test('both paths start indexed at 100 and run the full horizon', () => {
  const result = midtermStudy(build(), {horizon: 10, firstYear: 1970, lastYear: 1990});
  assert.equal(result.midtermPath.length, 11);
  assert.equal(result.otherPath.length, 11);
  assert.ok(Math.abs(result.midtermPath[0] - 100) < 1e-9);
  assert.ok(Math.abs(result.otherPath[0] - 100) < 1e-9);
});

test('a series too short to cover the horizon returns empty rather than NaN', () => {
  const result = midtermStudy([{date: '2022-11-08', close: 100}], {horizon: 126});
  assert.deepEqual(result.midtermPath, []);
  assert.equal(result.midtermReturn, null);
});

test('non-positive and non-numeric closes are dropped', () => {
  const rows = build();
  rows[50].close = 0;
  rows[51].close = NaN;
  const result = midtermStudy(rows, {horizon: 10, firstYear: 1970, lastYear: 1990});
  assert.ok(result.midtermPath.every(Number.isFinite));
  assert.ok(result.otherPath.every(Number.isFinite));
});
