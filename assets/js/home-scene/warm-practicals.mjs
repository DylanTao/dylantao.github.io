import * as THREE from "../three.module.min.js";
import { mergeGeometries } from "../vendor/three-r164/utils/BufferGeometryUtils.js";

// World-space anchors: the study's task lamp, the bedside lamp, the kitchen's brass picture light over
// the capybara print, the living room's paper floor lantern, then the bath ledge, the gym (over its
// lifting bay) and the two floor lanterns just inside the glass front (named for the terrace they
// once marked; they stand clear of the sliding doors' track).
export const PRACTICAL_SOURCES = [
  // The task lamp at the seaward end of the office desk (bin/coastal_office.py build_lamp).
  { id: "study", position: [-0.97, 3.88, 2.42], night: 5.5, day: 0.9, distance: 6 },
  { id: "sleep", position: [-4.13, 3.47, 2.47], night: 2.7, day: 0.7, distance: 4.8, anyHour: true },
  // The picture light over the capybara print, on the cave wall above the breakfast nook's banquette
  // since the kitchen opened (manifest wallArt.light, bin/coastal_kitchen.py PICTURE_LIGHT).
  { id: "kitchen", position: [-4.99, 1.95, -3.1], night: 2.7, day: 0.7, distance: 4.8 },
  // The paper floor lantern (bin/coastal_living.py build_lamp): its closed washi globe, up to 0.24 m
  // from the bulb, is the emitter, so the static light bake must not let the shade hide its own lamp.
  { id: "lounge", position: [-1.2, 1.42, -3.55], night: 2.7, day: 0.7, distance: 4.8, emitterRadius: 0.26 },
  { id: "bath", position: [3.68, 3.388, 2.2], night: 2.8, day: 0.6, distance: 3.3 },
  { id: "gym", position: [8.6, 2.3, -0.4], night: 3, day: 0.5, distance: 3.5 },
  { id: "terrace-west", position: [-4.75, 0.170405, -4.12], night: 1.8, day: 0.15, distance: 3.8 },
  { id: "terrace-east", position: [3.9, 0.170405, -4.12], night: 1.8, day: 0.15, distance: 3.8 },
];

// How far each lamp is turned up at night, from the routine: lamps brighten where Sirui is and
// dim to a glow elsewhere. The bedside lamp also works by day: it ramps up over the half hour
// before waking (a dawn lamp), lights the last minutes before sleep, and is a night light between.
const occupied =
  (ids) =>
  ({ activity }) =>
    ids.includes(activity) ? 1 : 0.3;
export const PRACTICAL_SCHEDULES = {
  study: occupied(["reading", "work", "coding"]),
  kitchen: occupied(["breakfast", "lunch", "dinner"]),
  lounge: occupied(["lounge"]),
  bath: occupied(["soak"]),
  gym: ({ activity }) => (activity === "workout" ? 1 : 0.15),
  "terrace-west": ({ minute }) => (minute >= 16 * 60 || minute < 60 ? 1 : 0.35),
  "terrace-east": ({ minute }) => (minute >= 16 * 60 || minute < 60 ? 1 : 0.35),
  sleep: ({ minute, bed, wake }) => {
    const since = (from) => (minute - from + 1440) % 1440;
    if (since(wake - 30) < 30) return 0.04 + 0.96 * (since(wake - 30) / 30) ** 2;
    if (since(wake) < 20 || since(bed - 25) < 25) return 1;
    if (since(bed) < (wake - bed + 1440) % 1440) return 0.04;
    return 0;
  },
};

// Bedtime and waking from the day's routine ([[start minute, activity], ...]).
export function sleepWindow(schedule) {
  const index = schedule.findIndex(([, id]) => id === "sleep");
  if (index < 0) return { bed: 0, wake: 0 };
  return { bed: schedule[index][0], wake: schedule[(index + 1) % schedule.length][0] };
}

export function createWarmPracticals(scene, bind = (m) => m) {
  const root = new THREE.Group();
  root.name = "Warm architectural fixtures";
  const color = new THREE.Color(0xffc18b),
    lights = PRACTICAL_SOURCES.map((source) => {
      const light = new THREE.PointLight(color, source.day, source.distance, 2);
      light.position.fromArray(source.position);
      light.name = `${source.id} practical`;
      root.add(light);
      return light;
    }),
    brass = bind(new THREE.MeshStandardMaterial({ name: "fixture aged brass", color: 0x6a573a, metalness: 0.7, roughness: 0.38 })),
    diffuser = bind(
      new THREE.MeshStandardMaterial({ name: "fixture woven cream", color: 0xe8d7b7, roughness: 0.95, emissive: color, emissiveIntensity: 0.22 })
    ),
    housings = [],
    diffusers = [];
  function cylinder(target, radius, height, position) {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 24);
    geometry.translate(...position);
    target.push(geometry);
  }
  for (const source of PRACTICAL_SOURCES.filter((s) => /bath|terrace/.test(s.id))) {
    const [x, y, z] = source.position;
    cylinder(housings, source.id === "bath" ? 0.1 : 0.135, 0.035, [x, y - 0.15, z]);
    cylinder(housings, 0.123, 0.024, [x, y + 0.14, z]);
    cylinder(diffusers, 0.107, 0.255, [x, y - 0.005, z]);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      cylinder(housings, 0.004, 0.28, [x + Math.cos(a) * 0.112, y - 0.005, z + Math.sin(a) * 0.112]);
    }
  }
  // The gym's light hangs among its own pendants (bin/coastal_gym.py); the brass rail that marked the
  // old gym alcove in the middle bay went with it, so no fixture floats over the living room.
  // Cylinders must share index topology before batching.
  for (let i = 0; i < housings.length; i++) {
    const original = housings[i];
    housings[i] = original.toNonIndexed();
    original.dispose();
  }
  for (let i = 0; i < diffusers.length; i++) {
    const original = diffusers[i];
    diffusers[i] = original.toNonIndexed();
    original.dispose();
  }
  for (const [parts, material, name] of [
    [housings, brass, "Brass lantern housings and alcove rail"],
    [diffusers, diffuser, "Warm lantern diffusers"],
  ]) {
    const mesh = new THREE.Mesh(mergeGeometries(parts), material);
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.userData.staticLightFixture = true;
    root.add(mesh);
    parts.forEach((g) => g.dispose());
  }
  scene.add(root);
  let nightMix = 0;
  const levels = Object.fromEntries(PRACTICAL_SOURCES.map((s) => [s.id, 1]));
  return {
    root,
    lights,
    sources: PRACTICAL_SOURCES.map((source, i) => ({ ...source, color: color.toArray(), light: lights[i] })),
    // routine: { minute, id, schedule }. Without one, every lamp follows daylight alone.
    update(daylight, routine = null) {
      const t = THREE.MathUtils.clamp((0.3 - daylight) / 0.3, 0, 1);
      nightMix = t * t * (3 - 2 * t);
      const state = routine && { minute: routine.minute, activity: routine.id, ...sleepWindow(routine.schedule || []) };
      lights.forEach((light, i) => {
        const source = PRACTICAL_SOURCES[i];
        const level = state ? PRACTICAL_SCHEDULES[source.id](state) : 1;
        levels[source.id] = level;
        light.intensity = source.day + (source.night - source.day) * level * (source.anyHour ? 1 : nightMix);
      });
      diffuser.emissiveIntensity = THREE.MathUtils.lerp(0.22, 1.1, nightMix);
    },
    evidence() {
      return {
        nightMix,
        pointLights: lights.length,
        newFixtures: 3,
        fixtureDraws: 2,
        levels: { ...levels },
        sources: lights.map((l) => ({ position: l.position.toArray(), intensity: l.intensity })),
      };
    },
    dispose() {
      root.traverse((o) => o.geometry?.dispose());
      brass.dispose();
      diffuser.dispose();
      root.removeFromParent();
    },
  };
}
