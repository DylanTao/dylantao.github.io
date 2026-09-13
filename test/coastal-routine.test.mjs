import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pacificClock, resolveRoutine, createExplorationState, formatMinute, chooseArrivalAvatar } from "../assets/js/home-scene/routine.mjs";

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
  for (let i = 0; i < config.weekday.length; i++) {
    const [minute, expected] = config.weekday[i];
    const date = at(`${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`);
    assert.equal(resolveRoutine(config, date).id, expected);
    assert.equal(resolveRoutine(config, date).minute, minute, "the displayed clock must not use an activity's preview time");
    if (i > 0) assert.equal(resolveRoutine(config, new Date(date - 60000)).id, config.weekday[i - 1][1]);
  }
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

test("weekends extend coding and sleep; breakfast continues until lunch", () => {
  for (const day of ["2026-09-12", "2026-09-13"]) {
    for (const [time, expected] of [
      ["03:59", "coding"],
      ["04:00", "sleep"],
      ["12:00", "sleep"],
      ["12:29", "sleep"],
      ["12:30", "breakfast"],
      ["13:59", "breakfast"],
      ["14:00", "lunch"],
    ]) {
      assert.equal(resolveRoutine(config, at(time, day)).id, expected);
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
    const date = at("21:17", `2026-09-${day}`);
    const a = resolveRoutine(config, date);
    assert.equal(a.minute, 1277);
    assert.deepEqual(a, resolveRoutine(config, date));
    drinks.add(a.prop);
  }
  assert.equal(drinks.size, 4);
});
