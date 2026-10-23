const { test, expect } = require("@playwright/test");
const { preparePage, collectRuntimeErrors } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

test("theme stops remain available during comparisons and Escape returns focus", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "noon");
  await page.goto(`${publicRouteUrl("/blog/")}?cinematic=live`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.SiteMotion?.waterReveal);
  await page.locator("#theme-toggle").click();
  for (const mode of ["evening", "morning", "afternoon"]) {
    await page.locator(`#theme-menu [data-theme-mode-option="${mode}"]`).click({ noWaitAfter: true });
    await expect(page.locator("html")).toHaveAttribute("data-theme-mode", mode);
    await expect(page.locator("#theme-menu")).toBeVisible();
    await expect(page.locator(`#theme-menu [data-theme-mode-option="${mode}"]`)).toHaveAttribute("aria-selected", "true");
  }
  await page.waitForFunction(() => !document.documentElement.classList.contains("theme-revealing"));
  const selected = page.locator('#theme-menu [aria-selected="true"]');
  const marker = page.locator("#theme-menu [data-theme-stop-indicator]");
  const a = await selected.boundingBox(),
    b = await marker.boundingBox();
  expect(Math.abs(a.x - b.x)).toBeLessThan(1);
  expect(Math.abs(a.width - b.width)).toBeLessThan(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("#theme-menu")).toBeHidden();
  await expect(page.locator("#theme-toggle")).toBeFocused();
  expect(errors).toEqual([]);
});

test("page navigation reverses an available axis on Back and retains stationary chrome", async ({ page }) => {
  await preparePage(page, "noon");
  await page.addInitScript(() => {
    addEventListener("pagereveal", (event) => {
      if (!event.viewTransition) return;
      event.viewTransition.ready.then(
        () => {
          window.routeMotionEvidence = document.documentElement.dataset.routeDirection;
        },
        () => {}
      );
    });
  });
  await page.goto(publicRouteUrl("/blog/"), { waitUntil: "domcontentloaded" });
  const hasNavigationIndices = await page.evaluate(() => Boolean(window.navigation));
  const chrome = await page.locator("#navbar").boundingBox();
  // A real same-origin link, so both documents participate in the browser transition.
  const projects = page.locator('#navbar a[href$="/projects/"]').first();
  if (!(await projects.isVisible())) await page.locator("#navbar .navbar-toggler").click();
  await projects.click();
  await expect(page).toHaveURL(/\/projects\/$/);
  await expect.poll(() => page.evaluate(() => window.routeMotionEvidence)).toBe(hasNavigationIndices ? "forward" : undefined);
  expect(await page.locator("#navbar").boundingBox()).toEqual(chrome);
  await page.waitForFunction(() => !document.documentElement.dataset.routeDirection);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate(() => window.routeMotionEvidence)).toBe(hasNavigationIndices ? "back" : undefined);
});

test("ink close changes semantics immediately and cancels its prose copy on reopening", async ({ page, isMobile }) => {
  await preparePage(page, "noon");
  await page.goto(`${publicRouteUrl("/projects/")}?cinematic=live`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.SiteMotion?.dissolveCardInk);
  const card = page.locator("[data-project-card]:not([data-project-deck]):has(#project-card-not-a-good-driver-panel)");
  const trigger = card.locator("[data-project-card-trigger]");
  if (isMobile) await trigger.tap();
  else await trigger.click();
  await expect(card).toHaveAttribute("data-project-card-state", "expanded");
  await page.waitForFunction(() => !document.querySelector(".is-reflowing"));
  const instant = new Date("2026-10-23T08:00:00Z");
  await page.clock.install({ time: instant });
  await page.clock.pauseAt(new Date(instant.getTime() + 1000));
  await card.locator("[data-project-card-close]").focus();
  await card.locator("[data-project-card-close]").evaluate((button) => button.click());
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
  // Below the wide card layout, closing gives the story's space to the links beneath it.
  const narrow = await page.evaluate(() => innerWidth < 992);
  await expect(page.locator(".project-card-ink")).toHaveCount(narrow ? 0 : 1);
  await expect(page.locator(".project-card-ink img, .project-card-ink canvas, .project-card-ink video")).toHaveCount(0);
  if (!narrow)
    expect(await page.locator(".project-card-ink").evaluate((node) => node.inert && node.getAttribute("aria-hidden") === "true")).toBe(true);
  await trigger.evaluate((button) => button.click());
  await expect(page.locator(".project-card-ink")).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.clock.runFor(700);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await card.locator("[data-project-card-close]").evaluate((button) => button.click());
  await expect(page.locator(".project-card-ink")).toHaveCount(0);
});

test("sidenotes preserve one copy and native reference links across widths", async ({ page }) => {
  await preparePage(page, "noon");
  await page.goto(publicRouteUrl("/blog/2026/when-the-website-talks-back/"), { waitUntil: "domcontentloaded" });
  await expect(page.locator(".footnotes > ol > li")).toHaveCount(3);
  await expect(page.locator("a.footnote")).toHaveCount(3);
  await expect(page.locator(".footnotes")).toHaveAttribute("aria-label", "Notes");
  const positions = await page.locator(".footnotes > ol > li").evaluateAll((notes) =>
    notes.map((note) => {
      const box = note.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, right: box.right, position: getComputedStyle(note).position };
    })
  );
  for (let i = 1; i < positions.length; i++) expect(positions[i].top).toBeGreaterThanOrEqual(positions[i - 1].bottom);
  expect(Math.max(...positions.map((note) => note.right))).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.locator("a.footnote").first().click();
  await expect(page).toHaveURL(/#fn:schon$/);
  expect(await page.locator("[data-sidenotes]").count()).toBe(1);
});
