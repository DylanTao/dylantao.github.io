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
const { pinArrivalAvatar } = require("./coastal_probe_avatar.cjs");

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
const pinnedAvatar = opt("avatar", null);
const fixedTime = opt("time", null);
if (fixedTime && !Number.isFinite(Date.parse(fixedTime))) throw new Error("Invalid fixed probe time");

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
  if (fixedTime)
    await context.addInitScript((time) => {
      const NativeDate = Date,
        fixed = NativeDate.parse(time);
      window.Date = new Proxy(NativeDate, {
        apply() {
          return new NativeDate(fixed).toString();
        },
        construct(target, args) {
          return Reflect.construct(target, args.length ? args : [fixed]);
        },
        get(target, prop) {
          return prop === "now" ? () => fixed : Reflect.get(target, prop);
        },
      });
    }, fixedTime);
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
  if (pinnedAvatar)
    await page.route(/\/assets\/js\/home-scene\/routine\.mjs(?:\?.*)?$/, async (route) => {
      const override = (process.env.OVERRIDES || "").split(";").find((pair) => pair.split("=")[0].endsWith("routine.mjs"));
      const response = override ? null : await route.fetch();
      const source = override ? fs.readFileSync(override.slice(override.indexOf("=") + 1), "utf8") : await response.text();
      await route.fulfill({
        ...(response ? { response } : {}),
        body: pinArrivalAvatar(source, pinnedAvatar),
        contentType: "text/javascript; charset=utf-8",
      });
    });
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
  // A restored scroll position or a late font/layout change can leave the
  // selected scene outside the viewport. Its rendering intentionally sleeps.
  await page.locator("[data-home-desk-scene]").scrollIntoViewIfNeeded();
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
      avatarId: s.avatarId,
      drawCalls: s.drawCalls,
      programs: s.programs,
      reflections: s.simulation?.interiorReflections,
    };
  });
  if (pinnedAvatar && evidence.avatarId !== pinnedAvatar)
    throw new Error(`Arrival identity ${evidence.avatarId} differs from pinned ${pinnedAvatar}`);
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
  const result = { label, url, engine, device, throttle, warm, lab, pinnedAvatar, fixedTime, at: new Date().toISOString() };
  let active = null;
  let phase = warm ? "prime" : "measure";
  try {
    if (warm) {
      // Prime the HTTP and GPU program caches in one session, then measure a fresh session on them.
      active = await openContext(userDataDir);
      await instrument(active.context);
      result.prime = await loadOnce(active.context, { measureIdle: false });
      await active.close();
      active = null;
    }
    phase = "measure";
    active = await openContext(userDataDir);
    await instrument(active.context);
    Object.assign(result, await loadOnce(active.context, { measureIdle: true }));
  } catch (error) {
    result.failure = { phase, message: String(error) };
    const page = active?.context.pages()[0];
    if (page) {
      let diagnosticTimer;
      try {
        result.failure.scene = await Promise.race([
          page
            .evaluate(() => {
              const scene = document.querySelector("[data-home-desk-scene]");
              return {
                dataset: scene ? { ...scene.dataset } : null,
                bounds: scene?.getBoundingClientRect().toJSON(),
                visibility: document.visibilityState,
                scrollY,
                viewport: [innerWidth, innerHeight],
              };
            })
            .catch((error) => ({ unavailable: String(error) })),
          new Promise((resolve) => {
            diagnosticTimer = setTimeout(() => resolve({ unavailable: "renderer did not respond within 5 seconds" }), 5000);
          }),
        ]);
      } finally {
        clearTimeout(diagnosticTimer);
      }
    }
    process.exitCode = 1;
  } finally {
    // Close a failed prime/measurement too. Previously its live browser kept
    // the profile locked and the cleanup error replaced the actual failure.
    if (active) await active.close();
    if (userDataDir) {
      const parent = fs.realpathSync(os.tmpdir());
      const target = fs.realpathSync(userDataDir);
      const relative = path.relative(parent, target);
      if (!relative || path.isAbsolute(relative) || path.dirname(relative) !== "." || !path.basename(target).startsWith("coastal-warm-"))
        throw new Error("Refusing cleanup outside the newly created startup profile");
      try {
        fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch (error) {
        // Retain diagnostic data even if antivirus/indexing still owns a file.
        result.cleanupWarning = { profile: path.basename(target), message: String(error) };
      }
    }
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
    failure: result.failure,
    cleanupWarning: result.cleanupWarning,
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
