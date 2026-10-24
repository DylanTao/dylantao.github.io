import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createCoastalWind } from "../assets/js/home-scene/coastal-wind.mjs";
import { COAST_SHELTER } from "../assets/js/home-scene/wind-field.mjs";
import { createLightInstallations } from "../assets/js/home-scene/light-installations.mjs";

test("GPU rooted-plant shelter classification follows the live CPU facade plane", () => {
  let glassZ = COAST_SHELTER.glassZ + 8;
  const coast = {
    state: { meanSpeed: 2, direction: [0.2, 0.98], indoorLeak: 0.05 },
    get shelterGlassZ() {
      return glassZ;
    },
  };
  const wind = createCoastalWind({ coast });
  wind.update(20, { coast });
  assert.ok(Math.abs(wind.evidence().shelterGlassZ - glassZ) < 1e-6);
  glassZ += 3;
  wind.update(20, { coast });
  assert.ok(Math.abs(wind.evidence().shelterGlassZ - glassZ) < 1e-6, "a moved facade does not leave a cached GPU plane");
  wind.update(20, { coast: { state: coast.state } });
  assert.ok(Math.abs(wind.evidence().shelterGlassZ - COAST_SHELTER.glassZ) < 1e-6, "older non-coast inputs retain their original plane");
  wind.dispose();
});

function fixture(setback) {
  const point = (p) => p.map((value, axis) => value + (axis === 2 ? setback : 0));
  const region = (lo, hi) => ({ min: point(lo), max: point(hi) });
  return {
    retreat: { setbackMetres: setback },
    equipment: { gym: {} },
    navigation: {
      stairs: [
        [0, 0, 4],
        [0, 0.2, 4.3],
        [0, 2.3, 6],
        [0, 2.6, 6.3],
      ].map(point),
    },
    interiorLights: {
      region: region([-5, -0.2, -4], [-1, 2.5, 6]),
      shelf: [
        [-4.8, 1.6, -3],
        [-2.1, 1.6, -3],
      ].map(point),
      pendant: point([-3.2, 2.3, 3]),
    },
    rooms: [
      {
        id: "bath-living",
        lightRegion: region([-8.25, 0, 1.85], [-4.38, 2.35, 6.1]),
        lighting: { lines: [{ id: "mirror", a: point([-8.1, 2.16, 3]), b: point([-8.1, 2.16, 4]), intensity: 0.7 }] },
      },
    ],
    installationLines: [
      { id: "native-cove", schedule: "entrance", a: point([0, 2, 3]), b: point([2, 2, 3]), intensity: 0.2, region: region([-1, 0, 2], [3, 3, 5]) },
    ],
    installationPoints: [
      { id: "native-lamp", schedule: "entrance", position: point([1, 1, 3]), intensity: 0.2, region: region([-1, 0, 2], [3, 3, 5]) },
    ],
  };
}

const close = (actual, expected, label) => {
  for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(actual[axis] - expected[axis]) < 1e-6, `${label}:${axis}`);
};

test("built-in lamps and visible diffusers follow setback once while native metadata stays world-space", () => {
  const config = fixture(8);
  const held = JSON.stringify(config);
  const old = createLightInstallations(fixture(0));
  const moved = createLightInstallations(config);
  assert.equal(JSON.stringify(config), held, "source metadata is not mutated");
  assert.equal(old.lines.length, moved.lines.length);
  assert.equal(old.points.length, moved.points.length);
  for (let i = 0; i < old.lines.length; i++) {
    const before = old.lines[i],
      after = moved.lines[i];
    assert.equal(after.id, before.id);
    for (const endpoint of ["a", "b"])
      close(
        after[endpoint].toArray(),
        before[endpoint].toArray().map((v, axis) => v + (axis === 2 ? 8 : 0)),
        `${after.id}:${endpoint}`
      );
    for (const side of ["min", "max"])
      close(
        after.region[side].toArray(),
        before.region[side].toArray().map((v, axis) => v + (axis === 2 ? 8 : 0)),
        `${after.id}:region:${side}`
      );
  }
  for (let i = 0; i < old.points.length; i++) {
    close(
      moved.points[i].position.toArray(),
      old.points[i].position.toArray().map((v, axis) => v + (axis === 2 ? 8 : 0)),
      old.points[i].id
    );
  }
  close(moved.lines.find((s) => s.source === "native-cove").a.toArray(), config.installationLines[0].a, "native-cove");
  close(moved.lines.find((s) => s.room === "bath-living").a.toArray(), config.rooms[0].lighting.lines[0].a, "native bathroom");
  close(moved.points.find((s) => s.source === "native-lamp").position.toArray(), config.installationPoints[0].position, "native-lamp");
  const strip = moved.root.getObjectByName("Gallery soffit light");
  strip.geometry.computeBoundingBox();
  close(strip.geometry.boundingBox.getCenter(new THREE.Vector3()).toArray(), [0, 2.338, 9.42], "visible soffit");
  assert.ok(moved.root.children.every((child) => !child.isLight));
  old.dispose();
  moved.dispose();
});

test("moved gym fixtures retain physical irradiance at the moved floor and leave the old space dark", () => {
  const old = createLightInstallations(fixture(0));
  const moved = createLightInstallations(fixture(8));
  for (const lights of [old, moved]) lights.update({ minute: 1200, daylight: 0, activity: "workout" });
  const up = new THREE.Vector3(0, 1, 0);
  const oldFloor = new THREE.Vector3(8.4, 0, -1.6);
  const shiftedFloor = oldFloor.clone().add(new THREE.Vector3(0, 0, 8));
  const expected = old.irradianceAt(oldFloor, up);
  const actual = moved.irradianceAt(shiftedFloor, up);
  assert.ok(expected.r > 0.1, "this probe measures useful fixture energy");
  close(actual.toArray(), expected.toArray(), "shifted gym irradiance");
  assert.equal(moved.irradianceAt(oldFloor, up).r, 0, "retired source locations cannot light empty outdoor space");
  old.dispose();
  moved.dispose();
});
