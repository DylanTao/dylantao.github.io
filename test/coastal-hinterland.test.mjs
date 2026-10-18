import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { createRoute, gliderPose, bindGliders } from "../assets/js/home-scene/gliders.mjs";
import { mergeCameraGrid, bindWindsock, sockDroop } from "../assets/js/home-scene/hinterland.mjs";
import { createCoastWind } from "../assets/js/home-scene/wind-field.mjs";
import { cameraTerrainHeight, keepCameraClear } from "../assets/js/home-scene/camera.mjs";

const manifest = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
const hinterland = manifest.hinterland;

// A 200 m by 60 m counter-clockwise racetrack seen from above (+Y), 30 m up.
const track = [];
for (let x = 0; x <= 200; x += 20) track.push([x, 30, 0]);
for (let k = 1; k < 8; k++) track.push([200 + 30 * Math.sin((k / 8) * Math.PI), 30, -30 + 30 * Math.cos((k / 8) * Math.PI)]);
for (let x = 200; x >= 0; x -= 20) track.push([x, 30, -60]);
for (let k = 1; k < 8; k++) track.push([-30 * Math.sin((k / 8) * Math.PI), 30, -30 - 30 * Math.cos((k / 8) * Math.PI)]);

test("a glider's pose is a pure function of the scene clock", () => {
  const route = createRoute(track, { speed: 8.3, phase: 0.25 });
  const a = gliderPose(route, 12.5),
    b = gliderPose(route, 12.5);
  assert.deepEqual(a.position.toArray(), b.position.toArray());
  assert.deepEqual(a.quaternion.toArray(), b.quaternion.toArray());
  // One lap returns to the same place.
  const lap = gliderPose(route, 12.5 + route.length / route.speed);
  assert.ok(lap.position.distanceTo(a.position) < 1e-6);
  assert.throws(() => createRoute(track.slice(0, 3)));
});

test("gliders fly at their ground speed, smoothly, facing their direction of travel", () => {
  const route = createRoute(track, { speed: 9 });
  const dt = 0.1;
  for (let t = 0; t < route.length / route.speed; t += 1.7) {
    const p0 = gliderPose(route, t),
      p1 = gliderPose(route, t + dt);
    const step = p1.position.distanceTo(p0.position);
    assert.ok(Math.abs(step - route.speed * dt) < 0.08, `speed ${step / dt} at ${t}`);
    const travel = p1.position.clone().sub(p0.position).normalize();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(p0.quaternion);
    assert.ok(forward.dot(travel) > 0.97, `heading at ${t}`);
    assert.ok(Math.abs(p0.bank) <= THREE.MathUtils.degToRad(32) + 1e-9);
  }
});

test("a turn banks the inside wing down, as a coordinated turn does", () => {
  const route = createRoute(track, { speed: 9 });
  // Round the far turn the track curves toward the glider's left wing (+X model axis).
  let banked = null;
  for (let s = 0; s < route.length; s += 2) {
    const pose = gliderPose(route, s / route.speed);
    if (Math.abs(pose.bank) > 0.18) {
      banked = pose;
      break;
    }
  }
  assert.ok(banked, "the racetrack's turns must bank");
  const left = new THREE.Vector3(1, 0, 0).applyQuaternion(banked.quaternion);
  const centre = new THREE.Vector3(...(banked.position.x > 100 ? [200, 30, -30] : [0, 30, -30]));
  const towardCentre = centre.clone().sub(banked.position).setY(0).normalize();
  // The wing on the side of the turn's centre is the lower one.
  const insideWing = left.clone().setY(0).normalize().dot(towardCentre) > 0 ? left : left.clone().negate();
  assert.ok(insideWing.y < -0.15, `inside wing should dip, got ${insideWing.y}`);
  // The straight legs fly level.
  const level = gliderPose(route, (route.length * 0.12) / route.speed);
  assert.ok(Math.abs(level.bank) < 0.05);
});

test("a bound glider moves with its clock and holds still when the clock stops", () => {
  const root = new THREE.Group();
  const node = new THREE.Group();
  node.name = "hinterland_glider_0";
  node.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  root.add(node);
  const clock = { value: 3 };
  const { gliders } = bindGliders(root, [{ node: "hinterland_glider_0", kind: "paraglider", speed: 8, phase: 0, route: track }], clock);
  assert.equal(gliders.length, 1);
  const mesh = node.children[0];
  assert.equal(mesh.castShadow, false);
  assert.equal(mesh.frustumCulled, false);
  assert.equal(mesh.userData.noContactOcclusion, true);
  const first = node.position.clone();
  mesh.onBeforeRender();
  mesh.onBeforeRender();
  assert.deepEqual(node.position.toArray(), first.toArray(), "an unchanged clock never moves a glider");
  clock.value = 5;
  mesh.onBeforeRender();
  assert.ok(Math.abs(node.position.distanceTo(first) - 16) < 0.3, "two seconds at 8 m/s");
  assert.equal(node.userData.glider.seconds, 5);
});

test("the new land's camera grid merges onto the retained one without changing it", () => {
  const base = { origin: [0, 0], step: 2, width: 3, height: 2, clearance: 0.32, elevations: [1, 2, 3, 4, 5, 6] };
  const extra = { origin: [-4, -2], step: 2, width: 6, height: 4, elevations: new Array(24).fill(9) };
  const merged = mergeCameraGrid(base, extra);
  assert.deepEqual(merged.origin, [-4, -2]);
  assert.equal(merged.width, 6);
  assert.equal(merged.height, 4);
  assert.equal(merged.clearance, 0.32);
  // Retained cells win where both grids have them.
  const at = (x, z) => merged.elevations[((z - merged.origin[1]) / 2) * merged.width + (x - merged.origin[0]) / 2];
  assert.equal(at(0, 0), 1);
  assert.equal(at(4, 2), 6);
  assert.equal(at(-4, -2), 9);
  // A grid on another lattice is ignored rather than misaligned.
  assert.equal(mergeCameraGrid(base, { ...extra, origin: [-3, -2] }), base);
  assert.equal(mergeCameraGrid(base, { ...extra, step: 4 }), base);
  assert.equal(mergeCameraGrid(base, undefined), base);
});

test("the manifest's hinterland is complete and its camera grid keeps the camera above the new land", { skip: !hinterland }, () => {
  assert.equal(hinterland.file, "hinterland.glb");
  assert.ok(fs.existsSync(new URL("../assets/models/home/" + hinterland.file, import.meta.url)));
  const grid = hinterland.cameraGrid;
  const retained = manifest.cameraCollision;
  assert.equal(grid.step, retained.step);
  assert.equal(grid.elevations.length, grid.width * grid.height);
  const merged = mergeCameraGrid(retained, grid);
  // The retained grid is untouched where it applies.
  for (const [x, z] of [
    [0, 0],
    [3, -6],
    [40, 20],
    [-30, 10],
  ]) {
    assert.equal(cameraTerrainHeight(x, z, merged), cameraTerrainHeight(x, z, retained));
  }
  // Past the mainland's back wall the old grid had no ground; the merged one has the mesa.
  assert.equal(cameraTerrainHeight(10, 60, retained), -Infinity);
  assert.ok(cameraTerrainHeight(10, 60, merged) > 5);
  const camera = new THREE.Vector3(10, 2, 60);
  keepCameraClear(camera, { ...manifest, cameraCollision: merged }, "outside");
  assert.ok(camera.y > 5, `camera lifted onto the mesa, got ${camera.y}`);
});

test("every glider keeps clear air over the land and sea along its whole route", { skip: !hinterland }, () => {
  const merged = mergeCameraGrid(manifest.cameraCollision, hinterland.cameraGrid);
  assert.ok(hinterland.gliders.length >= 3);
  for (const entry of hinterland.gliders) {
    const route = createRoute(entry.route, { speed: entry.speed, phase: entry.phase });
    assert.ok(entry.speed > 5 && entry.speed < 16, `${entry.node} speed`);
    let lowest = Infinity;
    for (let s = 0; s < route.length; s += 3) {
      const pose = gliderPose(route, s / route.speed);
      const ground = Math.max(cameraTerrainHeight(pose.position.x, pose.position.z, merged), -7.35);
      lowest = Math.min(lowest, pose.position.y - ground);
    }
    assert.ok(lowest > 8, `${entry.node} comes within ${lowest.toFixed(1)} m of the ground`);
  }
});

test("the wind sock is documented and stands on the gliderport above the ground", { skip: !hinterland }, () => {
  const sock = hinterland.windsock;
  assert.equal(sock.node, "hinterland_windsock");
  assert.equal(sock.axis, "+Z");
  // The gliderport sits on the high mesa north of the house, well above the sea.
  assert.ok(sock.pivot[0] > 120 && sock.pivot[1] > 15, `wind sock at ${sock.pivot}`);
  assert.ok(sock.length > 2 && sock.length < 5);
  assert.ok(Math.abs(Math.hypot(...sock.restDirection) - 1) < 1e-3);
  assert.ok(sock.restDirection[1] < 0, "the still pose droops");
});

test("the wind sock turns downwind and fills with the coast wind, and holds still with it", () => {
  const root = new THREE.Group();
  const node = new THREE.Group();
  node.name = "hinterland_windsock";
  node.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 3), new THREE.MeshBasicMaterial()));
  root.add(node);
  const wind = createCoastWind({ minute: 900 });
  wind.update({ seconds: 4, minute: 900 });
  const sock = bindWindsock(root, { node: "hinterland_windsock", pivot: [184, 27.6, 1] }, wind);
  const vane = wind.vane(184, 1, 4, {});
  assert.ok(Math.abs(node.rotation.y - vane.yaw) < 1e-9, "rotation.y is the vane's yaw");
  assert.equal(node.rotation.order, "YXZ");
  assert.ok(Math.abs(node.rotation.x - sockDroop(vane.extension)) < 1e-9);
  // The sock's local +Z points along the wind at the pivot.
  const along = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, node.rotation.y, 0));
  const flow = wind.sample(184, 0, 1, 4, [0, 0, 0]);
  assert.ok(along.x * flow[0] + along.z * flow[2] > 0.99 * Math.hypot(flow[0], flow[2]));
  // Unchanged wind, unchanged sock; a later instant moves it.
  const before = node.quaternion.clone();
  node.children[0].onBeforeRender();
  assert.ok(node.quaternion.equals(before));
  wind.update({ seconds: 31, minute: 900 });
  node.children[0].onBeforeRender();
  assert.equal(sock.state.seconds, 31);
  assert.ok(!node.quaternion.equals(before) || node.scale.z !== 0.86 + 0.14 * vane.extension);
});

test("a calm sock hangs and a full one stands out", () => {
  assert.ok(sockDroop(0) > 1.1, "limp in still air");
  assert.ok(sockDroop(1) < 0.1, "nearly level at 15 knots");
  assert.ok(sockDroop(0.5) > sockDroop(0.8));
  assert.equal(bindWindsock(new THREE.Group(), { node: "missing", pivot: [0, 0, 0] }), null);
});
