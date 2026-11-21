// Compare two separately built, already served homepages. See docs/coastal-comparison.md.
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { gzipSync } = require("node:zlib");
const { parseArgs } = require("node:util");
const { setTimeout: delay } = require("node:timers/promises");

const WIDTH = 2560;
const HEIGHT = 1440;
const BUDGET = 4 * 1024 * 1024;
const AVATAR = "lizard";
const DATE = "2026-11-20T13:20:00-08:00";
const READY_TIMEOUT = 120000;
const VIEW_TIMEOUT = 30000;
const COAST_TIMEOUT = 90000;
const HOST = "[data-home-desk-scene]";
const MANIFEST = "assets/models/home/manifest.json";
const CONTROLLER = "assets/js/home-scene/controller.mjs";
const ROUTINE = "assets/js/home-scene/routine.mjs";
const PRINT = "assets/js/home-scene/print-look.mjs";
const MODULE_BUILD = "assets/js/module-build.json";
const COAST_ROOTS = ["coastal-hinterland", "clifftop-flora"];
const PUBLIC_LOOKS = ".home-world-places-looks [data-world-drawing]";
const VIEWS = [
  {
    id: "coast-noon",
    room: "outside",
    minute: 720,
    target: [3, -0.2, -2.4],
    yaw: 3.48,
    pitch: 0.37,
    radius: 48,
    fov: 38,
  },
  {
    id: "section-dusk",
    room: "overview",
    minute: 1006,
    target: [0, 1.65, 8.2],
    yaw: 3.3,
    pitch: 0.43,
    radius: 18.5,
    fov: 38,
  },
  {
    id: "lounge-night",
    room: "lounge",
    minute: 1260,
    target: [0.55, 0.67, 7.45],
    yaw: 3.18,
    pitch: 0.34,
    radius: 5.8,
    fov: 40,
  },
];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const usage =
  "node bin/compare_coastal_revisions.cjs --main-url <url> --candidate-url <url> --out <new-directory> " +
  "[--main-manifest-sha256 <sha>] [--candidate-manifest-sha256 <sha>]";

function servedUrl(value, option) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${option} expects the full URL of a served homepage`);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error(`${option} expects an HTTP(S) homepage URL without credentials, query or fragment`);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

function options(args) {
  const { values } = parseArgs({
    args,
    options: Object.fromEntries(
      ["main-url", "candidate-url", "out", "main-manifest-sha256", "candidate-manifest-sha256"].map((key) => [key, { type: "string" }])
    ),
  });
  const entries = ["main", "candidate"].map((role) => {
    const base = servedUrl(values[`${role}-url`], `--${role}-url`);
    const manifestSha = values[`${role}-manifest-sha256`]?.toLowerCase();
    if (manifestSha && !/^[0-9a-f]{64}$/.test(manifestSha)) throw new Error(`Invalid ${role} manifest SHA-256`);
    return { role, base, manifestSha };
  });
  if (entries[0].base.origin === entries[1].base.origin) throw new Error("Use two separately served origins (different host or port)");
  if (!values.out) throw new Error("--out is required");
  return { entries, output: path.resolve(values.out) };
}

function assetPath(input, base) {
  const url = new URL(input);
  return url.origin === base.origin && url.pathname.startsWith(base.pathname) ? url.pathname.slice(base.pathname.length) : null;
}

function bindManifest(bytes, expected, where) {
  const sha256 = digest(bytes);
  if (expected && sha256 !== expected) throw new Error(`${where} manifest SHA-256 is ${sha256}; expected ${expected}`);
  let manifest;
  try {
    manifest = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`${where} did not serve a JSON scene manifest`);
  }
  if (
    typeof manifest?.shell !== "string" ||
    typeof manifest.coast !== "string" ||
    typeof manifest.wallArt?.file !== "string" ||
    !manifest.rooms?.some?.((room) => room.id === "lounge") ||
    !manifest.avatars?.some?.((avatar) => avatar.id === AVATAR)
  )
    throw new Error(`${where} manifest does not support the comparison's lounge and avatar`);
  return { manifest, sha256 };
}

function firstSceneBudget(entries, base, manifest, readyAt) {
  const manifestUrl = new URL(MANIFEST, base);
  const relative = (file) => assetPath(new URL(file, manifestUrl), base);
  const wallArt = relative(manifest.wallArt.file);
  const required = [MANIFEST, CONTROLLER, ROUTINE, "assets/js/three.module.min.js", relative(manifest.shell), relative(manifest.coast), wallArt];
  if (manifest.staticLightFieldCache?.url) required.push(relative(manifest.staticLightFieldCache.url));
  const assets = new Map();
  const aborted = new Set();
  for (const { url, start, body, failure, status } of entries) {
    const file = assetPath(url, base);
    if (!isSceneAsset(file, wallArt)) continue;
    if (start > readyAt) continue;
    if (failure && failure.includes("ERR_ABORTED")) {
      aborted.add(file);
      continue;
    }
    if (!Number.isFinite(start) || start <= 0) throw new Error(`Missing request-start time for ${file}`);
    if (failure || !body || status < 200 || status >= 300) throw new Error(`First scene could not read ${file}: ${failure || status}`);
    const sha256 = digest(body);
    const earlier = assets.get(file);
    if (earlier && earlier.sha256 !== sha256) throw new Error(`Two different served bodies for ${file} before ready`);
    if (!earlier)
      assets.set(file, {
        file,
        sha256,
        bytes: body.length,
        gzip6Bytes: gzipSync(body, { level: 6 }).length,
      });
  }
  for (const file of required) {
    if (!assets.has(file)) throw new Error(`Missing first-scene response for ${file ?? "an out-of-scope manifest dependency"}`);
  }
  const files = [...assets.values()].sort((a, b) => a.file.localeCompare(b.file));
  const gzip6Bytes = files.reduce((sum, file) => sum + file.gzip6Bytes, 0);
  return {
    gzip6Bytes,
    referenceBudgetBytes: BUDGET,
    referenceHeadroomBytes: BUDGET - gzip6Bytes,
    servedSha256: digest(JSON.stringify(files.map(({ file, sha256 }) => [file, sha256]))),
    abortedRequests: [...aborted].sort(),
    files,
  };
}

function isSceneAsset(file, wallArt) {
  return Boolean(
    file &&
    (file === wallArt ||
      file === "assets/img/home/coastal-vignette.svg" ||
      file === "assets/js/three.module.min.js" ||
      file.startsWith("assets/js/home-scene/") ||
      file.startsWith("assets/js/vendor/three-r164/") ||
      file.startsWith("assets/models/home/"))
  );
}

function trackSceneResponses(page, base, manifest, servedRoutine) {
  const requests = new Map();
  const wallArt = assetPath(new URL(manifest.wallArt.file, new URL(MANIFEST, base)), base);
  page.on("request", (request) => {
    const file = assetPath(request.url(), base);
    if (!isSceneAsset(file, wallArt)) return;
    let finish;
    const done = new Promise((resolve) => {
      finish = resolve;
    });
    requests.set(request, { file, done, finish });
  });
  page.on("response", (response) => {
    const request = response.request();
    const seen = requests.get(request);
    if (!seen) return;
    seen.response = response;
    if (!response.ok()) return;
    // The loading-drawing worker can retire with the first frame. Retain its body while the response is live.
    const body = seen.file === ROUTINE ? Promise.resolve(servedRoutine.get(request.url())) : response.body();
    seen.body = body.then(
      (bytes) => ({ bytes }),
      (error) => ({ error })
    );
  });
  const finish = (request) => requests.get(request)?.finish();
  page.on("requestfinished", finish);
  page.on("requestfailed", finish);
  return async function collect(cutoff) {
    const cohort = [...requests].filter(([request]) => {
      const start = request.timing().startTime;
      return !Number.isFinite(start) || start <= 0 || start <= cutoff;
    });
    const timeout = new AbortController();
    try {
      await Promise.race([
        Promise.all(cohort.map(([, entry]) => entry.done)),
        delay(15000, undefined, { signal: timeout.signal }).then(() => {
          throw new Error("First-scene requests did not finish within 15 seconds of readiness");
        }),
      ]);
    } finally {
      timeout.abort();
    }
    const bodies = [];
    for (const [request, { file, response, body }] of cohort) {
      const start = request.timing().startTime;
      if (start > cutoff) continue;
      const failure = request.failure();
      const retained = await body;
      if (retained?.error && !failure) throw new Error(`Could not retain the served body for ${file}: ${retained.error.message}`);
      bodies.push({ url: request.url(), start, status: response?.status(), body: retained?.bytes, failure: failure?.errorText });
    }
    return bodies;
  };
}

function measuredAt2K(sample, id) {
  const exact = (size) => size?.[0] === WIDTH && size?.[1] === HEIGHT;
  if (!exact(sample.canvasAtStart) || !exact(sample.canvas)) throw new Error(`${id} did not draw native ${WIDTH}×${HEIGHT}`);
  if (
    !Number.isInteger(sample.intervalSamples) ||
    sample.intervalSamples < 4 ||
    !Number.isFinite(sample.intervalMs?.median) ||
    !Number.isFinite(sample.intervalMs?.p95) ||
    !(sample.drawsPerFrame > 0)
  )
    throw new Error(`${id} has no valid moving-frame timing/draw sample`);
  return sample;
}

const lookButtons = (locator) =>
  locator.evaluateAll((buttons) =>
    buttons
      .filter((button) => !button.hidden && !button.disabled)
      .map((button) => ({ id: button.dataset.worldDrawing, label: button.textContent.trim() }))
  );

async function readServed(entry, file) {
  const url = new URL(file, entry.base);
  let response;
  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000), redirect: "error" });
  } catch (error) {
    throw new Error(`${entry.role} could not read ${url.href}: ${error.cause?.code ?? error.message}`);
  }
  if (!response.ok) throw new Error(`${url.href}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function preflight(entry) {
  const bound = bindManifest(await readServed(entry, MANIFEST), entry.manifestSha, entry.role);
  const indexBytes = await readServed(entry, MODULE_BUILD);
  const build = JSON.parse(indexBytes.toString("utf8"));
  const files = [CONTROLLER, ROUTINE, PRINT].map((file) => ({ file, ...build.modules?.[file] }));
  if (build.schema !== "sirui-site-module-build-v1" || files.some((info) => !/^[0-9a-f]{64}$/.test(info.outputSha256)))
    throw new Error(`${entry.role} lacks a current compiled module receipt`);
  return { ...bound, moduleBuild: { sha256: digest(indexBytes), files } };
}

// Keep the last frame's measured predicates so a failed view identifies the actual hold.
function inspectView({ selector, before, preset, roomNames, detailFiles, outdoorNames }) {
  const el = document.querySelector(selector);
  const e = el.getSceneEvidence();
  const orbit = e.cameraOrbit;
  const world = el.labScene.scene;
  const yawError = Math.abs(Math.atan2(Math.sin(orbit.yaw - preset.yaw), Math.cos(orbit.yaw - preset.yaw)));
  const missingRoots = [...roomNames, ...outdoorNames].filter((name) => !world.getObjectByName(name)?.visible);
  const details = e.loading.streamedDetails;
  const missingDetails = detailFiles.filter((file) => !details.ready.includes(file));
  const checks = {
    selectedRoom: e.currentRoom === preset.room,
    selectedHour: e.daylight?.minute === preset.minute,
    camera:
      yawError < 0.01 &&
      Math.abs(orbit.pitch - preset.pitch) < 0.01 &&
      Math.abs(orbit.radius - preset.radius) < 0.03 &&
      Math.abs(e.cameraFov - preset.fov) < 0.15,
    geometry: missingRoots.length === 0 && missingDetails.length === 0,
    section: preset.room !== "overview" || (e.roofLift?.overviewProgress === 1 && !e.roofLift.moving),
    lighting: e.simulation?.lightField?.ready === true,
    frame: e.frames > before && e.canvasWidth === 2560 && e.canvasHeight === 1440,
    settledActor: !e.traveling,
  };
  return {
    checks,
    actual: {
      room: e.currentRoom,
      minute: e.daylight?.minute,
      eye: e.camera,
      orbit,
      fov: e.cameraFov,
      projection: e.projection,
      frames: e.frames,
      canvas: [e.canvasWidth, e.canvasHeight],
      missingRoots,
      missingDetails,
      pendingDetails: details.pending,
      outdoor: outdoorNames.map((name) => {
        const node = world.getObjectByName(name);
        return { name, attached: Boolean(node), visible: node?.visible ?? false };
      }),
      outdoorDownloads: e.loading.models.filter((entry) => /(?:flora|hinterland)\.glb$/.test(entry.asset)),
      roof: e.roofLift,
      lightCache: e.loading.lightCache.state,
    },
  };
}

// Let the real Film request stage both coastal models without a moving 2K view competing for compilation.
async function prepareCoastForViews(page, host, evidence, warmup) {
  const before = await evidence();
  if (before.fullscreen || !(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)))
    throw new Error("Coast preparation requires the embedded scene with reduced motion");
  const hasCoast = (element, roots) => roots.every((name) => element.labScene.scene.getObjectByName(name)?.visible);
  warmup.method = "Embedded reduced-motion Rooms → House film → Return";
  warmup.initialRoom = before.currentRoom;
  warmup.initialCanvas = [before.canvasWidth, before.canvasHeight];
  warmup.coastAlreadyVisible = await host.evaluate(hasCoast, COAST_ROOTS);
  await page.waitForFunction((selector) => document.querySelector(selector).getSceneEvidence().visitorRailGeometry, HOST, { timeout: READY_TIMEOUT });
  await page.locator("[data-world-places] > summary").click();
  const started = performance.now();
  await page.locator('[data-world-visit-start="film"]').click();
  await page.waitForFunction(
    ({ selector, roots, frames }) => {
      const el = document.querySelector(selector);
      const e = el.getSceneEvidence();
      return e.visitorRail?.shot === "coast-dawn" && e.frames > frames && roots.every((name) => el.labScene.scene.getObjectByName(name)?.visible);
    },
    { selector: HOST, roots: COAST_ROOTS, frames: before.frames },
    { timeout: READY_TIMEOUT }
  );
  const staged = await evidence();
  const shown = performance.now();
  warmup.clickToComposedCoastMs = shown - started;
  warmup.shot = staged.visitorRail.shot;
  warmup.seabedMeshes = staged.ecology?.water?.optics?.seabed?.meshes ?? null;
  await page.locator("[data-world-visit-return]").click();
  await page.waitForFunction(
    ({ selector, roots, frames }) => {
      const el = document.querySelector(selector);
      const e = el.getSceneEvidence();
      return !e.visitorRail && e.frames > frames && roots.every((name) => el.labScene.scene.getObjectByName(name)?.visible);
    },
    { selector: HOST, roots: COAST_ROOTS, frames: staged.frames }
  );
  warmup.totalThroughReturnMs = performance.now() - started;
  const returned = await evidence();
  warmup.returnedRoom = returned.currentRoom;
  warmup.outdoorDownloads = returned.loading.models.filter((entry) => /(?:flora|hinterland)\.glb$/.test(entry.asset));
  warmup.rootsAfterReturn = await host.evaluate(hasCoast, COAST_ROOTS);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  warmup.motionRestored = !(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches));
  if (!warmup.rootsAfterReturn || !warmup.motionRestored) throw new Error("Could not restore the complete moving scene after Film preparation");
}

async function runRevision(entry, pre, output, tools) {
  const shots = path.join(output, entry.role);
  await fs.mkdir(shots);
  const browser = await tools.launchCoastalBrowser();
  const deadline = setTimeout(
    () =>
      browser
        .close({
          reason: "Coastal comparison exceeded six minutes for this URL",
        })
        .catch(() => {}),
    360000
  );
  const result = {
    url: entry.base.href,
    chromium: browser.version(),
    manifestSha256: pre.sha256,
    moduleBuild: pre.moduleBuild,
    errors: [],
    views: {},
    viewReadiness: {},
    viewFailures: {},
    pngs: [],
  };
  let stage = "ordinary opening";
  const checkpoint = () => fs.writeFile(path.join(shots, "partial.json"), JSON.stringify({ stage, ...result }, null, 2) + "\n");
  const createPage = async (lab) => {
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
      timezoneId: "America/Los_Angeles",
      serviceWorkers: "block",
      reducedMotion: lab ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(VIEW_TIMEOUT);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Performance.enable");
    page.on("pageerror", (error) => result.errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && /THREE\.|shader|WebGL/i.test(message.text())) result.errors.push(message.text());
    });
    await page.route(/https:\/\/(?:plausible\.io|www\.google-analytics\.com|www\.googletagmanager\.com)\//, (route) => route.abort());
    await page.route("**/livereload.js*", (route) => route.fulfill({ body: "", contentType: "text/javascript" }));
    const servedRoutine = new Map();
    const versionBodies = new Map();
    if (lab) {
      const binding = new Set([MANIFEST, CONTROLLER, PRINT]);
      page.on("response", (response) => {
        const key = assetPath(response.url(), entry.base);
        if (binding.has(key) && response.ok() && !versionBodies.has(key))
          versionBodies.set(
            key,
            response
              .body()
              .then(digest)
              .catch(() => null)
          );
      });
    }
    // Pin the same avatar with the existing probe's conditioning. The byte ledger uses the original HTTP body.
    await page.route(
      (url) => assetPath(url, entry.base) === ROUTINE,
      async (route) => {
        const response = await route.fetch({
          timeout: VIEW_TIMEOUT,
          maxRedirects: 0,
        });
        const body = await response.body();
        servedRoutine.set(route.request().url(), body);
        await route.fulfill({
          response,
          body: tools.pinArrivalAvatar(body.toString("utf8"), AVATAR),
        });
      }
    );
    await page.addInitScript(tools.seedPage, 7);
    await page.addInitScript(tools.fixDate, DATE);
    await page.addInitScript(tools.instrument);
    const collect = lab ? null : trackSceneResponses(page, entry.base, pre.manifest, servedRoutine);
    const url = new URL(entry.base);
    if (!lab) url.searchParams.set("cinematic", "live");
    if (lab) {
      url.searchParams.set("scene-lab", "1");
      url.searchParams.set("weather", "clear");
      url.searchParams.set("resolution", "fixed");
      url.searchParams.set("quality", "standard");
    }
    const response = await page.goto(url.href, {
      waitUntil: "domcontentloaded",
    });
    if (!response?.ok() || new URL(response.url()).pathname !== entry.base.pathname || new URL(response.url()).origin !== entry.base.origin)
      throw new Error(`Could not open the specified homepage at ${url.href}`);
    if (!lab) {
      result.homepageSha256 = digest(await response.body());
      result.publishedLooks = await lookButtons(page.locator(PUBLIC_LOOKS));
      if (!result.publishedLooks.some(({ id }) => id === "realistic")) throw new Error("The public Rooms look list is unavailable");
    }
    const host = page.locator(HOST);
    const evidence = () => host.evaluate((element) => element.getSceneEvidence());
    await page.locator('[data-home-desk-mode="3d"]').click();
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el?.dataset.sceneState === "failed" || (el?.dataset.sceneState === "ready" && el.getSceneEvidence?.().frames > 0);
      },
      HOST,
      { timeout: READY_TIMEOUT }
    );
    const ready = await evidence();
    if (!ready.ready || ready.avatarId !== AVATAR) throw new Error("The scene did not reach its proved first frame with the pinned avatar");
    return { context, page, host, evidence, ready, collect, cdp, versionBodies };
  };

  try {
    const cold = await createPage(false);
    const clocks = await cold.page.evaluate(() => {
      const { activation, transitions } = window.__coastalViews;
      return {
        activation,
        ready: transitions.find((entry) => entry.value === "ready")?.at,
        origin: performance.timeOrigin,
      };
    });
    const toReady = clocks.ready - clocks.activation;
    if (clocks.activation === null || !Number.isFinite(toReady) || toReady <= 0 || !(cold.ready.loading?.firstFrameMilliseconds >= 0))
      throw new Error("The normal entry did not report a valid ready and first-frame time");
    result.ready = {
      clickToReadyMs: toReady,
      initializeToFirstFrameMs: cold.ready.loading.firstFrameMilliseconds,
      avatar: cold.ready.avatarId,
      lightCache: cold.ready.loading.lightCache,
    };
    const responses = await cold.collect(clocks.origin + clocks.ready);
    result.firstScene = firstSceneBudget(responses, entry.base, pre.manifest, clocks.origin + clocks.ready);
    const observedManifest = result.firstScene.files.find((file) => file.file === MANIFEST);
    if (observedManifest.sha256 !== pre.sha256) throw new Error("Manifest changed between the preflight and the ordinary 3D entry");
    for (const { file, outputSha256 } of pre.moduleBuild.files) {
      if (result.firstScene.files.find((asset) => asset.file === file)?.sha256 !== outputSha256)
        throw new Error(`Stale compiled module body for ${file}`);
    }
    await fs.writeFile(path.join(shots, "manifest.json"), responses.find((res) => res.body && assetPath(res.url, entry.base) === MANIFEST).body);
    console.log(`  ${entry.role}: ready in ${Math.round(toReady)} ms, ${result.firstScene.gzip6Bytes} gzip6 bytes`);
    await checkpoint();
    await cold.context.close();

    stage = "2K scene lab";
    const lab = await createPage(true);
    const { page, host, evidence, cdp, versionBodies } = lab;
    const browserCDP = await browser.newBrowserCDPSession();
    result.labSourceSha256 = Object.fromEntries(await Promise.all([...versionBodies].map(async ([file, body]) => [file, await body])));
    for (const file of [MANIFEST, CONTROLLER, PRINT]) {
      if (!result.labSourceSha256[file] || result.labSourceSha256[file] !== result.firstScene.files.find((asset) => asset.file === file)?.sha256)
        throw new Error(`Cold and lab scenes did not use the same served ${file}`);
    }
    stage = "embedded Film preparation";
    result.warmup = {};
    await prepareCoastForViews(page, host, evidence, result.warmup);
    console.log(`  ${entry.role}: prepared the coast and returned in ${Math.round(result.warmup.totalThroughReturnMs)} ms before native 2K timing`);
    await checkpoint();
    stage = "native 2K lab";
    await page.locator("[data-world-fullscreen]").click();
    await page.waitForFunction((selector) => {
      const e = document.querySelector(selector).getSceneEvidence();
      return Boolean(e.fullscreen) && e.canvasWidth === 2560 && e.canvasHeight === 1440;
    }, HOST);
    result.renderer = await host.evaluate((element) => {
      const gl = element.querySelector("canvas").getContext("webgl2");
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null;
    });
    if (!result.renderer || /swiftshader|llvmpipe|software/i.test(result.renderer))
      throw new Error(`Native WebGL renderer required, got ${result.renderer ?? "unavailable"}`);
    const labMenu = page.locator("[data-world-lab]");
    if (!(await labMenu.evaluate((element) => !element.hidden && !element.inert)))
      throw new Error("The served homepage does not expose the scene lab");
    const labLookButtons = labMenu.locator("[data-world-drawing]");
    result.labLooks = await lookButtons(labLookButtons);
    result.looks = [...new Set([...result.publishedLooks, ...result.labLooks].map(({ id }) => id))].sort();
    if (result.looks.some((look) => !/^[a-z][a-z0-9-]*$/.test(look))) throw new Error("Invalid served look identifier");

    const openView = async (preset) => {
      const scene = await evidence();
      if (preset.room === "outside" && scene.currentRoom === "outside") {
        await labMenu.locator('[data-world-room="lounge"]').evaluate((button) => button.click());
      }
      const before = await evidence();
      await labMenu.locator("[data-world-time]").evaluate((control, minute) => {
        control.valueAsNumber = minute;
        control.dispatchEvent(new Event("input", { bubbles: true }));
      }, preset.minute);
      await labMenu.locator(`[data-world-room="${preset.room}"]`).evaluate((button) => button.click());
      await host.evaluate((el, pose) => el.setLabCamera(pose), preset);
      const detailFiles = (pre.manifest.streamedDetails ?? [])
        .filter((entry) => entry.places?.includes(preset.room) || entry.firstFrame?.includes(preset.room))
        .map((entry) => entry.file);
      const roomNames = pre.manifest.rooms.map(({ id }) => `room-${id}`);
      const outdoorNames = preset.room === "outside" ? COAST_ROOTS : preset.room === "overview" ? ["coastal-hinterland"] : [];
      const args = { selector: HOST, before: before.frames, preset, roomNames, detailFiles, outdoorNames };
      const started = Date.now();
      const deadline = started + (outdoorNames.length ? COAST_TIMEOUT : VIEW_TIMEOUT);
      do {
        result.lastView = { fromRoom: before.currentRoom, ...(await page.evaluate(inspectView, args)) };
        if (Object.values(result.lastView.checks).every(Boolean)) {
          result.viewReadiness[stage] = { fromRoom: before.currentRoom, ...result.lastView.actual, elapsedMs: Date.now() - started };
          return;
        }
        await delay(220);
      } while (Date.now() < deadline);
      const pending = Object.entries(result.lastView.checks)
        .filter(([, passed]) => !passed)
        .map(([name]) => name);
      throw new Error(`View did not settle (${pending.join(", ")}). See lastView in the report.`);
    };
    const chooseLook = async (look) => {
      const shelf = result.labLooks.some(({ id }) => id === look) ? labMenu.locator("[data-world-drawing]") : page.locator(PUBLIC_LOOKS);
      const before = await shelf
        .and(page.locator(`[data-world-drawing="${look}"]`))
        .first()
        .evaluate((button, selector) => {
          const frame = document.querySelector(selector).getSceneEvidence().frames;
          button.click();
          return frame;
        }, HOST);
      await page.waitForFunction(
        ({ selector, before, look }) => {
          const el = document.querySelector(selector);
          return el.dataset.drawing === look && el.getSceneEvidence().frames > before;
        },
        { selector: HOST, before, look }
      );
    };

    const attempt = async (label, action) => {
      stage = label;
      result.lastView = null;
      try {
        await action();
        await checkpoint();
        return true;
      } catch (error) {
        result.viewFailures[label] = { error: error.message, witness: result.lastView };
        await checkpoint();
        return false;
      }
    };

    for (const id of ["coast-noon", "lounge-night"]) {
      await attempt(`live ${id}`, async () => {
        await openView(VIEWS.find((preset) => preset.id === id));
        await chooseLook("realistic");
        const sample = await tools.sampleCoastalView(
          {
            page,
            cdp,
            evidence,
            processCPU: () => tools.readProcessCPU(browserCDP),
          },
          id,
          6
        );
        result.views[id] = measuredAt2K(sample, id);
      });
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const preset of VIEWS) {
      const settled = await attempt(`still ${preset.id}`, () => openView(preset));
      if (!settled) continue;
      for (const look of result.looks) {
        await attempt(`still ${preset.id} / ${look}`, async () => {
          await chooseLook(look);
          // Like compare_coastal_stills, wait for a complete still, not just an updated control.
          await page.waitForFunction((selector) => !document.querySelector(selector).getSceneEvidence().framePending, HOST);
          const name = `${preset.id}-${look}.png`;
          const state = await evidence();
          const bytes = await host.locator("canvas").screenshot({ path: path.join(shots, name), animations: "allow" });
          const png = tools.PNG.sync.read(bytes);
          const colors = new Set();
          for (let y = 12; y < png.height; y += 48) {
            for (let x = 12; x < png.width; x += 48) colors.add(png.data.readUInt32BE((y * png.width + x) * 4));
          }
          if (png.width !== WIDTH || png.height !== HEIGHT || state.canvasWidth !== WIDTH || state.canvasHeight !== HEIGHT || colors.size < 8)
            throw new Error(`Invalid composed native frame ${name}`);
          result.pngs.push({
            file: `${entry.role}/${name}`,
            view: preset.id,
            look,
            sha256: digest(bytes),
            sampledColors: colors.size,
            camera: state.camera,
            fov: state.cameraFov,
            projection: state.projection,
            minute: state.daylight.minute,
          });
        });
      }
    }
    if (Object.keys(result.viewFailures).length) {
      stage = "view matrix";
      throw new Error(Object.keys(result.viewFailures).join(", ") + " failed. See viewFailures in the report.");
    }
    if (result.errors.length) throw new Error(result.errors[0]);
  } catch (error) {
    result.failed = `${stage}: ${error.message}`;
    result.missing = (result.looks ?? []).flatMap((look) =>
      VIEWS.filter((view) => !result.pngs.some((png) => png.look === look && png.view === view.id)).map((view) => `${view.id} / ${look}`)
    );
  } finally {
    clearTimeout(deadline);
    await browser.close();
    await checkpoint();
  }
  return result;
}

function summarize(main, candidate) {
  if (main.failed || candidate.failed) throw new Error(`Incomplete measurement: ${[main.failed, candidate.failed].filter(Boolean).join("; ")}`);
  if (!main.renderer || !main.chromium || main.renderer !== candidate.renderer || main.chromium !== candidate.chromium)
    throw new Error("Renderer/browser differ between revisions");
  for (const side of [main, candidate]) {
    if (
      !Number.isFinite(side.ready?.clickToReadyMs) ||
      !(side.ready.clickToReadyMs > 0) ||
      !Number.isInteger(side.firstScene?.gzip6Bytes) ||
      !(side.firstScene.gzip6Bytes > 0) ||
      !side.looks?.length
    )
      throw new Error(`Missing ready, budget or look evidence at ${side.url}`);
  }
  const matchedViews = {};
  for (const id of ["coast-noon", "lounge-night"]) {
    const m = measuredAt2K(main.views[id] ?? {}, `main ${id}`);
    const c = measuredAt2K(candidate.views[id] ?? {}, `candidate ${id}`);
    matchedViews[id] = {
      frameMedianMs: c.intervalMs.median - m.intervalMs.median,
      frameP95Ms: c.intervalMs.p95 - m.intervalMs.p95,
      drawsPerFrame: c.drawsPerFrame - m.drawsPerFrame,
    };
  }
  const comparison = { paired: [], mainOnly: [], candidateOnly: [] };
  for (const look of new Set([...main.looks, ...candidate.looks])) {
    for (const side of [main, candidate]) {
      if (!side.looks.includes(look)) continue;
      for (const view of VIEWS) {
        if (!side.pngs.some((png) => png.look === look && png.view === view.id)) throw new Error(`Missing ${look} / ${view.id} frame at ${side.url}`);
      }
    }
    if (main.looks.includes(look) && candidate.looks.includes(look)) {
      comparison.paired.push(look);
      for (const view of VIEWS) {
        const a = main.pngs.find((png) => png.look === look && png.view === view.id);
        const b = candidate.pngs.find((png) => png.look === look && png.view === view.id);
        if (
          a.projection !== b.projection ||
          a.minute !== b.minute ||
          Math.abs(a.fov - b.fov) > 0.15 ||
          Math.hypot(...a.camera.map((x, i) => x - b.camera[i])) > 0.12
        )
          throw new Error(`Camera mismatch for ${view.id} / ${look}`);
      }
    } else if (main.looks.includes(look)) comparison.mainOnly.push(look);
    else comparison.candidateOnly.push(look);
  }
  return {
    clickToReadyMs: candidate.ready.clickToReadyMs - main.ready.clickToReadyMs,
    firstSceneGzip6Bytes: candidate.firstScene.gzip6Bytes - main.firstScene.gzip6Bytes,
    views: matchedViews,
    looks: comparison,
  };
}

async function main() {
  const { entries, output } = options(process.argv.slice(2));
  const preflights = await Promise.all(entries.map(preflight));
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.mkdir(output);
  const tools = {
    ...require("./measure_coastal_views.cjs"),
    ...require("./coastal_probe_avatar.cjs"),
    PNG: require("pngjs").PNG,
  };
  const report = {
    checkedAt: new Date().toISOString(),
    status: "incomplete",
    viewport: [WIDTH, HEIGHT],
    routineDate: DATE,
    poses: VIEWS,
    results: {},
  };
  try {
    for (const [index, entry] of entries.entries()) {
      console.log(`Measuring ${entry.role} at ${entry.base.href}`);
      report.results[entry.role] = await runRevision(entry, preflights[index], output, tools);
      if (report.results[entry.role].failed) console.warn(`${entry.role}: ${report.results[entry.role].failed}`);
    }
    const { main, candidate } = report.results;
    if (main.ready && candidate.ready && main.firstScene && candidate.firstScene) {
      report.coldCandidateMinusMain = {
        clickToReadyMs: candidate.ready.clickToReadyMs - main.ready.clickToReadyMs,
        firstSceneGzip6Bytes: candidate.firstScene.gzip6Bytes - main.firstScene.gzip6Bytes,
      };
    }
    report.candidateMinusMain = summarize(main, candidate);
    report.status = "complete";
    console.table(
      Object.fromEntries(
        Object.entries(report.results).map(([role, side]) => [
          role,
          {
            readyMs: Math.round(side.ready.clickToReadyMs),
            firstSceneGzip6Bytes: side.firstScene.gzip6Bytes,
            coastFrameMs: side.views["coast-noon"].intervalMs.median,
            coastDraws: side.views["coast-noon"].drawsPerFrame,
            roomFrameMs: side.views["lounge-night"].intervalMs.median,
            roomDraws: side.views["lounge-night"].drawsPerFrame,
          },
        ])
      )
    );
    console.log(JSON.stringify(report.candidateMinusMain, null, 2));
  } catch (error) {
    report.failure = error.message;
    throw error;
  } finally {
    await fs.writeFile(path.join(output, "comparison.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(path.join(output, "comparison.json"));
  }
}

module.exports = {
  options,
  bindManifest,
  firstSceneBudget,
  measuredAt2K,
  summarize,
};

if (require.main === module) {
  if (process.argv.includes("--help")) console.log(usage);
  else
    main().catch((error) => {
      console.error(error.message + "\n" + usage);
      process.exitCode = 1;
    });
}
