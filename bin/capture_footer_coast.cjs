#!/usr/bin/env node
// Captures the footer's coast (or the homepage miniature) from a running preview, for looking at
// the sea, its mirror and its reflections at any hour and width.
//
//   node bin/capture_footer_coast.cjs <out.png> [options]
//     --base=http://127.0.0.1:4101/al-folio   the preview to open
//     --route=cv/                             the page (no leading slash; "index.html" is the homepage)
//     --selector=[data-miniature]             a coast other than the footer's
//     --time=2026-11-13T21:00:00-08:00        the visitor's clock (the hour picks the sky and the lamps)
//     --width=390 --height=844 --density=3    the viewport and its device pixel ratio
//     --scheme=light|dark --wait=4000         the colour scheme; milliseconds to wait once ready
//     --served                                use the preview's own build of the footer's modules
//     --mirror=mirror.png                     also write the sea's mirror texture (clear sky in magenta)
//     --streak                                measure the studio window's streak (coast-streak.cjs)
//
// Unless --served is given, assets/js/footer-coast/*.mjs come from the working tree, so an edit to
// the sea's shader shows without a Jekyll rebuild (the preview does not watch). --mirror needs that.
// The studio light is on at noon and in the afternoon, and on two evenings in five (scene.mjs).
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const { streakOf } = require("../test/visual/coast-streak.cjs");

const root = path.resolve(__dirname, "..");
const [out, ...rest] = process.argv.slice(2);
const option = Object.fromEntries(
  rest.map((argument) => {
    const match = argument.match(/^--([^=]+)(?:=([\s\S]*))?$/);
    if (!match) throw new Error(`Unknown argument: ${argument}`);
    return [match[1], match[2] ?? true];
  })
);
if (!out || out.startsWith("--")) {
  console.error(
    "usage: node bin/capture_footer_coast.cjs <out.png> [--time=ISO] [--width=390] [--height=844] [--density=3] [--mirror=file] [--streak]"
  );
  process.exit(2);
}
const base = String(option.base || process.env.VISUAL_BASE_URL || "http://127.0.0.1:4101/al-folio").replace(/\/$/, "");
const selector = option.selector ? String(option.selector) : null;

(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  try {
    const context = await browser.newContext({
      viewport: { width: Number(option.width || 1440), height: Number(option.height || 900) },
      deviceScaleFactor: Number(option.density || 1),
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
      colorScheme: option.scheme === "dark" ? "dark" : "light",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message.slice(0, 300)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text().slice(0, 300)}`);
    });
    if (!option.served) {
      await page.route(/\/assets\/js\/footer-coast\/[^/?]+\.mjs(\?.*)?$/, async (route) => {
        const name = new URL(route.request().url()).pathname.split("/").pop();
        const file = path.join(root, "assets/js/footer-coast", name);
        if (!fs.existsSync(file)) return route.continue();
        let body = fs.readFileSync(file, "utf8");
        // A handle on the mirror for this tool alone; the file on disk is not touched.
        if (name === "water.mjs" && option.mirror) {
          const marker = 'target.texture.name = "CoastMirror";';
          if (!body.includes(marker)) throw new Error("water.mjs no longer names its mirror target; update this tool's marker.");
          body = body.replace(marker, `${marker} globalThis.__coastMirror = { target, renderer, THREE };`);
        }
        await route.fulfill({ status: 200, contentType: "text/javascript; charset=utf-8", body });
      });
    }
    if (option.time) await page.clock.setFixedTime(new Date(String(option.time)));
    await page.goto(`${base}/${option.route === undefined ? "cv/" : option.route}`, { waitUntil: "domcontentloaded" });
    const figure = selector ? page.locator(selector).first() : page.locator("[data-footer-coast]").last();
    await figure.scrollIntoViewIfNeeded();
    await page.waitForFunction(
      (selector) =>
        (selector ? document.querySelector(selector) : [...document.querySelectorAll("[data-footer-coast]")].pop())?.dataset.state === "ready",
      selector,
      { timeout: 120000 }
    );
    await page.waitForTimeout(Number(option.wait || 4000));
    const report = { out, errors };
    if (option.mirror) {
      if (option.served) throw new Error("--mirror reads the working tree's water.mjs; drop --served.");
      const dump = await page.evaluate(() => {
        const { target, renderer, THREE } = globalThis.__coastMirror;
        const { width, height } = target;
        const half = new Uint16Array(width * height * 4);
        renderer.readRenderTargetPixels(target, 0, 0, width, height, half);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d"),
          image = context.createImageData(width, height);
        let peak = 0;
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4,
              o = ((height - 1 - y) * width + x) * 4;
            const alpha = THREE.DataUtils.fromHalfFloat(half[i + 3]);
            for (let k = 0; k < 3; k++) {
              const value = THREE.DataUtils.fromHalfFloat(half[i + k]);
              peak = Math.max(peak, value);
              // Clear sky (alpha 0) shows magenta; the sea's shader fills it with the hour's sky.
              image.data[o + k] = 255 * Math.min(1, Math.max(0, value + (k === 1 ? 0 : 0.35) * (1 - alpha))) ** (1 / 2.2);
            }
            image.data[o + 3] = 255;
          }
        context.putImageData(image, 0, 0);
        return { width, height, peak, url: canvas.toDataURL("image/png") };
      });
      fs.writeFileSync(String(option.mirror), Buffer.from(dump.url.split(",")[1], "base64"));
      report.mirror = { file: String(option.mirror), width: dump.width, height: dump.height, peak: dump.peak };
    }
    const evidence = await figure.evaluate((element) => element.getCoastEvidence?.({ projectLandmarks: true }) ?? null);
    report.theme = evidence?.theme ?? null;
    report.office = evidence?.office ?? null;
    report.reflection = evidence?.water?.reflection ?? null;
    await figure.screenshot({ path: out });
    if (option.streak) {
      const studio = evidence?.studioLight;
      if (!studio) throw new Error("This build's evidence has no studioLight; serve the working tree (omit --served) or rebuild the preview.");
      // The figure and its canvas share a box, so the canvas's fractions are the capture's.
      report.studioLight = studio;
      report.streak = streakOf(PNG.sync.read(fs.readFileSync(out)), studio.reflection);
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
