// The footer coast's light through La Jolla's day, as a pure function of the sun (la-jolla-sun.mjs):
// lights, sea, sky, marine layer and the credit's halo. Node tests sample it; scene.mjs applies it.
//
// The footer looks south-west from the bay at La Jolla Shores, so the sun sets beyond the coast (in
// winter just beyond Point La Jolla, about 240 degrees from the Shores) and rises behind the viewer.
// The four theme looks the site always had stay exact anchors (a manual theme and its still show
// them); dawn, golden hour, sunset, afterglow and the blue hour blend between them by solar altitude.

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
  "skyHorizon",
  "skyMid",
  "skyTop",
  "seaFar",
  "bank",
  "sunDisk",
  "sunHalo",
  "fogColor",
  "haloLight",
  "haloDark",
  "glowColor",
];

// sky/ground/fill: hemisphere light; sun/key: the key light (the sun by day, the moon by night);
// env: the strength of the studio's soft reflections, which light every surface evenly (1 by day);
// rimColor/rim: the back fill that rims roofs and bluff tops; water: the Connect miniature's sea tint;
// deep/shallow and caustic/reflect/glow/foam: the footer's sea (water.mjs), whose mirror shows the
// sky as `mirror` in the foreground and `mirrorFar` near the beach; night: windows, lamps and the
// fire; sky*: the backdrop behind the coast (sky.mjs), with the open sea beyond the coast (seaFar),
// the marine layer's haze bank, the sun's disk and halo, rays, and the glitter path; fog: the marine
// layer's wisps; halo*/glow*: the credit. Colors are display colors; the four theme anchors keep
// the values the site always had and show no sky.
const base = {
  env: 1,
  rimColor: 0xd3e7ec,
  skyAlpha: 0,
  skyHorizon: 0xf6dcc0,
  skyMid: 0xf1d6d2,
  skyTop: 0xe8e4ec,
  seaFar: 0x9aa8b6,
  bank: 0xf6e2d2,
  bankAlpha: 0,
  sunDisk: 0xfff2d0,
  sunWhite: 0,
  sunHalo: 0xffd890,
  sunGlow: 0,
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
  // The sun six degrees up: low light rakes the coast from behind; the sky turns pale gold and the
  // far sea silver under a broad glitter path.
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
    skyAlpha: 0.8,
    skyHorizon: 0xffe3a8,
    skyMid: 0xfbe0c6,
    skyTop: 0xeee6ea,
    seaFar: 0xa8b0bc,
    bank: 0xe8d6c4,
    bankAlpha: 0.4,
    sunDisk: 0xfff2d4,
    sunHalo: 0xffd68a,
    sunGlow: 0.85,
    rays: 0.3,
    glitter: 0.75,
    fog: 0.5,
    fogColor: 0xffe8c8,
    haloLight: 0xfff8ee,
    glowColor: 0xffc878,
    glowAlpha: 0.3,
    haloAlpha: 0.7,
    sunWhite: 0.7,
  },
  // The sun on the horizon: the coast stands against a gold, apricot, rose and violet sky, lit by
  // the lavender east behind the viewer and rimmed in orange; the disk sinks into the sea.
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
    skyAlpha: 1,
    skyHorizon: 0xffbc5a,
    skyMid: 0xf49478,
    skyTop: 0x9c80c0,
    seaFar: 0x8c7e9c,
    bank: 0xd8a098,
    bankAlpha: 0.6,
    sunDisk: 0xffa34e,
    sunHalo: 0xff9a50,
    sunGlow: 1,
    rays: 0.45,
    glitter: 1,
    fog: 0.65,
    fogColor: 0xf0b8a0,
    haloLight: 0xfff3e2,
    glowColor: 0xffa860,
    glowAlpha: 0.5,
    haloAlpha: 0.9,
    sunWhite: 0.15,
  },
  // Three degrees down: an orange band on the horizon under rose and violet; windows and lamps on.
  afterglow: {
    ...base,
    sky: 0x9c8cb4,
    ground: 0x4c4660,
    sun: 0xff9a8a,
    key: 0.3,
    env: 0.6,
    fill: 0.38,
    exposure: 0.86,
    water: 0x3a5878,
    deep: 0x30466e,
    shallow: 0x46668a,
    mirror: 0xa486ae,
    mirrorFar: 0xf09a80,
    caustic: 0,
    reflect: 0.45,
    glow: 1,
    foam: 0.7,
    night: 0.75,
    rimColor: 0xff9c8c,
    rim: 0.45,
    skyAlpha: 0.95,
    skyHorizon: 0xff9e62,
    skyMid: 0xdc86a2,
    skyTop: 0x6c64a8,
    seaFar: 0x7a6c96,
    bank: 0xc08aa0,
    bankAlpha: 0.5,
    sunDisk: 0xff8a50,
    sunHalo: 0xff8a60,
    sunGlow: 0.55,
    rays: 0.15,
    glitter: 0,
    fog: 0.7,
    fogColor: 0xc8a0b8,
    haloLight: 0xfff0f2,
    haloDark: 0x1c1a3a,
    glowColor: 0xf08cac,
    glowAlpha: 0.45,
    haloAlpha: 0.9,
  },
  // Eight degrees down: deep blue over a last warm line; the moon takes over the key light.
  blue: {
    ...base,
    sky: 0x5d6fa8,
    ground: 0x343a55,
    sun: 0x9fb4ff,
    key: 0.55,
    env: 0.8,
    fill: 0.62,
    exposure: 0.88,
    water: 0x26506e,
    deep: 0x223f66,
    shallow: 0x2b5874,
    mirror: 0x3a4a78,
    mirrorFar: 0x5a5890,
    caustic: 0,
    reflect: 0.32,
    glow: 1,
    foam: 0.6,
    night: 0.95,
    rimColor: 0x8fa4e0,
    rim: 0.25,
    skyAlpha: 0.6,
    skyHorizon: 0x9a6c84,
    skyMid: 0x3f4a86,
    skyTop: 0x1d2648,
    seaFar: 0x34406c,
    bank: 0x5c5e8c,
    bankAlpha: 0.35,
    sunDisk: 0xffb090,
    sunHalo: 0xd07a70,
    sunGlow: 0.25,
    fog: 0.55,
    fogColor: 0x5a6494,
    haloLight: 0xf2f0ff,
    haloDark: 0x161a3a,
    glowColor: 0xb4a8ff,
    glowAlpha: 0.3,
    haloAlpha: 0.85,
  },
  night: {
    ...base,
    sky: 0x829bb4,
    ground: 0x3b4854,
    sun: 0xb4caff,
    key: 0.85,
    fill: 0.55,
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
    skyHorizon: 0x23345a,
    skyMid: 0x1b2747,
    skyTop: 0x111c22,
    seaFar: 0x1c2a44,
    fogColor: 0x3a4a66,
    haloLight: 0xeef2ff,
    haloDark: 0x0c1620,
    glowColor: 0x9fb8ff,
    glowAlpha: 0.28,
    haloAlpha: 0.85,
  },
  predawn: {
    ...base,
    sky: 0x6a78a8,
    ground: 0x3a4058,
    sun: 0xa8b8ff,
    key: 0.6,
    env: 0.85,
    fill: 0.6,
    exposure: 0.88,
    water: 0x2a5070,
    deep: 0x264466,
    shallow: 0x2f5c78,
    mirror: 0x46557e,
    mirrorFar: 0x56608c,
    caustic: 0,
    reflect: 0.3,
    glow: 1,
    foam: 0.6,
    night: 0.85,
    rimColor: 0xa0b0e8,
    rim: 0.25,
    skyAlpha: 0.45,
    skyHorizon: 0x6a7098,
    skyMid: 0x3c4678,
    skyTop: 0x1f2a4c,
    seaFar: 0x343f68,
    bank: 0x7880a8,
    bankAlpha: 0.35,
    fog: 0.7,
    fogColor: 0x7a84b0,
    haloLight: 0xf2f2ff,
    haloDark: 0x161c38,
    glowColor: 0xb0b8ff,
    glowAlpha: 0.28,
    haloAlpha: 0.85,
  },
  // The sun just under the horizon behind the viewer: looking west, the Earth's blue-grey shadow lies
  // on the sea under the pink Belt of Venus; the marine layer blushes, and the coast is lit from the front.
  dawn: {
    ...base,
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
    skyAlpha: 0.7,
    skyHorizon: 0x9ea6cc,
    skyMid: 0xf0b6c8,
    skyTop: 0xf6e6ea,
    seaFar: 0x9aa2c4,
    bank: 0xe6ccd4,
    bankAlpha: 0.55,
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

// Where the setting sun stands on screen: across the view by its azimuth (the winter sun near the
// middle, the summer sun far to the right), and up from the haze bank by its altitude. Fractions of
// the view's width; `up` in degrees above the bank's top. Rising suns are behind the viewer.
export function sunOnScreen(state) {
  const x = 0.55 + ((state.azimuth - 240) / 60) * 0.38;
  return { x: Math.min(Math.max(x, 0.4), 0.94), up: state.altitude, setting: !state.rising, visible: !state.rising && state.altitude > -1.5 };
}

// The key light's direction (toward the light, scene axes: x right, y up, z toward the viewer). By
// day it keeps the composition's authored sun; the setting sun swings it behind the coast toward the
// sun on screen, low enough to rake the bluffs, and the rising sun lights the coast from behind the
// viewer. Through the twilight the moon takes the authored direction back.
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
  // A low sun stands a little higher than it is, so its long shadows reach across the lawns and the
  // beach toward the viewer instead of vanishing at a grazing angle.
  const lift = Math.max(Math.sin((Math.max(state.altitude, 0) * Math.PI) / 180), state.rising ? 0.07 : 0.16);
  if (state.rising) {
    const dawn = normalize([-0.35, lift, 0.94]);
    if (state.altitude < -2) return slerp(dawn, DAY_KEY, smooth(-2, -8, state.altitude));
    return slerp(dawn, DAY_KEY, smooth(2, 16, state.altitude));
  }
  const side = (sunOnScreen(state).x - 0.5) * 2;
  const behind = normalize([0.45 * side, lift, -0.9]);
  // The afterglow still lights the coast from the west; by the blue hour the moon has the key.
  if (state.altitude < -1) return slerp(behind, DAY_KEY, smooth(-1, -8, state.altitude));
  return slerp(behind, DAY_KEY, smooth(3, 16, state.altitude));
}

// The credit's halo: a light veil under dark ink by day and a dark one under the evening theme's
// light ink, tinted by the hour, with a soft outer glow that warms at sunset and cools to moonlight.
export function creditHalo(look, darkInk) {
  const hex = (n, a) => `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a.toFixed(3)})`;
  return {
    // Light ink (dusk and night) keeps a dense dark halo: at 0.8 the dusk credit sat at 4.48:1 on
    // CI's Linux text rendering, and at 0.92 it still dipped to 4.46:1 on 2026-10-22 as the sea
    // behind it rendered a hair differently from run to run; 0.97 leaves margin over 4.5:1.
    inner: darkInk ? hex(look.haloLight, look.haloAlpha) : hex(look.haloDark, Math.max(look.haloAlpha, 0.97)),
    glow: hex(look.glowColor, look.glowAlpha),
  };
}
