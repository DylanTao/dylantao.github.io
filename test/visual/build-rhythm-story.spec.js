const { test, expect } = require("@playwright/test");
const { attachScreenshot, collectRuntimeErrors, preparePage, screenshotDiffRatio } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

test("Build Rhythm story stays truthful and responsive before exact exploration", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/github-activity/"), { waitUntil: "networkidle" });

  const story = page.locator("[data-build-rhythm-story]");
  const stage = page.locator("[data-build-rhythm-story-stage]");
  const chart = page.locator("[data-build-rhythm-story-chart]");
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "ready");
  await expect(story).toHaveAttribute("data-state", "ready");
  await expect(stage).toBeVisible();
  await expect(chart.locator("[data-build-rhythm-story-layer]")).toHaveCount(1);

  const tokenSource = await page.locator("#build-rhythm-token-data").evaluate((element) => JSON.parse(element.textContent));
  expect(Object.keys(tokenSource).sort()).toEqual(
    ["schema", "label", "units", "grain", "aggregation", "method", "since", "updated_at", "confidence", "privacy_note", "points"].sort()
  );
  expect(tokenSource.method).toBe("deduplicated_repo_retained_logs");
  expect(tokenSource.points.length).toBeGreaterThan(1);
  expect(Object.keys(tokenSource.points.at(-1)).sort()).toEqual(["date", "token_count", "tokens_label"].sort());
  const latestTokenLabel = tokenSource.points.at(-1).tokens_label;

  await expect(story.getByRole("link", { name: "The Rhythm of Food" })).toHaveAttribute("href", "https://rhythm-of-food.net/");
  await expect(story.getByRole("link", { name: "John Thompson" })).toHaveAttribute("href", "https://jrthomp.com/");
  await expect(story.getByRole("link", { name: "Want to learn this widget's origin?" })).toHaveAttribute("href", /\/projects\/build-rhythm\/$/);

  const viewportWidth = page.viewportSize()?.width || 0;
  if (viewportWidth <= 820) {
    await expect(story).toHaveAttribute("data-story-static", "true");
    await expect(stage).toHaveAttribute("data-scene", "complete");
    await expect(chart.locator('[data-build-rhythm-story-layer="complete"]')).toHaveCount(1);
    await expect(page.locator(".build-rhythm-story-step.is-active")).toHaveCount(0);
    await expect(stage).toContainText(latestTokenLabel);
  } else {
    await expect(story).toHaveAttribute("data-story-static", "false");
    for (const scene of ["cadence", "magnitude", "bursts", "tokens", "lifetime", "explore"]) {
      const step = page.locator(`[data-build-rhythm-step="${scene}"]`);
      await step.scrollIntoViewIfNeeded();
      await expect(step).toHaveClass(/is-active/);
      await expect(stage).toHaveAttribute("data-scene", scene);
      await expect(stage).toHaveAttribute("data-transitioning", "false");
      if (scene === "tokens") {
        await expect(chart).toContainText("SITE REVAMP · CUMULATIVE RETAINED-SESSION ESTIMATE");
        await expect(stage).toContainText(latestTokenLabel);
        await attachScreenshot(page, testInfo, `build-rhythm-token-scene-${testInfo.project.name}`, { locator: stage });
      }
    }
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${viewportWidth}px Build Rhythm page overflows`).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Readable", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#github-activity-table-body")).toBeAttached();
  await attachScreenshot(page, testInfo, `build-rhythm-stage-${testInfo.project.name}`, { locator: stage });
  await attachScreenshot(page, testInfo, `build-rhythm-story-${testInfo.project.name}`, { locator: story });
  expect(runtimeErrors).toEqual([]);
});

test("Build Rhythm refreshes the visible lifetime scene after a delayed snapshot", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the delayed-response redraw contract");

  await preparePage(page, "light");
  let releaseSnapshot;
  const snapshotGate = new Promise((resolve) => {
    releaseSnapshot = resolve;
  });
  await page.route("**/assets/data/codex-profile-usage.json", async (route) => {
    await snapshotGate;
    await route.continue();
  });

  await page.goto(publicRouteUrl("/github-activity/"), { waitUntil: "domcontentloaded" });
  const story = page.locator("[data-build-rhythm-story]");
  const stage = page.locator("[data-build-rhythm-story-stage]");
  await expect(story).toHaveAttribute("data-state", "ready");
  await page.locator('[data-build-rhythm-step="lifetime"]').scrollIntoViewIfNeeded();
  await expect(stage).toHaveAttribute("data-scene", "lifetime");
  await expect(stage).toContainText("LIFETIME CODEX TOTAL UNAVAILABLE");

  releaseSnapshot();
  await expect(stage).toContainText("32.8B");
});

test("Build Rhythm reduced motion renders one complete still", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the reduced-motion story contract");

  const runtimeErrors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/github-activity/"), { waitUntil: "networkidle" });

  const story = page.locator("[data-build-rhythm-story]");
  const stage = page.locator("[data-build-rhythm-story-stage]");
  await expect(story).toHaveAttribute("data-state", "ready");
  await expect(story).toHaveAttribute("data-story-static", "true");
  await expect(stage).toHaveAttribute("data-scene", "complete");
  await expect(stage).toHaveAttribute("data-transitioning", "false");
  await page.waitForTimeout(120);
  const before = await stage.screenshot();
  await page.waitForTimeout(260);
  const after = await stage.screenshot();
  expect(screenshotDiffRatio(after, before), "reduced-motion story should remain pixel-stable").toBeLessThan(0.0001);
  expect(runtimeErrors).toEqual([]);
});

test("Build Rhythm token-story failure leaves the GitHub explorer and server evidence intact", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves token-story failure isolation");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.route("**/github-activity/", async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace(/(<script id="build-rhythm-token-data" type="application\/json">[\s\S]*?"token_count"\s*:\s*)\d+/, "$1-1");
    expect(body).not.toBe(original);
    await route.fulfill({ response, body });
  });
  await page.goto(publicRouteUrl("/github-activity/"), { waitUntil: "networkidle" });

  const activity = page.locator("[data-github-activity]");
  await expect(activity).toHaveAttribute("data-state", "ready");
  await expect(activity).toHaveAttribute("data-token-state", "error");
  await expect(page.locator("[data-build-rhythm-story]")).toHaveAttribute("data-state", "loading");
  await expect(page.locator(".build-rhythm-story-stage-wrap")).toBeHidden();
  await expect(page.locator(".github-activity-commit-line")).toHaveCount(1);
  expect(await page.locator("#github-activity-table-body tr").count()).toBeGreaterThan(40);
  expect(await page.locator("#github-activity-token-table-body tr").count()).toBeGreaterThan(1);
  expect(runtimeErrors).toEqual([]);
});

test("Build Rhythm cancels its scene transition when the story leaves view", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the offscreen stop condition");

  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/github-activity/"), { waitUntil: "networkidle" });
  const story = page.locator("[data-build-rhythm-story]");
  const stage = page.locator("[data-build-rhythm-story-stage]");
  await expect(story).toHaveAttribute("data-state", "ready");
  await page.locator('[data-build-rhythm-step="magnitude"]').scrollIntoViewIfNeeded();
  await expect(stage).toHaveAttribute("data-scene", "magnitude");

  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect(story).toHaveAttribute("data-story-visible", "false");
  await expect(stage).toHaveAttribute("data-transitioning", "false");
  await expect(stage).toHaveCSS("opacity", "1");
});
