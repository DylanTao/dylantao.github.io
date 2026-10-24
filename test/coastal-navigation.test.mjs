import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { roomRoute, sampleRoute } from "../assets/js/home-scene/navigation.mjs";
import { supportHeight } from "../assets/js/home-scene/shore.mjs";

const config = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
// The stair runs along the landward wall (2.4 m further inland since the October 2026 renovation).
const stairZ = config.navigation.stairs[1][2];
const room = (id) => config.rooms.find((r) => r.id === id);
const supported = (point) => [point[0], supportHeight(point[0], point[2], config.terrain, point[1]), point[2]];
const slopes = (route) => route.points.slice(1).flatMap((p, i) => (Math.abs(p[1] - route.points[i][1]) > 0.01 ? [[route.points[i], p]] : []));
const mainStair = ([a, b]) => a[2] === stairZ && b[2] === stairZ;
const sunken = new Set(["kitchen", "lounge"]);

test("all room pairs begin and end on their actual supports and cross the correct stairs", () => {
  let pairs = 0;
  for (const from of config.rooms)
    for (const to of config.rooms) {
      const name = `${from.id} to ${to.id}`;
      pairs++;
      const route = roomRoute(config, from, to, from.actor);
      assert.ok(route.length > 0);
      assert.deepEqual(sampleRoute(route, 0).position, supported(from.actor), name);
      sampleRoute(route, 1).position.forEach((v, i) => assert.ok(Math.abs(v - supported(to.actor)[i]) < 1e-8, name));
      const changes = slopes(route),
        central = changes.filter(mainStair),
        local = changes.filter((pair) => !mainStair(pair));
      if (from.egress[1] === to.egress[1]) assert.equal(central.length, 0, `${name}: same corridor level never visits the main stair`);
      else {
        assert.equal(central.length, 15, `${name}: all 15 main risers`);
        const direction = Math.sign(to.egress[1] - from.egress[1]);
        central.forEach(([a, b]) => {
          assert.equal(a[2], stairZ);
          assert.equal(b[2], stairZ);
          assert.ok(Math.abs(a[1] - b[1]) < 0.175);
          assert.equal(Math.sign(b[1] - a[1]), direction);
        });
        assert.equal(central[0][0][1], from.egress[1]);
        assert.equal(central.at(-1)[1][1], to.egress[1]);
      }
      // Local stairs are independent of the 15-riser inter-storey stair. Each sunken endpoint
      // contributes the two 21 cm risers actually authored in the nook/pit, including return trips.
      assert.equal(local.length, 2 * (Number(sunken.has(from.id)) + Number(sunken.has(to.id))), `${name}: local risers`);
      for (const [a, b] of local) {
        assert.ok(a[1] >= -0.42001 && a[1] <= 0 && b[1] >= -0.42001 && b[1] <= 0, `${name}: local stairs stay below the lower corridor`);
        assert.ok(Math.abs(Math.abs(b[1] - a[1]) - 0.21) < 1e-6, `${name}: no jump from the seat to its corridor`);
        assert.notEqual(a[2], stairZ);
        assert.notEqual(b[2], stairZ);
      }
      for (let t = 0; t <= 1; t += 0.01) {
        const sample = sampleRoute(route, t);
        assert.ok(sample.position.every(Number.isFinite));
        assert.ok(sample.position[1] >= -0.42001 && sample.position[1] <= 2.6 + 1e-8);
      }
    }
  assert.equal(pairs, config.rooms.length ** 2);
});

test("sunken departures retain the authored pit path and use the crossed native nook tread", () => {
  const lounge = room("lounge"),
    kitchen = room("kitchen"),
    gym = room("gym");
  const pit = roomRoute(config, lounge, gym, lounge.actor);
  assert.deepEqual(pit.points[0], [-0.15, -0.42, 0.61], "the seated root at -.495 stands on the -.42 floor");
  assert.deepEqual(pit.points.slice(1, 1 + lounge.exitPath.length), lounge.exitPath, "the authored pit circulation remains exact");
  assert.deepEqual(
    slopes(pit).map(([a, b]) => [a[1], b[1]]),
    [
      [-0.42, -0.21],
      [-0.21, 0],
    ]
  );
  const nook = roomRoute(config, kitchen, gym, kitchen.actor);
  assert.deepEqual(nook.points[0], [-3.95, -0.42, -2.74], "the seated root at -.475 stands on the nook floor");
  const tread = nook.points.find((p) => p[1] === -0.21);
  assert.ok(tread, "the direct coffee path visits the exported intermediate tread");
  const nativeTread = { ...config.terrain, supportSurfaces: config.terrain.supportSurfaces.filter((s) => s.id.startsWith("nook-tread-")) };
  assert.equal(supportHeight(tread[0], tread[2], nativeTread, -99), -0.21, "the inserted point is inside a real tread, not in open air");
  assert.deepEqual(
    slopes(nook).map(([a, b]) => [a[1], b[1]]),
    [
      [-0.42, -0.21],
      [-0.21, 0],
    ]
  );
});

test("corridor levels choose the main stair independently of seated roots or room floor metadata", () => {
  const copy = structuredClone(config),
    lounge = copy.rooms.find((r) => r.id === "lounge"),
    kitchen = copy.rooms.find((r) => r.id === "kitchen");
  lounge.floor = copy.terrain.contacts.lounge.floor = -0.42;
  assert.equal(slopes(roomRoute(copy, lounge, kitchen, lounge.actor)).filter(mainStair).length, 0);
  const upstairs = copy.rooms.find((r) => r.id === "onsen");
  assert.equal(upstairs.actor[1], 2.12, "bathing pose root is below the gallery floor");
  const descending = roomRoute(copy, upstairs, lounge, upstairs.actor);
  assert.equal(descending.points[0][1], 2.6, "walking starts on the gallery's support, rather than the bathing root");
  assert.equal(slopes(descending).filter(mainStair).length, 15);
});

test("floor contact follows the landward treads and preserves the gallery opening", () => {
  for (let i = 0; i < 15; i++) {
    const x = -2 + (i + 0.5) * 0.26;
    assert.ok(Math.abs(supportHeight(x, stairZ, config.terrain, 0, true) - ((i + 1) * 2.6) / 15) < 0.00001);
  }
  // The upper walk in front of the stair opening, the opening itself, and the landing beside it.
  assert.equal(stairZ, 7.05);
  assert.equal(supportHeight(0, 6.3, config.terrain, 2.6), 2.6);
  assert.equal(supportHeight(0, 7.1, config.terrain, 2.6), 0);
  assert.equal(supportHeight(3, 7.1, config.terrain, 2.6), 2.6);
});

test("stairs use constant travel speed and never overshoot landings", () => {
  const route = roomRoute(
    config,
    config.rooms.find((r) => r.id === "gym"),
    config.rooms.find((r) => r.id === "onsen"),
    [-0.46, 0, -1.97]
  );
  assert.deepEqual(sampleRoute(route, -1).position, sampleRoute(route, 0).position);
  assert.deepEqual(sampleRoute(route, 2).position, sampleRoute(route, 1).position);
  for (let i = 1; i < route.distances.length; i++) assert.ok(route.distances[i] > route.distances[i - 1]);
});
