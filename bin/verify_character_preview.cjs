// Verify that an owned preview has finished rebuilding this source checkpoint.
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])])
        )
      : value;
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
(async () => {
  const base = (process.env.VISUAL_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, ""),
    out = path.resolve(process.env.CHARACTER_PREVIEW_EVIDENCE || ".jekyll-cache/visual-qa/character-preview-freshness.json"),
    files = [
      "assets/models/home/manifest.json",
      ...["controller", "character-performance", "companion", "wildlife", "wildlife-motion", "wildlife-neighbor-motion", "occlusion-region"].map(
        (name) => `assets/js/home-scene/${name}.mjs`
      ),
      "assets/js/companion/attention.mjs",
      "assets/js/companion/performance.mjs",
      ...["ghibli", "lizard", "south-park", "simpsons", "rick-and-morty"].map((name) => `assets/models/home/sirui-${name}.glb`),
      ...["BrushRabbit", "CaliforniaSeaLion", "HarborSeal", "Raccoon", "WesternGull", "Sandpiper"].map((name) => `assets/models/home/${name}.glb`),
    ];
  const results = await Promise.all(
    files.map(async (file) => {
      const response = await fetch(`${base}/${file}`);
      if (!response.ok) throw new Error(`${response.status} ${file}`);
      let source = await fs.readFile(file),
        served = Buffer.from(await response.arrayBuffer()),
        normalization = "binary";
      if (file.endsWith(".mjs")) {
        source = Buffer.from(source.toString("utf8").replaceAll("\r\n", "\n"));
        served = Buffer.from(served.toString("utf8").replaceAll("\r\n", "\n"));
        normalization = "LF line endings";
      } else if (file.endsWith(".json")) {
        source = Buffer.from(JSON.stringify(canonical(JSON.parse(source))));
        served = Buffer.from(JSON.stringify(canonical(JSON.parse(served))));
        normalization = "canonical JSON data";
      }
      return { file, normalization, sourceSha256: hash(source), servedSha256: hash(served), matches: source.equals(served) };
    })
  );
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify({ capturedAt: new Date().toISOString(), base, results }, null, 2) + "\n");
  const stale = results.filter((result) => !result.matches);
  if (stale.length) throw new Error(`Preview is stale: ${stale.map((result) => result.file).join(", ")}`);
  console.log(JSON.stringify({ matchedAssets: results.length, base, evidence: out }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
