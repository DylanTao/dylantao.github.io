const { test, expect } = require("@playwright/test");
const { attachScreenshot, collectRuntimeErrors, preparePage, screenshotDiffRatio } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

const RHYTHM_KEYS = [
  "schema",
  "label",
  "units",
  "grain",
  "aggregation",
  "method",
  "since",
  "updated_at",
  "confidence",
  "privacy_note",
  "points",
].sort();

const readEmbeddedJson = (page, selector) => page.locator(selector).evaluate((element) => JSON.parse(element.textContent));

test("Build Rhythm presents three distinct scopes and one inspectable daily comparison", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/github-activity/"), { waitUntil: "networkidle" });

  const activity = page.locator("[data-github-activity]");
  const guide = page.locator(".build-rhythm-guide");
  const tokenRhythm = page.locator("[data-token-rhythm]");
  const tokenChart = page.locator("[data-token-rhythm-chart]");
  await expect(activity).toHaveAttribute("data-state", "ready");
  await expect(activity).toHaveAttribute("data-token-state", "ready");
  await expect(guide.locator(".build-rhythm-guide-grid > article")).toHaveCount(3);
  await expect(page.locator("[data-build-rhythm-story], [data-build-rhythm-story-stage]")).toHaveCount(0);

  const siteSource = await readEmbeddedJson(page, "#build-rhythm-token-data");
  const allWorkSource = await readEmbeddedJson(page, "#build-rhythm-all-work-token-data");
  for (const source of [siteSource, allWorkSource]) {
    expect(Object.keys(source).sort()).toEqual(RHYTHM_KEYS);
    expect(source.points.length).toBeGreaterThan(1);
    expect(Object.keys(source.points.at(-1)).sort()).toEqual(["date", "token_count", "tokens_label"].sort());
  }
  expect(siteSource.label).toBe("Site revamp retained-session estimate");
  expect(siteSource.method).toBe("deduplicated_repo_retained_logs");
  expect(allWorkSource.label).toBe("All retained Codex work estimate");
  expect(allWorkSource.method).toBe("deduplicated_all_retained_logs");

  const [siteEndpoint, allWorkEndpoint] = await Promise.all([
    page.request.get(publicRouteUrl("/assets/data/build-rhythm-token-rhythm.json")),
    page.request.get(publicRouteUrl("/assets/data/build-rhythm-all-work-token-rhythm.json")),
  ]);
  expect(siteEndpoint.ok()).toBe(true);
  expect(allWorkEndpoint.ok()).toBe(true);
  expect(await siteEndpoint.json()).toEqual(siteSource);
  expect(await allWorkEndpoint.json()).toEqual(allWorkSource);

  await expect(tokenRhythm).toHaveAttribute("data-state", "ready");
  await expect(tokenRhythm).toContainText("Y-AXIS: DAILY TOKENS");
  await expect(tokenChart.locator(".github-activity-token-all-work-line")).toHaveCount(1);
  await expect(tokenChart.locator(".github-activity-token-site-line")).toHaveCount(1);
  expect((await tokenChart.locator(".github-activity-token-all-work-line").getAttribute("d"))?.length).toBeGreaterThan(20);
  expect((await tokenChart.locator(".github-activity-token-site-line").getAttribute("d"))?.length).toBeGreaterThan(20);
  await expect(tokenChart).toHaveAttribute("role", "slider");
  await expect(tokenChart).toHaveAttribute("tabindex", "0");
  await expect(tokenChart.locator(".github-activity-token-axis-heading")).toContainText("Y-AXIS:");
  await expect(tokenChart.locator(".github-activity-token-axis-heading")).toContainText("LOG1P");
  await expect(page.locator(".github-activity-token-evidence")).not.toHaveAttribute("open", "");
  const firstDailyRow = page.locator("#github-activity-token-table-body tr").first();
  await expect(firstDailyRow.locator("td").first()).toHaveText("—");
  await expect(firstDailyRow.locator('td [aria-label="No prior all-work point for this date"]')).toHaveCount(1);

  await expect(guide.getByRole("link", { name: "The Rhythm of Food" })).toHaveAttribute("href", "https://rhythm-of-food.net/");
  await expect(guide.getByRole("link", { name: "John Thompson" })).toHaveAttribute("href", "https://jrthomp.com/");
  await expect(guide.getByRole("link", { name: "Read how Build Rhythm began" })).toHaveAttribute("href", /\/projects\/build-rhythm\/$/);

  const githubChart = page.locator("#github-activity-chart");
  await expect(githubChart.locator("text").filter({ hasText: "Y-AXIS: COMMITS" })).toContainText("LOG1P");
  await expect(githubChart.locator("text").filter({ hasText: "Y-AXIS: LINES" })).toContainText("SYMLOG");
  await page.getByRole("button", { name: "Literal", exact: true }).click();
  await expect(githubChart.locator("text").filter({ hasText: "Y-AXIS: COMMITS" })).toContainText("LINEAR");
  await expect(githubChart.locator("text").filter({ hasText: "Y-AXIS: LINES" })).toContainText("LINEAR");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${page.viewportSize()?.width}px Build Rhythm page overflows`).toBeLessThanOrEqual(1);
  await attachScreenshot(page, testInfo, `build-rhythm-guide-${testInfo.project.name}`, { locator: guide });
  await attachScreenshot(page, testInfo, `build-rhythm-daily-tokens-${testInfo.project.name}`, { locator: tokenRhythm });
  expect(runtimeErrors).toEqual([]);
});

test("Build Rhythm daily inspector supports quiet hover, pinning, and keyboard focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the complete inspector contract");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/github-activity/"), { waitUntil: "networkidle" });

  const chart = page.locator("[data-token-rhythm-chart]");
  const overlay = chart.locator(".github-activity-token-inspector");
  const readout = page.locator("[data-token-rhythm-readout]");
  const announcement = page.locator("[data-token-rhythm-announcement]");
  await expect(page.locator("[data-token-rhythm]")).toHaveAttribute("data-state", "ready");

  await chart.focus();
  await expect(chart).toHaveClass(/is-keyboard-focused/);
  const focusStyle = await chart.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(focusStyle.outlineWidth).not.toBe("0px");

  await chart.press("Home");
  await expect(chart).toHaveAttribute("aria-valuenow", "0");
  await chart.press("ArrowRight");
  await expect(chart).toHaveAttribute("aria-valuenow", "1");
  const keyboardAnnouncement = await announcement.textContent();
  expect(keyboardAnnouncement).toContain("all retained Codex work");

  await overlay.hover({ position: { x: 8, y: 40 } });
  await expect(readout).not.toHaveText(keyboardAnnouncement);
  expect(await announcement.textContent()).toBe(keyboardAnnouncement);

  const overlayBox = await overlay.boundingBox();
  expect(overlayBox).not.toBeNull();
  await overlay.click({ position: { x: Math.round(overlayBox.width * 0.55), y: Math.round(overlayBox.height * 0.5) } });
  await expect(announcement).not.toHaveText(keyboardAnnouncement);
  await expect(chart).toHaveAttribute("aria-valuetext", /all retained Codex work plus .* this website plus/);

  await chart.press("End");
  await expect(chart).toHaveAttribute("aria-valuenow", await chart.getAttribute("aria-valuemax"));
  await chart.press("Escape");
  await expect(readout).toContainText("pin cleared");
  expect(runtimeErrors).toEqual([]);
});

test("Build Rhythm lifetime price replay stays hypothetical and outside the direct schema", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the lifetime price boundary");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/github-activity/"), { waitUntil: "networkidle" });

  const usageResponse = await page.request.get(publicRouteUrl("/assets/data/codex-profile-usage.json"));
  expect(usageResponse.ok()).toBe(true);
  const usage = await usageResponse.json();
  expect(Object.keys(usage).sort()).toEqual(
    ["schema", "combined_lifetime", "method", "confidence", "observed_on", "updated_at", "automated_refresh"].sort()
  );
  expect(JSON.stringify(usage)).not.toContain("api_cost");

  const replay = page.locator("[data-hypothetical-mix-matched-api-rate-replay]");
  await expect(replay).toContainText(/~\$[\d,.]+K API-rate replay/);
  const replayCopy = page.locator(".github-activity-lifetime-replay");
  await expect(replayCopy).toContainText("model, cache, request-length, and input/output mix");
  await expect(replayCopy).toContainText("cache-write tokens are excluded");
  await expect(replayCopy).toContainText("Not an actual bill");
  await expect(replayCopy.getByRole("link", { name: "Standard public API rates" })).toHaveAttribute(
    "href",
    "https://developers.openai.com/api/docs/pricing"
  );
  expect(runtimeErrors).toEqual([]);
});

test("Build Rhythm reduced motion keeps the daily evidence pixel-stable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the reduced-motion chart contract");

  const runtimeErrors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/github-activity/"), { waitUntil: "networkidle" });

  const tokenChart = page.locator("[data-token-rhythm-chart]");
  await expect(page.locator("[data-token-rhythm]")).toHaveAttribute("data-state", "ready");
  await page.waitForTimeout(120);
  const before = await tokenChart.screenshot();
  await page.waitForTimeout(260);
  const after = await tokenChart.screenshot();
  expect(screenshotDiffRatio(after, before), "reduced-motion token chart should remain pixel-stable").toBeLessThan(0.0001);
  expect(runtimeErrors).toEqual([]);
});

test("Build Rhythm daily comparison stays legible in the evening theme", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves the dark-theme redraw");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "dark");
  await page.goto(publicRouteUrl("/github-activity/"), { waitUntil: "networkidle" });

  const tokenRhythm = page.locator("[data-token-rhythm]");
  const allWorkLine = page.locator(".github-activity-token-all-work-line");
  const siteLine = page.locator(".github-activity-token-site-line");
  await expect(tokenRhythm).toHaveAttribute("data-state", "ready");
  const [allWorkStroke, siteStroke] = await Promise.all([allWorkLine.getAttribute("stroke"), siteLine.getAttribute("stroke")]);
  expect(allWorkStroke).toBeTruthy();
  expect(siteStroke).toBeTruthy();
  expect(allWorkStroke).not.toBe(siteStroke);
  await expect(page.locator(".github-activity-token-axis-heading")).toContainText("LOG1P");
  await attachScreenshot(page, testInfo, "build-rhythm-daily-tokens-dark-desktop-1440", { locator: tokenRhythm });
  expect(runtimeErrors).toEqual([]);
});

test("Malformed all-work rhythm leaves GitHub and the native daily table intact", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop proves token-source failure isolation");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.route("**/github-activity/", async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace(/(<script id="build-rhythm-all-work-token-data" type="application\/json">[\s\S]*?"token_count"\s*:\s*)\d+/, "$1-1");
    expect(body).not.toBe(original);
    await route.fulfill({ response, body });
  });
  await page.goto(publicRouteUrl("/github-activity/"), { waitUntil: "networkidle" });

  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-token-state", "error");
  await expect(page.locator("[data-token-rhythm]")).toHaveAttribute("data-state", "error");
  await expect(page.locator("[data-token-rhythm-chart]")).toBeHidden();
  await expect(page.locator(".github-activity-commit-line")).toHaveCount(1);
  expect(await page.locator("#github-activity-table-body tr").count()).toBeGreaterThan(40);
  expect(await page.locator("#github-activity-token-table-body tr").count()).toBeGreaterThan(1);
  await expect(page.locator(".github-activity-token-evidence")).toBeAttached();
  expect(runtimeErrors).toEqual([]);
});
