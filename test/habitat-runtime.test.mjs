import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { PRACTICAL_SOURCES, practicalSourcesFor, createWarmPracticals } from "../assets/js/home-scene/warm-practicals.mjs";
import { COAST_SHELTER, createCoastWind } from "../assets/js/home-scene/wind-field.mjs";
import { staticLightRegions, STATIC_LIGHT_REGIONS, createStaticLightField } from "../assets/js/home-scene/static-light-field.mjs";
import { createLightInstallations, roomLightSources } from "../assets/js/home-scene/light-installations.mjs";
import { walkKind } from "../assets/js/home-scene/colliders.mjs";
import { collidable } from "../assets/js/home-scene/camera-field.mjs";

test("the complete delivered home fits transport and analytic receiver budgets without omitting fixtures", () => {
  const config = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
  const regions = staticLightRegions(config);
  const bounds = regions.map(({ min, max }) => JSON.stringify([min, max]));
  assert.equal(new Set(bounds).size, bounds.length, "identical cages add cost without adding transport coverage");
  const field = createStaticLightField({ regions, practicalSources: [...practicalSourcesFor(config), ...roomLightSources(config)] });
  let installations;
  try {
    // The real constructor rejects uncovered fixtures and overflowing receiver packs. No test
    // proxy can conceal a scene that would fail during the visitor's loading screen.
    installations = createLightInstallations(config);
  } finally {
    installations?.dispose();
    field.dispose();
  }
});

test("native workstation relocation and housing setback carry actual runtime bulbs together", () => {
  const config = { retreat: { setbackMetres: 8, workstationNativeTranslation: [-10.4, 6.7, -2.6] } };
  const sources = practicalSourcesFor(config);
  const study = sources.find((entry) => entry.id === "study");
  const original = PRACTICAL_SOURCES.find((entry) => entry.id === "study");
  for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(study.position[axis] - original.position[axis] - [-10.4, -2.6, 1.3][axis]) < 1e-9);
  assert.deepEqual(sources.find((entry) => entry.id === "kitchen").position, [-4.99, 1.95, 4.9]);
  assert.deepEqual(practicalSourcesFor({}), PRACTICAL_SOURCES);
  const scene = new THREE.Scene();
  const lamps = createWarmPracticals(scene, (material) => material, { sources });
  assert.deepEqual(lamps.lights[0].position.toArray(), study.position);
  assert.deepEqual(lamps.sources[0].position, study.position);
  assert.equal(lamps.lights.length, PRACTICAL_SOURCES.length);
  lamps.dispose();
  assert.equal(scene.children.length, 0);
});

test("moving the facade wind plane preserves the actual outdoor coast wind", () => {
  const wind = createCoastWind({ minute: 930, seconds: 50, doors: 0.7 });
  const outdoor = [...wind.sample(2, 3, -6)];
  const sheltered = [...wind.indoorDrift(2, 1).mean];
  wind.setShelter({ glassZ: COAST_SHELTER.glassZ + 8 });
  assert.deepEqual(wind.sample(2, 3, -6), outdoor);
  assert.notDeepEqual(wind.indoorDrift(2, 9).mean, sheltered);
  assert.equal(wind.evidence().shelterGlassZ, 3.5199999999999996);
  assert.throws(() => wind.setShelter({ glassZ: NaN }), TypeError);
  wind.setShelter();
  assert.equal(wind.evidence().shelterGlassZ, COAST_SHELTER.glassZ);
});

test("legacy light cages follow the house while already-world room cages are applied once", () => {
  const bathroom = { min: [-7, 0, 6], max: [-5, 3, 8] };
  const regions = staticLightRegions({
    retreat: { setbackMetres: 8, workstationNativeTranslation: [-10.4, 6.7, -2.6] },
    rooms: [{ id: "bath-living", lightRegion: bathroom }],
  });
  const study = regions.find((entry) => entry.id === "study");
  const original = STATIC_LIGHT_REGIONS.find((entry) => entry.id === "study");
  for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(study.min[axis] - original.min[axis] - [-10.4, -2.6, 1.3][axis]) < 1e-9);
  assert.deepEqual(
    regions.find((entry) => entry.id === "bath-living"),
    { ...bathroom, id: "bath-living" }
  );
});

test("a native rolling ladder leaves no permanent voxel obstacle before its runtime rig binds", () => {
  const root = new THREE.Group();
  const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4, 0.4), new THREE.MeshStandardMaterial());
  root.add(ladder);
  assert.notEqual(walkKind(ladder, root), null);
  assert.equal(collidable(ladder, root), true);
  ladder.userData.libraryLadder = true;
  assert.equal(walkKind(ladder, root), null);
  assert.equal(collidable(ladder, root), false);
  ladder.geometry.dispose();
  ladder.material.dispose();
});
