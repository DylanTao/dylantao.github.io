import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as THREE from "../assets/js/three.module.min.js";
import { createCoffeeChair, createMeasuredCoffeeChair } from "../assets/js/home-scene/coffee-chair.mjs";

const sha = (body) => createHash("sha256").update(body).digest("hex");
const raw = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
function faceBytes(geometry, faces, names = Object.keys(geometry.attributes).sort()) {
  const parts = [];
  for (const face of faces)
    for (let k = 0; k < 3; k++) {
      const id = geometry.index.array[face * 3 + k];
      for (const name of names) {
        const a = geometry.attributes[name],
          width = a.itemSize * a.array.BYTES_PER_ELEMENT;
        parts.push(Buffer.from(a.array.buffer, a.array.byteOffset + id * width, width));
      }
    }
  return Buffer.concat(parts);
}
function schema(a) {
  return {
    type: a.array.constructor.name,
    normalized: a.normalized,
    itemSize: a.itemSize,
    count: a.count,
    usage: a.usage,
    gpuType: a.gpuType,
    wholeSHA256: sha(raw(a.array)),
  };
}
function addColors(geometry) {
  geometry.clearGroups();
  const n = geometry.attributes.position.count;
  geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(
      Uint8Array.from({ length: n * 4 }, (_, i) => (i * 37) % 256),
      4,
      true
    )
  );
  geometry.setAttribute(
    "color_1",
    new THREE.BufferAttribute(
      Uint16Array.from({ length: n * 4 }, (_, i) => (i * 173) % 65536),
      4,
      true
    )
  );
  geometry.setAttribute(
    "custom",
    new THREE.BufferAttribute(
      Uint16Array.from({ length: n }, (_, i) => i * 5),
      1,
      true
    )
  );
  return geometry;
}
function fixture(rotated = false) {
  const root = new THREE.Group(),
    parent = new THREE.Group();
  if (rotated) {
    root.rotation.set(0.2, -0.3, 0.15);
    root.scale.set(1.1, 0.9, 1.2);
  }
  parent.position.z = 8;
  root.add(parent);
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([0, 0, -8, 0.3, 0, -8, 0, 0.3, -8, 0.5, 0, -8, 0.5, 0, -8, 0.5, 0.4, -8, 0, 0, -7, 0.3, 0, -7, 0, 0.3, -7]),
      3
    )
  );
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(27).fill(0.25), 3));
  g.setAttribute(
    "uv",
    new THREE.BufferAttribute(
      Float32Array.from({ length: 18 }, (_, i) => i / 17),
      2
    )
  );
  g.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 3, 4, 5, 6, 7, 8]), 1));
  addColors(g);
  const material = new THREE.MeshBasicMaterial();
  material.name = "measured fixture";
  const batch = new THREE.Mesh(g, material),
    whole = new THREE.Mesh(addColors(new THREE.BoxGeometry(0.2, 0.3, 0.2)), material);
  batch.name = "batch";
  whole.name = "whole";
  batch.castShadow = batch.receiveShadow = true;
  batch.frustumCulled = false;
  batch.renderOrder = 6;
  batch.layers.set(2);
  batch.userData = { installationGroup: "exterior", retained: { value: 17 } };
  batch.customDepthMaterial = new THREE.MeshDepthMaterial();
  batch.onBeforeRender = function () {
    return this.name;
  };
  parent.add(batch);
  root.add(whole);
  root.updateWorldMatrix(true, true);
  const natives = ["position", "normal", "color", "color_1"];
  const sources = [batch, whole].map((mesh, i) => ({
    id: "s" + i,
    meshName: mesh.name,
    materialName: material.name,
    localMatrix: mesh.matrix.toArray(),
    worldMatrix: mesh.matrixWorld.toArray(),
    attributes: Object.fromEntries(natives.map((name) => [name, schema(mesh.geometry.attributes[name])])),
    index: schema(mesh.geometry.index),
  }));
  const definitions = [
    {
      id: "triangle",
      source: "s0",
      faceRanges: [[0, 0]],
      triangles: 1,
      whole: false,
      typedOrientedTriangleSHA256: sha(faceBytes(g, [0], natives.toSorted())),
    },
    {
      id: "zero-chart",
      source: "s0",
      faceRanges: [[1, 1]],
      triangles: 1,
      whole: false,
      typedOrientedTriangleSHA256: sha(faceBytes(g, [1], natives.toSorted())),
    },
    {
      id: "box",
      source: "s1",
      faceRanges: [[0, whole.geometry.index.count / 3 - 1]],
      triangles: whole.geometry.index.count / 3,
      whole: true,
      typedOrientedTriangleSHA256: sha(
        faceBytes(
          whole.geometry,
          Array.from({ length: whole.geometry.index.count / 3 }, (_, i) => i),
          natives.toSorted()
        )
      ),
    },
  ];
  return { root, parent, batch, whole, definition: { maxOffset: 0.4, sources, parts: definitions } };
}
function state(f) {
  f.root.updateWorldMatrix(true, true);
  return {
    children: f.root.children.slice(),
    parentChildren: f.parent.children.slice(),
    meshes: [f.batch, f.whole].map((m) => ({
      mesh: m,
      geometry: m.geometry,
      index: m.geometry.index,
      indices: raw(m.geometry.index.array).toString("hex"),
      material: m.material,
      visible: m.visible,
      parent: m.parent,
      userData: m.userData,
      local: m.matrix.toArray(),
      world: m.matrixWorld.toArray(),
      attributes: Object.entries(m.geometry.attributes).map(([name, a]) => ({
        name,
        attribute: a,
        array: a.array,
        bytes: raw(a.array).toString("hex"),
      })),
    })),
  };
}
function unchanged(f, old) {
  const current = state(f);
  assert.deepEqual(current.children, old.children);
  assert.deepEqual(current.parentChildren, old.parentChildren);
  for (let i = 0; i < old.meshes.length; i++) {
    const a = current.meshes[i],
      b = old.meshes[i];
    for (const key of ["geometry", "index", "material", "visible", "parent", "userData"]) assert.equal(a[key], b[key], key);
    assert.equal(a.indices, b.indices);
    assert.deepEqual(a.local, b.local);
    assert.deepEqual(a.world, b.world);
    assert.equal(a.attributes.length, b.attributes.length);
    a.attributes.forEach((v, j) => {
      assert.equal(v.name, b.attributes[j].name);
      assert.equal(v.attribute, b.attributes[j].attribute);
      assert.equal(v.array, b.attributes[j].array);
      assert.equal(v.bytes, b.attributes[j].bytes);
    });
  }
}

test("fingerprinting is passive; public request cannot replace the sealed source definition", async () => {
  const f = fixture(),
    before = state(f),
    chair = await createMeasuredCoffeeChair(f.root, f.definition);
  assert.ok(chair?.available);
  unchanged(f, before);
  assert.deepEqual(chair.evidence(), { available: true, phase: "parked", offset: 0, parts: 3, triangles: 14, additionalDraws: 0, failure: null });
  for (const request of [null, [], {}, { version: 1, id: "unknown" }, { version: 1, id: "pavilion-chair-v1", parts: f.definition.parts }])
    assert.equal(await createCoffeeChair(f.root, request), null);
  assert.equal(await createCoffeeChair(f.root, { version: 1, id: "pavilion-chair-v1" }), null, "fixture is not the qualified native shell");
  unchanged(f, before);
  chair.dispose();
});

test("active extraction retains every typed field, zero chart and unowned oriented triangle", async () => {
  const f = fixture(),
    before = state(f),
    original = f.batch.geometry,
    whole = f.whole.geometry;
  const owned = [faceBytes(original, [0]), faceBytes(original, [1])],
    retained = faceBytes(original, [2]);
  const chair = await createMeasuredCoffeeChair(f.root, f.definition);
  assert.ok(chair.setOffset(0.4));
  const group = f.root.getObjectByName("coffee_chair_assembly");
  assert.equal(group.children.length, 3);
  assert.equal(chair.evidence().additionalDraws, 2);
  for (const [i, name] of ["triangle", "zero-chart"].entries()) {
    const mesh = group.getObjectByName("coffee_chair_" + name);
    assert.equal(faceBytes(mesh.geometry, [0]).toString("hex"), owned[i].toString("hex"));
    for (const [key, attribute] of Object.entries(mesh.geometry.attributes)) {
      const source = original.attributes[key];
      assert.equal(attribute.array.constructor, source.array.constructor);
      assert.equal(attribute.normalized, source.normalized);
      assert.equal(attribute.itemSize, source.itemSize);
      assert.equal(attribute.usage, source.usage);
      assert.equal(attribute.gpuType, source.gpuType);
    }
    assert.equal(mesh.material, f.batch.material);
    assert.equal(mesh.onBeforeRender, f.batch.onBeforeRender);
    assert.equal(mesh.customDepthMaterial, f.batch.customDepthMaterial);
    assert.equal(mesh.layers.mask, f.batch.layers.mask);
    assert.equal(mesh.userData.dynamic, true);
    assert.equal(mesh.userData.retained, f.batch.userData.retained);
  }
  assert.equal(faceBytes(f.batch.geometry, [0]).toString("hex"), retained.toString("hex"));
  assert.deepEqual([...f.batch.geometry.index.array], [6, 7, 8]);
  assert.equal(f.batch.geometry.attributes.position, original.attributes.position);
  assert.equal(group.getObjectByName("coffee_chair_box").geometry, whole);
  assert.equal(f.whole.visible, false);
  chair.reset();
  unchanged(f, before);
  chair.dispose();
});

test("world-Z motion respects transformed source parents; repeated Pause frames do not drift", async () => {
  const f = fixture(true),
    before = state(f),
    expected = new THREE.Vector3().fromBufferAttribute(f.batch.geometry.attributes.position, 0).applyMatrix4(f.batch.matrixWorld);
  const chair = await createMeasuredCoffeeChair(f.root, f.definition);
  for (const z of [0.1, 0.4, 0.25, 0.25, 0.25, 0.01]) {
    assert.ok(chair.setOffset(z));
    const mesh = f.root.getObjectByName("coffee_chair_triangle"),
      actual = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, 0).applyMatrix4(mesh.matrixWorld);
    assert.ok(actual.distanceTo(expected.clone().add(new THREE.Vector3(0, 0, z))) < 1e-12);
  }
  chair.reset();
  unchanged(f, before);
  chair.dispose();
});

test("invalid motion, interruptions and repeated disposal restore the exact parked graph", async () => {
  const f = fixture(),
    before = state(f),
    chair = await createMeasuredCoffeeChair(f.root, f.definition);
  for (const bad of [-0.01, 0.400001, NaN, Infinity, "0.2", null]) {
    assert.ok(chair.setOffset(0.3));
    assert.equal(chair.setOffset(bad), false);
    unchanged(f, before);
  }
  for (let i = 0; i < 4; i++) {
    assert.ok(chair.setOffset(0.4));
    chair.reset();
    unchanged(f, before);
  }
  assert.ok(chair.setOffset(0.2));
  chair.dispose();
  chair.dispose();
  unchanged(f, before);
  assert.equal(chair.setOffset(0.1), false);
});

test("wrong buffers, schemas, part ownership and duplicate source bindings fail without edits", async () => {
  const changes = [
    (d) => {
      d.sources[0].meshName = "missing";
    },
    (d) => {
      d.sources[0].attributes.position.normalized = true;
    },
    (d) => {
      d.sources[0].index.wholeSHA256 = "0".repeat(64);
    },
    (d) => {
      d.parts[0].typedOrientedTriangleSHA256 = "0".repeat(64);
    },
    (d) => {
      d.parts[1].faceRanges = [[0, 0]];
    },
    (d) => {
      d.parts[0].whole = true;
    },
    (d) => {
      d.sources.push({ ...structuredClone(d.sources[0]), id: "duplicate-mesh" });
      d.parts.push({ ...d.parts[0], id: "dup", source: "duplicate-mesh" });
    },
    (d) => {
      d.parts[0].faceRanges = [[-1, 0]];
    },
    (d) => {
      d.parts[0].triangles = 0;
    },
  ];
  for (const change of changes) {
    const f = fixture(),
      before = state(f);
    change(f.definition);
    assert.equal(await createMeasuredCoffeeChair(f.root, f.definition), null);
    unchanged(f, before);
  }
});

test("a post-validation source edit fails closed while retaining that foreign edit", async () => {
  const f = fixture(),
    chair = await createMeasuredCoffeeChair(f.root, f.definition),
    original = f.batch.geometry;
  original.attributes.position.array[18] += 0.1;
  original.attributes.position.needsUpdate = true;
  const edited = state(f);
  assert.equal(chair.setOffset(0.2), false);
  assert.equal(chair.available, false);
  unchanged(f, edited);
});

test("partial activation failure rolls back original references, visibility and child order", async () => {
  const f = fixture(),
    before = state(f),
    chair = await createMeasuredCoffeeChair(f.root, f.definition);
  f.root.addEventListener("childadded", (e) => {
    if (e.child?.name === "coffee_chair_assembly") throw new Error("injected activation failure");
  });
  assert.equal(chair.setOffset(0.2), false);
  assert.equal(chair.available, false);
  unchanged(f, before);
  assert.match(chair.evidence().failure, /injected activation failure/);
});

test("an active versioned attribute edit returns to parked and leaves no duplicate furniture", async () => {
  const f = fixture(),
    chair = await createMeasuredCoffeeChair(f.root, f.definition),
    original = f.batch.geometry;
  assert.ok(chair.setOffset(0.3));
  original.attributes.color.array[0] ^= 1;
  original.attributes.color.needsUpdate = true;
  assert.equal(chair.setOffset(0.2), false);
  assert.equal(chair.available, false);
  assert.equal(f.batch.geometry, original);
  assert.equal(f.whole.visible, true);
  assert.equal(f.root.getObjectByName("coffee_chair_assembly"), undefined);
});

test("async hashing rejects a source change between digest and captured snapshot", async () => {
  const f = fixture(),
    pending = createMeasuredCoffeeChair(f.root, f.definition);
  queueMicrotask(() => {
    f.batch.geometry.attributes.position.array[18] += 0.125;
  });
  assert.equal(await pending, null);
  assert.equal(f.root.getObjectByName("coffee_chair_assembly"), undefined);
});

test("grouped/morphed or ambiguous source geometry stays unavailable", async () => {
  for (const change of [
    (f) => f.batch.geometry.addGroup(0, 3, 0),
    (f) => f.batch.add(new THREE.Object3D()),
    (f) => {
      f.batch.geometry.morphAttributes.position = [f.batch.geometry.attributes.position.clone()];
    },
    (f) => {
      const duplicate = new THREE.Mesh(f.batch.geometry, f.batch.material);
      duplicate.name = f.batch.name;
      f.root.add(duplicate);
    },
  ]) {
    const f = fixture();
    change(f);
    const before = state(f);
    assert.equal(await createMeasuredCoffeeChair(f.root, f.definition), null);
    unchanged(f, before);
  }
});

test("accepted bounds and ownership do not track later caller metadata mutations", async () => {
  const f = fixture(),
    chair = await createMeasuredCoffeeChair(f.root, f.definition),
    before = state(f);
  f.definition.maxOffset = 100;
  f.definition.parts[0].faceRanges[0] = [2, 2];
  assert.ok(chair.setOffset(0.4));
  assert.equal(chair.setOffset(0.41), false);
  unchanged(f, before);
  chair.dispose();
});

test("cleanup disposes owned partitions only, retaining source geometry and material", async () => {
  const f = fixture(),
    originalGeometry = [f.batch.geometry, f.whole.geometry],
    originalMaterial = f.batch.material;
  let originalDisposals = 0,
    ownedDisposals = 0;
  for (const g of originalGeometry) g.addEventListener("dispose", () => originalDisposals++);
  originalMaterial.addEventListener("dispose", () => originalDisposals++);
  const chair = await createMeasuredCoffeeChair(f.root, f.definition);
  assert.ok(chair.setOffset(0.4));
  const group = f.root.getObjectByName("coffee_chair_assembly");
  for (const mesh of group.children) if (!originalGeometry.includes(mesh.geometry)) mesh.geometry.addEventListener("dispose", () => ownedDisposals++);
  chair.dispose();
  assert.equal(originalDisposals, 0);
  assert.equal(ownedDisposals, 2);
  assert.equal(f.batch.geometry, originalGeometry[0]);
  assert.equal(f.whole.geometry, originalGeometry[1]);
});

test("active index and extra-attribute changes are detected, not hidden by the native hash", async () => {
  for (const change of [
    (f) => {
      f.batch.geometry.index.normalized = true;
    },
    (f) => {
      const index = f.batch.geometry.index;
      index.array[0] = 0;
      index.needsUpdate = true;
    },
    (f) => {
      f.batch.geometry.setAttribute("foreign", new THREE.BufferAttribute(new Float32Array(9), 1));
    },
  ]) {
    const f = fixture(),
      original = f.batch.geometry,
      chair = await createMeasuredCoffeeChair(f.root, f.definition);
    assert.ok(chair.setOffset(0.4));
    change(f);
    assert.equal(chair.setOffset(0.2), false);
    assert.equal(chair.available, false);
    assert.equal(f.batch.geometry, original);
    assert.equal(f.root.getObjectByName("coffee_chair_assembly"), undefined);
  }
});

test("async index-schema mutation is rejected even for an exact zero chart", async () => {
  const f = fixture();
  f.batch.geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 0, 0]), 1));
  f.definition.sources[0].index = schema(f.batch.geometry.index);
  f.definition.parts = [
    {
      id: "zero",
      source: "s0",
      faceRanges: [[0, 0]],
      triangles: 1,
      whole: true,
      typedOrientedTriangleSHA256: sha(faceBytes(f.batch.geometry, [0], Object.keys(f.definition.sources[0].attributes).sort())),
    },
    f.definition.parts[2],
  ];
  const pending = createMeasuredCoffeeChair(f.root, f.definition);
  queueMicrotask(() => {
    f.batch.geometry.index.normalized = true;
  });
  assert.equal(await pending, null);
  assert.equal(f.root.getObjectByName("coffee_chair_assembly"), undefined);
});
