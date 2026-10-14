import test from "node:test";
import assert from "node:assert/strict";
import { shaftExitRadiance, wellOpenFraction, wellSunPatch } from "../assets/js/home-scene/light-well.mjs";

// The authored shaft (manifest lightWell): 0.42 m radius, leaning 28 degrees toward the south.
const well = {
  aperture: [2.2, 5.737, 3.18],
  apertureRadius: 0.42,
  top: [1.4154, 7.2126, 3.18],
  topRadius: 0.42,
  axis: [-0.4695, 0.8829, 0],
  floor: 2.6,
};
const along = (direction) => {
  const length = Math.hypot(...direction);
  return direction.map((value) => value / length);
};

test("the sun passes the shaft only when it stands near the shaft's own direction", () => {
  assert.equal(wellOpenFraction(well, [0, -1, 0]), 0, "night");
  assert.ok(Math.abs(wellOpenFraction(well, well.axis) - 1) < 1e-9, "straight down the shaft");
  assert.ok(wellOpenFraction(well, along([-0.651, 0.756, -0.065])) > 0.2, "October noon, from the south");
  assert.equal(wellOpenFraction(well, along([0.2, 0.5, 0.84])), 0, "a north-eastern sun");
});

test("sky through the shaft matches the view factor between its two openings", () => {
  // Two coaxial discs of radius r a distance h apart: F = (X - sqrt(X^2 - 4)) / 2 with X = 2 + h^2/r^2.
  const h = 1.671,
    x = 2 + (h * h) / (well.apertureRadius * well.apertureRadius),
    factor = (x - Math.sqrt(x * x - 4)) / 2;
  const { skyShare, radiance } = shaftExitRadiance(well, { skyRadiance: [1, 1, 1], albedo: 0, samples: 4096 });
  assert.ok(Math.abs(skyShare - factor) < 0.004, `traced ${skyShare}, analytic ${factor}`);
  assert.ok(Math.abs(radiance[0] - factor) < 0.004);
});

test("walls add light, never more than they receive, and only while lit", () => {
  const sun = along([-0.651, 0.756, -0.065]),
    dark = shaftExitRadiance(well, { toSun: sun, sunIrradiance: [3, 3, 3], skyRadiance: [1, 1, 1], albedo: 0 }),
    pale = shaftExitRadiance(well, { toSun: sun, sunIrradiance: [3, 3, 3], skyRadiance: [1, 1, 1], albedo: 0.62 }),
    white = shaftExitRadiance(well, { toSun: sun, sunIrradiance: [3, 3, 3], skyRadiance: [1, 1, 1], albedo: 1 });
  assert.ok(dark.radiance[0] < pale.radiance[0] && pale.radiance[0] < white.radiance[0]);
  // Radiance leaving a diffuse wall is at most albedo/pi of what reaches it: sun plus a full sky.
  assert.ok(white.radiance[0] < (3 + Math.PI) / Math.PI);
  const night = shaftExitRadiance(well, { toSun: [0, -1, 0], sunIrradiance: [0, 0, 0], skyRadiance: [0, 0, 0] });
  assert.deepEqual(night.radiance, [0, 0, 0]);
});

test("the sun patch lies on the sun's ray through the aperture and glows by what it reflects", () => {
  const sun = along([-0.3, 0.95, 0.05]),
    pool = { center: [3.17, 3.18], radius: 0.86, surfaceY: 3.0 },
    patch = wellSunPatch(well, sun, [2.5, 2, 1.5], 0.8, pool);
  const t = (well.aperture[1] - patch.center[1]) / sun[1];
  assert.ok(Math.abs(patch.center[0] - (well.aperture[0] - sun[0] * t)) < 1e-9);
  assert.equal(patch.center[1], 3.0, "inside the pool it lands on the water");
  assert.ok(patch.radiance[0] < (2.5 * sun[1] * 0.8) / Math.PI, "the water reflects only part of the sun");
  assert.equal(wellSunPatch(well, sun, [2.5, 2, 1.5], 0, pool), null);
});
