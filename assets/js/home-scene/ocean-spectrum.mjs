import { coastWind, coastWindGLSL, windGLSLFloat } from "./wind-field.mjs";

// A bounded deterministic spectrum, in meters/seconds. This is a sparse
// Gerstner approximation, not Arc Blanc's FFT or solid/fluid coupling solver.
// Wave derivatives and subpixel slope energy follow the multiscale ocean
// rendering literature; source/equation notes live in PHYSICS.md.
//
// Since 2026-10-15 the sea reads the coast's one wind (wind-field.mjs). The three longest components
// stand in for swell and keep their heading and height all day. The shorter ones are the local wind
// sea: they turn with the breeze and grow with it, from glassy mornings to a choppy afternoon (a
// Pierson-Moskowitz low-frequency cut and a square-root saturation level, never above the authored
// heights, so the steepness bound below still holds). The pixel-stage ripples follow the wind under
// each pixel, gusts included, through the Cox-Munk slope law, so gust fronts cross the water as dark
// cat's paws; whitecaps follow Monahan's power law in the same local wind.
export const GRAVITY = 9.80665;
export const WATER_IOR = 1.333;
export const OCEAN_SWELL_WAVELENGTH = 8;
export const OCEAN_WAVES = [
  [24.7, 0.17, 0.19, 0.68, 0.4],
  [15.3, 0.11, -0.27, 0.64, 1.9],
  [8.9, 0.07, 0.42, 0.54, 4.1],
  [5.4, 0.045, -0.51, 0.48, 2.7],
  [2.7, 0.027, 0.62, 0.3, 5.3],
  [1.37, 0.014, -0.74, 0.22, 0.9],
  [0.63, 0.006, 1.16, 0.16, 3.7],
  [0.29, 0.003, -1.02, 0.12, 2.1],
  [0.13, 0.0012, 0.87, 0.08, 5.7],
  [0.061, 0.00045, -0.93, 0.05, 1.1],
].map(([wavelength, amplitude, heading, choppiness, phase]) => {
  const k = (Math.PI * 2) / wavelength;
  return {
    wavelength,
    amplitude,
    dx: Math.sin(heading),
    dz: Math.cos(heading),
    choppiness,
    phase,
    k,
    omega: Math.sqrt(GRAVITY * k + (0.074 / 1025) * k ** 3),
    windSea: wavelength < OCEAN_SWELL_WAVELENGTH,
  };
});

// How the wind sea answers the breeze. `reference` is the breeze at which the authored heights are
// fully grown, the October afternoon mean at Scripps Pier, so an ordinary afternoon shows the authored
// sea; below `onset` the sea is glassy; `residual` keeps a trace of chop in a dead calm.
export const OCEAN_WIND = Object.freeze({
  reference: 3,
  onset: Object.freeze([0.4, 2.2]),
  residual: 0.08,
  // Cox and Munk (1954), clean sea surface: mean square slope 0.003 + 0.00512 U, measured in winds
  // of about 1 to 14 m/s. Below `rippleOnset` the ripples die out further, so a lull turns glassy.
  slope: Object.freeze([0.003, 0.00512]),
  rippleOnset: Object.freeze([0.3, 1.8]),
  rippleRange: Object.freeze([0.2, 1.3]),
  rippleLag: 0.4,
  // Monahan and O'Muircheartaigh (1980): whitecap fraction 3.84e-6 U^3.41, exaggerated tenfold here
  // for a small, stylized sea (about 1 % in a 5 m/s gust) and capped.
  whitecap: Object.freeze([3.84e-6, 3.41, 10, 0.3]),
});
const smoothRange = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
// A wind-sea component's height relative to its authored value, for a breeze of `speed` m/s:
// a saturation level that grows like sqrt(U) after onset, times the Pierson-Moskowitz cut
// exp(-5/4 (omega_p / omega)^4) = exp(-5/4 (k_p / k)^2), with omega_p = 0.855 g / U.
export function windSeaScale(k, speed) {
  const u = Math.max(0, speed),
    level = Math.min(1, Math.sqrt(u / OCEAN_WIND.reference)) * smoothRange(OCEAN_WIND.onset[0], OCEAN_WIND.onset[1], u),
    peak = (0.855 * 0.855 * GRAVITY) / Math.max(u, 0.3) ** 2;
  return Math.max(OCEAN_WIND.residual, Math.min(1, level * Math.exp(-1.25 * (peak / k) ** 2)));
}
// Ripple amplitude relative to the authored ripples under a local wind: the Cox-Munk slope ratio,
// fading toward a third of it in a lull.
export function rippleScale(speed) {
  const [c0, c1] = OCEAN_WIND.slope,
    u = Math.max(0, speed),
    ratio =
      Math.sqrt((c0 + c1 * u) / (c0 + c1 * OCEAN_WIND.reference)) *
      (0.35 + 0.65 * smoothRange(OCEAN_WIND.rippleOnset[0], OCEAN_WIND.rippleOnset[1], u));
  return Math.max(OCEAN_WIND.rippleRange[0], Math.min(OCEAN_WIND.rippleRange[1], ratio));
}
// The sea state for a breeze: `turn` rotates the wind sea from its authored onshore heading (+Z) to
// the wind's, and `scale` holds each component's height factor (1 for the swell).
export function oceanWindState(speed, yaw, out = { turn: [1, 0], scale: new Float32Array(OCEAN_WAVES.length) }) {
  out.turn[0] = Math.cos(yaw);
  out.turn[1] = Math.sin(yaw);
  OCEAN_WAVES.forEach((w, i) => (out.scale[i] = w.windSea ? windSeaScale(w.k, speed) : 1));
  return out;
}
// Shared uniforms for the ocean material: bind once (bindOceanWind), update every frame (syncOceanWind).
export const oceanWindUniforms = {
  oceanWaveScale: { value: new Float32Array(OCEAN_WAVES.length).fill(1) },
  oceanWindTurn: { value: new Float32Array([1, 0]) },
  oceanWindOrigin: { value: new Float32Array([0, -28]) },
  ...coastWind.uniforms,
};
const syncScratch = { turn: [1, 0], scale: oceanWindUniforms.oceanWaveScale.value };
export function syncOceanWind(state = coastWind.state) {
  oceanWindState(state.meanSpeed, state.yaw, syncScratch);
  oceanWindUniforms.oceanWindTurn.value[0] = syncScratch.turn[0];
  oceanWindUniforms.oceanWindTurn.value[1] = syncScratch.turn[1];
  return syncScratch;
}
// `origin` is the ocean mesh's world position: its local xz plus origin.xz is the world point the
// wind is sampled at, so the water and the bluff see one set of gust fronts.
export function bindOceanWind(shader, origin = null) {
  Object.assign(shader.uniforms, oceanWindUniforms, oceanShapeUniforms);
  if (origin) oceanWindUniforms.oceanWindOrigin.value.set([origin.x, origin.z]);
  return shader;
}

export function waterFresnel(cosine, ior = WATER_IOR) {
  const c = Math.max(0, Math.min(1, cosine)),
    t = Math.sqrt(1 - (1 - c * c) / (ior * ior)),
    s = (c - ior * t) / (c + ior * t),
    p = (ior * c - t) / (ior * c + t);
  return (s * s + p * p) / 2;
}

// `wind` is an oceanWindState ({ turn, scale }); without it the authored spectrum is sampled.
export function sampleOcean(x, z, seconds, footprint = 0, wind = null) {
  const displacement = [0, 0, 0],
    tangentX = [1, 0, 0],
    tangentZ = [0, 0, 1];
  let lostVariance = 0;
  OCEAN_WAVES.forEach((w, i) => {
    const turned = wind && w.windSea,
      dx = turned ? w.dx * wind.turn[0] + w.dz * wind.turn[1] : w.dx,
      dz = turned ? w.dz * wind.turn[0] - w.dx * wind.turn[1] : w.dz,
      height = turned ? w.amplitude * wind.scale[i] : w.amplitude;
    const filter = Math.exp(-0.5 * (w.k * footprint) ** 2),
      amplitude = height * filter,
      phase = w.k * (dx * x + dz * z) - w.omega * seconds + w.phase,
      s = Math.sin(phase),
      c = Math.cos(phase),
      qa = w.choppiness * amplitude,
      derivative = qa * w.k * s;
    displacement[0] += qa * dx * c;
    displacement[1] += amplitude * s;
    displacement[2] += qa * dz * c;
    tangentX[0] -= derivative * dx * dx;
    tangentX[1] += amplitude * w.k * dx * c;
    tangentX[2] -= derivative * dx * dz;
    tangentZ[0] -= derivative * dx * dz;
    tangentZ[1] += amplitude * w.k * dz * c;
    tangentZ[2] -= derivative * dz * dz;
    lostVariance += 0.5 * (height * w.k) ** 2 * (1 - filter * filter);
  });
  const n = [
      tangentZ[1] * tangentX[2] - tangentZ[2] * tangentX[1],
      tangentZ[2] * tangentX[0] - tangentZ[0] * tangentX[2],
      tangentZ[0] * tangentX[1] - tangentZ[1] * tangentX[0],
    ],
    length = Math.hypot(...n);
  return {
    displacement,
    tangentX,
    tangentZ,
    normal: n.map((v) => v / length),
    jacobian: tangentX[0] * tangentZ[2] - tangentX[2] * tangentZ[0],
    lostVariance,
  };
}

const f = (value) => value.toFixed(9);
// The spectrum's constants reach the shaders as uniform arrays looped with a uniform bound (flat arrays,
// per the performance notes). ANGLE's Direct3D compiler unrolls constant-bound loops and inlines every
// call; written out wave by wave, the sea's program took twice as long to compile once its optics joined
// it (2026-10-18). The arithmetic per wave is unchanged.
export const oceanFieldGLSL = `
uniform float oceanWaveScale[${OCEAN_WAVES.length}];
uniform vec2 oceanWindTurn;
uniform vec4 oceanWaveA[${OCEAN_WAVES.length}];
uniform vec4 oceanWaveB[${OCEAN_WAVES.length}];
uniform int oceanWaveCount;
// Turn an authored onshore heading toward the wind's.
vec2 oceanTurn(vec2 d) { return vec2(d.x*oceanWindTurn.x+d.y*oceanWindTurn.y, d.y*oceanWindTurn.x-d.x*oceanWindTurn.y); }
void oceanField(vec2 p, float time, float footprint, out vec3 displacement, out vec3 tx, out vec3 tz, out float lostVariance) {
  displacement=vec3(0.); tx=vec3(1.,0.,0.); tz=vec3(0.,0.,1.); lostVariance=0.;
  for (int i = 0; i < oceanWaveCount; i++) {
    // (dx, dz, k, amplitude) and (choppiness, omega, phase, wind sea): the wind sea turns and scales.
    vec4 shape=oceanWaveA[i], motion=oceanWaveB[i];
    bool windSea=motion.w>.5;
    vec2 d=windSea?oceanTurn(shape.xy):shape.xy;
    float k=shape.z, a=shape.w*(windSea?oceanWaveScale[i]:1.), q=motion.x;
    float bandWeight=exp(-.5*k*k*footprint*footprint);
    float phase=k*dot(d,p)-motion.y*time+motion.z;
    float s=sin(phase),c=cos(phase),ak=a*bandWeight*k;
    displacement+=a*bandWeight*vec3(q*d.x*c,s,q*d.y*c);
    tx+=vec3(-q*ak*d.x*d.x*s,ak*d.x*c,-q*ak*d.x*d.y*s);
    tz+=vec3(-q*ak*d.x*d.y*s,ak*d.y*c,-q*ak*d.y*d.y*s);
    lostVariance+=.5*a*a*k*k*(1.-bandWeight*bandWeight);
  }
}
`;

// Short wind ripples for the pixel stage only (Sirui, 2026-10-14). Each swell octave above is one
// plane wave, so up close the short ones read as ruled parallel stripes. Twelve shorter waves
// spread over the wind's half-plane by the golden angle, from 0.9 m down to 2.4 cm, break that up
// into the crossed, irregular chop real water has. They tilt the normal only (no displacement, so
// sampleOcean and the swells' geometry are unchanged); like the swells, each one fades out once a
// pixel can no longer resolve it, and its lost slope variance widens the highlight instead.
// Headings are relative to the wind; the shader turns them with the breeze (oceanTurn) and scales
// them by the local wind under the pixel, so a gust's cat's paw roughens the water as it passes.
export const RIPPLES = Array.from({ length: 12 }, (_, i) => {
  const wavelength = 0.9 * 0.72 ** i,
    k = (Math.PI * 2) / wavelength,
    heading = 1.25 * Math.sin(i * 2.39996);
  return {
    k,
    dx: Math.sin(heading),
    dz: Math.cos(heading),
    amplitude: 0.11 / k,
    omega: Math.sqrt(GRAVITY * k + (0.074 / 1025) * k ** 3),
    phase: i * 1.7,
  };
});
// The local wind (m/s) a pixel of the sea feels, in the coast's state: the CPU twin of oceanWindLocal.
export function oceanLocalWind(x, z, wind = coastWind, seconds = wind.state.seconds) {
  return wind.state.meanSpeed * wind.gust(x, z, seconds, OCEAN_WIND.rippleLag);
}
// Whitecap fraction for a local wind, before the shader's crest weighting.
export function whitecapCoverage(speed) {
  const [a, b, gain, cap] = OCEAN_WIND.whitecap;
  return Math.min(cap, gain * a * Math.max(0, speed) ** b);
}
// The swells' and ripples' constants as flat uniform arrays (see oceanFieldGLSL).
const oceanShapeUniforms = (() => {
  const waveA = new Float32Array(OCEAN_WAVES.length * 4),
    waveB = new Float32Array(OCEAN_WAVES.length * 4),
    rippleA = new Float32Array(RIPPLES.length * 4),
    rippleB = new Float32Array(RIPPLES.length * 4);
  OCEAN_WAVES.forEach((w, i) => {
    waveA.set([w.dx, w.dz, w.k, w.amplitude], i * 4);
    waveB.set([w.choppiness, w.omega, w.phase, w.windSea ? 1 : 0], i * 4);
  });
  RIPPLES.forEach((w, i) => {
    rippleA.set([w.dx, w.dz, w.k, w.amplitude], i * 4);
    rippleB.set([w.omega, w.phase, 0, 0], i * 4);
  });
  return {
    oceanWaveA: { value: waveA },
    oceanWaveB: { value: waveB },
    oceanWaveCount: { value: OCEAN_WAVES.length },
    oceanRippleA: { value: rippleA },
    oceanRippleB: { value: rippleB },
    oceanRippleCount: { value: RIPPLES.length },
  };
})();
const gw = (x) => windGLSLFloat(x);
// Fragment stage only: it needs the scene's surfaceNoise (stoneNoise) and oceanFieldGLSL before it.
export const oceanRipplesGLSL = `
${coastWindGLSL}
uniform vec2 oceanWindOrigin;
uniform vec4 oceanRippleA[${RIPPLES.length}];
uniform vec4 oceanRippleB[${RIPPLES.length}];
uniform int oceanRippleCount;
float oceanWindLocal;
vec3 oceanRipples(vec2 p, float time, float footprint) {
  // The wind under this pixel, at its world position, gusts included.
  oceanWindLocal = coastWindState.z * coastWindGust(p + oceanWindOrigin, ${gw(OCEAN_WIND.rippleLag)});
  float windU = max(oceanWindLocal, 0.0);
  float gain = clamp(sqrt((${gw(OCEAN_WIND.slope[0])} + ${gw(OCEAN_WIND.slope[1])} * windU) / ${gw(OCEAN_WIND.slope[0] + OCEAN_WIND.slope[1] * OCEAN_WIND.reference)}) * (0.35 + 0.65 * smoothstep(${gw(OCEAN_WIND.rippleOnset[0])}, ${gw(OCEAN_WIND.rippleOnset[1])}, windU)), ${gw(OCEAN_WIND.rippleRange[0])}, ${gw(OCEAN_WIND.rippleRange[1])});
  vec3 ripple = vec3(0.);
  for (int i = 0; i < oceanRippleCount; i++) {
    // (dx, dz, k, amplitude) and (omega, phase): headings turn with the breeze.
    vec4 shape=oceanRippleA[i];
    vec2 motion=oceanRippleB[i].xy, d=oceanTurn(shape.xy);
    float k=shape.z, a=shape.w*gain;
    float weight=exp(-.5*k*k*footprint*footprint);
    if(weight>.002) ripple.xy+=d*(a*k*weight*cos(k*dot(d,p)-motion.x*time+motion.y));
    ripple.z+=.5*a*a*k*k*(1.-weight*weight);
  }
  return ripple;
}
// Whitecaps in the local wind (call after oceanRipples): Monahan's coverage picks the share of a
// drifting noise field that breaks, through a rational approximation of the normal quantile
// (Abramowitz and Stegun 26.2.22) fitted to stoneNoise's tail, favouring compressed, raised water
// (crest and compression are the foam's own 0..1 crest and Jacobian measures).
float oceanWhitecap(vec2 p, float time, float crest, float compression) {
  float coverage = min(${gw(OCEAN_WIND.whitecap[3])}, ${gw(OCEAN_WIND.whitecap[2] * OCEAN_WIND.whitecap[0])} * pow(max(oceanWindLocal, 0.0), ${gw(OCEAN_WIND.whitecap[1])}));
  if (coverage < 1e-4) return 0.;
  float t = sqrt(-2. * log(coverage));
  float threshold = .5 + .116 * (t - (2.30753 + .27061 * t) / (1. + .99229 * t + .04481 * t * t));
  float n = stoneNoise(vec3((p - coastWindState.xy * time * 1.2) * .45, time * .18));
  return smoothstep(threshold - .015, threshold + .015, n) * (.45 + .55 * smoothstep(0., .6, compression + crest));
}
`;
