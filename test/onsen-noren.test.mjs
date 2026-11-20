import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { createNorenCloth, createNorenRig, norenFrameFromScene, norenWind } from "../assets/js/home-scene/onsen-noren.mjs";

const frame = { version: 1, translation: [2.7, 4.74, 15.55], yaw: 0, span: 1.08, drop: 0.96 };
const STEP = 1 / 30;
const near = (actual, wanted, tolerance = 1e-10) => assert.ok(Math.abs(actual - wanted) < tolerance, String(actual) + " vs " + wanted);
const sceneWithRail = () => {
  const scene = new THREE.Scene();
  const marker = new THREE.Group();
  marker.userData.nativeNorenFrame = JSON.stringify(frame);
  scene.add(marker);
  return { scene, marker };
};
const breeze = {
  sampleIndoor(_x, y, z, time, out) {
    return Object.assign(out, [0.08, 0.02 * Math.sin(y + time), 0.38 + 0.11 * Math.sin(z + time * 1.4)]);
  },
};

test("the native rail supplies the one final world frame", () => {
  const asset = (name) => readFileSync(new URL("../assets/models/home/" + name, import.meta.url));
  const manifest = JSON.parse(asset("manifest.json"));
  const data = asset(manifest.shell);
  const delivery = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  const rail = delivery.nodes.find((node) => node.extras?.nativeNorenFrame);
  assert.equal(rail.extras.installationGroup, "upper");
  assert.ok(manifest.installationReceivers.groups[rail.extras.installationGroup]);
  assert.deepEqual(JSON.parse(rail.extras.nativeNorenFrame).translation, frame.translation);
  assert.equal(norenFrameFromScene(new THREE.Scene()), null);
  const { scene, marker } = sceneWithRail();
  const { translation, yaw, span, drop } = frame;
  assert.deepEqual(norenFrameFromScene(scene), { translation, yaw, span, drop });
  const repeat = marker.clone();
  scene.add(repeat);
  assert.deepEqual(norenFrameFromScene(scene), { translation, yaw, span, drop });
  repeat.userData.nativeNorenFrame = { ...frame, yaw: Math.PI / 2 };
  assert.throws(() => norenFrameFromScene(scene), /Conflicting/);
  scene.remove(repeat);
  marker.userData.nativeNorenFrame = { ...frame, drop: -1 };
  assert.throws(() => norenFrameFromScene(scene), /Invalid/);
});

test("sheltered wind samples the real world once and rotates back to the cloth axes", () => {
  const observed = [];
  const coast = {
    sampleIndoor(x, y, z, time, out) {
      observed.push([x, y, z, time]);
      out[0] = 0.15;
      out[1] = 0.05;
      out[2] = 0.45;
      return out;
    },
  };
  const draft = norenWind(coast, { ...frame, yaw: Math.PI / 2 });
  const sample = [0, 0, 0];
  assert.equal(draft.sample(0.3, -0.52, 0.1, 32, sample), sample);
  observed[0].forEach((n, i) => near(n, [2.8, 4.22, 15.25, 32][i]));
  sample.forEach((n, i) => near(n, [-0.324, 0.036, 0.108][i]));
  const gust = norenWind({ sampleIndoor: (_x, _y, _z, _t, out) => Object.assign(out, [12, 1, 12]) }, frame);
  gust.sample(0, 0, 0, 0, sample);
  near(Math.hypot(...sample), 0.62);
});

test("two physical flax drops hold their header and open center seam through a sheltered gust", () => {
  const { island, grids } = createNorenCloth({ frame, wind: norenWind(breeze, frame) });
  assert.equal(island.count, 330);
  assert.equal(grids.length, 2);
  island.settle(0.55);
  const still = Array.from(island.positions);
  const [left, right] = grids;
  let minSplit = Infinity;
  let minStagger = Infinity;
  for (let n = 1; n <= 210; n++) {
    island.step(STEP * n);
    for (let r = 0; r < left.rows; r++) {
      const a = 3 * left.index(left.columns - 1, r),
        b = 3 * right.index(0, r);
      minSplit = Math.min(minSplit, island.positions[b] - island.positions[a]);
      minStagger = Math.min(minStagger, island.positions[b + 2] - island.positions[a + 2]);
    }
  }
  for (const grid of grids)
    for (let c = 0; c < grid.columns; c++) {
      const index = grid.index(c, 0);
      assert.equal(island.isKinematic(index), true);
      for (let a = 0; a < 3; a++) assert.equal(island.positions[3 * index + a], still[3 * index + a]);
    }
  assert.ok(minSplit > 0.019, "minimum opening between the drops " + minSplit);
  assert.ok(minStagger > 0.016, "minimum seam depth " + minStagger);
  assert.ok(island.strain(null, true) < 0.09, "fabric strain " + island.strain(null, true));
  assert.ok(
    island.positions.some((value, i) => Math.abs(value - still[i]) > 0.0005),
    "the shaped fabric moves in the draft"
  );
});

test("a cold rig stays lazy, casts opaque shadows and holds on pause, reduced motion and offscreen", () => {
  const { scene } = sceneWithRail();
  const binds = [];
  const rig = createNorenRig({ scene, coast: breeze, bindMaterial: (material) => binds.push(material) });
  const camera = new THREE.PerspectiveCamera(47, 1.25, 0.05, 100);
  let time = 0;
  let state;
  const tick = (extra = {}) => {
    rig.step({ camera, canvasHeight: 750, delta: STEP, time: (time += STEP), moving: true, reduced: false, ...extra });
    state = rig.evidence();
  };
  camera.position.set(5, 1, 1);
  camera.lookAt(2.7, 4.2, 15.55);
  for (let f = 0; f < 8; f++) tick();
  assert.equal(state.ready, false);
  assert.equal(binds.length, 0);
  camera.position.set(2.37, 4.22, 13.78);
  camera.lookAt(2.7, 4.17, 15.55);
  tick();
  assert.equal(state.ready, true);
  assert.equal(state.inView, true);
  assert.equal(binds.length, 1);
  assert.equal(binds[0].userData.installationGroup, "upper");
  assert.ok(binds[0].defines.SHEER_OPAQUE !== undefined);
  assert.equal(binds[0].depthWrite, true);
  assert.deepEqual(
    rig.group.children.map((object) => object.name),
    ["noren left", "noren right"]
  );
  for (const leaf of rig.group.children) {
    assert.ok(leaf.castShadow && leaf.receiveShadow);
    assert.equal(leaf.userData.walk, "through");
    assert.equal(leaf.material, binds[0]);
  }
  const surfaces = rig.group.children.map(({ geometry }) => {
    const cloth = geometry.getAttribute("norenCloth");
    const uv = geometry.getAttribute("uv");
    const columns = cloth.count / 15;
    const first = 7 * columns;
    const width = uv.getX(first + columns - 1);
    const middle = [];
    for (let i = first; i < first + columns; i++) {
      const u = uv.getX(i);
      near(cloth.getX(i), Math.min(u, width - u), 1e-7);
      middle.push(cloth.getY(i));
    }
    assert.ok(Math.min(...middle) < -0.025, "the far face has a real concave fold");
    assert.ok(Math.max(...middle) > 0.025, "the near face has a real concave fold");
    return { cloth, first, middle };
  });
  for (let f = 0; f < 28; f++) tick();
  assert.ok(state.windMetersPerSecond > 0.14);
  assert.ok(state.steps >= 20);
  for (const { cloth, first, middle } of surfaces) {
    assert.ok(middle.some((angle, c) => Math.abs(cloth.getY(first + c) - angle) > 0.001));
  }
  rig.group.updateMatrixWorld(true);
  // The staggered split covers practical eye-level approaches from both sides.
  for (const sign of [-1, 1]) {
    const point = new THREE.Vector3(2.7 + sign * 0.18, 4.19, 15.55 + sign * 1.45);
    const target = new THREE.Vector3(2.7 - sign * 0.18, 4.19, 15.55 - sign * 1.45);
    const ray = new THREE.Raycaster(point, target.sub(point).normalize(), 0.05, 3);
    assert.ok(ray.intersectObjects(rig.group.children).length > 0);
  }
  const held = state;
  for (let f = 0; f < 12; f++) tick({ moving: false });
  assert.equal(state.steps, held.steps);
  assert.deepEqual(state.hems, held.hems);
  tick({ moving: false, reduced: true });
  assert.equal(state.sleeping, true);
  assert.equal(state.kineticEnergy, 0);
  const still = state;
  for (let f = 0; f < 12; f++) tick({ moving: false, reduced: true });
  assert.deepEqual(state.hems, still.hems);
  camera.lookAt(2.7, 4.0, 11);
  for (let f = 0; f < 7; f++) tick();
  assert.equal(state.inView, false);
  assert.equal(state.steps, held.steps);
  rig.dispose();
  assert.equal(scene.getObjectByName("Onsen entry noren"), undefined);
});
