import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  FAR_MAP,
  FAR_NEAR,
  FAR_SEA_LEVEL,
  buildFarMap,
  coastLine,
  farFieldGLSL,
  farMapCoordinate,
  hinterlandBaseHeight,
  outsideHinterland,
  regionalHeight,
} from "../assets/js/home-scene/far-field.mjs";
import { HAZE } from "../assets/js/home-scene/atmosphere.mjs";

test("the far field continues the hinterland's own surface (bin/coastal_hinterland.py base_height)", () => {
  // Reference values from the Python, coastal_hinterland.base_height(X, Y) in Blender's (X north, Y west).
  const reference = [
    [0, -100, 11.146101],
    [150, -300, 27.278576],
    [-400, -600, 49.544622],
    [600, -50, 24.738344],
    [-210, -445, 92.175504],
    [700, -650, 37.926698],
    [-650, -10, 9.79922],
    [2000, -3000, 52.55673],
    [-5000, -8000, 72.532421],
  ];
  for (const [X, Y, h] of reference) assert.ok(Math.abs(hinterlandBaseHeight(X, Y) - h) < 1e-5, `${X}, ${Y}: ${hinterlandBaseHeight(X, Y)}`);
});

test("past the hinterland's edge the land rises without a step, and the coast keeps its line", () => {
  // Across the inland edge (z 660) and both ends (x -660 and 720), one metre apart, inland of the coast.
  for (const [a, b] of [
    [
      [0, 659.5],
      [0, 660.5],
    ],
    [
      [-659.5, 300],
      [-660.5, 300],
    ],
    [
      [719.5, 300],
      [720.5, 300],
    ],
  ]) {
    assert.ok(Math.abs(regionalHeight(...a) - regionalHeight(...b)) < 0.2, `${a} to ${b}`);
  }
  assert.equal(outsideHinterland(0, 300), 0);
  assert.ok(outsideHinterland(0, 1660) === 1000);
  // The coast's line meets the hinterland's own outline ends (z -11 south, -12.6 north) and the sea
  // lies west of it, the land east.
  assert.ok(Math.abs(coastLine(-660) + 11) < 1e-9 && Math.abs(coastLine(720) + 12.6) < 1e-9);
  for (const x of [-9000, -3000, -800, 1500, 6000, 20000]) {
    assert.ok(regionalHeight(x, coastLine(x) - 60) < FAR_SEA_LEVEL, `sea west of the coast at x ${x}`);
    assert.ok(regionalHeight(x, coastLine(x) + 200) > FAR_SEA_LEVEL + 5, `land east of the coast at x ${x}`);
  }
  // Inland the mesa keeps rising to the higher terraces, as the coast does toward University City.
  assert.ok(regionalHeight(0, 5000) > regionalHeight(0, 1000) + 30);
});

test("the far map's cells grow with distance and cover 32 km to every side", async () => {
  const first = farMapCoordinate(0),
    last = farMapCoordinate(FAR_MAP.size - 1),
    middle = farMapCoordinate(FAR_MAP.size / 2);
  assert.ok(first < -31000 && last > 31000 && Math.abs(middle) < 2);
  const cell = (i) => farMapCoordinate(i + 1) - farMapCoordinate(i);
  assert.ok(cell(FAR_MAP.size / 2 + 2) < 10 && cell(FAR_MAP.size - 2) > 300);
  // A small map for the test's speed: heights, sea and cover in every texel.
  const data = await buildFarMap({ size: 32 });
  assert.equal(data.length, 32 * 32 * 4);
  let sea = 0,
    land = 0;
  for (let i = 0; i < data.length; i += 4) {
    assert.ok(Number.isFinite(data[i]));
    if (data[i] < FAR_SEA_LEVEL) sea++;
    else land++;
    assert.ok(data[i + 1] >= 0 && data[i + 1] <= 1);
  }
  assert.ok(sea > 100 && land > 100, `${sea} sea, ${land} land`);
});

test("the march keeps a uniform loop bound and the capture covers the hinterland", () => {
  // ANGLE unrolls constant-bound loops (docs/performance-notes.md): the march's bound is a uniform.
  assert.match(farFieldGLSL, /for \(int i = 0; i < steps; i\+\+\)/);
  assert.match(farFieldGLSL, /textureLod\(farMap/);
  assert.ok(FAR_NEAR.minX <= -660 && FAR_NEAR.maxX >= 720 && FAR_NEAR.maxZ >= 660);
  assert.ok((FAR_NEAR.maxX - FAR_NEAR.minX) / FAR_NEAR.width < 2.5, "capture cells under 2.5 m");
  // The coast's haze reaches past the sea horizon seen from the coast camera (about 28 km from 60 m),
  // so the sky and the sea meet in a soft band.
  assert.ok(HAZE.range >= 25000);
  const atmosphere = fs.readFileSync(new URL("../assets/js/home-scene/atmosphere.mjs", import.meta.url), "utf8");
  assert.match(atmosphere, /atmoNightHorizon \* \(1\.0 - view\.a\)/, "the far sea takes the night's glow at the horizon");
  assert.match(atmosphere, /gl_Position\.z = gl_Position\.w;/, "the dome is drawn on the far plane, after the opaque scene");
});
