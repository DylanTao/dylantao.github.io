#!/usr/bin/env node
// Owned-server proof only. --list / --self-test do not launch a browser or use a GPU.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { execFileSync } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const ROOT = path.resolve(__dirname, "..");
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
// This retained NWS interval is actually wet; October 30 became dry in the newer snapshot.
// preflight still rejects a dry or simulated replacement instead of forcing a rain override.
const CASES = Object.freeze({ ladder: "2026-10-24T13:20:00-07:00", clear: "2026-10-24T12:30:00-07:00", rain: "2026-10-31T12:30:00-07:00" });
function parseOptions(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].replace(/^--/, "");
    assert.ok(
      argv[i].startsWith("--") && ["url", "source-root", "out", "viewports", "cases", "total-timeout", "list", "self-test"].includes(name),
      `Unknown argument ${argv[i]}`
    );
    if (["list", "self-test"].includes(name)) values[name] = true;
    else {
      assert.ok(argv[i + 1] && !argv[i + 1].startsWith("--"), `Missing --${name}`);
      values[name] = argv[++i];
    }
  }
  const options = {
    base: values.url && new URL(values.url).href.replace(/\/?$/, "/"),
    sourceRoot: path.resolve(values["source-root"] || ROOT),
    out: path.resolve(
      values.out || path.join(ROOT, ".jekyll-cache/visual-qa", `retreat-interactions-${new Date().toISOString().replace(/[:.]/g, "-")}`)
    ),
    viewports: (values.viewports || "desktop,mobile").split(","),
    cases: (values.cases || "ladder,clear,rain").split(","),
    totalTimeout: Number(values["total-timeout"] || 1200),
    list: !!values.list,
    selfTest: !!values["self-test"],
  };
  assert.ok(options.viewports.every((v) => ["desktop", "mobile"].includes(v)) && new Set(options.viewports).size === options.viewports.length);
  assert.ok(options.cases.every((v) => Object.hasOwn(CASES, v)) && new Set(options.cases).size === options.cases.length);
  assert.ok(Number.isFinite(options.totalTimeout) && options.totalTimeout >= 30 && options.totalTimeout <= 1800);
  return options;
}
function validateLadder(manifest) {
  const ladder = manifest.estateLibrary?.ladder;
  assert.ok(ladder?.nodes?.length && ladder.nodes.every((n) => typeof n === "string"));
  assert.equal(ladder.travelAxis, "z");
  assert.equal(ladder.climbable, false);
  assert.ok(ladder.travel.length === 2 && ladder.travel.every(Number.isFinite) && ladder.travel[0] < ladder.travel[1]);
  assert.ok(ladder.rest >= ladder.travel[0] && ladder.rest <= ladder.travel[1]);
  return ladder;
}
async function preflight(options) {
  const manifest = JSON.parse(await fs.readFile(path.join(options.sourceRoot, "assets/models/home/manifest.json"))),
    ladder = validateLadder(manifest);
  const { weatherAt } = await import(pathToFileURL(path.join(options.sourceRoot, "assets/js/home-scene/coastal-weather.mjs")));
  const cases = options.cases.map((id) => {
    const time = CASES[id],
      minute = id === "ladder" ? 800 : 750,
      weather = weatherAt(time.slice(0, 10), minute, { utcMilliseconds: Date.parse(time) });
    if (id === "rain") {
      assert.equal(weather.source, "nws-forecast", "Natural rain case is no longer inside the retained forecast");
      assert.ok(weather.rain > 0.005, "Natural forecast rain case is now dry; do not force the weather");
    }
    if (id === "clear") assert.ok(weather.rain <= 0.005, "Natural clear case now contains rain");
    return { id, time, weather };
  });
  return { manifest, ladder, cases };
}
async function main(options) {
  const plan = await preflight(options);
  if (options.selfTest) {
    assert.throws(() => parseOptions(["--cases", "invented"]));
    assert.throws(() => parseOptions(["--viewports", "desktop,desktop"]));
    assert.throws(() => parseOptions(["--total-timeout", "NaN"]));
    assert.throws(() => validateLadder({}));
    console.log("Interaction helper source preflight passed; no browser launched.");
    return;
  }
  if (options.list) {
    console.log(
      JSON.stringify(
        {
          viewports: options.viewports,
          cases: plan.cases,
          ladder: plan.ladder,
          instrumentation: "Existing scene-lab real scene graph, getSceneEvidence and one setLabWalk placement; no timer/RAF/performance patch.",
        },
        null,
        2
      )
    );
    return;
  }
  assert.ok(options.base, "Supply --url for an owned full-asset server; no server is started and no local assets are overlaid.");
  const { chromium } = require("playwright"),
    canonical = require(path.join(options.sourceRoot, "test/visual/public.config.js"));
  const { preparePage, collectRuntimeErrors, screenshotMetrics } = require(path.join(options.sourceRoot, "test/visual/helpers.js"));
  const { sourceRecord } = require(path.join(options.sourceRoot, "bin/verify_coastal_routes.cjs"));
  await fs.mkdir(options.out, { recursive: true });
  await assert.rejects(fs.access(path.join(options.out, "report.json")), "Choose a fresh evidence folder");
  const report = {
    scope:
      "Full assets, native RAF/performance/timers, only routine Date fixed. Host D3D11 touch emulation is not a physical-phone performance measurement. Reduced ladder snaps to endpoint then holds; Pause holds midpoint.",
    options,
    sourceCommit: execFileSync("git", ["-C", options.sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    states: [],
    passed: false,
  };
  const save = () => fs.writeFile(path.join(options.out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  let browser;
  const watchdog = setTimeout(() => {
    report.watchdogExpired = true;
    browser?.close().catch(() => {});
  }, options.totalTimeout * 1000);
  try {
    report.processIsolation = "Fresh native browser process per case and viewport; full scene quality is unchanged.";
    for (const viewport of options.viewports)
      for (const scenario of plan.cases) {
        browser = await chromium.launch({ ...canonical.use.launchOptions, headless: true, timeout: 30000 });
        const context = await browser.newContext({
          viewport: viewport === "desktop" ? { width: 1440, height: 1000 } : { width: 390, height: 1000 },
          deviceScaleFactor: 1,
          hasTouch: viewport === "mobile",
          isMobile: viewport === "mobile",
          locale: "en-US",
          timezoneId: "America/Los_Angeles",
        });
        const page = await context.newPage(),
          errors = collectRuntimeErrors(page),
          state = {
            viewport,
            case: scenario.id,
            time: scenario.time,
            expectedWeather: scenario.weather,
            errors,
            assets: [],
            failedResponses: [],
            failedRequests: [],
            captures: [],
            steps: [],
            passed: false,
          },
          tasks = [];
        report.states.push(state);
        page.setDefaultTimeout(30000);
        page.on("requestfailed", (request) => state.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
        page.on("response", (response) => {
          const url = new URL(response.url()),
            at = url.pathname.indexOf("/assets/"),
            relative = at >= 0 ? url.pathname.slice(at + 1) : null;
          if (url.origin === new URL(options.base).origin && response.status() >= 400)
            state.failedResponses.push({ url: response.url(), status: response.status() });
          if (relative && /^assets\/(?:models\/home\/.*\.(?:glb|json)|js\/home-scene\/.*\.mjs)$/.test(relative))
            tasks.push(
              response
                .body()
                .then((bytes) => sourceRecord(options.sourceRoot, relative, bytes))
                .then((record) => state.assets.push(record))
                .catch((e) => errors.push(`Asset custody: ${e.message}`))
            );
        });
        const scene = page.locator("[data-home-desk-scene]"),
          canvas = scene.locator("canvas"),
          button = page.locator("[data-world-ladder]"),
          pause = page.locator("[data-world-pause]");
        const click = (locator) => (viewport === "mobile" ? locator.tap() : locator.click());
        async function activatePause(label) {
          state.steps.push({
            label,
            activation: "Diagnostic activation of the existing DOM button handler while fullscreen; pointer access is not claimed.",
            pointerVisible: await pause.isVisible(),
          });
          await pause.evaluate((button) => button.click());
        }
        async function read() {
          return scene.evaluate(async (element) => {
            const value = element.getSceneEvidence?.(),
              root = element.labScene?.scene;
            if (!value?.ready || !root) return { ready: false, roomCount: value?.roomCount || 0 };
            const THREE = await import(new URL("./assets/js/three.module.min.js", location.href).href);
            root.updateMatrixWorld(true);
            const ladderMeshes = [],
              rainObjects = [];
            root.traverse((object) => {
              if (object.isMesh && object.userData.action?.type === "library-ladder") {
                const box = new THREE.Box3().setFromObject(object, true);
                ladderMeshes.push({
                  name: object.userData.name || object.name,
                  matrix: object.matrixWorld.toArray(),
                  min: box.min.toArray(),
                  max: box.max.toArray(),
                });
              }
              if (object.name === "Bounded coastal rain") rainObjects.push(object);
            });
            if (rainObjects.length !== 1) throw new Error(`Expected one actual rain draw object, found ${rainObjects.length}`);
            const rain = rainObjects[0],
              attribute = rain.geometry.getAttribute("position"),
              bytes = new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength),
              hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (x) => x.toString(16).padStart(2, "0")).join("");
            return {
              ready: value.ready,
              sceneState: element.dataset.sceneState,
              animation: value.animation,
              documentVisibility: document.visibilityState,
              contextLost: element.querySelector("canvas").getContext("webgl2").isContextLost(),
              camera: value.camera,
              cameraArm: value.cameraArm,
              orbit: value.cameraOrbit,
              roomCount: value.roomCount,
              room: value.currentRoom,
              frames: value.frames,
              seconds: value.animationSeconds,
              walk: value.walk,
              ladder: value.simulation.libraryLadder,
              ladderMeshes,
              rain: {
                ...value.simulation.rain,
                positionSha256: hash,
                drawCount: rain.geometry.drawRange.count,
                visible: rain.visible,
                isLineSegments: rain.isLineSegments,
                castShadow: rain.castShadow,
                noContactOcclusion: rain.userData.noContactOcclusion,
                count: rainObjects.length,
              },
            };
          });
        }
        async function until(label, predicate, timeout = 30000) {
          const started = performance.now();
          let value;
          do {
            value = await read();
            if (predicate(value)) return value;
            await delay(80);
          } while (performance.now() - started < timeout);
          throw new Error(`${label} timed out; last=${JSON.stringify(value)}`);
        }
        async function capture(label) {
          const file = `${viewport}-${scenario.id}-${label}.png`,
            bytes = await canvas.screenshot({ path: path.join(options.out, file), timeout: 30000 }),
            metrics = screenshotMetrics(bytes);
          state.captures.push({ label, file, sha256: sha(bytes), metrics });
          // Every case deliberately frames the furnished study. A soft blank vignette can have
          // hundreds of gradient colors, so it cannot qualify as this room's rendered evidence.
          assert.ok(metrics.uniqueColors > 1200 && metrics.luminanceVariance > 500, "The furnished study is absent or nearly uniform");
          const uiFile = `${viewport}-${scenario.id}-${label}-ui.png`;
          await page.screenshot({ path: path.join(options.out, uiFile), timeout: 30000 });
          state.captures.push({ label: `${label}-controls`, file: uiFile });
        }
        async function settleFrames() {
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await delay(150);
        }
        async function hold(label, field) {
          await settleFrames();
          const before = await read();
          await delay(500);
          const after = await read();
          assert.deepEqual(field(after), field(before), `${label} changed actual geometry/buffer while held`);
          state.steps.push({ label, before, after });
          return after;
        }
        async function endpoint(target) {
          return until(`Ladder endpoint ${target}`, (s) => Math.abs(s.ladder.position - target) < 0.00001, 20000);
        }
        async function geometryMove(before, after) {
          const dz = after.ladder.position - before.ladder.position;
          assert.equal(after.ladderMeshes.length, plan.ladder.nodes.length);
          for (const a of before.ladderMeshes) {
            const b = after.ladderMeshes.find((m) => m.name === a.name);
            assert.ok(b, `Missing actual ladder mesh ${a.name}`);
            for (let i = 0; i < 16; i++)
              assert.ok(
                Math.abs(b.matrix[i] - a.matrix[i] - (i === 14 ? dz : 0)) < 0.0001,
                `${a.name}: actual world matrix did not follow whole-assembly translation`
              );
          }
        }
        try {
          await preparePage(page, "light");
          await page.emulateMedia({ reducedMotion: "no-preference" });
          await page.addInitScript((time) => {
            const NativeDate = Date,
              fixed = NativeDate.parse(time);
            window.__retreatNativeClock = { raf: requestAnimationFrame, now: performance.now, timeout: setTimeout, interval: setInterval };
            window.Date = new Proxy(NativeDate, {
              apply: () => new NativeDate(fixed).toString(),
              construct: (target, args) => Reflect.construct(target, args.length ? args : [fixed]),
              get: (target, property) => (property === "now" ? () => fixed : Reflect.get(target, property)),
            });
          }, scenario.time);
          await page.goto(new URL("?scene-lab=1", options.base).href, { waitUntil: "domcontentloaded", timeout: 30000 });
          await click(page.locator('[data-home-desk-mode="3d"]'));
          await until("Full room readiness", (s) => s.ready && s.roomCount === plan.manifest.rooms.length && s.ladder?.available, 150000);
          await canvas.scrollIntoViewIfNeeded();
          state.graphics = await canvas.evaluate((c) => {
            const gl = c.getContext("webgl2"),
              d = gl?.getExtension("WEBGL_debug_renderer_info");
            return { renderer: gl && gl.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : gl.RENDERER) };
          });
          assert.ok(state.graphics.renderer);
          assert.doesNotMatch(state.graphics.renderer, /SwiftShader|llvmpipe|softpipe|software/i);
          if (process.platform === "win32") assert.match(state.graphics.renderer, /Direct3D11|D3D11/i);
          state.clock = await page.evaluate(() => ({
            raf: __retreatNativeClock.raf === requestAnimationFrame,
            performance: __retreatNativeClock.now === performance.now,
            timeout: __retreatNativeClock.timeout === setTimeout,
            interval: __retreatNativeClock.interval === setInterval,
            date: new Date().toISOString(),
          }));
          assert.ok(
            state.clock.raf && state.clock.performance && state.clock.timeout && state.clock.interval,
            "Native scheduling APIs were replaced"
          );
          const drawer = page.locator("[data-world-lab]"),
            summary = drawer.locator(":scope > summary");
          if (!(await drawer.evaluate((element) => element.open))) await click(summary);
          await click(page.locator('[data-world-room="study"]'));
          await until("Study arrival", (s) => s.room === "study");
          if (await drawer.evaluate((element) => element.open)) await click(summary);
          await click(page.locator("[data-world-fullscreen]"));
          await button.waitFor({ state: "visible" });
          const liveStart = await read();
          state.liveStudy = await until("Visible study continues rendering before interaction", (s) => s.frames >= liveStart.frames + 4);
          assert.equal(state.liveStudy.contextLost, false);
          const unfocusedShadow = await button.evaluate((b) => getComputedStyle(b).boxShadow);
          await button.focus();
          await page.keyboard.press("Tab");
          await page.keyboard.press("Shift+Tab");
          state.controls = await button.evaluate((b) => {
            const r = b.getBoundingClientRect(),
              style = getComputedStyle(b);
            return {
              focused: b === document.activeElement,
              label: b.getAttribute("aria-label") || b.innerText.trim() || b.getAttribute("title"),
              width: r.width,
              height: r.height,
              x: r.x,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
              viewport: [innerWidth, innerHeight],
              outline: style.outlineStyle,
              outlineWidth: style.outlineWidth,
              focusVisible: b.matches(":focus-visible"),
              shadow: style.boxShadow,
              overflow: document.documentElement.scrollWidth - innerWidth,
            };
          });
          assert.ok(state.controls.focused && state.controls.label && state.controls.width >= 24 && state.controls.height >= 24);
          assert.ok(
            state.controls.x >= 0 &&
              state.controls.right <= state.controls.viewport[0] + 1 &&
              state.controls.top >= 0 &&
              state.controls.bottom <= state.controls.viewport[1] + 1 &&
              state.controls.overflow <= 1,
            "Ladder control overflow/fit failure"
          );
          assert.ok(
            state.controls.focusVisible &&
              ((state.controls.outline !== "none" && parseFloat(state.controls.outlineWidth) > 0) ||
                (state.controls.shadow !== "none" && state.controls.shadow !== unfocusedShadow)),
            "Focused ladder control lacks a visible outline"
          );
          await capture("ready");
          if (scenario.id === "ladder") {
            let before = await read();
            assert.equal(before.ladder.climbable, false);
            assert.equal(before.ladderMeshes.length, plan.ladder.nodes.length);
            await click(button);
            let after = await endpoint(plan.ladder.travel[1]);
            await geometryMove(before, after);
            state.steps.push({ label: "button-max", before, after });
            before = after;
            await canvas.focus();
            await page.keyboard.press("l");
            after = await endpoint(plan.ladder.travel[0]);
            await geometryMove(before, after);
            state.steps.push({ label: "keyboard-min", before, after });
            await click(button);
            await until(
              "Ladder actually moving",
              (s) => s.ladder.position > plan.ladder.travel[0] + 0.1 && s.ladder.position < plan.ladder.travel[1] - 0.1
            );
            await activatePause("Pause midpoint diagnostic activation");
            await hold("Pause midpoint", (s) => ({ position: s.ladder.position, meshes: s.ladderMeshes }));
            await activatePause("Resume ladder diagnostic activation");
            await endpoint(plan.ladder.travel[1]);
            await page.emulateMedia({ reducedMotion: "reduce" });
            await canvas.focus();
            await page.keyboard.press("l");
            await endpoint(plan.ladder.travel[0]);
            await hold("Reduced endpoint snap then hold", (s) => ({ position: s.ladder.position, meshes: s.ladderMeshes }));
            await page.emulateMedia({ reducedMotion: "no-preference" });
            await click(page.locator("[data-world-walk]"));
            await until("Real Walk ready", (s) => s.walk?.active && s.walk.ready && s.walk.placed, 150000);
            before = await read();
            const bounds = before.ladder.bounds,
              placement = { position: [bounds.max[0] + 0.2, 0, bounds.max[2] + 0.8], yaw: Math.PI / 2, pitch: 0 };
            assert.equal(
              await scene.evaluate((e, p) => e.setLabWalk(p), placement),
              true,
              "The single declared blocker placement is not a valid native capsule pose; retain failure instead of silently relocating"
            );
            state.placement = {
              ...placement,
              scope: "One documented lab placement ahead of the actual ladder sweep; release uses real W input, never another placement.",
            };
            await until("Placed near actual ladder", (s) => s.walk.active);
            await button.waitFor({ state: "visible" });
            await click(button);
            await until("Capsule blocks actual ladder", (s) => s.ladder.blocked);
            await hold("Blocked queued motion", (s) => ({ position: s.ladder.position, meshes: s.ladderMeshes }));
            await canvas.focus();
            await page.keyboard.down("KeyW");
            try {
              await delay(1000);
            } finally {
              await page.keyboard.up("KeyW");
            }
            after = await endpoint(plan.ladder.travel[1]);
            assert.equal(after.ladder.blocked, false);
            state.steps.push({ label: "Real W clears blocker and queued motion resumes", after });
            await capture("ladder-complete");
          } else {
            const initial = await read();
            assert.ok(
              Math.abs(initial.rain.intensity - scenario.weather.rain) < 0.00001,
              "Actual rain differs from the natural fixed-Date weather plan"
            );
            assert.equal(initial.rain.extraPasses, 0);
            assert.equal(initial.rain.shadowCasters, 0);
            assert.equal(initial.rain.count, 1);
            assert.ok(initial.rain.isLineSegments && !initial.rain.castShadow && initial.rain.noContactOcclusion);
            assert.equal(initial.rain.drawCount, initial.rain.drops * 2);
            if (scenario.id === "rain") {
              assert.ok(initial.rain.visible && initial.rain.drops > 0);
              await until("Sheltered actual rain segments", (s) => s.rain.sheltered > 0);
            } else assert.ok(!initial.rain.visible && initial.rain.drops === 0);
            await activatePause("Pause rain diagnostic activation");
            await hold("Pause actual rain position buffer", (s) => ({ hash: s.rain.positionSha256, seconds: s.rain.fieldTime }));
            await activatePause("Resume rain diagnostic activation");
            if (scenario.id === "rain") {
              const resumed = await read();
              await until("Rain buffer advances after resume", (s) => s.rain.positionSha256 !== resumed.rain.positionSha256);
            }
            await page.emulateMedia({ reducedMotion: "reduce" });
            await hold("Reduced actual rain position buffer", (s) => ({ hash: s.rain.positionSha256, seconds: s.rain.fieldTime }));
            await page.emulateMedia({ reducedMotion: "no-preference" });
            if (scenario.id === "rain") {
              state.roof = await scene.evaluate(async (e) => {
                const T = await import(new URL("./assets/js/three.module.min.js", location.href).href),
                  root = e.labScene.scene,
                  roofs = [];
                root.updateMatrixWorld(true);
                root.traverse((o) => {
                  if (!o.isMesh) return;
                  for (let p = o; p; p = p.parent)
                    if (p.userData.caveRoof) {
                      roofs.push(o);
                      break;
                    }
                });
                const object = root.getObjectByName("Bounded coastal rain"),
                  a = object.geometry.getAttribute("position").array,
                  count = object.geometry.drawRange.count / 2,
                  ray = new T.Raycaster(),
                  witnesses = [];
                for (let i = 0; i < count; i++) {
                  const k = i * 6;
                  ray.set(new T.Vector3(a[k + 3], 64, a[k + 5]), new T.Vector3(0, -1, 0));
                  const hit = ray.intersectObjects(roofs, false)[0];
                  if (hit)
                    witnesses.push({
                      drop: i,
                      bottom: a[k + 4],
                      roof: hit.point.y,
                      mesh: hit.object.name,
                      landed: Math.abs(a[k + 1] - a[k + 4]) < 0.00001,
                    });
                  if (witnesses.length >= 16) break;
                }
                return {
                  actualRoofMeshes: roofs.length,
                  checked: witnesses.length,
                  toleranceMetres: 0.2,
                  witnesses,
                  failed: witnesses.filter((w) => w.bottom < w.roof - 0.2),
                };
              });
              assert.ok(
                state.roof.actualRoofMeshes > 0 && state.roof.checked > 0,
                "No actual roof/rain triangle witness; cannot claim roof protection"
              );
              assert.deepEqual(state.roof.failed, [], "Actual rendered rain penetrates native roof triangles");
              // A buried room can correctly clip every nearby line. Prove separately that
              // the same natural shower has actual nondegenerate segments in the open air.
              await click(page.locator("[data-world-view]"));
              state.openAir = await until(
                "Actual exposed rain in the public outside view",
                (s) => s.room === "outside" && s.rain.drops - s.rain.sheltered - s.rain.nearCamera > 0,
                45000
              );
              assert.ok(state.openAir.rain.visible);
              await capture("rain-open-air");
            }
            await capture("weather-complete");
          }
          await Promise.all(tasks);
          assert.ok(state.assets.some((a) => a.path === "assets/models/home/manifest.json"));
          for (const room of plan.manifest.rooms)
            assert.ok(
              state.assets.some((a) => a.path === `assets/models/home/${room.file}`),
              `Missing full room ${room.file}`
            );
          assert.equal(state.assets.filter((a) => a.match === "MISMATCH").length, 0, "Served assets differ from source");
          assert.deepEqual(errors, []);
          assert.deepEqual(state.failedResponses, []);
          state.passed = true;
        } catch (error) {
          state.failure = { message: error.message, stack: error.stack };
          await capture("failure").catch((e) => {
            state.captureFailure = e.message;
          });
          throw error;
        } finally {
          await page.keyboard.up("KeyW").catch(() => {});
          await Promise.allSettled(tasks);
          await save();
          await context.close();
          await browser.close();
          browser = null;
        }
      }
    report.passed = report.states.length === options.viewports.length * options.cases.length && report.states.every((s) => s.passed);
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    clearTimeout(watchdog);
    await browser?.close();
    await save();
    console.log(JSON.stringify({ passed: report.passed, output: path.join(options.out, "report.json"), failure: report.failure?.message }));
  }
}
if (require.main === module) {
  try {
    main(parseOptions(process.argv.slice(2))).catch((e) => {
      console.error(e.stack);
      process.exitCode = 1;
    });
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
module.exports = { parseOptions, validateLadder, preflight };
