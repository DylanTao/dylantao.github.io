const { test, expect } = require("@playwright/test");
const { writeFile } = require("node:fs/promises");
const { PNG } = require("pngjs");
const { preparePage, collectRuntimeErrors, screenshotDiffRatio } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

const twoFrames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const artworkDifference = (a, b) => {
  const first = PNG.sync.read(a),
    second = PNG.sync.read(b);
  const ink = (data, i) => {
    const [r, g, blue] = data.slice(i, i + 3);
    return r > g * 1.2 && g > blue * 1.2;
  };
  let changed = 0,
    painted = 0;
  for (let i = 0; i < first.data.length; i += 4) {
    const x = ink(first.data, i),
      y = ink(second.data, i);
    if (x || y) painted++;
    if (x !== y) changed++;
  }
  return changed / Math.max(1, painted);
};
const artworkBounds = (mark) =>
  mark.locator("path").evaluateAll((paths) =>
    paths.map((path) => {
      const r = path.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    })
  );

test("brand mark: the orange floats, Sirui drifts away and the home link restores the name", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await preparePage(page, "noon");
  await page.goto(publicRouteUrl("/blog/"), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  const brand = page.locator("#navbar .site-brand");
  const mark = brand.locator(".brand-orange-svg");
  await expect(brand.locator(".brand-name-first")).toHaveText("Sirui,");
  await expect(brand.locator(".brand-name-last")).toHaveText("Tao");
  expect(await brand.innerHTML(), "the actual visible name must be rendered through Liquid").not.toMatch(/\{[{%]|[%}]\}/);
  const box = await brand.boundingBox();
  const navigation = () =>
    page.locator(".navbar-actions, .navbar-toggler, .navbar-menu-list").evaluateAll((nodes) =>
      nodes.map((e) => {
        const r = e.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height];
      })
    );
  const layout = await navigation();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(brand).toHaveAttribute("href", /\/al-folio\/$/);
  const palettes = [];
  for (const theme of ["morning", "noon", "afternoon", "evening"]) {
    await page.evaluate((mode) => setThemeSetting(mode), theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme-mode", theme);
    await twoFrames(page);
    palettes.push(
      await mark.evaluate((svg) => ({
        mode: document.documentElement.dataset.themeMode,
        orange: getComputedStyle(svg.querySelector(".brand-float-stop-body")).stopColor,
        water: getComputedStyle(svg.querySelector(".brand-orange-sea")).stroke,
        glint: getComputedStyle(svg.querySelector(".brand-orange-glint")).stroke,
        glintPosition: getComputedStyle(svg.querySelector(".brand-orange-glint-zone")).transform,
      }))
    );
    await page.locator("#navbar").screenshot({ path: testInfo.outputPath(`navbar-${theme}.png`) });
  }
  expect(new Set(palettes.map((p) => p.orange)).size, "the orange subtly follows the site sky").toBe(4);
  expect(new Set(palettes.map((p) => p.water)).size, "the blue water follows the site sky").toBe(4);
  expect(new Set(palettes.map((p) => p.glintPosition)).size, "the warm reflection follows the existing sun arc").toBeGreaterThan(1);
  await page.mouse.move(0, 100);
  // Let the last page-theme background transition finish before comparing
  // this transparent mark pixel-for-pixel in its undiscovered state.
  await page.waitForTimeout(800);
  const resting = await mark.screenshot();
  await page.waitForTimeout(300);
  expect(await mark.screenshot(), "the identity is still before discovery").toEqual(resting);
  await page.keyboard.press("Tab");
  await brand.focus();
  await expect(brand).toHaveAttribute("data-brand-state", "discovering");
  await page.waitForTimeout(1000);
  const focused = await mark.screenshot({ path: testInfo.outputPath("brand-focused.png") });
  expect(screenshotDiffRatio(resting, focused, { threshold: 0.03 }), "keyboard discovery moves the orange and water").toBeGreaterThan(0.001);
  const visibleOrange = [];
  // Observe a full 5.6 s water cycle. Half a cycle can miss the exposed-area
  // extrema at phone size, where a single edge pixel is a material fraction.
  for (let i = 0; i < 21; i++) {
    const png = PNG.sync.read(await mark.screenshot());
    let count = 0;
    for (let p = 0; p < png.data.length; p += 4) if (png.data[p] > png.data[p + 1] * 1.2 && png.data[p + 1] > png.data[p + 2] * 1.2) count++;
    visibleOrange.push(count);
    await page.waitForTimeout(300);
  }
  const occlusionRange = (Math.max(...visibleOrange) - Math.min(...visibleOrange)) / Math.max(...visibleOrange);
  expect(occlusionRange, "the moving water conceals and reveals the orange; a 1.5% scale alone is insufficient").toBeGreaterThan(0.04);
  expect(await brand.evaluate((e) => getComputedStyle(e.querySelector(".brand-orange")).outlineStyle)).not.toBe("none");
  await page.locator("#navbar").screenshot({ path: testInfo.outputPath("brand-discovery.png") });
  await brand.evaluate((element) => element.blur());
  await page.mouse.move(0, 100);
  await expect(brand).toHaveAttribute("data-brand-state", "adrift");
  await expect(brand.locator(".brand-name-identity")).toBeHidden();
  expect((await brand.locator(".brand-name-story > span").allTextContents()).join(" ")).toBe("an orange floating in ocean");
  const wordBounds = await brand.evaluate((element) => {
    const container = element.querySelector(".site-brand-name").getBoundingClientRect();
    return Array.from(element.querySelectorAll(".brand-wave-word")).map((word) => {
      const r = word.getBoundingClientRect();
      return {
        text: word.textContent,
        left: r.left - container.left,
        right: r.right - container.left,
        top: r.top - container.top,
        bottom: r.bottom - container.top,
        width: container.width,
        height: container.height,
      };
    });
  });
  for (const word of wordBounds) {
    expect(word.left, word.text).toBeGreaterThanOrEqual(-1);
    expect(word.right, word.text).toBeLessThanOrEqual(word.width + 1);
    expect(word.top, word.text).toBeGreaterThanOrEqual(-1);
    expect(word.bottom, word.text).toBeLessThanOrEqual(word.height + 1);
  }
  const letterScales = await brand.locator(".brand-wave-letter").evaluateAll((letters) =>
    letters.map((e) => {
      const m = new DOMMatrix(getComputedStyle(e).transform);
      return [Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)];
    })
  );
  for (const scales of letterScales) for (const scale of scales) expect(scale).toBeCloseTo(1, 5);
  expect(await brand.boundingBox()).toEqual(box);
  expect(await navigation(), "the story does not move navigation").toEqual(layout);
  await page.locator("#navbar").screenshot({ path: testInfo.outputPath("brand-after-pointer-leaves.png") });
  const geometryTransforms = () =>
    brand
      .locator(".brand-orange-sun, .brand-orange-current, .brand-orange-ripple, .brand-wave-letter")
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).transform));
  await page.evaluate(() => window.siteMotion.setPaused(true));
  await twoFrames(page);
  const globallyHeld = await geometryTransforms();
  await page.waitForTimeout(350);
  expect(await geometryTransforms(), "the page-wide motion switch holds both the mark and the lettering").toEqual(globallyHeld);
  await page.evaluate(() => window.siteMotion.setPaused(false));
  await page.waitForTimeout(350);
  expect(await geometryTransforms(), "the same discovered state resumes after the page-wide pause").not.toEqual(globallyHeld);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await twoFrames(page);
  const still = await mark.screenshot({ path: testInfo.outputPath("brand-reduced-rest.png") });
  const bounds = await artworkBounds(mark);
  const seaStroke = await mark.locator(".brand-orange-sea").evaluate((path) => getComputedStyle(path).stroke);
  await brand.focus();
  await twoFrames(page);
  const reduced = await mark.screenshot({ path: testInfo.outputPath("brand-reduced-focus.png") });
  // Preserve focus-ring paint while measuring the still orange; check water geometry/stroke too.
  const difference = artworkDifference(still, reduced);
  expect(difference, "reduced motion keeps the orange and current still").toBeLessThan(0.01);
  expect(await artworkBounds(mark)).toEqual(bounds);
  expect(await mark.locator(".brand-orange-sea").evaluate((path) => getComputedStyle(path).stroke)).toEqual(seaStroke);
  await writeFile(
    testInfo.outputPath("brand-motion.json"),
    JSON.stringify(
      { reducedArtworkDifference: difference, palettes, visibleOrange, occlusionRange, wordBounds, letterScales, navigation: layout, bounds },
      null,
      2
    )
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await Promise.all([page.waitForURL(/\/al-folio\/$/), brand.locator("[data-brand-orange]").click()]);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(350);
  expect(await brand.getAttribute("data-brand-state"), "the home icon restores the composed name under a stationary pointer").toBeNull();
  await expect(brand.locator(".brand-name-identity")).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(350);
  expect(await brand.getAttribute("data-brand-state"), "refresh also restores the composed name").toBeNull();
  expect(errors).toEqual([]);
});

test("brand mark: the AI profile keeps its identity still", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const errors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await preparePage(page, "noon");
  await page.goto(publicRouteUrl("/ai/"), { waitUntil: "domcontentloaded" });
  const brand = page.locator("#navbar .site-brand");
  await expect(brand).toHaveAttribute("data-brand-static", "");
  await expect(brand).toHaveAttribute("href", /\/ai\/#identity$/);
  await page.keyboard.press("Tab");
  await brand.focus();
  await page.waitForTimeout(450);
  expect(await brand.getAttribute("data-brand-state")).toBeNull();
  await expect(brand.locator(".brand-name-first")).toHaveText("Sirui,");
  expect(await brand.evaluate((e) => e.getAnimations({ subtree: true }).length)).toBe(0);
  await page.locator("#navbar").screenshot({ path: testInfo.outputPath("brand-ai-static.png") });
  expect(errors).toEqual([]);
});

test("brand mark: the same home identity remains visible without JavaScript", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: testInfo.project.use.viewport });
  const page = await context.newPage();
  await page.goto(publicRouteUrl("/blog/"), { waitUntil: "domcontentloaded" });
  const mark = page.locator("#navbar [data-brand-orange] svg");
  await expect(mark).toBeVisible();
  await expect(page.locator("#navbar .site-brand")).toHaveAttribute("href", /\/al-folio\/$/);
  await mark.screenshot({ path: testInfo.outputPath("brand-no-javascript.png") });
  await context.close();
});

test("brand mark: the recovery specimen varies while the home identity stays fixed", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const errors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await preparePage(page, "noon");
  const visits = [];
  for (const seed of ["52", "73"]) {
    await page.goto(`${publicRouteUrl("/404.html")}?orangeSeed=${seed}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const specimen = page.locator("[data-orange-specimen]");
    await expect(specimen).toHaveAttribute("data-orange-seed", seed);
    const brand = page.locator("#navbar .site-brand");
    await expect(brand).toHaveAttribute("href", /\/al-folio\/$/);
    await expect(page.getByRole("link", { name: "Return home", exact: true })).toHaveAttribute("href", /\/al-folio\/$/);
    await page.mouse.move(0, 100);
    visits.push({
      mark: await brand.locator("svg").screenshot({ path: testInfo.outputPath(`recovery-mark-${seed}.png`) }),
      specimen: await specimen.screenshot({ path: testInfo.outputPath(`recovery-specimen-${seed}.png`) }),
    });
    await page.screenshot({ path: testInfo.outputPath(`recovery-${seed}.png`) });
  }
  expect(screenshotDiffRatio(visits[0].mark, visits[1].mark), "the navigation identity is stable between visits").toBe(0);
  expect(screenshotDiffRatio(visits[0].specimen, visits[1].specimen), "only the playful recovery specimen varies").toBeGreaterThan(0.02);
  expect(errors).toEqual([]);
});

test("brand mark: browser and home-screen icons keep the sun and Pacific at native sizes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const errors = collectRuntimeErrors(page);
  const response = await page.request.get(publicRouteUrl("/assets/img/favicon.ico"));
  expect(response.ok()).toBeTruthy();
  const ico = await response.body();
  const icons = [];
  for (let i = 0; i < ico.readUInt16LE(4); i++) {
    const at = 6 + i * 16,
      size = ico[at] || 256,
      length = ico.readUInt32LE(at + 8),
      offset = ico.readUInt32LE(at + 12),
      bytes = ico.subarray(offset, offset + length);
    const png = PNG.sync.read(bytes);
    const colors = { orange: 0, sea: 0 };
    for (let p = 0; p < png.data.length; p += 4) {
      const [r, g, b, a] = png.data.subarray(p, p + 4);
      if (a < 128) continue;
      if (r > g * 1.2 && g > b * 1.2) {
        colors.orange++;
      }
      if (b > r * 1.2 && g > r * 1.2) colors.sea++;
    }
    for (const name of Object.keys(colors)) expect(colors[name], `${name} remains legible in the ${size}px icon`).toBeGreaterThan(1);
    icons.push({ size, colors, url: `data:image/png;base64,${bytes.toString("base64")}` });
  }
  expect(icons.map((i) => i.size)).toEqual([16, 32, 48]);
  const svg = publicRouteUrl("/assets/img/favicon.svg");
  const touch = publicRouteUrl("/assets/img/apple-touch-icon.png");
  const rows = icons.map((i) => `<figure><img width="${i.size}" height="${i.size}" src="${i.url}"><figcaption>ICO ${i.size}px</figcaption></figure>`);
  for (const size of [16, 24, 32])
    rows.push(`<figure><img width="${size}" height="${size}" src="${svg}"><figcaption>SVG ${size}px</figcaption></figure>`);
  rows.push(`<figure><img width="180" height="180" src="${touch}"><figcaption>Home screen 180px</figcaption></figure>`);
  await page.setContent(
    `<style>body{margin:0;font:14px system-ui}section{height:260px;display:flex;gap:30px;align-items:center;padding:20px 35px;box-sizing:border-box}figure{margin:0;display:grid;gap:18px;justify-items:center}figcaption{font-size:11px}section:first-of-type{background:#fbfaf7;color:#17202a}section:last-of-type{background:#111c22;color:#eef1f2}</style><section>${rows.join("")}</section><section>${rows.join("")}</section>`
  );
  await page.locator("img").evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
  await page.screenshot({ path: testInfo.outputPath("native-icon-family.png") });
  await writeFile(
    testInfo.outputPath("native-icon-family.json"),
    JSON.stringify(
      icons.map(({ size, colors }) => ({ size, colors })),
      null,
      2
    )
  );
  expect(errors).toEqual([]);
});
