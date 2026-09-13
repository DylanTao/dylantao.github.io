// The lab must be served from the repo root, independently of Jekyll.
// Example: python -m http.server 4106 --bind 127.0.0.1
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const output = path.resolve(".jekyll-cache/visual-qa/splat-measurements");
fs.mkdirSync(output, { recursive: true });
let ownedBrowser;
const graphicsArgs = process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [];

(async () => {
  const browser = (ownedBrowser = await chromium.launch({ args: graphicsArgs }));
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(process.env.SPLAT_BASE_URL || "http://127.0.0.1:4106/artwork/coastal-home/splat-lab/");
  await page.waitForFunction(() => document.body.dataset.ready === "true", {}, { timeout: 60000 });
  const canvas = page.locator("#view canvas");
  const gpu = await canvas.evaluate((c) => {
    const gl = c.getContext("webgl2"),
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  const report = {
    capturedAt: new Date().toISOString(),
    graphicsArgs,
    browser: browser.version(),
    gpu,
    viewport: { width: 1280, height: 1000 },
    method:
      "Serial local headless Chromium, unthrottled. Three-second warmup, median of five one-second FPS readings at each of two viewpoints. Same generated alpha image and authored depth field in all modes.",
    modes: [],
    errors,
  };
  for (const mode of ["layers", "mesh", "splats"]) {
    await page.locator(`button[data-mode="${mode}"]`).click();
    await page.locator("#reset").click();
    for (const angle of ["original", "oblique"]) {
      if (angle === "oblique") {
        const box = await canvas.boundingBox();
        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.53, { steps: 14 });
        await page.mouse.up();
      }
      await page.waitForTimeout(3000);
      const samples = [];
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(1000);
        samples.push(await page.evaluate(() => window.getSplatEvidence().fps));
      }
      const state = await page.evaluate(() => window.getSplatEvidence());
      const medianFps = [...samples].sort((a, b) => a - b)[2];
      report.modes.push({ mode, angle, medianFps, samples, ...state });
      await canvas.screenshot({ path: path.join(output, `${mode}-${angle}.png`) });
      console.log(`${mode}, ${angle}: ${medianFps} fps`);
    }
  }
  fs.writeFileSync(path.join(output, "performance.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
})().catch(async (error) => {
  console.error(error);
  await ownedBrowser?.close();
  process.exitCode = 1;
});
