import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  platesFor,
  plateLoad,
  roundWeight,
  restDays,
  isTrainingDay,
  programDay,
  sessionPlan,
  sessionTimeline,
  sessionState,
  trainingAt,
  LIFT_STATION,
} from "../assets/js/home-scene/training.mjs";

const config = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
const training = config.training;
const DAY = 86400000;
const keyOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const days = (from, count) => Array.from({ length: count }, (_, i) => keyOf(Date.parse(`${from}T00:00:00Z`) + i * DAY));

test("plates load a 45 lb bar per side, heaviest first, and weights round to 5 lb", () => {
  assert.deepEqual(platesFor(45), []);
  assert.deepEqual(platesFor(155), [45, 10]);
  assert.deepEqual(platesFor(235), [45, 45, 5]);
  assert.deepEqual(platesFor(315), [45, 45, 45]);
  assert.deepEqual(platesFor(225), [45, 45]);
  assert.equal(roundWeight(152.75), 155);
  assert.equal(roundWeight(20), 45, "never lighter than the empty bar");
});

test("the platform loads coloured bumpers and the rack and bench load black plates", () => {
  const side = (weight, station) => plateLoad(weight, station).map((p) => `${p.lb}${p.kind === "bumper" ? "B" : ""}`);
  assert.deepEqual(side(295, "platform"), ["55B", "55B", "10B", "5"], "bumpers first, black change plates for the rest");
  assert.deepEqual(side(155, "platform"), ["55B"]);
  assert.deepEqual(side(235, "rack"), ["45", "45", "5"]);
  assert.deepEqual(side(220, "bench"), ["45", "35", "5", "2.5"]);
  for (const [weight, station] of [
    [315, "platform"],
    [300, "rack"],
    [185, "bench"],
  ])
    assert.equal(45 + 2 * plateLoad(weight, station).reduce((sum, p) => sum + p.lb, 0), weight, `${weight} adds up`);
});

test("every week has Sunday off and four to six sessions, with rest days never back to back", () => {
  for (let week = 0; week < 40; week++) {
    const monday = keyOf(Date.parse("2026-10-12T00:00:00Z") + week * 7 * DAY);
    const rests = restDays(monday, training);
    assert.ok(rests.has(0), "Sunday rests");
    const sessions = 7 - rests.size;
    assert.ok(sessions >= 4 && sessions <= 6, `${monday}: ${sessions} sessions`);
    for (const day of rests) if (day > 0) assert.ok(!rests.has(day + 1) && !rests.has(day - 1), `${monday}: rest days ${[...rests]} adjoin`);
  }
  assert.equal(isTrainingDay(training.anchor.date, training), true, "the logged day is a training day");
});

test("the program advances one template day per session and alternates templates by cycle", () => {
  let previous = programDay(training.anchor.date, training);
  assert.deepEqual([previous.template, previous.day, previous.cycle], [training.anchor.template, training.anchor.day, training.anchor.cycle]);
  let cycles = 0;
  for (const key of days("2026-10-16", 60)) {
    const position = programDay(key, training);
    const before = keyOf(Date.parse(`${key}T00:00:00Z`) - DAY);
    const steps = isTrainingDay(before, training) ? 1 : 0;
    const expectedDay = (previous.day + steps) % 6;
    assert.equal(position.day, expectedDay, key);
    if (steps && previous.day === 5) {
      cycles++;
      assert.notEqual(position.template, previous.template, `${key}: a new cycle switches template`);
      assert.equal(position.cycle, previous.cycle + 1);
    } else assert.equal(position.template, previous.template, key);
    previous = position;
  }
  assert.ok(cycles >= 6, "two months hold several cycles");
});

test("today's plan follows the training maxes and the nSuns pyramid", () => {
  const plan = sessionPlan(programDay(training.anchor.date, training), training);
  const [t1, t2] = plan.lifts;
  assert.equal(t1.lift, "squat");
  assert.deepEqual(
    t1.sets.map((s) => s.weight),
    [235, 270, 300, 285, 270, 250, 235, 220]
  );
  assert.equal(t1.sets[2].amrap, true, "the 95% single is a plus set");
  assert.equal(t2.lift, "sumo-deadlift");
  assert.equal(t2.trainingMax, training.trainingMax.deadlift, "sumo works off the deadlift max");
  // Supersets pair opposite or non-competing groups.
  for (const template of Object.values(training.templates))
    for (const day of template.days)
      for (const entry of day.lifts) {
        if (["bench", "ohp", "incline-bench", "close-grip-bench"].includes(entry.lift))
          assert.ok(["pullup", "curl"].includes(entry.superset), `${entry.lift} + ${entry.superset}`);
        if (entry.lift === "deadlift") assert.equal(entry.superset, "dip");
      }
});

test("a session is a gapless timeline that ends before the gym closes", () => {
  for (const key of days("2026-10-12", 42)) {
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    const info = trainingAt(training, key, weekday === 6 ? 840 : 1080);
    if (!info.plan) {
      assert.ok(weekday === 0 || !isTrainingDay(key, training), `${key} has no session`);
      continue;
    }
    const { segments, duration } = info.timeline;
    segments.forEach((s, i) => {
      assert.ok(s.end > s.start, `${key} ${s.kind} has length`);
      if (i) assert.ok(Math.abs(s.start - segments[i - 1].end) < 1e-9, `${key} gap before ${s.kind}`);
    });
    assert.ok(info.endMinute <= info.window[1], `${key} ends at ${info.endMinute}, after closing ${info.window[1]}`);
    assert.ok(duration / 60 > 60, `${key} is a real session (${(duration / 60).toFixed(0)} min)`);
    // Every working set appears once, each followed by its superset when the template names one.
    for (const lift of info.plan.lifts) {
      const sets = segments.filter((s) => s.kind === "set" && !s.warmup && s.lift === lift.lift);
      assert.equal(sets.length, lift.sets.length, `${key} ${lift.lift} sets`);
      for (const set of sets) {
        const after = segments.slice(segments.indexOf(set) + 1, segments.indexOf(set) + 5);
        assert.equal(after[0].kind, "rerack");
        if (lift.superset)
          assert.ok(
            after.some((s) => s.kind === "superset" && s.lift === lift.superset),
            `${key} ${lift.lift} superset`
          );
      }
      assert.ok(
        segments.some((s) => s.kind === "load" && s.strip && s.lift === lift.lift),
        `${key} strips the ${lift.lift} bar`
      );
    }
    assert.equal(segments.at(-2).kind, "board", "the session ends logging on the board");
    for (const s of segments) if (s.station) assert.equal(s.station, LIFT_STATION[s.lift]);
  }
});

test("session state counts finished working sets for the board", () => {
  const info = trainingAt(training, training.anchor.date, 1080);
  const sets = info.timeline.segments.filter((s) => s.kind === "set" && !s.warmup);
  const third = sets[2];
  const state = sessionState(info.timeline, third.start + 1);
  assert.equal(state.segment, third);
  assert.equal(state.done[third.lift], 2);
  assert.equal(sessionState(info.timeline, 1e9).segment.kind, "leave", "past the end holds the last segment");
});

test("rest days have no session unless a visitor asks for one", () => {
  const sunday = "2026-10-18";
  assert.equal(trainingAt(training, sunday, 840).plan, null);
  const forced = trainingAt(training, sunday, 1110, 0, { force: true });
  assert.ok(forced.plan && forced.state, "a requested session runs on a rest day");
  const evening = trainingAt(training, training.anchor.date, 1300, 0, { force: true });
  assert.equal(evening.minute, evening.window[0] + 30, "a request outside the hours shows the session half an hour in");
  assert.equal(trainingAt(training, training.anchor.date, 1300).state, null, "no state outside the session without a request");
});
