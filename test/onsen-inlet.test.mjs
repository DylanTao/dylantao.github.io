import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createOnsenWater } from "../assets/js/home-scene/onsen-water.mjs";
import { measurePoolGeometry } from "../assets/js/home-scene/pool-geometry.mjs";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";

test("bamboo drops retain their outlet and world gravity through the room transform", () => {
  const root = new THREE.Group(),
    water = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial()),
    fixture = new THREE.Group();
  fixture.name = "onsen_decor_dry_bamboo";
  root.position.set(-7, 1.4, 8);
  root.rotation.y = 0.65;
  root.scale.set(1.1, 0.8, 0.9);
  root.add(water, fixture);
  root.updateMatrixWorld(true);
  const center = root.localToWorld(new THREE.Vector3(3.17, 3.0075, 3.18)),
    outlet = fixture.localToWorld(new THREE.Vector3(3.72, 3.28, 3.62)),
    pool = createOnsenWater({ center: [center.x, center.z], surfaceY: center.y }),
    volume = pool.evidence().volume;
  try {
    pool.bindMaterial(water.material, water);
    const inlet = root.getObjectByName("Onsen bamboo drip inlet"),
      drop = inlet.children[0];
    assert.ok(inlet.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(outlet.x, center.y, outlet.z)) < 1e-10);
    assert.ok(drop.getWorldPosition(new THREE.Vector3()).distanceTo(outlet) < 1e-10);
    pool.advance(0.1);
    const falling = drop.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(falling.x - outlet.x) < 1e-10 && Math.abs(falling.z - outlet.z) < 1e-10);
    assert.ok(falling.y < outlet.y && falling.y > center.y);
    pool.advance(0.15);
    assert.equal(pool.evidence().drip.drops, 1);
    assert.ok(pool.evidence().energy > 1e-5, "the transformed outlet must force wet basin cells");
    assert.ok(Math.abs(pool.evidence().volume - volume) < 1e-10);
  } finally {
    pool.dispose();
    water.geometry.dispose();
    water.material.dispose();
  }
});

test("the delivered translated bamboo outlet drives its measured native basin", async () => {
  const root = await nativeGeometry("room-onsen.glb");
  let water;
  root.traverse((part) => {
    if (part.isMesh && part.name.startsWith("onsen_water")) water = part;
  });
  const measured = measurePoolGeometry(water, root),
    pool = createOnsenWater(measured),
    material = new THREE.MeshStandardMaterial(),
    volume = pool.evidence().volume;
  try {
    pool.bindMaterial(material, water);
    const inlet = root.getObjectByName("Onsen bamboo drip inlet"),
      position = inlet.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.hypot(position.x - measured.center[0], position.z - measured.center[1]) < measured.radius);
    assert.ok(Math.abs(position.y - measured.surfaceY) < 1e-10);
    pool.advance(0.25);
    assert.equal(pool.evidence().drip.drops, 1);
    assert.ok(pool.evidence().energy > 1e-5, "native inlet transfers wave energy after the housing setback");
    assert.ok(Math.abs(pool.evidence().volume - volume) < 1e-10);
  } finally {
    pool.dispose();
    material.dispose();
    root.traverse((part) => part.geometry?.dispose());
  }
});

test("an unbound translated basin remains at equilibrium without manufactured drops", () => {
  const pool = createOnsenWater({ center: [17, 21], surfaceY: 7 }),
    before = pool.solver.state.h.slice();
  try {
    for (let i = 0; i < 120; i++) pool.advance(1 / 60);
    assert.deepEqual(pool.solver.state.h, before);
    assert.equal(pool.evidence().drip.bound, false);
    assert.equal(pool.evidence().drip.drops, 0);
    assert.ok(pool.evidence().energy < 1e-24);
  } finally {
    pool.dispose();
  }
});
