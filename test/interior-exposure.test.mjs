import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createStaticLightField } from "../assets/js/home-scene/static-light-field.mjs";
import { createInteriorExposure, exposureMeterPoint, interiorExposureGain } from "../assets/js/home-scene/interior-exposure.mjs";

const ambient = { ready: true, coverage: 1, luminance: 0.1, unoccludedLuminance: 1 };

test("a bedroom cutaway meters its room subject while first-person and coast views retain eye metering", () => {
  const camera = Object.freeze([-5.83415039943576, 3.7093929506421617, 2.682904788223815]),
    subject = Object.freeze([-6.8, 2.35, 6.97]);
  assert.ok(camera[2] < 3.3 && subject[2] >= 3.3, "the observed bedroom camera lies outside its finite sleep cage");
  assert.strictEqual(exposureMeterPoint(camera, subject), subject);
  assert.strictEqual(exposureMeterPoint(camera, subject, { firstPerson: true }), camera);
  assert.strictEqual(exposureMeterPoint(camera, subject, { outside: true }), camera);
  for (const invalid of [null, [], [0, 1], [0, NaN, 2], [0, 1, 2, 3]]) assert.strictEqual(exposureMeterPoint(camera, invalid), camera);
  assert.throws(() => exposureMeterPoint([0, Infinity, 0], subject), /finite world point/);
});

test("camera compensation is bounded, outside-neutral and separate from physical source energy", () => {
  assert.equal(interiorExposureGain(ambient), 1.8);
  assert.equal(interiorExposureGain({ ...ambient, coverage: 0 }), 1);
  assert.equal(interiorExposureGain({ ...ambient, coverage: 0.5 }), 1.4);
  assert.equal(interiorExposureGain({ ...ambient, luminance: 1 }), 1);
  assert.equal(interiorExposureGain({ ...ambient, luminance: 10 }), 1, "an illuminated room does not make the camera brighter");
  for (const change of [{ ready: false }, { luminance: 0 }, { luminance: NaN }, { unoccludedLuminance: 0 }, { coverage: Infinity }])
    assert.equal(interiorExposureGain({ ...ambient, ...change }), 1);
  assert.equal(interiorExposureGain(null), 1);
  assert.throws(() => interiorExposureGain(ambient, 3), /exposure gain/);
  assert.deepEqual(ambient, { ready: true, coverage: 1, luminance: 0.1, unoccludedLuminance: 1 });
});

test("relative exposure is scale invariant and does not turn weak moonlight into additional irradiance", () => {
  const room = { ...ambient, luminance: 0.5, unoccludedLuminance: 1 };
  const gain = interiorExposureGain(room);
  assert.ok(Math.abs(gain - Math.sqrt(2)) < 1e-12);
  for (const power of [1e-5, 0.01, 1, 100])
    assert.equal(interiorExposureGain({ ...room, luminance: room.luminance * power, unoccludedLuminance: room.unoccludedLuminance * power }), gain);
});

test("adaptation depends on elapsed time, with immediate reduced-motion and paused composition", () => {
  const one = createInteriorExposure(),
    many = createInteriorExposure();
  one.update({ ...ambient, coverage: 0 }, 0);
  many.update({ ...ambient, coverage: 0 }, 0);
  const afterOne = one.update(ambient, 1);
  let afterMany;
  for (let frame = 0; frame < 10; frame++) afterMany = many.update(ambient, 0.1);
  assert.ok(Math.abs(afterOne - afterMany) < 1e-12);
  assert.ok(afterOne > 1 && afterOne < 1.8);
  assert.equal(one.update(ambient, NaN), afterOne);
  assert.equal(one.update(ambient, 0, { instant: true }), 1.8);
  assert.equal(one.update({ ...ambient, coverage: 0 }, 0, { instant: true }), 1);
  const initial = createInteriorExposure();
  assert.equal(initial.update(ambient, 0), 1.8, "the first composed room does not flash through a dark exposure");
});

test("the probe mean is independent of viewing direction, restores exactly and does not trace camera rays", async () => {
  const regions = [{ id: "room", min: [-0.8, 0.2, -0.8], max: [0.8, 1.5, 0.8] }],
    field = createStaticLightField({ regions, maxDiffuseBounces: 3 }),
    floor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x777777 }));
  floor.position.y = -0.1;
  field.addRoot(floor);
  field.setLighting({ zenith: [1, 1, 1], horizon: [1, 1, 1], ground: [1, 1, 1], practicalPowers: [] });
  assert.equal(field.ambientAt([0, 1, 0]).ready, false);
  await field.bake({ yieldTask: () => Promise.resolve() });
  const point = [0, 1, 0],
    mean = field.ambientAt(point),
    rays = field.evidence().trace.rays;
  assert.equal(mean.coverage, 1);
  assert.ok(mean.luminance > 0 && mean.luminance < mean.unoccludedLuminance);
  assert.notDeepEqual(field.sample(point, [0, 1, 0]).irradiance, field.sample(point, [0, -1, 0]).irradiance);
  for (let turn = 0; turn < 100; turn++) assert.deepEqual(field.ambientAt(point), mean);
  assert.equal(field.evidence().trace.rays, rays);
  assert.equal(field.ambientAt([20, 20, 20]).coverage, 0);
  const signature = "c".repeat(64),
    snapshot = field.exportSnapshot({ signature }),
    restored = createStaticLightField({ regions, maxDiffuseBounces: 3 });
  assert.equal(restored.restoreSnapshot(snapshot, { signature }), true);
  restored.setLighting({ zenith: [1, 1, 1], horizon: [1, 1, 1], ground: [1, 1, 1], practicalPowers: [] });
  assert.deepEqual(restored.ambientAt(point), mean);
  assert.equal(restored.evidence().trace.rays ?? 0, 0);
  field.dispose();
  assert.equal(field.ambientAt(point).ready, false);
  restored.dispose();
});
