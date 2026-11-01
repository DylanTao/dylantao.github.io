import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { configureStaticTriangleIndices } from "../assets/js/home-scene/static-triangle-index.mjs";

test("site shader sources retain the index-independent contract", () => {
  const directory = new URL("../assets/js/home-scene/", import.meta.url);
  for (const file of readdirSync(directory, { recursive: true }).filter((name) => name.endsWith(".mjs"))) {
    const source = readFileSync(new URL(file.replaceAll("\\", "/"), directory), "utf8");
    assert.doesNotMatch(
      source,
      /\bgl_(?:VertexID|InstanceID|DrawID|PrimitiveID)\b/,
      `${file}: requalify static indices before adding index-dependent shaders`
    );
  }
});

function fixture() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1e-20, 1e-20, 0], 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Array(18).fill(1), 3));
  geometry.setIndex([0, 1, 2, 0, 1, 3, 0, 1, 4, 0, 1, 5]);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  return { mesh, geometry, apply: () => configureStaticTriangleIndices(mesh, "realistic", { indexIndependentShaders: true }) };
}

test("only complete duplicate inputs disappear; all other indices and every buffer are preserved", () => {
  const { mesh, geometry, apply } = fixture(),
    before = geometry.index.array.slice();
  assert.deepEqual(apply(), { removed: 1, sourceTriangles: 4, triangles: 3 });
  assert.deepEqual([...mesh.geometry.index.array], [0, 1, 3, 0, 1, 4, 0, 1, 5]);
  assert.deepEqual(geometry.index.array, before);
  for (const [name, attribute] of Object.entries(geometry.attributes)) assert.equal(mesh.geometry.attributes[name], attribute);
  assert.equal(mesh.geometry.index.count, 9);
});

test("UV, color, integer custom inputs and signed zero differences prevent removal", () => {
  for (const name of ["uv", "color", "custom", "signedZero"]) {
    const { geometry, mesh, apply } = fixture();
    const values =
      name === "custom" ? new Uint32Array([1, 1, 4294967295, 1, 1, 1]) : new Float32Array([0, 0, name === "signedZero" ? -0 : 1, 0, 0, 0]);
    geometry.setAttribute(name, new THREE.BufferAttribute(values, 1));
    assert.equal(apply(), null, name);
    assert.equal(mesh.geometry, geometry);
  }
});

test("nonfinite inputs, incomplete ranges, material groups, dynamic or deformable meshes stay intact", () => {
  const changes = [
    ({ geometry }) => geometry.attributes.position.setX(2, NaN),
    ({ geometry }) => geometry.setDrawRange(3, 9),
    ({ geometry }) => geometry.addGroup(0, 12, 0),
    ({ geometry }) => (geometry.morphAttributes.position = [geometry.attributes.position.clone()]),
    ({ mesh }) => (mesh.isSkinnedMesh = true),
    ({ mesh }) => (mesh.isInstancedMesh = true),
    ({ mesh }) => (mesh.isBatchedMesh = true),
    ({ mesh }) => (mesh.userData.dynamic = true),
    ({ mesh }) => (mesh.material.wireframe = true),
    ({ mesh }) => (mesh.material.transparent = true),
    ({ geometry }) => geometry.attributes.position.setUsage(THREE.DynamicDrawUsage),
  ];
  for (const change of changes) {
    const row = fixture();
    change(row);
    assert.equal(row.apply(), null);
    assert.equal(row.mesh.geometry, row.geometry);
  }
});

test("wireframe/other styles and unqualified callers recover the exact authored representation", () => {
  const { mesh, geometry, apply } = fixture();
  assert.equal(configureStaticTriangleIndices(mesh, "realistic"), null);
  apply();
  const filtered = mesh.geometry;
  configureStaticTriangleIndices(mesh, "illustrated", { indexIndependentShaders: true });
  assert.equal(mesh.geometry, geometry);
  apply();
  assert.equal(mesh.geometry, filtered);
  configureStaticTriangleIndices(mesh, "realistic");
  assert.equal(mesh.geometry, geometry);
});

test("either representation disposes both geometries exactly once", () => {
  for (const disposeOriginal of [true, false]) {
    const { mesh, geometry, apply } = fixture();
    apply();
    let a = 0,
      b = 0;
    geometry.addEventListener("dispose", () => a++);
    mesh.geometry.addEventListener("dispose", () => b++);
    (disposeOriginal ? geometry : mesh.geometry).dispose();
    assert.equal(a, 1);
    assert.equal(b, 1);
  }
});
