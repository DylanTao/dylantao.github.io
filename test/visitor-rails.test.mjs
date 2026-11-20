import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createCameraField } from "../assets/js/home-scene/camera-field.mjs";
import { createCollisionGrid } from "../assets/js/home-scene/camera.mjs";
import { coastalDaylight } from "../assets/js/home-scene/daylight.mjs";
import {
  compileVisitorRail,
  createFilmScoreCue,
  createVisitorClearance,
  createVisitorRailPlayer,
  sampleVisitorShot,
} from "../assets/js/home-scene/visitor-rails.mjs";
import { FILM_STAIR_EYE, visitorRailRegions, visitorRailShots } from "../assets/js/home-scene/visitor-rail-shots.mjs";

const makeShot = (id, points, extra = {}) => ({
  id,
  caption: id,
  room: "lounge",
  minute: 600,
  duration: 4,
  fov: 39,
  keys: points.map((eye, i) => ({ at: points.length > 1 ? i / (points.length - 1) : 0, eye, target: [0, 1.4, 3.3] })),
  ...extra,
});
const openGrid = () => createCollisionGrid({ min: [-6, -2, -6], max: [6, 5, 6], cell: 0.12 });

test("the coast, lift and rower find the photographed light in each season while breakfast keeps its hour", () => {
  const house = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
  const program = (date) => {
    const { shots, boat } = visitorRailShots(house, date);
    return Object.fromEntries([...shots, ...boat].map((shot) => [shot.id, [shot.minute].flat()]));
  };
  const studyDate = "2026-11-20";
  const study = program(studyDate);
  for (const date of ["2026-03-08", "2026-06-21", "2026-11-01", "2026-12-21"]) {
    const run = program(date);
    for (const cut of ["coast-dawn", "training", "glass-lift", "coast-dusk", "boat-west", "boat-east"]) {
      for (const [i, time] of run[cut].entries()) {
        const target = coastalDaylight(studyDate, study[cut][i]).altitude;
        assert.ok(Math.abs(coastalDaylight(date, time).altitude - target) < 0.13, `${cut} on ${date}`);
      }
    }
    assert.deepEqual(run.breakfast, study.breakfast);
    assert.deepEqual(run["coast-night"], study["coast-night"]);
    assert.ok(run["coast-dusk"][0] < run["coast-dusk"][1]);
  }
  assert.ok(program("2026-06-21")["glass-lift"][0] > study["glass-lift"][0] + 150);
});

test("an empty film can be ticked or scrubbed before any shot is admitted", () => {
  const player = createVisitorRailPlayer({ shots: [], duration: 0 }, {}, { film: true });
  assert.equal(player.tick(0.8), null);
  assert.equal(player.seek(0), false);
  assert.equal(player.state.shot, null);
});

test("admitting a rail tests the real occupancy at the start and every segment", () => {
  const grid = openGrid();
  grid.addSolid([-0.2, 0.0, -0.4], [0.2, 2.6, 0.4]);
  grid.finish();
  const clearance = createVisitorClearance({ grid });
  const route = [
    [-1.4, 1.6, 0],
    [-1.4, 1.6, 1.2],
    [1.8, 1.6, 1.2],
  ];
  const film = compileVisitorRail(
    [
      makeShot("inside", [
        [0, 1.6, 0],
        [2.2, 1.6, 0],
      ]),
      makeShot("through", [
        [-1.4, 1.6, 0],
        [1.8, 1.6, 0],
      ]),
      makeShot("clear-turn", route),
    ],
    {},
    clearance
  );
  assert.equal(film.shots.length, 1);
  assert.deepEqual(
    film.shots[0].keys.map((key) => key.eye),
    route
  );
  assert.deepEqual(
    film.rejected.map((q) => [q.shot, q.reason]),
    [
      ["inside", "camera-field"],
      ["through", "camera-field"],
    ]
  );
  assert.deepEqual(sampleVisitorShot(film.shots[0], 0.5).eye, route[1]);
  const player = createVisitorRailPlayer(film, clearance);
  for (let i = 0; i < 23; i++) player.tick(0.17);
  assert.equal(player.state.obstruction, null);
  assert.equal(player.state.paused, false);
  player.tick(0.17);
  assert.deepEqual(player.pose.eye, route[2]);
  assert.equal(player.state.paused, true);
});

test("keys resolve manifest places and keep the camera on validated lines", () => {
  const grid = openGrid();
  grid.finish();
  const clearance = createVisitorClearance({ grid });
  const shot = makeShot("door", [{ anchor: "door", offset: [0, 1.6, 0] }, [1.2, 1.6, 2.2]]);
  const film = compileVisitorRail(
    [shot, { ...shot, id: "missing", keys: [{ at: 0, eye: { anchor: "missing" }, target: [0, 1, 0], fov: 34 }] }],
    { door: [0, 0, 2.2] },
    clearance
  );
  assert.deepEqual(film.shots[0].keys[0].eye, [0, 1.6, 2.2]);
  assert.equal(film.rejected[0].reason, "invalid-shot");
  assert.equal(sampleVisitorShot(film.shots[0], 0.1).eye[2], 2.2);
  assert.ok(sampleVisitorShot(film.shots[0], 0.1).eye[0] < 0.12, "ease in at an ordinary speed");
});

test("pause, bounded time, skip, scrub and reduced motion share one clock", () => {
  const grid = openGrid();
  grid.finish();
  const clearance = createVisitorClearance({ grid });
  const film = compileVisitorRail(
    [
      makeShot("one", [
        [0, 1.6, 0],
        [3, 1.6, 0],
      ]),
      makeShot(
        "two",
        [
          [-2, 1.6, 0],
          [-2, 1.6, 2],
        ],
        { minute: [620, 664] }
      ),
    ],
    {},
    clearance
  );
  const player = createVisitorRailPlayer(film, clearance);
  player.tick(9);
  assert.equal(player.state.seconds, 0.25);
  const screening = createVisitorRailPlayer(film, clearance, { film: true });
  screening.tick(0.8);
  assert.equal(screening.state.seconds, 0.8, "a slow display preserves the scored film clock");
  screening.seek(3.75);
  screening.tick(0.8);
  assert.equal(screening.state.shot, "two");
  assert.ok(Math.abs(screening.state.shotSeconds - 0.55) < 1e-8);
  screening.tick(9);
  assert.ok(Math.abs(screening.state.shotSeconds - 0.8) < 1e-8, "an interrupted clock resumes in a bounded step");
  player.pause();
  player.tick(0.5);
  assert.equal(player.state.seconds, 0.25);
  assert.equal(player.skip(), true);
  assert.equal(player.state.seconds, 4);
  assert.equal(player.pose.shot, "two");
  assert.equal(player.seek(7), true);
  assert.equal(player.pose.minute, 653);
  player.reduce(true);
  assert.deepEqual(player.pose.eye, [-2, 1.6, 1]);
  assert.equal(player.pose.minute, 642);
  player.pause(false);
  player.tick(5);
  assert.equal(player.state.seconds, 7);
  assert.equal(player.skip(-1), true);
  assert.deepEqual(player.pose.eye, [1.5, 1.6, 0]);
  player.reduce(false);
  assert.equal(player.state.paused, true);
  assert.deepEqual(player.pose.eye, [0, 1.6, 0]);
});

test("a moving door stops before contact and a blocked destination is never shown", () => {
  const grid = openGrid();
  grid.finish();
  let dynamic = [];
  const clearance = createVisitorClearance({ grid, blockers: () => dynamic });
  const film = compileVisitorRail(
    [
      makeShot("moving", [
        [-1.4, 1.6, 0],
        [1.6, 1.6, 0],
      ]),
      makeShot("blocked-still", [[0, 1.6, 0]]),
    ],
    {},
    clearance
  );
  const player = createVisitorRailPlayer(film, clearance);
  player.tick(0.25);
  dynamic = [{ min: [-0.035, 0, -0.5], max: [0.035, 2.4, 0.5] }];
  for (let i = 0; i < 20; i++) player.tick(0.19);
  assert.ok(player.pose.eye[0] < -0.205);
  assert.equal(player.state.paused, true);
  assert.equal(player.state.obstruction.reason, "moving-obstacle");
  assert.equal(player.skip(), false);
  assert.equal(player.pose.shot, "moving");
  dynamic = [];
  assert.equal(player.skip(), true);
  assert.equal(player.pose.shot, "blocked-still");
});

test("boat clearance samples Pacific waves and the real seabed under its width", () => {
  const grid = openGrid();
  grid.finish();
  let dryEdge = false;
  const clearance = createVisitorClearance({
    grid,
    waterAt: () => ({ y: 0 }),
    seabedAt: (_x, z) => ({ height: dryEdge && z >= 0.43 ? -0.25 : -1.1 }),
  });
  const leg = makeShot(
    "shore",
    [
      [-4, 1.65, 0],
      [4, 1.65, 0],
    ],
    { kind: "boat" }
  );
  assert.equal(compileVisitorRail([leg], {}, clearance).shots.length, 1);
  const player = createVisitorRailPlayer(compileVisitorRail([leg], {}, clearance), clearance);
  dryEdge = true;
  assert.equal(compileVisitorRail([leg], {}, clearance).rejected[0].reason, "water-depth");
  player.tick(0.17);
  assert.equal(player.state.obstruction.reason, "water-depth");
  assert.deepEqual(player.pose.eye, [-4, 1.65, 0]);
});

test("a field worker rounds the same original authored bounds as the caller", () => {
  const previous = globalThis.Worker;
  let worker;
  let start;
  globalThis.Worker = class {
    constructor(_url, options) {
      assert.equal(options.type, "module");
      worker = this;
    }
    postMessage(message) {
      start = message;
    }
    terminate() {}
  };
  try {
    const grid = { min: [-3.85, -0.35, 15.65], max: [3.75, 10.58, 23.1], cell: 0.12 };
    let ready = false;
    const host = createCameraField({
      config: { cameraCollision: { grid } },
      world: {},
      onReady: () => {
        ready = true;
      },
    });
    const workerGrid = createCollisionGrid(start.bounds);
    workerGrid.finish();
    worker.onmessage({ data: { type: "field", flags: workerGrid.flags(), evidence: workerGrid.evidence() } });
    assert.deepEqual(workerGrid.size, [64, 92, 63]);
    assert.ok(ready && host.ready);
    host.dispose();
  } finally {
    if (previous) globalThis.Worker = previous;
    else delete globalThis.Worker;
  }
});

test("an authored local field admits an excavated wing and still rejects its solids", () => {
  const grid = openGrid();
  grid.finish();
  const wing = createCollisionGrid({ min: [-10, -2, 1], max: [-7, 5, 5], cell: 0.12 });
  wing.addSolid([-9.85, 0, 1.85], [-9.55, 2.4, 2.15]);
  wing.finish();
  const condition = createVisitorClearance({
    grid,
    regions: [wing],
    terrain: { origin: [-40, -40], step: 30, width: 3, height: 3, elevations: Array(9).fill(8) },
  });
  assert.equal(condition([-8.3, 1.6, 3.2]), null);
  assert.equal(condition([-9.7, 1.6, 2]), "camera-field");
  assert.equal(condition([-11, 1.6, 3.2]), "terrain");
});

test("the packed straight-arrival film follows the public Walk floor positions", () => {
  const config = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
  const plan = visitorRailShots(config);
  const arrival = plan.shots.find((shot) => shot.id === "arrival");
  assert.equal(arrival.keys.length, config.walk.mainEntryRoute.length);
  assert.equal(arrival.keys[0].at, 0);
  assert.equal(arrival.keys.at(-1).at, 1);
  const [hall, listening] = visitorRailRegions(config);
  assert.equal(listening, config.visitorFilm.collisionRegions[1]);
  for (const [i, key] of arrival.keys.entries()) {
    const [x, floor, z] = config.walk.mainEntryRoute[i];
    assert.deepEqual(key.eye, [x, floor + FILM_STAIR_EYE, z]);
    assert.ok(key.eye.every((value, axis) => value > hall.min[axis] && value < hall.max[axis]));
    if (i) assert.ok(key.at > arrival.keys[i - 1].at);
  }
  const [x, floor, z] = config.walk.places.speakeasy.position;
  assert.deepEqual(plan.shots.find(({ id }) => id === "listening-room").keys[0].eye, [x, floor + 1.6, z]);
  assert.ok(
    plan.shots.some(({ id }) => id === "dining-terrace"),
    "the fitted study-side dining has its own view"
  );
  assert.ok(compileVisitorRail(plan.shots, plan.landmarks, () => null).shots.some(({ id }) => id === "arrival"));
});

test("film score cues report cuts and scrubs once and keep paused previews silent", () => {
  const events = [];
  const signal = createFilmScoreCue((event) => events.push(event));
  const dawn = { shot: "coast-dawn", seekVersion: 1 };
  const stair = { shot: "arrival", seekVersion: 1 };
  signal.update("paint", false);
  signal.update("realistic", false);
  signal.stop("realistic");
  assert.deepEqual(events, []);
  signal.update("realistic", true, dawn);
  signal.update("realistic", true, dawn);
  signal.update("realistic", true, stair);
  signal.update("realistic", true, { ...stair, seekVersion: 2 });
  signal.update("paint", true, { ...stair, seekVersion: 2 });
  signal.update("paint", false);
  signal.update("realistic", false);
  signal.update("paint", false);
  signal.update("realistic", true, dawn);
  signal.stop("realistic");
  signal.stop("realistic");
  assert.deepEqual(events, [
    { kind: "film", action: "start", look: "realistic" },
    { kind: "film", action: "cut", look: "realistic" },
    { kind: "film", action: "seek", look: "realistic" },
    { kind: "film", action: "look", look: "paint" },
    { kind: "film", action: "pause", look: "paint" },
    { kind: "film", action: "start", look: "realistic" },
    { kind: "film", action: "stop", look: "realistic" },
  ]);
});
