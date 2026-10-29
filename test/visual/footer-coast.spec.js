const { test, expect, chromium } = require("@playwright/test");
const { writeFile } = require("node:fs/promises");
const { PNG } = require("pngjs");
const { preparePage, collectRuntimeErrors, attachScreenshot, screenshotMetrics, screenshotDiffRatio } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const evidence = (host) => host.evaluate((e) => e.getCoastEvidence());
const coastModels = /\/models\/la-jolla\/[^/?]+\.glb(?:\?.*)?$/;

// WCAG contrast of the credit against the coast, in a 2 px ring around its glyph strokes: the credit
// drawn in magenta without its halo gives the glyph mask; the same view with transparent glyphs but
// the halo drawn gives the background those strokes sit on (reflections, glitter and surf pass behind).
const channel = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
const luminance = (data, o) => 0.2126 * channel(data[o]) + 0.7152 * channel(data[o + 1]) + 0.0722 * channel(data[o + 2]);
async function creditContrast(page) {
  const credit = page.locator("footer.coastal-page-footer > .container");
  const { text, shadow } = await credit.evaluate((e) => ({ text: getComputedStyle(e).color, shadow: getComputedStyle(e).textShadow }));
  const clip = await credit.boundingBox();
  const paint = (fill, halo) =>
    credit.evaluate(
      (e, [fill, halo]) => {
        for (const node of [e, ...e.querySelectorAll("a, span")]) node.style.color = fill;
        e.style.textShadow = halo;
      },
      [fill, halo]
    );
  await paint("#ff00ff", "none");
  const mask = PNG.sync.read(await page.screenshot({ clip }));
  await paint("transparent", shadow);
  const back = PNG.sync.read(await page.screenshot({ clip }));
  await paint("", "");
  const glyph = (x, y) => {
    const o = (y * mask.width + x) * 4;
    return mask.data[o] > 200 && mask.data[o + 1] < 90 && mask.data[o + 2] > 200;
  };
  const ring = [];
  for (let y = 2; y < mask.height - 2; y++)
    for (let x = 2; x < mask.width - 2; x++) {
      if (glyph(x, y)) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) near = glyph(x + dx, y + dy);
      if (near) ring.push(luminance(back.data, (y * back.width + x) * 4));
    }
  ring.sort((a, b) => a - b);
  const [r, g, b] = text.match(/\d+/g).map(Number);
  const ink = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const ratio = (l) => (Math.max(l, ink) + 0.05) / (Math.min(l, ink) + 0.05);
  // The worst case is the ring percentile closest to the ink: dark text over the darkest water.
  const pick = (q) => ring[Math.min(ring.length - 1, Math.floor(q * ring.length))];
  return { samples: ring.length, median: ratio(pick(0.5)), worst: ratio(ink < 0.2 ? pick(0.05) : pick(0.95)) };
}

test("La Jolla guide: names select actual landmarks without moving the view", async ({ page }, testInfo) => {
  await preparePage(page, "afternoon");
  await page.goto(publicRouteUrl("/projects/la-jolla/"));
  const viewer = page.locator("[data-miniature]");
  await viewer.scrollIntoViewIfNeeded();
  await expect(viewer).toHaveAttribute("data-state", "ready", { timeout: 60000 });
  const before = await viewer.evaluate((e) => e.getCoastEvidence().orbit);
  for (const name of ["DIB", "Geisel", "Salk", "ScrippsPier"]) {
    const place = page.locator(`[data-coast-guide] [data-coast-place="${name}"]`);
    await place.locator("summary").click();
    await expect(viewer).toHaveAttribute("data-selected-place", name);
    await expect(viewer.locator(".coast-place-marker")).toBeVisible();
    await expect(place.locator("a")).toHaveAttribute("href", /^https:\/\//);
    expect(await viewer.evaluate((e) => e.getCoastEvidence().orbit)).toEqual(before);
  }
  await page.locator(".coast-explorer").screenshot({ path: testInfo.outputPath("coast-guide.png") });
  await page.locator('[data-coast-place="ScrippsPier"] summary').click();
  await expect(viewer.locator(".coast-place-marker")).toBeHidden();
  await page.locator(".studio-print-pair").scrollIntoViewIfNeeded();
  await expect(page.locator(".studio-print-pair img")).toHaveCount(2);
  for (const print of await page.locator(".studio-print-pair img").all()) {
    await print.scrollIntoViewIfNeeded();
    await expect
      .poll(() => print.evaluate((img) => img.currentSrc !== "" && img.complete && img.naturalWidth > 0), {
        message: "Each lazy print must select and load its source before decoding",
      })
      .toBe(true);
    await print.evaluate((img) => img.decode());
  }
  expect(
    await page
      .locator(".studio-print-pair img")
      .evaluateAll((images) => images.every((img) => img.complete && img.naturalWidth > 0 && getComputedStyle(img).filter === "none"))
  ).toBe(true);
  await page.locator(".studio-print-pair").screenshot({ path: testInfo.outputPath("coastal-print-studies.png") });
});

test("La Jolla guide: sources and notes remain usable when WebGL is unavailable", async ({ page }) => {
  await preparePage(page, "noon");
  await page.route("**/assets/models/la-jolla/*.glb*", (route) => route.abort());
  await page.goto(publicRouteUrl("/projects/la-jolla/"));
  const place = page.locator('[data-coast-guide] [data-coast-place="Geisel"]');
  await place.locator("summary").click();
  await expect(place.locator("p")).toContainText("stepped crown");
  await expect(place.locator("a")).toBeVisible();
  await expect(page.locator("[data-miniature] .coast-place-marker")).toBeHidden();
});
async function open(page, theme = "noon") {
  await preparePage(page, theme);
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const host = page.locator("footer [data-footer-coast]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  return host;
}

async function compareLoadingPreview(page, testInfo, { route = "/", selector = "footer [data-footer-coast]", theme = "noon", name }) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await preparePage(page, theme);
  let release;
  const loading = new Promise((resolve) => (release = resolve));
  await page.route(coastModels, async (request) => {
    await loading;
    await request.continue();
  });
  try {
    await page.goto(publicRouteUrl(route), { waitUntil: "domcontentloaded" });
    const host = page.locator(selector);
    await host.scrollIntoViewIfNeeded();
    const poster = host.locator(".footer-coast__poster");
    await expect.poll(() => poster.evaluate((image) => image.currentSrc)).toContain(`-${theme}.webp`);
    await poster.evaluate((image) => image.decode());
    await expect(host).toHaveAttribute("data-state", "still");
    const surface = host.locator(".footer-coast__scene");
    const before = await surface.screenshot();
    release();
    await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
    await expect(poster).toBeHidden();
    const after = await surface.screenshot();
    // Compare actual pixels: a centered thumbnail, shifted landmark, missing
    // panorama or wrong theme cannot pass by merely reporting 'ready'.
    const changed = screenshotDiffRatio(before, after);
    await writeFile(testInfo.outputPath(`${name}-loading.png`), before);
    await writeFile(testInfo.outputPath(`${name}-ready.png`), after);
    await writeFile(testInfo.outputPath(`${name}-difference.json`), JSON.stringify({ changed, theme, viewport: page.viewportSize() }));
    expect(changed, "The still and first rendered composition must match").toBeLessThan(0.045);
    await testInfo.attach(`${name}-loading`, { body: before, contentType: "image/png" });
    await testInfo.attach(`${name}-ready`, { body: after, contentType: "image/png" });
    await testInfo.attach(`${name}-difference`, {
      body: JSON.stringify({ changed, theme, viewport: page.viewportSize() }),
      contentType: "application/json",
    });
  } finally {
    release();
    await page.unroute(coastModels);
  }
}

test("coastal loading: responsive, theme-matched stills preserve the first frame", async ({ page }, testInfo) => {
  const themes = { "desktop-1440": "morning", "laptop-1280": "noon", "tablet-768": "afternoon", "mobile-390": "evening" };
  await compareLoadingPreview(page, testInfo, { theme: themes[testInfo.project.name] || "noon", name: "coast" });
  if (testInfo.project.name === "desktop-1440") {
    const wide = await page.context().newPage();
    await wide.setViewportSize({ width: 3840, height: 1200 });
    await compareLoadingPreview(wide, testInfo, { name: "coast-4k" });
    const frames = await wide.locator("footer [data-footer-coast]").evaluate((e) => e.getCoastEvidence({ projectLandmarks: true }).landmarkFrames);
    for (const [name, frame] of Object.entries(frames)) {
      expect(frame, name).not.toBeNull();
      expect(frame.top, `${name} roof must clear the top edge`).toBeGreaterThan(0.01);
      expect(frame.bottom, `${name} must clear the bottom edge`).toBeLessThan(0.99);
      expect(frame.left, `${name} must be inside the panorama`).toBeGreaterThan(0);
      expect(frame.right, `${name} must be inside the panorama`).toBeLessThan(1);
    }
    await wide.close();
  }
});

test("La Jolla loading: both miniature frames retain their scale and lighting", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  await compareLoadingPreview(page, testInfo, { selector: "[data-miniature]", name: "connect-miniature", theme: "afternoon" });
  const project = await page.context().newPage();
  await compareLoadingPreview(project, testInfo, {
    route: "/projects/la-jolla/",
    selector: "[data-miniature]",
    name: "project-miniature",
    theme: "evening",
  });
  await project.close();
});

test("coastal loading with a visible scrollbar: preview and camera agree at the phone boundary", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const browser = await chromium.launch({
    ignoreDefaultArgs: ["--hide-scrollbars"],
    ...(process.platform === "win32" ? { args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 610, height: 800 }, deviceScaleFactor: 1 });
    await compareLoadingPreview(page, testInfo, { name: "scrollbar-boundary" });
    expect((await evidence(page.locator("footer [data-footer-coast]"))).framing.width).toBe(40.5);
    await page.setViewportSize({ width: 599, height: 800 });
    await expect.poll(async () => (await evidence(page.locator("footer [data-footer-coast]"))).framing.width).toBe(21);
    await expect.poll(() => page.locator("footer .footer-coast__poster").evaluate((image) => image.currentSrc)).toContain("coast-mobile-noon.webp");
  } finally {
    await browser.close();
  }
});

test("coastal loading: a slow model arrives complete without fading through an empty canvas", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await preparePage(page, "noon");
  let release;
  const loading = new Promise((resolve) => (release = resolve));
  await page.route(coastModels, async (request) => {
    await loading;
    await request.continue();
  });
  try {
    await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
    const host = page.locator("footer [data-footer-coast]");
    await host.evaluate((e) => scrollTo({ top: scrollY + e.getBoundingClientRect().top - innerHeight + 100, behavior: "instant" }));
    // The responsive poster selects its noon source after the lazy reveal.
    // Wait for that actual source before decoding, as preview checks do.
    await expect.poll(() => host.locator(".footer-coast__poster").evaluate((image) => image.currentSrc)).toContain("-noon.webp");
    await host.locator(".footer-coast__poster").evaluate((image) => image.decode());
    await host.evaluate((e) => {
      window.coastHandoff = [];
      const observe = new MutationObserver(() => {
        if (e.dataset.state !== "ready") return;
        observe.disconnect();
        const sample = () => {
          const poster = Number(getComputedStyle(e.querySelector(".footer-coast__poster")).opacity);
          window.coastHandoff.push({
            reveal: e.getCoastEvidence().reveal,
            frames: e.getCoastEvidence().frames,
            canvas: Number(getComputedStyle(e.querySelector("canvas")).opacity),
            poster,
          });
          // Sample the complete handoff, independent of software WebGL's frame rate.
          if (poster > 0 || window.coastHandoff.length < 2) requestAnimationFrame(sample);
        };
        sample();
      });
      observe.observe(e, { attributes: true, attributeFilter: ["data-state"] });
    });
    release();
    await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
    await expect.poll(() => page.evaluate(() => window.coastHandoff.length >= 2 && window.coastHandoff.at(-1).poster === 0)).toBe(true);
    const frames = await page.evaluate(() => window.coastHandoff);
    expect(frames.every((frame) => frame.reveal === 1 && frame.frames > 0 && frame.canvas === 1)).toBe(true);
    await expect(host.locator(".footer-coast__poster")).toBeHidden();
    await testInfo.attach("handoff-frames", { body: JSON.stringify(frames), contentType: "application/json" });
  } finally {
    release();
  }
});

for (const theme of process.env.COAST_THEME ? [process.env.COAST_THEME] : ["morning", "noon", "afternoon", "evening"]) {
  test(`coastal footer: automatic ${theme} light and full width composition`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    const host = await open(page, theme);
    await page.waitForTimeout(2000);
    const info = await evidence(host);
    expect(info.theme).toBe(theme);
    expect(info.landmarks).toEqual(expect.arrayContaining(["DIB", "Tennis", "CliffVilla"]));
    expect(info.landmarks).toEqual(expect.arrayContaining(["GeiselCoast", "SalkCoast", "BrocktonVilla", "LaValencia"]));
    if (theme === "morning") expect(info.office).toBe(false);
    if (theme === "noon" || theme === "afternoon") expect(info.office).toBe(true);
    await expect(host.locator("button:not([data-coast-tilt])")).toHaveCount(0);
    if (theme !== "evening") {
      expect(info.sky.weight).toBeGreaterThan(0.3);
      expect(info.sky.lights).toBe(0);
    }
    await expect(page.getByRole("link", { name: "al-folio", exact: true })).toHaveCount(0);
    const box = await host.boundingBox();
    expect(box.x).toBe(0);
    expect(box.width).toBe(page.viewportSize().width);
    const footerGeometry = await host.evaluate((element) => {
      const footer = element.closest("footer").getBoundingClientRect();
      const scene = element.querySelector(".footer-coast__scene").getBoundingClientRect();
      return { gap: footer.bottom - scene.bottom, mask: getComputedStyle(element.querySelector(".footer-coast__scene")).maskImage };
    });
    expect(footerGeometry.gap, "The coast must reach the footer bottom").toBeLessThanOrEqual(1);
    expect(footerGeometry.mask).toBe("none");
    const image = await host.locator("canvas").screenshot(),
      metrics = screenshotMetrics(image);
    expect(metrics.uniqueColors).toBeGreaterThan(300);
    expect(metrics.luminanceVariance).toBeGreaterThan(100);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    // The sea mirrors the coast (water.mjs), and the credit over it stays legible in every theme.
    expect(info.water.reflection.renders).toBeGreaterThanOrEqual(1);
    const contrast = await creditContrast(page);
    expect(contrast.samples).toBeGreaterThan(100);
    expect(contrast.median, "credit contrast over the sea").toBeGreaterThanOrEqual(4.5);
    await writeFile(testInfo.outputPath(`credit-contrast-${theme}.json`), JSON.stringify(contrast, null, 2));
    await testInfo.attach(`credit-contrast-${theme}`, { body: JSON.stringify(contrast), contentType: "application/json" });
    await attachScreenshot(page, testInfo, `coast-${theme}`, { locator: page.locator("footer") });
    expect(errors).toEqual([]);
  });
}
test("coastal sea: a mirror drawn on demand, night glitter from the fire and pier lamps", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const errors = collectRuntimeErrors(page);
  const host = await open(page, "noon");
  await page.waitForTimeout(600);
  const day = await evidence(host);
  expect(day.water.reflection.renders).toBeGreaterThanOrEqual(1);
  expect(day.water.reflection.width).toBeGreaterThan(0);
  expect(day.water.caustics).toBe(1);
  expect(day.water.wakes, "the riding and paddling boards and the swimmer trail wakes").toBeGreaterThanOrEqual(2);
  expect(day.water.glints).toEqual([]);
  // Automation holds the people still but the sea keeps moving, and a steady view redraws no mirror.
  await page.waitForTimeout(1500);
  const steady = await evidence(host);
  expect(steady.frames).toBeGreaterThan(day.frames);
  expect(steady.water.reflection.renders).toBe(day.water.reflection.renders);
  // Night redraws the mirror for its light once; the fire and three pier lamps glitter; caustics rest.
  await page.evaluate(() => (document.documentElement.dataset.themeMode = "evening"));
  await expect.poll(async () => (await evidence(host)).water.reflection.renders).toBeGreaterThan(steady.water.reflection.renders);
  const night = (await evidence(host)).water;
  expect(night.glints.length).toBe(4);
  expect(night.caustics).toBe(0);
  expect(night.wakes).toBe(0);
  await page.waitForTimeout(800);
  expect((await evidence(host)).water.reflection.renders).toBe(night.reflection.renders);
  await attachScreenshot(page, testInfo, "coast-sea-night", { locator: page.locator("footer") });
  expect(errors).toEqual([]);
});
test("coastal sea: refracted bottom and volumetric light use the current relief", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const errors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const host = await open(page, "noon");
  const initial = await evidence(host);
  expect(initial.water.bottom.vertices).toBeGreaterThan(40000);
  expect(initial.water.bottom.triangles).toBeGreaterThan(90000);
  expect(initial.water.bottom.depthRange[0]).toBeGreaterThan(0);
  expect(initial.water.bottom.depthRange[1]).toBeGreaterThan(3);
  expect(initial.water.bottom.depthTexture).toBe(true);
  const canvas = host.locator("canvas"),
    bounds = await canvas.boundingBox();
  expect(initial.water.bottom.width).toBeGreaterThanOrEqual(bounds.width - 1);
  const clip = { x: bounds.x + bounds.width * 0.12, y: bounds.y + bounds.height * 0.7, width: bounds.width * 0.68, height: bounds.height * 0.28 };
  const complete = await page.screenshot({ clip, path: testInfo.outputPath("water-complete.png") });
  const comparisons = [];
  for (const [name, options] of [
    ["no-bottom", { bottom: 0 }],
    ["no-scattering", { scattering: 0 }],
    ["no-reflection", { reflection: 0 }],
    ["no-depth-attenuation", { depth: 0 }],
  ]) {
    await host.evaluate((element, options) => element.setCoastWaterProof(options), options);
    const image = await page.screenshot({ clip, path: testInfo.outputPath(`water-${name}.png`) });
    const changed = screenshotDiffRatio(complete, image, { threshold: 0.025 });
    comparisons.push({ name, changed });
    expect(changed, `${name} must change the actual water pixels`).toBeGreaterThan(0.0005);
    expect((await evidence(host)).water.bottom.renders).toBe(initial.water.bottom.renders);
  }
  await host.evaluate((element) => element.setCoastWaterProof({}));
  const restored = await page.screenshot({ clip });
  expect(screenshotDiffRatio(complete, restored)).toBeLessThan(0.002);
  await writeFile(testInfo.outputPath("water-transport.json"), JSON.stringify({ initial: initial.water, comparisons, errors }, null, 2));
  expect(errors).toEqual([]);
});

test("coastal sky: La Jolla's real sunset, dusk and dawn keep the theme, the credit and the coast on one clock", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const errors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  // 2026-10-19 in La Jolla: sunset 18:12 PDT; the sun is 3 degrees down, and the site turns evening, at 18:23.
  const at = async (time) => {
    await page.clock.install({ time: new Date(`2026-10-19T${time}:00-07:00`) });
    await preparePage(page, "noon");
    await page.addInitScript(() => {
      for (const key of ["theme", "theme-manual", "site-time"]) sessionStorage.removeItem(key);
      localStorage.removeItem("theme");
    });
    await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
    const host = page.locator("footer [data-footer-coast]");
    await host.scrollIntoViewIfNeeded();
    await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
    return host;
  };
  // Eight minutes before sunset: the afternoon theme, the twilight sky over the hills (the sun is
  // behind the viewer, so no disk shows), the marine layer over the surf line, and a legible credit
  // under its warm halo.
  let host = await at("18:04");
  await expect(page.locator("footer.coastal-page-footer > .container")).toHaveCSS("transition-duration", "0s");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "afternoon");
  let info = await evidence(host);
  expect(info.sun.rising).toBe(false);
  expect(info.sun.altitude).toBeGreaterThan(0);
  expect(info.sun.altitude).toBeLessThan(2);
  expect(info.sky.visible).toBe(true);
  expect(info.sky.weight, "the twilight sky shows over the hills").toBeGreaterThan(0.6);
  expect(info.sky.sun, "the setting sun stays behind the viewer").toBeNull();
  expect(info.marineLayer.visible).toBe(true);
  expect(info.water.reflection.renders).toBeGreaterThanOrEqual(1);
  let contrast = await creditContrast(page);
  expect(contrast.median, "credit contrast at sunset").toBeGreaterThanOrEqual(4.5);
  await testInfo.attach("credit-contrast-sunset", { body: JSON.stringify(contrast), contentType: "application/json" });
  await attachScreenshot(page, testInfo, "coast-sunset", { locator: page.locator("footer") });
  // Dusk: past the turn the whole site, the sun arc's label and the credit's ink agree it is evening.
  host = await at("18:30");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "evening");
  await expect(page.locator("#theme-menu [data-sun-knob]")).toHaveAttribute("aria-valuetext", "Evening, 6:30 pm");
  info = await evidence(host);
  expect(info.sun.altitude).toBeLessThan(-3);
  expect(info.sky.visible).toBe(true);
  expect(info.sky.sun, "the sun has set").toBeNull();
  expect(info.sky.lights, "the hillside houses are lit").toBeGreaterThan(0.5);
  contrast = await creditContrast(page);
  expect(contrast.median, "credit contrast at dusk").toBeGreaterThanOrEqual(4.5);
  await testInfo.attach("credit-contrast-dusk", { body: JSON.stringify(contrast), contentType: "application/json" });
  await attachScreenshot(page, testInfo, "coast-dusk", { locator: page.locator("footer") });
  // Dawn faces the sunrise: twenty minutes after it the disk has cleared the hills ahead.
  host = await at("07:25");
  info = await evidence(host);
  expect(info.sun.rising).toBe(true);
  expect(info.sky.sun, "the rising sun stands over the hills").not.toBeNull();
  await attachScreenshot(page, testInfo, "coast-dawn", { locator: page.locator("footer") });
  expect(errors).toEqual([]);
});

test("coastal scenes: lazy loading, automatic movement, offscreen pause and reversible reveal", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const errors = collectRuntimeErrors(page),
    requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await preparePage(page, "noon");
  await page.goto(publicRouteUrl("/"));
  expect(requests.filter((x) => /models\/la-jolla\/.*\.glb|footer-coast\/scene.mjs/.test(x))).toEqual([]);
  const host = page.locator("footer [data-footer-coast]");
  const started = Date.now();
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  const loadMs = Date.now() - started;
  await page.waitForTimeout(1800);
  const a = await host.locator("canvas").screenshot(),
    f = (await evidence(host)).frames;
  await page.waitForTimeout(2500);
  const fps = ((await evidence(host)).frames - f) / 2.5;
  expect(fps).toBeGreaterThan(0);
  expect(fps).toBeLessThan(33);
  expect(screenshotDiffRatio(a, await host.locator("canvas").screenshot(), { threshold: 0.03 })).toBeGreaterThan(0.0001);
  const revealed = (await evidence(host)).reveal;
  // Place the coast at the reveal boundary before measuring its response.
  // Page-level smooth scrolling has a separate, compositor-dependent duration.
  await host.evaluate((e) => scrollTo({ top: scrollY + e.getBoundingClientRect().top - innerHeight + 80, behavior: "instant" }));
  await page.waitForTimeout(1400);
  expect((await evidence(host)).reveal).toBeLessThan(revealed - 0.2);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(host).toHaveAttribute("data-running", "false");
  const still = (await evidence(host)).frames;
  await page.waitForTimeout(350);
  expect((await evidence(host)).frames).toBe(still);
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-running", "true");
  await testInfo.attach("performance", {
    body: JSON.stringify({
      loadMs,
      fps,
      viewport: page.viewportSize(),
      platform: "Local Chromium. Mobile viewport emulation, not physical-device measurement.",
    }),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});

test("coastal people: a composed still for automation, gentle loops with ?cinematic=live", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const errors = collectRuntimeErrors(page);
  const host = await open(page, "noon");
  await page.waitForTimeout(1200);
  const still = (await evidence(host)).people;
  // Automation sees the same composed pose the posters show, while water and palms move.
  expect(still.live).toBe(false);
  expect(still.pose).toBe(0);
  expect(still.visible).toEqual(expect.arrayContaining(["tennis", "volleyball", "shore-walk", "surf-ride", "swimmer", "bench-1"]));
  expect(still.visible).not.toContain("fire");
  await page.goto(publicRouteUrl("/?cinematic=live"), { waitUntil: "domcontentloaded" });
  const live = page.locator("footer [data-footer-coast]");
  await live.scrollIntoViewIfNeeded();
  await expect(live).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  await expect.poll(async () => (await evidence(live)).people.pose, { timeout: 15000 }).toBeGreaterThan(0.5);
  const before = (await evidence(live)).people.pose;
  await page.waitForTimeout(800);
  const after = await evidence(live);
  expect(after.people.live).toBe(true);
  expect(after.people.pose).toBeGreaterThan(before);
  // People follow the scene clock, so they rest with the rest of the coast offscreen.
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(live).toHaveAttribute("data-running", "false");
  const paused = (await evidence(live)).people.pose;
  await page.waitForTimeout(400);
  expect((await evidence(live)).people.pose).toBe(paused);
  await live.scrollIntoViewIfNeeded();
  await attachScreenshot(page, testInfo, "coast-people-live", { locator: page.locator("footer") });
  expect(errors).toEqual([]);
});

test("coastal surfer: a full carve follows its nose, keeps deck contacts and holds its pose when motion stops", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  test.setTimeout(120000);
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "noon");
  await page.goto(publicRouteUrl("/?cinematic=live"), { waitUntil: "domcontentloaded" });
  const host = page.locator("footer [data-footer-coast]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 60000 });
  // Sample the actual rendered frames in-page. Eight protocol reads can alias
  // the turn on software WebGL, especially when screenshots consume wall time.
  await host.evaluate((element) => {
    const recorder = (window.surferCycleRecorder = { frames: [], stopped: false });
    let previous = -1;
    const sample = () => {
      if (recorder.stopped || !element.isConnected) return;
      const state = element.getCoastEvidence();
      if (state.frames !== previous) {
        previous = state.frames;
        recorder.frames.push({
          elapsed: state.elapsed,
          frames: state.frames,
          rider: state.surfers.find((rider) => rider.name === "Surfer1"),
          contacts: state.people.riders[0].feet,
          waterRide: state.water.ride,
        });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const samples = [];
  for (let i = 0; i <= 8; i++) {
    if (i) await page.waitForTimeout((Math.PI * 10 * 1000) / 8);
    const state = await evidence(host);
    const rider = state.surfers.find((s) => s.name === "Surfer1");
    const [qx, qy, qz, qw] = rider.quaternion;
    const nose = [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qz - qy * qw)];
    expect((nose[0] * rider.ride.heading[0] + nose[1] * rider.ride.heading[1]) / Math.hypot(...nose)).toBeGreaterThan(0.9999);
    const contacts = state.people.riders[0].feet;
    for (const foot of contacts) expect(Math.abs(foot.a[1] - foot.radius - 0.043)).toBeLessThan(1e-8);
    if (samples.length) {
      const old = samples.at(-1).contacts;
      contacts.forEach((foot, j) => foot.a.forEach((v, k) => expect(Math.abs(v - old[j].a[k])).toBeLessThan(1e-8)));
    }
    expect(state.water.ride.trailPoints).toBe(9);
    expect(Math.abs(state.water.ride.power - rider.ride.power)).toBeLessThan(1e-6);
    samples.push({ elapsed: state.elapsed, rider, contacts, frames: state.frames });
    if ([0, 2, 4, 6, 8].includes(i)) await host.locator("canvas").screenshot({ path: testInfo.outputPath(`surfer-cycle-${i}.png`) });
  }
  expect(samples.at(-1).elapsed - samples[0].elapsed).toBeGreaterThanOrEqual(Math.PI * 10);
  const renderedFrames = await page.evaluate(() => {
    window.surferCycleRecorder.stopped = true;
    return window.surferCycleRecorder.frames;
  });
  await writeFile(testInfo.outputPath("surfer-rendered-cycle.json"), JSON.stringify(renderedFrames, null, 2));
  expect(renderedFrames.at(-1).elapsed - renderedFrames[0].elapsed).toBeGreaterThanOrEqual(Math.PI * 10);
  expect(renderedFrames.length).toBeGreaterThan(16);
  for (const state of renderedFrames) {
    const [qx, qy, qz, qw] = state.rider.quaternion;
    const nose = [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qz - qy * qw)];
    expect((nose[0] * state.rider.ride.heading[0] + nose[1] * state.rider.ride.heading[1]) / Math.hypot(...nose)).toBeGreaterThan(0.9999);
    for (const foot of state.contacts) expect(Math.abs(foot.a[1] - foot.radius - 0.043)).toBeLessThan(1e-8);
    expect(Math.abs(state.waterRide.power - state.rider.ride.power)).toBeLessThan(1e-6);
  }
  const headings = renderedFrames.map((s) => s.rider.ride.heading);
  expect(Math.min(...headings.map((h) => h[0]))).toBeLessThan(-0.8);
  expect(Math.max(...headings.map((h) => h[0]))).toBeGreaterThan(0.8);
  expect(Math.min(...headings.map((h) => h[1]))).toBeLessThan(-0.6);
  expect(Math.max(...headings.map((h) => h[1]))).toBeGreaterThan(0.6);
  expect(screenshotMetrics(await host.locator("canvas").screenshot()).uniqueColors).toBeGreaterThan(300);
  // The actual reduced-motion transition must hold the current board AND body, not
  // reset the body to its poster pose while leaving the board halfway through a turn.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(host).toHaveAttribute("data-running", "false");
  const held = await evidence(host);
  expect(held.people.pose).toBeGreaterThan(1);
  await page.waitForTimeout(450);
  const still = await evidence(host);
  expect(still.surfers).toEqual(held.surfers);
  expect(still.people.riders).toEqual(held.people.riders);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(host).toHaveAttribute("data-running", "true");
  await expect.poll(async () => (await evidence(host)).elapsed).toBeGreaterThan(held.elapsed);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(host).toHaveAttribute("data-running", "false");
  const offscreen = await evidence(host);
  await page.waitForTimeout(350);
  expect((await evidence(host)).elapsed).toBe(offscreen.elapsed);
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-running", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 60000 });
  const initialStill = await evidence(host);
  expect(initialStill.elapsed).toBe(0);
  expect(initialStill.people.pose).toBe(0);
  await host.locator("canvas").screenshot({ path: testInfo.outputPath("surfer-reduced.png") });
  await writeFile(testInfo.outputPath("surfer-cycle.json"), JSON.stringify({ samples, held, initialStill, errors }, null, 2));
  expect(errors).toEqual([]);
});

test("coastal people: the evening fire circle replaces the daytime crowd", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = collectRuntimeErrors(page);
  const host = await open(page, "evening");
  const night = (await evidence(host)).people;
  expect(night.live).toBe(false);
  expect(night.visible).toEqual(expect.arrayContaining(["fire", "shore-couple"]));
  for (const id of ["tennis", "volleyball", "shore-walk", "surf-ride", "sunbather"]) expect(night.visible).not.toContain(id);
  await attachScreenshot(page, testInfo, "coast-people-evening", { locator: page.locator("footer") });
  expect(errors).toEqual([]);
});

test("homepage story: rail stays in its first-paint position while scripts load", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const wide = testInfo.project.name === "desktop-1440";
  if (wide) await page.setViewportSize({ width: 1920, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "noon");
  await page.addInitScript(() => {
    window.homeRailFirstPaint = { frames: [], stop: false };
    const sample = () => {
      const rail = document.querySelector(".home-story-rail");
      if (rail && getComputedStyle(rail).display !== "none") {
        const { x, y } = rail.getBoundingClientRect();
        window.homeRailFirstPaint.frames.push({ x, y, initialized: document.documentElement.classList.contains("home-motion-ready") });
      }
      if (!window.homeRailFirstPaint.stop) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  let releaseHome;
  const firstPaint = new Promise((resolve) => {
    releaseHome = resolve;
  });
  await page.route("**/assets/js/home.js*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await firstPaint;
    await route.continue();
  });
  await page.goto(publicRouteUrl("/"), { waitUntil: "commit" });
  try {
    // A fixed network delay alone can end before a busy software browser's
    // first paint. Observe that actual frame before allowing initialization.
    if (wide) await expect.poll(() => page.evaluate(() => Boolean(window.homeRailFirstPaint?.frames.some((frame) => !frame.initialized)))).toBe(true);
  } finally {
    releaseHome();
  }
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const frames = await page.evaluate(() => {
    window.homeRailFirstPaint.stop = true;
    return window.homeRailFirstPaint.frames;
  });
  if (wide) {
    expect(frames.some((frame) => !frame.initialized)).toBe(true);
    expect(frames.some((frame) => frame.initialized)).toBe(true);
    expect(Math.max(...frames.map((frame) => frame.x)) - Math.min(...frames.map((frame) => frame.x))).toBeLessThan(1);
    expect(Math.max(...frames.map((frame) => frame.y)) - Math.min(...frames.map((frame) => frame.y))).toBeLessThan(1);
    expect(frames[0].x).toBeGreaterThanOrEqual(16);
    expect(frames[0].x).toBeLessThanOrEqual(64);
  } else {
    await expect(page.locator(".home-story-rail")).toBeHidden();
    expect(frames).toEqual([]);
  }
  await testInfo.attach("first-paint-rail", { body: JSON.stringify({ viewport: page.viewportSize(), frames }), contentType: "application/json" });
  expect(errors).toEqual([]);
});

test("coastal navigation: helper clears the reading column and return control stays in the corner", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  const back = page.getByRole("button", { name: "Back to top", exact: true });
  await expect(back).toBeVisible();
  await expect(back).toHaveAttribute("tabindex", "0");
  const bounds = await back.boundingBox();
  expect(1000 - bounds.y - bounds.height).toBeGreaterThanOrEqual(15);
  expect(1000 - bounds.y - bounds.height).toBeLessThanOrEqual(30);
  const rail = page.getByRole("navigation", { name: "Homepage story" });
  await rail.hover();
  await expect(rail.getByRole("link", { name: "Connect", exact: true })).toBeVisible();
  const gap = await rail.evaluate((e) => document.querySelector(".home-title").getBoundingClientRect().left - e.getBoundingClientRect().right);
  expect(gap).toBeGreaterThanOrEqual(24);
  const railBounds = await rail.boundingBox();
  expect(railBounds.x).toBeGreaterThanOrEqual(16);
  expect(railBounds.x).toBeLessThanOrEqual(64);
  const footerTop = await page.locator("footer").evaluate((e) => e.getBoundingClientRect().top);
  expect(railBounds.y + railBounds.height).toBeLessThanOrEqual(footerTop - 24);
  await attachScreenshot(page, testInfo, "coast-navigation-wide");
  await back.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator("#back-to-top")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#back-to-top")).toHaveAttribute("tabindex", "-1");
  // A short wide window has no vertical room for the rail above the coast.
  // It must leave both the skyline and keyboard focus order clear.
  await page.setViewportSize({ width: 1920, height: 540 });
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect(page.locator(".home-story-rail")).toHaveAttribute("inert", "");
  await expect(page.locator(".home-story-rail")).toBeHidden();
});
test("La Jolla miniature: keyboard orbit, static reduced motion, and map attribution", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(publicRouteUrl("/projects/la-jolla/"));
  const host = page.locator("[data-miniature]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  await expect(host).toHaveAttribute("data-running", "false");
  await expect(host.getByRole("link", { name: "OpenStreetMap contributors" })).toBeVisible();
  const surface = host.locator(".footer-coast__scene");
  await surface.focus();
  const a = await surface.screenshot();
  await surface.press("ArrowLeft");
  await surface.press("ArrowLeft");
  expect((await evidence(host)).orbit[0]).toBeLessThan(0);
  expect(screenshotDiffRatio(a, await surface.screenshot())).toBeGreaterThan(0.01);
  await surface.press("Home");
  expect((await evidence(host)).orbit).toEqual([0, 0]);
  await attachScreenshot(page, testInfo, "atlas-miniature", { locator: host });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
test("coastal footer: phone navigation reaches both landmark wings and returns home", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = collectRuntimeErrors(page);
  const host = await open(page);
  const surface = host.locator(".footer-coast__scene");
  const initial = await surface.screenshot();
  for (let i = 0; i < 10; i++) await surface.press("ArrowLeft");
  expect((await evidence(host)).framing.center[0]).toBeLessThan(-25);
  await attachScreenshot(page, testInfo, "phone-campus-wing", { locator: host });
  expect(screenshotDiffRatio(initial, await surface.screenshot())).toBeGreaterThan(0.01);
  for (let i = 0; i < 22; i++) await surface.press("ArrowRight");
  expect((await evidence(host)).framing.center[0]).toBeGreaterThan(35);
  const villageFrame = await host.evaluate((e) => {
    const frames = e.getCoastEvidence({ projectLandmarks: true }).landmarkFrames;
    const scene = e.getBoundingClientRect();
    const credit = e.closest("footer").querySelector(":scope > .container");
    // The container includes the link's 44px touch target. Measure the visible
    // text, so invisible hit-area padding is not mistaken for an overlap.
    const walker = document.createTreeWalker(credit, NodeFilter.SHOW_TEXT);
    const tops = [];
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(walker.currentNode);
      tops.push(range.getBoundingClientRect().top);
    }
    return { roof: frames.LaValencia.top, seawall: frames.ChildrensPool.bottom * scene.height, credit: Math.min(...tops) - scene.top };
  });
  expect(villageFrame.roof).toBeGreaterThan(0.01);
  expect(villageFrame.seawall).toBeLessThan(villageFrame.credit - 4);
  await attachScreenshot(page, testInfo, "phone-village-wing", { locator: host });
  await surface.press("Home");
  expect((await evidence(host)).framing.center[0]).toBeCloseTo(5.1);
  expect(await surface.evaluate((e) => getComputedStyle(e).touchAction)).toBe("pan-y pinch-zoom");
  expect(errors).toEqual([]);
});

test("coastal scenes: reduced motion and WebGL context recovery", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const host = await open(page, "evening");
  await expect(host).toHaveAttribute("data-running", "false");
  await page.waitForTimeout(500);
  const frames = (await evidence(host)).frames;
  await page.waitForTimeout(350);
  expect((await evidence(host)).frames).toBe(frames);
  await host.locator("canvas").evaluate((c) => {
    c.loss = c.getContext("webgl2").getExtension("WEBGL_lose_context");
    c.loss.loseContext();
  });
  await expect(host).toHaveAttribute("data-state", "fallback");
  await expect(host.locator(".footer-coast__poster")).toBeVisible();
  await host.locator("canvas").evaluate((c) => c.loss.restoreContext());
  await expect(host).toHaveAttribute("data-state", "ready");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(host).toHaveAttribute("data-running", "true");
});

test("La Jolla miniature: touch orbit preserves vertical page scrolling", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.goto(publicRouteUrl("/projects/la-jolla/"));
  const host = page.locator("[data-miniature]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  const surface = host.locator(".footer-coast__scene"),
    box = await surface.boundingBox();
  expect(await surface.evaluate((e) => getComputedStyle(e).touchAction)).toBe("pan-y pinch-zoom");
  const session = await context.newCDPSession(page),
    x = box.x + box.width * 0.65,
    y = box.y + box.height * 0.5;
  const touch = (type, px, py) =>
    session.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: px, y: py, id: 0 }] });
  await touch("touchStart", x, y);
  for (let i = 1; i <= 8; i++) await touch("touchMove", x - i * 10, y);
  await touch("touchEnd");
  expect(Math.abs((await evidence(host)).orbit[0])).toBeGreaterThan(0.1);
  const previous = await page.evaluate(() => scrollY);
  await touch("touchStart", x, y);
  for (let i = 1; i <= 8; i++) await touch("touchMove", x, y - i * 12);
  await touch("touchEnd");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(previous + 25);
});
test("coastal scenes: missing model and no JavaScript retain real rendered fallbacks", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await page.route(/\/models\/la-jolla\/la-jolla\.glb(?:\?.*)?$/, (r) => r.abort());
  await page.goto(publicRouteUrl("/"));
  const host = page.locator("footer [data-footer-coast]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "fallback", { timeout: 30000 });
  await expect.poll(() => host.locator("img").evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
  const staticPage = await context.newPage();
  await staticPage.goto(publicRouteUrl("/"));
  await expect(staticPage.locator("footer .footer-coast__poster")).toHaveCount(1);
  await expect(staticPage.locator("footer")).toContainText("Sirui Tao");
  await context.close();
  await page.goto(publicRouteUrl("/ai/"));
  await expect(page.locator("[data-footer-coast]")).toHaveCount(0);
});

async function openTiltCoast(page, permission = "granted") {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await preparePage(page, "noon");
  // Simulated permission and sensor samples exercise the real controller/camera.
  // This does not claim physical iPhone sensor or permission-dialog verification.
  await page.addInitScript((result) => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 1, configurable: true });
    const orientation = new EventTarget();
    orientation.angle = 0;
    Object.defineProperty(screen, "orientation", { value: orientation, configurable: true });
    const Sensor = window.DeviceOrientationEvent ?? class extends Event {};
    window.coastPermissionCalls = 0;
    window.coastPermissionActivation = [];
    Object.defineProperty(Sensor, "requestPermission", {
      configurable: true,
      value: () => {
        window.coastPermissionCalls++;
        window.coastPermissionActivation.push(navigator.userActivation.isActive);
        return Promise.resolve(result);
      },
    });
    window.DeviceOrientationEvent = Sensor;
    let held = null;
    const emit = () => {
      if (!held) return;
      const event = new Event("deviceorientation");
      Object.defineProperties(event, { beta: { value: held.beta }, gamma: { value: held.gamma } });
      dispatchEvent(event);
    };
    window.coastSensorSample = (beta, gamma, angle = screen.orientation.angle) => {
      held = { beta, gamma };
      if (angle !== screen.orientation.angle) {
        screen.orientation.angle = angle;
        screen.orientation.dispatchEvent(new Event("change"));
      }
      emit();
    };
    // Real sensors continue reporting a held pose, including after a screen
    // resize. A one-shot fixture incorrectly timed out during slow captures.
    setInterval(emit, 100);
  }, permission);
  await page.goto(publicRouteUrl("/blog/?cinematic=live"), { waitUntil: "domcontentloaded" });
  const host = page.locator("footer [data-footer-coast]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 60000 });
  await expect(host).toHaveAttribute("data-running", "true");
  return host;
}

test("coastal sky: a completed atmosphere relights the reflected sea in the same clock step", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-19T12:30:00-07:00"));
  const host = await openTiltCoast(page);
  await page.evaluate(() => {
    window.siteTime = { preview: 18 * 60 + 30 };
    setThemeSetting("evening");
    dispatchEvent(new CustomEvent("siteTimeChange"));
  });
  await expect
    .poll(async () => {
      const info = await evidence(host);
      return Math.abs(info.sky.tableAltitude - info.sun.altitude);
    })
    .toBeLessThan(0.01);
  const result = await host.evaluate(async (element) => {
    const { lookAt, mixHex } = await import(new URL("./sky-look.mjs?v=coast-daylight-20261028", new URL(element.dataset.coastModule, location.href)));
    const { sunState } = await import(new URL("../la-jolla-sun.mjs?v=coast-sky-20261019", new URL(element.dataset.coastModule, location.href)));
    const info = element.getCoastEvidence();
    const look = lookAt(sunState("2026-10-19", 18 * 60 + 30));
    return {
      actual: info.water.skyColors,
      expected: {
        near: mixHex(look.mirror, info.sky.samples.near, info.sky.weight),
        far: mixHex(look.mirrorFar, info.sky.samples.far, info.sky.weight),
      },
      sky: info.sky,
    };
  });
  // Evidence rounds weight to three decimals; allow one display code value per channel.
  for (const side of ["near", "far"])
    for (const shift of [0, 8, 16])
      expect(Math.abs(((result.actual[side] >> shift) & 255) - ((result.expected[side] >> shift) & 255))).toBeLessThanOrEqual(1);
  await testInfo.attach("one-clock-sky-and-sea", { body: JSON.stringify(result), contentType: "application/json" });
});

test("coastal ground: source relief meets the native coast and keeps the measured ridge", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const openGround = async (target, intercept = null) => {
    await target.emulateMedia({ reducedMotion: "reduce" });
    await target.clock.setFixedTime(new Date("2026-10-23T12:30:00-07:00"));
    await preparePage(target, "noon");
    if (intercept) await intercept(target);
    await target.goto(publicRouteUrl("/blog/"), { waitUntil: "domcontentloaded" });
    const host = target.locator("footer [data-footer-coast]");
    await host.scrollIntoViewIfNeeded();
    await expect(host).toHaveAttribute("data-state", "ready", { timeout: 60000 });
    await expect.poll(async () => (await evidence(host)).reveal).toBe(1);
    return host;
  };
  const host = await openGround(page);
  expect((await evidence(host)).sky.depthRelief).toMatchObject({ vertices: 37665, originalAngularRows: 147, atlas: [929, 235] });
  expect((await evidence(host)).sky.depthRelief.triangles).toBeGreaterThan(50000);
  const actual = await host.evaluate(async (element) => {
    const module = new URL(element.dataset.coastModule, location.href);
    const { loadRelief, decodeDepthField, createDepthGeometry, depthStageAnchor } = await import(new URL("./sky.mjs?v=coast-depth-20261029", module));
    const { acquireCoast } = await import(new URL("./assets.mjs?v=hollan-20261028", module));
    const THREE = await import(new URL("../three.module.min.js", module));
    const texture = await loadRelief(),
      canvas = document.createElement("canvas");
    canvas.width = texture.image.width;
    canvas.height = texture.image.height;
    canvas.getContext("2d").drawImage(texture.image, 0, 0);
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    const field = decodeDepthField(pixels),
      { geometry, evidence: source } = createDepthGeometry(field);
    const model = await acquireCoast("la-jolla.glb");
    try {
      model.scene.updateMatrixWorld(true);
      const edge = Array(521).fill(null),
        point = new THREE.Vector3();
      let found = false;
      model.scene.traverse((owner) => {
        if (!/Connected[ _]sandstone[ _]bluffs[ _]and[ _]park/.test(owner.name)) return;
        found = true;
        owner.traverse((mesh) => {
          const positions = mesh.geometry?.getAttribute("position");
          if (!positions) return;
          for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
            const column = Math.round(((point.x + 82) / 164) * 520);
            if (column < 0 || column > 520) continue;
            if (!edge[column] || point.z < edge[column].z) edge[column] = { x: point.x, y: point.y, z: point.z };
          }
        });
      });
      if (!found || edge.some((p) => !p)) throw new Error("The actual native back edge was not available");
      let yError = 0,
        zError = 0,
        checked = 0;
      const positions = geometry.getAttribute("position");
      for (let c = 0; c < 465; c++) {
        const anchor = depthStageAnchor(field, c * 0.5);
        if (anchor.scale <= 0) continue;
        const x = positions.getX(c * 81),
          u = ((x + 82) / 164) * 520,
          i = Math.min(Math.floor(u), 519),
          f = u - i;
        if (i < 0 || i > 519) continue;
        const y = edge[i].y + (edge[i + 1].y - edge[i].y) * f,
          z = edge[i].z + (edge[i + 1].z - edge[i].z) * f;
        yError = Math.max(yError, Math.abs(positions.getY(c * 81) - y));
        zError = Math.max(zError, Math.abs(positions.getZ(c * 81) - z));
        checked++;
      }
      const digest = await crypto.subtle.digest("SHA-256", pixels.data);
      return {
        source,
        nativeSeam: { yError, zError, checked },
        decodedSha256: Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join(""),
      };
    } finally {
      model.release();
      geometry.dispose();
      texture.dispose();
    }
  });
  expect(actual.nativeSeam.checked).toBeGreaterThan(350);
  // The actual exported model differs by about 5mm from its source edge;
  // the atlas datum is stored to 1mm. Keep that measured seam bound tight.
  expect(actual.nativeSeam.yError).toBeLessThan(0.006);
  expect(actual.nativeSeam.zError).toBeLessThan(0.006);
  expect(actual.source.crestProjectionErrorDegrees).toBeLessThan(1e-8);
  await writeFile(testInfo.outputPath("source-depth-proof.json"), JSON.stringify(actual, null, 2));
  const response = await page.request.get(publicRouteUrl("/assets/models/la-jolla/hills.png?v=coast-depth-20261029"));
  const atlas = PNG.sync.read(await response.body());
  expect(require("node:crypto").createHash("sha256").update(atlas.data).digest("hex")).toBe(actual.decodedSha256);
  const candidate = await host.locator("canvas").screenshot({ path: testInfo.outputPath("source-depth-ground.png") });
  const legacy = new PNG({ width: atlas.width, height: 147 });
  atlas.data.copy(legacy.data, 0, 0, legacy.data.length);
  const control = await page.context().newPage(),
    controlErrors = collectRuntimeErrors(control);
  try {
    // Sensitive control: the retained original angular rows invoke the legacy
    // plane fallback. All foreground models, materials, buffers and sky remain.
    const before = await openGround(control, (target) =>
      target.route(/\/models\/la-jolla\/hills\.png(?:\?.*)?$/, (route) => route.fulfill({ body: PNG.sync.write(legacy), contentType: "image/png" }))
    );
    expect((await evidence(before)).sky.depthRelief).toBeNull();
    const old = await before.locator("canvas").screenshot({ path: testInfo.outputPath("retained-angular-ground.png") });
    expect(screenshotDiffRatio(old, candidate, { threshold: 0.03 })).toBeGreaterThan(0.01);
    expect(controlErrors).toEqual([]);
  } finally {
    await control.close();
  }
  expect(errors).toEqual([]);
});

test("coastal view: pointer glide stays bounded and settles without rolling the horizon", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const host = await openTiltCoast(page);
  const surface = host.locator(".footer-coast__scene");
  const box = await surface.boundingBox();
  const before = await evidence(host);
  const clip = { x: box.x, y: box.y, width: box.width, height: box.height * 0.72 };
  const still = await page.screenshot({ clip });
  // The independent companion can pass over the footer. Find actual exposed
  // scene pixels so this camera check does not accidentally hover its hit target.
  const point = await surface.evaluate((element) => {
    const r = element.getBoundingClientRect();
    for (const x of [0.92, 0.96, 0.9])
      for (const y of [0.4, 0.55, 0.7, 0.1]) {
        const point = { x: r.x + r.width * x, y: r.y + r.height * y };
        if (document.elementFromPoint(point.x, point.y)?.closest(".footer-coast__scene") === element) return point;
      }
    throw new Error("The scene's pointer test area is covered");
  });
  await page.mouse.move(point.x, point.y);
  await expect.poll(async () => (await evidence(host)).viewMotion.x).toBeGreaterThan(0.78);
  const moved = await evidence(host);
  expect(moved.viewMotion.up).toEqual([0, 1, 0]);
  expect(moved.viewMotion.camera[0] - before.viewMotion.camera[0]).toBeGreaterThan(0.34);
  expect(moved.viewMotion.camera[0] - before.viewMotion.camera[0]).toBeLessThan(0.46);
  expect(Math.abs(moved.viewMotion.camera[1] - before.viewMotion.camera[1])).toBeLessThan(0.19);
  expect(screenshotDiffRatio(still, await page.screenshot({ clip }), { threshold: 0.01 })).toBeGreaterThan(0.001);
  await page.mouse.move(box.x + box.width / 2, box.y - 20);
  await expect.poll(async () => Math.abs((await evidence(host)).viewMotion.x)).toBeLessThan(0.02);
  expect(await page.evaluate(() => window.coastPermissionCalls)).toBe(0);
  await testInfo.attach("pointer-camera", {
    body: JSON.stringify({ before: before.viewMotion, moved: moved.viewMotion }),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});

// The phone uses a real trusted tap. Other profiles use the existing keyboard
// pan gesture at phone width; both must call the API while activation is live.
async function requestTilt(page, host, testInfo) {
  const surface = host.locator(".footer-coast__scene");
  if (testInfo.project.use.hasTouch) await surface.tap({ position: { x: 55, y: 80 } });
  else {
    await page.setViewportSize({ width: 390, height: 1000 });
    await host.scrollIntoViewIfNeeded();
    await surface.press("ArrowRight");
    await surface.press("Home");
  }
  expect(await page.evaluate(() => window.coastPermissionActivation)).toEqual([true]);
}

test("coastal tilt: a footer gesture grants access and rotation keeps the view calibrated", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const host = await openTiltCoast(page);
  await expect(host.locator("[data-coast-tilt]")).toHaveCount(0);
  expect(await page.evaluate(() => window.coastPermissionCalls)).toBe(0);
  await requestTilt(page, host, testInfo);
  expect(await page.evaluate(() => window.coastPermissionCalls)).toBe(1);
  await page.evaluate(() => coastSensorSample(55, 0));
  expect((await evidence(host)).viewMotion.tilt.state).toBe("on");
  const canvas = host.locator("canvas");
  const box = await canvas.boundingBox();
  const clip = { x: box.x, y: box.y, width: box.width, height: box.height * 0.72 };
  const neutralPixels = await page.screenshot({ clip });
  await page.evaluate(() => coastSensorSample(55, 30));
  await expect.poll(async () => (await evidence(host)).viewMotion.x).toBeLessThan(-0.65);
  const moving = await evidence(host);
  expect(moving.viewMotion.up).toEqual([0, 1, 0]);
  expect(screenshotDiffRatio(neutralPixels, await page.screenshot({ clip }), { threshold: 0.01 })).toBeGreaterThan(0.001);
  await page.evaluate(() => coastSensorSample(55, 30, 90));
  let neutral = (await evidence(host)).viewMotion.tilt;
  expect(neutral.state).toBe("on");
  expect(Math.hypot(neutral.x, neutral.y)).toBeLessThan(1e-8);
  await expect.poll(async () => Math.abs((await evidence(host)).viewMotion.x)).toBeLessThan(0.02);
  if (testInfo.project.name === "mobile-390") {
    await page.setViewportSize({ width: 844, height: 390 });
    await host.scrollIntoViewIfNeeded();
    await expect.poll(async () => (await evidence(host)).framing.width).toBeGreaterThan(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await attachScreenshot(page, testInfo, "tilt-landscape", { locator: host });
  }
  await page.evaluate(() => window.siteMotion.setPaused(true));
  await expect(host).toHaveAttribute("data-running", "false");
  expect((await evidence(host)).viewMotion).toMatchObject({ x: 0, y: 0, tilt: { state: "suspended", listening: false } });
  await page.evaluate(() => {
    coastSensorSample(40, 12, 90);
    window.siteMotion.setPaused(false);
  });
  await page.evaluate(() => coastSensorSample(40, 12, 90));
  neutral = (await evidence(host)).viewMotion.tilt;
  expect(neutral.state).toBe("on");
  expect(Math.hypot(neutral.x, neutral.y)).toBeLessThan(1e-8);
  expect(await page.evaluate(() => window.coastPermissionCalls)).toBe(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(host).toHaveAttribute("data-running", "false");
  expect((await evidence(host)).viewMotion.tilt).toMatchObject({ state: "suspended", listening: false });
  await testInfo.attach("simulated-tilt-camera", { body: JSON.stringify(moving.viewMotion), contentType: "application/json" });
  expect(errors).toEqual([]);
});

test("coastal tilt: automatically permitted motion needs no prompt or badge", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const host = await openTiltCoast(page);
  await expect(host.locator("[data-coast-tilt]")).toHaveCount(0);
  await page.evaluate(() => coastSensorSample(55, 0));
  expect((await evidence(host)).viewMotion.tilt).toMatchObject({ state: "on", permission: "granted", requested: false });
  const canvas = host.locator("canvas");
  const before = await canvas.screenshot();
  await page.evaluate(() => coastSensorSample(55, -25));
  await expect.poll(async () => (await evidence(host)).viewMotion.x).toBeGreaterThan(0.6);
  expect((await evidence(host)).viewMotion.up).toEqual([0, 1, 0]);
  expect(screenshotDiffRatio(before, await canvas.screenshot(), { threshold: 0.01 })).toBeGreaterThan(0.001);
  expect(await page.evaluate(() => window.coastPermissionCalls)).toBe(0);
  await attachScreenshot(page, testInfo, "automatic-motion-no-badge", { locator: host });
  expect(errors).toEqual([]);
});

test("coastal tilt: denied permission preserves the coast and native scrolling", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const host = await openTiltCoast(page, "denied");
  await requestTilt(page, host, testInfo);
  await expect(host.locator("[data-coast-tilt]")).toHaveCount(0);
  await expect(host.locator("[data-coast-tilt-status]")).toContainText("not allowed");
  expect((await evidence(host)).viewMotion.tilt).toMatchObject({ state: "denied", listening: false, enabled: false });
  expect(await host.locator(".footer-coast__scene").evaluate((e) => getComputedStyle(e).touchAction)).toBe("pan-y pinch-zoom");
  const before = await page.evaluate(() => scrollY);
  if (testInfo.project.use.hasTouch && page.context().browser().browserType().name() === "chromium") {
    const surface = host.locator(".footer-coast__scene"),
      box = await surface.boundingBox();
    const session = await page.context().newCDPSession(page),
      x = box.x + 90,
      y = box.y + 50;
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 0 }] });
    for (let i = 1; i <= 10; i++) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + 16 * i, id: 0 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
  } else await host.locator(".footer-coast__scene").press("PageUp");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(before - 100);
  await expect(host).toHaveAttribute("data-state", "ready");
  expect(screenshotMetrics(await host.locator("canvas").screenshot()).uniqueColors).toBeGreaterThan(300);
  expect(errors).toEqual([]);
});
