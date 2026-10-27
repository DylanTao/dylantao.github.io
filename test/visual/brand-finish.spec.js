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
    return (r > g * 1.2 && g > blue * 1.2) || (g > r * 1.14 && g > blue * 1.15);
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

test("brand mark: the orange sun keeps its silhouette, focus and small-screen home link", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await preparePage(page, "noon");
  await page.goto(publicRouteUrl("/blog/"), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  const brand = page.locator("#navbar .site-brand");
  const mark = brand.locator(".brand-orange-svg");
  const box = await brand.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(brand).toHaveAttribute("href", /\/al-folio\/$/);
  for (const theme of ["morning", "noon", "afternoon", "evening"]) {
    await page.evaluate((mode) => setThemeSetting(mode), theme);
    await twoFrames(page);
    await page.locator("#navbar").screenshot({ path: testInfo.outputPath(`navbar-${theme}.png`) });
  }
  await page.mouse.move(0, 100);
  const resting = await mark.screenshot();
  const crown = await mark.locator(".brand-orange-crown").boundingBox();
  const sea = await mark.locator(".brand-orange-sea").boundingBox();
  await page.keyboard.press("Tab");
  await brand.focus();
  await page.waitForTimeout(350);
  const focused = await mark.screenshot({ path: testInfo.outputPath("brand-focused.png") });
  expect(screenshotDiffRatio(resting, focused, { threshold: 0.03 }), "the sun responds to keyboard focus").toBeGreaterThan(0.001);
  const focusedCrown = await mark.locator(".brand-orange-crown").boundingBox();
  expect(focusedCrown.y - crown.y, "the sun dips slightly behind the level sea").toBeGreaterThan(0.2);
  expect(focusedCrown.y - crown.y).toBeLessThan(1.5);
  expect(await mark.locator(".brand-orange-sea").boundingBox()).toEqual(sea);
  expect(await brand.evaluate((e) => getComputedStyle(e.querySelector(".brand-orange")).outlineStyle)).not.toBe("none");
  expect(await brand.boundingBox()).toEqual(box);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await brand.evaluate((element) => element.blur());
  await twoFrames(page);
  const still = await mark.screenshot({ path: testInfo.outputPath("brand-reduced-rest.png") });
  const bounds = await artworkBounds(mark);
  await brand.focus();
  await twoFrames(page);
  const reduced = await mark.screenshot({ path: testInfo.outputPath("brand-reduced-focus.png") });
  // Keyboard focus adds a ring/shadow around the drawing. Preserve that accessible paint while
  // comparing the orange/green silhouette itself and its actual on-screen path coordinates.
  const difference = artworkDifference(still, reduced);
  expect(difference, "reduced motion keeps the fruit and leaf silhouette still").toBeLessThan(0.01);
  expect(await artworkBounds(mark)).toEqual(bounds);
  await writeFile(
    testInfo.outputPath("brand-motion.json"),
    JSON.stringify({ reducedArtworkDifference: difference, focusCrownShift: focusedCrown.y - crown.y, seaBounds: sea, bounds }, null, 2)
  );
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

test("brand mark: browser and home-screen icons keep the sun, leaf and Pacific at native sizes", async ({ page }, testInfo) => {
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
    const colors = { orange: 0, leaf: 0, sea: 0 };
    for (let p = 0; p < png.data.length; p += 4) {
      const [r, g, b, a] = png.data.subarray(p, p + 4);
      if (a < 128) continue;
      if (r > g * 1.2 && g > b * 1.2) colors.orange++;
      if (g > r * 1.14 && g > b * 1.15) colors.leaf++;
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
