import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { GLTFLoader } from "../assets/js/vendor/three-r164/loaders/GLTFLoader.js";
import { createWorldCompanion } from "../assets/js/home-scene/companion.mjs";
import { companion } from "../assets/js/companion/bridge.mjs";
import { createPipMotion } from "../assets/js/companion/motion.mjs";

test("the native world rig returns quietly when a visitor leaves during hello", async (t) => {
  const previous = { companion: { ...companion }, matchMedia: globalThis.matchMedia },
    bytes = readFileSync(new URL("../assets/models/pip/pip.glb", import.meta.url)),
    body = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")).scene,
    config = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8")),
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100),
    container = new EventTarget();
  globalThis.matchMedia = () => ({ matches: false });
  container.getBoundingClientRect = () => ({ left: 0, top: 0, right: 600, bottom: 600, width: 600, height: 600 });
  camera.position.set(0, 4, 8);
  camera.lookAt(0, 3, 0);
  camera.updateMatrixWorld();
  Object.assign(companion, {
    owner: "world",
    motion: createPipMotion(61),
    pointer: { x: 0, y: 0, at: 0 },
    reduced: false,
    paused: false,
    napping: false,
  });
  const world = await createWorldCompanion(new THREE.Scene(), config, container, { loadAsync: async () => ({ scene: body }) });
  t.after(() => {
    world.dispose();
    Object.assign(companion, previous.companion);
    globalThis.matchMedia = previous.matchMedia;
  });
  let time = 0;
  function step(seconds, near = false) {
    const projected = world.evidence().projected;
    companion.pointer = near && projected ? { x: projected.x + 32, y: projected.y, at: performance.now() } : { x: 0, y: 0, at: 0 };
    time += seconds;
    world.update(Math.min(seconds, 0.25), time, camera, "study", true);
    return world.evidence();
  }
  step(0);
  for (let frame = 0; frame < 30; frame++) step(1 / 60, true);
  const greeting = world.evidence(),
    cooldownDeadline = greeting.activeSeconds + greeting.attention.cooldown;
  assert.equal(greeting.attention.phase, "greet");
  assert.equal(greeting.gesture, "hello");
  let returning;
  for (let frame = 0; frame < 180; frame++) {
    returning = step(1 / 60);
    if (returning.attention.phase !== "greet") break;
  }
  assert.equal(returning.attention.phase, "return");
  assert.equal(returning.gesture, "rest", "the real shared motor must not start listening after departure");
  assert.deepEqual(returning.position, greeting.position);
  let quiet;
  for (let frame = 0; frame < 90; frame++) quiet = step(1 / 60);
  assert.equal(quiet.attention.phase, "task");
  assert.equal(quiet.gesture, "rest");
  assert.equal(quiet.attention.greetings, 1);
  assert.ok(Math.abs(quiet.activeSeconds + quiet.attention.cooldown - cooldownDeadline) < 1e-9);
  assert.ok(
    quiet.arms.every((angle) => Math.abs(angle) <= 0.061),
    "only the small resting fin motion remains"
  );
  assert.ok(Math.abs(quiet.head[2]) < 0.02, "the abandoned listening tilt is absent from the native head");
  assert.equal(quiet.traveling, false);
});
