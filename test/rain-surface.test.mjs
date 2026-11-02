import test from "node:test";
import assert from "node:assert/strict";
import { createRainSurface } from "../assets/js/home-scene/rain-surface.mjs";
import {
  rainPacket,
  sampleRainPacket,
  createRainForcing,
  equilibriumRainVariance,
  RAIN_RIPPLES,
} from "../assets/js/home-scene/rain-surface-spectrum.mjs";

const event = (index = 0) => ({ index, seconds: 1, position: [0, -7.35, -20], relativeSpeed: 4, diameter: 0.001 });

test("rain packets have distinct gravity-capillary phase/group speeds and finite bounded slopes", () => {
  const p = rainPacket(event(3));
  assert.ok(p.amplitude > 0 && p.amplitude < RAIN_RIPPLES.maximumAmplitude);
  assert.ok(p.incomingEnergy > 0 && p.incomingEnergy < 0.00001);
  assert.ok(p.group > 0.1 && p.group < 0.5);
  assert.ok(Math.abs(p.group - p.omega / p.k) > 0.001);
  for (const bad of [
    null,
    {},
    { ...event(), position: [] },
    { ...event(), position: [0, NaN, 0] },
    { ...event(), index: NaN },
    { ...event(), relativeSpeed: Infinity },
    { ...event(), diameter: -0.001 },
  ])
    assert.equal(rainPacket(bad), null);
  assert.deepEqual(sampleRainPacket(p, p.x, p.z, p.born), [0, 0, 0]);
  assert.deepEqual(sampleRainPacket(p, p.x, p.z, p.born + RAIN_RIPPLES.lifetime), [0, 0, 0]);
  let resolved = 0,
    unresolved = 0;
  for (let j = 1; j < 100; j++)
    for (let i = 0; i < 100; i++) {
      const near = sampleRainPacket(p, p.x + i * 0.004, p.z, p.born + j / 100);
      const far = sampleRainPacket(p, p.x + i * 0.004, p.z, p.born + j / 100, 0.05);
      assert.ok([...near, ...far].every(Number.isFinite));
      assert.ok(near[2] >= 0 && far[2] >= 0);
      resolved = Math.max(resolved, Math.hypot(...near.slice(0, 2)));
      unresolved = Math.max(unresolved, far[2]);
    }
  assert.ok(resolved > 0.001 && resolved < 0.1);
  assert.ok(unresolved > 0);
});

test("packed Float32 spatial bins retain actual event IDs through pause and camera movement", () => {
  const field = createRainSurface();
  for (let i = 0; i < 200; i++)
    assert.ok(field.impact({ ...event(i), seconds: 1 + i * 0.004, position: [(i % 20) * 1.45 - 14, -7.35, Math.floor(i / 20) * 2.7 - 13] }));
  assert.equal(field.update(1.9), true);
  assert.equal(field.evidence().active, 200);
  assert.equal(field.evidence().binOverflow, 0);
  assert.equal(field.evidence().textureBytes, 73728);
  for (let id = 1; id <= 200; id++) assert.ok(field.candidates(field.events[id * 4], field.events[id * 4 + 1]).includes(id));
  const before = field.events.slice(),
    bins = field.bins.slice();
  assert.equal(field.update(1.9), false);
  assert.deepEqual(field.events, before);
  assert.deepEqual(field.bins, bins);
  assert.equal(field.update(1.9, [3, 0, -2]), true);
  assert.deepEqual(field.events, before);
  for (let id = 1; id <= 200; id++) assert.ok(field.candidates(field.events[id * 4], field.events[id * 4 + 1]).includes(id));
  assert.equal(field.update(4, [3, 0, -2]), true);
  assert.equal(field.evidence().active, 0);
  assert.equal(field.evidence().coarseVariance, 0);
  assert.equal(field.update(5, [3, 0, -2]), false, "dry frames do not upload two empty textures repeatedly");
  for (const ids of [
    [255, 255, 255],
    [1, 128, 254],
    [31, 23, 245],
  ]) {
    const value = new Float32Array([ids[0] + ids[1] * 256 + ids[2] * 65536])[0];
    for (let i = 0; i < 3; i++) assert.equal((Math.trunc(value) >>> (i * 8)) & 255, ids[i]);
  }
});

test("compact histories and crowded bins stay bounded; backward seeks clear stale contacts", () => {
  const field = createRainSurface({ compact: true });
  for (let i = 0; i < 100; i++) field.impact({ ...event(i), seconds: 1 + i * 0.001 });
  field.update(1.2);
  assert.equal(field.evidence().active, 63);
  assert.equal(field.evidence().evicted, 37);
  assert.equal(field.evidence().textureBytes, 24576);
  assert.ok(field.evidence().binOverflow > 0);
  assert.equal(field.candidates(0, -20).length, 12);
  field.update(0.5);
  assert.equal(field.evidence().active, 0);
  assert.ok([...field.events, ...field.bins].every((value) => value === 0));
  assert.equal(field.evidence().extraPasses, 0);
  assert.equal(field.evidence().animalWakeSlotsUsed, 0);
  assert.throws(() => field.update(NaN), RangeError);
  assert.throws(() => field.update(1, []), RangeError);
});

test("unresolved shower energy is monotone, finite and independent of displayed drop count", () => {
  assert.equal(equilibriumRainVariance(0), 0);
  assert.equal(equilibriumRainVariance(NaN), 0);
  const drizzle = equilibriumRainVariance(0.1),
    shower = equilibriumRainVariance(0.65),
    maximum = equilibriumRainVariance(1);
  assert.ok(drizzle > 0 && shower > drizzle && maximum > shower && maximum < 0.01);
  const forcing = createRainForcing();
  forcing.update(0, 1);
  assert.equal(forcing.uniforms.rainForcingVariance.value, maximum);
  forcing.update(0, 0);
  assert.equal(forcing.uniforms.rainForcingVariance.value, maximum, "pause preserves the composed water");
  forcing.update(0.15, 0);
  assert.ok(Math.abs(forcing.uniforms.rainForcingVariance.value / maximum - Math.exp(-1)) < 1e-12);
  const compact = createRainSurface({ compact: true }),
    full = createRainSurface();
  compact.update(1, [0, 0, 0], 0.65);
  full.update(1, [0, 0, 0], 0.65);
  assert.equal(compact.evidence().statistical.slopeVariance, full.evidence().statistical.slopeVariance);
});
