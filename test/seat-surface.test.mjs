import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { fitSeatToSurface } from "../assets/js/home-scene/seat-surface.mjs";

test("a tilted delivered seat lifts the complete contact witness patch above its high side", () => {
  const geometry = new THREE.PlaneGeometry(2, 2);
  geometry.rotateX(-Math.PI / 2);
  for (let i = 0; i < geometry.attributes.position.count; i++) geometry.attributes.position.setY(i, 2 + geometry.attributes.position.getX(i) * 0.15);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.name = "actual folded cover";
  const contact = { seatOffsetY: 0.5, contactCenterXZ: [0, 0], witnesses: [{ point: [-0.2, 0.5, 0] }, { point: [0.2, 0.5, 0] }] };
  const fit = fitSeatToSurface({ contact, seat: [0, 2, 0], meshes: [mesh] });
  assert.ok(Math.abs(fit.lift - 0.03) < 1e-6);
  assert.equal(fit.compression, 0);
  assert.ok(fit.samples.every((p) => p.clearance >= -1e-9));
  assert.ok(Math.min(...fit.samples.map((p) => p.clearance)) < 1e-9);
  assert.throws(() => fitSeatToSurface({ contact, seat: [4, 2, 0], meshes: [mesh] }), /extends beyond/);
});
