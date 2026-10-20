import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPRINGS, linearEasing, spring, springNow, springSamples } from "../assets/js/site-motion.mjs";

const scss = readFileSync(new URL("../_sass/_springs.scss", import.meta.url), "utf8");

test("every spring settles within its stated time with at most a small overshoot", () => {
  const expected = { confident: [480, 1.6], playful: [900, 12.7], layout: [602, 0.9], gentle: [757, 0.3], morph: [407, 9.5] };
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

// A stand-in page for scrollFollow: frames run by hand, the page and a row keep where they were
// sent, and the host's empty animation keeps the time the way a browser would (its state updates
// first, then the frame's callbacks run).
const followPage = (scrollY = 0) => {
  const callbacks = [];
  const view = {
    scrollY,
    scrollTo({ top }) {
      view.scrollY = top;
    },
    requestAnimationFrame(callback) {
      callbacks.push(callback);
      return callbacks.length;
    },
  };
  let finish;
  let abort;
  const animation = {
    currentTime: 0,
    playState: "running",
    finished: new Promise((resolve, reject) => {
      finish = resolve;
      abort = reject;
    }),
    cancel() {
      if (animation.playState !== "running") return;
      animation.playState = "idle";
      abort(new Error("AbortError"));
    },
  };
  const host = {
    ownerDocument: { defaultView: view },
    animate(keyframes, timing) {
      animation.keyframes = keyframes;
      animation.timing = timing;
      return animation;
    },
  };
  const frame = async (milliseconds = 16) => {
    if (animation.playState === "running") {
      animation.currentTime = Math.min(animation.timing.duration, animation.currentTime + milliseconds);
      if (animation.currentTime >= animation.timing.duration) {
        animation.playState = "finished";
        finish(animation);
      }
    }
    callbacks.splice(0).forEach((callback) => callback(animation.currentTime));
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { view, host, animation, frame };
};

test("a follow carries the page on the layout spring and lands exactly as its clock finishes", async () => {
  const { scrollFollow } = await import("../assets/js/site-motion.mjs");
  const s = spring("layout");
  const { view, host, animation, frame } = followPage(500);
  const follow = scrollFollow(s, host, { top: 800 });
  assert.deepEqual(animation.keyframes, [], "the clock moves nothing itself");
  assert.equal(animation.timing.duration, s.duration);
  assert.equal(follow.active, true);
  for (let i = 0; i < 6; i++) {
    await frame();
    const expected = 800 + s.state(-300, 0, animation.currentTime / 1000)[0];
    assert.ok(Math.abs(view.scrollY - expected) < 1e-9, `frame ${i}: ${view.scrollY} vs ${expected}`);
  }
  assert.ok(view.scrollY > 500 && view.scrollY < 800, "the page is on its way");
  while (animation.playState === "running") await frame();
  assert.equal(view.scrollY, 800, "the page arrives exactly where it was sent");
  assert.equal(follow.active, false);
  assert.equal(follow.speed(), 0);
});

test("a reader who scrolls during a follow takes the page back", async () => {
  const { scrollFollow } = await import("../assets/js/site-motion.mjs");
  const { view, host, animation, frame } = followPage(0);
  const follow = scrollFollow("layout", host, { top: 600 });
  await frame();
  await frame();
  view.scrollY += 40;
  const theirs = view.scrollY;
  await frame();
  assert.equal(follow.active, false, "the follow lets go");
  assert.equal(animation.playState, "idle", "its clock stops, so nothing waits for it");
  await frame();
  follow.land();
  assert.equal(view.scrollY, theirs, "the page stays where the reader put it");
});

test("an interrupted follow hands over the page's speed", async () => {
  const { scrollFollow } = await import("../assets/js/site-motion.mjs");
  const s = spring("layout");
  const { host, animation, frame } = followPage(0);
  const follow = scrollFollow(s, host, { top: 600, speed: 120 });
  for (let i = 0; i < 4; i++) await frame();
  const expected = s.state(-600, 120, animation.currentTime / 1000)[1];
  assert.ok(Math.abs(follow.speed() - expected) < 1e-9);
  assert.ok(follow.speed() > 0, "the page is moving toward its target");
  follow.cancel();
  assert.equal(follow.active, false);
  assert.equal(animation.playState, "idle");
});

test("a sideways row stops snapping while it follows and snaps again once done", async () => {
  const { scrollFollow } = await import("../assets/js/site-motion.mjs");
  const makeRow = () => {
    const row = {
      scrollLeft: 300,
      style: {
        scrollSnapType: "",
        removeProperty(name) {
          if (name === "scroll-snap-type") row.style.scrollSnapType = "";
        },
      },
      scrollTo({ left }) {
        row.scrollLeft = left;
      },
    };
    return row;
  };
  const landed = followPage(0);
  const row = makeRow();
  scrollFollow("layout", landed.host, { row, left: 40 });
  assert.equal(row.style.scrollSnapType, "none");
  await landed.frame();
  assert.ok(row.scrollLeft < 300 && row.scrollLeft > 40, "the row is on its way");
  assert.equal(landed.view.scrollY, 0, "a row-only follow leaves the page alone");
  while (landed.animation.playState === "running") await landed.frame();
  assert.equal(row.scrollLeft, 40);
  assert.equal(row.style.scrollSnapType, "", "the row snaps again");

  const cut = followPage(0);
  const other = makeRow();
  const follow = scrollFollow("layout", cut.host, { row: other, left: 40 });
  await cut.frame();
  follow.cancel();
  assert.equal(other.style.scrollSnapType, "", "a follow cut short gives the row its snapping back at once");
});
