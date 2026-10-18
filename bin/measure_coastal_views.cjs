// Interleaved A/B frame-cost probe for the coastal home's main views: the occupied study, the
// outside view, and the 160 m coast with the hinterland and planting loaded. Local headless
// measurements on this host's GPU, not a phone or another graphics card.
//
// PowerShell (Bash env prefixes break npx/node paths on this machine):
//   $env:COASTAL_VIEWS_URL = "http://127.0.0.1:4136/al-folio/"
//   node bin/measure_coastal_views.cjs .jekyll-cache/visual-qa/coastal-views.json
// A/B: $env:COASTAL_VIEWS_AB = "HEAD" serves every scene file that differs from HEAD twice: the
// committed version as variant "base" and the working tree as "work", in ABBA order with a fresh
// browser per run (no shader or HTTP cache carries over). Everything else comes from the server.
// COASTAL_VIEWS_EXTRA="name=flags;name=flags" adds working-tree variants with URL flags (for
// instance "no-shadow-cache=shadow-cache=0"), COASTAL_VIEWS_HOLD lists files every working-tree
// variant takes from the base ref, COASTAL_VIEWS_FULLSCREEN=1 enters the home's full-screen mode,
// and COASTAL_VIEWS_TOGGLES (shadowFrozen, noReflection, noHinterland, noFlora) samples each view
// again with one pass removed, which attributes cost without editing the scene.
//
// Each frame is attributed to passes by viewport size (2048x2048 is the sun's shadow map, 384x384
// the sea mirror, the canvas size the beauty and output passes, the contact pass's size its normal
// prepass). GPU time uses EXT_disjoint_timer_query_webgl2 around the whole frame when the browser
// exposes it. Process CPU time comes from SystemInfo.getProcessInfo, so a busy GPU process shows
// up even when the page's own thread is idle (wall time vs CPU time).
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repo = path.resolve(__dirname, "..");
const output = path.resolve(process.argv[2] || ".jekyll-cache/visual-qa/coastal-views.json");
const baseURL = process.env.COASTAL_VIEWS_URL || "http://127.0.0.1:4136/al-folio/";
const runs = Number(process.env.COASTAL_VIEWS_RUNS || 2);
const seconds = Number(process.env.COASTAL_VIEWS_SECONDS || 6);
const views = (process.env.COASTAL_VIEWS_LIST || "study,outside,coast160").split(",").filter(Boolean);
const toggles = (process.env.COASTAL_VIEWS_TOGGLES || "").split(",").filter(Boolean);
const width = Number(process.env.COASTAL_VIEWS_WIDTH || 1440);
const height = Number(process.env.COASTAL_VIEWS_HEIGHT || 1000);
const dpr = Number(process.env.COASTAL_VIEWS_DPR || 1);
const seed = Number(process.env.COASTAL_VIEWS_SEED || 7);
const abRef = process.env.COASTAL_VIEWS_AB || null;
// Uncapped frames emulate a high-refresh display (and show the scene's maximum throughput).
const uncapped = process.env.COASTAL_VIEWS_UNCAPPED === "1";
const reducedMotion = process.env.COASTAL_VIEWS_REDUCED === "1" ? "reduce" : "no-preference";
const fixedTime = process.env.COASTAL_VIEWS_TIME || "2026-10-02T13:20:00-07:00";
const screenshots = process.env.COASTAL_VIEWS_SCREENSHOTS !== "0";
// Enter the home's full-screen mode (the Full screen button, else F on the scene) once it is ready.
const fullViewport = process.env.COASTAL_VIEWS_FULLSCREEN === "1";
// More variants of the working tree, each with extra URL flags: "name=query;name=query", for
// instance "no-cache=shadow-cache=0;material-order=draw-order=material".
const extras = (process.env.COASTAL_VIEWS_EXTRA || "")
  .split(";")
  .filter(Boolean)
  .map((entry) => {
    const at = entry.indexOf("=");
    // "name=flags@file,file" also holds those files at the base ref for this variant alone.
    const [query, hold = ""] = entry.slice(at + 1).split("@");
    return { name: entry.slice(0, at), query, hold: new Set(hold.split(",").filter(Boolean)) };
  });
// Files every working-tree variant still takes from the base ref, to isolate one change.
const held = new Set((process.env.COASTAL_VIEWS_HOLD || "").split(",").filter(Boolean));

const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 << 20 });
const changed = new Set();
if (abRef) {
  for (const line of [
    ...git("diff", "--name-only", abRef, "--", "assets/js").split(/\r?\n/),
    ...git("ls-files", "--others", "--exclude-standard", "--", "assets/js").split(/\r?\n/),
  ])
    if (line.trim()) changed.add(line.trim().replaceAll("\\", "/"));
}
const bodies = new Map();
function variantBody(variant, rel) {
  const key = `${variant}:${rel}`;
  if (!bodies.has(key)) {
    let body = null;
    try {
      body =
        variant !== "base" && !held.has(rel) && !extras.find((extra) => extra.name === variant)?.hold.has(rel)
          ? fs.readFileSync(path.join(repo, rel))
          : execFileSync("git", ["show", `${abRef}:${rel}`], { cwd: repo, maxBuffer: 64 << 20 });
    } catch {
      body = null;
    }
    bodies.set(key, body);
  }
  return bodies.get(key);
}

const quantile = (values, fraction) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] : null;
};
const stats = (values) => ({
  n: values.filter(Number.isFinite).length,
  median: quantile(values, 0.5),
  p90: quantile(values, 0.9),
  p95: quantile(values, 0.95),
  max: quantile(values, 1),
});
const round = (value, digits = 2) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : value);
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

// Runs in the page before any script: long tasks, activation, scene-state transitions, per-frame
// GL call attribution and whole-frame GPU timer queries.
function instrument() {
  const data = (window.__coastalViews = { activation: null, transitions: [], longTasks: [], frames: [], programs: [], gpuTimer: null });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) data.longTasks.push({ start: entry.startTime, duration: entry.duration });
  }).observe({ type: "longtask", buffered: true });
  addEventListener(
    "click",
    (event) => {
      if (event.target.closest?.('[data-home-desk-mode="3d"]') && data.activation === null) data.activation = performance.now();
    },
    true
  );
  addEventListener("DOMContentLoaded", () => {
    const host = document.querySelector("[data-home-desk-scene]");
    if (!host) return;
    new MutationObserver((changes) => {
      for (const change of changes)
        if (change.attributeName === "data-scene-state")
          data.transitions.push({ at: performance.now(), value: host.getAttribute("data-scene-state") });
    }).observe(host, { attributes: true });
  });
  const scene = new WeakMap();
  let sceneGL = null;
  const isScene = (gl) => {
    const known = scene.get(gl);
    if (known !== undefined) return known;
    const inside = Boolean(gl.canvas?.closest?.("[data-home-desk-scene]"));
    if (inside) sceneGL = gl;
    // A canvas is created before it joins the page; decide only once it is connected.
    if (inside || gl.canvas?.isConnected) scene.set(gl, inside);
    return inside;
  };
  let label = "?",
    current = null,
    lastSwitch = 0;
  const proto = WebGL2RenderingContext.prototype;
  const viewport = proto.viewport;
  proto.viewport = function (x, y, w, h) {
    if (current && isScene(this)) {
      const now = performance.now();
      current.time[label] = (current.time[label] || 0) + now - lastSwitch;
      lastSwitch = now;
      label = `${w}x${h}`;
    }
    return viewport.call(this, x, y, w, h);
  };
  for (const name of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced", "drawRangeElements"]) {
    const original = proto[name];
    proto[name] = function (...args) {
      if (current && isScene(this)) current.draws[label] = (current.draws[label] || 0) + 1;
      return original.apply(this, args);
    };
  }
  for (const name of [
    "useProgram",
    "bufferData",
    "bufferSubData",
    "texImage2D",
    "texSubImage2D",
    "texImage3D",
    "texSubImage3D",
    "bindFramebuffer",
    "blitFramebuffer",
    "clear",
  ]) {
    const original = proto[name];
    proto[name] = function (...args) {
      if (current && isScene(this)) current.calls[name] = (current.calls[name] || 0) + 1;
      return original.apply(this, args);
    };
  }
  const link = proto.linkProgram;
  proto.linkProgram = function (program) {
    if (isScene(this)) data.programs.push(performance.now());
    return link.call(this, program);
  };
  let timer = null;
  const pending = [];
  const pollTimer = () => {
    const gl = sceneGL;
    if (!gl || !timer) return;
    if (gl.getParameter(timer.GPU_DISJOINT_EXT)) {
      for (const entry of pending.splice(0)) gl.deleteQuery(entry.query);
      return;
    }
    for (let i = pending.length - 1; i >= 0; i--) {
      const entry = pending[i];
      if (!gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE)) continue;
      entry.frame.gpu = gl.getQueryParameter(entry.query, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(entry.query);
      pending.splice(i, 1);
    }
  };
  const nativeRAF = window.requestAnimationFrame;
  const kinds = new WeakMap();
  window.requestAnimationFrame = function (callback) {
    // The scene's render callback resets renderer.info once per frame (survives minification).
    if (!kinds.has(callback)) kinds.set(callback, /\.info\.reset\(\)/.test(String(callback)));
    if (!kinds.get(callback)) return nativeRAF.call(this, callback);
    return nativeRAF.call(this, (now) => {
      const start = performance.now();
      current = { start, timestamp: now, draws: {}, time: {}, calls: {}, gpu: null };
      label = "?";
      lastSwitch = start;
      let query = null;
      if (sceneGL) {
        if (timer === null) {
          timer = sceneGL.getExtension("EXT_disjoint_timer_query_webgl2") || false;
          data.gpuTimer = Boolean(timer);
        }
        pollTimer();
        if (timer && pending.length < 8 && !sceneGL.getQuery(timer.TIME_ELAPSED_EXT, sceneGL.CURRENT_QUERY)) {
          query = sceneGL.createQuery();
          sceneGL.beginQuery(timer.TIME_ELAPSED_EXT, query);
        }
      }
      const frame = current;
      try {
        callback(now);
      } finally {
        const end = performance.now();
        frame.time[label] = (frame.time[label] || 0) + end - lastSwitch;
        frame.end = end;
        if (query) {
          sceneGL.endQuery(timer.TIME_ELAPSED_EXT);
          pending.push({ query, frame });
        }
        data.frames.push(frame);
        if (data.frames.length > 6000) data.frames.splice(0, 2000);
        current = null;
      }
    });
  };
}

function seedPage(initial) {
  let state = initial >>> 0,
    uuidState = 7;
  Math.random = () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296;
  window.__profileUuidRandom = () => (uuidState = (uuidState * 22695477 + 1) >>> 0) / 4294967296;
}

function fixDate(time) {
  const NativeDate = Date,
    fixed = NativeDate.parse(time);
  window.Date = new Proxy(NativeDate, {
    apply() {
      return new NativeDate(fixed).toString();
    },
    construct(target, args) {
      return Reflect.construct(target, args.length ? args : [fixed]);
    },
    get(target, key) {
      return key === "now" ? () => fixed : Reflect.get(target, key);
    },
  });
}

async function measureRun(variant, runIndex, browserCDPInfo) {
  const args = process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [];
  if (uncapped) args.push("--disable-gpu-vsync", "--disable-frame-rate-limit");
  const browser = await chromium.launch({ headless: true, args });
  const result = { variant, run: runIndex, views: {}, toggles: {}, errors: [] };
  try {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, timezoneId: "America/Los_Angeles" });
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.on("pageerror", (error) => result.errors.push(error.message));
    await page.route(/https:\/\/(?:plausible\.io|www\.google-analytics\.com|www\.googletagmanager\.com)\//, (route) =>
      route.fulfill({ status: 200, body: "" })
    );
    await page.route("**/livereload.js*", (route) => route.fulfill({ status: 200, body: "", contentType: "text/javascript" }));
    await page.route(/\/assets\/js\/.+\.m?js(?:\?.*)?$/, async (request) => {
      const url = new URL(request.request().url());
      const rel = "assets/js/" + decodeURIComponent(url.pathname.split("/assets/js/")[1]);
      if (abRef && changed.has(rel)) {
        const body = variantBody(variant, rel);
        if (!body) return request.fulfill({ status: 404, body: "" });
        let text = body.toString("utf8");
        if (rel.endsWith("three.module.min.js")) text = text.replaceAll("4294967295*Math.random()|0", "4294967295*__profileUuidRandom()|0");
        return request.fulfill({ status: 200, body: text, contentType: "text/javascript; charset=utf-8" });
      }
      if (rel.endsWith("three.module.min.js")) {
        const response = await request.fetch();
        const text = (await response.text()).replaceAll("4294967295*Math.random()|0", "4294967295*__profileUuidRandom()|0");
        return request.fulfill({ response, body: text });
      }
      return request.continue();
    });
    await page.addInitScript(seedPage, seed);
    await page.addInitScript(fixDate, fixedTime);
    await page.addInitScript(instrument);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Performance.enable");
    const browserCDP = await browser.newBrowserCDPSession();
    const processCPU = async () => {
      const info = await browserCDP.send("SystemInfo.getProcessInfo").catch(() => null);
      const totals = {};
      for (const entry of info?.processInfo || []) totals[entry.type] = (totals[entry.type] || 0) + entry.cpuTime;
      return totals;
    };
    if (!browserCDPInfo.gpu)
      browserCDPInfo.gpu = await browserCDP
        .send("SystemInfo.getInfo")
        .then((info) => info.gpu?.devices?.map((d) => d.deviceString))
        .catch(() => null);
    await page.emulateMedia({ reducedMotion });
    const url = new URL(baseURL);
    url.searchParams.set("scene-lab", "1");
    for (const [key, value] of new URLSearchParams(extras.find((extra) => extra.name === variant)?.query || "")) url.searchParams.set(key, value);
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const host = page.locator("[data-home-desk-scene]");
    const evidence = () => host.evaluate((element) => element.getSceneEvidence());
    await page.locator('[data-home-desk-mode="3d"]').click();
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 180000 });
    await host.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.().frames > 0);
    if (fullViewport) {
      const button = page.locator("[data-world-fullscreen]");
      if (await button.isVisible().catch(() => false)) await button.click();
      else {
        await host.locator("canvas").focus();
        await page.keyboard.press("f");
      }
      await page.waitForFunction(() => Boolean(document.querySelector("[data-home-desk-scene]").getSceneEvidence().fullscreen));
      // The stage grows to the viewport; let the resize land.
      await page.waitForTimeout(1500);
    }
    const startup = await page.evaluate(() => {
      const data = window.__coastalViews,
        ready = data.transitions.find((t) => t.value === "ready")?.at,
        tasks = data.longTasks.filter((t) => t.start >= data.activation && t.start <= ready);
      return {
        activationToReadyMs: ready - data.activation,
        programsBeforeReady: data.programs.filter((t) => t <= ready).length,
        longTasks: tasks.length,
        longTaskMs: tasks.reduce((sum, t) => sum + t.duration, 0),
        blockingMs: tasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0),
        longestTaskMs: tasks.reduce((max, t) => Math.max(max, t.duration), 0),
        gpuTimer: data.gpuTimer,
      };
    });
    const first = await evidence();
    startup.firstFrameMs = first.loading?.firstFrameMilliseconds;
    startup.models = (first.loading?.models || []).map((m) => ({
      asset: m.asset,
      bytes: m.bytes,
      downloadMs: round(m.downloadedMilliseconds - m.startMilliseconds, 1),
      parseMs: round(m.parsedMilliseconds - m.downloadedMilliseconds, 1),
    }));
    startup.stages = first.loading?.stages;
    result.startup = startup;
    result.avatar = first.avatarId;

    const sample = async (name, duration = seconds) => {
      const t0 = await page.evaluate(() => performance.now());
      const before = await evidence();
      const metrics0 = await cdp.send("Performance.getMetrics");
      const cpu0 = await processCPU();
      await page.waitForTimeout(duration * 1000);
      const t1 = await page.evaluate(() => performance.now());
      const after = await evidence();
      const metrics1 = await cdp.send("Performance.getMetrics");
      const cpu1 = await processCPU();
      // Let the last frames' GPU queries resolve.
      await page.waitForTimeout(400);
      const frames = await page.evaluate(({ t0, t1 }) => window.__coastalViews.frames.filter((f) => f.start >= t0 && f.start < t1 && f.end), {
        t0,
        t1,
      });
      const tasks = await page.evaluate(({ t0, t1 }) => window.__coastalViews.longTasks.filter((t) => t.start >= t0 && t.start < t1), { t0, t1 });
      const wall = (t1 - t0) / 1000;
      const metric = (set, key) => set.metrics.find((m) => m.name === key)?.value || 0;
      const intervals = frames.slice(1).map((f, i) => f.timestamp - frames[i].timestamp);
      const labels = new Set(frames.flatMap((f) => Object.keys(f.draws)));
      const drawsByPass = {},
        msByPass = {};
      for (const key of labels) {
        drawsByPass[key] = round(mean(frames.map((f) => f.draws[key] || 0)), 1);
        msByPass[key] = round(mean(frames.map((f) => f.time[key] || 0)), 2);
      }
      const callKeys = new Set(frames.flatMap((f) => Object.keys(f.calls)));
      const calls = {};
      for (const key of callKeys) calls[key] = round(mean(frames.map((f) => f.calls[key] || 0)), 1);
      const cpu = {};
      for (const key of Object.keys(cpu1)) cpu[key] = round((100 * ((cpu1[key] || 0) - (cpu0[key] || 0))) / wall, 1);
      const summary = {
        name,
        wallSeconds: round(wall, 2),
        frames: after.frames - before.frames,
        fps: round((after.frames - before.frames) / wall, 1),
        intervalMs: Object.fromEntries(Object.entries(stats(intervals)).map(([k, v]) => [k, round(v)])),
        submitMs: Object.fromEntries(Object.entries(stats(frames.map((f) => f.end - f.start))).map(([k, v]) => [k, round(v)])),
        gpuMs: Object.fromEntries(Object.entries(stats(frames.map((f) => f.gpu))).map(([k, v]) => [k, round(v)])),
        drawsPerFrame: round(mean(frames.map((f) => Object.values(f.draws).reduce((s, v) => s + v, 0))), 1),
        drawsByPass,
        msByPass,
        callsPerFrame: calls,
        rendererInfo: { calls: after.drawCalls, triangles: after.triangles },
        canvas: [after.canvasWidth, after.canvasHeight],
        mainThreadBusyPercent: round((100 * (metric(metrics1, "TaskDuration") - metric(metrics0, "TaskDuration"))) / wall, 1),
        scriptPercent: round((100 * (metric(metrics1, "ScriptDuration") - metric(metrics0, "ScriptDuration"))) / wall, 1),
        processCpuPercent: cpu,
        longTasks: tasks.length,
        longTaskMs: round(
          tasks.reduce((s, t) => s + t.duration, 0),
          1
        ),
        camera: { room: after.currentRoom, radius: round(after.cameraOrbit?.radius, 2) },
        resolution: after.resolution || null,
        shadowCache: after.shadowCache || null,
      };
      return summary;
    };
    const shot = async (name) => {
      if (!screenshots || runIndex > 1) return;
      await page
        .locator(".home-hero-media")
        .screenshot({ path: output.replace(/\.json$/, `-${variant}-${name}.png`), timeout: 60000 })
        .catch(() => {});
    };
    const toggle = {
      shadowFrozen: [
        () => host.evaluate((e) => (e.labScene.sun.shadow.autoUpdate = false)),
        () => host.evaluate((e) => (e.labScene.sun.shadow.autoUpdate = true)),
      ],
      noReflection: [
        () => host.evaluate((e) => (e.labScene.settings.reflection = false)),
        () => host.evaluate((e) => (e.labScene.settings.reflection = true)),
      ],
      noHinterland: [
        () => host.evaluate((e) => (e.labScene.scene.getObjectByName("coastal-hinterland").visible = false)),
        () => host.evaluate((e) => (e.labScene.scene.getObjectByName("coastal-hinterland").visible = true)),
      ],
      noFlora: [
        () => host.evaluate((e) => (e.labScene.scene.getObjectByName("clifftop-flora").visible = false)),
        () => host.evaluate((e) => (e.labScene.scene.getObjectByName("clifftop-flora").visible = true)),
      ],
    };
    const runToggles = async (view) => {
      for (const name of toggles) {
        if (!toggle[name]) continue;
        if ((name === "noHinterland" || name === "noFlora" || name === "noReflection") && view === "study") continue;
        await toggle[name][0]();
        await page.waitForTimeout(800);
        result.toggles[`${view}:${name}`] = await sample(`${view}:${name}`, Math.max(3, seconds - 2));
        await toggle[name][1]();
        await page.waitForTimeout(800);
      }
    };

    for (const view of views) {
      if (view === "study") {
        // Steady state: every room streamed and the static light field baked.
        await page
          .waitForFunction(
            () => {
              const e = document.querySelector("[data-home-desk-scene]").getSceneEvidence();
              return e.roomCount >= 6 && e.simulation?.lightField?.ready && !e.traveling;
            },
            null,
            { timeout: 150000 }
          )
          .catch(() => result.errors.push("study steady state not reached"));
        await page.waitForTimeout(1500);
      } else if (view === "outside") {
        await page.locator("[data-world-view]").click();
        await page
          .waitForFunction(
            () => {
              const lab = document.querySelector("[data-home-desk-scene]").labScene;
              return lab.scene.getObjectByName("coastal-hinterland")?.visible && lab.scene.getObjectByName("clifftop-flora")?.visible;
            },
            null,
            { timeout: 150000 }
          )
          .catch(() => result.errors.push("outside models not visible"));
        await page.waitForTimeout(3000);
      } else if (view === "coast160") {
        await host.locator("canvas").focus();
        for (let i = 0; i < 10; i++) {
          await page.keyboard.press("-");
          await page.waitForTimeout(120);
        }
        await page
          .waitForFunction(() => Math.abs(document.querySelector("[data-home-desk-scene]").getSceneEvidence().cameraOrbit.radius - 160) < 0.5, null, {
            timeout: 30000,
          })
          .catch(() => result.errors.push("coast zoom did not reach 160 m"));
        await page.waitForTimeout(1500);
      } else if (view === "outside-turned") {
        // A coast pose turned about 62 degrees from the authored one, where the onsen water is hidden
        // (the transmission gate's case). Follows "outside" in the list.
        await host.locator("canvas").focus();
        for (let i = 0; i < 6; i++) {
          await page.keyboard.press("ArrowLeft");
          await page.waitForTimeout(80);
        }
        await page.waitForTimeout(2500);
      } else if (view === "overview") {
        await host.locator("canvas").focus();
        await page.keyboard.press("Home");
        await page.waitForTimeout(2500);
      }
      result.views[view] = await sample(view);
      await shot(view);
      await runToggles(view);
    }
    result.final = await evidence().then((e) => ({
      roomCount: e.roomCount,
      frames: e.frames,
      resources: e.resources,
      lightField: e.simulation?.lightField?.ready,
    }));
  } finally {
    await browser.close();
  }
  return result;
}

(async () => {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const variants = abRef ? ["base", "work", ...extras.map((extra) => extra.name)] : ["current"];
  const order = [];
  for (let run = 0; run < runs; run++) {
    const pair = run % 2 === 0 ? variants : [...variants].reverse();
    for (const variant of pair) order.push({ variant, run });
  }
  const info = {};
  const results = [];
  for (const { variant, run } of order) {
    const started = Date.now();
    try {
      const result = await measureRun(variant, run, info);
      results.push(result);
      const brief = Object.fromEntries(
        Object.entries(result.views).map(([view, s]) => [
          view,
          { fps: s.fps, interval: s.intervalMs.median, submit: s.submitMs.median, gpu: s.gpuMs.median, draws: s.drawsPerFrame },
        ])
      );
      console.log(
        JSON.stringify({
          variant,
          run,
          seconds: Math.round((Date.now() - started) / 1000),
          startup: result.startup?.activationToReadyMs,
          views: brief,
          errors: result.errors,
        })
      );
    } catch (error) {
      console.error(`run ${run} ${variant} failed:`, error.message);
      results.push({ variant, run, failed: error.message });
    }
    fs.writeFileSync(
      output,
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          baseURL,
          abRef,
          extras: extras.map((extra) => ({ ...extra, hold: [...extra.hold] })),
          held: [...held],
          fullViewport,
          changed: [...changed],
          width,
          height,
          dpr,
          seconds,
          seed,
          uncapped,
          reducedMotion,
          fixedTime,
          gpu: info.gpu,
          method:
            "Fresh headless Chromium per run (ANGLE D3D11 on Windows), cache disabled, seeded page randomness, fixed routine Date, native RAF and timers; ABBA order. Draws are attributed to passes by viewport size; GPU time is a TIME_ELAPSED query around the whole scene frame when available; CPU percentages are process CPU time over wall time (100% = one core).",
          results,
        },
        null,
        2
      ) + "\n"
    );
  }
  console.log(output);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
