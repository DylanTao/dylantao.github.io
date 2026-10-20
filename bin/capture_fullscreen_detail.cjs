// Matched full-screen detail evidence for the coastal home at a 4K-equivalent screen: a 2560x1440 CSS
// viewport at device scale 1.5 is a 3840x2160 screen, the case Sirui reported ("ok resolution for a
// small view on 4k screen, but when i go into full page, the details look too rough").
//
// Two phases per run, each in a fresh headless Chromium on this machine's GPU (ANGLE D3D11):
//   1. stills: reduced motion (composed, deterministic frames), seeded randomness and a fixed Date,
//      full screen, then the study, the living room and the gym (previewed at 18:30, mid-workout).
//      Each view is saved whole and as a 1:1 device-pixel crop of its centre.
//   2. motion: the same views with motion on, sampling frame intervals, the scene's own script time,
//      the GPU timer (the lab's EXT_disjoint_timer_query), the drawing buffer and the resolution
//      governor, and the Chrome GPU process's memory from Windows' GPU Process Memory counters.
//
// PowerShell (Bash env prefixes break npx/node paths on this machine):
//   $env:FULLSCREEN_DETAIL_URL = "http://127.0.0.1:4153/"
//   node bin/capture_fullscreen_detail.cjs .jekyll-cache/visual-qa/fullscreen-detail/after
// FULLSCREEN_DETAIL_REF=HEAD serves every scene module that differs from that ref at the ref instead
// (the "before" of an uncommitted change); FULLSCREEN_DETAIL_PHASES=stills|motion runs one phase;
// FULLSCREEN_DETAIL_SECONDS sets each motion sample (default 6); FULLSCREEN_DETAIL_QUERY adds URL flags.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repo = path.resolve(__dirname, "..");
const outDir = path.resolve(process.argv[2] || ".jekyll-cache/visual-qa/fullscreen-detail/current");
const baseURL = process.env.FULLSCREEN_DETAIL_URL || "http://127.0.0.1:4153/";
const ref = process.env.FULLSCREEN_DETAIL_REF || null;
const phases = (process.env.FULLSCREEN_DETAIL_PHASES || "stills,motion").split(",");
const seconds = Number(process.env.FULLSCREEN_DETAIL_SECONDS || 6);
const width = Number(process.env.FULLSCREEN_DETAIL_WIDTH || 2560);
const height = Number(process.env.FULLSCREEN_DETAIL_HEIGHT || 1440);
const dpr = Number(process.env.FULLSCREEN_DETAIL_DPR || 1.5);
const extraQuery = process.env.FULLSCREEN_DETAIL_QUERY || "";
const fixedTime = "2026-10-02T13:20:00-07:00";
const allViews = [
  { name: "study", room: "study" },
  { name: "lounge", room: "lounge" },
  // 18:30 on a Friday is mid-workout: Sirui at the rack (the manifest's workout runs 18:00-20:00).
  { name: "gym", room: "gym", minute: 18 * 60 + 30 },
];
// FULLSCREEN_DETAIL_VIEWS=study,gym limits the views.
const wanted = (process.env.FULLSCREEN_DETAIL_VIEWS || "").split(",").filter(Boolean);
const views = wanted.length ? allViews.filter((view) => wanted.includes(view.name)) : allViews;

const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 << 20 });
const changed = new Set();
if (ref)
  for (const line of [
    ...git("diff", "--name-only", ref, "--", "assets/js").split(/\r?\n/),
    ...git("ls-files", "--others", "--exclude-standard", "--", "assets/js").split(/\r?\n/),
  ])
    if (line.trim()) changed.add(line.trim().replaceAll("\\", "/"));

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
    apply: () => new NativeDate(fixed).toString(),
    construct: (target, args) => Reflect.construct(target, args.length ? args : [fixed]),
    get: (target, key) => (key === "now" ? () => fixed : Reflect.get(target, key)),
  });
}

function gpuProcessMemory(pid) {
  if (process.platform !== "win32" || !pid) return null;
  try {
    const script = `$s = Get-Counter -Counter @('\\GPU Process Memory(pid_${pid}_*)\\Dedicated Usage','\\GPU Process Memory(pid_${pid}_*)\\Shared Usage') -ErrorAction Stop; $d = 0; $h = 0; foreach ($c in $s.CounterSamples) { if ($c.Path -like '*dedicated usage') { $d += $c.CookedValue } else { $h += $c.CookedValue } }; "$d $h"`;
    const [dedicated, shared] = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], { encoding: "utf8" })
      .trim()
      .split(/\s+/)
      .map(Number);
    return {
      dedicatedMB: Math.round(dedicated / 1048576),
      sharedMB: Math.round(shared / 1048576),
      totalMB: Math.round((dedicated + shared) / 1048576),
    };
  } catch {
    return null;
  }
}

async function openHome(reducedMotion) {
  const browser = await chromium.launch({
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, timezoneId: "America/Los_Angeles" });
  const page = await context.newPage();
  page.setDefaultTimeout(180000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/https:\/\/(?:plausible\.io|www\.google-analytics\.com|www\.googletagmanager\.com)\//, (route) =>
    route.fulfill({ status: 200, body: "" })
  );
  await page.route("**/livereload.js*", (route) => route.fulfill({ status: 200, body: "", contentType: "text/javascript" }));
  await page.route(/\/assets\/js\/.+\.m?js(?:\?.*)?$/, async (request) => {
    const url = new URL(request.request().url());
    const rel = "assets/js/" + decodeURIComponent(url.pathname.split("/assets/js/")[1]);
    // Scripts come from the working tree (or the ref) directly, so a capture never waits for, or
    // races, the server's regeneration of the site.
    let text = null;
    if (ref && changed.has(rel)) {
      try {
        text = execFileSync("git", ["show", `${ref}:${rel}`], { cwd: repo, maxBuffer: 64 << 20 }).toString("utf8");
      } catch {
        return request.fulfill({ status: 404, body: "" });
      }
    } else if (fs.existsSync(path.join(repo, rel))) text = fs.readFileSync(path.join(repo, rel), "utf8");
    else return request.continue();
    if (rel.endsWith("three.module.min.js")) text = text.replaceAll("4294967295*Math.random()|0", "4294967295*__profileUuidRandom()|0");
    return request.fulfill({ status: 200, body: text, contentType: "text/javascript; charset=utf-8" });
  });
  await page.addInitScript(seedPage, 7);
  await page.addInitScript(fixDate, fixedTime);
  await page.addInitScript(() => {
    sessionStorage.setItem("theme", "noon");
    sessionStorage.setItem("theme-manual", "true");
    localStorage.setItem("theme", "light");
  });
  await page.emulateMedia({ reducedMotion });
  const url = new URL(baseURL);
  url.searchParams.set("scene-lab", "1");
  for (const [key, value] of new URLSearchParams(extraQuery)) url.searchParams.set(key, value);
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  const host = page.locator("[data-home-desk-scene]");
  await page.locator('[data-home-desk-mode="3d"]').click();
  await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 240000 });
  await host.scrollIntoViewIfNeeded();
  await page.locator("[data-world-fullscreen]").click();
  await page.waitForFunction(() => Boolean(document.querySelector("[data-home-desk-scene]").getSceneEvidence().fullscreen));
  // Every room streamed and the static light field baked: the steady state.
  await page.waitForFunction(
    () => {
      const e = document.querySelector("[data-home-desk-scene]").getSceneEvidence();
      return e.roomCount >= 6 && e.simulation?.lightField?.ready;
    },
    null,
    { timeout: 240000 }
  );
  const browserCDP = await browser.newBrowserCDPSession();
  const info = await browserCDP.send("SystemInfo.getProcessInfo").catch(() => null);
  const gpuPid = info?.processInfo?.find((entry) => entry.type === "GPU")?.id ?? null;
  const gpu = await browserCDP
    .send("SystemInfo.getInfo")
    .then((result) => result.gpu?.devices?.map((d) => d.deviceString))
    .catch(() => null);
  return { browser, page, host, errors, gpuPid, gpu };
}

async function goTo(page, host, view) {
  if (view.minute != null)
    await page.evaluate((minute) => {
      const input = document.querySelector("[data-world-time]");
      input.value = String(minute);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, view.minute);
  await page.evaluate((room) => {
    const lab = document.querySelector("[data-world-lab]");
    lab.open = true;
    document.querySelector(`[data-world-room="${room}"]`).click();
    lab.open = false;
  }, view.room);
  await page.waitForFunction((room) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().currentRoom === room, view.room);
}

async function stills() {
  const run = await openHome("reduce");
  const { page, host } = run;
  const result = { gpu: run.gpu, views: {} };
  try {
    for (const view of views) {
      await goTo(page, host, view);
      // A composed still: wait for the frame counter to settle, then two more frames.
      await page.waitForTimeout(2500);
      const frames = await host.evaluate((e) => e.getSceneEvidence().frames);
      await page.mouse.move(2, 2);
      await page.waitForFunction((f) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().frames >= f, frames, { timeout: 30000 });
      await page.waitForTimeout(1500);
      const file = path.join(outDir, `${view.name}.png`);
      await page.screenshot({ path: file, timeout: 120000 });
      const evidence = await host.evaluate((e) => {
        const x = e.getSceneEvidence();
        return { canvas: [x.canvasWidth, x.canvasHeight], resolution: x.resolution, rendering: x.rendering, camera: x.camera, fov: x.cameraFov };
      });
      result.views[view.name] = { file, ...evidence };
    }
  } finally {
    result.errors = run.errors;
    await run.browser.close();
  }
  return result;
}

async function motion() {
  const run = await openHome("no-preference");
  const { page, host } = run;
  const result = { gpu: run.gpu, gpuPid: run.gpuPid, views: {} };
  try {
    for (const view of views) {
      await goTo(page, host, view);
      // Let the resolution governor settle (it decides about once a second on slow frames).
      await page.waitForTimeout(8000);
      const before = await host.evaluate((e) => e.getSceneEvidence().frames);
      const memory = gpuProcessMemory(run.gpuPid);
      await page.waitForTimeout(seconds * 1000);
      const after = await host.evaluate((e) => {
        const x = e.getSceneEvidence();
        return {
          frames: x.frames,
          frameTiming: x.frameTiming,
          gpu: x.rendering?.gpu,
          canvas: [x.canvasWidth, x.canvasHeight],
          resolution: x.resolution,
          rendering: { ...x.rendering, gpu: undefined },
          drawCalls: x.drawCalls,
          resources: x.resources,
        };
      });
      result.views[view.name] = {
        ...after,
        fps: Math.round(((after.frames - before) / seconds) * 10) / 10,
        gpuProcessMemory: memory,
        memoryAfter: gpuProcessMemory(run.gpuPid),
      };
      console.log(
        view.name,
        JSON.stringify({
          fps: result.views[view.name].fps,
          canvas: after.canvas,
          frameMs: after.frameTiming?.medianFrameMs,
          gpuMs: after.gpu?.medianMs,
          memory,
        })
      );
    }
  } finally {
    result.errors = run.errors;
    await run.browser.close();
  }
  return result;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const report = { checkedAt: new Date().toISOString(), baseURL, ref, changed: [...changed], width, height, dpr, fixedTime, extraQuery };
  if (phases.includes("stills")) report.stills = await stills();
  if (phases.includes("motion")) report.motion = await motion();
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(path.join(outDir, "report.json"));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
