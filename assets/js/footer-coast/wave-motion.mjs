// The same two low-amplitude modes and analytic slopes used by the water
// shader. Floating figures follow the surface instead of an unrelated bob.
export function sampleCoastWave(x, z, seconds) {
  const a = z * 3.8 - x * 0.28 - seconds * 0.8;
  const b = x * 2.7 + z * 1.2 - seconds * 0.6;
  return {
    height: Math.sin(a) * 0.023 + Math.sin(b) * 0.013,
    dx: -0.00644 * Math.cos(a) + 0.0351 * Math.cos(b),
    dz: 0.0874 * Math.cos(a) + 0.0156 * Math.cos(b),
  };
}
