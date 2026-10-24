const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { preparePage, collectRuntimeErrors } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const { pauseSceneClock, useSoftwareSceneCadence } = require("./scene-clock");

const ROOT = path.resolve(__dirname, "../..");
const manifest = () => JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/home/manifest.json"), "utf8"));
const software = process.platform === "linux" || process.env.VISUAL_TRANSPORT_SOFTWARE === "1";
const stateOf = (scene) => scene.evaluate((element) => element.getSceneEvidence());

async function inputFrame(page, scene, canvas, input) {
  const frames = (await stateOf(scene)).frames;
  await input();
  await canvas.scrollIntoViewIfNeeded();
  await expect
    .poll(
      async () => {
        await page.clock.runFor(32);
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
  // The lower living foyer retains its real moving oak leaf. The discreet onsen approach
  // deliberately has no intrusive glass leaf across the bathing room's view.
  expect(initial.simulation.estateDoors.doors.map((door) => door.id).sort()).toEqual(["main"]);
  const receipts = [];
  const pose = async () => (await stateOf(scene)).walk;
  const door = async (id) => (await stateOf(scene)).simulation.estateDoors.doors.find((entry) => entry.id === id);
  async function settleDoor(id, fraction) {
    await expect
      .poll(
        async () => {
          const current = await door(id);
          if (current.fraction === fraction) return current.fraction;
          await page.clock.runFor(32);
          return (await door(id)).fraction;
        },
        { timeout: 120000 }
      )
      .toBe(fraction);
  }
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
      await settleDoor(id, 0);
      expect((await door(id)).fraction, `${id}: closed while the visitor is outside`).toBe(0);
      const resting = await doorParts(scene, id);
      expect(resting.length).toBeGreaterThanOrEqual(2);
      const [x, , z] = definition.center;
      await inputFrame(page, scene, canvas, () => place([x, definition.floor, z + 0.8], Math.PI));
      const partial = await door(id);
      expect(partial.fraction, `${id}: the actual leaf begins moving on approach`).toBeGreaterThan(0);
      expect(partial.fraction, `${id}: respects its bounded opening animation`).toBeLessThan(1);
      await settleDoor(id, 1);
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
      await settleDoor(id, 0);
      const closed = await door(id);
      expect(closed.fraction).toBe(0);
      const returned = await doorParts(scene, id);
      for (const part of returned) expect(part.x).toBeCloseTo(resting.find((entry) => entry.name === part.name).x, 3);
      receipts.push({ id, partial, opened, inside, outside, closed, resting, shifted, returned });
    }
    // The living facade closes at night, but its real lift-and-slide leaves must still admit
    // a walker to the dry terrace and back. One initial placement isolates this threshold;
    // keyboard input performs both crossings without further position staging.
    await inputFrame(page, scene, canvas, () =>
      ui.locator("[data-world-time]").evaluate((input) => {
        input.value = "1290";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      })
    );
    const facade = async () => (await stateOf(scene)).simulation.facade.doors;
    expect((await facade()).every((leaf) => !leaf.scheduledOpen)).toBe(true);
    await expect
      .poll(
        async () => {
          await page.clock.runFor(100);
          return (await facade()).every((leaf) => Math.abs(leaf.offset) < 0.01);
        },
        { timeout: 60000 }
      )
      .toBe(true);
    const inside = config.retreat.patioRoute[1],
      outside = [inside[0], inside[1], config.facade.planeZ - 0.85];
    await inputFrame(page, scene, canvas, () => place(inside, Math.PI));
    const near = await facade();
    expect(
      near.some((leaf) => leaf.open && !leaf.scheduledOpen),
      "night approach opens the actual facade despite its closed schedule"
    ).toBe(true);
    const beginning = await pose();
    const crossings = [];
    for (const target of [outside, inside]) {
      if (crossings.length) {
        const stood = [...(await pose()).position];
        await inputFrame(page, scene, canvas, () => place(stood, 0));
        expect(Math.hypot(...(await pose()).position.map((value, axis) => value - stood[axis])), "the return turn preserves position").toBeLessThan(
          0.02
        );
      }
      for (let step = 0; step < 32; step++) {
        if (Math.abs((await pose()).position[2] - target[2]) < 0.13) break;
        await page.keyboard.down("KeyW");
        await page.clock.runFor(100);
        await page.keyboard.up("KeyW");
        await page.clock.runFor(50);
      }
      const reached = await pose();
      expect(Math.abs(reached.position[2] - target[2]), "keyboard crosses the delivered facade in each direction").toBeLessThan(0.15);
      expect(Math.abs(reached.position[1] - target[1]), "the dry terrace stays on its actual floor").toBeLessThan(0.15);
      crossings.push(reached);
    }
    expect(crossings[1].distance - beginning.distance, "both physical crossings accumulate walking distance").toBeGreaterThan(3.5);
    receipts.push({ id: "night-living-facade", inside, outside, near, crossings, final: await facade() });
    await page.screenshot({ path: testInfo.outputPath("living-terrace-night-return.png") });
    expect(errors).toEqual([]);
  } finally {
    await testInfo.attach("estate-door-round-trips", {
      body: JSON.stringify({ receipts, errors, functionalCadenceHz: 10, performanceBenchmark: false }, null, 2),
      contentType: "application/json",
    });
  }
});
