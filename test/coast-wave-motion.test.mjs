import test from "node:test";
import assert from "node:assert/strict";
import { sampleCoastWave } from "../assets/js/footer-coast/wave-motion.mjs";
import { createRecordMotion } from "../assets/js/home-scene/record-motion.mjs";

test("coast floating contacts follow water height and analytic surface slopes", () => {
  const h = 0.00001;
  for (const time of [0, 4.8, 60])
    for (const x of [-22, 0, 18])
      for (const z of [3, 9, 14]) {
        const w = sampleCoastWave(x, z, time);
        const dx = (sampleCoastWave(x + h, z, time).height - sampleCoastWave(x - h, z, time).height) / (2 * h);
        const dz = (sampleCoastWave(x, z + h, time).height - sampleCoastWave(x, z - h, time).height) / (2 * h);
        assert.ok(Math.abs(w.height) <= 0.036);
        assert.ok(Math.abs(w.dx - dx) < 1e-8);
        assert.ok(Math.abs(w.dz - dz) < 1e-8);
      }
});

test("album mechanisms settle after large stalls while held cues stay safely raised", () => {
  const record = createRecordMotion();
  record.setPlaying(true);
  record.advance(3600);
  assert.equal(record.evidence().phase, "tracking");
  assert.ok(Number.isFinite(record.evidence().angle));
  record.cue(true);
  record.advance(3600);
  assert.equal(record.evidence().phase, "swinging");
  assert.ok(record.evidence().lift > 0.456);
  assert.ok(record.evidence().rpm < 0.1);
  record.completeCue();
  record.advance(10);
  assert.equal(record.evidence().phase, "tracking");
  record.setPlaying(false);
  record.advance(3600);
  assert.equal(record.needsFrame(), false);
});
