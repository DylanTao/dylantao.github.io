import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createArtDirection } from "../assets/js/home-scene/materials.mjs";
import { createInfinityPool } from "../assets/js/home-scene/infinity-pool.mjs";

test("shared material updates preserve the pool's transmissive shader and no-shadow policy", () => {
  const world = new THREE.Group();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshPhysicalMaterial({ color: 0x88bbaa }));
  water.name = "core_infinity_water";
  world.add(water);
  const art = createArtDirection();
  art.apply(world, "realistic");
  const pool = createInfinityPool(world);
  const material = water.material,
    compile = material.onBeforeCompile;
  art.apply(world, "realistic");
  assert.equal(water.castShadow, false);
  assert.equal(water.material, material);
  assert.equal(water.material.onBeforeCompile, compile);
  assert.equal(water.material.transmission, 0.72);
  assert.equal(water.userData.noContactOcclusion, true);
  pool.dispose();
  art.dispose();
  water.geometry.dispose();
  water.material.dispose();
});

test("the rain height bound uses the actual pool AABB and leaves real triangle ownership to sample", () => {
  const world = new THREE.Group(),
    geometry = new THREE.PlaneGeometry(2, 4);
  geometry.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial());
  water.name = "core_infinity_water";
  water.position.y = -0.09;
  world.add(water);
  const pool = createInfinityPool(world),
    bound = pool.maximumRainHeightAt(0, 0);
  assert.equal(bound, pool.evidence().fixedWaterline);
  assert.ok(Math.abs(bound + 0.09) < 1e-7);
  assert.ok(pool.sample(0, 0));
  assert.equal(pool.maximumRainHeightAt(2, 0), null);
  assert.equal(pool.maximumRainHeightAt(0, 3), null);
  pool.dispose();
  geometry.dispose();
  water.material.dispose();
});
