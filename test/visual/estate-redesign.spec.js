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
  let occupied = 0,
    sampled = 0;
  // Keep full-screen controls and the two touch sticks out of this proof. A
  // live solver behind a blank WebKit surface is not a rendered walking view.
  for (let y = Math.ceil(image.height * 0.15); y < image.height * 0.65; y++)
    for (let x = Math.ceil(image.width * 0.2); x < image.width * 0.8; x++) {
      const i = (x + image.width * y) * 4;
      if (image.data[i + 3] > 100 && Math.min(image.data[i], image.data[i + 1], image.data[i + 2]) < 230) occupied++;
      sampled++;
    }
  return occupied / sampled;
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
  test.setTimeout(software ? 1200000 : 360000);
  const config = manifest(),
    errors = collectRuntimeErrors(page),
    samples = [],
    requestedViewport = page.viewportSize();
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-10-28T13:00:00-07:00") });
  await page.goto(publicRouteUrl("/") + "?scene-lab=1", { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]"),
    canvas = scene.locator("canvas");
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: software ? 150000 : 90000 });
  await canvas.scrollIntoViewIfNeeded();
  await pauseSceneClock(page);
  await useSoftwareSceneCadence(page, { continuousHz: 10, force: true });
  if (software) {
    testInfo.annotations.push({ type: "functional viewport", description: "480x320 after complete full-size loading; actual assets and capsule" });
    await page.setViewportSize({ width: 480, height: 320 });
  }
  await inputFrame(page, scene, canvas, () => page.locator("[data-world-fullscreen]").click());
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
  const study = config.rooms.find((room) => room.id === "study"),
    standing = study.walkActor,
    pose = async () => (await stateOf(scene)).walk;
  // A single initial room fixture avoids repeating the separately qualified complete
  // pavilion descent. From here every crossing, turn and return is ordinary keyboard
  // input; no later pose, height, collision, door or camera override is permitted.
  await inputFrame(page, scene, canvas, async () => {
    expect(await scene.evaluate((element, position) => element.setLabWalk({ position, yaw: Math.PI, pitch: -0.08 }), standing)).toBe(true);
  });
  expect((await pose()).room).toBe("study");
  let stagedCalls = 0;
  await scene.evaluate((element) => {
    element.setLabWalk = () => {
      window.__unexpectedVisitorPlacement = (window.__unexpectedVisitorPlacement || 0) + 1;
      throw new Error("A visitor journey cannot place the body after its initial room fixture");
    };
  });
  const beginning = await pose();
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
  } finally {
    const backend = await canvas.evaluate((element) => {
      const gl = element.getContext("webgl2") || element.getContext("webgl"),
        extension = gl?.getExtension("WEBGL_debug_renderer_info");
      return gl
        ? {
            renderer: gl.getParameter(extension?.UNMASKED_RENDERER_WEBGL || gl.RENDERER),
            vendor: gl.getParameter(extension?.UNMASKED_VENDOR_WEBGL || gl.VENDOR),
            buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
          }
        : null;
    });
    const proofPath = testInfo.outputPath("complete-visitor-patio-circulation.json");
    fs.writeFileSync(
      proofPath,
      JSON.stringify(
        { initialPlacement: standing, stagedCalls, samples, final: await pose(), errors, backend, requestedViewport, functionalCadenceHz: 10 },
        null,
        2
      )
    );
    await testInfo.attach("complete-visitor-patio-circulation", {
      path: proofPath,
      contentType: "application/json",
    });
  }
});
