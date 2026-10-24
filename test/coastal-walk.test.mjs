import test from "node:test";
import assert from "node:assert/strict";
import { BODY, createWalkField, createWalkFieldBuilder, isWater, walkKind, WATER_BLOCK } from "../assets/js/home-scene/colliders.mjs";
import * as THREE from "../assets/js/three.module.min.js";
import {
  dragLook,
  easeVelocity,
  keyAxes,
  keyCode,
  integrateVelocity,
  mouseLook,
  roomAt,
  spawnPlan,
  unitDisc,
  walkDirection,
  walkQuaternion,
  walkSpeed,
  WALK,
} from "../assets/js/home-scene/walk-controls.mjs";
import { createGamepads, radialDeadzone, readGamepad } from "../assets/js/home-scene/gamepad.mjs";
import { stickVector } from "../assets/js/home-scene/virtual-joysticks.mjs";

// A small world built from boxes, the way the loaded meshes reach the field: as triangles.
function box(field, [x0, y0, z0], [x1, y1, z1], extrude = 0) {
  const p = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y1, z0],
    [x0, y1, z0],
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
  ];
  const faces = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [3, 2, 6, 7],
    [0, 3, 7, 4],
    [1, 2, 6, 5],
  ];
  for (const [a, b, c, d] of faces) {
    field.addTriangle(...p[a], ...p[b], ...p[c], extrude);
    field.addTriangle(...p[a], ...p[c], ...p[d], extrude);
  }
}
// A 10 x 10 m room on a slab at y = 0, walled to 2.6 m, a 15-riser stair up its east side to a 2.6 m
// gallery, a table, a sunken pit 0.42 m deep, a pool of water and a cliff edge on the south.
function room() {
  const field = createWalkField({ min: [-6, -2, -8], max: [6, 6, 6] });
  box(field, [-5, -0.2, -5], [5, 0, 5]); // floor
  box(field, [-5.2, 0, -5.2], [-5, 2.6, 5.2]); // west wall
  box(field, [5, 0, -5.2], [5.2, 2.6, 5.2]); // east wall
  box(field, [-5.2, 0, 5], [5.2, 2.6, 5.2]); // north wall
  // The south side opens onto a 3 m terrace that ends at a cliff (nothing below).
  box(field, [-5, -0.2, -8], [5, 0, -5]);
  // Stair: 15 risers of 0.1733 m, 0.26 m treads running north along x 3.5-4.5, from z -1.
  for (let i = 0; i < 15; i++) box(field, [3.5, 0, -1 + i * 0.26], [4.5, (i + 1) * 0.1733, -1 + (i + 1) * 0.26]);
  // The gallery the stair reaches: a slab at 2.6 m north of z 2.9, open to the room below.
  box(field, [-5, 2.4, 2.9], [5, 2.6, 5]);
  box(field, [-1, 0.72, -3], [0.6, 0.76, -2.2]); // a table top
  box(field, [-0.95, 0, -2.95], [-0.9, 0.72, -2.9]); // one of its legs
  // A conversation pit: the floor drops 0.42 m inside x -4..-2, z -4..-2.
  box(field, [-4, -0.62, -4], [-2, -0.42, -2]);
  return field;
}
// The pit needs its floor removed where it is sunken; build that room without the main slab there.
function pitRoom() {
  const field = createWalkField({ min: [-6, -2, -6], max: [6, 4, 6] });
  box(field, [-5, -0.2, -5], [-4, 0, 5]);
  box(field, [-4, -0.2, -5], [-2, 0, -4]);
  box(field, [-4, -0.2, -2], [-2, 0, 5]);
  box(field, [-2, -0.2, -5], [5, 0, 5]);
  box(field, [-4, -0.62, -4], [-2, -0.42, -2]); // the pit floor, 0.42 m down
  box(field, [-3.4, -0.42, -3.4], [-3.0, 0.3, -3.0]); // a suspended fireplace's base and flue stand-in
  return field;
}

test("floors carry the walker at their exact height; walls and furniture stop it", () => {
  const field = room();
  assert.equal(field.standAt(0, 0, 0), 0);
  // A wall's faces block; its core is never reached (the field records surfaces, not interiors).
  assert.ok(Number.isNaN(field.standAt(-4.95, 0, 0)), "the west wall's face");
  assert.ok(Number.isNaN(field.standAt(-0.2, -2.6, 0)), "under the table top: something at head height");
  // Walking west stops a capsule radius short of the wall's face (x -5), conservative by at most one
  // 10 cm column (a face on a column boundary blocks that column).
  let s = { x: 0, z: 0, foot: 0 };
  s = field.move(s.x, s.z, s.foot, -10, 0);
  assert.ok(s.blocked);
  assert.ok(s.x >= -5 + BODY.radius - 1e-6 && s.x <= -5 + BODY.radius + field.cell + 1e-3, `${s.x}`);
  // A table is walked around, not through.
  const t = field.move(-0.2, -1.5, 0, 0, -2);
  assert.ok(t.blocked && t.z > -2.2 + BODY.radius - 0.06, `${t.z}`);
});

test("a long step is broken into short ones: nothing a column thick is tunnelled", () => {
  const field = createWalkField({ min: [-3, -1, -3], max: [3, 3, 3] });
  box(field, [-3, -0.2, -3], [3, 0, 3]);
  box(field, [0.5, 0, -3], [0.55, 2.5, 3]); // a 5 cm partition
  const s = field.move(0, 0, 0, 2, 0);
  assert.ok(s.blocked);
  assert.ok(s.x < 0.5 - BODY.radius + 0.06, `${s.x}`);
});

test("stairs climb tread by tread to the gallery, and the gallery's open edge holds the walker", () => {
  const field = room();
  let s = { x: 4, z: -1.4, foot: 0 };
  const heights = new Set();
  for (let i = 0; i < 140 && s.z < 3.5; i++) {
    s = field.move(s.x, s.z, s.foot, 0, 0.05);
    heights.add(Math.round(s.foot * 1000));
  }
  assert.ok(s.foot > 2.59 && s.foot <= 2.6001, `reached the gallery at ${s.foot}`);
  assert.ok(heights.size >= 15, `climbed tread by tread (${heights.size} heights)`);
  for (let i = 0; i < 140 && s.z > -1.4; i++) s = field.move(s.x, s.z, s.foot, 0, -0.05);
  assert.equal(s.foot, 0, "the same treads descend back to the ground floor");
  assert.ok(s.z < -1.35, `the return route is continuous at ${s.z}`);
  // On the gallery, walking south toward the open edge over the room stops at the edge.
  let g = { x: 0, z: 4, foot: 2.6 };
  g = field.move(g.x, g.z, g.foot, 0, -3);
  assert.ok(g.blocked);
  assert.ok(g.z > 2.9 && g.z < 2.9 + BODY.radius + 0.1, `${g.z}`);
});

test("a diagonal walk glides along a wall without alternating stops or crossing it", () => {
  const field = room();
  let state = { x: -4.5, z: -1.5, foot: 0 };
  const distances = [];
  for (let i = 0; i < 60; i++) {
    const before = state;
    state = field.move(state.x, state.z, state.foot, -0.035, 0.035);
    distances.push(state.z - before.z);
    assert.ok(state.x >= -5 + BODY.radius - 1e-4, `stays outside the wall: ${state.x}`);
  }
  assert.ok(
    distances.every((distance) => Math.abs(distance - 0.035) < 1e-5),
    "tangential movement remains smooth at every step"
  );
});

test("the cliff is a wall: the walker can never step off the property", () => {
  const field = room();
  const s = field.move(0, -6, 0, 0, -5);
  assert.ok(s.blocked);
  assert.ok(s.z > -8 && s.z < -8 + BODY.radius + 0.1, `${s.z}`);
});

test("a sunken pit's 0.42 m edge is a step down and back up; the fireplace inside it is a block", () => {
  const field = pitRoom();
  let s = { x: -3, z: -1.2, foot: 0 };
  s = field.move(s.x, s.z, s.foot, 0, -0.9);
  assert.ok(Math.abs(s.foot - -0.42) < 1e-6, `stepped into the pit: ${s.foot}`);
  // The fireplace stands in the pit's middle.
  const blocked = field.move(-3.2, -2.3, -0.42, 0, -1);
  assert.ok(blocked.blocked && blocked.z > -3.0 + BODY.radius - 0.06, `${blocked.z}`);
  // And back out over the edge.
  s = field.move(-3, -2.5, -0.42, 0, 1.5);
  assert.equal(s.foot, 0);
  assert.ok(BODY.maxStep >= 0.45 && BODY.maxDrop > BODY.maxStep, "pit edges and nooks of 0.40-0.45 m are steps");
});

test("water is raised into a block: walked around, never on or into", () => {
  const field = createWalkField({ min: [-4, -2, -4], max: [4, 4, 4] });
  box(field, [-4, -0.2, -4], [4, 0, 4]);
  box(field, [-1, -1.4, -1], [1, -1.2, 1]); // the pool's floor, deep below
  // The water's surface, 0.1 m below the deck, extruded as colliders.mjs does for water.
  field.addTriangle(-1, -0.1, -1, 1, -0.1, -1, 1, -0.1, 1, WATER_BLOCK);
  field.addTriangle(-1, -0.1, -1, 1, -0.1, 1, -1, -0.1, 1, WATER_BLOCK);
  assert.ok(Number.isNaN(field.standAt(0, 0, 0)));
  const s = field.move(-2.5, 0, 0, 4, 0);
  assert.ok(s.blocked && s.x < -1 - BODY.radius + 0.06, `${s.x}`);
  assert.equal(isWater({ material: { transmission: 1 } }), true);
  assert.equal(isWater({ name: "onsen_water", material: {} }), true);
  assert.equal(isWater({ name: "infinity pool water", material: { name: "pool" } }), true);
  assert.equal(isWater({ name: "kitchen waterfall island", material: { name: "milky veined marble" } }), false);
});

test("walkKind keeps glass and static cutaway roofs, skips doors, props and characters, and honours userData.walk", () => {
  const mesh = (userData = {}, material = { opacity: 1 }, extra = {}) => ({
    isMesh: true,
    geometry: { attributes: { position: {} } },
    material,
    userData,
    visible: true,
    parent: null,
    ...extra,
  });
  assert.equal(walkKind(mesh()), "solid");
  assert.equal(walkKind(mesh({ glazing: true, noOcclusion: true })), "solid");
  assert.equal(walkKind(mesh({ glazing: true }, { transmission: 1 })), "solid", "transmissive glass is a surface, not extruded pool water");
  for (const tag of ["facadeDoor", "shadowOnly", "activityProp", "action"]) assert.equal(walkKind(mesh({ [tag]: true })), null, tag);
  assert.equal(walkKind(mesh({ caveRoof: true })), "solid", "the real roof carries outdoor visitors");
  assert.equal(walkKind(mesh({ caveRoof: true }, { opacity: 1 }, { visible: false })), "solid", "hiding a cutaway never removes its support");
  const roof = { visible: false, userData: { caveRoof: true }, parent: null };
  assert.equal(walkKind(mesh({}, { opacity: 1 }, { parent: roof })), "solid", "a hidden native roof node retains its child triangles");
  roof.parent = { visible: false, userData: {}, parent: null };
  assert.equal(walkKind(mesh({}, { opacity: 1 }, { parent: roof })), null, "a hidden ancestor room still removes the whole assembly");
  assert.equal(walkKind(mesh({ caveRoof: true, walk: "through" })), null, "an explicit authored exception remains possible");
  assert.equal(walkKind(mesh({}, { opacity: 1 }, { isSkinnedMesh: true })), null);
  assert.equal(walkKind(mesh({ noOcclusion: true })), null, "effects that skip the contact pass");
  assert.equal(walkKind(mesh({}, { transparent: true, opacity: 0.2 })), null);
  assert.equal(walkKind(mesh({ walk: "through" })), null);
  assert.equal(walkKind(mesh({ walk: "water" })), "water");
  const parent = { visible: false, userData: {}, parent: null };
  assert.equal(walkKind(mesh({}, { opacity: 1 }, { parent })), null, "a hidden room is not walked yet");
});

test("soft clifftop planting permits walking while tree trunks and authored plant barriers stay solid", () => {
  const plant = (name, data = { flora: true }) => ({ isMesh: true, geometry: { attributes: { position: {} } }, material: { name }, userData: data });
  for (const name of ["sage stem wood", "coastal sage leaf", "dry coastal grass leaf", "prickly pear pad", "daisy flower"])
    assert.equal(walkKind(plant(name)), null, name);
  for (const name of ["torrey pine bark wood", "canary palm trunk"]) assert.equal(walkKind(plant(name)), "solid", name);
  assert.equal(walkKind(plant("hinterland scrub canopy", {})), null);
  assert.equal(walkKind(plant("prickly pear pad", { flora: true, walk: "solid" })), "solid");
});

test("moving neighbours: Sirui and a closed sliding door push the capsule aside", () => {
  const field = createWalkField({ min: [-4, -1, -4], max: [4, 3, 4] });
  box(field, [-4, -0.2, -4], [4, 0, 4]);
  const sirui = field.move(0, -2, 0, 0, 3, BODY, [{ x: 0, z: 0, radius: 0.42 }]);
  assert.ok(sirui.blocked && sirui.z < -(0.42 + BODY.radius) + 0.06, `${sirui.z}`);
  const door = { min: [-2, -0.05], max: [2, 0.05], bottom: 0, top: 2.2 };
  const closed = field.move(0, -1, 0, 0, 2, BODY, [door]);
  assert.ok(closed.blocked && closed.z < -0.05 - BODY.radius + 0.06, `${closed.z}`);
  // A door parked high above the walker's head is no obstacle.
  assert.equal(field.move(0, -1, 0, 0, 2, BODY, [{ ...door, bottom: 2.5, top: 3 }]).blocked, false);
});

test("findStand finds the nearest place a capsule fits on the wanted floor", () => {
  const field = room();
  const spot = field.findStand(-5.05, 0, 0);
  assert.ok(spot && spot.x >= -5 + BODY.radius - 1e-6 && spot.foot === 0, JSON.stringify(spot));
  const gallery = field.findStand(0, 4, 2.6);
  assert.ok(gallery && Math.abs(gallery.foot - 2.6) < 1e-6);
  assert.equal(field.findStand(0, -9, 0, { reach: 0.3 }), null, "outside the field");
  assert.ok(Math.abs(field.floorBelow(0, 4, 4) - 2.6) < 1e-6);
  assert.equal(field.floorBelow(0, 0, 1), 0);
});

test("the field crosses to the page as a transferable snapshot", () => {
  const built = room(),
    copy = createWalkField({ min: [-6, -2, -8], max: [6, 6, 6] });
  assert.equal(copy.load(built.snapshot()), true);
  assert.deepEqual(copy.column(4, -0.9), built.column(4, -0.9));
  assert.equal(copy.load({ lo: new Float32Array(3), hi: new Float32Array(3), count: new Uint8Array(1) }), false);
  const evidence = built.evidence();
  assert.ok(evidence.triangles > 100 && evidence.columns === 120 * 140);
});

test("keys become axes; diagonals are no faster; speeds and eases follow the input", () => {
  const axes = keyAxes(new Set(["KeyW", "KeyD", "ShiftLeft", "ArrowLeft"]));
  assert.deepEqual(axes, { strafe: 1, forward: 1, turn: 1, pitch: 0, run: true });
  const [x, y] = unitDisc(1, 1);
  assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-12);
  assert.equal(keyCode({ code: "", key: "W" }), "KeyW", "on-screen keyboards without codes");
  assert.equal(walkSpeed(1, false), WALK.walkSpeed, "full keys walk; Shift runs");
  assert.equal(walkSpeed(1, true), WALK.runSpeed);
  assert.ok(walkSpeed(0.4, false) < WALK.walkSpeed, "a half-pushed stick walks slower");
  assert.equal(walkSpeed(0.9, false), WALK.walkSpeed);
  assert.equal(easeVelocity(0, 2, 0.016, WALK.accelTau, true), 2, "reduced motion has no inertia");
  const eased = easeVelocity(0, 2, 0.016);
  assert.ok(eased > 0 && eased < 2);
});

test("starting and releasing movement cover equal distances at phone and desktop frame rates", () => {
  const run = (hz) => {
    let velocity = 0,
      distance = 0;
    for (const wanted of [WALK.walkSpeed, 0]) {
      for (let i = 0; i < hz; i++) {
        const next = integrateVelocity(velocity, wanted, 1 / hz);
        velocity = next.velocity;
        distance += next.distance;
      }
    }
    return { velocity, distance };
  };
  const baseline = run(120);
  for (const hz of [24, 30, 60]) {
    const value = run(hz);
    assert.ok(Math.abs(value.distance - baseline.distance) < 1e-12, `${hz} Hz: ${value.distance}`);
    assert.ok(Math.abs(value.velocity - baseline.velocity) < 1e-12);
  }
  assert.deepEqual(integrateVelocity(0, 2, 0.05, WALK.accelTau, true), { velocity: 2, distance: 0.1 });
});

test("directions, mouse and drag look follow the characters' facing convention", () => {
  // Facing +z (yaw 0), forward is +z and the right hand is -x, as three's camera sees it.
  assert.deepEqual(
    walkDirection(0, 0, 1).map((v) => Math.round(v * 1e9) / 1e9),
    [0, 1]
  );
  assert.deepEqual(
    walkDirection(0, 1, 0).map((v) => Math.round(v * 1e9) / 1e9),
    [-1, 0]
  );
  // The camera looks down its -z axis: at yaw 0 it must look along +z.
  const q = walkQuaternion(0, 0),
    forward = [0, 0, -1];
  const [qx, qy, qz, qw] = [q.x, q.y, q.z, q.w];
  // Rotate (0, 0, -1) by q.
  const ix = qw * forward[0] + qy * forward[2] - qz * forward[1],
    iy = qw * forward[1] + qz * forward[0] - qx * forward[2],
    iz = qw * forward[2] + qx * forward[1] - qy * forward[0],
    iw = -qx * forward[0] - qy * forward[1] - qz * forward[2];
  const rz = iz * qw + iw * -qz + ix * -qy - iy * -qx;
  assert.ok(Math.abs(rz - 1) < 1e-9, `${rz}`);
  // Mouse right turns right (yaw falls); up looks up.
  const [yaw, pitch] = mouseLook(100, -50);
  assert.ok(yaw < 0 && pitch > 0);
  // Dragging a full canvas width turns by the horizontal field of view, the world under the hand.
  const [turn] = dragLook(1600, 0, 62, 16 / 9, 900);
  const horizontal = 2 * Math.atan(Math.tan((62 * Math.PI) / 360) * (16 / 9));
  assert.ok(Math.abs(turn - horizontal) < 1e-9);
});

const config = {
  rooms: [
    { id: "study", floor: 2.6, target: [-0.35, 4.05, 3.8], camera: { yaw: 2.85, pitch: 0.24, radius: 3.9 } },
    { id: "lounge", floor: 0, target: [0.8, 1, -1.3], camera: { yaw: 3.2, pitch: 0.32, radius: 5.6 } },
    { id: "onsen", floor: 2.6, target: [3.17, 3.35, 2.85], camera: { yaw: 3.5, pitch: 0.36, radius: 3.7 } },
  ],
  facade: { planeZ: -4.48 },
  terrace: { region: { min: [-5.4, -0.6, -7.8], max: [5.4, 3.4, -4.4] } },
};

test("the walk starts in front of what the room view looks at, on that room's floor", () => {
  const plan = spawnPlan(config, { room: "study", routineRoom: "study", camera: [0.73, 4.98, 0.17] });
  assert.equal(plan.floor, 2.6);
  assert.deepEqual(plan.look, config.rooms[0].target);
  const [x, z] = plan.candidates[0];
  assert.ok(Math.abs(Math.hypot(x - -0.35, z - 3.8) - 1.7) < 1e-9, "1.7 m from the target, toward the camera");
  assert.ok(z < 3.8, "on the camera's side");
  // From the coast, the terrace, facing the house's glass front.
  const coast = spawnPlan(config, { room: "outside", routineRoom: "study", camera: [0, 20, -40] });
  assert.equal(coast.yaw, 0);
  assert.equal(coast.searchFrom, 3.4);
  // From the whole house, Sirui's room; a manifest start wins for an entrance.
  assert.equal(spawnPlan(config, { room: "overview", routineRoom: "onsen", camera: [0, 9, -18] }).room, "onsen");
  const entrance = spawnPlan({ ...config, walk: { start: { position: [1, 6.2, 9], yaw: 3.1 } } }, { room: "overview", routineRoom: "onsen" });
  assert.deepEqual(entrance.candidates, [[1, 9]]);
  assert.equal(entrance.floor, 6.2);
});

test("the authored main entrance starts Walk from every orbit view and faces down its native route", () => {
  const arrival = {
    ...config,
    entrance: {
      portal: [3.42, 7.5172, 18.55],
      route: [
        [3.42, 2.6, 8.9],
        [3.42, 7.5172, 17.86],
      ],
    },
  };
  for (const room of ["study", "onsen", "lounge", "outside", "overview", "now"]) {
    const plan = spawnPlan(arrival, { room, routineRoom: "study" });
    assert.deepEqual(plan.candidates, [[3.42, 18.55]], room);
    assert.equal(plan.floor, 7.5172);
    assert.equal(plan.yaw, Math.PI, "looks inland-to-seaward down the actual entry stair");
    assert.ok(plan.pitch < 0, "a slight downward view makes the descent visible");
    const authored = spawnPlan({ ...arrival, walk: { start: { position: [3.4, 7.52, 18.9], yaw: 3, pitch: -0.15 } } }, { room });
    assert.equal(authored.yaw, 3);
    assert.equal(authored.pitch, -0.15);
  }
});

test("a collision worker failure replays native geometry and restores walking in fallback slices", async () => {
  const previousWorker = globalThis.Worker;
  let worker;
  globalThis.Worker = class {
    constructor(url, options) {
      assert.equal(options.type, "module");
      worker = this;
    }
    postMessage() {}
    terminate() {}
  };
  let builder;
  try {
    let ready;
    const finished = new Promise((resolve) => {
      ready = resolve;
    });
    builder = createWalkFieldBuilder({ bounds: { min: [-2, -1, -2], max: [2, 3, 2] }, onReady: ready });
    const root = new THREE.Group(),
      floor = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 4), new THREE.MeshStandardMaterial());
    floor.position.y = -0.05;
    root.add(floor);
    builder.addRoots([root], root);
    assert.equal(builder.ready, false);
    builder.addRoots([new THREE.Group()], root);
    assert.equal(builder.ready, false, "an empty streamed root cannot release a pending native collision snapshot");
    worker.onerror({ preventDefault() {} });
    await finished;
    assert.equal(builder.ready, true);
    assert.equal(builder.evidence().worker, false);
    assert.ok(Math.abs(builder.field.standAt(0, 0, 0)) < 1e-6, "the original floor survives detached worker input");
    assert.equal(builder.field.move(0, 0, 0, 0.3, 0).blocked, false);
  } finally {
    builder?.dispose();
    globalThis.Worker = previousWorker;
  }
});

test("the walker's room: storey and nearest room, the terrace, and a little hysteresis", () => {
  assert.equal(roomAt(config, -0.3, 3.5, 2.6), "study");
  assert.equal(roomAt(config, 2.9, 3, 2.6), "onsen");
  assert.equal(roomAt(config, 0.5, -1, 0), "lounge");
  assert.equal(roomAt(config, 0, -6, 0), "outside");
  // Halfway between the study and the onsen, the room already entered holds.
  assert.equal(roomAt(config, 1.45, 3.3, 2.6, "study"), "study");
  assert.equal(roomAt(config, 1.45, 3.3, 2.6, "onsen"), "onsen");
  assert.equal(roomAt(config, 0, 3, 7), "outside", "the clifftop above the house");
});

test("controllers: a radial dead zone, the standard mapping and one toggle per press", () => {
  assert.deepEqual(radialDeadzone(0.1, 0.05), [0, 0]);
  const [x, y] = radialDeadzone(1, 0);
  assert.equal(x, 1);
  assert.equal(y, 0);
  const pad = {
    axes: [0, -1, 0.6, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  pad.buttons[10] = { pressed: true, value: 1 };
  const read = readGamepad(pad);
  assert.deepEqual(read.move, [0, 1], "stick up walks forward");
  assert.ok(read.look[0] > 0.5 && read.run);
  let toggle = false;
  const pads = createGamepads({
    getGamepads: () => [
      {
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 3 && toggle, value: i === 3 && toggle ? 1 : 0 })),
      },
    ],
  });
  assert.equal(pads.poll().toggled, false);
  toggle = true;
  assert.equal(pads.poll().toggled, true);
  assert.equal(pads.poll().toggled, false, "holding Y is one press");
  assert.equal(pads.connected, 1);
});

test("thumb sticks: a dead zone at rest, the rim at full deflection, up is up", () => {
  assert.deepEqual(stickVector(3, 2, 50).vector, [0, 0]);
  const full = stickVector(0, -120, 50);
  assert.deepEqual(full.knob, [0, -50], "the knob stops at the rim");
  assert.ok(Math.abs(full.vector[1] - 1) < 1e-12 && Math.abs(full.vector[0]) < 1e-12);
  const half = stickVector(25, 0, 50);
  assert.ok(half.vector[0] > 0.3 && half.vector[0] < 0.5);
});
