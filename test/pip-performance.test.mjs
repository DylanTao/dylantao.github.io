import test from "node:test";
import assert from "node:assert/strict";
import { createPipDirector, createPipFlight, samplePipFlight } from "../assets/js/companion/performance.mjs";
import { createPipMotion } from "../assets/js/companion/motion.mjs";

test("P notices before greeting, listens once, and returns to its task while the visitor stays", () => {
  const director = createPipDirector();
  let p = director.update(0.016, { near: true, pointer: [1, 0], task: [-0.4, -0.2] });
  assert.equal(p.phase, "notice");
  assert.equal(p.gesture, null);
  p = director.update(0.3, { near: true, pointer: [1, 0] });
  assert.equal(p.phase, "greet");
  assert.equal(p.gesture, "hello");
  assert.equal(p.greetings, 1);
  p = director.update(2.7, { near: true, pointer: [1, 0] });
  assert.equal(p.phase, "listen");
  assert.equal(p.gesture, "listen");
  for (let i = 0; i < 240; i++) p = director.update(0.25, { near: true, pointer: [1, 0], task: [-0.4, -0.2] });
  assert.equal(p.phase, "task");
  assert.equal(p.greetings, 1, "a stationary pointer must not summon repeated waves");
  assert.deepEqual(p.gaze, [-0.4, -0.2]);
  director.update(1.1, { near: false });
  director.update(0.016, { near: true });
  p = director.update(0.3, { near: true });
  assert.equal(p.greetings, 2, "a new encounter can happen after absence and cooldown");
});

test("travel, brief flybys, cooldown and system stillness cannot trigger an intrusive greeting", () => {
  const director = createPipDirector();
  assert.equal(director.update(2, { near: true, traveling: true }).phase, "task");
  assert.equal(director.update(0.05, { near: true }).phase, "notice");
  assert.equal(director.update(0.05, { near: false }).phase, "return");
  assert.equal(director.update(2, { near: false }).greetings, 0);
  director.update(0.05, { near: true });
  let p = director.update(0.3, { near: true });
  const time = p.time;
  p = director.update(3600, { still: true, near: true });
  assert.equal(p.time, time);
  assert.equal(p.greetings, 1);
  assert.deepEqual(p.gaze, [0, 0]);
  director.update(1.1, { near: false });
  for (let i = 0; i < 40; i++) p = director.update(0.25, { near: true });
  assert.equal(p.greetings, 1, "leaving and re-entering still respects the quiet interval");
});

test("P flights anticipate, ease away, round authored corners within clearance and settle exactly", () => {
  const flight = createPipFlight([
    [0, 0, 0],
    [0, 0, 3],
    [3, 0, 3],
  ]);
  const initial = samplePipFlight(flight, 0.2);
  assert.equal(initial.phase, "anticipate");
  assert.deepEqual(initial.position, [0, 0, 0]);
  assert.ok(initial.direction[2] > 0);
  let peakSpeed = 0;
  for (let i = 0; i <= 2000; i++) {
    const p = samplePipFlight(flight, (flight.duration * i) / 2000);
    peakSpeed = Math.max(peakSpeed, Math.hypot(...p.velocity));
    assert.ok(p.position.every(Number.isFinite));
    assert.ok(
      Math.min(Math.abs(p.position[0]), Math.abs(3 - p.position[2])) <= 0.12 + 1e-8,
      "a rounded bend must remain within the circulation envelope"
    );
    assert.ok(p.position[0] >= 0 && p.position[0] <= 3 && p.position[2] >= 0 && p.position[2] <= 3);
    assert.ok(p.lift >= 0 && p.lift < 0.01);
  }
  assert.ok(peakSpeed <= 1.601);
  assert.deepEqual(samplePipFlight(flight, flight.duration).position, [3, 0, 3]);
  assert.equal(samplePipFlight(flight, flight.duration).phase, "rest");
  assert.equal(samplePipFlight(flight, flight.duration).lift, 0);
});

test("pausing a wave resumes quietly without a phantom or repeated greeting", () => {
  const director = createPipDirector();
  director.update(0.016, { near: true });
  let p = director.update(0.4, { near: true });
  assert.equal(p.gesture, "hello");
  const cooldown = p.cooldown,
    seconds = p.time;
  p = director.update(60, { near: true, still: true });
  assert.equal(p.phase, "still");
  assert.equal(p.time, seconds);
  assert.equal(p.cooldown, cooldown);
  p = director.update(0.1, { near: true });
  assert.equal(p.phase, "task");
  assert.equal(p.gesture, null);
  assert.equal(p.greetings, 1);
});

test("flight and social phases follow active seconds even with four-second render intervals", () => {
  const flight = createPipFlight([
    [0, 2.6, 0],
    [0, 2.6, 0.16],
  ]);
  assert.equal(samplePipFlight(flight, 4).done, true);
  const director = createPipDirector();
  director.update(0.016, { near: true });
  const p = director.update(4, { near: true });
  assert.equal(p.phase, "listen");
  assert.equal(p.greetings, 1);
  assert.ok(p.phaseAge > 1);
  const motion = createPipMotion();
  motion.play("hello");
  assert.equal(motion.update(0.25, { elapsed: 4, autonomous: false }).gesture, "rest");
});

test("the eyes lead the neck, the shell follows later, and composed poses stay still", () => {
  const motion = createPipMotion();
  const p = motion.update(0.15, { gaze: [1, 0], autonomous: false });
  assert.ok(p.gaze[0] > p.head[1] / 0.35);
  assert.ok(p.head[1] / 0.35 > p.bodyYaw / 0.09);
  const still = motion.update(4, { still: true, elapsed: 4, gaze: [1, 1], flight: 0.5 });
  assert.equal(still.bodyYaw, 0);
  assert.deepEqual(still.gaze, [0, 0]);
  assert.deepEqual(still.head, [0, 0, 0]);
  assert.deepEqual(still.antennas, [0, 0]);
});
