import test from "node:test";
import assert from "node:assert/strict";
import { createCameraMotion, createInertia } from "../assets/js/home-scene/camera-motion.mjs";

// A flick: eight 16 ms pointer samples turning 0.05 rad each, released at once.
function flick(inertia, { pause = 0, interval = 0.016 } = {}) {
  let time = 10;
  for (let i = 0; i < 8; i++) inertia.track((time += interval), { yaw: 0.05, x: 0.1 });
  return inertia.release(time + pause, { yaw: 7, x: 40 });
}

test("a released flick coasts the same distance at any frame rate and comes to rest", () => {
  const totals = [];
  for (const hz of [20, 60, 144]) {
    const inertia = createInertia();
    assert.equal(flick(inertia), true);
    let yaw = 0;
    for (let t = 0; t < 3 && inertia.active; t += 1 / hz) yaw += inertia.step(1 / hz).yaw || 0;
    assert.equal(inertia.active, false, "coasting stops");
    totals.push(yaw);
  }
  // Rate 0.05 rad / 16 ms = 3.125 rad/s; with tau 0.32 s it coasts about v * tau = 1 rad.
  for (const total of totals) assert.ok(Math.abs(total - totals[0]) < 0.01 && total > 0.9 && total < 1.01, JSON.stringify(totals));
});

test("a drag held still before release, or an instant burst of events, never coasts; rates are capped", () => {
  assert.equal(flick(createInertia(), { pause: 0.25 }), false, "a deliberate stop");
  assert.equal(flick(createInertia(), { interval: 0 }), false, "no measurable duration");
  const fast = createInertia();
  let time = 0;
  for (let i = 0; i < 6; i++) fast.track((time += 0.016), { yaw: 1 });
  assert.equal(fast.release(time, { yaw: 7 }), true);
  assert.equal(fast.evidence().yaw, 7);
  fast.stop("yaw");
  assert.equal(fast.active, false);
});
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
