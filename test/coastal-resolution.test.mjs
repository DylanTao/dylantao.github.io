import test from "node:test";
import assert from "node:assert/strict";
import { createResolutionGovernor, PIXEL_BUDGET } from "../assets/js/home-scene/resolution.mjs";

// A governor with a controllable device pixel ratio and clock.
function governor(options = {}) {
  const state = { dpr: options.dpr ?? 1, time: 0 };
  const g = createResolutionGovernor({
    basePixelRatio: options.base ?? Math.min(state.dpr, 1.5),
    devicePixelRatio: () => state.dpr,
    now: () => state.time,
    ...options.overrides,
  });
  return { g, state };
}

// Feed `frames` moving frames, one second of clock per window, and report factor changes.
function feed(g, state, { interval, submit = 4, frames = 60 }) {
  let changed = false;
  for (let i = 0; i < frames; i++) {
    state.time += interval;
    if (g.observe(interval, submit)) changed = true;
  }
  state.time += 1000;
  return changed;
}

test("the ordinary canvas passes its CSS size through exactly, at any supported density", () => {
  for (const dpr of [1, 1.25, 1.5]) {
    const { g } = governor({ dpr });
    const size = g.size(544.859375, 460.796875);
    assert.equal(size.width, 544.859375);
    assert.equal(size.height, 460.796875);
    assert.equal(size.factor, 1);
    assert.equal(size.adaptive, false);
  }
  // A phone at DPR 3 still draws at the 1.5 cap the renderer was built with.
  const phone = governor({ dpr: 3, base: 1.5 }).g.size(390, 600);
  assert.deepEqual([phone.width, phone.height, phone.density], [390, 600, 1.5]);
});

test("full screen stays within the pixel budget with the renderer's pixel ratio unchanged", () => {
  const { g } = governor({ dpr: 1.5 });
  const size = g.size(2560, 1440);
  // The renderer and the composer multiply the logical size by the construction ratio, 1.5.
  const drawn = size.width * 1.5 * size.height * 1.5;
  assert.ok(Math.abs(drawn - PIXEL_BUDGET) / PIXEL_BUDGET < 1e-9, `${drawn}`);
  assert.ok(Math.abs(size.width / size.height - 2560 / 1440) < 1e-12, "aspect is preserved");
  assert.ok(size.cap > 0.5 && size.cap < 0.51, `${size.cap}`);
  assert.equal(size.adaptive, true);
  // A 1920x1080 screen at DPR 1 fits the budget and draws every pixel.
  const hd = governor({ dpr: 1 }).g.size(1920, 1080);
  assert.deepEqual([hd.width, hd.height, hd.cap], [1920, 1080, 1]);
});

test("a display change after start draws at the new density through the logical size", () => {
  const { g, state } = governor({ dpr: 1 });
  state.dpr = 1.5;
  const size = g.size(800, 400);
  assert.equal(size.width, 1200);
  assert.equal(size.height, 600);
});

test("slow GPU-bound frames step down only while each step helps, then hold", () => {
  const { g, state } = governor({ dpr: 1.5 });
  g.size(2560, 1440);
  feed(g, state, { interval: 8, frames: 8 }); // the settle frames after a resize
  assert.equal(feed(g, state, { interval: 40 }), true, "slow frames probe a lower density");
  assert.equal(g.evidence().factor, 0.85);
  g.size(2560, 1440);
  feed(g, state, { interval: 8, frames: 8 });
  // The probe helped (40 -> 30 ms), so it is kept, and the still-slow frames step again.
  assert.equal(feed(g, state, { interval: 30 }), true);
  assert.ok(Math.abs(g.evidence().factor - 0.7225) < 1e-9);
  g.size(2560, 1440);
  feed(g, state, { interval: 8, frames: 8 });
  feed(g, state, { interval: 26 });
  assert.equal(g.evidence().factor, 0.7, "never below the floor");
});

test("a probe that does not help is undone, and probing stops after two", () => {
  const { g, state } = governor({ dpr: 1.5 });
  g.size(2560, 1440);
  for (let attempt = 0; attempt < 2; attempt++) {
    feed(g, state, { interval: 8, frames: 8 });
    assert.equal(feed(g, state, { interval: 40 }), true);
    feed(g, state, { interval: 8, frames: 8 });
    assert.equal(feed(g, state, { interval: 40 }), true, "the unhelpful step is reverted");
    assert.equal(g.evidence().factor, 1);
  }
  feed(g, state, { interval: 8, frames: 8 });
  assert.equal(feed(g, state, { interval: 40 }), false, "no third probe");
  assert.equal(g.evidence().failedProbes, 2);
});

test("script-bound frames never trade pixels, and the ordinary canvas never adapts", () => {
  const big = governor({ dpr: 1.5 });
  big.g.size(2560, 1440);
  feed(big.g, big.state, { interval: 8, frames: 8 });
  assert.equal(feed(big.g, big.state, { interval: 90, submit: 85 }), false);
  const small = governor({ dpr: 1 });
  small.g.size(544, 460);
  assert.equal(feed(small.g, small.state, { interval: 60 }), false);
  assert.equal(feed(small.g, small.state, { interval: 60 }), false);
});

test("sustained fast frames climb back to full density, and a new canvas size starts fresh", () => {
  const { g, state } = governor({ dpr: 1.5 });
  g.size(2560, 1440);
  feed(g, state, { interval: 8, frames: 8 });
  feed(g, state, { interval: 40 });
  feed(g, state, { interval: 8, frames: 8 });
  feed(g, state, { interval: 30 });
  assert.ok(g.evidence().factor < 1);
  let raised = 0;
  for (let i = 0; i < 12 && g.evidence().factor < 1; i++) if (feed(g, state, { interval: 16.7 })) raised++;
  assert.equal(g.evidence().factor, 1);
  assert.ok(raised >= 2);
  feed(g, state, { interval: 40 });
  g.size(1280, 720);
  assert.equal(g.evidence().factor, 1, "resizing restarts adaptation");
});
