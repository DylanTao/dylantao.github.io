import test from "node:test";
import * as THREE from "../assets/js/three.module.min.js";
import assert from "node:assert/strict";
import { createWalkField } from "../assets/js/home-scene/colliders.mjs";
import { stepFlight } from "../assets/js/home-scene/walk-flight.mjs";
import { canDive, DIVE, diveDepth, diveHasSurfaced, insideDiveArea } from "../assets/js/home-scene/pacific-diving.mjs";
import { continuousDiveBed, createPacificUnderwater } from "../assets/js/home-scene/pacific-underwater.mjs";

const position = {
  x: 0,
  z: -25,
  foot: -8.46,
  vy: 0,
  grounded: false,
  wet: true,
};
const water = { id: "pacific", y: -7.35, floor: -11.4 };
const dt = 1 / 60;
const field = () => createWalkField({ min: [-3, -13, -30], max: [3, 0, -22] });
const depth = (eyes) => water.y - eyes.foot - DIVE.eyeHeight;

test("only the measured connected Pacific makes Dive available", () => {
  assert.equal(canDive(water, position.foot, position.x, position.z), true);
  assert.equal(canDive({ ...water, id: "infinity" }, position.foot, position.x, position.z), false);
  assert.equal(canDive({ ...water, floor: -8.4 }, position.foot, position.x, position.z), false);
  assert.equal(canDive({ id: "pacific", y: water.y }, position.foot, position.x, position.z), false);
  assert.equal(canDive(water, water.y, position.x, position.z), false);
  assert.equal(canDive(water, position.foot, 90, position.z), false);
  const forwardEye = DIVE.bounds.minZ - 0.14;
  assert.equal(insideDiveArea(0, forwardEye), false);
  assert.equal(insideDiveArea(0, forwardEye, DIVE.opticalMargin), true);
});

test("the real capsule dives, respects the modeled bed, and crosses the same surface on return", () => {
  const capsule = { ...position };
  const collision = field();
  const sink = { mode: "dive", depth: DIVE.initialDepth };
  const tick = (intent, steps) => {
    for (let i = 0; i < steps; i++) {
      stepFlight(capsule, collision, {
        dt,
        waterAt: () => water,
        swim: intent,
      });
      assert.ok(capsule.foot >= water.floor + DIVE.bottomClearance - 1e-8);
    }
  };
  tick(sink, 140);
  assert.ok(depth(capsule) > 0.53);
  assert.ok(depth(capsule) < 0.62);
  assert.ok(diveDepth(sink.depth, 1, -1.2, 4) > sink.depth);
  assert.ok(diveDepth(sink.depth, 1, 1.2, 1) < sink.depth);
  tick({ mode: "dive", depth: DIVE.maxDepth }, 200);
  assert.ok(capsule.foot <= water.floor + DIVE.bottomClearance + 0.01);
  tick({ mode: "surface" }, 160);
  assert.ok(diveHasSurfaced(water, capsule.foot));
  assert.ok(depth(capsule) < -0.51);
});

test("a submerged capsule cannot enter an isolated column or sweep through a rising seabed", () => {
  const capsule = { ...position, foot: -10.8 };
  const getWater = (x) => (x < -0.04 ? null : { ...water, floor: x > 0.04 ? -10.4 : water.floor });
  const collision = field();
  const intent = { mode: "dive", depth: 2.1 };
  for (const dx of [-0.22, 0.22]) {
    const result = stepFlight(capsule, collision, {
      dt,
      dx,
      waterAt: getWater,
      swim: intent,
    });
    assert.equal(result.blocked, true);
    assert.ok(Math.abs(capsule.x) <= 0.04);
  }
});

test("near the measured cells the swimming bed interpolates smoothly", () => {
  const sample = (x, z) => ({ height: x - 2 * z, rock: 0.4, reach: 0.2 });
  const bed = continuousDiveBed(sample, 0.47, 0.4);
  assert.ok(Math.abs(bed.height + 0.33) < 1e-12);
  assert.equal(bed.rock, 0.4);
  assert.equal(bed.reach, 0.2);
  assert.equal(
    continuousDiveBed(() => null, 0.47, 0.4),
    null
  );
});

test("only connected, measured ocean extends the air sweep past the native field boundary", () => {
  const collision = field();
  const start = { ...position, z: -29.4 };
  for (const column of [water, { ...water, id: "infinity" }, { id: "pacific", y: water.y }, null]) {
    const capsule = { ...start };
    for (let i = 0; i < 60; i++) stepFlight(capsule, collision, { dt, dz: -0.023, waterAt: () => column });
    if (column === water) assert.ok(capsule.z < -30.5);
    else assert.ok(capsule.z >= -30);
  }
  const swimmer = { ...start, z: DIVE.bounds.minZ + 0.28 };
  for (let i = 0; i < 60; i++) stepFlight(swimmer, collision, { dt, dz: -0.023, waterAt: () => water });
  assert.ok(swimmer.z >= DIVE.bounds.minZ && swimmer.z < DIVE.bounds.minZ + 0.08);
});

test("refined and compact habitats install lazily and render only while the eye is submerged", () => {
  for (const compact of [false, true]) {
    const root = new THREE.Group();
    const view = createPacificUnderwater(root, {
      compact,
      bedAt: (_x, z) => ({ height: -7.5 + z * 0.07, rock: 0, reach: 10 }),
      excluded: () => false,
    });
    assert.equal(view.evidence().draws, 0);
    const underwater = { submerged: true, depth: 0.62, floor: -10.34, surface: -7.36 };
    const light = { seconds: 0.4, daylight: 0.85, season: 0.7, sunDirection: new THREE.Vector3(0, 1, 0) };
    assert.equal(view.view(underwater, light), true);
    assert.equal(view.evidence().draws, 6);
    assert.ok(view.evidence().kelp > 0 && view.evidence().garibaldi > 1);
    assert.equal(view.view(null, light), false);
    assert.equal(view.evidence().draws, 0);
    view.dispose();
    assert.equal(root.children.length, 0);
  }
});
