import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { PRACTICAL_SOURCES, practicalSourcesFor, createWarmPracticals } from "../assets/js/home-scene/warm-practicals.mjs";
import { roomLightSources } from "../assets/js/home-scene/light-installations.mjs";
import { createStaticLightField, staticLightRegions } from "../assets/js/home-scene/static-light-field.mjs";

const position = [-5.770000457763672, 2.330000162124634, 5.950000524520874];
const region = { min: [-8.53, 1.45, 3.3], max: [-5.15, 5.25, 8.62] };
const fixture = () => ({ id: "sleep", lightRegion: structuredClone(region), practicalSource: { position: [...position], emitterRadius: 0.2 } });

test("the native sleep anchor is already world-space and changes only that fixture's position and radius", () => {
  const legacy = { retreat: { setbackMetres: 8, workstationNativeTranslation: [-10.4, 6.7, -2.6] } };
  const config = { ...legacy, rooms: [fixture(), { id: "study", practicalSource: { position: [999, 999, 999] } }] };
  const baseline = practicalSourcesFor(legacy);
  const actual = practicalSourcesFor(config);
  assert.equal(actual.length, baseline.length);
  for (let i = 0; i < baseline.length; i++) {
    if (actual[i].id !== "sleep") assert.deepEqual(actual[i], baseline[i]);
    else assert.deepEqual(actual[i], { ...baseline[i], position, emitterRadius: 0.2 });
  }
  actual.find((source) => source.id === "sleep").position[0] = 0;
  assert.deepEqual(config.rooms[0].practicalSource.position, position);
  assert.deepEqual(practicalSourcesFor({}), PRACTICAL_SOURCES);
});

test("a supplied native sleep anchor must be finite, small, and contained by its room cage", () => {
  for (const update of [
    { practicalSource: false },
    { practicalSource: { position: [NaN, 2.33, 5.95], emitterRadius: 0.2 } },
    { practicalSource: { position: [1, 2], emitterRadius: 0.2 } },
    { practicalSource: { position: [-4.13, 3.47, 10.47], emitterRadius: 0.2 } },
    { practicalSource: { position, emitterRadius: 0 } },
    { practicalSource: { position, emitterRadius: Infinity } },
    { practicalSource: { position, emitterRadius: 0.251 } },
    { lightRegion: { min: region.max, max: region.min } },
    { lightRegion: null },
  ])
    assert.throws(() => practicalSourcesFor({ rooms: [{ ...fixture(), ...update }] }), RangeError);
  assert.deepEqual(practicalSourcesFor({ rooms: [{ id: "sleep" }] }), PRACTICAL_SOURCES);
});

test("the delivered native lamp uses the same point-light counts, routine powers, and emitter budgets", () => {
  const config = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
  const baseline = practicalSourcesFor(config);
  Object.assign(
    config.rooms.find((room) => room.id === "sleep"),
    fixture()
  );
  const actual = practicalSourcesFor(config);
  const before = createWarmPracticals(new THREE.Scene(), (material) => material, { sources: baseline });
  const after = createWarmPracticals(new THREE.Scene(), (material) => material, { sources: actual });
  const field = createStaticLightField({ regions: staticLightRegions(config), practicalSources: [...actual, ...roomLightSources(config)] });
  try {
    assert.equal(field.evidence().regions.length, 16);
    assert.equal(field.evidence().probes.length, 128);
    assert.equal(field.evidence().practicalEnergy.length, 28);
    assert.equal(after.lights.length, before.lights.length);
    assert.deepEqual(after.lights[1].position.toArray(), position);
    for (const daylight of [0, 1]) {
      for (const minute of [360, 600, 1200]) {
        const routine = {
          minute,
          id: "sleep",
          schedule: [
            [0, "sleep"],
            [480, "breakfast"],
          ],
        };
        before.update(daylight, routine);
        after.update(daylight, routine);
        assert.deepEqual(after.evidence().levels, before.evidence().levels);
        assert.deepEqual(
          after.lights.map((light) => light.intensity),
          before.lights.map((light) => light.intensity)
        );
        assert.deepEqual(
          after.lights.map((light) => light.distance),
          before.lights.map((light) => light.distance)
        );
      }
    }
  } finally {
    before.dispose();
    after.dispose();
    field.dispose();
  }
});

test("only the native bedside diffuser follows the existing sleep power, including a style-material replacement", () => {
  const room = new THREE.Group();
  const geometry = new THREE.SphereGeometry(0.14, 8, 6);
  const material = new THREE.MeshStandardMaterial({ name: "sleep bedside linen diffuser", emissiveIntensity: 0, roughness: 0.65 });
  material.userData.practicalSourceId = "sleep";
  const globe = new THREE.Mesh(geometry, material);
  const mattress = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ name: "linen", emissiveIntensity: 0 }));
  const wrongRole = new THREE.Mesh(geometry, material.clone());
  wrongRole.material.userData.practicalSourceId = "study";
  room.add(globe, mattress, wrongRole);
  const lamps = createWarmPracticals(new THREE.Scene());
  const before = { positions: room.children.map((mesh) => mesh.position.toArray()), color: material.color.toArray(), roughness: material.roughness };
  let replacement;
  try {
    assert.equal(lamps.bindModel(room), 1);
    assert.equal(lamps.bindModel(room), 1);
    assert.equal(lamps.evidence().nativeDiffuserMeshes, 1);
    for (const minute of [360, 600, 1200]) {
      lamps.update(0, {
        minute,
        id: "sleep",
        schedule: [
          [0, "sleep"],
          [480, "breakfast"],
        ],
      });
      const power = lamps.evidence().sources[1].intensity;
      assert.ok(Math.abs(globe.material.emissiveIntensity - (0.65 * power) / PRACTICAL_SOURCES[1].night) < 1e-12);
      assert.equal(mattress.material.emissiveIntensity, 0);
      assert.equal(wrongRole.material.emissiveIntensity, 0);
      assert.deepEqual(material.color.toArray(), before.color);
      assert.equal(material.roughness, before.roughness);
      assert.deepEqual(
        room.children.map((mesh) => mesh.position.toArray()),
        before.positions
      );
    }
    replacement = material.clone();
    replacement.emissiveIntensity = 0;
    globe.material = replacement;
    lamps.update(1, {
      minute: 600,
      id: "work",
      schedule: [
        [0, "sleep"],
        [480, "breakfast"],
      ],
    });
    assert.ok(replacement.emissiveIntensity > 0);
    assert.equal(mattress.material.emissiveIntensity, 0);
    assert.equal(lamps.lights.length, PRACTICAL_SOURCES.length);
  } finally {
    lamps.dispose();
    geometry.dispose();
    material.dispose();
    mattress.material.dispose();
    wrongRole.material.dispose();
    replacement?.dispose();
  }
});
