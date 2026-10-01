import test from 'node:test';
import assert from 'node:assert/strict';
import { allocationClass, allocationRows, allocationNote, assetClassPerformance, CLASS_ORDER } from './allocation.js';

test('equity splits by the supplied region, and never by the ticker', () => {
  assert.equal(allocationClass('Equity', 'U.S. large cap'), 'Domestic Equity');
  assert.equal(allocationClass('Equity', 'Emerging markets'), 'International Equity');
  assert.equal(allocationClass('Equity', 'Developed ex-US'), 'International Equity');
  // No region column: the slide says "Equity" rather than inventing a half of
  // the world for the position.
  assert.equal(allocationClass('Equity', ''), 'Equity');
  assert.equal(allocationClass('Equity', undefined), 'Equity');
  // A region it cannot read is not forced into one side either.
  assert.equal(allocationClass('Equity', 'Sector rotation sleeve'), 'Equity');
});

test('cash and bonds are read before equity, so an ETF wrapper cannot hide them', () => {
  assert.equal(allocationClass('Cash', ''), 'Cash and Equivalents');
  assert.equal(allocationClass('Money market fund', ''), 'Cash and Equivalents');
  assert.equal(allocationClass('Municipal bond', ''), 'Fixed Income');
  assert.equal(allocationClass('Fixed income ETF', ''), 'Fixed Income');
  assert.equal(allocationClass('Treasury', ''), 'Fixed Income');
  assert.equal(allocationClass('Real estate', ''), 'Alternative');
  assert.equal(allocationClass('Commodity', ''), 'Alternative');
  assert.equal(allocationClass('', ''), 'Unclassified');
});

const book = [
  { ticker: 'IVV', value: 400, assetClass: 'Equity', region: 'U.S. large cap' },
  { ticker: 'IEFA', value: 100, assetClass: 'Equity', region: 'Developed ex-US' },
  { ticker: 'AGG', value: 400, assetClass: 'Fixed income', region: 'U.S.' },
  { ticker: 'SGOV', value: 100, assetClass: 'Cash', region: 'U.S.' },
];

test('rows total 100% and follow the deck order, not size order', () => {
  const { rows, total } = allocationRows(book);
  assert.equal(total, 1000);
  assert.deepEqual(rows.map(r => r.name),
    ['Domestic Equity', 'International Equity', 'Fixed Income', 'Cash and Equivalents']);
  assert.equal(rows.reduce((n, r) => n + r.percent, 0).toFixed(6), '100.000000');
  assert.equal(rows[0].percent, 40);
});

test('rows ignore values that are not real money', () => {
  const { rows, total } = allocationRows([
    ...book,
    { ticker: 'BAD', value: 0, assetClass: 'Equity', region: 'U.S.' },
    { ticker: 'WORSE', value: -50, assetClass: 'Equity', region: 'U.S.' },
    { ticker: 'NAN', value: 'abc', assetClass: 'Equity', region: 'U.S.' },
  ]);
  assert.equal(total, 1000);
  assert.equal(rows.find(r => r.name === 'Domestic Equity').value, 400);
});

test('an empty book produces no rows and no sentence', () => {
  const empty = allocationRows([]);
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.total, 0);
  assert.equal(allocationNote(empty), '');
});

test('the sentence only restates figures that are in the table', () => {
  const note = allocationNote(allocationRows(book));
  assert.match(note, /Equity exposure totals 50\.00%/);
  assert.match(note, /domestic 40\.00%, international 10\.00%/);
  assert.match(note, /40\.00% fixed income allocation/);
});

test('the sentence drops the parts the book does not have', () => {
  const noFixed = allocationNote(allocationRows([book[0]]));
  assert.equal(noFixed, 'Equity exposure totals 100.00%.');
  const noEquity = allocationNote(allocationRows([book[2]]));
  assert.equal(noEquity, '');
});

test('class performance weights by start value, not by position count', () => {
  // Two domestic holdings: a large flat one and a tiny one that doubled. An
  // average of the two returns would read +50%; the real class return is the
  // gain over the class's start value.
  const positions = [
    { ticker: 'BIG', value: 1000, assetClass: 'Equity', region: 'U.S.' },
    { ticker: 'TINY', value: 20, assetClass: 'Equity', region: 'U.S.' },
  ];
  const { rows } = assetClassPerformance(positions, { BIG: 0, TINY: 100 });
  const domestic = rows.find(r => r.name === 'Domestic Equity');
  // start = 1000 + 10 = 1010; gain = 10; return = 10/1010.
  assert.equal(domestic.ytdReturn.toFixed(4), (10 / 1010 * 100).toFixed(4));
  assert.notEqual(Math.round(domestic.ytdReturn), 50);
});

test('positions with no return are reported, never treated as flat', () => {
  const r = assetClassPerformance(book, { IVV: 10, IEFA: 5 });
  assert.deepEqual(r.unpriced.sort(), ['AGG', 'SGOV']);
  assert.equal(r.rows.length, 2);
  // Coverage is the share of supplied value the table actually speaks for.
  assert.equal(r.coverage, 50);
});

test('class returns reconcile to the portfolio return they are drawn from', () => {
  const returns = { IVV: 10, IEFA: 5, AGG: 2, SGOV: 4 };
  const r = assetClassPerformance(book, returns);
  const start = r.rows.reduce((n, x) => n + x.start, 0);
  const gain = r.rows.reduce((n, x) => n + x.gain, 0);
  assert.equal(r.portfolioReturn.toFixed(8), ((gain / start) * 100).toFixed(8));
  assert.equal(r.coverage, 100);
});

test('no returns at all is an empty table, not a table of zeros', () => {
  const r = assetClassPerformance(book, null);
  assert.deepEqual(r.rows, []);
  assert.equal(r.portfolioReturn, 0);
  assert.equal(r.coverage, 0);
  assert.equal(r.unpriced.length, 4);
});

test('the deck order lists both equity splits before fixed income', () => {
  assert.ok(CLASS_ORDER.indexOf('Domestic Equity') < CLASS_ORDER.indexOf('Fixed Income'));
  assert.ok(CLASS_ORDER.indexOf('International Equity') < CLASS_ORDER.indexOf('Fixed Income'));
  assert.ok(CLASS_ORDER.indexOf('Cash and Equivalents') === CLASS_ORDER.length - 1);
});
