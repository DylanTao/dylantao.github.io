import test from "node:test";
import assert from "node:assert/strict";
import { createPoolImpact, sprayDrop, sprayPosition, crownSection } from "../assets/js/home-scene/pool-impact.mjs";
const create = () => createPoolImpact({ width: 10.8, length: 4.75, depth: 1.35 });

test("entry speed excites finite, zero-volume reflecting waves within a fraction of the entry energy", () => {
  const waves = create();
  assert.equal(waves.impact({ x: 1, z: -0.5, speed: 14 }), true);
  const initial = waves.evidence();
  assert.ok(initial.lastImpact.addedPotentialJ > 0 && initial.lastImpact.addedPotentialJ <= initial.lastImpact.waveBudgetJ + 1e-12);
  assert.ok(initial.lastImpact.waveBudgetJ <= initial.lastImpact.entryEnergy * 0.002 + 1e-12);
  const data = new Float32Array(64 * 32 * 4);
  let previous = initial.energyJ;
  for (let i = 0; i < 120; i++) {
    waves.advance(1 / 30);
    const row = waves.evidence();
    assert.ok(row.energyJ <= previous + 1e-9, "unforced energy decays");
    assert.ok(row.amplitudeBound <= 0.120001);
    previous = row.energyJ;
  }
  waves.writeSurface(data);
  assert.ok(data.every(Number.isFinite));
  let integral = 0;
  // Trapezoidal integration of cosine modes includes both walls.
  for (let j = 0; j < 32; j++) for (let i = 0; i < 64; i++) integral += data[(j * 64 + i) * 4] * (i && i < 63 ? 1 : 0.5) * (j && j < 31 ? 1 : 0.5);
  assert.ok(Math.abs(integral / (63 * 31)) < 1e-8, integral);
  for (const x of [-5.4, 5.4]) assert.ok(Math.abs(waves.sample(x, 0.2)[1]) < 1e-12, "no normal slope at the side walls");
  for (const z of [-2.375, 2.375]) assert.ok(Math.abs(waves.sample(1.2, z)[2]) < 1e-12, "no normal slope at the end walls");
});

test("wave travel and recovery are independent of render-frame partition", () => {
  const a = create(),
    b = create();
  for (const waves of [a, b]) waves.impact({ x: -2.3, z: 1.1, speed: 9 });
  a.advance(2);
  for (let i = 0; i < 288; i++) b.advance(1 / 144);
  for (const [x, z] of [
    [0, 0],
    [-2.3, 1.1],
    [4, -1.2],
  ])
    a.sample(x, z).forEach((value, i) => assert.ok(Math.abs(value - b.sample(x, z)[i]) < 1e-12));
  a.advance(24);
  assert.equal(a.busy, false);
  assert.ok(a.evidence().energyJ < 1e-9);
});

test("edge/repeated impacts stay bounded; off-water and invalid entries cannot create waves", () => {
  const waves = create();
  for (const event of [
    { x: 20, z: 0, speed: 20 },
    { x: 0, z: 0, speed: Infinity },
    { x: 0, z: 0, speed: -1 },
  ])
    assert.equal(waves.impact(event), false);
  assert.equal(waves.evidence().impacts, 0);
  for (let i = 0; i < 200; i++) {
    waves.impact({ x: i % 2 ? 5.3 : -5.3, z: 2.3, speed: 30 });
    waves.advance(1 / 60);
    assert.ok(waves.evidence().amplitudeBound <= 0.120001);
  }
});

test("spray follows ballistic gravity, returns to the water and uses a bounded energy share", () => {
  let energy = 0;
  for (let i = 0; i < 144; i++) {
    const drop = sprayDrop(14, i, 144),
      mass = (4 * Math.PI * drop.radius ** 3 * 1000) / 3,
      start = sprayPosition(drop, 0),
      apex = sprayPosition(drop, drop.vy / 9.80665),
      finish = sprayPosition(drop, drop.lifetime);
    assert.equal(start[1], 0);
    assert.ok(apex[1] > 0 && apex[1] <= 0.85);
    assert.ok(Math.abs(finish[1]) < 1e-12);
    energy += (mass * (drop.vx ** 2 + drop.vy ** 2 + drop.vz ** 2)) / 2;
  }
  assert.ok(energy < 0.015 * 0.5 * 80 * 14 ** 2, energy);
});

test("the thin crown has unequal ballistic rim sections and returns to the water", () => {
  const heights = [];
  for (let i = 0; i < 64; i++) {
    const angle = (i * Math.PI * 2) / 64,
      start = crownSection(14, angle, 0),
      middle = crownSection(14, angle, 0.18),
      end = crownSection(14, angle, start.lifetime);
    assert.equal(start.height, 0);
    assert.ok(middle.height >= 0 && middle.height <= 0.65);
    assert.equal(end.height, 0);
    assert.ok(middle.rim > middle.base);
    heights.push(middle.height);
  }
  assert.ok(Math.max(...heights) - Math.min(...heights) > 0.1, "the rim is not a rotating uniform ring");
});
