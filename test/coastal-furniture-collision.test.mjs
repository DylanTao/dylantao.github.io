import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as THREE from "../assets/js/three.module.min.js";
import { createFurniture } from "../assets/js/home-scene/furniture.mjs";
import { collidable } from "../assets/js/home-scene/camera-field.mjs";
import { createWalkField, walkKind } from "../assets/js/home-scene/colliders.mjs";

const manifest = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
const require = createRequire(import.meta.url);
const decoderModule = require("../assets/js/vendor/three-r164/libs/draco/draco_wasm_wrapper.js");
const { draco } = await new Promise((resolve) => {
  decoderModule({
    wasmBinary: readFileSync(new URL("../assets/js/vendor/three-r164/libs/draco/draco_decoder.wasm", import.meta.url)),
    onModuleLoaded: (draco) => resolve({ draco }),
  });
});

// Read the delivered placeholder triangles and their real hierarchy. Textures and the other room
// meshes are unnecessary for checking which furniture geometry feeds the two static fields.
function nativePlaceholders(file) {
  const bytes = readFileSync(new URL(`../assets/models/home/${file}`, import.meta.url)),
    length = bytes.readUInt32LE(12),
    doc = JSON.parse(bytes.subarray(20, 20 + length)),
    bin = bytes.subarray(28 + length);
  function geometry(primitive) {
    const compression = primitive.extensions.KHR_draco_mesh_compression,
      view = doc.bufferViews[compression.bufferView],
      bytes = new Int8Array(bin.buffer, bin.byteOffset + (view.byteOffset || 0), view.byteLength),
      decoder = new draco.Decoder(),
      mesh = new draco.Mesh();
    try {
      assert.ok(decoder.DecodeArrayToMesh(bytes, bytes.byteLength, mesh).ok());
      const attribute = decoder.GetAttributeByUniqueId(mesh, compression.attributes.POSITION),
        count = mesh.num_points() * 3,
        positionBytes = count * 4,
        indexCount = mesh.num_faces() * 3,
        indexBytes = indexCount * 4,
        pointer = draco._malloc(positionBytes + indexBytes);
      try {
        decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, draco.DT_FLOAT32, positionBytes, pointer);
        const positions = new Float32Array(draco.HEAPF32.buffer, pointer, count).slice();
        decoder.GetTrianglesUInt32Array(mesh, indexBytes, pointer + positionBytes);
        const indices = new Uint32Array(draco.HEAPF32.buffer, pointer + positionBytes, indexCount).slice();
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        return geometry;
      } finally {
        draco._free(pointer);
      }
    } finally {
      draco.destroy(mesh);
      draco.destroy(decoder);
    }
  }
  const nodes = doc.nodes.map((node) => {
    const group = new THREE.Group();
    group.name = node.name || "";
    group.userData = { ...node.extras };
    if (node.matrix) new THREE.Matrix4().fromArray(node.matrix).decompose(group.position, group.quaternion, group.scale);
    else {
      if (node.translation) group.position.fromArray(node.translation);
      if (node.rotation) group.quaternion.fromArray(node.rotation);
      if (node.scale) group.scale.fromArray(node.scale);
    }
    if (node.extras?.furniturePlaceholder) {
      for (const [i, primitive] of doc.meshes[node.mesh].primitives.entries()) {
        const mesh = new THREE.Mesh(geometry(primitive), new THREE.MeshStandardMaterial());
        mesh.name = `${group.name} primitive ${i}`;
        group.add(mesh);
      }
    }
    return group;
  });
  doc.nodes.forEach((node, i) => node.children?.forEach((child) => nodes[i].add(nodes[child])));
  const root = new THREE.Group();
  doc.scenes[doc.scene || 0].nodes.forEach((i) => root.add(nodes[i]));
  return root;
}

function eligible(root, accept) {
  const result = [];
  root.traverse((o) => {
    if (accept(o, root)) result.push(o);
  });
  return result;
}

test("delivered placeholders supply identical collision before index arrival and after visual hiding", async () => {
  const world = new THREE.Group(),
    roots = new Map(),
    furniture = createFurniture({
      config: manifest,
      baseUrl: "https://example.test/assets/models/home/manifest.json",
      fetchIndex: () => new Promise(() => {}),
      loadModel: () => assert.fail("the proxy contract must not wait for a model or the index"),
    });
  for (const room of manifest.rooms.filter((r) => manifest.furniture.some((a) => a.room === r.id))) {
    const root = nativePlaceholders(room.file);
    roots.set(room.id, root);
    world.add(root);
    await furniture.attach(room.id, root, null);
  }
  const proxies = [];
  world.traverse((o) => {
    if (o.userData.furniturePlaceholder) proxies.push(o);
  });
  assert.equal(proxies.length, manifest.furniture.length);
  const staticProxies = proxies.filter((o) => o.userData.furnitureCollision);
  // Sixteen static pieces, including the nook banquette and the living's cloud sofa (October 24).
  assert.equal(staticProxies.length, 16);
  for (const object of proxies) {
    const anchor = manifest.furniture.find((a) => a.id === object.userData.furniturePlaceholder),
      movable = Boolean(anchor.activityProp) || ["cast-iron-pan", "dumbbell"].includes(anchor.item);
    object.traverse((mesh) => {
      if (!mesh.isMesh) return;
      assert.equal(walkKind(mesh, world), movable ? null : "solid", anchor.id);
      assert.equal(collidable(mesh, world), !movable, anchor.id);
    });
  }
  const beforeWalk = eligible(world, walkKind),
    beforeCamera = eligible(world, collidable);
  for (const object of proxies) object.visible = false;
  // A later visual level can be much more detailed without entering either frozen static field.
  const visual = new THREE.Group();
  visual.userData.furnitureAnchor = "dining-chair-1";
  visual.add(new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshStandardMaterial()));
  roots.get("kitchen").add(visual);
  assert.deepEqual(eligible(world, walkKind), beforeWalk);
  assert.deepEqual(eligible(world, collidable), beforeCamera);
  // Hiding a whole room remains different from hiding just its replacement placeholders.
  roots.get("kitchen").visible = false;
  assert.equal(eligible(roots.get("kitchen"), (o) => walkKind(o, world)).length, 0);
  roots.get("kitchen").visible = true;

  // Walk the delivered kitchen proxies, rather than replacing chairs with full-height boxes.
  const setback = manifest.retreat?.setbackMetres || 0;
  const field = createWalkField({ min: [-5, -1, 1 + setback], max: [0, 4, 5 + setback] }),
    floor = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 4));
  floor.position.set(-2.5, -0.05, 3 + setback);
  world.add(floor);
  world.updateMatrixWorld(true);
  for (const mesh of [floor, ...beforeWalk.filter((o) => roots.get("kitchen").getObjectById(o.id))]) {
    field.addGeometry({
      positions: mesh.geometry.attributes.position.array,
      index: mesh.geometry.index?.array || null,
      matrix: mesh.matrixWorld.elements,
    });
  }
  assert.ok(Number.isNaN(field.standAt(-1.85, 3.05 + setback, 0)), "the real dining tabletop blocks passage");
  const seat = field.standAt(-2.6, 3.82 + setback, 0);
  assert.ok(seat > 0.43 && seat < 0.47, `the authored chair seat stays accessible at ${seat}`);
  const aisle = field.move(-3.6, 4.6 + setback, 0, 3.2, 0);
  assert.ok(!aisle.blocked && aisle.x > -0.41, "the capsule can pass close behind the chairs");
  furniture.dispose();
});
