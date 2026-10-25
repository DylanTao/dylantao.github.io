import test from "node:test";
import assert from "node:assert/strict";
import { SHADOW_MARGIN, SHADOW_STEPS, shadowDrift, steppedShadowExtent } from "../assets/js/home-scene/shadow-fit.mjs";

const wantedAt = (radius) => Math.min(120, Math.max(12, Math.round(radius * 0.75)));

test("the authored coast views land on their steps", () => {
  assert.equal(steppedShadowExtent(wantedAt(48), 39, true), 39, "the authored 48 m view");
  assert.equal(steppedShadowExtent(wantedAt(160), 120, true), 120, "the 160 m view");
  assert.equal(steppedShadowExtent(12, 12, true), 16, "a close-up keeps a margin");
});

test("a zoom changes the square only at ladder steps, growing at once and shrinking one step late", () => {
  let current = steppedShadowExtent(wantedAt(48), 0, true);
  const sizes = new Set([current]);
  let changes = 0;
  // A slow zoom out from 48 m to 160 m and back, one 1 cm step at a time.
  const path = [];
  for (let r = 48; r <= 160; r += 0.01) path.push(r);
  for (let r = 160; r >= 48; r -= 0.01) path.push(r);
  for (const radius of path) {
    const next = steppedShadowExtent(wantedAt(radius), current);
    if (next !== current) changes++;
    current = next;
    sizes.add(current);
    // Coverage: the square, less the drift its centre may lag, still covers what the view wants.
    assert.ok(current - shadowDrift(current, false, wantedAt(radius)) >= wantedAt(radius) - 1e-9, `${radius} m`);
  }
  assert.ok([...sizes].every((size) => SHADOW_STEPS.includes(size)));
  // Fitted per frame, the old square changed at every whole metre of the extent (90 changes each way).
  assert.ok(changes <= 2 * (SHADOW_STEPS.length - 1), `${changes} changes`);
});

test("hovering at a step boundary does not flip the square back and forth", () => {
  // Just above where 52 is needed, then just below: the square stays at 52 until clearly smaller.
  const boundary = 39 / SHADOW_MARGIN;
  let current = steppedShadowExtent(boundary + 0.5, 39);
  assert.equal(current, 52);
  for (const wanted of [boundary - 0.5, boundary + 0.5, boundary - 0.5, boundary - 2]) current = steppedShadowExtent(wanted, current);
  assert.equal(current, 52, "within one step of hysteresis");
  current = steppedShadowExtent(28 * 0.8, current);
  assert.equal(current, 28, "a clearly smaller view shrinks to its own step");
});

test("a walker's square recentres every metre; an orbit's once its spare coverage is used up", () => {
  assert.equal(shadowDrift(12, true, 12), 1);
  assert.equal(shadowDrift(39, false, 36), 3);
  assert.equal(shadowDrift(120, false, 120), 0, "at the cap the square follows the focus, as before");
});
