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

test("the delivered main entrance continuously descends into the living floor and climbs back outside", async (t) => {
  assert.equal(manifest.entrance.floor, 0, "the main door enters the shared living floor");
  const route = manifest.walk.mainEntryRoute;
  assert.ok(route?.length >= 50, "the complete entry, both native stair flights and lower circulation are authored");
  assert.deepEqual(route[0], manifest.walk.start.position, "Walk starts at the top of its actual main-entry route");
  const field = await deliveredField(),
    inward = traverse(field, route),
    outward = traverse(field, [...route].reverse());
  assert.ok(inward.travelled > 20 && outward.travelled > 20);
  assert.ok(Math.abs(inward.state.foot) < 0.08, "inside at the shared living floor");
  assert.ok(Math.abs(outward.state.foot - manifest.entrance.top) < 0.08, "outside on the actual clifftop portal");
  t.diagnostic(JSON.stringify({ inward, outward, field: field.evidence() }));
});

test("the optional upper private entrance remains traversable in both directions", async (t) => {
  const route = manifest.entrance.privateEntrance?.route;
  assert.ok(route?.length >= 2, "the optional private entry has an authored route");
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
    [3.42, 22],
    [0, 22],
    [-3, 22],
    [-3, 20],
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
  const rooftop = [
    [0, 0],
    [0, 6],
    [-2, 3],
  ];
  for (const [x, z] of rooftop) {
    const foot = field.floorBelow(x, z, 9);
    assert.ok(foot > 6.5 && foot < 8, `actual sandstone roof support at ${x}, ${z}: ${foot}`);
  }
  const points = [manifest.walk.start.position];
  // Follow the mineral garden path out around the portal's real stone fin and oak brow,
  // then use the agave gap to cross the roof. Do not shortcut through the new solid portal.
  // Probe below its canopy so each approach point means the actual walking floor.
  for (const [x, z] of [
    [3.42, 20.4],
    [1.6, 21.1],
    [1.8, 18.8],
    [1.8, 9.6],
    [-0.2, 7.6],
    [-0.2, 0.2],
    [0, 0],
    [0, 6],
    [-2, 3],
  ]) {
    const foot = field.floorBelow(x, z, 9);
    assert.ok(Number.isFinite(foot), `native support on roof route at ${x}, ${z}`);
    points.push([x, foot, z]);
  }
  const outward = traverse(field, points),
    inward = traverse(field, [...points].reverse());
  assert.ok(outward.travelled > 30 && inward.travelled > 30, "crossed the actual house roof and returned through continuous native supports");
  t.diagnostic(JSON.stringify({ inward, outward, supports: rooftop.map(([x, z]) => ({ x, z, foot: field.floorBelow(x, z, 12) })) }));
});
