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
  await expect(page.locator("[data-constellation-desktop] [data-constellation-edge]")).toHaveCount(9);
  await expect(page.locator("[data-constellation-mobile] [data-constellation-mobile-edge]")).toHaveCount(9);
  await expect(page.locator("[data-constellation-mobile-rail]")).toHaveCount(3);
  await expect(page.locator("[data-constellation-mobile-membership]")).toHaveCount(5);
  await expect(activeSurface).toBeVisible();

  if (viewportWidth <= 767) {
    await expect
      .poll(() =>
        page.locator("[data-constellation-mobile-edge]").evaluateAll((paths) =>
          paths.map((path) => ({
            d: path.getAttribute("d") || "",
            length: path.getTotalLength(),
          }))
        )
      )
      .toEqual(
        expect.arrayContaining(
          Array.from({ length: 9 }, () => expect.objectContaining({ d: expect.stringMatching(/^M /), length: expect.any(Number) }))
        )
      );

    const mobileGeometry = await page.locator("[data-constellation-mobile]").evaluate((surface) => ({
      rails: Array.from(surface.querySelectorAll("[data-constellation-mobile-rail]")).map((path) => ({
        length: path.getTotalLength(),
        opacity: Number.parseFloat(getComputedStyle(path).opacity),
        stroke: getComputedStyle(path).stroke,
      })),
      edges: Array.from(surface.querySelectorAll("[data-constellation-mobile-edge]")).map((path) => path.getTotalLength()),
      memberships: Array.from(surface.querySelectorAll("[data-constellation-mobile-membership]")).map((path) => path.getTotalLength()),
      papers: Array.from(surface.querySelectorAll("[data-constellation-paper]")).map((button) => ({
        height: button.getBoundingClientRect().height,
        copyWidth: button.querySelector(".paper-constellation-mobile-copy")?.getBoundingClientRect().width || 0,
      })),
    }));
    expect(mobileGeometry.rails).toHaveLength(3);
    expect(mobileGeometry.rails.every((rail) => rail.length > 1 && rail.opacity > 0 && rail.stroke !== "none")).toBe(true);
    expect(mobileGeometry.edges).toHaveLength(9);
    expect(mobileGeometry.edges.every((length) => length > 1)).toBe(true);
    expect(mobileGeometry.memberships).toHaveLength(5);
    expect(mobileGeometry.memberships.every((length) => length > 1)).toBe(true);
    expect(mobileGeometry.papers).toHaveLength(5);
    expect(mobileGeometry.papers.every((paper) => paper.height >= 44 && paper.copyWidth >= 220)).toBe(true);
  }

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

  if (viewportWidth <= 767) {
    const detail = page.locator("[data-constellation-detail]");
    await expect.poll(() => detail.evaluate((panel) => panel.parentElement?.dataset.constellationDetailSlot || "")).toBe("tao2024designweaver");
    const placement = await page
      .locator('[data-constellation-mobile-paper-row][data-constellation-node-id="tao2024designweaver"]')
      .evaluate((row) => {
        const button = row.querySelector("[data-constellation-paper]").getBoundingClientRect();
        const panel = row.querySelector("[data-constellation-detail]").getBoundingClientRect();
        return { buttonBottom: button.bottom, panelTop: panel.top };
      });
    expect(placement.panelTop).toBeGreaterThanOrEqual(placement.buttonBottom - 1);
  }

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-constellation-detail-paper="tao2024designweaver"]')).toBeHidden();
  await expect(page.locator("[data-constellation-detail-empty]")).toBeVisible();
  await expect(designWeaver).toBeFocused();
  await expect
    .poll(() => page.locator("[data-constellation-detail]").evaluate((panel) => panel.parentElement?.hasAttribute("data-constellation-detail-dock")))
    .toBe(true);
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

  const mobileFutureNodes = await page.locator("[data-constellation-mobile] [data-constellation-future]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.dataset.constellationNodeId,
      thread: node.dataset.constellationThread,
      text: node.innerText.replace(/\s+/g, " ").trim(),
      label: node.querySelector("[role='img']")?.getAttribute("aria-label"),
      controls: node.querySelectorAll("a, button, input, select, textarea, [tabindex]").length,
    }))
  );
  expect(mobileFutureNodes).toHaveLength(7);
  for (const node of mobileFutureNodes) {
    expect(node.id).toMatch(/^future-(major|minor)-\d{2}$/);
    expect(node.thread).toMatch(/^(design|situate)$/);
    expect(node.text).toBe("?");
    expect(node.label).toMatch(/^Unannounced (major|minor) future work on the (Design|Situate) thread\.(?: Rejected at (CHI|UIST) 2026\.)*$/);
    expect(node.controls).toBe(0);
  }
  await expect(page.locator("[data-constellation-mobile] .paper-constellation-mobile-rejection-callout")).toHaveCount(1);
  await expect(page.locator("[data-constellation-mobile] .paper-constellation-mobile-rejection-callout span")).toHaveCount(2);

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

test("mobile constellation information strokes clear 3:1 in every coastal mode", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "the mobile trail exposes rails, graph edges, and secondary memberships together");

  const runtimeErrors = collectRuntimeErrors(page);
  const { constellationPanel } = await openConstellation(page, "morning");
  const root = page.locator("html");
  await expect(page.locator("[data-paper-constellation]")).toHaveClass(/paper-constellation-entered/);

  for (const mode of ["morning", "noon", "afternoon", "evening"]) {
    if ((await root.getAttribute("data-theme-mode")) !== mode) {
      await page.locator("#theme-toggle").click();
      await page.locator(`#theme-menu [data-theme-mode-option="${mode}"]`).click();
    }
    await expect(root).toHaveAttribute("data-theme-mode", mode);
    await page.mouse.move(0, 0);
    await expect
      .poll(() =>
        page
          .locator("[data-constellation-mobile-rail], [data-constellation-mobile-edge], [data-constellation-mobile-membership]")
          .evaluateAll(
            (elements) => elements.length === 17 && elements.every((element) => Number.parseFloat(getComputedStyle(element).opacity) >= 0.899)
          )
      )
      .toBe(true);

    const contrastEvidence = await page.locator("[data-constellation-mobile]").evaluate((surface) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const parseColor = (value) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = "rgba(0, 0, 0, 0)";
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data);
      };
      const resolveToken = (token) => {
        const probe = document.createElement("i");
        probe.style.color = `var(${token})`;
        surface.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      const linear = (channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (color) => 0.2126 * linear(color[0]) + 0.7152 * linear(color[1]) + 0.0722 * linear(color[2]);
      const contrast = (first, second) => {
        const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
        return (lighter + 0.05) / (darker + 0.05);
      };
      const backgrounds = [resolveToken("--global-card-bg-color"), resolveToken("--global-bg-color")].map(parseColor);
      const roles = [
        ["rail", "[data-constellation-mobile-rail]"],
        ["edge", "[data-constellation-mobile-edge]"],
        ["membership", "[data-constellation-mobile-membership]"],
      ];

      return roles.flatMap(([role, selector]) =>
        Array.from(surface.querySelectorAll(selector)).map((element, index) => {
          const style = getComputedStyle(element);
          const stroke = parseColor(style.stroke);
          const effectiveAlpha = (stroke[3] / 255) * Number.parseFloat(style.opacity || "1") * Number.parseFloat(style.strokeOpacity || "1");
          const ratios = backgrounds.map((background) => {
            const composited = stroke
              .slice(0, 3)
              .map((channel, channelIndex) => channel * effectiveAlpha + background[channelIndex] * (1 - effectiveAlpha));
            return contrast(composited, background);
          });
          return {
            index,
            minContrast: Math.min(...ratios),
            opacity: effectiveAlpha,
            role,
            stroke: style.stroke,
          };
        })
      );
    });

    expect(contrastEvidence.filter((item) => item.role === "rail")).toHaveLength(3);
    expect(contrastEvidence.filter((item) => item.role === "edge")).toHaveLength(9);
    expect(contrastEvidence.filter((item) => item.role === "membership")).toHaveLength(5);
    for (const evidence of contrastEvidence) {
      expect(evidence.opacity, `${mode} ${evidence.role} ${evidence.index} has no visible composited stroke`).toBeGreaterThan(0);
      expect(
        evidence.minContrast,
        `${mode} ${evidence.role} ${evidence.index} (${evidence.stroke} at ${evidence.opacity.toFixed(3)} opacity)`
      ).toBeGreaterThanOrEqual(3);
    }
    await attachScreenshot(page, testInfo, `paper-constellation-stroke-contrast-${mode}-mobile-390`, { locator: constellationPanel });
  }

  expect(runtimeErrors, "coastal constellation contrast checks raised browser runtime errors").toEqual([]);
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
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name), "desktop and mobile verify the reduced-motion state");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await openConstellation(page, "light");
  await expect(page.locator("[data-paper-constellation]")).toHaveClass(/paper-constellation-entered/);
  const viewportWidth = page.viewportSize()?.width || 1440;
  const activeSurface = viewportWidth <= 767 ? page.locator("[data-constellation-mobile]") : page.locator("[data-constellation-desktop]");
  const motionState = await activeSurface.evaluate((map) => {
    const node = map.querySelector(".paper-constellation-node-position, .paper-constellation-mobile-paper-row");
    const edge = map.querySelector(".paper-constellation-edge");
    const membership = map.querySelector(".paper-constellation-mobile-membership");
    return {
      edgeOpacity: Number.parseFloat(getComputedStyle(edge).opacity),
      edgeTransition: getComputedStyle(edge).transitionDuration,
      nodeOpacity: Number.parseFloat(getComputedStyle(node).opacity),
      nodeTransition: getComputedStyle(node).transitionDuration,
      membershipTransition: membership ? getComputedStyle(membership).transitionDuration : "0s",
    };
  });
  expect(motionState.nodeOpacity).toBe(1);
  expect(motionState.edgeOpacity).toBeGreaterThan(0);
  expect(motionState.nodeTransition).toBe("0s");
  expect(motionState.edgeTransition).toBe("0s");
  expect(motionState.membershipTransition).toBe("0s");
});
