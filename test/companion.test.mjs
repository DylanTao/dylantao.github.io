import test from "node:test";
import assert from "node:assert/strict";
import { randomSource, spring, choosePerch, clearAt, phrase } from "../assets/js/companion/behaviour.mjs";
import { beachPoint, beachWidth } from "../assets/js/home-scene/shore.mjs";
import { readFileSync } from "node:fs";
const beach = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url))).beach;
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
