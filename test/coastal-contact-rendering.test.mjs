import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { chromium, webkit } from "@playwright/test";
const require = createRequire(import.meta.url),
  { PNG } = require("pngjs"),
  { preparePage, collectRuntimeErrors, screenshotMetrics } = require("./visual/helpers.js"),
  baseURL = process.env.COASTAL_BASE_URL?.replace(/\/$/, "");
let browser;
if (baseURL) {
  test.before(async () => {
    const engine = process.env.COASTAL_BROWSER === "webkit" ? webkit : chromium;
    browser = await engine.launch(
      engine === chromium && process.platform === "win32" ? { args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] } : {}
    );
  });
  test.after(async () => browser?.close());
}

function difference(a, b) {
  const x = PNG.sync.read(a),
    y = PNG.sync.read(b);
  assert.equal(x.width, y.width);
  assert.equal(x.height, y.height);
  let changed = 0,
    max = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    let pixel = 0;
    for (let c = 0; c < 3; c++) pixel = Math.max(pixel, Math.abs(x.data[i + c] - y.data[i + c]));
    max = Math.max(max, pixel);
    if (pixel > 2) changed++;
  }
  return { ratio: changed / (x.width * x.height), max };
}

test(
  "rendered horizon lighting changes ambient contacts and leaves direct-only radiance pixel-identical",
  { skip: !baseURL, timeout: 60000 },
  async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    try {
      const errors = collectRuntimeErrors(page);
      await page.goto(`${baseURL}/assets/js/home-scene/contact-lab.html`, { waitUntil: "domcontentloaded" });
      await page.locator('body[data-ready="true"]').waitFor();
      for (const condition of ["direct", "indirect"]) {
        await page.locator(`[data-lighting="${condition}"]`).click();
        const none = await page.locator('[data-view="none"] canvas').screenshot(),
          previous = await page.locator('[data-view="previous"] canvas').screenshot(),
          horizon = await page.locator('[data-view="horizon"] canvas').screenshot(),
          change = difference(none, horizon);
        assert.ok(screenshotMetrics(horizon).luminanceVariance > 100, "the proof must include a visibly rendered scene");
        if (condition === "direct") {
          assert.equal(change.max, 0, "contact lighting must not attenuate the direct term");
          assert.ok(difference(none, previous).ratio > 0.02, "the fixture must expose the old composite's direct-light defect");
        } else assert.ok(change.ratio > 0.01, "indirect contact shading must have an observable effect");
      }
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
);

test("the first interior-to-exterior reflection never uses main-camera contact uniforms", { skip: !baseURL, timeout: 90000 }, async (t) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "America/Los_Angeles" });
  try {
    const errors = collectRuntimeErrors(page);
    await preparePage(page, "light");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      const locations = new WeakMap(),
        prototype = WebGL2RenderingContext.prototype,
        getLocation = prototype.getUniformLocation;
      window.contactMirrorValues = [];
      prototype.getUniformLocation = function (program, name) {
        const location = getLocation.call(this, program, name);
        if (name === "contactEnabled" && location) locations.set(program, location);
        return location;
      };
      for (const name of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
        const draw = prototype[name];
        prototype[name] = function (...args) {
          const viewport = this.getParameter(this.VIEWPORT);
          if (viewport[2] === 384 && viewport[3] === 384 && this.getParameter(this.FRAMEBUFFER_BINDING)) {
            const program = this.getParameter(this.CURRENT_PROGRAM),
              location = locations.get(program);
            if (location) window.contactMirrorValues.push(this.getUniform(program, location));
          }
          return draw.apply(this, args);
        };
      }
    });
    await page.goto(`${baseURL}/?scene-lab=1`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const scene = page.locator("[data-home-desk-scene]"),
      ui = page.locator("[data-home-world-controls]");
    await scene.locator("canvas").waitFor();
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.().roomCount === 6);
    const details = ui.locator("details").first();
    if (!(await details.evaluate((element) => element.open))) await details.locator("summary").first().click();
    await ui.locator('[data-world-room="study"]').first().click();
    await scene.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      window.contactMirrorValues.length = 0;
    });
    await ui.locator('[data-world-room="outside"]').first().click();
    await page.waitForFunction(() => window.contactMirrorValues.length > 0);
    const values = await page.evaluate(() => window.contactMirrorValues);
    assert.ok(values.length > 10, "the actual reflection must draw physical room objects");
    assert.ok(
      values.every((value) => value === false || value === 0),
      "no reflected draw may consume the main-camera AO"
    );
    t.diagnostic(`Reflected physical draws checked: ${values.length}; contactEnabled values: ${[...new Set(values)].join(", ")}`);
    const state = await scene.evaluate((element) => element.getSceneEvidence());
    assert.equal(state.currentRoom, "outside");
    assert.equal(state.ecology.water.reflection.active, true);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test("a lost room WebGL context rebuilds one clean pipeline without stale contact targets", { skip: !baseURL, timeout: 90000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    const errors = collectRuntimeErrors(page);
    await preparePage(page, "light");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${baseURL}/?scene-lab=1`, { waitUntil: "domcontentloaded" });
    const toggle = page.locator('[data-home-desk-mode="3d"]'),
      scene = page.locator("[data-home-desk-scene]"),
      stage = page.locator("[data-home-artifact-stage]");
    await toggle.click();
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.().ready);
    await scene.scrollIntoViewIfNeeded();
    await scene.locator("canvas").evaluate((canvas) => {
      window.previousContactCanvas = canvas;
      const extension = canvas.getContext("webgl2").getExtension("WEBGL_lose_context");
      if (!extension) throw new Error("The renderer does not expose the context-loss test extension");
      extension.loseContext();
    });
    await page.waitForFunction(() => document.querySelector("[data-home-artifact-stage]")?.dataset.deskMode === "2d");
    assert.equal(await stage.getAttribute("data-desk-mode"), "2d");
    await toggle.click();
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.().ready);
    await scene.scrollIntoViewIfNeeded();
    assert.equal(await scene.locator("canvas").count(), 1);
    assert.equal(await page.evaluate(() => window.previousContactCanvas.isConnected), false);
    assert.equal(await scene.locator("canvas").evaluate((canvas) => canvas.getContext("webgl2").isContextLost()), false);
    const state = await scene.evaluate((element) => element.getSceneEvidence());
    assert.equal(state.rendering.method, "cosine-weighted horizons / indirect diffuse");
    assert.ok(screenshotMetrics(await scene.locator("canvas").screenshot()).luminanceVariance > 80);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
