// Pure optics for the footer's sea, with no DOM or three.js. water.mjs builds its shader from these
// numbers, so node tests can check the seabed, absorption, refraction, surf and wakes it draws.
// World units: the miniature's people are about 0.69 tall; z grows seaward, toward the camera.

export const WATER_LEVEL = 0.04;
export const WATER_IOR = 1.333;

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// The waterline (z) shared by the terrain, the beaches and the surf: the home beach's curve between
// x = -19 and 19, and the authored profile's smoothstep segments elsewhere. coastal_terrain.py exports
// the profile as [x, Blender y, ...]; the browser's z is -y.
export function shoreline(x, profile = []) {
  if (x >= -19 && x <= 19) return 2.1 - 0.7 * Math.sin(x * 0.23) - 0.25 * Math.sin(x * 0.68);
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1],
      b = profile[i];
    if (x <= b[0]) return -(a[1] + (b[1] - a[1]) * smoothstep(a[0], b[0], x));
  }
  return 2;
}

// The shader reads the waterline from a strip texture of evenly spaced samples across the water plane
// (x = -span to span). The GPU filters it linearly between texel centers; sampleStrip models that
// lookup with the same texel-centered coordinates the shader uses.
export function shorelineStrip(profile, texels = 1024, span = 95) {
  return Float32Array.from({ length: texels }, (_, i) => shoreline(-span + (2 * span * i) / (texels - 1), profile));
}
export function sampleStrip(strip, x, span = 95) {
  const n = strip.length;
  const u = (x + span) * ((n - 1) / (2 * span * n)) + 0.5 / n;
  const t = Math.min(Math.max(u * n - 0.5, 0), n - 1);
  const i = Math.min(Math.floor(t), n - 2);
  return strip[i] + (strip[i + 1] - strip[i]) * (t - i);
}

// Where a light above the water appears reflected in a level surface: the water point whose view ray
// (along the camera's `forward`) meets the light's mirror image below the plane.
export function mirrorPoint(x, y, z, forward) {
  const run = Math.max(y - WATER_LEVEL, 0) / Math.max(-forward[1], 0.05);
  return [x - forward[0] * run, z - forward[2] * run];
}

// The seabed below the surface at a distance d seaward of the waterline: a sandy shelf that deepens
// quickly and then slowly. Off Scripps Pier the head of the La Jolla Canyon brings deep water close
// to the beach, as it does at La Jolla Shores.
export const SHELF = { start: 0.025, depth: 0.9, reach: 2.1, slope: 0.09 };
export const CANYON = { x: 12.6, width: 3.4, depth: 0.95, reach: 2.4 };

export function seabedDepth(d, x = 0) {
  const t = Math.max(d, 0);
  const shelf = SHELF.start + SHELF.depth * (1 - Math.exp(-t / SHELF.reach)) + SHELF.slope * t;
  const canyon = CANYON.depth * Math.exp(-(((x - CANYON.x) / CANYON.width) ** 2)) * (1 - Math.exp(-t / CANYON.reach));
  return shelf + canyon;
}

// Rocky reefs off the coves and headlands, beside the wave-worn bluff feet (coastal_terrain.py):
// [x, half-width]. Sandy beach everywhere else.
export const REEFS = [
  [-46.5, 2.4],
  [-35.2, 1.7],
  [-24.6, 1.3],
  [25, 1.6],
  [33, 2],
  [42.3, 1.5],
];

export function reefAmount(x) {
  let amount = 0;
  for (const [center, width] of REEFS) amount = Math.max(amount, Math.exp(-(((x - center) / width) ** 2)));
  return amount;
}

// Absorption per world unit of path. Red goes first, so the sand turns aqua, then turquoise,
// then the open water's own color takes over.
export const ABSORB = [2.4, 0.85, 0.62];

export function transmittance(path) {
  const p = Math.max(path, 0);
  return ABSORB.map((sigma) => Math.exp(-sigma * p));
}

// Light reaching the seabed travels down from the surface and back up along the refracted view ray.
export const SUN_PATH = 1.2;
export function opticalPath(bedDepth, refractedY) {
  return bedDepth / Math.max(-refractedY, 0.25) + bedDepth * SUN_PATH;
}

// Snell refraction of a unit incident direction through a surface with a unit normal (GLSL refract).
export function refract(incident, normal, eta) {
  const d = incident[0] * normal[0] + incident[1] * normal[1] + incident[2] * normal[2];
  const k = 1 - eta * eta * (1 - d * d);
  if (k < 0) return [0, 0, 0];
  const s = eta * d + Math.sqrt(k);
  return incident.map((v, i) => eta * v - s * normal[i]);
}

// Where the view ray through a surface point meets the seabed, as a horizontal offset.
export function seabedOffset(view, normal, bedDepth) {
  const ray = refract(
    view.map((v) => -v),
    normal,
    1 / WATER_IOR
  );
  const run = bedDepth / Math.max(-ray[1], 0.25);
  return [ray[0] * run, ray[2] * run];
}

// Schlick's approximation of the Fresnel reflectance of water (F0 = 0.02).
export function schlick(cosTheta, f0 = 0.02) {
  const c = Math.min(Math.max(cosTheta, 0), 1);
  return f0 + (1 - f0) * (1 - c) ** 5;
}

// Surf: crests travel shoreward and break over the shelf. Their spacing shrinks toward the beach as
// shoaling waves slow, and a gentle bend along the coast keeps the lines from ruling the sea.
// bends: [wavenumber, phase, amplitude] along the coast; reefs bend crests seaward and break them earlier.
export const SURF = {
  spacing: 1.05,
  period: 9,
  shoal: 0.045,
  start: 2.5,
  reach: 1.25,
  edge: 0.2,
  reefStart: 0.7,
  reefBend: 0.6,
  bends: [
    [0.13, 1.3, 0.16],
    [0.37, 0.4, 0.07],
  ],
};

export function surfBend(x) {
  return SURF.bends.reduce((sum, [k, phase, amplitude]) => sum + Math.sin(x * k + phase) * amplitude, 0) - reefAmount(x) * SURF.reefBend;
}

// Phase of the swell at distance d seaward and time t; crests sit at whole numbers.
export function surfPhase(d, x, t) {
  const w = d + surfBend(x);
  return (w - SURF.shoal * w * w) / SURF.spacing + t / SURF.period;
}

// How strongly waves break at this distance: none offshore, whitewater over the shelf, fading on the
// last stretch of wet sand. Reefs make waves break farther out.
export function breaking(d, x) {
  const start = SURF.start + reefAmount(x) * SURF.reefStart;
  return smoothstep(start, start - SURF.reach, d) * smoothstep(SURF.edge - 0.08, SURF.edge + 0.12, d);
}

// Kelvin wake: in deep water a moving body's wake stays inside 19.47 degrees of its track, whatever
// its speed (arcsin 1/3).
export const KELVIN_HALF_ANGLE = Math.asin(1 / 3);
export function wakeArm(along) {
  return Math.max(along, 0) * Math.tan(KELVIN_HALF_ANGLE);
}

// Reflection refreshes: the mirrored coast is drawn on demand, like the coast's shadow map. Theme,
// size, reveal and camera changes ask for a new one; while the scene animates, refreshes are spaced
// by at least `spacing` frames, and a still scene refreshes at once.
export function createReflectionSchedule({ spacing = 2 } = {}) {
  let dirty = true,
    since = Infinity,
    renders = 0;
  return {
    invalidate() {
      dirty = true;
    },
    // Called once per drawn frame; returns whether to draw the reflection before the frame.
    due(live) {
      since++;
      if (!dirty || (live && since < spacing)) return false;
      dirty = false;
      since = 0;
      renders++;
      return true;
    },
    get dirty() {
      return dirty;
    },
    get renders() {
      return renders;
    },
  };
}
