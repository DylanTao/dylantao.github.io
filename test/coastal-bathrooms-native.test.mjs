import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { BODY, createWalkField, walkKind, WATER_BLOCK } from "../assets/js/home-scene/colliders.mjs";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";

// Use delivered, decoded triangles and the same capsule solver as Walk. Authored routes name
// destinations; their Y coordinates are assertions, never positions injected during a journey.
const manifest = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
const vector = (point) => new THREE.Vector3(...point);
const delivered = new Map();

function bathrooms() {
  const rooms = manifest.rooms.filter((room) => room.bathroom).map((room) => ({ ...room, ...room.bathroom }));
  assert.equal(rooms.length, 2, "one delivered bathroom on each inhabited floor");
  return rooms;
}

function bathroomAt(floor) {
  const room = bathrooms().find((entry) => entry.floor === floor);
  assert.ok(room, `bathroom at the existing ${floor} m floor`);
  return room;
}

async function deliveredHouse(cutaway = false) {
  if (!delivered.has(cutaway))
    delivered.set(
      cutaway,
      (async () => {
        const field = createWalkField(manifest.walk.region),
          roots = new Map(),
          solids = [],
          hiddenStructure = [];
        const files = new Set([
          manifest.shell,
          manifest.coast,
          ...manifest.rooms.map((room) => room.file),
          ...bathrooms().map((room) => room.file),
          manifest.flora,
          manifest.hinterland?.file,
        ]);
        for (const file of files) {
          if (!file) continue;
          const root = await nativeGeometry(file);
          roots.set(file, root);
          if (cutaway)
            root.traverse((object) => {
              if (object.userData.caveRoof || object.userData.bathroomCeilingFor) object.visible = false;
            });
          root.traverse((object) => {
            const kind = walkKind(object, root);
            if (cutaway && object.isMesh && !object.visible && (object.userData.caveRoof || object.userData.bathroomCeilingFor)) {
              assert.equal(kind, "solid", `${object.name}: a hidden native structural surface remains physical`);
              hiddenStructure.push(object);
            }
            if (
              cutaway &&
              object.isMesh &&
              object.parent?.visible === false &&
              (object.parent.userData.caveRoof || object.parent.userData.bathroomCeilingFor)
            ) {
              assert.equal(kind, "solid", `${object.parent.name}: child triangles under a hidden native structural node remain physical`);
              hiddenStructure.push(object);
            }
            if (!kind) return;
            field.addGeometry({
              positions: object.geometry.attributes.position.array,
              index: object.geometry.index?.array || null,
              matrix: object.matrixWorld.elements,
              extrude: kind === "water" ? WATER_BLOCK : 0,
            });
            if (kind !== "water") {
              // Architectural occlusion and headroom are physical, independent of triangle winding.
              object.material.side = THREE.DoubleSide;
              solids.push(object);
            }
          });
        }
        return { field, roots, solids, hiddenStructure };
      })()
    );
  return delivered.get(cutaway);
}

function traverse(field, route, label) {
  assert.ok(route?.length >= 2, `${label}: an authored connected route`);
  const first = route[0],
    start = field.findStand(first[0], first[2], first[1], { reach: 0.08, tolerance: 0.05 });
  assert.ok(start, `${label}: native support at ${JSON.stringify(first)}`);
  assert.ok(Math.hypot(start.x - first[0], start.z - first[2]) < 0.06, `${label}: starts at the authored circulation`);
  let state = start,
    travelled = 0,
    maximumRise = 0;
  for (const target of route.slice(1)) {
    let remaining = Math.hypot(target[0] - state.x, target[2] - state.z);
    for (let step = 0; remaining > 0.035 && step < 1000; step++) {
      const before = state,
        stride = Math.min(0.035, remaining);
      state = field.move(state.x, state.z, state.foot, ((target[0] - state.x) * stride) / remaining, ((target[2] - state.z) * stride) / remaining);
      assert.ok(state.moved > 1e-5, `${label}: blocked before ${JSON.stringify(target)} at ${JSON.stringify(state)}`);
      travelled += state.moved;
      maximumRise = Math.max(maximumRise, Math.abs(state.foot - before.foot));
      remaining = Math.hypot(target[0] - state.x, target[2] - state.z);
    }
    assert.ok(remaining <= 0.035, `${label}: reached ${JSON.stringify(target)}, remaining ${remaining}`);
    assert.ok(Math.abs(state.foot - target[1]) < 0.06, `${label}: native floor ${state.foot} agrees with ${target[1]}`);
  }
  assert.ok(maximumRise < 0.06, `${label}: no curb or substituted step; maximum rise ${maximumRise}`);
  return { state, travelled, maximumRise };
}

function ray(solids, origin, direction, far) {
  return new THREE.Raycaster(vector(origin), vector(direction).normalize(), 0.005, far).intersectObjects(solids, false);
}

test("the home delivers two distinct bathrooms attached to its existing inhabited floors", async () => {
  const guest = bathroomAt(0),
    ensuite = bathroomAt(2.6);
  assert.notEqual(guest.id, ensuite.id);
  assert.notEqual(guest.file, ensuite.file, "each bathroom has its delivered native asset");
  for (const room of [guest, ensuite]) {
    assert.ok(room.route?.length >= 3, `${room.id}: circulation continues into the bathroom`);
    assert.ok(room.route.every((point) => point.length === 3 && point.every(Number.isFinite)));
    assert.ok(
      room.route.every((point) => Math.abs(point[1] - room.floor) < 0.01),
      `${room.id}: remains on its existing floor`
    );
  }
  assert.ok(
    manifest.walk.mainEntryRoute.some((point) => distance(point, guest.route[0]) < 0.08),
    "the guest bathroom route starts on the real living-floor entrance circulation"
  );
  const sleep = manifest.rooms.find((room) => room.id === "sleep");
  assert.ok(
    [sleep.egress, ...sleep.exitPath].some((point) => distance(point, ensuite.route[0]) < 0.08),
    "the en suite route starts on the bedroom's current usable circulation"
  );
  const house = await deliveredHouse();
  for (const room of [guest, ensuite]) {
    assert.ok(house.roots.has(room.file), `${room.id}: actual bathroom GLB decoded`);
    assert.ok(house.roots.get(room.file).children.length > 0, `${room.id}: asset contains native geometry`);
  }
});

for (const floor of [0, 2.6]) {
  test(`the ${floor} m bathroom, its shower and WC approach are reachable and have a complete return journey`, async (t) => {
    const room = bathroomAt(floor),
      { field } = await deliveredHouse(),
      routes = { entry: room.route, shower: room.showerRoute, wc: room.wcApproachRoute },
      evidence = {};
    for (const [name, route] of Object.entries(routes)) {
      assert.ok(route?.length >= 2, `${room.id}: ${name} route is explicit`);
      if (name !== "entry") {
        assert.ok(
          room.route.some((point) => distance(point, route[0]) < 0.08),
          `${room.id}: ${name} approach connects to the proven bathroom spine`
        );
      }
      evidence[name] = {
        inward: traverse(field, route, `${room.id} ${name} inward`),
        outward: traverse(field, [...route].reverse(), `${room.id} ${name} outward`),
      };
    }
    assert.ok(evidence.entry.inward.travelled > 2, `${room.id}: travelled from actual house circulation`);
    t.diagnostic(JSON.stringify({ id: room.id, evidence, field: field.evidence() }));
  });

  test(`the ${floor} m bathroom has native doorway clearance and an enclosing ceiling above its usable spine`, async (t) => {
    const room = bathroomAt(floor),
      { solids } = await deliveredHouse(),
      // `entry` is the approach point; the actual oak frame is 7 cm inside it.
      doorway = { center: [room.entry[0] - 0.07, room.floor, room.entry[2]], tangent: [0, 1] },
      headroom = [];
    assert.ok(doorway?.center?.length === 3 && doorway.tangent?.length === 2, `${room.id}: measured doorway position and width direction`);
    const tangent = [doorway.tangent[0], 0, doorway.tangent[1]],
      waist = [doorway.center[0], floor + 1.05, doorway.center[2]],
      sides = [-1, 1].map(
        (sign) =>
          ray(
            solids,
            waist,
            tangent.map((value) => value * sign),
            2
          )[0]
      );
    assert.ok(sides.every(Boolean), `${room.id}: both native jambs bound the opening`);
    const clearWidth = sides.reduce((sum, hit) => sum + hit.distance, 0);
    assert.ok(clearWidth >= 0.88, `${room.id}: actual clear aperture ${clearWidth} m`);
    assert.ok(
      sides.every((hit) => hit.distance >= BODY.radius + 0.15),
      `${room.id}: useful clearance on both sides of the capsule`
    );
    assert.ok(room.headroomProbes?.length >= 3, `${room.id}: doorway, spine and shower headroom probes`);
    for (const point of room.headroomProbes) {
      const low = ray(solids, [point[0], point[1] + 0.12, point[2]], [0, -1, 0], 0.4)[0],
        high = ray(solids, [point[0], point[1] + 0.12, point[2]], [0, 1, 0], 8)[0];
      assert.ok(low && Math.abs(low.point.y - floor) < 0.03, `${room.id}: native floor under ${JSON.stringify(point)}`);
      assert.ok(high, `${room.id}: an enclosing native ceiling above ${JSON.stringify(point)}`);
      const clearance = high.point.y - low.point.y;
      assert.ok(clearance >= 2.19, `${room.id}: actual headroom ${clearance} at ${JSON.stringify(point)}`);
      headroom.push({ point, floor: low.point.y, ceiling: high.point.y, clearance });
    }
    t.diagnostic(JSON.stringify({ id: room.id, clearWidth, headroom }));
  });

  test(`the ${floor} m bathroom screens its WC from the connecting circulation even with the entrance open`, async (t) => {
    const room = bathroomAt(floor),
      { field, solids } = await deliveredHouse(),
      privacy = {
        target: [room.wc.center[0], floor + room.wc.seatHeight, room.wc.center[2]],
        observers: [
          [room.entry[0] + 0.4, floor + 1.6, room.entry[2]],
          [room.entry[0] + 1.35, floor + 1.6, room.entry[2] + 0.45],
        ],
      },
      evidence = [];
    assert.ok(privacy?.target?.length === 3 && privacy.observers?.length >= 2, `${room.id}: standing-eye privacy probes`);
    assert.ok(Math.abs(privacy.target[1] - (floor + 0.45)) < 0.2, `${room.id}: the target is the WC, not an arbitrary hidden ceiling`);
    const opaque = solids.filter((mesh) => !mesh.material.transparent && mesh.material.opacity >= 0.95 && !mesh.material.transmission);
    for (const observer of privacy.observers) {
      assert.ok(Math.abs(observer[1] - (floor + 1.6)) < 0.1, `${room.id}: normal standing-eye observer`);
      const stand = field.findStand(observer[0], observer[2], floor, { reach: 0.06, tolerance: 0.04 });
      assert.ok(
        stand && Math.hypot(stand.x - observer[0], stand.z - observer[2]) < 0.06,
        `${room.id}: privacy observer stands in usable circulation`
      );
      const delta = privacy.target.map((value, i) => value - observer[i]),
        length = Math.hypot(...delta),
        hit = ray(opaque, observer, delta, length - 0.55)[0];
      assert.ok(hit, `${room.id}: WC exposed from ${JSON.stringify(observer)}`);
      evidence.push({ observer, target: privacy.target, blocker: hit.object.parent?.name, distance: hit.distance, point: hit.point.toArray() });
    }
    t.diagnostic(JSON.stringify({ id: room.id, evidence }));
  });

  test(`the ${floor} m bathroom's visible shower glass blocks the body while its proper entrance remains usable`, async (t) => {
    const room = bathroomAt(floor),
      { field } = await deliveredHouse(),
      // Authored native pane: X -8.185 to -6.355, Z 3.02. The open approach is east of it.
      start = field.findStand(-7, 3.6, floor, { reach: 0.06, tolerance: 0.04 });
    assert.ok(start && Math.hypot(start.x + 7, start.z - 3.6) < 0.06, `${room.id}: native dry-floor approach in front of the glass`);
    let state = start,
      held = null,
      maximumRise = 0;
    for (let i = 0; i < 80; i++) {
      const before = state;
      state = field.move(state.x, state.z, state.foot, 0, -0.035);
      maximumRise = Math.max(maximumRise, Math.abs(state.foot - before.foot));
      if (i === 40) held = { ...state };
    }
    assert.ok(state.z >= 3.22 && state.z <= 3.52, `${room.id}: stops at the actual pane, rather than walking through to ${state.z}`);
    assert.ok(Math.hypot(state.x - held.x, state.z - held.z) < 0.005, `${room.id}: sustained input cannot creep through the glass`);
    assert.ok(maximumRise < 0.03, `${room.id}: blocked without a vertical teleport`);
    const properEntrance = traverse(field, room.showerRoute, `${room.id} shower gap`);
    t.diagnostic(JSON.stringify({ id: room.id, start, stopped: state, maximumRise, properEntrance }));
  });
}

test("a first Walk field built during the lower bathroom cutaway retains the upper floor and the new native cliff roof", async (t) => {
  const visible = await deliveredHouse(),
    cutaway = await deliveredHouse(true),
    upper = bathroomAt(2.6);
  assert.ok(
    cutaway.hiddenStructure.some((mesh) => mesh.parent.userData.bathroomCeilingFor === "bath-living"),
    "the actual lower-ceiling/upper-floor structure was hidden before the collision field was built"
  );
  assert.ok(
    cutaway.hiddenStructure.some((mesh) => mesh.parent.userData.caveRoof && /bathwing/.test(mesh.parent.name)),
    "the actual cliff roof over the new wing was hidden before the field was built"
  );
  const inward = traverse(cutaway.field, upper.route, "hidden-slab en suite inward"),
    outward = traverse(cutaway.field, [...upper.route].reverse(), "hidden-slab en suite outward"),
    roof = [];
  for (const [x, z] of [
    [-6.4, 2.3],
    [-6.4, 4.0],
    [-7.5, 5.5],
  ]) {
    const before = visible.field.floorBelow(x, z, 12),
      after = cutaway.field.floorBelow(x, z, 12);
    assert.ok(before > 6.5 && before < 11, `native cliff roof above the bathroom at ${x},${z}: ${before}`);
    assert.ok(Math.abs(after - before) < 0.001, `cutaway preserves native roof support at ${x},${z}: ${after} vs ${before}`);
    roof.push({ x, z, before, after });
  }
  t.diagnostic(JSON.stringify({ hiddenStructure: cutaway.hiddenStructure.map((mesh) => mesh.parent.name), inward, outward, roof }));
});
