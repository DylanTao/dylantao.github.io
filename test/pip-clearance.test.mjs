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

const config = JSON.parse(readFileSync(process.env.COASTAL_MANIFEST_PATH || new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
async function nativeP() {
  const bytes = readFileSync(new URL("../assets/models/pip/pip.glb", import.meta.url));
  return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")).scene;
}
const room = (id) => config.rooms.find((r) => r.id === id);
const route = (from, to) => [
  ...roomRoute(config, room(from), room(to), config.companion.perches[from][0], { companion: true }).points.slice(0, -1),
  config.companion.perches[to][0],
];

test("P rises before translation and settles at the actual perch, with bounded vertical speed", () => {
  const points = [config.companion.perches.kitchen[0], config.companion.perches.lounge[0]],
    snapshot = structuredClone(points),
    flight = createPipClearanceFlight(points, 0.72, 0.72, { config });
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
  assert.ok(Math.abs(samplePipClearanceFlight(flight, flight.duration).hover - 0.72) < 1e-12);
  assert.equal(samplePipClearanceFlight(flight, flight.duration).done, true);
  const small = createPipClearanceFlight(config.companion.perches.study, 1.13, 1.13, { config });
  assert.equal(samplePipClearanceFlight(small, 0.8).hover, 1.13, "a tiny clear desk adjustment does not make an unnecessary climb");
});

test("P's upper and stair detours preserve all source points and the human route", () => {
  const source = route("study", "sleep"),
    before = structuredClone(source),
    air = createPipClearanceFlight(source, 1.13, 0.72, { config });
  assert.deepEqual(source, before);
  assert.deepEqual(air.points[0], source[0]);
  assert.deepEqual(air.points.at(-1), source.at(-1));
  if (config.retreat) {
    assert.ok(
      air.points.some((p) => p[1] === 2.6),
      "the actual bedroom connection reaches the upper floor"
    );
    assert.equal(roomRoute(config, room("study"), room("sleep"), source[0]).connection, "bedroom-study");
    const before = route("kitchen", "onsen");
    const stairs = createPipClearanceFlight(before, 0.72, 0.72, { config });
    assert.ok(stairs.points.some((p) => p[1] > 0.2 && p[1] < 2.5 && p[2] > config.navigation.lowerAisleZ));
    for (const override of config.companion.airPointOverrides || []) {
      assert.ok(override.point.every(Number.isFinite) && override.air.every(Number.isFinite));
    }
  } else {
    assert.ok(air.points.some((p) => p[1] === 2.6 && p[2] === config.navigation.upperAisleZ));
    const stairs = createPipClearanceFlight(route("kitchen", "study"), 0.72, 0.72, { config });
    assert.ok(
      stairs.points.some((p) => p[1] < 2.55 && p[2] === 6.85),
      "historical measured straight-stair air aisle"
    );
  }
});

test("retreat air overrides use the actual point once and never reuse the old stair world coordinates", () => {
  const points = [
      [0, 0, 8],
      [1, 0.5, 7.05],
      [2, 1, 8],
    ],
    snapshot = structuredClone(points),
    retreat = { retreat: { setbackMetres: 8 }, companion: {} },
    normal = createPipClearanceFlight(points, 0.72, 0.72, { config: retreat }),
    original = createPipClearanceFlight(points);
  assert.ok(
    normal.points.some((p) => p[2] < 7.1),
    "the bowed-stair path keeps its authored air line"
  );
  assert.ok(
    original.points.some((p) => p[2] < 6.9),
    "the old measured fixture remains available to historical manifests"
  );
  retreat.companion.airPointOverrides = [{ point: [...points[1]], air: [1, 0.2, 7.05] }];
  const adjusted = createPipClearanceFlight(points, 0.72, 0.72, { config: retreat });
  assert.deepEqual(adjusted.points[0], points[0]);
  assert.deepEqual(adjusted.points.at(-1), points.at(-1));
  assert.ok(adjusted.points.some((p) => Math.hypot(p[0] - 1, p[1] - 0.2, p[2] - 7.05) < 0.1));
  assert.ok(
    adjusted.points.every((p) => p[1] >= 0),
    "the hover offset is applied later, never subtracted twice here"
  );
  assert.deepEqual(points, snapshot, "measured air overrides cannot mutate human circulation");
});

test("companion room exits and its private air connection never rewrite human circulation", () => {
  const copy = structuredClone(config),
    from = copy.rooms.find((r) => r.id === "study"),
    to = copy.rooms.find((r) => r.id === "sleep"),
    human = roomRoute(copy, from, to, from.actor),
    airPath = [copy.terrain.contacts.study.egress, [-9, 2, 7], copy.terrain.contacts.sleep.egress];
  copy.companion.privateLibraryConnection = airPath;
  copy.companion.roomExits = { study: { exitPath: [[-9, 2, 7]], egress: copy.terrain.contacts.study.egress } };
  const air = roomRoute(copy, from, to, from.actor, { companion: true });
  assert.ok(air.points.some((p) => p.every((v, i) => v === airPath[1][i])));
  assert.deepEqual(roomRoute(copy, from, to, from.actor), human, "human paths retain every support and riser");
  assert.deepEqual(copy.companion.privateLibraryConnection, airPath, "the safe air descriptor remains immutable");
});

test("the actual P shell retains the three historical native-component clearance fixtures", async () => {
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

test("P perches retain their authored room and workstation frame", () => {
  if (config.retreat) {
    for (const entry of config.rooms) {
      assert.ok(config.companion.perches[entry.id]?.length, `${entry.id}: actual native perches must be authored`);
      for (const point of config.companion.perches[entry.id]) assert.ok(point.length === 3 && point.every(Number.isFinite));
    }
    const native = config.retreat.workstationNativeTranslation;
    const expected = [-0.36 + native[0], 2.6 + native[2], 3.55 - native[1] + config.retreat.setbackMetres];
    config.terrain.contacts.study.actor.forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) < 1e-8));
    return;
  }
  assert.deepEqual(config.companion.perches.kitchen[1], [-3.5, 0, -2]);
  assert.deepEqual(config.companion.perches.gym[1], [0.55, 0, -2.25]);
  assert.deepEqual(config.companion.perches.onsen[1], [2.18, 2.6, 2.05]);
  assert.deepEqual(config.companion.perches.lounge[0], [3.3, 0, -3.65]);
  // The office's chair at the L-shaped desk (bin/coastal_office.py ACTOR).
  assert.deepEqual(config.terrain.contacts.study.actor, [-0.36, 2.6, 3.55]);
});

test("a room without safe authored P perches holds a known room instead of inventing a perch or throwing", async (t) => {
  const copy = structuredClone(config);
  copy.companion.unavailableRooms = ["gym"];
  copy.rooms.push({ ...copy.rooms[0], id: "pending-native-room" });
  delete copy.companion.perches["pending-native-room"];
  companion.owner = "world";
  companion.motion = createPipMotion(61);
  companion.pointer = { x: 0, y: 0, at: 0 };
  companion.reduced = companion.paused = companion.napping = false;
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 4, 8);
  camera.lookAt(0, 3, 0);
  camera.updateMatrixWorld();
  const container = new EventTarget();
  container.getBoundingClientRect = () => ({ left: 0, top: 0, right: 600, bottom: 600, width: 600, height: 600 });
  const world = await createWorldCompanion(new THREE.Scene(), copy, container, { loadAsync: async () => ({ scene: await nativeP() }) });
  t.after(() => world.dispose());
  assert.doesNotThrow(() => world.update(0, 0, camera, "pending-native-room", true));
  assert.ok(copy.companion.perches[world.evidence().destinationRoom]?.length);
  world.update(0, 0, camera, "gym", true);
  assert.notEqual(world.evidence().destinationRoom, "gym", "a route with an unresolved native witness cannot become an airborne destination");
  delete copy.companion.perches.lounge;
  for (let time = 2; time <= 1200; time += 2)
    assert.doesNotThrow(
      () => world.update(0.25, time, camera, "pending-native-room", true),
      "a later beach outing also needs an authored coast perch"
    );
  assert.equal(world.evidence().outing, "home");
  for (const key of Object.keys(copy.companion.perches)) delete copy.companion.perches[key];
  assert.doesNotThrow(() => world.update(0, 0, camera, "pending-native-room", true));
  assert.equal(world.evidence().visible, false, "no unmeasured airborne fallback is invented");
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
  assert.equal(world.doorPose.active, true);
  assert.ok(Math.abs(world.doorPose.position[1] + flying.flight.hover - flying.position[1]) < 1e-9);
  const paused = step(12, "kitchen", false);
  assert.deepEqual(paused.position, flying.position, "pause must not snap airborne P down to the rest hover");
  assert.equal(paused.flight.hover, flying.flight.hover);
  assert.equal(paused.activeSeconds, flying.activeSeconds);
  companion.owner = "page";
  assert.equal(world.doorPose.active, false, "a page-owned companion cannot open a world door");
  step(8);
  companion.owner = "world";
  const returned = step(8);
  assert.deepEqual(returned.position, flying.position);
  assert.equal(returned.flight.hover, flying.flight.hover);
  assert.equal(returned.activeSeconds, flying.activeSeconds);
  assert.equal(returned.attention.phase, "task");
  assert.ok(step(0.1).flight.progress > returned.flight.progress);
});
