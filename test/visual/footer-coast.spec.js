const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const { preparePage, collectRuntimeErrors, attachScreenshot, screenshotMetrics, screenshotDiffRatio } = require("./helpers");

const themes = process.env.COAST_THEME ? [process.env.COAST_THEME] : ["morning", "noon", "afternoon", "evening"];
async function open(page, theme = "noon", path = "./?cinematic=live") {
  await preparePage(page, theme);
  await page.addInitScript(() => sessionStorage.setItem("pip-napping", "1"));
  await page.goto(path, { waitUntil: "domcontentloaded" });
  const host = page.locator("[data-footer-coast]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  return host;
}

for (const theme of themes) {
  test(`coastal footer: ${theme}, composition and actual window light`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    const host = await open(page, theme);
    await page.waitForTimeout(1300);
    await page.getByRole("button", { name: "Pause coastal scene", exact: true }).click();
    await expect(host).toHaveAttribute("data-running", "false");
    const image = await host.locator("canvas").screenshot();
    const metrics = screenshotMetrics(image);
    expect(metrics.uniqueColors).toBeGreaterThan(300);
    expect(metrics.luminanceVariance).toBeGreaterThan(100);
    await attachScreenshot(page, testInfo, `coast-${theme}`, { locator: page.locator("footer") });
    const light = page.getByRole("button", { name: "Studio light on", exact: true });
    await light.focus();
    await light.press("Enter");
    await expect(page.getByRole("button", { name: "Studio light off", exact: true })).toHaveAttribute("aria-pressed", "false");
    const unlit = await host.locator("canvas").screenshot();
    expect(screenshotDiffRatio(image, unlit, { threshold: 0.02 })).toBeGreaterThan(0.00001);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    await testInfo.attach("render-metrics", {
      body: JSON.stringify({ theme, ...metrics, windowChangedPixels: screenshotDiffRatio(image, unlit, { threshold: 0.02 }) }, null, 2),
      contentType: "application/json",
    });
  });
}

test("coastal footer: lazy loading, moving pixels, pause and offscreen recovery", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "noon");
  await page.addInitScript(() => sessionStorage.setItem("pip-napping", "1"));
  await page.goto("./?cinematic=live", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  expect(requests.filter((url) => /models\/la-jolla\/la-jolla.glb|footer-coast\/scene.mjs/.test(url))).toEqual([]);
  const host = page.locator("[data-footer-coast]");
  const beforeLoad = Date.now();
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  const loadMs = Date.now() - beforeLoad;
  await page.waitForTimeout(1600);
  const first = await host.locator("canvas").screenshot();
  const frames = Number(await host.getAttribute("data-frames"));
  await page.waitForTimeout(2500);
  const fps = (Number(await host.getAttribute("data-frames")) - frames) / 2.5;
  expect(screenshotDiffRatio(first, await host.locator("canvas").screenshot(), { threshold: 0.03 })).toBeGreaterThan(0.001);
  expect(fps).toBeGreaterThan(0);
  expect(fps).toBeLessThan(33);
  await page.getByRole("button", { name: "Pause coastal scene" }).click();
  await page.waitForTimeout(100);
  const still = await host.getAttribute("data-frames");
  await page.waitForTimeout(350);
  expect(await host.getAttribute("data-frames")).toBe(still);
  await page.getByRole("button", { name: "Play coastal scene" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(host).toHaveAttribute("data-running", "false");
  const offscreen = await host.getAttribute("data-frames");
  await page.waitForTimeout(350);
  expect(await host.getAttribute("data-frames")).toBe(offscreen);
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-running", "true");
  // Exercise Page Visibility deterministically; headless pages do not reliably
  // become hidden when a second browser tab is brought forward.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(host).toHaveAttribute("data-running", "false");
  const hiddenFrames = await host.getAttribute("data-frames");
  await page.waitForTimeout(300);
  expect(await host.getAttribute("data-frames")).toBe(hiddenFrames);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(host).toHaveAttribute("data-running", "true");
  expect(errors).toEqual([]);
  const performancePath = testInfo.outputPath("performance.json");
  fs.writeFileSync(
    performancePath,
    JSON.stringify(
      {
        loadMs,
        observedFooterFps: fps,
        viewport: page.viewportSize(),
        platform: "Local Windows Chromium; emulated mobile, not a physical phone benchmark",
      },
      null,
      2
    )
  );
  await testInfo.attach("performance", {
    body: JSON.stringify(
      { loadMs, observedFooterFps: fps, viewport: page.viewportSize(), platform: "Local Windows Chromium; not a physical phone benchmark" },
      null,
      2
    ),
    contentType: "application/json",
  });
});

test("coastal footer: no JavaScript keeps the model render and footer links", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(testInfo.project.use.baseURL + "/");
  const host = page.locator("[data-footer-coast]");
  await host.scrollIntoViewIfNeeded();
  await expect(host.locator("img")).toBeVisible();
  await expect(host.locator(".footer-coast__actions")).toBeHidden();
  await expect(page.getByRole("link", { name: "al-folio", exact: true })).toBeVisible();
  await attachScreenshot(page, testInfo, "no-javascript", { locator: page.locator("footer") });
  await context.close();
});

test("coastal footer: phone can visit the villa and courts with touch and keyboard", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  const host = await open(page);
  await page.getByRole("button", { name: "Pause coastal scene" }).click();
  const surface = host.locator(".footer-coast__scene");
  const first = await surface.screenshot();
  await surface.focus();
  for (let i = 0; i < 5; i++) await surface.press("ArrowLeft");
  const west = await surface.screenshot();
  expect(screenshotDiffRatio(first, west)).toBeGreaterThan(0.1);
  await attachScreenshot(page, testInfo, "phone-west-coast", { locator: page.locator("footer") });
  const cdp = await page.context().newCDPSession(page);
  const box = await surface.boundingBox();
  const x = box.x + 300,
    y = box.y + box.height * 0.58;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - i * 35, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(screenshotDiffRatio(west, await surface.screenshot())).toBeGreaterThan(0.05);
  await page.getByRole("button", { name: "Studio light on", exact: true }).click();
  await attachScreenshot(page, testInfo, "phone-studio-return", { locator: page.locator("footer") });
  expect(await surface.getAttribute("tabindex")).toBe("0");
});

test("coastal footer: reduced motion, context loss and recovery", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const host = await open(page, "evening");
  await expect(host).toHaveAttribute("data-running", "false");
  const still = await host.getAttribute("data-frames");
  await page.waitForTimeout(400);
  expect(await host.getAttribute("data-frames")).toBe(still);
  await attachScreenshot(page, testInfo, "reduced-motion", { locator: page.locator("footer") });
  await host.locator("canvas").evaluate((canvas) => {
    canvas.lossTest = canvas.getContext("webgl2").getExtension("WEBGL_lose_context");
    canvas.lossTest.loseContext();
  });
  await expect(host).toHaveAttribute("data-state", "fallback");
  await expect(host.locator("img")).toBeVisible();
  await expect(host.locator(".footer-coast__actions")).toBeHidden();
  await attachScreenshot(page, testInfo, "graphics-fallback", { locator: page.locator("footer") });
  await host.locator("canvas").evaluate((canvas) => canvas.lossTest.restoreContext());
  await expect(host).toHaveAttribute("data-state", "ready");
  await expect(host).toHaveAttribute("data-running", "false");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(host).toHaveAttribute("data-running", "true");
});

test("coastal footer: failed model leaves an illustrated footer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await preparePage(page, "noon");
  await page.route("**/models/la-jolla/la-jolla.glb", (route) => route.abort());
  await page.goto("./");
  const host = page.locator("[data-footer-coast]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "fallback");
  await expect.poll(async () => host.locator("img").evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole("link", { name: "al-folio", exact: true })).toBeVisible();
});

test("coastal footer: shared reading routes and undecorated AI surface", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const errors = collectRuntimeErrors(page);
  for (const path of ["./projects/pip/", "./blog/", "./publications/"]) {
    await open(page, "noon", path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  await page.goto("./ai/");
  await expect(page.locator("[data-footer-coast]")).toHaveCount(0);
  expect(errors).toEqual([]);
});
