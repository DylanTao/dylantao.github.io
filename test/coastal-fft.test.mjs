import test from "node:test";
import assert from "node:assert/strict";
import { inverseFFT, createFFTOcean } from "../assets/js/home-scene/fft-ocean.mjs";
import { stillPhotoJitter } from "../assets/js/home-scene/still-photo.mjs";
test("inverse FFT reconstructs known spatial impulse and sinusoid", () => {
  const r = new Float64Array(8).fill(1),
    i = new Float64Array(8);
  inverseFFT(r, i);
  assert.equal(r[0], 1);
  for (let j = 1; j < 8; j++) assert.ok(Math.abs(r[j]) < 1e-12);
  r.fill(0);
  i.fill(0);
  r[1] = 4;
  r[7] = 4;
  inverseFFT(r, i);
  for (let j = 0; j < 8; j++) assert.ok(Math.abs(r[j] - Math.cos((2 * Math.PI * j) / 8)) < 1e-12);
});
test("FFT ocean shares periodic, deterministic displacement and a held clock without recomputation", () => {
  const sea = createFFTOcean(),
    same = createFFTOcean();
  for (const t of [0, 0.3, 12, 721]) {
    const a = sea.sample(13.7, -40.4, t),
      b = sea.sample(13.7 + 128, -40.4 - 128, t);
    assert.ok(Math.abs(a.displacement[1] - b.displacement[1]) < 1e-12);
    assert.deepEqual(a, same.sample(13.7, -40.4, t));
    assert.ok(a.normal[1] > 0.85);
    assert.ok(Math.abs(a.displacement[1]) < 1);
    let mean = 0;
    for (let i = 0; i < sea.data.length; i += 4) mean += sea.data[i];
    assert.ok(Math.abs(mean / 4096) < 1e-7, "zero-DC spectrum preserves mean sea level");
    const transforms = sea.evidence().transforms;
    sea.sample(50, 20, t);
    assert.equal(sea.evidence().transforms, transforms);
  }
  assert.notDeepEqual(sea.sample(10, 20, 0), sea.sample(10, 20, 1));
});
test("still-photo jitter is bounded, balanced and finite", () => {
  for (const n of [2, 8, 16]) {
    const points = stillPhotoJitter(n);
    for (let c = 0; c < 2; c++) assert.ok(Math.abs(points.reduce((s, p) => s + p[c], 0)) < 1e-12);
    assert.ok(points.every((p) => p.every((v) => Math.abs(v) < 0.7)));
  }
  assert.throws(() => stillPhotoJitter(100), RangeError);
});
