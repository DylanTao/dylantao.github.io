import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  envelopeFor,
  wildlifeEnvelope,
  constrainOrbit,
  keepCameraClear,
  cameraTerrainHeight,
  createCollisionGrid,
  collisionBounds,
  clearDistance,
  standDistance,
  cameraArm,
  hardArm,
  steerOrbit,
  cushion,
  farView,
  outsideClearance,
  portraitFov,
  tripodLook,
  cutawayFootprint,
  ORBIT_DIRECTION,
  BLOCKING,
  CLEARANCE,
  INSIDE,
} from "../assets/js/home-scene/camera.mjs";
import { activityPose } from "../assets/js/home-scene/activities.mjs";
import { trainingAt, sessionState } from "../assets/js/home-scene/training.mjs";
import { sessionPose } from "../assets/js/home-scene/gym-session.mjs";
const c = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));

test("the gym arrival shows the front of steady exercise poses without a clearance correction", () => {
  const room = c.rooms.find((r) => r.id === "gym"),
    { yaw, pitch, radius } = room.camera,
    position = {
      x: room.target[0] + Math.sin(yaw) * Math.cos(pitch) * radius,
      y: room.target[1] + Math.sin(pitch) * radius,
      z: room.target[2] + Math.cos(yaw) * Math.cos(pitch) * radius,
    };
  const original = { ...position };
  keepCameraClear(position, c, "gym");
  assert.deepEqual(position, original, "arrival should not jump behind a wall or the upstairs floor");
  // A squat set, a pull-up superset, a sumo set, a dip superset and a rest.
  const info = trainingAt(c.training, "2026-10-15", 1080);
  const first = (kind, lift) => info.timeline.segments.find((s) => s.kind === kind && s.lift === lift && !s.warmup);
  for (const [segment, offset] of [
    [first("set", "squat"), 2],
    [first("superset", "pullup"), 3],
    [first("set", "sumo-deadlift"), 2],
    [first("superset", "dip"), 4],
    [first("set", "squat"), -40],
  ]) {
    const pose = sessionPose({ ...info, state: sessionState(info.timeline, segment.start + offset) }, c.equipment.gym),
      dx = position.x - pose.position[0],
      dz = position.z - pose.position[2],
      front = (Math.sin(pose.facing) * dx + Math.cos(pose.facing) * dz) / Math.hypot(dx, dz);
    assert.ok(front > 0.25, `${pose.phase} should show a front three-quarter view, got ${front}`);
  }
});

test("gym orbit rays dolly before the physical wall and slab without a discontinuous clearance jump", () => {
  const room = c.rooms.find((r) => r.id === "gym"),
    envelope = envelopeFor(c, "gym");
  for (let yaw = envelope.yaw[0]; yaw <= envelope.yaw[1]; yaw += 0.01) {
    for (const pitch of [0.12, 0.3, 0.62]) {
      for (const requestedRadius of [4.056, 5.2, 6.136, 100]) {
        const orbit = constrainOrbit({ yaw, pitch, radius: requestedRadius }, envelope),
          position = {
            x: room.target[0] + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.radius,
            y: room.target[1] + Math.sin(orbit.pitch) * orbit.radius,
            z: room.target[2] + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.radius,
          },
          before = { ...position };
        keepCameraClear(position, c, "gym");
        assert.deepEqual(position, before, `clearance should never relocate yaw ${yaw}`);
        assert.ok(orbit.radius >= envelope.radius[0]);
        const next = constrainOrbit({ yaw: yaw + 0.001, pitch, radius: requestedRadius }, envelope),
          distance = Math.hypot(
            Math.sin(next.yaw) * Math.cos(next.pitch) * next.radius - (position.x - room.target[0]),
            Math.sin(next.pitch) * next.radius - (position.y - room.target[1]),
            Math.cos(next.yaw) * Math.cos(next.pitch) * next.radius - (position.z - room.target[2])
          );
        assert.ok(distance < 0.012, `nearby orbit rays stay continuous, got ${distance}`);
      }
    }
  }
});
test("the coast and the whole house orbit freely, room arrivals keep authored arcs, input extremes stay in bounds", () => {
  for (const id of ["outside", "overview", ...c.rooms.map((r) => r.id)]) {
    const envelope = envelopeFor(c, id);
    assert.ok(envelope);
    if (id === "outside" || id === "overview") assert.equal(envelope.yaw, null, `${id} yaw is free; the cliff, not an arc, ends the orbit`);
    for (const yaw of [-100, -Math.PI, 0, Math.PI, 100])
      for (const pitch of [-10, 0, 10])
        for (const radius of [-1, 1, 1000]) {
          const v = constrainOrbit({ yaw, pitch, radius }, envelope);
          assert.ok(v.pitch >= envelope.pitch[0] && v.pitch <= envelope.pitch[1]);
          assert.ok(v.radius >= envelope.radius[0] && v.radius <= envelope.radius[1]);
          if (!envelope.yaw) assert.equal(v.yaw, yaw);
          else assert.ok(v.yaw >= envelope.yaw[0] && v.yaw <= envelope.yaw[1]);
        }
  }
  // Sirui, 2026-10-15: "allow bigger zoom out".
  assert.equal(envelopeFor(c, "outside").radius[1], 160);
  assert.ok(envelopeFor(c, "outside").pitch[1] < Math.PI / 2 - 0.2, "the coast never looks straight down a degenerate up vector");
});

// ---------------------------------------------------------------------------------------------
// Collision field, spring arm and steering (October 15) on synthetic geometry.
function quad(grid, a, b, d, e) {
  grid.addTriangle(...a, ...b, ...d);
  grid.addTriangle(...a, ...d, ...e);
}
function box(grid, [x0, y0, z0], [x1, y1, z1]) {
  quad(grid, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]);
  quad(grid, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  quad(grid, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
  quad(grid, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]);
  quad(grid, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  quad(grid, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]);
}
// An indexed box, as one connected piece, for the structure/detail sort.
function indexedBox([x0, y0, z0], [x1, y1, z1]) {
  const positions = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y1, z0],
    [x0, y1, z0],
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
  ];
  const faces = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return {
    position: (i, out) => out.splice(0, 3, ...positions[i]),
    count: 8,
    index: Uint16Array.from(faces),
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  };
}
// A 6 x 3 x 6 m room: three walls, a floor, a 4 cm rail through the middle, a 0.5 m pillar.
function room() {
  const grid = createCollisionGrid({ min: [-4, -1, -4], max: [4, 4, 4], cell: 0.12, seeds: [[0, 1.2, 0]] });
  box(grid, [-3.2, 0, -3.2], [-3, 3, 3.2]);
  box(grid, [3, 0, -3.2], [3.2, 3, 3.2]);
  box(grid, [-3.2, 0, 3], [3.2, 3, 3.2]);
  box(grid, [-3.2, -0.2, -3.2], [3.2, 0, 3.2]);
  box(grid, [-0.02, 0.9, -2], [0.02, 0.94, 2]);
  box(grid, [1.5, 0, 1.5], [2.0, 2.5, 2.0]);
  grid.finish();
  return grid;
}

test("the collision field blocks walls, floors and solid furniture, never a lone rail", () => {
  const grid = room();
  assert.equal(grid.flagAt(3.02, 1.5, 0), BLOCKING, "wall");
  assert.equal(grid.flagAt(0, -0.02, 0), BLOCKING, "floor");
  assert.equal(grid.flagAt(1.5, 1.2, 1.75), BLOCKING, "pillar");
  assert.equal(grid.flagAt(0, 0.92, 0), 0, "a 4 cm rail is thin: the camera never dollies in front of it");
  assert.equal(grid.flagAt(2.85, 1.5, 0), CLEARANCE, "a clearance shell keeps the near plane off the wall");
  // A ray across the rail keeps going to the far wall's clearance shell.
  const across = clearDistance(grid, null, [0, 1.2, 0], [-Math.cos(0.1), -Math.sin(0.1), 0], 10);
  assert.ok(across > 2.5 && across < 3, `rail ignored, wall respected: ${across}`);
  assert.equal(clearDistance(grid, null, [0, 1.2, 0], [0, 0, -1], 10), 10, "the open side is unlimited");
});

test("a camera rests only in free space; a path may graze a surface without stopping", () => {
  const grid = room();
  // From a target 0.2 m from the wall (inside its clearance shell) the ray out into the room keeps
  // its full length, and the ray into the wall stops before it.
  assert.equal(clearDistance(grid, null, [2.8, 1.5, 0], [-1, 0, 0], 3), 3);
  assert.ok(clearDistance(grid, null, [2.8, 1.5, 0], [1, 0, 0], 3) < 0.2);
  // Passing 0.2 m beside the pillar (through its clearance shell) to free space beyond it.
  assert.equal(grid.flagAt(1.3, 1.2, 1.75), CLEARANCE);
  assert.equal(clearDistance(grid, null, [1.3, 1.2, 0], [0, 0, 1], 2.5), 2.5);
  // A target inside a solid (a view passing through a screen while it changes rooms) walks out.
  assert.ok(clearDistance(grid, null, [1.75, 1.2, 1.75], [-1, 0, 0], 2) > 1);
});

test("air floods from the authored points; a solid's inside is never a place to stand", () => {
  const grid = createCollisionGrid({ min: [-2, -1, -2], max: [5, 4, 5], cell: 0.12, seeds: [[0, 1, 0]] });
  box(grid, [-1.8, -0.2, -1.8], [4.8, 0, 4.8]); // floor
  box(grid, [1, 0, 1], [3, 2, 3]); // a closed block of rock
  grid.finish();
  assert.equal(grid.flagAt(2, 1, 2), INSIDE, "the block's core is solid inside");
  assert.equal(grid.flagAt(0, 1, 0), 0, "the seeded room is air");
  assert.ok(grid.evidence().inside > 0);
  // Looking across the block from the room is allowed for the whole-house view, standing inside it is not.
  const d = [Math.SQRT1_2, 0, Math.SQRT1_2];
  assert.ok(standDistance(grid, null, [0, 1, 0], d, 2.8) < 1.3, "a stand inside the block retreats to the room");
  assert.ok(standDistance(grid, null, [0, 1, 0], d, 5.3) > 5, "beyond the block is open air again");
  // The visible-path arm never passes through the block.
  assert.ok(clearDistance(grid, null, [0, 1, 0], d, 5.3) < 1.3);
});

test("detail beside the target never boxes the camera in; a dense canopy still blocks", () => {
  const grid = createCollisionGrid({ min: [-3, -1, -3], max: [3, 3, 3], cell: 0.12 });
  // A desk top (structure) with a laptop-sized box on it, right under the target.
  grid.addGeometry(indexedBox([-0.8, 0.7, -0.4], [0.8, 0.74, 0.4]));
  grid.addGeometry(indexedBox([-0.17, 0.74, -0.35], [0.17, 0.98, -0.33]));
  // A dense cluster of small leaves (detail) to one side.
  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 9; j++)
      for (let k = 0; k < 9; k++) {
        const x = 1.6 + i * 0.09,
          y = 0.6 + j * 0.09,
          z = -0.4 + k * 0.09;
        grid.addGeometry(indexedBox([x, y, z], [x + 0.05, y + 0.005, z + 0.05]));
      }
  grid.finish();
  const target = [0, 1.05, 0];
  // Toward the laptop (front, slightly down) the camera is not pinned to the target.
  const forward = ORBIT_DIRECTION(Math.PI, -0.1);
  assert.ok(clearDistance(grid, null, target, forward, 2.5) > 2, "the laptop is detail");
  assert.equal(grid.flagAt(2, 1, 0), BLOCKING, "a dense canopy blocks");
  assert.ok(clearDistance(grid, null, target, [1, 0, 0], 3) < 1.6);
});

test("the spring arm keeps authored views whole, stops at walls, and slides past edges without jumping far", () => {
  const grid = room();
  const target = [0, 1.2, 0];
  assert.equal(cameraArm(grid, null, target, Math.PI, 0.3, 2.5), 2.5, "an open view keeps its radius");
  const wall = cameraArm(grid, null, target, Math.PI / 2, 0.1, 5);
  assert.ok(wall > 2 && wall < 2.9, `the arm stops short of the +x wall: ${wall}`);
  assert.ok(hardArm(grid, null, target, Math.PI / 2, 0.1, 5) >= wall, "the hard limit is never inside the soft one");
  let previous = null,
    largest = 0;
  for (let yaw = 0; yaw < Math.PI * 2; yaw += 0.01) {
    const arm = cameraArm(grid, null, target, yaw, 0.2, 4);
    if (previous !== null) largest = Math.max(largest, Math.abs(arm - previous));
    previous = arm;
  }
  assert.ok(largest < 1.6, `the cone spreads an edge over several steps (largest ${largest.toFixed(2)} m); the controller smooths the rest`);
});

test("steering slides along an obstacle, stops short of it, and never traps a cramped view", () => {
  // A wall that leaves only yaws below 1 open: the arm is short beyond it.
  const armAt = (yaw, pitch) => (yaw > 1 ? 0.5 : 4) + pitch * 0;
  const slide = steerOrbit(armAt, { yaw: 0.9, pitch: 0.2 }, { yaw: 1.2, pitch: 0.5 }, 1.5);
  assert.deepEqual([slide.yaw, slide.pitch, slide.blocked], [0.9, 0.5, true], "pitch moves on, yaw stays at the wall");
  const stop = steerOrbit(armAt, { yaw: 0.5, pitch: 0.2 }, { yaw: 1.4, pitch: 0.2 }, 1.5);
  assert.ok(stop.yaw > 0.95 && stop.yaw <= 1, `stops short of the wall: ${stop.yaw}`);
  // Already cramped (an arrival before the field was ready): moving to an equally short or
  // better arm is allowed, so the visitor can always back out.
  const out = steerOrbit((yaw) => (yaw < 1.3 ? 4 : 0.5), { yaw: 1.5, pitch: 0.2 }, { yaw: 1.4, pitch: 0.2 }, 1.5);
  assert.equal(out.yaw, 1.4);
});

test("a cushioned envelope edge slows input and never passes the limit", () => {
  assert.equal(cushion(0, 0.1, [-1, 1]), 0.1, "far from an edge, input is exact");
  const near = cushion(0.95, 0.1, [-1, 1]);
  assert.ok(near > 0.95 && near <= 1 && near < 1.05, `near the edge the step shrinks: ${near}`);
  assert.equal(cushion(1, 0.3, [-1, 1]), 1);
  assert.equal(cushion(0.5, 0.2, null), 0.7, "a free axis is untouched");
});

test("the far view keeps the authored haze to 48 m and hides the sea plane's edge at 160 m", () => {
  for (const r of [0, 24, 48]) assert.deepEqual(farView(r), { fogNear: 65, fogFar: 180, far: 300, near: 0.05 });
  const wide = farView(160, 6);
  // Any sea-plane edge the 160 m camera can see lies beyond the house plus 170 m of sea.
  assert.ok(wide.fogFar <= 160 + 170, `fully hazed before the 400 m sea plane ends: ${wide.fogFar}`);
  assert.ok(wide.fogNear > 160, "the house itself stays clear");
  assert.ok(wide.far > wide.fogFar && wide.near > 0.05 && wide.near <= 6 * 0.45);
  assert.ok(outsideClearance(160) > outsideClearance(48) && outsideClearance(10) === 0.6);
});

test("the field covers every room in the manifest, including one added later, and the roof footprint opens the whole house", () => {
  const bounds = collisionBounds(c);
  for (const r of c.rooms) for (let k = 0; k < 3; k++) assert.ok(r.target[k] > bounds.min[k] + 2 && r.target[k] < bounds.max[k] - 2);
  const added = collisionBounds({ ...c, rooms: [...c.rooms, { id: "new", target: [7.2, 1.1, -1.5] }] });
  assert.ok(added.max[0] >= 7.2 + 4, "a room north of the lounge extends the field");
  const footprint = cutawayFootprint([
    { min: [-5.65, 3.9, -7.19], max: [5.65, 8.17, 5.35] },
    { min: [0.69, 7.09, 2.46], max: [2.16, 7.37, 3.9] },
  ]);
  assert.deepEqual(footprint, { min: [-5.65, -7.19], max: [5.65, 5.35] });
  // The whole-house arrival leans over the cut-away roof unobstructed; low views past the cave
  // mouth into the cliff, or behind a headland, are held well short of the default 18.5 m (the
  // controller refuses any orbit shorter than 40% of the requested distance), and from above the
  // house opens all round.
  const o = c.views.overview,
    house = { footprint, stand: true };
  assert.equal(cameraArm(null, c.cameraCollision, o.target, o.yaw, o.pitch, o.radius, house), o.radius);
  for (const [yaw, pitch] of [
    [3.96, 0.25],
    [2.38, 0.25],
    [1.6, 0.3],
  ])
    assert.ok(cameraArm(null, c.cameraCollision, o.target, yaw, pitch, 25, house) < 25 * 0.4, `yaw ${yaw} pitch ${pitch} is refused`);
  for (const yaw of [0, 1.6, 3.2, 4.8]) assert.equal(cameraArm(null, c.cameraCollision, o.target, yaw, 1.2, 18.5, house), 18.5);
});
test("once the voxel field keeps the camera clear, the old wall boxes no longer move it; the glass rule stays", () => {
  const wall = c.cameraCollision.walls[1],
    beside = { x: wall.max[0] + 0.2, y: 1.5, z: 0 };
  const boxed = { ...beside };
  keepCameraClear(boxed, c, "lounge");
  assert.notDeepEqual(boxed, beside, "the box proxy teleports a camera near the old east wall");
  const field = { ...beside };
  keepCameraClear(field, c, "lounge", { walls: false });
  assert.deepEqual(field, beside, "a room beyond that wall keeps its camera");
  const pane = { x: 0, y: 1.5, z: c.cameraCollision.facade.planeZ + 0.02 };
  keepCameraClear(pane, c, "kitchen", { walls: false });
  assert.ok(Math.abs(pane.z - c.cameraCollision.facade.planeZ) >= c.cameraCollision.facade.clearance - 1e-9);
});

test("a rear exterior near plane is lifted out of the actual mainland surface", () => {
  const p = { x: 0, y: 0, z: 15 };
  keepCameraClear(p, c, "outside");
  assert.ok(p.y >= cameraTerrainHeight(0, 15, c.cameraCollision) + c.cameraCollision.clearance - 0.000001);
});

test("the actual beach and open sea do not inherit the mainland height fallback", () => {
  assert.ok(cameraTerrainHeight(-10, -16, c.cameraCollision) < -6, "sea lion beach is below the occupied home");
  assert.ok(cameraTerrainHeight(-10, 5, c.cameraCollision) > 8, "finished inland cliff remains solid");
  assert.ok(Math.abs(cameraTerrainHeight(0, -27, c.cameraCollision) + 7.35) < 0.001, "empty ocean uses its mean surface");
  const camera = { x: -10, y: -10, z: -16 };
  keepCameraClear(camera, c, "outside");
  assert.ok(camera.y < -6 && camera.y > -7.4, "clearance stays near the beach instead of lifting to phantom mainland");
});

test("explicit wildlife inspection allows a nearby full orbit while retaining terrain clearance", () => {
  for (const size of [0.3, 0.6, 1.4, NaN]) {
    const envelope = wildlifeEnvelope(size);
    const orbit = constrainOrbit({ yaw: -5.7, pitch: -2, radius: 0.1 }, envelope);
    assert.equal(orbit.yaw, -5.7);
    assert.ok(orbit.radius >= 1.8 && orbit.radius < envelopeFor(c, "outside").radius[0]);
    const position = { x: 0, y: -50, z: 15 };
    keepCameraClear(position, c, "outside");
    assert.ok(position.y >= cameraTerrainHeight(0, 15, c.cameraCollision) + c.cameraCollision.clearance);
  }
});
test("the coffee sequence has approaches, rests and equipment contacts", () => {
  const phases = new Set();
  for (const [name, id] of [["coffee", "kitchen"]]) {
    const room = c.rooms.find((r) => r.id === id);
    for (let t = 0; t < 100; t += 0.25) {
      const p = activityPose(name, t, c.equipment, room);
      assert.ok(p.position.every(Number.isFinite));
      phases.add(p.phase);
    }
  }
  for (const phase of ["grind", "brew", "pick up", "carry", "set down", "return cup"]) assert.ok(phases.has(phase));
});

test("a portrait canvas widens the lens to keep the authored horizontal coverage", () => {
  const horizontal = (fov, aspect) => (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect) * 180) / Math.PI;
  // Every page embed is landscape and keeps the authored lens.
  for (const aspect of [1, 1.1, 1.6, 2.4]) assert.equal(portraitFov(38, aspect), 38);
  // A phone in full screen (390 x 844) sees as wide as a square canvas does.
  const phone = 390 / 844;
  const fov = portraitFov(38, phone);
  assert.ok(fov > 38 && fov < 80);
  assert.ok(Math.abs(horizontal(fov, phone) - horizontal(38, 1)) < 1e-9);
  // A sliver of a window stops at the cap instead of a fisheye.
  assert.equal(portraitFov(38, 0.1), 80);
  assert.equal(portraitFov(38, 0), 38);
});

test("the gym's tripod keeps its authored position while it turns to each station", () => {
  const config = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
  const room = config.rooms.find((r) => r.id === "gym");
  const authored = { target: room.target, ...room.camera };
  const position = ({ yaw, pitch, radius }, at) => ORBIT_DIRECTION(yaw, pitch).map((v, i) => at[i] + radius * v);
  const home = position(authored, authored.target);
  // Looking at its own target returns the authored orbit.
  const same = tripodLook(authored, authored.target);
  assert.ok(Math.abs(Math.atan2(Math.sin(same.yaw - authored.yaw), Math.cos(same.yaw - authored.yaw))) < 1e-9);
  assert.ok(Math.abs(same.pitch - authored.pitch) < 1e-9 && Math.abs(same.radius - authored.radius) < 1e-9);
  // Every station's look keeps the camera where it stands, inside the authored distance band.
  const gym = config.equipment.gym;
  const above = (spot, height) => [spot[0], spot[1] + height, spot[2]];
  for (const point of [gym.pullup.bar, above(gym.dip.actor, 1.2), above(gym.rest.actor, 0.72), above(gym.rack.bar, -0.6)]) {
    const look = tripodLook(authored, point);
    position(look, point).forEach((v, i) => assert.ok(Math.abs(v - home[i]) < 1e-9));
    assert.ok(look.radius > 2.5 && look.radius < 5.5, `radius ${look.radius}`);
  }
});
