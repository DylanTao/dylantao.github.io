// La Jolla's marine layer in the footer: low fog lying over the surf line and the beach, drifting
// slowly along the coast. Three stacked horizontal sheets, depth-tested against the coast so bluffs
// and buildings stand in it, give the fog its thickness. Each sheet reads the sun's shadow map, so
// where palms and buildings block the low sun the fog stays dim and where light passes it glows:
// at golden hour, light shafts reach across the beach toward the viewer (volumetric light from
// shadow maps, after Toth and Umenhoffer 2009). The fog scatters forward, brightest looking toward
// the sun. Its density and color come from the hour's look (sky-look.mjs fog, fogColor); the four
// theme anchors carry none, so their stills are unchanged. Time stands still with the scene.
import * as THREE from "../three.module.min.js";
import { shorelineStrip } from "./water-optics.mjs?v=coast-water-20261018";

const SPAN = 95,
  TEXELS = 512;
// Sheet heights above the water (world units) and their share of the fog.
const SHEETS = [
  [0.14, 0.42],
  [0.42, 0.34],
  [0.78, 0.24],
];

const vertexShader = `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;

const fragmentShader = `
  #include <packing>
  uniform float uTime;
  uniform float uDensity;
  uniform float uSheet;
  uniform float uShare;
  uniform vec3 uAmbient;
  uniform vec3 uSunLight;
  uniform vec3 uView;
  uniform vec3 uLightDir;
  uniform float uShafts;
  uniform sampler2D uShore;
  uniform sampler2D uShadowMap;
  uniform mat4 uShadowMatrix;
  uniform vec2 uShadowTexel;
  varying vec3 vWorld;

  float fogHash(vec2 p) {
    uvec2 q = uvec2(ivec2(floor(p)) + 8192);
    uint h = q.x * 73856093u ^ q.y * 19349663u;
    h ^= h >> 16u; h *= 0x7feb352du; h ^= h >> 15u;
    return float(h) * (1. / 4294967296.);
  }
  float fogNoise(vec2 p) {
    vec2 i = floor(p), u = fract(p);
    u = u * u * (3. - 2. * u);
    return mix(mix(fogHash(i), fogHash(i + vec2(1., 0.)), u.x), mix(fogHash(i + vec2(0., 1.)), fogHash(i + vec2(1., 1.)), u.x), u.y);
  }
  float lit(vec3 world) {
    vec4 c = uShadowMatrix * vec4(world, 1.);
    vec3 s = c.xyz / c.w;
    if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 1.;
    float l = 0.;
    l += step(s.z - .002, unpackRGBAToDepth(texture2D(uShadowMap, s.xy + uShadowTexel * vec2(-1.5, -.5))));
    l += step(s.z - .002, unpackRGBAToDepth(texture2D(uShadowMap, s.xy + uShadowTexel * vec2(.5, -1.5))));
    l += step(s.z - .002, unpackRGBAToDepth(texture2D(uShadowMap, s.xy + uShadowTexel * vec2(1.5, .5))));
    l += step(s.z - .002, unpackRGBAToDepth(texture2D(uShadowMap, s.xy + uShadowTexel * vec2(-.5, 1.5))));
    return l * .25;
  }

  void main() {
    float shore = texture2D(uShore, vec2((vWorld.x + ${SPAN.toFixed(1)}) / ${(2 * SPAN).toFixed(1)}, .5)).r;
    float d = vWorld.z - shore;
    // Densest over the surf line and the beach, thinning inland and out over the open water.
    float band = smoothstep(-6., -1.5, d) * (1. - smoothstep(.8, 3., d));
    if (band * uDensity < .002) discard;
    // Banks of fog drifting along the coast, torn into wisps.
    vec2 q = vWorld.xz * vec2(.12, .42) + vec2(uTime * .025 + uSheet * 5.3, uTime * .006 - uSheet * 1.7);
    float n = fogNoise(q) * .62 + fogNoise(q * 2.3 + 7.1) * .26 + fogNoise(q * 5.1 - 3.3) * .12;
    float density = band * smoothstep(.34, .8, n) * uDensity * uShare;
    if (density < .002) discard;
    // Forward scattering (Henyey-Greenstein, g = .6) of the key light where it reaches the fog.
    float mu = dot(uView, uLightDir);
    float phase = (1. - .36) / pow(1. + .36 - 1.2 * mu, 1.5) * .25;
    vec3 color = uAmbient + uSunLight * lit(vWorld) * phase * uShafts;
    gl_FragColor = vec4(color, clamp(density, 0., .85));
  }`;

export function createMarineLayer({ profile = [], sun }) {
  const strip = shorelineStrip(profile, TEXELS, SPAN);
  const shore = new THREE.DataTexture(
    Uint16Array.from(strip, (z) => THREE.DataUtils.toHalfFloat(z)),
    TEXELS,
    1,
    THREE.RedFormat,
    THREE.HalfFloatType
  );
  shore.minFilter = shore.magFilter = THREE.LinearFilter;
  shore.needsUpdate = true;
  const shared = {
    uTime: { value: 0 },
    uDensity: { value: 0 },
    uAmbient: { value: new THREE.Color() },
    uSunLight: { value: new THREE.Color() },
    uView: { value: new THREE.Vector3(0, -0.39, -0.92) },
    uLightDir: { value: new THREE.Vector3(0, 1, 0) },
    uShafts: { value: 0 },
    uShore: { value: shore },
    uShadowMap: { value: null },
    uShadowMatrix: { value: sun.shadow.matrix },
    uShadowTexel: { value: new THREE.Vector2(1 / 2048, 1 / 1024) },
  };
  const geometry = new THREE.PlaneGeometry(190, 26).rotateX(-Math.PI / 2);
  const group = new THREE.Group();
  group.name = "MarineLayer";
  const materials = SHEETS.map(([height, share], i) => {
    const material = new THREE.ShaderMaterial({
      uniforms: { ...shared, uSheet: { value: i }, uShare: { value: share } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `MarineLayer${i}`;
    mesh.position.set(0, height, 4);
    // After the sea, which it veils; out of the mirror, the shadows and the contact pass.
    mesh.renderOrder = 10 + i;
    mesh.frustumCulled = false;
    mesh.userData.noOcclusion = true;
    group.add(mesh);
    return material;
  });
  group.visible = false;
  let wanted = false;
  return {
    object: group,
    // The hour's fog: density and display color (scene colors from the caller), and how strongly the
    // sun's light, coming from `lightDir`, scatters toward a camera looking along `view`.
    set({ density, ambient, sunLight, shafts, lightDir }) {
      shared.uDensity.value = density;
      shared.uAmbient.value.copy(ambient);
      shared.uSunLight.value.copy(sunLight);
      shared.uShafts.value = shafts;
      shared.uLightDir.value.fromArray(lightDir);
      wanted = density > 0.004;
      group.visible = wanted && Boolean(sun.shadow.map);
    },
    update(camera, seconds) {
      shared.uTime.value = seconds;
      shared.uView.value.set(0, 0, -1).applyQuaternion(camera.quaternion);
      shared.uShadowMap.value = sun.shadow.map?.texture ?? null;
      if (sun.shadow.map) shared.uShadowTexel.value.set(1 / sun.shadow.map.width, 1 / sun.shadow.map.height);
      // The fog waits for the first shadow map rather than sampling nothing.
      group.visible = wanted && shared.uShadowMap.value !== null;
    },
    get visible() {
      return group.visible;
    },
    evidence() {
      return { visible: group.visible, density: +shared.uDensity.value.toFixed(3), shafts: +shared.uShafts.value.toFixed(3) };
    },
    dispose() {
      geometry.dispose();
      materials.forEach((m) => m.dispose());
      shore.dispose();
    },
  };
}
