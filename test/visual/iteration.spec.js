const { test, expect } = require("@playwright/test");
const { attachScreenshot, collectRuntimeErrors, preparePage, stabilizeVisuals } = require("./helpers");
const { SITEWIDE_ROUTES, publicRouteUrl } = require("./public-routes");

if (SITEWIDE_ROUTES.length !== 1) {
  throw new Error(`Visual iteration requires exactly one route; received ${SITEWIDE_ROUTES.length}.`);
}

const route = SITEWIDE_ROUTES[0];
const theme = process.env.VISUAL_THEME || "light";
if (!["light", "dark"].includes(theme)) {
  throw new Error('VISUAL_THEME must be either "light" or "dark".');
}

const routeHash = (process.env.VISUAL_ROUTE_HASH || "").replace(/^#/, "");
const captureSelector = process.env.VISUAL_CAPTURE_SELECTOR?.trim() || null;
const keepMotion = process.env.VISUAL_MOTION === "live";
const reducedMotion = process.env.VISUAL_REDUCED_MOTION === "1";

test(`visual iteration: ${route.id}`, async ({ page }, testInfo) => {
  const reportTimings = process.env.VISUAL_TIMINGS === "1";
  const startedAt = Date.now();
  let phaseStartedAt = startedAt;
  const timings = [];
  const markPhase = (label) => {
    const now = Date.now();
    timings.push(`${label}=${now - phaseStartedAt}ms`);
    phaseStartedAt = now;
  };

  try {
    const runtimeErrors = collectRuntimeErrors(page);
    if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
    await preparePage(page, theme);
    markPhase("prepare");

    const target = new URL(publicRouteUrl(route.path));
    if (routeHash) target.hash = routeHash;
    const response = await page.goto(target.toString(), { waitUntil: "domcontentloaded" });
    markPhase("navigate");
    expect(response, `${target} did not return a document response`).not.toBeNull();
    expect(response.status(), `${target} returned HTTP ${response.status()}`).toBeLessThan(400);

    const readySelector =
      route.id === "github-activity"
        ? "[data-github-activity][data-state='ready'], [data-github-activity][data-state='unavailable']"
        : route.readySelector;
    await expect(page.locator(readySelector).first()).toBeVisible();
    await expect(page.locator(route.contentSelector).first()).toBeVisible();
    markPhase("ready");
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    markPhase("fonts");
    if (!keepMotion) await stabilizeVisuals(page);
    markPhase("stabilize");

    const capture = captureSelector ? page.locator(captureSelector) : null;
    if (capture) {
      expect(await capture.count(), `${captureSelector} must resolve to one capture surface`).toBe(1);
      await capture.scrollIntoViewIfNeeded();
      await expect(capture).toBeVisible();
    }
    markPhase("target");

    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth - geometry.clientWidth, `${route.path} has horizontal overflow`).toBeLessThanOrEqual(1);
    expect(runtimeErrors, `${route.path} raised browser runtime errors`).toEqual([]);
    markPhase("checks");

    const viewport = page.viewportSize();
    const screenshotName = [
      route.id,
      routeHash || "top",
      theme,
      viewport ? `${viewport.width}x${viewport.height}` : "viewport",
      reducedMotion ? "reduced" : keepMotion ? "live" : "still",
    ].join("-");
    await attachScreenshot(page, testInfo, screenshotName, capture ? { locator: capture } : { fullPage: false });
    markPhase("capture");
  } finally {
    if (!page.isClosed()) await page.close({ runBeforeUnload: false });
    markPhase("page-close");
    if (reportTimings) {
      console.log(`visual iteration timings: ${timings.join(", ")}, total=${Date.now() - startedAt}ms`);
    }
  }
});
