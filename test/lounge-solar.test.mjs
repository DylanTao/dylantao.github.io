import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { decodeLoungeSolar } from "../assets/js/home-scene/deferred/lounge-solar.mjs";
import { createStaticLightField } from "../assets/js/home-scene/static-light-field.mjs";
import geometryProof from "../bin/coastal_lounge_solar_geometry.cjs";

const root = new URL("../assets/models/home/", import.meta.url);
const readJSON = async (file) => JSON.parse(await readFile(new URL(file, root)));
const direct = [
  [-0.6724224491395326, 0.4257624415746385, -0.6054538737489383],
  [2.6819888759314385, 2.127657189160524, 1.4556483293915716],
];
const lounge = [2.93, 0.57, 5.24];
const living = [0.3, 1, 6.5];
const outside = [2.93, 1.1, 2];
const normal = [1, 0, 0];

test("the optional lounge data is bound to its measured geometry", async () => {
  const body = await readFile(new URL("lounge-solar.json", root));
  const record = JSON.parse(body);
  const sampler = decodeLoungeSolar(record, record.geometryFingerprint);
  const { staticLightFieldCache: descriptor } = await readJSON("manifest.json");
  if (descriptor.loungeSolar) {
    assert.equal(descriptor.loungeSolar, "lounge-solar.json");
    assert.equal(descriptor.loungeSolarGeometry, record.geometryFingerprint);
    assert.equal((await readJSON("static-light-field.json")).loungeSolarGeometry, record.geometryFingerprint);
    assert.equal(descriptor.loungeSolarSha256, createHash("sha256").update(body).digest("hex"));
  }
  assert.throws(() => decodeLoungeSolar(record, "obsolete"), /obsolete/);
  assert.throws(() => decodeLoungeSolar({ ...record, data: record.data.slice(4) }, record.geometryFingerprint), /obsolete/);
  assert.equal(sampler(null), null);
  assert(
    sampler([
      [1, 0, 0],
      [1, 1, 1],
    ]).every((v) => v === 0),
    "outside the solar angular lattice"
  );
  const unitEnergy = Array.from(sampler([direct[0], [1, 1, 1]]));
  const reducedEnergy = sampler([direct[0], [0.2, 0.2, 0.2]]);
  assert(unitEnergy.some((v) => v > 0));
  assert(reducedEnergy.every((v, i) => Math.abs(v - unitEnergy[i] * 0.2) < 1e-12));
});

test("lounge reflection preserves exposure, other room samples, stored light and night", async () => {
  const record = await readJSON("lounge-solar.json"),
    snapshot = await readJSON("static-light-field.json");
  const config = JSON.parse(snapshot.configuration);
  const otherRooms = snapshot.probes.filter((p, i) => p.valid && !["lounge", "nearhouse"].includes(config.regions[i >> 3].id));
  const beforeRoomSamples = (sample) => otherRooms.map(({ position }) => sample(position));
  const field = createStaticLightField(config);
  try {
    assert(field.restoreSnapshot(snapshot, { signature: snapshot.signature }));
    const illumination = {
      zenith: [0.065, 0.08, 0.09],
      horizon: [0.1, 0.1, 0.1],
      ground: [0.04, 0.032, 0.024],
      practicalPowers: config.practicalSources.map(() => 1),
      sun: direct,
    };
    const sample = (point) => field.sample(point, normal);
    field.setLighting(illumination);
    const before = [sample(lounge), sample(living), sample(outside)],
      meter = field.ambientAt(lounge);
    const fixed = beforeRoomSamples(sample);
    const saved = field.exportSnapshot({ signature: snapshot.signature });
    assert(field.setLoungeSolar(decodeLoungeSolar(record, record.geometryFingerprint)));
    assert(sample(lounge).irradiance.every((channel, i) => channel > before[0].irradiance[i]));
    assert.deepEqual([sample(living), sample(outside)], before.slice(1));
    assert.deepEqual(beforeRoomSamples(sample), fixed);
    assert.deepEqual(field.ambientAt(lounge), meter);
    assert.deepEqual(field.exportSnapshot({ signature: snapshot.signature }), saved);
    field.setLighting({ ...illumination, sun: null });
    assert.deepEqual([sample(lounge), sample(living), sample(outside)], before);
  } finally {
    field.dispose();
  }
});

test("triangle geometry binding preserves actual triangle/color pairs across collection order", async () => {
  const a = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  const b = [0, 0, 1, 1, 0, 1, 0, 1, 1];
  const oak = [0.6, 0.4, 0.2],
    stone = [0.45, 0.45, 0.45];
  const hash = (vertices, colors) => geometryProof.fingerprintLoungeTriangles(Float32Array.from(vertices), Float32Array.from(colors));
  const initial = await hash([...a, ...b], [...oak, ...stone]);
  assert.equal(await hash([...b, ...a], [...stone, ...oak]), initial);
  assert.notEqual(await hash([...b, ...a], [...oak, ...stone]), initial);
  assert.notEqual(await hash([...a, ...b, ...a], [...oak, ...stone, ...oak]), initial);
  const snapshot = await readJSON("static-light-field.json");
  const key = geometryProof.loungeGeometryFingerprint(snapshot, initial);
  const original = geometryProof.loungeProbeInput(snapshot);
  snapshot.probes[original.firstProbe].position[0] += 0.01;
  assert.notEqual(geometryProof.loungeGeometryFingerprint(snapshot, initial), key);
});
