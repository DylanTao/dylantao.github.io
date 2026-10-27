const { test, expect } = require("@playwright/test");
const { publicRouteUrl } = require("./public-routes");
const { preparePage, collectRuntimeErrors, screenshotDiffRatio, screenshotMetrics } = require("./helpers");
const { pauseSceneClock, useSoftwareSceneCadence } = require("./scene-clock");
const evidence = (page) => page.locator(".duh-companion").evaluate((e) => e.getDuhEvidence());
async function open(page, route = "/projects/p/", reduced = false) {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.goto(publicRouteUrl(route), { waitUntil: "load" });
  await expect(page.locator(".duh-companion")).toHaveCount(1);
  await expect.poll(() => evidence(page).then((e) => e.frames)).toBeGreaterThan(0);
  return errors;
}
async function reset(page) {
  await page.keyboard.press("Alt+Shift+KeyD");
}
async function pause(page) {
  await page.locator(".duh-hit").press("p");
}
async function toss(page) {
  await page.locator(".duh-hit").press("t");
}
async function throwDuh(page, dx, dy) {
  const p = await evidence(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await releaseQuickly(page, [
    { x: p.x + dx * 0.3, y: p.y + dy * 0.3 },
    { x: p.x + dx, y: p.y + dy },
  ]);
  await page.mouse.up();
}
async function releaseQuickly(page, points) {
  // Establish real capture above, then deliver a deterministic high-speed
  // sample pair. Host automation command latency is not throw velocity.
  await page.locator(".duh-hit").evaluate((hit, points) => {
    const id = document.querySelector(".duh-companion").getDuhEvidence().pointerId;
    const time = performance.now();
    for (let i = 0; i < 3; i++) {
      const p = points[Math.min(i, 1)];
      const event = new PointerEvent(i === 2 ? "pointerup" : "pointermove", {
        bubbles: true,
        pointerId: id,
        pointerType: "mouse",
        isPrimary: true,
        clientX: p.x,
        clientY: p.y,
      });
      Object.defineProperty(event, "timeStamp", { value: time + i * 25 });
      hit.dispatchEvent(event);
    }
  }, points);
}

test("duh: default companion preserves content, real links, selection and late reflow", async ({ page }) => {
  const errors = await open(page, "/blog/2024/", true);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("[data-footer-coast]")).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  await expect(page.locator(".pip-companion")).toHaveCount(0);
  const original = await page.locator("#main").innerText();
  await pause(page);
  await reset(page);
  expect(await page.locator("#main").innerText()).toBe(original);
  const selected = await page.locator("#main").evaluate((main) => {
    const range = document.createRange();
    range.selectNodeContents(main);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(range);
    return s.toString();
  });
  expect(selected.length).toBeGreaterThan(30);
  await page.evaluate(() => getSelection().removeAllRanges());
  const link = page.locator("#main a[href]").first();
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  await link.focus();
  await expect(link).toBeFocused();
  // Late layout (the reading-progress bar, image decode, the footer) rescans the page. Measure the
  // resting spot only once the scan count holds still, so the probe below starts from a settled perch.
  await expect
    .poll(
      async () => {
        const before = (await evidence(page)).layoutScans;
        await page.waitForTimeout(400);
        return (await evidence(page)).layoutScans === before;
      },
      { timeout: 15000 }
    )
    .toBe(true);
  const resting = await evidence(page);
  const originallyVisible = resting.visible;
  await page.evaluate(() => {
    const p = document.createElement("figure");
    p.dataset.duhProbe = "";
    p.textContent = "An expanded reading surface.";
    Object.assign(p.style, { position: "fixed", inset: "75px 0 0", margin: "0" });
    document.querySelector("#main").append(p);
  });
  await expect.poll(() => evidence(page).then((e) => e.visible)).toBe(false);
  await page.locator("[data-duh-probe]").evaluate((e) => e.remove());
  try {
    await expect.poll(() => evidence(page).then((e) => e.visible)).toBe(originallyVisible);
  } catch (error) {
    // Report where duh rested and what surrounds it, so a CI-only miss can be diagnosed.
    const after = await evidence(page);
    const pick = (e) => ({
      x: Math.round(e.x),
      y: Math.round(e.y),
      state: e.state,
      visible: e.visible,
      navigating: e.navigating,
      layoutScans: e.layoutScans,
      bounds: e.bounds,
      blockers: e.blockers,
    });
    const nearby = await page.evaluate(
      ({ x, y }) =>
        Array.from(document.querySelectorAll("#main *, header, nav, footer a, footer button"))
          .map((node) => ({ node, rect: node.getBoundingClientRect() }))
          .filter(
            ({ rect }) =>
              rect.width && rect.height && Math.abs(rect.left + rect.width / 2 - x) < 160 && Math.abs(rect.top + rect.height / 2 - y) < 120
          )
          .slice(0, 8)
          .map(
            ({ node, rect }) =>
              `${node.tagName.toLowerCase()}.${String(node.className).split(" ")[0]} ${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`
          ),
      { x: after.x, y: after.y }
    );
    error.message += `
duh before probe: ${JSON.stringify(pick(resting))}
duh after probe: ${JSON.stringify(pick(after))}
nearby: ${JSON.stringify(nearby)}`;
    throw error;
  }
  expect(errors).toEqual([]);
});

test("duh: forms, four themes, bounded layout, clear controls and original P coexist", async ({ page }, info) => {
  await page.clock.install();
  const errors = await open(page);
  await page.locator("[data-duh-playground]").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Invite duh here", exact: true }).click();
  expect(await page.locator("[data-duh-shape],.duh-preview,.duh-dock").count()).toBe(0);
  await page.clock.runFor(6200);
  expect((await evidence(page)).form).toBe("apple");
  for (const theme of ["morning", "noon", "afternoon", "evening"]) {
    await page.locator("[data-theme-toggle]").first().click();
    await page
      .locator('[data-theme-mode-option="' + theme + '"]')
      .first()
      .click();
    await page.keyboard.press("Escape"); // Keep the page clear of the persistent comparison menu.
    await page.clock.runFor(650);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(theme + ".png") });
  }
  if (info.project.name === "desktop-1440") {
    const forms = new Set([(await evidence(page)).form]);
    for (let i = 0; i < 90; i++) {
      await page.clock.runFor(1000);
      forms.add((await evidence(page)).form);
    }
    expect([...forms].sort()).toEqual(["apple", "dot", "peach", "square", "triangle", "watermelon"]);
  }
  await expect(page.locator("[data-pip-studio]")).toHaveCount(1);
  await expect(page.locator("#credits")).toContainText("Pollen Robotics");
  expect(errors).toEqual([]);
});

test("duh: recovery stays on the character and invitation restores its accessible state", async ({ page }, info) => {
  await page.clock.install();
  const errors = await open(page);
  await expect(page.locator("[data-duh-controls],[data-duh-pause],[data-duh-reset],.duh-controls")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^(Pause|Resume|Reset) duh$/ })).toHaveCount(0);
  await page.locator("[data-duh-playground]").scrollIntoViewIfNeeded();
  const invite = page.getByRole("button", { name: "Invite duh here", exact: true });
  await invite.click();
  const hit = page.locator(".duh-hit");
  await hit.press("p");
  await expect(hit).toBeFocused();
  await expect(page.getByRole("button", { name: "Wake duh", exact: true })).toHaveCount(1);
  await page.clock.runFor(100);
  const sleeping = await evidence(page);
  await page.clock.runFor(1200);
  expect((await evidence(page)).frames - sleeping.frames).toBeLessThan(2);
  await hit.press("Enter");
  expect((await evidence(page)).paused).toBe(false);
  await pause(page);
  await invite.click();
  await expect(page.getByRole("button", { name: "Pet duh", exact: true })).toHaveCount(1);
  await toss(page);
  await hit.press("r");
  await expect(hit).toBeFocused();
  expect(await evidence(page)).toMatchObject({ paused: false, held: false, state: "REST", roughThrows: 0, fragments: 0, displaced: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("character-only-controls.png") });
  expect(errors).toEqual([]);
});

test("duh: repeated clicks giggle, canceled drag cannot throw, pause and reset clear state", async ({ page }) => {
  await page.clock.install();
  const errors = await open(page);
  await page.locator("[data-duh-playground]").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Invite duh here", exact: true }).click();

  for (let i = 0; i < 3; i++) await page.locator(".duh-hit").press("Enter");
  await page.clock.runFor(50);
  expect((await evidence(page)).mood).toBe("giggle");
  expect((await evidence(page)).roughThrows).toBe(0);
  const p = await evidence(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 35, p.y - 35);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await evidence(page)).held).toBe(false);
  expect((await evidence(page)).roughThrows).toBe(0);
  await pause(page);
  const before = await evidence(page);
  await page.clock.runFor(250);
  expect((await evidence(page)).frames - before.frames).toBeLessThan(2);
  await reset(page);
  expect(await evidence(page)).toMatchObject({ state: "REST", paused: false, held: false, fragments: 0, form: "dot" });
  expect(errors).toEqual([]);
});

test("duh: deliberate throws are bounded, retreat is temporary, repeated regrabs and recall work", async ({ page, isMobile }) => {
  test.skip(isMobile, "Native mouse throwing is covered on desktop; touch has its own test.");
  await page.clock.install({ time: new Date("2026-10-09T08:00:00Z") });
  const errors = await open(page, "/blog/2024/");
  // Freeze wall-clock automation latency; the rough-play window is active time.
  await page.clock.pauseAt(new Date("2026-10-09T08:10:00Z"));
  await reset(page);
  await page.clock.runFor(300);
  for (let i = 0; i < 3; i++) {
    await throwDuh(page, (await evidence(page)).x > 600 ? -250 : 250, -20);
    expect((await evidence(page)).roughThrows + ((await evidence(page)).retreatPending ? 3 : 0)).toBeGreaterThanOrEqual(i + 1);
    await page.clock.runFor(160);
    expect((await evidence(page)).held).toBe(false);
  }
  await page.clock.runFor(4200);
  await expect.poll(() => evidence(page).then((e) => e.state)).toBe("RETREAT");
  await reset(page);
  expect((await evidence(page)).state).toBe("REST");
  await throwDuh(page, -90, -60);
  await page.setViewportSize({ width: 480, height: 700 });
  await page.clock.runFor(4000);
  await expect.poll(() => evidence(page).then((e) => e.state)).toBe("REST");
  const p = await evidence(page);
  expect(p.x).toBeLessThanOrEqual(444);
  expect(p.x).toBeGreaterThanOrEqual(36);
  expect(errors).toEqual([]);
});

test("duh: reduced motion and keyboard alternatives never launch or scatter", async ({ page }) => {
  const errors = await open(page, "/blog/2024/", true);
  await toss(page);
  expect(await evidence(page)).toMatchObject({ state: "REST", reduced: true, fragments: 0 });
  await page.locator(".duh-hit").focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  expect((await evidence(page)).mood).toBe("happy");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await toss(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => evidence(page).then((e) => e.state)).toBe("REST");
  expect(errors).toEqual([]);
});

test("duh: direct touch drag, cancellation, hold to sleep and tap to wake remain accessible", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Touch contract is exercised by the phone project.");
  await page.clock.install({ time: new Date("2026-10-09T08:00:00Z") });
  const errors = await open(page, "/blog/2024/");
  await page.clock.pauseAt(new Date("2026-10-09T08:10:00Z"));
  await reset(page);
  await page.clock.runFor(100);
  expect(await page.locator(".duh-hit").evaluate((e) => getComputedStyle(e).touchAction)).toBe("none");
  await page.locator(".duh-hit").tap();
  expect((await evidence(page)).mood).toBe("happy");
  const touch = await page.context().newCDPSession(page);
  for (const canceled of [true, false]) {
    const p = await evidence(page);
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
    await expect.poll(() => evidence(page).then((e) => e.held)).toBe(true);
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: p.x - 30, y: p.y - 45, id: 1 }] });
    await touch.send("Input.dispatchTouchEvent", { type: canceled ? "touchCancel" : "touchEnd", touchPoints: [] });
    await expect.poll(() => evidence(page).then((e) => e.held)).toBe(false);
    if (canceled) expect(await evidence(page)).toMatchObject({ state: "REST", roughThrows: 0 });
    // Let the captured move reach the rendered hit target before a new gesture.
    await page.clock.runFor(32);
  }
  await reset(page);
  // A newly mounted interactive footer may require a brief clearance recovery.
  await page.clock.runFor(600);
  expect((await evidence(page)).recovering).toBe(false);
  const nap = await evidence(page);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: nap.x, y: nap.y, id: 2 }] });
  await expect.poll(() => evidence(page).then((e) => e.held)).toBe(true);
  await page.clock.runFor(800);
  await expect.poll(() => evidence(page).then((e) => e.paused)).toBe(true);
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await touch.detach();
  await page.locator(".duh-hit").tap();
  expect((await evidence(page)).paused).toBe(false);
  await reset(page);
  expect(await page.locator(".duh-dock").count()).toBe(0);
  expect(errors).toEqual([]);
});

test("duh: impact affects only decorative clones and idle tidying restores them", async ({ page, isMobile }) => {
  test.skip(isMobile, "Precision impact has the same collider on touch; the tap alternative is covered separately.");
  const errors = await open(page);
  await page.locator("[data-duh-playground]").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Invite duh here", exact: true }).click();
  const original = await page.locator("#main").innerText();
  const b = await page.locator("[data-duh-heavy]").boundingBox(),
    p = await evidence(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(b.x - 250, b.y + 25);
  await page.waitForTimeout(150);
  await releaseQuickly(page, [
    { x: b.x - 200, y: b.y + 25 },
    { x: b.x - 35, y: b.y + 25 },
  ]);
  await page.mouse.up();
  await expect.poll(() => evidence(page).then((e) => e.fragments), { timeout: 4000 }).toBeGreaterThan(0);
  expect(await page.locator("#main").innerText()).toBe(original);
  expect(
    await page
      .locator(".duh-loose-piece")
      .first()
      .evaluate((e) => getComputedStyle(e).pointerEvents)
  ).toBe("none");
  await expect.poll(() => evidence(page).then((e) => e.fragments), { timeout: 12000 }).toBe(0);
  expect(await page.locator("#main").innerText()).toBe(original);
  expect(errors).toEqual([]);
});

test("duh: lifecycle suspends rendering and refresh restores the intact default", async ({ page }) => {
  await page.clock.install();
  const errors = await open(page, "/blog/2024/");
  await page.clock.runFor(6200);
  expect((await evidence(page)).form).toBe("apple");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const before = await evidence(page);
  await page.waitForTimeout(350);
  expect((await evidence(page)).frames).toBe(before.frames);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => evidence(page).then((e) => e.frames)).toBeGreaterThan(before.frames);
  await page.reload();
  expect(await evidence(page)).toMatchObject({ state: "REST", form: "dot", fragments: 0, roughThrows: 0 });
  expect(errors).toEqual([]);
});

test("duh: homepage mode and Human/AI transitions keep one intentional companion", async ({ page }, info) => {
  const software = process.env.VISUAL_SCENE_BACKEND === "llvmpipe" || process.env.VISUAL_TRANSPORT_SOFTWARE === "1";
  test.setTimeout(software ? 600000 : 120000);
  test.skip(info.project.name !== "desktop-1440", "One full mode-integration proof; companion viewport and touch matrices run separately.");
  const errors = await open(page, "/", true);
  await expect(page.locator(".pip-companion")).toHaveCount(0);
  await expect(page.locator("[data-home-artifact-stage]")).toHaveAttribute("data-desk-mode", "2d");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  const scene = page.locator("[data-home-desk-scene]");
  await scene.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 90000 });
  await expect.poll(() => scene.evaluate((e) => e.getSceneEvidence().companion?.visible)).toBe(false);
  await expect(page.locator(".duh-companion")).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("duh-home-3d.png") });
  const canvas = scene.locator("canvas");
  const before = await canvas.screenshot();
  expect(screenshotMetrics(before).uniqueColors).toBeGreaterThan(60);
  // CI's trace showed 11s to focus and 25/30s per key while continuous
  // software frames monopolized the page. Keep the full scene and real keys,
  // but advance this functional sample explicitly after native readiness.
  if (software) {
    await pauseSceneClock(page);
    await useSoftwareSceneCadence(page);
    info.annotations.push({
      type: "functional clock",
      description: "Full assets; controlled Date/timers and 10 Hz software frames; no performance claim.",
    });
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await canvas.focus();
  await canvas.press("ArrowRight");
  await canvas.press("ArrowRight");
  if (software) await page.clock.runFor(350);
  else await page.waitForTimeout(350);
  const moving = await scene.evaluate((e) => e.getSceneEvidence());
  expect(Object.values(moving.cameraVelocity).every(Number.isFinite)).toBe(true);
  await canvas.press("ArrowLeft");
  await canvas.press("+");
  if (software) await page.clock.runFor(900);
  else await page.waitForTimeout(900);
  const after = await canvas.screenshot();
  expect(screenshotDiffRatio(before, after)).toBeGreaterThan(0.006);
  await page.screenshot({ path: info.outputPath("duh-home-3d-settled.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(async () => {
      if (software) await page.clock.runFor(100);
      return scene.evaluate((e) => Object.keys(e.getSceneEvidence().cameraVelocity).length);
    })
    .toBe(0);

  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator("[data-home-artifact-stage]")).toHaveAttribute("data-desk-mode", "2d");
  await page.locator('[data-site-format="ai"]').click();
  await expect(page.locator(".duh-companion,.pip-companion")).toHaveCount(0);
  await page.locator('[data-site-format="human"]').click();
  await expect(page.locator(".duh-companion")).toHaveCount(1);
  await expect(page.locator(".pip-companion")).toHaveCount(0);
  expect(errors).toEqual([]);
});

// Drag duh to a point and let go after a still moment, so the release is a drop rather than a
// throw (Zhiqing parked duh on the 3D home and on project cards, then could not pick it up again).
async function dropDuhOn(page, isMobile, point) {
  const start = await evidence(page);
  // The first move follows the press at once: a busy page could otherwise hold the press past
  // duh's 700 ms hold-to-sleep before any movement arrives.
  if (isMobile) {
    const touch = await page.context().newCDPSession(page);
    const t0 = Date.now() / 1000;
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", timestamp: t0, touchPoints: [{ x: start.x, y: start.y, id: 5 }] });
    for (let i = 1; i <= 8; i++)
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        timestamp: t0 + i * 0.016,
        touchPoints: [{ x: start.x + ((point.x - start.x) * i) / 8, y: start.y + ((point.y - start.y) * i) / 8, id: 5 }],
      });
    await expect.poll(() => evidence(page).then((e) => e.held && Math.hypot(e.x - point.x, e.y - point.y) < 30)).toBe(true);
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", timestamp: t0 + 0.55, touchPoints: [] });
    await touch.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(point.x, point.y, { steps: 8 });
    await expect.poll(() => evidence(page).then((e) => e.held && Math.hypot(e.x - point.x, e.y - point.y) < 30)).toBe(true);
    await page.waitForTimeout(150);
    await page.mouse.up();
  }
  expect((await evidence(page)).held).toBe(false);
}
// Press duh where it is drawn; true when the press picked duh up rather than the page beneath.
async function pressDuh(page, isMobile, at) {
  const p = at || (await evidence(page));
  if (isMobile) {
    const touch = await page.context().newCDPSession(page);
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y, id: 6 }] });
    const held = await expect
      .poll(() => evidence(page).then((e) => e.held), { timeout: 1500 })
      .toBe(true)
      .then(
        () => true,
        () => false
      );
    await touch.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await touch.detach();
    return held;
  }
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  const held = (await evidence(page)).held;
  await page.keyboard.press("Escape");
  await page.mouse.up();
  return held;
}
const overlaps = (p, box, half = 28) => p.x + half > box.x && p.x - half < box.x + box.width && p.y + half > box.y && p.y - half < box.y + box.height;

test("duh: dropped on a project card, it stays grabbable, hops clear, and the card still opens", async ({ page, isMobile }, info) => {
  await page.clock.install({ time: new Date("2026-10-09T08:00:00Z") });
  const errors = await open(page, "/projects/");
  await page.clock.pauseAt(new Date("2026-10-09T08:10:00Z"));
  const card = page.locator(".projects [data-project-card]").nth(isMobile ? 0 : 1);
  await card.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.clock.runFor(1600);
  await expect.poll(() => evidence(page).then((e) => e.visible && e.state === "REST" && !e.navigating)).toBe(true);
  const box = await card.boundingBox();
  const drop = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.3 };
  await dropDuhOn(page, isMobile, drop);
  // The physics clock is paused, so after one frame duh still hangs over the card where it was let
  // go. A press there must reach duh, not the card's full-size preview button underneath.
  await page.clock.runFor(32);
  const hanging = await evidence(page);
  expect(overlaps(hanging, box)).toBe(true);
  expect(hanging.grabbable).toBe(true);
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains("duh-hit"), hanging)).toBe(true);
  expect(await pressDuh(page, isMobile, hanging)).toBe(true);
  await expect(page.locator(".projects [data-project-card-state='expanded']")).toHaveCount(0);
  // Pointer moves over the card used to cancel duh's jump off it and strand it there.
  for (let i = 0; i < 10; i++) {
    if (!isMobile) await page.mouse.move(drop.x + i * 3, drop.y + i * 2);
    await page.clock.runFor(200);
  }
  const settled = await evidence(page);
  expect(settled).toMatchObject({ visible: true, grabbable: true, held: false, recovering: false });
  if (!settled.parked) expect(overlaps(settled, await card.boundingBox()), JSON.stringify(settled)).toBe(false);
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains("duh-hit"), settled)).toBe(true);
  expect(await pressDuh(page, isMobile)).toBe(true);
  await page.clock.runFor(400);
  await page.screenshot({ path: info.outputPath("duh-card-drop-settled.png") });
  // Away from duh, the card underneath answers as before.
  await card.locator("[data-project-card-trigger]").click({ position: { x: 12, y: 12 } });
  await expect(card).toHaveAttribute("data-project-card-state", "expanded");
  await page.keyboard.press("Escape");
  await expect(card).toHaveAttribute("data-project-card-state", "collapsed");
  expect(errors).toEqual([]);
});

test("duh: dropped on the 3D home, it can be caught, settles clear, and the canvas still turns the camera", async ({ page, isMobile }, info) => {
  // CI loads the house on a software GPU, like the other 3D home cases.
  const software = process.platform === "linux" || process.env.VISUAL_TRANSPORT_SOFTWARE === "1";
  test.setTimeout(software ? 900000 : 180000);
  test.skip(!["desktop-1440", "mobile-390"].includes(info.project.name), "One desktop and one phone viewport load the 3D home for this check.");
  // The house loads on a running clock; duh's physics are then paused and stepped, so a busy page
  // cannot move duh between a reading and a press.
  await page.clock.install();
  const errors = await open(page, "/");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  const scene = page.locator("[data-home-desk-scene]");
  if (isMobile) await page.evaluate(() => window.scrollTo({ top: 120, behavior: "instant" }));
  else await scene.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 120000 });
  // Let the rest of the house stream in first; its shader work stalls the page in steps.
  await expect.poll(() => scene.evaluate((node) => node.getSceneEvidence().roomCount), { timeout: 90000 }).toBeGreaterThanOrEqual(6);
  await expect
    .poll(() => evidence(page).then((e) => e.visible && e.state === "REST" && !e.navigating), { timeout: software ? 120000 : 20000 })
    .toBe(true);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
  if (software) await useSoftwareSceneCadence(page);
  const canvas = scene.locator("canvas.home-desk-corner-canvas");
  const orbit = () => scene.evaluate((node) => node.getSceneEvidence().cameraOrbit);
  const box = await canvas.boundingBox();
  const drop = { x: box.x + box.width * 0.5, y: box.y + Math.min(box.height * 0.4, 260) };
  await dropDuhOn(page, isMobile, drop);
  // Two frames into the fall duh is still over the canvas: pressing it catches duh, and the canvas
  // never sees the press.
  await page.clock.runFor(32);
  const falling = await evidence(page);
  expect(overlaps(falling, box), JSON.stringify({ drop, box, falling: { x: falling.x, y: falling.y, state: falling.state, vy: falling.vy } })).toBe(
    true
  );
  expect(falling.grabbable).toBe(true);
  expect(
    await page.evaluate(() => {
      const e = document.querySelector(".duh-companion").getDuhEvidence();
      return document.elementFromPoint(e.x, e.y)?.classList.contains("duh-hit");
    })
  ).toBe(true);
  await canvas.evaluate((node) => {
    window.__canvasPressed = false;
    node.addEventListener("pointerdown", () => (window.__canvasPressed = true), { once: true });
  });
  expect(await pressDuh(page, isMobile)).toBe(true);
  expect(await page.evaluate(() => window.__canvasPressed)).toBe(false);
  // Settled, duh is clear of the canvas (or, with nowhere clear, still visible and grabbable),
  // even with a pointer wandering over the canvas while it jumps off.
  for (let i = 0; i < 12; i++) {
    if (!isMobile) await page.mouse.move(drop.x + i * 4, drop.y + i * 3);
    await page.clock.runFor(250);
  }
  const settled = await evidence(page);
  expect(settled, JSON.stringify(settled)).toMatchObject({ visible: true, state: "REST", recovering: false, navigating: false });
  expect(settled.grabbable).toBe(true);
  if (!settled.parked) expect(overlaps(settled, await canvas.boundingBox()), JSON.stringify(settled)).toBe(false);
  expect(await pressDuh(page, isMobile)).toBe(true);
  await page.screenshot({ path: info.outputPath("duh-3d-drop-settled.png") });
  // Visit the unbounded study through its public keyboard shortcut. The live
  // routine can arrive in a narrow bath whose geometry blocks this fixed turn;
  // a blocked room angle there says nothing about duh capture.
  await canvas.scrollIntoViewIfNeeded();
  await canvas.press("Escape");
  await page.clock.runFor(800);
  expect(await scene.evaluate((node) => node.getSceneEvidence().currentRoom)).toBe("study");
  // Away from duh, a real drag across the visible canvas still turns the camera.
  const now = await canvas.boundingBox();
  const from = { x: now.x + now.width * 0.3, y: now.y + now.height * 0.55 };
  const to = { x: now.x + now.width * 0.7, y: from.y };
  const turning = await orbit();
  const targets = await canvas.evaluate((node, points) => points.map((p) => document.elementFromPoint(p.x, p.y) === node), [from, to]);
  expect(targets).toEqual([true, true]);
  if (isMobile) {
    const touch = await page.context().newCDPSession(page);
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 7 }] });
    for (let i = 1; i <= 8; i++)
      await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 8, y: from.y, id: 7 }] });
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await touch.detach();
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
  }
  await page.clock.runFor(800);
  const turned = await orbit();
  await info.attach("unobstructed-study-drag", {
    body: JSON.stringify({ turning, turned, from, to, targets, software }),
    contentType: "application/json",
  });
  expect(Math.abs(turned.yaw - turning.yaw)).toBeGreaterThan(0.02);
  expect(errors).toEqual([]);
});

test("duh: greeting is click-through and graphics failure retains accessible controls", async ({ page, isMobile }) => {
  const errors = await open(page);
  await page.locator("[data-duh-playground]").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Invite duh here", exact: true }).click();
  if (isMobile) {
    await page.locator(".duh-hit").press("h");
  } else {
    const p = await evidence(page);
    await page.mouse.move(p.x + 125, p.y - 15);
  }
  await expect.poll(() => evidence(page).then((e) => e.greeting), { timeout: 5000 }).toBe(true);
  expect(await page.locator(".duh-hit").evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
  await page.keyboard.press("Escape");
  expect(await evidence(page)).toMatchObject({ state: "REST", greeting: false });
  await page.mouse.move(1, 1);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === "2d" ? null : original.call(this, type, ...args);
    };
  });
  await page.goto(publicRouteUrl("/blog/2024/"));
  await expect(page.locator(".duh-companion")).toHaveAttribute("data-fallback", "true");
  await pause(page);
  expect((await evidence(page)).paused).toBe(true);
  await reset(page);
  expect((await evidence(page)).paused).toBe(false);
  expect(errors).toEqual([]);
});

test("duh: definition lists, plain captions and project facts remain protected reading", async ({ page }) => {
  const errors = await open(page, "/blog/2024/", true);
  for (const [tag, className, html] of [
    ["dl", "", "<dt>A definition</dt><dd>Its explanation stays readable.</dd>"],
    ["figcaption", "", "A standalone figure caption."],
    ["div", "caption", "A plain caption retains its text."],
    ["div", "project-case-facts", "<span>A project fact</span><span>Another fact</span>"],
  ]) {
    await page.evaluate(
      ({ tag, className, html }) => {
        const reading = document.createElement(tag);
        reading.dataset.duhReadingProbe = "";
        reading.className = className;
        reading.innerHTML = html;
        Object.assign(reading.style, { position: "fixed", inset: "75px 0 0", margin: "0" });
        document.querySelector("#main").append(reading);
      },
      { tag, className, html }
    );
    await expect.poll(() => evidence(page).then((e) => e.visible)).toBe(false);
    expect(await page.locator(".duh-hit").evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
    expect(await page.locator("[data-duh-reading-probe]").innerText()).not.toBe("");
    await page.locator("[data-duh-reading-probe]").evaluate((e) => e.remove());
  }
  expect(errors).toEqual([]);
});

test("duh: body padding refreshes clearance when main only changes position", async ({ page }) => {
  const errors = await open(page, "/blog/2024/", true);
  await page.evaluate(() => {
    document.querySelector("#main").style.position = "relative";
  });
  await page.waitForTimeout(100);
  const before = await evidence(page);
  const geometry = await page.evaluate(({ x, y }) => {
    const main = document.querySelector("#main"),
      r = main.getBoundingClientRect();
    // This archive uses flex growth; hold its existing height so the probe
    // isolates an origin shift rather than a ResizeObserver notification.
    Object.assign(main.style, { height: `${r.height}px`, minHeight: `${r.height}px`, flex: "none" });
    const reading = document.createElement("div");
    reading.className = "caption";
    reading.dataset.duhReadingProbe = "";
    reading.textContent = "Reading in a shifted caption";
    Object.assign(reading.style, {
      position: "absolute",
      left: `${x - r.left - 43}px`,
      top: `${y - r.top - 170}px`,
      width: "86px",
      height: "60px",
      margin: "0",
    });
    main.append(reading);
    return { height: r.height, top: r.top };
  }, before);
  await expect.poll(() => evidence(page).then((e) => e.layoutScans)).toBeGreaterThan(before.layoutScans);
  const scans = (await evidence(page)).layoutScans;
  await page.evaluate(() => {
    document.body.style.paddingTop = `${parseFloat(getComputedStyle(document.body).paddingTop) + 140}px`;
  });
  await expect.poll(() => evidence(page).then((e) => e.layoutScans)).toBeGreaterThan(scans);
  const after = await page.locator("#main").boundingBox();
  expect(after.height).toBeCloseTo(geometry.height, 0);
  expect(after.y - geometry.top).toBeCloseTo(140, 0);
  expect(
    await page.evaluate(() => {
      const p = document.querySelector(".duh-companion").getDuhEvidence();
      const r = document.querySelector("[data-duh-reading-probe]").getBoundingClientRect();
      return !p.visible || p.x + 28 <= r.left || p.x - 28 >= r.right || p.y + 28 <= r.top || p.y - 28 >= r.bottom;
    })
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("duh: a new reading layout cancels an approach before it can resume toward stale coordinates", async ({ page, isMobile }) => {
  test.skip(isMobile, "Automatic cursor approaches require a fine pointer.");
  const errors = await open(page);
  await page.locator("[data-duh-playground]").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Invite duh here", exact: true }).click();
  const p = await evidence(page);
  await page.mouse.move(p.x + 125, p.y - 15);
  await expect.poll(() => evidence(page).then((e) => e.greeting)).toBe(true);
  await page.evaluate(() => {
    const reading = document.createElement("div");
    reading.className = "caption";
    reading.dataset.duhReadingProbe = "";
    reading.textContent = "A newly expanded reading region.";
    Object.assign(reading.style, { position: "fixed", inset: "75px 0 0" });
    document.querySelector("#main").append(reading);
  });
  await expect.poll(() => evidence(page).then((e) => e.greeting)).toBe(false);
  await expect.poll(() => evidence(page).then((e) => e.visible)).toBe(false);
  await page.waitForTimeout(1000);
  expect(await evidence(page)).toMatchObject({ state: "REST", greeting: false, visible: false });
  await page.locator("[data-duh-reading-probe]").evaluate((e) => e.remove());
  await reset(page);
  expect((await evidence(page)).greeting).toBe(false);
  expect(errors).toEqual([]);
});

test("duh: a real paragraph receives a reversible impact and an active repair", async ({ page, isMobile }, info) => {
  test.skip(isMobile || !["desktop-1440", "laptop-1280"].includes(info.project.name), "A side throw needs the desktop reading margin.");
  const errors = await open(page);
  // WAAPI uses the native document timeline even when the physics clock is fake.
  await page.evaluate(() => {
    window.duhNativeTiming = { frame: requestAnimationFrame.bind(window), timeout: setTimeout.bind(window) };
  });
  await page.clock.install();
  const paragraph = page.locator(".duh-introduction > p").filter({ hasText: "Meet duh," });
  const original = await paragraph.innerHTML(),
    r = await paragraph.boundingBox(),
    p = await evidence(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(r.x - 200, r.y + 25);
  await page.clock.runFor(150);
  await releaseQuickly(page, [
    { x: r.x - 180, y: r.y + 25 },
    { x: r.x - 36, y: r.y + 25 },
  ]);
  await page.mouse.up();
  await page.clock.runFor(250);
  expect((await evidence(page)).pageContacts).toBeGreaterThan(0);
  expect((await evidence(page)).displaced).toBeGreaterThan(0);
  expect(await paragraph.innerHTML()).toBe(original);
  // Browser WAAPI time is independent of the mocked physics clock. Inspect
  // one actual early contact pose rather than a random zero crossing.
  await paragraph.evaluate((node) => {
    for (const a of node.getAnimations()) {
      a.pause();
      a.currentTime = 90;
    }
  });
  const changed = await paragraph.boundingBox();
  expect(Math.hypot(changed.x - r.x, changed.y - r.y)).toBeGreaterThan(0.15);
  expect(Math.hypot(changed.x - r.x, changed.y - r.y)).toBeLessThan(6);
  await page.screenshot({ path: info.outputPath("paragraph-contact.png") });
  await paragraph.evaluate((node) => node.getAnimations().forEach((a) => a.play()));
  const states = new Set();
  for (let i = 0; i < 70; i++) {
    await page.clock.runFor(100);
    states.add((await evidence(page)).state);
  }
  expect(states.has("TIDY")).toBe(true);
  expect((await evidence(page)).repairs).toBeGreaterThan(0);
  expect((await evidence(page)).displaced).toBe(0);
  const repaired = await paragraph.boundingBox();
  expect(repaired.x).toBeCloseTo(r.x, 1);
  expect(repaired.y).toBeCloseTo(r.y, 1);
  expect(await paragraph.innerHTML()).toBe(original);
  for (const interruption of ["selection", "reduced"]) {
    await page.locator(".duh-hit").press("r");
    await page.clock.runFor(30);
    const p = await evidence(page);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(r.x - 200, r.y + 25);
    await page.clock.runFor(150);
    await releaseQuickly(page, [
      { x: r.x - 180, y: r.y + 25 },
      { x: r.x - 36, y: r.y + 25 },
    ]);
    await page.mouse.up();
    await page.clock.runFor(250);
    expect((await evidence(page)).displaced).toBeGreaterThan(0);
    if (interruption === "selection") {
      await paragraph.evaluate((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
      });
      await page.clock.runFor(20);
      expect(await page.evaluate(() => getSelection().toString())).toContain("Meet duh");
      await page.evaluate(() => getSelection().removeAllRanges());
    } else await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.runFor(30);
    await expect.poll(() => evidence(page).then((e) => e.displaced)).toBe(0);
    expect((await paragraph.boundingBox()).x).toBeCloseTo(r.x, 1);
    expect(await paragraph.innerHTML()).toBe(original);
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await paragraph.evaluate((node) => {
    const link = document.createElement("a");
    link.href = "#duh-title";
    link.textContent = "A reading link";
    link.dataset.duhLinkProbe = "";
    node.append(" ", link);
  });
  await page.locator(".duh-hit").press("r");
  await page.clock.runFor(50);
  const linkedRect = await paragraph.boundingBox(),
    p2 = await evidence(page);
  await page.mouse.move(p2.x, p2.y);
  await page.mouse.down();
  await page.mouse.move(linkedRect.x - 200, linkedRect.y + 25);
  await page.clock.runFor(150);
  await releaseQuickly(page, [
    { x: linkedRect.x - 180, y: linkedRect.y + 25 },
    { x: linkedRect.x - 36, y: linkedRect.y + 25 },
  ]);
  await page.mouse.up();
  await page.clock.runFor(250);
  expect((await evidence(page)).displaced).toBeGreaterThan(0);
  const link = page.locator("[data-duh-link-probe]");
  // Press between native animation frames, then let the pending pause resolve.
  // Measuring only after mouse.down() can miss the final frame on a slow host.
  const boundary = await link.evaluate(async (node) => {
    const animation = node.parentElement.getAnimations()[0];
    if (!animation) throw new Error("Missing paragraph impact animation");
    animation.play();
    await animation.ready;
    const { frame, timeout } = window.duhNativeTiming;
    const sample = () => ({
      x: node.getBoundingClientRect().x,
      y: node.getBoundingClientRect().y,
      time: animation.currentTime,
      pending: animation.pending,
    });
    return new Promise((resolve) =>
      frame(() => {
        animation.currentTime = 90;
        frame(() =>
          timeout(() => {
            const before = sample();
            node.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", isPrimary: true }));
            const pressed = sample();
            frame(() => frame(() => resolve({ before, pressed, settled: sample() })));
          }, 0)
        );
      })
    );
  });
  expect(boundary.settled.x).toBeCloseTo(boundary.before.x, 1);
  expect(boundary.settled.y).toBeCloseTo(boundary.before.y, 1);
  expect(boundary.pressed.pending).toBe(false);
  expect(boundary.settled.time).toBeCloseTo(boundary.before.time, 5);
  // Retain the native mouse/link journey with a running impact as well.
  await link.evaluate(async (node) => {
    const animation = node.parentElement.getAnimations()[0];
    animation.play();
    await animation.ready;
  });
  const box = await link.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const frozen = await link.boundingBox();
  await page.clock.runFor(600);
  const stable = await link.boundingBox();
  expect(stable.x).toBeCloseTo(frozen.x, 1);
  expect(stable.y).toBeCloseTo(frozen.y, 1);
  await page.mouse.up();
  await expect(page).toHaveURL(/#duh-title$/);
  expect((await evidence(page)).displaced).toBe(0);
  expect(errors).toEqual([]);
});

test("duh: autonomous movement and grip jiggle are observable and reduced motion stops both", async ({ page, isMobile }, info) => {
  await page.clock.install();
  const errors = await open(page);
  await page.locator("[data-duh-playground]").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Invite duh here", exact: true }).click();
  await page.clock.runFor(9000);
  const autonomous = await evidence(page);
  expect(autonomous.outings).toBeGreaterThan(0);
  expect(autonomous.roughThrows).toBe(0);
  if (!isMobile) {
    await page.locator(".duh-hit").press("r");
    const p = await evidence(page);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x - 50, p.y - 25);
    await page.clock.runFor(60);
    const a = await evidence(page);
    await page.mouse.move(p.x + 50, p.y + 20);
    await page.clock.runFor(60);
    const b = await evidence(page);
    expect(Math.abs(a.body.x - b.body.x) + Math.abs(a.body.y - b.body.y)).toBeGreaterThan(0.2);
    await page.screenshot({ path: info.outputPath("held-jelly.png") });
    await page.keyboard.press("Escape");
    await page.mouse.up();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  const still = await evidence(page);
  await page.clock.runFor(30000);
  const later = await evidence(page);
  expect(later.outings).toBe(still.outings);
  expect(later.form).toBe(still.form);
  expect(later.displaced).toBe(0);
  expect(later.body.x).toBe(0);
  expect(later.body.y).toBe(0);
  expect(later.frames - still.frames).toBeLessThan(40);
  expect(errors).toEqual([]);
});

test("duh: pets and harmless reflow preserve position; shadows follow height and recovery stays bounded", async ({ page, isMobile }, info) => {
  await page.clock.install({ time: new Date("2026-10-09T08:00:00Z") });
  const errors = await open(page);
  await page.clock.pauseAt(new Date("2026-10-09T08:10:00Z"));
  await page.evaluate(() => document.fonts.ready);
  await page.locator("[data-duh-playground]").evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.getByRole("button", { name: "Invite duh here", exact: true }).click();
  await page.clock.runFor(400);
  const original = await evidence(page);
  for (let i = 0; i < 6; i++) {
    await page.locator(".duh-hit").press("Enter");
    await page.evaluate(() => {
      const note = document.createElement("span");
      note.hidden = true;
      note.textContent = "Layout notification";
      document.querySelector("#main").append(note);
      note.remove();
    });
    await page.clock.runFor(950);
    const next = await evidence(page);
    expect(
      Math.hypot(next.x - original.x, next.y - original.y),
      JSON.stringify({ original, next, scroll: await page.evaluate(() => scrollY) })
    ).toBeLessThan(0.5);
  }
  if (!isMobile) {
    await page.mouse.move(original.x, original.y);
    await page.mouse.down();
    expect((await evidence(page)).state).toBe("HELD");
    await page.mouse.move(original.x, original.y - 80);
    await page.clock.runFor(100);
    const lifted = await evidence(page);
    expect(lifted.elevation).toBeGreaterThan(65);
    expect(Number(await page.locator(".duh-shadow").evaluate((e) => getComputedStyle(e).opacity))).toBeLessThan(0.1);
    await page.screenshot({ path: info.outputPath("lifted-shadow.png") });
    await page.keyboard.press("Escape");
    await page.mouse.up();
  }
  await pause(page);
  await page.clock.runFor(100);
  expect((await evidence(page)).paused).toBe(true);
  await page.locator(".duh-hit").press("Enter");
  expect((await evidence(page)).paused).toBe(false);
  await page.getByRole("button", { name: "Invite duh here", exact: true }).click();
  await page.clock.runFor(60);
  await page.locator(".duh-hit").dblclick({ delay: 80 });
  expect((await evidence(page)).inviteArmed).toBe(true);
  const beforeInvite = await evidence(page);
  const destination = await page.evaluate(({ x, y }) => {
    // Reproduce P wandering over the former blind 70px-left click. P is a
    // native project link; clicking it reloads this page and resets Duh.
    const pip = document.querySelector(".pip-companion"),
      hit = pip.querySelector(".pip-hit");
    const rect = hit.getBoundingClientRect(),
      transform = new DOMMatrix(getComputedStyle(pip).transform);
    transform.e += x - 70 - rect.x - rect.width / 2;
    transform.f += y - rect.y - rect.height / 2;
    pip.style.transform = transform.toString();
    pip.style.opacity = "1";
    hit.style.pointerEvents = "auto";
    if (!document.elementFromPoint(x - 70, y)?.closest(".pip-hit")) throw new Error("P must cover the first destination");
    const interactive = "a,button,input,select,textarea,summary,[role='button'],[contenteditable='true'],[tabindex]:not([tabindex='-1'])";
    const stage = document.querySelector("[data-duh-playground]");
    const point = [x - 70, x + 70]
      .map((x) => ({ x, y }))
      .find((point) => {
        const target = document.elementFromPoint(point.x, point.y);
        return target && stage.contains(target) && !target.closest(interactive);
      });
    if (!point) throw new Error("No clear nearby invitation destination");
    return point;
  }, beforeInvite);
  expect(destination.x).toBe(beforeInvite.x + 70);
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  await page.mouse.click(destination.x, destination.y);
  await page.clock.runFor(1400);
  const afterInvite = await evidence(page);
  expect(navigations).toBe(0);
  expect(Math.abs(afterInvite.x - destination.x), JSON.stringify({ beforeInvite, afterInvite, destination })).toBeLessThan(1);
  expect(Math.abs(afterInvite.y - destination.y)).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test("scene refinement: miniature reversals settle smoothly and reduced motion composes immediately", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await preparePage(page, "light");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date("2026-10-09T08:00:00Z") });
  await page.goto(publicRouteUrl("/projects/la-jolla/"), { waitUntil: "load" });
  const host = page.locator("[data-miniature]");
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  await expect(host).toHaveAttribute("data-running", "true");
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
  const scene = host.locator(".footer-coast__scene");
  const pose = () => host.evaluate((e) => e.getCoastEvidence());
  const before = await pose();
  await scene.press("ArrowLeft");
  expect((await pose()).renderedOrbit).toEqual(before.renderedOrbit);
  await page.clock.runFor(100);
  const traveling = await pose();
  expect(traveling.renderedOrbit[0]).toBeLessThan(0);
  expect(traveling.renderedOrbit[0]).toBeGreaterThan(traveling.orbit[0]);
  expect(traveling.motion.orbitX).toBeLessThan(0);
  await scene.press("ArrowRight");
  expect((await pose()).renderedOrbit).toEqual(traveling.renderedOrbit);
  expect((await pose()).motion.orbitX).toBe(traveling.motion.orbitX);
  await page.clock.runFor(900);
  expect(Math.abs((await pose()).renderedOrbit[0])).toBeLessThan(0.001);
  await scene.press("ArrowLeft");
  await page.clock.runFor(100);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(host).toHaveAttribute("data-running", "false");
  await scene.press("Home");
  const still = await pose();
  expect(still.renderedOrbit).toEqual([0, 0]);
  expect(still.motion).toEqual({});
  await page.clock.runFor(500);
  expect((await pose()).frames).toBe(still.frames);
  expect((await pose()).resources).toEqual(before.resources);
  expect(errors).toEqual([]);
});

test("duh mobile: scrolling and browser-bar resizing preserve position and settle without jumps", async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile);
  await page.clock.install({ time: new Date("2026-10-09T08:00:00Z") });
  const errors = await open(page);
  await page.evaluate(() => document.querySelector("[data-duh-playground]").scrollIntoView({ block: "center", behavior: "instant" }));
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
  await page.clock.runFor(600);
  await page.getByRole("button", { name: "Invite duh here", exact: true }).click();
  await page.clock.runFor(100);
  const original = await page.locator("#main").innerText();
  const before = await evidence(page);
  await page.evaluate(() => {
    window.duhViewportFrames = [];
    window.duhViewportSampling = true;
    function sample() {
      const e = document.querySelector(".duh-companion").getDuhEvidence();
      window.duhViewportFrames.push({ x: e.x, y: e.y, visible: e.visible });
      if (window.duhViewportSampling) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.scrollBy({ top: 35, behavior: "instant" }));
    await page.clock.runFor(40);
    const p = await evidence(page);
    expect(Math.hypot(p.x - before.x, p.y - before.y)).toBeLessThan(1);
  }
  await page.clock.runFor(2200);
  const size = page.viewportSize();
  const atResize = await evidence(page);
  await page.setViewportSize({ width: size.width, height: Math.max(430, size.height - 220) });
  await page.clock.runFor(16);
  const early = await evidence(page);
  expect(Math.hypot(early.x - atResize.x, early.y - atResize.y)).toBeLessThan(1);
  await page.clock.runFor(2600);
  const settled = await evidence(page);
  expect(settled.recovering).toBe(false);
  expect(settled.x).toBeGreaterThanOrEqual(settled.bounds.left - 1);
  expect(settled.x).toBeLessThanOrEqual(settled.bounds.right + 1);
  expect(settled.y).toBeLessThanOrEqual(settled.bounds.bottom + 1);
  const frames = await page.evaluate(() => {
    window.duhViewportSampling = false;
    return window.duhViewportFrames;
  });
  expect(Math.max(...frames.slice(1).map((p, i) => Math.hypot(p.x - frames[i].x, p.y - frames[i].y)))).toBeLessThan(18);
  expect(await page.locator("#main").innerText()).toBe(original);
  expect(settled.viewport.height).toBeCloseTo(await page.evaluate(() => visualViewport.height), 0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.runFor(50);
  const quiet = await evidence(page);
  await page.evaluate(() => window.scrollBy({ top: 90, behavior: "instant" }));
  await page.clock.runFor(500);
  expect((await evidence(page)).x).toBeCloseTo(quiet.x, 1);
  expect((await evidence(page)).y).toBeCloseTo(quiet.y, 1);
  await page.screenshot({ path: testInfo.outputPath("mobile-scroll-settled.png") });
  expect(errors).toEqual([]);
});

test("duh mobile: settles clear of the research sketch and the Connect miniature", async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, "Phones leave no reading margin beside these figures; desktop perches in the gutter.");
  await page.clock.install({ time: new Date("2026-10-09T08:00:00Z") });
  const errors = await open(page, "/");
  // The research canvas is aria-hidden for assistive tech, but it is still the section's primary figure.
  for (const selector of ["[data-research-motion][data-duh-protect]", "figure.coastal-miniature"]) {
    const figure = page.locator(selector).first();
    await figure.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
    for (const wait of [3000, 4000]) {
      await page.clock.runFor(wait);
      const duh = await evidence(page);
      const box = await figure.boundingBox();
      const half = 28;
      const overlaps =
        duh.visible &&
        Boolean(box) &&
        duh.x + half > box.x &&
        duh.x - half < box.x + box.width &&
        duh.y + half > box.y &&
        duh.y - half < box.y + box.height;
      expect(overlaps, `duh rests on ${selector} ${wait} ms after scrolling`).toBe(false);
    }
  }
  await page.screenshot({ path: testInfo.outputPath("mobile-figure-clearance.png") });
  expect(errors).toEqual([]);
});

test("duh mobile: capture survives viewport resize, release throws, and extra touches cancel safely", async ({ page, isMobile, browserName }) => {
  test.skip(!isMobile);
  await page.clock.install({ time: new Date("2026-10-09T08:00:00Z") });
  const errors = await open(page, "/blog/2024/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("footer [data-footer-coast]")).toHaveAttribute("data-state", "ready", { timeout: 30000 });
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10000);
  await reset(page);
  await page.clock.runFor(1200);
  // The async footer may change its focusable area after its first render.
  await expect
    .poll(
      async () => {
        await page.clock.runFor(100);
        const p = await evidence(page);
        return page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.classList.contains("duh-hit"), p);
      },
      { timeout: 5000, intervals: [100] }
    )
    .toBe(true);
  const start = await evidence(page);
  const touch = browserName === "chromium" ? await page.context().newCDPSession(page) : null;
  const timestamp = Date.now() / 1000;
  if (touch) await touch.send("Input.dispatchTouchEvent", { type: "touchStart", timestamp, touchPoints: [{ x: start.x, y: start.y, id: 1 }] });
  else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
  }
  await expect.poll(() => evidence(page).then((e) => e.held)).toBe(true);
  expect((await evidence(page)).recovering).toBe(false);
  const pointer = (await evidence(page)).pointerId;
  const size = page.viewportSize();
  await page.setViewportSize({ width: size.width, height: size.height - 100 });
  await page.clock.runFor(32);
  expect((await evidence(page)).held).toBe(true);
  expect((await evidence(page)).pointerId).toBe(pointer);
  expect((await evidence(page)).y).toBeCloseTo(start.y, 1);
  if (touch) {
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      timestamp: timestamp + 0.04,
      touchPoints: [{ x: start.x - 25, y: start.y - 30, id: 1 }],
    });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      timestamp: timestamp + 0.08,
      touchPoints: [{ x: start.x - 65, y: start.y - 70, id: 1 }],
    });
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", timestamp: timestamp + 0.1, touchPoints: [] });
  } else {
    await releaseQuickly(page, [
      { x: start.x - 25, y: start.y - 30 },
      { x: start.x - 65, y: start.y - 70 },
    ]);
    await page.mouse.up();
  }
  await expect.poll(() => evidence(page).then((e) => e.state)).toBe("AIRBORNE");
  const released = await evidence(page);
  expect(released.vx).toBeLessThan(-100);
  expect(released.vy).toBeLessThan(-100);
  expect(Math.hypot(released.vx, released.vy)).toBeLessThanOrEqual(1200);
  await reset(page);
  await page.clock.runFor(2200);
  const p = await evidence(page);
  expect(p.recovering).toBe(false);
  if (touch) {
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
    await expect.poll(() => evidence(page).then((e) => e.held)).toBe(true);
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: p.x, y: p.y, id: 1 },
        { x: 30, y: 450, id: 2 },
      ],
    });
    await expect.poll(() => evidence(page).then((e) => e.held)).toBe(false);
    await touch.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    expect((await evidence(page)).roughThrows).toBe(0);
    await page.clock.resume();
    await page.goto(publicRouteUrl("/projects/p/"), { waitUntil: "load" });
    const scroll = await page.evaluate(() => scrollY);
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 40, y: 500, id: 7 }] });
    for (const y of [470, 410, 350, 290, 230]) {
      await page.waitForTimeout(30);
      await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 40, y, id: 7 }] });
    }
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll);
    await touch.detach();
  } else {
    // WebKit's driver exposes native tap and mouse capture, not a touch-drag API.
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect((await evidence(page)).held).toBe(false);
    await page.touchscreen.tap(p.x, p.y);
    expect((await evidence(page)).mood).toBe("happy");
    await page.clock.resume();
    await page.goto(publicRouteUrl("/projects/p/"), { waitUntil: "load" });
    const scroll = await page.evaluate(() => scrollY);
    // Mobile WebKit has neither a wheel nor touch-drag driver API.
    // Its scroll/viewport rendering is checked here; native panning is above.
    await page.evaluate(() => window.scrollBy({ top: 260, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll);
  }
  expect(await page.locator(".duh-hit").evaluate((e) => getComputedStyle(e).touchAction)).toBe("none");
  expect(await page.locator("body").evaluate((e) => getComputedStyle(e).touchAction)).not.toBe("none");
  expect(errors).toEqual([]);
});
