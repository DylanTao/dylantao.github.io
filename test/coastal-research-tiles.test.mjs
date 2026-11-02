import { test } from "node:test";
import assert from "node:assert/strict";
import tiles from "../bin/coastal_research_tiles.cjs";

test("tile census preserves exact partial border areas and reconstructs every channel", () => {
  const width = 65,
    height = 33,
    before = new Uint8Array(width * height * 4),
    after = before.slice();
  after[(32 * width + 64) * 4 + 3] = 255;
  const report = tiles.compareTiles(before, after, width, height);
  assert.equal(report.changedPixels, 1);
  assert.equal(report.tileCount, 6);
  assert.equal(report.dirtyTileCapacityPixels, 1);
  assert.deepEqual(report.dirtyTiles, [5]);
  assert.deepEqual(tiles.oracleReconstruct(before, after, report), after);
});

test("small channel changes stay in the exact gate even when a diagnostic threshold ignores them", () => {
  const before = new Uint8Array(8 * 8 * 4),
    after = before.slice();
  after[0] = 1;
  const exact = tiles.compareTiles(before, after, 8, 8);
  const diagnostic = tiles.compareTiles(before, after, 8, 8, { threshold: 2 });
  assert.equal(exact.changedPixels, 1);
  assert.equal(diagnostic.changedPixels, 0);
  assert.throws(() => tiles.oracleReconstruct(before, after, diagnostic));
});

test("invalid image dimensions and malformed thresholds fail before producing a reuse count", () => {
  for (const options of [{ tileSize: 0 }, { threshold: -1 }, { threshold: 1.5 }])
    assert.throws(() => tiles.compareTiles(new Uint8Array(4), new Uint8Array(4), 1, 1, options));
  assert.throws(() => tiles.compareTiles(new Uint8Array(4), new Uint8Array(8), 1, 1));
});
