import { pacificClock } from "./routine.mjs";

// Original finite curl-potential construction, informed by Bridson et al.:
// https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf
// Coordinates are meters, velocity m/s, potential m^2/s. No fluid grid or SDF.
const TAU = Math.PI * 2;
const normalize = (v) => {
  const length = Math.hypot(...v);
  return v.map((x) => x / length);
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const directions = [
  [1, 0.26, -0.48],
  [-0.55, 0.18, 1],
  [0.3, 1, 0.72],
  [1, -0.68, 0.34],
  [-0.41, 0.85, -1],
  [0.74, 0.55, -0.26],
];
const wavelengths = [7, 4.8, 3.3, 2.4, 1.7, 1.2];
const weights = [0.26, 0.21, 0.18, 0.15, 0.12, 0.08];
const rates = [-0.11, 0.17, -0.23, 0.31, -0.41, 0.53];
const phases = [0.17, 1.41, 2.33, 4.12, 5.61, 0.91];
export const WIND_MODES = Object.freeze(
  directions.map((direction, i) => {
    const d = normalize(direction),
      k = d.map((x) => (x * TAU) / wavelengths[i]);
    const a = normalize(cross(d, Math.abs(d[1]) < 0.8 ? [0, 1, 0] : [1, 0, 0])).map((x) => (x * weights[i] * wavelengths[i]) / TAU);
    return Object.freeze({
      k: Object.freeze(k),
      potential: Object.freeze(a),
      velocity: Object.freeze(cross(k, a).map((x) => -x)),
      phase: phases[i],
      rate: rates[i],
      wavelength: wavelengths[i],
      weight: weights[i],
    });
  })
);
export const DEFAULT_WIND = Object.freeze({ mean: Object.freeze([0.18, 0, -0.08]), gust: 0.45, rate: 1 });
export const WIND_SPEED_BOUND = Math.hypot(...DEFAULT_WIND.mean) + DEFAULT_WIND.gust;
export const wrapWindPhase = (phase) => ((phase % TAU) + TAU) % TAU;

export function windPhases(seconds, rate = 1, out = new Float32Array(WIND_MODES.length)) {
  for (let i = 0; i < WIND_MODES.length; i++) out[i] = wrapWindPhase(WIND_MODES[i].phase + WIND_MODES[i].rate * seconds * rate);
  return out;
}

export function sampleWind(point, seconds, out = [0, 0, 0], options = DEFAULT_WIND) {
  const { mean = DEFAULT_WIND.mean, gust = DEFAULT_WIND.gust, rate = 1 } = options;
  for (let axis = 0; axis < 3; axis++) out[axis] = mean[axis];
  for (const mode of WIND_MODES) {
    const phase = wrapWindPhase(mode.phase + mode.rate * seconds * rate);
    const s = gust * Math.sin(point[0] * mode.k[0] + point[1] * mode.k[1] + point[2] * mode.k[2] + phase);
    for (let axis = 0; axis < 3; axis++) out[axis] += mode.velocity[axis] * s;
  }
  return out;
}

export function sampleWindPotential(point, seconds, out = [0, 0, 0], options = DEFAULT_WIND) {
  const { mean = DEFAULT_WIND.mean, gust = DEFAULT_WIND.gust, rate = 1 } = options;
  const base = cross(mean, point);
  for (let axis = 0; axis < 3; axis++) out[axis] = base[axis] * 0.5;
  for (const mode of WIND_MODES) {
    const phase = wrapWindPhase(mode.phase + mode.rate * seconds * rate);
    const c = gust * Math.cos(point[0] * mode.k[0] + point[1] * mode.k[1] + point[2] * mode.k[2] + phase);
    for (let axis = 0; axis < 3; axis++) out[axis] += mode.potential[axis] * c;
  }
  return out;
}

export const windGLSLFloat = (x) => (Number.isInteger(x) ? `${x}.0` : x.toPrecision(15));
export const windGLSLVec3 = (v) => `vec3(${v.map(windGLSLFloat).join(",")})`;
export function windSumGLSL(phaseUniform, scaleUniform = null) {
  return WIND_MODES.map(
    (m, i) =>
      `v += ${windGLSLVec3(m.velocity)} * sin(dot(p,${windGLSLVec3(m.k)})+${phaseUniform}[${i}])${scaleUniform ? `*${scaleUniform}[${i}]` : ""};`
  ).join("\n");
}
export const windFieldGLSL = `
uniform vec3 coastalWindMean;
uniform float coastalWindGust;
uniform float coastalWindPhase[6];
vec3 coastalWind(vec3 p) {
  vec3 v=vec3(0.0);
  ${windSumGLSL("coastalWindPhase")}
  return coastalWindMean+coastalWindGust*v;
}`;

export function createWindUniforms(seconds = 0, options = DEFAULT_WIND) {
  return {
    coastalWindMean: { value: new Float32Array(options.mean ?? DEFAULT_WIND.mean) },
    coastalWindGust: { value: options.gust ?? DEFAULT_WIND.gust },
    coastalWindPhase: { value: windPhases(seconds, options.rate ?? 1) },
  };
}
export function updateWindUniforms(uniforms, seconds, options = DEFAULT_WIND) {
  uniforms.coastalWindMean.value.set(options.mean ?? DEFAULT_WIND.mean);
  uniforms.coastalWindGust.value = options.gust ?? DEFAULT_WIND.gust;
  windPhases(seconds, options.rate ?? 1, uniforms.coastalWindPhase.value);
}

// ---------------------------------------------------------------------------------------------------
// One wind for the whole coast (Sirui, 2026-10-15). The six modes above stay as the small eddies of
// the air inside the house; this part is the weather outside: a mean breeze that follows La Jolla's
// daily sea-breeze cycle, and gust fronts that ride on it downwind. The ocean's wind sea, ripples and
// whitecaps, the clifftop planting, the room plants, the curtains, the bath steam and the dust and
// spray all read this one state, so a gust that darkens the water reaches the bluff a few seconds
// later and the curtains when it meets the glass. See PHYSICS.md ("One wind for the coast").
//
// Units are metres, seconds and m/s, in three.js world axes: +X north, +Y up, +Z east (the sea lies
// toward -Z). "Toward" vectors point where the air goes; meteorological directions say where it comes
// from, in degrees clockwise from north.

const DEG = Math.PI / 180;
const smooth01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// GLSL smoothstep, exactly.
const smoothstepJS = (e0, e1, x) => smooth01((x - e0) / (e1 - e0));

// The daily cycle follows the October averages at Scripps Pier, La Jolla (NDBC station LJPC1,
// 2023-2025, hourly; speeds are the mean of single readings, directions those of the mean vector):
// a light land breeze off the mesas at night from the east, a lull at 09:00 while the wind turns
// through north (the station's mean vector nearly vanishes then, at 0.11 m/s, though single readings
// still average 1.5 m/s), a west-north-westerly sea breeze from 10:00 that peaks at 2.8 m/s at 15:00
// and veers to the north-west, then a lighter evening that backs into the night breeze through north.
// Rows are [Pacific minute of the day, mean speed in m/s, direction the wind comes from in degrees].
export const SEA_BREEZE = Object.freeze(
  [
    [0, 1.35, 66],
    [180, 1.6, 86],
    [360, 1.5, 88],
    [480, 1.55, 78],
    [540, 0.7, 6],
    [600, 1.65, 288],
    [720, 2.15, 287],
    [840, 2.7, 300],
    [900, 2.75, 305],
    [960, 2.65, 306],
    [1080, 2.0, 313],
    [1200, 1.65, 329],
    [1320, 1.4, 338],
    [1380, 1.4, 12],
  ].map((row) => Object.freeze(row))
);
// The knots as "toward" velocity components: [minute, north (x), east (z)].
const breezeKnots = SEA_BREEZE.map(([minute, speed, from]) => [minute, -Math.cos(from * DEG) * speed, -Math.sin(from * DEG) * speed]);

// The breeze at a minute of the Pacific day: a periodic cubic Hermite (Catmull-Rom tangents over the
// uneven knots) through the velocity vectors, so speed and direction both stay smooth, midnight
// included, and a turn of the wind passes through a lull instead of a jump.
export function seaBreeze(minute, out = {}) {
  const n = breezeKnots.length;
  let m = Number(minute);
  if (!Number.isFinite(m)) m = 900;
  m = ((m % 1440) + 1440) % 1440;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (breezeKnots[k][0] <= m) i = k;
  const knot = (k) => breezeKnots[((k % n) + n) % n],
    time = (k) => knot(k)[0] + 1440 * Math.floor(k / n);
  const t0 = time(i),
    t1 = time(i + 1),
    h = t1 - t0,
    s = (m - t0) / h,
    s2 = s * s,
    s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1,
    h10 = s3 - 2 * s2 + s,
    h01 = -2 * s3 + 3 * s2,
    h11 = s3 - s2;
  let x = 0,
    z = 0;
  for (let axis = 1; axis <= 2; axis++) {
    const m0 = (knot(i + 1)[axis] - knot(i - 1)[axis]) / (time(i + 1) - time(i - 1)),
      m1 = (knot(i + 2)[axis] - knot(i)[axis]) / (time(i + 2) - time(i));
    const value = h00 * knot(i)[axis] + h10 * h * m0 + h01 * knot(i + 1)[axis] + h11 * h * m1;
    if (axis === 1) x = value;
    else z = value;
  }
  const speed = Math.hypot(x, z),
    dx = speed > 1e-9 ? x / speed : 0,
    dz = speed > 1e-9 ? z / speed : 1;
  out.minute = m;
  out.speed = speed;
  out.toward = [x, z];
  out.direction = [dx, dz];
  out.yaw = Math.atan2(dx, dz);
  out.fromDegrees = (((Math.atan2(-dz, -dx) / DEG) % 360) + 360) % 360;
  return out;
}

// Gust fronts. Along the wind, every quantity is a function of the retarded time psi = t - s / c, with s
// the downwind distance and c the front speed, so whatever passes one point reaches a point d metres
// downwind d / c seconds later: a front that travels with the mean flow (Taylor's frozen turbulence).
// psi is cut into slots of `cell` seconds. A slot holds a gust with a hashed strength (a fifth of the
// slots hold none, the rest between 0.35 and 1), a hashed arrival within the slot and a hashed phase
// for its patchiness across the wind.
// Each gust rises over `rise` seconds and decays with e-folding `decay`, ending by 1.2 slots, so only
// the current and previous slot can contribute. `base` sets the long-run mean of the envelope to 1.
export const COAST_GUSTS = Object.freeze({
  cell: 8,
  rise: 1.2,
  decay: 3.5,
  presence: 0.2,
  amplitude: 0.8,
  width: 70, // m, lateral size of a front's patches
  frontFactor: 1, // front speed / mean speed
  minFront: 1.2, // m/s, so a lull still carries its pattern downwind
  veer: 0.14, // rad, the wind's slow swing about its mean direction
});
const GUST = COAST_GUSTS;
const GUST_CUT = [0.9 * GUST.cell, 1.2 * GUST.cell];
function gustShape(u) {
  if (u <= 0 || u >= GUST_CUT[1]) return 0;
  return smoothstepJS(0, GUST.rise, u) * Math.exp(-Math.max(0, u - GUST.rise) / GUST.decay) * (1 - smoothstepJS(GUST_CUT[0], GUST_CUT[1], u));
}
// A slot's gust strength from its hash h: none below `presence`, then 0.35 to 1.
const gustStrength = (h) => (h < GUST.presence ? 0 : 0.35 + 0.65 * smoothstepJS(GUST.presence, 1, h));
// Mean envelope: E[strength] = 0.675 (1 - presence), E[lateral] = 0.65, times the shape's integral per slot.
export const COAST_GUST_BASE = (() => {
  const steps = 4000,
    h = GUST_CUT[1] / steps;
  let area = 0;
  for (let k = 0; k <= steps; k++) area += (k === 0 || k === steps ? 1 : k % 2 ? 4 : 2) * gustShape(k * h);
  area *= h / 3;
  return 1 - (GUST.amplitude * 0.675 * (1 - GUST.presence) * 0.65 * area) / GUST.cell;
})();

// lowbias32 (Chris Wellons): exact 32-bit integer arithmetic, identical in JavaScript and GLSL ES 3.00,
// so the CPU and the GPU agree on every gust instead of disagreeing on a sine hash's rounding.
function hash32(x) {
  x >>>= 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}
const unit32 = (x) => hash32(x) / 4294967296;

// The gust envelope at retarded time psi (s) and crosswind coordinate xi (m); its long-run mean is 1.
export function coastGustAt(psi, xi) {
  const cell = Math.floor(psi / GUST.cell);
  let sum = 0;
  for (let j = 0; j < 2; j++) {
    const n = cell - j,
      id = ((n + 65536) * 3) >>> 0,
      shape = gustShape(psi - (n + 0.8 * unit32(id + 2)) * GUST.cell);
    if (shape > 0) sum += gustStrength(unit32(id + 1)) * (0.65 + 0.35 * Math.cos((TAU * xi) / GUST.width + TAU * unit32(id + 3))) * shape;
  }
  return COAST_GUST_BASE + GUST.amplitude * sum;
}
// The direction's slow swing (rad), also a function of retarded time, so it travels with the fronts.
export const coastVeerAt = (psi) => GUST.veer * (0.6 * Math.sin((TAU * psi) / 37 + 1.3) + 0.4 * Math.sin((TAU * psi) / 13 + 4.1));

// The house: the glass front's plane, the air that leaks inside with the doors shut or open, the
// share of the six eddy modes indoors, and how sheltered the terrace under the cave lip is.
export const COAST_SHELTER = Object.freeze({ glassZ: -4.48, closed: 0.012, open: 0.06, eddy: 0.6, terrace: 0.12 });
// A standard airport wind cone stands straight out at about 15 knots.
export const WIND_CONE_FULL = 15 * 0.514444;

const g = (x) => windGLSLFloat(x);
// The same envelope in GLSL. Bind `coastWind.uniforms` (or a createCoastWind instance's) to every
// shader that includes it; the uniforms are shared objects, so one update per frame moves them all.
export const coastWindGLSL = `
uniform vec4 coastWindState; // downwind unit vector (x, z), mean speed m/s, front speed m/s
uniform float coastWindClock; // the scene's active seconds
uint coastWindHash(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u;
  return x;
}
float coastWindUnit(uint x) { return float(coastWindHash(x)) * 2.3283064365386963e-10; }
float coastWindGustAt(float psi, float xi) {
  float cell = floor(psi / ${g(GUST.cell)});
  float sum = 0.0;
  for (int j = 0; j < 2; j++) {
    float n = cell - float(j);
    uint id = uint(int(n) + 65536) * 3u;
    float u = psi - (n + 0.8 * coastWindUnit(id + 2u)) * ${g(GUST.cell)};
    float shape = smoothstep(0.0, ${g(GUST.rise)}, u) * exp(-max(0.0, u - ${g(GUST.rise)}) / ${g(GUST.decay)}) * (1.0 - smoothstep(${g(GUST_CUT[0])}, ${g(GUST_CUT[1])}, u));
    float h = coastWindUnit(id + 1u);
    float strength = step(${g(GUST.presence)}, h) * (0.35 + 0.65 * smoothstep(${g(GUST.presence)}, 1.0, h));
    sum += strength * (0.65 + 0.35 * cos(${g(TAU / GUST.width)} * xi + ${g(TAU)} * coastWindUnit(id + 3u))) * shape;
  }
  return ${g(COAST_GUST_BASE)} + ${g(GUST.amplitude)} * sum;
}
float coastWindRetarded(vec2 xz) { return coastWindClock - dot(xz, coastWindState.xy) / max(coastWindState.w, 0.5); }
float coastWindAcross(vec2 xz) { return dot(xz, vec2(-coastWindState.y, coastWindState.x)); }
// The envelope at a horizontal world point, \`lag\` seconds late (a plant's response delay).
float coastWindGust(vec2 xz, float lag) { return coastWindGustAt(coastWindRetarded(xz) - lag, coastWindAcross(xz)); }
float coastWindVeer(float psi) { return ${g(GUST.veer)} * (0.6 * sin(${g(TAU / 37)} * psi + 1.3) + 0.4 * sin(${g(TAU / 13)} * psi + 4.1)); }
// The outdoor wind velocity (m/s) at a world point.
vec3 coastWindVelocity(vec3 p, float lag) {
  float psi = coastWindRetarded(p.xz) - lag;
  float speed = coastWindState.z * coastWindGustAt(psi, coastWindAcross(p.xz));
  float phi = coastWindVeer(psi);
  vec2 d = coastWindState.xy;
  vec2 v = speed * (d * cos(phi) + vec2(-d.y, d.x) * sin(phi));
  return vec3(v.x, 0.0, v.y);
}`;

// The coast's wind. `update({ seconds, minute, doors })` once per frame from the scene's active clock,
// the Pacific minute (fractional, preview-aware) and the facade doors' open fraction (0..1); every
// sampler and the shared GLSL uniforms then describe the same instant. Samplers allocate nothing
// when given an output array.
export function createCoastWind({ minute = 900, seconds = 0, doors = 0 } = {}) {
  let glassZ = COAST_SHELTER.glassZ;
  const uniforms = {
    coastWindState: { value: new Float32Array(4) },
    coastWindClock: { value: 0 },
  };
  const breeze = {};
  const state = {
    seconds: 0,
    minute: 0,
    meanSpeed: 0,
    direction: [0, 1],
    yaw: 0,
    fromDegrees: 0,
    frontSpeed: GUST.minFront,
    doors: 0,
    indoorLeak: COAST_SHELTER.closed,
  };
  const scratch = [0, 0, 0];

  function update({ seconds: t = state.seconds, minute: m = state.minute, doors: open = state.doors } = {}) {
    seaBreeze(m, breeze);
    state.seconds = Number.isFinite(t) ? t : 0;
    state.minute = breeze.minute;
    state.meanSpeed = breeze.speed;
    state.direction[0] = breeze.direction[0];
    state.direction[1] = breeze.direction[1];
    state.yaw = breeze.yaw;
    state.fromDegrees = breeze.fromDegrees;
    state.frontSpeed = Math.max(GUST.minFront, GUST.frontFactor * breeze.speed);
    state.doors = Math.max(0, Math.min(1, Number(open) || 0));
    state.indoorLeak = COAST_SHELTER.closed + (COAST_SHELTER.open - COAST_SHELTER.closed) * state.doors;
    const v = uniforms.coastWindState.value;
    v[0] = state.direction[0];
    v[1] = state.direction[1];
    v[2] = state.meanSpeed;
    v[3] = state.frontSpeed;
    uniforms.coastWindClock.value = state.seconds;
    return api;
  }

  const retarded = (x, z, t) => t - (x * state.direction[0] + z * state.direction[1]) / Math.max(state.frontSpeed, 0.5);
  const across = (x, z) => -x * state.direction[1] + z * state.direction[0];
  // The gust envelope (mean 1) at a horizontal point, `lag` seconds late.
  function gust(x, z, t = state.seconds, lag = 0) {
    return coastGustAt(retarded(x, z, t) - lag, across(x, z));
  }
  // The outdoor wind (m/s) at a world point.
  function sample(x, y, z, t = state.seconds, out = [0, 0, 0]) {
    const psi = retarded(x, z, t),
      speed = state.meanSpeed * coastGustAt(psi, across(x, z)),
      phi = coastVeerAt(psi),
      c = Math.cos(phi),
      s = Math.sin(phi),
      dx = state.direction[0],
      dz = state.direction[1];
    out[0] = speed * (dx * c - dz * s);
    out[1] = 0;
    out[2] = speed * (dz * c + dx * s);
    return out;
  }
  // Inside the house: the leak through the glass front, which feels each gust when it meets the
  // glass at the same x, plus the six eddy modes at the same share of the breeze.
  function sampleIndoor(x, y, z, t = state.seconds, out = [0, 0, 0]) {
    const zf = glassZ,
      share = state.indoorLeak * state.meanSpeed,
      mean = share * coastGustAt(retarded(x, zf, t), across(x, zf)),
      eddy = COAST_SHELTER.eddy * share;
    out[0] = mean * state.direction[0];
    out[1] = 0;
    out[2] = mean * state.direction[1];
    for (let i = 0; i < WIND_MODES.length; i++) {
      const mode = WIND_MODES[i],
        s = eddy * Math.sin(x * mode.k[0] + y * mode.k[1] + z * mode.k[2] + mode.phase + mode.rate * t);
      out[0] += mode.velocity[0] * s;
      out[1] += mode.velocity[1] * s;
      out[2] += mode.velocity[2] * s;
    }
    return out;
  }
  // The drift a sheltered indoor volume (the bath steam) feels this instant, in the
  // createSteamDensity wind format: a mean vector and an eddy amplitude for the six modes.
  const drift = { mean: [0, 0, 0], gust: 0, rate: 1 };
  function indoorDrift(x, z, shelter = 1, t = state.seconds) {
    const zf = glassZ,
      share = shelter * state.indoorLeak * state.meanSpeed,
      mean = share * coastGustAt(retarded(x, zf, t), across(x, zf));
    drift.mean[0] = mean * state.direction[0];
    drift.mean[1] = 0;
    drift.mean[2] = mean * state.direction[1];
    drift.gust = COAST_SHELTER.eddy * share;
    return drift;
  }
  // For a wind sock or a flag at (x, z): `yaw` turns an object whose local +Z points downwind
  // (object.rotation.y = yaw), `fromDegrees` is the meteorological direction, `speed` includes the
  // gust, and `extension` is how far a standard wind cone stands out (1 at 15 knots).
  function vane(x = 0, z = 0, t = state.seconds, out = {}) {
    sample(x, 0, z, t, scratch);
    const speed = Math.hypot(scratch[0], scratch[2]);
    out.yaw = Math.atan2(scratch[0], scratch[2]);
    out.fromDegrees = (((Math.atan2(-scratch[2], -scratch[0]) / DEG) % 360) + 360) % 360;
    out.speed = speed;
    out.meanSpeed = state.meanSpeed;
    out.gust = gust(x, z, t);
    out.extension = Math.min(1, speed / WIND_CONE_FULL);
    return out;
  }

  const api = {
    uniforms,
    state,
    update,
    setShelter({ glassZ: next = COAST_SHELTER.glassZ } = {}) {
      if (!Number.isFinite(next)) throw new TypeError("The facade wind plane must be finite.");
      glassZ = next;
      return api;
    },
    get shelterGlassZ() {
      return glassZ;
    },
    gust,
    sample,
    sampleIndoor,
    indoorDrift,
    vane,
    // (x, y, z, t, out) samplers for particles: the open coast, and the air inside the house.
    outdoor: { sample },
    indoor: { sample: sampleIndoor },
    evidence() {
      const at = (x, z) => gust(x, z);
      return {
        method: "sea-breeze cycle (periodic Hermite over velocity knots) / hashed gust fronts on retarded time / six indoor eddy modes",
        seconds: state.seconds,
        minute: state.minute,
        meanMetersPerSecond: state.meanSpeed,
        fromDegrees: state.fromDegrees,
        towardYaw: state.yaw,
        direction: [...state.direction],
        frontMetersPerSecond: state.frontSpeed,
        doorsOpen: state.doors,
        indoorLeak: state.indoorLeak,
        gustBase: COAST_GUST_BASE,
        shelterGlassZ: glassZ,
        gust: { sea: at(0, -40), beach: at(0, -14), glass: at(0, glassZ), bluff: at(0, 14) },
      };
    },
  };
  return update({ minute, seconds, doors });
}

// The scene's one coast wind. The controller updates it every moving frame; shaders bind its uniforms.
export const coastWind = createCoastWind();

// The Pacific minute of the day, fractional, from the clock: one calendar lookup per wall-clock minute,
// so a live breeze follows the clock to the second and never steps at the minute (Pacific offsets are
// whole hours, so the seconds carry over unchanged).
const liveClock = { utcMinute: NaN, timeZone: "", minute: 0 };
export function livePacificMinute(timeZone = "America/Los_Angeles", now = Date.now()) {
  const utcMinute = Math.floor(now / 60000);
  if (utcMinute !== liveClock.utcMinute || timeZone !== liveClock.timeZone) {
    liveClock.utcMinute = utcMinute;
    liveClock.timeZone = timeZone;
    liveClock.minute = pacificClock(new Date(utcMinute * 60000), timeZone).minute;
  }
  return liveClock.minute + (now - utcMinute * 60000) / 60000;
}
