// Actual served inspection views with native performance timing and static motion.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const { collectRuntimeErrors } = require("../test/visual/helpers");

(async () => {
  const label = process.argv[2] || "current",
    output = path.resolve(`.jekyll-cache/visual-qa/animal-inspections-${label}`),
    base = (process.env.VISUAL_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", timezoneId: "America/Los_Angeles" }),
      errors = collectRuntimeErrors(page);
    await page.route("**/livereload.js*", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.addInitScript(() => {
      const NativeDate = Date,
        fixedDate = NativeDate.parse("2026-10-02T13:20:00-07:00");
      globalThis.Date = new Proxy(NativeDate, {
        construct: (target, args, newTarget) => Reflect.construct(target, args.length ? args : [fixedDate], newTarget),
        apply: () => new NativeDate(fixedDate).toString(),
        get: (target, property, receiver) => (property === "now" ? () => fixedDate : Reflect.get(target, property, receiver)),
      });
      sessionStorage.setItem("theme", "noon");
      sessionStorage.setItem("theme-manual", "true");
    });
    await page.goto(`${base}/?scene-lab=1`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const scene = page.locator("[data-home-desk-scene]"),
      canvas = scene.locator("canvas");
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.()?.ecology?.wildlife?.modelsReady);
    await page.locator("[data-world-view]").click();
    await canvas.scrollIntoViewIfNeeded();
    const rows = [],
      count = (await scene.evaluate((element) => element.getSceneEvidence())).neighbours.length;
    for (let index = 0; index < count; index++) {
      const previousFrames = (await scene.evaluate((element) => element.getSceneEvidence())).frames;
      await canvas.press("n");
      await page.waitForFunction((frames) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().frames > frames, previousFrames);
      const view = await scene.evaluate((element) => element.getSceneEvidence());
      await canvas.evaluate((element) => element.blur());
      await canvas.screenshot({ path: path.join(output, `${view.inspection.id}.png`) });
      rows.push({ animal: view.inspection, camera: view.camera, target: view.target, orbit: view.cameraOrbit });
    }
    const report = {
      capturedAt: new Date().toISOString(),
      base,
      browser: browser.version(),
      method:
        "Actual served reduced-motion public arrivals, Date-only 13:20 Pacific override, native performance.now and RAF. All product assets retained; no hidden vegetation or image substitution. Per-selection times are local observations, not a controlled before/after benchmark.",
      errors,
      rows,
    };
    await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify(report, null, 2) + "\n");
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(JSON.stringify({ output, count, errors }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
