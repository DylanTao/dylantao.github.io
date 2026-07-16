const { test, expect } = require("@playwright/test");
const { attachScreenshot, collectRuntimeErrors, preparePage, screenshotDiffRatio, stabilizeVisuals } = require("./helpers");
const { SITEWIDE_ROUTES, publicRouteUrl } = require("./public-routes");

async function expectMobileChromeInViewport(page, routePath) {
  const viewport = page.viewportSize();
  expect(viewport, `${routePath} has no mobile viewport`).not.toBeNull();

  const chrome = [
    ["brand name", page.locator(".site-brand-name")],
    ["site actions", page.locator(".navbar-actions")],
    ["navigation toggle", page.locator(".navbar-toggler")],
  ];
  const boxes = {};

  for (const [label, locator] of chrome) {
    await expect(locator, `${routePath} hides the mobile ${label}`).toBeVisible();
    const box = await locator.boundingBox();
    expect(box, `${routePath} mobile ${label} has no rendered box`).not.toBeNull();
    expect(box.x, `${routePath} mobile ${label} begins outside the viewport`).toBeGreaterThanOrEqual(-1);
    expect(box.y, `${routePath} mobile ${label} begins above the viewport`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `${routePath} mobile ${label} is clipped horizontally`).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height, `${routePath} mobile ${label} is clipped vertically`).toBeLessThanOrEqual(viewport.height + 1);
    boxes[label] = box;
  }

  expect(boxes["brand name"].x + boxes["brand name"].width, `${routePath} mobile brand overlaps site actions`).toBeLessThanOrEqual(
    boxes["site actions"].x + 1
  );
  expect(boxes["site actions"].x + boxes["site actions"].width, `${routePath} mobile actions overlap the navigation toggle`).toBeLessThanOrEqual(
    boxes["navigation toggle"].x + 1
  );
}

async function expectCompactBlogOpening(page) {
  const toc = page.locator("details.blog-inline-toc");
  await expect(toc).toBeVisible();
  await expect(toc.locator("summary")).toHaveText("On this page");
  await expect(toc).not.toHaveAttribute("open", "");

  const separators = page.locator(".blog-post .post-meta-separator");
  expect(await separators.count()).toBeGreaterThan(0);
  await expect(separators.first()).toBeHidden();

  const openingParagraph = page.locator(".blog-post #markdown-content > p").first();
  await expect(openingParagraph).toBeVisible();
  const openingBox = await openingParagraph.boundingBox();
  expect(openingBox, "mobile blog opening paragraph has no rendered box").not.toBeNull();
  expect(openingBox.y, "mobile blog chrome delays the opening paragraph too far down").toBeLessThan(780);
}

async function exerciseScrollReveals(page, { selector, visibleClass }) {
  const items = page.locator(selector);
  const count = await items.count();

  for (let index = 0; index < count; index += 1) {
    await items.nth(index).scrollIntoViewIfNeeded();
    await page.waitForTimeout(60);
  }

  await expect(page.locator(`${selector}:not(.${visibleClass})`)).toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(450);
}

async function getResearchMotionState(stage) {
  return stage.evaluate((element) => {
    let snapshot = null;
    element.addEventListener(
      "research-motion-state",
      (event) => {
        snapshot = event.detail;
      },
      { once: true }
    );
    element.dispatchEvent(new Event("research-motion-request-state"));
    if (!snapshot) throw new Error("research motion did not return a state snapshot");
    return snapshot;
  });
}

async function getNarrowAiChromeGeometry(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height } : null;
    };
    const brandName = document.querySelector(".site-brand-name");
    return {
      nav: rect("#navbar"),
      article: rect(".ai-view-page"),
      brandMark: rect(".site-brand-mark"),
      actions: rect(".navbar-actions"),
      toggler: rect(".navbar-toggler"),
      formatLinks: Array.from(document.querySelectorAll(".site-format-link")).map((link) => {
        const box = link.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      }),
      brandNameVisible: Boolean(brandName && getComputedStyle(brandName).display !== "none"),
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}

async function getAnchorLandingGeometry(page, targetId) {
  return page.evaluate((id) => {
    const nav = document.getElementById("navbar")?.getBoundingClientRect();
    const target = document.getElementById(id)?.getBoundingClientRect();
    return nav && target ? { navBottom: nav.bottom, targetTop: target.top } : null;
  }, targetId);
}

async function expectStableHumanCounterpart(page, expectedPathAndHash, frameCount = 8) {
  const humanLink = page.locator('[data-site-format="human"]');
  await expect
    .poll(async () => {
      const target = new URL((await humanLink.getAttribute("href")) || "", page.url());
      return `${target.pathname}${target.hash}`;
    })
    .toBe(expectedPathAndHash);

  const samples = await page.evaluate(async (count) => {
    const values = [];
    for (let index = 0; index < count; index += 1) {
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      const link = document.querySelector('[data-site-format="human"]');
      const target = new URL(link?.getAttribute("href") || "", window.location.href);
      values.push(`${target.pathname}${target.hash}`);
    }
    return values;
  }, frameCount);
  expect(samples, `Human counterpart changed during settled scroll frames: ${samples.join(", ")}`).toEqual(
    Array(frameCount).fill(expectedPathAndHash)
  );
}

async function exercisePublicRoute(page, route, theme, testInfo) {
  const runtimeErrors = collectRuntimeErrors(page);

  if (route.id === "secret-locked") {
    await page.addInitScript(() => sessionStorage.removeItem("siruiSecretFruitPass"));
  }
  await preparePage(page, theme);
  const response = await page.goto(publicRouteUrl(route.path), { waitUntil: "domcontentloaded" });

  expect(response, `${route.path} did not return a document response`).not.toBeNull();
  expect(response.status(), `${route.path} returned HTTP ${response.status()}`).toBeLessThan(400);

  const ready = page.locator(route.readySelector).first();
  const content = page.locator(route.contentSelector).first();
  await expect(ready).toBeVisible();
  await expect(content).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await stabilizeVisuals(page);
  await page.waitForTimeout(350);

  const geometry = await page.evaluate(() => {
    const documentElement = document.documentElement;
    return {
      clientWidth: documentElement.clientWidth,
      scrollHeight: documentElement.scrollHeight,
      scrollWidth: documentElement.scrollWidth,
    };
  });
  const contentBox = await content.boundingBox();

  expect(geometry.scrollWidth - geometry.clientWidth, `${route.path} has horizontal document overflow`).toBeLessThanOrEqual(1);
  expect(geometry.scrollHeight, `${route.path} has no meaningful document height`).toBeGreaterThan(400);
  expect(contentBox, `${route.path} content has no rendered box`).not.toBeNull();
  expect(contentBox.height, `${route.path} content box is unexpectedly short`).toBeGreaterThan(route.minContentHeight ?? 120);
  expect(runtimeErrors, `${route.path} raised browser runtime errors`).toEqual([]);

  if (route.id === "secret-locked") {
    await expect(ready).toContainText("locked.");
    await expect(ready.locator("h1")).toHaveText("locked.");
    await expect(page.locator("#sirui-crack-map")).toBeHidden();
  }

  if (route.id === "blog-archive-2026") {
    const firstArchiveDate = page.locator(".archive th").first();
    await expect(firstArchiveDate).toContainText("Jul 05");
    await expect(firstArchiveDate).not.toContainText("2026");
  }

  if (testInfo.project.name === "mobile-390") {
    await expectMobileChromeInViewport(page, route.path);
    if (route.id === "blog-distributed-cognition") {
      await expectCompactBlogOpening(page);
    }
    if (route.id === "blog-page-2") {
      await expect(page.locator(".featured-posts")).toHaveCount(0);
    }
    if (route.id === "cv") {
      const sections = page.locator("[data-cv-mobile-sections]");
      await expect(sections).toBeVisible();
      await expect(sections).not.toHaveAttribute("open", "");
      await sections.locator("summary").click();
      expect(await sections.locator("a").count()).toBeGreaterThan(4);
      await sections.locator("summary").click();
    }
    if (route.id === "publications") {
      const paperTop = await page.locator(".publication-list-column").evaluate((element) => element.getBoundingClientRect().top);
      const lensTop = await page.locator(".publication-lens-column").evaluate((element) => element.getBoundingClientRect().top);
      expect(paperTop, "mobile publications should place papers before the Scholar lens").toBeLessThan(lensTop);
    }
    if (route.id === "ai-profile") {
      await expect(page.locator("[data-publication-key]")).toHaveCount(5);
      await expect(page.locator('.site-format-link[aria-current="page"]')).toHaveText("AI");
    }
    if (route.id === "github-activity") {
      for (const width of [320, 350, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect
          .poll(async () => {
            return page.locator(".github-activity-line-heading").evaluate((heading) => {
              const chart = heading.ownerSVGElement;
              const box = heading.getBBox();
              const viewBoxWidth = chart?.viewBox.baseVal.width || 0;
              return viewBoxWidth > 0 && box.x >= 0 && box.x + box.width <= viewBoxWidth;
            });
          })
          .toBe(true);

        const groupedValuesStayTogether = await page.locator(".github-activity-value-group").evaluateAll((groups) =>
          groups.slice(1).every((group) => {
            const [separator, value] = Array.from(group.children).map((child) => child.getBoundingClientRect());
            return separator && value && Math.abs(separator.top - value.top) <= 1;
          })
        );
        expect(groupedValuesStayTogether, `${width}px GitHub readout orphans a separator`).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 1000 });
    }
  }

  await attachScreenshot(page, testInfo, `${route.id}-${theme}-${testInfo.project.name}`, { fullPage: false });

  if (theme === "light" && route.fullPage && ["desktop-1440", "mobile-390"].includes(testInfo.project.name)) {
    if (route.id === "home") {
      await exerciseScrollReveals(page, { selector: ".home-reveal", visibleClass: "home-visible" });
    }
    if (route.id === "publications") {
      await exerciseScrollReveals(page, {
        selector: ".publications ol.bibliography > li.site-reveal",
        visibleClass: "site-visible",
      });
    }
    if (route.id === "projects-index") {
      await exerciseScrollReveals(page, {
        selector: ".projects .card.site-reveal",
        visibleClass: "site-visible",
      });
    }
    await attachScreenshot(page, testInfo, `${route.id}-light-${testInfo.project.name}-full-page`, { fullPage: true });
  }
}

for (const route of SITEWIDE_ROUTES) {
  test(`public route: ${route.id}`, async ({ page, context }, testInfo) => {
    await exercisePublicRoute(page, route, "light", testInfo);

    const darkPage = await context.newPage();
    try {
      await exercisePublicRoute(darkPage, route, "dark", testInfo);
    } finally {
      await darkPage.close();
    }
  });
}

test("Human focus and AI research keep reciprocal format context", async ({ page, browser }, testInfo) => {
  test.setTimeout(120000);
  test.skip(testInfo.project.name !== "desktop-1440", "one browser covers the reciprocal format journey");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  const humanFocusUrl = new URL(publicRouteUrl("/"));
  humanFocusUrl.hash = "#focus";
  const aiResearchUrl = new URL(publicRouteUrl("/ai/"));
  aiResearchUrl.hash = "#research";

  await page.goto(humanFocusUrl.href, { waitUntil: "domcontentloaded" });
  const focusAiLink = page.locator('[data-site-format="ai"]');
  await expect.poll(async () => new URL((await focusAiLink.getAttribute("href")) || "", page.url()).href).toBe(aiResearchUrl.href);
  await expect(focusAiLink).toHaveAttribute("rel", /(?:^|\s)alternate(?:\s|$)/);
  await focusAiLink.focus();
  await expect(focusAiLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(aiResearchUrl.href);

  const researchHumanLink = page.locator('[data-site-format="human"]');
  await expect.poll(async () => new URL((await researchHumanLink.getAttribute("href")) || "", page.url()).href).toBe(humanFocusUrl.href);
  await expect(researchHumanLink).toHaveAttribute("rel", /(?:^|\s)alternate(?:\s|$)/);
  await attachScreenshot(page, testInfo, "ai-research-reciprocal-format-desktop-1440", { fullPage: false });
  await researchHumanLink.focus();
  await expect(researchHumanLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(humanFocusUrl.href);
  await page.goBack();
  await expect(page).toHaveURL(aiResearchUrl.href);
  await expect
    .poll(async () => new URL((await page.locator('[data-site-format="human"]').getAttribute("href")) || "", page.url()).href)
    .toBe(humanFocusUrl.href);

  const noScriptContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
  const noScriptPage = await noScriptContext.newPage();
  try {
    await noScriptPage.goto(humanFocusUrl.href, { waitUntil: "domcontentloaded" });
    const noScriptAiLink = noScriptPage.locator('[data-site-format="ai"]');
    const noScriptAiTarget = new URL((await noScriptAiLink.getAttribute("href")) || "", noScriptPage.url());
    expect(noScriptAiTarget.pathname).toBe(new URL(publicRouteUrl("/ai/")).pathname);
    expect(noScriptAiTarget.hash).toBe("");
    await noScriptAiLink.click();
    await expect(noScriptPage).toHaveURL(publicRouteUrl("/ai/"));
  } finally {
    await noScriptContext.close();
  }

  expect(runtimeErrors).toEqual([]);
});

test("Human and AI formats keep stable, auditable route counterparts", async ({ page, browser }, testInfo) => {
  test.setTimeout(420000);
  test.skip(testInfo.project.name !== "desktop-1440", "one browser covers deterministic format routing and narrow chrome");

  await preparePage(page, "light");
  const routeTargets = [
    { route: "/", hash: "", alternate: true },
    { route: "/publications/", hash: "#publications", alternate: true },
    { route: "/publications/designweaver/", hash: "#designweaver", alternate: true },
    { route: "/projects/", hash: "#routes", alternate: false },
    { route: "/projects/designweaver/", hash: "#routes", alternate: false },
    { route: "/blog/", hash: "#routes", alternate: false },
    { route: "/blog/2026/research-skills-starter-pack/", hash: "#routes", alternate: false },
    { route: "/cv/", hash: "#routes", alternate: false },
  ];

  for (const { route, hash, alternate } of routeTargets) {
    await page.goto(publicRouteUrl(route), { waitUntil: "domcontentloaded" });
    const expectedHuman = new URL(publicRouteUrl(route));
    const humanLink = page.locator('[data-site-format="human"]');
    const aiLink = page.locator('[data-site-format="ai"]');
    const humanTarget = new URL((await humanLink.getAttribute("href")) || "", page.url());
    const aiTarget = new URL((await aiLink.getAttribute("href")) || "", page.url());

    await expect(humanLink).toHaveAttribute("aria-current", "page");
    expect(humanTarget.pathname).toBe(expectedHuman.pathname);
    expect(humanTarget.search).toBe(expectedHuman.search);
    expect(humanTarget.hash).toBe(expectedHuman.hash);
    expect(aiTarget.pathname).toBe(new URL(publicRouteUrl("/ai/")).pathname);
    expect(aiTarget.hash).toBe(hash);
    if (alternate) {
      await expect(aiLink).toHaveAttribute("rel", /(?:^|\s)alternate(?:\s|$)/);
    } else {
      await expect(aiLink).not.toHaveAttribute("rel", /(?:^|\s)alternate(?:\s|$)/);
    }
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-section="publications"]').scrollIntoViewIfNeeded();
  await expect
    .poll(async () => new URL((await page.locator('[data-site-format="ai"]').getAttribute("href")) || "", page.url()).hash)
    .toBe("#publications");
  expect(new URL(page.url()).hash, "manual homepage reading should not synthesize a URL hash").toBe("");

  await page.evaluate(() => {
    window.location.hash = "#focus";
  });
  await expect(page).toHaveURL(/#focus$/);
  await expect
    .poll(async () => new URL((await page.locator('[data-site-format="ai"]').getAttribute("href")) || "", page.url()).hash)
    .toBe("#research");

  await page.goto(publicRouteUrl("/ai/"), { waitUntil: "domcontentloaded" });
  const aiCounterparts = [
    { hash: "#identity", human: "/", alternate: true },
    { hash: "#research", human: "/#focus", alternate: true },
    { hash: "#publications", human: "/publications/", alternate: true },
    { hash: "#designweaver", human: "/publications/designweaver/", alternate: true },
    { hash: "#routes", human: "/", alternate: false },
    { hash: "#sources", human: "/", alternate: false },
    { hash: "#not-real", human: "/", alternate: false },
  ];

  for (const { hash, human, alternate } of aiCounterparts) {
    const expectedHuman = new URL(publicRouteUrl(human));
    const expectedPathAndHash = `${expectedHuman.pathname}${expectedHuman.hash}`;
    await page.evaluate((nextHash) => {
      window.location.hash = nextHash;
    }, hash);
    await expect(page).toHaveURL(new RegExp(`${hash}$`));
    const humanLink = page.locator('[data-site-format="human"]');
    if (hash === "#not-real") {
      await expect
        .poll(async () => {
          const target = new URL((await humanLink.getAttribute("href")) || "", page.url());
          return `${target.pathname}${target.hash}`;
        })
        .toBe(expectedPathAndHash);
    } else {
      await expectStableHumanCounterpart(page, expectedPathAndHash);
    }
    const humanTarget = new URL((await humanLink.getAttribute("href")) || "", page.url());
    expect(humanTarget.pathname).toBe(expectedHuman.pathname);
    expect(humanTarget.hash).toBe(expectedHuman.hash);
    if (alternate) {
      await expect(humanLink).toHaveAttribute("rel", /(?:^|\s)alternate(?:\s|$)/);
    } else {
      await expect(humanLink).not.toHaveAttribute("rel", /(?:^|\s)alternate(?:\s|$)/);
    }
  }

  await page.evaluate(() => {
    window.location.hash = "#research";
  });
  await expect(page).toHaveURL(/#research$/);
  await expectStableHumanCounterpart(page, `${new URL(publicRouteUrl("/")).pathname}#focus`);
  await page.evaluate(() => {
    window.location.hash = "#publications";
  });
  await expect(page).toHaveURL(/#publications$/);
  await expectStableHumanCounterpart(page, new URL(publicRouteUrl("/publications/")).pathname);
  await page.goBack();
  await expect(page).toHaveURL(/#research$/);
  await expectStableHumanCounterpart(page, `${new URL(publicRouteUrl("/")).pathname}#focus`);
  await page.goForward();
  await expect(page).toHaveURL(/#publications$/);
  await expectStableHumanCounterpart(page, new URL(publicRouteUrl("/publications/")).pathname);

  await page.goto(publicRouteUrl("/ai/"), { waitUntil: "domcontentloaded" });
  const desktopResearchLink = page.locator('[data-ai-nav-link="research"]');
  await desktopResearchLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ai\/#research$/);
  await expect(page.locator("#research")).toBeFocused();
  await expect
    .poll(async () => {
      const landing = await getAnchorLandingGeometry(page, "research");
      if (!landing) return false;
      const gap = landing.targetTop - landing.navBottom;
      return gap >= 8 && gap <= 24;
    })
    .toBe(true);

  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(publicRouteUrl("/ai/#routes"), { waitUntil: "domcontentloaded" });
  await expect(page.locator(".ai-jump-nav")).toHaveCount(0);
  await expect(page.locator('.ai-route-grid a[href$="/publications/"]')).not.toHaveAttribute("rel", /alternate/);
  await expect(page.locator('.ai-route-grid a[href$="/projects/"]')).toHaveAccessibleName("Open the human projects page");
  await expect(page.locator('.ai-route-grid a[href$="/blog/"]')).toHaveAccessibleName("Open the human blog page");
  await expect(page.locator('.ai-route-grid a[href$="/cv/"]')).toHaveAccessibleName("Open the human CV page");

  const aiHeaderLinks = page.locator("#navbarNav [data-ai-nav-link]");
  await expect(aiHeaderLinks).toHaveCount(5);
  const headerTargetsAreMachineLocal = await aiHeaderLinks.evaluateAll((links) =>
    links.every((link) => {
      const target = new URL(link.href);
      return target.pathname === window.location.pathname && Boolean(target.hash);
    })
  );
  expect(headerTargetsAreMachineLocal).toBe(true);
  await expect(page.locator('[data-ai-nav-link="routes"]')).toHaveAttribute("aria-current", "location");
  await expect(page.locator('[data-site-format="human"]')).toHaveAttribute("href", /\/$/);

  const navbarToggle = page.locator(".navbar-toggler");
  const mobileNavigation = page.locator("#navbarNav");
  await navbarToggle.click();
  await expect(navbarToggle).toHaveAttribute("aria-expanded", "true");
  await expect(mobileNavigation).toHaveClass(/show/);
  const sourcesHeaderLink = page.locator('[data-ai-nav-link="sources"]');
  await sourcesHeaderLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ai\/#sources$/);
  await expect(page.locator("#sources")).toHaveClass(/site-anchor-arrival/);
  await expect(mobileNavigation).toBeHidden();
  await expect(navbarToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('[data-site-format="human"]')).toHaveAttribute("href", /\/$/);
  await expect(page.locator("#sources")).toBeFocused();
  await expect
    .poll(async () => {
      const landing = await getAnchorLandingGeometry(page, "sources");
      if (!landing) return false;
      const gap = landing.targetTop - landing.navBottom;
      return gap >= 8 && gap <= 24;
    })
    .toBe(true);
  const sourcesLanding = await getAnchorLandingGeometry(page, "sources");
  expect(sourcesLanding.targetTop).toBeGreaterThanOrEqual(sourcesLanding.navBottom + 8);
  expect(sourcesLanding.targetTop).toBeLessThanOrEqual(sourcesLanding.navBottom + 24);

  await page.goBack();
  await expect(page).toHaveURL(/\/ai\/#routes$/);
  await expect(mobileNavigation).toBeHidden();
  await expect(navbarToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('[data-site-format="human"]')).toHaveAttribute("href", /\/$/);
  await expect
    .poll(async () => {
      const landing = await getAnchorLandingGeometry(page, "routes");
      if (!landing) return false;
      const gap = landing.targetTop - landing.navBottom;
      return gap >= 8 && gap <= 24;
    })
    .toBe(true);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(publicRouteUrl("/ai/"), { waitUntil: "domcontentloaded" });
  await page.locator("#sources").evaluate((section) => {
    const navbarBottom = document.getElementById("navbar")?.getBoundingClientRect().bottom || 0;
    const targetTop = section.getBoundingClientRect().top;
    window.scrollBy({ top: targetTop - navbarBottom - 12, behavior: "instant" });
  });
  await expect(page.locator('[data-ai-nav-link="sources"]')).toHaveAttribute("aria-current", "location");
  expect(new URL(page.url()).hash, "manual reading should not pollute browser history with synthetic hashes").toBe("");
  await expect(page.locator('[data-site-format="human"]')).toHaveAttribute("href", /\/$/);

  const widths = [320, 350, 375, 384, 390];
  await page.goto(publicRouteUrl("/ai/"), { waitUntil: "domcontentloaded" });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const geometry = await getNarrowAiChromeGeometry(page);
    expect(geometry.scrollWidth - geometry.clientWidth, `${width}px JavaScript page overflows`).toBeLessThanOrEqual(1);
    expect(geometry.article.top, `${width}px article is occluded by fixed navigation`).toBeGreaterThanOrEqual(geometry.nav.bottom - 1);
    expect(geometry.brandMark).not.toBeNull();
    expect(geometry.brandNameVisible).toBe(width > 388);
    expect(Math.abs(geometry.actions.top + geometry.actions.height / 2 - (geometry.toggler.top + geometry.toggler.height / 2))).toBeLessThanOrEqual(
      1
    );
    for (const box of geometry.formatLinks) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
    }
    if ([320, 384, 390].includes(width)) {
      await attachScreenshot(page, testInfo, `ai-format-switch-${width}`, { fullPage: false });
    }
  }

  const noScriptContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
  const noScriptPage = await noScriptContext.newPage();
  try {
    await noScriptPage.goto(publicRouteUrl("/ai/"), { waitUntil: "domcontentloaded" });
    await expect(noScriptPage.locator(".ai-jump-nav")).toHaveCount(0);
    const noScriptNavigation = noScriptPage.locator(".ai-noscript-nav");
    await expect(noScriptNavigation).toBeVisible();
    await expect(noScriptNavigation).toHaveAccessibleName("AI profile sections");
    const noScriptHeaderLinks = noScriptPage.locator("#navbarNav [data-ai-nav-link]");
    await expect(noScriptHeaderLinks.first()).toBeHidden();
    const expectedJumpHashes = ["#identity", "#research", "#publications", "#routes", "#sources"];
    await expect(noScriptHeaderLinks).toHaveCount(expectedJumpHashes.length);
    const noScriptJumpLinks = noScriptNavigation.locator("a");
    await expect(noScriptJumpLinks).toHaveCount(expectedJumpHashes.length);
    for (let index = 0; index < expectedJumpHashes.length; index += 1) {
      const link = noScriptHeaderLinks.nth(index);
      await expect(link).toHaveAttribute("href", new RegExp(`${expectedJumpHashes[index]}$`));
      await expect(noScriptJumpLinks.nth(index)).toHaveAttribute("href", expectedJumpHashes[index]);
      expect(await noScriptPage.locator(expectedJumpHashes[index]).count()).toBe(1);
    }
    const humanHomePath = new URL(publicRouteUrl("/")).pathname;
    const noScriptHumanHref = new URL((await noScriptPage.locator('[data-site-format="human"]').getAttribute("href")) || "", noScriptPage.url());
    expect(noScriptHumanHref.pathname).toBe(humanHomePath);

    for (const width of widths) {
      await noScriptPage.setViewportSize({ width, height: 900 });
      await noScriptPage.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      const geometry = await getNarrowAiChromeGeometry(noScriptPage);
      expect(geometry.scrollWidth - geometry.clientWidth, `${width}px no-JavaScript page overflows`).toBeLessThanOrEqual(1);
      expect(geometry.article.top, `${width}px no-JavaScript article is occluded`).toBeGreaterThanOrEqual(geometry.nav.bottom - 1);
      expect(geometry.brandNameVisible).toBe(width > 388);
      expect(Math.abs(geometry.actions.top + geometry.actions.height / 2 - (geometry.toggler.top + geometry.toggler.height / 2))).toBeLessThanOrEqual(
        1
      );
      for (const box of geometry.formatLinks) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.right).toBeLessThanOrEqual(width);
      }
    }

    await noScriptPage.setViewportSize({ width: 390, height: 900 });
    await noScriptJumpLinks.last().click();
    await expect(noScriptPage).toHaveURL(/\/ai\/#sources$/);
    await expect(noScriptPage.locator("#sources")).toBeVisible();

    const noScriptResearchUrl = new URL(publicRouteUrl("/ai/"));
    noScriptResearchUrl.hash = "research";
    await noScriptPage.goto(noScriptResearchUrl.toString(), { waitUntil: "domcontentloaded" });
    const noScriptLanding = await getAnchorLandingGeometry(noScriptPage, "research");
    expect(noScriptLanding.targetTop).toBeGreaterThanOrEqual(noScriptLanding.navBottom - 1);
  } finally {
    await noScriptContext.close();
  }
});

test("no-JavaScript AI hash routes keep current state neutral", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one browser proves the server-rendered no-JavaScript state");

  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  try {
    const researchUrl = new URL(publicRouteUrl("/ai/"));
    researchUrl.hash = "research";
    const response = await page.goto(researchUrl.toString(), { waitUntil: "domcontentloaded" });

    expect(response, "the no-JavaScript AI route did not return a document response").not.toBeNull();
    expect(response.status(), `the no-JavaScript AI route returned HTTP ${response.status()}`).toBeLessThan(400);
    await expect(page.locator("#research")).toBeVisible();
    await expect(page.locator("#navbarNav .nav-item.active")).toHaveCount(0);
    await expect(page.locator("#navbarNav [data-ai-nav-link][aria-current]")).toHaveCount(0);
    await expect(page.locator('.ai-route-grid a[href$="/publications/"]')).not.toHaveAttribute("rel", /alternate/);
  } finally {
    await context.close();
  }
});

test("head alternates are scoped to equivalent machine-readable documents", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one browser covers the document-equivalence matrix");

  const cases = [
    { route: "/", expected: [["text/plain", "/llms.txt"]] },
    { route: "/ai/", expected: [["text/plain", "/llms-full.txt"]] },
    { route: "/publications/", expected: [["application/json", "/ai/publications.json"]] },
    {
      route: "/publications/designweaver/",
      expected: [
        ["text/markdown", "/ai/papers/designweaver.md"],
        ["application/x-bibtex", "/ai/papers/designweaver.bib"],
        ["application/x-research-info-systems", "/ai/papers/designweaver.ris"],
      ],
    },
    { route: "/projects/designweaver/", expected: [] },
    { route: "/blog/2026/research-skills-starter-pack/", expected: [] },
    { route: "/cv/", expected: [] },
  ];
  const machineTypes = new Set(["text/plain", "application/json", "text/markdown", "application/x-bibtex", "application/x-research-info-systems"]);

  for (const entry of cases) {
    await page.goto(publicRouteUrl(entry.route), { waitUntil: "domcontentloaded" });
    const alternates = await page.locator('head link[rel~="alternate"]').evaluateAll((links) =>
      links.map((link) => ({
        type: link.getAttribute("type") || "",
        pathname: new URL(link.href).pathname,
      }))
    );
    const machineAlternates = alternates.filter((link) => machineTypes.has(link.type));
    expect(machineAlternates, `${entry.route} advertises an over-broad machine alternate`).toHaveLength(entry.expected.length);
    for (const [type, pathnameSuffix] of entry.expected) {
      expect(machineAlternates.some((link) => link.type === type && link.pathname.endsWith(pathnameSuffix))).toBe(true);
    }
  }
});

test("Build Rhythm narrow table exposes its horizontal reading path", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one browser covers the compact table widths");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/github-activity/"), { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-github-activity]")).toHaveAttribute("data-state", "ready");
  await page.locator(".github-activity-method summary").click();

  const hint = page.locator("#github-activity-table-scroll-hint");
  const tableWrap = page.locator('.github-activity-table-wrap[aria-describedby="github-activity-table-scroll-hint"]');
  await expect(hint).toHaveText("Scroll horizontally for all columns.");
  await expect(tableWrap).toHaveCount(1);
  await expect(tableWrap).toHaveAttribute("role", "region");
  await expect(tableWrap).toHaveAccessibleName("Weekly GitHub activity table");
  await expect(tableWrap).toHaveAttribute("tabindex", "0");

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(hint).toBeVisible();
    const geometry = await tableWrap.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        pageClientWidth: document.documentElement.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.pageScrollWidth - geometry.pageClientWidth, `${width}px page overflows`).toBeLessThanOrEqual(1);
    expect(geometry.scrollWidth, `${width}px table should retain every reported column`).toBeGreaterThan(geometry.clientWidth);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width);
    await tableWrap.focus();
    await expect(tableWrap).toBeFocused();
    const focusStyle = await tableWrap.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) || 0 };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);
    await hint.scrollIntoViewIfNeeded();
    await attachScreenshot(page, testInfo, `build-rhythm-table-cue-${width}`, { fullPage: false });
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(hint).toBeHidden();
  expect(runtimeErrors).toEqual([]);
});

test("home research motion responds locally and keeps a reduced-motion still", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "representative semantic-motion checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  const response = await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  const stage = page.locator("[data-research-motion]");
  const canvas = page.locator("[data-research-motion-canvas]");
  await stage.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await getResearchMotionState(stage)).visible).toBe(true);
  await expect(stage).toHaveAttribute("data-motion-energy", "resting");
  await attachScreenshot(page, testInfo, "research-motion-resting-desktop-1440", { locator: stage });

  await page.locator('[data-research-mode="evaluate"]').click();
  await expect(page.locator("[data-research-motion-readout]")).toHaveText("Evaluate");
  await expect(stage).toHaveAttribute("data-motion-energy", "engaged");
  await page.mouse.move(2, 2);
  await expect(stage).toHaveAttribute("data-motion-energy", "resting", { timeout: 2400 });

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  await page.mouse.move(centerX, box.y - 24);
  await page.waitForTimeout(120);
  const outsideState = await getResearchMotionState(stage);
  expect(outsideState.active, "a pointer 24px above the canvas must not engage motion").toBe(false);
  expect(outsideState.targetIntent, "nearby section space must not act like canvas input").toBe(0);
  expect(outsideState.kineticEnergy).toBeLessThanOrEqual(outsideState.maxInteractionIntent);
  await expect(stage).toHaveAttribute("data-motion-energy", "resting");

  const edgeDepths = [1 / box.width, 0.04, 0.1];
  const edgeStates = [];
  for (const depth of edgeDepths) {
    await page.mouse.move(box.x + box.width * depth, centerY);
    await page.waitForTimeout(60);
    const edgeState = await getResearchMotionState(stage);
    expect(edgeState.targetIntent).toBeGreaterThanOrEqual(0);
    expect(edgeState.targetIntent).toBeLessThanOrEqual(edgeState.maxInteractionIntent);
    expect(edgeState.kineticEnergy).toBeLessThanOrEqual(edgeState.maxInteractionIntent);
    edgeStates.push(edgeState);
  }
  expect(edgeStates[0].targetIntent, "the first inner pixel should not jump to full intent").toBeLessThan(0.1);
  expect(edgeStates[1].targetIntent).toBeGreaterThan(edgeStates[0].targetIntent);
  expect(edgeStates[2].targetIntent).toBeGreaterThan(edgeStates[1].targetIntent);
  expect(edgeStates[2].targetIntent).toBeCloseTo(edgeStates[2].maxInteractionIntent, 5);

  await page.mouse.move(centerX, centerY);
  await expect(stage).toHaveAttribute("data-motion-energy", "engaged");
  await expect.poll(async () => (await getResearchMotionState(stage)).kineticEnergy).toBeGreaterThanOrEqual(0.69);
  const centerState = await getResearchMotionState(stage);
  expect(centerState.active).toBe(true);
  expect(centerState.targetIntent).toBeCloseTo(centerState.maxInteractionIntent, 5);
  expect(centerState.kineticEnergy).toBeGreaterThanOrEqual(centerState.maxInteractionIntent - 0.03);
  expect(centerState.targetIntent).toBeLessThanOrEqual(0.72);
  expect(centerState.kineticEnergy).toBeLessThanOrEqual(centerState.maxInteractionIntent);
  await attachScreenshot(page, testInfo, "research-motion-engaged-desktop-1440", { locator: stage });

  await page.mouse.move(centerX, box.y - 24);
  const directExitState = await getResearchMotionState(stage);
  expect(directExitState.active).toBe(false);
  expect(directExitState.targetIntent).toBe(0);
  expect(directExitState.kineticEnergy).toBeLessThanOrEqual(directExitState.maxInteractionIntent);
  await expect
    .poll(async () => (await getResearchMotionState(stage)).intent, { message: "pointer intent should decay after leaving the canvas" })
    .toBeLessThan(0.02);
  await expect.poll(async () => (await getResearchMotionState(stage)).kineticEnergy).toBeLessThan(0.02);
  await expect(stage).toHaveAttribute("data-motion-energy", "resting");

  await page.mouse.move(box.x + box.width * 0.1, centerY);
  await expect.poll(async () => (await getResearchMotionState(stage)).kineticEnergy).toBeGreaterThanOrEqual(0.69);
  const reengagedState = await getResearchMotionState(stage);
  expect(reengagedState.active).toBe(true);
  expect(reengagedState.targetIntent).toBeCloseTo(reengagedState.maxInteractionIntent, 5);
  expect(reengagedState.intent).toBeGreaterThanOrEqual(reengagedState.maxInteractionIntent - 0.03);
  expect(reengagedState.kineticEnergy).toBeGreaterThanOrEqual(reengagedState.maxInteractionIntent - 0.03);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect
    .poll(async () => getResearchMotionState(stage))
    .toMatchObject({
      active: false,
      targetIntent: 0,
      intent: 0,
      kineticEnergy: 0,
      visible: false,
      running: false,
    });

  await stage.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => getResearchMotionState(stage))
    .toMatchObject({
      active: false,
      targetIntent: 0,
      intent: 0,
      kineticEnergy: 0,
      visible: true,
      running: true,
    });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(stage).toHaveAttribute("data-motion-energy", "resting");
  await expect.poll(async () => getResearchMotionState(stage)).toMatchObject({ reducedMotion: true, running: false, kineticEnergy: 0 });
  await page.waitForTimeout(180);
  const stillBefore = await canvas.screenshot();
  await page.waitForTimeout(260);
  const stillAfter = await canvas.screenshot();
  expect(screenshotDiffRatio(stillAfter, stillBefore), "reduced motion should render a stable still composition").toBeLessThan(0.0001);
  await attachScreenshot(page, testInfo, "research-motion-reduced-desktop-1440", { locator: stage });
  expect(runtimeErrors, "research motion raised browser runtime errors").toEqual([]);
});

test("projects keep the nine site experiments in debut order", async ({ page }, testInfo) => {
  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/projects/"), { waitUntil: "domcontentloaded" });

  const grid = page.locator("[data-site-experiment-grid]");
  await expect(grid).toBeVisible();
  await exerciseScrollReveals(page, {
    selector: "[data-site-experiment-grid] .card.site-reveal",
    visibleClass: "site-visible",
  });

  const cards = grid.locator("[data-project-card]");
  await expect(cards).toHaveCount(9);
  await expect(cards.locator("h4.card-title")).toHaveCount(9);
  await expect(cards.locator("h3.card-title")).toHaveCount(0);
  expect(await cards.locator(".card-title").allTextContents()).toEqual([
    "Paper Constellation",
    "Build Rhythm",
    "The Desk That Learned Depth",
    "HCI Spooder-Man",
    "Scholar Lens",
    "Wall of Rejection",
    "The IKEA Card Experiment",
    "Vibe-Coding a Research Portfolio",
    "Dogtor's Hidden Portal",
  ]);

  const imageEvidence = await cards.locator("img").evaluateAll((images) => ({
    count: images.length,
    loaded: images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(imageEvidence.count).toBe(9);
  expect(imageEvidence.loaded).toBe(true);
  expect(imageEvidence.overflow).toBeLessThanOrEqual(0);

  await attachScreenshot(page, testInfo, `projects-site-experiments-${testInfo.project.name}`, { fullPage: true });
});

test("desk origin stays bounded and still under reduced motion", async ({ page }, testInfo) => {
  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });

  const switcher = page.locator("[data-home-desk-mode-switch]");
  const origin = switcher.getByRole("link", { name: "Want to learn this desk scene's origin?" });
  const tooltip = origin.locator(".widget-origin-tooltip");
  await expect(origin).toBeVisible();
  await expect(origin).toHaveAttribute("href", /\/projects\/homepage-desk-scene\/$/);
  await origin.focus();
  await expect(tooltip).toBeVisible();

  const geometry = await page.evaluate(() => {
    const modeSwitcher = document.querySelector("[data-home-desk-mode-switch]");
    const link = modeSwitcher?.querySelector(".home-desk-origin-link");
    const tip = link?.querySelector(".widget-origin-tooltip");
    const contact = Array.from(document.querySelectorAll("a")).find((candidate) => candidate.textContent?.trim() === "Contact");
    const controls = Array.from(modeSwitcher?.querySelectorAll("[data-home-desk-mode], .home-desk-origin-link") ?? []);
    const centers = controls.map((control) => {
      const rect = control.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
    const linkRect = link?.getBoundingClientRect();
    const tipRect = tip?.getBoundingClientRect();
    const contactRect = contact?.getBoundingClientRect();
    const overlap =
      tipRect && contactRect
        ? Math.max(0, Math.min(tipRect.right, contactRect.right) - Math.max(tipRect.left, contactRect.left)) *
          Math.max(0, Math.min(tipRect.bottom, contactRect.bottom) - Math.max(tipRect.top, contactRect.top))
        : 0;
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      tooltipOverflow: tip ? tip.scrollWidth - tip.clientWidth : null,
      originWidth: linkRect?.width ?? 0,
      originHeight: linkRect?.height ?? 0,
      sameRow: centers.length === 3 && Math.max(...centers) - Math.min(...centers) <= 2,
      mobileTooltipBelow: linkRect && tipRect ? tipRect.top >= linkRect.bottom : false,
      contactOverlap: overlap,
    };
  });

  expect(geometry.documentOverflow).toBeLessThanOrEqual(0);
  expect(geometry.tooltipOverflow).toBeLessThanOrEqual(1);
  expect(geometry.originWidth).toBeGreaterThanOrEqual(24);
  expect(geometry.originHeight).toBeGreaterThanOrEqual(24);
  expect(geometry.sameRow).toBe(true);
  if (testInfo.project.name === "mobile-390") {
    expect(geometry.mobileTooltipBelow).toBe(true);
    expect(geometry.contactOverlap).toBe(0);
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await origin.focus();
  const reducedMotion = await origin.evaluate((link) => {
    const tooltipElement = link.querySelector(".widget-origin-tooltip");
    const linkStyle = getComputedStyle(link);
    const tooltipStyle = tooltipElement ? getComputedStyle(tooltipElement) : null;
    return {
      linkDuration: linkStyle.transitionDuration,
      linkTransform: linkStyle.transform,
      tooltipDuration: tooltipStyle?.transitionDuration,
      tooltipTransform: tooltipStyle?.transform,
    };
  });
  expect(reducedMotion).toEqual({
    linkDuration: "0s",
    linkTransform: "none",
    tooltipDuration: "0s",
    tooltipTransform: "none",
  });

  await attachScreenshot(page, testInfo, `desk-origin-${testInfo.project.name}`, { fullPage: false });
});

// Keep this last: unlocking starts the secret route's Three/WebGL work.
test("secret checkpoint tells the truth, contains focus, and survives a refresh", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "representative hidden-route journey checkpoint");

  await page.addInitScript(() => {
    window.__siruiGeolocationRequests = 0;
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: async ({ name }) => (name === "geolocation" ? { state: "prompt" } : { state: "denied" }),
      },
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success, error) => {
          window.__siruiGeolocationRequests += 1;
          error?.({ code: 1, message: "test prompt" });
        },
      },
    });
  });

  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/blog/"), { waitUntil: "domcontentloaded" });

  const trigger = page.locator("#sirui-secret-dog");
  const dialog = page.locator("#sirui-secret-dialog");
  const close = page.locator("#sirui-secret-close");
  const mango = page.locator('[data-sirui-fruit="mango"]');
  const banana = page.locator('[data-sirui-fruit="banana"]');
  const origin = page.locator("[data-sirui-secret-origin]");

  await expect(origin).toBeHidden();

  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/sirui-secret-dialog-open/);
  await expect(mango).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(banana).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("body")).not.toHaveClass(/sirui-secret-dialog-open/);

  await trigger.click();
  await mango.click();
  const status = page.locator("#sirui-secret-status");
  await expect(status).toContainText("mango is on Sirui's list.");
  expect(await status.textContent()).not.toMatch(/guess|correct/i);
  await expect(origin).toBeVisible();
  await expect(origin.getByRole("link", { name: "Want to learn this portal's origin?" })).toHaveAttribute("href", /\/projects\/dogtor-portal\/$/);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/\/blog\/?$/);
  await expect(origin).toBeVisible();

  await trigger.click();
  await mango.click();
  await page.waitForURL(/sirui-research-thoughts\/?$/);
  await expect(page.locator("#sirui-crack-map")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#sirui-sharpen-location")).toHaveText("use precise location");
  await expect(page.locator("#sirui-sharpen-location")).toBeVisible();
  await page.waitForTimeout(650);
  expect(await page.evaluate(() => window.__siruiGeolocationRequests)).toBe(0);
  await page.locator("#sirui-sharpen-location").click();
  await expect.poll(() => page.evaluate(() => window.__siruiGeolocationRequests)).toBe(1);
  const storedPass = await page.evaluate(() => JSON.parse(sessionStorage.getItem("siruiSecretFruitPass")));
  expect(storedPass.fruit).toBe("mango");
  expect(storedPass.unlockedAt).toBeGreaterThan(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#sirui-crack-map")).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => sessionStorage.getItem("siruiSecretFruitPass"))).not.toBeNull();
});
