import { RIPPLES, WATER_IOR } from "./ocean-spectrum.mjs";

// The Pacific's water as an optical medium (Sirui, 2026-10-18: "make 3d fluid ... better"). Clear and
// luminous over the sand at the cliff foot, deep and reflective offshore: the colour of the water comes
// from what it absorbs and scatters and from how much seabed the light reaches through it, not from a
// painted gradient. Three bands stand for the spectrum: red 650 nm, green 550 nm, blue 450 nm.
//
// - Absorption of pure water from Pope and Fry (1997), plus phytoplankton and dissolved organic matter
//   after the bio-optical relations Lee et al. (1998) use (their equations 12 to 15 and Table 2).
// - The water's reflectance over a seabed of albedo rho at depth H is Lee et al.'s semianalytical
//   shallow-water model (1998, equation 21): the deep-water term fades in with depth while the bottom
//   term is attenuated down to the seabed and back. Their fit is for a nadir view; here the upward
//   distribution factors are stretched by the view's own path in the water (1 / cos theta_v).
// - Above the surface, R_rs = 0.5 r_rs / (1 - 1.5 r_rs) (Lee et al. 1999, equation 2).
// - Sunlight on the seabed is refocused by the ripples (caustics): to first order a refracted beam
//   lands at x + l (1 - 1/n) grad h, so the irradiance gain is 1 / |det(I + l (1 - 1/n) Hess h)|.
//
// Units are metres and seconds; colours are linear.

export const SEA_LEVEL = -7.35;
// The modelled sea's square (environment.mjs): 400 m on a side, centred 28 m out to sea. Past its edge
// the dome's far sea carries the water to the horizon, and the haze dissolves one into the other.
export const SEA_PLANE = Object.freeze({ size: 400, center: [0, -28] });
// Pure water, 1/m, at 650, 550 and 450 nm (Pope and Fry 1997, as tabulated by OMLC).
export const PURE_WATER_ABSORPTION = Object.freeze([0.34, 0.0565, 0.00922]);
export const SEA_BANDS = Object.freeze([650, 550, 450]);
// Lee et al. (1998) Table 2 at the three bands: a_phi(lambda) = [a0 + a1 ln a_phi(440)] a_phi(440).
const PHYTOPLANKTON_SHAPE = Object.freeze([
  [0.3502, 0.0713],
  [0.4262, 0.0781],
  [0.9634, 0.006],
]);
// The water we draw: clear coastal water on a calm La Jolla day (authored, not a measurement).
// chlorophyll in mg/m^3, CDOM absorption at 440 nm in 1/m, B is Gordon and Morel's particle scattering
// scale that Lee et al. use (0.3), 1.9 % of particle scattering goes backward (their Petzold average
// phase function), and a small molecular term that rises toward the blue.
export const LA_JOLLA_WATER = Object.freeze({
  chlorophyll: 0.25,
  cdom440: 0.015,
  particleScale: 0.3,
  particleBackscatterRatio: 0.019,
  molecularBackscatter: Object.freeze([0.0005, 0.001, 0.0022]),
});

// Inherent optical properties per band: absorption a, backscattering bb, kappa = a + bb, u = bb / kappa.
export function seawaterIOPs(water = LA_JOLLA_WATER) {
  const chl = Math.max(1e-3, water.chlorophyll),
    phi440 = 0.06 * chl ** 0.65,
    particles = water.particleScale * chl ** 0.62;
  const a = [],
    bb = [];
  SEA_BANDS.forEach((lambda, i) => {
    const [a0, a1] = PHYTOPLANKTON_SHAPE[i],
      phytoplankton = Math.max(0, (a0 + a1 * Math.log(phi440)) * phi440),
      cdom = water.cdom440 * Math.exp(-0.014 * (lambda - 440));
    a.push(PURE_WATER_ABSORPTION[i] + phytoplankton + cdom);
    bb.push(water.particleBackscatterRatio * particles * (550 / lambda) + water.molecularBackscatter[i]);
  });
  const kappa = a.map((value, i) => value + bb[i]),
    u = bb.map((value, i) => value / kappa[i]);
  return { a, bb, kappa, u };
}

// Subsurface remote-sensing reflectance (sr^-1) of a water column of depth H (m) over a Lambertian
// bottom of albedo rho, Lee et al. (1998) equation 21, for one band. cosSun is the cosine of the
// refracted sun's zenith in the water, cosView that of the view ray in the water (1 for nadir), and
// `light` scales the bottom's illumination (shadow and caustics relative to the open seabed).
export function shallowReflectance({ u, kappa, depth, rho, cosSun = 1, cosView = 1, light = 1 }) {
  const deep = (0.07 + 0.155 * u ** 0.752) * u,
    down = 1 / Math.max(cosSun, 0.05),
    column = (1.2 * Math.sqrt(1 + 2 * u)) / Math.max(cosView, 0.05),
    bottom = (1.1 * Math.sqrt(1 + 4.9 * u)) / Math.max(cosView, 0.05),
    h = Math.max(0, depth);
  return deep * (1 - 1.03 * Math.exp(-(down + column) * kappa * h)) + 0.31 * rho * light * Math.exp(-(down + bottom) * kappa * h);
}
// Above-surface remote-sensing reflectance (Lee et al. 1999, equation 2). It diverges as r_rs nears 2/3,
// so r_rs stops at SHALLOW_RRS_LIMIT (the shader's clamp too).
export const SHALLOW_RRS_LIMIT = 0.3;
export const aboveSurface = (rrs) => {
  const r = Math.min(Math.max(rrs, 0), SHALLOW_RRS_LIMIT);
  return (0.5 * r) / (1 - 1.5 * r);
};

// Mean of the clamped single-sheet caustic gain over the ripple field, as a function of the summed
// curvature variance s2 = l'^2 sum 0.5 (a k^2 w)^2: a rational fit to sampled statistics, within about
// 5 % for s2 up to 28. Dividing by it keeps the seabed's average light unchanged as the pattern grows.
export const causticMean = (s2) => (1 + 1.7 * s2) / (1 + 0.3 * Math.max(0, s2) ** 1.75);
export const CAUSTIC_FLOOR = 0.15;
// The caustics use the seven longest pixel-stage ripples (0.9 m to 12.5 cm). The shorter ones focus only
// close under the surface, are blurred by the sun's disc below that and by the footprint of any but the
// closest view; leaving them out keeps the sea's program small enough to compile with the first view.
export const CAUSTIC_RIPPLES = RIPPLES.slice(0, 7);
export const CAUSTIC_CEILING = 5;
export const SUN_ANGULAR_RADIUS = 0.0047;
// The sun's disc, sr: the patch of sky a glinting facet must mirror (the moon's is about the same).
export const SUN_SOLID_ANGLE = Math.PI * SUN_ANGULAR_RADIUS ** 2;

// Direct sunlight low over the sea (Sirui, 2026-10-18: "sunset near pacific ocean is gorgeous"). The
// light crosses more air the lower the sun stands, and the air scatters blue out of the beam first, so
// the sun turns gold and then red as it sets.
// - Relative optical air mass at the sun's altitude h (degrees): Kasten and Young (1989),
//   m = 1 / (sin h + 0.50572 (h + 6.07995)^-1.6364), as pvlib implements it. Below -0.5 degrees the
//   disc has set; the formula is not meant for the sun under the horizon, so h stops there.
// - Rayleigh optical depth of the air at sea level, lambda in micrometres: Hansen and Travis (1974),
//   0.008569 lambda^-4 (1 + 0.0113 lambda^-2 + 0.00013 lambda^-4).
// - A clean coastal haze, optical depth 0.1 at 550 nm falling as lambda^-1 (Angstrom's law with
//   exponent 1): an authored value, not a measurement.
export const COAST_AEROSOL = Object.freeze({ depth550: 0.1, angstrom: 1 });
export const airMass = (altitude) => {
  const h = Math.max(altitude, -0.5);
  return 1 / (Math.sin((h * Math.PI) / 180) + 0.50572 * (h + 6.07995) ** -1.6364);
};
export const rayleighDepth = (micrometres) => 0.008569 * micrometres ** -4 * (1 + 0.0113 * micrometres ** -2 + 0.00013 * micrometres ** -4);
// Transmittance of the direct beam at the sea's three bands (red, green, blue).
export function sunTransmittance(altitude, aerosol = COAST_AEROSOL) {
  const m = airMass(altitude);
  return SEA_BANDS.map((nm) => {
    const um = nm / 1000;
    return Math.exp(-m * (rayleighDepth(um) + aerosol.depth550 * (um / 0.55) ** -aerosol.angstrom));
  });
}
// The scene's sun light keeps one daytime colour to the horizon. The water's sun takes the hue of the
// beam at `altitude` relative to the sun at 40 degrees or higher (1 above), at the luminance (Rec. 709)
// of `color`, the light as the scene sets it: the scene's own ramp already dims the setting sun.
export const SUN_TINT_REFERENCE = 40;
const luminance = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
export function sunTint(altitude, color = [1, 1, 1]) {
  const low = sunTransmittance(Math.min(altitude, SUN_TINT_REFERENCE)),
    high = sunTransmittance(SUN_TINT_REFERENCE),
    ratio = low.map((t, k) => t / high[k]),
    before = luminance(color),
    after = luminance(color.map((c, k) => c * ratio[k]));
  if (!(before > 0) || !(after > 0)) return [1, 1, 1];
  return ratio.map((r) => (r * before) / after);
}

// The caustic gain on the seabed below the surface point (x, z): the paraxial Jacobian of the refracted
// sun's landing point through the wind ripples (normal-only waves, as in the sea shader), each blurred
// by the sun's disc over the path l (m) and by the pixel footprint (m). rippleGain is the local wind's
// ripple scale (ocean-spectrum.mjs rippleScale). Returns the gain and its parts for tests.
export function causticGain(x, z, seconds, path, { footprint = 0, rippleGain = 1, turn = [1, 0], ior = WATER_IOR } = {}) {
  const lens = Math.max(0, path) * (1 - 1 / ior);
  let hxx = 0,
    hzz = 0,
    hxz = 0,
    s2 = 0;
  for (const w of CAUSTIC_RIPPLES) {
    const dx = w.dx * turn[0] + w.dz * turn[1],
      dz = w.dz * turn[0] - w.dx * turn[1],
      blur = w.k * (SUN_ANGULAR_RADIUS * path + footprint),
      weight = Math.exp(-0.5 * blur * blur),
      curvature = w.amplitude * rippleGain * w.k * w.k * weight,
      c = -curvature * Math.sin(w.k * (dx * x + dz * z) - w.omega * seconds + w.phase);
    hxx += c * dx * dx;
    hzz += c * dz * dz;
    hxz += c * dx * dz;
    s2 += 0.5 * (curvature * lens) ** 2;
  }
  const det = (1 + lens * hxx) * (1 + lens * hzz) - lens * lens * hxz * hxz,
    raw = Math.min(CAUSTIC_CEILING, 1 / Math.max(Math.abs(det), CAUSTIC_FLOOR));
  return { gain: raw / causticMean(s2), det, raw, s2, hessian: [hxx, hzz, hxz] };
}

// Seabed heights from a top-down capture of the coast (bathymetry.mjs): `heights` holds metres where
// `hit` is set. Past the authored beach and rock the seabed continues down from every captured cell at
// `slope` (a slope-limited extension, max over captured q of h(q) - slope |p - q|, by a two-pass chamfer
// on the 3x3 neighbourhood), steepening by `curvature` times the squared distance from the coast, to
// `floor`: a sandy shelf a few metres deep near shore, open water about 50 m out. `shore` gets each
// cell's distance (m) to the nearest dry cell (height at or above sea level), the shoreline's own
// distance field for the swash; `reach` its distance to the nearest captured cell.
export function fillSeabed({ width, rows, cell, heights, hit, slope = 0.08, curvature = 0.003, floor = SEA_LEVEL - 14, seaLevel = SEA_LEVEL }) {
  const count = width * rows,
    level = new Float32Array(count),
    shore = new Float32Array(count),
    reach = new Float32Array(count),
    diagonal = Math.SQRT2 * cell;
  for (let k = 0; k < count; k++) {
    level[k] = hit[k] ? heights[k] : -Infinity;
    shore[k] = hit[k] && heights[k] >= seaLevel ? 0 : Infinity;
    reach[k] = hit[k] ? 0 : Infinity;
  }
  // Captured cells keep their heights; only the open seabed takes the extension.
  const relax = (k, n, step) => {
    const down = level[n] - slope * step;
    if (!hit[k] && down > level[k]) level[k] = down;
    if (shore[n] + step < shore[k]) shore[k] = shore[n] + step;
    if (reach[n] + step < reach[k]) reach[k] = reach[n] + step;
  };
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < width; i++) {
      const k = j * width + i;
      if (i > 0) relax(k, k - 1, cell);
      if (j > 0) {
        relax(k, k - width, cell);
        if (i > 0) relax(k, k - width - 1, diagonal);
        if (i < width - 1) relax(k, k - width + 1, diagonal);
      }
    }
  for (let j = rows - 1; j >= 0; j--)
    for (let i = width - 1; i >= 0; i--) {
      const k = j * width + i;
      if (i < width - 1) relax(k, k + 1, cell);
      if (j < rows - 1) {
        relax(k, k + width, cell);
        if (i < width - 1) relax(k, k + width + 1, diagonal);
        if (i > 0) relax(k, k + width - 1, diagonal);
      }
    }
  let captured = 0,
    dry = 0;
  for (let k = 0; k < count; k++) {
    if (hit[k]) captured++;
    if (shore[k] === 0) dry++;
    if (!Number.isFinite(reach[k])) reach[k] = 1e4;
    level[k] = Math.max(floor, level[k] - curvature * Math.min(reach[k], 1e3) ** 2);
    if (!Number.isFinite(shore[k])) shore[k] = 1e4;
  }
  return { level, shore, reach, captured, dry };
}

// The caustic ripples as uniforms the shader loops over with a uniform bound: ANGLE's Direct3D compiler
// unrolls constant-bound loops and inlines every call, which had doubled the sea's compile time. Flat
// arrays per the performance notes: (dx, dz, k, omega) and (a k^2, phase, scramble mix x, mix y).
export function causticUniforms(ripples = CAUSTIC_RIPPLES) {
  const wave = new Float32Array(ripples.length * 4),
    shape = new Float32Array(ripples.length * 4);
  ripples.forEach((w, i) => {
    wave.set([w.dx, w.dz, w.k, w.omega], i * 4);
    shape.set([w.amplitude * w.k * w.k, w.phase, Math.cos(i * 2.39996), Math.sin(i * 2.39996)], i * 4);
  });
  return {
    seaCausticWave: { value: wave },
    seaCausticShape: { value: shape },
    seaCausticCount: { value: ripples.length },
  };
}

const f = (value) => (Number.isInteger(value) ? `${value}.0` : value.toPrecision(9));
const v3 = (array) => `vec3(${array.map(f).join(",")})`;

// GLSL for the sea's fragment stage. Needs surfaceNoise (stoneNoise, grainNoise), oceanFieldGLSL
// (oceanTurn) and oceanRipplesGLSL (oceanWindLocal) before it.
export function seaOpticsGLSL(iops = seawaterIOPs()) {
  return `
uniform sampler2D seabedMap;
uniform vec4 seabedBounds;
uniform float seabedReady;
// Seabed at a world point: height (m), rock share, distance to dry land (m), distance from the captured coast (m).
// An explicit level (the map has no mipmaps): the lookups sit in loops and branches, where implicit
// derivatives made the driver unroll and re-derive them and doubled the program's compile time.
vec4 seabedAt(vec2 xz) {
  vec2 uv = vec2((xz.x - seabedBounds.x) * seabedBounds.z, (seabedBounds.y - xz.y) * seabedBounds.w);
  return textureLod(seabedMap, clamp(uv, vec2(0.), vec2(1.)), 0.);
}
const vec3 seaKappa = ${v3(iops.kappa)};
const vec3 seaU = ${v3(iops.u)};
// Unpolarized dielectric Fresnel reflectance of water at an incidence cosine (waterFresnel in JS).
float seaFresnel(float cosine) {
  float c = clamp(cosine, 0., 1.), t = sqrt(1. - (1. - c * c) / ${f(WATER_IOR * WATER_IOR)});
  float s = (c - ${f(WATER_IOR)} * t) / (c + ${f(WATER_IOR)} * t), q = (${f(WATER_IOR)} * c - t) / (${f(WATER_IOR)} * c + t);
  return .5 * (s * s + q * q);
}
// Lee et al. (1998) equation 21 per band, with the upward factors stretched by 1 / cos(view in water).
// silt adds spectrally flat backscattering (1/m) from sand the surf stirs up.
vec3 seaReflectance(float depth, vec3 rho, float cosSun, float cosView, vec3 light, float silt) {
  vec3 kappa = seaKappa + silt;
  vec3 u = (seaU * seaKappa + silt) / kappa;
  vec3 deep = (.07 + .155 * pow(u, vec3(.752))) * u;
  float down = 1. / max(cosSun, .05), view = 1. / max(cosView, .05);
  vec3 column = 1.2 * sqrt(1. + 2. * u) * view;
  vec3 bottom = 1.1 * sqrt(1. + 4.9 * u) * view;
  float h = max(depth, 0.);
  vec3 rrs = deep * (1. - 1.03 * exp(-(down + column) * kappa * h)) + .31 * rho * light * exp(-(down + bottom) * kappa * h);
  // Lee et al.'s conversion below diverges as r_rs nears 2/3, where focused caustics over bright sand
  // could push it; r_rs stops at 0.3 (R_rs 0.27), above any unfocused seabed's.
  rrs = clamp(rrs, vec3(0.), vec3(${f(SHALLOW_RRS_LIMIT)}));
  return .5 * rrs / (1. - 1.5 * rrs);
}
// A short 2D value noise on an integer hash (lowbias32, as wind-field.mjs uses): four corners where the
// shared 3D grainNoise takes eight, which keeps the sea's program small.
uint seaHash(uvec2 q) {
  uint h = q.x * 0x8da6b343u ^ q.y * 0xd8163841u;
  h ^= h >> 16u; h *= 0x7feb352du; h ^= h >> 15u; h *= 0x846ca68bu; h ^= h >> 16u;
  return h;
}
float seaNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), s = f * f * (3. - 2. * f);
  uvec2 c = uvec2(ivec2(i) + 65536);
  float a = float(seaHash(c)), b = float(seaHash(c + uvec2(1u, 0u))), d = float(seaHash(c + uvec2(0u, 1u))), e = float(seaHash(c + uvec2(1u, 1u)));
  return mix(mix(a, b, s.x), mix(d, e, s.x), s.y) * 2.3283064e-10;
}
uniform vec4 seaCausticWave[${CAUSTIC_RIPPLES.length}];
uniform vec4 seaCausticShape[${CAUSTIC_RIPPLES.length}];
uniform int seaCausticCount;
// Caustic gain on the seabed (see causticGain in sea-optics.mjs), for the ripples under the point p
// where the refracted sun ray to the seabed crossed the surface, over its path l in the water.
float seaCaustics(vec2 p, float time, float path, float footprint) {
  // Plane waves focus into a regular lattice. Two slow noise fields scramble each wave's phase by a
  // different mix, which breaks the lattice into the irregular web real chop throws without changing any
  // wave's curvature, so the statistics below still hold.
  vec2 scramble = vec2(seaNoise(p * .37), seaNoise(p * .37 + 41.)) * 6.2832;
  float windU = max(oceanWindLocal, 0.);
  float gain = clamp(sqrt((${f(0.003)} + ${f(0.00512)} * windU) / ${f(0.003 + 0.00512 * 3)}) * (.35 + .65 * smoothstep(.3, 1.8, windU)), .2, 1.3);
  float lens = path * ${f(1 - 1 / WATER_IOR)};
  vec3 hessian = vec3(0.);
  float s2 = 0.;
  for (int i = 0; i < seaCausticCount; i++) {
    vec4 wave = seaCausticWave[i], shape = seaCausticShape[i];
    vec2 d = oceanTurn(wave.xy);
    float blur = wave.z * (${f(SUN_ANGULAR_RADIUS)} * path + footprint);
    if (blur < 3.5) {
      float curvature = shape.x * gain * exp(-.5 * blur * blur);
      float c = -curvature * sin(wave.z * dot(d, p) - wave.w * time + shape.y + dot(scramble, shape.zw));
      hessian += c * vec3(d.x * d.x, d.y * d.y, d.x * d.y);
      s2 += .5 * curvature * curvature * lens * lens;
    }
  }
  float det = (1. + lens * hessian.x) * (1. + lens * hessian.y) - lens * lens * hessian.z * hessian.z;
  float raw = min(${f(CAUSTIC_CEILING)}, 1. / max(abs(det), ${f(CAUSTIC_FLOOR)}));
  return raw * (1. + .3 * pow(s2, 1.75)) / (1. + 1.7 * s2);
}
// The seabed's albedo (irradiance reflectance) at a world point: rippled sand, rock with algae, coralline
// crust and surfgrass in the shallows, and patchy reef with kelp where the seabed continues past the
// authored coast (reach: metres from it).
vec3 seabedAlbedo(vec3 p, float rock, float depth, float reach, float footprint) {
  float patches = seaNoise(p.xz * .21) * .7 + seaNoise(p.xz * .53 + 17.) * .3;
  // Detail a pixel cannot resolve is not computed: the grain past a 12 cm footprint, the ripples past 5 cm.
  float grain = footprint < .12 ? seaNoise(p.xz * 6.3) : .5;
  // Wave ripples run along the shore, about 9 cm apart, bending with the sand; filtered with distance.
  float ripple = footprint < .05 ? sin(p.z * 69.8 + patches * 9. + grain * 1.5) * exp(-.5 * pow(footprint * 69.8, 2.)) : 0.;
  vec3 sand = vec3(.62, .57, .47) * (.84 + .18 * patches + .05 * grain) * (1. + .08 * ripple);
  // Reef offshore: rock in patches with sand channels between, kelp on the deeper rock.
  float reef = reach > 2. ? smoothstep(.58, .74, .72 * seaNoise(p.xz * .13 + 83.) + .28 * patches) * smoothstep(2., 8., reach) : 0.;
  float r = max(rock, reef * .85);
  if (r < .01) return sand;
  // One noise field paints the rock: algae in its middle range, surfgrass streaks in the shallows,
  // coralline crust on the grain's highs and kelp on the patches' lows in deeper water.
  float cover = seaNoise(p.xz * vec2(.9, .55) + 151.);
  vec3 stone = vec3(.22, .2, .15) * (.75 + .5 * patches);
  stone = mix(stone, vec3(.075, .115, .045), smoothstep(.35, .7, cover) * .7);
  stone = mix(stone, vec3(.34, .2, .2), smoothstep(.62, .8, grain) * .45);
  stone = mix(stone, vec3(.06, .2, .05), smoothstep(.62, .78, cover) * (1. - smoothstep(.4, 2.2, depth)) * .8);
  stone = mix(stone, vec3(.09, .07, .035), smoothstep(.45, .3, patches) * smoothstep(3., 7., depth));
  return mix(sand, stone, r);
}
`;
}
