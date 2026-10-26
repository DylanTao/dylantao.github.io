import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BODY, createWalkField, walkKind, WATER_BLOCK } from "../assets/js/home-scene/colliders.mjs";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";

const manifest = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
let delivered;
async function deliveredField() {
  return (delivered ??= (async () => {
    const field = createWalkField(manifest.walk.region);
    const files = [manifest.shell, manifest.coast, ...manifest.rooms.map((room) => room.file), manifest.flora, manifest.hinterland?.file].filter(
      Boolean
    );
    for (const file of files) {
      const root = await nativeGeometry(file);
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
function traverse(field, route) {
  const first = route[0],
    start = field.findStand(first[0], first[2], first[1], { reach: 0.15, tolerance: 0.08 });
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
    assert.ok(Math.abs(state.foot - target[1]) < 0.2, `native support ${state.foot} matches authored floor ${target[1]}`);
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
  const start = field.findStand(from[0], from[2], from[1], { reach: 0.08, tolerance: 0.08 });
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
      if (x < -14 || x > 14 || z < 3 || z > 29) continue;
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
  for (const [x, z] of [
    [3.42, 25],
    [0, 25],
    [-3, 25],
    [-3, 24.2],
  ]) {
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
  t.diagnostic(JSON.stringify({ inward, outward, supports: rooftop.map(([x, z]) => ({ x, z, foot: field.floorBelow(x, z, 12) })) }));
});
