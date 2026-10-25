// Before/after receipt for the primary-view Head-ownership exclusion on all five delivered
// avatars: down-looks, the full native mirror, the avatar-sensitive sun shadow and complete
// idle/walk cycles. Run from the repository root; it owns port 4162.
const fs = require("node:fs/promises"),
  http = require("node:http"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require(path.join(process.env.DEPENDENCY_REPO || process.cwd(), "node_modules/playwright"));
const root = process.cwd(),
  out = path.join(root, ".jekyll-cache/visual-qa/coord-2026-10-24/head-exclusion");
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
const views = { down80: 1.4, down69: 1.2, mirror: 0 };
async function main() {
  await fs.mkdir(out, { recursive: true });
  await new Promise((r) => server.listen(4162, "127.0.0.1", r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const report = {
    scope:
      "Delivered native avatars/material hooks, real bathroom mirror module, controlled lights. Static room casters disabled to isolate the actual full-avatar shadow target. Before = excludeHead false (the previous primary view), after = the default. Not production illumination or physical-phone FPS.",
    errors,
    avatars: {},
  };
  try {
    await page.goto("http://127.0.0.1:4162/artwork/coastal-home/reviews/first-person-head-2026-10-24/native/fixture.html");
    await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
    for (const id of ["ghibli", "lizard", "south-park", "simpsons", "rick-and-morty"]) {
      const captures = {},
        loads = {};
      for (const [variant, exclude] of [
        ["before", false],
        ["after", true],
      ]) {
        loads[variant] = await page.evaluate(([id, exclude]) => api.load(id, exclude), [id, exclude]);
        assert.equal(loads[variant].collarFailure, null);
        for (const [view, pitch] of Object.entries(views)) {
          captures[`${view}-${variant}`] = await page.evaluate((p) => api.draw(true, p), pitch);
          await page.screenshot({ path: path.join(out, `${id}-${view}-${variant}.png`) });
        }
      }
      const exclusion = loads.after.primaryHeadExclusion;
      assert.equal(loads.before.primaryHeadExclusion.primitives, 0, "the control draws the previous primary view");
      assert.ok(exclusion.primitives > 0 && exclusion.triangles > 0, `${id} has rigid Head-owned primitives`);
      const control = await page.evaluate(() => api.shadowControl());
      assert.equal(control.avatarSensitive, true, "the sun shadow target contains the avatar");
      assert.equal(control.unchanged, true, "the shadow returns exactly after hiding the avatar");
      for (const view of Object.keys(views))
        assert.equal(
          captures[`${view}-before`].shadowHash,
          captures[`${view}-after`].shadowHash,
          `${id} ${view}: the full native shadow is unchanged`
        );
      const mirrorUnchanged = captures["mirror-before"].pixelHash === captures["mirror-after"].pixelHash;
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
      report.avatars[id] = {
        exclusion,
        mirrorUnchanged,
        downLookChanged: {
          down80: captures["down80-before"].pixelHash !== captures["down80-after"].pixelHash,
          down69: captures["down69-before"].pixelHash !== captures["down69-after"].pixelHash,
        },
        triangles: Object.fromEntries(Object.entries(captures).map(([k, v]) => [k, v.info.triangles])),
        captures,
        shadowControl: control,
        cycles: { idle: cycles.idle.timings, walk: cycles.walk.timings },
      };
      await fs.writeFile(path.join(out, "evidence.json"), JSON.stringify(report, null, 2));
      console.log(
        JSON.stringify({
          id,
          exclusion,
          mirrorUnchanged,
          downLookChanged: report.avatars[id].downLookChanged,
          idle: cycles.idle.timings,
          walk: cycles.walk.timings,
        })
      );
    }
    assert.deepEqual(errors, []);
    report.passed = true;
    await fs.writeFile(path.join(out, "evidence.json"), JSON.stringify(report, null, 2));
    console.log("HEAD_EXCLUSION_NATIVE_PASS");
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
