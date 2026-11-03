import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import * as THREE from "../assets/js/three.module.min.js";
import { candidateDefinition, replaceNativeDefinition, safeOutputDirectory, embeddedModel, main } from "../bin/produce_coastal_coffee_chair.mjs";
import { createMeasuredCoffeeChair } from "../assets/js/home-scene/coffee-chair.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const raw = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
const schema = (a) => ({
  type: a.array.constructor.name,
  normalized: a.normalized,
  itemSize: a.itemSize,
  count: a.count,
  gpuType: a.gpuType,
  usage: a.usage,
  wholeSHA256: sha(raw(a.array)),
});
function typed(mesh, faces) {
  const b = [];
  for (const f of faces)
    for (let k = 0; k < 3; k++) {
      const id = mesh.geometry.index.getX(f * 3 + k);
      for (const n of Object.keys(mesh.geometry.attributes).sort()) {
        const a = mesh.geometry.attributes[n],
          w = a.itemSize * a.array.BYTES_PER_ELEMENT;
        b.push(Buffer.from(a.array.buffer, a.array.byteOffset + id * w, w));
      }
    }
  return sha(Buffer.concat(b));
}
function fixture() {
  const build = (prefix) => {
    const scene = new THREE.Group(),
      parser = { associations: new Map(), json: { nodes: [] } };
    for (let i = 0; i < 14; i++) {
      const count = i === 0 ? 1 : i === 13 ? 55 : 52,
        p = [];
      for (let f = 0; f < count; f++) p.push(i, 0, 0, i + (i ? 0.25 : 0), 0, 0, i, i ? 0.25 : 0, 0);
      const g = new THREE.BufferGeometry(),
        n = p.length / 3;
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.5), 3));
      g.setAttribute(
        "color",
        new THREE.BufferAttribute(
          Uint8Array.from({ length: n * 4 }, (_, k) => k % 256),
          4,
          true
        )
      );
      g.setAttribute(
        "color_1",
        new THREE.BufferAttribute(
          Uint16Array.from({ length: n * 4 }, (_, k) => k * 5),
          4,
          true
        )
      );
      g.setIndex(
        new THREE.BufferAttribute(
          Uint16Array.from({ length: n }, (_, k) => k),
          1
        )
      );
      const m = new THREE.MeshBasicMaterial();
      m.name = "oak";
      const mesh = new THREE.Mesh(g, m);
      mesh.name = prefix + i;
      scene.add(mesh);
      parser.associations.set(mesh, { nodes: i });
      parser.json.nodes.push({ name: "owner-" + i });
    }
    scene.updateWorldMatrix(true, true);
    return { scene, parser };
  };
  const reference = build("reference-"),
    candidate = build("candidate-");
  const configured = reference.scene.children.map((m, i) => {
    const faces = Array.from({ length: m.geometry.index.count / 3 }, (_, k) => k);
    return {
      rawOwner: "owner-" + i,
      meshName: m.name,
      parentName: m.parent.name,
      sourceIsland: 0,
      actualIsland: 0,
      material: m.material.name,
      faces,
      triangles: faces.length,
      standalone: true,
      localMatrix: m.matrix.toArray(),
      worldMatrix: m.matrixWorld.toArray(),
      attributes: Object.fromEntries(Object.entries(m.geometry.attributes).map(([n, a]) => [n, schema(a)])),
      index: schema(m.geometry.index),
      typedOrientedTriangleSHA256: typed(m, faces),
    };
  });
  return { reference, candidate, roster: { configured } };
}

test("all14 unique exact oriented parts generate runtime-usable candidates without graph writes", async () => {
  const f = fixture(),
    old = f.candidate.scene.children.slice(),
    result = candidateDefinition(f.reference, f.candidate, f.roster);
  assert.equal(result.definition.parts.length, 14);
  assert.equal(
    result.definition.parts.reduce((n, p) => n + p.triangles, 0),
    680
  );
  assert.ok(result.correspondence.every((r) => !r.typedFieldsChanged));
  assert.deepEqual(f.candidate.scene.children, old);
  const chair = await createMeasuredCoffeeChair(f.candidate.scene, result.definition);
  assert.ok(chair?.available);
  chair.dispose();
  assert.deepEqual(f.candidate.scene.children, old);
});

test("AO/color changes are captured, while exact geometry remains a separate condition", () => {
  const f = fixture();
  f.candidate.scene.children[2].geometry.attributes.color_1.array[0] += 1;
  const r = candidateDefinition(f.reference, f.candidate, f.roster);
  assert.equal(r.correspondence.filter((r) => r.typedFieldsChanged).length, 1);
  assert.equal(r.correspondence[2].materialRoleSame, true);
  assert.notEqual(r.definition.sources[2].attributes.color_1.wholeSHA256, f.roster.configured[2].attributes.color_1.wholeSHA256);
});

test("cyclic ordering is retained but reversed winding, changed positions and lost zero occurrences fail", () => {
  const f = fixture(),
    mesh = f.candidate.scene.children[1],
    a = mesh.geometry.index.array;
  for (let i = 0; i < a.length; i += 3) {
    const x = a[i];
    a[i] = a[i + 1];
    a[i + 1] = a[i + 2];
    a[i + 2] = x;
  }
  assert.equal(candidateDefinition(f.reference, f.candidate, f.roster).definition.parts.length, 14);
  for (const change of [
    (f) => {
      const a = f.candidate.scene.children[1].geometry.index.array;
      [a[0], a[1]] = [a[1], a[0]];
    },
    (f) => {
      f.candidate.scene.children[1].geometry.attributes.position.array[0] += 1e-6;
    },
    (f) => f.candidate.scene.children[0].geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 1, 2]), 1)),
  ]) {
    const next = fixture();
    change(next);
    assert.throws(() => candidateDefinition(next.reference, next.candidate, next.roster), /geometry changed/);
  }
});

test("ambiguous ownership, missing parts and a changed approved reference are rejected", () => {
  for (const change of [
    (f) => {
      const original = f.candidate.scene.children[2],
        duplicate = original.clone();
      duplicate.name = "duplicate";
      f.candidate.scene.add(duplicate);
      const id = f.candidate.parser.json.nodes.length;
      f.candidate.parser.json.nodes.push({ name: "owner-2" });
      f.candidate.parser.associations.set(duplicate, { nodes: id });
    },
    (f) => f.candidate.scene.remove(f.candidate.scene.children[2]),
    (f) => {
      f.reference.scene.children[1].geometry.attributes.color.array[0] ^= 1;
    },
  ]) {
    const f = fixture();
    change(f);
    assert.throws(() => candidateDefinition(f.reference, f.candidate, f.roster));
  }
});

test("candidate replacement changes only the data block, including quoted braces/escapes", () => {
  const template = 'header\nconst NATIVE = { nested: { message: "brace } and \\\"quote\\\"" }, a: [1,2] };\nkeep();\n';
  const r = replaceNativeDefinition(template, { version: 1, text: "new" });
  assert.equal(r.source, "header\nconst NATIVE = " + JSON.stringify({ version: 1, text: "new" }, null, 2) + ";\nkeep();\n");
  assert.throws(() => replaceNativeDefinition("no marker", {}));
  assert.throws(() => replaceNativeDefinition("const NATIVE = {/*comment*/};", {}));
});

test("output guards reject canonical, existing and linked outside paths without destructive cleanup", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coffee-chair-producer-")),
    qa = path.join(root, ".jekyll-cache/visual-qa"),
    outside = path.join(root, "assets");
  fs.mkdirSync(qa, { recursive: true });
  fs.mkdirSync(outside);
  try {
    assert.equal(safeOutputDirectory(root, path.join(qa, "new")), path.join(qa, "new"));
    assert.throws(() => safeOutputDirectory(root, path.join(outside, "new")));
    fs.mkdirSync(path.join(qa, "exists"));
    assert.throws(() => safeOutputDirectory(root, path.join(qa, "exists")));
    const link = path.join(qa, "linked");
    fs.symlinkSync(outside, link, "junction");
    assert.throws(() => safeOutputDirectory(root, path.join(link, "new")), /escapes/);
  } finally {
    const absolute = path.resolve(root),
      parent = path.resolve(os.tmpdir());
    assert.equal(path.dirname(absolute), parent);
    assert.ok(path.basename(absolute).startsWith("coffee-chair-producer-"));
    fs.rmSync(absolute, { recursive: true, force: true });
  }
});

test("CLI rejects incomplete/unknown roles before creating outputs", async () => {
  await assert.rejects(main(["--candidate", "anything"]), /all SHA-bound/);
  await assert.rejects(main(["--publish", "true"]), /unknown/);
  await assert.rejects(main(["--candidate"]), /pairs/);
});

test("model roles reject external asset fetches instead of making partial loader fixtures", () => {
  const glb = (doc) => {
    const json = Buffer.from(JSON.stringify(doc).padEnd(Math.ceil(JSON.stringify(doc).length / 4) * 4));
    const header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(header.length + json.length, 8);
    header.writeUInt32LE(json.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    return Buffer.concat([header, json]);
  };
  assert.ok(embeddedModel(glb({ asset: { version: "2.0" }, buffers: [{ byteLength: 0 }] })));
  for (const doc of [
    { buffers: [{ uri: "other.bin" }] },
    { images: [{ uri: "https://example.test/texture.png" }] },
    { images: [{ uri: "data:image/png;base64,AA==" }] },
  ])
    assert.throws(() => embeddedModel(glb(doc)), /not loaded or omitted/);
  assert.throws(() => embeddedModel(Buffer.from("partial")), /complete GLB2/);
});
