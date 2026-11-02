// Whole-product source-bound change census. This does not change the renderer.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { chromium, expect } = require("@playwright/test");
const { PNG } = require("pngjs");
const { compareTiles, oracleReconstruct } = require("./coastal_research_tiles.cjs");
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i],
    value = process.argv[i + 1];
  if (!["--url", "--out", "--header", "--source", "--width", "--height"].includes(key) || !value || args.has(key))
    throw Error("Unknown, missing or duplicate argument");
  args.set(key, value);
}
const base = new URL(args.get("--url")),
  out = path.resolve(args.get("--out")),
  width = Number(args.get("--width") || 2560),
  height = Number(args.get("--height") || 1440),
  expectedHeader = args.get("--header"),
  sourceDeclaration = args.get("--source");
if (
  base.protocol !== "http:" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) ||
  !expectedHeader ||
  !/^[a-f0-9]{40}$/.test(sourceDeclaration || "") ||
  !Number.isInteger(width) ||
  !Number.isInteger(height) ||
  width < 390 ||
  width > 3840 ||
  height < 390 ||
  height > 2160
)
  throw Error("Require an owned loopback product, header, full source declaration and bounded dimensions");
if (fs.existsSync(path.join(out, "result.json"))) throw Error("Use a new output directory; retain previous attempts");
fs.mkdirSync(out, { recursive: true });
const report = {
  schema: 1,
  at: new Date().toISOString(),
  sourceDeclaration,
  url: base.href,
  expectedHeader,
  method:
    "Complete current product, native Date/performance/RAF and public UI; read-only GL backend observation. Four moving screenshots/view, a paused repeat, and actual drag invalidation. Exact and2/255 diagnostic masks separate. Oracle reconstruction uses known target pixels offline; no runtime skip, speedup, HiPR reproduction or SOTA claim.",
  errors: [],
  failures: [],
  responses: [],
  views: [],
};
const pending = [];
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
let browser;
async function main() {
  browser = await chromium.launch({ headless: true, args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [] });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    timezoneId: "America/Los_Angeles",
    reducedMotion: "no-preference",
  });
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    globalThis.__reuseContexts = [];
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = original.apply(this, args);
      if (gl && /^webgl/.test(args[0]) && !globalThis.__reuseContexts.includes(gl)) globalThis.__reuseContexts.push(gl);
      return gl;
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") report.errors.push(m.text());
  });
  page.on("requestfailed", (r) => report.failures.push({ url: r.url(), failure: r.failure() }));
  page.on("response", (r) => {
    if (r.url().startsWith(base.origin) && /\.(?:mjs|glb|json)(?:\?|$)/.test(r.url()))
      pending.push(
        (async () => {
          const body = await r.body();
          report.responses.push({ url: r.url(), status: r.status(), owner: r.headers()["x-sirui-preview"], bytes: body.length, sha256: hash(body) });
        })().catch((e) => report.errors.push(String(e)))
      );
  });
  await page.route(/https:\/\/(?:plausible\.io|www\.google-analytics\.com|www\.googletagmanager\.com)\//, (r) =>
    r.fulfill({ status: 200, body: "" })
  );
  const url = new URL(base);
  url.searchParams.set("scene-lab", "1");
  url.searchParams.set("quality", "high");
  url.searchParams.set("msaa", "2");
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  await page.locator("[data-theme-toggle]:visible").first().click();
  await page.locator('[data-theme-mode-option="noon"]:visible').first().click();
  await page.locator("[data-theme-toggle]:visible").first().click();
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]"),
    ui = page.locator("[data-home-world-controls]");
  const evidence = () => scene.evaluate((el) => el.getSceneEvidence());
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 150000 });
  await ui.locator("[data-world-lab] > summary").click();
  await ui.locator("[data-world-avatar]").selectOption("ghibli");
  await expect.poll(async () => (await evidence()).avatarId, { timeout: 120000 }).toBe("ghibli");
  await ui.locator("[data-world-lab] > summary").click();
  await ui.locator("[data-world-fullscreen]").click();
  await expect.poll(async () => Boolean((await evidence()).fullscreen)).toBe(true);
  async function motion(paused) {
    const button = ui.locator("[data-world-pause]");
    if ((await button.getAttribute("aria-pressed")) === String(paused)) return;
    await ui.locator("[data-world-lab] > summary").click();
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", String(paused));
    await ui.locator("[data-world-lab] > summary").click();
  }
  async function settle() {
    let previous;
    for (let i = 0; i < 100; i++) {
      const e = await evidence();
      if (previous && !e.traveling && Math.hypot(...e.camera.map((x, j) => x - previous[j])) < 1e-5) return e;
      previous = e.camera;
      await page.waitForTimeout(150);
    }
    throw Error("Camera did not settle");
  }
  async function shot(label) {
    const e = await evidence(),
      began = Date.now(),
      filename = label + ".png";
    const body = await scene.locator("canvas").screenshot({ path: path.join(out, filename) }),
      image = PNG.sync.read(body);
    if (image.width !== width || image.height !== height) throw Error("Actual buffer/capture dimensions differ");
    const gl = await scene.evaluate((el) => {
      const g = globalThis.__reuseContexts.find((g) => g.canvas.closest("[data-home-desk-scene]"));
      const x = g.getExtension("WEBGL_debug_renderer_info");
      return {
        buffer: [g.drawingBufferWidth, g.drawingBufferHeight],
        renderer: g.getParameter(x?.UNMASKED_RENDERER_WEBGL || g.RENDERER),
        attributes: g.getContextAttributes(),
        clock: {
          date: Date.toString(),
          performance: performance.now.toString(),
          raf: requestAnimationFrame.toString(),
          playwrightClock: !!globalThis.__pwClock,
        },
      };
    });
    if (gl.buffer[0] !== width || gl.buffer[1] !== height || gl.clock.playwrightClock) throw Error("Buffer or native-clock gate failed");
    return { filename, sha256: hash(body), began, finished: Date.now(), evidence: e, gl, pixels: image.data };
  }
  function compare(a, b) {
    const exact = compareTiles(a.pixels, b.pixels, width, height),
      diagnostic = compareTiles(a.pixels, b.pixels, width, height, { threshold: 2 });
    const reconstructed = oracleReconstruct(a.pixels, b.pixels, exact);
    if (!Buffer.from(reconstructed).equals(b.pixels)) throw Error("Oracle reconstruction mismatch");
    return {
      from: a.filename,
      to: b.filename,
      intervalMs: b.began - a.began,
      animationSeconds: [a.evidence.animationSeconds, b.evidence.animationSeconds],
      exact,
      diagnostic,
      oracleReconstructionExact: true,
    };
  }
  for (const [room, activity] of [
    ["study", "work"],
    ["gym", "workout"],
    ["outside", "work"],
  ]) {
    await motion(false);
    await ui.locator("[data-world-lab] > summary").click();
    await ui.locator("[data-world-activity]").selectOption(activity);
    await ui.locator("[data-world-lab] > summary").click();
    if (room === "outside") await ui.locator("[data-world-view]").click();
    else {
      await ui.locator("[data-world-places] > summary").click();
      await ui.locator(`[data-world-destination="${room}"]`).click();
    }
    await expect.poll(async () => (await evidence()).currentRoom, { timeout: 120000 }).toBe(room);
    await settle();
    await page.waitForTimeout(1500);
    const frames = [];
    for (let i = 0; i < 4; i++) {
      if (i) await page.waitForTimeout(350);
      frames.push(await shot(room + "-live-" + i));
    }
    await motion(true);
    await page.waitForTimeout(700);
    const pausedA = await shot(room + "-paused-a");
    await page.waitForTimeout(350);
    const pausedB = await shot(room + "-paused-b");
    const box = await scene.locator("canvas").boundingBox();
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.52);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.52, { steps: 10 });
    await page.mouse.up();
    await settle();
    await page.waitForTimeout(350);
    const moved = await shot(room + "-dragged");
    const comparisons = {
      moving: frames.slice(1).map((frame, i) => compare(frames[i], frame)),
      paused: compare(pausedA, pausedB),
      dragged: compare(pausedB, moved),
    };
    report.views.push({ room, activity, frames: [...frames, pausedA, pausedB, moved].map(({ pixels, ...rest }) => rest), comparisons });
    fs.writeFileSync(path.join(out, "partial.json"), JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify({
        room,
        movingDirtyTileFraction: comparisons.moving.map((x) => x.exact.dirtyTileCapacityFraction),
        pausedPixels: comparisons.paused.exact.changedPixels,
        draggedPixels: comparisons.dragged.exact.changedPixels,
      })
    );
  }
  await Promise.all(pending);
  if (report.errors.length || report.failures.length || report.responses.some((r) => r.owner !== expectedHeader || r.status !== 200))
    throw Error("Complete-product source/console/asset gate failed");
  fs.writeFileSync(path.join(out, "result.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ complete: true, views: report.views.length, responses: report.responses.length, errors: 0 }));
}
main()
  .catch((e) => {
    report.failure = String(e.stack || e);
    fs.writeFileSync(path.join(out, "FAILURE.json"), JSON.stringify(report, null, 2));
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
