import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { localSceneOffset, localSceneWind } from "../assets/js/home-scene/local-scene-frame.mjs";
import { createCurtainRig } from "../assets/js/home-scene/curtain-rig.mjs";
import { createLaundryRig } from "../assets/js/home-scene/laundry-rig.mjs";

test("local installation samplers query the actual translated wind once and preserve its state", () => {
  const calls = [];
  const state = {};
  const sampler = (kind) => (x, y, z, time, out) => {
    calls.push([kind, x, y, z, time, out]);
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
  };
  const coast = { state, sample: sampler("outside"), sampleIndoor: sampler("inside") };
  assert.equal(localSceneWind(coast, [0, 0, 0]), coast);
  const local = localSceneWind(coast, [3, 2, 8]);
  const out = [0, 0, 0];
  assert.equal(local.state, state);
  assert.equal(local.sample(1, 2, 3, 40, out), out);
  assert.deepEqual(out, [4, 4, 11]);
  local.sampleIndoor(-1, 1, -3, 50, out);
  assert.deepEqual(out, [2, 3, 5]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][5], out);
  const offset = [0, 0, 8];
  const copy = localSceneOffset(offset);
  offset[2] = 10;
  assert.deepEqual(copy, [0, 0, 8]);
  for (const value of [null, [1, 2], [0, 0, NaN]]) assert.throws(() => localSceneOffset(value), RangeError);
});

const day = { daylight: 0.9, sunlight: 0.8, altitude: 45, direction: [-1, 0.7, -0.2] };
const routine = { id: "reading", room: "study" };
const offset = [20, 0, 80];
const world = (point) => point.map((value, axis) => value + offset[axis]);
function windRecorder() {
  const observed = { minimumZ: Infinity, calls: 0 };
  const sample = (x, y, z, time, out) => {
    observed.minimumZ = Math.min(z, observed.minimumZ);
    observed.calls++;
    out[0] = 0.3;
    out[1] = 0;
    out[2] = 1;
    return out;
  };
  return { coast: { sample, sampleIndoor: sample }, observed };
}

test("translated curtains retain local collision buffers and use world culling and glass order", () => {
  const scene = new THREE.Scene();
  const { coast, observed } = windRecorder();
  const rig = createCurtainRig({ scene, coast, offset, laundry: false, plan: { routine, daylight: day } });
  const camera = new THREE.PerspectiveCamera(38, 545 / 462, 0.05, 300);
  camera.position.fromArray(world([-0.97, 3.1, -6.3]));
  camera.lookAt(...world([-3.18, 1.03, -1.85]));
  rig.step({ delta: 1 / 30, moving: true, reduced: false, time: 2, daylight: day, routine, camera, canvasHeight: 462 });
  assert.deepEqual(rig.group.position.toArray(), offset);
  assert.equal(rig.evidence().inView, true, "the translated camera sees the translated panels");
  const mesh = rig.group.getObjectByName("curtain kitchen-south");
  assert.equal(mesh.renderOrder, 1, "an outdoor camera draws linen before glazing");
  assert.ok(mesh.geometry.boundingSphere.center.z < 0, "the buffer bound stays in original local coordinates");
  assert.ok(observed.calls > 0 && observed.minimumZ > 70, "wind samples the translated house");
  camera.position.fromArray(world([-0.97, 3.1, -3]));
  camera.lookAt(...world([-3.18, 1.03, -6]));
  rig.step({ delta: 1 / 60, moving: false, reduced: true, time: 3, daylight: day, routine, camera, canvasHeight: 462 });
  assert.equal(mesh.renderOrder, 3, "an indoor camera draws linen after glazing");
  rig.dispose();
});

test("translated laundry draws and culls at its new world position while the solver remains local", () => {
  const scene = new THREE.Scene();
  const { coast, observed } = windRecorder();
  const rig = createLaundryRig({ scene, coast, offset });
  const camera = new THREE.PerspectiveCamera(40, 545 / 461, 0.05, 300);
  camera.position.fromArray(world([-0.7, 1.6, -5.3]));
  camera.lookAt(...world([-1, 1.5, -7.25]));
  rig.step({ delta: 1 / 30, moving: true, reduced: false, time: 2, daylight: day, routine, camera, canvasHeight: 461 });
  assert.deepEqual(rig.group.position.toArray(), offset);
  assert.ok(rig.evidence().out && rig.evidence().inView);
  assert.ok(rig.laundry.island.positions[2] < 0, "constraint coordinates are not shifted");
  assert.ok(observed.calls > 0 && observed.minimumZ > 70, "the outdoor sampler receives world coordinates once");
  rig.dispose();
});
