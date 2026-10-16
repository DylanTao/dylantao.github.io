import * as THREE from "../three.module.min.js";

// Strength movements posed procedurally on each avatar's own skeleton (Sirui, 2026-10-15). The
// clips authored in Blender cover sitting, walking and the house's other activities; the gym's
// lifts are solved here every frame instead, so the hands meet the real bar, handles and
// dumbbells whatever the avatar's proportions, and the loads and rep counts come from Sirui's
// program (training.mjs, choreographed by gym-session.mjs).
//
// A pose is a body state in the actor's frame (+Z forward, +Y up; the skeleton's ".L" side, the
// anatomical right, at -X): where the hip joint is, how the pelvis is pitched (lying on the bench
// is a quarter turn), the torso's lean and the head's tilt, then foot and hand targets reached by
// two-bone IK, each joint bending toward a hint that suits the movement: knees out over the toes,
// elbows back on dips and curls, out and under the bar on the bench and presses, forward in the
// front rack. Feet are set flat and turned out after the leg solve, so they never roll on their
// edges. Points from the room (bars, handles, dumbbells) arrive in the manifest's frame and are
// read into the actor's frame each frame, so they stay exact while the body turns.
//
// Timing follows how lifts are performed: a controlled lowering, a short pause, a faster drive and
// a moment at lockout. Every phase eases in and out (slow-in and slow-out, Thomas & Johnston,
// The Illusion of Life), and the head counters the torso so the gaze stays level.

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
const segment = (u, a, b) => smooth((u - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;

// One repetition's depth (0 at the start, 1 at the turn) for a lift whose start is the top
// (squat, bench, dip): lower, pause, drive, settle.
export function lowerThenDrive(u, lower = 0.46, pause = 0.08) {
  if (u < lower) return segment(u, 0, lower);
  if (u < lower + pause) return 1;
  return 1 - segment(u, lower + pause, 0.94);
}

// One repetition for a lift that starts at the bottom (deadlift, press, pull-up, curl): drive,
// hold, lower, reset.
export function driveThenLower(u, drive = 0.36, hold = 0.12) {
  if (u < drive) return segment(u, 0, drive);
  if (u < drive + hold) return 1;
  return 1 - segment(u, drive + hold, 0.9);
}

export const LIFTS = [
  "squat",
  "front-squat",
  "ohp",
  "deadlift",
  "sumo-deadlift",
  "bench",
  "incline-bench",
  "close-grip-bench",
  "pullup",
  "dip",
  "curl",
  "load",
  "board",
  "duck",
];

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function measureHead(actor, bones) {
  const head = new Set();
  bones.Head.traverse((b) => b.isBone && head.add(b));
  const joint = V(0, bones.Hips.position.y + bones.Spine.position.y + bones.Head.position.y, 0);
  const box = new THREE.Box3(),
    v = V(),
    toActor = new THREE.Matrix4();
  actor.updateMatrixWorld(true);
  actor.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const indices = o.skeleton.bones.map((b, i) => (head.has(b) ? i : -1)).filter((i) => i >= 0);
    const { position, skinIndex, skinWeight } = o.geometry.attributes;
    if (!indices.length || !position || !skinIndex || !skinWeight) return;
    toActor.copy(actor.matrixWorld).invert().multiply(o.matrixWorld);
    for (let i = 0; i < position.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (indices.includes(skinIndex.getComponent(i, k))) w += skinWeight.getComponent(i, k);
      if (w < 0.6) continue;
      box.expandByPoint(v.fromBufferAttribute(position, i).applyMatrix4(toActor).sub(joint));
    }
  });
  return box.isEmpty() ? null : { min: box.min.clone(), max: box.max.clone() };
}
const SIDES = [
  ["L", -1],
  ["R", 1],
];

export function createLiftRig(actor) {
  const bones = {};
  actor.traverse((o) => {
    if (o.isBone) bones[o.name.replaceAll(".", "")] = o;
  });
  const names = [
    "Root",
    "Hips",
    "Spine",
    "Head",
    "ArmL",
    "ForearmL",
    "HandL",
    "ArmR",
    "ForearmR",
    "HandR",
    "ThighL",
    "ShinL",
    "FootL",
    "ThighR",
    "ShinR",
    "FootR",
  ];
  if (!names.every((n) => bones[n])) return null;
  const order = names.map((n) => bones[n]);
  // The bind pose, read before any clip plays: what release() returns to, and the feet's resting
  // orientation in the actor's frame (the chain's product; the armature node is the identity).
  const bind = order.map((b) => ({ q: b.quaternion.clone(), p: b.position.clone() }));
  const bindOf = (bone) => bind[order.indexOf(bone)].q;
  const footRest = {};
  for (const [side] of SIDES) {
    footRest[side] = new THREE.Quaternion()
      .multiply(bindOf(bones.Root))
      .multiply(bindOf(bones.Hips))
      .multiply(bindOf(bones["Thigh" + side]))
      .multiply(bindOf(bones["Shin" + side]))
      .multiply(bindOf(bones["Foot" + side]));
  }
  const dims = {
    hip: bones.Hips.position.y,
    torso: bones.Spine.position.length() + bones.ArmL.position.y,
    shoulderHalf: Math.abs(bones.ArmL.position.x),
    hipHalf: Math.abs(bones.ThighL.position.x),
    thigh: bones.ShinL.position.length(),
    shin: bones.FootL.position.length(),
    upper: bones.ForearmL.position.length(),
    fore: bones.HandL.position.length(),
    palm: 0.065,
    ankle: 0.075,
  };
  dims.reach = dims.upper + dims.fore + dims.palm;
  // The spine bends at its own joint above the hips, so the shoulder line sits at
  // hips + spine + R(lean) * arm, not on a straight line from the hip joint.
  dims.spine = bones.Spine.position.y;
  dims.arm = bones.ArmL.position.y;
  // The head's extent around the head joint, from the bind-pose vertices bound to the head and the
  // eyes. The figures range from a portrait's proportions to a cartoon's oversized head, and a bar
  // has to pass clear of whichever it is: under or behind it on the back, around the face on a
  // press, in front of it on a pull-up.
  dims.head = measureHead(actor, bones) || { min: V(-0.11, -0.12, -0.12), max: V(0.11, 0.24, 0.12) };
  // Height of the head joint above the shoulder line along the torso.
  dims.neck = bones.Head.position.y - bones.ArmL.position.y;

  const q1 = new THREE.Quaternion(),
    q2 = new THREE.Quaternion(),
    euler = new THREE.Euler();
  const actorQuaternion = () => actor.getWorldQuaternion(q2);
  const toWorld = (local) => actor.localToWorld(local.clone());
  const toLocal = (world) => actor.worldToLocal(world.clone());
  // Room points (the manifest's frame is the actor's parent's frame) to the actor's frame and back.
  const fromRoom = (p) => toLocal(actor.parent.localToWorld(V(p[0], p[1], p[2])));
  const toRoom = (local) => actor.parent.worldToLocal(toWorld(local));
  const directionToRoom = (local) =>
    local.clone().applyQuaternion(actorQuaternion()).applyQuaternion(actor.parent.getWorldQuaternion(new THREE.Quaternion()).invert());

  function aim(bone, childWorld, targetWorld) {
    const origin = bone.getWorldPosition(V());
    const from = childWorld.clone().sub(origin),
      to = targetWorld.clone().sub(origin);
    if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
    q1.setFromUnitVectors(from.normalize(), to.normalize());
    const world = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(q1);
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    bone.updateMatrixWorld(true);
  }

  // Two-bone IK toward a target and a pole hint, both in the actor's frame.
  function solveLimb(upper, lower, end, targetLocal, hintLocal) {
    const a = upper.getWorldPosition(V()),
      b = lower.getWorldPosition(V());
    const l1 = a.distanceTo(b),
      l2 = end.getWorldPosition(V()).distanceTo(b);
    const goal = toWorld(targetLocal);
    const direction = goal.clone().sub(a);
    const distance = clamp(direction.length(), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
    direction.normalize();
    goal.copy(a).addScaledVector(direction, distance);
    const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
    const hint = hintLocal.clone().applyQuaternion(actorQuaternion());
    hint.addScaledVector(direction, -hint.dot(direction));
    if (hint.lengthSq() < 1e-8) hint.set(0, 0, 1).applyQuaternion(actorQuaternion()).addScaledVector(direction, -direction.z);
    hint.normalize();
    const elbow = a
      .clone()
      .addScaledVector(direction, along)
      .addScaledVector(hint, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
    aim(upper, b, elbow);
    aim(lower, end.getWorldPosition(V()), goal);
  }

  // A bone's orientation given in the actor's frame.
  function orient(bone, quaternionInActor) {
    const world = actorQuaternion().clone().multiply(quaternionInActor);
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    bone.updateMatrixWorld(true);
  }

  // The torso: hip joint centre, pelvis pitch (and roll, twist), spine lean, head tilt and turn.
  function body({ hips, pitch = 0, roll = 0, twist = 0, lean = 0, side = 0, head = 0, turn = 0 }) {
    const root = bones.Root;
    const world = new THREE.Quaternion().setFromEuler(euler.set(pitch, twist, roll, "YXZ")).premultiply(actorQuaternion());
    root.quaternion.copy(root.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    bones.Hips.quaternion.copy(bindOf(bones.Hips));
    bones.Spine.quaternion.setFromEuler(euler.set(lean, 0, side, "XYZ"));
    bones.Head.quaternion.setFromEuler(euler.set(head, turn, 0, "XYZ"));
    root.updateMatrixWorld(true);
    const delta = toWorld(hips).sub(bones.Hips.getWorldPosition(V()));
    root.position.copy(root.parent.worldToLocal(root.getWorldPosition(V()).add(delta)));
    actor.updateMatrixWorld(true);
  }

  const shoulder = (side) => toLocal(bones["Arm" + side].getWorldPosition(V()));
  const shoulders = () => shoulder("L").add(shoulder("R")).multiplyScalar(0.5);
  const hipsAt = () => toLocal(bones.Hips.getWorldPosition(V()));
  // The torso's up (hips to shoulders), lateral (toward +X) and forward (chest) directions.
  function torsoAxes() {
    const s = shoulders(),
      h = hipsAt();
    const up = s.clone().sub(h).normalize();
    const lateral = shoulder("R").sub(shoulder("L")).normalize();
    const forward = new THREE.Vector3().crossVectors(lateral, up).normalize();
    return { up, forward, lateral, shoulders: s };
  }

  // Feet: targets for the ankles, knees toward the hints, soles flat and turned out by `yaw`.
  function legs(feet, hints, yaw = [0, 0], lift = [0, 0]) {
    SIDES.forEach(([side], i) => {
      const target = feet[i].clone();
      target.y += lift[i];
      solveLimb(bones["Thigh" + side], bones["Shin" + side], bones["Foot" + side], target, hints[i]);
      orient(bones["Foot" + side], new THREE.Quaternion().setFromEuler(euler.set(-lift[i] * 3, yaw[i], 0, "YXZ")).multiply(footRest[side]));
    });
  }
  // A wrist target that puts the palm on a grip point, the hand continuing the forearm.
  function wristFor(side, grip) {
    const toward = shoulder(side).sub(grip);
    if (toward.lengthSq() < 1e-8) return grip.clone();
    return grip.clone().addScaledVector(toward.normalize(), dims.palm);
  }
  function arms(grips, hints) {
    SIDES.forEach(([side], i) => {
      if (grips[i]) solveLimb(bones["Arm" + side], bones["Forearm" + side], bones["Hand" + side], wristFor(side, grips[i]), hints[i]);
    });
  }
  // Alternate feet lifting a few centimetres while the body moves a step.
  const stepLift = (step) =>
    step == null ? [0, 0] : [0.045 * Math.sin(Math.PI * clamp(step / 0.5)), 0.045 * Math.sin(Math.PI * clamp((step - 0.5) / 0.5))];
  const stance = (half, z = 0.02) => [V(-half, dims.ankle, z), V(half, dims.ankle, z)];
  const hintsOut = (out, up, forward) => [V(-out, up, forward), V(out, up, forward)];
  const sideways = (half, at) => [at.clone().add(V(-half, 0, 0)), at.clone().add(V(half, 0, 0))];
  const atSides = () => sideways(0.21, V(0, dims.hip - 0.1, 0.06));
  // The hip joint that puts the shoulder line at (y, z) for a spine lean.
  const hipsUnder = (y, z, lean) => V(0, y - dims.spine - dims.arm * Math.cos(lean), z - dims.arm * Math.sin(lean));
  // Where a back-squat bar sits in the torso's frame (up from and forward of the shoulder line),
  // and the grip: the high-bar spot unless the head reaches it; then under the head if that keeps
  // the bar on the back, otherwise behind the head. The hands stay outside the head's width.
  function backBarPlace() {
    const h = dims.head,
      bottom = dims.neck + h.min.y,
      back = h.min.z;
    let place = { up: 0.06, forward: -0.075 };
    if (bottom < place.up + 0.035 && back < place.forward + 0.03) {
      const under = bottom - 0.035;
      place = under > -0.11 ? { up: under, forward: -0.085 } : { up: 0.02, forward: back - 0.035 };
    }
    // Hands outside the head only where the bar runs past it, and inside the rack's cups either way.
    const besideHead = place.up + 0.02 > bottom;
    return { ...place, grip: besideHead ? Math.min(0.5, Math.max(0.43, Math.max(-h.min.x, h.max.x) + 0.09)) : 0.43 };
  }
  // The front rack: on the front of the shoulders, below the chin or in front of it.
  function frontRackPlace() {
    const h = dims.head,
      bottom = dims.neck + h.min.y,
      chin = h.max.z;
    let place = { up: 0.045, forward: 0.13 };
    if (bottom < place.up + 0.035 && chin > place.forward - 0.03)
      place = bottom - 0.035 > -0.08 ? { up: bottom - 0.035, forward: 0.13 } : { up: 0.0, forward: chin + 0.035 };
    return place;
  }

  const poses = {
    squat(u, ctx) {
      const e = lowerThenDrive(u, 0.46, 0.06);
      const d = ctx.dip ?? 0;
      const lean = 0.12 + 0.46 * e + 0.08 * d;
      body({ hips: V(0, dims.hip - 0.43 * e - 0.08 * d, -0.2 * e - 0.03 * d), lean, head: -lean * 0.7 });
      legs(stance(0.19, 0), hintsOut(0.45, 0.1, 1), [-0.28, 0.28], stepLift(ctx.step));
      // High-bar, across the upper back just above the shoulder blades; under the head, or behind it
      // when the head comes down to the shoulders.
      const { up, forward, shoulders: s } = torsoAxes();
      const place = backBarPlace();
      const onBack = s.addScaledVector(up, place.up).addScaledVector(forward, place.forward);
      const carry = ctx.carry ?? 1;
      const bar = ctx.hooks && carry < 1 ? fromRoom(ctx.hooks).lerp(onBack, smooth(carry)) : onBack;
      arms(sideways(place.grip, bar), hintsOut(0.3, -1, -0.6));
      return { bar, axis: V(1, 0, 0) };
    },
    "front-squat"(u, ctx) {
      const take = ctx.take ?? 1;
      const e = take < 1 ? 0 : lowerThenDrive(u, 0.46, 0.06);
      const lean = 0.06 + 0.22 * e;
      body({ hips: V(0, dims.hip - 0.45 * e - 0.04 * Math.sin(Math.PI * take), -0.11 * e), lean, head: -lean * 0.6 });
      legs(stance(0.17, 0), hintsOut(0.4, 0.1, 1), [-0.3, 0.3], stepLift(ctx.step));
      // The bar on the front of the shoulders, elbows high, clear of the chin.
      const { up, forward, shoulders: s } = torsoAxes();
      const front = frontRackPlace();
      const rack = s.addScaledVector(up, front.up).addScaledVector(forward, front.forward);
      const bar = ctx.hooks && take < 1 ? fromRoom(ctx.hooks).lerp(rack, smooth(take)) : rack;
      arms(sideways(0.21, bar), hintsOut(0.25, 0.25, 1));
      return { bar, axis: V(1, 0, 0) };
    },
    ohp(u, ctx) {
      const take = ctx.take ?? 1;
      const e = take < 1 ? 0 : driveThenLower(u, 0.34, 0.12);
      // The head draws back as the bar passes the face, then pushes through under it.
      const pass = Math.sin(Math.PI * clamp(e * 1.6));
      body({
        hips: V(0, dims.hip - 0.012 - (take < 1 ? 0.04 * Math.sin(Math.PI * take) : 0), 0.01 * pass),
        lean: -0.04 - 0.05 * pass + 0.03 * e,
        head: -0.24 * pass + 0.06 * e,
      });
      legs(stance(0.15, 0), hintsOut(0.2, 0, 1), [-0.18, 0.18], stepLift(ctx.step));
      const { up, forward, shoulders: s } = torsoAxes();
      const front = frontRackPlace();
      const rack = s.clone().addScaledVector(up, front.up).addScaledVector(forward, front.forward);
      const lock = s
        .clone()
        .addScaledVector(up, dims.reach - 0.02)
        .addScaledVector(forward, -0.02);
      let bar = rack
        .clone()
        .lerp(lock, e)
        .addScaledVector(forward, 0.07 * pass);
      // Past the face the bar keeps in front of it, then comes back over the crown at lockout.
      const height = bar.clone().sub(s).dot(up);
      if (height < dims.neck + dims.head.max.y + 0.03)
        bar.addScaledVector(forward, Math.max(0, dims.head.max.z + 0.035 - bar.clone().sub(s).dot(forward)));
      if (ctx.hooks && take < 1) bar = fromRoom(ctx.hooks).lerp(rack, smooth(take));
      arms(sideways(0.25, bar), hintsOut(0.4 + 0.6 * e, -0.4 + 0.4 * e, 1 - e));
      return { bar, axis: V(1, 0, 0) };
    },
    deadlift(u, ctx, sumo = false) {
      const approach = ctx.approach ?? 1;
      const e = approach < 1 ? 0 : driveThenLower(u, 0.38, 0.12);
      const rest = ctx.bar ? fromRoom(ctx.bar) : V(0, 0.225, 0.07);
      const half = sumo ? 0.38 : 0.15,
        grip = sumo ? 0.18 : 0.26;
      const startHip = sumo ? 0.6 : 0.66;
      const lockout = dims.hip + dims.torso - dims.reach + 0.03;
      const shoulderAt = (hy, hz, l) => [hy + dims.spine + dims.arm * Math.cos(l), hz + dims.arm * Math.sin(l)];
      const barY = rest.y + e * (lockout - rest.y);
      const hipY = startHip + e * (dims.hip - startHip),
        hipZ = (1 - e) * (sumo ? -0.13 : -0.22);
      // The lean that lets straight arms hang from the shoulders to the grip; the bar travels
      // straight up over mid-foot.
      const reach = Math.sqrt(Math.max(0.01, dims.reach * dims.reach - (grip - dims.shoulderHalf) ** 2));
      let lean = 0;
      for (let k = 0, lo = -0.05, hi = 1.45; k < 26; k++) {
        lean = (lo + hi) / 2;
        const [sy, sz] = shoulderAt(hipY, hipZ, lean);
        if (Math.hypot(sy - barY, sz - rest.z) > reach) lo = lean;
        else hi = lean;
      }
      // Walking up to the bar and standing away from it: from a tall stance into the start.
      const a = smooth(approach);
      body({ hips: V(0, lerp(dims.hip - 0.005, hipY, a), lerp(0, hipZ, a)), lean: lerp(0.03, lean, a), head: -lerp(0.03, lean, a) * 0.55 });
      legs(stance(lerp(0.13, half, a), -0.02), hintsOut(sumo ? 1 : 0.25, 0.1, 1), sumo ? [-0.6, 0.6] : [-0.15, 0.15]);
      const bar = V(rest.x, barY, rest.z);
      const grips = sideways(grip, bar.clone().add(V(0, 0.03, 0)));
      const sides = atSides();
      arms(
        grips.map((g, i) => sides[i].clone().lerp(g, smooth((a - 0.25) / 0.75))),
        hintsOut(1, 0, -0.2)
      );
      return a > 0.95 ? { bar, axis: V(1, 0, 0) } : null;
    },
    "sumo-deadlift"(u, ctx) {
      return poses.deadlift(u, ctx, true);
    },
    bench(u, ctx, variant = "flat") {
      // From standing at the bench end: sit astride it, lie back, take the bar off the hooks.
      const mount = ctx.mount ?? 1;
      const incline = variant === "incline" ? ((ctx.inclineDegrees ?? 32) * Math.PI) / 180 : 0;
      const lie = ctx.lie ? fromRoom(ctx.lie) : V(0, 0, -0.76);
      const hinge = ctx.hinge ? fromRoom(ctx.hinge) : V(0, 0.4, -0.62);
      const hooks = ctx.hooks ? fromRoom(ctx.hooks) : V(0, 1.06, -1.18);
      const sit = smooth(mount / 0.45),
        back = smooth((mount - 0.45) / 0.4),
        grab = smooth((mount - 0.8) / 0.12);
      // Lying hips: on the pad short of its middle; on the incline just ahead of the hinge.
      const lying = incline ? V(0, 0.56, hinge.z + 0.1) : V(0, 0.55, lie.z + 0.16);
      const seated = V(0, 0.56, lie.z + 0.5);
      const standing = V(0, dims.hip - 0.005, 0);
      const hips = standing.clone().lerp(seated, sit).lerp(lying, back);
      body({ hips, pitch: lerp(0, -Math.PI / 2 + incline, back), lean: lerp(0.12 * sit, -0.05, back), head: lerp(0, 0.05, back) });
      // Feet: together standing, astride the bench seated, planted wide while lying.
      const feetStand = stance(0.13, 0.02),
        feetSeat = stance(0.3, lie.z + 0.7),
        feetLie = stance(0.33, lie.z + 0.56);
      legs(
        feetStand.map((f, i) => f.clone().lerp(feetSeat[i], sit).lerp(feetLie[i], back)),
        hintsOut(0.35, sit, lerp(1, 0.25, sit)),
        [-0.25, 0.25]
      );
      const { forward, up, shoulders: s } = torsoAxes();
      const e = mount < 1 ? 0 : lowerThenDrive(u, 0.44, 0.06);
      const gripHalf = variant === "close" ? 0.24 : 0.4;
      // Locked out over the shoulders; touching the lower chest at the bottom (a slight J path).
      const top = s.clone().add(V(0, dims.reach - 0.02, 0));
      const chest = s
        .clone()
        .addScaledVector(forward, 0.17)
        .addScaledVector(up, Math.min(incline ? -0.06 : -0.12, dims.neck + dims.head.min.y - 0.05));
      let bar = top.clone().lerp(chest, e);
      if (mount < 1) bar = hooks.clone().lerp(top, smooth((mount - 0.92) / 0.08));
      const thighs = sideways(0.17, V(0, hips.y + 0.08, hips.z + 0.24));
      arms(
        sideways(gripHalf, bar).map((g, i) => thighs[i].clone().lerp(g, grab)),
        variant === "close" ? hintsOut(0.35, -1, 0.3) : hintsOut(1, -0.8, 0.2)
      );
      return grab > 0.98 ? { bar, axis: V(1, 0, 0) } : null;
    },
    "incline-bench"(u, ctx) {
      return poses.bench(u, ctx, "incline");
    },
    "close-grip-bench"(u, ctx) {
      return poses.bench(u, ctx, "close");
    },
    pullup(u, ctx) {
      const mount = ctx.mount ?? 1;
      const bar = ctx.bar ? fromRoom(ctx.bar) : V(0, 2.15, 0.2);
      const grip = ctx.grip ?? 0.3;
      const e = mount < 1 ? 0 : driveThenLower(u, 0.4, 0.1);
      // Hanging: the shoulders just behind the bar, rising with the chest toward it while the
      // face stays behind it, tilting back as the chin comes level.
      const behind = Math.max(0.11 + 0.07 * e, dims.head.max.z + 0.035 + 0.04 * e);
      // At the top the shoulders come just under the bar: the chin clears it on a portrait's head.
      const shoulderY = bar.y - dims.reach + 0.04 + e * (dims.reach - 0.06);
      const lean = 0.02 - 0.3 * e;
      const hang = {
        hips: hipsUnder(shoulderY, bar.z - behind, lean),
        lean,
        head: -0.1 - 0.32 * e,
      };
      const grips = sideways(grip, V(0, bar.y + 0.015, bar.z));
      const hangFeet = () => {
        const h = hipsAt();
        return [V(-0.03, h.y - 0.6, h.z - 0.28), V(0.03, h.y - 0.62, h.z - 0.24)];
      };
      if (mount >= 1) {
        body(hang);
        legs(hangFeet(), [V(0, 0, 1), V(0, 0, 1)]);
        arms(grips, hintsOut(1, -0.6, 0.45));
        return null;
      }
      // The jump: a crouch with the arms swinging back, the rise, the catch.
      const crouch = mount < 0.5 ? Math.sin(Math.PI * (mount / 0.5)) : 0;
      const rise = smooth((mount - 0.35) / 0.45);
      const standHips = V(0, dims.hip - 0.005 - 0.17 * crouch, 0.05 - 0.04 * crouch);
      body({ hips: standHips.clone().lerp(hang.hips, rise), lean: lerp(0.25 * crouch, hang.lean, rise), head: lerp(-0.25, hang.head, rise) });
      const air = smooth((mount - 0.4) / 0.4);
      const ground = stance(0.13, 0.05);
      const hung = hangFeet();
      legs(
        ground.map((f, i) => f.clone().lerp(hung[i], air)),
        [V(-0.3, 0.1, 1), V(0.3, 0.1, 1)],
        [-0.15 * (1 - air), 0.15 * (1 - air)]
      );
      const swing = sideways(0.24, V(0, dims.hip - 0.08 - 0.1 * crouch, -0.22 * crouch));
      arms(
        grips.map((g, i) => swing[i].clone().lerp(g, smooth((mount - 0.3) / 0.5))),
        hintsOut(1, -0.6, 0.3)
      );
      return null;
    },
    dip(u, ctx) {
      const mount = ctx.mount ?? 1;
      const handY = ctx.handY ?? 1.24,
        half = ctx.handHalf ?? 0.36;
      const e = mount < 1 ? 0 : lowerThenDrive(u, 0.45, 0.06);
      // Supported on straight arms at the top; at the bottom the upper arms reach level with
      // the bars, the torso leaning forward and the elbows tracking straight back.
      const top = handY + 0.03 + Math.sqrt(Math.max(0.01, dims.reach * dims.reach - (half - dims.shoulderHalf) ** 2)) - 0.02;
      const shoulderY = top - e * (dims.reach - 0.28);
      const lean = 0.06 + 0.26 * e;
      const shoulderZ = 0.02 + 0.07 * e;
      const support = { hips: hipsUnder(shoulderY, shoulderZ, lean), lean, head: -lean * 0.5 };
      const a = smooth(mount);
      const standingHips = V(0, dims.hip - 0.005 - 0.08 * Math.sin(Math.PI * clamp(mount * 1.6)), 0);
      body({ hips: standingHips.lerp(support.hips, a), lean: lerp(0.05, support.lean, a), head: lerp(0, support.head, a) });
      const h = hipsAt();
      const hung = [V(-0.05, h.y - 0.58, h.z - 0.3), V(0.04, h.y - 0.6, h.z - 0.25)];
      legs(
        stance(0.13, 0.02).map((f, i) => f.clone().lerp(hung[i], a)),
        [V(-0.2, 0, 1), V(0.2, 0, 1)],
        [-0.12 * (1 - a), 0.12 * (1 - a)],
        mount < 1 ? stepLift(ctx.step) : [0, 0]
      );
      const onBars = sideways(half, V(0, handY + 0.03, 0));
      const sides = atSides();
      const reachBars = smooth((mount - 0.1) / 0.3);
      arms(
        onBars.map((g, i) => sides[i].clone().lerp(g, reachBars)),
        hintsOut(0.15, 0, -1)
      );
      return null;
    },
    curl(u, ctx) {
      // Alternating curls, a dumbbell in each hand: one arm on the first half, the other on the second.
      const pick = ctx.pick ?? 0;
      body({ hips: V(0, dims.hip - 0.005 - 0.09 * pick, -0.05 * pick), lean: 0.03 + 0.68 * pick, head: -0.02 - 0.3 * pick });
      legs(stance(0.14, 0.02), hintsOut(0.2, 0, 1), [-0.15, 0.15]);
      const hands = {};
      if (pick > 0.001 && ctx.dumbbells) {
        // Reaching to the rack's handles, each hand to the one on its side.
        const bells = ctx.dumbbells.map((p) => fromRoom(p)).sort((a, b) => a.x - b.x);
        const sides = atSides();
        const grips = bells.map((b, i) => sides[i].clone().lerp(b, pick));
        arms(grips, hintsOut(0.3, -0.6, -0.5));
        return { hands: { L: grips[0], R: grips[1] } };
      }
      SIDES.forEach(([side, sign], i) => {
        const local = (u - i * 0.5 + 1) % 1;
        const e = local < 0.5 ? driveThenLower(local / 0.5, 0.42, 0.14) : 0;
        // The elbow stays pinned at the side; only the forearm swings.
        const elbowAt = shoulder(side).add(V(sign * 0.02, -dims.upper, -0.03 + 0.025 * e));
        const angle = 0.14 + e * 2.3;
        const grip = elbowAt.add(V(sign * 0.012, -Math.cos(angle) * (dims.fore + dims.palm), Math.sin(angle) * (dims.fore + dims.palm)));
        solveLimb(bones["Arm" + side], bones["Forearm" + side], bones["Hand" + side], wristFor(side, grip), V(sign * 0.1, -0.25, -1));
        hands[side] = grip;
      });
      return { hands };
    },
    load(u, ctx) {
      // One plate: crouch for it, lift it to the chest, push it onto the sleeve, step off.
      // Stripping runs the same path backward.
      const p = ctx.strip ? 1 - u : u;
      const barY = clamp(ctx.barHeight ?? 1, 0.2, 1.6);
      const radius = ctx.plateRadius ?? 0.2;
      const floorPlate = V(0.24, radius, 0.14),
        chest = V(0, 1.02, 0.24),
        sleeve = V(0, barY, 0.4);
      const plate =
        p < 0.3
          ? floorPlate
          : p < 0.6
            ? floorPlate.clone().lerp(chest, smooth((p - 0.3) / 0.3))
            : chest.clone().lerp(sleeve, smooth((p - 0.6) / 0.25));
      const crouch = Math.max(clamp((0.95 - plate.y) / 0.7), p < 0.3 ? smooth(p / 0.2) * 0.85 : 0);
      body({ hips: V(0, dims.hip - 0.4 * crouch, -0.12 * crouch), lean: 0.08 + 0.55 * crouch, head: -0.3 * crouch });
      legs(stance(0.19, 0.02), hintsOut(0.45, 0.1, 1), [-0.25, 0.25]);
      const reachIn = p < 0.3 ? smooth(p / 0.2) : p > 0.9 ? 1 - smooth((p - 0.9) / 0.1) : 1;
      const hold = sideways(0.1, plate.clone().add(V(0, radius * 0.78, 0)));
      const sides = atSides();
      arms(
        hold.map((g, i) => sides[i].clone().lerp(g, reachIn)),
        hintsOut(1, -0.4, -0.2)
      );
      return reachIn > 0.5 && p > 0.12 && p < 0.88 ? { plate, axis: V(0, 0, 1) } : null;
    },
    board(u, ctx) {
      // Writing with the anatomical right hand (the skeleton's .L): strokes along four lines, a
      // pause to read each back; the other hand at the side.
      body({ hips: V(0, dims.hip - 0.008, 0), lean: 0.03, head: 0.06, turn: -0.08 });
      legs(stance(0.14, 0.02), hintsOut(0.2, 0, 1), [-0.15, 0.15]);
      const line = Math.floor(u * 4),
        within = (u * 4) % 1;
      const distance = ctx.boardDistance ?? 0.5;
      const writing = within < 0.8;
      const x = 0.28 - (writing ? within / 0.8 : 1) * 0.42,
        y = 1.72 - line * 0.11 + (writing ? 0.012 * Math.sin(within * 52) : 0);
      const tip = V(x, y, distance - (writing ? 0.1 : 0.16));
      solveLimb(bones.ArmL, bones.ForearmL, bones.HandL, wristFor("L", tip), V(-0.7, -0.6, -0.2));
      arms([null, V(0.21, dims.hip - 0.1, 0.06)], [null, V(0.4, -0.2, -0.4)]);
      return null;
    },
    duck(u, ctx) {
      // Bent low under a racked bar: hips down, chest forward, short steps, hands near the knees.
      const c = clamp(ctx.crouch ?? 0);
      body({ hips: V(0, dims.hip - 0.52 * c, -0.08 * c), lean: 1.0 * c, head: -0.75 * c });
      const g = (ctx.gait ?? 0) * Math.PI * 2;
      const stride = 0.12 * c + 0.04;
      legs(
        [V(-0.15, dims.ankle, 0.02 + stride * Math.sin(g)), V(0.15, dims.ankle, 0.02 - stride * Math.sin(g))],
        hintsOut(0.4, 0.1, 1),
        [-0.2, 0.2],
        [0.035 * Math.max(0, Math.cos(g)) * c, 0.035 * Math.max(0, -Math.cos(g)) * c]
      );
      const h = hipsAt();
      arms(sideways(0.19, V(0, h.y + 0.02, h.z + 0.32 * c + 0.06)), hintsOut(0.5, -0.3, -0.3));
      return null;
    },
  };

  const before = order.map(() => ({ q: new THREE.Quaternion(), p: new THREE.Vector3() }));
  const target = new THREE.Quaternion();

  return {
    dims,
    lifts: Object.keys(poses),
    // Pose `name` at phase u (0-1) over the pose already on the bones (a clip's), blended by
    // `weight`. Returns the bar (centre and axis), the hands, or a plate, in the room's frame.
    apply(name, u, ctx = {}, weight = 1) {
      const pose = poses[name];
      if (!pose || weight <= 0) return null;
      actor.updateMatrixWorld(true);
      order.forEach((b, i) => {
        before[i].q.copy(b.quaternion);
        before[i].p.copy(b.position);
      });
      const result = pose(((u % 1) + 1) % 1, ctx);
      if (weight < 1) {
        order.forEach((b, i) => {
          target.copy(b.quaternion);
          b.quaternion.copy(before[i].q).slerp(target, weight);
          b.position.lerpVectors(before[i].p, b.position.clone(), weight);
        });
        actor.updateMatrixWorld(true);
      }
      if (!result) return {};
      const out = {};
      if (result.bar) {
        out.center = toRoom(result.bar);
        out.axis = directionToRoom(result.axis);
      }
      if (result.hands) out.hands = Object.fromEntries(Object.entries(result.hands).map(([k, p]) => [k, toRoom(p)]));
      if (result.plate) {
        out.plate = toRoom(result.plate);
        out.plateAxis = directionToRoom(result.axis);
      }
      return out;
    },
    // Return every posed bone to the bind pose; the next clip evaluation then owns them again.
    release() {
      order.forEach((b, i) => {
        b.quaternion.copy(bind[i].q);
        b.position.copy(bind[i].p);
      });
    },
  };
}
