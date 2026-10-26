// The footer coast's sky as a scattering atmosphere, physically based after Sébastien Hillaire, "A
// Scalable and Production Ready Sky and Atmosphere Rendering Technique" (EGSR 2020, Computer
// Graphics Forum 39(4)): a transmittance table, a multiple-scattering table (his equation 10, all
// orders as a geometric series) and a sky-view table of radiance over the directions the frieze
// shows, re-integrated only when the sun moves. The planet, the media and the transmittance table's
// parameterization follow Eric Bruneton and Fabrice Neyret, "Precomputed Atmospheric Scattering"
// (EGSR 2008), and Bruneton's 2017 reference implementation (BSD 3-Clause). The equations are
// implemented here; no code is copied. assets/js/home-scene/atmosphere-model.mjs runs the same
// model for the 3D home with its own tables; this file is the footer's small, self-contained copy.
//
// Pure functions with no three.js or DOM, so node tests can check the physics. Units: kilometres
// inside the atmosphere, radians for angles, radiance per unit solar irradiance.
//
// The tables are tiny and built on the CPU (about 5 ms at start). A sky view takes a few
// milliseconds and is rebuilt only when the sun moves (once a minute on the clock), so a steady
// frame costs one texture lookup per sky pixel.

export const DEG = Math.PI / 180;

// The Earth of Bruneton's reference, with La Jolla's marine air: sea-salt aerosol under the
// inversion, an optical depth of about 0.06 at 550 nm (Bruneton's default is 0.004), Ångström
// exponent 0.4 and single-scattering albedo 0.96. Ozone's Chappuis band (Hillaire's values) keeps
// the blue hour blue.
export const ATMOSPHERE = Object.freeze({
  bottomRadius: 6360,
  topRadius: 6460,
  rayleighScattering: [5.802e-3, 13.558e-3, 33.1e-3],
  rayleighScaleHeight: 8,
  mieScattering: [0.0445, 0.0485, 0.053],
  mieAbsorption: [0.0019, 0.002, 0.0022],
  mieScaleHeight: 1.2,
  mieG: 0.76,
  ozoneAbsorption: [0.65e-3, 1.881e-3, 0.085e-3],
  ozoneCenter: 25,
  ozoneHalfWidth: 15,
  groundAlbedo: [0.06, 0.07, 0.08],
});

const PI = Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const safeSqrt = (x) => Math.sqrt(Math.max(0, x));

// ── Geometry (Bruneton 2017) ─────────────────────────────────────────────────────────────────────
function distanceToTop(r, mu, a) {
  return Math.max(0, -r * mu + safeSqrt(r * r * (mu * mu - 1) + a.topRadius * a.topRadius));
}
function hitsGround(r, mu, a) {
  return mu < 0 && r * r * (mu * mu - 1) + a.bottomRadius * a.bottomRadius >= 0;
}

// ── Transmittance to the top of the atmosphere, tabled over (r, mu) ──────────────────────────────
const unitToTexel = (x, size) => 0.5 / size + x * (1 - 1 / size);
const texelToUnit = (u, size) => (u - 0.5 / size) / (1 - 1 / size);

function transmittanceRMu(u, v, w, h, a) {
  const H = Math.sqrt(a.topRadius * a.topRadius - a.bottomRadius * a.bottomRadius),
    rho = H * texelToUnit(v, h),
    r = Math.sqrt(rho * rho + a.bottomRadius * a.bottomRadius),
    dMin = a.topRadius - r,
    dMax = rho + H,
    d = dMin + texelToUnit(u, w) * (dMax - dMin),
    mu = d === 0 ? 1 : clamp((H * H - rho * rho - d * d) / (2 * r * d), -1, 1);
  return [r, mu];
}

function extinction(h, a, out) {
  const dR = Math.exp(-h / a.rayleighScaleHeight),
    dM = Math.exp(-h / a.mieScaleHeight),
    dO = Math.max(0, 1 - Math.abs(h - a.ozoneCenter) / a.ozoneHalfWidth);
  for (let c = 0; c < 3; c++) out[c] = a.rayleighScattering[c] * dR + (a.mieScattering[c] + a.mieAbsorption[c]) * dM + a.ozoneAbsorption[c] * dO;
  return out;
}

export function buildTransmittance(a = ATMOSPHERE, width = 64, height = 16, steps = 40) {
  const data = new Float32Array(width * height * 3),
    e = [0, 0, 0];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [r, mu] = transmittanceRMu((x + 0.5) / width, (y + 0.5) / height, width, height, a),
        length = distanceToTop(r, mu, a),
        dt = length / steps,
        depth = [0, 0, 0];
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) * dt,
          h = Math.max(0, Math.sqrt(t * t + 2 * r * mu * t + r * r) - a.bottomRadius);
        extinction(h, a, e);
        for (let c = 0; c < 3; c++) depth[c] += e[c] * dt;
      }
      for (let c = 0; c < 3; c++) data[(y * width + x) * 3 + c] = Math.exp(-depth[c]);
    }
  return { width, height, data };
}

function bilinear(table, u, v, out) {
  const { width, height, data } = table,
    x = clamp(u * width - 0.5, 0, width - 1),
    y = clamp(v * height - 0.5, 0, height - 1),
    x0 = Math.floor(x),
    y0 = Math.floor(y),
    x1 = Math.min(width - 1, x0 + 1),
    y1 = Math.min(height - 1, y0 + 1),
    fx = x - x0,
    fy = y - y0;
  for (let c = 0; c < 3; c++) {
    const p = data[(y0 * width + x0) * 3 + c],
      q = data[(y0 * width + x1) * 3 + c],
      s = data[(y1 * width + x0) * 3 + c],
      t = data[(y1 * width + x1) * 3 + c];
    out[c] = (p * (1 - fx) + q * fx) * (1 - fy) + (s * (1 - fx) + t * fx) * fy;
  }
  return out;
}

// Transmittance from radius r toward direction cosine mu, to the top; zero through the ground.
// Allocation-free: it runs for every sample of every ray.
export function transmittance(tables, r, mu, out = [0, 0, 0]) {
  const a = tables.atmosphere,
    table = tables.transmittance;
  if (hitsGround(r, mu, a)) return out.fill(0);
  const rho = safeSqrt(r * r - a.bottomRadius * a.bottomRadius),
    d = distanceToTop(r, mu, a),
    dMin = a.topRadius - r,
    dMax = rho + tables.H;
  return bilinear(
    table,
    unitToTexel(clamp((d - dMin) / (dMax - dMin), 0, 1), table.width),
    unitToTexel(clamp(rho / tables.H, 0, 1), table.height),
    out
  );
}

// ── Phase functions ──────────────────────────────────────────────────────────────────────────────
const rayleighPhase = (c) => (3 / (16 * PI)) * (1 + c * c);
// Cornette-Shanks, as Bruneton and Hillaire use for aerosols.
function miePhase(c, g) {
  const k = (3 / (8 * PI)) * ((1 - g * g) / (2 + g * g));
  return (k * (1 + c * c)) / Math.pow(Math.max(1e-4, 1 + g * g - 2 * g * c), 1.5);
}

// ── Scattering along one view ray (Hillaire's IntegrateScatteredLuminance) ───────────────────────
// The view starts `altitude` km above the sea at the planet's top (+y up); sun and view are unit
// vectors there. `multiple(r, muSun, out)` gives Ψ_ms, or null; `isotropic` uses the 1/4π phase of
// the multiple-scattering table's own integrand.
function integrate(tables, altitude, view, sun, { steps = 24, multiple = null, isotropic = false, ground = false } = {}) {
  const a = tables.atmosphere,
    r0 = a.bottomRadius + altitude,
    b = r0 * view[1],
    cTop = r0 * r0 - a.topRadius * a.topRadius,
    discTop = b * b - cTop;
  const out = { radiance: [0, 0, 0], transmittance: [1, 1, 1], multipleAsOne: [0, 0, 0] };
  if (discTop < 0) return out;
  let end = -b + Math.sqrt(discTop);
  const discGround = b * b - (r0 * r0 - a.bottomRadius * a.bottomRadius),
    groundT = discGround >= 0 ? -b - Math.sqrt(discGround) : -1,
    hitGround = groundT > 0;
  if (hitGround) end = Math.min(end, groundT);
  const cosine = view[0] * sun[0] + view[1] * sun[1] + view[2] * sun[2],
    phaseR = isotropic ? 1 / (4 * PI) : rayleighPhase(cosine),
    phaseM = isotropic ? 1 / (4 * PI) : miePhase(cosine, a.mieG),
    throughput = [1, 1, 1],
    toSun = [0, 0, 0],
    psi = [0, 0, 0],
    bottom2 = a.bottomRadius * a.bottomRadius;
  for (let i = 0; i < steps; i++) {
    // Quadratic spacing: fine near the eye, where the dense air near the sea is.
    const s0 = (i / steps) ** 2,
      s1 = ((i + 1) / steps) ** 2,
      dt = (s1 - s0) * end,
      t = 0.5 * (s0 + s1) * end,
      px = view[0] * t,
      py = r0 + view[1] * t,
      pz = view[2] * t,
      r = Math.sqrt(px * px + py * py + pz * pz),
      muSun = (px * sun[0] + py * sun[1] + pz * sun[2]) / r,
      h = Math.max(0, r - a.bottomRadius),
      dR = Math.exp(-h / a.rayleighScaleHeight),
      dM = Math.exp(-h / a.mieScaleHeight),
      dO = Math.max(0, 1 - Math.abs(h - a.ozoneCenter) / a.ozoneHalfWidth),
      // The planet's shadow (Hillaire's earthShadow): the ray to the sun meets the ground.
      lit = muSun < 0 && r * r * (muSun * muSun - 1) + bottom2 >= 0 ? 0 : 1;
    if (lit) transmittance(tables, r, muSun, toSun);
    if (multiple) multiple(r, muSun, psi);
    for (let c = 0; c < 3; c++) {
      const sR = a.rayleighScattering[c] * dR,
        sM = a.mieScattering[c] * dM,
        scattering = sR + sM,
        ext = scattering + a.mieAbsorption[c] * dM + a.ozoneAbsorption[c] * dO,
        sample = Math.exp(-ext * dt),
        source = (lit ? toSun[c] * (sR * phaseR + sM * phaseM) : 0) + (multiple ? psi[c] * scattering : 0),
        // Frostbite's energy-conserving step (Hillaire 2015).
        step = ext > 0 ? (1 - sample) / ext : dt;
      out.radiance[c] += throughput[c] * source * step;
      out.multipleAsOne[c] += throughput[c] * scattering * step;
      throughput[c] *= sample;
    }
  }
  if (ground && hitGround && end === groundT) {
    const px = view[0] * end,
      py = r0 + view[1] * end,
      pz = view[2] * end,
      r = Math.hypot(px, py, pz),
      muSun = (px * sun[0] + py * sun[1] + pz * sun[2]) / r;
    transmittance(tables, r, muSun, toSun);
    for (let c = 0; c < 3; c++) out.radiance[c] += (throughput[c] * toSun[c] * Math.max(0, muSun) * a.groundAlbedo[c]) / PI;
  }
  out.transmittance = throughput;
  return out;
}

// Ψ_ms (Hillaire's equation 10) over (sun zenith cosine, altitude). The axes are warped toward the
// horizon and the ground (u = ½ + ½·sign(μ)·√|μ|, v = √(h/H)), where twilight is decided.
export function buildMultipleScattering(tables, size = 16, rows = 8, sqrtDirections = 4, steps = 12) {
  const a = tables.atmosphere,
    data = new Float32Array(size * rows * 3),
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
            ray = integrate(tables, altitude, dir, sun, { steps, isotropic: true, ground: true });
          for (let c = 0; c < 3; c++) {
            light[c] += ray.radiance[c] / count;
            fms[c] += ray.multipleAsOne[c] / count;
          }
        }
      for (let c = 0; c < 3; c++) data[(y * size + x) * 3 + c] = light[c] / (1 - Math.min(0.99, fms[c]));
    }
  return { width: size, height: rows, data };
}

// Build both tables once (an atmosphere may be passed for tests).
export function atmosphereTables(atmosphere = ATMOSPHERE) {
  const tables = {
    atmosphere,
    H: Math.sqrt(atmosphere.topRadius ** 2 - atmosphere.bottomRadius ** 2),
    transmittance: buildTransmittance(atmosphere),
  };
  tables.multiple = buildMultipleScattering(tables);
  return tables;
}
let shared = null;
export const defaultTables = () => (shared ??= atmosphereTables());

function multipleLookup(tables) {
  const a = tables.atmosphere,
    table = tables.multiple,
    span = a.topRadius - a.bottomRadius;
  return (r, muSun, out) => {
    const x = 0.5 + 0.5 * Math.sign(muSun) * Math.sqrt(Math.min(1, Math.abs(muSun))),
      y = Math.sqrt(clamp((r - a.bottomRadius) / span, 0, 1));
    return bilinear(table, unitToTexel(x, table.width), unitToTexel(y, table.height), out);
  };
}

// A direction from an elevation and an azimuth measured from the sun's (both radians): +y up, the
// sun's azimuth along +x.
export function direction(elevation, relativeAzimuth) {
  const c = Math.cos(elevation);
  return [c * Math.cos(relativeAzimuth), Math.sin(elevation), c * Math.sin(relativeAzimuth)];
}

// Sky radiance (per unit solar irradiance) toward an elevation and an azimuth from the sun's, seen
// from `altitude` km above the sea, with the sun at `sunElevation` (true, radians).
export function skyRadiance(elevation, relativeAzimuth, sunElevation, { altitude = 0.02, steps = 24, tables = defaultTables() } = {}) {
  const sun = direction(sunElevation, 0);
  return integrate(tables, altitude, direction(elevation, relativeAzimuth), sun, { steps, multiple: multipleLookup(tables) }).radiance;
}

// The sky-view table for one sun: radiance over the relative azimuth (columns, 0 to 180 degrees,
// spaced as the square root so the sun's aureole is resolved) and the view elevation (rows: below
// the horizon to -6 degrees, above it to the zenith, spaced as the square root toward the
// horizon, Hillaire's non-linear latitude). The sky is symmetric about the sun's vertical.
export const SKY_VIEW = Object.freeze({ columns: 48, rows: 28, below: 6 * DEG, horizonRow: 4 });
export const skyViewAzimuth = (u) => PI * u * u;
export const skyViewAzimuthU = (azimuth) => Math.sqrt(clamp(Math.abs(azimuth) / PI, 0, 1));
// Row coordinate v (0-1, texel centres at (i + .5)/rows) for an elevation, and back.
export function skyViewElevationV(elevation, layout = SKY_VIEW) {
  const h = layout.horizonRow / layout.rows;
  if (elevation < 0) return h * (1 - Math.sqrt(Math.min(1, -elevation / layout.below)));
  return h + (1 - h) * Math.sqrt(Math.min(1, elevation / (PI / 2)));
}
export function skyViewElevation(v, layout = SKY_VIEW) {
  const h = layout.horizonRow / layout.rows;
  if (v < h) return -layout.below * (1 - v / h) ** 2;
  return (PI / 2) * ((v - h) / (1 - h)) ** 2;
}
// `from` and `to` build only those rows, so a caller can spread a table over several tasks.
export function buildSkyView(sunElevation, { tables = defaultTables(), layout = SKY_VIEW, steps = 20, out, from = 0, to = layout.rows } = {}) {
  const { columns, rows } = layout,
    data = out ?? new Float32Array(columns * rows * 4),
    sun = direction(sunElevation, 0),
    multiple = multipleLookup(tables);
  for (let y = from; y < Math.min(to, rows); y++) {
    const elevation = skyViewElevation((y + 0.5) / rows, layout);
    for (let x = 0; x < columns; x++) {
      const azimuth = skyViewAzimuth((x + 0.5) / columns),
        ray = integrate(tables, 0.02, direction(elevation, azimuth), sun, { steps, multiple });
      const o = (y * columns + x) * 4;
      data[o] = ray.radiance[0];
      data[o + 1] = ray.radiance[1];
      data[o + 2] = ray.radiance[2];
      data[o + 3] = 1;
    }
  }
  return data;
}
// Sample a sky-view table as the GPU will (bilinear between texel centres).
export function sampleSkyView(data, elevation, relativeAzimuth, layout = SKY_VIEW, out = [0, 0, 0]) {
  const table = { width: layout.columns, height: layout.rows, data: null };
  const u = skyViewAzimuthU(relativeAzimuth),
    v = skyViewElevationV(elevation, layout),
    x = clamp(u * table.width - 0.5, 0, table.width - 1),
    y = clamp(v * table.height - 0.5, 0, table.height - 1),
    x0 = Math.floor(x),
    y0 = Math.floor(y),
    x1 = Math.min(table.width - 1, x0 + 1),
    y1 = Math.min(table.height - 1, y0 + 1),
    fx = x - x0,
    fy = y - y0;
  for (let c = 0; c < 3; c++) {
    const at = (i, j) => data[(j * table.width + i) * 4 + c];
    out[c] = (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) + (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy;
  }
  return out;
}

// ── Refraction (Meeus, Astronomical Algorithms, chapter 16: Sæmundsson and Bennett) ─────────────
export function refraction(trueAltitude) {
  const h = Math.max(-1.5, trueAltitude / DEG);
  return Math.max(0, 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG) / 60) * DEG;
}

// The direct sun at the coast: transmittance along the refracted ray from `altitude` km; zero once
// the disk is below that height's horizon.
export function sunTransmittance(trueElevation, { altitude = 0.02, tables = defaultTables() } = {}) {
  const a = tables.atmosphere,
    r = a.bottomRadius + altitude,
    apparent = trueElevation + refraction(trueElevation);
  return transmittance(tables, r, Math.sin(apparent), [0, 0, 0]);
}

// The horizon's dip below level for an eye `altitude` km up: the sun sets later on the hills.
export const horizonDip = (altitude, a = ATMOSPHERE) => Math.acos(a.bottomRadius / (a.bottomRadius + Math.max(0, altitude)));

// ── Light falling on the coast and the hills ──────────────────────────────────────────────────────
// Sky irradiance on a surface facing `normal` (elevation, relative azimuth of its normal), summed
// from a sky-view table over the hemisphere it faces, with the ground (dark sea) below. Per unit
// solar irradiance.
export function skyIrradiance(data, normalElevation, normalAzimuth, layout = SKY_VIEW) {
  const n = direction(normalElevation, normalAzimuth),
    out = [0, 0, 0],
    sample = [0, 0, 0];
  const E = 12,
    A = 24;
  for (let i = 0; i < E; i++) {
    const elevation = ((i + 0.5) / E) * (PI / 2),
      ring = Math.cos(elevation) * (PI / 2 / E) * ((2 * PI) / A);
    for (let j = 0; j < A; j++) {
      const azimuth = ((j + 0.5) / A) * 2 * PI - PI,
        d = direction(elevation, azimuth),
        cosine = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
      if (cosine <= 0) continue;
      sampleSkyView(data, elevation, azimuth, layout, sample);
      for (let c = 0; c < 3; c++) out[c] += sample[c] * cosine * ring;
    }
  }
  return out;
}

export const luminance = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
