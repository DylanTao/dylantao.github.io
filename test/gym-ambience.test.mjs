import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { createWarmPracticals, practicalSourcesFor } from "../assets/js/home-scene/warm-practicals.mjs";
import { finishPhysicalMaterial } from "../assets/js/home-scene/realism.mjs";
import { createLightInstallations } from "../assets/js/home-scene/light-installations.mjs";
import { normalizeEmission, practicalEmission } from "../assets/js/home-scene/light-trace-core.mjs";
import { createStaticLightField } from "../assets/js/home-scene/static-light-field.mjs";

test("a gym visit lights the sheltered lifting bay by day and releases it on departure", () => {
  const sources = practicalSourcesFor(JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url))));
  const lamps = createWarmPracticals(new THREE.Scene(), (material) => material, { sources });
  const routine = { minute: 840, id: "work", schedule: [[0, "work"]] };
  const index = sources.findIndex((source) => source.id === "gym");
  try {
    for (const daylight of [0, 0.5, 1]) {
      lamps.update(daylight, routine, "study");
      const before = lamps.lights.map((light) => light.intensity);
      lamps.update(daylight, routine, "gym");
      assert.equal(lamps.evidence().levels.gym, 1);
      assert.equal(lamps.lights[index].intensity, sources[index].night);
      assert.ok(lamps.lights[index].intensity > before[index]);
      assert.deepEqual(
        lamps.lights.filter((_, i) => i !== index).map((light) => light.intensity),
        before.filter((_, i) => i !== index)
      );
      lamps.update(daylight, routine, "study");
      assert.deepEqual(
        lamps.lights.map((light) => light.intensity),
        before
      );
      lamps.update(daylight, { ...routine, id: "workout" });
      assert.equal(lamps.lights[index].intensity, sources[index].night);
    }
    assert.equal(lamps.lights.length, 8);
    assert.equal(lamps.evidence().pointLights, 7);
    assert.equal(lamps.evidence().spotLights, 1);
    assert.equal(lamps.lights[index].distance, 3.5);
    assert.deepEqual(lamps.lights[index].position.toArray(), [8.7, 2.9448975324630737, 7.1]);
  } finally {
    lamps.dispose();
  }
});

test("the gym pendant's direct and cached emission face down and soften toward the horizon", () => {
  const sources = practicalSourcesFor({}),
    source = sources.find((entry) => entry.id === "gym"),
    emission = normalizeEmission(source.emission),
    lamps = createWarmPracticals(new THREE.Scene(), (material) => material, { sources }),
    light = lamps.lights[sources.indexOf(source)];
  try {
    assert.ok(light.isSpotLight);
    assert.deepEqual(light.target.position.clone().sub(light.position).normalize().toArray(), emission.direction);
    assert.equal(light.angle, emission.angle);
    assert.equal(light.penumbra, emission.penumbra);
    assert.equal(practicalEmission([0, 1, 0], emission), 1);
    assert.equal(practicalEmission([0, -1, 0], emission), 0);
    assert.equal(practicalEmission([1, 0, 0], emission), 0);
    const shoulder = practicalEmission([-Math.sin(1.3), Math.cos(1.3), 0], emission);
    assert.ok(shoulder > 0 && shoulder < 1);
    assert.equal(practicalEmission([0, -1, 0], null), 1);
    emission.direction[1] = 1;
    assert.deepEqual(source.emission.direction, [0, -1, 0]);
    for (const invalid of [
      { ...source.emission, direction: [0, -2, 0] },
      { ...source.emission, angle: 2 },
      { ...source.emission, penumbra: 0 },
    ])
      assert.throws(() => normalizeEmission(invalid), RangeError);
  } finally {
    lamps.dispose();
  }
});

test("the three shielded gym strips light the floor and stop above their physical emitters", () => {
  const lights = createLightInstallations({ equipment: { gym: {} }, retreat: { setbackMetres: 8 } });
  try {
    lights.update({ minute: 1200, daylight: 0, activity: "work", visit: "gym" });
    assert.equal(lights.lines.filter((line) => line.id === "gym").length, 3);
    assert.ok(lights.irradianceAt(new THREE.Vector3(8.5, 0.01, 6.8), new THREE.Vector3(0, 1, 0)).r > 1);
    assert.equal(lights.irradianceAt(new THREE.Vector3(8.5, 3.3, 7.1), new THREE.Vector3(0, -1, 0)).r, 0);
    assert.equal(lights.irradianceAt(new THREE.Vector3(8.7, 2.9388975324630737, 7.1), new THREE.Vector3(0, -1, 0)).r, 0);
  } finally {
    lights.dispose();
  }
});

test("a cached practical cannot restore with a different emission direction", async () => {
  const source = { id: "fixture", position: [0, 1, 0], emission: { direction: [0, -1, 0], angle: Math.PI / 2, penumbra: 0.35 } },
    options = { regions: [{ id: "room", min: [-1, 0, -1], max: [1, 2, 1] }], practicalSources: [source] },
    field = createStaticLightField(options),
    same = createStaticLightField(options),
    changed = createStaticLightField({ ...options, practicalSources: [{ ...source, emission: { ...source.emission, direction: [0, 1, 0] } }] }),
    signature = "e".repeat(64);
  try {
    await field.bake({ yieldTask: () => Promise.resolve() });
    const snapshot = field.exportSnapshot({ signature });
    assert.equal(same.restoreSnapshot(snapshot, { signature }), true);
    assert.equal(changed.restoreSnapshot(snapshot, { signature }), false);
  } finally {
    for (const value of [field, same, changed]) value.dispose();
  }
});

test("opaque gym powder coat receives diffuse light while the bare barbell keeps its metal finish", () => {
  const geometry = new THREE.BoxGeometry();
  const painted = new THREE.MeshStandardMaterial({ name: "powder coated gym steel", color: 0x334440, metalness: 0.52, roughness: 0.44 });
  const bare = new THREE.MeshStandardMaterial({ name: "barbell brushed steel", color: 0x999999, metalness: 0.86, roughness: 0.26 });
  const paintedFinish = finishPhysicalMaterial(painted, new THREE.Mesh(geometry, painted));
  const bareFinish = finishPhysicalMaterial(bare, new THREE.Mesh(geometry, bare));
  try {
    assert.equal(paintedFinish.metalness, 0);
    assert.equal(paintedFinish.roughness, 0.55);
    assert.deepEqual(paintedFinish.color.toArray(), painted.color.toArray());
    assert.equal(painted.metalness, 0.52);
    assert.equal(painted.roughness, 0.44);
    assert.equal(bareFinish.metalness, bare.metalness);
    assert.equal(bareFinish.roughness, bare.roughness);
  } finally {
    for (const material of [paintedFinish, bareFinish, painted, bare]) material.dispose();
    geometry.dispose();
  }
});
