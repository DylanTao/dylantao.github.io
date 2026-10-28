// CPU-only observations, not an isolated device benchmark or a browser startup metric.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const source = path.resolve(__dirname, "../../../../assets/js/home-coffee-stain.js");
const { design, densityField, paintField } = require(source);
const hash = (array) =>
  crypto
    .createHash("sha256")
    .update(Buffer.from(array.buffer, array.byteOffset, array.byteLength))
    .digest("hex");
const observations = [];
for (const [seed, size, wet] of [
  ["52", 1024, false],
  ["7", 1024, false],
  ["31", 1024, false],
  ["103", 1024, false],
  ["31", 1536, true],
]) {
  const started = performance.now(),
    plan = design(seed, size),
    job = densityField(plan, { wet });
  while (!job.step()) {}
  const paint = paintField(plan, job.field, "light");
  while (!paint.step()) {}
  observations.push({
    seed,
    size,
    wet,
    elapsedObservedMs: performance.now() - started,
    density: job.stats,
    palette: paint.stats,
    densitySha256: hash(job.field),
    rgbaSha256: hash(paint.pixels),
    drops: plan.drops,
    fieldBytes: job.field.byteLength + (job.washField?.byteLength || 0),
    rgbaBytes: paint.pixels.byteLength,
    profileBytes: 81920,
  });
}
const report = {
  scope:
    "CPU-only synchronous execution of the production generator under shared machine load. No isolated hardware timing, FPS, browser startup or physical-phone performance claim.",
  sourceSha256Lf: crypto.createHash("sha256").update(fs.readFileSync(source, "utf8").replace(/\r\n/g, "\n")).digest("hex"),
  node: process.version,
  platform: process.platform,
  typedArrayBounds: {
    maximumResolution: 1536,
    liveDensityAndRGBABytes: 1536 * 1536 * 12,
    dryDensityAndRGBABytes: 1536 * 1536 * 8,
    profileBytes: 81920,
    excludes:
      "JS objects, Canvas/browser backing stores, image encoding/decoding, data-URL strings and driver memory. This is not a total-memory measurement.",
  },
  observations,
};
const output = process.env.COFFEE_COST_OUTPUT || path.join(__dirname, "generator-observations.json");
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    output,
    densityHashes: observations.slice(0, 4).map((entry) => entry.densitySha256),
    maximumObservedChunkMs: Math.max(...observations.map((entry) => entry.density.maxChunkMs)),
  })
);
