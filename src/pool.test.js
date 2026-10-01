import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPool, settlePool } from './pool.js';

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

test('never exceeds the limit, and the limit is the point', async () => {
  let inFlight = 0, peak = 0;
  await mapPool(Array.from({length: 40}, (_, i) => i), async () => {
    inFlight++; peak = Math.max(peak, inFlight);
    await tick(2);
    inFlight--;
  }, 5);
  assert.equal(peak, 5);
});

test('results keep input order regardless of completion order', async () => {
  const out = await mapPool([30, 1, 20, 2], async ms => { await tick(ms); return ms; }, 4);
  assert.deepEqual(out, [30, 1, 20, 2]);
});

test('a limit above the item count does not spawn idle workers', async () => {
  let peak = 0, inFlight = 0;
  await mapPool([1, 2], async () => { inFlight++; peak = Math.max(peak, inFlight); await tick(1); inFlight--; }, 50);
  assert.equal(peak, 2);
});

test('an empty list resolves to an empty array without calling the worker', async () => {
  let called = false;
  const out = await mapPool([], async () => { called = true; }, 5);
  assert.deepEqual(out, []);
  assert.equal(called, false);
});

test('the first failure is thrown and no further work is started', async () => {
  let started = 0;
  await assert.rejects(
    mapPool(Array.from({length: 20}, (_, i) => i), async i => {
      started++;
      await tick(1);
      if (i === 1) throw Error('boom');
    }, 2),
    /boom/,
  );
  // With a limit of 2 it cannot have worked through the whole list.
  assert.ok(started < 20, `started ${started}`);
});

test('settlePool reports a failure instead of losing the batch', async () => {
  const out = await settlePool([1, 2, 3], async n => {
    if (n === 2) throw Error('bad');
    return n * 10;
  }, 2, (error, item) => ({failed: item, reason: error.message}));
  assert.deepEqual(out, [10, {failed: 2, reason: 'bad'}, 30]);
});

test('a limit of zero or less still makes progress', async () => {
  const out = await mapPool([1, 2, 3], async n => n, 0);
  assert.deepEqual(out, [1, 2, 3]);
});
