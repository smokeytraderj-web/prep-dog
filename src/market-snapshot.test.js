import { test } from "node:test";
import assert from "node:assert/strict";
import { boardFromSnapshot, requestedBoard } from "./market-snapshot.js";
import { fetchMarketJson } from "./market-fetch.js";

const board = (key, indexes) => ({asOf: "2026-10-02", board: key, source: "Yahoo Finance.", basis: "YTD", indexes});
const snapshot = {
  boards: {
    indexes: board("indexes", [{id: "sp500", symbol: "^GSPC", label: "S&P 500", region: "U.S.", return: 12.5}]),
    sectors: board("sectors", [{id: "energy", symbol: "XLE", label: "Energy", region: "Energy", return: -3.1}]),
    symbols: board("symbols", [
      {id: "IVV", symbol: "IVV", label: "IVV", region: "Position", return: 12.1},
      {id: "AGG", symbol: "AGG", label: "AGG", region: "Position", return: 1.4},
    ]),
  },
};

test("a saved board says it is saved and when it was taken", () => {
  const result = boardFromSnapshot(snapshot, "sectors");
  assert.equal(result.indexes[0].symbol, "XLE");
  assert.equal(result.delivery, "snapshot");
  assert.match(result.warning, /2026-10-02/);
});

test("a board the snapshot does not hold is not invented", () => {
  assert.equal(boardFromSnapshot(snapshot, "fixed-income"), null);
  assert.equal(boardFromSnapshot({boards: {}}, "indexes"), null);
  assert.equal(boardFromSnapshot(null, "indexes"), null);
});

test("positions come back in the order asked for", () => {
  const result = boardFromSnapshot(snapshot, "indexes", ["agg", "ivv"]);
  assert.deepEqual(result.indexes.map(i => i.symbol), ["AGG", "IVV"]);
});

test("a position the snapshot never priced fails the whole board", () => {
  // Returning the two it has would drop the third from attribution silently.
  assert.equal(boardFromSnapshot(snapshot, "indexes", ["IVV", "AGG", "TLT"]), null);
});

test("the board and symbols are read back off the request", () => {
  assert.deepEqual(requestedBoard("/api/market/ytd"), {board: "indexes", symbols: []});
  assert.deepEqual(requestedBoard("/api/market/ytd?board=sectors"), {board: "sectors", symbols: []});
  assert.deepEqual(requestedBoard("/api/market/ytd?symbols=IVV,AGG"), {board: "indexes", symbols: ["IVV", "AGG"]});
});

test("a market outage falls back to the snapshot instead of losing the slide", async () => {
  const asked = [];
  const data = await fetchMarketJson("/api/market/ytd?board=sectors", async (path) => {
    asked.push(path);
    if (path.startsWith("/api/")) return Response.json({error: "upstream refused"}, {status: 502});
    return Response.json(snapshot);
  });
  assert.equal(data.delivery, "snapshot");
  assert.equal(data.indexes[0].symbol, "XLE");
  assert.equal(asked.filter(p => p.startsWith("/api/")).length, 2);  // the live call is still retried first
});

test("with no snapshot on disk the outage is still reported", async () => {
  await assert.rejects(
    () => fetchMarketJson("/api/market/ytd", async (path) =>
      path.startsWith("/api/") ? Response.json({error: "upstream refused"}, {status: 502}) : new Response("", {status: 404})),
    /upstream refused/,
  );
});

test("a sign-in response is never covered up with saved figures", async () => {
  // The advisor can fix a session; they cannot fix Yahoo. Only one of those
  // should be answered with yesterday's numbers.
  let snapshotAsked = false;
  await assert.rejects(() => fetchMarketJson("/api/market/ytd", async (path) => {
    if (!path.startsWith("/api/")) { snapshotAsked = true; return Response.json(snapshot); }
    return new Response("<html>Sign in</html>");
  }), /sign-in page/);
  assert.equal(snapshotAsked, false);
});
