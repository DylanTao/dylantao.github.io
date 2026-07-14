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

async function clickDeskProjectedTarget(page, scene, boundsAttribute) {
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
      const evidence = JSON.parse((await scene.getAttribute("data-album-screen-bounds")) || "[]");
      return Boolean(evidence.find((entry) => entry.index === index)?.[targetKey]);
    })
    .toBe(true);
  const evidence = JSON.parse((await scene.getAttribute("data-album-screen-bounds")) || "[]");
  return evidence.find((entry) => entry.index === index)?.[targetKey] || null;
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
  await expect(codexTrend.locator("[data-codex-status]")).toHaveText("Recent Codex token data is unavailable.");
  await expect(page.getByRole("button", { name: "Daily", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Weekly", exact: true })).toBeDisabled();
  await expect(page.locator("#github-activity-codex-tokens")).toBeHidden();
  await expect(page.locator("[data-codex-table]")).toBeHidden();
  await expect(page.locator(".github-activity-codex-point")).toHaveCount(0);
  await expect(page.locator(".github-activity-codex-readout")).not.toContainText("0 tokens");
  await expect(page.locator(".github-activity-codex-readout")).not.toHaveAttribute("aria-live", /.+/);
});

test("usage story exposes only tokens and commits with independent accessible views", async ({ page }) => {
  await preparePage(page, "light");
  await page.goto("/al-folio/github-activity/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const activity = page.locator("[data-github-activity]");
  const codexTrend = page.locator("[data-codex-usage]");
  await expect(activity).toHaveAttribute("data-state", "ready");
  await expect(codexTrend).toHaveAttribute("data-state", "ready");
  await expect(page.locator(".github-activity-eyebrow")).toHaveText("CODEX TOKENS + GITHUB COMMITS");
  await expect(page.locator(".github-activity-codex-ledger div")).toHaveCount(1);
  await expect(page.locator("#github-activity-codex-cost")).toHaveCount(0);
  await expect(page.locator("#github-activity-selected-additions")).toHaveCount(0);
  await expect(page.locator("#github-activity-selected-deletions")).toHaveCount(0);
  await expect(page.locator("#github-activity-selected-tier")).toHaveCount(0);
  await expect(page.locator("#github-activity-ai-tiers")).toHaveCount(0);
  await expect(page.locator(".github-activity-add-line, .github-activity-remove-line, .github-activity-tier-run")).toHaveCount(0);
  await expect(activity).not.toContainText(
    /agent-hours|kWh|trees?|public-API|plan price|lines changed|lines touched|added|removed|\$20|\$100|\$200/i
  );

  const codexScope = page.locator("[data-codex-scope]");
  const githubScope = page.locator("[data-github-scope]");
  const codexDaily = page.getByRole("button", { name: "Daily", exact: true });
  const codexWeekly = page.getByRole("button", { name: "Weekly", exact: true });
  await expect(codexScope).toHaveText("LAST 30 DAYS · DAILY");
  await expect(githubScope).toHaveText("5 YEARS · WEEKLY");
  await expect(page.locator(".github-activity-codex-point")).toHaveCount(30);
  await expect(page.locator("#github-activity-codex-tokens")).toHaveText(/^[\d,]+ tokens$/);
  const codexInspector = page.locator(".github-activity-codex-inspector");
  await codexInspector.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(codexInspector).toHaveAttribute("aria-valuetext", /tokens, (?:Observed|Partial) day/);
  await expect(codexInspector).not.toHaveAttribute("aria-valuetext", /\$|cost|public API/i);
  await codexWeekly.click();
  await expect(codexScope).toHaveText("LAST 30 DAYS · WEEKLY");
  await expect(githubScope).toHaveText("5 YEARS · WEEKLY");
  const weeklyPointCount = await page.locator(".github-activity-codex-point").count();
  expect(weeklyPointCount).toBeGreaterThanOrEqual(5);
  await expect(page.locator("#github-activity-codex-table-body tr")).toHaveCount(weeklyPointCount);
  await codexDaily.click();

  const commitPath = page.locator(".github-activity-commit-line");
  const rangeSummary = page.locator("#github-activity-range-summary");
  await expect(commitPath).toHaveCount(1);
  await expect(page.locator("#github-activity-chart").getByText("COMMITS / WEEK · READABLE LOG1P", { exact: true })).toBeVisible();
  await expect(rangeSummary).toContainText("5 years");
  await expect(rangeSummary).toContainText("commits");
  const readablePath = await commitPath.getAttribute("d");
  const selectedValue = await page.locator("#github-activity-selected-commits").textContent();
  await page.getByRole("button", { name: "Literal", exact: true }).click();
  await expect(page.locator("#github-activity-chart").getByText("COMMITS / WEEK · LITERAL LINEAR", { exact: true })).toBeVisible();
  expect(await commitPath.getAttribute("d")).not.toBe(readablePath);
  await expect(page.locator("#github-activity-selected-commits")).toHaveText(selectedValue);

  await page.getByRole("button", { name: "1 year", exact: true }).click();
  await expect(githubScope).toHaveText("1 YEAR · WEEKLY");
  await expect(codexScope).toHaveText("LAST 30 DAYS · DAILY");
  const inspector = page.locator(".github-activity-inspector");
  await inspector.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(inspector).toHaveAttribute("aria-valuetext", /Week of \d{4}-\d{2}-\d{2}, [\d,]+ commits/);
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(page.locator(".github-activity-selection-band")).toHaveAttribute("visibility", "visible");
  await expect(rangeSummary).toContainText(/^Selected 2 weeks/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".github-activity-selection-band")).toHaveAttribute("visibility", "hidden");

  await page.getByText("How this view works", { exact: true }).click();
  const codexCells = page.locator("#github-activity-codex-table-body tr").first().locator("th, td");
  const commitCells = page.locator("#github-activity-table-body tr").first().locator("th, td");
  await expect(codexCells).toHaveCount(3);
  await expect(commitCells).toHaveCount(2);
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
  await expect(heartbeat).toContainText(/\d+(?:\.\d+)?[BM] Codex tokens/);
  await expect(heartbeat).toContainText(/\d+ GitHub commits/);
  await expect(heartbeat).not.toContainText(/\$|public API|cost/i);
  const tally = page.locator(".home-agentic-tally");
  await expect(tally.locator(".home-agentic-stat")).toHaveCount(2);
  await expect(tally).toContainText("site-build tokens");
  await expect(tally).toContainText("site commits");
  await expect(tally).not.toContainText(/agent-hours|kWh|trees?|invoice|cost/i);
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
  await expect(page.locator('.site-format-link[aria-current="true"]')).toHaveText("AI");
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
  await expect(page.locator('.site-format-link[aria-current="true"]')).toHaveText("Human");

  await page.getByRole("link", { name: "AI-readable research profile" }).click();
  await expect(page).toHaveURL(/\/al-folio\/ai\/$/);
  await expect(page.locator('.site-format-link[aria-current="true"]')).toHaveText("AI");
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

test("home dropped meme record cards resolve into an inspectable 2D fan", async ({ page }) => {
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

  await trigger.focus();
  await trigger.press("Enter");
  await expect(card).toHaveAttribute("data-project-card-state", "expanded");
  await expect(panel).toBeVisible();
  await expect(primaryAction).toBeFocused();
  await expect(status).toContainText(/preview opened\.$/);

  await page.keyboard.press("Escape");
  await expect(card).toHaveAttribute("data-project-card-state", "collapsed");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(status).toContainText(/preview closed\.$/);

  await trigger.click();
  await primaryAction.focus();
  await page
    .locator("h1")
    .first()
    .click({ position: { x: 4, y: 4 } });
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
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
