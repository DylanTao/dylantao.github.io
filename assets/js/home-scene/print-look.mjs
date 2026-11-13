import * as THREE from "../three.module.min.js";
import { Pass, FullScreenQuad } from "../vendor/three-r164/postprocessing/Pass.js";

// A woodblock-print reading of the finished frame: an experiment, off unless ?print=1 or the lab's
// toggle asks for it. The realistic render stays the source; this pass redraws it the way a
// shin-hanga printer would cut it into blocks.
//
//   keyblock  one line block, cut where the depth buffer creases or breaks
//   colour    flat areas: texture is averaged away inside each surface, values settle into a few
//             steps, and shadows lean toward one blue instead of toward black
//   colourway the hour picks the paper tone, the ink and the shadow blue. Hiroshi Yoshida printed
//             one set of blocks as morning, afternoon, mist, evening and night (Sailing Boats, 1926);
//             the same idea drives this site's themes
//   paper     fibre and the baren's uneven pressure, fixed to the sheet, not to the world
//
// Principles only: no print, scan or texture is copied, and nothing here is learned. It replaces the
// output pass while it is on (it tone-maps and encodes the frame itself), so it costs one full-screen
// draw with 22 texture reads and adds no render target.

export const PRINT_KEY = "scene-print";

// ?print=1|0 for the session, like the look lab's flags (look.mjs).
export function readPrintLook(search = "", storage = null) {
  const params = new URLSearchParams(search);
  let saved = false;
  try {
    saved = storage?.getItem(PRINT_KEY) === "1";
  } catch {
    saved = false;
  }
  const enabled = params.has("print") ? params.get("print") !== "0" : saved;
  writePrintLook(enabled, storage);
  return enabled;
}

export function writePrintLook(enabled, storage = null) {
  try {
    if (enabled) storage?.setItem(PRINT_KEY, "1");
    else storage?.removeItem(PRINT_KEY);
  } catch {
    /* Private browsing may refuse storage; the URL still applies. */
  }
}

// Björn Ottosson's OKLab (https://bottosson.github.io/posts/oklab/), written once and used by both
// the shader below and the unit test, so the two cannot drift.
export const OKLAB = Object.freeze({
  toLms: [
    [0.4122214708, 0.5363325363, 0.0514459929],
    [0.2119034982, 0.6806995451, 0.1073969566],
    [0.0883024619, 0.2817188376, 0.6299787005],
  ],
  toLab: [
    [0.2104542553, 0.793617785, -0.0040720468],
    [1.9779984951, -2.428592205, 0.4505937099],
    [0.0259040371, 0.7827717662, -0.808675766],
  ],
  fromLab: [
    [1, 0.3963377774, 0.2158037573],
    [1, -0.1055613458, -0.0638541728],
    [1, -0.0894841775, -1.291485548],
  ],
  fromLms: [
    [4.0767416621, -3.3077115913, 0.2309699292],
    [-1.2684380046, 2.6097574011, -0.3413193965],
    [-0.0041960863, -0.7034186147, 1.707614701],
  ],
});

const apply = (m, v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
export const linearToOklab = (rgb) =>
  apply(
    OKLAB.toLab,
    apply(OKLAB.toLms, rgb).map((x) => Math.cbrt(Math.max(x, 0)))
  );
export const oklabToLinear = (lab) =>
  apply(
    OKLAB.fromLms,
    apply(OKLAB.fromLab, lab).map((x) => x * x * x)
  );

// One colourway per printed hour. `paper` and `ink` are display sRGB; `shadow` is the OKLab a/b a deep
// shadow leans toward and how far; `sky` is the top band a printer would wipe darker (bokashi).
export const COLOURWAYS = Object.freeze([
  {
    at: 0,
    name: "night",
    paper: [0.82, 0.86, 0.95],
    ink: [0.05, 0.07, 0.15],
    shadow: [-0.012, -0.085, 0.78],
    chroma: 0.94,
    sky: [0.05, 0.09, 0.24, 0.5],
  },
  {
    at: 330,
    name: "night",
    paper: [0.82, 0.86, 0.95],
    ink: [0.05, 0.07, 0.15],
    shadow: [-0.012, -0.085, 0.78],
    chroma: 0.94,
    sky: [0.05, 0.09, 0.24, 0.5],
  },
  {
    at: 420,
    name: "dawn",
    paper: [0.985, 0.94, 0.915],
    ink: [0.17, 0.12, 0.2],
    shadow: [0.02, -0.06, 0.6],
    chroma: 1.05,
    sky: [0.86, 0.5, 0.5, 0.22],
  },
  {
    at: 600,
    name: "morning",
    paper: [0.975, 0.955, 0.912],
    ink: [0.11, 0.12, 0.19],
    shadow: [-0.02, -0.075, 0.55],
    chroma: 1.08,
    sky: [0.2, 0.42, 0.74, 0.32],
  },
  {
    at: 780,
    name: "noon",
    paper: [0.972, 0.957, 0.918],
    ink: [0.09, 0.11, 0.18],
    shadow: [-0.03, -0.09, 0.6],
    chroma: 1.12,
    sky: [0.12, 0.32, 0.68, 0.42],
  },
  {
    at: 930,
    name: "afternoon",
    paper: [0.975, 0.952, 0.905],
    ink: [0.1, 0.12, 0.17],
    shadow: [-0.045, -0.055, 0.55],
    chroma: 1.08,
    sky: [0.16, 0.42, 0.68, 0.34],
  },
  {
    at: 1035,
    name: "dusk",
    paper: [0.99, 0.932, 0.865],
    ink: [0.14, 0.09, 0.18],
    shadow: [0.016, -0.085, 0.7],
    chroma: 1.1,
    sky: [0.24, 0.18, 0.5, 0.4],
  },
  {
    at: 1140,
    name: "evening",
    paper: [0.87, 0.88, 0.955],
    ink: [0.06, 0.07, 0.16],
    shadow: [-0.005, -0.09, 0.76],
    chroma: 0.98,
    sky: [0.07, 0.1, 0.3, 0.48],
  },
  {
    at: 1290,
    name: "night",
    paper: [0.82, 0.86, 0.95],
    ink: [0.05, 0.07, 0.15],
    shadow: [-0.012, -0.085, 0.78],
    chroma: 0.94,
    sky: [0.05, 0.09, 0.24, 0.5],
  },
]);

const mix = (a, b, t) => a + (b - a) * t;

// The colourway at a minute of the day, blended between its neighbours and continuous over midnight.
export function colourwayAt(minute = 780) {
  const m = ((Number(minute) % 1440) + 1440) % 1440;
  let next = COLOURWAYS.findIndex((way) => way.at > m);
  if (next < 0) next = COLOURWAYS.length;
  const a = COLOURWAYS[next - 1],
    b = COLOURWAYS[next % COLOURWAYS.length],
    span = (next < COLOURWAYS.length ? b.at : 1440) - a.at,
    t = span > 0 ? (m - a.at) / span : 0,
    blend = (key) => a[key].map((value, i) => mix(value, b[key][i], t));
  return {
    name: t < 0.5 ? a.name : b.name,
    paper: blend("paper"),
    ink: blend("ink"),
    shadow: blend("shadow"),
    chroma: mix(a.chroma, b.chroma, t),
    sky: blend("sky"),
  };
}

// The cutter's and printer's settings, exposed so a dial panel can move them.
export const PRINT_DEFAULTS = Object.freeze({
  lineRadius: 1.15, // keyline half-width in pixels at a 1080-pixel-high frame
  lineThreshold: 0.9, // slope change (rise over run) across the line that starts a cut
  lineSoftness: 1.6,
  lineStrength: 0.86,
  lineFade: [38, 85], // metres: where the keyblock thins out and stops
  foldStrength: 0.62, // folds inside a form print lighter than its outline
  outlineThreshold: 10, // slope change that counts as an outline
  clutterStrength: 0.22, // how much line survives in leaves and grass
  crossHue: 0.6, // how much of the green-magenta axis the pigments keep
  bands: 5, // value steps between paper and full ink
  bandSoftness: 0.12,
  bandMix: 0.45, // 0 keeps the render's gradation, 1 prints hard steps
  flatRadius: 4.2, // pixels at 1080 high: how far texture is averaged inside one surface
  flatRange: 0.065, // OKLab distance that counts as "the same block"
  misregister: [0.7, -0.45], // pixels the colour blocks sit off the keyblock
  paperGrain: 0.03,
  baren: 0.05,
  inkFloor: 0.17, // the darkest block is ink on paper, not black
  shadowPivot: 0.62,
});

const glslMatrix = (m) => `mat3(${[0, 1, 2].flatMap((column) => m.map((row) => row[column].toFixed(10))).join(", ")})`;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Twelve taps on two rings, turned a little so rows and columns do not line up with the pixel grid.
const RING = [
  [0.43, 0.26],
  [-0.26, 0.43],
  [-0.43, -0.26],
  [0.26, -0.43],
  [1, 0.08],
  [0.65, 0.76],
  [-0.08, 1],
  [-0.76, 0.65],
  [-1, -0.08],
  [-0.65, -0.76],
  [0.08, -1],
  [0.76, -0.65],
];

const fragmentShader = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 printResolution;
uniform vec4 printCamera;   // near, far, 1 perspective / 0 orthographic, radians (or metres) per pixel
uniform vec4 printLine;     // radius px, threshold, softness, strength
uniform vec2 printLineFade; // metres
uniform vec4 printWeight;   // fold strength, outline threshold, clutter strength, cross-hue gain
uniform vec4 printTone;     // bands, band softness, band mix, chroma gain
uniform vec4 printFlat;     // radius px, 1 / range^2, misregistration px
uniform vec3 printPaper;
uniform vec3 printInk;
uniform vec4 printShadow;   // OKLab a, b, amount, pivot lightness
uniform vec4 printSky;      // rgb, amount
uniform vec4 printGrain;    // paper, baren, ink floor, boil seed
varying vec2 vUv;

#include <tonemapping_pars_fragment>

const mat3 TO_LMS = ${glslMatrix(OKLAB.toLms)};
const mat3 TO_LAB = ${glslMatrix(OKLAB.toLab)};
const mat3 FROM_LAB = ${glslMatrix(OKLAB.fromLab)};
const mat3 FROM_LMS = ${glslMatrix(OKLAB.fromLms)};
const vec2 RING[12] = vec2[12](${RING.map(([x, y]) => `vec2(${x.toFixed(2)}, ${y.toFixed(2)})`).join(", ")});

// The frame arrives scene-referred; show it through the home's own tone curve first.
vec3 shown(vec3 hdr) {
  #if defined(ACES_FILMIC_TONE_MAPPING)
    return ACESFilmicToneMapping(hdr);
  #elif defined(AGX_TONE_MAPPING)
    return AgXToneMapping(hdr);
  #elif defined(NEUTRAL_TONE_MAPPING)
    return NeutralToneMapping(hdr);
  #elif defined(REINHARD_TONE_MAPPING)
    return ReinhardToneMapping(hdr);
  #elif defined(CINEON_TONE_MAPPING)
    return OptimizedCineonToneMapping(hdr);
  #else
    return LinearToneMapping(hdr);
  #endif
}
vec3 encode(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 lab(vec2 uv) { return TO_LAB * pow(max(TO_LMS * clamp(shown(texture2D(tDiffuse, uv).rgb), 0.0, 1.0), 0.0), vec3(1.0 / 3.0)); }
vec3 unlab(vec3 c) { vec3 lms = FROM_LAB * c; return encode(clamp(FROM_LMS * (lms * lms * lms), 0.0, 1.0)); }

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float depthAt(vec2 uv) { return texture2D(tDepth, uv).x; }

void main() {
  vec2 px = 1.0 / printResolution;
  vec2 sheet = vUv * printResolution;
  float scale = printResolution.y / 1080.0;

  // Colour blocks. Average inside one surface: a neighbour counts by how close its colour is.
  vec2 at = vUv + printFlat.zw * px * scale;
  vec3 centre = lab(at);
  vec3 sum = centre;
  float weight = 1.0;
  for (int i = 0; i < 12; i++) {
    vec3 c = lab(at + RING[i] * printFlat.x * scale * px);
    vec3 d = c - centre;
    float w = exp(-dot(d, d) * printFlat.y);
    sum += c * w;
    weight += w;
  }
  vec3 block = sum / weight;

  // Values settle into a few printed steps; the mix keeps some of the render's gradation (bokashi).
  float stepped = block.x * printTone.x;
  stepped = (floor(stepped) + smoothstep(0.5 - printTone.y, 0.5 + printTone.y, fract(stepped))) / printTone.x;
  float value = mix(block.x, stepped, printTone.z);

  // Shadows lean toward the colourway's blue instead of losing their colour.
  float shade = pow(clamp(1.0 - value / printShadow.w, 0.0, 1.0), 1.4) * printShadow.z;
  // A printer works from a few pigments. Keep the orange-to-blue axis the site is built on and
  // mute what lies across it, so greens go olive and nothing turns neon.
  vec2 warm = vec2(0.5, 0.866);
  vec2 chroma = warm * dot(block.yz, warm) + vec2(-warm.y, warm.x) * dot(block.yz, vec2(-warm.y, warm.x)) * printWeight.w;
  vec2 hue = mix(chroma * printTone.w, chroma * 0.5 + printShadow.xy, shade);
  vec3 colour = unlab(vec3(mix(printGrain.z, 1.0, value), hue));

  float depth = depthAt(vUv);
  float sky = step(0.999995, depth);
  colour = mix(colour, printSky.rgb, sky * printSky.a * smoothstep(0.5, 1.0, vUv.y));

  // The sheet: its tooth, a few long fibres, and the baren pressing unevenly so the darker blocks
  // take a little less ink in broad patches.
  float tooth = noise(sheet * 0.8 / scale + 17.0) - 0.5;
  float fibre = smoothstep(0.8, 1.0, noise(sheet * vec2(0.018, 0.42) / scale)) - smoothstep(0.82, 1.0, noise(sheet * vec2(0.4, 0.02) / scale + 9.0));
  float baren = noise(sheet * vec2(0.0035, 0.011) / scale + 5.0) * 0.65 + noise(sheet * vec2(0.021, 0.008) / scale + 2.0) * 0.35;
  colour *= printPaper * (1.0 + printGrain.x * (tooth + fibre * 0.6));
  colour = mix(colour, printPaper, printGrain.y * (1.0 - value) * smoothstep(0.35, 0.8, baren));

  // Keyblock. Depth is linear across a flat surface, so its second difference is zero there and
  // jumps at a crease or an edge; scaled this way it is the change of slope across the line. The
  // depth texture is unfiltered, so every tap sits on a texel centre a whole number of texels away:
  // off-centre taps would round unevenly and cut false lines into any sloping plane.
  vec2 wobble = (vec2(noise(sheet * 0.045 + printGrain.w), noise(sheet * 0.045 + 31.0 + printGrain.w)) - 0.5) * 1.3 * scale;
  vec2 here = (floor(sheet + wobble) + 0.5) * px;
  float z = printCamera.z > 0.5
    ? printCamera.x * printCamera.y / max(printCamera.y - depth * (printCamera.y - printCamera.x), 1e-5)
    : mix(printCamera.x, printCamera.y, depth);
  float r = max(1.0, floor(printLine.x * scale * mix(1.25, 0.8, smoothstep(2.0, 28.0, z)) + 0.5));
  vec2 dx = vec2(r, 0.0) * px, dy = vec2(0.0, r) * px, dd = vec2(r, r) * px, de = vec2(r, -r) * px;
  float c0 = depthAt(here);
  vec4 across = vec4(
    abs(depthAt(here + dx) + depthAt(here - dx) - 2.0 * c0),
    abs(depthAt(here + dy) + depthAt(here - dy) - 2.0 * c0),
    abs(depthAt(here + dd) + depthAt(here - dd) - 2.0 * c0) * 0.7071,
    abs(depthAt(here + de) + depthAt(here - de) - 2.0 * c0) * 0.7071
  );
  float second = max(max(across.x, across.y), max(across.z, across.w));
  float crease = printCamera.z > 0.5
    ? z * second * (printCamera.y - printCamera.x) / (printCamera.x * printCamera.y * printCamera.w * r)
    : second * (printCamera.y - printCamera.x) / (printCamera.w * r);
  // A line runs somewhere: along it the depth stays flat. Where every direction breaks at once
  // (leaves, grass, gravel) a cutter leaves the mass to the colour block and only stipples it.
  float along = min(min(across.x, across.y), min(across.z, across.w));
  float clutter = smoothstep(0.28, 0.62, along / (second + 1e-12));
  // Outlines are cut deeper than the folds inside a form.
  float fold = smoothstep(printLine.y, printLine.y + printLine.z, crease) * printWeight.x;
  float outline = smoothstep(printWeight.y, printWeight.y * 5.0, crease);
  float cut = max(fold, outline) * mix(1.0, printWeight.z, clutter) * (1.0 - smoothstep(printLineFade.x, printLineFade.y, z)) * (1.0 - sky);
  colour = mix(colour, printInk * printPaper, cut * printLine.w);

  gl_FragColor = vec4(colour, 1.0);
}`;

export function createPrintLook({ enabled = false, settings = {} } = {}) {
  const dials = { ...PRINT_DEFAULTS, ...settings };
  const uniforms = {
    tDiffuse: { value: null },
    tDepth: { value: null },
    printResolution: { value: new THREE.Vector2(1, 1) },
    printCamera: { value: new THREE.Vector4(0.05, 300, 1, 0.001) },
    printLine: { value: new THREE.Vector4() },
    printLineFade: { value: new THREE.Vector2() },
    printWeight: { value: new THREE.Vector4() },
    printTone: { value: new THREE.Vector4() },
    printFlat: { value: new THREE.Vector4() },
    printPaper: { value: new THREE.Vector3(1, 1, 1) },
    printInk: { value: new THREE.Vector3(0, 0, 0) },
    printShadow: { value: new THREE.Vector4() },
    printSky: { value: new THREE.Vector4() },
    printGrain: { value: new THREE.Vector4() },
    toneMappingExposure: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    name: "Woodblock print",
    uniforms,
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const quad = new FullScreenQuad(material);
  const toneDefines = {
    [THREE.LinearToneMapping]: "LINEAR_TONE_MAPPING",
    [THREE.ReinhardToneMapping]: "REINHARD_TONE_MAPPING",
    [THREE.CineonToneMapping]: "CINEON_TONE_MAPPING",
    [THREE.ACESFilmicToneMapping]: "ACES_FILMIC_TONE_MAPPING",
    [THREE.AgXToneMapping]: "AGX_TONE_MAPPING",
    [THREE.NeutralToneMapping]: "NEUTRAL_TONE_MAPPING",
  };
  let sceneDepth = null,
    tone = null,
    way = colourwayAt(780),
    minute = 780,
    // The view's full height in radians (perspective) or metres (orthographic); divided by the
    // drawn buffer's height it is one pixel's share.
    extent = 1,
    draws = 0;

  // Sits straight after the beauty pass, whose target owns the scene's depth for the whole frame.
  const tap = new Pass();
  tap.needsSwap = false;
  tap.render = (_renderer, _writeBuffer, readBuffer) => {
    sceneDepth = readBuffer.depthTexture;
  };

  function sync() {
    uniforms.printLine.value.set(dials.lineRadius, dials.lineThreshold, dials.lineSoftness, dials.lineStrength);
    uniforms.printLineFade.value.set(...dials.lineFade);
    uniforms.printWeight.value.set(dials.foldStrength, dials.outlineThreshold, dials.clutterStrength, dials.crossHue);
    uniforms.printTone.value.set(dials.bands, dials.bandSoftness, dials.bandMix, way.chroma);
    uniforms.printFlat.value.set(dials.flatRadius, 1 / (dials.flatRange * dials.flatRange), ...dials.misregister);
    uniforms.printPaper.value.set(...way.paper);
    uniforms.printInk.value.set(...way.ink);
    uniforms.printShadow.value.set(way.shadow[0], way.shadow[1], way.shadow[2], dials.shadowPivot);
    uniforms.printSky.value.set(...way.sky);
    uniforms.printGrain.value.set(dials.paperGrain, dials.baren, dials.inkFloor, uniforms.printGrain.value.w);
  }
  sync();

  // Last in the chain, in the output pass's place: reading the frame before it is tone-mapped means
  // nothing draws into the beauty target again. (A multisampled target discards its depth samples
  // once resolved, so a second resolve would overwrite the scene's depth with nothing.)
  const pass = new Pass();
  pass.needsSwap = false;
  pass.enabled = Boolean(enabled);
  pass.render = (renderer, _writeBuffer, readBuffer) => {
    if (tone !== renderer.toneMapping) {
      tone = renderer.toneMapping;
      material.defines = toneDefines[tone] ? { [toneDefines[tone]]: "" } : {};
      material.needsUpdate = true;
    }
    uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    uniforms.tDiffuse.value = readBuffer.texture;
    uniforms.tDepth.value = sceneDepth || readBuffer.depthTexture;
    uniforms.printResolution.value.set(readBuffer.width, readBuffer.height);
    uniforms.printCamera.value.w = extent / Math.max(1, readBuffer.height);
    renderer.setRenderTarget(pass.renderToScreen ? null : readBuffer);
    quad.render(renderer);
    draws++;
  };

  return {
    pass,
    tap,
    material,
    dials,
    get enabled() {
      return pass.enabled;
    },
    set enabled(value) {
      pass.enabled = Boolean(value);
    },
    // Each frame: the camera that drew it, the home's minute, and whether lines may shift (they hold
    // still when motion is reduced or paused).
    prepare(camera, { minute: nextMinute = minute, seconds = 0, still = true } = {}) {
      const perspective = camera.isPerspectiveCamera;
      extent = (perspective ? 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) : camera.top - camera.bottom) / camera.zoom;
      uniforms.printCamera.value.set(camera.near, camera.far, perspective ? 1 : 0, uniforms.printCamera.value.w);
      if (Number.isFinite(nextMinute) && nextMinute !== minute) {
        minute = nextMinute;
        way = colourwayAt(minute);
        sync();
      }
      // The cutter's hand: lines resettle six times a second, never continuously.
      uniforms.printGrain.value.w = still ? 0 : Math.floor(seconds * 6) * 7.31;
    },
    set(next = {}) {
      Object.assign(dials, next);
      sync();
    },
    evidence() {
      return { enabled: pass.enabled, colourway: way.name, minute, draws, textureReads: 22, renderTargets: 0, dials: { ...dials } };
    },
    dispose() {
      quad.dispose();
      material.dispose();
    },
  };
}
