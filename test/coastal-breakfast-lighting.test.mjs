import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { staticLightRegions, createStaticLightField } from "../assets/js/home-scene/static-light-field.mjs";
import { practicalSourcesFor, createWarmPracticals } from "../assets/js/home-scene/warm-practicals.mjs";
import { createLightInstallations, MAX_LINES, MAX_POINTS, roomLightSources } from "../assets/js/home-scene/light-installations.mjs";
import * as THREE from "../assets/js/three.module.min.js";
const replacement = () => ({ id: "breakfast", replaces: "study", min: [-8.15, -1.12, 3.05], max: [-5.1, 1.45, 6.7] });
const actual = () => JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
const base = () => {
  const c = actual();
  c.lightTransportRegions = (c.lightTransportRegions || []).filter((region) => region.id !== "breakfast");
  delete c.rooms.find((room) => room.id === "kitchen").practicalSource;
  delete c.interiorLights.pendantRegion;
  return c;
};
function candidate() {
  const c = base();
  c.lightTransportRegions.push(replacement());
  const kitchen = c.rooms.find((r) => r.id === "kitchen");
  kitchen.practicalSource = { position: [-7.66, 0.94, 5.85], emitterRadius: 0.03 };
  return c;
}
test("the existing library covers the retired Study cage above its real floor, target and task lamp", () => {
  const c = base(),
    regions = staticLightRegions(c),
    old = regions.find((r) => r.id === "study"),
    library = regions.find((r) => r.id === "library"),
    study = c.rooms.find((r) => r.id === "study");
  assert.equal(study.floor, 0);
  assert.ok(old.min[1] < study.floor, "the retired cage includes a thin subfloor margin");
  const lo = old.min.map((value, axis) => (axis === 1 ? Math.max(value, study.floor) : value));
  const inside = (point) => point.every((value, axis) => value >= library.min[axis] && value <= library.max[axis]);
  for (let mask = 0; mask < 8; mask++) assert.ok(inside(lo.map((value, axis) => (mask & (1 << axis) ? old.max[axis] : value))));
  assert.ok(inside(study.target));
  assert.ok(inside(practicalSourcesFor(c).find((source) => source.id === "study").position));
  const next = staticLightRegions(candidate());
  assert.deepEqual(
    next.find((region) => region.id === "library"),
    library
  );
});
test("the actual current manifest retains the fixed field and practical budgets", () => {
  const c = actual(),
    field = createStaticLightField({ regions: staticLightRegions(c), practicalSources: [...practicalSourcesFor(c), ...roomLightSources(c)] });
  try {
    const e = field.evidence();
    assert.equal(e.regions.length, 16);
    assert.equal(e.probes.length, 128);
    assert.equal(e.practicalEnergy.length, 28);
  } finally {
    field.dispose();
  }
});
test("named breakfast replacement retains the inherited sampler position and every other cage", () => {
  const c = base(),
    before = staticLightRegions(c);
  c.lightTransportRegions.push(replacement());
  const after = staticLightRegions(c);
  assert.equal(after.length, before.length);
  for (let i = 0; i < before.length; i++) assert.deepEqual(after[i], before[i].id === "study" ? replacement() : before[i]);
  assert.equal(after.filter((r) => r.id === "breakfast").length, 1);
  assert.equal(after.filter((r) => r.id === "study").length, 0);
  assert.deepEqual(staticLightRegions(base()), before);
});
test("unknown, self, duplicate, conflicting or malformed replacements fail closed", () => {
  for (const edit of [
    (r) => (r.id = "other"),
    (r) => (r.replaces = "sleep"),
    (r) => (r.replaces = "breakfast"),
    (r) => (r.min[0] = NaN),
    (r) => (r.max = r.min),
  ]) {
    const c = base(),
      r = replacement();
    edit(r);
    c.lightTransportRegions.push(r);
    assert.throws(() => staticLightRegions(c), RangeError);
  }
  for (const extra of [replacement(), { id: "study", min: [0, 0, 0], max: [1, 1, 1] }, { id: "breakfast", min: [0, 0, 0], max: [1, 1, 1] }]) {
    const c = base();
    c.lightTransportRegions.push(replacement(), extra);
    assert.throws(() => staticLightRegions(c), RangeError);
  }
});
test("breakfast metadata preserves16regions128probes28practicals and all existing powers", () => {
  const a = base(),
    b = candidate(),
    sourcesA = practicalSourcesFor(a),
    sourcesB = practicalSourcesFor(b),
    field = createStaticLightField({ regions: staticLightRegions(b), practicalSources: [...sourcesB, ...roomLightSources(b)] });
  try {
    const e = field.evidence();
    assert.equal(e.regions.length, 16);
    assert.equal(e.probes.length, 128);
    assert.equal(e.practicalEnergy.length, 28);
    assert.equal(sourcesA.length, sourcesB.length);
    for (let i = 0; i < sourcesA.length; i++)
      assert.deepEqual(
        sourcesB[i],
        sourcesA[i].id === "kitchen" ? { ...sourcesA[i], position: [-7.66, 0.94, 5.85], emitterRadius: 0.03 } : sourcesA[i]
      );
  } finally {
    field.dispose();
  }
});
test("kitchen override must remain finite, bounded and attached to its named physical cage", () => {
  for (const edit of [
    (c) => c.lightTransportRegions.pop(),
    (c) => (c.rooms.find((r) => r.id === "kitchen").practicalSource = false),
    (c) => (c.rooms.find((r) => r.id === "kitchen").practicalSource.position = [Infinity, 0, 0]),
    (c) => (c.rooms.find((r) => r.id === "kitchen").practicalSource.emitterRadius = 0.251),
    (c) => (c.rooms.find((r) => r.id === "kitchen").practicalSource.position = [-10, 0, 5]),
  ]) {
    const c = candidate();
    edit(c);
    assert.throws(() => practicalSourcesFor(c), RangeError);
  }
});
test("real existing routine schedules and direct light intensities are unchanged", () => {
  const a = createWarmPracticals(new THREE.Scene(), (m) => m, { sources: practicalSourcesFor(base()) }),
    b = createWarmPracticals(new THREE.Scene(), (m) => m, { sources: practicalSourcesFor(candidate()) });
  try {
    for (const id of ["sleep", "breakfast", "lunch", "dinner", "workout", "work"])
      for (const daylight of [0, 0.2, 1])
        for (const minute of [0, 480, 720, 1200]) {
          const state = {
            id,
            minute,
            schedule: [
              [0, "sleep"],
              [480, "breakfast"],
              [1200, "dinner"],
            ],
          };
          a.update(daylight, state);
          b.update(daylight, state);
          assert.deepEqual(b.evidence().levels, a.evidence().levels);
          assert.equal(b.evidence().nightMix, a.evidence().nightMix);
          assert.equal(b.evidence().pointLights, a.evidence().pointLights);
          assert.deepEqual(
            b.lights.map((l) => [l.intensity, l.distance, l.decay]),
            a.lights.map((l) => [l.intensity, l.distance, l.decay])
          );
        }
  } finally {
    a.dispose();
    b.dispose();
  }
});

test("the moved lantern replaces its original analytical point without changing other sources", () => {
  const beforeConfig = base(),
    afterConfig = base();
  afterConfig.interiorLights.pendant = [-7.16, 0.82, 4.95];
  afterConfig.interiorLights.pendantRegion = { min: replacement().min, max: replacement().max };
  const before = createLightInstallations(beforeConfig),
    after = createLightInstallations(afterConfig);
  try {
    assert.equal(after.points.length, before.points.length);
    assert.equal(after.lines.length, before.lines.length);
    assert.deepEqual(after.lines, before.lines);
    for (let i = 0; i < before.points.length; i++) {
      const a = before.points[i],
        b = after.points[i];
      if (a.id !== "pendant") assert.deepEqual(b, a);
      else {
        assert.deepEqual(b.position.toArray(), [-7.16, 0.82, 4.95]);
        assert.equal(b.intensity, 2.1);
        assert.equal(b.id, a.id);
        assert.deepEqual(b.color, a.color);
        assert.equal(b.cone, a.cone);
        assert.deepEqual(b.region.min.toArray(), replacement().min);
        assert.deepEqual(b.region.max.toArray(), replacement().max);
      }
    }
    for (const pack of Object.values(after.evidence().receiverPacks)) {
      assert.ok(pack.lines <= MAX_LINES);
      assert.ok(pack.points <= MAX_POINTS);
    }
    for (const bad of [{ min: [1, 1, 1], max: [0, 0, 0] }, { min: [NaN, 0, 0], max: [1, 1, 1] }, {}]) {
      const c = base();
      c.interiorLights.pendantRegion = bad;
      assert.throws(() => createLightInstallations(c), RangeError);
    }
  } finally {
    before.dispose();
    after.dispose();
  }
});
