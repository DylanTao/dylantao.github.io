import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { trainingAt, sessionState, LIFT_STATION } from "../assets/js/home-scene/training.mjs";
import { sessionPose, gymLayout, planRoute } from "../assets/js/home-scene/gym-session.mjs";

const config = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
const gym = config.equipment.gym;
const layout = gymLayout(gym);
// A squat day, a bench and press day with curls, a Saturday deadlift day.
const sessions = [
  ["2026-10-15", 1080],
  ["2026-10-16", 1080],
  ["2026-10-17", 840],
];
const each = (callback, step = 0.25) => {
  for (const [day, minute] of sessions) {
    const info = trainingAt(config.training, day, minute);
    for (let s = 0; s < info.timeline.duration; s += step) {
      const state = sessionState(info.timeline, s);
      callback(sessionPose({ ...info, state }, gym), state, day, s);
    }
  }
};
const deep = (p, [x0, x1, z0, z1]) => p[0] > x0 + 0.05 && p[0] < x1 - 0.05 && p[2] > z0 + 0.05 && p[2] < z1 - 0.05;
// Staged entries: off the platform behind its bar, out of the cage after racking, onto the bench.
const staged = (pose) => /step out|walk to|back to the bar|to the bar|walk to rest|then on/.test(pose.phase);

test("walks take routes around the rack, the bars, the bench and the dip frame at walking pace", () => {
  let previous = null,
    fastest = 0;
  each((pose, state, day, s) => {
    assert.ok(pose.position.every(Number.isFinite) && Number.isFinite(pose.facing), `${day} ${s}`);
    if (previous && previous.day === day)
      fastest = Math.max(fastest, Math.hypot(pose.position[0] - previous.position[0], pose.position[2] - previous.position[2]) / 0.25);
    previous = { day, position: pose.position };
    if (pose.clip !== "walk") return;
    layout.obstacles.forEach((o, i) => {
      // Only the platform (2) and the cage (0) are entered, and only by their staged legs.
      if (deep(pose.position, o)) assert.ok((i === 2 || i === 0) && staged(pose), `${day} ${s}s ${pose.phase} walks through obstacle ${i}`);
    });
  });
  assert.ok(fastest < 1.6, `fastest pace ${fastest.toFixed(2)} m/s`);
});

test("routes reach stations inside footprints only through their approaches", () => {
  const route = planRoute(layout, layout.spots.rest.at, layout.spots.benchMount.at);
  assert.deepEqual(route.at(-2), layout.approaches.find((a) => a.at === layout.spots.benchMount.at).via);
  const toBar = planRoute(layout, layout.spots.benchMount.at, layout.spots.platform.at);
  // The leg onto the platform comes from behind its bar, never across it.
  assert.ok(toBar.at(-2)[2] > gym.platform.bar[2], "approach the deadlift from behind the bar");
});

test("lifts, supersets and rests face the room camera except the bench and the board", () => {
  const room = config.rooms.find((r) => r.id === "gym");
  const camera = [
    room.target[0] + Math.sin(room.camera.yaw) * room.camera.radius,
    0,
    room.target[2] + Math.cos(room.camera.yaw) * room.camera.radius,
  ];
  const seen = new Set();
  each((pose, state) => {
    const kind = state.segment.kind;
    // Repetitions (sets and supersets) and standing rests; not the walks, mounts or the dumbbell pick-up.
    if (!["set", "superset", "rest"].includes(kind) || pose.clip === "walk") return;
    if (kind !== "rest" && pose.rep == null) return;
    const lift = pose.lift?.name || "rest";
    if (LIFT_STATION[lift] === "bench" || lift === "board") return;
    const dx = camera[0] - pose.position[0],
      dz = camera[2] - pose.position[2];
    const front = (Math.sin(pose.facing) * dx + Math.cos(pose.facing) * dz) / Math.hypot(dx, dz);
    assert.ok(front > 0.25, `${lift} (${pose.phase}) shows its front, got ${front.toFixed(2)}`);
    seen.add(lift);
  }, 1);
  for (const lift of ["squat", "sumo-deadlift", "ohp", "deadlift", "front-squat", "pullup", "dip", "curl", "rest"])
    assert.ok(seen.has(lift), `saw ${lift}`);
});

test("the working bar is in the hands for every set and back on its rest between them", () => {
  each((pose, state) => {
    const segment = state.segment;
    if (segment.kind === "set") {
      const station = LIFT_STATION[segment.lift];
      assert.equal(pose.bars[station].held, true, `${segment.lift} set holds the ${station} bar`);
      assert.equal(pose.bars[station].weight, segment.weight, `${segment.lift} bar carries ${segment.weight} lb`);
    }
    if (segment.kind === "rest" || segment.kind === "superset") for (const bar of Object.values(pose.bars)) assert.equal(bar.held, false);
    if (pose.dumbbells === "hands") assert.equal(segment.lift, "curl");
  }, 0.5);
});

test("the bench back rises for incline presses only", () => {
  const info = trainingAt(config.training, "2026-10-19", 1080);
  assert.ok(info.plan.lifts.some((l) => l.lift === "incline-bench"));
  for (const segment of info.timeline.segments) {
    if (segment.kind !== "set") continue;
    const pose = sessionPose({ ...info, state: sessionState(info.timeline, segment.start + 0.5) }, gym);
    assert.equal(pose.incline, segment.lift === "incline-bench" ? 1 : 0, `${segment.lift} incline`);
  }
});
