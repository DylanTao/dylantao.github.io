// Capture the real fireplace/flue joint; overlay only its index and two GLBs on a production build.
// NODE_PATH may point to the coordinator's real node_modules; no dependency junction is needed.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const root = path.resolve(__dirname, "..");
const output = path.resolve(process.argv[2] || ".jekyll-cache/visual-qa/fireplace-joint/browser");
const base = process.env.FIREPLACE_URL || "http://127.0.0.1:4153/al-folio/";
const camera = { target: [0.95, 1.78, -1.15], yaw: Math.PI + 0.4, pitch: 0.06, radius: 1.5 };

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const results = [];
  try {
    for (const level of ["default", "fine"]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
      const errors = [],
        served = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
      await page.route("**/assets/models/home/furniture/*", (route) => {
        const name = path.posix.basename(new URL(route.request().url()).pathname);
        if (!["index.json", "floating-fireplace-lod0.glb", "floating-fireplace-lod1.glb"].includes(name)) return route.continue();
        const body = fs.readFileSync(path.join(root, "assets/models/home/furniture", name));
        served.push({ file: name, bytes: body.length, sha256: createHash("sha256").update(body).digest("hex") });
        return route.fulfill({ body, contentType: name.endsWith("json") ? "application/json" : "model/gltf-binary" });
      });
      await page.addInitScript(() => {
        sessionStorage.setItem("theme", "noon");
        sessionStorage.setItem("theme-manual", "true");
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const url = new URL(base);
      url.searchParams.set("scene-lab", "1");
      url.searchParams.set("furniture-detail", level);
      await page.goto(url.href, { waitUntil: "domcontentloaded" });
      const host = page.locator("[data-home-desk-scene]");
      await page.locator('[data-home-desk-mode="3d"]').click();
      await host.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 240000 });
      await page.evaluate(() => {
        const lab = document.querySelector("[data-world-lab]");
        lab.open = true;
        const time = document.querySelector("[data-world-time]");
        time.value = "800";
        time.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector('[data-world-room="lounge"]').click();
        lab.open = false;
      });
      await page.waitForFunction(
        () => {
          const e = document.querySelector("[data-home-desk-scene]").getSceneEvidence();
          return e.roomCount === 6 && e.furniture?.placed.find((p) => p.id === "living-fireplace")?.shown >= 0;
        },
        null,
        { timeout: 240000 }
      );
      await page.locator("[data-world-fullscreen]").click();
      await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]").getSceneEvidence().fullscreen);
      await host.evaluate((e, camera) => e.setLabCamera(camera), camera);
      await page.waitForFunction(
        (shown) =>
          document
            .querySelector("[data-home-desk-scene]")
            .getSceneEvidence()
            .furniture.placed.find((p) => p.id === "living-fireplace")?.shown === shown,
        level === "default" ? 0 : 1,
        { timeout: 120000 }
      );
      await page.waitForFunction(
        () => {
          const field = document.querySelector("[data-home-desk-scene]").getSceneEvidence().simulation?.lightField;
          return !field || field.ready || field.error;
        },
        null,
        { timeout: 240000 }
      );
      await page.waitForTimeout(2500);
      await host.locator("canvas").screenshot({ path: path.join(output, `joint-${level}.png`) });
      await host.evaluate((e) => e.setLabCamera({ target: [0.95, 3.0, -1.15], yaw: 3.18, pitch: 0.5, radius: 9.0 }));
      await page.waitForTimeout(1800);
      await host.locator("canvas").screenshot({ path: path.join(output, `flue-${level}.png`) });
      const state = await host.evaluate((e) => {
        const evidence = e.getSceneEvidence();
        return {
          camera: evidence.camera,
          furniture: evidence.furniture.placed.find((p) => p.id === "living-fireplace"),
          roomCount: evidence.roomCount,
          triangles: evidence.triangles,
          drawCalls: evidence.drawCalls,
        };
      });
      if (errors.length) throw new Error(JSON.stringify(errors));
      results.push({ level, camera, served, errors, state });
      console.log(`FIREPLACE ${level}: shown=${state.furniture.shown}, errors=${errors.length}`);
      await page.close();
    }
  } finally {
    fs.writeFileSync(
      path.join(output, "browser.json"),
      JSON.stringify({ base, overlays: "Only furniture index and fireplace GLBs; all other production bytes unchanged", results }, null, 2) + "\n"
    );
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
