import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { laundryFrame, frameFromScene, framePoint, frameVector, windInFrame } from "../assets/js/home-scene/laundry-frame.mjs";
import { createLaundryRig } from "../assets/js/home-scene/laundry-rig.mjs";
import { createCoastWind } from "../assets/js/home-scene/wind-field.mjs";
import { createLaundryLine, createTerraceDraft } from "../assets/js/home-scene/laundry-line.mjs";

const record = { version: 1, yaw: Math.PI / 2, translation: [10, 0.2, 4], rail: [], floorY: 0, postBaseY: -0.03, postTopY: 2.57 };
const close = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-10, `${a} != ${b}`));

test("a native laundry frame carries positions once and rotates wind back to cloth axes", () => {
  const frame = laundryFrame(record);
  close(framePoint(frame, [2, 3, 5]), [15, 3.2, 2]);
  close(frameVector(frame, [2, 3, 5]), [5, 3, -2]);
  close(frameVector(frame, [5, 3, -2], true), [2, 3, 5]);
  close(framePoint(laundryFrame(null, [0, 0, 8]), [2, 3, 5]), [2, 3, 13]);
});

test("a varying world wind is sampled at real relocated points in scalar and batch paths", () => {
  const frame = laundryFrame(record),
    calls = [];
  const field = (x, y, z, t, out) => {
    calls.push([x, y, z, t]);
    out[0] = z + t;
    out[1] = y / 3;
    out[2] = -x / 2;
    return out;
  };
  const wind = {
    sample: field,
    sampleBatch(points, count, clock, out) {
      for (let i = 0; i < count; i++) field(...points.subarray(i * 3, i * 3 + 3), clock[0], out.subarray(i * 3, i * 3 + 3));
    },
  };
  const local = windInFrame(wind, frame),
    actual = local.sample(2, 3, 5, 7);
  close(calls[0], [15, 3.2, 2, 7]);
  close(frameVector(frame, actual), [9, 3.2 / 3, -7.5]);
  const output = new Float64Array(6);
  local.sampleBatch(new Float64Array([2, 3, 5, -1, 2, 0]), 2, new Float64Array([7]), output);
  close(Array.from(output.subarray(0, 3)), actual);
  close(calls[2], [10, 2.2, 5, 7]);
  close(frameVector(frame, Array.from(output.subarray(3))), [12, 2.2 / 3, -5]);
});

test("native extras are discovered on the delivered scene and conflicting placement fails", () => {
  const scene = new THREE.Scene(),
    node = new THREE.Group();
  scene.add(node);
  node.name = "native mast assembly";
  node.userData.nativeLaundryFrame = JSON.stringify(record);
  const frame = frameFromScene(scene, [0, 0, 8]);
  assert.equal(frame.native, true);
  assert.equal(frame.node, node.name);
  close(frame.translation, [10, 0.2, 4]);
  const other = new THREE.Group();
  other.userData.nativeLaundryFrame = { ...record, yaw: 0 };
  scene.add(other);
  assert.throws(() => frameFromScene(scene, [0, 0, 8]), /Conflicting/);
  assert.throws(() => laundryFrame({ ...record, yaw: NaN }), /Invalid/);
  assert.throws(() => laundryFrame({ ...record, rail: [[1, Infinity]] }), /Invalid/);
});

test("the actual rig keeps cloth, anchors and culling in the same rotated native frame", () => {
  const scene = new THREE.Scene(),
    hardware = new THREE.Group();
  hardware.userData.nativeLaundryFrame = JSON.stringify(record);
  scene.add(hardware);
  const rig = createLaundryRig({ scene, coast: createCoastWind({ minute: 840, doors: 1 }), offset: [0, 0, 8], reduced: true });
  const frame = laundryFrame(record),
    line = rig.laundry.line;
  const centre = framePoint(frame, [(line.start[0] + line.end[0]) / 2, 1.3, (line.start[1] + line.end[1]) / 2]);
  const camera = new THREE.PerspectiveCamera(50, 1.44, 0.01, 100);
  camera.position.fromArray(centre).add(new THREE.Vector3(0, 0.8, 5));
  camera.lookAt(new THREE.Vector3(...centre));
  camera.updateProjectionMatrix();
  rig.step({ delta: 0, moving: false, reduced: true, time: 0, daylight: { daylight: 1 }, routine: { id: "work" }, camera, canvasHeight: 1000 });
  scene.updateMatrixWorld(true);
  const evidence = rig.evidence();
  assert.equal(evidence.frame.native, true);
  assert.equal(evidence.draws, 6);
  assert.equal(evidence.inView, true);
  assert.equal(evidence.stepping, false);
  close(evidence.anchorsWorld[0], framePoint(frame, [line.start[0], 1.94, line.start[1]]));
  const cloth = rig.group.children[0],
    p = new THREE.Vector3().fromBufferAttribute(cloth.geometry.attributes.position, 0);
  close(p.clone().applyMatrix4(cloth.matrixWorld).toArray(), framePoint(frame, p.toArray()));
  rig.dispose();
});

test("the relocated shirt stays within its stretch limit through coast gusts and layer separation", () => {
  const frame = laundryFrame({ ...record, yaw: 0.5019695391048997, translation: [10.914249427996943, 0.001, 8.332413534264554] });
  const coast = createCoastWind({ minute: 840, doors: 1 });
  const wind = windInFrame(createTerraceDraft({ coast }), frame);
  const { island, model } = createLaundryLine({ wind, rail: [], postBaseY: -0.03, postTopY: 2.57 });
  island.settle(1.5);
  island.wake();
  let maximum = 0;
  for (let step = 0; step < 1800; step++) {
    const time = 300 + step / 30;
    coast.update({ seconds: time, minute: 840 });
    island.step(time);
    maximum = Math.max(maximum, island.strain(null, true));
  }
  assert.ok(maximum < 0.2, `stretch ${maximum}`);
  const p = island.positions;
  let closest = Infinity;
  for (const [a, b] of model.separations)
    closest = Math.min(closest, Math.hypot(p[3 * a] - p[3 * b], p[3 * a + 1] - p[3 * b + 1], p[3 * a + 2] - p[3 * b + 2]));
  assert.ok(closest > 0.008, `shirt layer separation ${closest} m`);
});
