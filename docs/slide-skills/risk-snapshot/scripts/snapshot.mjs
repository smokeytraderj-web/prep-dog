export { validate, buildSnapshot } from "./model.mjs";
import { buildSnapshot } from "./model.mjs";

if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import("node:fs");
  const [, , inPath, outPath] = process.argv;
  if (!inPath) {
    console.error("usage: node scripts/snapshot.mjs <input.json> [out.json]");
    process.exit(1);
  }
  const snapshot = buildSnapshot(JSON.parse(fs.readFileSync(inPath, "utf8")));
  const text = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (outPath) fs.writeFileSync(outPath, text);
  else process.stdout.write(text);
  for (const w of snapshot.warnings) console.error(`warning: ${w}`);
}
