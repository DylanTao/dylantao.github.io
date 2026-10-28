// The footer coast's light through La Jolla's day, as a pure function of the sun (la-jolla-sun.mjs):
// lights, sea, marine layer and the credit's halo. Node tests sample it; scene.mjs applies it. The
// sky and the hills behind the coast are physically based (sky.mjs, atmosphere.mjs) and take their
// light from these looks.
//
// The footer looks at the land from La Jolla Bay (skyline.mjs): the setting sun is behind the
// viewer, raking the coast and Mount Soledad with golden light, and the rising sun comes up over the
// hills ahead. The four authored theme looks stay exact anchors (a manual theme and its
// still show them); dawn, golden hour, sunset, afterglow and the blue hour blend between them by
// solar altitude.

const COLOR_KEYS = [
  "sky",
  "ground",
  "sun",
  "water",
  "deep",
  "shallow",
  "mirror",
  "mirrorFar",
  "rimColor",
  "sunDisk",
  "fogColor",
  "haloLight",
  "haloDark",
  "glowColor",
];

// sky/ground/fill: hemisphere light; sun/key: the key light (the sun by day, the moon by night);
// env: the strength of the studio's soft reflections, which light every surface evenly (1 by day);
// rimColor/rim: the back fill that rims roofs and bluff tops; water: the Connect miniature's sea tint;
// deep/shallow and caustic/reflect/glow/foam: the footer's sea (water.mjs), whose mirror shows the
// sky as `mirror` in the foreground and `mirrorFar` near the beach (blended toward the physical sky
// while it shows); night: windows, lamps, the fire and the hillside houses; sunDisk, rays and
// glitter: the rising sun's glitter path and its shafts through the marine layer; fog: the marine
// layer's wisps; halo*/glow*: the credit. Colors are display colors; the four theme anchors keep
// their current authored values, shared with the still renderer.
const base = {
  env: 1,
  rimColor: 0xd3e7ec,
  sunDisk: 0xfff2d0,
  rays: 0,
  glitter: 0,
  fog: 0,
  fogColor: 0xf2f0ea,
  haloLight: 0xfffefa,
  haloDark: 0x111c22,
  glowColor: 0xffffff,
  glowAlpha: 0,
  haloAlpha: 0.55,
};

export const LOOKS = Object.freeze({
  morning: {
    ...base,
    sky: 0xf5dfce,
    ground: 0x8b9290,
    sun: 0xffdfb4,
    key: 2.4,
    fill: 1.05,
    exposure: 1.0,
    water: 0x568f9d,
    deep: 0x4c8496,
    shallow: 0x5fbfc4,
    mirror: 0xa9bcc6,
    mirrorFar: 0xa9bcc6,
    caustic: 0.6,
    reflect: 0.22,
    glow: 0.5,
    foam: 0.9,
    night: 0.12,
    rim: 0.596,
    fogColor: 0xf4ece8,
    haloLight: 0xfffaf7,
  },
  noon: {
    ...base,
    sky: 0xddebf1,
    ground: 0x8d9480,
    sun: 0xfff4d5,
    key: 2.6,
    fill: 1.15,
    exposure: 1.0,
    water: 0x337e90,
    deep: 0x22688a,
    shallow: 0x3fc4cc,
    mirror: 0x8fbdd6,
    mirrorFar: 0x8fbdd6,
    caustic: 1,
    reflect: 0.2,
    glow: 0.4,
    foam: 1,
    night: 0,
    rim: 0.65,
    haloAlpha: 0.45,
  },
  afternoon: {
    ...base,
    sky: 0xe4eddf,
    ground: 0x959378,
    sun: 0xffd09a,
    key: 2.3,
    fill: 1.0,
    exposure: 1.0,
    water: 0x4c9291,
    deep: 0x438a8a,
    shallow: 0x56c4b8,
    mirror: 0xa7bfc4,
    mirrorFar: 0xa7bfc4,
    caustic: 0.8,
    reflect: 0.24,
    glow: 0.5,
    foam: 0.95,
    night: 0.18,
    rim: 0.569,
    haloLight: 0xfbfaf7,
    haloAlpha: 0.5,
  },
  // The sun six degrees up behind the viewer: low golden light rakes the coast and the hills.
  golden: {
    ...base,
    sky: 0xe6e2e2,
    ground: 0x8e8070,
    sun: 0xffc27a,
    key: 2.6,
    env: 0.75,
    fill: 0.85,
    exposure: 1.0,
    water: 0x4c8a8c,
    deep: 0x3f7686,
    shallow: 0x5fb4ac,
    mirror: 0xc8bcc6,
    mirrorFar: 0xf4dcb4,
    caustic: 0.45,
    reflect: 0.32,
    glow: 0.6,
    foam: 0.92,
    night: 0.15,
    rimColor: 0xffcf8a,
    rim: 0.8,
    sunDisk: 0xfff2d4,
    rays: 0.3,
    glitter: 0.75,
    fog: 0.5,
    fogColor: 0xffe8c8,
    haloLight: 0xfff8ee,
    glowColor: 0xffc878,
    glowAlpha: 0.3,
    haloAlpha: 0.7,
  },
  // The sun on the horizon behind the viewer: the coast and Mount Soledad glow orange (alpenglow)
  // under the rising Earth's shadow and the pink Belt of Venus.
  sunset: {
    ...base,
    sky: 0xc8a8c0,
    ground: 0x6a5868,
    sun: 0xff8a48,
    key: 2.6,
    env: 0.5,
    fill: 0.6,
    exposure: 0.94,
    water: 0x4d7484,
    deep: 0x3a5a78,
    shallow: 0x557f94,
    mirror: 0xc4a0b4,
    mirrorFar: 0xf8b070,
    caustic: 0.1,
    reflect: 0.45,
    glow: 0.9,
    foam: 0.8,
    night: 0.4,
    rimColor: 0xffa45c,
    rim: 0.9,
    sunDisk: 0xffa34e,
    rays: 0.45,
    glitter: 1,
    fog: 0.65,
    fogColor: 0xf0b8a0,
    haloLight: 0xfff3e2,
    glowColor: 0xffa860,
    glowAlpha: 0.5,
    haloAlpha: 0.9,
  },
  // Three degrees down: the bright west behind the viewer lights the coast softly; windows, lamps
  // and the hillside houses come on.
  afterglow: {
    ...base,
    sky: 0x8b9cad,
    ground: 0x4c5259,
    sun: 0xffb6a1,
    key: 0.3,
    env: 0.6,
    fill: 0.38,
    exposure: 0.86,
    water: 0x3a6275,
    deep: 0x304d63,
    shallow: 0x467586,
    mirror: 0x788fa4,
    mirrorFar: 0xd8a08c,
    caustic: 0,
    reflect: 0.45,
    glow: 1,
    foam: 0.7,
    night: 0.75,
    rimColor: 0xff9c8c,
    rim: 0.45,
    sunDisk: 0xff8a50,
    rays: 0.15,
    glitter: 0,
    fog: 0.7,
    fogColor: 0xa5a8b4,
    haloLight: 0xfff0f2,
    haloDark: 0x192630,
    glowColor: 0xe5ae9c,
    glowAlpha: 0.45,
    haloAlpha: 0.9,
  },
  // Eight degrees down: the blue hour; the moon takes over the key light.
  blue: {
    ...base,
    sky: 0x6a82a4,
    ground: 0x3a4654,
    sun: 0xb2c9ed,
    key: 0.35,
    env: 0.3,
    fill: 0.3,
    exposure: 0.88,
    water: 0x26506e,
    deep: 0x223f66,
    shallow: 0x2b5874,
    mirror: 0x3a536e,
    mirrorFar: 0x53677b,
    caustic: 0,
    reflect: 0.32,
    glow: 1,
    foam: 0.6,
    night: 0.95,
    rimColor: 0x9eb6d3,
    rim: 0.25,
    sunDisk: 0xffb090,
    fog: 0.55,
    fogColor: 0x5a748a,
    haloLight: 0xf2f0ff,
    haloDark: 0x162532,
    glowColor: 0xadc4df,
    glowAlpha: 0.3,
    haloAlpha: 0.85,
  },
  night: {
    ...base,
    sky: 0x829bb4,
    ground: 0x3b4854,
    sun: 0xb4caff,
    key: 0.3,
    env: 0.24,
    fill: 0.28,
    exposure: 0.85,
    water: 0x234b68,
    deep: 0x1f4462,
    shallow: 0x245a6e,
    mirror: 0x24364c,
    mirrorFar: 0x24364c,
    caustic: 0,
    reflect: 0.26,
    glow: 1,
    foam: 0.55,
    night: 1,
    rim: 0.2,
    fogColor: 0x3a4a66,
    haloLight: 0xeef2ff,
    haloDark: 0x0c1620,
    glowColor: 0x9fb8ff,
    glowAlpha: 0.28,
    haloAlpha: 0.85,
  },
  predawn: {
    ...base,
    sky: 0x7389a2,
    ground: 0x3a4651,
    sun: 0xb2c9ec,
    key: 0.32,
    env: 0.32,
    fill: 0.32,
    exposure: 0.88,
    water: 0x2a5070,
    deep: 0x264466,
    shallow: 0x2f5c78,
    mirror: 0x465f78,
    mirrorFar: 0x5d7589,
    caustic: 0,
    reflect: 0.3,
    glow: 1,
    foam: 0.6,
    night: 0.85,
    rimColor: 0xaac0d9,
    rim: 0.25,
    fog: 0.7,
    fogColor: 0x7c90a4,
    haloLight: 0xf2f2ff,
    haloDark: 0x162632,
    glowColor: 0xb3c6df,
    glowAlpha: 0.28,
    haloAlpha: 0.85,
  },
  // The sun just under the hills ahead: dawn glows behind them, the marine layer blushes, and the
  // coast is lit from behind.
  dawn: {
    ...base,
    // The rising sun over the hills lays its glitter path across the bay toward the viewer.
    glitter: 0.8,
    sunDisk: 0xffb070,
    rays: 0.3,
    sky: 0xf0c0c8,
    ground: 0x707088,
    sun: 0xffb090,
    key: 1.2,
    env: 0.7,
    fill: 0.85,
    exposure: 0.95,
    water: 0x4a7a90,
    deep: 0x3f6a86,
    shallow: 0x5a9cb0,
    mirror: 0xc8b0cc,
    mirrorFar: 0xa8acd0,
    caustic: 0.2,
    reflect: 0.32,
    glow: 0.8,
    foam: 0.85,
    night: 0.5,
    rimColor: 0xffc4b4,
    rim: 0.6,
    fog: 0.85,
    fogColor: 0xf0d2d8,
    haloLight: 0xfff4f4,
    glowColor: 0xffb0c0,
    glowAlpha: 0.35,
    haloAlpha: 0.8,
  },
});

// A manual theme shows its anchor look exactly, as its still does.
export const ANCHORS = Object.freeze({ morning: "morning", noon: "noon", afternoon: "afternoon", evening: "night" });
export const anchorLook = (mode) => ({ ...LOOKS[ANCHORS[mode] || "noon"] });

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const channels = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => toLinear(v / 255));
// Colors blend in linear light, as the renderer lights them.
export function mixHex(a, b, t) {
  const ca = channels(a),
    cb = channels(b);
  const [r, g, bl] = ca.map((v, i) => Math.round(Math.min(Math.max(toSrgb(v + (cb[i] - v) * t), 0), 1) * 255));
  return (r << 16) | (g << 8) | bl;
}
export function mixLooks(a, b, t) {
  const out = {};
  for (const key of Object.keys(a)) out[key] = COLOR_KEYS.includes(key) ? mixHex(a[key], b[key], t) : a[key] + (b[key] - a[key]) * t;
  return out;
}

// [look, threshold] stops along the setting sun's altitude (degrees), and along the rising sun's.
// Above the twilight and golden stops the day blends by how high the sun stands against its noon.
const SETTING = [
  ["night", -14],
  ["blue", -8],
  ["afterglow", -3],
  ["sunset", 0.5],
  ["golden", 6],
  ["afternoon", 14],
];
const RISING = [
  ["night", -14],
  ["predawn", -8],
  ["dawn", -2],
  ["morning", 6],
];

function along(stops, altitude) {
  if (altitude <= stops[0][1]) return { ...LOOKS[stops[0][0]] };
  for (let i = 1; i < stops.length; i++) {
    const [name, at] = stops[i];
    if (altitude <= at) {
      const [previous, from] = stops[i - 1];
      return mixLooks(LOOKS[previous], LOOKS[name], smooth(from, at, altitude));
    }
  }
  return { ...LOOKS[stops.at(-1)[0]] };
}

// The look for a sun state: { altitude, rising, day: { solarNoon altitude via noonAltitude } }.
export function lookAt(state) {
  const noonAltitude = Math.max(state.noonAltitude ?? 60, 20);
  const climb = state.altitude / noonAltitude;
  if (state.rising) {
    const low = along(RISING, state.altitude);
    return climb <= 0.6 ? low : mixLooks(LOOKS.morning, LOOKS.noon, smooth(0.6, 0.92, climb));
  }
  const low = along(SETTING, state.altitude);
  return climb <= 0.6 ? low : mixLooks(LOOKS.afternoon, LOOKS.noon, smooth(0.6, 0.92, climb));
}

// The frieze faces the land from La Jolla Bay; its centre looks along this bearing (skyline.mjs).
export const VIEW_BEARING = 104;

// Where the sun stands for the frieze: its bearing, and whether its disk can show. The setting sun
// (bearings 242 to 299 through the year) is behind the viewer, so its disk never shows; the far
// right, where the land opens to the sea past the headland, glows toward it. The rising sun comes up
// over the hills ahead (bearings 61 to 118) and shows once it clears them (sky.mjs), until it has
// climbed into the page's own daylight.
export function sunOnScreen(state) {
  return {
    bearing: state.azimuth,
    up: state.altitude,
    setting: !state.rising,
    visible: state.rising && state.altitude > -1.2 && state.altitude < 14,
  };
}

// The key light's direction (toward the light, scene axes: x right, y up, z toward the viewer). By
// day it keeps the composition's authored sun. Low suns light the coast from where they truly are:
// the setting sun from behind the viewer and to one side (in October from the right), raking the
// coast and the hills with golden light; the rising sun from behind the hills, rimming the bluffs
// and throwing long shadows toward the viewer. Through the twilight the moon takes the authored
// direction back.
export const DAY_KEY = (() => {
  const v = [-10, 18, 12],
    n = Math.hypot(...v);
  return v.map((x) => x / n);
})();
const normalize = (v) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};
function slerp(a, b, t) {
  const d = Math.min(Math.max(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1), 1);
  const angle = Math.acos(d);
  if (angle < 1e-4) return normalize(a.map((x, i) => x + (b[i] - x) * t));
  const s = Math.sin(angle);
  return normalize(a.map((x, i) => (Math.sin((1 - t) * angle) * x + Math.sin(t * angle) * b[i]) / s));
}
export function keyDirection(state) {
  // A low sun stands a little higher than it is, so its long shadows stay legible instead of
  // vanishing at a grazing angle.
  const lift = Math.max(Math.sin((Math.max(state.altitude, 0) * Math.PI) / 180), state.rising ? 0.07 : 0.16);
  // Toward the sun's bearing: forward (-z) is VIEW_BEARING, right (+x) a quarter turn clockwise.
  const b = ((state.azimuth - VIEW_BEARING) * Math.PI) / 180;
  const toward = normalize([Math.sin(b), lift, -Math.cos(b)]);
  if (state.rising) {
    if (state.altitude < -2) return slerp(toward, DAY_KEY, smooth(-2, -8, state.altitude));
    return slerp(toward, DAY_KEY, smooth(2, 16, state.altitude));
  }
  // The afterglow, the bright west behind the viewer, still lights the coast's seaward faces; by
  // the blue hour the moon has the key.
  if (state.altitude < -1) return slerp(toward, DAY_KEY, smooth(-1, -8, state.altitude));
  return slerp(toward, DAY_KEY, smooth(3, 16, state.altitude));
}

// The credit's halo: a light veil under dark ink by day and a dark one under the evening theme's
// light ink, tinted by the hour, with a soft outer glow that warms at sunset and cools to moonlight.
export function creditHalo(look, darkInk) {
  const hex = (n, a) => `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a.toFixed(3)})`;
  return {
    // Light ink (dusk and night) keeps a dense dark halo: at 0.8 the dusk credit sat at 4.48:1 on
    // CI's Linux text rendering, and at 0.92 it still dipped to 4.46:1 on 2026-10-22 as the sea
    // behind it rendered a hair differently from run to run; 0.97 leaves margin over 4.5:1.
    // The deeper PC water put the tablet afternoon ring at 4.29:1 with the earlier faint veil.
    // Keep a dense light core under dark ink as well; the outer glow can still follow the hour.
    inner: darkInk ? hex(look.haloLight, Math.max(look.haloAlpha, 0.86)) : hex(look.haloDark, Math.max(look.haloAlpha, 0.97)),
    glow: hex(look.glowColor, look.glowAlpha),
  };
}
