const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { preparePage, collectRuntimeErrors, screenshotDiffRatio, screenshotMetrics } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const { PNG } = require("pngjs");

test("record: on-disc controls, continuous rotation, and offscreen suspension", async ({ page }, testInfo) => {
  await preparePage(page, "afternoon");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date("2026-09-29T12:00:00-07:00") });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const record = page.locator("[data-home-record-scene]");
  const transport = page.locator(".home-record-transport");
  const play = page.locator("[data-home-record-play]");
  await page.evaluate(() => document.fonts.ready);
  // The header measures its height after window.load. Start the transport
  // baseline after that page-wide layout change, before any player input.
  await expect.poll(() => page.locator("body").evaluate((e) => e.style.paddingTop)).not.toBe("");
  const caption = page.locator(".home-record-console");
  await expect(caption).toBeHidden();
  // A preview caption must stay reachable while keyboard focus moves from
  // the disc to its source, and disappear when the original portrait returns.
  await play.focus();
  await expect(caption).toBeVisible();
  await page.locator("[data-home-record-next]").press("Tab");
  await expect(page.locator("[data-home-record-source]")).toBeFocused();
  await expect(caption).toBeVisible();
  await page.getByRole("button", { name: "2D", exact: true }).focus();
  await expect(caption).toBeHidden();
  const disc = page.locator("#home-profile-image-container");
  const discBox = await disc.boundingBox();
  const playBox = await play.boundingBox();
  expect(Math.abs(playBox.width - discBox.width)).toBeLessThan(3);
  expect(Math.abs(playBox.height - discBox.height)).toBeLessThan(3);
  await expect(page.locator(".home-record-console button")).toHaveCount(0);
  const previousBox = await page.locator("[data-home-record-prev]").boundingBox();
  const nextBox = await page.locator("[data-home-record-next]").boundingBox();
  expect(nextBox.x - previousBox.x - previousBox.width).toBeGreaterThan(100);
  // Accessible clicks may scroll the controls into view. Compare their actual
  // document position rather than their position in a moving viewport.
  const transportPosition = () =>
    transport.evaluate((e) => {
      const box = e.getBoundingClientRect();
      return { x: box.left + window.scrollX, y: box.top + window.scrollY };
    });
  const controlsBefore = await transportPosition();
  await play.click();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().loaded)).toBe(true);
  await page.waitForTimeout(500);
  await play.click();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().running)).toBe(false);
  const paused = await record.evaluate((e) => e.getRecordEvidence().angle);
  await page.waitForTimeout(800);
  expect(await record.evaluate((e) => e.getRecordEvidence().angle)).toBe(paused);
  // Browser IPC can add hundreds of milliseconds on software-WebGL runners.
  // Observe the exact resume boundary, then advance 100 ms of animation time.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
  await play.click();
  expect(await record.evaluate((e) => e.getRecordEvidence().angle)).toBe(paused);
  await page.clock.runFor(100);
  const resumed = await record.evaluate((e) => e.getRecordEvidence().angle);
  const change = Math.atan2(Math.sin(resumed - paused), Math.cos(resumed - paused));
  expect(change).toBeGreaterThan(0);
  expect(change).toBeLessThan(0.12);
  const titleBefore = await page.locator("[data-home-record-title]").textContent();
  await play.press("ArrowRight");
  await expect(page.locator("[data-home-record-title]")).not.toHaveText(titleBefore);
  await expect(play).toHaveAttribute("aria-pressed", "true");
  await play.press("ArrowLeft");
  await expect(page.locator("[data-home-record-title]")).toHaveText(titleBefore);
  await page.clock.resume();
  await page.locator("[data-home-record-next]").click();
  await expect(page.locator("[data-home-record-title]")).not.toHaveText("Yellow Submarine");
  const controlsAfter = await transportPosition();
  expect(Math.abs(controlsBefore.x - controlsAfter.x)).toBeLessThan(1);
  expect(Math.abs(controlsBefore.y - controlsAfter.y)).toBeLessThan(1);
  for (const control of await transport.locator("button").all()) {
    const box = await control.boundingBox();
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    const onDisc = await disc.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(onDisc.x);
    expect(box.x + box.width).toBeLessThanOrEqual(onDisc.x + onDisc.width);
    expect(box.y).toBeGreaterThanOrEqual(onDisc.y);
    expect(box.y + box.height).toBeLessThanOrEqual(onDisc.y + onDisc.height);
  }
  await page.locator(".home-record-player").screenshot({ path: testInfo.outputPath("record-player.png") });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().running)).toBe(false);
  await page.locator(".home-record-player").scrollIntoViewIfNeeded();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().running)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().running)).toBe(false);
});

test("record physics: the needle lifts before artwork changes and rapid cues preserve phase", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date("2026-09-30T13:00:00-07:00") });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const record = page.locator("[data-home-record-scene]"),
    play = page.locator("[data-home-record-play]");
  await play.click();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanics?.phase)).toBe("tracking");
  await expect.poll(() => record.evaluate((e) => Boolean(e.getRecordEvidence().artwork))).toBe(true);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
  const before = await record.evaluate((e) => e.getRecordEvidence());
  await page.locator("[data-home-record-next]").click();
  const cue = await record.evaluate((e) => e.getRecordEvidence());
  expect(cue.mechanics.angle).toBe(before.mechanics.angle);
  expect(cue.mechanics.velocity).toBe(before.mechanics.velocity);
  expect(cue.artwork).toBe(before.artwork);
  expect(cue.cuePending).toBe(true);
  await page.clock.runFor(100);
  expect((await record.evaluate((e) => e.getRecordEvidence())).artwork).toBe(before.artwork);
  await page.clock.runFor(400);
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().artwork)).not.toBe(before.artwork);
  expect((await record.evaluate((e) => e.getRecordEvidence())).recordTransfer.lift).toBeGreaterThan(0.44);
  await play.click();
  const stopped = await record.evaluate((e) => e.getRecordEvidence().mechanics);
  await play.click();
  const resumed = await record.evaluate((e) => e.getRecordEvidence().mechanics);
  expect(resumed.angle).toBe(stopped.angle);
  expect(resumed.yaw).toBe(stopped.yaw);
  expect(resumed.lift).toBe(stopped.lift);
  await page.clock.runFor(1500);
  await page.locator(".home-record-player").screenshot({ path: testInfo.outputPath("physical-record-player.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await record.evaluate((e) => e.getRecordEvidence())).running).toBe(false);
  expect(errors).toEqual([]);
});

for (const graphics of ["delayed", "unavailable"]) {
  test(`record physics: ${graphics} graphics keep the same interruptible 2D mechanics`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    await preparePage(page, "light");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.clock.install({ time: new Date("2026-09-30T13:00:00-07:00") });
    let releaseGraphics;
    const graphicsGate = new Promise((resolve) => {
      releaseGraphics = resolve;
    });
    await page.route("**/three.module.min.js", async (route) => {
      if (graphics === "delayed") {
        await graphicsGate;
        await route.continue();
      } else {
        // A handled import exception exercises the genuine fallback without
        // introducing an expected network/console error into this assertion.
        await route.fulfill({ contentType: "application/javascript", body: "throw new Error('Deliberate graphics-unavailable fixture');" });
      }
    });
    await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-home-artifact-stage]")).toHaveAttribute("data-desk-mode", "2d");
    await expect(page.locator("#home-profile-image-container")).toBeVisible();
    const record = page.locator("[data-home-record-scene]"),
      play = page.locator("[data-home-record-play]");
    await play.focus();
    await play.press("Enter");
    await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanicsLoaded)).toBe(true);
    await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanics.phase)).toBe("tracking");
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
    const before = await record.evaluate((e) => e.getRecordEvidence());
    const beforeBackground = await record.locator(".home-record-art").evaluate((e) => getComputedStyle(e).backgroundImage);
    expect(before.fallback).toBe(true);
    expect(before.mechanics.rpm).toBeCloseTo(33 + 1 / 3, 1);
    await page.locator("[data-home-record-next]").click();
    const first = await record.evaluate((e) => e.getRecordEvidence());
    expect(first.mechanics.angle).toBe(before.mechanics.angle);
    expect(first.mechanics.velocity).toBe(before.mechanics.velocity);
    await page.clock.runFor(100);
    expect((await record.evaluate((e) => e.getRecordEvidence())).artwork).toBe(before.artwork);
    expect(await record.locator(".home-record-art").evaluate((e) => getComputedStyle(e).backgroundImage)).toBe(beforeBackground);
    await page.locator("[data-home-record-next]").click();
    await page.clock.runFor(1300);
    const cued = await record.evaluate((e) => e.getRecordEvidence());
    expect(cued.cuePending).toBe(false);
    expect(cued.recordTransfer.lift).toBeGreaterThan(0.44);
    expect(cued.artwork).not.toBe(before.artwork);
    const selectedImage = (await page.locator("#home-profile-image-container").getAttribute("data-record-images")).split("|")[2];
    expect(new URL(cued.artwork, page.url()).pathname).toBe(new URL(selectedImage, page.url()).pathname);
    expect(cued.mechanics.phase).toBe("tracking");
    const transform = await record.locator(".home-record-art").evaluate((e) => getComputedStyle(e).transform);
    expect(transform).not.toBe("none");
    await play.focus();
    await play.press(" ");
    const stopping = await record.evaluate((e) => e.getRecordEvidence().mechanics);
    await play.press(" ");
    const restarting = await record.evaluate((e) => e.getRecordEvidence().mechanics);
    for (const key of ["angle", "velocity", "yaw", "lift"]) expect(restarting[key]).toBe(stopping[key]);
    await page.clock.runFor(1400);
    await capture(testInfo, `physical-record-${graphics}`, await page.locator(".home-record-player").screenshot());
    if (graphics === "delayed") {
      const fallbackPose = await record.evaluate((e) => e.getRecordEvidence().mechanics);
      releaseGraphics();
      await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().loaded)).toBe(true);
      expect((await record.evaluate((e) => e.getRecordEvidence())).mechanics.angle).toBe(fallbackPose.angle);
      expect((await record.evaluate((e) => e.getRecordEvidence())).mechanics.velocity).toBe(fallbackPose.velocity);
    }
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hidden = await record.evaluate((e) => e.getRecordEvidence());
    expect(hidden.running).toBe(false);
    await page.clock.runFor(500);
    expect((await record.evaluate((e) => e.getRecordEvidence())).mechanics.angle).toBe(hidden.mechanics.angle);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.runFor(100);
    expect((await record.evaluate((e) => e.getRecordEvidence())).mechanics.angle).toBeGreaterThan(hidden.mechanics.angle);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect((await record.evaluate((e) => e.getRecordEvidence())).running).toBe(false);
    await page.locator("[data-home-record-next]").click();
    expect((await record.evaluate((e) => e.getRecordEvidence())).cuePending).toBe(false);
    expect(errors).toEqual([]);
  });
}

for (const graphics of ["native", "unavailable"]) {
  test(`record physics: ${graphics} skip then pause retains artwork until the needle clears`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    await preparePage(page, "light");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.clock.install({ time: new Date("2026-10-01T13:00:00-07:00") });
    if (graphics === "unavailable")
      await page.route("**/three.module.min.js", (route) =>
        route.fulfill({ contentType: "application/javascript", body: "throw new Error('Deliberate graphics-unavailable fixture');" })
      );
    await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
    const record = page.locator("[data-home-record-scene]"),
      play = page.locator("[data-home-record-play]"),
      art = record.locator(".home-record-art");
    await play.click();
    await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanics?.phase)).toBe("tracking");
    if (graphics === "native") await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().loaded)).toBe(true);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
    const before = await record.evaluate((e) => e.getRecordEvidence());
    const beforeBackground = await art.evaluate((e) => getComputedStyle(e).backgroundImage);
    await page.locator("[data-home-record-next]").click();
    expect(await art.evaluate((e) => getComputedStyle(e).backgroundImage)).toBe(beforeBackground);
    await page.clock.runFor(50);
    const lifting = await record.evaluate((e) => e.getRecordEvidence().mechanics);
    expect(lifting.lift).toBeLessThan(0.44);
    await play.click();
    const paused = await record.evaluate((e) => e.getRecordEvidence());
    expect(paused.cuePending).toBe(true);
    expect(paused.playing).toBe(false);
    for (const key of ["angle", "velocity", "yaw", "lift"]) expect(paused.mechanics[key]).toBe(lifting[key]);
    expect(paused.artwork).toBe(before.artwork);
    expect(await art.evaluate((e) => getComputedStyle(e).backgroundImage)).toBe(beforeBackground);
    // A second choice while paused replaces the queue, rather than bypassing it.
    await page.locator("[data-home-record-next]").click();
    expect(await art.evaluate((e) => getComputedStyle(e).backgroundImage)).toBe(beforeBackground);
    await page.clock.runFor(1000);
    const selected = (await page.locator("#home-profile-image-container").getAttribute("data-record-images")).split("|")[2];
    await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().artwork)).toContain(new URL(selected, page.url()).pathname);
    const final = await record.evaluate((e) => e.getRecordEvidence());
    expect(final.cuePending).toBe(false);
    expect(final.recordTransfer.lift).toBeGreaterThan(0.44);
    expect(final.playing).toBe(false);
    expect(await art.evaluate((e) => getComputedStyle(e).backgroundImage)).not.toBe(beforeBackground);
    await capture(testInfo, `pause-cue-${graphics}`, await page.locator(".home-record-player").screenshot());
    expect(errors).toEqual([]);
  });
}

test("record physics: touch transport keeps cues reachable and preserves spin across 2D/3D", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "Real Chromium touch context exercises the transport.");
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const record = page.locator("[data-home-record-scene]");
  await page.locator("[data-home-record-play]").tap();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanics?.phase)).toBe("tracking");
  await page.locator("[data-home-record-next]").tap();
  await page.locator("[data-home-record-prev]").tap();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanics?.phase)).toBe("tracking");
  await page.locator('[data-home-desk-mode="3d"]').tap();
  const scene = page.locator("[data-home-desk-scene]");
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
  await expect(scene).toHaveAttribute("data-record-spinning", "true");
  await page.locator('[data-home-desk-mode="2d"]').tap();
  expect((await record.evaluate((e) => e.getRecordEvidence())).playing).toBe(true);
  await page.locator("[data-home-record-play]").tap();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().running)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("record physics: a late old texture cannot replace the newest cue and disposal stays quiet", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date("2026-09-30T13:00:00-07:00") });
  let releaseOldTexture;
  const imageGate = new Promise((resolve) => {
    releaseOldTexture = resolve;
  });
  // Block the second meme image, including its preload, before navigation.
  const response = await page.request.get(publicRouteUrl("/"));
  const imagePaths = (await response.text()).match(/data-record-images="([^"]+)"/)[1].split("|");
  await page.route(`**${imagePaths[1]}`, async (route) => {
    await imageGate;
    await route.continue();
  });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const record = page.locator("[data-home-record-scene]");
  await page.locator("[data-home-record-play]").click();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().loaded)).toBe(true);
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanics.phase)).toBe("tracking");
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
  const first = await record.evaluate((e) => e.getRecordEvidence());
  await page.locator("[data-home-record-next]").click();
  await page.clock.runFor(1000);
  const waiting = await record.evaluate((e) => e.getRecordEvidence());
  expect(waiting.artwork).toBe(first.artwork);
  expect(waiting.mechanics.lift).toBeGreaterThan(0.456);
  expect(waiting.mechanics.phase).toBe("swinging");
  await page.locator("[data-home-record-next]").click();
  await page.clock.runFor(700);
  await expect.poll(() => record.evaluate((e) => new URL(e.getRecordEvidence().artwork, location.href).pathname)).toBe(imagePaths[2]);
  releaseOldTexture();
  await expect
    .poll(() =>
      page.evaluate(
        (src) =>
          Array.from(document.images)
            .filter((i) => i.src.endsWith(src))
            .every((i) => i.complete),
        imagePaths[1]
      )
    )
    .toBe(true);
  await page.clock.runFor(1400);
  expect(new URL((await record.evaluate((e) => e.getRecordEvidence())).artwork).pathname).toBe(imagePaths[2]);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  await page.clock.runFor(300);
  expect((await record.evaluate((e) => e.getRecordEvidence())).running).toBe(false);
  expect(errors).toEqual([]);
});

test("record physics: reduced motion composes the SVG player without requesting Three", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  let graphicsRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/three.module.min.js")) graphicsRequests++;
  });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const record = page.locator("[data-home-record-scene]");
  await page.locator("[data-home-record-play]").click();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanicsLoaded)).toBe(true);
  const before = await record.evaluate((e) => e.getRecordEvidence());
  expect(before.mechanics.phase).toBe("tracking");
  expect(before.running).toBe(false);
  await page.locator("[data-home-record-next]").click();
  const after = await record.evaluate((e) => e.getRecordEvidence());
  expect(after.artwork).not.toBe(before.artwork);
  expect(after.mechanics.angle).toBe(before.mechanics.angle);
  expect(after.cuePending).toBe(false);
  expect(graphicsRequests).toBe(0);
  await expect(record.locator("canvas")).toHaveCount(0);
  await capture(testInfo, "physical-record-reduced-svg", await page.locator(".home-record-player").screenshot());
  expect(errors).toEqual([]);
});

test("record: touch skip retains a visible play/pause cue with reduced motion", async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, "touch-only playback state");
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const play = page.locator("[data-home-record-play]");
  const next = page.locator("[data-home-record-next]");
  const cue = page.locator(".home-record-play-cue");
  const scene = page.locator("[data-home-record-scene]");
  await play.tap();
  await expect.poll(() => scene.evaluate((e) => e.getRecordEvidence().mechanicsLoaded)).toBe(true);
  await next.tap();
  await expect(play).toHaveAttribute("aria-pressed", "true");
  await expect(cue).toHaveCSS("opacity", "1");
  await expect(play.locator("[data-home-record-pause-icon]")).toBeVisible();
  await play.tap();
  await next.tap();
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expect(cue).toHaveCSS("opacity", "1");
  await expect(play.locator("[data-home-record-play-icon]")).toBeVisible();
  const source = await page.locator("[data-home-record-source]").boundingBox();
  expect(source.height).toBeGreaterThanOrEqual(44);
  expect((await scene.evaluate((e) => e.getRecordEvidence())).running).toBe(false);
  await capture(testInfo, "touch-record-state", await page.locator(".home-record-player").screenshot());
  expect(errors).toEqual([]);
});

async function capture(testInfo, name, buffer) {
  const file = testInfo.outputPath(name + ".png");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}
function seaRegion(buffer) {
  const source = PNG.sync.read(buffer),
    x = Math.floor(source.width * 0.27),
    y = Math.floor(source.height * 0.83),
    width = Math.floor(source.width * 0.34),
    height = Math.floor(source.height * 0.07),
    crop = new PNG({ width, height });
  for (let row = 0; row < height; row++)
    source.data.copy(crop.data, row * width * 4, ((y + row) * source.width + x) * 4, ((y + row) * source.width + x + width) * 4);
  return PNG.sync.write(crop);
}
async function openHome(page, { motion = "reduce", theme = "light", time = "2026-09-11T17:45:00-07:00" } = {}) {
  await preparePage(page, theme);
  await page.emulateMedia({ reducedMotion: motion });
  await page.clock.install({ time: new Date(time) });
  await page.goto(publicRouteUrl("/") + "?scene-lab=1", { waitUntil: "domcontentloaded" });
  const stage = page.locator("[data-home-artifact-stage]");
  await expect(stage).toHaveAttribute("data-desk-mode", "2d");
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]");
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
  const canvas = scene.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  return { stage, scene, canvas, ui: page.locator("[data-home-world-controls]") };
}
const evidence = (scene) => scene.evaluate((e) => e.getSceneEvidence());
async function settleRoomModels(scene) {
  // Readiness covers the occupied room; five additional GLBs then stream and
  // compile on the software-rendered CI worker. Verify every actual room before
  // measuring pause/orbit behavior, with a load budget rather than the 15s UI one.
  await expect.poll(async () => (await evidence(scene)).roomCount, { timeout: 60000 }).toBe(6);
}
async function explore(ui) {
  const details = ui.locator("details").first();
  if (!(await details.getAttribute("open"))) {
    if (!(await details.evaluate((e) => e.open))) await details.locator("summary").first().click();
  }
}
async function settle(page) {
  await page.waitForTimeout(200);
}

test("coastal physics: dispersive water changes visible pixels, shares La Jolla light, and suspends cleanly", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page, { motion: "no-preference" });
  await settleRoomModels(scene);
  await explore(ui);
  await ui.locator("[data-world-time]").fill("800");
  await ui.locator('[data-world-room="outside"]').click();
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  const info = await evidence(scene);
  expect(info.ecology.water.waves).toBe(10);
  expect(info.ecology.water.sample.jacobian).toBeGreaterThan(0.6);
  expect(info.ecology.water.reflection.linear).toBe(true);
  expect(info.ecology.water.reflection.fresnelIOR).toBe(1.333);
  expect(info.daylight.location.latitude).toBe(32.83);
  expect(info.daylight.sunlight).toBe(1);
  await expect(ui.locator("[data-world-clock]")).toContainText("La Jolla");
  const before = await canvas.screenshot();
  await page.waitForTimeout(500);
  const after = await canvas.screenshot();
  expect(screenshotDiffRatio(before, after)).toBeGreaterThan(0.001);
  // This interior patch of the normal exterior's sea excludes the moving actor
  // and most birds. Motion must change actual water pixels, not only telemetry.
  const seaDiff = screenshotDiffRatio(seaRegion(before), seaRegion(after));
  expect(seaDiff).toBeGreaterThan(0.002);
  await capture(testInfo, "moving-water-region", seaRegion(after));
  await capture(testInfo, "physical-pacific", after);
  await ui.locator("[data-world-pause]").click();
  await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
  const frozen = (await evidence(scene)).ecology.water.seconds;
  await page.waitForTimeout(250);
  expect((await evidence(scene)).ecology.water.seconds).toBe(frozen);
  await ui.locator("[data-world-pause]").click();
  await expect.poll(async () => (await evidence(scene)).ecology.water.seconds).toBeGreaterThan(frozen);
  const final = await evidence(scene);
  const proofFile = testInfo.outputPath("physical-rendering-evidence.json");
  fs.writeFileSync(
    proofFile,
    JSON.stringify(
      {
        water: final.ecology.water,
        daylight: final.daylight,
        frameTiming: final.frameTiming,
        drawCalls: final.drawCalls,
        triangles: final.triangles,
        resources: final.resources,
        seaPixelDiff: seaDiff,
      },
      null,
      2
    )
  );
  await testInfo.attach("physical-rendering-evidence", { path: proofFile, contentType: "application/json" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
  expect(errors).toEqual([]);
});

test("coastal physics: the study label transfers only above contact and keeps the newest album", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page, { motion: "no-preference" });
  await settleRoomModels(scene);
  await explore(ui);
  await ui.locator('[data-world-room="study"]').first().click();
  await ui.locator(".home-world-objects > summary").click();
  const first = ui.locator('[data-world-record="0"]');
  await first.click();
  await first.click();
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await evidence(scene)).recordMechanics.phase).toBe("tracking");
  await expect.poll(async () => (await evidence(scene)).displayedVinylRecord).toBe(0);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
  const before = await evidence(scene);
  const second = ui.locator('[data-world-record="1"]');
  await second.click();
  await second.click();
  await canvas.scrollIntoViewIfNeeded();
  const interrupted = await evidence(scene);
  expect(interrupted.recordMechanics.angle).toBe(before.recordMechanics.angle);
  expect(interrupted.recordMechanics.velocity).toBe(before.recordMechanics.velocity);
  expect(interrupted.displayedVinylRecord).toBe(0);
  await page.clock.runFor(100);
  expect((await evidence(scene)).displayedVinylRecord).toBe(0);
  const third = ui.locator('[data-world-record="2"]');
  await third.click();
  await third.click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(650);
  await expect.poll(async () => (await evidence(scene)).displayedVinylRecord).toBe(2);
  const transfer = (await evidence(scene)).vinylTransfer;
  expect(transfer.index).toBe(2);
  expect(transfer.lift).toBeGreaterThan(0.44);
  await page.clock.runFor(1400);
  expect((await evidence(scene)).recordMechanics.phase).toBe("tracking");
  await capture(testInfo, "study-physical-record", await canvas.screenshot());
  expect(errors).toEqual([]);
});

test("coastal home: quiet public controls, capybara wall art and a new arrival on refresh", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.addInitScript(() => sessionStorage.setItem("sirui-scene-style", "architectural"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-home-artifact-stage]")).toHaveAttribute("data-desk-mode", "2d");
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]");
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
  const first = (await evidence(scene)).avatarId;
  const ui = page.locator("[data-home-world-controls]");
  await expect(ui.locator("button:visible")).toHaveCount(1);
  await expect(scene).toHaveAttribute("data-render-style", "realistic");
  await expect(ui.locator("select:visible")).toHaveCount(0);
  await expect.poll(async () => (await evidence(scene)).portrait).toContain("/img/home/sirui_capy.jpg");
  await ui.locator("[data-world-view]").click();
  await expect(scene).toHaveAttribute("data-room", "outside");
  await expect(ui.locator("[data-world-view]")).toHaveText(/Back inside/);
  const canvas = scene.locator("canvas");
  await canvas.focus();
  await canvas.press("Escape");
  await expect(ui.locator("[data-world-view]")).toHaveText(/Look around/);
  await ui.locator("[data-world-view]").click();
  await ui.locator("[data-world-view]").click();
  expect((await evidence(scene)).following).toBe(true);
  await page.reload();
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
  expect((await evidence(scene)).avatarId).not.toBe(first);
  await expect.poll(async () => (await evidence(scene)).portrait).toContain("/img/home/sirui_capy.jpg");
  expect(errors).toEqual([]);
});

test("coastal home: the lab stays minimal and realistic with obsolete saved styles", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await page.addInitScript(() => sessionStorage.setItem("sirui-scene-style", "illustrated"));
  const { scene, ui } = await openHome(page, { time: "2026-10-01T13:20:00-07:00" });
  await explore(ui);
  await ui.locator("[data-world-avatar]").selectOption("ghibli");
  await expect(scene).toHaveAttribute("data-avatar", "ghibli");
  await ui.locator("details").first().locator("summary").first().click();
  await expect(scene).toHaveAttribute("data-render-style", "realistic");
  await expect(ui.locator("[data-world-style]")).toHaveCount(0);
  await expect(ui.locator("button:visible")).toHaveCount(1);
  await expect(ui.locator("select:visible")).toHaveCount(0);
  await expect(ui.locator("details").first()).not.toHaveAttribute("open");
  await capture(testInfo, "minimal-realistic-controls", await page.locator(".home-hero-media").screenshot());
  await explore(ui);
  await expect(ui.locator("[data-world-avatar]")).toBeVisible();
  await ui.locator('[data-world-room="overview"]').click();
  await expect(scene).toHaveAttribute("data-room", "overview");
  await ui.locator('[data-world-room="study"]').click();
  await expect(scene).toHaveAttribute("data-room", "study");
  await ui.locator("details").first().locator("summary").first().click();
  await expect(ui.locator("[data-world-avatar]")).toBeHidden();
  expect(errors).toEqual([]);
});

for (const theme of ["light", "dark"]) {
  test(`coastal home: ${theme} scene fades completely before every canvas edge`, async ({ page }, testInfo) => {
    const { scene, canvas, ui } = await openHome(page, { theme });
    await explore(ui);
    await ui.locator("[data-world-activity]").selectOption("workout");
    await canvas.scrollIntoViewIfNeeded();
    const sceneBox = await scene.boundingBox();
    const canvasBox = await canvas.boundingBox();
    expect(Math.abs(canvasBox.height - sceneBox.height)).toBeLessThan(1);
    const visible = PNG.sync.read(await scene.screenshot());
    await canvas.evaluate((e) => (e.style.visibility = "hidden"));
    const background = PNG.sync.read(await scene.screenshot());
    await canvas.evaluate((e) => (e.style.visibility = ""));
    let largestDifference = 0;
    for (let y = 0; y < visible.height; y++) {
      for (let x = 0; x < visible.width; x++) {
        if (x > 1 && y > 1 && x < visible.width - 2 && y < visible.height - 2) continue;
        const i = (y * visible.width + x) * 4;
        for (let c = 0; c < 3; c++) largestDifference = Math.max(largestDifference, Math.abs(visible.data[i + c] - background.data[i + c]));
      }
    }
    expect(largestDifference).toBeLessThan(5);
    await capture(testInfo, `organic-edge-${theme}`, await scene.screenshot());
  });

  test(`coastal home: ${theme} composition, connected rooms, actual orbit and zoom`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    const { scene, canvas, stage, ui } = await openHome(page, { theme });
    if (theme === "dark") {
      await explore(ui);
      await ui.locator("[data-world-time]").fill("1380");
      await expect(scene).toHaveAttribute("data-scene-palette", "evening");
      await canvas.scrollIntoViewIfNeeded();
      await settle(page);
    }
    await settleRoomModels(scene);
    await expect(stage.locator(".home-world-welcome")).toBeVisible();
    const before = await canvas.screenshot();
    const metrics = screenshotMetrics(before);
    expect(metrics.uniqueColors).toBeGreaterThan(60);
    expect(metrics.luminanceVariance).toBeGreaterThan(80);
    await canvas.focus();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.12);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.17, { steps: 12 });
    await page.mouse.up();
    await settle(page);
    const orbit = await canvas.screenshot();
    expect(screenshotDiffRatio(before, orbit)).toBeGreaterThan(0.02);
    await canvas.focus();
    await canvas.press("+");
    await canvas.press("+");
    await settle(page);
    expect(screenshotDiffRatio(orbit, await canvas.screenshot())).toBeGreaterThan(0.006);
    expect(await canvas.evaluate((e) => e.matches(":focus-visible"))).toBe(true);
    expect(await scene.evaluate((e) => getComputedStyle(e, "::after").borderTopWidth)).toBe("2px");
    await capture(testInfo, "keyboard-focus", await scene.screenshot());
    await explore(ui);
    await ui.locator('[data-world-room="overview"]').click();
    await canvas.scrollIntoViewIfNeeded();
    await settle(page);
    await capture(testInfo, "connected-home", await canvas.screenshot());
    await ui.locator('[data-world-room="outside"]').click();
    await expect(scene).toHaveAttribute("data-room", "outside");
    await canvas.scrollIntoViewIfNeeded();
    await settle(page);
    await capture(testInfo, "same-house-outside", await canvas.screenshot());
    await ui.locator('[data-world-room="study"]').first().click();
    await expect(scene).toHaveAttribute("data-room", "study");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("coastal home: all five avatars retain one actor, shared wall art and album state", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page);
  await explore(ui);
  await ui.locator("[data-world-activity]").selectOption("workout");
  for (const avatar of ["lizard", "south-park", "simpsons", "ghibli", "rick-and-morty", "lizard"]) {
    await ui.locator("[data-world-avatar]").selectOption(avatar);
    await expect(scene).toHaveAttribute("data-avatar", avatar);
    await expect.poll(async () => (await evidence(scene)).portrait).toContain("/img/home/sirui_capy.jpg");
    await canvas.scrollIntoViewIfNeeded();
    await settle(page);
    const info = await evidence(scene);
    expect(info.actorCount).toBe(1);
    expect(info.animations).toHaveLength(14);
    expect(info.characterPerformance.eyelidMeshes).toBeGreaterThan(0);
    expect(info.characterPerformance.blink).toEqual([0, 0]);
    expect(info.joints.FootR[1]).toBeGreaterThan(0.06);
    expect(info.joints.FootR[1]).toBeLessThan(0.16);
    await capture(testInfo, avatar, await canvas.screenshot());
  }
  expect((await evidence(scene)).currentRecord).toBe(0);
  expect((await evidence(scene)).style).toBe("realistic");
  await page.locator('[data-home-desk-mode="2d"]').click();
  await page.locator('[data-home-desk-mode="3d"]').click();
  expect((await evidence(scene)).avatarId).toBe("lizard");
  expect(errors).toEqual([]);
});

test("coastal home: compiled avatar replacements release their bone textures", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Rig ownership and texture lifetime are shared across viewports.");
  const errors = collectRuntimeErrors(page);
  const { scene, ui } = await openHome(page);
  await settleRoomModels(scene);
  await explore(ui);
  await ui.locator("[data-world-activity]").selectOption("workout");
  await page.evaluate(async () => {
    const { Skeleton } = await import(new URL("assets/js/three.module.min.js", location.href).href);
    const dispose = Skeleton.prototype.dispose;
    window.__coastalRigDisposals = [];
    Skeleton.prototype.dispose = function () {
      const hadTexture = Boolean(this.boneTexture);
      dispose.call(this);
      window.__coastalRigDisposals.push({ hadTexture, cleared: this.boneTexture === null });
    };
  });
  const avatars = ["lizard", "south-park", "simpsons", "ghibli", "rick-and-morty"];
  const reference = new Map(),
    samples = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const avatar of avatars) {
      const frame = (await evidence(scene)).frames;
      await ui.locator("[data-world-avatar]").selectOption(avatar);
      await expect(scene).toHaveAttribute("data-avatar", avatar);
      await expect.poll(async () => (await evidence(scene)).frames).toBeGreaterThan(frame);
      await settle(page);
      const info = await evidence(scene);
      expect(info.actorCount).toBe(1);
      samples.push({ cycle, avatar, textures: info.resources.textures, geometries: info.resources.geometries });
      if (cycle === 1) reference.set(avatar, info.resources.textures);
      if (cycle === 2) expect(info.resources.textures).toBe(reference.get(avatar));
    }
  }
  const beforeDisposal = await page.evaluate(() => window.__coastalRigDisposals.length);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  await expect(scene.locator("canvas")).toHaveCount(0);
  const disposals = await page.evaluate(() => window.__coastalRigDisposals);
  expect(disposals).toHaveLength(beforeDisposal + 1);
  expect(disposals.every((entry) => entry.hadTexture && entry.cleared)).toBe(true);
  const report = testInfo.outputPath("compiled-avatar-resource-cycles.json");
  fs.mkdirSync(path.dirname(report), { recursive: true });
  fs.writeFileSync(report, JSON.stringify({ samples, disposals }, null, 2));
  await testInfo.attach("compiled-avatar-resource-cycles", { path: report, contentType: "application/json" });
  expect(errors).toEqual([]);
});

test("character performance: attention settles and eyelids respect pause and reduced motion", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page, { motion: "no-preference", time: "2026-10-01T13:20:00-07:00" });
  await explore(ui);
  await ui.locator("[data-world-activity]").selectOption("work");
  await ui.locator("[data-world-avatar]").selectOption("ghibli");
  await expect(scene).toHaveAttribute("data-avatar", "ghibli");
  await expect.poll(async () => (await evidence(scene)).characterPerformance?.eyelidMeshes).toBeGreaterThan(0);
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  const start = await evidence(scene);
  const rect = await canvas.boundingBox();
  await page.mouse.move(rect.x + rect.width * 0.76, rect.y + rect.height * 0.3);
  await expect
    .poll(async () => ["glance", "acknowledge"].includes((await evidence(scene)).characterPerformance?.phase), { intervals: [30] })
    .toBe(true);
  const attention = (await evidence(scene)).characterPerformance;
  expect(attention.attentionTarget.direction[2]).toBeGreaterThan(0);
  expect(attention.attentionTarget.worldDirection.every(Number.isFinite)).toBe(true);
  expect(Math.sign(attention.eye[0] + attention.head[0])).toBe(Math.sign(attention.attentionTarget.angles[0]));
  expect(Math.hypot(...(await evidence(scene)).camera.map((value, i) => value - start.camera[i]))).toBeLessThan(0.03);
  await expect.poll(async () => (await evidence(scene)).characterPerformance?.phase).toBe("routine");
  await expect.poll(async () => (await evidence(scene)).characterPerformance?.blinkCount, { timeout: 10000 }).toBeGreaterThan(0);

  await ui.locator("[data-world-pause]").click();
  await expect.poll(async () => (await evidence(scene)).characterPerformance?.phase).toBe("still");
  const paused = await evidence(scene);
  expect(paused.characterPerformance.blink).toEqual([0, 0]);
  expect(paused.characterPerformance.head).toEqual([0, 0, 0]);
  await page.clock.fastForward(30000);
  expect((await evidence(scene)).characterPerformance.seconds).toBe(paused.characterPerformance.seconds);

  await ui.locator("[data-world-pause]").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ui.locator("[data-world-activity]").selectOption("sleep");
  await expect.poll(async () => (await evidence(scene)).characterPerformance?.blink).toEqual([1, 1]);
  await ui.locator("[data-world-activity]").selectOption("work");
  await expect.poll(async () => (await evidence(scene)).characterPerformance?.blink).toEqual([0, 0]);
  const still = await evidence(scene);
  expect(still.actorCount).toBe(1);
  expect(still.characterPerformance.headOnly).toBe(true);
  expect(still.animations).toHaveLength(14);
  await capture(testInfo, "character-composed-return", await canvas.screenshot());
  expect(errors).toEqual([]);
});

test("character performance: P acknowledges a visitor without changing the room or camera", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page, { motion: "no-preference", time: "2026-10-01T13:20:00-07:00" });
  await explore(ui);
  await ui.locator("[data-world-activity]").selectOption("work");
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await evidence(scene)).companion?.visible).toBe(true);
  await expect.poll(async () => (await evidence(scene)).companion?.attention?.phase).toBe("task");
  await page.waitForTimeout(1400);
  const start = await evidence(scene);
  const point = start.companion.projected;
  if (testInfo.project.name === "mobile-390") await page.touchscreen.tap(point.x + 32, point.y);
  else await page.mouse.move(point.x, point.y);
  await expect.poll(async () => (await evidence(scene)).companion?.attention?.greetings).toBeGreaterThan(start.companion.attention.greetings);
  await expect.poll(async () => (await evidence(scene)).companion?.attention?.phase).toBe("listen");
  const listen = await evidence(scene);
  expect(listen.currentRoom).toBe(start.currentRoom);
  expect(listen.currentRecord).toBe(start.currentRecord);
  expect(Math.hypot(...listen.camera.map((value, i) => value - start.camera[i]))).toBeLessThan(0.03);
  expect(listen.companion.eyes.every(Number.isFinite)).toBe(true);
  await capture(testInfo, "P-listens-to-a-visitor", await canvas.screenshot());
  await expect.poll(async () => (await evidence(scene)).companion?.attention?.phase).toBe("task");
  const greetings = (await evidence(scene)).companion.attention.greetings;
  await page.waitForTimeout(600);
  expect((await evidence(scene)).companion.attention.greetings).toBe(greetings);
  // Observe the streamed turntable during the active encounter, before the
  // deliberate 30-second pause crosses the separate page-excursion schedule.
  await expect.poll(async () => (await evidence(scene)).companion?.attention?.target, { timeout: 27000 }).toBe("record");

  await ui.locator("[data-world-pause]").click();
  await expect.poll(async () => (await evidence(scene)).companion?.attention?.phase).toBe("still");
  const paused = await evidence(scene);
  await page.clock.fastForward(30000);
  expect((await evidence(scene)).companion.activeSeconds).toBe(paused.companion.activeSeconds);
  expect((await evidence(scene)).companion.position).toEqual(paused.companion.position);
  expect(await page.locator(".pip-companion").evaluate((element) => element.getCompanionEvidence().visible)).toBe(false);
  await page.locator('[data-home-desk-mode="2d"]').click();
  await expect(page.locator(".pip-companion")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("character performance: rapid room changes preserve P's airborne floor and queue the latest destination", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page, { motion: "no-preference", time: "2026-10-02T13:20:00-07:00" });
  await explore(ui);
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await evidence(scene)).companion?.visible).toBe(true);
  await ui.locator('[data-world-room="kitchen"]').click();
  await expect.poll(async () => (await evidence(scene)).companion?.destinationRoom).toBe("kitchen");
  await page.clock.fastForward(4000);
  const before = (await evidence(scene)).companion;
  expect(before.traveling).toBe(true);
  await ui.locator('[data-world-room="onsen"]').click();
  await expect.poll(async () => (await evidence(scene)).companion?.pendingRoom).toBe("onsen");
  const changed = await evidence(scene);
  expect(changed.currentRoom).toBe("onsen");
  expect(changed.companion.destinationRoom).toBe("kitchen");
  expect(Math.abs(changed.companion.position[1] - before.position[1])).toBeLessThan(0.5);
  await capture(testInfo, "P-retains-airborne-floor", await canvas.screenshot());
  await ui.locator('[data-world-room="gym"]').click();
  await expect.poll(async () => (await evidence(scene)).companion?.pendingRoom).toBe("gym");
  await ui.locator('[data-world-room="kitchen"]').click();
  await expect.poll(async () => (await evidence(scene)).companion?.pendingRoom).toBe(null);
  await ui.locator("[data-world-pause]").click();
  const paused = (await evidence(scene)).companion;
  await page.clock.fastForward(3000);
  expect((await evidence(scene)).companion.position).toEqual(paused.position);
  expect(errors).toEqual([]);
});

test("character performance: P finishes a wave without listening to a departed visitor", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Pointer departure; bounded touch invitations retain their separate expiry contract.");
  const errors = collectRuntimeErrors(page);
  const { scene, canvas } = await openHome(page, { motion: "no-preference", time: "2026-10-02T13:20:00-07:00" });
  await settleRoomModels(scene);
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await evidence(scene)).companion?.visible).toBe(true);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 2000);
  const start = await evidence(scene);
  const point = start.companion.projected;
  await page.mouse.move(point.x + 32, point.y);
  await page.clock.runFor(500);
  const wave = await evidence(scene);
  expect(wave.companion.attention.phase).toBe("greet");
  await page.mouse.move(0, 0);
  await page.clock.runFor(2700);
  const returning = await evidence(scene);
  await canvas.screenshot({ path: testInfo.outputPath("departed-visitor-return.png") });
  fs.writeFileSync(testInfo.outputPath("departed-visitor.json"), JSON.stringify({ start, wave, returning, errors }, null, 2));
  expect(returning.companion.attention.phase).toBe("return");
  expect(returning.companion.gesture).toBe("rest");
  await page.clock.runFor(1300);
  const quiet = await evidence(scene);
  fs.writeFileSync(testInfo.outputPath("departed-visitor.json"), JSON.stringify({ start, wave, returning, quiet, errors }, null, 2));
  expect(quiet.companion.attention.phase).toBe("task");
  expect(quiet.companion.gesture).toBe("rest");
  expect(quiet.companion.attention.greetings).toBe(start.companion.attention.greetings + 1);
  expect(quiet.currentRoom).toBe(start.currentRoom);
  expect(quiet.currentRecord).toBe(start.currentRecord);
  expect(errors).toEqual([]);
});

test("coastal neighbours: keyboard inspection, on-animal return, zoom and Back inside preserve the room state", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page, { time: "2026-10-01T13:20:00-07:00" });
  await expect.poll(async () => (await evidence(scene)).ecology.wildlife.modelsReady, { timeout: 45000 }).toBe(true);
  const initial = await evidence(scene);
  await ui.locator("[data-world-view]").click();
  await canvas.scrollIntoViewIfNeeded();
  const coastline = await evidence(scene);
  const wide = await canvas.screenshot();
  await canvas.press("n");
  await expect(scene).toHaveAttribute("data-coastal-neighbour", "rabbit-0");
  await expect.poll(async () => (await evidence(scene)).neighbours.length).toBe(17);
  const rabbitArrival = (await evidence(scene)).inspection.arrival;
  expect(rabbitArrival.visibleFaceSamples).toBe(rabbitArrival.faceSamples);
  expect(rabbitArrival.visibleBody).toBe(true);
  await expect
    .poll(async () => {
      const view = await evidence(scene),
        point = view.neighbours.find((item) => item.id === "rabbit-0").worldCenter;
      return Math.hypot(...view.target.map((value, i) => value - point[i]));
    })
    .toBeLessThan(0.01);
  await capture(testInfo, "rabbit-inspection", await canvas.screenshot());
  for (let i = 0; i < 7 && (await evidence(scene)).inspection.id !== "seaLion-0"; i++) await canvas.press("n");
  await expect(scene).toHaveAttribute("data-coastal-neighbour", "seaLion-0");
  await expect(canvas).toHaveAttribute("aria-label", /California sea lion/);
  await expect
    .poll(async () => {
      const view = await evidence(scene),
        point = view.neighbours.find((item) => item.id === "seaLion-0").worldCenter;
      return Math.hypot(...view.target.map((value, i) => value - point[i]));
    })
    .toBeLessThan(0.01);
  const near = await evidence(scene);
  expect(near.currentRoom).toBe("outside");
  expect(near.activity).toBe(initial.activity);
  expect(near.currentRecord).toBe(initial.currentRecord);
  expect(near.cameraOrbit.radius).toBeLessThan(coastline.cameraOrbit.radius * 0.5);
  expect(Math.hypot(...near.camera.map((value, i) => value - near.target[i]))).toBeLessThan(near.cameraOrbit.radius * 1.6);
  const before = await canvas.screenshot();
  expect(screenshotDiffRatio(wide, before)).toBeGreaterThan(0.05);
  await capture(testInfo, "sea-lion-inspection", before);
  await canvas.press("ArrowRight");
  await canvas.press("+");
  expect(screenshotDiffRatio(before, await canvas.screenshot())).toBeGreaterThan(0.015);
  const after = await evidence(scene);
  const point = after.neighbours.find((item) => item.id === "seaLion-0").projected;
  const rect = await canvas.boundingBox();
  if (testInfo.project.name === "mobile-390") await page.touchscreen.tap(rect.x + point.x * rect.width, rect.y + point.y * rect.height);
  else await page.mouse.click(rect.x + point.x * rect.width, rect.y + point.y * rect.height);
  await expect(scene).not.toHaveAttribute("data-coastal-neighbour", /.+/);
  expect((await evidence(scene)).currentRoom).toBe("outside");
  await canvas.press("n");
  await ui.locator("[data-world-view]").click();
  await expect(scene).toHaveAttribute("data-room", "study");
  expect((await evidence(scene)).inspection).toBeNull();
  expect((await evidence(scene)).currentRecord).toBe(initial.currentRecord);
  await expect(canvas).toHaveAttribute("aria-label", /Sirui’s coastal home/);
  expect(errors).toEqual([]);
});

test("coastal home: modified and composing canvas shortcuts preserve the view", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas } = await openHome(page);
  await settleRoomModels(scene);
  await page.locator("[data-world-view]").click();
  await canvas.scrollIntoViewIfNeeded();
  const before = await evidence(scene);
  const delivered = await canvas.evaluate((element) => {
    const samples = [];
    for (const modifier of ["ctrlKey", "metaKey", "altKey", "isComposing"]) {
      for (const key of ["ArrowLeft", "n", "d", "+", "-"]) {
        const event = new KeyboardEvent("keydown", { key, [modifier]: true, bubbles: true, cancelable: true });
        element.dispatchEvent(event);
        samples.push({ modifier, key, prevented: event.defaultPrevented });
      }
    }
    return samples;
  });
  expect(delivered.every((sample) => !sample.prevented)).toBe(true);
  const after = await evidence(scene);
  fs.writeFileSync(testInfo.outputPath("canvas-shortcuts.json"), JSON.stringify({ before, after, delivered, errors }, null, 2));
  expect(after.currentRoom).toBe(before.currentRoom);
  expect(after.inspection).toEqual(before.inspection);
  expect(after.cameraOrbit).toEqual(before.cameraOrbit);
  expect(after.dropped).toEqual(before.dropped);
  await canvas.press("N");
  await expect.poll(async () => (await evidence(scene)).inspection?.id).toBe("rabbit-0");
  await canvas.press("Enter");
  expect((await evidence(scene)).inspection).toBe(null);
  expect(errors).toEqual([]);
});

test("coastal neighbours: new raccoon and birds expose real close views without extra public controls", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page, { time: "2026-10-01T13:20:00-07:00" });
  await expect.poll(async () => (await evidence(scene)).ecology.wildlife.modelsReady, { timeout: 45000 }).toBe(true);
  await ui.locator("[data-world-view]").click();
  await canvas.scrollIntoViewIfNeeded();
  const neighbours = (await evidence(scene)).neighbours;
  expect(neighbours).toHaveLength(17);
  expect(neighbours.every((animal) => animal.faceAnchorSource === "named acting pivots")).toBe(true);
  await settleRoomModels(scene);
  await ui.locator("[data-world-view]").click();
  await settle(page);
  // Deliver the gallery selection before any exterior frame can update the
  // cutaway. A slow renderer or rapid key burst must score the final roof.
  await canvas.evaluate(
    (element, presses) => {
      for (let index = 0; index < presses; index++) element.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));
    },
    neighbours.findIndex((animal) => animal.id === "balcony-gull-0") + 1
  );
  await expect(scene).toHaveAttribute("data-coastal-neighbour", "balcony-gull-0");
  await settle(page);
  const burst = await evidence(scene);
  expect(burst.inspection.arrival.visibleFaceSamples).toBe(burst.inspection.arrival.faceSamples);
  expect(burst.inspection.arrival.visibleBody).toBe(true);
  const gallery = await canvas.screenshot(),
    image = PNG.sync.read(gallery),
    center = new PNG({ width: Math.floor(image.width * 0.4), height: Math.floor(image.height * 0.4) });
  PNG.bitblt(image, center, Math.floor(image.width * 0.3), Math.floor(image.height * 0.3), center.width, center.height, 0, 0);
  // Exclude the feathered border: a sandstone-filled frame has variance <1
  // despite a centered target, whereas the real gull/rail/ocean are distinct.
  expect(screenshotMetrics(PNG.sync.write(center)).luminanceVariance).toBeGreaterThan(80);
  await capture(testInfo, "gallery-gull-after-synchronous-cutaway-transition", gallery);
  await canvas.press("Enter");
  const expected = new Set(["raccoon-0", "gull-0", "balcony-gull-0", "sandpiper-0"]),
    visited = new Set();
  for (let i = 0; i < neighbours.length; i++) {
    await canvas.press("n");
    const view = await evidence(scene);
    expect(view.inspection.arrival.faceSamples).toBeGreaterThanOrEqual(2);
    expect(view.camera.every(Number.isFinite)).toBe(true);
    const selected = view.neighbours.find((animal) => animal.id === view.inspection.id);
    expect(Math.hypot(...view.target.map((value, axis) => value - selected.worldCenter[axis]))).toBeLessThan(0.01);
    if (expected.has(view.inspection.id)) {
      visited.add(view.inspection.id);
      // A projected target can remain centered while opaque scenery fills
      // the rendered frame. Require an actual unobstructed arrival as well.
      expect(view.inspection.arrival.visibleFaceSamples).toBe(view.inspection.arrival.faceSamples);
      expect(view.inspection.arrival.visibleBody).toBe(true);
      expect(selected.projected.x).toBeGreaterThan(0);
      expect(selected.projected.x).toBeLessThan(1);
      expect(selected.projected.y).toBeGreaterThan(0);
      expect(selected.projected.y).toBeLessThan(1);
      await canvas.evaluate((element) => element.blur());
      await capture(testInfo, `${view.inspection.id}-actual-arrival`, await canvas.screenshot());
    }
  }
  expect(visited).toEqual(expected);
  await canvas.press("Enter");
  expect((await evidence(scene)).inspection).toBeNull();
  expect(await ui.locator("button:visible").count()).toBe(1);
  expect(errors).toEqual([]);
});

test("coastal home: full exterior orbit and guided interior camera boundaries", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "camera geometry is shared; touch zoom has its own mobile case");
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page);
  await explore(ui);
  for (const room of ["outside", "overview", "study", "kitchen", "gym", "onsen", "sleep", "lounge"]) {
    await ui.locator(`[data-world-room="${room}"]`).first().click();
    await canvas.scrollIntoViewIfNeeded();
    // Keep a real focused keyboard input, then stress the same browser handler
    // with a burst of repeat events. Hundreds of protocol round trips otherwise
    // force hundreds of software-rendered frames on Linux before any assertion.
    await canvas.press("ArrowLeft");
    // Each burst stays below half a turn. Let its frame finish so the camera's
    // shortest-angle interpolation follows the complete orbit, not a shortcut.
    for (const count of [14, 14, 13]) {
      await canvas.evaluate((node, count) => {
        for (let i = 0; i < count; i++) node.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", repeat: true, bubbles: true }));
      }, count);
      await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
    }
    await canvas.evaluate((node) => {
      for (let i = 0; i < 12; i++) node.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", repeat: true, bubbles: true }));
    });
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -8000);
    await settle(page);
    const state = await evidence(scene),
      v = state.cameraOrbit,
      e = state.cameraEnvelope;
    expect(v.radius).toBeGreaterThanOrEqual(e.radius[0] - 0.001);
    expect(v.pitch).toBeLessThanOrEqual(e.pitch[1] + 0.001);
    if (room === "outside") expect(v.yaw).toBeGreaterThan(Math.PI * 2);
    else {
      expect(v.yaw).toBeGreaterThanOrEqual(e.yaw[0] - 0.001);
      expect(v.yaw).toBeLessThanOrEqual(e.yaw[1] + 0.001);
    }
    expect(state.camera.every(Number.isFinite)).toBe(true);
    await canvas.evaluate((e) => e.blur());
    await capture(testInfo, `camera-boundary-${room}`, await canvas.screenshot());
  }
  expect(errors).toEqual([]);
});

test("coastal home: composed activities and previews survive clock changes until Now", async ({ page }, testInfo) => {
  const { scene, canvas, ui } = await openHome(page);
  await explore(ui);
  // These world-space contact bounds describe Lizard's authored proportions.
  // Public arrivals randomize; the animation fixture must remain deterministic.
  await ui.locator("[data-world-avatar]").selectOption("lizard");
  for (const activity of ["sleep", "breakfast", "reading", "lunch", "work", "workout", "soak", "dinner", "lounge", "coding"]) {
    await ui.locator("[data-world-activity]").selectOption(activity);
    await canvas.scrollIntoViewIfNeeded();
    await settle(page);
    await expect(scene).toHaveAttribute("data-activity", activity);
    const info = await evidence(scene);
    expect(info.following).toBe(false);
    expect(info.clockMode).toBe("preview");
    if (activity === "work") {
      expect(info.joints.HandR[1] - info.activityFloor).toBeGreaterThan(0.8);
      expect(info.joints.HandR[1] - info.activityFloor).toBeLessThan(0.96);
      expect(info.joints.HandR[2] - info.activityOffset[2]).toBeLessThan(-1.8);
    }
    if (activity === "sleep") expect(info.joints.Root[1] - info.activityFloor).toBeGreaterThan(0.5);
    if (["breakfast", "reading", "lunch", "workout", "dinner", "lounge"].includes(activity)) {
      expect(info.prop.ancestorsVisible).toBe(true);
      expect(info.prop.size.every((v) => Number.isFinite(v) && v > 0.002)).toBe(true);
      const gripDistance = Math.hypot(...info.prop.position.map((v, i) => v - info.joints.HandR[i]));
      expect(gripDistance).toBeLessThan(0.18);
    }
    if (["breakfast", "lunch", "dinner"].includes(activity)) {
      expect(Math.abs(info.joints.HandR[0] - info.joints.Head[0])).toBeLessThan(0.13);
      expect(info.joints.HandR[1]).toBeGreaterThan(1.03);
    }
    await capture(testInfo, `activity-${activity}`, await canvas.screenshot());
  }
  await ui.locator('[data-world-room="onsen"]').click();
  const before = (await evidence(scene)).camera;
  await page.clock.fastForward(60000);
  expect((await evidence(scene)).camera).toEqual(before);
  await expect(scene).toHaveAttribute("data-activity", "coding");
  await ui.locator("[data-world-now]").click();
  expect((await evidence(scene)).following).toBe(true);
  await expect(scene).toHaveAttribute("data-activity", "workout");
  await expect(scene).toHaveAttribute("data-room", "gym");
});

test("coastal home: album focus, playback, discovery, mode sharing, and paper navigation", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, stage, ui } = await openHome(page, { motion: "no-preference" });
  const player = page.locator(".home-record-player"),
    playerScene = page.locator("[data-home-record-scene]"),
    source = page.locator("[data-home-record-source]");
  await explore(ui);
  await ui.locator(".home-world-objects > summary").click();
  const record = ui.locator('[data-world-record="0"]');
  await record.click();
  await expect(scene).toHaveAttribute("data-focused-desk-object", "record-0");
  await record.click();
  await expect(scene).toHaveAttribute("data-record-spinning", "true");
  await page.waitForTimeout(250);
  expect((await playerScene.evaluate((e) => e.getRecordEvidence())).running).toBe(false);
  expect(await player.evaluate((e) => e.inert)).toBe(true);
  await expect(source).toBeHidden();
  await source.evaluate((e) => e.focus({ preventScroll: true }));
  expect(await source.evaluate((e) => e === document.activeElement)).toBe(false);
  await capture(testInfo, "record-caption-hidden-in-3d", await page.locator(".home-hero-media").screenshot());
  await ui.locator("[data-world-avatar]").selectOption("simpsons");
  await expect(scene).toHaveAttribute("data-avatar", "simpsons");
  for (let i = 0; i < 4; i++) {
    await canvas.focus();
    await canvas.press("d");
  }
  await expect(stage).toHaveAttribute("data-dropped-records", "0,1,2,3");
  await page.locator('[data-home-desk-mode="2d"]').click();
  await expect(stage.locator("[data-home-record-card]")).toHaveCount(4);
  expect(await player.evaluate((e) => e.inert)).toBe(false);
  await expect(source).toBeVisible();
  await expect.poll(() => playerScene.evaluate((e) => e.getRecordEvidence().running)).toBe(true);
  await page.locator('[data-home-desk-mode="3d"]').click();
  expect((await evidence(scene)).avatarId).toBe("simpsons");
  expect((await evidence(scene)).dropped).toEqual([0, 1, 2, 3]);
  await ui.locator('[data-world-paper="0"]').click();
  await expect(scene).toHaveAttribute("data-focused-desk-object", "artifact-0");
  await ui.locator('[data-world-paper="0"]').click();
  await expect(page).toHaveURL(/\/projects\/designweaver\//);
  expect(errors).toEqual([]);
});

for (const persisted of [true, false]) {
  test(`coastal home: an initial room load ${persisted ? "survives a persisted return" : "aborts quietly on teardown"}`, async ({
    page,
  }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    await preparePage(page, "light");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.setSystemTime(new Date("2026-10-01T13:20:00-07:00"));
    let releaseRoom, roomRequested;
    const gate = new Promise((resolve) => (releaseRoom = resolve));
    const request = new Promise((resolve) => (roomRequested = resolve));
    const failed = [];
    page.on("requestfailed", (request) => failed.push(request.url()));
    await page.route("**/models/home/room-study.glb", async (route) => {
      roomRequested();
      await gate;
      await route.continue().catch(() => {});
    });
    await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.__coastalUnavailableEvents = 0;
      document.addEventListener("home-scene-unavailable", () => window.__coastalUnavailableEvents++);
    });
    await page.locator('[data-home-desk-mode="3d"]').click();
    await request;
    const scene = page.locator("[data-home-desk-scene]"),
      stage = page.locator("[data-home-artifact-stage]");
    await expect.poll(() => evidence(scene).then((e) => e.actorCount)).toBe(1);
    const before = await evidence(scene);
    await expect(scene).toHaveAttribute("data-scene-state", "loading");
    await page.evaluate((persisted) => {
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted }));
      if (persisted) window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    }, persisted);
    releaseRoom();
    if (persisted) {
      await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
      await expect(stage).toHaveAttribute("data-desk-mode", "3d");
      await expect(scene.locator("canvas")).toHaveCount(1);
      const after = await evidence(scene);
      expect(after.actorCount).toBe(1);
      expect(after.avatarId).toBe(before.avatarId);
      expect(after.currentRecord).toBe(before.currentRecord);
      expect(failed.some((url) => url.includes("room-study.glb"))).toBe(false);
      await capture(testInfo, "initial-load-cached-return", await page.locator(".home-hero-media").screenshot());
    } else {
      await expect(scene.locator("canvas")).toHaveCount(0);
      await expect.poll(() => failed.some((url) => url.includes("room-study.glb"))).toBe(true);
      await page.waitForTimeout(250);
      expect(await scene.evaluate((e) => Boolean(e.getSceneEvidence))).toBe(false);
    }
    expect(await page.evaluate(() => window.__coastalUnavailableEvents)).toBe(0);
    expect(errors).toEqual([]);
  });
}

test("coastal home: the gym frames the face and full exercise poses, then restores the normal lens", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page, { motion: "no-preference", time: "2026-10-02T13:20:00-07:00" });
  await settleRoomModels(scene);
  await explore(ui);
  await ui.locator("[data-world-avatar]").selectOption("ghibli");
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 2000);
  await ui.locator("[data-world-pause]").click();
  const rows = [];
  for (const [seconds, phase] of [
    [12, "pull-ups"],
    [26, "rest"],
    [38, "dips"],
    [60, "dumbbell set"],
  ]) {
    // Compose at the gym while paused, then advance the actual rig. This
    // isolates camera/pose framing from an incidental journey out of study.
    await ui.locator("[data-world-activity]").selectOption("reading");
    await ui.locator("[data-world-activity]").selectOption("workout");
    await ui.locator("[data-world-pause]").click();
    await canvas.scrollIntoViewIfNeeded();
    await page.clock.runFor(100);
    await page.clock.fastForward(seconds * 1000 - 100);
    await page.clock.runFor(500);
    await ui.locator("[data-world-pause]").click();
    await canvas.scrollIntoViewIfNeeded();
    await page.clock.runFor(100);
    const pose = await evidence(scene);
    expect(pose.activityPhase).toBe(phase);
    expect(pose.cameraFov).toBe(44);
    const framed = await scene.evaluate(async (element) => {
      const state = element.getSceneEvidence(),
        THREE = await import("/assets/js/three.module.min.js"),
        camera = new THREE.PerspectiveCamera(state.cameraFov, state.canvasWidth / state.canvasHeight, 0.05, 300);
      camera.position.fromArray(state.camera);
      camera.lookAt(new THREE.Vector3(...state.target));
      camera.updateMatrixWorld(true);
      return Object.fromEntries(
        ["Head", "HandL", "HandR", "FootL", "FootR"].map((name) => {
          const p = new THREE.Vector3(...state.joints[name]).project(camera);
          return [name, { x: (p.x + 1) / 2, y: (1 - p.y) / 2, depth: p.z }];
        })
      );
    });
    for (const point of Object.values(framed)) {
      expect(point.x).toBeGreaterThan(0.075);
      expect(point.x).toBeLessThan(0.925);
      expect(point.y).toBeGreaterThan(0.075);
      expect(point.y).toBeLessThan(0.925);
      expect(point.depth).toBeLessThan(1);
    }
    const front = (pose.camera[2] - pose.joints.Head[2]) / Math.hypot(pose.camera[0] - pose.joints.Head[0], pose.camera[2] - pose.joints.Head[2]);
    expect(front).toBeGreaterThan(0.25);
    const image = await canvas.screenshot({ path: testInfo.outputPath(`gym-${phase.replaceAll(" ", "-")}.png`) });
    const metrics = screenshotMetrics(image);
    expect(metrics.uniqueColors).toBeGreaterThan(60);
    expect(metrics.luminanceVariance).toBeGreaterThan(80);
    rows.push({ seconds, phase, pose, framed });
  }
  const beforeDrag = await canvas.screenshot();
  const orbitRows = [{ key: "arrival", state: await evidence(scene) }];
  for (const key of [
    "ArrowLeft",
    "ArrowLeft",
    "ArrowLeft",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowLeft",
    "ArrowLeft",
    "ArrowLeft",
    "ArrowLeft",
    "ArrowLeft",
  ]) {
    await canvas.press(key);
    await page.clock.runFor(100);
    const state = await evidence(scene),
      previous = orbitRows.at(-1).state;
    expect(state.framePending).toBe(false);
    const displacement = Math.hypot(...state.camera.map((v, index) => v - previous.camera[index]));
    orbitRows.push({ key, displacement, state });
    fs.writeFileSync(testInfo.outputPath("gym-orbit-continuity.json"), JSON.stringify(orbitRows, null, 2));
    if (displacement >= 1.5) await canvas.screenshot({ path: testInfo.outputPath("gym-orbit-jump.png") });
    expect(displacement).toBeLessThan(1.5);
    if (orbitRows.length === 7) {
      expect(state.cameraOrbit.radius).toBeCloseTo(orbitRows[0].state.cameraOrbit.radius, 8);
      expect(state.cameraOrbit.yaw).toBeCloseTo(orbitRows[0].state.cameraOrbit.yaw, 8);
    }
  }
  await canvas.press("ArrowLeft");
  await page.clock.runFor(100);
  const afterDrag = await canvas.screenshot({ path: testInfo.outputPath("gym-orbit.png") });
  expect(screenshotDiffRatio(beforeDrag, afterDrag)).toBeGreaterThan(0.01);
  await ui.locator('[data-world-room="gym"]').click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(100);
  const beforeZoom = await canvas.screenshot();
  await canvas.press("+");
  await page.clock.runFor(100);
  const afterZoom = await canvas.screenshot({ path: testInfo.outputPath("gym-zoom.png") });
  expect(screenshotDiffRatio(beforeZoom, afterZoom)).toBeGreaterThan(0.01);
  await ui.locator('[data-world-room="study"]').click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(100);
  expect((await evidence(scene)).cameraFov).toBe(38);
  await page.locator("[data-world-view]").click();
  await page.clock.runFor(100);
  expect((await evidence(scene)).cameraFov).toBe(38);
  fs.writeFileSync(testInfo.outputPath("gym-framing.json"), JSON.stringify({ rows, errors }, null, 2));
  expect(errors).toEqual([]);
});

for (const activity of ["breakfast", "workout"]) {
  test(`coastal home: ${activity} choreography resumes through visibility and mode recovery`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    const { scene, canvas, ui } = await openHome(page, { motion: "no-preference", time: "2026-10-02T11:45:00-07:00" });
    await settleRoomModels(scene);
    await explore(ui);
    await ui.locator("[data-world-avatar]").selectOption("ghibli");
    await expect(scene).toHaveAttribute("data-avatar", "ghibli");
    await ui.locator("[data-world-activity]").selectOption(activity);
    await canvas.scrollIntoViewIfNeeded();
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 2000);
    await page.clock.fastForward(activity === "breakfast" ? 43000 : 55000);
    await page.clock.runFor(700);
    const expectedPhase = activity === "breakfast" ? "coffee by the ocean" : "dumbbell set";
    await expect.poll(async () => (await evidence(scene)).activityPhase).toBe(expectedPhase);
    const before = await evidence(scene);
    await canvas.screenshot({ path: testInfo.outputPath("before-recovery.png") });
    const samples = [];
    for (const recovery of ["offscreen", "mode", "hidden", "retained"]) {
      const frozen = await evidence(scene);
      if (recovery === "offscreen") {
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
        await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
        await page.clock.runFor(1000);
        expect((await evidence(scene)).animationSeconds).toBe(frozen.animationSeconds);
        await canvas.scrollIntoViewIfNeeded();
      } else if (recovery === "mode") {
        await page.locator('[data-home-desk-mode="2d"]').click();
        await page.clock.runFor(1000);
        expect((await evidence(scene)).animationSeconds).toBe(frozen.animationSeconds);
        await page.locator('[data-home-desk-mode="3d"]').click();
        await canvas.scrollIntoViewIfNeeded();
      } else if (recovery === "hidden") {
        await page.evaluate(() => {
          Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await page.clock.runFor(1000);
        expect((await evidence(scene)).animationSeconds).toBe(frozen.animationSeconds);
        await page.evaluate(() => {
          delete document.hidden;
          document.dispatchEvent(new Event("visibilitychange"));
        });
      } else {
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
        await page.clock.runFor(1000);
        expect((await evidence(scene)).animationSeconds).toBe(frozen.animationSeconds);
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
      }
      await page.clock.runFor(700);
      const after = await evidence(scene);
      samples.push({ recovery, before: frozen, after });
      await canvas.screenshot({ path: testInfo.outputPath(`after-${recovery}.png`) });
      fs.writeFileSync(testInfo.outputPath("activity-continuity.json"), JSON.stringify({ activity, before, samples, errors }, null, 2));
      expect(after.activityPhase).toBe(expectedPhase);
      expect(after.activity).toBe(activity);
      expect(after.traveling).toBe(false);
      expect(after.animationSeconds - frozen.animationSeconds).toBeLessThan(1);
      expect(after.cupOwner).toBe(before.cupOwner);
      expect(after.weightOwner).toBe(before.weightOwner);
      expect(after.joints.Root).toEqual(before.joints.Root);
    }
    expect(errors).toEqual([]);
  });
}

for (const activity of ["breakfast", "workout"]) {
  test(`coastal home: pausing ${activity} keeps the held object and resumes its phase`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    const { scene, canvas, ui } = await openHome(page, { motion: "no-preference", time: "2026-10-02T11:45:00-07:00" });
    await settleRoomModels(scene);
    await explore(ui);
    await ui.locator("[data-world-avatar]").selectOption("ghibli");
    await expect(scene).toHaveAttribute("data-avatar", "ghibli");
    await ui.locator("[data-world-activity]").selectOption(activity);
    await canvas.scrollIntoViewIfNeeded();
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 2000);
    await page.clock.fastForward(activity === "breakfast" ? 43000 : 55000);
    await page.clock.runFor(700);
    const before = await evidence(scene);
    const key = activity === "breakfast" ? "cupPosition" : "weightPosition";
    const owner = activity === "breakfast" ? "cupOwner" : "weightOwner";
    expect(before[owner]).toBe("hand");
    await canvas.screenshot({ path: testInfo.outputPath("before-pause.png") });
    await ui.locator("[data-world-pause]").click();
    await canvas.scrollIntoViewIfNeeded();
    await page.clock.runFor(500);
    const paused = await evidence(scene);
    await canvas.screenshot({ path: testInfo.outputPath("paused.png") });
    fs.writeFileSync(testInfo.outputPath("held-object-pause.json"), JSON.stringify({ activity, before, paused, errors }, null, 2));
    expect(paused.activityPhase).toBe(before.activityPhase);
    expect(paused[owner]).toBe("hand");
    expect(paused[key]).toEqual(before[key]);
    expect(paused.joints.HandR).toEqual(before.joints.HandR);
    expect(paused.animationSeconds).toBe(before.animationSeconds);
    await ui.locator("[data-world-pause]").click();
    await canvas.scrollIntoViewIfNeeded();
    await page.clock.runFor(500);
    const resumed = await evidence(scene);
    fs.writeFileSync(testInfo.outputPath("held-object-pause.json"), JSON.stringify({ activity, before, paused, resumed, errors }, null, 2));
    expect(resumed.activityPhase).toBe(before.activityPhase);
    expect(resumed[owner]).toBe("hand");
    expect(resumed.animationSeconds - before.animationSeconds).toBeLessThan(0.6);
    expect(Math.hypot(...resumed[key].map((v, i) => v - resumed.joints.HandR[i]))).toBeLessThan(0.07);
    await ui.locator("[data-world-pause]").click();
    await ui.locator("[data-world-activity]").selectOption("reading");
    await canvas.scrollIntoViewIfNeeded();
    await page.clock.runFor(100);
    const composed = await evidence(scene);
    const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../assets/models/home/manifest.json"), "utf8"));
    const rest = activity === "breakfast" ? config.equipment.coffee.cup : config.equipment.dumbbell.rest;
    expect(composed.activity).toBe("reading");
    expect(composed[owner]).toBe(activity === "breakfast" ? "counter" : "rack");
    expect(composed[key]).toEqual(rest);
    fs.writeFileSync(testInfo.outputPath("held-object-pause.json"), JSON.stringify({ activity, before, paused, resumed, composed, errors }, null, 2));
    expect(errors).toEqual([]);
  });
}

test("coastal home: recovery preserves a stair journey and composes a changed clock activity", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas } = await openHome(page, { motion: "no-preference" });
  await settleRoomModels(scene);
  await page.clock.setSystemTime(new Date("2026-09-11T18:15:01-07:00"));
  await page.clock.fastForward(30001);
  await expect(scene).toHaveAttribute("data-animation", "walk");
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
  let walking = await evidence(scene);
  for (let i = 0; i < 40 && !(walking.navigation?.position[1] > 0.45 && walking.navigation.position[1] < 2); i++) {
    await page.clock.fastForward(500);
    walking = await evidence(scene);
  }
  expect(walking.traveling).toBe(true);
  expect(walking.navigation.position[1]).toBeGreaterThan(0.45);
  expect(walking.navigation.position[1]).toBeLessThan(2);
  await explore(page.locator("[data-home-world-controls]"));
  await page.locator("[data-world-pause]").click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(1000);
  const pausedJourney = await evidence(scene);
  expect(pausedJourney.traveling).toBe(true);
  expect(pausedJourney.navigation.position).toEqual(walking.navigation.position);
  expect(pausedJourney.animationSeconds).toBe(walking.animationSeconds);
  await page.locator("[data-world-pause]").click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(100);
  walking = await evidence(scene);
  await canvas.screenshot({ path: testInfo.outputPath("before-stair-recovery.png") });
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
  await page.clock.runFor(1000);
  expect((await evidence(scene)).animationSeconds).toBe(walking.animationSeconds);
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(100);
  const resumed = await evidence(scene);
  fs.writeFileSync(testInfo.outputPath("journey-continuity.json"), JSON.stringify({ walking, resumed }, null, 2));
  expect(resumed.traveling).toBe(true);
  expect(resumed.navigation.progress).toBeGreaterThanOrEqual(walking.navigation.progress);
  expect(resumed.navigation.progress - walking.navigation.progress).toBeLessThan(0.015);
  expect(Math.hypot(...resumed.navigation.position.map((value, i) => value - walking.navigation.position[i]))).toBeLessThan(0.3);
  await canvas.screenshot({ path: testInfo.outputPath("after-stair-recovery.png") });
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.setSystemTime(new Date("2026-09-11T19:00:01-07:00"));
  await page.clock.runFor(1000);
  expect((await evidence(scene)).animationSeconds).toBe(resumed.animationSeconds);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(100);
  const changed = await evidence(scene);
  fs.writeFileSync(testInfo.outputPath("journey-continuity.json"), JSON.stringify({ walking, resumed, changed, errors }, null, 2));
  expect(changed.activity).toBe("dinner");
  expect(changed.traveling).toBe(false);
  expect(changed.navigation).toBe(null);
  expect(changed.animation).toBe("eat");
  expect(Math.abs(changed.joints.Root[1])).toBeLessThan(0.1);
  expect(errors).toEqual([]);
});

test("coastal home: live animation pauses offscreen and recovers after a hidden tab", async ({ page }) => {
  const { scene, canvas, ui } = await openHome(page, { motion: "no-preference" });
  // A newly streamed room legitimately requests one still redraw while paused.
  // Settle those loads before using frame counts to detect ongoing animation.
  await settleRoomModels(scene);
  const before = await canvas.screenshot();
  await page.waitForTimeout(650);
  expect(screenshotDiffRatio(before, await canvas.screenshot())).toBeGreaterThan(0.0002);
  await explore(ui);
  await ui.locator("[data-world-pause]").click();
  await expect(ui.locator("[data-world-pause]")).toHaveAttribute("aria-pressed", "true");
  await canvas.scrollIntoViewIfNeeded();
  // Pausing stops motion, but clock, layout, and companion updates can still
  // request a composed frame. Check the animation clock, then deliberately
  // cross the routine's 30-second refresh to prove a redraw stays still.
  await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
  const paused = await evidence(scene);
  await page.waitForTimeout(400);
  expect((await evidence(scene)).animationSeconds).toBe(paused.animationSeconds);
  await page.clock.fastForward(30000);
  await expect.poll(async () => (await evidence(scene)).frames).toBeGreaterThan(paused.frames);
  await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
  expect((await evidence(scene)).animationSeconds).toBe(paused.animationSeconds);
  await ui.locator("[data-world-pause]").click();
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await expect.poll(async () => canvas.evaluate((node) => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
  await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
  const offscreen = (await evidence(scene)).frames;
  await page.waitForTimeout(350);
  expect((await evidence(scene)).frames).toBe(offscreen);
  await canvas.scrollIntoViewIfNeeded();
  // Exercise both Page Visibility branches. Headless windows do not reliably
  // become hidden when another page is brought forward.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hiddenFrames = (await evidence(scene)).frames;
  await page.waitForTimeout(350);
  expect((await evidence(scene)).frames).toBe(hiddenFrames);
  await page.clock.setSystemTime(new Date("2026-09-12T12:00:00-07:00"));
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(scene).toHaveAttribute("data-activity", "sleep");
  await expect.poll(async () => (await evidence(scene)).frames).toBeGreaterThan(hiddenFrames);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await expect.poll(async () => (await evidence(scene)).frames).toBeGreaterThan(hiddenFrames + 1);
});

test("coastal home: touch pinch zoom changes the projection and returns to Now", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "One Chromium touch context exercises the two-pointer path.");
  const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const { scene, canvas, ui } = await openHome(page);
  const session = await context.newCDPSession(page);
  const box = await canvas.boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const before = await canvas.screenshot();
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 25, y, id: 0 },
      { x: x + 25, y, id: 1 },
    ],
  });
  for (const spread of [35, 45, 60, 75]) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - spread, y, id: 0 },
        { x: x + spread, y, id: 1 },
      ],
    });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await settle(page);
  expect(screenshotDiffRatio(before, await canvas.screenshot())).toBeGreaterThan(0.02);
  expect((await evidence(scene)).following).toBe(false);
  await explore(ui);
  await ui.locator("[data-world-now]").tap();
  expect((await evidence(scene)).following).toBe(true);
  await context.close();
});

for (const [failure, asset] of [
  ["mesh", "**/models/home/home-shell.glb"],
  ["decoder", "**/libs/draco/draco_decoder.wasm"],
]) {
  test(`coastal home: a failed ${failure} restores 2D and a retry creates one set of controls`, async ({ page }) => {
    await preparePage(page);
    await page.route(asset, (r) => r.abort());
    await page.goto(publicRouteUrl("/"));
    await page.locator('[data-home-desk-mode="3d"]').click();
    const stage = page.locator("[data-home-artifact-stage]");
    await expect(stage).toHaveAttribute("data-desk-mode", "2d");
    await expect(page.locator("#home-profile-image-container")).toBeVisible();
    await page.unroute(asset);
    await page.locator('[data-home-desk-mode="3d"]').click();
    await expect(page.locator("[data-home-desk-scene]")).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
    await expect(page.locator("[data-world-avatar] option")).toHaveCount(5);
    await expect(page.locator("[data-world-room-list] button")).toHaveCount(6);
  });
}

test("coastal home: a routine boundary walks through the home before settling into the onsen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Representative live transition; clock boundaries are covered separately.");
  const { scene, canvas, ui } = await openHome(page, { motion: "no-preference" });
  await settleRoomModels(scene);
  await page.clock.setSystemTime(new Date("2026-09-11T18:15:01-07:00"));
  await page.clock.fastForward(30001);
  await expect(scene).toHaveAttribute("data-animation", "walk");
  const start = (await evidence(scene)).joints.Root;
  await page.waitForTimeout(600);
  const moved = (await evidence(scene)).joints.Root;
  expect(Math.hypot(moved[0] - start[0], moved[2] - start[2])).toBeGreaterThan(0.1);
  await explore(ui);
  await ui.locator('[data-world-room="overview"]').click();
  await canvas.scrollIntoViewIfNeeded();
  await capture(testInfo, "walking-between-rooms", await canvas.screenshot());
  const climbSamples = [];
  try {
    await expect
      .poll(
        async () => {
          const sample = await evidence(scene);
          climbSamples.push({ frames: sample.frames, seconds: sample.animationSeconds, navigation: sample.navigation, root: sample.joints.Root });
          return sample.joints.Root[1];
        },
        { timeout: 25000 }
      )
      .toBeGreaterThan(0.5);
  } finally {
    await testInfo.attach("stair-timing", { body: JSON.stringify(climbSamples, null, 2), contentType: "application/json" });
  }
  await capture(testInfo, "walking-up-the-stair", await canvas.screenshot());
  await expect(scene).toHaveAttribute("data-animation", "soak", { timeout: 18000 });
  const soaked = await evidence(scene);
  expect(soaked.joints.Root[1] - soaked.activityFloor).toBeLessThan(-0.4);
  expect(soaked.activityFloor).toBe(2.6);
});
