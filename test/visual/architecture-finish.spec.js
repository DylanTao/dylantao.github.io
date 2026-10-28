const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { PNG } = require("pngjs");
const { preparePage, collectRuntimeErrors } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");

const ROOT = path.resolve(__dirname, "../..");
const models = path.resolve(process.env.COASTAL_MODELS_ROOT || path.join(ROOT, "assets/models/home"));
const config = JSON.parse(fs.readFileSync(path.join(models, "manifest.json"), "utf8"));
// This scene is already attached before observation begins. Re-resolving a
// locator for every state field adds a utility-world/RAF wait on software GL.
const evidence = (scene) => scene.page().evaluate(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence());

async function retain(testInfo, name, { body, contentType }) {
  const suffix = contentType === "image/png" ? ".png" : ".json";
  const filename = testInfo.outputPath(name + suffix);
  fs.writeFileSync(filename, body);
  await testInfo.attach(name, { path: filename, contentType });
}

async function sourceRoutes(page) {
  // preparePage installs the public network stubs first. This later route owns
  // the source candidate explicitly, so a built baseline cannot impersonate it.
  if (process.env.COASTAL_MODELS_ROOT) {
    await page.route(/\/assets\/models\/home\//, async (route) => {
      const relative = decodeURIComponent(new URL(route.request().url()).pathname.split("/assets/models/home/")[1]);
      const file = path.resolve(models, relative);
      if (!file.startsWith(models + path.sep) || !fs.existsSync(file)) return route.fallback();
      const type = file.endsWith(".json") ? "application/json" : file.endsWith(".glb") ? "model/gltf-binary" : "application/octet-stream";
      await route.fulfill({ body: fs.readFileSync(file), contentType: type });
    });
  }
  if (process.env.COASTAL_RUNTIME_ROOT) {
    const root = path.resolve(process.env.COASTAL_RUNTIME_ROOT);
    await page.route(/\/assets\/js\/home-scene\/.*\.mjs(?:\?|$)/, async (route) => {
      const relative = decodeURIComponent(new URL(route.request().url()).pathname.split("/assets/js/home-scene/")[1]).replace(/\.min\.mjs$/, ".mjs");
      const file = path.resolve(root, "assets/js/home-scene", relative);
      if (!file.startsWith(path.join(root, "assets/js/home-scene") + path.sep) || !fs.existsSync(file)) return route.fallback();
      await route.fulfill({ body: fs.readFileSync(file), contentType: "text/javascript" });
    });
  }
}

function nonblank(bytes) {
  const image = PNG.sync.read(bytes),
    colors = new Set();
  let low = 255,
    high = 0;
  for (let y = 0; y < image.height; y += 7)
    for (let x = 0; x < image.width; x += 7) {
      const i = (y * image.width + x) * 4,
        value = (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3;
      low = Math.min(low, value);
      high = Math.max(high, value);
      colors.add(`${image.data[i] >> 4},${image.data[i + 1] >> 4},${image.data[i + 2] >> 4}`);
    }
  expect(high - low).toBeGreaterThan(40);
  expect(colors.size).toBeGreaterThan(24);
}

function pixelDifference(a, b) {
  const before = PNG.sync.read(a),
    after = PNG.sync.read(b);
  expect([after.width, after.height]).toEqual([before.width, before.height]);
  let changed = 0,
    sum = 0;
  for (let i = 0; i < before.data.length; i += 4) {
    const difference = Math.max(...[0, 1, 2].map((k) => Math.abs(before.data[i + k] - after.data[i + k])));
    changed += difference > 2;
    sum += difference;
  }
  return { changedPixels: changed, meanMaximumChannelError: sum / (before.width * before.height), width: before.width, height: before.height };
}

test("finished house: adjacent bedchamber, library patio leaf and composed exterior remain visible through public room visits", async ({
  page,
}, testInfo) => {
  test.setTimeout(process.platform === "linux" || process.env.VISUAL_TRANSPORT_SOFTWARE === "1" ? 900000 : 600000);
  const errors = collectRuntimeErrors(page),
    records = [];
  await preparePage(page, "light");
  await sourceRoutes(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-10-26T14:00:00-07:00"));
  if (process.env.VISUAL_ARCHITECTURE_4K === "1") await page.setViewportSize({ width: 3840, height: 2160 });
  await page.goto(publicRouteUrl("/") + "?scene-lab=1&quality=high&resolution=fixed", { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]"),
    ui = page.locator("[data-home-world-controls]");
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 150000 });
  const canvas = scene.locator("canvas");
  await ui.locator("[data-world-fullscreen]").click();
  await expect.poll(async () => Boolean((await evidence(scene)).fullscreen), { timeout: 60000 }).toBe(true);
  const initial = await evidence(scene);
  expect(initial.roomCount).toBe(config.rooms.length);
  expect(initial.simulation.lightField.ready).toBe(true);
  expect(initial.simulation.lightField.triangles).toBeLessThanOrEqual(750000);
  const transport = await scene.evaluate(async (element) => {
    const snapshot = element.labScene.exportStaticLightSnapshot("0".repeat(64));
    const body = JSON.stringify(snapshot) + "\n";
    const compressed = await new Response(new Blob([body]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
    return {
      snapshotBytesBeforeSourceInputs: new TextEncoder().encode(body).byteLength,
      snapshotGzipBytesBeforeSourceInputs: compressed.byteLength,
      statistics: snapshot.statistics,
      configuration: snapshot.configuration,
      scope: "Actual delivered field, including source-bound cache restoration when available; exported snapshot size excludes source inputs",
    };
  });
  await retain(testInfo, "architecture-first-ready", {
    body: Buffer.from(JSON.stringify({ initial, transport }, null, 2)),
    contentType: "application/json",
  });
  expect(transport.statistics.triangles + transport.statistics.skippedTriangles).toBeLessThanOrEqual(750000);
  expect(initial.simulation.estateDoors.doors.map((door) => door.id)).toContain("library-patio");
  const native = await scene.evaluate((element) => {
    const objects = [];
    element.labScene.scene.traverse((node) => {
      if (/core_finish_(bedchamber|pavilion|pool_front_box|terrace_structure)|library_patio_|gallery_finish_/.test(node.name))
        objects.push({ name: node.name, visible: node.visible, mesh: Boolean(node.isMesh) });
    });
    return objects;
  });
  expect(native.some((node) => node.name.includes("bedchamber"))).toBe(true);
  expect(native.some((node) => node.name.includes("pavilion"))).toBe(true);
  const lab = ui.locator("[data-world-lab]");
  const labOpen = () => page.evaluate(() => document.querySelector("[data-world-lab]").open);
  if (!(await labOpen())) await lab.locator("summary").first().click();
  await expect.poll(async () => Boolean((await evidence(scene)).cameraCollision?.ready), { timeout: 90000 }).toBe(true);
  for (const id of [...config.rooms.map((room) => room.id), "overview", "outside"]) {
    const frames = (await evidence(scene)).frames;
    await ui.locator(`[data-world-room="${id}"]`).click();
    await expect.poll(async () => (await evidence(scene)).currentRoom, { timeout: 60000 }).toBe(id);
    await expect.poll(async () => (await evidence(scene)).frames, { timeout: 60000 }).toBeGreaterThan(frames);
    if (await labOpen()) await lab.locator("summary").first().click();
    // Inspect a held frame after the controls have composited away too. A
    // newly submitted WebGL frame alone does not prove idle presentation.
    await page.waitForTimeout(250);
    const state = await evidence(scene),
      bytes = await canvas.screenshot();
    if (config.rooms.some((room) => room.id === id)) {
      // A textured close-up can pass nonblank while a room's actual camera
      // arm has collapsed to zero. Keep every public arrival usable with the
      // delivered collision field enabled, including Living/Private living.
      expect(state.cameraCollision.ready).toBe(true);
      expect(state.cameraArm.distance).toBeGreaterThanOrEqual(state.cameraArm.minimum);
    }
    await retain(testInfo, `architecture-${id}`, { body: bytes, contentType: "image/png" });
    await retain(testInfo, `architecture-${id}-state`, { body: Buffer.from(JSON.stringify(state, null, 2)), contentType: "application/json" });
    nonblank(bytes);
    records.push({ id, state });
    if (!(await labOpen())) await lab.locator("summary").first().click();
  }
  // The open authoring panel covers the canvas centre at ordinary widths.
  // Close it before testing actual canvas gestures.
  if (await labOpen()) await lab.locator("summary").first().click();
  if (process.env.VISUAL_ARCHITECTURE_4K === "1") {
    const controls = await scene.evaluate(async (element) => {
      element.labScene.setTemporalEnabled(false);
      const meshes = [],
        seen = new Set();
      element.labScene.scene.traverse((mesh) => {
        if (!mesh.isMesh || ![mesh.material].flat().some((material) => /sandstone/i.test(material.name))) return;
        const geometry = mesh.geometry,
          color = geometry.attributes.color;
        if (!color || seen.has(geometry)) return;
        seen.add(geometry);
        meshes.push({ mesh, geometry, color, saved: color.array.slice() });
      });
      const digest = async (array) =>
        [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(array.buffer, array.byteOffset, array.byteLength)))]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
      const geometry = [];
      for (const { mesh, geometry: g, color } of meshes) {
        let min = Infinity,
          max = -Infinity;
        for (let i = 0; i < color.count; i++) {
          min = Math.min(min, color.getX(i));
          max = Math.max(max, color.getX(i));
        }
        geometry.push({
          name: mesh.name,
          vertices: g.attributes.position.count,
          triangles: (g.index?.count || g.attributes.position.count) / 3,
          position: await digest(g.attributes.position.array),
          index: g.index ? await digest(g.index.array) : null,
          normal: await digest(g.attributes.normal.array),
          colorRange: [min, max],
          matrix: mesh.matrixWorld.toArray(),
        });
      }
      element._architectureAOControls = { meshes, geometry, digest };
      element.labScene.requestFrame();
      return geometry;
    });
    expect(controls.length).toBeGreaterThan(1);
    expect(controls.some((row) => row.colorRange[1] - row.colorRange[0] > 0.1)).toBe(true);
    await scene.evaluate(async (element) => {
      element.labScene.requestFrame();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const ao = await canvas.screenshot();
    await scene.evaluate((element) => {
      for (const { color } of element._architectureAOControls.meshes) {
        for (let i = 0; i < color.count; i++) color.setXYZ(i, 1, 1, 1);
        color.needsUpdate = true;
      }
      element.labScene.requestFrame();
    });
    await scene.evaluate(async (element) => {
      element.labScene.requestFrame();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const white = await canvas.screenshot();
    const restoredGeometry = await scene.evaluate(async (element) => {
      const { meshes, digest } = element._architectureAOControls;
      const records = [];
      for (const { geometry: g, color, saved } of meshes) {
        color.array.set(saved);
        color.needsUpdate = true;
        records.push({
          position: await digest(g.attributes.position.array),
          index: g.index ? await digest(g.index.array) : null,
          normal: await digest(g.attributes.normal.array),
        });
      }
      element.labScene.requestFrame();
      return records;
    });
    expect(restoredGeometry).toEqual(controls.map(({ position, index, normal }) => ({ position, index, normal })));
    const difference = pixelDifference(ao, white);
    expect([difference.width, difference.height]).toEqual([3840, 2160]);
    const actualBuffer = await canvas.evaluate((element) => [element.width, element.height]);
    expect(actualBuffer).toEqual([3840, 2160]);
    expect(difference.changedPixels).toBeGreaterThan(10000);
    await retain(testInfo, "architecture-4k-actual-ao", { body: ao, contentType: "image/png" });
    await retain(testInfo, "architecture-4k-white-color-control", { body: white, contentType: "image/png" });
    await retain(testInfo, "architecture-4k-same-geometry-control", {
      body: Buffer.from(JSON.stringify({ controls, restoredGeometry, difference, actualBuffer, state: await evidence(scene) }, null, 2)),
      contentType: "application/json",
    });
  }
  const before = await evidence(scene),
    bounds = await canvas.boundingBox();
  const dragBefore = await canvas.screenshot();
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.63, bounds.y + bounds.height * 0.51, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => Math.hypot(...(await evidence(scene)).camera.map((value, i) => value - before.camera[i])), { timeout: 60000 })
    .toBeGreaterThan(0.2);
  const dragAfter = await canvas.screenshot(),
    dragPixels = pixelDifference(dragBefore, dragAfter);
  expect(dragPixels.changedPixels).toBeGreaterThan(dragPixels.width * dragPixels.height * 0.01);
  await retain(testInfo, "architecture-drag-before", { body: dragBefore, contentType: "image/png" });
  await retain(testInfo, "architecture-drag-after", { body: dragAfter, contentType: "image/png" });
  const beforeZoom = await evidence(scene);
  if (testInfo.project.use.isMobile) {
    // Mobile WebKit has no mouse-wheel API. Exercise its public zoom control;
    // the dedicated touch-pinch case covers the two-pointer gesture separately.
    if (!(await labOpen())) await lab.locator("summary").first().click();
    await ui.locator('[data-world-zoom="in"]').click();
    await lab.locator("summary").first().click();
  } else await page.mouse.wheel(0, -360);
  // The retained Linux trace spends 21.7 s in a single observation after this
  // real input. Allow a complete software frame, as for the drag above; the
  // camera-distance and changed-pixel assertions remain the same.
  await expect
    .poll(async () => Math.hypot(...(await evidence(scene)).camera.map((value, i) => value - beforeZoom.camera[i])), { timeout: 60000 })
    .toBeGreaterThan(0.1);
  const zoomAfter = await canvas.screenshot(),
    zoomPixels = pixelDifference(dragAfter, zoomAfter);
  expect(zoomPixels.changedPixels).toBeGreaterThan(zoomPixels.width * zoomPixels.height * 0.01);
  await retain(testInfo, "architecture-zoom-after", { body: zoomAfter, contentType: "image/png" });
  if (!(await labOpen())) await lab.locator("summary").first().click();
  await ui.locator("[data-world-time]").evaluate((input) => {
    input.value = "1230";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await ui.locator('[data-world-room="sleep"]').click();
  await expect.poll(async () => (await evidence(scene)).currentRoom, { timeout: 60000 }).toBe("sleep");
  if (await labOpen()) await lab.locator("summary").first().click();
  const evening = await canvas.screenshot();
  nonblank(evening);
  await retain(testInfo, "architecture-evening-bedroom", { body: evening, contentType: "image/png" });
  await retain(testInfo, "architecture-native-and-public-state", {
    body: Buffer.from(JSON.stringify({ native, records, dragPixels, zoomPixels, final: await evidence(scene) }, null, 2)),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});
