import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sourceTools from "./r2-source.cjs";
import { decodeStaticLightArrays } from "../../../../assets/js/home-scene/static-light-cache-codec.mjs";
import { decodeLoungeSolar } from "../../../../assets/js/home-scene/deferred/lounge-solar.mjs";
import { angleUnit as DEG, createLoungeTracer, probeRays, sampleLoungeLattice, shadowMetres } from "../../../../bin/coastal_lounge_solar_bake.mjs";
import geometryProof from "../../../../bin/coastal_lounge_solar_geometry.cjs";

const cli = sourceTools.argumentsFrom(process.argv.slice(2), "node build-lounge-solar.mjs CHECKOUT FULL_SHA OUTPUT");
const release = await sourceTools.loadRelease(cli);
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const extraction = await readJson(path.join(cli.out, "COLLECTOR.json"));
assert(extraction.ok, "Run collect-r2.cjs for this release first");
assert.equal(extraction.revision, release.revision);
assert.equal(extraction.signature, release.signature);
assert.equal(extraction.sourceFieldSha256, release.snapshotHash);
assert.equal(extraction.sourceManifestSha256, release.manifestHash);
const cfg = JSON.parse(release.snapshot.configuration);
assert.equal(extraction.collector.configuration, release.snapshot.configuration);
const fieldStats = release.snapshot.statistics;
for (const key of ["triangles", "sourceTriangles", "skippedTriangles", "allocatedTriangles", "meshes"]) {
  assert.equal(extraction.collector.statistics[key], fieldStats[key]);
}

const moduleFor = (name) => import(pathToFileURL(path.join(release.pinned, "assets/js/home-scene", name + ".mjs")).href);
const { evaluateL1, sphereQuadrature, createTriangleBVH, dot, normalize } = await moduleFor("light-trace-core");
const { coastalDaylight, LA_JOLLA } = await moduleFor("daylight");
const { apparentDirection, marineLayerAt, moonPosition, skyLighting, weatherOverride } = await moduleFor("atmosphere");
const { weatherAt, rainAt } = await moduleFor("coastal-weather");

const { firstProbe, probes, maxTraceDistance } = geometryProof.loungeProbeInput(release.snapshot);
const readFloat32 = async ({ file, bytes, sha256 }) => {
  const data = await readFile(path.join(cli.out, file));
  assert.equal(data.byteLength, bytes);
  assert.equal(sourceTools.sha(data), sha256);
  return new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
};
const positions = await readFloat32(extraction.arrays.positions);
const albedo = await readFloat32(extraction.arrays.albedo);
const bvh = await createTriangleBVH(positions, albedo);
const basis = sphereQuadrature(Math.sqrt(cfg.raysPerProbe));
const count = release.snapshot.probes.length;
const arrays = decodeStaticLightArrays(release.snapshot, count * (cfg.practicalSources.length + 3) * 12, count * basis.length * 4);
assert(arrays, "Invalid signed probe arrays");
const { moments } = arrays;
for (const [p, { position, valid }] of probes.entries()) {
  if (!valid) continue;
  for (const [k, { direction }] of basis.entries()) {
    const distance = bvh.ray(position, direction, cfg.maxTraceDistance)?.distance ?? cfg.maxTraceDistance;
    assert.equal(Math.fround(distance), moments[((firstProbe + p) * basis.length + k) * 4 + 2]);
  }
}

const triangleFingerprint = await geometryProof.fingerprintLoungeTriangles(positions, albedo);
const geometryFingerprint = geometryProof.loungeGeometryFingerprint(release.snapshot, triangleFingerprint);
const trace = createLoungeTracer(bvh, probes, maxTraceDistance);
const rotatedTrace = createLoungeTracer(bvh, probes, maxTraceDistance, 7 * DEG);
const asset = sampleLoungeLattice(trace, geometryFingerprint);
const { azimuth, elevation, azimuthStep, elevationStep, width, height, scale } = asset;
const sampler = decodeLoungeSolar(asset, geometryFingerprint);
const serialized = JSON.stringify(asset) + "\n";

const normalTable = [
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, -1],
  [1, 0, -1],
  [1, 0, 0],
  [1, 0, 1],
  [0, 0, 1],
  [-1, 0, 1],
  [-1, 0, 0],
  [-1, 0, -1],
  [0, 1, -1],
  [0, 1, 1],
  [1, 1, 0],
  [-1, 1, 0],
].map(normalize);
const irradiance = (coefficients) =>
  probes.flatMap((_, probe) => normalTable.map((n) => dot([0.2126, 0.7152, 0.0722], evaluateL1(coefficients, n, probe * 12))));
function sceneSun(date, minute, clear = false) {
  const stage = coastalDaylight(date, minute);
  const utc = Date.parse(date + "T00:00:00Z") + (minute - stage.offset * 60) * 60000;
  const sun = apparentDirection(stage.direction);
  const moon = moonPosition(utc, LA_JOLLA);
  const weather = weatherAt(date, minute, { utcMilliseconds: utc });
  if (clear) Object.assign(weather, weatherOverride("?weather=clear"));
  const marine = marineLayerAt(weather, minute);
  const f = Math.max(0, Math.min(1, (marine - 0.62) / (1 - 0.62)));
  const overcast = Math.max(f * f * (3 - 2 * f), (weather.cloudCover || 0) * 0.72, rainAt(weather, minute) * 0.95);
  const light = skyLighting({ sun, moon: apparentDirection(moon.direction), moonIllumination: moon.illumination, marine: overcast });
  const direction = normalize([sun[0], Math.max(sun[1], 0.03), sun[2]]);
  return {
    source: weather.source,
    overcast,
    direction,
    geometricAltitude: stage.altitude,
    sunlight: stage.altitude > 0 && light.sunLuminance >= light.moonLuminance ? light.sunColor : null,
  };
}
const dates = [
  "2026-01-16",
  "2026-02-11",
  "2026-03-20",
  "2026-04-22",
  "2026-05-14",
  "2026-06-21",
  "2026-07-13",
  "2026-08-28",
  "2026-09-23",
  "2026-10-17",
  "2026-11-20",
  "2026-12-21",
];
const held = [];
let zeroNights = 0;
for (const date of dates)
  for (let minute = 368; minute <= 1160; minute += 17) {
    const sun = sceneSun(date, minute);
    if (!sun.sunlight) {
      assert.equal(sampler(null), null);
      zeroNights++;
      continue;
    }
    const a = Math.atan2(sun.direction[2], sun.direction[0]) / DEG / azimuthStep;
    const e = Math.asin(sun.direction[1]) / DEG / elevationStep;
    assert(Math.abs(a - Math.round(a)) > 1e-7 || Math.abs(e - Math.round(e)) > 1e-7, "Held-out direction lies on a training node");
    held.push({
      date,
      minute,
      ...sun,
      reference: irradiance(trace(sun.direction, sun.sunlight)),
      differentRays: irradiance(rotatedTrace(sun.direction, sun.sunlight)),
      candidate: irradiance(sampler([sun.direction, sun.sunlight])),
    });
  }
function metrics(rows, field) {
  let total = 0,
    referenceTotal = 0,
    referencePeak = 0,
    missedLight = 0,
    falseLight = 0,
    signed = 0;
  const errors = [];
  for (const row of rows)
    for (const [i, reference] of row.reference.entries()) {
      const value = row[field][i],
        error = Math.abs(reference - value);
      errors.push(error);
      total += error;
      signed += value - reference;
      referenceTotal += reference;
      referencePeak = Math.max(referencePeak, reference);
      if (value > 0.025 && reference <= 0.005) falseLight++;
      if (reference > 0.025 && value <= 0.005) missedLight++;
    }
  errors.sort((a, b) => a - b);
  return {
    directions: rows.length,
    observations: errors.length,
    referencePeak,
    absoluteMean: total / errors.length,
    bias: signed / errors.length,
    relativeL1: total / referenceTotal,
    p95: errors[Math.ceil(errors.length * 0.95) - 1],
    p99: errors[Math.ceil(errors.length * 0.99) - 1],
    max: errors.at(-1),
    falseLight,
    missedLight,
  };
}
const preview = [540, 720, 810, 855, 865, 900, 955, 1000, 1260].flatMap((minute) =>
  [false, true].map((clear) => {
    const sun = sceneSun("2026-11-20", minute, clear);
    const direct = sun.sunlight;
    const reference = direct ? irradiance(trace(sun.direction, direct)) : [];
    const prediction = direct ? irradiance(sampler([sun.direction, direct])) : [];
    return {
      minute,
      weather: clear ? "clear study" : sun.source,
      direct,
      direction: sun.direction,
      overcast: sun.overcast,
      referencePeak: Math.max(0, ...reference),
      candidatePeak: Math.max(0, ...prediction),
    };
  })
);
const output = {
  source: release.revision,
  signature: release.signature,
  snapshot: release.snapshotHash,
  arrays: extraction.arrays,
  triangles: bvh.count,
  triangleFingerprint,
  geometryFingerprint,
  primaryMetres: maxTraceDistance,
  shadowMetres,
  probes: probes.map(({ position }) => position),
  canonicalDistancesChecked: probes.filter(({ valid }) => valid).length * basis.length,
  primaryRaysPerProbe: probeRays,
  fieldOfView: { azimuth, elevation, azimuthStep, elevationStep, width, height, scale },
  transfer: { raw: Buffer.byteLength(serialized), gzip6: gzipSync(serialized, { level: 6 }).byteLength, sha256: sourceTools.sha(serialized) },
  heldOut: metrics(held, "candidate"),
  rotated256Comparison: metrics(held, "differentRays"),
  zeroNights,
  seasons: dates.map((date) => ({
    date,
    ...metrics(
      held.filter((row) => row.date === date),
      "candidate"
    ),
  })),
  preview,
};
await writeFile(path.join(cli.out, "lounge-solar.json"), serialized);
await writeFile(path.join(cli.out, "LOUNGE-SOLAR-RECEIPT.json"), JSON.stringify(output, null, 2) + "\n");
console.log(
  JSON.stringify({ transfer: output.transfer, heldOut: output.heldOut, zeroNights, rendererProbeBounds: cfg.regions[firstProbe / 8] }, null, 2)
);
