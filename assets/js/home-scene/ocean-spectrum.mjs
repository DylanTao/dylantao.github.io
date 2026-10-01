// A bounded deterministic spectrum, in meters/seconds. This is a sparse
// Gerstner approximation, not Arc Blanc's FFT or solid/fluid coupling solver.
// Wave derivatives and subpixel slope energy follow the multiscale ocean
// rendering literature; source/equation notes live in PHYSICS.md.
export const GRAVITY = 9.80665;
export const WATER_IOR = 1.333;
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
  };
});

export function waterFresnel(cosine, ior = WATER_IOR) {
  const c = Math.max(0, Math.min(1, cosine)),
    t = Math.sqrt(1 - (1 - c * c) / (ior * ior)),
    s = (c - ior * t) / (c + ior * t),
    p = (ior * c - t) / (ior * c + t);
  return (s * s + p * p) / 2;
}

export function sampleOcean(x, z, seconds, footprint = 0) {
  const displacement = [0, 0, 0],
    tangentX = [1, 0, 0],
    tangentZ = [0, 0, 1];
  let lostVariance = 0;
  for (const w of OCEAN_WAVES) {
    const filter = Math.exp(-0.5 * (w.k * footprint) ** 2),
      amplitude = w.amplitude * filter,
      phase = w.k * (w.dx * x + w.dz * z) - w.omega * seconds + w.phase,
      s = Math.sin(phase),
      c = Math.cos(phase),
      qa = w.choppiness * amplitude,
      derivative = qa * w.k * s;
    displacement[0] += qa * w.dx * c;
    displacement[1] += amplitude * s;
    displacement[2] += qa * w.dz * c;
    tangentX[0] -= derivative * w.dx * w.dx;
    tangentX[1] += amplitude * w.k * w.dx * c;
    tangentX[2] -= derivative * w.dx * w.dz;
    tangentZ[0] -= derivative * w.dx * w.dz;
    tangentZ[1] += amplitude * w.k * w.dz * c;
    tangentZ[2] -= derivative * w.dz * w.dz;
    lostVariance += 0.5 * (w.amplitude * w.k) ** 2 * (1 - filter * filter);
  }
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
export const oceanFieldGLSL = `
void oceanField(vec2 p, float time, float footprint, out vec3 displacement, out vec3 tx, out vec3 tz, out float lostVariance) {
  displacement=vec3(0.); tx=vec3(1.,0.,0.); tz=vec3(0.,0.,1.); lostVariance=0.;
  ${OCEAN_WAVES.map(
    (w) => `{
    vec2 d=vec2(${f(w.dx)},${f(w.dz)});
    float k=${f(w.k)}, a=${f(w.amplitude)}, q=${f(w.choppiness)};
    float bandWeight=exp(-.5*k*k*footprint*footprint);
    float phase=k*dot(d,p)-${f(w.omega)}*time+${f(w.phase)};
    float s=sin(phase),c=cos(phase),ak=a*bandWeight*k;
    displacement+=a*bandWeight*vec3(q*d.x*c,s,q*d.y*c);
    tx+=vec3(-q*ak*d.x*d.x*s,ak*d.x*c,-q*ak*d.x*d.y*s);
    tz+=vec3(-q*ak*d.x*d.y*s,ak*d.y*c,-q*ak*d.y*d.y*s);
    lostVariance+=.5*a*a*k*k*(1.-bandWeight*bandWeight);
  }`
  ).join("\n")}
}
`;
