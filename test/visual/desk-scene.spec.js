const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { preparePage, collectRuntimeErrors, screenshotDiffRatio, screenshotMetrics } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

async function capture(testInfo, name, buffer) {
  const file = testInfo.outputPath(name + ".png");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}
async function openHome(page, { motion = "reduce", theme = "light" } = {}) {
  await preparePage(page, theme);
  await page.emulateMedia({ reducedMotion: motion });
  await page.clock.install({ time: new Date("2026-09-11T17:45:00-07:00") });
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
async function explore(ui) {
  const details = ui.locator("details").first();
  if (!(await details.getAttribute("open"))) {
    if (!(await details.evaluate((e) => e.open))) await details.locator("summary").first().click();
  }
}
async function settle(page) {
  await page.waitForTimeout(200);
}

test("coastal home: quiet public controls, wall portrait and a new arrival on refresh", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-home-artifact-stage]")).toHaveAttribute("data-desk-mode", "2d");
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]");
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
  const first = (await evidence(scene)).avatarId;
  const ui = page.locator("[data-home-world-controls]");
  await expect(ui.locator("button:visible")).toHaveCount(5);
  await expect(ui.locator("select:visible")).toHaveCount(0);
  await expect.poll(async () => (await evidence(scene)).portrait).toContain(`/portraits/${first}.png`);
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
  expect(errors).toEqual([]);
});

for (const theme of ["light", "dark"]) {
  test(`coastal home: ${theme} composition, connected rooms, actual orbit and zoom`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    const { scene, canvas, stage, ui } = await openHome(page, { theme });
    await expect.poll(async () => (await evidence(scene)).roomCount).toBe(6);
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

test("coastal home: all five avatars and three material styles retain one actor and album state", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page);
  await explore(ui);
  await ui.locator("[data-world-activity]").selectOption("workout");
  for (const avatar of ["lizard", "south-park", "simpsons", "ghibli", "rick-and-morty", "lizard"]) {
    await ui.locator("[data-world-avatar]").selectOption(avatar);
    await expect(scene).toHaveAttribute("data-avatar", avatar);
    await expect.poll(async () => (await evidence(scene)).portrait).toContain(`/portraits/${avatar}.png`);
    await canvas.scrollIntoViewIfNeeded();
    await settle(page);
    const info = await evidence(scene);
    expect(info.actorCount).toBe(1);
    expect(info.animations).toHaveLength(10);
    expect(info.joints.FootR[1]).toBeGreaterThan(0.06);
    expect(info.joints.FootR[1]).toBeLessThan(0.16);
    await capture(testInfo, avatar, await canvas.screenshot());
  }
  let before = await canvas.screenshot();
  for (const style of ["realistic", "illustrated", "architectural", "illustrated", "architectural"]) {
    await ui.locator(`[data-world-style="${style}"]`).click();
    await canvas.scrollIntoViewIfNeeded();
    await settle(page);
    await expect(scene).toHaveAttribute("data-render-style", style);
    const after = await canvas.screenshot();
    expect(screenshotDiffRatio(before, after)).toBeGreaterThan(0.005);
    before = after;
    expect((await evidence(scene)).currentRecord).toBe(0);
    expect((await evidence(scene)).avatarId).toBe("lizard");
    expect((await evidence(scene)).portrait).toContain("/portraits/lizard.png");
    await capture(testInfo, style, after);
  }
  await page.locator('[data-home-desk-mode="2d"]').click();
  await page.locator('[data-home-desk-mode="3d"]').click();
  expect((await evidence(scene)).avatarId).toBe("lizard");
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
      expect(info.joints.HandR[1]).toBeGreaterThan(0.8);
      expect(info.joints.HandR[1]).toBeLessThan(0.96);
      expect(info.joints.HandR[2]).toBeLessThan(-1.8);
    }
    if (activity === "sleep") expect(info.joints.Root[1]).toBeGreaterThan(0.5);
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

test("coastal home: album focus, playback, discovery, mode sharing, and paper navigation", async ({ page }) => {
  const { scene, canvas, stage, ui } = await openHome(page);
  await explore(ui);
  await ui.locator(".home-world-objects > summary").click();
  const record = ui.locator('[data-world-record="0"]');
  await record.click();
  await expect(scene).toHaveAttribute("data-focused-desk-object", "record-0");
  await record.click();
  await expect(scene).toHaveAttribute("data-record-spinning", "true");
  await ui.locator("[data-world-avatar]").selectOption("simpsons");
  await expect(scene).toHaveAttribute("data-avatar", "simpsons");
  for (let i = 0; i < 4; i++) {
    await canvas.focus();
    await canvas.press("d");
  }
  await expect(stage).toHaveAttribute("data-dropped-records", "0,1,2,3");
  await page.locator('[data-home-desk-mode="2d"]').click();
  await expect(stage.locator("[data-home-record-card]")).toHaveCount(4);
  await page.locator('[data-home-desk-mode="3d"]').click();
  expect((await evidence(scene)).avatarId).toBe("simpsons");
  expect((await evidence(scene)).dropped).toEqual([0, 1, 2, 3]);
  await ui.locator('[data-world-paper="0"]').click();
  await expect(scene).toHaveAttribute("data-focused-desk-object", "artifact-0");
  await ui.locator('[data-world-paper="0"]').click();
  await expect(page).toHaveURL(/\/projects\/designweaver\//);
});

test("coastal home: live animation pauses offscreen and recovers after a hidden tab", async ({ page }) => {
  const { scene, canvas, ui } = await openHome(page, { motion: "no-preference" });
  const before = await canvas.screenshot();
  await page.waitForTimeout(650);
  expect(screenshotDiffRatio(before, await canvas.screenshot())).toBeGreaterThan(0.0002);
  await explore(ui);
  await ui.locator("[data-world-pause]").click();
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const paused = (await evidence(scene)).frames;
  await page.waitForTimeout(400);
  expect((await evidence(scene)).frames).toBe(paused);
  await ui.locator("[data-world-pause]").click();
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(250);
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
  await ui.locator("[data-world-now]").tap();
  expect((await evidence(scene)).following).toBe(true);
  await context.close();
});

test("coastal home: a failed asset restores 2D and a retry creates one set of controls", async ({ page }) => {
  await preparePage(page);
  await page.route("**/models/home/home-shell.glb", (r) => r.abort());
  await page.goto(publicRouteUrl("/"));
  await page.locator('[data-home-desk-mode="3d"]').click();
  const stage = page.locator("[data-home-artifact-stage]");
  await expect(stage).toHaveAttribute("data-desk-mode", "2d");
  await expect(page.locator("#home-profile-image-container")).toBeVisible();
  await page.unroute("**/models/home/home-shell.glb");
  await page.locator('[data-home-desk-mode="3d"]').click();
  await expect(page.locator("[data-home-desk-scene]")).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
  await expect(page.locator("[data-world-avatar] option")).toHaveCount(5);
  await expect(page.locator("[data-world-room-list] button")).toHaveCount(6);
});

test("coastal home: a routine boundary walks through the home before settling into the onsen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Representative live transition; clock boundaries are covered separately.");
  const { scene, canvas, ui } = await openHome(page, { motion: "no-preference" });
  await expect.poll(async () => (await evidence(scene)).roomCount).toBe(6);
  await page.clock.setSystemTime(new Date("2026-09-11T18:15:01-07:00"));
  await page.clock.fastForward(30001);
  await expect(scene).toHaveAttribute("data-animation", "walk");
  const start = (await evidence(scene)).joints.Root;
  await page.waitForTimeout(600);
  const moved = (await evidence(scene)).joints.Root;
  expect(Math.hypot(moved[0] - start[0], moved[2] - start[2])).toBeGreaterThan(0.1);
  await ui.locator('[data-world-room="overview"]').click();
  await canvas.scrollIntoViewIfNeeded();
  await capture(testInfo, "walking-between-rooms", await canvas.screenshot());
  await expect(scene).toHaveAttribute("data-animation", "soak", { timeout: 12000 });
  expect((await evidence(scene)).joints.Root[1]).toBeLessThan(-0.4);
});
