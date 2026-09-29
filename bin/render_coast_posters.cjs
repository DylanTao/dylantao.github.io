// Render the actual runtime scene, including its camera, lighting and panorama.
// Usage: node bin/render_coast_posters.cjs http://127.0.0.1:4101/al-folio
// Requires the repository's Playwright Chromium and Python with Pillow.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const base = (process.argv[2] || "http://127.0.0.1:4101/al-folio").replace(/\/$/, "");
const root = path.resolve(__dirname, "..");
const scratch = path.join(root, ".jekyll-cache", "coast-posters");
const output = path.join(root, "assets", "models", "la-jolla", "posters");
const views = [
  { name: "coast", width: 5120, height: 800, posterFrameHeight: 440 },
  { name: "coast-mobile", width: 560, height: 560 },
  { name: "miniature", width: 1000, height: 1000, miniature: true },
];

(async () => {
  await fs.mkdir(scratch, { recursive: true });
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [] });
  try {
    for (const view of views) {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const route = `${base}/__coast-poster__`;
      await page.route(route, (request) =>
        request.fulfill({
          contentType: "text/html",
          body: `<!doctype html><html data-theme-mode="noon"><head><title>Coast poster renderer</title>
          <style>html,body,figure{margin:0;background:transparent} .footer-coast__scene{width:100vw;height:100vh}canvas{display:block}</style>
          </head><body><figure data-footer-coast ${view.miniature ? "data-miniature" : ""}>
          <div class="footer-coast__scene"><canvas></canvas></div></figure>
          <script type="module">import {mountCoast} from "${base}/assets/js/footer-coast/scene.mjs";
          await mountCoast(document.querySelector("figure"), ${JSON.stringify({ posterFrameHeight: view.posterFrameHeight })});</script></body></html>`,
        })
      );
      await page.goto(route);
      await page.waitForSelector('[data-state="ready"]', { timeout: 30000 });
      for (const theme of ["morning", "noon", "afternoon", "evening"]) {
        await page.evaluate((value) => {
          document.documentElement.dataset.themeMode = value;
        }, theme);
        await page.waitForFunction((value) => document.querySelector("figure").dataset.theme === value, theme);
        const file = `${view.name}-${theme}`;
        const png = path.join(scratch, `${file}.png`);
        await page.locator("canvas").screenshot({ path: png, omitBackground: true });
        execFileSync("python", [
          "-c",
          "from PIL import Image; import sys; Image.open(sys.argv[1]).save(sys.argv[2], 'WEBP', quality=88, method=6)",
          png,
          path.join(output, `${file}.webp`),
        ]);
        console.log(`${file}.webp`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
