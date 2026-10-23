import * as THREE from "../three.module.min.js";
import { createArtDirection } from "./materials.mjs";

// A separate static-geometry illustration, never a replacement style for the active home.
export function captureInkStudy({ world, camera, sun, surfaceInk = true, width = 640, height = 540 }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfaf8f2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xaaa0a0, 1.4));
  const light = new THREE.DirectionalLight(0xfff0d5, 2.2);
  light.position.copy(sun.position);
  light.target.position.copy(sun.target.position);
  scene.add(light, light.target);
  const art = createArtDirection({ surfaceInk });
  let meshes = 0;
  world.updateMatrixWorld(true);
  world.traverse((source) => {
    if (!source.isMesh || source.isSkinnedMesh || source.userData.outline) return;
    for (let p = source; p; p = p.parent) if (!p.visible) return;
    const base = source.userData.baseMaterial || source.material;
    if ([base].flat().some((material) => !material?.color || material.transparent || material.opacity < 1)) return;
    const mesh = new THREE.Mesh(source.geometry, base);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(source.matrixWorld);
    scene.add(mesh);
    meshes++;
  });
  art.apply(scene, "illustrated");
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const view = camera.clone();
  if (view.isPerspectiveCamera) {
    view.aspect = width / height;
    view.updateProjectionMatrix();
  }
  const context = renderer.getContext();
  try {
    renderer.render(scene, view);
    context.finish(); // shader warmup is recorded separately
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      renderer.render(scene, view);
      context.finish();
      samples.push(performance.now() - start);
    }
    return {
      image: renderer.domElement.toDataURL("image/png"),
      evidence: {
        method: surfaceInk ? "authored world-space derivative-filtered hatching" : "existing screen-space hatching",
        staticGeometryOnly: true,
        meshes,
        width,
        height,
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        synchronizedDrawMs: samples,
        addedAssetBytes: 0,
        additionalRenderTargets: 0,
      },
    };
  } finally {
    const materials = new Set();
    scene.traverse((mesh) => {
      if (mesh.isMesh && !mesh.userData.outline) [mesh.material].flat().forEach((m) => materials.add(m));
    });
    materials.forEach((material) => material.dispose());
    art.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
