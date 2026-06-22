const { test, expect } = require("@playwright/test");
const { preparePage, stabilizeVisuals } = require("./helpers");

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

  const nav = page.locator(".navbar-collapse").first();
  await toggle.click();
  await expect(nav).toHaveClass(/show/);

  await toggle.click();
  await expect(nav).not.toHaveClass(/show/);
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

test("navbar menu stays right-aligned on desktop pages", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "desktop-only alignment contract");

  await preparePage(page, "light");
  await page.goto("/al-folio/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  const alignment = await page.evaluate(() => {
    const container = document.querySelector("#navbar .container");
    const menu = document.querySelector("#navbarNav .navbar-menu-list");
    if (!container || !menu) {
      return null;
    }
    const containerBox = container.getBoundingClientRect();
    const menuBox = menu.getBoundingClientRect();
    return {
      containerRight: containerBox.right,
      menuRight: menuBox.right,
    };
  });

  expect(alignment).not.toBeNull();
  expect(Math.abs(alignment.menuRight - alignment.containerRight)).toBeLessThanOrEqual(24);
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
  const homeRoute = process.env.NO_WEBSERVER && process.env.VISUAL_BASE_URL ? "/" : "/al-folio/";
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
  const homeRoute = process.env.NO_WEBSERVER && process.env.VISUAL_BASE_URL ? "/" : "/al-folio/";
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
  const homeRoute = process.env.NO_WEBSERVER && process.env.VISUAL_BASE_URL ? "/" : "/al-folio/";
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

  await clickDeskCanvasAt(page, 0.86, 0.38);
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

  await clickDeskCanvasAt(page, 0.86, 0.38);
  await expect(page.locator("html")).toHaveClass(/home-desk-outside-active/);
  await expect(scene).toHaveClass(/is-outside-view/);

  await page.locator(".home-agentic-tally").scrollIntoViewIfNeeded();
  await expect(page.locator("html")).not.toHaveClass(/home-desk-outside-active/);
  await expect(scene).not.toHaveClass(/is-outside-view/);
});

test("home 3D album rack ignores dropped sleeves and replaces focused albums", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "desktop canvas hit zones use desktop framing");

  await preparePage(page, "light");
  const homeRoute = process.env.NO_WEBSERVER && process.env.VISUAL_BASE_URL ? "/" : "/al-folio/";
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

test("navbar search button opens modal and toggle buttons use pointer cursor", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "navbar search/theme controls are collapsed under mobile menu");

  await preparePage(page, "light");
  await page.goto("/al-folio/", { waitUntil: "networkidle" });
  await stabilizeVisuals(page);

  await page.evaluate(() => {
    const ninjaKeys = document.querySelector("ninja-keys");
    if (!ninjaKeys || typeof ninjaKeys.open !== "function") {
      return;
    }
    ninjaKeys.__openCalled = false;
    const originalOpen = ninjaKeys.open.bind(ninjaKeys);
    ninjaKeys.open = () => {
      ninjaKeys.__openCalled = true;
      return originalOpen();
    };
  });

  await page.click("#search-toggle");
  const modalOpened = await page.evaluate(() => Boolean(document.querySelector("ninja-keys")?.__openCalled));
  expect(modalOpened).toBeTruthy();

  const searchCursor = await page.locator("#search-toggle").evaluate((el) => window.getComputedStyle(el).cursor);
  const themeCursor = await page.locator("#light-toggle").evaluate((el) => window.getComputedStyle(el).cursor);
  expect(searchCursor).toBe("pointer");
  expect(themeCursor).toBe("pointer");
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
