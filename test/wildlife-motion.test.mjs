import test from "node:test";
import assert from "node:assert/strict";
import { rabbitActing, pinnipedActing } from "../assets/js/home-scene/wildlife-motion.mjs";
import { habitatPoint } from "../assets/js/home-scene/shore.mjs";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test("rabbit contacts hold horizontal travel through anticipation and landing", () => {
  for (const seed of [1, 2]) {
    const base = 34 - seed * 7;
    for (let hop = 0; hop < 6; hop++) {
      for (const times of [
        [0.01, 0.12, 0.18],
        [0.76, 0.87, 0.99],
      ]) {
        const poses = times.map((phase) => rabbitActing(base + hop + phase, seed));
        assert.ok(poses.every((pose) => pose.contact && !pose.airborne && pose.lift === 0));
        poses.forEach((pose) => near(pose.progress, poses[0].progress));
        const path = manifest.terrain.habitats[seed === 1 ? "rabbitWest" : "rabbitEast"].path;
        const position = habitatPoint(path, poses[0].progress);
        for (const pose of poses) habitatPoint(path, pose.progress).forEach((value, axis) => near(value, position[axis]));
      }
    }
  }
});

test("rabbit flight has continuous zero-speed takeoff/landing and bounded clearance", () => {
  const base = 27;
  for (let hop = 0; hop < 6; hop++) {
    const start = rabbitActing(base + hop + 0.18, 1),
      end = rabbitActing(base + hop + 0.76, 1);
    const afterStart = rabbitActing(base + hop + 0.18001, 1),
      beforeEnd = rabbitActing(base + hop + 0.75999, 1);
    near(start.progress, afterStart.progress, 1e-10);
    near(end.progress, beforeEnd.progress, 1e-10);
    near(start.lift, afterStart.lift, 1e-8);
    near(end.lift, beforeEnd.lift, 1e-8);
    const apex = rabbitActing(base + hop + 0.47, 1);
    assert.equal(apex.airborne, true);
    near(apex.lift, 0.12);
    assert.ok(apex.tuck > 0.99);
  }
  for (let lap = 1; lap < 100; lap++) {
    const boundary = lap * 34 - 7;
    near(rabbitActing(boundary - 1e-7, 1).progress, rabbitActing(boundary + 1e-7, 1).progress);
    near(rabbitActing(boundary - 1e-7, 1).lift, rabbitActing(boundary + 1e-7, 1).lift);
  }
});

test("absolute-time acting is independent of frame partition and stays finite", () => {
  for (let time = 0; time < 4000; time += 0.137) {
    const rabbit = rabbitActing(time, 2);
    assert.ok(
      Object.values(rabbit)
        .filter((value) => typeof value === "number")
        .every(Number.isFinite)
    );
    assert.ok(rabbit.lift >= 0 && rabbit.lift <= 0.12);
    for (const lion of [false, true]) {
      const pose = pinnipedActing(time, 1, lion);
      assert.ok(
        Object.values(pose)
          .filter((value) => typeof value === "number")
          .every(Number.isFinite)
      );
      assert.ok(Math.abs(pose.headYaw) <= 0.31 && Math.abs(pose.breath) <= 0.0028);
      assert.ok(pose.blink >= 0 && pose.blink <= 1);
    }
  }
  const before = rabbitActing(73.4, 1);
  for (let time = 0; time < 73.4; time += 1 / 300) rabbitActing(time, 1);
  assert.deepEqual(rabbitActing(73.4, 1), before);
  for (const invalid of [NaN, Infinity, -Infinity, -1]) assert.deepEqual(rabbitActing(invalid, 1), rabbitActing(0, 1));
});

test("neighbors have staggered acting and smooth returns to rest", () => {
  assert.notDeepEqual(pinnipedActing(29, 0, true), pinnipedActing(29, 1, true));
  assert.notEqual(rabbitActing(0, 1).state, rabbitActing(0, 2).state);
  for (const seed of [1, 2]) {
    for (const cycle of [6, 13, 18, 34]) {
      const time = cycle + 34 - seed * 7;
      for (const key of ["headPitch", "headYaw", "earLeft", "earRight", "compression"]) {
        near(rabbitActing(time - 1e-7, seed)[key], rabbitActing(time + 1e-7, seed)[key], 1e-6);
      }
    }
  }
});
