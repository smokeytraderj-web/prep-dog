import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOARDS } from "./market-indexes.js";

// The snapshot script carries its own copy of the boards, because Python cannot
// read the module above. Two copies drift: a sector added here and missed there
// would mean the live board and the saved one disagree about what the deck
// shows. This reads the script and holds the two together.
const script = readFileSync(new URL("../scripts/market_snapshot.py", import.meta.url), "utf8");

function pythonBoard(key) {
  const start = script.indexOf(`    "${key}": {`);
  assert.ok(start > 0, `the snapshot script has no ${key} board`);
  const next = script.indexOf('\n    "', start + 1);
  const block = script.slice(start, next === -1 ? script.indexOf("\n}\n", start) : next);
  return [...block.matchAll(/"symbol":\s*"([^"]+)"/g)].map(m => m[1]);
}

test("the snapshot script prices exactly the symbols the live boards do", () => {
  for (const [key, board] of Object.entries(BOARDS)) {
    assert.deepEqual(
      pythonBoard(key),
      board.definitions.map(d => d.symbol),
      `${key} differs between src/market-indexes.js and scripts/market_snapshot.py`,
    );
  }
});

test("every board the app serves is in the script", () => {
  const keys = [...script.matchAll(/^    "([a-z-]+)": \{$/gm)].map(m => m[1]);
  assert.deepEqual(keys.sort(), Object.keys(BOARDS).sort());
});
