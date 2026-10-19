// Still frames of the coastal home for the Graphics Lab page (/projects/graphics-lab/): one view per
// experiment, captured from the live 3D scene through its authoring lab (?scene-lab=1). Raw captures
// go to .jekyll-cache/visual-qa/graphics-lab-stills/ (unwatched by Jekyll), with the scene evidence
// for each; bin/make_graphics_lab_thumbnails.py then crops and scales them into
// assets/img/project_pics/graphics-lab/.
//
// Usage, against a running preview of this checkout:
//   node bin/capture_graphics_lab_stills.cjs http://127.0.0.1:4132 [still,still,...]
// Each still names a room, an hour on the San Diego clock and, where the authored room
// view does not show the technique, a lab camera. Motion stays reduced (composed still poses) unless a
// still needs the simulation to run, such as the hand's ripples in the onsen.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");

// Minutes are a weekday on the San Diego clock; the routine places Sirui by the hour (03:00 sleep, 11:30
// breakfast, 14:00 lunch, 18:00 gym, 20:00 onsen, 23:00 coding), so an hour picks both the light and who
// is home. A still without its own date runs on Friday, October 16, 2026, so a capture on a weekend
// keeps the weekday routine. The loading sketch is captured while the house loads (?cinematic=live lets
// automation see it).
const WEEKDAY = "2026-10-16T12:00:00-07:00";
const STILLS = {
  // In mid-October the noon sun stands below the shaft's acceptance cone, so this frame fixes the page
  // clock to a late-August noon, when the beam reaches the bath.
  "light-well": { room: "onsen", date: "2026-08-20T12:40:00-07:00" },
  "light-field": { room: "study", minute: 23 * 60 + 10 },
  "contact-light": { room: "study", minute: 15 * 60 },
  ocean: { room: "outside", minute: 16 * 60, camera: { target: [-6, 0.3, -28], yaw: 1.1, pitch: 0.13, radius: 9 } },
  "sun-sky": { room: "outside", minute: 18 * 60 + 15, camera: { target: [-8, 4, -70], yaw: 0.3, pitch: 0.04, radius: 34 } },
  "sun-sky-b": { room: "overview", minute: 17 * 60 + 45 },
  "sun-sky-c": { room: "outside", minute: 17 * 60 + 40, camera: { target: [-8, 6, -70], yaw: 0.35, pitch: 0.12, radius: 34 } },
  // Weekends soak at 16:00, so a Saturday afternoon shows the hand's ripples in daylight.
  "onsen-water": {
    room: "onsen",
    date: "2026-08-22T16:10:00-07:00",
    live: 7000,
    camera: { target: [3.17, 3.05, 2.85], yaw: 3.5, pitch: 0.5, radius: 2.2 },
  },
  // The bath air shows best where the August noon beam crosses it.
  steam: { room: "onsen", date: "2026-08-20T12:40:00-07:00", camera: { target: [3.17, 3.45, 2.85], yaw: 3.5, pitch: 0.18, radius: 2.3 } },
  wind: { room: "outside", minute: 15 * 60 },
  "wind-a": { room: "outside", minute: 15 * 60, camera: { target: [3, 8, -6], yaw: 0.2, pitch: 0.25, radius: 9 } },
  "wind-b": { room: "outside", minute: 15 * 60, camera: { target: [3, 10.5, 12.5], yaw: 3.6, pitch: 0.12, radius: 7 } },
  curtains: { room: "kitchen", minute: 16 * 60 + 45 },
  "gym-a": { room: "gym", minute: 18 * 60 + 5 },
  "gym-b": { room: "gym", minute: 18 * 60 + 12 },
  "gym-c": { room: "gym", minute: 18 * 60 + 33 },
  bedding: { room: "sleep", minute: 4 * 60 },
  skin: { room: "kitchen", minute: 11 * 60 + 45, actorCamera: { part: /^head$/i, yaw: 3.14, pitch: 0.06, radius: 0.7 } },
  hair: { room: "kitchen", minute: 11 * 60 + 45, actorCamera: { part: /^head$/i, yaw: 2.5, pitch: 0.3, radius: 0.85 } },
  // At breakfast the mug covers half the face; at the desk in late-afternoon light it stays clear.
  "skin-b": { room: "study", minute: 16 * 60 + 40, actorCamera: { part: /^head$/i, yaw: 4.1, pitch: 0.08, radius: 0.75 } },
  "skin-c": { room: "study", minute: 16 * 60 + 40, actorCamera: { part: /^head$/i, yaw: 3.0, pitch: 0.06, radius: 0.75 } },
  "hair-a": { room: "study", minute: 16 * 60 + 40, actorCamera: { part: /^head$/i, yaw: 3.6, pitch: 0.35, radius: 0.8 } },
  "hair-b": { room: "study", minute: 23 * 60 + 10, actorCamera: { part: /^head$/i, yaw: 3.3, pitch: 0.3, radius: 0.8 } },
  wildlife: { room: "outside", minute: 15 * 60, camera: { target: [-3, 0.2, -24], yaw: 3.25, pitch: 0.24, radius: 11 } },
  // The seabirds joined on October 18: cormorants on the rocks at the cliff foot, pelicans over the swell.
  "wildlife-cormorants": { room: "outside", minute: 15 * 60, objectCamera: { name: /^Brandt's cormorant$/, yaw: 3.3, pitch: 0.2, radius: 4 } },
  "wildlife-cormorants-b": { room: "outside", minute: 15 * 60, objectCamera: { name: /^Brandt's cormorant$/, yaw: 1.7, pitch: 0.2, radius: 4 } },
  "wildlife-pelicans": { room: "outside", minute: 15 * 60, objectCamera: { name: /^Brown pelican$/, yaw: 3.3, pitch: 0.1, radius: 8 } },
  "wildlife-pelicans-b": { room: "outside", minute: 15 * 60, objectCamera: { name: /^Brown pelican$/, yaw: 1.7, pitch: 0.1, radius: 8 } },
  "wildlife-sealions": { room: "outside", minute: 15 * 60, objectCamera: { name: /^California sea lion$/, yaw: 3.3, pitch: 0.25, radius: 6 } },
  // The renovation's lime plaster, in the living room's afternoon light and up close on its media wall.
  "plaster-a": { room: "lounge", minute: 16 * 60 + 30 },
  "plaster-b": { room: "lounge", minute: 10 * 60 },
  // Capture it in a run of its own: once earlier stills have compiled the house's programs, the browser's shader
  // cache lets the house appear before the sketch has drawn.
  "loading-sketch": { sketch: [1600, 2600, 3600, 4600, 6000] },
  // At 04:00 Sirui is asleep, so the sketch draws the bedroom (the card teaser's frame).
  "loading-sketch-bedroom": { sketch: [2600, 4600], date: "2026-10-16T04:00:00-07:00" },
  // The land past the mainland loads on the first visit outside, so these wait for it.
  "camera-field": { room: "outside", minute: 15 * 60, wait: 20000, camera: { target: [0, 8, -10], yaw: 3.45, pitch: 0.3, radius: 155 } },
  "hinterland-a": { room: "outside", minute: 15 * 60, wait: 9000, camera: { target: [130, 18, 5], yaw: 3.3, pitch: 0.1, radius: 120 } },
  "hinterland-b": { room: "outside", minute: 15 * 60, wait: 9000, camera: { target: [-103, 8, -32], yaw: 3.6, pitch: 0.15, radius: 40 } },
  // The gliders' loops run along the north bluffs (x 60 to 190 m, 22 to 52 m up, over the shore).
  gliders: { room: "outside", minute: 15 * 60, wait: 12000, camera: { target: [125, 32, -22], yaw: 3.3, pitch: 0.06, radius: 50 } },
  "gliders-b": { room: "outside", minute: 15 * 60, wait: 12000, camera: { target: [115, 30, -20], yaw: 3.1, pitch: 0.04, radius: 30 } },
  // October 19: the sea's optics over its seabed, the scattering sky and its haze, the linen and the laundry, at golden
  // hour on the weekday clock (the sun sets at 18:16 on Friday, October 16, 2026). `query` adds a comparison flag.
  "ocean-golden": { room: "outside", minute: 17 * 60 + 40, camera: { target: [-6, 0.3, -28], yaw: 1.1, pitch: 0.13, radius: 9 } },
  "ocean-golden-b": { room: "outside", minute: 17 * 60 + 40, camera: { target: [-6, 0.3, -28], yaw: 1.1, pitch: 0.42, radius: 8 } },
  "ocean-golden-c": { room: "outside", minute: 17 * 60 + 40, camera: { target: [-4, 0.2, -22], yaw: 2.6, pitch: 0.32, radius: 9 } },
  "sunset-a": { room: "outside", minute: 18 * 60 + 8, camera: { target: [-8, 6, -70], yaw: 0.35, pitch: 0.12, radius: 34 } },
  "sunset-b": { room: "outside", minute: 18 * 60 + 13, camera: { target: [-8, 6, -70], yaw: 0.35, pitch: 0.12, radius: 34 } },
  "sunset-c": { room: "outside", minute: 18 * 60 + 24, camera: { target: [-8, 6, -70], yaw: 0.35, pitch: 0.12, radius: 34 } },
  "camera-field-golden": { room: "outside", minute: 17 * 60 + 40, wait: 20000, camera: { target: [0, 8, -10], yaw: 3.45, pitch: 0.3, radius: 155 } },
  "hinterland-golden": { room: "outside", minute: 17 * 60 + 40, wait: 12000, camera: { target: [130, 18, 5], yaw: 3.3, pitch: 0.1, radius: 120 } },
  "gliders-golden": { room: "outside", minute: 17 * 60 + 40, wait: 12000, camera: { target: [125, 32, -22], yaw: 3.3, pitch: 0.06, radius: 50 } },
  "haze-north": { room: "outside", minute: 17 * 60 + 40, wait: 12000, camera: { target: [120, 15, -15], yaw: 4.5, pitch: 0.08, radius: 130 } },
  "haze-south": { room: "outside", minute: 17 * 60 + 40, wait: 12000, camera: { target: [-60, 10, -20], yaw: 1.6, pitch: 0.08, radius: 120 } },
  "curtains-golden": { room: "kitchen", minute: 17 * 60 + 40 },
  "laundry-a": { room: "outside", minute: 17 * 60 + 40, camera: { target: [-1, 1.55, -7.3], yaw: 0.15, pitch: 0.12, radius: 4.2 } },
  "laundry-b": { room: "outside", minute: 17 * 60 + 40, camera: { target: [-1, 1.55, -7.3], yaw: 3.3, pitch: 0.18, radius: 5 } },
  "sunbeams-lounge": { room: "lounge", minute: 17 * 60 + 35 },
  "sunbeams-kitchen": { room: "kitchen", minute: 17 * 60 + 30 },
  "fog-morning": { room: "outside", minute: 7 * 60 + 30, wait: 9000, query: "weather=marine" },
  "fog-coast": {
    room: "outside",
    minute: 7 * 60 + 30,
    wait: 12000,
    query: "weather=marine",
    camera: { target: [0, 8, -10], yaw: 3.45, pitch: 0.3, radius: 120 },
  },
  "wildlife-golden": { room: "outside", minute: 17 * 60 + 40, camera: { target: [-3, 0.2, -24], yaw: 3.25, pitch: 0.24, radius: 11 } },
  // Shafts show looking toward the low sun from the clifftop, through the pines and the palm.
  "shafts-a": { room: "outside", minute: 17 * 60 + 25, camera: { target: [3, 8, -6], yaw: 0.2, pitch: 0.12, radius: 9 } },
  "shafts-b": { room: "outside", minute: 17 * 60 + 25, camera: { target: [0, 9, 2], yaw: 0, pitch: 0.1, radius: 14 } },
};

async function setRange(locator, value) {
  await locator.evaluate((input, v) => {
    input.value = String(v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

// World position of the first scene object whose name matches, from the lab's scene handle.
async function objectPosition(scene, pattern, actor = false) {
  return scene.evaluate(
    (element, { source, flags, actor }) => {
      const test = new RegExp(source, flags);
      const root = element.labScene?.scene;
      if (!root) return null;
      let found = null;
      root.traverse((object) => {
        if (found || !test.test(object.name || "")) return;
        if (actor && !object.isBone) return;
        found = object;
      });
      if (!found) return null;
      found.updateWorldMatrix(true, false);
      const e = found.matrixWorld.elements;
      return [e[12], e[13], e[14]];
    },
    { source: pattern.source, flags: pattern.flags, actor }
  );
}

(async () => {
  const baseURL = (process.argv[2] || "http://127.0.0.1:4132").replace(/\/$/, "");
  const wanted = (process.argv[3] || Object.keys(STILLS).join(",")).split(",");
  const output = path.resolve(".jekyll-cache/visual-qa/graphics-lab-stills");
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const report = [];
  try {
    for (const name of wanted) {
      const still = STILLS[name];
      if (!still) throw new Error(`Unknown still ${name}; known: ${Object.keys(STILLS).join(", ")}`);
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.emulateMedia({ reducedMotion: still.live ? "no-preference" : "reduce" });
      await page.addInitScript(() => {
        sessionStorage.setItem("theme", "noon");
        sessionStorage.setItem("theme-manual", "true");
      });
      // A dated still fixes what Date reports; timers and animation frames keep running.
      await page.clock.setFixedTime(new Date(still.date || WEEKDAY));
      await page.goto(`${baseURL}/?scene-lab=1${still.sketch ? "&cinematic=live" : ""}${still.query ? `&${still.query}` : ""}`, {
        waitUntil: "domcontentloaded",
      });
      // A 4:3 canvas without the homepage's feathered edge, so a frame needs no crop and reads on either theme.
      await page.addStyleTag({
        content:
          ".home-hero-media.is-desk-3d .home-desk-corner-scene { mask-image: none !important; -webkit-mask-image: none !important; aspect-ratio: 4 / 3; height: auto !important; }",
      });
      await page.locator('[data-home-desk-mode="3d"]').click();
      const scene = page.locator("[data-home-desk-scene]");
      if (still.sketch) {
        let waited = 0;
        for (const at of still.sketch) {
          await page.waitForTimeout(at - waited);
          waited = at;
          await scene.scrollIntoViewIfNeeded();
          const file = path.join(output, `${name}-${at}.png`);
          await scene.screenshot({ path: file });
          report.push({ name: `${name}-${at}`, file: path.relative(process.cwd(), file), still, errors });
        }
        console.log(name, "loading", errors.length ? errors : "ok");
        await page.close();
        continue;
      }
      await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, {
        timeout: 180000,
      });
      const ui = page.locator("[data-home-world-controls]");
      await ui.locator("summary").first().click();
      await ui.locator("[data-world-avatar]").selectOption("ghibli");
      if (still.minute !== undefined) await setRange(ui.locator("[data-world-time]"), still.minute);
      await ui.locator(`[data-world-room="${still.room}"]`).first().click();
      await page.waitForTimeout(still.wait || 2500);
      let camera = still.camera || null;
      if (still.objectCamera) {
        const at = await objectPosition(scene, still.objectCamera.name);
        if (at) camera = { target: [at[0], at[1] + 0.4, at[2]], ...still.objectCamera, name: undefined };
      }
      if (still.actorCamera) {
        const at = await objectPosition(scene, still.actorCamera.part, true);
        if (at) camera = { target: at, ...still.actorCamera, part: undefined };
      }
      if (camera) {
        await scene.evaluate((element, c) => element.setLabCamera({ target: c.target, yaw: c.yaw, pitch: c.pitch, radius: c.radius }), camera);
        await page.waitForTimeout(2500);
      }
      if (still.live) await page.waitForTimeout(still.live);
      await scene.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      const file = path.join(output, `${name}.png`);
      await scene.screenshot({ path: file });
      const evidence = await scene.evaluate((element) => {
        const e = element.getSceneEvidence();
        return { room: e.currentRoom, activity: e.activity, clockMode: e.clockMode, avatar: e.avatarId, daylight: e.daylight, look: e.look };
      });
      report.push({ name, captured: new Date().toISOString(), file: path.relative(process.cwd(), file), still, camera, evidence, errors });
      console.log(name, evidence.room, evidence.activity, errors.length ? errors : "ok");
      await page.close();
    }
  } finally {
    await browser.close();
    const ledger = path.join(output, "stills.json");
    const previous = await fs
      .readFile(ledger, "utf8")
      .then((text) => JSON.parse(text).report || [])
      .catch(() => []);
    const merged = [...previous.filter((entry) => !report.some((item) => item.name === entry.name)), ...report];
    await fs.writeFile(ledger, JSON.stringify({ baseURL, updated: new Date().toISOString(), report: merged }, null, 2));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
