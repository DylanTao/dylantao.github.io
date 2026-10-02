import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createWorldCompanion } from "../assets/js/home-scene/companion.mjs";
import { companion } from "../assets/js/companion/bridge.mjs";
import { createPipMotion } from "../assets/js/companion/motion.mjs";
import { pipLocalAim, pipAngle, advancePipHeading, createPipTouchInvitation } from "../assets/js/companion/attention.mjs";

async function rig(t, coarse = false) {
  const previous = { window: globalThis.window, matchMedia: globalThis.matchMedia };
  globalThis.window = new EventTarget();
  globalThis.matchMedia = () => ({ matches: coarse });
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
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100),
    human = new THREE.Group(),
    humanHead = new THREE.Bone(),
    container = new EventTarget();
  human.name = "active-Sirui";
  humanHead.name = "Head";
  human.position.set(-0.5, 0, 0.1);
  humanHead.position.y = 1.1;
  human.add(humanHead);
  scene.add(human);
  camera.position.set(0, 1, 3);
  camera.lookAt(0, 0.72, 0);
  camera.updateMatrixWorld();
  container.getBoundingClientRect = () => ({ left: 0, top: 0, right: 600, bottom: 600, width: 600, height: 600 });
  companion.owner = "world";
  companion.motion = createPipMotion();
  companion.reduced = companion.paused = companion.napping = false;
  companion.pointer = { x: 0, y: 0, at: 0 };
  const world = await createWorldCompanion(
    scene,
    {
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
    },
    container,
    { loadAsync: async () => ({ scene: body }) }
  );
  let time = 0;
  const step = (seconds) => {
    time += seconds;
    world.update(Math.min(seconds, 0.25), time, camera, "study", true);
    return world.evidence();
  };
  const advance = (seconds) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) step(1 / 60);
    return world.evidence();
  };
  const touch = (type, x, y, id = 1) => {
    const e = new Event(type);
    Object.assign(e, { pointerType: "touch", pointerId: id, clientX: x, clientY: y });
    companion.pointer = { x, y, at: performance.now() };
    container.dispatchEvent(e);
  };
  step(0);
  t.after(() => {
    world.dispose();
    globalThis.window = previous.window;
    globalThis.matchMedia = previous.matchMedia;
  });
  return { world, step, advance, touch, scene, camera, human, humanHead, robotHead: head, robotGroup: scene.getObjectByName("P companion") };
}

test("P's local optical axes use world targets and cross the yaw seam by the shortest turn", () => {
  const aim = pipLocalAim([0, 1, 0], [1, 2, 1], Math.PI / 4);
  assert.ok(Math.abs(aim.gaze[0]) < 1e-12);
  assert.ok(aim.gaze[1] > 0, "an elevated world target looks up, irrespective of camera tilt");
  const seam = advancePipHeading(Math.PI - 0.01, -Math.PI + 0.1, 1 / 60);
  assert.ok(seam > Math.PI - 0.01, "turn across pi by +0.11 radians, not -6.17");
  assert.ok(Math.abs(seam - (Math.PI - 0.01)) <= 1.8 / 60);
  assert.equal(advancePipHeading(1, 2, 0), 1);
});

test("the live human head is the task target, independent of orbit, zoom and avatar replacement", async (t) => {
  const { world, advance, step, scene, camera, human, humanHead, robotHead, robotGroup } = await rig(t);
  const composed = advance(3);
  assert.equal(composed.attention.target, "visitor-ready", "the default resting pose keeps P's lenses readable");
  const before = advance(6.5);
  assert.equal(before.aim.taskSource, "live-head");
  assert.deepEqual(before.aim.target, [-0.5, 1.1 + 0.06, 0.1]);
  assert.ok(Math.abs(pipAngle(before.aim.yaw - before.aim.heading)) < 0.03);
  robotGroup.updateMatrixWorld(true);
  const opticalForward = new THREE.Vector3(0, 0, 1).transformDirection(robotHead.matrixWorld);
  const actualYaw = Math.atan2(opticalForward.x, opticalForward.z);
  assert.ok(
    Math.abs(pipAngle(before.aim.yaw - actualYaw)) < 0.08,
    "the actual lens/head forward axis points toward the live human, not its screen projection"
  );
  camera.position.set(-4, 4, -5);
  camera.lookAt(0, 0.72, 0);
  camera.updateMatrixWorld();
  const orbit = advance(0.2);
  assert.deepEqual(orbit.aim.target, before.aim.target);
  assert.ok(Math.abs(pipAngle(orbit.aim.heading - before.aim.heading)) < 0.01, "a camera move must not turn the task-facing shell");
  human.removeFromParent();
  const next = human.clone();
  next.position.x = -0.8;
  scene.add(next);
  const replaced = step(1 / 60);
  assert.deepEqual(replaced.aim.target, [-0.8, humanHead.position.y + 0.06, 0.1]);
  assert.equal(world.evidence().aim.taskSource, "live-head");
});

test("coarse input waits for a valid tap, completes listening beyond mouse expiry, and returns quietly", async (t) => {
  const { world, advance, touch } = await rig(t, true);
  advance(0.5);
  const p = world.evidence().projected;
  touch("pointerdown", p.x + 30, p.y);
  assert.equal(advance(0.1).attention.phase, "task", "finger down alone can become a drag");
  touch("pointerup", p.x + 30, p.y);
  assert.equal(advance(0.1).attention.phase, "notice");
  assert.equal(advance(0.4).attention.phase, "greet");
  const listening = advance(4.3);
  assert.equal(listening.attention.phase, "listen");
  assert.equal(listening.input.touchInvitation, true);
  assert.equal(listening.attention.greetings, 1);
  const returned = advance(2.8);
  assert.equal(returned.attention.phase, "task");
  assert.equal(returned.input.touchInvitation, false);
  assert.equal(returned.attention.greetings, 1);
});

test("touch pans, cancellations and multiple fingers cannot invite a greeting", async (t) => {
  const { world, advance, touch } = await rig(t, true);
  advance(0.5);
  const p = world.evidence().projected;
  touch("pointerdown", p.x + 25, p.y);
  touch("pointermove", p.x + 42, p.y);
  touch("pointerup", p.x + 25, p.y);
  assert.equal(advance(0.5).attention.phase, "task");
  touch("pointerdown", p.x + 25, p.y);
  touch("pointercancel", p.x + 25, p.y);
  touch("pointerup", p.x + 25, p.y);
  assert.equal(advance(0.5).attention.phase, "task");
  touch("pointerdown", p.x + 25, p.y, 1);
  touch("pointerdown", p.x + 25, p.y, 2);
  touch("pointerdown", p.x + 25, p.y, 3);
  for (const id of [1, 2, 3]) touch("pointerup", p.x + 25, p.y, id);
  assert.equal(advance(0.5).attention.greetings, 0);
});

test("a touch invitation uses active time and is discarded when ownership yields", async (t) => {
  const { world, advance, step, touch } = await rig(t, true);
  advance(0.5);
  const p = world.evidence().projected;
  touch("pointerdown", p.x + 25, p.y);
  touch("pointerup", p.x + 25, p.y);
  const before = advance(0.7);
  assert.equal(before.attention.phase, "greet");
  companion.owner = "page";
  globalThis.window.dispatchEvent(new Event("pip:change"));
  companion.owner = "world";
  globalThis.window.dispatchEvent(new Event("pip:change"));
  const after = step(10);
  assert.equal(after.input.touchInvitation, false);
  assert.equal(after.attention.phase, "task");
  assert.equal(after.activeSeconds, before.activeSeconds);
  assert.equal(after.attention.cooldown, before.attention.cooldown);
});

test("flight anticipation turns toward its authored route before the robot translates", async (t) => {
  const { world, step, human } = await rig(t);
  human.position.x = 0.7;
  let before;
  for (let i = 0; i < 1000; i++) {
    before = step(1 / 60);
    if (before.flight.phase === "anticipate") break;
  }
  assert.equal(before.flight.phase, "anticipate");
  const error = Math.abs(pipAngle(before.aim.yaw - before.aim.heading));
  let after;
  for (let i = 0; i < 12; i++) after = step(1 / 60);
  assert.equal(after.flight.phase, "anticipate");
  assert.deepEqual(after.position, before.position);
  assert.ok(Math.abs(pipAngle(after.aim.yaw - after.aim.heading)) < error - 0.1, "look and shell follow precede translation");
  assert.equal(world.evidence().gesture, "rest");
});

test("a completed touch invitation expires once and cannot be extended by stale coordinates", () => {
  const touch = createPipTouchInvitation();
  touch.down(1, 10, 20);
  touch.up(1, 10, 20, 2, true);
  assert.deepEqual(touch.sample(6.8), { x: 10, y: 20 });
  assert.equal(touch.sample(8.31), null);
  touch.up(1, 10, 20, 10, true);
  assert.equal(touch.sample(10), null);
});
