const { chromium, webkit } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { PNG } = require("pngjs");
const root = path.resolve(__dirname, ".."),
  dir = path.join(root, "artwork/coastal-home/learned-object");
const median = (a) => [...a].sort((a, b) => a - b)[Math.floor(a.length / 2)];
(async () => {
  await fs.mkdir(path.join(dir, "browser"), { recursive: true });
  const runs = [];
  for (const [name, engine] of [
    ["chromium", chromium],
    ["webkit", webkit],
  ].filter(([name]) => (process.env.PRINT_FIELD_ENGINES || "chromium,webkit").split(",").includes(name))) {
    const browser = await engine.launch({ headless: true, ...(name === "chromium" ? { args: ["--use-angle=d3d11"] } : {}) });
    try {
      let page = await browser.newPage({ viewport: { width: 960, height: 820 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto("http://127.0.0.1:4162/artwork/coastal-home/learned-object/");
      await page.waitForFunction(() => window.objectFieldLab);
      const evidence = await page.evaluate(() => objectFieldLab.evidence());
      const dataset = JSON.parse(await fs.readFile(path.join(dir, "data/dataset.json"), "utf8"));
      const referenceRaw = await fs.readFile(path.join(dir, "python-reference.f32"));
      const reference = new Float32Array(referenceRaw.buffer, referenceRaw.byteOffset, referenceRaw.byteLength / 4);
      const heldOut = [];
      let parityMax = 0,
        paritySum = 0;
      for (const [index, v] of dataset.views.entries()) {
        if (v.split !== "test") continue;
        const result = await page.evaluate((v) => {
          objectFieldLab.setView(v.yaw, v.pitch, 256);
          objectFieldLab.setMode("gaussian");
          return Array.from(objectFieldLab.pixels());
        }, v);
        const target = await page.evaluate(() => {
          objectFieldLab.setMode("mesh");
          return Array.from(objectFieldLab.pixels());
        });
        let sum = 0;
        for (let p = 0; p < 65536; p++)
          for (let c = 0; c < 3; c++) {
            const diff = result[p * 4 + c] - target[p * 4 + c];
            sum += diff * diff;
            if (index === 1) {
              const delta = Math.abs(result[p * 4 + c] / 255 - reference[p * 3 + c]);
              parityMax = Math.max(parityMax, delta);
              paritySum += delta * delta;
            }
          }
        let fgError = 0,
          fgCount = 0;
        for (let p = 0; p < 65536; p++) {
          if (Math.max(...[0, 1, 2].map((c) => Math.abs(target[p * 4 + c] - [232, 228, 220][c]))) <= 0.04 * 255) continue;
          for (let c = 0; c < 3; c++) fgError += (result[p * 4 + c] - target[p * 4 + c]) ** 2;
          fgCount++;
        }
        heldOut.push({
          view: index,
          psnrDb: -10 * Math.log10(sum / (65536 * 3 * 255 ** 2)),
          foregroundPixels: fgCount,
          foregroundPsnrDb: -10 * Math.log10(fgError / (fgCount * 3 * 255 ** 2)),
        });
      }
      // Valid numeric readback does not establish composited visual presentation.
      // Keep those observations in separate documents and preserve either failure.
      await page.close();
      page = await browser.newPage({ viewport: { width: 960, height: 820 } });
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto("http://127.0.0.1:4162/artwork/coastal-home/learned-object/");
      await page.waitForFunction(() => window.objectFieldLab);
      const views = [];
      for (const [yaw, pitch] of [
        [30, 10],
        [150, 35],
        [270, 10],
      ]) {
        await page.evaluate((v) => objectFieldLab.setView(...v), [yaw, pitch, 256]);
        const modes = {};
        for (const modeof of ["mesh", "gaussian"]) {
          await page.evaluate((m) => objectFieldLab.setMode(m), modeof);
          const file = `${name}-${yaw}-${pitch}-${modeof}.png`;
          modes[modeof] = await page.locator("canvas").screenshot({ path: path.join(dir, "browser", file) });
        }
        const a = PNG.sync.read(modes.mesh),
          b = PNG.sync.read(modes.gaussian);
        let sum = 0;
        for (let i = 0; i < a.data.length; i++) if (i % 4 !== 3) sum += (a.data[i] - b.data[i]) ** 2;
        const timing = await page.evaluate(() => objectFieldLab.benchmark(12));
        views.push({
          yaw,
          pitch,
          resolution: [a.width, a.height],
          psnrDb: -10 * Math.log10(sum / (a.width * a.height * 3 * 255 ** 2)),
          timing,
          medianGpuMs: Object.fromEntries(
            ["mesh", "gaussian"].map((mode) => {
              const valid = timing.filter((r) => r.mode === mode && r.gpuMs !== null).map((r) => r.gpuMs);
              return [mode, valid.length ? median(valid) : null];
            })
          ),
        });
      }
      await page.evaluate(() => {
        objectFieldLab.setView(30, 10, 256);
        objectFieldLab.setMode("mesh");
      });
      const before = await page.locator("canvas").screenshot();
      await page.getByRole("button", { name: "Show trained Gaussians" }).click();
      const after = await page.locator("canvas").screenshot();
      const modeChangesPixels = !before.equals(after);
      await page.getByRole("button", { name: "Next held-out view" }).click();
      const next = await page.locator("canvas").screenshot();
      const viewChangesPixels = !after.equals(next);
      await page.setViewportSize({ width: 390, height: 820 });
      await page.screenshot({ path: path.join(dir, "browser", `${name}-phone.png`), fullPage: true });
      const phone = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        canvasWidth: document.querySelector("canvas").getBoundingClientRect().width,
      }));
      const reprojectionMs = await page.evaluate(() => objectFieldLab.reprojection());
      const disposed = await page.evaluate(() => objectFieldLab.dispose());
      const checks = {
        noErrors: !errors.length,
        modeChangesPixels,
        viewChangesPixels,
        noPhoneOverflow: !phone.overflow,
        parityWithinTwoLevels: parityMax <= 2 / 255,
        disposed:
          disposed.disposed &&
          disposed.removed &&
          disposed.after.geometries === disposed.before.geometries - 2 &&
          disposed.after.textures === disposed.before.textures - 1,
      };
      runs.push({
        engine: name,
        version: browser.version(),
        evidence,
        heldOut,
        pythonParity: { maxAbsError: parityMax, rmse: Math.sqrt(paritySum / (65536 * 3)), referenceView: 1 },
        views,
        phone,
        reprojectionMs,
        disposed,
        errors,
        checks,
      });
      if (Object.values(checks).some((x) => !x)) process.exitCode = 1;
    } finally {
      await browser.close();
    }
  }
  await fs.writeFile(
    path.join(dir, "browser/browser.json"),
    JSON.stringify(
      {
        schema_version: 1,
        measurement:
          "Serial ABBA renderer paths; 8 warmup draws, 12 GPU timer queries per block. Null GPU times mean the extension was unavailable, not zero cost.",
        runs,
      },
      null,
      2
    ) + "\n"
  );
  console.log(
    JSON.stringify(
      runs.map((r) => ({
        engine: r.engine,
        evidence: r.evidence,
        parity: r.pythonParity,
        checks: r.checks,
        heldOutMeanPsnr: r.heldOut.reduce((s, v) => s + v.psnrDb, 0) / r.heldOut.length,
        views: r.views.map((v) => ({ yaw: v.yaw, pitch: v.pitch, psnr: v.psnrDb, gpu: v.medianGpuMs })),
      })),
      null,
      2
    )
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
