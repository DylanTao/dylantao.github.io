import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  DEFAULT_WIND,
  WIND_MODES,
  WIND_SPEED_BOUND,
  sampleWind,
  sampleWindPotential,
  createWindUniforms,
  windFieldGLSL,
} from "../assets/js/home-scene/wind-field.mjs";
import {
  buildPlantAttributes,
  createPlantAttachmentIndex,
  createPlantUniforms,
  updatePlantUniforms,
  samplePlantDeflection,
  deformPlantVertex,
  deformPlantNormal,
  patchPlantShader,
} from "../assets/js/home-scene/plant-motion.mjs";
import { createWindParticles } from "../assets/js/home-scene/wind-particles.mjs";

const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const derivative = (sample, p, t, axis, component, h) => {
  const lo = p.slice(),
    hi = p.slice();
  lo[axis] -= h;
  hi[axis] += h;
  return (sample(hi, t)[component] - sample(lo, t)[component]) / (2 * h);
};
test("bounded modal velocities are the analytic curl of their potentials", () => {
  assert.ok(Math.abs(WIND_MODES.reduce((sum, m) => sum + Math.hypot(...m.velocity), 0) - 1) < 1e-12);
  for (const m of WIND_MODES) {
    assert.ok(Math.abs(dot(m.k, m.velocity)) < 1e-12);
    assert.ok(Math.abs(Math.hypot(...m.k) * m.wavelength - 2 * Math.PI) < 1e-12);
  }
  for (const p of [
    [0, 0, 0],
    [-21, 3.1, 42],
    [4, -7.3, -11],
  ]) {
    const t = 34.5,
      curl = [
        derivative(sampleWindPotential, p, t, 1, 2, 1e-5) - derivative(sampleWindPotential, p, t, 2, 1, 1e-5),
        derivative(sampleWindPotential, p, t, 2, 0, 1e-5) - derivative(sampleWindPotential, p, t, 0, 2, 1e-5),
        derivative(sampleWindPotential, p, t, 0, 1, 1e-5) - derivative(sampleWindPotential, p, t, 1, 0, 1e-5),
      ];
    const actual = sampleWind(p, t);
    for (let a = 0; a < 3; a++) assert.ok(Math.abs(curl[a] - actual[a]) < 2e-8);
  }
});

test("wind has no measured sinks and obeys its proven speed bound", () => {
  for (const h of [1e-3, 1e-4])
    for (let i = 0; i < 80; i++) {
      const p = [Math.sin(i * 1.37) * 35, Math.cos(i * 0.72) * 9, Math.sin(i * 0.43) * 40],
        t = i * 3.71;
      const divergence = [0, 1, 2].reduce((s, a) => s + derivative(sampleWind, p, t, a, a, h), 0);
      assert.ok(Math.abs(divergence) < (h === 1e-3 ? 1e-6 : 2e-8), `divergence ${divergence}`);
      assert.ok(Math.hypot(...sampleWind(p, t)) <= WIND_SPEED_BOUND + 1e-12);
    }
});

test("CPU field agrees with a float32 shader arithmetic reference at local scene scale", () => {
  const f = Math.fround;
  for (let i = 0; i < 100; i++) {
    const p = [Math.sin(i) * 45, Math.cos(i * 0.41) * 12, Math.sin(i * 0.17) * 60],
      t = i * 317;
    const uniforms = createWindUniforms(t),
      expected = sampleWind(p, t),
      actual = Array.from(uniforms.coastalWindMean.value);
    for (let j = 0; j < WIND_MODES.length; j++) {
      const m = WIND_MODES[j];
      const phase = f(f(f(f(p[0]) * f(m.k[0])) + f(f(p[1]) * f(m.k[1]))) + f(f(p[2]) * f(m.k[2])));
      const sine = f(Math.sin(f(phase + uniforms.coastalWindPhase.value[j])));
      for (let a = 0; a < 3; a++) actual[a] = f(actual[a] + f(f(f(m.velocity[a]) * sine) * f(DEFAULT_WIND.gust)));
    }
    for (let a = 0; a < 3; a++) assert.ok(Math.abs(actual[a] - expected[a]) < 2e-5);
  }
  assert.equal((windFieldGLSL.match(/v \+=/g) ?? []).length, 6);
});

test("separate solidified leaf components pin actual nearby stem attachments", () => {
  const positions = new Float32Array([0, 0, 0, 0.02, 0, 0, 0.15, 0.08, 0, 1, 0, 0, 1.02, 0, 0, 1.15, 0.08, 0]);
  const attrs = buildPlantAttributes(positions, new Uint16Array([0, 1, 2, 3, 4, 5]), {
    attachmentIndex: createPlantAttachmentIndex(new Float32Array([0, 0.003, 0, 1, 0.003, 0])),
  });
  assert.equal(attrs.evidence.components, 2);
  assert.equal(attrs.evidence.enabled, 2);
  assert.equal(attrs.weight[0], 0);
  assert.equal(attrs.weight[3], 0);
  const bend = samplePlantDeflection([0, 0, 0], 12);
  assert.deepEqual(deformPlantVertex([0, 0, 0], [0, 0, 0], attrs.weight[0], bend), [0, 0, 0]);
  assert.deepEqual(Array.from(attrs.gradient.subarray(0, 3)), [0, 0, 0]);
  for (const w of attrs.weight) assert.ok(w >= 0 && w <= 1.000001);
  const rigid = buildPlantAttributes(positions, new Uint16Array([0, 1, 2, 3, 4, 5]));
  assert.equal(rigid.evidence.disabled, 2);
  assert.ok(rigid.weight.every((w) => w === 0));
});

test("seam welding joins duplicated vertices but unsupported long vines stay rigid", () => {
  const positions = new Float32Array([0, 0, 0, 0.1, 0, 0, 0.1, 0.1, 0, 0, 0, 0, 0.1, 0.1, 0, 0, 0.1, 0, 2, 0, 0, 2, 0.01, 0, 2, 2, 0]);
  const attrs = buildPlantAttributes(positions, null, {
    resolveRoot: ({ indices }) => Array.from(positions.subarray(indices[0] * 3, indices[0] * 3 + 3)),
  });
  assert.equal(attrs.evidence.components, 2);
  assert.equal(attrs.evidence.enabled, 1);
  assert.ok(attrs.weight.subarray(6).every((w) => w === 0));
  assert.throws(() => buildPlantAttributes(positions, new Uint16Array([0, 1, 500])), /Invalid plant vertex index/);
});

test("plant response is bounded, root tangent is unchanged, and normals follow its Jacobian", () => {
  for (let i = 0; i < 100; i++) assert.ok(Math.hypot(...samplePlantDeflection([i * 0.3, 2, 3], i * 0.37)) <= WIND_SPEED_BOUND * 0.018 + 1e-12);
  const bend = [0.006, 0, 0.004],
    gradient = [2, 0.7, 0],
    normal = [0, 0, 1];
  const n = deformPlantNormal(normal, gradient, bend);
  for (const tangent of [
    [1, 0, 0],
    [0, 1, 0],
  ]) {
    const transformed = tangent.map((v, a) => v + bend[a] * dot(gradient, tangent));
    assert.ok(Math.abs(dot(n, transformed)) < 1e-12);
  }
  assert.deepEqual(deformPlantNormal(normal, [0, 0, 0], bend), normal);
  const uniforms = createPlantUniforms(2);
  updatePlantUniforms(uniforms, 500, { reduced: true });
  assert.equal(uniforms.coastalPlantEnabled.value, 0);
  assert.deepEqual(samplePlantDeflection([0, 0, 0], 500, undefined, { reduced: true }), [0, 0, 0]);
});

test("beauty, shadow and normal hooks share one bend evaluation", () => {
  const wind = createWindUniforms(),
    plant = createPlantUniforms();
  for (const normals of [true, false]) {
    const shader = { uniforms: {}, vertexShader: `void main(){${normals ? "#include <beginnormal_vertex>" : ""}\n#include <begin_vertex>\n}` };
    patchPlantShader(shader, wind, plant);
    assert.equal((shader.vertexShader.match(/vec3 coastalLocalBend=/g) ?? []).length, 1);
    assert.ok(shader.vertexShader.includes("vec3 transformed=position+coastalPlantWeight*coastalLocalBend"));
    assert.equal(shader.uniforms.coastalPlantPhase, plant.coastalPlantPhase);
  }
});

const emitters = new Float32Array([0, 1, 0, 0.15, 1, 0.2, -0.1, 1, -0.2]);
const bounds = { min: [-1, 0.8, -1], max: [1, 2, 1] };
test("particle fixed ticks reproduce across render cadences and ignore inactive wall time", () => {
  for (const kind of ["steam", "dust", "spray"]) {
    const a = createWindParticles({ kind, emitters, bounds }),
      b = createWindParticles({ kind, emitters, bounds });
    for (let i = 0; i < 120; i++) a.advance(1 / 60);
    for (let i = 0; i < 60; i++) b.advance(1 / 30);
    assert.deepEqual(a.snapshot(), b.snapshot());
    const held = a.snapshot();
    a.advance(1000, { active: false });
    a.advance(1000, { reduced: true });
    assert.deepEqual(a.snapshot(), held);
    a.advance(1 / 60);
    b.advance(1 / 60);
    assert.deepEqual(a.snapshot(), b.snapshot());
    assert.ok(a.positions.every(Number.isFinite));
    for (let i = 0; i < a.positions.length; i++) assert.ok(a.positions[i] >= bounds.min[i % 3] && a.positions[i] <= bounds.max[i % 3]);
  }
});

test("midpoint advection converges and stalled frames report dropped time without a queue", () => {
  const trajectory = (step) => {
    const p = createWindParticles({ emitters: new Float32Array([1, 2, 3]), step, lifetime: 1000, jitter: 0, windGain: 1, drift: [0, 0, 0] });
    for (let i = 0; i < 240; i++) p.advance(1 / 60);
    return Array.from(p.positions);
  };
  const a = trajectory(1 / 30),
    b = trajectory(1 / 60),
    c = trajectory(1 / 120),
    distance = (x, y) => Math.hypot(...x.map((v, i) => v - y[i]));
  assert.ok(distance(b, c) < distance(a, c) * 0.35);
  const stalled = createWindParticles({ emitters }),
    reference = createWindParticles({ emitters, timeOffset: 3.75 });
  stalled.advance(4, { fieldTime: 4 });
  reference.advance(0.25, { fieldTime: 4 });
  assert.equal(stalled.evidence().droppedTime, 3.75);
  assert.equal(stalled.evidence().fieldSeconds, 4);
  assert.equal(stalled.evidence().backlogSeconds, 0);
  assert.deepEqual(stalled.snapshot(), reference.snapshot());
  const bounded = createWindParticles({ emitters, maxSteps: 2 });
  bounded.advance(4, { fieldTime: 4 });
  assert.ok(bounded.evidence().droppedTime > 3.96);
  assert.ok(bounded.evidence().backlogSeconds < 1 / 60);
});

test("representative 200-particle CPU probe reports bounded work", (t) => {
  const populations = [18, 42, 140].map((count, i) =>
    createWindParticles({
      kind: ["steam", "dust", "spray"][i],
      emitters: new Float32Array(Array.from({ length: count * 3 }, (_, j) => (j % 3 === 1 ? 1 : (j % 17) * 0.07))),
    })
  );
  const start = performance.now();
  for (let tick = 0; tick < 120; tick++) for (const p of populations) p.advance(1 / 60);
  const ms = (performance.now() - start) / 120;
  t.diagnostic(`Node CPU mean ${ms.toFixed(3)} ms per combined 200-particle fixed tick; not a browser/GPU frame claim.`);
  assert.equal(
    populations.reduce((n, p) => n + p.evidence().count, 0),
    200
  );
});
