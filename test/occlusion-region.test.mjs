import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createOcclusionRegion } from "../assets/js/home-scene/occlusion-region.mjs";

function compareSegments(mesh, bounds, segments) {
  const region = createOcclusionRegion([mesh], bounds),
    ray = new THREE.Raycaster();
  for (const [from, to] of segments) {
    const direction = to.clone().sub(from);
    ray.set(from, direction.clone().normalize());
    ray.far = direction.length();
    const original = ray.intersectObject(mesh, false),
      local = ray.intersectObjects(region.objects, false);
    assert.equal(local.length, original.length);
    local.forEach((hit, i) => assert.ok(Math.abs(hit.distance - original[i].distance) < 1e-8));
  }
  return region;
}

test("short rays retain exact indexed and nonindexed intersections under rotation and nonuniform scale", () => {
  for (const indexed of [true, false]) {
    let geometry = new THREE.PlaneGeometry(100, 100, 64, 64);
    if (!indexed) geometry = geometry.toNonIndexed();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.position.set(3, 2, -4);
    mesh.rotation.set(0.2, 0.6, -0.3);
    mesh.scale.set(2, 1, 0.7);
    mesh.updateMatrixWorld(true);
    const bounds = new THREE.Box3(new THREE.Vector3(-2, -2, -2), new THREE.Vector3(2, 2, 2)).applyMatrix4(mesh.matrixWorld),
      segments = [];
    for (let i = 0; i < 40; i++) {
      const x = Math.sin(i * 1.37),
        y = Math.cos(i * 0.87);
      segments.push([new THREE.Vector3(x, y, 1).applyMatrix4(mesh.matrixWorld), new THREE.Vector3(x, y, -1).applyMatrix4(mesh.matrixWorld)]);
    }
    const position = geometry.attributes.position,
      index = geometry.index,
      region = compareSegments(mesh, bounds, segments);
    assert.ok(region.evidence.retainedTriangles < region.evidence.sourceTriangles / 4);
    region.dispose();
    assert.equal(geometry.attributes.position, position);
    assert.equal(geometry.index, index);
    assert.equal(region.objects.length, 0);
  }
});

test("crossing faces are retained even when every vertex lies outside the query region", () => {
  const positions = [];
  for (let i = 0; i < 2100; i++) positions.push(-100, -100, 0, 100, -100, 0, 0, 100, 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })),
    bounds = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  mesh.updateMatrixWorld(true);
  const region = compareSegments(mesh, bounds, [[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)]]);
  assert.equal(region.evidence.retainedTriangles, 2100);
  region.dispose();
});

test("material sides, original groups and draw ranges keep Three's ray semantics", () => {
  const geometry = new THREE.PlaneGeometry(100, 100, 64, 64),
    count = geometry.index.count;
  geometry.clearGroups();
  geometry.addGroup(0, count / 2, 0);
  geometry.addGroup(count / 2, count / 2, 1);
  geometry.setDrawRange(300, count - 600);
  const mesh = new THREE.Mesh(geometry, [
      new THREE.MeshBasicMaterial({ side: THREE.FrontSide }),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide }),
    ]),
    bounds = new THREE.Box3(new THREE.Vector3(-2, -2, -2), new THREE.Vector3(2, 2, 2)),
    segments = [];
  mesh.updateMatrixWorld(true);
  for (const y of [-0.5, 0.5]) {
    segments.push([new THREE.Vector3(0.7, y, 1), new THREE.Vector3(0.7, y, -1)]);
    segments.push([new THREE.Vector3(0.7, y, -1), new THREE.Vector3(0.7, y, 1)]);
  }
  const region = compareSegments(mesh, bounds, segments);
  region.dispose();
});

test("ray layers and custom or instanced raycasts preserve their original hit semantics", () => {
  const geometry = new THREE.PlaneGeometry(100, 100, 64, 64),
    material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    bounds = new THREE.Box3(new THREE.Vector3(-2, -2, -2), new THREE.Vector3(2, 2, 2)),
    segment = [[new THREE.Vector3(0.7, 0.5, 1), new THREE.Vector3(0.7, 0.5, -1)]];
  const layered = new THREE.Mesh(geometry, material);
  layered.layers.set(1);
  layered.updateMatrixWorld(true);
  const layeredRegion = compareSegments(layered, bounds, segment);
  assert.equal(layeredRegion.objects[0].layers.mask, layered.layers.mask);
  layeredRegion.dispose();
  const custom = new THREE.Mesh(geometry, material);
  custom.raycast = () => {};
  const customRegion = compareSegments(custom, bounds, segment);
  assert.equal(customRegion.objects[0], custom);
  customRegion.dispose();
  const instanced = new THREE.InstancedMesh(geometry, material, 1);
  instanced.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, 0.5));
  instanced.updateMatrixWorld(true);
  const instancedRegion = compareSegments(instanced, bounds, segment);
  assert.equal(instancedRegion.objects[0], instanced);
  instancedRegion.dispose();
});
