import assert from "node:assert/strict";
import test from "node:test";
import { ROLL, createRoll, landingOf, leaveAngle, shelfEnd, solvePush } from "../assets/js/orange-roll-physics.mjs";

// The orange on a wide page: 37 px in radius, resting at (430, 500); the sea 1150 px below.
const setup = (landingX = 1620, landingY = 1650, startX = 430) => ({
  start: { x: startX, y: 500 },
  radius: 37,
  edge: shelfEnd(startX, landingX),
  landing: { x: landingX, y: landingY },
  endScale: 0.23,
});

test("it rolls without slipping: it turns exactly as far as it travels, and slows a little", () => {
  const roll = createRoll({ ...setup(), push: 1 });
  const { state } = roll;
  let last = state.speed;
  while (state.phase === "roll") {
    const x = state.x,
      angle = state.angle;
    roll.step(1 / 60);
    if (state.phase !== "roll") break;
    assert.ok(Math.abs(state.angle - angle - (state.x - x) / 37) < 1e-9, "angle = distance / radius");
    assert.ok(state.speed < last, "rolling resistance only ever slows it");
    assert.equal(state.y, 500, "the shelf is level");
    last = state.speed;
  }
  assert.ok(state.x >= setup().edge);
  // A sphere answers rolling resistance with 5/7 of it: v^2 = v0^2 - 2 (5/7) c g d.
  const metres = (setup().edge - 430) / ROLL.pixelsPerMetre,
    expected = Math.sqrt(1 - 2 * (5 / 7) * ROLL.resistance * ROLL.gravity * metres);
  assert.ok(Math.abs(last / (ROLL.pixelsPerMetre * ROLL.slow) - expected) < 0.01, `at the edge ${last} for ${expected}`);
  // The page plays slow: one real metre a second shows as six tenths of that.
  assert.ok(Math.abs(createRoll({ ...setup(), push: 1 }).state.speed - 600) < 1e-9);
  // A push too gentle to reach the edge stops on the shelf.
  assert.equal(landingOf(setup(), 0.2).phase, "stopped");
});

test("it tips over the shelf's end until the edge can no longer hold it", () => {
  const g = ROLL.gravity,
    r = 0.037;
  // Fast enough (v^2 >= g r) it leaves at once; slower, it turns about the edge first.
  assert.equal(leaveAngle(1, r), 0);
  assert.ok(Math.abs(leaveAngle(0, r) - Math.acos(10 / 17)) < 1e-12, "from rest, 54 degrees");
  assert.ok(leaveAngle(0.3, r) > leaveAngle(0.5, r));
  // A short shelf (a phone's), so a gentle push still reaches its end.
  const short = setup(330, 1500, 60);
  for (const push of [0.42, 0.5, 0.62, 0.9]) {
    const roll = createRoll({ ...short, push }),
      { state } = roll;
    // Its speed at the shelf's end, from the roll's own law.
    const atEdge = Math.sqrt(push * push - (2 * (5 / 7) * ROLL.resistance * g * (short.edge - short.start.x)) / ROLL.pixelsPerMetre);
    while (state.phase === "roll") roll.step(1 / 240);
    const rolled = (short.edge - short.start.x) / 37,
      expected = leaveAngle(atEdge, r, g);
    if (expected === 0) {
      // Fast enough, the edge never holds it: it is in the air on the step it reaches the end.
      assert.equal(state.phase, "fall", `push ${push} leaves at once`);
      continue;
    }
    let last = { ...state };
    while (state.phase === "tip") {
      last = { ...state };
      // On the way round, its centre stays one radius from the edge.
      assert.ok(Math.abs(Math.hypot(state.x - short.edge, state.y - (500 + 37)) - 37) < 0.01);
      roll.step(1 / 240);
    }
    // It has turned through the roll's angle and then the tip's; the step that let go is the slack.
    assert.ok(last.angle - rolled <= expected + 0.01, `push ${push}: it left no later than ${expected.toFixed(3)}`);
    assert.ok(
      state.angle - rolled >= expected - 0.01 && state.angle - rolled < expected + 0.12,
      `push ${push}: turned ${(state.angle - rolled).toFixed(3)} for ${expected.toFixed(3)}`
    );
    assert.equal(state.phase, "fall");
  }
});

test("it falls on a ballistic path, shrinking to the coast's scale, and the page slows with it", () => {
  const roll = createRoll({ ...setup(), push: 1.2 }),
    { state } = roll;
  while (state.phase !== "fall") roll.step(1 / 120);
  const spin = state.spin;
  let last = { ...state },
    fastest = 0;
  while (state.phase === "fall") {
    last = { ...state };
    roll.step(1 / 120);
    assert.ok(state.y >= last.y && state.x >= last.x, "down and to the right");
    assert.ok(state.scale <= last.scale + 1e-12 && state.scale >= 0.23 - 1e-12);
    assert.ok(Math.abs(state.spin - spin) < 1e-12, "nothing changes its spin in the air");
    fastest = Math.max(fastest, state.speed);
  }
  assert.equal(state.phase, "landed");
  assert.equal(state.y, 1650);
  assert.equal(state.scale, 0.23);
  // At full size it would be falling at several metres a second; at the coast's scale the page
  // shows under a quarter of that.
  assert.ok(state.speed < 1500 && state.speed > 250, `it arrives at ${state.speed} px/s`);
  assert.ok(fastest < 2600, `and is never faster than ${fastest} px/s on the page`);
  // The whole thing can be watched: a couple of seconds, not a blink.
  assert.ok(state.time > 1.4 && state.time < 6, `${state.time} s`);
  // Landed, it stays.
  const at = { ...state };
  roll.step(1);
  assert.deepEqual({ ...state, time: 0 }, { ...at, time: 0 });
});

test("the push is chosen so that it lands where the sea is", () => {
  for (const [landingX, landingY, startX] of [
    [1620, 1650, 430],
    [1100, 1400, 270],
    [330, 1500, 60],
    [900, 900, 300],
  ]) {
    const geometry = setup(landingX, landingY, startX),
      push = solvePush(geometry),
      landed = landingOf(geometry, push);
    assert.equal(landed.phase, "landed");
    assert.ok(Math.abs(landed.x - landingX) < 3, `landing at ${landed.x.toFixed(1)} for ${landingX} with a push of ${push.toFixed(2)} m/s`);
    assert.ok(push >= ROLL.push[0] && push <= ROLL.push[1]);
    assert.ok(landed.time > 1 && landed.time < 7, `${landed.time} s`);
    // A harder push lands farther: that is what lets the push be found by halving.
    assert.ok(landingOf(geometry, push * 1.2).x > landed.x);
  }
  // The shelf ends part of the way to the landing, never nearer or farther than its limits.
  assert.equal(shelfEnd(430, 1620), 430 + (1620 - 430) * ROLL.shelf[0]);
  assert.equal(shelfEnd(60, 100), 60 + ROLL.shelf[1]);
  // On a narrow page it leaves room for the drop: tipping off an edge carries it forward.
  assert.equal(shelfEnd(60, 330), 60 + (330 - 60 - ROLL.shelf[3]));
  assert.equal(shelfEnd(0, 9000), ROLL.shelf[2]);
});
