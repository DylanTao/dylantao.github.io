import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createRainRoofField } from "../assets/js/home-scene/rain-roof-field.mjs";
import { rainSegment } from "../assets/js/home-scene/coastal-rain.mjs";

function fixture() {
  const root = new THREE.Group(),
    g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, 3, 0, 2, 5, 0, 0, 3, 2], 3));
  const roof = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
  roof.userData.caveRoof = true;
  root.add(roof);
  return { root, roof, field: createRainRoofField(root, 0.5) };
}
test("actual sloped triangles stop swept rain without a bounding-box umbrella", () => {
  const { roof, field } = fixture();
  roof.visible = false;
  assert.ok(Math.abs(field.height(0.5, 0.5) - 3.5) < 1e-7);
  assert.equal(field.height(1.8, 1.8), -Infinity);
  assert.ok(Math.abs(field.height(-0.1, 0.3, 2.1, 0.3) - 4.7) < 1e-6, "swept line crosses roof while both ends miss its triangle");
  assert.equal(field.evidence().triangles, 1);
  assert.equal(field.evidence().built, true);
  field.dispose();
});
test("roof clipping uses real world transforms and leaves roofless/dynamic meshes out", () => {
  const { root, roof } = fixture();
  root.position.set(10, 2, -5);
  roof.scale.set(2, 1, 2);
  const field = createRainRoofField(root);
  assert.ok(Math.abs(field.height(11, -4) - 5.5) < 1e-7);
  assert.equal(field.height(0, 0), -Infinity);
  const bare = new THREE.Group();
  bare.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  assert.equal(createRainRoofField(bare).height(0, 0), -Infinity);
});
test("wind-slanted line endpoints are clipped against their entire swept roof footprint", () => {
  const root = new THREE.Group(),
    roof = new THREE.Mesh(new THREE.BoxGeometry(40, 0.1, 40), new THREE.MeshBasicMaterial());
  roof.position.y = 8;
  roof.userData.caveRoof = true;
  root.add(roof);
  const field = createRainRoofField(root),
    wind = [2, 0, -1],
    query = (x, z, a, b) => field.height(x, z, a, b);
  for (let i = 0; i < 256; i++) {
    const s = rainSegment(i, 3, [0, 10, 0], wind, query);
    assert.ok(s[1] >= 8.075 - 1e-5 && s[4] >= 8.075 - 1e-5);
  }
});
