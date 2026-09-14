const { test, expect } = require("@playwright/test");
const { preparePage, collectRuntimeErrors, attachScreenshot, screenshotMetrics, screenshotDiffRatio } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const evidence = (host) => host.evaluate((e) => e.getCoastEvidence());
async function open(page, theme = "noon") {
  await preparePage(page, theme);
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const host = page.locator("footer [data-footer-coast]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  return host;
}
for (const theme of process.env.COAST_THEME ? [process.env.COAST_THEME] : ["morning", "noon", "afternoon", "evening"]) {
  test(`coastal footer: automatic ${theme} light and full width composition`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    const host = await open(page, theme);
    await page.waitForTimeout(2000);
    const info = await evidence(host);
    expect(info.theme).toBe(theme);
    expect(info.buildings).toBeGreaterThanOrEqual(10);
    if (theme === "morning") expect(info.office).toBe(false);
    if (theme === "noon" || theme === "afternoon") expect(info.office).toBe(true);
    await expect(host.locator("button")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "al-folio", exact: true })).toHaveCount(0);
    const box = await host.boundingBox();
    expect(box.x).toBe(0);
    expect(box.width).toBe(page.viewportSize().width);
    const footerGeometry = await host.evaluate((element) => {
      const footer = element.closest("footer").getBoundingClientRect();
      const scene = element.querySelector(".footer-coast__scene").getBoundingClientRect();
      return { gap: footer.bottom - scene.bottom, mask: getComputedStyle(element.querySelector(".footer-coast__scene")).maskImage };
    });
    expect(footerGeometry.gap, "The coast must reach the footer bottom").toBeLessThanOrEqual(1);
    expect(footerGeometry.mask).toBe("none");
    const image = await host.locator("canvas").screenshot(),
      metrics = screenshotMetrics(image);
    expect(metrics.uniqueColors).toBeGreaterThan(300);
    expect(metrics.luminanceVariance).toBeGreaterThan(100);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await attachScreenshot(page, testInfo, `coast-${theme}`, { locator: page.locator("footer") });
    expect(errors).toEqual([]);
  });
}
test("coastal scenes: lazy loading, automatic movement, offscreen pause and reversible reveal", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const errors = collectRuntimeErrors(page),
    requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await preparePage(page, "noon");
  await page.goto(publicRouteUrl("/"));
  expect(requests.filter((x) => /models\/la-jolla\/.*\.glb|footer-coast\/scene.mjs/.test(x))).toEqual([]);
  const host = page.locator("footer [data-footer-coast]");
  const started = Date.now();
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  const loadMs = Date.now() - started;
  await page.waitForTimeout(1800);
  const a = await host.locator("canvas").screenshot(),
    f = (await evidence(host)).frames;
  await page.waitForTimeout(2500);
  const fps = ((await evidence(host)).frames - f) / 2.5;
  expect(fps).toBeGreaterThan(0);
  expect(fps).toBeLessThan(33);
  expect(screenshotDiffRatio(a, await host.locator("canvas").screenshot(), { threshold: 0.03 })).toBeGreaterThan(0.0001);
  const revealed = (await evidence(host)).reveal;
  // Place the coast at the reveal boundary before measuring its response.
  // Page-level smooth scrolling has a separate, compositor-dependent duration.
  await host.evaluate((e) => scrollTo({ top: scrollY + e.getBoundingClientRect().top - innerHeight + 80, behavior: "instant" }));
  await page.waitForTimeout(1400);
  expect((await evidence(host)).reveal).toBeLessThan(revealed - 0.2);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(host).toHaveAttribute("data-running", "false");
  const still = (await evidence(host)).frames;
  await page.waitForTimeout(350);
  expect((await evidence(host)).frames).toBe(still);
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-running", "true");
  await testInfo.attach("performance", {
    body: JSON.stringify({
      loadMs,
      fps,
      viewport: page.viewportSize(),
      platform: "Local Chromium. Mobile viewport emulation, not physical-device measurement.",
    }),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});
test("La Jolla miniature: keyboard orbit, static reduced motion, and map attribution", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(publicRouteUrl("/projects/la-jolla/"));
  const host = page.locator("[data-miniature]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  await expect(host).toHaveAttribute("data-running", "false");
  await expect(host.getByRole("link", { name: "OpenStreetMap contributors" })).toBeVisible();
  const surface = host.locator(".footer-coast__scene");
  await surface.focus();
  const a = await surface.screenshot();
  await surface.press("ArrowLeft");
  await surface.press("ArrowLeft");
  expect((await evidence(host)).orbit[0]).toBeLessThan(0);
  expect(screenshotDiffRatio(a, await surface.screenshot())).toBeGreaterThan(0.01);
  await surface.press("Home");
  expect((await evidence(host)).orbit).toEqual([0, 0]);
  await attachScreenshot(page, testInfo, "atlas-miniature", { locator: host });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
test("coastal scenes: reduced motion and WebGL context recovery", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const host = await open(page, "evening");
  await expect(host).toHaveAttribute("data-running", "false");
  await page.waitForTimeout(500);
  const frames = (await evidence(host)).frames;
  await page.waitForTimeout(350);
  expect((await evidence(host)).frames).toBe(frames);
  await host.locator("canvas").evaluate((c) => {
    c.loss = c.getContext("webgl2").getExtension("WEBGL_lose_context");
    c.loss.loseContext();
  });
  await expect(host).toHaveAttribute("data-state", "fallback");
  await expect(host.locator(".footer-coast__poster")).toBeVisible();
  await host.locator("canvas").evaluate((c) => c.loss.restoreContext());
  await expect(host).toHaveAttribute("data-state", "ready");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(host).toHaveAttribute("data-running", "true");
});

test("La Jolla miniature: touch orbit preserves vertical page scrolling", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.goto(publicRouteUrl("/projects/la-jolla/"));
  const host = page.locator("[data-miniature]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  const surface = host.locator(".footer-coast__scene"),
    box = await surface.boundingBox();
  expect(await surface.evaluate((e) => getComputedStyle(e).touchAction)).toBe("pan-y");
  const session = await context.newCDPSession(page),
    x = box.x + box.width * 0.65,
    y = box.y + box.height * 0.5;
  const touch = (type, px, py) =>
    session.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: px, y: py, id: 0 }] });
  await touch("touchStart", x, y);
  for (let i = 1; i <= 8; i++) await touch("touchMove", x - i * 10, y);
  await touch("touchEnd");
  expect(Math.abs((await evidence(host)).orbit[0])).toBeGreaterThan(0.1);
  const previous = await page.evaluate(() => scrollY);
  await touch("touchStart", x, y);
  for (let i = 1; i <= 8; i++) await touch("touchMove", x, y - i * 12);
  await touch("touchEnd");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(previous + 25);
});
test("coastal scenes: missing model and no JavaScript retain real rendered fallbacks", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await page.route("**/models/la-jolla/la-jolla.glb", (r) => r.abort());
  await page.goto(publicRouteUrl("/"));
  const host = page.locator("footer [data-footer-coast]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "fallback", { timeout: 30000 });
  await expect.poll(() => host.locator("img").evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
  const staticPage = await context.newPage();
  await staticPage.goto(publicRouteUrl("/"));
  await expect(staticPage.locator("footer .footer-coast__poster")).toHaveCount(1);
  await expect(staticPage.locator("footer")).toContainText("Sirui Tao");
  await context.close();
  await page.goto(publicRouteUrl("/ai/"));
  await expect(page.locator("[data-footer-coast]")).toHaveCount(0);
});
