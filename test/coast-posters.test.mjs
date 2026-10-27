import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { posterSetVersion } = require("../bin/render_coast_posters.cjs");
const folder = new URL("../assets/models/la-jolla/posters/", import.meta.url);

test("a night-only poster update invalidates the complete cached preview family", () => {
  const entries = ["coast", "coast-mobile", "miniature"].flatMap((view) =>
    ["morning", "noon", "afternoon", "evening"].map((theme) => {
      const name = `${view}-${theme}.webp`;
      return { name, bytes: readFileSync(new URL(name, folder)) };
    })
  );
  const version = posterSetVersion(entries);
  assert.equal(readFileSync(new URL("version.txt", folder), "utf8").trim(), version);
  assert.equal(posterSetVersion([...entries].reverse()), version, "file enumeration order is irrelevant");
  const changed = entries.map((entry) =>
    entry.name === "coast-evening.webp" ? { ...entry, bytes: Buffer.concat([entry.bytes, Buffer.from("night update")]) } : entry
  );
  assert.notEqual(posterSetVersion(changed), version, "noon may stay identical while evening changes");
  assert.ok(changed.find((e) => e.name === "coast-noon.webp").bytes.equals(entries.find((e) => e.name === "coast-noon.webp").bytes));
});
