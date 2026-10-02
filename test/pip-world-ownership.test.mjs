import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createWorldCompanion } from "../assets/js/home-scene/companion.mjs";
import { companion } from "../assets/js/companion/bridge.mjs";
import { createPipMotion } from "../assets/js/companion/motion.mjs";

// Exercise the real ownership, director and shared motor against a minimal
// Three rig. This tests state continuity, not the appearance of a substitute
// model; real GLB/browser evidence is maintained by the integration suite.
async function rig(t) {
  const previousWindow = globalThis.window;
  const events = new EventTarget();
  globalThis.window = events;
  const body = new THREE.Group(),
    shell = new THREE.Group(),
    head = new THREE.Group();
  shell.name = "PipBody";
  head.name = "PipHead";
  body.add(shell);
  shell.add(head);
  for (const side of ["L", "R"])
    for (const prefix of ["PipEye", "PipArm", "PipAntenna"]) {
      const node = new THREE.Group();
      node.name = prefix + side;
      (prefix === "PipArm" ? shell : head).add(node);
    }
  const material = new THREE.MeshStandardMaterial();
  material.name = "Pip iris";
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), material));
  const config = {
    rooms: [{ id: "study", actor: [0.4, 0, 0.2], floor: 0 }],
    companion: {
      perches: {
        study: [
          [0, 0, 0],
          [0.2, 0, 0],
        ],
      },
      hover: { study: 0.72 },
    },
  };
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 1, 3);
  camera.lookAt(0, 0.72, 0);
  camera.updateMatrixWorld();
  companion.owner = "world";
  companion.motion = createPipMotion();
  companion.reduced = companion.paused = companion.napping = false;
  companion.pointer = { x: 0, y: 0, at: 0 };
  const world = await createWorldCompanion(
    scene,
    config,
    { getBoundingClientRect: () => ({ left: 0, top: 0, right: 600, bottom: 600, width: 600, height: 600 }) },
    { loadAsync: async () => ({ scene: body }) }
  );
  let time = 0;
  const step = (seconds, near = false) => {
    const p = world.evidence().projected;
    companion.pointer = near && p ? { x: p.x + 3, y: p.y, at: performance.now() } : { x: 0, y: 0, at: 0 };
    time += seconds;
    world.update(Math.min(seconds, 0.25), time, camera, "study", true);
    return world.evidence();
  };
  step(0);
  t.after(() => {
    world.dispose();
    globalThis.window = previousWindow;
  });
  return { world, events, step };
}

test("world greeting yields the page motor and regains a quiet task without repeating hello", async (t) => {
  const { world, step } = await rig(t);
  for (let i = 0; i < 42; i++) step(1 / 60, true);
  const before = world.evidence();
  assert.equal(before.attention.phase, "greet");
  assert.equal(before.gesture, "hello");
  companion.owner = "page";
  step(0.2);
  companion.motion.play("peek");
  const pagePose = companion.motion.update(0.2, { autonomous: false });
  step(3);
  assert.deepEqual(
    companion.motion.update(0, { autonomous: false }).head,
    pagePose.head,
    "hidden world frames must not overwrite the page's pose or gesture"
  );
  assert.equal(companion.motion.update(0, { autonomous: false }).gesture, "peek");
  companion.owner = "world";
  const returned = step(0.2, true);
  assert.equal(returned.attention.phase, "task");
  assert.equal(returned.gesture, "rest");
  assert.equal(returned.attention.greetings, before.attention.greetings);
  assert.equal(returned.attention.cooldown, before.attention.cooldown);
  assert.equal(returned.activeSeconds, before.activeSeconds);
  assert.deepEqual(returned.position, before.position);
  for (let i = 0; i < 60; i++) step(1 / 60, true);
  assert.equal(world.evidence().attention.greetings, 1, "ownership regain is not a new visitor arrival");
});

test("ownership event interrupts an encounter even when the hidden world does not render", async (t) => {
  const { world, events, step } = await rig(t);
  for (let i = 0; i < 42; i++) step(1 / 60, true);
  const before = world.evidence();
  companion.owner = "page";
  events.dispatchEvent(new Event("pip:change"));
  assert.equal(world.evidence().visible, false);
  companion.motion.play("repair");
  const pagePose = companion.motion.update(0.3, { autonomous: false });
  assert.equal(pagePose.gesture, "repair");
  companion.owner = "world";
  events.dispatchEvent(new Event("pip:change"));
  const returned = step(12, true);
  assert.equal(returned.attention.phase, "task");
  assert.equal(returned.gesture, "rest");
  assert.equal(returned.activeSeconds, before.activeSeconds);
  assert.equal(returned.attention.cooldown, before.attention.cooldown);
  assert.deepEqual(returned.position, before.position);
});

test("a handoff freezes an in-flight robot and resumes the same route without advancing it", async (t) => {
  const { world, events, step } = await rig(t);
  let before;
  for (let i = 0; i < 100; i++) {
    before = step(0.25);
    if (before.flight.phase === "fly") break;
  }
  assert.equal(before.flight.phase, "fly");
  companion.owner = "page";
  events.dispatchEvent(new Event("pip:change"));
  companion.motion.play("curious");
  companion.motion.update(0.25, { autonomous: false });
  companion.owner = "world";
  events.dispatchEvent(new Event("pip:change"));
  const returned = step(10);
  assert.equal(returned.activeSeconds, before.activeSeconds);
  assert.equal(returned.flight.progress, before.flight.progress);
  assert.deepEqual(returned.position, before.position);
  assert.equal(returned.gesture, "rest");
  const next = step(0.1);
  assert.ok(next.flight.progress > before.flight.progress, "the original route resumes when active world time advances");
});

test("disposing the world removes its ownership event handler", async (t) => {
  const { world, events, step } = await rig(t);
  step(0.4, true);
  world.dispose();
  const before = world.evidence().attention;
  companion.owner = "page";
  events.dispatchEvent(new Event("pip:change"));
  assert.deepEqual(world.evidence().attention, before);
});
