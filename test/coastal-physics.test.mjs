import test from "node:test";
import assert from "node:assert/strict";
import { criticalStep, rotorStep, createRecordMotion, RECORD_RPM } from "../assets/js/home-scene/record-motion.mjs";
import { OCEAN_WAVES, sampleOcean, waterFresnel, WATER_IOR } from "../assets/js/home-scene/ocean-spectrum.mjs";
import { coastalDaylight } from "../assets/js/home-scene/daylight.mjs";
const close = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b}`);

test("exact critical damping and motor angle integral are independent of frame partition", () => {
  const spring = criticalStep(0.7, -1.8, 0.1, 0.9),
    motor = rotorStep(6.2, 0.4, 3.49, 0.9);
  let s = [0.7, -1.8],
    m = [6.2, 0.4];
  for (let i = 0; i < 270; i++) {
    s = criticalStep(...s, 0.1, 1 / 300);
    m = rotorStep(...m, 3.49, 1 / 300);
  }
  spring.forEach((value, i) => close(value, s[i]));
  motor.forEach((value, i) => close(value, m[i]));
  assert.ok(motor[0] > Math.PI * 2, "the physical phase must not reset at a revolution");
});

test("repeated play, cue, brake and restart retain position and velocity at the interruption", () => {
  const motion = createRecordMotion();
  motion.setPlaying(true);
  for (let i = 0; i < 24; i++) {
    motion.advance(0.043);
    const before = motion.evidence();
    if (i % 3 === 0) motion.cue();
    else motion.setPlaying(i % 2 === 0);
    const after = motion.evidence();
    for (const key of ["angle", "velocity", "yaw", "yawVelocity", "lift", "liftVelocity"]) close(before[key], after[key]);
    assert.ok(after.lift >= 0.1, "the needle cannot penetrate the disc");
  }
  motion.setPlaying(true);
  motion.advance(5);
  assert.equal(motion.evidence().phase, "tracking");
  close(motion.evidence().rpm, RECORD_RPM, 0.1);
  close(motion.evidence().lift, 0.1, 0.00001);
  motion.setPlaying(false);
  let energy = motion.evidence().energy;
  for (let i = 0; i < 50; i++) {
    motion.advance(0.1);
    assert.ok(motion.evidence().energy <= energy, "braking must dissipate energy");
    energy = motion.evidence().energy;
  }
  assert.equal(motion.evidence().phase, "parked");
  assert.equal(motion.needsFrame(), false);
});

test("cue lifts before traversing and lowers after reaching the groove; composed still retains phase", () => {
  const motion = createRecordMotion(),
    phases = new Set();
  motion.setPlaying(true);
  for (let i = 0; i < 500; i++) {
    const before = motion.evidence();
    const pose = motion.advance(1 / 120);
    phases.add(pose.phase);
    if (Math.abs(pose.yaw - before.yaw) > 0.00001 && Math.abs(before.yaw) > 0.004) assert.ok(pose.lift > 0.44, "swing must clear the record");
    assert.ok(pose.lift >= 0.1);
  }
  assert.deepEqual(phases, new Set(["lifting", "swinging", "lowering", "tracking"]));
  const angle = motion.evidence().angle;
  motion.compose();
  close(motion.evidence().angle, angle);
  assert.equal(motion.evidence().phase, "tracking");
});

test("a held artwork cue stays above the disc and releasing it adds no position or velocity impulse", () => {
  const motion = createRecordMotion();
  motion.setPlaying(true);
  motion.advance(5);
  motion.cue(true);
  motion.advance(2);
  const held = motion.evidence();
  assert.equal(held.phase, "swinging");
  assert.ok(held.lift > 0.456);
  assert.ok(held.rpm < 0.1, "a held transfer brakes the driven platter");
  motion.completeCue();
  assert.deepEqual(motion.evidence(), held);
  motion.advance(2);
  assert.equal(motion.evidence().phase, "tracking");
  close(motion.evidence().lift, 0.1, 0.00001);
});

test("ocean analytic tangents match finite differences of the actual choppy displacement", () => {
  const h = 0.00001;
  for (const [x, z, time, footprint] of [
    [0, 0, 0, 0],
    [3.9, -7.2, 11.4, 0.02],
    [-22, 14, 39.8, 0.18],
  ]) {
    const center = sampleOcean(x, z, time, footprint);
    const point = (xx, zz) => {
      const d = sampleOcean(xx, zz, time, footprint).displacement;
      return [xx + d[0], d[1], zz + d[2]];
    };
    for (const [axis, dx, dz] of [
      ["tangentX", h, 0],
      ["tangentZ", 0, h],
    ]) {
      const plus = point(x + dx, z + dz),
        minus = point(x - dx, z - dz);
      center[axis].forEach((value, i) => close(value, (plus[i] - minus[i]) / (2 * h), 0.000001));
    }
    close(Math.hypot(...center.normal), 1);
    assert.ok(center.normal[1] > 0.9);
  }
});

test("wave steepness prevents foldover and filtered slope energy remains accounted for", () => {
  const bound = OCEAN_WAVES.reduce((sum, w) => sum + w.choppiness * w.amplitude * w.k, 0),
    totalVariance = OCEAN_WAVES.reduce((sum, w) => sum + 0.5 * (w.amplitude * w.k) ** 2, 0);
  assert.ok(bound < 0.3);
  for (let t = 0; t < 12; t++)
    for (let x = -16; x < 16; x += 3) for (let z = -12; z < 12; z += 3) assert.ok(sampleOcean(x, z, t).jacobian > (1 - bound) ** 2);
  let previous = -1;
  for (const footprint of [0, 0.01, 0.1, 1, 10]) {
    const lost = sampleOcean(0, 0, 0, footprint).lostVariance,
      resolved = OCEAN_WAVES.reduce((sum, w) => sum + 0.5 * (w.amplitude * w.k) ** 2 * Math.exp(-((w.k * footprint) ** 2)), 0);
    close(resolved + lost, totalVariance);
    assert.ok(lost >= previous);
    previous = lost;
  }
});

test("dielectric reflection is about two percent head-on and approaches one at grazing", () => {
  close(waterFresnel(1), ((WATER_IOR - 1) / (WATER_IOR + 1)) ** 2);
  close(waterFresnel(0), 1);
  let previous = 0;
  for (let i = 100; i >= 0; i--) {
    const value = waterFresnel(i / 100);
    assert.ok(value >= previous - 0.000001);
    assert.ok(value >= 0 && value <= 1);
    previous = value;
  }
});

test("La Jolla light respects Pacific daylight saving time and crosses east to west", () => {
  const morning = coastalDaylight("2026-09-30", 9 * 60),
    afternoon = coastalDaylight("2026-09-30", 16 * 60),
    night = coastalDaylight("2026-09-30", 23 * 60);
  assert.equal(morning.offset, -7);
  assert.equal(coastalDaylight("2026-01-01", 12 * 60).offset, -8);
  assert.ok(morning.direction[2] > 0 && afternoon.direction[2] < 0);
  assert.ok(morning.altitude > 10 && afternoon.altitude > 10);
  assert.equal(night.sunlight, 0);
  assert.ok(night.altitude < 0);
  close(Math.hypot(...morning.direction), 1);
});
