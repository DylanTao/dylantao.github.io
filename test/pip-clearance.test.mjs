import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { GLTFLoader } from "../assets/js/vendor/three-r164/loaders/GLTFLoader.js";
import { createPipClearanceFlight, samplePipClearanceFlight } from "../assets/js/companion/clearance.mjs";
import { createWorldCompanion } from "../assets/js/home-scene/companion.mjs";
import { roomRoute } from "../assets/js/home-scene/navigation.mjs";
import { companion } from "../assets/js/companion/bridge.mjs";
import { createPipMotion } from "../assets/js/companion/motion.mjs";

const config = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
async function nativeP() {
  const bytes = readFileSync(new URL("../assets/models/pip/pip.glb", import.meta.url));
  return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")).scene;
}
const room = (id) => config.rooms.find((r) => r.id === id);
const route = (from, to) => [
  ...roomRoute(config, room(from), room(to), config.companion.perches[from][0]).points.slice(0, -1),
  config.companion.perches[to][0],
];

test("P rises before translation and settles at the actual perch, with bounded vertical speed", () => {
  const points = config.companion.perches.kitchen,
    snapshot = structuredClone(points),
    flight = createPipClearanceFlight(points);
  assert.deepEqual(points, snapshot, "P cannot rewrite the source's human or perch coordinates");
  assert.deepEqual(samplePipClearanceFlight(flight, 0).position, points[0]);
  for (let t = 0; t < flight.anticipate; t += 1 / 60) {
    const p = samplePipClearanceFlight(flight, t),
      next = samplePipClearanceFlight(flight, t + 1 / 600);
    assert.deepEqual(p.position, points[0], "clearance is gained before horizontal departure");
    assert.ok(Math.abs(next.hover - p.hover) * 600 < 1.6, "vertical departure stays within the authored 1.6 m/s travel bound");
  }
  assert.equal(samplePipClearanceFlight(flight, flight.anticipate).hover, 1.65);
  assert.deepEqual(samplePipClearanceFlight(flight, flight.duration).position, points[1]);
  assert.equal(samplePipClearanceFlight(flight, flight.duration).hover, 0.72);
  assert.equal(samplePipClearanceFlight(flight, flight.duration).done, true);
  const small = createPipClearanceFlight(config.companion.perches.study, 1.13, 1.13);
  assert.equal(samplePipClearanceFlight(small, 0.8).hover, 1.13, "a tiny clear desk adjustment does not make an unnecessary climb");
});

test("P's upper and stair detours preserve all source points and the human route", () => {
  const source = route("study", "sleep"),
    before = structuredClone(source),
    air = createPipClearanceFlight(source, 1.13);
  assert.deepEqual(source, before);
  assert.deepEqual(air.points[0], source[0]);
  assert.deepEqual(air.points.at(-1), source.at(-1));
  assert.ok(
    air.points.some((p) => p[1] === 2.6 && p[2] === 2.15),
    "P passes in front of the retained shelf contents"
  );
  const stairs = createPipClearanceFlight(route("kitchen", "study"));
  assert.ok(
    stairs.points.some((p) => p[1] < 2.55 && p[2] === 4.45),
    "the stair air aisle clears both coat and upper deck"
  );
  assert.ok(roomRoute(config, room("study"), room("sleep"), source[0]).points.some((p) => p[2] === 3.94));
});

test("the actual P shell clears the three measured native components at cruise", async () => {
  const body = await nativeP(),
    group = new THREE.Group();
  body.scale.setScalar(0.46);
  group.add(body);
  const shell = body.getObjectByName("Continuous_tapered_shell");
  assert.ok(shell?.isMesh, "the assertion must use the authored GLB, not a proxy sphere");
  // Native component bounds from the exact GLB audit. The wider route audit
  // checks actual triangles; these conservative shell envelopes protect the
  // three original defects from a future profile regression.
  const cases = [
    { center: [-2.086803, 1.65, -1.521898], min: [-2.855, 0.06, -2.08], max: [-2.065, 0.88, -0.44], gap: 0.45 },
    { center: [1.843998, 4.25, 2.15], min: [1.817343, 2.6, 3.52], max: [1.99, 3.78, 5.12], gap: 1.1 },
    { center: [-1.748274, 4.25, 2.15], min: [-2.02, 3.3175, 3.55], max: [-1.68, 3.3625, 4.81], gap: 1.1 },
  ];
  for (const c of cases) {
    group.position.fromArray(c.center);
    for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 12) {
      group.rotation.y = yaw;
      body.rotation.set(-0.12, 0, 0.16); // conservative bank beyond the measured idle lean
      group.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(shell, true),
        obstacle = new THREE.Box3(new THREE.Vector3(...c.min), new THREE.Vector3(...c.max)),
        gaps = ["x", "y", "z"].map((axis) => Math.max(0, bounds.min[axis] - obstacle.max[axis], obstacle.min[axis] - bounds.max[axis]));
      assert.ok(Math.hypot(...gaps) > c.gap, "actual shell envelope must have positive measured component clearance at every heading");
    }
  }
});

test("the four corrected P perches protect rest/arrival clearance without changing other anchors", () => {
  assert.deepEqual(config.companion.perches.kitchen[1], [-3.5, 0, -2]);
  assert.deepEqual(config.companion.perches.gym[1], [0.55, 0, -2.25]);
  assert.deepEqual(config.companion.perches.onsen[1], [2.18, 2.6, 2.05]);
  assert.deepEqual(config.companion.perches.lounge[0], [3.3, 0, -3.65]);
  assert.deepEqual(config.terrain.contacts.study.actor, [-0.27, 2.6, 3.38]);
});

test("actual world altitude uses active flight age and freezes during pause and page ownership", async (t) => {
  const body = await nativeP(),
    scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100),
    container = new EventTarget();
  container.getBoundingClientRect = () => ({ left: 0, top: 0, right: 600, bottom: 600, width: 600, height: 600 });
  camera.position.set(0, 4, 8);
  camera.lookAt(0, 3, 0);
  camera.updateMatrixWorld();
  companion.owner = "world";
  companion.motion = createPipMotion(61);
  companion.pointer = { x: 0, y: 0, at: 0 };
  companion.reduced = companion.paused = companion.napping = false;
  const world = await createWorldCompanion(scene, config, container, { loadAsync: async () => ({ scene: body }) });
  t.after(() => world.dispose());
  let time = 0;
  const step = (seconds, id = "kitchen", moving = true) => {
    time += seconds;
    world.update(Math.min(0.25, seconds), time, camera, id, moving);
    return world.evidence();
  };
  step(0, "study");
  step(0);
  const flying = step(4);
  assert.equal(flying.flight.phase, "fly");
  assert.equal(flying.flight.hover, 1.65, "a four-second render gap cannot move P ahead at the old low hover height");
  assert.equal(flying.activeSeconds, 4);
  const paused = step(12, "kitchen", false);
  assert.deepEqual(paused.position, flying.position, "pause must not snap airborne P down to the rest hover");
  assert.equal(paused.flight.hover, flying.flight.hover);
  assert.equal(paused.activeSeconds, flying.activeSeconds);
  companion.owner = "page";
  step(8);
  companion.owner = "world";
  const returned = step(8);
  assert.deepEqual(returned.position, flying.position);
  assert.equal(returned.flight.hover, flying.flight.hover);
  assert.equal(returned.activeSeconds, flying.activeSeconds);
  assert.equal(returned.attention.phase, "task");
  assert.ok(step(0.1).flight.progress > returned.flight.progress);
});
