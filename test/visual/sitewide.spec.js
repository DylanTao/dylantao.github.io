const { test, expect } = require("@playwright/test");
const { attachScreenshot, collectRuntimeErrors, preparePage, screenshotDiffRatio, stabilizeVisuals } = require("./helpers");
const { SITEWIDE_ROUTES, publicRouteUrl } = require("./public-routes");

const FUN_PROJECT_ROUTE_IDS = new Set([
  "project-openai-build-week",
  "project-paper-constellation",
  "project-build-rhythm",
  "project-homepage-desk-scene",
  "project-hci-spooder-man",
  "project-scholar-lens",
  "project-wall-of-rejection",
  "project-ikea-project-cards",
  "project-website-revamp",
  "project-dogtor-portal",
  "project-not-a-good-driver",
]);

const COASTAL_THEME_MODES = [
  { mode: "morning", label: "Morning", computedTheme: "light" },
  { mode: "noon", label: "Noon", computedTheme: "light" },
  { mode: "afternoon", label: "Afternoon", computedTheme: "light" },
  { mode: "evening", label: "Evening", computedTheme: "dark" },
];

// Keep the homepage last: its richer desk surface should not precede the
// lighter-weight route samples in the same Chromium process.
const COASTAL_THEME_ROUTE_SAMPLES = [
  {
    path: "/projects/",
    readySelector: ".projects [data-project-card-grid]",
    surfaceSelector: ".projects [data-project-card] .card",
  },
  {
    path: "/publications/",
    readySelector: "[data-publication-workbench]",
    surfaceSelector: ".scholar-lens-card",
  },
  {
    path: "/blog/",
    readySelector: ".blog-index .header-bar",
    surfaceSelector: ".blog-pinned-card",
  },
  {
    path: "/",
    readySelector: '[data-home-section="start"]',
    surfaceSelector: ".home-influence-note",
  },
];

async function switchToCoastalThemeMode(page, { mode, computedTheme }) {
  const root = page.locator("html");

  if ((await root.getAttribute("data-theme-mode")) !== mode) {
    await page.locator("#theme-toggle").click();
    await page.locator(`#theme-menu [data-theme-mode-option="${mode}"]`).click();
  }

  await expect(root).toHaveAttribute("data-theme-mode", mode);
  await expect(root).toHaveAttribute("data-theme-setting", mode);
  await expect(root).toHaveAttribute("data-theme", computedTheme);
  await expect(root).not.toHaveClass(/\btransition\b/, { timeout: 3000 });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter((animation) => animation.constructor.name === "CSSTransition" && ["pending", "running"].includes(animation.playState)).length
        ),
      { message: `${mode} theme surfaces kept transitioning after html.transition cleared`, timeout: 3000 }
    )
    .toBe(0);
}

async function readSettledCoastalThemeSample(page, surfaceSelector) {
  return page.evaluate(async (selector) => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

    const root = document.documentElement;
    const navbar = document.querySelector("#navbar");
    const surface = document.querySelector(selector);
    const footer = document.querySelector("footer");
    if (!navbar || !surface || !footer) throw new Error(`Missing coastal theme sample surface for ${selector}`);

    const rootStyle = getComputedStyle(root);
    const value = (name) => rootStyle.getPropertyValue(name).trim().toLowerCase();
    const computed = (element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        border: style.borderTopColor,
        color: style.color,
      };
    };

    const controls = Array.from(document.querySelectorAll("[data-theme-control]"));
    const controlSelections = controls.map((control) => {
      const selected = Array.from(control.querySelectorAll('[data-theme-mode-option][aria-selected="true"]'));
      return {
        activeCount: selected.length,
        activeMode: selected[0]?.getAttribute("data-theme-mode-option") || null,
      };
    });

    return {
      attributes: {
        computedTheme: root.getAttribute("data-theme"),
        mode: root.getAttribute("data-theme-mode"),
        setting: root.getAttribute("data-theme-setting"),
      },
      controlSelections,
      darkIntegrationClass: root.classList.contains("cc--darkmode"),
      semantic: {
        background: value("--global-bg-color"),
        card: value("--global-card-bg-color"),
        footer: value("--global-footer-bg-color"),
        mutedText: value("--global-text-color-light"),
        navigation: value("--global-nav-bg-color"),
        outline: value("--global-outline-color"),
        primary: value("--global-primary-color"),
        primaryContainer: value("--global-primary-container-color"),
        surface: value("--global-surface-color"),
        surfaceContainer: value("--global-surface-container-color"),
        surfaceHigh: value("--global-surface-container-high-color"),
        surfaceLow: value("--global-surface-container-low-color"),
        text: value("--global-text-color"),
      },
      session: {
        manual: window.sessionStorage.getItem("theme-manual"),
        mode: window.sessionStorage.getItem("theme"),
      },
      settledChrome: {
        body: computed(document.body),
        footer: computed(footer),
        navbar: computed(navbar),
        surface: computed(surface),
      },
      themeTransitionCount: document
        .getAnimations()
        .filter((animation) => animation.constructor.name === "CSSTransition" && ["pending", "running"].includes(animation.playState)).length,
      toggleLabels: Array.from(document.querySelectorAll("[data-theme-toggle]"), (toggle) => ({
        ariaLabel: toggle.getAttribute("aria-label"),
        title: toggle.getAttribute("title"),
      })),
      transitioning: root.classList.contains("transition"),
      colorScheme: rootStyle.colorScheme,
    };
  }, surfaceSelector);
}

function changedRoleCount(first, second) {
  return Object.keys(first).filter((role) => JSON.stringify(first[role]) !== JSON.stringify(second[role])).length;
}

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

  if (FUN_PROJECT_ROUTE_IDS.has(route.id)) {
    const hero = page.locator(".project-case-hero").first();
    const copy = hero.locator(":scope > .project-case-copy");
    const media = hero.locator(":scope > .project-case-media");
    const visual = hero.locator(":scope > .project-case-media, :scope > .build-week-boundary-figure");
    await expect(hero).toBeVisible();
    await expect(copy).toBeVisible();
    const mediaCount = await media.count();
    const visualCount = await visual.count();

    if (visualCount > 0) {
      await expect(visual).toBeVisible();
      if (mediaCount > 0) {
        const heroImage = media.locator("img").first();
        await expect(heroImage).toHaveJSProperty("complete", true);
        expect(await heroImage.evaluate((image) => image.naturalWidth), `${route.path} hero image did not decode`).toBeGreaterThan(0);
        expect((await heroImage.getAttribute("alt"))?.trim().length, `${route.path} hero image has no useful alt text`).toBeGreaterThan(12);
      }

      const heroGeometry = await hero.evaluate((element) => {
        const copyBox = element.querySelector(":scope > .project-case-copy").getBoundingClientRect();
        const mediaBox = element.querySelector(":scope > .project-case-media, :scope > .build-week-boundary-figure").getBoundingClientRect();
        return {
          copyBottom: copyBox.bottom,
          copyHeight: copyBox.height,
          copyTop: copyBox.top,
          copyWidth: copyBox.width,
          mediaBottom: mediaBox.bottom,
          mediaHeight: mediaBox.height,
          mediaTop: mediaBox.top,
          mediaWidth: mediaBox.width,
          heroWidth: element.getBoundingClientRect().width,
        };
      });
      expect(heroGeometry.copyWidth).toBeGreaterThan(220);
      expect(heroGeometry.mediaWidth).toBeGreaterThan(220);
      if ((page.viewportSize()?.width ?? 0) <= 991) {
        expect(heroGeometry.mediaTop).toBeGreaterThan(heroGeometry.copyTop);
      } else {
        const verticalOverlap = Math.min(heroGeometry.copyBottom, heroGeometry.mediaBottom) - Math.max(heroGeometry.copyTop, heroGeometry.mediaTop);
        expect(verticalOverlap, `${route.path} hero columns do not read side by side`).toBeGreaterThan(
          Math.min(heroGeometry.copyHeight, heroGeometry.mediaHeight) * 0.5
        );
        expect(heroGeometry.copyWidth + heroGeometry.mediaWidth).toBeGreaterThan(heroGeometry.heroWidth * 0.75);
      }
    } else {
      const singleChildGeometry = await hero.evaluate((element) => {
        const copyBox = element.querySelector(":scope > .project-case-copy").getBoundingClientRect();
        const heroBox = element.getBoundingClientRect();
        return { childCount: element.children.length, copyWidth: copyBox.width, heroWidth: heroBox.width };
      });
      expect(singleChildGeometry.childCount, `${route.path} reserves an empty hero column`).toBe(1);
      expect(singleChildGeometry.copyWidth, `${route.path} single-child hero stays squeezed`).toBeGreaterThan(singleChildGeometry.heroWidth * 0.9);
    }

    if (route.id === "project-hci-spooder-man") {
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await attachScreenshot(page, testInfo, `${route.id}-${theme}-${testInfo.project.name}-initial`, { fullPage: false });
    }

    const projectActions = page.locator(".project-case-actions a");
    const projectActionBoxes = await projectActions.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { height: box.height, width: box.width };
      })
    );
    expect(projectActionBoxes.length, `${route.path} exposes no project action`).toBeGreaterThan(0);
    expect(
      projectActionBoxes.every((box) => box.height >= 44 && box.width >= 44),
      `${route.path} has a project action smaller than 44px`
    ).toBe(true);

    await projectActions.first().focus();
    const projectActionFocus = await projectActions.first().evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) || 0 };
    });
    expect(projectActionFocus.style, `${route.path} project action focus outline is missing`).not.toBe("none");
    expect(projectActionFocus.width, `${route.path} project action focus outline has no width`).toBeGreaterThan(0);

    const pinnedProvenance = page.locator(".project-case-media .project-story-provenance");
    if ((await pinnedProvenance.count()) > 0) {
      const contrastRatios = await pinnedProvenance.evaluateAll((elements) => {
        const channels = (value) =>
          value
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map(Number);
        const luminance = (value) => {
          const linear = channels(value).map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
        };

        return elements.map((element) => {
          const foreground = luminance(getComputedStyle(element).color);
          const background = luminance(getComputedStyle(element.closest(".project-case-media")).backgroundColor);
          return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        });
      });
      expect(
        contrastRatios.every((ratio) => ratio >= 4.5),
        `${route.path} provenance text does not reach 4.5:1 contrast`
      ).toBe(true);
    }
  }

  if (FUN_PROJECT_ROUTE_IDS.has(route.id)) {
    const disclosure = page.locator("details.project-story-disclosure").first();
    const summary = disclosure.locator(":scope > summary");
    await expect(disclosure).toBeVisible();
    await expect(disclosure).not.toHaveAttribute("open", "");
    await summary.scrollIntoViewIfNeeded();

    const summaryGeometry = await summary.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { height: box.height, width: box.width };
    });
    expect(summaryGeometry.height, `${route.path} disclosure summary is shorter than 44px`).toBeGreaterThanOrEqual(44);
    expect(summaryGeometry.width, `${route.path} disclosure summary has no usable width`).toBeGreaterThan(220);

    await summary.press("Enter");
    await expect(disclosure).toHaveAttribute("open", "");
    await expect(summary).toBeFocused();
    const focusRing = await summary.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(focusRing.style, `${route.path} disclosure focus outline is missing`).not.toBe("none");
    expect(focusRing.width, `${route.path} disclosure focus outline has no width`).toBeGreaterThan(0);

    await summary.press("Enter");
    await expect(disclosure).not.toHaveAttribute("open", "");
    await expect(summary).toBeFocused();
  }

  if (["project-build-rhythm", "project-paper-constellation"].includes(route.id)) {
    const story = page.locator(".project-story-beats").first();
    const beats = story.locator(":scope > .project-story-beat");
    const privacyNote = page.locator(".project-story-note--privacy").first();
    await expect(story).toBeVisible();
    await expect(beats).toHaveCount(3);
    await expect(privacyNote).toBeVisible();

    const beatBoxes = await beats.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { bottom: box.bottom, left: box.left, right: box.right, top: box.top, width: box.width };
      })
    );
    expect(
      beatBoxes.every((box) => box.width >= 220),
      `${route.path} story beats are squeezed`
    ).toBe(true);
    expect(
      beatBoxes.every((box, index) => index === 0 || box.top >= beatBoxes[index - 1].top),
      `${route.path} story beats do not preserve source order`
    ).toBe(true);
    if (["desktop-1440", "laptop-1280"].includes(testInfo.project.name)) {
      expect(Math.max(...beatBoxes.map((box) => box.top)) - Math.min(...beatBoxes.map((box) => box.top))).toBeLessThanOrEqual(2);
      expect(beatBoxes[0].right).toBeLessThanOrEqual(beatBoxes[1].left);
      expect(beatBoxes[1].right).toBeLessThanOrEqual(beatBoxes[2].left);
    } else if (testInfo.project.name === "mobile-390") {
      expect(beatBoxes[1].top).toBeGreaterThan(beatBoxes[0].bottom);
      expect(beatBoxes[2].top).toBeGreaterThan(beatBoxes[1].bottom);
    }

    const measure = await privacyNote.evaluate((element) => {
      const articleBox = element.closest("article").getBoundingClientRect();
      const box = element.getBoundingClientRect();
      return { articleLeft: articleBox.left, articleRight: articleBox.right, left: box.left, right: box.right, width: box.width };
    });
    expect(measure.width, `${route.path} privacy note is squeezed`).toBeGreaterThanOrEqual(220);
    expect(measure.left).toBeGreaterThanOrEqual(measure.articleLeft - 1);
    expect(measure.right).toBeLessThanOrEqual(measure.articleRight + 1);
  }

  if (route.id === "project-openai-build-week") {
    const story = page.locator("[data-openai-build-week-story]");
    const storySteps = story.locator("[data-build-week-step]");
    const receipts = page.locator(".build-week-receipts > li");
    const constellationImages = page.locator(".build-week-constellation-pair img");

    await expect(story).toHaveAttribute("data-state", "ready");
    await expect(storySteps).toHaveCount(6);
    await expect(receipts).toHaveCount(7);
    await expect(constellationImages).toHaveCount(2);
    await storySteps.nth(3).evaluate((step) => {
      const targetTop = window.innerHeight * 0.22;
      window.scrollBy({ top: step.getBoundingClientRect().top - targetTop, behavior: "instant" });
    });
    await expect.poll(() => story.getAttribute("data-active-chapter")).toBe("constellation");
    await constellationImages.first().scrollIntoViewIfNeeded();
    await expect
      .poll(() => constellationImages.evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), {
        message: "Build Week constellation evidence did not decode",
      })
      .toBe(true);
    expect(
      await story.evaluate((element) => element.scrollWidth - element.clientWidth),
      "Build Week story overflows its own canvas"
    ).toBeLessThanOrEqual(1);
  }

  if (route.id === "project-build-rhythm") {
    const signals = page.locator(".project-story-signal-grid").first();
    const cards = signals.locator(":scope > div");
    const reproduce = page.locator(".site-experiment-reproduce").first();
    await expect(cards).toHaveCount(3);
    await expect(cards.locator("h3")).toHaveCount(3);
    await expect(reproduce).toBeVisible();
    const boxes = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { bottom: box.bottom, left: box.left, right: box.right, top: box.top, width: box.width };
      })
    );
    expect(
      boxes.every((box) => box.width >= 220),
      "Build Rhythm signal cards are squeezed"
    ).toBe(true);
    if (["desktop-1440", "laptop-1280"].includes(testInfo.project.name)) {
      expect(Math.max(...boxes.map((box) => box.top)) - Math.min(...boxes.map((box) => box.top))).toBeLessThanOrEqual(2);
    } else {
      expect(boxes[1].top).toBeGreaterThan(boxes[0].bottom);
      expect(boxes[2].top).toBeGreaterThan(boxes[1].bottom);
    }

    const reproduceMeasure = await reproduce.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const paragraphBox = element.querySelector("p:not(.project-case-kicker)").getBoundingClientRect();
      return { width: box.width, paragraphWidth: paragraphBox.width };
    });
    expect(reproduceMeasure.width, "Build Rhythm reproduction prose is too wide").toBeLessThanOrEqual(800);
    expect(reproduceMeasure.paragraphWidth, "Build Rhythm reproduction paragraph is too wide").toBeLessThanOrEqual(800);
  }

  if (route.id === "project-paper-constellation") {
    const comparison = page.locator(".paper-constellation-evidence-pair").first();
    await expect(comparison).toHaveAttribute("data-desktop-checkpoint", "6832a6a05b5ff2b6c692bb3f5e3654a535e4401e");
    await expect(comparison).toHaveAttribute("data-desktop-capture-date", "2026-07-16");
    await expect(comparison).toHaveAttribute("data-desktop-source-viewport", "1440x1000");
    await expect(comparison).toHaveAttribute("data-desktop-device-pixel-ratio", "1");
    await expect(comparison).toHaveAttribute("data-desktop-theme", "light");
    await expect(comparison).toHaveAttribute("data-desktop-view", "constellation-active");
    await expect(comparison).toHaveAttribute("data-desktop-state", "no-paper-pinned");
    await expect(comparison).toHaveAttribute("data-desktop-artifact-size", "1012x753");
    await expect(comparison).toHaveAttribute("data-mobile-checkpoint", "6832a6a05b5ff2b6c692bb3f5e3654a535e4401e");
    await expect(comparison).toHaveAttribute("data-mobile-capture-date", "2026-07-16");
    await expect(comparison).toHaveAttribute("data-mobile-source-viewport", "390x1000");
    await expect(comparison).toHaveAttribute("data-mobile-theme", "light");
    await expect(comparison).toHaveAttribute("data-mobile-view", "constellation-active");
    await expect(comparison).toHaveAttribute("data-mobile-state", "no-paper-pinned");
    await expect(comparison).toHaveAttribute("data-mobile-artifact-size", "360x270");

    const figures = comparison.locator(":scope > figure");
    await expect(figures).toHaveCount(2);
    const images = figures.locator("img");
    await expect(images).toHaveCount(2);
    const expectedImagePaths = [
      "assets/img/project_pics/paper-constellation/paper-constellation-desktop-surface-6832a6a05-1440-light.png",
      "assets/img/project_pics/paper-constellation/paper-constellation-mobile-trail-390-light-2026-07-16.png",
    ].map((path) => new URL(path, publicRouteUrl("/")).pathname);
    expect(await images.evaluateAll((elements) => elements.map((element) => new URL(element.src).pathname))).toEqual(expectedImagePaths);
    await expect.poll(() => images.evaluateAll((elements) => elements.every((element) => element.complete && element.naturalWidth > 0))).toBe(true);
    const mobileImageBox = await images.nth(1).boundingBox();
    expect(mobileImageBox, "mobile Paper Constellation evidence image has no rendered box").not.toBeNull();
    expect(mobileImageBox.width, "mobile Paper Constellation evidence is upscaled past its source width").toBeLessThanOrEqual(361);

    const figureBoxes = await figures.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { bottom: box.bottom, left: box.left, right: box.right, top: box.top };
      })
    );
    if (["desktop-1440", "laptop-1280"].includes(testInfo.project.name)) {
      expect(Math.abs(figureBoxes[0].top - figureBoxes[1].top), "desktop atlas and mobile trail should compare in one row").toBeLessThanOrEqual(2);
      expect(figureBoxes[0].right, "Paper Constellation evidence figures should not overlap").toBeLessThanOrEqual(figureBoxes[1].left);
    } else {
      expect(figureBoxes[1].top, "compact Paper Constellation evidence should stack in reading order").toBeGreaterThan(figureBoxes[0].bottom);
    }
  }

  if (route.id === "project-scholar-lens") {
    const trace = page.locator("[data-scholar-story-trace]");
    const steps = trace.locator(":scope > .scholar-story-trace-steps > .scholar-story-trace-step");
    const annualBars = trace.locator(".scholar-story-year-bar");

    await expect(trace).toBeVisible();
    await expect(trace).toHaveAttribute("data-bibliography-key", "tao2024designweaver");
    await expect(trace).toHaveAttribute("data-lifetime-sync", /^\d{4}-\d{2}-\d{2}$/);
    await expect(trace).toHaveAttribute("data-annual-snapshot", /^\d{4}-\d{2}-\d{2}$/);
    await expect(steps).toHaveCount(3);
    await expect(steps.locator(":scope .scholar-story-trace-label svg")).toHaveCount(3);
    expect(await annualBars.count(), "Scholar Lens trace exposes no dated annual contribution").toBeGreaterThan(0);

    const traceValues = await trace.evaluate((element) => ({
      annualSnapshot: element.dataset.annualSnapshot,
      displayedLifetime: Number.parseInt(element.querySelector(".scholar-story-citation-cue strong")?.textContent || "", 10),
      lifetimeCitations: Number.parseInt(element.dataset.lifetimeCitations || "", 10),
      lifetimeSync: element.dataset.lifetimeSync,
    }));
    expect(traceValues.displayedLifetime).toBe(traceValues.lifetimeCitations);
    expect(traceValues.lifetimeSync >= traceValues.annualSnapshot, "Lifetime sync predates the annual snapshot").toBe(true);

    const stepBoxes = await steps.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { bottom: box.bottom, left: box.left, right: box.right, top: box.top, width: box.width };
      })
    );
    expect(
      stepBoxes.every((box) => box.width >= 220),
      "Scholar Lens evidence cues are squeezed"
    ).toBe(true);
    if (["desktop-1440", "laptop-1280"].includes(testInfo.project.name)) {
      expect(Math.max(...stepBoxes.map((box) => box.top)) - Math.min(...stepBoxes.map((box) => box.top))).toBeLessThanOrEqual(2);
      expect(stepBoxes[0].right).toBeLessThanOrEqual(stepBoxes[1].left);
      expect(stepBoxes[1].right).toBeLessThanOrEqual(stepBoxes[2].left);
    } else {
      expect(stepBoxes[1].top).toBeGreaterThan(stepBoxes[0].bottom);
      expect(stepBoxes[2].top).toBeGreaterThan(stepBoxes[1].bottom);
    }

    const evidenceHero = page.locator('.project-case-media[data-evidence-kind="responsive-runtime-crop"]');
    const evidenceImage = evidenceHero.locator("img");
    await expect(evidenceHero).toHaveAttribute("data-evidence-source-commit", "497b222662fa198ad5e6a43d2727cdb06ec3babf");
    await expect(evidenceHero).toHaveAttribute("data-evidence-desktop-source-viewport", "1440x1000");
    await expect(evidenceHero).toHaveAttribute("data-evidence-mobile-source-viewport", "390x1000");
    await expect(evidenceHero).toHaveAttribute("data-evidence-theme", "light");
    await expect(evidenceHero).toHaveAttribute("data-evidence-theme-mode", "noon");
    await expect(evidenceHero).toHaveAttribute("data-evidence-interaction", "keyboard-focus-on-designweaver-title-link");
    await expect(evidenceHero).toHaveAttribute("data-evidence-browser", "Chromium 145.0.7632.6");
    await expect(evidenceImage).toHaveAttribute("alt", "DesignWeaver highlighted in Scholar Lens's responsive publication and citation view");
    await expect(evidenceHero.locator('source[media="(max-width: 767px)"]')).toHaveAttribute(
      "srcset",
      /scholar-lens-designweaver-497b22266-390-light\.png/
    );
    await expect
      .poll(() => evidenceImage.evaluate((image) => new URL(image.currentSrc).pathname))
      .toMatch(testInfo.project.name === "mobile-390" ? /497b22266-390-light\.png$/ : /497b22266-1440-light\.png$/);
  }

  if (route.id === "project-hci-spooder-man") {
    const carousel = page.locator("[data-spooder-image-carousel]");
    const stage = carousel.locator(".hci-spooder-gallery-stage");
    const arrows = carousel.locator(".hci-spooder-gallery-arrow");
    const thumbs = carousel.locator("[data-spooder-image-thumb]");
    const slides = carousel.locator("[data-spooder-image-slide]");
    await expect(stage).toBeVisible();
    await expect(arrows).toHaveCount(2);
    await expect(thumbs).toHaveCount(9);
    await expect(slides).toHaveCount(9);

    const controlSizes = await carousel.locator(".hci-spooder-gallery-arrow, [data-spooder-image-thumb]").evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { height: box.height, width: box.width };
      })
    );
    expect(
      controlSizes.every((size) => size.height >= 44 && size.width >= 44),
      "Spooder carousel controls need 44px targets"
    ).toBe(true);

    await arrows.first().focus();
    await expect(arrows.first()).toBeFocused();
    const focusRing = await arrows.first().evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(focusRing.style).not.toBe("none");
    expect(focusRing.width).toBeGreaterThan(0);

    await stage.focus();
    await stage.press("ArrowRight");
    await expect(thumbs.nth(1)).toHaveAttribute("aria-current", "true");
    await expect(slides.nth(1)).toHaveAttribute("aria-hidden", "false");
    await stage.press("Home");
    await expect(thumbs.first()).toHaveAttribute("aria-current", "true");

    const viewportWidth = page.viewportSize()?.width ?? 0;
    const backToTop = page.locator("#back-to-top");
    const backToTopTarget = viewportWidth <= 575 ? page.locator(".mobile-back-to-top") : backToTop;
    await expect(backToTop).toHaveCount(1);
    await expect(backToTopTarget).toBeVisible();
    const backToTopSize = await backToTopTarget.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { height: box.height, width: box.width };
    });
    expect(backToTopSize.height).toBeGreaterThanOrEqual(44);
    expect(backToTopSize.width).toBeGreaterThanOrEqual(44);

    if (viewportWidth <= 767) {
      await expect(backToTop).toHaveCSS("visibility", "hidden");
      await expect(backToTop).toHaveCSS("pointer-events", "none");
      await expect(backToTop).toHaveCSS("opacity", "0");
      await expect(slides.first().locator("img")).toHaveCSS("object-fit", "contain");

      const activeThumbIsInsideScroller = async (thumb) =>
        thumb.evaluate((element) => {
          const thumbBox = element.getBoundingClientRect();
          const scrollerBox = element.parentElement.getBoundingClientRect();
          return thumbBox.left >= scrollerBox.left - 1 && thumbBox.right <= scrollerBox.right + 1;
        });

      await stage.press("End");
      await expect(thumbs.last()).toHaveAttribute("aria-current", "true");
      await expect.poll(() => activeThumbIsInsideScroller(thumbs.last())).toBe(true);

      await stage.press("Home");
      await expect.poll(() => activeThumbIsInsideScroller(thumbs.first())).toBe(true);
      await thumbs.first().focus();
      await thumbs.first().press("End");
      await expect(thumbs.last()).toBeFocused();
      await expect.poll(() => activeThumbIsInsideScroller(thumbs.last())).toBe(true);

      const promptCopy = page.locator("[data-spooder-copy-prompt]").first();
      await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async () => {
              throw new Error("exercise selection fallback");
            },
          },
        });
        document.execCommand = () => true;
      });
      await promptCopy.scrollIntoViewIfNeeded();
      await promptCopy.focus();
      await promptCopy.press("Enter");
      await expect(promptCopy).toBeFocused();
      await expect(promptCopy).toHaveText("Copied");
    }

    await attachScreenshot(page, testInfo, `${route.id}-${theme}-${testInfo.project.name}-interaction`, { fullPage: false });
  }

  if (route.id === "project-ikea-project-cards") {
    const figure = page.locator(".site-experiment-evidence-figure");
    const image = figure.locator("img");
    await expect(image).toHaveAttribute("src", /\/assets\/img\/project_pics\/site-experiments\/ikea-card-expanded\.png$/);
    await expect(image).toHaveAttribute(
      "alt",
      "Projects index with Paper Constellation expanded beside Build Rhythm while other project cards remain visible"
    );
    const caption = figure.locator("figcaption");
    await expect(caption).toContainText("One preview opens in place; the surrounding collection remains readable.");
    await expect(caption.locator(".project-story-provenance")).toContainText("asset checkpoint b51609f0d");
    expect(
      await image.evaluate((element) => ({
        complete: element.complete,
        naturalHeight: element.naturalHeight,
        naturalWidth: element.naturalWidth,
      }))
    ).toEqual({ complete: true, naturalHeight: 650, naturalWidth: 1200 });

    const anatomy = page.locator(".ikea-state-anatomy");
    const stateFrames = anatomy.locator(":scope .ikea-state-frame");
    await expect(anatomy).toHaveAttribute("data-evidence-kind", "annotated-current-state-anatomy");
    await expect(anatomy).toHaveAttribute("data-runtime-contract", "9fa9403e4");
    await expect(stateFrames).toHaveCount(3);
    await expect(anatomy.locator("figcaption")).toContainText("static, reduced-motion-safe anatomy");
    const stateBoxes = await stateFrames.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { bottom: box.bottom, top: box.top, width: box.width };
      })
    );
    expect(
      stateBoxes.every((box) => box.width >= 200),
      "IKEA state anatomy is squeezed"
    ).toBe(true);
    if (testInfo.project.name === "mobile-390") {
      expect(stateBoxes[1].top).toBeGreaterThan(stateBoxes[0].bottom);
      expect(stateBoxes[2].top).toBeGreaterThan(stateBoxes[1].bottom);
    } else {
      expect(Math.max(...stateBoxes.map((box) => box.top)) - Math.min(...stateBoxes.map((box) => box.top))).toBeLessThanOrEqual(2);
    }
  }

  if (route.id === "project-homepage-desk-scene") {
    const comparison = page.locator(".desk-scene-evidence-pair").first();
    await comparison.scrollIntoViewIfNeeded();
    const eras = comparison.locator(":scope > .desk-scene-comparison-era");
    await expect(eras).toHaveCount(2);
    expect(await eras.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-desk-comparison-era")))).toEqual([
      "june-exact-commit-replay",
      "july-current",
    ]);

    const june = eras.nth(0);
    await expect(june).toHaveAttribute("data-source-commit", "588e365090e883323d836f5da023f7d40632f096");
    await expect(june).toHaveAttribute("data-source-commit-date", "2026-06-21");
    await expect(june).toHaveAttribute("data-capture-date", "2026-07-16");
    await expect(june).toHaveAttribute("data-capture-viewport", "1440x1000");
    await expect(june).toHaveAttribute("data-capture-theme", "light");
    await expect(june).toHaveAttribute("data-capture-rubric", "default-representation-view");
    await expect(june).toHaveAttribute("data-capture-state", "yellow-submarine-stopped-zero-discoveries");
    await expect(june).toHaveAttribute("data-capture-sequence", "2d-then-mode-switch-only");
    await expect(june).toHaveAttribute("data-capture-device-pixel-ratio", "1");
    await expect(june).toHaveAttribute("data-capture-browser", "Chromium 145.0.7632.6");
    await expect(june).toHaveAttribute("data-model-provenance", "GPT-5.5/xhigh");
    await expect(june.locator(".project-story-provenance")).toContainText("Source 588e36509 · captured July 16");

    const july = eras.nth(1);
    await expect(july).toHaveAttribute("data-capture-date", "2026-07-16");
    await expect(july).toHaveAttribute("data-capture-source", "8fc9bf7d3");
    await expect(july).toHaveAttribute("data-scene-checkpoint", "1b07cea4c");
    await expect(july).toHaveAttribute("data-capture-viewport", "1440x1000");
    await expect(july).toHaveAttribute("data-capture-theme", "light");
    await expect(july).toHaveAttribute("data-capture-rubric", "default-representation-view");
    await expect(july).toHaveAttribute("data-capture-state", "yellow-submarine-stopped-zero-discoveries");
    await expect(july).toHaveAttribute("data-capture-device-pixel-ratio", "3");
    await expect(july).toHaveAttribute("data-webgl-buffer-cap", "near-2x");
    await expect(july).toHaveAttribute("data-model-provenance", "GPT-5.6 Sol/ultra");
    await expect(july.locator(".project-story-provenance")).toContainText("Runtime source 8fc9bf7d3 · accepted scene 1b07cea4c");

    const figures = comparison.locator("[data-desk-evidence-mode]");
    await expect(figures).toHaveCount(4);
    expect(await figures.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-desk-evidence-mode")))).toEqual([
      "2d",
      "3d",
      "2d",
      "3d",
    ]);

    const images = figures.locator("img");
    await expect(images).toHaveCount(4);
    const expectedImagePaths = [
      "assets/img/project_pics/site-experiments/homepage-desk-588e36509-2d-2026-07-16.png",
      "assets/img/project_pics/site-experiments/homepage-desk-588e36509-3d-2026-07-16.png",
      "assets/img/project_pics/site-experiments/homepage-desk-2d-2026-07-16.png",
      "assets/img/project_pics/site-experiments/homepage-desk-3d-2026-07-16.png",
    ].map((path) => new URL(path, publicRouteUrl("/")).pathname);
    expect(await images.evaluateAll((elements) => elements.map((element) => new URL(element.src).pathname))).toEqual(expectedImagePaths);
    expect(await images.evaluateAll((elements) => elements.map((element) => element.alt))).toEqual([
      "Exact replay of commit 588e36509 in the light-theme 2D homepage view, with Sirui's portrait, research slips, and a coffee-stain desk cue",
      "Exact replay of commit 588e36509 in the light-theme 3D homepage view, where a small desk-room stage occupies the right half while a black backdrop obscures much of the page",
      "July 16 homepage capture in the light-theme 2D desk representation with Sirui's portrait, paper research slips, Yellow Submarine queued and stopped, and no discovered record cards",
      "July 16 homepage capture in the light-theme 3D desk representation showing the reciprocal cliff room, onsen, lounge chair, record player, welcome note, and ocean window, with Yellow Submarine stopped and no discoveries",
    ]);
    await expect.poll(() => images.evaluateAll((elements) => elements.every((element) => element.complete && element.naturalWidth > 0))).toBe(true);
    expect(
      await images.evaluateAll((elements) =>
        elements.map((element) => ({
          naturalHeight: element.naturalHeight,
          naturalWidth: element.naturalWidth,
        }))
      )
    ).toEqual([
      { naturalHeight: 1000, naturalWidth: 1440 },
      { naturalHeight: 1000, naturalWidth: 1440 },
      { naturalHeight: 1000, naturalWidth: 1440 },
      { naturalHeight: 1000, naturalWidth: 1440 },
    ]);

    const eraBoxes = await eras.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { bottom: box.bottom, left: box.left, right: box.right, top: box.top };
      })
    );
    const figureBoxes = await figures.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { bottom: box.bottom, left: box.left, right: box.right, top: box.top };
      })
    );
    if (["desktop-1440", "laptop-1280"].includes(testInfo.project.name)) {
      expect(Math.abs(eraBoxes[0].top - eraBoxes[1].top), "desktop evidence eras should compare in one row").toBeLessThanOrEqual(2);
      expect(eraBoxes[0].right, "desktop evidence eras should not overlap").toBeLessThanOrEqual(eraBoxes[1].left);
      expect(Math.abs(figureBoxes[0].top - figureBoxes[2].top), "the two 2D frames should align as one comparison row").toBeLessThanOrEqual(2);
      expect(Math.abs(figureBoxes[1].top - figureBoxes[3].top), "the two 3D frames should align as one comparison row").toBeLessThanOrEqual(2);
      expect(figureBoxes[1].top, "June 3D should follow June 2D").toBeGreaterThan(figureBoxes[0].bottom);
      expect(figureBoxes[3].top, "July 3D should follow July 2D").toBeGreaterThan(figureBoxes[2].bottom);
    } else {
      expect(eraBoxes[1].top, "compact evidence eras should stack in reading order").toBeGreaterThan(eraBoxes[0].bottom);
    }
  }

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

  if (route.id === "projects-index") {
    const icons = page.locator(".projects [data-project-card-icon]");
    await expect(icons).toHaveCount(11);
    expect(await icons.evaluateAll((elements) => elements.every((element) => element.getAttribute("aria-hidden") === "true"))).toBe(true);
    expect(
      await icons.evaluateAll((elements) =>
        elements.every((element) => {
          const box = element.getBoundingClientRect();
          return box.width >= 24 && box.width <= 36 && box.height >= 24 && box.height <= 36;
        })
      )
    ).toBe(true);

    const driverCard = page.locator("[data-project-card]", {
      has: page.getByRole("heading", { name: "Not A Good Driver", exact: true }),
    });
    await expect(driverCard.locator("[data-project-card-origin]")).toHaveCount(1);
    await expect(driverCard.locator("[data-project-card-evolution]")).toHaveCount(0);
    await expect(page.locator("[data-project-card-evolution]")).toHaveCount(10);

    const card = page.locator("[data-site-experiment-grid] [data-project-card]").first();
    const trigger = card.locator("[data-project-card-trigger]");
    const panel = card.locator("[data-project-card-panel]");
    const primaryAction = card.locator("[data-project-card-primary-action]");
    const closeButton = card.locator("[data-project-card-close]");
    const story = card.locator("[data-project-card-story]");

    await expect(story).toBeHidden();

    await card.scrollIntoViewIfNeeded();
    await trigger.click();
    await expect(card).toHaveAttribute("data-project-card-state", "expanded");
    await expect(panel).toBeVisible();
    await expect(primaryAction).toBeVisible();
    await expect(story).toBeVisible();
    await expect(story.locator("[data-project-card-origin] .project-card-story-label")).toHaveText("Why it began");
    await expect(story.locator("[data-project-card-evolution] .project-card-story-label")).toHaveText("What changed");
    await expect
      .poll(() => card.evaluate((element) => element.getAnimations({ subtree: true }).length), {
        message: `${testInfo.project.name} project preview did not settle`,
      })
      .toBe(0);

    const expandedGeometry = await card.evaluate((element) => {
      const cardBounds = element.getBoundingClientRect();
      const actionBounds = element.querySelector("[data-project-card-primary-action]")?.getBoundingClientRect();
      const closeBounds = element.querySelector("[data-project-card-close]")?.getBoundingClientRect();
      const panelElement = element.querySelector("[data-project-card-panel]");
      const surface = element.querySelector(".card");
      const storyBeatBounds = Array.from(element.querySelectorAll(".project-card-story-beat")).map((beat) => beat.getBoundingClientRect());
      return {
        actionHeight: actionBounds?.height ?? 0,
        actionWidth: actionBounds?.width ?? 0,
        cardLeft: cardBounds.left,
        cardRight: cardBounds.right,
        closeHeight: closeBounds?.height ?? 0,
        closeWidth: closeBounds?.width ?? 0,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        panelAnimationName: panelElement ? getComputedStyle(panelElement).animationName : null,
        storyBeatWidths: storyBeatBounds.map((box) => box.width),
        surfaceClipPath: surface ? getComputedStyle(surface).clipPath : null,
      };
    });
    expect(expandedGeometry.actionHeight).toBeGreaterThanOrEqual(44);
    expect(expandedGeometry.actionWidth).toBeGreaterThan(80);
    expect(expandedGeometry.cardLeft).toBeGreaterThanOrEqual(-1);
    expect(expandedGeometry.cardRight).toBeLessThanOrEqual(page.viewportSize().width + 1);
    expect(expandedGeometry.closeHeight).toBeGreaterThanOrEqual(44);
    expect(expandedGeometry.closeWidth).toBeGreaterThanOrEqual(44);
    expect(expandedGeometry.documentOverflow).toBeLessThanOrEqual(1);
    expect(expandedGeometry.panelAnimationName).toBe("none");
    expect(expandedGeometry.storyBeatWidths.every((width) => width >= 200)).toBe(true);
    expect(expandedGeometry.surfaceClipPath).toBe("none");

    await card.evaluate((element) => {
      const navBottom = document.getElementById("navbar")?.getBoundingClientRect().bottom || 0;
      const cardTop = element.getBoundingClientRect().top;
      window.scrollBy({ top: cardTop - navBottom - 12, behavior: "instant" });
    });
    await attachScreenshot(page, testInfo, `projects-index-expanded-${theme}-${testInfo.project.name}`, { fullPage: false });

    await closeButton.evaluate((button) => button.click());
    await expect(card).toHaveAttribute("data-project-card-state", "collapsed");
    await expect(panel).toBeHidden();
    await expect.poll(() => card.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
    expect(runtimeErrors, `${route.path} project preview raised browser runtime errors`).toEqual([]);
  }

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

test("Build Week story exposes a complete reduced-motion view", async ({ page }, testInfo) => {
  test.skip(
    !["desktop-1440", "mobile-390"].includes(testInfo.project.name),
    "one desktop and one mobile viewport cover the reduced-motion story contract"
  );

  const runtimeErrors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await preparePage(page, "light");
  const response = await page.goto(publicRouteUrl("/projects/openai-build-week/"), { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  const story = page.locator("[data-openai-build-week-story]");
  await expect(story).toHaveAttribute("data-state", "ready");
  await expect(story).toHaveAttribute("data-active-chapter", "all");
  await expect(story.locator("[data-build-week-step]")).toHaveCount(6);
  await expect(story.locator("[data-build-week-chapter]")).toHaveCount(6);
  expect(await story.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);

  await page.evaluate(() => window.scrollTo(0, 0));
  await attachScreenshot(page, testInfo, `openai-build-week-hero-${testInfo.project.name}`, { fullPage: false });
  await story.scrollIntoViewIfNeeded();
  await attachScreenshot(page, testInfo, `openai-build-week-reduced-${testInfo.project.name}`, { fullPage: false });
  expect(runtimeErrors, "Build Week reduced-motion view raised browser runtime errors").toEqual([]);
});

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

test("Wall of Rejection capture state remains exactly reproducible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one exact 700x1000 source viewport covers the archived Wall state");

  await page.setViewportSize({ width: 700, height: 1000 });
  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "noon");
  const response = await page.goto(publicRouteUrl("/publications/#wall-of-rejection-title"), { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  const wall = page.locator(".wall-of-rejection");
  const highlights = wall.locator('[data-rejection-view-button][data-rejection-view-target="highlights"]');
  await expect(wall).toBeVisible();
  await highlights.click();
  await expect(highlights).toHaveAttribute("aria-pressed", "true");

  const visibleCards = wall.locator("[data-rejection-card]:visible");
  await expect(visibleCards).toHaveCount(5);
  const chi = wall.locator('[data-rejection-card][data-rejection-source-id="chi-rejection"]:visible');
  await chi.click();
  await expect(chi).toHaveAttribute("aria-expanded", "true");
  await expect(chi).toHaveClass(/rejection-badge-pinned/);

  const receipt = wall.locator("[data-rejection-receipt-tray]");
  await expect(receipt).toBeVisible();
  await expect(receipt).toHaveClass(/rejection-receipt-tray-pinned/);
  await expect(receipt).toContainText("CHI 2026 did not accept this paper");
  await expect(wall.locator(".rejection-xp-panel")).toContainText("38 / 50 XP");
  await expect(wall.locator("[data-rejected-title], [data-draft], [data-collaborator-note], [data-future-venue]")).toHaveCount(0);
  expect(await wall.innerText()).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

  await attachScreenshot(page, testInfo, "wall-of-rejection-dd801b99-700-noon-highlights-chi-open", { locator: wall });
  expect(runtimeErrors, "Wall exact capture state raised browser runtime errors").toEqual([]);
});

test("coastal time modes settle coherently across representative human routes", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  test.skip(
    !["desktop-1440", "mobile-390"].includes(testInfo.project.name),
    "one desktop and one mobile viewport cover the sitewide time-mode contract"
  );

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "morning");

  for (const route of COASTAL_THEME_ROUTE_SAMPLES) {
    const response = await page.goto(publicRouteUrl(route.path), { waitUntil: "domcontentloaded" });
    expect(response, `${route.path} did not return a document response`).not.toBeNull();
    expect(response.status(), `${route.path} returned HTTP ${response.status()}`).toBeLessThan(400);
    await expect(page.locator(route.readySelector).first()).toBeVisible();
    await expect(page.locator(route.surfaceSelector).first()).toBeAttached();
    await stabilizeVisuals(page);

    const samples = {};
    for (const theme of COASTAL_THEME_MODES) {
      await switchToCoastalThemeMode(page, theme);
      const first = await readSettledCoastalThemeSample(page, route.surfaceSelector);
      await page.waitForTimeout(80);
      const repeated = await readSettledCoastalThemeSample(page, route.surfaceSelector);

      expect(repeated, `${route.path} ${theme.mode} chrome or surface kept changing after theme settlement`).toEqual(first);
      expect(first.transitioning, `${route.path} ${theme.mode} retained html.transition`).toBe(false);
      expect(first.themeTransitionCount, `${route.path} ${theme.mode} retained a running color transition`).toBe(0);
      expect(first.attributes).toEqual({
        computedTheme: theme.computedTheme,
        mode: theme.mode,
        setting: theme.mode,
      });
      expect(first.session).toEqual({ manual: "true", mode: theme.mode });
      expect(first.colorScheme).toBe(theme.computedTheme);
      expect(first.darkIntegrationClass).toBe(theme.computedTheme === "dark");
      expect(first.controlSelections.length, `${route.path} has no time-mode control`).toBeGreaterThan(0);
      expect(
        first.controlSelections.every((selection) => selection.activeCount === 1 && selection.activeMode === theme.mode),
        `${route.path} ${theme.mode} left a theme control in a mixed state`
      ).toBe(true);
      expect(first.toggleLabels.length).toBe(first.controlSelections.length);
      expect(
        first.toggleLabels.every(
          ({ ariaLabel, title }) => ariaLabel === `Change theme. Current theme: ${theme.label}` && title === `Theme: ${theme.label}`
        ),
        `${route.path} ${theme.mode} left stale theme-control labels`
      ).toBe(true);
      expect(Object.values(first.semantic).every(Boolean), `${route.path} ${theme.mode} has an empty semantic color role`).toBe(true);
      expect(first.settledChrome.body.background).not.toBe("rgba(0, 0, 0, 0)");
      expect(first.settledChrome.navbar.background).not.toBe("rgba(0, 0, 0, 0)");
      expect(first.settledChrome.surface.background).not.toBe("rgba(0, 0, 0, 0)");
      expect(first.settledChrome.footer.background).not.toBe("rgba(0, 0, 0, 0)");
      samples[theme.mode] = first;
      if (route.path === "/projects/" && theme.mode === "afternoon") {
        await attachScreenshot(page, testInfo, `coastal-projects-afternoon-${testInfo.project.name}`, { fullPage: false });
      }
      if (route.path === "/") {
        await attachScreenshot(page, testInfo, `coastal-home-${theme.mode}-${testInfo.project.name}`, { fullPage: false });
      }
    }

    for (const [earlier, later] of [
      ["morning", "noon"],
      ["noon", "afternoon"],
    ]) {
      const earlierSample = samples[earlier];
      const laterSample = samples[later];
      expect(
        changedRoleCount(earlierSample.semantic, laterSample.semantic),
        `${route.path} ${earlier} and ${later} need meaningfully different semantic color roles`
      ).toBeGreaterThanOrEqual(8);
      expect(
        changedRoleCount(earlierSample.settledChrome, laterSample.settledChrome),
        `${route.path} ${earlier} and ${later} need visibly different settled surfaces and chrome`
      ).toBeGreaterThanOrEqual(3);
      expect(earlierSample.semantic.background).not.toBe(laterSample.semantic.background);
      expect(earlierSample.semantic.primary).not.toBe(laterSample.semantic.primary);
      expect(earlierSample.settledChrome.navbar).not.toEqual(laterSample.settledChrome.navbar);
      expect(earlierSample.settledChrome.surface).not.toEqual(laterSample.settledChrome.surface);
    }
  }

  expect(runtimeErrors, "sitewide coastal time-mode matrix raised browser runtime errors").toEqual([]);
});

test("all eleven project cards disclose and recover their stories", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name), "desktop and mobile exercise every expandable story");

  const runtimeErrors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await preparePage(page, "light");
  const response = await page.goto(publicRouteUrl("/projects/"), { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await stabilizeVisuals(page);

  const cards = page.locator(".projects [data-project-card]").filter({ has: page.locator("[data-project-card-story]") });
  await expect(cards).toHaveCount(11);
  await expect(cards.locator("[data-project-card-origin]")).toHaveCount(11);
  await expect(cards.locator("[data-project-card-evolution]")).toHaveCount(10);
  await expect(page.locator(".projects [data-project-card-state='expanded']")).toHaveCount(0);

  for (let index = 0; index < 11; index += 1) {
    const card = cards.nth(index);
    const title = (await card.locator(".card-title").innerText()).trim();
    const trigger = card.locator("[data-project-card-trigger]");
    const panel = card.locator("[data-project-card-panel]");
    const primaryAction = card.locator("[data-project-card-primary-action]");
    const closeButton = card.locator("[data-project-card-close]");
    const story = card.locator("[data-project-card-story]");
    const origin = story.locator("[data-project-card-origin]");
    const evolution = story.locator("[data-project-card-evolution]");

    if (title === "Scholar Lens") {
      const image = card.locator(".project-card-img");
      await image.evaluate((element) => element.decode());
      const responsiveEvidence = await image.evaluate((element) => ({
        currentPath: new URL(element.currentSrc).pathname,
        naturalHeight: element.naturalHeight,
        naturalWidth: element.naturalWidth,
      }));
      if (testInfo.project.name === "mobile-390") {
        expect(responsiveEvidence.currentPath).toMatch(/scholar-lens-designweaver-497b22266-390-light\.png$/);
        expect(responsiveEvidence).toMatchObject({ naturalHeight: 270, naturalWidth: 360 });
      } else {
        expect(responsiveEvidence.currentPath).toMatch(/scholar-lens-designweaver-497b22266-1440-light\.png$/);
        expect(responsiveEvidence).toMatchObject({ naturalHeight: 900, naturalWidth: 1440 });
      }
    }

    await card.scrollIntoViewIfNeeded();
    await trigger.focus();
    await expect(trigger, `${title} preview trigger cannot receive focus`).toBeFocused();
    await trigger.press("Enter");

    await expect(card, `${title} did not expand`).toHaveAttribute("data-project-card-state", "expanded");
    await expect(page.locator(".projects [data-project-card-state='expanded']")).toHaveCount(1);
    await expect(panel).toBeVisible();
    await expect(story).toBeVisible();
    await expect(primaryAction).toBeVisible();
    await expect(primaryAction, `${title} keyboard expansion did not advance focus`).toBeFocused();
    await expect(origin.locator(".project-card-story-label")).toHaveText("Why it began");
    expect((await origin.locator("p:last-child").innerText()).trim().length, `${title} origin story is too slight`).toBeGreaterThan(30);

    if (title === "Not A Good Driver") {
      await expect(evolution).toHaveCount(0);
    } else {
      await expect(evolution).toHaveCount(1);
      await expect(evolution.locator(".project-card-story-label")).toHaveText("What changed");
      expect((await evolution.locator("p:last-child").innerText()).trim().length, `${title} evolution story is too slight`).toBeGreaterThan(30);
    }

    await expect
      .poll(() => card.evaluate((element) => element.getAnimations({ subtree: true }).length), {
        message: `${title} expanded preview did not settle`,
      })
      .toBe(0);

    const geometry = await card.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const action = element.querySelector("[data-project-card-primary-action]")?.getBoundingClientRect();
      const close = element.querySelector("[data-project-card-close]")?.getBoundingClientRect();
      const storyBeats = Array.from(element.querySelectorAll(".project-card-story-beat"));
      return {
        actionHeight: action?.height ?? 0,
        actionWidth: action?.width ?? 0,
        cardLeft: bounds.left,
        cardRight: bounds.right,
        closeHeight: close?.height ?? 0,
        closeWidth: close?.width ?? 0,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        clippedStoryBeats: storyBeats.filter((beat) => beat.scrollWidth > beat.clientWidth + 1 || beat.scrollHeight > beat.clientHeight + 1).length,
        storyBeatWidths: storyBeats.map((beat) => beat.getBoundingClientRect().width),
      };
    });
    expect(geometry.actionHeight, `${title} primary action is shorter than 44px`).toBeGreaterThanOrEqual(44);
    expect(geometry.actionWidth, `${title} primary action is narrower than 44px`).toBeGreaterThanOrEqual(44);
    expect(geometry.closeHeight, `${title} close action is shorter than 44px`).toBeGreaterThanOrEqual(44);
    expect(geometry.closeWidth, `${title} close action is narrower than 44px`).toBeGreaterThanOrEqual(44);
    expect(geometry.cardLeft, `${title} expands left of the viewport`).toBeGreaterThanOrEqual(-1);
    expect(geometry.cardRight, `${title} expands right of the viewport`).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 1);
    expect(geometry.documentOverflow, `${title} expansion creates horizontal overflow`).toBeLessThanOrEqual(1);
    expect(geometry.clippedStoryBeats, `${title} clips expanded story copy`).toBe(0);
    expect(
      geometry.storyBeatWidths.every((width) => width >= 200),
      `${title} expanded story is squeezed`
    ).toBe(true);

    await closeButton.focus();
    await expect(closeButton).toBeFocused();
    await closeButton.press("Enter");
    await expect(card, `${title} did not close`).toHaveAttribute("data-project-card-state", "collapsed");
    await expect(page.locator(".projects [data-project-card-state='expanded']")).toHaveCount(0);
    await expect(panel).toBeHidden();
    await expect(trigger, `${title} did not restore focus to its preview trigger`).toBeFocused();
  }

  expect(runtimeErrors, "all-eleven project-card expansion raised browser runtime errors").toEqual([]);
});

test("all eleven fun stories fit a high-DPR scaled canvas", async ({ browser }, testInfo) => {
  test.setTimeout(180000);
  test.skip(testInfo.project.name !== "desktop-1440", "one Chromium context covers the high-DPR effective viewport");

  const routes = SITEWIDE_ROUTES.filter((route) => FUN_PROJECT_ROUTE_IDS.has(route.id));
  expect(routes).toHaveLength(11);

  // A 720x500 CSS viewport at DPR 2 retains a 1440x1000 pixel canvas while
  // independently exercising the compact responsive layout.
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    locale: "en-US",
    screen: { width: 1440, height: 1000 },
    timezoneId: "America/Los_Angeles",
    viewport: { width: 720, height: 500 },
  });
  const page = await context.newPage();
  const runtimeErrors = collectRuntimeErrors(page);

  try {
    await preparePage(page, "light");
    for (const route of routes) {
      const response = await page.goto(publicRouteUrl(route.path), { waitUntil: "domcontentloaded" });
      expect(response, `${route.path} has no response at the scaled viewport`).not.toBeNull();
      expect(response.status(), `${route.path} failed at the scaled viewport`).toBeLessThan(400);
      await expect(page.locator(route.readySelector).first()).toBeVisible();
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
      });
      await stabilizeVisuals(page);

      const geometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        devicePixelRatio: window.devicePixelRatio,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(geometry.clientWidth).toBe(720);
      expect(geometry.devicePixelRatio).toBe(2);
      expect(geometry.scrollWidth - geometry.clientWidth, `${route.path} overflows at the scaled viewport`).toBeLessThanOrEqual(1);

      const hero = page.locator(".project-case-hero").first();
      const copy = hero.locator(":scope > .project-case-copy");
      const media = hero.locator(":scope > .project-case-media");
      await expect(copy).toBeVisible();
      if ((await media.count()) > 0) {
        await expect(media).toBeVisible();
        const order = await hero.evaluate((element) => {
          const copyBox = element.querySelector(":scope > .project-case-copy")?.getBoundingClientRect();
          const mediaBox = element.querySelector(":scope > .project-case-media")?.getBoundingClientRect();
          return copyBox && mediaBox ? { copyTop: copyBox.top, mediaTop: mediaBox.top } : null;
        });
        expect(order, `${route.path} has no measurable hero at the scaled viewport`).not.toBeNull();
        expect(order.mediaTop, `${route.path} puts media before its story at the scaled viewport`).toBeGreaterThan(order.copyTop);
      }

      expect(runtimeErrors, `${route.path} raised errors at DPR 2`).toEqual([]);
      runtimeErrors.length = 0;
    }
  } finally {
    await context.close();
  }
});

test("all eleven fun stories reflow at 200% root text size", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  test.skip(testInfo.project.name !== "desktop-1440", "one desktop context covers text-only 200% reflow");

  const routes = SITEWIDE_ROUTES.filter((route) => FUN_PROJECT_ROUTE_IDS.has(route.id));
  expect(routes).toHaveLength(11);
  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");

  for (const route of routes) {
    const response = await page.goto(publicRouteUrl(route.path), { waitUntil: "domcontentloaded" });
    expect(response, `${route.path} has no response at 200% root text size`).not.toBeNull();
    expect(response.status(), `${route.path} failed at 200% root text size`).toBeLessThan(400);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await expect(page.locator(route.readySelector).first()).toBeVisible();
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await stabilizeVisuals(page);

    const geometry = await page.evaluate(() => {
      const root = document.documentElement;
      const textElements = Array.from(
        document.querySelectorAll(
          ".project-case-copy h1, .project-case-copy p, .project-case-summary p, .project-story-beat h3, .project-story-beat p, .scholar-story-trace h3, .scholar-story-trace p, .project-story-note h2, .project-story-note p, .site-experiment-reproduce h2, .site-experiment-reproduce p, .site-experiment-evidence-figure figcaption"
        )
      ).filter((element) => element.getClientRects().length > 0);
      const controls = Array.from(document.querySelectorAll(".project-case-actions a, details.project-story-disclosure > summary")).filter(
        (element) => element.getClientRects().length > 0
      );
      return {
        clippedText: textElements
          .filter((element) => {
            const style = getComputedStyle(element);
            const clips = (value) => ["auto", "clip", "hidden", "scroll"].includes(value);
            return (
              (clips(style.overflowX) && element.scrollWidth > element.clientWidth + 1) ||
              (clips(style.overflowY) && element.scrollHeight > element.clientHeight + 1)
            );
          })
          .map((element) => element.textContent.replace(/\s+/g, " ").trim().slice(0, 80)),
        controlSizes: controls.map((element) => {
          const box = element.getBoundingClientRect();
          return { height: box.height, width: box.width };
        }),
        fontSize: Number.parseFloat(getComputedStyle(root).fontSize),
        overflow: Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth,
        textCount: textElements.length,
      };
    });

    expect(geometry.fontSize, `${route.path} did not receive 200% root text`).toBe(32);
    expect(geometry.overflow, `${route.path} overflows with 200% root text`).toBeLessThanOrEqual(1);
    expect(geometry.textCount, `${route.path} exposes too little story text for a reflow check`).toBeGreaterThan(5);
    expect(geometry.clippedText, `${route.path} clips text at 200%: ${geometry.clippedText.join(" | ")}`).toEqual([]);
    expect(geometry.controlSizes.length, `${route.path} exposes no story controls at 200%`).toBeGreaterThan(1);
    expect(
      geometry.controlSizes.every((box) => box.height >= 44 && box.width >= 44),
      `${route.path} has an undersized control at 200% root text`
    ).toBe(true);
    expect(runtimeErrors, `${route.path} raised errors at 200% root text`).toEqual([]);
    runtimeErrors.length = 0;
  }
});

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

test("home Build Rhythm ledger stays readable and truthful", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const usageResponse = await page.request.get(publicRouteUrl("/assets/data/codex-profile-usage.json"));
  expect(usageResponse.ok()).toBe(true);
  const usage = await usageResponse.json();
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  await stabilizeVisuals(page);

  const ledger = page.locator(".home-agentic-heartbeat");
  await ledger.scrollIntoViewIfNeeded();
  await expect(ledger).toBeVisible();
  await expect(ledger).toHaveAccessibleName("Open Build Rhythm");
  await expect(ledger).toContainText(`${usage.combined_lifetime.tokens_label} combined lifetime Codex tokens`);
  await expect(ledger).toContainText(usage.automated_refresh ? "Refreshed" : "Observed");
  await expect(ledger.locator("time")).toHaveAttribute("datetime", usage.automated_refresh ? usage.updated_at : usage.observed_on);
  await expect(ledger).toContainText(/\d+ GitHub commits/);
  await expect(ledger).not.toContainText("2-account quota health");
  await expect(ledger.locator(".home-agentic-heartbeat-sparkline")).toHaveCount(0);

  const geometry = await ledger.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const statusStyle = getComputedStyle(element.querySelector(".home-agentic-heartbeat-status"));
    const title = element.querySelector(".home-agentic-heartbeat-copy strong");
    const copyBounds = element.querySelector(".home-agentic-heartbeat-copy").getBoundingClientRect();
    const routeBounds = element.querySelector(".home-agentic-heartbeat-route").getBoundingClientRect();
    const groups = Array.from(element.querySelectorAll(".home-agentic-heartbeat-meta > span")).map((group) => ({
      rectCount: group.getClientRects().length,
      width: group.getBoundingClientRect().width,
    }));
    return {
      left: bounds.left,
      right: bounds.right,
      height: bounds.height,
      groups,
      copyBottom: copyBounds.bottom,
      copyLeft: copyBounds.left,
      routeLeft: routeBounds.left,
      routeTop: routeBounds.top,
      statusAnimation: statusStyle.animationName,
      titleRectCount: title.getClientRects().length,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.height).toBeGreaterThanOrEqual(44);
  expect(geometry.groups).toHaveLength(2);
  expect(geometry.groups.every((group) => group.rectCount === 1 && group.width > 0)).toBe(true);
  expect(geometry.titleRectCount).toBe(1);
  expect(geometry.statusAnimation).toBe("none");
  expect(geometry.scrollWidth - geometry.clientWidth).toBeLessThanOrEqual(1);
  if (testInfo.project.name === "mobile-390") {
    expect(geometry.routeTop).toBeGreaterThanOrEqual(geometry.copyBottom - 1);
    expect(geometry.routeLeft).toBeGreaterThanOrEqual(geometry.copyLeft - 1);
  }

  await ledger.focus();
  await expect(ledger).toBeFocused();
  expect(await ledger.evaluate((element) => Number.parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2);
  await attachScreenshot(page, testInfo, `home-build-rhythm-ledger-${testInfo.project.name}`, { locator: ledger });
  expect(runtimeErrors).toEqual([]);
});

test("mobile back-to-top control yields the reading surface to an inline footer link", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "the fixed control only risks narrow-screen prose");

  const runtimeErrors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/projects/paper-constellation/"), { waitUntil: "domcontentloaded" });
  await stabilizeVisuals(page);
  await page.locator(".site-experiment-reproduce").scrollIntoViewIfNeeded();

  const floatingControl = page.locator("#back-to-top");
  const footerControl = page.locator(".mobile-back-to-top");
  await expect(floatingControl).toBeHidden();
  await expect(footerControl).toBeVisible();
  await expect(footerControl).toHaveAttribute("href", "#top");
  await expect(footerControl).toHaveAccessibleName("Back to top");
  const target = await footerControl.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { height: box.height, width: box.width };
  });
  expect(target.height).toBeGreaterThanOrEqual(44);
  expect(target.width).toBeGreaterThanOrEqual(44);
  expect(runtimeErrors).toEqual([]);
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

test("projects keep the ten site experiments in debut order", async ({ page }, testInfo) => {
  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/projects/"), { waitUntil: "domcontentloaded" });

  const grid = page.locator("[data-site-experiment-grid]");
  await expect(grid).toBeVisible();
  await exerciseScrollReveals(page, {
    selector: "[data-site-experiment-grid] .card.site-reveal",
    visibleClass: "site-visible",
  });

  const cards = grid.locator("[data-project-card]");
  await expect(cards).toHaveCount(10);
  await expect(cards.locator("h4.card-title")).toHaveCount(10);
  await expect(cards.locator("h3.card-title")).toHaveCount(0);
  expect(await cards.locator(".card-title").allTextContents()).toEqual([
    "Scaffolding for Taste — OpenAI Build Week",
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
  expect(imageEvidence.count).toBe(10);
  expect(imageEvidence.loaded).toBe(true);
  expect(imageEvidence.overflow).toBeLessThanOrEqual(0);

  const ikeaCard = cards.filter({ has: page.getByRole("heading", { name: "The IKEA Card Experiment", exact: true }) });
  await expect(ikeaCard).toHaveCount(1);
  const ikeaImage = ikeaCard.locator("img");
  await expect(ikeaImage).toHaveAttribute("src", /\/assets\/img\/project_pics\/site-experiments\/ikea-card-expanded\.png$/);
  expect(
    await ikeaImage.evaluate((element) => ({
      complete: element.complete,
      naturalHeight: element.naturalHeight,
      naturalWidth: element.naturalWidth,
    }))
  ).toEqual({ complete: true, naturalHeight: 650, naturalWidth: 1200 });

  await attachScreenshot(page, testInfo, `projects-site-experiments-${testInfo.project.name}`, { fullPage: true });
});

test("desk origin stays bounded and still under reduced motion", async ({ page }, testInfo) => {
  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });

  const switcher = page.locator("[data-home-desk-mode-switch]");
  const origin = switcher.getByRole("link", { name: "Read how the desk scene began" });
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
    const modeTargets = Array.from(modeSwitcher?.querySelectorAll("[data-home-desk-mode]") ?? []).map((control) => {
      const rect = control.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    });
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
      modeTargets,
      sameRow: centers.length === 3 && Math.max(...centers) - Math.min(...centers) <= 2,
      mobileTooltipBelow: linkRect && tipRect ? tipRect.top >= linkRect.bottom : false,
      contactOverlap: overlap,
    };
  });

  expect(geometry.documentOverflow).toBeLessThanOrEqual(0);
  expect(geometry.tooltipOverflow).toBeLessThanOrEqual(1);
  const compactTargetMinimum = 24 - 0.01;
  expect(geometry.originWidth).toBeGreaterThanOrEqual(compactTargetMinimum);
  expect(geometry.originHeight).toBeGreaterThanOrEqual(compactTargetMinimum);
  expect(geometry.modeTargets).toHaveLength(2);
  expect(geometry.modeTargets.every(({ width, height }) => width >= compactTargetMinimum && height >= compactTargetMinimum)).toBe(true);
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
  // Dispatch synchronously so Playwright does not absorb the deliberately delayed
  // route transition into click auto-waiting on a loaded CI runner.
  await mango.evaluate((button) => button.click());
  const status = page.locator("#sirui-secret-status");
  await expect(status).toContainText("mango is on Sirui's list.");
  expect(await status.textContent()).not.toMatch(/guess|correct/i);
  await expect(origin).toBeVisible();
  await expect(origin.getByRole("link", { name: "Read how this portal began" })).toHaveAttribute("href", /\/projects\/dogtor-portal\/$/);
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
