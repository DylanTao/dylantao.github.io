import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { createOnsenWater } from "../assets/js/home-scene/onsen-water.mjs";
import { regionalLights, regionalHeight, FAR_SEA_LEVEL, coastLine } from "../assets/js/home-scene/far-field.mjs";
import { bindWaterGarden } from "../assets/js/home-scene/water-garden.mjs";
test("the retained native bamboo outlet disturbs the existing basin without changing its volume", () => {
  const root = new THREE.Group(),
    water = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial()),
    fixture = new THREE.Group();
  fixture.name = "onsen_decor_dry_bamboo";
  root.add(water, fixture);
  const pool = createOnsenWater({ center: [3.17, 3.18], surfaceY: 3.0075 }),
    volume = pool.evidence().volume;
  pool.bindMaterial(water.material, water);
  for (let i = 0; i < 180; i++) pool.advance(1 / 120);
  assert.equal(pool.evidence().drip.bound, true);
  assert.ok(pool.evidence().drip.drops >= 1);
  assert.ok(Math.abs(pool.evidence().volume - volume) < 1e-10);
  const held = pool.evidence().drip.drops;
  pool.advance(0);
  assert.equal(pool.evidence().drip.drops, held);
  pool.dispose();
  assert.ok(!root.getObjectByName("Onsen bamboo drip inlet"));
});
test("the native creek and pond sit above their carved beds and clear the house entrance", () => {
  const garden = JSON.parse(fs.readFileSync(new URL("../artwork/coastal-home/reviews/water-garden.json", import.meta.url)));
  assert.ok(garden.nativeSupport.creekSamples >= 78);
  assert.ok(garden.nativeSupport.minCreekDepth > 0.01);
  assert.ok(garden.nativeSupport.maxCreekDepth < 0.8);
  assert.ok(garden.nativeSupport.minPondDepth > 0.3);
  assert.ok(garden.creek.every((p) => p[0] < -12 && p[2] > 45));
  for (let i = 1; i < garden.creek.length; i++) assert.ok(garden.creek[i][1] < garden.creek[i - 1][1]);
});
test("koi positions are deterministic on the shared active clock, with no swimming on pause", () => {
  const root = new THREE.Group(),
    pond = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshStandardMaterial());
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-23, 10, 52);
  pond.name = "hinterland_garden_koi_water";
  root.add(pond);
  const clock = { value: 0 },
    garden = bindWaterGarden(root, clock),
    fish = root.getObjectByName("Garden koi 1");
  const initial = fish.position.clone();
  clock.value = 3;
  garden.pose();
  assert.ok(initial.distanceTo(fish.position) > 0.1);
  const held = fish.position.clone();
  garden.pose();
  assert.ok(held.equals(fish.position));
  clock.value = 0;
  garden.pose();
  assert.ok(initial.distanceTo(fish.position) < 1e-9);
  garden.dispose();
  assert.ok(!root.getObjectByName("Garden koi"));
});
test("coastal settlement lights remain on land and the reserve stays dark", () => {
  let lit = 0;
  for (let x = -5000; x <= 5000; x += 200)
    for (let z = -3000; z <= 4000; z += 200) {
      const h = regionalHeight(x, z),
        l = regionalLights(x, z, h);
      assert.ok(l >= 0 && l <= 0.7);
      if (h < FAR_SEA_LEVEL || z < coastLine(x) + 38) assert.equal(l, 0);
      if (l > 0) lit++;
    }
  assert.ok(lit > 50);
  assert.equal(regionalLights(2000, 100, regionalHeight(2000, 100)), 0);
});
