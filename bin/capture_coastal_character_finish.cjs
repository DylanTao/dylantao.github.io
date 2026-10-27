// Source-bound 4K character-contact inspection in the complete public scene.
// Models can come from a scratch candidate; every other route asset remains available.
// This is appearance/contact evidence, not a performance benchmark.
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { chromium } = require("playwright");
const { preparePage, collectRuntimeErrors } = require("../test/visual/helpers");

const root = path.resolve(__dirname, "..");
const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const sha256 = (body) => createHash("sha256").update(body).digest("hex");
const cameras = {
  body: { turn: 0.38, pitch: 0.15, radius: 1.6, height: 0.95, forward: 0.02 },
  side: { turn: -1.15, pitch: 0.14, radius: 1.7, height: 0.82, forward: 0 },
  tail: { turn: -1.7, pitch: 0.32, radius: 1.4, height: 0.48, forward: -0.12 },
  plate: { turn: 0.15, pitch: 1.05, radius: 0.95, height: 0.82, forward: 0.5 },
  full: { turn: 0.38, pitch: 0.12, radius: 2.75, height: 0.84, forward: 0.01 },
  tailwide: { turn: -1.7, pitch: 0.2, radius: 2.6, height: 0.75, forward: -0.08 },
};

async function capture() {
  const base = option("base-url", process.env.VISUAL_BASE_URL || "http://127.0.0.1:4106/al-folio").replace(/\/$/, ""),
    models = path.resolve(option("models", "assets/models/home")),
    out = path.resolve(option("out", ".jekyll-cache/visual-qa/character-finish-2026-10-26/current")),
    avatars = option("avatars", "lizard,south-park,simpsons,ghibli,rick-and-morty").split(","),
    views = option("cameras", "body,side,tail").split(","),
    activity = option("activity", "lounge"),
    date = option("date", "2026-10-01T22:00:00-07:00");
  for (const view of views) if (!cameras[view]) throw new Error(`Unknown camera ${view}`);
  await fs.mkdir(out, { recursive: true });
  const manifest = JSON.parse(await fs.readFile(path.join(root, "assets/models/home/manifest.json"), "utf8")),
    report = { base, date, activity, models, viewport: { width: 1920, height: 1080, deviceScaleFactor: 2 }, sourceModels: {}, captures: [] };
  const browser = await chromium.launch({ args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [] });
  try {
    report.browser = browser.version();
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
      timezoneId: "America/Los_Angeles",
      reducedMotion: "reduce",
    });
    const errors = collectRuntimeErrors(page);
    await preparePage(page, "evening");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.setFixedTime(new Date(date));
    // Register after preparePage's network fixture. No missing candidate silently falls back.
    await page.route("**/sirui-*.glb*", async (route) => {
      const file = path.basename(new URL(route.request().url()).pathname),
        body = await fs.readFile(path.join(models, file));
      report.sourceModels[file] = { sha256: sha256(body), bytes: body.length };
      await route.fulfill({ contentType: "model/gltf-binary", body });
    });
    await page.goto(`${base}/?scene-lab=1&cinematic=live&weather=clear&quality=standard`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const scene = page.locator("[data-home-desk-scene]"),
      controls = page.locator("[data-home-world-controls]");
    await scene.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 180000 });
    await page.locator("[data-world-fullscreen]").click();
    const evidence = () => scene.evaluate((host) => host.getSceneEvidence());
    const settle = async () => {
      const frames = (await evidence()).frames;
      await page.waitForFunction(
        (start) => {
          const host = document.querySelector("[data-home-desk-scene]"),
            state = host.getSceneEvidence();
          if (state.frames < start + 4) host.labScene.requestFrame();
          return state.frames >= start + 4 && !state.framePending;
        },
        frames,
        { polling: 100, timeout: 90000 }
      );
    };
    for (const avatar of avatars) {
      await controls.locator("[data-world-lab]>summary").click();
      await controls.locator("[data-world-avatar]").selectOption(avatar);
      await controls.locator("[data-world-activity]").selectOption(activity);
      await controls.locator("[data-world-lab]>summary").click();
      await page.waitForFunction(
        ([id, activity, rooms]) => {
          const host = document.querySelector("[data-home-desk-scene]"),
            state = host.getSceneEvidence();
          return host.dataset.avatar === id && state.activity === activity && !state.traveling && state.roomCount === rooms && state.dining?.ready;
        },
        [avatar, activity, manifest.rooms.length],
        { timeout: 120000 }
      );
      await settle();
      const state = await evidence();
      for (const name of views) {
        const c = cameras[name],
          facing = state.actorFacing,
          actor = state.actorPosition,
          target = [actor[0] + Math.sin(facing) * c.forward, actor[1] + c.height, actor[2] + Math.cos(facing) * c.forward];
        await scene.evaluate((host, camera) => host.setLabCamera(camera), { target, yaw: facing + c.turn, pitch: c.pitch, radius: c.radius });
        await settle();
        const before = await evidence(),
          file = `${activity}-${avatar}-${name}.png`;
        await page.screenshot({ path: path.join(out, file) });
        const after = await evidence(),
          backend = await scene.locator("canvas:not(.home-world-sketch)").evaluate((canvas) => {
            const gl = canvas.getContext("webgl2"),
              debug = gl.getExtension("WEBGL_debug_renderer_info");
            return {
              buffer: [canvas.width, canvas.height],
              css: [canvas.clientWidth, canvas.clientHeight],
              renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
            };
          });
        if (before.animationSeconds !== after.animationSeconds) throw new Error("The reduced-motion inspection changed its pose during capture");
        report.captures.push({ file, avatar, view: name, target, yaw: facing + c.turn, backend, before, after });
        console.log(JSON.stringify({ file, buffer: backend.buffer, phase: before.dining?.phase, beat: before.dining?.beat }));
      }
    }
    report.errors = errors;
    await fs.writeFile(path.join(out, "receipt.json"), JSON.stringify(report, null, 2) + "\n");
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    await browser.close();
  }
}

if (require.main === module)
  capture().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

module.exports = { capture };
