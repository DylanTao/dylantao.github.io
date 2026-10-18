import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createHabitatRoute,
  plantedFoot,
  raccoonMotion,
  raccoonStride,
  shorebirdMotion,
  swashEdge,
  gullMotion,
  gullSchedule,
  gullRaid,
  balconyGullActing,
  SANDPIPER_HOMES,
} from "../assets/js/home-scene/wildlife-neighbor-motion.mjs";
import { beachPoint } from "../assets/js/home-scene/shore.mjs";
import { sampleOcean, oceanWindState } from "../assets/js/home-scene/ocean-spectrum.mjs";
import { cameraTerrainHeight } from "../assets/js/home-scene/camera.mjs";

const manifest = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const perches = manifest.terrain.perches;
// The camera height grid is the exported terrain proxy (2 m), sampled bilinearly as camera.mjs does.
const grid = manifest.cameraCollision;
const ground = (x, z) => cameraTerrainHeight(x, z, grid);

test("stance anchors remain planted and swing joins have zero lift", () => {
  for (const offset of [0, 0.25, 0.5, 0.75]) {
    const poses = [0.03, 0.32, 0.67].map((u) => plantedFoot((5 + u - offset) * 0.18, offset));
    assert.ok(poses.every((pose) => pose.contact && pose.lift === 0));
    poses.forEach((pose) => near(pose.anchorDistance, poses[0].anchorDistance));
    for (const boundary of [0.68, 1]) {
      const a = plantedFoot((5 + boundary - offset - 1e-6) * 0.18, offset);
      const b = plantedFoot((5 + boundary - offset + 1e-6) * 0.18, offset);
      near(a.anchorDistance, b.anchorDistance);
      near(a.lift, b.lift);
    }
  }
});

test("the raccoon sleeps by day at its den, wakes at dusk, forages by night and walks home at dawn", () => {
  const route = createHabitatRoute(manifest.terrain.habitats.raccoon.path);
  const L = route.length,
    stride = raccoonStride(L);
  route.point(0).forEach((value, axis) => near(value, route.point(L)[axis]));
  near((L / stride) % 1, 0, 1e-9);
  near(Math.round(L / stride) * stride, L, 1e-9);
  const day = { night: false, nightStart: -2e4, dayStart: -1e4 };
  for (let t = 0; t < 300; t += 1.7) {
    const pose = raccoonMotion(t, false, L, day);
    assert.equal(pose.state, "sleep");
    near(pose.distance / L - Math.round(pose.distance / L), 0, 1e-9);
    assert.ok(pose.curl > 0.99 && pose.activity === 0);
  }
  const night = { night: true, nightStart: -2e4, dayStart: -1e4 };
  const seen = new Set();
  let previous = raccoonMotion(0, true, L, night);
  for (let t = 0.05; t < 600; t += 0.05) {
    const pose = raccoonMotion(t, true, L, night);
    seen.add(pose.state);
    assert.ok(pose.distance >= previous.distance - 1e-9 && pose.distance - previous.distance < 0.05, `raccoon jumped at ${t}`);
    if (pose.activity === 0 && previous.activity === 0) near(pose.distance, previous.distance, 1e-9);
    assert.ok(Object.values(pose).every((value) => typeof value !== "number" || Number.isFinite(value)));
    previous = pose;
  }
  for (const state of ["walk", "dig", "stand", "wash", "look"]) assert.ok(seen.has(state), `never ${state}: ${[...seen]}`);
  // Dusk: it wakes where it slept (the den's foot anchors coincide on every lap), then sets off.
  const dusk = { night: true, nightStart: 100, dayStart: -1e4 };
  const asleep = raccoonMotion(99.9, false, L, { night: false, nightStart: -2e4, dayStart: -1e4 });
  const waking = raccoonMotion(100.1, true, L, dusk);
  assert.equal(waking.state, "wake");
  route.point(asleep.distance).forEach((value, axis) => near(value, route.point(waking.distance)[axis], 1e-9));
  assert.ok(raccoonMotion(103, true, L, dusk).sleep < raccoonMotion(100.2, true, L, dusk).sleep);
  assert.notEqual(raccoonMotion(140, true, L, dusk).state, "wake");
  // Dawn: it keeps walking from where the night left it to the den, then lies down and curls.
  const dawn = { night: false, nightStart: 100, dayStart: 400 };
  const before = raccoonMotion(399.999, true, L, { night: true, nightStart: 100, dayStart: -1e4 });
  const after = raccoonMotion(400.001, false, L, dawn);
  near(before.distance, after.distance, 1e-3);
  let home = null;
  for (let t = 400; t < 460 && !home; t += 0.1) if (raccoonMotion(t, false, L, dawn).state === "sleep") home = raccoonMotion(t + 4, false, L, dawn);
  assert.ok(home, "the raccoon reaches its den and sleeps");
  near(home.distance / L - Math.round(home.distance / L), 0, 1e-9);
  assert.ok(home.curl > 0.99);
});

test("sandpipers sprint with the actual swash, probe the drawdown and keep out of the water", () => {
  // The authored sea, a glassy morning and a breezy afternoon: the drawn wind sea turns and grows.
  for (const sea of [null, oceanWindState(0.5, 0.4), oceanWindState(4.5, -0.7)]) {
    const beach = { ...manifest.beach };
    for (const [index, home] of SANDPIPER_HOMES.entries()) {
      sandpiperRun(beach, sea, index, home);
    }
  }
  const beach = manifest.beach;
  // The solved edge is where the drawn sea surface meets the shared beach section.
  for (const [x, t] of [
    [0, 3],
    [2.3, 41],
    [5.2, 130],
  ]) {
    const fraction = swashEdge(x, t, beach),
      point = beachPoint(x, fraction, beach);
    near(-7.35 + sampleOcean(x, point[2] + 28, t, 1.1).displacement[1], point[1], 0.002);
  }
});

function sandpiperRun(beach, sea, index, home) {
  let wet = 0,
    samples = 0,
    fastest = 0;
  const states = new Set();
  let previous = shorebirdMotion(0, index, beach, sea);
  for (let t = 0.05; t < 240; t += 0.05) {
    const pose = shorebirdMotion(t, index, beach, sea);
    samples++;
    states.add(pose.state);
    assert.ok(pose.position.every(Number.isFinite) && Number.isFinite(pose.yaw));
    assert.ok(Math.abs(pose.x - home) <= 1.6, `sandpiper ${index} strays to ${pose.x}`);
    const step = Math.hypot(pose.position[0] - previous.position[0], pose.position[2] - previous.position[2]);
    fastest = Math.max(fastest, step / 0.05);
    assert.ok(pose.distance >= previous.distance - 1e-9, "path length only grows");
    // The bird's depth in the displaced sea that the renderer draws at its feet.
    const water = -7.35 + sampleOcean(pose.position[0], pose.position[2] + 28, t, 1.1, sea).displacement[1];
    if (water - pose.position[1] > 0.03) wet++;
    if (samples % 37 === 0) {
      const a = shorebirdMotion(t - 1e-5, index, beach, sea),
        b = shorebirdMotion(t + 1e-5, index, beach, sea);
      assert.ok(Math.abs(Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw))) < 0.001, "turns, never flips a half-turn");
    }
    previous = pose;
  }
  assert.ok(wet / samples < 0.03, `sandpiper ${index} stands in water ${((100 * wet) / samples).toFixed(1)}% of the time`);
  assert.ok(states.has("sprint") && states.has("probe"), `sandpiper ${index} states ${[...states]}`);
  assert.ok(fastest > 1 && fastest < 4.5, `sandpiper ${index} top speed ${fastest}`);
}

test("gull flight joins soaring, approach, perch and departure with C2 continuity and honest headings", () => {
  for (let index = 0; index < 4; index++) {
    const perch = perches[index % 3];
    for (let lap = 1; lap < 4; lap++) {
      const schedule = gullSchedule(lap * 90 + 1 - index * 19, index);
      const joins = [schedule.glideEnd, schedule.approachSplit, schedule.perchStart, schedule.perchEnd, schedule.departSplit, schedule.end];
      const raid = index === 3 ? gullRaid(schedule.k, perch) : null;
      if (raid) joins.push(raid.begin, raid.arrive, raid.leave, raid.finish);
      for (const join of joins) {
        const before = gullMotion(join - 1e-6, index, perch),
          after = gullMotion(join + 1e-6, index, perch);
        for (const key of ["position", "velocity", "acceleration"]) before[key].forEach((value, axis) => near(value, after[key][axis], 0.0005));
        for (const key of ["wingFold", "bank", "pitch", "footDeploy", "contactWeight"]) near(before[key], after[key], 0.0005);
      }
      for (let t = schedule.start + 0.4; t < schedule.end; t += 0.37) {
        if (t < 0) continue;
        const pose = gullMotion(t, index, perch),
          a = gullMotion(t - 1e-4, index, perch),
          b = gullMotion(t + 1e-4, index, perch);
        for (let axis = 0; axis < 3; axis++) near((b.position[axis] - a.position[axis]) / 2e-4, pose.velocity[axis], 2e-4);
        assert.ok(pose.position[1] > 5 && pose.position[1] < 16, `gull ${index} altitude ${pose.position[1]}`);
        const speed = Math.hypot(pose.velocity[0], pose.velocity[2]);
        // Headings follow the flight derivative, except while a raider turns to face the perch it hovers over.
        const facing = raid && t > raid.arrive - 1.5 && t < raid.leave + 1;
        if (pose.state === "glide" && speed > 0.05 && !facing)
          near((Math.sin(pose.yaw) * pose.velocity[0] + Math.cos(pose.yaw) * pose.velocity[2]) / speed, 1, 1e-6);
        if (pose.state === "perch") pose.position.forEach((value, axis) => near(value, perch[axis]));
        // Clear of the cliffs and headlands, except over the last two metres to its own perch.
        const fromPerch = Math.hypot(pose.position[0] - perch[0], pose.position[2] - perch[2]);
        if (pose.state !== "perch" && fromPerch > 2.2)
          assert.ok(pose.position[1] > ground(pose.position[0], pose.position[2]) + 0.6, `gull ${index} grazes terrain at ${t}`);
        assert.ok(Math.abs(pose.bank) <= 0.75 + 1e-9);
      }
    }
  }
});

test("gulls soar with flap bouts and banked turns, flare into the perch and fold their wings", () => {
  const index = 1,
    perch = perches[1];
  const schedule = gullSchedule(200, index);
  let flapped = 0,
    banked = 0;
  for (let t = schedule.start + 0.5; t < schedule.glideEnd; t += 0.1) {
    const pose = gullMotion(t, index, perch);
    if (pose.flap > 0.5) flapped++;
    if (Math.abs(pose.bank) > 0.25) banked++;
  }
  assert.ok(flapped > 20, "flap bouts break up the glide");
  assert.ok(banked > 20, "turns are banked visibly");
  const flare = gullMotion(schedule.perchStart - 0.4, index, perch);
  assert.ok(flare.pitch < -0.35 && flare.tailFan > 0.3 && flare.footDeploy > 0.5, "flares with tail fanned and feet down");
  assert.ok(gullMotion(schedule.perchStart + 0.1, index, perch).wingFold < 0.2, "wings stay up a beat after touchdown");
  assert.ok(gullMotion(schedule.perchStart + 2, index, perch).wingFold > 0.95);
  const states = new Set();
  for (let t = schedule.perchStart; t < schedule.perchEnd; t += 0.2) states.add(gullMotion(t, index, perch).perchedState);
  assert.ok(states.size >= 2, `perched repertoire ${[...states]}`);
});

test("gull 3 raids gull 0's perch: it hovers calling, and the resident defends with a gape", () => {
  const perch = perches[0];
  let raid = null,
    k3 = 1;
  for (; k3 < 40 && !raid; k3++) raid = gullRaid(k3, perch);
  assert.ok(raid, "raids happen");
  assert.ok(Math.hypot(raid.hover[0] - perch[0], raid.hover[1] - perch[1], raid.hover[2] - perch[2]) < 1.7);
  const middle = (raid.arrive + raid.leave) / 2;
  const raider = gullMotion(middle, 3, perch),
    resident = gullMotion(middle, 0, perch);
  assert.equal(raider.state, "squabble");
  assert.ok(Math.hypot(...raider.position.map((value, axis) => value - raid.hover[axis])) < 0.1);
  assert.equal(resident.state, "perch");
  assert.equal(resident.perchedState, "threat");
  assert.ok(resident.jaw > 0.15 && resident.crouch > 0.3, "the resident crouches and gapes");
  assert.ok(raider.flap > 0.9 && raider.footDeploy > 0.5, "the raider hovers on beating wings, feet down");
  // The raider faces the resident while it hovers.
  const toward = Math.atan2(perch[0] - raid.hover[0], perch[2] - raid.hover[2]);
  near(Math.cos(raider.yaw - toward), 1, 1e-6);
});

test("the balcony gull keeps its rail with a full perched repertoire", () => {
  const states = new Set();
  for (let t = 0; t < 400; t += 0.25) {
    const pose = balconyGullActing(t);
    states.add(pose.state);
    assert.ok(Object.values(pose).every((value) => typeof value !== "number" || Number.isFinite(value)));
  }
  for (const state of ["look", "preen"]) assert.ok(states.has(state), `balcony gull never ${state}: ${[...states]}`);
  assert.ok(states.has("call") || states.has("stretch") || states.has("shake"));
});
