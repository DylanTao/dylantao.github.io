// Browser captures of the coast around the house: the back of the mainland, both ends of its
// coastline, wide views and the new features, before and after the hinterland
// (bin/build_coastal_hinterland.py).
// Usage: node bin/capture_coastal_hinterland.cjs <label>   (COAST_BASE_URL defaults to :4122;
// COAST_WITHOUT_HINTERLAND=1 captures the same views without it, for before-and-after pairs)
// Stills are composed with reduced motion. The wide views are also taken with the exterior haze
// pushed out (COAST_WIDE_FOG="near,far", default 140,520) because the outside camera's far zoom and
// its fog belong to the camera work; those stills are labelled "-far-haze". One extra pair checks
// that the gliders move with the scene clock and hold still while motion is paused.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs/promises");
const path = require("node:path");

const label = process.argv[2] || "capture";
const out = `.jekyll-cache/visual-qa/coastal-hinterland-2026-10-15/${label}`;
const base = process.env.COAST_BASE_URL || "http://127.0.0.1:4122";
const time = process.env.COAST_TIME || "2026-10-15T13:40:00-07:00";
const wideFog = (process.env.COAST_WIDE_FOG || "140,520").split(",").map(Number);
let features = {};
try {
  features = require(path.resolve("artwork/coastal-home/reviews/hinterland.json")).features || {};
} catch {
  /* Before the hinterland exists. */
}
const cave = features.caves?.[1] || [-101.9, -3.9, -30.3];
const deck = features.deck || [-103, 12, -29.5];
// Three.js world coordinates: x north, y up, z inland (Blender -Y).
const VIEWS = [
  { id: "default-outside", target: [3, -0.2, -6], yaw: 3.48, pitch: 0.37, radius: 48 },
  { id: "back-from-inland", target: [20, 4, 10], yaw: 0.25, pitch: 0.32, radius: 70 },
  { id: "back-low", target: [10, 6, 30], yaw: 0.05, pitch: 0.2, radius: 45 },
  { id: "south-end", target: [-36, 2, 2], yaw: -1.25, pitch: 0.3, radius: 55 },
  { id: "south-end-sea", target: [-40, -2, -6], yaw: -2.35, pitch: 0.22, radius: 60 },
  { id: "north-end", target: [76, 2, 2], yaw: 1.85, pitch: 0.3, radius: 55 },
  { id: "north-end-sea", target: [80, -2, -6], yaw: 2.45, pitch: 0.22, radius: 60 },
  { id: "wide-sea", target: [3, -0.2, -6], yaw: 3.48, pitch: 0.37, radius: 160, wide: true },
  { id: "wide-south-west", target: [-20, 0, 0], yaw: 4.1, pitch: 0.3, radius: 160, wide: true },
  { id: "wide-north-west", target: [40, 0, 0], yaw: 2.55, pitch: 0.3, radius: 160, wide: true },
  { id: "wide-inland", target: [20, 0, 20], yaw: 0.6, pitch: 0.45, radius: 160, wide: true },
  // Views stay within 120 m of the house: the sky dome (environment.mjs) does not follow the camera.
  { id: "gliderport", target: [176, 21, 2], yaw: -1.62, pitch: 0.16, radius: 64 },
  { id: "sea-caves", target: [cave[0] + 6, cave[1] + 1, cave[2]], yaw: 1.7, pitch: 0.1, radius: 34 },
  { id: "south-lookout", target: [deck[0], deck[1] + 1, deck[2]], yaw: 1.2, pitch: 0.28, radius: 18 },
  { id: "badlands", target: [92, 2, 70], yaw: 3.7, pitch: 0.35, radius: 70 },
];

(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const evidence = { label, base, time, wideFog, views: [], errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
    page.on("pageerror", (e) => evidence.errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && evidence.errors.push(m.text()));
    // COAST_WITHOUT_HINTERLAND=1 aborts the asset's request: the same build, as it looked before.
    if (process.env.COAST_WITHOUT_HINTERLAND) await page.route("**/hinterland.glb", (route) => route.abort());
    await page.clock.install({ time: new Date(time) });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(base + "/?scene-lab=1", { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const scene = page.locator("[data-home-desk-scene]"),
      ui = page.locator("[data-home-world-controls]");
    await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 180000 });
    await ui.locator("[data-world-lab] > summary").click();
    await ui.locator('[data-world-room="outside"]').first().click();
    await scene.scrollIntoViewIfNeeded();
    // Outside models stream after the first visit: flora, then the hinterland when it exists.
    evidence.outsideModelsLoaded = await page
      .waitForFunction(
        () => {
          const lab = document.querySelector("[data-home-desk-scene]").labScene;
          const land = lab?.scene.getObjectByName("coastal-hinterland");
          const flora = lab?.scene.getObjectByName("clifftop-flora");
          return flora?.visible && (land ? land.visible : true);
        },
        null,
        { timeout: 120000 }
      )
      .then(() => true)
      .catch(() => false);
    await page.waitForTimeout(4000);
    evidence.hinterland = await scene.evaluate((e) => {
      const land = e.labScene.scene.getObjectByName("coastal-hinterland");
      if (!land) return null;
      let meshes = 0,
        triangles = 0;
      land.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      });
      return { visible: land.visible, meshes, triangles, windsock: Boolean(land.getObjectByName("hinterland_windsock")) };
    });
    const fog = await scene.evaluate((e) => ({ near: e.labScene.scene.fog?.near, far: e.labScene.scene.fog?.far }));
    for (const view of VIEWS) {
      for (const haze of view.wide ? [false, true] : [false]) {
        await scene.evaluate(
          (e, [v, f, h]) => {
            if (e.labScene.scene.fog) Object.assign(e.labScene.scene.fog, h ? { near: f[0], far: f[1] } : { near: v.fogNear, far: v.fogFar });
            e.setLabCamera(v);
          },
          [{ ...view, fogNear: fog.near, fogFar: fog.far }, wideFog, haze]
        );
        await page.waitForTimeout(1600);
        const data = await scene.evaluate((e) => e.getSceneEvidence());
        const id = view.id + (haze ? "-far-haze" : "");
        evidence.views.push({ ...view, id, camera: data.camera, orbit: data.cameraOrbit, drawCalls: data.drawCalls, triangles: data.triangles });
        await scene.screenshot({ path: `${out}/${id}.png` });
      }
    }
    await scene.evaluate((e, f) => e.labScene.scene.fog && Object.assign(e.labScene.scene.fog, f), fog);
    // Motion: the gliders follow the scene clock; pausing holds them in place.
    if (evidence.hinterland) {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await scene.evaluate((e) => e.setLabCamera({ target: [150, 30, -14], yaw: -1.85, pitch: 0.12, radius: 60 }));
      await page.waitForTimeout(2500);
      const sample = () =>
        scene.evaluate((e) => {
          const gliders = [];
          let windsock = null;
          e.labScene.scene.getObjectByName("coastal-hinterland").traverse((o) => {
            if (o.userData.glider?.position) gliders.push(o.userData.glider.position.slice());
            if (o.userData.windsock) windsock = { ...o.userData.windsock };
          });
          return { seconds: e.getSceneEvidence().animationSeconds, gliders, windsock };
        });
      const a = await sample();
      await scene.screenshot({ path: `${out}/gliders-a.png` });
      await page.waitForTimeout(3000);
      const b = await sample();
      await scene.screenshot({ path: `${out}/gliders-b.png` });
      await ui.locator("[data-world-pause]").click();
      await page.waitForTimeout(800);
      const c = await sample();
      await page.waitForTimeout(2000);
      const d = await sample();
      await ui.locator("[data-world-pause]").click();
      evidence.motion = { a, b, pausedStart: c, pausedEnd: d };
      // A close look at one paraglider and the hang glider, frozen, under a clearer sky.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await scene.evaluate((e, f) => e.labScene.scene.fog && Object.assign(e.labScene.scene.fog, { near: f[0], far: f[1] }), wideFog);
      const flying = await scene.evaluate((e) => {
        const found = [];
        e.labScene.scene.getObjectByName("coastal-hinterland").traverse((o) => {
          if (o.userData.glider?.position) found.push({ name: o.name, kind: o.userData.glider.kind, at: o.userData.glider.position });
        });
        return found;
      });
      // The paraglider nearest the house, and the hang glider.
      const near = flying.filter((g) => g.kind === "paraglider").sort((a, b) => Math.hypot(a.at[0], a.at[2]) - Math.hypot(b.at[0], b.at[2]))[0];
      for (const glider of [near, flying.find((g) => g.kind === "hang-glider")].filter(Boolean)) {
        const toHouse = Math.atan2(-glider.at[0], -glider.at[2]);
        await scene.evaluate((e, v) => e.setLabCamera(v), {
          target: glider.at,
          yaw: toHouse,
          pitch: 0.05,
          radius: glider.kind === "paraglider" ? 22 : 26,
        });
        await page.waitForTimeout(1500);
        await scene.screenshot({ path: `${out}/${glider.name}-close.png` });
      }
      // The wind sock in the coast wind, moving: two frames three seconds apart.
      const sock = require(path.resolve("assets/models/home/manifest.json")).hinterland?.windsock;
      if (sock) {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await scene.evaluate((e, v) => e.setLabCamera(v), { target: sock.pivot, yaw: -2.2, pitch: 0.12, radius: 9 });
        await page.waitForTimeout(2000);
        const windsock = [];
        for (const frame of ["a", "b"]) {
          windsock.push(
            await scene.evaluate((e) => {
              let found = null;
              e.labScene.scene.getObjectByName("coastal-hinterland").traverse((o) => {
                if (o.userData.windsock) found = { ...o.userData.windsock };
              });
              return found;
            })
          );
          await scene.screenshot({ path: `${out}/windsock-${frame}.png` });
          await page.waitForTimeout(3000);
        }
        evidence.windsock = windsock;
      }
      await scene.evaluate((e, f) => e.labScene.scene.fog && Object.assign(e.labScene.scene.fog, f), fog);
    }
  } finally {
    await fs.writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
    await browser.close();
  }
  console.log(
    JSON.stringify({
      out,
      errors: evidence.errors.filter((e) => !/404/.test(e)).length,
      hinterland: evidence.hinterland,
      motion: Boolean(evidence.motion),
    })
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
