import * as THREE from "../three.module.min.js";
import { BODY, createWalkFieldBuilder } from "./colliders.mjs";
import { collisionBounds, ORBIT_DIRECTION, portraitFov } from "./camera.mjs";
import { createGamepads } from "./gamepad.mjs";
import { createVirtualJoysticks } from "./virtual-joysticks.mjs";

// Walk mode for the full-screen home (Sirui, 2026-10-19: "maybe the navigation in full screen can be a
// bit more game like, like minecraft control that better leverage keyboard ... or joy stick on both
// side for a mobile view"). Orbiting the stations stays the default; V, the Walk switch or a
// controller's Y swaps to the visitor's own eyes and back.
//
//   Keyboard  W A S D or the arrows (Left/Right turn), Shift runs, Page Up/Down look up and down,
//             Home levels the view, + and - zoom the lens.
//   Mouse     drag to look (the world follows the hand), or click to capture the pointer and look
//             with the mouse itself; the first Escape frees it, the next leaves full screen
//             (world-fullscreen.mjs). The wheel zooms the lens.
//   Touch     twin thumb sticks (virtual-joysticks.mjs): left walks, right looks; a free finger drags
//             the view and two pinch the lens.
//   Gamepad   left stick walks, right stick looks, the left stick's click or a left bumper runs.
//
// The body (colliders.mjs BODY) is a capsule that climbs steps and stairs, stops at walls, furniture,
// glass and water, and never steps off a drop it could not climb back. Its collision field is built
// from the loaded meshes when full screen opens. There is no head bob; reduced motion removes every
// ease (velocity, steps, the arrival glide) but keeps every control.
export const WALK = Object.freeze({
  eyeHeight: 1.6,
  walkSpeed: 2,
  runSpeed: 4.2,
  // Velocity ease (seconds); none under reduced motion.
  accelTau: 0.11,
  mouseSensitivity: 0.0024,
  turnRate: 1.9,
  pitchRate: 1.3,
  pitchLimit: 1.4,
  fov: 62,
  minFov: 24,
  maxFov: 75,
  transition: 0.65,
  // The eyes rise over a step (critically damped, per second).
  eyeFrequency: 16,
});

const MOVE_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
  "PageUp",
  "PageDown",
]);
// Some on-screen keyboards report no physical code; their characters stand in.
const KEY_CODES = { w: "KeyW", a: "KeyA", s: "KeyS", d: "KeyD", v: "KeyV", shift: "ShiftLeft" };
export const keyCode = (event) => event.code || KEY_CODES[String(event.key || "").toLowerCase()] || event.key || "";
// Orbit shortcuts that walking keeps to itself (D strafes; N, digits and Enter do nothing).
const SWALLOWED = /^(KeyN|Digit[0-9]|Enter|NumpadEnter|Equal|Minus|NumpadAdd|NumpadSubtract|Home|KeyV)$/;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Held keys as axes: strafe (right +), forward, turn (left +, so yaw grows), pitch (up +), run.
export function keyAxes(keys) {
  const has = (code) => keys.has(code);
  return {
    strafe: (has("KeyD") ? 1 : 0) - (has("KeyA") ? 1 : 0),
    forward: (has("KeyW") || has("ArrowUp") ? 1 : 0) - (has("KeyS") || has("ArrowDown") ? 1 : 0),
    turn: (has("ArrowLeft") ? 1 : 0) - (has("ArrowRight") ? 1 : 0),
    pitch: (has("PageUp") ? 1 : 0) - (has("PageDown") ? 1 : 0),
    run: has("ShiftLeft") || has("ShiftRight"),
  };
}

// World motion for a local (strafe, forward) input facing `yaw`: forward is (sin yaw, cos yaw), the
// same convention as the characters' facing, and the right hand is (-cos yaw, sin yaw).
export function walkDirection(yaw, strafe, forward) {
  return [Math.sin(yaw) * forward - Math.cos(yaw) * strafe, Math.cos(yaw) * forward + Math.sin(yaw) * strafe];
}

// Input in the unit disc: diagonal keys are not faster than straight ones.
export function unitDisc(x, y) {
  const length = Math.hypot(x, y);
  return length > 1 ? [x / length, y / length] : [x, y];
}

// Exponential approach to the wanted velocity; reduced motion takes it at once.
export function easeVelocity(current, wanted, dt, tau = WALK.accelTau, reduced = false) {
  if (reduced || !(tau > 0)) return wanted;
  const keep = Math.exp(-Math.max(0, dt) / tau);
  return wanted + (current - wanted) * keep;
}

// Integrate the same exponential over the whole frame, rather than travelling at its end speed.
// A 30 Hz phone and a 120 Hz desktop therefore cover the same distance while starting or stopping.
export function integrateVelocity(current, wanted, dt, tau = WALK.accelTau, reduced = false) {
  dt = Math.max(0, dt);
  if (reduced || !(tau > 0)) return { velocity: wanted, distance: wanted * dt };
  const keep = Math.exp(-dt / tau);
  return { velocity: wanted + (current - wanted) * keep, distance: wanted * dt + (current - wanted) * tau * (1 - keep) };
}

// Walking speed for an input of `magnitude` (0-1): full keys or a stick past 85 % walk, a held Shift
// or a controller's run button runs (the touch stick runs at its rim, decided by the caller).
export function walkSpeed(magnitude, run, walk = WALK) {
  if (!(magnitude > 0)) return 0;
  const m = Math.min(1, magnitude);
  return run ? walk.runSpeed * m : walk.walkSpeed * Math.min(1, m / 0.85);
}

// A drag that keeps the world under the hand: the angle the dragged pixels subtend.
export function dragLook(dx, dy, fovDegrees, aspect, heightPixels) {
  const vertical = THREE.MathUtils.degToRad(fovDegrees),
    horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect),
    width = Math.max(1, heightPixels * aspect);
  return [(dx * horizontal) / width, (dy * vertical) / Math.max(1, heightPixels)];
}

// Captured mouse motion: right turns right (yaw falls), up looks up.
export const mouseLook = (movementX, movementY, sensitivity = WALK.mouseSensitivity) => [-movementX * sensitivity, -movementY * sensitivity];

// The camera orientation for a walker's yaw and pitch (three's camera looks down its -z axis).
const lookEuler = new THREE.Euler(0, 0, 0, "YXZ");
export function walkQuaternion(yaw, pitch, out = new THREE.Quaternion()) {
  lookEuler.set(pitch, yaw + Math.PI, 0, "YXZ");
  return out.setFromEuler(lookEuler);
}

// The main entrance is the first walking arrival, whatever the orbit was looking at. An explicit
// walk.start wins; otherwise the portal faces the last point on the authored ascending route.
// Older manifests without an entrance start in a room, a little in front of what the view looks at, on the room's own
// floor and facing it (the side the current camera is on, so the visitor keeps their bearings); from
// the coast, on the terrace facing the house; from the whole house, in Sirui's room. A manifest
// `walk.start` ({ position, yaw }) overrides every first arrival, for an entrance.
export function spawnPlan(config, view) {
  const rooms = config?.rooms || [];
  const start = config?.walk?.start ?? (config?.entrance?.portal ? { position: config.entrance.portal } : null);
  if (start?.position) {
    const route = config?.entrance?.route || [];
    const toward = [...route].reverse().find((point) => Math.hypot(point[0] - start.position[0], point[2] - start.position[2]) > 0.2);
    const yaw = start.yaw ?? (toward ? Math.atan2(toward[0] - start.position[0], toward[2] - start.position[2]) : Math.PI);
    return { candidates: [[start.position[0], start.position[2]]], floor: start.position[1], yaw, pitch: start.pitch ?? -0.08 };
  }
  if (view.room === "outside" && config?.terrace?.region) {
    const { min, max } = config.terrace.region,
      x = (min[0] + max[0]) / 2,
      z = (min[2] + max[2]) / 2,
      planeZ = config.facade?.planeZ ?? config.cameraCollision?.facade?.planeZ ?? max[2];
    return { candidates: [[x, z]], searchFrom: max[1], floor: 0, yaw: planeZ > z ? 0 : Math.PI, pitch: 0.05 };
  }
  const id = rooms.some((r) => r.id === view.room) ? view.room : view.routineRoom || rooms[0]?.id;
  const room = rooms.find((r) => r.id === id);
  if (!room?.target) return null;
  const target = room.target;
  let toward = null;
  if (view.room === id && view.camera) toward = [view.camera[0] - target[0], view.camera[2] - target[2]];
  if (!toward || Math.hypot(...toward) < 0.2) {
    const d = room.camera ? ORBIT_DIRECTION(room.camera.yaw ?? 0.65, room.camera.pitch ?? 0.24) : [0, 0, -1];
    toward = [d[0], d[2]];
  }
  const length = Math.hypot(...toward) || 1,
    ux = toward[0] / length,
    uz = toward[1] / length;
  return {
    candidates: [1.7, 1.3, 2.2, 0.9, 2.7, 3.2].map((d) => [target[0] + ux * d, target[2] + uz * d]),
    floor: room.floor ?? 0,
    look: target,
    room: id,
  };
}

// Which room the walker is in: the terrace region (or the sea side of the glass front) is the coast;
// otherwise the nearest room on the walker's storey, with a little hysteresis; far above the upper
// storey (the clifftop, an entrance stair's top) is the coast too.
export function roomAt(config, x, z, foot, previous = null) {
  // The recessed library projects beyond the original facade plane. Its actual enclosed
  // footprint takes precedence over the legacy seaward/outdoor shortcut, on both storeys.
  const enclosed = (config?.rooms || []).filter((room) => {
    const bounds = room.library?.floorBounds;
    return bounds && x >= bounds.min[0] && x <= bounds.max[0] && z >= bounds.min[2] && z <= bounds.max[2] && Math.abs(room.floor - foot) <= 1.4;
  });
  if (enclosed.length) return enclosed.sort((a, b) => Math.abs(a.floor - foot) - Math.abs(b.floor - foot))[0].id;
  const terrace = config?.terrace?.region;
  if (terrace && x >= terrace.min[0] && x <= terrace.max[0] && z >= terrace.min[2] && z <= terrace.max[2] && foot <= terrace.max[1]) return "outside";
  const planeZ = config?.facade?.planeZ ?? config?.cameraCollision?.facade?.planeZ;
  const rooms = config?.rooms || [];
  if (Number.isFinite(planeZ) && z < planeZ - 0.15 && foot < 1.5) return "outside";
  const top = Math.max(...rooms.map((r) => r.floor ?? 0), 0);
  if (foot > top + 2.3) return "outside";
  let best = null,
    nearest = Infinity,
    current = Infinity;
  for (const room of rooms) {
    if (!room.target || Math.abs((room.floor ?? 0) - foot) > 1.4) continue;
    const d = Math.hypot(room.target[0] - x, room.target[2] - z);
    if (room.id === previous) current = d;
    if (d < nearest) {
      nearest = d;
      best = room.id;
    }
  }
  if (!best) return previous;
  return current - nearest < 0.4 && previous && previous !== "outside" && current < Infinity ? previous : best;
}

export function createWalkMode({
  camera,
  canvas,
  stage,
  container,
  world,
  getConfig,
  houseRoots = () => [],
  getActor = () => null,
  doors = () => [],
  view,
  isFullscreen,
  isReady = () => true,
  isReduced = () => false,
  hint = () => {},
  requestFrame = () => {},
  onEnter = () => {},
  onRoom = () => {},
  onExit = () => {},
}) {
  const doc = canvas.ownerDocument,
    win = doc.defaultView || globalThis;
  const keys = new Set();
  const state = { x: 0, z: 0, foot: 0, eye: WALK.eyeHeight, eyeVelocity: 0, yaw: 0, pitch: 0, vx: 0, vz: 0 };
  let active = false,
    placed = false,
    provisional = false,
    plan = null,
    resume = null,
    builder = null,
    room = null,
    fov = WALK.fov,
    transition = null,
    pendingYaw = 0,
    pendingPitch = 0,
    drag = null,
    pinch = null,
    locked = false,
    touchSeen = false,
    moved = false,
    hintTimer = 0,
    orbitHints = 0,
    blockedFrames = 0,
    lastBlocked = null,
    gamepadPoller = 0,
    distance = 0;
  const touches = new Map();
  const listeners = [];
  const coarse = win.matchMedia?.("(pointer: coarse)");
  const button = stage.querySelector("[data-world-walk]");
  const crosshair = doc.createElement("span");
  crosshair.className = "home-world-crosshair";
  crosshair.setAttribute("aria-hidden", "true");
  container.append(crosshair);
  const sticks = createVirtualJoysticks(stage, { onInput: () => requestFrame() });
  const gamepads = createGamepads();
  let pad = { move: [0, 0], look: [0, 0], run: false, toggled: false, active: false, connected: 0 };
  const position = new THREE.Vector3(),
    quaternion = new THREE.Quaternion(),
    startPosition = new THREE.Vector3(),
    startQuaternion = new THREE.Quaternion();

  function on(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  }

  // The collision field covers the house as loaded: the room targets' reach (camera.mjs), the
  // terrace, an optional manifest walk.region and the bounds of the house's own models, so an
  // expanded house or an entrance stair from the clifftop is inside it.
  function fieldBounds(config) {
    const box = new THREE.Box3();
    const add = (min, max) => box.union(new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)));
    const reach = collisionBounds(config);
    if (reach) add(reach.min, reach.max);
    if (config.terrace?.region) add(config.terrace.region.min, config.terrace.region.max);
    if (config.walk?.region) add(config.walk.region.min, config.walk.region.max);
    const part = new THREE.Box3(),
      size = new THREE.Vector3();
    for (const root of houseRoots()) {
      if (!root) continue;
      part.setFromObject(root);
      // A model that spans the whole coast would only widen the field over the sea.
      if (!part.isEmpty() && part.getSize(size).x < 90 && size.z < 90) box.union(part);
    }
    if (box.isEmpty()) return null;
    const centre = box.getCenter(new THREE.Vector3());
    const half = 40;
    return {
      min: [Math.max(box.min.x - 1.5, centre.x - half), box.min.y - 1, Math.max(box.min.z - 1.5, centre.z - half)],
      max: [Math.min(box.max.x + 1.5, centre.x + half), box.max.y + 2.5, Math.min(box.max.z + 1.5, centre.z + half)],
    };
  }

  // Builds the field when full screen opens, so walking is ready before it is asked for.
  const seenRoots = new WeakSet();
  function feedRoots() {
    if (!builder) return;
    const fresh = [];
    for (const root of world.children) {
      if (seenRoots.has(root) || root.name === "active-Sirui") continue;
      // A streamed room joins once its programs are ready and it is shown.
      if (root.visible === false) continue;
      seenRoots.add(root);
      fresh.push(root);
    }
    if (fresh.length) builder.addRoots(fresh, world);
  }
  function prepare() {
    const config = getConfig();
    if (builder || !config || !isReady()) return Boolean(builder);
    const bounds = fieldBounds(config);
    if (!bounds) return false;
    builder = createWalkFieldBuilder({
      bounds,
      onReady: () => {
        if (active && (!placed || provisional) && plan) place(plan);
        requestFrame();
      },
    });
    feedRoots();
    return true;
  }

  function place(next) {
    const field = builder?.ready ? builder.field : null;
    let found = null;
    if (field) {
      for (const [x, z] of next.candidates) {
        const floor = next.searchFrom !== undefined ? field.floorBelow(x, z, next.searchFrom) : next.floor;
        if (!Number.isFinite(floor)) continue;
        found = field.findStand(x, z, floor, { reach: 0.45 });
        if (found) break;
      }
      if (!found) {
        const [x, z] = next.look ? [next.look[0], next.look[2]] : next.candidates[0];
        const floor = next.searchFrom !== undefined ? field.floorBelow(x, z, next.searchFrom) : next.floor;
        if (Number.isFinite(floor)) found = field.findStand(x, z, floor, { reach: 3.5 });
      }
    }
    provisional = !found;
    found ??= { x: next.candidates[0][0], z: next.candidates[0][1], foot: next.floor ?? 0 };
    state.x = found.x;
    state.z = found.z;
    state.foot = found.foot;
    state.eye = found.foot + WALK.eyeHeight;
    state.eyeVelocity = state.vx = state.vz = 0;
    if (next.look) {
      const dx = next.look[0] - state.x,
        dz = next.look[2] - state.z;
      state.yaw = Math.atan2(dx, dz);
      state.pitch = clamp(Math.atan2(next.look[1] - state.eye, Math.hypot(dx, dz)), -0.45, 0.3);
    } else {
      state.yaw = next.yaw ?? 0;
      state.pitch = next.pitch ?? 0;
    }
    // Once the field exists the walker moves even from an imperfect start: the first step pushes the
    // capsule clear of whatever it overlaps.
    placed = Boolean(field);
    updateRoom(true);
  }

  function updateRoom(force = false) {
    const next = roomAt(getConfig(), state.x, state.z, state.foot, room);
    if (next && (next !== room || force)) {
      room = next;
      onRoom(next);
    }
  }

  function showHelp() {
    win.clearTimeout(hintTimer);
    const touch = coarse?.matches || touchSeen;
    const text = pad.connected
      ? "Left stick to walk · right stick to look · Y to orbit"
      : touch
        ? "Left thumb to walk · right thumb to look"
        : "WASD to walk · drag or click to look · Esc to leave";
    hint(text, 0);
    // Gone after the first steps, or after a while without any.
    hintTimer = win.setTimeout(() => hint(null), 12000);
  }
  function firstMove() {
    if (moved) return;
    moved = true;
    win.clearTimeout(hintTimer);
    hintTimer = win.setTimeout(() => hint(null), 1600);
  }

  function syncChrome() {
    stage.classList.toggle("is-world-walking", active);
    stage.classList.toggle("is-world-pointer-locked", active && locked);
    if (button) {
      button.setAttribute("aria-pressed", String(active));
      button.title = active ? "Back to orbiting (V)" : "Walk around (V)";
    }
    if (active && (coarse?.matches || touchSeen)) sticks.show();
    else sticks.hide();
  }

  function enter() {
    if (active || !isFullscreen() || !isReady() || !getConfig()) return false;
    prepare();
    feedRoots();
    const config = getConfig(),
      currentView = view();
    // Orbit is a temporary change of viewpoint. Re-entering Walk resumes the last safe feet/heading;
    // a room teleport or a changed manifest starts at the main entrance again.
    plan = resume?.config === config && resume.room === currentView.room ? resume.plan : spawnPlan(config, currentView);
    if (!plan) return false;
    active = true;
    keys.clear();
    pendingYaw = pendingPitch = 0;
    fov = WALK.fov;
    distance = 0;
    blockedFrames = 0;
    moved = false;
    onEnter();
    startPosition.copy(camera.position);
    startQuaternion.copy(camera.quaternion);
    transition = isReduced() ? null : { t: 0, fromFov: camera.fov };
    place(plan);
    syncChrome();
    showHelp();
    canvas.focus({ preventScroll: true });
    requestFrame();
    return true;
  }

  function exit({ restore = true } = {}) {
    if (!active) return false;
    resume =
      restore && placed && !provisional
        ? { config: getConfig(), room, plan: { candidates: [[state.x, state.z]], floor: state.foot, yaw: state.yaw, pitch: state.pitch } }
        : null;
    active = false;
    keys.clear();
    drag = pinch = null;
    touches.clear();
    transition = null;
    if (doc.pointerLockElement === canvas) doc.exitPointerLock?.();
    locked = false;
    win.clearTimeout(hintTimer);
    hint(null);
    syncChrome();
    onExit({ eye: [state.x, state.eye, state.z], yaw: state.yaw, pitch: state.pitch, room }, { restore });
    requestFrame();
    return true;
  }

  const toggle = () => (active ? exit() : enter());

  // The capsule's moving neighbours: Sirui, and a sliding door wherever its panel is (closed, it
  // fills the doorway; open, it is parked in the rock).
  const doorBox = new THREE.Box3();
  function dynamicObstacles() {
    const list = [];
    const actor = getActor();
    if (actor?.visible !== false && actor?.position && Math.abs(actor.position.y - state.foot) < 1.2)
      // Wide enough for a seated or leaning body, whose head and hands reach past the root.
      list.push({ x: actor.position.x, z: actor.position.z, radius: 0.42 });
    for (const door of doors()) {
      if (!door) continue;
      doorBox.setFromObject(door);
      if (!doorBox.isEmpty())
        list.push({ min: [doorBox.min.x, doorBox.min.z], max: [doorBox.max.x, doorBox.max.z], bottom: doorBox.min.y, top: doorBox.max.y });
    }
    return list;
  }

  function frame(dt) {
    if (!active) return;
    const reduced = isReduced();
    dt = Math.min(Math.max(dt, 0), 0.25);
    pad = gamepads.poll();
    if (pad.toggled) {
      exit();
      return;
    }
    feedRoots();
    // Looking: captured or dragged pointer motion since the last frame, turn keys and sticks.
    const keyInput = keyAxes(keys),
      look = sticks.state.look,
      lookMagnitude = Math.hypot(...look),
      padLook = pad.look,
      padMagnitude = Math.hypot(...padLook);
    const turn = keyInput.turn * WALK.turnRate - look[0] * lookMagnitude * WALK.turnRate * 1.3 - padLook[0] * padMagnitude * WALK.turnRate * 1.4;
    const tilt = keyInput.pitch * WALK.pitchRate + look[1] * lookMagnitude * WALK.pitchRate + padLook[1] * padMagnitude * WALK.pitchRate;
    state.yaw += pendingYaw + turn * dt;
    state.pitch = clamp(state.pitch + pendingPitch + tilt * dt, -WALK.pitchLimit, WALK.pitchLimit);
    pendingYaw = pendingPitch = 0;
    // Moving.
    const [strafe, forward] = unitDisc(keyInput.strafe + sticks.state.move[0] + pad.move[0], keyInput.forward + sticks.state.move[1] + pad.move[1]);
    const magnitude = Math.hypot(strafe, forward);
    // A thumb pushed to the stick's rim runs; keys need Shift and controllers their run button.
    const thumbRun = !keyInput.strafe && !keyInput.forward && Math.hypot(...sticks.state.move) >= 0.95;
    const speed = walkSpeed(magnitude, keyInput.run || pad.run || thumbRun, WALK);
    const [wx, wz] = magnitude > 0 ? walkDirection(state.yaw, strafe / magnitude, forward / magnitude) : [0, 0];
    const motionX = integrateVelocity(state.vx, wx * speed, dt, WALK.accelTau, reduced),
      motionZ = integrateVelocity(state.vz, wz * speed, dt, WALK.accelTau, reduced);
    state.vx = motionX.velocity;
    state.vz = motionZ.velocity;
    if (Math.abs(state.vx) < 1e-4 && Math.abs(state.vz) < 1e-4) state.vx = state.vz = 0;
    if (placed && builder?.ready && (state.vx || state.vz)) {
      const result = builder.field.move(state.x, state.z, state.foot, motionX.distance, motionZ.distance, BODY, dynamicObstacles());
      if (result.moved > 1e-4) firstMove();
      distance += result.moved;
      if (result.blocked) {
        blockedFrames++;
        lastBlocked = { at: [result.x, result.foot, result.z], wanted: [motionX.distance, motionZ.distance] };
        // What a wall stops does not build up: the velocity keeps only what was travelled.
        if (dt > 0) {
          state.vx = (result.x - state.x) / dt;
          state.vz = (result.z - state.z) / dt;
        }
      }
      state.x = result.x;
      state.z = result.z;
      state.foot = result.foot;
      updateRoom();
    }
    // The eyes follow the feet over steps.
    const eyeTarget = state.foot + WALK.eyeHeight;
    if (reduced || Math.abs(eyeTarget - state.eye) > 1.5) {
      state.eye = eyeTarget;
      state.eyeVelocity = 0;
    } else {
      const w = WALK.eyeFrequency,
        offset = state.eye - eyeTarget,
        c = state.eyeVelocity + w * offset,
        decay = Math.exp(-w * dt);
      state.eye = eyeTarget + (offset + c * dt) * decay;
      state.eyeVelocity = (state.eyeVelocity - w * c * dt) * decay;
    }
    // The camera, gliding in from the orbit view on arrival.
    position.set(state.x, state.eye, state.z);
    walkQuaternion(state.yaw, state.pitch, quaternion);
    const previousFov = camera.fov,
      aspect = camera.aspect || 1;
    const wantedFov = isFullscreen() ? portraitFov(fov, aspect, { max: 90 }) : fov;
    if (transition) {
      transition.t = reduced ? 1 : Math.min(1, transition.t + dt / WALK.transition);
      const k = transition.t * transition.t * (3 - 2 * transition.t);
      camera.position.lerpVectors(startPosition, position, k);
      camera.quaternion.slerpQuaternions(startQuaternion, quaternion, k);
      camera.fov = transition.fromFov + (wantedFov - transition.fromFov) * k;
      if (transition.t >= 1) transition = null;
    } else {
      camera.position.copy(position);
      camera.quaternion.copy(quaternion);
      camera.fov = wantedFov;
    }
    if (camera.fov !== previousFov) camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  // ── Input ───────────────────────────────────────────────────────────────────────────────────
  on(
    canvas,
    "keydown",
    (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const code = keyCode(event);
      if (!active) {
        if (!isFullscreen()) return;
        if (code === "KeyV") {
          event.preventDefault();
          event.stopImmediatePropagation();
          enter();
        } else if (/^Key[WAS]$/.test(code) && orbitHints < 2) {
          // A keyboard visitor reaching for WASD in the orbit view learns the switch.
          orbitHints++;
          hint("Press V to walk", 2200);
        }
        return;
      }
      if (code === "KeyV") {
        event.preventDefault();
        event.stopImmediatePropagation();
        exit();
        return;
      }
      if (MOVE_KEYS.has(code)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        keys.add(code);
        requestFrame();
        return;
      }
      if (event.key === "+" || event.key === "=" || event.key === "-") {
        fov = clamp(fov * (event.key === "-" ? 1.12 : 1 / 1.12), WALK.minFov, WALK.maxFov);
        requestFrame();
      } else if (code === "Home") {
        state.pitch = 0;
        fov = WALK.fov;
        requestFrame();
      }
      if (SWALLOWED.test(code) || event.key === "+" || event.key === "-") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
  const release = (event) => {
    const code = keyCode(event);
    // Shift can be released under either code.
    if (keys.delete(code) || (code.startsWith("Shift") && (keys.delete("ShiftLeft") || keys.delete("ShiftRight")))) requestFrame();
  };
  on(win, "keyup", release);
  // A key released while the window was not listening must not walk on by itself.
  const releaseAll = () => {
    keys.clear();
    drag = pinch = null;
    touches.clear();
    pendingYaw = pendingPitch = state.vx = state.vz = 0;
    // Mobile browsers do not always deliver pointercancel when a held thumb loses the page.
    // Reset both captured sticks as well as the keys, so returning never resumes an old walk.
    if (active) {
      sticks.hide();
      if (coarse?.matches || touchSeen) sticks.show();
    }
  };
  on(win, "blur", releaseAll);
  on(doc, "visibilitychange", releaseAll);

  on(
    canvas,
    "pointerdown",
    (event) => {
      if (!active) return;
      event.stopImmediatePropagation();
      if (event.pointerType === "touch") {
        if (!touchSeen) {
          touchSeen = true;
          syncChrome();
        }
        touches.set(event.pointerId, [event.clientX, event.clientY]);
        if (touches.size === 2) {
          const [a, b] = [...touches.values()];
          pinch = { distance: Math.hypot(a[0] - b[0], a[1] - b[1]) };
          drag = null;
          return;
        }
      }
      if (locked) return;
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        travel: 0,
        type: event.pointerType,
      };
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* A synthetic pointer cannot be captured. */
      }
    },
    true
  );
  on(
    canvas,
    "pointermove",
    (event) => {
      if (!active) return;
      event.stopImmediatePropagation();
      if (touches.has(event.pointerId)) touches.set(event.pointerId, [event.clientX, event.clientY]);
      if (locked) {
        // The first event after a capture can carry a large jump; one event never turns more than ~40°.
        const [yaw, pitch] = mouseLook(clamp(event.movementX || 0, -280, 280), clamp(event.movementY || 0, -280, 280));
        pendingYaw += yaw;
        pendingPitch += pitch;
        requestFrame();
        return;
      }
      if (pinch && touches.size === 2) {
        const [a, b] = [...touches.values()],
          spread = Math.max(15, Math.hypot(a[0] - b[0], a[1] - b[1]));
        fov = clamp(fov * (pinch.distance / spread), WALK.minFov, WALK.maxFov);
        pinch.distance = spread;
        requestFrame();
        return;
      }
      if (!drag || drag.id !== event.pointerId) return;
      const rect = canvas.getBoundingClientRect();
      const [yaw, pitch] = dragLook(event.clientX - drag.lastX, event.clientY - drag.lastY, camera.fov, camera.aspect || 1, rect.height || 1);
      pendingYaw += yaw;
      pendingPitch += pitch;
      drag.travel += Math.hypot(event.clientX - drag.lastX, event.clientY - drag.lastY);
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      if (drag.travel > 4) firstMove();
      requestFrame();
    },
    true
  );
  const endPointer = (event) => {
    if (!active) return;
    event.stopImmediatePropagation();
    touches.delete(event.pointerId);
    if (pinch && touches.size < 2) pinch = null;
    if (drag?.id === event.pointerId) {
      // A click (not a drag) with a mouse captures the pointer for mouse look.
      if (event.type === "pointerup" && drag.type === "mouse" && drag.travel < 6) requestLock();
      drag = null;
    }
  };
  on(canvas, "pointerup", endPointer, true);
  on(canvas, "pointercancel", endPointer, true);
  on(
    canvas,
    "wheel",
    (event) => {
      if (!active) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const lines = event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? 320 : 1;
      fov = clamp(fov * Math.exp(event.deltaY * lines * 0.0012), WALK.minFov, WALK.maxFov);
      requestFrame();
    },
    { capture: true, passive: false }
  );

  function requestLock() {
    if (!canvas.requestPointerLock || doc.pointerLockElement === canvas) return;
    const plain = () => {
      try {
        return Promise.resolve(canvas.requestPointerLock()).catch(() => {});
      } catch {
        return null;
      }
    };
    try {
      // Raw mouse motion where the platform offers it; otherwise the ordinary capture.
      Promise.resolve(canvas.requestPointerLock({ unadjustedMovement: true })).catch(plain);
    } catch {
      plain();
    }
  }
  on(doc, "pointerlockchange", () => {
    const now = doc.pointerLockElement === canvas;
    if (now === locked) return;
    locked = now;
    syncChrome();
    if (!active) return;
    if (locked) {
      drag = null;
      hint("The mouse looks around · Esc frees it", 2400);
    } else hint("Click to look with the mouse", 2000);
  });

  if (button)
    on(button, "click", () => {
      toggle();
      // Keys go to the scene, not the switch.
      canvas.focus({ preventScroll: true });
    });

  // A controller's Y switches to walking even while the orbit view is idle and draws no frames.
  function pollToggle() {
    // While walking, the frame loop reads the controller (and its Y) itself.
    if (!isFullscreen() || active) return;
    const read = gamepads.poll();
    if (read.toggled) enter();
    else if (read.active) requestFrame();
  }
  on(win, "gamepadconnected", () => {
    if (!gamepadPoller) gamepadPoller = win.setInterval(pollToggle, 150);
    if (isFullscreen()) hint(active ? "Left stick to walk · right stick to look · Y to orbit" : "Controller ready · Y to walk", 2600);
  });
  on(win, "gamepaddisconnected", () => {
    if (gamepads.poll().connected) return;
    win.clearInterval(gamepadPoller);
    gamepadPoller = 0;
  });

  return {
    prepare,
    enter,
    exit,
    toggle,
    frame,
    get active() {
      return active;
    },
    // Whether the render loop must keep drawing for walking.
    get busy() {
      if (!active) return false;
      const eyeTarget = state.foot + WALK.eyeHeight;
      return Boolean(
        keys.size ||
        sticks.active ||
        pad.active ||
        pad.connected ||
        transition ||
        state.vx ||
        state.vz ||
        Math.abs(state.eye - eyeTarget) > 0.001 ||
        (!placed && builder)
      );
    },
    // Lab and tests (scene-lab=1): stand somewhere and face a way.
    labPlace({ position: at, yaw = state.yaw, pitch = 0 }) {
      if (!active) return false;
      const field = builder?.ready ? builder.field : null;
      const found = field?.findStand(at[0], at[2], at[1], { reach: 0.6 }) ?? null;
      if (!found) return false;
      Object.assign(state, { x: found.x, z: found.z, foot: found.foot, eye: found.foot + WALK.eyeHeight, eyeVelocity: 0, vx: 0, vz: 0, yaw, pitch });
      placed = true;
      transition = null;
      updateRoom(true);
      requestFrame();
      return true;
    },
    // Per-frame consumers need only the live capsule, not a scan of every collision column.
    pose: () => ({ active, position: [state.x, state.foot, state.z], yaw: state.yaw, velocity: [state.vx, state.vz] }),
    evidence() {
      return {
        active,
        ready: Boolean(builder?.ready),
        placed,
        provisional,
        position: [state.x, state.foot, state.z],
        eye: state.eye,
        yaw: state.yaw,
        pitch: state.pitch,
        fov,
        velocity: [state.vx, state.vz],
        room,
        locked,
        keys: [...keys],
        joysticks: sticks.visible,
        gamepads: pad.connected,
        transition: Boolean(transition),
        distance,
        blockedFrames,
        lastBlocked,
        body: { ...BODY, eyeHeight: WALK.eyeHeight },
        field: builder?.evidence() ?? null,
      };
    },
    dispose() {
      exit({ restore: false });
      listeners.splice(0).forEach((off) => off());
      win.clearInterval(gamepadPoller);
      win.clearTimeout(hintTimer);
      sticks.dispose();
      crosshair.remove();
      builder?.dispose();
    },
  };
}
