// Source-asset intercept for one owned candidate, against root's production-built HTML/CSS.
// Run from the environment worktree. Candidate source and the root production _site are read
// directly by Playwright's interceptor; no other worktree's server or process is needed.
const { chromium } = require("playwright");
const fs = require("node:fs/promises"),
  path = require("node:path"),
  { createHash } = require("node:crypto"),
  { execFileSync } = require("node:child_process");
const productionBuild =
  process.env.VISUAL_ROOT_BUILD || path.resolve(execFileSync("git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim(), "..", "_site");
const out = path.resolve(process.env.ENVIRONMENT_EVIDENCE_DIR || ".jekyll-cache/visual-qa/environment");
const types = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};
const shots = process.argv[2] || "garden,coast,night,fft,onsen";
(async () => {
  const expectedRoomCount = JSON.parse(await fs.readFile(path.join(__dirname, "../assets/models/home/manifest.json"), "utf8")).rooms.length;
  await fs.mkdir(out, { recursive: true });
  execFileSync("python", ["bin/prepare_environment_preview.py", productionBuild]);
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const report = [];
  try {
    for (const name of shots.split(",")) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
      const errors = [];
      const servedAssets = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (e) => {
        if (e.type() === "error") errors.push(e.text().slice(0, 700));
      });
      await page.route("http://127.0.0.1:4156/**", async (route) => {
        const url = new URL(route.request().url()),
          local = path.resolve("." + decodeURIComponent(url.pathname));
        if (local.startsWith(process.cwd()) && types[path.extname(local)])
          try {
            const body = await fs.readFile(local);
            if (url.pathname.endsWith("hinterland.glb") || url.pathname.endsWith("room-lounge.glb"))
              servedAssets.push({ path: url.pathname, bytes: body.length, sha256: createHash("sha256").update(body).digest("hex") });
            return await route.fulfill({ body, contentType: types[path.extname(local)] });
          } catch {}
        if (url.pathname.endsWith(".webp"))
          try {
            return await route.fulfill({
              body: await fs.readFile(path.join(".jekyll-cache/responsive-assets", url.pathname)),
              contentType: "image/webp",
            });
          } catch {}
        const baseline = path.join(productionBuild, decodeURIComponent(url.pathname), url.pathname.endsWith("/") ? "index.html" : "");
        const ext = path.extname(baseline),
          type = types[ext] || { ".html": "text/html", ".css": "text/css" }[ext] || "application/octet-stream";
        try {
          const body = await fs.readFile(baseline);
          return route.fulfill({
            status: 200,
            contentType: type,
            body: /text|javascript|json/.test(type) ? body.toString("utf8").replaceAll("/al-folio", "") : body,
          });
        } catch {
          return route.fulfill({ status: 404, body: "Missing source/build asset: " + url.pathname });
        }
      });
      await page.clock.setFixedTime(new Date("2026-10-23T20:20:00Z"));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("http://127.0.0.1:4156/?scene-lab=1&weather=clear" + (name === "fft" ? "&ocean=fft" : ""), { waitUntil: "domcontentloaded" });
      await page.addStyleTag({
        content:
          ".home-hero-media.is-desk-3d .home-desk-corner-scene{mask-image:none!important;-webkit-mask-image:none!important;aspect-ratio:4/3;height:auto!important}",
      });
      await page.locator('[data-home-desk-mode="3d"]').click();
      await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 180000 });
      const scene = page.locator("[data-home-desk-scene]"),
        ui = page.locator("[data-home-world-controls]");
      await ui.locator("summary").first().click();
      const minute = name === "night" || name === "lights" || name === "stars" ? 1260 : name === "onsen" ? 1100 : 960;
      await ui.locator("[data-world-time]").evaluate((e, value) => {
        e.value = value;
        e.dispatchEvent(new Event("input", { bubbles: true }));
        e.dispatchEvent(new Event("change", { bubbles: true }));
      }, minute);
      await ui
        .locator(`[data-world-room="${name === "onsen" ? "onsen" : name.startsWith("lounge") ? "lounge" : "outside"}"]`)
        .first()
        .click();
      await page.waitForTimeout(10000);
      const camera =
        name === "lounge-plants"
          ? { target: [3.1, 0.8, -3.8], yaw: -0.3, pitch: 0.25, radius: 3.1 }
          : name === "lounge-table"
            ? { target: [4.79, 0.78, -0.13], yaw: -1.4, pitch: 0.2, radius: 1.1 }
            : name === "garden"
              ? { target: [-20, 10.1, 63], yaw: 3.5, pitch: 0.95, radius: 45 }
              : name === "garden-close"
                ? { target: [-23, 10.04, 52], yaw: 2.3, pitch: 0.9, radius: 7 }
                : name === "lights"
                  ? { target: [-1600, 25, 450], yaw: 1.2, pitch: 0.1, radius: 160 }
                  : name === "stars"
                    ? { target: [0, 75, 0], yaw: 4.3, pitch: -0.25, radius: 50 }
                    : name === "fft" || name === "analytic"
                      ? { target: [-6, -7.2, -28], yaw: 1.1, pitch: 0.3, radius: 9 }
                      : name === "coast" || name === "night"
                        ? { target: [0, 9, 0], yaw: 3.5, pitch: 0.22, radius: 160 }
                        : null;
      if (camera) await scene.evaluate((e, c) => e.setLabCamera(c), camera);
      await page.waitForTimeout(2000);
      await scene.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      if (name.startsWith("lounge"))
        await page.waitForFunction(
          (roomCount) => document.querySelector("[data-home-desk-scene]").getSceneEvidence().roomCount === roomCount,
          expectedRoomCount,
          {
            timeout: 60000,
          }
        );
      const poseKey = () =>
        scene.evaluate((e) => {
          const root = e.labScene?.scene,
            parts = [];
          for (let i = 1; i <= 5; i++) {
            const f = root?.getObjectByName(`Garden koi ${i}`);
            if (f) parts.push([f.position.toArray(), f.quaternion.toArray()]);
          }
          const pool = root?.getObjectByName("hinterland_garden_koi_water");
          return JSON.stringify([parts, pool?.userData.waterGarden?.clock?.value, e.getSceneEvidence().ecology.water.seconds]);
        });
      const heldPoseA = await poseKey();
      const stillA = await scene.screenshot({ path: path.join(out, name + "-still.png") });
      await page.waitForTimeout(450);
      const stillB = await scene.screenshot({ path: path.join(out, name + "-held.png") });
      const heldPose = heldPoseA === (await poseKey());
      const heldPixels = stillA.equals(stillB);
      const before = await scene.evaluate((e) => e.getSceneEvidence());
      if (name === "garden")
        await page.waitForFunction(
          () => document.querySelector("[data-home-desk-scene]").labScene?.scene.getObjectByName("hinterland_garden_koi_water"),
          null,
          { timeout: 30000 }
        );
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.waitForTimeout(3500);
      const movingImage = await scene.screenshot({ path: path.join(out, name + "-moving.png") });
      const movingPixels = !stillB.equals(movingImage);
      const after = await scene.evaluate((e) => e.getSceneEvidence());
      if (name.startsWith("lounge")) {
        const plants = after.simulation.wind.plants;
        if (plants.reduce((sum, p) => sum + p.enabled, 0) !== 403 || plants.reduce((sum, p) => sum + p.disabled, 0) !== 30)
          throw new Error("The complete authored planting must keep 403 rooted groups and 30 unsupported study groups");
        if (errors.length || !heldPixels || !movingPixels) throw new Error("Lounge render, reduced-motion hold, or moving-frame proof failed");
      }
      const garden = await scene.evaluate((e) => {
        const node = e.labScene?.scene.getObjectByName("hinterland_garden_koi_water");
        return node ? { ...node.userData.waterGarden, clock: node.userData.waterGarden?.clock?.value } : null;
      });
      report.push({ name, camera, errors, servedAssets, heldPose, heldPixels, movingPixels, before, after, garden });
      console.log(
        name,
        JSON.stringify({
          errors,
          frames: after.frames,
          water: after.ecology?.water?.field,
          garden,
          onsen: after.simulation?.onsen?.drip,
          ms: after.frameTiming,
        })
      );
      await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
      await page.close();
    }
  } finally {
    await browser.close();
  }
})();
