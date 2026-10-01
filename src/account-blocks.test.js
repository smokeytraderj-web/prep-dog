import test from 'node:test';
import assert from 'node:assert/strict';
import { splitAccountBlocks, hasNamedAccounts, isAccountHeader, isStrayLabel } from './account-blocks.js';

const paste = `Holdings
Joint :

IVV 2000000
AAPL 5000
MU 800000

Trust :

AGG 1000000
MSFT 110000
MUB 90000`;

test('a pasted block splits into the accounts it names', () => {
  const blocks = splitAccountBlocks(paste);
  assert.deepEqual(blocks.map(b => b.name), ['Joint', 'Trust']);
  assert.deepEqual(blocks[0].text.split('\n'), ['IVV 2000000', 'AAPL 5000', 'MU 800000']);
  assert.deepEqual(blocks[1].text.split('\n'), ['AGG 1000000', 'MSFT 110000', 'MUB 90000']);
});

test('the title above the first account is dropped, a bare ticker is not', () => {
  assert.equal(isStrayLabel('Holdings'), true);
  assert.equal(isStrayLabel('Joint Taxable'), true);
  // Short and upper case: this is a holding whose value is missing, and the
  // parser must still refuse it rather than quietly losing the position.
  assert.equal(isStrayLabel('AAPL'), false);
  assert.equal(isStrayLabel('MU'), false);
  assert.equal(isStrayLabel('IVV 100'), false);
});

test('a paste with no headers stays one portfolio', () => {
  const blocks = splitAccountBlocks('IVV 100\nAGG 50');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].name, '');
  assert.equal(hasNamedAccounts('IVV 100\nAGG 50'), false);
});

test('holdings before the first header are kept as an unnamed block', () => {
  const blocks = splitAccountBlocks('IVV 100\nJoint :\nAGG 50');
  assert.deepEqual(blocks.map(b => b.name), ['', 'Joint']);
  assert.equal(blocks[0].text, 'IVV 100');
  // Not every block is named, so this is not a multi-account paste.
  assert.equal(hasNamedAccounts('IVV 100\nJoint :\nAGG 50'), false);
});

test('a summary line is not an account', () => {
  assert.equal(isAccountHeader('Total:'), null);
  assert.equal(isAccountHeader('Grand Total :'), null);
  assert.equal(isAccountHeader('Joint Taxable:'), 'Joint Taxable');
  assert.equal(isAccountHeader('John IRA :'), 'John IRA');
  assert.equal(isAccountHeader('IVV 100'), null);
});

test('an empty account contributes nothing', () => {
  const blocks = splitAccountBlocks('Joint :\n\nTrust :\nAGG 50');
  assert.deepEqual(blocks.map(b => b.name), ['Trust']);
});

test('two accounts are detected, one is not', () => {
  assert.equal(hasNamedAccounts(paste), true);
  assert.equal(hasNamedAccounts('Joint :\nIVV 100'), false);
});
