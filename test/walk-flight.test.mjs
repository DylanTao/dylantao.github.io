import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createWalkField } from "../assets/js/home-scene/colliders.mjs";
import { FLIGHT, stepFlight } from "../assets/js/home-scene/walk-flight.mjs";

function box(field, min, max) {
  const size = max.map((v, i) => v - min[i]),
    geometry = new THREE.BoxGeometry(...size),
    matrix = new THREE.Matrix4().makeTranslation(...max.map((v, i) => (v + min[i]) / 2));
  field.addGeometry({ positions: geometry.attributes.position.array, index: geometry.index.array, matrix: matrix.elements });
  geometry.dispose();
}
function field() {
  return createWalkField({ min: [-8, -15, -8], max: [20, 18, 8] });
}
function run(state, world, hz, seconds, options = {}) {
  const rows = [];
  for (let i = 0; i < Math.round(hz * seconds); i++) {
    stepFlight(state, world, { dt: 1 / hz, ...options, jump: Boolean(options.jump && i === 0) });
    rows.push({ ...state });
  }
  return rows;
}

test("a cliff fall crosses real air before landing on the beach at every frame rate", () => {
  const world = field();
  box(world, [-6, 8.8, -3], [0, 9, 3]);
  box(world, [-8, -10.2, -8], [20, -10, 8]);
  const results = [];
  for (const hz of [30, 60, 144]) {
    const state = { x: -0.5, z: 0, foot: 9, grounded: true, vy: 0 },
      rows = run(state, world, hz, 2.8, { dx: 2 / hz });
    assert.ok(
      rows.some((s) => !s.grounded && s.foot < 8 && s.foot > -9),
      "the fall is not a distant-floor snap"
    );
    assert.equal(state.foot, -10);
    assert.equal(state.grounded, true);
    assert.equal(state.vy, 0);
    results.push(rows.find((s) => s.foot === -10).x);
  }
  assert.ok(Math.max(...results) - Math.min(...results) < 0.08, JSON.stringify(results));
});

test("a jump follows gravity, cannot jump again in midair and lands without a penalty", () => {
  const world = field();
  box(world, [-8, -0.2, -8], [20, 0, 8]);
  const state = { x: 0, z: 0, foot: 0, grounded: true, vy: 0 };
  stepFlight(state, world, { dt: 1 / 120, jump: true });
  const rows = run(state, world, 120, 1.3, { jump: true }),
    apex = Math.max(...rows.map((s) => s.foot));
  assert.ok(Math.abs(apex - FLIGHT.jumpSpeed ** 2 / (2 * FLIGHT.gravity)) < 0.002);
  assert.equal(state.jumps, 1);
  assert.ok(Math.abs(state.foot) < 1e-6);
  assert.equal(state.grounded, true);
});

test("airborne long frames cannot cross a thin wall or a ceiling", () => {
  const world = field();
  box(world, [1, -12, -8], [1.04, 15, 8]);
  box(world, [-8, 3, -8], [1, 3.04, 8]);
  const state = { x: 0, z: 0, foot: 0.8, grounded: false, vy: 10 };
  stepFlight(state, world, { dt: 0.25, dx: 8 });
  assert.ok(state.x < 0.8, `wall: ${state.x}`);
  assert.ok(state.foot + 1.75 < 3.005, `ceiling: ${state.foot}`);
  assert.ok(state.vy <= 0, "upward speed is stopped at the ceiling");
});

test("a high pool entry emits one speed-driven impact and recovers to a finite floating state", () => {
  const world = field();
  box(world, [-8, -1.64, -8], [20, -1.44, 8]);
  const impacts = [],
    waterAt = () => ({ y: -0.09, id: "pool" }),
    state = { x: 0, z: 0, foot: 10, grounded: false, vy: 0 };
  const rows = run(state, world, 60, 12, { waterAt, impact: (event) => impacts.push(event) });
  assert.equal(impacts.length, 1);
  assert.ok(impacts[0].speed > 13 && impacts[0].speed < 15, impacts[0].speed);
  assert.ok(rows.every((s) => Number.isFinite(s.foot) && Number.isFinite(s.vy) && s.foot >= -1.44001));
  assert.ok(Math.abs(state.foot - (-0.09 - 1.2 / 1.05)) < 0.08, JSON.stringify(state));
  assert.ok(Math.abs(state.vy) < 0.1);
});

test("stairs still climb in both directions and a closed door blocks an airborne body", () => {
  const world = field();
  box(world, [-8, -0.2, -8], [20, 0, 8]);
  for (let i = 0; i < 12; i++) box(world, [-1, 0, i * 0.3], [1, (i + 1) * 0.17, (i + 1) * 0.3]);
  const state = { x: 0, z: -0.5, foot: 0, grounded: true, vy: 0 };
  run(state, world, 60, 2, { dz: 2 / 60 });
  assert.ok(state.foot > 2 && state.z > 3.4, JSON.stringify(state));
  run(state, world, 60, 2, { dz: -2 / 60 });
  assert.ok(Math.abs(state.foot) < 1e-6);
  const airborne = { x: 2, z: 0, foot: 0.5, grounded: false, vy: 0 };
  stepFlight(airborne, world, {
    dt: 0.2,
    dx: 4,
    dynamic: [{ min: [3, -1], max: [3.05, 1], bottom: 0, top: 3 }],
  });
  assert.ok(airborne.x <= 2.761, JSON.stringify(airborne));
});
