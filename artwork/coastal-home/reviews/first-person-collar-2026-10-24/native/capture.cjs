const fs = require("node:fs/promises"),
  http = require("node:http"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require(path.join(process.env.DEPENDENCY_REPO || process.cwd(), "node_modules/playwright"));
const root = process.cwd(),
  out = path.join(root, ".jekyll-cache/neck-cap/final-native");
const types = {
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".html": "text/html",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
};
const server = http.createServer(async (req, res) => {
  try {
    const file = path.resolve(root, "." + decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(root + path.sep)) throw Error("path");
    const bytes = await fs.readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
async function main() {
  await fs.mkdir(out, { recursive: true });
  await new Promise((r) => server.listen(4191, "127.0.0.1", r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const report = {
    scope:
      "Delivered native avatars/material hooks, real bathroom mirror module, controlled lights. Static room casters disabled to isolate the actual full-avatar shadow target with avatar-hidden negative control. Not production illumination or physical-phone FPS.",
    errors,
    avatars: {},
  };
  try {
    await page.goto("http://127.0.0.1:4191/artwork/coastal-home/reviews/first-person-collar-2026-10-24/native/fixture.html");
    await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
    for (const id of ["ghibli", "lizard", "south-park", "simpsons", "rick-and-morty"]) {
      const initial = await page.evaluate((id) => api.load(id), id),
        captures = {};
      assert.equal(initial.collarFailure, null);
      for (const pitch of [1.4, 1.2, 0])
        for (const caps of [false, true]) {
          const label = `${id}-${pitch === 0 ? "mirror" : pitch === 1.4 ? "down80" : "down69"}-${caps ? "liner" : "before"}`;
          captures[label] = await page.evaluate(([c, p]) => api.draw(c, p), [caps, pitch]);
          await page.screenshot({ path: path.join(out, label + ".png") });
        }
      const control = await page.evaluate(() => api.shadowControl());
      assert.equal(control.avatarSensitive, true);
      assert.equal(control.unchanged, true);
      assert.equal(
        captures[`${id}-mirror-before`].pixelHash,
        captures[`${id}-mirror-liner`].pixelHash,
        "the complete native mirror view is unchanged"
      );
      for (const view of ["down80", "down69", "mirror"])
        assert.equal(captures[`${id}-${view}-before`].shadowHash, captures[`${id}-${view}-liner`].shadowHash, "full native shadow is unchanged");
      const cycles = {};
      for (const clip of ["idle", "walk"]) {
        const sweep = await page.evaluate((clip) => api.sweep(clip), clip);
        for (const f of sweep.frames) {
          await fs.writeFile(path.join(out, `${id}-${clip}-${f.phase}.png`), Buffer.from(f.png.split(",")[1], "base64"));
          delete f.png;
          assert.equal(f.evidence.glError, 0);
          assert.equal(f.evidence.capsVisibleAfter, false);
          assert.equal(f.evidence.presence.collarFailure, null);
        }
        assert.ok(sweep.presence[clip === "walk" ? "gaitTime" : "idleTime"] >= sweep.clipDuration - 1e-6);
        cycles[clip] = sweep;
      }
      report.avatars[id] = { initial, captures, shadowControl: control, cycles };
      await fs.writeFile(path.join(out, "evidence.json"), JSON.stringify(report, null, 2));
      console.log(
        JSON.stringify({ id, shadowControl: control, setup: initial.collarLiner.setupMs, idle: cycles.idle.timings, walk: cycles.walk.timings })
      );
    }
    assert.deepEqual(errors, []);
    report.passed = true;
    await fs.writeFile(path.join(out, "evidence.json"), JSON.stringify(report, null, 2));
    console.log("FINAL_NATIVE_PASS");
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
}
main().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
