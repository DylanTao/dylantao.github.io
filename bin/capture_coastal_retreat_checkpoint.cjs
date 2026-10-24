#!/usr/bin/env node
// Full production stills from an already owned server. No local response overlays or clock acceleration.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
const FIXED_DATE = "2026-10-24T15:20:00-07:00";
function parseOptions(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, "");
    assert.ok(
      argv[i].startsWith("--") && ["url", "out", "source-root", "viewports", "shots", "list", "self-test"].includes(key),
      `Unknown ${argv[i]}`
    );
    if (["list", "self-test"].includes(key)) values[key] = true;
    else {
      assert.ok(argv[i + 1] && !argv[i + 1].startsWith("--"), `Missing --${key}`);
      values[key] = argv[++i];
    }
  }
  return {
    base: values.url && new URL(values.url).href,
    sourceRoot: path.resolve(values["source-root"] || ROOT),
    widths: values.viewports?.split(",").map(Number),
    shots: values.shots?.split(","),
    out: path.resolve(values.out || path.join(ROOT, ".jekyll-cache/visual-qa/retreat-checkpoint")),
    list: !!values.list,
    selfTest: !!values["self-test"],
  };
}
function shotPlan(manifest) {
  const setback = manifest.retreat?.setbackMetres;
  assert.ok(Number.isFinite(setback), "Missing actual housing-frame setback");
  for (const id of ["study", "bath-living", "bath-bedroom"])
    assert.ok(
      manifest.rooms.some((room) => room.id === id),
      `Missing room ${id}`
    );
  for (const id of ["overview", "outside"]) assert.ok(manifest.views?.[id], `Missing exterior view ${id}`);
  const overview = { id: "overview-day", room: "overview", minute: 920 },
    study = { id: "study-day", room: "study", minute: 920 },
    outside = { id: "outside-night", room: "outside", minute: 1290 },
    bath = (room, night) => ({ id: `${room}-${night ? "night" : "day"}`, room, minute: night ? 1290 : 920 });
  return [
    {
      width: 1440,
      height: 1000,
      shots: [
        overview,
        { id: "pool-day", room: "overview", minute: 920, camera: { target: [-0.95, -0.2, -8.7 + setback], yaw: 0.75, pitch: 0.4, radius: 8.5 } },
        study,
        {
          id: "entrance-garden-day",
          room: "outside",
          minute: 920,
          camera: { target: [6.9, 8.8, 11.6], yaw: 0.837, pitch: 0.498, radius: 10.88 },
        },
        bath("bath-living", false),
        bath("bath-living", true),
        bath("bath-bedroom", false),
        bath("bath-bedroom", true),
        outside,
      ],
    },
    { width: 1280, height: 800, shots: [overview] },
    { width: 768, height: 1024, shots: [overview] },
    { width: 390, height: 1000, shots: [overview, study, bath("bath-living", true), bath("bath-bedroom", true), outside] },
  ];
}
async function main(options) {
  const manifest = JSON.parse(await fs.readFile(path.join(options.sourceRoot, "assets/models/home/manifest.json"))),
    fullPlan = shotPlan(manifest),
    plan = fullPlan
      .filter((viewport) => !options.widths || options.widths.includes(viewport.width))
      .map((viewport) => ({ ...viewport, shots: viewport.shots.filter((shot) => !options.shots || options.shots.includes(shot.id)) }))
      .filter((viewport) => viewport.shots.length);
  assert.ok(plan.length, "No requested viewport/shot combination exists");
  assert.ok(plan.reduce((n, v) => n + v.shots.length, 0) <= 16);
  if (options.selfTest) {
    assert.throws(() => parseOptions(["--unknown"]));
    assert.throws(() => parseOptions(["--url"]));
    assert.throws(() => shotPlan({ rooms: [] }));
    assert.equal(plan.find((v) => v.width === 1440).shots.find((s) => s.id === "pool-day").camera.target[2], -8.7 + manifest.retreat.setbackMetres);
    console.log("Checkpoint plan and argument preflight passed; no browser launched.");
    return;
  }
  if (options.list) {
    console.log(JSON.stringify({ fixedDate: FIXED_DATE, reducedMotion: true, plan }, null, 2));
    return;
  }
  assert.ok(options.base, "Supply --url for an owned production server; this helper starts no server and overlays no source assets.");
  const { chromium } = require("playwright"),
    canonical = require(path.join(options.sourceRoot, "test/visual/public.config.js")),
    { preparePage, collectRuntimeErrors, screenshotMetrics, screenshotDiffRatio } = require(path.join(options.sourceRoot, "test/visual/helpers.js")),
    { sourceRecord } = require(path.join(options.sourceRoot, "bin/verify_coastal_routes.cjs"));
  await fs.mkdir(options.out, { recursive: true });
  await assert.rejects(fs.access(path.join(options.out, "report.json")), "Use a fresh evidence directory");
  const report = {
    scope:
      "Reduced-motion stills; fixed Date only. Native RAF, performance and timers. Real room/time handlers, diagnostic fullscreen DOM activation. Inspection cameras do not prove walking or physical-phone performance. No source overlays; ordinary navigation has separate proof.",
    options,
    fixedDate: FIXED_DATE,
    sourceCommit: execFileSync("git", ["-C", options.sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    states: [],
    passed: false,
  };
  const save = () => fs.writeFile(path.join(options.out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  let browser;
  const watchdog = setTimeout(() => {
    report.watchdogExpired = true;
    browser?.close().catch(() => {});
  }, 900000);
  try {
    report.processIsolation = "Fresh native browser process per viewport; full scene quality is unchanged.";
    for (const viewport of plan) {
      browser = await chromium.launch({ ...canonical.use.launchOptions, headless: true, timeout: 30000 });
      const mobile = viewport.width === 390,
        context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
          hasTouch: mobile,
          isMobile: mobile,
          timezoneId: "America/Los_Angeles",
          locale: "en-US",
          reducedMotion: "reduce",
        });
      const page = await context.newPage(),
        errors = collectRuntimeErrors(page),
        assets = [],
        tasks = [],
        state = {
          viewport: { width: viewport.width, height: viewport.height },
          hasTouch: mobile,
          errors,
          assets,
          failedResponses: [],
          shots: [],
          passed: false,
        };
      report.states.push(state);
      page.setDefaultTimeout(30000);
      page.on("response", (response) => {
        const url = new URL(response.url()),
          at = url.pathname.indexOf("/assets/"),
          relative = at >= 0 ? url.pathname.slice(at + 1) : null;
        if (url.origin !== new URL(options.base).origin) return;
        if (response.status() >= 400) state.failedResponses.push({ url: response.url(), status: response.status() });
        if (relative && /^assets\/(?:models\/home\/.*\.(?:glb|json)|js\/home-scene\/.*\.mjs)$/.test(relative))
          tasks.push(
            response
              .body()
              .then((bytes) => sourceRecord(options.sourceRoot, relative, bytes))
              .then((record) => assets.push(record))
              .catch((e) => errors.push(`Asset custody: ${e.message}`))
          );
      });
      const scene = page.locator("[data-home-desk-scene]"),
        canvas = scene.locator("canvas");
      async function settle() {
        await page.waitForFunction(
          (count) => {
            const element = document.querySelector("[data-home-desk-scene]"),
              value = element?.getSceneEvidence?.();
            return (
              value?.ready &&
              value.roomCount === count &&
              element.dataset.loadingStage === "ready" &&
              value.loading.lightCache.state === "restored" &&
              value.simulation.lightField?.ready &&
              !value.simulation.lightField.error
            );
          },
          manifest.rooms.length,
          { timeout: 180000 }
        );
        // Request the real renderer and cross two native browser frames, twice. No timer or RAF patches.
        await scene.evaluate(async (element) => {
          for (let i = 0; i < 2; i++) {
            element.labScene.requestFrame();
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          }
        });
        await page.waitForFunction(() => !document.querySelector("[data-home-desk-scene]").getSceneEvidence().framePending, null, { timeout: 15000 });
      }
      async function read() {
        return scene.evaluate(async (element) => {
          const evidence = element.getSceneEvidence(),
            root = element.labScene.scene,
            THREE = await import(new URL("./assets/js/three.module.min.js", location.href).href),
            vegetation = [];
          root.updateMatrixWorld(true);
          root.traverse((object) => {
            if (!object.isMesh || !(object.userData.roofPlanting || /core_retreat_roof_planting/.test(object.name))) return;
            const box = new THREE.Box3().setFromObject(object, true);
            let visible = true;
            for (let p = object; p; p = p.parent) visible &&= p.visible;
            vegetation.push({
              name: object.name,
              support: object.userData.cutawayVegetationSupport,
              visible,
              min: box.min.toArray(),
              max: box.max.toArray(),
              vertices: object.geometry.getAttribute("position")?.count,
            });
          });
          return {
            ...evidence,
            loadingStage: element.dataset.loadingStage,
            roofPlanting: vegetation,
            documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
            nativeClock: {
              raf: window.__checkpointNative.raf === requestAnimationFrame,
              performance: window.__checkpointNative.now === performance.now,
              timeout: window.__checkpointNative.timeout === setTimeout,
              interval: window.__checkpointNative.interval === setInterval,
            },
          };
        });
      }
      try {
        await preparePage(page, "light");
        await page.addInitScript((time) => {
          const NativeDate = Date,
            fixed = NativeDate.parse(time);
          window.__checkpointNative = { raf: requestAnimationFrame, now: performance.now, timeout: setTimeout, interval: setInterval };
          window.Date = new Proxy(NativeDate, {
            apply: () => new NativeDate(fixed).toString(),
            construct: (target, args) => Reflect.construct(target, args.length ? args : [fixed]),
            get: (target, property) => (property === "now" ? () => fixed : Reflect.get(target, property)),
          });
        }, FIXED_DATE);
        const url = new URL(options.base);
        url.searchParams.set("scene-lab", "1");
        await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.locator('[data-home-desk-mode="3d"]').click();
        await settle();
        await canvas.scrollIntoViewIfNeeded();
        await page.locator("[data-world-fullscreen]").click();
        state.graphics = await canvas.evaluate((c) => {
          const gl = c.getContext("webgl2"),
            extension = gl?.getExtension("WEBGL_debug_renderer_info");
          return { renderer: gl && gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER) };
        });
        assert.ok(state.graphics.renderer);
        assert.doesNotMatch(state.graphics.renderer, /SwiftShader|llvmpipe|softpipe|software/i);
        if (process.platform === "win32") assert.match(state.graphics.renderer, /Direct3D11|D3D11/i);
        for (const shot of viewport.shots) {
          await scene.evaluate((element, requested) => {
            const time = document.querySelector("[data-world-time]");
            time.value = String(requested.minute);
            time.dispatchEvent(new Event("input", { bubbles: true }));
            document.querySelector(`[data-world-room="${requested.room}"]`).click();
            if (requested.camera) element.setLabCamera(requested.camera);
          }, shot);
          await settle();
          if (viewport.width === 1440 && shot.id === "overview-day") {
            const before = await canvas.screenshot({ timeout: 30000 }),
              prior = await read(),
              box = await canvas.boundingBox();
            await canvas.focus();
            await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.54, { steps: 8 });
            await page.mouse.up();
            await settle();
            const dragged = await canvas.screenshot({ timeout: 30000 }),
              dragEvidence = await read();
            await page.mouse.wheel(0, -240);
            await settle();
            const zoomed = await canvas.screenshot({ timeout: 30000 }),
              zoomEvidence = await read();
            state.pointerProof = {
              activation: "Native Playwright mouse drag and wheel, real canvas input handlers; PNG probes in memory.",
              dragDiffRatio: screenshotDiffRatio(dragged, before),
              zoomDiffRatio: screenshotDiffRatio(zoomed, dragged),
              before: prior.cameraOrbit,
              afterDrag: dragEvidence.cameraOrbit,
              afterZoom: zoomEvidence.cameraOrbit,
            };
            assert.ok(state.pointerProof.dragDiffRatio > 0.001, "Drag did not visibly change the rendered view");
            assert.ok(state.pointerProof.zoomDiffRatio > 0.001, "Wheel did not visibly change the rendered view");
            await page.keyboard.press("Home");
            await settle();
          }
          const evidence = await read(),
            filename = `${viewport.width}x${viewport.height}-${shot.id}.png`,
            png = await canvas.screenshot({ path: path.join(options.out, filename), timeout: 30000 }),
            metrics = screenshotMetrics(png);
          state.shots.push({
            ...shot,
            file: filename,
            activation: "Existing actual room/time handlers via diagnostic DOM click in fullscreen; optional inspection orbit camera.",
            metrics,
            evidence,
          });
          assert.equal(evidence.currentRoom, shot.room);
          assert.ok(Object.values(evidence.nativeClock).every(Boolean));
          assert.ok(metrics.uniqueColors > 50 && metrics.luminanceVariance > 10, `${filename}: blank or near-uniform render`);
          assert.ok(evidence.documentOverflow <= 1, `${filename}: horizontal document overflow`);
          assert.ok(evidence.roofPlanting.length > 0, "Current native roof planting batches were not found");
          await save();
        }
        // Restore the real time input to the requested daytime after the last night still.
        await scene.evaluate((element) => {
          const input = document.querySelector("[data-world-time]");
          input.value = "920";
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        await settle();
        await Promise.all(tasks);
        assert.deepEqual(state.failedResponses, []);
        assert.deepEqual(errors, []);
        assert.ok(assets.length > 0 && assets.every((asset) => asset.match !== "MISMATCH"), "Served/source custody mismatch");
        for (const relative of [
          "assets/models/home/manifest.json",
          "assets/js/home-scene/controller.mjs",
          ...manifest.rooms.map((room) => `assets/models/home/${room.file}`),
        ])
          assert.ok(
            assets.some((asset) => asset.path === relative),
            `Missing full production response ${relative}`
          );
        state.passed = true;
      } finally {
        await save();
        await context.close();
        await browser.close();
        browser = null;
      }
    }
    report.passed = true;
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    clearTimeout(watchdog);
    await save();
    await browser?.close();
  }
  console.log(`Checkpoint passed: ${report.states.reduce((n, state) => n + state.shots.length, 0)} full-asset stills in ${options.out}`);
}
if (require.main === module)
  main(parseOptions(process.argv.slice(2))).catch((error) => {
    console.error(error.stack);
    process.exitCode = 1;
  });
module.exports = { parseOptions, shotPlan };
