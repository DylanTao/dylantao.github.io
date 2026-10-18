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
