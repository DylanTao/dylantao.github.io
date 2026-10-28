const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { preparePage, collectRuntimeErrors, screenshotMetrics } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const { pauseSceneClock, useSoftwareSceneCadence } = require("./scene-clock");
const { pathToFileURL } = require("node:url");

const readyTimeout = process.platform === "linux" || process.env.VISUAL_TRANSPORT_SOFTWARE === "1" ? 120000 : 90000;
const sceneEvidence = (scene) => scene.page().evaluate(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence());

test("coastal quality: a lost graphics context returns to the desk and retries a complete lower tier", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name), "Graphics lifecycle is checked at desktop and phone widths.");
  test.setTimeout(300000);
  const errors = collectRuntimeErrors(page);
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../assets/models/home/manifest.json"), "utf8"));
  await preparePage(page);
  // This gate exercises an allocated context and its recovery. Hold motion so
  // software WebGL can service the driver-loss input between complete frames;
  // native live-motion/offscreen recovery has its own registered case.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(publicRouteUrl("/?scene-lab=1&quality=auto&perf=1"), { waitUntil: "domcontentloaded" });
  await page.locator("[data-home-record-next]").click();
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]");
  await scene.scrollIntoViewIfNeeded();
  const ready = async () => {
    await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: readyTimeout });
    await expect.poll(async () => (await sceneEvidence(scene)).roomCount, { timeout: readyTimeout }).toBe(manifest.rooms.length);
    await expect.poll(async () => (await sceneEvidence(scene)).frames, { timeout: readyTimeout }).toBeGreaterThan(0);
  };
  await ready();
  const before = await sceneEvidence(scene);
  expect(before.currentRecord).toBeGreaterThan(0);
  await page.locator("[data-world-fullscreen]").click();
  await expect.poll(async () => (await sceneEvidence(scene)).fullscreen).toBeTruthy();
  const allocationFrame = await scene.evaluate((element) => {
    element.setQualityTier("standard");
    const frame = element.getSceneEvidence().frames;
    element.labScene.requestFrame();
    return frame;
  });
  await expect.poll(async () => (await sceneEvidence(scene)).frames, { timeout: readyTimeout }).toBeGreaterThan(allocationFrame);
  const allocated = await sceneEvidence(scene);
  expect(allocated.quality.tier).toBe("standard");
  expect(allocated.quality.settings.maxSamples).toBe(4);
  // Compact full screen deliberately caps samples at two even in standard.
  expect(allocated.rendering.msaaSamples).toBe(allocated.resolution.compact ? 2 : 4);
  const loss = await scene.evaluate((element) => {
    const canvas = element.querySelector("canvas");
    const extension = canvas.getContext("webgl2").getExtension("WEBGL_lose_context");
    if (!extension) return { supported: false };
    // Use a real allocated standard tier, then lose its actual context. No synthetic frame costs,
    // governor observations or DOM events stand in for the driver loss.
    const evidence = element.getSceneEvidence();
    window.__coastalLostCanvas = canvas;
    extension.loseContext();
    return { supported: true, tier: evidence.quality.tier, pinned: evidence.quality.pinned };
  });
  expect(loss.supported, "This renderer must support the real context-loss gate").toBe(true);
  expect(loss.tier).toBe("standard");
  expect(loss.pinned).toBe(false);
  await expect(page.locator("[data-home-artifact-stage]")).toHaveAttribute("data-desk-mode", "2d");
  await expect(page.locator("#home-profile-image-container")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("sirui-scene-quality-cap"))).toBe("low");
  await expect(page.locator("[data-home-artifact-stage]")).not.toHaveClass(/is-world-immersive/);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await page.locator('[data-home-desk-mode="3d"]').click();
  await ready();
  const after = await sceneEvidence(scene);
  expect(after.currentRecord).toBe(before.currentRecord);
  expect(after.quality.tier).toBe("low");
  expect(after.quality.pinned).toBe(false);
  expect(after.fullscreen).toBeFalsy();
  expect(after.avatarId).toBeTruthy();
  expect(after.canvasWidth * after.canvasHeight).toBeGreaterThan(0);
  expect(await scene.evaluate((element) => element.querySelector("canvas") !== window.__coastalLostCanvas)).toBe(true);
  const screenshot = await scene.locator("canvas").screenshot();
  const pixels = screenshotMetrics(screenshot);
  expect(pixels.uniqueColors).toBeGreaterThan(128);
  expect(pixels.luminanceVariance).toBeGreaterThan(12);
  await testInfo.attach("recovered-complete-home", { body: screenshot, contentType: "image/png" });
  await testInfo.attach("graphics-loss-recovery", {
    body: JSON.stringify({ loss, before, allocated, after, pixels, errors }, null, 2),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});

test("coastal weather: retained natural rain clears the actual roofs, falls outside and holds when motion stops", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name), "One desktop and one phone view cover the actual roof/rain geometry.");
  test.setTimeout(600000);
  const errors = collectRuntimeErrors(page),
    { COASTAL_WEATHER_DATA } = await import(pathToFileURL(path.resolve(__dirname, "../../assets/js/home-scene/weather-data.mjs")).href),
    rainCase = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../fixtures/coastal-rain-nws-oct26.json"), "utf8")),
    forecast = rainCase.forecast,
    dateKey = rainCase.instant.slice(0, 10),
    minute = Number(rainCase.instant.slice(11, 13)) * 60 + Number(rainCase.instant.slice(14, 16));
  // Retain a real published wet NWS interval. Daily forecast refreshes must not
  // turn this renderer regression into a test of tomorrow's forecast.
  await preparePage(page);
  await page.route("**/home-scene/weather-data.mjs", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export const COASTAL_WEATHER_DATA=${JSON.stringify({ ...COASTAL_WEATHER_DATA, forecast })};`,
    })
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date(rainCase.instant));
  await page.goto(publicRouteUrl("/?scene-lab=1"), { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]"),
    canvas = scene.locator("canvas"),
    ui = page.locator("[data-home-world-controls]");
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: readyTimeout });
  await pauseSceneClock(page);
  await useSoftwareSceneCadence(page, { continuousHz: 10, force: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.runFor(400);
  const read = async () => {
    const { positionBytes, ...state } = await scene.evaluate(
      async (element, { dateKey, minute }) => {
        const e = element.getSceneEvidence(),
          root = element.labScene.scene,
          rain = root.getObjectByName("Bounded coastal rain");
        const bytes = rain.geometry.attributes.position.array;
        const { weatherAt } = await import(new URL("./assets/js/home-scene/coastal-weather.mjs", location.href).href);
        return {
          frames: e.frames,
          room: e.currentRoom,
          weather: weatherAt(dateKey, minute),
          rain: e.simulation.rain,
          positionBytes: Array.from(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)),
        };
      },
      { dateKey, minute }
    );
    return { ...state, hash: createHash("sha256").update(Uint8Array.from(positionBytes)).digest("hex") };
  };
  const wet = await read();
  expect(wet.weather.source).toBe("nws-forecast");
  expect(wet.rain.intensity).toBeCloseTo(0.28, 6);
  expect(wet.rain.extraPasses).toBe(0);
  expect(wet.rain.shadowCasters).toBe(0);
  expect(wet.rain.roofClip.built).toBeTruthy();
  expect(wet.rain.roofClip.triangles).toBeGreaterThan(0);
  const roof = await scene.evaluate(async (element) => {
    const THREE = await import(new URL("./assets/js/three.module.min.js", location.href).href),
      root = element.labScene.scene,
      roofs = [];
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (!object.isMesh) return;
      for (let owner = object; owner; owner = owner.parent)
        if (owner.userData.caveRoof) {
          roofs.push(object);
          break;
        }
    });
    const rain = root.getObjectByName("Bounded coastal rain"),
      a = rain.geometry.attributes.position.array,
      ray = new THREE.Raycaster(),
      witnesses = [];
    for (let i = 0; i < rain.geometry.drawRange.count / 2; i++) {
      const k = i * 6;
      ray.set(new THREE.Vector3(a[k + 3], 64, a[k + 5]), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObjects(roofs, false)[0];
      if (hit)
        witnesses.push({ drop: i, bottom: a[k + 4], roof: hit.point.y, mesh: hit.object.name, landed: Math.abs(a[k + 1] - a[k + 4]) < 0.00001 });
    }
    return { meshCount: roofs.length, witnesses, failed: witnesses.filter((w) => w.bottom < w.roof - 0.2) };
  });
  expect(roof.meshCount).toBeGreaterThan(0);
  expect(roof.witnesses.length).toBeGreaterThan(0);
  expect(roof.failed).toEqual([]);
  const details = ui.locator("details").first();
  if (!(await details.evaluate((e) => e.open))) await details.locator("summary").first().click();
  const pause = ui.locator("[data-world-pause]");
  await pause.click();
  await page.clock.runFor(200);
  const paused = await read();
  await page.clock.runFor(800);
  expect((await read()).hash).toBe(paused.hash);
  await pause.click();
  await page.clock.runFor(300);
  expect((await read()).hash).not.toBe(paused.hash);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.runFor(300);
  const reduced = await read();
  await page.clock.runFor(800);
  expect((await read()).hash).toBe(reduced.hash);
  await ui.locator("[data-world-view]").click();
  await page.clock.runFor(200);
  const outside = await read();
  expect(outside.room).toBe("outside");
  expect(outside.rain.drops - outside.rain.sheltered - outside.rain.nearCamera).toBeGreaterThan(0);
  const pixels = screenshotMetrics(await canvas.screenshot());
  expect(pixels.uniqueColors).toBeGreaterThan(128);
  expect(pixels.luminanceVariance).toBeGreaterThan(12);
  await testInfo.attach("retained-natural-shower", {
    body: JSON.stringify({ wet, roof, paused, reduced, outside, pixels, errors }, null, 2),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});
