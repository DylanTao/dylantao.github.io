import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPRINGS, linearEasing, spring, springNow, springSamples } from "../assets/js/site-motion.mjs";

const scss = readFileSync(new URL("../_sass/_springs.scss", import.meta.url), "utf8");

test("every spring settles within its stated time with at most a small overshoot", () => {
  const expected = { confident: [480, 1.6], playful: [900, 12.7], layout: [602, 0.9], gentle: [757, 0.3] };
  for (const [name, [milliseconds, overshoot]] of Object.entries(expected)) {
    const s = spring(name);
    assert.ok(Math.abs(s.duration - milliseconds) < 2, `${name} settles in ${s.duration} ms`);
    let peak = 0;
    for (let i = 0; i <= 400; i++) peak = Math.max(peak, s.ease(i / 400));
    assert.ok((peak - 1) * 100 <= overshoot, `${name} overshoots ${((peak - 1) * 100).toFixed(2)}%`);
    assert.equal(s.ease(0), 0);
    assert.equal(s.ease(1), 1);
    // The settle time is where the decay envelope reaches 0.1%; the response itself is bounded by
    // that envelope times 1/sqrt(1 - zeta^2).
    const bound = 0.001 / Math.sqrt(1 - s.zeta * s.zeta) + 1e-9;
    assert.ok(Math.abs(s.state(1, 0, s.seconds)[0]) <= bound, `${name} has settled by its settle time`);
  }
});

test("the stylesheet's linear() curves are the module's springs", () => {
  for (const name of Object.keys(SPRINGS)) {
    const match = scss.match(new RegExp(`--spring-${name}:\\s*linear\\(([^)]*)\\)`));
    assert.ok(match, `_sass/_springs.scss declares --spring-${name} as linear()`);
    const css = match[1].split(",").map((value) => Number(value.trim()));
    const js = linearEasing(name).slice("linear(".length, -1).split(", ").map(Number);
    assert.equal(css.length, js.length, `${name} sample count`);
    css.forEach((value, i) => assert.ok(Math.abs(value - js[i]) <= 0.0011, `${name}[${i}] ${value} vs ${js[i]}`));
  }
});

test("velocity is the derivative of offset, so a handed-over motion has no kink", () => {
  const s = spring("layout");
  for (const [x0, v0] of [
    [120, 0],
    [-80, 900],
    [0, -1500],
  ]) {
    for (const t of [0, 0.03, 0.12, 0.31]) {
      const h = 1e-5;
      const numeric = (s.state(x0, v0, t + h)[0] - s.state(x0, v0, t - h)[0]) / (2 * h);
      assert.ok(Math.abs(numeric - s.state(x0, v0, t)[1]) < 1e-3 * Math.max(1, Math.abs(numeric)), `x0 ${x0}, v0 ${v0}, t ${t}`);
    }
    assert.equal(s.state(x0, v0, 0)[1], v0);
  }
});

test("an interrupted spring restarted from its current offset and speed follows the same path", () => {
  const s = spring("layout");
  const [x1, v1] = springNow(s, 240, -300, 140);
  for (const later of [0.02, 0.1, 0.25]) {
    const direct = s.state(240, -300, 0.14 + later)[0];
    const resumed = s.state(x1, v1, later)[0];
    assert.ok(Math.abs(direct - resumed) < 1e-9, `${direct} vs ${resumed}`);
  }
});

test("keyframe samples start at the offset and end exactly at rest", () => {
  const samples = springSamples("layout", 180, 0, spring("layout").duration, 30);
  assert.equal(samples.length, 31);
  assert.equal(samples[0], 180);
  assert.equal(samples.at(-1), 0);
  assert.ok(
    samples.every((value) => value > -2),
    "a 180 px move overshoots by under 2 px"
  );
});

test("a spring step chasing a still target follows the closed-form path at any frame rate", async () => {
  const { springStep } = await import("../assets/js/site-motion.mjs");
  const s = spring("confident");
  let value = 0;
  let velocity = 0;
  for (let frame = 0; frame < 30; frame++) [value, velocity] = springStep(s, value, velocity, 10, 1 / 60);
  const direct = 10 + s.state(-10, 0, 30 / 60)[0];
  assert.ok(Math.abs(value - direct) < 1e-9, `${value} vs ${direct}`);
  // A long hitch (a hidden tab) is clamped instead of flinging the value past its target.
  const [afterHitch] = springStep(s, 0, 0, 10, 4);
  assert.ok(afterHitch <= 10.2, `a 4 s frame overshot to ${afterHitch}`);
});

test("a ripple reaches nearer elements first and never waits past its cap", async () => {
  const { rippleDelays } = await import("../assets/js/site-motion.mjs");
  const delays = rippleDelays(
    [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 600, y: 400 },
      { x: 4000, y: 0 },
    ],
    { x: 0, y: 0 }
  );
  assert.equal(delays[0], 0);
  assert.ok(delays[1] < delays[2], "nearer moves first");
  assert.equal(delays[3], 120, "far elements wait at most the cap");
});

test("a flight stretches as it speeds up, squashes as it lands, keeps its area and ends at rest", async () => {
  const { flightFrames } = await import("../assets/js/site-motion.mjs");
  const frames = flightFrames("layout", { x0: 0, y0: 360 });
  assert.equal(frames.length, 31);
  assert.equal(frames.at(-1), "translate(0px, 0px)");
  assert.match(frames[0], /^translate\(0\.00px, 360\.00px\)$/, "the first frame keeps the resting shape");
  const scales = frames
    .map((frame) => frame.match(/scale\(([\d.]+), ([\d.]+)\)/))
    .filter(Boolean)
    .map((match) => [Number(match[1]), Number(match[2])]);
  assert.ok(scales.length > 5, "a long trip deforms along the way");
  for (const [along, across] of scales) {
    assert.ok(Math.abs(along * across - 1) < 0.001, "the deformation keeps the area");
    assert.ok(Math.abs(along - 1) <= 0.0301, `deformation ${along} stays within 3%`);
  }
  assert.ok(
    scales.some(([along]) => along > 1),
    "it stretches while accelerating"
  );
  assert.ok(
    scales.some(([along]) => along < 1),
    "it squashes while slowing"
  );
  // A short hop barely deforms.
  const hop = flightFrames("layout", { x0: 12, y0: 0 });
  const hopScales = hop
    .map((frame) => frame.match(/scale\(([\d.]+),/))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  assert.ok(
    hopScales.every((value) => Math.abs(value - 1) < 0.002),
    "a 12 px move stays nearly rigid"
  );
});
