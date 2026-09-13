// Reproducible local measurements; never presented as physical phone benchmarks.
// Run after Docker is serving: node bin/measure_coastal_home.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const os = require("node:os");

const base = process.env.VISUAL_BASE_URL || "http://127.0.0.1:8080";
const output = path.resolve(process.env.COASTAL_EVIDENCE_DIR || ".jekyll-cache/visual-qa/measurements");
fs.mkdirSync(output, { recursive: true });
const report = {
  capturedAt: new Date().toISOString(),
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  cpu: os.cpus()[0].model,
  method:
    "Serial headless Chromium, no CPU or network throttle. Three seconds of warmup and four seconds of live animation per style. Mobile is touch/viewport/DPR emulation on this computer, not a physical device. gzip estimates are separate from actual local HTTP transfer sizes.",
  views: [],
};
const styles = ["architectural", "realistic", "illustrated"];
let ownedBrowser;
const graphicsArgs = process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [];
report.graphicsArgs = graphicsArgs;
const evidence = (page) => page.locator("[data-home-desk-scene]").evaluate((e) => e.getSceneEvidence());

async function sample(page, ms = 4000) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const start = performance.now(),
          deltas = [];
        const frames = document.querySelector("[data-home-desk-scene]").getSceneEvidence().frames;
        let previous = start,
          raf;
        function tick(now) {
          deltas.push(now - previous);
          previous = now;
          raf = requestAnimationFrame(tick);
        }
        raf = requestAnimationFrame(tick);
        setTimeout(() => {
          cancelAnimationFrame(raf);
          const elapsed = performance.now() - start;
          deltas.sort((a, b) => a - b);
          const rendered = document.querySelector("[data-home-desk-scene]").getSceneEvidence().frames - frames;
          resolve({
            durationMs: Math.round(elapsed),
            renderedFrames: rendered,
            sceneFps: +((rendered * 1000) / elapsed).toFixed(1),
            rafP95Ms: +(deltas[Math.floor(deltas.length * 0.95)] || 0).toFixed(1),
          });
        }, duration);
      }),
    ms
  );
}

(async () => {
  const browser = (ownedBrowser = await chromium.launch({ args: graphicsArgs }));
  report.browser = browser.version();
  for (const dimensions of [
    { label: "desktop", viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 },
    { label: "emulated-mobile", viewport: { width: 390, height: 1000 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  ]) {
    const { label, ...options } = dimensions;
    const context = await browser.newContext(options);
    const page = await context.newPage();
    // Dev-only live reload can navigate midway through a measurement. No
    // production or visual asset is stubbed by this benchmark.
    await page.route("**/livereload.js*", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(base + "/?scene-lab=1", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const defaultMode = await page.locator("[data-home-artifact-stage]").getAttribute("data-desk-mode");
    const requestsBefore3D = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((r) => /home-scene|models\/home|three\.module/.test(r.name))
        .map((r) => r.name)
    );
    if (defaultMode !== "2d" || requestsBefore3D.length) throw new Error("The initial 2D page fetched the 3D scene.");
    const start = Date.now();
    await page.locator('[data-home-desk-mode="3d"]').click();
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]").dataset.sceneState === "ready");
    const readyMs = Date.now() - start;
    const initialResources = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((r) => /home-scene|models\/home|three\.module|three-r164/.test(r.name))
        .map((r) => ({ path: new URL(r.name).pathname, encodedBodySize: r.encodedBodySize, transferSize: r.transferSize }))
    );
    const canvas = page.locator("[data-home-desk-scene] canvas");
    const gpu = await canvas.evaluate((c) => {
      const gl = c.getContext("webgl2"),
        ext = gl.getExtension("WEBGL_debug_renderer_info");
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
    console.log(`${label}: ${gpu}; ready in ${readyMs} ms`);
    await page.locator(".home-world-explore > summary").click();
    await page.locator("[data-world-activity]").selectOption("work");
    const view = { label, ...options, defaultMode, requestsBefore3D, readyMs, gpu, initialResources, styles: [], errors };
    for (const style of styles) {
      await page.locator(`[data-world-style="${style}"]`).click();
      await canvas.scrollIntoViewIfNeeded();
      await page.waitForTimeout(3000);
      const timing = await sample(page);
      const state = await evidence(page);
      view.styles.push({ style, ...timing, state });
      console.log(`${label} ${style}: ${timing.sceneFps} fps; ${state.drawCalls} calls; ${state.triangles} triangles`);
      await canvas.screenshot({ path: path.join(output, `${label}-${style}-live.png`) });
    }
    report.views.push(view);
    fs.writeFileSync(path.join(output, "performance.json"), JSON.stringify(report, null, 2) + "\n");
    // Comparable composed study, onsen, and exterior views, using the same actor.
    if (label === "desktop") {
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const activity of ["work", "soak"]) {
        await page.locator("[data-world-activity]").selectOption(activity);
        for (const style of styles) {
          await page.locator(`[data-world-style="${style}"]`).click();
          await canvas.scrollIntoViewIfNeeded();
          await page.waitForTimeout(250);
          await canvas.screenshot({ path: path.join(output, `${activity}-${style}.png`) });
        }
      }
      await page.locator('[data-world-room="outside"]').click();
      for (const style of styles) {
        await page.locator(`[data-world-style="${style}"]`).click();
        await canvas.scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
        await canvas.screenshot({ path: path.join(output, `outside-${style}.png`) });
      }
    }
    await context.close();
  }
  await browser.close();
  const manifest = JSON.parse(fs.readFileSync("assets/models/home/manifest.json", "utf8"));
  const files = [
    "assets/js/three.module.min.js",
    ...fs
      .readdirSync("assets/js/home-scene")
      .filter((n) => n.endsWith(".mjs"))
      .map((n) => `assets/js/home-scene/${n}`),
    "assets/js/vendor/three-r164/loaders/GLTFLoader.js",
    "assets/js/vendor/three-r164/utils/BufferGeometryUtils.js",
    "assets/models/home/manifest.json",
    ...fs
      .readdirSync("assets/models/home")
      .filter((n) => n.endsWith(".glb"))
      .map((n) => `assets/models/home/${n}`),
    ...manifest.avatars.map((a) => `assets/models/home/${a.portrait}`),
  ];
  report.assets = files.map((file) => {
    const data = fs.readFileSync(file);
    return { file, bytes: data.length, gzipBytes: zlib.gzipSync(data).length };
  });
  const size = (file) => report.assets.find((a) => a.file === file).gzipBytes;
  report.largestInitialSceneGzipBytes =
    report.assets.filter((a) => !a.file.endsWith(".glb") && !a.file.endsWith(".png")).reduce((sum, a) => sum + a.gzipBytes, 0) +
    size(`assets/models/home/${manifest.shell}`) +
    size(`assets/models/home/${manifest.coast}`) +
    Math.max(...manifest.rooms.map((r) => size(`assets/models/home/${r.file}`))) +
    Math.max(...manifest.avatars.map((a) => size(`assets/models/home/${a.file}`) + size(`assets/models/home/${a.portrait}`)));
  fs.writeFileSync(path.join(output, "performance.json"), JSON.stringify(report, null, 2) + "\n");
})().catch(async (error) => {
  console.error(error);
  await ownedBrowser?.close();
  process.exitCode = 1;
});
