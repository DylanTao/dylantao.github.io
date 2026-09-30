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
      const article = post.querySelector("article");
      return {
        font: getComputedStyle(h).fontFamily,
        size: parseFloat(getComputedStyle(h).fontSize),
        h: h.getBoundingClientRect().x,
        article: article.getBoundingClientRect().x,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(result.font).toContain("Inter");
    expect(result.size).toBeGreaterThanOrEqual(34);
    expect(result.size).toBeLessThanOrEqual(44);
    expect(Math.abs(result.h - result.article)).toBeLessThan(2);
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
  await card.locator(".project-card-direct-link").focus();
  await expect.poll(filters).toEqual(["none"]);
  await page.locator("body").click({ position: { x: 1, y: 1 }, force: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(filters).toEqual(["none"]);
});
