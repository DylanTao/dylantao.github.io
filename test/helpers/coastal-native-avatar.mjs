// Actual delivered avatar skins and clips through the pinned GLTF parser and CPU Draco decoder.
// This helper creates no renderer/browser and keeps skin attributes, morphs and bone bindings.
import fs from "node:fs";
import { createRequire } from "node:module";
import { PNG } from "pngjs";
import { nativeDetailFor } from "./coastal-native-geometry.mjs";
import * as THREE from "../../assets/js/three.module.min.js";
import { GLTFLoader } from "../../assets/js/vendor/three-r164/loaders/GLTFLoader.js";
export { THREE };
export const repo = new URL("../../", import.meta.url);
const require = createRequire(import.meta.url);
let decoderPromise;
async function decoderModule() {
  decoderPromise ||= require("../../assets/js/vendor/three-r164/libs/draco/draco_wasm_wrapper.js")({
    wasmBinary: fs.readFileSync(new URL("assets/js/vendor/three-r164/libs/draco/draco_decoder.wasm", repo)),
  });
  return decoderPromise;
}

export async function loadNativeModel(file, baseUrl = new URL("assets/models/home/", repo)) {
  const d = await decoderModule();
  const kinds = Object.fromEntries(
    [
      ["Float32Array", "FLOAT32"],
      ["Float64Array", "FLOAT64"],
      ["Uint8Array", "UINT8"],
      ["Int8Array", "INT8"],
      ["Uint16Array", "UINT16"],
      ["Int16Array", "INT16"],
      ["Uint32Array", "UINT32"],
      ["Int32Array", "INT32"],
    ].map(([name, kind]) => [name, d[`DT_${kind}`]])
  );
  const decoder = {
    preload() {},
    decodeDracoFile(buffer, callback, ids, types, space, onError) {
      const dec = new d.Decoder(),
        mesh = new d.Mesh();
      try {
        const bytes = new Int8Array(buffer),
          status = dec.DecodeArrayToMesh(bytes, bytes.byteLength, mesh);
        if (!status.ok()) throw Error(status.error_msg());
        const geometry = new THREE.BufferGeometry();
        for (const [name, id] of Object.entries(ids)) {
          const attribute = dec.GetAttributeByUniqueId(mesh, id),
            C = globalThis[types[name]],
            count = mesh.num_points() * attribute.num_components(),
            length = count * C.BYTES_PER_ELEMENT,
            pointer = d._malloc(length);
          try {
            dec.GetAttributeDataArrayForAllPoints(mesh, attribute, kinds[types[name]], length, pointer);
            geometry.setAttribute(name, new THREE.BufferAttribute(new C(d.HEAPF32.buffer, pointer, count).slice(), attribute.num_components()));
          } finally {
            d._free(pointer);
          }
        }
        const count = mesh.num_faces() * 3,
          pointer = d._malloc(count * 4);
        try {
          dec.GetTrianglesUInt32Array(mesh, count * 4, pointer);
          geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(d.HEAPF32.buffer, pointer, count).slice(), 1));
        } finally {
          d._free(pointer);
        }
        callback(geometry);
      } catch (error) {
        onError(error);
      } finally {
        d.destroy(mesh);
        d.destroy(dec);
      }
    },
  };
  const bytes = fs.readFileSync(new URL(file, baseUrl));
  const loader = new GLTFLoader().setDRACOLoader(decoder);
  // Decode the target turf pixels in Node. Other embedded image payloads are
  // represented by their concrete MIME type and byte length for CPU geometry
  // checks. The browser exercises their actual pixels and sampler settings.
  loader.register((parser) => {
    const original = parser.loadImageSource.bind(parser);
    parser.loadImageSource = (index, imageLoader) => {
      const image = parser.json.images[index];
      if (image.bufferView === undefined || !["image/png", "image/jpeg"].includes(image.mimeType)) return original(index, imageLoader);
      return parser.getDependency("bufferView", image.bufferView).then((buffer) => {
        if (image.mimeType === "image/jpeg") {
          const texture = new THREE.Texture();
          texture.userData = { mimeType: image.mimeType, encodedBytes: buffer.byteLength };
          return texture;
        }
        const { data, width, height } = PNG.sync.read(Buffer.from(buffer));
        const texture = new THREE.DataTexture(data, width, height);
        texture.userData.mimeType = image.mimeType;
        texture.needsUpdate = true;
        return texture;
      });
    };
    return { name: "NodeEmbeddedImages" };
  });
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), baseUrl.href);
}

export async function loadNativeHouseModel(file, manifest, baseUrl = new URL("assets/models/home/", repo)) {
  const model = await loadNativeModel(file, baseUrl);
  const parts = nativeDetailFor(file, manifest);
  const roots = await Promise.all(
    parts.map(async (entry) => {
      const { scene } = await loadNativeModel(entry.file, baseUrl);
      if (entry.members) {
        const names = new Set(entry.members.map(THREE.PropertyBinding.sanitizeNodeName));
        const carriers = [];
        scene.traverse((mesh) => {
          if (!mesh.isMesh) return;
          for (let node = mesh; node && node !== scene; node = node.parent) if (names.has(node.name)) return;
          carriers.push(mesh);
        });
        carriers.forEach((carrier) => carrier.removeFromParent());
      }
      return scene;
    })
  );
  if (roots.length) model.scene.add(...roots);
  return model;
}

export async function loadNativeAvatar(id) {
  return loadNativeModel(`sirui-${id}.glb`);
}
