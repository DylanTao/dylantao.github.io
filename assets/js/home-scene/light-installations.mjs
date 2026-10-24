import * as THREE from "../three.module.min.js";
import { mergeGeometries } from "../vendor/three-r164/utils/BufferGeometryUtils.js";

// Light installations that switch with the time of day (Sirui, 2026-10-14). Each fixture is an
// emitter shaded analytically in every material, bounded by a box so it cannot light rooms
// through walls, and driven by a schedule:
//   festoon  bulbs strung around the terrace, from dusk to half past eleven;
//   fire     the fire bowl by the terrace bench, flickering through the evening;
//   soffit   a concealed strip under the gallery edge washing the living floor's back wall;
//   steps    low lights beside the stair, a dim guide all night;
//   pool     a light in the onsen's wall that makes the water glow, brightest during the soak;
//   gym      the gym's two linear pendants, on while someone trains, as bright as the room is dim;
//   desk     the office's screens and the gaming PC's RGB, awake while Sirui works and dimmed to a
//            glow otherwise; the RGB drifts slowly through the hues while the scene moves;
//   pendant  the washi lantern over the dining table, full for meals and a soft glow through the
//            evening (manifest interiorLights);
//   downlights the soffit downlights over the working kitchen, two vault downlights over the island
//            and the light line under the kitchen's lower shelf: task light for every meal, a low
//            glow after dark otherwise;
//   room     authored mirror and shower coves, bright for a visit and a quiet glow at night.
// Line emitters use the exact irradiance of a uniformly emitting segment on a Lambertian
// surface, clipped to the surface's upper hemisphere: E = I |d| (2/D) [n0((2A+B)/|L1| - B/|L0|) -
// n1((B+2C)/|L1| - 2C/|L0|)], with L(t) = L0 + t d, A = d.d, B = 2 L0.d, C = L0.L0,
// D = 4AC - B^2, n0 = N.L0 and n1 = N.d (a closed form of the integral of N.L / |L|^3 along t).
// Points are isotropic or cone-limited. No installation casts shadows or adds a baked bounce.

export const MAX_LINES = 18;
export const MAX_POINTS = 10;
// Draco can put a delivered floor a few micrometres below its authored region. A bounded
// tolerance keeps those receivers lit without crossing the 25 cm gap between the storeys.
export const RECEIVER_TOLERANCE = 0.05;
const WARM = new THREE.Color(1, 0.7, 0.42);
const FIRE = new THREE.Color(1, 0.46, 0.16);
const POOL = new THREE.Color(0.42, 0.86, 0.9);
const GYM = new THREE.Color(1, 0.88, 0.74);
const LANTERN = new THREE.Color(1, 0.76, 0.5);
const MEALS = ["breakfast", "lunch", "dinner"];

function roomLines(config) {
  const lines = [];
  const finitePoint = (point) => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite);
  for (const room of config.rooms || []) {
    if (!room.lighting?.lines?.length) continue;
    const bounds = room.lightRegion;
    if (!bounds || !finitePoint(bounds.min) || !finitePoint(bounds.max) || !bounds.min.every((v, i) => v < bounds.max[i]))
      throw new RangeError(`Invalid light region for ${room.id}`);
    const region = { min: new THREE.Vector3(...bounds.min), max: new THREE.Vector3(...bounds.max) };
    for (const [index, source] of room.lighting.lines.entries()) {
      if (!finitePoint(source.a) || !finitePoint(source.b) || !Number.isFinite(source.intensity) || source.intensity < 0)
        throw new RangeError(`Invalid line light for ${room.id}`);
      const a = new THREE.Vector3(...source.a),
        b = new THREE.Vector3(...source.b);
      if (a.distanceToSquared(b) < 1e-8) throw new RangeError(`Empty line light for ${room.id}`);
      lines.push({ id: `room:${room.id}`, room: room.id, source: source.id || index, a, b, intensity: source.intensity, color: WARM, region });
    }
  }
  return lines;
}

// Transport-only midpoint approximations for the coves. Their energy is the existing line's
// intensity per metre times its length; no additional native light or arbitrary fill is added.
export function roomLightSources(config) {
  return roomLines(config).map((line) => ({
    id: `${line.room}:${line.source}`,
    position: line.a.clone().lerp(line.b, 0.5).toArray(),
    color: line.color.toArray(),
    distance: 0,
    emitterRadius: 0.04,
    region: {
      min: line.region.min.toArray().map((value) => value - RECEIVER_TOLERANCE),
      max: line.region.max.toArray().map((value) => value + RECEIVER_TOLERANCE),
    },
  }));
}

const insideRegion = (point, region) =>
  ["x", "y", "z"].every((axis) => point[axis] >= region.min[axis] - RECEIVER_TOLERANCE && point[axis] <= region.max[axis] + RECEIVER_TOLERANCE);

const smooth = (edge0, edge1, x) => {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
// 1 between start and end (minutes after midnight, wrapping past midnight), fading in over the
// window's first `fade` minutes and out over its last.
export function windowLevel(minute, start, end, fade = 15) {
  const span = (end - start + 1440) % 1440;
  const into = (minute - start + 1440) % 1440;
  if (into > span) return 0;
  return Math.max(0, Math.min(1, into / fade, (span - into) / fade));
}

// How dark it is outside (0 by day, 1 at night) and inside the cave, which dims sooner.
export function darkness(daylight) {
  return { outside: smooth(0.32, 0.08, daylight), inside: smooth(0.55, 0.15, daylight) };
}

export const SCHEDULES = {
  festoon: ({ minute, dark }) => dark.outside * windowLevel(minute, 16 * 60, 23 * 60 + 30, 20),
  fire: ({ minute, dark }) => dark.outside * windowLevel(minute, 19 * 60 + 30, 22 * 60 + 45, 12),
  soffit: ({ minute, dark, activity }) =>
    dark.inside * Math.max(windowLevel(minute, 17 * 60 + 30, 23 * 60 + 30, 25), activity === "coding" ? 0.35 : 0),
  steps: ({ dark }) => 0.45 * dark.outside,
  pool: ({ minute, dark, activity }) => (activity === "soak" ? 1 : 0.4 * dark.outside * windowLevel(minute, 19 * 60, 23 * 60, 20)),
  gym: ({ dark, activity }) => (activity === "workout" ? Math.max(0.65, dark.inside) : 0.18 * dark.inside),
  // The dining table is under the gallery, so daylight outside does not replace its task light.
  pendant: ({ minute, dark, activity }) =>
    MEALS.includes(activity) ? Math.max(0.65, dark.inside) : dark.inside * 0.45 * windowLevel(minute, 17 * 60, 23 * 60 + 30, 30),
  dining: ({ dark, activity, visit }) => (MEALS.includes(activity) || visit === "kitchen" ? Math.max(0.65, dark.inside) : 0.3 * dark.inside),
  entrance: ({ dark }) => 0.3 + 0.7 * dark.inside,
  downlights: ({ dark, activity, visit }) => (MEALS.includes(activity) || visit === "kitchen" ? Math.max(0.55, dark.inside) : 0.2 * dark.inside),
  shelf: ({ dark, activity, visit }) => (MEALS.includes(activity) || visit === "kitchen" ? Math.max(0.55, dark.inside) : 0.2 * dark.inside),
};
// The office's screens and RGB (no light of their own, so not an installation above): awake while
// Sirui works at the desk, a glow otherwise.
export const deskLevel = (activity) => (["work", "coding", "reading"].includes(activity) ? 1 : 0.25);
// The living room's paper floor lantern (bin/coastal_living.py) glows once the house is dim,
// brightest while Sirui is on the sofa; its light itself is the "lounge" warm practical.
export const lanternLevel = ({ dark, activity }) => dark.inside * (activity === "lounge" ? 1 : 0.4);
const LANTERN_MATERIAL = "washi lantern paper";
// Fixtures that glow with an installation: the dining lantern's paper, the downlights' diffusers.
const INSTALLATION_GLOW = { "dining lantern paper": "pendant", "downlight diffuser": "downlights" };
// The office's emissive materials (bin/coastal_office.py): the RGB that drifts, and the screens.
const RGB_MATERIAL = "pc rgb glow";
const SCREEN_MATERIALS = new Set(["monitor screen glass", "screen code light", "screen code warm light", "screen code blue light"]);
// One full turn of the hue wheel every 48 s, slow enough to read as ambience.
export function rgbColor(seconds, target = new THREE.Color()) {
  return target.setHSL((((seconds / 48) % 1) + 1) % 1, 0.85, 0.56);
}

// The same closed form in JavaScript (THREE.Vector3 arguments), mirrored line for line by the
// shader below; the tests check it against brute-force integration.
export function lineIrradiance(p, n, a, b) {
  let l0 = a.clone().sub(p),
    l1 = b.clone().sub(p);
  const d0 = n.dot(l0),
    d1 = n.dot(l1);
  if (d0 <= 0 && d1 <= 0) return 0;
  if (d0 < 0) l0 = l0.clone().lerp(l1, d0 / (d0 - d1));
  else if (d1 < 0) l1 = l0.clone().lerp(l1, d0 / (d0 - d1));
  const d = l1.clone().sub(l0);
  const A = d.dot(d),
    B = 2 * l0.dot(d),
    C = l0.dot(l0);
  const D = Math.max(4 * A * C - B * B, 1e-7);
  const q0 = Math.sqrt(Math.max(C, 1e-6)),
    q1 = Math.sqrt(Math.max(A + B + C, 1e-6));
  const n0 = Math.max(n.dot(l0), 0),
    n1 = n.dot(d);
  const f = (2 / D) * (n0 * ((2 * A + B) / q1 - B / q0) - n1 * ((B + 2 * C) / q1 - (2 * C) / q0));
  return Math.max(f, 0) * Math.sqrt(A);
}

const LINE_GLSL = /* glsl */ `
float installationLine(vec3 p, vec3 n, vec3 a, vec3 b) {
  vec3 l0 = a - p, l1 = b - p;
  float d0 = dot(n, l0), d1 = dot(n, l1);
  if (d0 <= 0.0 && d1 <= 0.0) return 0.0;
  if (d0 < 0.0) l0 = mix(l0, l1, d0 / (d0 - d1));
  else if (d1 < 0.0) l1 = mix(l0, l1, d0 / (d0 - d1));
  vec3 d = l1 - l0;
  float A = dot(d, d), B = 2.0 * dot(l0, d), C = dot(l0, l0);
  float D = max(4.0 * A * C - B * B, 1e-7);
  float q0 = sqrt(max(C, 1e-6)), q1 = sqrt(max(A + B + C, 1e-6));
  float n0 = max(dot(n, l0), 0.0), n1 = dot(n, d);
  float f = (2.0 / D) * (n0 * ((2.0 * A + B) / q1 - B / q0) - n1 * ((B + 2.0 * C) / q1 - 2.0 * C / q0));
  return max(f, 0.0) * sqrt(A);
}
bool installationInside(vec3 p, vec3 lo, vec3 hi) {
  return all(greaterThanEqual(p, lo - vec3(${RECEIVER_TOLERANCE}))) && all(lessThanEqual(p, hi + vec3(${RECEIVER_TOLERANCE})));
}
vec3 installationIrradiance(vec3 p, vec3 n) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${MAX_LINES}; i++) {
    if (installLineColor[i].r + installLineColor[i].g + installLineColor[i].b <= 0.0) continue;
    if (!installationInside(p, installLineMin[i], installLineMax[i])) continue;
    sum += installLineColor[i] * installationLine(p, n, installLineA[i], installLineB[i]);
  }
  for (int i = 0; i < ${MAX_POINTS}; i++) {
    if (installPointColor[i].r + installPointColor[i].g + installPointColor[i].b <= 0.0) continue;
    if (!installationInside(p, installPointMin[i], installPointMax[i])) continue;
    vec3 l = installPointPosition[i] - p;
    float r2 = max(dot(l, l), 1e-4);
    vec3 dir = l * inversesqrt(r2);
    float cone = installPointCone[i].w > 0.0 ? smoothstep(installPointCone[i].w, 1.0, dot(-dir, installPointCone[i].xyz)) : 1.0;
    sum += installPointColor[i] * max(dot(n, dir), 0.0) * cone / r2;
  }
  return sum;
}`;

export function createLightInstallations(config, { bind = (m) => m } = {}) {
  // Flat Float32Arrays rather than arrays of vectors: three r164 re-flattens an array of vectors
  // element by element on every material switch, which with this scene's thousand-odd materials per
  // frame was a fifth of the script time (docs/performance-notes.md). The GPU receives the same floats.
  const uniforms = {
    installLineA: { value: new Float32Array(MAX_LINES * 3) },
    installLineB: { value: new Float32Array(MAX_LINES * 3) },
    installLineColor: { value: new Float32Array(MAX_LINES * 3) },
    installLineMin: { value: new Float32Array(MAX_LINES * 3) },
    installLineMax: { value: new Float32Array(MAX_LINES * 3) },
    installPointPosition: { value: new Float32Array(MAX_POINTS * 3) },
    installPointColor: { value: new Float32Array(MAX_POINTS * 3) },
    installPointCone: { value: new Float32Array(MAX_POINTS * 4) },
    installPointMin: { value: new Float32Array(MAX_POINTS * 3) },
    installPointMax: { value: new Float32Array(MAX_POINTS * 3) },
    installActive: { value: 0 },
  };
  const scaled = new THREE.Vector3();
  const terrace = config.terrace;
  const box = (min, max) => ({ min: new THREE.Vector3(...min), max: new THREE.Vector3(...max) });
  // Emitter geometry (three.js axes: x, up, -Blender y). Intensities are per metre for lines.
  const lines = [];
  const points = [];
  const roomLighting = new Map();
  if (terrace?.festoon) {
    const region = box([-5.6, -0.12, -7.9], [5.6, 3.6, -2.2]);
    const anchors = terrace.festoon.points.map((p) => new THREE.Vector3(...p));
    for (let i = 0; i + 1 < anchors.length; i++) {
      const a = anchors[i],
        b = anchors[i + 1];
      const sag = (terrace.festoon.sag * a.distanceTo(b)) / 3;
      // Two chords per swag, through the swag's lowest point, at the bulbs' height under the cable.
      const middle = a
        .clone()
        .lerp(b, 0.5)
        .add(new THREE.Vector3(0, -sag - 0.085, 0));
      const drop = new THREE.Vector3(0, -0.085, 0);
      lines.push({ id: "festoon", a: a.clone().add(drop), b: middle, intensity: 0.42, color: WARM, region });
      lines.push({ id: "festoon", a: middle, b: b.clone().add(drop), intensity: 0.42, color: WARM, region });
    }
  }
  // The stair runs along the landward wall (navigation.stairs); the house reaches a little past it.
  const stairs = config.navigation?.stairs || [];
  const stairZ = stairs.length ? stairs.map((p) => p[2]) : [4.65];
  const back = Math.max(5.6, Math.max(...stairZ) + 0.6);
  // Under the gallery's front edge, the full width of the living floor.
  lines.push({
    id: "soffit",
    a: new THREE.Vector3(-4.45, 2.3, 1.42),
    b: new THREE.Vector3(4.45, 2.3, 1.42),
    intensity: 0.55,
    color: WARM,
    region: box([-5.25, -0.1, -1.2], [5.25, 2.34, back]),
  });
  // Beside the stair, a hand's width above the treads, from the foot to the landing.
  if (stairs.length > 2) {
    const foot = new THREE.Vector3(...stairs[1]),
      top = new THREE.Vector3(...stairs[stairs.length - 3]);
    lines.push({
      id: "steps",
      a: foot.clone().add(new THREE.Vector3(0, 0.28, 0.62)),
      b: top.clone().add(new THREE.Vector3(0, 0.28, 0.62)),
      intensity: 0.28,
      color: WARM,
      region: box([-2.6, -0.1, Math.min(...stairZ) - 0.95], [2.6, 3.4, Math.max(...stairZ) + 1.05]),
    });
  }
  // The gym's pendants: a long one over the lifting bay, a short one over the bench, hung from the
  // vault (bin/coastal_gym.py build_lights). The region keeps them inside the gym and its ledge.
  if (config.equipment?.gym) {
    const region = box([6.0, -0.1, -4.2], [11.0, 3.6, 1.0]);
    lines.push({ id: "gym", a: new THREE.Vector3(6.55, 2.45, -2.2), b: new THREE.Vector3(7.8, 2.45, -2.2), intensity: 1.1, color: GYM, region });
    lines.push({ id: "gym", a: new THREE.Vector3(7.02, 2.935, -0.9), b: new THREE.Vector3(10.38, 2.935, -0.9), intensity: 1.15, color: GYM, region });
    lines.push({
      id: "gym",
      a: new THREE.Vector3(9.62, 2.552, -2.65),
      b: new THREE.Vector3(10.78, 2.552, -2.65),
      intensity: 0.92,
      color: GYM,
      region,
    });
  }
  // The kitchen and dining room (manifest interiorLights, bin/coastal_kitchen.py), bounded by the
  // kitchen bay: the light line under the lower shelf, the dining lantern, the soffit downlights and
  // the two vault downlights over the island, the downlights cone-limited to a 106 or 70 degree beam.
  const interior = config.interiorLights;
  if (interior) {
    const region = box(interior.region.min, interior.region.max);
    if (interior.shelf)
      lines.push({
        id: "shelf",
        a: new THREE.Vector3(...interior.shelf[0]),
        b: new THREE.Vector3(...interior.shelf[1]),
        intensity: 0.5,
        color: WARM,
        region,
      });
    if (interior.pendant)
      points.push({ id: "pendant", position: new THREE.Vector3(...interior.pendant), intensity: 2.1, color: LANTERN, cone: null, region });
    // Each saucer lights the table beneath its own authored shade; the former single midpoint
    // downlight left the six-seat table's ends in shadow and was off outside the meal schedule.
    for (const at of (interior.dining || []).slice(0, 2))
      points.push({ id: "dining", position: new THREE.Vector3(...at), intensity: 1.1, color: LANTERN, cone: [0, -1, 0, 0.15], region });
    for (const at of interior.downlights || [])
      points.push({ id: "downlights", position: new THREE.Vector3(...at), intensity: 1.1, color: GYM, cone: [0, -1, 0, 0.6], region });
    for (const at of interior.vault || [])
      points.push({ id: "downlights", position: new THREE.Vector3(...at), intensity: 2.6, color: GYM, cone: [0, -1, 0, 0.82], region });
    if (interior.entrance?.region) {
      const entranceRegion = box(interior.entrance.region.min, interior.entrance.region.max);
      for (const at of (interior.entrance.positions || []).slice(0, 2))
        points.push({ id: "entrance", position: new THREE.Vector3(...at), intensity: 1.8, color: LANTERN, cone: null, region: entranceRegion });
    }
  }
  if (terrace?.fire) {
    points.push({
      id: "fire",
      position: new THREE.Vector3(terrace.fire[0], terrace.fire[1] + 0.2, terrace.fire[2]),
      intensity: 2.2,
      color: FIRE,
      cone: null,
      region: box([-5.6, -0.12, -7.9], [5.6, 3.6, -2.2]),
    });
  }
  points.push({
    id: "pool",
    position: new THREE.Vector3(3.17, 2.75, 3.18),
    intensity: 1.4,
    color: POOL,
    cone: null,
    region: box([1.9, 2.0, 1.2], [5.6, 5.0, 5.6]),
  });

  // Each bathroom owns a mirror wash and a concealed shower cove. These bounded analytic
  // sources add neither PointLights nor shadow maps, and cannot spill into the other storey.
  const authoredLines = roomLines(config);
  for (const line of authoredLines) {
    if (!roomLighting.has(line.room)) roomLighting.set(line.room, { id: line.id, glowing: new Set() });
    lines.push(line);
  }
  // Typed shader uniforms must never silently discard an authored fixture.
  if (lines.length > MAX_LINES || points.length > MAX_POINTS)
    throw new RangeError(`Light installation capacity exceeded: ${lines.length}/${MAX_LINES} lines, ${points.length}/${MAX_POINTS} points`);

  // Fixtures the installations need beyond the shell: the soffit's diffuser and the step lights.
  const root = new THREE.Group();
  root.name = "Light installations";
  const glow = (color) =>
    bind(new THREE.MeshStandardMaterial({ name: "installation diffuser", color: 0x111111, roughness: 0.6, emissive: color, emissiveIntensity: 0 }));
  const soffitMaterial = glow(WARM),
    stepMaterial = glow(WARM),
    poolMaterial = glow(POOL);
  const strip = new THREE.BoxGeometry(8.9, 0.012, 0.03);
  strip.translate(0, 2.338, 1.42);
  const soffitMesh = new THREE.Mesh(strip, soffitMaterial);
  soffitMesh.name = "Gallery soffit light";
  const steps = [];
  const stepLine = lines.find((l) => l.id === "steps");
  if (stepLine) {
    for (let k = 0; k <= 5; k++) {
      const marker = new THREE.BoxGeometry(0.08, 0.035, 0.01);
      const at = stepLine.a.clone().lerp(stepLine.b, k / 5);
      marker.translate(at.x, at.y, at.z + 0.2);
      steps.push(marker);
    }
  }
  const stepMesh = steps.length ? new THREE.Mesh(mergeGeometries(steps), stepMaterial) : null;
  steps.forEach((g) => g.dispose());
  if (stepMesh) stepMesh.name = "Stair step lights";
  const lens = new THREE.CircleGeometry(0.07, 24);
  const poolMesh = new THREE.Mesh(lens, poolMaterial);
  poolMesh.name = "Onsen pool light";
  for (const mesh of [soffitMesh, stepMesh, poolMesh].filter(Boolean)) {
    mesh.userData.staticLightFixture = true;
    mesh.castShadow = false;
    root.add(mesh);
  }

  // Shell materials that glow with their installation.
  const glowing = { festoon: [], fire: [], gym: [], desk: [], lantern: [], pendant: [], downlights: [] };
  function bindModel(model) {
    model.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [o.material].flat()) {
        const room = roomLighting.get(o.userData.roomLight);
        if (room && m.emissive) {
          m.userData.authoredEmissive ??= m.emissiveIntensity;
          room.glowing.add(m);
        }
        if (m.name === "festoon bulb glass" && !glowing.festoon.includes(m)) glowing.festoon.push(m);
        if (m.name === "fire bowl embers" && !glowing.fire.includes(m)) glowing.fire.push(m);
        if (m.name === "gym light diffuser" && !glowing.gym.includes(m)) glowing.gym.push(m);
        const installation = INSTALLATION_GLOW[m.name];
        if (installation && m.emissive && !glowing[installation].includes(m)) {
          m.userData.authoredEmissive ??= m.emissiveIntensity;
          glowing[installation].push(m);
        }
        if (m.name === LANTERN_MATERIAL && m.emissive && !glowing.lantern.includes(m)) {
          m.userData.authoredEmissive ??= m.emissiveIntensity;
          glowing.lantern.push(m);
        }
        if ((m.name === RGB_MATERIAL || SCREEN_MATERIALS.has(m.name)) && m.emissive && !glowing.desk.includes(m)) {
          // Keep the authored strength; the schedule scales it.
          m.userData.authoredEmissive ??= m.emissiveIntensity;
          glowing.desk.push(m);
        }
      }
    });
    applyRgb();
  }
  let rgbSeconds = 0,
    desk = 0.25,
    lantern = 0;
  const rgb = new THREE.Color();
  function applyRgb() {
    rgbColor(rgbSeconds, rgb);
    for (const m of glowing.desk) if (m.name === RGB_MATERIAL) m.emissive.copy(rgb);
  }

  let pool = null;
  function setPool(center, radius, surfaceY, depth) {
    // The lamp sits in the pool wall on the far side from the onsen camera, a third of the way down.
    pool = { center, radius, surfaceY, depth };
    const lamp = points.find((p) => p.id === "pool");
    lamp.position.set(center[0] + radius * 0.92, surfaceY - Math.max(0.12, depth * 0.35), center[1]);
    poolMesh.position.copy(lamp.position);
    poolMesh.lookAt(center[0], lamp.position.y, center[1]);
  }

  const levels = Object.fromEntries([...Object.keys(SCHEDULES), ...[...roomLighting.values()].map((room) => room.id)].map((id) => [id, 0]));
  let flicker = 1;
  function apply() {
    lines.forEach((line, i) => {
      line.a.toArray(uniforms.installLineA.value, i * 3);
      line.b.toArray(uniforms.installLineB.value, i * 3);
      line.region.min.toArray(uniforms.installLineMin.value, i * 3);
      line.region.max.toArray(uniforms.installLineMax.value, i * 3);
      scaled
        .set(line.color.r, line.color.g, line.color.b)
        .multiplyScalar(line.intensity * levels[line.id])
        .toArray(uniforms.installLineColor.value, i * 3);
    });
    points.forEach((point, i) => {
      const level = levels[point.id] * (point.id === "fire" ? flicker : 1);
      point.position.toArray(uniforms.installPointPosition.value, i * 3);
      point.region.min.toArray(uniforms.installPointMin.value, i * 3);
      point.region.max.toArray(uniforms.installPointMax.value, i * 3);
      uniforms.installPointCone.value.set(point.cone || [0, -1, 0, 0], i * 4);
      scaled
        .set(point.color.r, point.color.g, point.color.b)
        .multiplyScalar(point.intensity * level)
        .toArray(uniforms.installPointColor.value, i * 3);
    });
    soffitMaterial.emissiveIntensity = 2.4 * levels.soffit;
    stepMaterial.emissiveIntensity = 3 * levels.steps;
    poolMaterial.emissiveIntensity = 4 * levels.pool;
    // Skip the term only when every fixture sleeps. Sheltered task/entrance lighting can remain
    // useful in daylight; each emitter's region still prevents light crossing the room boundary.
    uniforms.installActive.value = Object.values(levels).some((level) => level > 0) ? 1 : 0;
    for (const m of glowing.festoon) {
      m.emissive?.copy(WARM);
      m.emissiveIntensity = 5 * levels.festoon;
    }
    for (const m of glowing.fire) {
      m.emissive?.copy(FIRE);
      m.emissiveIntensity = 3.2 * levels.fire * flicker;
    }
    for (const m of glowing.gym) {
      m.emissive?.copy(GYM);
      m.emissiveIntensity = 3 * levels.gym;
    }
    for (const m of glowing.desk) m.emissiveIntensity = (m.userData.authoredEmissive ?? 1) * desk;
    for (const m of glowing.lantern) m.emissiveIntensity = (m.userData.authoredEmissive ?? 1) * 1.6 * lantern;
    for (const m of glowing.pendant) m.emissiveIntensity = (m.userData.authoredEmissive ?? 1) * 1.3 * Math.max(levels.pendant, levels.dining);
    for (const m of glowing.downlights) m.emissiveIntensity = (m.userData.authoredEmissive ?? 1) * 3 * levels.downlights;
    for (const room of roomLighting.values())
      for (const material of room.glowing) material.emissiveIntensity = material.userData.authoredEmissive * levels[room.id];
  }

  const bindings = new WeakSet();
  return {
    root,
    uniforms,
    lines,
    points,
    indirectPowers: () => authoredLines.map((line) => line.intensity * line.a.distanceTo(line.b) * levels[line.id]),
    bindModel,
    setPool,
    // minute after midnight, daylight 0..1, the routine's activity id.
    update({ minute, daylight, activity, visit = null }) {
      const dark = darkness(daylight);
      for (const [id, schedule] of Object.entries(SCHEDULES)) levels[id] = THREE.MathUtils.clamp(schedule({ minute, dark, activity, visit }), 0, 1);
      for (const [id, room] of roomLighting) levels[room.id] = visit === id ? Math.max(0.75, dark.inside) : 0.16 * dark.inside;
      if (!interior?.entrance?.positions?.length) levels.entrance = 0;
      if (!interior?.dining?.length) levels.dining = 0;
      desk = deskLevel(activity);
      lantern = lanternLevel({ dark, activity });
      apply();
      return levels;
    },
    // Two incommensurate sines and a faster ripple: a fire never repeats on a visible period. The
    // PC's RGB drifts only while the scene moves; a still (reduced motion, pause) keeps its hue.
    tick(seconds, moving) {
      let changed = false;
      if (moving && glowing.desk.length && Math.abs(seconds - rgbSeconds) > 0.05) {
        rgbSeconds = seconds;
        applyRgb();
        changed = true;
      }
      if (!levels.fire) return changed;
      const next = moving ? 0.86 + 0.08 * Math.sin(seconds * 7.3) + 0.05 * Math.sin(seconds * 13.1 + 1.7) + 0.03 * Math.sin(seconds * 31.7) : 1;
      if (Math.abs(next - flicker) < 1e-4) return changed;
      flicker = next;
      apply();
      return true;
    },
    // With a normal this is the shader's direct irradiance reference, including bounded lines.
    // Without one, preserve the isotropic point estimate used for the onsen steam's ambient.
    irradianceAt(point, normal = null) {
      const total = new THREE.Color(0, 0, 0);
      for (const p of points) {
        const level = levels[p.id] * (p.id === "fire" ? flicker : 1);
        if (!level || !insideRegion(point, p.region)) continue;
        const toLight = p.position.clone().sub(point),
          r2 = Math.max(normal ? 1e-4 : 0.04, toLight.lengthSq()),
          direction = toLight.normalize(),
          cosine = normal ? Math.max(0, normal.dot(direction)) : 1,
          cone = normal && p.cone ? smooth(p.cone[3], 1, -direction.dot(new THREE.Vector3(...p.cone))) : 1;
        total.add(p.color.clone().multiplyScalar((p.intensity * level * cosine * cone) / r2));
      }
      if (normal)
        for (const line of lines) {
          if (!insideRegion(point, line.region)) continue;
          const energy = line.intensity * levels[line.id] * lineIrradiance(point, normal, line.a, line.b);
          total.add(line.color.clone().multiplyScalar(energy));
        }
      return total;
    },
    bindMaterial(material) {
      if (!material?.isMeshStandardMaterial || bindings.has(material)) return;
      const compile = material.onBeforeCompile,
        cache = material.customProgramCacheKey;
      material.onBeforeCompile = function (shader, renderer) {
        compile.call(this, shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 installWorldPosition;")
          .replace("#include <project_vertex>", "installWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>");
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
varying vec3 installWorldPosition;
uniform vec3 installLineA[${MAX_LINES}];
uniform vec3 installLineB[${MAX_LINES}];
uniform vec3 installLineColor[${MAX_LINES}];
uniform vec3 installLineMin[${MAX_LINES}];
uniform vec3 installLineMax[${MAX_LINES}];
uniform vec3 installPointPosition[${MAX_POINTS}];
uniform vec3 installPointColor[${MAX_POINTS}];
uniform vec4 installPointCone[${MAX_POINTS}];
uniform vec3 installPointMin[${MAX_POINTS}];
uniform vec3 installPointMax[${MAX_POINTS}];
uniform float installActive;
${LINE_GLSL}`
          )
          .replace(
            "#include <aomap_fragment>",
            "if(installActive>0.5)reflectedLight.directDiffuse+=installationIrradiance(installWorldPosition,inverseTransformDirection(normal,viewMatrix))*BRDF_Lambert(material.diffuseColor);\n#include <aomap_fragment>"
          );
      };
      material.customProgramCacheKey = function () {
        return `${cache.call(this)}|light-installations-v1`;
      };
      material.needsUpdate = true;
      bindings.add(material);
    },
    get levels() {
      return { ...levels };
    },
    evidence() {
      return {
        levels: { ...levels },
        lines: lines.length,
        points: points.length,
        festoonMaterials: glowing.festoon.length,
        fireMaterials: glowing.fire.length,
        deskMaterials: glowing.desk.length,
        lanternMaterials: glowing.lantern.length,
        rgb: rgb.getHexString(),
        pool: pool ? points.find((p) => p.id === "pool").position.toArray() : null,
      };
    },
    dispose() {
      root.traverse((o) => o.geometry?.dispose());
      soffitMaterial.dispose();
      stepMaterial.dispose();
      poolMaterial.dispose();
      root.removeFromParent();
    },
  };
}
