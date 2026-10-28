import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const file of ["la-jolla.glb", "miniature.glb"]) {
  test(`${file}: only the riding board has the red deck and real white stringer, without an attached rigid wake`, () => {
    const bytes = readFileSync(new URL(`../assets/models/la-jolla/${file}`, import.meta.url));
    const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    const children = (name) => doc.nodes.find((n) => n.name === name).children.map((i) => doc.nodes[i]);
    const materials = (nodes) => nodes.flatMap((n) => (n.mesh == null ? [] : doc.meshes[n.mesh].primitives.map((p) => doc.materials[p.material])));
    const rider = materials(children("Surfer1"));
    assert.deepEqual(rider.map((m) => m.name).sort(), ["Rider board red", "Rider board white stringer"]);
    const red = rider.find((m) => m.name === "Rider board red").pbrMetallicRoughness.baseColorFactor;
    assert.ok(red[0] > 0.5 && red[1] < 0.06 && red[2] < 0.06);
    const white = rider.find((m) => m.name === "Rider board white stringer").pbrMetallicRoughness.baseColorFactor;
    assert.ok(white.slice(0, 3).every((v) => v > 0.8));
    assert.deepEqual(
      materials(children("Surfer0")).map((m) => m.name),
      ["Limestone trim"]
    );
    assert.deepEqual(
      materials(children("Surfer2")).map((m) => m.name),
      ["Blue board", "Sea foam"]
    );
    if (file === "la-jolla.glb") {
      const manifest = JSON.parse(readFileSync(new URL("../assets/models/la-jolla/manifest.json", import.meta.url)));
      const triangles = doc.meshes.reduce((n, m) => n + m.primitives.reduce((sum, p) => sum + doc.accessors[p.indices].count / 3, 0), 0);
      assert.equal(manifest.triangleCount, triangles);
    }
  });
}
