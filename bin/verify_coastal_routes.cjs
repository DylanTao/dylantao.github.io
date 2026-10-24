#!/usr/bin/env node
// Full-asset native-clock route proof. Examples:
// node bin/verify_coastal_routes.cjs --list --source-root D:/dev/dylantao.github.io
// node bin/verify_coastal_routes.cjs --url http://127.0.0.1:8080/ --routes main,patio --viewports desktop,mobile
// Separate bedroom-study / secret routes permit one labeled initial placement, never waypoint teleports.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { isDeepStrictEqual } = require("node:util");

const ROOT = path.resolve(__dirname, "..");
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const elapsed = (start) => (performance.now() - start) / 1000;
// This function is serialized whole into one page.evaluate per direction. Its
// pure math is also returned to Node for source-only tests, so the exact same
// waypoint/progress implementation runs in both environments without eval.
function nativeRouteFeedback(options) {
  const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
  const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
  const xzDistance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

  function waypointPassage(previous, current, from, target, tolerances) {
    const length = xzDistance(from, target);
    if (!length) return null;
    const ux = (target[0] - from[0]) / length,
      uz = (target[2] - from[2]) / length,
      before = (previous[0] - target[0]) * ux + (previous[2] - target[2]) * uz,
      after = (current[0] - target[0]) * ux + (current[2] - target[2]) * uz;
    if (before > 0 || after < 0 || after - before < 1e-8) return null;
    const fraction = -before / (after - before),
      position = previous.map((value, axis) => value + (current[axis] - value) * fraction),
      crossTrackMetres = Math.abs((position[0] - target[0]) * uz - (position[2] - target[2]) * ux),
      floorError = position[1] - target[1];
    if (crossTrackMetres > tolerances.waypointMetresXZ || Math.abs(floorError) > tolerances.waypointFloorMetres) return null;
    return {
      method: "linear crossing between observed capsule poses",
      from: previous,
      to: current,
      fraction,
      position,
      crossTrackMetres,
      floorError,
    };
  }

  function recordProgress(progress, gap, headingError, position, now) {
    const witness = { rangeImproved: false, headingImproved: false };
    // A new position changes the bearing to the waypoint. Start a separate
    // heading comparison there; merely moving this reference is not progress.
    if (!progress.headingPosition || xzDistance(progress.headingPosition, position) > 0.025) {
      progress.headingPosition = [...position];
      progress.bestHeadingError = headingError;
    } else if (headingError < progress.bestHeadingError - 0.025) {
      progress.bestHeadingError = headingError;
      witness.headingImproved = true;
    }
    if (gap < progress.bestDistance - 0.025) {
      progress.bestDistance = gap;
      witness.rangeImproved = true;
    }
    if (witness.rangeImproved || witness.headingImproved) progress.lastProgress = now;
    return { ...witness, bestDistance: progress.bestDistance, bestHeadingError: progress.bestHeadingError, lastProgress: progress.lastProgress };
  }

  if (options.logicOnly) return { wrap, distance, xzDistance, waypointPassage, recordProgress };
  const { selector, points, tolerances, directionTimeout, name, direction } = options,
    element = document.querySelector(selector),
    canvas = element?.querySelector("canvas"),
    started = performance.now(),
    result = { samples: [], reached: [], passed: false, input: "synthetic DOM KeyboardEvents; continuous native RAF feedback; isTrusted=false" };
  if (!canvas || !element.getSceneEvidence) throw new Error("Missing actual scene evidence/input canvas");
  return new Promise((resolve) => {
    let held = null,
      finished = false,
      index = 1,
      attempt = 0,
      observedPosition = null,
      observedSegment = null,
      settlingSince = null,
      request = null,
      progress = newProgress(started);
    function newProgress(now) {
      return { bestDistance: Infinity, bestHeadingError: Infinity, headingPosition: null, lastProgress: now };
    }
    const dispatch = (type, code) =>
      canvas.dispatchEvent(
        new KeyboardEvent(type, {
          key: code === "KeyW" ? "w" : code,
          code,
          bubbles: true,
          cancelable: true,
        })
      );
    function keys(code) {
      if (held === code) return;
      if (held) {
        dispatch("keyup", held);
        held = null;
      }
      if (code) {
        attempt++;
        held = code;
        dispatch("keydown", code);
      }
    }
    function finish(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (request !== null) cancelAnimationFrame(request);
      keys(null);
      result.elapsedSeconds = (performance.now() - started) / 1000;
      if (error) result.failure = { message: error.message, stack: error.stack };
      else result.passed = true;
      resolve(result);
    }
    const timeout = setTimeout(() => finish(new Error(`${name} ${direction} exceeded ${directionTimeout} seconds`)), directionTimeout * 1000);
    function frame() {
      if (finished) return;
      try {
        const now = performance.now(),
          value = element.getSceneEvidence(),
          pose = value.walk;
        if ((now - started) / 1000 >= directionTimeout) throw new Error(`${name} ${direction} exceeded ${directionTimeout} seconds`);
        if (!pose?.active || !pose.ready) throw new Error("Walking stopped or lost its collision field");
        if (observedPosition && distance(observedPosition, pose.position) > 1e-7) observedSegment = [observedPosition, [...pose.position]];
        observedPosition = [...pose.position];
        while (index < points.length) {
          // A continuously held key is one input step, however many native
          // frames it spans. Wall-clock progress/direction budgets still bound
          // a stuck body; fast displays must not fail simply for drawing more.
          if (attempt >= 160) throw new Error(`${name} waypoint ${index} exceeded 160 keyboard state changes`);
          const target = points[index],
            gap = xzDistance(pose.position, target),
            angle = wrap(Math.atan2(target[0] - pose.position[0], target[2] - pose.position[2]) - pose.yaw),
            passage =
              index < points.length - 1 && observedSegment ? waypointPassage(...observedSegment, points[index - 1], target, tolerances) : null,
            sample = {
              elapsedSeconds: (now - started) / 1000,
              index,
              target,
              position: [...pose.position],
              yaw: pose.yaw,
              distance: gap,
              headingError: angle,
              progress: recordProgress(progress, gap, Math.abs(angle), pose.position, now),
              floorError: pose.position[1] - target[1],
              frames: value.frames,
              blockedFrames: pose.blockedFrames,
              lastBlocked: pose.lastBlocked,
              input: held,
              phase: settlingSince === null ? "route" : "settling",
            };
          result.samples.push(sample);
          if (settlingSince !== null) {
            keys(null);
            if (Math.hypot(...(pose.velocity || [0, 0])) >= 0.06) {
              if ((now - settlingSince) / 1000 >= 1.5) throw new Error("The body did not settle after releasing W within 1.5 native seconds");
              break;
            }
            settlingSince = null;
            // Recheck the actual endpoint after physical deceleration. If it
            // coasted outside tolerance, steer back instead of accepting drift.
          }
          if (gap <= tolerances.waypointMetresXZ || passage) {
            if (gap <= tolerances.waypointMetresXZ && Math.abs(sample.floorError) > tolerances.waypointFloorMetres)
              throw new Error(`${name} waypoint ${index}: wrong native floor ${sample.floorError}`);
            if (index === points.length - 1) {
              keys(null);
              if (Math.hypot(...(pose.velocity || [0, 0])) >= 0.06) {
                settlingSince = now;
                break;
              }
            }
            if (gap > tolerances.waypointMetresXZ) sample.passage = passage;
            result.reached.push(sample);
            index++;
            attempt = 0;
            progress = newProgress(now);
            if (index === points.length) {
              result.finished = {
                frames: value.frames,
                roomCount: value.roomCount,
                currentRoom: value.currentRoom,
                animationSeconds: value.animationSeconds,
                walk: pose,
                camera: value.camera,
              };
              finish();
              return;
            }
            continue;
          }
          if ((now - progress.lastProgress) / 1000 > tolerances.noProgressSeconds) {
            result.stall = sample;
            throw new Error(`${name} ${direction} stalled at waypoint ${index}: ${JSON.stringify(sample)}`);
          }
          keys(Math.abs(angle) > tolerances.headingRadians ? (angle > 0 ? "ArrowLeft" : "ArrowRight") : "KeyW");
          sample.nextInput = held;
          break;
        }
        request = requestAnimationFrame(frame);
      } catch (error) {
        finish(error);
      }
    }
    request = requestAnimationFrame(frame);
  });
}
const { wrap, distance, xzDistance, waypointPassage, recordProgress } = nativeRouteFeedback({ logicOnly: true });

const OPTIONS = new Set([
  "url",
  "out",
  "routes",
  "viewports",
  "source-root",
  "time",
  "direction-timeout",
  "total-timeout",
  "list",
  "one-way",
  "help",
]);

function parseOptions(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].replace(/^--/, "");
    assert.ok(argv[i].startsWith("--") && OPTIONS.has(name), `Unknown argument: ${argv[i]}`);
    if (["list", "one-way", "help"].includes(name)) values[name] = true;
    else {
      assert.ok(argv[i + 1] && !argv[i + 1].startsWith("--"), `Missing --${name} value`);
      values[name] = argv[++i];
    }
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const result = {
    base: values.url && new URL(values.url).href.replace(/\/?$/, "/"),
    out: path.resolve(values.out || path.join(ROOT, ".jekyll-cache/visual-qa", `coastal-routes-${stamp}`)),
    sourceRoot: path.resolve(values["source-root"] || ROOT),
    routineTime: values.time || "2026-10-24T13:20:00-07:00",
    routes: (values.routes || "main,patio").split(","),
    viewports: (values.viewports || "desktop,mobile").split(","),
    directionTimeout: Number(values["direction-timeout"] || 180),
    totalTimeout: Number(values["total-timeout"] || 900),
    list: Boolean(values.list),
    oneWay: Boolean(values["one-way"]),
    help: Boolean(values.help),
  };
  assert.ok(
    result.viewports.every((name) => ["desktop", "mobile"].includes(name)),
    "--viewports accepts desktop,mobile"
  );
  assert.equal(new Set(result.viewports).size, result.viewports.length, "Duplicate viewport");
  assert.equal(new Set(result.routes).size, result.routes.length, "Duplicate route");
  assert.ok(Number.isFinite(Date.parse(result.routineTime)), "--time must be a valid timestamp with a timezone");
  assert.match(result.routineTime, /(?:Z|[+-]\d{2}:\d{2})$/, "--time requires an explicit timezone");
  assert.ok(result.directionTimeout >= 10 && result.directionTimeout <= 600, "--direction-timeout must be 10–600 seconds");
  assert.ok(result.totalTimeout >= 30 && result.totalTimeout <= 1800, "--total-timeout must be 30–1800 seconds");
  return result;
}

function routeDefinitions(manifest) {
  const destination = manifest.entrance?.publicDestination,
    livingRoom = manifest.rooms?.some((room) => room.id === destination) ? destination : manifest.activities?.lounge?.room || "lounge";
  return {
    main: {
      path: "walk.mainEntryRoute",
      points: manifest.walk?.mainEntryRoute,
      endRoom: livingRoom,
      publicStart: true,
    },
    patio: { path: "retreat.patioRoute", points: manifest.retreat?.patioRoute, endRoom: "outside" },
    "bedroom-study": { path: "estateLibrary.privateConnection", points: manifest.estateLibrary?.privateConnection, endRoom: "study" },
    secret: { path: "privateEntrance.route", points: manifest.privateEntrance?.route, endRoom: "onsen" },
  };
}

function validateRoute(name, definition) {
  assert.ok(definition, `Unknown route '${name}'; select main,patio,bedroom-study,secret`);
  assert.ok(Array.isArray(definition.points) && definition.points.length > 1, `Missing native route ${definition.path}`);
  for (const point of definition.points)
    assert.ok(Array.isArray(point) && point.length === 3 && point.every(Number.isFinite), `Invalid ${definition.path} point`);
  return definition;
}

async function sourceRecord(sourceRoot, relative, bytes) {
  const file = path.resolve(sourceRoot, relative);
  assert.ok(file.startsWith(sourceRoot + path.sep), `Source path escapes root: ${relative}`);
  const expected = await fs.readFile(file),
    text = /\.(?:mjs|json)$/.test(relative),
    rawMatch = expected.equals(bytes),
    lfMatch = text && expected.toString("utf8").replaceAll("\r\n", "\n") === bytes.toString("utf8").replaceAll("\r\n", "\n"),
    jsonMatch = relative.endsWith(".json") && isDeepStrictEqual(JSON.parse(expected), JSON.parse(bytes));
  return {
    path: relative,
    bytes: bytes.length,
    servedSha256: sha(bytes),
    sourceSha256: sha(expected),
    canonicalLfSha256: text ? sha(Buffer.from(expected.toString("utf8").replaceAll("\r\n", "\n"))) : null,
    match: rawMatch ? "exact" : lfMatch ? "LF-only normalization" : jsonMatch ? "JSON-format-only normalization" : "MISMATCH",
  };
}

async function main(options) {
  const localManifest = JSON.parse(await fs.readFile(path.join(options.sourceRoot, "assets/models/home/manifest.json"), "utf8"));
  const definitions = routeDefinitions(localManifest);
  if (options.list) {
    console.log(
      JSON.stringify(
        Object.entries(definitions).map(([name, route]) => ({
          name,
          path: route.path,
          available: Array.isArray(route.points) && route.points.length > 1,
          points: route.points?.length ?? 0,
          start: route.points?.[0],
          end: route.points?.at(-1),
          endRoom: route.endRoom,
        })),
        null,
        2
      )
    );
    return;
  }
  assert.ok(options.base, "Provide --url for the owned, fully built server; this runner starts no server and overlays no assets.");
  for (const name of options.routes) validateRoute(name, definitions[name]);
  assert.ok(
    !(options.routes.includes("main") && options.routes.includes("patio")) || options.routes.indexOf("patio") === options.routes.indexOf("main") + 1,
    "Run main,patio consecutively to preserve their actual inside-to-outside continuity."
  );
  await fs.mkdir(options.out, { recursive: true });
  assert.equal(
    await fs.access(path.join(options.out, "report.json")).then(
      () => true,
      () => false
    ),
    false,
    "Output already contains a report; choose a new folder."
  );
  const report = {
    scope:
      "Full native assets and synthetic DOM W/Arrow KeyboardEvents held and released by page-side native RAF feedback. This exercises the real input handlers and capsule, but is not trusted hardware keyboard input. Native RAF/performance/timers remain unchanged; only the authored routine Date is fixed. No waypoint teleport, viewport reduction, shader override or quality omission. Mobile is host-GPU touch emulation, not a physical-phone performance measurement.",
    options,
    fixedRoutineDate: options.routineTime,
    networkStubs: "Standard test/visual/helpers.js external-service stubs only; all local scene assets remain real.",
    sourceCommit: null,
    started: new Date().toISOString(),
    tolerances: { waypointMetresXZ: 0.18, waypointFloorMetres: 0.25, headingRadians: 0.14, noProgressSeconds: 7 },
    intermediateWaypoints:
      "All original native points retained. Either actual distance is within tolerance, or an observed capsule segment crosses the incoming waypoint plane within the same cross-track/floor bounds. The final endpoint always requires actual distance within tolerance.",
    states: [],
    passed: false,
  };
  try {
    report.sourceCommit = execFileSync("git", ["-C", options.sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {}
  const saveReport = () => fs.writeFile(path.join(options.out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  let browser;
  const watchdog = setTimeout(() => {
    report.watchdogExpired = true;
    browser?.close().catch(() => {});
  }, options.totalTimeout * 1000);
  try {
    const response = await fetch(new URL("assets/models/home/manifest.json", options.base), { signal: AbortSignal.timeout(30000) });
    assert.ok(response.ok, `Manifest HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    report.manifest = await sourceRecord(options.sourceRoot, "assets/models/home/manifest.json", bytes);
    assert.notEqual(report.manifest.match, "MISMATCH", "The served manifest differs from --source-root");
    const manifest = JSON.parse(bytes.toString("utf8")),
      routes = routeDefinitions(manifest),
      { chromium } = require("playwright"),
      canonical = require("../test/visual/public.config.js"),
      { preparePage, collectRuntimeErrors, screenshotMetrics } = require("../test/visual/helpers.js");
    report.launchOptions = canonical.use.launchOptions || {};
    report.processIsolation = "Fresh native browser process per viewport; full scene quality is unchanged.";
    for (const viewport of options.viewports) {
      browser = await chromium.launch({ ...report.launchOptions, headless: true, timeout: 30000 });
      assert.ok(!report.watchdogExpired, "The total native route budget expired during browser startup");
      const context = await browser.newContext({
        viewport: viewport === "desktop" ? { width: 1440, height: 1000 } : { width: 390, height: 1000 },
        deviceScaleFactor: 1,
        hasTouch: viewport === "mobile",
        isMobile: viewport === "mobile",
        locale: "en-US",
        timezoneId: "America/Los_Angeles",
      });
      const page = await context.newPage(),
        errors = collectRuntimeErrors(page),
        state = { viewport, errors, failedResponses: [], assets: [], routes: [], placements: [], captures: [], passed: false },
        assetTasks = [];
      report.states.push(state);
      page.setDefaultTimeout(30000);
      page.on("response", (response) => {
        const url = new URL(response.url()),
          index = url.pathname.indexOf("/assets/"),
          relative = index >= 0 ? url.pathname.slice(index + 1) : null;
        if (url.origin === new URL(options.base).origin && response.status() >= 400)
          state.failedResponses.push({ url: response.url(), status: response.status() });
        if (!relative || !(/^assets\/models\/home\/.*\.(?:glb|json)$/.test(relative) || /^assets\/js\/home-scene\/.*\.mjs$/.test(relative))) return;
        assetTasks.push(
          response
            .body()
            .then((bytes) => sourceRecord(options.sourceRoot, relative, bytes))
            .then((record) => state.assets.push({ ...record, url: response.url() }))
            .catch((error) => {
              errors.push(`asset custody ${relative}: ${error.message}`);
            })
        );
      });
      const scene = page.locator("[data-home-desk-scene]"),
        canvas = scene.locator("canvas"),
        read = () =>
          scene.evaluate((element) => {
            const value = element.getSceneEvidence();
            return {
              frames: value.frames,
              roomCount: value.roomCount,
              currentRoom: value.currentRoom,
              animationSeconds: value.animationSeconds,
              walk: value.walk,
              camera: value.camera,
            };
          });
      async function screenshot(label) {
        const file = `${viewport}-${label}.png`,
          bytes = await canvas.screenshot({ path: path.join(options.out, file), timeout: 30000 }),
          metrics = screenshotMetrics(bytes);
        state.captures.push({ label, file, sha256: sha(bytes), metrics });
        if (label !== "failure") {
          assert.ok(metrics.uniqueColors > 50 && metrics.luminanceVariance > 10, `The actual ${label} canvas is blank or nearly uniform`);
        }
      }
      async function follow(name, definition, reverse = false) {
        const points = reverse ? [...definition.points].reverse() : definition.points,
          route = {
            name,
            direction: reverse ? "return" : "forward",
            path: definition.path,
            started: new Date().toISOString(),
            samples: [],
            reached: [],
            passed: false,
          };
        state.routes.push(route);
        await canvas.focus();
        // One host call per direction: no per-frame CDP, filesystem write,
        // clock replacement, waypoint placement or quality change.
        Object.assign(
          route,
          await page.evaluate(nativeRouteFeedback, {
            selector: "[data-home-desk-scene]",
            points,
            tolerances: report.tolerances,
            directionTimeout: options.directionTimeout,
            name,
            direction: route.direction,
          })
        );
        await saveReport();
        assert.equal(route.passed, true, route.failure?.message || `${name}: native feedback failed`);
        assert.ok(xzDistance(route.finished.walk.position, points.at(-1)) <= report.tolerances.waypointMetresXZ, `${name}: endpoint missed`);
        if (!reverse && definition.endRoom) assert.equal(route.finished.walk.room, definition.endRoom, `${name}: wrong endpoint room`);
        await screenshot(`${name}-${route.direction}-${name === "main" && !reverse ? "living" : name === "patio" && !reverse ? "patio" : "arrival"}`);
        await saveReport();
        console.log(`${viewport}: ${name} ${route.direction} passed (${route.reached.length} native waypoints; ${route.elapsedSeconds.toFixed(1)}s)`);
      }
      try {
        await preparePage(page, "light");
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.addInitScript((time) => {
          const NativeDate = Date,
            fixed = NativeDate.parse(time);
          window.__coastalRouteClock = { raf: requestAnimationFrame, performanceNow: performance.now, timeout: setTimeout };
          window.Date = new Proxy(NativeDate, {
            apply: () => new NativeDate(fixed).toString(),
            construct: (target, args) => Reflect.construct(target, args.length ? args : [fixed]),
            get: (target, property) => (property === "now" ? () => fixed : Reflect.get(target, property)),
          });
        }, report.fixedRoutineDate);
        await page.goto(new URL("?scene-lab=1", options.base).href, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.locator('[data-home-desk-mode="3d"]').click();
        await scene.waitFor({ state: "visible" });
        await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 150000 });
        await canvas.scrollIntoViewIfNeeded();
        state.graphics = await canvas.evaluate((canvas) => {
          const gl = canvas.getContext("webgl2"),
            debug = gl?.getExtension("WEBGL_debug_renderer_info");
          return {
            renderer: gl && gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
            vendor: gl && gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
          };
        });
        assert.ok(state.graphics.renderer, "No WebGL2 renderer");
        assert.doesNotMatch(
          state.graphics.renderer,
          /SwiftShader|llvmpipe|softpipe|software/i,
          "This is a native hardware proof; stop instead of silently switching to software"
        );
        if (process.platform === "win32")
          assert.match(state.graphics.renderer, /Direct3D11|D3D11/i, "Windows proof must use the canonical D3D11 backend");
        state.clock = await page.evaluate(() => ({
          sameRaf: window.__coastalRouteClock.raf === requestAnimationFrame,
          samePerformance: window.__coastalRouteClock.performanceNow === performance.now,
          sameTimeout: window.__coastalRouteClock.timeout === setTimeout,
          routineDate: new Date().toISOString(),
          performanceNow: performance.now(),
        }));
        assert.ok(state.clock.sameRaf && state.clock.samePerformance && state.clock.sameTimeout, "A clock/cadence patch replaced native APIs");
        await page.locator("[data-world-fullscreen]").click();
        await page.locator("[data-world-walk]").click();
        await page.waitForFunction(
          () => {
            const value = document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.();
            return value?.walk?.active && value.walk.ready && value.walk.placed && value.walkPresence?.active && value.walkPresence.prepared;
          },
          null,
          { timeout: 150000 }
        );
        state.initial = await read();
        assert.equal(state.initial.roomCount, manifest.rooms.length, "All native rooms must be loaded before the navigation proof");
        assert.ok(
          distance(state.initial.walk.position, manifest.walk.start.position) < 0.2,
          "First public Walk did not arrive at the actual main entrance"
        );
        await screenshot("public-walk-start");
        let deferredMain = false;
        for (let index = 0; index < options.routes.length; index++) {
          const name = options.routes[index],
            definition = validateRoute(name, routes[name]),
            pose = (await read()).walk;
          if (name === "main") assert.ok(distance(pose.position, definition.points[0]) < 0.2, "Main route requires the unmodified public arrival");
          else if (name === "patio" && options.routes[index - 1] === "main") {
            assert.ok(
              distance(pose.position, definition.points[0]) < 0.25,
              "Main entry and patio route are not continuous; no teleport is allowed to hide the gap"
            );
          } else {
            const first = definition.points[0],
              next = definition.points[1],
              placed = await scene.evaluate((element, value) => element.setLabWalk(value), {
                position: first,
                yaw: Math.atan2(next[0] - first[0], next[2] - first[2]),
                pitch: 0,
              });
            assert.equal(placed, true, `${name}: initial staging point is not a valid native capsule pose`);
            const actual = (await read()).walk.position;
            assert.ok(distance(actual, first) < 0.2, `${name}: staging snapped away from the declared first point`);
            state.placements.push({
              route: name,
              requested: first,
              actual,
              scope:
                "One initial placement for a separate route; every subsequent waypoint uses synthetic DOM keyboard input through native handlers.",
            });
          }
          await follow(name, definition);
          if (name === "main" && options.routes[index + 1] === "patio") deferredMain = true;
          else if (!options.oneWay) await follow(name, definition, true);
          if (name === "patio" && deferredMain && !options.oneWay) {
            await follow("main", routes.main, true);
            deferredMain = false;
          }
        }
        await Promise.all(assetTasks);
        assert.equal(state.assets.filter((asset) => asset.match === "MISMATCH").length, 0, "The browser received stale or different source assets");
        assert.ok(
          state.assets.some((asset) => asset.path === "assets/models/home/manifest.json"),
          "The browser manifest response was not recorded"
        );
        assert.ok(
          state.assets.some((asset) => asset.path === "assets/js/home-scene/controller.mjs"),
          "The actual controller response was not recorded"
        );
        for (const room of manifest.rooms)
          assert.ok(
            state.assets.some((asset) => asset.path === `assets/models/home/${room.file}`),
            `Missing native room response ${room.file}`
          );
        assert.deepEqual(errors, [], "Runtime errors were recorded");
        assert.deepEqual(state.failedResponses, [], "Same-origin HTTP failures were recorded");
        state.passed = true;
      } catch (error) {
        state.failure = { message: error.message, stack: error.stack };
        await screenshot("failure").catch((captureError) => {
          state.captureFailure = captureError.message;
        });
        await Promise.allSettled(assetTasks);
        throw error;
      } finally {
        await page.keyboard.up("KeyW").catch(() => {});
        await page.keyboard.up("ArrowLeft").catch(() => {});
        await page.keyboard.up("ArrowRight").catch(() => {});
        await saveReport();
        await context.close();
        await browser.close();
        browser = null;
      }
    }
    report.passed = report.states.length === options.viewports.length && report.states.every((state) => state.passed);
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    clearTimeout(watchdog);
    await browser?.close();
    report.finished = new Date().toISOString();
    await saveReport();
    console.log(JSON.stringify({ passed: report.passed, output: path.join(options.out, "report.json"), failure: report.failure?.message }));
  }
}

if (require.main === module) {
  let options;
  try {
    options = parseOptions(process.argv.slice(2));
    if (options.help)
      console.log(
        "Use --url URL [--routes main,patio,bedroom-study,secret] [--viewports desktop,mobile] [--time ISO_TIMESTAMP_WITH_TIMEZONE] [--source-root PATH] [--out PATH] [--one-way]. --list reads source metadata without launching a browser. Direction timeout defaults to 180 seconds; whole-run timeout 900 seconds. No server is started."
      );
    else
      main(options).catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { parseOptions, routeDefinitions, validateRoute, sourceRecord, nativeRouteFeedback, waypointPassage, recordProgress };
