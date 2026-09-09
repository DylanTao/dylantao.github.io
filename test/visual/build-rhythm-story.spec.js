const { test, expect } = require("@playwright/test");
const { attachScreenshot, collectRuntimeErrors, preparePage, screenshotDiffRatio } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

const dailyActivityFixture = (() => {
  const points = [];
  const start = Date.UTC(2017, 7, 31);
  const end = Date.UTC(2026, 6, 31);
  for (let stamp = start, index = 0; stamp <= end; stamp += 86_400_000, index += 1) {
    const date = new Date(stamp).toISOString().slice(0, 10);
    const active = index % 9 === 0 || index % 17 === 0;
    // `commits` is the source's reported total; `authored_commits` is the
    // non-merge, non-deploy subset that alone carries the line counts.
    const authored = active ? (index % 13) + 1 : 0;
    points.push({
      date,
      personal: {
        commits: active ? authored + (index % 3) : 0,
        authored_commits: authored,
        additions: active ? (index % 31) * 140 + 20 : 0,
        deletions: active ? (index % 23) * 90 + 10 : 0,
      },
    });
  }
  return {
    schema: 5,
    updated_on: "2026-07-31",
    date_basis: "source_reported_calendar",
    scope: "code_activity",
    sources: [
      {
        id: "personal",
        label: "Personal",
        basis: "github_contribution_parity",
        date_basis: "github_profile_author_date",
        completion_timezone: "America/Los_Angeles",
        starts_on: points[0].date,
        complete_through: points.at(-1).date,
      },
    ],
    coverage: {
      starts_on: points[0].date,
      complete_through: points.at(-1).date,
      status: "complete",
    },
    points,
  };
})();

const lateSourceStart = "2026-06-15";
const multiSourceActivityFixture = (() => {
  const fixture = structuredClone(dailyActivityFixture);
  fixture.sources.push({
    id: "intern",
    label: "Intern work",
    basis: "reported_daily_summary",
    date_basis: "utc_calendar_date",
    completion_timezone: "UTC",
    starts_on: lateSourceStart,
    complete_through: fixture.coverage.complete_through,
  });
  fixture.points.forEach((point, index) => {
    if (point.date < lateSourceStart) return;
    point.intern = {
      commits: index % 4 === 0 ? 3 : 2,
      authored_commits: 1,
      additions: 24 + (index % 7),
      deletions: 8 + (index % 5),
    };
  });
  return fixture;
})();

const gotoWithDailyCode = async (page, { waitUntil = "networkidle", activity = dailyActivityFixture } = {}) => {
  const routeUrl = publicRouteUrl("/github-activity/");
  const response = await page.request.get(routeUrl);
  expect(response.ok()).toBe(true);
  const original = await response.text();
  const dataPattern = /<script id="code-activity-data" type="application\/json">[\s\S]*?<\/script>/;
  expect(original).toMatch(dataPattern);
  const withDaily = original.replace(dataPattern, `<script id="code-activity-data" type="application/json">${JSON.stringify(activity)}</script>`);
  await page.route(routeUrl, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: withDaily,
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
  await expect(page.getByText("Code history is being rebuilt.", { exact: true })).toHaveCount(1);
  await expect(page.locator("[data-github-scope]")).toHaveText("CODE ACTIVITY");
  await expect(page.locator("[data-build-rhythm-story]")).toBeHidden();
  await expect(page.getByRole("link", { name: "Open the explorer" })).toBeHidden();
  await expect(page.locator(".github-activity-controls")).toBeHidden();
  await expect(page.locator(".github-activity-chart-shell")).toBeHidden();
  await expect(page.locator(".github-activity-method")).toBeHidden();
  await expect(page.locator(".github-activity-readout")).toBeHidden();
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

test("personal daily code activity fails closed before dereferencing a malformed point", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves malformed points do not escape validation");

  const runtimeErrors = collectRuntimeErrors(page);
  const malformed = structuredClone(dailyActivityFixture);
  malformed.points[0] = null;
  await preparePage(page, "light");
  await gotoWithDailyCode(page, { activity: malformed });

  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "unavailable");
  expect(runtimeErrors).toEqual([]);
});

test("code activity fails closed when the public date basis is relabeled", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the public calendar contract");

  const malformed = structuredClone(dailyActivityFixture);
  malformed.date_basis = "utc_calendar_date";
  await preparePage(page, "light");
  await gotoWithDailyCode(page, { activity: malformed });
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "unavailable");
});

test("code activity fails closed when a source completion timezone is relabeled", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the per-source calendar contract");

  const malformed = structuredClone(dailyActivityFixture);
  malformed.sources[0].completion_timezone = "UTC";
  await preparePage(page, "light");
  await gotoWithDailyCode(page, { activity: malformed });
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "unavailable");
});

test("schema-4 code activity never renders as a current snapshot", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the legacy render boundary");

  const legacy = structuredClone(dailyActivityFixture);
  legacy.schema = 4;
  legacy.timezone = "UTC";
  delete legacy.date_basis;
  legacy.sources.forEach((descriptor) => {
    delete descriptor.date_basis;
    delete descriptor.completion_timezone;
  });
  await preparePage(page, "light");
  await gotoWithDailyCode(page, { activity: legacy });
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "unavailable");
});

test("code activity fails closed when an approved source predates the lifetime anchor", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the lifetime domain stays pinned");

  const malformed = structuredClone(dailyActivityFixture);
  malformed.sources.push({
    id: "intern",
    label: "Intern work",
    basis: "reported_daily_summary",
    date_basis: "utc_calendar_date",
    completion_timezone: "UTC",
    starts_on: "2017-08-30",
    complete_through: "2017-08-30",
  });
  malformed.coverage.starts_on = "2017-08-30";
  malformed.points.unshift({
    date: "2017-08-30",
    intern: { commits: 0, authored_commits: 0, additions: 0, deletions: 0 },
  });
  await preparePage(page, "light");
  await gotoWithDailyCode(page, { activity: malformed });
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "unavailable");
});

test("code activity fails closed on an impossible ISO calendar date", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves browser and importer date parsing agree");

  const malformed = structuredClone(dailyActivityFixture);
  const normalizedMarchFirst = malformed.points.find((point) => point.date === "2025-03-01");
  expect(normalizedMarchFirst).toBeTruthy();
  normalizedMarchFirst.date = "2025-02-29";
  await preparePage(page, "light");
  await gotoWithDailyCode(page, { activity: malformed });
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "unavailable");
});

test("late source bands, filtering, focus, theme, and table stay truthful", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop exercises the multi-source contract before tablet resizing");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await gotoWithDailyCode(page, { activity: multiSourceActivityFixture });

  const activity = page.locator("[data-github-activity]");
  const chart = page.locator("#github-activity-chart");
  const sourceAreas = chart.locator(".github-activity-commit-source-area");
  const personalButton = page.locator('.github-activity-legend-item[data-source-id="personal"]');
  const internButton = page.locator('.github-activity-legend-item[data-source-id="intern"]');
  await expect(activity).toHaveAttribute("data-state", "ready");
  // The readable default is three years. This spec asserts lifetime domain
  // geometry, so it selects lifetime explicitly rather than inheriting it.
  await expect(page.getByRole("button", { name: "3 years", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Lifetime", exact: true }).click();
  await expect(sourceAreas).toHaveCount(2);
  await expect(personalButton).toHaveText("Personal");
  await expect(internButton).toHaveText("Intern work");
  await expect(chart).toContainText("COMMITS PER DATE LABEL");
  await expect(chart).toContainText("LINES CHANGED PER DATE LABEL");
  await expect(page.locator("[data-github-scope]")).toHaveText("LIFETIME \u00b7 DATE LABELS");
  // The encoding key is an HTML strip above the SVG and uses the profile SVG twin's words.
  await expect(page.locator("[data-chart-key]").getByText("Merges + deploys", { exact: true })).toBeVisible();
  await expect(chart.locator(".github-activity-commit-source-seam")).toHaveCount(1);
  await expect(page.locator('[data-source-readout-id="intern"]')).toContainText("Intern work");

  const internCoverageGeometry = await chart.evaluate(
    (svg, { lateStart, lifetimeStart, lifetimeEnd }) => {
      const path = svg.querySelector('.github-activity-commit-source-area[data-source-id="intern"]');
      const start = Date.parse(`${lifetimeStart}T00:00:00Z`);
      const end = Date.parse(`${lifetimeEnd}T00:00:00Z`);
      const coordinates = Array.from(path.getAttribute("d").matchAll(/[ML]\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g), (match) => ({
        x: Number(match[1]),
        y: Number(match[2]),
      }));
      const pointCount = coordinates.length / 2;
      const upper = coordinates.slice(0, pointCount);
      const lower = coordinates.slice(pointCount).reverse();
      const indexFor = (date) => Math.round((Date.parse(`${date}T00:00:00Z`) - start) / 86_400_000);
      const thicknesses = upper.map((point, index) => Math.abs(point.y - lower[index].y));
      const firstPositiveIndex = thicknesses.findIndex((thickness) => thickness > 0.1);
      return {
        domainDays: Math.round((end - start) / 86_400_000) + 1,
        pointCount,
        expectedStartIndex: indexFor(lateStart),
        firstPositiveIndex,
        maxBeforeThickness: Math.max(0, ...thicknesses.slice(0, firstPositiveIndex)),
        firstPositiveThickness: thicknesses[firstPositiveIndex] || 0,
      };
    },
    {
      lateStart: lateSourceStart,
      lifetimeStart: dailyActivityFixture.coverage.starts_on,
      lifetimeEnd: dailyActivityFixture.coverage.complete_through,
    }
  );
  expect(internCoverageGeometry.pointCount).toBe(internCoverageGeometry.domainDays);
  expect(internCoverageGeometry.firstPositiveIndex).toBe(internCoverageGeometry.expectedStartIndex);
  expect(internCoverageGeometry.maxBeforeThickness).toBeLessThanOrEqual(0.01);
  expect(internCoverageGeometry.firstPositiveThickness).toBeGreaterThan(0.1);

  const colorsBefore = await page.evaluate(() => ({
    swatch: getComputedStyle(document.querySelector('.github-activity-legend-item[data-source-id="intern"] .github-activity-legend-swatch'))
      .backgroundColor,
    band: getComputedStyle(document.querySelector('.github-activity-commit-source-area[data-source-id="intern"]')).fill,
  }));
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.setAttribute("data-theme-mode", "evening");
    document.documentElement.setAttribute("data-theme-setting", "evening");
  });
  await expect
    .poll(async () => internButton.locator(".github-activity-legend-swatch").evaluate((node) => getComputedStyle(node).backgroundColor))
    .not.toBe(colorsBefore.swatch);
  const colorsAfter = await page.evaluate(() => ({
    swatch: getComputedStyle(document.querySelector('.github-activity-legend-item[data-source-id="intern"] .github-activity-legend-swatch'))
      .backgroundColor,
    band: getComputedStyle(document.querySelector('.github-activity-commit-source-area[data-source-id="intern"]')).fill,
  }));
  expect(colorsBefore.swatch).toBe(colorsBefore.band);
  expect(colorsAfter.swatch).toBe(colorsAfter.band);

  await personalButton.focus();
  await personalButton.press("Enter");
  await expect(personalButton).toBeFocused();
  await expect(personalButton).toHaveAttribute("aria-pressed", "false");
  await expect(internButton).toHaveAttribute("aria-pressed", "true");
  await expect(sourceAreas).toHaveCount(0);
  await expect(chart.locator(".github-activity-commit-source-seam")).toHaveCount(0);
  await expect(page.locator("[data-source-readout-id]")).toHaveCount(0);
  await expect(chart).toContainText("COMMITS PER DAY");
  await expect(chart).toContainText("LINES CHANGED PER DAY");
  await expect(page.locator("[data-github-scope]")).toHaveText("LIFETIME \u00b7 DAILY");
  await expect(page.locator("#github-activity-range-summary")).toContainText("Jun 15, 2026");
  await expect(page.locator("#github-activity-range-summary")).toContainText("Jul 31, 2026");
  await expect(chart.locator(".github-activity-commit-total-line")).toHaveAttribute("d", /^M 82\.00 /);

  const disclosure = page.locator(".github-activity-method");
  const tableBody = page.locator("#github-activity-table-body");
  await expect(tableBody).toHaveAttribute("data-state", "deferred");
  await expect(tableBody.locator("tr")).toHaveCount(0);
  await disclosure.locator("summary").click();
  const expectedRows =
    Math.round(
      (Date.parse(`${dailyActivityFixture.coverage.complete_through}T00:00:00Z`) - Date.parse(`${lateSourceStart}T00:00:00Z`)) / 86_400_000
    ) + 1;
  await expect(tableBody.locator("tr")).toHaveCount(expectedRows);
  await expect(tableBody.locator("tr").last().locator("th").first()).toHaveText(lateSourceStart);
  await expect(tableBody.locator("tr").first().locator("th, td")).toHaveCount(6);

  await tableBody
    .locator("tr")
    .first()
    .evaluate((row) => {
      row.dataset.renderProbe = "preserved";
    });
  await page.getByRole("button", { name: "Literal", exact: true }).click();
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.setAttribute("data-theme-mode", "noon");
    document.documentElement.setAttribute("data-theme-setting", "noon");
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator("#github-activity-table-scroll-hint")).toBeVisible();
  await expect(tableBody.locator("tr").first()).toHaveAttribute("data-render-probe", "preserved");
  await disclosure.locator("summary").click();
  await expect(tableBody.locator("tr")).toHaveCount(0);
  await expect(tableBody).toHaveAttribute("data-state", "deferred");
  expect(runtimeErrors).toEqual([]);
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
  await gotoWithDailyCode(page);

  const story = page.locator("[data-build-rhythm-story]");
  const stage = page.locator("[data-build-rhythm-story-stage]");
  const chart = page.locator("[data-build-rhythm-story-chart]");
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "ready");
  await expect(story).toHaveAttribute("data-state", "ready");
  await expect(stage).toBeVisible();
  await expect(chart.locator("[data-build-rhythm-story-layer]")).toHaveCount(1);

  await expect(page.locator("[data-personal-code-unavailable]")).toBeHidden();

  const explorerChart = page.locator("#github-activity-chart");
  const sourceLegend = page.locator("[data-source-legend]");
  await expect(page.locator("[data-count-mode]")).toHaveCount(0);
  await expect(sourceLegend).toBeVisible();
  await expect(sourceLegend.locator(".github-activity-source-legend-label")).toHaveText("Source");
  await expect(sourceLegend.locator(".github-activity-legend-item.is-static")).toHaveText("Personal");
  await expect(sourceLegend.getByRole("button", { name: "Personal", exact: true })).toHaveCount(0);
  await expect(explorerChart.locator(".github-activity-commit-gap-band")).toHaveCount(1);
  await expect(explorerChart.locator(".github-activity-commit-total-line")).toHaveCount(1);
  await expect(explorerChart.locator(".github-activity-authored-line")).toHaveCount(1);
  const commitComparison = await explorerChart.evaluate((element) => ({
    gap: element.querySelector(".github-activity-commit-gap-band")?.getAttribute("d") || "",
    total: element.querySelector(".github-activity-commit-total-line")?.getAttribute("d") || "",
    authored: element.querySelector(".github-activity-authored-line")?.getAttribute("d") || "",
  }));
  expect(commitComparison.gap.length).toBeGreaterThan(100);
  expect(commitComparison.total.length).toBeGreaterThan(100);
  expect(commitComparison.authored.length).toBeGreaterThan(100);
  expect(commitComparison.total).not.toBe(commitComparison.authored);
  await expect(page.locator("#github-activity-selected-commits")).toContainText("total");
  await expect(page.locator("#github-activity-selected-commits")).toContainText("authored");

  await expect(story).toContainText("Total commits tell me when. Authored line changes tell me how much.");
  await expect(story).toContainText("One giant day was flattening everything else.");
  await expect(story).not.toContainText("The same week can carry a different amount of change.");

  await expect(story.getByRole("link", { name: "The Rhythm of Food" })).toHaveAttribute("href", "https://rhythm-of-food.net/");
  await expect(story.getByRole("link", { name: "John Thompson" })).toHaveAttribute("href", "https://jrthomp.com/");
  await expect(story.getByRole("link", { name: "Read how Build Rhythm began" })).toHaveAttribute("href", /\/projects\/build-rhythm\/$/);

  const viewportWidth = page.viewportSize()?.width || 0;
  const explorerLabels = await explorerChart.locator(".github-activity-year-label").evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const box = node.getBBox();
        return { left: box.x, right: box.x + box.width };
      })
      .sort((left, right) => left.left - right.left)
  );
  explorerLabels.slice(1).forEach((label, index) => {
    expect(label.left - explorerLabels[index].right).toBeGreaterThanOrEqual(-0.5);
  });
  await page.getByRole("button", { name: "1 year", exact: true }).click();
  const recentDomainLabels = await explorerChart.locator(".github-activity-domain-label").evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const box = node.getBBox();
        return { left: box.x, right: box.x + box.width };
      })
      .sort((left, right) => left.left - right.left)
  );
  expect(recentDomainLabels).toHaveLength(2);
  expect(recentDomainLabels[1].left - recentDomainLabels[0].right).toBeGreaterThanOrEqual(-0.5);
  await page.getByRole("button", { name: "Lifetime", exact: true }).click();
  if (viewportWidth <= 820) {
    await expect(story).toHaveAttribute("data-story-static", "true");
    await expect(stage).toHaveAttribute("data-scene", "complete");
    await expect(chart.locator('[data-build-rhythm-story-layer="complete"]')).toHaveCount(1);
    await expect(chart.locator("[data-build-rhythm-y-axis]")).toHaveCount(2);
    await expectReadableAxes(chart, 12);
    await expect(page.locator(".build-rhythm-story-step.is-active")).toHaveCount(0);
  } else {
    await expect(story).toHaveAttribute("data-story-static", "false");
    const sceneAxisCounts = { cadence: 1, magnitude: 1, bursts: 2, explore: 2 };
    for (const scene of ["cadence", "magnitude", "bursts", "explore"]) {
      const step = page.locator(`[data-build-rhythm-step="${scene}"]`);
      await step.scrollIntoViewIfNeeded();
      await expect(step).toHaveClass(/is-active/);
      await expect(stage).toHaveAttribute("data-scene", scene);
      await expect(stage).toHaveAttribute("data-transitioning", "false");
      await expect(chart.locator("[data-build-rhythm-y-axis]")).toHaveCount(sceneAxisCounts[scene]);
      if (sceneAxisCounts[scene]) await expectReadableAxes(chart, scene === "explore" ? 12 : 14);
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
    }
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${viewportWidth}px Build Rhythm page overflows`).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Readable", exact: true })).toHaveAttribute("aria-pressed", "true");
  const latest = page.getByRole("button", { name: "Jump to latest", exact: true });
  const inspector = explorerChart.locator(".github-activity-inspector");
  const chartShell = page.locator(".github-activity-chart-shell");
  await latest.focus();
  await page.keyboard.press("Tab");
  await expect(inspector).toBeFocused();
  const focusOutline = await chartShell.evaluate((element) => ({
    style: getComputedStyle(element).outlineStyle,
    width: Number.parseFloat(getComputedStyle(element).outlineWidth || "0"),
  }));
  expect(focusOutline.style).not.toBe("none");
  expect(focusOutline.width).toBeGreaterThan(0);
  // A tall locator screenshot can stitch the fixed nav through its capture.
  // Prove the real focused chart has a usable, unobscured viewport region.
  // Tab-into-view scrolling is asynchronous, so poll for the settled geometry
  // instead of sampling the first frame after the key press; an inspector that
  // genuinely never reaches the viewport still fails here.
  const measureFocusVisibility = () =>
    inspector.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const nav = document.querySelector("nav");
      const navBottom = Math.max(0, nav?.getBoundingClientRect().bottom || 0);
      const visibleTop = Math.max(0, navBottom, rect.top);
      const visibleBottom = Math.min(window.innerHeight, rect.bottom);
      const sampleX = Math.min(window.innerWidth - 1, Math.max(0, rect.left + Math.min(24, rect.width / 2)));
      const sampleY = Math.min(window.innerHeight - 1, Math.max(visibleTop, Math.min(visibleBottom - 1, visibleTop + 12)));
      const hit = document.elementFromPoint(sampleX, sampleY);
      return {
        visibleHeight: Math.max(0, visibleBottom - visibleTop),
        coveredByNav: Boolean(nav && hit && nav.contains(hit)),
      };
    });
  await expect.poll(async () => (await measureFocusVisibility()).visibleHeight, { timeout: 5000 }).toBeGreaterThanOrEqual(44);
  const focusVisibility = await measureFocusVisibility();
  expect(focusVisibility.coveredByNav).toBe(false);
  const backToTop = page.locator("#back-to-top");
  await expect(backToTop).toHaveCount(1);
  if (viewportWidth <= 575) {
    await expect(backToTop).toBeHidden();
    await expect(page.locator(".mobile-back-to-top")).toBeVisible();
  } else {
    await expect(backToTop).toBeVisible();
  }
  await page.getByRole("button", { name: "Literal", exact: true }).click();
  await page.getByRole("button", { name: "Readable", exact: true }).click();
  await expect(page.locator("#github-activity-table-body")).toBeAttached();
  const workbench = page.locator(".github-activity-workbench");
  // Capture honest viewports instead of stitching one element taller than the
  // viewport, which can repeat fixed chrome through the evidence image.
  await workbench.evaluate((element) => element.scrollIntoView({ block: "start" }));
  await attachScreenshot(page, testInfo, `build-rhythm-explorer-${testInfo.project.name}`, { fullPage: false });
  await chartShell.scrollIntoViewIfNeeded();
  await attachScreenshot(page, testInfo, `build-rhythm-explorer-chart-${testInfo.project.name}`, { fullPage: false });
  await attachScreenshot(page, testInfo, `build-rhythm-stage-${testInfo.project.name}`, { locator: stage });
  await attachScreenshot(page, testInfo, `build-rhythm-story-${testInfo.project.name}`, { locator: story });
  expect(runtimeErrors).toEqual([]);
});

test("Build Rhythm explorer guide geometry and jump-to-latest stay exact", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the explorer guide and jump-to-latest contract");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await gotoWithDailyCode(page);

  const chart = page.locator("#github-activity-chart");
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "ready");

  const guide = chart.locator(".github-activity-guide");
  const yearGrid = chart.locator(".github-activity-year-grid").last();
  const sharedBottom = await Promise.all([guide, yearGrid].map((locator) => locator.getAttribute("y2")));
  expect(sharedBottom[0]).toBe(sharedBottom[1]);
  const selectionBand = chart.locator(".github-activity-selection-band");
  expect(Number(await selectionBand.getAttribute("height"))).toBe(Number(await guide.getAttribute("y2")) - Number(await guide.getAttribute("y1")));

  const inspector = chart.locator(".github-activity-inspector");
  const pointerBox = await inspector.boundingBox();
  expect(pointerBox).not.toBeNull();
  await inspector.click({ position: { x: pointerBox.width * 0.5, y: 20 }, force: true });
  expect(runtimeErrors).toEqual([]);
  await expect(page.locator("#github-activity-selected-date")).not.toHaveText("Jul 31, 2026");
  await page.getByRole("button", { name: "Jump to latest", exact: true }).click();
  await expect(page.locator("#github-activity-selected-date")).toHaveText("Jul 31, 2026");
  expect(runtimeErrors).toEqual([]);
});

test("Build Rhythm reduced motion renders one complete still", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the reduced-motion story contract");

  const runtimeErrors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await preparePage(page, "light");
  await gotoWithDailyCode(page);

  const story = page.locator("[data-build-rhythm-story]");
  const stage = page.locator("[data-build-rhythm-story-stage]");
  const explorerChart = page.locator("#github-activity-chart");
  await expect(story).toHaveAttribute("data-state", "ready");
  await expect(story).toHaveAttribute("data-story-static", "true");
  await expect(stage).toHaveAttribute("data-scene", "complete");
  await expect(stage).toHaveAttribute("data-transitioning", "false");
  await page.waitForTimeout(120);
  const before = await stage.screenshot();
  const explorerBefore = await explorerChart.screenshot();
  await page.waitForTimeout(260);
  const after = await stage.screenshot();
  const explorerAfter = await explorerChart.screenshot();
  expect(screenshotDiffRatio(after, before), "reduced-motion story should remain pixel-stable").toBeLessThan(0.0001);
  expect(screenshotDiffRatio(explorerAfter, explorerBefore), "reduced-motion code explorer should remain pixel-stable").toBeLessThan(0.0001);
  expect(runtimeErrors).toEqual([]);
});

test("Build Rhythm axes stay legible in the evening theme", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "dark");
  await gotoWithDailyCode(page);

  const story = page.locator("[data-build-rhythm-story]");
  const stage = page.locator("[data-build-rhythm-story-stage]");
  const storyChart = page.locator("[data-build-rhythm-story-chart]");
  const explorerChart = page.locator("#github-activity-chart");
  await expect(story).toHaveAttribute("data-state", "ready");
  if (["desktop-1440", "laptop-1280"].includes(testInfo.project.name)) {
    await page.locator('[data-build-rhythm-step="bursts"]').scrollIntoViewIfNeeded();
    await expect(stage).toHaveAttribute("data-scene", "bursts");
    await expect(storyChart.locator("[data-build-rhythm-y-axis]")).toHaveCount(2);
    await expectReadableAxes(storyChart, 14);
  } else {
    await expect(stage).toHaveAttribute("data-scene", "complete");
    await expect(storyChart.locator("[data-build-rhythm-y-axis]")).toHaveCount(2);
    await expectReadableAxes(storyChart, 12);
  }
  await expectReadableAxes(explorerChart, testInfo.project.name === "mobile-390" ? 12 : 14);
  await expect(explorerChart.locator(".github-activity-commit-gap-band")).toHaveCount(1);
  await expect(explorerChart.locator(".github-activity-commit-total-line")).toHaveCount(1);
  await expect(explorerChart.locator(".github-activity-authored-line")).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${testInfo.project.name} dark Build Rhythm page overflows`).toBeLessThanOrEqual(1);
  const inspector = explorerChart.locator(".github-activity-inspector");
  const chartShell = page.locator(".github-activity-chart-shell");
  await inspector.focus();
  await expect(inspector).toBeFocused();
  await inspector.press("ArrowLeft");
  const outline = await chartShell.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe("none");
  const tickColors = await page.locator(".build-rhythm-axis-tick").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).fill));
  expect(tickColors.length).toBeGreaterThan(4);
  expect(tickColors.every((color) => color && color !== "none" && color !== "rgba(0, 0, 0, 0)")).toBe(true);
  await attachScreenshot(page, testInfo, `build-rhythm-evening-axes-${testInfo.project.name}`, { locator: stage });
  await chartShell.scrollIntoViewIfNeeded();
  await attachScreenshot(page, testInfo, `build-rhythm-evening-explorer-${testInfo.project.name}`, { fullPage: false });
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

  await page.locator(".github-activity-source").scrollIntoViewIfNeeded();
  await expect(story).toHaveAttribute("data-story-visible", "false");
  await cadence.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));

  await expect(story).toHaveAttribute("data-story-visible", "true");
  await expect(cadence).toHaveClass(/is-active/);
  await expect(stage).toHaveAttribute("data-scene", "cadence");
  await expect(stage).toHaveAttribute("data-transitioning", "false");
});
