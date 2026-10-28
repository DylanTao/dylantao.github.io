const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { preparePage, collectRuntimeErrors, screenshotMetrics } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const { pauseSceneClock, useSoftwareSceneCadence } = require("./scene-clock");
const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../assets/models/home/manifest.json"), "utf8"));
const journeyCadenceHz = process.env.VISUAL_SCENE_BACKEND === "llvmpipe" ? 1 : 4;
// The host is already checked as ready. Read from its main-world element so
// polling a controlled clock does not wait for locator adoption on another RAF.
const state = (scene) => scene.page().evaluate(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence());

async function setLabOpen(page, open) {
  const actual = await page.evaluate((open) => {
    const lab = document.querySelector("[data-home-world-controls] [data-world-lab]");
    if (lab.open !== open) lab.querySelector(":scope > summary").click();
    return lab.open;
  }, open);
  expect(actual).toBe(open);
}

async function open(page, avatarId = "south-park") {
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-10-23T02:58:00-07:00") });
  await page.clock.setFixedTime(new Date("2026-10-23T02:58:00-07:00"));
  await page.goto(publicRouteUrl("/?scene-lab=1"), { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]"),
    ui = page.locator("[data-home-world-controls]");
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 150000 });
  await pauseSceneClock(page, { advanceDate: false });
  // Functional geometry/clock proof: 1 Hz on qualified software WebGL and 4 Hz
  // on the native GPU. The dense 249-phase skin/contact sweep is a separate
  // gate; neither this cadence nor the idle jump is a frame-rate measurement.
  await useSoftwareSceneCadence(page, { force: true, continuousHz: journeyCadenceHz });
  await ui.locator("[data-world-fullscreen]").click();
  await page.clock.runFor(100);
  await setLabOpen(page, true);
  await page.clock.runFor(100);
  await ui.locator("[data-world-avatar]").selectOption(avatarId);
  for (let i = 0; i < 100; i++) {
    await page.clock.runFor(100);
    const current = await state(scene);
    if (current.avatarId === avatarId && current.bedTransfer.bound) break;
  }
  expect((await state(scene)).bedTransfer).toMatchObject({ bound: true, error: null });
  expect((await state(scene)).bedTransfer.enabled).toBe(avatarId !== "lizard");
  return { scene, ui, canvas: scene.locator("canvas:not(.home-world-sketch)") };
}

async function record(scene) {
  await scene.page().evaluate(() => {
    const element = document.querySelector("[data-home-desk-scene]");
    const recorder = (window.roomJourneyRecorder = { frames: [], stopped: false });
    let previous = -1;
    const sample = () => {
      if (recorder.stopped || !element.isConnected) return;
      const current = element.getSceneEvidence();
      if (current.frames !== previous) {
        previous = current.frames;
        recorder.frames.push({
          frames: current.frames,
          seconds: current.animationSeconds,
          activity: current.activity,
          navigation: current.navigation,
          actorPosition: current.actorPosition,
          pool: current.simulation.infinityPool?.activity || null,
        });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}
async function finishRecord(page, testInfo, name) {
  const rows = await page.evaluate(() => {
    window.roomJourneyRecorder.stopped = true;
    return window.roomJourneyRecorder.frames;
  });
  await testInfo.attach(name, {
    body: JSON.stringify({
      cadenceHz: journeyCadenceHz,
      scope: "Functional controlled clock, actual delivered models and public controls; no source substitution",
      rows,
    }),
    contentType: "application/json",
  });
  return rows;
}

test("coastal journeys: the real routine crosses the adjacent bedroom stairs in both directions", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  test.setTimeout(600000);
  const errors = collectRuntimeErrors(page);
  const { scene, ui, canvas } = await open(page);
  await ui.locator('[data-world-room="sleep"]').click();
  for (let i = 0; i < 100 && !(await state(scene)).bedTransfer.clothFit; i++) await page.clock.runFor(100);
  const fitted = (await state(scene)).bedTransfer.clothFit;
  expect(fitted.compression).toBe(0);
  expect(fitted.samples.every((point) => point.clearance >= -1e-8)).toBe(true);
  await setLabOpen(page, false);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.runFor(200);
  await page.evaluate(() =>
    document.querySelector("[data-home-desk-scene]").setLabCamera({ target: [-7.25, 2.35, 6.97], yaw: 2.92, pitch: 0.3, radius: 4.6, free: true })
  );
  await page.clock.runFor(500);
  for (const [label, clock, activity] of [
    ["arrival", "2026-10-23T03:00:00-07:00", "sleep"],
    ["departure", "2026-10-23T23:00:00-07:00", "coding"],
  ]) {
    // Two ordinary routine boundaries reached by controlled wall-clock jumps;
    // neither the pose nor the routine module is replaced by a test fixture.
    await record(scene);
    await page.clock.setFixedTime(new Date(clock));
    // Fire the real heartbeat once without rendering 32 s of idle frames on
    // software WebGL. The journey still renders at the disclosed cadence.
    await page.clock.fastForward(32000);
    await page.clock.runFor(250);
    expect((await state(scene)).traveling, `${label}: the ordinary 30 s heartbeat must start a journey`).toBe(true);
    const journey = (await state(scene)).navigation;
    expect(journey.length).toBeLessThanOrEqual(6);
    expect(journey.duration).toBeGreaterThan(15);
    await page.clock.runFor(1000);
    expect(screenshotMetrics(await canvas.screenshot({ path: testInfo.outputPath(`bed-${label}-transfer.png`) })).uniqueColors).toBeGreaterThan(300);
    await page.clock.runFor(20000);
    const end = await state(scene);
    expect(end.traveling).toBe(false);
    expect(end.activity).toBe(activity);
    const rows = await finishRecord(page, testInfo, `bed-${label}`);
    const travel = rows.filter((row) => row.navigation);
    const phases = travel.map((row) => row.navigation.phase);
    expect(phases).toContain("taking the stairs");
    expect(phases).toContain("seated with feet on the floor");
    expect(phases).toContain(label === "arrival" ? "lying down from the bed edge" : "turning to sit at the bed edge");
    for (const row of travel)
      for (const foot of row.navigation.plantedFeet || []) {
        expect(foot.reachViolation).toBeLessThan(1e-6);
        expect(foot.drift).toBeLessThan(1e-6);
      }
    // Compose the completed pose through the public Pause control. A paused
    // controlled clock must include its requested draw before capturing pixels.
    await setLabOpen(page, true);
    const beforePause = (await state(scene)).frames;
    await ui.locator("[data-world-pause]").click();
    await setLabOpen(page, false);
    await page.clock.runFor(1000 / journeyCadenceHz + 20);
    expect(await page.evaluate(() => document.querySelector("[data-world-pause]").getAttribute("aria-pressed"))).toBe("true");
    expect((await state(scene)).frames).toBeGreaterThan(beforePause);
    expect(screenshotMetrics(await canvas.screenshot({ path: testInfo.outputPath(`bed-${label}-finished.png`) })).uniqueColors).toBeGreaterThan(300);
    await setLabOpen(page, true);
    await ui.locator("[data-world-pause]").click();
    await setLabOpen(page, false);
    await page.clock.runFor(1000 / journeyCadenceHz + 20);
  }
  expect(errors).toEqual([]);
});

test("coastal journeys: the pool visit uses real entry steps, holds on its floor and returns dry", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  test.setTimeout(600000);
  const errors = collectRuntimeErrors(page);
  const { scene, ui, canvas } = await open(page, "lizard");
  await ui.locator("[data-world-activity]").selectOption("pool");
  await page.clock.runFor(500);
  const still = await state(scene);
  expect(still.simulation.infinityPool.activity.phase).toBe("quiet in the water");
  expect(still.actorPosition[1]).toBeCloseTo(config.infinityPool.activity.path.at(-1).position[1], 3);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.runFor(100);
  await ui.locator("[data-world-activity]").selectOption("pool");
  await page.clock.runFor(500);
  await record(scene);
  await page.clock.runFor(1500);
  await ui.locator("[data-world-pause]").click();
  await page.clock.runFor(100);
  const held = (await state(scene)).actorPosition;
  await page.clock.runFor(1000);
  expect((await state(scene)).actorPosition).toEqual(held);
  await ui.locator("[data-world-pause]").click();
  await setLabOpen(page, false);
  await page.clock.runFor(100);
  const duration = (await state(scene)).simulation.infinityPool.activity.duration;
  await page.clock.runFor((duration + 1) * 1000);
  const end = await state(scene),
    rows = await finishRecord(page, testInfo, "pool-visit");
  expect(end.simulation.infinityPool.activity.phase).toBe("back on the dry deck");
  expect(end.actorPosition).toEqual(config.infinityPool.activity.entry);
  const phases = rows.map((row) => row.pool?.phase);
  for (const phase of ["entering the pool", "quiet in the water", "leaving the pool", "back on the dry deck"]) expect(phases).toContain(phase);
  const supports = new Set(config.infinityPool.activity.supportSurfaces.map((surface) => surface.id));
  for (const row of rows) if (row.pool) for (const id of row.pool.supportIds) expect(supports.has(id)).toBe(true);
  expect(screenshotMetrics(await canvas.screenshot({ path: testInfo.outputPath("pool-returned.png") })).uniqueColors).toBeGreaterThan(300);
  await setLabOpen(page, true);
  await ui.locator("[data-world-activity]").selectOption("coding");
  await page.clock.runFor(500);
  expect((await state(scene)).simulation.infinityPool.activity).toBeNull();
  expect((await state(scene)).activity).toBe("coding");
  expect(errors).toEqual([]);
});
