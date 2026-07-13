const { test, expect } = require("@playwright/test");
const fs = require("fs/promises");
const { attachScreenshot, collectRuntimeErrors, preparePage, screenshotDiffRatio, screenshotMetrics, stabilizeVisuals } = require("./helpers");
const { DESK_ROUTE, publicRouteUrl } = require("./public-routes");

async function openDeskHome(page, theme = "light") {
  await preparePage(page, theme);
  const response = await page.goto(publicRouteUrl(DESK_ROUTE.path), { waitUntil: "domcontentloaded" });

  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await expect(page.locator("#home-title")).toBeVisible();
  await expect(page.locator("[data-home-artifact-stage]")).toHaveAttribute("data-desk-mode", "2d");
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await stabilizeVisuals(page);
  await page.waitForTimeout(350);
}

async function switchTo3D(page) {
  const stage = page.locator("[data-home-artifact-stage]");
  await page.locator('[data-home-desk-mode="3d"]').click();
  await expect(stage).toHaveAttribute("data-desk-mode", "3d");

  const canvas = page.locator(".home-desk-corner-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.locator("[data-home-desk-controls]")).toBeVisible();
  await expect(page.locator("[data-home-desk-note]")).toBeVisible();

  await expect
    .poll(async () => {
      const metrics = screenshotMetrics(await canvas.screenshot());
      return metrics.uniqueColors > 32 && metrics.luminanceVariance > 20 && metrics.opaqueRatio > 0.9;
    })
    .toBe(true);

  return { canvas, stage };
}

async function dragCanvas(page, canvas) {
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const startX = box.x + box.width * 0.18;
  const startY = box.y + box.height * 0.08;
  const endX = box.x + box.width * 0.48;
  const endY = startY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(650);
}

async function zoomCanvas(page, canvas) {
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const coarsePointer = await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches);
  if (coarsePointer) {
    await canvas.dispatchEvent("wheel", { deltaY: -900, deltaMode: 0 });
  } else {
    await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.52);
    await page.mouse.wheel(0, -900);
  }
  await page.waitForTimeout(550);
}

async function orbitCanvas(page, canvas, fromXRatio = 0.18, toXRatio = 0.82) {
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const y = box.y + box.height * 0.08;
  await page.mouse.move(box.x + box.width * fromXRatio, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * toXRatio, y, { steps: 18 });
  await page.mouse.up();
  await page.waitForTimeout(620);
}

async function shakeCurrentRecord(page) {
  const portrait = page.locator("#home-profile-image-container");
  await expect(portrait).toBeVisible();
  await portrait.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const pointerId = 817;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const originalCapture = element.setPointerCapture;
    element.setPointerCapture = () => {};
    const dispatchPointer = (type, x, buttons = 1) => {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId,
          pointerType: "touch",
          clientX: x,
          clientY: centerY + 2,
          button: type === "pointerdown" ? 0 : -1,
          buttons,
        })
      );
    };
    dispatchPointer("pointerdown", centerX);
    [42, -42, 46, -46, 48, -48].forEach((offset) => dispatchPointer("pointermove", centerX + offset));
    dispatchPointer("pointerup", centerX, 0);
    element.setPointerCapture = originalCapture;
  });
}

async function dropRecordCardsUntil(page, expectedCount) {
  const cards = page.locator("[data-home-record-card]");
  for (let attempt = 0; attempt < 6 && (await cards.count()) < expectedCount; attempt += 1) {
    await shakeCurrentRecord(page);
    await page.waitForTimeout(980);
  }
  await expect(cards).toHaveCount(expectedCount);
}

async function clickCanvas(page, canvas, xRatio, yRatio) {
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const coarsePointer = await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches);
  if (coarsePointer) {
    await canvas.tap({ position: { x: box.width * xRatio, y: box.height * yRatio } });
  } else {
    await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
  }
}

async function clickProjectedSceneTarget(page, canvas, sceneContainer, boundsAttribute) {
  await expect(sceneContainer).toHaveAttribute(boundsAttribute, /^\{/);
  const bounds = JSON.parse((await sceneContainer.getAttribute(boundsAttribute)) || "{}");
  const xRatio = (bounds.left + bounds.right) / 2;
  const yRatio = bounds.top + (bounds.bottom - bounds.top) * 0.18;
  expect(xRatio, `${boundsAttribute} center should stay inside the canvas`).toBeGreaterThan(0);
  expect(xRatio, `${boundsAttribute} center should stay inside the canvas`).toBeLessThan(1);
  expect(yRatio, `${boundsAttribute} center should stay inside the canvas`).toBeGreaterThan(0);
  expect(yRatio, `${boundsAttribute} center should stay inside the canvas`).toBeLessThan(1);
  await clickCanvas(page, canvas, xRatio, yRatio);
}

async function expectDroppedEvidenceClearOfControls(page, sceneContainer, canvas, controls) {
  await expect(sceneContainer).toHaveAttribute("data-dropped-screen-bounds", /\[/);
  const evidence = JSON.parse((await sceneContainer.getAttribute("data-dropped-screen-bounds")) || "[]");
  const canvasBox = await canvas.boundingBox();
  const controlsBox = await controls.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(controlsBox).not.toBeNull();
  expect(evidence.length).toBeGreaterThan(0);

  evidence.forEach((item) => {
    ["album", "card"].forEach((kind) => {
      const bounds = item[kind];
      expect(bounds, `${kind} ${item.index} should expose its rendered projection`).not.toBeNull();
      const projected = {
        left: canvasBox.x + bounds.left * canvasBox.width,
        top: canvasBox.y + bounds.top * canvasBox.height,
        right: canvasBox.x + bounds.right * canvasBox.width,
        bottom: canvasBox.y + bounds.bottom * canvasBox.height,
      };
      const overlapsControls =
        projected.right > controlsBox.x - 4 &&
        projected.left < controlsBox.x + controlsBox.width + 4 &&
        projected.bottom > controlsBox.y - 4 &&
        projected.top < controlsBox.y + controlsBox.height + 4;
      expect(
        overlapsControls,
        `${kind} ${item.index} should settle clear of the control strip; projected=${JSON.stringify(projected)} controls=${JSON.stringify(controlsBox)}`
      ).toBe(false);
    });
  });
}

async function attachBuffer(testInfo, name, body, contentType = "image/png") {
  const extension = contentType === "application/json" ? "json" : "png";
  const outputPath = testInfo.outputPath(`${name.replace(/[^a-z0-9._-]+/gi, "-")}.${extension}`);
  await fs.writeFile(outputPath, body);
  await testInfo.attach(name, { path: outputPath, contentType });
}

test("desk scene 2D and 3D defaults react to drag and zoom", async ({ page }, testInfo) => {
  if (testInfo.project.name === "desktop-1440") {
    await page.addInitScript(() => {
      Object.defineProperty(window, "devicePixelRatio", {
        configurable: true,
        get: () => 3,
      });
    });
  }
  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page);

  const stage = page.locator("[data-home-artifact-stage]");
  await expect(page.locator('[data-home-desk-mode="2d"]')).toHaveAttribute("aria-pressed", "true");
  await attachScreenshot(page, testInfo, `desk-2d-default-${testInfo.project.name}`, { locator: stage });

  const scene = await switchTo3D(page);
  await expect(page.locator('[data-home-desk-mode="3d"]')).toHaveAttribute("aria-pressed", "true");
  await attachScreenshot(page, testInfo, `desk-3d-default-${testInfo.project.name}`, { locator: scene.stage });

  const defaultCanvas = await scene.canvas.screenshot();
  const defaultMetrics = screenshotMetrics(defaultCanvas);
  expect(defaultMetrics.uniqueColors).toBeGreaterThan(32);
  expect(defaultMetrics.luminanceVariance).toBeGreaterThan(20);

  if (testInfo.project.name === "desktop-1440") {
    const bufferScale = await scene.canvas.evaluate((canvas) => ({
      dpr: window.devicePixelRatio,
      heightRatio: canvas.height / canvas.clientHeight,
      widthRatio: canvas.width / canvas.clientWidth,
    }));
    expect(bufferScale.dpr).toBe(3);
    expect(bufferScale.widthRatio).toBeGreaterThan(1.9);
    expect(bufferScale.widthRatio).toBeLessThanOrEqual(2.02);
    expect(bufferScale.heightRatio).toBeGreaterThan(1.9);
    expect(bufferScale.heightRatio).toBeLessThanOrEqual(2.02);
  }

  await dragCanvas(page, scene.canvas);
  const draggedCanvas = await scene.canvas.screenshot();
  const dragDifference = screenshotDiffRatio(draggedCanvas, defaultCanvas);
  expect(dragDifference, "dragging the room should visibly change rendered pixels").toBeGreaterThan(0.002);
  await attachBuffer(testInfo, `desk-3d-dragged-${testInfo.project.name}`, draggedCanvas);

  await zoomCanvas(page, scene.canvas);
  const zoomedCanvas = await scene.canvas.screenshot();
  const zoomDifference = screenshotDiffRatio(zoomedCanvas, draggedCanvas);
  expect(zoomDifference, "zooming the room should visibly change rendered pixels").toBeGreaterThan(0.002);
  await attachBuffer(testInfo, `desk-3d-zoomed-${testInfo.project.name}`, zoomedCanvas);

  await attachBuffer(
    testInfo,
    `desk-render-metrics-${testInfo.project.name}`,
    Buffer.from(JSON.stringify({ defaultMetrics, dragDifference, zoomDifference }, null, 2)),
    "application/json"
  );

  if (testInfo.project.name === "mobile-390") {
    const controls = page.locator("[data-home-desk-controls]");
    const note = page.locator("[data-home-desk-note]");
    const [stageBox, controlsBox, noteBox] = await Promise.all([stage.boundingBox(), controls.boundingBox(), note.boundingBox()]);

    expect(stageBox).not.toBeNull();
    expect(controlsBox).not.toBeNull();
    expect(noteBox).not.toBeNull();

    const controlsRight = controlsBox.x + controlsBox.width;
    const controlsBottom = controlsBox.y + controlsBox.height;
    const noteRight = noteBox.x + noteBox.width;
    const noteBottom = noteBox.y + noteBox.height;
    const stageRight = stageBox.x + stageBox.width;
    const overlapWidth = Math.max(0, Math.min(controlsRight, noteRight) - Math.max(controlsBox.x, noteBox.x));
    const overlapHeight = Math.max(0, Math.min(controlsBottom, noteBottom) - Math.max(controlsBox.y, noteBox.y));
    expect(overlapWidth * overlapHeight, "mobile usage note and control strip should not overlap").toBeLessThanOrEqual(1);
    expect(controlsBox.x).toBeGreaterThanOrEqual(stageBox.x - 1);
    expect(controlsRight).toBeLessThanOrEqual(stageRight + 1);
    expect(noteBox.x).toBeGreaterThanOrEqual(stageBox.x - 1);
    expect(noteRight).toBeLessThanOrEqual(stageRight + 1);
  }

  expect(runtimeErrors, "desk default/drag/zoom states raised browser runtime errors").toEqual([]);
});

test("desk scene reduced-motion mode keeps a visible still composition", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(testInfo.project.name), "representative reduced-motion viewports");

  const runtimeErrors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openDeskHome(page);
  expect(await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

  await dropRecordCardsUntil(page, 1);
  const reducedMotionCard = page.locator("[data-home-record-card]").first();
  await expect(reducedMotionCard).not.toHaveClass(/is-dropping|is-settling/);
  await expect(page.locator(".home-record-card-pile")).toHaveClass(/has-ground-shadow/);

  const scene = await switchTo3D(page);
  const buffer = await scene.canvas.screenshot();
  const metrics = screenshotMetrics(buffer);
  expect(metrics.uniqueColors).toBeGreaterThan(32);
  expect(metrics.luminanceVariance).toBeGreaterThan(20);
  await attachScreenshot(page, testInfo, `desk-3d-reduced-motion-${testInfo.project.name}`, { locator: scene.stage });
  expect(runtimeErrors, "desk reduced-motion state raised browser runtime errors").toEqual([]);
});

test("desk mode switch keeps a visible keyboard focus ring", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "representative keyboard-focus checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page);

  const twoDimensionalToggle = page.locator('[data-home-desk-mode="2d"]');
  const threeDimensionalToggle = page.locator('[data-home-desk-mode="3d"]');
  await twoDimensionalToggle.focus();
  await page.keyboard.press("Tab");
  await expect(threeDimensionalToggle).toBeFocused();

  const focusState = await threeDimensionalToggle.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      boxShadow: style.boxShadow,
      focusVisible: element.matches(":focus-visible"),
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth) || 0,
    };
  });

  expect(focusState.focusVisible).toBe(true);
  expect((focusState.outlineStyle !== "none" && focusState.outlineWidth >= 2) || focusState.boxShadow !== "none").toBe(true);

  await shakeCurrentRecord(page);
  const playButton = page.locator("[data-home-record-play]");
  await expect(playButton).toHaveCSS("pointer-events", "auto");
  await playButton.focus();
  await page.keyboard.press("Space");
  await expect(playButton).toHaveAttribute("aria-pressed", "true");

  const scene = await switchTo3D(page);
  const sceneContainer = page.locator("[data-home-desk-scene]");
  await clickProjectedSceneTarget(page, scene.canvas, sceneContainer, "data-window-screen-bounds");
  await expect(sceneContainer).toHaveAttribute("data-last-raycast-kind", "windowJump");
  await expect(sceneContainer).toHaveClass(/is-outside-view/);
  await page.keyboard.press("Escape");
  await expect(sceneContainer).not.toHaveClass(/is-outside-view/);
  await expect(page.locator('[data-home-desk-control="reset"]')).toBeFocused();
  expect(runtimeErrors, "desk mode keyboard focus raised browser runtime errors").toEqual([]);
});

test("offscreen desk animation idles and resumes without losing spin state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "representative offscreen-animation checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page);
  const scene = await switchTo3D(page);
  const spinControl = page.locator('[data-home-desk-control="spin"]');
  if ((await spinControl.getAttribute("aria-pressed")) !== "true") await spinControl.click();
  await expect(spinControl).toHaveAttribute("aria-pressed", "true");

  const visibleFrame = await scene.canvas.evaluate((canvas) => canvas.toDataURL("image/png"));
  await expect.poll(async () => (await scene.canvas.evaluate((canvas) => canvas.toDataURL("image/png"))) !== visibleFrame).toBe(true);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect
    .poll(async () => {
      const rect = await scene.stage.boundingBox();
      return Boolean(rect && rect.y + rect.height < -120);
    })
    .toBe(true);
  await expect(page.locator("[data-home-desk-scene]")).toHaveAttribute("data-desk-scene-in-viewport", "false");

  await page.waitForTimeout(320);
  const offscreenFrame = await scene.canvas.evaluate((canvas) => canvas.toDataURL("image/png"));
  await page.waitForTimeout(320);
  const laterOffscreenFrame = await scene.canvas.evaluate((canvas) => canvas.toDataURL("image/png"));
  expect(laterOffscreenFrame).toBe(offscreenFrame);
  await expect(spinControl).toHaveAttribute("aria-pressed", "true");

  await scene.stage.scrollIntoViewIfNeeded();
  await expect(page.locator("[data-home-desk-scene]")).toHaveAttribute("data-desk-scene-in-viewport", "true");
  const returnedFrame = await scene.canvas.evaluate((canvas) => canvas.toDataURL("image/png"));
  await expect.poll(async () => (await scene.canvas.evaluate((canvas) => canvas.toDataURL("image/png"))) !== returnedFrame).toBe(true);
  expect(runtimeErrors, "desk offscreen idle/resume raised browser runtime errors").toEqual([]);
});

test("mobile coarse-pointer controls work through touch input", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "touch-specific mobile checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page);
  expect(await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)).toBe(true);

  const stage = page.locator("[data-home-artifact-stage]");
  const threeDimensionalToggle = page.locator('[data-home-desk-mode="3d"]');
  await threeDimensionalToggle.tap();
  await expect(stage).toHaveAttribute("data-desk-mode", "3d");
  await expect(threeDimensionalToggle).toHaveAttribute("aria-pressed", "true");

  const spinControl = page.locator('[data-home-desk-control="spin"]');
  const spinState = await spinControl.getAttribute("aria-pressed");
  await spinControl.tap();
  await expect(spinControl).toHaveAttribute("aria-pressed", spinState === "true" ? "false" : "true");

  const twoDimensionalToggle = page.locator('[data-home-desk-mode="2d"]');
  await twoDimensionalToggle.tap();
  await expect(stage).toHaveAttribute("data-desk-mode", "2d");
  await expect(twoDimensionalToggle).toHaveAttribute("aria-pressed", "true");
  expect(runtimeErrors, "touch-driven desk controls raised browser runtime errors").toEqual([]);
});

test("compact desk scene preserves the cliff window anchor and return path", async ({ page }, testInfo) => {
  test.skip(!["tablet-768", "mobile-390"].includes(testInfo.project.name), "compact outside-view checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page);
  const scene = await switchTo3D(page);
  const sceneContainer = page.locator("[data-home-desk-scene]");
  await expect(sceneContainer).toHaveAttribute("data-album-screen-bounds", /^\[/);
  const compactAlbumEvidence = JSON.parse((await sceneContainer.getAttribute("data-album-screen-bounds")) || "[]");
  expect(compactAlbumEvidence).toHaveLength(4);
  compactAlbumEvidence.forEach((entry) => {
    expect(entry.rackPoint?.x, `album ${entry.index} should remain inside the compact canvas`).toBeGreaterThan(0.02);
    expect(entry.rackPoint?.x, `album ${entry.index} should remain inside the compact canvas`).toBeLessThan(0.98);
  });
  await attachScreenshot(page, testInfo, `desk-continuity-interior-default-${testInfo.project.name}`, { locator: scene.stage });

  await clickProjectedSceneTarget(page, scene.canvas, sceneContainer, "data-window-screen-bounds");
  await expect(sceneContainer).toHaveAttribute("data-last-raycast-kind", "windowJump");
  await expect(sceneContainer).toHaveClass(/is-outside-view/);
  const outsideDefault = await scene.canvas.screenshot();
  await attachScreenshot(page, testInfo, `desk-continuity-outside-default-${testInfo.project.name}`, { locator: scene.stage });

  await zoomCanvas(page, scene.canvas);
  const outsideZoomed = await scene.canvas.screenshot();
  expect(screenshotDiffRatio(outsideZoomed, outsideDefault), "compact outside zoom should visibly change the cliff room").toBeGreaterThan(0.001);
  await expect(page.locator("[data-home-desk-controls]")).toBeVisible();
  await expect(page.locator("[data-home-desk-note]")).toBeVisible();
  await attachScreenshot(page, testInfo, `desk-continuity-outside-max-zoom-${testInfo.project.name}`, { locator: scene.stage });

  await clickProjectedSceneTarget(page, scene.canvas, sceneContainer, "data-return-screen-bounds");
  await expect(sceneContainer).toHaveAttribute("data-last-raycast-kind", "returnInside");
  await expect(sceneContainer).not.toHaveClass(/is-outside-view/);
  await attachScreenshot(page, testInfo, `desk-continuity-returned-interior-${testInfo.project.name}`, { locator: scene.stage });
  expect(runtimeErrors, "compact outside/return states raised browser runtime errors").toEqual([]);
});

test("desktop desk scene enters outside only by window click and returns", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "desktop window hit-zone checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page);
  const scene = await switchTo3D(page);
  const sceneContainer = page.locator("[data-home-desk-scene]");
  const interiorDefault = await scene.canvas.screenshot();
  await attachScreenshot(page, testInfo, "desk-continuity-interior-default-desktop-1440", { locator: scene.stage });

  await orbitCanvas(page, scene.canvas);
  const interiorSide = await scene.canvas.screenshot();
  expect(screenshotDiffRatio(interiorSide, interiorDefault), "side-look should visibly change the interior").toBeGreaterThan(0.002);
  expect(Number(await sceneContainer.getAttribute("data-camera-yaw"))).toBeGreaterThan(0.7);
  await expect(page.locator("[data-home-desk-scene]")).not.toHaveClass(/is-outside-view/);
  await attachScreenshot(page, testInfo, "desk-continuity-interior-side-desktop-1440", { locator: scene.stage });

  await orbitCanvas(page, scene.canvas);
  await orbitCanvas(page, scene.canvas);
  const interiorRear = await scene.canvas.screenshot();
  expect(screenshotDiffRatio(interiorRear, interiorSide), "rear-look should visibly change the interior").toBeGreaterThan(0.002);
  const rearYaw = Number(await sceneContainer.getAttribute("data-camera-yaw"));
  expect(rearYaw).toBeGreaterThan(Math.PI * 0.62);
  expect(rearYaw).toBeLessThan(Math.PI * 1.38);
  await expect(page.locator("[data-home-desk-scene]")).not.toHaveClass(/is-outside-view/);
  await attachScreenshot(page, testInfo, "desk-continuity-interior-rear-desktop-1440", { locator: scene.stage });

  await clickCanvas(page, scene.canvas, 0.78, 0.34);
  await expect(sceneContainer).not.toHaveAttribute("data-last-raycast-kind", "windowJump");
  await expect(sceneContainer).not.toHaveClass(/is-outside-view/);

  await page.locator('[data-home-desk-control="reset"]').click();
  await page.waitForTimeout(520);

  await clickProjectedSceneTarget(page, scene.canvas, sceneContainer, "data-window-screen-bounds");
  await expect(sceneContainer).toHaveAttribute("data-last-raycast-kind", "windowJump");
  await expect(page.locator("html")).toHaveClass(/home-desk-outside-active/);
  await expect(page.locator("[data-home-desk-scene]")).toHaveClass(/is-outside-view/);
  await page.waitForTimeout(500);
  const outsideDefaultDistance = Number(await sceneContainer.getAttribute("data-camera-distance"));
  expect(outsideDefaultDistance).toBeGreaterThan(0);
  const outsideDefault = await scene.canvas.screenshot();
  await attachScreenshot(page, testInfo, "desk-3d-outside-desktop-1440", { locator: scene.stage });
  await attachScreenshot(page, testInfo, "desk-continuity-outside-default-desktop-1440", { locator: scene.stage });

  await orbitCanvas(page, scene.canvas);
  const outsideDragged = await scene.canvas.screenshot();
  expect(screenshotDiffRatio(outsideDragged, outsideDefault), "outside orbit should visibly change the cliff room").toBeGreaterThan(0.002);
  await expect(page.locator("[data-home-desk-scene]")).toHaveClass(/is-outside-view/);
  await attachScreenshot(page, testInfo, "desk-continuity-outside-dragged-desktop-1440", { locator: scene.stage });

  for (let step = 0; step < 3; step += 1) await orbitCanvas(page, scene.canvas);
  const outsideRearYaw = Number(await sceneContainer.getAttribute("data-camera-yaw"));
  expect(outsideRearYaw).toBeGreaterThan(Math.PI * 0.62);
  expect(outsideRearYaw).toBeLessThan(Math.PI * 1.38);
  const outsideRearDistance = Number(await sceneContainer.getAttribute("data-camera-distance"));
  expect(outsideRearDistance).toBeGreaterThan(outsideDefaultDistance * 1.28);
  const outsideRear = await scene.canvas.screenshot();
  const outsideRearMetrics = screenshotMetrics(outsideRear);
  expect(outsideRearMetrics.uniqueColors).toBeGreaterThan(32);
  expect(outsideRearMetrics.luminanceVariance).toBeGreaterThan(16);
  await attachScreenshot(page, testInfo, "desk-continuity-outside-rear-desktop-1440", { locator: scene.stage });

  for (let step = 0; step < 3; step += 1) await orbitCanvas(page, scene.canvas, 0.82, 0.18);

  await zoomCanvas(page, scene.canvas);
  const outsideZoomed = await scene.canvas.screenshot();
  expect(screenshotDiffRatio(outsideZoomed, outsideDragged), "outside zoom should visibly change the cliff room").toBeGreaterThan(0.002);
  await expect(page.locator("[data-home-desk-scene]")).toHaveClass(/is-outside-view/);
  await attachScreenshot(page, testInfo, "desk-continuity-outside-max-zoom-desktop-1440", { locator: scene.stage });

  await clickProjectedSceneTarget(page, scene.canvas, sceneContainer, "data-return-screen-bounds");
  await expect(sceneContainer).toHaveAttribute("data-last-raycast-kind", "returnInside");
  await expect(page.locator("html")).not.toHaveClass(/home-desk-outside-active/);
  await expect(page.locator("[data-home-desk-scene]")).not.toHaveClass(/is-outside-view/);
  await page.waitForTimeout(400);
  await attachScreenshot(page, testInfo, "desk-3d-returned-desktop-1440", { locator: scene.stage });
  await attachScreenshot(page, testInfo, "desk-continuity-returned-interior-desktop-1440", { locator: scene.stage });
  expect(runtimeErrors, "desk outside/return states raised browser runtime errors").toEqual([]);
});

test("desk modes retain record identity, spin, and discovery order", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "representative shared-state and grounding checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page);
  const stage = page.locator("[data-home-artifact-stage]");
  const cards = page.locator("[data-home-record-card]");

  await dropRecordCardsUntil(page, 1);
  await dropRecordCardsUntil(page, 2);
  const portrait = page.locator("#home-profile-image-container");
  const playButton = page.locator("[data-home-record-play]");
  await expect(portrait).toHaveClass(/is-vinyl-preview/);
  await expect(playButton).toHaveCSS("pointer-events", "auto");
  await playButton.click();
  await expect(playButton).toHaveAttribute("aria-pressed", "true");
  await expect(stage).toHaveAttribute("data-dropped-records", "0,1");
  const recordTone = await stage.getAttribute("data-record-tone");
  const initialOrder = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-record-index")).join(","));
  await attachScreenshot(page, testInfo, "desk-shared-state-2d-before-desktop-1440", { locator: stage });

  const scene = await switchTo3D(page);
  await page.waitForTimeout(1050);
  await expect(stage).toHaveAttribute("data-record-tone", recordTone);
  await expect(stage).toHaveAttribute("data-dropped-records", "0,1");
  await expect(page.locator('[data-home-desk-control="spin"]')).toHaveAttribute("aria-pressed", "true");
  const sceneContainer = page.locator("[data-home-desk-scene]");
  await expect(sceneContainer).toHaveAttribute("data-scene-active-record", "2");
  await expect(sceneContainer).toHaveAttribute("data-scene-dropped-records", "0,1");
  await expect(sceneContainer).not.toHaveAttribute("data-focused-desk-object", /.+/);
  await attachScreenshot(page, testInfo, "desk-shared-state-3d-grounded-desktop-1440", { locator: scene.stage });

  await page.locator('[data-home-desk-mode="2d"]').click();
  await expect(stage).toHaveAttribute("data-desk-mode", "2d");
  await expect(stage).toHaveAttribute("data-record-tone", recordTone);
  await expect(stage).toHaveAttribute("data-dropped-records", "0,1");
  await expect(cards).toHaveCount(2);
  expect(await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-record-index")).join(","))).toBe(initialOrder);
  await attachScreenshot(page, testInfo, "desk-shared-state-2d-returned-desktop-1440", { locator: stage });
  expect(runtimeErrors, "desk shared-state journey raised browser runtime errors").toEqual([]);
});

test("four discovered albums settle in a control-safe 3D fan", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "representative four-card landing checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page);
  await dropRecordCardsUntil(page, 4);
  await expect(page.locator("[data-home-artifact-stage]")).toHaveAttribute("data-dropped-records", "0,1,2,3");

  const scene = await switchTo3D(page);
  const sceneContainer = page.locator("[data-home-desk-scene]");
  const controls = page.locator("[data-home-desk-controls]");
  await page.waitForTimeout(1050);
  await expect(sceneContainer).toHaveAttribute("data-scene-dropped-records", "0,1,2,3");
  await expectDroppedEvidenceClearOfControls(page, sceneContainer, scene.canvas, controls);
  await attachScreenshot(page, testInfo, "desk-four-card-control-safe-desktop-1440", { locator: scene.stage });
  expect(runtimeErrors, "four-card 3D landing raised browser runtime errors").toEqual([]);
});

test("dark desk materials preserve interior, floor evidence, and cliff hierarchy", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "representative dark-material checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await dropRecordCardsUntil(page, 1);
  const scene = await switchTo3D(page);
  const interior = await scene.canvas.screenshot();
  const interiorMetrics = screenshotMetrics(interior);
  expect(interiorMetrics.uniqueColors).toBeGreaterThan(32);
  expect(interiorMetrics.luminanceVariance).toBeGreaterThan(16);
  await attachScreenshot(page, testInfo, "desk-dark-interior-grounded-desktop-1440", { locator: scene.stage });

  const sceneContainer = page.locator("[data-home-desk-scene]");
  await clickProjectedSceneTarget(page, scene.canvas, sceneContainer, "data-window-screen-bounds");
  await expect(sceneContainer).toHaveAttribute("data-last-raycast-kind", "windowJump");
  await expect(sceneContainer).toHaveClass(/is-outside-view/);
  const outside = await scene.canvas.screenshot();
  const outsideMetrics = screenshotMetrics(outside);
  expect(outsideMetrics.uniqueColors).toBeGreaterThan(32);
  expect(outsideMetrics.luminanceVariance).toBeGreaterThan(16);
  await attachScreenshot(page, testInfo, "desk-dark-outside-desktop-1440", { locator: scene.stage });
  expect(runtimeErrors, "dark desk material states raised browser runtime errors").toEqual([]);
});
