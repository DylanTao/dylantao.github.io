import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { POOL_RIPPLES, POOL_RIPPLE_SLOPE, createOnsenWater, poolCausticGLSL, poolRippleGLSL } from "../assets/js/home-scene/onsen-water.mjs";

const close = (actual, expected, tolerance, label = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} ${actual} differs from ${expected} by more than ${tolerance}`);

test("a calm pool focuses nothing: the basin's caustic gain is exactly one", () => {
  const pool = createOnsenWater({ depth: 0.127 });
  for (let i = 0; i < 40; i++) {
    const angle = i * 2.39996,
      r = 0.7 * Math.sqrt(i / 40);
    assert.equal(pool.causticGainAt(3.02 + r * Math.cos(angle), -1.82 + r * Math.sin(angle), 0.127, i * 0.37), 1);
  }
  const evidence = pool.evidence().caustics.overheadFloorGain;
  assert.equal(evidence.minimum, 1);
  assert.equal(evidence.maximum, 1);
  pool.dispose();
});

test("waves refocus the light on the floor into caustics whose mean stays near one", () => {
  const pool = createOnsenWater({ depth: 0.127 });
  pool.disturb({ amplitude: 0.004, spread: 0.12 });
  for (let i = 0; i < 30; i++) pool.advance(1 / 60);
  const { minimum, maximum, mean } = pool.evidence().caustics.overheadFloorGain;
  assert.ok(minimum < 0.9 && maximum > 1.1, `caustics span ${minimum}..${maximum}`);
  close(mean, 1, 0.1, "mean gain");
  // A longer path through the same surface focuses more strongly.
  let shallow = 0,
    deep = 0;
  for (let i = 0; i < 200; i++) {
    const x = 3.02 + ((i * 0.618) % 1) - 0.5,
      z = -1.82 + ((i * 0.382) % 1) - 0.5;
    shallow += Math.abs(pool.causticGainAt(x, z, 0.03) - 1);
    deep += Math.abs(pool.causticGainAt(x, z, 0.12) - 1);
  }
  assert.ok(deep > shallow);
  pool.dispose();
});

test("sub-grid ripples are capillary-gravity waves shorter than the grid can carry", () => {
  const pool = createOnsenWater({ depth: 0.127 }),
    gridLimit = 2 * pool.solver.grid.dx;
  for (const w of POOL_RIPPLES) {
    assert.ok(w.wavelength < gridLimit, `${w.wavelength} m is below the ${gridLimit} m two-cell limit`);
    close(w.omega ** 2, 9.80665 * w.k + (0.072 / 1000) * w.k ** 3, 1e-9, "dispersion");
    close(Math.hypot(w.dx, w.dz), 1, 1e-12, "unit direction");
  }
  assert.ok(POOL_RIPPLE_SLOPE > 0);
  // They ride on the solver's clock: no step, no motion.
  const before = pool.uniforms.poolTime.value;
  pool.advance(0);
  assert.equal(pool.uniforms.poolTime.value, before);
  pool.disturb({ amplitude: 0.003, spread: 0.12 });
  pool.advance(1 / 30);
  assert.ok(pool.uniforms.poolTime.value > before);
  pool.dispose();
});

test("the basin's stone takes the water's light through one chained RE_Direct and restores on dispose", () => {
  const pool = createOnsenWater({ depth: 0.127, absorption: [2, 0.9, 1] }),
    stone = new THREE.MeshPhysicalMaterial({ name: "warm cut stone" }),
    original = stone.onBeforeCompile,
    originalKey = stone.customProgramCacheKey;
  assert.equal(pool.bindCausticReceiver(stone), true);
  assert.equal(pool.bindCausticReceiver(stone), false, "bound once");
  const shader = {
    uniforms: {},
    vertexShader: "#include <common>\n#include <project_vertex>",
    fragmentShader: "#include <common>\n#include <color_fragment>\n#include <lights_physical_pars_fragment>",
  };
  stone.onBeforeCompile(shader, {});
  assert.ok(shader.fragmentShader.includes("#define RE_Direct RE_Direct_PoolStone"));
  assert.ok(shader.fragmentShader.includes("RE_Direct_Physical(throughWater"));
  assert.ok(shader.fragmentShader.includes("poolLightThroughWater(poolStonePosition"));
  assert.ok(shader.fragmentShader.includes("poolSubmerged(poolStonePosition)"), "wet stone darkens under water");
  assert.equal(shader.uniforms.poolHeightfield.value, pool.texture);
  assert.deepEqual(shader.uniforms.poolAbsorption.value.toArray(), [2, 0.9, 1]);
  assert.ok(stone.customProgramCacheKey().includes("pool-caustics-v1"));
  assert.equal(pool.evidence().caustics.receivers, 1);
  pool.dispose();
  assert.equal(stone.onBeforeCompile, original);
  assert.equal(stone.customProgramCacheKey, originalKey);
  stone.dispose();
});

test("the water surface takes the ripples only where the solver's slope is, keeping its own derivatives", () => {
  const pool = createOnsenWater(),
    water = new THREE.MeshPhysicalMaterial({ name: "onsen turquoise" });
  pool.bindMaterial(water);
  const shader = {
    uniforms: {},
    vertexShader: "#include <begin_vertex>\n#include <project_vertex>",
    fragmentShader: "#include <normal_fragment_maps>",
  };
  water.onBeforeCompile(shader, {});
  assert.ok(shader.fragmentShader.includes("-poolSample.y,1.,-poolSample.z"));
  assert.ok(shader.fragmentShader.includes("poolRippleSlope(simulatedPoolXZ,poolRippleShare(poolSample))"));
  assert.ok(!shader.fragmentShader.includes("vec2 ripple"), "no authored normal field");
  // The share is the simulated slope over the full-height slope, so a flat field adds nothing.
  assert.ok(poolRippleGLSL.includes("if (share <= 0.) return vec2(0.);"));
  assert.ok(poolCausticGLSL.includes("poolRippleHessian(entry, poolRippleShare(samplePool(entry)), lens)"));
  pool.dispose();
  water.dispose();
});
