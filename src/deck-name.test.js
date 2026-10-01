import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, reviewDate, deckName } from './deck-name.js';

test('the deck is named for the client, then the review, then the date', () => {
  assert.equal(deckName('Jane Smith', '2026-10-01'), 'Jane Smith Review 2026-10-01');
  assert.equal(deckName('  Jane  Smith  ', '2026-10-01'), 'Jane Smith Review 2026-10-01');
});

test('a deck with no client named is still a review with a date', () => {
  assert.equal(deckName('', '2026-10-01'), 'Account Review 2026-10-01');
  assert.equal(deckName(null, '2026-10-01'), 'Account Review 2026-10-01');
  assert.equal(deckName(undefined, undefined), 'Account Review');
});

test('characters a filesystem would reject never reach the filename', () => {
  assert.equal(deckName('Smith/Jones', '2026-10-01'), 'Smith Jones Review 2026-10-01');
  assert.equal(deckName('A:B*C?D"E<F>G|H', '2026-10-01'), 'A B C D E F G H Review 2026-10-01');
  assert.equal(cleanName('tab\there'), 'tab here');
  assert.equal(cleanName('.hidden.'), 'hidden');
  // A name that is nothing but unsafe characters must not leave an empty
  // client segment behind.
  assert.equal(deckName('///', '2026-10-01'), 'Account Review 2026-10-01');
});

test('only a real ISO date is used, and it is left sortable', () => {
  assert.equal(reviewDate('2026-10-01'), '2026-10-01');
  assert.equal(reviewDate('2026-02-30'), '');
  assert.equal(reviewDate('October 1, 2026'), '');
  assert.equal(reviewDate(''), '');
  assert.equal(reviewDate('2026-1-1'), '');
});

test('a bad date drops out instead of being guessed', () => {
  assert.equal(deckName('Jane Smith', 'sometime'), 'Jane Smith Review');
  assert.equal(deckName('Jane Smith', ''), 'Jane Smith Review');
});
