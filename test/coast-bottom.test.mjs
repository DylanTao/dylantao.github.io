import test from "node:test";
import assert from "node:assert/strict";
import { buildBottomRelief, intersectBottom, sampleBottomDepth } from "../assets/js/footer-coast/bed-relief.mjs";
import { SEAS } from "../assets/js/footer-coast/water.mjs";
import { WATER_IOR, WATER_LEVEL, refract, scatteringIntegral, SCATTER, EXTINCTION } from "../assets/js/footer-coast/water-optics.mjs";

for (const [name, sea] of [
  ["footer", SEAS.footer([])],
  ["miniature", SEAS.miniature()],
]) {
  test(`${name} bottom is a complete upward-facing mesh, with its exact depths available to refraction`, () => {
    const relief = buildBottomRelief(sea, { columns: 193, rows: 97 });
    assert.equal(relief.indices.length, 192 * 96 * 6);
    const used = new Uint8Array(relief.depths.length);
    for (const index of relief.indices) used[index]++;
    assert.ok(
      used.every((n) => n > 0),
      "no orphan vertices or omitted grid cells"
    );
    for (let at = 0; at < relief.depths.length; at += 11) {
      const [x, y, z] = relief.positions.subarray(at * 3, at * 3 + 3);
      assert.ok(Math.abs(WATER_LEVEL - y - sampleBottomDepth(relief, x, z)) < 2e-5, "mesh and optical depth agree");
      assert.ok(y < WATER_LEVEL && Number.isFinite(y));
    }
    for (let i = 0; i < relief.indices.length; i += 6) {
      const [a, b, c] = relief.indices.subarray(i, i + 3),
        p = relief.positions,
        up = (p[b * 3 + 2] - p[a * 3 + 2]) * (p[c * 3] - p[a * 3]) - (p[b * 3] - p[a * 3]) * (p[c * 3 + 2] - p[a * 3 + 2]);
      assert.ok(up > 0, "every cell faces up into the water");
    }
  });

  test(`${name} Snell rays terminate on the sampled reef and canyon relief`, () => {
    const relief = buildBottomRelief(sea),
      view = [0, 0.388, 0.922],
      ray = refract(
        view.map((n) => -n),
        [0, 1, 0],
        1 / WATER_IOR
      );
    for (let x = -sea.span * 0.9; x < sea.span * 0.9; x += sea.span / 30)
      for (const d of [0.2, 0.6, 1.5, 3, 8, 16])
        for (const surfaceOffset of [0, 0.035]) {
          const hit = intersectBottom(relief, x, sea.shore(x) + d, ray, surfaceOffset);
          assert.ok(Math.abs(WATER_LEVEL - hit.y - sampleBottomDepth(relief, hit.x, hit.z)) < 0.001, `hit ${x}, ${d}`);
          assert.ok(hit.distance > 0 && hit.z < sea.shore(x) + d, "refracted rays bend shoreward into the water");
        }
  });
}

test("homogeneous water scattering has zero light at zero length and a bounded asymptote", () => {
  assert.deepEqual(scatteringIntegral(0), [0, 0, 0]);
  for (const path of [0.1, 0.5, 2, 8]) {
    const ambient = scatteringIntegral(path),
      sun = scatteringIntegral(path, 1.2);
    ambient.forEach((v, i) => {
      assert.ok(v > 0 && v < SCATTER[i] / EXTINCTION[i]);
      assert.ok(sun[i] < v, "the sun's extra path reduces the scattered radiance");
    });
  }
});
