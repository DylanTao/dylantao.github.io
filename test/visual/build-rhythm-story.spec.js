const { test, expect } = require("@playwright/test");
const { collectRuntimeErrors, preparePage, screenshotDiffRatio } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const recorded = require("../../_data/code_activity.json");
const sum = (points) => points.reduce((total, point) => total + (point.personal?.commits ?? 0), 0);
const evidence = (page) => page.evaluate(() => window.getCommitOverviewEvidence());

async function open(page, { activity = recorded, theme = "light", reduced = false } = {}) {
  await preparePage(page, theme);
  if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
  const url = publicRouteUrl("/github-activity/");
  const response = await page.request.get(url);
  expect(response.ok()).toBe(true);
  const html = (await response.text()).replace(
    /<script id="code-activity-data" type="application\/json">[\s\S]*?<\/script>/,
    `<script id="code-activity-data" type="application/json">${JSON.stringify(activity)}</script>`
  );
  await page.route(url, (route) => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", /^(ready|unavailable)$/);
  if ((await page.locator("[data-github-activity]").getAttribute("data-state")) === "ready") {
    await expect(page.locator("[data-rhythm-chart]")).toHaveAttribute("data-transitioning", "false");
    await page.evaluate(() => document.fonts?.ready);
  }
}
async function view(page, mode) {
  await page.locator(`[data-rhythm-view="${mode}"]`).click();
  await expect(page.locator("[data-rhythm-chart]")).toHaveAttribute("data-view", mode);
  await expect(page.locator("[data-rhythm-chart]")).toHaveAttribute("data-transitioning", "false");
}
async function range(page, start, end = start) {
  await page.locator("[data-rhythm-range-start]").selectOption(String(start));
  await page.locator("[data-rhythm-range-end]").selectOption(String(end));
  await expect(page.locator("[data-rhythm-chart]")).toHaveAttribute("data-start-year", String(start));
  await expect(page.locator("[data-rhythm-chart]")).toHaveAttribute("data-end-year", String(end));
  await expect(page.locator("[data-rhythm-chart]")).toHaveAttribute("data-transitioning", "false");
}

test("one chart keeps the selected view independent of its start and end years", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await open(page);
  const chart = page.locator("[data-rhythm-chart]");
  await expect(chart).toHaveCount(1);
  await expect(page.locator("[data-build-rhythm-overview] svg")).toHaveCount(1);
  await expect(page.locator("[data-rhythm-history-cell]")).toHaveCount(540);
  await expect(page.locator("[data-rhythm-slot]")).toHaveCount(0);
  await expect(page.locator("[data-rhythm-summary]")).toContainText("20,793");
  await expect(page.locator("[data-rhythm-range-start]")).toHaveValue("2017");
  await expect(page.locator("[data-rhythm-range-end]")).toHaveValue("2026");
  expect(await evidence(page)).toMatchObject({
    years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    total: sum(recorded.points),
    canonicalWeeks: 475,
    sourceCutoff: "2026-09-28",
    tabStops: 1,
  });
  await chart.evaluate((node) => {
    window.originalRhythmChart = node;
  });
  await range(page, 2024, 2025);
  await expect(chart).toHaveAttribute("data-view", "history");
  await expect(page.locator("[data-rhythm-history-cell]")).toHaveCount(108);
  await expect(page.locator("[data-rhythm-summary]")).toContainText("751");
  await view(page, "cumulative");
  expect(await evidence(page)).toMatchObject({ rangeStart: 2024, rangeEnd: 2025, rangeTotal: 751, carryIn: 569, lifetimeTotal: 1320 });
  await expect(page.locator("[data-rhythm-view-note]")).toContainText("751 added in 2024-2025 + 569 recorded earlier");
  await page.locator("[data-rhythm-range-reset]").click();
  await expect(chart).toHaveAttribute("data-transitioning", "false");
  await expect(chart).toHaveAttribute("data-view", "cumulative");
  expect(await evidence(page)).toMatchObject({ rangeStart: 2017, rangeEnd: 2026, rangeTotal: 20793, carryIn: 0, lifetimeTotal: 20793 });
  expect(await page.evaluate(() => window.originalRhythmChart === document.querySelector("[data-rhythm-chart]"))).toBe(true);
  expect((await evidence(page)).tabStops).toBe(1);
  expect(errors).toEqual([]);
});

test("full-range cumulative is one daily path with proportional dates and no annual resets", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await open(page);
  await view(page, "cumulative");
  const line = page.locator("[data-rhythm-cumulative-line]");
  await expect(line).toHaveCount(1);
  await expect(line).toHaveAttribute("data-first-date", "2017-08-31");
  await expect(line).toHaveAttribute("data-last-date", "2026-09-28");
  await expect(line).toHaveAttribute("data-recorded-days", "3316");
  await expect(line).toHaveAttribute("data-basis", "lifetime-recorded");
  const path = await line.getAttribute("d");
  expect((path.match(/M/g) ?? []).length).toBe(1);
  const coordinates = [...path.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
  const points = recorded.points.filter((point) => point.personal);
  expect(coordinates).toHaveLength(points.length);
  const checkpoints = [0, 17, 17, 24, 279, 485, 569, 976, 1320];
  const plot = await page.locator("[data-rhythm-inspector]").evaluate((node) => ({
    left: Number(node.getAttribute("x")),
    top: Number(node.getAttribute("y")),
    width: Number(node.getAttribute("width")),
    height: Number(node.getAttribute("height")),
    maximum: Number(node.ownerSVGElement.dataset.yMaximum),
  }));
  for (const [index, coordinate] of coordinates.entries()) {
    const fraction = (Date.parse(points[index].date) - Date.parse("2017-01-01")) / (Date.parse("2027-01-01") - Date.parse("2017-01-01"));
    expect(coordinate.x).toBeCloseTo(plot.left + fraction * plot.width, 2);
    if (index > 0) {
      expect(coordinate.x).toBeGreaterThan(coordinates[index - 1].x);
      expect(coordinate.y).toBeLessThanOrEqual(coordinates[index - 1].y);
    }
  }
  checkpoints.forEach((value, index) => {
    const point = points.findIndex((point) => point.date === `${2017 + index}-12-31`);
    expect(coordinates[point].y).toBeCloseTo(plot.top + plot.height - (value / plot.maximum) * plot.height, 2);
  });
  const inspector = page.locator("[data-rhythm-inspector]");
  await inspector.focus();
  await page.keyboard.press("End");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("Sep 28, 2026");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("20,793 lifetime recorded commits");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("Unverified after the cutoff");
  await expect(page.locator(".build-rhythm-inspection-dot")).toHaveAttribute("visibility", "hidden");
  await expect(line).toHaveAttribute("data-last-date", "2026-09-28");
  await expect(page.locator("[data-rhythm-carry-legend]")).toBeHidden();
  expect(errors).toEqual([]);
});

test("the same plot changes from days to weekly bars and a cumulative line without shifting", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await open(page);
  await range(page, 2026);
  await view(page, "daily");
  const stage = page.locator(".build-rhythm-plot-stage");
  const before = await stage.boundingBox();
  const daily = await stage.screenshot();
  await expect(page.locator("[data-rhythm-slot]")).toHaveCount(378);
  await view(page, "weekly");
  const weekly = await stage.screenshot();
  expect(screenshotDiffRatio(daily, weekly)).toBeGreaterThan(0.025);
  expect(await stage.boundingBox()).toMatchObject({ y: before.y, height: before.height });
  const inspector = page.locator("[data-rhythm-inspector]");
  await inspector.focus();
  await page.keyboard.press("End");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("970 recorded commits");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("2 of 7 dates verified");
  const column = (await evidence(page)).selectedWeek;
  await expect(page.locator(`[data-rhythm-slot][data-column="${column}"][data-row="0"]`)).toHaveAttribute("data-value", "970");
  await view(page, "cumulative");
  const cumulative = await stage.screenshot();
  expect(screenshotDiffRatio(weekly, cumulative)).toBeGreaterThan(0.025);
  expect(await stage.boundingBox()).toMatchObject({ y: before.y, height: before.height });
  await inspector.focus();
  await page.keyboard.press("End");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("20,793 lifetime recorded commits");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("19,473 added in 2026 + 1,320 recorded earlier");
  expect(await evidence(page)).toMatchObject({ yearTotal: 19473, rangeTotal: 19473, carryIn: 1320, lifetimeTotal: 20793 });
  await expect(page.locator("[data-rhythm-carry-legend]")).toContainText("1,320 recorded before 2026");
  const path = await page.locator("[data-rhythm-cumulative-line]").getAttribute("d");
  const lastX = Number(path.match(/L([\d.]+),[\d.]+$/)[1]);
  const cutoffX = await inspector.evaluate(
    (node) =>
      Number(node.getAttribute("x")) +
      (Number(node.getAttribute("width")) * (Date.parse("2026-09-28") - Date.parse("2026-01-01"))) /
        (Date.parse("2027-01-01") - Date.parse("2026-01-01"))
  );
  expect(lastX).toBeCloseTo(cutoffX, 2);
  await testInfo.attach("one-stage-cumulative", { body: cumulative, contentType: "image/png" });
  expect(errors).toEqual([]);
});

test("one keyboard inspector opens a history week and distinguishes zeros, missing dates, and leap days", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await open(page);
  const inspector = page.locator("[data-rhythm-inspector]");
  await inspector.focus();
  await page.keyboard.press("Home");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("2017");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-rhythm-chart]")).toHaveAttribute("data-view", "daily");
  await expect(inspector).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("Aug 31, 2017");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("0 recorded commits");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("Before verified coverage");
  await range(page, 2020);
  await expect(page.locator('[data-rhythm-slot][data-date="2020-02-29"]')).toHaveAttribute("data-evidence", "zero");
  await range(page, 2026);
  await inspector.focus();
  await page.keyboard.press("End");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("Sep 28, 2026");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("569 recorded commits");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("Unverified after the cutoff");
  await expect(page.locator('[data-rhythm-slot][data-date="2026-09-29"]')).toHaveAttribute("data-value", "unverified");
  await expect(page.locator('[data-rhythm-slot][data-date="2026-12-31"]')).toHaveAttribute("data-evidence", "future");
  expect(errors).toEqual([]);
});

test("rapid range and view changes finish only the latest state at full opacity", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await open(page);
  await page.evaluate(() => {
    const start = document.querySelector("[data-rhythm-range-start]"),
      end = document.querySelector("[data-rhythm-range-end]");
    start.value = "2024";
    start.dispatchEvent(new Event("change"));
    document.querySelector('[data-rhythm-view="weekly"]').click();
    document.querySelector('[data-rhythm-view="cumulative"]').click();
    end.value = "2025";
    end.dispatchEvent(new Event("change"));
    document.querySelector('[data-rhythm-view="history"]').click();
    start.value = "2026";
    start.dispatchEvent(new Event("change"));
    document.querySelector('[data-rhythm-view="cumulative"]').click();
    document.querySelector("[data-rhythm-range-reset]").click();
  });
  const chart = page.locator("[data-rhythm-chart]");
  await expect(chart).toHaveAttribute("data-transitioning", "false");
  await expect(chart).toHaveAttribute("data-start-year", "2017");
  await expect(chart).toHaveAttribute("data-end-year", "2026");
  await expect(chart).toHaveAttribute("data-view", "cumulative");
  await expect(chart.locator("[data-rhythm-marks]")).toHaveCount(1);
  await expect(chart.locator("[data-rhythm-cumulative-line]")).toHaveCount(1);
  expect(await chart.locator("[data-rhythm-marks]").evaluate((node) => Number(node.getAttribute("opacity") ?? 1))).toBe(1);
  expect(await evidence(page)).toMatchObject({ rangeStart: 2017, rangeEnd: 2026, view: "cumulative", transitioning: false });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    document.querySelector('[data-rhythm-view="daily"]').click();
  });
  expect((await evidence(page)).transitioning).toBe(false);
  expect(await chart.locator("[data-rhythm-marks]").evaluate((node) => Number(node.getAttribute("opacity") ?? 1))).toBe(1);
  expect(errors).toEqual([]);
});

test("reduced motion and the deferred daily table preserve exact values for the selected range", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await open(page, { reduced: true, theme: "dark" });
  await range(page, 2026);
  for (const mode of ["weekly", "cumulative", "daily", "history"]) {
    await page.locator(`[data-rhythm-view="${mode}"]`).click();
    expect((await evidence(page)).transitioning).toBe(false);
  }
  await view(page, "cumulative");
  await expect(page.locator("[data-rhythm-table-body] tr")).toHaveCount(0);
  await page.locator("[data-rhythm-method] > summary").click();
  await page.locator("[data-rhythm-records] > summary").click();
  await expect(page.locator("[data-rhythm-table-body] tr")).toHaveCount(271);
  const final = page.locator("[data-rhythm-table-body] tr").last();
  await expect(final.locator("th")).toHaveText("2026-09-28");
  await expect(final.locator("td").first()).toHaveText("569");
  await expect(final.locator("td").last()).toHaveText(recorded.points.at(-1).personal.authored_commits.toLocaleString("en-US"));
  await page.locator("[data-rhythm-range-reset]").click();
  await expect(page.locator("[data-rhythm-table-body] tr")).toHaveCount(3316);
  await expect(page.locator("[data-rhythm-table-body] tr").first().locator("th")).toHaveText("2017-08-31");
  await range(page, 2024, 2025);
  await expect(page.locator("[data-rhythm-table-body] tr")).toHaveCount(731);
  await expect(page.locator("[data-rhythm-chart]")).toHaveAttribute("data-view", "cumulative");
  await expect(page.locator("[data-github-activity] svg")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("invalid snapshots fail compactly, while schema 5 and separate Intern work remain supported", async ({ page, browser }) => {
  const malformed = structuredClone(recorded);
  malformed.points.at(-1).personal.authored_commits = malformed.points.at(-1).personal.commits + 1;
  await open(page, { activity: malformed });
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "unavailable");
  await expect(page.locator("[data-personal-code-unavailable]")).toHaveText("Code history is being rebuilt.");
  await expect(page.locator("[data-build-rhythm-overview]")).toBeHidden();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const valid = structuredClone(recorded);
    valid.schema = 5;
    for (const point of valid.points)
      for (const [id, value] of Object.entries(point))
        if (id !== "date") {
          value.additions = value.authored_commits * 3;
          value.deletions = value.authored_commits;
        }
    const other = await context.newPage(),
      errors = collectRuntimeErrors(other);
    await open(other, { activity: valid });
    expect((await evidence(other)).total).toBe(sum(recorded.points));
    await view(other, "cumulative");
    expect((await evidence(other)).lifetimeTotal).toBe(sum(recorded.points));
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("touch opens a history week in the same chart and narrow layouts keep every range control", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage(),
      errors = collectRuntimeErrors(page);
    await open(page, { reduced: true });
    const point = await page.evaluate(() => {
      const node = document.querySelector('[data-rhythm-history-cell][data-year="2024"][data-column="20"]');
      const chart = document.querySelector("[data-rhythm-chart]"),
        point = chart.createSVGPoint();
      point.x = Number(node.getAttribute("x")) + Number(node.getAttribute("width")) / 2;
      point.y = Number(node.getAttribute("y")) + Number(node.getAttribute("height")) / 2;
      const screen = point.matrixTransform(node.getScreenCTM());
      return { x: screen.x, y: screen.y };
    });
    await page.touchscreen.tap(point.x, point.y);
    await expect(page.locator("[data-rhythm-chart]")).toHaveAttribute("data-view", "daily");
    await expect(page.locator("[data-rhythm-chart]")).toHaveAttribute("data-year", "2024");
    await expect(page.locator("[data-rhythm-range-start]")).toHaveValue("2017");
    await expect(page.locator("[data-rhythm-range-end]")).toHaveValue("2026");
    for (const control of await page
      .locator("[data-rhythm-view], [data-rhythm-range-start], [data-rhythm-range-end], [data-rhythm-range-reset]")
      .all()) {
      const bounds = await control.boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(391);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect((await evidence(page)).plotHeight).toBe(290);
    for (const mode of ["weekly", "cumulative"]) {
      await view(page, mode);
      const clipped = await page.locator("[data-rhythm-chart] text").evaluateAll((nodes) =>
        nodes.some((node) => {
          const box = node.getBBox(),
            svg = node.ownerSVGElement;
          return box.x < -0.5 || box.x + box.width > svg.viewBox.baseVal.width + 0.5;
        })
      );
      expect(clipped, `${mode} labels are clipped on mobile`).toBe(false);
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
