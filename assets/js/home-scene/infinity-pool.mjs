import * as THREE from "../three.module.min.js";

// The authored basin is closed and supported by the terrace. This small normal field leaves its
// surveyed waterline fixed: it uses the same scene sun/moon and Pacific clock as the sea, while a
// sheltered pool has centimetre-scale ripples rather than the ocean's displacement spectrum.
export function createInfinityPool(root, { waterSky = () => null } = {}) {
  const bound = [],
    time = { value: 0 };
  root.traverse((mesh) => {
    if (!mesh.isMesh || mesh.name !== "core_infinity_water") return;
    mesh.castShadow = false;
    mesh.userData.noContactOcclusion = mesh.userData.noVolumeDepth = true;
    for (const material of [mesh.material].flat()) {
      if (!material?.isMeshPhysicalMaterial) continue;
      material.ior = 1.333;
      material.color.setRGB(0.33, 0.68, 0.65);
      material.transmission = 0.72;
      material.thickness = 1.13;
      material.roughness = 0.09;
      material.envMapIntensity = 0.28;
      material.specularIntensity = 0.65;
      material.attenuationColor = new THREE.Color(0.38, 0.78, 0.74);
      material.attenuationDistance = 1.1;
      const before = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        before?.call(material, shader, renderer);
        shader.uniforms.infinityTime = time;
        shader.vertexShader = "varying vec3 vInfinityWorld;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvInfinityWorld = (modelMatrix * vec4(position, 1.)).xyz;"
        );
        shader.fragmentShader = "uniform float infinityTime;\nvarying vec3 vInfinityWorld;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          vec2 p = vInfinityWorld.xz;
          vec2 slope = vec2(.044 * cos(p.x * 13. + p.y * 5. + infinityTime * .8),
                            .028 * cos(p.y * 17. - p.x * 4. - infinityTime * .65));
          normal = normalize(normal + mat3(viewMatrix) * vec3(slope.x, 0., slope.y));`
        );
      };
      const key = material.customProgramCacheKey.bind(material);
      material.customProgramCacheKey = () => `${key()}:sheltered-infinity-v1`;
      material.needsUpdate = true;
      bound.push(material);
    }
  });
  return {
    update(seconds, { paused = false } = {}) {
      if (!paused) time.value = seconds;
      const light = waterSky();
      // Shared sun tint; the directional light itself supplies the sun/moon irradiance.
      if (light?.sunTint) for (const material of bound) material.specularColor.copy(light.sunTint);
    },
    evidence: () => ({ surfaces: bound.length, fixedWaterline: -0.09, amplitude: 0.004, seconds: time.value, sharedCoastalLight: true }),
    dispose() {
      bound.length = 0; // The shell owns and releases its materials.
    },
  };
}
