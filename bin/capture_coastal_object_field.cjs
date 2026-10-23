const { chromium } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { PNG } = require("pngjs");
(async () => {
  const b = await chromium.launch({ headless: true, args: ["--use-angle=d3d11"] });
  try {
    const p = await b.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:4162/artwork/coastal-home/learned-object/?capture=1");
    await p.waitForFunction(() => window.objectFieldCapture);
    const dir = path.resolve(__dirname, "../artwork/coastal-home/learned-object/data");
    await fs.mkdir(dir, { recursive: true });
    const views = [];
    let index = 0;
    for (const pitch of [10, 35])
      for (let yaw = 0; yaw < 360; yaw += 30) {
        const split = yaw % 60 === 0 ? "train" : "test";
        const v = await p.evaluate(({ yaw, pitch }) => objectFieldCapture.capture(yaw, pitch, 64), { yaw, pitch });
        const pixels = Uint8Array.from(v.pixels);
        delete v.pixels;
        const file = `view-${index++}.rgba`;
        await fs.writeFile(path.join(dir, file), pixels);
        views.push({ ...v, split, file, sha256: crypto.createHash("sha256").update(pixels).digest("hex") });
      }
    const surface = await p.evaluate(() => objectFieldCapture.surface(256));
    const renderer = await p.evaluate(() => objectFieldCapture.renderer());
    const source = await fs.readFile(path.resolve(__dirname, "../artwork/coastal-home/learned-object/data/source.glb"));
    await fs.writeFile(
      path.join(dir, "dataset.json"),
      JSON.stringify(
        {
          schema_version: 1,
          source: "assets/models/home/furniture/eames-lounge-lod1.glb",
          sourceSha256: crypto.createHash("sha256").update(source).digest("hex"),
          sourceBytes: source.length,
          renderer,
          domain:
            "Owned original procedural mesh under captured fixed lighting. Cameras exactly calibrated by Three.js matrices; no photographs or paper assets.",
          backgroundSrgb: [232 / 255, 228 / 255, 220 / 255],
          pixelOrder: "RGBA unsigned byte; bottom row first (WebGL readPixels)",
          views,
          surface,
          errors,
        },
        null,
        2
      ) + "\n"
    );
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      JSON.stringify({
        views: views.length,
        train: views.filter((v) => v.split === "train").length,
        test: views.filter((v) => v.split === "test").length,
        points: surface.samples.length,
        renderer,
      })
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
