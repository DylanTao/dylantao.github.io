const { test, expect } = require("@playwright/test");
const { collectRuntimeErrors, preparePage, screenshotDiffRatio } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const recorded = require("../../_data/code_activity.json");
const sum = (points) => points.reduce((total, point) => total + (point.personal?.commits ?? 0), 0);
const personalPoints = recorded.points.filter((point) => point.personal);
const cutoff = personalPoints.at(-1).date;
const cutoffCount = personalPoints.at(-1).personal.commits;
const rangeTotal = (start, end) =>
  sum(
    personalPoints.filter((point) => {
      const year = Number(point.date.slice(0, 4));
      return year >= start && year <= end;
    })
  );
const dateLabel = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const sunday = (date) => {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - day.getUTCDay());
  return day.toISOString().slice(0, 10);
};
const latestWeekPoints = personalPoints.filter((point) => point.date >= sunday(cutoff));
const nextDate = new Date(Date.parse(cutoff) + 86_400_000).toISOString().slice(0, 10);
const evidence = (page) => page.evaluate(() => window.getCommitOverviewEvidence());

async function settled(page) {
  for (const selector of ["[data-rhythm-chart]", "[data-rhythm-detail-chart]"])
    await expect(page.locator(selector)).toHaveAttribute("data-transitioning", "false");
}
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
    await settled(page);
    await page.evaluate(() => document.fonts?.ready);
  }
}
async function view(page, mode) {
  await page.locator(`[data-rhythm-view="${mode}"]`).click();
  await expect(page.locator("[data-rhythm-detail-chart]")).toHaveAttribute("data-view", mode);
  await settled(page);
}
async function range(page, start, end = start) {
  await page.locator("[data-rhythm-range-start]").selectOption(String(start));
  await page.locator("[data-rhythm-range-end]").selectOption(String(end));
  await expect(page.locator("[data-rhythm-chart]")).toHaveAttribute("data-start-year", String(start));
  await expect(page.locator("[data-rhythm-chart]")).toHaveAttribute("data-end-year", String(end));
  await settled(page);
}
const documentBox = (locator) =>
  locator.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height };
  });

async function panelPalette(page) {
  return page.locator("[data-build-rhythm-overview]").evaluate((panel) => {
    const context = document.createElement("canvas").getContext("2d");
    // Computed color-mix values may use color(srgb ...), rather than rgb(...).
    // Let the browser resolve colors and composite transparent control fills.
    const rgb = (color, background = "#fff") => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = background;
      context.fillRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const luminance = (channels) =>
      channels
        .map((value) => value / 255)
        .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
        .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
    const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
    const panelStyle = getComputedStyle(panel),
      surface = panelStyle.backgroundColor,
      background = rgb(surface),
      root = getComputedStyle(document.documentElement);
    const selectors = [
      "[data-rhythm-total]",
      "[data-rhythm-total-label]",
      ".build-rhythm-context",
      ".build-rhythm-detail-context",
      ".build-rhythm-coverage",
      ".build-rhythm-readout",
      ".build-rhythm-legend span",
      ".build-rhythm-range-picker",
      ".build-rhythm-year-picker",
      "button",
      "select",
      "svg text",
    ];
    const text = [...panel.querySelectorAll(selectors.join(","))].map((node) => {
      const style = getComputedStyle(node),
        behind = rgb(style.backgroundColor, surface),
        foreground = rgb(node instanceof SVGElement ? style.fill : style.color, `rgb(${behind.join(" ")})`);
      return { text: node.textContent.trim(), contrast: contrast(foreground, behind) };
    });
    const controls = [...panel.querySelectorAll("button, select, [data-rhythm-inspector]")].map((node) => {
      const style = getComputedStyle(node),
        behind = rgb(style.backgroundColor, surface);
      return {
        control: node.getAttribute("data-rhythm-inspector") || node.getAttribute("aria-label") || node.textContent.trim(),
        background: behind,
        border: rgb(style.borderTopColor, surface),
        borderContrast: contrast(rgb(style.borderTopColor, surface), background),
        focusVisible: node.matches(":focus-visible"),
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth),
        outlineContrast: contrast(rgb(style.outlineColor, surface), background),
      };
    });
    return {
      background,
      pageBackground: rgb(root.getPropertyValue("--global-bg-color")),
      primary: rgb(root.getPropertyValue("--global-primary-color")),
      ink: rgb(getComputedStyle(panel.querySelector("[data-rhythm-cumulative-line]")).stroke),
      inkContrast: contrast(rgb(getComputedStyle(panel.querySelector("[data-rhythm-cumulative-line]")).stroke), background),
      colorScheme: panelStyle.colorScheme,
      text,
      controls,
    };
  });
}

test("one panel keeps full history visible while the independent year detail changes", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await open(page);
  await expect(page.locator("[data-build-rhythm-overview]")).toHaveCount(1);
  await expect(page.locator("[data-build-rhythm-overview] svg")).toHaveCount(2);
  await expect(page.locator("[data-rhythm-slot]")).toHaveCount(365);
  await expect(page.locator("[data-rhythm-summary]")).toContainText(sum(personalPoints).toLocaleString("en-US"));
  await expect(page.locator("[data-rhythm-range-start]")).toHaveValue("2017");
  await expect(page.locator("[data-rhythm-range-end]")).toHaveValue("2026");
  const palette = await panelPalette(page);
  for (const label of palette.text)
    expect(label.contrast, `${label.text} must remain readable on the active theme surface`).toBeGreaterThanOrEqual(4.5);
  expect(await evidence(page)).toMatchObject({
    years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    total: sum(recorded.points),
    recordedDays: personalPoints.length,
    canonicalWeeks: new Set(personalPoints.map((point) => sunday(point.date))).size,
    sourceCutoff: cutoff,
    tabStops: 2,
    year: 2026,
    view: "daily",
    cumulativeBasis: "selectedRangeRecorded",
  });
  const original = await page.locator("[data-rhythm-cumulative-line]").getAttribute("d");
  await page.locator("[data-rhythm-year]").selectOption("2024");
  await view(page, "weekly");
  expect(await page.locator("[data-rhythm-cumulative-line]").getAttribute("d")).toBe(original);
  expect(await evidence(page)).toMatchObject({ rangeStart: 2017, rangeEnd: 2026, rangeTotal: sum(personalPoints), year: 2024, view: "weekly" });
  await expect(page.locator("[data-rhythm-year] option")).toHaveCount(10);
  expect(errors).toEqual([]);
});

test("all four themes keep readable chart states and preserve the selected history", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await open(page, { theme: "evening" });
  await range(page, 2024, 2026);
  await page.locator("[data-rhythm-year]").selectOption("2024");
  await view(page, "weekly");
  const inspector = page.locator('[data-rhythm-inspector="detail"]');
  await inspector.focus();
  await page.keyboard.press("End");
  const before = await evidence(page),
    history = await page.locator("[data-rhythm-cumulative-line]").getAttribute("d"),
    geometry = await page
      .locator("[data-rhythm-slot]")
      .evaluateAll((nodes) => nodes.map((node) => ["x", "y", "width", "height"].map((name) => node.getAttribute(name))));
  const palettes = [];
  for (const mode of ["morning", "noon", "afternoon", "evening"]) {
    await page.locator("#theme-toggle").click();
    await page.locator(`#theme-menu [data-theme-mode-option="${mode}"]`).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-mode", mode);
    await expect(page.locator("html")).not.toHaveClass(/\btransition\b/);
    const palette = await panelPalette(page);
    palettes.push(palette);
    expect(palette.colorScheme).toBe(mode === "evening" ? "dark" : "light");
    expect(Math.hypot(...palette.background.map((channel, index) => channel - palette.pageBackground[index]))).toBeLessThan(80);
    expect(palette.ink).toEqual(palette.primary);
    expect(palette.inkContrast).toBeGreaterThanOrEqual(3);
    for (const label of palette.text) expect(label.contrast, `${mode}: ${label.text}`).toBeGreaterThanOrEqual(4.5);
    for (const control of palette.controls.filter((node) => !["history", "detail"].includes(node.control))) {
      expect(control.borderContrast, `${mode}: ${control.control} boundary`).toBeGreaterThanOrEqual(3);
    }
    expect(await evidence(page)).toEqual(before);
    expect(await page.locator("[data-rhythm-cumulative-line]").getAttribute("d")).toBe(history);
    expect(
      await page
        .locator("[data-rhythm-slot]")
        .evaluateAll((nodes) => nodes.map((node) => ["x", "y", "width", "height"].map((name) => node.getAttribute(name))))
    ).toEqual(geometry);
    await page.locator("[data-rhythm-range-reset]").hover();
    await page.locator("[data-rhythm-range-reset]").evaluate(async (node) => {
      getComputedStyle(node).backgroundColor;
      await Promise.all(node.getAnimations().map((animation) => animation.finished));
    });
    await expect
      .poll(async () => {
        const hover = await panelPalette(page);
        return Math.min(...hover.text.map((node) => node.contrast));
      })
      .toBeGreaterThanOrEqual(4.5);
    await page.keyboard.press("Tab");
    for (const target of ["[data-rhythm-range-start]", "[data-rhythm-view='weekly']", "[data-rhythm-inspector='detail']"]) {
      await page.locator(target).focus();
      await expect(page.locator(target)).toBeFocused();
      const focus = (await panelPalette(page)).controls.find((node) => node.focusVisible);
      expect(focus, `${mode}: ${target} keyboard focus`).toBeTruthy();
      expect(focus.outlineStyle).toBe("solid");
      expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
      expect(focus.outlineContrast).toBeGreaterThanOrEqual(3);
    }
    await page.mouse.move(0, 0);
    await page.locator("[data-rhythm-inspector='detail']").evaluate((node) => node.blur());
    await testInfo.attach(`rhythm-${mode}-selected-weekly`, {
      body: await page.locator("[data-build-rhythm-overview]").screenshot(),
      contentType: "image/png",
    });
  }
  expect(new Set(palettes.map((palette) => palette.background.join(","))).size).toBe(4);
  expect(new Set(palettes.map((palette) => palette.ink.join(","))).size).toBe(4);
  await testInfo.attach("four-theme-contrast", { body: JSON.stringify(palettes, null, 2), contentType: "application/json" });
  expect(errors).toEqual([]);
});

test("wide calendars use the full detail width while keeping square dates and one fixed slot", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 1920, height: 1000 });
  await open(page, { reduced: true });
  const stage = page.locator(".build-rhythm-plot-stage");
  const bounds = await documentBox(stage);
  const marks = await page.locator("[data-rhythm-detail-chart]").evaluate((svg) => {
    const cells = [...svg.querySelectorAll("[data-rhythm-slot]")];
    return {
      width: svg.viewBox.baseVal.width,
      rightmost: Math.max(...cells.map((node) => Number(node.getAttribute("x")) + Number(node.getAttribute("width")))),
      square: cells.every((node) => node.getAttribute("width") === node.getAttribute("height")),
    };
  });
  expect(marks.rightmost).toBeGreaterThanOrEqual(marks.width * 0.97);
  expect(marks.rightmost).toBeLessThanOrEqual(marks.width);
  expect(marks.square).toBe(true);
  expect(bounds.height).toBe(180);
  await view(page, "weekly");
  expect(await documentBox(stage)).toEqual(bounds);
  await view(page, "daily");
  expect(await documentBox(stage)).toEqual(bounds);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await testInfo.attach("wide-calendar-fit", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  expect(errors).toEqual([]);
});

test("selected ranges rebase the headline and line together and constrain only the detail year", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await open(page);
  await view(page, "weekly");
  for (const [start, end, total, lastDate] of [
    [2026, 2026, rangeTotal(2026, 2026), cutoff],
    [2024, 2025, rangeTotal(2024, 2025), "2025-12-31"],
    [2017, 2017, rangeTotal(2017, 2017), "2017-12-31"],
  ]) {
    await range(page, start, end);
    await expect(page.locator("[data-rhythm-total]")).toHaveText(total.toLocaleString("en-US"));
    await expect(page.locator("[data-rhythm-cumulative-line]")).toHaveAttribute("data-endpoint-value", String(total));
    await expect(page.locator("[data-rhythm-cumulative-line]")).toHaveAttribute("data-last-date", lastDate);
    await expect(page.locator("[data-rhythm-year] option")).toHaveCount(end - start + 1);
    expect(await evidence(page)).toMatchObject({ rangeTotal: total, historyEndpointValue: total, view: "weekly" });
    await expect(page.locator("[data-rhythm-view-note]")).toContainText("Each range starts from zero");
  }
  await page.locator("[data-rhythm-range-reset]").click();
  await settled(page);
  expect(await evidence(page)).toMatchObject({ rangeStart: 2017, rangeEnd: 2026, rangeTotal: sum(personalPoints), year: 2017, view: "weekly" });
  expect(errors).toEqual([]);
});

test("the cumulative path conserves exact dates and totals without annual resets or a forecast", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await open(page);
  const line = page.locator("[data-rhythm-cumulative-line]");
  await expect(line).toHaveAttribute("data-first-date", "2017-08-31");
  await expect(line).toHaveAttribute("data-last-date", cutoff);
  await expect(line).toHaveAttribute("data-recorded-days", String(personalPoints.length));
  await expect(line).toHaveAttribute("data-basis", "selected-range-recorded");
  const path = await line.getAttribute("d");
  expect((path.match(/M/g) ?? []).length).toBe(1);
  const coordinates = [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
  const points = recorded.points.filter((point) => point.personal);
  expect(coordinates).toHaveLength(points.length);
  const plot = await page.locator('[data-rhythm-inspector="history"]').evaluate((node) => ({
    left: Number(node.getAttribute("x")),
    top: Number(node.getAttribute("y")),
    width: Number(node.getAttribute("width")),
    height: Number(node.getAttribute("height")),
    maximum: Number(node.ownerSVGElement.dataset.yMaximum),
  }));
  let accumulated = 0;
  points.forEach((point, index) => {
    accumulated += point.personal.commits;
    const fraction = (Date.parse(point.date) - Date.parse("2017-01-01")) / (Date.parse("2027-01-01") - Date.parse("2017-01-01"));
    expect(coordinates[index].x).toBeCloseTo(plot.left + fraction * plot.width, 2);
    expect(coordinates[index].y).toBeCloseTo(plot.top + plot.height - (accumulated / plot.maximum) * plot.height, 2);
  });
  expect(coordinates.at(-1).x).toBeLessThan(plot.left + plot.width);
  const inspector = page.locator('[data-rhythm-inspector="history"]');
  await inspector.focus();
  await page.keyboard.press("End");
  await expect(page.locator("[data-rhythm-history-readout]")).toContainText(dateLabel(cutoff));
  await expect(page.locator("[data-rhythm-history-readout]")).toContainText(
    `${sum(personalPoints).toLocaleString("en-US")} cumulative recorded commits`
  );
  await page.keyboard.press("ArrowRight");
  expect((await evidence(page)).historySelectedDate).toBe(cutoff);
  expect(errors).toEqual([]);
});

test("Daily and Weekly replace one fixed detail slot without moving the history", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await open(page);
  const stage = page.locator(".build-rhythm-plot-stage"),
    history = page.locator(".build-rhythm-history-stage");
  // Locator screenshots scroll. Compare document coordinates so scroll cannot
  // masquerade as a layout shift on the shorter laptop viewport.
  const before = await documentBox(stage),
    historyBefore = await documentBox(history);
  const daily = await stage.screenshot();
  await view(page, "weekly");
  const weekly = await stage.screenshot();
  expect(screenshotDiffRatio(daily, weekly)).toBeGreaterThan(0.025);
  expect(await documentBox(stage)).toEqual(before);
  expect(await documentBox(history)).toEqual(historyBefore);
  await expect(page.locator("[data-rhythm-slot]")).toHaveCount(53);
  const inspector = page.locator('[data-rhythm-inspector="detail"]');
  await inspector.focus();
  await page.keyboard.press("End");
  await expect(page.locator("[data-rhythm-readout]")).toContainText(`${sum(latestWeekPoints).toLocaleString("en-US")} recorded commits`);
  await expect(page.locator("[data-rhythm-readout]")).toContainText(`${latestWeekPoints.length} of 7 dates verified`);
  await view(page, "daily");
  expect(await documentBox(stage)).toEqual(before);
  await expect(page.locator("[data-rhythm-slot]")).toHaveCount(365);
  await testInfo.attach("concept-a-daily-detail", { body: daily, contentType: "image/png" });
  await testInfo.attach("concept-a-weekly-detail", { body: weekly, contentType: "image/png" });
  expect(errors).toEqual([]);
});

test("keyboard explorers distinguish verified zero, missing dates, leap day and the exact cutoff", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await open(page);
  const historyInspector = page.locator('[data-rhythm-inspector="history"]');
  await historyInspector.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await settled(page);
  await expect(page.locator("[data-rhythm-year]")).toHaveValue("2017");
  const inspector = page.locator('[data-rhythm-inspector="detail"]');
  await inspector.focus();
  await page.keyboard.press("Home");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("Aug 31, 2017");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("0 recorded commits");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("Before verified coverage");
  await page.locator("[data-rhythm-year]").selectOption("2020");
  await settled(page);
  await expect(page.locator('[data-rhythm-slot][data-date="2020-02-29"]')).toHaveAttribute("data-evidence", "zero");
  await page.locator("[data-rhythm-year]").selectOption("2026");
  await settled(page);
  await inspector.focus();
  await page.keyboard.press("End");
  await expect(page.locator("[data-rhythm-readout]")).toContainText(dateLabel(cutoff));
  await expect(page.locator("[data-rhythm-readout]")).toContainText(`${cutoffCount.toLocaleString("en-US")} recorded commits`);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("[data-rhythm-readout]")).toContainText("Unverified after the cutoff");
  await expect(page.locator(`[data-rhythm-slot][data-date="${nextDate}"]`)).toHaveAttribute("data-evidence", "unverified");
  await expect(page.locator('[data-rhythm-slot][data-date="2026-12-31"]')).toHaveAttribute("data-evidence", "future");
  expect(errors).toEqual([]);
});

test("interrupted range changes retarget from the painted frame and update counts atomically", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await open(page);
  await page.locator("[data-rhythm-chart]").scrollIntoViewIfNeeded();
  const result = await page.evaluate(async () => {
    const change = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("change"));
    };
    change("[data-rhythm-range-start]", "2026");
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const painted = window.getCommitOverviewEvidence();
    change("[data-rhythm-range-start]", "2024");
    const retargeted = window.getCommitOverviewEvidence();
    document.querySelector('[data-rhythm-view="weekly"]').click();
    document.querySelector('[data-rhythm-view="daily"]').click();
    change("[data-rhythm-range-end]", "2025");
    document.querySelector("[data-rhythm-range-reset]").click();
    return { painted, retargeted, latest: window.getCommitOverviewEvidence() };
  });
  expect(result.painted.historyTransitioning).toBe(true);
  expect(result.retargeted.historyTransform).toEqual(result.painted.historyTransform);
  expect(result.retargeted.rangeTotal).toBe(rangeTotal(2024, 2026));
  expect(result.retargeted.summary).toContain(rangeTotal(2024, 2026).toLocaleString("en-US"));
  expect(result.latest.rangeTotal).toBe(sum(personalPoints));
  expect(result.latest.summary).toContain(sum(personalPoints).toLocaleString("en-US"));
  await settled(page);
  expect(await evidence(page)).toMatchObject({ rangeStart: 2017, rangeEnd: 2026, view: "daily", transitioning: false });
  expect((await evidence(page)).retargets).toBeGreaterThanOrEqual(3);
  await expect(page.locator("[data-rhythm-cumulative-line]")).toHaveCount(1);
  await expect(page.locator("[data-build-rhythm-overview] svg")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("hit testing follows the actual rendered detail marks during interrupted motion", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await open(page);
  await page.locator("[data-rhythm-detail-chart]").scrollIntoViewIfNeeded();
  const inspected = await page.evaluate(async () => {
    document.querySelector('[data-rhythm-view="weekly"]').click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    document.querySelector('[data-rhythm-view="daily"]').click();
    const mark = document.querySelector('[data-rhythm-slot][data-key="2026-09-27"]');
    const svg = document.querySelector("[data-rhythm-detail-chart]");
    const p = svg.createSVGPoint();
    p.x = Number(mark.getAttribute("x")) + Number(mark.getAttribute("width")) / 2;
    p.y = Number(mark.getAttribute("y")) + Number(mark.getAttribute("height")) / 2;
    const expected = [...document.querySelectorAll("[data-rhythm-slot]")]
      .findLast(
        (node) =>
          p.x >= Number(node.getAttribute("x")) &&
          p.x <= Number(node.getAttribute("x")) + Number(node.getAttribute("width")) &&
          p.y >= Number(node.getAttribute("y")) &&
          p.y <= Number(node.getAttribute("y")) + Number(node.getAttribute("height"))
      )
      .getAttribute("data-date");
    const screen = p.matrixTransform(svg.getScreenCTM());
    document
      .querySelector('[data-rhythm-inspector="detail"]')
      .dispatchEvent(new PointerEvent("pointerdown", { clientX: screen.x, clientY: screen.y }));
    return { ...window.getCommitOverviewEvidence(), expected };
  });
  expect(inspected.selectedDate).toBe(inspected.expected);
  const sourceValue = recorded.points.find((point) => point.date === inspected.expected)?.personal?.commits;
  expect(inspected.readout).toContain(
    sourceValue === undefined ? "Unverified after the cutoff" : `${sourceValue.toLocaleString("en-US")} recorded commits`
  );
  await settled(page);
  expect(errors).toEqual([]);
});

test("reduced motion is immediate and the deferred native table follows the independent detail year", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await open(page, { reduced: true, theme: "dark" });
  await page.evaluate(() => {
    const start = document.querySelector("[data-rhythm-range-start]");
    start.value = "2026";
    start.dispatchEvent(new Event("change"));
    document.querySelector('[data-rhythm-view="weekly"]').click();
  });
  expect((await evidence(page)).transitioning).toBe(false);
  expect((await evidence(page)).rangeTotal).toBe(rangeTotal(2026, 2026));
  await expect(page.locator("[data-rhythm-table-body] tr")).toHaveCount(0);
  await page.locator("[data-rhythm-method] > summary").click();
  await page.locator("[data-rhythm-records] > summary").click();
  await expect(page.locator("[data-rhythm-table-body] tr")).toHaveCount(personalPoints.filter((point) => point.date.startsWith("2026-")).length);
  const final = page.locator("[data-rhythm-table-body] tr").last();
  await expect(final.locator("th")).toHaveText(cutoff);
  await expect(final.locator("td").first()).toHaveText(cutoffCount.toLocaleString("en-US"));
  await expect(final.locator("td").last()).toHaveText(personalPoints.at(-1).personal.authored_commits.toLocaleString("en-US"));
  await page.locator("[data-rhythm-range-reset]").click();
  await expect(page.locator("[data-rhythm-table-body] tr")).toHaveCount(personalPoints.filter((point) => point.date.startsWith("2026-")).length);
  await page.locator("[data-rhythm-year]").selectOption("2017");
  await expect(page.locator("[data-rhythm-table-body] tr")).toHaveCount(123);
  await expect(page.locator("[data-rhythm-table-body] tr").first().locator("th")).toHaveText("2017-08-31");
  expect(errors).toEqual([]);
});

test("invalid snapshots fail compactly while schema 5 and separate Intern work remain supported", async ({ page, browser }) => {
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
    expect((await evidence(other)).historyEndpointValue).toBe(sum(recorded.points));
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("touch inspects exact dates in both half-year blocks and narrow layouts keep every control", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage(),
      errors = collectRuntimeErrors(page);
    await open(page, { reduced: true });
    await expect(page.locator("[data-rhythm-detail-chart]")).toHaveAttribute("data-calendar-blocks", "2");
    for (const [date, count] of [
      ["2026-02-03", null],
      [cutoff, cutoffCount],
    ]) {
      const mark = page.locator(`[data-rhythm-slot][data-date="${date}"]`);
      await mark.scrollIntoViewIfNeeded();
      const box = await mark.boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.locator("[data-rhythm-readout]")).toContainText(
        count === null ? "Feb 3, 2026" : `${count.toLocaleString("en-US")} recorded commits`
      );
    }
    for (const width of [320, 350, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await settled(page);
      for (const control of await page
        .locator("[data-rhythm-view], [data-rhythm-range-start], [data-rhythm-range-end], [data-rhythm-range-reset], [data-rhythm-year]")
        .all()) {
        const bounds = await control.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect((await evidence(page)).plotHeight).toBe(260);
    }
    for (const mode of ["weekly", "daily"]) {
      await view(page, mode);
      const clipped = await page.locator("[data-build-rhythm-overview] svg text").evaluateAll((nodes) =>
        nodes.some((node) => {
          const box = node.getBBox();
          return box.x < -0.5 || box.x + box.width > node.ownerSVGElement.viewBox.baseVal.width + 0.5;
        })
      );
      expect(clipped, `${mode} labels are clipped on mobile`).toBe(false);
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
