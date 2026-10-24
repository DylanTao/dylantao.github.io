// Native delivered GLB triangles for collision/path acceptance. No WebGL renderer or substitute
// boxes: retain each authored node's transform, hierarchy, material and collision metadata.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as THREE from "../../assets/js/three.module.min.js";

const require = createRequire(import.meta.url);
const decoderModule = require("../../assets/js/vendor/three-r164/libs/draco/draco_wasm_wrapper.js");
let decoderReady;
function nativeDecoder() {
  return (decoderReady ??= new Promise((resolve) => {
    decoderModule({
      wasmBinary: readFileSync(new URL("../../assets/js/vendor/three-r164/libs/draco/draco_decoder.wasm", import.meta.url)),
      onModuleLoaded: resolve,
    });
  }));
}

export async function nativeGeometry(file, baseUrl = new URL("../../assets/models/home/", import.meta.url)) {
  const bytes = readFileSync(new URL(file, baseUrl)),
    length = bytes.readUInt32LE(12),
    doc = JSON.parse(bytes.subarray(20, 20 + length)),
    bin = bytes.subarray(28 + length),
    draco = await nativeDecoder();
  function accessor(id) {
    const a = doc.accessors[id],
      v = doc.bufferViews[a.bufferView];
    const Type = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[a.componentType];
    const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type],
      offset = bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0);
    if (v.byteStride && v.byteStride !== width * Type.BYTES_PER_ELEMENT) throw new Error("Interleaved native GLB accessor needs explicit decoding");
    return new Type(bin.buffer.slice(offset, offset + a.count * width * Type.BYTES_PER_ELEMENT));
  }
  function geometry(primitive) {
    const compression = primitive.extensions?.KHR_draco_mesh_compression;
    const geometry = new THREE.BufferGeometry();
    if (!compression) {
      geometry.setAttribute("position", new THREE.BufferAttribute(accessor(primitive.attributes.POSITION), 3));
      if (primitive.indices !== undefined) geometry.setIndex(new THREE.BufferAttribute(accessor(primitive.indices), 1));
      return geometry;
    }
    const view = doc.bufferViews[compression.bufferView],
      encoded = new Int8Array(bin.buffer, bin.byteOffset + (view.byteOffset || 0), view.byteLength),
      decoder = new draco.Decoder(),
      mesh = new draco.Mesh();
    try {
      if (!decoder.DecodeArrayToMesh(encoded, encoded.byteLength, mesh).ok()) throw new Error(`Cannot decode ${file}`);
      const attribute = decoder.GetAttributeByUniqueId(mesh, compression.attributes.POSITION),
        count = mesh.num_points() * 3,
        positionBytes = count * 4,
        indexCount = mesh.num_faces() * 3,
        indexBytes = indexCount * 4,
        pointer = draco._malloc(positionBytes + indexBytes);
      try {
        decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, draco.DT_FLOAT32, positionBytes, pointer);
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(draco.HEAPF32.buffer, pointer, count).slice(), 3));
        decoder.GetTrianglesUInt32Array(mesh, indexBytes, pointer + positionBytes);
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(draco.HEAPF32.buffer, pointer + positionBytes, indexCount).slice(), 1));
      } finally {
        draco._free(pointer);
      }
      return geometry;
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
    if (node.mesh !== undefined) {
      for (const [i, primitive] of doc.meshes[node.mesh].primitives.entries()) {
        const source = doc.materials?.[primitive.material] || {},
          material = new THREE.MeshStandardMaterial();
        material.name = source.name || "";
        material.opacity = source.pbrMetallicRoughness?.baseColorFactor?.[3] ?? 1;
        material.transparent = source.alphaMode === "BLEND";
        material.transmission = source.extensions?.KHR_materials_transmission?.transmissionFactor || 0;
        const mesh = new THREE.Mesh(geometry(primitive), material);
        mesh.name = `${group.name} primitive ${i}`;
        group.add(mesh);
      }
    }
    return group;
  });
  doc.nodes.forEach((node, i) => node.children?.forEach((child) => nodes[i].add(nodes[child])));
  const root = new THREE.Group();
  root.name = file;
  doc.scenes[doc.scene || 0].nodes.forEach((i) => root.add(nodes[i]));
  root.updateMatrixWorld(true);
  return root;
}
