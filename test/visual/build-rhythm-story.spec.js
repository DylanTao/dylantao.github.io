const { test, expect } = require("@playwright/test");
const { attachScreenshot, collectRuntimeErrors, preparePage, screenshotDiffRatio } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

const dailyActivityFixture = (() => {
  const points = [];
  const start = Date.UTC(2021, 7, 1);
  const end = Date.UTC(2026, 6, 31);
  for (let stamp = start, index = 0; stamp <= end; stamp += 86_400_000, index += 1) {
    const date = new Date(stamp).toISOString().slice(0, 10);
    const active = index % 9 === 0 || index % 17 === 0;
    points.push({
      date,
      commits: active ? (index % 13) + 1 : 0,
      additions: active ? (index % 31) * 140 + 20 : 0,
      deletions: active ? (index % 23) * 90 + 10 : 0,
    });
  }
  return {
    schema: 3,
    updated_on: "2026-07-31",
    timezone: "UTC",
    scope: "personal_code_activity",
    coverage: {
      starts_on: points[0].date,
      complete_through: points.at(-1).date,
      status: "complete",
    },
    points,
  };
})();

const dailyAgentPoints = (() => {
  const points = [];
  const events = new Map([
    ["2026-04-30", { codex: 25000000, claude: 0 }],
    ["2026-06-19", { codex: 25000000, claude: 0 }],
    ["2026-07-28", { codex: 25000000, claude: 0 }],
    ["2026-07-29", { codex: 0, claude: 25000000 }],
    ["2026-07-30", { codex: 150000000, claude: 50000000 }],
  ]);
  for (let stamp = Date.UTC(2026, 3, 30); stamp <= Date.UTC(2026, 6, 30); stamp += 86_400_000) {
    const date = new Date(stamp).toISOString().slice(0, 10);
    const agentTokens = events.get(date) || { codex: 0, claude: 0 };
    points.push({ date, tokens: agentTokens.codex + agentTokens.claude, agent_tokens: agentTokens });
  }
  return points;
})();

const dailyUsageFixture = {
  schema: 7,
  combined_lifetime: {
    token_count: 400000000,
    tokens_label: "0.4B",
    units: "tokens",
    aggregation: "sum_of_sources",
    rounding: "nearest_0.1B",
    source_count: 3,
  },
  combined_daily_usage: {
    schema: 2,
    label: "Combined daily agent usage",
    units: "tokens",
    grain: "day",
    aggregation: "sum_of_sources",
    agent_families: ["codex", "claude"],
    coverage: {
      starts_on: "2026-04-30",
      complete_through: "2026-07-30",
      before_start: "unobserved",
      completeness: "rolling_window_partial",
      prior_unallocated_tokens: 100000000,
      prior_unallocated_by_agent: { codex: 100000000, claude: 0 },
    },
    points: dailyAgentPoints,
  },
  method: "rounded_sum_of_observed_agent_usage_sources",
  confidence: "mixed",
  observed_on: "2026-07-31",
  updated_at: "2026-07-31T08:00:00Z",
  automated_refresh: true,
  cost: {
    method: "flat_reference_rate_replay",
    reference_scope: "current_site_build_blended_public_api_rate",
    usd_per_million_tokens: 0.796269,
    pricing_as_of: "2026-07-12",
    usd_midpoint: 319,
    usd_label: "~$0.3K API-rate replay",
  },
};

const legacyDailyUsageFixture = {
  ...dailyUsageFixture,
  schema: 6,
  combined_lifetime: { ...dailyUsageFixture.combined_lifetime, source_count: 2 },
  combined_daily_usage: {
    schema: 1,
    label: "Combined daily Codex usage",
    units: "tokens",
    grain: "day",
    aggregation: "sum_of_sources",
    coverage: {
      starts_on: "2026-07-22",
      complete_through: "2026-07-26",
      before_start: "zero",
      completeness: "whole_lifetime",
      prior_unallocated_tokens: 0,
    },
    points: [
      { date: "2026-07-22", tokens: 0 },
      { date: "2026-07-23", tokens: 100000000 },
      { date: "2026-07-24", tokens: 0 },
      { date: "2026-07-25", tokens: 50000000 },
      { date: "2026-07-26", tokens: 250000000 },
    ],
  },
  method: "rounded_sum_of_verified_account_lifetime_readings",
  confidence: "high",
  observed_on: "2026-07-27",
  updated_at: "2026-07-27T08:00:00Z",
};

const oneDayZeroClaudeFixture = {
  ...dailyUsageFixture,
  combined_lifetime: { ...dailyUsageFixture.combined_lifetime, token_count: 200000000, tokens_label: "0.2B" },
  combined_daily_usage: {
    ...dailyUsageFixture.combined_daily_usage,
    coverage: {
      ...dailyUsageFixture.combined_daily_usage.coverage,
      starts_on: "2026-07-30",
      complete_through: "2026-07-30",
      prior_unallocated_tokens: 100000000,
      prior_unallocated_by_agent: { codex: 100000000, claude: 0 },
    },
    points: [{ date: "2026-07-30", tokens: 100000000, agent_tokens: { codex: 100000000, claude: 0 } }],
  },
  cost: { ...dailyUsageFixture.cost, usd_midpoint: 159, usd_label: "~$0.2K API-rate replay" },
};

const gotoWithDailyCode = async (page, { waitUntil = "networkidle", transform = (body) => body, activity = dailyActivityFixture } = {}) => {
  const routeUrl = publicRouteUrl("/github-activity/");
  const response = await page.request.get(routeUrl);
  expect(response.ok()).toBe(true);
  const original = await response.text();
  const dataPattern = /<script id="personal-code-activity-data" type="application\/json">[\s\S]*?<\/script>/;
  expect(original).toMatch(dataPattern);
  const withDaily = original.replace(
    dataPattern,
    `<script id="personal-code-activity-data" type="application/json">${JSON.stringify(activity)}</script>`
  );
  await page.route(routeUrl, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: transform(withDaily),
    })
  );
  await page.goto(routeUrl, { waitUntil });
};

test("missing personal history shows one compact rebuilding state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the unavailable state");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await gotoWithDailyCode(page, { activity: {} });

  const activity = page.locator("[data-github-activity]");
  await expect(activity).toHaveAttribute("data-state", "unavailable");
  await expect(page.getByText("Personal code history is being rebuilt.", { exact: true })).toHaveCount(1);
  await expect(page.locator("[data-github-scope]")).toHaveText("PERSONAL");
  await expect(page.locator("[data-build-rhythm-story]")).toBeHidden();
  await expect(page.getByRole("link", { name: "Open the explorer" })).toBeHidden();
  await expect(page.locator(".github-activity-controls")).toBeHidden();
  await expect(page.locator(".github-activity-chart-shell")).toBeHidden();
  await expect(page.locator(".github-activity-method")).toBeHidden();
  await expect(page.locator(".github-activity-readout")).toBeHidden();
  await expect(page.locator("[data-codex-usage]")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("[data-codex-usage]")).toBeVisible();
  await expect(page.locator(".github-activity-token-rhythm")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("personal daily code activity fails closed when coverage and update cutoffs diverge", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the malformed cutoff boundary");

  const malformed = structuredClone(dailyActivityFixture);
  malformed.updated_on = "2026-07-30";
  await preparePage(page, "light");
  await gotoWithDailyCode(page, { activity: malformed });
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "unavailable");
});

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
  await page.route("**/assets/data/codex-profile-usage.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dailyUsageFixture) })
  );
  await gotoWithDailyCode(page);

  const story = page.locator("[data-build-rhythm-story]");
  const stage = page.locator("[data-build-rhythm-story-stage]");
  const chart = page.locator("[data-build-rhythm-story-chart]");
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "ready");
  await expect(story).toHaveAttribute("data-state", "ready");
  await expect(stage).toBeVisible();
  await expect(chart.locator("[data-build-rhythm-story-layer]")).toHaveCount(1);

  await expect(page.getByText("Personal code history is being rebuilt.", { exact: true })).toBeHidden();

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
  const lifetimePayload = dailyUsageFixture;
  expect(lifetimePayload.schema).toBe(7);
  expect(lifetimePayload.combined_daily_usage.schema).toBe(2);
  expect(lifetimePayload.combined_daily_usage.agent_families).toEqual(["codex", "claude"]);
  expect(lifetimePayload.combined_daily_usage.coverage.starts_on).toBe("2026-04-30");
  expect(lifetimePayload.combined_daily_usage.coverage.complete_through).toBe("2026-07-30");
  expect(legacyDailyUsageFixture.schema).toBe(6);
  expect(legacyDailyUsageFixture.combined_daily_usage.schema).toBe(1);

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
  const explorerChart = page.locator("#github-activity-chart");
  const agentSummary = page.locator("[data-codex-usage]");
  await expect(agentSummary).toContainText("0.4B total tokens");
  await expect(agentSummary).toContainText("Codex area");
  await expect(agentSummary).toContainText("325M · 81.25%");
  await expect(agentSummary).toContainText("Claude area");
  await expect(agentSummary).toContainText("75M · 18.75%");
  const coverageStatus = agentSummary.locator("[data-codex-status]");
  // Visually hidden, still announced. sr-only leaves a 1x1 clipped box, which
  // Playwright counts as visible, so toBeHidden() can never hold here -- and it
  // would contradict the toHaveText assertion immediately below it.
  await expect(coverageStatus).toHaveClass(/\bsr-only\b/);
  await expect(coverageStatus).toHaveText(
    "Daily Codex history begins Apr 30, 2026. Claude joins Jul 29, 2026. History is complete through Jul 30, 2026."
  );
  await expect(agentSummary).toContainText("~$0.3K public API-rate replay estimate · not a bill.");
  const agentStep = page.locator('[data-build-rhythm-step="agents"]');
  await expect(agentStep.locator("[data-build-rhythm-agent-heading]")).toHaveText("Codex leads the trace. Claude joins later.");
  await expect(agentStep.locator("[data-build-rhythm-agent-copy]")).toHaveText(
    "The daily Codex record starts Apr 30, 2026. Claude joins the trace on Jul 29, 2026."
  );
  await expect(agentSummary.locator("[data-agent-history-chart]")).toHaveCount(0);
  await expect(explorerChart.locator('[data-build-rhythm-y-axis="github-agent-history"]')).toHaveCount(1);
  await expect(explorerChart.locator(".github-activity-agent-rail-marker")).toHaveCount(dailyAgentPoints.length);
  await expect(explorerChart.locator(".github-activity-agent-rail-codex-area")).toHaveCount(1);
  await expect(explorerChart.locator(".github-activity-agent-rail-claude-area")).toHaveCount(1);
  await expect(explorerChart).not.toContainText("UNOBSERVED BEFORE");

  await expect(story).toContainText("Commit count tells me when. Line changes tell me how much.");
  await expect(story).toContainText("One giant day was flattening everything else.");
  await expect(story).not.toContainText("The same week can carry a different amount of change.");

  await expect(story.getByRole("link", { name: "The Rhythm of Food" })).toHaveAttribute("href", "https://rhythm-of-food.net/");
  await expect(story.getByRole("link", { name: "John Thompson" })).toHaveAttribute("href", "https://jrthomp.com/");
  await expect(story.getByRole("link", { name: "Read how Build Rhythm began" })).toHaveAttribute("href", /\/projects\/build-rhythm\/$/);

  const viewportWidth = page.viewportSize()?.width || 0;
  if (viewportWidth <= 820) {
    await expect(story).toHaveAttribute("data-story-static", "true");
    await expect(stage).toHaveAttribute("data-scene", "complete");
    await expect(chart.locator('[data-build-rhythm-story-layer="complete"]')).toHaveCount(1);
    await expect(chart.locator("[data-build-rhythm-y-axis]")).toHaveCount(2);
    await expectReadableAxes(chart, 12);
    await expect(page.locator(".build-rhythm-story-step.is-active")).toHaveCount(0);
    await expect(stage).not.toContainText("personal agent tokens");
    if (viewportWidth <= 420) {
      await expect(page.locator("#github-activity-token-table-scroll-hint")).toBeVisible();
      const tokenTableOverflow = await tokenTableRegion.evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(tokenTableOverflow).toBeGreaterThan(100);
    }
  } else {
    await expect(story).toHaveAttribute("data-story-static", "false");
    const sceneAxisCounts = { cadence: 1, magnitude: 1, bursts: 2, tokens: 2, agents: 0, explore: 2 };
    for (const scene of ["cadence", "magnitude", "bursts", "tokens", "agents", "explore"]) {
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
      if (scene === "agents") {
        await expect(chart).toContainText("PERSONAL AGENT TOKENS · STACKED CUMULATIVE");
        const markers = chart.locator(".github-activity-agent-history-marker");
        await expect(markers).toHaveCount(dailyAgentPoints.length);
        const geometry = await markers.evaluateAll((nodes) => ({
          first: Number(nodes[0].getAttribute("cx")),
          last: Number(nodes.at(-1).getAttribute("cx")),
          width: nodes[0].ownerSVGElement.viewBox.baseVal.width,
        }));
        expect(geometry.last - geometry.first).toBeGreaterThanOrEqual(geometry.width * 0.9);
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
        expect(geometry.chartHeight).toBeGreaterThanOrEqual(400);
        expect(geometry.chartHeight).toBeLessThanOrEqual(545);
      }
      if (scene === "explore") {
        await expect(chart).not.toContainText("PERSONAL AGENT TOKENS");
        await expect(chart).not.toContainText("SITE TOKENS");
      }
    }
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${viewportWidth}px Build Rhythm page overflows`).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Readable", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Literal", exact: true }).click();
  await expect(agentSummary).toContainText("0.4B total tokens");
  await page.getByRole("button", { name: "Readable", exact: true }).click();
  await expect(page.locator("#github-activity-table-body")).toBeAttached();
  await attachScreenshot(page, testInfo, `build-rhythm-persistent-tokens-${testInfo.project.name}`, { locator: tokenRhythm });
  await attachScreenshot(page, testInfo, `build-rhythm-explorer-${testInfo.project.name}`, {
    locator: page.locator(".github-activity-workbench"),
  });
  await attachScreenshot(page, testInfo, `build-rhythm-stage-${testInfo.project.name}`, { locator: stage });
  await attachScreenshot(page, testInfo, `build-rhythm-story-${testInfo.project.name}`, { locator: story });
  expect(runtimeErrors).toEqual([]);
});

test("exact daily agent usage keeps a shared explorer domain and focused story scene", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the exact daily interaction contract");

  await preparePage(page, "light");
  await page.route("**/assets/data/codex-profile-usage.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dailyUsageFixture) })
  );
  await gotoWithDailyCode(page);

  const chart = page.locator("#github-activity-chart");
  const summary = page.locator("[data-codex-usage]");
  const railMarkers = chart.locator(".github-activity-agent-rail-marker");
  await expect(chart.locator(".github-activity-agent-rail-line")).toHaveCount(1);
  await expect(railMarkers).toHaveCount(dailyAgentPoints.length);
  await expect(chart.locator(".github-activity-agent-rail-codex-area")).toHaveCount(1);
  await expect(chart.locator(".github-activity-agent-rail-claude-area")).toHaveCount(1);
  await expect(chart).toContainText("TOTAL LINE · 0.4B");

  const railColors = await Promise.all([
    chart.locator(".github-activity-agent-rail-codex-area").getAttribute("fill"),
    chart.locator(".github-activity-agent-rail-claude-area").getAttribute("fill"),
    chart.locator(".github-activity-agent-rail-line").getAttribute("stroke"),
    railMarkers.last().getAttribute("stroke"),
  ]);
  expect(new Set(railColors.slice(0, 3)).size).toBe(3);
  expect(railColors[3]).toBe(railColors[2]);

  const railGeometry = await railMarkers.evaluateAll((markers) => ({
    first: Number(markers[0].getAttribute("cx")),
    last: Number(markers.at(-1).getAttribute("cx")),
    width: markers[0].ownerSVGElement.viewBox.baseVal.width,
  }));
  expect(railGeometry.first).toBeGreaterThanOrEqual(railGeometry.width * 0.9);

  await page.locator('[data-build-rhythm-step="agents"]').scrollIntoViewIfNeeded();
  const focusedMarkers = page.locator("[data-build-rhythm-story-chart] .github-activity-agent-history-marker");
  await expect(focusedMarkers).toHaveCount(dailyAgentPoints.length);
  const focusedChart = page.locator("[data-build-rhythm-story-chart]");
  const focusedColors = await Promise.all([
    focusedChart.locator(".github-activity-agent-history-codex-area").getAttribute("fill"),
    focusedChart.locator(".github-activity-agent-history-claude-area").getAttribute("fill"),
    focusedChart.locator(".github-activity-agent-history-line").getAttribute("stroke"),
    focusedMarkers.last().getAttribute("stroke"),
  ]);
  expect(new Set(focusedColors.slice(0, 3)).size).toBe(3);
  expect(focusedColors[3]).toBe(focusedColors[2]);
  await expect(page.locator("[data-build-rhythm-story-readout]")).toContainText("Codex area 325M · Claude area 75M · Total line 400M");
  const focusedGeometry = await focusedMarkers.evaluateAll((markers) => ({
    first: Number(markers[0].getAttribute("cx")),
    last: Number(markers.at(-1).getAttribute("cx")),
    width: markers[0].ownerSVGElement.viewBox.baseVal.width,
  }));
  expect(focusedGeometry.last - focusedGeometry.first).toBeGreaterThanOrEqual(focusedGeometry.width * 0.9);

  const compositionWidths = await summary
    .locator("[data-agent-composition] > span")
    .evaluateAll((segments) => segments.map((segment) => Number.parseFloat(segment.style.width)));
  expect(compositionWidths[0] + compositionWidths[1]).toBeCloseTo(100, 8);
  await expect(summary.locator("[data-agent-composition]")).toHaveAttribute(
    "aria-label",
    /Codex 325,000,000 tokens, 81\.25 percent; Claude 75,000,000 tokens, 18\.75 percent/
  );

  const guide = chart.locator(".github-activity-guide");
  const yearGrid = chart.locator(".github-activity-year-grid").last();
  const sharedBottom = await Promise.all([guide, yearGrid].map((locator) => locator.getAttribute("y2")));
  expect(sharedBottom[0]).toBe(sharedBottom[1]);
  const selectionBand = chart.locator(".github-activity-selection-band");
  expect(Number(await selectionBand.getAttribute("height"))).toBe(Number(await guide.getAttribute("y2")) - Number(await guide.getAttribute("y1")));

  await expect(page.locator("#github-activity-selected-tokens")).toContainText("unobserved or awaiting a completed day");
  const inspector = chart.locator(".github-activity-inspector");
  await inspector.focus();
  await expect(inspector).toHaveAttribute("aria-valuetext", /token usage unobserved or awaiting a completed day/);

  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#github-activity-selected-tokens")).toContainText("+200M tokens");
  await expect(page.locator("#github-activity-selected-tokens")).toContainText("Codex +150M");
  await expect(page.locator("#github-activity-selected-tokens")).toContainText("Claude +50M");
  await expect(page.locator("#github-activity-selected-tokens")).toContainText("400M total");
  await expect(page.locator("#github-activity-selected-tokens")).toHaveAttribute(
    "aria-label",
    "200,000,000 tokens that day: 150,000,000 Codex and 50,000,000 Claude; 400,000,000 cumulative tokens."
  );
  await expect(inspector).toHaveAttribute(
    "aria-valuetext",
    /200,000,000 tokens that day, 150,000,000 Codex and 50,000,000 Claude, 400,000,000 cumulative tokens/
  );
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.locator("#github-activity-range-summary")).not.toContainText("tokens");
  await page.keyboard.press("Escape");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(page.locator("#github-activity-range-summary")).not.toContainText("tokens");
  await page.locator(".github-activity-method summary").click();
  const exactRow = page.locator("#github-activity-table-body tr").filter({ hasText: "2026-07-30" });
  await expect(exactRow.locator("td").nth(4)).toHaveText("200,000,000");
  await expect(exactRow.locator("td").nth(5)).toHaveText("150,000,000");
  await expect(exactRow.locator("td").nth(6)).toHaveText("50,000,000");
  await expect(exactRow.locator("td").nth(7)).toHaveText("400,000,000");
  await inspector.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#github-activity-selected-tokens")).toContainText("+25M tokens");
  await expect(page.locator("#github-activity-selected-tokens")).toContainText("Codex +25M");
  await expect(page.locator("#github-activity-selected-tokens")).toContainText("Claude +0");
  await attachScreenshot(page, testInfo, "build-rhythm-exact-daily-usage-desktop-1440", {
    locator: page.locator(".github-activity-workbench"),
  });
});

test("legacy profile-6 daily fallback remains accepted", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the partial-coverage boundary");

  await preparePage(page, "light");
  await page.route("**/assets/data/codex-profile-usage.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(legacyDailyUsageFixture) })
  );
  await gotoWithDailyCode(page);

  const summary = page.locator("[data-codex-usage]");
  const chart = page.locator("#github-activity-chart");
  await expect(summary).toHaveAttribute("data-state", "ready");
  await expect(summary).toContainText(`${legacyDailyUsageFixture.combined_lifetime.tokens_label} total tokens`);
  await expect(chart.locator(".github-activity-agent-rail-marker")).toHaveCount(legacyDailyUsageFixture.combined_daily_usage.points.length);
  await expect(chart.locator(".github-activity-agent-rail-total-area")).toHaveCount(1);
  await expect(chart.locator(".github-activity-agent-rail-codex-area")).toHaveCount(0);
  await expect(chart.locator(".github-activity-agent-rail-claude-area")).toHaveCount(0);
  await expect(page.locator("[data-agent-family-summary]")).toBeHidden();
  const agentStep = page.locator('[data-build-rhythm-step="agents"]');
  await expect(agentStep.locator("[data-build-rhythm-agent-heading]")).toHaveText("Then I zoom into the recent aggregate history.");
  await expect(agentStep.locator("[data-build-rhythm-agent-copy]")).toHaveText(
    "Daily aggregate history runs from Jul 22, 2026 through Jul 26, 2026. This close-up keeps the cumulative total readable without changing the shared five-year explorer below."
  );
  await expect(agentStep).not.toContainText("Codex");
  await expect(agentStep).not.toContainText("Claude");
  await agentStep.scrollIntoViewIfNeeded();
  const stage = page.locator("[data-build-rhythm-story-stage]");
  await expect(stage).toContainText("PERSONAL AGENT TOKENS · CUMULATIVE TOTAL");
  await expect(stage).not.toContainText("STACKED CUMULATIVE");
  await expect(stage).not.toContainText("Codex");
  await expect(stage).not.toContainText("Claude");
});

test("one-day history is centered and zero Claude remains truthful", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the single-day geometry");

  await preparePage(page, "light");
  await page.route("**/assets/data/codex-profile-usage.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(oneDayZeroClaudeFixture) })
  );
  await gotoWithDailyCode(page);

  const summary = page.locator("[data-codex-usage]");
  await expect(summary.locator("[data-agent-claude-value]")).toHaveText("0 · 0.00%");
  await expect(summary.locator("[data-agent-claude-segment]")).toHaveAttribute("style", /width: 0%/);
  await expect(page.locator("#github-activity-chart .github-activity-agent-rail-line")).toHaveCount(0);
  await page.locator('[data-build-rhythm-step="agents"]').scrollIntoViewIfNeeded();
  const history = page.locator("[data-build-rhythm-story-chart]");
  await expect(history.locator(".github-activity-agent-history-line")).toHaveCount(0);
  const marker = history.locator(".github-activity-agent-history-marker");
  await expect(marker).toHaveCount(1);
  const geometry = await marker.evaluate((node) => ({
    x: Number(node.getAttribute("cx")),
    width: node.ownerSVGElement.viewBox.baseVal.width,
  }));
  expect(Math.abs(geometry.x - geometry.width / 2)).toBeLessThanOrEqual(25);
});

[
  {
    label: "agent-family totals that do not conserve the daily total",
    mutate: (usage) => {
      usage.combined_daily_usage.points[0].agent_tokens.claude += 1;
    },
  },
  {
    label: "agent families in the wrong order",
    mutate: (usage) => {
      usage.combined_daily_usage.agent_families = ["claude", "codex"];
    },
  },
  {
    label: "a prior family split that does not conserve its baseline",
    mutate: (usage) => {
      usage.combined_daily_usage.coverage.prior_unallocated_by_agent.codex -= 1;
    },
  },
  {
    label: "Claude tokens before Claude tracking begins",
    mutate: (usage) => {
      usage.combined_daily_usage.points[0].agent_tokens.codex -= 1;
      usage.combined_daily_usage.points[0].agent_tokens.claude += 1;
    },
  },
].forEach(({ label, mutate }) => {
  test(`daily agent usage fails closed for ${label}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves each malformed-contract boundary");

    const malformed = structuredClone(dailyUsageFixture);
    mutate(malformed);
    await preparePage(page, "light");
    await page.route("**/assets/data/codex-profile-usage.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(malformed) })
    );
    await gotoWithDailyCode(page);

    await expect(page.locator("[data-codex-usage]")).toHaveAttribute("data-state", "error");
    await expect(page.locator("[data-codex-usage]")).toBeHidden();
    await expect(page.locator("[data-personal-codex-readout]")).toBeHidden();
  });
});

test("Build Rhythm reveals the agent summary after delayed lifetime history", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the delayed-response redraw contract");

  await preparePage(page, "light");
  const usage = structuredClone(dailyUsageFixture);
  let releaseSnapshot;
  const snapshotGate = new Promise((resolve) => {
    releaseSnapshot = resolve;
  });
  await page.route("**/assets/data/codex-profile-usage.json", async (route) => {
    await snapshotGate;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(usage) });
  });

  await gotoWithDailyCode(page, { waitUntil: "domcontentloaded" });
  const story = page.locator("[data-build-rhythm-story]");
  const stage = page.locator("[data-build-rhythm-story-stage]");
  await expect(story).toHaveAttribute("data-state", "ready");
  await page.locator('[data-build-rhythm-step="agents"]').scrollIntoViewIfNeeded();
  await expect(stage).toHaveAttribute("data-scene", "agents");
  await expect(stage).not.toContainText("loading");
  await expect(stage).toContainText("unavailable");

  releaseSnapshot();
  await expect(page.locator("[data-codex-usage]")).toContainText(`${usage.combined_lifetime.tokens_label} total tokens`);
  await expect(stage).toContainText("Codex area 325M");
  await expect(stage.locator(".github-activity-agent-history-marker")).toHaveCount(dailyAgentPoints.length);
});

test("Build Rhythm withholds a failed personal agent snapshot", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the failed-snapshot boundary");

  await preparePage(page, "light");
  await page.route("**/assets/data/codex-profile-usage.json", (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
  await gotoWithDailyCode(page);

  await expect(page.locator("[data-codex-usage]")).toHaveAttribute("data-state", "error");
  await expect(page.locator("[data-codex-usage]")).toBeHidden();
  await expect(page.locator(".github-activity-lifetime-value")).toHaveCount(0);
  const agentStep = page.locator('[data-build-rhythm-step="agents"]');
  await expect(agentStep.locator("[data-build-rhythm-agent-heading]")).toHaveText("Recent agent history is unavailable.");
  await expect(agentStep.locator("[data-build-rhythm-agent-copy]")).toHaveText(
    "A validated agent snapshot is unavailable. The shared five-year code explorer below remains available."
  );
  await expect(agentStep).not.toContainText("Codex");
  await expect(agentStep).not.toContainText("Claude");
  await agentStep.scrollIntoViewIfNeeded();
  const stage = page.locator("[data-build-rhythm-story-stage]");
  await expect(stage).toContainText("PERSONAL AGENT TOKENS · RECENT HISTORY");
  await expect(stage).not.toContainText("STACKED CUMULATIVE");
  await expect(stage).toContainText("Recent personal agent history is unavailable.");
});

test("Build Rhythm reduced motion renders one complete still", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the reduced-motion story contract");

  const runtimeErrors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await preparePage(page, "light");
  await gotoWithDailyCode(page);

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
  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "dark");
  await gotoWithDailyCode(page);

  const story = page.locator("[data-build-rhythm-story]");
  const stage = page.locator("[data-build-rhythm-story-stage]");
  const storyChart = page.locator("[data-build-rhythm-story-chart]");
  const tokenChart = page.locator("[data-token-rhythm-chart]");
  const explorerChart = page.locator("#github-activity-chart");
  await expect(story).toHaveAttribute("data-state", "ready");
  if (["desktop-1440", "laptop-1280"].includes(testInfo.project.name)) {
    await page.locator('[data-build-rhythm-step="agents"]').scrollIntoViewIfNeeded();
    await expect(stage).toHaveAttribute("data-scene", "agents");
    expect(await storyChart.locator(".github-activity-agent-history-marker").count()).toBeGreaterThan(1);
  } else {
    await expect(stage).toHaveAttribute("data-scene", "complete");
    await expect(storyChart.locator("[data-build-rhythm-y-axis]")).toHaveCount(2);
    await expectReadableAxes(storyChart, 12);
  }
  await expectReadableAxes(tokenChart);
  await expect(explorerChart.locator('[data-build-rhythm-y-axis="github-agent-history"]')).toHaveCount(1);
  await expectReadableAxes(explorerChart, testInfo.project.name === "mobile-390" ? 12 : 14);
  const tickColors = await page.locator(".build-rhythm-axis-tick").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).fill));
  expect(tickColors.length).toBeGreaterThan(4);
  expect(tickColors.every((color) => color && color !== "none" && color !== "rgba(0, 0, 0, 0)")).toBe(true);
  await attachScreenshot(page, testInfo, `build-rhythm-evening-axes-${testInfo.project.name}`, { locator: stage });
  await attachScreenshot(page, testInfo, `build-rhythm-evening-explorer-${testInfo.project.name}`, {
    locator: page.locator(".github-activity-workbench"),
  });
  expect(runtimeErrors).toEqual([]);
});

test("Build Rhythm token-story failure leaves the GitHub explorer and server evidence intact", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves token-story failure isolation");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await gotoWithDailyCode(page, {
    transform: (original) => {
      const body = original.replace(/(<script id="build-rhythm-token-data" type="application\/json">[\s\S]*?"token_count"\s*:\s*)\d+/, "$1-1");
      expect(body).not.toBe(original);
      return body;
    },
  });

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
  await gotoWithDailyCode(page);
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

test("Build Rhythm re-syncs the nearest step when the story returns", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop-1280", "the short desktop exposes the observer ordering race");

  await preparePage(page, "light");
  await gotoWithDailyCode(page);
  const story = page.locator("[data-build-rhythm-story]");
  const stage = page.locator("[data-build-rhythm-story-stage]");
  const cadence = page.locator('[data-build-rhythm-step="cadence"]');
  await expect(story).toHaveAttribute("data-state", "ready");

  await page.locator("[data-token-rhythm]").scrollIntoViewIfNeeded();
  await expect(story).toHaveAttribute("data-story-visible", "false");
  await cadence.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));

  await expect(story).toHaveAttribute("data-story-visible", "true");
  await expect(cadence).toHaveClass(/is-active/);
  await expect(stage).toHaveAttribute("data-scene", "cadence");
  await expect(stage).toHaveAttribute("data-transitioning", "false");
});
