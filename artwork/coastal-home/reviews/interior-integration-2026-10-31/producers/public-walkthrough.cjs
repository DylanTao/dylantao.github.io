const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const pw = require(process.env.WALKTHROUGH_PW || "@playwright/test"),
  { expect } = pw;
const { preparePage, collectRuntimeErrors, screenshotMetrics } = require("../../../test/visual/helpers.js");
const q = __dirname,
  out = path.join(q, process.env.WALKTHROUGH_ENGINE === "webkit" ? "public-walkthrough-webkit" : "public-walkthrough"),
  rows = [];
const manifest = require("../../../assets/models/home/manifest.json");
const base = "http://127.0.0.1:4161/al-folio/";
const changed = ["study", "library", "library-upper", "gym"];
(async () => {
  await fs.mkdir(out, { recursive: true });
  const engine = process.env.WALKTHROUGH_ENGINE || "chromium";
  const browser = await pw[engine].launch(engine === "chromium" ? { args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] } : {});
  try {
    for (const width of engine === "webkit" ? [390] : [1440, 1280, 768, 390, 2560])
      for (const hour of ["12:00", "21:00"]) {
        if (width === 2560 && hour === "21:00") continue;
        const context = await browser.newContext({
          viewport: { width, height: width === 2560 ? 1440 : width === 1280 ? 800 : 1000 },
          deviceScaleFactor: width === 2560 ? 1.5 : 1,
          hasTouch: width === 390,
          isMobile: width === 390,
          reducedMotion: "reduce",
          timezoneId: "America/Los_Angeles",
        });
        const page = await context.newPage(),
          errors = collectRuntimeErrors(page);
        await preparePage(page, hour === "12:00" ? "light" : "dark");
        await page.clock.setFixedTime(new Date(`2026-10-23T${hour}:00-07:00`));
        await page.goto(base + "?quality=high&resolution=fixed", { waitUntil: "domcontentloaded" });
        await page.locator('[data-home-desk-mode="3d"]').click();
        const host = page.locator("[data-home-desk-scene]"),
          canvas = host.locator("canvas"),
          places = page.locator("[data-world-places]");
        const read = () => host.evaluate((e) => e.getSceneEvidence());
        await canvas.scrollIntoViewIfNeeded();
        await expect(host).toHaveAttribute("data-scene-state", "ready", { timeout: 180000 });
        async function select(room) {
          if (!(await places.evaluate((e) => e.open))) await places.locator("summary").click();
          await places.locator(`[data-world-destination="${room}"]`).click();
          if (room !== "entrance") await expect.poll(async () => (await read()).currentRoom).toBe(room);
          await expect(places).not.toHaveAttribute("open", "");
        }
        async function capture(room, layout) {
          const image = await canvas.screenshot();
          const metrics = screenshotMetrics(image);
          expect(metrics.uniqueColors).toBeGreaterThan(300);
          expect(metrics.luminanceVariance).toBeGreaterThan(20);
          const state = await read();
          expect(state.loading.lightCache?.state).toBe("restored");
          const backend = await canvas.evaluate((e) => {
            const gl = e.getContext("webgl2"),
              ext = gl.getExtension("WEBGL_debug_renderer_info");
            return {
              renderer: gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL || gl.RENDERER),
              buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
            };
          });
          const file = `${width}-${hour.replace(":", "")}-${layout}-${room}.png`;
          await fs.writeFile(path.join(out, file), image);
          rows.push({
            width,
            hour,
            room,
            layout,
            file,
            pngSha256: crypto.createHash("sha256").update(image).digest("hex"),
            metrics,
            backend,
            evidence: state,
            errors: [...errors],
          });
          await fs.writeFile(
            path.join(out, "receipt.json"),
            JSON.stringify(
              {
                engine,
                scope:
                  "Public Rooms selections, embed/fullscreen and one supported Walk start per layout profile; no lab, model/light/camera override. Backend recorded per capture; functional and appearance evidence, not a physical-phone or FPS benchmark.",
                rows,
              },
              null,
              2
            )
          );
          expect(errors).toEqual([]);
          console.log(
            JSON.stringify({ width, hour, room, layout, buffer: backend.buffer, colors: metrics.uniqueColors, cache: state.loading.lightCache })
          );
        }
        if (width !== 2560)
          for (const room of changed) {
            await select(room);
            await capture(room, "embed");
          }
        await page.locator("[data-world-fullscreen]").click();
        await expect(page.locator("[data-home-artifact-stage]")).toHaveClass(/is-world-immersive/);
        const rooms = width === 2560 ? [...manifest.rooms.map((r) => r.id), "overview", "outside", "entrance"] : changed;
        for (const room of rooms) {
          await select(room);
          await capture(room, "fullscreen");
        }
        if (width === 1440 || width === 390) {
          await select("library-upper");
          await page.locator("[data-world-walk]").click();
          await expect.poll(async () => (await read()).walk?.ready, { timeout: 120000 }).toBe(true);
          await expect.poll(async () => (await read()).walk?.active).toBe(true);
          await capture("library-upper", "walk");
          await page.locator("[data-world-walk]").click();
        }
        await page.locator("[data-world-exit]").click();
        await expect(page.locator("[data-home-artifact-stage]")).not.toHaveClass(/is-world-immersive/);
        expect(errors).toEqual([]);
        await context.close();
      }
  } finally {
    await browser.close();
  }
})().catch(async (error) => {
  await fs.writeFile(path.join(out, "failure.txt"), error.stack || String(error));
  console.error(error);
  process.exitCode = 1;
});
