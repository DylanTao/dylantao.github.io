// Precompute the home's static diffuse transport in the same Three runtime visitors use.
// Run against an owned root-site preview: COASTAL_CACHE_URL=http://127.0.0.1:4170/ node bin/bake_coastal_static_light.cjs
// Assets/modules are served from this checkout, so an older preview cannot silently supply a bake.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { coastalLightInputs, digest } = require("./coastal_static_light_inputs.cjs");
const root = path.resolve(__dirname, "..");
const base = new URL(process.env.COASTAL_CACHE_URL || "http://127.0.0.1:4170/");
(async () => {
  const manifestPath = path.join(root, "assets/models/home/manifest.json"),
    { manifest, inputs, signature } = await coastalLightInputs(root),
    errors = [];
  const browser = await chromium.launch({
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    page.setDefaultTimeout(Number(process.env.COASTAL_BAKE_TIMEOUT_MS) || 180000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/assets/**", async (route) => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname),
        relative = pathname.slice(base.pathname.replace(/\/$/, "").length + 1),
        filename = path.resolve(root, relative);
      if (!relative.startsWith("assets/") || !filename.startsWith(path.join(root, "assets") + path.sep)) return route.continue();
      if (relative === "assets/models/home/manifest.json") return route.fulfill({ contentType: "application/json", body: JSON.stringify(manifest) });
      // Generated responsive pictures and Liquid-templated site scripts belong to the built site.
      // Every geometry input and scene module, however, must come from this checkout or fail.
      if (!inputs.dependencies[relative] && !relative.startsWith("assets/js/home-scene/")) return route.continue();
      const contentType = /\.(mjs|js)$/.test(filename) ? "text/javascript" : filename.endsWith(".json") ? "application/json" : undefined;
      try {
        await route.fulfill({ path: filename, ...(contentType ? { contentType } : {}) });
      } catch (error) {
        errors.push(`Could not serve current source ${relative}: ${error.message}`);
        await route.abort().catch(() => {});
      }
    });
    await page.addInitScript(() => {
      const NativeDate = Date,
        fixed = NativeDate.parse("2026-10-23T13:20:00-07:00");
      window.Date = new Proxy(NativeDate, {
        construct(target, args) {
          return Reflect.construct(target, args.length ? args : [fixed]);
        },
        get(target, key) {
          return key === "now" ? () => fixed : Reflect.get(target, key);
        },
      });
    });
    await page.goto(new URL("?scene-lab=1", base).href, { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    const scene = page.locator("[data-home-desk-scene]");
    await scene.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const scene = document.querySelector("[data-home-desk-scene]"),
        field = scene?.getSceneEvidence?.().simulation?.lightField;
      return field?.ready || field?.error || scene?.dataset.sceneState === "failed";
    });
    const state = await scene.evaluate((element) => element.getSceneEvidence?.()),
      field = state?.simulation?.lightField;
    if (!field?.ready)
      throw new Error(
        `Bake could not initialize: ${JSON.stringify({ stage: state?.loading?.stage, error: field?.error, triangles: field?.triangles, errors })}`
      );
    const snapshot = await scene.evaluate((element, signature) => element.labScene.exportStaticLightSnapshot(signature), signature);
    if (snapshot.signature !== signature || errors.length) throw new Error(`Bake failed: ${JSON.stringify(errors)}`);
    snapshot.inputs = inputs;
    const body = JSON.stringify(snapshot) + "\n";
    if (Buffer.byteLength(body) > 800000) throw new Error("Static transport cache exceeds its explicit 800 KB JSON budget");
    if ((await coastalLightInputs(root)).signature !== signature)
      throw new Error("Scene inputs changed during the bake; retry after source changes finish");
    const filename = path.join(root, "assets/models/home/static-light-field.json");
    await fs.writeFile(filename + ".tmp", body);
    await fs.rename(filename + ".tmp", filename);
    manifest.staticLightFieldCache = { url: "static-light-field.json", signature, sha256: digest(body) };
    // Update only the descriptor. Re-serializing the whole authored manifest loses its numeric
    // spelling and creates unrelated geometry-metadata churn on every lighting bake.
    const source = (await fs.readFile(manifestPath, "utf8")).replace(/\r\n/g, "\n"),
      descriptor = JSON.stringify(manifest.staticLightFieldCache, null, 2).replace(/\n/g, "\n  "),
      existing = /"staticLightFieldCache"\s*:\s*\{[^{}]*\}/,
      updated = existing.test(source)
        ? source.replace(existing, '"staticLightFieldCache": ' + descriptor)
        : source.replace(/\n\}\s*$/, ',\n  "staticLightFieldCache": ' + descriptor + "\n}\n");
    if (!isDeepStrictEqual(JSON.parse(updated), manifest)) throw new Error("Cache descriptor update changed unrelated manifest data");
    await fs.writeFile(manifestPath, updated);
    console.log(JSON.stringify({ bytes: Buffer.byteLength(body), signature, sha256: digest(body), bake: snapshot.statistics }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
