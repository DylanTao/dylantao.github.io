import * as THREE from "../three.module.min.js";
import {
  ATMOSPHERE,
  DEG,
  adaptationGain,
  atmosphereTables,
  buildMultipleScatteringTable,
  buildTransmittanceTable,
  luminance,
  marineLayerAt,
  marineTop,
  moonPosition,
  nightSky,
  refraction,
  skyRadiance,
  transmittanceToTop,
  weatherFor,
} from "./atmosphere-model.mjs";

// The coast's sky, sun, moon and haze on the GPU (atmosphere-model.mjs holds the physics and its
// tests). Three small tables, after Hillaire 2020: the transmittance of every ray to space (256×64,
// drawn once), the multiple-scattering transfer Ψ_ms (32×32, once) and the sky as seen from the
// coast for the current sun (192×108, redrawn when the sun moves). The dome reads the sky table,
// draws the sun and the moon where refraction puts them, the stars where sidereal time puts them,
// and the Pacific beyond the modelled sea; the haze pass (haze.mjs) reads the same tables, so
// distant land and the sky meet in the same light.
//
// Radiance leaves these shaders in the scene's linear units: the model's radiance per unit solar
// illuminance times `scale` (the sun's illuminance, a sky fill and the eye's adaptation).

const TRANSMITTANCE = [256, 64],
  MULTIPLE = [32, 32],
  SKY_VIEW = [192, 108];
// The sky table is computed for an eye 30 m above the sea, the coast camera's usual height.
export const VIEW_ALTITUDE = 0.03;
// The sea's mean level in the scene (environment.mjs's ocean plane).
export const SEA_LEVEL = -7.35;

// ── Scene calibration ───────────────────────────────────────────────────────────────────────────
// The key light's illuminance for an unattenuated sun, in three's intensity units: with the coast's
// noon transmittance (about 0.75) it keeps the authored midday sun of about 2.5.
export const SUN_ILLUMINANCE = 3.4;
// The extraterrestrial sun in linear sRGB, a little warmer than the D65 white point (5800 K).
export const SOLAR_WHITE = [1.0, 0.955, 0.885];
// A photograph of the coast exposed for sunlit sandstone shows the sky two to three times brighter
// than the radiance a scattering model gives per unit of the same sunlight; the dome, its
// reflections and the haze take that fill, so the sky reads as it does on camera.
export const SKY_FILL = 2.0;
// The sky's highlight shoulder (atmoSkyRadiance): radiance is divided by 1 + luminance / SKY_KNEE.
export const SKY_KNEE = 1.2;
// The share of the light's colour cast the eye discounts (skyLighting).
export const ADAPTATION = 0.08;
// The house's interior light also carries sunlight bounced off the cliff, the terrace and the sea
// through the glass front, which the probe field's three-colour sky (static-light-field.mjs) has no
// term for; its sky and ground colours take this further factor.
export const AMBIENT_FILL = 1.7;
// The visible discs are drawn larger than life (about 2.8 times), as a long lens would show them,
// with their light conserved: the sun's disc radiance falls by the square of the enlargement.
export const DISC_RADIUS = 0.75 * DEG;
// The coast's own haze, denser than the open atmosphere's: sea-salt aerosol in the marine layer,
// about 5.5 km visibility at the waterline, thinning with a 30 m scale height up the bluffs; it
// reaches 2.4 km from the eye, past which the scattering atmosphere carries the distance.
export const HAZE = Object.freeze({ density: 1 / 1400, scaleHeight: 30, range: 2400, albedo: 0.95 });

const glslFloat = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));
const glslVec3 = (v) => `vec3(${v.map(glslFloat).join(",")})`;

// Constants and the table mappings shared by every atmosphere shader.
export const atmosphereConstantsGLSL = `
#define ATMO_PI 3.14159265359
const float ATMO_BOTTOM = ${glslFloat(ATMOSPHERE.bottomRadius)};
const float ATMO_TOP = ${glslFloat(ATMOSPHERE.topRadius)};
const vec3 ATMO_RAYLEIGH = ${glslVec3(ATMOSPHERE.rayleighScattering)};
const float ATMO_RAYLEIGH_H = ${glslFloat(ATMOSPHERE.rayleighScaleHeight)};
const vec3 ATMO_MIE_S = ${glslVec3(ATMOSPHERE.mieScattering)};
const vec3 ATMO_MIE_A = ${glslVec3(ATMOSPHERE.mieAbsorption)};
const float ATMO_MIE_H = ${glslFloat(ATMOSPHERE.mieScaleHeight)};
const float ATMO_MIE_G = ${glslFloat(ATMOSPHERE.mieG)};
const vec3 ATMO_OZONE = ${glslVec3(ATMOSPHERE.ozoneAbsorption)};
const float ATMO_OZONE_C = ${glslFloat(ATMOSPHERE.ozoneCenter)};
const float ATMO_OZONE_W = ${glslFloat(ATMOSPHERE.ozoneHalfWidth)};
const vec3 ATMO_GROUND = ${glslVec3(ATMOSPHERE.groundAlbedo)};
const float ATMO_VIEW_ALTITUDE = ${glslFloat(VIEW_ALTITUDE)};
float atmoUnitToTexel(float x, float size) { return 0.5 / size + x * (1.0 - 1.0 / size); }
float atmoTexelToUnit(float u, float size) { return (u - 0.5 / size) / (1.0 - 1.0 / size); }
float atmoDistanceToTop(float r, float mu) {
  return max(0.0, -r * mu + sqrt(max(0.0, r * r * (mu * mu - 1.0) + ATMO_TOP * ATMO_TOP)));
}
vec2 atmoTransmittanceUv(float r, float mu) {
  float H = sqrt(ATMO_TOP * ATMO_TOP - ATMO_BOTTOM * ATMO_BOTTOM);
  float rho = sqrt(max(0.0, r * r - ATMO_BOTTOM * ATMO_BOTTOM));
  float d = atmoDistanceToTop(r, mu);
  float dMin = ATMO_TOP - r, dMax = rho + H;
  return vec2(atmoUnitToTexel(clamp((d - dMin) / (dMax - dMin), 0.0, 1.0), ${glslFloat(TRANSMITTANCE[0])}),
    atmoUnitToTexel(clamp(rho / H, 0.0, 1.0), ${glslFloat(TRANSMITTANCE[1])}));
}
vec2 atmoMultipleUv(float r, float muSun) {
  vec2 x = vec2(0.5 + 0.5 * sign(muSun) * sqrt(min(1.0, abs(muSun))), sqrt(clamp((r - ATMO_BOTTOM) / (ATMO_TOP - ATMO_BOTTOM), 0.0, 1.0)));
  return vec2(atmoUnitToTexel(x.x, ${glslFloat(MULTIPLE[0])}), atmoUnitToTexel(x.y, ${glslFloat(MULTIPLE[1])}));
}
float atmoRayleighPhase(float c) { return 3.0 / (16.0 * ATMO_PI) * (1.0 + c * c); }
float atmoMiePhase(float c, float g) {
  float k = 3.0 / (8.0 * ATMO_PI) * (1.0 - g * g) / (2.0 + g * g);
  return k * (1.0 + c * c) / pow(max(1e-4, 1.0 + g * g - 2.0 * g * c), 1.5);
}
vec2 atmoRaySphere(vec3 o, vec3 d, float radius, float cTerm) {
  float b = dot(o, d), disc = b * b - cTerm;
  if (disc < 0.0) return vec2(-1.0);
  float s = sqrt(disc);
  return vec2(-b - s, -b + s);
}
// The sky table's mapping (Hillaire's SkyViewLutParamsToUv): view zenith warped toward the horizon,
// azimuth from the sun warped toward the sun, the lower half below the horizon.
vec2 atmoSkyViewUv(vec3 d, vec3 sun) {
  float viewHeight = ATMO_BOTTOM + ATMO_VIEW_ALTITUDE;
  float beta = acos(sqrt(viewHeight * viewHeight - ATMO_BOTTOM * ATMO_BOTTOM) / viewHeight);
  float zenithHorizon = ATMO_PI - beta;
  float zenith = acos(clamp(d.y, -1.0, 1.0));
  float v;
  if (zenith < zenithHorizon) {
    float c = 1.0 - zenith / zenithHorizon;
    v = (1.0 - sqrt(max(0.0, c))) * 0.5;
  } else {
    v = sqrt(clamp((zenith - zenithHorizon) / beta, 0.0, 1.0)) * 0.5 + 0.5;
  }
  vec2 dh = d.xz, sh = sun.xz;
  float dl = length(dh), sl = length(sh);
  float lightViewCos = dl > 1e-5 && sl > 1e-5 ? dot(dh, sh) / (dl * sl) : 1.0;
  float u = sqrt(clamp(0.5 - 0.5 * lightViewCos, 0.0, 1.0));
  return vec2(atmoUnitToTexel(u, ${glslFloat(SKY_VIEW[0])}), atmoUnitToTexel(v, ${glslFloat(SKY_VIEW[1])}));
}
`;

// Hillaire's IntegrateScatteredLuminance for the two table passes. ATMO_ISOTROPIC selects the
// multiple-scattering pass's uniform phase and its ground bounce; otherwise the view pass adds Ψ_ms.
const integrateGLSL = `
uniform sampler2D atmoTransmittance;
#ifndef ATMO_ISOTROPIC
uniform sampler2D atmoMultiple;
#endif
vec3 atmoIntegrate(float altitude, vec3 dir, vec3 sun, int stepCount, out vec3 multipleAsOne, out vec3 throughput) {
  vec3 origin = vec3(0.0, ATMO_BOTTOM + altitude, 0.0);
  float rO = ATMO_BOTTOM + altitude;
  vec2 top = atmoRaySphere(origin, dir, ATMO_TOP, rO * rO - ATMO_TOP * ATMO_TOP);
  vec2 bottom = atmoRaySphere(origin, dir, ATMO_BOTTOM, altitude * (2.0 * ATMO_BOTTOM + altitude));
  vec3 radiance = vec3(0.0);
  multipleAsOne = vec3(0.0);
  throughput = vec3(1.0);
  if (top.y < 0.0) return radiance;
  float start = max(0.0, top.x), end = top.y;
  bool hitGround = bottom.x > 0.0;
  if (hitGround) end = min(end, bottom.x);
  float cosine = dot(dir, sun);
#ifdef ATMO_ISOTROPIC
  float phaseR = 1.0 / (4.0 * ATMO_PI), phaseM = phaseR;
#else
  float phaseR = atmoRayleighPhase(cosine), phaseM = atmoMiePhase(cosine, ATMO_MIE_G);
#endif
  float len = end - start;
  for (int i = 0; i < 64; i++) {
    if (i >= stepCount) break;
#ifdef ATMO_ISOTROPIC
    float s0 = float(i) / float(stepCount), s1 = float(i + 1) / float(stepCount);
#else
    float s0 = float(i) / float(stepCount), s1 = float(i + 1) / float(stepCount);
    s0 *= s0;
    s1 *= s1;
#endif
    float dt = (s1 - s0) * len, t = start + 0.5 * (s0 + s1) * len;
    vec3 p = origin + dir * t;
    float r = length(p), muSun = dot(p, sun) / r, h = max(0.0, r - ATMO_BOTTOM);
    float dR = exp(-h / ATMO_RAYLEIGH_H), dM = exp(-h / ATMO_MIE_H), dO = max(0.0, 1.0 - abs(h - ATMO_OZONE_C) / ATMO_OZONE_W);
    float shadow = muSun < 0.0 && r * r * (muSun * muSun - 1.0) + ATMO_BOTTOM * ATMO_BOTTOM >= 0.0 ? 0.0 : 1.0;
    vec3 toSun = shadow * texture2D(atmoTransmittance, atmoTransmittanceUv(r, muSun)).rgb;
    vec3 sR = ATMO_RAYLEIGH * dR, sM = ATMO_MIE_S * dM, scattering = sR + sM;
    vec3 extinction = scattering + ATMO_MIE_A * dM + ATMO_OZONE * dO;
    vec3 sampleT = exp(-extinction * dt);
    vec3 source = toSun * (sR * phaseR + sM * phaseM);
#ifndef ATMO_ISOTROPIC
    source += texture2D(atmoMultiple, atmoMultipleUv(r, muSun)).rgb * scattering;
#endif
    vec3 integral = (vec3(1.0) - sampleT) / max(extinction, vec3(1e-9));
    radiance += throughput * source * integral;
    multipleAsOne += throughput * scattering * integral;
    throughput *= sampleT;
  }
#ifdef ATMO_ISOTROPIC
  if (hitGround) {
    vec3 p = origin + dir * end;
    float r = length(p), muSun = dot(p, sun) / r;
    vec3 toSun = texture2D(atmoTransmittance, atmoTransmittanceUv(r, muSun)).rgb;
    radiance += throughput * toSun * max(0.0, muSun) * ATMO_GROUND / ATMO_PI;
  }
#endif
  return radiance;
}
`;

const transmittanceFragment = `
precision highp float;
uniform int atmoSteps;
${atmosphereConstantsGLSL}
void main() {
  vec2 uv = gl_FragCoord.xy / vec2(${glslFloat(TRANSMITTANCE[0])}, ${glslFloat(TRANSMITTANCE[1])});
  float xMu = atmoTexelToUnit(uv.x, ${glslFloat(TRANSMITTANCE[0])}), xR = atmoTexelToUnit(uv.y, ${glslFloat(TRANSMITTANCE[1])});
  float H = sqrt(ATMO_TOP * ATMO_TOP - ATMO_BOTTOM * ATMO_BOTTOM), rho = H * xR;
  float r = sqrt(rho * rho + ATMO_BOTTOM * ATMO_BOTTOM);
  float dMin = ATMO_TOP - r, dMax = rho + H, d = dMin + xMu * (dMax - dMin);
  float mu = d == 0.0 ? 1.0 : clamp((H * H - rho * rho - d * d) / (2.0 * r * d), -1.0, 1.0);
  float len = atmoDistanceToTop(r, mu), dt = len / float(atmoSteps);
  vec3 depth = vec3(0.0);
  for (int i = 0; i < 256; i++) {
    if (i >= atmoSteps) break;
    float t = (float(i) + 0.5) * dt;
    float h = max(0.0, sqrt(t * t + 2.0 * r * mu * t + r * r) - ATMO_BOTTOM);
    depth += (ATMO_RAYLEIGH * exp(-h / ATMO_RAYLEIGH_H) + (ATMO_MIE_S + ATMO_MIE_A) * exp(-h / ATMO_MIE_H)
      + ATMO_OZONE * max(0.0, 1.0 - abs(h - ATMO_OZONE_C) / ATMO_OZONE_W)) * dt;
  }
  gl_FragColor = vec4(exp(-depth), 1.0);
}`;

const multipleFragment = `
precision highp float;
#define ATMO_ISOTROPIC
uniform int atmoSqrtDirections, atmoSteps;
${atmosphereConstantsGLSL}
${integrateGLSL}
void main() {
  vec2 uv = gl_FragCoord.xy / vec2(${glslFloat(MULTIPLE[0])}, ${glslFloat(MULTIPLE[1])});
  float s = atmoTexelToUnit(uv.x, ${glslFloat(MULTIPLE[0])}) * 2.0 - 1.0, muSun = sign(s) * s * s;
  float w = atmoTexelToUnit(uv.y, ${glslFloat(MULTIPLE[1])});
  float altitude = max(0.001, w * w * (ATMO_TOP - ATMO_BOTTOM));
  vec3 sun = vec3(sqrt(max(0.0, 1.0 - muSun * muSun)), muSun, 0.0);
  vec3 light = vec3(0.0), fms = vec3(0.0), single, throughput;
  float count = float(atmoSqrtDirections * atmoSqrtDirections);
  for (int i = 0; i < 16; i++) {
    if (i >= atmoSqrtDirections) break;
    for (int j = 0; j < 16; j++) {
      if (j >= atmoSqrtDirections) break;
      float theta = 2.0 * ATMO_PI * (float(i) + 0.5) / float(atmoSqrtDirections);
      float phi = acos(1.0 - 2.0 * (float(j) + 0.5) / float(atmoSqrtDirections));
      vec3 dir = vec3(cos(theta) * sin(phi), cos(phi), sin(theta) * sin(phi));
      light += atmoIntegrate(altitude, dir, sun, atmoSteps, single, throughput) / count;
      fms += single / count;
    }
  }
  gl_FragColor = vec4(light / (vec3(1.0) - min(vec3(0.99), fms)), 1.0);
}`;

// The sky from the coast: RGB is in-scattered radiance per unit solar illuminance, A the ray's
// luminance transmittance (for rays that meet the sea: how much of the distant water shows through).
const skyViewFragment = `
precision highp float;
uniform vec3 atmoSun;
uniform int atmoSteps;
${atmosphereConstantsGLSL}
${integrateGLSL}
void main() {
  vec2 uv = gl_FragCoord.xy / vec2(${glslFloat(SKY_VIEW[0])}, ${glslFloat(SKY_VIEW[1])});
  vec2 u = vec2(atmoTexelToUnit(uv.x, ${glslFloat(SKY_VIEW[0])}), atmoTexelToUnit(uv.y, ${glslFloat(SKY_VIEW[1])}));
  float viewHeight = ATMO_BOTTOM + ATMO_VIEW_ALTITUDE;
  float beta = acos(sqrt(viewHeight * viewHeight - ATMO_BOTTOM * ATMO_BOTTOM) / viewHeight);
  float zenithHorizon = ATMO_PI - beta, viewZenithCos;
  if (u.y < 0.5) {
    float c = 1.0 - 2.0 * u.y;
    c = 1.0 - c * c;
    viewZenithCos = cos(zenithHorizon * c);
  } else {
    float c = u.y * 2.0 - 1.0;
    viewZenithCos = cos(zenithHorizon + beta * c * c);
  }
  float lightViewCos = -(u.x * u.x * 2.0 - 1.0);
  float muSun = clamp(atmoSun.y, -1.0, 1.0);
  vec3 sun = vec3(sqrt(max(0.0, 1.0 - muSun * muSun)), muSun, 0.0);
  float sinZ = sqrt(max(0.0, 1.0 - viewZenithCos * viewZenithCos));
  vec3 dir = vec3(sinZ * lightViewCos, viewZenithCos, sinZ * sqrt(max(0.0, 1.0 - lightViewCos * lightViewCos)));
  vec3 fms, throughput;
  vec3 radiance = atmoIntegrate(ATMO_VIEW_ALTITUDE, dir, sun, atmoSteps, fms, throughput);
  gl_FragColor = vec4(radiance, dot(throughput, vec3(0.2126, 0.7152, 0.0722)));
}`;

const fullscreenVertex = "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }";

// ── The scene's light from the sky ──────────────────────────────────────────────────────────────
const vec = (x, y, z) => [x, y, z];
const dirFromAngles = (elevation, azimuth) =>
  vec(Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth));
// The probe field's sky is mix(horizon, zenith, y^0.45) (static-light-field.mjs, light-trace-core.mjs).
// Its horizon colour is the sky's azimuthal mean just above the horizon; its zenith colour is chosen
// so the model's irradiance on an upward surface equals the scattering sky's.
const BANDS = [3, 12, 25, 40, 58, 78].map((e) => e * DEG);
const BAND_WEIGHTS = (() => {
  const edges = [0, 7.5, 18, 32, 49, 68, 90].map((e) => e * DEG);
  return BANDS.map((_, i) => ({
    solidAngle: 2 * Math.PI * (Math.sin(edges[i + 1]) - Math.sin(edges[i])),
    cosine: (Math.sin(edges[i + 1]) ** 2 - Math.sin(edges[i]) ** 2) / 2 / (Math.sin(edges[i + 1]) - Math.sin(edges[i])),
    basis: Math.sin(BANDS[i]) ** 0.45,
  }));
})();

// Every light colour the scene takes from the sky, in linear scene units, for an apparent sun
// direction (unit, toward the sun) and moon. Cheap (about 50 rays on the CPU's small tables).
export function skyLighting({ sun, moon = null, moonIllumination = 0, marine = 0 }) {
  const tables = atmosphereTables(),
    elevation = Math.asin(Math.max(-1, Math.min(1, sun[1]))),
    gain = adaptationGain(elevation),
    sunAzimuth = Math.atan2(sun[2], sun[0]),
    skyScale = SOLAR_WHITE.map((w) => w * SUN_ILLUMINANCE * SKY_FILL * gain);
  // The probe field's sky has one colour all round, but the house's glass, the cliff and the beach all
  // face the Pacific: the bands are averaged with the cosine toward the west (and a small floor for
  // the sky overhead and behind), so a sunrise behind the cliff lights its shade from the cool western
  // sky rather than the eastern glow, and a sunset from the glow it faces.
  const bandMeans = BANDS.map((band) => {
    const mean = [0, 0, 0];
    let total = 0;
    for (let k = 0; k < 8; k++) {
      const azimuth = sunAzimuth + (k * Math.PI) / 4,
        weight = 0.08 + Math.max(0, -Math.sin(azimuth)),
        radiance = skyRadiance(dirFromAngles(band, azimuth), sun, { tables, steps: 24 });
      for (let c = 0; c < 3; c++) mean[c] += radiance[c] * weight;
      total += weight;
    }
    for (let c = 0; c < 3; c++) mean[c] /= total;
    const scaled = mean.map((v, c) => v * skyScale[c]),
      shoulder = 1 / (1 + luminance(scaled) / SKY_KNEE);
    return scaled.map((v) => v * shoulder);
  });
  let irradiance = [0, 0, 0],
    basisA = 0,
    basisB = 0;
  BAND_WEIGHTS.forEach(({ solidAngle, cosine, basis }, i) => {
    for (let c = 0; c < 3; c++) irradiance[c] += bandMeans[i][c] * solidAngle * cosine;
    basisA += (1 - basis) * solidAngle * cosine;
    basisB += basis * solidAngle * cosine;
  });
  const night = nightSky(moon ? Math.max(0, Math.min(1, moon[1] * 6 + 0.3)) : 0, moonIllumination),
    nightWeight = Math.max(0, Math.min(1, (-elevation / DEG - 3) / 10));
  const horizon = bandMeans[0].map((v, c) => v + night.horizon[c] * nightWeight);
  const zenith = irradiance.map((e, c) => Math.max(0.15 * horizon[c], (e - horizon[c] * basisA) / basisB) + night.zenith[c] * nightWeight * 0.6);
  irradiance = irradiance.map((e, c) => e + (night.horizon[c] * 0.55 + night.zenith[c] * 0.45) * Math.PI * nightWeight);
  // The direct sun, attenuated along its refracted (apparent) path; zero once the disc is under the sea.
  const transmittance = transmittanceToTop(ATMOSPHERE.bottomRadius + VIEW_ALTITUDE, sun[1]),
    sunColor = SOLAR_WHITE.map((w, c) => w * SUN_ILLUMINANCE * transmittance[c] * gain);
  // The ground below the horizon: sand, sandstone and sea, about 18 % albedo, lit by sun and sky.
  const sunOnGround = sunColor.map((v) => v * Math.max(0, sun[1])),
    ground = [0.21, 0.17, 0.13].map((albedo, c) => (albedo * (sunOnGround[c] + irradiance[c])) / Math.PI);
  // Moonlight, authored rather than physical (a full moon is 400 000 times dimmer than the sun): the
  // night's key light, brighter with the illuminated fraction, reddened near the horizon like the sun.
  const moonUp = moon ? Math.max(0, Math.min(1, moon[1] * 8 + 0.15)) : 0,
    moonTransmittance = moon ? transmittanceToTop(ATMOSPHERE.bottomRadius + VIEW_ALTITUDE, moon[1]) : [0, 0, 0],
    moonColor = [0.74, 0.82, 1.0].map(
      (tint, c) => tint * 0.22 * (0.25 + 0.75 * moonIllumination) * moonUp * Math.sqrt(moonTransmittance[c]) * nightWeight
    );
  // A marine layer greys and flattens the light: the sun is veiled, the sky brightens to a grey deck.
  const veil = 1 - 0.85 * marine;
  // Partial chromatic adaptation (von Kries): the eye discounts a little of the light's colour cast
  // (ADAPTATION), so a frame lit by the last red sun keeps some distinction between its colours. The white is the chromaticity of everything lighting a level
  // surface (sun and sky); every natural light below is divided by it.
  const total = irradiance.map((e, c) => e + sunColor[c] * Math.max(0.05, sun[1])),
    totalLuminance = Math.max(1e-9, luminance(total)),
    white = total.map((e) => 1 + ADAPTATION * (e / totalLuminance - 1)),
    balance = (color) => color.map((v, c) => v / Math.max(0.2, white[c]));
  const balancedSun = balance(sunColor.map((v) => v * veil)),
    balancedMoon = balance(moonColor.map((v) => v * (1 - 0.7 * marine)));
  return {
    elevation,
    gain,
    white,
    skyScale: balance(skyScale),
    zenith: balance(zenith.map((v) => v * (1 - marine) + (marine * 0.55 * luminance(irradiance)) / Math.PI)),
    horizon: balance(horizon.map((v) => v * (1 - marine) + (marine * 0.7 * luminance(irradiance)) / Math.PI)),
    irradiance: balance(irradiance),
    ground: balance(ground),
    night,
    nightWeight,
    sunColor: balancedSun,
    sunTransmittance: transmittance,
    sunLuminance: luminance(balancedSun),
    moonColor: balancedMoon,
    moonLuminance: luminance(balancedMoon),
  };
}

// ── The dome ────────────────────────────────────────────────────────────────────────────────────
// Everything at infinity in one shader: the scattering sky, the night that follows twilight, the
// stars on the turning celestial sphere, the moon with its true phase, the sun's disc where
// refraction lifts and squashes it, and the Pacific beyond the modelled sea with the sun's glitter
// (Cox and Munk's slope statistics). The coast's own haze lies over all of it, so land that the haze
// dissolves meets a horizon of the same colour.
export const atmosphereSkyGLSL = `
uniform sampler2D atmoTransmittance, atmoSkyView;
uniform vec3 atmoSun, atmoSunLight, atmoMoon, atmoMoonLight, atmoScale, atmoNightZenith, atmoNightHorizon, atmoAmbient;
uniform vec4 atmoHaze, atmoMarine;
uniform vec3 atmoHazeAway;
uniform float atmoSeaSlope;
// The coast's haze: an exponential layer over the sea (density x per metre at sea level, scale
// height y m) reaching z m from the eye, scattering with albedo w. The optical depth of a ray from
// a height over the sea, by the exact integral of the layer along it.
float atmoHazeDepth(float height, float dirY, float len) {
  float H = atmoHaze.y, base = atmoHaze.x * exp(-max(height, 0.0) / H), k = dirY / H;
  return abs(k * len) < 1e-4 ? base * len : base * (1.0 - exp(-k * len)) / k;
}
// A graduated filter's soft shoulder on the sky's own radiance (SKY_KNEE): the aureole of a low sun
// stays a bright glow instead of washing the frame out, and the ordinary sky is all but untouched.
vec3 atmoSkyRadiance(vec3 d) {
  vec3 night = mix(atmoNightHorizon, atmoNightZenith, pow(max(d.y, 0.0), 0.45));
  vec3 sky = texture2D(atmoSkyView, atmoSkyViewUv(d, atmoSun)).rgb * atmoScale;
  sky /= 1.0 + dot(sky, vec3(0.2126, 0.7152, 0.0722)) / ${glslFloat(SKY_KNEE)};
  // May Gray: on the thickest marine mornings a stratus deck closes over the coast, grey and a
  // little brighter overhead, with the sun a diffuse glow behind it (atmoMarine.z, 0 to 1).
  if (atmoMarine.z > 0.0) {
    float grey = dot(atmoAmbient, vec3(0.2126, 0.7152, 0.0722));
    vec3 deck = vec3(0.93, 0.95, 1.0) * grey * (0.82 + 0.3 * max(d.y, 0.0))
      + atmoSunLight * 0.06 * pow(max(dot(d, atmoSun), 0.0), 10.0);
    sky = mix(sky, deck, atmoMarine.z * smoothstep(-0.02, 0.06, d.y));
  }
  return sky + night;
}
// The sky a little above the horizon in d's azimuth (2.5 degrees, where a sunset's glow sits): the
// light the haze takes, warm and bright toward the sun, cool away from it.
vec3 atmoHorizonRadiance(vec3 d) {
  vec2 h = d.xz;
  float l = length(h);
  vec2 a = l > 1e-5 ? h / l : vec2(1.0, 0.0);
  return atmoSkyRadiance(vec3(a.x * 0.99905, 0.0436, a.y * 0.99905));
}
// The haze's light: the antisolar horizon's (atmoHazeAway, from the CPU's sky each light step),
// plus the sun's share where the sun reaches the haze (sunVisibility, 1 in open air, which gives
// exactly the horizon's own colour; the volume pass lowers it in shadow, which draws the shafts).
vec3 atmoHazeSource(vec3 d, float sunVisibility) {
  vec3 away = atmoHazeAway;
  vec3 here = atmoHorizonRadiance(d);
  return atmoHaze.w * (min(away, here) + max(here - away, vec3(0.0)) * sunVisibility);
}
vec3 atmoApplyHaze(vec3 color, vec3 d, float heightM, float len, float sunVisibility) {
  float transmittance = exp(-atmoHazeDepth(heightM, d.y, len));
  return color * transmittance + (1.0 - transmittance) * atmoHazeSource(d, sunVisibility);
}
// The Pacific out to the horizon: the sky's reflection by Fresnel, the deep water's own light, and
// the sun's and moon's glitter from Cox and Munk's isotropic slope distribution.
float atmoGlint(vec3 d, vec3 light, float cosV) {
  vec3 h = normalize(light - d);
  float cosB = max(h.y, 1e-3), tan2 = (1.0 - cosB * cosB) / (cosB * cosB);
  float pdf = exp(-tan2 / atmoSeaSlope) / (ATMO_PI * atmoSeaSlope);
  float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(h, light), 0.0), 5.0);
  return light.y > -0.01 ? fresnel * pdf / (4.0 * max(cosV, 0.03) * pow(cosB, 4.0)) : 0.0;
}
vec3 atmoFarSea(vec3 d, float heightKm, out float distanceM) {
  float r0 = ATMO_BOTTOM + heightKm, b = r0 * d.y, c = heightKm * (2.0 * ATMO_BOTTOM + heightKm);
  float t = -b - sqrt(max(b * b - c, 0.0));
  distanceM = t * 1000.0;
  float cosV = max(1e-3, -d.y);
  float fresnel = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
  vec3 sky = atmoSkyRadiance(vec3(d.x, max(-d.y, 0.002), d.z));
  vec3 water = vec3(0.012, 0.034, 0.045) * atmoAmbient;
  vec3 glitter = atmoSunLight * atmoGlint(d, atmoSun, cosV) + atmoMoonLight * atmoGlint(d, atmoMoon, cosV);
  // The glint's slope statistics diverge at grazing angles, where the swell hides most facets.
  glitter /= 1.0 + dot(glitter, vec3(0.2126, 0.7152, 0.0722)) / 2.0;
  vec3 surface = fresnel * sky + (1.0 - fresnel) * water + glitter;
  vec4 view = texture2D(atmoSkyView, atmoSkyViewUv(d, atmoSun));
  return surface * view.a + view.rgb * atmoScale;
}
// What lies at infinity along d for an eye heightM over the sea: the sky, or the sea beyond the
// modelled water. hazeLength is how far the coast's haze reaches along d; sky is 1 above the horizon.
vec3 atmoBackground(vec3 d, float heightM, out float hazeLength, out float sky) {
  float heightKm = heightM * 0.001;
  float dip = sqrt(2.0 * heightKm / ATMO_BOTTOM);
  hazeLength = atmoHaze.z;
  sky = d.y >= -dip ? 1.0 : 0.0;
  vec3 color;
  if (sky > 0.5) {
    color = atmoSkyRadiance(d);
  } else {
    float distanceM = 0.0;
    color = atmoFarSea(d, heightKm, distanceM);
    hazeLength = min(hazeLength, distanceM);
    // The marine layer seen from above: a bank lying on the sea out to the horizon, its top lit like
    // a stratus deck (about 65 % albedo, a silver glow toward the sun). Close by, haze.mjs marches
    // its billows; out here it is flat. atmoMarine: thickness, top above the sea (m).
    float toTop = (heightM - atmoMarine.y) / max(-d.y, 1e-5);
    if (atmoMarine.x > 0.0 && heightM > atmoMarine.y && toTop < distanceM) {
      hazeLength = min(atmoHaze.z, toTop);
      float c = max(dot(d, atmoSun), 0.0);
      vec3 top = 0.65 * (atmoSunLight * max(atmoSun.y, 0.0) * (1.0 + 2.5 * pow(c, 8.0)) / ATMO_PI + atmoAmbient);
      color = mix(color, top, clamp(atmoMarine.x * 1.6, 0.0, 1.0));
    }
  }
  return color;
}
// The dome's colour along d, hazed: what a dissolving distant object gives way to.
vec3 atmoDome(vec3 d, float heightM) {
  float len, sky;
  vec3 color = atmoBackground(d, heightM, len, sky);
  return atmoApplyHaze(color, d, heightM, len, 1.0);
}
`;

const skyVertex = `
varying vec3 atmoDirection;
void main() {
  atmoDirection = (modelMatrix * vec4(position, 1.0)).xyz - cameraPosition;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const skyFragment = `
precision highp float;
uniform float atmoCapture, atmoMirror, atmoSunSquash, atmoStarGain;
uniform vec3 atmoSunCentre, atmoMoonSun;
uniform vec4 atmoSunDisc, atmoMoonDisc;
uniform mat3 atmoStarFrame;
varying vec3 atmoDirection;
${atmosphereConstantsGLSL}
${atmosphereSkyGLSL}
float atmoHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
vec3 atmoTransmittanceAlong(vec3 d, float heightKm) {
  return texture2D(atmoTransmittance, atmoTransmittanceUv(ATMO_BOTTOM + heightKm, d.y)).rgb;
}
// A disc of angular radius rho about c in the tangent plane, squashed vertically: x coverage, yz offset.
vec3 atmoDisc(vec3 d, vec3 c, float rho, float squash) {
  vec3 right = normalize(cross(c, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, c);
  vec2 q = vec2(dot(d, right), dot(d, up) / squash) / rho;
  float r2 = dot(q, q), aa = max(fwidth(r2), 1e-4);
  return vec3(1.0 - smoothstep(1.0 - aa, 1.0 + aa, r2), q);
}
vec3 atmoSunDiscRadiance(vec3 d, float heightKm) {
  if (dot(d, atmoSunCentre) < cos(atmoSunDisc.w * 1.6)) return vec3(0.0);
  vec3 disc = atmoDisc(d, atmoSunCentre, atmoSunDisc.w, atmoSunSquash);
  float mu = sqrt(max(0.0, 1.0 - dot(disc.yz, disc.yz)));
  // Limb darkening with u = 0.6, normalized to the disc's mean.
  float limb = (1.0 - 0.6 * (1.0 - mu)) / 0.8;
  vec3 radiance = atmoSunDisc.rgb * atmoTransmittanceAlong(d, heightKm) * limb * disc.x;
  float l = dot(radiance, vec3(0.2126, 0.7152, 0.0722));
  // Beyond saturation the exact radiance only feeds the bloom; keep its halo a halo.
  return radiance * min(1.0, 20.0 / max(l, 1e-6));
}
vec3 atmoMoonRadiance(vec3 d, float heightKm) {
  if (atmoMoonDisc.w <= 0.0 || dot(d, atmoMoon) < cos(atmoMoonDisc.x * 1.6)) return vec3(0.0);
  vec3 disc = atmoDisc(d, atmoMoon, atmoMoonDisc.x, 1.0);
  if (disc.x <= 0.0) return vec3(0.0);
  vec3 right = normalize(cross(atmoMoon, vec3(0.0, 1.0, 0.0))), up = cross(right, atmoMoon);
  float z = sqrt(max(0.0, 1.0 - dot(disc.yz, disc.yz)));
  vec3 normal = disc.y * right + disc.z * up - z * atmoMoon;
  // Lommel–Seeliger scattering, flatter than Lambert, as regolith is.
  float mu0 = max(0.0, dot(normal, atmoMoonSun)), mu = max(0.05, z);
  float lit = 2.0 * mu0 / (mu0 + mu);
  // Maria, placed roughly as on the near side: Imbrium, Serenitatis, Tranquillitatis, Procellarum, Nubium.
  vec2 q = disc.yz;
  float maria = exp(-dot(q - vec2(-0.32, 0.38), q - vec2(-0.32, 0.38)) * 14.0);
  maria += 0.8 * exp(-dot(q - vec2(0.18, 0.36), q - vec2(0.18, 0.36)) * 22.0);
  maria += 0.9 * exp(-dot(q - vec2(0.34, 0.08), q - vec2(0.34, 0.08)) * 16.0);
  maria += 0.7 * exp(-dot(q - vec2(-0.55, -0.05), q - vec2(-0.55, -0.05)) * 7.0);
  maria += 0.5 * exp(-dot(q - vec2(-0.1, -0.38), q - vec2(-0.1, -0.38)) * 18.0);
  float albedo = 1.0 - 0.38 * clamp(maria, 0.0, 1.0);
  vec3 earthshine = vec3(0.0016, 0.0019, 0.0024) * atmoMoonDisc.y;
  return (atmoMoonDisc.y * lit * albedo * vec3(1.0, 0.985, 0.96) + earthshine) * atmoTransmittanceAlong(d, heightKm) * disc.x;
}
vec3 atmoStars(vec3 d, float heightKm) {
  if (atmoStarGain <= 0.0 || d.y < -0.02) return vec3(0.0);
  vec3 e = atmoStarFrame * d;
  float density = 150.0;
  vec3 cell = floor(e * density);
  if (atmoHash(cell) > 0.42) return vec3(0.0);
  vec3 star = (cell + 0.2 + 0.6 * vec3(atmoHash(cell + 11.3), atmoHash(cell + 27.1), atmoHash(cell + 41.7))) / density;
  vec3 offset = star - e;
  offset -= dot(offset, e) * e;
  float pixel = max(length(fwidth(e)), 1e-5);
  float r2 = dot(offset, offset) / (pixel * pixel);
  float magnitude = pow(atmoHash(cell + 3.7), 9.0);
  vec3 tint = mix(vec3(1.0, 0.82, 0.62), vec3(0.78, 0.86, 1.0), atmoHash(cell + 7.9));
  // About a pixel wide whatever the zoom; brightness stays with its magnitude.
  return tint * magnitude * exp(-r2 * 1.1) * atmoStarGain * atmoTransmittanceAlong(d, heightKm);
}
void main() {
  vec3 d = normalize(atmoDirection);
  float heightM = max(1.0, cameraPosition.y - ${glslFloat(SEA_LEVEL)});
  float len, sky;
  vec3 color = atmoBackground(d, heightM, len, sky);
  if (sky > 0.5 && atmoCapture < 0.5) {
    float heightKm = heightM * 0.001;
    color += atmoStars(d, heightKm) + atmoMoonRadiance(d, heightKm);
    if (atmoMirror < 0.5) color += atmoSunDiscRadiance(d, heightKm);
  }
  gl_FragColor = vec4(atmoApplyHaze(color, d, heightM, len, 1.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const smoothstepRange = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Greenwich mean sidereal time (Meeus 12.4) turned into the rotation from the scene's (north, up,
// east) to equatorial coordinates (x toward right ascension 0, z toward the celestial pole).
function siderealFrame(utcMilliseconds, longitude, latitude) {
  const jd = utcMilliseconds / 86400000 + 2440587.5,
    T = (jd - 2451545.0) / 36525,
    gmst = (((280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T) % 360) + 360) % 360,
    L = (gmst + longitude) * DEG,
    phi = latitude * DEG;
  const [cL, sL, cP, sP] = [Math.cos(L), Math.sin(L), Math.cos(phi), Math.sin(phi)];
  return [-cL * sP, cL * cP, -sL, -sL * sP, sL * cP, cL, cP, sP, 0];
}
// A true direction (north, up, east) lifted by refraction to where it appears.
export function apparentDirection(direction) {
  const [n, u, e] = direction,
    h = Math.hypot(n, e) || 1,
    elevation = Math.asin(Math.max(-1, Math.min(1, u))),
    lifted = elevation + refraction(elevation);
  return [(n / h) * Math.cos(lifted), Math.sin(lifted), (e / h) * Math.cos(lifted)];
}
// Where the enlarged disc is drawn: its top limb where the physical top limb appears, so it sets at
// NOAA's minute, and squashed vertically as refraction squashes the physical disc.
export function sunDisc(direction) {
  const [n, u, e] = direction,
    rho = ATMOSPHERE.sunAngularRadius,
    trueElevation = Math.asin(Math.max(-1, Math.min(1, u))),
    topTrue = trueElevation + rho,
    squash = Math.max(0.6, 1 - (refraction(trueElevation - rho) - refraction(topTrue)) / (2 * rho)),
    centre = topTrue + refraction(topTrue) - DISC_RADIUS * squash,
    h = Math.hypot(n, e) || 1;
  return { centre: [(n / h) * Math.cos(centre), Math.sin(centre), (e / h) * Math.cos(centre)], squash, topElevation: topTrue + refraction(topTrue) };
}

// Comparison flag (session URL): ?weather=clear|marine|cirrus pins the day's mood instead of drawing
// it from the date.
const FORCED_WEATHER = {
  clear: { marine: 0, eveningMarine: false, cirrus: 0 },
  marine: { marine: 0.85, eveningMarine: true, cirrus: 0.1 },
  cirrus: { marine: 0, eveningMarine: false, cirrus: 0.85 },
};
export function weatherOverride(search = globalThis.location?.search || "") {
  return FORCED_WEATHER[new URLSearchParams(search).get("weather")] || null;
}

export function createAtmosphere(renderer, { site = { latitude: 32.83, longitude: -117.27 }, weather: forcedWeather = weatherOverride() } = {}) {
  const target = (width, height) => {
    const t = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, depthBuffer: false });
    t.texture.minFilter = t.texture.magFilter = THREE.LinearFilter;
    t.texture.generateMipmaps = false;
    return t;
  };
  const transmittanceTarget = target(...TRANSMITTANCE),
    multipleTarget = target(...MULTIPLE),
    skyViewTarget = target(...SKY_VIEW);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    triangle = new THREE.BufferGeometry();
  triangle.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const pass = (fragmentShader, passUniforms) =>
    new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader,
      uniforms: passUniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
  // Shared by the dome, the haze pass and any material that binds them (`describe().uniforms`).
  const uniforms = {
    atmoTransmittance: { value: transmittanceTarget.texture },
    atmoMultiple: { value: multipleTarget.texture },
    atmoSkyView: { value: skyViewTarget.texture },
    atmoSun: { value: new THREE.Vector3(0, 1, 0) },
    atmoSunCentre: { value: new THREE.Vector3(0, 1, 0) },
    atmoSunLight: { value: new THREE.Vector3() },
    atmoSunDisc: { value: new THREE.Vector4(0, 0, 0, DISC_RADIUS) },
    atmoSunSquash: { value: 1 },
    atmoMoon: { value: new THREE.Vector3(0, -1, 0) },
    atmoMoonSun: { value: new THREE.Vector3(0, 1, 0) },
    atmoMoonLight: { value: new THREE.Vector3() },
    atmoMoonDisc: { value: new THREE.Vector4(DISC_RADIUS, 0, 0, 0) },
    atmoScale: { value: new THREE.Vector3(1, 1, 1) },
    atmoNightZenith: { value: new THREE.Vector3() },
    atmoNightHorizon: { value: new THREE.Vector3() },
    atmoStarFrame: { value: new THREE.Matrix3() },
    atmoStarGain: { value: 0 },
    // Mean square slope of the distant sea: Cox and Munk's 0.003 + 0.00512 U for a 5 m/s breeze is
    // 0.029; the distant water also folds the swell the sea plane resolves into its slopes, so the
    // glitter path toward the horizon matches the modelled sea's broadened highlight at its edge.
    atmoSeaSlope: { value: 0.08 },
    atmoHaze: { value: new THREE.Vector4(HAZE.density, HAZE.scaleHeight, HAZE.range, HAZE.albedo) },
    // The marine layer: thickness (0 to 1), its top above the sea (m), the overcast deck (0 to 1).
    atmoMarine: { value: new THREE.Vector4() },
    atmoAmbient: { value: new THREE.Vector3() },
    atmoHazeAway: { value: new THREE.Vector3() },
    atmoCapture: { value: 0 },
    atmoMirror: { value: 0 },
  };
  const transmittanceMaterial = pass(transmittanceFragment, { atmoSteps: { value: 96 } }),
    multipleMaterial = pass(multipleFragment, {
      atmoTransmittance: uniforms.atmoTransmittance,
      atmoSqrtDirections: { value: 8 },
      atmoSteps: { value: 20 },
    }),
    skyViewMaterial = pass(skyViewFragment, {
      atmoTransmittance: uniforms.atmoTransmittance,
      atmoMultiple: uniforms.atmoMultiple,
      atmoSun: { value: new THREE.Vector3(0, 1, 0) },
      atmoSteps: { value: 40 },
    });
  const quad = new THREE.Mesh(triangle, transmittanceMaterial);
  quad.frustumCulled = false;
  let tablesDrawn = false,
    skyDraws = 0,
    state = null;
  function draw(material, renderTarget) {
    const previous = renderer.getRenderTarget(),
      autoClear = renderer.autoClear;
    quad.material = material;
    renderer.autoClear = false;
    try {
      renderer.setRenderTarget(renderTarget);
      renderer.render(quad, camera);
    } finally {
      renderer.setRenderTarget(previous);
      renderer.autoClear = autoClear;
    }
  }
  // The three table programs compile on the driver's threads while the coast loads; their first
  // draw comes with the first light step (program-warmup.mjs explains why that order matters).
  for (const material of [transmittanceMaterial, multipleMaterial, skyViewMaterial]) {
    quad.material = material;
    renderer.compile(quad, camera);
  }
  // The CPU's small tables (atmosphere-model.mjs, about 40 ms cold) in their own task, while the
  // models load; a light step that comes first builds them itself.
  setTimeout(() => atmosphereTables(), 0);
  const skyMaterial = new THREE.ShaderMaterial({
    name: "Coastal atmosphere dome",
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
  });

  // One light step: the sun, the moon, the stars, the day's weather and every colour the scene's
  // lights take. `daylight` is daylight.mjs's coastalDaylight (true solar position) for `dateKey`
  // and `minute` on the Pacific clock.
  function update({ daylight, dateKey, minute }) {
    const utc = Date.parse(`${dateKey}T00:00:00Z`) + (minute - daylight.offset * 60) * 60000,
      sun = apparentDirection(daylight.direction),
      disc = sunDisc(daylight.direction),
      moon = moonPosition(utc, site),
      moonDirection = apparentDirection(moon.direction),
      weather = forcedWeather ? { ...weatherFor(dateKey), ...forcedWeather } : weatherFor(dateKey),
      marine = marineLayerAt(weather, minute),
      overcast = smoothstepRange(0.62, 1, marine),
      light = skyLighting({ sun, moon: moonDirection, moonIllumination: moon.illumination, marine: overcast });
    if (!tablesDrawn) {
      draw(transmittanceMaterial, transmittanceTarget);
      draw(multipleMaterial, multipleTarget);
      tablesDrawn = true;
    }
    skyViewMaterial.uniforms.atmoSun.value.fromArray(sun);
    draw(skyViewMaterial, skyViewTarget);
    skyDraws++;
    uniforms.atmoSun.value.fromArray(sun);
    uniforms.atmoSunCentre.value.fromArray(disc.centre);
    uniforms.atmoSunSquash.value = disc.squash;
    uniforms.atmoScale.value.fromArray(light.skyScale);
    uniforms.atmoMarine.value.set(marine, marineTop(marine), overcast, 0);
    uniforms.atmoSunLight.value.fromArray(light.sunColor);
    const discScale = (SUN_ILLUMINANCE * light.gain * (1 - 0.95 * overcast)) / (Math.PI * DISC_RADIUS * DISC_RADIUS * disc.squash),
      balanced = SOLAR_WHITE.map((w, c) => (w * discScale) / Math.max(0.2, light.white[c]));
    uniforms.atmoSunDisc.value.set(...balanced, DISC_RADIUS);
    // The moon's disc radiance is sunlit regolith's (albedo 0.12), lifted with the eye's adaptation
    // but held under about eight times a white wall, so its bloom stays a glow.
    uniforms.atmoMoon.value.fromArray(moonDirection);
    uniforms.atmoMoonSun.value.fromArray(moon.sunDirection).normalize();
    uniforms.atmoMoonDisc.value.set(
      DISC_RADIUS,
      Math.min(8, (0.12 * SUN_ILLUMINANCE * light.gain * (1 - 0.95 * overcast)) / Math.PI),
      0,
      moonDirection[1] > -0.02 ? 1 : 0
    );
    uniforms.atmoMoonLight.value.fromArray(light.moonColor);
    const nightWeight = Math.max(0, Math.min(1, (-daylight.altitude - 3) / 10));
    uniforms.atmoNightZenith.value.fromArray(light.night.zenith).multiplyScalar(nightWeight);
    uniforms.atmoNightHorizon.value.fromArray(light.night.horizon).multiplyScalar(nightWeight);
    uniforms.atmoStarFrame.value.set(...siderealFrame(utc, site.longitude, site.latitude));
    // Starlight lifted by the same adaptation as the sky, so day hides it and night shows it.
    uniforms.atmoStarGain.value = 0.0012 * Math.min(light.gain, 600) * (1 - overcast);
    // The mean sky (for the deep water's own light and the fog's); marine mornings thicken the haze.
    uniforms.atmoAmbient.value.fromArray(light.irradiance).multiplyScalar(1 / Math.PI);
    // The antisolar horizon 2.5 degrees up, as the dome's atmoSkyRadiance draws it (the shafts' shade).
    {
      const azimuth = Math.atan2(-sun[2], -sun[0]),
        direction = [Math.cos(azimuth) * 0.99905, 0.0436, Math.sin(azimuth) * 0.99905],
        raw = skyRadiance(direction, sun).map((v, c) => v * light.skyScale[c]),
        shoulder = 1 / (1 + luminance(raw) / SKY_KNEE),
        basis = 0.0436 ** 0.45,
        away = raw.map((v, c) => v * shoulder + (light.night.horizon[c] + (light.night.zenith[c] - light.night.horizon[c]) * basis) * nightWeight);
      uniforms.atmoHazeAway.value.fromArray(away);
    }
    uniforms.atmoHaze.value.x = HAZE.density * (1 + 2.5 * marine);
    state = { light, sun, disc, moon, moonDirection, weather, marine, marineTop: marineTop(marine), overcast, daylight };
    return state;
  }
  return {
    uniforms,
    skyMaterial,
    update,
    get state() {
      return state;
    },
    setCapture(value) {
      uniforms.atmoCapture.value = value ? 1 : 0;
    },
    setMirror(value) {
      uniforms.atmoMirror.value = value ? 1 : 0;
    },
    evidence: () => ({
      method: "Hillaire 2020 transmittance, multiple-scattering and sky-view tables on Bruneton's parameterization",
      tables: { transmittance: TRANSMITTANCE, multiple: MULTIPLE, skyView: SKY_VIEW },
      skyDraws,
      sun: state && {
        apparentElevation: +(state.light.elevation / DEG).toFixed(3),
        trueElevation: +state.daylight.altitude.toFixed(3),
        discTop: +(state.disc.topElevation / DEG).toFixed(3),
      },
      moon: state && { elevation: +(Math.asin(state.moonDirection[1]) / DEG).toFixed(2), illumination: +state.moon.illumination.toFixed(3) },
      weather: state && { ...state.weather, marineNow: +state.marine.toFixed(3) },
      gain: state && +state.light.gain.toFixed(3),
    }),
    dispose() {
      for (const t of [transmittanceTarget, multipleTarget, skyViewTarget]) t.dispose();
      for (const m of [transmittanceMaterial, multipleMaterial, skyViewMaterial, skyMaterial]) m.dispose();
      triangle.dispose();
    },
  };
}

export { weatherFor, marineLayerAt, moonPosition };
