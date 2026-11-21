const { test, expect } = require("@playwright/test");
const { preparePage, collectRuntimeErrors } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

// The ordinary switch only builds a graph after opt-in. The explicit instrument
// lab preserves the synthesized gestures, offline level measurements and bed.
const evidence = (page) => page.evaluate(() => globalThis.siteSound?.evidence() ?? null);
// Count every audio context the page makes, from before any of its scripts run.
const countContexts = (page) =>
  page.addInitScript(() => {
    window.__audioContexts = 0;
    const Native = window.AudioContext;
    if (!Native) return;
    window.AudioContext = class extends Native {
      constructor(...args) {
        super(...args);
        window.__audioContexts++;
      }
    };
  });
const contexts = (page) => page.evaluate(() => window.__audioContexts);
async function openPanel(page) {
  const control = page.locator("[data-sound-toggle]:visible");
  if (await control.count()) return control.first();
  await page.locator("[data-theme-toggle]:visible").first().click();
  return page.locator("[data-sound-toggle]:visible").first();
}

test("site sound: the normal switch is visible, silent and lazy before consent", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const errors = collectRuntimeErrors(page);
  const fetched = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes("/assets/js/sound/") || pathname.includes("/assets/audio/")) fetched.push(request.url());
  });
  await countContexts(page);
  await preparePage(page, "noon");
  await page.goto(publicRouteUrl("/cv/"), { waitUntil: "load" });
  const control = await openPanel(page);
  await expect(control).toHaveAttribute("aria-checked", "false");
  expect(await evidence(page)).toMatchObject({ offered: true, on: false, context: null });
  expect(fetched).toEqual([]);
  expect(await contexts(page)).toBe(0);

  if (testInfo.project.name === "mobile-390") {
    const portrait = page.viewportSize();
    await page.setViewportSize({ width: 844, height: 390 });
    const range = page.locator("[data-theme-menu]:visible [data-art-slider]");
    // A touch can reach the scroll boundary without delivering an intermediate move.
    await range.evaluate((slider) => {
      const point = (clientY) => new Touch({ identifier: 71, target: slider, clientX: 25, clientY });
      slider.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, changedTouches: [point(25)] }));
      slider.value = slider.max;
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new TouchEvent("touchend", { bubbles: true, changedTouches: [point(105)] }));
    });
    await expect(range).toHaveValue("0");
    await expect(range).toHaveAttribute("aria-valuetext", "Realistic");
    await page.setViewportSize(portrait);
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await control.click();
  await expect.poll(async () => (await evidence(page)).context).toBe("running");
  await expect(control).toHaveAttribute("aria-checked", "true");
  expect(await contexts(page)).toBe(1);
  expect(await evidence(page)).toMatchObject({ on: true, bed: false, played: 0, instrumentLab: false });
  await expect.poll(async () => (await evidence(page)).coastal?.theme).toBe("realistic");
  const panel = page.locator("[data-theme-menu]:visible").first();
  const style = panel.getByRole("slider", { name: "Art style" });
  await style.focus();
  await style.press("ArrowRight");
  await style.press("ArrowRight");
  await expect(style).toHaveAttribute("aria-valuetext", "Watercolour");
  await expect(page.locator("html")).toHaveAttribute("data-art-style", "watercolour");
  await expect(panel.locator("[data-art-piece]")).toHaveText("A Pocketful of Sky");
  await expect.poll(async () => (await evidence(page)).coastal?.theme).toBe("watercolour");
  expect(fetched.some((url) => url.includes("/watercolour.mp3"))).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const volume = panel.getByRole("slider", { name: "Music and sound volume" });
  await volume.focus();
  await volume.press("ArrowLeft");
  await expect.poll(async () => (await evidence(page)).volume).toBe(0.99);
  if (testInfo.project.name === "mobile-390") {
    await page.keyboard.press("Escape");
    await page.locator("[role=main] summary").filter({ hasText: "Sections" }).click();
    await expect.poll(async () => (await evidence(page)).coastal?.cues?.select).toBe(1);
    await openPanel(page);
  }
  await control.click();
  await expect.poll(async () => (await evidence(page)).context).toBe("suspended");
  expect(await evidence(page)).toMatchObject({ on: false, bed: false, bound: false });

  await page.goto(publicRouteUrl("/cv/?sound=0"), { waitUntil: "load" });
  await expect(page.locator("html")).toHaveAttribute("data-art-style", "watercolour");
  await page.locator("[data-theme-toggle]:visible").first().click();
  await expect(page.locator("[data-sound-toggle]:visible")).toHaveCount(0);
  expect(await evidence(page)).toBeNull();
  expect(await contexts(page)).toBe(0);
  await page.goto(publicRouteUrl("/cv/"), { waitUntil: "load" });
  expect(await evidence(page)).toMatchObject({ offered: true, on: false, context: null });
  expect(errors).toEqual([]);
});

test("site sound: the explicit instrument lab keeps its original gestures and visibility handling", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const errors = collectRuntimeErrors(page);
  await countContexts(page);
  await preparePage(page, "noon");
  await page.goto(publicRouteUrl("/cv/?sound-lab=1"), { waitUntil: "load" });
  const control = await openPanel(page);
  expect(await contexts(page)).toBe(0);
  await control.click();
  await expect.poll(async () => (await evidence(page)).context).toBe("running");
  expect(await evidence(page)).toMatchObject({ on: true, bed: true, bound: true, mode: "noon", instrumentLab: true });
  const before = (await evidence(page)).played;
  await page.locator("[data-motion-toggle]:visible").first().click();
  await expect.poll(async () => (await evidence(page)).played).toBeGreaterThanOrEqual(before + 2);
  await page.locator("[data-motion-toggle]:visible").first().click();
  await page.keyboard.press("Escape");
  const notes = (await evidence(page)).played;
  await page.locator(".navbar-nav .nav-link").nth(1).hover();
  await expect.poll(async () => (await evidence(page)).played).toBeGreaterThan(notes);

  const hide = (hidden) =>
    page.evaluate((hidden) => {
      Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  await hide(true);
  await expect.poll(async () => (await evidence(page)).context).toBe("suspended");
  await hide(false);
  await expect.poll(async () => (await evidence(page)).context).toBe("running");
  await (await openPanel(page)).click();
  await expect.poll(async () => (await evidence(page)).context).toBe("suspended");
  expect(await evidence(page)).toMatchObject({ on: false, bed: false, bound: false });
  expect(errors).toEqual([]);
});

test("site sound: every sound it can make is quiet, and the bed quieter still", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "the sounds are the same at every width");
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "noon");
  await page.goto(publicRouteUrl("/cv/?sound-lab=1"), { waitUntil: "load" });
  // Rendered without a speaker, by the page's own instrument.
  const rows = await page.evaluate(async () => {
    const base = document.querySelector('script[src*="site-sound.mjs"]').src.replace(/site-sound\.mjs.*$/, "sound/");
    const [{ render }, score] = await Promise.all([import(`${base}engine.mjs`), import(`${base}score.mjs`)]);
    const decibels = (value) => 20 * Math.log10(Math.max(value, 1e-9));
    const measure = ({ channels }) => {
      let peak = 0,
        square = 0,
        count = 0;
      for (const channel of channels)
        for (const value of channel) {
          peak = Math.max(peak, Math.abs(value));
          square += value * value;
          count++;
        }
      return { peak: decibels(peak), rms: decibels(Math.sqrt(square / count)) };
    };
    const gestures = [
      ["tap", {}],
      ["point", { index: 2 }],
      ["switch", { on: true }],
      ["open", {}],
      ["close", {}],
      ["arrive", { index: 1 }],
      ["hour", {}],
      ["land", { force: 1 }],
    ];
    const rows = [];
    for (const mode of score.MODES) {
      for (const [event, detail] of gestures) rows.push({ mode, event, ...measure(await render(score.play(event, mode, detail))) });
      rows.push({ mode, event: "bed", ...measure(await render(score.bedNotes(mode, 0, 40), { seconds: 40 })) });
    }
    return rows;
  });
  await testInfo.attach("sound-levels", { body: JSON.stringify(rows, null, 2), contentType: "application/json" });
  expect(rows).toHaveLength(36);
  for (const { mode, event, peak, rms } of rows) {
    const name = `${mode} ${event}`;
    if (event === "bed") {
      // Under everything: its loudest instant stays below a pointed-at link's.
      expect(peak, name).toBeLessThan(-20);
      expect(rms, name).toBeLessThan(-33);
      expect(rms, `${name} is not silence`).toBeGreaterThan(-50);
    } else {
      // No gesture comes within 12 dB of full scale, and each can be heard.
      expect(peak, name).toBeLessThan(-12);
      expect(peak, name).toBeGreaterThan(-32);
    }
  }
  expect(errors).toEqual([]);
});
