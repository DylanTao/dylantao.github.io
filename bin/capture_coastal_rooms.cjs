// Browser captures of the coastal home's rooms from a local server, for renovation reviews.
//   node bin/capture_coastal_rooms.cjs <out-dir> [shots.json]
// Each shot: { name, room, activity?, avatar?, period?: "day"|"night", camera?: {target,yaw,pitch,radius}, minute? }.
// Defaults to every room's arrival view at the occupied activity. COAST_BASE_URL picks the server.
// Stills use reduced motion so the routine composes a still pose; livereload is stubbed so a model
// export during the run cannot reload the page. The scene's modules and models are served straight
// from this checkout (COAST_SOURCE=work, the default) or from a git revision (COAST_SOURCE=HEAD),
// so a served site never needs a Jekyll rebuild between captures.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = process.env.COAST_SOURCE || "work";
const TYPES = { ".mjs": "text/javascript", ".js": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json" };
async function sceneFile(route) {
  const url = new URL(route.request().url());
  const relative = decodeURIComponent(url.pathname).replace(/^\//, "");
  const type = TYPES[path.extname(relative)] || "application/octet-stream";
  try {
    const body =
      SOURCE === "work"
        ? await fs.readFile(path.join(ROOT, relative))
        : execFileSync("git", ["show", `${SOURCE}:${relative}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
    await route.fulfill({ status: 200, contentType: type, body });
  } catch {
    await route.continue();
  }
}

const ROOM_ACTIVITY = { study: "work", kitchen: "breakfast", gym: "workout", onsen: "soak", lounge: "lounge", sleep: "sleep" };

(async () => {
  const output = path.resolve(process.argv[2] || ".jekyll-cache/visual-qa/rooms");
  await fs.mkdir(output, { recursive: true });
  const shots = process.argv[3]
    ? JSON.parse(await fs.readFile(process.argv[3], "utf8"))
    : Object.entries(ROOM_ACTIVITY).map(([room, activity]) => ({ name: room, room, activity }));
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const baseURL = (process.env.COAST_BASE_URL || "http://127.0.0.1:4133").replace(/\/$/, "");
  const width = Number(process.env.COAST_WIDTH || 1440);
  const report = [];
  try {
    for (const period of [...new Set(shots.map((s) => s.period || "day"))]) {
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 800 : width === 768 ? 1024 : 1000 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e.stack || e)));
      await page.route("**/livereload.js*", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
      await page.route("**/assets/js/home-scene/**", sceneFile);
      await page.route("**/assets/models/home/**", sceneFile);
      await page.emulateMedia({ reducedMotion: process.env.COAST_MOTION === "live" ? "no-preference" : "reduce" });
      await page.addInitScript((period) => {
        sessionStorage.setItem("theme", period === "night" ? "evening" : "noon");
        sessionStorage.setItem("theme-manual", "true");
      }, period);
      await page.goto(baseURL + "/?scene-lab=1", { waitUntil: "domcontentloaded" });
      await page.locator('[data-home-desk-mode="3d"]').click();
      const scene = page.locator("[data-home-desk-scene]");
      await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 180000 });
      const ui = page.locator("[data-home-world-controls]");
      // Stills are judged with the static light field's bounce, which bakes once every room has
      // streamed in (static-light-field.mjs), so the first room waits for it.
      const waitForLightField = () =>
        page
          .waitForFunction(
            () => {
              const field = document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.()?.simulation?.lightField;
              return !field || field.ready || field.error;
            },
            null,
            { timeout: 240000, polling: 1000 }
          )
          .catch(() => {});
      await ui.locator("summary").first().click();
      for (const shot of shots.filter((s) => (s.period || "day") === period)) {
        if (shot.activity) await ui.locator("[data-world-activity]").selectOption(shot.activity);
        if (shot.minute !== undefined)
          await ui.locator("[data-world-time]").evaluate((el, m) => {
            el.value = String(m);
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }, shot.minute);
        await ui.locator("[data-world-avatar]").selectOption(shot.avatar || "ghibli");
        await ui.locator(`[data-world-room="${shot.room}"]`).first().click();
        if (shot.camera) await scene.evaluate((e, camera) => e.setLabCamera(camera), shot.camera);
        await scene.scrollIntoViewIfNeeded();
        // Let streamed rooms finish their warmup and the composed still settle.
        await page
          .waitForFunction(
            () => {
              const e = document.querySelector("[data-home-desk-scene]").getSceneEvidence();
              return e.roomCount >= 6 && !e.framePending;
            },
            null,
            { timeout: 120000 }
          )
          .catch(() => {});
        await waitForLightField();
        await page.waitForTimeout(Number(process.env.COAST_SETTLE || 1800));
        const evidence = await scene.evaluate((e) => e.getSceneEvidence());
        await scene.screenshot({ path: path.join(output, shot.name + ".png") });
        report.push({
          shot,
          period,
          camera: evidence.camera,
          target: evidence.target,
          orbit: evidence.cameraOrbit,
          activity: evidence.activity,
          drawCalls: evidence.drawCalls,
          triangles: evidence.triangles,
          grip: evidence.gripDrift,
        });
      }
      report.push({ period, errors });
      await page.close();
    }
    await fs.writeFile(path.join(output, "captures.json"), JSON.stringify(report, null, 2));
    console.log(
      output,
      JSON.stringify(
        report.filter((r) => r.errors),
        null,
        1
      )
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
