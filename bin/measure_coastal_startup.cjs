// Click-to-ready startup probe for the 3D home: cold or warm, desktop or phone emulation, Chromium
// (ANGLE/Direct3D 11 on Windows) or Playwright WebKit in iPhone 12 emulation. Reports the loading
// stages, programs linked before ready, long tasks and a few seconds of idle frame intervals.
// Phone emulation runs on this host's GPU; WebKit on Windows compiles shaders serially through
// Direct3D and is not a proxy for an iPhone (docs/performance-notes.md, October 24).
//
// PowerShell:
//   node bin/measure_coastal_startup.cjs --url http://127.0.0.1:4170/ [--engine chromium|webkit]
//     [--device desktop|phone] [--throttle 4] [--warm] [--lab] [--idle 6] [--out file.json]
// $env:OVERRIDES = "controller.mjs=D:/path/controller.mjs;…" serves local module versions instead
// of the server's, for interleaved A/B without a rebuild.
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { chromium, webkit, devices } = require("playwright");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = args[i + 1];
  return next === undefined || next.startsWith("--") ? true : next;
};
const url = opt("url", "http://127.0.0.1:4170/");
const engine = opt("engine", "chromium");
const device = opt("device", "desktop");
const throttle = Number(opt("throttle", 0));
const warm = Boolean(opt("warm", false));
const lab = Boolean(opt("lab", false));
const idleSeconds = Number(opt("idle", 6));
const label = opt("label", `${engine}-${device}${throttle ? `-cpu${throttle}` : ""}${warm ? "-warm" : "-cold"}`);
const out = opt("out", null);
const timeoutMs = Number(opt("timeout", 300000));

function contextOptions() {
  if (device === "phone") {
    const phone = devices["iPhone 12"];
    if (engine === "webkit") return { ...phone, timezoneId: "America/Los_Angeles" };
    // Chromium: the same viewport, density and touch, without WebKit's user agent.
    return {
      viewport: phone.viewport,
      deviceScaleFactor: phone.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
      timezoneId: "America/Los_Angeles",
    };
  }
  return { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, timezoneId: "America/Los_Angeles" };
}
const launchArgs = engine === "chromium" && process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [];

async function openContext(userDataDir) {
  const type = engine === "webkit" ? webkit : chromium;
  if (userDataDir) {
    const context = await type.launchPersistentContext(userDataDir, { headless: true, args: launchArgs, ...contextOptions() });
    return { context, close: () => context.close() };
  }
  const browser = await type.launch({ headless: true, args: launchArgs });
  const context = await browser.newContext(contextOptions());
  return { context, close: () => browser.close() };
}

async function instrument(context) {
  await context.addInitScript(() => {
    const data = (window.__perf = { links: [], longTasks: [], raf: [] });
    for (const proto of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype].filter(Boolean)) {
      const link = proto.linkProgram;
      proto.linkProgram = function (program) {
        data.links.push(performance.now());
        return link.call(this, program);
      };
    }
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) data.longTasks.push({ start: e.startTime, duration: e.duration });
      }).observe({ type: "longtask", buffered: true });
    } catch {
      /* WebKit has no long-task entries. */
    }
    let last;
    const tick = (now) => {
      if (last !== undefined) data.raf.push([last, now - last]);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function routes(page) {
  await page.route(/https:\/\/(?:plausible\.io|www\.google-analytics\.com|www\.googletagmanager\.com)\//, (route) =>
    route.fulfill({ status: 200, body: "" })
  );
  for (const pair of (process.env.OVERRIDES || "").split(";").filter(Boolean)) {
    const [name, file] = pair.split("=");
    const body = fs.readFileSync(file);
    await page.route(
      (u) => u.pathname.endsWith("/" + name),
      (route) => route.fulfill({ body, contentType: "text/javascript" })
    );
  }
}

async function loadOnce(context, { measureIdle }) {
  const page = context.pages()[0] || (await context.newPage());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await routes(page);
  if (engine === "chromium" && throttle > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  }
  const target = new URL(url);
  if (lab) target.searchParams.set("scene-lab", "1");
  const navStart = Date.now();
  await page.goto(target.href, { waitUntil: "load", timeout: 180000 });
  const loadMs = Date.now() - navStart;
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  const env = await page.evaluate(() => {
    const c = document.createElement("canvas").getContext("webgl2");
    const info = c?.getExtension("WEBGL_debug_renderer_info");
    return {
      coarse: matchMedia("(pointer: coarse)").matches,
      dpr: devicePixelRatio,
      inner: [innerWidth, innerHeight],
      renderer: info ? c.getParameter(info.UNMASKED_RENDERER_WEBGL) : null,
      parallelCompile: Boolean(c?.getExtension("KHR_parallel_shader_compile")),
      maxSamples: c?.getParameter(c.MAX_SAMPLES) ?? null,
      cores: navigator.hardwareConcurrency,
    };
  });
  const clickAt = await page.evaluate(() => performance.now());
  const t0 = Date.now();
  await page.locator('[data-home-desk-mode="3d"]').click();
  await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, {
    timeout: timeoutMs,
    polling: 250,
  });
  const wallMs = Date.now() - t0;
  const readyAt = await page.evaluate(() => performance.now());
  const evidence = await page.locator("[data-home-desk-scene]").evaluate((e) => {
    const s = e.getSceneEvidence();
    return {
      loading: s.loading,
      canvas: [s.canvasWidth, s.canvasHeight],
      resolution: s.resolution,
      detail: s.detail,
      room: s.currentRoom,
      drawCalls: s.drawCalls,
    };
  });
  let idle = null;
  if (measureIdle && idleSeconds > 0) {
    const start = await page.evaluate(() => performance.now());
    await page.waitForTimeout(idleSeconds * 1000);
    idle = await page.evaluate((start) => {
      const v = window.__perf.raf
        .filter(([at]) => at >= start)
        .map(([, d]) => d)
        .sort((a, b) => a - b);
      const q = (f) => (v.length ? v[Math.min(v.length - 1, Math.floor(v.length * f))] : null);
      return { frames: v.length, p50: q(0.5), p95: q(0.95), max: q(1) };
    }, start);
  }
  const perf = await page.evaluate(
    ({ clickAt, readyAt }) => {
      const d = window.__perf;
      const lt = d.longTasks.filter((t) => t.start >= clickAt && t.start <= readyAt);
      return {
        linksToReady: d.links.filter((t) => t >= clickAt && t <= readyAt).length,
        linksAfterReady: d.links.filter((t) => t > readyAt).length,
        longTaskCount: lt.length,
        longTaskMs: Math.round(lt.reduce((a, t) => a + t.duration, 0)),
        longestTaskMs: Math.round(lt.reduce((a, t) => Math.max(a, t.duration), 0)),
      };
    },
    { clickAt, readyAt }
  );
  return { loadMs, wallMs, env, evidence, perf, idle, errors };
}

(async () => {
  const userDataDir = warm ? fs.mkdtempSync(path.join(os.tmpdir(), "coastal-warm-")) : null;
  const result = { label, url, engine, device, throttle, warm, lab, at: new Date().toISOString() };
  try {
    if (warm) {
      // Prime the HTTP and GPU program caches in one session, then measure a fresh session on them.
      const prime = await openContext(userDataDir);
      await instrument(prime.context);
      result.prime = await loadOnce(prime.context, { measureIdle: false });
      await prime.close();
    }
    const run = await openContext(userDataDir);
    await instrument(run.context);
    Object.assign(result, await loadOnce(run.context, { measureIdle: true }));
    await run.close();
  } finally {
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
  }
  const stages = Object.fromEntries((result.evidence?.loading?.stages || []).map((s) => [s.stage, Math.round(s.milliseconds)]));
  const summary = {
    label,
    firstFrameMs: Math.round(result.evidence?.loading?.firstFrameMilliseconds ?? NaN),
    wallMs: result.wallMs,
    stages,
    lightCache: result.evidence?.loading?.lightCache?.state,
    links: result.perf,
    idle: result.idle && { p50: result.idle.p50, p95: result.idle.p95, frames: result.idle.frames },
    canvas: result.evidence?.canvas,
    env: result.env,
    prime: result.prime && { firstFrameMs: Math.round(result.prime.evidence?.loading?.firstFrameMilliseconds ?? NaN), wallMs: result.prime.wallMs },
    errors: result.errors,
  };
  if (out) {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ summary, result }, null, 1));
  }
  console.log(JSON.stringify(summary));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
