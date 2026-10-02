import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { GLTFLoader } from "../assets/js/vendor/three-r164/loaders/GLTFLoader.js";
import { createWorldCompanion } from "../assets/js/home-scene/companion.mjs";
import { companion } from "../assets/js/companion/bridge.mjs";
import { createPipMotion } from "../assets/js/companion/motion.mjs";

async function rig(t) {
  const bytes = readFileSync(new URL("../assets/models/pip/pip.glb", import.meta.url)),
    body = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")).scene,
    config = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8")),
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100),
    container = new EventTarget();
  camera.position.set(0, 4, 8);
  camera.lookAt(0, 3, 0);
  camera.updateMatrixWorld();
  container.getBoundingClientRect = () => ({ left: 0, top: 0, right: 600, bottom: 600, width: 600, height: 600 });
  companion.owner = "world";
  companion.motion = createPipMotion(61);
  companion.pointer = { x: 0, y: 0, at: 0 };
  companion.reduced = companion.paused = companion.napping = false;
  const world = await createWorldCompanion(new THREE.Scene(), config, container, { loadAsync: async () => ({ scene: body }) });
  t.after(() => world.dispose());
  let time = 0;
  const step = (seconds, id = "study", moving = true) => {
    time += seconds;
    world.update(Math.min(seconds, 0.25), time, camera, id, moving);
    return world.evidence();
  };
  step(0);
  return { step, world, config };
}

test("an interrupted upper-to-lower flight queues the latest room without the measured 2.6m floor snap", async (t) => {
  const { step } = await rig(t);
  step(0, "kitchen");
  const before = step(4, "kitchen"),
    onsen = step(0, "onsen");
  assert.equal(before.flight.phase, "fly");
  assert.deepEqual(onsen.position, before.position);
  assert.equal(onsen.flight.progress, before.flight.progress);
  assert.equal(onsen.pendingRoom, "onsen");
  assert.equal(onsen.destinationRoom, "kitchen");
  assert.equal(step(0, "gym").pendingRoom, "gym", "latest request replaces the obsolete pending room");
  const cancelled = step(0, "kitchen");
  assert.equal(cancelled.pendingRoom, null, "requesting the current arrival destination cancels the obsolete detour");
  assert.deepEqual(cancelled.position, before.position);
  step(0, "onsen");
  let arrival;
  for (let i = 0; i < 600; i++) {
    arrival = step(0.1, "onsen");
    if (arrival.destinationRoom === "onsen") break;
  }
  assert.equal(arrival.destinationRoom, "onsen");
  assert.equal(arrival.pendingRoom, null);
  assert.equal(arrival.flight.phase, "anticipate");
  assert.equal(arrival.flight.hover, 0.72, "the next journey starts from the physical kitchen perch height");
  assert.ok(Math.abs(arrival.position[1] - 0.72) < 1e-9);
});

test("pending destinations retain the airborne center through pause, reduced motion and page ownership", async (t) => {
  const { step } = await rig(t);
  step(0, "kitchen");
  const before = step(4, "kitchen");
  const paused = step(12, "onsen", false);
  assert.equal(paused.pendingRoom, "onsen");
  assert.deepEqual(paused.position, before.position);
  assert.equal(paused.activeSeconds, before.activeSeconds);
  companion.reduced = true;
  const reduced = step(12, "gym");
  assert.equal(reduced.pendingRoom, "gym");
  assert.deepEqual(reduced.position, before.position);
  companion.reduced = false;
  companion.owner = "page";
  step(12, "onsen");
  companion.owner = "world";
  const resumed = step(12, "onsen");
  assert.equal(resumed.pendingRoom, "onsen");
  assert.equal(resumed.destinationRoom, "kitchen");
  assert.deepEqual(resumed.position, before.position);
  assert.equal(resumed.flight.progress, before.flight.progress);
  assert.equal(resumed.activeSeconds, before.activeSeconds);
  assert.equal(resumed.attention.phase, "task");
});

test("a beach room request retains outbound and return routes and dispatches after the original indoor perch", async (t) => {
  const { step } = await rig(t);
  let departure;
  for (let i = 0; i < 2000; i++) {
    departure = step(0.25);
    if (departure.room === "beach" && departure.flight.phase === "anticipate") break;
  }
  assert.equal(departure.room, "beach", "the seeded real runtime must actually start an outing");
  const pending = step(0, "kitchen");
  assert.deepEqual(pending.position, departure.position);
  assert.equal(pending.pendingRoom, "kitchen");
  assert.equal(pending.destinationRoom, "study");
  step(0, "gym");
  step(0, "onsen");
  let returned,
    sawReturn = false,
    previous = departure;
  for (let i = 0; i < 2400; i++) {
    const current = step(0.1, "onsen");
    assert.ok(
      Math.hypot(...current.position.map((v, axis) => v - previous.position[axis])) < 0.35,
      "a queued beach request cannot teleport the center"
    );
    if (current.outing === "returning") sawReturn = true;
    if (current.destinationRoom === "onsen") {
      returned = current;
      break;
    }
    assert.equal(current.destinationRoom, "study", "the original home destination stays attached to the return route");
    assert.equal(current.pendingRoom, "onsen");
    previous = current;
  }
  assert.ok(sawReturn);
  assert.ok(returned, "latest requested room must dispatch after returning indoors");
  assert.equal(returned.outing, "home");
  assert.equal(returned.pendingRoom, null);
  assert.equal(returned.flight.phase, "anticipate");
  assert.ok(
    Math.hypot(...returned.position.map((v, axis) => v - departure.position[axis])) < 1e-9,
    "return reaches its actual departure perch before the next flight"
  );
});
