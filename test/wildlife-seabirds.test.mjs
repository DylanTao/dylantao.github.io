import test from "node:test";
import assert from "node:assert/strict";
import {
  pelicanMotion,
  pelicanDive,
  cormorantMotion,
  seaSurface,
  PELICAN_DIVER,
  PELICAN_ROUTE_LENGTH,
} from "../assets/js/home-scene/wildlife-seabird-motion.mjs";

const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const SPEED = 4.3,
  SPACING = 4.4;

test("brown pelicans fly in line, gliding about a metre above the swell the renderer draws", () => {
  let lowPass = 0;
  for (let t = 0; t < 400; t += 0.37) {
    const leader = pelicanMotion(t, 0);
    for (let index = 1; index < 5; index++) {
      const bird = pelicanMotion(t, index);
      if (bird.state === "trail" || ["climb", "dive", "under", "surface", "float", "gulp", "takeoff"].includes(bird.state)) continue;
      near(leader.routeDistance - bird.routeDistance, index * SPACING, 1e-9);
    }
    for (let index = 0; index < 5; index++) {
      const bird = pelicanMotion(t, index);
      assert.ok(bird.position.every(Number.isFinite) && Number.isFinite(bird.yaw) && Number.isFinite(bird.pitch));
      const [x, y, z] = bird.position;
      // On the low pass the line rides the displaced sea surface, close enough for ground effect.
      if (z > -27 && z < -23 && Math.abs(x) < 40 && bird.state !== "dive" && bird.state !== "climb" && bird.state !== "takeoff" && !bird.onWater) {
        const height = y - seaSurface(x, z, t);
        assert.ok(height > 0.85 && height < 1.1, `pelican ${index} at ${height.toFixed(2)} m above the swell`);
        lowPass++;
      }
      assert.ok(Math.abs(bird.bank) <= 0.75);
    }
  }
  assert.ok(lowPass > 300, "the line spends real time on the low pass in view");
  assert.ok(PELICAN_ROUTE_LENGTH > 250 && PELICAN_ROUTE_LENGTH < 400);
});

test("each pelican repeats the leader's wingbeats at the same place, so a flap wave runs down the line", () => {
  let checked = 0;
  for (let t = 1; t < 300 && checked < 6; t += 0.1) {
    const leader = pelicanMotion(t, 0);
    if (leader.flap < 0.9) continue;
    for (const index of [1, 2]) {
      const follower = pelicanMotion(t + (index * SPACING) / SPEED, index);
      if (follower.state !== "flap" && follower.state !== "glide") continue;
      near(follower.flap, leader.flap, 1e-6);
      near(follower.wingBeat, leader.wingBeat, 1e-6);
      checked++;
    }
    t += 9;
  }
  assert.ok(checked >= 4);
});

test("now and then the last pelican plunge-dives, swallows on the swell, runs off the water and rejoins its slot", () => {
  let dive = null;
  for (let lap = 0; lap < 12 && !dive; lap++) dive = pelicanDive(lap);
  assert.ok(dive, "dives happen");
  const order = [];
  let previous = pelicanMotion(dive.start - 0.02, PELICAN_DIVER);
  for (let t = dive.start; t < dive.start + 15.5 + dive.catchUp + 2; t += 0.02) {
    const bird = pelicanMotion(t, PELICAN_DIVER);
    if (order.at(-1) !== bird.state) order.push(bird.state);
    const step = Math.hypot(...bird.position.map((value, axis) => value - previous.position[axis]));
    assert.ok(step < 0.3, `diver jumped ${step.toFixed(3)} m at ${(t - dive.start).toFixed(2)} s (${bird.state})`);
    if (bird.state === "float" || bird.state === "gulp") near(bird.position[1], seaSurface(bird.position[0], bird.position[2], t), 1e-9);
    previous = bird;
  }
  for (const state of ["climb", "dive", "under", "surface", "gulp", "float", "takeoff", "trail"])
    assert.ok(order.includes(state), `dive never shows ${state}: ${order}`);
  assert.ok(
    order.indexOf("climb") < order.indexOf("dive") &&
      order.indexOf("dive") < order.indexOf("under") &&
      order.indexOf("float") < order.indexOf("takeoff")
  );
  // The climb reaches about six metres over the swell before the fold.
  const top = pelicanMotion(dive.start + 2.35, PELICAN_DIVER);
  assert.ok(top.position[1] - seaSurface(top.position[0], top.position[2], dive.start + 2.35) > 5);
  // After the catch-up it is back in its slot behind the leader.
  const after = dive.start + 15.5 + dive.catchUp + 1;
  near(pelicanMotion(after, 0).routeDistance - pelicanMotion(after, PELICAN_DIVER).routeDistance, PELICAN_DIVER * SPACING, 1e-6);
  assert.ok(pelicanMotion(dive.start + 3.8, PELICAN_DIVER).splash > 0.9, "the entry throws a splash");
});

test("Brandt's cormorants stand upright, dry their wings, preen and flutter their throats", () => {
  for (let index = 0; index < 4; index++) {
    const states = new Set();
    let spreadMax = 0,
      flutter = 0;
    let previous = cormorantMotion(0, index);
    for (let t = 0.02; t < 600; t += 0.02) {
      const pose = cormorantMotion(t, index);
      states.add(pose.state);
      spreadMax = Math.max(spreadMax, pose.spread);
      flutter = Math.max(flutter, Math.abs(pose.flutter));
      assert.ok(pose.spread > -0.05 && pose.spread < 1.08);
      assert.ok(pose.bodyPitch < -0.85 && pose.bodyPitch > -1.05, "upright stance");
      // Wings open over about a second; heads snap round in saccades but never teleport.
      for (const [key, rate] of [
        ["spread", 4],
        ["neckPitch", 4],
        ["headYaw", 12.5],
        ["headPitch", 12.5],
      ])
        assert.ok(Math.abs(pose[key] - previous[key]) < rate * 0.02, `cormorant ${index} ${key} jumped at ${t}`);
      previous = pose;
    }
    assert.ok(states.has("dry") && states.has("stand"), `cormorant ${index}: ${[...states]}`);
    assert.ok(states.size >= 4, `cormorant ${index} repertoire ${[...states]}`);
    assert.ok(spreadMax > 0.95 && flutter > 0.02);
  }
});
