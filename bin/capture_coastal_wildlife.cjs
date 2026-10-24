// Frame-stepped browser captures of the coastal animals. The page clock is paused and advanced by
// exactly one frame interval per screenshot, so motion is judged at its authored timing even on a
// slow GPU; `elapsed` jumps the scene's active time without rendering the frames in between.
// Usage: node bin/capture_coastal_wildlife.cjs --plan=<plan.json> [--base-url=http://127.0.0.1:4121]
//        [--out=.jekyll-cache/visual-qa/wildlife] [--time=2026-10-15T13:20:00-07:00] [--fps=12] [--dpr=2]
// A plan is a list of shots: {name, mode: "outside" | "inspect" | "lab", id?, target?, yaw?, pitch?,
// radius?, elapsed?, seconds?, settle?}. Frames are PNGs under <out>/<name>/; pass the folder to any
// encoder (the review used Playwright's bundled ffmpeg through a PNG-to-MJPEG pipe).
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const args = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.replace(/^--/, "").split("=");
    return [key, value.length ? value.join("=") : "1"];
  })
);
const base = (args["base-url"] || process.env.COASTAL_BASE_URL || "http://127.0.0.1:4121").replace(/\/$/, "");
const out = path.resolve(args.out || ".jekyll-cache/visual-qa/wildlife");
const time = args.time || "2026-10-15T13:20:00-07:00";
const fps = Number(args.fps || 12);
const plan = JSON.parse(fs.readFileSync(args.plan, "utf8"));
const expectedRoomCount = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/models/home/manifest.json"), "utf8")).rooms.length;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: Number(args.dpr || 2) });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error" && !/Failed to load resource/.test(message.text())) errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date(time) });
  await page.goto(base + "/?scene-lab=1", { waitUntil: "domcontentloaded" });
  await page.locator('[data-home-desk-mode="3d"]').click();
  const scene = page.locator("[data-home-desk-scene]");
  await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 120000 });
  const canvas = scene.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const now = await page.evaluate(() => Date.now());
  await page.clock.setFixedTime(now);
  await page.clock.pauseAt(now);
  await page.clock.setSystemTime(now);
  const evidence = () => scene.evaluate((element) => element.getSceneEvidence());
  const controls = page.locator("[data-home-world-controls]");
  if (
    !(await controls
      .locator("details")
      .first()
      .evaluate((element) => element.open))
  )
    await controls.locator("[data-world-lab] > summary").click();
  await controls.locator('[data-world-room="outside"]').first().click();
  for (let i = 0; i < 300; i++) {
    await page.clock.runFor(200);
    const view = await evidence();
    if (view.ecology?.wildlife?.modelsReady && view.roomCount === expectedRoomCount) break;
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.runFor(1400);
  const frames = async (milliseconds) => {
    for (let t = 0; t < milliseconds; t += 1000 / 30) await page.clock.runFor(1000 / 30);
  };
  const summary = { time, fps, shots: [] };
  for (const shot of plan) {
    const dir = path.join(out, shot.name);
    fs.mkdirSync(dir, { recursive: true });
    for (const file of fs.readdirSync(dir)) if (file.endsWith(".png")) fs.unlinkSync(path.join(dir, file));
    let view = await evidence();
    const settle = (shot.settle ?? 2.5) * 1000;
    if (shot.elapsed !== undefined) {
      const ahead = shot.elapsed - settle / 1000 - view.ecology.water.seconds;
      if (ahead > 0) await page.clock.fastForward(ahead * 1000);
    }
    // Leave any close inspection first: an inspected animal keeps steering the camera target.
    if (shot.mode !== "inspect" && (await evidence()).inspection) {
      await canvas.press("Enter");
      await page.clock.runFor(100);
    }
    if (shot.mode === "outside") await controls.locator('[data-world-room="outside"]').first().click();
    if (shot.mode === "inspect") {
      await canvas.focus();
      for (let i = 0; i < 40 && (await evidence()).inspection?.id !== shot.id; i++) {
        await canvas.press("n");
        await page.clock.runFor(100);
      }
    }
    if (shot.mode === "lab" || (shot.mode === "outside" && shot.yaw !== undefined)) {
      view = await evidence();
      const target = shot.target || view.neighbours.find((item) => item.id === shot.id)?.worldCenter || view.target;
      await scene.evaluate((element, camera) => element.setLabCamera(camera), { target, yaw: shot.yaw, pitch: shot.pitch, radius: shot.radius });
    }
    await frames(settle);
    const count = Math.round((shot.seconds || 6) * fps),
      states = [];
    for (let i = 0; i < count; i++) {
      await canvas.screenshot({ path: path.join(dir, `frame-${String(i).padStart(4, "0")}.png`) });
      if (i % Math.max(1, Math.round(fps / 2)) === 0) {
        const view = await evidence(),
          wildlife = view.ecology.wildlife;
        states.push({
          seconds: view.ecology.water.seconds,
          inspection: view.inspection?.id || null,
          gulls: wildlife.birds.map((bird) => bird.perched || bird.state),
          sandpipers: wildlife.shorebirdContacts.map((bird) => bird.state),
          pelicans: wildlife.pelicanStates.map((bird) => bird.state),
          cormorants: wildlife.cormorantStates.map((bird) => bird.state),
          swimmers: wildlife.swimmers.map((bird) => bird.state),
          raccoon: wildlife.raccoon.state,
          rabbits: wildlife.rabbitHabitats.map((rabbit) => rabbit.state),
          marine: wildlife.contacts.map((animal) => animal.state),
        });
      }
      await page.clock.runFor(1000 / fps);
    }
    fs.copyFileSync(path.join(dir, `frame-${String(Math.floor(count / 2)).padStart(4, "0")}.png`), path.join(out, `${shot.name}.png`));
    summary.shots.push({ name: shot.name, frames: count, states });
    fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify({ ...summary, errors }, null, 2));
    console.log("shot", shot.name, count, "frames");
  }
  fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify({ ...summary, errors }, null, 2));
  if (errors.length) console.log("errors", errors.slice(0, 5));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
