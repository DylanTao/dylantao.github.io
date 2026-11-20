import assert from "node:assert/strict";
import { test } from "node:test";
import { createCoastalSurf, insideCoastalTidePool } from "../assets/js/home-scene/coastal-surf.mjs";

const elevations = Array.from({ length: 21 }, (_, i) => 1.56 - (i / 20) * 3.12);
const profile = { samples: [-6, 6].map((x) => [x, 4, 12, 10, ...elevations]) };
const tide = (x, _z, t) => 0.29 * Math.sin((t * Math.PI * 2) / 3.85 - x * 0.065) + 0.075 * Math.sin((t * Math.PI * 2) / 5.3);
const fixture = (options = {}) => createCoastalSurf({ beach: profile, seaLevel: 0, lanes: 9, cells: 60, incoming: tide, ...options });

test("hydrostatic reconstruction keeps a sloped beach at rest under a still sea", () => {
  const surface = fixture({ incoming: () => 0 });
  surface.rebuild(0, 0);
  for (let i = 1; i <= 180; i++) surface.advance(i / 30);
  for (const z of [-16, -14, -11, -10.35, -10.12]) {
    const point = surface.sample(0, z);
    assert.ok(point.depth > 0);
    assert.ok(Math.abs(point.y) < 1e-6);
    assert.equal(point.foam, 0);
  }
  assert.equal(surface.sample(0, -9.1).depth, 0);
  assert.equal(surface.sample(0, -9.1).moisture, 0);
});

test("a bore produces run-up, retreat and residual foam on exposed sand", () => {
  const surface = fixture();
  surface.rebuild(0);
  let exposedFoam = 0;
  let exposedMoisture = 0;
  let biggestFlood = 0;
  let movingHeight = [Infinity, -Infinity];
  let wetSamples = 0;
  let dryAfterWet = false;
  for (let i = 1; i <= 400; i++) {
    surface.advance(i / 30);
    const prebreaker = surface.sample(0, -13.5);
    movingHeight = [Math.min(movingHeight[0], prebreaker.y), Math.max(movingHeight[1], prebreaker.y)];
    for (let z = -9.97; z < -7.4; z += 0.12) {
      const { depth, foam, moisture } = surface.sample(0, z);
      if (depth > 0.014) {
        wetSamples++;
        biggestFlood = Math.max(biggestFlood, z + 10);
      } else if (moisture > 0.4 && foam > 0.008) {
        exposedFoam = Math.max(exposedFoam, foam);
        exposedMoisture = Math.max(exposedMoisture, moisture);
        dryAfterWet = true;
      }
      assert.ok(depth >= 0 && depth < 2.4);
    }
  }
  assert.ok(movingHeight[1] - movingHeight[0] > 0.12, JSON.stringify(movingHeight));
  assert.ok(wetSamples > 20 && biggestFlood >= 0.27, JSON.stringify({ wetSamples, biggestFlood }));
  assert.ok(dryAfterWet && exposedFoam >= 0.009 && exposedMoisture >= 0.42, JSON.stringify({ exposedFoam, exposedMoisture }));
});

test("holding the scene clock preserves the atlas and omitted tide pools stay outside it", () => {
  const pools = [{ center: [0, 0.25, -10.2], radii: [0.9, 0.52] }];
  const surface = fixture({ pools });
  surface.rebuild(0);
  assert.equal(insideCoastalTidePool(0, -10.2, pools), true);
  assert.equal(insideCoastalTidePool(2, -10.2, pools), false);
  assert.equal(surface.sample(0, -10.2).depth, 0);
  const frozen = [...surface.atlas];
  assert.equal(surface.advance(0), false);
  assert.deepEqual([...surface.atlas], frozen);
  assert.equal(surface.advance(10), true);
  assert.ok(surface.atlas.every(Number.isFinite));
  assert.equal(surface.sample(0, -10.2).foam, 0);
});
