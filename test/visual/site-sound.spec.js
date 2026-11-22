const { test, expect } = require("@playwright/test");
const { preparePage, collectRuntimeErrors } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

// The ordinary graph unlocks on interaction, and recordings wait for Play. The instrument
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

test("site sound: a failed idle FX download leaves the first real gesture available", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "the idle download is shared across viewport sizes");
  const leafRequests = [],
    audioRequests = [];
  await countContexts(page);
  await preparePage(page, "noon");
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/assets/audio/")) audioRequests.push(request.url());
  });
  await page.route("**/assets/js/sound/gesture-foley.mjs", (route) => {
    leafRequests.push(route.request().resourceType());
    return leafRequests.length === 1 ? route.abort() : route.continue();
  });

  await page.goto(publicRouteUrl("/cv/"), { waitUntil: "load" });
  await expect.poll(() => leafRequests).toEqual(["fetch"]);
  expect(await contexts(page)).toBe(0);
  expect(await evidence(page)).toMatchObject({ musicOn: false, effectsOn: true, context: null });
  expect(audioRequests).toEqual([]);

  await openPanel(page);
  await expect.poll(async () => (await evidence(page)).gestures?.cues.latch).toBeGreaterThan(0);
  expect(leafRequests).toEqual(["fetch", "script"]);
  expect(await contexts(page)).toBe(1);
  expect(await evidence(page)).toMatchObject({ musicOn: false, effectsOn: true, context: "running" });
  expect(audioRequests).toEqual([]);
});

test("site sound: effects unlock while transport and all recordings stay paused until Play", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const errors = collectRuntimeErrors(page);
  const recordings = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/\/assets\/audio\/(?:coastal-score|desk-records)\/.*\.mp3$/.test(pathname)) {
      recordings.push(pathname.slice(pathname.indexOf("/assets/audio/")));
    }
  });
  await countContexts(page);
  await page.addInitScript(() => localStorage.setItem("site-sound", "on"));
  await preparePage(page, "noon");
  await page.goto(publicRouteUrl("/cv/"), { waitUntil: "load" });
  expect(await contexts(page)).toBe(0);
  expect(await evidence(page)).toMatchObject({ offered: true, musicOn: false, effectsOn: true, context: null });
  await expect(page.locator("html")).toHaveAttribute("data-art-style", "realistic");
  expect(recordings).toEqual([]);

  const player = await openPanel(page);
  const panel = page.locator("[data-theme-menu]:visible").first();
  const effects = panel.locator("[data-effects-toggle]");
  const style = panel.getByRole("slider", { name: "Art style" });
  const volume = panel.getByRole("slider", { name: "Music and sound volume" });
  await expect(player).toHaveAccessibleName("Play music");
  await expect(player).toHaveAttribute("aria-pressed", "false");
  await expect(effects).toHaveAttribute("aria-checked", "true");
  await expect(style).toHaveAttribute("max", "5");
  await expect(style).toHaveAttribute("aria-valuetext", "Photoreal");
  await expect.poll(async () => (await evidence(page)).context).toBe("running");
  await expect.poll(async () => (await evidence(page)).gestures?.cues.latch).toBeGreaterThan(0);
  expect(await contexts(page)).toBe(1);
  expect(recordings).toEqual([]);

  if (testInfo.project.name === "mobile-390") {
    const portrait = page.viewportSize();
    await page.setViewportSize({ width: 844, height: 390 });
    // An interrupted vertical touch can change the native range without committing a style.
    await style.evaluate((slider) => {
      const point = (clientY) => new Touch({ identifier: 71, target: slider, clientX: 25, clientY });
      slider.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, changedTouches: [point(25)] }));
      slider.value = slider.max;
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new TouchEvent("touchend", { bubbles: true, changedTouches: [point(105)] }));
    });
    await expect(style).toHaveValue("0");
    await expect(style).toHaveAttribute("aria-valuetext", "Photoreal");
    await page.setViewportSize(portrait);
  }

  await volume.press("ArrowLeft");
  await expect.poll(async () => (await evidence(page)).volume).toBe(0.99);
  await style.press("ArrowRight");
  await expect.poll(async () => (await evidence(page)).gestures?.cues.detent).toBeGreaterThan(0);
  await expect(style).toHaveAttribute("aria-valuetext", "Cosmic cel");
  expect(await evidence(page)).toMatchObject({ musicOn: false, effectsOn: true, coastal: { theme: null, cached: [] } });
  expect(recordings).toEqual([]);

  await style.press("Home");
  await player.click();
  await expect(player).toHaveAccessibleName("Pause music");
  await expect(player).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await evidence(page)).coastal?.theme).toBe("realistic");
  expect(recordings).toContain("/assets/audio/coastal-score/realistic.mp3");

  for (let i = 0; i < 3; i++) await style.press("ArrowRight");
  await expect(style).toHaveAttribute("aria-valuetext", "Graphite noir");
  await expect(panel.locator("[data-art-piece]")).toHaveText("All the Windows Open");
  await expect.poll(async () => (await evidence(page)).coastal?.theme).toBe("all-the-windows-open");
  expect(recordings).toContain("/assets/audio/desk-records/all-the-windows-open.mp3");

  await effects.click();
  await expect(effects).toHaveAttribute("aria-checked", "false");
  expect(await evidence(page)).toMatchObject({ musicOn: true, effectsOn: false, context: "running" });
  // An internal link carries the reading style and effect preference. Every
  // document starts paused, and a reload returns to the original art style.
  const alreadyFetched = recordings.length;
  await page.keyboard.press("Escape");
  const projects = page.locator('.navbar-nav a[href$="/projects/"]').first();
  if (!(await projects.isVisible())) await page.locator(".navbar-toggler").click();
  await projects.click();
  await page.waitForURL(/\/projects\/$/);
  await expect(page.locator("html")).toHaveAttribute("data-art-style", "pencil");
  await expect.poll(() => evidence(page)).toMatchObject({ musicOn: false, effectsOn: false, context: null });
  await page.reload({ waitUntil: "load" });
  await expect(page.locator("html")).toHaveAttribute("data-art-style", "realistic");
  expect(await evidence(page)).toMatchObject({ musicOn: false, effectsOn: false, context: null });
  expect(recordings).toHaveLength(alreadyFetched);

  await openPanel(page);
  expect(await contexts(page)).toBe(0);
  await effects.click();
  await expect.poll(async () => (await evidence(page)).context).toBe("running");
  await expect(effects).toHaveAttribute("aria-checked", "true");
  await player.click();
  await expect.poll(async () => (await evidence(page)).coastal?.theme).toBe("realistic");
  await player.click();
  await expect.poll(async () => (await evidence(page)).coastal?.theme).toBeNull();
  expect(await evidence(page)).toMatchObject({ musicOn: false, effectsOn: true, context: "running" });
  await effects.click();
  await expect.poll(async () => (await evidence(page)).context).toBe("suspended");

  await page.goto(publicRouteUrl("/cv/?sound=0"), { waitUntil: "load" });
  await page.locator("[data-theme-toggle]:visible").first().click();
  await expect(page.locator("[data-sound-toggle]:visible, [data-effects-toggle]:visible")).toHaveCount(0);
  expect(await evidence(page)).toBeNull();
  expect(await contexts(page)).toBe(0);
  await page.goto(publicRouteUrl("/cv/"), { waitUntil: "load" });
  expect(await evidence(page)).toMatchObject({ offered: true, musicOn: false, effectsOn: false, context: null });
  expect(errors).toEqual([]);
});

test("site sound: the explicit instrument lab keeps its original gestures and visibility handling", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const errors = collectRuntimeErrors(page);
  await countContexts(page);
  await preparePage(page, "noon");
  await page.goto(publicRouteUrl("/cv/?sound-lab=1"), { waitUntil: "load" });
  expect(await contexts(page)).toBe(0);
  const control = await openPanel(page);
  await control.click();
  await expect.poll(() => evidence(page)).toMatchObject({ on: true, bed: true, bound: true, context: "running", mode: "noon", instrumentLab: true });
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
  expect(await evidence(page)).toMatchObject({ musicOn: false, effectsOn: true, bed: false, bound: true, context: "running" });
  await page.locator("[data-effects-toggle]:visible").first().click();
  await expect.poll(async () => (await evidence(page)).context).toBe("suspended");
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
