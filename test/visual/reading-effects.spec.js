const { test, expect } = require("@playwright/test");
const { preparePage, collectRuntimeErrors, screenshotDiffRatio } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

test("details: the research spread keeps its figure complete and notes readable", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "noon");
  await page.goto(publicRouteUrl("/projects/designweaver/"));
  const spread = page.locator(".artifact-spread");
  await spread.scrollIntoViewIfNeeded();
  await expect(spread.getByRole("heading", { name: "Put the vocabulary next to the image." })).toBeVisible();
  const geometry = await spread.evaluate((element) => {
    const image = element.querySelector("img");
    const notes = element.querySelector("aside").getBoundingClientRect();
    const figure = element.querySelector(".artifact-spread__artifact").getBoundingClientRect();
    return {
      loaded: image.complete && image.naturalWidth > 0,
      ratio: image.width / image.height,
      original: image.naturalWidth / image.naturalHeight,
      beside: notes.left >= figure.right,
      below: notes.top >= figure.bottom,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(geometry.loaded).toBe(true);
  expect(Math.abs(geometry.ratio - geometry.original)).toBeLessThan(0.02);
  expect(page.viewportSize().width > 850 ? geometry.beside : geometry.below).toBe(true);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  await spread.screenshot({ path: testInfo.outputPath("artifact-spread.png") });
  expect(errors).toEqual([]);
});

test("details: copy feedback waits for success and explains a clipboard refusal", async ({ page }) => {
  await preparePage(page, "noon");
  await page.addInitScript(() => {
    window.copyAllowed = false;
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text) => {
          await new Promise((resolve) => setTimeout(resolve, 120));
          if (!window.copyAllowed) throw new DOMException("Clipboard denied", "NotAllowedError");
          window.copiedText = text;
        },
      },
    });
  });
  await page.goto(publicRouteUrl("/blog/2026/website-redesign-ai-agent/"));
  const wrapper = page.locator(".code-display-wrapper").first();
  const button = wrapper.locator("button.copy");
  await button.click();
  await expect(wrapper.locator('[role="status"]')).toContainText("Couldn’t copy");
  await expect(button).toHaveAccessibleName("Retry copying code");
  await page.evaluate(() => {
    window.copyAllowed = true;
  });
  await button.click();
  await expect(wrapper.locator('[role="status"]')).toHaveText("Copied");
  expect(await page.evaluate(() => window.copiedText.length)).toBeGreaterThan(0);
  await expect(button).toBeEnabled();
});

test("details: project expansion can be interrupted without losing keyboard focus", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "noon");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(publicRouteUrl("/projects/"));
  const card = page.locator("[data-project-card]").first();
  const trigger = card.locator("[data-project-card-trigger]");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(card).toHaveAttribute("data-project-card-state", "collapsed");
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(card.locator("[data-project-card-primary-action]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.closest("[data-project-card]")).length))
    .toBe(0);
  expect(errors).toEqual([]);
});

test("details: an opened project card keeps its row, stays inside the page, and hands back the reader's place", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "noon");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(publicRouteUrl("/projects/"));
  await page.evaluate(() => document.fonts.ready);
  // Keep duh's own pointer target out of the clicks below.
  await page.evaluate(() => document.querySelector(".duh-companion")?.style.setProperty("display", "none"));
  const cards = page.locator(".projects [data-project-card]");
  const card = cards.nth(2);
  const trigger = card.locator("[data-project-card-trigger]");
  await card.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
  // The card's box and the scroll offset in one read, so a page in motion cannot skew the comparison.
  const place = () =>
    card.evaluate((node) => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, pageY: box.y + scrollY, scrollY };
    });
  // A settled run has finished its scroll as well: two frames later the page has not moved.
  const drift = () =>
    page.evaluate(() => {
      const start = scrollY;
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(Math.abs(scrollY - start)))));
    });
  // Real pointer clicks at a fixed point, checked against what lies there, without Playwright's
  // actionability retries: a card lifting under the pointer reads as "not stable", and each retry
  // scrolls the target into view (smoothly, as this page scrolls) while the click lands, moving the
  // reader's place in the middle of the measurement.
  const clickAt = async (target, offset) => {
    const point = await target.evaluate((node, at) => {
      const box = node.getBoundingClientRect();
      const x = box.left + (at ? at.x : box.width / 2);
      const y = box.top + (at ? at.y : box.height / 2);
      const hit = document.elementFromPoint(x, y);
      return { x, y, hit: Boolean(hit && node.contains(hit)) };
    }, offset ?? null);
    expect(point.hit, "the click point lies on its target").toBe(true);
    await page.mouse.click(point.x, point.y);
  };
  const before = await place();
  const scrollBefore = before.scrollY;
  // Watch every frame of the change for a page that grows sideways.
  await page.evaluate(() => {
    window.__cardFrames = { overflow: 0, frames: 0, sampling: true };
    const sample = () => {
      window.__cardFrames.frames += 1;
      if (document.documentElement.scrollWidth > innerWidth + 1) window.__cardFrames.overflow += 1;
      if (window.__cardFrames.sampling) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await clickAt(trigger, { x: 12, y: 12 });
  await expect(card).toHaveAttribute("data-project-card-state", "expanded");
  const settled = () => cards.evaluateAll((items) => items.reduce((count, item) => count + item.getAnimations({ subtree: true }).length, 0));
  await expect.poll(settled).toBe(0);
  expect(await drift(), "the page was still scrolling after the cards settled").toBeLessThan(1);
  const open = await place();
  const columns = await card.evaluate((node) => getComputedStyle(node.parentElement).gridTemplateColumns.split(" ").length);
  // It opens in its own row (in page coordinates: a tall card on a phone may scroll once to show
  // its actions); a card at the end of a row grows back toward the row's start.
  // Within a few pixels (Linux text metrics land a sub-pixel row 2 px off); a row is hundreds tall.
  expect(Math.abs(open.pageY - before.pageY), "opened card left its row").toBeLessThan(3);
  if (columns >= 2) expect(Math.abs(open.x + open.width - (before.x + before.width)) < 2 || Math.abs(open.x - before.x) < 2).toBe(true);
  const geometry = await card.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const body = node.querySelector(".project-card-body").getBoundingClientRect();
    const picture = node.querySelector(".project-card-media").getBoundingClientRect();
    const close = node.querySelector("[data-project-card-close]").getBoundingClientRect();
    const links = Array.from(node.querySelectorAll("a[href]")).filter(
      (link) => link.getClientRects().length && /Read project page|Visit project site/.test(link.textContent)
    );
    const coversPicture = close.left < picture.right && close.right > picture.left && close.top < picture.bottom && close.bottom > picture.top;
    return {
      closeRight: box.right - close.right,
      closeTop: close.top - body.top,
      closeSize: Math.min(close.width, close.height),
      coversPicture,
      projectLinks: links.length,
    };
  });
  // The close button sits where the plus was, at the top of the copy, never over the picture; the
  // page link appears once.
  expect(geometry.coversPicture).toBe(false);
  expect(geometry.closeSize).toBeGreaterThanOrEqual(44);
  expect(geometry.closeRight).toBeGreaterThanOrEqual(0);
  expect(geometry.closeRight).toBeLessThan(24);
  expect(geometry.closeTop).toBeGreaterThanOrEqual(0);
  expect(geometry.closeTop).toBeLessThan(24);
  expect(geometry.projectLinks).toBe(1);
  // The story beside the picture is ordinary text: pointing at it does not land on the preview button.
  const storyPoint = await card.locator(".card-text").evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.matches("[data-project-card-trigger]"), storyPoint)).toBe(false);

  // A second card opened mid-flight continues from where the first run left everything.
  await cards.nth(0).evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
  const jump = await page.evaluate(async () => {
    const items = Array.from(document.querySelectorAll(".projects [data-project-card]"));
    items[0].querySelector("[data-project-card-trigger]").click();
    await new Promise((resolve) => setTimeout(resolve, 140));
    const before = items.map((item) => item.getBoundingClientRect());
    items[1].querySelector("[data-project-card-trigger]").click();
    const after = items.map((item) => item.getBoundingClientRect());
    return Math.max(...after.map((box, i) => Math.hypot(box.x - before[i].x, box.y - before[i].y)));
  });
  expect(jump, "cards jumped when a run was interrupted").toBeLessThan(1);
  await expect.poll(settled).toBe(0);
  await page.keyboard.press("Escape");
  await expect(cards.nth(1)).toHaveAttribute("data-project-card-state", "collapsed");
  await expect.poll(settled).toBe(0);
  const frames = await page.evaluate(() => {
    window.__cardFrames.sampling = false;
    return window.__cardFrames;
  });
  expect(frames.frames).toBeGreaterThan(10);
  expect(frames.overflow, "a gliding card widened the page").toBe(0);

  // Closing the first card from where it opened returns the reader to the same scroll position.
  await card.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
  const home = await page.evaluate(() => scrollY);
  await clickAt(trigger, { x: 12, y: 12 });
  await expect.poll(settled).toBe(0);
  expect(await drift(), "the page was still scrolling after the card opened").toBeLessThan(1);
  await clickAt(card.locator("[data-project-card-close]"));
  await expect(card).toHaveAttribute("data-project-card-state", "collapsed");
  await expect(trigger).toBeFocused();
  // The way back rides the closing card's clock: once it settles, the reader is home.
  await expect.poll(settled).toBe(0);
  expect(Math.round(await page.evaluate(() => scrollY)), "closing did not hand back the reader's place").toBe(Math.round(home));
  expect(await drift(), "the page was still scrolling after the card closed").toBeLessThan(1);
  await page.screenshot({ path: testInfo.outputPath("project-card-closed.png") });
  expect(scrollBefore).toBeGreaterThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("reading: inspection lens, direct materials, and a responsive explanation", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "noon");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(publicRouteUrl("/projects/designweaver/"));
  const frame = page.locator(".research-lens").first();
  await frame.scrollIntoViewIfNeeded();
  await expect(page.locator(".research-lens + .research-lens__open").first()).toHaveAttribute("href", /tool_design_all_features/);
  await expect(page.getByRole("link", { name: "Open original figure" })).toHaveAttribute("href", /publication_preview\/designweaver\.png$/);
  if (testInfo.project.name !== "mobile-390") {
    await frame.locator("img").hover();
    await expect(frame.locator(".research-lens__glass")).toBeVisible();
    await page.mouse.move(1, 1);
    await expect(frame.locator(".research-lens__glass")).toBeHidden();
  }
  const folder = page.locator(".resource-folder");
  await folder.locator("summary").click();
  await expect(folder.getByRole("link")).toHaveCount(3);
  for (const link of await folder.getByRole("link").all()) await expect(link).toBeVisible();
  await expect(page.locator(".project-case-actions a").first()).toBeVisible();
  const position = await page.locator(".case-scroll-hero > .project-case-media").evaluate((e) => getComputedStyle(e).position);
  expect(position).toBe(testInfo.project.name === "desktop-1440" ? "sticky" : "static");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("reading: project preview supports focus and Escape; comparison responds to keyboard", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "evening");
  await page.goto(publicRouteUrl("/projects/website-revamp/"));
  const link = page.locator('.project-detail p a[href$="/projects/la-jolla/"]').first();
  await link.focus();
  const preview = page.locator("#project-link-preview");
  await expect(preview).toBeVisible();
  await expect(link).toHaveAttribute("aria-describedby", "project-link-preview");
  await expect.poll(() => preview.locator("img").evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  const compare = page.locator("[data-compare]");
  await compare.scrollIntoViewIfNeeded();
  const range = compare.getByRole("slider");
  await range.focus();
  await range.press("Home");
  await expect(range).toHaveAttribute("aria-valuetext", "0% after");
  const before = await compare.locator(".image-compare__images").screenshot();
  await range.press("End");
  await expect(range).toHaveAttribute("aria-valuetext", "100% after");
  expect(screenshotDiffRatio(before, await compare.locator(".image-compare__images").screenshot())).toBeGreaterThan(0.05);
  expect(errors).toEqual([]);
});

test("reading: one type family and aligned articles; every project keeps its original color", async ({ page }) => {
  await preparePage(page, "noon");
  for (const route of ["/projects/designweaver/", "/blog/2026/research-skills-starter-pack/"]) {
    await page.goto(publicRouteUrl(route));
    const result = await page.evaluate(() => {
      const post = document.querySelector(".project-detail, .blog-post");
      const h = post.querySelector("h1");
      // The title aligns with the reading column (the first body paragraph); the article
      // itself stays wider so figures can extend symmetrically past the text.
      const prose = post.querySelector("article > p, #markdown-content > p");
      return {
        font: getComputedStyle(h).fontFamily,
        size: parseFloat(getComputedStyle(h).fontSize),
        h: h.getBoundingClientRect().x,
        prose: prose.getBoundingClientRect().x,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(result.font).toContain("Inter");
    expect(result.size).toBeGreaterThanOrEqual(34);
    expect(result.size).toBeLessThanOrEqual(44);
    expect(Math.abs(result.h - result.prose)).toBeLessThan(2);
    expect(result.overflow).toBeLessThanOrEqual(1);
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(publicRouteUrl("/projects/"));
  const filters = () =>
    page.locator(".project-card-media img").evaluateAll((images) => [...new Set(images.map((img) => getComputedStyle(img).filter))]);
  const card = page.locator("[data-site-experiment-grid] .project-card").first();
  await card.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await expect.poll(filters).toEqual(["none"]);
  // The first experiment is the website revamp's deck, which holds the other cards; use its own link.
  await card.locator(":scope > .card .project-card-direct-link").focus();
  await expect.poll(filters).toEqual(["none"]);
  await page.locator("body").click({ position: { x: 1, y: 1 }, force: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(filters).toEqual(["none"]);
});
