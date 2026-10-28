// Apply after the animation mixer and pose composition. Untagged public rigs
// remain untouched; the caller owns the actual seated/transfer blend weight.
const bindings = new WeakMap();

function findBindings(model) {
  const result = [];
  model?.traverse?.((mesh) => {
    const definition = mesh.userData?.tailCorrective || mesh.userData?.tailPortCorrective;
    if (!mesh.isSkinnedMesh || definition?.version !== 1) return;
    const index = mesh.morphTargetDictionary?.[definition.morph];
    if (!Number.isInteger(index) || !mesh.morphTargetInfluences) return;
    result.push({ mesh, index });
  });
  return result;
}

export function updateTailCorrective(model, { seatedWeight = 0 } = {}) {
  if (!model || (typeof model !== "object" && typeof model !== "function")) return { active: false, meshes: 0, weight: 0 };
  let bound = bindings.get(model);
  if (!bound) {
    bound = findBindings(model);
    bindings.set(model, bound);
  }
  const weight = Number.isFinite(seatedWeight) ? Math.max(0, Math.min(1, seatedWeight)) : 0;
  for (const { mesh, index } of bound) mesh.morphTargetInfluences[index] = weight;
  return { active: bound.length > 0, meshes: bound.length, weight };
}
