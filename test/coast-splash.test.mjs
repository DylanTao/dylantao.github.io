import assert from "node:assert/strict";
import test from "node:test";
import {
  SPLASH,
  capVolume,
  floatLevel,
  ringRadius,
  ringWave,
  splashDrops,
  splashFoam,
  splashRandom,
  splashTime,
  stepDrop,
  stepFloater,
} from "../assets/js/footer-coast/splash-physics.mjs";

const a = SPLASH.radius;

test("rings disperse: long waves outside, short ones inside, and the middle calms first", () => {
  assert.deepEqual(ringWave(1, 0), { height: 0, slope: 0 });
  assert.deepEqual(ringWave(0, 1), { height: 0, slope: 0 });
  assert.deepEqual(ringWave(1, -1), { height: 0, slope: 0 });
  // Finite and small everywhere, at every moment.
  for (let t = 0.02; t < SPLASH.life; t += 0.07)
    for (let r = 0.01; r < 12; r += 0.03) {
      const { height, slope } = ringWave(r, t);
      assert.ok(Number.isFinite(height) && Number.isFinite(slope));
      assert.ok(Math.abs(height) < a * 1.5, `height ${height} at r ${r}, t ${t}`);
      assert.ok(Math.abs(slope) < 1.2, `slope ${slope} at r ${r}, t ${t}`);
    }
  // At one moment, the distance between crests grows outward.
  const t = 2.2,
    crossings = [];
  let before = ringWave(2 * a, t).height;
  for (let r = 2 * a; r < 40 * a; r += a / 200) {
    const now = ringWave(r, t).height;
    if (before <= 0 && now > 0) crossings.push(r);
    before = now;
  }
  assert.ok(crossings.length >= 4, `rings at ${t} s: ${crossings.length}`);
  const gaps = crossings.slice(1).map((r, i) => r - crossings[i]);
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] > gaps[i - 1], `wavelengths ${gaps.map((g) => g.toFixed(3))} grow outward`);
  // The local wavelength is the dispersion relation's: 8 pi r^2 / (g t^2).
  const middle = (crossings[1] + crossings[2]) / 2;
  assert.ok(Math.abs(gaps[1] / ((8 * Math.PI * middle * middle) / (SPLASH.gravity * t * t)) - 1) < 0.2);
  // Near the body the water is rough early and calm later.
  const rough = (time) => Math.max(...Array.from({ length: 60 }, (_, i) => Math.abs(ringWave(a * (1.6 + i * 0.03), time).slope)));
  assert.ok(rough(0.35) > 0.15, `early slope near the body: ${rough(0.35)}`);
  assert.ok(rough(3) < rough(0.35) * 0.02, "three seconds on the middle is calm");
});

test("the tallest ring travels at the group speed of waves about as long as the body is round", () => {
  const speed = 0.42 * Math.sqrt(SPLASH.gravity * a);
  assert.ok(Math.abs(ringRadius(1) - speed) < speed * 0.01);
  assert.ok(Math.abs(ringRadius(4) - 4 * speed) < speed * 0.04);
  for (const t of [1, 2, 3.5]) {
    // Where the rings are tallest at that moment.
    let best = 0,
      at = 0;
    for (let r = 1.5 * a; r < 40 * a; r += a / 100) {
      const envelope = Math.hypot(ringWave(r, t).height, ringWave(r + (Math.PI * 2 * r * r) / (SPLASH.gravity * t * t), t).height);
      if (envelope > best) {
        best = envelope;
        at = r;
      }
    }
    assert.ok(Math.abs(at / ringRadius(t) - 1) < 0.3, `tallest at ${at.toFixed(2)} for ${ringRadius(t).toFixed(2)} at ${t} s`);
  }
  // Three body radii out the largest slope is about a quarter: enough to sway a reflection.
  let steepest = 0;
  for (let t = 0.05; t < 4; t += 0.01) steepest = Math.max(steepest, Math.abs(ringWave(3 * a, t).slope));
  assert.ok(steepest > 0.15 && steepest < 0.45, `steepest at three radii: ${steepest}`);
  // The slope is the height's own slope: the two keep step along the rings.
  let both = 0,
    one = 0,
    other = 0;
  const t = 2;
  for (let r = 3 * a; r < 16 * a; r += a / 50) {
    const numeric = (ringWave(r + 1e-4, t).height - ringWave(r - 1e-4, t).height) / 2e-4,
      { slope } = ringWave(r, t);
    both += numeric * slope;
    one += numeric * numeric;
    other += slope * slope;
  }
  assert.ok(both / Math.sqrt(one * other) > 0.97, `slope and height agree: ${both / Math.sqrt(one * other)}`);
});

test("the churned foam spreads to a few body radii and is gone in a few seconds", () => {
  assert.equal(splashFoam(0, 0), 0);
  assert.ok(splashFoam(0.01, 0.1) > 0.95);
  assert.equal(splashFoam(a * (SPLASH.foamReach + 0.1), 1.5), 0);
  assert.ok(splashFoam(a * 2, 1.2) > 0.3, "it has spread past two radii by then");
  assert.equal(splashFoam(a * 2, 0.02), 0, "and had not at first");
  assert.equal(splashFoam(0.01, SPLASH.foamLife + 0.01), 0);
  let last = 1;
  for (let t = 0.2; t < SPLASH.foamLife; t += 0.2) {
    // (In the middle: farther out it first thickens, as the patch spreads to reach there.)
    const now = splashFoam(0.01, t);
    assert.ok(now <= last + 1e-9, "it only thins");
    last = now;
  }
});

test("one impact always throws the same drops: a crown from the rim, then a jet from the middle", () => {
  const random = splashRandom(7),
    again = splashRandom(7);
  for (let i = 0; i < 50; i++) {
    const value = random();
    assert.ok(value >= 0 && value < 1);
    assert.equal(value, again());
  }
  const impact = { x: 3, z: 9, speed: 8, seed: 11 },
    drops = splashDrops(impact);
  assert.equal(drops.length, SPLASH.crown + SPLASH.jet);
  assert.deepEqual(splashDrops(impact), drops);
  assert.notDeepEqual(splashDrops({ ...impact, seed: 12 }), drops);
  const crown = drops.slice(0, SPLASH.crown),
    jet = drops.slice(SPLASH.crown),
    closes = SPLASH.jetDelay * splashTime();
  for (const drop of crown) {
    const out = Math.hypot(drop.x - impact.x, drop.z - impact.z);
    assert.ok(out > a * 0.8 && out < a * 1.35, "from the rim");
    assert.ok(drop.vy > 0 && drop.at < 0.06);
    // Outward and upward, 50 to 78 degrees above the water.
    const along = (drop.vx * (drop.x - impact.x) + drop.vz * (drop.z - impact.z)) / out,
      lean = Math.atan2(drop.vy, along);
    assert.ok(along > 0 && lean > 0.86 && lean < 1.38, `lean ${lean}`);
    assert.ok(Math.hypot(drop.vx, drop.vy, drop.vz) < impact.speed * 0.63);
  }
  for (const drop of jet) {
    assert.ok(drop.at >= closes && drop.at < closes + 0.08, "when the cavity closes");
    assert.ok(Math.hypot(drop.x - impact.x, drop.z - impact.z) < a * 0.25, "from the middle");
    assert.ok(drop.vy > impact.speed * 0.44 && Math.hypot(drop.vx, drop.vz) < drop.vy * 0.1, "almost straight up");
  }
  // The jet's fastest drop rises higher than the crown's.
  const rise = (list) => Math.max(...list.map((drop) => (drop.vy * drop.vy) / (2 * SPLASH.gravity)));
  assert.ok(rise(jet) > rise(crown));
  assert.ok(rise(jet) < 2.6 && rise(crown) > 0.25, `crown ${rise(crown)}, jet ${rise(jet)} units high`);
});

test("a drop flies a ballistic path and comes back to the sea", () => {
  // Without drag, exactly the parabola.
  const drop = { x: 0, y: 0, z: 0, vx: 1.5, vy: 6, vz: -0.5 };
  const dt = 1 / 240;
  let t = 0;
  for (let i = 0; i < 120; i++) {
    stepDrop(drop, dt, { drag: 0 });
    t += dt;
  }
  assert.ok(Math.abs(drop.x - 1.5 * t) < 1e-9 && Math.abs(drop.z + 0.5 * t) < 1e-9);
  // Semi-implicit Euler: the height is off by half a step of gravity.
  assert.ok(Math.abs(drop.y - (6 * t - (SPLASH.gravity * t * t) / 2)) < SPLASH.gravity * t * dt);
  // Every drop of an impact is back within two seconds of leaving.
  for (const thrown of splashDrops({ x: 0, z: 0, speed: SPLASH.entrySpeed[1], seed: 3 })) {
    let flight = 0;
    while (thrown.y >= 0 && flight < 3) {
      stepDrop(thrown, 1 / 120);
      flight += 1 / 120;
    }
    assert.ok(flight < 2, `a drop flew ${flight} s`);
  }
});

test("an orange floats: Archimedes sets how high", () => {
  const whole = (4 / 3) * Math.PI * a ** 3;
  assert.ok(Math.abs(capVolume(2 * a, a) - whole) < 1e-12);
  assert.ok(Math.abs(capVolume(a, a) - whole / 2) < 1e-12);
  assert.equal(capVolume(-1, a), 0);
  assert.equal(capVolume(9, a), capVolume(2 * a, a));
  const level = floatLevel();
  assert.ok(Math.abs(capVolume(a - level, a) / whole - SPLASH.density) < 1e-9);
  assert.ok(level < 0 && level > -a, "its centre rides below the surface, its top above");
  assert.ok(Math.abs((a + level) / (2 * a) - 0.35) < 0.02, "about a third of its height is dry");
  assert.ok(Math.abs(floatLevel(a, 0.5)) < 1e-9, "a body half as dense as water floats half in");
  // At rest it stays at rest, and on a risen sea it rides that much higher.
  const resting = { y: level, vy: 0 };
  stepFloater(resting, 2);
  assert.ok(Math.abs(resting.y - level) < 1e-6 && Math.abs(resting.vy) < 1e-6);
  const lifted = { y: level, vy: 0 };
  stepFloater(lifted, 6, { surface: 0.05 });
  assert.ok(Math.abs(lifted.y - (level + 0.05)) < 5e-3);
});

test("dropped in, it slams, plunges, comes back up and settles", () => {
  const level = floatLevel(),
    state = { y: a, vy: -8 },
    dt = 1 / 60;
  let deepest = state.y,
    highestAfter = -Infinity,
    under = 0,
    surfacedAt = null,
    slowed = null;
  for (let t = 0; t < 8; t += dt) {
    stepFloater(state, dt);
    if (slowed === null && state.y <= 0) slowed = -state.vy;
    deepest = Math.min(deepest, state.y);
    if (state.y < -a) under += dt;
    else if (deepest < -a && surfacedAt === null) surfacedAt = t;
    if (surfacedAt !== null) highestAfter = Math.max(highestAfter, state.y);
  }
  // Taking on the water's mass stops most of it within one radius.
  assert.ok(slowed < 8 * 0.75 && slowed > 8 * 0.4, `one radius in it still falls at ${slowed}`);
  assert.ok(deepest < -1.3 * a && deepest > -9 * a, `it goes ${(-deepest / a).toFixed(1)} radii under`);
  assert.ok(surfacedAt > 0.3 && surfacedAt < 1.8, `and is back at ${surfacedAt?.toFixed(2)} s`);
  assert.ok(under > 0.2 && under < 1.7);
  assert.ok(highestAfter < a * 1.2, "it breaches a little and never leaves the water");
  assert.ok(Math.abs(state.y - level) < a * 0.01 && Math.abs(state.vy) < 0.01, `settled at ${state.y} for ${level}`);
});
