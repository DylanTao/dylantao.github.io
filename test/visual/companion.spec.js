const fs = require("node:fs");
const { test, expect } = require("@playwright/test");
const { publicRouteUrl } = require("./public-routes");
const { collectRuntimeErrors } = require("./helpers");
const evidence = (page) => page.locator(".pip-companion").evaluate((e) => e.getCompanionEvidence());
async function open(page, { motion = "no-preference" } = {}) {
  const errors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: motion });
  await page.clock.install({ time: new Date("2026-09-11T15:45:00-07:00") });
  await page.route("**/livereload.js*", (r) => r.fulfill({ body: "" }));
  await page.goto(publicRouteUrl("/") + "?companion-lab=1&scene-lab=1&seed=41", { waitUntil: "networkidle" });
  await expect(page.locator(".pip-companion")).toHaveCount(1);
  return errors;
}
async function capture(page, testInfo, name) {
  const file = testInfo.outputPath(name + ".png");
  fs.mkdirSync(require("node:path").dirname(file), { recursive: true });
  await page.screenshot({ path: file });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

test("Pip: its project link opens a working motion playground with visible credits", async ({ page }, testInfo) => {
  const errors = await open(page);
  await page.locator(".home-portrait-frame").scrollIntoViewIfNeeded();
  const link = page.locator(".pip-hit");
  await expect(link).toHaveAttribute("href", /\/projects\/pip\/$/);
  await expect.poll(async () => (await evidence(page)).visible).toBe(true);
  await link.focus();
  await link.press("Enter");
  await expect(page).toHaveURL(/\/projects\/pip\/$/);
  const studio = page.locator("[data-pip-studio]");
  await studio.scrollIntoViewIfNeeded();
  await expect(studio).toHaveAttribute("data-renderer", "webgl");
  await expect.poll(async () => (await evidence(page)).owner).toBe("studio");
  await expect(page.locator(".pip-companion")).toHaveAttribute("data-visible", "false");
  const get = () => studio.evaluate((e) => e.getPipEvidence());
  const before = await get();
  await page.getByRole("button", { name: "Curious", exact: true }).click();
  await page.waitForTimeout(1100);
  const after = await get();
  expect(after.pose.gesture).toBe("curious");
  expect(Math.abs(after.pose.head[2] - before.pose.head[2])).toBeGreaterThan(0.12);
  await capture(page, testInfo, "pip-curiosity-playground");
  await page.getByRole("button", { name: "Let Pip nap", exact: true }).click();
  await expect(page.getByRole("button", { name: "Wake Pip up", exact: true })).toHaveAttribute("aria-pressed", "true");
  const asleep = await get();
  await page.waitForTimeout(300);
  expect((await get()).time).toBe(asleep.time);
  expect((await get()).pose.blink).toBe(1);
  await page.getByRole("button", { name: "Hello", exact: true }).click();
  await expect.poll(async () => (await get()).pose.gesture).toBe("hello");
  await expect(page.locator("#credits")).toContainText("Pollen Robotics");
  await expect(page.locator("#credits")).toContainText("Pixar");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("Pip: playground respects reduced motion and a failed model keeps the room usable", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/livereload.js*", (r) => r.fulfill({ body: "" }));
  await page.goto(publicRouteUrl("/projects/pip/"));
  const studio = page.locator("[data-pip-studio]");
  await studio.scrollIntoViewIfNeeded();
  await expect(studio).toHaveAttribute("data-renderer", "webgl");
  await page.getByRole("button", { name: "Curious", exact: true }).click();
  await expect(page.locator("[data-pip-status]")).toContainText("Reduced motion");
  const still = await studio.evaluate((e) => e.getPipEvidence());
  await page.waitForTimeout(250);
  expect((await studio.evaluate((e) => e.getPipEvidence())).pose).toEqual(still.pose);
  if (testInfo.project.name === "desktop-1440") {
    await studio.locator("canvas").evaluate((canvas) => {
      canvas.pipContextLossTest = canvas.getContext("webgl").getExtension("WEBGL_lose_context");
      canvas.pipContextLossTest.loseContext();
    });
    await expect(studio).toHaveAttribute("data-renderer", "poster");
    await expect(studio.locator(".pip-studio-gestures")).toBeHidden();
    await expect(studio.locator(".pip-studio-poster")).toBeVisible();
    await studio.locator("canvas").evaluate((canvas) => {
      canvas.pipContextLossTest.restoreContext();
      delete canvas.pipContextLossTest;
    });
    await expect(studio).toHaveAttribute("data-renderer", "webgl");
    await expect(studio.locator(".pip-studio-gestures")).toBeVisible();
    await page.route("**/models/pip/pip.glb", (r) => r.fulfill({ contentType: "model/gltf-binary", body: "invalid model" }));
    await page.goto(publicRouteUrl("/") + "?companion-lab=1");
    await page.getByRole("button", { name: "3D", exact: true }).click();
    const room = page.locator("[data-home-desk-scene]");
    await expect(room).toHaveAttribute("data-scene-state", "ready");
    await expect.poll(async () => (await evidence(page)).owner).toBe("page");
    await expect(page.locator(".home-world-pip-link")).toHaveAttribute("href", /\/projects\/pip\/$/);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
    await page.waitForTimeout(100);
  }
  expect(errors).toEqual([]);
});

test("Pip: 2D greeting, shaded companion, pointer curiosity and clear page bounds", async ({ page }, testInfo) => {
  const errors = await open(page);
  await expect(page.locator(".home-world-welcome")).toHaveText("Welcome to Sirui’s crib.");
  await page.locator(".home-portrait-frame").scrollIntoViewIfNeeded();
  await expect.poll(async () => (await evidence(page)).visible).toBe(true);
  const before = await evidence(page);
  expect(before.renderer).toBe("webgl");
  expect(
    await page.evaluate(
      ({ x, y }) =>
        [...document.querySelectorAll("#main a,#main button")].every((e) => {
          const r = e.getBoundingClientRect();
          return !r.width || !r.height || x + 24 <= r.left || x - 24 >= r.right || y + 30 <= r.top || y - 30 >= r.bottom;
        }),
      before
    )
  ).toBe(true);
  await page.mouse.move(Math.max(10, before.x - 140), Math.max(100, before.y - 75));
  await page.waitForTimeout(500);
  const after = await evidence(page);
  expect(Math.abs(after.gaze[0] - before.gaze[0])).toBeGreaterThan(0.03);
  expect(await page.evaluate(() => performance.getEntriesByType("resource").filter((r) => /three\.module|models\/home/.test(r.name)).length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await capture(page, testInfo, "pip-at-the-album");
  if (testInfo.project.name === "desktop-1440") {
    await page.locator(".pip-companion canvas").evaluate((c) => {
      c.pipRecoveryExtension = c.getContext("webgl").getExtension("WEBGL_lose_context");
      c.pipRecoveryExtension.loseContext();
    });
    await expect.poll(async () => (await evidence(page)).renderer).toBe("css");
    await page.locator(".pip-companion canvas").evaluate((c) => c.pipRecoveryExtension.restoreContext());
    await expect.poll(async () => (await evidence(page)).renderer).toBe("webgl");
  }
  expect(errors).toEqual([]);
});

test("Pip: a small accident restores the original card and text", async ({ page }, testInfo) => {
  const errors = await open(page);
  await page.locator(".home-artifact-stack").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const card = page.locator(".home-artifact-card").first(),
    text = await card.innerText(),
    href = await card.getAttribute("href");
  expect(await page.locator(".pip-companion").evaluate((e) => e.previewCompanion("bump"))).toBe(true);
  await expect.poll(async () => (await evidence(page)).repairing).toBe(true);
  await capture(page, testInfo, "pip-helps-fix-the-card");
  await expect.poll(async () => (await evidence(page)).repaired).toBe(1);
  expect(await card.innerText()).toBe(text);
  expect(await card.getAttribute("href")).toBe(href);
  expect(await card.evaluate((e) => e.getAnimations().length)).toBe(0);
  expect(errors).toEqual([]);
});

test("Pip: reduced motion is a still pose; hidden controls leave the tab order", async ({ page }, testInfo) => {
  const errors = await open(page, { motion: "reduce" });
  await page.locator(".home-portrait-frame").scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  const before = await evidence(page);
  await page.waitForTimeout(350);
  const after = await evidence(page);
  expect(after.frames - before.frames).toBeLessThan(3);
  expect(after.reduced).toBe(true);
  expect(after.repairing).toBe(false);
  if (after.visible) {
    await page.locator(".pip-hit").focus();
    await expect(page.locator(".pip-hit")).toBeFocused();
    await capture(page, testInfo, "pip-reduced-focus");
  }
  await page.locator('[data-home-desk-mode="3d"]').click();
  await expect(page.locator("[data-home-desk-scene]")).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
  await expect.poll(async () => (await evidence(page)).owner).toBe("world");
  expect(await page.locator(".pip-companion").evaluate((e) => e.inert)).toBe(true);
  expect(errors).toEqual([]);
});

test("Pip: one companion transfers between room and reading surface", async ({ page }, testInfo) => {
  const errors = await open(page);
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]");
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
  await expect.poll(async () => (await scene.evaluate((e) => e.getSceneEvidence())).companion?.visible).toBe(true);
  const rect = await scene.boundingBox();
  await page.mouse.move(rect.x + rect.width * 0.85, rect.y + rect.height * 0.25);
  await page.waitForTimeout(300);
  const info = await scene.evaluate((e) => e.getSceneEvidence());
  expect(info.ecology.wildlife).toEqual({ rabbits: 2, raccoons: 1, gulls: 5, shorebirds: 3 });
  expect(info.ecology.beachWidth).toBe(14);
  expect((await evidence(page)).visible).toBe(false);
  await capture(page, testInfo, "pip-in-the-room");
  await scene.evaluate((e) => scrollTo(0, scrollY + e.getBoundingClientRect().bottom + 140));
  await expect.poll(async () => (await evidence(page)).owner).toBe("page");
  await page.waitForTimeout(1000);
  await capture(page, testInfo, "pip-follows-the-reader");
  await page.locator('[data-home-desk-mode="2d"]').scrollIntoViewIfNeeded();
  await page.locator('[data-home-desk-mode="2d"]').click();
  await expect(page.locator(".pip-companion")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("Pip: graphics failure keeps an accessible composed companion", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === "webgl" ? null : original.call(this, type, ...args);
    };
  });
  const errors = await open(page, { motion: "reduce" });
  expect((await evidence(page)).renderer).toBe("css");
  await expect(page.locator("[data-home-artifact-stage]")).toHaveAttribute("data-desk-mode", "2d");
  expect(errors).toEqual([]);
});

test("Pip: nap and navigation persist; AI reading remains undecorated", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "One navigation sequence; viewport behavior is covered above.");
  const errors = await open(page);
  await page.locator(".home-portrait-frame").scrollIntoViewIfNeeded();
  await expect.poll(async () => (await evidence(page)).visible).toBe(true);
  await page.locator(".pip-hit").focus();
  await page.getByRole("button", { name: "Let Pip nap", exact: true }).click();
  expect((await evidence(page)).napping).toBe(true);
  await page.goto(publicRouteUrl("/blog/"));
  await expect.poll(async () => (await evidence(page)).napping).toBe(true);
  await page.goto(publicRouteUrl("/ai/"));
  await expect(page.locator(".pip-companion")).toHaveCount(0);
  expect(errors).toEqual([]);
});
