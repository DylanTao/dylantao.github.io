import * as THREE from "../three.module.min.js";
import { createHeightfieldWater } from "./heightfield-water.mjs";

// Nearest-filter float storage plus manual bilinear interpolation requires no
// float-linear filtering extension. RGB = elevation and world X/Z derivatives;
// A = wet-cell weight. Renormalization extends the surface through solid cells
// for rendering; the numerical fluxes still stop at the solid face.
export const poolSamplingGLSL = `
uniform highp sampler2D poolHeightfield;
uniform vec2 poolGrid, poolCenter, poolSize;
uniform float poolSolidElevation;
vec3 samplePool(vec2 point) {
  vec2 p=clamp((point-poolCenter)/poolSize+.5,vec2(0.),vec2(1.))*poolGrid-.5;
  vec2 base=floor(p), f=fract(p);
  vec2 lo=clamp(base,vec2(0.),poolGrid-1.);
  vec2 hi=clamp(base+1.,vec2(0.),poolGrid-1.);
  // Texel fetches: the nearest-filtered cells read exactly, with no derivatives, so the lookups can sit
  // in the caustic receivers' branches without lengthening their compile.
  vec4 a=texelFetch(poolHeightfield,ivec2(lo),0);
  vec4 b=texelFetch(poolHeightfield,ivec2(hi.x,lo.y),0);
  vec4 c=texelFetch(poolHeightfield,ivec2(lo.x,hi.y),0);
  vec4 d=texelFetch(poolHeightfield,ivec2(hi),0);
  vec4 weights=vec4((1.-f.x)*(1.-f.y),f.x*(1.-f.y),(1.-f.x)*f.y,f.x*f.y)*vec4(a.a,b.a,c.a,d.a);
  float weight=dot(weights,vec4(1.));
  if(weight<.00001) return vec3(poolSolidElevation,0.,0.);
  return (a.rgb*weights.x+b.rgb*weights.y+c.rgb*weights.z+d.rgb*weights.w)/weight;
}
`;

// Light reaching the basin through the simulated surface (2026-10-18). A beam refracts into the water,
// runs `path` metres to the stone, and the surface's curvature refocuses it: to first order its landing
// point moves by path (1 - 1/n) grad h, so the stone's irradiance gain is 1 / |det(I + path (1 - 1/n)
// Hess h)|, the Pacific's paraxial lens (sea-optics.mjs) with the solver's own Hessian, by central
// differences of its uploaded slopes over one cell. Calm water gives exactly 1: the hand's waves, and
// nothing else, draw the caustics. The surface's Fresnel loss and the water's absorption along the path
// apply too, and submerged stone darkens as wet stone does.
// Sub-grid ripples. The 4.3 cm grid carries waves of 8.6 cm and longer, which in 13 cm of water focus
// light by about a tenth of a percent; the centimetre ripples a moving hand leaves are below the grid.
// Six capillary-gravity ripples (1.6 to 5 cm, omega^2 = g k + (sigma/rho) k^3) ride on the simulated
// waves, their height set by the simulated slope under them, so a calm pool stays exactly flat and the
// ripples come and go with the hand's waves. They tilt the surface and focus the light; they carry no
// mass or energy in the solver.
export const POOL_RIPPLES = Object.freeze(
  Array.from({ length: 6 }, (_, i) => {
    const wavelength = 0.05 * 0.79 ** i,
      k = (Math.PI * 2) / wavelength,
      heading = i * 2.39996 + 0.4;
    return Object.freeze({
      wavelength,
      k,
      dx: Math.cos(heading),
      dz: Math.sin(heading),
      steepness: 0.045,
      omega: Math.sqrt(9.80665 * k + (0.072 / 1000) * k ** 3),
      phase: i * 1.9,
    });
  })
);
// The simulated slope at which the ripples reach full height.
export const POOL_RIPPLE_SLOPE = 0.012;
// Six plane waves interfere into a regular lattice. A slow value noise (25 cm patches) shifts each
// ripple's phase by a different mix, so the ripples break into irregular wavelets; each ripple's
// curvature, and so the caustics' statistics, are unchanged.
const fract = (x) => x - Math.floor(x);
const poolHash = (x, z) => fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453);
export function poolScramble(x, z) {
  const noise = (u, v) => {
    const i = Math.floor(u),
      j = Math.floor(v),
      fu = u - i,
      fv = v - j,
      su = fu * fu * (3 - 2 * fu),
      sv = fv * fv * (3 - 2 * fv),
      a = poolHash(i, j),
      b = poolHash(i + 1, j),
      c = poolHash(i, j + 1),
      d = poolHash(i + 1, j + 1);
    return (a + (b - a) * su) * (1 - sv) + (c + (d - c) * su) * sv;
  };
  return [noise(x * 4, z * 4) * Math.PI * 2, noise(x * 4 + 17, z * 4 + 17) * Math.PI * 2];
}
export const poolRipplePhase = (i, scramble) => scramble[0] * Math.cos(i * 2.39996) + scramble[1] * Math.sin(i * 2.39996);
export const POOL_CAUSTIC_FLOOR = 0.2;
export const POOL_CAUSTIC_CEILING = 4;
const IOR = 1.333;
const g = (value) => (Number.isInteger(value) ? `${value}.0` : value.toPrecision(9));
export const poolRippleGLSL = `
uniform float poolTime;
float poolHash(vec2 c) { return fract(sin(c.x * 127.1 + c.y * 311.7) * 43758.5453); }
float poolNoise(vec2 q) {
  vec2 i = floor(q), f = fract(q), s = f * f * (3. - 2. * f);
  return mix(mix(poolHash(i), poolHash(i + vec2(1., 0.)), s.x), mix(poolHash(i + vec2(0., 1.)), poolHash(i + vec2(1., 1.)), s.x), s.y);
}
vec2 poolScramble(vec2 p) { return vec2(poolNoise(p * 4.), poolNoise(p * 4. + 17.)) * 6.2831853; }
// Slopes (xy) of the sub-grid ripples at a world point, at a share of full height.
vec2 poolRippleSlope(vec2 p, float share) {
  if (share <= 0.) return vec2(0.);
  vec2 scramble = poolScramble(p), slope = vec2(0.);
  ${POOL_RIPPLES.map(
    (w, i) =>
      `slope += vec2(${g(w.dx)}, ${g(w.dz)}) * ${g(w.steepness)} * cos(${g(w.k)} * dot(p, vec2(${g(w.dx)}, ${g(w.dz)})) - ${g(w.omega)} * poolTime + ${g(w.phase)} + dot(scramble, vec2(${g(Math.cos(i * 2.39996))}, ${g(Math.sin(i * 2.39996))})));`
  ).join("\n  ")}
  return slope * share;
}
// Their curvature (xx, zz, xz) and summed variance for a lens of length lens.
vec4 poolRippleHessian(vec2 p, float share, float lens) {
  vec4 h = vec4(0.);
  if (share <= 0.) return h;
  vec2 scramble = poolScramble(p);
  ${POOL_RIPPLES.map(
    (w, i) => `{
    float c = -${g(w.steepness * w.k)} * share * sin(${g(w.k)} * dot(p, vec2(${g(w.dx)}, ${g(w.dz)})) - ${g(w.omega)} * poolTime + ${g(w.phase)} + dot(scramble, vec2(${g(Math.cos(i * 2.39996))}, ${g(Math.sin(i * 2.39996))})));
    h.xyz += c * vec3(${g(w.dx * w.dx)}, ${g(w.dz * w.dz)}, ${g(w.dx * w.dz)});
    h.w += .5 * pow(${g(w.steepness * w.k)} * share * lens, 2.);
  }`
  ).join("\n  ")}
  return h;
}
float poolRippleShare(vec3 sampleValue) {
  return clamp(length(sampleValue.yz) / ${g(POOL_RIPPLE_SLOPE)}, 0., 1.);
}
`;
export const poolCausticGLSL = `
uniform float poolSurfaceY;
uniform float poolCellSize;
uniform float poolCausticsEnabled;
uniform vec3 poolAbsorption;
// 1 inside the basin below the mean surface, fading over a centimetre at the waterline.
float poolSubmerged(vec3 p) {
  vec2 rel = (p.xz - poolCenter) / (poolSize * .5);
  return poolCausticsEnabled * step(dot(rel, rel), 1.) * smoothstep(-.005, .01, poolSurfaceY + poolSolidElevation - p.y);
}
float poolLensGain(vec2 entry, float path) {
  float h = poolCellSize;
  vec3 xp = samplePool(entry + vec2(h, 0.)), xm = samplePool(entry - vec2(h, 0.));
  vec3 zp = samplePool(entry + vec2(0., h)), zm = samplePool(entry - vec2(0., h));
  float hxx = (xp.y - xm.y) / (2. * h), hzz = (zp.z - zm.z) / (2. * h);
  float hxz = .25 * ((zp.y - zm.y) + (xp.z - xm.z)) / h;
  float lens = path * ${(1 - 1 / IOR).toFixed(9)};
  // The ripples riding here, by the simulated slope at the entry point.
  vec4 ripples = poolRippleHessian(entry, poolRippleShare(samplePool(entry)), lens);
  hxx += ripples.x; hzz += ripples.y; hxz += ripples.z;
  float det = (1. + lens * hxx) * (1. + lens * hzz) - lens * lens * hxz * hxz;
  float raw = clamp(1. / max(abs(det), ${POOL_CAUSTIC_FLOOR.toFixed(2)}), 0., ${POOL_CAUSTIC_CEILING.toFixed(1)});
  // The mean of a single-sheet gain grows with the ripples' curvature variance (sea-optics.mjs causticMean).
  return raw * (1. + .3 * pow(ripples.w, 1.75)) / (1. + 1.7 * ripples.w);
}
// What the water does to direct light reaching the stone point p, for light from above: the lens of the
// surface over the point, the surface's transmission at normal incidence (0.98) and the absorption down
// to it. One evaluation serves every light (the light well's sun and the bath's lamp both stand high
// over the water), so the stone's program carries the lens once rather than once per light.
vec3 poolLightThroughWater(vec3 p) {
  float submerged = poolSubmerged(p);
  if (submerged <= 0.) return vec3(1.);
  float depth = max(poolSurfaceY + poolSolidElevation - p.y, 0.);
  vec3 water = .98 * poolLensGain(p.xz, depth) * exp(-poolAbsorption * depth);
  return mix(vec3(1.), water, submerged);
}
`;

export function createOnsenWater({
  center = [3.02, -1.82],
  surfaceY = 3.0075,
  radius = 0.86,
  depth = 0.24,
  bottomY = null,
  depthSource = "illustrative parameter",
  // The water's absorption (1/m, red/green/blue) along the light's path to the stone: the pool
  // material's turquoise attenuation, -ln(colour) / distance.
  absorption = [0, 0, 0],
  ...solverOptions
} = {}) {
  if (!Array.isArray(center) || center.length !== 2 || ![...center, surfaceY, radius].every(Number.isFinite))
    throw new RangeError("finite world-space pool geometry required");
  const solver = createHeightfieldWater({ ...solverOptions, width: radius * 2, length: radius * 2, radius, depth }),
    data = solver.writeSurface(),
    texture = new THREE.DataTexture(data, solver.grid.nx, solver.grid.nz, THREE.RGBAFormat, THREE.FloatType),
    uniforms = {
      poolHeightfield: { value: texture },
      poolGrid: { value: new THREE.Vector2(solver.grid.nx, solver.grid.nz) },
      poolCenter: { value: new THREE.Vector2(...center) },
      poolSize: { value: new THREE.Vector2(radius * 2, radius * 2) },
      poolSolidElevation: { value: 0 },
      poolLocalUp: { value: new THREE.Vector3(0, 1, 0) },
      poolTime: { value: 0 },
    },
    // The basin's caustic receivers (bindCausticReceiver) share these with the surface.
    causticUniforms = {
      poolSurfaceY: { value: surfaceY },
      poolCellSize: { value: solver.grid.dx },
      poolCausticsEnabled: { value: 1 },
      poolAbsorption: { value: new THREE.Vector3(...absorption) },
    },
    bindings = new Map(),
    receivers = new Map();
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  let disposed = false,
    bather = null,
    uploads = 1,
    drip = null,
    nextDrip = Math.sqrt((2 * 0.38) / 9.80665),
    dripCount = 0;
  // The native kakei's fixture-local endpoint comes from coastal_decor.py bamboo_spout
  // (Blender 3.72,-3.62,3.28). Its existing node matrix owns the housing setback and
  // enclosing room transform. Resolve that frame once, without adding another fixture.
  function bindDrip(mesh) {
    if (drip || !mesh?.parent || !mesh.isMesh) return;
    let room = mesh,
      fixture = null;
    while (room.parent) room = room.parent;
    room.traverse((part) => {
      if (!fixture && /onsen_decor.*dry.bamboo/.test(part.name)) fixture = part;
    });
    if (!fixture) return;
    fixture.updateWorldMatrix(true, false);
    const outlet = fixture.localToWorld(new THREE.Vector3(3.72, 3.28, 3.62)),
      height = outlet.y - surfaceY;
    if (!(height > 0) || Math.hypot(outlet.x - center[0], outlet.z - center[1]) >= radius) return;
    const group = new THREE.Group(),
      dropMaterial = new THREE.MeshPhysicalMaterial({ color: 0xb6d7d0, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.8 }),
      dropGeometry = new THREE.SphereGeometry(0.009, 8, 6),
      drop = new THREE.Mesh(dropGeometry, dropMaterial);
    group.name = "Onsen bamboo drip inlet";
    mesh.parent.updateWorldMatrix(true, false);
    // Keep gravity and metres in world space even under a rotated/scaled parent.
    group.matrix
      .copy(mesh.parent.matrixWorld)
      .invert()
      .multiply(new THREE.Matrix4().makeTranslation(outlet.x, surfaceY, outlet.z));
    group.matrixAutoUpdate = false;
    group.matrixWorldNeedsUpdate = true;
    group.add(drop);
    mesh.parent.add(group);
    drip = {
      group,
      drop,
      materials: [dropMaterial],
      geometries: [dropGeometry],
      x: outlet.x,
      z: outlet.z,
      height,
    };
    nextDrip = Math.sqrt((2 * drip.height) / 9.80665);
    poseDrip();
  }
  function poseDrip() {
    if (!drip) return;
    const phase = solver.simulatedSeconds() % 1.4,
      fall = Math.sqrt((2 * drip.height) / 9.80665);
    drip.drop.visible = phase <= fall;
    drip.drop.position.set(0, drip.height - 0.5 * 9.80665 * Math.min(phase, fall) ** 2, 0);
    drip.drop.scale.set(1, 1.5, 1);
  }
  function upload() {
    solver.writeSurface(data);
    texture.needsUpdate = true;
    uploads++;
  }

  function bindMaterial(material, mesh = null) {
    if (disposed) throw new Error("pool adapter is disposed");
    if (bindings.has(material)) return;
    const compile = material.onBeforeCompile,
      cache = material.customProgramCacheKey;
    if (mesh) {
      if (material.isMeshStandardMaterial) bindDrip(mesh);
      mesh.updateWorldMatrix(true, false);
      const inverse = new THREE.Matrix4().copy(mesh.matrixWorld).invert(),
        e = inverse.elements;
      // Keep scale, unlike transformDirection(), so a meter stays a meter.
      uniforms.poolLocalUp.value.set(e[4], e[5], e[6]);
    }
    material.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = `uniform vec3 poolLocalUp; varying vec2 simulatedPoolXZ;\n${poolSamplingGLSL}\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        simulatedPoolXZ=(modelMatrix*vec4(transformed,1.)).xz;
        transformed+=poolLocalUp*samplePool(simulatedPoolXZ).x;`
      );
      // Replace the site's existing authored sinusoidal pool normal before
      // applying the derivative of the simulated field. Contact lighting stays.
      shader.fragmentShader = shader.fragmentShader.replace(
        /vec2 ripple = poolPoint\.xz \* 15\.0;[\s\S]*?normal = normalize\(mat3\(viewMatrix\)\*vec3\(a\*\.075,1\.0,b\*\.075\)\);/,
        ""
      );
      shader.fragmentShader = `varying vec2 simulatedPoolXZ;\n${poolSamplingGLSL}\n${poolRippleGLSL}\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec3 poolSample=samplePool(simulatedPoolXZ);
        poolSample.yz+=poolRippleSlope(simulatedPoolXZ,poolRippleShare(poolSample));
        normal=normalize(mat3(viewMatrix)*vec3(-poolSample.y,1.,-poolSample.z));`
      );
    };
    material.customProgramCacheKey = function () {
      return `${cache.call(this)}:coastal-heightfield-v1`;
    };
    bindings.set(material, { compile, cache });
    material.needsUpdate = true;
  }

  // The basin's stone takes the light the water lets through: refocused into caustics by the simulated
  // surface, dimmed by Fresnel and absorption, on stone darkened as wet stone is. Chains the material's
  // existing hooks like bindMaterial; its direct-light function wraps RE_Direct_Physical.
  function bindCausticReceiver(material) {
    if (disposed) throw new Error("pool adapter is disposed");
    if (!material?.isMeshStandardMaterial || receivers.has(material) || bindings.has(material)) return false;
    const compile = material.onBeforeCompile,
      cache = material.customProgramCacheKey;
    material.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer);
      Object.assign(shader.uniforms, uniforms, causticUniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 poolStonePosition;")
        .replace("#include <project_vertex>", "poolStonePosition=(modelMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>\nvarying vec3 poolStonePosition;\nvec3 poolWaterLight = vec3(1.);\n${poolSamplingGLSL}\n${poolRippleGLSL}\n${poolCausticGLSL}`
        )
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\ndiffuseColor.rgb*=mix(1.,.66,poolSubmerged(poolStonePosition));\npoolWaterLight=poolLightThroughWater(poolStonePosition);"
        )
        .replace(
          "#include <lights_physical_pars_fragment>",
          `#include <lights_physical_pars_fragment>
void RE_Direct_PoolStone(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  IncidentLight throughWater = directLight;
  throughWater.color *= poolWaterLight;
  RE_Direct_Physical(throughWater, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
}
#undef RE_Direct
#define RE_Direct RE_Direct_PoolStone`
        );
    };
    material.customProgramCacheKey = function () {
      return `${cache.call(this)}:pool-caustics-v1`;
    };
    receivers.set(material, { compile, cache });
    material.needsUpdate = true;
    return true;
  }

  // CPU twin of poolLensGain for evidence and tests: the shader's bilinear wet-weighted sampling of the
  // uploaded slopes, central differences over one cell, the same lens determinant.
  function sampleSurface(x, z) {
    const { nx, nz } = solver.grid,
      px = Math.min(1, Math.max(0, (x - center[0]) / (radius * 2) + 0.5)) * nx - 0.5,
      pz = Math.min(1, Math.max(0, (z - center[1]) / (radius * 2) + 0.5)) * nz - 0.5,
      bx = Math.floor(px),
      bz = Math.floor(pz),
      fx = px - bx,
      fz = pz - bz,
      at = (i, j) => (Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))) * 4,
      corners = [
        [at(bx, bz), (1 - fx) * (1 - fz)],
        [at(bx + 1, bz), fx * (1 - fz)],
        [at(bx, bz + 1), (1 - fx) * fz],
        [at(bx + 1, bz + 1), fx * fz],
      ];
    let weight = 0;
    const out = [0, 0, 0];
    for (const [k, w] of corners) {
      const ww = w * data[k + 3];
      weight += ww;
      for (let c = 0; c < 3; c++) out[c] += data[k + c] * ww;
    }
    return weight < 1e-5 ? [uniforms.poolSolidElevation.value, 0, 0] : out.map((v) => v / weight);
  }
  function causticGainAt(x, z, path, seconds = uniforms.poolTime.value) {
    const h = solver.grid.dx,
      xp = sampleSurface(x + h, z),
      xm = sampleSurface(x - h, z),
      zp = sampleSurface(x, z + h),
      zm = sampleSurface(x, z - h),
      here = sampleSurface(x, z),
      share = Math.min(1, Math.hypot(here[1], here[2]) / POOL_RIPPLE_SLOPE),
      lens = path * (1 - 1 / IOR);
    let hxx = (xp[1] - xm[1]) / (2 * h),
      hzz = (zp[2] - zm[2]) / (2 * h),
      hxz = (0.25 * (zp[1] - zm[1] + (xp[2] - xm[2]))) / h,
      variance = 0;
    const scramble = poolScramble(x, z);
    POOL_RIPPLES.forEach((w, i) => {
      const c = -w.steepness * w.k * share * Math.sin(w.k * (w.dx * x + w.dz * z) - w.omega * seconds + w.phase + poolRipplePhase(i, scramble));
      hxx += c * w.dx * w.dx;
      hzz += c * w.dz * w.dz;
      hxz += c * w.dx * w.dz;
      variance += 0.5 * (w.steepness * w.k * share * lens) ** 2;
    });
    const det = (1 + lens * hxx) * (1 + lens * hzz) - lens * lens * hxz * hxz,
      raw = Math.min(POOL_CAUSTIC_CEILING, Math.max(0, 1 / Math.max(Math.abs(det), POOL_CAUSTIC_FLOOR)));
    return (raw * (1 + 0.3 * variance ** 1.75)) / (1 + 1.7 * variance);
  }
  // The range of caustic gain on the floor for light from straight above, over the open water.
  function causticEvidence() {
    let minimum = Infinity,
      maximum = -Infinity,
      sum = 0,
      count = 0;
    const steps = 24;
    for (let j = 0; j < steps; j++)
      for (let i = 0; i < steps; i++) {
        const x = center[0] + ((i + 0.5) / steps - 0.5) * radius * 1.6,
          z = center[1] + ((j + 0.5) / steps - 0.5) * radius * 1.6;
        if (Math.hypot(x - center[0], z - center[1]) > radius * 0.8) continue;
        const gain = causticGainAt(x, z, depth);
        minimum = Math.min(minimum, gain);
        maximum = Math.max(maximum, gain);
        sum += gain;
        count++;
      }
    return {
      method: "paraxial lens of the simulated surface: 1/|det(I + l(1-1/n) Hess h)|, central differences over one cell",
      receivers: receivers.size,
      enabled: causticUniforms.poolCausticsEnabled.value === 1,
      overheadFloorGain: count ? { minimum, maximum, mean: sum / count, samples: count } : null,
      absorption: causticUniforms.poolAbsorption.value.toArray(),
    };
  }

  function surfaceGeometry({ rings = 20, segments = 96 } = {}) {
    if (!Number.isInteger(rings) || !Number.isInteger(segments) || rings < 2 || rings > 64 || segments < 16 || segments > 128)
      throw new RangeError("bounded pool tessellation required");
    const positions = [center[0], surfaceY, center[1]],
      normals = [0, 1, 0],
      uv = [0.5, 0.5],
      indices = [];
    for (let r = 1; r <= rings; r++)
      for (let i = 0; i < segments; i++) {
        const theta = (i * Math.PI * 2) / segments,
          x = (Math.cos(theta) * radius * r) / rings,
          z = (Math.sin(theta) * radius * r) / rings;
        positions.push(center[0] + x, surfaceY, center[1] + z);
        normals.push(0, 1, 0);
        uv.push(x / (radius * 2) + 0.5, z / (radius * 2) + 0.5);
        const b = 1 + (r - 1) * segments + i,
          next = 1 + (r - 1) * segments + ((i + 1) % segments);
        if (r === 1) indices.push(0, next, b);
        else {
          const a = b - segments,
            aNext = next - segments;
          indices.push(a, aNext, b, b, aNext, next);
        }
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  function setBather(body) {
    if (disposed) return false;
    if (
      body &&
      (![body.x, body.z, body.radius ?? 0.17].every(Number.isFinite) ||
        Math.hypot(body.x - center[0], body.z - center[1]) + (body.radius ?? 0.17) > radius)
    )
      throw new RangeError("bather obstacle must fit inside the pool");
    const local = body ? { x: body.x - center[0], z: body.z - center[1], radius: body.radius ?? 0.17 } : null;
    // Ignore sub-cell breathing/IK noise; it must not remesh the basin each RAF.
    if (
      (!local && !bather) ||
      (local &&
        bather &&
        Math.hypot(local.x - bather.x, local.z - bather.z) < Math.min(solver.grid.dx, solver.grid.dz) / 2 &&
        local.radius === bather.radius)
    )
      return false;
    bather = local;
    const changed = solver.setObstacle(local);
    if (changed) {
      const state = solver.evidence();
      uniforms.poolSolidElevation.value = state.volume / (state.wetCells * solver.grid.dx * solver.grid.dz) - depth;
      upload();
    }
    return changed;
  }

  return {
    solver,
    surfaceY,
    depth,
    texture,
    uniforms,
    bindMaterial,
    bindCausticReceiver,
    causticGainAt,
    surfaceGeometry,
    setBather,
    advance(delta, { contacts = [] } = {}) {
      if (disposed) return false;
      const localContacts = contacts.map((contact) => ({ ...contact, x: contact.x - center[0], z: contact.z - center[1] }));
      const changed = solver.advance(delta, { contacts: localContacts });
      // Only a bound, visible inlet adds drops. The pure unbound adapter remains an equilibrium
      // basin for numerical validation; pause and offscreen throttling never accumulate debt.
      if (drip && delta > 0) {
        const now = solver.simulatedSeconds();
        if (now >= nextDrip) {
          solver.disturb({ x: drip.x - center[0], z: drip.z - center[1], amplitude: 0.0015, spread: 0.1 });
          nextDrip = now + 1.4;
          dripCount++;
        }
        poseDrip();
      }
      if (changed) {
        // The ripples move on the solver's simulated clock, so they freeze whenever it does.
        uniforms.poolTime.value = solver.simulatedSeconds();
        upload();
      }
      return changed;
    },
    disturb({ x = center[0], z = center[1], ...options } = {}) {
      if (disposed) return;
      solver.disturb({ ...options, x: x - center[0], z: z - center[1] });
      upload();
    },
    evidence() {
      return {
        ...solver.evidence(),
        center: [...center],
        surfaceY,
        radius,
        depth,
        bottomY,
        depthSource,
        uploads,
        drip: { bound: Boolean(drip), drops: dripCount, nextSeconds: nextDrip, coupling: "prescribed drop; zero-mean volume-conserving impulse" },
        textureBytes: data.byteLength,
        disposed,
        caustics: causticEvidence(),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [material, previous] of [...bindings, ...receivers]) {
        material.onBeforeCompile = previous.compile;
        material.customProgramCacheKey = previous.cache;
        material.needsUpdate = true;
      }
      bindings.clear();
      receivers.clear();
      if (drip) {
        drip.materials.forEach((m) => m.dispose());
        drip.geometries.forEach((g) => g.dispose());
        drip.group.removeFromParent();
        drip = null;
      }
      texture.dispose();
    },
  };
}
