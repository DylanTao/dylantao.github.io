import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createGroundPatch } from "../assets/js/home-scene/wildlife-ground-contact.mjs";

function plane(gx = 0, gz = 0, width = 4) {
  const geometry = new THREE.PlaneGeometry(width, width).rotateX(-Math.PI / 2),
    p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, gx * p.getX(i) + gz * p.getZ(i));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.name = "coast_height_bound_fixture";
  return mesh;
}
function patch(roots, margin = 3) {
  const ground = createGroundPatch([[0, 0, 0]], margin);
  ground.capture(roots);
  return ground;
}

test("point queries keep border-cell support without aliasing an outside row or column", () => {
  const ground = patch([plane(0.2, -0.15)], 0.4);
  // The original captured coarse cells extend beyond the exact patch bounds.
  // Preserve that support, while a neighboring cell outside the captured grid
  // must not wrap onto an occupied row or column.
  for (const x of [-0.69, -0.35, -1e-10, 0, 0.35, 0.69])
    for (const z of [-0.69, -0.35, -1e-10, 0, 0.35, 0.69]) {
      const hit = ground.sample(x, z);
      assert.ok(hit, `${x}/${z}`);
      assert.ok(Math.abs(hit.height - (0.2 * x - 0.15 * z)) < 2e-8);
    }
  for (const [x, z] of [
    [-0.71, 0],
    [0.71, 0],
    [0, -0.71],
    [0, 0.71],
    [-0.1, -1.05],
    [0.1, 1.05],
    [NaN, 0],
    [0, Infinity],
  ])
    assert.equal(ground.sample(x, z), null, `${x}/${z}`);
});

test("point indexing handles negative coordinates and unsafe grid dimensions", () => {
  const mesh = plane(0.2, -0.15);
  mesh.position.set(-7, 0.3, -10.5);
  const negative = createGroundPatch([[-7, 0.3, -10.5]], 0.4);
  negative.capture([mesh]);
  for (const x of [-0.69, -0.35, 0, 0.35, 0.69])
    for (const z of [-0.69, -0.35, 0, 0.35, 0.69]) {
      const hit = negative.sample(x - 7, z - 10.5);
      assert.ok(hit);
      assert.ok(Math.abs(hit.height - (0.2 * x - 0.15 * z + 0.3)) < 2e-8);
    }
  const roots = [plane(-0.18, 0.12)],
    ordinary = patch(roots),
    wide = createGroundPatch([
      [-1e9, 0, -1e9],
      [1e9, 0, 1e9],
    ]);
  wide.capture(roots);
  for (const x of [-1, -0.35, 0, 0.35, 1]) for (const z of [-1, -0.35, 0, 0.35, 1]) assert.deepEqual(wide.sample(x, z), ordinary.sample(x, z));
  assert.equal(wide.sample(3, 3), null);
});

test("an exact point query cache respects surface thresholds, coordinates and live visibility", () => {
  const low = plane(0.2, -0.15),
    high = plane(0.2, -0.15),
    ground = patch([low]),
    cache = {};
  high.position.y = 0.7;
  // Recapture the translated surface in a fresh patch, rather than changing
  // geometry behind the static captured representation.
  const layers = patch([low, high]);
  const x = 0.1,
    z = 0.2,
    upper = layers.sample(x, z).height;
  for (const maximum of [0.5, 0.6, upper - 1e-12, upper, upper + 1e-12, Infinity, 0.5, -1])
    assert.deepEqual(layers.sample(x, z, maximum, cache), layers.sample(x, z, maximum));
  for (const [px, pz] of [
    [x + 1e-12, z],
    [x, z + 1e-12],
    [0, z],
    [-0, z],
    [3, 3],
    [x, z],
  ])
    assert.deepEqual(layers.sample(px, pz, Infinity, cache), layers.sample(px, pz));
  low.visible = false;
  assert.deepEqual(layers.sample(x, z, 0.5, cache), layers.sample(x, z, 0.5));
  assert.equal(layers.sample(x, z, 0.5, cache).visible, false);
  assert.deepEqual(ground.sample(x, z, 0.5, cache), ground.sample(x, z, 0.5));
});

test("new captures and distinct patches invalidate a reused point's geometric result", () => {
  const ground = patch([plane()]),
    cache = {};
  assert.equal(ground.sample(0, 0, 0.5, cache).height, 0);
  const raised = plane();
  raised.position.y = 0.2;
  ground.capture([raised]);
  assert.equal(ground.sample(0, 0, 0.5, cache).height, 0.2);
  const independent = patch([plane()]);
  assert.equal(independent.sample(0, 0, 0.5, cache).height, 0);
  assert.equal(independent.sample(3, 3, 0.5, cache), null);
  independent.capture([]);
  assert.equal(independent.sample(0, 0, 0.5, cache).height, 0);
});

test("a bounds query conservatively encloses every supported height on crossed grades", () => {
  for (const [gx, gz] of [
    [0, 0],
    [0.2, -0.15],
    [-0.18, 0.12],
  ]) {
    const ground = patch([plane(gx, gz)]),
      rect = { minX: -0.7, maxX: 0.8, minZ: -0.6, maxZ: 0.9 },
      bound = ground.maximumHeightInBounds(rect);
    assert.equal(bound.covered, true);
    assert.equal(bound.visible, true);
    for (let x = rect.minX; x <= rect.maxX; x += 0.05)
      for (let z = rect.minZ; z <= rect.maxZ; z += 0.05) {
        const actual = ground.sample(x, z);
        assert.ok(actual);
        assert.ok(actual.height <= bound.height);
      }
    // Whole-cell cached ceilings are conservative by at most one cell of
    // horizontal slope per axis on this analytical plane.
    assert.ok(
      bound.height <
        Math.max(...[rect.minX, rect.maxX].flatMap((x) => [rect.minZ, rect.maxZ].map((z) => gx * x + gz * z))) +
          0.35 * (Math.abs(gx) + Math.abs(gz)) +
          2e-7
    );
  }
});

test("a rectangle crossing a shared diagonal has full coverage without inventing a boundary", () => {
  const ground = patch([plane()]);
  assert.equal(ground.maximumHeightInBounds({ minX: -0.5, maxX: 0.5, minZ: -0.5, maxZ: 0.5 }).covered, true);
  ground.capture([]);
  assert.equal(ground.maximumHeightInBounds({ minX: -0.5, maxX: 0.5, minZ: -0.5, maxZ: 0.5 }).covered, true);
});

test("holes and support islands cannot certify an entire query rectangle", () => {
  const roots = [];
  for (const [x, z, width, depth] of [
    [-1.25, 0, 1.5, 4],
    [1.25, 0, 1.5, 4],
    [0, -1.25, 1, 1.5],
    [0, 1.25, 1, 1.5],
  ]) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial());
    mesh.name = "coast_ring_fixture";
    mesh.position.set(x, 0, z);
    roots.push(mesh);
  }
  const ground = patch(roots);
  assert.equal(ground.maximumHeightInBounds({ minX: -1, maxX: 0.7, minZ: -0.7, maxZ: 0.7 }).covered, false);
  assert.equal(ground.maximumHeightInBounds({ minX: -0.2, maxX: 0.2, minZ: -0.2, maxZ: 0.2 })?.covered || false, false);
  assert.equal(patch([plane(0, 0, 1)]).maximumHeightInBounds({ minX: -0.7, maxX: 0.7, minZ: -0.7, maxZ: 0.7 }).covered, false);
});

test("duplicate triangles on the same side do not cancel a real projected boundary", () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([-2, 0, -2, -2, 0, 2, 2, 0, -2], 3));
  const a = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()),
    b = a.clone();
  a.name = b.name = "coast_duplicate_fixture";
  const ground = patch([a, b]);
  assert.equal(ground.maximumHeightInBounds({ minX: -0.4, maxX: 0.2, minZ: -0.4, maxZ: 0.2 }).covered, false);
  assert.equal(ground.maximumHeightInBounds({ minX: -1.5, maxX: -1, minZ: -1.5, maxZ: -1 }).covered, true);
});

test("hidden supports and queries outside captured bounds remain explicitly unqualified", () => {
  const parent = new THREE.Group();
  parent.add(plane());
  parent.visible = false;
  const ground = patch([parent], 1);
  assert.equal(ground.maximumHeightInBounds({ minX: -0.4, maxX: 0.4, minZ: -0.4, maxZ: 0.4 }).visible, false);
  assert.equal(ground.maximumHeightInBounds({ minX: -1.2, maxX: 0.4, minZ: -0.4, maxZ: 0.4 }).covered, false);
  assert.equal(ground.maximumHeightInBounds({ minX: 8, maxX: 9, minZ: 8, maxZ: 9 }), null);
  assert.equal(ground.maximumHeightInBounds({ minX: 1, maxX: -1, minZ: 0, maxZ: 1 }), null);
});

test("a finer index preserves actual point hits, maximum-height selection and triangle order", () => {
  const floor = plane(0.2, -0.15),
    upper = plane(-0.1, 0.08, 1.2);
  upper.position.set(0.2, 0.3, -0.1);
  upper.visible = false;
  const ordinary = patch([floor, upper]),
    fine = createGroundPatch([[0, 0, 0]], 3, 0.0875);
  fine.capture([floor, upper]);
  assert.equal(ordinary.evidence().triangles, fine.evidence().triangles);
  for (let x = -1.9; x < 1.9; x += 0.037)
    for (let z = -1.9; z < 1.9; z += 0.041)
      for (const maximum of [Infinity, 0.15, -0.2]) assert.deepEqual(fine.sample(x, z, maximum), ordinary.sample(x, z, maximum));
  assert.throws(() => createGroundPatch([[0, 0, 0]], 1, 0), RangeError);
});

test("cached ceilings and boundaries refresh after another support is captured", () => {
  const ground = patch([plane()]),
    rectangle = { minX: -0.2, maxX: 0.2, minZ: -0.2, maxZ: 0.2 };
  assert.ok(ground.maximumHeightInBounds(rectangle).height < 1e-6);
  const upper = plane();
  upper.position.y = 0.4;
  ground.capture([upper]);
  assert.ok(ground.maximumHeightInBounds(rectangle).height > 0.399);
  upper.visible = false;
  assert.equal(ground.maximumHeightInBounds(rectangle).visible, false);
});

test("clearance bounds retain the correlation of an inclined shape with its supporting grade", () => {
  const gx = 0.18,
    gz = -0.12,
    ground = patch([plane(gx, gz)]),
    transform = new THREE.Matrix4().set(1, 0, 0, 0, gx, 1, gz, 0, 0, 0, 1, 0, 0, 0, 0, 1),
    corners = Array.from({ length: 8 }, (_, i) =>
      new THREE.Vector3(i & 1 ? 0.6 : -0.6, i & 2 ? 0.09 : 0.04, i & 4 ? 0.5 : -0.5).applyMatrix4(transform)
    ),
    box = new THREE.Box3().setFromPoints(corners),
    rectangle = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, corners },
    bound = ground.maximumHeightInBounds(rectangle, false);
  assert.ok(box.min.y - bound.height < -0.2, "independent extrema should deliberately be loose here");
  assert.ok(bound.gap > 0.0399998 && bound.gap <= 0.04);
  for (let x = -0.6; x <= 0.6; x += 0.03)
    for (let z = -0.5; z <= 0.5; z += 0.03) {
      const p = new THREE.Vector3(x, 0.04, z).applyMatrix4(transform),
        support = ground.sample(p.x, p.z);
      assert.ok(p.y - support.height >= bound.gap);
    }
  assert.equal(bound.covered, undefined, "a height-only query must not claim continuous support");
});

test("actual triangle overlap finds a rock crease missed by three clear skin vertices", () => {
  const vertices = [
      10.685466766357422, -6.854983329772949, -14.105803489685059, 10.781173706054688, -6.793456077575684, -13.887040138244629, 10.99993896484375,
      -6.793456077575684, -13.907548904418945, 10.99993896484375, -6.793456077575684, -13.907548904418945, 10.781173706054688, -6.793456077575684,
      -13.887040138244629, 10.99993896484375, -6.759274482727051, -13.640931129455566,
    ],
    geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)),
    mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.name = "coast_retained_sealion_crease";
  const ground = createGroundPatch([[10.85, -6.8, -13.9]], 1, 0.0875);
  ground.capture([mesh]);
  const points = [
    [10.84287365591344, -6.786678692541106, -13.854232483388365],
    [10.880077564173398, -6.7956748425443765, -13.908962961031957],
    [10.888787811412787, -6.788388997260241, -13.862675317116313],
  ].map((p) => new THREE.Vector3(...p));
  for (const p of points) assert.ok(p.y - ground.sample(p.x, p.z, p.y + 0.5).height > 0);
  const result = ground.minimumSurfaceGap([{ mesh: "CaliforniaSeaLion_skin_1", triangle: 1685, points }]);
  assert.ok(result.minimum.gap < -0.0001);
  assert.equal(result.minimum.skinTriangle, 1685);
  assert.ok(result.clippedPairs > 0);
  const raised = points.map((p) => p.clone().add(new THREE.Vector3(0, 0.004, 0))),
    clear = ground.minimumSurfaceGap([{ mesh: "raised witness", triangle: 1685, points: raised }]);
  assert.ok(clear.minimum.gap > 0.003);
  assert.equal(ground.minimumSurfaceGap([{ mesh: "raised witness", triangle: 1685, points: raised }], 0.00065).minimum, null);
});

test("surface queries use posed world orientation and report undefined projections explicitly", () => {
  const ground = patch([plane()]),
    up = [
      [-0.1, 0.1, -0.1],
      [-0.1, 0.1, 0.1],
      [0.1, 0.1, -0.1],
    ].map((p) => new THREE.Vector3(...p)),
    vertical = [
      [0, 0.02, 0],
      [0, 0.1, 0.1],
      [0, 0.2, -0.1],
    ].map((p) => new THREE.Vector3(...p)),
    zero = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    result = ground.minimumSurfaceGap([
      { mesh: "up", triangle: 1, points: up },
      { mesh: "vertical", triangle: 2, points: vertical },
      { mesh: "zero", triangle: 3, points: zero },
    ]);
  assert.equal(result.minimum, null);
  assert.equal(result.upwardFaces, 1);
  assert.deepEqual(result.unassessedVerticalFaces, [{ mesh: "vertical", triangle: 2 }]);
  assert.deepEqual(result.degenerateFaces, [{ mesh: "zero", triangle: 3 }]);
  const rotation = new THREE.Matrix4().makeRotationX(Math.PI),
    down = up.map((p) => p.clone().applyMatrix4(rotation));
  assert.ok(ground.minimumSurfaceGap([{ mesh: "actually posed downward", triangle: 4, points: down }]).minimum.gap < -0.09);
});
