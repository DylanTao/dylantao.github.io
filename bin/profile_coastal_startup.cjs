// Headless local measurements. Mobile sizes emulate this host, not a phone GPU.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");

const output = process.argv[2] || ".jekyll-cache/visual-qa/coastal-startup.json";
const baseURL = process.env.COASTAL_PROFILE_URL || "http://127.0.0.1:8080/";
const width = Number(process.env.COASTAL_PROFILE_WIDTH || 1440);
const dpr = Number(process.env.COASTAL_PROFILE_DPR || 1);
const software = process.env.COASTAL_PROFILE_GPU === "software";
const sampleSeconds = Number(process.env.COASTAL_PROFILE_SECONDS || 8);
const summarize = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const q = (fraction) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? null;
  return { samples: sorted.length, medianMs: q(0.5), p95Ms: q(0.95), maximumMs: q(1), stallsOver500Ms: sorted.filter((v) => v >= 500).length };
};

(async () => {
  await fs.mkdir(path.dirname(output), { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: software
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : process.platform === "win32"
        ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"]
        : [],
  });
  const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: dpr, timezoneId: "America/Los_Angeles" });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Keep real fonts, model bytes and shaders. Only analytics are suppressed.
  await page.route(/https:\/\/(?:plausible\.io|www\.google-analytics\.com|www\.googletagmanager\.com)\//, (route) =>
    route.fulfill({ status: 200, body: "" })
  );
  const cdp = await page.context().newCDPSession(page);
  const browserCDP = await browser.newBrowserCDPSession();
  const systemInfo = await browserCDP.send("SystemInfo.getInfo").catch(() => null);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Performance.enable");
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.start");
  // Playwright's clock injection also replaces RAF/performance/timers, which
  // hides long renderer stalls. Fix only the authored routine's Date; retain
  // the native browser clock and preserve Date's callable/constructor forms.
  await page.addInitScript((time) => {
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
  }, "2026-10-02T13:20:00-07:00");
  await page.addInitScript(() => {
    const data = (window.coastalProfile = { activation: null, fetches: [], transitions: [], longTasks: [], sceneFrames: [], rafIntervals: [] });
    const nativeFetch = window.fetch;
    window.fetch = async function (...args) {
      const url = String(args[0]?.url || args[0]);
      const entry = { url, start: performance.now() };
      if (/manifest\.json|\.glb(?:\?|$)/.test(url)) data.fetches.push(entry);
      const response = await nativeFetch.apply(this, args);
      entry.headers = performance.now();
      const arrayBuffer = response.arrayBuffer.bind(response);
      response.arrayBuffer = async () => {
        const buffer = await arrayBuffer();
        entry.body = performance.now();
        entry.bytes = buffer.byteLength;
        return buffer;
      };
      return response;
    };
    const nativeRAF = window.requestAnimationFrame;
    const sceneCallbacks = new WeakMap();
    window.requestAnimationFrame = function (callback) {
      if (!sceneCallbacks.has(callback)) sceneCallbacks.set(callback, /renderer\.info\.reset\(\)/.test(String(callback)));
      if (!sceneCallbacks.get(callback)) return nativeRAF.call(this, callback);
      return nativeRAF.call(this, (now) => {
        const start = performance.now();
        callback(now);
        data.sceneFrames.push({ start, end: performance.now(), timestamp: now });
      });
    };
    let lastRAF;
    const sampleRAF = (now) => {
      if (lastRAF !== undefined) data.rafIntervals.push({ start: lastRAF, interval: now - lastRAF });
      lastRAF = now;
      nativeRAF(sampleRAF);
    };
    nativeRAF(sampleRAF);
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) data.longTasks.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: "longtask", buffered: true });
    addEventListener(
      "click",
      (event) => {
        if (event.target.closest('[data-home-desk-mode="3d"]') && data.activation === null) data.activation = performance.now();
      },
      true
    );
    addEventListener("DOMContentLoaded", () => {
      const host = document.querySelector("[data-home-desk-scene]");
      if (!host) return;
      new MutationObserver((changes) => {
        for (const change of changes) {
          if (["data-scene-state", "data-avatar", "data-activity", "data-room"].includes(change.attributeName))
            data.transitions.push({ at: performance.now(), attribute: change.attributeName, value: host.getAttribute(change.attributeName) });
        }
      }).observe(host, { attributes: true });
    });
  });

  const read = () => page.locator("[data-home-desk-scene]").evaluate((element) => element.getSceneEvidence());
  const screenshot = (name) => page.locator(".home-hero-media").screenshot({ path: output.replace(/\.json$/, `-${name}.png`), timeout: 60000 });
  const samples = [];
  let result;
  try {
    const url = new URL(baseURL);
    url.searchParams.set("scene-lab", "1");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    console.log("Loaded document; awaiting real fonts.");
    await page.evaluate(() => document.fonts.ready);
    const initial3D = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((e) => /\.glb(?:\?|$)|three\.module/.test(e.name))
        .map((e) => e.name)
    );
    await page.locator('[data-home-desk-mode="3d"]').click();
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 60000 });
    console.log("Scene reports ready.");
    const scene = page.locator("[data-home-desk-scene]");
    await scene.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.().frames > 0);
    const firstFrame = { at: await page.evaluate(() => performance.now()), evidence: await read() };
    await screenshot("first-frame");
    const sample = async (name) => {
      const start = await page.evaluate(() => performance.now());
      const before = await read();
      await page.waitForTimeout(sampleSeconds * 1000);
      const end = await page.evaluate(() => performance.now());
      const after = await read();
      const data = await page.evaluate(
        ({ start, end }) => ({
          frames: coastalProfile.sceneFrames.filter((e) => e.start >= start && e.start < end),
          raf: coastalProfile.rafIntervals.filter((e) => e.start >= start && e.start < end).map((e) => e.interval),
          tasks: coastalProfile.longTasks.filter((e) => e.start >= start && e.start < end),
        }),
        { start, end }
      );
      samples.push({
        name,
        start,
        end,
        frames: after.frames - before.frames,
        fps: ((after.frames - before.frames) * 1000) / (end - start),
        sceneSubmit: summarize(data.frames.map((e) => e.end - e.start)),
        browserRAF: summarize(data.raf),
        longTasks: data.tasks,
        evidence: after,
      });
      console.log(`Captured ${name}.`);
      await screenshot(name);
    };
    await sample("occupied-room");
    await page.locator("[data-world-view]").click();
    await sample("outside");
    await page.locator("[data-world-view]").click();
    await sample("back-inside");
    const offscreenBefore = await read();
    await scene.evaluate((e) => window.scrollTo({ top: scrollY + e.getBoundingClientRect().bottom + 64, behavior: "instant" }));
    await page.waitForTimeout(1500);
    const offscreenSettled = await read();
    await page.waitForTimeout(1000);
    const offscreenAfter = await read();
    result = {
      checkedAt: new Date().toISOString(),
      browser: browser.version(),
      baseURL,
      width,
      dpr,
      backendRequested: software ? "ANGLE SwiftShader" : "native/default ANGLE",
      mobileIsHostEmulation: width < 768,
      initial3D,
      firstFrame,
      samples,
      offscreen: {
        framesDuringSettling: offscreenSettled.frames - offscreenBefore.frames,
        framesAfterSettling: offscreenAfter.frames - offscreenSettled.frames,
      },
      raw: await page.evaluate(() => ({
        ...coastalProfile,
        resources: performance
          .getEntriesByType("resource")
          .map((e) => ({ name: e.name, start: e.startTime, duration: e.duration, bodyBytes: e.encodedBodySize, transferBytes: e.transferSize })),
        memory: performance.memory
          ? {
              jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
              totalJSHeapSize: performance.memory.totalJSHeapSize,
              usedJSHeapSize: performance.memory.usedJSHeapSize,
            }
          : null,
      })),
      cdpMetrics: (await cdp.send("Performance.getMetrics")).metrics,
      domCounters: await cdp.send("Memory.getDOMCounters"),
      errors,
      limitations: [
        "Authored routine Date is fixed; performance.now, RAF and timers stay native.",
        "Local headless desktop GPU; mobile viewport/DPR is emulation.",
        "Single captures; arrival avatars and OS shader caches are not controlled.",
        "CPU profiler and RAF interception add overhead; compare identical setups.",
        "All browser RAF intervals include page work, not only scene GPU completion.",
        "Scene submit covers JS and GPU command submission, not asynchronous GPU completion.",
        "Existing GPU timer covers finish.render, excluding ocean reflection and CPU solvers.",
        "Draw calls/triangles count multipass submissions, not unique authored geometry.",
        "Heap/Three resource counts do not measure total GPU VRAM.",
        "First-frame timestamp is the observation time; its screenshot supplies nonblank pixel proof.",
      ],
    };
    result.systemInfo = systemInfo;
    const sourceResponse = await page.request.get(new URL("assets/js/home-scene/controller.mjs", baseURL.replace(/\/?$/, "/")).href);
    if (!sourceResponse.ok()) throw new Error("Could not pin the measured scene module.");
    result.sceneModuleSHA256 = createHash("sha256")
      .update(await sourceResponse.body())
      .digest("hex");
    result.gpuContext = await scene.locator("canvas").evaluate((canvas) => {
      const gl = canvas.getContext("webgl2"),
        extension = gl?.getExtension("WEBGL_debug_renderer_info");
      return extension
        ? { vendor: gl.getParameter(extension.UNMASKED_VENDOR_WEBGL), renderer: gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) }
        : null;
    });
  } finally {
    const { profile } = await cdp.send("Profiler.stop").catch(() => ({ profile: null }));
    if (profile) await fs.writeFile(output.replace(/\.json$/, ".cpuprofile"), JSON.stringify(profile));
    if (result) await fs.writeFile(output, JSON.stringify(result, null, 2) + "\n");
    await browser.close();
  }
  console.log(
    JSON.stringify({
      output,
      activationToReadyMs: result.raw.transitions.find((e) => e.attribute === "data-scene-state" && e.value === "ready")?.at - result.raw.activation,
      activationToFirstFrameObservedMs: result.firstFrame.at - result.raw.activation,
      samples: result.samples.map((s) => ({ name: s.name, fps: s.fps, sceneSubmit: s.sceneSubmit, browserRAF: s.browserRAF })),
      errors,
    })
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
