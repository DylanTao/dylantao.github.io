import test from "node:test";
import assert from "node:assert/strict";
import {
  createResolutionGovernor,
  detailFor,
  FULLSCREEN_PIXEL_BUDGET,
  PIXEL_BUDGET,
  COMPACT_FULLSCREEN_PIXEL_BUDGET,
} from "../assets/js/home-scene/resolution.mjs";

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

test("touch-phone full screen responds to measured GPU stalls below one megapixel and restores embed detail", () => {
  const { g, state } = governor({ dpr: 3, base: 1.5, overrides: { compact: true } });
  const embed = g.size(390, 600);
  assert.equal(embed.adaptive, false);
  g.setProfile("fullscreen");
  const phone = g.size(390, 844);
  assert.equal(phone.density, 1.5);
  assert.equal(g.evidence().budget, COMPACT_FULLSCREEN_PIXEL_BUDGET);
  assert.ok(phone.pixels < 1_000_000 && phone.adaptive, "small phone buffers can still be fill-bound");
  feed(g, state, { interval: 8, frames: 8 });
  assert.equal(feed(g, state, { interval: 55, frames: 30 }), true);
  assert.ok(g.evidence().factor < 1);
  g.size(390, 844);
  // Reducing pixels cannot fix draw-bound stalls; the original density must come back.
  feed(g, state, { interval: 8, frames: 8 });
  feed(g, state, { interval: 55, frames: 30 });
  assert.equal(g.evidence().factor, 1);
  g.setProfile("embed");
  const returned = g.size(390, 600);
  assert.equal(returned.pixels, embed.pixels);
  assert.equal(returned.adaptive, false);
  const compact = detailFor({ width: 585, height: 1266, fullscreen: true, compact: true });
  const desktop = detailFor({ width: 585, height: 1266, fullscreen: true });
  assert.equal(compact.samples, 2);
  assert.equal(desktop.samples, 4);
  assert.equal(compact.shadowMapSize, desktop.shadowMapSize);
  assert.equal(compact.contactLongSide, desktop.contactLongSide);
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

test("full screen draws a 4K screen at its native pixels and gives the embed its budget back on exit", () => {
  // 2560x1440 CSS at DPR 1.5 is a 3840x2160 screen.
  const { g } = governor({ dpr: 1.5 });
  const embed = g.size(2560, 1440);
  assert.ok(Math.abs(embed.pixels - PIXEL_BUDGET) / PIXEL_BUDGET < 1e-6, "the embed profile keeps its budget");
  assert.equal(g.setProfile("fullscreen"), true);
  assert.equal(g.setProfile("fullscreen"), false, "an unchanged profile asks for no resize");
  const full = g.size(2560, 1440);
  assert.equal(full.cap, 1);
  assert.equal(full.width * 1.5, 3840);
  assert.equal(full.height * 1.5, 2160);
  assert.equal(g.evidence().profile, "fullscreen");
  // A 5K screen (2560x1440 at DPR 2) stops at the budget, evenly in both axes.
  const fiveK = governor({ dpr: 2 }).g;
  fiveK.setProfile("fullscreen");
  const big = fiveK.size(2560, 1440);
  assert.ok(Math.abs(big.pixels - FULLSCREEN_PIXEL_BUDGET) / FULLSCREEN_PIXEL_BUDGET < 1e-6);
  assert.equal(big.density, 2);
  // A MacBook-sized screen at DPR 2 draws every device pixel.
  const laptop = governor({ dpr: 2 }).g;
  laptop.setProfile("fullscreen");
  assert.equal(laptop.size(1512, 982).pixels, 1512 * 982 * 4);
  // Leaving full screen restores the embed's budget and density cap for the same canvas.
  assert.equal(g.setProfile("embed"), true);
  const back = g.size(1000, 480);
  assert.deepEqual([back.width, back.height, back.density], [1000, 480, 1.5]);
});

test("full screen steps down in proportion to slow frames, and a slow GPU finds its level within seconds", () => {
  const { g, state } = governor({ dpr: 1.5 });
  g.setProfile("fullscreen");
  g.size(2560, 1440);
  // 4 fps at native 4K: settling ends after 400 ms, then ten frames spanning 2.5 s decide.
  let frames = 0;
  while (!g.observe(250, 20) && frames < 40) {
    state.time += 250;
    frames++;
  }
  assert.ok(frames <= 14, `decided after ${frames} frames`);
  assert.ok(Math.abs(g.evidence().factor - 0.6) < 1e-9, "the largest single step");
  // The step helped (250 -> 90 ms) and frames are still slow: another proportional step, to the floor.
  for (let i = 0; i < 40 && !g.observe(90, 20); i++) state.time += 90;
  assert.ok(Math.abs(g.evidence().factor - 0.36) < 1e-9, `${g.evidence().factor}`);
  for (let i = 0; i < 80 && !g.observe(40, 20); i++) state.time += 40;
  assert.equal(g.evidence().factor, 0.35, "never below the full-screen floor");
  // A frame just over the slow line takes the ordinary 0.85 step, not a proportional leap.
  const mild = governor({ dpr: 1.5 });
  mild.g.setProfile("fullscreen");
  mild.g.size(2560, 1440);
  for (let i = 0; i < 80 && !mild.g.observe(26, 4); i++) mild.state.time += 26;
  assert.equal(mild.g.evidence().factor, 0.85);
});

test("the embed keeps every detail it had; large full-screen buffers trade samples for pixels", () => {
  for (const [width, height] of [
    [544, 461],
    [1500, 720],
    [1932, 1087],
  ])
    assert.deepEqual(detailFor({ width, height }), { samples: 4, contactLongSide: 480, shadowMapSize: 2048, reflection: [384, 384] });
  // Full screen below 1.5 MP (a phone) keeps the embed's shadow and mirror but a larger contact pass.
  assert.deepEqual(detailFor({ width: 786, height: 1704, fullscreen: true, maxTextureSize: 16384 }), {
    samples: 4,
    contactLongSide: 613,
    shadowMapSize: 2048,
    reflection: [384, 384],
  });
  const fourK = detailFor({ width: 3840, height: 2160, fullscreen: true, maxTextureSize: 16384 });
  assert.equal(fourK.samples, 0);
  assert.equal(fourK.contactLongSide, 1382);
  assert.equal(fourK.shadowMapSize, 4096);
  assert.deepEqual(fourK.reflection, [1024, 576]);
  assert.equal(detailFor({ width: 2688, height: 1512, fullscreen: true, maxTextureSize: 16384 }).samples, 2);
  // A GPU without 8K textures keeps the 2048 px shadow; MAX_SAMPLES caps the request.
  assert.equal(detailFor({ width: 3840, height: 2160, fullscreen: true, maxTextureSize: 4096 }).shadowMapSize, 2048);
  assert.equal(detailFor({ width: 1200, height: 800, fullscreen: true, maxSamples: 2 }).samples, 2);
});
