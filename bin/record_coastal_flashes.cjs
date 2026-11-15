// Finds flashes in the 3D home: single frames that jump and come back, and sudden changes of
// overall brightness (docs/november-2026-takeover.md, H7). Every frame the scene draws is copied,
// in the task that drew it, into a small canvas and kept as luma. Afterwards each frame gets
//   step   the change of mean brightness from the frame before (0-255);
//   flip   the share of pixels (per mille) that changed by more than 12 and changed back;
//   diff   the mean absolute change per pixel;
// and the worst frames are saved as PNG triples beside a JSON log of the room, the light levels,
// the quality tier and the drawing buffer at about two samples a second.
//
// Under automation the scene pins its quality tier; pass --query=quality=auto to see what a
// visitor's machine does. Scenarios:
//   orbitOutside            slow drags of the coast view
//   orbitRoom:<id>          the same in a room
//   still:<id>              nothing moves but the scene
//   roomSwitch              lounge, kitchen and back, sampling the kitchen's light levels
//   walkEntrance            Walk from --from (default the entrance) along the entry route by keyboard;
//                           --stopAt=<waypoint> --stand=<seconds> then stands and looks up
//
// PowerShell, against a no-watch preview:
//   node bin/record_coastal_flashes.cjs <outPrefix> [--base=http://127.0.0.1:4101/al-folio]
//     [--w=2560] [--h=1440] [--dpr=1] [--time=ISO] [--query=a=b] [--scenario=...] [--seconds=40] [--live]
// --live serves the working tree's scene modules and models over the built site.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
(async () => {
  const [outPrefix, ...rest] = process.argv.slice(2);
  const opt = Object.fromEntries(
    rest.map((a) => {
      const m = a.match(/^--([^=]+)(?:=([\s\S]*))?$/);
      return [m[1], m[2] ?? true];
    })
  );
  const w = Number(opt.w || 2560),
    h = Number(opt.h || 1440),
    seconds = Number(opt.seconds || 40);
  const scenario = String(opt.scenario || "orbitOutside");
  const W = 192,
    H = 108;
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"] });
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: Number(opt.dpr || 1),
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 300)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/404/.test(m.text())) errors.push("console: " + m.text().slice(0, 300));
  });
  // The fake clock replaces requestAnimationFrame, so it goes in first and the recorder wraps it.
  if (opt.time) await page.clock.setFixedTime(new Date(opt.time));
  await page.addInitScript(
    ({ W, H }) => {
      window.sessionStorage.setItem("theme", "light");
      window.sessionStorage.setItem("theme-manual", "true");
      window.localStorage.setItem("theme", "light");
      const cap = (window.__flash = { frames: [], times: [], recording: false, canvas: null, ctx: null });
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) =>
        raf((now) => {
          // Only the callback that drew the frame can read it: a WebGL canvas read from any other
          // task has already gone to the compositor and reads as empty.
          const drawnBefore = document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.().frames;
          cb(now);
          if (!cap.recording) return;
          const source = document.querySelector("[data-home-desk-scene] canvas");
          if (!source || !source.width) return;
          if (!cap.canvas) {
            cap.canvas = document.createElement("canvas");
            cap.canvas.width = W;
            cap.canvas.height = H;
            cap.ctx = cap.canvas.getContext("2d", { willReadFrequently: true });
          }
          if (document.querySelector("[data-home-desk-scene]").getSceneEvidence?.().frames === drawnBefore) return; // this callback drew nothing
          // The page shows through a cleared (transparent) canvas, so draw each frame over white:
          // without this a blank frame would leave the previous copy in place and go unseen.
          cap.ctx.fillStyle = "#fff";
          cap.ctx.fillRect(0, 0, W, H);
          cap.ctx.drawImage(source, 0, 0, W, H);
          const d = cap.ctx.getImageData(0, 0, W, H).data;
          const luma = new Uint8Array(W * H);
          for (let i = 0; i < W * H; i++) luma[i] = (d[i * 4] * 54 + d[i * 4 + 1] * 183 + d[i * 4 + 2] * 19) >> 8;
          cap.frames.push(luma);
          cap.times.push(now);
        });
    },
    { W, H }
  );
  if (opt.live)
    await page.route(/\/assets\/(js\/home-scene\/[^?#]+\.mjs|models\/home\/[^?#]+\.(glb|json))(\?.*)?$/, async (route) => {
      const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^.*?\/assets\//, "assets/");
      const file = path.join(ROOT, rel);
      if (!fs.existsSync(file)) return route.continue();
      await route.fulfill({ path: file });
    });
  const q = ["scene-lab=1"].concat(opt.query ? [opt.query] : []).join("&");
  const base = String(opt.base || "http://127.0.0.1:4101/al-folio").replace(/\/$/, "");
  await page.goto(`${base}/?${q}`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-desk-mode="3d"]').click();
  await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.getAttribute("data-scene-state") === "ready", null, {
    timeout: 240000,
  });
  const ui = page.locator("[data-home-world-controls]");
  const canvas = page.locator("[data-home-desk-scene] canvas").first();
  const ev = () => page.evaluate(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence());
  const dest = async (id) => {
    const d = ui.locator("[data-world-places]");
    if (!(await d.evaluate((e) => e.open))) await d.locator("summary").first().click();
    await ui.locator(`[data-world-destination="${id}"]`).first().click({ timeout: 15000 });
    if (await d.evaluate((e) => e.open)) await d.locator("summary").first().click();
  };
  if (!opt.embed) {
    await ui.locator("[data-world-fullscreen]").first().click({ timeout: 15000 });
    await page.waitForTimeout(2500);
  }
  const log = [];
  const sample = async (label = "") => {
    const e = await ev();
    log.push({
      t: await page.evaluate(() => performance.now()),
      label,
      room: e.currentRoom,
      frames: e.frames,
      resolution: e.resolution && {
        factor: e.resolution.factor,
        pixels: e.resolution.pixels,
        adaptive: e.resolution.adaptive,
        failedProbes: e.resolution.failedProbes,
        history: e.resolution.history?.length,
      },
      quality: e.quality && { tier: e.quality.tier, state: e.quality.state, switches: e.quality.switches },
      shadow: e.shadowCache && { rebuilds: e.shadowCache.rebuilds, frames: e.shadowCache.frames },
      levels: e.simulation?.installations?.levels,
      walk: e.walk && { room: e.walk.room, position: e.walk.position, yaw: e.walk.yaw },
    });
    return e;
  };
  const start = () =>
    page.evaluate(() => {
      const c = window.__flash;
      c.frames = [];
      c.times = [];
      c.recording = true;
    });
  const box = await canvas.boundingBox();
  const centre = [box.x + box.width / 2, box.y + box.height * 0.45];

  if (scenario === "orbitOutside" || scenario.startsWith("orbitRoom:") || scenario.startsWith("still:")) {
    const id = scenario.includes(":") ? scenario.split(":")[1] : "outside";
    await dest(id);
    await page.waitForTimeout(5000);
    await sample("start");
    await start();
    const until = Date.now() + seconds * 1000;
    let k = 0;
    while (Date.now() < until) {
      if (!scenario.startsWith("still:")) {
        // A slow continuous drag back and forth, so the scene keeps moving and measuring.
        await page.mouse.move(...centre);
        await page.mouse.down();
        const dx = (k % 2 ? -1 : 1) * box.width * 0.12;
        await page.mouse.move(centre[0] + dx, centre[1], { steps: 30 });
        await page.mouse.up();
      }
      await page.waitForTimeout(scenario.startsWith("still:") ? 1000 : 250);
      await sample(`step ${k++}`);
    }
  } else if (scenario === "roomSwitch") {
    // Rooms -> lounge, then the kitchen, then back: how the kitchen's light levels move in time.
    await dest("lounge");
    await page.waitForTimeout(4000);
    await start();
    const series = [];
    const watch = async (label, ms) => {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        const e = await ev();
        const lv = e.simulation?.installations?.levels || {};
        series.push({
          t: Math.round(await page.evaluate(() => performance.now())),
          label,
          room: e.currentRoom,
          dining: +lv.dining?.toFixed(3),
          downlights: +lv.downlights?.toFixed(3),
          settling: e.simulation?.installations?.settling,
        });
        await page.waitForTimeout(40);
      }
    };
    await watch("lounge", 400);
    await dest("kitchen");
    await watch("kitchen", 2600);
    await dest("lounge");
    await watch("lounge again", 4200);
    fs.writeFileSync(`${outPrefix}-series.json`, JSON.stringify(series));
  } else if (scenario === "walkEntrance") {
    await dest(opt.from || "entrance");
    await page.waitForTimeout(4000);
    for (let i = 0; i < 90; i++) {
      if ((await ev()).walk?.ready) break;
      await page.waitForTimeout(1000);
    }
    await page.locator("[data-world-walk]").first().click();
    await page.waitForTimeout(1500);
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/models/home/manifest.json"), "utf8"));
    const route = manifest.entrance.route.slice().reverse();
    const first = await sample("walk start");
    console.error("walk keys:", Object.keys(first.walk || {}).join(","));
    await start();
    const held = new Set();
    const hold = async (code, on) => {
      if (on && !held.has(code)) {
        held.add(code);
        await page.keyboard.down(code);
      } else if (!on && held.has(code)) {
        held.delete(code);
        await page.keyboard.up(code);
      }
    };
    const until = Date.now() + seconds * 1000;
    let index = 0,
      k = 0;
    const stopAt = opt.stopAt ? Number(opt.stopAt) : route.length;
    while (Date.now() < until && index < Math.min(route.length, stopAt)) {
      const e = await ev();
      const p = e.walk.position,
        yaw = e.walk.yaw ?? e.walk.heading ?? 0;
      while (index < route.length && Math.hypot(route[index][0] - p[0], route[index][2] - p[2]) < 0.4) index++;
      if (index >= route.length) break;
      const want = Math.atan2(route[index][0] - p[0], route[index][2] - p[2]);
      const error = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
      await hold("ArrowLeft", error > 0.1);
      await hold("ArrowRight", error < -0.1);
      await hold("KeyW", Math.abs(error) < 0.7);
      if (k++ % 2 === 0) await sample(`waypoint ${index}`);
      await page.waitForTimeout(60);
    }
    for (const code of [...held]) await hold(code, false);
    await sample(`walk end at waypoint ${index} of ${route.length}`);
    if (opt.stand) {
      // Stand still, look up at the ceiling, and record only the standing frames.
      await page.keyboard.down("PageUp");
      await page.waitForTimeout(Number(opt.lookUp || 700));
      await page.keyboard.up("PageUp");
      await page.waitForTimeout(1500);
      await canvas.screenshot({ path: `${outPrefix}-stand.png` });
      await start();
      const standUntil = Date.now() + Number(opt.stand) * 1000;
      while (Date.now() < standUntil) {
        await page.waitForTimeout(500);
        await sample("standing");
      }
    }
  }
  await page.waitForTimeout(300);
  const result = await page.evaluate(
    ({ W, H }) => {
      const c = window.__flash;
      c.recording = false;
      const n = c.frames.length,
        size = W * H;
      const mean = c.frames.map((f) => {
        let s = 0;
        for (let i = 0; i < size; i++) s += f[i];
        return s / size;
      });
      const rows = [];
      for (let t = 1; t < n - 1; t++) {
        const a = c.frames[t - 1],
          b = c.frames[t],
          d = c.frames[t + 1];
        let diff = 0,
          flip = 0,
          big = 0;
        for (let i = 0; i < size; i++) {
          const u = b[i] - a[i],
            v = d[i] - b[i];
          diff += Math.abs(u);
          if (Math.abs(u) > 12 && Math.abs(v) > 12 && u * v < 0) flip++;
          if (Math.abs(u) > 40) big++;
        }
        rows.push({
          t,
          at: Math.round(c.times[t]),
          interval: Math.round(c.times[t] - c.times[t - 1]),
          mean: +mean[t].toFixed(2),
          step: +(mean[t] - mean[t - 1]).toFixed(2),
          diff: +(diff / size).toFixed(2),
          flip: +((1000 * flip) / size).toFixed(1),
          big: +((1000 * big) / size).toFixed(1),
        });
      }
      const png = (f) => {
        const cv = document.createElement("canvas");
        cv.width = W;
        cv.height = H;
        const x = cv.getContext("2d"),
          img = x.createImageData(W, H);
        for (let i = 0; i < size; i++) {
          img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = f[i];
          img.data[i * 4 + 3] = 255;
        }
        x.putImageData(img, 0, 0);
        return cv.toDataURL("image/png").split(",")[1];
      };
      const median = (values) => values.slice().sort((p, q) => p - q)[Math.floor(values.length / 2)] ?? 0;
      const flipMedian = median(rows.map((r) => r.flip)),
        diffMedian = median(rows.map((r) => r.diff));
      const byFlip = rows
        .slice()
        .sort((p, q) => q.flip - p.flip)
        .slice(0, 6);
      const byStep = rows
        .slice()
        .sort((p, q) => Math.abs(q.step) - Math.abs(p.step))
        .slice(0, 6);
      const picks = [...new Set([...byFlip.slice(0, 3), ...byStep.slice(0, 3)].map((r) => r.t))];
      return {
        frames: n,
        seconds: n ? +((c.times[n - 1] - c.times[0]) / 1000).toFixed(1) : 0,
        medianInterval: median(rows.map((r) => r.interval)),
        flipMedian,
        diffMedian,
        byFlip,
        byStep,
        images: picks.map((t) => ({ t, pngs: [t - 1, t, t + 1].map((k) => png(c.frames[k])) })),
      };
    },
    { W, H }
  );
  for (const { t, pngs } of result.images) pngs.forEach((data, i) => fs.writeFileSync(`${outPrefix}-f${t}-${i}.png`, Buffer.from(data, "base64")));
  delete result.images;
  const final = await ev();
  fs.writeFileSync(
    `${outPrefix}.json`,
    JSON.stringify({ scenario, result, log, resolution: final.resolution, quality: final.quality, shadowCache: final.shadowCache, errors }, null, 1)
  );
  console.log(
    JSON.stringify({
      scenario,
      frames: result.frames,
      seconds: result.seconds,
      medianInterval: result.medianInterval,
      flipMedian: result.flipMedian,
      diffMedian: result.diffMedian,
      byFlip: result.byFlip.slice(0, 4),
      byStep: result.byStep.slice(0, 4),
      resolution: final.resolution,
      quality: final.quality,
      errors: errors.slice(0, 4),
    })
  );
  await browser.close();
})();
