const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const dependencyRepo = process.env.DEPENDENCY_REPO || process.cwd();
const { chromium } = require(path.join(dependencyRepo, "node_modules/playwright"));
const { preparePage, collectRuntimeErrors } = require(path.join(dependencyRepo, "test/visual/helpers.js"));
const source = process.cwd();
const preview = process.env.PREVIEW_DIR || path.join(dependencyRepo, ".jekyll-cache/sirui-focus-preview");
const out = process.env.COLLAR_OUT || path.join(source, ".jekyll-cache/neck-cap/real-house");
const modules = ["walk-presence.mjs", "walk-collar-liner.mjs"];
const live = Boolean(process.env.BASE_URL);
const base = (process.env.BASE_URL || "http://127.0.0.1:4191/al-folio/").replace(/\/?$/, "/");
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const types = {
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};
let server;
async function startServer() {
  if (live) return;
  server = http.createServer(async (req, res) => {
    try {
      let name = decodeURIComponent(new URL(req.url, base).pathname);
      if (!name.startsWith("/al-folio/")) throw Error("baseurl");
      name = name.slice("/al-folio/".length);
      const module = modules.find((m) => name === `assets/js/home-scene/${m}`);
      let file = module ? path.join(source, "assets/js/home-scene", module) : path.resolve(preview, name || "index.html");
      if (!module && !file.startsWith(path.resolve(preview) + path.sep)) throw Error("path");
      if ((await fs.stat(file)).isDirectory()) file = path.join(file, "index.html");
      const bytes = await fs.readFile(file);
      res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve, reject) => server.once("error", reject).listen(4191, "127.0.0.1", resolve));
}
const report = {
  scope:
    "Complete production house, native RAF/real animation clock, full assets/quality. Lab placement stages valid capsule poses; this is collar/material/mode recovery evidence, not an entrance route or physical-phone performance claim.",
  base,
  overlays: live ? [] : modules,
  sourceHashes: {},
  loadedHashes: {},
  states: {},
  errors: [],
  passed: false,
};
async function runViewport(browser, id, viewport, touch) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const browserModules = [];
  page.on("response", (response) => {
    const name = modules.find((module) => new URL(response.url()).pathname.endsWith(`/assets/js/home-scene/${module}`));
    if (name) browserModules.push(response.body().then((bytes) => ({ name, url: response.url(), sha256: sha(bytes), bytes: bytes.length })));
  });
  page.setDefaultTimeout(120000);
  const errors = collectRuntimeErrors(page);
  const receipts = (report.states[id] = { viewport, hasTouch: touch, steps: [], errors });
  const scene = page.locator("[data-home-desk-scene]");
  const state = () => scene.evaluate((e) => e.getSceneEvidence());
  const save = async (label) => {
    const value = await state();
    const draw = await page.evaluate(() => window.__collarCamera);
    receipts.steps.push({ label, state: value, draw });
    await page.screenshot({ path: path.join(out, `${id}-${label}.png`) });
    console.log(id, label, value.frames, draw?.forward);
    return value;
  };
  const wait = async (predicate) => page.waitForFunction(predicate, null, { timeout: 120000 });
  const frame = async (action) => {
    const before = (await state()).frames;
    await action();
    await page.waitForFunction((n) => (document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.()?.frames || 0) > n, before, {
      timeout: 120000,
    });
  };
  const check = (s) => {
    assert.equal(s.walkPresence.collarFailure, null);
    assert.ok(s.walkPresence.collarLiner);
    assert.equal(s.walkPresence.skeletons, 1);
    assert.equal(s.walkPresence.sourceHidden, s.walk.active);
    assert.equal(s.walkPresence.active, s.walk.active);
    assert.equal(s.walkPresence.collarLiner.perFrameCuts, 0);
  };
  async function chooseAvatar(value) {
    await frame(() => page.locator("[data-world-avatar]").selectOption(value));
    await page.waitForFunction(
      (id) => {
        const e = document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.();
        return e?.avatarId === id && e?.walkPresence?.prepared && !document.querySelector("[data-home-world-controls]")?.hasAttribute("aria-busy");
      },
      value,
      { timeout: 120000 }
    );
    check(await state());
  }
  try {
    await preparePage(page, "light");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(base + "?scene-lab=1", { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    await wait(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready");
    await wait(() => !document.querySelector("[data-home-world-controls]").hasAttribute("aria-busy"));
    receipts.browserModules = await Promise.all(browserModules);
    for (const name of modules) {
      const observed = receipts.browserModules.filter((module) => module.name === name);
      assert.ok(observed.length, `${name}: the browser received the module`);
      for (const module of observed) assert.equal(module.sha256, report.sourceHashes[name], `${name}: actual browser bytes match source`);
    }
    receipts.graphics = await scene.locator("canvas").evaluate((canvas) => {
      const gl = canvas.getContext("webgl2"),
        debug = gl.getExtension("WEBGL_debug_renderer_info");
      return { renderer: gl.getParameter(debug.UNMASKED_RENDERER_WEBGL), vendor: gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) };
    });
    console.log(id, "ready", receipts.graphics.renderer);
    await scene.evaluate((element) => {
      const scene = element.labScene.scene,
        original = scene.onBeforeRender,
        after = scene.onAfterRender;
      scene.onBeforeRender = function (renderer, world, camera, ...args) {
        original?.call(this, renderer, world, camera, ...args);
        const body = scene.getObjectByName("walking-Sirui"),
          liner = body?.getObjectByName("primary-collar-liner");
        if (!liner?.visible) return;
        const ce = camera.matrixWorld.elements,
          forward = { x: -ce[8], y: -ce[9], z: -ce[10] };
        window.__collarCamera = { position: camera.position.toArray(), forward: [forward.x, forward.y, forward.z], meshes: [] };
        body.traverse((mesh) => {
          if (!mesh.isMesh) return;
          const m = mesh.material;
          window.__collarCamera.meshes.push({
            name: mesh.name,
            material: m.name,
            planes: m.clippingPlanes?.map((p) => ({ normal: p.normal.toArray(), constant: p.constant })),
            skin: mesh.isSkinnedMesh,
            world: Array.from(mesh.matrixWorld.elements),
            inverse: mesh.bindMatrixInverse ? Array.from(mesh.bindMatrixInverse.elements) : null,
            headY: mesh.skeleton?.bones.find((b) => b.name === "Head")?.matrixWorld.elements[13],
          });
        });
        if (window.__hideCollar) {
          liner.visible = false;
          this.__restoreLiner = liner;
        }
      };
      scene.onAfterRender = function (...args) {
        after?.call(this, ...args);
        if (this.__restoreLiner) {
          this.__restoreLiner.visible = true;
          this.__restoreLiner = null;
        }
      };
    });
    await scene.locator("canvas").scrollIntoViewIfNeeded();
    await frame(() => page.locator("[data-world-fullscreen]").click());
    await page.locator("[data-world-lab] > summary").click();
    await chooseAvatar("ghibli");
    // Set source to the actual bath routine before constructing/switching the Walk clone.
    await frame(() => page.locator("[data-world-activity]").selectOption("soak"));
    await wait(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence().activity === "soak");
    const bath = await save("bath-source");
    assert.equal(bath.walk.active, false);
    assert.equal(bath.walkPresence.sourceHidden, false);
    await page.locator("[data-world-lab] > summary").click();
    await frame(() => page.locator("[data-world-walk]").click());
    await wait(() => {
      const s = document.querySelector("[data-home-desk-scene]").getSceneEvidence();
      return s.walk?.ready && s.walkPresence?.active && s.walkPresence?.prepared;
    });
    check(await state());
    // Real native camera, upper-floor nonzero translation and yaw. No renderer/mesh overrides.
    await frame(async () =>
      assert.equal(await scene.evaluate((e) => e.setLabWalk({ position: [-6.25, 2.6, 3.65], yaw: -Math.PI / 2, pitch: -1.4 })), true)
    );
    const upper = await save("ghibli-upper-down");
    check(upper);
    assert.ok(upper.walk.position[1] > 2.5);
    assert.ok(Math.abs(upper.walkPresence.position[0] + 6.25) < 0.2);
    assert.ok(Math.abs(upper.walkPresence.position[1] - 2.6) < 0.2);
    assert.ok(Math.abs(upper.walkPresence.yaw + Math.PI / 2) < 0.01);
    assert.ok(receipts.steps.at(-1).draw.forward[1] < -0.98, "the actual native draw camera looks down");
    assert.ok(
      receipts.steps
        .at(-1)
        .draw.meshes.filter((m) => m.skin)
        .every((m) => m.planes?.some((p) => Math.abs(p.constant - 4) < 0.001)),
      "every actual native draw material is clipped"
    );
    await frame(() => page.evaluate(() => (window.__hideCollar = true)));
    await save("ghibli-upper-no-liner");
    await frame(() => page.evaluate(() => (window.__hideCollar = false)));
    await save("ghibli-upper-restored");
    await page.locator("[data-world-lab] > summary").click();
    await chooseAvatar("lizard");
    await page.locator("[data-world-lab] > summary").click();
    const switched = await save("lizard-upper-down");
    check(switched);
    assert.ok(switched.walk.position[1] > 2.5);
    assert.ok(Math.abs(switched.walkPresence.position[1] - 2.6) < 0.2);
    assert.ok(receipts.steps.at(-1).draw.forward[1] < -0.98);
    if (process.env.CAMERA_ONLY === "1") {
      await frame(async () =>
        assert.equal(await scene.evaluate((e) => e.setLabWalk({ position: [-6.25, 2.6, 3.65], yaw: -Math.PI / 2, pitch: 0 })), true)
      );
      await save("lizard-upper-mirror");
      await frame(() => page.locator("[data-world-walk]").click());
      const returned = await save("routine-return");
      check(returned);
      assert.equal(returned.walk.active, false);
      assert.equal(returned.activity, "soak");
      assert.deepEqual(errors, []);
      receipts.passed = true;
      return;
    }
    // Rendered mirror from real camera after the translated source switch; full body stays uncut there.
    await frame(async () =>
      assert.equal(await scene.evaluate((e) => e.setLabWalk({ position: [-6.25, 2.6, 3.65], yaw: -Math.PI / 2, pitch: 0 })), true)
    );
    await save("lizard-upper-mirror");
    await frame(() => page.locator("[data-world-walk]").click());
    const returned = await save("routine-return");
    check(returned);
    assert.equal(returned.walk.active, false);
    assert.equal(returned.activity, "soak");
    await page.locator("[data-world-lab] > summary").click();
    await chooseAvatar("ghibli");
    await page.locator("[data-world-lab] > summary").click();
    await frame(() => page.locator("[data-world-walk]").click());
    await wait(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence().walkPresence?.active);
    await frame(async () =>
      assert.equal(await scene.evaluate((e) => e.setLabWalk({ position: [-6.25, 0, 3.65], yaw: -Math.PI / 2, pitch: -1.4 })), true)
    );
    const ground = await save("ghibli-ground-down");
    check(ground);
    const d = ground.walk.distance;
    await scene.locator("canvas").focus();
    await page.keyboard.down("KeyS");
    await page.waitForTimeout(350);
    await page.keyboard.up("KeyS");
    await page.waitForFunction((distance) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().walk.distance > distance, d, {
      timeout: 30000,
    });
    const walked = await save("ghibli-walk");
    check(walked);
    assert.ok(walked.walk.distance > d);
    await frame(() => page.locator("[data-world-walk]").click());
    await frame(() => page.locator("[data-world-exit]").click());
    await page.locator('[data-home-desk-mode="2d"]').click();
    await page.waitForFunction(() => document.querySelector("[data-home-artifact-stage]").dataset.deskMode === "2d");
    await page.locator('[data-home-desk-mode="3d"]').click();
    await wait(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready");
    await scene.locator("canvas").scrollIntoViewIfNeeded();
    await frame(() => page.locator("[data-world-fullscreen]").click());
    await frame(() => page.locator("[data-world-walk]").click());
    await wait(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence().walkPresence?.active);
    const recovered = await save("mode-recovery");
    check(recovered);
    await frame(() => page.locator("[data-world-walk]").click());
    check(await state());
    assert.deepEqual(errors, []);
    receipts.passed = true;
  } catch (error) {
    receipts.failure = error.stack;
    try {
      await save("failure");
    } catch {}
    throw error;
  } finally {
    await context.close();
  }
}
async function main() {
  await fs.mkdir(out, { recursive: true });
  await startServer();
  let browser;
  try {
    for (const name of modules) {
      // Published mjs files use canonical Git bytes; a Windows checkout may be CRLF.
      const local = live
        ? execFileSync("git", ["show", `HEAD:assets/js/home-scene/${name}`], { cwd: source })
        : await fs.readFile(path.join(source, "assets/js/home-scene", name));
      const response = await fetch(base + "assets/js/home-scene/" + name);
      assert.equal(response.status, 200);
      report.sourceHashes[name] = sha(local);
      report.loadedHashes[name] = sha(Buffer.from(await response.arrayBuffer()));
      assert.equal(report.loadedHashes[name], report.sourceHashes[name], `${name}: loaded source is exact`);
    }
    report.browserArgs = process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [];
    browser = await chromium.launch({ headless: true, args: report.browserArgs });
    await runViewport(browser, "desktop", { width: 1440, height: 1000 }, false);
    await runViewport(browser, "mobile", { width: 390, height: 1000 }, true);
    report.passed = true;
    console.log("HOUSE_ACCEPTANCE_PASS");
  } catch (error) {
    report.failure = error.stack;
    console.error(error);
    process.exitCode = 1;
  } finally {
    await fs.writeFile(path.join(out, "evidence.json"), JSON.stringify(report, null, 2));
    if (browser) await browser.close();
    if (server) await new Promise((r) => server.close(r));
  }
}
main();
