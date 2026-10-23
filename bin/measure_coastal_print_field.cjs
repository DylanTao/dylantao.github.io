/* Actual browser comparison of the trained weights and their original target. */
const { chromium, webkit } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { PNG } = require("pngjs");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "artwork/coastal-home/learned-print/browser");
const url = process.env.PRINT_FIELD_URL || "http://127.0.0.1:4162/artwork/coastal-home/learned-print/";
const median = (a) => [...a].sort((a, b) => a - b)[Math.floor(a.length / 2)];
(async () => {
  await fs.mkdir(out, { recursive: true });
  const runs = [];
  for (const [name, engine] of [
    ["chromium", chromium],
    ["webkit", webkit],
  ]) {
    const browser = await engine.launch({ headless: true, ...(name === "chromium" ? { args: ["--use-angle=d3d11"] } : {}) });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(url);
      await page.waitForFunction(() => window.printFieldStudy);
      const evidence = await page.evaluate(() => window.printFieldStudy.evidence());
      const rows = [];
      for (const view of ["whole", "cliff", "agave"]) {
        await page.evaluate((v) => window.printFieldStudy.setView(v), view);
        const images = {};
        for (const mode of ["image", "field"]) {
          await page.evaluate((m) => window.printFieldStudy.setMode(m), mode);
          images[mode] = await page.locator("canvas").screenshot({ path: path.join(out, `${name}-${view}-${mode}.png`) });
        }
        const a = PNG.sync.read(images.image),
          b = PNG.sync.read(images.field);
        let error = 0;
        for (let i = 0; i < a.data.length; i++) if (i % 4 !== 3) error += (a.data[i] - b.data[i]) ** 2;
        const mse = error / (a.width * a.height * 3 * 255 ** 2);
        const timing = await page.evaluate(() => window.printFieldStudy.benchmark(16));
        rows.push({
          view,
          resolution: [a.width, a.height],
          rgbCompositePsnrDb: -10 * Math.log10(mse),
          timing,
          medianSubmissionAndFinishMs: Object.fromEntries(
            ["image", "field"].map((mode) => [mode, median(timing.filter((r) => r.mode === mode).map((r) => r.submissionAndFinishMs))])
          ),
          medianGpuMs: Object.fromEntries(
            ["image", "field"].map((mode) => {
              const valid = timing.filter((r) => r.mode === mode && r.gpuMs !== null).map((r) => r.gpuMs);
              return [mode, valid.length ? median(valid) : null];
            })
          ),
        });
      }
      // Exact original UV centers at 1200x600, with coordinate-only held-out mask.
      const pixels = await page.evaluate(() => {
        const s = window.printFieldStudy;
        s.setView("whole");
        s.setMode("image");
        const a = Array.from(s.pixels());
        s.setMode("field");
        const b = Array.from(s.pixels());
        let testCount = 0,
          error = 0;
        for (let y = 0; y < 600; y++)
          for (let x = 0; x < 1200; x++) {
            const h = ((BigInt(x) * 73856093n) ^ (BigInt(y) * 19349663n) ^ 1701n) % 10n;
            if (h !== 0n) continue;
            const i = ((599 - y) * 1200 + x) * 4;
            for (let c = 0; c < 3; c++) error += (a[i + c] - b[i + c]) ** 2;
            testCount++;
          }
        return { testCount, compositeRgbPsnrDb: -10 * Math.log10(error / (testCount * 3 * 255 ** 2)) };
      });
      await page.evaluate(() => {
        window.printFieldStudy.setView("whole");
      });
      const canvas = page.locator("canvas");
      await canvas.focus();
      const before = await canvas.screenshot();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("+");
      const after = await canvas.screenshot();
      const interactionChanged = !before.equals(after);
      await page.getByRole("button", { name: "Reset", exact: true }).click();
      const reset = await page.evaluate(() => window.printFieldStudy.state());
      const responsive = [];
      for (const width of [1440, 1280, 768, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.screenshot({ path: path.join(out, `${name}-page-${width}.png`), fullPage: true });
        responsive.push(
          await page.evaluate(() => ({
            width: innerWidth,
            overflow: document.documentElement.scrollWidth > innerWidth,
            canvasWidth: document.querySelector("canvas").getBoundingClientRect().width,
            focusable: document.querySelector("canvas").tabIndex === 0,
          }))
        );
      }
      const requests = await page.evaluate(() =>
        performance.getEntriesByType("resource").map((r) => ({ name: r.name, decodedBodySize: r.decodedBodySize, transferSize: r.transferSize }))
      );
      const disposed = await page.evaluate(() => {
        const s = window.printFieldStudy;
        const released = s.dispose();
        s.draw();
        return { ...s.state(), ...released, glError: s.evidence().glError };
      });
      const checks = {
        noErrors: errors.length === 0,
        noOverflow: responsive.every((r) => !r.overflow),
        inputChangesPixels: interactionChanged,
        reset: reset.zoom === 1 && reset.center[0] === 0.5 && reset.center[1] === 0.5,
        heldOutCount: pixels.testCount === 71975,
        glClean: evidence.glError === 0 && disposed.glError === 0,
        disposed: disposed.disposed && disposed.texturesReleased && disposed.programReleased,
      };
      if (Object.values(checks).some((v) => !v)) throw new Error(JSON.stringify({ name, checks, errors }));
      runs.push({
        engine: name,
        version: browser.version(),
        evidence,
        rows,
        heldOut: pixels,
        responsive,
        requests,
        interaction: { changed: interactionChanged, reset },
        disposed,
        errors,
        checks,
      });
    } finally {
      await browser.close();
    }
  }
  const report = {
    schema_version: 1,
    sourceRevision: process.env.PRINT_FIELD_REVISION || "working-tree",
    url,
    measurement:
      "Serial ABBA path order; 8 warmup draws and 16 individual timer-query draws per block. GPU time is reported only for available, nondisjoint queries. CPU submission-plus-finish times can quantize to zero and do not establish equal GPU cost.",
    runs,
  };
  await fs.writeFile(path.join(out, "browser.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify(
      runs.map((r) => ({
        engine: r.engine,
        renderer: r.evidence.renderer,
        checks: r.checks,
        heldOut: r.heldOut,
        rows: r.rows.map((v) => ({ view: v.view, psnr: v.rgbCompositePsnrDb, submission: v.medianSubmissionAndFinishMs, gpu: v.medianGpuMs })),
      })),
      null,
      2
    )
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
