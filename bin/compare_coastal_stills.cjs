// Pixel parity for performance changes that must not change a still frame. Captures composed stills
// (reduced motion, seeded page randomness with Three's UUIDs on their own generator, the routine's
// Date fixed at 13:20 Pacific) of the study, the outside view and the 160 m coast, once from the
// committed scene files and once from the working tree, twice each (base, work, work, base). The
// base-vs-base pair is the control: if it differs, the capture is not deterministic and no parity
// claim follows. Comparison is exact (any channel of any pixel) and also pixelmatch at 0.1.
//
// PowerShell: $env:COASTAL_STILLS_URL = "http://127.0.0.1:4136/al-folio/"; node bin/compare_coastal_stills.cjs
const { chromium } = require("playwright");
const { pinArrivalAvatar } = require("./coastal_probe_avatar.cjs");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { PNG } = require("pngjs");
const pixelmatchModule = require("pixelmatch");
const pixelmatch = pixelmatchModule.default || pixelmatchModule;

const repo = path.resolve(__dirname, "..");
const outputDir = path.resolve(process.argv[2] || ".jekyll-cache/visual-qa/coastal-stills");
const baseURL = process.env.COASTAL_STILLS_URL || "http://127.0.0.1:4136/al-folio/";
const abRef = process.env.COASTAL_STILLS_AB || "HEAD";
const buildRoot = process.env.COASTAL_STILLS_BUILD_ROOT ? path.resolve(process.env.COASTAL_STILLS_BUILD_ROOT) : null;
const views = (process.env.COASTAL_STILLS_VIEWS || "study,outside,coast160").split(",").filter(Boolean);
const width = Number(process.env.COASTAL_STILLS_WIDTH || 1440);
const height = Number(process.env.COASTAL_STILLS_HEIGHT || 1000);
const dpr = Number(process.env.COASTAL_STILLS_DPR || 1);
const fullscreen = process.env.COASTAL_STILLS_FULLSCREEN === "1";
const seed = Number(process.env.COASTAL_STILLS_SEED || 7);
const pinnedAvatar = process.env.COASTAL_STILLS_AVATAR || "lizard";
const fixedTime = process.env.COASTAL_STILLS_TIME || "2026-10-02T13:20:00-07:00";

// Files the work variant still serves from the base ref, to isolate one change from another (for
// instance a change that only reorders asynchronous work, and so the seeded random draws).
const held = new Set((process.env.COASTAL_STILLS_HOLD || "").split(",").filter(Boolean));
// URL flags for the work variant only, for instance "draw-order=material".
const workQuery = new URLSearchParams(process.env.COASTAL_STILLS_QUERY || "");

const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 << 20 });
const changed = new Set(
  [
    ...git("diff", "--name-only", abRef, "--", "assets/js").split(/\r?\n/),
    ...git("ls-files", "--others", "--exclude-standard", "--", "assets/js").split(/\r?\n/),
  ]
    .map((line) => line.trim().replaceAll("\\", "/"))
    .filter(Boolean)
);
const bodies = new Map();
let moduleBuild = null;
if (buildRoot) {
  moduleBuild = JSON.parse(fs.readFileSync(path.join(buildRoot, "assets/js/module-build.json"), "utf8"));
  const sha = (body) => createHash("sha256").update(body).digest("hex");
  const lf = (filename) => fs.readFileSync(filename, "utf8").replaceAll("\r\n", "\n");
  if (
    moduleBuild.schema !== "sirui-site-module-build-v1" ||
    moduleBuild.pipeline?.pluginSha256 !== sha(lf(path.join(repo, "_plugins/site_module_assets.rb"))) ||
    moduleBuild.pipeline?.lockSha256 !== sha(lf(path.join(repo, "Gemfile.lock")))
  )
    throw new Error("Module build recipe differs from current source");
  changed.clear();
  for (const [rel, record] of Object.entries(moduleBuild.modules)) {
    const authored = path.resolve(repo, rel),
      built = path.resolve(buildRoot, rel);
    if (!rel.startsWith("assets/js/") || !rel.endsWith(".mjs") || !authored.startsWith(repo + path.sep) || !built.startsWith(buildRoot + path.sep))
      throw new Error("Module receipt path escapes its source/build root");
    const source = fs.readFileSync(authored),
      output = fs.readFileSync(built);
    if (
      sha(Buffer.from(source.toString("utf8").replaceAll("\r\n", "\n"))) !== record.sourceSha256 ||
      sha(output) !== record.outputSha256 ||
      output.length !== record.bytes
    )
      throw new Error(`Module build has stale source or output: ${rel}`);
    changed.add(rel);
    bodies.set(`base:${rel}`, source);
    bodies.set(`work:${rel}`, output);
  }
}
function variantBody(variant, rel) {
  const key = `${variant}:${rel}`;
  if (!bodies.has(key)) {
    let body = null;
    try {
      body =
        variant === "work" && !held.has(rel)
          ? fs.readFileSync(path.join(repo, rel))
          : execFileSync("git", ["show", `${abRef}:${rel}`], { cwd: repo, maxBuffer: 64 << 20 });
    } catch {
      body = null;
    }
    bodies.set(key, body);
  }
  return bodies.get(key);
}

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
}

async function settle(page) {
  // A still is composed once nothing is pending and the frame count holds for a second.
  let previous = -1;
  for (let i = 0; i < 120; i++) {
    const { frames, pending } = await page.evaluate(() => {
      const e = document.querySelector("[data-home-desk-scene]").getSceneEvidence();
      return { frames: e.frames, pending: e.framePending };
    });
    if (!pending && frames === previous) return frames;
    previous = frames;
    await page.waitForTimeout(1000);
  }
  throw new Error("still never settled");
}

async function capture(variant, round) {
  const args = process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [];
  const browser = await chromium.launch({ headless: true, args });
  let identity;
  const shots = {},
    errors = [];
  try {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dpr,
      timezoneId: "America/Los_Angeles",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(150000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(/https:\/\/(?:plausible\.io|www\.google-analytics\.com|www\.googletagmanager\.com)\//, (route) =>
      route.fulfill({ status: 200, body: "" })
    );
    await page.route("**/livereload.js*", (route) => route.fulfill({ status: 200, body: "", contentType: "text/javascript" }));
    await page.route(/\/assets\/js\/.+\.m?js(?:\?.*)?$/, async (request) => {
      const url = new URL(request.request().url());
      const rel = "assets/js/" + decodeURIComponent(url.pathname.split("/assets/js/")[1]);
      if (changed.has(rel)) {
        const body = variantBody(variant, rel);
        if (!body) return request.fulfill({ status: 404, body: "" });
        let text = body.toString("utf8");
        if (rel.endsWith("home-scene/routine.mjs")) text = pinArrivalAvatar(text, pinnedAvatar);
        if (rel.endsWith("three.module.min.js")) text = text.replaceAll("4294967295*Math.random()|0", "4294967295*__profileUuidRandom()|0");
        return request.fulfill({ status: 200, body: text, contentType: "text/javascript; charset=utf-8" });
      }
      if (rel.endsWith("three.module.min.js") || rel.endsWith("home-scene/routine.mjs")) {
        const response = await request.fetch();
        let text = await response.text();
        if (rel.endsWith("home-scene/routine.mjs")) text = pinArrivalAvatar(text, pinnedAvatar);
        else text = text.replaceAll("4294967295*Math.random()|0", "4294967295*__profileUuidRandom()|0");
        return request.fulfill({ response, body: text });
      }
      return request.continue();
    });
    await page.addInitScript(seedPage, seed);
    await page.addInitScript(fixDate, fixedTime);
    const url = new URL(baseURL);
    url.searchParams.set("scene-lab", "1");
    if (variant === "work") for (const [key, value] of workQuery) url.searchParams.set(key, value);
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const host = page.locator("[data-home-desk-scene]");
    await page.locator('[data-home-desk-mode="3d"]').click();
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 180000 });
    await host.scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => {
        const e = document.querySelector("[data-home-desk-scene]").getSceneEvidence();
        return e.roomCount >= 6 && e.simulation?.lightField?.ready && e.cameraCollision?.ready !== false;
      },
      null,
      { timeout: 180000 }
    );
    if (fullscreen) {
      await page.locator("[data-world-fullscreen]").click();
      await page.waitForFunction(() => Boolean(document.querySelector("[data-home-desk-scene]").getSceneEvidence().fullscreen));
    }
    identity = await host.evaluate((el) => {
      const e = el.getSceneEvidence();
      return { avatarId: e.avatarId, roomCount: e.roomCount, loading: e.loading, camera: e.cameraOrbit, rendering: e.rendering };
    });
    if (identity.avatarId !== pinnedAvatar) throw new Error(`Arrival identity ${identity.avatarId} differs from pinned ${pinnedAvatar}`);
    for (const view of views) {
      if (view === "outside") {
        await page.locator("[data-world-view]").click();
        await page.waitForFunction(
          () => {
            const lab = document.querySelector("[data-home-desk-scene]").labScene;
            return lab.scene.getObjectByName("coastal-hinterland")?.visible && lab.scene.getObjectByName("clifftop-flora")?.visible;
          },
          null,
          { timeout: 180000 }
        );
      } else if (view === "coast160") {
        await host.locator("canvas").focus();
        for (let i = 0; i < 10; i++) await page.keyboard.press("-");
        await page.waitForFunction(
          () => Math.abs(document.querySelector("[data-home-desk-scene]").getSceneEvidence().cameraOrbit.radius - 160) < 0.5
        );
      }
      await settle(page);
      const file = path.join(outputDir, `${view}-${variant}-${round}.png`);
      await host.locator("canvas").screenshot({ path: file });
      shots[view] = file;
    }
  } finally {
    await browser.close();
  }
  return { variant, round, shots, identity, errors };
}

function compare(a, b) {
  const left = PNG.sync.read(fs.readFileSync(a)),
    right = PNG.sync.read(fs.readFileSync(b));
  if (left.width !== right.width || left.height !== right.height)
    return { sameSize: false, sizes: [left.width, left.height, right.width, right.height] };
  let exact = 0,
    maxChannel = 0;
  for (let i = 0; i < left.data.length; i += 4) {
    let differs = false;
    for (let c = 0; c < 4; c++) {
      const d = Math.abs(left.data[i + c] - right.data[i + c]);
      if (d) differs = true;
      maxChannel = Math.max(maxChannel, d);
    }
    if (differs) exact++;
  }
  const perceptual = pixelmatch(left.data, right.data, null, left.width, left.height, { threshold: 0.1, includeAA: false });
  return { sameSize: true, pixels: left.width * left.height, exactDifferent: exact, maxChannelDelta: maxChannel, pixelmatchDifferent: perceptual };
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const captures = [];
  for (const [variant, round] of [
    ["base", 1],
    ["work", 1],
    ["work", 2],
    ["base", 2],
  ]) {
    const result = await capture(variant, round);
    captures.push(result);
    console.log(JSON.stringify({ variant, round, errors: result.errors }));
  }
  const find = (variant, round) => captures.find((c) => c.variant === variant && c.round === round);
  const comparisons = {};
  for (const view of views) {
    comparisons[view] = {
      control_base1_base2: compare(find("base", 1).shots[view], find("base", 2).shots[view]),
      control_work1_work2: compare(find("work", 1).shots[view], find("work", 2).shots[view]),
      base1_work1: compare(find("base", 1).shots[view], find("work", 1).shots[view]),
      base2_work2: compare(find("base", 2).shots[view], find("work", 2).shots[view]),
    };
  }
  const report = {
    checkedAt: new Date().toISOString(),
    baseURL,
    abRef,
    changed: [...changed],
    held: [...held],
    workQuery: workQuery.toString(),
    width,
    height,
    dpr,
    fullscreen,
    seed,
    pinnedAvatar,
    fixedTime,
    sourceMode: buildRoot ? "current raw modules vs source-bound minified build; abRef unused" : "git ref vs working tree",
    moduleBuild: moduleBuild && { schema: moduleBuild.schema, pipeline: moduleBuild.pipeline, modules: Object.keys(moduleBuild.modules).length },
    comparisons,
    captures,
  };
  fs.writeFileSync(path.join(outputDir, "parity.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(comparisons, null, 1));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
