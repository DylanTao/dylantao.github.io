import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { measurePoolGeometry } from "../assets/js/home-scene/pool-geometry.mjs";

function bath() {
  const root = new THREE.Group(),
    water = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.015, 96), new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.8 })),
    bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.1, 32), new THREE.MeshStandardMaterial());
  water.position.y = 0.4075;
  bottom.position.y = 0.23;
  root.position.set(3.17, 2.6, 3.18);
  root.rotation.y = 0.7;
  root.add(water, bottom);
  return { root, water, bottom };
}

test("bath depth follows actual world-space bottom, not illustrative solver thickness", () => {
  const { root, water } = bath(),
    measured = measurePoolGeometry(water, root);
  assert.ok(Math.abs(measured.surfaceY - 3.015) < 1e-6);
  assert.ok(Math.abs(measured.bottomY - 2.88) < 1e-6);
  assert.ok(Math.abs(measured.depth - 0.135) < 1e-6);
  assert.ok(Math.abs(measured.radius - 0.86) < 0.002);
  assert.equal(measured.depthSource, "five native basin ray hits");
});

test("missing or nonflat receiver reports authored fallback instead of claiming measurement", () => {
  const { root, water, bottom } = bath();
  bottom.rotation.z = 0.2;
  assert.match(measurePoolGeometry(water, root).depthSource, /fallback/);
  bottom.visible = false;
  const missing = measurePoolGeometry(water, root);
  assert.equal(missing.depth, 0.24);
  assert.equal(missing.bottomY, null);
});
