import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  rabbitActing,
  rabbitSchedule,
  pinnipedActing,
  pinnipedSchedule,
  sealShuffleOffset,
  swimmerActing,
  RABBIT_EPOCH,
  SWIM_PERIOD,
} from "../assets/js/home-scene/wildlife-motion.mjs";
import { springStep, sprung, epochAt, hash } from "../assets/js/home-scene/wildlife-acting.mjs";
import { habitatPoint } from "../assets/js/home-scene/shore.mjs";
import { sampleOcean } from "../assets/js/home-scene/ocean-spectrum.mjs";

const manifest = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const numbers = (pose) => Object.values(pose).filter((value) => typeof value === "number");
const POSTURE = [
  "chestPitch",
  "hipsPitch",
  "bodyLift",
  "headPitch",
  "headYaw",
  "earLeft",
  "earRight",
  "earYawLeft",
  "earYawRight",
  "tail",
  "pawRaise",
];

test("spring superposition starts at rest, settles to the target and overshoots when underdamped", () => {
  near(springStep(0, 2, 0.5), 0);
  near(springStep(-1, 2, 0.5), 0);
  near(springStep(10, 2, 0.5), 1, 1e-9);
  const peak = Math.max(...Array.from({ length: 200 }, (_, i) => springStep(i * 0.005, 2, 0.35)));
  assert.ok(peak > 1.2 && peak < 1.4, `underdamped overshoot ${peak}`);
  assert.ok(Math.max(...Array.from({ length: 200 }, (_, i) => springStep(i * 0.005, 2, 1))) <= 1 + 1e-12);
  const keys = [
    [0, 0],
    [1, 1],
    [1.5, -0.5],
  ];
  near(sprung(keys, 0.5, 3, 0.7), 0);
  near(sprung(keys, 1, 3, 0.7), 0);
  near(sprung(keys, 30, 3, 0.7), -0.5, 1e-9);
  // Value and slope are continuous through each key: a key changes only the acceleration.
  for (const at of [1, 1.5]) {
    const h = 1e-6,
      value = sprung(keys, at, 3, 0.7);
    near(sprung(keys, at - h, 3, 0.7), sprung(keys, at + h, 3, 0.7), 1e-5);
    near((value - sprung(keys, at - h, 3, 0.7)) / h, (sprung(keys, at + h, 3, 0.7) - value) / h, 2e-3);
  }
  for (let t = 0; t < 400; t += 7.3) {
    const epoch = epochAt(t, 40, 0.18, 9);
    assert.ok(epoch.start <= t && t < epoch.end && epoch.end - epoch.start > 40 * 0.6 && epoch.end - epoch.start < 40 * 1.4);
  }
  assert.ok(hash(1, 2, 3) >= 0 && hash(1, 2, 3) < 1 && hash(1, 2, 3) !== hash(1, 2, 4));
});

test("rabbit hops hold travel through the gather and the landing, and lift only while airborne", () => {
  for (const seed of [1, 2]) {
    const path = manifest.terrain.habitats[seed === 1 ? "rabbitWest" : "rabbitEast"].path;
    for (let epoch = 0, time = 3; epoch < 6; epoch++, time = rabbitSchedule(time, seed).end + 0.01) {
      const plan = rabbitSchedule(time, seed);
      assert.ok(plan.hops.length >= 2, "every epoch hops somewhere");
      for (const hop of plan.hops) {
        if (hop.start < 0) continue;
        const span = hop.end - hop.start,
          bolt = hop.kind === "bolt";
        const [lift0, land0] = bolt ? [0.1, 0.85] : [0.18, 0.76];
        for (const phases of [
          [0.01, lift0 * 0.5, lift0 - 1e-6],
          [land0 + 1e-6, (land0 + 1) / 2, 0.999],
        ]) {
          const poses = phases.map((phase) => rabbitActing(hop.start + phase * span, seed));
          assert.ok(poses.every((pose) => pose.contact && !pose.airborne && pose.lift === 0));
          poses.forEach((pose) => near(pose.progress, poses[0].progress, 1e-9));
          const position = habitatPoint(path, poses[0].progress);
          for (const pose of poses) habitatPoint(path, pose.progress).forEach((value, axis) => near(value, position[axis], 1e-9));
        }
        const apex = rabbitActing(hop.start + ((lift0 + land0) / 2) * span, seed);
        assert.equal(apex.airborne, true);
        assert.ok(apex.lift > 0.04 && apex.lift < 0.2, `apex ${apex.lift}`);
        assert.ok(apex.tuck > 0.99);
        // Hops advance the loop by plausible scrub-hop lengths (bounds are longer and flatter).
        const metres = (hop.p1 - hop.p0) * 3.33;
        assert.ok(metres > 0.12 && metres < (bolt ? 0.75 : 0.5), `${hop.kind} ${metres}`);
      }
    }
  }
});

test("rabbit travel, lift and posture are continuous through hops, segments and epoch joins", () => {
  for (const seed of [1, 2]) {
    let time = 1;
    for (let epoch = 0; epoch < 5; epoch++) {
      const plan = rabbitSchedule(time, seed);
      const joins = [plan.end, ...plan.segments.map((segment) => segment.start), ...plan.hops.flatMap((hop) => [hop.start, hop.end])];
      for (const join of joins) {
        if (join < 1e-3) continue;
        const a = rabbitActing(join - 1e-7, seed),
          b = rabbitActing(join + 1e-7, seed);
        near(a.progress, b.progress, 1e-6);
        near(a.lift, b.lift, 1e-6);
        for (const key of POSTURE) near(a[key], b[key], 0.004);
      }
      time = plan.end + 0.01;
    }
  }
  // Successive epochs pick up exactly where the last one left the loop.
  const first = rabbitSchedule(50, 1),
    second = rabbitSchedule(first.end + 0.01, 1);
  near(first.p1, second.p0, 1e-12);
});

test("rabbits graze, groom, freeze and bolt as well as hop, on a varied clock", () => {
  for (const seed of [1, 2]) {
    const seen = new Set(),
      durations = new Set();
    for (let time = 0; time < RABBIT_EPOCH * 14; time += 0.25) seen.add(rabbitActing(time, seed).state);
    for (let time = 1, i = 0; i < 8; i++, time = rabbitSchedule(time, seed).end + 0.01)
      durations.add(Math.round((rabbitSchedule(time, seed).end - rabbitSchedule(time, seed).start) * 10));
    for (const state of ["hop", "graze", "sit", "groom", "freeze", "bolt"]) assert.ok(seen.has(state), `seed ${seed} never shows ${state}`);
    assert.ok(durations.size >= 6, "epochs vary in length rather than repeating on a fixed beat");
  }
  assert.notEqual(
    JSON.stringify(rabbitSchedule(100, 1).segments.map((s) => s.kind)),
    JSON.stringify(rabbitSchedule(100, 2).segments.map((s) => s.kind))
  );
});

test("absolute-time acting is independent of frame partition and stays finite", () => {
  for (let time = 0; time < 4000; time += 0.137) {
    const rabbit = rabbitActing(time, 2);
    assert.ok(numbers(rabbit).every(Number.isFinite));
    assert.ok(rabbit.lift >= 0 && rabbit.lift <= 0.2);
    for (const lion of [false, true]) {
      const pose = pinnipedActing(time, 1, lion);
      assert.ok(numbers(pose).every(Number.isFinite));
      assert.ok(Math.abs(pose.headYaw) <= 1 && Math.abs(pose.breath) <= 0.03 && pose.jaw >= 0 && pose.jaw <= 0.62);
      assert.ok(pose.blink >= 0 && pose.blink <= 1);
    }
  }
  const before = rabbitActing(73.4, 1);
  for (let time = 0; time < 73.4; time += 1 / 120) rabbitActing(time, 1);
  assert.deepEqual(rabbitActing(73.4, 1), before);
  for (const invalid of [NaN, Infinity, -Infinity, -1]) assert.deepEqual(rabbitActing(invalid, 1), rabbitActing(0, 1));
});

test("sea lions bark, sky-point, roll and fan; seals curl into the banana pose and shuffle", () => {
  for (const lion of [true, false]) {
    for (let index = 0; index < 3; index++) {
      const seen = new Set();
      let barkJaw = 0;
      for (let time = 0; time < 900; time += 0.2) {
        const pose = pinnipedActing(time, index, lion);
        seen.add(pose.state);
        if (pose.state === "bark") barkJaw = Math.max(barkJaw, pose.jaw);
      }
      const expected = lion ? ["bark", "rest", "look"] : ["rest", "look", "banana"];
      for (const state of expected) assert.ok(seen.has(state), `${lion ? "sea lion" : "seal"} ${index} never ${state}: ${[...seen]}`);
      assert.ok(seen.size >= 5, `${lion ? "sea lion" : "seal"} ${index} repertoire ${[...seen]}`);
      if (lion) assert.ok(barkJaw > 0.3, "barks open the jaw");
    }
  }
  // Channels never jump at segment or epoch joins.
  for (const lion of [true, false]) {
    let time = 2;
    for (let epoch = 0; epoch < 4; epoch++) {
      const plan = pinnipedSchedule(time, 0, lion);
      for (const join of [plan.end, ...plan.segments.map((segment) => segment.start)]) {
        if (join < 1e-3) continue;
        const a = pinnipedActing(join - 1e-7, 0, lion),
          b = pinnipedActing(join + 1e-7, 0, lion);
        for (const key of ["headYaw", "headPitch", "neckPitch", "chestPitch", "hipsPitch", "bodyRoll", "flipper", "rearFlipper"])
          near(a[key], b[key], 0.006);
      }
      time = plan.end + 0.01;
    }
  }
});

test("harbor seals haul down to the wash and back by whole humps", () => {
  let moved = false,
    previous = 0,
    largest = 0;
  for (let time = 0; time < 1200; time += 0.05) {
    const offset = sealShuffleOffset(time, 0);
    assert.ok(offset >= 0 && offset <= 1.6 + 1e-9);
    assert.ok(Math.abs(offset - previous) < 0.08, `shuffle jumped ${previous} -> ${offset} at ${time}`);
    if (offset > 0.5) moved = true;
    largest = Math.max(largest, offset);
    previous = offset;
  }
  assert.ok(moved, "seal 0 hauls toward the sea at least once in twenty minutes");
  assert.ok(largest > 1.5);
});

test("swimming sea lions porpoise above the actual swell, raft on it and turn rather than flip", () => {
  const lane = { from: -28, to: -3, z: -21.5 };
  let previous = swimmerActing(0, 0, lane),
    airborne = 0,
    rafts = 0;
  for (let time = 0.01; time < SWIM_PERIOD * 4; time += 0.01) {
    const pose = swimmerActing(time, 0, lane);
    const step = Math.hypot(...pose.position.map((value, axis) => value - previous.position[axis]));
    assert.ok(step < 0.12, `swimmer jumped ${step} m at ${time}`);
    const yawStep = Math.atan2(Math.sin(pose.yaw - previous.yaw), Math.cos(pose.yaw - previous.yaw));
    assert.ok(Math.abs(yawStep) < 0.02, `swimmer heading flipped at ${time}`);
    const surface = sampleOcean(pose.position[0], pose.position[2] + 28, time, 1.1).displacement[1] - 7.35;
    near(pose.surface, surface, 1e-9);
    if (pose.inAir && pose.flipperTuck > 0.95) {
      airborne++;
      assert.ok(pose.position[1] > surface - 0.02);
    }
    if (pose.state === "raft" && pose.periscope < 0.05 && pose.flipperTuck < 0.05) {
      rafts++;
      near(pose.position[1], surface - 0.12, 0.04);
    }
    assert.ok(pose.position[0] >= lane.from - 1e-9 && pose.position[0] <= lane.to + 1e-9);
    previous = pose;
  }
  assert.ok(airborne > 1000 && rafts > 1000);
});
