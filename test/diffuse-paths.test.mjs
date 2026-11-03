import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { diffusePathDirection } from "../assets/js/home-scene/diffuse-paths.mjs";
import { createStaticLightField } from "../assets/js/home-scene/static-light-field.mjs";

const immediate = () => Promise.resolve();
const regions = [{ id: "corner", min: [-0.8, 0.2, -0.8], max: [0.8, 1.5, 0.8] }];
const sky = { zenith: [1, 1, 1], horizon: [1, 1, 1], ground: [1, 1, 1], practicalPowers: [] };
const signature = "a".repeat(64);

function corner(color = 0xffffff) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  for (const [size, position] of [
    [
      [30, 0.1, 30],
      [0, -0.1, 0],
    ],
    [
      [0.1, 3, 4],
      [-2, 1.5, 0],
    ],
    [
      [4, 3, 0.1],
      [0, 1.5, -2],
    ],
    [
      [4, 0.1, 4],
      [0, 3, 0],
    ],
  ]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    group.add(mesh);
  }
  return group;
}

const skyDc = (snapshot, probe, channel = 0) => {
  const sources = 3;
  return [0, 1, 2].reduce((sum, source) => sum + snapshot.transport[(probe * sources + source) * 12 + channel], 0);
};

test("deeper diffuse directions are deterministic unit vectors with the cosine-weighted hemisphere's expected mean", () => {
  for (const normal of [
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, -1],
  ]) {
    let cosine = 0;
    for (let seed = 0; seed < 12000; seed++) {
      const d = diffusePathDirection(normal, seed);
      assert.deepEqual(d, diffusePathDirection(normal, seed));
      assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-12);
      const dot = d.reduce((sum, value, axis) => sum + value * normal[axis], 0);
      assert.ok(dot > 0 && dot <= 1);
      cosine += dot;
    }
    assert.ok(Math.abs(cosine / 12000 - 2 / 3) < 0.01);
  }
});

test("additional baked reflections brighten an open diffuse corner without creating energy or visitor tracing", async () => {
  const snapshots = [];
  for (const maxDiffuseBounces of [1, 2, 3]) {
    const field = createStaticLightField({ regions, raysPerProbe: 64, skyRaysPerHit: 8, maxDiffuseBounces });
    field.addRoot(corner());
    field.setLighting(sky);
    await field.bake({ yieldTask: immediate });
    const snapshot = field.exportSnapshot({ signature });
    assert.equal(field.evidence().rejectedProbes, 0);
    assert.equal(field.evidence().maxDiffuseBounces, maxDiffuseBounces);
    const trace = field.evidence().trace.rays;
    field.setLighting({ ...sky, zenith: [0.3, 0.6, 0.9] });
    assert.equal(field.evidence().trace.rays, trace);
    assert.equal(field.evidence().acceleratorRetainedBytes, 0);
    for (let probe = 0; probe < 8; probe++) {
      for (let channel = 0; channel < 3; channel++) {
        const mean = skyDc(snapshot, probe, channel);
        assert.ok(mean >= 0 && mean <= Math.PI + 1e-6, "unit-radiance white furnace bounds the angular mean");
      }
      if (snapshots.length) assert.ok(skyDc(snapshot, probe) >= skyDc(snapshots.at(-1), probe) - 1e-12);
    }
    snapshots.push(snapshot);
    field.dispose();
  }
  const total = (snapshot) => Array.from({ length: 8 }, (_, probe) => skyDc(snapshot, probe)).reduce((sum, value) => sum + value, 0);
  assert.ok(total(snapshots[1]) > total(snapshots[0]) * 1.03);
  assert.ok(total(snapshots[2]) > total(snapshots[1]) * 1.01);
  assert.equal(snapshots[2].transport.length, snapshots[0].transport.length, "extra paths use the same bounded source basis");
  assert.equal(snapshots[2].moments.length, snapshots[0].moments.length, "the shader's visibility/texture budget is unchanged");
});

test("a closed zero-thickness shell cannot acquire sky through a diffuse edge offset", async () => {
  const geometry = new THREE.BoxGeometry(4, 4, 4);
  const index = geometry.index;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    index.setX(i, index.getX(i + 2));
    index.setX(i + 2, a);
  }
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const shell = new THREE.Mesh(geometry, material);
  const field = createStaticLightField({ regions: [{ id: "thin-shell", min: [-0.8, -0.8, -0.8], max: [0.8, 0.8, 0.8] }], maxDiffuseBounces: 3 });
  field.addRoot(shell);
  field.setLighting(sky);
  await field.bake({ yieldTask: immediate });
  assert.equal(field.evidence().rejectedProbes, 0);
  assert.equal(field.evidence().secondaryEscapes, 0, "an offset must not move the outgoing origin through a neighboring wall");
  assert.ok(field.sample([0, 0, 0], [0, 0, 1]).irradiance.every((value) => value < 1e-10));
  field.dispose();
  geometry.dispose();
  material.dispose();
});

test("black surfaces add no indirect energy and a sealed room remains dark with three diffuse surfaces", async () => {
  const original = createStaticLightField({ regions, maxDiffuseBounces: 1 });
  const deep = createStaticLightField({ regions, maxDiffuseBounces: 3 });
  for (const field of [original, deep]) {
    field.addRoot(corner(0));
    field.setLighting(sky);
    await field.bake({ yieldTask: immediate });
  }
  assert.deepEqual(original.exportSnapshot({ signature }).transport, deep.exportSnapshot({ signature }).transport);
  original.dispose();
  deep.dispose();
  const sealed = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  for (const [size, position] of [
    [
      [4, 0.1, 4],
      [0, 0, 0],
    ],
    [
      [4, 0.1, 4],
      [0, 3, 0],
    ],
    [
      [0.1, 3, 4],
      [-2, 1.5, 0],
    ],
    [
      [0.1, 3, 4],
      [2, 1.5, 0],
    ],
    [
      [4, 3, 0.1],
      [0, 1.5, -2],
    ],
    [
      [4, 3, 0.1],
      [0, 1.5, 2],
    ],
  ]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    wall.position.set(...position);
    sealed.add(wall);
  }
  const field = createStaticLightField({ regions, maxDiffuseBounces: 3 });
  field.addRoot(sealed);
  field.setLighting(sky);
  await field.bake({ yieldTask: immediate });
  assert.equal(field.evidence().rejectedProbes, 0);
  assert.ok(
    field.exportSnapshot({ signature }).transport.every((value) => value === 0),
    "extra bounces cannot shine through closed walls"
  );
  field.dispose();
});

test("a multi-bounce cache restores exactly and rejects a different bounce depth", async () => {
  const original = createStaticLightField({ regions, maxDiffuseBounces: 3 });
  original.addRoot(corner(0xbcbcbc));
  original.setLighting(sky);
  await original.bake({ yieldTask: immediate });
  const snapshot = original.exportSnapshot({ signature });
  const restored = createStaticLightField({ regions, maxDiffuseBounces: 3 });
  assert.equal(restored.restoreSnapshot(snapshot, { signature }), true);
  restored.setLighting(sky);
  assert.deepEqual(restored.sample([0, 1, 0], [0, 1, 0]), original.sample([0, 1, 0], [0, 1, 0]));
  assert.equal(restored.evidence().trace.rays ?? 0, 0);
  const mismatched = createStaticLightField({ regions, maxDiffuseBounces: 1 });
  assert.equal(mismatched.restoreSnapshot(snapshot, { signature }), false);
  for (const field of [original, restored, mismatched]) field.dispose();
  for (const maxDiffuseBounces of [0, 4, 1.5, Infinity, NaN]) assert.throws(() => createStaticLightField({ maxDiffuseBounces }), /diffuse bounces/);
});

test("daylight path depth preserves the original practical basis, power linearity and traced wall blocking", async () => {
  const source = { id: "lamp", position: [0.7, 2, 0.6], color: [1, 0.6, 0.3], emitterRadius: 0.1 };
  const field = createStaticLightField({ regions, practicalSources: [source], maxDiffuseBounces: 3 });
  field.addRoot(corner(0xbcbcbc));
  field.setLighting({ zenith: [0, 0, 0], horizon: [0, 0, 0], ground: [0, 0, 0], practicalPowers: [1] });
  await field.bake({ yieldTask: immediate });
  const first = createStaticLightField({ regions, practicalSources: [source], maxDiffuseBounces: 1 });
  first.addRoot(corner(0xbcbcbc));
  await first.bake({ yieldTask: immediate });
  const firstTransport = first.exportSnapshot({ signature }).transport,
    deeperTransport = field.exportSnapshot({ signature }).transport;
  for (let probe = 0; probe < 8; probe++)
    assert.deepEqual(
      deeperTransport.slice((probe * 4 + 3) * 12, (probe * 4 + 4) * 12),
      firstTransport.slice((probe * 4 + 3) * 12, (probe * 4 + 4) * 12)
    );
  assert.equal(field.evidence().practicalDiffuseBounces, 1);
  first.dispose();
  const one = field.sample([0, 1, 0], [0, 1, 0]).irradiance;
  assert.ok(one.every((value) => value > 0));
  const rays = field.evidence().trace.rays;
  field.setPracticalPowers([2]);
  field.sample([0, 1, 0], [0, 1, 0]).irradiance.forEach((value, channel) => assert.ok(Math.abs(value - one[channel] * 2) < 1e-12));
  assert.equal(field.evidence().trace.rays, rays);
  field.dispose();

  const blocked = createStaticLightField({
    regions,
    practicalSources: [{ ...source, position: [-4, 2, -4], emitterRadius: 0 }],
    maxDiffuseBounces: 3,
  });
  const room = corner(0xbcbcbc);
  // The two meeting opaque back walls separate every room surface from this source.
  const closure = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 4), new THREE.MeshStandardMaterial({ color: 0xbcbcbc }));
  closure.position.set(2, 1.5, 0);
  room.add(closure);
  const front = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.1), new THREE.MeshStandardMaterial({ color: 0xbcbcbc }));
  front.position.set(0, 1.5, 2);
  room.add(front);
  // The open-corner fixture's floor top is 5 cm below its wall bottoms.
  // Close that real aperture too; a sealed-wall assertion must not hide a gap.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 4), new THREE.MeshStandardMaterial({ color: 0xbcbcbc }));
  room.add(floor);
  blocked.addRoot(room);
  blocked.setLighting({ zenith: [0, 0, 0], horizon: [0, 0, 0], ground: [0, 0, 0], practicalPowers: [1] });
  await blocked.bake({ yieldTask: immediate });
  assert.deepEqual(blocked.sample([0, 1, 0], [0, 1, 0]).irradiance, [0, 0, 0]);
  blocked.dispose();
});

test("deeper practical paths require explicit selection and cannot restore a daylight-only cache", async () => {
  const source = { id: "lamp", position: [0.7, 2, 0.6], color: [1, 0.6, 0.3], emitterRadius: 0.1 },
    fields = [];
  for (const bouncePracticals of [false, true]) {
    const field = createStaticLightField({ regions, practicalSources: [source], maxDiffuseBounces: 3, bouncePracticals });
    field.addRoot(corner(0xbcbcbc));
    await field.bake({ yieldTask: immediate });
    fields.push(field);
  }
  assert.ok(fields[1].evidence().practicalEnergy[0].unitDC > fields[0].evidence().practicalEnergy[0].unitDC);
  assert.equal(fields[1].evidence().practicalDiffuseBounces, 3);
  const restored = createStaticLightField({ regions, practicalSources: [source], maxDiffuseBounces: 3, bouncePracticals: true });
  assert.equal(restored.restoreSnapshot(fields[0].exportSnapshot({ signature }), { signature }), false);
  for (const field of [...fields, restored]) field.dispose();
});
