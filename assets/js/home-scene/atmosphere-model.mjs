// The coast's sky as a scattering atmosphere: Hillaire's production sky (Sébastien Hillaire, "A
// Scalable and Production Ready Sky and Atmosphere Rendering Technique", EGSR 2020) on the planet,
// density profiles and texture parameterization of Bruneton's precomputed scattering (Eric Bruneton
// and Fabrice Neyret, "Precomputed Atmospheric Scattering", EGSR 2008, and Bruneton's 2017
// reference implementation). Pure functions with no three.js, so Node tests check the physics;
// atmosphere.mjs draws the same equations on the GPU and keeps both in step.
//
// Units: kilometres inside the atmosphere, radians for angles, radiance per unit solar illuminance
// (the scene's exposure scale is applied by the caller). The scene's axes are kept: +X north, +Y up,
// +Z east, so the Pacific lies toward -Z.
//
// La Jolla's air is not the reference model's very clean air (aerosol optical depth about 0.005):
// the coast carries sea-salt aerosol under the marine inversion, a few hundredths to about a tenth
// at 550 nm. That haze whitens the horizon, brightens the sun's aureole and turns the low sun orange,
// so the Mie coefficients below (optical depth 0.045, a clear marine day, chosen by eye from 0.1 and
// 0.06, which washed the golden hour out) are about nine times Bruneton's defaults, with an Ångström
// exponent of 0.4 (large, nearly grey salt particles) and a single-scattering albedo of 0.97.

export const ATMOSPHERE = Object.freeze({
  bottomRadius: 6360,
  topRadius: 6460,
  // 680, 550 and 440 nm, the wavelengths of Bruneton's RGB convention.
  rayleighScattering: [5.802e-3, 13.558e-3, 33.1e-3],
  rayleighScaleHeight: 8,
  // Extinction 0.045 / 1.2 km at 550 nm, scaled by (λ/550)^-0.4.
  mieScattering: [0.0334, 0.0364, 0.0397],
  mieAbsorption: [0.001, 0.0011, 0.0012],
  mieScaleHeight: 1.2,
  // Marine aerosol: a forward lobe a little broader than the reference's 0.8.
  mieG: 0.76,
  // Chappuis-band ozone absorption (Hillaire's values), a tent from 10 km to 40 km peaking at 25 km.
  ozoneAbsorption: [0.65e-3, 1.881e-3, 0.085e-3],
  ozoneCenter: 25,
  ozoneHalfWidth: 15,
  // The Pacific below: dark water, about 6 % albedo for diffuse light.
  groundAlbedo: [0.05, 0.06, 0.07],
  // The physical solar disc (0.2667 degrees); the dome draws an enlarged disc for legibility.
  sunAngularRadius: 0.004654,
});

const PI = Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const safeSqrt = (x) => Math.sqrt(Math.max(0, x));
export const DEG = PI / 180;

// ── Media ────────────────────────────────────────────────────────────────────────────────────────
export function densities(altitude, a = ATMOSPHERE) {
  const h = Math.max(0, altitude);
  return [Math.exp(-h / a.rayleighScaleHeight), Math.exp(-h / a.mieScaleHeight), Math.max(0, 1 - Math.abs(h - a.ozoneCenter) / a.ozoneHalfWidth)];
}

// Extinction (1/km) per channel at an altitude.
export function extinctionAt(altitude, a = ATMOSPHERE) {
  const [r, m, o] = densities(altitude, a);
  return [0, 1, 2].map((c) => a.rayleighScattering[c] * r + (a.mieScattering[c] + a.mieAbsorption[c]) * m + a.ozoneAbsorption[c] * o);
}

// ── Geometry (Bruneton 2017, functions.glsl) ────────────────────────────────────────────────────
export function distanceToTop(r, mu, a = ATMOSPHERE) {
  return Math.max(0, -r * mu + safeSqrt(r * r * (mu * mu - 1) + a.topRadius * a.topRadius));
}
export function distanceToBottom(r, mu, a = ATMOSPHERE) {
  return Math.max(0, -r * mu - safeSqrt(r * r * (mu * mu - 1) + a.bottomRadius * a.bottomRadius));
}
export function hitsGround(r, mu, a = ATMOSPHERE) {
  return mu < 0 && r * r * (mu * mu - 1) + a.bottomRadius * a.bottomRadius >= 0;
}

// Optical depth (per channel) along a ray of the given length, by the midpoint rule.
export function opticalDepth(r, mu, length, steps = 100, a = ATMOSPHERE) {
  const dt = length / steps;
  let rayleigh = 0,
    mie = 0,
    ozone = 0;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) * dt,
      h = Math.max(0, Math.sqrt(t * t + 2 * r * mu * t + r * r) - a.bottomRadius);
    rayleigh += Math.exp(-h / a.rayleighScaleHeight);
    mie += Math.exp(-h / a.mieScaleHeight);
    ozone += Math.max(0, 1 - Math.abs(h - a.ozoneCenter) / a.ozoneHalfWidth);
  }
  return [0, 1, 2].map(
    (c) => (a.rayleighScattering[c] * rayleigh + (a.mieScattering[c] + a.mieAbsorption[c]) * mie + a.ozoneAbsorption[c] * ozone) * dt
  );
}

// Transmittance from a point at radius r along direction cosine mu to the top of the atmosphere.
// Rays that meet the ground are fully blocked.
export function transmittanceToTop(r, mu, a = ATMOSPHERE, steps = 100) {
  if (hitsGround(r, mu, a)) return [0, 0, 0];
  return opticalDepth(r, mu, distanceToTop(r, mu, a), steps, a).map((d) => Math.exp(-d));
}

// ── The transmittance table's parameterization (Bruneton 2017) ───────────────────────────────────
const unitToTexel = (x, size) => 0.5 / size + x * (1 - 1 / size);
const texelToUnit = (u, size) => (u - 0.5 / size) / (1 - 1 / size);

export function transmittanceUv(r, mu, width, height, a = ATMOSPHERE) {
  const H = Math.sqrt(a.topRadius * a.topRadius - a.bottomRadius * a.bottomRadius),
    rho = safeSqrt(r * r - a.bottomRadius * a.bottomRadius),
    d = distanceToTop(r, mu, a),
    dMin = a.topRadius - r,
    dMax = rho + H;
  return [unitToTexel(clamp((d - dMin) / (dMax - dMin), 0, 1), width), unitToTexel(clamp(rho / H, 0, 1), height)];
}
export function transmittanceRMu(u, v, width, height, a = ATMOSPHERE) {
  const xMu = texelToUnit(u, width),
    xR = texelToUnit(v, height),
    H = Math.sqrt(a.topRadius * a.topRadius - a.bottomRadius * a.bottomRadius),
    rho = H * xR,
    r = Math.sqrt(rho * rho + a.bottomRadius * a.bottomRadius),
    dMin = a.topRadius - r,
    dMax = rho + H,
    d = dMin + xMu * (dMax - dMin),
    mu = d === 0 ? 1 : clamp((H * H - rho * rho - d * d) / (2 * r * d), -1, 1);
  return [r, mu];
}

// A small CPU table with bilinear lookups, the same mapping the GPU table uses.
export function buildTransmittanceTable(width = 48, height = 24, a = ATMOSPHERE, steps = 50) {
  const data = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [r, mu] = transmittanceRMu((x + 0.5) / width, (y + 0.5) / height, width, height, a),
        t = opticalDepth(r, mu, distanceToTop(r, mu, a), steps, a);
      for (let c = 0; c < 3; c++) data[(y * width + x) * 3 + c] = Math.exp(-t[c]);
    }
  return { width, height, data };
}
function bilinear(table, u, v) {
  const { width, height, data } = table,
    x = clamp(u * width - 0.5, 0, width - 1),
    y = clamp(v * height - 0.5, 0, height - 1),
    x0 = Math.floor(x),
    y0 = Math.floor(y),
    x1 = Math.min(width - 1, x0 + 1),
    y1 = Math.min(height - 1, y0 + 1),
    fx = x - x0,
    fy = y - y0,
    out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = data[(y0 * width + x0) * 3 + c],
      b = data[(y0 * width + x1) * 3 + c],
      d = data[(y1 * width + x0) * 3 + c],
      e = data[(y1 * width + x1) * 3 + c];
    out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
  }
  return out;
}
export function sampleTransmittance(table, r, mu, a = ATMOSPHERE) {
  const [u, v] = transmittanceUv(r, mu, table.width, table.height, a);
  return bilinear(table, u, v);
}

// ── Phase functions ──────────────────────────────────────────────────────────────────────────────
export const rayleighPhase = (cosine) => (3 / (16 * PI)) * (1 + cosine * cosine);
// Cornette–Shanks, the Henyey–Greenstein variant Bruneton and Hillaire use for aerosols.
export function miePhase(cosine, g = ATMOSPHERE.mieG) {
  const k = (3 / (8 * PI)) * ((1 - g * g) / (2 + g * g));
  return (k * (1 + cosine * cosine)) / Math.pow(Math.max(1e-4, 1 + g * g - 2 * g * cosine), 1.5);
}
export function henyeyGreenstein(cosine, g) {
  return (1 - g * g) / (4 * PI * Math.pow(Math.max(1e-4, 1 + g * g - 2 * g * cosine), 1.5));
}

// ── Scattering along one ray (Hillaire's IntegrateScatteredLuminance) ───────────────────────────
// Points are in a local frame with +y up through the planet's centre at the origin.
function raySphere(origin, direction, radius) {
  const b = origin[0] * direction[0] + origin[1] * direction[1] + origin[2] * direction[2],
    c = origin[0] ** 2 + origin[1] ** 2 + origin[2] ** 2 - radius * radius,
    disc = b * b - c;
  if (disc < 0) return [-1, -1];
  const s = Math.sqrt(disc);
  return [-b - s, -b + s];
}

// Single scattering with the sun's and the multiple-scattering source along a view ray from a point
// `altitude` km above the ground. `multiple(r, muSun)` returns Ψ_ms (or null to omit it); `phases`
// false uses the isotropic phase (the multiple-scattering table's own integrand). `quadratic` spaces
// the samples as (i/N)², Hillaire's distribution for view rays, so a ray grazing the horizon samples
// the dense air near the coast finely and the thin air far along it coarsely.
const NO_LIGHT = [0, 0, 0];
export function integrateRay(
  tables,
  altitude,
  viewDir,
  sunDir,
  { steps = 30, multiple = null, phases = true, ground = false, quadratic = true, a = ATMOSPHERE } = {}
) {
  const origin = [0, a.bottomRadius + altitude, 0],
    top = raySphere(origin, viewDir, a.topRadius),
    bottom = raySphere(origin, viewDir, a.bottomRadius);
  const result = { radiance: [0, 0, 0], transmittance: [1, 1, 1], multipleAsOne: [0, 0, 0] };
  if (top[1] < 0) return result;
  const start = Math.max(0, top[0]);
  let end = top[1];
  const hitGround = bottom[0] > 0;
  if (hitGround) end = Math.min(end, bottom[0]);
  const cosine = viewDir[0] * sunDir[0] + viewDir[1] * sunDir[1] + viewDir[2] * sunDir[2],
    phaseR = phases ? rayleighPhase(cosine) : 1 / (4 * PI),
    phaseM = phases ? miePhase(cosine, a.mieG) : 1 / (4 * PI),
    length = end - start,
    bottomSquared = a.bottomRadius * a.bottomRadius;
  const throughput = [1, 1, 1];
  for (let i = 0; i < steps; i++) {
    const s0 = quadratic ? (i / steps) ** 2 : i / steps,
      s1 = quadratic ? ((i + 1) / steps) ** 2 : (i + 1) / steps,
      dt = (s1 - s0) * length,
      t = start + 0.5 * (s0 + s1) * length,
      px = origin[0] + viewDir[0] * t,
      py = origin[1] + viewDir[1] * t,
      pz = origin[2] + viewDir[2] * t,
      r = Math.sqrt(px * px + py * py + pz * pz),
      muSun = (px * sunDir[0] + py * sunDir[1] + pz * sunDir[2]) / r,
      h = Math.max(0, r - a.bottomRadius),
      dR = Math.exp(-h / a.rayleighScaleHeight),
      dM = Math.exp(-h / a.mieScaleHeight),
      dO = Math.max(0, 1 - Math.abs(h - a.ozoneCenter) / a.ozoneHalfWidth),
      // The planet's shadow: the ray toward the sun meets the ground (Hillaire's earthShadow).
      shadow = muSun < 0 && r * r * (muSun * muSun - 1) + bottomSquared >= 0 ? 0 : 1,
      toSun = shadow ? sampleTransmittance(tables.transmittance, r, muSun, a) : NO_LIGHT,
      psi = multiple ? multiple(r, muSun) : NO_LIGHT;
    for (let c = 0; c < 3; c++) {
      const sR = a.rayleighScattering[c] * dR,
        sM = a.mieScattering[c] * dM,
        scattering = sR + sM,
        extinction = scattering + a.mieAbsorption[c] * dM + a.ozoneAbsorption[c] * dO,
        sample = Math.exp(-extinction * dt),
        source = shadow * toSun[c] * (sR * phaseR + sM * phaseM) + psi[c] * scattering,
        // Frostbite's energy-conserving step integral (Hillaire 2015, slide 28).
        integral = extinction > 0 ? (1 - sample) / extinction : dt;
      result.radiance[c] += throughput[c] * source * integral;
      result.multipleAsOne[c] += throughput[c] * scattering * integral;
      throughput[c] *= sample;
    }
  }
  if (ground && hitGround) {
    const p = [origin[0] + viewDir[0] * end, origin[1] + viewDir[1] * end, origin[2] + viewDir[2] * end],
      r = Math.hypot(p[0], p[1], p[2]),
      muSun = (p[0] * sunDir[0] + p[1] * sunDir[1] + p[2] * sunDir[2]) / r,
      toSun = sampleTransmittance(tables.transmittance, r, muSun, a);
    for (let c = 0; c < 3; c++) result.radiance[c] += (throughput[c] * toSun[c] * Math.max(0, muSun) * a.groundAlbedo[c]) / PI;
  }
  result.transmittance = throughput;
  return result;
}

// Ψ_ms, Hillaire's equation 10: second-order light from an isotropic sphere of directions, summed
// over all further orders as a geometric series 1/(1 - f_ms). The table's axes are warped toward
// the horizon and the ground (u = ½ + ½·sign(μ)·√|μ|, v = √(h/H)), where Ψ_ms changes fastest and
// where the coast's light is decided; Hillaire's table is linear in both, which a twilight sky
// sampled from a small table showed as errors of up to 2.3 times.
export const msUv = (r, muSun, a = ATMOSPHERE) => [
  0.5 + 0.5 * Math.sign(muSun) * Math.sqrt(Math.min(1, Math.abs(muSun))),
  Math.sqrt(clamp((r - a.bottomRadius) / (a.topRadius - a.bottomRadius), 0, 1)),
];
export function buildMultipleScatteringTable(transmittance, size = 24, sqrtDirections = 4, steps = 10, a = ATMOSPHERE, rows = 8) {
  const data = new Float32Array(size * rows * 3),
    tables = { transmittance },
    count = sqrtDirections * sqrtDirections;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < size; x++) {
      const s = texelToUnit((x + 0.5) / size, size) * 2 - 1,
        muSun = Math.sign(s) * s * s,
        w = texelToUnit((y + 0.5) / rows, rows),
        altitude = Math.max(0.001, w * w * (a.topRadius - a.bottomRadius)),
        sun = [Math.sqrt(Math.max(0, 1 - muSun * muSun)), muSun, 0],
        light = [0, 0, 0],
        fms = [0, 0, 0];
      for (let i = 0; i < sqrtDirections; i++)
        for (let j = 0; j < sqrtDirections; j++) {
          const theta = (2 * PI * (i + 0.5)) / sqrtDirections,
            phi = Math.acos(1 - (2 * (j + 0.5)) / sqrtDirections),
            dir = [Math.cos(theta) * Math.sin(phi), Math.cos(phi), Math.sin(theta) * Math.sin(phi)],
            ray = integrateRay(tables, altitude, dir, sun, { steps, phases: false, ground: true, quadratic: false, a });
          for (let c = 0; c < 3; c++) {
            light[c] += ray.radiance[c] / count;
            fms[c] += ray.multipleAsOne[c] / count;
          }
        }
      for (let c = 0; c < 3; c++) data[(y * size + x) * 3 + c] = light[c] / (1 - Math.min(0.99, fms[c]));
    }
  return { width: size, height: rows, data };
}
export function sampleMultipleScattering(table, r, muSun, a = ATMOSPHERE) {
  const [x, y] = msUv(r, muSun, a);
  return bilinear(table, unitToTexel(x, table.width), unitToTexel(y, table.height));
}

let cpuTables = null;
// The CPU's tables, built once on first use (about 10 ms): enough for the light colours and the tests.
export function atmosphereTables() {
  if (!cpuTables) {
    const transmittance = buildTransmittanceTable();
    cpuTables = { transmittance, multiple: buildMultipleScatteringTable(transmittance) };
  }
  return cpuTables;
}

// Sky radiance per unit solar illuminance seen from `altitude` km toward `viewDir` with the sun
// toward `sunDir` (both unit vectors in the scene frame, +y up).
export function skyRadiance(viewDir, sunDir, { altitude = 0.03, steps = 30, tables = atmosphereTables() } = {}) {
  const multiple = (r, muSun) => sampleMultipleScattering(tables.multiple, r, muSun);
  return integrateRay(tables, altitude, viewDir, sunDir, { steps, multiple }).radiance;
}

// The direct sun's transmittance at the coast for a true solar elevation (radians), along the
// refracted ray. Zero once the disc is below the sea horizon.
export function sunTransmittance(elevation, { altitude = 0.03 } = {}) {
  const r = ATMOSPHERE.bottomRadius + altitude;
  return transmittanceToTop(r, Math.sin(elevation + refraction(elevation)));
}

// ── Refraction and the visible disc ─────────────────────────────────────────────────────────────
// Sæmundsson's formula for the refraction (radians) added to a true altitude (radians), at 10 °C and
// 1010 hPa; Bennett's inverse gives the true altitude of an apparent one. Both from Meeus,
// Astronomical Algorithms (2nd ed.), chapter 16.
export function refraction(trueAltitude) {
  const h = Math.max(-1.5, trueAltitude / DEG);
  const minutes = 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG);
  return Math.max(0, minutes / 60) * DEG;
}
export function unrefract(apparentAltitude) {
  const h = Math.max(-1.0, apparentAltitude / DEG);
  const minutes = 1 / Math.tan((h + 7.31 / (h + 4.4)) * DEG);
  return apparentAltitude - Math.max(0, minutes / 60) * DEG;
}

// NOAA's sunrise and sunset put the true centre at 90.833 degrees from the zenith: the upper limb on
// the horizon after 34' of refraction and a 16' semidiameter.
export const SUNSET_ALTITUDE = -0.833 * DEG;

// ── The Moon (Astronomical Almanac's low-precision series, good to about 0.3 degrees) ────────────
const julian = (utcMilliseconds) => utcMilliseconds / 86400000 + 2440587.5;
const deg = (x) => x * DEG;
const wrap = (x) => ((x % 360) + 360) % 360;

// Unit vectors in the scene frame (+X north, +Y up, +Z east) for the Moon and the Sun at a UTC
// instant over a site, with the Moon's illuminated fraction and topocentric parallax.
export function moonPosition(utcMilliseconds, site = { latitude: 32.83, longitude: -117.27 }) {
  const jd = julian(utcMilliseconds),
    T = (jd - 2451545.0) / 36525;
  const lambda =
    218.32 +
    481267.881 * T +
    6.29 * Math.sin(deg(135.0 + 477198.87 * T)) -
    1.27 * Math.sin(deg(259.3 - 413335.36 * T)) +
    0.66 * Math.sin(deg(235.7 + 890534.22 * T)) +
    0.21 * Math.sin(deg(269.9 + 954397.74 * T)) -
    0.19 * Math.sin(deg(357.5 + 35999.05 * T)) -
    0.11 * Math.sin(deg(186.5 + 966404.03 * T));
  const beta =
    5.13 * Math.sin(deg(93.3 + 483202.02 * T)) +
    0.28 * Math.sin(deg(228.2 + 960400.89 * T)) -
    0.28 * Math.sin(deg(318.3 + 6003.15 * T)) -
    0.17 * Math.sin(deg(217.6 - 407332.21 * T));
  const parallax =
    0.9508 +
    0.0518 * Math.cos(deg(135.0 + 477198.87 * T)) +
    0.0095 * Math.cos(deg(259.3 - 413335.36 * T)) +
    0.0078 * Math.cos(deg(235.7 + 890534.22 * T)) +
    0.0028 * Math.cos(deg(269.9 + 954397.74 * T));
  // The Sun's apparent longitude (Meeus, chapter 25, low accuracy).
  const L0 = 280.46646 + 36000.76983 * T,
    M = 357.52911 + 35999.05029 * T,
    sunLambda = L0 + (1.914602 - 0.004817 * T) * Math.sin(deg(M)) + 0.019993 * Math.sin(deg(2 * M));
  const epsilon = 23.439291 - 0.0130042 * T;
  const equatorial = (lon, lat) => {
    const l = deg(lon),
      b = deg(lat),
      e = deg(epsilon);
    return {
      ra: Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)),
      dec: Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)),
    };
  };
  // Greenwich mean sidereal time (Meeus 12.4) and the local hour angle.
  const gmst = wrap(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T),
    lst = deg(gmst + site.longitude),
    latitude = deg(site.latitude);
  const horizontal = ({ ra, dec }) => {
    const H = lst - ra,
      up = Math.sin(latitude) * Math.sin(dec) + Math.cos(latitude) * Math.cos(dec) * Math.cos(H),
      north = Math.cos(latitude) * Math.sin(dec) - Math.sin(latitude) * Math.cos(dec) * Math.cos(H),
      east = -Math.cos(dec) * Math.sin(H);
    return [north, up, east];
  };
  const moonDir = horizontal(equatorial(lambda, beta)),
    sunDir = horizontal(equatorial(sunLambda, 0));
  // Topocentric correction: the Moon sits lower by its parallax times the cosine of its altitude.
  const geocentricAltitude = Math.asin(clamp(moonDir[1], -1, 1)),
    altitude = geocentricAltitude - deg(parallax) * Math.cos(geocentricAltitude),
    horizontalLength = Math.hypot(moonDir[0], moonDir[2]) || 1,
    topocentric = [(moonDir[0] / horizontalLength) * Math.cos(altitude), Math.sin(altitude), (moonDir[2] / horizontalLength) * Math.cos(altitude)];
  const elongation = Math.acos(clamp(Math.cos(deg(beta)) * Math.cos(deg(lambda - sunLambda)), -1, 1));
  return {
    direction: topocentric,
    altitude,
    sunDirection: sunDir,
    illumination: (1 - Math.cos(elongation)) / 2,
    // Waxing while the Moon's longitude leads the Sun's by less than 180 degrees.
    waxing: wrap(lambda - sunLambda) < 180,
    elongation,
  };
}

// ── Weather moods, deterministic from the date ──────────────────────────────────────────────────
// La Jolla's marine layer: May Gray and June Gloom mornings, with low cloud that burns off by late
// morning and returns on some evenings; high cloud gives the best sunsets in autumn and winter.
// The monthly chances are authored to follow that well-known seasonal shape (low cloud most often
// from May to July, least in winter), not fitted to a station record. Each day draws from a hash of
// its date, so every visitor and every test sees the same weather on the same day.
const MARINE_CHANCE = [0.18, 0.2, 0.28, 0.42, 0.62, 0.7, 0.52, 0.4, 0.32, 0.26, 0.18, 0.16];
const CIRRUS_CHANCE = [0.42, 0.42, 0.38, 0.3, 0.2, 0.14, 0.16, 0.2, 0.26, 0.36, 0.42, 0.44];
function dateHash(text, salt) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
export function weatherFor(dateKey) {
  const month = Math.max(1, Math.min(12, Number(dateKey.slice(5, 7)) || 1)) - 1,
    marineDraw = dateHash(dateKey, 17),
    cirrusDraw = dateHash(dateKey, 91),
    marine = marineDraw < MARINE_CHANCE[month] ? 0.55 + 0.45 * dateHash(dateKey, 5) : 0,
    cirrus = cirrusDraw < CIRRUS_CHANCE[month] ? 0.35 + 0.65 * dateHash(dateKey, 23) : 0.08 * dateHash(dateKey, 29);
  return {
    // How thick the morning marine layer is (0 clear), and whether it returns in the evening.
    marine,
    eveningMarine: marine > 0 && dateHash(dateKey, 41) < 0.45,
    // High cloud cover for the sunset (0 to 1).
    cirrus,
    // A fixed drift direction and phase for the day's cloud field.
    seed: dateHash(dateKey, 7),
  };
}
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// The marine layer's thickness at a minute of the day: thick from before dawn, burning off between
// 10:00 and 11:30, and on some days returning after 18:30 with the evening's cooling.
export function marineLayerAt(weather, minute) {
  if (!weather.marine) return 0;
  const morning = 1 - smooth(600, 690, minute) + smooth(1380, 1439, minute) * 0.6;
  const evening = weather.eveningMarine ? smooth(1110, 1200, minute) : 0;
  return clamp(Math.max(morning, evening), 0, 1) * weather.marine;
}

// The fog bank's top above the sea (m) for a marine-layer thickness: a shallow bank that hugs the
// water when thin and at its thickest reaches the terrace at the lower floor (7.35 m above the sea),
// with billows (haze.mjs) climbing the cliff a few metres above that.
export const marineTop = (thickness) => 2 + 9 * Math.max(0, Math.min(1, thickness));

// A periodic 3D value-noise volume (two octaves, `size` cells per period) for the fog's billows,
// as bytes. Cheap enough to build when the scene starts (32³ is 32 768 voxels).
export function fogNoiseVolume(size = 32, seed = 7) {
  const lattice = (x, y, z, period) => {
    let h = (((x % period) + period) % period) * 73856093;
    h ^= (((y % period) + period) % period) * 19349663;
    h ^= (((z % period) + period) % period) * 83492791;
    h ^= seed * 2654435761;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const fade = (t) => t * t * (3 - 2 * t);
  const octave = (x, y, z, cells) => {
    const s = cells / size,
      fx = x * s,
      fy = y * s,
      fz = z * s,
      ix = Math.floor(fx),
      iy = Math.floor(fy),
      iz = Math.floor(fz),
      tx = fade(fx - ix),
      ty = fade(fy - iy),
      tz = fade(fz - iz);
    let value = 0;
    for (let c = 0; c < 8; c++) {
      const dx = c & 1,
        dy = (c >> 1) & 1,
        dz = (c >> 2) & 1;
      value += lattice(ix + dx, iy + dy, iz + dz, cells) * (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz);
    }
    return value;
  };
  const data = new Uint8Array(size * size * size);
  for (let z = 0; z < size; z++)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const n = 0.65 * octave(x, y, z, size / 4) + 0.35 * octave(x, y, z, size / 2);
        data[(z * size + y) * size + x] = Math.round(255 * n);
      }
  return data;
}

// ── Light for the scene ─────────────────────────────────────────────────────────────────────────
const luminance = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// The eye adapts as the light fails. Without it a fixed exposure turns civil twilight black; with
// full adaptation the evening would look like noon. This gain lifts natural light (sun, sky, haze,
// moon and stars) by a stop at sunrise and sunset, easing to none by 20 degrees, about 5.4 stops
// three degrees after sunset, 6.6 at the end of civil twilight and 9.1 by nautical dusk, leaving the
// house's lamps at their authored brightness, so the blue hour reads as dusk with the lamps glowing. The stops follow the fall of twilight's sky luminance less
// two to three stops, a photographer's bracketing rather than a full photopic adaptation.
// Below the horizon the lift is taken from the model itself: the zenith, as the eye sees it, darkens
// by a steady 0.42 stop for each degree the sun sinks, so twilight never brightens on its way down.
let twilightStops = null;
function twilightLift(depression) {
  if (!twilightStops) {
    const zenith = (h) => luminance(skyRadiance([0, 1, 0], [-0.22 * Math.cos(h * DEG), Math.sin(h * DEG), -0.97 * Math.cos(h * DEG)])),
      reference = zenith(0);
    let lift = 0;
    twilightStops = Array.from({ length: 13 }, (_, i) => (lift = Math.max(lift, Math.log2(reference / Math.max(zenith(-i), 1e-12)) - 0.42 * i)));
  }
  const d = Math.min(12, Math.max(0, depression)),
    i = Math.min(11, Math.floor(d));
  return twilightStops[i] + (twilightStops[i + 1] - twilightStops[i]) * (d - i);
}
// The lift stops at 9.3 stops: past nautical dusk the CPU table's twilight is too coarse to follow
// (it overshot to 12 stops and brightened the sky after 18:45), and the authored night has taken over.
export function adaptationGain(sunAltitude) {
  const h = sunAltitude / DEG;
  if (h >= 20) return 1;
  return 2 ** (h >= 0 ? (1 - h / 20) ** 2 : Math.min(9.3, 1 + twilightLift(-h)));
}

// The night sky that remains once twilight is gone: authored, not physical (a moonless night is
// a million times darker than day), about as bright as the house's former night sky so the cliff and
// the sea stay legible. A moonlit night is a little bluer and brighter.
export function nightSky(moonUp, illumination) {
  const moon = moonUp * (0.35 + 0.65 * illumination);
  return {
    zenith: [0.0077 + 0.0066 * moon, 0.0136 + 0.0132 * moon, 0.036 + 0.026 * moon],
    horizon: [0.035 + 0.026 * moon, 0.053 + 0.035 * moon, 0.097 + 0.053 * moon],
  };
}

export { luminance };
