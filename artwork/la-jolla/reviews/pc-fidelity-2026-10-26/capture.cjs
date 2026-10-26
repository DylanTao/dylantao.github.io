// Matched, complete-page source renders. Images stay ignored until selected for review.
// node artwork/la-jolla/reviews/pc-fidelity-2026-10-26/capture.cjs http://127.0.0.1:4102/al-folio
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { chromium, expect } = require("@playwright/test");

const root = path.resolve(__dirname, "../../../..");
const { preparePage, collectRuntimeErrors } = require(path.join(root, "test/visual/helpers"));
const base = (process.argv[2] || "http://127.0.0.1:4102/al-folio").replace(/\/$/, "");
const pin = "4b77a54d9cda04d81ed416f38a7d4d999970753e";
const output = path.join(root, ".jekyll-cache/visual-qa/site-fidelity-2026-10-26/matched-final");
const files = execFileSync("git", ["ls-tree", "-r", "--name-only", pin, "assets/js/footer-coast"], { cwd: root, encoding: "utf8" })
  .trim()
  .split(/\r?\n/);
files.push("assets/js/footer-coast/bed-relief.mjs", "assets/models/la-jolla/hills.png");
const variants = { before: new Map(), after: new Map() };
for (const file of new Set(files)) {
  if (fs.existsSync(path.join(root, file))) variants.after.set(file, fs.readFileSync(path.join(root, file)));
  if (file !== "assets/js/footer-coast/bed-relief.mjs")
    variants.before.set(file, execFileSync("git", ["show", `${pin}:${file}`], { cwd: root, maxBuffer: 8e6 }));
}
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [] });
  const receipt = {
    baseline: pin,
    candidateParent: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    method:
      "Complete built page; only footer modules and hill relief are source-routed to the pinned before/after variants. Every model, texture, font and page asset remains available. Fixed theme anchors, reduced motion, same page foundation and camera. Native PC GPU; 2K/4K viewport widths are not a physical display or phone claim.",
    base,
    sources: Object.fromEntries(Object.entries(variants).map(([v, map]) => [v, Object.fromEntries([...map].map(([p, b]) => [p, sha(b)]))])),
    sharedInputs: {},
    states: [],
  };
  for (const p of [
    "assets/models/la-jolla/manifest.json",
    "assets/models/la-jolla/la-jolla.glb",
    "assets/js/home-scene/realism.mjs",
    "assets/js/home-scene/model-loader.mjs",
    "assets/js/home-scene/camera-motion.mjs",
  ])
    if (fs.existsSync(path.join(root, p))) receipt.sharedInputs[p] = sha(fs.readFileSync(path.join(root, p)));
  for (const width of [2560, 3840])
    for (const theme of ["noon", "evening"])
      for (const [variant, map] of Object.entries(variants)) {
        const page = await browser.newPage({
          viewport: { width, height: width === 3840 ? 2160 : 1440 },
          deviceScaleFactor: 1,
          reducedMotion: "reduce",
        });
        const errors = collectRuntimeErrors(page);
        await preparePage(page, theme);
        await page.route("**/assets/**", (r) => {
          const pathname = new URL(r.request().url()).pathname.replace("/al-folio/", ""),
            bytes = map.get(pathname);
          if (bytes) r.fulfill({ body: bytes, contentType: pathname.endsWith(".png") ? "image/png" : "application/javascript" });
          else r.continue();
        });
        await page.goto(`${base}/?cinematic=live`, { waitUntil: "domcontentloaded" });
        const host = page.locator("footer [data-footer-coast]");
        await host.scrollIntoViewIfNeeded();
        await expect(host).toHaveAttribute("data-state", "ready", { timeout: 60000 });
        await expect(host.locator(".footer-coast__poster")).toBeHidden();
        const renderer = await host.locator("canvas").evaluate((c) => {
          const gl = c.getContext("webgl2"),
            d = gl.getExtension("WEBGL_debug_renderer_info");
          return {
            buffer: [c.width, c.height],
            css: [c.clientWidth, c.clientHeight],
            renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          };
        });
        const file = `${variant}-${width}-${theme}.png`;
        const png = await host.screenshot({ path: path.join(output, file) });
        receipt.states.push({
          variant,
          width,
          theme,
          file,
          sha256: sha(png),
          at: new Date().toISOString(),
          renderer,
          evidence: await host.evaluate((e) => e.getCoastEvidence()),
          errors,
        });
        fs.writeFileSync(path.join(output, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
        await page.close();
      }
  await browser.close();
  console.log(`Wrote ${receipt.states.length} matched captures to ${output}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
