import * as THREE from "../three.module.min.js";
import { COASTAL_SURF } from "./coastal-surf.mjs";

export const coastalSurfGLSL = `
uniform sampler2D surfAtlas, surfLine;
uniform vec4 surfBounds, surfPool[4];
uniform vec2 surfSize;
uniform float surfEnabled;
uniform int surfPoolCount;
bool coastalPool(vec2 p) {
  for (int i=0; i<surfPoolCount; i++) {
    vec2 offset=(p-surfPool[i].xy)/surfPool[i].zw;
    if (dot(offset,offset)<=1.) return true;
  }
  return false;
}
vec4 coastalSurfAt(vec2 p, out float weight) {
  weight=0.;
  if(surfEnabled<.5||p.x<surfBounds.x||p.x>surfBounds.y) return vec4(0.);
  float along=(p.x-surfBounds.x)/(surfBounds.y-surfBounds.x);
  float lane=(.5+along*(surfSize.x-1.))/surfSize.x;
  float s=p.y-texture2D(surfLine,vec2(lane,.5)).r;
  if (s<surfBounds.z||s>surfBounds.w) return vec4(0.);
  float cross=(s-surfBounds.z)/(surfBounds.w-surfBounds.z);
  float row=(.5+cross*(surfSize.y-1.))/surfSize.y;
  weight=smoothstep(surfBounds.z,surfBounds.z+2.2,s)*smoothstep(0.,3.4,min(p.x-surfBounds.x,surfBounds.y-p.x));
  return texture2D(surfAtlas,vec2(row,lane));
}
`;

// The same wet substrate and bubble breakup used by the water and exposed sand.
export const coastalSurfAppearanceGLSL = `
float coastalFoamHash(vec2 p) {
  vec3 q=fract(vec3(p.xyx)*.1031);
  q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
}
float coastalFoamNoise(vec2 p) {
  vec2 i=floor(p), f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(coastalFoamHash(i),coastalFoamHash(i+vec2(1.,0.)),f.x),
             mix(coastalFoamHash(i+vec2(0.,1.)),coastalFoamHash(i+vec2(1.,1.)),f.x),f.y);
}
float coastalBubbleCover(vec2 p, float mass, float footprint) {
  float patches=coastalFoamNoise(p*vec2(4.2,9.));
  float cells=mix(coastalFoamNoise(p*vec2(17.,28.)+14.),.5,smoothstep(.018,.075,footprint));
  float porosity=smoothstep(.30,.68,.64*patches+.36*cells+.24*mass);
  float packed=mix(.50,.84,smoothstep(.15,.68,mass));
  return smoothstep(.009,.40,mass)*mix(packed,1.,porosity);
}
vec3 coastalWetSand(float wet) {
  return mix(vec3(1.),vec3(.66,.73,.77),clamp(wet,0.,1.));
}
float coastalCausticContrast(float depth, float bubbles, float weight) {
  // A water film has little focal distance. Aerated run-up scatters the remaining focused light.
  float film=smoothstep(.105,.53,depth);
  float clear=1.-.75*smoothstep(.012,.29,bubbles);
  return mix(1.,film*clear,weight);
}
`;

export function createSurfMaterials(surf, pools) {
  const packed = new Uint16Array(surf.atlas.length);
  const lineData = new Uint16Array(surf.lanes);
  const line = new THREE.DataTexture(lineData, surf.lanes, 1, THREE.RedFormat, THREE.HalfFloatType);
  const atlas = new THREE.DataTexture(packed, surf.cells, surf.lanes, THREE.RGBAFormat, THREE.HalfFloatType);
  for (const texture of [line, atlas]) texture.magFilter = texture.minFilter = THREE.LinearFilter;
  const poolData = Array.from({ length: 4 }, (_, i) => {
    const p = pools[i];
    return p ? new THREE.Vector4(p.center[0], p.center[2], p.radii[0] + 0.06, p.radii[1] + 0.06) : new THREE.Vector4();
  });
  const { minX, maxX, minS, maxS } = surf.bounds;
  const uniforms = {
    surfAtlas: { value: atlas },
    surfLine: { value: line },
    surfBounds: { value: new THREE.Vector4(minX, maxX, minS, maxS) },
    surfSize: { value: new THREE.Vector2(surf.lanes, surf.cells) },
    surfEnabled: { value: 0 },
    surfPool: { value: poolData },
    surfPoolCount: { value: Math.min(pools.length, poolData.length) },
  };
  const sand = new WeakSet();
  function upload(rebuilt = false) {
    for (let i = 0; i < packed.length; i++) packed[i] = THREE.DataUtils.toHalfFloat(surf.atlas[i]);
    atlas.needsUpdate = true;
    if (rebuilt) {
      for (let i = 0; i < lineData.length; i++) lineData[i] = THREE.DataUtils.toHalfFloat(surf.lines[i]);
      line.needsUpdate = true;
      uniforms.surfEnabled.value = 1;
    }
  }
  function paintSand(material) {
    if (sand.has(material)) return;
    sand.add(material);
    const compile = material.onBeforeCompile;
    const key = material.customProgramCacheKey.call(material);
    material.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = "varying vec2 vCoastalSand;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        "vCoastalSand=(modelMatrix*vec4(transformed,1.)).xz;\n#include <project_vertex>"
      );
      shader.fragmentShader = "varying vec2 vCoastalSand;\n" + coastalSurfGLSL + coastalSurfAppearanceGLSL + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float sandWaveWeight;
        vec4 sandWave=coastalSurfAt(vCoastalSand,sandWaveWeight);
        float sandWet=sandWave.a*sandWaveWeight;
        float sandFootprint=max(length(dFdx(vCoastalSand)),length(dFdy(vCoastalSand)));
        if (sandWaveWeight>.001 && !coastalPool(vCoastalSand)) {
          diffuseColor.rgb*=coastalWetSand(sandWet);
          float stranded=sandWaveWeight*coastalBubbleCover(vCoastalSand,sandWave.b,sandFootprint)*(1.-smoothstep(.004,.025,sandWave.g));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.73,.76,.73),min(.59,stranded));
        }`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.35,sandWet*.78);"
      );
    };
    material.customProgramCacheKey = () => key + ":swash-sand-v2";
    material.needsUpdate = true;
  }
  return {
    uniforms,
    upload,
    paintSand,
    dispose() {
      line.dispose();
      atlas.dispose();
    },
  };
}

// Keep the wide ocean's existing vertex and triangle counts. Give the 3D
// shore cross-section 108 of the original 160 rows, with tapered spacing
// outside the active run-up band.
export function shoreGridZ(unit, rows, centerZ) {
  const lo = -Math.max(...rows.map((r) => r[3])) + COASTAL_SURF.offshore - 1.2 - centerZ;
  const hi = -Math.min(...rows.map((r) => r[3])) + COASTAL_SURF.inland + 1.2 - centerZ;
  const first = 26 / 160;
  const last = 134 / 160;
  if (unit < first) return lo - (lo + 200) * (1 - unit / first) ** 2;
  if (unit > last) return hi + (200 - hi) * ((unit - last) / (1 - last)) ** 2;
  return lo + ((hi - lo) * (unit - first)) / (last - first);
}
