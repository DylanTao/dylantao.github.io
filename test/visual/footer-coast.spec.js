const { test, expect, chromium } = require("@playwright/test");
const { writeFile } = require("node:fs/promises");
const { preparePage, collectRuntimeErrors, attachScreenshot, screenshotMetrics, screenshotDiffRatio } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const evidence = (host) => host.evaluate((e) => e.getCoastEvidence());
const coastModels = /\/models\/la-jolla\/[^/?]+\.glb(?:\?.*)?$/;
async function open(page, theme = "noon") {
  await preparePage(page, theme);
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const host = page.locator("footer [data-footer-coast]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  return host;
}

async function compareLoadingPreview(page, testInfo, { route = "/", selector = "footer [data-footer-coast]", theme = "noon", name }) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await preparePage(page, theme);
  let release;
  const loading = new Promise((resolve) => (release = resolve));
  await page.route(coastModels, async (request) => {
    await loading;
    await request.continue();
  });
  try {
    await page.goto(publicRouteUrl(route), { waitUntil: "domcontentloaded" });
    const host = page.locator(selector);
    await host.scrollIntoViewIfNeeded();
    const poster = host.locator(".footer-coast__poster");
    await expect.poll(() => poster.evaluate((image) => image.currentSrc)).toContain(`-${theme}.webp`);
    await poster.evaluate((image) => image.decode());
    await expect(host).toHaveAttribute("data-state", "still");
    const surface = host.locator(".footer-coast__scene");
    const before = await surface.screenshot();
    release();
    await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
    await expect(poster).toBeHidden();
    const after = await surface.screenshot();
    // Compare actual pixels: a centered thumbnail, shifted landmark, missing
    // panorama or wrong theme cannot pass by merely reporting 'ready'.
    const changed = screenshotDiffRatio(before, after);
    await writeFile(testInfo.outputPath(`${name}-loading.png`), before);
    await writeFile(testInfo.outputPath(`${name}-ready.png`), after);
    await writeFile(testInfo.outputPath(`${name}-difference.json`), JSON.stringify({ changed, theme, viewport: page.viewportSize() }));
    expect(changed, "The still and first rendered composition must match").toBeLessThan(0.045);
    await testInfo.attach(`${name}-loading`, { body: before, contentType: "image/png" });
    await testInfo.attach(`${name}-ready`, { body: after, contentType: "image/png" });
    await testInfo.attach(`${name}-difference`, {
      body: JSON.stringify({ changed, theme, viewport: page.viewportSize() }),
      contentType: "application/json",
    });
  } finally {
    release();
    await page.unroute(coastModels);
  }
}

test("coastal loading: responsive, theme-matched stills preserve the first frame", async ({ page }, testInfo) => {
  const themes = { "desktop-1440": "morning", "laptop-1280": "noon", "tablet-768": "afternoon", "mobile-390": "evening" };
  await compareLoadingPreview(page, testInfo, { theme: themes[testInfo.project.name] || "noon", name: "coast" });
  if (testInfo.project.name === "desktop-1440") {
    const wide = await page.context().newPage();
    await wide.setViewportSize({ width: 3840, height: 1200 });
    await compareLoadingPreview(wide, testInfo, { name: "coast-4k" });
    await wide.close();
  }
});

test("La Jolla loading: both miniature frames retain their scale and lighting", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  await compareLoadingPreview(page, testInfo, { selector: "[data-miniature]", name: "connect-miniature", theme: "afternoon" });
  const project = await page.context().newPage();
  await compareLoadingPreview(project, testInfo, {
    route: "/projects/la-jolla/",
    selector: "[data-miniature]",
    name: "project-miniature",
    theme: "evening",
  });
  await project.close();
});

test("coastal loading with a visible scrollbar: preview and camera agree at the phone boundary", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const browser = await chromium.launch({
    ignoreDefaultArgs: ["--hide-scrollbars"],
    ...(process.platform === "win32" ? { args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 610, height: 800 }, deviceScaleFactor: 1 });
    await compareLoadingPreview(page, testInfo, { name: "scrollbar-boundary" });
    expect((await evidence(page.locator("footer [data-footer-coast]"))).framing.width).toBe(40.5);
    await page.setViewportSize({ width: 599, height: 800 });
    await expect.poll(async () => (await evidence(page.locator("footer [data-footer-coast]"))).framing.width).toBe(21);
    await expect.poll(() => page.locator("footer .footer-coast__poster").evaluate((image) => image.currentSrc)).toContain("coast-mobile-noon.webp");
  } finally {
    await browser.close();
  }
});

test("coastal loading: a slow model arrives complete without fading through an empty canvas", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await preparePage(page, "noon");
  let release;
  const loading = new Promise((resolve) => (release = resolve));
  await page.route(coastModels, async (request) => {
    await loading;
    await request.continue();
  });
  try {
    await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
    const host = page.locator("footer [data-footer-coast]");
    await host.evaluate((e) => scrollTo({ top: scrollY + e.getBoundingClientRect().top - innerHeight + 100, behavior: "instant" }));
    await host.locator(".footer-coast__poster").evaluate((image) => image.decode());
    await host.evaluate((e) => {
      window.coastHandoff = [];
      const observe = new MutationObserver(() => {
        if (e.dataset.state !== "ready") return;
        observe.disconnect();
        const sample = () => {
          const poster = Number(getComputedStyle(e.querySelector(".footer-coast__poster")).opacity);
          window.coastHandoff.push({
            reveal: e.getCoastEvidence().reveal,
            frames: e.getCoastEvidence().frames,
            canvas: Number(getComputedStyle(e.querySelector("canvas")).opacity),
            poster,
          });
          // Sample the complete handoff, independent of software WebGL's frame rate.
          if (poster > 0 || window.coastHandoff.length < 2) requestAnimationFrame(sample);
        };
        sample();
      });
      observe.observe(e, { attributes: true, attributeFilter: ["data-state"] });
    });
    release();
    await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
    await expect.poll(() => page.evaluate(() => window.coastHandoff.length >= 2 && window.coastHandoff.at(-1).poster === 0)).toBe(true);
    const frames = await page.evaluate(() => window.coastHandoff);
    expect(frames.every((frame) => frame.reveal === 1 && frame.frames > 0 && frame.canvas === 1)).toBe(true);
    await expect(host.locator(".footer-coast__poster")).toBeHidden();
    await testInfo.attach("handoff-frames", { body: JSON.stringify(frames), contentType: "application/json" });
  } finally {
    release();
  }
});

for (const theme of process.env.COAST_THEME ? [process.env.COAST_THEME] : ["morning", "noon", "afternoon", "evening"]) {
  test(`coastal footer: automatic ${theme} light and full width composition`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    const host = await open(page, theme);
    await page.waitForTimeout(2000);
    const info = await evidence(host);
    expect(info.theme).toBe(theme);
    expect(info.landmarks).toEqual(expect.arrayContaining(["DIB", "Tennis", "CliffVilla"]));
    expect(info.landmarks).toEqual(expect.arrayContaining(["GeiselCoast", "SalkCoast", "BrocktonVilla", "LaValencia"]));
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

test("coastal navigation: helper clears the reading column and return control stays in the corner", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  const back = page.getByRole("button", { name: "Back to top", exact: true });
  await expect(back).toBeVisible();
  await expect(back).toHaveAttribute("tabindex", "0");
  const bounds = await back.boundingBox();
  expect(1000 - bounds.y - bounds.height).toBeGreaterThanOrEqual(15);
  expect(1000 - bounds.y - bounds.height).toBeLessThanOrEqual(30);
  const rail = page.getByRole("navigation", { name: "Homepage story" });
  await rail.hover();
  await expect(rail.getByRole("link", { name: "Connect", exact: true })).toBeVisible();
  const gap = await rail.evaluate((e) => document.querySelector(".home-title").getBoundingClientRect().left - e.getBoundingClientRect().right);
  expect(gap).toBeGreaterThanOrEqual(24);
  const railBounds = await rail.boundingBox();
  expect(railBounds.x).toBeGreaterThanOrEqual(16);
  expect(railBounds.x).toBeLessThanOrEqual(64);
  const footerTop = await page.locator("footer").evaluate((e) => e.getBoundingClientRect().top);
  expect(railBounds.y + railBounds.height).toBeLessThanOrEqual(footerTop - 24);
  await attachScreenshot(page, testInfo, "coast-navigation-wide");
  await back.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator("#back-to-top")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#back-to-top")).toHaveAttribute("tabindex", "-1");
  // A short wide window has no vertical room for the rail above the coast.
  // It must leave both the skyline and keyboard focus order clear.
  await page.setViewportSize({ width: 1920, height: 540 });
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect(page.locator(".home-story-rail")).toHaveAttribute("inert", "");
  await expect(page.locator(".home-story-rail")).toBeHidden();
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
test("coastal footer: phone navigation reaches both landmark wings and returns home", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = collectRuntimeErrors(page);
  const host = await open(page);
  const surface = host.locator(".footer-coast__scene");
  const initial = await surface.screenshot();
  for (let i = 0; i < 10; i++) await surface.press("ArrowLeft");
  expect((await evidence(host)).framing.center[0]).toBeLessThan(-25);
  await attachScreenshot(page, testInfo, "phone-campus-wing", { locator: host });
  expect(screenshotDiffRatio(initial, await surface.screenshot())).toBeGreaterThan(0.01);
  for (let i = 0; i < 22; i++) await surface.press("ArrowRight");
  expect((await evidence(host)).framing.center[0]).toBeGreaterThan(35);
  await attachScreenshot(page, testInfo, "phone-village-wing", { locator: host });
  await surface.press("Home");
  expect((await evidence(host)).framing.center[0]).toBeCloseTo(5.1);
  expect(await surface.evaluate((e) => getComputedStyle(e).touchAction)).toBe("pan-y");
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
  await page.route(/\/models\/la-jolla\/la-jolla\.glb(?:\?.*)?$/, (r) => r.abort());
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
