import * as THREE from "../../../assets/js/three.module.min.js";
import { createModelLoader } from "../../../assets/js/home-scene/model-loader.mjs";
const container = document.querySelector("#view");
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setSize(256, 256);
renderer.setPixelRatio(1);
renderer.setClearColor(0xe8e4dc, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
container.append(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 2.0));
const light = new THREE.DirectionalLight(0xffffff, 2.5);
light.position.set(-3, 5, 4);
scene.add(light);
const { loader, decoder } = createModelLoader();
const path = new URL("./data/source.glb", import.meta.url).href;
const model = (await loader.loadAsync(path)).scene;
scene.add(model);
model.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(model),
  center = box.getCenter(new THREE.Vector3()),
  extent = box.getSize(new THREE.Vector3()),
  scale = 2 / Math.max(extent.x, extent.y, extent.z);
model.position.sub(center);
model.scale.setScalar(scale);
model.position.multiplyScalar(scale);
model.updateMatrixWorld(true);
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 30);
function position(yaw, pitch) {
  const y = THREE.MathUtils.degToRad(yaw),
    p = THREE.MathUtils.degToRad(pitch),
    r = 4.4;
  camera.position.set(Math.sin(y) * Math.cos(p) * r, Math.sin(p) * r, Math.cos(y) * Math.cos(p) * r);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  renderer.render(scene, camera);
}
function capture(yaw, pitch, size = 64) {
  renderer.setSize(size, size);
  position(yaw, pitch);
  const gl = renderer.getContext(),
    pixels = new Uint8Array(size * size * 4);
  gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return {
    yaw,
    pitch,
    size,
    focal: size / (2 * Math.tan((35 * Math.PI) / 360)),
    worldToCamera: camera.matrixWorldInverse.toArray(),
    pixels: Array.from(pixels),
    camera: camera.position.toArray(),
  };
}
// Deterministic area-weighted samples from the actual transformed owned mesh.
function surface(count = 256) {
  const triangles = [];
  let area = 0;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    e = new THREE.Vector3(),
    f = new THREE.Vector3();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry,
      p = g.attributes.position,
      col = g.attributes.color,
      ix = g.index,
      material = Array.isArray(o.material) ? o.material[0] : o.material;
    const n = ix ? ix.count : p.count;
    for (let i = 0; i < n; i += 3) {
      const ids = [0, 1, 2].map((j) => (ix ? ix.getX(i + j) : i + j));
      a.fromBufferAttribute(p, ids[0]).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(p, ids[1]).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(p, ids[2]).applyMatrix4(o.matrixWorld);
      const ar = e.subVectors(b, a).cross(f.subVectors(c, a)).length() * 0.5;
      if (ar < 1e-9) continue;
      area += ar;
      triangles.push({
        area,
        points: [a.toArray(), b.toArray(), c.toArray()],
        colors: ids.map((id) => {
          const color = material.color.clone();
          if (col) color.multiply(new THREE.Color(col.getX(id), col.getY(id), col.getZ(id)));
          return color.convertLinearToSRGB().toArray();
        }),
      });
    }
  });
  let seed = 1701;
  const rand = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const samples = [];
  for (let i = 0; i < count; i++) {
    const target = ((i + 0.5) / count) * area,
      t = triangles.find((t) => t.area >= target);
    const r = Math.sqrt(rand()),
      q = rand(),
      w = [1 - r, r * (1 - q), r * q];
    samples.push({
      position: [0, 1, 2].map((k) => t.points.reduce((s, p, j) => s + p[k] * w[j], 0)),
      color: [0, 1, 2].map((k) => t.colors.reduce((s, p, j) => s + p[k] * w[j], 0)),
    });
  }
  return { samples, normalization: { center: center.toArray(), scale }, area };
}
position(20, 20);
window.objectFieldCapture = {
  capture,
  surface,
  renderer: () => {
    const g = renderer.getContext(),
      d = g.getExtension("WEBGL_debug_renderer_info");
    return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER);
  },
  setView: position,
  canvas: renderer.domElement,
  model,
  scene,
  camera,
  threeRenderer: renderer,
};
document.querySelector("#status").textContent = "Original source loaded.";
if (!new URLSearchParams(location.search).has("capture"))
  import("./gaussian.mjs").catch((error) => {
    document.querySelector("#status").textContent = "Trained decoder unavailable: " + error.message;
    console.error(error);
  });
