import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { BODY, createWalkField, walkKind } from "../assets/js/home-scene/colliders.mjs";
import { bindCliffLift, createCliffLift } from "../assets/js/home-scene/cliff-lift.mjs";

const plan = {
  center: [-9.45, -13.45],
  size: [1.68, 1.96],
  opening: 1.08,
  stops: {
    top: { label: "Speakeasy", height: 0.001, side: 1, pad: { min: [-10.29, -12.47], max: [-8.61, -10] } },
    beach: { label: "Beach", height: -6.45, side: -1, pad: { min: [-10.29, -15.88], max: [-8.61, -14.43] } },
  },
};

const near = (actual, expected, tolerance = 0.0001) => assert.ok(Math.abs(actual - expected) <= tolerance, actual + " ≉ " + expected);

function padField(layout = plan) {
  const pads = Object.values(layout.stops).map(({ pad }) => pad);
  const field = createWalkField({
    min: [Math.min(...pads.map((pad) => pad.min[0])) - 1, layout.stops.beach.height - 1, Math.min(...pads.map((pad) => pad.min[1])) - 1],
    max: [Math.max(...pads.map((pad) => pad.max[0])) + 1, layout.stops.top.height + 3, Math.max(...pads.map((pad) => pad.max[1])) + 1],
  });
  for (const { pad, height: y } of Object.values(layout.stops)) {
    const [x0, z0] = pad.min;
    const [x1, z1] = pad.max;
    field.addTriangle(x0, y, z0, x0, y, z1, x1, y, z1);
    field.addTriangle(x0, y, z0, x1, y, z1, x1, y, z0);
  }
  return field;
}

function standOn(field) {
  return ([x, y, z]) => {
    const found = field.findStand(x, z, y, { reach: 0, tolerance: 0.1 });
    return found ? [found.x, found.foot, found.z] : null;
  };
}

const poseAt = (position) => ({ active: true, grounded: true, wet: false, yaw: 0.31, pitch: -0.2, position });

function board(lift, stop, stand) {
  const dock = plan.stops[stop];
  const edge = plan.center[1] + (dock.side * plan.size[1]) / 2;
  const position = [plan.center[0], dock.height, edge + dock.side * 0.36];
  const pose = poseAt(position);
  assert.ok(stand(position), "visitor began on the actual static pad");
  const first = lift.constrain(pose, { dz: -dock.side * 0.25 }, stand);
  assert.ok(first.walking && lift.boarded);
  pose.position = first.position;
  assert.equal(lift.control(pose), null, "a capsule straddling the gate cannot start a trip");
  const interior = lift.constrain(pose, { dz: -dock.side * 0.65 }, stand);
  pose.position = interior.position;
  assert.match(lift.control(pose)?.label, /^Ride lift to /);
  return pose;
}

test("the cabin accepts a dry crossing through its docked aperture and ignores orbit, jump and wall entry", () => {
  const lift = createCliffLift(plan, { radius: BODY.radius });
  const stand = standOn(padField());
  const outside = poseAt([-9.45, 0.001, -12.36]);
  assert.equal(lift.requestRide(outside, stand), false);
  assert.equal(lift.constrain({ ...outside, active: false }, { dz: -0.26 }, stand), null);
  assert.equal(lift.constrain({ ...outside, grounded: false }, { dz: -0.26 }, stand), null);
  assert.equal(lift.constrain({ ...outside, wet: true }, { dz: -0.26 }, stand), null);
  assert.equal(lift.constrain(outside, { dz: -0.26, jump: true }, stand), null);
  assert.equal(lift.constrain(poseAt([-8.8, 0.001, -12.36]), { dz: -0.26 }, stand), null);
  assert.equal(lift.constrain(poseAt([-9.45, -6.45, -14.7]), { dz: 0.55 }, stand), null);
  assert.equal(lift.constrain(poseAt([-9.45, 0.001, -13.45]), {}, stand), null);
  const inside = board(lift, "top", stand);
  assert.equal(
    lift.requestRide(inside, () => null),
    false,
    "departure needs support at the other landing"
  );
  const blocked = lift.constrain(inside, { dx: 2, dz: -2 }, stand);
  assert.ok(blocked.position[0] < -8.81 && blocked.position[2] > -14.43 + BODY.radius, "closed end and side wall hold the body");
  const back = lift.constrain(inside, { dz: 0.91 }, stand);
  assert.ok(back.released && !lift.boarded, "manual exit onto the live pad returns to normal Walk");
});

test("both trips move the capsule smoothly with the cabin, preserve look, and hand it to real landings", () => {
  const lift = createCliffLift(plan);
  const field = padField();
  const stand = standOn(field);
  for (const from of ["top", "beach"]) {
    const to = from === "top" ? "beach" : "top";
    const pose = board(lift, from, stand);
    const look = [pose.yaw, pose.pitch];
    assert.ok(lift.requestRide(pose, stand));
    assert.equal(lift.control(pose).disabled, true);
    let released = false;
    const travel = [];
    for (let frame = 0; frame < 220; frame++) {
      lift.update(0.04);
      const before = pose.position;
      const next = lift.constrain(pose, { dx: 7, dz: -7, jump: true }, stand);
      assert.ok(next, "the cabin never gives flight a frame before an actual landing");
      pose.position = next.position;
      assert.ok(Math.hypot(...next.position.map((value, i) => value - before[i])) < 0.15);
      const status = lift.evidence();
      if (status.phase === "travelling") {
        assert.equal(status.door, 0);
        near(pose.position[0], plan.center[0]);
        near(pose.position[1], status.position[1]);
        near(pose.position[2], plan.center[1]);
        assert.equal(field.findStand(...[pose.position[0], pose.position[2], pose.position[1]], { reach: 0, tolerance: 0.1 }), null);
        travel.push(pose.position[1]);
      }
      if (next.released) {
        released = true;
        break;
      }
    }
    assert.ok(released);
    assert.deepEqual([pose.yaw, pose.pitch], look);
    assert.deepEqual(stand(pose.position), pose.position, "the static field accepts the final foot");
    const direction = Math.sign(plan.stops[to].height - plan.stops[from].height);
    assert.ok(travel.every((y, i) => i === 0 || direction * (y - travel[i - 1]) >= 0));
    assert.ok(Math.abs(travel[2] - travel[1]) < Math.abs(travel[78] - travel[77]) / 5);
    assert.ok(Math.abs(travel.at(-2) - travel.at(-3)) < Math.abs(travel[78] - travel[77]) / 5);
    assert.equal(lift.evidence().stop, to);
    assert.equal(lift.evidence().target, null);
    assert.equal(lift.control(pose), null, "the visitor can move and jump normally again");
  }
});

test("a visitor can call an empty cab from the opposite dry pad without boarding", () => {
  const lift = createCliffLift(plan);
  const stand = standOn(padField());
  const waiting = poseAt([-9.45, -6.45, -15.03]);
  assert.deepEqual(lift.control(waiting), { label: "Call lift", disabled: false });
  assert.ok(lift.requestRide(waiting, stand));
  assert.equal(lift.constrain(waiting, {}, stand), null);
  for (let frame = 0; frame < 205; frame++) lift.update(0.04);
  assert.equal(lift.evidence().stop, "beach");
  assert.equal(lift.evidence().target, null);
  assert.equal(lift.boarded, false);
  assert.equal(lift.control(waiting), null);
});

test("the embedded lift boards from the bar on X, exits to the shore gallery on Z and returns", () => {
  const { cliffLift: layout } = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
  assert.equal(layout.stops.top.axis, "x");
  assert.equal(layout.stops.beach.axis, "z");
  const lift = createCliffLift(layout);
  const stand = standOn(padField(layout));
  const [cx, cz] = layout.center;
  const top = layout.stops.top;
  const beach = layout.stops.beach;
  for (const [dock, step, finish] of [
    [top, { dx: -0.42 }, [cx, beach.height, cz - layout.size[1] / 2 - 0.56]],
    [beach, { dz: 0.42 }, [cx + layout.size[0] / 2 + 0.56, top.height, cz]],
  ]) {
    const from = dock.axis === "x" ? [cx + layout.size[0] / 2 + 0.26, dock.height, cz] : [cx, dock.height, cz - layout.size[1] / 2 - 0.26];
    const pose = poseAt(from);
    pose.position = lift.constrain(pose, step, stand).position;
    pose.position = lift.constrain(pose, step, stand).position;
    assert.ok(lift.boarded && lift.requestRide(pose, stand));
    for (let i = 0; i < 240 && lift.boarded; i++) {
      lift.update(0.04);
      pose.position = lift.constrain(pose, {}, stand).position;
    }
    assert.ok(!lift.boarded);
    finish.forEach((value, axis) => near(pose.position[axis], value));
    assert.deepEqual(stand(pose.position), pose.position);
  }
});

test("all native gate batches remain separate from the static walk field and move in world space", () => {
  const parent = new THREE.Group();
  parent.position.set(2, 1, 0);
  parent.rotation.z = 0.22;
  parent.scale.setScalar(1.12);
  const geometry = new THREE.BoxGeometry(0.3, 0.9, 0.03);
  const material = new THREE.MeshBasicMaterial();
  const parts = {};
  for (const part of ["cab", "cabDoorTop", "cabDoorBeach", "topGate", "beachGate"]) {
    parts[part] = new THREE.Mesh(geometry, material);
    parts[part].userData = { cliffLiftPart: part, cliffLiftSlide: part.startsWith("cab") ? 0.54 : -0.54 };
    parent.add(parts[part]);
  }
  const before = new Map(Object.entries(parts).map(([part, object]) => [part, object.getWorldPosition(new THREE.Vector3())]));
  const lift = bindCliffLift(parent, plan);
  assert.ok(lift);
  assert.equal(lift.gateObjects.length, 2);
  assert.ok(Object.values(parts).every((object) => object.userData.dynamic && walkKind(object, parent) === null));
  near(parts.topGate.getWorldPosition(new THREE.Vector3()).x - before.get("topGate").x, -0.54);
  near(parts.beachGate.getWorldPosition(new THREE.Vector3()).x - before.get("beachGate").x, 0);
  const stand = standOn(padField());
  const rider = board(lift, "top", stand);
  assert.ok(lift.requestRide(rider, stand));
  lift.detach();
  assert.equal(lift.boarded, false);
  for (let frame = 0; frame < 205; frame++) lift.update(0.04);
  near(parts.cab.getWorldPosition(new THREE.Vector3()).y - before.get("cab").y, -6.451);
  near(parts.cabDoorBeach.getWorldPosition(new THREE.Vector3()).x - before.get("cabDoorBeach").x, 0.54);
  near(parts.topGate.getWorldPosition(new THREE.Vector3()).x - before.get("topGate").x, 0);
  near(parts.beachGate.getWorldPosition(new THREE.Vector3()).x - before.get("beachGate").x, -0.54);
  assert.equal(bindCliffLift(new THREE.Group(), plan), null);
});
