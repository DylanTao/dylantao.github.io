const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { test, expect } = require("@playwright/test");
const { PNG } = require("pngjs");
const { preparePage, collectRuntimeErrors, screenshotMetrics } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const root = path.resolve(__dirname, "../..");
const readyTimeout = process.platform === "linux" || process.env.VISUAL_TRANSPORT_SOFTWARE === "1" ? 120000 : 90000;
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])])
        )
      : value;
const drawingDigest = (value) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");

const sketchState = (scene) =>
  scene.evaluate((host) => {
    const sketch = host.querySelector(".home-world-sketch");
    return sketch
      ? {
          drawing: sketch.dataset.sketchDrawing,
          allowed: Number(sketch.dataset.sketchAllowed),
          drawn: Number(sketch.dataset.sketchDrawn),
          strokes: Number(sketch.dataset.sketchStrokes),
          pending: sketch.dataset.sketchPending,
          stage: host.dataset.loadingStage,
        }
      : null;
  });

const bitmapState = async (sketch) => {
  const state = await sketch.evaluate((canvas) => {
    const context = canvas.getContext("2d"),
      pixels = context.getImageData(0, 0, canvas.width, canvas.height).data,
      rect = canvas.getBoundingClientRect(),
      style = getComputedStyle(canvas);
    return {
      pixels: Array.from(pixels),
      size: [canvas.width, canvas.height],
      rect: [rect.x, rect.y, rect.width, rect.height],
      transform: style.transform,
      opacity: style.opacity,
      filter: style.filter,
      paints: canvas.__paintJournal || [],
    };
  });
  const { pixels, ...placement } = state;
  return { ...placement, rgbaSha256: createHash("sha256").update(Buffer.from(pixels)).digest("hex") };
};

const rendererEvidence = (scene) =>
  scene.locator("canvas:not(.home-world-sketch)").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2"),
      extension = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      buffer: [canvas.width, canvas.height],
      css: [canvas.clientWidth, canvas.clientHeight],
      renderer: gl ? gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : null,
    };
  });

async function open(page, theme, { reduced = false } = {}) {
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await preparePage(page, theme);
  await page.clock.setFixedTime(new Date("2026-10-02T13:20:00-07:00"));
}

test("coastal loading drawing: complete geometric detail stays legible through the real frame handoff", async ({ page, context }, testInfo) => {
  // The fixture holds only the completed handoff for inspection. It never injects a stage or a
  // progress fill: every model, program and first frame must finish through the real controller.
  for (const [index, theme] of ["light", "dark"].entries()) {
    const current = index ? await context.newPage() : page,
      errors = collectRuntimeErrors(current);
    await open(current, theme);
    const original = fs.readFileSync(path.join(root, "assets/js/home-scene/loading-sketch.mjs"), "utf8"),
      signature = "export function createLoadingSketch(";
    expect(original).toContain(signature);
    const held =
      original.replace(signature, "function makeInspectionSketch(") +
      "\nexport function createLoadingSketch(...args) { const sketch = makeInspectionSketch(...args); if (sketch) { const finish = sketch.finish.bind(sketch); sketch.finish = () => { window.__releaseInspectedDrawing = finish; }; } return sketch; }\n";
    // Register after preparePage's network fixture, so it cannot bypass this inspection seam.
    await current.route("**/assets/js/home-scene/loading-sketch.mjs*", (route) => route.fulfill({ contentType: "text/javascript", body: held }));
    const requested = [];
    const responseWork = [],
      received = [];
    current.on("request", (request) => {
      const file = /\/models\/home\/(loading-sketch[^?]*)/.exec(request.url())?.[1];
      if (file) requested.push(file);
    });
    current.on("response", (response) => {
      const file = /\/models\/home\/(loading-sketch[^?]*)/.exec(response.url())?.[1];
      if (file) responseWork.push(response.json().then((drawing) => received.push({ file, digest: drawingDigest(drawing) })));
    });
    await current.goto(`${publicRouteUrl("/")}?cinematic=live`, { waitUntil: "domcontentloaded" });
    await current.locator('[data-home-desk-mode="3d"]').click();
    const scene = current.locator("[data-home-desk-scene]"),
      sketch = scene.locator(".home-world-sketch");
    await scene.scrollIntoViewIfNeeded();
    await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: readyTimeout });
    await expect
      .poll(
        async () => {
          const state = await sketchState(scene);
          return Boolean(state?.drawn === 1 && state.allowed === 1 && !state.pending);
        },
        { timeout: 20000 }
      )
      .toBe(true);
    const state = await sketchState(scene),
      evidence = await scene.evaluate((host) => host.getSceneEvidence()),
      backend = await rendererEvidence(scene);
    expect(state.drawing).toBe(evidence.currentRoom);
    expect(state.drawn).toBeLessThanOrEqual(state.allowed);
    expect(evidence.loading.firstFrameMilliseconds).toBeGreaterThan(0);
    expect(requested).toEqual(["loading-sketch.json", `loading-sketch/${evidence.currentRoom}.json`]);
    await Promise.all(responseWork);
    expect(received).toHaveLength(2);
    for (const drawing of received) {
      const authored = JSON.parse(fs.readFileSync(path.join(root, "assets/models/home", drawing.file), "utf8"));
      expect(drawing.digest, `${drawing.file}: the rendered route must use the authored drawing family`).toBe(drawingDigest(authored));
    }
    const pixels = PNG.sync.read(await sketch.screenshot());
    let foreground = 0;
    for (let p = 0; p < pixels.data.length; p += 4) {
      const value = 0.2126 * pixels.data[p] + 0.7152 * pixels.data[p + 1] + 0.0722 * pixels.data[p + 2];
      if (theme === "light" ? value < 170 : value > 170) foreground++;
    }
    const coverage = foreground / (pixels.width * pixels.height);
    expect(coverage, "the final pen drawing is visibly populated").toBeGreaterThan(0.005);
    expect(coverage, "fine form lines preserve open paper around the structure").toBeLessThan(0.35);
    await current.locator(".home-hero-media").screenshot({ path: testInfo.outputPath(`drawing-complete-${theme}.png`) });
    await current.evaluate(() => window.__releaseInspectedDrawing());
    await expect(sketch).toHaveCount(0, { timeout: 45000 });
    await expect.poll(() => scene.locator("canvas").evaluate((canvas) => getComputedStyle(canvas).opacity)).toBe("1");
    const frame = screenshotMetrics(await scene.locator("canvas").screenshot());
    expect(frame.uniqueColors, "the handoff exposes a complete nonblank WebGL frame").toBeGreaterThan(64);
    await scene.screenshot({ path: testInfo.outputPath(`drawing-handed-off-${theme}.png`) });
    fs.writeFileSync(
      testInfo.outputPath(`drawing-complete-${theme}.json`),
      JSON.stringify(
        {
          method: "Real completed progress and first frame; only overlay removal is held for inspection.",
          state,
          coverage,
          requested,
          received,
          backend,
          frame,
          stages: evidence.loading.stages,
          errors,
        },
        null,
        2
      )
    );
    expect(errors).toEqual([]);
    if (index === 0) await current.close();
  }
});

test("coastal loading drawing: reduced-motion page fallback stays still while unfinished work is held", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name));
  const errors = collectRuntimeErrors(page);
  await open(page, "light", { reduced: true });
  await page.addInitScript(() => {
    // Only the sketch's transfer capability is absent; compressed models still need Draco workers.
    delete HTMLCanvasElement.prototype.transferControlToOffscreen;
  });
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route("**/sirui-*.glb", async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  try {
    await page.goto(`${publicRouteUrl("/")}?cinematic=live`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const scene = page.locator("[data-home-desk-scene]"),
      sketch = scene.locator(".home-world-sketch");
    await scene.scrollIntoViewIfNeeded();
    const deadline = Date.now() + readyTimeout;
    let stage;
    do {
      stage = await scene.getAttribute("data-loading-stage");
      if (stage === "failed") throw new Error("The model pipeline failed while inspecting the page-side drawing fallback");
      if (stage === "room") break;
      await page.waitForTimeout(100);
    } while (Date.now() < deadline);
    expect(stage).toBe("room");
    await expect
      .poll(
        async () => {
          const state = await sketchState(scene),
            room = await scene.evaluate((host) => host.getSceneEvidence()?.loading?.progress?.room);
          return Boolean(state?.drawn > 0 && !state.pending && room === 1);
        },
        { timeout: readyTimeout }
      )
      .toBe(true);
    await page.waitForTimeout(600);
    await sketch.evaluate((canvas) => {
      const context = canvas.getContext("2d"),
        clear = context.clearRect;
      canvas.__paintJournal = [];
      context.clearRect = function (...args) {
        canvas.__paintJournal.push({ at: performance.now(), args, state: { ...canvas.dataset } });
        return clear.apply(this, args);
      };
    });
    // Acquire the canvas readback before comparing. On native Chromium the
    // first two immediate reads differed without any paint, resize or progress
    // change; later reads were identical. The original CI PNG difference was
    // only1–3 levels. Keep exact RGBA and PNG equality after acquisition, plus
    // unchanged placement and an empty paint journal; no tolerance is added.
    const initial = await bitmapState(sketch),
      repeated = await bitmapState(sketch);
    await sketch.screenshot({ path: testInfo.outputPath("drawing-reduced-page-fallback-prime.png") });
    const before = await bitmapState(sketch),
      state = await sketchState(scene);
    const beforePng = await sketch.screenshot({ path: testInfo.outputPath("drawing-reduced-page-fallback-before.png") });
    await page.waitForTimeout(700);
    const after = await bitmapState(sketch);
    const afterPng = await sketch.screenshot({ path: testInfo.outputPath("drawing-reduced-page-fallback.png") });
    fs.writeFileSync(
      testInfo.outputPath("bitmap-hold-diagnostic.json"),
      JSON.stringify({ initial, repeated, before, after, state, end: await sketchState(scene) }, null, 2)
    );
    expect(after).toEqual(before);
    expect(afterPng).toEqual(beforePng);
    expect(state.drawn).toBeLessThanOrEqual(state.allowed);
    release();
    await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: readyTimeout });
    await expect(sketch).toHaveCount(0);
    fs.writeFileSync(
      testInfo.outputPath("drawing-page-fallback.json"),
      JSON.stringify({ state, before, after, backend: await rendererEvidence(scene), errors }, null, 2)
    );
    expect(errors).toEqual([]);
  } finally {
    release();
  }
});
