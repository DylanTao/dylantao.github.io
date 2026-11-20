import assert from "node:assert/strict";
import { test } from "node:test";
import { BODY, createWalkField } from "../assets/js/home-scene/colliders.mjs";
import { FLIGHT, stepFlight } from "../assets/js/home-scene/walk-flight.mjs";
import { nextWalkDestinationStep, planWalkDestination, TAP_WALK } from "../assets/js/home-scene/walk-destination.mjs";

function quad(field, a, b, c, d) {
  field.addTriangle(...a, ...b, ...c);
  field.addTriangle(...a, ...c, ...d);
}

function slab(field, x0, z0, x1, z1, y) {
  quad(field, [x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]);
}

function fieldForFloor({ z0 = -2, z1 = 2, fill = true } = {}) {
  const field = createWalkField({ min: [-4, -1, -3.5], max: [4, 5, 3.5] });
  if (fill) slab(field, -3.6, z0, 3.6, z1, 0);
  return field;
}

function pose(x = -1.2, z = 0, foot = 0) {
  return { x, z, foot, grounded: true, wet: false, vy: 0 };
}

const dt = 1 / 30;

function follow(field, start, route, options = {}, frames = 280) {
  const state = { ...start };
  const trail = [start];
  for (let frame = 0; frame < frames; frame++) {
    const next = nextWalkDestinationStep(route, field, state, dt, options);
    if (next.status !== "walking") return { state, trail, status: next.status };
    assert.ok(Math.hypot(next.dx, next.dz) <= TAP_WALK.speed * dt + 1e-9, "bounded frame displacement");
    const result = stepFlight(state, field, { dt, dx: next.dx, dz: next.dz, ...options });
    assert.equal(result.blocked, false, "the live flight sweep admits the planned displacement");
    assert.equal(state.grounded, true);
    assert.equal(state.wet, false);
    assert.ok(state.foot - trail.at(-1).foot <= BODY.maxStep + 0.002);
    trail.push({ ...state });
  }
  return { state, trail, status: "walking" };
}

function assertArrived(result, route) {
  assert.equal(result.status, "arrived");
  assert.ok(Math.hypot(result.state.x - route.target.x, result.state.z - route.target.z) <= TAP_WALK.arrival + 1e-9);
  assert.ok(Math.abs(result.state.foot - route.target.foot) <= 0.01);
}

test("a local supported floor tap follows the production flight capsule", () => {
  const field = fieldForFloor();
  const start = pose();
  const hit = { x: 1.2, y: 0, z: 0.3 };
  const route = planWalkDestination(field, start, hit);
  assert.ok(route);
  assertArrived(follow(field, start, route), route);
  assert.equal(planWalkDestination(field, start, { x: 10, y: 0, z: 0 }), null);
  assert.equal(planWalkDestination(field, start, { x: start.x, y: 0, z: start.z }), null);
});

test("routing bends around a real static wall and preserves capsule clearance", () => {
  const field = fieldForFloor();
  quad(field, [0, -0.3, -0.5], [0, 2.4, -0.5], [0, 2.4, 0.5], [0, -0.3, 0.5]);
  const start = pose();
  const hit = { x: 1.2, y: 0, z: 0 };
  const short = field.move(start.x, start.z, start.foot, hit.x - start.x, 0, BODY);
  assert.equal(short.blocked, true);
  const route = planWalkDestination(field, start, hit);
  assert.ok(route);
  const replay = follow(field, start, route);
  assertArrived(replay, route);
  assert.ok(
    replay.trail.some(({ x, z }) => Math.abs(x) < 0.15 && Math.abs(z) > 0.72),
    "the visitor walks round the wall end"
  );
});

test("a closed moving leaf rejects a tap and stops an open-leaf route when it closes", () => {
  const field = fieldForFloor({ z0: -0.5, z1: 0.5 });
  const start = pose();
  const hit = { x: 1.2, y: 0, z: 0 };
  const closed = { dynamic: [{ min: [-0.025, -0.93], max: [0.025, 0.93], bottom: 0, top: 2.35 }] };
  const open = { dynamic: [{ min: [-0.025, 0.62], max: [0.025, 0.95], bottom: 0, top: 2.35 }] };
  assert.equal(planWalkDestination(field, start, hit, closed), null);
  const route = planWalkDestination(field, start, hit, open);
  assert.ok(route);
  const replay = follow(field, start, route, open, 8);
  assert.equal(replay.status, "walking");
  const stopped = follow(field, replay.state, route, closed);
  assert.equal(stopped.status, "blocked");
  assert.ok(stopped.state.x < -BODY.radius);
  const openAgain = planWalkDestination(field, stopped.state, hit, open);
  assert.ok(openAgain);
  assertArrived(follow(field, stopped.state, openAgain, open), openAgain);
});

test("real stair treads can change levels and an unreachable upper story cannot snap downstairs", () => {
  const field = fieldForFloor({ fill: false });
  slab(field, -3.6, -1.5, -0.4, 1.5, 0);
  slab(field, -0.4, -1.5, 0.0, 1.5, 0.15);
  slab(field, 0.0, -1.5, 0.4, 1.5, 0.33);
  slab(field, 0.4, -1.5, 3.6, 1.5, 0.49);
  slab(field, 0.8, -1.0, 2.5, 1.0, 2.5);
  const start = pose();
  const route = planWalkDestination(field, start, { x: 1.2, y: 0.49, z: 0 });
  assert.ok(route);
  const replay = follow(field, start, route);
  assertArrived(replay, route);
  for (const y of [0, 0.15, 0.33, 0.49]) {
    assert.ok(
      replay.trail.some(({ foot }) => Math.abs(foot - y) < 0.002),
      "actual stair tread at " + y
    );
  }
  assert.equal(planWalkDestination(field, start, { x: 1.2, y: 2.5, z: 0 }), null);
});

test("a gap, wet crossing, invalid sample and airborne frame fail closed", () => {
  const gap = fieldForFloor({ fill: false });
  slab(gap, -3, -1, -0.7, 1, 0);
  slab(gap, 0.7, -1, 3, 1, 0);
  const start = pose();
  const hit = { x: 1.2, y: 0, z: 0 };
  assert.equal(planWalkDestination(gap, start, hit), null);
  const field = fieldForFloor({ z0: -0.5, z1: 0.5 });
  const water = { waterAt: (x) => (Math.abs(x) <= 0.28 ? { y: 0.19 } : null) };
  assert.equal(planWalkDestination(field, start, hit, water), null);
  assert.equal(planWalkDestination(field, start, { x: 0, y: 0, z: 0 }, water), null);
  assert.equal(planWalkDestination(field, start, { x: NaN, y: 0, z: 0 }), null);
  const route = planWalkDestination(field, start, hit);
  assert.ok(route);
  assert.equal(nextWalkDestinationStep(route, field, { ...start, grounded: false }, FLIGHT.maxFrame).status, "blocked");
});
