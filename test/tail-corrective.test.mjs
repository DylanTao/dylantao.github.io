import test from "node:test";
import assert from "node:assert/strict";
import { updateTailCorrective } from "../artwork/coastal-home/reviews/tail-socket-2026-10-28/runtime/tail-corrective.mjs";

function fixture(tagged = true) {
  const mesh = {
    isSkinnedMesh: true,
    userData: tagged ? { tailCorrective: { version: 1, morph: "SeatedDrape" } } : {},
    morphTargetDictionary: { Blink: 0, SeatedDrape: 1 },
    morphTargetInfluences: [0.37, 0],
  };
  return { mesh, model: { traverse: (callback) => callback(mesh) } };
}

test("tail corrective holds exact zero for standing, preserves Blink and follows reversible seated weights", () => {
  const { mesh, model } = fixture();
  for (const weight of [0, 0.2, 0.6, 1, 0.6, 0.2, 0]) {
    assert.deepEqual(updateTailCorrective(model, { seatedWeight: weight }), { active: true, meshes: 1, weight });
    assert.deepEqual(mesh.morphTargetInfluences, [0.37, weight]);
  }
});

test("tail corrective clamps invalid blend inputs without changing public rigs or other models", () => {
  const a = fixture(),
    b = fixture(false);
  updateTailCorrective(a.model, { seatedWeight: 4 });
  assert.equal(a.mesh.morphTargetInfluences[1], 1);
  for (const weight of [-1, Number.NaN, Infinity]) {
    updateTailCorrective(a.model, { seatedWeight: weight });
    assert.equal(a.mesh.morphTargetInfluences[1], 0);
  }
  assert.deepEqual(updateTailCorrective(b.model, { seatedWeight: 1 }), { active: false, meshes: 0, weight: 1 });
  assert.deepEqual(b.mesh.morphTargetInfluences, [0.37, 0]);
  assert.equal(updateTailCorrective(null).active, false);
});

test("a coupled garment rim follows the same reversible weight while its other morphs stay intact", () => {
  const { mesh } = fixture();
  const rim = {
    isSkinnedMesh: true,
    userData: { tailPortCorrective: { version: 1, morph: "TailPortDrape" } },
    morphTargetDictionary: { TailPortDrape: 0, other: 1 },
    morphTargetInfluences: [0, 0.61],
  };
  const model = { traverse: (callback) => [mesh, rim].forEach(callback) };
  for (const weight of [0, 0.35, 1, 0.35, 0]) {
    assert.deepEqual(updateTailCorrective(model, { seatedWeight: weight }), { active: true, meshes: 2, weight });
    assert.deepEqual(mesh.morphTargetInfluences, [0.37, weight]);
    assert.deepEqual(rim.morphTargetInfluences, [weight, 0.61]);
  }
});
