const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { preparePage, collectRuntimeErrors, screenshotDiffRatio, screenshotMetrics } = require("./helpers");
const { publicRouteUrl } = require("./public-routes");
const { pauseSceneClock, useSoftwareSceneCadence, useNativeSceneFrames } = require("./scene-clock");
const { PNG } = require("pngjs");

test("coastal steam: native GPU extinction, opaque clipping and nearest glass segmentation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one native GPU fixture tests the integrator independently of page layout");
  const errors = collectRuntimeErrors(page),
    url = publicRouteUrl("/volume-fixture/");
  await page.route(url, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Steam transport fixture</title>" }));
  await page.goto(url);
  const result = await page.evaluate(
    async (base) => {
      const THREE = await import(base + "assets/js/three.module.min.js"),
        { createSteamDensity } = await import(base + "assets/js/home-scene/steam-density.mjs"),
        { createSteamVolume } = await import(base + "assets/js/home-scene/steam-volume.mjs"),
        { createVolumeDepth } = await import(base + "assets/js/home-scene/volume-depth.mjs"),
        renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }),
        scene = new THREE.Scene(),
        camera = new THREE.PerspectiveCamera(40, 1, 0.05, 10),
        target = new THREE.WebGLRenderTarget(96, 96),
        depth = createVolumeDepth(renderer, scene),
        field = createSteamDensity({ bounds: { min: [-1, -1, -0.5], max: [1, 1, 1] }, grid: [8, 8, 8], surfaceY: -1, center: [0, 0], radius: 1 }),
        volume = createSteamVolume(field, { extinction: 1 }),
        incident = [0.7, 0.45, 0.2],
        backing = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.3, 0.4) })),
        glass = new THREE.Mesh(
          new THREE.PlaneGeometry(4, 4),
          new THREE.MeshPhysicalMaterial({ transmission: 1, ior: 1.5, thickness: 0.01, roughness: 0, metalness: 0 })
        );
      field.state.density.fill(0.4);
      field.writeAtlas();
      volume.uniforms.steamAtlas.value.needsUpdate = true;
      volume.setLighting({ ambient: incident, directional: [0, 0, 0] });
      renderer.setSize(96, 96);
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      document.body.append(renderer.domElement);
      camera.position.set(0, 0, 3);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      backing.position.z = -0.6;
      scene.add(backing, glass, volume.object);
      depth.resize(96, 96);
      function sample({ steam = true, pane = false, opaqueZ = -0.6 } = {}) {
        glass.visible = pane;
        volume.object.visible = steam;
        backing.position.z = opaqueZ;
        scene.updateMatrixWorld(true);
        depth.render(camera, volume);
        renderer.setRenderTarget(target);
        renderer.clear();
        renderer.render(scene, camera);
        const pixel = new Uint8Array(4);
        renderer.readRenderTargetPixels(target, 48, 48, 1, 1, pixel);
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
        return [...pixel].slice(0, 3).map((c) => c / 255);
      }
      const clear = sample({ steam: false }),
        fog = sample(),
        throughGlass = sample({ pane: true }),
        opaqueInFront = sample({ opaqueZ: 1.2 }),
        // Each end's 8% support taper integrates to half its length. This
        // analytic optical depth accounts for the rendered bounded medium.
        opticalDepth = 0.4 * 1.5 * 0.92,
        expected = clear.map((c, i) => c * Math.exp(-opticalDepth) + incident[i] * 0.94 * (1 - Math.exp(-opticalDepth))),
        evidence = volume.evidence();
      // Keep the final native fixture visible for the captured acceptance image.
      sample({ pane: true });
      return { clear, fog, throughGlass, opaqueInFront, expected, evidence, depth: depth.evidence() };
    },
    publicRouteUrl("/").replace(/\/?$/, "/")
  );
  fs.writeFileSync(testInfo.outputPath("steam-native-gpu-fixture.json"), JSON.stringify(result, null, 2));
  for (let i = 0; i < 3; i++) {
    expect(Math.abs(result.fog[i] - result.expected[i])).toBeLessThan(0.012);
    expect(Math.abs(result.opaqueInFront[i] - result.clear[i])).toBeLessThan(0.008);
    // Dielectric Fresnel/refraction change the backing slightly; a whole
    // interval of missing or duplicated fog exceeds this measured tolerance.
    expect(Math.abs(result.throughGlass[i] - result.fog[i])).toBeLessThan(0.035);
  }
  expect(result.evidence.depthBound).toBe(true);
  expect(result.depth.passes).toBe(2);
  expect(errors).toEqual([]);
  await page.locator("canvas").screenshot({ path: testInfo.outputPath("steam-native-gpu-fixture.png") });
  fs.writeFileSync(testInfo.outputPath("steam-native-gpu-fixture.json"), JSON.stringify(result, null, 2));
});

test("record: a discovered card keeps its source link keyboard activation", async ({ page, context }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await context.route("https://open.spotify.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Record source</title>" })
  );
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const play = page.locator("[data-home-record-play]"),
    card = page.locator("[data-home-record-card]").first();
  await play.focus();
  await play.press("d");
  await expect(card).toBeVisible();
  await card.focus();
  await card.press("Enter");
  await expect(card).toHaveAttribute("aria-expanded", "true");
  const source = card.getByRole("link", { name: "Listen on Spotify" });
  // Mobile WebKit's default Tab policy skips anchors; focus the same native
  // link explicitly there before exercising its actual Enter activation.
  if (testInfo.project.use.browserName === "webkit" && testInfo.project.use.isMobile) await source.focus();
  else await card.press("Tab");
  await expect(source).toBeFocused();
  const href = await source.getAttribute("href"),
    stage = page.locator("[data-home-artifact-stage]"),
    title = page.locator("[data-home-record-title]"),
    selected = await title.textContent(),
    discovered = await stage.getAttribute("data-dropped-records");
  await page.locator(".home-hero-media").screenshot({ path: testInfo.outputPath("record-source-keyboard.png") });
  const popupPromise = page.waitForEvent("popup", { timeout: 5000 });
  await source.press("Enter");
  const popup = await popupPromise;
  await expect(popup).toHaveURL(href);
  await popup.close();
  await expect(card).toHaveAttribute("aria-expanded", "true");
  await expect(title).toHaveText(selected);
  await expect(stage).toHaveAttribute("data-dropped-records", discovered);
  expect(errors).toEqual([]);
});

test("coastal transport: cold onsen arrival waits for a delayed avatar before filling its footprint", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-10-02T18:35:00-07:00"));
  let releaseAvatar;
  const avatarHeld = new Promise((resolve) => (releaseAvatar = resolve));
  await page.route("**/assets/models/home/sirui-*.glb", async (route) => {
    await avatarHeld;
    await route.continue();
  });
  try {
    await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const scene = page.locator("[data-home-desk-scene]");
    await expect.poll(() => scene.evaluate((e) => Boolean(e.getSceneEvidence?.()?.simulation.onsen)), { timeout: 30000 }).toBe(true);
    await expect(scene).toHaveAttribute("data-scene-state", "loading");
    const waiting = await evidence(scene);
    expect(waiting.activity).toBe("soak");
    expect(waiting.actorCount).toBe(0);
    await scene.locator("canvas").screenshot({ path: testInfo.outputPath("onsen-awaiting-avatar.png") });
    expect(errors).toEqual([]);
    releaseAvatar();
    await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
    await expect.poll(async () => (await evidence(scene)).simulation.onsen.obstacle).not.toBeNull();
    const arrived = await evidence(scene);
    expect(arrived.actorCount).toBe(1);
    expect(arrived.simulation.onsen.obstacle.radius).toBe(0.17);
    expect(Math.abs(arrived.simulation.onsen.relativeMassError)).toBeLessThan(1e-10);
    expect(arrived.animationSeconds).toBe(0);
    await scene.locator("canvas").screenshot({ path: testInfo.outputPath("onsen-avatar-arrived.png") });
    expect(errors).toEqual([]);
  } finally {
    releaseAvatar();
  }
});

test("record: on-disc controls, continuous rotation, and offscreen suspension", async ({ page }, testInfo) => {
  await preparePage(page, "afternoon");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date("2026-09-29T12:00:00-07:00") });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const record = page.locator("[data-home-record-scene]");
  const transport = page.locator(".home-record-transport");
  const play = page.locator("[data-home-record-play]");
  await page.evaluate(() => document.fonts.ready);
  // The header measures its height after window.load. Start the transport
  // baseline after that page-wide layout change, before any player input.
  await expect.poll(() => page.locator("body").evaluate((e) => e.style.paddingTop)).not.toBe("");
  const caption = page.locator(".home-record-console");
  await expect(caption).toBeHidden();
  // A preview caption must stay reachable while keyboard focus moves from
  // the disc to its source, and disappear when the original portrait returns.
  await play.focus();
  await expect(caption).toBeVisible();
  await page.locator("[data-home-record-next]").press("Tab");
  await expect(page.locator("[data-home-record-source]")).toBeFocused();
  await expect(caption).toBeVisible();
  await page.getByRole("button", { name: "2D", exact: true }).focus();
  await expect(caption).toBeHidden();
  const disc = page.locator("#home-profile-image-container");
  const discBox = await disc.boundingBox();
  const playBox = await play.boundingBox();
  expect(Math.abs(playBox.width - discBox.width)).toBeLessThan(3);
  expect(Math.abs(playBox.height - discBox.height)).toBeLessThan(3);
  await expect(page.locator(".home-record-console button")).toHaveCount(0);
  const previousBox = await page.locator("[data-home-record-prev]").boundingBox();
  const nextBox = await page.locator("[data-home-record-next]").boundingBox();
  expect(nextBox.x - previousBox.x - previousBox.width).toBeGreaterThan(100);
  // Accessible clicks may scroll the controls into view. Compare their actual
  // document position rather than their position in a moving viewport.
  const transportPosition = () =>
    transport.evaluate((e) => {
      const box = e.getBoundingClientRect();
      return { x: box.left + window.scrollX, y: box.top + window.scrollY };
    });
  const controlsBefore = await transportPosition();
  await play.click();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().loaded)).toBe(true);
  await page.waitForTimeout(500);
  await play.click();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().running)).toBe(false);
  const paused = await record.evaluate((e) => e.getRecordEvidence().angle);
  await page.waitForTimeout(800);
  expect(await record.evaluate((e) => e.getRecordEvidence().angle)).toBe(paused);
  // Browser IPC can add hundreds of milliseconds on software-WebGL runners.
  // Observe the exact resume boundary, then advance 100 ms of animation time.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
  await play.click();
  expect(await record.evaluate((e) => e.getRecordEvidence().angle)).toBe(paused);
  await page.clock.runFor(100);
  const resumed = await record.evaluate((e) => e.getRecordEvidence().angle);
  const change = Math.atan2(Math.sin(resumed - paused), Math.cos(resumed - paused));
  expect(change).toBeGreaterThan(0);
  expect(change).toBeLessThan(0.12);
  const titleBefore = await page.locator("[data-home-record-title]").textContent();
  await play.press("ArrowRight");
  await expect(page.locator("[data-home-record-title]")).not.toHaveText(titleBefore);
  await expect(play).toHaveAttribute("aria-pressed", "true");
  await play.press("ArrowLeft");
  await expect(page.locator("[data-home-record-title]")).toHaveText(titleBefore);
  await page.clock.resume();
  await page.locator("[data-home-record-next]").click();
  await expect(page.locator("[data-home-record-title]")).not.toHaveText("Yellow Submarine");
  const controlsAfter = await transportPosition();
  expect(Math.abs(controlsBefore.x - controlsAfter.x)).toBeLessThan(1);
  expect(Math.abs(controlsBefore.y - controlsAfter.y)).toBeLessThan(1);
  for (const control of await transport.locator("button").all()) {
    const box = await control.boundingBox();
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    const onDisc = await disc.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(onDisc.x);
    expect(box.x + box.width).toBeLessThanOrEqual(onDisc.x + onDisc.width);
    expect(box.y).toBeGreaterThanOrEqual(onDisc.y);
    expect(box.y + box.height).toBeLessThanOrEqual(onDisc.y + onDisc.height);
  }
  await page.locator(".home-record-player").screenshot({ path: testInfo.outputPath("record-player.png") });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().running)).toBe(false);
  await page.locator(".home-record-player").scrollIntoViewIfNeeded();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().running)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().running)).toBe(false);
});

test("record physics: the needle lifts before artwork changes and rapid cues preserve phase", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date("2026-09-30T13:00:00-07:00") });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const record = page.locator("[data-home-record-scene]"),
    play = page.locator("[data-home-record-play]");
  await play.click();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanics?.phase)).toBe("tracking");
  await expect.poll(() => record.evaluate((e) => Boolean(e.getRecordEvidence().artwork))).toBe(true);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
  const before = await record.evaluate((e) => e.getRecordEvidence());
  await page.locator("[data-home-record-next]").click();
  const cue = await record.evaluate((e) => e.getRecordEvidence());
  expect(cue.mechanics.angle).toBe(before.mechanics.angle);
  expect(cue.mechanics.velocity).toBe(before.mechanics.velocity);
  expect(cue.artwork).toBe(before.artwork);
  expect(cue.cuePending).toBe(true);
  await page.clock.runFor(100);
  expect((await record.evaluate((e) => e.getRecordEvidence())).artwork).toBe(before.artwork);
  await page.clock.runFor(400);
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().artwork)).not.toBe(before.artwork);
  expect((await record.evaluate((e) => e.getRecordEvidence())).recordTransfer.lift).toBeGreaterThan(0.44);
  await play.click();
  const stopped = await record.evaluate((e) => e.getRecordEvidence().mechanics);
  await play.click();
  const resumed = await record.evaluate((e) => e.getRecordEvidence().mechanics);
  expect(resumed.angle).toBe(stopped.angle);
  expect(resumed.yaw).toBe(stopped.yaw);
  expect(resumed.lift).toBe(stopped.lift);
  await page.clock.runFor(1500);
  await page.locator(".home-record-player").screenshot({ path: testInfo.outputPath("physical-record-player.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await record.evaluate((e) => e.getRecordEvidence())).running).toBe(false);
  expect(errors).toEqual([]);
});

for (const graphics of ["delayed", "unavailable"]) {
  test(`record physics: ${graphics} graphics keep the same interruptible 2D mechanics`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    await preparePage(page, "light");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.clock.install({ time: new Date("2026-09-30T13:00:00-07:00") });
    let releaseGraphics;
    const graphicsGate = new Promise((resolve) => {
      releaseGraphics = resolve;
    });
    await page.route("**/three.module.min.js", async (route) => {
      if (graphics === "delayed") {
        await graphicsGate;
        await route.continue();
      } else {
        // A handled import exception exercises the genuine fallback without
        // introducing an expected network/console error into this assertion.
        await route.fulfill({ contentType: "application/javascript", body: "throw new Error('Deliberate graphics-unavailable fixture');" });
      }
    });
    await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-home-artifact-stage]")).toHaveAttribute("data-desk-mode", "2d");
    await expect(page.locator("#home-profile-image-container")).toBeVisible();
    const record = page.locator("[data-home-record-scene]"),
      play = page.locator("[data-home-record-play]");
    await play.focus();
    await play.press("Enter");
    await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanicsLoaded)).toBe(true);
    await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanics.phase)).toBe("tracking");
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
    const before = await record.evaluate((e) => e.getRecordEvidence());
    const beforeBackground = await record.locator(".home-record-art").evaluate((e) => getComputedStyle(e).backgroundImage);
    expect(before.fallback).toBe(true);
    expect(before.mechanics.rpm).toBeCloseTo(33 + 1 / 3, 1);
    await page.locator("[data-home-record-next]").click();
    const first = await record.evaluate((e) => e.getRecordEvidence());
    expect(first.mechanics.angle).toBe(before.mechanics.angle);
    expect(first.mechanics.velocity).toBe(before.mechanics.velocity);
    await page.clock.runFor(100);
    expect((await record.evaluate((e) => e.getRecordEvidence())).artwork).toBe(before.artwork);
    expect(await record.locator(".home-record-art").evaluate((e) => getComputedStyle(e).backgroundImage)).toBe(beforeBackground);
    await page.locator("[data-home-record-next]").click();
    await page.clock.runFor(1300);
    const cued = await record.evaluate((e) => e.getRecordEvidence());
    expect(cued.cuePending).toBe(false);
    expect(cued.recordTransfer.lift).toBeGreaterThan(0.44);
    expect(cued.artwork).not.toBe(before.artwork);
    const selectedImage = (await page.locator("#home-profile-image-container").getAttribute("data-record-images")).split("|")[2];
    expect(new URL(cued.artwork, page.url()).pathname).toBe(new URL(selectedImage, page.url()).pathname);
    expect(cued.mechanics.phase).toBe("tracking");
    const transform = await record.locator(".home-record-art").evaluate((e) => getComputedStyle(e).transform);
    expect(transform).not.toBe("none");
    await play.focus();
    await play.press(" ");
    const stopping = await record.evaluate((e) => e.getRecordEvidence().mechanics);
    await play.press(" ");
    const restarting = await record.evaluate((e) => e.getRecordEvidence().mechanics);
    for (const key of ["angle", "velocity", "yaw", "lift"]) expect(restarting[key]).toBe(stopping[key]);
    await page.clock.runFor(1400);
    await capture(testInfo, `physical-record-${graphics}`, await page.locator(".home-record-player").screenshot());
    if (graphics === "delayed") {
      const fallbackPose = await record.evaluate((e) => e.getRecordEvidence().mechanics);
      releaseGraphics();
      await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().loaded)).toBe(true);
      expect((await record.evaluate((e) => e.getRecordEvidence())).mechanics.angle).toBe(fallbackPose.angle);
      expect((await record.evaluate((e) => e.getRecordEvidence())).mechanics.velocity).toBe(fallbackPose.velocity);
    }
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hidden = await record.evaluate((e) => e.getRecordEvidence());
    expect(hidden.running).toBe(false);
    await page.clock.runFor(500);
    expect((await record.evaluate((e) => e.getRecordEvidence())).mechanics.angle).toBe(hidden.mechanics.angle);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.runFor(100);
    expect((await record.evaluate((e) => e.getRecordEvidence())).mechanics.angle).toBeGreaterThan(hidden.mechanics.angle);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect((await record.evaluate((e) => e.getRecordEvidence())).running).toBe(false);
    await page.locator("[data-home-record-next]").click();
    expect((await record.evaluate((e) => e.getRecordEvidence())).cuePending).toBe(false);
    expect(errors).toEqual([]);
  });
}

for (const graphics of ["native", "unavailable"]) {
  test(`record physics: ${graphics} skip then pause retains artwork until the needle clears`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    await preparePage(page, "light");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.clock.install({ time: new Date("2026-10-01T13:00:00-07:00") });
    if (graphics === "unavailable")
      await page.route("**/three.module.min.js", (route) =>
        route.fulfill({ contentType: "application/javascript", body: "throw new Error('Deliberate graphics-unavailable fixture');" })
      );
    await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
    const record = page.locator("[data-home-record-scene]"),
      play = page.locator("[data-home-record-play]"),
      art = record.locator(".home-record-art");
    await play.click();
    await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanics?.phase)).toBe("tracking");
    if (graphics === "native") await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().loaded)).toBe(true);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
    const before = await record.evaluate((e) => e.getRecordEvidence());
    const beforeBackground = await art.evaluate((e) => getComputedStyle(e).backgroundImage);
    await page.locator("[data-home-record-next]").click();
    expect(await art.evaluate((e) => getComputedStyle(e).backgroundImage)).toBe(beforeBackground);
    await page.clock.runFor(50);
    const lifting = await record.evaluate((e) => e.getRecordEvidence().mechanics);
    expect(lifting.lift).toBeLessThan(0.44);
    await play.click();
    const paused = await record.evaluate((e) => e.getRecordEvidence());
    expect(paused.cuePending).toBe(true);
    expect(paused.playing).toBe(false);
    for (const key of ["angle", "velocity", "yaw", "lift"]) expect(paused.mechanics[key]).toBe(lifting[key]);
    expect(paused.artwork).toBe(before.artwork);
    expect(await art.evaluate((e) => getComputedStyle(e).backgroundImage)).toBe(beforeBackground);
    // A second choice while paused replaces the queue, rather than bypassing it.
    await page.locator("[data-home-record-next]").click();
    expect(await art.evaluate((e) => getComputedStyle(e).backgroundImage)).toBe(beforeBackground);
    await page.clock.runFor(1000);
    const selected = (await page.locator("#home-profile-image-container").getAttribute("data-record-images")).split("|")[2];
    await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().artwork)).toContain(new URL(selected, page.url()).pathname);
    const final = await record.evaluate((e) => e.getRecordEvidence());
    expect(final.cuePending).toBe(false);
    expect(final.recordTransfer.lift).toBeGreaterThan(0.44);
    expect(final.playing).toBe(false);
    expect(await art.evaluate((e) => getComputedStyle(e).backgroundImage)).not.toBe(beforeBackground);
    await capture(testInfo, `pause-cue-${graphics}`, await page.locator(".home-record-player").screenshot());
    expect(errors).toEqual([]);
  });
}

test("record physics: touch transport keeps cues reachable and preserves spin across 2D/3D", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "Real Chromium touch context exercises the transport.");
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const record = page.locator("[data-home-record-scene]");
  await page.locator("[data-home-record-play]").tap();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanics?.phase)).toBe("tracking");
  await page.locator("[data-home-record-next]").tap();
  await page.locator("[data-home-record-prev]").tap();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanics?.phase)).toBe("tracking");
  await page.locator('[data-home-desk-mode="3d"]').tap();
  const scene = page.locator("[data-home-desk-scene]");
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
  await expect(scene).toHaveAttribute("data-record-spinning", "true");
  await page.locator('[data-home-desk-mode="2d"]').tap();
  expect((await record.evaluate((e) => e.getRecordEvidence())).playing).toBe(true);
  await page.locator("[data-home-record-play]").tap();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().running)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("record physics: a late old texture cannot replace the newest cue and disposal stays quiet", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date("2026-09-30T13:00:00-07:00") });
  let releaseOldTexture;
  const imageGate = new Promise((resolve) => {
    releaseOldTexture = resolve;
  });
  // Block the second meme image, including its preload, before navigation.
  const response = await page.request.get(publicRouteUrl("/"));
  const imagePaths = (await response.text()).match(/data-record-images="([^"]+)"/)[1].split("|");
  await page.route(`**${imagePaths[1]}`, async (route) => {
    await imageGate;
    await route.continue();
  });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const record = page.locator("[data-home-record-scene]");
  await page.locator("[data-home-record-play]").click();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().loaded)).toBe(true);
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanics.phase)).toBe("tracking");
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
  const first = await record.evaluate((e) => e.getRecordEvidence());
  await page.locator("[data-home-record-next]").click();
  await page.clock.runFor(1000);
  const waiting = await record.evaluate((e) => e.getRecordEvidence());
  expect(waiting.artwork).toBe(first.artwork);
  expect(waiting.mechanics.lift).toBeGreaterThan(0.456);
  expect(waiting.mechanics.phase).toBe("swinging");
  await page.locator("[data-home-record-next]").click();
  await page.clock.runFor(700);
  await expect.poll(() => record.evaluate((e) => new URL(e.getRecordEvidence().artwork, location.href).pathname)).toBe(imagePaths[2]);
  releaseOldTexture();
  await expect
    .poll(() =>
      page.evaluate(
        (src) =>
          Array.from(document.images)
            .filter((i) => i.src.endsWith(src))
            .every((i) => i.complete),
        imagePaths[1]
      )
    )
    .toBe(true);
  await page.clock.runFor(1400);
  expect(new URL((await record.evaluate((e) => e.getRecordEvidence())).artwork).pathname).toBe(imagePaths[2]);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  await page.clock.runFor(300);
  expect((await record.evaluate((e) => e.getRecordEvidence())).running).toBe(false);
  expect(errors).toEqual([]);
});

test("record physics: reduced motion composes the SVG player without requesting Three", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  let graphicsRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/three.module.min.js")) graphicsRequests++;
  });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const record = page.locator("[data-home-record-scene]");
  await page.locator("[data-home-record-play]").click();
  await expect.poll(() => record.evaluate((e) => e.getRecordEvidence().mechanicsLoaded)).toBe(true);
  const before = await record.evaluate((e) => e.getRecordEvidence());
  expect(before.mechanics.phase).toBe("tracking");
  expect(before.running).toBe(false);
  await page.locator("[data-home-record-next]").click();
  const after = await record.evaluate((e) => e.getRecordEvidence());
  expect(after.artwork).not.toBe(before.artwork);
  expect(after.mechanics.angle).toBe(before.mechanics.angle);
  expect(after.cuePending).toBe(false);
  expect(graphicsRequests).toBe(0);
  await expect(record.locator("canvas")).toHaveCount(0);
  await capture(testInfo, "physical-record-reduced-svg", await page.locator(".home-record-player").screenshot());
  expect(errors).toEqual([]);
});

test("record: touch skip retains a visible play/pause cue with reduced motion", async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, "touch-only playback state");
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  const play = page.locator("[data-home-record-play]");
  const next = page.locator("[data-home-record-next]");
  const cue = page.locator(".home-record-play-cue");
  const scene = page.locator("[data-home-record-scene]");
  await play.tap();
  await expect.poll(() => scene.evaluate((e) => e.getRecordEvidence().mechanicsLoaded)).toBe(true);
  await next.tap();
  await expect(play).toHaveAttribute("aria-pressed", "true");
  await expect(cue).toHaveCSS("opacity", "1");
  await expect(play.locator("[data-home-record-pause-icon]")).toBeVisible();
  await play.tap();
  await next.tap();
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await expect(cue).toHaveCSS("opacity", "1");
  await expect(play.locator("[data-home-record-play-icon]")).toBeVisible();
  const source = await page.locator("[data-home-record-source]").boundingBox();
  expect(source.height).toBeGreaterThanOrEqual(44);
  expect((await scene.evaluate((e) => e.getRecordEvidence())).running).toBe(false);
  await capture(testInfo, "touch-record-state", await page.locator(".home-record-player").screenshot());
  expect(errors).toEqual([]);
});

async function capture(testInfo, name, buffer) {
  const file = testInfo.outputPath(name + ".png");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}
function seaRegion(buffer) {
  const source = PNG.sync.read(buffer),
    x = Math.floor(source.width * 0.27),
    y = Math.floor(source.height * 0.83),
    width = Math.floor(source.width * 0.34),
    height = Math.floor(source.height * 0.07),
    crop = new PNG({ width, height });
  for (let row = 0; row < height; row++)
    source.data.copy(crop.data, row * width * 4, ((y + row) * source.width + x) * 4, ((y + row) * source.width + x + width) * 4);
  return PNG.sync.write(crop);
}
test("coastal loading: the occupied room and avatar precede the first ready frame", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-10-02T13:20:00-07:00"));
  let releaseAvatar;
  const avatarGate = new Promise((resolve) => {
    releaseAvatar = resolve;
  });
  await page.route("**/sirui-*.glb", async (route) => {
    await avatarGate;
    await route.continue();
  });
  try {
    await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const scene = page.locator("[data-home-desk-scene]");
    await expect(scene).toHaveAttribute("data-loading-stage", "room", { timeout: 30000 });
    await expect(scene).toHaveAttribute("data-scene-state", "loading");
    await expect(scene).toHaveAttribute("aria-busy", "true");
    await expect(page.locator("[data-world-status]")).toHaveText("Bringing the room into view.");
    await expect(page.locator("[data-world-view]")).toBeDisabled();
    await expect(page.locator('[data-home-desk-mode="2d"]')).toBeEnabled();
    await page.waitForTimeout(100);
    const waiting = await evidence(scene);
    expect(waiting.frames).toBe(0);
    expect(waiting.actorCount).toBe(0);
    expect(waiting.loading.firstFrameMilliseconds).toBeNull();
    await capture(testInfo, "coastal-loading-status", await page.locator(".home-hero-media").screenshot());
    releaseAvatar();
    await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
    const ready = await evidence(scene);
    expect(ready.actorCount).toBe(1);
    expect(ready.frames).toBeGreaterThan(0);
    expect(ready.currentRoom).toBe("study");
    for (const name of ["room-study.glb", `sirui-${ready.avatarId}.glb`]) {
      const model = ready.loading.models.find((model) => model.asset === name);
      expect(model.bytes).toBeGreaterThan(0);
      expect(model.parsedMilliseconds).toBeLessThan(ready.loading.firstFrameMilliseconds);
    }
    expect(ready.loading.stages.map((entry) => entry.stage)).toEqual(["home", "coast", "room", "first-frame", "ready"]);
    await expect(scene).not.toHaveAttribute("aria-busy", "true");
    await expect(page.locator("[data-world-view]")).toBeEnabled();
    const frame = await scene.locator("canvas").screenshot();
    expect(screenshotMetrics(frame).uniqueColors).toBeGreaterThan(60);
    expect(screenshotMetrics(frame).luminanceVariance).toBeGreaterThan(80);
    await capture(testInfo, "coastal-first-complete-frame", frame);
    fs.writeFileSync(testInfo.outputPath("coastal-loading-evidence.json"), JSON.stringify({ waiting, ready }, null, 2));
    expect(errors).toEqual([]);
  } finally {
    releaseAvatar();
  }
});
async function openHome(page, { motion = "reduce", theme = "light", time = "2026-09-11T17:45:00-07:00", nativeFrames = false } = {}) {
  await preparePage(page, theme);
  await page.emulateMedia({ reducedMotion: motion });
  await page.clock.install({ time: new Date(time) });
  await page.goto(publicRouteUrl("/") + "?scene-lab=1", { waitUntil: "domcontentloaded" });
  const stage = page.locator("[data-home-artifact-stage]");
  await expect(stage).toHaveAttribute("data-desk-mode", "2d");
  if (nativeFrames) await useNativeSceneFrames(page);
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]");
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
  const canvas = scene.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  return { stage, scene, canvas, ui: page.locator("[data-home-world-controls]") };
}
const evidence = (scene) => scene.evaluate((e) => e.getSceneEvidence());
async function settleRoomModels(scene) {
  // Readiness covers the occupied room; five additional GLBs then stream and
  // compile on the software-rendered CI worker. Verify every actual room before
  // measuring pause/orbit behavior, with a load budget rather than the 15s UI one.
  await expect.poll(async () => (await evidence(scene)).roomCount, { timeout: 60000 }).toBe(6);
}
async function settleAvatarLoad(ui) {
  // The public loading state covers model parsing behind software GPU work.
  // Keep the subsequent strict avatar, frame and resource assertions intact.
  await expect(ui).not.toHaveAttribute("aria-busy", "true", { timeout: 60000 });
}
async function openClockedHome(page, options = {}) {
  const view = await openHome(page, { ...options, motion: "reduce" });
  // Keep secondary model loading from consuming the independent page-P
  // excursion schedule. Functional samples then advance only explicit time.
  await pauseSceneClock(page);
  await page.clock.runFor(2000);
  await settleRoomModels(view.scene);
  await useSoftwareSceneCadence(page);
  return view;
}
async function beginClockedMotion(page, canvas) {
  await canvas.scrollIntoViewIfNeeded();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.runFor(1400);
}
async function sceneInputFrame(page, { scene, canvas }, input) {
  const frames = (await evidence(scene)).frames;
  await input();
  await canvas.scrollIntoViewIfNeeded();
  // A 200ms boundary includes a real input-triggered draw and the next 10Hz
  // continuous sample on software WebGL. No solver state is replaced.
  await page.clock.runFor(200);
  await expect.poll(async () => (await evidence(scene)).frames).toBeGreaterThan(frames);
}
async function explore(ui) {
  const details = ui.locator("details").first();
  if (!(await details.getAttribute("open"))) {
    if (!(await details.evaluate((e) => e.open))) await details.locator("summary").first().click();
  }
}
async function settle(page) {
  await page.waitForTimeout(200);
}

// Project a clear front-side patch of the native onsen into its actual camera.
// It excludes the bather and foliage. Volume compositing can affect this patch;
// conserved water state and measured palm coupling supply the independent proof.
function onsenRegion(buffer, info) {
  const source = PNG.sync.read(buffer),
    sub = (a, b) => a.map((v, i) => v - b[i]),
    dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0),
    cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    unit = (v) => v.map((a) => a / Math.hypot(...v)),
    forward = unit(sub(info.target, info.camera)),
    right = unit(cross(forward, [0, 1, 0])),
    up = cross(right, forward),
    pool = info.simulation.onsen,
    offset = sub([pool.center[0] + 0.3, pool.surfaceY, pool.center[1] + 0.35], info.camera),
    scale = Math.tan((info.cameraFov * Math.PI) / 360) * dot(offset, forward),
    x = Math.round(source.width * (0.5 + dot(offset, right) / scale / (source.width / source.height) / 2)),
    y = Math.round(source.height * (0.5 - dot(offset, up) / scale / 2)),
    width = Math.max(12, Math.floor(source.width * 0.09)),
    height = Math.max(10, Math.floor(source.height * 0.05)),
    crop = new PNG({ width, height });
  for (let row = 0; row < height; row++) {
    const start = ((y - Math.floor(height / 2) + row) * source.width + x - Math.floor(width / 2)) * 4;
    source.data.copy(crop.data, row * width * 4, start, start + width * 4);
  }
  return PNG.sync.write(crop);
}

test("coastal transport: native skin, rooted wind and conserved onsen waves survive pause and recovery", async ({ page }, testInfo) => {
  // CI renders the full-volume water pixel proof on a software GPU.
  if (process.platform === "linux") test.setTimeout(600000);
  const errors = collectRuntimeErrors(page);
  // Let native field preparation finish without continuous software-rendered
  // frames competing for CI's CPU. Restore motion before all simulation proof.
  const { scene, canvas, ui } = await openHome(page, { motion: "reduce", time: "2026-10-02T13:20:00-07:00" });
  await settleRoomModels(scene);
  await page.waitForFunction(
    () => {
      const sim = document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.()?.simulation;
      return sim?.steam?.ready && sim?.lightField?.ready;
    },
    null,
    { timeout: 60000 }
  );
  // Freeze wall time while the pause command crosses browser IPC. Software
  // WebGL can take longer than a future one-second deadline to receive it.
  // Restore an advancing Date before runFor so routine and simulation clocks
  // still advance together; no animation time is skipped to acquire the pause.
  await pauseSceneClock(page);
  await useSoftwareSceneCadence(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await explore(ui);
  await ui.locator("[data-world-pause]").click();
  await ui.locator("[data-world-avatar]").selectOption("ghibli");
  await expect(scene).toHaveAttribute("data-avatar", "ghibli");
  await ui.locator("[data-world-activity]").selectOption("soak");
  await ui.locator("[data-world-lab]>summary").click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(100);
  const still = await evidence(scene);
  expect(still.simulation.lightField.error).toBeNull();
  expect(still.simulation.lightField.triangles).toBeGreaterThan(100000);
  expect(still.simulation.lightField.acceleratorRetainedBytes).toBe(0);
  expect(still.simulation.lightField.practicalEnergy.every((light) => light.unitDC > 0)).toBe(true);
  expect(still.simulation.steam.scalar.finite).toBe(true);
  expect(still.simulation.steam.scalar.grid).toEqual([18, 18, 18]);
  expect(still.simulation.steam.depthBound).toBe(true);
  expect(still.projection).toBe("perspective");
  expect(still.simulation.skin.incompatibleMaterials).toBe(0);
  expect(still.simulation.skin.compiledMaterials).toBeGreaterThanOrEqual(2);
  expect(still.simulation.skin.extraPasses).toBe(0);
  expect(still.garment.kind).toBe("opaque spa textile");
  expect(still.garment.materials.length).toBeGreaterThan(0);
  for (const garment of still.garment.materials) {
    expect(garment.color).toBe(0x5d8078);
    expect(garment.opacity).toBe(1);
    expect(garment.transparent).toBe(false);
    expect(garment.roughness).toBeGreaterThan(0.9);
    expect(garment.skinDiffusion).toBe(false);
  }
  expect(still.simulation.onsen.obstacle).not.toBeNull();
  expect(still.simulation.onsen.depthSource).toBe("five native basin ray hits");
  expect(still.simulation.onsen.depth).toBeCloseTo(0.127487, 5);
  expect(still.simulation.onsen.surfaceY - still.simulation.onsen.bottomY).toBe(still.simulation.onsen.depth);
  expect(still.simulation.onsen.optics.thicknessMeters).toBe(still.simulation.onsen.depth);
  expect(still.simulation.onsen.stroke.available).toBe(true);
  expect(still.simulation.onsen.stroke.seconds).toBe(0);
  expect(still.simulation.onsen.coupling.velocityChange).toBe(0);
  expect(still.simulation.onsen.optics.opaqueShadow).toBe(false);
  expect(still.simulation.onsen.optics.normalDepthOccluder).toBe(false);
  expect(still.simulation.wind.plants.reduce((sum, p) => sum + p.enabled, 0)).toBe(110);
  expect(still.simulation.wind.plants.reduce((sum, p) => sum + p.disabled, 0)).toBe(22);
  const before = await canvas.screenshot();
  await explore(ui);
  await ui.locator("[data-world-pause]").click();
  await ui.locator("[data-world-lab]>summary").click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(900);
  const resting = await evidence(scene);
  expect(resting.simulation.onsen.stroke.phase).toBe("rest");
  expect(resting.simulation.onsen.coupling.velocityChange).toBe(0);
  expect(resting.simulation.onsen.energy).toBeLessThan(1e-12);
  await page.clock.runFor(2400);
  const moving = await evidence(scene),
    after = await canvas.screenshot();
  expect(moving.simulation.onsen.energy).toBeGreaterThan(1e-7);
  expect(moving.simulation.steam.scalar.simulationTime).toBeGreaterThan(still.simulation.steam.scalar.simulationTime + 3);
  expect(moving.simulation.steam.scalar.finite).toBe(true);
  expect(moving.simulation.steam.scalar.maximumDensity).toBeGreaterThan(0);
  expect(moving.simulation.steam.uploads).toBeGreaterThan(still.simulation.steam.uploads);
  expect(Math.abs(moving.simulation.onsen.relativeMassError)).toBeLessThan(1e-10);
  expect(moving.simulation.onsen.boundarySpeed).toBe(0);
  expect(moving.simulation.onsen.finite).toBe(true);
  expect(moving.simulation.onsen.maximumDepth - moving.simulation.onsen.minimumDepth).toBeGreaterThan(0.0001);
  expect(moving.simulation.onsen.stroke.phase).toBe("skim");
  expect(moving.simulation.onsen.stroke.sampledContacts).toBeGreaterThan(0);
  expect(moving.simulation.onsen.stroke.maximumSpeed).toBeLessThan(0.4);
  expect(moving.simulation.onsen.stroke.wristError).toBeLessThan(0.001);
  expect(moving.simulation.onsen.coupling.velocityChange).toBeGreaterThan(0);
  expect(Math.hypot(...moving.joints.HandL.map((v, i) => v - still.joints.HandL[i]))).toBeGreaterThan(0.03);
  const waterDiff = screenshotDiffRatio(onsenRegion(before, still), onsenRegion(after, moving));
  expect(waterDiff).toBeGreaterThan(0.0001);
  await capture(testInfo, "simulated-onsen-water-patch", onsenRegion(after, moving));
  await capture(testInfo, "simulated-onsen", after);
  await explore(ui);
  await ui.locator("[data-world-pause]").click();
  await ui.locator("[data-world-lab]>summary").click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(100);
  const paused = await evidence(scene);
  await page.clock.runFor(2000);
  const frozen = await evidence(scene);
  expect(frozen.simulation.onsen).toEqual(paused.simulation.onsen);
  expect(frozen.simulation.steam.scalar).toEqual(paused.simulation.steam.scalar);
  expect(frozen.simulation.steam.uploads).toBe(paused.simulation.steam.uploads);
  expect(frozen.simulation.wind.seconds).toBe(paused.simulation.wind.seconds);
  expect(frozen.ecology.particleMotion).toEqual(paused.ecology.particleMotion);
  await explore(ui);
  await ui.locator("[data-world-pause]").click();
  await ui.locator("[data-world-lab]>summary").click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(200);
  // Leave the scene through the next reading section. Going to the footer
  // would start a second WebGL renderer during this suspension-only check.
  await scene.evaluate((element) => window.scrollTo({ top: scrollY + element.getBoundingClientRect().bottom + 64, behavior: "instant" }));
  await page.clock.runFor(100);
  await expect.poll(() => scene.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThan(0);
  await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
  const hidden = await evidence(scene);
  await page.clock.runFor(5000);
  expect((await evidence(scene)).simulation.onsen.simulationTime).toBe(hidden.simulation.onsen.simulationTime);
  expect((await evidence(scene)).simulation.steam.scalar).toEqual(hidden.simulation.steam.scalar);
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(100);
  const recovered = await evidence(scene);
  expect(recovered.simulation.onsen.simulationTime - hidden.simulation.onsen.simulationTime).toBeLessThan(0.2);
  expect(recovered.simulation.steam.scalar.simulationTime - hidden.simulation.steam.scalar.simulationTime).toBeLessThan(0.2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.runFor(100);
  const reduced = await evidence(scene);
  expect(reduced.simulation.wind.enabled).toBe(false);
  await page.clock.runFor(1000);
  expect((await evidence(scene)).simulation.onsen).toEqual(reduced.simulation.onsen);
  expect((await evidence(scene)).simulation.steam.scalar).toEqual(reduced.simulation.steam.scalar);
  await explore(ui);
  await ui.locator("[data-world-activity]").selectOption("reading");
  await page.clock.runFor(100);
  const departed = await evidence(scene);
  expect(departed.simulation.skin.activeMaterials).toBe(reduced.simulation.skin.activeMaterials);
  expect(departed.garment.kind).toBe("authored shirt");
  expect(departed.garment.materials.every((m) => m.color !== 0x5d8078)).toBe(true);
  expect(departed.simulation.onsen.obstacle).toBeNull();
  expect(departed.simulation.steam.visible).toBe(false);
  expect(departed.simulation.lightField.trace).toEqual(still.simulation.lightField.trace);
  expect(Math.abs(departed.simulation.onsen.relativeMassError)).toBeLessThan(1e-10);
  expect(errors).toEqual([]);
  fs.writeFileSync(
    testInfo.outputPath("coastal-transport-evidence.json"),
    JSON.stringify(
      {
        still,
        resting,
        moving,
        paused,
        hidden,
        recovered,
        reduced,
        departed,
        waterDiff,
        sampling: await canvas.evaluate((element) => {
          const gl = element.getContext("webgl2"),
            debug = gl?.getExtension("WEBGL_debug_renderer_info");
          return {
            cadence: window.coastalProofCadence || { virtualHz: 60, timestamps: [] },
            renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
            performanceBenchmark: false,
          };
        }),
      },
      null,
      2
    )
  );
});

test("coastal physics: dispersive water changes visible pixels, shares La Jolla light, and suspends cleanly", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page, { motion: "reduce" });
  await settleRoomModels(scene);
  await page.waitForFunction(
    () => {
      const sim = document.querySelector("[data-home-desk-scene]")?.getSceneEvidence?.()?.simulation;
      return sim?.steam?.ready && sim?.lightField?.ready;
    },
    null,
    { timeout: 60000 }
  );
  await pauseSceneClock(page);
  // This time-sampled ocean proof needs two real frames 500 ms apart. The
  // complete renderer remains active; transport retains its separate 10 Hz.
  await useSoftwareSceneCadence(page, { continuousHz: 2 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await explore(ui);
  await ui.locator("[data-world-time]").fill("800");
  await ui.locator('[data-world-room="outside"]').click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(1400);
  const info = await evidence(scene);
  expect(info.ecology.water.waves).toBe(10);
  expect(info.ecology.water.sample.jacobian).toBeGreaterThan(0.6);
  expect(info.ecology.water.reflection.linear).toBe(true);
  expect(info.ecology.water.reflection.fresnelIOR).toBe(1.333);
  expect(info.daylight.location.latitude).toBe(32.83);
  expect(info.daylight.sunlight).toBe(1);
  await expect(ui.locator("[data-world-clock]")).toContainText("La Jolla");
  const before = await canvas.screenshot();
  await page.clock.runFor(500);
  const after = await canvas.screenshot();
  expect(screenshotDiffRatio(before, after)).toBeGreaterThan(0.001);
  // This interior patch of the normal exterior's sea excludes the moving actor
  // and most birds. Motion must change actual water pixels, not only telemetry.
  const seaDiff = screenshotDiffRatio(seaRegion(before), seaRegion(after));
  expect(seaDiff).toBeGreaterThan(0.002);
  await capture(testInfo, "moving-water-region", seaRegion(after));
  await capture(testInfo, "physical-pacific", after);
  await ui.locator("[data-world-pause]").click();
  await page.clock.runFor(500);
  await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
  const frozen = (await evidence(scene)).ecology.water.seconds;
  await page.clock.runFor(250);
  expect((await evidence(scene)).ecology.water.seconds).toBe(frozen);
  await ui.locator("[data-world-pause]").click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(100);
  await expect.poll(async () => (await evidence(scene)).ecology.water.seconds).toBeGreaterThan(frozen);
  const final = await evidence(scene);
  const proofFile = testInfo.outputPath("physical-rendering-evidence.json");
  fs.writeFileSync(
    proofFile,
    JSON.stringify(
      {
        water: final.ecology.water,
        daylight: final.daylight,
        frameTiming: final.frameTiming,
        drawCalls: final.drawCalls,
        triangles: final.triangles,
        resources: final.resources,
        seaPixelDiff: seaDiff,
        sampling: await canvas.evaluate((element) => {
          const gl = element.getContext("webgl2"),
            debug = gl?.getExtension("WEBGL_debug_renderer_info");
          return {
            cadence: window.coastalProofCadence || { virtualHz: 60, timestamps: [] },
            renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
            performanceBenchmark: false,
          };
        }),
      },
      null,
      2
    )
  );
  await testInfo.attach("physical-rendering-evidence", { path: proofFile, contentType: "application/json" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(ui.locator("[data-world-pause]")).toBeDisabled();
  await page.clock.runFor(500);
  await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
  expect(errors).toEqual([]);
});

test("coastal physics: the study label transfers only above contact and keeps the newest album", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page, { motion: "no-preference" });
  await settleRoomModels(scene);
  await explore(ui);
  await ui.locator('[data-world-room="study"]').first().click();
  await ui.locator(".home-world-objects > summary").click();
  const first = ui.locator('[data-world-record="0"]');
  await first.click();
  await first.click();
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await evidence(scene)).recordMechanics.phase).toBe("tracking");
  await expect.poll(async () => (await evidence(scene)).displayedVinylRecord).toBe(0);
  await pauseSceneClock(page);
  await useSoftwareSceneCadence(page);
  // Preserve pauseAt's original ten-second, single-callback jump while
  // acquiring the pause without a wall/IPC race.
  await page.clock.fastForward(10000);
  const before = await evidence(scene);
  const second = ui.locator('[data-world-record="1"]');
  await second.click();
  await second.click();
  await canvas.scrollIntoViewIfNeeded();
  const interrupted = await evidence(scene);
  expect(interrupted.recordMechanics.angle).toBe(before.recordMechanics.angle);
  expect(interrupted.recordMechanics.velocity).toBe(before.recordMechanics.velocity);
  expect(interrupted.displayedVinylRecord).toBe(0);
  await page.clock.runFor(100);
  expect((await evidence(scene)).displayedVinylRecord).toBe(0);
  const third = ui.locator('[data-world-record="2"]');
  await third.click();
  await third.click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(650);
  await expect.poll(async () => (await evidence(scene)).displayedVinylRecord).toBe(2);
  const transfer = (await evidence(scene)).vinylTransfer;
  expect(transfer.index).toBe(2);
  expect(transfer.lift).toBeGreaterThan(0.44);
  await page.clock.runFor(1400);
  expect((await evidence(scene)).recordMechanics.phase).toBe("tracking");
  await capture(testInfo, "study-physical-record", await canvas.screenshot());
  expect(errors).toEqual([]);
});

test("coastal home: quiet public controls, capybara wall art and a new arrival on refresh", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.addInitScript(() => sessionStorage.setItem("sirui-scene-style", "architectural"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-home-artifact-stage]")).toHaveAttribute("data-desk-mode", "2d");
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]");
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
  const first = (await evidence(scene)).avatarId;
  const ui = page.locator("[data-home-world-controls]");
  await expect(ui.locator("button:visible")).toHaveCount(1);
  await expect(scene).toHaveAttribute("data-render-style", "realistic");
  await expect(ui.locator("select:visible")).toHaveCount(0);
  await expect.poll(async () => (await evidence(scene)).portrait).toContain("/img/home/sirui_capy.jpg");
  await ui.locator("[data-world-view]").click();
  await expect(scene).toHaveAttribute("data-room", "outside");
  await expect(ui.locator("[data-world-view]")).toHaveText(/Back inside/);
  const canvas = scene.locator("canvas");
  await canvas.focus();
  await canvas.press("Escape");
  await expect(ui.locator("[data-world-view]")).toHaveText(/Look around/);
  await ui.locator("[data-world-view]").click();
  await ui.locator("[data-world-view]").click();
  expect((await evidence(scene)).following).toBe(true);
  await page.reload();
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
  expect((await evidence(scene)).avatarId).not.toBe(first);
  await expect.poll(async () => (await evidence(scene)).portrait).toContain("/img/home/sirui_capy.jpg");
  expect(errors).toEqual([]);
});

test("coastal home: the lab stays minimal and realistic with obsolete saved styles", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  await page.addInitScript(() => sessionStorage.setItem("sirui-scene-style", "illustrated"));
  const { scene, ui } = await openHome(page, { time: "2026-10-01T13:20:00-07:00" });
  await explore(ui);
  await ui.locator("[data-world-avatar]").selectOption("ghibli");
  await expect(scene).toHaveAttribute("data-avatar", "ghibli");
  await ui.locator("details").first().locator("summary").first().click();
  await expect(scene).toHaveAttribute("data-render-style", "realistic");
  await expect(ui.locator("[data-world-style]")).toHaveCount(0);
  await expect(ui.locator("button:visible")).toHaveCount(1);
  await expect(ui.locator("select:visible")).toHaveCount(0);
  await expect(ui.locator("details").first()).not.toHaveAttribute("open");
  await capture(testInfo, "minimal-realistic-controls", await page.locator(".home-hero-media").screenshot());
  await explore(ui);
  await expect(ui.locator("[data-world-avatar]")).toBeVisible();
  await ui.locator('[data-world-room="overview"]').click();
  await expect(scene).toHaveAttribute("data-room", "overview");
  await ui.locator('[data-world-room="study"]').click();
  await expect(scene).toHaveAttribute("data-room", "study");
  await ui.locator("details").first().locator("summary").first().click();
  await expect(ui.locator("[data-world-avatar]")).toBeHidden();
  expect(errors).toEqual([]);
});

for (const theme of ["light", "dark"]) {
  test(`coastal home: ${theme} scene fades completely before every canvas edge`, async ({ page }, testInfo) => {
    const { scene, canvas, ui } = await openHome(page, { theme });
    await explore(ui);
    await ui.locator("[data-world-activity]").selectOption("workout");
    await canvas.scrollIntoViewIfNeeded();
    const sceneBox = await scene.boundingBox();
    const canvasBox = await canvas.boundingBox();
    expect(Math.abs(canvasBox.height - sceneBox.height)).toBeLessThan(1);
    const visible = PNG.sync.read(await scene.screenshot());
    await canvas.evaluate((e) => (e.style.visibility = "hidden"));
    const background = PNG.sync.read(await scene.screenshot());
    await canvas.evaluate((e) => (e.style.visibility = ""));
    let largestDifference = 0;
    for (let y = 0; y < visible.height; y++) {
      for (let x = 0; x < visible.width; x++) {
        if (x > 1 && y > 1 && x < visible.width - 2 && y < visible.height - 2) continue;
        const i = (y * visible.width + x) * 4;
        for (let c = 0; c < 3; c++) largestDifference = Math.max(largestDifference, Math.abs(visible.data[i + c] - background.data[i + c]));
      }
    }
    expect(largestDifference).toBeLessThan(5);
    await capture(testInfo, `organic-edge-${theme}`, await scene.screenshot());
  });

  test(`coastal home: ${theme} composition, connected rooms, actual orbit and zoom`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    const { scene, canvas, stage, ui } = await openHome(page, { theme });
    if (theme === "dark") {
      await explore(ui);
      await ui.locator("[data-world-time]").fill("1380");
      await expect(scene).toHaveAttribute("data-scene-palette", "evening");
      await canvas.scrollIntoViewIfNeeded();
      await settle(page);
    }
    await settleRoomModels(scene);
    await expect(stage.locator(".home-world-welcome")).toBeVisible();
    const before = await canvas.screenshot();
    const metrics = screenshotMetrics(before);
    expect(metrics.uniqueColors).toBeGreaterThan(60);
    expect(metrics.luminanceVariance).toBeGreaterThan(80);
    await canvas.focus();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.12);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.17, { steps: 12 });
    await page.mouse.up();
    await settle(page);
    const orbit = await canvas.screenshot();
    expect(screenshotDiffRatio(before, orbit)).toBeGreaterThan(0.02);
    await canvas.focus();
    await canvas.press("+");
    await canvas.press("+");
    await settle(page);
    expect(screenshotDiffRatio(orbit, await canvas.screenshot())).toBeGreaterThan(0.006);
    expect(await canvas.evaluate((e) => e.matches(":focus-visible"))).toBe(true);
    expect(await scene.evaluate((e) => getComputedStyle(e, "::after").borderTopWidth)).toBe("2px");
    await capture(testInfo, "keyboard-focus", await scene.screenshot());
    await explore(ui);
    await ui.locator('[data-world-room="overview"]').click();
    await canvas.scrollIntoViewIfNeeded();
    await settle(page);
    await capture(testInfo, "connected-home", await canvas.screenshot());
    await ui.locator('[data-world-room="outside"]').click();
    await expect(scene).toHaveAttribute("data-room", "outside");
    await canvas.scrollIntoViewIfNeeded();
    await settle(page);
    await capture(testInfo, "same-house-outside", await canvas.screenshot());
    await ui.locator('[data-world-room="study"]').first().click();
    await expect(scene).toHaveAttribute("data-room", "study");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("coastal home: all five avatars retain one actor, shared wall art and album state", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page);
  await settleRoomModels(scene);
  await pauseSceneClock(page);
  await explore(ui);
  await ui.locator("[data-world-activity]").selectOption("workout");
  for (const avatar of ["lizard", "south-park", "simpsons", "ghibli", "rick-and-morty", "lizard"]) {
    await ui.locator("[data-world-avatar]").selectOption(avatar);
    await settleAvatarLoad(ui);
    await expect(scene).toHaveAttribute("data-avatar", avatar);
    await expect.poll(async () => (await evidence(scene)).portrait).toContain("/img/home/sirui_capy.jpg");
    await canvas.scrollIntoViewIfNeeded();
    await page.clock.runFor(100);
    await settle(page);
    const info = await evidence(scene);
    expect(info.actorCount).toBe(1);
    expect(info.animations).toHaveLength(14);
    expect(info.characterPerformance.eyelidMeshes).toBeGreaterThan(0);
    expect(info.characterPerformance.blink).toEqual([0, 0]);
    expect(info.joints.FootR[1]).toBeGreaterThan(0.06);
    expect(info.joints.FootR[1]).toBeLessThan(0.16);
    await capture(testInfo, avatar, await canvas.screenshot());
  }
  expect((await evidence(scene)).currentRecord).toBe(0);
  expect((await evidence(scene)).style).toBe("realistic");
  await page.locator('[data-home-desk-mode="2d"]').click();
  await page.locator('[data-home-desk-mode="3d"]').click();
  expect((await evidence(scene)).avatarId).toBe("lizard");
  expect(errors).toEqual([]);
});

test("coastal home: compiled avatar replacements release their bone textures", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Rig ownership and texture lifetime are shared across viewports.");
  const errors = collectRuntimeErrors(page);
  const { scene, ui } = await openHome(page);
  await settleRoomModels(scene);
  await pauseSceneClock(page);
  await explore(ui);
  await ui.locator("[data-world-activity]").selectOption("workout");
  await page.evaluate(async () => {
    const { Skeleton } = await import(new URL("assets/js/three.module.min.js", location.href).href);
    const dispose = Skeleton.prototype.dispose;
    window.__coastalRigDisposals = [];
    Skeleton.prototype.dispose = function () {
      const hadTexture = Boolean(this.boneTexture);
      dispose.call(this);
      window.__coastalRigDisposals.push({ hadTexture, cleared: this.boneTexture === null });
    };
  });
  const avatars = ["lizard", "south-park", "simpsons", "ghibli", "rick-and-morty"];
  const reference = new Map(),
    samples = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const avatar of avatars) {
      const frame = (await evidence(scene)).frames;
      await ui.locator("[data-world-avatar]").selectOption(avatar);
      await settleAvatarLoad(ui);
      await expect(scene).toHaveAttribute("data-avatar", avatar);
      await scene.locator("canvas").scrollIntoViewIfNeeded();
      await page.clock.runFor(100);
      await expect.poll(async () => (await evidence(scene)).frames).toBeGreaterThan(frame);
      await settle(page);
      const info = await evidence(scene);
      expect(info.actorCount).toBe(1);
      samples.push({ cycle, avatar, textures: info.resources.textures, geometries: info.resources.geometries });
      if (cycle === 1) reference.set(avatar, info.resources.textures);
      if (cycle === 2) expect(info.resources.textures).toBe(reference.get(avatar));
    }
  }
  const beforeDisposal = await page.evaluate(() => window.__coastalRigDisposals.length);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  await expect(scene.locator("canvas")).toHaveCount(0);
  const disposals = await page.evaluate(() => window.__coastalRigDisposals);
  expect(disposals).toHaveLength(beforeDisposal + 1);
  expect(disposals.every((entry) => entry.hadTexture && entry.cleared)).toBe(true);
  const report = testInfo.outputPath("compiled-avatar-resource-cycles.json");
  fs.mkdirSync(path.dirname(report), { recursive: true });
  fs.writeFileSync(report, JSON.stringify({ samples, disposals }, null, 2));
  await testInfo.attach("compiled-avatar-resource-cycles", { path: report, contentType: "application/json" });
  expect(errors).toEqual([]);
});

test("character performance: attention settles and eyelids respect pause and reduced motion", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page, { motion: "reduce", time: "2026-10-01T13:20:00-07:00" });
  await settleRoomModels(scene);
  await pauseSceneClock(page);
  await useSoftwareSceneCadence(page, { continuousHz: 2 });
  await explore(ui);
  await ui.locator("[data-world-activity]").selectOption("work");
  await ui.locator("[data-world-avatar]").selectOption("ghibli");
  await expect(scene).toHaveAttribute("data-avatar", "ghibli");
  await expect.poll(async () => (await evidence(scene)).characterPerformance?.eyelidMeshes).toBeGreaterThan(0);
  await canvas.scrollIntoViewIfNeeded();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.runFor(1400);
  const start = await evidence(scene);
  const rect = await canvas.boundingBox();
  await page.mouse.move(rect.x + rect.width * 0.76, rect.y + rect.height * 0.3);
  // Hold the authored acknowledgement for observation, even when a full
  // software-rendered frame costs longer than the gesture's wall-clock life.
  await page.clock.runFor(500);
  await expect
    .poll(async () => ["glance", "acknowledge"].includes((await evidence(scene)).characterPerformance?.phase), { intervals: [30] })
    .toBe(true);
  const attention = (await evidence(scene)).characterPerformance;
  expect(attention.attentionTarget.direction[2]).toBeGreaterThan(0);
  expect(attention.attentionTarget.worldDirection.every(Number.isFinite)).toBe(true);
  expect(Math.sign(attention.eye[0] + attention.head[0])).toBe(Math.sign(attention.attentionTarget.angles[0]));
  expect(Math.hypot(...(await evidence(scene)).camera.map((value, i) => value - start.camera[i]))).toBeLessThan(0.03);
  await page.clock.runFor(2600);
  await expect.poll(async () => (await evidence(scene)).characterPerformance?.phase).toBe("routine");
  await expect.poll(async () => (await evidence(scene)).characterPerformance?.blinkCount, { timeout: 10000 }).toBeGreaterThan(0);

  await ui.locator("[data-world-pause]").click();
  await page.clock.runFor(500);
  await expect.poll(async () => (await evidence(scene)).characterPerformance?.phase).toBe("still");
  const paused = await evidence(scene);
  expect(paused.characterPerformance.blink).toEqual([0, 0]);
  expect(paused.characterPerformance.head).toEqual([0, 0, 0]);
  await page.clock.fastForward(30000);
  expect((await evidence(scene)).characterPerformance.seconds).toBe(paused.characterPerformance.seconds);

  await ui.locator("[data-world-pause]").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(ui.locator("[data-world-pause]")).toBeDisabled();
  await ui.locator("[data-world-activity]").selectOption("sleep");
  await page.clock.runFor(500);
  await expect.poll(async () => (await evidence(scene)).characterPerformance?.blink).toEqual([1, 1]);
  await ui.locator("[data-world-activity]").selectOption("work");
  await page.clock.runFor(100);
  await expect.poll(async () => (await evidence(scene)).characterPerformance?.blink).toEqual([0, 0]);
  const still = await evidence(scene);
  expect(still.actorCount).toBe(1);
  expect(still.characterPerformance.headOnly).toBe(true);
  expect(still.animations).toHaveLength(14);
  fs.writeFileSync(
    testInfo.outputPath("character-attention-clock.json"),
    JSON.stringify({ attention, paused: paused.characterPerformance, still: still.characterPerformance, performanceBenchmark: false }, null, 2)
  );
  await capture(testInfo, "character-composed-return", await canvas.screenshot());
  expect(errors).toEqual([]);
});

test("character performance: P acknowledges a visitor without changing the room or camera", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, ui } = await openHome(page, { motion: "reduce", time: "2026-10-01T13:20:00-07:00" });
  // Acquire the clock before secondary-room loading can consume the page
  // companion's separate 35-60 second excursion schedule.
  await pauseSceneClock(page);
  await page.clock.runFor(2000);
  await settleRoomModels(scene);
  await useSoftwareSceneCadence(page, { continuousHz: 2 });
  await explore(ui);
  await ui.locator("[data-world-activity]").selectOption("work");
  await canvas.scrollIntoViewIfNeeded();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.runFor(1400);
  await expect.poll(async () => (await evidence(scene)).companion?.visible).toBe(true);
  await expect.poll(async () => (await evidence(scene)).companion?.attention?.phase).toBe("task");
  const start = await evidence(scene);
  const point = start.companion.projected;
  if (testInfo.project.name === "mobile-390") await page.touchscreen.tap(point.x + 32, point.y);
  else await page.mouse.move(point.x, point.y);
  // Notice (0.28 s), hello (2.6 s), then listen: observe the authored beat
  // before the bounded touch invitation or mouse proximity expires.
  await page.clock.runFor(3500);
  await expect.poll(async () => (await evidence(scene)).companion?.attention?.greetings).toBeGreaterThan(start.companion.attention.greetings);
  await expect.poll(async () => (await evidence(scene)).companion?.attention?.phase).toBe("listen");
  const listen = await evidence(scene);
  expect(listen.currentRoom).toBe(start.currentRoom);
  expect(listen.currentRecord).toBe(start.currentRecord);
  expect(Math.hypot(...listen.camera.map((value, i) => value - start.camera[i]))).toBeLessThan(0.03);
  expect(listen.companion.eyes.every(Number.isFinite)).toBe(true);
  await capture(testInfo, "P-listens-to-a-visitor", await canvas.screenshot());
  await page.clock.runFor(5000);
  await expect.poll(async () => (await evidence(scene)).companion?.attention?.phase).toBe("task");
  const greetings = (await evidence(scene)).companion.attention.greetings;
  await page.clock.runFor(600);
  expect((await evidence(scene)).companion.attention.greetings).toBe(greetings);
  // Observe the streamed turntable during the active encounter, before the
  // deliberate 30-second pause crosses the separate page-excursion schedule.
  // The authored record glance occurs at active seconds 24.5 through 28.
  await page.clock.fastForward(Math.max(0, (25 - (await evidence(scene)).companion.activeSeconds) * 1000));
  await expect.poll(async () => (await evidence(scene)).companion?.attention?.target, { timeout: 27000 }).toBe("record");

  await ui.locator("[data-world-pause]").click();
  await page.clock.runFor(500);
  await expect.poll(async () => (await evidence(scene)).companion?.attention?.phase).toBe("still");
  const paused = await evidence(scene);
  await page.clock.fastForward(30000);
  expect((await evidence(scene)).companion.activeSeconds).toBe(paused.companion.activeSeconds);
  expect((await evidence(scene)).companion.position).toEqual(paused.companion.position);
  fs.writeFileSync(
    testInfo.outputPath("P-listening-clock.json"),
    JSON.stringify({ start: start.companion, listen: listen.companion, paused: paused.companion, performanceBenchmark: false }, null, 2)
  );
  expect(await page.locator(".pip-companion").evaluate((element) => element.getCompanionEvidence().visible)).toBe(false);
  await page.locator('[data-home-desk-mode="2d"]').click();
  await expect(page.locator(".pip-companion")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("character performance: rapid room changes preserve P's airborne floor and queue the latest destination", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const view = await openClockedHome(page, { time: "2026-10-02T13:20:00-07:00" });
  const { scene, canvas, ui } = view;
  await explore(ui);
  await beginClockedMotion(page, canvas);
  expect(await page.locator(".pip-companion").evaluate((element) => element.getCompanionEvidence().owner)).toBe("world");
  await expect.poll(async () => (await evidence(scene)).companion?.visible).toBe(true);
  await sceneInputFrame(page, view, () => ui.locator('[data-world-room="kitchen"]').click());
  await expect.poll(async () => (await evidence(scene)).companion?.destinationRoom).toBe("kitchen");
  await page.clock.fastForward(4000);
  const before = (await evidence(scene)).companion;
  expect(before.traveling).toBe(true);
  await sceneInputFrame(page, view, () => ui.locator('[data-world-room="onsen"]').click());
  await expect.poll(async () => (await evidence(scene)).companion?.pendingRoom).toBe("onsen");
  const changed = await evidence(scene);
  expect(changed.currentRoom).toBe("onsen");
  expect(changed.companion.destinationRoom).toBe("kitchen");
  expect(Math.abs(changed.companion.position[1] - before.position[1])).toBeLessThan(0.5);
  await capture(testInfo, "P-retains-airborne-floor", await canvas.screenshot());
  await sceneInputFrame(page, view, () => ui.locator('[data-world-room="gym"]').click());
  await expect.poll(async () => (await evidence(scene)).companion?.pendingRoom).toBe("gym");
  await sceneInputFrame(page, view, () => ui.locator('[data-world-room="kitchen"]').click());
  await expect.poll(async () => (await evidence(scene)).companion?.pendingRoom).toBe(null);
  await sceneInputFrame(page, view, () => ui.locator("[data-world-pause]").click());
  const paused = (await evidence(scene)).companion;
  await page.clock.fastForward(3000);
  expect((await evidence(scene)).companion.position).toEqual(paused.position);
  fs.writeFileSync(
    testInfo.outputPath("P-flight-queue-clock.json"),
    JSON.stringify({ before, changed: changed.companion, paused, performanceBenchmark: false }, null, 2)
  );
  expect(errors).toEqual([]);
});

test("character performance: P finishes a wave without listening to a departed visitor", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Pointer departure; bounded touch invitations retain their separate expiry contract.");
  // Full software-rendered gesture samples need wall time independently of
  // their authored virtual duration. Keep the existing native budget.
  if (process.platform === "linux" || process.env.VISUAL_TRANSPORT_SOFTWARE === "1") test.setTimeout(600000);
  const errors = collectRuntimeErrors(page);
  const { scene, canvas } = await openClockedHome(page, { time: "2026-10-02T13:20:00-07:00" });
  await beginClockedMotion(page, canvas);
  await expect.poll(async () => (await evidence(scene)).companion?.visible).toBe(true);
  const start = await evidence(scene);
  const point = start.companion.projected;
  await page.mouse.move(point.x + 32, point.y);
  await page.clock.runFor(500);
  const wave = await evidence(scene);
  expect(wave.companion.attention.phase).toBe("greet");
  await page.mouse.move(0, 0);
  await page.clock.runFor(2700);
  const returning = await evidence(scene);
  await canvas.screenshot({ path: testInfo.outputPath("departed-visitor-return.png") });
  fs.writeFileSync(testInfo.outputPath("departed-visitor.json"), JSON.stringify({ start, wave, returning, errors }, null, 2));
  expect(returning.companion.attention.phase).toBe("return");
  expect(returning.companion.gesture).toBe("rest");
  await page.clock.runFor(1300);
  const quiet = await evidence(scene);
  const cadence = await page.evaluate(() => window.coastalProofCadence ?? null);
  fs.writeFileSync(
    testInfo.outputPath("departed-visitor.json"),
    JSON.stringify({ start, wave, returning, quiet, cadence, errors, performanceBenchmark: false }, null, 2)
  );
  expect(quiet.companion.attention.phase).toBe("task");
  expect(quiet.companion.gesture).toBe("rest");
  expect(quiet.companion.attention.greetings).toBe(start.companion.attention.greetings + 1);
  expect(quiet.currentRoom).toBe(start.currentRoom);
  expect(quiet.currentRecord).toBe(start.currentRecord);
  expect(errors).toEqual([]);
});

test("coastal neighbours: keyboard inspection, on-animal return, zoom and Back inside preserve the room state", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const view = await openClockedHome(page, { time: "2026-10-01T13:20:00-07:00" });
  const { scene, canvas, ui } = view;
  await expect.poll(async () => (await evidence(scene)).ecology.wildlife.modelsReady, { timeout: 45000 }).toBe(true);
  const initial = await evidence(scene);
  await sceneInputFrame(page, view, () => ui.locator("[data-world-view]").click());
  const coastline = await evidence(scene);
  const wide = await canvas.screenshot();
  await sceneInputFrame(page, view, () => canvas.press("n"));
  await expect(scene).toHaveAttribute("data-coastal-neighbour", "rabbit-0");
  await expect.poll(async () => (await evidence(scene)).neighbours.length).toBe(17);
  const rabbitArrival = (await evidence(scene)).inspection.arrival;
  expect(rabbitArrival.visibleFaceSamples).toBe(rabbitArrival.faceSamples);
  expect(rabbitArrival.visibleBody).toBe(true);
  await expect
    .poll(async () => {
      const view = await evidence(scene),
        point = view.neighbours.find((item) => item.id === "rabbit-0").worldCenter;
      return Math.hypot(...view.target.map((value, i) => value - point[i]));
    })
    .toBeLessThan(0.01);
  await capture(testInfo, "rabbit-inspection", await canvas.screenshot());
  for (let i = 0; i < 7 && (await evidence(scene)).inspection.id !== "seaLion-0"; i++) await sceneInputFrame(page, view, () => canvas.press("n"));
  await expect(scene).toHaveAttribute("data-coastal-neighbour", "seaLion-0");
  await expect(canvas).toHaveAttribute("aria-label", /California sea lion/);
  await expect
    .poll(async () => {
      const view = await evidence(scene),
        point = view.neighbours.find((item) => item.id === "seaLion-0").worldCenter;
      return Math.hypot(...view.target.map((value, i) => value - point[i]));
    })
    .toBeLessThan(0.01);
  const near = await evidence(scene);
  expect(near.currentRoom).toBe("outside");
  expect(near.activity).toBe(initial.activity);
  expect(near.currentRecord).toBe(initial.currentRecord);
  expect(near.cameraOrbit.radius).toBeLessThan(coastline.cameraOrbit.radius * 0.5);
  expect(Math.hypot(...near.camera.map((value, i) => value - near.target[i]))).toBeLessThan(near.cameraOrbit.radius * 1.6);
  const before = await canvas.screenshot();
  expect(screenshotDiffRatio(wide, before)).toBeGreaterThan(0.05);
  await capture(testInfo, "sea-lion-inspection", before);
  await sceneInputFrame(page, view, async () => {
    await canvas.press("ArrowRight");
    await canvas.press("+");
  });
  expect(screenshotDiffRatio(before, await canvas.screenshot())).toBeGreaterThan(0.015);
  const after = await evidence(scene);
  const point = after.neighbours.find((item) => item.id === "seaLion-0").projected;
  const rect = await canvas.boundingBox();
  await sceneInputFrame(page, view, async () => {
    if (testInfo.project.name === "mobile-390") await page.touchscreen.tap(rect.x + point.x * rect.width, rect.y + point.y * rect.height);
    else await page.mouse.click(rect.x + point.x * rect.width, rect.y + point.y * rect.height);
  });
  await expect(scene).not.toHaveAttribute("data-coastal-neighbour", /.+/);
  expect((await evidence(scene)).currentRoom).toBe("outside");
  await sceneInputFrame(page, view, async () => {
    await canvas.press("n");
    await ui.locator("[data-world-view]").click();
  });
  await expect(scene).toHaveAttribute("data-room", "study");
  expect((await evidence(scene)).inspection).toBeNull();
  expect((await evidence(scene)).currentRecord).toBe(initial.currentRecord);
  await expect(canvas).toHaveAttribute("aria-label", /Sirui’s coastal home/);
  expect(errors).toEqual([]);
});

test("coastal home: modified and composing canvas shortcuts preserve the view", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const view = await openClockedHome(page);
  const { scene, canvas } = view;
  await settleRoomModels(scene);
  await sceneInputFrame(page, view, () => page.locator("[data-world-view]").click());
  const before = await evidence(scene);
  const delivered = await canvas.evaluate((element) => {
    const samples = [];
    for (const modifier of ["ctrlKey", "metaKey", "altKey", "isComposing"]) {
      for (const key of ["ArrowLeft", "n", "d", "+", "-"]) {
        const event = new KeyboardEvent("keydown", { key, [modifier]: true, bubbles: true, cancelable: true });
        element.dispatchEvent(event);
        samples.push({ modifier, key, prevented: event.defaultPrevented });
      }
    }
    return samples;
  });
  expect(delivered.every((sample) => !sample.prevented)).toBe(true);
  const after = await evidence(scene);
  fs.writeFileSync(testInfo.outputPath("canvas-shortcuts.json"), JSON.stringify({ before, after, delivered, errors }, null, 2));
  expect(after.currentRoom).toBe(before.currentRoom);
  expect(after.inspection).toEqual(before.inspection);
  expect(after.cameraOrbit).toEqual(before.cameraOrbit);
  expect(after.dropped).toEqual(before.dropped);
  await sceneInputFrame(page, view, () => canvas.press("N"));
  await expect.poll(async () => (await evidence(scene)).inspection?.id).toBe("rabbit-0");
  await sceneInputFrame(page, view, () => canvas.press("Enter"));
  expect((await evidence(scene)).inspection).toBe(null);
  expect(errors).toEqual([]);
});

test("coastal neighbours: new raccoon and birds expose real close views without extra public controls", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const home = await openClockedHome(page, { time: "2026-10-01T13:20:00-07:00" });
  const { scene, canvas, ui } = home;
  await expect.poll(async () => (await evidence(scene)).ecology.wildlife.modelsReady, { timeout: 45000 }).toBe(true);
  await sceneInputFrame(page, home, () => ui.locator("[data-world-view]").click());
  const neighbours = (await evidence(scene)).neighbours;
  expect(neighbours).toHaveLength(17);
  expect(neighbours.every((animal) => animal.faceAnchorSource === "named acting pivots")).toBe(true);
  await settleRoomModels(scene);
  await sceneInputFrame(page, home, () => ui.locator("[data-world-view]").click());
  // Deliver the gallery selection before any exterior frame can update the
  // cutaway. A slow renderer or rapid key burst must score the final roof.
  await canvas.evaluate(
    (element, presses) => {
      for (let index = 0; index < presses; index++) element.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));
    },
    neighbours.findIndex((animal) => animal.id === "balcony-gull-0") + 1
  );
  await expect(scene).toHaveAttribute("data-coastal-neighbour", "balcony-gull-0");
  await page.clock.runFor(200);
  const burst = await evidence(scene);
  expect(burst.inspection.arrival.visibleFaceSamples).toBe(burst.inspection.arrival.faceSamples);
  expect(burst.inspection.arrival.visibleBody).toBe(true);
  const gallery = await canvas.screenshot(),
    image = PNG.sync.read(gallery),
    center = new PNG({ width: Math.floor(image.width * 0.4), height: Math.floor(image.height * 0.4) });
  PNG.bitblt(image, center, Math.floor(image.width * 0.3), Math.floor(image.height * 0.3), center.width, center.height, 0, 0);
  // Exclude the feathered border: a sandstone-filled frame has variance <1
  // despite a centered target, whereas the real gull/rail/ocean are distinct.
  expect(screenshotMetrics(PNG.sync.write(center)).luminanceVariance).toBeGreaterThan(80);
  await capture(testInfo, "gallery-gull-after-synchronous-cutaway-transition", gallery);
  await sceneInputFrame(page, home, () => canvas.press("Enter"));
  const expected = new Set(["raccoon-0", "gull-0", "balcony-gull-0", "sandpiper-0"]),
    visited = new Set();
  for (let i = 0; i < neighbours.length; i++) {
    await sceneInputFrame(page, home, () => canvas.press("n"));
    const view = await evidence(scene);
    expect(view.inspection.arrival.faceSamples).toBeGreaterThanOrEqual(2);
    expect(view.camera.every(Number.isFinite)).toBe(true);
    const selected = view.neighbours.find((animal) => animal.id === view.inspection.id);
    expect(Math.hypot(...view.target.map((value, axis) => value - selected.worldCenter[axis]))).toBeLessThan(0.01);
    if (expected.has(view.inspection.id)) {
      visited.add(view.inspection.id);
      // A projected target can remain centered while opaque scenery fills
      // the rendered frame. Require an actual unobstructed arrival as well.
      expect(view.inspection.arrival.visibleFaceSamples).toBe(view.inspection.arrival.faceSamples);
      expect(view.inspection.arrival.visibleBody).toBe(true);
      expect(selected.projected.x).toBeGreaterThan(0);
      expect(selected.projected.x).toBeLessThan(1);
      expect(selected.projected.y).toBeGreaterThan(0);
      expect(selected.projected.y).toBeLessThan(1);
      await canvas.evaluate((element) => element.blur());
      await capture(testInfo, `${view.inspection.id}-actual-arrival`, await canvas.screenshot());
    }
  }
  expect(visited).toEqual(expected);
  await sceneInputFrame(page, home, () => canvas.press("Enter"));
  expect((await evidence(scene)).inspection).toBeNull();
  expect(await ui.locator("button:visible").count()).toBe(1);
  expect(errors).toEqual([]);
});

test("coastal home: full exterior orbit and guided interior camera boundaries", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "camera geometry is shared; touch zoom has its own mobile case");
  const errors = collectRuntimeErrors(page);
  const view = await openClockedHome(page);
  const { scene, canvas, ui } = view;
  await explore(ui);
  for (const room of ["outside", "overview", "study", "kitchen", "gym", "onsen", "sleep", "lounge"]) {
    await sceneInputFrame(page, view, () => ui.locator(`[data-world-room="${room}"]`).first().click());
    // Keep a real focused keyboard input, then stress the same browser handler
    // with a burst of repeat events. Hundreds of protocol round trips otherwise
    // force hundreds of software-rendered frames on Linux before any assertion.
    await sceneInputFrame(page, view, () => canvas.press("ArrowLeft"));
    // Each burst stays below half a turn. Let its frame finish so the camera's
    // shortest-angle interpolation follows the complete orbit, not a shortcut.
    for (const count of [14, 14, 13]) {
      await canvas.evaluate((node, count) => {
        for (let i = 0; i < count; i++) node.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", repeat: true, bubbles: true }));
      }, count);
      await page.clock.runFor(200);
      await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
    }
    await canvas.evaluate((node) => {
      for (let i = 0; i < 12; i++) node.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", repeat: true, bubbles: true }));
    });
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -8000);
    await page.clock.runFor(200);
    const state = await evidence(scene),
      v = state.cameraOrbit,
      e = state.cameraEnvelope;
    expect(v.radius).toBeGreaterThanOrEqual(e.radius[0] - 0.001);
    expect(v.pitch).toBeLessThanOrEqual(e.pitch[1] + 0.001);
    if (room === "outside") expect(v.yaw).toBeGreaterThan(Math.PI * 2);
    else {
      expect(v.yaw).toBeGreaterThanOrEqual(e.yaw[0] - 0.001);
      expect(v.yaw).toBeLessThanOrEqual(e.yaw[1] + 0.001);
    }
    expect(state.camera.every(Number.isFinite)).toBe(true);
    await canvas.evaluate((e) => e.blur());
    await capture(testInfo, `camera-boundary-${room}`, await canvas.screenshot());
  }
  expect(errors).toEqual([]);
});

test("coastal home: composed activities and previews survive clock changes until Now", async ({ page }, testInfo) => {
  const view = await openClockedHome(page);
  const { scene, canvas, ui } = view;
  await explore(ui);
  // These world-space contact bounds describe Lizard's authored proportions.
  // Public arrivals randomize; the animation fixture must remain deterministic.
  await ui.locator("[data-world-avatar]").selectOption("lizard");
  await settleAvatarLoad(ui);
  await expect(scene).toHaveAttribute("data-avatar", "lizard");
  for (const activity of ["sleep", "breakfast", "reading", "lunch", "work", "workout", "soak", "dinner", "lounge", "coding"]) {
    await sceneInputFrame(page, view, () => ui.locator("[data-world-activity]").selectOption(activity));
    await expect(scene).toHaveAttribute("data-activity", activity);
    const info = await evidence(scene);
    expect(info.following).toBe(false);
    expect(info.clockMode).toBe("preview");
    if (activity === "work") {
      expect(info.joints.HandR[1] - info.activityFloor).toBeGreaterThan(0.8);
      expect(info.joints.HandR[1] - info.activityFloor).toBeLessThan(0.96);
      expect(info.joints.HandR[2] - info.activityOffset[2]).toBeLessThan(-1.8);
    }
    if (activity === "sleep") expect(info.joints.Root[1] - info.activityFloor).toBeGreaterThan(0.5);
    if (["breakfast", "reading", "lunch", "workout", "dinner", "lounge"].includes(activity)) {
      expect(info.prop.ancestorsVisible).toBe(true);
      expect(info.prop.size.every((v) => Number.isFinite(v) && v > 0.002)).toBe(true);
      const gripDistance = Math.hypot(...info.prop.position.map((v, i) => v - info.joints.HandR[i]));
      expect(gripDistance).toBeLessThan(0.18);
    }
    if (["breakfast", "lunch", "dinner"].includes(activity)) {
      expect(Math.abs(info.joints.HandR[0] - info.joints.Head[0])).toBeLessThan(0.13);
      expect(info.joints.HandR[1]).toBeGreaterThan(1.03);
    }
    await capture(testInfo, `activity-${activity}`, await canvas.screenshot());
  }
  await sceneInputFrame(page, view, () => ui.locator('[data-world-room="onsen"]').click());
  const before = (await evidence(scene)).camera;
  await page.clock.fastForward(60000);
  expect((await evidence(scene)).camera).toEqual(before);
  await expect(scene).toHaveAttribute("data-activity", "coding");
  await sceneInputFrame(page, view, () => ui.locator("[data-world-now]").click());
  expect((await evidence(scene)).following).toBe(true);
  await expect(scene).toHaveAttribute("data-activity", "workout");
  await expect(scene).toHaveAttribute("data-room", "gym");
});

test("coastal home: album focus, playback, discovery, mode sharing, and paper navigation", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas, stage, ui } = await openHome(page, { motion: "no-preference" });
  const player = page.locator(".home-record-player"),
    playerScene = page.locator("[data-home-record-scene]"),
    source = page.locator("[data-home-record-source]");
  await explore(ui);
  await ui.locator(".home-world-objects > summary").click();
  const record = ui.locator('[data-world-record="0"]');
  await record.click();
  await expect(scene).toHaveAttribute("data-focused-desk-object", "record-0");
  await record.click();
  await expect(scene).toHaveAttribute("data-record-spinning", "true");
  await page.waitForTimeout(250);
  expect((await playerScene.evaluate((e) => e.getRecordEvidence())).running).toBe(false);
  expect(await player.evaluate((e) => e.inert)).toBe(true);
  await expect(source).toBeHidden();
  await source.evaluate((e) => e.focus({ preventScroll: true }));
  expect(await source.evaluate((e) => e === document.activeElement)).toBe(false);
  await capture(testInfo, "record-caption-hidden-in-3d", await page.locator(".home-hero-media").screenshot());
  await ui.locator("[data-world-avatar]").selectOption("simpsons");
  await expect(scene).toHaveAttribute("data-avatar", "simpsons");
  for (let i = 0; i < 4; i++) {
    await canvas.focus();
    await canvas.press("d");
  }
  await expect(stage).toHaveAttribute("data-dropped-records", "0,1,2,3");
  await page.locator('[data-home-desk-mode="2d"]').click();
  await expect(stage.locator("[data-home-record-card]")).toHaveCount(4);
  expect(await player.evaluate((e) => e.inert)).toBe(false);
  await expect(source).toBeVisible();
  await expect.poll(() => playerScene.evaluate((e) => e.getRecordEvidence().running)).toBe(true);
  await page.locator('[data-home-desk-mode="3d"]').click();
  expect((await evidence(scene)).avatarId).toBe("simpsons");
  expect((await evidence(scene)).dropped).toEqual([0, 1, 2, 3]);
  await ui.locator('[data-world-paper="0"]').click();
  await expect(scene).toHaveAttribute("data-focused-desk-object", "artifact-0");
  await ui.locator('[data-world-paper="0"]').click();
  await expect(page).toHaveURL(/\/projects\/designweaver\//);
  expect(errors).toEqual([]);
});

for (const persisted of [true, false]) {
  test(`coastal home: an initial room load ${persisted ? "survives a persisted return" : "aborts quietly on teardown"}`, async ({
    page,
  }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    await preparePage(page, "light");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.setSystemTime(new Date("2026-10-01T13:20:00-07:00"));
    let releaseRoom, roomRequested;
    const gate = new Promise((resolve) => (releaseRoom = resolve));
    const request = new Promise((resolve) => (roomRequested = resolve));
    const failed = [];
    page.on("requestfailed", (request) => failed.push(request.url()));
    await page.route("**/models/home/room-study.glb", async (route) => {
      roomRequested();
      await gate;
      await route.continue().catch(() => {});
    });
    await page.goto(publicRouteUrl("/"), { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.__coastalUnavailableEvents = 0;
      document.addEventListener("home-scene-unavailable", () => window.__coastalUnavailableEvents++);
    });
    await page.locator('[data-home-desk-mode="3d"]').click();
    await request;
    const scene = page.locator("[data-home-desk-scene]"),
      stage = page.locator("[data-home-artifact-stage]");
    await expect.poll(() => evidence(scene).then((e) => e.actorCount)).toBe(1);
    const before = await evidence(scene);
    await expect(scene).toHaveAttribute("data-scene-state", "loading");
    await page.evaluate((persisted) => {
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted }));
      if (persisted) window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    }, persisted);
    releaseRoom();
    if (persisted) {
      await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
      await expect(stage).toHaveAttribute("data-desk-mode", "3d");
      await expect(scene.locator("canvas")).toHaveCount(1);
      const after = await evidence(scene);
      expect(after.actorCount).toBe(1);
      expect(after.avatarId).toBe(before.avatarId);
      expect(after.currentRecord).toBe(before.currentRecord);
      expect(failed.some((url) => url.includes("room-study.glb"))).toBe(false);
      await capture(testInfo, "initial-load-cached-return", await page.locator(".home-hero-media").screenshot());
    } else {
      await expect(scene.locator("canvas")).toHaveCount(0);
      await expect.poll(() => failed.some((url) => url.includes("room-study.glb"))).toBe(true);
      await page.waitForTimeout(250);
      expect(await scene.evaluate((e) => Boolean(e.getSceneEvidence))).toBe(false);
    }
    expect(await page.evaluate(() => window.__coastalUnavailableEvents)).toBe(0);
    expect(errors).toEqual([]);
  });
}

test("coastal home: the gym frames the face and full exercise poses, then restores the normal lens", async ({ page }, testInfo) => {
  // Four complete poses plus fourteen actual orbit frames remain one proof.
  // This allowance is software fixture capacity, not an application speedup.
  if (process.platform === "linux" || process.env.VISUAL_TRANSPORT_SOFTWARE === "1") test.setTimeout(1200000);
  const errors = collectRuntimeErrors(page);
  const view = await openClockedHome(page, { time: "2026-10-02T13:20:00-07:00" });
  const { scene, canvas, ui } = view;
  await explore(ui);
  await ui.locator("[data-world-avatar]").selectOption("ghibli");
  await settleAvatarLoad(ui);
  await expect(scene).toHaveAttribute("data-avatar", "ghibli");
  await canvas.scrollIntoViewIfNeeded();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(ui.locator("[data-world-pause]")).toBeEnabled();
  await sceneInputFrame(page, view, () => ui.locator("[data-world-pause]").click());
  // Every tested pose resets its sequence below. Keep the 1.4 s setup
  // advance while paused instead of rendering a discarded moving warm-up.
  await page.clock.runFor(1400);
  const rows = [];
  for (const [seconds, phase] of [
    [12, "pull-ups"],
    [26, "rest"],
    [38, "dips"],
    [60, "dumbbell set"],
  ]) {
    // Compose at the gym while paused, then advance the actual rig. This
    // isolates camera/pose framing from an incidental journey out of study.
    await ui.locator("[data-world-activity]").selectOption("reading");
    await ui.locator("[data-world-activity]").selectOption("workout");
    await ui.locator("[data-world-pause]").click();
    await canvas.scrollIntoViewIfNeeded();
    await page.clock.runFor(100);
    await page.clock.fastForward(seconds * 1000 - 100);
    await page.clock.runFor(500);
    await ui.locator("[data-world-pause]").click();
    await canvas.scrollIntoViewIfNeeded();
    await page.clock.runFor(100);
    const pose = await evidence(scene);
    expect(pose.activityPhase).toBe(phase);
    expect(pose.cameraFov).toBe(44);
    const framed = await scene.evaluate(async (element, moduleUrl) => {
      const state = element.getSceneEvidence(),
        THREE = await import(moduleUrl),
        camera = new THREE.PerspectiveCamera(state.cameraFov, state.canvasWidth / state.canvasHeight, 0.05, 300);
      camera.position.fromArray(state.camera);
      camera.lookAt(new THREE.Vector3(...state.target));
      camera.updateMatrixWorld(true);
      return Object.fromEntries(
        ["Head", "HandL", "HandR", "FootL", "FootR"].map((name) => {
          const p = new THREE.Vector3(...state.joints[name]).project(camera);
          return [name, { x: (p.x + 1) / 2, y: (1 - p.y) / 2, depth: p.z }];
        })
      );
    }, publicRouteUrl("/assets/js/three.module.min.js"));
    for (const point of Object.values(framed)) {
      expect(point.x).toBeGreaterThan(0.075);
      expect(point.x).toBeLessThan(0.925);
      expect(point.y).toBeGreaterThan(0.075);
      expect(point.y).toBeLessThan(0.925);
      expect(point.depth).toBeLessThan(1);
    }
    const front = (pose.camera[2] - pose.joints.Head[2]) / Math.hypot(pose.camera[0] - pose.joints.Head[0], pose.camera[2] - pose.joints.Head[2]);
    expect(front).toBeGreaterThan(0.25);
    const image = await canvas.screenshot({ path: testInfo.outputPath(`gym-${phase.replaceAll(" ", "-")}.png`) });
    const metrics = screenshotMetrics(image);
    expect(metrics.uniqueColors).toBeGreaterThan(60);
    expect(metrics.luminanceVariance).toBeGreaterThan(80);
    rows.push({ seconds, phase, pose, framed });
  }
  const beforeDrag = await canvas.screenshot();
  const orbitRows = [{ key: "arrival", state: await evidence(scene) }];
  for (const key of [
    "ArrowLeft",
    "ArrowLeft",
    "ArrowLeft",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowLeft",
    "ArrowLeft",
    "ArrowLeft",
    "ArrowLeft",
    "ArrowLeft",
  ]) {
    await canvas.press(key);
    await page.clock.runFor(100);
    const state = await evidence(scene),
      previous = orbitRows.at(-1).state;
    expect(state.framePending).toBe(false);
    const displacement = Math.hypot(...state.camera.map((v, index) => v - previous.camera[index]));
    orbitRows.push({ key, displacement, state });
    fs.writeFileSync(testInfo.outputPath("gym-orbit-continuity.json"), JSON.stringify(orbitRows, null, 2));
    if (displacement >= 1.5) await canvas.screenshot({ path: testInfo.outputPath("gym-orbit-jump.png") });
    expect(displacement).toBeLessThan(1.5);
    if (orbitRows.length === 7) {
      expect(state.cameraOrbit.radius).toBeCloseTo(orbitRows[0].state.cameraOrbit.radius, 8);
      expect(state.cameraOrbit.yaw).toBeCloseTo(orbitRows[0].state.cameraOrbit.yaw, 8);
    }
  }
  await canvas.press("ArrowLeft");
  await page.clock.runFor(100);
  const afterDrag = await canvas.screenshot({ path: testInfo.outputPath("gym-orbit.png") });
  expect(screenshotDiffRatio(beforeDrag, afterDrag)).toBeGreaterThan(0.01);
  await ui.locator('[data-world-room="gym"]').click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(100);
  const beforeZoom = await canvas.screenshot();
  await canvas.press("+");
  await page.clock.runFor(100);
  const afterZoom = await canvas.screenshot({ path: testInfo.outputPath("gym-zoom.png") });
  expect(screenshotDiffRatio(beforeZoom, afterZoom)).toBeGreaterThan(0.01);
  await ui.locator('[data-world-room="study"]').click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(100);
  expect((await evidence(scene)).cameraFov).toBe(38);
  await page.locator("[data-world-view]").click();
  await page.clock.runFor(100);
  expect((await evidence(scene)).cameraFov).toBe(38);
  fs.writeFileSync(testInfo.outputPath("gym-framing.json"), JSON.stringify({ rows, errors }, null, 2));
  expect(errors).toEqual([]);
});

for (const activity of ["breakfast", "workout"]) {
  test(`coastal home: ${activity} choreography resumes through visibility and mode recovery`, async ({ page }, testInfo) => {
    // Linux takes 124 s for the original 2 s warm-up and 38–44 s per
    // 700 ms recovery sample. Retain all four modes and the 10 Hz frames.
    if (process.platform === "linux" || process.env.VISUAL_TRANSPORT_SOFTWARE === "1") test.setTimeout(600000);
    const errors = collectRuntimeErrors(page);
    const { scene, canvas, ui } = await openClockedHome(page, { time: "2026-10-02T11:45:00-07:00" });
    await explore(ui);
    await ui.locator("[data-world-avatar]").selectOption("ghibli");
    await settleAvatarLoad(ui);
    await expect(scene).toHaveAttribute("data-avatar", "ghibli");
    await ui.locator("[data-world-activity]").selectOption(activity);
    await canvas.scrollIntoViewIfNeeded();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.clock.runFor(2000);
    await page.clock.fastForward(activity === "breakfast" ? 43000 : 55000);
    await page.clock.runFor(700);
    const expectedPhase = activity === "breakfast" ? "coffee by the ocean" : "dumbbell set";
    await expect.poll(async () => (await evidence(scene)).activityPhase).toBe(expectedPhase);
    const before = await evidence(scene);
    await canvas.screenshot({ path: testInfo.outputPath("before-recovery.png") });
    const samples = [];
    for (const recovery of ["offscreen", "mode", "hidden", "retained"]) {
      const frozen = await evidence(scene);
      if (recovery === "offscreen") {
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
        await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
        await page.clock.runFor(1000);
        expect((await evidence(scene)).animationSeconds).toBe(frozen.animationSeconds);
        await canvas.scrollIntoViewIfNeeded();
      } else if (recovery === "mode") {
        await page.locator('[data-home-desk-mode="2d"]').click();
        await page.clock.runFor(1000);
        expect((await evidence(scene)).animationSeconds).toBe(frozen.animationSeconds);
        await page.locator('[data-home-desk-mode="3d"]').click();
        await canvas.scrollIntoViewIfNeeded();
      } else if (recovery === "hidden") {
        await page.evaluate(() => {
          Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await page.clock.runFor(1000);
        expect((await evidence(scene)).animationSeconds).toBe(frozen.animationSeconds);
        await page.evaluate(() => {
          delete document.hidden;
          document.dispatchEvent(new Event("visibilitychange"));
        });
      } else {
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
        await page.clock.runFor(1000);
        expect((await evidence(scene)).animationSeconds).toBe(frozen.animationSeconds);
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
      }
      await page.clock.runFor(700);
      const after = await evidence(scene);
      samples.push({ recovery, before: frozen, after });
      await canvas.screenshot({ path: testInfo.outputPath(`after-${recovery}.png`) });
      fs.writeFileSync(testInfo.outputPath("activity-continuity.json"), JSON.stringify({ activity, before, samples, errors }, null, 2));
      expect(after.activityPhase).toBe(expectedPhase);
      expect(after.activity).toBe(activity);
      expect(after.traveling).toBe(false);
      expect(after.animationSeconds - frozen.animationSeconds).toBeLessThan(1);
      expect(after.cupOwner).toBe(before.cupOwner);
      expect(after.weightOwner).toBe(before.weightOwner);
      expect(after.joints.Root).toEqual(before.joints.Root);
    }
    expect(errors).toEqual([]);
  });
}

for (const activity of ["breakfast", "workout"]) {
  test(`coastal home: pausing ${activity} keeps the held object and resumes its phase`, async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    const { scene, canvas, ui } = await openClockedHome(page, { time: "2026-10-02T11:45:00-07:00" });
    await explore(ui);
    await ui.locator("[data-world-avatar]").selectOption("ghibli");
    await settleAvatarLoad(ui);
    await expect(scene).toHaveAttribute("data-avatar", "ghibli");
    await ui.locator("[data-world-activity]").selectOption(activity);
    await canvas.scrollIntoViewIfNeeded();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.clock.runFor(2000);
    await page.clock.fastForward(activity === "breakfast" ? 43000 : 55000);
    await page.clock.runFor(700);
    const before = await evidence(scene);
    const key = activity === "breakfast" ? "cupPosition" : "weightPosition";
    const owner = activity === "breakfast" ? "cupOwner" : "weightOwner";
    expect(before[owner]).toBe("hand");
    await canvas.screenshot({ path: testInfo.outputPath("before-pause.png") });
    await ui.locator("[data-world-pause]").click();
    await canvas.scrollIntoViewIfNeeded();
    await page.clock.runFor(500);
    const paused = await evidence(scene);
    await canvas.screenshot({ path: testInfo.outputPath("paused.png") });
    fs.writeFileSync(testInfo.outputPath("held-object-pause.json"), JSON.stringify({ activity, before, paused, errors }, null, 2));
    expect(paused.activityPhase).toBe(before.activityPhase);
    expect(paused[owner]).toBe("hand");
    expect(paused[key]).toEqual(before[key]);
    expect(paused.joints.HandR).toEqual(before.joints.HandR);
    expect(paused.animationSeconds).toBe(before.animationSeconds);
    await ui.locator("[data-world-pause]").click();
    await canvas.scrollIntoViewIfNeeded();
    await page.clock.runFor(500);
    const resumed = await evidence(scene);
    fs.writeFileSync(testInfo.outputPath("held-object-pause.json"), JSON.stringify({ activity, before, paused, resumed, errors }, null, 2));
    expect(resumed.activityPhase).toBe(before.activityPhase);
    expect(resumed[owner]).toBe("hand");
    expect(resumed.animationSeconds - before.animationSeconds).toBeLessThan(0.6);
    expect(Math.hypot(...resumed[key].map((v, i) => v - resumed.joints.HandR[i]))).toBeLessThan(0.07);
    await ui.locator("[data-world-pause]").click();
    await ui.locator("[data-world-activity]").selectOption("reading");
    await canvas.scrollIntoViewIfNeeded();
    await page.clock.runFor(100);
    const composed = await evidence(scene);
    const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../assets/models/home/manifest.json"), "utf8"));
    const rest = activity === "breakfast" ? config.equipment.coffee.cup : config.equipment.dumbbell.rest;
    expect(composed.activity).toBe("reading");
    expect(composed[owner]).toBe(activity === "breakfast" ? "counter" : "rack");
    expect(composed[key]).toEqual(rest);
    fs.writeFileSync(testInfo.outputPath("held-object-pause.json"), JSON.stringify({ activity, before, paused, resumed, composed, errors }, null, 2));
    expect(errors).toEqual([]);
  });
}

test("coastal home: recovery preserves a stair journey and composes a changed clock activity", async ({ page }, testInfo) => {
  const errors = collectRuntimeErrors(page);
  const { scene, canvas } = await openClockedHome(page);
  await beginClockedMotion(page, canvas);
  await page.clock.setSystemTime(new Date("2026-09-11T18:15:01-07:00"));
  await page.clock.fastForward(30001);
  await expect(scene).toHaveAttribute("data-animation", "walk");
  await page.clock.runFor(100);
  let walking = await evidence(scene);
  for (let i = 0; i < 40 && !(walking.navigation?.position[1] > 0.45 && walking.navigation.position[1] < 2); i++) {
    await page.clock.fastForward(500);
    walking = await evidence(scene);
  }
  expect(walking.traveling).toBe(true);
  expect(walking.navigation.position[1]).toBeGreaterThan(0.45);
  expect(walking.navigation.position[1]).toBeLessThan(2);
  await explore(page.locator("[data-home-world-controls]"));
  await page.locator("[data-world-pause]").click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(1000);
  const pausedJourney = await evidence(scene);
  expect(pausedJourney.traveling).toBe(true);
  expect(pausedJourney.navigation.position).toEqual(walking.navigation.position);
  expect(pausedJourney.animationSeconds).toBe(walking.animationSeconds);
  await page.locator("[data-world-pause]").click();
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(100);
  walking = await evidence(scene);
  await canvas.screenshot({ path: testInfo.outputPath("before-stair-recovery.png") });
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
  await page.clock.runFor(1000);
  expect((await evidence(scene)).animationSeconds).toBe(walking.animationSeconds);
  await canvas.scrollIntoViewIfNeeded();
  await page.clock.runFor(100);
  const resumed = await evidence(scene);
  fs.writeFileSync(testInfo.outputPath("journey-continuity.json"), JSON.stringify({ walking, resumed }, null, 2));
  expect(resumed.traveling).toBe(true);
  expect(resumed.navigation.progress).toBeGreaterThanOrEqual(walking.navigation.progress);
  expect(resumed.navigation.progress - walking.navigation.progress).toBeLessThan(0.015);
  expect(Math.hypot(...resumed.navigation.position.map((value, i) => value - walking.navigation.position[i]))).toBeLessThan(0.3);
  await canvas.screenshot({ path: testInfo.outputPath("after-stair-recovery.png") });
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.setSystemTime(new Date("2026-09-11T19:00:01-07:00"));
  await page.clock.runFor(1000);
  expect((await evidence(scene)).animationSeconds).toBe(resumed.animationSeconds);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(100);
  const changed = await evidence(scene);
  fs.writeFileSync(testInfo.outputPath("journey-continuity.json"), JSON.stringify({ walking, resumed, changed, errors }, null, 2));
  expect(changed.activity).toBe("dinner");
  expect(changed.traveling).toBe(false);
  expect(changed.navigation).toBe(null);
  expect(changed.animation).toBe("eat");
  expect(Math.abs(changed.joints.Root[1])).toBeLessThan(0.1);
  expect(errors).toEqual([]);
});

test("coastal home: live animation pauses offscreen and recovers after a hidden tab", async ({ page }, testInfo) => {
  // The Linux phone trace spends 71/72 s on its two real pixel captures.
  // Retain those native frames and observation windows with a scoped budget.
  if (process.platform === "linux" || process.env.VISUAL_TRANSPORT_SOFTWARE === "1") test.setTimeout(600000);
  // Keep genuine live observation windows without fake RAF catch-up on a
  // slow renderer. Date/timers still support the original 30-second refresh.
  const { scene, canvas, ui } = await openHome(page, { motion: "reduce", nativeFrames: true });
  // A newly streamed room legitimately requests one still redraw while paused.
  // Settle those loads before using frame counts to detect ongoing animation.
  await settleRoomModels(scene);
  // Open the actual controls during preparation. Software draws must not
  // compete with disclosure/layout work inside the live observation window.
  await explore(ui);
  await canvas.scrollIntoViewIfNeeded();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(ui.locator("[data-world-pause]")).toBeEnabled();
  const before = await canvas.screenshot();
  await page.waitForTimeout(650);
  expect(screenshotDiffRatio(before, await canvas.screenshot())).toBeGreaterThan(0.0002);
  await ui.locator("[data-world-pause]").click();
  await expect(ui.locator("[data-world-pause]")).toHaveAttribute("aria-pressed", "true");
  await canvas.scrollIntoViewIfNeeded();
  // Pausing stops motion, but clock, layout, and companion updates can still
  // request a composed frame. Check the animation clock, then deliberately
  // cross the routine's 30-second refresh to prove a redraw stays still.
  await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
  const paused = await evidence(scene);
  await page.waitForTimeout(400);
  expect((await evidence(scene)).animationSeconds).toBe(paused.animationSeconds);
  await page.clock.fastForward(30000);
  await expect.poll(async () => (await evidence(scene)).frames).toBeGreaterThan(paused.frames);
  await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
  expect((await evidence(scene)).animationSeconds).toBe(paused.animationSeconds);
  await ui.locator("[data-world-pause]").click();
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await expect.poll(async () => canvas.evaluate((node) => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
  fs.writeFileSync(
    testInfo.outputPath("live-offscreen.json"),
    JSON.stringify(
      await scene.evaluate((element) => ({
        scene: element.getBoundingClientRect().toJSON(),
        canvas: element.querySelector("canvas").getBoundingClientRect().toJSON(),
        scrollY: window.scrollY,
        viewportHeight: window.innerHeight,
        evidence: element.getSceneEvidence(),
        frameClock: window.coastalProofFrameClock,
      })),
      null,
      2
    )
  );
  // Observe the newly scrolled viewport's actual paint before checking the
  // offscreen observer. Software headless can defer that rendering boundary.
  await page.screenshot({ path: testInfo.outputPath("live-offscreen-viewport.png") });
  await expect.poll(async () => (await evidence(scene)).framePending).toBe(false);
  const offscreen = (await evidence(scene)).frames;
  await page.waitForTimeout(350);
  expect((await evidence(scene)).frames).toBe(offscreen);
  await canvas.scrollIntoViewIfNeeded();
  // Exercise both Page Visibility branches. Headless windows do not reliably
  // become hidden when another page is brought forward.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hiddenFrames = (await evidence(scene)).frames;
  await page.waitForTimeout(350);
  expect((await evidence(scene)).frames).toBe(hiddenFrames);
  await page.clock.setSystemTime(new Date("2026-09-12T12:00:00-07:00"));
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(scene).toHaveAttribute("data-activity", "sleep");
  await expect.poll(async () => (await evidence(scene)).frames).toBeGreaterThan(hiddenFrames);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await expect.poll(async () => (await evidence(scene)).frames).toBeGreaterThan(hiddenFrames + 1);
});

test("coastal home: touch pinch zoom changes the projection and returns to Now", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "One Chromium touch context exercises the two-pointer path.");
  const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const view = await openClockedHome(page);
  const { scene, canvas, ui } = view;
  const session = await context.newCDPSession(page);
  const box = await canvas.boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const before = await canvas.screenshot();
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 25, y, id: 0 },
      { x: x + 25, y, id: 1 },
    ],
  });
  for (const spread of [35, 45, 60, 75]) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - spread, y, id: 0 },
        { x: x + spread, y, id: 1 },
      ],
    });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.clock.runFor(200);
  expect(screenshotDiffRatio(before, await canvas.screenshot())).toBeGreaterThan(0.02);
  expect((await evidence(scene)).following).toBe(false);
  await explore(ui);
  await sceneInputFrame(page, view, () => ui.locator("[data-world-now]").tap());
  expect((await evidence(scene)).following).toBe(true);
  await context.close();
});

for (const [failure, asset] of [
  ["mesh", "**/models/home/home-shell.glb"],
  ["decoder", "**/libs/draco/draco_decoder.wasm"],
]) {
  test(`coastal home: a failed ${failure} restores 2D and a retry creates one set of controls`, async ({ page }) => {
    await preparePage(page);
    await page.route(asset, (r) => r.abort());
    await page.goto(publicRouteUrl("/"));
    await page.locator('[data-home-desk-mode="3d"]').click();
    const stage = page.locator("[data-home-artifact-stage]");
    await expect(stage).toHaveAttribute("data-desk-mode", "2d");
    await expect(page.locator("#home-profile-image-container")).toBeVisible();
    await page.unroute(asset);
    await page.locator('[data-home-desk-mode="3d"]').click();
    await expect(page.locator("[data-home-desk-scene]")).toHaveAttribute("data-scene-state", "ready", { timeout: 30000 });
    await expect(page.locator("[data-world-avatar] option")).toHaveCount(5);
    await expect(page.locator("[data-world-room-list] button")).toHaveCount(6);
  });
}

test("coastal home: a routine boundary walks through the home before settling into the onsen", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Representative live transition; clock boundaries are covered separately.");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    recordVideo: { dir: testInfo.outputPath("native-video"), size: { width: 1440, height: 1000 } },
  });
  const page = await context.newPage();
  try {
    // Native frames keep this representative journey live. The Date refresh
    // jump must not advance the animation by thirty seconds before observation.
    const { scene, canvas, ui } = await openHome(page, { motion: "reduce", nativeFrames: true });
    await settleRoomModels(scene);
    // Set the actual overview camera before observing the short live journey,
    // so native walking/stair pixels include the actor as it changes floors.
    await explore(ui);
    await ui.locator('[data-world-room="overview"]').click();
    await canvas.scrollIntoViewIfNeeded();
    // Finish the real overview's initial shader/render work before the route
    // starts. Its preparation must not consume the short live walking phase.
    await canvas.screenshot({ path: testInfo.outputPath("journey-overview-ready.png") });
    // Date/timers wait for the explicit refresh; RAF/performance stay native.
    await pauseSceneClock(page, { advanceDate: false });
    // Stream all six real rooms and compose the actual overview before native
    // motion begins. Continuous software draws must not starve that setup.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(ui.locator("[data-world-pause]")).toBeEnabled();
    await scene.evaluate((element) => {
      const initial = element.getSceneEvidence(),
        deadline = performance.now() + 30000,
        proof = {
          samples: [],
          initialFrames: initial.frames,
          frameClock: window.coastalProofFrameClock,
          pixelEvidence: "Native browser video and original canvas screenshots",
        };
      window.coastalRoutineJourneyProof = proof;
      let observedFrame = initial.frames;
      function observe(now) {
        const state = element.getSceneEvidence();
        if (state.frames > observedFrame) {
          observedFrame = state.frames;
          const sample = {
            now,
            frames: state.frames,
            seconds: state.animationSeconds,
            animation: element.dataset.animation,
            navigation: state.navigation,
            root: state.joints.Root,
          };
          proof.samples.push(sample);
        }
        if (now < deadline && proof.samples.length < 2000) requestAnimationFrame(observe);
      }
      requestAnimationFrame(observe);
    });
    try {
      await page.clock.setSystemTime(new Date("2026-09-11T18:15:01-07:00"));
      // The actual DOM waiter starts before the short route is triggered.
      const walkingObserved = (async () => {
        await expect(scene).toHaveAttribute("data-animation", "walk");
      })();
      await Promise.all([walkingObserved, page.clock.fastForward(30001)]);
      await expect
        .poll(() =>
          page.evaluate(() =>
            window.coastalRoutineJourneyProof.samples.some((sample) => sample.animation === "walk" && sample.navigation?.progress > 0)
          )
        )
        .toBe(true);
      const first = await page.evaluate(() =>
        window.coastalRoutineJourneyProof.samples.find((sample) => sample.animation === "walk" && sample.navigation?.progress > 0)
      );
      const start = first.root;
      await page.waitForTimeout(600);
      await expect
        .poll(() =>
          page.evaluate(
            (since) => window.coastalRoutineJourneyProof.samples.some((sample) => sample.now >= since.now + 600 && sample.frames > since.frames),
            first
          )
        )
        .toBe(true);
      const moved = await page.evaluate(
        (since) => window.coastalRoutineJourneyProof.samples.find((sample) => sample.now >= since.now + 600 && sample.frames > since.frames).root,
        first
      );
      expect(Math.hypot(moved[0] - start[0], moved[2] - start[2])).toBeGreaterThan(0.1);
      await explore(ui);
      await ui.locator('[data-world-room="overview"]').click();
      await canvas.scrollIntoViewIfNeeded();
      await capture(testInfo, "walking-between-rooms", await canvas.screenshot());
      const climbSamples = [];
      try {
        await expect
          .poll(
            async () => {
              const sample = await evidence(scene);
              climbSamples.push({ frames: sample.frames, seconds: sample.animationSeconds, navigation: sample.navigation, root: sample.joints.Root });
              return sample.joints.Root[1];
            },
            { timeout: 25000 }
          )
          .toBeGreaterThan(0.5);
      } finally {
        await testInfo.attach("stair-timing", { body: JSON.stringify(climbSamples, null, 2), contentType: "application/json" });
      }
      await capture(testInfo, "walking-up-the-stair", await canvas.screenshot());
      await expect(scene).toHaveAttribute("data-animation", "soak", { timeout: 18000 });
      const soaked = await evidence(scene);
      expect(soaked.joints.Root[1] - soaked.activityFloor).toBeLessThan(-0.4);
      expect(soaked.activityFloor).toBe(2.6);
    } finally {
      const proof = await page.evaluate(() => window.coastalRoutineJourneyProof);
      fs.writeFileSync(testInfo.outputPath("native-journey-frames.json"), JSON.stringify({ ...proof, performanceBenchmark: false }, null, 2));
    }
  } finally {
    await context.close();
    await testInfo.attach("native-journey-video", { path: await page.video().path(), contentType: "video/webm" });
  }
});
