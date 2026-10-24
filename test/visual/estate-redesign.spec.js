const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test, expect } = require("@playwright/test");
const { preparePage, collectRuntimeErrors } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const { pauseSceneClock, useSoftwareSceneCadence } = require("./scene-clock");

const ROOT = path.resolve(__dirname, "../..");
const manifest = () => JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/home/manifest.json"), "utf8"));
const moduleAt = (relative) => import(pathToFileURL(path.join(ROOT, relative)).href);
const software = process.platform === "linux" || process.env.VISUAL_TRANSPORT_SOFTWARE === "1";
const stateOf = (scene) => scene.evaluate((element) => element.getSceneEvidence());

async function deliveredField(config) {
  const [{ BODY, createWalkField, walkKind, WATER_BLOCK }, { nativeGeometry }] = await Promise.all([
    moduleAt("assets/js/home-scene/colliders.mjs"),
    moduleAt("test/helpers/coastal-native-geometry.mjs"),
  ]);
  const field = createWalkField(config.walk.region);
  const files = new Set([config.shell, config.coast, config.flora, config.hinterland?.file, ...config.rooms.map((room) => room.file)]);
  const hiddenStructure = [];
  const movingLeaves = [];
  for (const file of files) {
    if (!file) continue;
    const root = await nativeGeometry(file);
    root.traverse((object) => {
      if (object.userData.caveRoof || object.userData.roomCeilingFor || object.userData.bathroomCeilingFor) {
        object.visible = false;
        hiddenStructure.push(object.name);
      }
    });
    root.traverse((object) => {
      const kind = walkKind(object, root);
      let architectural = false;
      let moving = false;
      for (let node = object; node && node !== root; node = node.parent) {
        architectural ||= Boolean(node.userData.caveRoof || node.userData.roomCeilingFor || node.userData.bathroomCeilingFor);
        moving ||= Boolean(node.userData.estateDoor);
      }
      if (object.isMesh && architectural) expect(kind, `${object.name}: cutaway support remains physical`).toBe("solid");
      if (object.isMesh && moving) {
        expect(kind, `${object.name}: a moved leaf cannot leave a static voxel wall`).toBeNull();
        movingLeaves.push(object.name);
      }
      if (!kind) return;
      field.addGeometry({
        positions: object.geometry.attributes.position.array,
        index: object.geometry.index?.array || null,
        matrix: object.matrixWorld.elements,
        extrude: kind === "water" ? WATER_BLOCK : 0,
      });
    });
  }
  expect(hiddenStructure.length).toBeGreaterThan(5);
  expect(movingLeaves.length).toBeGreaterThanOrEqual(4);
  return { field, BODY, hiddenStructure, movingLeaves };
}

function traverse(field, BODY, points, label, body = BODY) {
  expect(points?.length, `${label}: complete authored route`).toBeGreaterThanOrEqual(2);
  const [x, floor, z] = points[0];
  let state = field.findStand(x, z, floor, { reach: 0.08, tolerance: 0.08, body });
  expect(state, `${label}: actual native starting support at ${JSON.stringify(points[0])}`).toBeTruthy();
  expect(Math.hypot(state.x - x, state.z - z), `${label}: no displaced starting point`).toBeLessThan(0.06);
  let travelled = 0;
  let maximumRise = 0;
  for (const target of points.slice(1)) {
    let remaining = Math.hypot(target[0] - state.x, target[2] - state.z);
    for (let step = 0; remaining > 0.035 && step < 1200; step++) {
      const before = state;
      const stride = Math.min(0.035, remaining);
      state = field.move(
        state.x,
        state.z,
        state.foot,
        ((target[0] - state.x) * stride) / remaining,
        ((target[2] - state.z) * stride) / remaining,
        body
      );
      expect(state.moved, `${label}: blocked before ${JSON.stringify(target)} at ${JSON.stringify(state)}`).toBeGreaterThan(1e-5);
      maximumRise = Math.max(maximumRise, Math.abs(state.foot - before.foot));
      travelled += state.moved;
      remaining = Math.hypot(target[0] - state.x, target[2] - state.z);
    }
    expect(remaining, `${label}: reached ${JSON.stringify(target)}`).toBeLessThanOrEqual(0.035);
    expect(Math.abs(state.foot - target[1]), `${label}: Y follows real triangles, never injected route height`).toBeLessThan(0.2);
  }
  expect(maximumRise, `${label}: no vertical teleport`).toBeLessThanOrEqual(BODY.maxStep + 0.015);
  return { position: [state.x, state.foot, state.z], travelled, maximumRise };
}

// Find the real walkable route around the retained fire nook, rather than asking
// visitors to walk through its seats. Every graph edge uses the actual capsule
// solver and stays inside the broad dry strip behind the basin.
function dryPromenade(field, BODY, config) {
  const deck = config.estateOutdoors.terrace.bounds;
  const pool = config.estateOutdoors.pool.bounds;
  const pavilion = config.estateOutdoors.pavilion.bounds;
  const body = { ...BODY, radius: Math.max(BODY.radius, 0.28) };
  const cell = 0.14;
  const x0 = deck.x[0] + 0.5;
  const x1 = Math.min(deck.x[1] - 0.5, pavilion.x[0] + 1.25);
  const z0 = -(pool.y[0] - 0.35);
  const z1 = -(deck.y[0] + 0.4);
  const nx = Math.floor((x1 - x0) / cell);
  const nz = Math.floor((z1 - z0) / cell);
  const queue = [];
  const seen = new Set();
  for (let iz = 0; iz <= nz; iz++) {
    const start = field.findStand(x0, z0 + iz * cell, deck.floor, { reach: 0, tolerance: 0.08, body });
    if (start) {
      queue.push({ ix: 0, iz, state: start, parent: null });
      seen.add(`0,${iz}`);
    }
  }
  expect(queue.length, "the new west deck has a real, dry starting place").toBeGreaterThan(0);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const node = queue[cursor];
    if (node.ix === nx) {
      const points = [];
      for (let at = node; at; at = at.parent) points.push([at.state.x, at.state.foot, at.state.z]);
      return { points: points.reverse(), body, domain: { x: [x0, x1], z: [z0, z1] }, explored: cursor + 1 };
    }
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ]) {
      const ix = node.ix + dx;
      const iz = node.iz + dz;
      const key = `${ix},${iz}`;
      if (ix < 0 || ix > nx || iz < 0 || iz > nz || seen.has(key)) continue;
      const wanted = [x0 + ix * cell, z0 + iz * cell];
      const moved = field.move(node.state.x, node.state.z, node.state.foot, wanted[0] - node.state.x, wanted[1] - node.state.z, body);
      if (Math.hypot(moved.x - wanted[0], moved.z - wanted[1]) > 0.02 || Math.abs(moved.foot - deck.floor) > 0.08) continue;
      seen.add(key);
      queue.push({ ix, iz, state: moved, parent: node });
    }
  }
  throw new Error(`The actual 56cm capsule cannot cross the dry rear promenade: ${JSON.stringify({ x0, x1, z0, z1, explored: queue.length })}`);
}

test("estate circulation: delivered Draco joins both entrances, bedroom, library floors and the dry promenade", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "One native geometry proof is independent of browser viewport.");
  test.setTimeout(300000);
  const config = manifest();
  const lower = config.rooms.find((room) => room.id === "library");
  const upper = config.rooms.find((room) => room.id === "library-upper");
  expect(lower?.library).toBeTruthy();
  expect(upper?.library?.private).toBe(true);
  expect(lower.actor[0], "library is screen-right when viewed inland from the sea").toBeLessThan(-8);
  const { field, BODY, hiddenStructure, movingLeaves } = await deliveredField(config);
  const evidence = { field: field.evidence(), hiddenStructure, movingLeaves, routes: {} };
  function bothWays(id, points) {
    evidence.routes[id] = {
      outward: traverse(field, BODY, points, id),
      return: traverse(field, BODY, [...points].reverse(), `${id} return`),
    };
  }
  try {
    bothWays("main entry", config.walk.mainEntryRoute);
    bothWays("private entry", config.entrance.privateEntrance.route);
    bothWays("lower library", lower.library.route);
    bothWays("upper library", upper.library.route);
    bothWays("bedroom to private library", config.estateLibrary.privateConnection);
    const treads = config.estateLibrary.stairRoute;
    expect(treads.length).toBeGreaterThanOrEqual(16);
    const going = Math.abs(treads[1][2] - treads[0][2]);
    const direction = Math.sign(treads[1][2] - treads[0][2]);
    const bottom = [treads[0][0], lower.floor, treads[0][2] - direction * going * 1.2];
    const top = [treads.at(-1)[0], upper.floor, treads.at(-1)[2] + direction * going * 1.2];
    bothWays("all library stair risers", [bottom, ...treads, top]);
    // This connection caught the original wall-to-wall writing table: reaching
    // the top tread alone does not prove that the visitor can enter the office.
    const passageX = upper.actor[0] + 0.1;
    bothWays("stair landing to private office", [top, [passageX, upper.floor, top[2]], [passageX, upper.floor, upper.actor[2]], upper.actor]);
    const promenade = dryPromenade(field, BODY, config);
    evidence.promenade = { ...promenade, body: promenade.body };
    evidence.routes["dry promenade"] = {
      outward: traverse(field, BODY, promenade.points, "dry promenade", promenade.body),
      return: traverse(field, BODY, [...promenade.points].reverse(), "dry promenade return", promenade.body),
    };
    expect(evidence.routes["dry promenade"].outward.travelled).toBeGreaterThan(12);
    const [px, , pz] = config.infinityPool.center;
    expect(
      field.findStand(px, pz, lower.floor, { reach: 0, tolerance: 0.1 }),
      "pool water cannot become a shortcut across the dry promenade"
    ).toBeNull();
  } finally {
    await testInfo.attach("estate-native-circulation", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
  }
});

async function inputFrame(page, scene, canvas, input) {
  const frames = (await stateOf(scene)).frames;
  await input();
  await canvas.scrollIntoViewIfNeeded();
  await expect
    .poll(
      async () => {
        await page.clock.runFor(200);
        return (await stateOf(scene)).frames;
      },
      { timeout: 60000 }
    )
    .toBeGreaterThan(frames);
}

async function doorParts(scene, id) {
  return scene.evaluate((element, id) => {
    const parts = [];
    element.labScene.scene.traverse((object) => {
      if (object.userData.estateDoor === id) parts.push({ name: object.name, x: object.position.x });
    });
    return parts;
  }, id);
}

test("estate thresholds: real leaves open before the body, cross both ways and close after leaving", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "One focused native door-motion proof complements the existing touch Walk tests.");
  test.setTimeout(software ? 600000 : 300000);
  const errors = collectRuntimeErrors(page);
  const config = manifest();
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-10-23T13:30:00-07:00") });
  await page.goto(publicRouteUrl("/") + "?scene-lab=1", { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]");
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: software ? 120000 : 90000 });
  const canvas = scene.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  await pauseSceneClock(page);
  await useSoftwareSceneCadence(page, { continuousHz: 10, force: true });
  await page.clock.runFor(500);
  expect((await stateOf(scene)).roomCount).toBe(config.rooms.length);
  if (software) {
    testInfo.annotations.push({
      type: "functional viewport",
      description: "480x320 after complete full-size loading; actual assets, shader and Walk solver",
    });
    await page.setViewportSize({ width: 480, height: 320 });
  }
  const ui = page.locator("[data-home-world-controls]");
  await inputFrame(page, scene, canvas, () => ui.locator("[data-world-fullscreen]").click());
  await inputFrame(page, scene, canvas, () => canvas.press("v"));
  await expect
    .poll(
      async () => {
        await page.clock.runFor(200);
        return (await stateOf(scene)).walk?.ready;
      },
      { timeout: 120000 }
    )
    .toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("[data-world-pause]")).toBeEnabled();
  await page.clock.runFor(800);
  const initial = await stateOf(scene);
  expect(initial.simulation.estateDoors.doors.map((door) => door.id).sort()).toEqual(["main", "private"]);
  const receipts = [];
  const pose = async () => (await stateOf(scene)).walk;
  const door = async (id) => (await stateOf(scene)).simulation.estateDoors.doors.find((entry) => entry.id === id);
  async function place(position, yaw) {
    expect(await scene.evaluate((element, value) => element.setLabWalk(value), { position, yaw, pitch: 0 })).toBe(true);
  }
  async function walkAcross(id, definition, destinationZ) {
    for (let step = 0; step < 16; step++) {
      const before = await pose();
      if (Math.abs(before.position[2] - destinationZ) < 0.13) return before;
      await page.keyboard.down("KeyW");
      await page.clock.runFor(Math.min(150, Math.max(50, (Math.abs(before.position[2] - destinationZ) / 2) * 1000)));
      await page.keyboard.up("KeyW");
      await page.clock.runFor(50);
      const current = await pose();
      expect(Math.abs(current.position[1] - definition.floor), `${id}: the body stays on its actual storey`).toBeLessThan(0.15);
      expect((await door(id)).open, `${id}: never closes on a body crossing its threshold`).toBe(true);
    }
    throw new Error(`${id}: keyboard stopped at ${JSON.stringify(await pose())}, targetZ=${destinationZ}`);
  }
  try {
    for (const definition of config.estateDoors) {
      const { id } = definition;
      await inputFrame(page, scene, canvas, () => place(config.walk.start.position, config.walk.start.yaw));
      await page.clock.runFor(1000);
      expect((await door(id)).fraction, `${id}: closed while the visitor is outside`).toBe(0);
      const resting = await doorParts(scene, id);
      expect(resting.length).toBeGreaterThanOrEqual(2);
      const [x, , z] = definition.center;
      await inputFrame(page, scene, canvas, () => place([x, definition.floor, z + 0.8], Math.PI));
      const partial = await door(id);
      expect(partial.fraction, `${id}: the actual leaf begins moving on approach`).toBeGreaterThan(0);
      expect(partial.fraction, `${id}: respects its bounded opening animation`).toBeLessThan(1);
      await page.clock.runFor(1000);
      const opened = await door(id);
      expect(opened.fraction).toBe(1);
      expect(opened.offset).toBeCloseTo(definition.slideX, 3);
      const shifted = await doorParts(scene, id);
      for (const part of shifted) expect(part.x - resting.find((entry) => entry.name === part.name).x).toBeCloseTo(definition.slideX, 3);
      const before = await pose();
      const inside = await walkAcross(id, definition, z - 0.8);
      expect(inside.position[2]).toBeLessThan(z - 0.6);
      await page.screenshot({ path: testInfo.outputPath(`estate-${id}-door-open.png`) });
      const stood = [...inside.position];
      await inputFrame(page, scene, canvas, () => place(stood, 0));
      expect(
        Math.hypot(...(await pose()).position.map((value, axis) => value - stood[axis])),
        "turning back does not teleport across a threshold"
      ).toBeLessThan(0.02);
      const outside = await walkAcross(id, definition, z + 0.8);
      expect(outside.position[2]).toBeGreaterThan(z + 0.6);
      expect(outside.distance - before.distance, `${id}: complete physical round trip`).toBeGreaterThan(2.6);
      await inputFrame(page, scene, canvas, () => place(config.walk.start.position, config.walk.start.yaw));
      await page.clock.runFor(1000);
      const closed = await door(id);
      expect(closed.fraction).toBe(0);
      const returned = await doorParts(scene, id);
      for (const part of returned) expect(part.x).toBeCloseTo(resting.find((entry) => entry.name === part.name).x, 3);
      receipts.push({ id, partial, opened, inside, outside, closed, resting, shifted, returned });
    }
    expect(errors).toEqual([]);
  } finally {
    await testInfo.attach("estate-door-round-trips", {
      body: JSON.stringify({ receipts, errors, functionalCadenceHz: 10, performanceBenchmark: false }, null, 2),
      contentType: "application/json",
    });
  }
});
