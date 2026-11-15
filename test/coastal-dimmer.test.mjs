import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "../assets/js/three.module.min.js";
import { DIMMER, dimmerStep } from "../assets/js/home-scene/dimmer.mjs";
import { createLightInstallations } from "../assets/js/home-scene/light-installations.mjs";
import { createWarmPracticals, practicalSourcesFor } from "../assets/js/home-scene/warm-practicals.mjs";

const manifest = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
// Night, nobody eating: the state in which walking past the kitchen used to flash its lights.
const night = { minute: 21 * 60 + 30, daylight: 0, activity: "lounge" };

test("a dimmer step approaches its target, faster up than down, and arrives exactly", () => {
  assert.ok(DIMMER.rise > 0.1 && DIMMER.rise < DIMMER.fall && DIMMER.fall < 2, "a presence lamp, not a theatre fade");
  // After one time constant a level has covered 1 - 1/e of the way.
  assert.ok(Math.abs(dimmerStep(0, 1, DIMMER.rise) - (1 - Math.exp(-1))) < 1e-12);
  assert.ok(Math.abs(dimmerStep(1, 0, DIMMER.fall) - Math.exp(-1)) < 1e-12);
  assert.ok(dimmerStep(0.2, 1, 0.1) - 0.2 > 1 - dimmerStep(1, 0.2, 0.1), "it comes up faster than it goes down");
  // It never overshoots, and one frame's step is small enough to read as motion.
  let level = 0.2,
    largest = 0;
  for (let frame = 0; frame < 600 && level !== 1; frame++) {
    const next = dimmerStep(level, 1, 1 / 60);
    assert.ok(next > level && next <= 1);
    largest = Math.max(largest, next - level);
    level = next;
  }
  assert.equal(level, 1, "it arrives exactly, so the settling flag can clear");
  assert.ok(largest < 0.05, `the largest step at 60 frames a second is ${largest.toFixed(3)} of full`);
  assert.equal(dimmerStep(0.3, 0.9, Infinity), 0.9);
  assert.equal(dimmerStep(0.9, 0.9, 0.016), 0.9);
  assert.equal(dimmerStep(0, 1, 0), 0, "no time, no movement");
  // The tolerance scales with the quantity: a lamp's power is not a 0..1 level.
  assert.equal(dimmerStep(5.99, 6, 0.016, 6), 6);
});

test("walking into the kitchen at night brings its lights up over about a second, not in one frame", () => {
  const lights = createLightInstallations(manifest);
  lights.update({ ...night, visit: "lounge" });
  const before = { ...lights.evidence().levels };
  assert.equal(lights.settling, false, "an ordinary update arrives at once");

  // The old behaviour, still what a still frame and the lab get.
  const snapped = createLightInstallations(manifest);
  snapped.update({ ...night, visit: "kitchen" });
  const full = snapped.evidence().levels;
  const moved = Object.keys(full).filter((id) => Math.abs(full[id] - before[id]) > 0.3);
  assert.ok(moved.includes("dining") && moved.includes("downlights"), `the kitchen's lights depend on the visit: ${moved}`);

  // Eased: nothing changes in the frame the visitor crosses the line.
  lights.update({ ...night, visit: "kitchen", ease: true });
  assert.equal(lights.settling, true);
  assert.deepEqual(lights.evidence().levels, before);
  let frames = 0,
    largest = 0,
    previous = before.dining;
  while (lights.settling && frames < 600) {
    assert.equal(lights.settle(1 / 60), true);
    const now = lights.evidence().levels.dining;
    largest = Math.max(largest, Math.abs(now - previous));
    previous = now;
    frames++;
  }
  assert.deepEqual(lights.evidence().levels, full, "the dimmer ends on the scheduled levels exactly");
  assert.ok(frames > 30 && frames < 150, `${frames} frames at 60 a second`);
  assert.ok(largest < 0.05, `no frame moves the dining lights by more than 5 % (${largest.toFixed(3)})`);
  assert.equal(lights.settle(1 / 60), false, "arrived: nothing more to do");

  // Leaving again mid-rise turns round smoothly, and a still finishes at once.
  lights.update({ ...night, visit: "kitchen" });
  lights.update({ ...night, visit: "lounge", ease: true });
  lights.settle(0.1);
  const falling = lights.evidence().levels.dining;
  assert.ok(falling < full.dining && falling > before.dining);
  lights.update({ ...night, visit: "kitchen", ease: true });
  lights.settle(0.1);
  assert.ok(lights.evidence().levels.dining > falling);
  lights.settle(Infinity);
  assert.deepEqual(lights.evidence().levels, full);
  assert.equal(lights.settling, false);
  // What the surfaces receive follows the shown level, not the target: the table under the dining
  // lights dims gradually as the visitor leaves.
  const table = new THREE.Vector3(manifest.interiorLights.dining[0][0], 0.8, manifest.interiorLights.dining[0][2]),
    up = new THREE.Vector3(0, 1, 0),
    received = () => lights.irradianceAt(table, up).r;
  const lit = received();
  lights.update({ ...night, visit: "lounge", ease: true });
  assert.equal(received(), lit, "unchanged in the frame of the change");
  lights.settle(0.2);
  const dimming = received();
  assert.ok(dimming < lit && dimming > 0, `${lit} then ${dimming}`);
  lights.settle(Infinity);
  assert.ok(received() < dimming);
});

test("the gym's lamp eases with the same dimmer when the visitor walks in", () => {
  const sources = practicalSourcesFor(manifest),
    lamps = createWarmPracticals(new THREE.Scene(), (m) => m, { sources }),
    gym = sources.findIndex((source) => source.id === "gym"),
    routine = { minute: 21 * 60 + 30, id: "lounge", schedule: manifest.weekday };
  lamps.update(0, routine, "lounge");
  const idle = lamps.lights[gym].intensity;
  assert.equal(lamps.settling, false);
  lamps.update(0, routine, "gym", { ease: true });
  assert.equal(lamps.lights[gym].intensity, idle, "nothing moves in the frame of the change");
  assert.equal(lamps.settling, true);
  lamps.settle(DIMMER.rise);
  const rising = lamps.lights[gym].intensity;
  assert.ok(rising > idle);
  lamps.settle(Infinity);
  const lit = lamps.lights[gym].intensity;
  assert.ok(lit > rising && lit > idle * 3, `${idle} to ${lit}`);
  assert.equal(lamps.settling, false);
  // Without ease it is the old immediate update.
  lamps.update(0, routine, "lounge");
  assert.equal(lamps.lights[gym].intensity, idle);
  assert.equal(lamps.settling, false);
});
