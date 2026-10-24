import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BODY, createWalkField, walkKind, WATER_BLOCK } from "../assets/js/home-scene/colliders.mjs";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";

const manifest = () => JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));

async function deliveredField(config) {
  const field = createWalkField(config.walk.region);
  const files = new Set([config.shell, config.coast, config.flora, config.hinterland?.file, ...config.rooms.map((room) => room.file)]);
  const hiddenStructure = [];
  const movingLeaves = [];
  for (const file of files) {
    if (!file) continue;
    const root = await nativeGeometry(file);
    root.traverse((object) => {
      if (object.userData.caveRoof || object.userData.roomCeilingFor || object.userData.bathroomCeilingFor) {
        object.visible = false;
        hiddenStructure.push(object.name);
      }
    });
    root.traverse((object) => {
      const kind = walkKind(object, root);
      let architectural = false;
      let moving = false;
      for (let node = object; node && node !== root; node = node.parent) {
        architectural ||= Boolean(node.userData.caveRoof || node.userData.roomCeilingFor || node.userData.bathroomCeilingFor);
        moving ||= Boolean(node.userData.estateDoor);
      }
      if (object.isMesh && architectural) assert.equal(kind, "solid", `${object.name}: cutaway support remains physical`);
      if (object.isMesh && moving) {
        assert.equal(kind, null, `${object.name}: a moved leaf cannot leave a static voxel wall`);
        movingLeaves.push(object.name);
      }
      if (!kind) return;
      field.addGeometry({
        positions: object.geometry.attributes.position.array,
        index: object.geometry.index?.array || null,
        matrix: object.matrixWorld.elements,
        extrude: kind === "water" ? WATER_BLOCK : 0,
      });
    });
  }
  assert.ok(hiddenStructure.length > 5);
  assert.ok(movingLeaves.length >= 4);
  return { field, BODY, hiddenStructure, movingLeaves };
}

function traverse(field, BODY, points, label, body = BODY) {
  assert.ok(points?.length >= 2, `${label}: complete authored route`);
  const [x, floor, z] = points[0];
  let state = field.findStand(x, z, floor, { reach: 0.08, tolerance: 0.08, body });
  assert.ok(state, `${label}: actual native starting support at ${JSON.stringify(points[0])}`);
  assert.ok(Math.hypot(state.x - x, state.z - z) < 0.06, `${label}: no displaced starting point`);
  let travelled = 0;
  let maximumRise = 0;
  for (const target of points.slice(1)) {
    let remaining = Math.hypot(target[0] - state.x, target[2] - state.z);
    for (let step = 0; remaining > 0.035 && step < 1200; step++) {
      const before = state;
      const stride = Math.min(0.035, remaining);
      state = field.move(
        state.x,
        state.z,
        state.foot,
        ((target[0] - state.x) * stride) / remaining,
        ((target[2] - state.z) * stride) / remaining,
        body
      );
      assert.ok(state.moved > 1e-5, `${label}: blocked before ${JSON.stringify(target)} at ${JSON.stringify(state)}`);
      maximumRise = Math.max(maximumRise, Math.abs(state.foot - before.foot));
      travelled += state.moved;
      remaining = Math.hypot(target[0] - state.x, target[2] - state.z);
    }
    assert.ok(remaining <= 0.035, `${label}: reached ${JSON.stringify(target)}`);
    assert.ok(Math.abs(state.foot - target[1]) < 0.2, `${label}: Y follows real triangles, never injected route height`);
  }
  assert.ok(maximumRise <= BODY.maxStep + 0.015, `${label}: no vertical teleport`);
  return { position: [state.x, state.foot, state.z], travelled, maximumRise };
}

// Find the real walkable route around the retained fire nook, rather than asking
// visitors to walk through its seats. Every graph edge uses the actual capsule
// solver and stays inside the broad dry strip behind the basin.
function dryPromenade(field, BODY, config) {
  const deck = config.estateOutdoors.terrace.bounds;
  const pool = config.estateOutdoors.pool.bounds;
  const pavilion = config.estateOutdoors.pavilion.bounds;
  const body = { ...BODY, radius: Math.max(BODY.radius, 0.28) };
  const cell = 0.14;
  const x0 = deck.x[0] + 0.5;
  const x1 = Math.min(deck.x[1] - 0.5, pavilion.x[0] + 1.25);
  const z0 = -(pool.y[0] - 0.35);
  const z1 = -(deck.y[0] + 0.4);
  const nx = Math.floor((x1 - x0) / cell);
  const nz = Math.floor((z1 - z0) / cell);
  const queue = [];
  const seen = new Set();
  for (let iz = 0; iz <= nz; iz++) {
    const start = field.findStand(x0, z0 + iz * cell, deck.floor, { reach: 0, tolerance: 0.08, body });
    if (start) {
      queue.push({ ix: 0, iz, state: start, parent: null });
      seen.add(`0,${iz}`);
    }
  }
  assert.ok(queue.length > 0, "the new west deck has a real, dry starting place");
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const node = queue[cursor];
    if (node.ix === nx) {
      const points = [];
      for (let at = node; at; at = at.parent) points.push([at.state.x, at.state.foot, at.state.z]);
      return { points: points.reverse(), body, domain: { x: [x0, x1], z: [z0, z1] }, explored: cursor + 1 };
    }
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ]) {
      const ix = node.ix + dx;
      const iz = node.iz + dz;
      const key = `${ix},${iz}`;
      if (ix < 0 || ix > nx || iz < 0 || iz > nz || seen.has(key)) continue;
      const wanted = [x0 + ix * cell, z0 + iz * cell];
      const moved = field.move(node.state.x, node.state.z, node.state.foot, wanted[0] - node.state.x, wanted[1] - node.state.z, body);
      if (Math.hypot(moved.x - wanted[0], moved.z - wanted[1]) > 0.02 || Math.abs(moved.foot - deck.floor) > 0.08) continue;
      seen.add(key);
      queue.push({ ix, iz, state: moved, parent: node });
    }
  }
  throw new Error(`The actual 56cm capsule cannot cross the dry rear promenade: ${JSON.stringify({ x0, x1, z0, z1, explored: queue.length })}`);
}

test("estate circulation: delivered Draco joins both entrances, bedroom, library floors and the dry promenade", { timeout: 300000 }, async (t) => {
  const config = manifest();
  const lower = config.rooms.find((room) => room.id === "library");
  const upper = config.rooms.find((room) => room.id === "library-upper");
  assert.ok(lower?.library);
  assert.equal(upper?.library?.private, true);
  assert.ok(lower.actor[0] < -8, "library is screen-right when viewed inland from the sea");
  const { field, BODY, hiddenStructure, movingLeaves } = await deliveredField(config);
  const evidence = { field: field.evidence(), hiddenStructure, movingLeaves, routes: {} };
  function bothWays(id, points) {
    evidence.routes[id] = {
      outward: traverse(field, BODY, points, id),
      return: traverse(field, BODY, [...points].reverse(), `${id} return`),
    };
  }
  try {
    bothWays("main entry", config.walk.mainEntryRoute);
    bothWays("private entry", config.entrance.privateEntrance.route);
    bothWays("lower library", lower.library.route);
    bothWays("upper library", upper.library.route);
    bothWays("bedroom to private library", config.estateLibrary.privateConnection);
    const treads = config.estateLibrary.stairRoute;
    assert.ok(treads.length >= 16);
    const going = Math.abs(treads[1][2] - treads[0][2]);
    const direction = Math.sign(treads[1][2] - treads[0][2]);
    const bottom = [treads[0][0], lower.floor, treads[0][2] - direction * going * 1.2];
    const top = [treads.at(-1)[0], upper.floor, treads.at(-1)[2] + direction * going * 1.2];
    bothWays("all library stair risers", [bottom, ...treads, top]);
    // This connection caught the original wall-to-wall writing table: reaching
    // the top tread alone does not prove that the visitor can enter the office.
    const passageX = upper.actor[0] + 0.1;
    bothWays("stair landing to private office", [top, [passageX, upper.floor, top[2]], [passageX, upper.floor, upper.actor[2]], upper.actor]);
    const promenade = dryPromenade(field, BODY, config);
    evidence.promenade = { ...promenade, body: promenade.body };
    evidence.routes["dry promenade"] = {
      outward: traverse(field, BODY, promenade.points, "dry promenade", promenade.body),
      return: traverse(field, BODY, [...promenade.points].reverse(), "dry promenade return", promenade.body),
    };
    assert.ok(evidence.routes["dry promenade"].outward.travelled > 12);
    const [px, , pz] = config.infinityPool.center;
    assert.equal(
      field.findStand(px, pz, lower.floor, { reach: 0, tolerance: 0.1 }),
      null,
      "pool water cannot become a shortcut across the dry promenade"
    );
  } finally {
    t.diagnostic(JSON.stringify(evidence));
  }
});
