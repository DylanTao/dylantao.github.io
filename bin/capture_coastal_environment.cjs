// Matched captures of the coast's far field: the horizon, the far land, the stars and the planets
// (atmosphere.mjs, haze.mjs, stars.mjs and their neighbours), at night, at dusk and by day, in full
// screen at 2560 x 1440 with a device pixel ratio of 1.5 (Sirui's 45.png) and at the page's embed
// size. Stills are composed with reduced motion on a fixed date, so a before and an after compare.
//
// The scene's modules and models are served from the working tree (or, with COAST_REF, from a git
// ref) rather than from the server's _site, so a no-watch server needs no rebuild between variants.
//
// PowerShell:
//   $env:COAST_BASE_URL = "http://127.0.0.1:4156"; node bin/capture_coastal_environment.cjs after
//   $env:COAST_REF = "4fcafb236"; node bin/capture_coastal_environment.cjs before
//   (COAST_TIMES="night,dusk,day", COAST_VIEWS="zoom-in,zoom-out,...", COAST_SIZES="full,embed" narrow it)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repo = path.resolve(__dirname, "..");
const label = process.argv[2] || "capture";
const out = path.join(repo, `.jekyll-cache/visual-qa/scene-environment-2026-10-19/${label}`);
const base = process.env.COAST_BASE_URL || "http://127.0.0.1:4156";
const ref = process.env.COAST_REF || "";
const date = process.env.COAST_DATE || "2026-10-21";
const query = process.env.COAST_QUERY ? `&${process.env.COAST_QUERY}` : "";
const TIMES = { night: "21:30", dusk: "18:40", day: "13:30", twilight: "19:05", dawn: "06:40", late: "02:30" };
const DEFAULT_TIMES = ["night", "dusk", "day"];
// Three.js world coordinates: x north, y up, z inland (east); the sea lies toward -z.
const VIEWS = {
  // The two ends of the coast's zoom, low enough to see the sky over the mesa.
  "zoom-in": { target: [3, 4, -6], yaw: 3.4, pitch: 0.1, radius: 48 },
  "zoom-out": { target: [3, 4, -6], yaw: 3.4, pitch: 0.1, radius: 160 },
  // The authored outside view and the far coast view as the visitor first sees them.
  "outside-48": { target: [3, -0.2, -6], yaw: 3.48, pitch: 0.37, radius: 48 },
  "outside-160": { target: [3, -0.2, -6], yaw: 3.48, pitch: 0.37, radius: 160 },
  // Sirui's full-screen night view: the cliff face-on from the sea, the mesa and the sky behind.
  "sea-wide": { target: [3, 2, -6], yaw: 3.22, pitch: 0.3, radius: 92 },
  // From the terrace out to sea: the sea horizon, the far water and the sky above it.
  "horizon-west": { target: [3, 1.5, -40], yaw: 0.02, pitch: 0.06, radius: 34 },
  // South along the coast toward La Jolla and Mount Soledad; north toward the gliderport and Del Mar.
  "coast-south": { target: [-140, 4, -10], yaw: 1.32, pitch: 0.12, radius: 150 },
  "coast-north": { target: [190, 12, -10], yaw: -1.62, pitch: 0.12, radius: 160 },
  // Inland over the mesa, from above the house.
  "inland-east": { target: [20, 18, 60], yaw: 3.1, pitch: 0.16, radius: 110 },
  // The sky to the south-west and overhead, where the stars and the planets are.
  "stars-south": { target: [3, 60, -60], yaw: 0.35, pitch: -0.55, radius: 30 },
};
const DEFAULT_VIEWS = ["zoom-in", "zoom-out", "sea-wide", "horizon-west", "stars-south"];
const SIZES = {
  full: { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1.5, fullscreen: true },
  embed: { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, fullscreen: false },
};
const list = (env, fallback) => (process.env[env] ? process.env[env].split(",").filter(Boolean) : fallback);

const TYPES = {
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
};
const cache = new Map();
function body(rel) {
  if (!cache.has(rel)) {
    let content = null;
    try {
      content = ref
        ? execFileSync("git", ["show", `${ref}:${rel}`], { cwd: repo, maxBuffer: 256 << 20 })
        : require("node:fs").readFileSync(path.join(repo, rel));
    } catch {
      content = null;
    }
    cache.set(rel, content);
  }
  return cache.get(rel);
}

async function open(browser, size, time) {
  const page = await browser.newPage({ viewport: size.viewport, deviceScaleFactor: size.deviceScaleFactor });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/404|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  await page.route(/\/assets\/(js\/home-scene\/|models\/home\/)[^?#]+/, (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, "");
    const content = body(rel);
    if (!content) return route.continue();
    return route.fulfill({ status: 200, body: content, headers: { "content-type": TYPES[path.extname(rel)] || "application/octet-stream" } });
  });
  await page.clock.install({ time: new Date(`${date}T${time}:00-07:00`) });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${base}/?scene-lab=1${query}`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]"),
    ui = page.locator("[data-home-world-controls]");
  await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 240000 });
  await ui.locator("[data-world-lab] > summary").click();
  await ui.locator('[data-world-room="outside"]').first().click();
  await scene.scrollIntoViewIfNeeded();
  await page
    .waitForFunction(
      () => {
        const lab = document.querySelector("[data-home-desk-scene]").labScene;
        const land = lab?.scene.getObjectByName("coastal-hinterland"),
          flora = lab?.scene.getObjectByName("clifftop-flora");
        return flora?.visible && land?.visible;
      },
      null,
      { timeout: 180000 }
    )
    .catch(() => errors.push("outside models did not finish loading"));
  await ui.locator("[data-world-lab]").evaluate((e) => (e.open = false));
  if (size.fullscreen) await ui.locator("[data-world-fullscreen]").click();
  await page.waitForTimeout(3000);
  return { page, scene, errors };
}

(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const evidence = { label, base, ref: ref || "working tree", date, query, captures: [], errors: [] };
  try {
    for (const sizeName of list("COAST_SIZES", Object.keys(SIZES))) {
      const size = SIZES[sizeName];
      for (const timeName of list("COAST_TIMES", DEFAULT_TIMES)) {
        const { page, scene, errors } = await open(browser, size, TIMES[timeName] || timeName);
        for (const viewName of list("COAST_VIEWS", DEFAULT_VIEWS)) {
          await scene.evaluate((e, v) => e.setLabCamera(v), VIEWS[viewName]);
          await page.waitForTimeout(2400);
          const data = await scene.evaluate((e) => {
            const evidence = e.getSceneEvidence();
            return {
              camera: evidence.camera,
              clip: evidence.cameraClip,
              drawCalls: evidence.drawCalls,
              atmosphere: evidence.ecology?.atmosphere,
              buffer: evidence.rendering?.resolution ?? null,
            };
          });
          const id = `${timeName}-${viewName}-${sizeName}`;
          await (size.fullscreen ? page : scene).screenshot({ path: path.join(out, `${id}.png`) });
          evidence.captures.push({ id, view: VIEWS[viewName], ...data });
        }
        evidence.errors.push(...errors.map((e) => `${sizeName}/${timeName}: ${e}`));
        await page.close();
      }
    }
  } finally {
    await fs.writeFile(path.join(out, "evidence.json"), JSON.stringify(evidence, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify({ out, captures: evidence.captures.length, errors: evidence.errors }));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
