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

async function readCanvasBuffer(canvas) {
  const dataUrl = await canvas.evaluate((element) => element.toDataURL("image/png"));
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
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

async function pitchCanvas(page, canvas, fromYRatio = 0.18, toYRatio = 0.44) {
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const x = box.x + box.width * 0.92;
  await page.mouse.move(x, box.y + box.height * fromYRatio);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height * toYRatio, { steps: 18 });
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
  // Locator screenshots can leave the scene above the viewport; normalize it
  // before converting projected scene ratios into absolute mouse coordinates.
  await canvas.scrollIntoViewIfNeeded();
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
  await requestFreshSceneEvidence(sceneContainer);
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

async function getAlbumScenePoint(sceneContainer, index, targetKey) {
  await requestFreshSceneEvidence(sceneContainer);
  const evidence = JSON.parse((await sceneContainer.getAttribute("data-album-screen-bounds")) || "[]");
  const point = evidence.find((entry) => entry.index === index)?.[targetKey] || null;
  expect(point, `album ${index} should expose ${targetKey}`).toBeTruthy();
  return point;
}

async function dragCanvasWithTouch(canvas, from, to) {
  await canvas.evaluate(
    (element, points) => {
      const rect = element.getBoundingClientRect();
      const pointerId = 901;
      const originalCapture = element.setPointerCapture;
      element.setPointerCapture = () => {};
      const dispatch = (type, point, buttons) => {
        element.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId,
            pointerType: "touch",
            isPrimary: true,
            clientX: rect.left + rect.width * point.x,
            clientY: rect.top + rect.height * point.y,
            button: type === "pointerdown" ? 0 : -1,
            buttons,
          })
        );
      };
      dispatch("pointerdown", points.from, 1);
      for (let step = 1; step <= 8; step += 1) {
        const amount = step / 8;
        dispatch(
          "pointermove",
          {
            x: points.from.x + (points.to.x - points.from.x) * amount,
            y: points.from.y + (points.to.y - points.from.y) * amount,
          },
          1
        );
      }
      dispatch("pointerup", points.to, 0);
      element.setPointerCapture = originalCapture;
    },
    { from, to }
  );
}

async function expectDroppedEvidenceClearOfControls(page, sceneContainer, canvas, controls) {
  await requestFreshSceneEvidence(sceneContainer);
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

  const cardBounds = evidence.map((item) => item.card).filter(Boolean);
  let maximumCardOverlap = 0;
  for (let firstIndex = 0; firstIndex < cardBounds.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < cardBounds.length; secondIndex += 1) {
      const first = cardBounds[firstIndex];
      const second = cardBounds[secondIndex];
      const overlapWidth = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
      const overlapHeight = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
      const firstArea = Math.max(0.000001, (first.right - first.left) * (first.bottom - first.top));
      const secondArea = Math.max(0.000001, (second.right - second.left) * (second.bottom - second.top));
      maximumCardOverlap = Math.max(maximumCardOverlap, (overlapWidth * overlapHeight) / Math.min(firstArea, secondArea));
    }
  }
  expect(maximumCardOverlap, "the grounded song-card fan should remain collected rather than scattered").toBeGreaterThan(0.35);
  expect(maximumCardOverlap, "each grounded song card should expose a distinguishable edge").toBeLessThan(0.78);
  return { evidence, maximumCardOverlap };
}

function projectedRectStats(bounds) {
  if (!bounds) return null;
  const width = Math.max(0, bounds.right - bounds.left);
  const height = Math.max(0, bounds.bottom - bounds.top);
  return {
    width,
    height,
    area: width * height,
    centerX: bounds.left + width / 2,
    centerY: bounds.top + height / 2,
  };
}

async function requestFreshSceneEvidence(sceneContainer) {
  const snapshot = await sceneContainer.evaluate((element) => {
    const before = Number(element.getAttribute("data-scene-evidence-revision") || 0);
    element.dispatchEvent(new Event("home-desk-request-evidence"));
    return {
      before,
      after: Number(element.getAttribute("data-scene-evidence-revision") || 0),
      raw: element.getAttribute("data-composition-evidence"),
    };
  });
  expect(snapshot.after, "explicit QA evidence request should synchronously publish a fresh revision").toBeGreaterThan(snapshot.before);
  expect(snapshot.raw, "explicit QA evidence request should publish composition data").toBeTruthy();
  return JSON.parse(snapshot.raw || "{}");
}

async function readCompositionEvidence(sceneContainer, expectedView) {
  const evidence = await requestFreshSceneEvidence(sceneContainer);
  expect(evidence.view).toBe(expectedView);
  expect(Object.keys(evidence.landmarks || {}).length).toBeGreaterThanOrEqual(5);
  return evidence;
}

async function expectInteriorComposition(page, sceneContainer, canvas, projectName) {
  const evidence = await readCompositionEvidence(sceneContainer, "desk");
  const landmarks = evidence.landmarks || {};
  const required = ["window", "onsen", "desk", "chair", "rack"];
  required.forEach((key) => {
    expect(landmarks[key]?.bounds, `${key} should expose rendered bounds`).toBeTruthy();
    expect(landmarks[key]?.center, `${key} should expose a rendered center`).toBeTruthy();
    expect(landmarks[key].center.x, `${key} should remain horizontally near the canvas`).toBeGreaterThan(-0.12);
    expect(landmarks[key].center.x, `${key} should remain horizontally near the canvas`).toBeLessThan(1.12);
    expect(landmarks[key].center.y, `${key} should remain vertically near the canvas`).toBeGreaterThan(-0.12);
    expect(landmarks[key].center.y, `${key} should remain vertically near the canvas`).toBeLessThan(1.12);
  });

  expect(landmarks.onsen.center.x, "onsen should remain left of the desk").toBeLessThan(landmarks.desk.center.x);
  expect(landmarks.desk.center.x, "desk should remain left of the lounge chair").toBeLessThan(landmarks.chair.center.x);
  expect(landmarks.onsen.center.y, "onsen should remain below the desk").toBeGreaterThan(landmarks.desk.center.y);
  expect(landmarks.chair.center.y, "chair should remain below the desk").toBeGreaterThan(landmarks.desk.center.y);

  const onsenStats = projectedRectStats(landmarks.onsen.bounds);
  const chairStats = projectedRectStats(landmarks.chair.bounds);
  const compact = ["tablet-768", "mobile-390"].includes(projectName);
  expect(onsenStats.area, "onsen should retain a legible projected footprint").toBeGreaterThan(compact ? 0.004 : 0.012);
  expect(chairStats.area, "chair should retain a legible projected footprint").toBeGreaterThan(compact ? 0.003 : 0.008);
  expect(chairStats.area, "chair should not dominate the interior frame").toBeLessThan(0.22);

  await expect
    .poll(async () => {
      const current = await requestFreshSceneEvidence(sceneContainer);
      return current.view === "desk" && current.photos?.length >= 3 && current.photos.every((photo) => photo.textureReady);
    })
    .toBe(true);

  if (projectName === "desktop-1440") {
    const canvasBox = await canvas.boundingBox();
    const controlsBox = await page.locator("[data-home-desk-controls]").boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(controlsBox).not.toBeNull();
    ["onsen", "chair"].forEach((key) => {
      const bounds = landmarks[key].bounds;
      const projected = {
        left: canvasBox.x + bounds.left * canvasBox.width,
        top: canvasBox.y + bounds.top * canvasBox.height,
        right: canvasBox.x + bounds.right * canvasBox.width,
        bottom: canvasBox.y + bounds.bottom * canvasBox.height,
      };
      const intersectionWidth = Math.max(0, Math.min(projected.right, controlsBox.x + controlsBox.width) - Math.max(projected.left, controlsBox.x));
      const intersectionHeight = Math.max(0, Math.min(projected.bottom, controlsBox.y + controlsBox.height) - Math.max(projected.top, controlsBox.y));
      const intersectionArea = intersectionWidth * intersectionHeight;
      const projectedArea = Math.max(1, (projected.right - projected.left) * (projected.bottom - projected.top));
      expect(intersectionArea / projectedArea, `${key} should remain clear of the control strip`).toBeLessThan(0.06);
    });
  }
}

async function expectInteriorArchitecture(sceneContainer) {
  const evidence = await readCompositionEvidence(sceneContainer, "desk");
  const architecture = evidence.architecture || {};
  const floor = architecture.floor || {};
  expect(floor.vertexCount, "organic room floor should retain a multi-point footprint").toBeGreaterThanOrEqual(12);
  expect(floor.fillRatio, "organic floor should fill most, but not all, of its bounding rectangle").toBeGreaterThan(0.72);
  expect(floor.fillRatio, "organic floor should not regress to a rectangular slab").toBeLessThan(0.95);
  expect(floor.nonAxisAlignedEdges, "organic floor should expose several non-axis-aligned edges").toBeGreaterThanOrEqual(8);
  expect(floor.dropFanInside, "all deterministic album and paper landing centers should remain on the floor").toBe(true);
  expect(floor.boundaryWorld, "floor evidence should come from an ordered live geometry boundary").toHaveLength(floor.vertexCount);
  expect(floor.screenSilhouette?.sourceVertexCount).toBe(floor.vertexCount);
  expect(floor.screenSilhouette?.clippedVertexCount, "floor silhouette should survive frustum clipping").toBeGreaterThanOrEqual(4);

  const shell = architecture.shell || {};
  expect(shell.topology).toBe("open-front-aperture");
  expect(shell.wallSegmentCount, "room shell should retain its live side and rear panels").toBeGreaterThanOrEqual(12);
  expect(shell.structuralJointCount).toBe(shell.wallSegmentCount - 1);
  expect(shell.maxStructuralJointOffset, "live beveled wall joints should remain closely sequenced").toBeLessThan(0.14);
  expect(shell.openEndCount, "the shell should truthfully retain two ends at the front aperture").toBe(2);
  expect(shell.geometricallyClosed, "the deliberate glass-side reveals mean this is not a closed mesh loop").toBe(false);
  expect(shell.visibleSegmentCount, "live room shell should retain visible enclosure panels").toBeGreaterThanOrEqual(10);
  expect(shell.capVisible, "open-center ceiling cap should remain part of the live room shell").toBe(true);
  expect(shell.panels).toHaveLength(shell.wallSegmentCount);

  const aperture = architecture.aperture || {};
  expect(aperture.source).toBe("live-window-glass-and-floor-boundary");
  expect(aperture.glassWorldBounds, "aperture evidence should use the actual glass geometry").toBeTruthy();
  expect(aperture.coverageRatio, "glass should cover a meaningful central portion of the live floor edge").toBeGreaterThan(0.4);
  expect(aperture.coverageRatio, "glass should preserve deliberate stone reveals on both sides").toBeLessThan(0.7);
  expect(aperture.sideGaps).toHaveLength(2);
  aperture.sideGaps.forEach((gap) => expect(gap, "each glass side should retain a visible reveal").toBeGreaterThan(0.2));
  expect(aperture.revealDepth, "glass should sit within, not masquerade as, the floor boundary").toBeGreaterThan(0.1);

  const welcomePaper = architecture.welcomePaper || {};
  expect(welcomePaper.text).toBe("Welcome to Sirui’s cave.");
  expect(welcomePaper.textureReady, "welcome paper should use its rendered text texture").toBe(true);
  expect(welcomePaper.visible, "welcome paper should remain visible in the initial room view").toBe(true);
  expect(welcomePaper.headlineFontPx, "welcome words should use a materially larger texture font").toBeGreaterThanOrEqual(104);
  expect(welcomePaper.headlineFontRatio, "welcome words should occupy a readable share of the paper texture").toBeGreaterThan(0.24);
  const welcomeStats = projectedRectStats(welcomePaper.bounds);
  expect(welcomeStats, "welcome paper should expose rendered bounds").toBeTruthy();
  expect(welcomeStats.area, "welcome paper should retain enough projected area to read").toBeGreaterThan(0.004);
  expect(welcomeStats.height, "welcome paper should retain enough projected height for two readable lines").toBeGreaterThan(0.065);
  expect(welcomeStats.centerX, "welcome paper should remain near the central desk story").toBeGreaterThan(0.32);
  expect(welcomeStats.centerX, "welcome paper should remain near the central desk story").toBeLessThan(0.78);

  const guidance = architecture.windowGuidance || {};
  expect(guidance.visible, "window should expose a quiet default affordance").toBe(true);
  expect(guidance.hintVisible, "default cue should stay quieter than the zoom/hover label").toBe(false);
  expect(guidance.mode).toMatch(/^(pulse|static)$/);
  expect(guidance.opacity, "default window cue should be present but restrained").toBeGreaterThan(0);
  expect(guidance.opacity, "default window cue should not dominate the room").toBeLessThan(0.14);
  expect(guidance.bounds, "window guidance should expose rendered bounds").toBeTruthy();
  expect(guidance.markerVisible, "default window affordance should expose a visible hotspot").toBe(true);
  expect(guidance.markerOpacity, "default window hotspot should survive the initial room framing").toBeGreaterThan(0.14);
  expect(guidance.markerOpacity, "default window hotspot should remain quieter than primary objects").toBeLessThan(0.5);
  expect(guidance.markerBounds, "default window hotspot should expose rendered bounds").toBeTruthy();

  const sightline = architecture.onsenSightline || {};
  expect(sightline.method).toBe("live-scene-mesh-traversal");
  expect(sightline.samplingSource).toBe("live-window-view-local-geometry-grid");
  expect(sightline.targetSurface).toBe("window-ocean-left-pane-horizon");
  expect(sightline.visibleSceneMeshCount, "sightline should inspect the actual rendered scene").toBeGreaterThan(100);
  expect(sightline.occluderMeshCount, "sightline should test more than a hand-picked desk-object list").toBeGreaterThan(50);
  expect(sightline.sampleCount, "sightline should test a 3x3 aperture cone").toBe(9);
  expect(sightline.clearSampleCount, "every live aperture-cone ray should stay unobstructed").toBe(sightline.sampleCount);
  expect(sightline.coneClear, "the lizard should retain a real view corridor to the ocean horizon").toBe(true);
  expect(sightline.samples).toHaveLength(sightline.sampleCount);
  sightline.samples.forEach((sample) => {
    expect(sample.clear, `aperture sample ${sample.horizontal}/${sample.imageY} should remain clear`).toBe(true);
    expect(sample.nearestOccluder).toBeNull();
    expect(sample.target.x).toBeGreaterThan(aperture.glassWorldBounds.min.x);
    expect(sample.target.x).toBeLessThan(aperture.glassWorldBounds.center.x);
    expect(sample.target.y).toBeGreaterThan(aperture.glassWorldBounds.min.y);
    expect(sample.target.y).toBeLessThan(aperture.glassWorldBounds.max.y);
  });
  expect(sightline.clear, "the representative left-pane horizon ray should remain unobstructed").toBe(true);
  expect(sightline.nearestOccluder).toBeNull();
  expect(sightline.targetDistance, "lizard-to-left-pane horizon sightline should span the actual room").toBeGreaterThan(1);
  expect(sightline.horizontal).toBe(0.27);
  expect(sightline.imageY).toBe(0.48);
  expect(sightline.target.x).toBeLessThan(aperture.glassWorldBounds.center.x);
  expect(sightline.target.y).toBeCloseTo(aperture.glassWorldBounds.center.y, 1);
  return evidence;
}

async function expectOutsideComposition(sceneContainer) {
  const evidence = await readCompositionEvidence(sceneContainer, "outside");
  const landmarks = evidence.landmarks || {};
  ["window", "onsen", "desk", "chair", "rack", "lizard", "laptop"].forEach((key) => {
    expect(landmarks[key]?.bounds, `${key} should retain a projected outside-view bound`).toBeTruthy();
    expect(landmarks[key]?.center, `${key} should expose an outside-view projection center`).toBeTruthy();
    expect(landmarks[key]?.visibility?.method, `${key} should report raycast visibility separately from projection`).toBe(
      "camera-to-live-landmark-raycast"
    );
    expect(landmarks[key].visibility.samplingSource).toBe("live-landmark-world-bounds-3x3");
    expect(landmarks[key].visibility.sampleCount, `${key} visibility should sample a 3x3 projected region`).toBe(9);
    expect(landmarks[key].visibility.clearSampleCount).toBeGreaterThanOrEqual(0);
    expect(landmarks[key].visibility.clearRatio).toBeGreaterThanOrEqual(0);
    expect(landmarks[key].visibility.clearRatio).toBeLessThanOrEqual(1);
    expect(typeof landmarks[key].visibility.clear).toBe("boolean");
    if (!landmarks[key].visibility.clear) {
      expect(landmarks[key].visibility.nearestOccluder, `${key} occlusion should identify the blocking live mesh`).toBeTruthy();
    }
  });
  ["window", "onsen", "desk", "chair", "lizard", "laptop"].forEach((key) => {
    expect(landmarks[key].visibility.clear, `${key} should be visibly readable through the default exterior aperture`).toBe(true);
    expect(
      landmarks[key].visibility.clearSampleCount,
      `${key} should retain several clear camera rays rather than one lucky center ray`
    ).toBeGreaterThanOrEqual(landmarks[key].visibility.requiredClearSampleCount);
    expect(landmarks[key].visibility.clearRatio, `${key} should retain meaningful visible coverage`).toBeGreaterThanOrEqual(1 / 3);
  });
  expect(
    landmarks.window.visibility.apertureShellIgnoredSampleCount,
    "front-facing window evidence should classify the live cliff aperture shell instead of treating it as a solid cap"
  ).toBeGreaterThan(0);
  const lizardStats = projectedRectStats(landmarks.lizard.bounds);
  const laptopStats = projectedRectStats(landmarks.laptop.bounds);
  expect(lizardStats.area, "outside lizard head should retain human-legible projected area").toBeGreaterThan(0.00075);
  expect(lizardStats.width, "outside lizard head should retain human-legible projected width").toBeGreaterThan(0.03);
  expect(lizardStats.height, "outside lizard head should retain human-legible projected height").toBeGreaterThan(0.025);
  expect(laptopStats.area, "outside onsen laptop should retain human-legible projected area").toBeGreaterThan(0.0007);
  expect(laptopStats.width, "outside onsen laptop should retain human-legible projected width").toBeGreaterThan(0.03);
  expect(laptopStats.height, "outside onsen laptop should retain human-legible projected height").toBeGreaterThan(0.024);
  expect(landmarks.chair.center.x, "reciprocal outside view should mirror chair-to-desk ordering").toBeLessThan(landmarks.desk.center.x);
  expect(landmarks.desk.center.x, "reciprocal outside view should mirror desk-to-onsen ordering").toBeLessThan(landmarks.onsen.center.x);

  const coast = evidence.coast || {};
  ["cliff", "cliffFoot", "beach", "wetSand", "shoreline", "ocean"].forEach((key) => {
    expect(coast[key]?.bounds, `${key} should expose coastal composition bounds`).toBeTruthy();
  });
  const cliffFootStats = projectedRectStats(coast.cliffFoot.bounds);
  const shorelineStats = projectedRectStats(coast.shoreline.bounds);
  expect(cliffFootStats, "rendered cliff-foot geometry should expose projected bounds").toBeTruthy();
  expect(shorelineStats, "rendered shoreline geometry should expose projected bounds").toBeTruthy();
  expect(shorelineStats.centerY, "rendered shoreline should sit below the rendered cliff foot").toBeGreaterThan(cliffFootStats.centerY);
  const renderedContactGap = Math.max(0, shorelineStats.centerY - cliffFootStats.centerY - (shorelineStats.height + cliffFootStats.height) / 2);
  expect(renderedContactGap, "rendered cliff-foot and shoreline geometry should stay visually connected").toBeLessThan(0.08);

  const cliffArchitecture = evidence.architecture?.cliff || {};
  expect(cliffArchitecture.source).toBe("live-window-glass-cliff-facade-and-foot-geometry");
  expect(cliffArchitecture.dropRoomUnits, "cliff foot should sit materially below the room aperture").toBeGreaterThan(1.2);
  expect(cliffArchitecture.apertureElevationRatio, "the room aperture should sit high in the live cliff mass").toBeGreaterThan(0.62);
  expect(cliffArchitecture.projectedGap, "outside framing should reveal the cliff below the aperture").toBeGreaterThan(0.02);
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
  const twoDimensionalStage = await stage.boundingBox();
  expect(twoDimensionalStage).not.toBeNull();
  await attachScreenshot(page, testInfo, `desk-2d-default-${testInfo.project.name}`, { locator: stage });

  const scene = await switchTo3D(page);
  const threeDimensionalStage = await stage.boundingBox();
  expect(threeDimensionalStage).not.toBeNull();
  expect(
    Math.abs(threeDimensionalStage.height - twoDimensionalStage.height),
    "2D and 3D should share one stable stage height instead of shifting the page"
  ).toBeLessThanOrEqual(1);
  const sceneContainer = page.locator("[data-home-desk-scene]");
  await expect(page.locator('[data-home-desk-mode="3d"]')).toHaveAttribute("aria-pressed", "true");
  await attachScreenshot(page, testInfo, `desk-3d-default-${testInfo.project.name}`, { locator: scene.stage });
  await expectInteriorComposition(page, sceneContainer, scene.canvas, testInfo.project.name);
  const defaultArchitectureEvidence = await expectInteriorArchitecture(sceneContainer);
  await attachScreenshot(page, testInfo, `desk-architecture-welcome-cue-sightline-${testInfo.project.name}`, { locator: scene.stage });

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

    await pitchCanvas(page, scene.canvas);
    expect(Number(await sceneContainer.getAttribute("data-camera-pitch")), "top-oblique proof should use a genuine camera pitch").toBeGreaterThan(
      0.24
    );
    await expect(sceneContainer).toHaveAttribute("data-last-raycast-kind", "none");
    const topObliqueCanvas = await scene.canvas.screenshot();
    expect(
      screenshotDiffRatio(topObliqueCanvas, defaultCanvas),
      "top-oblique orbit should visibly reveal the organic floor and shell"
    ).toBeGreaterThan(0.002);
    const topObliqueEvidence = await readCompositionEvidence(sceneContainer, "desk");
    const defaultSilhouette = defaultArchitectureEvidence.architecture?.floor?.screenSilhouette || {};
    const topObliqueSilhouette = topObliqueEvidence.architecture?.floor?.screenSilhouette || {};
    expect(topObliqueSilhouette.sourceVertexCount).toBe(defaultSilhouette.sourceVertexCount);
    expect(topObliqueSilhouette.clippedVertexCount, "pitched floor silhouette should remain a clipped polygon").toBeGreaterThanOrEqual(4);
    expect(
      topObliqueSilhouette.height / defaultSilhouette.height,
      "top-oblique pitch should materially expose more of the live floor silhouette"
    ).toBeGreaterThan(1.14);
    expect(
      topObliqueSilhouette.area / defaultSilhouette.area,
      "top-oblique pitch should materially change the live floor silhouette area"
    ).toBeGreaterThan(1.02);
    await attachScreenshot(page, testInfo, "desk-architecture-top-oblique-desktop-1440", { locator: scene.stage });
    await page.locator('[data-home-desk-control="reset"]').click();
    await page.waitForTimeout(620);
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

test("tablet desk media yields the global back-to-top control in 2D and 3D", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "tablet-768", "the integrated collision occurs at the tablet breakpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page);
  const stage = page.locator("[data-home-artifact-stage]");
  const backToTop = page.locator("#back-to-top");
  const downstreamSection = page.locator('[data-home-section="publications"]');

  await downstreamSection.evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
  await expect(stage).not.toBeInViewport({ ratio: 0.01 });
  await expect(backToTop).not.toHaveAttribute("data-home-stage-suppressed", "");
  await backToTop.evaluate((element) => {
    element.tabIndex = 0;
    element.focus();
  });
  await expect(backToTop).toBeFocused();

  await stage.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(stage).toBeInViewport({ ratio: 0.2 });
  await expect(backToTop).toHaveAttribute("data-home-stage-suppressed", "");
  await expect(backToTop).toHaveAttribute("aria-hidden", "true");
  await expect(backToTop).toHaveAttribute("inert", "");
  await expect(backToTop).not.toBeFocused();
  await expect(backToTop).toHaveCSS("pointer-events", "none");
  await expect(backToTop).toBeHidden();
  await attachScreenshot(page, testInfo, "desk-back-to-top-guard-2d-tablet-768", { fullPage: false });

  await switchTo3D(page);
  await expect(stage).toBeInViewport({ ratio: 0.2 });
  await expect(backToTop).toHaveAttribute("data-home-stage-suppressed", "");
  await expect(backToTop).toHaveCSS("pointer-events", "none");
  await expect(backToTop).toBeHidden();
  await attachScreenshot(page, testInfo, "desk-back-to-top-guard-3d-tablet-768", { fullPage: false });

  await downstreamSection.evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
  await expect(stage).not.toBeInViewport({ ratio: 0.01 });
  await expect(backToTop).not.toHaveAttribute("data-home-stage-suppressed", "");
  await expect(backToTop).not.toHaveAttribute("aria-hidden", "true");
  await expect(backToTop).not.toHaveAttribute("inert", "");
  await expect(backToTop).not.toHaveCSS("pointer-events", "none");
  await backToTop.evaluate((element) => element.focus());
  await expect(backToTop).toBeFocused();
  await backToTop.evaluate((element) => {
    element.blur();
    element.removeAttribute("tabindex");
  });

  expect(runtimeErrors, "tablet back-to-top guard raised browser runtime errors").toEqual([]);
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
  const sceneContainer = page.locator("[data-home-desk-scene]");
  const reducedArchitecture = await expectInteriorArchitecture(sceneContainer);
  await expect(sceneContainer).toHaveAttribute("data-window-guidance-mode", "static");
  expect(reducedArchitecture.architecture?.windowGuidance?.mode).toBe("static");
  const buffer = await scene.canvas.screenshot();
  const metrics = screenshotMetrics(buffer);
  expect(metrics.uniqueColors).toBeGreaterThan(32);
  expect(metrics.luminanceVariance).toBeGreaterThan(20);
  await attachScreenshot(page, testInfo, `desk-3d-reduced-motion-${testInfo.project.name}`, { locator: scene.stage });
  expect(runtimeErrors, "desk reduced-motion state raised browser runtime errors").toEqual([]);
});

test("desk scene window guidance reveals a legible hover and zoom label", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "desktop pointer guidance checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page);
  const scene = await switchTo3D(page);
  const sceneContainer = page.locator("[data-home-desk-scene]");
  const defaultEvidence = await readCompositionEvidence(sceneContainer, "desk");
  const markerBounds = defaultEvidence.architecture?.windowGuidance?.markerBounds;
  expect(markerBounds, "window marker should expose bounds for pointer guidance").toBeTruthy();
  expect((markerBounds.left + markerBounds.right) / 2, "window marker should stay on the clear left sill").toBeLessThan(0.55);
  await page.waitForTimeout(700);
  await attachBuffer(testInfo, "desk-window-guidance-default-desktop-1440", await readCanvasBuffer(scene.canvas));

  const canvasBox = await scene.canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  await page.mouse.move(
    canvasBox.x + canvasBox.width * ((markerBounds.left + markerBounds.right) / 2),
    canvasBox.y + canvasBox.height * ((markerBounds.top + markerBounds.bottom) / 2)
  );
  await expect(sceneContainer).toHaveAttribute("data-window-guidance-hint-visible", "true");
  await page.waitForTimeout(700);
  const hoverEvidence = await readCompositionEvidence(sceneContainer, "desk");
  const hoverGuidance = hoverEvidence.architecture?.windowGuidance || {};
  expect(hoverGuidance.hintVisible).toBe(true);
  expect(hoverGuidance.hintBounds, "hover label should expose rendered bounds").toBeTruthy();
  expect(hoverGuidance.hintOpacity, "hover label should retain readable ink").toBeGreaterThan(0.5);
  expect(hoverGuidance.hintBounds.right - hoverGuidance.hintBounds.left, "hover label should retain readable width").toBeGreaterThan(0.1);
  expect(hoverGuidance.hintBounds.bottom - hoverGuidance.hintBounds.top, "hover label should retain readable height").toBeGreaterThan(0.025);
  await attachBuffer(
    testInfo,
    "desk-window-guidance-hover-evidence-desktop-1440",
    Buffer.from(JSON.stringify(hoverGuidance, null, 2)),
    "application/json"
  );
  await attachBuffer(testInfo, "desk-window-guidance-hover-desktop-1440", await readCanvasBuffer(scene.canvas));

  await page.mouse.move(Math.max(1, canvasBox.x - 16), canvasBox.y + canvasBox.height * 0.5);
  await expect(sceneContainer).toHaveAttribute("data-window-guidance-hint-visible", "false");
  const exitEvidence = await readCompositionEvidence(sceneContainer, "desk");
  expect(exitEvidence.architecture?.windowGuidance?.hintVisible, "window hover guidance should clear after canvas exit").toBe(false);

  await page.mouse.move(canvasBox.x + canvasBox.width * 0.1, canvasBox.y + canvasBox.height * 0.1);
  await page.mouse.wheel(0, -900);
  await page.waitForTimeout(550);
  await expect(sceneContainer).toHaveAttribute("data-window-guidance-hint-visible", "true");
  const zoomEvidence = await readCompositionEvidence(sceneContainer, "desk");
  expect(zoomEvidence.architecture?.windowGuidance?.hintBounds, "zoom label should expose rendered bounds").toBeTruthy();
  await attachBuffer(testInfo, "desk-window-guidance-zoom-desktop-1440", await readCanvasBuffer(scene.canvas));

  expect(runtimeErrors, "window guidance states raised browser runtime errors").toEqual([]);
});

test("desk scene clears an album hover lift after the pointer exits", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "desktop pointer-exit checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page);
  const scene = await switchTo3D(page);
  const sceneContainer = page.locator("[data-home-desk-scene]");
  const canvasBox = await scene.canvas.boundingBox();
  expect(canvasBox).not.toBeNull();

  await requestFreshSceneEvidence(sceneContainer);
  const restingAlbums = JSON.parse((await sceneContainer.getAttribute("data-album-screen-bounds")) || "[]");
  const target = restingAlbums.find((entry) => entry.index === 3 && entry.rackPoint && entry.objectPoint);
  expect(target, "an exposed rack album should provide a hover target").toBeTruthy();

  await page.mouse.move(canvasBox.x + canvasBox.width * target.rackPoint.x, canvasBox.y + canvasBox.height * target.rackPoint.y);
  let liftedIndex = -1;
  await expect
    .poll(async () => {
      await requestFreshSceneEvidence(sceneContainer);
      const currentAlbums = JSON.parse((await sceneContainer.getAttribute("data-album-screen-bounds")) || "[]");
      const lifted = currentAlbums.find((entry) => {
        const resting = restingAlbums.find((candidate) => candidate.index === entry.index);
        return resting?.objectPoint && entry.objectPoint && resting.objectPoint.y - entry.objectPoint.y > 0.001;
      });
      liftedIndex = lifted?.index ?? -1;
      return liftedIndex;
    })
    .toBeGreaterThanOrEqual(0);

  await page.mouse.move(Math.max(1, canvasBox.x - 16), canvasBox.y + canvasBox.height * 0.5);
  await expect
    .poll(async () => {
      await requestFreshSceneEvidence(sceneContainer);
      const currentAlbums = JSON.parse((await sceneContainer.getAttribute("data-album-screen-bounds")) || "[]");
      const resting = restingAlbums.find((entry) => entry.index === liftedIndex)?.objectPoint;
      const current = currentAlbums.find((entry) => entry.index === liftedIndex)?.objectPoint;
      return resting && current ? Math.abs(resting.y - current.y) : Number.POSITIVE_INFINITY;
    })
    .toBeLessThan(0.001);

  expect(runtimeErrors, "album hover exit raised browser runtime errors").toEqual([]);
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

  await dropRecordCardsUntil(page, 1);
  const playButton = page.locator("[data-home-record-play]");
  await expect(playButton).toHaveCSS("pointer-events", "auto");
  await playButton.focus();
  await page.keyboard.press("Space");
  await expect(playButton).toHaveAttribute("aria-pressed", "true");

  const scene = await switchTo3D(page);
  const sceneContainer = page.locator("[data-home-desk-scene]");
  await expectInteriorComposition(page, sceneContainer, scene.canvas, testInfo.project.name);
  await clickProjectedSceneTarget(page, scene.canvas, sceneContainer, "data-window-screen-bounds");
  await expect(sceneContainer).toHaveAttribute("data-last-raycast-kind", "windowJump");
  await expect(sceneContainer).toHaveClass(/is-outside-view/);
  await expectOutsideComposition(sceneContainer);
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
  await dropRecordCardsUntil(page, 1);
  await expect(stage).toHaveAttribute("data-dropped-records", "0");
  await attachScreenshot(page, testInfo, "desk-mobile-2d-album-drop-mobile-390", { locator: stage });

  const threeDimensionalToggle = page.locator('[data-home-desk-mode="3d"]');
  await threeDimensionalToggle.tap();
  await expect(stage).toHaveAttribute("data-desk-mode", "3d");
  await expect(threeDimensionalToggle).toHaveAttribute("aria-pressed", "true");
  const sceneContainer = page.locator("[data-home-desk-scene]");
  const canvas = page.locator(".home-desk-corner-canvas");

  const spinControl = page.locator('[data-home-desk-control="spin"]');
  const spinState = await spinControl.getAttribute("aria-pressed");
  await spinControl.tap();
  await expect(spinControl).toHaveAttribute("aria-pressed", spinState === "true" ? "false" : "true");

  const mobileAlbumIndices = [1, 2, 3];
  for (const mobileAlbumIndex of mobileAlbumIndices) {
    const rackPoint = await getAlbumScenePoint(sceneContainer, mobileAlbumIndex, "rackPoint");
    await clickCanvas(page, canvas, rackPoint.x, rackPoint.y);
    await expect(sceneContainer).toHaveAttribute("data-focused-desk-object", `album-${mobileAlbumIndex}`);
    await page.waitForTimeout(620);
  }
  const mobileAlbumIndex = mobileAlbumIndices.at(-1);
  const focusedPoint = await getAlbumScenePoint(sceneContainer, mobileAlbumIndex, "objectPoint");
  await dragCanvasWithTouch(canvas, focusedPoint, { x: Math.max(0.08, focusedPoint.x - 0.18), y: Math.min(0.88, focusedPoint.y + 0.24) });
  await expect(stage).toHaveAttribute("data-dropped-records", `0,${mobileAlbumIndex}`);
  await expect(sceneContainer).not.toHaveAttribute("data-focused-desk-object", /album-/);
  await page.locator('[data-home-desk-control="reset"]').tap();
  await expect(sceneContainer).not.toHaveClass(/is-outside-view/);
  await expect(sceneContainer).not.toHaveAttribute("data-focused-desk-object", /.+/);

  const twoDimensionalToggle = page.locator('[data-home-desk-mode="2d"]');
  await twoDimensionalToggle.tap();
  await expect(stage).toHaveAttribute("data-desk-mode", "2d");
  await expect(twoDimensionalToggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-home-record-card]")).toHaveCount(2);
  await expect(stage).toHaveAttribute("data-dropped-records", `0,${mobileAlbumIndex}`);
  expect(runtimeErrors, "touch-driven desk controls raised browser runtime errors").toEqual([]);
});

test("compact desk scene preserves the cliff window anchor and return path", async ({ page }, testInfo) => {
  test.skip(!["tablet-768", "mobile-390"].includes(testInfo.project.name), "compact outside-view checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page);
  const scene = await switchTo3D(page);
  const sceneContainer = page.locator("[data-home-desk-scene]");
  await expectInteriorComposition(page, sceneContainer, scene.canvas, testInfo.project.name);
  await requestFreshSceneEvidence(sceneContainer);
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
  await expectOutsideComposition(sceneContainer);
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
  testInfo.setTimeout(420_000);

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page);
  const scene = await switchTo3D(page);
  const sceneContainer = page.locator("[data-home-desk-scene]");
  await expectInteriorComposition(page, sceneContainer, scene.canvas, testInfo.project.name);
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
  const rearCamera = JSON.parse((await sceneContainer.getAttribute("data-camera-position")) || "{}");
  const cameraBounds = JSON.parse((await sceneContainer.getAttribute("data-room-camera-bounds")) || "{}");
  expect(cameraBounds).toEqual({ minX: -1.738, maxX: 1.818, minZ: -0.87, maxZ: 3.964 });
  expect(rearCamera.x, "rear orbit camera should remain inside the scaled side-wall footprint").toBeGreaterThanOrEqual(cameraBounds.minX);
  expect(rearCamera.x, "rear orbit camera should remain inside the scaled side-wall footprint").toBeLessThanOrEqual(cameraBounds.maxX);
  expect(rearCamera.z, "rear orbit camera should remain inside the scaled window plane").toBeGreaterThanOrEqual(cameraBounds.minZ);
  expect(rearCamera.z, "rear orbit camera should remain inside the scaled rear boundary").toBeLessThanOrEqual(cameraBounds.maxZ);
  await expect(page.locator("[data-home-desk-scene]")).not.toHaveClass(/is-outside-view/);
  await attachScreenshot(page, testInfo, "desk-architecture-rear-shell-desktop-1440", { locator: scene.stage });

  await clickCanvas(page, scene.canvas, 0.34, 0.32);
  await expect(sceneContainer).toHaveAttribute("data-last-raycast-kind", "none");
  await expect(sceneContainer).not.toHaveAttribute("data-focused-desk-object", /album-/);

  await clickCanvas(page, scene.canvas, 0.78, 0.34);
  await expect(sceneContainer).not.toHaveAttribute("data-last-raycast-kind", "windowJump");
  await expect(sceneContainer).not.toHaveClass(/is-outside-view/);

  await page.locator('[data-home-desk-control="reset"]').click();
  await expect.poll(async () => Math.abs(Number(await sceneContainer.getAttribute("data-camera-yaw")))).toBeLessThan(0.02);
  await expect(sceneContainer).toHaveAttribute("data-window-guidance-visible", "true");

  const defaultOcclusionEvidence = await readCompositionEvidence(sceneContainer, "desk");
  const deskCenter = defaultOcclusionEvidence.landmarks?.desk?.center;
  expect(deskCenter, "desk should expose a center for the occluded-window negative click").toBeTruthy();
  await clickCanvas(page, scene.canvas, deskCenter.x, deskCenter.y);
  await expect(sceneContainer).not.toHaveAttribute("data-last-raycast-kind", "windowJump");
  await expect(sceneContainer).not.toHaveClass(/is-outside-view/);
  await page.locator('[data-home-desk-control="reset"]').click();
  await expect.poll(async () => Math.abs(Number(await sceneContainer.getAttribute("data-camera-yaw")))).toBeLessThan(0.02);
  await expect(sceneContainer).toHaveAttribute("data-window-guidance-visible", "true");

  await clickProjectedSceneTarget(page, scene.canvas, sceneContainer, "data-window-screen-bounds");
  await expect(sceneContainer).toHaveAttribute("data-last-raycast-kind", "windowJump");
  await expect(page.locator("html")).toHaveClass(/home-desk-outside-active/);
  await expect(page.locator("[data-home-desk-scene]")).toHaveClass(/is-outside-view/);
  await expectOutsideComposition(sceneContainer);
  await expect(sceneContainer).toHaveAttribute("data-return-target-visible", "true");
  await requestFreshSceneEvidence(sceneContainer);
  await expect(sceneContainer).toHaveAttribute("data-return-screen-bounds", /^\{/);
  await page.waitForTimeout(500);
  const outsideDefaultDistance = Number(await sceneContainer.getAttribute("data-camera-distance"));
  expect(outsideDefaultDistance).toBeGreaterThan(0);
  const outsideDefault = await scene.canvas.screenshot();
  await attachScreenshot(page, testInfo, "desk-architecture-high-cliff-desktop-1440", { locator: scene.stage });

  await orbitCanvas(page, scene.canvas);
  const outsideDragged = await scene.canvas.screenshot();
  expect(screenshotDiffRatio(outsideDragged, outsideDefault), "outside orbit should visibly change the cliff room").toBeGreaterThan(0.002);
  await expect(page.locator("[data-home-desk-scene]")).toHaveClass(/is-outside-view/);
  await attachScreenshot(page, testInfo, "desk-continuity-outside-dragged-desktop-1440", { locator: scene.stage });

  await orbitCanvas(page, scene.canvas, 0.18, 0.68);
  const occludedReturnYaw = Number(await sceneContainer.getAttribute("data-camera-yaw"));
  expect(occludedReturnYaw).toBeGreaterThan(0.88);
  expect(occludedReturnYaw).toBeLessThan(Math.PI * 0.36);
  await expect(sceneContainer).toHaveAttribute("data-return-target-visible", "false");
  const sideObliqueEvidence = await readCompositionEvidence(sceneContainer, "outside");
  expect(
    sideObliqueEvidence.landmarks?.window?.visibility?.apertureShellIgnoredSampleCount,
    "aperture-shell exception should switch off once rock is viewed obliquely"
  ).toBe(0);
  await expect(sceneContainer).not.toHaveAttribute("data-return-screen-bounds");
  const occludedApertureBounds = sideObliqueEvidence.architecture?.aperture?.screenBounds;
  expect(occludedApertureBounds, "the physical aperture should remain measurable behind the side rock").toBeTruthy();
  await clickCanvas(
    page,
    scene.canvas,
    (occludedApertureBounds.left + occludedApertureBounds.right) / 2,
    occludedApertureBounds.top + (occludedApertureBounds.bottom - occludedApertureBounds.top) * 0.18
  );
  await expect(sceneContainer).not.toHaveAttribute("data-last-raycast-kind", "returnInside");
  await expect(sceneContainer).toHaveClass(/is-outside-view/);
  await orbitCanvas(page, scene.canvas, 0.68, 0.18);

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
  await expect(sceneContainer).toHaveAttribute("data-return-target-visible", "false");
  await requestFreshSceneEvidence(sceneContainer);
  await expect(sceneContainer).not.toHaveAttribute("data-return-screen-bounds");
  await clickCanvas(page, scene.canvas, 0.5, 0.5);
  await expect(sceneContainer).not.toHaveAttribute("data-last-raycast-kind", "returnInside");
  await attachScreenshot(page, testInfo, "desk-continuity-outside-rear-desktop-1440", { locator: scene.stage });

  for (let step = 0; step < 3; step += 1) await orbitCanvas(page, scene.canvas, 0.82, 0.18);

  await zoomCanvas(page, scene.canvas);
  const outsideZoomed = await scene.canvas.screenshot();
  expect(screenshotDiffRatio(outsideZoomed, outsideDragged), "outside zoom should visibly change the cliff room").toBeGreaterThan(0.002);
  await expect(page.locator("[data-home-desk-scene]")).toHaveClass(/is-outside-view/);
  await attachScreenshot(page, testInfo, "desk-continuity-outside-max-zoom-desktop-1440", { locator: scene.stage });

  await expect(sceneContainer).toHaveAttribute("data-return-target-visible", "true");
  await requestFreshSceneEvidence(sceneContainer);
  await expect(sceneContainer).toHaveAttribute("data-return-screen-bounds", /^\{/);
  await clickProjectedSceneTarget(page, scene.canvas, sceneContainer, "data-return-screen-bounds");
  await expect(sceneContainer).toHaveAttribute("data-last-raycast-kind", "returnInside");
  await expect(page.locator("html")).not.toHaveClass(/home-desk-outside-active/);
  await expect(page.locator("[data-home-desk-scene]")).not.toHaveClass(/is-outside-view/);
  await page.waitForTimeout(400);
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
  const droppedEvidence = await expectDroppedEvidenceClearOfControls(page, sceneContainer, scene.canvas, controls);
  await attachBuffer(
    testInfo,
    "desk-four-card-projection-evidence-desktop-1440",
    Buffer.from(JSON.stringify(droppedEvidence, null, 2)),
    "application/json"
  );
  await attachScreenshot(page, testInfo, "desk-four-card-control-safe-desktop-1440", { locator: scene.stage });
  expect(runtimeErrors, "four-card 3D landing raised browser runtime errors").toEqual([]);
});

test("dark desk materials preserve interior, floor evidence, and cliff hierarchy", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "representative dark-material checkpoint");

  const runtimeErrors = collectRuntimeErrors(page);
  await openDeskHome(page, "light");
  await dropRecordCardsUntil(page, 1);
  const scene = await switchTo3D(page);
  const sceneContainer = page.locator("[data-home-desk-scene]");
  const lightInteriorEvidence = await readCompositionEvidence(sceneContainer, "desk");
  const lightSideWallMaps = lightInteriorEvidence.roomPalette?.sideWalls?.map((wall) => wall.mapId) || [];
  const lightCaveMouth = lightInteriorEvidence.roomPalette?.caveMouth || [];
  expect(lightSideWallMaps.length, "live shell should expose at least one mapped wall material").toBeGreaterThanOrEqual(1);
  expect(lightSideWallMaps.every(Boolean), "rendered side walls should expose their live texture ids").toBe(true);
  expect(lightCaveMouth.length, "all cloned cave-mouth materials should be tracked").toBeGreaterThanOrEqual(6);
  lightCaveMouth.forEach((material) => {
    expect(material.state).toBe("inside");
    expect(material.color).toBe(material.insideColor);
    expect(material.opacity).toBe(material.insideOpacity);
  });
  await expectInteriorArchitecture(sceneContainer);
  await clickProjectedSceneTarget(page, scene.canvas, sceneContainer, "data-window-screen-bounds");
  await expect(sceneContainer).toHaveClass(/is-outside-view/);
  const lightEvidence = await readCompositionEvidence(sceneContainer, "outside");
  expect(lightEvidence.coastPalette?.wetSand?.color).toBe("aa9274");
  expect(lightEvidence.coastPalette?.foam?.map((item) => item.color)).toEqual(["fffdf5", "fffdf5"]);
  await page.keyboard.press("Escape");
  await expect(sceneContainer).not.toHaveClass(/is-outside-view/);

  await page.locator("#theme-toggle").click();
  await page.locator('#theme-menu [data-theme-mode-option="evening"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkInteriorEvidence = await readCompositionEvidence(sceneContainer, "desk");
  const darkSideWallMaps = darkInteriorEvidence.roomPalette?.sideWalls?.map((wall) => wall.mapId) || [];
  const darkInteriorCaveMouth = darkInteriorEvidence.roomPalette?.caveMouth || [];
  expect(darkSideWallMaps).toHaveLength(lightSideWallMaps.length);
  darkSideWallMaps.forEach((mapId, index) => {
    expect(mapId, `side-wall ${index} should receive the live dark texture`).toBeTruthy();
    expect(mapId, `side-wall ${index} should not keep the light-theme texture`).not.toBe(lightSideWallMaps[index]);
  });
  expect(darkInteriorCaveMouth).toHaveLength(lightCaveMouth.length);
  darkInteriorCaveMouth.forEach((material, index) => {
    expect(material.state).toBe("inside");
    expect(material.color).toBe(material.insideColor);
    expect(material.color).not.toBe(lightCaveMouth[index].color);
    expect(material.opacity).toBe(material.insideOpacity);
  });
  await expectInteriorArchitecture(sceneContainer);
  const interior = await scene.canvas.screenshot();
  const interiorMetrics = screenshotMetrics(interior);
  expect(interiorMetrics.uniqueColors).toBeGreaterThan(32);
  expect(interiorMetrics.luminanceVariance).toBeGreaterThan(16);
  await attachScreenshot(page, testInfo, "desk-dark-interior-grounded-desktop-1440", { locator: scene.stage });

  await clickProjectedSceneTarget(page, scene.canvas, sceneContainer, "data-window-screen-bounds");
  await expect(sceneContainer).toHaveAttribute("data-last-raycast-kind", "windowJump");
  await expect(sceneContainer).toHaveClass(/is-outside-view/);
  const darkEvidence = await readCompositionEvidence(sceneContainer, "outside");
  const darkOutsideCaveMouth = darkEvidence.roomPalette?.caveMouth || [];
  expect(darkEvidence.coastPalette?.wetSand).toEqual({ color: "776d61", opacity: 0.72 });
  expect(darkEvidence.coastPalette?.foam).toEqual([
    { key: "shoreFoam-0.2", color: "e7e1d5", opacity: 0.46 },
    { key: "shoreFoam-1.1", color: "e7e1d5", opacity: 0.24 },
  ]);
  expect(darkOutsideCaveMouth).toHaveLength(lightCaveMouth.length);
  darkOutsideCaveMouth.forEach((material) => {
    expect(material.state).toBe("outside");
    expect(material.color).toBe(material.outsideColor);
    expect(material.opacity).toBe(material.outsideOpacity);
  });
  const outside = await scene.canvas.screenshot();
  const outsideMetrics = screenshotMetrics(outside);
  expect(outsideMetrics.uniqueColors).toBeGreaterThan(32);
  expect(outsideMetrics.luminanceVariance).toBeGreaterThan(16);
  await attachScreenshot(page, testInfo, "desk-dark-outside-desktop-1440", { locator: scene.stage });

  await page.locator("#theme-toggle").click();
  await page.locator('#theme-menu [data-theme-mode-option="morning"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const restoredLightOutsideEvidence = await readCompositionEvidence(sceneContainer, "outside");
  const restoredLightOutsideCaveMouth = restoredLightOutsideEvidence.roomPalette?.caveMouth || [];
  restoredLightOutsideCaveMouth.forEach((material, index) => {
    expect(material.state).toBe("outside");
    expect(material.color).toBe(material.outsideColor);
    expect(material.color).not.toBe(darkOutsideCaveMouth[index].color);
  });

  await page.keyboard.press("Escape");
  await expect(sceneContainer).not.toHaveClass(/is-outside-view/);
  const restoredLightInteriorEvidence = await readCompositionEvidence(sceneContainer, "desk");
  const restoredLightInteriorCaveMouth = restoredLightInteriorEvidence.roomPalette?.caveMouth || [];
  expect(restoredLightInteriorCaveMouth).toHaveLength(lightCaveMouth.length);
  restoredLightInteriorCaveMouth.forEach((material, index) => {
    expect(material.state).toBe("inside");
    expect(material.color).toBe(material.insideColor);
    expect(material.color).toBe(lightCaveMouth[index].color);
    expect(material.opacity).toBe(lightCaveMouth[index].opacity);
  });
  expect(runtimeErrors, "dark desk material states raised browser runtime errors").toEqual([]);
});
