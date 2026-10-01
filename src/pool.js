// Bounded concurrency for upstream requests.
//
// Every data endpoint used to fan out with Promise.all, so the number of
// simultaneous requests to the provider was whatever the portfolio happened to
// contain. Opening the workspace fired roughly sixty-six at once: four boards,
// a per-position return for every holding, sixteen months of history, and a
// fund look-through for every ETF. Providers rate-limit that, and the failures
// land on whichever endpoint happens to be unlucky — which is why "Load failed"
// appeared on the benchmark and the risk snapshot rather than on the slide that
// caused it.
//
// mapPool runs the same work with a ceiling on how many are in flight. Results
// stay in input order, so callers that zip them back against their inputs are
// unaffected.

export const DEFAULT_LIMIT = 5;

export async function mapPool(items, worker, limit = DEFAULT_LIMIT) {
  const list = [...items];
  const results = new Array(list.length);
  const width = Math.max(1, Math.min(limit, list.length));
  let next = 0;
  let failure;

  async function run() {
    while (next < list.length) {
      const index = next++;
      try {
        results[index] = await worker(list[index], index);
      } catch (error) {
        // Keep the first failure and stop handing out new work, so one bad
        // symbol does not drag the whole batch through its full timeout.
        if (failure === undefined) failure = error;
        next = list.length;
      }
    }
  }

  await Promise.all(Array.from({length: width}, run));
  if (failure !== undefined) throw failure;
  return results;
}

// Like mapPool, but a failing item yields a value instead of failing the batch.
// Used where a missing symbol should be reported rather than lose the rest.
export async function settlePool(items, worker, limit = DEFAULT_LIMIT, onError = () => undefined) {
  return mapPool(
    items,
    async (item, index) => {
      try { return await worker(item, index); }
      catch (error) { return onError(error, item, index); }
    },
    limit,
  );
}
