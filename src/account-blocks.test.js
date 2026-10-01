import test from 'node:test';
import assert from 'node:assert/strict';
import { splitAccountBlocks, hasNamedAccounts, isAccountHeader } from './account-blocks.js';

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

test('an account name needs no colon', () => {
  assert.equal(isAccountHeader('Roth IRA'), 'Roth IRA');
  assert.equal(isAccountHeader('Joint Taxable'), 'Joint Taxable');
  assert.equal(isAccountHeader('Holdings'), 'Holdings');
  assert.equal(isAccountHeader('Trust'), 'Trust');
});

test('a holding missing its value is still an error, not an account', () => {
  // One word, capitals, short enough to be a symbol.
  assert.equal(isAccountHeader('AAPL'), null);
  assert.equal(isAccountHeader('MU'), null);
  assert.equal(isAccountHeader('IVV'), null);
  assert.equal(isAccountHeader('BRK.B'), null);
  // Anything carrying a number is a holding line, not a name.
  assert.equal(isAccountHeader('IVV 100'), null);
  assert.equal(isAccountHeader('Account 2'), null);
});

test('a bare paste with names and no colons splits into accounts', () => {
  const blocks = splitAccountBlocks([
    'Joint Taxable', 'IVV 2000000', 'AAPL 5000', '',
    'Roth IRA', 'IEMG 92000', 'AGG 300000',
  ].join('\n'));
  assert.deepEqual(blocks.map(b => b.name), ['Joint Taxable', 'Roth IRA']);
  assert.equal(blocks[1].text, 'IEMG 92000\nAGG 300000');
});

test('a heading that collects no holdings is dropped', () => {
  const blocks = splitAccountBlocks('Holdings\nJoint Taxable\nIVV 100');
  assert.deepEqual(blocks.map(b => b.name), ['Joint Taxable']);
});

test('a paste with no headers stays one portfolio', () => {
  const blocks = splitAccountBlocks('IVV 100\nAGG 50');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].name, '');
  assert.equal(hasNamedAccounts('IVV 100\nAGG 50'), false);
});

test('holdings before the first name are kept as an unnamed block', () => {
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
