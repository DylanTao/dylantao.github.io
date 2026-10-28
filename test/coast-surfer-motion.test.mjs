import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RIDE, sampleSurferRide, sampleRideShoulder, surferBoardFrame, surferRideTrail } from "../assets/js/footer-coast/surfer-motion.mjs";
import { sampleCoastWave } from "../assets/js/footer-coast/wave-motion.mjs";
import { BODY, createCast, poseActor } from "../assets/js/footer-coast/people-pose.mjs";
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test("rider completes a smooth non-stalling cycle and the nose always follows velocity", () => {
  const dt = 0.00001;
  for (let t = 0; t <= RIDE.period; t += RIDE.period / 180) {
    const state = sampleSurferRide(t, [4, 5.1], -0.15);
    const prev = sampleSurferRide(t - dt, [4, 5.1], -0.15),
      next = sampleSurferRide(t + dt, [4, 5.1], -0.15);
    near((next.x - prev.x) / (2 * dt), state.velocity[0]);
    near((next.z - prev.z) / (2 * dt), state.velocity[1]);
    near(dot(state.heading, state.velocity), state.speed);
    assert.ok(state.speed > 0.095 && state.speed < 0.32);
    assert.ok(state.bank > 0 && state.bank < 0.16);
    const repeat = sampleSurferRide(t + RIDE.period, [4, 5.1], -0.15);
    for (const key of ["x", "z", "speed", "turnRate", "acceleration", "bank", "power", "crouch"]) near(repeat[key], state[key]);
    assert.ok(distance(repeat.heading, state.heading) < 1e-8);
  }
});

test("board frame follows world water gradients through all headings and banks without losing orthogonality", () => {
  for (let t = 0; t < RIDE.period; t += 0.17) {
    const state = sampleSurferRide(t);
    const global = sampleCoastWave(state.x, state.z, t),
      local = sampleRideShoulder(state.x, state.z, state);
    const wave = { dx: global.dx + local.dx, dz: global.dz + local.dz };
    const flat = surferBoardFrame(state.heading, wave),
      banked = surferBoardFrame(state.heading, wave, state.bank);
    for (const frame of [flat, banked]) {
      for (const axis of Object.values(frame)) near(Math.hypot(...axis), 1);
      near(dot(frame.nose, frame.up), 0);
      near(dot(frame.nose, frame.side), 0);
      near(dot(frame.up, frame.side), 0);
    }
    near(flat.nose[1], wave.dx * flat.nose[0] + wave.dz * flat.nose[2]);
    near(flat.up[0] / flat.up[1], -wave.dx);
    near(flat.up[2] / flat.up[1], -wave.dz);
  }
});

test("localized shoulder derivatives and closed foam history agree with the same ride", () => {
  const h = 0.00001;
  for (const t of [0, 3, 11, 23, RIDE.period]) {
    const ride = sampleSurferRide(t, [4, 5.1], -0.15);
    for (const offset of [
      [0, 0],
      [-0.4, 0.2],
      [1.2, -0.5],
    ]) {
      const x = ride.x + offset[0],
        z = ride.z + offset[1];
      const s = sampleRideShoulder(x, z, ride);
      near((sampleRideShoulder(x + h, z, ride).height - sampleRideShoulder(x - h, z, ride).height) / (2 * h), s.dx);
      near((sampleRideShoulder(x, z + h, ride).height - sampleRideShoulder(x, z - h, ride).height) / (2 * h), s.dz);
    }
    const trail = surferRideTrail(t, [4, 5.1], -0.15),
      repeat = surferRideTrail(t + RIDE.period, [4, 5.1], -0.15);
    trail.forEach((point, i) => {
      const past = sampleSurferRide(t - point.age, [4, 5.1], -0.15);
      near(point.x, past.x - past.heading[0] * 0.62);
      near(point.z, past.z - past.heading[1] * 0.62);
      near(point.x, repeat[i].x);
      near(point.z, repeat[i].z);
    });
  }
});

test("the rider's planted deck contacts and bone lengths remain fixed through the whole carve", () => {
  const manifest = JSON.parse(readFileSync(new URL("../assets/models/la-jolla/manifest.json", import.meta.url)));
  const [actor] = createCast(manifest.figures.filter((f) => f.id === "surf-ride"));
  let firstFeet;
  for (let t = 0; t <= RIDE.period; t += 0.1) {
    poseActor(actor, t);
    const h = actor.people[0],
      j = h.j;
    const feet = [h.parts.footL, h.parts.footR].map((p) => [...p.a, ...p.b, p.r]);
    if (!firstFeet) firstFeet = feet;
    feet.forEach((foot, i) => foot.forEach((value, j) => near(value, firstFeet[i][j], 1e-10)));
    for (const side of ["L", "R"]) {
      near(j["ankle" + side][1], 0.043 + BODY.ankle);
      near(distance(j["hip" + side], j["knee" + side]), BODY.thigh);
      near(distance(j["knee" + side], j["ankle" + side]), BODY.shin);
      near(distance(j["shoulder" + side], j["elbow" + side]), BODY.upperArm);
      near(distance(j["elbow" + side], j["hand" + side]), BODY.forearm);
    }
  }
});
