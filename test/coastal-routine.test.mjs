import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pacificClock, resolveRoutine, createExplorationState, formatMinute, chooseArrivalAvatar } from "../assets/js/home-scene/routine.mjs";
import { trainingAt } from "../assets/js/home-scene/training.mjs";

const config = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
const at = (time, day = "2026-09-11") => new Date(`${day}T${time}:00-07:00`);

test("refresh chooses from every avatar and avoids immediately repeating the last arrival", () => {
  const ids = config.avatars.map((a) => a.id);
  for (const last of ids) {
    const choices = new Set([0, 0.25, 0.5, 0.75, 0.999].map((r) => chooseArrivalAvatar(ids, last, () => r)));
    assert.equal(choices.has(last), false);
    assert.equal(choices.size, ids.length - 1);
  }
  assert.equal(
    chooseArrivalAvatar(["lizard"], "lizard", () => 0),
    "lizard"
  );
});

test("weekday schedule changes exactly at each authored boundary", () => {
  // 2026-09-11 is a training day; its session ends before the onsen slot begins.
  const session = trainingAt(config.training, "2026-09-11", 1080);
  assert.ok(session.plan && session.endMinute < 1200);
  for (let i = 0; i < config.weekday.length; i++) {
    const [minute, expected] = config.weekday[i];
    const date = at(`${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`);
    assert.equal(resolveRoutine(config, date).id, expected);
    assert.equal(resolveRoutine(config, date).minute, minute, "the displayed clock must not use an activity's preview time");
    // The minute before a boundary is still the previous slot, except that a finished training
    // session hands over to the next activity early.
    if (i > 0)
      assert.equal(resolveRoutine(config, new Date(date - 60000)).id, config.weekday[i - 1][1] === "workout" ? expected : config.weekday[i - 1][1]);
  }
});

test("the gym slot follows the training program: rest days, session length, a visitor's request", () => {
  const rest = config.training.restActivity;
  // Sunday is always a rest day; Tuesday 2026-10-13 is one the week asked for.
  assert.equal(resolveRoutine(config, at("14:30", "2026-10-18")).id, rest);
  assert.equal(resolveRoutine(config, at("18:30", "2026-10-13")).id, rest);
  // A training day trains from 6 pm on workdays and 2 pm on Saturdays, until the session is done.
  const thursday = resolveRoutine(config, at("18:30", "2026-10-15"));
  assert.equal(thursday.id, "workout");
  assert.equal(thursday.training.plan.lifts[0].lift, "squat");
  const end = thursday.training.endMinute;
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  assert.equal(resolveRoutine(config, at(hhmm(end - 1), "2026-10-15")).id, "workout");
  assert.equal(resolveRoutine(config, at(hhmm(end), "2026-10-15")).id, "soak", "the onsen follows the last set");
  assert.equal(resolveRoutine(config, at("14:30", "2026-10-17")).id, "workout");
  assert.ok(resolveRoutine(config, at("14:30", "2026-10-17")).training.endMinute <= 960, "Saturday's session ends before the 4 pm close");
  // Asking for training on a rest day shows a session anyway; other activities carry no session.
  const asked = resolveRoutine(config, at("14:30", "2026-10-18"), { activity: "workout", minute: 1110 });
  assert.equal(asked.id, "workout");
  assert.ok(asked.training.state, "a requested session is running");
  assert.equal(resolveRoutine(config, at("12:30", "2026-10-15")).training, null);
});

test("night owl is coding at midnight and sleeping before late breakfast", () => {
  assert.equal(resolveRoutine(config, at("00:00")).id, "coding");
  assert.equal(resolveRoutine(config, at("02:59")).id, "coding");
  assert.equal(resolveRoutine(config, at("03:00")).id, "sleep");
  assert.equal(resolveRoutine(config, at("11:29")).id, "sleep");
  assert.equal(resolveRoutine(config, at("12:00")).id, "breakfast");
  assert.equal(formatMinute(0), "12:00 am");
  assert.equal(formatMinute(720), "12:00 pm");
});

test("weekends extend coding and sleep; the gym closes at 4 pm, so Saturday trains at 2", () => {
  // Saturday 2026-09-12 trains; Sunday 2026-09-13 rests.
  for (const [day, gym] of [
    ["2026-09-12", "workout"],
    ["2026-09-13", config.training.restActivity],
  ]) {
    for (const [time, expected] of [
      ["03:59", "coding"],
      ["04:00", "sleep"],
      ["12:00", "sleep"],
      ["12:29", "sleep"],
      ["12:30", "breakfast"],
      ["13:59", "breakfast"],
      ["14:00", gym],
      ["15:59", day === "2026-09-12" ? "soak" : gym],
      ["16:00", "soak"],
      ["16:30", "lunch"],
      ["17:00", "work"],
    ]) {
      assert.equal(resolveRoutine(config, at(time, day)).id, expected, `${day} ${time}`);
    }
  }
});

test("Pacific clock follows spring jump, repeated autumn hour, and local date", () => {
  assert.equal(pacificClock(new Date("2026-03-08T09:59:00Z")).minute, 119);
  assert.equal(pacificClock(new Date("2026-03-08T10:00:00Z")).minute, 180);
  assert.equal(pacificClock(new Date("2026-11-01T08:30:00Z")).minute, 90);
  assert.equal(pacificClock(new Date("2026-11-01T09:30:00Z")).minute, 90);
  const friday = pacificClock(new Date("2026-09-12T01:00:00Z"));
  assert.equal(friday.weekend, false);
  assert.equal(friday.dateKey, "2026-09-11");
});

test("exploration survives clock changes; Now clears both previews", () => {
  const state = createExplorationState();
  state.explore();
  assert.equal(state.following, false);
  assert.equal(state.preview, null);
  state.setTime(1000);
  assert.equal(resolveRoutine(config, at("03:00"), state.preview).id, "work");
  state.setActivity("soak", 1115);
  assert.equal(resolveRoutine(config, at("23:59"), state.preview).id, "soak");
  assert.equal(state.following, false);
  state.now();
  assert.equal(state.preview, null);
  assert.equal(state.following, true);
  // Fresh time on hidden-tab recovery, rather than an accumulated animation delta.
  assert.equal(resolveRoutine(config, at("04:01"), state.preview).id, "sleep");
});

test("evening drinks rotate reproducibly and selected times keep exact minutes", () => {
  const drinks = new Set();
  for (let day = 10; day < 14; day++) {
    const date = at("22:17", `2026-09-${day}`);
    const a = resolveRoutine(config, date);
    assert.equal(a.minute, 1337);
    assert.deepEqual(a, resolveRoutine(config, date));
    drinks.add(a.prop);
  }
  assert.equal(drinks.size, 4);
});
