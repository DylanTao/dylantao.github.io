const { test, expect } = require("@playwright/test");
const { publicRouteUrl } = require("./public-routes");
const { preparePage, collectRuntimeErrors, screenshotDiffRatio, screenshotMetrics } = require("./helpers");
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
  await page.waitForTimeout(100);
  const originallyVisible = (await evidence(page)).visible;
  await page.evaluate(() => {
    const p = document.createElement("figure");
    p.dataset.duhProbe = "";
    p.textContent = "An expanded reading surface.";
    Object.assign(p.style, { position: "fixed", inset: "75px 0 0", margin: "0" });
    document.querySelector("#main").append(p);
  });
  await expect.poll(() => evidence(page).then((e) => e.visible)).toBe(false);
  await page.locator("[data-duh-probe]").evaluate((e) => e.remove());
  await expect.poll(() => evidence(page).then((e) => e.visible)).toBe(originallyVisible);
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

test("duh: visible recovery controls follow pointer, keyboard and invitation state", async ({ page }, info) => {
  await page.clock.install();
  const errors = await open(page);
  const controls = page.getByRole("group", { name: "duh controls", exact: true });
  await controls.scrollIntoViewIfNeeded();
  const invite = page.getByRole("button", { name: "Invite duh here", exact: true });
  await invite.click();
  const pauseControl = controls.getByRole("button", { name: "Pause duh", exact: true });
  // Safari does not focus buttons on a pointer click. Verify keyboard focus
  // retention through a keyboard activation, without changing native behavior.
  await pauseControl.focus();
  await pauseControl.press("Enter");
  const resume = controls.getByRole("button", { name: "Resume duh", exact: true });
  await expect(resume).toBeFocused();
  await expect(page.getByRole("button", { name: "Wake duh", exact: true })).toHaveCount(1);
  await page.clock.runFor(100);
  const sleeping = await evidence(page);
  await page.clock.runFor(1200);
  expect((await evidence(page)).frames - sleeping.frames).toBeLessThan(2);
  await resume.click();
  expect((await evidence(page)).paused).toBe(false);
  await pause(page);
  await expect(resume).toBeVisible();
  await invite.click();
  await expect(page.getByRole("button", { name: "Pet duh", exact: true })).toHaveCount(1);
  await expect(controls.getByRole("button", { name: "Pause duh", exact: true })).toBeVisible();
  await toss(page);
  const resetButton = controls.getByRole("button", { name: "Reset duh", exact: true });
  await resetButton.focus();
  await resetButton.press("Enter");
  await expect(resetButton).toBeFocused();
  expect(await evidence(page)).toMatchObject({ paused: false, held: false, state: "REST", roughThrows: 0, fragments: 0, displaced: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("visible-controls.png") });
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
  test.setTimeout(120000);
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
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await canvas.focus();
  await canvas.press("ArrowRight");
  await canvas.press("ArrowRight");
  await page.waitForTimeout(350);
  const moving = await scene.evaluate((e) => e.getSceneEvidence());
  expect(Object.values(moving.cameraVelocity).every(Number.isFinite)).toBe(true);
  await canvas.press("ArrowLeft");
  await canvas.press("+");
  await page.waitForTimeout(900);
  const after = await canvas.screenshot();
  expect(screenshotDiffRatio(before, after)).toBeGreaterThan(0.006);
  await page.screenshot({ path: info.outputPath("duh-home-3d-settled.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => scene.evaluate((e) => Object.keys(e.getSceneEvidence().cameraVelocity).length)).toBe(0);

  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator("[data-home-artifact-stage]")).toHaveAttribute("data-desk-mode", "2d");
  await page.locator('[data-site-format="ai"]').click();
  await expect(page.locator(".duh-companion,.pip-companion")).toHaveCount(0);
  await page.locator('[data-site-format="human"]').click();
  await expect(page.locator(".duh-companion")).toHaveCount(1);
  await expect(page.locator(".pip-companion")).toHaveCount(0);
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
  await page.mouse.click(beforeInvite.x - 70, beforeInvite.y);
  await page.clock.runFor(1400);
  const afterInvite = await evidence(page);
  expect(Math.abs(afterInvite.x - beforeInvite.x + 70), JSON.stringify({ beforeInvite, afterInvite })).toBeLessThan(1);
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
