const { test, expect } = require("@playwright/test");
const { attachScreenshot, collectRuntimeErrors, preparePage, stabilizeVisuals } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

const PUBLICATIONS_URL = publicRouteUrl("/publications/");

async function openConstellation(page, theme = "light") {
  await preparePage(page, theme);
  await page.goto(PUBLICATIONS_URL, { waitUntil: "networkidle" });

  const listPanel = page.locator('[data-publication-view-panel="list"]');
  const constellationPanel = page.locator('[data-publication-view-panel="constellation"]');
  const switcher = page.locator("[data-publication-view-switcher]");

  await expect(switcher).toBeVisible();
  await expect(listPanel).toBeVisible();
  await expect(constellationPanel).toBeHidden();
  await switcher.locator('[data-publication-view-button="constellation"]').click();
  await expect(listPanel).toBeHidden();
  await expect(constellationPanel).toBeVisible();
  await expect(page.locator("[data-publication-workbench]")).toHaveAttribute("data-publication-view", "constellation");

  return { constellationPanel, listPanel, switcher };
}

test("Paper Constellation projects the bibliography, filters accessibly, and keeps selection recoverable", async ({ page, context }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const { constellationPanel } = await openConstellation(page, "light");
  const viewportWidth = page.viewportSize()?.width || 1440;
  const activeSurface = viewportWidth <= 767 ? page.locator("[data-constellation-mobile]") : page.locator("[data-constellation-desktop]");

  await expect(page.locator("[data-constellation-desktop] [data-constellation-paper]")).toHaveCount(5);
  await expect(page.locator("[data-constellation-mobile] [data-constellation-paper]")).toHaveCount(5);
  await expect(page.locator("[data-constellation-desktop] [data-constellation-future]")).toHaveCount(7);
  await expect(page.locator("[data-constellation-mobile] [data-constellation-future]")).toHaveCount(7);
  await expect(page.locator("[data-constellation-edge]")).toHaveCount(9);
  await expect(activeSurface).toBeVisible();

  const originRoutes = await page.locator(".widget-origin-link").evaluateAll((links) => links.map((link) => new URL(link.href).pathname));
  expect(originRoutes).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/\/projects\/wall-of-rejection\/$/),
      expect.stringMatching(/\/projects\/scholar-lens\/$/),
      expect.stringMatching(/\/projects\/paper-constellation\/$/),
    ])
  );

  await page.locator('input[name="publication-role-filter"][value="first-author"]').check();
  const filteredNodes = page.locator("[data-constellation-node-id].paper-constellation-node-filtered");
  await expect(filteredNodes).toHaveCount(6);
  await expect(filteredNodes.locator("[data-constellation-paper]:enabled")).toHaveCount(0);
  await expect(filteredNodes.locator('[data-constellation-paper]:not([tabindex="-1"])')).toHaveCount(0);
  expect(await filteredNodes.evaluateAll((nodes) => nodes.every((node) => node.getAttribute("aria-hidden") === "true"))).toBe(true);

  await page.locator('input[name="publication-role-filter"][value="all"]').check();
  await expect(page.locator(".paper-constellation-node-filtered")).toHaveCount(0);

  const designWeaver = activeSurface.locator('[data-constellation-paper][data-publication-key="tao2024designweaver"]');
  const designWeaverEntry = page.locator('.publication-lens-entry[data-publication-key="tao2024designweaver"]');
  const designWeaverCitationChip = designWeaverEntry.locator("[data-publication-citation-chip]");
  const designWeaverCitationYearBars = page.locator('[data-scholar-year-bar][data-year-papers*="tao2024designweaver:"]');
  await page.mouse.move(0, 0);
  await designWeaver.focus();
  await expect(designWeaver).toBeFocused();
  await expect(designWeaver.locator("..")).toHaveClass(/paper-constellation-node-active/);
  await expect(activeSurface.locator('[data-constellation-node-id="future-major-01"]')).toHaveClass(/paper-constellation-node-related/);
  await expect(designWeaverEntry).toHaveClass(/publication-lens-linked/);
  await expect(designWeaverCitationChip).toHaveClass(/publication-lens-citation-linked/);
  await expect
    .poll(() =>
      designWeaverCitationYearBars.evaluateAll((bars) => bars.length > 0 && bars.every((bar) => bar.classList.contains("scholar-lens-year-linked")))
    )
    .toBe(true);
  await designWeaver.press("Enter");
  await expect(designWeaver).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-constellation-detail-paper="tao2024designweaver"]')).toBeVisible();
  await expect(page.locator("[data-publication-workbench]")).toHaveAttribute("data-active-publication", "tao2024designweaver");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-constellation-detail-paper="tao2024designweaver"]')).toBeHidden();
  await expect(page.locator("[data-constellation-detail-empty]")).toBeVisible();
  await expect(designWeaver).toBeFocused();
  await expect(page.locator(".paper-constellation-node-active")).toHaveCount(0);
  await expect(designWeaverEntry).not.toHaveClass(/publication-lens-linked/);
  await expect(designWeaverCitationChip).not.toHaveClass(/publication-lens-citation-linked/);
  await expect(page.locator(".scholar-lens-year-linked")).toHaveCount(0);

  const renderedFutureNodes = await page.locator("[data-constellation-desktop] [data-constellation-future]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.dataset.constellationNodeId,
      thread: node.dataset.constellationThread,
      text: node.innerText.replace(/\s+/g, " ").trim(),
      label: node.querySelector("[role='img']")?.getAttribute("aria-label"),
      controls: node.querySelectorAll("a, button, input, select, textarea, [tabindex]").length,
    }))
  );
  expect(renderedFutureNodes).toHaveLength(7);
  expect(renderedFutureNodes.filter((node) => node.id.startsWith("future-major-"))).toHaveLength(3);
  expect(renderedFutureNodes.filter((node) => node.id.startsWith("future-minor-"))).toHaveLength(4);
  expect(renderedFutureNodes.filter((node) => node.thread === "design")).toHaveLength(5);
  expect(renderedFutureNodes.filter((node) => node.thread === "situate")).toHaveLength(2);
  for (const node of renderedFutureNodes) {
    expect(node.id).toMatch(/^future-(major|minor)-\d{2}$/);
    expect(node.thread).toMatch(/^(design|situate)$/);
    expect(node.text).toMatch(/^\?(?: CHI ’26 · rejected UIST ’26 · rejected)?$/);
    expect(node.label).toMatch(/^Unannounced (major|minor) future work on the (Design|Situate) thread\.(?: Rejected at (CHI|UIST) 2026\.)*$/);
    expect(node.controls).toBe(0);
  }
  await expect(page.locator("[data-constellation-desktop] .paper-constellation-rejection-tags")).toHaveCount(1);
  await expect(page.locator("[data-constellation-desktop] .paper-constellation-rejection-tags span")).toHaveCount(2);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${testInfo.project.name} Paper Constellation has horizontal overflow`).toBeLessThanOrEqual(1);

  await stabilizeVisuals(page);
  await attachScreenshot(page, testInfo, `paper-constellation-light-${testInfo.project.name}`, {
    locator: constellationPanel,
  });

  const darkPage = await context.newPage();
  try {
    const darkRuntimeErrors = collectRuntimeErrors(darkPage);
    const darkView = await openConstellation(darkPage, "dark");
    await stabilizeVisuals(darkPage);
    await attachScreenshot(darkPage, testInfo, `paper-constellation-dark-${testInfo.project.name}`, {
      locator: darkView.constellationPanel,
    });
    expect(darkRuntimeErrors, "dark Paper Constellation raised browser runtime errors").toEqual([]);
  } finally {
    await darkPage.close();
  }

  expect(runtimeErrors, "Paper Constellation raised browser runtime errors").toEqual([]);
});

test("Paper List is the complete no-JavaScript publication view", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one browser verifies the deterministic no-JavaScript contract");

  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto(PUBLICATIONS_URL, { waitUntil: "networkidle" });
    await expect(page.locator("[data-publication-view-switcher]")).toBeHidden();
    await expect(page.locator('[data-publication-view-panel="list"]')).toBeVisible();
    await expect(page.locator('[data-publication-view-panel="constellation"]')).toBeHidden();
    await expect(page.locator(".publications ol.bibliography > li")).toHaveCount(5);
    await expect(page.locator(".publications")).toContainText("DesignWeaver");
    await expect(page.locator(".publications")).toContainText("Physion");
  } finally {
    await context.close();
  }
});

test("reduced motion reveals the settled constellation without transitional state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop browser verifies the reduced-motion state");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await openConstellation(page, "light");
  await expect(page.locator("[data-paper-constellation]")).toHaveClass(/paper-constellation-entered/);
  const motionState = await page.locator("[data-constellation-desktop]").evaluate((map) => {
    const node = map.querySelector(".paper-constellation-node-position");
    const edge = map.querySelector(".paper-constellation-edge");
    return {
      edgeOpacity: Number.parseFloat(getComputedStyle(edge).opacity),
      edgeTransition: getComputedStyle(edge).transitionDuration,
      nodeOpacity: Number.parseFloat(getComputedStyle(node).opacity),
      nodeTransition: getComputedStyle(node).transitionDuration,
    };
  });
  expect(motionState.nodeOpacity).toBe(1);
  expect(motionState.edgeOpacity).toBeGreaterThan(0);
  expect(motionState.nodeTransition).toBe("0s");
  expect(motionState.edgeTransition).toBe("0s");
});
