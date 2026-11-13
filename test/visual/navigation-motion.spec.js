const { test, expect } = require("@playwright/test");
const { PNG } = require("pngjs");
const { writeFile } = require("node:fs/promises");
const { preparePage, collectRuntimeErrors, screenshotDiffRatio } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const { pauseSceneClock } = require("./scene-clock");

function readingShapeDifference(actual, reference) {
  const a = PNG.sync.read(actual),
    b = PNG.sync.read(reference);
  // Native mobile scrolling can settle by one device pixel between compositor captures.
  // Register that whole-frame translation; a local stretch at the header still fails.
  let best = { ratio: 1, translationY: 0 };
  for (const translationY of [-1, 0, 1]) {
    const height = a.height - 4;
    const ca = new PNG({ width: a.width, height }),
      cb = new PNG({ width: b.width, height });
    PNG.bitblt(a, ca, 0, 2, a.width, height, 0, 0);
    PNG.bitblt(b, cb, 0, 2 + translationY, b.width, height, 0, 0);
    const ratio = screenshotDiffRatio(PNG.sync.write(ca), PNG.sync.write(cb), { threshold: 0.05 });
    if (ratio < best.ratio) best = { ratio, translationY };
  }
  return best;
}

for (const theme of ["light", "dark"]) {
  test(`article lines keep their shape as they pass the fixed header (${theme})`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await preparePage(page, theme);
    await page.goto(`${publicRouteUrl("/blog/2026/research-skills-starter-pack/")}?cinematic=live`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const paragraph = page.locator("#markdown-content p").first();
    await expect(paragraph).toBeVisible();
    const clip = await paragraph.evaluate(async (node) => {
      const header = document.querySelector("#navbar");
      // Use real scrolling and live animation. A paused/reduced-motion page can conceal a
      // compositor-only displacement of glyphs as they cross the fixed header's lower edge.
      for (let i = 0; i < 2; i++) {
        window.scrollTo({ top: scrollY + node.getBoundingClientRect().top - header.getBoundingClientRect().bottom + 10, behavior: "instant" });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      const r = node.getBoundingClientRect();
      return { x: Math.ceil(r.x), y: Math.ceil(header.getBoundingClientRect().bottom + 1), width: Math.floor(r.width) - 1, height: 50 };
    });
    // Let this block's ordinary, once-only GSAP entrance finish. Keep real scrolling and the
    // site's live motion enabled; comparing two points in an entrance measures translation.
    await expect.poll(() => paragraph.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
    const geometry = () =>
      paragraph.evaluate((node) => {
        const r = node.getBoundingClientRect(),
          d = document.querySelector(".duh-companion")?.getDuhEvidence?.();
        return {
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
          scrollY,
          transform: getComputedStyle(node).transform,
          duh: d ? { x: d.x, y: d.y, visible: d.visible, state: d.state, pageContacts: d.pageContacts, repairs: d.repairs } : null,
        };
      });
    const readingGeometry = await geometry();
    const reading = await page.screenshot({ clip, path: testInfo.outputPath(`reading-${theme}.png`) });
    // The reference removes only an overlay outside the bar; it keeps fonts, theme, layout,
    // frosted header and the actual article unchanged. Visible glyphs must retain their shape.
    await page.addStyleTag({ content: "header#top::after { content: none !important; }" });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const referenceGeometry = await geometry();
    const unobstructed = await page.screenshot({ clip, path: testInfo.outputPath(`reading-reference-${theme}.png`) });
    await testInfo.attach(`reading-${theme}`, { body: reading, contentType: "image/png" });
    await testInfo.attach(`reading-reference-${theme}`, { body: unobstructed, contentType: "image/png" });
    const difference = readingShapeDifference(reading, unobstructed);
    await writeFile(
      testInfo.outputPath(`reading-${theme}.json`),
      JSON.stringify({ clip, ...difference, readingGeometry, referenceGeometry, errors }, null, 2)
    );
    expect(difference.ratio, "the reading edge must not bend article glyphs").toBeLessThan(0.002);
    expect(errors).toEqual([]);
  });
}

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
  // Acquire the pause without a wall-clock deadline that can expire during CI's browser IPC.
  await pauseSceneClock(page);
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

test("the video row can be thrown with a mouse and yields at once to any other input", async ({ page, isMobile }) => {
  const errors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await preparePage(page, "light");
  await page.goto(publicRouteUrl("/projects/hci-spooder-man/"), { waitUntil: "load" });
  const track = page.locator("[data-spooder-track]");
  await track.scrollIntoViewIfNeeded();
  const state = () =>
    track.evaluate((row) => ({
      left: Math.round(row.scrollLeft),
      phase: row.getAttribute("data-shelf"),
      snap: row.style.scrollSnapType,
      lean: row.style.translate,
      open: [...row.children].findIndex((card) => card.classList.contains("is-active")),
    }));
  if (isMobile) {
    // Touch already scrolls and snaps the row natively; the module is never fetched.
    await page.waitForTimeout(500);
    expect((await state()).phase).toBe(null);
    expect(errors).toEqual([]);
    return;
  }
  await expect(track).toHaveAttribute("data-shelf", "idle");
  const stops = await page.evaluate(async () => {
    const { snapStops } = await import(new URL("shelf.mjs", document.querySelector('script[src*="spooder-project"]').src).href);
    return snapStops(document.querySelector("[data-spooder-track]"));
  });
  expect(stops.length).toBeGreaterThan(3);
  const onStop = (left) => stops.some((stop) => Math.abs(stop - left) <= 1);
  const box = await track.boundingBox(),
    y = box.y + box.height * 0.4,
    x = box.x + box.width * 0.7;
  const press = async (distance, steps) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x + (distance * i) / steps, y);
      await page.waitForTimeout(8);
    }
  };

  // The row follows the hand one to one; let go at rest and it settles on the nearest stop.
  const from = (await state()).left;
  await press(-240, 24);
  const held = await state();
  expect(held).toMatchObject({ phase: "dragging", snap: "none" });
  expect(Math.abs(held.left - from - 240)).toBeLessThanOrEqual(1);
  await page.waitForTimeout(250);
  await page.mouse.up();
  await expect.poll(async () => (await state()).phase).toBe("idle");
  const rested = await state();
  expect(onStop(rested.left)).toBe(true);
  expect(rested).toMatchObject({ snap: "", lean: "", open: 0 });

  // A throw carries on past where the hand let go and lands on a stop.
  await press(-270, 8);
  const letGo = (await state()).left;
  await page.mouse.up();
  expect((await state()).phase).toBe("flying");
  await expect.poll(async () => (await state()).phase).toBe("idle");
  const thrown = await state();
  expect(thrown.left).toBeGreaterThan(letGo + 100);
  expect(onStop(thrown.left)).toBe(true);
  expect(thrown.open).toBe(0);

  // The wheel takes over mid-flight, well before the spring would have landed.
  await press(-270, 8);
  await page.mouse.up();
  expect((await state()).phase).toBe("flying");
  await page.mouse.wheel(0, 30);
  await expect.poll(async () => (await state()).phase, { timeout: 250, intervals: [20] }).toBe("idle");

  // Pulled past its start the row only leans, and comes back.
  await track.evaluate((row) => row.scrollTo({ left: 0, behavior: "instant" }));
  await page.waitForTimeout(200);
  await press(160, 12);
  const pulled = await state();
  expect(pulled.left).toBe(0);
  expect(parseFloat(pulled.lean)).toBeGreaterThan(20);
  expect(parseFloat(pulled.lean)).toBeLessThan(160);
  await page.mouse.up();
  await expect.poll(async () => (await state()).phase).toBe("idle");
  expect((await state()).lean).toBe("");

  // With reduced motion a drag still works and nothing flies.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await press(-270, 8);
  await page.mouse.up();
  expect((await state()).phase).toBe("idle");
  expect(errors).toEqual([]);
});
