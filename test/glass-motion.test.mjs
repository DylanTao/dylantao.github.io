import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRESS_SELECTOR, REST, TILT, TILT_SELECTOR, stepTilt, tiltFromPointer } from "../assets/js/glass-motion.mjs";
import { spring } from "../assets/js/site-motion.mjs";

const box = { left: 100, top: 50, width: 400, height: 300 };

test("the pointer at the centre leaves the card level, with the highlight in the middle", () => {
  const lean = tiltFromPointer(300, 200, box);
  assert.equal(lean.rx, -0);
  assert.equal(lean.ry, 0);
  assert.equal(lean.gx, 50);
  assert.equal(lean.gy, 50);
});

test("the edge under the pointer dips by at most a few degrees and the picture drifts against it", () => {
  const corner = tiltFromPointer(500, 350, box);
  assert.equal(corner.ry, TILT.maxY, "the right edge dips by the full lean");
  assert.equal(corner.rx, -TILT.maxX, "the bottom edge dips by the full lean");
  assert.ok(corner.dx < 0 && corner.dy < 0, "the picture drifts toward the opposite corner");
  assert.ok(Math.max(Math.abs(corner.rx), Math.abs(corner.ry)) <= 5, "a few degrees, never more");
  // Outside the box (a fast pointer that left between frames) is held at the edge.
  const outside = tiltFromPointer(5000, -5000, box);
  assert.equal(outside.ry, TILT.maxY);
  assert.equal(outside.rx, TILT.maxX);
  assert.equal(outside.gx, 100);
  assert.equal(outside.gy, 0);
});

test("an empty box never produces a lean", () => {
  assert.deepEqual(tiltFromPointer(10, 10, { left: 0, top: 0, width: 0, height: 0 }), { rx: 0, ry: 0, gx: 50, gy: 50, dx: 0, dy: 0 });
});

test("a released card springs back to rest and reports when it has settled", () => {
  const motion = spring("confident");
  let state = { ...REST, rx: 3, ry: -4, lift: -4, hover: 1, dx: 4, dy: -3, gx: 80, gy: 20 };
  const target = { ...REST, gx: 80, gy: 20 };
  let frames = 0;
  while (!state.settled && frames < 240) {
    state = stepTilt(state, target, 1 / 60, motion);
    frames += 1;
  }
  assert.ok(state.settled, "it settles");
  assert.ok(frames <= Math.ceil((motion.duration / 1000) * 60) + 6, `settled in ${frames} frames`);
  assert.ok(Math.abs(state.rx) < 0.01 && Math.abs(state.hover) < 0.01);
});

test("a tilt step is frame-rate independent", () => {
  const motion = spring("confident");
  const start = { ...REST, rx: 0, vrx: 0 };
  const target = { rx: 3 };
  let fast = start;
  for (let i = 0; i < 12; i++) fast = stepTilt(fast, target, 1 / 120, motion);
  let slow = start;
  for (let i = 0; i < 6; i++) slow = stepTilt(slow, target, 1 / 60, motion);
  assert.ok(Math.abs(fast.rx - slow.rx) < 1e-9, `${fast.rx} vs ${slow.rx}`);
});

test("press reaches every glass card and button, and the stylesheet presses only under glass-motion", () => {
  for (const selector of [".projects .project-card > .card", ".blog-card", ".lab-card"]) assert.ok(TILT_SELECTOR.includes(selector), selector);
  for (const selector of [".project-card-open-link", ".project-case-actions a", ".blog-layout-toggle button", ".project-deck-trail button"]) {
    assert.ok(PRESS_SELECTOR.includes(selector), selector);
  }
  const scss = readFileSync(new URL("../_sass/_glass.scss", import.meta.url), "utf8");
  assert.match(scss, /@property --glass-press/);
  assert.match(scss, /html\.glass-motion/);
  assert.match(scss, /prefers-reduced-transparency: reduce/);
  assert.match(scss, /prefers-contrast: more/);
  assert.match(scss, /forced-colors: active/);
  // PurgeCSS keeps runtime classes only when the scripts name them literally.
  const script = readFileSync(new URL("../assets/js/glass-motion.mjs", import.meta.url), "utf8");
  for (const name of ['"glass-motion"', '"glass-tilt"', '"is-pressed"']) assert.ok(script.includes(name), name);
});
