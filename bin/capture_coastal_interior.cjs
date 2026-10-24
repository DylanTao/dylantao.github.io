// Matched before/after captures of the coastal home's interior areas (the 2026-10-20 interior pass).
//
//   node bin/capture_coastal_interior.cjs <out-dir> <area[,area...]> [embed|fullscreen|both]
//
// Areas: kitchen, nook, dining, living, entrance, top, gym, pool, outside-day, outside-night. Each area
// is one or more shots: a room visit at a fixed time, optionally an activity preview and a lab camera
// (setLabCamera, three.js target/yaw/pitch/radius). "embed" captures the page's own scene canvas at a
// 1440x1000 viewport; "fullscreen" enters full screen at 2560x1440 with device scale 1.5 (a 3840x2160
// screen) and captures the page.
//
// The scene's modules (assets/js) and models (assets/models/home) come from this working tree, or with
// COAST_REF=<rev> from that revision, so "before" and "after" share one server and never wait for a
// Jekyll rebuild. Stills use reduced motion, a fixed Date and seeded randomness. COAST_BASE_URL picks
// the server (default http://127.0.0.1:4154/). Run from PowerShell.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const outDir = path.resolve(process.argv[2] || ".jekyll-cache/visual-qa/scene-interior/current");
const areas = (process.argv[3] || "kitchen").split(",");
const modes = (process.argv[4] || "both") === "both" ? ["embed", "fullscreen"] : [process.argv[4]];
const baseURL = (process.env.COAST_BASE_URL || "http://127.0.0.1:4154/").replace(/\/?$/, "/");
const ref = process.env.COAST_REF || null;

// Times are Pacific on a Friday (manifest weekday: breakfast 11:30, work 14:30, workout 18:00, dinner
// 20:30, lounge 21:30); `camera` is a lab camera in three.js coordinates.
const SHOTS = {
  kitchen: [{ name: "kitchen", room: "kitchen", time: "2026-10-02T12:10:00-07:00" }],
  "kitchen-camera": [
    {
      name: "kitchen-camera",
      room: "kitchen",
      time: "2026-10-02T12:10:00-07:00",
      camera: { target: [-3.85, 0.5, -3], yaw: 1.96, pitch: 0.38, radius: 3.2 },
    },
  ],
  nook: [
    { name: "nook", room: "kitchen", time: "2026-10-02T12:10:00-07:00", camera: { target: [-3.95, 0.2, -3.3], yaw: 1.9, pitch: 0.42, radius: 3.2 } },
  ],
  dining: [
    {
      name: "dining",
      room: "kitchen",
      time: "2026-10-02T20:45:00-07:00",
      camera: { target: [-1.85, 0.75, 3.05], yaw: 0.95, pitch: 0.32, radius: 4.4 },
    },
  ],
  bay: [
    {
      name: "cooking-bay",
      room: "kitchen",
      time: "2026-10-02T20:45:00-07:00",
      camera: { target: [-4.2, 1.3, 2.4], yaw: 1.25, pitch: 0.12, radius: 2.6 },
    },
  ],
  living: [{ name: "living", room: "lounge", time: "2026-10-02T22:00:00-07:00" }],
  gym: [{ name: "gym", room: "gym", time: "2026-10-02T18:30:00-07:00" }],
  study: [{ name: "study", room: "study", time: "2026-10-02T15:20:00-07:00" }],
  overview: [{ name: "overview", room: "overview", time: "2026-10-02T13:20:00-07:00" }],
  entrance: [
    {
      name: "entrance",
      room: "overview",
      time: "2026-10-02T13:20:00-07:00",
      camera: { target: [3.42, 7.7, 17.0], yaw: 0.7, pitch: 0.48, radius: 7.8 },
    },
  ],
  foyer: [
    { name: "foyer", room: "overview", time: "2026-10-02T13:20:00-07:00", camera: { target: [3.42, 3.3, 8.4], yaw: 0, pitch: 0.52, radius: 3.0 } },
  ],
  top: [
    {
      name: "house-top",
      room: "outside",
      time: "2026-10-02T13:20:00-07:00",
      camera: { target: [1.2, 5.0, 5.0], yaw: 0.75, pitch: 0.65, radius: 24 },
    },
  ],
  pool: [
    {
      name: "infinity-pool",
      room: "overview",
      time: "2026-10-02T13:20:00-07:00",
      camera: { target: [-0.95, -0.2, -8.7], yaw: 0.75, pitch: 0.4, radius: 8.5 },
    },
  ],
  "outside-day": [{ name: "outside-day", room: "outside", time: "2026-10-02T13:20:00-07:00" }],
  "outside-night": [{ name: "outside-night", room: "outside", time: "2026-10-02T21:30:00-07:00" }],
};
const TYPES = {
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".json": "application/json",
};

function fromSource(rel) {
  if (ref) {
    try {
      return execFileSync("git", ["show", `${ref}:${rel}`], { cwd: ROOT, maxBuffer: 256 << 20, stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return null;
    }
  }
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

function seedPage(initial) {
  let state = initial >>> 0;
  Math.random = () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function fixDate(time) {
  const NativeDate = Date,
    fixed = NativeDate.parse(time);
  window.Date = new Proxy(NativeDate, {
    apply: () => new NativeDate(fixed).toString(),
    construct: (target, args) => Reflect.construct(target, args.length ? args : [fixed]),
    get: (target, key) => (key === "now" ? () => fixed : Reflect.get(target, key)),
  });
}

async function capture(shot, mode) {
  const manifest = JSON.parse(fromSource("assets/models/home/manifest.json"));
  const setback = Number(manifest.retreat?.setbackMetres) || 0;
  // Fixed inspection cameras follow the same architectural bay when the house moves inland.
  // Outside views retain the coast's world frame; authored room cameras come from the manifest.
  if (shot.camera && setback)
    shot = { ...shot, camera: { ...shot.camera, target: shot.camera.target.map((v, axis) => v + (axis === 2 ? setback : 0)) } };
  const fullscreen = mode === "fullscreen";
  const browser = await chromium.launch({
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  const context = await browser.newContext({
    viewport: process.env.COAST_VIEWPORT
      ? Object.fromEntries(process.env.COAST_VIEWPORT.split("x").map((v, i) => [i ? "height" : "width", Number(v)]))
      : fullscreen
        ? { width: 2560, height: 1440 }
        : { width: 1440, height: 1000 },
    deviceScaleFactor: process.env.COAST_DPR ? Number(process.env.COAST_DPR) : fullscreen ? 1.5 : 1,
    timezoneId: "America/Los_Angeles",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(240000);
  const errors = [];
  const servedModels = new Map();
  page.on("pageerror", (error) => errors.push(String(error.stack || error)));
  page.on("console", (message) => {
    if (message.type() === "error" && /THREE|WebGL|shader|infinity|home-scene/i.test(message.text())) errors.push(message.text());
  });
  await page.route(/https:\/\/(?:plausible\.io|www\.google-analytics\.com|www\.googletagmanager\.com)\//, (route) =>
    route.fulfill({ status: 200, body: "" })
  );
  await page.route("**/livereload.js*", (route) => route.fulfill({ status: 200, body: "", contentType: "text/javascript" }));
  await page.route(/\/assets\/(js\/.+\.m?js|models\/home\/.+\.(glb|json))(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const rel = decodeURIComponent(url.pathname).replace(/^.*?(?=assets\/)/, "");
    const body = fromSource(rel);
    if (!body) return route.continue();
    if (rel.startsWith("assets/models/"))
      servedModels.set(rel, {
        file: rel,
        bytes: body.length,
        sha256: createHash("sha256").update(body).digest("hex"),
        source: ref || "working-tree",
      });
    return route.fulfill({ status: 200, body, contentType: TYPES[path.extname(rel)] || "application/octet-stream" });
  });
  await page.addInitScript(seedPage, 7);
  await page.addInitScript(fixDate, shot.time);
  await page.addInitScript(
    (night) => {
      sessionStorage.setItem("theme", night ? "evening" : "noon");
      sessionStorage.setItem("theme-manual", "true");
    },
    Number(shot.time.slice(11, 13)) >= 19
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  const url = new URL(baseURL);
  url.searchParams.set("scene-lab", "1");
  if (process.env.COAST_WEATHER) url.searchParams.set("weather", process.env.COAST_WEATHER);
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  const host = page.locator("[data-home-desk-scene]");
  await page.locator('[data-home-desk-mode="3d"]').click();
  await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 240000 });
  await host.scrollIntoViewIfNeeded();
  if (fullscreen) {
    await page.locator("[data-world-fullscreen]").click();
    await page.waitForFunction(() => Boolean(document.querySelector("[data-home-desk-scene]").getSceneEvidence().fullscreen));
  }
  await page.waitForFunction(
    () => {
      const e = document.querySelector("[data-home-desk-scene]").getSceneEvidence();
      return e.roomCount >= 6 && (e.simulation?.lightField?.ready || e.simulation?.lightField?.error);
    },
    null,
    { timeout: 300000 }
  );
  await page.evaluate((room) => {
    const lab = document.querySelector("[data-world-lab]");
    if (lab) lab.open = true;
    document.querySelector(`[data-world-room="${room}"]`).click();
    if (lab) lab.open = false;
  }, shot.room);
  await page.waitForFunction((room) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().currentRoom === room, shot.room);
  if (shot.camera) await host.evaluate((e, camera) => e.setLabCamera(camera), shot.camera);
  const cameraSweep = [];
  if (process.env.COAST_CAMERA_SWEEP) {
    const candidates = JSON.parse(fs.readFileSync(process.env.COAST_CAMERA_SWEEP, "utf8"));
    for (const candidate of candidates) {
      if (!/^[a-z0-9-]+$/.test(candidate.name)) throw new Error("Camera inspection names must be simple filename segments");
      await host.evaluate((e, camera) => e.setLabCamera({ ...camera, free: false }), candidate.camera);
      await page.waitForTimeout(1200);
      const file = path.join(outDir, `${shot.name}-${mode}-${candidate.name}.png`);
      await host.screenshot({ path: file, timeout: 120000 });
      const state = await host.evaluate((e) => e.getSceneEvidence());
      cameraSweep.push({ name: candidate.name, requested: candidate.camera, camera: state.camera, target: state.target, arm: state.cameraArm, file });
    }
  }
  await page.waitForTimeout(2500);
  const frames = await host.evaluate((e) => e.getSceneEvidence().frames);
  await page.mouse.move(2, 2);
  await page.waitForFunction((f) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().frames >= f, frames, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const file = path.join(outDir, `${shot.name}-${mode}.png`);
  if (fullscreen) await page.screenshot({ path: file, timeout: 120000 });
  else await host.screenshot({ path: file, timeout: 120000 });
  const evidence = await host.evaluate((e) => {
    const x = e.getSceneEvidence();
    return {
      room: x.currentRoom,
      activity: x.activity,
      camera: x.camera,
      target: x.target,
      canvas: [x.canvasWidth, x.canvasHeight],
      drawCalls: x.drawCalls,
      triangles: x.triangles,
      infinityPool: x.simulation?.infinityPool,
      weather: x.ecology?.atmosphere?.weather,
      rain: x.simulation?.rain,
      curtains: x.simulation?.curtains,
      ladder: x.simulation?.libraryLadder,
      windPlants: x.simulation?.wind?.plants,
      installations: x.simulation?.installations,
      cameraArm: x.cameraArm,
      cameraOrbit: x.cameraOrbit,
      loading: x.loading,
    };
  });
  const observedModels = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((r) => /\/assets\/models\//.test(r.name))
      .map((r) => ({ file: new URL(r.name).pathname.replace(/^.*?(?=assets\/)/, ""), bytes: r.decodedBodySize || r.encodedBodySize || 0 }))
  );
  // Fulfilled Playwright responses often report zero resource size. Use their actual source
  // bodies, not that zero, when accounting for the complete loaded scene.
  const models = [...new Map([...observedModels.map((model) => [model.file, model]), ...servedModels]).values()];
  let interaction = null;
  if (process.env.COAST_INTERACTION_PROBE === "1" && fullscreen) {
    const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
    const before = hash(await host.screenshot()),
      rect = await host.boundingBox();
    const x = rect.x + rect.width * 0.5,
      y = rect.y + rect.height * 0.45;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 70, y + 18, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const drag = hash(await host.screenshot({ path: path.join(outDir, `${shot.name}-${mode}-drag.png`) }));
    await page.mouse.wheel(0, -260);
    await page.waitForTimeout(450);
    const zoom = hash(await host.screenshot({ path: path.join(outDir, `${shot.name}-${mode}-zoom.png`) }));
    interaction = { before, drag, zoom, dragChanged: before !== drag, zoomChanged: drag !== zoom };
    if (!interaction.dragChanged || !interaction.zoomChanged) throw new Error(`Scene movement did not change pixels: ${JSON.stringify(interaction)}`);
  }
  let walk = null;
  if (process.env.COAST_WALK_PROBE === "1" && fullscreen) {
    await page.locator("[data-world-walk]").click();
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence().walk?.ready, null, { timeout: 90000 });
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/home/manifest.json"), "utf8"));
    walk = await host.evaluate((host, config) => {
      const stair = [4, 11, 19, 27, 35].map((i) => {
        const position = config.entrance.route[i];
        const placed = host.setLabWalk({ position, yaw: Math.PI, pitch: 0 });
        const actual = host.getSceneEvidence().walk.position;
        return { requested: position, placed, actual, error: Math.hypot(...actual.map((v, k) => v - position[k])) };
      });
      const pool = config.infinityPool.center;
      const waterBlocked = !host.setLabWalk({ position: [pool[0], 0, pool[2]], yaw: 0, pitch: 0 });
      return { stair, waterBlocked, field: host.getSceneEvidence().walk.field };
    }, config);
    if (walk.stair.some((p) => !p.placed || p.error > 0.18) || !walk.waterBlocked)
      throw new Error(`Walk contact probe failed: ${JSON.stringify(walk)}`);
    await page.locator("[data-world-walk]").click();
  }
  await browser.close();
  return {
    shot: shot.name,
    mode,
    file,
    inspectionCamera: shot.camera || null,
    cameraSweep,
    setback,
    evidence,
    errors,
    walk,
    interaction,
    modelBytes: models.reduce((s, m) => s + m.bytes, 0),
    models,
  };
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const report = { ref, baseURL, areas, modes, captured: new Date().toISOString(), shots: [] };
  for (const area of areas)
    for (const shot of SHOTS[area] || [])
      for (const mode of modes) {
        const result = await capture(process.env.COAST_DATE ? { ...shot, time: process.env.COAST_DATE } : shot, mode);
        report.shots.push(result);
        console.log(result.file, result.errors.length ? `errors: ${result.errors.length}` : "ok");
      }
  fs.writeFileSync(path.join(outDir, "captures.json"), JSON.stringify(report, null, 2) + "\n");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
