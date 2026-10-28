// Owned read-only browser inspection. Commands use public controls, physical
// keyboard input or explicitly labeled authoring-lab camera/station placement.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  readline = require("node:readline");
const { chromium } = require("playwright");
const { preparePage } = require(path.join(process.cwd(), "test/visual/helpers"));
const QA = path.join(process.cwd(), ".jekyll-cache/visual-qa/sweep-2026-10-28");
let browser,
  page,
  scene,
  ui,
  responses = [],
  errors = [],
  actions = [],
  pending = [],
  serial = 0;
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const save = (name, value) => fs.writeFile(path.join(QA, name), JSON.stringify(value, null, 2) + "\n");
const evidence = () => scene.evaluate((e) => e.getSceneEvidence());
const summary = (e) => ({
  ready: e.ready,
  room: e.currentRoom,
  activity: e.activity,
  avatar: e.avatarId,
  frames: e.frames,
  actorCount: e.actorCount,
  roomCount: e.roomCount,
  camera: e.camera,
  target: e.target,
  canvas: [e.canvasWidth, e.canvasHeight],
  walk: e.walk,
  lightCache: e.simulation?.lightCache,
  lightField: e.simulation?.lightField
    ? { ready: e.simulation.lightField.ready, triangles: e.simulation.lightField.triangles, error: e.simulation.lightField.error }
    : null,
  estateDoors: e.simulation?.estateDoors,
});
async function open(c = {}) {
  if (page) await page.close();
  responses = [];
  errors = [];
  actions = [];
  pending = [];
  page = await browser.newPage({
    viewport: { width: c.width || 1440, height: c.height || 1000 },
    deviceScaleFactor: c.dpr || 1,
    isMobile: !!c.phone,
    hasTouch: !!c.phone,
    reducedMotion: c.motion || "reduce",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
    const headers = r.headers();
    if (headers["x-sweep-source"] === "frozen")
      pending.push(
        (async () => {
          let b,
            bodyReadback = "browser";
          try {
            b = await r.body();
          } catch {
            b = Buffer.from(await (await fetch(r.url())).arrayBuffer());
            bodyReadback = "independent raw HTTP after browser body was unavailable";
          }
          responses.push({
            url: r.url(),
            status: r.status(),
            bytes: b.length,
            sha256: sha(b),
            sourceSha256: headers["x-sweep-sha256"],
            matchesFrozenBytes: sha(b) === headers["x-sweep-sha256"],
            bodyReadback,
          });
        })().catch((e) => errors.push(`Source readback ${r.url()}: ${e.message}`))
      );
  });
  await preparePage(page, "light");
  await page.clock.setFixedTime(new Date(c.time || "2026-10-26T14:00:00-07:00"));
  await page.goto("http://127.0.0.1:4118/al-folio/?scene-lab=1&quality=high&resolution=fixed", { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-desk-mode="3d"]').click();
  scene = page.locator("[data-home-desk-scene]");
  ui = page.locator("[data-home-world-controls]");
  await scene.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 180000 });
  await ui.locator("[data-world-fullscreen]").click();
  await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence().fullscreen, null, { timeout: 30000 });
  await page.waitForTimeout(300);
  const e = await evidence();
  await save("initial-state.json", e);
  await shot(c.name || "initial");
  return summary(e);
}
async function shot(name) {
  await page.waitForTimeout(180);
  const e = await evidence();
  const canvas = scene.locator("canvas:not(.home-world-sketch)").first();
  const bytes = await canvas.screenshot({ path: path.join(QA, name + ".png") });
  await Promise.all(pending);
  const result = {
    state: e,
    actions: [...actions],
    responses: [...responses],
    errors: [...errors],
    image: { file: name + ".png", bytes: bytes.length, sha256: sha(bytes) },
  };
  await save(name + ".json", result);
  return { file: name + ".png", state: summary(e), errors };
}
async function lab(open = true) {
  const details = ui.locator("[data-world-lab]");
  if ((await details.evaluate((e) => e.open)) !== open) await details.locator("summary").first().click();
}
async function visit(id) {
  if ((await evidence()).walk?.active) await page.locator("[data-world-walk]").click();
  await lab(true);
  await ui.locator(`[data-world-room="${id}"]`).click();
  await lab(false);
  await page.waitForFunction((id) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().currentRoom === id, id, { timeout: 30000 });
  await page.waitForTimeout(250);
  actions.push({ type: "public-room-visit", id });
  return summary(await evidence());
}
async function keys(c) {
  for (const key of c.keys) await page.keyboard.down(key);
  await page.waitForTimeout(c.ms);
  for (const key of [...c.keys].reverse()) await page.keyboard.up(key);
  await page.waitForTimeout(c.rest ?? 180);
  actions.push({ type: "public-keys", keys: c.keys, holdMilliseconds: c.ms });
  return summary(await evidence());
}
async function route(c) {
  const samples = [],
    events = [];
  let failed = null;
  const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  for (let index = 0; index < c.points.length; index++) {
    const target = c.points[index];
    let start = await evidence(),
      point = start.walk.position;
    if (Math.hypot(point[0] - target[0], point[2] - target[2]) < 0.16) continue;
    let lastDistance = Infinity,
      stalled = 0;
    for (let tick = 0; tick < 320; tick++) {
      const current = await evidence(),
        w = current.walk;
      point = w.position;
      const dx = target[0] - point[0],
        dz = target[2] - point[2],
        distance = Math.hypot(dx, dz),
        delta = norm(Math.atan2(dx, dz) - w.yaw);
      samples.push({
        index,
        tick,
        position: point,
        camera: current.camera,
        yaw: w.yaw,
        room: w.room,
        blockedFrames: w.blockedFrames,
        lastBlocked: w.lastBlocked,
        doors: current.simulation?.estateDoors,
      });
      if (distance < 0.14) {
        await page.keyboard.up("KeyW");
        await page.keyboard.up("ArrowLeft");
        await page.keyboard.up("ArrowRight");
        await page.waitForTimeout(200);
        events.push({ index, target, actual: (await evidence()).walk.position });
        break;
      }
      if (Math.abs(delta) > 0.06) {
        await page.keyboard.up("KeyW");
        await page.keyboard.down(delta > 0 ? "ArrowLeft" : "ArrowRight");
        await page.keyboard.up(delta > 0 ? "ArrowRight" : "ArrowLeft");
      } else {
        await page.keyboard.up("ArrowLeft");
        await page.keyboard.up("ArrowRight");
        await page.keyboard.down("KeyW");
      }
      stalled = Math.abs(lastDistance - distance) < 0.006 ? stalled + 1 : 0;
      lastDistance = distance;
      if (stalled > 24 || tick === 319) {
        failed = {
          index,
          target,
          actual: point,
          distance,
          delta,
          reason: stalled > 24 ? "no forward progress under physical input" : "bounded steering attempt exhausted",
          lastBlocked: w.lastBlocked,
        };
        break;
      }
      await page.waitForTimeout(80);
    }
    for (const k of ["KeyW", "ArrowLeft", "ArrowRight"]) await page.keyboard.up(k);
    if (failed) break;
  }
  const result = {
    name: c.name,
    scope: "Actual keyboard-driven walk; target floors are validation only and are never injected. No position placement occurs during this route.",
    points: c.points,
    samples,
    events,
    failed,
    end: summary(await evidence()),
  };
  await save(c.name + "-route.json", result);
  actions.push({ type: "physical-route", name: c.name, failed });
  return { failed, events: events.length, samples: samples.length, end: result.end };
}

async function navigate(c) {
  await page.keyboard.up("KeyW");
  const initial = await evidence();
  await scene.evaluate((e, c) => {
    const canvas = e.querySelector("canvas:not(.home-world-sketch)"),
      begin = performance.now(),
      samples = [],
      events = [],
      look = [],
      points = c.points;
    let i = 0,
      stationary = 0,
      previous = null;
    const snap = () => {
      const s = e.getSceneEvidence();
      return {
        position: [...s.walk.position],
        camera: [...s.camera],
        yaw: s.walk.yaw,
        pitch: s.walk.pitch,
        room: s.walk.room,
        blockedFrames: s.walk.blockedFrames,
        lastBlocked: s.walk.lastBlocked,
        doors: s.simulation?.estateDoors,
      };
    };
    const done = (failure) => {
      window.sweepNav = {
        done: true,
        result: {
          scope:
            "Public first-person W key held through Playwright; public pointer-drag input steers. Actual capsule solver only; no position, floor, camera target, or yaw setters are called.",
          points,
          samples,
          events,
          look,
          failure,
          end: snap(),
        },
      };
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "w", code: "KeyW", bubbles: true }));
    };
    window.sweepNav = { done: false };
    const step = () => {
      const a = snap(),
        p = a.position,
        target = points[i];
      samples.push({ index: i, ...a });
      if (performance.now() - begin > 180000) return done({ reason: "bounded visual route timeout", index: i, target });
      const distance = Math.hypot(target[0] - p[0], target[2] - p[2]);
      if (distance < 0.12) {
        events.push({ index: i, target, actual: [...p], heightError: p[1] - target[1] });
        if (++i === points.length) return done(null);
        previous = null;
        stationary = 0;
        requestAnimationFrame(step);
        return;
      }
      if (previous && Math.hypot(p[0] - previous[0], p[2] - previous[2]) < 0.0003) stationary++;
      else stationary = 0;
      previous = [...p];
      if (stationary > 45) return done({ reason: "no movement under actual W input", index: i, target, lastBlocked: a.lastBlocked });
      const delta = Math.atan2(
          Math.sin(Math.atan2(target[0] - p[0], target[2] - p[2]) - a.yaw),
          Math.cos(Math.atan2(target[0] - p[0], target[2] - p[2]) - a.yaw)
        ),
        r = canvas.getBoundingClientRect(),
        aspect = r.width / r.height,
        s = e.getSceneEvidence(),
        horizontal = 2 * Math.atan(Math.tan((s.walk.fov * Math.PI) / 360) * aspect),
        dx = (delta * r.width) / horizontal,
        x = r.left + r.width * 0.5,
        y = r.top + r.height * 0.5;
      if (Math.abs(delta) > 1e-6) {
        const opts = { bubbles: true, pointerId: 71, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y };
        canvas.dispatchEvent(new PointerEvent("pointerdown", opts));
        canvas.dispatchEvent(new PointerEvent("pointermove", { ...opts, clientX: x + dx }));
        canvas.dispatchEvent(new PointerEvent("pointercancel", { ...opts, buttons: 0, clientX: x + dx }));
        look.push({
          index: i,
          fromYaw: a.yaw,
          delta,
          afterYaw: e.getSceneEvidence().walk.yaw,
          positionBefore: p,
          positionAfter: e.getSceneEvidence().walk.position,
        });
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, c);
  await page.keyboard.down("KeyW");
  try {
    await page.waitForFunction(() => window.sweepNav?.done, null, { timeout: 190000, polling: "raf" });
  } finally {
    await page.keyboard.up("KeyW");
  }
  const result = await page.evaluate(() => window.sweepNav.result);
  result.name = c.name;
  result.initial = summary(initial);
  result.final = summary(await evidence());
  await save(c.name + "-route.json", result);
  actions.push({ type: "physical-route-public-pointer-steering", name: c.name, failure: result.failure });
  return {
    name: c.name,
    failure: result.failure,
    events: result.events,
    position: result.final.walk.position,
    blockedFrames: result.final.walk.blockedFrames,
  };
}

async function command(c) {
  if (c.type === "open") return open(c);
  if (c.type === "state") return summary(await evidence());
  if (c.type === "shot") return shot(c.name);
  if (c.type === "visit") return visit(c.id);
  if (c.type === "allRooms") {
    const config = JSON.parse(await fs.readFile(path.join(QA, "frozen/assets/models/home/manifest.json"), "utf8")),
      rows = [];
    for (const r of config.rooms) {
      await visit(r.id);
      rows.push(await shot(`room-${r.id}-${c.suffix || "desktop"}`));
    }
    await save("room-visit-index.json", rows);
    return rows.map((r) => ({ file: r.file, room: r.state.room, errors: r.errors }));
  }
  if (c.type === "walk") {
    await page.locator("[data-world-walk]").click();
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence().walk?.ready, null, { timeout: 90000 });
    actions.push({ type: "public-walk-toggle" });
    return summary(await evidence());
  }
  if (c.type === "keys") return keys(c);
  if (c.type === "route") return route(c);
  if (c.type === "navigate") return navigate(c);
  if (c.type === "camera") {
    await scene.evaluate((e, p) => e.setLabCamera(p), c.pose);
    actions.push({ type: "lab-camera", pose: c.pose });
    await page.waitForTimeout(250);
    return summary(await evidence());
  }
  if (c.type === "place") {
    const result = await scene.evaluate((e, p) => e.setLabWalk(p), c.pose);
    actions.push({ type: "lab-starting-station-placement", pose: c.pose, result });
    return summary(await evidence());
  }
  if (c.type === "inspect") {
    const result = await page.evaluate(c.script);
    if (c.name) await save(c.name + ".json", result);
    return result;
  }
  if (c.type === "close") {
    await browser.close();
    process.exit(0);
  }
  throw new Error("Unknown action " + c.type);
}
(async () => {
  browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  console.log(
    JSON.stringify({
      ready: true,
      commands: ["open", "state", "shot", "visit", "allRooms", "walk", "keys", "route", "camera", "place", "inspect", "close"],
    })
  );
  for await (const line of readline.createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const id = ++serial;
    try {
      const c = JSON.parse(line);
      console.log(JSON.stringify({ id, result: await command(c) }));
    } catch (e) {
      console.log(JSON.stringify({ id, error: e.stack }));
    }
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
