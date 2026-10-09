const fs = require("node:fs");
const { test, expect } = require("@playwright/test");
const { publicRouteUrl } = require("./public-routes");
const { collectRuntimeErrors, preparePage } = require("./helpers");
const { pauseSceneClock } = require("./scene-clock");
const evidence = (page) => page.locator(".pip-companion").evaluate((e) => e.getCompanionEvidence());

// P now lives on its project route. Default page-clearance, gestures and
// lifecycle coverage moved to duh.spec.js with the new public companion.
test("P: its former project address redirects to the current page", async ({ page }) => {
  await page.goto(publicRouteUrl("/projects/pip/") + "?from=archive#credits");
  await expect(page).toHaveURL(publicRouteUrl("/projects/p/") + "?from=archive#credits");
  await expect(page.locator("h1")).toContainText("A softer sort of company.");
});

test("P: public page journeys, interrupted portals, and reduced motion stay usable", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await page.route("**/livereload.js*", (r) => r.fulfill({ body: "" }));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(publicRouteUrl("/projects/p/"), { waitUntil: "networkidle" });
  const playground = page.locator(".pip-encounter");
  await playground.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Open a portal", exact: true }).click();
  await expect.poll(async () => (await evidence(page)).portalVisible).toBe(true);
  await expect.poll(async () => (await evidence(page)).travel).toBe("portal");
  await page.waitForTimeout(440);
  await capture(page, testInfo, "pip-paired-portals");
  await page.getByRole("button", { name: "Squeeze past", exact: true }).click();
  await expect.poll(async () => (await evidence(page)).travels.squeeze).toBeGreaterThan(0);
  await expect.poll(async () => (await evidence(page)).portalVisible).toBe(false);
  await capture(page, testInfo, "pip-squeeze-past-the-words");
  await page.mouse.wheel(0, 130);
  await expect.poll(async () => (await evidence(page)).portalVisible).toBe(false);
  await page.getByRole("button", { name: "A little bump", exact: true }).click();
  await expect.poll(async () => (await evidence(page)).repairing).toBe(true);
  const thought = page.locator(".pip-encounter-note"),
    original = await thought.innerText();
  await capture(page, testInfo, "pip-stumbles-then-helps");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => (await evidence(page)).repairing).toBe(false);
  expect(await thought.innerText()).toBe(original);
  expect(await thought.evaluate((e) => e.getAnimations().length)).toBe(0);
  await page.getByRole("button", { name: "Open a portal", exact: true }).click();
  await expect(page.locator("[data-pip-trip-status]")).toContainText("resting");
  expect((await evidence(page)).portalVisible).toBe(false);
  expect((await evidence(page)).travel).toBe("rest");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
async function open(page, { motion = "no-preference" } = {}) {
  const errors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: motion });
  await page.clock.install({ time: new Date("2026-09-11T15:45:00-07:00") });
  await page.route("**/livereload.js*", (r) => r.fulfill({ body: "" }));
  await page.goto(publicRouteUrl("/projects/p/") + "?companion-lab=1&seed=41", { waitUntil: "networkidle" });
  await expect(page.locator(".pip-companion")).toHaveCount(1);
  return errors;
}
async function capture(page, testInfo, name) {
  const file = testInfo.outputPath(name + ".png");
  fs.mkdirSync(require("node:path").dirname(file), { recursive: true });
  await page.screenshot({ path: file });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

test("P: its retained motion playground and visible credits work alongside duh", async ({ page }, testInfo) => {
  const errors = await open(page);
  const studio = page.locator("[data-pip-studio]");
  await studio.scrollIntoViewIfNeeded();
  await expect(studio).toHaveAttribute("data-renderer", "webgl");
  await expect.poll(async () => (await evidence(page)).owner).toBe("studio");
  await expect(page.locator(".pip-companion")).toHaveAttribute("data-visible", "false");
  const get = () => studio.evaluate((e) => e.getPipEvidence());
  // The installed test clock advances one RAF at a time. Software rendering
  // can consume the wall poll before reaching the authored 1.15–2.25s hold.
  // Drive that actual animation phase and capture its real rendered pose.
  await pauseSceneClock(page);
  await page.getByRole("button", { name: "Curious", exact: true }).click();
  await page.clock.runFor(1400);
  await expect
    .poll(
      async () => {
        const after = await get();
        return after.pose.gesture === "curious" && after.pose.head[2] > 0.2;
      },
      { timeout: 8000, intervals: [100, 200, 250] }
    )
    .toBe(true);
  const curious = await get();
  await capture(page, testInfo, "pip-curiosity-playground");
  await page.getByRole("button", { name: "Let P nap", exact: true }).click();
  await expect(page.getByRole("button", { name: "Wake P up", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.clock.runFor(100);
  const asleep = await get();
  await page.clock.runFor(300);
  expect((await get()).time).toBe(asleep.time);
  expect((await get()).pose.blink).toBe(1);
  await page.getByRole("button", { name: "Hello", exact: true }).click();
  await page.clock.runFor(100);
  await expect.poll(async () => (await get()).pose.gesture).toBe("hello");
  const proof = testInfo.outputPath("pip-gesture-evidence.json");
  fs.writeFileSync(proof, JSON.stringify({ curious, asleep, awake: await get(), performanceBenchmark: false }, null, 2));
  await testInfo.attach("pip-gesture-evidence", { path: proof, contentType: "application/json" });
  await expect(page.locator("#credits")).toContainText("Pollen Robotics");
  await expect(page.locator("#credits")).toContainText("Pixar");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("P: a partially visible playground sleeps until it owns the shared companion", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(publicRouteUrl("/projects/p/"), { waitUntil: "domcontentloaded" });
  const studio = page.locator("[data-pip-studio]");
  await expect.poll(() => studio.evaluate((e) => typeof e.getPipEvidence)).toBe("function");
  await studio.evaluate((e) => {
    const bottom = e.getBoundingClientRect().bottom + scrollY;
    window.scrollTo(0, bottom - 12);
  });
  await expect.poll(() => studio.evaluate((e) => e.getPipEvidence().visible)).toBe(true);
  await expect.poll(async () => (await evidence(page)).owner).toBe("page");
  await expect.poll(() => studio.evaluate((e) => e.getPipEvidence().running)).toBe(false);
  const idle = await studio.evaluate((e) => e.getPipEvidence());
  await page.waitForTimeout(250);
  expect((await studio.evaluate((e) => e.getPipEvidence())).frames).toBe(idle.frames);
  await capture(page, testInfo, "pip-studio-unowned-still");

  await studio.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await evidence(page)).owner).toBe("studio");
  await expect.poll(() => studio.evaluate((e) => e.getPipEvidence().frames)).toBeGreaterThan(idle.frames);
  await expect.poll(() => studio.evaluate((e) => e.getPipEvidence().running)).toBe(false);
  // Positive control: ownership return must wake the real rendered portrait.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => studio.evaluate((e) => e.getPipEvidence().running)).toBe(true);
  const moving = await studio.evaluate((e) => e.getPipEvidence());
  await expect.poll(() => studio.evaluate((e) => e.getPipEvidence().frames)).toBeGreaterThan(moving.frames);
  await page.getByRole("button", { name: "Let P nap", exact: true }).click();
  await expect.poll(() => studio.evaluate((e) => e.getPipEvidence().running)).toBe(false);
  const asleep = await studio.evaluate((e) => e.getPipEvidence());
  await page.waitForTimeout(250);
  expect((await studio.evaluate((e) => e.getPipEvidence())).time).toBe(asleep.time);
  await page.getByRole("button", { name: "Wake P up", exact: true }).click();
  await expect.poll(() => studio.evaluate((e) => e.getPipEvidence().running)).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => studio.evaluate((e) => e.getPipEvidence().running)).toBe(false);
  const hidden = await studio.evaluate((e) => e.getPipEvidence());
  await page.waitForTimeout(250);
  expect((await studio.evaluate((e) => e.getPipEvidence())).frames).toBe(hidden.frames);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => studio.evaluate((e) => e.getPipEvidence().running)).toBe(true);
  // Synthetic lifecycle coverage preserves the retained controller. It does
  // not assert that browser navigation actually admitted this page to BFCache.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  await expect.poll(() => studio.evaluate((e) => e.getPipEvidence().running)).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect.poll(() => studio.evaluate((e) => e.getPipEvidence().running)).toBe(true);
  await capture(page, testInfo, "pip-studio-owned-awake");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  await expect.poll(() => studio.evaluate((e) => e.getPipEvidence().running)).toBe(false);
  expect(errors).toEqual([]);
});

test("P: retained playground respects reduced motion and recovers its graphics context", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/livereload.js*", (r) => r.fulfill({ body: "" }));
  await page.goto(publicRouteUrl("/projects/p/"));
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
  }
  expect(errors).toEqual([]);
});
