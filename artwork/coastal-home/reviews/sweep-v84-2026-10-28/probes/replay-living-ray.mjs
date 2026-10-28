import assert from "node:assert/strict";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
const { createCollisionGrid, BLOCKING, INSIDE } = await import(
  "data:text/javascript;base64," + gunzipSync(fs.readFileSync(new URL("./camera-source.mjs.gz", import.meta.url))).toString("base64")
);
const read = JSON.parse(fs.readFileSync(new URL("../data/living-cell-origin.json", import.meta.url), "utf8"));
const grid = createCollisionGrid({ ...read.gridBounds, cell: read.field.cell });
const flags = new Uint8Array(grid.size.reduce((a, b) => a * b, 1));
for (const row of read.exactCellIntervals) {
  const [i, j, k] = row.cell;
  flags[i + grid.size[0] * (j + grid.size[1] * k)] = row.flags;
}
assert.equal(grid.setFlags(flags), true);
const blocked = read.exactCellIntervals.filter((r) => r.flags & BLOCKING);
assert.equal(blocked.length, 1);
assert.ok(!read.exactCellIntervals.some((r) => r.flags & INSIDE));
const soft = grid.march(read.target, read.direction, read.orbit.radius);
const hard = grid.march(read.target, read.direction, read.orbit.radius, BLOCKING | INSIDE);
assert.equal(soft.distance, 0);
assert.ok(Math.abs(soft.exit - blocked[0].entry) < 1e-12);
assert.ok(Math.abs(hard.distance - blocked[0].entry) < 1e-12);
assert.ok(blocked[0].exit - blocked[0].entry < 0.014);
assert.equal(read.origin.contributors.length, 1);
assert.equal(read.origin.contributors[0].name, "lounge_placeholder_living-fireplace");
assert.equal(read.origin.explicitSolids[0].overlapsBlockedCell, false);
console.log(
  JSON.stringify(
    {
      scope: "Measured crossed cells replayed through the frozen production DDA only; no full-scene or cone reconstruction",
      soft,
      hard,
      blockedIntervalMetres: blocked[0].exit - blocked[0].entry,
    },
    null,
    2
  )
);
