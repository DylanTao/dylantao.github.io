const path = require("node:path"),
  fs = require("node:fs");
const { chromium } = require("playwright");
const { preparePage, collectRuntimeErrors } = require("../../../../test/visual/helpers.js");
const q = __dirname,
  label = process.env.UI_CAPTURE || "baseline";
const out = process.env.REVIEW_OUT;
if (!out) throw new Error("Set REVIEW_OUT to a new ignored output folder; retained evidence must not be overwritten");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const records = [];
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        deviceScaleFactor: 1,
        isMobile: width < 768,
        hasTouch: width < 768,
        timezoneId: "America/Los_Angeles",
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(45000);
      const errors = collectRuntimeErrors(page);
      await preparePage(page, "noon");
      await page.goto((process.env.VISUAL_BASE_URL || "http://127.0.0.1:4151/al-folio").replace(/\/$/, "") + "/blog/", {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate(() => document.fonts.ready);
      const palettes = [];
      for (const theme of ["morning", "noon", "afternoon", "evening"]) {
        await page.evaluate((theme) => setThemeSetting(theme), theme);
        await page.waitForTimeout(500);
        await page.locator("#navbar").screenshot({ path: path.join(out, `navbar-${width}-${theme}.png`) });
        await page.locator("#navbar .brand-orange-svg").screenshot({ path: path.join(out, `mark-${width}-${theme}.png`) });
        palettes.push(
          await page.locator("#navbar .brand-orange-svg").evaluate((svg) => ({
            theme: document.documentElement.dataset.themeMode,
            orange: getComputedStyle(svg.querySelector(".brand-float-stop-body")).stopColor,
            water: getComputedStyle(svg.querySelector(".brand-orange-sea")).stroke,
            glint: getComputedStyle(svg.querySelector(".brand-orange-glint")).stroke,
          }))
        );
      }
      await page.evaluate(() => setThemeSetting("noon"));
      const footer = page.locator("[data-footer-coast]");
      await footer.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector("[data-footer-coast]")?.dataset.state === "ready");
      for (const theme of ["noon", "evening"]) {
        await page.evaluate((theme) => setThemeSetting(theme), theme);
        await page.waitForTimeout(600);
        await footer.screenshot({ path: path.join(out, `footer-${width}-${theme}.png`) });
      }
      records.push({
        width,
        palettes,
        errors,
        footer: await footer.evaluate((e) => ({
          state: e.dataset.state,
          running: e.dataset.running,
          bounds: (() => {
            const r = e.getBoundingClientRect();
            return [r.width, r.height];
          })(),
          tiltText: e.querySelector("[data-coast-tilt]")?.textContent.trim() ?? null,
        })),
      });
      await context.close();
    }
    fs.writeFileSync(path.join(out, "capture.json"), JSON.stringify(records, null, 2));
    console.log(JSON.stringify({ label, records }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
