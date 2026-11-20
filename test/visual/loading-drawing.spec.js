const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { test, expect } = require("@playwright/test");
const { PNG } = require("pngjs");
const { preparePage, collectRuntimeErrors, screenshotMetrics } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const { pauseSceneClock } = require("./scene-clock");
const root = path.resolve(__dirname, "../..");
const software = process.platform === "linux" || process.env.VISUAL_TRANSPORT_SOFTWARE === "1";
const readyTimeout = software ? 120000 : 90000;
const handoffTimeout = 45000;
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

const sketchState = (scene, { includeScene = false } = {}) =>
  scene.evaluate((host, includeScene) => {
    const sketch = host.querySelector(".home-world-sketch");
    const state = sketch
      ? {
          drawing: sketch.dataset.sketchDrawing,
          allowed: Number(sketch.dataset.sketchAllowed),
          drawn: Number(sketch.dataset.sketchDrawn),
          strokes: Number(sketch.dataset.sketchStrokes),
          pending: sketch.dataset.sketchPending,
          stage: host.dataset.loadingStage,
        }
      : null;
    if (!includeScene) return state;
    const canvas = host.querySelector("canvas:not(.home-world-sketch)");
    const gl = canvas.getContext("webgl2"),
      extension = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      state,
      evidence: host.getSceneEvidence(),
      backend: {
        buffer: [canvas.width, canvas.height],
        css: [canvas.clientWidth, canvas.clientHeight],
        renderer: gl ? gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : null,
      },
    };
  }, includeScene);

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

async function captureDrawingPixels(page, scene, sample, artifact, path) {
  const { sampleBox, artifactBox, viewport } = await scene.evaluate(
    (host, selectors) => {
      const select = (selector) => host.closest(selector) || host.querySelector(selector);
      const target = select(selectors.artifact);
      target.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      const boundsFor = (element) => {
        const bounds = element.getBoundingClientRect();
        // Match Playwright's enclosing pixel rectangle in viewport coordinates.
        return {
          left: Math.floor(bounds.left + 0.001),
          top: Math.floor(bounds.top + 0.001),
          right: Math.ceil(bounds.right - 0.001),
          bottom: Math.ceil(bounds.bottom - 0.001),
        };
      };
      return {
        sampleBox: boundsFor(select(selectors.sample)),
        artifactBox: boundsFor(target),
        viewport: { width: window.innerWidth, height: window.innerHeight },
      };
    },
    { sample, artifact }
  );
  const { left: x, top: y, right, bottom } = artifactBox;
  const width = right - x,
    height = bottom - y;
  const sampleWidth = sampleBox.right - sampleBox.left,
    sampleHeight = sampleBox.bottom - sampleBox.top;
  expect(sampleWidth).toBeGreaterThan(0);
  expect(sampleHeight).toBeGreaterThan(0);
  expect(
    sampleBox.left >= x && sampleBox.top >= y && sampleBox.right <= right && sampleBox.bottom <= bottom,
    "the measured pixels are fully inside the visible artifact"
  ).toBe(true);
  // Measure a crop of the same real composite that is saved as the artifact.
  expect(
    x >= 0 && y >= 0 && right <= viewport.width && bottom <= viewport.height,
    "the whole artifact fits in the visible viewport after centering"
  ).toBe(true);
  const png = await page.screenshot({ fullPage: false, scale: "css", clip: { x, y, width, height } });
  const photo = PNG.sync.read(png);
  expect([photo.width, photo.height]).toEqual([width, height]);
  const cropped = new PNG({ width: sampleWidth, height: sampleHeight });
  PNG.bitblt(photo, cropped, sampleBox.left - x, sampleBox.top - y, sampleWidth, sampleHeight, 0, 0);
  fs.writeFileSync(path, png);
  return cropped;
}

async function open(page, theme, { reduced = false } = {}) {
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await preparePage(page, theme);
  await page.clock.setFixedTime(new Date("2026-10-02T13:20:00-07:00"));
}

test("coastal loading drawing: complete geometric detail stays legible through the real frame handoff", async ({ page, context }, testInfo) => {
  // Allow the full load and handoff for each visit plus 30 seconds for capture and teardown.
  if (software) test.setTimeout(2 * (readyTimeout + handoffTimeout + 30000));
  if (software) {
    testInfo.annotations.push({
      type: "functional clock",
      description: "Both visits load live. Software inspection holds the completed scene while the browser runs the real CSS fade.",
    });
  }
  // The fixture keeps the completed drawing for inspection.
  // Every model, program and first frame finishes through the real controller.
  for (const [index, theme] of ["light", "dark"].entries()) {
    const current = index ? await context.newPage() : page,
      errors = collectRuntimeErrors(current);
    // Playwright's clock belongs to the context. Resume it on the blank
    // return tab before any viewer code is loaded.
    if (software && index > 0) await current.clock.resume();
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
    const scene = current.locator("[data-home-desk-scene]");
    await scene.scrollIntoViewIfNeeded();
    const completePen = current.locator('.home-world-sketch[data-sketch-drawn="1"][data-sketch-allowed="1"][data-sketch-pending=""]');
    // A single browser-side wait observes both ready states when later renderer calls are delayed.
    await expect(scene.filter({ has: completePen })).toHaveAttribute("data-scene-state", "ready", { timeout: readyTimeout });
    // Hold the already-rendered frame for software inspection. The real CSS
    // transition still advances in browser time and removes the drawing.
    if (software) await pauseSceneClock(current, { advanceDate: false });
    const { state, evidence, backend } = await sketchState(scene, { includeScene: true });
    // Both pages share the visitor's storage. The second visit opens with Sirui at his desk.
    const destination = index === 0 ? "entrance" : "study";
    expect(evidence.currentRoom).toBe(index === 0 ? "outside" : "study");
    if (index === 0) expect(evidence.walk.destination).toBe("entrance");
    expect(state.drawing).toBe(destination);
    expect(state.drawn).toBeLessThanOrEqual(state.allowed);
    expect(evidence.loading.firstFrameMilliseconds).toBeGreaterThan(0);
    expect(requested).toEqual(["loading-sketch.json", `loading-sketch/${destination}.json`]);
    await Promise.all(responseWork);
    expect(received).toHaveLength(2);
    for (const drawing of received) {
      const authored = JSON.parse(fs.readFileSync(path.join(root, "assets/models/home", drawing.file), "utf8"));
      expect(drawing.digest, `${drawing.file}: the rendered route must use the authored drawing family`).toBe(drawingDigest(authored));
    }
    const pixels = await captureDrawingPixels(
      current,
      scene,
      ".home-world-sketch",
      ".home-hero-media",
      testInfo.outputPath(`drawing-complete-${theme}.png`)
    );
    let foreground = 0;
    for (let p = 0; p < pixels.data.length; p += 4) {
      const value = 0.2126 * pixels.data[p] + 0.7152 * pixels.data[p + 1] + 0.0722 * pixels.data[p + 2];
      if (theme === "light" ? value < 170 : value > 170) foreground++;
    }
    const coverage = foreground / (pixels.width * pixels.height);
    expect(coverage, "the final pen drawing is visibly populated").toBeGreaterThan(0.005);
    expect(coverage, "fine form lines preserve open paper around the structure").toBeLessThan(0.35);
    await current.evaluate(() => window.__releaseInspectedDrawing());
    const revealed = scene.filter({ hasNot: current.locator(".home-world-sketch") }).locator("canvas");
    await expect(revealed).toHaveCSS("opacity", "1", { timeout: handoffTimeout });
    const revealedPixels = await captureDrawingPixels(
      current,
      scene,
      "canvas",
      "[data-home-desk-scene]",
      testInfo.outputPath(`drawing-handed-off-${theme}.png`)
    );
    const frame = screenshotMetrics(PNG.sync.write(revealedPixels));
    expect(frame.uniqueColors, "the handoff exposes a complete nonblank WebGL frame").toBeGreaterThan(64);
    fs.writeFileSync(
      testInfo.outputPath(`drawing-complete-${theme}.json`),
      JSON.stringify(
        {
          method: software
            ? "Real load and first frame. Software inspection holds the completed scene while the browser runs the CSS fade."
            : "Real load and first frame. The completed drawing is held for inspection.",
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
    const { backend } = await sketchState(scene, { includeScene: true });
    fs.writeFileSync(testInfo.outputPath("drawing-page-fallback.json"), JSON.stringify({ state, before, after, backend, errors }, null, 2));
    expect(errors).toEqual([]);
  } finally {
    release();
  }
});
