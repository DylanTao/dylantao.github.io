import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BREAKFASTS,
  COFFEES,
  DESSERTS,
  DINNERS,
  DRINKS,
  EVENING,
  LUNCHES,
  courseFor,
  dayNumber,
  menuFor,
} from "../assets/js/home-scene/dining-menu.mjs";
import { BEATS, edgeAt, eveningPose, levelAt, mealPose, planMeal, remainingAt, stillTime, stageAt } from "../assets/js/home-scene/dining-motion.mjs";
import { COFFEE_TIMELINE, activityPose, coffeeTableClock } from "../assets/js/home-scene/activities.mjs";

const index = JSON.parse(fs.readFileSync(new URL("../assets/models/home/table-setting/index.json", import.meta.url), "utf8"));
const day = (n) => new Date(Date.UTC(2026, 9, 24 + n)).toISOString().slice(0, 10);

test("the menu rotates by Pacific date through every dish before repeating", () => {
  assert.equal(dayNumber("2026-10-24"), dayNumber("2026-10-23") + 1);
  assert.deepEqual(menuFor("2026-10-24"), menuFor("2026-10-24"));
  for (const [list, key, period] of [
    [DINNERS, "dinner", 7],
    [BREAKFASTS, "breakfast", 5],
    [LUNCHES, "lunch", 5],
    [DESSERTS, "dessert", 5],
    [COFFEES, "coffee", 4],
  ]) {
    const seen = new Set(Array.from({ length: period }, (_, i) => menuFor(day(i))[key].id));
    assert.equal(seen.size, list.length, `${key} covers its list in ${period} days`);
    for (let i = 1; i < period; i++) assert.notEqual(menuFor(day(i))[key].id, menuFor(day(i - 1))[key].id, `${key} changes day to day`);
  }
  // A day's dishes recur together only after 35 days.
  const signature = (d) => ["breakfast", "lunch", "dinner", "dessert"].map((k) => menuFor(d)[k].id).join();
  const first = signature(day(0));
  for (let i = 1; i < 35; i++) assert.notEqual(signature(day(i)), first);
  assert.equal(signature(day(35)), first);
});

test("every course and drink on the menu has its model, drink and vessel", () => {
  for (const dish of [...BREAKFASTS, ...LUNCHES, ...DINNERS, ...DESSERTS]) {
    const entry = index.dishes[dish.id];
    assert.ok(entry, `${dish.id} is modelled`);
    assert.ok(entry.bites.length >= 5, `${dish.id} has bites`);
    assert.equal(entry.lods.length, 2);
    for (const bite of entry.bites)
      assert.ok(bite.every(Number.isFinite) && bite[1] > 0 && Math.hypot(bite[0], bite[2]) < 0.16, `${dish.id} bite on its plate`);
  }
  for (const id of [...new Set([...LUNCHES.map((l) => l.drink), ...DINNERS.map((d) => d.drink), "orange"])]) {
    assert.ok(index.drinks[id], `${id} has a colour`);
    assert.ok(index.tableware.items[DRINKS[id].glass]?.profile, `${id} has its glass`);
  }
  for (const variants of Object.values(EVENING))
    for (const v of variants) {
      assert.ok(index.drinks[v.id], `${v.id} has a colour`);
      assert.ok(index.tableware.items[v.glass]?.profile, `${v.id} has its glass`);
      for (const g of index.drinks[v.id].garnish || []) assert.ok(index.tableware.items[g], `${g} garnish exists`);
    }
  const evening = menuFor("2026-10-24", "whiskey").evening;
  assert.ok(EVENING.whiskey.includes(evening), "the routine's kind chooses the evening drink");
  assert.equal(courseFor(menuFor("2026-10-24"), "work"), null);
  assert.equal(courseFor(menuFor("2026-10-24"), "dinner").meal, "dinner");
});

const layout = {
  surface: 0.795,
  plate: [-0.01, 0.55],
  dessert: [-0.07, 0.93],
  aside: [0.26, 0.86],
  glass: [-0.21, 0.75],
  fork: [0.18, 0.53],
  knife: [-0.185, 0.54],
  saucer: [0.23, 0.69],
  forkLift: 0.009,
  rim: 0.205,
  bites: {
    main: Array.from({ length: 10 }, (_, i) => [((i % 3) - 1) * 0.04, 0.02, (Math.floor(i / 3) - 1.5) * 0.035]),
    dessert: Array.from({ length: 6 }, () => [0, 0.03, 0]),
  },
};
const anchors = { mouth: [0, 1.32, 0.21] };
const finite = (v) => !v || v.every(Number.isFinite);

test("a meal's choreography stays on the table, eats in order and never loops", () => {
  for (const [meal, progress] of [
    ["dinner", 0],
    ["dinner", 0.3],
    ["dinner", 0.7],
    ["lunch", 0.5],
  ]) {
    const plan = planMeal({ meal, seed: 11, progress, bites: { main: 10, dessert: 6 }, knife: true });
    let previous = null,
      biteOrder = [];
    for (let t = 0; t < 420; t += 0.05) {
      const p = mealPose(plan, t, anchors, layout);
      for (const hand of Object.values(p.hands)) {
        if (!hand) continue;
        assert.ok(finite(hand.tip) && finite(hand.palm) && finite(hand.base) && finite(hand.dir), `${meal} ${t}`);
        // Nothing reaches through the table: a press into food at most, a palm on its surface.
        if (hand.tip) assert.ok(hand.tip[1] > layout.surface - 0.004, `${meal} tip above the table at ${t}`);
        if (hand.palm) assert.ok(Math.abs(hand.palm[1] - layout.surface) < 0.03, `${meal} palm on the table at ${t}`);
      }
      if (previous) {
        assert.ok(p.remaining.main <= previous.remaining.main && p.remaining.dessert <= previous.remaining.dessert, "pieces only leave");
      }
      if (p.onUtensil && biteOrder[biteOrder.length - 1] !== `${p.onUtensil.plate}:${p.onUtensil.index}`)
        biteOrder.push(`${p.onUtensil.plate}:${p.onUtensil.index}`);
      previous = p;
    }
    const mains = biteOrder.filter((b) => b.startsWith("main")).map((b) => Number(b.split(":")[1]));
    assert.deepEqual(
      mains,
      [...mains].sort((a, b) => a - b),
      `${meal} eats its pieces in order`
    );
    // No two consecutive bites take the same time: drawn beats, not a loop.
    const bites = plan.actions.filter((a) => a.type === "bite").map((a) => (a.end - a.start).toFixed(3));
    assert.ok(new Set(bites).size > bites.length * 0.8, `${meal} bites vary`);
    const durations = plan.actions.slice(0, 40).map((a) => (a.end - a.start).toFixed(2));
    for (let period = 1; period < 10; period++)
      assert.ok(
        durations.some((d, i) => i >= period && d !== durations[i - period]),
        `no period ${period}`
      );
  }
  assert.equal(stageAt("dinner", 0.7).stage, "dessert");
  assert.equal(stageAt("lunch", 0.95).stage, "linger");
});

test("a resting hand keeps 13 cm onto the table from its measured near edge", () => {
  // A round top whose near edge recedes at the sides, as the nook's does (seat frame).
  const edge = [-0.42, -0.3, -0.18, -0.06, 0.06, 0.18, 0.3, 0.42].map((x) => [x, 0.76 - Math.sqrt(0.25 - (x + 0.03) ** 2)]);
  assert.ok(Math.abs(edgeAt(edge, -0.24) - (0.76 - Math.sqrt(0.25 - 0.0441))) < 0.01);
  // With the plate near the diner, the resting palms move in from the edge; the rest stay put.
  const near = { ...layout, plate: [-0.01, 0.43], edge };
  const plan = planMeal({ meal: "lunch", seed: 3, progress: 0.5, bites: { main: 8, dessert: 0 } });
  let rests = 0;
  for (let t = 0; t < 240; t += 0.1) {
    const p = mealPose(plan, t, anchors, near);
    for (const hand of Object.values(p.hands)) {
      if (hand?.mode !== "rest" || (hand.reach ?? 1) < 1) continue;
      rests++;
      assert.ok(hand.palm[2] >= edgeAt(edge, hand.palm[0]) + 0.13 - 1e-9, `palm ${hand.palm} at ${t}`);
    }
  }
  assert.ok(rests > 0, "the free hand rests during lunch");
  // Without a measured edge the authored places stand.
  const free = mealPose(plan, 30, anchors, { ...layout, plate: [-0.01, 0.43] });
  const held = mealPose(plan, 30, anchors, near);
  for (const side of ["R", "L"]) if (free.hands[side]?.mode === "rest") assert.ok(held.hands[side].palm[2] >= free.hands[side].palm[2]);
});

test("a sip tips the glass to the lips and lowers the level; the still is the same every time", () => {
  const plan = planMeal({ meal: "dinner", seed: 3, progress: 0.2, bites: { main: 10, dessert: 6 } });
  const sip = plan.actions.find((a) => a.type === "sip");
  let at = sip.start,
    drinkStart = 0,
    drinkEnd = 0;
  for (const [beat, d] of sip.beats) {
    if (beat === "drink") [drinkStart, drinkEnd] = [at, at + d];
    at += d;
  }
  const before = levelAt(plan, drinkStart - 0.01),
    after = levelAt(plan, drinkEnd + 0.01);
  assert.ok(after < before - 0.05 && after > 0, "the level drops by a sip");
  const mid = mealPose(plan, (drinkStart + drinkEnd) / 2, anchors, layout);
  assert.equal(mid.glass.holder, "L");
  assert.ok(mid.glass.tilt > 0.3, "the glass tips");
  assert.ok(Math.hypot(...mid.hands.L.base.map((v, i) => v - anchors.mouth[i])) < 0.35, "near the lips");
  const still = stillTime(plan);
  assert.deepEqual(mealPose(plan, still, anchors, layout), mealPose(plan, still, anchors, layout));
  const atStill = mealPose(plan, still, anchors, layout);
  assert.ok(atStill.hands.R.tip[1] > layout.surface + 0.3, "the composed still holds the bite at the lips");
  assert.notEqual(planMeal({ meal: "dinner", seed: 4, progress: 0.2, bites: { main: 10, dessert: 6 } }).actions[1].start, plan.actions[1].start);
});

test("breakfast keeps the fresh coffee in hand by the sea, then sets it on its saucer and eats", () => {
  const prelude = COFFEE_TIMELINE.food - COFFEE_TIMELINE.table;
  const plan = planMeal({ meal: "breakfast", seed: 9, bites: { main: 6 }, vessel: "cup", sameHand: true, prelude });
  for (let t = 0; t < prelude - 6; t += 0.25) {
    const p = mealPose(plan, t, anchors, { ...layout, glass: layout.saucer, vesselLift: 0.012, rim: 0.097 });
    assert.equal(p.glass.holder, "R", `the cup is in hand at ${t}`);
    assert.equal(p.utensil.holder, "table");
  }
  const later = plan.actions.find((a) => a.type === "bite");
  assert.ok(later && later.start > prelude - 1, "the first bite comes after the coffee");
  assert.ok(
    plan.actions.some((a) => a.type === "sip" && a.sameHand),
    "coffee between bites puts the fork down first"
  );
  // The coffee walk happens once per visit; the seated breakfast keeps its own clock.
  assert.deepEqual(coffeeTableClock(10), { table: false, seconds: 0, cup: false });
  assert.equal(coffeeTableClock(COFFEE_TIMELINE.table + 5).seconds, 5);
  assert.equal(coffeeTableClock(COFFEE_TIMELINE.foodEnd + 5).table, false);
  assert.ok(coffeeTableClock(COFFEE_TIMELINE.back + 5).after);
});

test("the coffee story makes coffee once, then breakfast, then returns the cup", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
  const room = manifest.rooms.find((r) => r.id === "kitchen");
  const phases = [];
  for (let t = 0; t < COFFEE_TIMELINE.back + 30; t += 0.5) {
    const p = activityPose("coffee", t, manifest.equipment, room);
    if (phases[phases.length - 1] !== p.phase) phases.push(p.phase);
  }
  assert.deepEqual(phases.filter((p) => p === "grind").length, 1, "one grind per visit");
  for (const phase of ["grind", "brew", "pick up", "carry", "coffee by the ocean", "breakfast", "return cup", "set down", "at the table"])
    assert.ok(phases.includes(phase), phase);
});

test("the evening glass rests in the hand and rises to the lips", () => {
  const plan = planMeal({ meal: "evening", seed: 5, vessel: "glass" });
  const sip = plan.actions.find((a) => a.type === "sip");
  let at = sip.start;
  for (const [beat, d] of sip.beats) {
    if (beat === "drink") break;
    at += d;
  }
  const knee = [0.12, 0.62, 0.3];
  const rest = eveningPose(plan, plan.actions[0].start + 0.5, anchors, { knee, rim: 0.087 });
  assert.deepEqual(rest.hands.R.base, knee);
  const drinking = eveningPose(plan, at + 0.6, anchors, { knee, rim: 0.087 });
  assert.ok(drinking.hands.R.tilt > 0.3 && drinking.hands.R.base[1] > 1.0);
  assert.ok(remainingAt(plan, 100).main === 0 && BEATS.drink[0] > 1);
});
