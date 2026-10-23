import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { DETAIL, chooseLevel, planDetail, projectedPixels, reachFor } from "../assets/js/home-scene/detail-levels.mjs";
import { createFurniture, furnitureMaterialName } from "../assets/js/home-scene/furniture.mjs";

const levels = [
  { file: "eames-lounge-lod1.glb", triangles: 6000, bytes: 60000 },
  { file: "eames-lounge-lod0.glb", triangles: 36000, bytes: 440000, near: 1.6, fullscreen: true },
];

test("a finer level reaches farther on a taller buffer and a little farther in full screen", () => {
  assert.equal(reachFor(levels[1], { bufferHeight: 600 }), 1.6);
  // The embed's buffer is never below the reference: a short canvas does not shrink the reach.
  assert.equal(reachFor(levels[1], { bufferHeight: 300 }), 1.6);
  assert.ok(Math.abs(reachFor(levels[1], { bufferHeight: 2160 }) - 1.6 * 3.6) < 1e-9);
  assert.ok(Math.abs(reachFor(levels[1], { bufferHeight: 2160, fullscreen: true }) - 1.6 * 3.6 * DETAIL.fullscreenBoost) < 1e-9);
  assert.equal(reachFor({ ...levels[1], fullscreen: false }, { bufferHeight: 600, fullscreen: true }), 1.6);
  assert.equal(reachFor(levels[0], { bufferHeight: 600 }), 0);
});

test("levels switch with hysteresis, only in view, and never past the levels listed", () => {
  const view = { bufferHeight: 600 };
  assert.equal(chooseLevel(levels, 0, { ...view, distance: 3 }), 0);
  // Entering needs (1 - h) of the reach; leaving waits for (1 + h).
  const reach = 1.6;
  assert.equal(chooseLevel(levels, 0, { ...view, distance: reach * (1 - DETAIL.hysteresis) + 0.01 }), 0);
  assert.equal(chooseLevel(levels, 0, { ...view, distance: reach * (1 - DETAIL.hysteresis) - 0.01 }), 1);
  assert.equal(chooseLevel(levels, 1, { ...view, distance: reach }), 1);
  assert.equal(chooseLevel(levels, 1, { ...view, distance: reach * (1 + DETAIL.hysteresis) - 0.01 }), 1);
  assert.equal(chooseLevel(levels, 1, { ...view, distance: reach * (1 + DETAIL.hysteresis) + 0.01 }), 0);
  // A camera that drifts back and forth across the reach does not flicker.
  let current = 0;
  const flips = [];
  for (let k = 0; k < 200; k++) {
    const next = chooseLevel(levels, current, { ...view, distance: reach + 0.12 * Math.sin(k * 0.7) });
    if (next !== current) flips.push(k);
    current = next;
  }
  assert.ok(flips.length <= 1, `flipped ${flips.length} times`);
  assert.equal(chooseLevel(levels, 0, { ...view, distance: 0.5, inView: false }), 0);
  assert.equal(chooseLevel([levels[0]], 0, { ...view, distance: 0.1 }), 0);
  // Full screen at 4K wants the fine level from across the room.
  assert.equal(chooseLevel(levels, 0, { bufferHeight: 2160, fullscreen: true, distance: 5.5 }), 1);
});

test("projected size follows the lens and the buffer", () => {
  const px = projectedPixels(0.5, 5, 38, 600);
  assert.ok(Math.abs(px - (0.5 / (5 * Math.tan((19 * Math.PI) / 180))) * 300) < 1e-9);
  assert.ok(projectedPixels(0.5, 10, 38, 600) < px);
  assert.ok(projectedPixels(0.5, 5, 38, 1200) > px);
  assert.equal(projectedPixels(0.5, 0, 38, 600), Infinity);
});

test("the byte budget grants the nearest first, releases idle levels after they linger, and limits fetches", () => {
  const requests = [
    { key: "a#1", bytes: 1_500_000, priority: 0.2 },
    { key: "b#1", bytes: 1_200_000, priority: 0.5 },
    { key: "c#1", bytes: 800_000, priority: 0.9 },
    { key: "a#1", bytes: 1_500_000, priority: 0.4 },
  ];
  const plan = planDetail(requests, {}, { budget: 3_000_000, now: 0 });
  assert.deepEqual([...plan.keep], ["a#1", "b#1"]);
  assert.equal(plan.bytes, 2_700_000);
  assert.deepEqual(plan.fetch, ["a#1", "b#1"]);
  // Only `concurrent` loads in flight.
  const busy = planDetail(requests, { "a#1": { bytes: 1_500_000, lastWanted: 0, loading: true } }, { budget: 3_000_000, now: 0, concurrent: 2 });
  assert.deepEqual(busy.fetch, ["b#1"]);
  // An idle level lingers, then goes; a level the grant needs room for goes at once.
  const idle = { "z#1": { bytes: 500_000, lastWanted: 1000, loading: false } };
  assert.deepEqual(planDetail([], idle, { budget: 3_000_000, now: 1000 + DETAIL.linger - 1 }).release, []);
  assert.deepEqual(planDetail([], idle, { budget: 3_000_000, now: 1000 + DETAIL.linger }).release, ["z#1"]);
  assert.deepEqual(planDetail(requests, idle, { budget: 3_000_000, now: 1001 }).release, ["z#1"]);
  // A loading level is never released mid-flight.
  assert.deepEqual(planDetail([], { "y#1": { bytes: 1, lastWanted: 0, loading: true } }, { budget: 0, now: 1e9 }).release, []);
});

test("level suffixes are stripped from material names", () => {
  assert.equal(furnitureMaterialName("eames leather (lod1)"), "eames leather");
  assert.equal(furnitureMaterialName("eames leather"), "eames leather");
});

// A fake house: one room root with a placeholder, a camera, and models that resolve on demand.
function house({ anchors, index = undefined, failing = [] } = {}) {
  const room = new THREE.Group();
  room.name = "room-lounge";
  const placeholder = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.5), new THREE.MeshStandardMaterial());
  placeholder.userData.furniturePlaceholder = "lounge-eames";
  room.add(placeholder);
  const fetched = [];
  const loads = [];
  let compiles = 0;
  const furniture = createFurniture({
    config: { furniture: anchors },
    baseUrl: "https://example.test/assets/models/home/manifest.json",
    fetchIndex: async (url) => {
      fetched.push(url);
      return index === undefined
        ? { version: 1, items: { "eames-lounge": { label: "Eames", lods: levels, bounds: { min: [-0.4, 0, -0.8], max: [0.4, 0.8, 0.8] } } } }
        : index;
    },
    loadModel: async (url) => {
      loads.push(url);
      if (failing.some((f) => url.endsWith(f))) throw new Error("404");
      const scene = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.8, 1.5),
        new THREE.MeshStandardMaterial({
          name: url.includes("aeron") ? "aeron carbon frame" : url.includes("lod1") ? "eames leather (lod1)" : "eames leather",
          color: url.includes("aeron") ? 0x202323 : 0xffffff,
        })
      );
      scene.add(mesh);
      return { scene };
    },
    compile: async () => {
      compiles++;
    },
    roomRoot: (id) => (id === "lounge" ? room : null),
  });
  const camera = new THREE.PerspectiveCamera(38, 1.2, 0.05, 300);
  return { room, placeholder, furniture, camera, fetched, loads, compiles: () => compiles };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const anchor = { id: "lounge-eames", item: "eames-lounge", room: "lounge", position: [3.7, 0, -2.35], yaw: Math.PI };

test("without anchors nothing is fetched, and missing pieces on either side are skipped", async () => {
  const bare = house({ anchors: undefined });
  assert.equal(await bare.furniture.indexReady, null);
  assert.deepEqual(bare.fetched, []);
  assert.deepEqual(await bare.furniture.load("lounge"), []);
  await bare.furniture.attach("lounge", bare.room, null);
  assert.equal(bare.furniture.update({ camera: bare.camera }), false);
  assert.equal(bare.placeholder.visible, true);
  // An index without the item, a missing index, an anchor in an unknown room, a model that fails.
  for (const variant of [
    house({ anchors: [anchor], index: { version: 1, items: {} } }),
    house({ anchors: [anchor], index: null }),
    house({ anchors: [{ ...anchor, room: "attic" }] }),
    house({ anchors: [anchor], failing: ["eames-lounge-lod1.glb"] }),
  ]) {
    const pending = variant.furniture.load("lounge");
    await variant.furniture.attach("lounge", variant.room, pending, 10);
    variant.furniture.update({ camera: variant.camera });
    await flush();
    variant.furniture.update({ camera: variant.camera });
    assert.equal(variant.placeholder.visible, true);
    assert.equal(variant.room.children.filter((o) => o.userData.furnitureAnchor).flatMap((g) => g.children).length, 0);
  }
  // Malformed anchors are ignored.
  const malformed = house({ anchors: [{ id: "x", item: "eames-lounge", room: "lounge", position: [0, 0] }, null] });
  assert.equal(malformed.furniture.anchors.length, 0);
});

test("an item stands at its anchor in its room, hides the placeholder and shares one load", async () => {
  const twin = { ...anchor, id: "lounge-eames-2", position: [1, 0, 1], yaw: 0 };
  const h = house({ anchors: [anchor, twin] });
  const pending = h.furniture.load("lounge");
  await h.furniture.attach("lounge", h.room, pending);
  const groups = h.room.children.filter((o) => o.userData.furnitureAnchor);
  assert.equal(groups.length, 2);
  const [first, second] = groups;
  assert.deepEqual(first.position.toArray(), [3.7, 0, -2.35]);
  assert.ok(Math.abs(first.rotation.y - Math.PI) < 1e-9);
  assert.equal(h.placeholder.visible, false);
  // One fetch serves both anchors; their meshes share geometry and material.
  assert.equal(h.loads.filter((u) => u.endsWith("eames-lounge-lod1.glb")).length, 1);
  const a = first.children[0].children[0],
    b = second.children[0].children[0];
  assert.equal(a.geometry, b.geometry);
  assert.equal(a.material, b.material);
  assert.ok(a.userData.dynamic, "kept out of the static light bake");
  assert.ok(a.userData.fixedMaterial, "prepared furniture is not styled into another material copy");
  assert.equal(first.children[0].visible, true);
  const evidence = h.furniture.evidence();
  assert.equal(evidence.placed.find((p) => p.id === "lounge-eames").shown, 0);
  assert.equal(evidence.placed.find((p) => p.id === "lounge-eames").placeholderHidden, true);
  // Disposal restores the placeholder and removes the pieces.
  h.furniture.dispose();
  assert.equal(h.placeholder.visible, true);
  assert.equal(h.room.children.filter((o) => o.userData.furnitureAnchor).length, 0);
});

test("coming close loads the fine level, swaps after its programs, and going away swaps back", async () => {
  const h = house({ anchors: [anchor] });
  await h.furniture.attach("lounge", h.room, h.furniture.load("lounge"));
  const centre = new THREE.Vector3(3.7, 0.4, -2.35);
  const look = (distance) => {
    h.camera.position.copy(centre).add(new THREE.Vector3(0, 0.4, distance));
    h.camera.lookAt(centre);
    h.camera.updateMatrixWorld();
    return h.furniture.update({ camera: h.camera, bufferHeight: 600 });
  };
  look(6);
  assert.equal(h.loads.filter((u) => u.endsWith("lod0.glb")).length, 0, "far away: only the default");
  look(1.0);
  await flush();
  look(1.0); // the fine level has arrived: added hidden while its programs compile
  await flush();
  await flush();
  look(1.0);
  const state = () => h.furniture.evidence().placed[0];
  assert.equal(state().shown, 1);
  assert.equal(h.loads.filter((u) => u.endsWith("eames-lounge-lod0.glb")).length, 1);
  assert.ok(h.compiles() >= 1);
  // Inside the hysteresis band it holds; past it, it returns to the default.
  look(1.6 * (1 + DETAIL.hysteresis) - 0.35 * 0.95);
  assert.equal(state().shown, 1);
  look(4);
  assert.equal(state().shown, 0);
  // Looking away: an anchor out of view wants only its default.
  h.camera.position.set(3.7, 1, -1.3);
  h.camera.lookAt(3.7, 1, 5);
  h.camera.updateMatrixWorld();
  h.furniture.update({ camera: h.camera });
  assert.equal(state().wanted, 0);
  assert.equal(h.furniture.evidence().fineBytes, 440000, "the fine level lingers before it is released");
});

test("the runtime's interface stays what index.json and the manifest describe", () => {
  const source = readFileSync(new URL("../assets/js/home-scene/furniture.mjs", import.meta.url), "utf8");
  assert.match(source, /furniturePlaceholder/);
  assert.match(source, /furniture\/index\.json/);
  const index = JSON.parse(readFileSync(new URL("../assets/models/home/furniture/index.json", import.meta.url), "utf8"));
  assert.equal(index.version, 1);
  for (const [id, item] of Object.entries(index.items)) {
    assert.ok(item.label && item.provenance, id);
    assert.equal(item.origin, "floor-center", id);
    assert.equal(item.front, "+z", id);
    assert.ok(item.lods.length >= 2, id);
    assert.ok(item.lods[0].file.endsWith("-lod1.glb") && !item.lods[0].near, `${id}: the default comes first`);
    for (const lod of item.lods.slice(1)) assert.ok(lod.near > 0 && lod.fullscreen === true, id);
    assert.ok(item.lods[0].triangles < item.lods[1].triangles && item.lods[0].bytes < item.lods[1].bytes, id);
    assert.ok(
      item.bounds.min.every((v, i) => v < item.bounds.max[i]),
      id
    );
    if (!["range-hood", "pot-filler", "floating-fireplace"].includes(id))
      assert.ok(Math.abs(item.bounds.min[1]) < 0.003, `${id} stands on its origin`);
    assert.ok(
      Math.abs(item.bounds.min[0] + item.bounds.max[0]) < 0.002 && Math.abs(item.bounds.min[2] + item.bounds.max[2]) < 0.002,
      `${id} is centred`
    );
  }
});

test("a held pan keeps its source grip exact across rotation and returns to the shelf", async () => {
  const pan = { ...anchor, id: "gym-pan", item: "cast-iron-pan", yaw: 0 };
  const h = house({
    anchors: [pan],
    index: {
      version: 1,
      items: { "cast-iron-pan": { lods: levels, grip: [0, 0.058, 0.2], bounds: { min: [-0.2, 0, -0.3], max: [0.2, 0.08, 0.3] } } },
    },
  });
  await h.furniture.attach("lounge", h.room, h.furniture.load("lounge"));
  const rest = h.furniture.grip("gym-pan");
  const target = [4.2, 1.05, -1.5];
  h.furniture.hold("gym-pan", target, Math.PI, 0.25);
  const group = h.room.children.find((o) => o.userData.furnitureAnchor === "gym-pan");
  group.updateWorldMatrix(true, false);
  const actual = group.localToWorld(new THREE.Vector3(0, 0.058, 0.2));
  assert.ok(actual.distanceTo(new THREE.Vector3(...target)) < 1e-9);
  assert.deepEqual(h.furniture.grip("gym-pan"), rest, "pickup target remains the shelf while held");
  h.furniture.hold("gym-pan");
  assert.deepEqual(group.position.toArray(), pan.position);
  h.furniture.dispose();
});

test("hidden rooms never request fine furniture", async () => {
  const h = house({ anchors: [anchor] });
  await h.furniture.attach("lounge", h.room, h.furniture.load("lounge"));
  h.room.visible = false;
  h.camera.position.set(3.7, 0.4, -1.3);
  h.camera.lookAt(3.7, 0.4, -2.35);
  h.furniture.update({ camera: h.camera, bufferHeight: 2160, fullscreen: true });
  await flush();
  assert.equal(h.furniture.evidence().placed[0].wanted, 0);
  assert.equal(h.loads.length, 1);
  h.furniture.dispose();
});

test("Carbon and Mineral update the visible shared chair and return exactly", async () => {
  const h = house({ anchors: [{ ...anchor, item: "aeron" }], index: { version: 1, items: { aeron: { lods: levels } } } });
  await h.furniture.attach("lounge", h.room, h.furniture.load("lounge"));
  const group = h.room.children.find((o) => o.userData.furnitureAnchor);
  const mesh = group.children[0].children[0];
  const carbon = mesh.material.color.toArray();
  h.furniture.setVariant("mineral");
  assert.ok(mesh.material.color.r > carbon[0] * 5, "Mineral is visibly lighter");
  h.furniture.setVariant("carbon");
  assert.deepEqual(mesh.material.color.toArray(), carbon);
  h.furniture.dispose();
});
