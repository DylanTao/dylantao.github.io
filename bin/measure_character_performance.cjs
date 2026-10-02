// Same product scene, stable authored clock, serial desktop/phone emulation.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const { collectRuntimeErrors } = require("../test/visual/helpers");

(async () => {
  const label = process.argv[2] || "current";
  const baseURL = (process.env.VISUAL_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
  const output = path.resolve(process.env.CHARACTER_EVIDENCE_DIR || `.jekyll-cache/visual-qa/characters-${label}`);
  await fs.mkdir(output, { recursive: true });
  const report = {
    capturedAt: new Date().toISOString(),
    label,
    method:
      "Serial headless Chromium with ANGLE D3D11 on Windows, native randomness/performance clock/RAF, Date-only override at 13:20 Pacific, 2-second warmup and 4-second live sample per view. No CPU/network throttling. Phone is 390px touch/viewport emulation on the same GPU, not a physical-phone benchmark. Only development livereload is blocked; product assets are unchanged. Background authoring may affect these local observations.",
    views: [],
  };
  const browser = await chromium.launch({
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  try {
    report.browser = browser.version();
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        deviceScaleFactor: 1,
        hasTouch: width === 390,
        isMobile: width === 390,
        timezoneId: "America/Los_Angeles",
      });
      const page = await context.newPage();
      const errors = collectRuntimeErrors(page);
      await page.route("**/livereload.js*", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
      await page.addInitScript(() => {
        // Playwright Clock also supplies its own animation scheduling. For FPS,
        // freeze only the routine's calendar date and retain native RAF timing.
        const NativeDate = Date;
        const fixedDate = NativeDate.parse("2026-10-02T13:20:00-07:00");
        globalThis.Date = new Proxy(NativeDate, {
          construct: (target, args, newTarget) => Reflect.construct(target, args.length ? args : [fixedDate], newTarget),
          apply: () => new NativeDate(fixedDate).toString(),
          get: (target, property, receiver) => (property === "now" ? () => fixedDate : Reflect.get(target, property, receiver)),
        });
        sessionStorage.setItem("theme", "noon");
        sessionStorage.setItem("theme-manual", "true");
      });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto(`${baseURL}/?scene-lab=1`, { waitUntil: "domcontentloaded" });
      await page.locator('[data-home-desk-mode="3d"]').click();
      const scene = page.locator("[data-home-desk-scene]");
      await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready");
      const controls = page.locator("[data-home-world-controls]");
      await controls.locator("[data-world-lab]>summary").click();
      await controls.locator("[data-world-avatar]").selectOption("ghibli");
      await controls.locator("[data-world-activity]").selectOption("work");
      await scene.scrollIntoViewIfNeeded();
      for (const room of ["study", "outside", "raccoon-0", "balcony-gull-0"]) {
        if (room === "study" || room === "outside") {
          await controls.locator(`[data-world-room="${room}"]`).first().click();
        } else {
          const canvas = scene.locator("canvas");
          for (let index = 0; index < 17; index++) {
            await canvas.press("n");
            if ((await scene.evaluate((element) => element.getSceneEvidence())).inspection?.id === room) break;
          }
          if ((await scene.evaluate((element) => element.getSceneEvidence())).inspection?.id !== room) throw new Error(`Missing ${room} inspection`);
        }
        // Clicking the authoring controls can scroll a mobile canvas offscreen.
        // Sample the actual visible animation, not its offscreen suspension.
        await scene.scrollIntoViewIfNeeded();
        await page.waitForTimeout(2000);
        const before = await scene.evaluate((element) => element.getSceneEvidence());
        const started = performance.now();
        await page.waitForTimeout(4000);
        const durationMs = performance.now() - started;
        const after = await scene.evaluate((element) => element.getSceneEvidence());
        report.views.push({
          width,
          room,
          durationMs: Math.round(durationMs),
          renderedFrames: after.frames - before.frames,
          sceneFps: +(((after.frames - before.frames) * 1000) / durationMs).toFixed(1),
          timing: after.frameTiming,
          drawCalls: after.drawCalls,
          triangles: after.triangles,
          resources: after.resources,
          character: after.characterPerformance || null,
          companion: after.companion,
          ecology: after.ecology,
          inspection: after.inspection,
          rendering: after.rendering,
          errors: [...errors],
        });
        await scene.screenshot({ path: path.join(output, `${width}-${room}.png`) });
      }
      await context.close();
    }
    await fs.writeFile(path.join(output, "performance.json"), JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify({
        output,
        views: report.views.map(({ width, room, sceneFps, timing, drawCalls, errors }) => ({ width, room, sceneFps, timing, drawCalls, errors })),
      })
    );
    if (report.views.some((view) => view.errors.length)) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
