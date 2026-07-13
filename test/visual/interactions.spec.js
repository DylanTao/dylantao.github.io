const { test, expect } = require("@playwright/test");
const { preparePage, stabilizeVisuals } = require("./helpers");
const { getPublicBaseURL, usesExternalVisualServer } = require("./public-routes");

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

test("Codex activity fails closed when its public data is unavailable", async ({ page }) => {
  await preparePage(page, "light");
  await page.route("**/assets/data/codex-profile-usage.json", (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
  await page.goto("/al-folio/github-activity/", { waitUntil: "networkidle" });

  const codexTrend = page.locator("[data-codex-usage]");
  await expect(codexTrend).toHaveAttribute("data-state", "error");
  await expect(codexTrend).toHaveAttribute("aria-busy", "false");
  await expect(codexTrend.locator("[data-codex-status]")).toHaveText("Recent Codex token data is unavailable.");
  await expect(page.getByRole("button", { name: "Daily", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Weekly", exact: true })).toBeDisabled();
  await expect(page.locator("#github-activity-codex-tokens")).toBeHidden();
  await expect(page.locator("[data-codex-table]")).toBeHidden();
  await expect(page.locator(".github-activity-codex-point")).toHaveCount(0);
  await expect(page.locator(".github-activity-codex-readout")).not.toContainText("0 tokens");
  await expect(page.locator(".github-activity-codex-readout")).not.toHaveAttribute("aria-live", /.+/);
});

test("github activity exposes scale, scope, keyboard inspection, and exact values", async ({ page }) => {
  await preparePage(page, "light");
  await page.goto("/al-folio/github-activity/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const activity = page.locator("[data-github-activity]");
  await expect(activity).toHaveAttribute("data-state", "ready");
  const codexLedger = page.locator(".github-activity-codex-ledger");
  await expect(codexLedger.locator("div")).toHaveCount(2);
  await expect(codexLedger).not.toContainText("local logs");
  await expect(page.locator(".github-activity-ledger-note")).not.toContainText("Local logs");
  const codexTrend = page.locator("[data-codex-usage]");
  await expect(codexTrend).toHaveAttribute("data-state", "ready");
  const codexDaily = page.getByRole("button", { name: "Daily", exact: true });
  const codexWeekly = page.getByRole("button", { name: "Weekly", exact: true });
  await expect(codexDaily).toBeEnabled();
  await expect(codexWeekly).toBeEnabled();
  await expect(codexDaily).toHaveAttribute("aria-pressed", "true");
  await expect(codexWeekly).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".github-activity-codex-readout")).not.toHaveAttribute("aria-live", /.+/);
  await expect(page.locator("[data-codex-table]")).toBeVisible();
  await expect(page.locator(".github-activity-codex-line")).toHaveCount(1);
  await expect(page.locator(".github-activity-codex-point")).toHaveCount(30);
  await expect(page.locator("#github-activity-codex-tokens")).toHaveText("582,688,404 tokens");
  await expect(page.locator("#github-activity-codex-cost")).toContainText("≈$489 through the public API");
  await expect(page.locator("#github-activity-codex-coverage")).toHaveText("Partial day");
  const codexInspector = page.locator(".github-activity-codex-inspector");
  const codexInspectorBox = await codexInspector.boundingBox();
  await page.mouse.move(codexInspectorBox.x + codexInspectorBox.width * (18 / 29), codexInspectorBox.y + codexInspectorBox.height * 0.45);
  await expect(page.locator("#github-activity-codex-tokens")).toHaveText("1,748,633,377 tokens");
  await codexInspector.evaluate((node) => {
    const box = node.getBoundingClientRect();
    node.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        isPrimary: true,
        pointerId: 904,
        pointerType: "touch",
        clientX: box.left + box.width * 0.5,
        clientY: box.top + box.height * 0.5,
        button: 0,
        buttons: 1,
      })
    );
  });
  await expect(codexInspector).toHaveAttribute("aria-valuenow", "15");
  await codexInspector.focus();
  const latestCodexDate = await page.locator("#github-activity-codex-date").textContent();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#github-activity-codex-date")).not.toHaveText(latestCodexDate);
  await expect(codexInspector).toHaveAttribute("aria-valuetext", /tokens, approximately \$.* through the public API/);
  await page.keyboard.press("End");
  await codexWeekly.click();
  await expect(codexWeekly).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".github-activity-codex-point")).toHaveCount(6);
  await expect(page.locator("#github-activity-codex-table-body tr")).toHaveCount(6);
  await expect(page.locator("#github-activity-codex-table-caption")).toContainText("Sunday-week");
  const weeklyInspector = page.locator(".github-activity-codex-inspector");
  await weeklyInspector.focus();
  await page.keyboard.press("Home");
  await expect(page.locator("#github-activity-codex-tokens")).toHaveText("6,055,884 tokens");
  await expect(page.locator("#github-activity-codex-coverage")).toHaveText("1 of 7 days · range starts here");
  await page.keyboard.press("End");
  await expect(page.locator("#github-activity-codex-coverage")).toHaveText("1 of 7 days · week in progress");
  await codexDaily.click();
  await expect(page.locator("#github-activity-codex-table-body tr")).toHaveCount(30);
  const rangeSummary = page.locator("#github-activity-range-summary");
  await page.getByRole("button", { name: "5 years" }).click();
  await expect(rangeSummary).toContainText("5 years");
  await expect(rangeSummary).toContainText(/[A-Z][a-z]{2} \d{1,2}, \d{4} — [A-Z][a-z]{2} \d{1,2}, \d{4}/);
  const fiveYearSummary = await rangeSummary.textContent();
  const hasCommitData = (await activity.getAttribute("data-has-commits")) === "true";
  const commitPath = page.locator(".github-activity-commit-line");
  const addPath = page.locator(".github-activity-add-line");
  const removePath = page.locator(".github-activity-remove-line");
  await expect(addPath).toHaveCount(1);
  await expect(removePath).toHaveCount(1);
  const addPathBeforeScaleChange = await addPath.getAttribute("d");
  const removePathBeforeScaleChange = await removePath.getAttribute("d");
  let commitPathBeforeScaleChange = null;
  if (hasCommitData) {
    await expect(page.locator("#github-activity-chart").getByText("COMMITS / WEEK · READABLE LOG1P", { exact: true })).toBeVisible();
    await expect(commitPath).toHaveCount(1);
    expect(await page.locator(".github-activity-commit-tick").count()).toBeGreaterThanOrEqual(4);
    commitPathBeforeScaleChange = await commitPath.getAttribute("d");
  }
  await expect(page.locator("#github-activity-chart").getByText("LINES CHANGED / WEEK · READABLE SYMLOG", { exact: true })).toBeVisible();

  const readable = page.getByRole("button", { name: "Readable" });
  const literal = page.getByRole("button", { name: "Literal" });
  await expect(readable).toHaveAttribute("aria-pressed", "true");
  const exactWeekBeforeScaleChange = await page.locator(".github-activity-values").textContent();
  await literal.click();
  await expect(literal).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#github-activity-chart").getByText("LINES CHANGED / WEEK · LITERAL LINEAR", { exact: true })).toBeVisible();
  if (hasCommitData) {
    await expect(page.locator("#github-activity-chart").getByText("COMMITS / WEEK · LITERAL LINEAR", { exact: true })).toBeVisible();
    expect(await commitPath.getAttribute("d")).not.toBe(commitPathBeforeScaleChange);
    expect(await page.locator(".github-activity-commit-tick").count()).toBeGreaterThanOrEqual(4);
  }
  expect(await addPath.getAttribute("d")).not.toBe(addPathBeforeScaleChange);
  expect(await removePath.getAttribute("d")).not.toBe(removePathBeforeScaleChange);
  await expect(page.locator(".github-activity-values")).toHaveText(exactWeekBeforeScaleChange);
  await readable.click();

  await page.getByRole("button", { name: "1 year" }).click();
  await expect(rangeSummary).toContainText("1 year");
  await expect(rangeSummary).not.toHaveText(fiveYearSummary);
  await expect(page.locator("#github-activity-overview")).toHaveCount(0);

  const selectedDate = page.locator("#github-activity-selected-date");
  const latest = await selectedDate.textContent();
  const inspector = page.locator(".github-activity-inspector");
  await inspector.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(selectedDate).not.toHaveText(latest);
  await expect(page.locator("#github-activity-chart")).toHaveClass(/is-keyboard-focused/);
  expect(await inspector.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("none");
  if (hasCommitData) {
    await expect(inspector).toHaveAttribute("aria-valuetext", /commits, .*added, .*removed/);
    await expect(page.locator("#github-activity-selected-commits")).toContainText("commits");
  } else {
    await expect(inspector).toHaveAttribute("aria-valuetext", /added, .*removed/);
    await expect(inspector).not.toHaveAttribute("aria-valuetext", /commits/);
    await expect(page.locator("#github-activity-selected-commits")).toBeHidden();
  }

  const box = await inspector.boundingBox();
  expect(box).not.toBeNull();
  const point = (ratio) => ({ x: box.x + box.width * ratio, y: box.y + box.height * 0.35 });
  const pinnedPoint = point(0.24);
  await page.mouse.click(pinnedPoint.x, pinnedPoint.y);
  const pinnedWeek = await selectedDate.textContent();
  expect(await inspector.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("none");
  const hoverPoint = point(0.7);
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  await expect(selectedDate).not.toHaveText(pinnedWeek);
  await page.mouse.move(2, 2);
  await expect(selectedDate).toHaveText(pinnedWeek);

  const dragStart = point(0.18);
  const dragEnd = point(0.43);
  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 8 });
  await page.mouse.up();
  const selectionBand = page.locator(".github-activity-selection-band");
  await expect(selectionBand).toHaveAttribute("visibility", "visible");
  await expect(rangeSummary).toContainText(/^Selected \d+ weeks/);
  const selectedSummary = await rangeSummary.textContent();
  const selectedTableRows = await page.locator("#github-activity-table-body tr").count();
  expect(selectedTableRows).toBeGreaterThan(1);
  expect(selectedTableRows).toBeLessThan(60);
  await page.mouse.move(point(0.82).x, point(0.82).y);
  await expect(rangeSummary).toHaveText(selectedSummary);
  await expect(page.getByRole("button", { name: "Clear selection" })).toBeVisible();
  expect(await page.locator("#github-activity-tier-table-body tr").count()).toBeLessThanOrEqual(3);
  await inspector.evaluate((overlay) => {
    const rect = overlay.getBoundingClientRect();
    const originalCapture = overlay.setPointerCapture;
    const originalHasCapture = overlay.hasPointerCapture;
    const originalRelease = overlay.releasePointerCapture;
    overlay.setPointerCapture = () => {};
    overlay.hasPointerCapture = () => false;
    overlay.releasePointerCapture = () => {};
    const dispatch = (type, x, y, pointerId, buttons) =>
      overlay.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          isPrimary: true,
          pointerId,
          pointerType: "touch",
          button: type === "pointerdown" ? 0 : -1,
          buttons,
          clientX: x,
          clientY: y,
        })
      );

    const startX = rect.left + rect.width * 0.56;
    const startY = rect.top + rect.height * 0.25;
    dispatch("pointerdown", startX, startY, 901, 1);
    dispatch("pointermove", startX + 2, startY + 42, 901, 1);

    overlay.setPointerCapture = originalCapture;
    overlay.hasPointerCapture = originalHasCapture;
    overlay.releasePointerCapture = originalRelease;
  });
  await expect(rangeSummary).toHaveText(selectedSummary);
  await expect(selectionBand).toHaveAttribute("visibility", "visible");
  await expect(page.locator("#github-activity-chart")).not.toHaveClass(/is-selecting/);
  await inspector.evaluate((overlay) => {
    const rect = overlay.getBoundingClientRect();
    const originalCapture = overlay.setPointerCapture;
    const originalHasCapture = overlay.hasPointerCapture;
    const originalRelease = overlay.releasePointerCapture;
    overlay.setPointerCapture = () => {};
    overlay.hasPointerCapture = () => false;
    overlay.releasePointerCapture = () => {};
    const dispatch = (type, x, y, buttons) =>
      overlay.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          isPrimary: true,
          pointerId: 902,
          pointerType: "touch",
          button: type === "pointerdown" ? 0 : -1,
          buttons,
          clientX: x,
          clientY: y,
        })
      );
    const startX = rect.left + rect.width * 0.56;
    const startY = rect.top + rect.height * 0.25;
    dispatch("pointerdown", startX, startY, 1);
    dispatch("pointermove", startX + 90, startY + 2, 1);
    overlay.setPointerCapture = originalCapture;
    overlay.hasPointerCapture = originalHasCapture;
    overlay.releasePointerCapture = originalRelease;
  });
  await expect(rangeSummary).not.toHaveText(selectedSummary);
  await expect(page.locator("#github-activity-chart")).toHaveClass(/is-selecting/);
  await inspector.evaluate((overlay) => {
    const rect = overlay.getBoundingClientRect();
    overlay.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        cancelable: true,
        isPrimary: true,
        pointerId: 902,
        pointerType: "touch",
        button: -1,
        buttons: 0,
        clientX: rect.left + rect.width * 0.56 + 90,
        clientY: rect.top + rect.height * 0.25 + 2,
      })
    );
  });
  await expect(rangeSummary).toHaveText(selectedSummary);
  await expect(selectionBand).toHaveAttribute("visibility", "visible");
  await expect(page.locator("#github-activity-chart")).not.toHaveClass(/is-selecting/);
  const replacementPin = point(0.62);
  await page.mouse.click(replacementPin.x, replacementPin.y);
  await expect(selectionBand).toHaveAttribute("visibility", "hidden");
  await expect(rangeSummary).not.toContainText(/^Selected/);

  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 8 });
  await page.mouse.up();
  await expect(selectionBand).toHaveAttribute("visibility", "visible");
  await inspector.focus();
  await page.keyboard.press("Escape");
  await expect(selectionBand).toHaveAttribute("visibility", "hidden");
  await expect(page.getByRole("button", { name: "Clear selection" })).toBeHidden();
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(selectionBand).toHaveAttribute("visibility", "visible");
  await expect(rangeSummary).toContainText(/^Selected 2 weeks/);
  await page.getByRole("button", { name: "Clear selection" }).click();

  await expect(activity).toHaveAttribute("data-has-tier-context", "true");
  await expect(page.locator("#github-activity-selected-tier")).toContainText(/^Plan ·/);
  const tierLegend = page.locator(".github-activity-tier-legend");
  await expect(tierLegend).toBeVisible();
  await expect(tierLegend.locator("li")).toHaveCount(3);
  await expect(tierLegend).toContainText("$20");
  await expect(tierLegend).toContainText("$100");
  await expect(tierLegend).toContainText("$200");
  await expect(tierLegend).not.toContainText("/mo");
  const tierIntensity = await tierLegend.evaluate((legend) => {
    const sample = (value) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
    };
    const surface = sample(getComputedStyle(document.querySelector("[data-github-activity]")).getPropertyValue("--global-surface-color"));
    return Array.from(legend.querySelectorAll(".github-activity-tier-swatch")).map((swatch) => {
      const color = sample(getComputedStyle(swatch).backgroundColor);
      return Math.hypot(...color.map((channel, index) => channel - surface[index]));
    });
  });
  expect(tierIntensity[0]).toBeLessThan(tierIntensity[1]);
  expect(tierIntensity[1]).toBeLessThan(tierIntensity[2]);
  await expect(page.locator("#github-activity-tier-table-body tr")).toHaveCount(3);
  await expect(page.locator("#github-activity-chart")).toHaveCSS("touch-action", "pan-y");

  for (const windowName of ["3 years", "5 years", "All"]) {
    await page.getByRole("button", { name: windowName, exact: true }).click();
    await expect(page.locator("#github-activity-tier-caption")).toContainText("current time window");
    await expect(page.locator("#github-activity-tier-table-body tr")).toHaveCount(3);
  }
  const ribbonState = await page.evaluate(() => {
    const activityData = JSON.parse(document.getElementById("github-activity-data").textContent);
    const tierData = JSON.parse(document.getElementById("github-activity-ai-tiers").textContent);
    const day = 86_400_000;
    const halfWeek = 3.5 * day;
    const assigned = activityData.weeks.map((row) => {
      const date = new Date(`${row.week}T00:00:00Z`);
      const midpoint = new Date(date.getTime() + 3 * day).toISOString().slice(0, 10);
      const tier = tierData.phases.find((phase) => midpoint >= phase.start && (phase.end == null || midpoint <= phase.end));
      return { ...row, date, tier: tier || null };
    });
    const expectedRuns = assigned.reduce((runs, row, index) => {
      const key = row.tier?.key ?? null;
      const previous = runs.at(-1);
      const priorRow = assigned[index - 1];
      const adjacent = !priorRow || row.date.getTime() - priorRow.date.getTime() === 7 * day;
      if (!previous || previous.key !== key || !adjacent) runs.push({ key, tier: row.tier, first: row, last: row });
      else previous.last = row;
      return runs;
    }, []);
    const track = document.querySelector(".github-activity-tier-track");
    const trackX = Number(track.getAttribute("x"));
    const trackWidth = Number(track.getAttribute("width"));
    const start = assigned[0].date.getTime();
    const end = assigned.at(-1).date.getTime();
    const x = (value) => trackX + ((value - start) / (end - start)) * trackWidth;
    const expected = expectedRuns
      .filter((run) => run.tier)
      .map((run) => {
        const x1 = x(Math.max(start, run.first.date.getTime() - halfWeek));
        const x2 = x(Math.min(end, run.last.date.getTime() + halfWeek));
        return {
          key: run.key,
          first: run.first.week,
          last: run.last.week,
          x: x1,
          width: Math.max(1, x2 - x1),
        };
      });
    const actual = Array.from(document.querySelectorAll(".github-activity-tier-run")).map((run) => ({
      key: run.dataset.tierKey,
      first: run.dataset.firstWeek,
      last: run.dataset.lastWeek,
      x: Number(run.getAttribute("x")),
      width: Number(run.getAttribute("width")),
    }));
    return { expected, actual, directLabels: document.querySelectorAll(".github-activity-tier-label").length };
  });
  expect(ribbonState.actual).toHaveLength(ribbonState.expected.length);
  ribbonState.expected.forEach((expectedRun, index) => {
    const actualRun = ribbonState.actual[index];
    expect(actualRun.key).toBe(expectedRun.key);
    expect(actualRun.first).toBe(expectedRun.first);
    expect(actualRun.last).toBe(expectedRun.last);
    expect(actualRun.x).toBeCloseTo(expectedRun.x, 3);
    expect(actualRun.width).toBeCloseTo(expectedRun.width, 3);
  });
  expect(ribbonState.directLabels).toBeLessThan(ribbonState.actual.length);
  const directTierLabels = await page.locator(".github-activity-tier-label").allTextContents();
  expect(directTierLabels.length).toBeGreaterThan(0);
  expect(directTierLabels.every((label) => ["$20", "$100", "$200"].includes(label))).toBe(true);
  expect(directTierLabels.every((label) => !label.includes("/mo"))).toBe(true);
  const tierHits = page.locator(".github-activity-tier-hit");
  await expect(tierHits).toHaveCount(ribbonState.actual.length);
  const hitGeometry = await tierHits.evaluateAll((nodes) =>
    nodes.map((node) => ({
      x: Number(node.getAttribute("x")),
      width: Number(node.getAttribute("width")),
      height: Number(node.getAttribute("height")),
      hasTitle: Boolean(node.querySelector("title")),
    }))
  );
  expect(hitGeometry.every((hit) => hit.width >= 1 && hit.height >= 24 && hit.hasTitle)).toBe(true);
  hitGeometry.slice(1).forEach((hit, index) => {
    const previous = hitGeometry[index];
    expect(previous.x + previous.width).toBeLessThanOrEqual(hit.x + 0.001);
  });
  const legendButtons = page.locator(".github-activity-tier-legend-button");
  await expect(legendButtons).toHaveCount(3);
  expect(
    await legendButtons.evaluateAll((nodes) =>
      nodes.every((node) => {
        const box = node.getBoundingClientRect();
        return box.width >= 24 && box.height >= 24;
      })
    )
  ).toBe(true);
  const legendHundred = page.locator('[data-tier-inspector="100"]');
  await legendHundred.click();
  await expect(page.locator("#github-activity-selected-tier")).toContainText("Plan · $100/mo · May 5, 2026 — Jun 5, 2026");
  const legendTwoHundred = page.locator('[data-tier-inspector="200"]');
  await legendTwoHundred.focus();
  await expect(page.locator("#github-activity-selected-tier")).toContainText("Mar 5, 2026 — May 4, 2026; since Jun 6, 2026");
  const hundredHit = page.locator('.github-activity-tier-hit[data-tier-key="tier-100"]');
  await hundredHit.hover();
  await expect(page.locator("#github-activity-selected-tier")).toContainText("Plan · $100/mo · May 5, 2026 — Jun 5, 2026");
  const latestTwoHundredHit = page.locator('.github-activity-tier-hit[data-tier-key="tier-200-b"]');
  await latestTwoHundredHit.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#github-activity-selected-tier")).toContainText("Plan · $200/mo · since Jun 6, 2026");
  await expect(latestTwoHundredHit).toHaveAttribute("aria-label", /Plan \$200\/mo · since Jun 6, 2026/);
  await hundredHit.evaluate((node) => {
    node.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        isPrimary: true,
        pointerId: 903,
        pointerType: "touch",
        button: 0,
        buttons: 1,
      })
    );
  });
  await expect(page.locator("#github-activity-selected-tier")).toContainText("$100/mo");
  await expect(page.locator("#github-activity-tier-table-body tr")).toHaveCount(3);
  const expectedTwoHundredMedian = await page.evaluate(() => {
    const activityData = JSON.parse(document.getElementById("github-activity-data").textContent);
    const tierData = JSON.parse(document.getElementById("github-activity-ai-tiers").textContent);
    const day = 86_400_000;
    const active = activityData.weeks.filter((row) => {
      if (!(row.commits || row.additions || row.deletions)) return false;
      const midpoint = new Date(new Date(`${row.week}T00:00:00Z`).getTime() + 3 * day).toISOString().slice(0, 10);
      return tierData.phases.some((phase) => phase.tier_usd === 200 && midpoint >= phase.start && (phase.end == null || midpoint <= phase.end));
    });
    const median = (values) => {
      const ordered = [...values].sort((a, b) => a - b);
      const middle = Math.floor(ordered.length / 2);
      return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
    };
    return {
      commits: new Intl.NumberFormat("en-US").format(median(active.map((row) => row.commits))),
      lines: new Intl.NumberFormat("en-US").format(median(active.map((row) => row.additions + row.deletions))),
    };
  });
  const twoHundredRow = page.locator("#github-activity-tier-table-body tr", { hasText: "$200/mo" });
  await expect(twoHundredRow.locator("td").nth(1)).toHaveText(expectedTwoHundredMedian.commits);
  await expect(twoHundredRow.locator("td").nth(2)).toHaveText(expectedTwoHundredMedian.lines);

  const inactiveRun = await page.evaluate(() => {
    const activityData = JSON.parse(document.getElementById("github-activity-data").textContent);
    const tierData = JSON.parse(document.getElementById("github-activity-ai-tiers").textContent);
    const day = 86_400_000;
    const tierForWeek = (week) => {
      const midpoint = new Date(new Date(`${week}T00:00:00Z`).getTime() + 3 * day).toISOString().slice(0, 10);
      return tierData.phases.find((phase) => midpoint >= phase.start && (phase.end == null || midpoint <= phase.end));
    };
    const runs = [];
    let start = null;
    activityData.weeks.forEach((row, index) => {
      const inactive = row.commits === 0 && row.additions === 0 && row.deletions === 0 && Boolean(tierForWeek(row.week));
      if (inactive && start == null) start = index;
      if (start != null && (!inactive || index === activityData.weeks.length - 1)) {
        const end = inactive && index === activityData.weeks.length - 1 ? index : index - 1;
        if (end - start >= 2) runs.push({ start, end });
        start = null;
      }
    });
    const run = runs.sort((a, b) => b.end - b.start - (a.end - a.start))[0];
    const first = new Date(`${activityData.weeks[0].week}T00:00:00Z`).getTime();
    const last = new Date(`${activityData.weeks.at(-1).week}T00:00:00Z`).getTime();
    const ratio = (index) => (new Date(`${activityData.weeks[index].week}T00:00:00Z`).getTime() - first) / (last - first);
    return { startRatio: ratio(run.start), endRatio: ratio(run.end), weeks: run.end - run.start + 1 };
  });
  const inactiveInspector = page.locator(".github-activity-inspector");
  const inactiveBox = await inactiveInspector.boundingBox();
  await page.mouse.move(inactiveBox.x + inactiveBox.width * inactiveRun.startRatio, inactiveBox.y + inactiveBox.height * 0.32);
  await page.mouse.down();
  await page.mouse.move(inactiveBox.x + inactiveBox.width * inactiveRun.endRatio, inactiveBox.y + inactiveBox.height * 0.32, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(rangeSummary).toContainText(`Selected ${inactiveRun.weeks} weeks`);
  await expect(rangeSummary).toContainText("0 active weeks");
  await expect(page.locator("#github-activity-annotation")).toHaveText("No active weeks in this scope. Median active-week line magnitude · —.");
  const inactiveTierRow = page.locator("#github-activity-tier-table-body tr");
  await expect(inactiveTierRow).toHaveCount(1);
  await expect(inactiveTierRow).toContainText(`0 / ${inactiveRun.weeks}`);
  const inactiveTierCells = inactiveTierRow.locator("td");
  await expect(inactiveTierCells).toHaveCount(3);
  await expect(inactiveTierCells.nth(1)).toHaveText("—");
  await expect(inactiveTierCells.nth(2)).toHaveText("—");
  await page.getByRole("button", { name: "Clear selection" }).click();

  const allInspector = page.locator(".github-activity-inspector");
  const allBox = await allInspector.boundingBox();
  const earlyStart = { x: allBox.x + allBox.width * 0.01, y: allBox.y + allBox.height * 0.32 };
  const earlyEnd = { x: allBox.x + allBox.width * 0.09, y: allBox.y + allBox.height * 0.32 };
  await page.mouse.move(earlyStart.x, earlyStart.y);
  await page.mouse.down();
  await page.mouse.move(earlyEnd.x, earlyEnd.y, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator("#github-activity-tier-table-body")).toContainText("No tracked plan price overlaps this scope.");
  await page.getByRole("button", { name: "Clear selection" }).click();

  await page.getByText("How this view works", { exact: true }).click();
  await expect(page.locator("#github-activity-table-body tr").first()).toBeVisible();
  expect(await page.locator("#github-activity-table-body tr").count()).toBeGreaterThan(40);
});

test("home agentic heartbeat uses the account lifetime and real daily sparkline", async ({ page }) => {
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/al-folio/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const heartbeat = page.locator(".home-agentic-heartbeat");
  await heartbeat.scrollIntoViewIfNeeded();
  await expect(heartbeat).toBeVisible();
  await expect(heartbeat).toHaveAttribute("href", "/al-folio/github-activity/");
  await expect(heartbeat).toContainText("20.9B Codex tokens");
  await expect(heartbeat).toContainText("~$17.5K if priced through the public API");
  await expect(heartbeat).toContainText("3110 GitHub commits");
  const sparkline = heartbeat.locator(".home-agentic-heartbeat-sparkline polyline");
  await expect(sparkline).toHaveCount(1);
  expect((await sparkline.getAttribute("points")).trim().split(/\s+/)).toHaveLength(30);
  const heartbeatFrame = await heartbeat.evaluate((node) => {
    const style = getComputedStyle(node);
    return { borderTopWidth: style.borderTopWidth, backgroundColor: style.backgroundColor, minHeight: style.minHeight };
  });
  expect(heartbeatFrame.borderTopWidth).toBe("0px");
  expect(heartbeatFrame.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(Number.parseFloat(heartbeatFrame.minHeight)).toBeGreaterThanOrEqual(44);
  const pulseMotion = await heartbeat.locator(".home-agentic-heartbeat-pulse").evaluate((node) => {
    const style = getComputedStyle(node);
    return { animationName: style.animationName, animationDuration: style.animationDuration };
  });
  expect(pulseMotion.animationName).toBe("none");
  expect(pulseMotion.animationDuration).toBe("0s");
  expect(await sparkline.evaluate((node) => getComputedStyle(node).transitionDuration)).toBe("0s");
});

test("publications Abs toggle opens and closes", async ({ page }) => {
  await preparePage(page, "light");
  await page.goto("/al-folio/publications/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const absButton = page.getByRole("button", { name: "Abs" }).first();
  await expect(absButton).toBeVisible();

  const panel = page.locator(".abstract.hidden").first();
  await absButton.click();
  await expect(panel).toHaveClass(/open/);

  await absButton.click();
  await expect(panel).not.toHaveClass(/open/);
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
  await page.goto("/al-folio/repositories/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const repoImages = page.locator('img[src*="github-readme-stats"], img[src*="github-profile-trophy"]');
  await expect(repoImages.first()).toBeVisible();

  const renderedCount = await repoImages.evaluateAll((images) => images.filter((img) => img.complete && img.naturalWidth > 0).length);
  expect(renderedCount).toBeGreaterThan(0);
});

test("blog pagination uses core Tailwind-native styling contract", async ({ page }) => {
  await preparePage(page, "light");
  await page.goto("/al-folio/blog/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const pagination = page.locator(".af-pagination");
  await expect(pagination.first()).toBeVisible();

  const pageLink = page.locator(".af-page-link").first();
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

test("home profile bubbles hover independently", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "hover-specific assertion is desktop-only");

  await preparePage(page, "light");
  await page.goto("/al-folio/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const secondary = page.locator(".home-media-card-secondary");
  const primary = page.locator(".home-media-card-primary");
  await expect(secondary).toBeVisible();
  await expect(primary).toBeVisible();

  const readCardStyles = async (card) =>
    card.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        animationPlayState: computed.animationPlayState,
        backgroundColor: computed.backgroundColor,
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

  expect(secondaryHovered.animationPlayState).toBe("paused");
  expect(primaryWhileSecondaryHovered.animationPlayState).not.toBe("paused");
  expect(secondaryHovered.backgroundColor).not.toBe(secondaryRest.backgroundColor);
  expect(secondaryHovered.borderColor).not.toBe(secondaryRest.borderColor);
  expect(secondaryHovered.boxShadow).not.toBe(secondaryRest.boxShadow);
  expect(primaryWhileSecondaryHovered.backgroundColor).toBe(primaryRest.backgroundColor);
  expect(primaryWhileSecondaryHovered.borderColor).toBe(primaryRest.borderColor);

  await primary.hover();
  await page.waitForTimeout(320);
  const primaryHovered = await readCardStyles(primary);
  const secondaryWhilePrimaryHovered = await readCardStyles(secondary);

  expect(primaryHovered.animationPlayState).toBe("paused");
  expect(secondaryWhilePrimaryHovered.animationPlayState).not.toBe("paused");
  expect(primaryHovered.backgroundColor).not.toBe(primaryRest.backgroundColor);
  expect(primaryHovered.borderColor).not.toBe(primaryRest.borderColor);
  expect(primaryHovered.boxShadow).not.toBe(primaryRest.boxShadow);
  expect(secondaryWhilePrimaryHovered.backgroundColor).toBe(secondaryRest.backgroundColor);
  expect(secondaryWhilePrimaryHovered.borderColor).toBe(secondaryRest.borderColor);
});

test("home dropped meme record cards resolve into separate 2D lanes", async ({ page }) => {
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

  const maxOverlapRatio = await cards.evaluateAll((cards) => {
    const rects = cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        area: rect.width * rect.height,
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

    return maxRatio;
  });

  expect(maxOverlapRatio).toBeLessThan(0.08);

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
  await firstCard.locator(".home-record-card-eyebrow").click();
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

  await clickDeskCanvasAt(page, 0.78, 0.34);
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

  await clickDeskCanvasAt(page, 0.5, 0.46);
  await page.waitForTimeout(240);
  await expect(page.locator("html")).not.toHaveClass(/home-desk-outside-active/);
  await expect(scene).not.toHaveClass(/is-outside-view/);

  await clickDeskCanvasAt(page, 0.78, 0.34);
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

  await page.click('[data-home-desk-control="previous"]');
  await expect(stage).toHaveAttribute("data-record-tone", "jude");

  await clickDeskCanvasAt(page, 0.24, 0.36);
  await page.waitForTimeout(420);
  await expect(stage).toHaveAttribute("data-record-tone", "jude");
  await expect(scene).not.toHaveAttribute("data-focused-desk-object", "album-0");

  await clickDeskCanvasAt(page, 0.36, 0.34);
  await page.waitForTimeout(620);
  await expect(stage).toHaveAttribute("data-record-tone", "jude");
  await expect(scene).toHaveAttribute("data-focused-desk-object", "album-2");

  await clickDeskCanvasAt(page, 0.5, 0.88);
  await page.waitForTimeout(1120);
  await expect(stage).toHaveAttribute("data-record-tone", "wind");
  await expect(scene).not.toHaveAttribute("data-focused-desk-object", /album-/);
  await page.waitForTimeout(900);

  await dragDeskCanvasAt(page, 0.36, 0.34, 0.2, 0.61);
  await page.waitForTimeout(920);
  await expect(stage).toHaveAttribute("data-dropped-records", "0,1,2");
  await expect(scene).not.toHaveAttribute("data-focused-desk-object", /album-/);

  await clickDeskCanvasAt(page, 0.4, 0.28, { hoverMs: 180 });
  await page.waitForTimeout(620);
  await expect(stage).toHaveAttribute("data-record-tone", "wind");
  await expect(scene).toHaveAttribute("data-focused-desk-object", "album-3");

  await clickDeskCanvasAt(page, 0.5, 0.88);
  await page.waitForTimeout(1120);
  await expect(stage).toHaveAttribute("data-record-tone", "sunday");
  await expect(page.locator('[data-home-desk-control="spin"]')).toHaveAttribute("aria-pressed", "true");
  await expect(scene).not.toHaveAttribute("data-focused-desk-object", /album-/);
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
  await page.goto("/al-folio/blog/2023/tables/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

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
  await page.goto("/al-folio/blog/2023/sidebar-table-of-contents/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

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

test("teaching calendar toggle has pointer cursor and toggles calendar visibility", async ({ page }) => {
  await preparePage(page, "light");
  await page.goto("/al-folio/teaching/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

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
  await page.goto("/al-folio/blog/2023/sidebar-table-of-contents/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

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
  await page.goto("/al-folio/blog/2023/tables/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

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
  await page.goto("/al-folio/blog/2024/photo-gallery/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

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
