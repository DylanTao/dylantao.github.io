import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";
import { createWalkField, walkKind, WATER_BLOCK, BODY } from "../assets/js/home-scene/colliders.mjs";
import { integrateVelocity, walkFieldBounds } from "../assets/js/home-scene/walk-controls.mjs";
import { stepFlight } from "../assets/js/home-scene/walk-flight.mjs";

const config = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
let pending;
function delivered() {
  return (pending ??= (async () => {
    const houseFiles = [config.shell, ...config.rooms.map((room) => room.file)],
      files = [...houseFiles, config.coast, config.flora, config.hinterland?.file].filter(Boolean),
      roots = await Promise.all(files.map((file) => nativeGeometry(file))),
      field = createWalkField(walkFieldBounds(config, roots.slice(0, houseFiles.length)));
    let water;
    for (const root of roots)
      root.traverse((object) => {
        if (object.isMesh && object.name.startsWith("core_infinity_water")) water = object;
        const kind = walkKind(object, root);
        if (kind)
          field.addGeometry({
            positions: object.geometry.attributes.position.array,
            index: object.geometry.index?.array,
            matrix: object.matrixWorld.elements,
            extrude: kind === "water" ? WATER_BLOCK : 0,
          });
      });
    assert.ok(water, "the delivered swimming surface exists");
    const bounds = new THREE.Box3().setFromObject(water),
      ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 0.02);
    const waterAt = (x, z) => {
      if (x < bounds.min.x || x > bounds.max.x || z < bounds.min.z || z > bounds.max.z) return { id: "pacific-mean-level-control", y: -7.35 };
      ray.ray.origin.set(x, bounds.max.y + 0.01, z);
      return ray.intersectObject(water, false).length ? { id: "infinity", y: bounds.max.y } : null;
    };
    return { field, waterAt };
  })());
}

function supported(field, x, z) {
  const result = field.findStand(x, z, field.floorBelow(x, z, 20), { reach: 0.2, tolerance: 0.1 });
  assert.ok(result, `actual native support at ${x},${z}`);
  return { ...result, grounded: true, vy: 0, vz: 0 };
}

test("the public arrival marker leaves a full capsule on the flat native landing", async () => {
  const { field } = await delivered(),
    [x, y, z] = config.walk.start.position;
  assert.deepEqual(config.walk.mainEntryRoute[0], [x, y, z]);
  // Include the route's 13cm endpoint tolerance, not just an exact center placement.
  for (let k = 0; k < 16; k++) {
    const angle = (k * Math.PI) / 8,
      radius = BODY.radius + 0.13,
      floor = field.floorBelow(x + radius * Math.cos(angle), z + radius * Math.sin(angle), y + 0.2);
    assert.ok(Math.abs(floor - y) < 0.005, `landing support at rim ${k}: ${floor}`);
  }
});

function advance(state, field, target, waterAt, jump, impacts) {
  const dt = 1 / 120,
    motion = integrateVelocity(state.vz, target, dt);
  state.vz = motion.velocity;
  return stepFlight(state, field, { dt, dz: motion.distance, jump, waterAt, impact: (event) => impacts.push(event) });
}

test("a real roof jump enters the delivered pool once and its native steps lead back to the dry terrace", async () => {
  const { field, waterAt } = await delivered(),
    state = supported(field, -1, 5),
    initial = { ...state },
    impacts = [],
    heights = [];
  for (let i = 0; i < 720; i++) {
    advance(state, field, state.z > -1.9 ? -4.2 : 0, waterAt, i === 0, impacts);
    heights.push(state.foot);
  }
  assert.ok(Math.max(...heights) > initial.foot + 1, "an actual jump before the fall");
  assert.ok(
    heights.some((foot) => foot > 1 && foot < 4),
    "air is traversed rather than a floor teleport"
  );
  assert.equal(state.waterEntries, 1);
  assert.equal(impacts.length, 1);
  assert.equal(impacts[0].water.id, "infinity");
  assert.ok(impacts[0].speed > 8);
  assert.equal(state.wet, true);
  assert.ok(Math.abs(state.foot - (config.infinityPool.waterline - 1.2 / 1.05)) < 0.08);
  let largestStep = 0;
  for (let i = 0; i < 1200; i++) {
    const before = state.foot;
    advance(state, field, state.z < 1.65 ? (state.wet ? 1.1 : 2) : 0, waterAt, false, impacts);
    largestStep = Math.max(largestStep, Math.abs(state.foot - before));
  }
  assert.ok(state.z > 1.6 && state.grounded && !state.wet, JSON.stringify(state));
  assert.ok(Math.abs(state.foot) < 0.04, "the same dry terrace floor");
  assert.ok(largestStep <= BODY.maxDrop + 0.01, `ordinary basin steps, largest ${largestStep}`);
  assert.equal(impacts.length, 1, "leaving the water does not invent another entry");
});

test("the near beach is inside the actual visitor field and catches a fall from the eastern clifftop", async () => {
  const { field, waterAt } = await delivered(),
    state = supported(field, 10, 0),
    initial = { ...state },
    impacts = [],
    heights = [];
  for (const row of config.beach.samples.filter((row) => Math.abs(row[0]) <= 18))
    assert.ok(field.bounds.min[2] <= -(row[1] + row[2]), "the whole measured near beach, not the former house rectangle");
  for (let i = 0; i < 1080; i++) {
    advance(state, field, state.foot > -6.4 ? -4.2 : 0, waterAt, i === 0, impacts);
    heights.push(state.foot);
  }
  assert.ok(
    heights.some((foot) => foot > -5 && foot < -2),
    "the descent crosses actual air"
  );
  assert.ok(initial.foot - state.foot > 10, JSON.stringify(state));
  assert.ok(state.grounded && state.foot < -6.4 && state.foot > -8.3, "the native beach/shallows catch the body without a respawn");
  assert.equal(state.vy, 0);
  assert.equal(state.jumps, 1);
});
