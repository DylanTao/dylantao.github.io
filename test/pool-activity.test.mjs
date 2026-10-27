import test from "node:test";
import assert from "node:assert/strict";
import { createPoolActivity, poolActivityRoom } from "../assets/js/home-scene/pool-activity.mjs";

function fixture() {
  const positions = [
    [0, 0, 2],
    [0, 0, 1.5],
    [0, -0.18, 1.1],
    [0, -0.36, 0.7],
    [0, -0.54, 0.3],
  ];
  return {
    path: positions.map((position, i) => ({ position, supportId: `native-${i}` })),
    recovery: positions[0],
    entry: positions[0],
    waterline: -0.09,
    supportSurfaces: positions.map((p, i) => ({
      id: `native-${i}`,
      height: p[1],
      polygon: [
        [-1, p[2] - 0.2],
        [1, p[2] - 0.2],
        [1, p[2] + 0.2],
        [-1, p[2] + 0.2],
      ],
    })),
    pause: { facing: 0 },
    camera: { target: [0, -0.2, 1], radius: 6, yaw: 1, pitch: 0.62, fov: 52 },
    egress: [3, 0, 5],
    entranceRoute: [
      [3, 0, 5],
      [3, 0, 2],
      [0, 0, 2],
    ],
  };
}

test("the pool visit has one bounded descent and pause and retraces its exit to the dry recovery", () => {
  const spec = fixture(),
    visit = createPoolActivity(spec);
  assert.deepEqual(visit.pose(0).position, spec.entry);
  const still = visit.pose(visit.entrySeconds + 2);
  assert.deepEqual(still.position, spec.path.at(-1).position);
  assert.equal(still.clip, "idle");
  assert.equal(still.walkingSpeed, 0);
  assert.deepEqual(visit.pose(visit.duration + 100).position, spec.recovery);
  assert.equal(visit.pose(visit.duration).done, true);
  for (let t = 0.05; t < visit.entrySeconds; t += 0.05) {
    const entering = visit.pose(t),
      leaving = visit.pose(visit.duration - t);
    entering.position.forEach((v, i) => assert.ok(Math.abs(v - leaving.position[i]) < 1e-12));
    assert.ok(entering.walkingSpeed <= 0.500001);
    assert.ok(entering.position.every(Number.isFinite));
  }
  assert.equal(visit.pose(0, { reduced: true }).phase, "quiet in the water");
});

test("pool supports remain activity-local and a real outdoor view replaces no model room", () => {
  const spec = fixture(),
    config = { infinityPool: { activity: spec }, rooms: [{ id: "lounge" }], terrain: { supportSurfaces: [] } };
  const room = poolActivityRoom(config);
  assert.equal(room.id, "terrace");
  assert.equal(room.file, undefined);
  assert.deepEqual(room.actor, spec.entry);
  assert.deepEqual(room.exitPath, spec.entranceRoute.slice().reverse());
  assert.equal(config.rooms.length, 1);
  assert.equal(config.terrain.supportSurfaces.length, 0);
  const bad = structuredClone(spec);
  bad.supportSurfaces[2].height += 0.1;
  assert.throws(() => createPoolActivity(bad), /matching native support/);
  const unsafe = structuredClone(spec);
  unsafe.recovery = [0, -2, 0];
  assert.throws(() => createPoolActivity(unsafe), /dry entry/);
});
