import * as THREE from "../three.module.min.js";
import { LA_JOLLA } from "./daylight.mjs";
import { STAR_COUNT, STAR_DATA } from "./star-catalogue.mjs";
import { SEA_LEVEL, atmosphereConstantsGLSL, atmosphereSkyGLSL } from "./atmosphere.mjs";
import { atmosphereTables, sampleTransmittance, ATMOSPHERE } from "./atmosphere-model.mjs";

// The night sky over La Jolla (Sirui, 2026-10-21: "the stars feel too shiny and fake during the night
// ... a bit too dense and bright"). The stars are the Yale Bright Star Catalogue's (star-catalogue.mjs,
// public domain), each drawn where it is at the actual minute: J2000 positions precessed to the date
// (IAU 1976, after Meeus, chapter 21) and turned by local sidereal time (Meeus 12.4). Whether a star
// shows at all is decided as the eye decides it: its magnitude, dimmed by the air along its line of
// sight (the atmosphere's own transmittance table and the coast's haze), against the naked eye's
// limiting magnitude for the brightness of the sky behind it (Schaefer 1993), where that sky is
// twilight from the scattering atmosphere, the moon's light and the glow of San Diego's suburbs
// (about 19.4 mag/arcsec^2 overhead, Bortle 5 to 6, brighter toward the horizon and most toward the
// city to the south-east, darkest over the sea). On an ordinary moonless night that leaves a few
// hundred stars, a hundred or so under a full moon, and in twilight they come out one at a time,
// brightest first.
//
// Each star is a point of light about a CSS pixel across, whatever the screen's density: its
// brightness follows its magnitude above the limit (compressed as perception compresses it), the
// brightest grow slightly instead of blooming, their colour comes from B-V through the blackbody
// locus, desaturated for the faint ones as night vision desaturates them, and they redden and
// twinkle toward the horizon on the scene's clock. One draw of 3,249 points, asleep by day.

export const SITE = LA_JOLLA;
const DEG = Math.PI / 180;
const LUMA = [0.2126, 0.7152, 0.0722];
// La Jolla's moonless night sky overhead, in V mag/arcsec^2 (Bortle 5 to 6: the coast faces a dark
// ocean, with San Diego's glow behind it).
export const NIGHT_SKY_MAGNITUDE = 19.4;
// The suburbs' glow grows toward the horizon, most toward the city (azimuth about 124 degrees, the
// south-east) and least over the sea: a factor on the zenith's glow for a unit (north, up, east).
const GLOW_TOWARD = [-0.56, 0.83];
export function glowFactor(direction) {
  const low = 1 - Math.max(direction[1], 0),
    across = Math.hypot(direction[0], direction[2]) || 1,
    city = Math.max(0, (direction[0] * GLOW_TOWARD[0] + direction[2] * GLOW_TOWARD[1]) / across);
  return 1 + 2.8 * low ** 3 * (0.45 + 0.55 * city);
}
// The sun's illuminance outside the atmosphere (lux): the sky table's radiance is per unit of it.
const SOLAR_LUX = 1.27e5;
// Luminance (cd/m^2) of a sky of surface brightness b (V mag/arcsec^2): L = 10.8e4 * 10^(-0.4 b).
export const skyLuminance = (b) => 1.08e5 * 10 ** (-0.4 * b);
export const skyMagnitude = (luminance) => -2.5 * Math.log10(Math.max(luminance, 1e-12) / 1.08e5);

// ── The catalogue ───────────────────────────────────────────────────────────────────────────────
export function decodeStars(data = STAR_DATA, count = STAR_COUNT) {
  const bytes = typeof atob === "function" ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0)) : new Uint8Array(Buffer.from(data, "base64"));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    direction = new Float32Array(count * 3),
    magnitude = new Float32Array(count),
    colorIndex = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const x = view.getInt16(i * 8, true) / 32767,
      y = view.getInt16(i * 8 + 2, true) / 32767,
      z = view.getInt16(i * 8 + 4, true) / 32767,
      length = Math.hypot(x, y, z) || 1;
    direction.set([x / length, y / length, z / length], i * 3);
    magnitude[i] = view.getUint8(i * 8 + 6) / 30 - 2;
    colorIndex[i] = view.getInt8(i * 8 + 7) / 60;
  }
  return { count, direction, magnitude, colorIndex };
}

// ── Colour ──────────────────────────────────────────────────────────────────────────────────────
// Effective temperature from B-V (Ballesteros, "New insights into black bodies", EPL 97, 34008, 2012).
export const bvTemperature = (bv) => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
// The blackbody's CIE 1931 chromaticity (Kim, Kim and others' cubic fits to the Planckian locus, 2002,
// valid from 1667 K to 25000 K).
export function planckianXY(temperature) {
  const T = Math.max(1667, Math.min(25000, temperature)),
    x =
      T <= 4000
        ? -0.2661239e9 / T ** 3 - 0.2343589e6 / T ** 2 + 0.8776956e3 / T + 0.17991
        : -3.0258469e9 / T ** 3 + 2.1070379e6 / T ** 2 + 0.2226347e3 / T + 0.24039,
    y =
      T <= 2222
        ? -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683
        : T <= 4000
          ? -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
          : 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483;
  return [x, y];
}
// Linear sRGB (D65 white) of a blackbody, scaled to unit luminance.
export function temperatureColor(temperature) {
  const [x, y] = planckianXY(temperature),
    X = x / y,
    Z = (1 - x - y) / y,
    rgb = [3.2404542 * X - 1.5371385 - 0.4985314 * Z, -0.969266 * X + 1.8760108 + 0.041556 * Z, 0.0556434 * X - 0.2040259 + 1.0572252 * Z].map((v) =>
      Math.max(0, v)
    ),
    luminance = rgb.reduce((sum, v, i) => sum + v * LUMA[i], 0) || 1;
  return rgb.map((v) => v / luminance);
}
// A star's colour, white-balanced to the 6504 K blackbody rather than to D65: the Planckian locus
// passes a little on the magenta side of D65 between about 5000 and 8000 K, which turned every
// white star faintly pink. Balanced to the locus itself, colours run blue, white, yellow, orange.
const LOCUS_WHITE = temperatureColor(6504);
export const starColor = (bv) => {
  const rgb = temperatureColor(bvTemperature(bv)).map((v, i) => v / LOCUS_WHITE[i]),
    luminance = rgb.reduce((sum, v, i) => sum + v * LUMA[i], 0) || 1;
  return rgb.map((v) => v / luminance);
};

// ── Time and the turning sky ────────────────────────────────────────────────────────────────────
export const julianDay = (utcMilliseconds) => utcMilliseconds / 86400000 + 2440587.5;
// Greenwich mean sidereal time in degrees (Meeus, Astronomical Algorithms, 2nd ed., equation 12.4).
export function greenwichMeanSiderealTime(utcMilliseconds) {
  const jd = julianDay(utcMilliseconds),
    T = (jd - 2451545.0) / 36525;
  return (((280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000) % 360) + 360) % 360;
}
// The rotation from J2000 equatorial coordinates to the mean equator and equinox of the date (IAU 1976
// precession, Meeus equations 21.2 and 21.4), row-major.
export function precessionMatrix(utcMilliseconds) {
  const T = (julianDay(utcMilliseconds) - 2451545.0) / 36525,
    arcsec = DEG / 3600,
    zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) * arcsec,
    z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) * arcsec,
    theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) * arcsec;
  const [cz, sz, ct, st, cZ, sZ] = [Math.cos(zeta), Math.sin(zeta), Math.cos(theta), Math.sin(theta), Math.cos(z), Math.sin(z)];
  return [
    cz * ct * cZ - sz * sZ,
    -sz * ct * cZ - cz * sZ,
    -st * cZ,
    cz * ct * sZ + sz * cZ,
    -sz * ct * sZ + cz * cZ,
    -st * sZ,
    cz * st,
    -sz * st,
    ct,
  ];
}
// From equatorial coordinates of the date to the scene's (north, up, east) for a local sidereal
// angle (radians) and a latitude (radians), row-major.
export function horizonMatrix(siderealAngle, latitude) {
  const [cL, sL, cP, sP] = [Math.cos(siderealAngle), Math.sin(siderealAngle), Math.cos(latitude), Math.sin(latitude)];
  return [-sP * cL, -sP * sL, cP, cP * cL, cP * sL, sP, -sL, cL, 0];
}
const multiply3 = (a, b) => {
  const out = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return out;
};
// J2000 equatorial to the scene's (north, up, east) at a UTC instant over a site, row-major.
export function starMatrix(utcMilliseconds, site = SITE) {
  const lst = (greenwichMeanSiderealTime(utcMilliseconds) + site.longitude) * DEG;
  return multiply3(horizonMatrix(lst, site.latitude * DEG), precessionMatrix(utcMilliseconds));
}
export const applyMatrix3 = (m, v) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
export function equatorialVector(rightAscensionDegrees, declinationDegrees) {
  const a = rightAscensionDegrees * DEG,
    d = declinationDegrees * DEG;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

// ── What the eye can see ────────────────────────────────────────────────────────────────────────
// Relative air mass for an apparent altitude (Kasten and Young, Applied Optics 28, 4735, 1989).
export function airmass(altitudeRadians) {
  const h = Math.max(-0.5, altitudeRadians / DEG);
  return 1 / (Math.sin(h * DEG) + 0.50572 * (h + 6.07995) ** -1.6364);
}
// The naked eye's limiting magnitude against a sky of surface brightness b (V mag/arcsec^2), after
// Schaefer ("Astronomy and the limits of vision", Vistas in Astronomy 36, 311, 1993): about 6.6 under
// a pristine 22 mag/arcsec^2 sky, 5.1 under La Jolla's 19.4, and below zero in bright twilight.
export const limitingMagnitude = (b) => 7.93 - 5 * Math.log10(10 ** (4.316 - b / 5) + 1);
// The moon's brightness relative to full at an illuminated fraction (Allen's phase law, as in Krisciunas
// and Schaefer 1991): 10^(-0.4 (0.026 |a| + 4e-9 a^4)) for a phase angle a in degrees.
export function moonPhaseFactor(illumination) {
  const a = Math.acos(Math.max(-1, Math.min(1, 2 * illumination - 1))) / DEG;
  return 10 ** (-0.4 * (0.026 * a + 4e-9 * a ** 4));
}
// The full moon high in the sky lights a suburban sky to about 18 mag/arcsec^2 by itself.
const FULL_MOON_SKY = skyLuminance(18.0);

// The night's brightness for a light step: the suburbs' glow overhead and the moon's share (cd/m^2).
export function nightSkyLight({ moonAltitude = -1, moonIllumination = 0, overcast = 0 } = {}) {
  const moonUp = Math.max(0, Math.min(1, (moonAltitude / DEG + 2) / 10)) * Math.sqrt(Math.max(0.05, Math.sin(Math.max(moonAltitude, 0.05))));
  return {
    glow: skyLuminance(NIGHT_SKY_MAGNITUDE),
    moon: FULL_MOON_SKY * moonPhaseFactor(moonIllumination) * moonUp,
    overcast,
  };
}
// The limiting magnitude overhead for a light step, for the evidence and the tests.
export function zenithLimit(light, twilightLuminance = 0) {
  return limitingMagnitude(skyMagnitude(light.glow + light.moon + twilightLuminance));
}

// How many catalogue stars clear the limit tonight, ignoring twilight: for the evidence.
export function countVisibleStars(stars, matrix, light, { heightM = 30 } = {}) {
  const tables = atmosphereTables(),
    r = ATMOSPHERE.bottomRadius + heightM * 0.001;
  let visible = 0,
    brightest = Infinity;
  for (let i = 0; i < stars.count; i++) {
    const d = applyMatrix3(matrix, [stars.direction[i * 3], stars.direction[i * 3 + 1], stars.direction[i * 3 + 2]]);
    if (d[1] <= 0.02) continue;
    const t = sampleTransmittance(tables.transmittance, r, d[1]),
      through = Math.max(1e-6, t[0] * LUMA[0] + t[1] * LUMA[1] + t[2] * LUMA[2]),
      limit = limitingMagnitude(skyMagnitude(light.glow * glowFactor(d) + light.moon)),
      magnitude = stars.magnitude[i] - 2.5 * Math.log10(through);
    if (magnitude < limit) {
      visible++;
      brightest = Math.min(brightest, magnitude);
    }
  }
  return { visible, brightest: Number.isFinite(brightest) ? +brightest.toFixed(2) : null };
}

// ── The star field ──────────────────────────────────────────────────────────────────────────────
const vertexShader = `
#define ATMO_FAR_FIELD
attribute vec3 starDirection;
attribute vec3 starColor;
attribute vec2 starInfo;
uniform mat3 starMatrix;
uniform vec4 starNight;
uniform float starTime, starPixelRatio, starTwinkle, starHeight;
varying vec3 vStarColor;
varying float vStarSpread, vStarSize;
${atmosphereConstantsGLSL}
${atmosphereSkyGLSL}
const vec3 STAR_LUMA = vec3(0.2126, 0.7152, 0.0722);
float starLog10(float x) { return log(max(x, 1e-30)) * 0.4342944819; }
float starHash(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
float starNoise(float t, float seed) {
  float i = floor(t), f = fract(t);
  return mix(starHash(i + seed * 97.31), starHash(i + 1.0 + seed * 97.31), f * f * (3.0 - 2.0 * f));
}
void main() {
  // Off screen unless the star is seen.
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = 0.0;
  vStarColor = vec3(0.0);
  vStarSpread = 1.0;
  vStarSize = 1.0;
  vec3 d = normalize(starMatrix * starDirection);
  float heightM = starHeight;
  float dip = sqrt(2.0 * heightM * 0.001 / ATMO_BOTTOM);
  // Refraction lifts a star near the horizon (Saemundsson's formula, as for the sun's disc).
  float trueAltitude = degrees(asin(clamp(d.y, -1.0, 1.0)));
  if (trueAltitude < -1.0 - degrees(dip)) return;
  float apparent = trueAltitude + 1.02 / tan(radians(trueAltitude + 10.3 / (trueAltitude + 5.11))) / 60.0;
  vec2 across = d.xz / max(length(d.xz), 1e-6);
  d = vec3(across.x * cos(radians(apparent)), sin(radians(apparent)), across.y * cos(radians(apparent)));
  if (d.y < -dip) return;
  // A star behind the far land's hills is hidden (far-field.mjs).
  if (farMarch(cameraPosition, d, 60000.0) > 0.0) return;
  // The air along the line of sight: the atmosphere's transmittance and the coast's haze.
  vec3 transmittance = texture2D(atmoTransmittance, atmoTransmittanceUv(ATMO_BOTTOM + heightM * 0.001, d.y)).rgb;
  float through = max(dot(transmittance, STAR_LUMA) * exp(-atmoHazeDepth(heightM, d.y, atmoHaze.z)), 1e-6);
  float magnitude = starInfo.x - 2.5 * starLog10(through);
  // The sky behind the star: twilight from the scattering atmosphere, the suburbs' glow (brighter
  // toward the horizon) and the moon's light (brighter near the moon).
  float twilight = dot(texture2D(atmoSkyView, atmoSkyViewUv(d, atmoSun)).rgb, STAR_LUMA) * SOLAR_LUX_PLACEHOLDER;
  float low = 1.0 - max(d.y, 0.0);
  float city = max(0.0, dot(d.xz, vec2(GLOW_X, GLOW_Z)) / max(length(d.xz), 1e-6));
  float nearMoon = acos(clamp(dot(d, atmoMoon), -1.0, 1.0));
  float sky = twilight + starNight.x * (1.0 + 2.8 * low * low * low * (0.45 + 0.55 * city))
    + starNight.y * (1.0 + 4.0 * exp(-nearMoon * nearMoon / 0.07));
  float b = -2.5 * starLog10(sky / 1.08e5);
  float limit = 7.93 - 5.0 * starLog10(pow(10.0, 4.316 - b / 5.0) + 1.0);
  // Brightness relative to the limit, faded out through the last magnitude below it.
  float excess = pow(10.0, -0.4 * (magnitude - limit));
  float visible = smoothstep(0.4, 1.5, excess) * (1.0 - starNight.w);
  if (visible <= 0.0) return;
  // Scintillation: a few percent overhead, growing with the air mass to the 1.5 power toward the
  // horizon, on the scene's clock (a paused or reduced-motion scene holds it still).
  float h = max(apparent, -0.5);
  float mass = 1.0 / (sin(radians(h)) + 0.50572 * pow(h + 6.07995, -1.6364));
  float twinkle = 1.0;
  if (starTwinkle > 0.0) {
    float n = starNoise(starTime * 7.3, starInfo.y) * 0.65 + starNoise(starTime * 17.9, starInfo.y + 3.1) * 0.35;
    twinkle = max(0.0, 1.0 + min(0.6, 0.05 * pow(mass, 1.5)) * (n - 0.5) * 3.2 * starTwinkle);
  }
  // On screen: a star at the limit is a little brighter than the sky behind it; brighter ones rise as
  // the 0.55 power of their flux and grow slightly, from a 1.25 CSS pixel point at the limit to 2.6
  // for the brightest, so even Vega is a bright point rather than a glare.
  float threshold = 0.02 + 1.4 * dot(atmoSkyRadiance(d), STAR_LUMA);
  float peak = min(1.4, threshold * pow(excess, 0.55)) * visible * twinkle;
  float fwhm = clamp(1.25 * pow(excess, 0.14), 1.25, 2.6) * starPixelRatio;
  float sigma2 = fwhm * fwhm / 5.5452;
  // A pixel integrates the point spread function: widen it by a box filter's variance (1/12) and
  // keep the light it carries, so a moving star neither crawls nor flickers.
  float spread = sigma2 + 0.0833;
  // Night vision sees little colour in faint stars; the air's reddening applies to every star.
  float saturation = clamp(0.3 + 0.16 * (limit - magnitude), 0.3, 0.9);
  vec3 reddening = transmittance / max(dot(transmittance, STAR_LUMA), 1e-4);
  vStarColor = mix(vec3(1.0), starColor, saturation) * reddening * peak * sigma2 / spread;
  vStarSpread = spread;
  vStarSize = 2.0 * ceil(3.0 * sqrt(spread)) + 1.0;
  gl_PointSize = vStarSize;
  // At infinity: the view's rotation only, on the far side of the depth range.
  vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * d, 0.0);
  clip.z = clip.w * 0.999999;
  gl_Position = clip;
}`
  .replace("SOLAR_LUX_PLACEHOLDER", SOLAR_LUX.toExponential(3))
  .replace("GLOW_X", GLOW_TOWARD[0].toFixed(2))
  .replace("GLOW_Z", GLOW_TOWARD[1].toFixed(2));

const fragmentShader = `
varying vec3 vStarColor;
varying float vStarSpread, vStarSize;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * vStarSize;
  float g = exp(-0.5 * dot(p, p) / vStarSpread);
  if (g < 0.003) discard;
  gl_FragColor = vec4(vStarColor * g, 1.0);
}`;

// `atmosphere` is atmosphere.mjs's createAtmosphere (its tables, sun, moon and haze uniforms);
// `clock` holds the scene's active seconds (environment.mjs's ocean time).
export function createStarField(atmosphere, { clock = { value: 0 }, site = SITE } = {}) {
  const stars = decodeStars(),
    geometry = new THREE.BufferGeometry(),
    colors = new Float32Array(stars.count * 3),
    info = new Float32Array(stars.count * 2);
  for (let i = 0; i < stars.count; i++) {
    colors.set(starColor(stars.colorIndex[i]), i * 3);
    info[i * 2] = stars.magnitude[i];
    info[i * 2 + 1] = (i * 0.618034) % 1;
  }
  // The vertex shader places each star; positions only give three a vertex count.
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(stars.count * 3), 3));
  geometry.setAttribute("starDirection", new THREE.BufferAttribute(stars.direction, 3));
  geometry.setAttribute("starColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("starInfo", new THREE.BufferAttribute(info, 2));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  const uniforms = {
    ...atmosphere.uniforms,
    starMatrix: { value: new THREE.Matrix3() },
    starNight: { value: new THREE.Vector4(skyLuminance(NIGHT_SKY_MAGNITUDE), 0, 0, 0) },
    starTime: clock,
    starPixelRatio: { value: 1 },
    // Steady until the scene first moves (environment.mjs update), so reduced motion never twinkles.
    starTwinkle: { value: 0 },
    starHeight: { value: 30 },
  };
  const material = new THREE.ShaderMaterial({
    name: "Coastal night stars",
    uniforms,
    vertexShader,
    fragmentShader,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "Coastal night stars";
  points.frustumCulled = false;
  // Right after the dome, which is the last opaque draw (900); the scene in front hides them.
  points.renderOrder = 901;
  points.userData.noContactOcclusion = true;
  let time = { utc: Date.now(), live: true },
    light = nightSkyLight(),
    awake = false,
    lastMatrix = null;
  const matrix = uniforms.starMatrix.value;
  const sync = () => {
    lastMatrix = starMatrix(time.live ? Date.now() : time.utc, site);
    matrix.set(...lastMatrix);
  };
  points.onBeforeRender = (renderer, scene, camera) => {
    sync();
    const target = renderer.getRenderTarget(),
      canvas = renderer.domElement;
    uniforms.starPixelRatio.value = Math.max(0.5, (target ? target.width : canvas.width) / Math.max(1, canvas.clientWidth || canvas.width));
    uniforms.starHeight.value = Math.max(1, camera.position.y - SEA_LEVEL);
  };
  return {
    points,
    material,
    get awake() {
      return awake;
    },
    // One light step: the instant (live follows the page clock to the millisecond; a preview holds its
    // minute), the sun's true altitude (degrees), the moon and the marine deck. Asleep by day.
    update({ utc, live = false, sunAltitude, moonAltitude = -1, moonIllumination = 0, overcast = 0 }) {
      time = { utc, live };
      light = nightSkyLight({ moonAltitude, moonIllumination, overcast });
      uniforms.starNight.value.set(light.glow, light.moon, 0, overcast);
      awake = sunAltitude < -2 && overcast < 0.999;
      points.visible = awake;
      sync();
    },
    // Scintillation follows the scene's clock; reduced motion holds every star steady.
    setMotion(moving) {
      uniforms.starTwinkle.value = moving ? 1 : 0;
    },
    evidence() {
      const counted = lastMatrix ? countVisibleStars(stars, lastMatrix, light) : null;
      return {
        method:
          "Yale Bright Star Catalogue (public domain) precessed to the date and turned by sidereal time; Schaefer 1993 naked-eye limit for the sky's brightness",
        catalogue: stars.count,
        awake,
        zenithLimit: +zenithLimit(light).toFixed(2),
        skyMagnitude: +skyMagnitude(light.glow + light.moon).toFixed(2),
        visibleOverhead: counted?.visible ?? null,
        brightest: counted?.brightest ?? null,
        twinkle: uniforms.starTwinkle.value,
      };
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
