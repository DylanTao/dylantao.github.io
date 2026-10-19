// The sky behind the footer coast at the ends of the day. The canvas is transparent, so by day the
// page is the sky; from golden hour through the blue hour (and at dawn) this one screen-space layer
// paints the sky and the open Pacific beyond the coast. The sky grades from gold through apricot and
// rose to violet and fades into the page at the top; the sun, flattened by refraction near the
// horizon, sinks through the marine layer's haze bank into the sea and lays a glitter path across
// it; its glow and rays outlast it into the afterglow. It sits at the far plane behind every
// surface, draws only while it shows, and stays out of the sea's mirror and the contact pass.
//
// The layer composites in display colors (what the reader should see) and then inverts the output
// pass's ACES filmic curve (three r164 ACESFilmicToneMapping), so the authored colors land as
// authored instead of washing out under the tone mapping the lit coast needs.
import * as THREE from "../three.module.min.js";

// three's ACES input and output matrices, row-major, and their inverses.
const ACES_IN = [0.59719, 0.35458, 0.04823, 0.076, 0.90834, 0.01566, 0.0284, 0.13383, 0.83777];
const ACES_OUT = [1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602];
const inverse = (m) => new THREE.Matrix3().set(...m).invert();
const ACES_IN_INVERSE = inverse(ACES_IN),
  ACES_OUT_INVERSE = inverse(ACES_OUT);
const fitInverse = (y) => {
  const a = 1 - 0.983729 * y,
    b = 0.0245786 - 0.432951 * y,
    c = -(0.000090537 + 0.238081 * y);
  return (-b + Math.sqrt(Math.max(b * b - 4 * a * c, 0))) / (2 * a);
};
const scratch = new THREE.Vector3();
// The scene color the output pass tone-maps to `display` (a linear display color) at `exposure`;
// the same inversion as the shader's, for colors set from script (the coast's haze).
export function sceneColor(display, exposure, out = new THREE.Color()) {
  scratch.set(display.r, display.g, display.b).applyMatrix3(ACES_OUT_INVERSE);
  scratch.set(...scratch.toArray().map((y) => fitInverse(Math.min(Math.max(y, 0), 0.99)))).applyMatrix3(ACES_IN_INVERSE);
  return out.setRGB(...scratch.toArray().map((v) => (Math.max(v, 0) * 0.6) / exposure));
}

const vertexShader = `
  varying vec2 vScreen;
  void main() {
    vScreen = position.xy * .5 + .5;
    gl_Position = vec4(position.xy, .99995, 1.);
  }`;

const fragmentShader = `
  uniform float uAlpha;
  uniform vec3 uHorizon;
  uniform vec3 uMid;
  uniform vec3 uTop;
  uniform vec3 uSea;
  uniform vec3 uBank;
  uniform float uBankAlpha;
  uniform vec4 uSun;      // x, y (screen fractions), radius (of the height), disk visibility
  uniform vec3 uSunColor;
  uniform float uSunWhite;
  uniform vec3 uHalo;
  uniform float uSunGlow;
  uniform float uRays;
  uniform float uGlitter;
  uniform float uHorizonY; // the sea horizon, as a fraction of the height
  uniform float uDegree;   // one degree of altitude, as a fraction of the height
  uniform float uAspect;
  uniform float uTime;
  uniform float uExposure;
  uniform mat3 uAcesIn;
  uniform mat3 uAcesOut;
  varying vec2 vScreen;

  float skyHash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
  float skyNoise(float x) {
    float i = floor(x), f = fract(x);
    return mix(skyHash(i), skyHash(i + 1.), f * f * (3. - 2. * f));
  }
  vec3 screenBlend(vec3 base, vec3 light) { return 1. - (1. - base) * (1. - clamp(light, 0., 1.)); }
  // A display color to the scene color the output pass tone-maps back to it.
  vec3 sceneLinear(vec3 display) {
    vec3 y = clamp(uAcesOut * display, 0., .99);
    vec3 a = 1. - .983729 * y, b = .0245786 - .432951 * y, c = -(.000090537 + .238081 * y);
    vec3 v = (-b + sqrt(max(b * b - 4. * a * c, 0.))) / (2. * a);
    return max(uAcesIn * v, 0.) * (.6 / uExposure);
  }

  void main() {
    vec2 p = vScreen;
    float h = p.y - uHorizonY;
    float above = h / max(1. - uHorizonY, .05);
    // Gold low, apricot and rose above, violet high.
    vec3 sky = mix(uHorizon, uMid, smoothstep(0., .5, above));
    sky = mix(sky, uTop, smoothstep(.35, 1., above));
    // The sun, squashed by refraction as it nears the horizon, and its glow (aspect-correct). The glow
    // follows the sun below the horizon, so the twilight stays brightest where it set.
    float squash = 1. + .22 * (1. - smoothstep(0., 3. * uSun.z, uSun.y - uHorizonY));
    vec2 d = vec2((p.x - uSun.x) * uAspect, (p.y - uSun.y) * squash);
    float r = length(d) / max(uSun.z, 1e-4);
    float glow = (exp(-r * 1.1) * .45 + exp(-r * .16) * .3 + exp(-r * .045) * .2) * uSunGlow;
    sky = screenBlend(sky, uHalo * glow);
    // Crepuscular rays: soft bands fanning from the sun through the haze above the horizon.
    float angle = atan(d.y, d.x);
    float beams = skyNoise(angle * 4.1 + 2.1 + uTime * .01) * .6 + skyNoise(angle * 9.3 - uTime * .015) * .4;
    float rays = smoothstep(.5, .9, beams) * exp(-r * .055) * smoothstep(1.4, 3.5, r) * smoothstep(0., 2. * uDegree, h) * uRays;
    sky = screenBlend(sky, uHalo * rays * .35);
    // The open Pacific beyond the coast: a band lighter toward the horizon, with the sun's glow and
    // its glitter path, short dashes of light on the distant swell; nearer, it dissolves into the haze
    // the coast's farthest hills fade into (scene.mjs sets their fog to the same color).
    float below = max(-h, 0.);
    vec3 sea = mix(uSea * 1.1, uSea * .9, smoothstep(0., 2. * uDegree, below));
    float spread = uSun.z * (1. + below / max(uDegree, 1e-4) * .55);
    float column = (p.x - uSun.x) * uAspect / spread;
    float rows = floor(below / max(uDegree * .16, 1e-5));
    float dashes = skyNoise(p.x * uAspect * 90. + rows * 7.31 + uTime * .5) * skyNoise(rows * 3.7 - uTime * .9 + p.x * 11.);
    float glint = exp(-column * column) * (.25 + 1.6 * smoothstep(.2, .6, dashes)) * uGlitter * uSun.w;
    sea = screenBlend(sea, uHalo * glow * .55 + uSunColor * glint);
    vec3 haze = mix(uBank * 1.05, uBank * .9, smoothstep(3.6 * uDegree, 12. * uDegree, below));
    sea = mix(sea, screenBlend(haze, uHalo * glow * .5), smoothstep(1.4 * uDegree, 3.6 * uDegree, below));
    vec3 color = mix(sea, sky, smoothstep(-.0012, .0012, h));
    // The disk sinks into the sea: the horizon clips it.
    float disk = (1. - smoothstep(.9, 1.04, r)) * uSun.w * smoothstep(-.0012, .0012, h);
    // The marine layer's haze bank, lying on the horizon with a lumpy top: lit from behind near the
    // sun, it dims and reddens the disk sinking into it.
    float top = uDegree * (.9 + .7 * skyNoise(p.x * 6.5 + uTime * .004) + .35 * skyNoise(p.x * 21. - uTime * .006));
    float bank = (1. - smoothstep(top * .25, top, h)) * smoothstep(-3. * uDegree, -.3 * uDegree, h) * uBankAlpha;
    vec3 sun = mix(mix(uSunColor, vec3(1., .97, .9), uSunWhite * (1. - r * r)), uSunColor * vec3(1., .7, .5), min(bank * 1.5, 1.));
    color = mix(color, sun, disk);
    color = mix(color, screenBlend(uBank, uHalo * glow * 1.3), bank * (1. - disk * .85));
    // Opaque over the haze, the far sea and the low sky, fading into the page near the top.
    float fade = smoothstep(.55, 1.02, above);
    float alpha = uAlpha * (1. - fade * fade);
    alpha = max(alpha, max(disk, min(glow * 1.2, 1.)) * uAlpha);
    gl_FragColor = vec4(sceneLinear(color), clamp(alpha, 0., 1.));
  }`;

export function createSky() {
  const uniforms = {
    uAlpha: { value: 0 },
    uHorizon: { value: new THREE.Color() },
    uMid: { value: new THREE.Color() },
    uTop: { value: new THREE.Color() },
    uSea: { value: new THREE.Color() },
    uBank: { value: new THREE.Color() },
    uBankAlpha: { value: 0 },
    uSun: { value: new THREE.Vector4(0.6, 0.6, 0.04, 0) },
    uSunColor: { value: new THREE.Color() },
    uSunWhite: { value: 0 },
    uHalo: { value: new THREE.Color() },
    uSunGlow: { value: 0 },
    uRays: { value: 0 },
    uGlitter: { value: 0 },
    uHorizonY: { value: 0.72 },
    uDegree: { value: 0.04 },
    uAspect: { value: 4 },
    uTime: { value: 0 },
    uExposure: { value: 1 },
    uAcesIn: { value: ACES_IN_INVERSE },
    uAcesOut: { value: ACES_OUT_INVERSE },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: true });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "CoastSky";
  mesh.frustumCulled = false;
  // Transparent surfaces draw back to front by render order: the sky goes first, before the sea.
  mesh.renderOrder = -1000;
  mesh.userData.noOcclusion = true;
  mesh.visible = false;
  return {
    mesh,
    // Colors and strengths from the look (sky-look.mjs), as display colors; the disk shows only
    // while the sun is up on the coast's side.
    set(look, sun) {
      uniforms.uAlpha.value = look.skyAlpha;
      uniforms.uHorizon.value.set(look.skyHorizon);
      uniforms.uMid.value.set(look.skyMid);
      uniforms.uTop.value.set(look.skyTop);
      uniforms.uSea.value.set(look.seaFar);
      uniforms.uBank.value.set(look.bank);
      uniforms.uBankAlpha.value = look.bankAlpha;
      uniforms.uSunColor.value.set(look.sunDisk);
      uniforms.uSunWhite.value = look.sunWhite;
      uniforms.uHalo.value.set(look.sunHalo);
      uniforms.uSunGlow.value = sun?.setting ? look.sunGlow : 0;
      uniforms.uRays.value = sun?.setting ? look.rays : 0;
      uniforms.uGlitter.value = look.glitter;
      uniforms.uExposure.value = look.exposure;
      uniforms.uSun.value.w = sun?.visible ? 1 : 0;
      mesh.visible = look.skyAlpha > 0.004;
    },
    // Screen placement: the sea horizon (fraction of the height from the bottom), the sun's place
    // against it, and the canvas aspect. `degree` is one degree of solar altitude as a fraction of
    // the height; `radius` the disk's radius.
    place({ horizon, aspect, sunX, sunUp, degree, radius }) {
      uniforms.uHorizonY.value = horizon;
      uniforms.uDegree.value = degree;
      uniforms.uAspect.value = aspect;
      uniforms.uSun.value.x = sunX;
      uniforms.uSun.value.y = horizon + sunUp * degree;
      uniforms.uSun.value.z = radius;
    },
    tick(seconds) {
      uniforms.uTime.value = seconds;
    },
    get visible() {
      return mesh.visible;
    },
    evidence() {
      return {
        visible: mesh.visible,
        alpha: +uniforms.uAlpha.value.toFixed(3),
        horizon: +uniforms.uHorizonY.value.toFixed(3),
        sun: uniforms.uSun.value.w ? [+uniforms.uSun.value.x.toFixed(3), +uniforms.uSun.value.y.toFixed(3)] : null,
      };
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
