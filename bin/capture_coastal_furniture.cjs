// Browser evidence for the coastal home's furniture (bin/build_coastal_furniture.py, furniture.mjs):
// each placed piece at the page embed's size and in full screen at a 4K-equivalent screen (2560x1440
// CSS at device scale 1.5), a level-of-detail close-up (the same camera with ?furniture-detail=default
// and with the fine level loaded), and the furniture bytes the embed and full screen download.
//
// The scene's modules and models are served from the working tree, so a capture never races the
// server's regeneration; the page itself comes from FURNITURE_URL. Reduced motion composes stills.
// PowerShell:
//   $env:FURNITURE_URL = "http://127.0.0.1:4155/"
//   node bin/capture_coastal_furniture.cjs .jekyll-cache/visual-qa/furniture/scene
// FURNITURE_ITEMS=eames-lounge,aeron limits the pieces; FURNITURE_PHASES=embed,fullscreen,lod picks
// phases; FURNITURE_MINUTE previews a Pacific minute (default the fixed 13:20).
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const repo = path.resolve(__dirname, "..");
const outDir = path.resolve(process.argv[2] || ".jekyll-cache/visual-qa/furniture/scene");
const baseURL = process.env.FURNITURE_URL || "http://127.0.0.1:4155/";
const phases = (process.env.FURNITURE_PHASES || "embed,fullscreen,lod").split(",");
const fixedTime = process.env.FURNITURE_DATE || "2026-10-02T13:20:00-07:00";
const minute = process.env.FURNITURE_MINUTE ? Number(process.env.FURNITURE_MINUTE) : null;

// Where to look at each piece: the anchor (manifest furniture id), its room, an orbit around a
// target near the piece, and a closer orbit for the level-of-detail pair.
const VIEWS = {
  "eames-lounge": { anchor: "lounge-eames", room: "lounge", target: [3.65, 0.42, -1.05], yaw: Math.PI + 0.62, pitch: 0.3, radius: 2.7, close: 1.2 },
};
const wanted = (process.env.FURNITURE_ITEMS || "").split(",").filter(Boolean);
const items = Object.entries(VIEWS).filter(([item]) => !wanted.length || wanted.includes(item));

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

async function open({ width, height, dpr, query = {} }) {
  const browser = await chromium.launch({ headless: true, args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [] });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, timezoneId: "America/Los_Angeles" });
  const page = await context.newPage();
  page.setDefaultTimeout(240000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && !/status of 404/.test(message.text()) && errors.push(message.text()));
  // Missing files are listed by address (responsive image variants need ImageMagick, absent locally).
  page.on("response", (response) => response.status() === 404 && errors.push(`404 ${new URL(response.url()).pathname}`));
  await page.route(/https:\/\/(?:plausible\.io|www\.google-analytics\.com|www\.googletagmanager\.com)\//, (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/livereload.js*", (route) => route.fulfill({ status: 200, body: "", contentType: "text/javascript" }));
  // Modules and models straight from the working tree.
  await page.route(/\/assets\/(?:js\/.+\.m?js|models\/home\/.+)(?:\?.*)?$/, async (request) => {
    const url = new URL(request.request().url());
    const rel = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const file = path.join(repo, rel);
    // Generated files (plugin scripts) come from the server.
    if (!fs.existsSync(file)) return request.continue();
    const type = rel.endsWith(".json") ? "application/json" : rel.endsWith(".glb") ? "model/gltf-binary" : "text/javascript; charset=utf-8";
    return request.fulfill({ status: 200, body: fs.readFileSync(file), contentType: type });
  });
  await page.addInitScript(seedPage, 7);
  await page.addInitScript(fixDate, fixedTime);
  await page.addInitScript(() => {
    sessionStorage.setItem("theme", "noon");
    sessionStorage.setItem("theme-manual", "true");
    localStorage.setItem("theme", "light");
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const url = new URL(baseURL);
  url.searchParams.set("scene-lab", "1");
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  const host = page.locator("[data-home-desk-scene]");
  await page.locator('[data-home-desk-mode="3d"]').click();
  await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 240000 });
  await host.scrollIntoViewIfNeeded();
  return { browser, page, host, errors };
}

const evidence = (host) => host.evaluate((e) => e.getSceneEvidence());

async function settle(page, host, ms = 1800) {
  await page.waitForTimeout(ms);
  const frames = (await evidence(host)).frames;
  await page.mouse.move(3, 3);
  await page.waitForFunction((f) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().frames > f, frames, { timeout: 60000 });
  await page.waitForTimeout(600);
}

async function visit(page, host, item, view, { radius = view.radius, pitch = view.pitch } = {}) {
  if (minute != null)
    await page.evaluate((m) => {
      const input = document.querySelector("[data-world-time]");
      input.value = String(m);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, minute);
  await page.evaluate((room) => {
    const lab = document.querySelector("[data-world-lab]");
    lab.open = true;
    document.querySelector(`[data-world-room="${room}"]`).click();
    lab.open = false;
  }, view.room);
  await page.waitForFunction((room) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().currentRoom === room, view.room);
  // Every room streamed (so the piece's room is in) and the piece placed.
  await page.waitForFunction(
    (id) => {
      const e = document.querySelector("[data-home-desk-scene]").getSceneEvidence();
      return e.roomCount >= 6 && e.furniture?.placed.some((p) => p.id === id && p.shown >= 0);
    },
    view.anchor,
    { timeout: 240000 }
  );
  await host.evaluate((e, camera) => e.setLabCamera(camera), { target: view.target, yaw: view.yaw, pitch, radius });
}

const furnitureBytes = (e) =>
  e.loading.models.filter((m) => /-lod\d\.glb$/.test(m.asset)).map((m) => ({ asset: m.asset, bytes: m.bytes }));

async function embed(result) {
  const run = await open({ width: 1440, height: 1000, dpr: 1 });
  const { page, host } = run;
  try {
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence().roomCount >= 6, null, { timeout: 240000 });
    await page.waitForTimeout(2500);
    result.embed = { defaultView: furnitureBytes(await evidence(host)) };
    for (const [item, view] of items) {
      await visit(page, host, item, view);
      await settle(page, host);
      const file = path.join(outDir, `${item}-embed.png`);
      await host.locator("canvas").screenshot({ path: file });
      const e = await evidence(host);
      result.embed[item] = { file, canvas: [e.canvasWidth, e.canvasHeight], placed: e.furniture.placed.find((p) => p.id === view.anchor), drawCalls: e.drawCalls };
    }
    result.embed.after = furnitureBytes(await evidence(host));
  } finally {
    result.embed.errors = run.errors;
    await run.browser.close();
  }
}

async function fullscreen(result) {
  const run = await open({ width: 2560, height: 1440, dpr: 1.5 });
  const { page, host } = run;
  try {
    await page.locator("[data-world-fullscreen]").click();
    await page.waitForFunction(() => Boolean(document.querySelector("[data-home-desk-scene]").getSceneEvidence().fullscreen));
    result.fullscreen = {};
    for (const [item, view] of items) {
      await visit(page, host, item, view);
      await page.waitForFunction(
        (id) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().furniture.placed.find((p) => p.id === id)?.shown >= 1,
        view.anchor,
        { timeout: 120000 }
      );
      await settle(page, host, 2500);
      const file = path.join(outDir, `${item}-fullscreen.png`);
      await page.screenshot({ path: file, timeout: 120000 });
      const e = await evidence(host);
      result.fullscreen[item] = { file, canvas: [e.canvasWidth, e.canvasHeight], placed: e.furniture.placed.find((p) => p.id === view.anchor) };
    }
    result.fullscreen.bytes = furnitureBytes(await evidence(host));
  } finally {
    result.fullscreen.errors = run.errors;
    await run.browser.close();
  }
}

// The same close camera, holding the default level and then with the fine level drawn.
async function lod(result) {
  result.lod = {};
  for (const [label, query] of [
    ["default", { "furniture-detail": "default" }],
    ["fine", {}],
  ]) {
    const run = await open({ width: 1440, height: 1000, dpr: 1, query });
    const { page, host } = run;
    try {
      for (const [item, view] of items) {
        await visit(page, host, item, view, { radius: view.close, pitch: view.pitch + 0.08 });
        if (label === "fine")
          await page.waitForFunction(
            (id) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().furniture.placed.find((p) => p.id === id)?.shown >= 1,
            view.anchor,
            { timeout: 120000 }
          );
        await settle(page, host);
        const file = path.join(outDir, `${item}-lod-${label}.png`);
        await host.locator("canvas").screenshot({ path: file });
        const e = await evidence(host);
        result.lod[`${item}:${label}`] = { file, placed: e.furniture.placed.find((p) => p.id === view.anchor), triangles: e.triangles, drawCalls: e.drawCalls };
      }
    } finally {
      result.lod[`errors:${label}`] = run.errors;
      await run.browser.close();
    }
  }
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const result = { url: baseURL, date: fixedTime, minute };
  if (phases.includes("embed")) await embed(result);
  if (phases.includes("fullscreen")) await fullscreen(result);
  if (phases.includes("lod")) await lod(result);
  fs.writeFileSync(path.join(outDir, "furniture-evidence.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
