import * as THREE from "../three.module.min.js";
import { createPoolImpact } from "./pool-impact.mjs";
import { createPoolSplash } from "./pool-splash.mjs";

const impactGLSL = `
uniform sampler2D infinityImpact;
uniform vec2 infinityMin;
uniform vec2 infinitySize;
vec3 infinityWave(vec2 p) {
  vec2 pixel=clamp((p-infinityMin)/infinitySize,vec2(0.),vec2(1.))*vec2(63.,31.);
  vec2 cell=floor(pixel), f=fract(pixel), uv=(cell+.5)/vec2(64.,32.);
  vec2 stepUV=1./vec2(64.,32.);
  return mix(mix(texture2D(infinityImpact,uv).xyz,texture2D(infinityImpact,uv+vec2(stepUV.x,0.)).xyz,f.x),
             mix(texture2D(infinityImpact,uv+vec2(0.,stepUV.y)).xyz,texture2D(infinityImpact,uv+stepUV).xyz,f.x),f.y);
}`;

// The authored basin is closed and supported by the terrace. This small normal field leaves its
// surveyed waterline fixed: it uses the same scene sun/moon and Pacific clock as the sea, while a
// sheltered pool has centimetre-scale ripples rather than the ocean's displacement spectrum.
export function createInfinityPool(root, { waterSky = () => null, requestFrame = () => {} } = {}) {
  const bound = [],
    time = { value: 0 };
  let water = null,
    bounds = null,
    waves = null,
    spray = null,
    texture = null,
    data = null,
    uniforms = null;
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 0.02),
    hits = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh || mesh.name !== "core_infinity_water") return;
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(mesh, true),
      size = box.getSize(new THREE.Vector3()),
      inverse = mesh.matrixWorld.clone().invert(),
      e = inverse.elements;
    if (!water && size.y < 0.002 && size.x > 1 && size.z > 1) {
      water = mesh;
      bounds = box;
      // The original native water grid remains the surface. Its actual triangles, not the
      // descriptor's rectangle, decide whether a walking visitor enters the pool.
      mesh.userData.walk = "through";
      waves = createPoolImpact({ width: size.x, length: size.z });
      data = new Float32Array(64 * 32 * 4);
      waves.writeSurface(data);
      texture = new THREE.DataTexture(data, 64, 32, THREE.RGBAFormat, THREE.FloatType);
      texture.minFilter = texture.magFilter = THREE.NearestFilter;
      texture.needsUpdate = true;
      uniforms = {
        infinityImpact: { value: texture },
        infinityMin: { value: new THREE.Vector2(box.min.x, box.min.z) },
        infinitySize: { value: new THREE.Vector2(size.x, size.z) },
        infinityLocalUp: { value: new THREE.Vector3(e[4], e[5], e[6]) },
      };
    }
    mesh.castShadow = false;
    // The pool owns its transmissive shader and shadow policy after prepareModel's initial finish.
    mesh.userData.fixedMaterial = true;
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
        if (waves) {
          Object.assign(shader.uniforms, uniforms);
          shader.vertexShader = impactGLSL + "\nuniform vec3 infinityLocalUp;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "vInfinityWorld = (modelMatrix * vec4(position, 1.)).xyz;",
            "vInfinityWorld = (modelMatrix * vec4(transformed, 1.)).xyz;\ntransformed += infinityLocalUp * infinityWave(vInfinityWorld.xz).x;"
          );
          shader.fragmentShader = impactGLSL + "\n" + shader.fragmentShader;
        }
        shader.fragmentShader = "uniform float infinityTime;\nvarying vec3 vInfinityWorld;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          vec2 p = vInfinityWorld.xz;
          vec2 slope = vec2(.044 * cos(p.x * 13. + p.y * 5. + infinityTime * .8),
                            .028 * cos(p.y * 17. - p.x * 4. - infinityTime * .65));
          ${waves ? "slope -= infinityWave(p).yz;" : ""}
          normal = normalize(normal + mat3(viewMatrix) * vec3(slope.x, 0., slope.y));`
        );
      };
      const key = material.customProgramCacheKey.bind(material);
      material.customProgramCacheKey = () => `${key()}:sheltered-infinity-v1${waves ? ":visitor-impact-v1" : ""}`;
      material.needsUpdate = true;
      bound.push(material);
    }
  });
  if (water)
    spray = createPoolSplash(root, bounds, {
      heightAt: (x, z) => waves.sample(x - (bounds.min.x + bounds.max.x) / 2, z - (bounds.min.z + bounds.max.z) / 2)[0],
    });
  function sample(x, z) {
    if (!water || x < bounds.min.x || x > bounds.max.x || z < bounds.min.z || z > bounds.max.z) return null;
    hits.length = 0;
    ray.ray.origin.set(x, bounds.max.y + 0.01, z);
    water.raycast(ray, hits);
    return hits.length ? { id: "infinity", y: bounds.max.y } : null;
  }
  return {
    sample,
    impact(event) {
      if (!sample(event.x, event.z) || !waves) return false;
      if (!waves.impact({ ...event, x: event.x - (bounds.min.x + bounds.max.x) / 2, z: event.z - (bounds.min.z + bounds.max.z) / 2 })) return false;
      spray.impact({ ...event, y: bounds.max.y });
      spray.advance(0);
      waves.writeSurface(data);
      texture.needsUpdate = true;
      requestFrame();
      return true;
    },
    update(seconds, { paused = false, delta = 0 } = {}) {
      if (!paused) time.value = seconds;
      if (!paused && (waves?.busy || spray?.busy)) {
        waves.advance(Math.max(0, delta));
        spray.advance(Math.max(0, delta));
        waves.writeSurface(data);
        texture.needsUpdate = true;
      }
      const light = waterSky();
      // Shared sun tint; the directional light itself supplies the sun/moon irradiance.
      if (light?.sunTint) for (const material of bound) material.specularColor.copy(light.sunTint);
    },
    get busy() {
      return Boolean(waves?.busy || spray?.busy);
    },
    evidence: () => ({
      surfaces: bound.length,
      fixedWaterline: bounds?.max.y ?? -0.09,
      amplitude: 0.004,
      seconds: time.value,
      sharedCoastalLight: true,
      impacts: waves?.evidence() ?? null,
      spray: spray?.evidence() ?? null,
    }),
    dispose() {
      spray?.dispose();
      texture?.dispose();
      bound.length = 0; // The shell owns and releases its materials.
    },
  };
}
