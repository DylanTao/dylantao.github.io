import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createLiftRig, lowerThenDrive, driveThenLower, LIFTS } from "../assets/js/home-scene/lift-rig.mjs";

// The figures' shared skeleton, as exported (bind translations and rotations from the GLBs).
function figure() {
  const room = new THREE.Group();
  const actor = new THREE.Group();
  room.add(actor);
  const armature = new THREE.Object3D();
  actor.add(armature);
  const bone = (name, parent, t, q = [0, 0, 0, 1]) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.fromArray(t);
    b.quaternion.fromArray(q).normalize();
    parent.add(b);
    return b;
  };
  const root = bone("Root", armature, [0, 0, 0]);
  const hips = bone("Hips", root, [0, 0.86, 0]);
  const spine = bone("Spine", hips, [0, 0.148, 0]);
  bone("Head", spine, [0, 0.352, 0]);
  for (const [side, x, s] of [
    ["L", -0.257, 1],
    ["R", 0.257, -1],
  ]) {
    const arm = bone(`Arm.${side}`, spine, [x, 0.267, 0], [-0.993, 0.083 * s, 0.083 * s, 0.007]);
    const fore = bone(`Forearm.${side}`, arm, [0, 0.259, 0], [-0.056, 0.077 * s, -0.068 * s, 0.993]);
    bone(`Hand.${side}`, fore, [0, 0.254, 0]);
    const thigh = bone(`Thigh.${side}`, hips, [x < 0 ? -0.11 : 0.11, 0, 0], [1, 0, 0, 0]);
    const shin = bone(`Shin.${side}`, thigh, [0, 0.42, 0]);
    bone(`Foot.${side}`, shin, [0, 0.365, 0], [-0.668, 0, 0, 0.744]);
  }
  actor.position.set(8.8, 0, 0.35);
  actor.rotation.y = Math.PI;
  room.updateMatrixWorld(true);
  return { room, actor };
}

const joint = (actor, name) => {
  let found;
  actor.traverse((o) => {
    if (o.isBone && o.name.replaceAll(".", "") === name) found = o;
  });
  return found.getWorldPosition(new THREE.Vector3());
};

test("repetition curves ease from rest to the turn and back", () => {
  assert.equal(lowerThenDrive(0), 0);
  assert.equal(lowerThenDrive(0.5), 1);
  assert.ok(lowerThenDrive(0.99) < 0.01);
  assert.equal(driveThenLower(0), 0);
  assert.equal(driveThenLower(0.42), 1);
  assert.ok(driveThenLower(0.95) < 0.01);
});

test("every lift solves to finite joints with the soles on the floor while standing", () => {
  const { actor } = figure();
  const rig = createLiftRig(actor);
  assert.ok(rig, "the rig finds every bone");
  const contexts = {
    squat: { hooks: [8.8, 1.28, 0.05] },
    "front-squat": { hooks: [8.8, 1.28, 0.05] },
    ohp: { hooks: [8.8, 1.28, 0.05] },
    deadlift: { bar: [8.8, 0.225, 0.28] },
    "sumo-deadlift": { bar: [8.8, 0.225, 0.28] },
    pullup: { bar: [8.8, 2.15, 0.15], grip: 0.3 },
    dip: { handY: 1.24, handHalf: 0.36 },
    curl: {},
    load: { barHeight: 1.28, plateRadius: 0.225 },
    board: { boardDistance: 0.5 },
    duck: { crouch: 0.8, gait: 0.3 },
  };
  for (const name of LIFTS.filter((n) => !n.includes("bench"))) {
    for (const u of [0, 0.25, 0.5, 0.75]) {
      rig.release();
      const out = rig.apply(name, u, contexts[name] || {});
      actor.traverse((o) => {
        if (o.isBone) assert.ok([...o.quaternion.toArray(), ...o.position.toArray()].every(Number.isFinite), `${name} ${u} ${o.name}`);
      });
      if (["pullup", "dip"].includes(name)) continue;
      for (const foot of ["FootL", "FootR"]) {
        const y = joint(actor, foot).y;
        assert.ok(Math.abs(y - 0.075) < 0.05, `${name} at ${u}: ${foot} ankle at ${y.toFixed(3)} m`);
      }
      if (out?.center) assert.ok(out.center.toArray().every(Number.isFinite));
    }
  }
});

test("hands close on the bar the rig reports, within a palm's width", () => {
  const { actor } = figure();
  const rig = createLiftRig(actor);
  for (const [name, ctx] of [
    ["squat", {}],
    ["front-squat", {}],
    ["ohp", {}],
    ["deadlift", { bar: [8.8, 0.225, 0.28] }],
  ]) {
    for (const u of [0, 0.3, 0.45]) {
      rig.release();
      const out = rig.apply(name, u, ctx);
      assert.ok(out.center, `${name} reports its bar`);
      const line = new THREE.Line3(out.center.clone().addScaledVector(out.axis, -1), out.center.clone().addScaledVector(out.axis, 1));
      for (const hand of ["HandL", "HandR"]) {
        const wrist = joint(actor, hand);
        const gap = line.closestPointToPoint(wrist, false, new THREE.Vector3()).distanceTo(wrist);
        assert.ok(gap < 0.11, `${name} at ${u}: ${hand} is ${gap.toFixed(3)} m from the bar`);
      }
    }
  }
});

test("the bench lies the figure face up along the bench with the bar over the shoulders", () => {
  const { actor } = figure();
  actor.position.set(9.42, 0, -2.65);
  actor.rotation.y = -Math.PI / 2;
  actor.parent.updateMatrixWorld(true);
  const rig = createLiftRig(actor);
  const out = rig.apply("bench", 0, { hooks: [10.6, 1.06, -2.65], lie: [10.18, 0, -2.65], hinge: [10.04, 0.395, -2.65], mount: 1 });
  const head = joint(actor, "Head"),
    hips = joint(actor, "Hips");
  assert.ok(head.x > hips.x + 0.3, "head toward the uprights");
  assert.ok(Math.abs(head.y - hips.y) < 0.15, "lying flat");
  assert.ok(hips.y > 0.45 && hips.y < 0.65, `hips on the pad, got ${hips.y.toFixed(2)}`);
  assert.ok(out.center.y > hips.y + 0.4, "the bar locked out above");
  assert.ok(Math.abs(out.axis.z) > 0.99, "the bar runs across the bench");
});

test("releasing hands every bone back to its bind pose", () => {
  const { actor } = figure();
  const before = [];
  actor.traverse((o) => o.isBone && before.push(o.quaternion.clone()));
  const rig = createLiftRig(actor);
  rig.apply("squat", 0.5, {});
  rig.release();
  let i = 0;
  actor.traverse((o) => {
    if (o.isBone) assert.ok(o.quaternion.angleTo(before[i++]) < 1e-9, o.name);
  });
});
