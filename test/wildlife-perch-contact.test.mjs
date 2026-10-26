import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as THREE from "../assets/js/three.module.min.js";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";
import { gullMotion, gullSchedule } from "../assets/js/home-scene/wildlife-neighbor-motion.mjs";
import { solvePerchLanding, samplePerchActing, perchSurface, perchContactWeight } from "../assets/js/home-scene/wildlife-perch-contact.mjs";

const verifiedRoot = process.env.COASTAL_VERIFY_ROOT
  ? pathToFileURL(path.resolve(process.env.COASTAL_VERIFY_ROOT) + path.sep)
  : new URL("../", import.meta.url);
const models = new URL("assets/models/home/", verifiedRoot);
const file = readFileSync(new URL("wildlife-perch-support.json", models));
const data = JSON.parse(file);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", models)));
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

test("perch contact metadata matches retained geometry and stays bounded", async () => {
  const hash = (path) =>
    createHash("sha256")
      .update(readFileSync(new URL(path.replace(/^\.\.\//, ""), verifiedRoot)))
      .digest("hex");
  assert.equal(data.coastSha256, hash("../artwork/coastal-home/coastal-home.blend"));
  assert.equal(data.gullSha256, hash("../assets/models/home/WesternGull.glb"));
  for (const [name, expected] of Object.entries(data.deliveredSha256)) assert.equal(expected, hash(`../assets/models/home/${name}`));
  for (const index of [0, 1, 2, 3]) {
    assert.ok(
      data.patches[index].nativeTriangles.length > 0,
      "the complete original native patch remains inspectable beside delivered contact geometry"
    );
    assert.equal(data.patches[index].contactGeometry, "decoded delivered shell/coast");
  }
  assert.ok(file.byteLength < 32 * 1024);
  // Three coast perches and the gallery rail for the gulls, four rock roosts for the cormorants.
  assert.deepEqual(
    data.patches.map((patch) => patch.kind),
    ["coast", "coast", "coast", "rail", "rock", "rock", "rock", "rock"]
  );
  assert.ok(data.patches.every((patch) => patch.triangles.length > 0 && patch.triangles.length < (patch.kind === "rock" ? 64 : 32)));
  for (let index = 0; index < 3; index++) assert.deepEqual(data.patches[index].original, manifest.terrain.perches[index]);
  assert.deepEqual(data.patches[3].original, manifest.retreat.galleryPerch);
  for (const foot of Object.values(data.feet))
    assert.ok(foot.sole.length > 100 && foot.sole.length < 256 && foot.legLength > 0.11 && foot.legLength < 0.12);
  // Compare Blender-surveyed contacts with independently decoded browser triangles. The
  // displaced west perch and the gallery rail retain both their native patch and their exact
  // delivered contact patch. Historical absolute coordinates miss real source drift.
  const roots = await Promise.all(["home-shell.glb", "coast.glb"].map((file) => nativeGeometry(file, models)));
  for (const [index, x, z] of [
    [0, manifest.terrain.perches[0][0] - 0.091734886169434, manifest.terrain.perches[0][2] + 0.1014457941055298],
    [1, manifest.terrain.perches[1][0], manifest.terrain.perches[1][2]],
    [2, manifest.terrain.perches[2][0], manifest.terrain.perches[2][2]],
    [3, manifest.retreat.galleryPerch[0] - 0.050419998168945, manifest.retreat.galleryPerch[2] + 0.0022085332870483],
  ]) {
    const surface = perchSurface(data.patches[index], x, z);
    const ray = new THREE.Raycaster(new THREE.Vector3(x, surface.height + 0.4, z), new THREE.Vector3(0, -1, 0), 0, 1);
    const hit = ray.intersectObjects(roots, true)[0];
    assert.ok(hit, "the actual delivered shell retains the surveyed support");
    near(surface.height, hit.point.y, 0.0002);
  }
});

test("stable gull soles fit actual local support for changing arrival headings", () => {
  for (let index = 0; index < 3; index++) {
    const patch = data.patches[index];
    for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 12) {
      const landing = solvePerchLanding(data, index, yaw, 1.55);
      near(landing.position.x, patch.original[0]);
      near(landing.position.z, patch.original[2]);
      assert.ok(Math.abs(landing.position.y - patch.nativeOrigin[1]) < 0.01, "decoded root height stays within 10mm of the actual retained support");
      const acting = samplePerchActing(data, landing, landing.position, landing.quaternion, 1);
      for (const [side, gaps] of Object.entries(footGaps(acting, patch, 1.55))) {
        assert.equal(gaps.length, data.feet[side].sole.length);
        near(Math.min(...gaps), 0);
        assert.ok(acting.feet[side].hipAccommodation < 0.065);
      }
    }
  }
});

test("gallery rail contact follows its native relocated support and intentional toe overhang", () => {
  const landing = solvePerchLanding(data, 3, 0.4, 1.1);
  assert.deepEqual(landing.position.toArray(), manifest.retreat.galleryPerch);
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
    for (let lap = 1; lap < 5; lap++) {
      const schedule = gullSchedule(lap * 90 + 1 - index * 19, index);
      const landing = solvePerchLanding(data, index % 3, gullMotion(schedule.perchStart + 1, index, patch.origin).landingYaw, 1.55);
      for (const join of [schedule.glideEnd, schedule.approachSplit, schedule.perchStart, schedule.perchEnd, schedule.departSplit, schedule.end]) {
        const a = gullMotion(join - 1e-6, index, patch.origin),
          b = gullMotion(join + 1e-6, index, patch.origin);
        for (const key of ["position", "velocity", "acceleration"]) a[key].forEach((value, axis) => near(value, b[key][axis], 0.0005));
      }
      const windows = [
        [schedule.perchStart - 4.5, schedule.perchStart + 1],
        [schedule.perchEnd - 0.5, schedule.perchEnd + 1.5],
      ];
      for (const [from, to] of windows) {
        for (let time = from; time <= to; time += 0.125) {
          const pose = gullMotion(time, index, patch.origin),
            weight = perchContactWeight(time, index);
          near(weight, pose.contactWeight, 1e-9);
          assert.ok(weight >= 0 && weight <= 1);
          if (pose.footDeploy <= 0.05 || weight === 0) continue;
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
  }
  for (const time of [-2, NaN, Infinity]) assert.ok(Number.isFinite(perchContactWeight(time, 0)));
});

test("cormorant roosts sit on measured rock at the cliff foot, with support under both feet", () => {
  for (const patch of data.patches.filter((item) => item.kind === "rock")) {
    const centre = perchSurface(patch, patch.origin[0], patch.origin[2]);
    near(centre.height, patch.origin[1], 1e-6);
    assert.ok(Math.abs(patch.origin[1] - patch.original[1]) < 0.25);
    assert.ok(patch.origin[1] > -6.6 && patch.origin[1] < -5.5, "low rocks, just above the beach");
    for (const [dx, dz] of [
      [-0.06, 0.04],
      [0.06, 0.04],
      [-0.06, -0.06],
      [0.06, -0.06],
    ]) {
      const foot = perchSurface(patch, patch.origin[0] + dx, patch.origin[2] + dz);
      assert.ok(foot, `${patch.id} supports a foot at ${dx}, ${dz}`);
      assert.ok(Math.abs(foot.height - patch.origin[1]) < 0.08 && foot.normal.y > 0.7);
    }
  }
});
