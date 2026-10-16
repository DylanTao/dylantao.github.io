import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { coastalDaylight } from "../assets/js/home-scene/daylight.mjs";
import { createCurtainRig } from "../assets/js/home-scene/curtain-rig.mjs";
import { resolveRoutine } from "../assets/js/home-scene/routine.mjs";
import { createCoastWind } from "../assets/js/home-scene/wind-field.mjs";
import {
  CURTAIN_DRAW,
  CURTAIN_VIEW_OPEN,
  CURTAIN_VIEW_PANELS,
  createCurtainCloth,
  createFacadeCurtains,
  curtainGlare,
  curtainSchedule,
  facadeCurtainPanels,
} from "../assets/js/home-scene/curtain-cloth.mjs";

const config = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
const DAY = "2026-10-15"; // a Thursday
const STEP = 1 / 60;
// The routine, the light and the schedule at a Pacific minute of the test day.
function at(minute, overrides = {}) {
  const routine = resolveRoutine(config, new Date(`${DAY}T12:00:00-07:00`), { minute });
  const daylight = coastalDaylight(DAY, minute);
  return { routine, daylight, plan: curtainSchedule({ activity: routine.id, room: routine.room, daylight, ...overrides }) };
}
// The controller's door rule (syncFacadeDoors): open by day while Sirui is up.
const doorsOpen = ({ routine, daylight }) => daylight.daylight > 0.3 && routine.id !== "sleep";

test("the curtains are open by day, partly drawn against the low western sun and closed at night", () => {
  // 02:00, coding upstairs with the house lit: every panel drawn closed.
  const night = at(120);
  assert.equal(night.plan.state, "night");
  assert.deepEqual(Object.values(night.plan.fractions), [0, 0, 0, 0]);
  // 09:00, asleep: still closed, though the sun is up.
  const asleep = at(540);
  assert.equal(asleep.routine.id, "sleep");
  assert.ok(asleep.daylight.daylight > 0.3);
  assert.equal(asleep.plan.state, "asleep");
  assert.deepEqual(Object.values(asleep.plan.fractions), [0, 0, 0, 0]);
  // 12:30, reading: the sun stands high in the south, so the sea stays in full view.
  const noon = at(750);
  assert.equal(noon.plan.state, "day");
  assert.deepEqual(Object.values(noon.plan.fractions), [1, 1, 1, 1]);
  // 16:45, the low sun stands out to sea: each panel draws part way, the sheltered panels over fixed
  // glass deeper than the doorway panels, which leaves the breeze its way in and gaps for the sun.
  const lowSun = at(16 * 60 + 45);
  assert.equal(lowSun.plan.state, "low sun");
  assert.ok(lowSun.plan.glare > 0.8, `glare ${lowSun.plan.glare}`);
  const f = lowSun.plan.fractions;
  for (const id of Object.keys(CURTAIN_DRAW)) assert.ok(f[id] > 0 && f[id] < 1, `${id} ${f[id]}`);
  assert.ok(f["kitchen-north"] < f["kitchen-south"] && f["lounge-south"] < f["lounge-north"], JSON.stringify(f));
  // 20:45, dinner in the kitchen after dark (after training and the onsen): closed, except the panel
  // across the kitchen camera's view.
  const dinner = at(20 * 60 + 45);
  assert.equal(dinner.routine.room, "kitchen");
  assert.equal(dinner.plan.state, "night");
  assert.deepEqual(dinner.plan.fractions, { "kitchen-south": 1, "kitchen-north": 0, "lounge-south": 0, "lounge-north": 0 });
  // 22:00, watching the Pacific from the lounge: the lounge's view panel stays open.
  const lounge = at(22 * 60);
  assert.equal(lounge.routine.room, "lounge");
  assert.deepEqual(lounge.plan.fractions, { "kitchen-south": 0, "kitchen-north": 0, "lounge-south": 0, "lounge-north": 1 });
  // By day an occupied or visited room's view panel never draws across its camera's sightline; its
  // neighbour still draws. At night only Sirui's own room keeps its view.
  const busy = at(16 * 60 + 45, { room: "lounge" });
  assert.ok(busy.plan.fractions[CURTAIN_VIEW_PANELS.lounge] >= CURTAIN_VIEW_OPEN);
  const visited = at(16 * 60 + 45, { visit: "kitchen" });
  assert.ok(visited.plan.fractions[CURTAIN_VIEW_PANELS.kitchen] >= CURTAIN_VIEW_OPEN);
  assert.ok(visited.plan.fractions["kitchen-north"] < 0.5, "the neighbouring panel stays drawn");
  assert.equal(at(22 * 60, { visit: "kitchen" }).plan.fractions[CURTAIN_VIEW_PANELS.kitchen], 0);
});

test("glare needs a low sun standing out to sea, and the schedule moves in small steps", () => {
  // At most 0.1 of a panel per minute, even while the glare falls away at sunset.
  const morning = coastalDaylight(DAY, 10 * 60);
  assert.equal(curtainGlare(morning), 0, "the morning sun is behind the cliff");
  assert.equal(curtainGlare(coastalDaylight(DAY, 13 * 60)), 0, "the midday sun is too high");
  assert.equal(curtainGlare(null), 0);
  // A sun on the western horizon, then just under it.
  const sunset = { altitude: 1, direction: [0, 0.02, -1] },
    below = { altitude: -2, direction: [0, -0.03, -1] },
    south = { altitude: 15, direction: [-1, 0.26, -0.05] };
  assert.ok(curtainGlare(sunset) > 0.3);
  assert.equal(curtainGlare(below), 0);
  assert.equal(curtainGlare(south), 0, "a sun along the front does not shine in");
  let previous = null;
  for (let minute = 0; minute < 1440; minute++) {
    const { plan } = at(minute);
    for (const value of Object.values(plan.fractions)) assert.ok(Math.abs(value * 20 - Math.round(value * 20)) < 1e-9, "quantized to 0.05");
    if (previous && plan.state === previous.state && plan.state === "low sun")
      for (const id of Object.keys(plan.fractions)) assert.ok(Math.abs(plan.fractions[id] - previous.fractions[id]) <= 0.1 + 1e-9);
    previous = plan;
  }
});

test("the curtains change with the doors: open with them by day, drawn when they shut", () => {
  let checked = 0;
  for (let minute = 0; minute < 1440; minute += 5) {
    const view = at(minute);
    const open = view.plan.state === "day" || view.plan.state === "low sun";
    assert.equal(open, doorsOpen(view), `minute ${minute}: ${view.plan.state} with the doors ${doorsOpen(view) ? "open" : "shut"}`);
    checked++;
  }
  assert.equal(checked, 288);
});

// The largest horizontal departure of a panel's hem from its rail line, over a run.
function hemSwing(cloth, id) {
  const panel = cloth.panel(id),
    p = panel.positions,
    hem = panel.count - panel.columns;
  let worst = 0;
  for (let i = hem; i < panel.count; i++) worst = Math.max(worst, Math.abs(p[3 * i + 2] - panel.origin[2]));
  return worst;
}

test("in the afternoon breeze a doorway panel billows, a panel behind glass sways gently, and shut doors still them", () => {
  const coast = createCoastWind({ minute: 15 * 60 + 30, doors: 1 });
  const sim = createFacadeCurtains({ seed: 7, draft: { coast } });
  assert.equal(sim.draft.evidence().coast, true);
  sim.draft.setDoorOpen("kitchen", 1);
  sim.draft.setDoorOpen("lounge", 1);
  // The kitchen's south panel half drawn in front of the open doorway; its north panel gathered over
  // the mullion and the fixed glass.
  sim.cloth.setOpenFraction("kitchen-south", 0.5, { immediate: true });
  sim.cloth.setOpenFraction("kitchen-north", 1, { immediate: true });
  let t = 0,
    doorway = 0,
    sheltered = 0,
    awake = 0,
    peakJet = 0;
  for (let f = 0; f < 20 * 60; f++) {
    t += STEP;
    sim.update(STEP, null, t);
    if (f > 5 * 60) {
      doorway = Math.max(doorway, hemSwing(sim.cloth, "kitchen-south"));
      sheltered = Math.max(sheltered, hemSwing(sim.cloth, "kitchen-north"));
      if (!sim.cloth.evidence().panels.find((p) => p.id === "kitchen-north").sleeping) awake++;
      peakJet = Math.max(peakJet, sim.draft.evidence().doors[0].jetMetersPerSecond);
    }
  }
  assert.ok(peakJet > 0.8 && peakJet < 3.5, `doorway jet ${peakJet} m/s from a ${coast.state.meanSpeed.toFixed(1)} m/s breeze`);
  assert.ok(doorway > 0.12, `the doorway panel billows ${doorway} m`);
  assert.ok(sheltered < 0.5 * doorway, `the sheltered panel sways ${sheltered} m vs ${doorway} m`);
  assert.ok(awake > 60, "the indoor air keeps the sheltered panel moving gently");
  assert.ok(sim.cloth.evidence().maxConstraintError < 0.15);
  // Dusk: the doors shut, the house's air falls under the sleep threshold, and once a billowing
  // panel has swung to rest (about 20 s) the solver stops.
  sim.draft.setDoorOpen("kitchen", 0);
  sim.draft.setDoorOpen("lounge", 0);
  coast.update({ doors: 0 });
  for (let f = 0; f < 30 * 60; f++) {
    t += STEP;
    sim.update(STEP, null, t);
  }
  assert.ok(sim.cloth.evidence().sleeping, `asleep: ${sim.cloth.evidence().panels.map((p) => `${p.id} ${p.sleeping}`)}`);
  const revision = sim.cloth.revision;
  for (let f = 0; f < 60; f++) {
    t += STEP;
    sim.update(STEP, null, t);
  }
  assert.equal(sim.cloth.revision, revision, "a sleeping cloth changes nothing to upload");
});

test("a breeze off the land feeds no doorway jet, even with the door open", () => {
  const coast = createCoastWind({ minute: 3 * 60, doors: 1 });
  assert.ok(coast.state.direction[1] < -0.5, "the night breeze blows out to sea");
  const sim = createFacadeCurtains({ seed: 3, draft: { coast } });
  sim.draft.setDoorOpen("kitchen", 1);
  let t = 0,
    jet = 0;
  for (let f = 0; f < 600; f++) {
    t += STEP;
    sim.update(STEP, null, t);
    jet = Math.max(jet, sim.draft.evidence().doors[0].jetMetersPerSecond);
  }
  assert.ok(jet < 0.01, `jet ${jet} m/s`);
});

test("the cloth samples the wind at the scene's own clock and composes settled stills", () => {
  const times = [];
  const cloth = createCurtainCloth({
    panels: facadeCurtainPanels(),
    wind: (x, y, z, t, out) => {
      times.push(t);
      out[0] = out[1] = 0;
      out[2] = 0.5;
      return out;
    },
  });
  cloth.update(STEP, 100);
  assert.ok(times.length > 0 && times.every((t) => Math.abs(t - 100) < 1e-9), "one step, at the scene's time");
  times.length = 0;
  cloth.update(2 * STEP, 250);
  assert.ok(times.some((t) => Math.abs(t - 250) < 1e-9) && times.some((t) => Math.abs(t - (250 - STEP)) < 1e-9));
  assert.ok(
    times.every((t) => t > 249.9 && t <= 250 + 1e-9),
    "after a gap the clock rejoins the scene"
  );
  // A composed still: the target drape at once, settled and asleep.
  cloth.setOpenFraction("lounge-south", 0.4, { compose: true });
  const row = cloth.evidence().panels.find((p) => p.id === "lounge-south");
  assert.equal(row.openFraction, 0.4);
  assert.ok(row.sleeping && row.kineticEnergy === 0);
  const view = cloth.panel("lounge-south");
  assert.ok(Math.abs(row.gatheredWidth - (0.6 * view.closedWidth + 0.4 * view.stackWidth)) < 1e-9);
});

test("a coast-driven frame allocates no arrays", () => {
  const coast = createCoastWind({ minute: 15 * 60, doors: 1 });
  const sim = createFacadeCurtains({ seed: 4, draft: { coast } });
  sim.draft.setDoorOpen("kitchen", 1);
  let t = 0;
  for (let f = 0; f < 30; f++) sim.update(STEP, null, (t += STEP));
  const names = ["Array", "Float64Array", "Float32Array", "Int32Array", "Uint32Array", "Uint16Array", "Uint8Array"];
  const originals = Object.fromEntries(names.map((name) => [name, globalThis[name]]));
  let constructed = 0;
  for (const name of names)
    globalThis[name] = new Proxy(originals[name], {
      construct(target, args, newTarget) {
        constructed++;
        return Reflect.construct(target, args, newTarget);
      },
      apply(target, self, args) {
        constructed++;
        return Reflect.apply(target, self, args);
      },
    });
  try {
    for (let f = 0; f < 120; f++) sim.update(STEP, null, (t += STEP));
  } finally {
    Object.assign(globalThis, originals);
  }
  assert.equal(constructed, 0);
});

test("the scene's rig steps only the panels a camera can see, follows the doors and the schedule, and composes stills", () => {
  const scene = new THREE.Scene(),
    coast = createCoastWind({ minute: 16 * 60 + 45, doors: 1 }),
    view = at(16 * 60 + 45, { visit: "kitchen" }),
    bound = [];
  const rig = createCurtainRig({ scene, coast, plan: { ...view, visit: "kitchen" }, bindMaterial: (m) => bound.push(m) });
  assert.equal(scene.getObjectByName("Facade curtains"), rig.group);
  assert.equal(rig.group.children.length, 4);
  assert.equal(bound.length, 1, "the light field and installations bind the sheer once");
  // The kitchen camera of the manifest, looking in through the door opening.
  const camera = new THREE.PerspectiveCamera(38, 545 / 462, 0.05, 300);
  camera.position.set(-0.97, 3.1, -6.3);
  camera.lookAt(-3.18, 1.03, -1.85);
  const doors = [
    { id: "kitchen", offset: -2.55, slideX: -2.55 },
    { id: "lounge", offset: 0, slideX: 2 },
  ];
  const frame = (moving, overrides = {}) =>
    rig.step({
      delta: STEP,
      moving,
      reduced: false,
      time: (frame.t = (frame.t ?? 0) + STEP),
      doors,
      ...view,
      visit: "kitchen",
      camera,
      canvasHeight: 462,
      ...overrides,
    });
  frame(true);
  const panels = () => rig.evidence().cloth.panels;
  assert.equal(rig.doorOpenFraction, 0.5, "one door of two open");
  assert.deepEqual(
    panels().map((p) => [p.id, p.active]),
    [
      ["kitchen-south", true],
      ["kitchen-north", true],
      ["lounge-south", false],
      ["lounge-north", false],
    ],
    "only the kitchen pair is on this camera's screen"
  );
  const lounge = rig.curtains.cloth.panel("lounge-north").positions.slice();
  for (let k = 0; k < 120; k++) frame(true);
  assert.ok(rig.evidence().stepping);
  assert.deepEqual(rig.curtains.cloth.panel("lounge-north").positions.slice(), lounge, "an off-screen panel holds its pose");
  // The schedule: the visited room's view panel stays open, its neighbour is drawn against the sun.
  assert.equal(
    rig.curtains.cloth.targetOpenFraction("kitchen-south"),
    view.plan.fractions["kitchen-south"] >= 0.8 ? view.plan.fractions["kitchen-south"] : 0.8
  );
  assert.ok(rig.curtains.cloth.targetOpenFraction("kitchen-north") < 0.5);
  // A paused frame at dusk composes the settled, closed drape at once and steps nothing.
  const dusk = at(19 * 60 + 30);
  const steps = rig.evidence().cloth.steps;
  frame(false, { ...dusk, visit: "kitchen" });
  assert.equal(rig.evidence().cloth.steps, steps);
  assert.equal(rig.curtains.cloth.openFraction("kitchen-north"), 0);
  assert.ok(rig.evidence().cloth.panels.find((p) => p.id === "kitchen-north").sleeping);
  assert.equal(rig.evidence().plan.state, "night");
  // Far outside, about 48 m away, nothing is big enough to step.
  camera.position.set(3 - 48 * Math.sin(0.3), 17, -6 - 48 * Math.cos(0.3));
  camera.lookAt(3, -0.2, -6);
  frame(true, { ...dusk });
  assert.ok(!rig.evidence().inView && !rig.evidence().stepping);
  rig.dispose();
  assert.equal(scene.getObjectByName("Facade curtains"), undefined);
});
