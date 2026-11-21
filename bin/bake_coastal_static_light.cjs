// Precompute the home's static diffuse transport in the same Three runtime visitors use.
// Run against an owned root-site preview: COASTAL_CACHE_URL=http://127.0.0.1:4170/ node bin/bake_coastal_static_light.cjs
// Assets/modules are served from this checkout, so an older preview cannot silently supply a bake.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { coastalLightInputs, digest } = require("./coastal_static_light_inputs.cjs");
const { fingerprintLoungeTriangles, loungeGeometryFingerprint } = require("./coastal_lounge_solar_geometry.cjs");
const root = path.resolve(__dirname, "..");
const base = new URL(process.env.COASTAL_CACHE_URL || "http://127.0.0.1:4170/");
const refreshLoungeSolar = process.argv.includes("--refresh-lounge-solar");
const loungeFile = "lounge-solar.json";
const readOptional = (filename) =>
  fs.readFile(filename).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
async function readLoungeTriangles(page, triangles) {
  const result = {};
  for (const [name, stride] of [
    ["positions", 9],
    ["albedo", 3],
  ]) {
    const array = new Float32Array(triangles * stride);
    const bytes = new Uint8Array(array.buffer);
    for (let offset = 0; offset < bytes.length; offset += 1024 * 1024) {
      const encoded = await page.evaluate(
        ({ name, offset }) => {
          const values = globalThis.coastalLightBakeTriangles[name];
          const source = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
          const end = Math.min(offset + 1024 * 1024, source.length);
          let text = "";
          for (let i = offset; i < end; i += 8192) text += String.fromCharCode(...source.subarray(i, Math.min(i + 8192, end)));
          return btoa(text);
        },
        { name, offset }
      );
      const chunk = Buffer.from(encoded, "base64");
      if (chunk.length !== Math.min(1024 * 1024, bytes.length - offset)) throw new Error("Truncated lounge geometry");
      bytes.set(chunk, offset);
    }
    result[name] = array;
  }
  return result;
}
(async () => {
  const manifestPath = path.join(root, "assets/models/home/manifest.json"),
    { manifest, inputs, signature } = await coastalLightInputs(root),
    errors = [];
  const loungePath = path.join(path.dirname(manifestPath), loungeFile);
  const priorLounge = await readOptional(loungePath);
  const previous = JSON.parse(await fs.readFile(manifestPath, "utf8")).staticLightFieldCache;
  if (previous?.loungeSolar && !priorLounge && !refreshLoungeSolar)
    throw new Error("The active lounge solar table is missing. Run the bake with --refresh-lounge-solar.");
  const wantsLoungeSolar = Boolean(priorLounge || refreshLoungeSolar);
  const browser = await chromium.launch({
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    page.setDefaultTimeout(Number(process.env.COASTAL_BAKE_TIMEOUT_MS) || 180000);
    page.on("pageerror", (error) => errors.push(error.message));
    if (wantsLoungeSolar)
      await page.addInitScript({
        content: `
          globalThis.coastalLightBakeGeometry = async (geometry) => {
            globalThis.coastalLightBakeTriangleFingerprint = await (${fingerprintLoungeTriangles.toString()})(geometry.positions, geometry.albedo);
            if (${refreshLoungeSolar}) globalThis.coastalLightBakeTriangles = geometry;
          };
        `,
      });
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
    let loungeBody = priorLounge,
      loungeDescriptor = null;
    if (wantsLoungeSolar) {
      const triangleFingerprint = await page.evaluate(() => globalThis.coastalLightBakeTriangleFingerprint);
      const geometryFingerprint = loungeGeometryFingerprint(snapshot, triangleFingerprint);
      if (refreshLoungeSolar) {
        const geometry = await readLoungeTriangles(page, snapshot.statistics.triangles);
        // Once the canonical geometry has been extracted the fit is entirely CPU work.
        await browser.close();
        const { bakeLoungeSolar } = await import("./coastal_lounge_solar_bake.mjs");
        loungeBody = Buffer.from(JSON.stringify(await bakeLoungeSolar(snapshot, geometry, geometryFingerprint)) + "\n");
      }
      const { decodeLoungeSolar } = await import("../assets/js/home-scene/deferred/lounge-solar.mjs");
      try {
        decodeLoungeSolar(JSON.parse(loungeBody), geometryFingerprint);
      } catch (error) {
        throw new Error("Lounge solar table no longer matches the measured geometry. Run the bake with --refresh-lounge-solar.", { cause: error });
      }
      snapshot.loungeSolarGeometry = geometryFingerprint;
      loungeDescriptor = {
        loungeSolar: loungeFile,
        loungeSolarSha256: digest(loungeBody),
        loungeSolarGeometry: geometryFingerprint,
      };
    }
    // Keep every transport/moment bit. The runtime supports the legacy decimal
    // format too; new authoring bakes use explicit little-endian typed bytes.
    const pack = (values, width) => {
      const bytes = Buffer.alloc(values.length * width);
      for (let i = 0; i < values.length; i++) {
        if (width === 8) bytes.writeDoubleLE(values[i], i * width);
        else bytes.writeFloatLE(values[i], i * width);
        const restored = width === 8 ? bytes.readDoubleLE(i * width) : bytes.readFloatLE(i * width);
        if (!Number.isFinite(values[i]) || !Object.is(restored, values[i])) throw new Error("Cache packing changed a lighting value");
      }
      return bytes.toString("base64");
    };
    snapshot.transport = pack(snapshot.transport, 8);
    snapshot.moments = pack(snapshot.moments, 4);
    snapshot.version = 2;
    const body = JSON.stringify(snapshot) + "\n";
    if (Buffer.byteLength(body) > 800000) throw new Error("Static transport cache exceeds its explicit 800 KB JSON budget");
    if ((await coastalLightInputs(root)).signature !== signature)
      throw new Error("Scene inputs changed during the bake; retry after source changes finish");
    const filename = path.join(root, "assets/models/home/static-light-field.json");
    manifest.staticLightFieldCache = { url: "static-light-field.json", signature, sha256: digest(body), ...loungeDescriptor };
    // Update only the descriptor. Re-serializing the whole authored manifest loses its numeric
    // spelling and creates unrelated geometry-metadata churn on every lighting bake.
    const source = (await fs.readFile(manifestPath, "utf8")).replace(/\r\n/g, "\n"),
      descriptor = JSON.stringify(manifest.staticLightFieldCache, null, 2).replace(/\n/g, "\n  "),
      existing = /"staticLightFieldCache"\s*:\s*\{[^{}]*\}/,
      updated = existing.test(source)
        ? source.replace(existing, '"staticLightFieldCache": ' + descriptor)
        : source.replace(/\n\}\s*$/, ',\n  "staticLightFieldCache": ' + descriptor + "\n}\n");
    if (!isDeepStrictEqual(JSON.parse(updated), manifest)) throw new Error("Cache descriptor update changed unrelated manifest data");
    if (wantsLoungeSolar) {
      const live = await readOptional(loungePath);
      if (!isDeepStrictEqual(live, priorLounge)) throw new Error("Lounge solar table changed during the bake; retry after authoring.");
    }
    await fs.writeFile(filename + ".tmp", body);
    if (refreshLoungeSolar) await fs.writeFile(loungePath + ".tmp", loungeBody);
    if (refreshLoungeSolar) await fs.rename(loungePath + ".tmp", loungePath);
    await fs.rename(filename + ".tmp", filename);
    await fs.writeFile(manifestPath, updated);
    // The signed dependency inventory is for authors. A visitor only needs its
    // digest and the radiance field, both of which the delivered manifest binds.
    const inventory = path.join(root, "artwork/coastal-home/reviews/static-light-inputs.json");
    await fs.writeFile(inventory, JSON.stringify({ signature, inputs }, null, 2) + "\n");
    console.log(
      JSON.stringify(
        { bytes: Buffer.byteLength(body), signature, sha256: digest(body), loungeSolar: loungeDescriptor, bake: snapshot.statistics },
        null,
        2
      )
    );
  } finally {
    if (browser.isConnected()) await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
