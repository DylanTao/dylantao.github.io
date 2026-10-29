const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { PNG } = require("pngjs");
const { preparePage, collectRuntimeErrors } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const { pauseSceneClock, useSoftwareSceneCadence } = require("./scene-clock");

const ROOT = path.resolve(__dirname, "../..");
const manifest = () =>
  JSON.parse(fs.readFileSync(path.join(process.env.COASTAL_MODELS_ROOT || path.join(ROOT, "assets/models/home"), "manifest.json"), "utf8"));
const software = process.platform === "linux" || process.env.VISUAL_TRANSPORT_SOFTWARE === "1";
const stateOf = (scene) => scene.page().evaluate(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence());

function visibleSceneFraction(bytes) {
  const image = PNG.sync.read(bytes);
  const colors = new Set();
  let occupied = 0,
    sampled = 0;
  // Keep full-screen controls and the two touch sticks out of this proof. A
  // live solver behind a blank WebKit surface is not a rendered walking view.
  for (let y = Math.ceil(image.height * 0.15); y < image.height * 0.65; y++)
    for (let x = Math.ceil(image.width * 0.2); x < image.width * 0.8; x++) {
      const i = (x + image.width * y) * 4;
      if (image.data[i + 3] > 100 && Math.min(image.data[i], image.data[i + 1], image.data[i + 2]) < 230) {
        occupied++;
        colors.add(((image.data[i] >> 4) << 8) | ((image.data[i + 1] >> 4) << 4) | (image.data[i + 2] >> 4));
      }
      sampled++;
    }
  // An opaque but uniform black/background-only canvas is not scene evidence.
  return colors.size >= 16 ? occupied / sampled : 0;
}

async function inputFrame(page, scene, canvas, input) {
  const frames = (await stateOf(scene)).frames;
  await input();
  await canvas.scrollIntoViewIfNeeded();
  await expect
    .poll(
      async () => {
        await page.clock.runFor(32);
        return (await stateOf(scene)).frames;
      },
      { timeout: 60000 }
    )
    .toBeGreaterThan(frames);
}

async function doorParts(scene, id, pivot = null) {
  return scene.evaluate(
    (element, { id, pivot }) => {
      const parts = [];
      element.labScene.scene.traverse((object) => {
        if (object.userData.estateDoor !== id) return;
        const part = { name: object.name, x: object.position.x, z: object.position.z };
        if (pivot) {
          // The hinge axis in the part's parent frame, where estate-doors.mjs turns the part.
          const axis = object.position.clone().set(pivot.x, 0, pivot.z);
          if (object.parent) object.parent.worldToLocal(axis);
          part.dx = object.position.x - axis.x;
          part.dz = object.position.z - axis.z;
          part.quaternion = object.quaternion.toArray();
        }
        parts.push(part);
      });
      return parts;
    },
    { id, pivot }
  );
}

const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

// The turn about +Y that takes a part from one orientation to another: estate-doors.mjs
// premultiplies it, so it is open * inverse(rest), whose y and w components carry the angle.
function yawTurn([ax, ay, az, aw], [bx, by, bz, bw]) {
  const y = by * aw - bw * ay + bx * az - bz * ax,
    w = bw * aw + bx * ax + by * ay + bz * az;
  return wrapAngle(2 * Math.atan2(y, w));
}

test("estate thresholds: real leaves open before the body, cross both ways and close after leaving", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "One focused native door-motion proof complements the existing touch Walk tests.");
  test.setTimeout(software ? 600000 : 300000);
  const errors = collectRuntimeErrors(page);
  const config = manifest();
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-10-23T13:30:00-07:00") });
  await page.goto(publicRouteUrl("/") + "?scene-lab=1", { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]");
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: software ? 120000 : 90000 });
  const canvas = scene.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  await pauseSceneClock(page);
  await useSoftwareSceneCadence(page, { continuousHz: 10, force: true });
  await page.clock.runFor(500);
  expect((await stateOf(scene)).roomCount).toBe(config.rooms.length);
  if (software) {
    testInfo.annotations.push({
      type: "functional viewport",
      description: "480x320 after complete full-size loading; actual assets, shader and Walk solver",
    });
    await page.setViewportSize({ width: 480, height: 320 });
  }
  const ui = page.locator("[data-home-world-controls]");
  await inputFrame(page, scene, canvas, () => ui.locator("[data-world-fullscreen]").click());
  await inputFrame(page, scene, canvas, () => canvas.press("v"));
  await expect
    .poll(
      async () => {
        await page.clock.runFor(200);
        return (await stateOf(scene)).walk?.ready;
      },
      { timeout: 120000 }
    )
    .toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("[data-world-pause]")).toBeEnabled();
  await page.clock.runFor(800);
  const initial = await stateOf(scene);
  // The arrival's sandstone pivot leaf and the stair hall's oak pocket leaf onto the upper floor
  // and the library's east patio pivot are real moving leaves. The discreet
  // onsen approach deliberately has no intrusive leaf across the bathing view.
  expect(initial.simulation.estateDoors.doors.map((door) => door.id).sort()).toEqual(["library-patio", "main", "upper"]);
  const receipts = [];
  const pose = async () => (await stateOf(scene)).walk;
  const door = async (id) => (await stateOf(scene)).simulation.estateDoors.doors.find((entry) => entry.id === id);
  async function settleDoor(id, fraction) {
    await expect
      .poll(
        async () => {
          const current = await door(id);
          if (current.fraction === fraction) return current.fraction;
          await page.clock.runFor(32);
          return (await door(id)).fraction;
        },
        { timeout: 120000 }
      )
      .toBe(fraction);
  }
  async function place(position, yaw) {
    expect(await scene.evaluate((element, value) => element.setLabWalk(value), { position, yaw, pitch: 0 })).toBe(true);
  }
  async function walkAcross(id, definition, destination, axis) {
    for (let step = 0; step < 16; step++) {
      const before = await pose();
      if (Math.abs(before.position[axis] - destination) < 0.13) return before;
      await page.keyboard.down("KeyW");
      await page.clock.runFor(Math.min(150, Math.max(50, (Math.abs(before.position[axis] - destination) / 2) * 1000)));
      await page.keyboard.up("KeyW");
      await page.clock.runFor(50);
      const current = await pose();
      expect(Math.abs(current.position[1] - definition.floor), `${id}: the body stays on its actual storey`).toBeLessThan(0.15);
      expect((await door(id)).open, `${id}: never closes on a body crossing its threshold`).toBe(true);
    }
    throw new Error(`${id}: keyboard stopped at ${JSON.stringify(await pose())}, target[${axis}]=${destination}`);
  }
  try {
    for (const definition of config.estateDoors) {
      const { id } = definition;
      await inputFrame(page, scene, canvas, () => place(config.walk.start.position, config.walk.start.yaw));
      await settleDoor(id, 0);
      expect((await door(id)).fraction, `${id}: closed while the visitor is outside`).toBe(0);
      const resting = await doorParts(scene, id, definition.pivot);
      expect(resting.length).toBeGreaterThanOrEqual(2);
      // Cross the thin dimension of the actual opening: the library's east
      // wall faces X, while the arrival and upper leaves face Z.
      const span = (axis) => definition.opening.max[axis] - definition.opening.min[axis],
        axis = span(0) < span(2) ? 0 : 2,
        center = definition.center[axis],
        approach = [...definition.center],
        inwardYaw = axis === 0 ? -Math.PI / 2 : Math.PI,
        outwardYaw = axis === 0 ? Math.PI / 2 : 0;
      approach[1] = definition.floor;
      approach[axis] += 0.8;
      await inputFrame(page, scene, canvas, () => place(approach, inwardYaw));
      const partial = await door(id);
      expect(partial.fraction, `${id}: the actual leaf begins moving on approach`).toBeGreaterThan(0);
      expect(partial.fraction, `${id}: respects its bounded opening animation`).toBeLessThan(1);
      await settleDoor(id, 1);
      const opened = await door(id);
      expect(opened.fraction).toBe(1);
      if (definition.pivot) {
        expect(opened.angle).toBeCloseTo(definition.pivot.angle, 3);
        expect(opened.offset).toBe(0);
      } else expect(opened.offset).toBeCloseTo(definition.slideX, 3);
      const shifted = await doorParts(scene, id, definition.pivot);
      for (const part of shifted) {
        const rest = resting.find((entry) => entry.name === part.name);
        if (definition.pivot) {
          // A pivot leaf turns about its hinge: every part keeps its distance from the axis,
          // swings through the authored angle around it and turns by that angle itself.
          const radius = Math.hypot(rest.dx, rest.dz);
          expect(Math.hypot(part.dx, part.dz), `${id} ${part.name}: stays on its hinge circle`).toBeCloseTo(radius, 3);
          if (radius > 0.05)
            expect(wrapAngle(Math.atan2(rest.dz, rest.dx) - Math.atan2(part.dz, part.dx) - definition.pivot.angle)).toBeCloseTo(0, 2);
          expect(yawTurn(rest.quaternion, part.quaternion), `${id} ${part.name}: turns with the leaf`).toBeCloseTo(definition.pivot.angle, 2);
        } else expect(part.x - rest.x).toBeCloseTo(definition.slideX, 3);
      }
      const before = await pose();
      const inside = await walkAcross(id, definition, center - 0.8, axis);
      expect(inside.position[axis]).toBeLessThan(center - 0.6);
      await page.screenshot({ path: testInfo.outputPath(`estate-${id}-door-open.png`) });
      const stood = [...inside.position];
      await inputFrame(page, scene, canvas, () => place(stood, outwardYaw));
      expect(
        Math.hypot(...(await pose()).position.map((value, axis) => value - stood[axis])),
        "turning back does not teleport across a threshold"
      ).toBeLessThan(0.02);
      const outside = await walkAcross(id, definition, center + 0.8, axis);
      expect(outside.position[axis]).toBeGreaterThan(center + 0.6);
      expect(outside.distance - before.distance, `${id}: complete physical round trip`).toBeGreaterThan(2.6);
      await inputFrame(page, scene, canvas, () => place(config.walk.start.position, config.walk.start.yaw));
      await settleDoor(id, 0);
      const closed = await door(id);
      expect(closed.fraction).toBe(0);
      const returned = await doorParts(scene, id, definition.pivot);
      for (const part of returned) {
        const rest = resting.find((entry) => entry.name === part.name);
        expect(part.x).toBeCloseTo(rest.x, 3);
        expect(part.z).toBeCloseTo(rest.z, 3);
        if (definition.pivot) expect(yawTurn(rest.quaternion, part.quaternion)).toBeCloseTo(0, 3);
      }
      receipts.push({ id, partial, opened, inside, outside, closed, resting, shifted, returned });
    }
    // The living facade closes at night, but its real lift-and-slide leaves must still admit
    // a walker to the dry terrace and back. One initial placement isolates this threshold;
    // keyboard input performs both crossings without further position staging.
    await inputFrame(page, scene, canvas, () =>
      ui.locator("[data-world-time]").evaluate((input) => {
        input.value = "1290";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      })
    );
    const facade = async () => (await stateOf(scene)).simulation.facade.doors;
    // CI (d684c7eb2) once saw a leaf still scheduled open here, with the preview label at 9:30 pm; keep the state that
    // decides the schedule in the failure message so a recurrence says why.
    const night = await stateOf(scene);
    expect(
      night.simulation.facade.doors.every((leaf) => !leaf.scheduledOpen),
      `night facade schedule: ${JSON.stringify({ clockMode: night.clockMode, activity: night.activity, daylight: night.daylight?.daylight, doors: night.simulation.facade.doors })}`
    ).toBe(true);
    // The leaves ease shut over about 2.2 s of scene time. On Linux software GL each 100 ms step
    // is one ~1.6 s frame plus a ~1.1 s evidence read, so a 60 s poll at 100 ms ran out of wall
    // time just short of closed (CI a7c8534e5). Step further per read, allow the same budget as
    // the other polls here, and keep the last state for a recurrence.
    let lastFacade = null;
    await expect
      .poll(
        async () => {
          await page.clock.runFor(300);
          lastFacade = await facade();
          return lastFacade.every((leaf) => Math.abs(leaf.offset) < 0.01);
        },
        { timeout: 120000 }
      )
      .toBe(true)
      .catch((error) => {
        throw new Error(`${error.message}\nlast night facade state: ${JSON.stringify(lastFacade)}`);
      });
    const inside = config.retreat.patioRoute[1],
      outside = [inside[0], inside[1], config.facade.planeZ - 0.85];
    await inputFrame(page, scene, canvas, () => place(inside, Math.PI));
    const near = await facade();
    expect(
      near.some((leaf) => leaf.open && !leaf.scheduledOpen),
      "night approach opens the actual facade despite its closed schedule"
    ).toBe(true);
    const beginning = await pose();
    const crossings = [];
    for (const target of [outside, inside]) {
      if (crossings.length) {
        const stood = [...(await pose()).position];
        await inputFrame(page, scene, canvas, () => place(stood, 0));
        expect(Math.hypot(...(await pose()).position.map((value, axis) => value - stood[axis])), "the return turn preserves position").toBeLessThan(
          0.02
        );
      }
      for (let step = 0; step < 32; step++) {
        if (Math.abs((await pose()).position[2] - target[2]) < 0.13) break;
        await page.keyboard.down("KeyW");
        await page.clock.runFor(100);
        await page.keyboard.up("KeyW");
        await page.clock.runFor(50);
      }
      const reached = await pose();
      expect(Math.abs(reached.position[2] - target[2]), "keyboard crosses the delivered facade in each direction").toBeLessThan(0.15);
      expect(Math.abs(reached.position[1] - target[1]), "the dry terrace stays on its actual floor").toBeLessThan(0.15);
      crossings.push(reached);
    }
    expect(crossings[1].distance - beginning.distance, "both physical crossings accumulate walking distance").toBeGreaterThan(3.5);
    receipts.push({ id: "night-living-facade", inside, outside, near, crossings, final: await facade() });
    await page.screenshot({ path: testInfo.outputPath("living-terrace-night-return.png") });
    expect(errors).toEqual([]);
  } finally {
    await testInfo.attach("estate-door-round-trips", {
      body: JSON.stringify({ receipts, errors, functionalCadenceHz: 10, performanceBenchmark: false }, null, 2),
      contentType: "application/json",
    });
  }
});

test("visitor circulation: the study joins outdoor living and the living facade returns to the same floor", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1440" && testInfo.project.use.browserName !== "webkit",
    "One complete visitor route per engine complements the separate all-viewport Walk controls."
  );
  // The retained Linux trace walked55m without a collision stall in
  // twenty minutes. Keep this full100m route in its own CI shard and allow the
  // same real frames/10Hz cadence to finish; native-GPU budget stays unchanged.
  test.setTimeout(software ? 2700000 : 360000);
  const config = manifest(),
    errors = collectRuntimeErrors(page),
    samples = [],
    requestedViewport = page.viewportSize();
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-10-23T13:00:00-07:00") });
  await page.goto(publicRouteUrl("/") + "?scene-lab=1", { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]"),
    canvas = scene.locator("canvas");
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: software ? 150000 : 90000 });
  await canvas.scrollIntoViewIfNeeded();
  const startup = [];
  async function recordStartup(stage) {
    startup.push(
      await scene.evaluate((element, stage) => {
        const evidence = element.getSceneEvidence();
        return {
          stage,
          frames: evidence.frames,
          framePending: evidence.framePending,
          fullscreen: evidence.fullscreen,
          resolution: evidence.resolution,
          hidden: document.hidden,
          visibilityState: document.visibilityState,
          bounds: element.getBoundingClientRect().toJSON(),
          canvas: [element.querySelector("canvas").width, element.querySelector("canvas").height],
        };
      }, stage)
    );
    fs.writeFileSync(testInfo.outputPath("visitor-startup.json"), JSON.stringify(startup, null, 2));
  }
  await recordStartup("ready");
  if (software) {
    testInfo.annotations.push({ type: "functional viewport", description: "480x320 after complete full-size loading; actual assets and capsule" });
    await page.setViewportSize({ width: 480, height: 320 });
  }
  await canvas.scrollIntoViewIfNeeded();
  const beforeFullscreen = (await stateOf(scene)).frames;
  await page.locator("[data-world-fullscreen]").click();
  // Fullscreen and its IntersectionObserver/layout notifications belong to the
  // browser. Require an actual fullscreen frame before freezing the page clock
  // for deterministic walking, rather than mixing the two startup schedules.
  await expect.poll(async () => (await stateOf(scene)).fullscreen, { timeout: 60000 }).toBeTruthy();
  await expect
    .poll(async () => (await stateOf(scene)).resolution.css, { timeout: 60000 })
    .toEqual(software ? [480, 320] : [requestedViewport.width, requestedViewport.height]);
  if (software)
    await expect
      .poll(
        async () => {
          const state = await stateOf(scene);
          return [state.canvasWidth, state.canvasHeight];
        },
        { timeout: 60000 }
      )
      .toEqual([480, 320]);
  await expect.poll(async () => (await stateOf(scene)).frames, { timeout: 60000 }).toBeGreaterThan(beforeFullscreen);
  const fullscreenPixels = await canvas.screenshot();
  expect(visibleSceneFraction(fullscreenPixels), "the fullscreen startup frame contains the actual home").toBeGreaterThan(0.1);
  await testInfo.attach("visitor-fullscreen-startup", { body: fullscreenPixels, contentType: "image/png" });
  await recordStartup("fullscreen-rendered");
  await pauseSceneClock(page);
  await useSoftwareSceneCadence(page, { continuousHz: 10, force: true });
  await recordStartup("walking-clock-paused");
  await inputFrame(page, scene, canvas, () => canvas.press("v"));
  await expect
    .poll(
      async () => {
        await page.clock.runFor(200);
        return (await stateOf(scene)).walk?.ready;
      },
      { timeout: 120000 }
    )
    .toBe(true);
  let lastKnownPose;
  const study = config.rooms.find((room) => room.id === "study"),
    standing = study.walkActor,
    pose = async () => (lastKnownPose = (await stateOf(scene)).walk);
  // A single initial room fixture avoids repeating the separately qualified complete
  // pavilion descent. From here every crossing, turn and return is ordinary keyboard
  // input; no later pose, height, collision, door or camera override is permitted.
  await inputFrame(page, scene, canvas, async () => {
    expect(await scene.evaluate((element, position) => element.setLabWalk({ position, yaw: Math.PI, pitch: -0.08 }), standing)).toBe(true);
  });
  expect((await pose()).room).toBe("study");
  let stagedCalls = 0;
  const backend = await canvas.evaluate((element) => {
    const gl = element.getContext("webgl2") || element.getContext("webgl"),
      extension = gl?.getExtension("WEBGL_debug_renderer_info");
    return gl
      ? {
          renderer: gl.getParameter(extension?.UNMASKED_RENDERER_WEBGL || gl.RENDERER),
          vendor: gl.getParameter(extension?.UNMASKED_VENDOR_WEBGL || gl.VENDOR),
          functionalBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
        }
      : null;
  });
  await scene.evaluate((element) => {
    element.setLabWalk = () => {
      window.__unexpectedVisitorPlacement = (window.__unexpectedVisitorPlacement || 0) + 1;
      throw new Error("A visitor journey cannot place the body after its initial room fixture");
    };
  });
  const beginning = await pose();
  const proofPath = testInfo.outputPath("complete-visitor-patio-circulation.json");
  const writeProgress = (completed = false) =>
    fs.writeFileSync(
      proofPath,
      JSON.stringify(
        {
          initialPlacement: standing,
          stagedCalls,
          samples,
          final: lastKnownPose,
          errors,
          backend,
          requestedViewport,
          functionalCadenceHz: 10,
          completed,
        },
        null,
        2
      )
    );
  async function walkTo(target, label) {
    let stationary = 0;
    for (let step = 0; step < 150; step++) {
      const before = await pose(),
        dx = target[0] - before.position[0],
        dz = target[2] - before.position[2],
        distance = Math.hypot(dx, dz);
      if (distance < 0.13) {
        expect(Math.abs(before.position[1] - target[1]), `${label}: native support retains the real floor`).toBeLessThan(0.16);
        samples.push({ label, target, pose: before });
        writeProgress();
        return before;
      }
      const angle = wrapAngle(Math.atan2(dx, dz) - before.yaw);
      if (Math.abs(angle) > 0.114) {
        const key = angle > 0 ? "ArrowLeft" : "ArrowRight";
        await page.keyboard.down(key);
        await page.clock.runFor(Math.min(350, (Math.abs(angle) / 1.9) * 1000));
        await page.keyboard.up(key);
        await page.clock.runFor(17);
        continue;
      }
      await page.keyboard.down("KeyW");
      await page.clock.runFor(Math.max(17, Math.min(300, ((distance - 0.06) / 2) * 1000)));
      await page.keyboard.up("KeyW");
      await page.clock.runFor(17);
      const after = await pose();
      stationary = Math.hypot(after.position[0] - before.position[0], after.position[2] - before.position[2]) < 0.015 ? stationary + 1 : 0;
      if (stationary > 8) break;
    }
    throw new Error(`${label}: visitor stopped before ${JSON.stringify(target)} at ${JSON.stringify(await pose())}`);
  }
  const studyPatio = [standing, [-9.41, 0, 4.3], ...config.estateLibrary.patioDoor.route, ...config.retreat.patioRoute.slice(3)];
  try {
    for (const target of studyPatio.slice(1)) await walkTo(target, "study to outdoor living");
    const outside = await pose();
    expect(outside.room).toBe("outside");
    expect(outside.distance - beginning.distance).toBeGreaterThan(18);
    const outdoorPixels = await page.screenshot({ path: testInfo.outputPath("study-usable-patio.png") });
    expect(
      visibleSceneFraction(outdoorPixels),
      "the visitor sees the actual covered-patio scene, rather than controls over an empty canvas"
    ).toBeGreaterThan(0.08);
    for (const target of studyPatio.slice(0, -1).reverse()) await walkTo(target, "outdoor living back to study");
    const deskReturn = await pose();
    expect(deskReturn.room).toBe("study");
    expect(deskReturn.distance - outside.distance).toBeGreaterThan(18);
    await page.screenshot({ path: testInfo.outputPath("study-desk-return.png") });
    for (const target of study.exitPath.slice(1)) await walkTo(target, "study through the lower corridor");
    const living = config.retreat.patioRoute;
    await walkTo([living[0][0], 0, 13.6], "lower living aisle");
    await walkTo(living[0], "lower living");
    expect((await pose()).room).toBe("lounge");
    for (const target of living.slice(1)) await walkTo(target, "living to patio");
    expect((await pose()).room).toBe("outside");
    for (const target of living.slice(0, -1).reverse()) await walkTo(target, "patio back to living");
    expect((await pose()).room).toBe("lounge");
    if (software && requestedViewport) {
      await page.setViewportSize(requestedViewport);
      await inputFrame(page, scene, canvas, () => canvas.scrollIntoViewIfNeeded());
      // The GTK software compositor can present the preceding WebGL buffer
      // after allocation. Complete a second real draw before inspecting the
      // still; keep the same full scene, body and strict pixel gate.
      await inputFrame(page, scene, canvas, () => scene.evaluate((element) => element.labScene.requestFrame()));
    }
    const returnedPixels = await page.screenshot({ path: testInfo.outputPath("living-whole-patio-return.png") });
    expect(visibleSceneFraction(returnedPixels), "the final full-size return retains visible geometry").toBeGreaterThan(0.08);
    stagedCalls = await page.evaluate(() => window.__unexpectedVisitorPlacement || 0);
    expect(stagedCalls).toBe(0);
    expect(errors).toEqual([]);
    writeProgress(true);
  } finally {
    // The timeout closes the page before cleanup. Progress is already durable
    // at each actual waypoint; preserve the original failure, not a teardown
    // evaluate() error that hides where the visitor reached.
    if (!fs.existsSync(proofPath)) writeProgress();
    await testInfo.attach("complete-visitor-patio-circulation", {
      path: proofPath,
      contentType: "application/json",
    });
  }
});

async function openFlightVisitor(page, testInfo, start, { keepViewport = false } = {}) {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-10-23T13:00:00-07:00") });
  await page.goto(publicRouteUrl("/") + "?scene-lab=1", { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]"),
    canvas = scene.locator("canvas");
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 150000 });
  await canvas.scrollIntoViewIfNeeded();
  if (software && !keepViewport) {
    await page.setViewportSize({ width: 480, height: 320 });
    testInfo.annotations.push({ type: "functional viewport", description: "480x320 after complete loading; original scene and visitor physics" });
  }
  const beforeFullscreen = (await stateOf(scene)).frames;
  await page.locator("[data-world-fullscreen]").click();
  await expect.poll(async () => (await stateOf(scene)).fullscreen, { timeout: 60000 }).toBeTruthy();
  await expect
    .poll(async () => (await stateOf(scene)).resolution.css, { timeout: 60000 })
    .toEqual(software && !keepViewport ? [480, 320] : [page.viewportSize().width, page.viewportSize().height]);
  await expect.poll(async () => (await stateOf(scene)).frames, { timeout: 60000 }).toBeGreaterThan(beforeFullscreen);
  await page.locator("[data-world-walk]").click();
  await expect.poll(async () => (await stateOf(scene)).walk?.ready, { timeout: 120000 }).toBe(true);
  // Decoded presence alone is not a complete view: planting is initially hidden during warmup.
  await expect
    .poll(
      () =>
        scene.evaluate((element) =>
          ["clifftop-flora", "coastal-hinterland"].every((name) => {
            const object = element.labScene.scene.getObjectByName(name);
            if (!object) return false;
            for (let node = object; node; node = node.parent) if (!node.visible) return false;
            return true;
          })
        ),
      { timeout: 150000 }
    )
    .toBe(true);
  const readyFrame = (await stateOf(scene)).frames;
  await scene.evaluate((element) => element.labScene.requestFrame());
  await expect.poll(async () => (await stateOf(scene)).frames, { timeout: 60000 }).toBeGreaterThan(readyFrame);
  expect(visibleSceneFraction(await canvas.screenshot())).toBeGreaterThan(0.1);
  await pauseSceneClock(page);
  await useSoftwareSceneCadence(page, { continuousHz: 10, force: true });
  await inputFrame(page, scene, canvas, async () => {
    expect(await scene.evaluate((element, position) => element.setLabWalk({ position, yaw: Math.PI, pitch: -0.6 }), start)).toBe(true);
  });
  await scene.evaluate((element) => {
    element.setLabWalk = () => {
      throw new Error("No placement after a flight's supported starting fixture");
    };
  });
  await canvas.focus();
  const rows = [],
    proofPath = testInfo.outputPath("visitor-flight.json"),
    read = async () => {
      const evidence = await stateOf(scene);
      return { walk: evidence.walk, pool: evidence.simulation.infinityPool, camera: evidence.camera, frames: evidence.frames };
    },
    record = async (phase) => {
      const state = await read();
      rows.push({ phase, ...state });
      fs.writeFileSync(proofPath, JSON.stringify({ start, rows, errors }, null, 2));
      return state;
    },
    tick = async () => {
      await page.clock.runFor(100);
      return read();
    };
  return { scene, canvas, errors, rows, record, tick, read };
}

test("visitor flight: a cliff jump enters the pool, settles and leaves by the native steps", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1440" && testInfo.project.use.browserName !== "webkit",
    "One complete physical journey per engine; touch controls have their own case."
  );
  test.setTimeout(software ? 720000 : 300000);
  const view = await openFlightVisitor(page, testInfo, [-1, null, 5]),
    { scene, canvas, record, tick, read, errors } = view,
    start = await record("supported-roof");
  await page.keyboard.down("Shift");
  await page.keyboard.down("KeyW");
  await page.keyboard.press("Space");
  let current = start,
    airborne = false;
  for (let i = 0; i < 60 && current.walk.position[2] > -1.9; i++) {
    current = await tick();
    if (!current.walk.grounded && current.walk.position[1] > start.walk.position[1] + 0.1) {
      airborne = true;
      expect(current.camera[1] - current.walk.position[1]).toBeCloseTo(1.6, 1);
    }
  }
  await page.keyboard.up("KeyW");
  await page.keyboard.up("Shift");
  expect(airborne).toBe(true);
  expect(current.walk.position[2]).toBeLessThanOrEqual(-1.9);
  for (let i = 0; i < 60 && !current.walk.waterEntries; i++) current = await tick();
  current = await record("pool-impact");
  expect(current.walk.waterEntries).toBe(1);
  expect(current.pool.impacts.impacts).toBe(1);
  expect(current.pool.impacts.lastImpact.speed).toBeGreaterThan(8);
  expect(current.pool.spray.emitted).toBeGreaterThan(0);
  expect(current.pool.spray.materialsOwned, "streamed model finishing must preserve the splash materials").toBe(true);
  expect(current.pool.spray.crownCompiled, "the actual water sheet shader has rendered").toBe(true);
  expect(current.pool.impacts.amplitudeBound).toBeLessThanOrEqual(0.12001);
  await testInfo.attach("visitor-pool-impact", { body: await canvas.screenshot(), contentType: "image/png" });
  const impactEnergy = current.pool.impacts.energyJ;
  for (let i = 0; i < 110; i++) current = await tick();
  current = await record("floating-recovery");
  expect(current.walk.wet).toBe(true);
  expect(current.pool.impacts.energyJ).toBeLessThan(impactEnergy * 0.05);
  expect(current.pool.spray.active).toBe(0);
  expect(current.pool.spray.crown).toBe(false);
  expect(Math.abs(current.walk.verticalVelocity)).toBeLessThan(0.05);
  // Turn with the real keyboard, then wade onto the original basin treads and dry coping.
  await page.keyboard.down("ArrowRight");
  await page.clock.runFor((Math.PI / 1.9) * 1000);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.down("KeyW");
  for (let i = 0; i < 100 && current.walk.position[2] < 1.6; i++) current = await tick();
  await page.keyboard.up("KeyW");
  current = await record("dry-terrace");
  expect(current.walk.position[2]).toBeGreaterThanOrEqual(1.6);
  expect(current.walk.grounded).toBe(true);
  expect(current.walk.wet).toBe(false);
  expect(Math.abs(current.walk.position[1])).toBeLessThan(0.05);
  expect(current.walk.jumps).toBe(1);
  expect((await read()).walk.waterEntries).toBe(1);
  expect(visibleSceneFraction(await canvas.screenshot())).toBeGreaterThan(0.1);
  expect(errors).toEqual([]);
});

test("visitor flight: a clifftop fall reaches the native beach without a respawn", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440" && testInfo.project.use.browserName !== "webkit", "One complete physical journey per engine.");
  test.setTimeout(software ? 720000 : 300000);
  const { canvas, record, tick, errors } = await openFlightVisitor(page, testInfo, [10, null, 0]),
    start = await record("supported-clifftop");
  await page.keyboard.down("Shift");
  await page.keyboard.down("KeyW");
  await page.keyboard.press("Space");
  let current = start,
    crossedAir = false;
  for (let i = 0; i < 100 && current.walk.position[1] > -6.4; i++) {
    current = await tick();
    crossedAir ||= !current.walk.grounded && current.walk.position[1] < 0 && current.walk.position[1] > -5;
  }
  await page.keyboard.up("KeyW");
  await page.keyboard.up("Shift");
  for (let i = 0; i < 40 && !current.walk.grounded; i++) current = await tick();
  current = await record("beach-landing");
  expect(crossedAir).toBe(true);
  expect(start.walk.position[1] - current.walk.position[1]).toBeGreaterThan(10);
  expect(current.walk.position[1]).toBeLessThan(-6.4);
  expect(current.walk.position[1]).toBeGreaterThan(-8.3);
  expect(current.walk.grounded).toBe(true);
  expect(current.walk.jumps).toBe(1);
  expect(visibleSceneFraction(await canvas.screenshot())).toBeGreaterThan(0.1);
  await testInfo.attach("visitor-beach-landing", { body: await canvas.screenshot(), contentType: "image/png" });
  expect(errors).toEqual([]);
});

test("visitor controls: touch jumping stays reachable in portrait and landscape", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, "The real touch controller is exercised at the phone project.");
  test.setTimeout(software ? 600000 : 300000);
  const { scene, canvas, record, tick, read, errors } = await openFlightVisitor(page, testInfo, [-1, null, 5], { keepViewport: true });
  const jump = page.locator("[data-world-jump]");
  const sizes = [
    { width: 390, height: 1000 },
    { width: 844, height: 390 },
  ];
  const chromium = page.context().browser().browserType().name() === "chromium";
  for (let index = 0; index < sizes.length; index++) {
    const size = sizes[index];
    if (index) {
      // Chromium cannot resize an OS window while it is in native fullscreen. Exercise its
      // second orientation through the real exit/re-entry controls; WebKit rotates in place.
      if (chromium) {
        await page.locator("[data-world-exit]").tap();
        await expect.poll(async () => Boolean((await stateOf(scene)).fullscreen)).toBe(false);
      }
      await page.setViewportSize(size);
      if (chromium) {
        await page.locator("[data-world-fullscreen]").tap();
        await expect.poll(async () => (await stateOf(scene)).fullscreen).toBeTruthy();
        await page.locator("[data-world-walk]").tap();
        await expect(page.locator("[data-world-walk]")).toHaveAttribute("aria-pressed", "true");
        await expect.poll(async () => (await stateOf(scene)).walk?.ready).toBe(true);
      }
    }
    await inputFrame(page, scene, canvas, () => scene.evaluate((element) => element.labScene.requestFrame()));
    await expect.poll(async () => (await stateOf(scene)).resolution.css).toEqual([size.width, size.height]);
    const geometry = await page.evaluate(() => {
      const box = (selector) => {
        const element = document.querySelector(selector),
          r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      const button = document.querySelector("[data-world-jump]"),
        r = button.getBoundingClientRect();
      return {
        jump: box("[data-world-jump]"),
        move: box('[data-world-stick="move"]'),
        look: box('[data-world-stick="look"]'),
        hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("[data-world-jump]") === button,
      };
    });
    expect(geometry.jump.width).toBeGreaterThanOrEqual(44);
    expect(geometry.jump.height).toBeGreaterThanOrEqual(44);
    expect(geometry.jump.x).toBeGreaterThanOrEqual(0);
    expect(geometry.jump.right).toBeLessThanOrEqual(size.width);
    expect(geometry.jump.y).toBeGreaterThanOrEqual(0);
    expect(geometry.jump.bottom).toBeLessThanOrEqual(size.height);
    expect(geometry.jump.bottom).toBeLessThanOrEqual(geometry.look.y - 8);
    expect(geometry.hit, "Jump is visible and receives its own trusted touch").toBe(true);
    const beginning = await read();
    await inputFrame(page, scene, canvas, () => jump.tap());
    let peak = beginning.walk.position[1];
    for (let i = 0; i < 4; i++) peak = Math.max(peak, (await tick()).walk.position[1]);
    expect(peak - beginning.walk.position[1]).toBeGreaterThan(0.8);
    // A second trusted tap in midair must not manufacture another impulse.
    await inputFrame(page, scene, canvas, () => jump.tap());
    for (let i = 0; i < 15; i++) await tick();
    const landed = await record(`${size.width}x${size.height}-roof-return`);
    expect(landed.walk.jumps).toBe(index + 1);
    expect(landed.walk.grounded).toBe(true);
    expect(Math.abs(landed.walk.position[1] - beginning.walk.position[1])).toBeLessThan(0.05);
    expect(visibleSceneFraction(await canvas.screenshot())).toBeGreaterThan(0.1);
    fs.writeFileSync(testInfo.outputPath(`touch-jump-${size.width}.json`), JSON.stringify(geometry, null, 2));
    const screenshot = await page.screenshot();
    const pixels = PNG.sync.read(screenshot);
    expect([pixels.width, pixels.height]).toEqual([size.width, size.height]);
    fs.writeFileSync(testInfo.outputPath(`touch-jump-${size.width}.png`), screenshot);
  }
  await page.locator("[data-world-walk]").tap();
  await expect(jump).toBeHidden();
  expect(errors).toEqual([]);
});
