// Complete-page, source-bound dusk pairs. NODE_PATH can point to the main checkout's dependencies.
// node artwork/la-jolla/reviews/continuous-dusk-2026-10-26/capture.cjs http://127.0.0.1:4106/al-folio
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { chromium, expect } = require("@playwright/test");

const root = path.resolve(__dirname, "../../../..");
const { preparePage, collectRuntimeErrors } = require(path.join(root, "test/visual/helpers"));
const base = (process.argv[2] || "http://127.0.0.1:4106/al-folio").replace(/\/$/, "");
const pin = execFileSync("git", ["rev-parse", "75d956485"], { cwd: root, encoding: "utf8" }).trim();
const output = path.join(root, ".jekyll-cache/visual-qa/finish-brand-footer-2026-10-26/matched-settled");
const files = execFileSync("git", ["ls-tree", "-r", "--name-only", pin, "assets/js/footer-coast"], { cwd: root, encoding: "utf8" })
  .trim()
  .split(/\r?\n/);
files.push("assets/js/theme.js");
const variants = { before: new Map(), after: new Map() };
for (const file of files) {
  variants.before.set(file, execFileSync("git", ["show", `${pin}:${file}`], { cwd: root, maxBuffer: 8e6 }));
  variants.after.set(file, fs.readFileSync(path.join(root, file)));
}
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [] });
  const receipt = {
    baseline: pin,
    candidateParent: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    method:
      "Complete built blog route, same page foundation, camera and fixed La Jolla date. Only footer modules and theme.js are source-routed; no page/model/texture/font assets are omitted. Native PC renderer, host viewport emulation, no physical-phone or performance claim.",
    base,
    browser: { engine: "chromium", version: browser.version(), playwright: require("playwright/package.json").version, platform: process.platform },
    sources: Object.fromEntries(Object.entries(variants).map(([v, map]) => [v, Object.fromEntries([...map].map(([p, b]) => [p, sha(b)]))])),
    sharedInputs: {},
    states: [],
  };
  for (const file of [
    "assets/models/la-jolla/hills.png",
    "assets/models/la-jolla/manifest.json",
    "assets/models/la-jolla/la-jolla.glb",
    "assets/js/home-scene/realism.mjs",
    "assets/js/home-scene/model-loader.mjs",
    "assets/js/home-scene/camera-motion.mjs",
    "package-lock.json",
  ])
    receipt.sharedInputs[file] = sha(fs.readFileSync(path.join(root, file)));
  try {
    for (const width of [2560, 390, 3840])
      for (const [state, time] of [
        ["sunset", "18:04"],
        ["blue-hour", "18:45"],
      ])
        for (const [variant, map] of Object.entries(variants)) {
          const page = await browser.newPage({
            viewport: { width, height: width === 3840 ? 2160 : 1000 },
            deviceScaleFactor: 1,
            reducedMotion: "reduce",
            timezoneId: "America/Los_Angeles",
          });
          const errors = collectRuntimeErrors(page);
          await page.clock.setFixedTime(new Date(`2026-10-19T${time}:00-07:00`));
          await preparePage(page, "noon");
          await page.addInitScript(() => {
            for (const key of ["theme", "theme-manual", "site-time"]) sessionStorage.removeItem(key);
            localStorage.removeItem("theme");
          });
          await page.route("**/assets/**", (route) => {
            const file = new URL(route.request().url()).pathname.replace("/al-folio/", ""),
              bytes = map.get(file);
            if (bytes) route.fulfill({ body: bytes, contentType: "application/javascript" });
            else route.continue();
          });
          const documentResponse = await page.goto(`${base}/blog/`, { waitUntil: "domcontentloaded" });
          if (!receipt.foundation) {
            const stylesheet = await page.locator('link[href*="/assets/css/main.css"]').getAttribute("href");
            const cssResponse = await page.request.get(new URL(stylesheet, page.url()).toString());
            receipt.foundation = {
              htmlSha256: sha(await documentResponse.body()),
              stylesheet,
              cssSha256: sha(await cssResponse.body()),
            };
          }
          const host = page.locator("footer [data-footer-coast]");
          await host.scrollIntoViewIfNeeded();
          await expect(host).toHaveAttribute("data-state", "ready", { timeout: 60000 });
          await expect(host.locator(".footer-coast__poster")).toBeHidden();
          await page.evaluate(() => document.fonts.ready);
          // The global companion has its own short entrance, independent of the coast. Let that
          // complete naturally in both sources; do not hide or omit it to manufacture a comparison.
          await page.waitForTimeout(600);
          const renderer = await host.locator("canvas").evaluate((canvas) => {
            const gl = canvas.getContext("webgl2"),
              debug = gl.getExtension("WEBGL_debug_renderer_info");
            return {
              buffer: [canvas.width, canvas.height],
              css: [canvas.clientWidth, canvas.clientHeight],
              attributes: gl.getContextAttributes(),
              renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
            };
          });
          const file = `${variant}-${width}-${state}.png`;
          const pixels = await page.locator("footer").screenshot({ path: path.join(output, file) });
          receipt.states.push({
            variant,
            width,
            state,
            time,
            file,
            sha256: sha(pixels),
            renderer,
            evidence: await host.evaluate((e) => e.getCoastEvidence()),
            errors,
          });
          fs.writeFileSync(path.join(output, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
          expect(errors).toEqual([]);
          await page.close();
        }
  } finally {
    await browser.close();
  }
  console.log(`Wrote ${receipt.states.length} complete matched captures to ${output}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
