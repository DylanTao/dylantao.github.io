import * as THREE from "../three.module.min.js";
import { Pass, FullScreenQuad } from "../vendor/three-r164/postprocessing/Pass.js";
import { SEA_LEVEL, atmosphereConstantsGLSL, atmosphereSkyGLSL } from "./atmosphere.mjs";
import { fogNoiseVolume } from "./atmosphere-model.mjs";

// The coast's air between the eye and every surface, after the beauty pass, from its depth.
//
// Aerial perspective: the exact optical depth of an exponential haze layer along each view ray,
// dense at the waterline and thinning with height (atmosphere.mjs atmoHazeDepth), lit with the
// colour of the horizon in that ray's azimuth, so the haze glows gold toward a low sun and stays
// cool away from it, and land meets the sky in the same light. Three's linear fog had one colour and
// a hard far edge; it is kept only for the sea mirror, which draws before this pass.
//
// Light in the air: a raymarch at a fraction of the canvas's resolution walks each view ray through
// the haze, La Jolla's marine layer and the house's dusty indoor air, testing every step against the
// sun's cached shadow map (shadow-cache.mjs), after the froxel-free single scattering of Wronski
// (SIGGRAPH 2014) and Hillaire (Frostbite, 2015). It returns four numbers per pixel: how much of the
// haze's sunlit share survives the shadows along the ray (shafts behind the cliff, the pines and the
// house), the marine fog's transmittance and its sunlit in-scattering, and the dust's. The full-size
// pass upsamples them, choosing among the four nearest samples by depth so edges stay sharp.
//
// The world's edge: the land block, the hinterland and the 400 m sea plane end. Between the far
// view's fog distances (camera.mjs farView, which also sets the clip planes) every surface gives way
// to the dome's own colour along its ray (atmoDome: the sky, or the Pacific out to the horizon, hazed
// the same way), so the edges dissolve into atmosphere rather than ending.

// The house's interior behind the glass front (facade plane z = -4.48 m): dust, never fog, inside.
export const HOUSE_INTERIOR = Object.freeze({ min: [-5.3, -0.25, -4.48], max: [11.2, 7.6, 8.0] });
// Dust in still indoor air: thin enough to vanish in shade, enough to show a sunbeam.
export const INDOOR_DUST = 0.035;
// The marine layer's density inside the bank: about 65 m visibility, so a bank a few metres deep is a
// white blanket seen from the cliff and a wall seen across the water.
export const FOG_DENSITY = 0.06;

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Shared by both passes: the camera ray at a depth-buffer texel, and the media.
const mediaGLSL = `
uniform sampler2D tDepth;
uniform mat4 hazeProjectionInverse, hazeCameraWorld;
uniform vec2 hazeClip;
uniform vec4 hazeFog;
uniform vec3 hazeFogDrift, hazeInteriorMin, hazeInteriorMax;
float hazeViewDistance(vec2 uv, float depth, out vec3 direction) {
  vec4 view = hazeProjectionInverse * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  view.xyz /= view.w;
  vec3 ray = mat3(hazeCameraWorld) * view.xyz;
  float dist = length(ray);
  direction = ray / max(dist, 1e-4);
  return dist;
}
float hazeInside(vec3 p) {
  return step(hazeInteriorMin.x, p.x) * step(p.x, hazeInteriorMax.x) * step(hazeInteriorMin.y, p.y) * step(p.y, hazeInteriorMax.y)
    * step(hazeInteriorMin.z, p.z) * step(p.z, hazeInteriorMax.z);
}
`;

const volumeFragment = `
precision highp float;
precision highp sampler3D;
uniform sampler2D hazeShadowMap;
uniform sampler3D hazeNoise;
uniform mat4 hazeShadowMatrix;
uniform vec3 hazeLight;
uniform vec4 hazeMarch;
uniform vec2 hazeResolution;
uniform float hazeShadowEnabled, hazeDust;
uniform vec4 atmoHaze;
#include <packing>
${mediaGLSL}
float hazeShadow(vec3 p) {
  if (hazeShadowEnabled < 0.5) return 1.0;
  vec3 c = (hazeShadowMatrix * vec4(p, 1.0)).xyz;
  if (c.x <= 0.0 || c.y <= 0.0 || c.x >= 1.0 || c.y >= 1.0 || c.z >= 1.0) return 1.0;
  return step(c.z - 0.0015, unpackRGBAToDepth(texture2D(hazeShadowMap, c.xy)));
}
// The marine layer: a bank over the water whose top billows (two octaves of a periodic noise volume
// drifting with the breeze), thinning over the warm land and kept out of the house.
float hazeFogDensity(vec3 p, out float top) {
  vec3 q = (p + hazeFogDrift) * 0.012;
  float billow = texture(hazeNoise, q).r * 0.62 + texture(hazeNoise, q * 2.7 + 0.37).r * 0.38;
  top = hazeFog.y + (billow - 0.5) * 10.0;
  // (GLSL leaves smoothstep undefined for a reversed edge pair; ANGLE's Direct3D path returns 0.)
  float layer = 1.0 - smoothstep(top - 5.0, top + 2.0, p.y);
  float land = mix(1.0, 0.4, smoothstep(-4.0, 40.0, p.z));
  return hazeFog.z * layer * land * smoothstep(0.22, 0.6, billow + 0.18 * hazeFog.x);
}
void main() {
  vec2 uv = gl_FragCoord.xy / hazeResolution;
  float depth = texture2D(tDepth, uv).r;
  vec3 d;
  float dist = depth >= 0.999999 ? hazeMarch.x : min(hazeViewDistance(uv, depth, d), hazeMarch.x);
  if (depth >= 0.999999) hazeViewDistance(uv, 0.5, d);
  vec3 eye = hazeCameraWorld[3].xyz;
  // Interleaved gradient noise (Jimenez 2014) staggers the samples between neighbouring pixels.
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  int steps = int(hazeMarch.y);
  float tauHaze = 0.0, tauFog = 0.0, tauDust = 0.0, lit = 0.0, weight = 0.0, fogSun = 0.0, dustSun = 0.0;
  float lightY = max(hazeLight.y, 0.12);
  for (int i = 0; i < 48; i++) {
    if (i >= steps) break;
    float s0 = float(i) / float(steps), s1 = float(i + 1) / float(steps), sm = (float(i) + jitter) / float(steps);
    float dt = (s1 * s1 - s0 * s0) * dist, t = sm * sm * dist;
    vec3 p = eye + d * t;
    float inside = hazeInside(p);
    float height = max(0.0, p.y - ${SEA_LEVEL.toFixed(2)});
    float sigmaHaze = (1.0 - inside) * atmoHaze.x * exp(-height / atmoHaze.y);
    float top = 0.0, sigmaFog = hazeFog.x > 0.0 ? (1.0 - inside) * hazeFogDensity(p, top) : 0.0;
    float sigmaDust = inside * hazeDust;
    float visible = hazeShadow(p);
    float hazeT = exp(-tauHaze);
    lit += sigmaHaze * hazeT * visible * dt;
    weight += sigmaHaze * hazeT * dt;
    // The fog's own shade: light reaching a point inside the bank has crossed the bank above it.
    float selfShade = exp(-hazeFog.z * 0.45 * max(0.0, top - p.y) / lightY);
    fogSun += sigmaFog * exp(-tauFog - tauHaze) * visible * selfShade * dt;
    dustSun += sigmaDust * exp(-tauDust) * visible * dt;
    tauHaze += sigmaHaze * dt;
    tauFog += sigmaFog * dt;
    tauDust += sigmaDust * dt;
  }
  gl_FragColor = vec4(weight > 1e-7 ? lit / weight : 1.0, exp(-tauFog), fogSun, dustSun);
}`;

const compositeFragment = `
precision highp float;
uniform sampler2D tDiffuse, tVolume;
uniform vec2 hazeDissolve, hazeVolumeSize;
uniform float hazeVolumeEnabled;
uniform vec3 hazeLight, hazeKeyLight;
varying vec2 vUv;
#include <packing>
${atmosphereConstantsGLSL}
${atmosphereSkyGLSL}
${mediaGLSL}
float hazeLinearDepth(vec2 uv) {
  return -perspectiveDepthToViewZ(texture2D(tDepth, uv).r, hazeClip.x, hazeClip.y);
}
// The four nearest low-resolution samples, weighted bilinearly and by how near their depth is to
// this pixel's (a joint bilateral upsample), so a sunlit shaft never bleeds onto the cliff in front.
vec4 hazeVolumeAt(vec2 uv, float viewDepth) {
  vec2 texel = uv * hazeVolumeSize - 0.5, base = floor(texel), f = texel - base;
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int k = 0; k < 4; k++) {
    vec2 o = vec2(float(k - (k / 2) * 2), float(k / 2));
    vec2 sampleUv = (base + o + 0.5) / hazeVolumeSize;
    float w = mix(1.0 - f.x, f.x, o.x) * mix(1.0 - f.y, f.y, o.y) + 1e-4;
    w /= 1e-3 + abs(hazeLinearDepth(sampleUv) - viewDepth) / max(viewDepth, 1.0);
    sum += texture2D(tVolume, sampleUv) * w;
    total += w;
  }
  return sum / total;
}
float hazePhase(float c, float g) {
  return (1.0 - g * g) / (4.0 * ATMO_PI * pow(max(1e-4, 1.0 + g * g - 2.0 * g * c), 1.5));
}
void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  float depth = texture2D(tDepth, vUv).r;
  bool sky = depth >= 0.999999;
  vec3 d;
  float dist = hazeViewDistance(vUv, sky ? 0.5 : depth, d);
  vec3 eye = hazeCameraWorld[3].xyz;
  float heightM = max(0.5, eye.y - ${SEA_LEVEL.toFixed(2)});
  vec4 volume = vec4(1.0, 1.0, 0.0, 0.0);
  if (hazeVolumeEnabled > 0.5) volume = hazeVolumeAt(vUv, sky ? hazeClip.y : hazeLinearDepth(vUv));
  float cosine = dot(d, hazeLight);
  vec3 c = color.rgb;
  // The marine fog: its own transmittance, sky-lit and sunlit (a forward lobe plus the isotropic
  // glow of the light it has scattered many times, which makes a thick bank white).
  c = c * volume.y + (1.0 - volume.y) * 0.92 * atmoAmbient * 1.15
    + volume.z * hazeKeyLight * (0.55 * hazePhase(cosine, 0.72) + 0.45 * 0.24);
  if (!sky) {
    c = atmoApplyHaze(c, d, heightM, dist, volume.x);
    float edge = smoothstep(hazeDissolve.x, hazeDissolve.y, dist);
    if (edge > 0.0) c = mix(c, atmoDome(d, max(1.0, heightM)), edge * edge * (3.0 - 2.0 * edge));
  }
  // Sunbeams in the house's dust, lit by the key light through the windows.
  c += volume.w * hazeKeyLight * hazePhase(cosine, 0.55);
  gl_FragColor = vec4(c, color.a);
}`;

// `atmosphere` is atmosphere.mjs's createAtmosphere, `light` the key DirectionalLight with its
// shadow; `scene.fog` holds the far view's fog distances.
export function createHaze(atmosphere, scene, light, { volume: volumeEnabled = true } = {}) {
  const noiseSize = 32,
    noise = new THREE.Data3DTexture(fogNoiseVolume(noiseSize), noiseSize, noiseSize, noiseSize);
  noise.format = THREE.RedFormat;
  noise.minFilter = noise.magFilter = THREE.LinearFilter;
  noise.wrapS = noise.wrapT = noise.wrapR = THREE.RepeatWrapping;
  noise.unpackAlignment = 1;
  noise.needsUpdate = true;
  const volumeTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  volumeTarget.texture.minFilter = volumeTarget.texture.magFilter = THREE.NearestFilter;
  volumeTarget.texture.generateMipmaps = false;
  const shared = {
    tDepth: { value: null },
    hazeProjectionInverse: { value: new THREE.Matrix4() },
    hazeCameraWorld: { value: new THREE.Matrix4() },
    hazeClip: { value: new THREE.Vector2(0.05, 300) },
    hazeFog: { value: new THREE.Vector4(0, 0, 0, 0) },
    hazeFogDrift: { value: new THREE.Vector3() },
    hazeInteriorMin: { value: new THREE.Vector3(...HOUSE_INTERIOR.min) },
    hazeInteriorMax: { value: new THREE.Vector3(...HOUSE_INTERIOR.max) },
    hazeLight: { value: new THREE.Vector3(0, 1, 0) },
  };
  const volumeUniforms = {
    ...shared,
    atmoHaze: atmosphere.uniforms.atmoHaze,
    hazeShadowMap: { value: null },
    hazeShadowMatrix: { value: new THREE.Matrix4() },
    hazeShadowEnabled: { value: 0 },
    hazeNoise: { value: noise },
    hazeMarch: { value: new THREE.Vector4(400, 24, 0, 0) },
    hazeResolution: { value: new THREE.Vector2(1, 1) },
    hazeDust: { value: 0 },
  };
  const compositeUniforms = {
    ...atmosphere.uniforms,
    ...shared,
    tDiffuse: { value: null },
    tVolume: { value: volumeTarget.texture },
    hazeDissolve: { value: new THREE.Vector2(65, 180) },
    hazeVolumeSize: { value: new THREE.Vector2(1, 1) },
    hazeVolumeEnabled: { value: 0 },
    hazeKeyLight: { value: new THREE.Vector3() },
  };
  const volumeMaterial = new THREE.ShaderMaterial({
      name: "Coastal light in the air",
      uniforms: volumeUniforms,
      vertexShader,
      fragmentShader: volumeFragment,
      depthTest: false,
      depthWrite: false,
    }),
    material = new THREE.ShaderMaterial({
      name: "Coastal haze",
      uniforms: compositeUniforms,
      vertexShader,
      fragmentShader: compositeFragment,
      depthTest: false,
      depthWrite: false,
    });
  const volumeQuad = new FullScreenQuad(volumeMaterial),
    quad = new FullScreenQuad(material);
  const pass = new Pass();
  pass.needsSwap = true;
  let camera = null,
    fog = null,
    draws = 0,
    volumeDraws = 0,
    marching = false,
    reason = "off";
  // What the march is for this frame; when nothing would show, it is skipped and the haze stays
  // analytic (open air, no shafts, no fog).
  const plan = { exterior: false, fog: 0, dust: false, shafts: false };
  function sizeVolume(width, height) {
    // Half resolution for the ordinary canvas, a third or a quarter for full screen.
    const pixels = width * height,
      divisor = pixels > 1.4e6 ? 4 : pixels > 5e5 ? 3 : 2,
      w = Math.max(1, Math.ceil(width / divisor)),
      h = Math.max(1, Math.ceil(height / divisor));
    if (volumeTarget.width !== w || volumeTarget.height !== h) volumeTarget.setSize(w, h);
    volumeUniforms.hazeResolution.value.set(w, h);
    compositeUniforms.hazeVolumeSize.value.set(w, h);
  }
  pass.render = (renderer, writeBuffer, readBuffer) => {
    shared.tDepth.value = readBuffer.depthTexture;
    compositeUniforms.tDiffuse.value = readBuffer.texture;
    if (camera) {
      shared.hazeProjectionInverse.value.copy(camera.projectionMatrixInverse);
      shared.hazeCameraWorld.value.copy(camera.matrixWorld);
      shared.hazeClip.value.set(camera.near, camera.far);
    }
    shared.hazeLight.value.copy(light.position).sub(light.target.position).normalize();
    compositeUniforms.hazeKeyLight.value.set(light.color.r, light.color.g, light.color.b).multiplyScalar(light.intensity);
    marching = volumeEnabled && (plan.fog > 0 || plan.dust || plan.shafts);
    compositeUniforms.hazeVolumeEnabled.value = marching ? 1 : 0;
    if (marching) {
      sizeVolume(readBuffer.width, readBuffer.height);
      const map = light.shadow?.map;
      volumeUniforms.hazeShadowMap.value = map ? map.texture : null;
      volumeUniforms.hazeShadowEnabled.value = map && light.castShadow ? 1 : 0;
      volumeUniforms.hazeShadowMatrix.value.copy(light.shadow.matrix);
      volumeUniforms.hazeDust.value = plan.dust ? INDOOR_DUST : 0;
      // The march reaches the far view's dissolve, where the dome takes over.
      volumeUniforms.hazeMarch.value.set(Math.min(420, compositeUniforms.hazeDissolve.value.y), plan.exterior ? 24 : 18, 0, 0);
      renderer.setRenderTarget(volumeTarget);
      volumeQuad.render(renderer);
      volumeDraws++;
    }
    renderer.setRenderTarget(pass.renderToScreen ? null : writeBuffer);
    quad.render(renderer);
    draws++;
  };
  return {
    pass,
    material,
    // Full-screen programs the first composed frame draws (program-warmup.mjs).
    programWarmup: [{ material }, { material: volumeMaterial }],
    // Before the beauty pass: three's fog steps aside (its distances become the dissolve's), and the
    // march decides what it has to carry. `exterior` is the coast view; inside, only the dust's
    // sunbeams through the glass front need it.
    prepare(activeCamera, exterior = false) {
      camera = activeCamera;
      if (scene.fog?.isFog) {
        fog = [scene.fog.near, scene.fog.far];
        compositeUniforms.hazeDissolve.value.set(scene.fog.near, scene.fog.far);
        scene.fog.near = 1e7;
        scene.fog.far = 1e8;
      }
      const state = atmosphere.state,
        toLight = shared.hazeLight.value.copy(light.position).sub(light.target.position).normalize(),
        keyUp = light.intensity > 0.02 && toLight.y > 0.02;
      plan.exterior = exterior;
      plan.fog = state?.marine ?? 0;
      // A low key light reaches into the west-facing house through its glass.
      plan.dust = !exterior && keyUp && toLight.y < 0.75 && toLight.z < -0.15;
      // Shafts in the haze need a light low enough to stream past the cliff, the pines and the house.
      plan.shafts = exterior && keyUp && toLight.y < 0.55;
      reason = marching ? "marching" : "analytic";
    },
    restore() {
      if (fog && scene.fog?.isFog) [scene.fog.near, scene.fog.far] = fog;
      fog = null;
    },
    // The fog bank's state at this light step and its drift with the breeze (scene clock, so pause
    // and reduced motion hold it still). `wind` is wind-field.mjs's coast state.
    advance(seconds, wind) {
      const state = atmosphere.state,
        thickness = state?.marine ?? 0;
      shared.hazeFog.value.set(thickness, SEA_LEVEL + (state?.marineTop ?? 0), thickness > 0 ? FOG_DENSITY * (0.55 + 0.45 * thickness) : 0, 0);
      const speed = 0.45 * (wind?.meanSpeed ?? 3),
        [dx, dz] = wind?.direction ?? [0, 1];
      shared.hazeFogDrift.value.set(-dx * speed * seconds, 0.04 * seconds, -dz * speed * seconds);
    },
    evidence: () => ({
      method: "exponential height haze from scene depth, horizon-lit, dissolving into the dome between the far view's fog distances",
      dissolve: compositeUniforms.hazeDissolve.value.toArray(),
      density: atmosphere.uniforms.atmoHaze.value.x,
      scaleHeight: atmosphere.uniforms.atmoHaze.value.y,
      volume: {
        method: "shadow-mapped single-scattering march (haze shafts, marine fog, indoor dust), joint-bilateral upsampled",
        enabled: volumeEnabled,
        marching,
        plan: { ...plan },
        size: [volumeTarget.width, volumeTarget.height],
        steps: volumeUniforms.hazeMarch.value.y,
        fog: shared.hazeFog.value.toArray().map((v) => +v.toFixed(4)),
        draws: volumeDraws,
      },
      draws,
      reason,
    }),
    dispose() {
      quad.dispose();
      volumeQuad.dispose();
      material.dispose();
      volumeMaterial.dispose();
      volumeTarget.dispose();
      noise.dispose();
    },
  };
}
