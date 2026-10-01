import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAccounts, accountErrors, MIN_ACCOUNTS, MAX_ACCOUNTS } from './multi-account.js';

const entry = (name, positions, fileName) => ({name, positions, fileName});

test('the typed name wins over whatever the file called the account', () => {
  const {positions} = mergeAccounts([
    entry('Joint Taxable', [{ticker: 'IVV', value: 100, account: 'XXX-1234'}]),
    entry('John IRA', [{ticker: 'AGG', value: 50}]),
  ]);
  assert.deepEqual(positions.map(p => p.account), ['Joint Taxable', 'John IRA']);
});

test('one security in two accounts is one holding and two positions', () => {
  const {holdings, positions} = mergeAccounts([
    entry('Joint Taxable', [{ticker: 'IVV', value: 100}]),
    entry('John IRA', [{ticker: 'IVV', value: 300}]),
  ]);
  assert.deepEqual(holdings, [{ticker: 'IVV', value: 400}]);
  assert.equal(positions.length, 2);
  assert.deepEqual(positions.map(p => p.account), ['Joint Taxable', 'John IRA']);
});

test('the rest of a row survives the merge', () => {
  const {positions} = mergeAccounts([
    entry('Trust', [{ticker: 'IVV', value: 100, assetClass: 'Equity', region: 'U.S.', securityName: 'iShares Core'}]),
    entry('IRA', [{ticker: 'AGG', value: 10}]),
  ]);
  assert.equal(positions[0].assetClass, 'Equity');
  assert.equal(positions[0].region, 'U.S.');
  assert.equal(positions[0].securityName, 'iShares Core');
});

test('values that are not money are left out of both totals', () => {
  const {holdings, positions} = mergeAccounts([
    entry('A', [{ticker: 'IVV', value: 100}, {ticker: 'BAD', value: 0}, {ticker: 'WORSE', value: -5}]),
    entry('B', [{ticker: 'NAN', value: 'abc'}, {ticker: 'AGG', value: 25}]),
  ]);
  assert.deepEqual(holdings.map(h => h.ticker).sort(), ['AGG', 'IVV']);
  assert.equal(positions.length, 2);
});

test('an unnamed or empty account is not merged in', () => {
  const {positions, accounts} = mergeAccounts([
    entry('Joint', [{ticker: 'IVV', value: 100}]),
    entry('   ', [{ticker: 'AGG', value: 50}]),
    entry('Empty', []),
    entry('IRA', [{ticker: 'MUB', value: 20}]),
  ]);
  assert.deepEqual(accounts, ['Joint', 'IRA']);
  assert.equal(positions.length, 2);
});

test('the deck needs at least two accounts and takes at most ten', () => {
  assert.match(accountErrors([entry('Only', [{ticker: 'IVV', value: 1}])]).join(' '),
    new RegExp(`at least ${MIN_ACCOUNTS}`));
  const many = Array.from({length: MAX_ACCOUNTS + 1}, (_, i) =>
    entry(`Account ${i}`, [{ticker: 'IVV', value: 1}]));
  assert.match(accountErrors(many).join(' '), new RegExp(`at most ${MAX_ACCOUNTS}`));
  const ten = many.slice(0, MAX_ACCOUNTS);
  assert.deepEqual(accountErrors(ten), []);
});

test('every account has to be named', () => {
  const errors = accountErrors([
    entry('Joint', [{ticker: 'IVV', value: 1}]),
    entry('', [{ticker: 'AGG', value: 1}]),
  ]);
  assert.match(errors.join(' '), /Name every account/);
});

test('two accounts cannot share a name, however it is cased', () => {
  const errors = accountErrors([
    entry('Joint Taxable', [{ticker: 'IVV', value: 1}]),
    entry('joint taxable', [{ticker: 'AGG', value: 1}]),
  ]);
  assert.match(errors.join(' '), /both called/);
});

test('the source names the files the deck was built from', () => {
  const {source} = mergeAccounts([
    entry('Joint', [{ticker: 'IVV', value: 1}], 'joint.xlsx'),
    entry('IRA', [{ticker: 'AGG', value: 1}], 'ira.csv'),
  ]);
  assert.match(source, /2 account files/);
  assert.match(source, /joint\.xlsx/);
  assert.match(source, /ira\.csv/);
});
