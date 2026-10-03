import * as THREE from "../three.module.min.js";

// The two intervals surround the nearest transmissive surface. Opaque depth
// includes the posed actor; transmission depth includes the displaced pool.
// This is a raster depth capture, not a ray-traced transparent scene graph.
export function createVolumeDepth(renderer, scene) {
  const make = () => {
    const target = new THREE.WebGLRenderTarget(1, 1);
    target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    target.depthTexture.minFilter = target.depthTexture.magFilter = THREE.NearestFilter;
    target.texture.generateMipmaps = false;
    return target;
  };
  const opaque = make(),
    transmission = make(),
    material = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking, side: THREE.DoubleSide });
  material.colorWrite = false;
  const saved = [],
    clear = new THREE.Color();
  let captures = 0;
  function capture(camera, target, transmissive) {
    const previousTarget = renderer.getRenderTarget(),
      override = scene.overrideMaterial,
      shadows = renderer.shadowMap.autoUpdate,
      autoClear = renderer.autoClear,
      alpha = renderer.getClearAlpha();
    renderer.getClearColor(clear);
    scene.overrideMaterial = null;
    renderer.shadowMap.autoUpdate = false;
    scene.traverse((object) => {
      if (!object.isMesh && !object.isPoints && !object.isLine) return;
      const materials = [object.material].flat(),
        hasTransmission = materials.some((m) => m.transmission > 0),
        skip =
          !object.isMesh ||
          object.userData.noVolumeDepth ||
          (!hasTransmission && materials.some((m) => !m.depthWrite || (m.transparent && m.opacity < 0.95)));
      saved.push([object, object.visible, object.material]);
      if (skip || hasTransmission !== transmissive) object.visible = false;
      else object.material = object.customDepthMaterial || material;
    });
    try {
      renderer.setRenderTarget(target);
      renderer.autoClear = false;
      renderer.setClearColor(0xffffff, 1);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
    } finally {
      for (const [object, visible, original] of saved) {
        object.visible = visible;
        object.material = original;
      }
      saved.length = 0;
      scene.overrideMaterial = override;
      renderer.shadowMap.autoUpdate = shadows;
      renderer.autoClear = autoClear;
      renderer.setClearColor(clear, alpha);
      renderer.setRenderTarget(previousTarget);
    }
  }
  return {
    resize(width, height) {
      opaque.setSize(width, height);
      transmission.setSize(width, height);
    },
    render(camera, volume) {
      capture(camera, opaque, false);
      capture(camera, transmission, true);
      volume.setDepth(opaque.depthTexture, transmission.depthTexture, camera);
      captures++;
    },
    evidence() {
      return { method: "opaque / nearest transmissive raster depth", width: opaque.width, height: opaque.height, captures, passes: 2 };
    },
    dispose() {
      opaque.dispose();
      transmission.dispose();
      material.dispose();
    },
  };
}
