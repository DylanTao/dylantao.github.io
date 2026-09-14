import test from "node:test";
import assert from "node:assert/strict";
import { randomSource, spring, choosePerch, clearAt, phrase } from "../assets/js/companion/behaviour.mjs";
import { beachPoint, beachWidth } from "../assets/js/home-scene/shore.mjs";
import { readFileSync } from "node:fs";
import { createPipMotion, gestures, sampleGesture } from "../assets/js/companion/motion.mjs";
import { planTravel, sampleTravel, segmentClear } from "../assets/js/companion/travel.mjs";
const beach = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url))).beach;

test("Pip flies around cards, shrinks before narrow gaps, and uses portals across blocked pages", () => {
  const start = { x: 100, y: 298 },
    end = { x: 500, y: 298 },
    bounds = { width: 600, height: 600, size: 70 };
  const card = [{ left: 250, right: 350, top: 200, bottom: 400 }];
  const fly = planTravel(start, end, { ...bounds, obstacles: card });
  assert.equal(fly.kind, "fly");
  assert.ok(fly.points.length > 2);
  const narrow = [
    { left: 250, right: 350, top: 0, bottom: 270 },
    { left: 250, right: 350, top: 325, bottom: 600 },
  ];
  const squeeze = planTravel(start, end, { ...bounds, obstacles: narrow });
  assert.equal(squeeze.kind, "squeeze");
  for (const [plan, obstacles] of [
    [fly, card],
    [squeeze, narrow],
  ]) {
    for (let i = 0; i <= 200; i++) {
      const pose = sampleTravel(plan, (plan.duration * i) / 200);
      assert.ok(clearAt(pose.x, pose.y, obstacles, 70 * pose.scale), `${plan.kind} intersects reading at ${i}`);
    }
    assert.equal(sampleTravel(plan, 100).x, end.x);
    assert.equal(sampleTravel(plan, 100).y, end.y);
  }
  const wall = [{ left: 250, right: 350, top: 0, bottom: 600 }];
  const portal = planTravel(start, end, { ...bounds, obstacles: wall });
  assert.equal(portal.kind, "portal");
  assert.equal(segmentClear(start, end, wall, 70), false);
  for (let i = 0; i <= 100; i++) {
    const pose = sampleTravel(portal, (portal.duration * i) / 100);
    assert.ok(pose.x === start.x || pose.x === end.x, "portal must not fly through the intervening text");
    assert.ok(pose.scale > 0 && pose.scale <= 1);
  }
});

test("Pip gestures settle, can be interrupted, and honor reduced motion immediately", () => {
  for (const name of Object.keys(gestures)) {
    const motion = createPipMotion();
    assert.ok(motion.play(name));
    let pose;
    for (let i = 0; i < 360; i++) pose = motion.update(1 / 60, { autonomous: false });
    assert.equal(pose.gesture, "rest");
    assert.ok(pose.head.every((v) => Math.abs(v) < 1e-8));
    assert.ok(Object.values(sampleGesture(name, 100)).every((v) => v === 0));
  }
  const motion = createPipMotion();
  motion.play("curious");
  let before;
  for (let i = 0; i < 50; i++) before = motion.update(1 / 60, { autonomous: false });
  motion.play("hello");
  const after = motion.update(0, { autonomous: false });
  assert.deepEqual(after.head, before.head, "interrupting a gesture must not snap the head");
  const still = motion.update(5, { still: true, gaze: [1, 1] });
  assert.deepEqual(still.head, [0, 0, 0]);
  assert.deepEqual(still.antennas, [0, 0]);
  assert.equal(motion.update(10, { nap: true }).blink, 1);
});

test("Pip pointer following is frame-rate independent and long frames stay bounded", () => {
  const sample = (hz) => {
    const motion = createPipMotion();
    let pose;
    for (let i = 0; i < hz; i++) pose = motion.update(1 / hz, { gaze: [1, -1], autonomous: false });
    return pose;
  };
  const a = sample(30),
    b = sample(120);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(a.head[i] - b.head[i]) < 0.0001);
  const motion = createPipMotion();
  motion.play("hello");
  const pose = motion.update(3600, { gaze: [100, -100], autonomous: false });
  assert.ok(pose.head.every((v) => Number.isFinite(v) && Math.abs(v) < 0.4));
  assert.equal(pose.gesture, "hello", "a hidden-tab interval must not skip the entire gesture");
});
test("the damped companion settles without overshooting after a long frame", () => {
  let x = 0,
    v = 0;
  for (let i = 0; i < 400; i++) {
    [x, v] = spring(x, v, 100, i === 5 ? 8 : 1 / 60);
    assert.ok(x >= 0 && x <= 100);
    assert.ok(Number.isFinite(v));
  }
  assert.ok(Math.abs(x - 100) < 0.001);
});
test("perches stay in the viewport and avoid reading surfaces at all four widths", () => {
  for (const [width, height] of [
    [1440, 1000],
    [1280, 800],
    [768, 1024],
    [390, 1000],
  ]) {
    const obstacles = [{ left: 70, right: width - 80, top: 95, bottom: 650 }];
    const point = choosePerch({ width, height, preferred: { x: width - 60, y: 360 }, obstacles, size: 72 });
    assert.ok(point);
    assert.ok(clearAt(point.x, point.y, obstacles, 72));
    assert.ok(point.x > 0 && point.x < width && point.y > 0 && point.y < height);
  }
  assert.equal(
    choosePerch({ width: 390, height: 500, preferred: { x: 300, y: 300 }, obstacles: [{ left: 0, right: 390, top: 0, bottom: 500 }] }),
    null
  );
});
test("seeded curiosity is repeatable, varied, and has route-appropriate copy", () => {
  const a = randomSource(41),
    b = randomSource(41);
  for (let i = 0; i < 30; i++) assert.equal(a(), b());
  assert.match(
    phrase("/publications/", "", "", () => 0),
    /receipts/
  );
  assert.match(
    phrase("/blog/", "", "", () => 0),
    /quiet corner/
  );
  assert.match(
    phrase("/", "", "repair", () => 0),
    /better/
  );
});
test("the expanded beach and animal contact surface share the shoreline", () => {
  for (const x of [-15, 0, 9, 24, 40]) {
    assert.ok(beachWidth(x, beach) > 12);
    const sand = beachPoint(x, 0.28, beach),
      sea = beachPoint(x, 0.8, beach);
    assert.ok(sand[1] > -7.35);
    assert.ok(sea[1] < -7.35);
    assert.ok(sand[2] > sea[2]);
  }
});
