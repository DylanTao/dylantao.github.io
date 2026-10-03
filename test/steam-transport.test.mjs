import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createSteamDensity } from "../assets/js/home-scene/steam-density.mjs";
import { createSteamVolume, steamRayIntervals, integrateSteamSamples, steamPhase } from "../assets/js/home-scene/steam-volume.mjs";

const close = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`);
const stillWind = { mean: [0, 0, 0], gust: 0, rate: 1 };
const passive = {
  bounds: { min: [-1, 0, -1], max: [1, 2, 1] },
  grid: [16, 16, 16],
  center: [0, 0],
  wind: stillWind,
  baseRise: 0,
  thermalRise: 0,
  diffusion: 0,
  cooling: 0,
  dissipation: 0,
  escape: 0,
  sourceRate: 0,
};
function gaussian(field, center, width = 0.16, heat = 0) {
  const { grid, min, cell } = field.domain,
    [nx, ny, nz] = grid;
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const p = (k * ny + j) * nx + i,
          distance = [i, j, k].reduce((sum, a, axis) => sum + (min[axis] + (a + 0.5) * cell[axis] - center[axis]) ** 2, 0),
          value = Math.exp(-distance / (2 * width * width));
        field.state.density[p] = value;
        field.state.temperature[p] = value * heat;
      }
}
function evolve(field, seconds, hz, options = {}) {
  for (let i = 0; i < Math.round(seconds * hz); i++) field.advance(1 / hz, { fieldTime: (i + 1) / hz, ...options });
}

test("empty source-free scalar domain remains exactly empty and invalid input is inert", () => {
  const field = createSteamDensity();
  evolve(field, 1, 60, { sourceEnabled: false });
  assert.ok(field.state.density.every((x) => x === 0));
  assert.ok(field.state.temperature.every((x) => x === 0));
  const before = field.evidence();
  for (const delta of [-1, NaN, Infinity, 0]) assert.equal(field.advance(delta), 0);
  assert.deepEqual(field.evidence(), before);
  assert.throws(() => createSteamDensity({ grid: [24, 24, 1] }), RangeError);
  assert.throws(() => createSteamDensity({ diffusion: 10 }), RangeError);
});

test("constant prescribed velocity translates a concentration pulse at the expected speed", () => {
  const field = createSteamDensity({ ...passive, wind: { mean: [0.2, 0, -0.1], gust: 0 }, windScale: 1 });
  gaussian(field, [-0.25, 0.9, 0.1]);
  const before = field.evidence();
  evolve(field, 1, 60, { sourceEnabled: false });
  const after = field.evidence();
  close(after.centroid[0] - before.centroid[0], 0.2, 0.003);
  close(after.centroid[2] - before.centroid[2], -0.1, 0.003);
  close(after.centroid[1], before.centroid[1], 0.0001);
  assert.ok(after.maximumDensity < before.maximumDensity, "linear backtrace has honest numerical diffusion");
  assert.equal(after.conservedMass, false);
});

test("positive scalar diffusion spreads a pulse while cooling and dissipation reduce its peak", () => {
  const field = createSteamDensity({ ...passive, diffusion: 0.004, cooling: 0.3, dissipation: 0.4 });
  gaussian(field, [0, 1, 0], 0.1, 10);
  const before = field.evidence();
  evolve(field, 1, 30, { sourceEnabled: false });
  const after = field.evidence();
  assert.ok(after.finite && after.maximumDensity < before.maximumDensity * 0.7);
  assert.ok(after.maximumTemperature < before.maximumTemperature * 0.8);
  close(after.densityIntegral / before.densityIntegral, Math.exp(-0.4), 0.0001);
  close(after.centroid[1], before.centroid[1], 0.00001);
  assert.ok(field.sample([0.25, 1, 0]).density > 0.03, "resolved diffusion reaches surrounding cells");
});

test("temperature-dependent rise moves the warm concentration higher than a cold control", () => {
  const cold = createSteamDensity({ ...passive, thermalRise: 0.02 }),
    warm = createSteamDensity({ ...passive, thermalRise: 0.02 });
  gaussian(cold, [0, 0.75, 0], 0.2);
  gaussian(warm, [0, 0.75, 0], 0.2);
  warm.state.temperature.fill(12);
  evolve(cold, 1.5, 60, { sourceEnabled: false });
  evolve(warm, 1.5, 60, { sourceEnabled: false });
  close(warm.evidence().centroid[1] - cold.evidence().centroid[1], 0.36, 0.006);
  assert.ok(warm.evidence().maximumSpeed > 0.15);
  close(cold.evidence().centroid[1], 0.75, 0.0001);
});

test("mature warm bath is bounded, low and nonempty, and switching off its source disperses it", () => {
  const field = createSteamDensity({ grid: [16, 16, 16] });
  assert.equal(field.prewarm(6), 180);
  const mature = field.evidence();
  assert.ok(mature.finite && mature.maximumDensity <= 1 && mature.maximumTemperature <= 14);
  assert.ok(mature.meanDensity > 0.08 && mature.maximumTemperature > 8);
  assert.ok(mature.centroid[1] < field.domain.min[1] + 0.3);
  assert.ok(mature.topFraction < 0.015, "the highest cells do not obscure the face");
  assert.equal(mature.simulationTime, 0);
  assert.equal(mature.fieldEndTime, 0);
  assert.throws(() => field.prewarm(1), /one-time/);
  evolve(field, 4, 60, { sourceEnabled: false });
  assert.ok(field.evidence().densityIntegral < mature.densityIntegral * 0.24);
});

test("fixed scalar steps agree across 30/60/144Hz; pause and reduced motion retain the field", () => {
  const fields = [30, 60, 144].map((hz) => {
    const field = createSteamDensity({ grid: [12, 12, 12] });
    field.prewarm(1);
    evolve(field, 2, hz);
    return field;
  });
  for (const field of fields.slice(1)) {
    assert.deepEqual(field.state.density, fields[0].state.density);
    assert.deepEqual(field.state.temperature, fields[0].state.temperature);
    assert.equal(field.evidence().ticks, 90);
  }
  const field = fields[0],
    density = field.state.density.slice(),
    before = field.evidence();
  field.advance(10, { active: false });
  field.advance(10, { reduced: true });
  assert.deepEqual(field.state.density, density);
  assert.deepEqual(field.evidence(), before);
  field.advance(1 / 30, { fieldTime: 2 + 1 / 30 });
  assert.equal(field.evidence().ticks, 91);
});

test("a stalled frame drops excess duration and samples the current shared clock without backlog", () => {
  const field = createSteamDensity({ grid: [8, 8, 8] });
  const advanced = field.advance(4, { fieldTime: 100 });
  assert.equal(advanced, 7);
  const e = field.evidence();
  close(e.droppedTime, 3.75);
  close(e.fieldEndTime, 100);
  assert.ok(e.pending < e.fixedStep);
  field.advance(1 / 60, { fieldTime: 100 + 1 / 60 });
  assert.equal(field.evidence().ticks, 8, "one recent tick, not the discarded four-second queue");
});

test("RGBA8 atlas stores each distinct slice and its density/temperature quantization is bounded", () => {
  const field = createSteamDensity({ ...passive, grid: [4, 4, 5] }),
    { atlas, state } = field;
  for (let i = 0; i < state.density.length; i++) {
    state.density[i] = i / state.density.length;
    state.temperature[i] = (14 * i) / state.density.length;
  }
  field.writeAtlas();
  for (let k = 0; k < 5; k++)
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        const p = (k * 4 + j) * 4 + i,
          a = ((Math.floor(k / atlas.tiles) * 4 + j) * atlas.width + (k % atlas.tiles) * 4 + i) * 4;
        close(atlas.data[a] / 255, state.density[p], 0.5 / 255 + 1e-8);
        close((atlas.data[a + 1] / 255) * 14, state.temperature[p], 7 / 255 + 1e-7);
        assert.equal(atlas.data[a + 3], 255);
      }
  assert.throws(() => field.writeAtlas(new Uint8Array(4)), RangeError);
});

test("nearest-interface split clips solid surfaces and partitions front/back gas without overlap", () => {
  assert.deepEqual(steamRayIntervals(2, 8, 7, 4), { background: [4, 7], foreground: [2, 4] });
  assert.deepEqual(steamRayIntervals(-2, 8, 7, 4), { background: [4, 7], foreground: [0, 4] });
  assert.deepEqual(steamRayIntervals(2, 8, 3, 4), { background: [2, 3], foreground: null });
  assert.deepEqual(steamRayIntervals(2, 8, 7, 1), { background: [2, 7], foreground: null });
  assert.deepEqual(steamRayIntervals(2, 8, 10, 9), { background: null, foreground: [2, 8] });
  assert.deepEqual(steamRayIntervals(2, 8, 1, 4), { background: null, foreground: null });
});

test("single-scattering phase peaks toward the source and integrates to unit solid-angle weight", () => {
  const g = 0.25;
  close(steamPhase(1, g), (1 + g) / (4 * Math.PI * (1 - g) ** 2));
  close(steamPhase(-1, g), (1 - g) / (4 * Math.PI * (1 + g) ** 2));
  assert.ok(steamPhase(1, g) > steamPhase(-1, g) * 4);
  let integral = 0;
  for (let i = 0; i < 10000; i++) integral += steamPhase(-1 + ((i + 0.5) * 2) / 10000, g) * ((4 * Math.PI) / 10000);
  close(integral, 1, 1e-7);
});

test("caller-yielded prewarm equals synchronous phases, suppresses active stepping and aborts safely", async () => {
  const synchronous = createSteamDensity({ grid: [8, 8, 8] }),
    asynchronous = createSteamDensity({ grid: [8, 8, 8] });
  synchronous.prewarm(0.5);
  let slices = 0;
  assert.equal(
    await asynchronous.prewarmAsync(0.5, {
      yieldTask: async () => {
        slices++;
        assert.equal(asynchronous.advance(1), 0, "warmup owns this field until ready");
      },
    }),
    true
  );
  assert.equal(slices, 14);
  assert.deepEqual(asynchronous.state.density, synchronous.state.density);
  assert.deepEqual(asynchronous.state.temperature, synchronous.state.temperature);
  assert.equal(asynchronous.evidence().simulationTime, 0);
  const aborted = createSteamDensity({ grid: [8, 8, 8] });
  let calls = 0;
  assert.equal(
    await aborted.prewarmAsync(6, {
      yieldTask: async () => {
        calls++;
      },
      shouldContinue: () => calls < 3,
    }),
    false
  );
  assert.equal(aborted.evidence().ticks, 3);
  assert.equal(aborted.evidence().prewarming, false);
});

test("Beer–Lambert integration is emission-free, step-invariant for homogeneous gas and composes across glass", () => {
  const density = 0.3,
    extinction = 2,
    incident = [0.4, 0.5, 0.6],
    options = { extinction, albedo: 0.9, incident },
    result = integrateSteamSamples(Array(40).fill(density), 0.05, options),
    fewer = integrateSteamSamples(Array(20).fill(density), 0.1, options),
    expectedT = Math.exp(-density * extinction * 2);
  close(result.transmission, expectedT);
  for (let axis = 0; axis < 3; axis++) {
    close(result.radiance[axis], (1 - expectedT) * incident[axis] * 0.9);
    close(result.radiance[axis], fewer.radiance[axis]);
  }
  const front = integrateSteamSamples(Array(15).fill(density), 0.05, options),
    back = integrateSteamSamples(Array(25).fill(density), 0.05, options);
  close(front.transmission * back.transmission, result.transmission);
  for (let axis = 0; axis < 3; axis++) close(front.radiance[axis] + front.transmission * back.radiance[axis], result.radiance[axis]);
  assert.deepEqual(integrateSteamSamples([1, 1], 1, { incident: [0, 0, 0] }).radiance, [0, 0, 0]);
  assert.equal(integrateSteamSamples([0, 0], 1).alpha, 0);
});

test("volume adapter has two ordered linear segments, frame-local depth/camera and no paused uploads", () => {
  const field = createSteamDensity({ grid: [8, 8, 8] }),
    volume = createSteamVolume(field),
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100),
    otherCamera = camera.clone(),
    opaque = new THREE.DepthTexture(100, 100),
    transparent = new THREE.DepthTexture(100, 100),
    renderer = { getCurrentViewport: (out) => out.set(0, 0, 200, 100) };
  camera.updateMatrixWorld();
  assert.equal(volume.object.children.length, 2);
  const [back, front] = volume.object.children;
  assert.equal(back.material.transparent, false);
  assert.equal(front.material.transparent, true);
  for (const mesh of [back, front]) {
    assert.equal(mesh.material.side, THREE.BackSide);
    assert.equal(mesh.material.blending, THREE.CustomBlending);
    assert.equal(mesh.material.blendSrc, THREE.OneFactor);
    assert.equal(mesh.material.blendDst, THREE.OneMinusSrcAlphaFactor);
    assert.equal(mesh.material.toneMapped, false);
    assert.equal(mesh.material.depthWrite, false);
  }
  assert.equal(volume.sync(), false);
  field.advance(1 / 30);
  assert.equal(volume.sync(), true);
  assert.equal(volume.sync(), false);
  volume.setDepth(opaque, transparent, camera);
  back.onBeforeRender(renderer, null, camera);
  assert.equal(volume.uniforms.steamDepthEnabled.value, true);
  assert.deepEqual(volume.uniforms.steamViewport.value.toArray(), [0, 0, 200, 100]);
  front.onBeforeRender(renderer, null, otherCamera);
  assert.equal(volume.uniforms.steamDepthEnabled.value, false, "reflection cannot consume another camera's depth");
  volume.setLighting({ ambient: [0.2, 0.3, 0.4], direction: [0, 1, 0] });
  assert.deepEqual(volume.uniforms.steamAmbient.value.toArray(), [0.2, 0.3, 0.4]);
  assert.equal(volume.evidence().texture.floatLinearRequired, false);
  volume.dispose();
  volume.dispose();
  assert.equal(volume.evidence().disposed, true);
});
