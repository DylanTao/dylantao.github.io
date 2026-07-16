const { test, expect } = require("@playwright/test");
const { collectRuntimeErrors, preparePage, stabilizeVisuals } = require("./helpers");
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

test("Codex activity fails closed when its public data is unavailable", async ({ page }) => {
  await preparePage(page, "light");
  await page.route("**/assets/data/codex-profile-usage.json", (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
  await page.goto("/al-folio/github-activity/", { waitUntil: "networkidle" });

  const codexTrend = page.locator("[data-codex-usage]");
  await expect(codexTrend).toHaveAttribute("data-state", "error");
  await expect(codexTrend).toHaveAttribute("aria-busy", "false");
  await expect(codexTrend.locator("[data-codex-status]")).toHaveText(
    "Direct Codex tracker is unavailable; the last rendered page does not substitute data."
  );
  await expect(page.getByRole("button", { name: "Daily", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Weekly", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-codex-table]")).toHaveCount(0);
  await expect(page.locator(".github-activity-codex-point")).toHaveCount(0);
  await expect(page.locator(".github-activity-codex-readout")).not.toContainText("complete 2-of-2");
  await expect(page.locator(".github-activity-codex-readout")).not.toHaveAttribute("aria-live", /.+/);
});

test("usage story keeps direct quota health and GitHub measures independent and accessible", async ({ page }) => {
  await preparePage(page, "light");
  await page.route("**/assets/data/codex-profile-usage.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schema: 2,
        accountCount: 2,
        healthyAccountCount: 2,
        freshAccountCount: 2,
        accountsWithQuotaData: 2,
        accountsAtLimit: null,
        units: { accounts: "count", health: "count", freshness: "utc_timestamp" },
        method: "codex_app_server_rate_limits_non_additive_no_model_turns",
        coverage: { complete: true, requiredAccountCount: 2, healthyAccountCount: 2 },
        confidence: "direct complete observation",
        updated_at: "2026-07-16T18:55:00Z",
        personalRoundedLifetimeBaseline: {
          token_count: 20900000000,
          tokens_label: "20.9B",
          units: "tokens",
          method: "manual_rounded_profile_baseline",
          coverage: "1 of 2 accounts",
          aggregation: "non_additive",
          captured_at: "2026-07-12T18:40:36.572451Z",
        },
      }),
    })
  );
  await page.goto("/al-folio/github-activity/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const activity = page.locator("[data-github-activity]");
  const codexTrend = page.locator("[data-codex-usage]");
  await expect(activity).toHaveAttribute("data-state", "ready");
  await expect(codexTrend).toHaveAttribute("data-state", "ready");
  await expect(page.locator(".github-activity-eyebrow")).toHaveText("REPO TOKEN RHYTHM + DIRECT CODEX HEALTH + GITHUB BUILD RHYTHM");
  await expect(page.locator(".github-activity-codex-ledger div")).toHaveCount(4);
  await expect(page.locator("#github-activity-codex-cost")).toHaveCount(0);
  await expect(page.locator("#github-activity-selected-additions")).toHaveText(/^\+[\d,]+ added$/);
  await expect(page.locator("#github-activity-selected-deletions")).toHaveText(/^\u2212[\d,]+ removed$/);
  await expect(page.locator("#github-activity-selected-tier")).toHaveCount(0);
  await expect(page.locator("#github-activity-ai-tiers")).toHaveCount(0);
  await expect(page.locator(".github-activity-add-line")).toHaveCount(1);
  await expect(page.locator(".github-activity-remove-line")).toHaveCount(1);
  await expect(page.locator(".github-activity-tier-run")).toHaveCount(0);
  await expect(activity).not.toContainText(/agent-hours|kWh|trees?|public-API|plan price|\$20|\$100|\$200/i);

  const codexScope = page.locator("[data-codex-scope]");
  const githubScope = page.locator("[data-github-scope]");
  await expect(codexScope).toHaveText("2 ACCOUNTS · NON-ADDITIVE");
  await expect(githubScope).toHaveText("5 YEARS · WEEKLY");
  await expect(page.locator("[data-codex-healthy]")).toHaveText("2/2");
  await expect(page.locator("[data-codex-fresh]")).toHaveText("2/2");
  await expect(page.locator("[data-codex-quota]")).toHaveText("2/2");
  await expect(codexTrend.locator("[data-codex-status]")).toContainText("Complete 2-of-2 observation");
  await expect(codexTrend).toContainText("20.9B");
  await expect(codexTrend).toContainText("1 of 2 accounts");
  await expect(codexTrend).toContainText(
    "No direct-account aliases, identifiers, plans, raw percentages, reset times, exact usage, daily histories, or API-cost conversions are published."
  );
  await expect(codexTrend).not.toContainText(/combined lifetime|resets? (?:at|in)|API-cost estimate/i);

  const commitPath = page.locator(".github-activity-commit-line");
  const addPath = page.locator(".github-activity-add-line");
  const removePath = page.locator(".github-activity-remove-line");
  const rangeSummary = page.locator("#github-activity-range-summary");
  await expect(commitPath).toHaveCount(1);
  await expect(page.locator("#github-activity-chart").getByText("COMMITS / WEEK · READABLE LOG1P", { exact: true })).toBeVisible();
  const compactActivityChart = (page.viewportSize()?.width ?? 0) < 620;
  const readableLineHeading = compactActivityChart ? "LINES / WEEK · SYMLOG" : "LINES CHANGED / WEEK · READABLE SYMLOG";
  await expect(page.locator("#github-activity-chart").getByText(readableLineHeading, { exact: true })).toBeVisible();
  await expect(rangeSummary).toContainText("5 years");
  await expect(rangeSummary).toContainText("commits");
  const positiveLineTickY = await page
    .locator(".github-activity-line-tick.is-positive")
    .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("y"))).sort((a, b) => a - b));
  const negativeLineTickCount = await page.locator(".github-activity-line-tick.is-negative").count();
  expect(positiveLineTickY.length).toBeGreaterThan(2);
  expect(negativeLineTickCount).toBe(positiveLineTickY.length);
  const minimumTickGap = (page.viewportSize()?.width ?? 0) < 620 ? 15 : 18;
  positiveLineTickY.slice(1).forEach((position, index) => {
    expect(position - positiveLineTickY[index]).toBeGreaterThanOrEqual(minimumTickGap - 0.01);
  });
  const readablePath = await commitPath.getAttribute("d");
  const readableAddPath = await addPath.getAttribute("d");
  const readableRemovePath = await removePath.getAttribute("d");
  const selectedValue = await page.locator("#github-activity-selected-commits").textContent();
  await page.getByRole("button", { name: "Literal", exact: true }).click();
  await expect(page.locator("#github-activity-chart").getByText("COMMITS / WEEK · LITERAL LINEAR", { exact: true })).toBeVisible();
  const literalLineHeading = compactActivityChart ? "LINES / WEEK · LINEAR" : "LINES CHANGED / WEEK · LITERAL LINEAR";
  await expect(page.locator("#github-activity-chart").getByText(literalLineHeading, { exact: true })).toBeVisible();
  expect(await commitPath.getAttribute("d")).not.toBe(readablePath);
  expect(await addPath.getAttribute("d")).not.toBe(readableAddPath);
  expect(await removePath.getAttribute("d")).not.toBe(readableRemovePath);
  await expect(page.locator("#github-activity-selected-commits")).toHaveText(selectedValue);

  await page.getByRole("button", { name: "1 year", exact: true }).click();
  await expect(githubScope).toHaveText("1 YEAR · WEEKLY");
  await expect(codexScope).toHaveText("2 ACCOUNTS · NON-ADDITIVE");
  const inspector = page.locator(".github-activity-inspector");
  await inspector.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(inspector).toHaveAttribute("aria-valuetext", /Week of \d{4}-\d{2}-\d{2}, [\d,]+ commits, \+[\d,]+ added, \u2212[\d,]+ removed/);
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(page.locator(".github-activity-selection-band")).toHaveAttribute("visibility", "visible");
  await expect(rangeSummary).toContainText(/^Selected 2 weeks/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".github-activity-selection-band")).toHaveAttribute("visibility", "hidden");

  const lineChangeSemantics = await page.evaluate(() => {
    const source = JSON.parse(document.getElementById("github-activity-data").textContent);
    const rows = source.weeks.map((row) => ({ ...row, date: new Date(`${row.week}T00:00:00Z`) }));
    const end = rows.at(-1).date;
    const cutoff = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate()));
    const active = rows.filter((row) => row.date >= cutoff && (row.commits || row.additions || row.deletions));
    const changes = (row) => row.additions + row.deletions;
    const largest = active.reduce((best, row) => (changes(row) > changes(best) ? row : best));
    const ordered = active.map(changes).sort((a, b) => a - b);
    const position = (ordered.length - 1) * 0.5;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const median = lower === upper ? ordered[lower] : ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower);
    const latest = rows.at(-1);
    return {
      largestDate: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(largest.date),
      largestAdded: new Intl.NumberFormat("en-US").format(largest.additions),
      largestRemoved: new Intl.NumberFormat("en-US").format(largest.deletions),
      median: new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(median),
      latestChanges: new Intl.NumberFormat("en-US").format(changes(latest)),
    };
  });
  const annotation = page.locator("#github-activity-annotation");
  await expect(annotation).toContainText(
    `Largest line-change week · ${lineChangeSemantics.largestDate} · +${lineChangeSemantics.largestAdded} / −${lineChangeSemantics.largestRemoved}`
  );
  await expect(annotation).toContainText(`Median active-week line magnitude · ${lineChangeSemantics.median}`);

  await page.getByText("How this view works", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Three bounded sources" })).toBeVisible();
  const commitCells = page.locator("#github-activity-table-body tr").first().locator("th, td");
  await expect(page.locator("#github-activity-codex-table-body")).toHaveCount(0);
  await expect(commitCells).toHaveCount(5);
  await expect(page.locator("#github-activity-table-caption")).toContainText("Reported weekly activity");
  await expect(page.getByRole("columnheader", { name: "Line changes" })).toBeVisible();
  await expect(commitCells.nth(4)).toHaveText(lineChangeSemantics.latestChanges);
  expect(await page.locator("#github-activity-table-body tr").count()).toBeGreaterThan(40);
});

test("GitHub line-change labels meet contrast in every light theme", async ({ page }) => {
  await preparePage(page, "light");
  await page.goto("/al-folio/github-activity/", { waitUntil: "networkidle" });
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

test("home agentic heartbeat shows the separate rounded checkpoint and tracker coverage", async ({ page }) => {
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/al-folio/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const heartbeat = page.locator(".home-agentic-heartbeat");
  await heartbeat.scrollIntoViewIfNeeded();
  await expect(heartbeat).toBeVisible();
  await expect(heartbeat).toHaveAttribute("href", "/al-folio/github-activity/");
  await expect(heartbeat).toContainText("20.9B Personal rounded checkpoint");
  await expect(heartbeat).toContainText("direct 2-account health pending");
  await expect(heartbeat).toContainText("2-account quota health");
  await expect(heartbeat).toContainText(/\d+ GitHub commits/);
  await expect(heartbeat).not.toContainText(/\$|public API|cost/i);
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
  await expect(tally).not.toContainText(/trees?|invoice|cost/i);
  await expect(tally.locator("#home-agentic-tooltip")).toContainText("The commit count is exact from this repository's Git history.");
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
  await expect(firstGuide.getByRole("link", { name: "Full citation context" })).toBeVisible();
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
  expect(fanGeometry.maxRatio).toBeLessThan(0.9);
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
