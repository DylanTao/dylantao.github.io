import test from "node:test";
import assert from "node:assert/strict";
import { loadNativeAvatar, THREE } from "./helpers/coastal-native-avatar.mjs";
import { createWalkPresence, headFreeIndex } from "../assets/js/home-scene/walk-presence.mjs";

const avatars = ["ghibli", "lizard", "south-park", "simpsons", "rick-and-morty"];

function headOwnership(mesh, headBones) {
  const g = mesh.geometry,
    si = g.attributes.skinIndex,
    sw = g.attributes.skinWeight,
    weight = (v) => {
      let w = 0;
      for (let k = 0; k < 4; k++) if (headBones.has(mesh.skeleton.bones[si.getComponent(v, k)])) w += sw.getComponent(v, k);
      return w;
    };
  return { weight, owned: (a, b, c) => weight(a) >= 0.5 && weight(b) >= 0.5 && weight(c) >= 0.5 };
}

for (const id of avatars) {
  test(`${id}: the primary-view body index drops exactly the rigid Head-owned triangles`, async () => {
    const native = await loadNativeAvatar(id),
      presence = createWalkPresence({ renderer: {} });
    presence.setSource(native.scene, native.animations);
    const body = presence.object.getObjectByName("walk-avatar"),
      headBones = new Set();
    body.getObjectByName("Head").traverse((part) => part.isBone && headBones.add(part));
    let excluded = 0;
    body.traverse((mesh) => {
      if (!mesh.isSkinnedMesh || mesh.userData.walkCollarLiner) return;
      const { weight, owned } = headOwnership(mesh, headBones),
        full = mesh.geometry.index.array,
        cut = headFreeIndex(mesh, headBones);
      for (let v = 0; v < mesh.geometry.attributes.skinIndex.count; v++) {
        const w = weight(v);
        assert.ok(w < 1e-6 || w > 1 - 1e-6, `${id} ${mesh.material.name}: head binding is rigid`);
      }
      let expected = 0;
      for (let i = 0; i < full.length; i += 3) expected += owned(full[i], full[i + 1], full[i + 2]);
      if (!expected) return assert.equal(cut, null, `${mesh.material.name} keeps its own index`);
      const kept = cut.index.array;
      assert.equal(cut.headTriangles, expected);
      assert.equal(kept.length, full.length - 3 * expected, `${mesh.material.name}: every body triangle is kept`);
      for (let i = 0; i < kept.length; i += 3) assert.ok(!owned(kept[i], kept[i + 1], kept[i + 2]));
      assert.equal(kept.constructor, full.constructor);
      excluded += expected;
    });
    assert.equal(presence.evidence().primaryHeadExclusion.triangles, excluded);
    if (id === "south-park") {
      // The retained defect's native triage (first-person collar review, 24 October 2026).
      const kept = (name) => {
        let triangles = null;
        body.traverse((m) => {
          if (m.isSkinnedMesh && m.material.name === name && m.geometry.index.count > 2000) {
            const cut = headFreeIndex(m, headBones);
            triangles = (cut ? cut.index.count : m.geometry.index.count) / 3;
          }
        });
        return triangles;
      };
      assert.equal(kept("mouth"), null, "the mouth primitive is small and wholly Head-owned");
      assert.equal(kept("warm white"), 2016, "the teeth leave and the shoes stay");
      assert.equal(kept("skin"), 29822, "the face leaves and the neck, arms and hands stay");
      let mouth = null;
      body.traverse((m) => m.isSkinnedMesh && m.material.name === "mouth" && (mouth = m));
      assert.equal(headFreeIndex(mouth, headBones).index.count, 0, "the whole mouth leaves the primary view");
    }
    presence.dispose();
  });
}
