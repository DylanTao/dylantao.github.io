// Light-transport lab: one sunlit grotto pool, two estimators that share a single path sampler.
//   "pt"  unidirectional path tracing: next-event estimation to the sun cone and to the sky through
//         the light well, cosine BSDF sampling, power-heuristic MIS, Russian roulette.
//   "mlt" primary-sample-space Metropolis light transport (Kelemen et al. 2002): the same path
//         sampler, driven by a mutable vector of uniform numbers instead of a fresh RNG stream.
//   "lt"  light tracing with camera connections, used only to build the converged reference.
// Units are metres, +Y is up and +Z is south. No dependencies; runs in Node and in a module Worker.
// Hot loops read scene numbers from module slots that each renderer binds before a slice of work,
// and write hit records into typed arrays, so tracing a path allocates nothing.

const clock = typeof performance !== "undefined" && typeof performance.now === "function" ? () => performance.now() : () => Date.now();

const INV_PI = 1 / Math.PI;
const TWO_PI = 2 * Math.PI;
const DEG = Math.PI / 180;
// Spawned rays start this far off the surface along its normal. The water root finder stops
// within 1e-9 m of the surface, so the offset always lands on the intended side.
const SPAWN_EPS = 5e-6;
const CAMERA_DIMS = 2;
// Per vertex: sun direction (2), sky point (2), BSDF direction or Fresnel choice (2), roulette (1).
// A fixed stride keeps every decision on the same primary-sample coordinate between mutations.
const VERTEX_DIMS = 7;
const MAX_RECORDED_VERTICES = 80;

export const KIND = Object.freeze({ NONE: 0, ESCAPE: 1, DIFFUSE: 2, WATER: 3 });
const K_NONE = 0;
const K_ESCAPE = 1;
const K_DIFFUSE = 2;
const K_WATER = 3;
const K_POOL_EXIT = 4;
const M_LIMESTONE = 0;
const M_SLATE = 1;
const M_TILE = 2;
const M_WATER = 3;

export const DEFAULT_EXPOSURE = 14;

export const DEFAULT_SCENE = Object.freeze({
  sunRadiusDegrees: 0.8,
  sunElevationDegrees: 62,
  // Measured from +Z (south) toward +X.
  sunAzimuthDegrees: 12,
  // Irradiance on a surface facing the sun. The disc radiance follows from it, so changing the
  // sun's size changes how hard the caustics are to find, not how bright the scene is.
  sunIrradiance: 1,
  sunColor: [1, 0.92, 0.8],
  skyRadiance: 0.15,
  skyColor: [0.5, 0.68, 1],
  grotto: [-2, 2, 2.6, -1.6, 1.6],
  // Light well: centre x, centre z, radius, in the ceiling plane.
  hole: [0.54, 0.82, 0.32],
  // Pool: centre x, centre z, radius, floor y.
  pool: [0.2, -0.1, 1, -0.7],
  waterLevel: -0.05,
  ior: 1.33,
  sigmaA: [0.25, 0.08, 0.06],
  // Frozen ripples: amplitude (m), wavelength (m), direction (degrees from +X toward +Z), phase.
  waves: [
    [0.003, 0.42, 20, 0.4],
    [0.002, 0.27, 115, 2.1],
    [0.0009, 0.13, 200, 4.4],
    [0.0006, 0.095, 290, 1.3],
    [0.00045, 0.07, 60, 5.2],
    [0.0003, 0.05, 150, 3],
  ],
  // Radial ripple from a drip near the rim: centre x, centre z, amplitude, wavelength, and the
  // radius of its smooth compact envelope (1 - r^2/R^2)^3.
  ripple: [0.75, -0.85, 0.0004, 0.06, 0.8],
  albedo: {
    limestone: [0.62, 0.55, 0.45],
    slate: [0.26, 0.25, 0.23],
    tile: [0.72, 0.76, 0.74],
  },
  camera: { position: [-1.75, 1.6, 1.5], lookAt: [0.25, 0.6, -1.1], fovYDegrees: 58 },
  maxDepth: 12,
  rrDepth: 3,
  // "mis" (NEE + BSDF, power heuristic), "nee" (NEE only where possible), "bsdf" (no NEE).
  strategy: "mis",
  // false empties the pool (dry tiles lit directly by the sun), for NEE/MIS tests.
  water: true,
  // "both", "sun" or "sky": which emitters are on (tests use one at a time).
  lights: "both",
  // "all"; "specular" keeps only paths whose camera ray first meets water or the sky, "diffuse"
  // only those whose camera ray first meets a diffuse surface (the light tracer's share).
  firstHit: "all",
  // { albedo, emission }: closed grey box with emitting walls and no sun, for furnace tests.
  furnace: null,
});

function normalize3(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function colorWithLuminance(c, lum) {
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return [(c[0] * lum) / l, (c[1] * lum) / l, (c[2] * lum) / l];
}

export function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Resolves options into the flat numbers the tracer needs.
export function createScene(options = {}) {
  const o = { ...DEFAULT_SCENE, ...(options.scene || {}) };
  for (const key of ["sunRadiusDegrees", "maxDepth", "strategy", "furnace", "camera", "firstHit", "lights", "water"]) {
    if (options[key] !== undefined) o[key] = options[key];
  }
  const furnace = o.furnace;
  const el = o.sunElevationDegrees * DEG;
  const az = o.sunAzimuthDegrees * DEG;
  const sun = normalize3([Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)]);
  const theta = Math.max(1e-3, o.sunRadiusDegrees) * DEG;
  // 1 - cos without cancellation; it is about 1e-5 for the real sun.
  const oneMinusCos = 2 * Math.sin(theta / 2) ** 2;
  const sunSolidAngle = TWO_PI * oneMinusCos;
  const sunRadiance = o.sunIrradiance / (Math.PI * Math.sin(theta) ** 2);
  const sunA = normalize3(cross3(sun, Math.abs(sun[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const sunB = cross3(sun, sunA);

  const waves = [];
  let ampSum = 0;
  for (const [a, lambda, dirDeg, phase] of o.waves) {
    const k = TWO_PI / lambda;
    waves.push([a, k * Math.cos(dirDeg * DEG), k * Math.sin(dirDeg * DEG), phase]);
    ampSum += a;
  }
  const [rx, rz, ra, rLambda, rSupport] = o.ripple || [0, 0, 0, 1, 1];
  const rk = TWO_PI / rLambda;
  ampSum += Math.abs(ra);
  // Slope and curvature bounds of A cos(k r) (1 - r^2/R^2)^3; the envelope's slope stays under
  // 1.72/R and its curvature under 6/R^2.
  const rippleSlope = Math.abs(ra) * (rk + 2 / rSupport);
  const rippleCurvature = Math.abs(ra) * (rk * rk + (4 * rk) / rSupport + 6 / (rSupport * rSupport));

  const cam = o.camera;
  const forward = normalize3([cam.lookAt[0] - cam.position[0], cam.lookAt[1] - cam.position[1], cam.lookAt[2] - cam.position[2]]);
  const right = normalize3(cross3(forward, [0, 1, 0]));
  const up = cross3(right, forward);
  const tanY = Math.tan((cam.fovYDegrees * DEG) / 2);

  const albedo = furnace ? new Array(9).fill(furnace.albedo) : [...o.albedo.limestone, ...o.albedo.slate, ...o.albedo.tile];
  const holeRadius = furnace ? 0 : o.hole[2];

  return Object.freeze({
    options: o,
    grotto: o.grotto.slice(),
    hole: [o.hole[0], o.hole[1], holeRadius],
    pool: o.pool.slice(),
    waterLevel: o.waterLevel,
    water: o.water !== false,
    ior: o.ior,
    sigmaA: furnace ? [0, 0, 0] : o.sigmaA.slice(),
    waves,
    ripple: [rx, rz, ra, rk, rSupport * rSupport, 1 / (rSupport * rSupport), rippleSlope, rippleCurvature],
    slab: [o.waterLevel - ampSum - 1e-4, o.waterLevel + ampSum + 1e-4],
    albedo,
    emission: furnace ? [furnace.emission, furnace.emission, furnace.emission] : [0, 0, 0],
    sunOn: !furnace && o.lights !== "sky",
    skyOn: !furnace && o.lights !== "sun",
    sun,
    sunA,
    sunB,
    sunRadiusDegrees: o.sunRadiusDegrees,
    sunCos: Math.cos(theta),
    sunOneMinusCos: oneMinusCos,
    sunPdf: 1 / sunSolidAngle,
    sunRadiance: colorWithLuminance(o.sunColor, sunRadiance),
    skyRadiance: colorWithLuminance(o.skyColor, o.skyRadiance),
    camera: { position: cam.position.slice(), forward, right, up, tanY, fovYDegrees: cam.fovYDegrees, lookAt: cam.lookAt.slice() },
    maxDepth: o.maxDepth,
    rrDepth: o.rrDepth,
    strategy: o.strategy === "nee" ? 1 : o.strategy === "bsdf" ? 2 : 0,
    firstHit: o.firstHit === "specular" ? 1 : o.firstHit === "diffuse" ? 2 : 0,
  });
}

// ---------------------------------------------------------------------------------------------
// Fast sin/cos: fdlibm's kernel polynomials after a two-constant reduction by pi/2. Accurate to
// about 1e-16 for the arguments used here, and about three times faster than Math.sin + Math.cos.
// The coefficients come from fdlibm's k_sin.c and k_cos.c, whose notice reads:
//   Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
//   Developed at SunSoft, a Sun Microsystems, Inc. business.
//   Permission to use, copy, modify, and distribute this software is freely granted,
//   provided that this notice is preserved.
// ---------------------------------------------------------------------------------------------
const TWO_OVER_PI = 0.6366197723675814;
const PIO2_HI = 1.5707963267341256;
const PIO2_LO = 6.077100506506192e-11;
const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.0875723212981748279e-9;
const C6 = -1.13596475577881948265e-11;

// The quadrant q enters through sin(r + q pi/2) = s cos(q pi/2) + c sin(q pi/2), read from two
// tables, because q is effectively random and branching on it mispredicts.
const QUAD_COS = new Float64Array([1, 0, -1, 0]);
const QUAD_SIN = new Float64Array([0, 1, 0, -1]);

function fsin(x) {
  const n = Math.round(x * TWO_OVER_PI);
  const r = x - n * PIO2_HI - n * PIO2_LO;
  const z = r * r;
  const q = n & 3;
  const s = r + r * z * (S1 + z * (S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)))));
  const c = 1 - 0.5 * z + z * z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  return s * QUAD_COS[q] + c * QUAD_SIN[q];
}

// sin and cos of one argument into SC[0], SC[1]; writing to a typed array instead of returning
// keeps the result unboxed when V8 does not inline the call.
const SC = new Float64Array(2);
function sincos(x) {
  const n = Math.round(x * TWO_OVER_PI);
  const r = x - n * PIO2_HI - n * PIO2_LO;
  const z = r * r;
  const q = n & 3;
  const s = r + r * z * (S1 + z * (S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)))));
  const c = 1 - 0.5 * z + z * z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  const qc = QUAD_COS[q];
  const qs = QUAD_SIN[q];
  SC[0] = s * qc + c * qs;
  SC[1] = c * qc - s * qs;
}

function fcos(x) {
  const n = Math.round(x * TWO_OVER_PI);
  const r = x - n * PIO2_HI - n * PIO2_LO;
  const z = r * r;
  const q = n & 3;
  const s = r + r * z * (S1 + z * (S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)))));
  const c = 1 - 0.5 * z + z * z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  return c * QUAD_COS[q] - s * QUAD_SIN[q];
}

// ---------------------------------------------------------------------------------------------
// Bound scene state (module slots, rewritten only when a renderer binds a different scene).
// ---------------------------------------------------------------------------------------------
let GX0 = -2;
let GX1 = 2;
let GY1 = 2.6;
let GZ0 = -1.6;
let GZ1 = 1.6;
let HOLE_X = 0;
let HOLE_Z = 0;
let HOLE_R = 0;
let HOLE_R2 = 0;
let HOLE_AREA = 0;
let HOLE_INV_AREA = 0;
let POOL_X = 0;
let POOL_Z = 0;
let POOL_R2 = 1;
let POOL_Y0 = -0.7;
let WATER_ON = true;
let WATER_Y = -0.05;
let ETA = 1.33;
let SIG_R = 0;
let SIG_G = 0;
let SIG_B = 0;
let SLAB_LO = 0;
let SLAB_HI = 0;
let WAVE_N = 0;
const WAVE_A = new Float64Array(16);
const WAVE_KX = new Float64Array(16);
const WAVE_KZ = new Float64Array(16);
const WAVE_PH = new Float64Array(16);
let RAD_X = 0;
let RAD_Z = 0;
let RAD_A = 0;
let RAD_K = 0;
let RAD_R2 = 0;
let RAD_INVR2 = 0;
let RAD_G = 0;
let RAD_H = 0;
const ALB = new Float64Array(9);
let EMIT_ON = false;
let EMIT_R = 0;
let EMIT_G = 0;
let EMIT_B = 0;
let SUN_ON = true;
let SUN_X = 0;
let SUN_Y = 1;
let SUN_Z = 0;
let SUN_AX = 1;
let SUN_AY = 0;
let SUN_AZ = 0;
let SUN_BX = 0;
let SUN_BY = 0;
let SUN_BZ = 1;
let SUN_COS = 1;
let SUN_OMC = 0;
let SUN_PDF = 1;
let SUN_R = 0;
let SUN_G = 0;
let SUN_B = 0;
let SKY_ON = true;
let SKY_R = 0;
let SKY_G = 0;
let SKY_B = 0;
let CAM_X = 0;
let CAM_Y = 0;
let CAM_Z = 0;
let CAM_FX = 0;
let CAM_FY = 0;
let CAM_FZ = -1;
let CAM_RX = 1;
let CAM_RY = 0;
let CAM_RZ = 0;
let CAM_UX = 0;
let CAM_UY = 1;
let CAM_UZ = 0;
let CAM_TX = 1;
let CAM_TY = 1;
let IMG_W = 1;
let IMG_H = 1;
let MAX_DEPTH = 12;
let RR_DEPTH = 3;
let STRATEGY = 0;
let FIRST_HIT = 0;
let BOUND = null;

function bindScene(sc, width, height) {
  IMG_W = width;
  IMG_H = height;
  CAM_TY = sc.camera.tanY;
  CAM_TX = (sc.camera.tanY * width) / height;
  if (BOUND === sc) return;
  BOUND = sc;
  [GX0, GX1, GY1, GZ0, GZ1] = sc.grotto;
  [HOLE_X, HOLE_Z, HOLE_R] = sc.hole;
  HOLE_R2 = HOLE_R * HOLE_R;
  HOLE_AREA = Math.PI * HOLE_R2;
  HOLE_INV_AREA = HOLE_R > 0 ? 1 / HOLE_AREA : 0;
  POOL_X = sc.pool[0];
  POOL_Z = sc.pool[1];
  POOL_R2 = sc.pool[2] * sc.pool[2];
  POOL_Y0 = sc.pool[3];
  WATER_ON = sc.water;
  WATER_Y = sc.waterLevel;
  ETA = sc.ior;
  [SIG_R, SIG_G, SIG_B] = sc.sigmaA;
  [SLAB_LO, SLAB_HI] = sc.slab;
  WAVE_N = sc.waves.length;
  for (let i = 0; i < WAVE_N; i++) [WAVE_A[i], WAVE_KX[i], WAVE_KZ[i], WAVE_PH[i]] = sc.waves[i];
  [RAD_X, RAD_Z, RAD_A, RAD_K, RAD_R2, RAD_INVR2, RAD_G, RAD_H] = sc.ripple;
  for (let i = 0; i < 9; i++) ALB[i] = sc.albedo[i];
  [EMIT_R, EMIT_G, EMIT_B] = sc.emission;
  EMIT_ON = EMIT_R > 0 || EMIT_G > 0 || EMIT_B > 0;
  SUN_ON = sc.sunOn;
  SKY_ON = sc.skyOn;
  [SUN_X, SUN_Y, SUN_Z] = sc.sun;
  [SUN_AX, SUN_AY, SUN_AZ] = sc.sunA;
  [SUN_BX, SUN_BY, SUN_BZ] = sc.sunB;
  SUN_COS = sc.sunCos;
  SUN_OMC = sc.sunOneMinusCos;
  SUN_PDF = sc.sunPdf;
  [SUN_R, SUN_G, SUN_B] = sc.sunRadiance;
  [SKY_R, SKY_G, SKY_B] = sc.skyRadiance;
  [CAM_X, CAM_Y, CAM_Z] = sc.camera.position;
  [CAM_FX, CAM_FY, CAM_FZ] = sc.camera.forward;
  [CAM_RX, CAM_RY, CAM_RZ] = sc.camera.right;
  [CAM_UX, CAM_UY, CAM_UZ] = sc.camera.up;
  MAX_DEPTH = sc.maxDepth;
  RR_DEPTH = sc.rrDepth;
  STRATEGY = sc.strategy;
  FIRST_HIT = sc.firstHit;
}

// ---------------------------------------------------------------------------------------------
// Hit record, scratch values and counters live in typed arrays: writing a double into a
// module-level `let` boxes it on the heap, and the garbage it makes shows up in profiles.
// ---------------------------------------------------------------------------------------------
const HIT = new Float64Array(7);
const HT = 0;
const HX = 1;
const HY = 2;
const HZ = 3;
const HNX = 4;
const HNY = 5;
const HNZ = 6;
let H_MAT = 0;
let H_BAND = false;
// Water gradient (x, z), dh/dt along the ray, transmitted cosine.
// Slots 4 and 5 hold the ripple's gradient from the last rayHeightD call.
// Slot 6 holds the height from the last rayHeight / rayHeightD call.
const SCR = new Float64Array(7);
// Rays traced, numerical side failures in the water march.
// Also water-surface evaluations and marches, for profiling.
const CNT = new Float64Array(4);
const RAY_ALPHA = new Float64Array(16);
const RAY_BETA = new Float64Array(16);
const RAY_AB = new Float64Array(16);
const RAY_COS = new Float64Array(16);

// ---------------------------------------------------------------------------------------------
// Water surface: h(x, z) = level + sum of plane waves + one radial ripple, all analytic.
// ---------------------------------------------------------------------------------------------
function waterHeight(x, z) {
  let h = WATER_Y;
  for (let i = 0; i < WAVE_N; i++) h += WAVE_A[i] * fsin(WAVE_KX[i] * x + WAVE_KZ[i] * z + WAVE_PH[i]);
  const rx = x - RAD_X;
  const rz = z - RAD_Z;
  const r2 = rx * rx + rz * rz;
  if (r2 < RAD_R2) {
    const e = 1 - r2 * RAD_INVR2;
    h += RAD_A * fcos(RAD_K * Math.sqrt(r2)) * e * e * e;
  }
  return h;
}

function waterGradient(x, z) {
  let gx = 0;
  let gz = 0;
  for (let i = 0; i < WAVE_N; i++) {
    const c = WAVE_A[i] * fcos(WAVE_KX[i] * x + WAVE_KZ[i] * z + WAVE_PH[i]);
    gx += c * WAVE_KX[i];
    gz += c * WAVE_KZ[i];
  }
  const rx = x - RAD_X;
  const rz = z - RAD_Z;
  const r2 = rx * rx + rz * rz;
  if (r2 < RAD_R2) {
    const r = Math.sqrt(r2);
    const kr = RAD_K * r;
    const e = 1 - r2 * RAD_INVR2;
    const sinc = r > 1e-9 ? fsin(kr) / r : RAD_K;
    const coef = RAD_A * e * e * (-RAD_K * sinc * e - 6 * RAD_INVR2 * fcos(kr));
    gx += coef * rx;
    gz += coef * rz;
  }
  SCR[0] = gx;
  SCR[1] = gz;
}

// Height along the current ray, from the per-ray phases alpha + beta t set up by marchWater.
function rayHeight(ox, oz, dx, dz, t) {
  let h = WATER_Y;
  for (let i = 0; i < WAVE_N; i++) {
    sincos(RAY_ALPHA[i] + RAY_BETA[i] * t);
    h += WAVE_A[i] * SC[0];
  }
  const rx = ox + t * dx - RAD_X;
  const rz = oz + t * dz - RAD_Z;
  const r2 = rx * rx + rz * rz;
  if (r2 < RAD_R2) {
    const e = 1 - r2 * RAD_INVR2;
    sincos(RAD_K * Math.sqrt(r2));
    h += RAD_A * SC[1] * e * e * e;
  }
  SCR[6] = h;
}

// Same, and dh/dt into SCR[2]; each wave's sin and cos share one argument reduction. The cosines
// and the ripple's gradient are kept so a hit at this t can build its normal without re-evaluation.
function rayHeightD(ox, oz, dx, dz, t) {
  CNT[2]++;
  let h = WATER_Y;
  let dh = 0;
  for (let i = 0; i < WAVE_N; i++) {
    const x = RAY_ALPHA[i] + RAY_BETA[i] * t;
    const n = Math.round(x * TWO_OVER_PI);
    const r = x - n * PIO2_HI - n * PIO2_LO;
    const z = r * r;
    const s = r + r * z * (S1 + z * (S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)))));
    const c = 1 - 0.5 * z + z * z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
    const q = n & 3;
    const qc = QUAD_COS[q];
    const qs = QUAD_SIN[q];
    const sn = s * qc + c * qs;
    const cs = c * qc - s * qs;
    h += WAVE_A[i] * sn;
    dh += RAY_AB[i] * cs;
    RAY_COS[i] = cs;
  }
  const rx = ox + t * dx - RAD_X;
  const rz = oz + t * dz - RAD_Z;
  const r2 = rx * rx + rz * rz;
  if (r2 < RAD_R2) {
    const r = Math.sqrt(r2);
    const kr = RAD_K * r;
    const e = 1 - r2 * RAD_INVR2;
    sincos(kr);
    const ck = SC[1];
    h += RAD_A * ck * e * e * e;
    const sinc = r > 1e-9 ? SC[0] / r : RAD_K;
    const coef = RAD_A * e * e * (-RAD_K * sinc * e - 6 * RAD_INVR2 * ck);
    dh += coef * (rx * dx + rz * dz);
    SCR[4] = coef * rx;
    SCR[5] = coef * rz;
  } else {
    SCR[4] = 0;
    SCR[5] = 0;
  }
  SCR[2] = dh;
  SCR[6] = h;
}

// Hit at the t of the last rayHeightD call, reusing its cosines for the gradient.
function setWaterHitLast(ox, oy, oz, dx, dy, dz, t) {
  let gx = SCR[4];
  let gz = SCR[5];
  for (let i = 0; i < WAVE_N; i++) {
    const c = WAVE_A[i] * RAY_COS[i];
    gx += c * WAVE_KX[i];
    gz += c * WAVE_KZ[i];
  }
  HIT[HT] = t;
  HIT[HX] = ox + t * dx;
  HIT[HY] = oy + t * dy;
  HIT[HZ] = oz + t * dz;
  const il = 1 / Math.sqrt(1 + gx * gx + gz * gz);
  HIT[HNX] = -gx * il;
  HIT[HNY] = il;
  HIT[HNZ] = -gz * il;
  H_MAT = M_WATER;
  H_BAND = false;
}

function setWaterHit(ox, oy, oz, dx, dy, dz, t) {
  const x = ox + t * dx;
  const z = oz + t * dz;
  HIT[HT] = t;
  HIT[HX] = x;
  HIT[HY] = oy + t * dy;
  HIT[HZ] = z;
  waterGradient(x, z);
  const gx = SCR[0];
  const gz = SCR[1];
  const il = 1 / Math.sqrt(1 + gx * gx + gz * gz);
  HIT[HNX] = -gx * il;
  HIT[HNY] = il;
  HIT[HNZ] = -gz * il;
  H_MAT = M_WATER;
  H_BAND = false;
}

// First crossing of the water surface on [ta, tb]. sign = +1 for a ray in air (where y - h > 0),
// -1 for a ray in water. Returns K_WATER with the hit set, 0 for no crossing, or K_NONE if the
// ray starts on the wrong side (a numerical failure, counted in CNT[1]). taSlab / tbSlab say an
// end lies on a slab plane, where the sign of y - h is known without evaluating it.
function marchWater(ox, oy, oz, dx, dy, dz, ta, tb, sign, taSlab, tbSlab) {
  CNT[3]++;
  let slope = 0;
  let curvature = 0;
  for (let i = 0; i < WAVE_N; i++) {
    const b = WAVE_KX[i] * dx + WAVE_KZ[i] * dz;
    RAY_ALPHA[i] = WAVE_KX[i] * ox + WAVE_KZ[i] * oz + WAVE_PH[i];
    RAY_BETA[i] = b;
    RAY_AB[i] = WAVE_A[i] * b;
    const ab = WAVE_A[i] * (b < 0 ? -b : b);
    slope += ab;
    curvature += ab * (b < 0 ? -b : b);
  }
  const hd2 = dx * dx + dz * dz;
  slope += RAD_G * Math.sqrt(hd2);
  curvature += RAD_H * hd2;
  const ady = dy < 0 ? -dy : dy;
  if (ady > 2 * slope + 1e-15) {
    // y - h is strictly monotone along this ray with |F'| >= |dy| / 2: at most one crossing, found
    // by safeguarded Newton iteration from where the ray meets the mean water plane. Rays closer to
    // the monotonicity limit have a tiny Newton basin and go to the certified march instead.
    // fa, fb: values at the bracket ends once known (NaN until then).
    let fa = NaN;
    let fb = NaN;
    if (!taSlab) {
      rayHeight(ox, oz, dx, dz, ta);
      fa = sign * (oy + ta * dy - SCR[6]);
      if (!(fa > 0)) {
        CNT[1]++;
        return K_NONE;
      }
    }
    // F' has the sign of sign * dy here. A ray moving away from the surface (one just refracted
    // down into the water, or reflected up from it) starts inside the slab and cannot cross back;
    // only for rays moving toward the surface is the far slab plane on the other side.
    if (sign * dy > 0) return 0;
    if (!tbSlab) {
      rayHeight(ox, oz, dx, dz, tb);
      fb = sign * (oy + tb * dy - SCR[6]);
      if (fb > 0) return 0;
    }
    let a = ta;
    let b = tb;
    let t = (WATER_Y - oy) / dy;
    if (!(t > a && t < b)) t = 0.5 * (a + b);
    for (let it = 0; it < 60; it++) {
      rayHeightD(ox, oz, dx, dz, t);
      const f = sign * (oy + t * dy - SCR[6]);
      if ((f < 1e-9 && f > -1e-9) || b - a < 1e-9) {
        setWaterHitLast(ox, oy, oz, dx, dy, dz, t);
        return K_WATER;
      }
      if (f > 0) {
        a = t;
        fa = f;
      } else {
        b = t;
        fb = f;
      }
      let tn = t - f / (sign * (dy - SCR[2]));
      // Near the monotonicity limit the slope can be small and Newton overshoots; fall back to
      // regula falsi once both ends are known, else to bisection.
      if (!(tn > a && tn < b)) {
        tn = fa === fa && fb === fb ? (a * fb - b * fa) / (fb - fa) : 0.5 * (a + b);
        if (!(tn > a && tn < b)) tn = 0.5 * (a + b);
      }
      t = tn;
    }
    setWaterHit(ox, oy, oz, dx, dy, dz, t);
    return K_WATER;
  }
  // Certified march. With |F''| <= curvature, F(t + s) >= F + F' s - curvature s^2 / 2, so
  // stepping to the first zero of that parabola never skips a crossing. Near a transversal
  // crossing the step tends to the Newton step and converges quadratically.
  if (curvature < 1e-12) curvature = 1e-12;
  let t = ta;
  for (let it = 0; it < 400; it++) {
    rayHeightD(ox, oz, dx, dz, t);
    const f = sign * (oy + t * dy - SCR[6]);
    if (f < 1e-9) {
      if (it === 0 && f < -1e-9) {
        CNT[1]++;
        return K_NONE;
      }
      setWaterHitLast(ox, oy, oz, dx, dy, dz, t);
      return K_WATER;
    }
    const fp = sign * (dy - SCR[2]);
    t += (fp + Math.sqrt(fp * fp + 2 * curvature * f)) / curvature;
    if (t >= tb) return 0;
  }
  setWaterHit(ox, oy, oz, dx, dy, dz, t);
  return K_WATER;
}

// Ray inside the pool cylinder, or entering it through the floor opening at tStart.
function intersectPool(ox, oy, oz, dx, dy, dz, tStart, sign) {
  const px = ox - POOL_X;
  const pz = oz - POOL_Z;
  const a = dx * dx + dz * dz;
  let tEnd = Infinity;
  let end = 0;
  if (a > 1e-18) {
    const b = px * dx + pz * dz;
    const c = px * px + pz * pz - POOL_R2;
    const disc = b * b - a * c;
    tEnd = disc > 0 ? (-b + Math.sqrt(disc)) / a : tStart;
    if (tEnd < tStart) tEnd = tStart;
  }
  if (dy < 0) {
    const t = (POOL_Y0 - oy) / dy;
    if (t < tEnd) {
      tEnd = t;
      end = 1;
    }
  } else if (dy > 0) {
    const t = -oy / dy;
    if (t < tEnd) {
      tEnd = t;
      end = 2;
    }
  }
  let ta;
  let tb;
  let taSlab = true;
  let tbSlab = true;
  if (dy !== 0) {
    const t1 = (SLAB_LO - oy) / dy;
    const t2 = (SLAB_HI - oy) / dy;
    ta = t1 < t2 ? t1 : t2;
    tb = t1 < t2 ? t2 : t1;
  } else if (oy > SLAB_LO && oy < SLAB_HI) {
    ta = tStart;
    tb = tEnd;
    taSlab = false;
    tbSlab = false;
  } else {
    ta = 1;
    tb = 0;
  }
  if (ta < tStart) {
    ta = tStart;
    taSlab = false;
  }
  if (tb > tEnd) {
    tb = tEnd;
    tbSlab = false;
  }
  if (WATER_ON && ta < tb) {
    const k = marchWater(ox, oy, oz, dx, dy, dz, ta, tb, sign, taSlab, tbSlab);
    if (k !== 0) return k;
  }
  const hx = ox + tEnd * dx;
  const hz = oz + tEnd * dz;
  HIT[HT] = tEnd;
  HIT[HX] = hx;
  HIT[HY] = oy + tEnd * dy;
  HIT[HZ] = hz;
  if (end === 2) return K_POOL_EXIT;
  H_MAT = M_TILE;
  if (end === 1) {
    HIT[HY] = POOL_Y0;
    HIT[HNX] = 0;
    HIT[HNY] = 1;
    HIT[HNZ] = 0;
    H_BAND = false;
    return K_DIFFUSE;
  }
  const qx = hx - POOL_X;
  const qz = hz - POOL_Z;
  const il = 1 / Math.sqrt(qx * qx + qz * qz);
  HIT[HNX] = -qx * il;
  HIT[HNY] = 0;
  HIT[HNZ] = -qz * il;
  const hy = HIT[HY];
  H_BAND = hy > SLAB_LO && hy < SLAB_HI;
  return K_DIFFUSE;
}

function intersectGrotto(ox, oy, oz, dx, dy, dz) {
  let t = Infinity;
  let face = 0;
  if (dx > 0) {
    t = (GX1 - ox) / dx;
    face = 1;
  } else if (dx < 0) {
    t = (GX0 - ox) / dx;
    face = 2;
  }
  if (dy > 0) {
    const u = (GY1 - oy) / dy;
    if (u < t) {
      t = u;
      face = 3;
    }
  } else if (dy < 0) {
    const u = -oy / dy;
    if (u < t) {
      t = u;
      face = 4;
    }
  }
  if (dz > 0) {
    const u = (GZ1 - oz) / dz;
    if (u < t) {
      t = u;
      face = 5;
    }
  } else if (dz < 0) {
    const u = (GZ0 - oz) / dz;
    if (u < t) {
      t = u;
      face = 6;
    }
  }
  const hx = ox + t * dx;
  const hy = oy + t * dy;
  const hz = oz + t * dz;
  if (face === 4) {
    const qx = hx - POOL_X;
    const qz = hz - POOL_Z;
    if (qx * qx + qz * qz < POOL_R2) return intersectPool(ox, oy, oz, dx, dy, dz, t, 1);
  }
  HIT[HT] = t;
  HIT[HX] = hx;
  HIT[HY] = hy;
  HIT[HZ] = hz;
  HIT[HNX] = 0;
  HIT[HNY] = 0;
  HIT[HNZ] = 0;
  H_BAND = false;
  H_MAT = M_LIMESTONE;
  if (face === 3) {
    HIT[HY] = GY1;
    const qx = hx - HOLE_X;
    const qz = hz - HOLE_Z;
    if (qx * qx + qz * qz < HOLE_R2) return K_ESCAPE;
    HIT[HNY] = -1;
  } else if (face === 4) {
    HIT[HY] = 0;
    HIT[HNY] = 1;
    H_MAT = M_SLATE;
  } else if (face === 1) {
    HIT[HX] = GX1;
    HIT[HNX] = -1;
  } else if (face === 2) {
    HIT[HX] = GX0;
    HIT[HNX] = 1;
  } else if (face === 5) {
    HIT[HZ] = GZ1;
    HIT[HNZ] = -1;
  } else if (face === 6) {
    HIT[HZ] = GZ0;
    HIT[HNZ] = 1;
  } else {
    return K_NONE;
  }
  return K_DIFFUSE;
}

// Nearest surface along a ray. inWater says which side of the water surface the ray starts on.
function intersect(ox, oy, oz, dx, dy, dz, inWater) {
  CNT[0]++;
  if (oy < 0) {
    const k = intersectPool(ox, oy, oz, dx, dy, dz, 0, inWater ? -1 : 1);
    if (k !== K_POOL_EXIT) return k;
    const t0 = HIT[HT];
    const k2 = intersectGrotto(ox + t0 * dx, 0, oz + t0 * dz, dx, dy, dz);
    HIT[HT] += t0;
    return k2;
  }
  return intersectGrotto(ox, oy, oz, dx, dy, dz);
}

// Unpolarized Fresnel reflectance of a smooth dielectric. eta = n_incident / n_transmitted.
// Leaves the transmitted cosine in SCR[3] (0 under total internal reflection).
function fresnelDielectric(cosI, eta) {
  const sin2T = eta * eta * (1 - cosI * cosI);
  if (sin2T >= 1) {
    SCR[3] = 0;
    return 1;
  }
  const cosT = Math.sqrt(1 - sin2T);
  SCR[3] = cosT;
  const rs = (eta * cosI - cosT) / (eta * cosI + cosT);
  const rp = (cosI - eta * cosT) / (cosI + eta * cosT);
  return 0.5 * (rs * rs + rp * rp);
}

// ---------------------------------------------------------------------------------------------
// The path sampler shared by both estimators. Every random decision reads a fixed coordinate of
// the sampler: s.get(i) returns a number in [0, 1). The result is the path's total contribution
// OUT to pixel OUT_PIX; all NEE and BSDF terms of one camera path land on the same pixel, which
// is what lets PSSMLT use the luminance of their sum as its target. OUT[3] is the luminance of the
// part that came from the sky (used by the optional ratio normalization of PSSMLT).
// ---------------------------------------------------------------------------------------------
const OUT = new Float64Array(4);
let OUT_PIX = 0;
let PATH_N = 0;
const PATH_BUF = new Float64Array(3 * (MAX_RECORDED_VERTICES + 2));

function tracePath(s) {
  const u0 = s.get(0);
  const u1 = s.get(1);
  let ix = Math.floor(u0 * IMG_W);
  let iy = Math.floor(u1 * IMG_H);
  if (ix >= IMG_W) ix = IMG_W - 1;
  if (iy >= IMG_H) iy = IMG_H - 1;
  OUT_PIX = iy * IMG_W + ix;
  const sx = (2 * u0 - 1) * CAM_TX;
  const sy = (1 - 2 * u1) * CAM_TY;
  let dx = CAM_FX + sx * CAM_RX + sy * CAM_UX;
  let dy = CAM_FY + sx * CAM_RY + sy * CAM_UY;
  let dz = CAM_FZ + sx * CAM_RZ + sy * CAM_UZ;
  let inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
  dx *= inv;
  dy *= inv;
  dz *= inv;
  let ox = CAM_X;
  let oy = CAM_Y;
  let oz = CAM_Z;
  let tr = 1;
  let tg = 1;
  let tb = 1;
  let lr = 0;
  let lg = 0;
  let lb = 0;
  let skyLum = 0;
  let inWater = false;
  let prevDiffuseAir = false;
  let prevPdf = 0;
  PATH_BUF[0] = ox;
  PATH_BUF[1] = oy;
  PATH_BUF[2] = oz;
  let pn = 1;
  for (let depth = 0; ; depth++) {
    const kind = intersect(ox, oy, oz, dx, dy, dz, inWater);
    if (depth === 0 && FIRST_HIT !== 0 && (FIRST_HIT === 1) === (kind === K_DIFFUSE)) break;
    if (kind === K_ESCAPE) {
      let wSky = 1;
      let wSun = 1;
      if (prevDiffuseAir) {
        if (STRATEGY === 1) {
          wSky = 0;
          wSun = 0;
        } else if (STRATEGY === 0) {
          const pb2 = prevPdf * prevPdf;
          const t = HIT[HT];
          const pSky = (t * t * HOLE_INV_AREA) / dy;
          wSky = pb2 / (pb2 + pSky * pSky);
          wSun = pb2 / (pb2 + SUN_PDF * SUN_PDF);
        }
      }
      if (SKY_ON) {
        lr += tr * SKY_R * wSky;
        lg += tg * SKY_G * wSky;
        lb += tb * SKY_B * wSky;
        skyLum += (0.2126 * tr * SKY_R + 0.7152 * tg * SKY_G + 0.0722 * tb * SKY_B) * wSky;
      }
      if (SUN_ON && dx * SUN_X + dy * SUN_Y + dz * SUN_Z >= SUN_COS) {
        lr += tr * SUN_R * wSun;
        lg += tg * SUN_G * wSun;
        lb += tb * SUN_B * wSun;
      }
      if (pn < MAX_RECORDED_VERTICES) {
        PATH_BUF[3 * pn] = HIT[HX];
        PATH_BUF[3 * pn + 1] = HIT[HY];
        PATH_BUF[3 * pn + 2] = HIT[HZ];
        PATH_BUF[3 * pn + 3] = HIT[HX] + dx;
        PATH_BUF[3 * pn + 4] = HIT[HY] + dy;
        PATH_BUF[3 * pn + 5] = HIT[HZ] + dz;
        pn += 2;
      }
      break;
    }
    if (kind === K_NONE) break;
    const px = HIT[HX];
    const py = HIT[HY];
    const pz = HIT[HZ];
    if (pn < MAX_RECORDED_VERTICES) {
      PATH_BUF[3 * pn] = px;
      PATH_BUF[3 * pn + 1] = py;
      PATH_BUF[3 * pn + 2] = pz;
      pn++;
    }
    if (inWater) {
      const t = HIT[HT];
      tr *= Math.exp(-SIG_R * t);
      tg *= Math.exp(-SIG_G * t);
      tb *= Math.exp(-SIG_B * t);
    }
    if (EMIT_ON && kind === K_DIFFUSE) {
      lr += tr * EMIT_R;
      lg += tg * EMIT_G;
      lb += tb * EMIT_B;
    }
    // The last vertex scatters nowhere; stopping before NEE keeps each NEE/BSDF MIS pair whole.
    if (depth >= MAX_DEPTH - 1) break;
    const base = CAMERA_DIMS + depth * VERTEX_DIMS;
    let nx = HIT[HNX];
    let ny = HIT[HNY];
    let nz = HIT[HNZ];
    if (kind === K_WATER) {
      if (inWater) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      let cosI = -(dx * nx + dy * ny + dz * nz);
      if (cosI < 1e-6) cosI = 1e-6;
      const eta = inWater ? ETA : 1 / ETA;
      const fr = fresnelDielectric(cosI, eta);
      // Choosing reflection with probability F cancels the Fresnel weight. The radiance factor
      // eta^2 at each crossing is omitted: camera and lights are both in air, so every complete
      // path crosses in and out equally often and the factors multiply to one.
      if (s.get(base + 4) < fr) {
        const k = 2 * cosI;
        dx += k * nx;
        dy += k * ny;
        dz += k * nz;
        ox = px + SPAWN_EPS * nx;
        oy = py + SPAWN_EPS * ny;
        oz = pz + SPAWN_EPS * nz;
      } else {
        const k = eta * cosI - SCR[3];
        dx = eta * dx + k * nx;
        dy = eta * dy + k * ny;
        dz = eta * dz + k * nz;
        ox = px - SPAWN_EPS * nx;
        oy = py - SPAWN_EPS * ny;
        oz = pz - SPAWN_EPS * nz;
        inWater = !inWater;
      }
      inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx *= inv;
      dy *= inv;
      dz *= inv;
      prevDiffuseAir = false;
    } else {
      const m = H_MAT * 3;
      const ar = ALB[m];
      const ag = ALB[m + 1];
      const ab = ALB[m + 2];
      const bx = px + SPAWN_EPS * nx;
      // Pool-wall points near the waterline also step vertically toward their own medium, so the
      // horizontal offset can never carry a point across the contact line.
      const by = py + SPAWN_EPS * ny + (H_BAND ? (inWater ? -4 * SPAWN_EPS : 4 * SPAWN_EPS) : 0);
      const bz = pz + SPAWN_EPS * nz;
      // NEE is impossible below the water: any connection to the sun or sky crosses the surface.
      if (!inWater && STRATEGY !== 2) {
        if (SUN_ON) {
          const ua = s.get(base);
          const ub = s.get(base + 1);
          const ct = 1 - ua * SUN_OMC;
          const st = Math.sqrt(Math.max(0, (1 - ct) * (1 + ct)));
          const phi = TWO_PI * ub;
          sincos(phi);
          const cp = SC[1] * st;
          const sp = SC[0] * st;
          const wx = ct * SUN_X + cp * SUN_AX + sp * SUN_BX;
          const wy = ct * SUN_Y + cp * SUN_AY + sp * SUN_BY;
          const wz = ct * SUN_Z + cp * SUN_AZ + sp * SUN_BZ;
          const cosP = wx * nx + wy * ny + wz * nz;
          if (cosP > 0 && wy > 0 && intersect(bx, by, bz, wx, wy, wz, false) === K_ESCAPE) {
            let w = (cosP * INV_PI) / SUN_PDF;
            if (STRATEGY === 0) {
              const pb = cosP * INV_PI;
              w *= (SUN_PDF * SUN_PDF) / (SUN_PDF * SUN_PDF + pb * pb);
            }
            lr += tr * ar * SUN_R * w;
            lg += tg * ag * SUN_G * w;
            lb += tb * ab * SUN_B * w;
          }
        }
        if (SKY_ON) {
          const uc = s.get(base + 2);
          const ud = s.get(base + 3);
          const rr = HOLE_R * Math.sqrt(uc);
          const phi = TWO_PI * ud;
          sincos(phi);
          let wx = HOLE_X + rr * SC[1] - bx;
          let wy = GY1 - by;
          let wz = HOLE_Z + rr * SC[0] - bz;
          const d2 = wx * wx + wy * wy + wz * wz;
          const il = 1 / Math.sqrt(d2);
          wx *= il;
          wy *= il;
          wz *= il;
          const cosP = wx * nx + wy * ny + wz * nz;
          if (cosP > 0 && wy > 0 && intersect(bx, by, bz, wx, wy, wz, false) === K_ESCAPE) {
            const pdf = (d2 * HOLE_INV_AREA) / wy;
            let w = (cosP * INV_PI) / pdf;
            if (STRATEGY === 0) {
              const pb = cosP * INV_PI;
              w *= (pdf * pdf) / (pdf * pdf + pb * pb);
            }
            lr += tr * ar * SKY_R * w;
            lg += tg * ag * SKY_G * w;
            lb += tb * ab * SKY_B * w;
            skyLum += (0.2126 * tr * ar * SKY_R + 0.7152 * tg * ag * SKY_G + 0.0722 * tb * ab * SKY_B) * w;
          }
        }
      }
      // Cosine-weighted direction in the frame of n (Duff et al. 2017 basis).
      const ue = s.get(base + 4);
      const uf = s.get(base + 5);
      const rad = Math.sqrt(ue);
      const phi = TWO_PI * uf;
      sincos(phi);
      const lx = rad * SC[1];
      const ly = rad * SC[0];
      const lz = Math.sqrt(Math.max(0, 1 - ue));
      const sg = nz >= 0 ? 1 : -1;
      const qa = -1 / (sg + nz);
      const qb = nx * ny * qa;
      dx = lx * (1 + sg * nx * nx * qa) + ly * qb + lz * nx;
      dy = lx * (sg * qb) + ly * (sg + ny * ny * qa) + lz * ny;
      dz = lx * (-sg * nx) - ly * ny + lz * nz;
      inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx *= inv;
      dy *= inv;
      dz *= inv;
      prevPdf = lz * INV_PI;
      prevDiffuseAir = !inWater;
      tr *= ar;
      tg *= ag;
      tb *= ab;
      ox = bx;
      oy = by;
      oz = bz;
    }
    if (depth + 1 >= RR_DEPTH) {
      const mx = tr > tg ? (tr > tb ? tr : tb) : tg > tb ? tg : tb;
      const q = mx < 0.95 ? mx : 0.95;
      if (s.get(base + 6) >= q) break;
      const iq = 1 / q;
      tr *= iq;
      tg *= iq;
      tb *= iq;
    }
  }
  OUT[0] = lr;
  OUT[1] = lg;
  OUT[2] = lb;
  OUT[3] = skyLum;
  PATH_N = pn;
}

// ---------------------------------------------------------------------------------------------
// Light tracing (reference only): particles leave the light well as sunlight or skylight, and
// every diffuse vertex in air connects to the pinhole. That covers exactly the paths whose
// camera ray first meets a diffuse surface in air, including the L-S-D-E reflected caustics
// that the camera-side sampler almost never finds.
// ---------------------------------------------------------------------------------------------
function traceParticle(s, sum, pSun) {
  const rr0 = HOLE_R * Math.sqrt(s.rand());
  const phi0 = TWO_PI * s.rand();
  sincos(phi0);
  let ox = HOLE_X + rr0 * SC[1];
  let oy = GY1 - SPAWN_EPS;
  let oz = HOLE_Z + rr0 * SC[0];
  let dx;
  let dy;
  let dz;
  let br;
  let bg;
  let bb;
  if (s.rand() < pSun) {
    const ct = 1 - s.rand() * SUN_OMC;
    const st = Math.sqrt(Math.max(0, (1 - ct) * (1 + ct)));
    const phi = TWO_PI * s.rand();
    sincos(phi);
    const cp = SC[1] * st;
    const sp = SC[0] * st;
    dx = -(ct * SUN_X + cp * SUN_AX + sp * SUN_BX);
    dy = -(ct * SUN_Y + cp * SUN_AY + sp * SUN_BY);
    dz = -(ct * SUN_Z + cp * SUN_AZ + sp * SUN_BZ);
    if (dy >= 0) return;
    const w = (-dy * HOLE_AREA) / (SUN_PDF * pSun);
    br = SUN_R * w;
    bg = SUN_G * w;
    bb = SUN_B * w;
  } else {
    const u = s.rand();
    const rad = Math.sqrt(u);
    const phi = TWO_PI * s.rand();
    sincos(phi);
    dx = rad * SC[1];
    dz = rad * SC[0];
    dy = -Math.sqrt(Math.max(1e-12, 1 - u));
    const w = (Math.PI * HOLE_AREA) / (1 - pSun);
    br = SKY_R * w;
    bg = SKY_G * w;
    bb = SKY_B * w;
  }
  let tr = 1;
  let tg = 1;
  let tb = 1;
  let inWater = false;
  const scale = (IMG_W * IMG_H) / (4 * CAM_TX * CAM_TY);
  // Same truncation as tracePath: at most MAX_DEPTH - 1 scattering vertices.
  for (let depth = 0; depth < MAX_DEPTH - 1; depth++) {
    const kind = intersect(ox, oy, oz, dx, dy, dz, inWater);
    if (kind === K_ESCAPE || kind === K_NONE) return;
    const px = HIT[HX];
    const py = HIT[HY];
    const pz = HIT[HZ];
    if (inWater) {
      const t = HIT[HT];
      tr *= Math.exp(-SIG_R * t);
      tg *= Math.exp(-SIG_G * t);
      tb *= Math.exp(-SIG_B * t);
    }
    let nx = HIT[HNX];
    let ny = HIT[HNY];
    let nz = HIT[HNZ];
    if (kind === K_WATER) {
      if (inWater) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      let cosI = -(dx * nx + dy * ny + dz * nz);
      if (cosI < 1e-6) cosI = 1e-6;
      const eta = inWater ? ETA : 1 / ETA;
      const fr = fresnelDielectric(cosI, eta);
      if (s.rand() < fr) {
        const k = 2 * cosI;
        dx += k * nx;
        dy += k * ny;
        dz += k * nz;
        ox = px + SPAWN_EPS * nx;
        oy = py + SPAWN_EPS * ny;
        oz = pz + SPAWN_EPS * nz;
      } else {
        const k = eta * cosI - SCR[3];
        dx = eta * dx + k * nx;
        dy = eta * dy + k * ny;
        dz = eta * dz + k * nz;
        ox = px - SPAWN_EPS * nx;
        oy = py - SPAWN_EPS * ny;
        oz = pz - SPAWN_EPS * nz;
        inWater = !inWater;
      }
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx *= inv;
      dy *= inv;
      dz *= inv;
    } else {
      const m = H_MAT * 3;
      const ar = ALB[m];
      const ag = ALB[m + 1];
      const ab = ALB[m + 2];
      const bx = px + SPAWN_EPS * nx;
      const by = py + SPAWN_EPS * ny + (H_BAND ? (inWater ? -4 * SPAWN_EPS : 4 * SPAWN_EPS) : 0);
      const bz = pz + SPAWN_EPS * nz;
      if (!inWater) {
        let vx = CAM_X - bx;
        let vy = CAM_Y - by;
        let vz = CAM_Z - bz;
        const d2 = vx * vx + vy * vy + vz * vz;
        const dist = Math.sqrt(d2);
        vx /= dist;
        vy /= dist;
        vz /= dist;
        const cosV = vx * nx + vy * ny + vz * nz;
        // The camera looks along -v; its axis cosine and image-plane position.
        const cosC = -(vx * CAM_FX + vy * CAM_FY + vz * CAM_FZ);
        if (cosV > 0 && cosC > 1e-6) {
          const sx = -(vx * CAM_RX + vy * CAM_RY + vz * CAM_RZ) / cosC;
          const sy = -(vx * CAM_UX + vy * CAM_UY + vz * CAM_UZ) / cosC;
          const fx = (sx / CAM_TX + 1) * 0.5 * IMG_W;
          const fy = (1 - sy / CAM_TY) * 0.5 * IMG_H;
          if (fx >= 0 && fx < IMG_W && fy >= 0 && fy < IMG_H) {
            const kind2 = intersect(bx, by, bz, vx, vy, vz, false);
            if (kind2 === K_NONE || HIT[HT] >= dist - 1e-7) {
              // Pixel measurement: radiance averaged over the pixel's image-plane area. The image
              // area that a surface element covers is cosV dA / (dist^2 cosC^3).
              const w = (INV_PI * cosV * scale) / (d2 * cosC * cosC * cosC);
              const j = 3 * ((fy | 0) * IMG_W + (fx | 0));
              sum[j] += br * tr * ar * w;
              sum[j + 1] += bg * tg * ag * w;
              sum[j + 2] += bb * tb * ab * w;
            }
          }
        }
      }
      const ue = s.rand();
      const rad = Math.sqrt(ue);
      const phi = TWO_PI * s.rand();
      sincos(phi);
      const lx = rad * SC[1];
      const ly = rad * SC[0];
      const lz = Math.sqrt(Math.max(0, 1 - ue));
      const sg = nz >= 0 ? 1 : -1;
      const qa = -1 / (sg + nz);
      const qb = nx * ny * qa;
      dx = lx * (1 + sg * nx * nx * qa) + ly * qb + lz * nx;
      dy = lx * (sg * qb) + ly * (sg + ny * ny * qa) + lz * ny;
      dz = lx * (-sg * nx) - ly * ny + lz * nz;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx *= inv;
      dy *= inv;
      dz *= inv;
      tr *= ar;
      tg *= ag;
      tb *= ab;
      ox = bx;
      oy = by;
      oz = bz;
    }
    if (depth + 1 >= RR_DEPTH) {
      const mx = tr > tg ? (tr > tb ? tr : tb) : tg > tb ? tg : tb;
      const q = mx < 0.95 ? mx : 0.95;
      if (s.rand() >= q) return;
      const iq = 1 / q;
      tr *= iq;
      tg *= iq;
      tb *= iq;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Random numbers: xoshiro128** with its state in an Int32Array, seeded through an integer hash.
// ---------------------------------------------------------------------------------------------
export function hash32(x) {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

function seedState(st, seed, stream) {
  let h = hash32((seed >>> 0) ^ hash32((stream >>> 0) ^ 0x9e3779b9));
  st[0] = h;
  h = hash32(h ^ 0x6a09e667);
  st[1] = h;
  h = hash32(h ^ 0xbb67ae85);
  st[2] = h;
  h = hash32(h ^ 0x3c6ef372);
  st[3] = h;
  if ((st[0] | st[1] | st[2] | st[3]) === 0) st[0] = 1;
}

export class Rng {
  constructor(seed = 1, stream = 0) {
    this.st = new Int32Array(4);
    seedState(this.st, seed, stream);
  }

  rand() {
    const st = this.st;
    const s0 = st[0];
    const s1 = st[1];
    const s2 = st[2] ^ s0;
    const s3 = st[3] ^ s1;
    const m = Math.imul(s1, 5);
    const r = Math.imul((m << 7) | (m >>> 25), 9);
    st[0] = s0 ^ s3;
    st[1] = s1 ^ s2;
    st[2] = s2 ^ (s1 << 9);
    st[3] = (s3 << 11) | (s3 >>> 21);
    return (r >>> 0) * 2.3283064365386963e-10;
  }
}

// Independent sampler for path tracing; coordinates 0 and 1 are jittered inside pixel (px, py).
class IndependentSampler extends Rng {
  constructor(seed, stream) {
    super(seed, stream);
    this.px = 0;
    this.py = 0;
    this.iw = 1;
    this.ih = 1;
  }

  get(i) {
    const r = this.rand();
    if (i === 0) return (this.px + r) * this.iw;
    if (i === 1) return (this.py + r) * this.ih;
    return r;
  }
}

const KELEMEN_S1 = 1 / 1024;
const KELEMEN_S2 = 1 / 64;
const KELEMEN_LOG_RATIO = Math.log(KELEMEN_S2 / KELEMEN_S1);
// s2 * exp(-log(s2/s1) v) for v in [0, 1], interpolated linearly over 256 segments (relative error
// about 2e-5). Any deterministic magnitude keeps the +/- kernel symmetric; this one is cheaper.
const KELEMEN_TABLE = new Float64Array(258);
for (let j = 0; j < 258; j++) KELEMEN_TABLE[j] = KELEMEN_S2 * Math.exp((-KELEMEN_LOG_RATIO * j) / 256);

// Primary-sample-space state, evaluated lazily (Kelemen et al. 2002; bookkeeping after PBRT-v3's
// MLTSampler): a coordinate is drawn or mutated only when the path sampler reads it. mod[i] is
// the iteration that last changed X[i]; -1 means never drawn.
class PrimarySampleSampler extends Rng {
  constructor(maxDims) {
    super(1, 0);
    this.n = maxDims;
    this.X = new Float64Array(maxDims);
    this.mod = new Int32Array(maxDims).fill(-1);
    this.backupX = new Float64Array(maxDims);
    this.backupMod = new Int32Array(maxDims);
    this.touched = new Int32Array(maxDims);
    this.nTouched = 0;
    this.iter = 0;
    this.lastLarge = 0;
    this.large = true;
  }

  // Iteration 0 is a large step drawn from (seed, stream): the bootstrap and a chain seeded the
  // same way reproduce the same path.
  reset(seed, stream) {
    seedState(this.st, seed, stream);
    this.mod.fill(-1);
    this.nTouched = 0;
    this.iter = 0;
    this.lastLarge = 0;
    this.large = true;
  }

  reseed(seed, stream) {
    seedState(this.st, seed, stream);
  }

  start(pLarge) {
    this.iter++;
    this.large = this.rand() < pLarge;
    this.nTouched = 0;
  }

  get(i) {
    const mod = this.mod;
    const m = mod[i];
    const it = this.iter;
    if (m === it) return this.X[i];
    const X = this.X;
    this.backupX[i] = X[i];
    this.backupMod[i] = m;
    this.touched[this.nTouched++] = i;
    let x;
    // Rejections roll the iteration back, so a coordinate the current state's path read is always
    // exactly one iteration behind: it gets Kelemen's small step. Any other coordinate (never drawn,
    // reset by an accepted large step, or simply not read by the current path) does not affect the
    // target, whose conditional for it is therefore uniform; redrawing it is a Gibbs update. This
    // replaces the lazy replay of every missed small step: the replay is valid too, but its stale
    // values carry memory of old paths into path extensions, and in this scene that left a
    // few-percent bias between the walls and the pool after 8e4 mutations per chain (the fresh draw
    // matched path tracing within noise in the same test).
    if (this.large || it - m !== 1) {
      x = this.rand();
    } else {
      x = X[i];
      const u = this.rand();
      // s2 * exp(-log(s2/s1) v), v uniform, with a random sign (Kelemen et al. 2002).
      const v = u < 0.5 ? 512 * u : 512 * u - 256;
      const j = v | 0;
      const step = KELEMEN_TABLE[j] + (KELEMEN_TABLE[j + 1] - KELEMEN_TABLE[j]) * (v - j);
      if (u < 0.5) {
        x += step;
        if (x >= 1) x -= 1;
      } else {
        x -= step;
        if (x < 0) x += 1;
        if (x >= 1) x = 0;
      }
    }
    X[i] = x;
    mod[i] = it;
    return x;
  }

  accept() {
    if (this.large) this.lastLarge = this.iter;
  }

  reject() {
    const X = this.X;
    const mod = this.mod;
    for (let k = 0; k < this.nTouched; k++) {
      const i = this.touched[k];
      X[i] = this.backupX[i];
      mod[i] = this.backupMod[i];
    }
    this.iter--;
  }
}

function maxDimsFor(scene) {
  return CAMERA_DIMS + Math.max(1, scene.maxDepth) * VERTEX_DIMS + 1;
}

function copyRecordedPath(dst) {
  const n = 3 * PATH_N;
  for (let i = 0; i < n; i++) dst[i] = PATH_BUF[i];
  return PATH_N;
}

// ---------------------------------------------------------------------------------------------
// Path tracer: one stratified sample per pixel per pass.
// ---------------------------------------------------------------------------------------------
class PathTracer {
  constructor(scene, width, height, seed) {
    this.method = "pt";
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.sum = new Float64Array(width * height * 3);
    this.sampler = new IndependentSampler(seed, 0x7074);
    this.sampler.iw = 1 / width;
    this.sampler.ih = 1 / height;
    this.pass = 0;
    this.cursor = 0;
    this.paths = 0;
    this.rays = 0;
    this.seconds = 0;
    this.leaks = 0;
  }

  _trace(count) {
    bindScene(this.scene, this.width, this.height);
    const s = this.sampler;
    const sum = this.sum;
    const w = this.width;
    const n = w * this.height;
    const rays0 = CNT[0];
    const leaks0 = CNT[1];
    let cursor = this.cursor;
    for (let k = 0; k < count; k++) {
      s.px = cursor % w;
      s.py = (cursor / w) | 0;
      tracePath(s);
      const j = 3 * cursor;
      sum[j] += OUT[0];
      sum[j + 1] += OUT[1];
      sum[j + 2] += OUT[2];
      if (++cursor === n) {
        cursor = 0;
        this.pass++;
      }
    }
    this.cursor = cursor;
    this.paths += count;
    this.rays += CNT[0] - rays0;
    this.leaks += CNT[1] - leaks0;
  }

  run(milliseconds) {
    const t0 = clock();
    do this._trace(128);
    while (clock() - t0 < milliseconds);
    this.seconds += (clock() - t0) / 1000;
    return this.stats();
  }

  runSamples(count) {
    const t0 = clock();
    this._trace(count);
    this.seconds += (clock() - t0) / 1000;
    return this.stats();
  }

  image() {
    const n = this.width * this.height;
    const out = new Float32Array(n * 3);
    const sum = this.sum;
    for (let i = 0; i < n; i++) {
      const c = this.pass + (i < this.cursor ? 1 : 0);
      if (c === 0) continue;
      const ic = 1 / c;
      out[3 * i] = sum[3 * i] * ic;
      out[3 * i + 1] = sum[3 * i + 1] * ic;
      out[3 * i + 2] = sum[3 * i + 2] * ic;
    }
    return out;
  }

  stats() {
    return {
      method: "pt",
      samples: this.paths,
      samplesPerPixel: this.paths / (this.width * this.height),
      seconds: this.seconds,
      rays: this.rays,
      raysPerSecond: this.seconds > 0 ? this.rays / this.seconds : 0,
      leaks: this.leaks,
    };
  }

  currentPath() {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// PSSMLT: bootstrap b, start chains in proportion to their bootstrap luminance, then mutate with
// large steps (probability pLarge) and Kelemen small steps, splatting expected values.
//
// Normalization. "bootstrap" (default, Kelemen et al.): b is the mean luminance over independent
// uniform samples, the 1e5 bootstrap samples plus every large-step proposal. In this scene most of
// b comes from sun paths that independent sampling finds about once per million samples, so this
// b jumps by factors of several whenever one turns up. "ratio" (optional): with g the luminance
// of a path's sky terms, g <= f* and E_p[g / f*] = b_sky / b under the chain's stationary density
// p = f* / b, so b = b_sky / E_p[g / f*]. b_sky comes from the same independent samples (sky
// paths are common) and the ratio from the chains (bounded in [0, 1]), so sky-lit regions are
// correctly bright from the start and sun-lit ones converge as the chains equilibrate.
// ---------------------------------------------------------------------------------------------
class MetropolisRenderer {
  constructor(scene, width, height, seed, options) {
    this.method = "mlt";
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.seed = seed >>> 0;
    // Few long chains: the bootstrap rarely holds a sun-lit path, and fewer chains reach the sun-lit
    // mode sooner in wall time (of 16, 32, 64 and 256, 16 had the lowest error at 20 s in this scene
    // and was level with 32 at 60 s).
    this.nChains = options.chains ?? 16;
    this.pLarge = options.largeStepProbability ?? 0.3;
    this.nBootstrap = options.bootstrapSamples ?? 100000;
    this.useRatio = options.normalization === "ratio";
    this.maxDims = maxDimsFor(scene);
    this.splat = new Float64Array(width * height * 3);
    this.bootWeights = new Float64Array(this.nBootstrap);
    this.bootDone = 0;
    // Luminance sums: bootstrap, large steps, their sky parts, and the chains' expected sky fraction.
    this.sums = new Float64Array(5);
    this.bootSampler = new PrimarySampleSampler(this.maxDims);
    this.rng = new Rng(seed, 0x6d6c74);
    this.chains = null;
    this.state = null;
    this.nextChain = 0;
    this.mutations = 0;
    this.mutationsAtReset = 0;
    this.accepted = 0;
    this.largeProposed = 0;
    this.largeAccepted = 0;
    this.rays = 0;
    this.seconds = 0;
    this.leaks = 0;
    this.invalid = 0;
    this.dead = false;
    this.path = new Float64Array(PATH_BUF.length);
    this.pathCount = 0;
    this.pathPixel = -1;
  }

  _bootstrapSeed(i) {
    return hash32(this.seed ^ hash32(i + 0x2545f491));
  }

  _bootstrap(count) {
    const s = this.bootSampler;
    const end = Math.min(this.nBootstrap, this.bootDone + count);
    for (let i = this.bootDone; i < end; i++) {
      s.reset(this._bootstrapSeed(i), 0x626f6f74);
      tracePath(s);
      let lum = luminance(OUT[0], OUT[1], OUT[2]);
      if (!(lum >= 0 && lum < Infinity)) {
        lum = 0;
        this.invalid++;
      }
      this.bootWeights[i] = lum;
      this.sums[0] += lum;
      if (lum > 0) this.sums[2] += OUT[3];
    }
    this.bootDone = end;
  }

  _initChains() {
    const n = this.nChains;
    this.chains = new Array(n);
    this.state = new Float64Array(n * 6);
    const cdf = new Float64Array(this.nBootstrap);
    let acc = 0;
    for (let i = 0; i < this.nBootstrap; i++) {
      acc += this.bootWeights[i];
      cdf[i] = acc;
    }
    if (!(acc > 0)) {
      this.dead = true;
      return;
    }
    for (let c = 0; c < n; c++) {
      const u = this.rng.rand() * acc;
      let lo = 0;
      let hi = this.nBootstrap - 1;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (cdf[mid] > u) hi = mid;
        else lo = mid + 1;
      }
      const s = new PrimarySampleSampler(this.maxDims);
      s.reset(this._bootstrapSeed(lo), 0x626f6f74);
      tracePath(s);
      // Chains started from the same bootstrap sample must not share their future random numbers.
      s.reseed(hash32(this.seed + 0x632d), c);
      this.chains[c] = s;
      const st = 6 * c;
      const lum = luminance(OUT[0], OUT[1], OUT[2]);
      this.state[st] = OUT_PIX;
      this.state[st + 1] = OUT[0];
      this.state[st + 2] = OUT[1];
      this.state[st + 3] = OUT[2];
      this.state[st + 4] = lum;
      this.state[st + 5] = lum > 0 ? Math.min(1, OUT[3] / lum) : 0;
      if (c === 0) {
        this.pathCount = copyRecordedPath(this.path);
        this.pathPixel = OUT_PIX;
      }
    }
  }

  _mutate(count) {
    const splat = this.splat;
    const state = this.state;
    const chains = this.chains;
    const sums = this.sums;
    const n = this.nChains;
    const pLarge = this.pLarge;
    let c = this.nextChain;
    for (let k = 0; k < count; k++) {
      const s = chains[c];
      const st = 6 * c;
      s.start(pLarge);
      tracePath(s);
      const r = OUT[0];
      const g = OUT[1];
      const b = OUT[2];
      let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (!(lum >= 0 && lum < Infinity)) {
        lum = 0;
        this.invalid++;
      }
      const skyFrac = lum > 0 ? Math.min(1, OUT[3] / lum) : 0;
      if (s.large) {
        sums[1] += lum;
        if (lum > 0) sums[3] += OUT[3];
        this.largeProposed++;
      }
      const curLum = state[st + 4];
      const a = lum >= curLum ? 1 : lum / curLum;
      sums[4] += a * skyFrac + (1 - a) * state[st + 5];
      if (a > 0) {
        const w = a / lum;
        const j = 3 * OUT_PIX;
        splat[j] += w * r;
        splat[j + 1] += w * g;
        splat[j + 2] += w * b;
      }
      if (a < 1) {
        const w = (1 - a) / curLum;
        const j = 3 * state[st];
        splat[j] += w * state[st + 1];
        splat[j + 1] += w * state[st + 2];
        splat[j + 2] += w * state[st + 3];
      }
      if (a === 1 || s.rand() < a) {
        s.accept();
        state[st] = OUT_PIX;
        state[st + 1] = r;
        state[st + 2] = g;
        state[st + 3] = b;
        state[st + 4] = lum;
        state[st + 5] = skyFrac;
        this.accepted++;
        if (s.large) this.largeAccepted++;
        if (c === 0) {
          this.pathCount = copyRecordedPath(this.path);
          this.pathPixel = OUT_PIX;
        }
      } else {
        s.reject();
      }
      this.mutations++;
      if (++c === n) c = 0;
    }
    this.nextChain = c;
  }

  _work(count) {
    bindScene(this.scene, this.width, this.height);
    const rays0 = CNT[0];
    const leaks0 = CNT[1];
    if (this.bootDone < this.nBootstrap) {
      this._bootstrap(count);
      if (this.bootDone === this.nBootstrap) this._initChains();
    } else if (!this.dead) {
      this._mutate(count);
    }
    this.rays += CNT[0] - rays0;
    this.leaks += CNT[1] - leaks0;
  }

  run(milliseconds) {
    const t0 = clock();
    do {
      this._work(128);
      if (this.dead) break;
    } while (clock() - t0 < milliseconds);
    this.seconds += (clock() - t0) / 1000;
    return this.stats();
  }

  // Finishes the bootstrap, then performs exactly `count` mutations (for deterministic tests).
  runSamples(count) {
    const t0 = clock();
    while (this.bootDone < this.nBootstrap) this._work(4096);
    let left = count;
    while (left > 0 && !this.dead) {
      const k = Math.min(left, 4096);
      this._work(k);
      left -= k;
    }
    this.seconds += (clock() - t0) / 1000;
    return this.stats();
  }

  // b is the mean luminance over independent uniform samples. Large-step proposals are such
  // samples too, so they keep refining b after the bootstrap.
  bootstrapNormalization() {
    const count = this.bootDone + this.largeProposed;
    return count > 0 ? (this.sums[0] + this.sums[1]) / count : 0;
  }

  // b_sky over the same independent samples divided by the chains' expected sky fraction; falls
  // back to the bootstrap value until both exist (or in scenes without sky light).
  ratioNormalization() {
    const count = this.bootDone + this.largeProposed;
    const counted = this.mutations - this.mutationsAtReset;
    const bSky = count > 0 ? (this.sums[2] + this.sums[3]) / count : 0;
    const fraction = counted > 0 ? this.sums[4] / counted : 0;
    return bSky > 0 && fraction > 0 ? bSky / fraction : this.bootstrapNormalization();
  }

  normalization() {
    return this.useRatio ? this.ratioNormalization() : this.bootstrapNormalization();
  }

  // Drops everything splatted so far but keeps the chains and the normalization samples. The
  // reference uses it to discard burn-in: a 100k bootstrap rarely contains a sun-lit path, so
  // chains start in the sky-lit mode and need about 2e4 mutations each to reach equilibrium.
  resetImage() {
    this.splat.fill(0);
    this.sums[4] = 0;
    this.mutationsAtReset = this.mutations;
  }

  image() {
    const n = this.width * this.height;
    const out = new Float32Array(n * 3);
    const counted = this.mutations - this.mutationsAtReset;
    if (counted === 0) return out;
    const scale = (n * this.normalization()) / counted;
    const splat = this.splat;
    for (let i = 0; i < 3 * n; i++) out[i] = splat[i] * scale;
    return out;
  }

  stats() {
    const smallProposed = this.mutations - this.largeProposed;
    return {
      method: "mlt",
      samples: this.mutations,
      samplesPerPixel: this.mutations / (this.width * this.height),
      bootstrapSamples: this.bootDone,
      seconds: this.seconds,
      rays: this.rays,
      raysPerSecond: this.seconds > 0 ? this.rays / this.seconds : 0,
      acceptance: this.mutations > 0 ? this.accepted / this.mutations : 0,
      largeStepAcceptance: this.largeProposed > 0 ? this.largeAccepted / this.largeProposed : 0,
      smallStepAcceptance: smallProposed > 0 ? (this.accepted - this.largeAccepted) / smallProposed : 0,
      normalization: this.normalization(),
      normalizationMode: this.useRatio ? "ratio" : "bootstrap",
      bootstrapNormalization: this.bootstrapNormalization(),
      chains: this.nChains,
      leaks: this.leaks,
      invalid: this.invalid,
    };
  }

  // World-space vertices of chain 0's current path: camera, scattering vertices and, for paths
  // that reach the sky, the light-well crossing plus a point one metre beyond it.
  currentPath() {
    if (this.pathCount === 0) return null;
    return {
      vertices: Float32Array.from(this.path.subarray(0, 3 * this.pathCount)),
      pixel: this.pathPixel,
      x: this.pathPixel % this.width,
      y: Math.floor(this.pathPixel / this.width),
    };
  }
}

// ---------------------------------------------------------------------------------------------
// Light tracer (reference only; see traceParticle).
// ---------------------------------------------------------------------------------------------
class LightTracer {
  constructor(scene, width, height, seed) {
    this.method = "lt";
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.sum = new Float64Array(width * height * 3);
    this.rng = new Rng(seed, 0x6c74);
    const sunFlux = scene.sunOn ? luminance(...scene.sunRadiance) * (1 / scene.sunPdf) * scene.sun[1] : 0;
    const skyFlux = scene.skyOn ? luminance(...scene.skyRadiance) * Math.PI : 0;
    this.pSun = sunFlux + skyFlux > 0 ? sunFlux / (sunFlux + skyFlux) : 0;
    this.particles = 0;
    this.rays = 0;
    this.seconds = 0;
  }

  _trace(count) {
    bindScene(this.scene, this.width, this.height);
    const rays0 = CNT[0];
    for (let k = 0; k < count; k++) traceParticle(this.rng, this.sum, this.pSun);
    this.particles += count;
    this.rays += CNT[0] - rays0;
  }

  run(milliseconds) {
    const t0 = clock();
    do this._trace(256);
    while (clock() - t0 < milliseconds);
    this.seconds += (clock() - t0) / 1000;
    return this.stats();
  }

  runSamples(count) {
    const t0 = clock();
    this._trace(count);
    this.seconds += (clock() - t0) / 1000;
    return this.stats();
  }

  image() {
    const out = new Float32Array(this.sum.length);
    if (this.particles === 0) return out;
    const inv = 1 / this.particles;
    for (let i = 0; i < out.length; i++) out[i] = this.sum[i] * inv;
    return out;
  }

  stats() {
    return {
      method: "lt",
      samples: this.particles,
      seconds: this.seconds,
      rays: this.rays,
      raysPerSecond: this.seconds > 0 ? this.rays / this.seconds : 0,
    };
  }

  currentPath() {
    return null;
  }
}

export function createRenderer(options = {}) {
  const method = options.method === "mlt" || options.method === "lt" ? options.method : "pt";
  const width = options.width ?? 240;
  const height = options.height ?? 180;
  const seed = options.seed ?? 1;
  const scene = options.sceneObject || createScene(options);
  if (method === "mlt") return new MetropolisRenderer(scene, width, height, seed, options);
  if (method === "lt") return new LightTracer(scene, width, height, seed);
  return new PathTracer(scene, width, height, seed);
}

// Projects a world point to continuous pixel coordinates (null when behind the camera).
export function projectToImage(scene, width, height, x, y, z) {
  const c = scene.camera;
  const vx = x - c.position[0];
  const vy = y - c.position[1];
  const vz = z - c.position[2];
  const f = vx * c.forward[0] + vy * c.forward[1] + vz * c.forward[2];
  if (f <= 1e-6) return null;
  const r = (vx * c.right[0] + vy * c.right[1] + vz * c.right[2]) / f;
  const u = (vx * c.up[0] + vy * c.up[1] + vz * c.up[2]) / f;
  const tanX = (c.tanY * width) / height;
  return [((r / tanX + 1) / 2) * width, ((1 - u / c.tanY) / 2) * height];
}

// ---------------------------------------------------------------------------------------------
// Display and error helpers.
// ---------------------------------------------------------------------------------------------
const SRGB_LUT = new Uint8ClampedArray(4097);
for (let i = 0; i <= 4096; i++) {
  const x = i / 4096;
  const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  SRGB_LUT[i] = Math.round(v * 255);
}

// ACES filmic fit (Narkowicz 2015) of exposure-scaled linear RGB, before the sRGB curve.
export function toneMapACES(x) {
  if (!(x > 0)) return 0;
  const y = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  return y < 1 ? y : 1;
}

export function toneMapToRGBA(rgb, width, height, exposure = DEFAULT_EXPOSURE, out = null) {
  const n = width * height;
  const dst = out || new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    dst[4 * i] = SRGB_LUT[Math.round(toneMapACES(rgb[3 * i] * exposure) * 4096)];
    dst[4 * i + 1] = SRGB_LUT[Math.round(toneMapACES(rgb[3 * i + 1] * exposure) * 4096)];
    dst[4 * i + 2] = SRGB_LUT[Math.round(toneMapACES(rgb[3 * i + 2] * exposure) * 4096)];
    dst[4 * i + 3] = 255;
  }
  return dst;
}

// Box-filters linear luminance onto a gw x gh grid.
export function downsampleLuminance(rgb, width, height, gw, gh) {
  const out = new Float64Array(gw * gh);
  const count = new Float64Array(gw * gh);
  for (let y = 0; y < height; y++) {
    const gy = Math.min(gh - 1, Math.floor((y * gh) / height));
    for (let x = 0; x < width; x++) {
      const gx = Math.min(gw - 1, Math.floor((x * gw) / width));
      const i = 3 * (y * width + x);
      out[gy * gw + gx] += luminance(rgb[i], rgb[i + 1], rgb[i + 2]);
      count[gy * gw + gx]++;
    }
  }
  for (let i = 0; i < gw * gh; i++) out[i] = count[i] > 0 ? out[i] / count[i] : 0;
  return out;
}

// RMSE of downsampled luminance against reference { width, height, luminance: number[] }.
export function luminanceRmse(rgb, width, height, reference) {
  const gw = reference.width;
  const gh = reference.height;
  const ref = reference.luminance;
  const grid = downsampleLuminance(rgb, width, height, gw, gh);
  let se = 0;
  let mean = 0;
  for (let i = 0; i < gw * gh; i++) {
    const d = grid[i] - ref[i];
    se += d * d;
    mean += ref[i];
  }
  const rmse = Math.sqrt(se / (gw * gh));
  mean /= gw * gh;
  return { rmse, relative: mean > 0 ? rmse / mean : 0 };
}

// ---------------------------------------------------------------------------------------------
// Probes for tests and tools (these allocate; the renderers never call them).
// ---------------------------------------------------------------------------------------------
export function fresnel(cosI, eta) {
  return fresnelDielectric(cosI, eta);
}

// Refracts unit direction d through unit normal n (n on the incident side); null under TIR.
export function refract(d, n, eta) {
  const cosI = -(d[0] * n[0] + d[1] * n[1] + d[2] * n[2]);
  fresnelDielectric(cosI, eta);
  const cosT = SCR[3];
  if (cosT === 0) return null;
  const k = eta * cosI - cosT;
  return [eta * d[0] + k * n[0], eta * d[1] + k * n[1], eta * d[2] + k * n[2]];
}

export function waterHeightAt(scene, x, z) {
  bindScene(scene, IMG_W, IMG_H);
  return waterHeight(x, z);
}

export function waterNormalAt(scene, x, z) {
  bindScene(scene, IMG_W, IMG_H);
  waterGradient(x, z);
  const il = 1 / Math.sqrt(1 + SCR[0] * SCR[0] + SCR[1] * SCR[1]);
  return [-SCR[0] * il, il, -SCR[1] * il];
}

export function traceRay(scene, origin, direction, inWater = false) {
  bindScene(scene, IMG_W, IMG_H);
  const leaks0 = CNT[1];
  const kind = intersect(origin[0], origin[1], origin[2], direction[0], direction[1], direction[2], inWater);
  return {
    kind,
    t: HIT[HT],
    point: [HIT[HX], HIT[HY], HIT[HZ]],
    normal: [HIT[HNX], HIT[HNY], HIT[HNZ]],
    material: ["limestone", "slate", "tile", "water"][H_MAT],
    leaked: CNT[1] !== leaks0,
  };
}

export function counters() {
  return { rays: CNT[0], leaks: CNT[1], waterEvaluations: CNT[2], waterMarches: CNT[3] };
}

export function fastSin(x) {
  return fsin(x);
}

export function fastCos(x) {
  return fcos(x);
}
