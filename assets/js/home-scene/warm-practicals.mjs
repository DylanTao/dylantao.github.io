import * as THREE from "../three.module.min.js";
import { mergeGeometries } from "../vendor/three-r164/utils/BufferGeometryUtils.js";

// World-space anchors: the four existing modeled lamps, then the bath ledge,
// oak gym alcove and the supported corners of the ground-floor terrace.
export const PRACTICAL_SOURCES = [
  { id: "study", position: [-0.99, 4.06, 2.64], night: 5.5, day: 0.9, distance: 6 },
  { id: "sleep", position: [-4.13, 3.47, 2.47], night: 2.7, day: 0.7, distance: 4.8 },
  { id: "kitchen", position: [-3.3, 1.95, -0.04], night: 2.7, day: 0.7, distance: 4.8 },
  { id: "lounge", position: [2.14, 0.79, -1.58], night: 2.7, day: 0.7, distance: 4.8 },
  { id: "bath", position: [3.68, 3.388, 2.2], night: 2.8, day: 0.6, distance: 3.3 },
  { id: "gym", position: [0, 2.18, 0.25], night: 3, day: 0.5, distance: 3.5 },
  { id: "terrace-west", position: [-3.9, 0.170405, -4.3], night: 1.8, day: 0.15, distance: 3.8 },
  { id: "terrace-east", position: [3.9, 0.170405, -4.3], night: 1.8, day: 0.15, distance: 3.8 },
];

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
  // A surface-mounted brass rail with a downward-facing diffuser on the oak wall.
  // No bloom sprite or large glowing plane substitutes for a modeled lamp.
  const gymCase = new THREE.BoxGeometry(1.15, 0.052, 0.085).toNonIndexed();
  gymCase.translate(0, 2.22, 0.2025);
  const gymStrip = new THREE.BoxGeometry(1.04, 0.008, 0.049).toNonIndexed();
  gymStrip.translate(0, 2.189, 0.201);
  // Cylinders and boxes must share index topology before batching.
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
  housings.push(gymCase);
  diffusers.push(gymStrip);
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
  return {
    root,
    lights,
    sources: PRACTICAL_SOURCES.map((source, i) => ({ ...source, color: color.toArray(), light: lights[i] })),
    update(daylight) {
      const t = THREE.MathUtils.clamp((0.3 - daylight) / 0.3, 0, 1);
      nightMix = t * t * (3 - 2 * t);
      lights.forEach((light, i) => (light.intensity = THREE.MathUtils.lerp(PRACTICAL_SOURCES[i].day, PRACTICAL_SOURCES[i].night, nightMix)));
      diffuser.emissiveIntensity = THREE.MathUtils.lerp(0.22, 1.1, nightMix);
    },
    evidence() {
      return {
        nightMix,
        pointLights: lights.length,
        newFixtures: 4,
        fixtureDraws: 2,
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
