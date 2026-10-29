import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  DEPTH_LAYOUT,
  DEGREE,
  HILLS_Z,
  HORIZON_Y,
  createDepthGeometry,
  decodeDepthField,
  depthStageAnchor,
  depthStagePoint,
} from "../assets/js/footer-coast/sky.mjs";
import { skylineAt } from "../assets/js/footer-coast/skyline.mjs";

const { PNG } = createRequire(import.meta.url)("pngjs");
const asset = new URL("../assets/models/la-jolla/hills.png", import.meta.url);
const png = PNG.sync.read(readFileSync(asset));
const field = () => decodeDepthField(png);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("the packed ground retains the original measured angular pixels and exact source bindings", () => {
  assert.equal(png.width, DEPTH_LAYOUT.width);
  assert.equal(png.height, DEPTH_LAYOUT.rows);
  const angular = Buffer.alloc(929 * 147 * 3);
  for (let i = 0; i < 929 * 147; i++) png.data.copy(angular, i * 3, i * 4, i * 4 + 3);
  assert.equal(hash(angular), "417e10a3934d88331e00b1f0e7e2eca113f5320dc65288ef956b66cb82fca20f");
  const provenance = JSON.parse(readFileSync(new URL("../artwork/la-jolla/skyline/provenance.json", import.meta.url)));
  const detail = provenance.ground.depth_relief;
  assert.equal(detail.angular_rgb_sha256, hash(angular));
  assert.equal(detail.png_sha256, hash(readFileSync(asset)));
  assert.equal(detail.schema, "sirui-coastal-depth-v1");
  for (const [path, expected] of Object.entries(detail.stage_projection.source_bindings)) {
    const raw = readFileSync(new URL(`../${path}`, import.meta.url));
    const bytes = path.endsWith(".glb") ? raw : Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n"));
    assert.equal(hash(bytes), expected, path);
  }
});

test("source depth joins its native datum and holds the measured crest in the reference camera", () => {
  const f = field(),
    { geometry, evidence } = createDepthGeometry(f),
    positions = geometry.getAttribute("position");
  let checked = 0,
    crestError = 0,
    edgeError = 0;
  for (let c = 0; c < 465; c++) {
    const bearing = c * 0.5,
      anchor = depthStageAnchor(f, bearing);
    if (anchor.scale <= 0) continue;
    checked++;
    const first = c * 81,
      last = first + 80;
    edgeError = Math.max(edgeError, Math.abs(positions.getY(first) - anchor.y0), Math.abs(positions.getZ(first) - anchor.z0));
    const angle = (positions.getY(last) - (positions.getZ(last) - HILLS_Z) / anchor.cot - HORIZON_Y) / DEGREE;
    crestError = Math.max(crestError, Math.abs(angle - skylineAt(bearing).far));
  }
  assert.ok(checked > 350);
  assert.ok(edgeError < 1e-5, `Encoded native seam: ${edgeError} stage units`);
  assert.ok(crestError < 1e-4, `Float32 crest projection: ${crestError} degrees`);
  assert.ok(evidence.triangles > 50000 && evidence.triangles < 75000);
  assert.ok(evidence.bufferBytes < 1800000);
  geometry.dispose();
});

test("one isotropic scale preserves the measured radial slope rather than inventing an apron", () => {
  const f = field();
  for (const bearing of [60, 104, 161.5, 198.4]) {
    const a = depthStageAnchor(f, bearing);
    assert.ok(a.scale > 0);
    const shore = depthStagePoint(f, bearing, a.d0, a.h0),
      crest = depthStagePoint(f, bearing, a.d1, a.h1);
    assert.ok(Math.abs((crest.y - shore.y) / (shore.z - crest.z) - (a.h1 - a.h0) / (a.d1 - a.d0)) < 1e-9);
    assert.equal(shore.x, crest.x);
    assert.ok(crest.z < shore.z);
  }
});

test("every drawn ground vertex has positive source support and a real native stage anchor", () => {
  const f = field(),
    { geometry } = createDepthGeometry(f),
    sources = geometry.getAttribute("aSource");
  for (const index of geometry.index.array) {
    assert.ok(sources.getZ(index) > 0, "A sea or no-data sample cannot become a ground triangle");
    assert.ok(depthStageAnchor(f, sources.getX(index)).scale > 0);
  }
  for (const attribute of [geometry.getAttribute("position"), sources, geometry.getAttribute("aDataUv")]) {
    for (const number of attribute.array) assert.ok(Number.isFinite(number));
  }
  geometry.dispose();
});

test("a legacy or incomplete image does not masquerade as the new source field", () => {
  assert.equal(decodeDepthField({ width: 929, height: 147, data: new Uint8Array(929 * 147 * 4) }), null);
  assert.equal(decodeDepthField({ width: 929, height: 235, data: new Uint8Array(3) }), null);
});
