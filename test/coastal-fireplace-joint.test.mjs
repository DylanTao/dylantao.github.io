import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as THREE from "../assets/js/three.module.min.js";

const modelUrl = new URL("../assets/models/home/", import.meta.url),
  manifest = JSON.parse(readFileSync(new URL("manifest.json", modelUrl))),
  index = JSON.parse(readFileSync(new URL("furniture/index.json", modelUrl))),
  anchor = manifest.furniture.find((item) => item.id === "living-fireplace"),
  item = index.items[anchor.item],
  room = manifest.rooms.find((entry) => entry.id === anchor.room),
  tolerance = 0.0003;

const require = createRequire(import.meta.url),
  decoderModule = require("../assets/js/vendor/three-r164/libs/draco/draco_wasm_wrapper.js"),
  draco = await new Promise((resolve) => {
    decoderModule({
      wasmBinary: readFileSync(new URL("../assets/js/vendor/three-r164/libs/draco/draco_decoder.wasm", import.meta.url)),
      onModuleLoaded: resolve,
    });
  });

// Decode the delivered position data and retain every ancestor transform. Accessor bounds or
// manifest fireplace.flueStart alone missed the gap between these independently exported assets.
function deliveredMesh(file, name) {
  const bytes = readFileSync(new URL(file, modelUrl)),
    jsonLength = bytes.readUInt32LE(12),
    doc = JSON.parse(bytes.subarray(20, 20 + jsonLength)),
    bin = bytes.subarray(28 + jsonLength);

  function positions(primitive) {
    const compression = primitive.extensions.KHR_draco_mesh_compression,
      view = doc.bufferViews[compression.bufferView],
      encoded = new Int8Array(bin.buffer, bin.byteOffset + (view.byteOffset || 0), view.byteLength),
      decoder = new draco.Decoder(),
      mesh = new draco.Mesh();
    try {
      assert.ok(decoder.DecodeArrayToMesh(encoded, encoded.byteLength, mesh).ok(), `${file}: Draco decode`);
      const attribute = decoder.GetAttributeByUniqueId(mesh, compression.attributes.POSITION),
        count = mesh.num_points() * 3,
        byteLength = count * 4,
        pointer = draco._malloc(byteLength);
      try {
        decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, draco.DT_FLOAT32, byteLength, pointer);
        return new Float32Array(draco.HEAPF32.buffer, pointer, count).slice();
      } finally {
        draco._free(pointer);
      }
    } finally {
      draco.destroy(mesh);
      draco.destroy(decoder);
    }
  }

  const selected = [],
    nodes = doc.nodes.map((node) => {
      const group = new THREE.Group();
      if (node.matrix) new THREE.Matrix4().fromArray(node.matrix).decompose(group.position, group.quaternion, group.scale);
      else {
        if (node.translation) group.position.fromArray(node.translation);
        if (node.rotation) group.quaternion.fromArray(node.rotation);
        if (node.scale) group.scale.fromArray(node.scale);
      }
      if (node.name === name) {
        assert.ok(Number.isInteger(node.mesh), `${file}: ${name} has a mesh`);
        for (const primitive of doc.meshes[node.mesh].primitives) selected.push({ group, positions: positions(primitive) });
      }
      return group;
    });
  doc.nodes.forEach((node, i) => node.children?.forEach((child) => nodes[i].add(nodes[child])));
  const root = new THREE.Group();
  doc.scenes[doc.scene || 0].nodes.forEach((i) => root.add(nodes[i]));
  assert.ok(selected.length > 0, `${file}: find ${name}`);

  return {
    root,
    vertices() {
      root.updateWorldMatrix(true, true);
      return selected.flatMap(({ group, positions }) => {
        const vertices = [];
        for (let i = 0; i < positions.length; i += 3) {
          vertices.push(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]).applyMatrix4(group.matrixWorld));
        }
        return vertices;
      });
    },
  };
}

function endRing(vertices, end) {
  const y = end === "bottom" ? Math.min(...vertices.map((p) => p.y)) : Math.max(...vertices.map((p) => p.y)),
    ring = vertices.filter((p) => Math.abs(p.y - y) <= tolerance),
    x = (Math.min(...ring.map((p) => p.x)) + Math.max(...ring.map((p) => p.x))) / 2,
    z = (Math.min(...ring.map((p) => p.z)) + Math.max(...ring.map((p) => p.z))) / 2;
  assert.ok(ring.length >= 16, `${end} must be a circular flue rim, rather than an isolated highest/lowest vertex`);
  return { y, x, z, radii: ring.map((p) => Math.hypot(p.x - x, p.z - z)) };
}

const lounge = deliveredMesh(room.file, "lounge__blackened steel flue"),
  houseRim = endRing(lounge.vertices(), "bottom");

test("fireplace index records the extended 2.20 m local flue height", () => {
  assert.equal(item.bounds.max[1], 2.2);
  assert.equal(item.lods.length, 2, "default and fine exports both require joint coverage");
});

for (const lod of item.lods) {
  test(`${lod.file} meets the delivered lounge flue at the placed world-space joint`, (t) => {
    const level = /-lod(\d+)\.glb$/.exec(lod.file)?.[1];
    assert.ok(level, `recognize the delivered level: ${lod.file}`);
    const fireplace = deliveredMesh(`furniture/${lod.file}`, `floating-fireplace.lod${level}__fireplace graphite`),
      placement = new THREE.Group();
    // Match furniture.mjs: the manifest anchor is in world space, converted through its room root.
    lounge.root.updateWorldMatrix(true, false);
    placement.position.copy(lounge.root.worldToLocal(new THREE.Vector3(...anchor.position)));
    placement.rotation.y = anchor.yaw;
    lounge.root.add(placement);
    placement.add(fireplace.root);
    const furnitureRim = endRing(fireplace.vertices(), "top"),
      gap = houseRim.y - furnitureRim.y,
      axisError = Math.hypot(houseRim.x - furnitureRim.x, houseRim.z - furnitureRim.z);

    t.diagnostic(`joint gap ${gap * 1000} mm; axis error ${axisError * 1000} mm`);
    assert.ok(Math.abs(gap) <= tolerance, `flue ends must touch within Draco quantization; gap is ${gap} m`);
    assert.ok(axisError <= tolerance, `flue axes must coincide; centre error is ${axisError} m`);
    for (const [name, rim] of [
      ["house", houseRim],
      ["furniture", furnitureRim],
    ]) {
      assert.ok(
        rim.radii.every((radius) => Math.abs(radius - manifest.fireplace.flueRadius) <= tolerance),
        `${name} joint rim must retain the shared 0.10 m radius`
      );
    }
    assert.ok(Math.hypot(houseRim.x - anchor.position[0], houseRim.z - anchor.position[2]) <= tolerance);
    assert.ok(Math.abs(item.bounds.max[1] + anchor.position[1] - furnitureRim.y) <= tolerance, "index bounds match delivered top");
    placement.removeFromParent();
  });
}
