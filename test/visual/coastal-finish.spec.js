const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { preparePage, collectRuntimeErrors, screenshotMetrics } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

const readyTimeout = process.platform === "linux" || process.env.VISUAL_TRANSPORT_SOFTWARE === "1" ? 120000 : 90000;
const sceneEvidence = (scene) => scene.evaluate((element) => element.getSceneEvidence());

test("coastal quality: a lost graphics context returns to the desk and retries a complete lower tier", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name), "Graphics lifecycle is checked at desktop and phone widths.");
  test.setTimeout(300000);
  const errors = collectRuntimeErrors(page);
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../assets/models/home/manifest.json"), "utf8"));
  await preparePage(page);
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
