// Local browser measurements, not a substitute for physical-device profiling.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  const results = [];
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: width === 390 ? 3 : 1 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("http://127.0.0.1:8080/?scene-lab=1", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(8500);
      const initial3D = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .filter((e) => /\.glb(?:\?|$)|three\.module/.test(e.name))
          .map((e) => e.name)
      );
      await page.locator('[data-home-desk-mode="3d"]').click();
      await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready");
      const ui = page.locator("[data-home-world-controls]");
      await ui.locator("summary").first().click();
      await ui.locator("[data-world-activity]").selectOption("work");
      const samples = [];
      for (const room of ["overview", "outside"]) {
        await ui.locator(`[data-world-room="${room}"]`).first().click();
        await page.locator("[data-home-desk-scene]").scrollIntoViewIfNeeded();
        await page.waitForTimeout(2500);
        samples.push(
          await page.evaluate(async (room) => {
            const host = document.querySelector("[data-home-desk-scene]");
            const before = host.getSceneEvidence();
            const start = performance.now();
            const intervals = [];
            let last = start;
            let lastFrame = before.frames;
            await new Promise((resolve) => {
              const sample = (now) => {
                const frames = host.getSceneEvidence().frames;
                if (frames !== lastFrame) {
                  intervals.push(now - last);
                  last = now;
                  lastFrame = frames;
                }
                if (now - start < 15000) requestAnimationFrame(sample);
                else resolve();
              };
              requestAnimationFrame(sample);
            });
            const after = host.getSceneEvidence();
            const ms = performance.now() - start;
            intervals.sort((a, b) => a - b);
            return {
              room,
              durationMs: ms,
              frames: after.frames - before.frames,
              framesPerSecond: ((after.frames - before.frames) * 1000) / ms,
              medianFrameIntervalMs: intervals[Math.floor(intervals.length * 0.5)],
              p95FrameIntervalMs: intervals[Math.floor(intervals.length * 0.95)],
              drawCalls: after.drawCalls,
              triangles: after.triangles,
              resources: after.resources,
              canvas: [after.canvasWidth, after.canvasHeight],
            };
          }, room)
        );
      }
      await page.locator("#connect").scrollIntoViewIfNeeded();
      await page.waitForTimeout(2500);
      const pausedBefore = await page.locator("[data-home-desk-scene]").evaluate((e) => e.getSceneEvidence().frames);
      await page.waitForTimeout(1500);
      const pausedAfter = await page.locator("[data-home-desk-scene]").evaluate((e) => e.getSceneEvidence().frames);
      const transfer = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .filter((e) => /\.glb(?:\?|$)/.test(e.name))
          .map((e) => ({
            asset: new URL(e.name).pathname,
            bytes: e.encodedBodySize,
            loadMs: e.duration,
          }))
      );
      results.push({
        width,
        emulatedMobile: width === 390,
        devicePixelRatio: width === 390 ? 3 : 1,
        initial3D,
        samples,
        offscreenFrameDelta: pausedAfter - pausedBefore,
        transfer,
        errors,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  const output = process.argv[2] || ".jekyll-cache/visual-qa/coastal-runtime.json";
  await fs.writeFile(
    output,
    JSON.stringify({ browser: "Chromium, headless", environment: "Local desktop GPU; mobile viewport/DPR emulation only", results }, null, 2) + "\n"
  );
  console.log(
    output,
    results.map(({ width, samples, offscreenFrameDelta, initial3D, errors }) => ({ width, samples, offscreenFrameDelta, initial3D, errors }))
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
