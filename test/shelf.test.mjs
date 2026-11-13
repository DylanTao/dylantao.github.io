import assert from "node:assert/strict";
import test from "node:test";
import { SHELF, chooseStop, glideStep, releaseVelocity, restingPoint, rubberBand, snapStops } from "../assets/js/shelf.mjs";

test("release speed comes from the last 80 ms of the hand, in pixels a second", () => {
  const steady = Array.from({ length: 9 }, (_, i) => ({ t: 1000 + i * 10, x: 500 - i * 12 }));
  assert.equal(Math.round(releaseVelocity(steady, 1080)), -1200);
  // A hand that stopped before letting go throws nothing.
  const paused = [...steady, { t: 1300, x: 404 }];
  assert.equal(releaseVelocity(paused, 1300), 0);
  assert.equal(releaseVelocity([{ t: 0, x: 0 }], 0), 0);
  assert.equal(
    releaseVelocity(
      [
        { t: 0, x: 0 },
        { t: 1, x: 900 },
      ],
      1
    ),
    SHELF.maxSpeed,
    "a jump is capped"
  );
});

test("a throw travels the same distance whatever the frame rate", () => {
  const travel = (hz) => {
    let position = 0,
      velocity = 1800;
    for (let i = 0; i < hz * 6; i++) [position, velocity] = glideStep(position, velocity, 1 / hz);
    return position;
  };
  const predicted = restingPoint(0, 1800);
  for (const hz of [30, 60, 120, 144]) assert.ok(Math.abs(travel(hz) - predicted) < 0.01, `${hz} Hz lands at ${travel(hz)} of ${predicted}`);
});

test("a release lands on the stop it was heading for, and a quick flick moves on one", () => {
  const stops = [0, 320, 640, 960, 1280];
  assert.equal(chooseStop(stops, 330, 0), 320, "let go at rest: the nearest stop");
  assert.equal(chooseStop(stops, 330, 2400), 960, "a hard throw crosses stops");
  assert.equal(chooseStop(stops, 330, -2400), 0);
  assert.equal(chooseStop(stops, 340, 300), 640, "a short quick flick still advances");
  assert.equal(chooseStop(stops, 300, -300), 0);
  assert.equal(chooseStop(stops, 340, 120), 320, "a slow drift falls back");
  assert.equal(chooseStop(stops, 1275, 3000), 1280, "never past the last stop");
  assert.equal(chooseStop([], 100, 500), null);
});

test("past an end the row gives less and less, and never more than its share", () => {
  assert.equal(rubberBand(0, 800), 0);
  const pulls = [20, 80, 200, 600, 5000].map((pull) => rubberBand(pull, 800));
  for (let i = 1; i < pulls.length; i++) assert.ok(pulls[i] > pulls[i - 1]);
  assert.ok(pulls[0] < 20 && pulls[0] > 20 * SHELF.rubber * 0.9, "a small pull is followed at about the rubber share");
  assert.ok(pulls.at(-1) < 800, "never beyond the row's own width");
  assert.equal(rubberBand(-200, 800), -rubberBand(200, 800));
});

test("stops are read from the children's snap alignment and the row's padding", () => {
  const child = (left, width, align) => ({ align, getBoundingClientRect: () => ({ left: 100 + left - 240, width }) });
  const children = [child(40, 300, "center"), child(360, 300, "center"), child(680, 300, "center"), child(1000, 300, "none")];
  const scroller = {
    children,
    scrollWidth: 1340,
    clientWidth: 700,
    scrollLeft: 240,
    getBoundingClientRect: () => ({ left: 100 }),
  };
  const view = (element) =>
    element === scroller
      ? { scrollSnapType: "x proximity", scrollPaddingLeft: "40px", scrollPaddingRight: "40px" }
      : { scrollSnapAlign: element.align };
  // Centre of the padded view is 40 + 310 = 350; a child centres when left + 150 - 350 is the offset.
  assert.deepEqual(snapStops(scroller, view), [0, 160, 480]);
  assert.deepEqual(
    snapStops(scroller, () => ({ scrollSnapType: "none" })),
    []
  );
});
