const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = process.cwd();
const out = path.join(root, ".jekyll-cache/visual-qa/pc-fidelity-2026-10-26/quality");
fs.mkdirSync(out, { recursive: true });
const changed = new Set(["assets/js/home-scene/controller.mjs", "assets/js/home-scene/quality.mjs", "assets/js/home-scene/resolution.mjs"]);
const baseRef = process.env.PC_QUALITY_BASE_REF || "8f13a4646";
const rows = [];
const types = { ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary" };
const cases = process.env.PC_QUALITY_CASES
  ? JSON.parse(process.env.PC_QUALITY_CASES)
  : [
      { name: "2k-base-a", variant: "base", width: 2560, height: 1440, dpr: 1 },
      { name: "2k-work-a", variant: "work", width: 2560, height: 1440, dpr: 1 },
      { name: "2k-work-b", variant: "work", width: 2560, height: 1440, dpr: 1 },
      { name: "2k-base-b", variant: "base", width: 2560, height: 1440, dpr: 1 },
      { name: "4k-base", variant: "base", width: 1920, height: 1080, dpr: 2 },
      { name: "4k-work", variant: "work", width: 1920, height: 1080, dpr: 2 },
    ];
(async () => {
  for (const c of cases) {
    const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
    try {
      const page = await browser.newPage({
        viewport: { width: c.width, height: c.height },
        deviceScaleFactor: c.dpr,
        timezoneId: "America/Los_Angeles",
      });
      const errors = [],
        consoleErrors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (e) => {
        if (e.type() === "error") consoleErrors.push(e.text());
      });
      await page.clock.setFixedTime(new Date("2026-10-01T13:20:00-07:00"));
      const serve = async (route) => {
        const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/al-folio\//, "");
        if (!rel.startsWith("assets/") || rel.includes("..")) return route.continue();
        const full = path.join(root, rel);
        if (!fs.existsSync(full)) return route.continue();
        const body =
          c.variant === "base" && changed.has(rel)
            ? execFileSync("git", ["show", baseRef + ":" + rel], { cwd: root, maxBuffer: 32 << 20 })
            : fs.readFileSync(full);
        await route.fulfill({ body, contentType: types[path.extname(full)] || "application/octet-stream" });
      };
      await page.route("**/assets/js/home-scene/**", serve);
      await page.route("**/assets/models/home/**", serve);
      await page.goto((process.env.PC_QUALITY_URL || "http://127.0.0.1:4104/al-folio/") + "?scene-lab=1&quality=auto&perf=1&seed=7", {
        waitUntil: "domcontentloaded",
      });
      const scene = page.locator("[data-home-desk-scene]");
      await page.locator('[data-home-desk-mode="3d"]').click();
      await scene.scrollIntoViewIfNeeded();
      await scene.waitFor({ state: "visible" });
      await page.waitForFunction(() => document.querySelector("[data-home-desk-scene]")?.dataset.sceneState === "ready", null, { timeout: 180000 });
      const ui = page.locator("[data-home-world-controls]");
      await ui.locator("[data-world-lab] > summary").click();
      await ui.locator('[data-world-room="outside"]').first().click();
      await ui.locator("[data-world-fullscreen]").click();
      await page.waitForTimeout(3000);
      const samples = [];
      const read = () =>
        scene.evaluate((host) => {
          const e = host.getSceneEvidence();
          const canvas = host.querySelector("canvas");
          const gl = canvas.getContext("webgl2");
          const ext = gl.getExtension("WEBGL_debug_renderer_info");
          return {
            room: e.currentRoom,
            ready: e.ready,
            frames: e.frames,
            seconds: e.animationSeconds,
            quality: e.quality,
            resolution: e.resolution,
            detail: e.detail,
            rendering: e.rendering,
            frameTiming: e.frameTiming,
            drawCalls: e.drawCalls,
            triangles: e.triangles,
            resources: e.resources,
            furniture: e.furniture,
            buffer: [canvas.width, canvas.height],
            css: [canvas.clientWidth, canvas.clientHeight],
            renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
            lightCache: e.loading.lightCache,
            programs: e.resources.programs,
          };
        });
      const first = await read();
      for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(5000);
        samples.push(await read());
      }
      await scene.locator("canvas").screenshot({ path: path.join(out, c.name + "-moving.png") });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForTimeout(1800);
      const still = await read();
      await scene.locator("canvas").screenshot({ path: path.join(out, c.name + "-still.png") });
      const row = { ...c, baseRef, first, samples, still, errors, consoleErrors };
      rows.push(row);
      fs.writeFileSync(
        path.join(out, "receipt.json"),
        JSON.stringify(
          {
            source:
              "Root working tree versus committed " +
              baseRef +
              " quality/controller/resolution only; all home models/modules routed from this tree; native RAF and fixed Date, not a throughput guarantee.",
            rows,
          },
          null,
          2
        )
      );
      console.log(
        c.name,
        JSON.stringify({
          tier: still.quality.tier,
          buffer: still.buffer,
          frame: samples.at(-1).frameTiming,
          history: still.quality.history,
          resolution: still.resolution,
          errors,
        })
      );
    } finally {
      await browser.close();
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
