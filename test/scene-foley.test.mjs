import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "../assets/js/three.module.min.js";
import { createWalkField } from "../assets/js/home-scene/colliders.mjs";
import { createPlantBrush, createSceneFoley } from "../assets/js/home-scene/scene-foley.mjs";
import { createFoley } from "../assets/js/sound/foley.mjs";

const bounds = { min: [-1, -2, -1], max: [6, 10, 3], cell: 0.12 };
const matrix = new THREE.Matrix4().elements;
const plane = (x, y) => [x, y, 0, x + 0.95, y, 0, x + 0.95, y, 2, x, y, 0, x + 0.95, y, 2, x, y, 2];

test("support material follows the highest real contact across fields and worker snapshots", () => {
  const field = createWalkField(bounds);
  field.addGeometry({
    positions: Float32Array.from([...plane(0, 0), ...plane(1, 0), ...plane(2, 0), ...plane(3, 0)]),
    matrix,
    ranges: [
      [0, 6, 1],
      [6, 12, 2],
      [12, 18, 3],
      [18, 24, 4],
    ],
  });
  field.addGeometry({ positions: Float32Array.from(plane(0, 3)), matrix, material: 2 });
  field.addGeometry({ positions: Float32Array.from(plane(0, -0.02)), matrix, material: 3 });
  const restored = createWalkField(bounds);
  assert.ok(restored.load(field.snapshot()));
  for (const sample of [field, restored]) {
    for (const [x, foot, expected] of [
      [0.5, 0, "stone"],
      [0.5, 3, "oak"],
      [1.5, 0, "oak"],
      [2.5, 0, "sand"],
      [3.5, 0, "grass"],
    ]) {
      assert.equal(sample.supportMaterial(x, 1, sample.standAt(x, 1, foot)), expected);
    }
    assert.equal(sample.supportMaterial(1.5, 1, 0.8), null);
  }
});

test("distance, actual grounding and water state drive sounds without pause or collision debt", () => {
  const heard = [];
  const foley = createSceneFoley({ emit: (event) => heard.push(event.name) });
  const walk = (overrides = {}, frames = 4) => {
    for (let i = 0; i < frames; i++)
      foley.walk({ x: 0, z: 0, foot: 0, moved: 0.18, dt: 0.12, grounded: true, wet: false, depth: 0, material: "stone", ...overrides });
  };
  walk();
  assert.deepEqual(heard, []);
  foley.setActive(true);
  walk();
  walk({ moved: 0 }, 100);
  walk({ grounded: false });
  foley.splash(2.6);
  walk({ wet: true, depth: 0.25 });
  walk({ grounded: false, wet: true, depth: 1.1 });
  foley.setActive(false);
  walk({ material: "grass" }, 10);
  foley.setActive(true);
  walk({ wet: true, depth: 0.25 }, 1);
  foley.resetWalk();
  walk({ material: "grass" }, 1);
  assert.deepEqual(heard, ["prepare", "stone", "splash", "wade", "swim", "quiet", "prepare"]);
});

test("plant brush uses nearby visible leaf vertices at body height", () => {
  const tree = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([0.24, 0.35, 0, 0.39, 0.6, 0, 0.4, 0.35, 0], 3));
  const leaf = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ name: "olive leaf" }));
  tree.add(leaf);
  const brush = createPlantBrush();
  brush.add(tree);
  assert.equal(brush.near(0, 0, 0), true);
  assert.equal(brush.near(0, 1.8, 0), false);
  assert.equal(brush.near(-0.6, 0, 0), false);
  tree.visible = false;
  assert.equal(brush.near(0, 0, 0), false);
  tree.visible = true;
  tree.position.set(1, 0, 0);
  assert.equal(brush.near(0, 0, 0), false);
  assert.equal(brush.near(1, 0, 0), true);
});

test("recorded cues load once, clamp intensity, rate-limit and clear before resume", async () => {
  const active = [];
  const gains = [];
  const context = {
    state: "running",
    currentTime: 0,
    decodeAudioData: async () => ({}),
    createBufferSource: () => ({
      connect: (next) => next,
      disconnect() {},
      start(at, offset, duration) {
        active.push({ at, offset, duration });
      },
      stop() {
        this.onended();
      },
    }),
    createGain: () => {
      const gain = { gain: { value: 0 }, connect() {}, disconnect() {} };
      gains.push(gain);
      return gain;
    },
  };
  let loads = 0;
  const foley = createFoley({ context, dry: {} }, () => {
    loads++;
    return new ArrayBuffer(12);
  });
  assert.equal(loads, 0);
  assert.equal(foley.play("fake", 1), 0);
  await Promise.all([foley.prepare(), foley.prepare()]);
  assert.equal(loads, 1);
  assert.equal(foley.play("stone", 300), 1);
  assert.equal(gains[0].gain.value, 0.18);
  assert.equal(foley.play("oak", 1), 0);
  context.currentTime = 0.1;
  assert.equal(foley.play("stone", 1), 0);
  assert.equal(foley.play("oak", 1), 1);
  context.currentTime = 0.2;
  assert.equal(foley.play("sand", 1), 1);
  context.currentTime = 0.3;
  assert.equal(foley.play("swim", 1), 1);
  context.currentTime = 0.4;
  assert.equal(foley.play("wade", 1), 0);
  assert.equal(active.length, 4);
  foley.quiet();
  assert.equal(foley.evidence().active, 0);
  context.state = "suspended";
  assert.equal(foley.play("oak", 1), 0);
});
