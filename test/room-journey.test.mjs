import test from "node:test";
import assert from "node:assert/strict";
import { timeSupportedRoute, roomTransfer, createRoomJourney, verifiedRoomTransfer } from "../assets/js/home-scene/room-journey.mjs";
import fs from "node:fs";

test("the delivered bed admits only source-reviewed transfers; the clipping Lizard roll stays disabled", () => {
  const config = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
  const room = config.rooms.find((room) => room.bedTransfer);
  assert.ok(room);
  for (const avatar of config.avatars) assert.equal(verifiedRoomTransfer(room, avatar.id), avatar.id !== "lizard", avatar.id);
  assert.equal(verifiedRoomTransfer(room, "unknown-avatar"), false);
  assert.equal(verifiedRoomTransfer({ bedTransfer: {} }, "realistic"), false);
  assert.equal(verifiedRoomTransfer({ id: "study" }, "lizard"), true);
});

test("supported time preserves every native tread and spends a complete step on each riser", () => {
  const points = [
      [0, 1.5, 0],
      [0, 1.5, 1],
      [0.15, 1.35, 1.1],
      [0.3, 1.2, 1.2],
      [1, 1.2, 1.2],
    ],
    route = { points, length: points.slice(1).reduce((n, p, i) => n + Math.hypot(...p.map((v, j) => v - points[i][j])), 0) },
    timed = timeSupportedRoute(route);
  for (let i = 0; i < points.length; i++) assert.ok(Math.hypot(...timed.pose(timed.times[i]).position.map((v, j) => v - points[i][j])) < 1e-12);
  assert.ok(timed.times[2] - timed.times[1] >= 0.8 - 1e-12);
  assert.ok(timed.times[3] - timed.times[2] >= 0.8 - 1e-12);
  assert.equal(timed.pose((timed.times[1] + timed.times[2]) / 2).onStairs, true);
  assert.ok(timed.pose((timed.times[1] + timed.times[2]) / 2).walkingSpeed < 0.45);
  assert.throws(
    () =>
      timeSupportedRoute({
        points: [
          [0, 0, 0],
          [0, 0, 0],
        ],
      }),
    TypeError
  );
});

test("bed transfer and its inverse join walking continuously without projecting a lying root to the floor", () => {
  const room = {
      actor: [0, 1.5, 0],
      facing: 0,
      walkActor: [-1.2, 1.5, 0],
      bedTransfer: {
        lyingActor: [0, 1.5, 0],
        standingActor: [-1.2, 1.5, 0],
        seat: { facing: -Math.PI / 2 },
        feet: { L: { position: [-1, 1.5, -0.14] }, R: { position: [-1, 1.5, 0.14] } },
      },
    },
    seatedRoot = [-0.6, 1.55, 0],
    transfer = roomTransfer(room, "sleep", { seatedRoot }),
    route = { points: [room.walkActor, [-2, 1.5, 0]], length: 0.8 },
    leaving = createRoomJourney({ route, departure: transfer }),
    arriving = createRoomJourney({ route: { points: [...route.points].reverse(), length: 0.8 }, arrival: transfer });
  assert.deepEqual(leaving.pose(0).position, room.actor);
  assert.deepEqual(leaving.pose(transfer.duration).position, room.walkActor);
  assert.deepEqual(arriving.pose(arriving.duration).position, room.actor);
  assert.deepEqual(transfer.pose(3.3).position, seatedRoot);
  assert.equal(transfer.pose(3.3).plantedWeight, 1);
  const joints = [0, 2.8, 3.8, transfer.duration, leaving.duration];
  for (const t of joints) {
    const a = leaving.pose(Math.max(0, t - 1e-5)).position,
      b = leaving.pose(t + 1e-5).position;
    assert.ok(Math.hypot(...a.map((v, i) => v - b[i])) < 0.0001, `continuous root at ${t}`);
  }
  assert.throws(() => roomTransfer(room, "sleep"), TypeError);
});
