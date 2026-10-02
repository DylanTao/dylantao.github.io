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
