import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { createLightInstallations, MAX_LINES, MAX_POINTS, roomLightSources } from "../assets/js/home-scene/light-installations.mjs";

const region = (x) => ({ min: [x - 2, -0.5, -2], max: [x + 2, 5, 2] });
function fixtureWorld() {
  const config = {
    installationLines: [],
    installationPoints: [],
    installationReceivers: { default: "west", groups: { west: region(0), east: region(12) } },
  };
  for (const [zone, x] of [
    ["west", 0],
    ["east", 12],
  ]) {
    for (let index = 0; index < 12; index++)
      config.installationLines.push({
        id: `${zone}-${index}`,
        schedule: "entrance",
        a: [x - 1, 2.5 + index * 0.02, 0],
        b: [x + 1, 2.5 + index * 0.02, 0],
        intensity: 0.04,
        region: region(x),
      });
    for (let index = 0; index < 2; index++)
      config.installationPoints.push({
        id: `${zone}-point-${index}`,
        schedule: "entrance",
        position: [x, 3, index * 0.25],
        intensity: 0.12,
        region: region(x),
      });
  }
  return config;
}

const shader = () => ({
  uniforms: {},
  vertexShader: "#include <common>\n#include <project_vertex>",
  fragmentShader: "#include <common>\n#include <aomap_fragment>",
});

test("a larger fixture registry retains every source while each physical receiver stays at the existing shader cost", () => {
  const lights = createLightInstallations(fixtureWorld());
  assert.equal(lights.lines.length, 25);
  const evidence = lights.evidence();
  assert.deepEqual(Object.fromEntries(Object.entries(evidence.receiverPacks).map(([key, p]) => [key, [p.lines, p.points]])), {
    west: [13, 3],
    east: [12, 2],
  });
  const assigned = new Set(Object.values(evidence.receiverPacks).flatMap((pack) => pack.sources));
  for (const fixture of [...lights.lines, ...lights.points]) assert.ok(assigned.has(fixture.source || fixture.id));
  for (const group of ["west", "east"]) {
    const material = lights.bindMaterial(new THREE.MeshStandardMaterial(), group);
    const compiled = shader();
    material.onBeforeCompile(compiled, {});
    assert.equal(compiled.uniforms.installLineA.value.length, MAX_LINES * 3);
    assert.equal(compiled.uniforms.installPointPosition.value.length, MAX_POINTS * 3);
    assert.match(compiled.fragmentShader, /i < 18/);
    assert.match(compiled.fragmentShader, /i < 10/);
    material.dispose();
  }
  lights.dispose();
});

test("receiver selection preserves the global irradiance reference at day, night, and both room boundaries", () => {
  const lights = createLightInstallations(fixtureWorld());
  const normal = new THREE.Vector3(0, 1, 0);
  for (const daylight of [0.95, 0]) {
    lights.update({ minute: 1260, daylight, activity: "reading" });
    for (const [group, center] of [
      ["west", 0],
      ["east", 12],
    ])
      for (const dx of [-2, -1.3, 0, 1.25, 2])
        for (const z of [-2, -0.2, 1.9]) {
          const point = new THREE.Vector3(center + dx, 0.1, z);
          const all = lights.irradianceAt(point, normal);
          const packed = lights.irradianceAt(point, normal, group);
          for (const channel of ["r", "g", "b"]) assert.ok(Math.abs(all[channel] - packed[channel]) < 1e-10);
        }
  }
  lights.dispose();
});

test("sharing a material across receiver groups creates one owned variant and preserves its shader callbacks", () => {
  const lights = createLightInstallations(fixtureWorld());
  const source = new THREE.MeshStandardMaterial();
  let compileCalls = 0,
    sourceDisposals = 0,
    cloneDisposals = 0;
  source.onBeforeCompile = (compiled) => {
    compileCalls++;
    compiled.uniforms.retainedCustom = { value: 7 };
  };
  source.customProgramCacheKey = () => "retained-physical-shader";
  source.addEventListener("dispose", () => sourceDisposals++);
  const a = new THREE.Mesh(new THREE.BoxGeometry(), source);
  const b = new THREE.Mesh(new THREE.BoxGeometry(), source);
  a.userData.installationGroup = "west";
  b.userData.installationGroup = "east";
  const model = new THREE.Group();
  model.add(a, b);
  lights.bindModel(model);
  assert.equal(a.material, source);
  assert.notEqual(b.material, source);
  const clone = b.material;
  clone.addEventListener("dispose", () => cloneDisposals++);
  lights.bindModel(model);
  assert.equal(b.material, clone);
  assert.equal(lights.bindMaterial(clone, "west"), source, "variants are reused when changing an explicit physical group");
  assert.equal(lights.evidence().clonedReceiverMaterials, 1);
  for (const material of [source, clone]) {
    const compiled = shader();
    material.onBeforeCompile(compiled, {});
    assert.equal(compiled.uniforms.retainedCustom.value, 7);
    assert.match(material.customProgramCacheKey(), /^retained-physical-shader\|light-installations-v2$/);
    assert.equal((compiled.fragmentShader.match(/vec3 installationIrradiance/g) || []).length, 1);
  }
  assert.equal(compileCalls, 2);
  lights.dispose();
  assert.equal(sourceDisposals, 0, "the model retains custody of its original material");
  assert.equal(cloneDisposals, 1, "the installation owns and disposes its added variant");
  a.geometry.dispose();
  b.geometry.dispose();
  source.dispose();
});

test("receiver overflow, uncovered fixtures, unknown schedules and unknown receiver names fail closed", () => {
  const overflow = fixtureWorld();
  overflow.installationReceivers.groups.all = { min: [-10, -1, -10], max: [20, 10, 10] };
  assert.throws(() => createLightInstallations(overflow), /25\/18 lines.*receiver all/);
  const uncovered = fixtureWorld();
  delete uncovered.installationReceivers.groups.east;
  assert.throws(() => createLightInstallations(uncovered), /Uncovered installation fixture: east-/);
  const schedule = fixtureWorld();
  schedule.installationLines[0].schedule = "unmeasured";
  assert.throws(() => createLightInstallations(schedule), /Unknown installation schedule/);
  const missingRegion = fixtureWorld();
  missingRegion.installationPoints[0].region = null;
  assert.throws(() => createLightInstallations(missingRegion), /Invalid installation receiver region/);
  const pointOverflow = fixtureWorld();
  pointOverflow.installationPoints.push(...Array.from({ length: 9 }, (_, i) => ({ ...pointOverflow.installationPoints[0], id: `extra-${i}` })));
  assert.throws(() => createLightInstallations(pointOverflow), /12\/10 points in receiver west/);
  const lights = createLightInstallations(fixtureWorld());
  assert.throws(() => lights.bindMaterial(new THREE.MeshStandardMaterial(), "camera-near"), /Unknown installation receiver/);
  lights.dispose();
});

test("a shared avatar and proxy can change physical rooms repeatedly without clone or callback accumulation", () => {
  const lights = createLightInstallations(fixtureWorld());
  const source = new THREE.MeshStandardMaterial();
  source.onBeforeCompile = (compiled) => {
    compiled.fragmentShader += "\n// retained surface";
  };
  source.customProgramCacheKey = () => "retained-avatar";
  const avatar = new THREE.Group(),
    proxy = new THREE.Group();
  avatar.add(new THREE.Mesh(new THREE.BoxGeometry(), source));
  proxy.add(new THREE.Mesh(new THREE.BoxGeometry(), source));
  const rebound = new WeakSet();
  const laterStage = (material) => {
    if (rebound.has(material)) return;
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = function (compiled, renderer) {
      previous.call(this, compiled, renderer);
      compiled.fragmentShader += "\n// cached field";
    };
    rebound.add(material);
  };
  lights.bindModel(avatar, { group: "west" });
  lights.bindModel(proxy, { group: "west" });
  laterStage(source);
  for (let i = 0; i < 30; i++) {
    lights.bindModel(avatar, { group: i % 2 ? "west" : "east" });
    lights.bindModel(proxy, { group: "west" });
    for (const root of [avatar, proxy]) laterStage(root.children[0].material);
    assert.equal(proxy.children[0].material, source);
  }
  lights.bindModel(avatar, { group: "east" });
  assert.equal(lights.evidence().clonedReceiverMaterials, 1);
  assert.equal(avatar.children[0].material.userData.installationReceiverOrigin, source.uuid);
  assert.equal(avatar.children[0].material.userData.installationReceiverOwnedVariant, true);
  const compiled = [shader(), shader()];
  for (const [index, root] of [avatar, proxy].entries()) {
    root.children[0].material.onBeforeCompile(compiled[index], {});
    assert.equal((compiled[index].fragmentShader.match(/vec3 installationIrradiance/g) || []).length, 1);
    assert.equal((compiled[index].fragmentShader.match(/retained surface/g) || []).length, 1);
    assert.equal((compiled[index].fragmentShader.match(/cached field/g) || []).length, 1);
  }
  assert.notEqual(
    compiled[0].uniforms.installLineA.value,
    compiled[1].uniforms.installLineA.value,
    "each material keeps a stable pack rather than mutating a per-draw global"
  );
  lights.dispose();
  avatar.children[0].geometry.dispose();
  proxy.children[0].geometry.dispose();
  source.dispose();
});

test("generic line and point transport channels retain their authored energy and scheduled powers", () => {
  const config = fixtureWorld();
  config.installationLines[0].transport = true;
  config.installationPoints[0].transport = true;
  config.installationPoints[0].distance = 2.5;
  config.installationPoints[0].emitterRadius = 0.025;
  const channels = roomLightSources(config);
  assert.equal(channels.length, 2);
  assert.deepEqual(channels[0].position, [0, 2.5, 0]);
  assert.deepEqual(channels[1].position, [0, 3, 0]);
  assert.equal(channels[1].distance, 2.5);
  assert.equal(channels[1].emitterRadius, 0.025);
  const lights = createLightInstallations(config);
  lights.update({ minute: 720, daylight: 0.95, activity: "reading" });
  // The fixtures follow the entrance schedule, 0.6 by day.
  assert.deepEqual(lights.indirectPowers(), [0.04 * 2 * 0.6, 0.12 * 0.6]);
  lights.dispose();
});

test("straight pavilion strips use exact single spans and the authored outdoor receiver bounds", () => {
  const region = { min: [-8.5, -1.9, -12.8], max: [8, 3.4, -4.4] };
  const lights = createLightInstallations({
    terrace: {
      region,
      festoon: {
        points: [
          [3.78, 2.7, -6.72],
          [3.78, 2.7, -11.53],
        ],
        sag: 0,
        intensity: 0.18,
      },
    },
  });
  const strips = lights.lines.filter((line) => line.id === "festoon");
  assert.equal(strips.length, 1);
  assert.deepEqual(strips[0].a.toArray(), [3.78, 2.615, -6.72]);
  assert.deepEqual(strips[0].region.min.toArray(), region.min);
  assert.equal(strips[0].intensity, 0.18);
  lights.dispose();
});

test("authored diffuser tags follow their own schedule through a shared legacy material name", () => {
  const config = fixtureWorld();
  config.installationLines[0].glowTag = "portal-brow";
  const lights = createLightInstallations(config);
  const material = new THREE.MeshStandardMaterial({ name: "festoon bulb glass", emissive: 0xffcc88, emissiveIntensity: 2 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  mesh.userData.installationGlow = "portal-brow";
  const root = new THREE.Group();
  root.add(mesh);
  lights.bindModel(root, { group: "west" });
  lights.update({ minute: 720, daylight: 0.95, activity: "reading" });
  assert.equal(lights.levels.festoon, 0);
  assert.equal(mesh.material.emissiveIntensity, 2 * 0.6, "the entrance schedule's daytime level");
  lights.dispose();
  mesh.geometry.dispose();
  material.dispose();
});

test("the combined estate suggestion retains every authored source within fixed per-material and transport budgets", () => {
  const report = JSON.parse(
    readFileSync(new URL("../artwork/coastal-home/reviews/estate-outdoors/lighting-receivers.json", import.meta.url), "utf8")
  );
  const config = {
    ...report.sourceFixtureInputs,
    installationLines: report.installationLines,
    installationPoints: report.installationPoints,
    installationReceivers: report.installationReceivers,
  };
  const lights = createLightInstallations(config);
  assert.equal(lights.lines.length, 22);
  assert.equal(lights.points.length, 16);
  assert.equal(lights.evidence().receiverPacks.architecture.lines, 17);
  for (const [group, pack] of Object.entries(lights.evidence().receiverPacks)) {
    assert.ok(pack.lines <= 18 && pack.points <= 10, group);
    assert.equal(pack.lines, report.evidence.receiverPacks[group].lines);
    assert.equal(pack.points, report.evidence.receiverPacks[group].points);
  }
  assert.deepEqual(
    roomLightSources(config).map((source) => source.id),
    report.transportChannels.orderedIds
  );
  assert.equal(roomLightSources(config).length + 8, 23);
  lights.update({ minute: 1260, daylight: 0, activity: "reading", visit: "library" });
  // This retained receipt predates the October 24 walking-light adjustment.
  // Keep its immutable source/receiver geometry, scaling only idle room power
  // from the dated 0.16 baseline to the current 0.26 wayfinding level.
  const powers = lights.indirectPowers();
  for (const [index, power] of report.transportChannels.powers.entries()) {
    const id = report.transportChannels.orderedIds[index];
    const idleRoom = /^(bath-living|bath-bedroom|library-upper):/.test(id);
    assert.ok(Math.abs(powers[index] - power * (idleRoom ? 0.26 / 0.16 : 1)) < 1e-10, id);
  }
  const samples = [
    ["living", [0, 1, 0]],
    ["upper", [0, 3.6, 2]],
    ["gym", [8, 1, -2]],
    ["bath-living", [-6.3, 0.1, 4]],
    ["bath-bedroom", [-6.3, 2.7, 4]],
    ["library", [-10.5, 0.1, -7]],
    ["library-upper", [-10.5, 2.7, -7]],
    ["gallery-lower", [-9.25, 0.1, 4]],
    ["gallery-upper", [-9.25, 2.7, 4]],
    ["exterior", [-1, 0.1, -7]],
  ];
  for (const [group, coordinates] of samples) {
    const p = new THREE.Vector3(...coordinates),
      n = new THREE.Vector3(0, 1, 0);
    const expected = lights.irradianceAt(p, n),
      actual = lights.irradianceAt(p, n, group);
    for (const channel of ["r", "g", "b"]) assert.ok(Math.abs(expected[channel] - actual[channel]) < 1e-10, `${group}:${channel}`);
  }
  lights.dispose();
});
