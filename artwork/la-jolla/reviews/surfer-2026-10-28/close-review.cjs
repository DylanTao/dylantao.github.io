const { chromium } = require("playwright");
const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { execFileSync } = require("node:child_process");
// Run from the repository root against an owned, complete preview. Only the camera
// is changed in the intercepted scene module; every world object and water pass remains.
const root = process.cwd();
const baselineRef = process.env.COAST_BASELINE_REF || "759a3b58b";
const base = (process.env.COAST_REVIEW_URL || "http://127.0.0.1:4111/al-folio").replace(/\/$/, "");
(async () => {
  const baseline = process.argv.includes("--baseline"),
    name = baseline ? "before-close" : "after-close";
  const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1000, height: 650 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await context.newPage(),
      errors = [],
      sourceBinding = {};
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/assets/js/footer-coast/*.mjs*", async (route) => {
      const relative = "assets/js/footer-coast/" + new URL(route.request().url()).pathname.split("/").at(-1);
      let source = baseline
        ? execFileSync("git", ["show", baselineRef + ":" + relative], { cwd: root }).toString()
        : await fs.readFile(path.join(root, relative), "utf8");
      sourceBinding[relative] = crypto.createHash("sha256").update(source).digest("hex");
      if (relative.endsWith("/scene.mjs"))
        source = source.replace(
          "    camera.position.copy(cameraBase);",
          "    camera.left=-2.7; camera.right=2.7; camera.top=1.755; camera.bottom=-1.755; camera.updateProjectionMatrix(); cameraBase.set(7.5,8,13.5); target.set(4,0.3,5.7);\n    camera.position.copy(cameraBase);"
        );
      await route.fulfill({ contentType: "application/javascript", body: source });
    });
    if (baseline)
      await page.route("**/assets/models/la-jolla/*.glb*", (route) => {
        const filename = new URL(route.request().url()).pathname.split("/").at(-1);
        return route.fulfill({
          body: execFileSync("git", ["show", baselineRef + ":assets/models/la-jolla/" + filename], { cwd: root, maxBuffer: 4 * 1024 * 1024 }),
        });
      });
    const url = base + "/__surfer-close-review__";
    await page.route(url, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html data-theme-mode="noon"><head><style>html,body,figure{margin:0;background:#fffefa}.footer-coast__scene{width:100vw;height:100vh}canvas{display:block}</style></head><body><figure data-footer-coast><div class="footer-coast__scene"><canvas></canvas></div></figure><script type="module">import{mountCoast}from"${base}/assets/js/footer-coast/scene.mjs";await mountCoast(document.querySelector("figure"));</script></body></html>`,
      })
    );
    await page.goto(url);
    await page.waitForSelector('[data-state="ready"]', { timeout: 90000 });
    await page.locator("canvas").screenshot({ path: path.join(__dirname, name + ".png") });
    await fs.writeFile(
      path.join(__dirname, name + ".json"),
      JSON.stringify(
        { cameraOnlyDiagnostic: true, sourceBinding, evidence: await page.locator("figure").evaluate((e) => e.getCoastEvidence()), errors },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
