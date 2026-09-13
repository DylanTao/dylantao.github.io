import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SparkRenderer, imageSplats } from "@sparkjsdev/spark";

const view = document.querySelector("#view"),
  result = document.querySelector("#result");
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
view.append(renderer.domElement);
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("aria-label", "Depth study. Drag to orbit, scroll to zoom. Original view restores the camera.");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 50);
camera.position.set(0, 0, 3.0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 1.1;
controls.maxDistance = 6;
const spark = new SparkRenderer({ renderer });
scene.add(spark);
const roots = { layers: new THREE.Group(), mesh: new THREE.Group(), splats: new THREE.Group() };
Object.values(roots).forEach((root) => {
  root.visible = false;
  scene.add(root);
});
let mode = "layers",
  count = 0,
  auto = false,
  frames = 0,
  first = performance.now(),
  currentFps = 0;

// Three deliberate planes: distant sky/water, mid-distance coast, near plants.
function layerAt(u, v) {
  return v < 0.24 ? 2 : u < 0.65 && v < 0.55 - u * 0.12 ? 1 : 0;
}
function depthAt(u, v) {
  return layerAt(u, v) * 0.12 + (1 - v) * 0.03;
}
const url = new URL("../coastal-print.webp", import.meta.url).href;
const tex = await new THREE.TextureLoader().loadAsync(url);
tex.colorSpace = THREE.SRGBColorSpace;
const image = tex.image,
  aspect = image.width / image.height;
const canvas = document.createElement("canvas");
canvas.width = image.width;
canvas.height = image.height;
const ctx = canvas.getContext("2d", { willReadFrequently: true });
ctx.drawImage(image, 0, 0);
const original = ctx.getImageData(0, 0, image.width, image.height);
for (let layer = 0; layer < 3; layer++) {
  const pixels = new ImageData(new Uint8ClampedArray(original.data), image.width, image.height);
  for (let i = 0; i < pixels.data.length / 4; i++) {
    if (layerAt((i % image.width) / image.width, 1 - Math.floor(i / image.width) / image.height) !== layer) pixels.data[i * 4 + 3] = 0;
  }
  const c = document.createElement("canvas");
  c.width = image.width;
  c.height = image.height;
  c.getContext("2d").putImageData(pixels, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(aspect, 1),
    new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide, depthWrite: false })
  );
  panel.position.z = layer * 0.12;
  panel.renderOrder = layer;
  roots.layers.add(panel);
}
const geo = new THREE.PlaneGeometry(aspect, 1, 160, 80),
  positions = geo.attributes.position;
for (let i = 0; i < positions.count; i++) positions.setZ(i, depthAt(positions.getX(i) / aspect + 0.5, positions.getY(i) + 0.5));
geo.computeVertexNormals();
roots.mesh.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, alphaTest: 0.03 })));
const splats = imageSplats({
  url,
  subXY: 3,
  dotRadius: 0.75,
  forEachSplat(width, height, index, center, scales, quaternion, opacity) {
    if (opacity < 0.08) return null;
    count++;
    const u = (index % width) / width,
      v = 1 - Math.floor(index / width) / height;
    center.z = depthAt(u, v) * height;
    return opacity;
  },
});
roots.splats.add(splats);
await splats.initialized;
// imageSplats uses pixel units. Match the plane's one-unit image height.
splats.scale.setScalar(3 / image.height);

function choose(next) {
  mode = next;
  Object.entries(roots).forEach(([id, root]) => (root.visible = id === mode));
  document.querySelectorAll("[data-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
  document.body.dataset.mode = mode;
}
document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => choose(button.dataset.mode)));
document.querySelector("#depth").addEventListener("input", (e) => Object.values(roots).forEach((root) => (root.scale.z = Number(e.target.value))));
document.querySelector("#reset").addEventListener("click", () => {
  camera.position.set(0, 0, 3);
  controls.target.set(0, 0, 0);
  controls.update();
});
document.querySelector("#orbit").addEventListener("click", (e) => {
  auto = !auto;
  controls.autoRotate = auto;
  controls.autoRotateSpeed = 0.7;
  e.target.setAttribute("aria-pressed", String(auto));
});
new ResizeObserver(() => {
  const { width, height } = view.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}).observe(view);
choose(mode);
document.body.dataset.ready = "true";
renderer.setAnimationLoop(() => {
  if (document.hidden) return;
  controls.update();
  renderer.render(scene, camera);
  frames++;
  const now = performance.now();
  if (now - first > 1000) {
    currentFps = Math.round((frames * 1000) / (now - first));
    frames = 0;
    first = now;
    result.textContent = `${mode === "splats" ? count.toLocaleString() + " image-derived Gaussians" : mode === "mesh" ? "25,600 textured triangles" : "3 authored planes"} · ${currentFps} fps · drag beyond the original viewpoint to inspect gaps`;
  }
});
window.getSplatEvidence = () => ({ mode, splats: count, fps: currentFps, renderer: renderer.info.render, camera: camera.position.toArray() });
