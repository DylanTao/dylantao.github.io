import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import {
  accumulateL1,
  createTriangleBVH,
  deringL1,
  evaluateL1,
  octDirection,
  octEncode,
  pointAttenuation,
  sphereQuadrature,
} from "../assets/js/home-scene/light-trace-core.mjs";
import {
  createStaticLightField,
  sampleOctahedralMoments,
  STATIC_LIGHT_REGIONS,
  staticLightRegions,
} from "../assets/js/home-scene/static-light-field.mjs";

const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
const regions = [{ id: "test", min: [-0.8, 0.15, -0.8], max: [0.8, 1.5, 0.8] }];
const lighting = { zenith: [1, 1, 1], horizon: [1, 1, 1], ground: [1, 1, 1], practicalPowers: [] };
const immediate = () => Promise.resolve();
const snapshotSignature = "a".repeat(64);

test("octahedral moments interpolate the first and second moment together with nonnegative variance", () => {
  const side = 4,
    data = new Float32Array(side * side * 4);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const mean = 1 + x * 0.2 + y * 0.3,
        at = (y * side + x) * 4;
      data[at] = mean;
      data[at + 1] = mean * mean + 0.02;
    }
  const exact = sampleOctahedralMoments(data, 0, side, [1.5 / side, 2.5 / side]);
  close(exact[0], 1.8);
  close(exact[1], 1.8 ** 2 + 0.02);
  const mixed = sampleOctahedralMoments(data, 0, side, [0.5, 0.5]);
  close(mixed[0], 1.75);
  assert.ok(mixed[1] - mixed[0] ** 2 >= 0.02, "mixing moments retains within-texel and between-texel variance");
  const boundary = 2 / side,
    before = sampleOctahedralMoments(data, 0, side, [boundary - 1e-7, 0.45]),
    after = sampleOctahedralMoments(data, 0, side, [boundary + 1e-7, 0.45]);
  before.forEach((value, channel) => close(value, after[channel], 2e-6));
});

test("moment filtering wraps every octahedral seam and corner without reading an adjacent probe", () => {
  const side = 8,
    data = new Float32Array(2 * side * side * 4);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const mean = 2 + x * 0.4 + y * 0.7,
        at = (y * side + x) * 4,
        other = at + side * side * 4;
      data[at] = mean;
      data[at + 1] = mean * mean + 0.1;
      data[other] = 1000;
      data[other + 1] = 1e6;
    }
  for (const [a, b] of [
    [
      [0, 0.23],
      [0, 0.77],
    ],
    [
      [1, 0.23],
      [1, 0.77],
    ],
    [
      [0.23, 0],
      [0.77, 0],
    ],
    [
      [0.23, 1],
      [0.77, 1],
    ],
    [
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [1, 1],
    ],
  ]) {
    const first = sampleOctahedralMoments(data, 0, side, a),
      second = sampleOctahedralMoments(data, 0, side, b);
    first.forEach((value, channel) => close(value, second[channel]));
    assert.ok(first[0] < 10 && first[1] < 100, "the vertically adjacent probe's large moments cannot bleed into this one");
  }
  const epsilon = 1e-8;
  for (const [a, b] of [
    [
      [-1, epsilon, -1],
      [-1, -epsilon, -1],
    ],
    [
      [1, epsilon, -1],
      [1, -epsilon, -1],
    ],
    [
      [epsilon, -1, -1],
      [-epsilon, -1, -1],
    ],
    [
      [epsilon, 1, -1],
      [-epsilon, 1, -1],
    ],
  ]) {
    const first = sampleOctahedralMoments(data, 0, side, octEncode(a)),
      second = sampleOctahedralMoments(data, 0, side, octEncode(b));
    first.forEach((value, channel) => close(value, second[channel], 1e-5));
  }
});

test("the two bathroom storeys receive separate authored light cages within the existing probe budget", async () => {
  const config = {
    rooms: [
      { id: "bath-living", lightRegion: { min: [-8.25, 0, 1.85], max: [-4.4, 2.35, 6.1] } },
      { id: "bath-bedroom", lightRegion: { min: [-8.25, 2.6, 1.85], max: [-4.4, 4.95, 6.1] } },
    ],
  };
  const cages = staticLightRegions(config);
  assert.equal(cages.length, STATIC_LIGHT_REGIONS.length + 2);
  const field = createStaticLightField({ regions: cages, raysPerProbe: 16, skyRaysPerHit: 2 });
  field.setLighting(lighting);
  await field.bake({ yieldTask: immediate });
  for (const [id, height] of [
    ["bath-living", 1.15],
    ["bath-bedroom", 3.75],
  ]) {
    const sample = field.sample([-6.3, height, 4], [0, 1, 0]);
    assert.equal(sample.fallback, false);
    assert.deepEqual(sample.contributingRegions, [id]);
    sample.irradiance.forEach((value) => close(value, Math.PI));
  }
  assert.throws(() => createStaticLightField({ regions: Array.from({ length: 17 }, (_, i) => cages[i % cages.length]) }), /1\.\.16 regions/);
  field.dispose();
});

test("precomputed transport preserves sampled sky and practical relighting without tracing visitor rays", async () => {
  const practicalSources = [{ id: "lamp", position: [0, 1.4, 0], color: [1, 0.7, 0.4], light: new THREE.PointLight() }],
    floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0xc6a886 }));
  floor.position.y = -0.1;
  const original = createStaticLightField({ regions, practicalSources, raysPerProbe: 16, skyRaysPerHit: 2 });
  original.addRoot(floor);
  await original.bake({ yieldTask: immediate });
  const snapshot = JSON.parse(JSON.stringify(original.exportSnapshot({ signature: snapshotSignature }))),
    restored = createStaticLightField({
      regions,
      practicalSources: practicalSources.map((source) => ({ ...source, light: new THREE.PointLight() })),
      raysPerProbe: 16,
      skyRaysPerHit: 2,
    });
  assert.equal(restored.restoreSnapshot(snapshot, { signature: snapshotSignature }), true);
  assert.equal(restored.evidence().cacheHit, true);
  assert.equal(restored.evidence().trace.rays ?? 0, 0);
  assert.equal(restored.evidence().bakeMs, 0);
  for (const powers of [0, 0.6, 2]) {
    const live = { zenith: [0.12, 0.25, 0.4], horizon: [0.6, 0.4, 0.2], ground: [0.1, 0.1, 0.1], practicalPowers: [powers] };
    original.setLighting(live);
    restored.setLighting(live);
    for (const normal of [
      [0, 1, 0],
      [0.7, 0.7, 0],
      [0, 0, 1],
    ])
      assert.deepEqual(restored.sample([0.1, 0.6, -0.2], normal), original.sample([0.1, 0.6, -0.2], normal));
  }
  original.dispose();
  restored.dispose();
});

test("the expanded house retains bounded transport storage without adding analytic fragment lights", () => {
  const cages = Array.from({ length: 16 }, (_, i) => ({ id: `cage-${i}`, min: [i * 2, 0, 0], max: [i * 2 + 1, 2, 1] }));
  const practicalSources = Array.from({ length: 26 }, (_, i) => ({ id: `cove-${i}`, position: [i, 1.5, 0.5], color: [1, 0.7, 0.4] }));
  const field = createStaticLightField({ regions: cages, practicalSources, raysPerProbe: 16, skyRaysPerHit: 2 });
  assert.equal(field.evidence().regions.length, 16);
  field.dispose();
});

test("four bounded cove channels add occluded indirect bounce to closed bathroom storeys and restore exactly", async () => {
  const cages = [
    { id: "lower", min: [-1, 0.2, -1], max: [1, 2.1, 1] },
    { id: "upper", min: [-1, 2.8, -1], max: [1, 4.7, 1] },
  ];
  const coves = [0, 2.6].flatMap((floor, storey) => [
    {
      id: `mirror-${storey}`,
      position: [-1.7, floor + 2.16, 0],
      color: [1, 0.7, 0.42],
      emitterRadius: 0.04,
      region: { min: [-2.05, floor - 0.05, -2.05], max: [2.05, floor + 2.4, 2.05] },
    },
    {
      id: `shower-${storey}`,
      position: [0, floor + 2.24, -1.75],
      color: [1, 0.7, 0.42],
      emitterRadius: 0.04,
      region: { min: [-2.05, floor - 0.05, -2.05], max: [2.05, floor + 2.4, 2.05] },
    },
  ]);
  const sources = [...Array.from({ length: 8 }, (_, index) => ({ id: `existing-${index}`, position: [100, 100, 100] })), ...coves];
  const closedRoom = (floor) => {
    const room = new THREE.Mesh(new THREE.BoxGeometry(4, 2.35, 4), new THREE.MeshStandardMaterial({ color: 0xe3d2b8 }));
    room.position.y = floor + 1.175;
    const index = room.geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      const first = index.getX(i);
      index.setX(i, index.getX(i + 2));
      index.setX(i + 2, first);
    }
    return room;
  };
  const scene = new THREE.Group();
  scene.add(closedRoom(0), closedRoom(2.6));
  const options = { regions: cages, practicalSources: sources, raysPerProbe: 64, skyRaysPerHit: 2 },
    field = createStaticLightField(options);
  field.addRoot(scene);
  field.setLighting({ ...lighting, practicalPowers: sources.map(() => 0) });
  await field.bake({ yieldTask: immediate });
  const query = [
      [0, 0.7, 0],
      [0, 1, 0],
    ],
    upperQuery = [
      [0, 3.3, 0],
      [0, 1, 0],
    ];
  assert.ok(
    field.sample(...query).irradiance.every((value) => value < 1e-6),
    "closed shells receive no unoccluded sky fill"
  );
  const rays = field.evidence().trace.rays,
    powers = [...Array(8).fill(0), 0.924, 1.4716, 0, 0];
  field.setPracticalPowers(powers);
  const first = field.sample(...query).irradiance;
  assert.ok(first[0] > 0.001, `actual albedo bounce reaches the lower bathroom: ${first}`);
  assert.ok(
    field.sample(...upperQuery).irradiance.every((value) => value < 1e-8),
    "the upper storey cannot receive the lower cove's bounce"
  );
  field.setPracticalPowers(powers.map((power) => power * 2));
  field.sample(...query).irradiance.forEach((value, channel) => close(value, first[channel] * 2));
  assert.equal(field.evidence().trace.rays, rays, "changing the visit traces no visitor rays");
  const snapshot = JSON.parse(JSON.stringify(field.exportSnapshot({ signature: snapshotSignature }))),
    restored = createStaticLightField(options);
  assert.equal(restored.restoreSnapshot(snapshot, { signature: snapshotSignature }), true);
  restored.setLighting({ ...lighting, practicalPowers: powers.map((power) => power * 2) });
  assert.deepEqual(restored.sample(...query), field.sample(...query));
  assert.equal(restored.evidence().trace.rays ?? 0, 0);
  const incompatible = createStaticLightField({
    ...options,
    practicalSources: sources.map((source, index) => (index === 8 ? { ...source, region: { ...source.region, max: [3, 2.4, 3] } } : source)),
  });
  assert.equal(
    incompatible.restoreSnapshot(snapshot, { signature: snapshotSignature }),
    false,
    "source bounds participate in snapshot compatibility"
  );
  const blocked = createStaticLightField(options);
  for (const source of coves.slice(0, 2)) {
    const shade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0 }));
    shade.position.fromArray(source.position);
    scene.add(shade);
  }
  blocked.addRoot(scene);
  blocked.setLighting({ ...lighting, practicalPowers: powers });
  await blocked.bake({ yieldTask: immediate });
  assert.ok(
    blocked.sample(...query).irradiance.every((value) => value < 1e-8),
    "opaque geometry blocks every practical transport path"
  );
  assert.throws(
    () => createStaticLightField({ ...options, practicalSources: Array.from({ length: 27 }, (_, i) => sources[i % sources.length]) }),
    /at most 26 practicals/
  );
  for (const item of [field, restored, incompatible, blocked]) item.dispose();
  scene.traverse((object) => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
});

test("stale, incompatible and corrupt precomputed fields reject atomically and retain the live bake fallback", async () => {
  const original = createStaticLightField({ regions, raysPerProbe: 16 });
  await original.bake({ yieldTask: immediate });
  const snapshot = original.exportSnapshot({ signature: snapshotSignature });
  const changes = [
    (s) => (s.version = 99),
    (s) => (s.signature = "b".repeat(64)),
    (s) => (s.configuration += "stale"),
    (s) => s.transport.pop(),
    (s) => (s.transport[0] = NaN),
    (s) => (s.transport[0] = 1e100),
    (s) => (s.moments[0] = 1e100),
    (s) => (s.probes[0].valid = "yes"),
    (s) => (s.probes[0].position[0] = Infinity),
  ];
  for (const change of changes) {
    const field = createStaticLightField({ regions, raysPerProbe: 16 }),
      broken = structuredClone(snapshot);
    change(broken);
    assert.equal(field.restoreSnapshot(broken, { signature: snapshotSignature }), false);
    assert.equal(field.evidence().ready, false);
    field.setLighting(lighting);
    await field.bake({ yieldTask: immediate });
    field.sample([0, 0.7, 0], [0, 1, 0]).irradiance.forEach((value) => close(value, Math.PI));
    field.dispose();
  }
  const changedSampling = createStaticLightField({ regions, raysPerProbe: 64 });
  assert.equal(changedSampling.restoreSnapshot(snapshot, { signature: snapshotSignature }), false);
  changedSampling.dispose();
  original.dispose();
});

test("octahedral solid-angle quadrature preserves constant radiance and symmetry", () => {
  const rays = sphereQuadrature(),
    coefficients = new Float64Array(12);
  close(
    rays.reduce((s, r) => s + r.weight, 0),
    4 * Math.PI,
    1e-12
  );
  for (const r of rays) accumulateL1(coefficients, 0, [0.2, 0.5, 1], r.direction, r.weight);
  for (const n of [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ])
    evaluateL1(coefficients, n).forEach((v, c) => close(v, [0.2, 0.5, 1][c] * Math.PI, 1e-12));
  for (const r of rays) {
    const uv = octEncode(r.direction),
      decoded = octDirection(uv[0] * 2 - 1, uv[1] * 2 - 1);
    decoded.forEach((x, a) => close(x, r.direction[a], 1e-12));
  }
});

test("directional deringing is nonnegative and preserves angular-mean energy", () => {
  const coefficients = new Float64Array([1, 2, 3, 5, 6, 7, 4, 3, 2, -8, -5, -2]),
    dc = coefficients.slice(0, 3);
  deringL1(coefficients);
  assert.deepEqual(coefficients.slice(0, 3), dc);
  for (const r of sphereQuadrature(16)) assert.ok(evaluateL1(coefficients, r.direction).every((x) => x >= 0 && Number.isFinite(x)));
  for (let c = 0; c < 3; c++) close(Math.hypot(coefficients[3 + c], coefficients[6 + c], coefficients[9 + c]), dc[c], 1e-12);
});

test("original BVH agrees with native double-sided ray hits including parallel slabs", async () => {
  const root = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2).toNonIndexed(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  root.geometry.translate(0, 1, 0);
  const positions = root.geometry.attributes.position.array,
    accelerator = await createTriangleBVH(positions, new Float32Array((positions.length / 9) * 3).fill(0.5));
  const native = new THREE.Raycaster();
  for (const origin of [
    [3, 1, 0],
    [0, 4, 0],
    [0, 1, 0],
    [3, 3, 3],
    [2, 1, 2],
  ])
    for (const target of [
      [0, 1, 0],
      [0, 2, 0],
      [-2, 1, 0],
    ]) {
      const d = new THREE.Vector3(...target).sub(new THREE.Vector3(...origin)).normalize();
      native.set(new THREE.Vector3(...origin), d);
      native.near = 0.001;
      native.far = 20;
      const a = accelerator.ray(origin, d.toArray(), 20),
        b = native.intersectObject(root)[0];
      assert.equal(!!a, !!b);
      if (a) close(a.distance, b.distance, 1e-6);
    }
  assert.ok(accelerator.evidence().triangleTests < accelerator.evidence().rays * accelerator.count);
});

test("empty field recovers Ï€ radiance, deterministic coefficients and no lighting-update rays", async () => {
  const make = async () => {
    const field = createStaticLightField({ regions });
    field.setLighting(lighting);
    await field.bake({ yieldTask: immediate });
    return field;
  };
  const a = await make(),
    b = await make(),
    query = [
      [0, 0.7, 0],
      [0, 1, 0],
    ];
  a.sample(...query).irradiance.forEach((x) => close(x, Math.PI));
  assert.deepEqual(a.sample(...query), b.sample(...query));
  const before = a.evidence().trace.rays;
  a.setLighting({ ...lighting, zenith: [0.25, 0.5, 1] });
  assert.equal(a.evidence().trace.rays, before);
  assert.equal(a.setLighting({ ...lighting, zenith: [0.25, 0.5, 1] }), false);
  a.dispose();
  b.dispose();
});

test("closed opaque room blocks sky and rejected embedded probes cannot become a skylight", async () => {
  const room = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
  room.position.y = 1;
  // A room shell must have its native authored normals facing into empty space.
  const index = room.geometry.index;
  for (let i = 0; i < index.count; i += 3) {
    const j = index.getX(i);
    index.setX(i, index.getX(i + 2));
    index.setX(i + 2, j);
  }
  const field = createStaticLightField({ regions });
  field.addRoot(room);
  field.setLighting(lighting);
  await field.bake({ yieldTask: immediate });
  assert.ok(field.evidence().probes.every((p) => p.valid));
  assert.ok(field.sample([0, 0.7, 0], [0, 1, 0]).irradiance.every((x) => x < 1e-6));
  for (const boundary of [0.8, 1.05]) {
    const left = field.sample([boundary - 1e-6, 0.7, 0], [0, 1, 0]).irradiance;
    const right = field.sample([boundary + 1e-6, 0.7, 0], [0, 1, 0]).irradiance;
    left.forEach((x, c) => close(x, right[c], 1e-8));
  }
  field.dispose();
  const solid = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  solid.position.y = 1;
  const rejected = createStaticLightField({ regions });
  rejected.addRoot(solid);
  rejected.setLighting(lighting);
  await rejected.bake({ yieldTask: immediate });
  assert.equal(rejected.evidence().rejectedProbes, 8);
  assert.deepEqual(rejected.sample([0, 0.7, 0], [0, 1, 0]).irradiance, [0, 0, 0]);
  rejected.dispose();
});

test("authored room floors and terrace receive traced cages with continuous region overlap", async () => {
  const field = createStaticLightField();
  field.setLighting(lighting);
  await field.bake({ yieldTask: immediate });
  for (const region of STATIC_LIGHT_REGIONS) {
    const floor = region.id === "study" || region.id === "sleep" || region.id === "onsen" ? 2.6 : 0;
    const point = [(region.min[0] + region.max[0]) * 0.5, floor, (region.min[2] + region.max[2]) * 0.5],
      sample = field.sample(point, [0, 1, 0]);
    assert.equal(sample.fallback, false);
    assert.equal(sample.coverage, 1);
    sample.irradiance.forEach((x) => close(x, Math.PI));
  }
  const overlap = field.sample([3, 0.2, -3.85], [0, 1, 0]);
  assert.ok(overlap.contributingRegions.includes("lounge"));
  assert.ok(overlap.contributingRegions.includes("nearhouse"));
  overlap.irradiance.forEach((x) => close(x, Math.PI));
  field.dispose();
});

test("unit practical bounce scales with power and a geometric wall blocks it", async () => {
  async function make(blocked) {
    const scene = new THREE.Group(),
      floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ color: 0x808080 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    if (blocked) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 0.02, 4), new THREE.MeshStandardMaterial({ color: 0x000000 }));
      wall.position.y = 1.6;
      scene.add(wall);
    }
    const field = createStaticLightField({ regions, practicalSources: [{ id: "lamp", position: [0, 2, 0], color: [1, 0.5, 0.25], distance: 5 }] });
    field.addRoot(scene);
    field.setLighting({ zenith: [0, 0, 0], horizon: [0, 0, 0], ground: [0, 0, 0], practicalPowers: [1] });
    await field.bake({ yieldTask: immediate });
    return field;
  }
  const clear = await make(false),
    blocked = await make(true),
    p = [0, 0.5, 0],
    n = [0, -1, 0],
    first = clear.sample(p, n).irradiance;
  assert.ok(first[0] > 0.001);
  close(first[0], first[1] * 2);
  close(first[0], first[2] * 4);
  clear.setLighting({ zenith: [0, 0, 0], horizon: [0, 0, 0], ground: [0, 0, 0], practicalPowers: [2] });
  clear.sample(p, n).irradiance.forEach((x, c) => close(x, first[c] * 2));
  assert.ok(blocked.sample(p, n).irradiance.every((x) => x < 1e-8));
  close(pointAttenuation(2, 0), 0.25);
  close(pointAttenuation(5, 5), 0);
  clear.dispose();
  blocked.dispose();
});

test("transparent geometry does not block native sky or become a diffuse bounce receiver", async () => {
  const glass = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshPhysicalMaterial({ transmission: 0.96, color: 0x00ff00 }));
  const field = createStaticLightField({ regions });
  field.addRoot(glass);
  field.setLighting(lighting);
  await field.bake({ yieldTask: immediate });
  assert.equal(field.evidence().triangles, 0);
  field.sample([0, 0.7, 0], [0, 1, 0]).irradiance.forEach((x) => close(x, Math.PI));
  field.dispose();
});

test("static triangles follow native draw ranges and single versus grouped material submission", async () => {
  for (const [start, count, grouped, clearGroups, expected] of [
    [0, 0, false, false, 0],
    [6, 6, false, false, 2],
    [3, 6, true, false, 2],
    [0, Infinity, false, true, 12],
    [0, Infinity, true, true, 0],
  ]) {
    const geometry = new THREE.BoxGeometry(4, 4, 4),
      material = new THREE.MeshStandardMaterial(),
      mesh = new THREE.Mesh(geometry, grouped ? [material, material, material, material, material, material] : material),
      field = createStaticLightField({ regions });
    geometry.setDrawRange(start, count);
    if (clearGroups) geometry.clearGroups();
    mesh.position.y = 1;
    field.addRoot(mesh);
    field.setLighting(lighting);
    await field.bake({ yieldTask: immediate });
    assert.equal(field.evidence().triangles, expected);
    if (!expected) field.sample([0, 0.7, 0], [0, 1, 0]).irradiance.forEach((x) => close(x, Math.PI));
    field.dispose();
    geometry.dispose();
    material.dispose();
  }
});

test("PBR adapter replaces diffuse environment once and restores pre-existing shader ownership", async () => {
  const field = createStaticLightField({ regions }),
    material = new THREE.MeshPhysicalMaterial({ transmission: 0.5 });
  const previous = (shader) => (shader.fragmentShader = "// previous hook\n" + shader.fragmentShader),
    cache = () => "previous";
  material.onBeforeCompile = previous;
  material.customProgramCacheKey = cache;
  const detach = field.bindMaterial(material);
  assert.equal(field.bindMaterial(material), detach);
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  material.onBeforeCompile(shader, {});
  assert.ok(shader.fragmentShader.startsWith("// previous hook"));
  assert.match(shader.fragmentShader, /irradiance=vec3\(0.0\)/);
  assert.match(shader.fragmentShader, /iblIrradiance=slfIrradiance/);
  assert.match(shader.fragmentShader, /#include <lights_fragment_end>/);
  assert.match(shader.vertexShader, /modelMatrix\*vec4\(transformed,1.0\)/);
  assert.equal(shader.uniforms.slfReady.value, 0);
  await field.bake({ yieldTask: immediate });
  assert.equal(shader.uniforms.slfReady.value, 1);
  assert.equal(field.evidence().acceleratorRetainedBytes, 0);
  detach();
  assert.equal(material.onBeforeCompile, previous);
  assert.equal(material.customProgramCacheKey, cache);
  field.bindMaterial(material);
  material.dispose();
  assert.equal(material.onBeforeCompile, previous);
  field.bindMaterial(material);
  field.dispose();
  assert.equal(material.onBeforeCompile, previous);
  assert.equal(material.customProgramCacheKey, cache);
  assert.equal(field.evidence().disposed, true);
  const replacement = createStaticLightField({ regions });
  replacement.bindMaterial(material);
  const replacementKey = material.customProgramCacheKey();
  replacement.dispose();
  const another = createStaticLightField({ regions });
  another.bindMaterial(material);
  assert.notEqual(material.customProgramCacheKey(), replacementKey);
  another.dispose();
});

test("abort and disposal fail closed without a stale ready completion", async () => {
  const root = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshStandardMaterial());
  const field = createStaticLightField({ regions }),
    abort = new AbortController();
  field.addRoot(root);
  await assert.rejects(field.bake({ signal: abort.signal, yieldTask: async () => abort.abort() }), { name: "AbortError" });
  assert.equal(field.evidence().ready, false);
  field.dispose();
  const other = createStaticLightField({ regions });
  other.addRoot(root);
  await assert.rejects(other.bake({ yieldTask: async () => other.dispose() }), { name: "AbortError" });
  assert.equal(other.evidence().ready, false);
});
