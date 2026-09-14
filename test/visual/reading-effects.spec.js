const { test, expect } = require("@playwright/test");
const { preparePage, collectRuntimeErrors, screenshotDiffRatio } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

test("reading: inspection lens, direct materials, and a responsive explanation", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "noon");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(publicRouteUrl("/projects/designweaver/"));
  const frame = page.locator(".research-lens").first();
  await frame.scrollIntoViewIfNeeded();
  await expect(page.locator(".research-lens__open").first()).toHaveAttribute("href", /tool_design_all_features/);
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

test("reading: one type family and aligned articles; Fun keeps color for focus and reduced motion", async ({ page }, testInfo) => {
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
  const card = page.locator("[data-site-experiment-grid] .project-card").first();
  const img = card.locator(".project-card-media img").first();
  await card.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  const filter = () => img.evaluate((e) => getComputedStyle(e).filter);
  await expect.poll(filter).toBe(testInfo.project.name === "mobile-390" ? "none" : "grayscale(0.88)");
  await card.locator(".project-card-direct-link").focus();
  await expect.poll(filter).toBe("none");
  await page.locator("body").click({ position: { x: 1, y: 1 }, force: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(filter).toBe("none");
});
