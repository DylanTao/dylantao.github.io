import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sourceTools from "./r2-source.cjs";
import { decodeStaticLightArrays } from "../../../../assets/js/home-scene/static-light-cache-codec.mjs";

const cli = sourceTools.argumentsFrom(process.argv.slice(2), "node measure-r2.mjs CHECKOUT FULL_SHA OUTPUT [YYYY-MM-DD] [--room-addend]");
const release = await sourceTools.loadRelease(cli);
const OUT = release.out;
const ROOT = release.pinned;
const moduleUrl = (rel) => pathToFileURL(path.join(ROOT, "assets/js", rel)).href;
const sceneModule = (name) => import(moduleUrl("home-scene/" + name + ".mjs"));
const { Scene } = await import(moduleUrl("three.module.min.js"));
const { normalize, dot, accumulateL1, deringL1, evaluateL1, sphereQuadrature, skyBasis, createTriangleBVH } = await sceneModule("light-trace-core");
const { coastalDaylight, LA_JOLLA } = await sceneModule("daylight");
const { AMBIENT_FILL, apparentDirection, marineLayerAt, moonPosition, skyLighting, weatherOverride } = await sceneModule("atmosphere");
const { rainAt, weatherAt } = await sceneModule("coastal-weather");
const { resolveRoutine } = await sceneModule("routine");
const { createWarmPracticals, practicalSourcesFor } = await sceneModule("warm-practicals");
const { createLightInstallations, roomLightSources } = await sceneModule("light-installations");

const DATE = cli.tail.find((arg) => arg !== "--room-addend") || "2026-11-20";
const signs = ["current-weather", "clear"];
const round = (x, precision = 1e-8) => Math.round(x / precision) * precision;
const luma = (rgb) => dot(rgb, [0.2126, 0.7152, 0.0722]);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const minuteText = (t) => String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
const config = release.manifest;
const snapshot = release.snapshot;
const sampled = JSON.parse(snapshot.configuration);
const active = snapshot.probes.filter((p) => p.valid).length;
const sources = sampled.practicalSources.length + 3;
const quads = sphereQuadrature(Math.sqrt(sampled.raysPerProbe));
const { maxTraceDistance: traceLimit } = sampled;
const warm = createWarmPracticals(new Scene(), undefined, { sources: practicalSourcesFor(config) });
const installations = createLightInstallations(config);
assert.deepEqual(
  [...warm.sources, ...roomLightSources(config)].map((s) => s.id),
  sampled.practicalSources.map((s) => s.id)
);
const sampleTimes = [...new Set([...Array.from({ length: 45 }, (_, i) => 375 + 15 * i), ...Array.from({ length: 20 }, (_, i) => 915 + 5 * i)])].sort(
  (a, b) => a - b
);
const selected = new Set([390, 480, 600, 720, 840, 900, 930, 960, 975, 990, 1000, 1005, 1020]);
const normalTable = [
  ["up", [0, 1, 0]],
  ["down", [0, -1, 0]],
  ["west", [0, 0, -1]],
  ["northwest", [1, 0, -1]],
  ["north", [1, 0, 0]],
  ["northeast", [1, 0, 1]],
  ["east", [0, 0, 1]],
  ["southeast", [-1, 0, 1]],
  ["south", [-1, 0, 0]],
  ["southwest", [-1, 0, -1]],
  ["west-up", [0, 1, -1]],
  ["east-up", [0, 1, 1]],
  ["north-up", [1, 1, 0]],
  ["south-up", [-1, 1, 0]],
].map(([label, direction]) => [label, normalize(direction)]);

const smooth = (a, b, x) => {
  const value = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return value * value * (3 - 2 * value);
};
function getLight(minute, variant) {
  const day = coastalDaylight(DATE, minute);
  const utc = Date.parse(DATE + "T00:00:00Z") + (minute - day.offset * 60) * 60000;
  const wallClock = resolveRoutine(config, new Date(utc));
  assert.equal(wallClock.minute, minute);
  const visit = null;
  warm.update(day.daylight, { ...wallClock, schedule: wallClock.weekend ? config.weekend : config.weekday }, visit);
  installations.update({ minute, daylight: day.daylight, activity: wallClock.id, visit });
  const powers = [...warm.lights.map((light) => light.intensity), ...installations.indirectPowers()];
  assert.equal(powers.length, sources - 3);
  const sun = apparentDirection(day.direction);
  const moon = moonPosition(utc, LA_JOLLA);
  const weather = weatherAt(DATE, minute, { utcMilliseconds: utc });
  if (variant === "clear") Object.assign(weather, weatherOverride("?weather=clear"), { source: "authoring-clear-control" });
  const marine = marineLayerAt(weather, minute);
  const damp = rainAt(weather, minute);
  const overcast = Math.max(smooth(0.62, 1, marine), (weather.cloudCover || 0) * 0.72, damp * 0.95);
  const light = skyLighting({ sun, moon: apparentDirection(moon.direction), moonIllumination: moon.illumination, marine: overcast });
  const solarKey = light.sunLuminance > 0 && light.sunLuminance >= light.moonLuminance;
  return {
    minute,
    time: minuteText(minute),
    altitude: round(day.altitude, 1e-4),
    direction: normalize([sun[0], Math.max(sun[1], 0.03), sun[2]]),
    activity: wallClock.id,
    weather: weather.source,
    marine,
    overcast,
    colors: [light.zenith, light.horizon, light.ground].map((rgb) => rgb.map((v) => v * AMBIENT_FILL)),
    powers,
    solarKey,
    solar: solarKey ? light.sunColor : [0, 0, 0],
  };
}

const collector = JSON.parse(await readFile(path.join(OUT, "COLLECTOR.json"), "utf8"));
assert(collector.ok && collector.revision === release.revision);
assert.equal(collector.signature, snapshot.signature);
assert.equal(collector.sourceManifestSha256, release.manifestHash);
assert.equal(collector.sourceFieldSha256, release.snapshotHash);
const loadFloat = async (record, kind) => {
  const bytes = await readFile(path.join(OUT, record.file));
  assert.equal(sha(bytes), record.sha256, kind);
  assert.equal(bytes.byteLength, record.bytes, kind);
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
};
const started = performance.now();
const positions = await loadFloat(collector.arrays.positions, "positions");
const albedo = await loadFloat(collector.arrays.albedo, "albedo");
const bvh = await createTriangleBVH(positions, albedo);
const acceleratorMs = performance.now() - started;
const arrays = decodeStaticLightArrays(snapshot, snapshot.probes.length * sources * 12, snapshot.probes.length * quads.length * 4);
assert(arrays, "Invalid signed probe arrays");
const { transport: values, moments } = arrays;
let compared = 0,
  primaryHits = 0;
const mismatches = [];
const hits = snapshot.probes.map((probe, p) => {
  if (!probe.valid) return [];
  return quads.flatMap(({ direction, weight }, k) => {
    const hit = bvh.ray(probe.position, direction, traceLimit);
    const cached = moments[(p * quads.length + k) * 4 + 2];
    const actual = Math.fround(hit?.distance ?? traceLimit);
    compared++;
    if (cached !== actual) mismatches.push({ probe: p, ray: k, cached, actual });
    if (!hit) return [];
    primaryHits++;
    const origin = hit.point.map((x, a) => x + hit.normal[a] * 0.002 - direction[a] * 0.002);
    return [{ ...hit, origin, direction, weight }];
  });
});
assert.equal(mismatches.length, 0, JSON.stringify(mismatches.slice(0, 6)));
assert.equal(compared, active * quads.length);
const replayPrimary = bvh.evidence();
const solarRayTotals = { eligible: 0, clear16: 0, clear64: 0, beyond16: 0 };
const traceCache = new Map();
function solarProbeCoefficients(direction) {
  const key = JSON.stringify(direction);
  if (traceCache.has(key)) return traceCache.get(key);
  const rows = hits.map((row) => {
    const unit16 = new Float64Array(12);
    const unit64 = new Float64Array(12);
    for (const hit of row) {
      const cos = Math.max(0, dot(hit.normal, direction));
      if (!cos) continue;
      solarRayTotals.eligible++;
      const visible = !bvh.ray(hit.origin, direction, traceLimit, 0.001, true);
      if (!visible) continue;
      solarRayTotals.clear16++;
      const rgb = Array.from(hit.albedo, (value) => (value * cos) / Math.PI);
      accumulateL1(unit16, 0, rgb, hit.direction, hit.weight);
      if (bvh.ray(hit.origin, direction, 64, traceLimit, true)) {
        solarRayTotals.beyond16++;
        continue;
      }
      solarRayTotals.clear64++;
      accumulateL1(unit64, 0, rgb, hit.direction, hit.weight);
    }
    return { unit16, unit64 };
  });
  traceCache.set(key, rows);
  return rows;
}

function shippedCoefficients(probe, light) {
  const sky = new Float64Array(12);
  const lamps = new Float64Array(12);
  const combined = new Float64Array(12);
  for (let s = 0; s < sources; s++) {
    const sourceStart = (probe * sources + s) * 12;
    if (s < 3) {
      for (let k = 0; k < 12; k++) {
        const value = values[sourceStart + k] * light.colors[s][k % 3];
        sky[k] += value;
        combined[k] += value;
      }
    } else {
      for (let k = 0; k < 12; k++) {
        const value = values[sourceStart + k] * light.powers[s - 3];
        lamps[k] += value;
        combined[k] += value;
      }
    }
  }
  deringL1(sky);
  deringL1(lamps);
  deringL1(combined);
  return { sky, lamps, combined };
}
function openBoundary(light) {
  const coefficients = new Float64Array(12);
  for (const { direction, weight } of quads) {
    const basis = skyBasis(direction);
    const radiance = [0, 1, 2].map((c) => basis.reduce((sum, x, k) => sum + x * light.colors[k][c], 0));
    accumulateL1(coefficients, 0, radiance, direction, weight);
  }
  deringL1(coefficients);
  return luma(evaluateL1(coefficients, [0, 1, 0]));
}
function solarLight(unit, rgb) {
  const scaled = unit.map((value, i) => value * rgb[i % 3]);
  deringL1(scaled);
  return scaled;
}
const numerator = (coeff, normal) => luma(evaluateL1(coeff, normal));
const enough = (row) => row.ratio16 !== null;
const quantile = (values, p) => {
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  return values[Math.ceil(p * values.length) - 1] ?? values[0];
};
const maxBy = (rows, field) => rows.reduce((best, row) => (best === null || row[field] > best[field] ? row : best), null);
const concise = (row) =>
  row && {
    time: row.time,
    probe: row.probe,
    position: row.position,
    normal: row.normal,
    solar16: round(row.solar16),
    solar64: round(row.solar64),
    skyPractical: round(row.base),
    sky: round(row.sky),
    practical: round(row.practical),
    openSky: round(row.open),
    solarFractionOfOpenSky: row.open ? round(row.solar16 / row.open, 1e-6) : null,
    ratio16: row.ratio16 === null ? null : round(row.ratio16, 1e-6),
    ratio64: row.ratio64 === null ? null : round(row.ratio64, 1e-6),
  };
function summary(rows) {
  const included = rows.filter(enough);
  return {
    samples: rows.length,
    numeratorNonzero: rows.filter((r) => r.solar16 > 1e-12).length,
    included: included.length,
    baseTooLow: rows.length - included.length,
    p50Ratio: quantile(
      included.map((r) => r.ratio16),
      0.5
    ),
    p95Ratio: quantile(
      included.map((r) => r.ratio16),
      0.95
    ),
    p95Ratio64: quantile(
      included.map((r) => r.ratio64),
      0.95
    ),
    p95Solar: quantile(
      rows.map((r) => r.solar16),
      0.95
    ),
    brightestSolar: concise(maxBy(rows, "solar16")),
    highestRatio: concise(maxBy(included, "ratio16")),
    highestRatio64: concise(maxBy(included, "ratio64")),
    maxAbsoluteDistanceEffect: round(Math.max(...rows.map((r) => r.solar16 - r.solar64), 0)),
  };
}

const dayReports = {};
for (const variant of signs) {
  const byRegion = sampled.regions.map(() => []);
  const selectedRows = [];
  for (const minute of sampleTimes) {
    const env = getLight(minute, variant);
    const open = openBoundary(env);
    const floor = Math.max(0.001, open * 0.01);
    const now = sampled.regions.map(() => []);
    const solar = env.solarKey ? solarProbeCoefficients(env.direction) : null;
    for (const [probe, meta] of snapshot.probes.entries()) {
      if (!meta.valid) continue;
      const region = Math.floor(probe / 8);
      const baseline = shippedCoefficients(probe, env);
      const incoming16 = solar ? solarLight(solar[probe].unit16, env.solar) : null;
      const incoming64 = solar ? solarLight(solar[probe].unit64, env.solar) : null;
      for (const [normal, direction] of normalTable) {
        const base = numerator(baseline.combined, direction);
        const sky = numerator(baseline.sky, direction);
        const practical = numerator(baseline.lamps, direction);
        const solar16 = incoming16 ? numerator(incoming16, direction) : 0;
        const solar64 = incoming64 ? numerator(incoming64, direction) : 0;
        const ratio16 = base >= floor ? solar16 / base : null;
        const ratio64 = base >= floor ? solar64 / base : null;
        const row = { time: env.time, probe, position: meta.position, normal, base, sky, practical, solar16, solar64, ratio16, ratio64, open };
        now[region].push(row);
        byRegion[region].push(row);
      }
    }
    if (selected.has(minute))
      selectedRows.push({
        time: env.time,
        altitude: env.altitude,
        direction: env.direction,
        weather: env.weather,
        activity: env.activity,
        overcast: env.overcast,
        key: env.solarKey,
        solarIlluminance: env.solar,
        exteriorSky: open,
        ratioFloor: floor,
        rooms: Object.fromEntries(now.map((rows, i) => [sampled.regions[i].id, summary(rows)])),
      });
  }
  dayReports[variant] = {
    selectedRows,
    regions: sampled.regions.map((r, i) => ({
      name: r.id,
      overall: summary(byRegion[i]),
      horizontal: summary(byRegion[i].filter((x) => x.normal === "up")),
      west: summary(byRegion[i].filter((x) => x.normal === "west")),
    })),
  };
}

function refine({ name, baseline, target }) {
  const [hour, minute] = target.time.split(":").map(Number);
  const env = getLight(hour * 60 + minute, "current-weather");
  const normal = normalTable.find(([label]) => label === target.normal)[1];
  const position = snapshot.probes[target.probe].position;
  const settings = [];
  for (const side of [8, 12, 16]) {
    const sh16 = new Float64Array(12);
    const sh64 = new Float64Array(12);
    let primaryHits = 0,
      visible16 = 0,
      visible64 = 0;
    for (const { direction, weight } of sphereQuadrature(side)) {
      const hit = bvh.ray(position, direction, traceLimit);
      if (!hit) continue;
      primaryHits++;
      const cosine = Math.max(0, dot(hit.normal, env.direction));
      if (!cosine) continue;
      const origin = hit.point.map((n, a) => n + 0.002 * hit.normal[a] - 0.002 * direction[a]);
      if (bvh.ray(origin, env.direction, traceLimit, 0.001, true)) continue;
      visible16++;
      const reflected = Array.from(hit.albedo, (n) => (n * cosine) / Math.PI);
      accumulateL1(sh16, 0, reflected, direction, weight);
      if (bvh.ray(origin, env.direction, 64, traceLimit, true)) continue;
      visible64++;
      accumulateL1(sh64, 0, reflected, direction, weight);
    }
    const solar16 = numerator(solarLight(sh16, env.solar), normal);
    const solar64 = numerator(solarLight(sh64, env.solar), normal);
    if (side === 8) {
      assert(Math.abs(solar16 - target.solar16) < 1e-8);
      assert(Math.abs(solar64 - target.solar64) < 1e-8);
    }
    settings.push({ primaryRays: side * side, primaryHits, visible16, visible64, solar16: round(solar16), solar64: round(solar64) });
  }
  return { name, time: target.time, normal: target.normal, probe: target.probe, position, baseline, settings };
}
const convergence = ["study", "sleep", "onsen", "living", "lounge", "gym"].map((name) => {
  const room = dayReports["current-weather"].regions.find((region) => region.name === name);
  const target = (name === "gym" ? room.horizontal : room.overall).brightestSolar;
  return refine({ name, target, baseline: target.skyPractical });
});

async function writeRoomAddends() {
  // These four standing poses reproduce the November 20 comparison, including
  // the upper bath's actual landing height. Each camera was collision-admitted.
  const shots = [
    { id: "lounge", room: "lounge", time: "14:15", body: [2.09, 0.002618, 4.44], aim: [2.55, 0.77, 6.6], fov: 49 },
    { id: "living", room: "lounge", time: "14:45", body: [0.64, 0.002618, 4.44], aim: [-0.4, 0.9, 6.6], fov: 49 },
    { id: "gym", room: "gym", time: "15:30", body: [9.31, 0.01793, 4.16], aim: [7.85, 1.2, 6.85], fov: 53 },
    { id: "onsen", room: "onsen", time: "16:15", body: [2.215, 2.602397, 9.847], aim: [3.12, 3.22, 10.75], fov: 49 },
  ];
  const shadowLimitMetres = 64;
  const quadrature = sphereQuadrature(16);
  const cases = shots.map((shot) => {
    const [hour, offset] = shot.time.split(":").map(Number);
    const minute = 60 * hour + offset;
    const env = getLight(minute, "current-weather");
    assert(env.solarKey, "The comparison uses the daytime solar key");
    const eye = [shot.body[0], shot.body[1] + 1.6, shot.body[2]];
    const forward = normalize(shot.aim.map((value, i) => value - eye[i]));
    const yaw = Math.atan2(forward[0], forward[2]);
    const pitch = Math.atan2(forward[1], Math.hypot(forward[0], forward[2]));
    const values = new Float64Array(snapshot.probes.length * 12);
    for (const [index, probe] of snapshot.probes.entries()) {
      if (!probe.valid) continue;
      for (const { direction, weight } of quadrature) {
        const hit = bvh.ray(probe.position, direction, traceLimit);
        if (!hit) continue;
        const cosine = dot(hit.normal, env.direction);
        if (cosine <= 0) continue;
        const origin = hit.point.map((value, axis) => value + 0.002 * hit.normal[axis] - 0.002 * direction[axis]);
        if (bvh.ray(origin, env.direction, shadowLimitMetres, 0.001, true)) continue;
        const radiance = Array.from(hit.albedo, (value, channel) => (value * cosine * env.solar[channel]) / Math.PI);
        accumulateL1(values, index * 12, radiance, direction, weight);
      }
      deringL1(values, index * 12);
    }
    assert(values.every(Number.isFinite));
    const packed = Buffer.alloc(values.byteLength);
    for (const [i, value] of values.entries()) packed.writeDoubleLE(value, i * 8);
    return {
      ...shot,
      eye,
      yaw,
      pitch,
      minute,
      sun: { direction: env.direction, sunColor: env.solar },
      coefficients: {
        layout: "probe-major DC, X, Y, Z × RGB Float64 little endian",
        count: values.length,
        sha256: sha(packed),
        base64: packed.toString("base64"),
      },
    };
  });
  const result = {
    revision: release.revision,
    signature: snapshot.signature,
    cache: release.snapshotHash,
    date: DATE,
    arrays: collector.arrays,
    primaryRays: quadrature.length,
    primaryLimitMetres: traceLimit,
    shadowLimitMetres,
    cases,
  };
  await writeFile(path.join(OUT, "R2-DELTAS.json"), JSON.stringify(result, null, 2) + "\n");
}

const receipt = {
  source: collector.revision,
  signature: snapshot.signature,
  cache: release.snapshotHash,
  arrays: collector.arrays,
  geometry: collector.collector.statistics,
  acceleratorMs,
  day: DATE,
  timeZone: LA_JOLLA.timeZone,
  sampledTimes: sampleTimes.map(minuteText),
  denominator:
    "Current shipped SH sky+ground plus indirect practical irradiance of the same probe and surface normal, using actual CPU atmosphere and scheduled lamp powers in Realistic. Does not include direct sun, native direct lamps or specular.",
  ratioFloor:
    "Baked denominator >= max(0.001, 1% of the same time's unoccluded horizontal sky irradiance). Absolute solar is reported without this floor.",
  primaryScope:
    "Opaque current collector footprint and albedo; 64 canonical deterministic quadrature rays at each accepted probe. Exact directional visibility at the shaded hit uses current astronomical/refraction + native key brightness and bias, with no angular interpolation.",
  distanceSensitivity:
    "64m secondary shadow uses the same extracted footprint already clipped to the production ROI. It estimates sensitivity to the canonical 16m cutoff inside this footprint only.",
  normalizedLinearUnits:
    "Rec.709 linear luminance of diffuse irradiance evaluated from the runtime L1 basis, before material response and exposure. Solar, sky, and lamps reported individually are deringed separately.",
  limitations: [
    "No current transport cage named speakeasy, and no added probes there.",
    "The unchanged scene contains solid captured geometry; transparent material passage, noncaptured distant geometry and dynamic poses are outside the measurement.",
    "The actual luminance on scene materials depends on surface albedo, final shader and exposure.",
  ],
  probes: {
    total: snapshot.probes.length,
    active,
    invalid: snapshot.probes.flatMap((probe, p) =>
      probe.valid ? [] : [{ probe: p, room: sampled.regions[Math.floor(p / 8)].id, position: probe.position }]
    ),
    compared,
    primaryHits,
    firstHitDistancesExact: mismatches.length === 0,
  },
  normals: normalTable,
  solarRayTotals,
  replayPrimary,
  finalTrace: bvh.evidence(),
  dayReports,
  convergence,
  elapsedMs: performance.now() - started,
};
await writeFile(path.join(OUT, "R2-RESULT.json"), JSON.stringify(receipt, null, 2) + "\n");
if (cli.tail.includes("--room-addend")) await writeRoomAddends();
console.log(
  JSON.stringify(
    {
      source: receipt.source,
      shot: receipt.day,
      active,
      compared,
      primaryHits,
      acceleratorMs,
      elapsedMs: receipt.elapsedMs,
      rooms: Object.fromEntries(
        signs.map((variant) => [
          variant,
          dayReports[variant].regions.map(({ name, overall }) => ({
            name,
            p95: overall.p95Ratio,
            max: overall.highestRatio,
            absolute: overall.brightestSolar,
          })),
        ])
      ),
    },
    null,
    2
  )
);
