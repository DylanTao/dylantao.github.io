"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { argumentsFrom, loadRelease, manifestPath, collectorPath, sha, signedDigest } = require("./r2-source.cjs");

const cli = argumentsFrom(process.argv.slice(2), "node collect-r2.cjs CHECKOUT FULL_SHA OUTPUT [LOCAL_PREVIEW_URL] [--dry]");
const base = new URL(cli.tail.find((value) => value !== "--dry") ?? "http://127.0.0.1:8080/");
const extractUrl = new URL(base);
extractUrl.searchParams.set("scene-lab", "1");
const host = "[data-home-desk-scene]";

async function writeGeometry(page, out, name, size) {
  const leaf = name + ".f32le";
  const file = await fs.open(path.join(out, leaf), "w");
  const digest = createHash("sha256");
  try {
    for (let offset = 0; offset < size; offset += 1024 * 1024) {
      const base64 = await page.evaluate(
        ({ name, offset }) => {
          const value = globalThis.__privateR2Geometry[name];
          const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
          const end = Math.min(bytes.length, offset + 1024 * 1024);
          let binary = "";
          for (let i = offset; i < end; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, Math.min(end, i + 8192)));
          return btoa(binary);
        },
        { name, offset }
      );
      const bytes = Buffer.from(base64, "base64");
      assert.equal(bytes.length, Math.min(size - offset, 1024 * 1024));
      digest.update(bytes);
      await file.writeFile(bytes);
    }
  } finally {
    await file.close();
  }
  return { file: leaf, bytes: size, sha256: digest.digest("hex") };
}

async function run() {
  const started = performance.now();
  const ctx = await loadRelease(cli);
  const { chromium } = require(path.join(ctx.checkout, "node_modules/playwright"));
  const source = await fs.readFile(path.join(ctx.pinned, collectorPath), "utf8");
  assert.equal(signedDigest(collectorPath, Buffer.from(source)), ctx.inputs.dependencies[collectorPath]);
  const beforeBvh = "      const acceleratorStart = performance.now();";
  assert.equal(source.split(beforeBvh).length, 2, "Collector hook no longer identifies one site.");
  const instrumented = source.replace(
    beforeBvh,
    [
      "      globalThis.__privateR2Geometry = { ...geometry, configuration: snapshotConfiguration, statistics: { ...statistics } };",
      "      await new Promise(() => {});",
      beforeBvh,
    ].join("\n")
  );
  const report = {
    revision: ctx.revision,
    signature: ctx.signature,
    dateClock: "2026-10-23T13:20:00-07:00",
    sourceManifestSha256: ctx.manifestHash,
    sourceFieldSha256: ctx.snapshotHash,
    collectorSha256: sha(source),
    instrumentedCollectorSha256: sha(instrumented),
    url: extractUrl.href,
    errors: [],
    assetReads: {},
  };
  if (cli.tail.includes("--dry")) {
    console.log(JSON.stringify({ ...report, signedAssets: Object.keys(ctx.inputs.dependencies).length, playwright: Boolean(chromium) }));
    return;
  }

  const browser = await chromium.launch({
    headless: true,
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : [],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      timezoneId: "America/Los_Angeles",
    });
    await page.clock.setFixedTime(new Date(report.dateClock));
    page.on("pageerror", (error) => report.errors.push(error.message));
    await page.route("**/assets/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return route.continue();
      const relative = decodeURIComponent(url.pathname).slice(base.pathname.length);
      try {
        if (relative === manifestPath) return route.fulfill({ contentType: "application/json", body: JSON.stringify(ctx.withoutCache) });
        if (relative === collectorPath) {
          report.assetReads[relative] = sha(instrumented);
          return route.fulfill({ contentType: "text/javascript", body: instrumented });
        }
        const expected = ctx.inputs.dependencies[relative];
        const sceneSource = relative.startsWith("assets/js/home-scene/") || relative === "assets/js/home.js";
        if (!expected && !sceneSource) return route.continue();
        const from = relative.startsWith("assets/js/") ? ctx.pinned : ctx.checkout;
        const full = path.resolve(from, relative);
        assert(full.startsWith(path.resolve(from, "assets") + path.sep));
        let bytes = await fs.readFile(full).catch((error) => {
          if (error.code !== "ENOENT") throw error;
          return ctx.immutableBlob(relative);
        });
        if (expected && signedDigest(relative, bytes) !== expected) bytes = ctx.immutableBlob(relative);
        if (expected) assert.equal(signedDigest(relative, bytes), expected, "Changed input " + relative);
        report.assetReads[relative] = sha(bytes);
        const contentType = /\.(js|mjs)$/.test(relative)
          ? "text/javascript"
          : relative.endsWith(".json")
            ? "application/json"
            : relative.endsWith(".wasm")
              ? "application/wasm"
              : relative.endsWith(".glb")
                ? "model/gltf-binary"
                : undefined;
        return route.fulfill({ ...(contentType ? { contentType } : {}), body: bytes });
      } catch (error) {
        report.errors.push(error.message);
        return route.abort().catch(() => {});
      }
    });
    await page.goto(extractUrl.href, { waitUntil: "domcontentloaded" });
    await page.locator('[data-home-desk-mode="3d"]').click();
    await page.locator(host).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => Boolean(globalThis.__privateR2Geometry), null, { timeout: 170000, polling: 160 });
    report.arrivedMs = performance.now() - started;
    report.collector = await page.evaluate(() => {
      const { positions, albedo, configuration, statistics } = globalThis.__privateR2Geometry;
      return { positions: positions.byteLength, albedo: albedo.byteLength, configuration, statistics };
    });
    assert.equal(report.collector.configuration, ctx.snapshot.configuration);
    for (const key of ["triangles", "sourceTriangles", "skippedTriangles", "allocatedTriangles", "meshes"]) {
      assert.equal(report.collector.statistics[key], ctx.snapshot.statistics[key], "Geometry count mismatch: " + key);
    }
    assert.equal(report.collector.positions, ctx.snapshot.statistics.triangles * 9 * Float32Array.BYTES_PER_ELEMENT);
    assert.equal(report.collector.albedo, ctx.snapshot.statistics.triangles * 3 * Float32Array.BYTES_PER_ELEMENT);
    report.arrays = {};
    for (const name of ["positions", "albedo"]) {
      report.arrays[name] = await writeGeometry(page, ctx.out, name, report.collector[name]);
    }
    assert.deepEqual(report.errors, []);
    report.ok = true;
  } catch (error) {
    report.error = error.stack;
    throw error;
  } finally {
    await browser.close();
    report.elapsedMs = performance.now() - started;
    await fs.writeFile(path.join(ctx.out, "COLLECTOR.json"), JSON.stringify(report, null, 2) + "\n");
  }
  console.log(
    JSON.stringify(
      {
        revision: ctx.revision,
        signature: ctx.signature,
        triangles: report.collector.statistics.triangles,
        arrays: report.arrays,
        elapsedMs: report.elapsedMs,
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
