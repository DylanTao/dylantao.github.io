// What lies behind the footer coast: La Jolla's hills and the sky over them, in one screen-space
// layer at the far plane, and the hillside houses as one set of points in front of it.
//
// The frieze looks at the land from La Jolla Bay (skyline.mjs), so the band behind the coast is
// ground, not sea: the Torrey Pines mesa, the hills above La Jolla Shores and Mount Soledad, their
// skyline and relief measured from USGS 3DEP elevation, with houses from OpenStreetMap on their
// slopes. Only past Point La Jolla, beyond the panorama's reach, does the open Pacific meet the sky.
//
// The sky is physically based, after Hillaire 2020 (atmosphere.mjs): a sky-view table of radiance
// over the directions the frieze shows, rebuilt on the CPU only when the sun moves, read here once
// per pixel. The hills take the coast's own light (the same key and sky light as its roofs) on
// their measured slopes, their lower slopes hazier than their crests through the marine boundary
// layer, and their crests keep the sunset's glow longest. The layer composites in display colors:
// the sky is exposed for the eye's adaptation and tone-mapped as the output pass maps the coast
// (three r164 ACES), blended into the page in OKLab at the top edge, and then passed back through
// the inverse of that curve. It stays out of the sea's mirror and the contact pass. The setting sun
// is behind the viewer, sinking into the Pacific out of view; only the rising sun shows its disk,
// over the hills.
import * as THREE from "../three.module.min.js";
import {
  SKY_VIEW,
  buildSkyView,
  defaultTables,
  luminance,
  refraction,
  sampleSkyView,
  sunTransmittance,
  DEG,
} from "./atmosphere.mjs?v=coast-hills-20261024";
import { HEADLAND, bearingAt, houseLights, skylineAt, skylineStrip, xAtBearing } from "./skyline.mjs?v=coast-hills-20261026";
import { VIEW_BEARING, lookAt } from "./sky-look.mjs?v=coast-hills-20261026";

// three's ACES input and output matrices, row-major, and their inverses.
const ACES_IN = [0.59719, 0.35458, 0.04823, 0.076, 0.90834, 0.01566, 0.0284, 0.13383, 0.83777];
const ACES_OUT = [1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602];
const matrix = (m) => new THREE.Matrix3().set(...m);
const ACES_IN_M = matrix(ACES_IN),
  ACES_OUT_M = matrix(ACES_OUT),
  ACES_IN_INVERSE = matrix(ACES_IN).invert(),
  ACES_OUT_INVERSE = matrix(ACES_OUT).invert();
const fitInverse = (y) => {
  const a = 1 - 0.983729 * y,
    b = 0.0245786 - 0.432951 * y,
    c = -(0.000090537 + 0.238081 * y);
  return (-b + Math.sqrt(Math.max(b * b - 4 * a * c, 0))) / (2 * a);
};
const scratch = new THREE.Vector3();
// The scene color the output pass tone-maps to `display` (a linear display color) at `exposure`;
// the same inversion as the shader's, for colors set from script (the coast's haze).
export function sceneColor(display, exposure, out = new THREE.Color()) {
  scratch.set(display.r, display.g, display.b).applyMatrix3(ACES_OUT_INVERSE);
  scratch.set(...scratch.toArray().map((y) => fitInverse(Math.min(Math.max(y, 0), 0.99)))).applyMatrix3(ACES_IN_INVERSE);
  return out.setRGB(...scratch.toArray().map((v) => (Math.max(v, 0) * 0.6) / exposure));
}
// three's ACES for an exposed scene-linear color, to a linear display color.
export function displayColor(color, out = new THREE.Color()) {
  scratch.set(color.r / 0.6, color.g / 0.6, color.b / 0.6).applyMatrix3(ACES_IN_M);
  scratch
    .set(...scratch.toArray().map((v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081)))
    .applyMatrix3(ACES_OUT_M);
  return out.setRGB(...scratch.toArray().map((v) => Math.min(Math.max(v, 0), 1)));
}

// The hills stand on a plane this far behind the coast (scene z), where the sea horizon lies at
// HORIZON_Y and one degree of elevation spans DEGREE units, so the open sea beyond the headland
// meets the sky where the earlier backdrop put it, and the measured angles keep their proportions
// against the frieze's compressed bearings.
export const HILLS_Z = -24;
export const HORIZON_Y = -3.4;
export const DEGREE = 0.5;
const STRIP = { width: 1024, x0: -96, x1: 96 };
// The relief image's layout (bin/coastal_skyline.py RELIEF_*).
const RELIEF = { bearings: 929, bearingStep: 0.25, rows: 147, low: -0.4, step: 0.04, km: 8 };
export const RELIEF_URL = new URL("../../models/la-jolla/hills.png?v=coast-hills-20261026", import.meta.url).href;

const vertexShader = `
  varying vec2 vScreen;
  void main() {
    vScreen = position.xy * .5 + .5;
    gl_Position = vec4(position.xy, .99995, 1.);
  }`;

const fragmentShader = `
  uniform sampler2D uSkyView;
  uniform sampler2D uSkyline;
  uniform sampler2D uRelief;   // the ground the bay sees: slope (east, north) and distance (8 km)
  uniform vec3 uKey;           // toward the coast's key light, east, north, up
  uniform vec3 uMapX;        // screen (u, v, 1) to the hills' plane x
  uniform vec3 uMapE;        // screen (u, v, 1) to elevation in degrees above the sea horizon
  uniform vec2 uStrip;       // the skyline strip's first x and 1 / its span
  uniform vec4 uSun;         // bearing (degrees), screen u, v, disk radius (of the height)
  uniform vec3 uSunDisk;     // the disk's exposed radiance; zero when it does not show
  uniform float uDiskWeight; // how strongly the disk shows over the page by day
  uniform float uAspect;
  uniform vec3 uPage;        // the page behind the canvas, a linear display color
  uniform float uSkyWeight;  // how much of the physical sky shows (0 by day: the page is the sky)
  uniform vec2 uFade;        // screen v where the sky starts to dissolve into the page, and the top
  uniform vec3 uAlbedo;
  uniform vec3 uHillLight;   // the coast's key light (scene units, over pi)
  uniform vec3 uHillCrest;   // the same 250 m up, where the sun sets about three minutes later
  uniform vec3 uHillSky;     // and the sky's and the studio's light
  uniform vec3 uHaze;        // marine aerosol extinction at the sea (per km)
  uniform vec3 uClearAir;    // the air's own extinction (per km)
  uniform float uHazeHeight; // the aerosol's scale height (km)
  uniform float uSceneExposure;
  uniform mat3 uAcesIn;
  uniform mat3 uAcesOut;
  uniform mat3 uAcesInInverse;
  uniform mat3 uAcesOutInverse;
  varying vec2 vScreen;

  const float PI = 3.14159265;
  vec3 aces(vec3 c) {
    vec3 v = uAcesIn * (c / .6);
    v = (v * (v + .0245786) - .000090537) / (v * (.983729 * v + .432951) + .238081);
    return clamp(uAcesOut * v, 0., 1.);
  }
  // A display color to the scene color the output pass tone-maps back to it.
  vec3 sceneLinear(vec3 display) {
    vec3 y = clamp(uAcesOutInverse * display, 0., .99);
    vec3 a = 1. - .983729 * y, b = .0245786 - .432951 * y, c = -(.000090537 + .238081 * y);
    vec3 v = (-b + sqrt(max(b * b - 4. * a * c, 0.))) / (2. * a);
    return max(uAcesInInverse * v, 0.) * (.6 / uSceneExposure);
  }
  // OKLab (Björn Ottosson, 2020), for blends that look even.
  vec3 oklab(vec3 c) {
    vec3 lms = mat3(.4122214708, .2119034982, .0883024619, .5363325363, .6806995451, .2817188376, .0514459929, .1073969566, .6299787005) * c;
    lms = pow(max(lms, 0.), vec3(1. / 3.));
    return mat3(.2104542553, 1.9779984951, .0259040371, .7936177850, -2.4285922050, .7827717662, -.0040720468, .4505937099, -.8086757660) * lms;
  }
  vec3 linearFromOklab(vec3 c) {
    vec3 lms = mat3(1., 1., 1., .3963377774, -.1055613458, -.0894841775, .2158037573, -.0638541728, -1.2914855480) * c;
    return mat3(4.0767416621, -1.2684380046, -.0041960863, -3.3077115913, 2.6097574011, -.7034186147, .2309699292, -.3413193965, 1.7076147010) * (lms * lms * lms);
  }
  vec3 mixLab(vec3 a, vec3 b, float t) { return max(linearFromOklab(mix(oklab(a), oklab(b), t)), 0.); }
  // The sky-view table: azimuth from the sun as sqrt(phi / 180), elevation as Hillaire's
  // non-linear latitude around the horizon row (atmosphere.mjs skyViewElevationV).
  vec3 skyAt(float fromSun, float elevation) {
    float u = sqrt(clamp(fromSun / 180., 0., 1.));
    float e = radians(elevation), h = ${(SKY_VIEW.horizonRow / SKY_VIEW.rows).toFixed(6)};
    float v = e < 0. ? h * (1. - sqrt(min(1., -e / ${SKY_VIEW.below.toFixed(6)}))) : h + (1. - h) * sqrt(min(1., e / (PI * .5)));
    return texture2D(uSkyView, vec2(u, v)).rgb;
  }
  float smoother(float a, float b, float x) {
    float t = clamp((x - a) / (b - a), 0., 1.);
    return t * t * t * (t * (t * 6. - 15.) + 10.);
  }

  void main() {
    vec3 q = vec3(vScreen, 1.);
    float x = dot(uMapX, q), elevation = dot(uMapE, q);
    float s = (x - uStrip.x) * uStrip.y;
    vec4 ridge = texture2D(uSkyline, vec2(s, .25));  // skyline and nearer angles, their distances (km)
    vec4 more = texture2D(uSkyline, vec2(s, .75));   // skyline ground height (m), bearing, land
    float fromSun = abs(mod(more.y - uSun.x + 540., 360.) - 180.);

    // The sky.
    vec3 sky = skyAt(fromSun, max(elevation, -1.));
    // Below the horizon, wherever the land has given way (past the headland), the open sea mirrors
    // the sky over it.
    float sea = step(elevation, 0.);
    sky = mix(sky, skyAt(fromSun, -elevation) * .55 + vec3(.004, .007, .011), sea);
    vec3 color = aces(sky);
    float weight = uSkyWeight * (1. - smoother(uFade.x, uFade.y, vScreen.y));
    color = mixLab(uPage, color, weight);
    float alpha = step(.0004, weight);
    // The rising sun's disk where it clears the land, limb-darkened, over the sky or the page.
    vec2 toSun = vec2((vScreen.x - uSun.y) * uAspect, vScreen.y - uSun.z);
    float r = length(toSun) / max(uSun.w, 1e-4);
    float disk = (1. - smoothstep(.85, 1.05, r)) * uDiskWeight * step(.001, uSunDisk.r);
    color = mix(color, aces(uSunDisk * (1. - .55 * (1. - sqrt(max(1. - r * r, 0.))))), disk);
    alpha = max(alpha, disk);

    // The hills: their skyline from the measured profile, their relief and distance from the
    // ground the bay sees (bin/coastal_skyline.py).
    float edge = fwidth(elevation) * .8 + .002;
    float far = smoothstep(ridge.x + edge, ridge.x - edge, elevation) * more.z;
    if (far > 0.) {
      vec3 land = texture2D(uRelief, vec2((more.y / ${RELIEF.bearingStep.toFixed(2)} + .5) / ${RELIEF.bearings}., ((elevation - ${RELIEF.low.toFixed(3)}) / ${RELIEF.step.toFixed(3)} + .5) / ${RELIEF.rows}.)).rgb;
      vec2 slope = land.xy * 2. - 1.;
      vec3 normal = vec3(slope, sqrt(max(1. - dot(slope, slope), 0.)));
      float km = land.z * ${RELIEF.km.toFixed(1)};
      // The ground's height at this pixel (m), from its elevation angle and distance.
      float height = km * 1000. * tan(radians(max(elevation, 0.))) + 15. + km * km * .0683;
      // The marine aerosol thins with height, so the crests stand out sharper than the slopes.
      float rise = height * .001 / uHazeHeight;
      float path = km * (rise > .01 ? (1. - exp(-rise)) / rise : 1.);
      vec3 clear = exp(-(uHaze * path + uClearAir * km));
      // The coast's light on the slopes; at sunset the Earth's shadow climbs them and the crests keep
      // the glow longest.
      vec3 key = mix(uHillLight, uHillCrest, clamp(height / 250., 0., 1.));
      // Sunlight follows the measured ground normal. The coast's presentation studio does not
      // illuminate hills kilometres away; canyons retain shade instead of becoming a flat band.
      float sun = max(dot(normal, uKey), 0.);
      vec3 surface = uAlbedo * (key * sun + uHillSky * (.55 + .45 * normal.z));
      vec3 ground = aces(surface * uSceneExposure);
      // The air between: lit haze along a level path, whose limit is the sky at the horizon.
      vec3 air = mixLab(uPage, aces(skyAt(fromSun, .6)), uSkyWeight);
      vec3 hill = mix(air, ground, clear);
      color = mix(color, hill, far);
      alpha = max(alpha, far);
    }
    gl_FragColor = vec4(sceneLinear(color), alpha);
  }`;

// The hillside houses: points on the hills' plane, depth-tested so the coast stands in front. By
// day each is a few pixels of pale wall facing the bay, lit by the coast's key like the slopes
// around it and hazed like them (from the sea, Mount Soledad's houses glow at sunset); through the
// afterglow their windows light, each house at its own depth of dusk, warm, dimmed by the haze, and
// twinkling faintly while the coast is live.
const ACES_GLSL = `
  uniform mat3 uAcesIn;
  uniform mat3 uAcesOut;
  uniform mat3 uAcesInInverse;
  uniform mat3 uAcesOutInverse;
  uniform float uSceneExposure;
  vec3 aces(vec3 c) {
    vec3 v = uAcesIn * (c / .6);
    v = (v * (v + .0245786) - .000090537) / (v * (.983729 * v + .432951) + .238081);
    return clamp(uAcesOut * v, 0., 1.);
  }
  vec3 sceneLinear(vec3 display) {
    vec3 y = clamp(uAcesOutInverse * display, 0., .99);
    vec3 a = 1. - .983729 * y, b = .0245786 - .432951 * y, c = -(.000090537 + .238081 * y);
    vec3 v = (-b + sqrt(max(b * b - 4. * a * c, 0.))) / (2. * a);
    return max(uAcesInInverse * v, 0.) * (.6 / uSceneExposure);
  }`;
const lightVertex = `
  attribute vec4 aHouse;     // seed, haze transmittance, projected footprint width (world), bearing
  attribute vec2 aBuilding;  // facade height / width from footprint and height, roof form
  uniform float uOn;         // the windows: 0 by day, 1 at night
  uniform float uTime;
  uniform float uTwinkle;
  uniform float uPixel;
  uniform vec3 uKey;         // toward the coast's key light (east, north, up)
  uniform vec3 uWallKey;     // its irradiance over pi (scene units)
  uniform vec3 uWallSky;     // the sky's
  uniform vec3 uAir;         // the lit haze between the bay and the hills (display)
  ${ACES_GLSL}
  varying vec3 vWall;
  varying float vCover;
  varying vec3 vGlow;
  varying vec2 vAspect;
  varying float vRoof;
  varying float vSeed;
  void main() {
    float seed = aHouse.x, b = radians(aHouse.w);
    vSeed = seed;
    vRoof = aBuilding.y;
    vAspect = vec2(1., aBuilding.x) / max(1., aBuilding.x);
    // Walls and roofs face the bay; rough walls glow brightest with the sun behind the viewer.
    vec3 back = vec3(-sin(b), -cos(b), 0.);
    float facing = max(dot(normalize(back + vec3(0., 0., .3)), uKey), 0.) * (1. + .9 * pow(max(dot(back, uKey), 0.), 4.));
    vec3 wall = vec3(.5, .43, .36) * (.7 + .45 * fract(seed * 3.7)) * (uWallKey * facing * 1.3 + uWallSky);
    vWall = sceneLinear(mix(uAir, aces(wall * uSceneExposure), aHouse.y));
    // The walls fade into the dark as the windows take over.
    vCover = .8 * (1. - .85 * uOn);
    // Nine in ten houses light up as dusk deepens, each at its own moment; a few stay dark.
    float on = smoothstep(seed * .88, seed * .88 + .07, uOn) * step(seed, .92);
    float flicker = 1. + uTwinkle * .18 * sin(uTime * (1.7 + seed * 2.9) + seed * 40.) * sin(uTime * .63 + seed * 17.);
    // Warm interiors, a few cooler LED porches.
    vGlow = mix(vec3(1., .5, .2), vec3(1., .7, .42), fract(seed * 7.13)) * on * aHouse.y * flicker * .95;
    gl_PointSize = clamp(uPixel * aHouse.z * max(1., aBuilding.x), 1.4, 14.);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }`;
const lightFragment = `
  varying vec3 vWall;
  varying float vCover;
  varying vec3 vGlow;
  varying vec2 vAspect;
  varying float vRoof;
  varying float vSeed;
  void main() {
    vec2 q = vec2(gl_PointCoord.x * 2. - 1., 1. - gl_PointCoord.y * 2.) / vAspect;
    float aa = max(fwidth(q.x), fwidth(q.y)) * .65;
    float roofline = mix(.72, .9 - abs(q.x) * .4, vRoof);
    float body = (1. - smoothstep(.9 - aa, .9 + aa, abs(q.x))) * smoothstep(-.85 - aa, -.85 + aa, q.y) * (1. - smoothstep(roofline - aa, roofline + aa, q.y));
    float paneX = 1. - smoothstep(.18, .35, abs(fract((q.x + .9) / 1.8 * (2. + step(.6, vSeed))) - .5));
    float paneY = 1. - smoothstep(.16, .34, abs(q.y + .15));
    float window = paneX * paneY * body;
    float cover = body * vCover;
    if (cover < .004 && dot(vGlow, vGlow) < 1e-6) discard;
    // Premultiplied walls over the hills, the windows' light added on top.
    vec3 roof = vWall * vec3(.62, .5, .43);
    vec3 surface = mix(vWall, roof, smoothstep(.25 - aa, .25 + aa, q.y));
    gl_FragColor = vec4(surface * cover + vGlow * window, cover);
  }`;

function halfFloatTexture(data, width, height) {
  const texture = new THREE.DataTexture(
    Uint16Array.from(data, (v) => THREE.DataUtils.toHalfFloat(v)),
    width,
    height,
    THREE.RGBAFormat,
    THREE.HalfFloatType
  );
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// How much of the physical sky shows for a sun state: none by day (the page is the sky), all of it
// from sunset through the blue hour, fading into the night theme's page by nautical dusk.
export function skyWeight(state) {
  if (!state) return 0;
  const a = state.altitude;
  // Golden hour keeps the page as its sky, so the lit hills stand against it; the twilight colors
  // gather as the sun reaches the horizon. At dawn the glow behind the hills comes earlier.
  return (state.rising ? smooth(9, 2, a) : smooth(7, 0, a)) * smooth(-15, -9, a);
}

// The eye's adaptation as the light fails: exposure for the sky's reference radiance (120 degrees
// from the sun, 8 degrees up, where the frieze looks), adapting by 85 % of each stop, so the sky's
// display brightness falls gently (0.36 at golden hour, 0.28 at sunset, 0.14 at civil dusk) while
// its radiance falls a thousandfold, and the blue hour reads as dusk, not as a darkened noon. Below
// about 12.5 degrees the adaptation stops and the sky darkens into the night page.
export function skyExposure(reference) {
  return 0.7 / Math.pow(Math.max(reference, 2e-7), 0.85);
}

// Sun and sky on the distant hills under the same look as the coast (sky-look.mjs). The key's
// irradiance is divided by pi for diffuse ground. The presentation studio around the miniature
// contributes no illumination to distant terrain.
export function hillLight(look, out = { key: new THREE.Color(), sky: new THREE.Color() }) {
  out.key.set(look.sun).multiplyScalar(look.key / Math.PI);
  // At night the coast keeps a legible moonlit fill; the hills fall to a silhouette.
  const sky = new THREE.Color(look.sky).multiplyScalar(0.7).add(new THREE.Color(look.ground).multiplyScalar(0.3));
  out.sky.copy(sky).multiplyScalar(((1 - 0.75 * look.night) * look.fill) / Math.PI);
  return out;
}

// A light for each theme anchor, so the hills of a still (or a chosen theme) are lit as its coast.
const ANCHOR_SUN = { morning: 22, noon: 55, afternoon: 26, evening: -24 };

// The relief image as a data texture (flat ground facing up, 2 km off, if it could not load).
export async function loadRelief(url = RELIEF_URL) {
  try {
    const texture = await new THREE.TextureLoader().loadAsync(url);
    texture.generateMipmaps = false;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  } catch {
    const texture = new THREE.DataTexture(new Uint8Array([128, 128, 64, 255]), 1, 1);
    texture.needsUpdate = true;
    return texture;
  }
}

export function createSky({ relief, onLate = null }) {
  const tables = defaultTables();
  const strip = skylineStrip(STRIP.width, STRIP.x0, STRIP.x1);
  // Mark the land: past Point La Jolla, where the tapered skyline has met the horizon, the far
  // plane is open sea.
  for (let i = 0; i < strip.width; i++) {
    const o = (strip.width + i) * 4;
    strip.data[o + 2] = strip.data[o + 1] >= HEADLAND[1] ? 0 : 1;
  }
  const view = new Float32Array(SKY_VIEW.columns * SKY_VIEW.rows * 4);
  const viewTexture = halfFloatTexture(view, SKY_VIEW.columns, SKY_VIEW.rows);
  const uniforms = {
    uSkyView: { value: viewTexture },
    uSkyline: { value: halfFloatTexture(strip.data, strip.width, 2) },
    uRelief: { value: relief },
    uKey: { value: new THREE.Vector3(0, 0, 1) },
    uMapX: { value: new THREE.Vector3(60, 0, -30) },
    uMapE: { value: new THREE.Vector3(0, 20, -10) },
    uStrip: { value: new THREE.Vector2(STRIP.x0, 1 / (STRIP.x1 - STRIP.x0)) },
    uSun: { value: new THREE.Vector4(250, 2, 2, 0.02) },
    uSunDisk: { value: new THREE.Color(0, 0, 0) },
    uDiskWeight: { value: 0 },
    uAspect: { value: 4 },
    uPage: { value: new THREE.Color(1, 1, 1) },
    uSkyWeight: { value: 0 },
    uFade: { value: new THREE.Vector2(0.8, 1) },
    // Late-October hills: dry golden grass and chaparral, pale stucco and tile roofs.
    // Chaparral, dry grass and eucalyptus between the houses.
    uAlbedo: { value: new THREE.Color(0.18, 0.145, 0.095) },
    uHillLight: { value: new THREE.Color(1, 1, 1) },
    uHillCrest: { value: new THREE.Color(1, 1, 1) },
    uHillSky: { value: new THREE.Color(0.3, 0.3, 0.3) },
    uHaze: { value: new THREE.Vector3(0.11, 0.12, 0.14) },
    uClearAir: { value: new THREE.Vector3(0.0058, 0.0136, 0.0331) },
    uHazeHeight: { value: 0.5 },
    uSceneExposure: { value: 1 },
    uAcesIn: { value: ACES_IN_M },
    uAcesOut: { value: ACES_OUT_M },
    uAcesInInverse: { value: ACES_IN_INVERSE },
    uAcesOutInverse: { value: ACES_OUT_INVERSE },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: true });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "CoastSky";
  mesh.frustumCulled = false;
  // Transparent surfaces draw back to front by render order: the sky goes first, before the sea.
  mesh.renderOrder = -1000;
  mesh.userData.noOcclusion = true;

  // The houses on the hills' plane.
  const houses = houseLights();
  const positions = new Float32Array(houses.length * 3),
    attributes = new Float32Array(houses.length * 4),
    footprints = new Float32Array(houses.length * 2);
  houses.forEach((house, i) => {
    const ground = skylineAt(house.bearing);
    const km = house.angle < ground.near + 0.02 ? ground.nearKm : ground.farKm;
    positions.set([house.x, HORIZON_Y + house.angle * DEGREE, HILLS_Z], i * 3);
    const distance = Math.max(house.distance, 100),
      widthAngle = (Math.atan2(house.width, distance) * 180) / Math.PI,
      width = Math.abs(xAtBearing(house.bearing + widthAngle / 2) - xAtBearing(house.bearing - widthAngle / 2)),
      height = ((Math.atan2(house.height, distance) * 180) / Math.PI) * DEGREE;
    attributes.set([house.seed, Math.exp(-0.14 * km), width, house.bearing], i * 4);
    footprints.set([Math.min(1.5, Math.max(0.3, height / Math.max(width, 0.01))), house.roof], i * 2);
  });
  const lightGeometry = new THREE.BufferGeometry();
  lightGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  lightGeometry.setAttribute("aHouse", new THREE.BufferAttribute(attributes, 4));
  lightGeometry.setAttribute("aBuilding", new THREE.BufferAttribute(footprints, 2));
  const lightUniforms = {
    uOn: { value: 0 },
    uTime: { value: 0 },
    uTwinkle: { value: 0 },
    uPixel: { value: 2.2 },
    uKey: uniforms.uKey,
    uWallKey: uniforms.uHillLight,
    uWallSky: uniforms.uHillSky,
    uAir: { value: new THREE.Color() },
    uSceneExposure: uniforms.uSceneExposure,
    uAcesIn: uniforms.uAcesIn,
    uAcesOut: uniforms.uAcesOut,
    uAcesInInverse: uniforms.uAcesInInverse,
    uAcesOutInverse: uniforms.uAcesOutInverse,
  };
  const lightMaterial = new THREE.ShaderMaterial({
    uniforms: lightUniforms,
    vertexShader: lightVertex,
    fragmentShader: lightFragment,
    transparent: true,
    depthWrite: false,
    // Premultiplied walls over the hills with the windows' light added; coverage (alpha) stays as
    // the hills left it.
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    fog: false,
  });
  const lights = new THREE.Points(lightGeometry, lightMaterial);
  lights.name = "HillsideLights";
  lights.frustumCulled = false;
  lights.renderOrder = -999;
  // The contact pass hides points by itself and restores them after; marking them noOcclusion as
  // well would cache them hidden (realism.mjs createLegacyFinish) and leave them dark for good.

  let built = null,
    sunState = null,
    weight = 0,
    exposure = 1,
    sunScreen = { x: 0.5, y: 2, visible: false },
    sunRises = false,
    reference = 0,
    buildMs = 0;
  const point = new THREE.Vector3(),
    origin = new THREE.Vector3(),
    forward = new THREE.Vector3(),
    color = new THREE.Color();

  // The physical sky for a sun altitude, rebuilt only when the sun has moved (a minute on the clock
  // moves it by about a quarter of a degree).
  // The first table builds at once, before the first frame. Later ones (a minute on the clock moves
  // the sun by about a quarter of a degree) build four rows per task between frames into a second
  // table and swap in whole (onLate redraws), so no frame waits on them; while the sun arc is
  // dragged, each newer sun restarts the build and the sky catches up when the drag rests.
  const next = new Float32Array(view.length);
  let target = null,
    slicing = 0;
  function finish(altitude, cost) {
    reference = luminance(sampleSkyView(next, 8 * DEG, (120 * Math.PI) / 180));
    exposure = skyExposure(reference);
    for (let i = 0; i < next.length; i++) view[i] = (i & 3) === 3 ? 1 : next[i] * exposure;
    viewTexture.image.data.set(Uint16Array.from(view, (v) => THREE.DataUtils.toHalfFloat(Math.min(v, 60000))));
    viewTexture.needsUpdate = true;
    built = altitude;
    buildMs = cost;
  }
  function build(altitude) {
    if (target !== null && Math.abs(target - altitude) < 0.05) return;
    target = altitude;
    clearTimeout(slicing);
    if (built === null) {
      const started = performance.now();
      buildSkyView(altitude * DEG, { tables, out: next });
      finish(altitude, performance.now() - started);
      return;
    }
    let row = 0,
      cost = 0;
    const slice = () => {
      const started = performance.now();
      buildSkyView(altitude * DEG, { tables, out: next, from: row, to: row + 4 });
      row += 4;
      cost += performance.now() - started;
      if (row < SKY_VIEW.rows) slicing = setTimeout(slice, 0);
      else {
        finish(altitude, cost);
        onLate?.();
      }
    };
    slicing = setTimeout(slice, 0);
  }

  // Where a scene point on the hills' plane falls on the screen, as fractions of the canvas.
  function toScreen(camera, x, y) {
    point.set(x, y, HILLS_Z).project(camera);
    return { x: point.x * 0.5 + 0.5, y: point.y * 0.5 + 0.5 };
  }
  // The hills' plane under a screen point: the camera's parallel ray through it, met at HILLS_Z.
  function toPlane(camera, u, v) {
    origin.set(u * 2 - 1, v * 2 - 1, -1).unproject(camera);
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const t = (HILLS_Z - origin.z) / forward.z;
    return [origin.x + forward.x * t, (origin.y + forward.y * t - HORIZON_Y) / DEGREE];
  }

  return {
    mesh,
    lights,
    // The hour: the coast's look (sky-look.mjs) and La Jolla's sun (null for a theme's anchor), the
    // page color behind the canvas (linear display) and the coast's exposure and key direction.
    set(look, state, { page, keyDir, anchor = "noon" }) {
      sunState = state;
      weight = skyWeight(state);
      const altitude = state ? state.altitude : (ANCHOR_SUN[anchor] ?? 55);
      build(altitude);
      uniforms.uSkyWeight.value = weight;
      // The midday haze over the hills thins toward evening as the sea breeze dies.
      const hazy = 0.1 + 0.05 * smooth(4, 20, altitude);
      uniforms.uHaze.value.set(hazy * 0.92, hazy, hazy * 1.12);
      uniforms.uPage.value.copy(page);
      uniforms.uSceneExposure.value = look.exposure;
      uniforms.uSun.value.x = state ? state.azimuth : 180;
      // The slopes face the bay, toward the viewer and a little up: the coast's key and sky light
      // fall on them as on its roofs and bluff faces. Mount Soledad's crest, 250 m up, sees a horizon
      // half a degree lower, so it keeps the sun's glow about three minutes after the beach.
      const low = hillLight(look);
      // The key's direction in compass terms: the frieze looks along VIEW_BEARING (-z), with +x a
      // quarter turn clockwise of it.
      const forward = (VIEW_BEARING * Math.PI) / 180,
        right = forward + Math.PI / 2;
      uniforms.uKey.value
        .set(keyDir[0] * Math.sin(right) - keyDir[2] * Math.sin(forward), keyDir[0] * Math.cos(right) - keyDir[2] * Math.cos(forward), keyDir[1])
        .normalize();
      uniforms.uHillLight.value.copy(low.key);
      uniforms.uHillSky.value.copy(low.sky);
      uniforms.uHillCrest.value.copy(state ? hillLight(lookAt({ ...state, altitude: state.altitude + 0.5 })).key : low.key);
      // House windows light through the afterglow, on the coast's own night scale: a few at sunset,
      // most by the blue hour. By day the houses show as sunlit walls in the hills' haze.
      lightUniforms.uOn.value = Math.min(1, Math.max(0, (look.night - 0.45) / 0.5));
      const air = sampleSkyView(view, 0.6 * DEG, state ? (Math.abs(((bearingAt(0) - state.azimuth + 540) % 360) - 180) * Math.PI) / 180 : Math.PI);
      lightUniforms.uAir.value.copy(page).lerp(displayColor(color.setRGB(air[0], air[1], air[2])), weight);
      // The rising sun's disk, once it clears the horizon; the setting sun is behind the viewer.
      const rising = state?.rising && state.altitude > -1.2;
      if (rising) {
        const t = sunTransmittance(state.altitude * DEG, { tables });
        // The disk's radiance (per unit solar irradiance, a quarter-degree disk), exposed and capped.
        const disk = 1 / (Math.PI * (0.27 * DEG) ** 2);
        uniforms.uSunDisk.value.setRGB(...t.map((c) => Math.min(c * disk * exposure * 0.02, 40)));
      } else uniforms.uSunDisk.value.setRGB(0, 0, 0);
      // The disk fades as the morning sun climbs into the page's own daylight.
      uniforms.uDiskWeight.value = rising ? smooth(14, 6, state.altitude) : 0;
      sunRises = Boolean(rising);
      mesh.visible = true;
    },
    // Each frame: the screen-to-plane map for this camera, and the rising sun's place on screen.
    place(camera, { width, height }) {
      camera.updateMatrixWorld();
      const [x00, e00] = toPlane(camera, 0, 0),
        [x10, e10] = toPlane(camera, 1, 0),
        [x01, e01] = toPlane(camera, 0, 1);
      uniforms.uMapX.value.set(x10 - x00, x01 - x00, x00);
      uniforms.uMapE.value.set(e10 - e00, e01 - e00, e00);
      uniforms.uAspect.value = width / Math.max(height, 1);
      // The sky dissolves into the page over the upper half of the band between the sea horizon and
      // the canvas top (in OKLab, with a smootherstep that leaves no edge at either end), so the
      // sky over the hills keeps its color and no line marks where the page begins.
      const horizon = -(uniforms.uMapE.value.z + uniforms.uMapE.value.x * 0.5) / uniforms.uMapE.value.y;
      uniforms.uFade.value.set(horizon + (1 - horizon) * 0.5, 1);
      lightUniforms.uPixel.value = (height / Math.max(camera.top - camera.bottom, 1)) * Math.min(devicePixelRatio, 1.5);
      if (sunState) {
        const x = xAtBearing(sunState.azimuth);
        const apparent = sunState.altitude + refraction(sunState.altitude * DEG) / DEG;
        // The disk shows (and glitters on the bay) only once it clears the land at its bearing.
        sunScreen = { ...toScreen(camera, x, HORIZON_Y + apparent * DEGREE), visible: sunRises && apparent >= skylineAt(sunState.azimuth).far };
        const top = toScreen(camera, x, HORIZON_Y + (apparent + 0.9) * DEGREE);
        uniforms.uSun.value.y = sunScreen.x;
        uniforms.uSun.value.z = sunScreen.y;
        uniforms.uSun.value.w = Math.abs(top.y - sunScreen.y);
      } else sunScreen.visible = false;
    },
    tick(seconds, live) {
      lightUniforms.uTime.value = seconds;
      lightUniforms.uTwinkle.value = live ? 1 : 0;
    },
    // The sky at a direction from the frieze's centre, as a display color: the sea mirrors it.
    skyColor(elevation, out = new THREE.Color()) {
      const c = sampleSkyView(
        view,
        elevation * DEG,
        sunState ? (Math.abs(((bearingAt(0) - sunState.azimuth + 540) % 360) - 180) * Math.PI) / 180 : Math.PI
      );
      return displayColor(color.setRGB(c[0], c[1], c[2]), out);
    },
    get weight() {
      return weight;
    },
    get sun() {
      return sunScreen;
    },
    get visible() {
      return mesh.visible;
    },
    evidence() {
      return {
        visible: mesh.visible,
        weight: +weight.toFixed(3),
        exposure: +exposure.toFixed(2),
        lights: +lightUniforms.uOn.value.toFixed(3),
        buildMs: +buildMs.toFixed(1),
        sun: sunScreen.visible ? [+sunScreen.x.toFixed(3), +sunScreen.y.toFixed(3)] : null,
      };
    },
    dispose() {
      clearTimeout(slicing);
      geometry.dispose();
      material.dispose();
      viewTexture.dispose();
      uniforms.uSkyline.value.dispose();
      uniforms.uRelief.value.dispose();
      lightGeometry.dispose();
      lightMaterial.dispose();
    },
  };
}
