const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs/promises"),
  path = require("node:path");
const { preparePage, collectRuntimeErrors } = require(path.resolve("test/visual/helpers.js"));
(async () => {
  const out = path.resolve(".jekyll-cache/visual-qa/interior-integration-20261031/high-unclocked");
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  try {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1.5 });
    await preparePage(page, "light");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.setFixedTime(new Date("2026-10-23T14:45:00-07:00"));
    const errors = collectRuntimeErrors(page),
      rows = [];
    await page.goto("http://127.0.0.1:4161/al-folio/?quality=high&resolution=fixed", { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const scene = page.locator("[data-home-desk-scene]"),
      canvas = scene.locator("canvas");
    const read = () => scene.evaluate((e) => e.getSceneEvidence());
    await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 180000 });
    await canvas.scrollIntoViewIfNeeded();
    await page.locator("[data-world-fullscreen]").click();
    await expect.poll(async () => (await read()).cameraCollision?.ready, { timeout: 90000 }).toBe(true);
    const backend = await canvas.evaluate((e) => {
      const gl = e.getContext("webgl2"),
        ext = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      };
    });
    expect(backend.buffer).toEqual([3840, 2160]);
    async function capture(id, png = false) {
      const evidence = await read();
      rows.push({ id, evidence });
      if (png) await canvas.screenshot({ path: path.join(out, id + ".png") });
      console.log(JSON.stringify({ id, look: evidence.freeLook, flags: evidence.cameraCollision?.cameraFlags }));
    }
    await capture("high-arrival", true);
    for (let i = 0; i < 12; i++) {
      await page.mouse.move(900, 650);
      await page.mouse.down();
      await page.mouse.move(1800, 650, { steps: 12 });
      await page.mouse.up();
      await capture("high-yaw-" + i, i === 11);
    }
    const fixed = (await read()).freeLook;
    expect(fixed).not.toBeNull();
    for (const [id, a, b] of [
      ["down", 300, 1200],
      ["up", 1200, 200],
      ["up-again", 1200, 200],
    ]) {
      await page.mouse.move(1280, a);
      await page.mouse.down();
      await page.mouse.move(1280, b, { steps: 16 });
      await page.mouse.up();
      await capture("high-" + id, true);
      expect((await read()).freeLook.position).toEqual(fixed.position);
      expect((await read()).cameraCollision.cameraFlags & 5).toBe(0);
    }
    await page.locator("[data-world-exit]").click();
    expect(errors).toEqual([]);
    await fs.writeFile(
      path.join(out, "receipt.json"),
      JSON.stringify(
        {
          scope:
            "Native actualNVIDIA/D3D11 high-tier3840x2160; publiccamera/UI inputs, no lab/camera/visibility injection. Functional and appearance evidence, not a timing benchmark.",
          backend,
          rows,
          errors,
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
