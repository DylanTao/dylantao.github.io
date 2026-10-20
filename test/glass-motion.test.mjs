import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRESS_SELECTOR, REST, SURFACE_SELECTOR, lightFromPointer, stepSurface } from "../assets/js/glass-motion.mjs";
import { spring } from "../assets/js/site-motion.mjs";

const box = { left: 100, top: 50, width: 400, height: 300 };

test("the light sits under the pointer, in percent of the card", () => {
  assert.deepEqual(lightFromPointer(300, 200, box), { gx: 50, gy: 50 });
  assert.deepEqual(lightFromPointer(100, 50, box), { gx: 0, gy: 0 });
  assert.deepEqual(lightFromPointer(500, 350, box), { gx: 100, gy: 100 });
  // Outside the box (a fast pointer that left between frames) is held at the edge.
  assert.deepEqual(lightFromPointer(5000, -5000, box), { gx: 100, gy: 0 });
});

test("an empty box puts the light in the middle", () => {
  assert.deepEqual(lightFromPointer(10, 10, { left: 0, top: 0, width: 0, height: 0 }), { gx: 50, gy: 50 });
});

test("flat cards never lean: the pointer moves a light, not the card (2026-10-19)", () => {
  const light = lightFromPointer(480, 60, box);
  assert.deepEqual(Object.keys(light).sort(), ["gx", "gy"]);
  const scss = readFileSync(new URL("../_sass/_glass.scss", import.meta.url), "utf8");
  assert.doesNotMatch(scss, /rotateX|rotateY|perspective\(/, "no card tilts toward the pointer");
  assert.doesNotMatch(scss, /feTurbulence/, "no paper grain on content surfaces");
  const script = readFileSync(new URL("../assets/js/glass-motion.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(script, /--glass-rx|--glass-drift/, "no lean or picture drift is written");
});

test("a released light fades back to rest and reports when it has settled", () => {
  const motion = spring("confident");
  let state = { ...REST, hover: 1, gx: 80, gy: 20 };
  const target = { ...REST, gx: 80, gy: 20 };
  let frames = 0;
  while (!state.settled && frames < 240) {
    state = stepSurface(state, target, 1 / 60, motion);
    frames += 1;
  }
  assert.ok(state.settled, "it settles");
  assert.ok(frames <= Math.ceil((motion.duration / 1000) * 60) + 6, `settled in ${frames} frames`);
  assert.ok(Math.abs(state.hover) < 0.01);
});

test("a light step is frame-rate independent", () => {
  const motion = spring("confident");
  const start = { ...REST, gx: 0, vgx: 0 };
  const target = { gx: 60 };
  let fast = start;
  for (let i = 0; i < 12; i++) fast = stepSurface(fast, target, 1 / 120, motion);
  let slow = start;
  for (let i = 0; i < 6; i++) slow = stepSurface(slow, target, 1 / 60, motion);
  assert.ok(Math.abs(fast.gx - slow.gx) < 1e-9, `${fast.gx} vs ${slow.gx}`);
});

test("press reaches every card and button, and the stylesheet presses only under glass-motion", () => {
  for (const selector of [".projects .project-card > .card", ".blog-card", ".lab-card"]) assert.ok(SURFACE_SELECTOR.includes(selector), selector);
  for (const selector of [".project-card-open-link", ".project-case-actions a", ".blog-layout-toggle button", ".project-deck-trail button"]) {
    assert.ok(PRESS_SELECTOR.includes(selector), selector);
  }
  const scss = readFileSync(new URL("../_sass/_glass.scss", import.meta.url), "utf8");
  assert.match(scss, /@property --glass-press/);
  assert.match(scss, /html\.glass-motion/);
  assert.match(scss, /prefers-reduced-transparency: reduce/);
  assert.match(scss, /prefers-contrast: more/);
  assert.match(scss, /forced-colors: active/);
  // A press squares a button's corners on the morph spring (Material 3 Expressive) instead of a gloss change.
  assert.match(scss, /border-radius var\(--spring-morph-duration\) var\(--spring-morph\)/);
  // PurgeCSS keeps runtime classes only when the scripts name them literally.
  const script = readFileSync(new URL("../assets/js/glass-motion.mjs", import.meta.url), "utf8");
  for (const name of ['"glass-motion"', '"glass-hover"', '"is-pressed"']) assert.ok(script.includes(name), name);
});
