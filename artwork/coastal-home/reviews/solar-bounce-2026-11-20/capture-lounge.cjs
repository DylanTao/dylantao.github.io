"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { createHash } = require("node:crypto");
const path = require("node:path");
const sha = (data) => createHash("sha256").update(data).digest("hex");
const [workspace, output, baseUrl, mode] = process.argv.slice(2);
assert(workspace && output && baseUrl, "node capture-lounge.cjs CHECKOUT OUTPUT ROOT_PREVIEW_URL [--dry]");
const { chromium } = require(path.resolve(workspace, "node_modules/playwright"));
const host = "[data-home-desk-scene]",
  canvas = host + " canvas.home-desk-corner-canvas";
const hide = "[data-home-world-controls],[data-world-immersive-bar],.home-world-hint,.home-walk-chrome{visibility:hidden!important}";
const base = new URL(baseUrl);
const file = (...p) => path.join(workspace, ...p);
const report = { base: base.href, viewport: [1440, 900], browser: "Chromium, headless", errors: [], optional: [], images: {} };
const write = (leaf, data) => fs.writeFile(path.join(output, leaf), data);
const readJson = async (where) => JSON.parse(await fs.readFile(where, "utf8"));
const reference = {
  body: [2.09, 0.002618, 4.44],
  eye: [2.09, 1.602618, 4.44],
  yaw: 0.2098283117596555,
  pitch: -0.3605375057990109,
  fov: 49,
  minute: 855,
};
async function run() {
  const transport = await fs.readFile(file("assets/models/home/lounge-solar.json"));
  const manifest = await readJson(file("assets/models/home/manifest.json"));
  const descriptor = manifest.staticLightFieldCache;
  const snapshot = await fs.readFile(file("assets/models/home/static-light-field.json"));
  assert.equal(sha(snapshot), descriptor.sha256, "Use the authored signed snapshot");
  assert.equal(sha(transport), descriptor.loungeSolarSha256, "Use the published lounge table");
  assert.equal(JSON.parse(transport).geometryFingerprint, descriptor.loungeSolarGeometry);
  assert.equal(JSON.parse(snapshot).loungeSolarGeometry, descriptor.loungeSolarGeometry);
  report.manifest = descriptor;
  report.reference = reference;
  const source = await fs.readFile(file("assets/js/home-scene/controller.mjs"), "utf8");
  let instrumented = source;
  function insert(at, custom) {
    assert.equal(instrumented.split(at).length, 2, at);
    instrumented = instrumented.replace(at, custom + "\n" + at);
  }
  insert("        if (!disposed && staticLightField.setLoungeSolar(sample)) requestFrame();", "        globalThis.__observedLoungeSolar = sample;");
  insert(
    "    container.labScene.exportStaticLightSnapshot = (signature) => staticLightField?.exportSnapshot({ signature });",
    [
      "    container.labScene.loungeProbe = () => ({ frames, currentRoom, pixels: [renderer.domElement.width, renderer.domElement.height],",
      "      date: routine.dateKey, minute: routine.minute, cache: lightCache.state, loaded: staticLightField?.evidence().loungeSolar,",
      "      sample: staticLightField.sample([2.93,.57,5.24],[1,0,0]), otherRoom: staticLightField.sample([.3,1,6.5],[1,0,0]),",
      "      camera: camera.position.toArray(), rotation: camera.quaternion.toArray(), fov:camera.fov, walk: walkMode?.pose(), walkEvidence:walkMode?.evidence(),",
      "      weather: atmosphere?.state?.weather?.source, sky: pacific?.lightColors(), sun: sunDirection.toArray(),",
      "      direct: sun.color.toArray().map(v=>v*sun.intensity), lamps: [...warmPracticals.lights.map(l=>l.intensity),...lightInstallations.indirectPowers()],",
      "      elapsed, exposure:renderer.toneMappingExposure, meter: interiorExposure.evidence(),",
      "    });",
      "    container.labScene.toggleLoungeSolar = (enabled) => { staticLightField.setLoungeSolar(enabled ? globalThis.__observedLoungeSolar : null); requestFrame(); return frames; };",
      "    container.labScene.loungeClock = (minute) => { explore.setTime(minute); followClock=false; updateRoutine(true); requestFrame(); return frames; };",
    ].join("\n")
  );
  report.controller = { source: sha(source), instrumented: sha(instrumented) };
  if (mode === "--dry") {
    console.log(JSON.stringify(report));
    return;
  }
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  let page;
  try {
    page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      timezoneId: "America/Los_Angeles",
    });
    page.setDefaultTimeout(30000);
    await page.clock.setFixedTime(new Date("2026-11-20T14:15:00-08:00"));
    page.on("pageerror", (err) => report.errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error" && /shader|webgl|lighting cache/i.test(msg.text())) report.errors.push(msg.text());
    });
    page.on("request", (req) => {
      const u = new URL(req.url());
      if (/lounge-solar\.(mjs|json)$/.test(u.pathname)) report.optional.push({ file: u.pathname, phase: report.phase, time: performance.now() });
    });

    await page.route("**/assets/js/home-scene/controller.mjs*", (r) => r.fulfill({ contentType: "text/javascript", body: instrumented }));
    const wait = async (fn, arg, timeout = 45000) => {
      const ref = await page.waitForFunction(fn, arg, { timeout, polling: 120 });
      await ref.dispose();
    };
    report.phase = "startup";
    await page.goto(new URL("?scene-lab=1", base).href, { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const el = page.locator(host);
    await el.scrollIntoViewIfNeeded();
    await wait(
      (h) => {
        const el = document.querySelector(h);
        const e = el?.getSceneEvidence?.();
        return el?.dataset.sceneState === "ready" && e?.simulation?.lightField?.ready;
      },
      host,
      135000
    );
    assert.equal(report.optional.length, 0, JSON.stringify(report.optional));
    report.phase = "visit";
    const get = () => el.evaluate((node) => node.labScene.loungeProbe());
    const initial = await get();
    assert.equal(initial.cache, "restored");
    await el.evaluate((node) => node.labScene.setTemporalEnabled(false));
    await page.locator("[data-world-fullscreen]").click();
    await wait((h) => document.querySelector(h)?.getSceneEvidence?.()?.fullscreen, host);
    await page.locator("[data-world-places] summary").click();
    await page.locator('[data-world-destination="lounge"]').click();
    await page.locator("[data-world-walk]").click();
    await wait(
      (h) => {
        const e = document.querySelector(h)?.labScene?.loungeProbe();
        return e?.walk?.active && e?.walkEvidence?.ready;
      },
      host,
      90000
    );
    const nextFrame = (f) => wait(({ h, f }) => document.querySelector(h)?.labScene?.loungeProbe()?.frames > f, { h: host, f });
    const admitted = await el.evaluate(
      (node, ref) => {
        node.labScene.loungeClock(ref.minute);
        const accepted = node.setLabWalk({ position: ref.body, yaw: ref.yaw, pitch: ref.pitch });
        return { accepted, frames: node.labScene.loungeProbe().frames };
      },
      { minute: reference.minute, body: reference.body, yaw: reference.yaw, pitch: reference.pitch }
    );
    assert(admitted.accepted);
    await nextFrame(admitted.frames);
    await wait((h) => document.querySelector(h)?.labScene?.loungeProbe()?.loaded, host, 18000);
    const lens = await el.evaluate((node, target) => {
      const p = node.labScene.loungeProbe();
      node.querySelector("canvas.home-desk-corner-canvas").dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: Math.log(target / p.fov) / 0.0012,
          deltaMode: 0,
          bubbles: true,
          cancelable: true,
        })
      );
      return p.frames;
    }, reference.fov);
    await nextFrame(lens);
    const control = async (name, enabled) => {
      await nextFrame(await el.evaluate((node, enabled) => node.labScene.toggleLoungeSolar(enabled), enabled));
      const state = await get();
      assert.equal(state.loaded, enabled);
      assert(state.walk.active && state.walk.grounded);
      assert(Math.abs(state.fov - reference.fov) < 1e-5);
      assert(Math.hypot(...state.camera.map((value, i) => value - reference.eye[i])) < 0.23);
      const png = await page.locator(canvas).screenshot({ path: path.join(output, name + ".png"), style: hide });
      report.images[name] = { sha256: sha(png), state };
      return state;
    };
    // Streamed finishes and camera-dependent reflection captures can settle after the first walk
    // frame. Accept only a complete A/B/A triplet whose two control images are identical.
    const controlHashes = [];
    let a, b, a2;
    do {
      a = await control("lounge-control", false);
      b = await control("lounge-reflected-sun", true);
      a2 = await control("lounge-control-repeat", false);
      controlHashes.push([report.images["lounge-control"].sha256, report.images["lounge-control-repeat"].sha256]);
    } while (controlHashes.at(-1)[0] !== controlHashes.at(-1)[1] && controlHashes.length < 4);
    report.controlHashes = controlHashes;
    for (const key of [
      "camera",
      "rotation",
      "fov",
      "pixels",
      "sun",
      "direct",
      "sky",
      "lamps",
      "otherRoom",
      "meter",
      "exposure",
      "weather",
      "minute",
      "date",
      "elapsed",
    ]) {
      assert.deepEqual(a[key], b[key], "Mismatched " + key);
      assert.deepEqual(a2[key], b[key], "Mismatched repeat " + key);
    }
    assert.equal(a.currentRoom, "lounge");
    assert.equal(a.minute, 855);
    assert.equal(report.images["lounge-control"].sha256, report.images["lounge-control-repeat"].sha256);
    assert.notEqual(report.images["lounge-control"].sha256, report.images["lounge-reflected-sun"].sha256);
    assert.deepEqual([...new Set(report.optional.map(({ file }) => file.split("/").at(-1)))], ["lounge-solar.mjs", "lounge-solar.json"]);
    assert(a.sample.irradiance.some((x, i) => b.sample.irradiance[i] > x));
    await nextFrame(await el.evaluate((node) => node.labScene.loungeClock(1260)));
    const nightA = await get();
    await nextFrame(await el.evaluate((node) => node.labScene.toggleLoungeSolar(true)));
    const nightB = await get();
    assert.equal(nightA.minute, 1260);
    assert.equal(nightB.minute, 1260);
    assert.deepEqual(nightA.sample, nightB.sample);
    assert.deepEqual(nightA.otherRoom, nightB.otherRoom);
    report.nightCheck = { minute: 1260, unchangedLounge: nightB.sample, otherRoom: nightB.otherRoom };
    assert.deepEqual(report.errors, []);
    report.passed = true;
  } catch (err) {
    report.failure = err.stack;
    report.end = await page
      ?.evaluate((h) => {
        const e = document.querySelector(h),
          out = e?.getSceneEvidence?.();
        return {
          content: e?.dataset.sceneState,
          phase: out?.loading?.stage,
          payload: out?.loading?.lightCache,
          fields: out?.simulation?.lightField?.error,
          walk: out?.walk?.ready,
        };
      }, host)
      .catch(() => null);
    throw err;
  } finally {
    await browser.close();
    await write("BROWSER.json", JSON.stringify(report, null, 2) + "\n");
  }
  console.log(
    JSON.stringify({
      done: true,
      optional: report.optional,
      images: Object.fromEntries(Object.entries(report.images).map(([name, { sha256 }]) => [name, sha256])),
    })
  );
}
run().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
