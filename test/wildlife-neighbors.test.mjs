import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHabitatRoute, plantedFoot, raccoonMotion, shorebirdMotion, gullMotion } from "../assets/js/home-scene/wildlife-neighbor-motion.mjs";

const manifest = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test("stance anchors remain planted and swing joins have zero lift", () => {
  for (const offset of [0, 0.25, 0.5, 0.75]) {
    const poses = [0.03, 0.32, 0.67].map((u) => plantedFoot((5 + u - offset) * 0.18, offset));
    assert.ok(poses.every((pose) => pose.contact && pose.lift === 0));
    poses.forEach((pose) => near(pose.anchorDistance, poses[0].anchorDistance));
    for (const boundary of [0.68, 1]) {
      const a = plantedFoot((5 + boundary - offset - 1e-6) * 0.18, offset);
      const b = plantedFoot((5 + boundary - offset + 1e-6) * 0.18, offset);
      near(a.anchorDistance, b.anchorDistance);
      near(a.lift, b.lift);
    }
  }
});

test("neighbours keep authored routes, rest positions and bounded finite acting", () => {
  const route = createHabitatRoute(manifest.terrain.habitats.raccoon.path);
  route.point(0).forEach((value, axis) => near(value, route.point(route.length)[axis]));
  for (const evening of [false, true]) {
    const resting = [20, 30, 47.9].map((time) => raccoonMotion(time, evening, route.length));
    resting.forEach((pose) => near(pose.distance, resting[0].distance));
    for (const boundary of [evening ? 18 : 5, 48, 96]) {
      const a = raccoonMotion(boundary - 1e-6, evening, route.length),
        b = raccoonMotion(boundary + 1e-6, evening, route.length);
      near(a.distance, b.distance);
    }
  }
  for (let time = 0; time < 900; time += 0.137) {
    for (const index of [0, 1, 2]) {
      const pose = shorebirdMotion(time, index);
      assert.ok(Math.abs(pose.x - (-6 + index * 4.1)) <= 1.3 + 1e-10);
      assert.ok(
        Object.values(pose)
          .filter((value) => typeof value === "number")
          .every(Number.isFinite)
      );
      const previous = shorebirdMotion(time - 1e-5, index),
        next = shorebirdMotion(time + 1e-5, index);
      const yawDelta = Math.atan2(Math.sin(next.yaw - previous.yaw), Math.cos(next.yaw - previous.yaw));
      assert.ok(Math.abs(yawDelta) < 0.001, "shorebird turns should not jump by a half-turn");
    }
  }
});

test("gull trajectories match finite derivatives and join flight/perch with C2 continuity", () => {
  for (let index = 0; index < 4; index++) {
    const perch = manifest.terrain.perches[index % manifest.terrain.perches.length];
    for (const cycle of [48, 68, 86, 90]) {
      const time = 90 + cycle - index * 19,
        epsilon = 1e-6;
      const before = gullMotion(time - epsilon, index, perch),
        after = gullMotion(time + epsilon, index, perch);
      for (const key of ["position", "velocity", "acceleration"]) before[key].forEach((value, axis) => near(value, after[key][axis], 0.0003));
      for (const key of ["wingFold", "wingBeat", "bank", "pitch"]) near(before[key], after[key], 0.0003);
    }
    for (let cycle = 0.4; cycle < 90; cycle += 0.37) {
      const time = 90 + cycle - index * 19,
        epsilon = 1e-4,
        pose = gullMotion(time, index, perch);
      const before = gullMotion(time - epsilon, index, perch),
        after = gullMotion(time + epsilon, index, perch);
      for (let axis = 0; axis < 3; axis++) near((after.position[axis] - before.position[axis]) / (2 * epsilon), pose.velocity[axis], 1e-5);
      assert.ok(pose.position.every(Number.isFinite) && pose.velocity.every(Number.isFinite));
      assert.ok(pose.position[1] > 6 && pose.position[1] < 20);
      const speed = Math.hypot(pose.velocity[0], pose.velocity[2]);
      if (speed > 1e-4 && (cycle < 86 || cycle > 86.3))
        near((Math.sin(pose.yaw) * pose.velocity[0] + Math.cos(pose.yaw) * pose.velocity[2]) / speed, 1, 1e-7);
      if (cycle >= 68 && cycle < 86) pose.position.forEach((value, axis) => near(value, perch[axis]));
    }
  }
});

test("neighbor GLBs retain acting/face pivots and explicit asset budgets", () => {
  let bytes = 0,
    triangles = 0,
    primitives = 0;
  for (const [name, count, budget] of [
    ["Raccoon", 1, 23],
    ["WesternGull", 5, 15],
    ["Sandpiper", 3, 14],
  ]) {
    const data = readFileSync(new URL(`../assets/models/home/${name}.glb`, import.meta.url));
    const gltf = JSON.parse(data.toString("utf8", 20, 20 + data.readUInt32LE(12))),
      names = gltf.nodes.map((node) => node.name);
    const expected = [
      "Head",
      "BodyPose",
      "EyeL",
      "EyeR",
      "Muzzle",
      ...(name === "Raccoon"
        ? ["Tail", "ForelegL", "LowerForelegL", "FrontPawL", "HindPawR"]
        : ["WingL", "WingR", "WingTipL", "WingTipR", "FootL", "FootR", "LegL", "LegR"]),
    ];
    for (const pivot of expected) assert.equal(names.filter((value) => value === pivot).length, 1, `${name} canonical ${pivot}`);
    const meshes = gltf.meshes.flatMap((mesh) => mesh.primitives);
    assert.ok(meshes.length <= budget, `${name} draw primitive budget`);
    bytes += data.byteLength;
    primitives += meshes.length * count;
    triangles += meshes.reduce((sum, primitive) => sum + gltf.accessors[primitive.indices].count / 3, 0) * count;
  }
  assert.ok(bytes < 192 * 1024, `Three original masters exceed 192 KiB: ${bytes}`);
  assert.ok(primitives <= 140 && triangles <= 60000, `Nine instances: ${primitives} primitives / ${triangles} triangles`);
});
