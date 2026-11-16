import * as THREE from "../three.module.min.js";
import { Pass, FullScreenQuad } from "../vendor/three-r164/postprocessing/Pass.js";

// Drawn readings of the finished frame: experiments, off unless ?look=toon, ?look=print, ?print=1
// or the lab's switch asks for one. The realistic render stays the source; this pass redraws it.
// Two looks share the pass and differ only in their settings (LOOKS below), so changing look
// compiles nothing:
//
//   print  the way a shin-hanga printer would cut the frame into blocks
//   toon   a television cartoon: white paper, lifted flat colour, one even dark outline
//
// The blocks, as the woodblock uses them:
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
// output pass while it is on (it tone-maps and encodes the frame itself), so the woodblock costs one
// full-screen draw with 22 texture reads and adds no render target.
//
// The cartoon draws from the scene's structure instead of from the finished frame's depth (Sirui,
// November 14, 2026: "too fuzzy and too vague ... like you just apply a cheap filter"; "details are
// crisp"). While it is on, the scene is drawn once more into a small buffer that says, for every
// pixel, which object is there, which way its surface faces and how far away it is
// (createStructure). Lines are then cut exactly where two objects meet, where a surface breaks in
// depth and where it folds, each with its own weight, and flat colour is averaged only inside one
// object, so a fill stops at the object's edge. Nothing of this runs for the realistic render.

export const PRINT_KEY = "scene-print";
// "realistic" is the render itself; these redraw it.
export const DRAWN_LOOKS = Object.freeze(["toon", "print"]);
// Sirui, November 13, on the woodblock: "a bit too grim", "maybe a bit more rick and morty vibe".
// The cartoon is what ?print=1 now means; ?look=print keeps the woodblock.
export const DEFAULT_DRAWN_LOOK = "toon";

// The look for this session: ?look=toon|print|realistic, or the older ?print=1|0, which asks for the
// drawn look last used (the cartoon if none). The choice is remembered like the look lab's flags.
export function readDrawnLook(search = "", storage = null) {
  const params = new URLSearchParams(search);
  let saved = null;
  try {
    saved = storage?.getItem(PRINT_KEY) ?? null;
  } catch {
    saved = null;
  }
  // A session that switched the print on before the looks had names stored "1".
  if (saved === "1") saved = DEFAULT_DRAWN_LOOK;
  if (!DRAWN_LOOKS.includes(saved)) saved = null;
  const asked = params.get("look");
  let look = saved || "realistic";
  if (asked === "realistic" || DRAWN_LOOKS.includes(asked)) look = asked;
  else if (params.has("print")) look = params.get("print") === "0" ? "realistic" : saved || DEFAULT_DRAWN_LOOK;
  writeDrawnLook(look, storage);
  return look;
}

export function writeDrawnLook(look, storage = null) {
  try {
    if (DRAWN_LOOKS.includes(look)) storage?.setItem(PRINT_KEY, look);
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
  lift: 1, // exponent on lightness before it is stepped: below 1 opens the darks
  ceiling: 1, // what the brightest surface is scaled to before stepping: below 1 keeps the top step for lamps and sky
  open: 1, // exponent on the stepped value: below 1 prints the lit and shadow steps lighter
  // Drawing from the scene's structure (createStructure) instead of the frame's depth. Off for the
  // woodblock, whose keyblock is cut from depth alone.
  structure: 0,
  inkRadius: 2.2, // pixels at 1080 high: the reach of the heaviest line, an outline
  edgeGap: [0.05, 0.006], // metres apart, plus this per metre of distance, before a surface counts as broken
  creaseTurn: 0.16, // 1 - cos of the fold that starts a line inside a form (about 33 degrees)
  creaseFade: 22, // metres: where folds inside forms thin out (twice this, and they are gone)
});

// What each drawn look changes: its settings, and what it does to the hour's colourway.
export const LOOKS = Object.freeze({
  print: Object.freeze({ label: "Woodblock", dials: Object.freeze({}), way: (way) => way }),
  // A cartoon keeps the hour (a dusk is still a dusk) but not the paper: near-white ground, darks
  // opened and held off black, three hard flat steps (a soft shadow becomes a shape with an edge,
  // not an airbrushed stain), every hue kept (greens stay green), shadows that darken more than they
  // turn blue, no grain, and lines drawn from the scene's structure in three weights. The top step
  // is kept for lamps and sky (`ceiling`): a sunlit cliff or cushion stays one flat tone of its own
  // colour instead of breaking into white patches, and the lit and shadow steps print light (`open`).
  toon: Object.freeze({
    label: "Cartoon",
    dials: Object.freeze({
      lineRadius: 1.5,
      lineStrength: 0.95,
      foldStrength: 0.85,
      clutterStrength: 0.14,
      crossHue: 1,
      bands: 3,
      bandSoftness: 0.03,
      bandMix: 1,
      flatRadius: 5.5,
      flatRange: 0.085,
      misregister: Object.freeze([0, 0]),
      paperGrain: 0,
      baren: 0,
      inkFloor: 0.3,
      shadowPivot: 0.5,
      lift: 0.8,
      ceiling: 0.86,
      open: 0.62,
      structure: 1,
    }),
    way: (way) => ({
      ...way,
      paper: way.paper.map((value) => value + (1 - value) * 0.8),
      ink: [0.1, 0.085, 0.13],
      shadow: [way.shadow[0], way.shadow[1], way.shadow[2] * 0.35],
      chroma: way.chroma * 1.4,
      sky: [...way.sky.slice(0, 3).map((value, i) => value + ([0.3, 0.62, 0.92][i] - value) * 0.3), way.sky[3] * 0.7],
    }),
  }),
});

const glslMatrix = (m) => `mat3(${[0, 1, 2].flatMap((column) => m.map((row) => row[column].toFixed(10))).join(", ")})`;

// Objects are told apart by a number from 1 to 2047: a half-float holds every whole number up to
// 2048 exactly, and 0 means nothing was drawn. Knuth's multiplicative hash spreads neighbouring
// three.js ids apart; a part with its own material counts as its own object, so a cushion and its
// sofa get a line between them.
export const STRUCTURE_IDS = 2047;
export function structureId(objectId, materialIndex = 0) {
  return ((Math.imul((objectId * 31 + materialIndex + 1) | 0, 2654435761) >>> 0) % STRUCTURE_IDS) + 1;
}

// What the structure pass leaves out, as the beauty pass shows it: anything see-through (glass,
// water, steam: what is behind them must keep its lines), cut-out cards whose shape lives in a
// texture this pass does not read, and shadow-only stand-ins.
export function structureSkips(material) {
  return (
    !material ||
    material.visible === false ||
    material.colorWrite === false ||
    material.transparent === true ||
    material.opacity < 1 ||
    material.alphaTest > 0 ||
    material.transmission > 0 ||
    Boolean(material.alphaMap)
  );
}

// The scene drawn once more with one small material: view normal (xy), object id and view depth in
// metres, in one half-float target the size of the frame. three's own normal shader supplies the
// vertex stage, so skinned figures, morphs and instances stand where the beauty pass drew them.
export function createStructure() {
  const base = THREE.ShaderLib.normal;
  const vertexShader = base.vertexShader
    .replace("void main() {", "varying float vStructureDepth;\nvoid main() {")
    .replace("#include <project_vertex>", "#include <project_vertex>\n\tvStructureDepth = -mvPosition.z;");
  const fragmentShader = /* glsl */ `
#define NORMAL
uniform vec2 structureObject; // id, 1 to leave this object out
varying float vStructureDepth;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
  varying vec3 vViewPosition;
#endif
#include <normal_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
  #include <clipping_planes_fragment>
  if (structureObject.y > 0.5) discard;
  #include <normal_fragment_begin>
  gl_FragColor = vec4(normal.xy, structureObject.x, vStructureDepth);
}`;
  const uniforms = { structureObject: { value: new THREE.Vector2() } };
  const material = new THREE.ShaderMaterial({
    name: "Scene structure",
    uniforms,
    vertexShader,
    fragmentShader,
    // Back faces of two-sided things keep a normal that faces the camera.
    defines: { DOUBLE_SIDED: "" },
    side: THREE.DoubleSide,
  });
  // Each object brings its id, and is culled the way its own material is, so a wall the beauty pass
  // looks through from behind is looked through here too.
  material.onBeforeRender = (_renderer, _scene, _camera, _geometry, object, group) => {
    const index = group?.materialIndex ?? 0,
      source = Array.isArray(object.material) ? object.material[index] : object.material;
    uniforms.structureObject.value.set(structureId(object.id, index), structureSkips(source) ? 1 : 0);
    material.side = source?.side ?? THREE.FrontSide;
    material.uniformsNeedUpdate = true;
  };
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.name = "Scene structure";
  const hidden = [],
    clearColor = new THREE.Color();
  let draws = 0,
    calls = 0;
  return {
    target,
    material,
    resize(width, height) {
      if (target.width !== width || target.height !== height) target.setSize(width, height);
    },
    render(renderer, scene, camera) {
      const previousTarget = renderer.getRenderTarget(),
        previousAlpha = renderer.getClearAlpha(),
        previousOverride = scene.overrideMaterial,
        previousBackground = scene.background,
        updateShadows = renderer.shadowMap.autoUpdate,
        before = renderer.info.render.calls;
      renderer.getClearColor(clearColor);
      // Points, lines and whatever the contact pass also leaves out (effects, water, the sky's own
      // meshes) are not surfaces a line could follow.
      scene.traverse((object) => {
        if (!object.visible) return;
        if (
          object.isPoints ||
          object.isLine ||
          object.isSprite ||
          object.userData.noOcclusion ||
          object.userData.noContactOcclusion ||
          object.userData.flora
        ) {
          object.visible = false;
          hidden.push(object);
        }
      });
      try {
        renderer.shadowMap.autoUpdate = false;
        scene.overrideMaterial = material;
        scene.background = null;
        renderer.setRenderTarget(target);
        // Nothing: no id, facing the camera, farther than anything drawn.
        renderer.setClearColor(0x000000, 60000);
        renderer.clear(true, true, false);
        renderer.render(scene, camera);
      } finally {
        scene.overrideMaterial = previousOverride;
        scene.background = previousBackground;
        renderer.shadowMap.autoUpdate = updateShadows;
        renderer.setRenderTarget(previousTarget);
        renderer.setClearColor(clearColor, previousAlpha);
        while (hidden.length) hidden.pop().visible = true;
        material.side = THREE.DoubleSide;
      }
      draws++;
      calls = renderer.info.render.calls - before;
    },
    evidence() {
      return { draws, calls, width: target.width, height: target.height };
    },
    dispose() {
      target.dispose();
      material.dispose();
    },
  };
}

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
uniform vec3 printLift;     // exponent on lightness before it is stepped, what the brightest surface is scaled to, exponent on the stepped value
uniform sampler2D tStructure;  // xy view normal, z object id, w view depth in metres (createStructure)
uniform vec4 printStructure;   // 1 when the structure is drawn, ink radius px, fold strength, metres where folds thin
uniform vec3 printEdge;        // gap in metres, gap per metre of distance, 1 - cos of a fold
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
// The structure buffer: the way a surface faces, and where it is in the camera's space.
vec3 facing(vec4 s) { return vec3(s.xy, sqrt(max(1.0 - dot(s.xy, s.xy), 0.0))); }
vec3 placed(vec2 uv, float z) {
  vec2 across = (uv - 0.5) * vec2(printResolution.x / printResolution.y, 1.0) * printCamera.w * printResolution.y;
  return vec3(across * (printCamera.z > 0.5 ? z : 1.0), -z);
}

void main() {
  vec2 px = 1.0 / printResolution;
  vec2 sheet = vUv * printResolution;
  float scale = printResolution.y / 1080.0;

  // Colour blocks. Average inside one surface: a neighbour counts by how close its colour is.
  vec2 at = vUv + printFlat.zw * px * scale;
  vec3 centre = lab(at);
  vec3 sum = centre;
  float weight = 1.0;
  bool structured = printStructure.x > 0.5;
  float who = structured ? texture2D(tStructure, at).z : 0.0;
  for (int i = 0; i < 12; i++) {
    vec2 tap = at + RING[i] * printFlat.x * scale * px;
    vec3 c = lab(tap);
    vec3 d = c - centre;
    float w = exp(-dot(d, d) * printFlat.y);
    // A fill belongs to one object: colour from its neighbour never bleeds in.
    if (structured) w *= step(abs(texture2D(tStructure, tap).z - who), 0.5);
    sum += c * w;
    weight += w;
  }
  vec3 block = sum / weight;

  // Values settle into a few printed steps; the mix keeps some of the render's gradation (bokashi).
  float lifted = pow(max(block.x, 0.0), printLift.x) * printLift.y;
  float stepped = lifted * printTone.x;
  stepped = (floor(stepped) + smoothstep(0.5 - printTone.y, 0.5 + printTone.y, fract(stepped))) / printTone.x;
  float value = pow(max(mix(lifted, stepped, printTone.z), 0.0), printLift.z);

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
  if (structured) {
    // Lines from the scene's structure, in three weights. Around each pixel a ring of taps asks:
    // is that surface broken from this one (it lies off this one's plane: an outline, the heaviest),
    // is it another object touching this one (a contact line), or the same object turned away (a
    // fold, the finest). A line is as wide as the share of the ring that says so, so a heavier line
    // only needs less of the ring to agree.
    vec4 s0 = texture2D(tStructure, vUv);
    vec3 n0 = facing(s0), p0 = placed(vUv, s0.w);
    float reach = printStructure.y * scale * mix(1.15, 0.75, smoothstep(3.0, 30.0, s0.w));
    float broken = 0.0, meets = 0.0, folds = 0.0;
    for (int i = 0; i < 12; i++) {
      vec2 tap = vUv + RING[i] * reach * px;
      vec4 s = texture2D(tStructure, tap);
      vec3 n = facing(s), p = placed(tap, s.w);
      float gap = max(abs(dot(p - p0, n0)), abs(dot(p - p0, n)));
      float apart = step(printEdge.x + printEdge.y * min(s0.w, s.w), gap);
      float other = step(0.5, abs(s.z - s0.z)) * (1.0 - apart);
      float turned = smoothstep(printEdge.z, printEdge.z * 1.5, 1.0 - dot(n, n0)) * (1.0 - apart) * (1.0 - other);
      // The inner ring speaks for the line's core.
      float say = i < 4 ? 1.5 : 1.0;
      broken += say * apart;
      meets += say * other;
      folds += say * turned;
    }
    const float ALL = 14.0;
    float far = 1.0 - smoothstep(printStructure.w, printStructure.w * 2.0, s0.w);
    float ink = max(
      smoothstep(0.05, 0.19, broken / ALL),
      max(smoothstep(0.13, 0.3, (meets + broken) / ALL) * 0.94, smoothstep(0.25, 0.42, (folds + meets + broken) / ALL) * printStructure.z * far)
    );
    cut = ink * (1.0 - smoothstep(printLineFade.x, printLineFade.y, min(s0.w, 59000.0)));
  }
  colour = mix(colour, printInk * printPaper, cut * printLine.w);

  gl_FragColor = vec4(colour, 1.0);
}`;

export function createPrintLook({ look: startLook = "realistic", enabled = false, settings = {} } = {}) {
  // `enabled` is the older switch: on means the default drawn look.
  let look = DRAWN_LOOKS.includes(startLook) ? startLook : enabled ? DEFAULT_DRAWN_LOOK : "realistic",
    drawn = look === "realistic" ? DEFAULT_DRAWN_LOOK : look;
  const dials = { ...PRINT_DEFAULTS, ...LOOKS[drawn].dials, ...settings };
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
    printLift: { value: new THREE.Vector3(1, 1, 1) },
    tStructure: { value: null },
    printStructure: { value: new THREE.Vector4() },
    printEdge: { value: new THREE.Vector3() },
    toneMappingExposure: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    name: "Drawn look",
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
    minute = 780,
    way = LOOKS[drawn].way(colourwayAt(minute)),
    // The view's full height in radians (perspective) or metres (orthographic); divided by the
    // drawn buffer's height it is one pixel's share.
    extent = 1,
    draws = 0,
    // The scene and camera of the frame being drawn (prepare), and the structure pass once a look
    // has asked for it.
    world = null,
    eye = null,
    structure = null;

  // Sits straight after the beauty pass, whose target owns the scene's depth for the whole frame.
  // A look that draws from structure has the scene drawn once more here, with the camera exactly
  // as the beauty pass used it.
  const tap = new Pass();
  tap.needsSwap = false;
  tap.render = (renderer, _writeBuffer, readBuffer) => {
    sceneDepth = readBuffer.depthTexture;
    const wanted = pass.enabled && dials.structure > 0 && world && eye;
    if (wanted) {
      structure ||= createStructure();
      structure.resize(readBuffer.width, readBuffer.height);
      structure.render(renderer, world, eye);
      uniforms.tStructure.value = structure.target.texture;
    }
    uniforms.printStructure.value.x = wanted ? 1 : 0;
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
    uniforms.printLift.value.set(dials.lift, dials.ceiling, dials.open);
    uniforms.printStructure.value.set(uniforms.printStructure.value.x, dials.inkRadius, dials.foldStrength, dials.creaseFade);
    uniforms.printEdge.value.set(dials.edgeGap[0], dials.edgeGap[1], dials.creaseTurn);
  }
  sync();

  // Last in the chain, in the output pass's place: reading the frame before it is tone-mapped means
  // nothing draws into the beauty target again. (A multisampled target discards its depth samples
  // once resolved, so a second resolve would overwrite the scene's depth with nothing.)
  const pass = new Pass();
  pass.needsSwap = false;
  pass.enabled = look !== "realistic";
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
    // The older switch: on returns to the drawn look last shown.
    set enabled(value) {
      this.setLook(value ? drawn : "realistic");
    },
    get look() {
      return look;
    },
    // "realistic", or one of DRAWN_LOOKS. Only uniforms change, so nothing compiles.
    setLook(next) {
      look = DRAWN_LOOKS.includes(next) ? next : "realistic";
      pass.enabled = look !== "realistic";
      if (pass.enabled && look !== drawn) {
        drawn = look;
        Object.assign(dials, PRINT_DEFAULTS, LOOKS[drawn].dials, settings);
        way = LOOKS[drawn].way(colourwayAt(minute));
        sync();
      }
      return look;
    },
    // Each frame: the camera that drew it, the home's minute, and whether lines may shift (they hold
    // still when motion is reduced or paused).
    prepare(camera, { scene = world, minute: nextMinute = minute, seconds = 0, still = true } = {}) {
      world = scene;
      eye = camera;
      const perspective = camera.isPerspectiveCamera;
      extent = (perspective ? 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) : camera.top - camera.bottom) / camera.zoom;
      uniforms.printCamera.value.set(camera.near, camera.far, perspective ? 1 : 0, uniforms.printCamera.value.w);
      if (Number.isFinite(nextMinute) && nextMinute !== minute) {
        minute = nextMinute;
        way = LOOKS[drawn].way(colourwayAt(minute));
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
      const structured = pass.enabled && dials.structure > 0 && Boolean(structure);
      return {
        enabled: pass.enabled,
        look,
        colourway: way.name,
        minute,
        draws,
        // The woodblock reads the frame and its depth; the cartoon reads the frame and the structure.
        textureReads: structured ? 39 : 23,
        renderTargets: structured ? 1 : 0,
        structure: structured ? structure.evidence() : null,
        dials: { ...dials },
      };
    },
    dispose() {
      quad.dispose();
      material.dispose();
      structure?.dispose();
    },
  };
}
