import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createHeightfieldWater } from "../assets/js/home-scene/heightfield-water.mjs";
import { createOnsenWater } from "../assets/js/home-scene/onsen-water.mjs";
import { finishPhysicalMaterial } from "../assets/js/home-scene/realism.mjs";

const close = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`);

test("flat resting basin remains exactly still without manufactured waves", () => {
  const water = createHeightfieldWater(),
    before = water.state.h.slice();
  for (let i = 0; i < 120; i++) water.advance(1 / 60);
  assert.deepEqual(water.state.h, before);
  assert.ok(water.state.u.every((x) => x === 0));
  assert.ok(water.state.v.every((x) => x === 0));
  close(water.evidence().energy, 0, 1e-24);
  assert.equal(water.evidence().boundarySpeed, 0);
  assert.ok(Math.abs(water.evidence().relativeMassError) < 1e-12);
});

test("reflecting standing mode propagates at shallow-water gravity-wave speed", () => {
  const water = createHeightfieldWater({ nx: 64, nz: 8, width: 2, length: 1, radius: null, depth: 0.1, damping: 0 }),
    mode = (i) => Math.cos((Math.PI * (i + 0.5)) / 64),
    period = 4 / Math.sqrt(9.80665 * 0.1),
    amplitude = 0.0001;
  for (let j = 0; j < 8; j++) for (let i = 0; i < 64; i++) water.state.h[j * 64 + i] += amplitude * mode(i);
  const projection = () => (2 / (64 * 8)) * water.state.h.reduce((sum, h, k) => sum + (h - 0.1) * mode(k % 64), 0),
    initialEnergy = water.evidence().energy;
  let peak = initialEnergy;
  for (const fraction of [0.25, 0.5, 1]) {
    const ticks = Math.floor((fraction * period) / (1 / 120));
    while (water.evidence().simulationTime < ticks / 120 - 1e-10) {
      water.advance(1 / 120);
      peak = Math.max(peak, water.evidence().energy);
    }
    close(projection(), amplitude * Math.cos((2 * Math.PI * water.evidence().simulationTime) / period), amplitude * 0.015);
  }
  assert.ok(projection() > amplitude * 0.99, "one reflected period returns the height mode");
  assert.ok(peak < initialEnergy * 1.02, "the unforced scheme cannot grow substantial wave energy");
  assert.equal(water.evidence().boundarySpeed, 0);
});

test("resolved impulse conserves closed-basin volume, travels and dissipates", () => {
  const water = createHeightfieldWater();
  water.disturb({ x: 0.2, z: 0.1, amplitude: 0.008, spread: 0.12 });
  const initial = water.evidence(),
    before = water.state.h.slice();
  let peak = initial.energy;
  for (let i = 0; i < 600; i++) {
    water.advance(1 / 60);
    const e = water.evidence();
    assert.ok(e.finite && e.minimumDepth > 0);
    assert.ok(Math.abs(e.relativeMassError) < 1e-12);
    assert.equal(e.boundarySpeed, 0);
    assert.ok(e.maxCourant <= 0.45);
    peak = Math.max(peak, e.energy);
  }
  assert.notDeepEqual(water.state.h, before);
  assert.ok(peak < initial.energy * 1.02);
  assert.ok(water.evidence().energy < initial.energy * 0.01, "drag and upwind transport dissipate an unforced pulse");
  assert.equal(water.evidence().limitedFluxes, 0);
  assert.equal(water.evidence().limitedVelocities, 0);
});

test("solid torso reflects flow, conservatively displaces volume and refills after departure", () => {
  const water = createHeightfieldWater(),
    volume = water.evidence().volume;
  assert.equal(water.setObstacle({ x: 0, z: -0.1, radius: 0.17 }), true);
  close(water.evidence().volume, volume, 1e-12);
  assert.ok(water.evidence().maximumDepth > 0.24, "a submerged obstacle raises the surface");
  water.disturb({ x: 0.18, z: -0.1, amplitude: 0.012, spread: 0.14 });
  for (let i = 0; i < 180; i++) water.advance(1 / 60);
  assert.equal(water.evidence().boundarySpeed, 0);
  for (let k = 0; k < water.state.h.length; k++) if (!water.state.wet[k]) assert.equal(water.state.h[k], 0);
  water.setObstacle({ x: 0.1, z: -0.1, radius: 0.17 });
  close(water.evidence().volume, volume, 1e-12);
  water.setObstacle(null);
  close(water.evidence().volume, volume, 1e-12);
  assert.equal(water.evidence().wetCells, 1264);
  for (let i = 0; i < 120; i++) water.advance(1 / 60);
  assert.ok(water.evidence().finite && water.evidence().minimumDepth > 0);
});

test("fixed active ticks give matching trajectories across 30, 60 and 144 Hz frames", () => {
  const states = [30, 60, 144].map((hz) => {
    const water = createHeightfieldWater();
    water.disturb({ x: 0.1, z: -0.2 });
    for (let i = 0; i < hz * 2; i++) water.advance(1 / hz);
    close(water.evidence().simulationTime, 2);
    return water.state;
  });
  for (const state of states.slice(1)) for (const key of ["h", "u", "v"]) assert.deepEqual(state[key], states[0][key]);
});

test("zero active time freezes state and slow frames drop time without a recovery backlog", () => {
  const water = createHeightfieldWater();
  water.disturb();
  const before = water.evidence(),
    state = water.state.h.slice();
  assert.equal(water.advance(0), false);
  assert.deepEqual(water.evidence(), before);
  assert.deepEqual(water.state.h, state);
  water.advance(4);
  close(water.evidence().simulationTime, 0.25);
  close(water.evidence().droppedTime, 3.75);
  assert.ok(water.evidence().retainedTime < 1 / 120);
  assert.equal(water.advance(0), false);
  close(water.evidence().simulationTime, 0.25);
});

test("repeated bounded forcing stays positive and finite with closed walls", () => {
  const water = createHeightfieldWater();
  for (let pulse = 0; pulse < 50; pulse++) {
    const theta = pulse * 2.39996323;
    water.disturb({ x: Math.cos(theta) * 0.5, z: Math.sin(theta) * 0.5, amplitude: pulse % 2 ? -0.025 : 0.025, spread: 0.1 });
    water.advance(0.1);
    const e = water.evidence();
    assert.ok(e.finite && e.minimumDepth > 0 && e.maximumDepth < 0.4);
    assert.ok(Math.abs(e.relativeMassError) < 1e-12);
    assert.equal(e.boundarySpeed, 0);
  }
  assert.throws(() => water.disturb({ amplitude: 1 }), RangeError);
  assert.throws(() => water.advance(Infinity), RangeError);
  assert.throws(() => createHeightfieldWater({ nx: 1000 }), RangeError);
  assert.throws(() => createHeightfieldWater({ tick: 1e-9 }), RangeError);
});

test("adapter uses real derivatives, world-scale displacement, existing contact hook and symmetric circular geometry", () => {
  const pool = createOnsenWater(),
    mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()),
    source = new THREE.MeshStandardMaterial({ name: "onsen turquoise" }),
    lighting = { contactTexture: { value: null }, contactResolution: { value: new THREE.Vector2(1, 1) }, contactEnabled: { value: true } },
    material = finishPhysicalMaterial(source, mesh, lighting),
    geometry = pool.surfaceGeometry();
  mesh.scale.set(2, 3, 4);
  pool.bindMaterial(material, mesh);
  close(pool.uniforms.poolLocalUp.value.y, 1 / 3);
  const shader = {
    uniforms: {},
    vertexShader: "#include <begin_vertex>\n#include <project_vertex>",
    fragmentShader: "#include <normal_fragment_maps>\n#include <aomap_fragment>\n#include <lights_fragment_end>",
  };
  material.onBeforeCompile(shader, {});
  assert.ok(shader.vertexShader.includes("transformed+=poolLocalUp*samplePool"));
  assert.ok(shader.fragmentShader.includes("-poolSample.y,1.,-poolSample.z"));
  assert.ok(!shader.fragmentShader.includes("vec2 ripple"), "the authored normal field cannot override the solver");
  assert.ok(shader.fragmentShader.includes("reflectedLight.indirectDiffuse*=contactBounce"));
  assert.equal(shader.uniforms.contactTexture, lighting.contactTexture);
  assert.ok(material.customProgramCacheKey().includes("coastal-indirect-contact-v1"));
  assert.equal(shader.uniforms.poolHeightfield.value, pool.texture);
  assert.equal(pool.texture.minFilter, THREE.NearestFilter);
  assert.equal(pool.texture.colorSpace, THREE.NoColorSpace);
  assert.equal(geometry.getAttribute("position").count, 1921);
  assert.equal(geometry.index.count / 3, 3744);
  const p = geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    close(p.getY(i), 3.0075, 1e-6);
    assert.ok(Math.hypot(p.getX(i) - 3.02, p.getZ(i) + 1.82) <= 0.860001);
  }
  for (let k = 0; k < geometry.index.count; k += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, geometry.index.getX(k)),
      b = new THREE.Vector3().fromBufferAttribute(p, geometry.index.getX(k + 1)),
      c = new THREE.Vector3().fromBufferAttribute(p, geometry.index.getX(k + 2));
    assert.ok(b.sub(a).cross(c.sub(a)).y > 0, "all pool top triangles face up");
  }
  geometry.dispose();
  pool.dispose();
  mesh.geometry.dispose();
  mesh.material.dispose();
  material.dispose();
  source.dispose();
});

test("uploaded world-space slopes agree with a known interior affine height field", () => {
  const water = createHeightfieldWater(),
    { nx, nz, dx, dz } = water.grid;
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (water.state.wet[k]) water.state.h[k] += 0.01 * ((i + 0.5) * dx - 0.86) - 0.02 * ((j + 0.5) * dz - 0.86);
    }
  const texture = water.writeSurface();
  for (let j = 10; j < 30; j++)
    for (let i = 10; i < 30; i++) {
      const k = j * nx + i;
      close(texture[k * 4 + 1], 0.01, 1e-8);
      close(texture[k * 4 + 2], -0.02, 1e-8);
      assert.equal(texture[k * 4 + 3], 1);
    }
  for (let k = 0; k < water.state.wet.length; k++) if (!water.state.wet[k]) assert.equal(texture[k * 4 + 3], 0);
});

test("adapter ignores sub-cell pose noise, freezes uploads, restores material and disposes idempotently", () => {
  const pool = createOnsenWater(),
    material = new THREE.MeshPhysicalMaterial(),
    original = material.onBeforeCompile;
  pool.bindMaterial(material);
  pool.setBather({ x: 3.02, z: -1.92 });
  close(pool.uniforms.poolSolidElevation.value, 0.00988467874794, 1e-12);
  const occupied = pool.evidence(),
    surface = pool.texture.image.data.slice();
  assert.equal(pool.setBather({ x: 3.0201, z: -1.9199 }), false);
  assert.equal(pool.advance(0), false);
  assert.deepEqual(pool.evidence(), occupied);
  assert.deepEqual(pool.texture.image.data, surface);
  pool.disturb({ x: 3.2, z: -1.92 });
  pool.advance(1 / 60);
  assert.ok(pool.evidence().uploads > occupied.uploads);
  pool.dispose();
  pool.dispose();
  assert.equal(material.onBeforeCompile, original);
  assert.equal(pool.advance(1 / 60), false);
  assert.equal(pool.setBather(null), false);
  material.dispose();
});
