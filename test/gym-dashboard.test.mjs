import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { trainingAt, sessionState } from "../assets/js/home-scene/training.mjs";
import { trainingDashboardModel, trainingDashboardKey, trainingWeight, drawTrainingScreen } from "../assets/js/home-scene/gym-dashboard.mjs";

const training = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url))).training;
test("recorded cycles and history never advance with the house performance", () => {
  const original = JSON.stringify(training),
    info = trainingAt(training, training.anchor.date, 1110, 0, { force: true });
  const before = trainingDashboardModel(training, info);
  const after = trainingDashboardModel(training, { ...info, state: null, minute: info.endMinute });
  assert.equal(before.cycles.at(-1).sets, 85);
  assert.equal(after.cycles.at(-1).sets, 85);
  assert.equal(after.completed, after.total);
  assert.equal(after.phase, "Session complete");
  assert.deepEqual(after.maxes, before.maxes);
  assert.equal(JSON.stringify(training), original);
});
test("completion comes from finished working sets and active set indices", () => {
  const info = trainingAt(training, training.anchor.date, 1110, 0, { force: true });
  const segment = info.timeline.segments.find((s) => s.kind === "set" && !s.warmup && s.set === 2);
  const state = sessionState(info.timeline, segment.start + 0.2);
  const model = trainingDashboardModel(training, { ...info, state });
  assert.equal(model.completed, 2);
  assert.deepEqual(model.current, { lift: segment.lift, set: 2 });
  assert.equal(model.phase, "Working set");
  const next = trainingDashboardModel(training, { ...info, state: { ...state, seconds: state.seconds + 0.1, progress: 0.5 } });
  assert.equal(trainingDashboardKey(next), trainingDashboardKey(model), "per-frame progress cannot cause a canvas upload");
});
test("lb/kg conversion is presentation only and every Program set comes from the authored scheme", () => {
  assert.equal(trainingWeight(235, "kg"), "106.6");
  for (const template of Object.keys(training.templates))
    for (let day = 0; day < 6; day++) {
      const lb = trainingDashboardModel(training, null, { template, day, unit: "lb" });
      const kg = trainingDashboardModel(training, null, { template, day, unit: "kg" });
      assert.deepEqual(kg.programPlan, lb.programPlan);
      assert.equal(lb.programPlan.lifts.length, 2);
      for (const lift of lb.programPlan.lifts) assert.ok(lift.sets.every((s) => s.weight >= 45 && s.weight % 5 === 0));
    }
});
test("rest days, clipped completion and invalid display choices remain truthful", () => {
  const rest = trainingDashboardModel(training, trainingAt(training, "2026-11-01", 720), { unit: "bogus", view: "bogus", day: -3, lift: "bogus" });
  assert.equal(rest.phase, "Rest day");
  assert.equal(rest.completed, 0);
  assert.equal(rest.unit, "lb");
  assert.equal(rest.day, 0);
  const info = trainingAt(training, training.anchor.date, 1110, 0, { force: true });
  info.state.done[info.plan.lifts[0].lift] = 999;
  assert.ok(trainingDashboardModel(training, info).completed <= info.plan.lifts.reduce((n, l) => n + l.sets.length, 0));
});
test("the 2x digital face draws each view without mutating its data", () => {
  const calls = [],
    g = new Proxy(
      { canvas: { width: 2048, height: 1392 } },
      {
        get(target, key) {
          if (key in target) return target[key];
          return (...args) => calls.push([key, ...args]);
        },
      }
    );
  for (const view of ["today", "progress", "program"]) {
    const model = trainingDashboardModel(training, null, { view }),
      before = JSON.stringify(model);
    drawTrainingScreen(g, model);
    assert.equal(JSON.stringify(model), before);
  }
  assert.ok(calls.some(([fn, a, b]) => fn === "scale" && a === 2 && b === 2));
  assert.ok(calls.some(([fn, text]) => fn === "fillText" && text === "RECORDED TRAINING MAX"));
});
