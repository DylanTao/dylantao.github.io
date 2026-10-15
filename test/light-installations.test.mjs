import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createLightInstallations, darkness, lineIrradiance, SCHEDULES, windowLevel } from "../assets/js/home-scene/light-installations.mjs";
import { PRACTICAL_SCHEDULES, sleepWindow } from "../assets/js/home-scene/warm-practicals.mjs";

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// Brute-force midpoint quadrature of the Lambertian integral the closed form evaluates.
function numeric(p, n, a, b, steps = 200000) {
  const d = b.clone().sub(a);
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const x = a
      .clone()
      .addScaledVector(d, (i + 0.5) / steps)
      .sub(p);
    const r = x.length();
    sum += Math.max(0, n.dot(x)) / (r * r * r);
  }
  return (sum * d.length()) / steps;
}

test("the closed-form line irradiance matches brute-force integration, including across the horizon", () => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let k = 0; k < 40; k++) {
    const p = v(random(), random(), random());
    const n = v(random(), random(), random()).normalize();
    const a = v(random() * 3, random() * 3 + 2, random() * 3);
    const b = v(random() * 3, random() * 3 + 2, random() * 3);
    const exact = lineIrradiance(p, n, a, b);
    const brute = numeric(p, n, a, b);
    assert.ok(Math.abs(exact - brute) <= 1e-3 * Math.max(1, brute), `${exact} vs ${brute}`);
  }
});

test("a long line overhead approaches the infinite-line irradiance 2I/h", () => {
  const h = 2.4;
  const e = lineIrradiance(v(0, 0, 0), v(0, 1, 0), v(-400, h, 0), v(400, h, 0));
  assert.ok(Math.abs(e - 2 / h) < 1e-3, e);
  // Below the surface's horizon nothing arrives.
  assert.equal(lineIrradiance(v(0, 0, 0), v(0, 1, 0), v(-1, -1, 0), v(1, -1, 0)), 0);
});

test("schedule windows fade in and out and wrap past midnight", () => {
  assert.equal(windowLevel(12 * 60, 16 * 60, 23 * 60 + 30, 20), 0);
  assert.equal(windowLevel(20 * 60, 16 * 60, 23 * 60 + 30, 20), 1);
  assert.ok(Math.abs(windowLevel(16 * 60 + 10, 16 * 60, 23 * 60 + 30, 20) - 0.5) < 1e-9);
  assert.equal(windowLevel(1 * 60, 23 * 60, 3 * 60, 10), 1);
  assert.equal(windowLevel(4 * 60, 23 * 60, 3 * 60, 10), 0);
  assert.deepEqual(darkness(0.9), { outside: 0, inside: 0 });
  assert.deepEqual(darkness(0), { outside: 1, inside: 1 });
});

test("installations switch at different times of day", () => {
  const night = darkness(0.02),
    day = darkness(0.9);
  const level = (id, minute, dark, activity = "lounge") => SCHEDULES[id]({ minute, dark, activity });
  // The festoon lights the evening terrace and is off by day and after half past eleven.
  assert.equal(level("festoon", 13 * 60, day), 0);
  assert.equal(level("festoon", 21 * 60, night), 1);
  assert.equal(level("festoon", 1 * 60, night), 0);
  // The fire burns from half past seven to quarter to eleven.
  assert.equal(level("fire", 20 * 60 + 30, night), 1);
  assert.equal(level("fire", 23 * 60 + 30, night), 0);
  // Step lights stay on low all night, and the pool light is full for the soak, even in daylight.
  assert.equal(level("steps", 3 * 60, night), 0.45);
  assert.equal(level("pool", 18 * 60 + 20, day, "soak"), 1);
  // Late coding keeps the soffit glowing after its evening window.
  assert.equal(level("soffit", 1 * 60, night, "coding"), 0.35);
});

test("the bedside lamp wakes Sirui, lights the last minutes before sleep, and is a night light between", () => {
  const schedule = [
    [0, "coding"],
    [180, "sleep"],
    [690, "breakfast"],
  ];
  const window = sleepWindow(schedule);
  assert.deepEqual(window, { bed: 180, wake: 690 });
  const lamp = (minute) => PRACTICAL_SCHEDULES.sleep({ minute, ...window });
  assert.equal(lamp(170), 1);
  assert.equal(lamp(300), 0.04);
  assert.ok(lamp(675) > 0.2 && lamp(675) < 0.5);
  assert.ok(lamp(689) > lamp(675));
  assert.equal(lamp(700), 1);
  assert.equal(lamp(900), 0);
  assert.equal(PRACTICAL_SCHEDULES.study({ activity: "coding" }), 1);
  assert.equal(PRACTICAL_SCHEDULES.study({ activity: "lounge" }), 0.3);
});

test("the installations read the terrace from the manifest and report their levels", () => {
  const config = {
    terrace: {
      festoon: {
        points: [
          [-5, 2.6, -7],
          [-2.6, 2.5, -7.4],
          [0.4, 2.5, -7.1],
          [5, 2.6, -4.6],
        ],
        sag: 0.32,
        bulbs: [],
      },
      fire: [-3.95, 0.38, -6.1],
    },
    navigation: {
      stairs: [
        [-2.1, 0, 4.65],
        [-1.87, 0.17, 4.65],
        [1.77, 2.6, 4.65],
        [2.35, 2.6, 4.65],
        [2.35, 2.6, 3.94],
      ],
    },
  };
  const lights = createLightInstallations(config);
  assert.equal(lights.lines.filter((l) => l.id === "festoon").length, 6);
  assert.ok(lights.lines.length <= 10 && lights.points.length <= 4);
  const evening = lights.update({ minute: 21 * 60, daylight: 0.02, activity: "lounge" });
  assert.equal(evening.festoon, 1);
  assert.equal(lights.uniforms.installActive.value, 1);
  const noon = lights.update({ minute: 12 * 60, daylight: 0.95, activity: "reading" });
  assert.ok(Object.values(noon).every((level) => level === 0));
  assert.equal(lights.uniforms.installActive.value, 0);
  lights.dispose();
});
