import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createDuvetSolver } from "../assets/js/home-scene/duvet-solver.mjs";

const setup = () => {
  const geometry = new THREE.PlaneGeometry(1.6, 2, 24, 30).rotateX(-Math.PI / 2);
  return createDuvetSolver(geometry.attributes.position.array, geometry.index.array, geometry.attributes.normal.array);
};
const chest = { x: 0, y: 0, z: 0 };
test("duvet uses bounded cloth particles and preserves the fitted body envelope", () => {
  const cloth = setup();
  assert.ok(cloth.counts.particles <= 1200);
  assert.ok(cloth.counts.constraints > cloth.counts.particles);
  for (let i = 0; i < 1200; i++) cloth.advance(1 / 60, chest, (1 + Math.sin(i / 40)) / 2);
  for (let i = 0; i < cloth.positions.length; i += 3) {
    assert.ok(cloth.positions[i + 1] >= -1e-8, "contact prevents sinking through the rest drape");
    assert.ok(Math.hypot(...[0, 1, 2].map((q) => cloth.positions[i + q] - cloth.origin[i + q])) <= 0.025001);
  }
  const before = cloth.positions.slice();
  assert.equal(cloth.advance(0, chest, 1), false);
  assert.deepEqual(cloth.positions, before, "a paused clock does not move cloth");
  cloth.advance(600, chest, 1);
  assert.ok(cloth.positions.every(Number.isFinite), "tab restoration cannot explode the cloth");
  cloth.reset();
  assert.deepEqual(cloth.positions, cloth.origin);
});
test("fixed-step cloth agrees at 30 and 60 Hz and settles after contact moves away", () => {
  const a = setup(),
    b = setup();
  for (let i = 0; i < 120; i++) a.advance(1 / 60, chest, 1);
  for (let i = 0; i < 60; i++) b.advance(1 / 30, chest, 1);
  assert.deepEqual(a.positions, b.positions);
  const peak = Math.max(...a.positions.filter((_, i) => i % 3 === 1));
  assert.ok(peak > 0.006 && peak < 0.012);
  for (let i = 0; i < 300; i++) a.advance(1 / 60, chest, 0);
  assert.ok(Math.max(...a.positions.filter((_, i) => i % 3 === 1)) < 0.0001, "gravity settles the unsupported cloth");
});
