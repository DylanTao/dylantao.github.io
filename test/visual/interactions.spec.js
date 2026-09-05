const { test, expect } = require("@playwright/test");
const { collectRuntimeErrors, preparePage, stabilizeVisuals } = require("./helpers");
const { getPublicBaseURL, usesExternalVisualServer } = require("./public-routes");

async function openOptionalStarterRoute(page, path) {
  const response = await page.goto(path, { waitUntil: "networkidle" });
  test.skip(response?.status() === 404, `starter fixture route is unpublished: ${path}`);
  await stabilizeVisuals(page);
}

async function shakeCurrentRecord(page) {
  const portrait = page.locator("#home-profile-image-container");
  await expect(portrait).toBeVisible();
  const box = await portrait.boundingBox();
  expect(box).not.toBeNull();

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const offsets = [42, -42, 46, -46, 48, -48];
  const canUseSyntheticPointer = await page.evaluate(() => Boolean(window.PointerEvent));

  if (canUseSyntheticPointer) {
    await portrait.evaluate((element, shakeOffsets) => {
      const rect = element.getBoundingClientRect();
      const pointerId = 817;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const originalCapture = element.setPointerCapture;
      element.setPointerCapture = () => {};

      const dispatchPointer = (type, x, buttons = 1) => {
        element.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId,
            pointerType: "touch",
            clientX: x,
            clientY: centerY + 2,
            button: type === "pointerdown" ? 0 : -1,
            buttons,
          })
        );
      };

      dispatchPointer("pointerdown", centerX);
      shakeOffsets.forEach((offset) => dispatchPointer("pointermove", centerX + offset));
      dispatchPointer("pointerup", centerX, 0);
      element.setPointerCapture = originalCapture;
    }, offsets);
    return;
  }

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  for (const offset of offsets) {
    await page.mouse.move(centerX + offset, centerY + 2, { steps: 2 });
  }
  await page.mouse.up();
}

async function clickDeskCanvasAt(page, xRatio, yRatio, options = {}) {
  const canvas = page.locator(".home-desk-corner-canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const targetX = box.x + box.width * xRatio;
  const targetY = box.y + box.height * yRatio;
  if (options.hoverMs) {
    await page.mouse.move(targetX, targetY);
    await page.waitForTimeout(options.hoverMs);
  }
  await page.mouse.click(targetX, targetY);
}

async function requestDeskEvidence(scene) {
  const revision = await scene.evaluate((element) => {
    const before = Number(element.getAttribute("data-scene-evidence-revision") || 0);
    element.dispatchEvent(new Event("home-desk-request-evidence"));
    return { before, after: Number(element.getAttribute("data-scene-evidence-revision") || 0) };
  });
  expect(revision.after).toBeGreaterThan(revision.before);
}

async function clickDeskProjectedTarget(page, scene, boundsAttribute) {
  await requestDeskEvidence(scene);
  await expect(scene).toHaveAttribute(boundsAttribute, /^\{/);
  const bounds = JSON.parse((await scene.getAttribute(boundsAttribute)) || "{}");
  const xRatio = (bounds.left + bounds.right) / 2;
  const yRatio = bounds.top + (bounds.bottom - bounds.top) * 0.18;
  expect(xRatio).toBeGreaterThan(0);
  expect(xRatio).toBeLessThan(1);
  expect(yRatio).toBeGreaterThan(0);
  expect(yRatio).toBeLessThan(1);
  await clickDeskCanvasAt(page, xRatio, yRatio);
}

async function getDeskAlbumTarget(scene, index, targetKey) {
  await expect
    .poll(async () => {
      await requestDeskEvidence(scene);
      const evidence = JSON.parse((await scene.getAttribute("data-album-screen-bounds")) || "[]");
      return Boolean(evidence.find((entry) => entry.index === index)?.[targetKey]);
    })
    .toBe(true);
  const evidence = JSON.parse((await scene.getAttribute("data-album-screen-bounds")) || "[]");
  return evidence.find((entry) => entry.index === index)?.[targetKey] || null;
}

async function getDeskArtifactTarget(scene, index) {
  await expect
    .poll(async () => {
      await requestDeskEvidence(scene);
      const evidence = JSON.parse((await scene.getAttribute("data-artifact-screen-bounds")) || "[]");
      return Boolean(evidence.find((entry) => entry.index === index)?.objectPoint);
    })
    .toBe(true);
  const evidence = JSON.parse((await scene.getAttribute("data-artifact-screen-bounds")) || "[]");
  return evidence.find((entry) => entry.index === index)?.objectPoint || null;
}

async function clickDeskAlbumTarget(page, scene, index, targetKey) {
  const point = await getDeskAlbumTarget(scene, index, targetKey);
  await clickDeskCanvasAt(page, point.x, point.y);
}

async function dragDeskAlbumFromRack(page, scene, index) {
  const point = await getDeskAlbumTarget(scene, index, "rackPoint");
  const startX = point.x;
  const startY = point.y;
  await dragDeskCanvasAt(page, startX, startY, Math.max(0.08, startX - 0.16), Math.min(0.88, startY + 0.27));
}

async function dragDeskCanvasAt(page, fromXRatio, fromYRatio, toXRatio, toYRatio) {
  const canvas = page.locator(".home-desk-corner-canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const startX = box.x + box.width * fromXRatio;
  const startY = box.y + box.height * fromYRatio;
  const endX = box.x + box.width * toXRatio;
  const endY = box.y + box.height * toYRatio;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move((startX + endX) / 2, (startY + endY) / 2, { steps: 8 });
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.mouse.up();
}

async function dropRecordCardsUntil(page, expectedCount) {
  const cards = page.locator("[data-home-record-card]");

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if ((await cards.count()) >= expectedCount) break;
    await shakeCurrentRecord(page);
    await page.waitForTimeout(900);
  }

  await expect(cards).toHaveCount(expectedCount);
}

async function getContentReadingAidState(page, protectedSelectors) {
  return page.evaluate((selectors) => {
    const rectFor = (element) => {
      if (!element) return null;

      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const intersects = (a, b) =>
      Boolean(
        a &&
        b &&
        a.width > 0 &&
        a.height > 0 &&
        b.width > 0 &&
        b.height > 0 &&
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top
      );
    const isDisplayed = (element) => {
      if (!element) return false;

      const style = window.getComputedStyle(element);
      const rect = rectFor(element);
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const desktop = document.querySelector(".section-reading-aid-desktop");
    const mobile = document.querySelector(".section-reading-aid-mobile");
    const desktopStyle = desktop ? window.getComputedStyle(desktop) : null;
    const desktopRect = rectFor(desktop);
    const protectedRects = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)).map(rectFor)).filter(Boolean);
    const desktopVisible = isDisplayed(desktop) && desktopStyle.pointerEvents !== "none" && Number.parseFloat(desktopStyle.opacity || "0") > 0.5;

    return {
      desktopDisplay: desktopStyle?.display || null,
      desktopOpacity: desktopStyle?.opacity || null,
      desktopVisible,
      intersectsProtected: desktopVisible && protectedRects.some((protectedRect) => intersects(desktopRect, protectedRect)),
      mobileDisplay: mobile ? window.getComputedStyle(mobile).display : null,
      mobileUsable: isDisplayed(mobile),
    };
  }, protectedSelectors);
}

async function scrollFirstReadableHeadingIntoRailZone(page) {
  await page.evaluate(() => {
    const heading = document.querySelector("#markdown-content h2, article h2");
    if (!heading) return;

    const targetTop = heading.getBoundingClientRect().top + window.scrollY - 150;
    window.scrollTo(0, Math.max(0, targetTop));
  });
  await page.waitForTimeout(500);
}

function visualRoute(path) {
  const visualBase = getPublicBaseURL();
  const normalizedBase = visualBase.endsWith("/") ? visualBase : `${visualBase}/`;
  return new URL(path, normalizedBase).toString();
}

const personalDailyActivityFixture = (() => {
  const points = [];
  const start = Date.UTC(2017, 7, 31);
  const end = Date.UTC(2026, 6, 31);
  for (let stamp = start, index = 0; stamp <= end; stamp += 86_400_000, index += 1) {
    const active = index % 9 === 0 || index % 17 === 0;
    const authored = active ? (index % 13) + 1 : 0;
    points.push({
      date: new Date(stamp).toISOString().slice(0, 10),
      personal: {
        commits: active ? authored + (index % 3) : 0,
        authored_commits: authored,
        additions: active ? (index % 31) * 140 + 20 : 0,
        deletions: active ? (index % 23) * 90 + 10 : 0,
      },
    });
  }
  Object.assign(points.at(-1).personal, {
    commits: 7,
    authored_commits: 5,
    additions: 321,
    deletions: 45,
  });
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

const personalCodexUsageFixture = {
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
      starts_on: "2026-07-29",
      complete_through: "2026-07-30",
      before_start: "unobserved",
      completeness: "rolling_window_partial",
      prior_unallocated_tokens: 100000000,
      prior_unallocated_by_agent: { codex: 100000000, claude: 0 },
    },
    points: [
      { date: "2026-07-29", tokens: 100000000, agent_tokens: { codex: 75000000, claude: 25000000 } },
      { date: "2026-07-30", tokens: 200000000, agent_tokens: { codex: 150000000, claude: 50000000 } },
    ],
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

const personalCodexFallbackFixture = {
  ...personalCodexUsageFixture,
  schema: 6,
  combined_lifetime: {
    ...personalCodexUsageFixture.combined_lifetime,
    source_count: 2,
  },
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

async function gotoPersonalBuildRhythm(
  page,
  { activity = personalDailyActivityFixture, codexPayload = personalCodexUsageFixture, codexHandler = null, waitUntil = "networkidle" } = {}
) {
  const routeUrl = visualRoute("github-activity/");
  const response = await page.request.get(routeUrl);
  expect(response.ok()).toBe(true);
  const original = await response.text();
  const dataPattern = /<script id="code-activity-data" type="application\/json">[\s\S]*?<\/script>/;
  expect(original).toMatch(dataPattern);
  const body = original.replace(dataPattern, `<script id="code-activity-data" type="application/json">${JSON.stringify(activity)}</script>`);

  await page.route(routeUrl, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body,
    })
  );
  if (codexHandler) {
    await page.route("**/assets/data/codex-profile-usage.json", codexHandler);
  } else if (codexPayload) {
    await page.route("**/assets/data/codex-profile-usage.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(codexPayload),
      })
    );
  }
  await page.goto(routeUrl, { waitUntil });
}

test("code history fails closed while independent agent and site-token evidence remain", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await gotoPersonalBuildRhythm(page, {
    activity: {},
    codexPayload: null,
  });

  const activity = page.locator("[data-github-activity]");
  const tokenRhythm = page.locator("[data-token-rhythm]");
  await expect(activity).toHaveAttribute("data-state", "unavailable", { timeout: 30_000 });
  await expect(page.locator("[data-personal-code-unavailable]")).toHaveText("Code history is being rebuilt.");
  await expect(page.locator("[data-github-scope]")).toHaveText("CODE ACTIVITY");
  await expect(page.locator("[data-personal-daily-copy]").first()).toBeHidden();
  await expect(page.locator(".github-activity-readout")).toBeHidden();
  await expect(page.locator("[data-codex-usage]")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("[data-codex-usage]")).toBeVisible();
  await expect(page.locator("[data-codex-usage]")).toContainText("total tokens");
  await expect(tokenRhythm).toHaveAttribute("data-state", "ready");
  await expect(tokenRhythm.locator(".github-activity-token-cumulative-line")).toHaveCount(1);
  await expect(tokenRhythm.locator(".github-activity-token-delta-line")).toHaveCount(1);
  expect(runtimeErrors).toEqual([]);
});

test("delayed two-source Codex fallback keeps the currently selected chart scale", async ({ page }, testInfo) => {
  testInfo.setTimeout(300_000);
  await preparePage(page, "light");
  let releaseSnapshot;
  const snapshotGate = new Promise((resolve) => {
    releaseSnapshot = resolve;
  });
  await gotoPersonalBuildRhythm(page, {
    waitUntil: "domcontentloaded",
    codexHandler: async (route) => {
      await snapshotGate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(personalCodexFallbackFixture),
      });
    },
  });

  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "ready");
  const literalButton = page.getByRole("button", { name: "Literal", exact: true });
  await literalButton.click();
  releaseSnapshot();

  const codexSnapshot = page.locator("[data-codex-usage]");
  await expect(codexSnapshot).toHaveAttribute("data-state", "ready");
  await expect(literalButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#github-activity-chart")).toContainText("LINEAR");
  await expect(codexSnapshot.locator("[data-codex-lifetime]")).toHaveText("0.4B");
  await expect(codexSnapshot.locator("[data-codex-lifetime]")).toHaveAttribute("data-format", "readable");
  await expect(codexSnapshot.locator("[data-codex-status]")).toContainText("Daily history is complete through");
});

test("daily personal code and completed personal agent usage remain separate and exactly inspectable", async ({ page }, testInfo) => {
  testInfo.setTimeout(300_000);
  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await gotoPersonalBuildRhythm(page);
  await stabilizeVisuals(page);

  const activity = page.locator("[data-github-activity]");
  const codexTrend = page.locator("[data-codex-usage]");
  const chart = page.locator("#github-activity-chart");
  const rangeSummary = page.locator("#github-activity-range-summary");

  await expect(chart.locator(".github-activity-agent-rail-codex-area")).toHaveCount(1);
  await expect(chart.locator(".github-activity-agent-rail-claude-area")).toHaveCount(1);
  await expect(chart.locator(".github-activity-agent-rail-line")).toHaveCount(1);
  await expect(chart).toContainText("SINCE JUL 2026");
  await expect(page.locator("[data-agent-family-summary]")).toContainText("Codex area 325M · 81.25%");
  await expect(page.locator("[data-agent-family-summary]")).toContainText("Claude area 75M · 18.75%");
  await expect(page.locator("[data-agent-codex-value]")).toHaveAttribute("aria-label", "325,000,000 Codex tokens, 81.25 percent");
  await expect(page.locator("[data-agent-claude-value]")).toHaveAttribute("aria-label", "75,000,000 Claude tokens, 18.75 percent");

  if (testInfo.project.name === "mobile") {
    const mobileEvidence = await page.evaluate(() => {
      const activityRoot = document.querySelector("[data-github-activity]");
      const chartRoot = document.getElementById("github-activity-chart");
      const text = (selector) => document.querySelector(selector)?.textContent?.trim() || "";
      const count = (selector) => document.querySelectorAll(selector).length;
      return {
        activityState: activityRoot?.getAttribute("data-state"),
        codexState: document.querySelector("[data-codex-usage]")?.getAttribute("data-state"),
        eyebrow: text(".github-activity-eyebrow"),
        scope: text("[data-github-scope]"),
        codeDataCount: count("#code-activity-data"),
        retiredDataCount: count("#personal-code-activity-data, #github-activity-data"),
        commitLineCount: count("#github-activity-chart .github-activity-commit-line"),
        additionLineCount: count("#github-activity-chart .github-activity-add-line"),
        deletionLineCount: count("#github-activity-chart .github-activity-remove-line"),
        snapshotLineCount: count("#github-activity-chart .github-activity-lifetime-snapshot-line"),
        agentRailLineCount: count("#github-activity-chart .github-activity-agent-rail-line"),
        selectedDate: text("#github-activity-selected-date"),
        selectedCommits: text("#github-activity-selected-commits"),
        selectedAdditions: text("#github-activity-selected-additions"),
        selectedDeletions: text("#github-activity-selected-deletions"),
        selectedTokens: text("#github-activity-selected-tokens"),
        inspectorValue: chartRoot?.querySelector(".github-activity-inspector")?.getAttribute("aria-valuetext"),
        hasDailyCommitHeading: chartRoot?.textContent?.includes("COMMITS / DAY · LOG1P"),
        hasDailyLineHeading: chartRoot?.textContent?.includes("LINES / DAY · SYMLOG"),
        hasForbiddenCopy: /Autodesk|employer|work account|code activity bridge|Combined lifetime code activity/i.test(
          activityRoot?.textContent || ""
        ),
      };
    });
    expect(mobileEvidence).toEqual({
      activityState: "ready",
      codexState: "ready",
      eyebrow: "BUILDING, DAY BY DAY",
      scope: "3 YEARS · DAILY",
      codeDataCount: 1,
      retiredDataCount: 0,
      commitLineCount: 1,
      additionLineCount: 1,
      deletionLineCount: 1,
      snapshotLineCount: 0,
      agentRailLineCount: 1,
      selectedDate: "Jul 31, 2026",
      selectedCommits: "7 total commits · 5 authored commits",
      selectedAdditions: "+321 added",
      selectedDeletions: "−45 removed",
      selectedTokens: "Token usage · unobserved or awaiting a completed day",
      inspectorValue: "2026-07-31, 7 total commits, 5 authored commits, +321 added, −45 removed, token usage unobserved or awaiting a completed day",
      hasDailyCommitHeading: true,
      hasDailyLineHeading: true,
      hasForbiddenCopy: false,
    });

    await chart.locator(".github-activity-inspector").press("ArrowLeft");
    const movedEvidence = await page.evaluate(() => ({
      date: document.getElementById("github-activity-selected-date")?.textContent?.trim(),
      tokens: document.getElementById("github-activity-selected-tokens")?.textContent?.trim(),
    }));
    expect(movedEvidence).toEqual({
      date: "Jul 30, 2026",
      tokens: "+200M tokens · Codex +150M · Claude +50M · 400M total",
    });
    expect(runtimeErrors).toEqual([]);
    return;
  }

  await expect(activity).toHaveAttribute("data-state", "ready");
  await expect(codexTrend).toHaveAttribute("data-state", "ready");
  await expect(page.locator(".github-activity-eyebrow")).toHaveText("BUILDING, DAY BY DAY");
  await expect(page.locator("[data-github-scope]")).toHaveText("3 YEARS · DAILY");
  await expect(page.locator("#code-activity-data")).toHaveCount(1);
  await expect(page.locator("#personal-code-activity-data, #github-activity-data")).toHaveCount(0);
  await expect(chart.locator(".github-activity-commit-line")).toHaveCount(1);
  await expect(chart.locator(".github-activity-add-line")).toHaveCount(1);
  await expect(chart.locator(".github-activity-remove-line")).toHaveCount(1);
  await expect(chart.locator(".github-activity-lifetime-snapshot-line")).toHaveCount(0);
  await expect(chart.locator(".github-activity-agent-rail-line")).toHaveCount(1);
  await expect(page.locator("#github-activity-selected-date")).toHaveText("Jul 31, 2026");
  await expect(page.locator("#github-activity-selected-commits")).toHaveText("7 total commits · 5 authored commits");
  await expect(page.locator("#github-activity-selected-additions")).toHaveText("+321 added");
  await expect(page.locator("#github-activity-selected-deletions")).toHaveText("−45 removed");
  await expect(page.locator("#github-activity-selected-tokens")).toContainText("unobserved or awaiting a completed day");
  await expect(activity).not.toContainText(/Autodesk|employer|work account|code activity bridge|Combined lifetime code activity/i);

  const compact = (page.viewportSize()?.width ?? 0) < 620;
  await expect(chart.getByText(compact ? "COMMITS / DAY · LOG1P" : "COMMITS PER DAY · LOG1P", { exact: true })).toBeVisible();
  await expect(
    chart.getByText(compact ? "LINES / DAY · SYMLOG" : "LINES CHANGED PER DAY · SYMLOG", {
      exact: true,
    })
  ).toBeVisible();

  await page.getByRole("button", { name: "Literal", exact: true }).click();
  await expect(chart.getByText(compact ? "COMMITS / DAY · LINEAR" : "COMMITS PER DAY · LINEAR", { exact: true })).toBeVisible();
  await expect(chart.getByText(compact ? "LINES / DAY · LINEAR" : "LINES CHANGED PER DAY · LINEAR", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "1 year", exact: true }).click();
  await expect(page.locator("[data-github-scope]")).toHaveText("1 YEAR · DAILY");
  const inspector = chart.locator(".github-activity-inspector");
  await inspector.focus();
  await expect(inspector).toHaveAttribute(
    "aria-valuetext",
    /^2026-07-31, 7 total commits, 5 authored commits, \+321 added, −45 removed, token usage unobserved or awaiting a completed day$/
  );
  await inspector.press("ArrowLeft");
  await expect(page.locator("#github-activity-selected-date")).toHaveText("Jul 30, 2026");
  await expect(page.locator("#github-activity-selected-tokens")).toContainText("+200M tokens");
  await expect(page.locator("#github-activity-selected-tokens")).toContainText("Codex +150M");
  await expect(page.locator("#github-activity-selected-tokens")).toContainText("Claude +50M");
  await expect(page.locator("#github-activity-selected-tokens")).toHaveAttribute(
    "aria-label",
    "200,000,000 tokens on the matching UTC date label: 150,000,000 Codex and 50,000,000 Claude; 400,000,000 cumulative tokens."
  );
  await expect(inspector).toHaveAttribute(
    "aria-valuetext",
    /200,000,000 tokens on the matching UTC date label, 150,000,000 Codex and 50,000,000 Claude, 400,000,000 cumulative tokens/
  );
  await inspector.press("Shift+ArrowLeft");
  await expect(page.locator(".github-activity-selection-band")).toHaveAttribute("visibility", "visible");
  await expect(rangeSummary).toContainText(/^Selected 2 date labels/);
  await inspector.press("Escape");
  await expect(page.locator(".github-activity-selection-band")).toHaveAttribute("visibility", "hidden");

  await page.getByText("How this view works", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Separate scales" })).toBeVisible();
  const firstRowCells = page.locator("#github-activity-table-body tr").first().locator("th, td");
  await expect(firstRowCells).toHaveCount(10);
  await expect(page.locator("#github-activity-table-caption")).toContainText("source calendar label");
  expect(await page.locator("#github-activity-table-body tr").count()).toBeGreaterThan(300);
  expect(runtimeErrors).toEqual([]);
});

test("GitHub line-change labels meet contrast in every light theme", async ({ page }) => {
  await preparePage(page, "light");
  await gotoPersonalBuildRhythm(page);
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "ready");

  const themes = await page.evaluate(async () => {
    const parseColor = (value) => {
      const match = value.match(/[\d.]+/g);
      if (!match) return [];
      const channels = match.slice(0, 3).map(Number);
      return value.includes("color(srgb") ? channels.map((channel) => channel * 255) : channels;
    };
    const linear = (channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (color) => 0.2126 * linear(color[0]) + 0.7152 * linear(color[1]) + 0.0722 * linear(color[2]);
    const contrast = (foreground, background) => {
      const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (lighter + 0.05) / (darker + 0.05);
    };
    const resolveColor = (value) => {
      const probe = document.createElement("span");
      probe.style.color = value;
      document.body.append(probe);
      const resolved = parseColor(getComputedStyle(probe).color);
      probe.remove();
      return resolved;
    };

    const results = [];
    for (const mode of ["morning", "noon", "afternoon"]) {
      document.documentElement.setAttribute("data-theme", "light");
      document.documentElement.setAttribute("data-theme-mode", mode);
      document.documentElement.setAttribute("data-theme-setting", mode);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const activity = document.querySelector("[data-github-activity]");
      const background = parseColor(getComputedStyle(document.querySelector(".github-activity-readout")).backgroundColor);
      const addedText = parseColor(getComputedStyle(document.getElementById("github-activity-selected-additions")).color);
      const removedText = parseColor(getComputedStyle(document.getElementById("github-activity-selected-deletions")).color);
      const addedStroke = parseColor(getComputedStyle(document.querySelector(".github-activity-add-line")).stroke);
      const removedStroke = parseColor(getComputedStyle(document.querySelector(".github-activity-remove-line")).stroke);
      const rawAdded = resolveColor(getComputedStyle(activity).getPropertyValue("--global-sky-strong").trim());
      const rawRemoved = resolveColor(getComputedStyle(activity).getPropertyValue("--global-mint-strong").trim());
      results.push({
        mode,
        addedContrast: contrast(addedText, background),
        removedContrast: contrast(removedText, background),
        addedStroke,
        removedStroke,
        rawAdded,
        rawRemoved,
        addedText,
        removedText,
      });
    }
    return results;
  });

  themes.forEach((theme) => {
    expect(theme.addedContrast, `${theme.mode} added-text contrast`).toBeGreaterThanOrEqual(4.5);
    expect(theme.removedContrast, `${theme.mode} removed-text contrast`).toBeGreaterThanOrEqual(4.5);
    expect(theme.addedStroke, `${theme.mode} added graph keeps the raw stroke`).toEqual(theme.rawAdded);
    expect(theme.removedStroke, `${theme.mode} removed graph keeps the raw stroke`).toEqual(theme.rawRemoved);
    expect(theme.addedText).not.toEqual(theme.addedStroke);
    expect(theme.removedText).not.toEqual(theme.removedStroke);
  });
});

test("home agentic ledger keeps price replay separate from the permanent Build Rhythm route", async ({ page }, testInfo) => {
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/al-folio/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const buildRhythmRoute = page.locator(".home-build-rhythm-route");
  await buildRhythmRoute.scrollIntoViewIfNeeded();
  await expect(buildRhythmRoute).toBeVisible();
  await expect(buildRhythmRoute).toHaveAttribute("href", "/al-folio/github-activity/");
  await expect(buildRhythmRoute).toHaveAccessibleName("Explore Build Rhythm: commits, lines, and observed token history.");
  await expect(buildRhythmRoute).toHaveText("Build Rhythm · commits · lines · observed token history · →");
  await expect(buildRhythmRoute).not.toContainText(/\$|public API|cost|refreshed|observed \w{3} \d+|\d+ GitHub commits/i);
  await expect(page.locator(".home-agentic-heartbeat")).toHaveCount(0);
  const tally = page.locator(".home-agentic-tally");
  await expect(tally).toHaveAttribute(
    "aria-label",
    "Site revamp ledger: estimated Codex tokens and agent-hours, exact Git commit count, and estimated energy-equivalence"
  );
  await expect(tally.locator(".home-agentic-stat")).toHaveCount(4);
  await expect(tally).toContainText("site-build tokens");
  await expect(tally).toContainText("agent-hours");
  await expect(tally).toContainText("site commits");
  await expect(tally).toContainText("est. kWh");
  await expect(tally).not.toContainText(/trees?/i);
  await expect(tally.locator("#home-agentic-tooltip")).toContainText("The commit count is exact from this repository's Git history.");

  const costButton = tally.locator(".home-agentic-info-cost");
  const costTooltip = tally.locator("#home-agentic-cost-tooltip");
  const costArtwork = costTooltip.locator("img");
  await expect(costButton).toHaveCount(1);
  await expect(costButton).toHaveAccessibleName("Show the site-build API-rate comparison");
  await expect(costButton).toHaveAttribute("data-affordance", "cost-estimate");
  await expect(costButton.locator("svg.home-agentic-cost-mark")).toHaveCount(1);
  await expect(costButton).toHaveText("");
  await expect(costTooltip).toContainText(/Burnt ~\$[\d.]+K of Sam's money\*/);
  await expect(costTooltip).toContainText("*Site-build tokens at public API rates—not a real bill.");
  await expect(costTooltip).not.toContainText("imaginary API invoice");
  await expect(costTooltip).not.toContainText("retained site-build logs");
  await expect(costTooltip).not.toContainText("cache-write tokens");
  await expect(costArtwork).toHaveAttribute("alt", "");
  await costArtwork.evaluate(async (image) => {
    if (!image.complete) {
      await new Promise((resolve) => image.addEventListener("load", resolve, { once: true }));
    }
    await image.decode();
  });
  expect(await costArtwork.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);

  if (testInfo.project.name === "mobile") {
    await costButton.tap();
  } else {
    await costButton.hover();
  }
  await expect(costTooltip).toBeVisible();
  const tooltipOverflow = await costTooltip.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      horizontal: node.scrollWidth - node.clientWidth,
      vertical: node.scrollHeight - node.clientHeight,
    };
  });
  expect(tooltipOverflow.horizontal).toBeLessThanOrEqual(1);
  expect(tooltipOverflow.vertical).toBeLessThanOrEqual(1);
  let tooltipFrame = await costTooltip.boundingBox();
  let viewport = page.viewportSize();
  expect(tooltipFrame).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(tooltipFrame.x).toBeGreaterThanOrEqual(-1);
  expect(tooltipFrame.x + tooltipFrame.width).toBeLessThanOrEqual(viewport.width + 1);

  await costButton.focus();
  await expect(costTooltip).toBeVisible();
  await expect(costButton).toBeFocused();

  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 683, height: 900 });
    await costButton.scrollIntoViewIfNeeded();
    await costButton.focus();
    tooltipFrame = await costTooltip.boundingBox();
    viewport = page.viewportSize();
    expect(tooltipFrame).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(tooltipFrame.x).toBeGreaterThanOrEqual(-1);
    expect(tooltipFrame.x + tooltipFrame.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(tooltipFrame.y).toBeGreaterThanOrEqual(-1);
    expect(tooltipFrame.y + tooltipFrame.height).toBeLessThanOrEqual(viewport.height + 1);
  }

  const routeFrame = await buildRhythmRoute.evaluate((node) => {
    const style = getComputedStyle(node);
    const arrowStyle = getComputedStyle(node.querySelector(".home-build-rhythm-route-arrow"));
    return {
      borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      minHeight: style.minHeight,
      routeTransitionDuration: style.transitionDuration,
      arrowTransitionDuration: arrowStyle.transitionDuration,
      arrowTransform: arrowStyle.transform,
    };
  });
  expect(routeFrame.borderWidths).toEqual(["0px", "0px", "0px", "0px"]);
  expect(routeFrame.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(routeFrame.boxShadow).toBe("none");
  expect(Number.parseFloat(routeFrame.minHeight)).toBeGreaterThanOrEqual(44);
  expect(routeFrame.routeTransitionDuration).toBe("0s");
  expect(routeFrame.arrowTransitionDuration).toBe("0s");
  expect(routeFrame.arrowTransform).toBe("none");
});

test("publication abstracts remain available below the human citation context", async ({ page }) => {
  await preparePage(page, "light");
  await page.goto("/al-folio/publications/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const firstGuide = page.locator("[data-publication-why-cite]").first();
  await firstGuide.locator("summary").click();
  const contextLink = firstGuide.getByRole("link", { name: "Read the full evidence and citation context" });
  await expect(contextLink).toBeVisible();
  await contextLink.click();

  await expect(page.locator("[data-publication-context-page]")).toBeVisible();
  await expect(page.locator(".publication-context-trust")).toContainText("I checked this against the paper on");
  await expect(page.locator(".publication-context-details")).toBeVisible();
  await expect(page.locator(".publication-context-abstract")).toContainText("The authors' summary");
  await expect(page.getByRole("link", { name: "Markdown", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "BibTeX", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "RIS", exact: true })).toBeVisible();
});

test("publication why-cite guides are shared and keyboard-native", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.goto("/al-folio/publications/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const guides = page.locator("[data-publication-why-cite]");
  await expect(guides).toHaveCount(5);

  const firstGuide = guides.first();
  const summary = firstGuide.locator("summary");
  await expect(firstGuide).not.toHaveAttribute("open", "");
  await summary.focus();
  await summary.press("Enter");
  await expect(firstGuide).toHaveAttribute("open", "");
  await expect(firstGuide.locator(".publication-why-cite-body")).toBeVisible();
  await expect(firstGuide.getByRole("link", { name: "Read the full evidence and citation context" })).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 767) {
    await expect(page.locator("#back-to-top")).toBeHidden();
  }
  await summary.press("Space");
  await expect(firstGuide).not.toHaveAttribute("open", "");

  await page.goto("/al-folio/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);
  await expect(page.locator("[data-publication-why-cite]")).toHaveCount(4);
  expect(runtimeErrors).toEqual([]);
});

test("AI profile is server-rendered and can copy canonical Markdown", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedMarkdown = text;
        },
      },
    });
  });
  await preparePage(page, "light");
  await page.goto("/al-folio/ai/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  await expect(page.locator("[data-publication-key]")).toHaveCount(5);
  await expect(page.locator('.site-format-link[aria-current="page"]')).toHaveText("AI");
  await expect(page.getByRole("link", { name: "Concise index .txt" })).toBeVisible();

  const copyButton = page.locator("[data-ai-copy]");
  await expect(copyButton).toBeVisible();
  await expect(copyButton).toHaveAccessibleName("Copy full Markdown");
  await copyButton.click();
  await expect(copyButton).toHaveAttribute("data-copy-state", "copied");
  await expect(copyButton).toHaveAccessibleName("Copied Markdown");
  await expect(page.locator("[data-ai-copy-status]")).toHaveText("Copied the full profile as Markdown.");
  const copiedMarkdown = await page.evaluate(() => window.__copiedMarkdown);
  expect(copiedMarkdown).toContain("# Sirui Tao");
  expect(copiedMarkdown).toContain("## Publications and citation guidance");

  await page.getByRole("link", { name: "Human-readable website" }).click();
  await expect(page).toHaveURL(/\/al-folio\/$/);
  await expect(page.locator('.site-format-link[aria-current="page"]')).toHaveText("Human");

  await page.getByRole("link", { name: "AI-readable research profile" }).click();
  await expect(page).toHaveURL(/\/al-folio\/ai\/$/);
  await expect(page.locator('.site-format-link[aria-current="page"]')).toHaveText("AI");
  expect(runtimeErrors).toEqual([]);
});

test("publication popover works without bootstrap compat runtime", async ({ page }) => {
  await preparePage(page, "light");
  await page.goto("/al-folio/publications/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const popoverTrigger = page.locator('[data-toggle="popover"]').first();
  test.skip((await popoverTrigger.count()) === 0, "no popover trigger found in fixture data");

  await popoverTrigger.hover();
  await expect(page.locator(".af-popover")).toBeVisible();
});

test("mobile navbar can expand/collapse", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only navigation behavior");

  await preparePage(page, "light");
  await page.goto("/al-folio/", { waitUntil: "networkidle" });

  const toggle = page.locator(".navbar-toggler").first();
  await expect(toggle).toBeVisible();

  const nav = page.locator("#navbarNav");
  const search = page.locator("#search-toggle");
  const themeToggle = page.locator("#theme-toggle");

  await expect(nav).not.toHaveClass(/show/);
  await expect(nav).toBeHidden();
  await expect(search).toBeVisible();
  await expect(themeToggle).toBeVisible();

  const searchCursor = await search.evaluate((el) => window.getComputedStyle(el).cursor);
  const themeCursor = await themeToggle.evaluate((el) => window.getComputedStyle(el).cursor);
  expect(searchCursor).toBe("pointer");
  expect(themeCursor).toBe("pointer");

  await themeToggle.click();
  await expect(page.locator("#theme-menu")).toBeVisible();
  await expect(nav).not.toHaveClass(/show/);
  await themeToggle.click();

  await toggle.click();
  await expect(nav).toHaveClass(/show/);
  await expect(nav).toBeVisible();
  await expect(page.locator("#navbarNav .navbar-menu-list .nav-link").first()).toBeVisible();

  await toggle.click();
  await expect(nav).not.toHaveClass(/show/);
  await expect(nav).toBeHidden();
});

test("repositories page renders external stat cards with deterministic fixtures", async ({ page }) => {
  await preparePage(page, "light");
  await openOptionalStarterRoute(page, "/al-folio/repositories/");

  const repoImages = page.locator('img[src*="github-readme-stats"], img[src*="github-profile-trophy"]');
  await expect(repoImages.first()).toBeVisible();

  const renderedCount = await repoImages.evaluateAll((images) => images.filter((img) => img.complete && img.naturalWidth > 0).length);
  expect(renderedCount).toBeGreaterThan(0);
});

test("blog pagination uses the site-native styling contract", async ({ page }) => {
  await preparePage(page, "light");
  await page.goto("/al-folio/blog/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const pagination = page.locator(".pagination");
  await expect(pagination.first()).toBeVisible();

  const pageLink = pagination.locator(".page-item.active .page-link").first();
  await expect(pageLink).toBeVisible();

  const styles = await pageLink.evaluate((node) => {
    const computed = window.getComputedStyle(node);
    return {
      borderTopWidth: computed.borderTopWidth,
      backgroundColor: computed.backgroundColor,
      paddingTop: computed.paddingTop,
      paddingLeft: computed.paddingLeft,
    };
  });

  expect(styles.borderTopWidth).not.toBe("0px");
  expect(styles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.paddingTop).not.toBe("0px");
  expect(styles.paddingLeft).not.toBe("0px");
});

test("content reading aid avoids headers and uses inline fallback on medium desktops", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "desktop viewport contract");

  const routes = [
    {
      path: "blog/2026/research-skills-starter-pack/",
      protectedSelectors: [".blog-post > .post-header"],
    },
    {
      path: "projects/designweaver/",
      protectedSelectors: [".project-case-hero"],
    },
    {
      path: "projects/website-revamp/",
      protectedSelectors: [".project-case-hero"],
    },
  ];

  await preparePage(page, "light");

  for (const route of routes) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(visualRoute(route.path), { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".section-reading-aid-mobile", { state: "attached" });
    await stabilizeVisuals(page);
    await page.waitForTimeout(500);

    const topState = await getContentReadingAidState(page, route.protectedSelectors);
    expect(topState.desktopVisible && topState.intersectsProtected, `${route.path} rail overlaps protected header at top`).toBe(false);

    await scrollFirstReadableHeadingIntoRailZone(page);
    await expect
      .poll(async () => (await getContentReadingAidState(page, route.protectedSelectors)).desktopVisible, {
        message: `${route.path} rail becomes visible after entering body sections`,
        timeout: 5000,
      })
      .toBe(true);
    const sectionState = await getContentReadingAidState(page, route.protectedSelectors);
    expect(sectionState.intersectsProtected, `${route.path} rail overlaps protected header near first section`).toBe(false);

    await page.setViewportSize({ width: 1366, height: 900 });
    await page.waitForTimeout(300);

    const mediumState = await getContentReadingAidState(page, route.protectedSelectors);
    expect(mediumState.desktopDisplay, `${route.path} fixed rail should be hidden on medium desktop`).toBe("none");
    expect(mediumState.mobileUsable, `${route.path} inline helper should remain available on medium desktop`).toBe(true);
  }
});

test("explicit reading-aid navigation marks one destination while ordinary scroll stays passive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "desktop reading-aid contract");

  await preparePage(page, "light");
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(visualRoute("projects/designweaver/"), { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".section-reading-aid-mobile-inline", { state: "attached" });
  await stabilizeVisuals(page);

  const inlineAid = page.locator(".section-reading-aid-mobile-inline");
  const toggle = inlineAid.locator(".section-reading-aid-mobile-toggle");
  await toggle.click();
  const links = inlineAid.locator("a[data-section-id]");
  const firstLink = links.first();
  const firstId = await firstLink.getAttribute("data-section-id");
  await firstLink.click();

  const firstTarget = page.locator(`#${firstId}`);
  await expect(firstTarget).toBeFocused();
  await expect(firstTarget).toHaveClass(/site-anchor-arrival/);

  await toggle.click();
  const secondLink = links.nth(1);
  const secondId = await secondLink.getAttribute("data-section-id");
  await secondLink.click();
  const secondTarget = page.locator(`#${secondId}`);
  await expect(firstTarget).not.toHaveClass(/site-anchor-arrival/);
  await expect(secondTarget).toBeFocused();
  await expect(secondTarget).toHaveClass(/site-anchor-arrival/);
  await expect(secondTarget).not.toHaveClass(/site-anchor-arrival/, { timeout: 2500 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".section-reading-aid-mobile-inline", { state: "attached" });
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 1200, behavior: "auto" });
  });
  await page.waitForTimeout(250);
  await expect(page.locator(".site-anchor-arrival")).toHaveCount(0);
});

test("navbar menu stays right-aligned on desktop pages", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "desktop-only alignment contract");

  await preparePage(page, "light");
  await page.goto("/al-folio/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);
  await expect(page.locator("#navbarNav .navbar-menu-list .nav-link").first()).toBeVisible();

  const alignment = await page.evaluate(() => {
    const container = document.querySelector("#navbar .container");
    const menu = document.querySelector("#navbarNav .navbar-menu-list");
    const actions = document.querySelector("#navbar .navbar-actions");
    if (!container || !menu || !actions) {
      return null;
    }
    const containerBox = container.getBoundingClientRect();
    const menuBox = menu.getBoundingClientRect();
    const actionsBox = actions.getBoundingClientRect();
    return {
      containerRight: containerBox.right,
      menuRight: menuBox.right,
      actionsLeft: actionsBox.left,
      actionsRight: actionsBox.right,
    };
  });

  expect(alignment).not.toBeNull();
  expect(Math.abs(alignment.actionsRight - alignment.containerRight)).toBeLessThanOrEqual(24);
  expect(alignment.menuRight).toBeLessThanOrEqual(alignment.actionsLeft + 12);
});

test("home artifact cards hover independently", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "hover-specific assertion is desktop-only");

  await preparePage(page, "light");
  await page.goto("/al-folio/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const secondary = page.locator(".home-artifact-card-2");
  const primary = page.locator(".home-artifact-card-1");
  await expect(secondary).toBeVisible();
  await expect(primary).toBeVisible();

  const readCardStyles = async (card) =>
    card.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        borderColor: computed.borderColor,
        boxShadow: computed.boxShadow,
      };
    });

  const secondaryRest = await readCardStyles(secondary);
  const primaryRest = await readCardStyles(primary);

  await secondary.hover();
  await page.waitForTimeout(320);
  const secondaryHovered = await readCardStyles(secondary);
  const primaryWhileSecondaryHovered = await readCardStyles(primary);

  expect(secondaryHovered.borderColor).not.toBe(secondaryRest.borderColor);
  expect(secondaryHovered.boxShadow).not.toBe(secondaryRest.boxShadow);
  expect(primaryWhileSecondaryHovered.borderColor).toBe(primaryRest.borderColor);
  expect(primaryWhileSecondaryHovered.boxShadow).toBe(primaryRest.boxShadow);

  await primary.hover();
  await page.waitForTimeout(320);
  const primaryHovered = await readCardStyles(primary);
  const secondaryWhilePrimaryHovered = await readCardStyles(secondary);

  expect(primaryHovered.borderColor).not.toBe(primaryRest.borderColor);
  expect(primaryHovered.boxShadow).not.toBe(primaryRest.boxShadow);
  expect(secondaryWhilePrimaryHovered.borderColor).toBe(secondaryRest.borderColor);
  expect(secondaryWhilePrimaryHovered.boxShadow).toBe(secondaryRest.boxShadow);
});

test("home keyboard record playback survives shake suppression", async ({ page }) => {
  await preparePage(page, "dark");
  const homeRoute = usesExternalVisualServer() && process.env.VISUAL_BASE_URL ? "/" : "/al-folio/";
  await page.goto(homeRoute, { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const spinButton = page.locator("[data-home-record-play]");
  await expect(spinButton).toHaveAttribute("aria-pressed", "false");

  await shakeCurrentRecord(page);
  await spinButton.focus();
  await page.keyboard.press("Space");
  await expect(spinButton).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("Enter");
  await expect(spinButton).toHaveAttribute("aria-pressed", "false");
});

test("home portrait offers a keyboard-equivalent record-card discovery", async ({ page }) => {
  await preparePage(page, "dark");
  const homeRoute = usesExternalVisualServer() && process.env.VISUAL_BASE_URL ? "/" : "/al-folio/";
  await page.goto(homeRoute, { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const stage = page.locator("[data-home-artifact-stage]");
  const portrait = page.locator("#home-profile-image-container");
  const cards = page.locator("[data-home-record-card]");
  await expect(stage).toHaveAttribute("data-desk-mode", "2d");
  await expect(portrait).toHaveAttribute("aria-label", /press D to discover a record card/i);

  await portrait.focus();
  await page.keyboard.press("d");
  await expect(cards).toHaveCount(1);
  await expect(stage).toHaveAttribute("data-dropped-records", "0");

  await portrait.focus();
  await page.keyboard.press("D");
  await expect(cards).toHaveCount(2);
  await expect(stage).toHaveAttribute("data-dropped-records", "0,1");
});

test("home dropped meme record cards resolve into an inspectable 2D fan", async ({ page }) => {
  // WebKit mobile exercises four drops, four keyboard inspections, and the all-card replay;
  // keep the full journey rather than trimming coverage to the shared two-minute default.
  test.setTimeout(180000);
  await preparePage(page, "dark");
  const homeRoute = usesExternalVisualServer() && process.env.VISUAL_BASE_URL ? "/" : "/al-folio/";
  await page.goto(homeRoute, { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const stage = page.locator("[data-home-artifact-stage]");
  const cards = page.locator("[data-home-record-card]");
  await expect(stage).toHaveAttribute("data-desk-mode", "2d");

  await dropRecordCardsUntil(page, 1);
  await dropRecordCardsUntil(page, 2);
  await dropRecordCardsUntil(page, 3);
  await dropRecordCardsUntil(page, 4);
  await page.waitForTimeout(120);

  const fanGeometry = await cards.evaluateAll((cards) => {
    const pile = cards[0]?.closest(".home-record-card-pile")?.getBoundingClientRect();
    const rects = cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        area: rect.width * rect.height,
        laneY: card.getAttribute("data-card-lane-y"),
      };
    });
    let maxRatio = 0;

    for (let firstIndex = 0; firstIndex < rects.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < rects.length; secondIndex += 1) {
        const first = rects[firstIndex];
        const second = rects[secondIndex];
        const overlapWidth = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
        const overlapHeight = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
        const smallerArea = Math.max(1, Math.min(first.area, second.area));
        maxRatio = Math.max(maxRatio, (overlapWidth * overlapHeight) / smallerArea);
      }
    }

    return {
      maxRatio,
      pile: pile
        ? {
            left: pile.left,
            right: pile.right,
          }
        : null,
      rects,
    };
  });

  expect(fanGeometry.pile).not.toBeNull();
  expect(fanGeometry.maxRatio).toBeGreaterThan(0.35);
  // Google Fonts are intentionally stubbed in visual CI. Platform fallback
  // fonts can make one card taller without changing the four-lane fan; keep
  // a small cross-engine allowance while the lane and containment checks
  // below continue to prove that every card remains inspectable.
  expect(fanGeometry.maxRatio).toBeLessThan(0.92);
  expect(new Set(fanGeometry.rects.map((rect) => rect.laneY)).size).toBe(4);
  fanGeometry.rects.forEach((rect) => {
    expect(rect.left).toBeGreaterThanOrEqual(fanGeometry.pile.left - 2);
    expect(rect.right).toBeLessThanOrEqual(fanGeometry.pile.right + 2);
  });

  const cardShape = await cards.first().evaluate((card) => {
    const computed = window.getComputedStyle(card);
    return {
      columns: computed.gridTemplateColumns.split(" ").filter(Boolean).length,
      minHeight: Number.parseFloat(computed.minHeight),
      radius: Number.parseFloat(computed.borderTopLeftRadius),
    };
  });

  expect(cardShape.columns).toBeGreaterThanOrEqual(2);
  expect(cardShape.minHeight).toBeLessThan(150);
  expect(cardShape.radius).toBeGreaterThan(6);

  for (let cardIndex = 0; cardIndex < 4; cardIndex += 1) {
    const card = cards.nth(cardIndex);
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(card).toHaveClass(/is-open/);
    await expect(card).toHaveAttribute("aria-expanded", "true");
    await page.locator('[data-home-desk-mode="2d"]').click();
    await expect(card).not.toHaveClass(/is-open/);
  }

  await shakeCurrentRecord(page);
  await page.waitForTimeout(900);
  await expect(cards).toHaveCount(4);
  await expect(stage).toHaveAttribute("data-dropped-records", "0,1,2,3");

  const replayedOrder = await cards.evaluateAll((cardNodes) =>
    cardNodes
      .map((card) => ({
        index: card.getAttribute("data-record-index"),
        sequence: Number(card.getAttribute("data-drop-sequence") || card.dataset.dropSequence || 0),
      }))
      .sort((first, second) => first.sequence - second.sequence)
      .map((card) => card.index)
      .join(",")
  );
  expect(replayedOrder).toBe("0,1,2,3");
});

test("home opened meme record cards settle back on top of the 2D pile", async ({ page }) => {
  await preparePage(page, "light");
  const homeRoute = usesExternalVisualServer() && process.env.VISUAL_BASE_URL ? "/" : "/al-folio/";
  await page.goto(homeRoute, { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const cards = page.locator("[data-home-record-card]");

  await dropRecordCardsUntil(page, 1);
  await dropRecordCardsUntil(page, 2);
  await page.waitForTimeout(240);

  const firstCard = cards.nth(0);
  const openedIndex = await firstCard.getAttribute("data-record-index");
  await firstCard.focus();
  await page.keyboard.press("Enter");
  await expect(firstCard).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(firstCard).toHaveAttribute("aria-expanded", "false");
  await page.waitForTimeout(680);

  const topIndex = await cards.evaluateAll((cardNodes) => {
    const sorted = cardNodes
      .map((card) => ({
        index: card.getAttribute("data-record-index"),
        zIndex: Number.parseInt(window.getComputedStyle(card).zIndex, 10) || 0,
        dropSequence: Number(card.getAttribute("data-drop-sequence") || card.dataset.dropSequence || 0),
      }))
      .sort((first, second) => second.zIndex - first.zIndex || second.dropSequence - first.dropSequence);

    return sorted[0]?.index || "";
  });

  expect(topIndex).toBe(openedIndex);
});

test("home 3D outside view uses explicit window clicks and scroll-away reset", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "desktop canvas hit zones use desktop framing");

  await preparePage(page, "light");
  const homeRoute = usesExternalVisualServer() && process.env.VISUAL_BASE_URL ? "/" : "/al-folio/";
  await page.goto(homeRoute, { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const stage = page.locator("[data-home-artifact-stage]");
  const scene = page.locator("[data-home-desk-scene]");
  await expect(stage).toHaveAttribute("data-desk-mode", "2d");
  await page.click('[data-home-desk-mode="3d"]');
  await expect(stage).toHaveAttribute("data-desk-mode", "3d");
  await page.waitForTimeout(1200);

  const canvas = page.locator(".home-desk-corner-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width * 0.78, box.y + box.height * 0.28);
  await page.mouse.wheel(0, -1600);
  await page.waitForTimeout(320);
  await expect(page.locator("html")).not.toHaveClass(/home-desk-outside-active/);
  await expect(scene).not.toHaveClass(/is-outside-view/);

  await clickDeskProjectedTarget(page, scene, "data-window-screen-bounds");
  await expect(scene).toHaveAttribute("data-last-raycast-kind", "windowJump");
  await expect(page.locator("html")).toHaveClass(/home-desk-outside-active/);
  await expect(scene).toHaveClass(/is-outside-view/);

  await page.mouse.wheel(0, -2400);
  await page.waitForTimeout(240);
  await expect(page.locator("html")).toHaveClass(/home-desk-outside-active/);
  await expect(scene).toHaveClass(/is-outside-view/);

  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(240);
  await expect(page.locator("html")).toHaveClass(/home-desk-outside-active/);
  await expect(scene).toHaveClass(/is-outside-view/);

  await clickDeskProjectedTarget(page, scene, "data-return-screen-bounds");
  await expect(scene).toHaveAttribute("data-last-raycast-kind", "returnInside");
  await page.waitForTimeout(240);
  await expect(page.locator("html")).not.toHaveClass(/home-desk-outside-active/);
  await expect(scene).not.toHaveClass(/is-outside-view/);

  await clickDeskProjectedTarget(page, scene, "data-window-screen-bounds");
  await expect(scene).toHaveAttribute("data-last-raycast-kind", "windowJump");
  await expect(page.locator("html")).toHaveClass(/home-desk-outside-active/);
  await expect(scene).toHaveClass(/is-outside-view/);

  await page.locator(".home-agentic-tally").scrollIntoViewIfNeeded();
  await expect(page.locator("html")).not.toHaveClass(/home-desk-outside-active/);
  await expect(scene).not.toHaveClass(/is-outside-view/);
});

test("home 3D album rack ignores dropped sleeves and replaces focused albums", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "desktop canvas hit zones use desktop framing");

  await preparePage(page, "light");
  const homeRoute = usesExternalVisualServer() && process.env.VISUAL_BASE_URL ? "/" : "/al-folio/";
  await page.goto(homeRoute, { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const stage = page.locator("[data-home-artifact-stage]");
  const scene = page.locator("[data-home-desk-scene]");
  await expect(stage).toHaveAttribute("data-desk-mode", "2d");

  await dropRecordCardsUntil(page, 1);
  await dropRecordCardsUntil(page, 2);
  await expect(stage).toHaveAttribute("data-dropped-records", "0,1");

  await page.click('[data-home-desk-mode="3d"]');
  await expect(stage).toHaveAttribute("data-desk-mode", "3d");
  await page.waitForTimeout(1200);
  await requestDeskEvidence(scene);
  const initialAlbumEvidence = JSON.parse((await scene.getAttribute("data-album-screen-bounds")) || "[]");
  expect(initialAlbumEvidence.find((entry) => entry.index === 0)?.thrown).toBe(true);
  expect(initialAlbumEvidence.find((entry) => entry.index === 0)?.rack).toBeNull();
  expect(initialAlbumEvidence.find((entry) => entry.index === 1)?.thrown).toBe(true);
  expect(initialAlbumEvidence.find((entry) => entry.index === 1)?.rack).toBeNull();

  await page.click('[data-home-desk-control="previous"]');
  await expect(stage).toHaveAttribute("data-record-tone", "jude");
  await expect(scene).not.toHaveAttribute("data-focused-desk-object", "album-0");

  await clickDeskAlbumTarget(page, scene, 2, "rackPoint");
  await page.waitForTimeout(620);
  await expect(stage).toHaveAttribute("data-record-tone", "jude");
  await expect(scene).toHaveAttribute("data-focused-desk-object", "album-2");

  await clickDeskAlbumTarget(page, scene, 2, "objectPoint");
  await page.waitForTimeout(1120);
  await expect(stage).toHaveAttribute("data-record-tone", "wind");
  await expect(scene).not.toHaveAttribute("data-focused-desk-object", /album-/);
  await page.waitForTimeout(900);

  await dragDeskAlbumFromRack(page, scene, 2);
  await page.waitForTimeout(920);
  await expect(stage).toHaveAttribute("data-dropped-records", "0,1,2");
  await expect(scene).not.toHaveAttribute("data-focused-desk-object", /album-/);

  await clickDeskAlbumTarget(page, scene, 3, "rackPoint");
  await page.waitForTimeout(620);
  await expect(stage).toHaveAttribute("data-record-tone", "wind");
  await expect(scene).toHaveAttribute("data-focused-desk-object", "album-3");

  await clickDeskAlbumTarget(page, scene, 3, "objectPoint");
  await page.waitForTimeout(1120);
  await expect(stage).toHaveAttribute("data-record-tone", "sunday");
  await expect(page.locator('[data-home-desk-control="spin"]')).toHaveAttribute("aria-pressed", "true");
  await expect(scene).not.toHaveAttribute("data-focused-desk-object", /album-/);
});

test("home 3D artifacts focus before opening their project route", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "desktop object-focus checkpoint; compact touch coverage lives in the scene matrix");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  const homeRoute = usesExternalVisualServer() && process.env.VISUAL_BASE_URL ? "/" : "/al-folio/";
  await page.goto(homeRoute, { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const scene = page.locator("[data-home-desk-scene]");
  const firstArtifactLink = page.locator("[data-home-desk-artifact-link]").first();
  const expectedPath = await firstArtifactLink.evaluate((link) => new URL(link.href).pathname);
  const initialPath = new URL(page.url()).pathname;
  await page.click('[data-home-desk-mode="3d"]');
  await expect(page.locator("[data-home-artifact-stage]")).toHaveAttribute("data-desk-mode", "3d");

  const initialPoint = await getDeskArtifactTarget(scene, 0);
  await clickDeskCanvasAt(page, initialPoint.x, initialPoint.y);
  await expect(scene).toHaveAttribute("data-focused-desk-object", "artifact-0");
  expect(new URL(page.url()).pathname).toBe(initialPath);

  await page.waitForTimeout(1320);
  const focusedPoint = await getDeskArtifactTarget(scene, 0);
  await Promise.all([page.waitForURL((url) => url.pathname === expectedPath), clickDeskCanvasAt(page, focusedPoint.x, focusedPoint.y)]);
  expect(new URL(page.url()).pathname).toBe(expectedPath);
  expect(runtimeErrors, "3D artifact focus/open journey raised browser runtime errors").toEqual([]);
});

test("navbar search button opens modal and toggle buttons use pointer cursor", async ({ page }) => {
  await preparePage(page, "light");
  await page.goto("/al-folio/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  await page.waitForFunction(() => typeof document.querySelector("ninja-keys")?.open === "function");
  await expect.poll(() => page.evaluate(() => document.querySelector("ninja-keys")?.visible)).toBe(false);

  await page.click("#search-toggle");
  await expect.poll(() => page.evaluate(() => document.querySelector("ninja-keys")?.visible)).toBe(true);

  const searchCursor = await page.locator("#search-toggle").evaluate((el) => window.getComputedStyle(el).cursor);
  const themeCursor = await page.locator("#theme-toggle").evaluate((el) => window.getComputedStyle(el).cursor);
  expect(searchCursor).toBe("pointer");
  expect(themeCursor).toBe("pointer");

  const navExpanded = await page.locator("#navbarNav").evaluate((el) => el.classList.contains("show"));
  expect(navExpanded).toBeFalsy();
});

test("related posts are wrapped in a valid list", async ({ page }) => {
  await preparePage(page, "light");
  await openOptionalStarterRoute(page, "/al-folio/blog/2023/tables/");

  const heading = page.getByRole("heading", { name: "Enjoy Reading This Article?" });
  await expect(heading).toBeVisible();

  const relatedList = heading.locator("xpath=following::ul[1]");
  await expect(relatedList).toBeVisible();
  await expect(relatedList.locator("li").first()).toBeVisible();

  const relatedLinkWeight = await relatedList
    .locator("a")
    .first()
    .evaluate((el) => Number.parseInt(window.getComputedStyle(el).fontWeight, 10) || 400);
  expect(relatedLinkWeight).toBeLessThanOrEqual(400);
});

test("inline code uses compact normal-weight typography", async ({ page }) => {
  await preparePage(page, "light");
  await openOptionalStarterRoute(page, "/al-folio/blog/2023/sidebar-table-of-contents/");

  const inlineCodeStyle = await page.evaluate(() => {
    const candidate = Array.from(document.querySelectorAll("main code, [role='main'] code")).find((el) => !el.closest("pre"));
    if (!candidate) {
      return null;
    }
    const computed = window.getComputedStyle(candidate);
    const numericWeight = Number.parseInt(computed.fontWeight, 10);
    return {
      fontSize: Number.parseFloat(computed.fontSize),
      fontWeight: Number.isNaN(numericWeight) ? (computed.fontWeight === "bold" ? 700 : 400) : numericWeight,
    };
  });

  expect(inlineCodeStyle).not.toBeNull();
  expect(inlineCodeStyle.fontSize).toBeLessThan(16);
  expect(inlineCodeStyle.fontWeight).toBeLessThanOrEqual(400);
});

test("project cards hover with upward lift animation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "hover-specific assertion is desktop-only");

  await preparePage(page, "light");
  await page.goto("/al-folio/projects/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const card = page.locator(".projects .hoverable").first();
  await expect(card).toBeVisible();

  const before = await card.boundingBox();
  await card.hover();
  await page.waitForTimeout(150);
  const after = await card.boundingBox();

  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(after.y).toBeLessThan(before.y);
});

test("project previews announce state and recover focus before hiding controls", async ({ page }) => {
  await preparePage(page, "light");
  await page.goto("/al-folio/projects/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const card = page.locator("[data-project-card]").first();
  const trigger = card.locator("[data-project-card-trigger]");
  const panel = card.locator("[data-project-card-panel]");
  const primaryAction = card.locator("[data-project-card-primary-action]");
  const status = page.locator("[data-project-card-status]");

  await expect(trigger).toHaveAttribute("aria-controls", await panel.getAttribute("id"));
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(status).toHaveAttribute("aria-atomic", "true");

  await trigger.focus();
  await trigger.press("Enter");
  await expect(card).toHaveAttribute("data-project-card-state", "expanded");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  await expect(primaryAction).toBeFocused();
  await expect(status).toContainText(/preview opened\.$/);

  await page.evaluate(() => {
    const observedPanel = document.querySelector("[data-project-card-panel]");
    const observedTrigger = document.querySelector("[data-project-card-trigger]");
    window.__projectCardFocusReturnedBeforeHide = null;
    new MutationObserver(() => {
      if (observedPanel?.hidden) {
        window.__projectCardFocusReturnedBeforeHide = document.activeElement === observedTrigger;
      }
    }).observe(observedPanel, { attributeFilter: ["hidden"], attributes: true });
  });

  await page.keyboard.press("Escape");
  await expect(card).toHaveAttribute("data-project-card-state", "collapsed");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(status).toContainText(/preview closed\.$/);
  await expect.poll(() => page.evaluate(() => window.__projectCardFocusReturnedBeforeHide)).toBe(true);

  await trigger.click();
  await primaryAction.focus();
  await page
    .locator("h1")
    .first()
    .click({ position: { x: 4, y: 4 } });
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("project preview FLIP cancels stale runs and only translates cards", async ({ page }) => {
  await page.addInitScript(() => {
    const originalAnimate = Element.prototype.animate;
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    window.__projectCardMotionAudit = { animations: [], cancellations: [], scrollCorrections: [] };

    Element.prototype.animate = function (keyframes, options) {
      const animation = originalAnimate.call(this, keyframes, options);
      const kind = this.matches?.("[data-project-card]") ? "layout" : this.matches?.(".project-card > .card") ? "reveal" : null;
      if (kind) {
        const frames = Array.from(keyframes || []);
        window.__projectCardMotionAudit.animations.push({
          kind,
          duration: typeof options === "number" ? options : options?.duration,
          easing: typeof options === "object" ? options?.easing : undefined,
          transforms: frames.map((frame) => frame.transform || ""),
          clipPaths: frames.map((frame) => frame.clipPath || ""),
        });
        const originalCancel = animation.cancel.bind(animation);
        animation.cancel = (...args) => {
          window.__projectCardMotionAudit.cancellations.push(kind);
          return originalCancel(...args);
        };
      }
      return animation;
    };

    Element.prototype.scrollIntoView = function (...args) {
      if (this.closest?.("[data-project-card]")) {
        window.__projectCardMotionAudit.scrollCorrections.push({
          options: args[0],
          stack: new Error().stack,
          target: this.className,
        });
      }
      return originalScrollIntoView.apply(this, args);
    };
  });

  await preparePage(page, "light");
  await page.goto("/al-folio/projects/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const cards = page.locator("[data-project-card]");
  const firstCard = cards.nth(0);
  const secondCard = cards.nth(1);

  await page.evaluate(() => {
    window.__projectCardMotionAudit.scrollCorrections = [];
  });
  await page.evaluate(async () => {
    const triggers = Array.from(document.querySelectorAll("[data-project-card-trigger]"));
    const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    triggers[0]?.click();
    await delay(60);
    triggers[0]?.click();
    await delay(60);
    triggers[1]?.click();
  });
  await expect.poll(() => page.evaluate(() => window.__projectCardMotionAudit.cancellations)).toEqual(expect.arrayContaining(["layout", "reveal"]));
  await expect(firstCard).toHaveAttribute("data-project-card-state", "collapsed");
  await expect(secondCard).toHaveAttribute("data-project-card-state", "expanded");
  await expect
    .poll(() => cards.evaluateAll((items) => items.reduce((count, item) => count + item.getAnimations({ subtree: true }).length, 0)), {
      message: "project card animations should settle before computed-style checks",
    })
    .toBe(0);

  const audit = await page.evaluate(() => window.__projectCardMotionAudit);
  const layoutAnimations = audit.animations.filter((entry) => entry.kind === "layout");
  const revealAnimations = audit.animations.filter((entry) => entry.kind === "reveal");
  expect(layoutAnimations.length).toBeGreaterThan(0);
  expect(revealAnimations.length).toBeGreaterThan(0);
  expect(audit.cancellations).toEqual(expect.arrayContaining(["layout", "reveal"]));
  expect(audit.animations.every((entry) => entry.duration === 430)).toBe(true);
  expect(audit.animations.every((entry) => entry.easing === "cubic-bezier(.18, .84, .22, 1)")).toBe(true);
  expect(layoutAnimations.flatMap((entry) => entry.transforms).every((transform) => !transform.includes("scale"))).toBe(true);
  expect(revealAnimations.flatMap((entry) => entry.transforms).every((transform) => transform === "")).toBe(true);
  expect(revealAnimations.every((entry) => entry.clipPaths.at(-1) === "inset(0)")).toBe(true);
  expect(revealAnimations.some((entry) => entry.clipPaths[0] !== "inset(0)" && entry.clipPaths[0].includes("px"))).toBe(true);
  expect(audit.scrollCorrections.length, JSON.stringify(audit.scrollCorrections, null, 2)).toBeLessThanOrEqual(1);
  await expect(firstCard).toHaveAttribute("data-project-card-state", "collapsed");
  await expect(secondCard).toHaveAttribute("data-project-card-state", "expanded");

  const settledMotion = await page.evaluate(() => {
    const firstSurface = document.querySelector("[data-project-card] .card");
    const expandedSurface = document.querySelector("[data-project-card-state='expanded'] .card");
    const expandedImage = document.querySelector("[data-project-card-state='expanded'] .project-card-media img");
    const expandedPanel = document.querySelector("[data-project-card-state='expanded'] [data-project-card-panel]");
    const expandedTakeaways = document.querySelector("[data-project-card-state='expanded'] .project-card-takeaways");
    const transform = firstSurface ? getComputedStyle(firstSurface).transform : "none";
    const matrix = transform === "none" ? { a: 1, d: 1 } : new DOMMatrixReadOnly(transform);
    return {
      expandedImage: expandedImage ? getComputedStyle(expandedImage).transform : null,
      imageTransitionDuration: expandedImage ? getComputedStyle(expandedImage).transitionDuration : null,
      panelAnimationName: expandedPanel ? getComputedStyle(expandedPanel).animationName : null,
      surfaceClipPath: expandedSurface ? getComputedStyle(expandedSurface).clipPath : null,
      siblingScaleX: matrix.a,
      siblingScaleY: matrix.d,
      takeawayAnimationName: expandedTakeaways ? getComputedStyle(expandedTakeaways).animationName : null,
    };
  });
  expect(settledMotion.expandedImage).toBe("none");
  expect(settledMotion.imageTransitionDuration).toBe("0s");
  expect(settledMotion.panelAnimationName).toBe("none");
  expect(settledMotion.surfaceClipPath).toBe("none");
  expect(settledMotion.siblingScaleX).toBe(1);
  expect(settledMotion.siblingScaleY).toBe(1);
  expect(settledMotion.takeawayAnimationName).toBe("none");
  expect(await cards.evaluateAll((items) => items.reduce((count, item) => count + item.getAnimations({ subtree: true }).length, 0))).toBe(0);

  await secondCard.locator("[data-project-card-trigger]").click();
  await expect(secondCard).toHaveAttribute("data-project-card-state", "collapsed");
  await expect
    .poll(() => cards.evaluateAll((items) => items.reduce((count, item) => count + item.getAnimations({ subtree: true }).length, 0)))
    .toBe(0);

  const thirdCard = cards.nth(2);
  const thirdTrigger = thirdCard.locator("[data-project-card-trigger]");
  const thirdPrimaryAction = thirdCard.locator("[data-project-card-primary-action]");
  const navigationLink = page.locator("#theme-toggle");
  await thirdTrigger.focus();
  await thirdTrigger.press("Enter");
  await navigationLink.focus();
  await expect
    .poll(() => cards.evaluateAll((items) => items.reduce((count, item) => count + item.getAnimations({ subtree: true }).length, 0)))
    .toBe(0);
  await expect(navigationLink).toBeFocused();
  await expect(thirdPrimaryAction).not.toBeFocused();
});

test("project previews preserve keyboard state with reduced motion", async ({ page }) => {
  await page.addInitScript(() => {
    const originalAnimate = Element.prototype.animate;
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    window.__projectCardReducedMotionAudit = { animations: 0, scrollCorrections: 0 };

    Element.prototype.animate = function (...args) {
      if (this.matches?.("[data-project-card], .project-card > .card")) {
        window.__projectCardReducedMotionAudit.animations += 1;
      }
      return originalAnimate.apply(this, args);
    };

    Element.prototype.scrollIntoView = function (...args) {
      if (this.closest?.("[data-project-card]")) {
        window.__projectCardReducedMotionAudit.scrollCorrections += 1;
      }
      return originalScrollIntoView.apply(this, args);
    };
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await preparePage(page, "light");
  await page.goto("/al-folio/projects/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const cards = page.locator("[data-project-card]");
  const card = cards.first();
  const trigger = card.locator("[data-project-card-trigger]");
  const panel = card.locator("[data-project-card-panel]");
  const primaryAction = card.locator("[data-project-card-primary-action]");
  const status = page.locator("[data-project-card-status]");

  await trigger.focus();
  await trigger.press("Enter");
  await expect(card).toHaveAttribute("data-project-card-state", "expanded");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  await expect(primaryAction).toBeFocused();
  await expect(status).toContainText(/preview opened\.$/);

  const reducedMotionState = await page.evaluate(() => {
    const projectCards = Array.from(document.querySelectorAll("[data-project-card]"));
    const expandedPanel = document.querySelector("[data-project-card-panel]");
    const siblingSurface = projectCards[1]?.querySelector(".card");
    const expandedSurface = projectCards[0]?.querySelector(".card");
    const expandedImage = projectCards[0]?.querySelector(".project-card-media img");
    const expandedTakeaways = projectCards[0]?.querySelector(".project-card-takeaways");
    return {
      audit: window.__projectCardReducedMotionAudit,
      cardAnimations: projectCards.reduce((count, item) => count + item.getAnimations().length, 0),
      imageTransitionDuration: expandedImage ? getComputedStyle(expandedImage).transitionDuration : null,
      panelAnimationName: expandedPanel ? getComputedStyle(expandedPanel).animationName : null,
      siblingTransform: siblingSurface ? getComputedStyle(siblingSurface).transform : null,
      surfaceClipPath: expandedSurface ? getComputedStyle(expandedSurface).clipPath : null,
      takeawayAnimationName: expandedTakeaways ? getComputedStyle(expandedTakeaways).animationName : null,
    };
  });

  expect(reducedMotionState.audit.animations).toBe(0);
  expect(reducedMotionState.audit.scrollCorrections).toBeLessThanOrEqual(1);
  expect(reducedMotionState.cardAnimations).toBe(0);
  expect(reducedMotionState.imageTransitionDuration).toBe("0s");
  expect(reducedMotionState.panelAnimationName).toBe("none");
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(reducedMotionState.siblingTransform);
  expect(reducedMotionState.surfaceClipPath).toBe("none");
  expect(reducedMotionState.takeawayAnimationName).toBe("none");

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(status).toContainText(/preview closed\.$/);
});

test("404 recovery stays put and opts out of indexing", async ({ page }) => {
  await preparePage(page, "light");
  await page.goto("/al-folio/404.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  await expect(page.getByRole("link", { name: "Return home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse projects" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read research notes" })).toBeVisible();
  await page.waitForTimeout(3500);
  await expect(page).toHaveURL(/\/al-folio\/404\.html$/);
});

test("teaching calendar toggle has pointer cursor and toggles calendar visibility", async ({ page }) => {
  await preparePage(page, "light");
  await openOptionalStarterRoute(page, "/al-folio/teaching/");

  const button = page.locator("#calendar-toggle-btn");
  await expect(button).toBeVisible();

  const buttonStyles = await button.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return { cursor: computed.cursor, fontSize: computed.fontSize };
  });
  expect(buttonStyles.cursor).toBe("pointer");
  expect(Number.parseFloat(buttonStyles.fontSize)).toBeGreaterThan(12);

  await button.click();
  await expect(page.locator("#calendar-container")).toBeVisible();
  await expect(button).toContainText("Hide Calendar");
});

test("toc sidebar renders with tocbot styling and data-toc-text label", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "TOC sidebar is hidden on mobile viewport");

  await preparePage(page, "light");
  await openOptionalStarterRoute(page, "/al-folio/blog/2023/sidebar-table-of-contents/");

  const tocSidebar = page.locator("#toc-sidebar");
  const tocLinks = tocSidebar.locator(".toc-link");
  await expect.poll(async () => tocLinks.count()).toBeGreaterThan(0);
  await expect(tocSidebar.getByText("Customizing")).toHaveCount(1);

  const firstLink = tocLinks.first();
  await firstLink.hover();
  const tocDecor = await firstLink.evaluate((el) => {
    const linkStyle = window.getComputedStyle(el);
    const listBorders = Array.from(document.querySelectorAll("#toc-sidebar .toc-list")).map((list) => window.getComputedStyle(list).borderLeftWidth);
    return {
      linkBorderLeftWidth: linkStyle.borderLeftWidth,
      listBorders,
    };
  });
  expect(tocDecor.linkBorderLeftWidth).toBe("0px");
  expect(tocDecor.listBorders.every((value) => value === "0px")).toBeTruthy();

  await page.getByRole("heading", { name: "Customizing Your Table of Contents" }).scrollIntoViewIfNeeded();
  await expect.poll(async () => tocSidebar.locator(".toc-link.is-active-link").count()).toBeGreaterThan(0);

  const activeDecor = await tocSidebar
    .locator(".toc-link.is-active-link")
    .first()
    .evaluate((el) => {
      const activeStyle = window.getComputedStyle(el);
      const activeMarkerStyle = window.getComputedStyle(el, "::before");
      return {
        activeColor: activeStyle.color,
        markerColor: activeMarkerStyle.backgroundColor,
      };
    });
  expect(activeDecor.markerColor).toBe(activeDecor.activeColor);
});

test("tailwind table engine provides search, pagination, and sorting in pretty tables", async ({ page }) => {
  await preparePage(page, "light");
  await openOptionalStarterRoute(page, "/al-folio/blog/2023/tables/");

  const interactiveTable = page.locator('table[data-search="true"]');
  await expect(interactiveTable).toBeVisible();
  await expect(interactiveTable).toHaveClass(/af-table-enhanced/);

  const searchInput = page.locator(".af-table-search").first();
  await expect(searchInput).toBeVisible();
  await searchInput.fill("Item 19");
  await expect(interactiveTable.locator("tbody tr")).toHaveCount(1);

  await searchInput.fill("");
  const sortableHeader = interactiveTable.locator('thead th[data-field="id"]');
  await sortableHeader.click();
  await sortableHeader.click();
  await expect(interactiveTable.locator("tbody tr").first().locator("td").nth(1)).toHaveText("20");
});

test("lightbox galleries open in-page modal instead of navigating away", async ({ page }) => {
  await preparePage(page, "light");
  await openOptionalStarterRoute(page, "/al-folio/blog/2024/photo-gallery/");

  const firstLightboxLink = page.locator("a[data-lightbox]").first();
  const firstHref = await firstLightboxLink.getAttribute("href");
  await firstLightboxLink.click();

  const overlay = page.locator(".al-lightbox-overlay");
  await expect(overlay).toHaveClass(/is-open/);
  await expect(page.locator(".al-lightbox-image")).toHaveAttribute("src", firstHref);

  const firstImageSrc = await page.locator(".al-lightbox-image").getAttribute("src");
  await page.locator(".al-lightbox-next").click();
  await expect(page.locator(".al-lightbox-image")).not.toHaveAttribute("src", firstImageSrc);

  await page.keyboard.press("Escape");
  await expect(overlay).not.toHaveClass(/is-open/);
});

test("core pages no longer emit jQuery-style runtime errors", async ({ page }) => {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(message.text());
    }
  });

  await preparePage(page, "light");
  const pages = ["/al-folio/", "/al-folio/projects/", "/al-folio/blog/2024/photo-gallery/", "/al-folio/blog/2023/tables/"];

  for (const target of pages) {
    await page.goto(target, { waitUntil: "networkidle" });
    await stabilizeVisuals(page);
  }

  const jqueryFailures = failures.filter((message) => /\$\s*is not defined|lightbox/i.test(message));
  expect(jqueryFailures).toEqual([]);
});
