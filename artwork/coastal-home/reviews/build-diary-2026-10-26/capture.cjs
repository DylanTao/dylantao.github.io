// Focused browser proof for the diary's progressive fallback and controls.
// Serve the complete production build; DIARY_URL includes its baseurl.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium, devices } = require("playwright");
const root = path.resolve(__dirname, "../../../..");
const { collectRuntimeErrors, preparePage } = require(path.join(root, "test/visual/helpers.js"));
const base = process.env.DIARY_URL || "http://127.0.0.1:4102/al-folio/";
const output = path.join(root, ".jekyll-cache/visual-qa/diary-review/focused");
const launchOptions = process.platform === "win32" ? { args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] } : {};
const routes = ["homepage-desk-scene", "house-in-the-cliff"];
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...launchOptions });
  const report = {
    base,
    launchOptions,
    scope: "Desktop and phone viewport emulation on this host; no physical-device performance claim",
    states: [],
  };
  try {
    for (const width of [1440, 390]) {
      for (const route of routes) {
        for (const javaScriptEnabled of [true, false]) {
          const context = await browser.newContext({
            ...(width === 390 ? devices["Pixel 5"] : {}),
            viewport: { width, height: 1000 },
            deviceScaleFactor: 1,
            javaScriptEnabled,
            reducedMotion: "reduce",
            timezoneId: "America/Los_Angeles",
          });
          const page = await context.newPage();
          page.setDefaultTimeout(20000);
          const errors = collectRuntimeErrors(page);
          await preparePage(page, "light");
          const response = await page.goto(new URL(`projects/${route}/`, base).href, { waitUntil: "load" });
          assert.equal(response.status(), 200);
          const diary = page.locator("[data-build-diary]");
          await diary.waitFor({ state: "visible" });
          const outline = await page
            .locator("article h1,article h2,article h3,article h4,article h5,article h6")
            .evaluateAll((nodes) => nodes.map((n) => ({ level: Number(n.tagName.slice(1)), text: n.textContent.trim() })));
          assert.equal(outline.filter((h) => h.level === 1).length, 1);
          for (let i = 1; i < outline.length; i++)
            assert.ok(outline[i].level <= outline[i - 1].level + 1, `Skipped heading level: ${outline[i].text}`);
          const duplicateIds = await page.evaluate(() => {
            const seen = new Set();
            return [...document.querySelectorAll("[id]")].map((n) => n.id).filter((id) => seen.has(id) || !seen.add(id));
          });
          assert.deepEqual(duplicateIds, []);
          const chapterLinks = await diary
            .locator(".build-diary-chapters a")
            .evaluateAll((nodes) => nodes.map((a) => ({ hash: a.hash, target: Boolean(document.getElementById(a.hash.slice(1))) })));
          assert.ok(chapterLinks.length > 1 && chapterLinks.every((l) => l.target));
          const images = diary.locator("img");
          const imageStates = [];
          for (let i = 0; i < (await images.count()); i++) {
            const image = images.nth(i);
            await image.scrollIntoViewIfNeeded();
            await image.evaluate((n) => n.decode());
            imageStates.push(await image.evaluate((n) => ({ src: new URL(n.currentSrc).pathname, width: n.naturalWidth, height: n.naturalHeight })));
          }
          const slider = diary.locator('[data-diary-compare="slider"]').first();
          await slider.scrollIntoViewIfNeeded();
          if (javaScriptEnabled) {
            assert.ok((await slider.getAttribute("class")).includes("is-slider"));
            const range = slider.locator("input[type=range]");
            await range.focus();
            await range.press("Home");
            assert.equal(await range.getAttribute("aria-valuetext"), "All after");
            await range.press("End");
            assert.equal(await range.getAttribute("aria-valuetext"), "All before");
            assert.notEqual(await range.evaluate((n) => getComputedStyle(n).outlineStyle), "none");
            const frames = slider.locator(".build-diary-frames");
            const box = await frames.boundingBox();
            await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5, { steps: 5 });
            await page.mouse.up();
            assert.ok(Number(await range.inputValue()) >= 74 && Number(await range.inputValue()) <= 76);
          } else {
            assert.ok(!(await slider.getAttribute("class")).includes("is-slider"));
            assert.equal(await slider.locator("[data-diary-control]").isVisible(), false);
            for (const frame of await slider.locator(".build-diary-frame").all()) assert.equal(await frame.isVisible(), true);
          }
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          assert.ok(overflow <= 1, `Horizontal overflow ${overflow}`);
          await diary.locator(".build-diary-phase").first().scrollIntoViewIfNeeded();
          const screenshot = `${route}-${width}-${javaScriptEnabled ? "script" : "native"}.png`;
          await diary
            .locator(".build-diary-phase")
            .first()
            .screenshot({ path: path.join(output, screenshot), animations: "disabled" });
          assert.deepEqual(errors, []);
          report.states.push({ route, width, javaScriptEnabled, outline, chapterLinks, imageStates, overflow, errors, screenshot });
          await context.close();
        }
      }
    }
    await fs.writeFile(path.join(output, "browser-proof.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(`${report.states.length} diary states passed; report in ${output}`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
