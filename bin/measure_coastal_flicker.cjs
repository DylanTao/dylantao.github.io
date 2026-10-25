// Frame-to-frame flicker and lag in the 3D home (docs/performance-notes.md, October 24). Each scene
// frame is copied, in the task that drew it, into a small canvas and kept as luma. Per scenario:
//   motion   mean |f(t) - f(t-1)| per pixel (0-255): real motion plus shimmer;
//   accel    mean |f(t+1) - 2 f(t) + f(t-1)|: small for smooth camera motion, large for pops;
//   flip     share of pixels changing by more than 6 whose change reverses the next frame (A-B-A);
//   spikes   frames whose accel exceeds 3x the scenario's median (pops), saved as PNG triples;
//   shadowRebuilds, resolutionChanges  from the scene's evidence across the recorded interaction.
// Scenarios: stillRoom, zoomRoom, orbitRoom, stillOutside, zoomOutside, panOutside, walkOutside and
// fullscreenOrbit; content is paused for the camera scenarios, so what changes is the view itself.
//
// PowerShell:
//   node bin/measure_coastal_flicker.cjs <url> <outDir> [--scenarios zoomOutside,panOutside]
// $env:OVERRIDES = "name.mjs=D:/path/file.mjs;…" (or --overrides) serves local module versions.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const args = process.argv.slice(2);
const [url, outDir] = args;
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const scenarioList = opt("scenarios", "stillRoom,zoomRoom,orbitRoom,stillOutside,zoomOutside,panOutside,walkOutside").split(",");
const overrides = opt("overrides", process.env.OVERRIDES || "");
const W = 272,
  H = 230;
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, timezoneId: "America/Los_Angeles" });
  await context.addInitScript(
    ({ W, H }) => {
      const capture = (window.__flicker = { frames: [], recording: false, canvas: null, ctx: null });
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) =>
        raf((now) => {
          callback(now);
          if (!capture.recording) return;
          const source = document.querySelector("[data-home-desk-scene] canvas");
          if (!source) return;
          if (!capture.canvas) {
            capture.canvas = document.createElement("canvas");
            capture.canvas.width = W;
            capture.canvas.height = H;
            capture.ctx = capture.canvas.getContext("2d", { willReadFrequently: true });
          }
          // Only frames the scene drew in this animation frame, once each (other callbacks share it).
          if (source.__drawnAt !== now || capture.lastAt === now) return;
          capture.lastAt = now;
          capture.ctx.drawImage(source, 0, 0, W, H);
          const data = capture.ctx.getImageData(0, 0, W, H).data;
          const luma = new Uint8Array(W * H);
          for (let i = 0, j = 0; i < luma.length; i++, j += 4) luma[i] = (data[j] * 54 + data[j + 1] * 183 + data[j + 2] * 19) >> 8;
          let bin = "";
          for (let i = 0; i < luma.length; i += 8192) bin += String.fromCharCode.apply(null, luma.subarray(i, i + 8192));
          capture.frames.push({ at: now, luma: btoa(bin) });
        });
      // Mark scene frames: three's WebGLRenderer draws to the canvas through its context.
      const proto = WebGL2RenderingContext.prototype,
        draw = proto.drawArrays,
        drawElements = proto.drawElements;
      const mark = function () {
        if (this.canvas?.closest?.("[data-home-desk-scene]")) this.canvas.__drawnAt = document.timeline.currentTime;
      };
      proto.drawArrays = function (...a) {
        mark.call(this);
        return draw.apply(this, a);
      };
      proto.drawElements = function (...a) {
        mark.call(this);
        return drawElements.apply(this, a);
      };
    },
    { W, H }
  );
  const page = await context.newPage();
  for (const pair of overrides.split(";").filter(Boolean)) {
    const [name, file] = pair.split("=");
    const body = fs.readFileSync(file);
    await page.route(
      (u) => u.pathname.endsWith("/" + name),
      (route) => route.fulfill({ body, contentType: "text/javascript" })
    );
  }
  const target = new URL(url);
  target.searchParams.set("scene-lab", "1");
  await page.goto(target.href, { waitUntil: "load", timeout: 180000 });
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]");
  await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, {
    timeout: 400000,
    polling: 500,
  });
  await scene.scrollIntoViewIfNeeded();
  // Let streamed detail settle (hinterland, flora, deferred programs).
  await page.waitForTimeout(8000);
  const canvas = scene.locator("canvas");
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  const evidence = () => scene.evaluate((e) => e.getSceneEvidence());
  const counters = async () => {
    const e = await evidence();
    return { rebuilds: e.shadowCache?.rebuilds ?? 0, resolutionChanges: e.resolution?.history?.length ?? 0, factor: e.resolution?.factor ?? 1 };
  };
  async function record(ms, action) {
    const before = await counters();
    await page.evaluate(() => {
      window.__flicker.frames = [];
      window.__flicker.recording = true;
    });
    const started = Date.now();
    if (action) await action();
    const left = ms - (Date.now() - started);
    if (left > 0) await page.waitForTimeout(left);
    const frames = await page.evaluate(() => {
      window.__flicker.recording = false;
      return window.__flicker.frames;
    });
    const after = await counters();
    const decoded = frames.map((f) => ({ at: f.at, luma: Uint8Array.from(Buffer.from(f.luma, "base64")) }));
    decoded.counters = {
      shadowRebuilds: after.rebuilds - before.rebuilds,
      resolutionChanges: after.resolutionChanges - before.resolutionChanges,
      factor: after.factor,
    };
    return decoded;
  }
  const pause = async (value) => {
    const pressed = (await page.locator("[data-world-pause]").getAttribute("aria-pressed")) === "true";
    // The embed's control is not always actionable for Playwright; a DOM click drives the same handler.
    if (pressed !== value) await page.locator("[data-world-pause]").evaluate((button) => button.click());
    await page.waitForTimeout(400);
  };
  const toRoom = async () => {
    await page.keyboard.press("Escape");
    await canvas.focus();
    await page.keyboard.press("Home");
    await page.waitForTimeout(2500);
  };
  const toOutside = async () => {
    const e = await evidence();
    if (e.currentRoom !== "outside") await page.locator("[data-world-view]").evaluate((button) => button.click());
    await page.waitForTimeout(6000);
  };
  const wheel = async (delta, steps, gap) => {
    await page.mouse.move(cx, cy);
    for (let i = 0; i < steps; i++) {
      await page.keyboard.down("Control");
      await page.mouse.wheel(0, delta);
      await page.keyboard.up("Control");
      await page.waitForTimeout(gap);
    }
  };
  const drag = async (dx, dy, steps, button = "left") => {
    await page.mouse.move(cx, cy);
    await page.mouse.down({ button });
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(cx + (dx * i) / steps, cy + (dy * i) / steps);
      await page.waitForTimeout(16);
    }
    await page.mouse.up({ button });
  };
  const scenarios = {
    stillRoom: async () => (await toRoom(), await pause(false), record(4000)),
    zoomRoom: async () => (await toRoom(), await pause(true), record(5000, async () => (await wheel(60, 8, 120), await wheel(-60, 8, 120)))),
    orbitRoom: async () => (await toRoom(), await pause(true), record(4000, () => drag(320, 40, 60))),
    stillOutside: async () => (await toOutside(), await pause(false), record(4000)),
    zoomOutside: async () => (await toOutside(), await pause(true), record(6000, async () => (await wheel(60, 10, 140), await wheel(-60, 10, 140)))),
    panOutside: async () => (await toOutside(), await pause(true), record(4500, () => drag(260, 120, 70, "right"))),
    fullscreenOrbit: async () => {
      await toRoom();
      await pause(false);
      await page.locator("[data-world-fullscreen]").evaluate((button) => button.click());
      await page.waitForTimeout(3000);
      const big = await canvas.boundingBox();
      const frames = await record(7000, async () => {
        await page.mouse.move(big.x + big.width / 2, big.y + big.height / 2);
        await page.mouse.down();
        for (let i = 1; i <= 300; i++) {
          await page.mouse.move(big.x + big.width / 2 + Math.sin(i / 20) * 300, big.y + big.height / 2 + Math.cos(i / 25) * 60);
          await page.waitForTimeout(16);
        }
        await page.mouse.up();
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1500);
      return frames;
    },
    walkOutside: async () => {
      await toOutside();
      await pause(true);
      await page.locator("[data-world-fullscreen]").evaluate((button) => button.click());
      await page.waitForTimeout(1500);
      await canvas.press("v");
      await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.().walk?.ready, null, {
        timeout: 120000,
        polling: 250,
      });
      await page.waitForTimeout(1500);
      const frames = await record(4500, async () => {
        await page.keyboard.down("KeyW");
        await page.waitForTimeout(3000);
        await page.keyboard.up("KeyW");
      });
      await canvas.press("v");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1500);
      return frames;
    },
  };
  const results = {};
  for (const name of scenarioList) {
    let frames = [];
    try {
      frames = await scenarios[name]();
    } catch (error) {
      results[name] = { error: error.message.slice(0, 200) };
      continue;
    }
    results[name] = { ...analyse(name, frames), ...(frames.counters || {}) };
    console.log(name, JSON.stringify(results[name]));
  }
  results.evidence = await evidence().then((e) => ({
    resolution: e.resolution,
    detail: e.detail,
    shadowCache: e.shadowCache,
    frameTiming: e.frameTiming,
  }));
  fs.writeFileSync(path.join(outDir, "flicker.json"), JSON.stringify(results, null, 1));
  await browser.close();
})();

function analyse(name, frames) {
  const n = frames.length;
  if (n < 4) return { frames: n };
  const P = W * H;
  const motion = [],
    accel = [],
    flips = [];
  for (let t = 1; t < n; t++) {
    const a = frames[t - 1].luma,
      b = frames[t].luma;
    let m = 0;
    for (let i = 0; i < P; i++) m += Math.abs(b[i] - a[i]);
    motion.push(m / P);
  }
  for (let t = 1; t < n - 1; t++) {
    const a = frames[t - 1].luma,
      b = frames[t].luma,
      c = frames[t + 1].luma;
    let s = 0,
      f = 0;
    for (let i = 0; i < P; i++) {
      const d1 = b[i] - a[i],
        d2 = c[i] - b[i];
      s += Math.abs(d2 - d1);
      if (Math.abs(d1) > 6 && Math.abs(d2) > 6 && Math.sign(d1) !== Math.sign(d2)) f++;
    }
    accel.push(s / P);
    flips.push(f / P);
  }
  const sorted = [...accel].sort((x, y) => x - y),
    median = sorted[Math.floor(sorted.length / 2)];
  const spikes = accel.map((v, i) => [i + 1, v]).filter(([, v]) => v > Math.max(3 * median, 0.5));
  // Save the worst spike's three frames.
  if (spikes.length) {
    const [t] = spikes.reduce((best, s) => (s[1] > best[1] ? s : best));
    for (const k of [t - 1, t, t + 1]) {
      const png = new PNG({ width: W, height: H });
      const l = frames[k].luma;
      for (let i = 0; i < W * H; i++) {
        png.data[i * 4] = png.data[i * 4 + 1] = png.data[i * 4 + 2] = l[i];
        png.data[i * 4 + 3] = 255;
      }
      fs.writeFileSync(path.join(outDir, `${name}-spike-${k}.png`), PNG.sync.write(png));
    }
  }
  const mean = (v) => v.reduce((x, y) => x + y, 0) / Math.max(1, v.length);
  const intervals = frames.slice(1).map((f, i) => f.at - frames[i].at);
  return {
    frames: n,
    medianIntervalMs: +[...intervals].sort((x, y) => x - y)[Math.floor(intervals.length / 2)].toFixed(1),
    motion: +mean(motion).toFixed(3),
    accel: +mean(accel).toFixed(3),
    accelMedian: +median.toFixed(3),
    flipPerMille: +(1000 * mean(flips)).toFixed(3),
    spikes: spikes.length,
    spikeFrames: spikes.slice(0, 12).map(([i, v]) => `${i}:${v.toFixed(2)}`),
  };
}
