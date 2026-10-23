// Original implementation of JPL's 1800–2050 approximate elements (Standish/Williams).
// https://ssd.jpl.nasa.gov/planets/approx_pos.html
// Photometry: Mallama & Hilton 2018, equations 2–4, 6–8, 10 (see PLANETS.md).
// J2000 equatorial unit directions share the stars' date precession and horizon transform.
const D = Math.PI / 180;
const elements = {
  Mercury: [
    [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  ],
  Venus: [
    [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  ],
  Earth: [
    [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  ],
  Mars: [
    [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  ],
  Jupiter: [
    [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  ],
  Saturn: [
    [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  ],
};
export const PLANET_NAMES = Object.freeze(["Mercury", "Venus", "Mars", "Jupiter", "Saturn"]);
export const PLANET_COLORS = Object.freeze([
  [1, 0.94, 0.84],
  [1, 0.97, 0.87],
  [1, 0.55, 0.3],
  [1, 0.89, 0.73],
  [1, 0.86, 0.61],
]);
const dot = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0);
const unit = (a) => {
  const r = Math.hypot(...a);
  return a.map((x) => x / r);
};
const subtract = (a, b) => a.map((x, i) => x - b[i]);
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) / D;
const eq = ([x, y, z]) => [x, Math.cos(23.43928 * D) * y - Math.sin(23.43928 * D) * z, Math.sin(23.43928 * D) * y + Math.cos(23.43928 * D) * z];
export function heliocentric(name, utc) {
  const T = (utc / 86400000 + 2440587.5 - 2451545) / 36525;
  const [a, e, i, l, p, n] = elements[name][0].map((v, k) => v + elements[name][1][k] * T);
  const M = ((((l - p + 180) % 360) + 360) % 360) * D - Math.PI;
  let E = M + e * Math.sin(M);
  for (let j = 0; j < 8; j++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const x = a * (Math.cos(E) - e),
    y = a * Math.sqrt(1 - e * e) * Math.sin(E),
    w = (p - n) * D,
    N = n * D,
    I = i * D;
  return [
    (Math.cos(w) * Math.cos(N) - Math.sin(w) * Math.sin(N) * Math.cos(I)) * x +
      (-Math.sin(w) * Math.cos(N) - Math.cos(w) * Math.sin(N) * Math.cos(I)) * y,
    (Math.cos(w) * Math.sin(N) + Math.sin(w) * Math.cos(N) * Math.cos(I)) * x +
      (-Math.sin(w) * Math.sin(N) + Math.cos(w) * Math.cos(N) * Math.cos(I)) * y,
    Math.sin(w) * Math.sin(I) * x + Math.cos(w) * Math.sin(I) * y,
  ];
}
export function planetPositions(utc) {
  const year = new Date(utc).getUTCFullYear();
  if (year < 1800 || year > 2050) return [];
  const earth = heliocentric("Earth", utc);
  return PLANET_NAMES.map((name) => {
    let p = heliocentric(name, utc),
      delta = Math.hypot(...subtract(p, earth));
    // One light-time iteration; the Earth stays at reception time.
    p = heliocentric(name, utc - delta * 499.004784 * 1000);
    const relative = subtract(p, earth),
      r = Math.hypot(...p),
      d = Math.hypot(...relative),
      alpha = angle(p, relative),
      base = 5 * Math.log10(r * d);
    let phase;
    if (name === "Mercury")
      phase =
        -0.613 +
        0.06328 * alpha -
        0.0016336 * alpha ** 2 +
        0.000033644 * alpha ** 3 -
        0.00000034265 * alpha ** 4 +
        0.0000000016893 * alpha ** 5 -
        0.0000000000030334 * alpha ** 6;
    if (name === "Venus")
      phase =
        alpha <= 163.7
          ? -4.384 - 0.001044 * alpha + 0.0003687 * alpha ** 2 - 0.000002814 * alpha ** 3 + 0.000000008938 * alpha ** 4
          : 236.05828 - 2.81914 * alpha + 0.00839034 * alpha ** 2;
    if (name === "Mars") phase = alpha <= 50 ? -1.601 + 0.02267 * alpha - 0.0001302 * alpha ** 2 : -0.367 - 0.02573 * alpha + 0.0003445 * alpha ** 2;
    if (name === "Jupiter") phase = -9.395 - 0.00037 * alpha + 0.000616 * alpha ** 2;
    if (name === "Saturn") {
      // J2000 Saturn north pole (IAU); the ring plane is normal to it. The same side must be lit.
      const pole = [Math.cos(83.537 * D) * Math.cos(40.589 * D), Math.cos(83.537 * D) * Math.sin(40.589 * D), Math.sin(83.537 * D)];
      const bE = Math.asin(
          dot(
            pole,
            unit(eq(relative)).map((v) => -v)
          )
        ),
        bS = Math.asin(
          dot(
            pole,
            unit(eq(p)).map((v) => -v)
          )
        );
      const beta = bE * bS > 0 ? Math.sqrt(bE * bS) : 0,
        s = Math.sin(beta);
      phase = -8.914 - 1.825 * s + 0.026 * alpha - 0.378 * s * Math.exp(-2.25 * alpha);
    }
    const direction = unit(eq(relative));
    return {
      name,
      direction,
      magnitude: base + phase,
      ra: (((Math.atan2(direction[1], direction[0]) / D) % 360) + 360) % 360,
      dec: Math.asin(direction[2]) / D,
      phaseAngle: alpha,
      distance: d,
    };
  });
}
