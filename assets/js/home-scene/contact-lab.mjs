import * as THREE from "../three.module.min.js";
import { createFinish, createLegacyFinish, finishPhysicalMaterial } from "./realism.mjs";

const views = [],
  result = document.querySelector("[data-result]");
let lighting = "both";
for (const container of document.querySelectorAll("[data-view]")) {
  const kind = container.dataset.view,
    renderer = new THREE.WebGLRenderer({ antialias: true }),
    scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(38, 1.2, 0.05, 20);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.background = new THREE.Color(0xeeede8);
  camera.position.set(2.6, 1.9, 3);
  camera.lookAt(0, 0.3, 0);
  const finish = kind === "previous" ? createLegacyFinish(renderer, scene, camera) : createFinish(renderer, scene, camera);
  const materials = [];
  function object(geometry, color, name, position) {
    const source = new THREE.MeshStandardMaterial({ name, color, roughness: 0.65 }),
      mesh = new THREE.Mesh(geometry, source);
    mesh.material = finishPhysicalMaterial(source, mesh, finish.contactLighting);
    source.dispose();
    materials.push(mesh.material);
    mesh.position.set(...position);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  object(new THREE.BoxGeometry(2.4, 0.1, 2.1), 0xdacbad, "pale oak", [0, -0.05, 0]);
  object(new THREE.BoxGeometry(2.4, 1.3, 0.08), 0xe8e3d4, "warm plaster", [0, 0.65, -1]);
  object(new THREE.BoxGeometry(0.08, 1.3, 2.1), 0xe8e3d4, "warm plaster", [-1.2, 0.65, 0]);
  object(new THREE.BoxGeometry(0.38, 0.01, 0.35), 0x815845, "wood block", [-0.58, 0.005, 0.44]);
  object(new THREE.CylinderGeometry(0.14, 0.12, 0.3, 40), 0xd3e0d5, "ceramic", [0.26, 0.15, 0.2]);
  object(new THREE.TorusGeometry(0.07, 0.021, 12, 32), 0xd3e0d5, "ceramic", [0.41, 0.19, 0.2]);
  object(new THREE.CylinderGeometry(0.118, 0.118, 0.003, 40), 0x493325, "coffee", [0.26, 0.301, 0.2]);
  object(new THREE.BoxGeometry(0.2, 0.56, 0.24), 0x445e58, "book cloth", [-0.5, 0.28, -0.82]);
  object(new THREE.BoxGeometry(0.19, 0.53, 0.25), 0xd7d5ca, "paper", [-0.71, 0.265, -0.82]);
  object(new THREE.SphereGeometry(0.19, 32, 24), 0x49635b, "sphere", [0.65, 0.19, -0.38]);
  const sun = new THREE.DirectionalLight(0xffe5bd, 3.5),
    ambient = new THREE.HemisphereLight(0xe2edfa, 0xd2b991, 2.8);
  sun.position.set(-0.6, 3.5, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 10 });
  sun.shadow.normalBias = 0.002;
  scene.add(sun, ambient);
  container.append(renderer.domElement);
  views.push({ kind, container, renderer, finish, camera, scene, sun, ambient, materials });
}

function render() {
  for (const view of views) {
    const { width, height } = view.container.getBoundingClientRect();
    view.renderer.setSize(width, height, false);
    view.finish.resize(width, height);
    view.camera.aspect = width / height;
    view.camera.updateProjectionMatrix();
    view.sun.intensity = lighting === "indirect" ? 0 : 3.5;
    view.ambient.intensity = lighting === "direct" ? 0 : 2.8;
    view.finish.render(view.camera, view.kind === "none");
  }
  result.textContent =
    lighting === "direct"
      ? "Sun only: the unshaded and horizon views should match. Contact AO must leave directly lit color unchanged."
      : "Ambient light: small contacts appear while pale corners retain diffuse reflected color. Every view uses identical geometry and camera.";
  document.body.dataset.ready = "true";
  window.getContactLabEvidence = () => ({ lighting, views: views.map((view) => ({ kind: view.kind, rendering: view.finish.evidence })) });
}
document.querySelectorAll("[data-lighting]").forEach((button) => {
  button.addEventListener("click", () => {
    lighting = button.dataset.lighting;
    document.querySelectorAll("[data-lighting]").forEach((control) => control.setAttribute("aria-pressed", String(control === button)));
    render();
  });
});
const resize = new ResizeObserver(render);
views.forEach((view) => resize.observe(view.container));
render();
window.addEventListener(
  "pagehide",
  () => {
    resize.disconnect();
    views.forEach((view) => {
      view.finish.dispose();
      view.scene.traverse((object) => object.geometry?.dispose());
      view.materials.forEach((material) => material.dispose());
      view.renderer.dispose();
    });
    delete window.getContactLabEvidence;
  },
  { once: true }
);
