import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// main.jsx cannot be imported by the node test runner, so the presets are
// checked against the section list by reading the module. What matters is that
// no preset can name a slide the app cannot build -- a typo there would print
// an empty deck for a whole meeting type.
const source = readFileSync(new URL("./main.jsx", import.meta.url), "utf8");
const sectionIds = [...source.matchAll(/^\s*(?:\{\s*)?id: "([a-z-]+)",/gm)].map(m => m[1]);
const presets = [...source.matchAll(/id: "(quarterly|transition|prospect)",[\s\S]*?ids: (AUTO_SLIDES|\[[^\]]*\])/g)]
  .map(m => [m[1], m[2]]);

test("every preset names slides the deck can actually build", () => {
  assert.equal(presets.length, 3, "expected three presets");
  for (const [name, ids] of presets) {
    if (ids === "AUTO_SLIDES") continue;
    for (const id of [...ids.matchAll(/"([a-z-]+)"/g)].map(m => m[1])) {
      assert.ok(sectionIds.includes(id), `${name} asks for "${id}", which is not a section`);
    }
  }
});

test("the transition deck leads with the move it is about", () => {
  const transition = presets.find(([name]) => name === "transition")[1];
  assert.match(transition, /^\["admin"/);
});

test("a prospect deck carries no admin and no attribution", () => {
  const prospect = presets.find(([name]) => name === "prospect")[1];
  assert.doesNotMatch(prospect, /"admin"/);
  assert.doesNotMatch(prospect, /"regional-attribution"/);
});
