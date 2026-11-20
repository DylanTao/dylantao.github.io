import * as THREE from "../three.module.min.js";
import { drawHearths } from "./furniture-fire.mjs";
import { Pass, FullScreenQuad } from "../vendor/three-r164/postprocessing/Pass.js";
import { createPaint, paintableFlora } from "./paint-strokes.mjs";
import { floraSwayProfile, floraSwayVector, patchFloraSway } from "./plant-motion.mjs";
import { createWatercolourWash } from "./watercolour-world.mjs";

// Drawn readings of the finished frame: experiments, off unless ?look=toon, ?look=print, ?print=1
// or the lab's switch asks for one. The realistic render stays the source; this pass redraws it.
// Two looks share the pass and differ only in their settings (LOOKS below), so changing look
// compiles nothing:
//
//   print  the way a shin-hanga printer would cut the frame into blocks
//   toon   an animated film: a painted world in designed colour, figures as cels, one dark outline
//   paint  the cartoon's colour with no outline, laid over with brush strokes fixed to the
//          scene's surfaces (paint-strokes.mjs)
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
//
// Its colour is designed, too (TOON_HOURS and the comment above it). The same extra drawing of the
// scene records each surface's own colour, whether the key light reaches it (asked of that light's
// own shadow map, so a cast shadow has an edge) and whether it lies under the open sky (asked of a
// map of the scene drawn from straight above). Each surface is then filled from three mixes of its
// own colour, light, half-tone and shade, the way an animation background is painted: an edge where
// the sun is cut off, a soft fall where a room's own light fades, and a figure as a flat cel on
// top. A small meter reads each view so a dim room is not all shade and a lamp has a pool at night.

export const PRINT_KEY = "scene-print";
// "realistic" is the render itself; these redraw it.
export const DRAWN_LOOKS = Object.freeze(["toon", "print", "paint", "watercolour"]);
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

// The cartoon's colour is designed, not derived (Sirui, November 15, 2026, on the first cartoon drawn
// from structure: "color is still lame, not vivid and boring"). Every lit surface had printed one
// peach, because lightness came only from three steps of the lit frame and hue only from the lit
// pixel. The painted references set the rule (docs/november-2026-takeover.md, "The bar, November
// 15"): each thing has its own colour and three mixes of it, light, half-tone and shade, and the
// light on its spot picks one. So the hour no longer tints a frame. It says what colour the light
// is, what colour the shade is, and what the sky does:
//
//   light  display sRGB of a white card in the hour's key light, then how far a lit surface leans
//          to it and how far it lifts toward white
//   shade  display sRGB of the hour's shadow, then how far a shaded surface leans to it and the
//          share of its lightness it keeps
//   sky    display sRGB at the top of the sky and at the horizon
//   moon   display sRGB of moonlight, then how far a moonlit surface leans to it, the share of
//          its lightness it keeps, and how much the moon shows at this hour: nothing while the
//          sky is still light (at dusk its shadows only broke the cliff into islands), all of it
//          at night
//   sea    display sRGB of the sea where it is shallow over sand and where it is deep
//
// Warm light against a cool shade by day; at night the lamps are the light and everything else
// sinks into indigo. A night room is a lit room, though: warm pools under the lamps, its own
// colours around them, and blue only where the light gives out (`nightShare`, `deepNight`). A
// first try at a low key, seven tenths of a room in deep shade after a painting of an empty stage,
// read as eerie in a home (Sirui, November 16: "a bit eerie instead of calming and beautiful").
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const displayToOklab = (rgb) => linearToOklab(rgb.map(srgbToLinear));
const MOON = [0.42, 0.62, 0.95, 0.65, 0.8, 0];
const NIGHT_HOUR = {
  name: "night",
  light: [1.0, 0.8, 0.5, 0.5, 0.32],
  shade: [0.14, 0.17, 0.52, 0.76, 0.56],
  skyTop: [0.03, 0.04, 0.18],
  skyLow: [0.1, 0.12, 0.36],
  moon: [...MOON.slice(0, 5), 1],
  seaShallow: [0.1, 0.24, 0.44],
  seaDeep: [0.03, 0.07, 0.22],
};
export const TOON_HOURS = Object.freeze([
  { at: 0, ...NIGHT_HOUR },
  { at: 330, ...NIGHT_HOUR },
  {
    at: 420,
    name: "dawn",
    light: [1.0, 0.8, 0.7, 0.55, 0.3],
    shade: [0.38, 0.36, 0.72, 0.6, 0.62],
    skyTop: [0.38, 0.46, 0.82],
    skyLow: [1.0, 0.74, 0.62],
    moon: MOON,
    seaShallow: [0.55, 0.72, 0.78],
    seaDeep: [0.22, 0.36, 0.62],
  },
  {
    at: 600,
    name: "morning",
    light: [1.0, 0.94, 0.74, 0.45, 0.42],
    shade: [0.3, 0.48, 0.92, 0.5, 0.72],
    skyTop: [0.2, 0.52, 0.92],
    skyLow: [0.74, 0.9, 0.98],
    moon: MOON,
    seaShallow: [0.3, 0.78, 0.8],
    seaDeep: [0.06, 0.4, 0.72],
  },
  {
    at: 780,
    name: "noon",
    light: [1.0, 0.96, 0.8, 0.4, 0.45],
    shade: [0.26, 0.46, 0.94, 0.5, 0.72],
    skyTop: [0.08, 0.42, 0.92],
    skyLow: [0.6, 0.84, 0.98],
    moon: MOON,
    seaShallow: [0.22, 0.8, 0.82],
    seaDeep: [0.03, 0.36, 0.74],
  },
  {
    at: 930,
    name: "afternoon",
    light: [1.0, 0.93, 0.7, 0.45, 0.42],
    shade: [0.34, 0.44, 0.92, 0.5, 0.72],
    skyTop: [0.12, 0.44, 0.88],
    skyLow: [0.72, 0.88, 0.95],
    moon: MOON,
    seaShallow: [0.28, 0.76, 0.78],
    seaDeep: [0.05, 0.36, 0.7],
  },
  {
    at: 1035,
    name: "dusk",
    light: [1.0, 0.7, 0.46, 0.55, 0.3],
    shade: [0.38, 0.3, 0.74, 0.6, 0.64],
    skyTop: [0.26, 0.22, 0.62],
    skyLow: [1.0, 0.58, 0.36],
    moon: MOON,
    seaShallow: [0.62, 0.5, 0.66],
    seaDeep: [0.2, 0.2, 0.52],
  },
  {
    at: 1140,
    name: "evening",
    light: [1.0, 0.78, 0.48, 0.5, 0.3],
    shade: [0.18, 0.2, 0.58, 0.72, 0.56],
    skyTop: [0.06, 0.08, 0.3],
    skyLow: [0.36, 0.24, 0.54],
    moon: [...MOON.slice(0, 5), 0.6],
    seaShallow: [0.2, 0.26, 0.52],
    seaDeep: [0.06, 0.08, 0.3],
  },
  { at: 1290, ...NIGHT_HOUR },
]);

// The cartoon's hour at a minute of the day, blended like the colourway.
export function toonHourAt(minute = 780) {
  const m = ((Number(minute) % 1440) + 1440) % 1440;
  let next = TOON_HOURS.findIndex((hour) => hour.at > m);
  if (next < 0) next = TOON_HOURS.length;
  const a = TOON_HOURS[next - 1],
    b = TOON_HOURS[next % TOON_HOURS.length],
    span = (next < TOON_HOURS.length ? b.at : 1440) - a.at,
    t = span > 0 ? (m - a.at) / span : 0,
    blend = (key) => a[key].map((value, i) => mix(value, b[key][i], t));
  return {
    name: t < 0.5 ? a.name : b.name,
    light: blend("light"),
    shade: blend("shade"),
    skyTop: blend("skyTop"),
    skyLow: blend("skyLow"),
    moon: blend("moon"),
    seaShallow: blend("seaShallow"),
    seaDeep: blend("seaDeep"),
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
  // Fills from each surface's own colour and a designed light (TOON_HOURS), which needs the
  // structure. Off for the woodblock, whose colour is the hour's colourway over the lit frame.
  localColour: 0,
  // Stops from a white card in the key light. In a room, shade is the darkest part of what the
  // key light does not reach and a lamp's pool is the brightest: a meter reads the view a few
  // times a second and sets both (roomShare), inside these limits. Under the open sky whatever
  // the sun does not reach is shade (openStops). By day only a lamp or a glare counts as light
  // without the sun (strongStops).
  roomShare: [0.22, 0.86], // the share of a room's unlit surfaces that prints as shade, and the share below a lamp's pool
  nightShare: [0.4, 0.9], // the same two shares by night: more of a room is shade then, and fewer of its surfaces are a lamp's pool
  roomStops: [-5, -0.6], // the limits of where shade may begin in a room
  poolStops: [-3, 0.3], // the limits of where a lamp's pool may begin, and it is never less than 0.9 stops above the room's middle
  strongStops: 0.3,
  openStops: -0.4,
  keySoftness: 1.1, // stops: how softly a room's own light passes from one mix to the next (a figure's edge is hard)
  localRange: [0.3, 0.93], // the lightness a surface's own colour is printed between
  localChroma: [1.25, 2.3, 0.17], // how far chroma is opened for a quiet colour and for a strong one, and where it stops: big quiet surfaces stay quiet
  hueSpread: [1.2, 1.35], // the house's own hue in radians (sandstone and oak, about 70 degrees), and how far its neighbours are pushed apart
  neutralLean: [0.5, 0.35], // how far a dark grey leans to the shade's colour, and a pale grey to the light's
  shadeKeep: 0.62, // the share of its own chroma a surface keeps in shade
  roomLean: [0.2, 0.66], // how far shade leans to the hour's shade colour in a room, by day and by night (under the open sky the hour says)
  formShade: 0.07, // lightness per stop inside one mix: how much the light still models a form
  // How a surface lies. A form that turns from the key light passes through half-tone into shade
  // (a cast shadow keeps its edge), shade under the open sky is lifted where it faces the sky and
  // warmed where the ground throws light back up, and far things go toward the air's colour.
  formTurn: 0, // how squarely a surface must face the key light to stand in full light (the cosine); 0 leaves forms unmodelled
  groundBounce: [0.03, 0.055, 0.55], // OKLab a, b of the light the ground throws back up, and how far a shaded underside leans to it
  skyLift: 0.1, // how much lighter a shaded surface is when it faces the sky, and darker when it faces down
  air: [900, 0], // metres over which a far thing goes half of its way to the colour of the sky at the horizon, and the most of the way it goes
  deepNight: [0.6, 1.8, 0.5, 0.5], // the same by night, when it begins a little sooner and leans a little further
  deepShade: [0.8, 1.8, 0.55, 0.4], // stops below the start of shade where deep shade begins, stops to arrive, the lightness it keeps, its lean to the shade's colour
  hour: null, // the lab's override of the hour's light, shade or sky (the fields of TOON_HOURS)
  // Brush strokes fixed to the scene's surfaces, over the coat (paint-strokes.mjs). Off for the
  // cartoon and the woodblock.
  paint: 0,
  strokePixels: [6, 170], // the fewest and the most pixels a stroke may be long, at any frame height
  strokeOpacity: 1,
  strokeSpill: 0.1, // how far from its middle (0 to 0.5) a stroke may lie over what is behind its own thing
  strokeImpasto: 0.2, // how much a stroke's thickness lightens and darkens it
  strokeVary: [0.04, 0.08, 0.25], // how far one stroke's lightness and chroma stray from the mix, and how far it wanders along its ramp of light (stops)
  strokeScatter: 12, // milliseconds a frame spent scattering strokes until the scene is covered
  strokeBroken: [0.14, 0.12, 0.5], // how far one stroke turns its hue (radians), the share of strokes that are accents, and how far an accent goes to the other temperature
  landPaint: 1, // how much of the land's own painting shows: beds and stains in rock, the tide's mark, patches in sand, ground and scrub
  manner: null, // null follows the sun: gouache while it stands high, oil as it goes down and through the night; a number holds it (0 gouache, 1 oil)
  strokeThin: null, // the share of strokes laid, from 0.1 to 1; null lets the device decide (paintThin in paint-strokes.mjs)
  skyStrokes: 1, // how much the strokes laid over the sky show (0 leaves the sky to the coat)
  seaStrokes: 1, // and those laid over the sea
  shadowMass: 0, // radians of the view: a cast shadow narrower than this is left out, the way a painter masses shadows
  lineOver: 0, // the strength of lines drawn over the paint
  // The sea is designed too: its colour goes from the hour's shallow to its deep by how much water
  // lies over the sand, foam lies where it thins at the shore, and strokes are fixed to the water.
  seaDepth: 2.4, // metres of water at which the sea is about two thirds of the way to its deep colour
  brushwork: 0, // how much the sea's and the sky's strokes show
  lineOwn: 1, // how far such a line takes a dark of the fill's own colour and not the ink
  debug: 0, // 1 shows the surfaces' own colours, 2 the light on each spot in stops (grey: -6 to +2), 3 the key light's reach (white), open sky without it (blue) and rooms (green)
});

// What each drawn look changes: its settings, and what it does to the hour's colourway.
// A cartoon keeps the hour (a dusk is still a dusk) but not the paper: lines drawn from the
// scene's structure in three weights, no grain, and fills from each surface's own colour and the
// hour's designed light (`localColour`, TOON_HOURS). What has no colour of its own to give (a
// picture, the sea, a plant) is still filled from the frame, with the settings below: near-white
// ground, darks opened and held off black, three hard flat steps, every hue kept, the top step
// kept for lamps and sky (`ceiling`), the lit and shadow steps printed light (`open`).
const TOON_LOOK = Object.freeze({
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
    localColour: 1,
    brushwork: 0.3,
    shadowMass: 0.005,
  }),
  way: (way, minute) => ({
    ...way,
    palette: toonHourAt(minute),
    paper: way.paper.map((value) => value + (1 - value) * 0.8),
    ink: [0.1, 0.085, 0.13],
    shadow: [way.shadow[0], way.shadow[1], way.shadow[2] * 0.35],
    chroma: way.chroma * 1.4,
    sky: [...way.sky.slice(0, 3).map((value, i) => value + ([0.3, 0.62, 0.92][i] - value) * 0.3), way.sky[3] * 0.7],
  }),
});
export const LOOKS = Object.freeze({
  watercolour: Object.freeze({ label: "Watercolour", dials: Object.freeze({ structure: 1, localColour: 1 }), way: TOON_LOOK.way }),
  print: Object.freeze({ label: "Woodblock", dials: Object.freeze({}), way: (way) => way }),
  toon: TOON_LOOK,
  // The painted world: the cartoon's designed colour as a coat, no outline, and over it brush
  // strokes fixed to the scene's surfaces. Figures are not painted and stay cels.
  paint: Object.freeze({
    label: "Painted",
    // Calm before busy (Sirui, November 16: "a bit eerie instead of calming and beautiful"):
    // folds inside a form are mostly left to the paint, and shadows are massed more broadly.
    dials: Object.freeze({
      ...TOON_LOOK.dials,
      lineStrength: 0,
      inkRadius: 1.5,
      foldStrength: 0.35,
      paint: 1,
      lineOver: 0.72,
      // The sea's and the sky's brushwork is real strokes here, not the coat's cells.
      brushwork: 0,
      shadowMass: 0.008,
      // Forms turn from the light, and far things take the air's colour.
      formTurn: 0.6,
      air: Object.freeze([900, 0.75]),
      formShade: 0.045,
      strokePixels: Object.freeze([6, 260]),
      strokeVary: Object.freeze([0.022, 0.07, 0.05]),
      strokeBroken: Object.freeze([0.1, 0.05, 0.4]),
    }),
    // A painter's shade is lighter and less blue than a cel's: the sky is not all that lights it.
    way: (way, minute) => {
      const toon = TOON_LOOK.way(way, minute),
        shade = toon.palette.shade;
      return { ...toon, palette: { ...toon.palette, shade: [shade[0], shade[1], shade[2], shade[3] * 0.72, Math.min(shade[4] + 0.05, 0.86)] } };
    },
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

// What a surface says about its own colour: 0 it has one (its material's colour times the colour
// painted on its vertices), 0.25 it is a lamp, 1 nothing the fill can use (a picture or pattern in
// a texture, or a shader of its own), so that fill is taken from the frame as before.
export const STRUCTURE_GLOW = 0.15;
export function structureKind(material) {
  if (!material?.color?.isColor || material.map || material.emissiveMap) return 1;
  const glow = material.emissive;
  return glow?.isColor && Math.max(glow.r, glow.g, glow.b) * (material.emissiveIntensity ?? 1) > STRUCTURE_GLOW ? 0.25 : 0;
}

// The land itself: ground, cliff, beach and rock. Whether one spot of rough rock sees the sky is
// a noisy thing to ask of a map, and by dusk the answer decides the spot's tone: a cliff came out
// as a mosaic, eerie where it should be calm (Sirui, November 16). Seen from outdoors the land is
// under the open sky, all of it. A room keeps its own answer, so its light stays its own.
const LAND = /hinterland|coast_|mainland|cliff|bluff|beach|terrain|boulder|sandstone/i;
export const isLand = (object, material) => LAND.test(`${object?.name || ""} ${material?.name || ""}`);

// The scene drawn once more with one small material, into two targets the size of the frame:
// view normal (xy), object id and view depth in metres, as half floats; and, as bytes, the
// surface's own colour with its kind (structureKind), whether it lies under the open sky and
// whether the key light reaches it. three's own normal shader supplies the vertex stage, so
// skinned figures, morphs and instances stand where the beauty pass drew them.
export function createStructure() {
  const base = THREE.ShaderLib.normal;
  // The key light's shadow coordinate is found the way three's own materials find it: the world
  // position, pushed along the normal by the light's normal bias, through the shadow's matrix.
  const vertexShader = base.vertexShader
    .replace(
      "void main() {",
      "#include <color_pars_vertex>\nuniform mat4 structureShadowMatrix;\nuniform vec3 structureShadowBias;\nvarying float vStructureDepth;\nvarying vec4 vStructureShadow;\nvarying vec3 vStructureWorld;\nvoid main() {"
    )
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n\t#include <color_vertex>")
    .replace(
      "#include <project_vertex>",
      `#include <project_vertex>
	vStructureDepth = -mvPosition.z;
	vec4 structureWorld = vec4(transformed, 1.0);
	#ifdef USE_BATCHING
		structureWorld = batchingMatrix * structureWorld;
	#endif
	#ifdef USE_INSTANCING
		structureWorld = instanceMatrix * structureWorld;
	#endif
	structureWorld = modelMatrix * structureWorld;
	vStructureWorld = structureWorld.xyz;
	structureWorld.xyz += inverseTransformDirection(transformedNormal, viewMatrix) * structureShadowBias.y;
	vStructureShadow = structureShadowMatrix * structureWorld;`
    );
  const fragmentShader = /* glsl */ `
#define NORMAL
uniform vec4 structureObject; // id, 1 to leave this object out, kind (0 a surface, 1 a lamp, 2 a figure, 3 nothing known), 1 when its vertices are painted
uniform vec3 structureTint;   // the material's own colour, linear
uniform vec4 structureKey;    // the key light's direction in view space; w 1 when its shadow map can be read
uniform sampler2D structureShadowMap;
uniform vec3 structureShadowBias; // depth bias, normal bias (vertex stage), one texel
uniform vec2 structureKeyEdge;    // how squarely a surface must face the key light before it counts as lit (from, to)
uniform sampler2D structureSkyMap;  // in w: how far below the sky camera the topmost surface lies, in metres
uniform mat4 structureSkyMatrix;    // world to the sky map
uniform vec4 structureSky;          // the sky camera's height, metres of slack, metres per texel, 1 when the map can be read
uniform float structureLand;        // 1 for the land itself in a view that stands outdoors
uniform vec2 structureMass;         // how wide a cast shadow must be to be kept, in radians of the view, and the shadow map's width per metre
varying float vStructureDepth;
varying vec4 vStructureShadow;
varying vec3 vStructureWorld;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
  varying vec3 vViewPosition;
#endif
#include <common>
#include <packing>
#include <color_pars_fragment>
#include <normal_pars_fragment>
#include <clipping_planes_pars_fragment>
layout(location = 1) out highp vec4 structureColour;
// Does the key light reach this spot? A drawn shadow has an edge, so this is a yes or a no: the
// surface faces the light, and nothing stands between them in the light's own shadow map.
//
// A painter masses shadows: the shadow of a cliff is one shape, and the shadow of every bump on
// it is left out. Eight taps are spread over a disc as wide as the narrowest shadow worth
// keeping (structureMass, which grows with distance, so a chair leg's shadow at arm's length
// stays), and the look keeps what more than half of them agree on. A tap beside this spot is
// compared with the surface as it lies there, found from the surface's own slope in the
// light's view, so a slope does not shadow itself.
const vec2 MASS[8] = vec2[8](vec2(1.0, 0.0), vec2(0.31, 0.95), vec2(-0.81, 0.59), vec2(-0.81, -0.59), vec2(0.31, -0.95), vec2(0.4, 0.3), vec2(-0.46, 0.2), vec2(0.06, -0.5));
float keyReaches(vec3 normal) {
  if (structureKey.w < 0.5) return 1.0;
  float facing = smoothstep(structureKeyEdge.x, structureKeyEdge.y, dot(normal, structureKey.xyz));
  vec3 c = vStructureShadow.xyz / vStructureShadow.w;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return facing;
  vec3 dx = dFdx(c), dy = dFdy(c);
  float det = dx.x * dy.y - dx.y * dy.x;
  vec2 slope = abs(det) > 1e-14 ? vec2(dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z) / det : vec2(0.0);
  float radius = max(structureShadowBias.z * 0.5, structureMass.x * vStructureDepth * structureMass.y);
  float lit = 0.0;
  for (int i = 0; i < 8; i++) {
    vec2 o = MASS[i] * radius;
    float depth = c.z + clamp(dot(slope, o), -0.02, 0.02) + structureShadowBias.x;
    lit += step(depth, unpackRGBAToDepth(texture2D(structureShadowMap, c.xy + o)));
  }
  return facing * lit * 0.125;
}
// Does this spot lie under the open sky? Nothing stands higher at its place on a map of the scene
// seen from straight above. A wall has no place of its own on such a map, so it asks about the
// ground just in front of it.
float seesSky(vec3 normal) {
  if (structureSky.w < 0.5 || structureLand > 0.5) return 1.0;
  vec3 out_ = inverseTransformDirection(normal, viewMatrix);
  vec2 run = out_.xz * structureSky.z * 1.6;
  vec4 c = structureSkyMatrix * vec4(vStructureWorld.x + run.x, vStructureWorld.y, vStructureWorld.z + run.y, 1.0);
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0) return 1.0;
  return step(structureSky.x - vStructureWorld.y, texture2D(structureSkyMap, c.xy).w + structureSky.y);
}
void main() {
  #include <clipping_planes_fragment>
  if (structureObject.y > 0.5) discard;
  #include <normal_fragment_begin>
  gl_FragColor = vec4(normal.xy, structureObject.x, vStructureDepth);
  vec3 own = structureTint;
  #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
    own *= mix(vec3(1.0), vColor.rgb, structureObject.w);
  #endif
  // The square root keeps the darks in eight bits. The fourth byte holds the kind in its top two
  // bits, the open sky in the next, and the key light's reach in the other five.
  structureColour = vec4(
    sqrt(clamp(own, 0.0, 1.0)),
    (structureObject.z * 64.0 + seesSky(normal) * 32.0 + floor(keyReaches(normal) * 31.0 + 0.5)) / 255.0
  );
}`;
  const uniforms = {
    structureObject: { value: new THREE.Vector4() },
    structureTint: { value: new THREE.Color() },
    structureKey: { value: new THREE.Vector4(0, 0, 1, 0) },
    structureShadowMap: { value: null },
    structureShadowMatrix: { value: new THREE.Matrix4() },
    structureShadowBias: { value: new THREE.Vector3() },
    structureKeyEdge: { value: new THREE.Vector2(0.05, 0.13) },
    structureLand: { value: 0 },
    structureMass: { value: new THREE.Vector2(0, 0) },
    structureSkyMap: { value: null },
    structureSkyMatrix: { value: new THREE.Matrix4() },
    structureSky: { value: new THREE.Vector4() },
  };
  const material = new THREE.ShaderMaterial({
    name: "Scene structure",
    uniforms,
    vertexShader,
    fragmentShader,
    // Back faces of two-sided things keep a normal that faces the camera.
    defines: { DOUBLE_SIDED: "" },
    side: THREE.DoubleSide,
    // Painted vertices are read where a surface has them; one without reads white.
    vertexColors: true,
  });
  patchFloraSway(material, null);
  const floraProfiles = new WeakMap();
  const outsideWind = floraSwayVector(null);
  // Each object brings its id and its own colour, and is culled the way its own material is, so a
  // wall the beauty pass looks through from behind is looked through here too.
  material.onBeforeRender = (_renderer, _scene, _camera, _geometry, object, group) => {
    const index = group?.materialIndex ?? 0,
      source = Array.isArray(object.material) ? object.material[index] : object.material,
      kind = structureKind(source);
    let profile = source && floraProfiles.get(source);
    if (source && !profile) {
      profile = floraSwayVector(floraSwayProfile(source.name));
      floraProfiles.set(source, profile);
    }
    uniforms.floraSway.value = profile || outsideWind;
    uniforms.structureLand.value = outdoors && isLand(object, source) ? 1 : 0;
    uniforms.structureObject.value.set(
      structureId(object.id, index),
      structureSkips(source) ? 1 : 0,
      kind === 0 ? (object.isSkinnedMesh ? 2 : 0) : kind < 1 ? 1 : 3,
      source?.vertexColors ? 1 : 0
    );
    if (kind < 1) uniforms.structureTint.value.copy(source.color);
    material.side = source?.side ?? THREE.FrontSide;
    material.uniformsNeedUpdate = true;
  };
  const target = new THREE.WebGLRenderTarget(1, 1, {
    count: 2,
    type: THREE.HalfFloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.textures[0].name = "Scene structure";
  target.textures[1].name = "Scene colour";
  target.textures[1].type = THREE.UnsignedByteType;
  // The scene from straight above, over the ground the key light's shadow covers: one number a
  // texel, the height of whatever stands topmost there. It is redrawn when that ground moves and
  // now and then, never every frame.
  const SKY_SIZE = 1024,
    SKY_ABOVE = 150,
    SKY_STALE = 240;
  const skyTarget = new THREE.WebGLRenderTarget(SKY_SIZE, SKY_SIZE, {
    type: THREE.HalfFloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  skyTarget.texture.name = "Scene from above";
  const skyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, SKY_ABOVE * 3);
  skyCamera.up.set(0, 0, -1);
  const skyCentre = new THREE.Vector3(Infinity, 0, 0),
    toTexture = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  let skyExtent = 0,
    skyAge = 0,
    skyDraws = 0;
  // Set for each drawing of the view.
  let outdoors = false;
  const hidden = [],
    lifted = [],
    clearColor = new THREE.Color(),
    toKey = new THREE.Vector3();
  let draws = 0,
    calls = 0;
  // Points, lines and whatever the contact pass also leaves out (effects, water, the sky's own
  // meshes) are not surfaces a line could follow. The map from above also leaves out figures and
  // animals, which would otherwise leave their outline on the ground where they last stood.
  function hide(scene, moving, paintFoliage = false) {
    scene.traverse((object) => {
      if (!object.visible) {
        // A section view lifts the roof away so the rooms can be seen. The map from above still
        // counts it: a room does not come under the open sky because its lid is off.
        if (moving && (object.userData.caveRoof || object.userData.roomCeilingFor || object.userData.bathroomCeilingFor)) {
          object.visible = true;
          lifted.push(object);
        }
        return;
      }
      if (
        object.isPoints ||
        object.isLine ||
        object.isSprite ||
        ((object.userData.noOcclusion || object.userData.noContactOcclusion || object.userData.flora) && !(paintFoliage && paintableFlora(object))) ||
        (moving && object.isSkinnedMesh)
      ) {
        object.visible = false;
        hidden.push(object);
      }
    });
  }
  function draw(renderer, scene, camera, to) {
    const previousTarget = renderer.getRenderTarget(),
      previousAlpha = renderer.getClearAlpha(),
      previousOverride = scene.overrideMaterial,
      previousBackground = scene.background,
      updateShadows = renderer.shadowMap.autoUpdate;
    renderer.getClearColor(clearColor);
    try {
      renderer.shadowMap.autoUpdate = false;
      scene.overrideMaterial = material;
      scene.background = null;
      renderer.setRenderTarget(to);
      // Nothing: no id, facing the camera, farther than anything drawn, and (the byte target
      // clamps the 60000 to 1) no colour of its own, under the open sky, in the key light.
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
      while (lifted.length) lifted.pop().visible = false;
      material.side = THREE.DoubleSide;
    }
  }
  return {
    target,
    material,
    resize(width, height) {
      if (target.width !== width || target.height !== height) target.setSize(width, height);
    },
    // `key` is the scene's key light (the sun, or the moon at night), a directional light whose
    // shadow map the beauty pass has just used. `outdoors` says the view stands outside the
    // house, and `mass` how wide a cast shadow must be to be kept, in radians of the view.
    render(renderer, scene, camera, key = null, { outdoors: viewOutdoors = false, mass = 0, paintFoliage = false } = {}) {
      outdoors = Boolean(viewOutdoors);
      const shadow = key?.shadow,
        shadowMap = key?.castShadow ? shadow?.map?.texture : null,
        before = renderer.info.render.calls;
      if (shadowMap) {
        // The map from above covers the square the key light's shadow does.
        const extent = Math.max(shadow.camera.right, 1),
          centre = key.target.position;
        if (extent !== skyExtent || skyCentre.distanceTo(centre) > extent * 0.02 || ++skyAge > SKY_STALE) {
          skyExtent = extent;
          skyCentre.copy(centre);
          skyAge = 0;
          Object.assign(skyCamera, { left: -extent, right: extent, top: extent, bottom: -extent });
          skyCamera.position.set(centre.x, centre.y + SKY_ABOVE, centre.z);
          skyCamera.lookAt(centre);
          skyCamera.updateProjectionMatrix();
          skyCamera.updateMatrixWorld();
          // While the map is drawn, nothing asks it or the key light anything.
          uniforms.structureKey.value.w = 0;
          uniforms.structureSky.value.w = 0;
          uniforms.structureShadowMap.value = uniforms.structureSkyMap.value = null;
          hide(scene, true);
          draw(renderer, scene, skyCamera, skyTarget);
          skyDraws++;
          uniforms.structureSkyMatrix.value.multiplyMatrices(toTexture, skyCamera.projectionMatrix).multiply(skyCamera.matrixWorldInverse);
          uniforms.structureSky.value.set(skyCamera.position.y, 0.3, (2 * extent) / SKY_SIZE, 1);
        }
        uniforms.structureSky.value.w = 1;
        uniforms.structureSkyMap.value = skyTarget.texture;
        toKey.copy(key.position).sub(key.target.position).normalize().transformDirection(camera.matrixWorldInverse);
        uniforms.structureKey.value.set(toKey.x, toKey.y, toKey.z, 1);
        uniforms.structureShadowMap.value = shadowMap;
        uniforms.structureShadowMatrix.value.copy(shadow.matrix);
        uniforms.structureShadowBias.value.set(shadow.bias, shadow.normalBias, 1 / shadow.mapSize.x);
        uniforms.structureMass.value.set(mass, 1 / (2 * Math.max(shadow.camera.right, 1)));
      } else {
        uniforms.structureKey.value.set(0, 0, 1, 0);
        uniforms.structureSky.value.w = 0;
      }
      // Only the painted view needs foliage IDs for its wind-attached dabs.
      // The sky-height map still excludes the tiny gaps in the canopy.
      hide(scene, false, paintFoliage);
      draw(renderer, scene, camera, target);
      draws++;
      calls = renderer.info.render.calls - before;
    },
    evidence() {
      return { draws, calls, width: target.width, height: target.height, targets: 2, sky: { draws: skyDraws, size: SKY_SIZE, extent: skyExtent } };
    },
    dispose() {
      target.dispose();
      skyTarget.dispose();
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

// The designed colour, as shader source: the uniforms that carry the hour and the dials, OKLab,
// and the fill of a spot from its own colour and the light on it. The last pass includes it, and
// so does the stroke renderer (paint-strokes.mjs), so a stroke and the coat under it can never
// disagree about a spot. It expects `uniform float toneMappingExposure` to be declared before it.
export const COLOUR_GLSL = /* glsl */ `
uniform vec4 printKey;         // stops from a white card in the key light where shade ends and where strong light begins, the edge's width, 1 when fills use own colour
uniform vec4 printDay;         // how much the key light counts as light (the sun), how much as moonlight, where shade begins under the open sky, how far a room's shade leans to the shade's colour
uniform vec4 printMoon;        // OKLab a, b of moonlight, how far a moonlit surface leans to it, the share of lightness it keeps
uniform vec4 printLocal;       // the lightness an own colour prints between (floor, ceiling), chroma gain for a quiet colour and for a strong one
uniform vec4 printSpread;      // the house's hue in radians, how far its neighbours are pushed apart, how far a dark grey leans to the shade and a pale grey to the light
uniform vec4 printLightMix;    // OKLab a, b of the light, how far a lit surface leans to it, how far it lifts toward white
uniform vec4 printShadeMix;    // OKLab a, b of the shade, how far a shaded surface leans to it, the share of lightness it keeps
uniform vec4 printMore;        // the share of its own chroma a surface keeps in shade, debug view, chroma limit, how much the light models form inside a mix
uniform vec4 printDeep;        // stops below the start of shade where deep shade begins, the stops it takes to arrive, the lightness it keeps, how far it leans to the shade's colour
uniform float printNight;      // how far the land under the open sky has gone into the night's deep shade: nothing at dusk, all of it at night
uniform vec4 printSun;         // the key light's direction in the camera's space, and how squarely a surface must face it to stand in full light (0 leaves forms unmodelled)
uniform vec4 printGlow;        // the direction of the afterglow in the camera's space, and how much of it there is: none by day, none deep in the night
uniform vec4 printBounce;      // OKLab a, b of the light the ground throws back up, how far a shaded underside leans to it, how much the open sky lifts a shaded surface that faces it
uniform vec3 printSkyLow;      // OKLab of the sky at the horizon, which is also the colour of the air far off
uniform vec2 printAir;         // the metres over which a thing goes half of its way to the air's colour, and the most of the way it ever goes
const mat3 TO_LMS = ${glslMatrix(OKLAB.toLms)};
const mat3 TO_LAB = ${glslMatrix(OKLAB.toLab)};
const mat3 FROM_LAB = ${glslMatrix(OKLAB.fromLab)};
const mat3 FROM_LMS = ${glslMatrix(OKLAB.fromLms)};
vec3 encode(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 labLinear(vec3 c) { return TO_LAB * pow(max(TO_LMS * c, 0.0), vec3(1.0 / 3.0)); }
vec3 unlab(vec3 c) { vec3 lms = FROM_LAB * c; return encode(clamp(FROM_LMS * (lms * lms * lms), 0.0, 1.0)); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// The colour buffer's fourth byte: the surface's kind, whether it lies under the open sky, and
// whether the key light reaches it.
vec3 kindSkyKey(float a) {
  float code = floor(a * 255.0 + 0.5), kind = floor(code / 64.0), rest = code - kind * 64.0, sky = floor(rest / 32.0);
  return vec3(kind, sky, (rest - sky * 32.0) / 31.0);
}

// A surface's own colour as a colourist would mix it: printed inside a range of lightness, its
// chroma opened (more for what the lifted lightness would otherwise turn pastel), and the hues near
// the house's own pushed apart so sandstone, oak, plaster and terracotta stop reading as one tan.
// A thing with no colour of its own borrows one: a dark grey from the shade, a pale grey from the
// light, so a black floor prints as deep blue and not as grey.
vec3 ownMix(vec3 A) {
  float C = length(A.yz);
  float turn = C > 1e-4 ? atan(A.z, A.y) - printSpread.x : 0.0;
  turn = atan(sin(turn), cos(turn));
  turn *= mix(printSpread.y, 1.0, smoothstep(0.7, 1.6, abs(turn)));
  float L = mix(printLocal.x, printLocal.y, pow(clamp(A.x, 0.0, 1.0), 0.9));
  float gain = mix(printLocal.z, printLocal.w, smoothstep(0.03, 0.09, C));
  float chroma = printMore.z * tanh(C * gain * L / max(A.x, 0.3) / printMore.z);
  vec2 hue = chroma * vec2(cos(turn + printSpread.x), sin(turn + printSpread.x));
  float grey = 1.0 - smoothstep(0.012, 0.04, C);
  hue += grey * mix(printShadeMix.xy * printSpread.z, printLightMix.xy * printSpread.w, smoothstep(0.35, 0.75, A.x));
  return vec3(L, hue);
}
// Its three mixes, and the one the light on its spot picks.
vec3 threeMixes(vec3 half_, float inHalf, float inLight, float lean) {
  vec3 lit = vec3(mix(half_.x, 1.0, printLightMix.w), mix(half_.yz, half_.yz * 0.8 + printLightMix.xy, printLightMix.z));
  float low = half_.x * printShadeMix.w;
  vec3 shade = vec3(low, mix(half_.yz * printMore.x, printShadeMix.xy * clamp(low / 0.5, 0.45, 1.15), lean));
  return mix(shade, mix(half_, lit, inLight), inHalf);
}
// The fill of a spot that knows its own colour, in OKLab. mine is that colour (linear) and own3
// its mix (ownMix, which a painter of land may have turned: paint-strokes.mjs), seen the light
// that reached the eye from the spot before the tone curve, kind what it is, reach and open
// whether the key light reaches it and whether it lies under the open sky, and frameHue the
// frame's own a and b there (a lamp prints as the light itself). wander moves the spot along its
// ramp of light, in stops: nothing for the coat, a little for each brush stroke, so a soft fall of
// light is laid in strokes that differ. geo is how the surface lies: how squarely it faces the key
// light (-2 when that is not known), how far it faces up, its height above the sea in metres, and
// how squarely it faces the afterglow. read returns how far the light on the spot lies from a
// white card in the key light, then how far the spot is out of shade and how far into light.
//
// The world is painted the way a background is. A cast shadow is a shape with an edge: the key
// light's reach is a yes or a no. A form that turns from the light has no edge: how squarely the
// light meets it carries it from light through half-tone into shade, so rough rock skimmed by a
// low sun is half-tone with soft shadows in it, and not the scatter of lit and dark islands a
// yes or no made of it. A room's own light falls off softly, and a lamp has a pool with no edge.
// Under the open sky whatever the sun does not reach is shade, and shade is lit too: the sky lifts
// what faces it, the ground throws warm light back up under an overhang and onto the foot of a
// wall, and after sunset the part of the sky the sun went down in still colours what faces it. A
// figure is a cel on that background: two flat tones and an edge. By night the key light is the
// moon, and what it reaches takes moonlight's mix.
uniform float printCoastDusk;
vec3 spotFill(vec3 mine, vec3 own3, float seen, float kind, float reach, float open, vec2 frameHue, float wander, vec4 geo, out vec3 read) {
  float stops = log2(max(seen * toneMappingExposure / max(luma(mine), 0.03), 1e-4)) + wander;
  // A room's light fades over a long ramp. Under the open sky there is no such fall: a surface is
  // in the sky's shade or it is not, and a wide ramp there turned a cliff at dusk into a mosaic.
  float soft = kind > 1.5 ? 0.05 : mix(printKey.z, 0.25, open);
  float strong = smoothstep(printKey.y - soft, printKey.y + soft, stops);
  bool shaped = geo.x > -1.5 && kind < 1.5 && printSun.w > 0.0;
  float key = reach * (shaped ? smoothstep(0.0, printSun.w, geo.x) : 1.0);
  float sun = key * printDay.x;
  float inLight = max(shaped ? smoothstep(0.3, 0.85, sun) : sun, strong);
  // With no sun in the picture (dusk, night, a sun on the horizon) everything under the open sky
  // is in the sky's shade; there is no boundary left to draw across a cliff.
  float skyShade = mix(printKey.x, printDay.z, open);
  float begins = mix(printKey.x, mix(1.5, printDay.z, printDay.x), open);
  float inHalf = max(max(smoothstep(begins - soft, begins + soft, stops), shaped ? smoothstep(0.0, 0.4, sun) : 0.0), inLight);
  // The sky colours the shade it lights; in a room the shade is the thing's own colour, deepened.
  vec3 fill = threeMixes(own3, inHalf, inLight, mix(printDay.w, printShadeMix.z, open));
  // Inside a mix the light still models the form a little, the way a painter turns a plane.
  if (kind < 1.5) fill.x *= 1.0 + printMore.w * clamp(stops - mix(skyShade + 0.8, -0.7, reach * printDay.x), -1.5, 1.5);
  if (shaped) {
    float away = (1.0 - inHalf) * open;
    fill.x *= 1.0 + printBounce.w * geo.y * away;
    float thrown = clamp(-geo.y * 0.9 + 0.35 * (1.0 - smoothstep(0.0, 5.0, geo.z)) * (1.0 - abs(geo.y)), 0.0, 1.0) * away * printDay.x;
    fill = mix(fill, vec3(fill.x * 1.12, fill.yz * 0.45 + printBounce.xy), thrown * printBounce.z);
    // The afterglow warms what looks toward it; what turns away keeps the cool of the sky behind
    // the viewer. A wide glow had turned the whole cliff one rose (November 17).
    float lit = printGlow.w * smoothstep(0.25, 0.85, geo.w) * open * (1.0 - inLight);
    fill = mix(fill, vec3(fill.x * 1.3, fill.yz * 0.55 + printLightMix.xy * 0.9), lit * 0.65);
    float turned = printGlow.w * smoothstep(0.15, -0.55, geo.w) * open * (1.0 - inLight);
    fill = mix(fill, vec3(fill.x * 0.94, fill.yz * 0.6 + printShadeMix.xy * 0.45), turned * 0.5);
  }
  vec3 moonlit = vec3(own3.x * printMoon.w, mix(own3.yz * 0.4, printMoon.xy, printMoon.z));
  fill = mix(fill, moonlit, key * printDay.y * (1.0 - strong));
  // Where almost no light reaches, the shade deepens toward the hour's shade colour, so a picture
  // has darks as well as lights: under a table, inside a cupboard, the far wall at night.
  // In a room that is read from the frame. Under the open sky, once the sun has gone, the frame
  // has nothing steady to say (every stroke of a cliff at dusk fell on one side or the other of
  // the line), so the hour says it: plain shade at dusk, deep shade at night.
  float deepRoom = 1.0 - smoothstep(printKey.x - printDeep.x - printDeep.y, printKey.x - printDeep.x, stops);
  // (The land at night keeps half its way to the dark: a night to look at, not a black one.)
  // By day a cast shadow on a cliff is the sky's blue and no darker; only a crevice goes deep.
  float deepSky = mix(printNight * 0.5, 1.0 - smoothstep(printDay.z - 4.6, printDay.z - 2.8, stops), printDay.x);
  float deep = mix(deepRoom, deepSky, open) * (1.0 - inLight) * step(kind, 1.5);
  fill = mix(fill, vec3(fill.x * printDeep.z, mix(fill.yz, printShadeMix.xy * 0.9, printDeep.w)), deep);
  // Late light stays on the planes turned toward it. Open lee slopes form
  // one cool foreground mass around the house's clear, sheltered warm spot.
  float rim=printGlow.w*smoothstep(.3,.82,geo.w);
  float coastal=printCoastDusk*open*(1.0-inLight)*(1.0-rim*.85)*step(kind,.5);
  vec3 duskSlate=vec3(fill.x*.71,mix(fill.yz,vec2(.004,-.050),.72));
  fill=mix(fill,duskSlate,coastal);
  read = vec3(stops, inHalf, inLight);
  // A lamp prints as the light itself.
  return mix(fill, vec3(mix(fill.x, 1.0, 0.8), frameHue * 1.5 + printLightMix.xy * 0.5), step(0.5, kind) * step(kind, 1.5));
}
// Reserve one sheltered amber accent for the existing glazed living-room door.
uniform vec4 printWindow; // left, right, pane depth, evening weight
uniform vec2 printWindowY;
vec3 shelteredWindow(vec3 lab, vec3 eye, vec3 surface, float seen, float kind) {
  if (printWindow.w < .001 || eye.z >= printWindow.z || surface.z <= printWindow.z + .025 || kind >= 2.5) return lab;
  vec3 pane=mix(eye,surface,(printWindow.z-eye.z)/(surface.z-eye.z));
  vec2 edge=min(pane.xy-vec2(printWindow.x,printWindowY.x),vec2(printWindow.y,printWindowY.y)-pane.xy);
  float inside=smoothstep(.01,.20,min(edge.x,edge.y));
  float light=smoothstep(.018,.23,seen*toneMappingExposure);
  float accent=printWindow.w*inside*light;
  vec3 amber=vec3(max(lab.x,.54)+.19*light,lab.yz*.25+vec2(.09,.125));
  return mix(lab,amber,accent*.67);
}
// The air between the eye and a thing far off: it goes toward the colour of the sky at the horizon.
vec3 airFill(vec3 fill, float metres) {
  return mix(fill, printSkyLow, printAir.y * (1.0 - exp2(-metres / printAir.x)));
}
`;

// The sky and the sea, designed: what colour each is in a direction of the world or at a point of
// the water, in OKLab. The last pass paints them smoothly as a coat, and the painted look lays its
// strokes of them from the same source (paint-strokes.mjs), so a stroke and the coat under it
// agree. It follows COLOUR_GLSL.
//
// The sky is the hour's two colours, horizon and overhead, with most of the change low down. By
// day it is lighter and warmer round the sun. As the sun goes down the afterglow lies low on its
// side in the light's own colour, and across from it a band of rose stands over the blue. Cloud is
// there only when the scene's weather has it: heaps that are lit on the sun's side, high streaks,
// and the marine layer as a bank low over the sea.
//
// The sea goes from the hour's shallow colour to its deep by how much water lies over the bed.
// Seen along its surface it mirrors the sky; seen from above it is itself. Small waves come in as
// lines that follow the bed, foam lies where the water thins at the shore and breathes in and out,
// and the light's path lies across it toward the sun or the moon.
export const FIELD_GLSL = /* glsl */ `
uniform vec3 printSkyTop;      // OKLab of the sky overhead
uniform vec4 printSunDir;      // toward the sun in the world, below the horizon too
uniform vec4 printKeyDir;      // toward the key light in the world (the sun, or the moon by night), and how much say it has
uniform vec4 printWeather;     // cloud cover, high streaks, the marine layer, seconds
uniform vec4 printSea;         // the sea's level, seconds, how much the coat's own strokes show, 1 when the view has a sea to design
uniform vec4 printSeaShallow;  // OKLab, and the metres of water that carry the colour to its deep
uniform vec3 printSeaDeep;     // OKLab
uniform vec4 printPool;        // the pool's water: x unused, y its level, z unused, w 1 when the scene has one
uniform vec4 printPoolBox;     // the pool's footprint in the world: least x, least z, most x, most z
uniform vec4 printBath;        // the bath's water (the onsen), as printPool; indoors, so it holds the room's light and not the sky
uniform vec4 printBathBox;     // its footprint, as printPoolBox
// Whether a point of the world lies under the pool's water.
bool underWater(vec3 p, vec4 level, vec4 box) {
  return level.w > 0.5 && p.y < level.y - 0.02 && p.x > box.x && p.x < box.z && p.z > box.y && p.z < box.w;
}
bool underPool(vec3 p) {
  return underWater(p, printPool, printPoolBox) || underWater(p, printBath, printBathBox);
}
float fieldHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float fieldNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fieldHash(i), fieldHash(i + vec2(1.0, 0.0)), f.x), mix(fieldHash(i + vec2(0.0, 1.0)), fieldHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fieldFbm(vec2 p) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * fieldNoise(p);
    p = p * 2.03 + 17.0;
    amp *= 0.5;
  }
  return sum / 0.9375;
}
// The clear sky in a direction.
vec3 skyClear(vec3 d) {
  float up = max(d.y, 0.0);
  vec3 sky = mix(printSkyLow, printSkyTop, pow(min(up / 0.8, 1.0), 0.65));
  vec2 flatD = normalize(d.xz + vec2(1e-5, 0.0)), flatS = normalize(printSunDir.xz + vec2(1e-5, 0.0));
  float toward = dot(flatD, flatS);
  float day = smoothstep(-0.05, 0.12, printSunDir.y);
  sky.x *= 1.0 + 0.05 * toward * day * (1.0 - up);
  sky = mix(sky, vec3(mix(sky.x, 0.98, 0.7), sky.yz * 0.35 + printLightMix.xy * 0.7), pow(max(dot(d, printSunDir.xyz), 0.0), 12.0) * day * 0.6);
  float low = 1.0 - smoothstep(0.0, 0.42, up);
  sky = mix(sky, vec3(mix(sky.x, 0.88, 0.45), printLightMix.xy * 1.7), printGlow.w * low * low * smoothstep(-0.35, 1.0, toward) * 0.8);
  float belt = (1.0 - smoothstep(0.04, 0.2, abs(up - 0.13))) * smoothstep(0.1, 1.0, -toward);
  return mix(sky, vec3(sky.x * 1.05, sky.yz * 0.45 + vec2(0.055, 0.0)), printGlow.w * belt * 0.55);
}
// The sky with the day's cloud. cloud returns how much of the direction is cloud.
vec3 skyPaint(vec3 d, out float cloud) {
  vec3 sky = skyClear(d);
  cloud = 0.0;
  if (printWeather.x + printWeather.y + printWeather.z < 0.01) return sky;
  float up = max(d.y, 0.0);
  vec2 flatS = normalize(printSunDir.xz + vec2(1e-5, 0.0));
  // A plane overhead: far at the horizon, but not without end.
  vec2 q = d.xz / (up + 0.14) + printWeather.w * vec2(0.01, 0.004);
  float heap = fieldFbm(q * 0.5);
  float cover = printWeather.x;
  float body = cover > 0.01 ? smoothstep(0.78 - 0.62 * cover, 0.92 - 0.62 * cover, heap) : 0.0;
  float streaks = printWeather.y * smoothstep(0.5, 0.8, fieldFbm(vec2(dot(q, vec2(0.33, 0.12)), dot(q, vec2(-0.25, 1.4))))) * smoothstep(0.06, 0.4, up) * 0.7;
  float bank = printWeather.z * (1.0 - smoothstep(0.015, 0.09 + 0.06 * fieldNoise(q * 0.3), up));
  cloud = max(max(body, streaks), bank);
  // A heap is lit on the sun's side: it is compared with itself a little way toward the sun.
  float sunny = clamp((heap - fieldFbm((q + flatS * 0.4) * 0.5)) * 5.0 + 0.55, 0.0, 1.0);
  float night = 1.0 - smoothstep(0.3, 0.45, printSkyTop.x);
  vec3 bright = vec3(mix(0.96, sky.x + 0.16, night), printLightMix.xy * mix(0.45, 1.3, printGlow.w));
  vec3 shaded = vec3(mix(mix(0.74, 0.58, cover), sky.x + 0.05, night), mix(sky.yz, printShadeMix.xy, 0.4) * 0.55);
  return mix(sky, mix(shaded, bright, max(sunny, streaks) * (1.0 - 0.5 * bank)), cloud);
}
// The sea at a point of its surface. under is the water over the bed there in metres, ray the
// direction of the look in the world, and hand two numbers between 0 and 1 that break the light's
// path into dabs (a stroke's own, or noise for the coat). white returns how much of the point is
// foam.
vec3 seaPaint(vec2 at, float under, vec3 ray, vec2 hand, out float white) {
  vec3 fill = mix(printSeaShallow.xyz, printSeaDeep, 1.0 - exp(-max(under, 0.0) / printSeaShallow.w));
  // Small waves come in: lines that follow the bed and travel toward the shore.
  float wave = 0.5 + 0.5 * sin(6.2832 * (under * 1.25 + printSea.y * 0.2 + fieldNoise(at * 0.05) * 2.0));
  float crest = smoothstep(0.8, 0.98, wave) * smoothstep(0.25, 0.6, under) * (1.0 - smoothstep(2.2, 4.5, under));
  fill.x += 0.07 * crest - 0.02 * (1.0 - wave) * (1.0 - smoothstep(2.2, 4.5, under));
  // The mirror: all sky where the look runs along the water, none from straight above.
  vec3 back = normalize(vec3(ray.x, abs(ray.y) + 0.02, ray.z));
  float graze = pow(1.0 - clamp(-ray.y, 0.0, 1.0), 5.0);
  // (Over shallow sand the bed shows through and the mirror is weaker: the shallows keep their colour.)
  fill = mix(fill, skyClear(back), (0.02 + 0.98 * graze) * 0.72 * mix(0.3, 1.0, smoothstep(0.4, 3.0, under)));
  // The light's path: where the mirror would hold the sun or the moon, broken into dabs by the waves.
  float path = smoothstep(0.9, 0.998, dot(back, printKeyDir.xyz)) * step(0.02, printKeyDir.y) * printKeyDir.w;
  float dab = step(1.0 - path * 0.8, hand.x);
  fill = mix(fill, vec3(mix(0.9, 0.975, printDay.x), mix(printMoon.xy * 0.4, printLightMix.xy * 0.7, printDay.x)), dab * mix(0.6, 0.95, hand.y));
  float swash = 0.2 + 0.1 * sin(printSea.y * 0.8 + fieldNoise(at * 0.11) * 6.2832);
  white = (1.0 - smoothstep(swash * 0.4, swash, under)) * (0.5 + 0.5 * smoothstep(0.3, 0.5, fieldNoise(at * 1.9 + printSea.y * 0.15)));
  white = max(white, crest * 0.3);
  // Foam is white in the sun and the sea's own pale colour once the sun has gone.
  return mix(fill, mix(vec3(printSeaShallow.x + 0.2, printSeaShallow.yz * 0.5), vec3(0.975, 0.0, 0.01), printDay.x), white);
}
`;

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
uniform sampler2D tAlbedo;     // rgb the surface's own colour (square root of linear); a its kind (top two bits: 0 a surface, 1 a lamp, 2 a figure, 3 nothing known), the open sky and the key light's reach (createStructure)
uniform vec3 printHorizon;     // the horizon's height on the sheet, sheet heights per span of sky, 1 when the view has a sky
uniform vec2 printOver;        // the strength of the lines drawn over the paint, and how far a line takes a dark of the fill's own colour and not the ink
uniform mat4 printWorld;       // the camera's place in the world
varying vec2 vUv;

#include <tonemapping_pars_fragment>

${COLOUR_GLSL}
${FIELD_GLSL}
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
vec3 labOf(vec3 hdr) { return labLinear(clamp(shown(hdr), 0.0, 1.0)); }

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
  vec3 hdr0 = texture2D(tDiffuse, at).rgb;
  vec3 centre = labOf(hdr0);
  vec3 sum = centre;
  float weight = 1.0;
  bool structured = printStructure.x > 0.5;
  // Fills from the surface's own colour: the same taps also average that colour and the light
  // that reached the eye, before the tone curve.
  bool local = structured && printKey.w > 0.5;
  vec4 lies = structured ? texture2D(tStructure, at) : vec4(0.0, 0.0, 0.0, 1.0);
  float who = lies.z;
  vec4 own = local ? texture2D(tAlbedo, at) : vec4(0.0, 0.0, 0.0, 1.0);
  vec3 kind = kindSkyKey(own.a);
  vec3 ownSum = own.rgb;
  float seen = luma(hdr0);
  // The key light's reach and the open sky are averaged over the object's own nearest taps
  // whatever their colour, which leaves a cast shadow's edge about a pixel wide.
  float keySum = kind.z, skySum = kind.y, keyWeight = 1.0;
  // Drawing only the lines (over the paint), the fill under them is read at its centre.
  bool linesOnly = printMore.y > 4.5;
  for (int i = 0; i < (linesOnly ? 0 : 12); i++) {
    vec2 tap = at + RING[i] * printFlat.x * scale * px;
    vec3 hdr = texture2D(tDiffuse, tap).rgb;
    vec3 c = labOf(hdr);
    vec3 d = c - centre;
    float w = exp(-dot(d, d) * printFlat.y);
    // A fill belongs to one object: colour from its neighbour never bleeds in.
    float same = structured ? step(abs(texture2D(tStructure, tap).z - who), 0.5) : 1.0;
    w *= same;
    sum += c * w;
    weight += w;
    if (local) {
      vec4 theirs = texture2D(tAlbedo, tap);
      ownSum += theirs.rgb * w;
      seen += luma(hdr) * w;
      // Only the inner ring: the outer one would round a shadow's corners.
      float inner = i < 4 ? same : 0.0;
      vec3 they = kindSkyKey(theirs.a);
      keySum += they.z * inner;
      skySum += they.y * inner;
      keyWeight += inner;
    }
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

  // A surface that knows its own colour is filled from that colour and the light on its spot
  // (spotFill, in COLOUR_GLSL).
  float stops = 0.0, reach = 0.0, open = 0.0;
  if (local && kind.x < 2.5) {
    vec3 mine = ownSum / weight;
    mine *= mine;
    reach = smoothstep(0.3, 0.7, keySum / keyWeight);
    open = smoothstep(0.3, 0.7, skySum / keyWeight);
    // How the surface lies: to the key light, to the sky, above the sea, and to the afterglow.
    // Form is shaded from the surface's direction averaged over about a metre of the same thing,
    // so the facets of rough rock do not each turn from the sun on their own: a painter models the
    // mass, not the grain. Cast shadows keep their edges; they come from the shadow map.
    vec3 faces = facing(lies);
    if (printSun.w > 0.0 && lies.w < 50000.0) {
      float metre = clamp(1.0 / max(printCamera.w * (printCamera.z > 0.5 ? lies.w : 1.0), 1e-5), 2.0, 60.0);
      for (int i = 4; i < 12; i++) {
        vec4 near = texture2D(tStructure, at + RING[i] * metre * px);
        if (abs(near.z - lies.z) < 0.5) faces += facing(near);
      }
      faces = normalize(faces);
    }
    vec3 surface=(printWorld * vec4(placed(at, lies.w), 1.0)).xyz;
    vec4 geo = vec4(dot(faces, printSun.xyz), (mat3(printWorld) * faces).y, surface.y - printSea.x, dot(faces, printGlow.xyz));
    vec3 read;
    vec3 fill=spotFill(mine, ownMix(labLinear(mine)), seen / weight, kind.x, reach, open, block.yz, 0.0, geo, read);
    colour = unlab(airFill(shelteredWindow(fill,printWorld[3].xyz,surface,seen/weight,kind.x), lies.w));
    stops = read.x;
  }
  // The meter's reading of a spot: the light on it, and whether it is a room's unlit surface (1),
  // a sunlit one indoors (0.75), a surface under the open sky (0.5) or nothing it can use (0).
  if (printMore.y > 3.5 && printMore.y < 4.5) {
    gl_FragColor = vec4(clamp((stops + 8.0) / 10.0, 0.0, 1.0), local && kind.x < 0.5 ? (open > 0.5 ? 0.5 : reach > 0.5 ? 0.75 : 1.0) : 0.0, 0.0, 1.0);
    return;
  }

  float depth = depthAt(vUv);
  float sky = step(0.999995, depth);
  if (local) {
    // The sky is designed (skyPaint): the hour's colours, the sun's side, the afterglow and the
    // day's cloud. What the render holds that is brighter than any sky, the sun's or the moon's
    // own disc, stays white, and by night a star is whatever stands out of the dark.
    vec3 skyward = printCamera.z > 0.5 ? normalize(mat3(printWorld) * placed(vUv, 1.0)) : -normalize(printWorld[2].xyz);
    float cloud;
    vec3 above = skyPaint(skyward, cloud);
    float glare = smoothstep(0.86, 0.97, block.x) * (1.0 - smoothstep(0.025, 0.07, length(block.yz)));
    above = mix(above, vec3(0.985, above.yz * 0.25), glare);
    float night = 1.0 - smoothstep(0.3, 0.45, printSkyTop.x);
    above = mix(above, vec3(0.97, 0.0, 0.02), smoothstep(0.2, 0.45, centre.x - above.x) * night * (1.0 - cloud));
    colour = mix(colour, unlab(above), sky * printHorizon.z);
  } else {
    colour = mix(colour, printSky.rgb, sky * printSky.a * smoothstep(0.5, 1.0, vUv.y));
  }

  // The sea. A pixel shows it when the level of the sea is met before any solid thing, and its
  // colour is designed (seaPaint). The cartoon lays it in long cells fixed to the water; the
  // painted look leaves that to its strokes. Far off it takes the air's colour.
  float isSea = 0.0;
  if (local && printSea.w > 0.5 && printCamera.z > 0.5) {
    vec3 eye = printWorld[3].xyz;
    vec3 ray = normalize(mat3(printWorld) * placed(vUv, 1.0));
    vec4 bed = texture2D(tStructure, vUv);
    if (eye.y > printSea.x && ray.y < -1e-4) {
      float far = (printSea.x - eye.y) / ray.y;
      float facing = dot(ray, -normalize(printWorld[2].xyz));
      if (far * facing < bed.w - 0.03) {
        isSea = 1.0;
        vec3 water = eye + ray * far;
        float under = bed.w > 50000.0 ? 60.0 : printSea.x - (eye + ray * (bed.w / max(facing, 1e-3))).y;
        // Cells twice as long each time the distance doubles, so they keep their size on the sheet.
        float span = exp2(floor(log2(max(far, 8.0) / 8.0)));
        vec2 lay = water.xz / (vec2(3.4, 0.5) * span);
        lay.x += 0.5 * floor(lay.y);
        vec2 stroke = floor(lay);
        float own = hash(stroke), white;
        vec3 fill = seaPaint(water.xz, under, ray, vec2(own, hash(stroke + 17.0)), white);
        fill.x += (own - 0.5) * 0.06 * printSea.z * (1.0 - white);
        fill.yz *= 1.0 + (hash(stroke + 17.0) - 0.5) * 0.2 * printSea.z * (1.0 - white);
        colour = unlab(airFill(fill, far * 0.5));
      }
    }
  }

  // The pool: flat clear water at a known height. The floor shows through it, tinted by the water
  // over it; the sky lies on it where it is looked along; the wind brushes it in short cells and
  // the sun glints in a few. The strokes leave what lies under it to this.
  if (local && printPool.w > 0.5 && printCamera.z > 0.5 && isSea < 0.5) {
    vec3 eye = printWorld[3].xyz;
    vec3 ray = normalize(mat3(printWorld) * placed(vUv, 1.0));
    vec4 bed = texture2D(tStructure, vUv);
    if (eye.y > printPool.y && ray.y < -1e-4) {
      float far = (printPool.y - eye.y) / ray.y;
      float facing = dot(ray, -normalize(printWorld[2].xyz));
      vec3 water = eye + ray * far;
      bool inside = water.x > printPoolBox.x && water.x < printPoolBox.z && water.z > printPoolBox.y && water.z < printPoolBox.w;
      if (inside && far * facing < bed.w + 0.02) {
        isSea = 1.0;
        float under = max(printPool.y - (eye + ray * (bed.w / max(facing, 1e-3))).y, 0.0);
        vec3 floorLab = labLinear(pow(clamp(colour, 0.0, 1.0), vec3(2.2)));
        vec3 tint = vec3(min(printSeaShallow.x + 0.1, 0.94), printSeaShallow.yz * 0.85);
        vec3 fill = mix(floorLab, tint, 0.28 + 0.42 * (1.0 - exp(-under / 1.1)));
        vec3 back = normalize(vec3(ray.x, abs(ray.y) + 0.02, ray.z));
        float graze = pow(1.0 - clamp(-ray.y, 0.0, 1.0), 5.0);
        fill = mix(fill, skyClear(back), (0.05 + 0.9 * graze) * 0.6);
        vec2 lay = water.xz / vec2(0.55, 0.14);
        lay.x += 0.5 * floor(lay.y);
        vec2 cell = floor(lay);
        float own = hash(cell + 41.0);
        fill.x += (own - 0.5) * 0.05;
        float glint = smoothstep(0.9, 0.998, dot(back, printKeyDir.xyz)) * step(0.02, printKeyDir.y) * printKeyDir.w * step(0.72, hash(cell + 7.0));
        fill = mix(fill, vec3(mix(0.9, 0.975, printDay.x), mix(printMoon.xy * 0.4, printLightMix.xy * 0.6, printDay.x)), glint * 0.85);
        colour = unlab(airFill(fill, far * 0.5));
      }
    }
  }

  // The bath (the onsen): the same clear water indoors, holding the room's warm light where it is
  // looked along, since there is no sky over it.
  if (local && printBath.w > 0.5 && printCamera.z > 0.5 && isSea < 0.5) {
    vec3 eye = printWorld[3].xyz;
    vec3 ray = normalize(mat3(printWorld) * placed(vUv, 1.0));
    vec4 bed = texture2D(tStructure, vUv);
    if (eye.y > printBath.y && ray.y < -1e-4) {
      float far = (printBath.y - eye.y) / ray.y;
      float facing = dot(ray, -normalize(printWorld[2].xyz));
      vec3 water = eye + ray * far;
      bool inside = water.x > printBathBox.x && water.x < printBathBox.z && water.z > printBathBox.y && water.z < printBathBox.w;
      if (inside && far * facing < bed.w + 0.02) {
        isSea = 1.0;
        float under = max(printBath.y - (eye + ray * (bed.w / max(facing, 1e-3))).y, 0.0);
        vec3 floorLab = labLinear(pow(clamp(colour, 0.0, 1.0), vec3(2.2)));
        vec3 tint = vec3(min(printSeaShallow.x + 0.06, 0.92), printSeaShallow.yz * 0.7);
        vec3 fill = mix(floorLab, tint, 0.3 + 0.4 * (1.0 - exp(-under / 0.6)));
        float graze = pow(1.0 - clamp(-ray.y, 0.0, 1.0), 5.0);
        fill = mix(fill, vec3(min(fill.x + 0.18, 0.95), fill.yz * 0.6 + printLightMix.xy * 0.5), (0.05 + 0.8 * graze) * 0.5);
        vec2 lay = water.xz / vec2(0.32, 0.09);
        lay.x += 0.5 * floor(lay.y);
        fill.x += (hash(floor(lay) + 59.0) - 0.5) * 0.045;
        colour = unlab(fill);
      }
    }
  }

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
  float cut = 0.0;
  if (!structured) {
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
  cut = max(fold, outline) * mix(1.0, printWeight.z, clutter) * (1.0 - smoothstep(printLineFade.x, printLineFade.y, z)) * (1.0 - sky);
  } else {
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
    // What lies under the sea draws no line through it.
    cut = ink * (1.0 - smoothstep(printLineFade.x, printLineFade.y, min(s0.w, 59000.0))) * (1.0 - isSea);
  }
  // Over paint a line is a dark of the fill it bounds, the way a painter draws an edge back in.
  if (linesOnly) {
    vec3 edge = mix(printInk * printPaper, colour * colour * vec3(0.5, 0.42, 0.52), printOver.y);
    gl_FragColor = vec4(edge, cut * printOver.x);
    return;
  }
  colour = mix(colour, printInk * printPaper, cut * printLine.w);

  // The lab's three readings of what the fill is made from.
  if (local && printMore.y > 0.5) {
    vec4 raw = texture2D(tAlbedo, vUv);
    colour = printMore.y < 1.5
      ? mix(encode(raw.rgb * raw.rgb), vec3(1.0, 0.0, 1.0), step(0.7, raw.a) * 0.5)
      : kind.x > 2.5
        ? vec3(1.0, 0.0, 1.0)
        : printMore.y < 2.5
          ? vec3(clamp((stops + 6.0) / 8.0, 0.0, 1.0))
          : vec3(reach, max(reach, 0.45 * (1.0 - open)), max(reach, open));
  }

  gl_FragColor = vec4(colour, 1.0);
}`;

// How much afterglow the sky holds, from the sine of the sun's elevation: all of it with the sun on
// the horizon, none once it stands twelve degrees up or lies ten degrees down.
export function afterglow(sunHeight) {
  const rise = THREE.MathUtils.smoothstep(sunHeight, -0.17, -0.03),
    fall = 1 - THREE.MathUtils.smoothstep(sunHeight, 0.05, 0.21);
  return rise * fall;
}

// What the meter's pixels say (red: the light on a spot, from -8 to +2 stops; green: 255 for a
// room's surface the key light does not reach, 128 for a surface under the open sky): where shade begins in a room, which is the darkest
// `roomShare[0]` of those surfaces, and where a lamp's pool begins, which is above `roomShare[1]`
// of them and never less than 0.9 stops above their middle. Null when too little of the view is a
// room for the reading to mean anything.
export const METER_SIZE = Object.freeze([64, 36]);
export function readMeter(pixels, dials = PRINT_DEFAULTS, day = 1) {
  const room = [];
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 1] > 223) room.push((pixels[i] / 255) * 10 - 8);
  if (room.length < 48) return null;
  room.sort((a, b) => a - b);
  const at = (share) => room[Math.min(room.length - 1, Math.floor(share * room.length))],
    within = (value, [low, high]) => Math.min(Math.max(value, low), high),
    // By night more of a room is shade, and fewer of its surfaces count as a lamp's pool.
    shade = mix(dials.nightShare[0], dials.roomShare[0], day),
    pool = mix(dials.nightShare[1], dials.roomShare[1], day);
  return {
    samples: room.length,
    room: within(at(shade), dials.roomStops),
    pool: within(Math.max(at(pool), at(0.5) + 0.9), dials.poolStops),
  };
}

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
    tAlbedo: { value: null },
    printKey: { value: new THREE.Vector4() },
    printLocal: { value: new THREE.Vector4() },
    printSpread: { value: new THREE.Vector4() },
    printLightMix: { value: new THREE.Vector4() },
    printShadeMix: { value: new THREE.Vector4() },
    printSkyTop: { value: new THREE.Vector3() },
    printSkyLow: { value: new THREE.Vector3() },
    printHorizon: { value: new THREE.Vector3(-1, 0.5, 1) },
    printMore: { value: new THREE.Vector4() },
    printDeep: { value: new THREE.Vector4() },
    printNight: { value: 0 },
    printSun: { value: new THREE.Vector4(0, 0, 1, 0) },
    printGlow: { value: new THREE.Vector4(0, 0, 1, 0) },
    printBounce: { value: new THREE.Vector4() },
    printAir: { value: new THREE.Vector2(900, 0) },
    printCoastDusk: { value: 0 },
    printWindow: { value: new THREE.Vector4() },
    printWindowY: { value: new THREE.Vector2() },
    printSunDir: { value: new THREE.Vector4(0, 1, 0, 0) },
    printKeyDir: { value: new THREE.Vector4(0, 1, 0, 1) },
    printWeather: { value: new THREE.Vector4(0, 0, 0, 0) },
    printPool: { value: new THREE.Vector4(0, 0, 0, 0) },
    printPoolBox: { value: new THREE.Vector4(0, 0, 0, 0) },
    printBath: { value: new THREE.Vector4(0, 0, 0, 0) },
    printBathBox: { value: new THREE.Vector4(0, 0, 0, 0) },
    printOver: { value: new THREE.Vector2() },
    printWorld: { value: new THREE.Matrix4() },
    printSea: { value: new THREE.Vector4(0, 0, 0, 0) },
    printSeaShallow: { value: new THREE.Vector4() },
    printSeaDeep: { value: new THREE.Vector3() },
    printDay: { value: new THREE.Vector4(1, 0, -0.4, 0) },
    printMoon: { value: new THREE.Vector4() },
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
    // The coat is opaque (its alpha is 1); the lines drawn over paint are blended.
    transparent: true,
  });
  const quad = new FullScreenQuad(material);
  // The pool's water, found once a scene: the largest flat surface marked as water that is not the
  // sea, and whose top is its level.
  let poolScene = null;
  const poolBox = new THREE.Box3();
  function findPool(scene) {
    poolScene = scene;
    let best = null,
      area = 0;
    scene.updateMatrixWorld?.();
    scene.traverse?.((object) => {
      if (!object.isMesh || !object.userData?.water || !object.geometry) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const box = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld),
        size = box.getSize(new THREE.Vector3());
      if (size.y > 0.2 || size.x * size.z <= area) return;
      best = box;
      area = size.x * size.z;
    });
    if (best) {
      poolBox.copy(best);
      uniforms.printPool.value.set(0, best.max.y, 0, 1);
      uniforms.printPoolBox.value.set(best.min.x, best.min.z, best.max.x, best.max.z);
    } else uniforms.printPool.value.set(0, 0, 0, 0);
    // The bath: the onsen's water, by its name.
    let bath = null;
    scene.traverse?.((object) => {
      if (bath || !object.isMesh || !/onsen_water|bath_water/i.test(object.name || "") || !object.geometry) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      bath = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
    });
    if (bath) {
      uniforms.printBath.value.set(0, bath.max.y, 0, 1);
      uniforms.printBathBox.value.set(bath.min.x, bath.min.z, bath.max.x, bath.max.z);
    } else uniforms.printBath.value.set(0, 0, 0, 0);
  }
  const gaze = new THREE.Vector3(),
    // Toward the sun, in the world, wherever it is (below the horizon too).
    sunward = new THREE.Vector3(0, 1, 0);
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
    way = LOOKS[drawn].way(colourwayAt(minute), minute),
    // The view's full height in radians (perspective) or metres (orthographic); divided by the
    // drawn buffer's height it is one pixel's share.
    extent = 1,
    draws = 0,
    // The scene and camera of the frame being drawn (prepare), and the structure pass once a look
    // has asked for it.
    world = null,
    eye = null,
    keyLight = null,
    // How much say the key light has: all of it when it stands high, none when it lies on the
    // horizon. A sun or moon that low skims rough rock, and every bump would be lit or dark by
    // itself: a cliff at dusk came out as a scatter of islands. Below about fifteen degrees the
    // key light fades out of the picture and the sky's soft light is left to model the land.
    keyShare = 1,
    seaLevel = null,
    outdoors = false,
    paint = null,
    watercolour = null,
    day = 1,
    stillFrame = true,
    // Where shade and a lamp's pool begin in a room, as the meter last read them.
    roomStops = -1.6,
    poolStops = -0.6,
    metered = 0,
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
      structure.render(renderer, world, eye, keyLight, { outdoors, mass: dials.shadowMass, paintFoliage: look === "paint" && dials.paint > 0 });
      uniforms.tStructure.value = structure.target.textures[0];
      uniforms.tAlbedo.value = structure.target.textures[1];
    }
    uniforms.printStructure.value.x = wanted ? 1 : 0;
    uniforms.printKey.value.w = wanted && dials.localColour > 0 && way.palette ? 1 : 0;
    // The key light and the afterglow, as this frame's camera sees them.
    if (wanted) {
      if (keyLight?.target) gaze.copy(keyLight.position).sub(keyLight.target.position).normalize();
      else gaze.set(0, 1, 0);
      uniforms.printKeyDir.value.set(gaze.x, gaze.y, gaze.z, keyShare);
      uniforms.printSunDir.value.set(sunward.x, sunward.y, sunward.z, 0);
      gaze.transformDirection(eye.matrixWorldInverse);
      uniforms.printSun.value.set(gaze.x, gaze.y, gaze.z, dials.formTurn);
      // The glow lies on the horizon where the sun went down, or is about to come up.
      gaze.set(sunward.x, 0.12, sunward.z).normalize().transformDirection(eye.matrixWorldInverse);
      uniforms.printGlow.value.set(gaze.x, gaze.y, gaze.z, afterglow(sunward.y));
    }
  };

  // Where the mixes change. By day only the sun, a lamp or a glare is light; as the sun goes the
  // meter's reading of the lamps' pools takes over.
  function setKey() {
    uniforms.printKey.value.set(roomStops, mix(poolStops, dials.strongStops, day), dials.keySoftness, uniforms.printKey.value.w);
    const moon = (dials.hour?.moon ?? way.palette?.moon)?.[5] ?? 1;
    uniforms.printDay.value.set(day * keyShare, (1 - day) * keyShare * moon, dials.openStops, mix(dials.roomLean[1], dials.roomLean[0], day));
    uniforms.printDeep.value.set(...dials.deepShade.map((value, i) => mix(dials.deepNight[i], value, day)));
    uniforms.printNight.value = (1 - day) * moon;
  }
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
    setKey();
    uniforms.printLocal.value.set(dials.localRange[0], dials.localRange[1], dials.localChroma[0], dials.localChroma[1]);
    uniforms.printSpread.value.set(dials.hueSpread[0], dials.hueSpread[1], dials.neutralLean[0], dials.neutralLean[1]);
    uniforms.printMore.value.set(dials.shadeKeep, dials.debug, dials.localChroma[2], dials.formShade);
    uniforms.printOver.value.set(dials.lineOver, dials.lineOwn);
    uniforms.printSun.value.w = dials.formTurn;
    uniforms.printBounce.value.set(dials.groundBounce[0], dials.groundBounce[1], dials.groundBounce[2], dials.skyLift);
    uniforms.printAir.value.set(dials.air[0], dials.air[1]);
    uniforms.printSea.value.z = dials.brushwork;
    // The lab can try another hour's light, shade or sky over the one the clock gives.
    const palette = way.palette && dials.hour ? { ...way.palette, ...dials.hour } : way.palette;
    if (palette) {
      const light = displayToOklab(palette.light.slice(0, 3)),
        shade = displayToOklab(palette.shade.slice(0, 3));
      uniforms.printLightMix.value.set(light[1], light[2], palette.light[3], palette.light[4]);
      uniforms.printShadeMix.value.set(shade[1], shade[2], palette.shade[3], palette.shade[4]);
      uniforms.printSkyTop.value.set(...displayToOklab(palette.skyTop));
      uniforms.printSkyLow.value.set(...displayToOklab(palette.skyLow));
      const moon = displayToOklab(palette.moon.slice(0, 3));
      uniforms.printMoon.value.set(moon[1], moon[2], palette.moon[3], palette.moon[4]);
      uniforms.printSeaShallow.value.set(...displayToOklab(palette.seaShallow), dials.seaDepth);
      uniforms.printSeaDeep.value.set(...displayToOklab(palette.seaDeep));
    }
  }
  sync();

  // Last in the chain, in the output pass's place: reading the frame before it is tone-mapped means
  // nothing draws into the beauty target again. (A multisampled target discards its depth samples
  // once resolved, so a second resolve would overwrite the scene's depth with nothing.)
  const pass = new Pass();
  const windowBounds = new THREE.Box3();
  let livingWindow = null;
  function setLivingWindow() {
    uniforms.printWindow.value.w = 0;
    uniforms.printCoastDusk.value = 0;
    if (look !== "paint" || !outdoors || !world || !eye?.isPerspectiveCamera) return;
    uniforms.printCoastDusk.value = (1 - THREE.MathUtils.smoothstep(sunward.y, -0.075, 0.04)) * 0.84;
    if (!livingWindow?.parent) livingWindow = world.getObjectByName("core_facade_door_lounge");
    const evening = 1 - THREE.MathUtils.smoothstep(sunward.y, -0.04, 0.12);
    if (!livingWindow || evening < 0.001) return;
    windowBounds.setFromObject(livingWindow);
    if (windowBounds.isEmpty()) return;
    const { min, max } = windowBounds;
    uniforms.printWindow.value.set(min.x + 0.08, max.x - 0.08, max.z, evening);
    uniforms.printWindowY.value.set(min.y + 0.11, max.y - 0.08);
  }

  function drawHearth(renderer, buffer) {
    if (!world || !eye) return;
    drawHearths(renderer, world, eye, sceneDepth || buffer.depthTexture, buffer.width, buffer.height);
  }
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
    setLivingWindow();
    if (look === "watercolour" && uniforms.printStructure.value.x > 0.5) {
      watercolour ||= createWatercolourWash(uniforms);
      renderer.setRenderTarget(pass.renderToScreen ? null : readBuffer);
      watercolour.render(renderer);
      drawHearth(renderer, readBuffer);
      return;
    }
    // The meter reads the view a few times a second while it moves, and every frame it is still.
    if (uniforms.printKey.value.w > 0.5 && (stillFrame || !metered || draws % 6 === 0)) meter(renderer);
    renderer.setRenderTarget(pass.renderToScreen ? null : readBuffer);
    quad.render(renderer);
    // The painted look lays its strokes over that coat.
    if (dials.paint > 0 && uniforms.printKey.value.w > 0.5 && world && eye) {
      paint ||= createPaint({ glsl: COLOUR_GLSL + FIELD_GLSL, uniforms, tools: { structureId, structureKind, structureSkips } });
      paint.render(renderer, world, eye, {
        width: readBuffer.width,
        height: readBuffer.height,
        extent,
        centre: keyLight?.target?.position,
        dials,
        still: stillFrame,
        sunHeight: sunward.y,
        outdoors,
      });
      // Edges are drawn back in over the paint.
      if (dials.lineOver > 0) {
        const view = uniforms.printMore.value.y,
          clear = renderer.autoClear;
        uniforms.printMore.value.y = 5;
        renderer.autoClear = false;
        quad.render(renderer);
        renderer.autoClear = clear;
        uniforms.printMore.value.y = view;
      }
    }
    drawHearth(renderer, readBuffer);
    draws++;
  };

  // The fill's own reading of the view, drawn small and read back, sets where a room's shade and a
  // lamp's pool begin (readMeter). A moving view eases toward each reading so the shapes do not jump.
  const meterTarget = new THREE.WebGLRenderTarget(METER_SIZE[0], METER_SIZE[1], {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
  });
  const meterPixels = new Uint8Array(METER_SIZE[0] * METER_SIZE[1] * 4);
  function meter(renderer) {
    const view = uniforms.printMore.value.y;
    uniforms.printMore.value.y = 4;
    renderer.setRenderTarget(meterTarget);
    quad.render(renderer);
    renderer.readRenderTargetPixels(meterTarget, 0, 0, METER_SIZE[0], METER_SIZE[1], meterPixels);
    uniforms.printMore.value.y = view;
    const reading = readMeter(meterPixels, dials, day);
    if (!reading) return;
    const ease = stillFrame || !metered ? 1 : 0.35;
    roomStops += (reading.room - roomStops) * ease;
    poolStops += (reading.pool - poolStops) * ease;
    metered++;
    setKey();
  }

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
        way = LOOKS[drawn].way(colourwayAt(minute), minute);
        sync();
      }
      return look;
    },
    // Each frame: the camera that drew it, the home's minute, and whether lines may shift (they hold
    // still when motion is reduced or paused).
    // `key` is the scene's key light and `day` how much of it is the sun (1) and not the moon (0).
    // `sea` is the sea's level in the world, when the scene has a sea. `outdoors` says the view
    // stands outside the house. `sky` is the sky as the scene has it (atmosphere.mjs's state):
    // `sun`, the direction toward the sun in the world, below the horizon too, and the day's
    // weather (`weather.cloudCover`, `weather.cirrus`, `marine`, `overcast`).
    prepare(
      camera,
      {
        scene = world,
        minute: nextMinute = minute,
        seconds = 0,
        still = true,
        key = keyLight,
        day: nextDay = day,
        sea = seaLevel,
        outdoors: nextOutdoors = outdoors,
        sky = null,
      } = {}
    ) {
      if (scene && scene !== poolScene) findPool(scene);
      world = scene;
      if (sky?.sun) sunward.fromArray(sky.sun).normalize();
      // The day's weather, as the scene has it: heaped cloud, high streaks, the marine layer.
      if (sky) {
        const cover = Math.max(Number(sky.weather?.cloudCover) || 0, (Number(sky.overcast) || 0) * 0.9);
        uniforms.printWeather.value.set(
          Math.min(cover, 1),
          Math.min(Number(sky.weather?.cirrus) || 0, 1),
          Math.min(Number(sky.marine) || 0, 1),
          still ? 0 : seconds
        );
      }
      eye = camera;
      keyLight = key;
      stillFrame = Boolean(still);
      const height = key?.target ? gaze.copy(key.position).sub(key.target.position).normalize().y : 1,
        share = THREE.MathUtils.smoothstep(height, 0.04, 0.26);
      if (share !== keyShare) {
        keyShare = share;
        setKey();
      }
      seaLevel = sea;
      outdoors = Boolean(nextOutdoors);
      if (camera.matrixWorld) uniforms.printWorld.value.copy(camera.matrixWorld);
      // The sea is designed for a view with perspective that stands above it.
      uniforms.printSea.value.set(
        Number(sea) || 0,
        still ? 0 : seconds,
        dials.brushwork,
        Number.isFinite(sea) && camera.isPerspectiveCamera && camera.matrixWorld ? 1 : 0
      );
      if (nextDay !== day) {
        day = Math.min(Math.max(Number(nextDay) || 0, 0), 1);
        setKey();
      }
      const perspective = camera.isPerspectiveCamera;
      extent = (perspective ? 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) : camera.top - camera.bottom) / camera.zoom;
      uniforms.printCamera.value.set(camera.near, camera.far, perspective ? 1 : 0, uniforms.printCamera.value.w);
      // Where the horizon crosses the sheet, and how many sheet heights forty degrees of sky take:
      // the sky's two colours belong to the world, not to the frame. A view with no horizon (from
      // straight above, or without perspective) gets the lower colour.
      if (perspective) {
        const pitch = Math.asin(THREE.MathUtils.clamp(camera.getWorldDirection?.(gaze).y ?? 0, -0.985, 0.985));
        uniforms.printHorizon.value.set(0.5 - Math.tan(pitch) / extent, extent / Math.tan(THREE.MathUtils.degToRad(40)), 1);
      } else uniforms.printHorizon.value.set(2, 1, 1);
      if (Number.isFinite(nextMinute) && nextMinute !== minute) {
        minute = nextMinute;
        way = LOOKS[drawn].way(colourwayAt(minute), minute);
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
      const structured = pass.enabled && dials.structure > 0 && Boolean(structure),
        own = structured && uniforms.printKey.value.w > 0.5;
      return {
        enabled: pass.enabled,
        look,
        colourway: way.name,
        hour: own ? way.palette.name : null,
        minute,
        draws,
        // Per pixel of the last pass. The woodblock reads the frame 13 times and its depth 10.
        // The cartoon reads the frame 13 times, the structure 26 and the scene's depth once, and
        // with fills from the surfaces' own colour, that colour 13 times more.
        textureReads: own ? 53 : structured ? 40 : 23,
        // The structure's two targets and its map from above; then the meter's.
        renderTargets: own ? 3 : structured ? 2 : 0,
        structure: structured ? structure.evidence() : null,
        meter: own ? { room: roomStops, pool: poolStops, readings: metered, day, keyShare } : null,
        paint: own && dials.paint > 0 && paint ? paint.evidence() : null,
        paintWindow: own && dials.paint > 0 && uniforms.printWindow.value.w > 0 ? uniforms.printWindow.value.toArray() : null,
        dials: { ...dials },
      };
    },
    dispose() {
      quad.dispose();
      material.dispose();
      meterTarget.dispose();
      structure?.dispose();
      paint?.dispose();
      watercolour?.dispose();
    },
  };
}
