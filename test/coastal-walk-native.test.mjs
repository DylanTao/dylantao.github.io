import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BODY, createWalkField, walkKind, WATER_BLOCK } from "../assets/js/home-scene/colliders.mjs";
import { nativeHouseGeometry } from "./helpers/coastal-native-geometry.mjs";
import { createCliffLift } from "../assets/js/home-scene/cliff-lift.mjs";
import { stepFlight } from "../assets/js/home-scene/walk-flight.mjs";
import { roomAt, spawnPlan } from "../assets/js/home-scene/walk-controls.mjs";

const modelBase = process.env.COASTAL_MODELS_ROOT
  ? pathToFileURL(`${resolve(process.env.COASTAL_MODELS_ROOT)}/`)
  : new URL("../assets/models/home/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", modelBase)));
let delivered;
async function deliveredField() {
  return (delivered ??= (async () => {
    const field = createWalkField(manifest.walk.region);
    const files = [manifest.shell, manifest.coast, ...manifest.rooms.map((room) => room.file), manifest.flora, manifest.hinterland?.file].filter(
      Boolean
    );
    for (const file of files) {
      const root = await nativeHouseGeometry(file, manifest, modelBase);
      // Full screen commonly opens from an interior cutaway. Hide the actual native roof nodes as
      // the controller does, then prove their static triangles still carry a visitor outside.
      root.traverse((object) => {
        if (object.userData.caveRoof) object.visible = false;
      });
      root.traverse((object) => {
        const kind = walkKind(object, root);
        if (!kind) return;
        field.addGeometry({
          positions: object.geometry.attributes.position.array,
          index: object.geometry.index?.array || null,
          matrix: object.matrixWorld.elements,
          extrude: kind === "water" ? WATER_BLOCK : 0,
        });
      });
    }
    return field;
  })());
}

// Follow only by horizontal motion. The expected authored Y is an assertion, never an override:
// every actual foot elevation comes from native delivered triangles through the runtime solver.
function traverse(field, route, { floorTolerance = 0.2 } = {}) {
  const first = route[0],
    start = field.findStand(first[0], first[2], first[1], {
      reach: 0.15,
      tolerance: 0.08,
    });
  assert.ok(start, `native arrival support at ${JSON.stringify(first)}`);
  let state = start,
    travelled = 0,
    maximumRise = 0;
  for (const target of route.slice(1)) {
    let remaining = Math.hypot(target[0] - state.x, target[2] - state.z);
    for (let step = 0; remaining > 0.035 && step < 800; step++) {
      const distance = Math.min(0.035, remaining),
        before = state,
        next = field.move(
          state.x,
          state.z,
          state.foot,
          ((target[0] - state.x) * distance) / remaining,
          ((target[2] - state.z) * distance) / remaining
        );
      maximumRise = Math.max(maximumRise, Math.abs(next.foot - before.foot));
      travelled += next.moved;
      state = next;
      assert.ok(next.moved > 1e-5, `native route blocked before ${JSON.stringify(target)} at ${JSON.stringify(state)}`);
      remaining = Math.hypot(target[0] - state.x, target[2] - state.z);
    }
    assert.ok(remaining <= 0.035, `native route reached ${JSON.stringify(target)}, remaining ${remaining}`);
    assert.ok(Math.abs(state.foot - target[1]) < floorTolerance, `native support ${state.foot} matches authored floor ${target[1]}`);
  }
  assert.ok(maximumRise <= BODY.maxStep + 0.015, `no vertical teleport: largest native step ${maximumRise}`);
  return { state, travelled, maximumRise };
}

// The inland migration changes where native stair openings and retaining faces
// sit. Find a genuine top-surface journey around them rather than carrying an
// obsolete straight line across a new shaft. Every edge is the runtime capsule
// solver; a route cannot descend through the house to satisfy a rooftop check.
function roofJourney(field, from, to) {
  const step = 0.2;
  const start = field.findStand(from[0], from[2], from[1], {
    reach: 0.08,
    tolerance: 0.08,
  });
  assert.ok(start, "roof search starts at the actual current support");
  const queue = [{ state: start, ix: 0, iz: 0, parent: null }],
    seen = new Set(["0,0"]);
  for (let cursor = 0; cursor < queue.length && cursor < 18000; cursor++) {
    const node = queue[cursor],
      state = node.state;
    if (Math.hypot(state.x - to[0], state.z - to[2]) < 0.3) {
      const final = field.move(state.x, state.z, state.foot, to[0] - state.x, to[2] - state.z);
      if (Math.hypot(final.x - to[0], final.z - to[2]) < 0.02 && Math.abs(final.foot - to[1]) < 0.1) {
        const points = [[final.x, final.foot, final.z]];
        for (let at = node; at; at = at.parent) points.push([at.state.x, at.state.foot, at.state.z]);
        return points.reverse();
      }
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ix = node.ix + dx,
        iz = node.iz + dz,
        key = `${ix},${iz}`;
      if (seen.has(key)) continue;
      const x = start.x + ix * step,
        z = start.z + iz * step;
      if (x < -14 || x > 14 || z < 3 || z >= field.bounds.max[2] - step) continue;
      const next = field.move(state.x, state.z, state.foot, x - state.x, z - state.z);
      if (Math.hypot(next.x - x, next.z - z) > 0.015 || next.foot < 6.5 || next.foot > 12) continue;
      seen.add(key);
      queue.push({ state: next, ix, iz, parent: node });
    }
  }
  throw Error(`No genuine rooftop capsule journey to ${JSON.stringify(to)} after ${queue.length} native states`);
}

test("the delivered main entrance continuously descends into the living floor and climbs back outside", async (t) => {
  assert.equal(manifest.entrance.floor, 0, "the main door enters the shared living floor");
  const route = manifest.walk.mainEntryRoute;
  assert.ok(route?.length >= 50, "the complete curved descent and actual lower foyer circulation are authored");
  assert.deepEqual(route[0], manifest.walk.start.position, "Walk starts at the top of its actual main-entry route");
  const [arrival, next] = route,
    dx = next[0] - arrival[0],
    dz = next[2] - arrival[2],
    yaw = manifest.walk.start.yaw,
    forwardDot = (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / Math.hypot(dx, dz);
  assert.ok(forwardDot > 0.99, `Walk arrival faces down its public descent: forward dot ${forwardDot}`);
  const field = await deliveredField(),
    inward = traverse(field, route),
    outward = traverse(field, [...route].reverse());
  const planLength = route.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0] - route[i][0], point[2] - route[i][2]), 0);
  assert.ok(
    Math.abs(inward.travelled - planLength) < 0.3 && Math.abs(outward.travelled - planLength) < 0.3,
    "both walks cover the actual complete, shorter curved route"
  );
  assert.ok(Math.abs(inward.state.foot) < 0.08, "inside at the shared living floor");
  assert.ok(Math.abs(outward.state.foot - manifest.entrance.top) < 0.08, "outside on the actual clifftop portal");
  t.diagnostic(JSON.stringify({ inward, outward, field: field.evidence() }));
});

test("the public patio destination starts on dry delivered paving rather than the pool floor", async () => {
  const field = await deliveredField();
  const plan = spawnPlan(manifest, { room: "outside", routineRoom: "study" }, { entrance: false });
  const stood = plan.candidates.map(([x, z]) => field.findStand(x, z, plan.floor, { reach: 0.45 })).find(Boolean);
  assert.ok(stood, "a real capsule fits on the patio");
  assert.ok(Math.abs(stood.foot) < 0.1, `dry paving, not the submerged basin: ${JSON.stringify(stood)}`);
  const arrival = traverse(field, [[stood.x, stood.foot, stood.z], ...manifest.retreat.patioRoute.slice(0, 3).reverse()]);
  assert.ok(arrival.travelled > 5, "the dry start connects to the living floor through the real facade opening");
});

test("the study patio door joins the whole dry promenade and returns without squeezing behind old furniture", async (t) => {
  const field = await deliveredField();
  const { studyRoute: route, cookRoute } = manifest.retreat.patioCirculation;
  const outward = traverse(field, route);
  const inward = traverse(field, [...route].reverse());
  // This is a usable promenade, rather than the former 0.74m slot behind an
  // orphan bistro chair. Test the actual solid triangles with a generous body:
  // the dry cross-terrace lane must admit a full 1.2m diameter in both directions.
  const generous = { ...BODY, radius: 0.6 };
  for (const z of [2.7]) {
    for (let x = -7.4; x < 2.7; x += 0.1) {
      const resolved = field.resolve(x, z, 0, generous);
      assert.ok(resolved.clear && Math.hypot(resolved.x - x, resolved.z - z) < 0.015, `real 1.2m promenade is clear at ${x.toFixed(2)},${z}`);
      for (const dx of [-0.1, 0.1]) {
        const step = field.move(x, z, 0, dx, 0, generous);
        assert.ok(Math.abs(step.x - (x + dx)) < 0.02, `the generous body moves along the actual promenade at ${x.toFixed(2)}`);
      }
    }
  }
  const branch = route.findIndex((point) => point.every((value, axis) => value === cookRoute[0][axis]));
  assert.ok(branch > 0, "the actual cook aisle branches from the measured approach");
  const cooking = [...route.slice(0, branch), ...cookRoute];
  const cookOut = traverse(field, cooking);
  const cookBack = traverse(field, [...cooking].reverse());
  for (const journey of [outward, cookOut]) {
    const { x, z, foot } = journey.state;
    assert.equal(roomAt(manifest, x, z, foot), "outside");
    assert.ok(x < -8.5 && z < -2.2, "the visitor reached the study-side terrace");
  }
  for (const journey of [inward, cookBack]) {
    const { x, z, foot } = journey.state;
    assert.equal(roomAt(manifest, x, z, foot), "study");
  }
  t.diagnostic(JSON.stringify({ route, outward, inward, cooking, cookOut, cookBack }));
});

test("the stair hall's landing door joins the upper floor in both directions", async (t) => {
  // One stair (Sirui, October 24): from the living aisle through the pivot door, up the hall's
  // first flight to its landing, and through the landing's pocket door onto the upper floor.
  const route = [...manifest.navigation.lowerStairApproach, ...manifest.navigation.stairs];
  assert.equal(manifest.privateEntrance, undefined, "the private onsen spiral is retired");
  assert.equal(route.at(-1)[1], 2.6, "the house stair ends on the upper floor");
  const field = await deliveredField();
  const inward = traverse(field, route),
    outward = traverse(field, [...route].reverse());
  t.diagnostic(JSON.stringify({ inward, outward }));
});

test("the clifftop walking field extends beyond the entrance over real terrain", async (t) => {
  assert.ok(manifest.walk.region.max[2] >= 30 && manifest.walk.region.min[0] <= -15, "room to walk around the entrance");
  const field = await deliveredField(),
    points = [manifest.walk.start.position];
  const start = manifest.walk.start;
  const [x0, , z0] = start.position;
  // B leaves the north edge of the plinth, skirts its east cheek, then follows the natural ridge.
  // The former pavilion had a different opening and reached the hill on its west side.
  const terrain = manifest.entrance.straightDescent
    ? [
        [x0 + 3.9, z0 + 1.44],
        [x0 + 3.9, z0 - 0.2],
        [x0 + 3.9, 25.0],
      ]
    : [
        [x0 - Math.sin(start.yaw) * 1.8, z0 - Math.cos(start.yaw) * 1.8],
        [3.42, 25],
        [0, 25],
        [-3, 25],
        [-3, 24.2],
      ];
  for (const [x, z] of terrain) {
    const foot = field.floorBelow(x, z, 12);
    assert.ok(Number.isFinite(foot), `real native clifftop support at ${x}, ${z}`);
    points.push([x, foot, z]);
  }
  const outward = traverse(field, points);
  assert.ok(outward.travelled > 10, "the clifftop is more than the door's landing");
  const inward = traverse(field, [...points].reverse());
  t.diagnostic(JSON.stringify({ inward, outward }));
});

test("the hidden cutaway roof remains real clifftop support while crossing the dwelling and returning", async (t) => {
  const field = await deliveredField();
  // These points are above the dwelling itself, unlike the inland terrain loop. Without the
  // retained roof triangles they incorrectly stand on the upper floor or have no support at all.
  const setback = manifest.retreat.setbackMetres;
  const rooftop = [
    [0, setback],
    [0, 6 + setback],
    [-2, 3 + setback],
  ];
  for (const [x, z] of rooftop) {
    const foot = field.floorBelow(x, z, 12);
    assert.ok(foot > 6.5 && foot < 12, `actual sandstone roof support at ${x}, ${z}: ${foot}`);
  }
  const points = [manifest.walk.start.position];
  for (const [x, z] of rooftop) {
    const foot = field.floorBelow(x, z, 12);
    assert.ok(Number.isFinite(foot), `native support on roof route at ${x}, ${z}`);
    points.push(...roofJourney(field, points.at(-1), [x, foot, z]).slice(1));
  }
  const outward = traverse(field, points),
    inward = traverse(field, [...points].reverse());
  assert.ok(outward.travelled > 30 && inward.travelled > 30, "crossed the actual house roof and returned through continuous native supports");
  t.diagnostic(
    JSON.stringify({
      inward,
      outward,
      supports: rooftop.map(([x, z]) => ({
        x,
        z,
        foot: field.floorBelow(x, z, 12),
      })),
    })
  );
});

test("the delivered lift boards across the jamb and protects the unoccupied well at each stop", async () => {
  const field = await deliveredField();
  const lift = createCliffLift(manifest.cliffLift);
  const stand = ([x, height, z]) => {
    const pad = field.findStand(x, z, height, { reach: 0, tolerance: 0.1 });
    return pad && [pad.x, pad.foot, pad.z];
  };
  const place = (point) => {
    const floor = stand(point);
    assert.ok(floor, `real landing support at ${point}`);
    return { x: floor[0], foot: floor[1], z: floor[2], grounded: true, wet: false, vy: 0 };
  };
  const pose = ({ x, foot, z, grounded, wet }) => ({ active: true, position: [x, foot, z], grounded, wet });
  function step(state, motion) {
    lift.update(1 / 60);
    const owned = lift.constrain(pose(state), motion, stand);
    if (owned) {
      [state.x, state.foot, state.z] = owned.position;
      state.grounded = true;
      state.vy = 0;
    } else stepFlight(state, field, { dt: 1 / 60, ...motion, dynamic: lift.gateBarriers });
  }

  const upper = place([-11.8, 0.001, -9.03]);
  for (let i = 0; i < 65; i++) step(upper, { dx: -0.022 });
  assert.ok(lift.boarded, "a capsule 29 cm off centre still fits the real 1.08 m aperture");
  assert.ok(lift.requestRide(pose(upper), stand));
  for (let i = 0; i < 600 && lift.boarded; i++) {
    step(upper, {});
    assert.ok(upper.grounded);
    if (lift.evidence().phase === "travelling") assert.equal(upper.foot, lift.evidence().position[1]);
  }
  assert.equal(lift.evidence().stop, "beach");
  assert.ok(!lift.boarded && upper.z < -10.6 && Math.abs(upper.foot + 6.45) < 0.005);

  // The empty upper gate remains a full-body obstacle on a running jump.
  const leftBehind = place([-12.18, 0.001, -9.32]);
  for (let i = 0; i < 80; i++) {
    step(leftBehind, { dx: -0.05, jump: i === 0 });
    assert.ok(leftBehind.x > -12.67 && leftBehind.foot >= -0.02);
  }

  for (let i = 0; i < 65; i++) step(upper, { dz: 0.022 });
  assert.ok(lift.boarded && lift.requestRide(pose(upper), stand));
  for (let i = 0; i < 600 && lift.boarded; i++) step(upper, {});
  assert.equal(lift.evidence().stop, "top");
  assert.ok(!lift.boarded && upper.x > -12.2 && Math.abs(upper.foot) < 0.005);

  const lowerEmpty = place([-13.51, -6.45, -10.86]);
  for (let i = 0; i < 80; i++) {
    step(lowerEmpty, { dz: 0.035, jump: i === 0 });
    assert.ok(lowerEmpty.z < -10.3 && lowerEmpty.foot >= -6.47);
  }
});

test("the gym capsule walks through the diagonal garden opening and returns on the real sill", async () => {
  const field = await deliveredField();
  const route = [
    [9.077, 0.025, 3.608],
    [8.75, 0.032, 3.168],
    [8.33, 0.012, 2.602],
  ];
  for (const points of [route, [...route].reverse()]) {
    const crossing = traverse(field, points);
    assert.ok(crossing.travelled > 1.18);
    assert.ok(crossing.maximumRise < 0.055);
  }
});

test(
  "the supper gallery stair connects the lower patio to the dining aisle in both directions",
  { skip: !manifest.walk.places?.["supper-gallery"] },
  async () => {
    const field = await deliveredField();
    const height = manifest.walk.places["supper-gallery"].position[1];
    const stairX = -7.73;
    const treads = Array.from({ length: 18 }, (_, i) => [stairX, (height * (i + 1)) / 18, -(5.34 + 0.28 * (i + 0.5))]);
    const patio = [stairX, 0.001, -4.18];
    const upperTurn = [stairX, height, -10.68];
    const westTurn = [-9.87, height, -10.68];
    const dining = [-9.87, height, -7.83];
    const route = [patio, ...treads, upperTurn, westTurn, dining];
    for (const points of [route, [...route].reverse()]) {
      const crossing = traverse(field, points, { floorTolerance: 0.025 });
      assert.ok(crossing.travelled > 11.2, "the route covers the full lower approach, staircase and dining aisle");
      assert.ok(crossing.maximumRise > 0.15 && crossing.maximumRise < 0.19, "a single decoded tread sets the largest rise");
    }
  }
);
