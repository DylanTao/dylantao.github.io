// Controlled diagnostic: identical product geometry and arrival candidates,
// original full-mesh rays versus exact local triangle subsets, in one context.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const { collectRuntimeErrors } = require("../test/visual/helpers");

(async () => {
  const base = (process.env.VISUAL_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, ""),
    output = path.resolve(".jekyll-cache/visual-qa/inspection-query-benchmark"),
    original = "const region = createOcclusionRegion(occluders, arrivalBounds.expandByScalar(0.05));";
  let source = await fs.readFile("assets/js/home-scene/controller.mjs", "utf8");
  if (!source.includes(original)) throw new Error("Controlled query patch target missing");
  source = source.replace(
    original,
    `const region = globalThis.__inspectionFullMesh
      ? { objects: occluders, evidence: { query: "full original mesh" }, dispose() {} }
      : createOcclusionRegion(occluders, arrivalBounds.expandByScalar(0.05));`
  );
  const browser = await chromium.launch({ args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", timezoneId: "America/Los_Angeles" }),
      errors = collectRuntimeErrors(page);
    await page.route("**/controller.mjs", (route) => route.fulfill({ contentType: "application/javascript", body: source }));
    await page.route("**/livereload.js*", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.addInitScript(() => {
      const NativeDate = Date,
        fixedDate = NativeDate.parse("2026-10-02T13:20:00-07:00");
      globalThis.Date = new Proxy(NativeDate, {
        construct: (target, args, newTarget) => Reflect.construct(target, args.length ? args : [fixedDate], newTarget),
        apply: () => new NativeDate(fixedDate).toString(),
        get: (target, property, receiver) => (property === "now" ? () => fixedDate : Reflect.get(target, property, receiver)),
      });
    });
    await page.goto(`${base}/?scene-lab=1`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const scene = page.locator("[data-home-desk-scene]"),
      canvas = scene.locator("canvas");
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.()?.ecology?.wildlife?.modelsReady);
    await page.locator("[data-world-view]").click();
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence().roomCount === 6);
    const count = (await scene.evaluate((element) => element.getSceneEvidence())).neighbours.length,
      rows = [];
    // Warm selection and shader/room startup separately from measurement.
    for (let index = 0; index < count; index++) await canvas.press("n");
    for (let round = 0; round < 3; round++) {
      for (const mode of round % 2 ? ["local", "full"] : ["full", "local"]) {
        await canvas.press("Enter");
        await page.evaluate((value) => (globalThis.__inspectionFullMesh = value), mode === "full");
        for (let index = 0; index < count; index++) {
          await canvas.press("n");
          const view = await scene.evaluate((element) => element.getSceneEvidence());
          rows.push({ round, mode, id: view.inspection.id, camera: view.camera, target: view.target, arrival: view.inspection.arrival });
        }
      }
    }
    const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)],
      ids = [...new Set(rows.map((row) => row.id))],
      summary = ids.map((id) => {
        const samples = rows.filter((row) => row.id === id),
          full = samples.filter((row) => row.mode === "full"),
          local = samples.filter((row) => row.mode === "local");
        for (const sample of samples) {
          if (
            sample.arrival.rays !== full[0].arrival.rays ||
            sample.arrival.visibleFaceSamples !== full[0].arrival.visibleFaceSamples ||
            sample.arrival.visibleBody !== full[0].arrival.visibleBody
          )
            throw new Error(`Query paths changed arrival decisions for ${id}`);
        }
        return {
          id,
          fullMedianMs: median(full.map((row) => row.arrival.milliseconds)),
          localMedianMs: median(local.map((row) => row.arrival.milliseconds)),
          rays: full[0].arrival.rays,
        };
      });
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(
      path.join(output, "evidence.json"),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          browser: browser.version(),
          base,
          method:
            "One native Windows Chromium context; reduced-motion Date-only override; native performance.now/RAF. Three balanced rounds after warming all six rooms and17 selections. Only controller query-object choice is instrumented; identical product geometry, poses, candidates, finite rays, early exit and scoring. Timings include local subset construction/disposal. This isolates CPU arrival selection, not FPS or the entire prior implementation.",
          errors,
          summary,
          rows,
        },
        null,
        2
      ) + "\n"
    );
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(JSON.stringify({ output, selections: rows.length, summary }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
