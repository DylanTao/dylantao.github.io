import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { roomRoute, sampleRoute } from "../assets/js/home-scene/navigation.mjs";

const config = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));

test("every pair of rooms has a bounded route through the correct floor and stairs", () => {
  for (const from of config.rooms)
    for (const to of config.rooms) {
      const route = roomRoute(config, from, to, from.actor);
      assert.ok(route.length > 0);
      assert.deepEqual(sampleRoute(route, 0).position, [from.actor[0], from.floor, from.actor[2]]);
      sampleRoute(route, 1).position.forEach((v, i) => assert.ok(Math.abs(v - [to.actor[0], to.floor, to.actor[2]][i]) < 1e-8));
      const slopes = route.points.slice(1).flatMap((p, i) => (Math.abs(p[1] - route.points[i][1]) > 0.01 ? [[route.points[i], p]] : []));
      if (from.floor === to.floor) assert.equal(slopes.length, 0);
      else {
        assert.equal(slopes.length, 15);
        slopes.forEach(([a, b]) => {
          assert.equal(a[0], config.navigation.stairX);
          assert.equal(b[0], config.navigation.stairX);
          assert.ok(Math.abs(a[1] - b[1]) < 0.175);
        });
      }
      for (let t = 0; t <= 1; t += 0.01) {
        const sample = sampleRoute(route, t);
        assert.ok(sample.position.every(Number.isFinite));
        assert.ok(sample.position[1] >= -1e-8 && sample.position[1] <= 2.6 + 1e-8);
      }
    }
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
