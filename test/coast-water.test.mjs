import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import {
  CANYON,
  KELVIN_HALF_ANGLE,
  SURF,
  WATER_IOR,
  WATER_LEVEL,
  breaking,
  createReflectionSchedule,
  mirrorPoint,
  reefAmount,
  refract,
  sampleStrip,
  schlick,
  seabedDepth,
  seabedOffset,
  shoreline,
  shorelineStrip,
  surfPhase,
  transmittance,
  wakeArm,
} from "../assets/js/footer-coast/water-optics.mjs";
import { aimMirror, mirrorMatrix } from "../assets/js/footer-coast/water.mjs";

const manifest = JSON.parse(readFileSync(new URL("../assets/models/la-jolla/manifest.json", import.meta.url), "utf8"));
const profile = manifest.coastProfile;
// The footer camera: 16 up and 38 back from its target, so it looks inland at about 22.8 degrees.
const view = (() => {
  const d = [0, 16, 38],
    n = Math.hypot(...d);
  return d.map((v) => v / n);
})();

test("the sea's waterline follows the authored terrain profile and its shader strip", () => {
  // Knots of the exported profile (Blender y, so the browser's z is its negative) and the home beach curve.
  for (const [x, y] of profile.filter(([x]) => x < -19 || x > 19)) assert.ok(Math.abs(shoreline(x, profile) + y) < 1e-9, `knot ${x}`);
  for (const x of [-19, -6, 0, 7.5, 19])
    assert.ok(Math.abs(shoreline(x, profile) - (2.1 - 0.7 * Math.sin(x * 0.23) - 0.25 * Math.sin(x * 0.68))) < 1e-9);
  // Continuous: no step between neighbouring samples anywhere along the water plane (the steepest
  // authored stretch, the headland before Children's Pool, rises about 1.24 units per unit of x).
  for (let x = -95; x < 95; x += 0.05) assert.ok(Math.abs(shoreline(x + 0.05, profile) - shoreline(x, profile)) < 0.08, `step at ${x.toFixed(2)}`);
  // The shader's strip lookup (texel-centered linear filtering) stays within a hundredth of a unit.
  const strip = shorelineStrip(profile, 1024, 95);
  let worst = 0;
  for (let x = -94.9; x < 94.9; x += 0.013) worst = Math.max(worst, Math.abs(sampleStrip(strip, x, 95) - shoreline(x, profile)));
  assert.ok(worst < 0.01, `strip error ${worst}`);
});

test("the seabed shelves gently off the beach and drops into the canyon off Scripps Pier", () => {
  assert.ok(seabedDepth(0) < 0.03 && seabedDepth(0) > 0, "a film of water at the waterline");
  let previous = 0;
  for (let d = 0; d <= 16; d += 0.25) {
    const depth = seabedDepth(d, -6);
    assert.ok(depth >= previous, `deepening at ${d}`);
    previous = depth;
  }
  // The phone view shows water out to about 18 units: still a miniature sea, not an ocean trench.
  assert.ok(seabedDepth(18, -6) < 2.7);
  for (const d of [1, 2, 4]) assert.ok(seabedDepth(d, CANYON.x) > seabedDepth(d, -6) + 0.25, `canyon at ${d}`);
  assert.ok(Math.abs(seabedDepth(3, CANYON.x + 12) - seabedDepth(3, -6)) < 0.01, "the canyon is local");
});

test("clear water turns sand aqua, then turquoise: red is absorbed first", () => {
  assert.deepEqual(transmittance(0), [1, 1, 1]);
  let last = [1, 1, 1];
  for (const path of [0.2, 0.8, 1.6, 3.2]) {
    const [r, g, b] = transmittance(path);
    assert.ok(r < g && g < b, `turquoise shift at ${path}`);
    assert.ok(r < last[0] && g < last[1] && b < last[2], "fades with depth");
    last = [r, g, b];
  }
  // The open sea hides the bottom: under 10 % of the blue light returns from four units of path.
  assert.ok(transmittance(4)[2] < 0.1);
});

test("refraction obeys Snell's law and the seabed shows nearer the shore than straight below", () => {
  const incident = view.map((v) => -v);
  const ray = refract(incident, [0, 1, 0], 1 / WATER_IOR);
  const sinIn = Math.hypot(incident[0], incident[2]),
    sinOut = Math.hypot(ray[0], ray[2]);
  assert.ok(Math.abs(sinIn - WATER_IOR * sinOut) < 1e-9, "n1 sin(i) = n2 sin(t)");
  assert.ok(Math.abs(Math.hypot(...ray) - 1) < 1e-9);
  assert.ok(-ray[1] > -incident[1], "the ray bends toward the normal");
  const depth = 0.6;
  const [dx, dz] = seabedOffset(view, [0, 1, 0], depth);
  assert.ok(Math.abs(dx) < 1e-9);
  assert.ok(dz < 0, "seen shoreward, away from the camera");
  assert.ok(-dz < depth * Math.tan(Math.asin(sinIn)), "less than an unbent ray would travel");
  // Total internal reflection cannot happen going into water.
  assert.notDeepEqual(refract([0.999, -0.0447, 0], [0, 1, 0], 1 / WATER_IOR), [0, 0, 0]);
});

test("Fresnel reflectance rises from 2 % head-on to total at grazing angles", () => {
  assert.ok(Math.abs(schlick(1) - 0.02) < 1e-12);
  assert.equal(schlick(0), 1);
  let last = 1;
  for (let c = 0; c <= 1; c += 0.05) {
    assert.ok(schlick(c) <= last + 1e-12);
    last = schlick(c);
  }
  // From the footer camera a level sea reflects about a tenth of the sky; the theme scales this up.
  assert.ok(Math.abs(schlick(view[1]) - 0.104) < 0.005);
});

test("surf crests travel shoreward once per period and break only over the shelf", () => {
  const x = 3;
  const crest = (t) => {
    // The crest nearest d = 1.5: phase is a whole number there.
    let best = null;
    for (let d = 0; d <= 3; d += 0.0005) {
      const p = surfPhase(d, x, t);
      if (Math.abs(p - Math.round(p)) < 0.0015 && (best === null || Math.abs(d - 1.5) < Math.abs(best - 1.5))) best = d;
    }
    return best;
  };
  const a = crest(0),
    b = crest(1.5);
  assert.ok(b < a, `crest moved from ${a} to ${b}`);
  for (const d of [0.5, 1.7, 3.4]) assert.ok(Math.abs(surfPhase(d, x, 4 + SURF.period) - surfPhase(d, x, 4) - 1) < 1e-9);
  // Spacing shrinks as waves shoal toward the beach.
  const spacing = (d) => 1 / ((surfPhase(d + 0.001, x, 0) - surfPhase(d, x, 0)) / 0.001);
  assert.ok(spacing(0.3) < spacing(2.5));
  assert.equal(breaking(SURF.start + 0.2, -6), 0, "no whitewater offshore");
  assert.equal(breaking(0.05, -6), 0, "none on the wet sand");
  assert.ok(breaking(1, -6) > 0.5);
  // Reefs off the coves break waves farther out.
  const reef = -24.6;
  assert.ok(reefAmount(reef) > 0.99 && reefAmount(-6) < 1e-6);
  assert.ok(breaking(SURF.start + 0.2, reef) > 0);
});

test("wakes open at the Kelvin angle and lights reflect where the camera meets their mirror image", () => {
  assert.ok(Math.abs((KELVIN_HALF_ANGLE * 180) / Math.PI - 19.47) < 0.01);
  assert.ok(Math.abs(wakeArm(2) / 2 - Math.tan(KELVIN_HALF_ANGLE)) < 1e-12);
  assert.equal(wakeArm(-1), 0);
  // A pier lamp 1.66 above the water reflects 1.66 / tan(22.8 deg) units toward the camera.
  const forward = view.map((v) => -v);
  const [x, z] = mirrorPoint(13.24, WATER_LEVEL + 1.66, 2, forward);
  assert.ok(Math.abs(x - 13.24) < 1e-9);
  assert.ok(Math.abs(z - (2 + 1.66 * (38 / 16))) < 1e-9);
});

test("the sea's mirror samples, at each water point, the reflection of the point it mirrors", () => {
  const camera = new THREE.OrthographicCamera(-30, 30, 7.25, -7.25, 0.1, 150);
  camera.position.set(0, 20.5, 38);
  camera.lookAt(0, 4.5, 0);
  camera.updateMatrixWorld();
  const mirror = new THREE.OrthographicCamera();
  aimMirror(camera, mirror, profile);
  const matrix = mirrorMatrix(mirror);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  for (const point of [new THREE.Vector3(6.6, 3.3, -0.9), new THREE.Vector3(12.5, 1.7, 2), new THREE.Vector3(-4, 4.2, -2.6)]) {
    // The camera sees the point's mirror image below the plane through this water point.
    const image = new THREE.Vector3(point.x, 2 * WATER_LEVEL - point.y, point.z);
    const run = (image.y - WATER_LEVEL) / forward.y;
    const water = image.clone().addScaledVector(forward, -run);
    assert.ok(Math.abs(water.y - WATER_LEVEL) < 1e-9);
    const a = water.clone().applyMatrix4(matrix),
      b = point.clone().applyMatrix4(matrix);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-6, `uv ${a.x},${a.y} vs ${b.x},${b.y}`);
    // Visible coast reflects inside the mirror's texture.
    if (water.z > shoreline(water.x, profile)) assert.ok(a.x > 0 && a.x < 1 && a.y > 0 && a.y < 1, "inside the mirror texture");
  }
  // The texture covers only the band of the view where water shows, not the sky above the coast.
  assert.ok(mirror.top - mirror.bottom < (camera.top - camera.bottom) * 0.6);
});

test("the mirror redraws on demand: at once when still, spaced while the coast animates", () => {
  const schedule = createReflectionSchedule({ spacing: 3 });
  assert.equal(schedule.due(true), true, "the first frame always has a mirror");
  assert.equal(schedule.due(true), false, "nothing changed");
  schedule.invalidate();
  assert.equal(schedule.due(true), false, "too soon while animating");
  assert.equal(schedule.due(true), true, "after the spacing");
  assert.equal(schedule.renders, 2);
  schedule.invalidate();
  assert.equal(schedule.due(false), true, "a still scene redraws at once");
  for (let i = 0; i < 10; i++) assert.equal(schedule.due(true), false, "a steady scene costs no redraws");
});
