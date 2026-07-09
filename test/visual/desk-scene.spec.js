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

  const startX = box.x + box.width * 0.62;
  const startY = box.y + box.height * 0.55;
  const endX = box.x + box.width * 0.34;
  const endY = box.y + box.height * 0.46;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(650);
}

async function zoomCanvas(page, canvas) {
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.52);
  await page.mouse.wheel(0, -900);
  await page.waitForTimeout(550);
}

async function clickCanvas(page, canvas, xRatio, yRatio) {
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
}

async function attachBuffer(testInfo, name, body, contentType = "image/png") {
  const extension = contentType === "application/json" ? "json" : "png";
  const outputPath = testInfo.outputPath(`${name.replace(/[^a-z0-9._-]+/gi, "-")}.${extension}`);
  await fs.writeFile(outputPath, body);
  await testInfo.attach(name, { path: outputPath, contentType });
}

test("desk scene 2D and 3D defaults react to drag and zoom", async ({ page }, testInfo) => {
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

  const scene = await switchTo3D(page);
  const buffer = await scene.canvas.screenshot();
  const metrics = screenshotMetrics(buffer);
  expect(metrics.uniqueColors).toBeGreaterThan(32);
  expect(metrics.luminanceVariance).toBeGreaterThan(20);
  await attachScreenshot(page, testInfo, `desk-3d-reduced-motion-${testInfo.project.name}`, { locator: scene.stage });
  expect(runtimeErrors, "desk reduced-motion state raised browser runtime errors").toEqual([]);
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

test("desktop desk scene enters outside only by window click and returns", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "desktop window hit-zone checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page);
  const scene = await switchTo3D(page);

  await clickCanvas(page, scene.canvas, 0.78, 0.34);
  await expect(page.locator("html")).toHaveClass(/home-desk-outside-active/);
  await expect(page.locator("[data-home-desk-scene]")).toHaveClass(/is-outside-view/);
  await page.waitForTimeout(500);
  await attachScreenshot(page, testInfo, "desk-3d-outside-desktop-1440", { locator: scene.stage });

  await clickCanvas(page, scene.canvas, 0.5, 0.46);
  await expect(page.locator("html")).not.toHaveClass(/home-desk-outside-active/);
  await expect(page.locator("[data-home-desk-scene]")).not.toHaveClass(/is-outside-view/);
  await page.waitForTimeout(400);
  await attachScreenshot(page, testInfo, "desk-3d-returned-desktop-1440", { locator: scene.stage });
  expect(runtimeErrors, "desk outside/return states raised browser runtime errors").toEqual([]);
});
