import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "../assets/js/three.module.min.js";
import { gullMotion } from "../assets/js/home-scene/wildlife-neighbor-motion.mjs";
import { solvePerchLanding, samplePerchActing, perchSurface, perchContactWeight } from "../assets/js/home-scene/wildlife-perch-contact.mjs";

const file = readFileSync(new URL("../assets/models/home/wildlife-perch-support.json", import.meta.url));
const data = JSON.parse(file);
const near = (a, b, tolerance = 2e-5) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

function footGaps(acting, patch, scale) {
  const gaps = {};
  for (const side of ["L", "R"]) {
    const foot = acting.feet[side];
    gaps[side] = data.feet[side].sole.flatMap((sample) => {
      const point = new THREE.Vector3(...sample).multiplyScalar(scale).applyQuaternion(foot.quaternion).add(foot.position);
      const surface = perchSurface(patch, point.x, point.z);
      return surface ? [point.y - surface.height] : [];
    });
  }
  return gaps;
}

test("perch contact metadata matches retained geometry and stays bounded", () => {
  const hash = (path) =>
    createHash("sha256")
      .update(readFileSync(new URL(path, import.meta.url)))
      .digest("hex");
  assert.equal(data.coastSha256, hash("../artwork/coastal-home/coastal-home.blend"));
  assert.equal(data.gullSha256, hash("../assets/models/home/WesternGull.glb"));
  assert.ok(file.byteLength < 24 * 1024);
  assert.equal(data.patches.length, 4);
  assert.ok(data.patches.every((patch) => patch.triangles.length > 0 && patch.triangles.length < 32));
  for (const foot of Object.values(data.feet))
    assert.ok(foot.sole.length > 100 && foot.sole.length < 256 && foot.legLength > 0.11 && foot.legLength < 0.12);
  // Independent retained-surface BVH samples from the decoded-before audit.
  near(perchSurface(data.patches[0], -8.091734886169434, 1.1014457941055298).height, 8.827728271484375);
  near(perchSurface(data.patches[3], 4.149580001831055, 1.3122085332870483).height, 3.461085319519043);
});

test("stable gull soles fit actual local support for changing arrival headings", () => {
  for (let index = 0; index < 3; index++) {
    const patch = data.patches[index];
    for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 12) {
      const landing = solvePerchLanding(data, index, yaw, 1.55);
      near(landing.position.x, patch.original[0]);
      near(landing.position.z, patch.original[2]);
      assert.ok(Math.abs(landing.position.y - patch.original[1]) < 0.051);
      const acting = samplePerchActing(data, landing, landing.position, landing.quaternion, 1);
      for (const [side, gaps] of Object.entries(footGaps(acting, patch, 1.55))) {
        assert.equal(gaps.length, data.feet[side].sole.length);
        near(Math.min(...gaps), 0);
        assert.ok(acting.feet[side].hipAccommodation < 0.065);
      }
    }
  }
});

test("gallery rail contact preserves the original perch and intentional toe overhang", () => {
  const landing = solvePerchLanding(data, 3, 0.4, 1.1);
  assert.deepEqual(landing.position.toArray(), [4.2, 3.46, 1.31]);
  const acting = samplePerchActing(data, landing, landing.position, landing.quaternion, 1);
  for (const [side, gaps] of Object.entries(footGaps(acting, data.patches[3], 1.1))) {
    assert.ok(gaps.length > 0 && gaps.length < data.feet[side].sole.length);
    assert.ok(landing.feet[side].overhang > 0);
    near(Math.min(...gaps), 0);
    assert.ok(acting.feet[side].hipAccommodation < 0.017);
  }
});

test("landing and toe-off keep root C2 joins and visible deployed feet out of the surface", () => {
  for (let index = 0; index < 4; index++) {
    const patch = data.patches[index % 3];
    for (let lap = 0; lap < 4; lap++) {
      const start = lap * 90 - index * 19;
      const landing = solvePerchLanding(data, index % 3, gullMotion(start + 72, index, patch.origin).yaw, 1.55);
      for (const cycle of [48, 68, 86, 90]) {
        const a = gullMotion(start + cycle - 1e-6, index, patch.origin),
          b = gullMotion(start + cycle + 1e-6, index, patch.origin);
        if (start + cycle < 0) continue;
        for (const key of ["position", "velocity", "acceleration"]) a[key].forEach((value, axis) => near(value, b[key][axis], 0.0003));
      }
      for (let cycle = 65; cycle <= 87; cycle += 0.125) {
        const time = start + cycle;
        if (time < 0) continue;
        const pose = gullMotion(time, index, patch.origin),
          weight = perchContactWeight(time, index);
        assert.ok(weight >= 0 && weight <= 1);
        if (pose.footDeploy <= 0.05) continue;
        const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.pitch, pose.yaw, pose.bank, "YXZ"));
        const acting = samplePerchActing(data, landing, new THREE.Vector3(...pose.position), quaternion, weight);
        for (const [side, gaps] of Object.entries(footGaps(acting, patch, 1.55))) {
          assert.ok(acting.feet[side].hipAccommodation < 0.065);
          assert.ok(acting.feet[side].position.toArray().every(Number.isFinite));
          if (gaps.length) assert.ok(Math.min(...gaps) >= -2e-5);
        }
      }
    }
  }
  for (const time of [-2, NaN, Infinity]) assert.ok(Number.isFinite(perchContactWeight(time, 0)));
});
