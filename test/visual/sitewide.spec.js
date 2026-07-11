const { test, expect } = require("@playwright/test");
const { attachScreenshot, collectRuntimeErrors, preparePage, screenshotDiffRatio, stabilizeVisuals } = require("./helpers");
const { SITEWIDE_ROUTES, publicRouteUrl } = require("./public-routes");

async function expectMobileChromeInViewport(page, routePath) {
  const viewport = page.viewportSize();
  expect(viewport, `${routePath} has no mobile viewport`).not.toBeNull();

  const chrome = [
    ["brand name", page.locator(".site-brand-name")],
    ["site actions", page.locator(".navbar-actions")],
    ["navigation toggle", page.locator(".navbar-toggler")],
  ];
  const boxes = {};

  for (const [label, locator] of chrome) {
    await expect(locator, `${routePath} hides the mobile ${label}`).toBeVisible();
    const box = await locator.boundingBox();
    expect(box, `${routePath} mobile ${label} has no rendered box`).not.toBeNull();
    expect(box.x, `${routePath} mobile ${label} begins outside the viewport`).toBeGreaterThanOrEqual(-1);
    expect(box.y, `${routePath} mobile ${label} begins above the viewport`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `${routePath} mobile ${label} is clipped horizontally`).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height, `${routePath} mobile ${label} is clipped vertically`).toBeLessThanOrEqual(viewport.height + 1);
    boxes[label] = box;
  }

  expect(boxes["brand name"].x + boxes["brand name"].width, `${routePath} mobile brand overlaps site actions`).toBeLessThanOrEqual(
    boxes["site actions"].x + 1
  );
  expect(boxes["site actions"].x + boxes["site actions"].width, `${routePath} mobile actions overlap the navigation toggle`).toBeLessThanOrEqual(
    boxes["navigation toggle"].x + 1
  );
}

async function expectCompactBlogOpening(page) {
  const toc = page.locator("details.blog-inline-toc");
  await expect(toc).toBeVisible();
  await expect(toc.locator("summary")).toHaveText("On this page");
  await expect(toc).not.toHaveAttribute("open", "");

  const separators = page.locator(".blog-post .post-meta-separator");
  expect(await separators.count()).toBeGreaterThan(0);
  await expect(separators.first()).toBeHidden();

  const openingParagraph = page.locator(".blog-post #markdown-content > p").first();
  await expect(openingParagraph).toBeVisible();
  const openingBox = await openingParagraph.boundingBox();
  expect(openingBox, "mobile blog opening paragraph has no rendered box").not.toBeNull();
  expect(openingBox.y, "mobile blog chrome delays the opening paragraph too far down").toBeLessThan(780);
}

async function exercisePublicRoute(page, route, theme, testInfo) {
  const runtimeErrors = collectRuntimeErrors(page);

  await preparePage(page, theme);
  const response = await page.goto(publicRouteUrl(route.path), { waitUntil: "domcontentloaded" });

  expect(response, `${route.path} did not return a document response`).not.toBeNull();
  expect(response.status(), `${route.path} returned HTTP ${response.status()}`).toBeLessThan(400);

  const ready = page.locator(route.readySelector).first();
  const content = page.locator(route.contentSelector).first();
  await expect(ready).toBeVisible();
  await expect(content).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await stabilizeVisuals(page);
  await page.waitForTimeout(350);

  const geometry = await page.evaluate(() => {
    const documentElement = document.documentElement;
    return {
      clientWidth: documentElement.clientWidth,
      scrollHeight: documentElement.scrollHeight,
      scrollWidth: documentElement.scrollWidth,
    };
  });
  const contentBox = await content.boundingBox();

  expect(geometry.scrollWidth - geometry.clientWidth, `${route.path} has horizontal document overflow`).toBeLessThanOrEqual(1);
  expect(geometry.scrollHeight, `${route.path} has no meaningful document height`).toBeGreaterThan(400);
  expect(contentBox, `${route.path} content has no rendered box`).not.toBeNull();
  expect(contentBox.height, `${route.path} content box is unexpectedly short`).toBeGreaterThan(120);
  expect(runtimeErrors, `${route.path} raised browser runtime errors`).toEqual([]);

  if (testInfo.project.name === "mobile-390") {
    await expectMobileChromeInViewport(page, route.path);
    if (route.id === "blog-distributed-cognition") {
      await expectCompactBlogOpening(page);
    }
  }

  await attachScreenshot(page, testInfo, `${route.id}-${theme}-${testInfo.project.name}`, { fullPage: false });

  if (theme === "light" && route.fullPage && ["desktop-1440", "mobile-390"].includes(testInfo.project.name)) {
    await attachScreenshot(page, testInfo, `${route.id}-light-${testInfo.project.name}-full-page`, { fullPage: true });
  }
}

for (const route of SITEWIDE_ROUTES) {
  test(`public route: ${route.id}`, async ({ page, context }, testInfo) => {
    await exercisePublicRoute(page, route, "light", testInfo);

    const darkPage = await context.newPage();
    try {
      await exercisePublicRoute(darkPage, route, "dark", testInfo);
    } finally {
      await darkPage.close();
    }
  });
}

test("home research motion responds locally and keeps a reduced-motion still", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "representative semantic-motion checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  const response = await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  const stage = page.locator("[data-research-motion]");
  const canvas = page.locator("[data-research-motion-canvas]");
  await stage.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible();
  await expect(stage).toHaveAttribute("data-motion-energy", "resting");
  await attachScreenshot(page, testInfo, "research-motion-resting-desktop-1440", { locator: stage });

  await page.locator('[data-research-mode="evaluate"]').click();
  await expect(page.locator("[data-research-motion-readout]")).toHaveText("Evaluate");
  await expect(stage).toHaveAttribute("data-motion-energy", "engaged");
  await page.mouse.move(2, 2);
  await expect(stage).toHaveAttribute("data-motion-energy", "resting", { timeout: 2400 });

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width * 0.54, box.y + box.height * 0.48);
  await expect(stage).toHaveAttribute("data-motion-energy", "engaged");
  await attachScreenshot(page, testInfo, "research-motion-engaged-desktop-1440", { locator: stage });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(stage).toHaveAttribute("data-motion-energy", "resting");
  await page.waitForTimeout(180);
  const stillBefore = await canvas.screenshot();
  await page.waitForTimeout(260);
  const stillAfter = await canvas.screenshot();
  expect(screenshotDiffRatio(stillAfter, stillBefore), "reduced motion should render a stable still composition").toBeLessThan(0.0001);
  await attachScreenshot(page, testInfo, "research-motion-reduced-desktop-1440", { locator: stage });
  expect(runtimeErrors, "research motion raised browser runtime errors").toEqual([]);
});
