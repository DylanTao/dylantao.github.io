const { test, expect } = require("@playwright/test");
const { preparePage, collectRuntimeErrors } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

// The site's sound is a trial behind ?sound=1 (assets/js/site-sound.mjs). These cases hold it to its
// promises: an ordinary visitor is offered nothing and pays nothing, an offered visitor hears
// nothing until they turn the switch, and what it then plays is quiet.
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

test("site sound: nothing is offered, fetched or made until a visitor is given the switch and turns it", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const errors = collectRuntimeErrors(page);
  const fetched = [];
  page.on("request", (request) => {
    if (/\/assets\/js\/sound\//.test(request.url())) fetched.push(request.url());
  });
  await countContexts(page);
  await preparePage(page, "noon");

  // An ordinary visit: no switch, no instrument, no audio.
  await page.goto(publicRouteUrl("/cv/"), { waitUntil: "load" });
  await page.locator("[data-theme-toggle]:visible").first().click();
  await expect(page.locator("[data-motion-toggle]:visible").first()).toBeVisible();
  await expect(page.locator("[data-sound-toggle]:visible")).toHaveCount(0);
  expect(await evidence(page)).toBeNull();
  expect(fetched).toEqual([]);
  expect(await contexts(page)).toBe(0);

  // Offered: the switch shows and the instrument is fetched, but there is still no audio.
  await page.goto(publicRouteUrl("/cv/?sound=1"), { waitUntil: "load" });
  await expect.poll(() => fetched.some((url) => url.includes("engine.mjs"))).toBe(true);
  expect(await evidence(page)).toMatchObject({ offered: true, on: false, context: null });
  const control = await openPanel(page);
  await expect(control).toHaveAttribute("aria-checked", "false");
  await page.waitForTimeout(300);
  expect(await contexts(page)).toBe(0);

  // Turned on, inside the visitor's click: one context, running, with the bed under it.
  await control.click();
  await expect.poll(async () => (await evidence(page)).context).toBe("running");
  await expect(control).toHaveAttribute("aria-checked", "true");
  expect(await contexts(page)).toBe(1);
  const started = await evidence(page);
  expect(started).toMatchObject({ on: true, bed: true, bound: true, mode: "noon" });
  expect(started.played, "the switch's own two notes and the bed's first").toBeGreaterThanOrEqual(2);

  // What the visitor does is played: another switch speaks, and a pointed-at link is a note.
  let before = (await evidence(page)).played;
  await page.locator("[data-motion-toggle]:visible").first().click();
  await expect.poll(async () => (await evidence(page)).played).toBeGreaterThanOrEqual(before + 2);
  await page.locator("[data-motion-toggle]:visible").first().click();
  if (testInfo.project.name === "desktop-1440") {
    await page.keyboard.press("Escape");
    before = (await evidence(page)).played;
    await page.locator(".navbar-nav .nav-link").nth(1).hover();
    await expect.poll(async () => (await evidence(page)).played).toBeGreaterThan(before);
  }

  // A hidden tab is silent, and picks up where it stopped.
  const hide = (hidden) =>
    page.evaluate((hidden) => {
      Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  await hide(true);
  await expect.poll(async () => (await evidence(page)).context).toBe("suspended");
  await hide(false);
  await expect.poll(async () => (await evidence(page)).context).toBe("running");

  // Turned off: silent, unbound, and remembered as off on the next page, which still offers it.
  await (await openPanel(page)).click();
  await expect.poll(async () => (await evidence(page)).context).toBe("suspended");
  expect(await evidence(page)).toMatchObject({ on: false, bed: false, bound: false });
  await page.goto(publicRouteUrl("/"), { waitUntil: "load" });
  expect(await evidence(page)).toMatchObject({ offered: true, on: false, context: null });
  expect(await contexts(page)).toBe(0);

  // ?sound=0 withdraws the offer.
  await page.goto(publicRouteUrl("/cv/?sound=0"), { waitUntil: "load" });
  expect(await evidence(page)).toBeNull();
  await page.goto(publicRouteUrl("/cv/"), { waitUntil: "load" });
  expect(await evidence(page)).toBeNull();
  expect(errors).toEqual([]);
});

test("site sound: every sound it can make is quiet, and the bed quieter still", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "the sounds are the same at every width");
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "noon");
  await page.goto(publicRouteUrl("/cv/?sound=1"), { waitUntil: "load" });
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
