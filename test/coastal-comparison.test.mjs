import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import test from "node:test";
import { gzipSync } from "node:zlib";
import comparison from "../bin/compare_coastal_revisions.cjs";

const base = new URL("http://localhost:8080/site/");
const manifest = {
  shell: "shell.glb",
  coast: "coast.glb",
  wallArt: { file: "../../img/home/sirui_capy.jpg" },
  staticLightFieldCache: { url: "static-light-field.json" },
  rooms: [{ id: "lounge" }],
  avatars: [{ id: "lizard" }],
};
const manifestBytes = Buffer.from(JSON.stringify(manifest));
const content = (file, body = Buffer.from(file), start = 100) => ({ url: new URL(file, base).href, body, start, status: 200 });
const ready = 130;
const entry = [
  content("assets/models/home/manifest.json?v=one", manifestBytes),
  ...[
    "assets/js/home-scene/controller.mjs",
    "assets/js/home-scene/routine.mjs",
    "assets/js/three.module.min.js",
    "assets/models/home/shell.glb",
    "assets/models/home/coast.glb",
    "assets/models/home/static-light-field.json",
    "assets/img/home/sirui_capy.jpg",
  ].map((file) => content(file)),
];

test("first scene charges served gzip6 bodies only within this build and ready cutoff", () => {
  const extra = [
    content("assets/models/home/manifest.json?v=two", manifestBytes),
    content("assets/models/home/flora.glb", Buffer.alloc(400), ready + 1),
    content("/other/assets/models/home/shell.glb"),
    content("https://candidate.example/site/assets/models/home/shell.glb"),
    content("assets/js/home.js"),
  ];
  const result = comparison.firstSceneBudget([...entry, ...extra], base, manifest, ready);
  assert.equal(result.files.length, entry.length);
  assert.equal(
    result.gzip6Bytes,
    entry.reduce((sum, item) => sum + gzipSync(item.body, { level: 6 }).length, 0)
  );
  assert.equal(result.referenceHeadroomBytes, 4 * 1024 * 1024 - result.gzip6Bytes);

  const changed = content("assets/models/home/manifest.json?v=two", Buffer.from("{}"));
  assert.throws(() => comparison.firstSceneBudget([...entry, changed], base, manifest, ready), /Two different served bodies/);
  assert.throws(() => comparison.firstSceneBudget(entry.slice(0, -1), base, manifest, ready), /Missing first-scene response/);
});

test("wrong build pins and incomplete or downscaled frame data cannot report a comparison", () => {
  const expected = createHash("sha256").update(manifestBytes).digest("hex");
  assert.equal(comparison.bindManifest(manifestBytes, expected, "main").sha256, expected);
  assert.throws(() => comparison.bindManifest(manifestBytes, "0".repeat(64), "candidate"), /candidate manifest SHA-256/);
  const valid = {
    canvasAtStart: [2560, 1440],
    canvas: [2560, 1440],
    intervalSamples: 8,
    intervalMs: { median: 25, p95: 39 },
    drawsPerFrame: 180,
  };
  assert.equal(comparison.measuredAt2K(valid, "outside"), valid);
  assert.throws(() => comparison.measuredAt2K({ ...valid, canvas: [2048, 1152] }, "outside"), /did not draw native/);
  assert.throws(() => comparison.measuredAt2K({ ...valid, intervalSamples: 0 }, "outside"), /no valid moving-frame/);
  assert.throws(() => comparison.summarize({ failed: "missing frame" }, {}), /Incomplete measurement/);
});

test("an additional look is named separately and paired views require actual matching photos", () => {
  const viewIds = ["coast-noon", "section-dusk", "lounge-night"];
  const frame = {
    canvasAtStart: [2560, 1440],
    canvas: [2560, 1440],
    intervalSamples: 8,
    intervalMs: { median: 25, p95: 39 },
    drawsPerFrame: 180,
  };
  const side = (name, looks) => ({
    url: "http://" + name,
    renderer: "Native ANGLE",
    chromium: "1",
    ready: { clickToReadyMs: 3200 },
    firstScene: { gzip6Bytes: 64000 },
    views: { "coast-noon": frame, "lounge-night": frame },
    looks,
    pngs: looks.flatMap((look) => viewIds.map((view) => ({ view, look, fov: 40, minute: 720, projection: "perspective", camera: [1, 2, 3] }))),
  });
  const main = side("main", ["realistic"]);
  const candidate = side("candidate", ["realistic", "paint"]);
  assert.deepEqual(comparison.summarize(main, candidate).looks, { paired: ["realistic"], mainOnly: [], candidateOnly: ["paint"] });
  candidate.pngs[0].camera = [10, 2, 3];
  assert.throws(() => comparison.summarize(main, candidate), /Camera mismatch for coast-noon/);
  candidate.pngs.shift();
  assert.throws(() => comparison.summarize(main, candidate), /Missing realistic \/ coast-noon frame/);
});
