import test from "node:test";
import assert from "node:assert/strict";
import { spawnPlan } from "../assets/js/home-scene/walk-controls.mjs";
import { createWalkField } from "../assets/js/home-scene/colliders.mjs";

const fixture = () => {
  const exitPath = [
    [-6.055, -1.02, 5.71],
    [-6.055, -1.02, 4.62],
    [-4.83, -1.02, 4.62],
    [-3.35, 0, 4.62],
  ];
  return {
    rooms: [
      {
        id: "kitchen",
        floor: 0,
        target: [-7.1, 0.05, 5.5],
        exitPath,
        camera: { yaw: 2.527, pitch: 0.305, radius: 2.2 },
        walkEntry: { position: [-6.055, -1.02, 5.71], floor: -1.02 },
        breakfastNook: {
          supportSurfaces: [
            {
              height: -1.02,
              polygon: [
                [-7.85, 3.4],
                [-5.45, 3.4],
                [-5.45, 6.6],
                [-7.85, 6.6],
              ],
            },
          ],
        },
      },
    ],
    terrain: { contacts: { kitchen: { exitPath } } },
    walk: { start: { position: [3.4, 7.52, 18.9], yaw: 3 } },
  };
};
const view = { room: "kitchen", routineRoom: "kitchen", camera: [-5.88997, 0.710645, 3.78554] };

test("deliberate garden entry uses its supported lower aisle without moving the cooking floor or first entrance", () => {
  const config = fixture(),
    before = structuredClone(config),
    plan = spawnPlan(config, view, { entrance: false });
  assert.deepEqual(plan, { candidates: [[-6.055, 5.71]], floor: -1.02, look: config.rooms[0].target, room: "kitchen", strict: true });
  assert.equal(config.rooms[0].floor, 0);
  assert.deepEqual(config, before);
  assert.equal(spawnPlan(config, view).floor, 7.52);
  const field = createWalkField({ min: [-8, -2, 3], max: [-5, 2, 7] });
  field.addTriangle(-7.85, -1.02, 3.4, -5.45, -1.02, 3.4, -5.45, -1.02, 6.6);
  field.addTriangle(-7.85, -1.02, 3.4, -5.45, -1.02, 6.6, -7.85, -1.02, 6.6);
  const [x, z] = plan.candidates[0],
    stand = field.findStand(x, z, plan.floor, { reach: 0.45 });
  assert.ok(stand);
  assert.ok(Math.abs(stand.foot + 1.02) < 1e-6, "feet begin on the actual lower support");
  assert.equal(field.findStand(x, z, 0, { reach: 0.45 }), null, "legacy floor0 cannot find this support within its unchanged vertical tolerance");
});

test("missing, unknown, remote or unsupported entry data preserves the exact legacy spawn plan", () => {
  const controls = [
    (c) => delete c.rooms[0].walkEntry,
    (c) => (c.rooms[0].walkEntry = null),
    (c) => (c.rooms[0].walkEntry.extra = true),
    (c) => (c.rooms[0].walkEntry.position[0] = NaN),
    (c) => (c.rooms[0].walkEntry.floor = -10),
    (c) => (c.rooms[0].walkEntry.position[1] = -0.9),
    (c) => (c.rooms[0].walkEntry.position[0] = 10),
    (c) => (c.rooms[0].exitPath = []),
    (c) => (c.terrain.contacts.kitchen.exitPath = []),
    (c) => (c.rooms[0].breakfastNook.supportSurfaces[0].height = -0.5),
    (c) =>
      (c.rooms[0].breakfastNook.supportSurfaces[0].polygon = [
        [-6.1, 5.7],
        [-6, 5.7],
        [-6, 5.8],
      ]),
    (c) => (c.rooms[0].breakfastNook.supportSurfaces[0].polygon[0] = [NaN, 3.4]),
    (c) => (c.rooms[0].breakfastNook.supportSurfaces = [null]),
    (c) => (c.rooms[0].breakfastNook.supportSurfaces = [false]),
    (c) => (c.rooms[0].breakfastNook.supportSurfaces = [3]),
    (c) => (c.rooms[0].breakfastNook.supportSurfaces = ["unknown"]),
    (c) => (c.rooms[0].breakfastNook.supportSurfaces = [[]]),
  ];
  for (const edit of controls) {
    const config = fixture();
    edit(config);
    const legacy = structuredClone(config);
    delete legacy.rooms[0].walkEntry;
    assert.deepEqual(spawnPlan(config, view, { entrance: false }), spawnPlan(legacy, view, { entrance: false }));
  }
});

test("a room target must be a finite three-tuple before either entry policy indexes it", () => {
  for (const target of [null, false, 4, "unknown", [], [0, 0], [0, 0, NaN], [0, Infinity, 0]]) {
    const config = fixture();
    config.rooms[0].target = target;
    assert.equal(spawnPlan(config, view, { entrance: false }), null);
  }
});
