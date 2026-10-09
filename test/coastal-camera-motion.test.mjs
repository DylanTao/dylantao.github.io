import test from "node:test";
import assert from "node:assert/strict";
import { createCameraMotion } from "../assets/js/home-scene/camera-motion.mjs";
test("camera settling is independent of frame partition and handles a slow renderer", () => {
  const a = createCameraMotion(),
    b = createCameraMotion();
  let x = 0;
  for (let i = 0; i < 60; i++) x = a.step("x", x, 5, 1 / 60);
  assert.ok(Math.abs(x - b.step("x", 0, 5, 1)) < 1e-10);
  assert.ok(Math.abs(b.step("x", x, 5, 5) - 5) < 1e-10);
});
test("an interrupted camera retains velocity while a still composition stops it", () => {
  const m = createCameraMotion();
  const x = m.step("x", 0, 5, 0.06),
    v = m.evidence().x;
  const next = m.step("x", x, -2, 0.00001);
  assert.ok(Math.abs((next - x) / 0.00001 - v) < 0.03);
  assert.equal(m.step("x", next, -2, 0.01, true), -2);
  assert.equal(m.evidence().x, undefined);
  m.step("radius", 1, 9, 0.1);
  m.stop("radius");
  assert.equal(m.evidence().radius, undefined);
});
