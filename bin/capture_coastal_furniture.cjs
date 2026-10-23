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
const houseRepo = process.env.FURNITURE_HOUSE_ROOT ? path.resolve(process.env.FURNITURE_HOUSE_ROOT) : repo;
const phases = (process.env.FURNITURE_PHASES || "embed,fullscreen,lod").split(",");
const fixedTime = process.env.FURNITURE_DATE || "2026-10-02T13:20:00-07:00";
const minute = process.env.FURNITURE_MINUTE ? Number(process.env.FURNITURE_MINUTE) : null;

// Where to look at each piece: the anchor (manifest furniture id), its room, an orbit around a
// target near the piece, and a closer orbit for the level-of-detail pair.
const VIEWS = {
  "eames-lounge": {
    anchor: "living-eames-lounge",
    room: "lounge",
    target: [4.15, 0.42, -3],
    yaw: Math.PI + 0.5,
    pitch: 0.3,
    radius: 1.4,
    close: 1.2,
  },
  aeron: { anchor: "study-aeron", room: "study", target: [-0.36, 3.23, 3.55], yaw: 1.9, pitch: 0.3, radius: 1.7, close: 0.9 },
  "italian-range": {
    anchor: "kitchen-range",
    room: "kitchen",
    target: [-4.37, 1.3, 2.06],
    yaw: Math.PI / 2 - 0.1,
    pitch: 0.12,
    radius: 3.1,
    close: 1.2,
  },
  "glass-fridge": {
    anchor: "kitchen-glass-fridge",
    room: "kitchen",
    target: [-4.37, 1.15, 3.64],
    yaw: Math.PI / 2 - 0.2,
    pitch: 0.1,
    radius: 2.5,
    close: 1.4,
  },
  "dining-table": { anchor: "dining-table", room: "kitchen", target: [-1.85, 0.5, 3.05], yaw: Math.PI, pitch: 0.5, radius: 3, close: 1.7 },
  "cast-iron-pan": { anchor: "gym-pan", room: "gym", target: [6.75, 0.9, -1.15], yaw: Math.PI, pitch: 0.7, radius: 1.1, close: 0.7 },
  "floating-fireplace": {
    anchor: "living-fireplace",
    room: "lounge",
    target: [0.95, 0.55, -1.15],
    yaw: Math.PI + 0.4,
    pitch: 0.15,
    radius: 1.8,
    close: 1,
  },
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
  const browser = await chromium.launch({
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, timezoneId: "America/Los_Angeles" });
  const page = await context.newPage();
  page.setDefaultTimeout(240000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && !/status of 404/.test(message.text()) && errors.push(message.text()));
  // Missing files are listed by address (responsive image variants need ImageMagick, absent locally).
  page.on("response", (response) => response.status() === 404 && errors.push(`404 ${new URL(response.url()).pathname}`));
  await page.route(/https:\/\/(?:plausible\.io|www\.google-analytics\.com|www\.googletagmanager\.com)\//, (route) =>
    route.fulfill({ status: 200, body: "" })
  );
  await page.route("**/livereload.js*", (route) => route.fulfill({ status: 200, body: "", contentType: "text/javascript" }));
  // Modules and models straight from the working tree.
  await page.route(/\/assets\/(?:js\/.+\.m?js|models\/home\/.+)(?:\?.*)?$/, async (request) => {
    const url = new URL(request.request().url());
    const rel = decodeURIComponent(url.pathname.slice(url.pathname.indexOf("/assets/") + 1));
    const houseFile =
      (rel.startsWith("assets/models/home/") && !rel.startsWith("assets/models/home/furniture/")) ||
      rel === "assets/js/home-scene/light-installations.mjs";
    const file = path.join(houseFile ? houseRepo : repo, rel);
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
  await host.scrollIntoViewIfNeeded();
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

const furnitureBytes = (e) => e.loading.models.filter((m) => /-lod\d\.glb$/.test(m.asset)).map((m) => ({ asset: m.asset, bytes: m.bytes }));

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
      result.embed[item] = {
        file,
        canvas: [e.canvasWidth, e.canvasHeight],
        placed: e.furniture.placed.find((p) => p.id === view.anchor),
        drawCalls: e.drawCalls,
      };
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
        (id) =>
          document
            .querySelector("[data-home-desk-scene]")
            .getSceneEvidence()
            .furniture.placed.find((p) => p.id === id)?.shown >= 1,
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
            (id) =>
              document
                .querySelector("[data-home-desk-scene]")
                .getSceneEvidence()
                .furniture.placed.find((p) => p.id === id)?.shown >= 1,
            view.anchor,
            { timeout: 120000 }
          );
        await settle(page, host);
        const file = path.join(outDir, `${item}-lod-${label}.png`);
        await host.locator("canvas").screenshot({ path: file });
        const e = await evidence(host);
        result.lod[`${item}:${label}`] = {
          file,
          placed: e.furniture.placed.find((p) => p.id === view.anchor),
          triangles: e.triangles,
          drawCalls: e.drawCalls,
        };
      }
    } finally {
      result.lod[`errors:${label}`] = run.errors;
      await run.browser.close();
    }
  }
}

async function acceptance(result) {
  const run = await open({ width: 1440, height: 1000, dpr: 1, query: { "furniture-detail": "fine" } });
  const { page, host } = run;
  result.acceptance = {};
  const shot = async (name) => {
    await settle(page, host);
    await host.locator("canvas").screenshot({ path: path.join(outDir, `${name}.png`) });
    result.acceptance[name] = (await evidence(host)).furniture;
  };
  try {
    for (const id of ["eames-lounge", "aeron", "italian-range"]) {
      await visit(page, host, id, VIEWS[id]);
      await shot(`${id}-clear`);
    }
    await visit(page, host, "aeron", VIEWS.aeron);
    await page.locator("[data-world-aeron]").evaluate((e) => {
      e.value = "mineral";
      e.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await shot("aeron-mineral");
    await visit(page, host, "glass-fridge", VIEWS["glass-fridge"]);
    await page.locator('[data-furniture-part="fridge"]').evaluate((e) => e.click());
    await shot("glass-fridge-open");
    await page.locator("[data-world-activity]").evaluate((e) => {
      e.value = "workout";
      e.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const second = await page.evaluate(async () => {
      const config = await (await fetch(new URL("assets/models/home/manifest.json", location.href))).json();
      const { trainingAt } = await import(new URL("assets/js/home-scene/training.mjs", location.href));
      const info = trainingAt(config.training, "2026-10-02", 1110, 0, { force: true });
      return info.timeline.segments.find((s) => s.kind === "superset" && s.lift === "pan-raise").start + 5;
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await host.evaluate((e, s) => {
      e.setLabSessionSeconds(s);
      e.setLabCamera({ target: [7.1, 0.95, -1.35], yaw: Math.PI - 0.6, pitch: 0.1, radius: 2.2 });
    }, second);
    await page.waitForFunction(() =>
      document
        .querySelector("[data-home-desk-scene]")
        .getSceneEvidence()
        .furniture.placed.some((p) => p.id === "gym-pan" && p.held)
    );
    await shot("pan-raise");
    result.acceptance.panPose = await evidence(host);
    await host.evaluate((e) => e.setLabSessionSeconds(0));
    await page.waitForFunction(
      () =>
        !document
          .querySelector("[data-home-desk-scene]")
          .getSceneEvidence()
          .furniture.placed.find((p) => p.id === "gym-pan").held
    );
    result.acceptance.panReturned = true;
  } finally {
    result.acceptance.errors = run.errors;
    await run.browser.close();
  }
}

async function phone(result) {
  const run = await open({ width: 390, height: 1000, dpr: 1 });
  result.phone = {};
  try {
    await visit(run.page, run.host, "floating-fireplace", VIEWS["floating-fireplace"]);
    await settle(run.page, run.host);
    await run.page.screenshot({ path: path.join(outDir, "furniture-phone.png") });
    const e = await evidence(run.host);
    result.phone = {
      canvas: [e.canvasWidth, e.canvasHeight],
      furniture: e.furniture,
      overflow: await run.page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      errors: run.errors,
    };
  } finally {
    await run.browser.close();
  }
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const result = { url: baseURL, date: fixedTime, minute };
  if (phases.includes("embed")) await embed(result);
  if (phases.includes("fullscreen")) await fullscreen(result);
  if (phases.includes("lod")) await lod(result);
  if (phases.includes("acceptance")) await acceptance(result);
  if (phases.includes("phone")) await phone(result);
  fs.writeFileSync(path.join(outDir, "furniture-evidence.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
