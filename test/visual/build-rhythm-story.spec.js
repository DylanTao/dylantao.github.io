const { test, expect } = require("@playwright/test");
const { attachScreenshot, collectRuntimeErrors, preparePage, screenshotDiffRatio } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

const expectReadableAxes = async (chart, minimumGap = 14) => {
  const axes = chart.locator("[data-build-rhythm-y-axis]");
  const axisCount = await axes.count();
  for (let index = 0; index < axisCount; index += 1) {
    const axis = axes.nth(index);
    await expect(axis.locator(".build-rhythm-axis-tick.is-zero")).toHaveCount(1);
    const guideStrokes = await axis
      .locator(".build-rhythm-axis-grid:not(.is-zero)")
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).stroke));
    expect(guideStrokes.length).toBeGreaterThan(0);
    expect(guideStrokes.every((stroke) => stroke && stroke !== "none" && stroke !== "rgba(0, 0, 0, 0)")).toBe(true);
    const geometry = await axis.locator(".build-rhythm-axis-tick").evaluateAll((nodes) => {
      const svg = nodes[0]?.ownerSVGElement;
      const viewBox = svg?.viewBox.baseVal;
      return {
        width: viewBox?.width || 0,
        height: viewBox?.height || 0,
        boxes: nodes.map((node) => {
          const box = node.getBBox();
          return { x: box.x, y: box.y, width: box.width, height: box.height };
        }),
      };
    });
    expect(geometry.boxes.length).toBeGreaterThanOrEqual(2);
    geometry.boxes.forEach((box) => {
      expect(box.x).toBeGreaterThanOrEqual(-0.5);
      expect(box.y).toBeGreaterThanOrEqual(-0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(geometry.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(geometry.height + 0.5);
    });
    const centers = geometry.boxes.map((box) => box.y + box.height / 2).sort((a, b) => a - b);
    centers.slice(1).forEach((center, tickIndex) => {
      expect(center - centers[tickIndex]).toBeGreaterThanOrEqual(minimumGap - 0.5);
    });
  }
};

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
  const endpointResponse = await page.request.get(publicRouteUrl("/assets/data/build-rhythm-token-rhythm.json"));
  expect(endpointResponse.ok()).toBe(true);
  expect(await endpointResponse.json()).toEqual(tokenSource);

  const tokenRhythm = page.locator("[data-token-rhythm]");
  const tokenRhythmChart = page.locator("[data-token-rhythm-chart]");
  await expect(tokenRhythm).toHaveAttribute("data-state", "ready");
  await expect(tokenRhythmChart.locator(".github-activity-token-cumulative-line")).toHaveCount(1);
  await expect(tokenRhythmChart.locator(".github-activity-token-delta-line")).toHaveCount(1);
  await expect(tokenRhythmChart.locator('[data-build-rhythm-y-axis="token-cumulative"]')).toHaveCount(1);
  await expect(tokenRhythmChart.locator('[data-build-rhythm-y-axis="token-daily-increase"]')).toHaveCount(1);
  expect((await tokenRhythmChart.locator(".github-activity-token-cumulative-line").getAttribute("d"))?.length).toBeGreaterThan(20);
  expect((await tokenRhythmChart.locator(".github-activity-token-delta-line").getAttribute("d"))?.length).toBeGreaterThan(20);
  await expectReadableAxes(tokenRhythmChart);
  const tokenDetails = page.locator("[data-token-rhythm-details]");
  const tokenDetailsSummary = tokenDetails.locator("summary");
  const tokenTableRegion = page.getByRole("region", { name: "Daily cumulative repo-token estimate table" });
  await expect(tokenDetails).not.toHaveAttribute("open", "");
  await expect(tokenDetailsSummary).toBeVisible();
  await expect(tokenDetailsSummary).toHaveText("Exact daily values");
  await expect(tokenTableRegion).toBeHidden();
  await tokenDetailsSummary.focus();
  await expect(tokenDetailsSummary).toBeFocused();
  await tokenDetailsSummary.press("Enter");
  await expect(tokenDetails).toHaveAttribute("open", "");
  const summaryOutline = await tokenDetailsSummary.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(summaryOutline).not.toBe("none");
  await expect(tokenTableRegion).toBeVisible();
  expect(await page.locator("#github-activity-token-table-body tr").count()).toBe(tokenSource.points.length);
  await tokenDetailsSummary.press("Enter");
  await expect(tokenDetails).not.toHaveAttribute("open", "");
  await tokenDetailsSummary.click();
  await expect(tokenDetails).toHaveAttribute("open", "");
  await expect(tokenRhythm).toContainText("the running total above and each day's increase below");

  await expect(story).toContainText("Commit count tells me when. Line changes tell me how much.");
  await expect(story).toContainText("One giant week was flattening everything else.");
  await expect(story).not.toContainText("The same week can carry a different amount of change.");

  await expect(story.getByRole("link", { name: "The Rhythm of Food" })).toHaveAttribute("href", "https://rhythm-of-food.net/");
  await expect(story.getByRole("link", { name: "John Thompson" })).toHaveAttribute("href", "https://jrthomp.com/");
  await expect(story.getByRole("link", { name: "Read how Build Rhythm began" })).toHaveAttribute("href", /\/projects\/build-rhythm\/$/);

  const viewportWidth = page.viewportSize()?.width || 0;
  if (viewportWidth <= 820) {
    await expect(story).toHaveAttribute("data-story-static", "true");
    await expect(stage).toHaveAttribute("data-scene", "complete");
    await expect(chart.locator('[data-build-rhythm-story-layer="complete"]')).toHaveCount(1);
    await expect(chart.locator("[data-build-rhythm-y-axis]")).toHaveCount(3);
    await expectReadableAxes(chart, 12);
    await expect(page.locator(".build-rhythm-story-step.is-active")).toHaveCount(0);
    await expect(stage).toContainText(latestTokenLabel);
    if (viewportWidth <= 420) {
      await expect(page.locator("#github-activity-token-table-scroll-hint")).toBeVisible();
      const tokenTableOverflow = await tokenTableRegion.evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(tokenTableOverflow).toBeGreaterThan(100);
    }
  } else {
    await expect(story).toHaveAttribute("data-story-static", "false");
    const sceneAxisCounts = { cadence: 1, magnitude: 1, bursts: 2, tokens: 2, lifetime: 0, explore: 3 };
    for (const scene of ["cadence", "magnitude", "bursts", "tokens", "lifetime", "explore"]) {
      const step = page.locator(`[data-build-rhythm-step="${scene}"]`);
      await step.scrollIntoViewIfNeeded();
      await expect(step).toHaveClass(/is-active/);
      await expect(stage).toHaveAttribute("data-scene", scene);
      await expect(stage).toHaveAttribute("data-transitioning", "false");
      await expect(chart.locator("[data-build-rhythm-y-axis]")).toHaveCount(sceneAxisCounts[scene]);
      if (sceneAxisCounts[scene]) await expectReadableAxes(chart, scene === "explore" ? 12 : 14);
      if (scene === "tokens") {
        await expect(chart).toContainText("SITE-BUILD · CUMULATIVE REPO ESTIMATE");
        await expect(stage).toContainText(latestTokenLabel);
        await attachScreenshot(page, testInfo, `build-rhythm-token-scene-${testInfo.project.name}`, { locator: stage });
      }
      if (scene === "magnitude") {
        await attachScreenshot(page, testInfo, `build-rhythm-magnitude-scene-${testInfo.project.name}`, { locator: stage });
        const geometry = await page.evaluate(() => {
          const stageBox = document.querySelector("[data-build-rhythm-story-stage]").getBoundingClientRect();
          const stepsBox = document.querySelector(".build-rhythm-story-steps").getBoundingClientRect();
          const navBottom = Math.max(0, document.querySelector("nav")?.getBoundingClientRect().bottom || 0);
          const usableHeight = window.innerHeight - navBottom;
          return {
            stageCenter: (stageBox.top + stageBox.bottom) / 2,
            usableCenter: navBottom + usableHeight / 2,
            usableHeight,
            stageTop: stageBox.top,
            stageBottom: stageBox.bottom,
            stepsWidth: stepsBox.width,
            chartHeight: document.querySelector("[data-build-rhythm-story-chart]").getBoundingClientRect().height,
          };
        });
        expect(Math.abs(geometry.stageCenter - geometry.usableCenter)).toBeLessThanOrEqual(geometry.usableHeight * 0.08);
        expect(geometry.stageTop).toBeGreaterThanOrEqual(0);
        expect(geometry.stageBottom).toBeLessThanOrEqual((page.viewportSize()?.height || 0) + 1);
        expect(geometry.stepsWidth).toBeGreaterThanOrEqual(319);
        expect(geometry.chartHeight).toBeGreaterThanOrEqual(368);
        expect(geometry.chartHeight).toBeLessThanOrEqual(449);
      }
    }
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${viewportWidth}px Build Rhythm page overflows`).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Readable", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#github-activity-table-body")).toBeAttached();
  await attachScreenshot(page, testInfo, `build-rhythm-persistent-tokens-${testInfo.project.name}`, { locator: tokenRhythm });
  await attachScreenshot(page, testInfo, `build-rhythm-stage-${testInfo.project.name}`, { locator: stage });
  await attachScreenshot(page, testInfo, `build-rhythm-story-${testInfo.project.name}`, { locator: story });
  expect(runtimeErrors).toEqual([]);
});

test("Build Rhythm refreshes the visible lifetime scene after a delayed snapshot", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the delayed-response redraw contract");

  await preparePage(page, "light");
  const usageResponse = await page.request.get(publicRouteUrl("/assets/data/codex-profile-usage.json"));
  expect(usageResponse.ok()).toBe(true);
  const usage = await usageResponse.json();
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
  await expect(stage).toContainText(usage.combined_lifetime.tokens_label);
});

test("Build Rhythm reduced motion renders one complete still", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the reduced-motion story contract");

  const runtimeErrors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/github-activity/"), { waitUntil: "networkidle" });

  const story = page.locator("[data-build-rhythm-story]");
  const stage = page.locator("[data-build-rhythm-story-stage]");
  const tokenChart = page.locator("[data-token-rhythm-chart]");
  await expect(story).toHaveAttribute("data-state", "ready");
  await expect(story).toHaveAttribute("data-story-static", "true");
  await expect(stage).toHaveAttribute("data-scene", "complete");
  await expect(stage).toHaveAttribute("data-transitioning", "false");
  await page.waitForTimeout(120);
  const before = await stage.screenshot();
  const tokenBefore = await tokenChart.screenshot();
  await page.waitForTimeout(260);
  const after = await stage.screenshot();
  const tokenAfter = await tokenChart.screenshot();
  expect(screenshotDiffRatio(after, before), "reduced-motion story should remain pixel-stable").toBeLessThan(0.0001);
  expect(screenshotDiffRatio(tokenAfter, tokenBefore), "reduced-motion token chart should remain pixel-stable").toBeLessThan(0.0001);
  expect(runtimeErrors).toEqual([]);
});

test("Build Rhythm axes stay legible in the evening theme", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name), "desktop and phone cover the dark axis treatment");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "dark");
  await page.goto(publicRouteUrl("/github-activity/"), { waitUntil: "networkidle" });

  const story = page.locator("[data-build-rhythm-story]");
  const stage = page.locator("[data-build-rhythm-story-stage]");
  const storyChart = page.locator("[data-build-rhythm-story-chart]");
  const tokenChart = page.locator("[data-token-rhythm-chart]");
  await expect(story).toHaveAttribute("data-state", "ready");
  if (testInfo.project.name === "desktop-1440") {
    await page.locator('[data-build-rhythm-step="magnitude"]').scrollIntoViewIfNeeded();
    await expect(stage).toHaveAttribute("data-scene", "magnitude");
    await expect(storyChart.locator("[data-build-rhythm-y-axis]")).toHaveCount(1);
  } else {
    await expect(stage).toHaveAttribute("data-scene", "complete");
    await expect(storyChart.locator("[data-build-rhythm-y-axis]")).toHaveCount(3);
  }
  await expectReadableAxes(storyChart, testInfo.project.name === "mobile-390" ? 12 : 14);
  await expectReadableAxes(tokenChart);
  const tickColors = await page.locator(".build-rhythm-axis-tick").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).fill));
  expect(tickColors.length).toBeGreaterThan(4);
  expect(tickColors.every((color) => color && color !== "none" && color !== "rgba(0, 0, 0, 0)")).toBe(true);
  await attachScreenshot(page, testInfo, `build-rhythm-evening-axes-${testInfo.project.name}`, { locator: stage });
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
  await expect(page.locator("[data-token-rhythm]")).toHaveAttribute("data-state", "error");
  await expect(page.locator(".build-rhythm-story-stage-wrap")).toBeHidden();
  await expect(page.locator("[data-token-rhythm-chart]")).toBeHidden();
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
