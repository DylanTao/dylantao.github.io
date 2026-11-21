"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { argumentsFrom, loadRelease, manifestPath, collectorPath, sha, signedDigest } = require("./r2-source.cjs");
const cli = argumentsFrom(process.argv.slice(2), "node capture-r2-ab.cjs CHECKOUT FULL_RELEASE_SHA OUTPUT [LOCAL_PREVIEW_URL] [--dry]");
const base = new URL(cli.tail.find((value) => value !== "--dry") ?? "http://127.0.0.1:8080/");
if (!base.pathname.endsWith("/")) base.pathname += "/";
const url = new URL(base);
url.searchParams.set("scene-lab", "1");
const controllerPath = "assets/js/home-scene/controller.mjs";
const fieldPath = "assets/models/home/static-light-field.json";
const host = "[data-home-desk-scene]";
const canvas = host + " canvas.home-desk-corner-canvas";
const modelPrefix = "assets/models/home/";
const hide = "[data-home-world-controls],[data-world-immersive-bar],.home-world-hint,.home-walk-chrome{visibility:hidden!important}";

function replaceOnce(text, needle, replacement) {
  assert.equal(text.split(needle).length, 2, "An exact diagnostic hook did not match: " + needle);
  return text.replace(needle, replacement);
}

function patchField(text) {
  text = replaceOnce(
    text,
    "  function setLighting(next, force = false) {",
    [
      "  let diagnosticSolar = null;",
      "  function setDiagnosticSolar(delta) {",
      "    if (!transport) throw new Error('Wait for the signed static field');",
      "    if (delta !== null && (delta.length !== count * 12 || !delta.every(Number.isFinite))) throw new RangeError('Bad solar coefficients');",
      "    diagnosticSolar = delta === null ? null : Float64Array.from(delta);",
      "    return setLighting(lighting, true);",
      "  }",
      "  function setLighting(next, force = false) {",
    ].join("\n")
  );
  const pack = "      for (let k = 0; k < 4; k++) coefficientData.set([...coefficients.subarray(k * 3, k * 3 + 3), 0], p * 16 + k * 4);";
  text = replaceOnce(
    text,
    pack,
    [
      "      // The authoring-only addend affects the original SH texture and nothing upstream of its writing.",
      "      const displayed = diagnosticSolar ? coefficients.map((value, k) => value + diagnosticSolar[p * 12 + k]) : coefficients;",
      pack.replace("...coefficients.", "...displayed."),
    ].join("\n")
  );
  return replaceOnce(
    text,
    "  const api = { addRoot, bake, exportSnapshot, restoreSnapshot,",
    "  const api = { setDiagnosticSolar, addRoot, bake, exportSnapshot, restoreSnapshot,"
  );
}

function patchController(text) {
  const at = "    container.labScene.exportStaticLightSnapshot = (signature) => staticLightField?.exportSnapshot({ signature });";
  return replaceOnce(
    text,
    at,
    [
      "    container.labScene.setR2Light = (delta) => {",
      "      staticLightField.setDiagnosticSolar(delta);",
      "      requestFrame();",
      "      return frames;",
      "    };",
      "    container.labScene.setR2Clock = (minute) => {",
      "      explore.setTime(minute);",
      "      followClock = false;",
      "      updateRoutine(true);",
      "      requestFrame();",
      "      return frames;",
      "    };",
      "    container.labScene.r2Status = () => ({",
      "      frames, elapsed, ready: compositionReady, reduced, paused, style, room: currentRoom,",
      "      minute: routine?.minute, date: routine?.dateKey, live: routine?.live, activity: routine?.id,",
      "      camera: camera.position.toArray(), rotation: camera.quaternion.toArray(), fov: camera.fov,",
      "      aspect: camera.aspect, canvas: [renderer.domElement.width, renderer.domElement.height],",
      "      walk: walkMode?.pose(), walkEvidence: walkMode?.evidence(),",
      "      direct: sun.color.toArray().map(v => v * sun.intensity), sun: sunDirection.toArray(),",
      "      weather: atmosphere?.state?.weather?.source, sky: pacific?.lightColors(),",
      "      lamps: [...(warmPracticals?.lights || []).map(l => l.intensity), ...(lightInstallations?.indirectPowers() || [])],",
      "      exposure: renderer.toneMappingExposure, meter: interiorExposure.evidence(),",
      "      cache: lightCache.state, fieldReady: staticLightField?.evidence().ready,",
      "    });",
      at,
    ].join("\n")
  );
}

function deltas(caseRow) {
  const values = Buffer.from(caseRow.coefficients.base64, "base64");
  assert.equal(values.length, caseRow.coefficients.count * 8);
  assert.equal(sha(values), caseRow.coefficients.sha256);
  return Array.from({ length: caseRow.coefficients.count }, (_, i) => values.readDoubleLE(i * 8));
}

function almost(a, b, tolerance = 1e-8) {
  return Array.isArray(a) ? a.length === b.length && a.every((x, i) => almost(x, b[i], tolerance)) : Math.abs(a - b) <= tolerance;
}

async function run() {
  const ctx = await loadRelease(cli);
  const { chromium } = require(path.join(ctx.checkout, "node_modules", "playwright"));
  const data = JSON.parse(await fs.readFile(path.join(ctx.out, "R2-DELTAS.json"), "utf8"));
  assert.equal(data.revision, ctx.revision);
  assert.equal(data.signature, ctx.signature);
  assert.equal(data.cache, ctx.snapshotHash);
  const files = {};
  for (const [name, patcher] of [
    [collectorPath, patchField],
    [controllerPath, patchController],
  ]) {
    const body = await fs.readFile(path.join(ctx.pinned, name));
    assert.equal(signedDigest(name, body), ctx.inputs.dependencies[name]);
    files[name] = patcher(body.toString("utf8"));
  }
  for (const shot of data.cases) assert(deltas(shot).every(Number.isFinite));

  const report = {
    source: ctx.revision,
    signature: ctx.signature,
    cache: ctx.snapshotHash,
    date: data.date,
    base: base.href,
    normalShader: Object.fromEntries(Object.keys(files).map((k) => [k, ctx.inputs.dependencies[k]])),
    diagnosticModules: Object.fromEntries(Object.entries(files).map(([k, content]) => [k, sha(content)])),
    shadowMetres: data.shadowLimitMetres,
    primaryRays: data.primaryRays,
    arraySources: data.arrays,
    cases: [],
    errors: [],
  };
  if (cli.tail.includes("--dry")) {
    for (const [name, body] of Object.entries(files)) {
      await fs.writeFile(path.join(ctx.out, "diagnostic-" + path.basename(name)), body);
    }
    console.log(JSON.stringify(report));
    return;
  }

  const browser = await chromium.launch({
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      timezoneId: "America/Los_Angeles",
    });
    page.setDefaultTimeout(30000);
    await page.clock.setFixedTime(new Date(data.date + "T14:15:00-08:00"));
    await page.route("**/livereload.js*", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
    page.on("pageerror", (error) => report.errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error" && /shader|WebGL|physical light|cached light/i.test(msg.text())) report.errors.push(msg.text());
    });
    const assetReads = (report.assetReads = {});
    await page.route("**/assets/**", async (route) => {
      const u = new URL(route.request().url());
      if (u.origin !== base.origin || !u.pathname.startsWith(base.pathname)) return route.continue();
      const relative = decodeURIComponent(u.pathname).slice(base.pathname.length);
      try {
        const expected = ctx.inputs.dependencies[relative];
        const sceneSource = relative.startsWith("assets/js/home-scene/") || relative === "assets/js/home.js";
        const sceneModel = relative.startsWith(modelPrefix);
        if (!sceneSource && !sceneModel && !expected) return route.continue();
        if (files[relative]) return route.fulfill({ contentType: "text/javascript", body: files[relative] });
        const root = relative.startsWith("assets/js/") || relative === manifestPath || relative === fieldPath ? ctx.pinned : ctx.checkout;
        const filepath = path.resolve(root, relative);
        assert(filepath.startsWith(path.resolve(root, "assets") + path.sep));
        let bytes;
        // Non-inventory model or texture inputs read directly from the same immutable revision.
        if (sceneModel && !expected && relative !== manifestPath && relative !== fieldPath) {
          try {
            bytes = ctx.immutableBlob(relative);
          } catch {
            return route.continue();
          }
        } else {
          bytes = await fs.readFile(filepath).catch((error) => {
            if (error.code !== "ENOENT") throw error;
            return ctx.immutableBlob(relative);
          });
        }
        if (expected && signedDigest(relative, bytes) !== expected) bytes = ctx.immutableBlob(relative);
        if (expected) assert.equal(signedDigest(relative, bytes), expected, relative);
        if (relative === fieldPath) assert.equal(sha(bytes), ctx.snapshotHash);
        if (relative === manifestPath) assert.equal(sha(bytes), ctx.manifestHash);
        assetReads[relative] = sha(bytes);
        const contentType = /\.(mjs|js)$/.test(relative)
          ? "text/javascript"
          : relative.endsWith(".json")
            ? "application/json"
            : relative.endsWith(".glb")
              ? "model/gltf-binary"
              : relative.endsWith(".wasm")
                ? "application/wasm"
                : undefined;
        return route.fulfill({ ...(contentType ? { contentType } : {}), body: bytes });
      } catch (error) {
        report.errors.push(error.message);
        return route.abort().catch(() => {});
      }
    });
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    await page.locator(host).scrollIntoViewIfNeeded();
    const wait = (fn, arg, timeout = 35000) => page.waitForFunction(fn, arg, { timeout, polling: 120 });
    const ready = await wait(
      (h) => {
        const el = document.querySelector(h);
        const s = el?.labScene?.r2Status?.();
        return s?.ready && s?.fieldReady && s?.cache === "restored" && s.style === "realistic";
      },
      host,
      160000
    );
    await ready.dispose();
    const scene = page.locator(host);
    await scene.evaluate((el) => el.labScene.setTemporalEnabled(false));
    await page.locator("[data-world-fullscreen]").click();
    await wait((h) => document.querySelector(h)?.getSceneEvidence?.()?.fullscreen, host);
    await page.evaluate(() => document.querySelector("[data-world-walk]").click());
    await wait(
      (h) => {
        const s = document.querySelector(h)?.labScene?.r2Status?.();
        return s?.walk?.active && s?.walkEvidence?.ready;
      },
      host,
      100000
    );
    console.log("pinned signed field restored, ordinary first-person camera admitted");

    const get = () => scene.evaluate((el) => el.labScene.r2Status());
    const frameAfter = async (frames) => {
      const value = await wait(
        ({ h, f }) => {
          const s = document.querySelector(h)?.labScene?.r2Status?.();
          return s && s.frames > f;
        },
        { h: host, f: frames }
      );
      await value.dispose();
    };
    for (const shot of data.cases) {
      const initial = await scene.evaluate(
        (el, p) => {
          el.labScene.setR2Light(null);
          el.labScene.setR2Clock(p.minute);
          const admitted = el.setLabWalk({ position: p.body, yaw: p.yaw, pitch: p.pitch });
          return { admitted, frames: el.labScene.r2Status().frames };
        },
        { minute: shot.minute, body: shot.body, yaw: shot.yaw, pitch: shot.pitch }
      );
      assert(initial.admitted, shot.id + " has no supported walk pose");
      await frameAfter(initial.frames);
      const lens = await scene.evaluate((el, target) => {
        const state = el.labScene.r2Status();
        const deltaY = Math.log(target / state.fov) / 0.0012;
        el.querySelector("canvas.home-desk-corner-canvas").dispatchEvent(
          new WheelEvent("wheel", { deltaY, deltaMode: 0, bubbles: true, cancelable: true })
        );
        return state.frames;
      }, shot.fov);
      await frameAfter(lens);
      const a = await get();
      assert(almost(a.fov, shot.fov, 1e-5), JSON.stringify({ id: shot.id, lens: a.fov, wanted: shot.fov }));
      assert(a.walk.active && a.walk.grounded);
      assert.equal(a.minute, shot.minute);
      assert.equal(a.date, data.date);
      assert(a.reduced && !a.live);
      assert(
        Math.hypot(a.camera[0] - shot.eye[0], a.camera[1] - shot.eye[1], a.camera[2] - shot.eye[2]) < 0.22,
        JSON.stringify({ id: shot.id, actual: a.camera, expected: shot.eye })
      );
      assert(
        almost(a.sun, shot.sun.direction, 2e-6) && almost(a.direct, shot.sun.sunColor, 2e-6),
        JSON.stringify({ id: shot.id, a, expected: shot.sun })
      );
      const left = await page.locator(canvas).screenshot({ path: path.join(ctx.out, shot.id + "-control.png"), style: hide });
      const withSolar = await scene.evaluate((el, coefficients) => el.labScene.setR2Light(coefficients), deltas(shot));
      await frameAfter(withSolar);
      const b = await get();
      for (const key of ["camera", "rotation", "sun", "direct", "lamps", "canvas"]) assert(almost(a[key], b[key]), shot.id + " mismatched " + key);
      assert.deepEqual(a.sky, b.sky);
      assert.equal(a.exposure, b.exposure);
      assert.deepEqual(a.meter, b.meter);
      for (const key of ["elapsed", "minute", "date", "room", "fov", "activity", "cache", "weather"])
        assert.equal(a[key], b[key], shot.id + " mismatched " + key);
      const right = await page.locator(canvas).screenshot({ path: path.join(ctx.out, shot.id + "-solar.png"), style: hide });
      const undo = await scene.evaluate((el) => el.labScene.setR2Light(null));
      await frameAfter(undo);
      const reset = await page.locator(canvas).screenshot({ path: path.join(ctx.out, shot.id + "-control-repeat.png"), style: hide });
      report.cases.push({
        id: shot.id,
        time: shot.time,
        a,
        b,
        control: sha(left),
        solar: sha(right),
        repeatedControl: sha(reset),
        coefficients: shot.coefficients.sha256,
        postUndoExactPng: sha(left) === sha(reset),
        imageChanged: sha(left) !== sha(right),
      });
      console.log(
        shot.id,
        shot.time,
        "eye",
        a.camera.map((v) => v.toFixed(3)),
        "exposure",
        a.exposure,
        "repeated control exact",
        sha(left) === sha(reset)
      );
    }
    assert.deepEqual(report.errors, []);
    report.passed = true;
  } catch (error) {
    report.failure = error.stack;
    throw error;
  } finally {
    await browser.close();
    await fs.writeFile(path.join(ctx.out, "AB-RECEIPT.json"), JSON.stringify(report, null, 2) + "\n");
  }
}

run().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
