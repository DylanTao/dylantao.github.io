import * as THREE from "../three.module.min.js";

// Only the delivered ringed-tail skin belongs to this contact problem. Its
// trunk and planted paws already have their own independent support solution.
export function createRestingTailFit({ model, group, tail, ground }) {
  const samples = [];
  model.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const skin = mesh.geometry.attributes.skinIndex,
      weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < skin.count; i++) {
      let ownership = 0;
      for (let k = 0; k < 4; k++) if (/^Tail/.test(mesh.skeleton.bones[skin.getComponent(i, k)].name)) ownership += weights.getComponent(i, k);
      if (ownership > 1e-4) samples.push({ mesh, index: i });
    }
  });
  const point = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0),
    original = new THREE.Quaternion();
  function measure() {
    group.updateMatrixWorld(true);
    let minimum = null,
      missing = 0,
      visible = true;
    for (const sample of samples) {
      sample.mesh.getVertexPosition(sample.index, point).applyMatrix4(sample.mesh.matrixWorld);
      const support = ground.sample(point.x, point.z, point.y + 0.5);
      if (!support) {
        missing++;
        continue;
      }
      visible &&= support.visible;
      const gap = point.y - support.height;
      if (!minimum || gap < minimum.gap)
        minimum = { gap, point: point.clone(), mesh: sample.mesh.name, vertex: sample.index, supportMesh: support.mesh, triangle: support.triangle };
    }
    return { minimum, missing, visible };
  }
  return {
    update() {
      // The owning acting function restores the authored tail pose each frame.
      original.copy(tail.quaternion);
      const first = measure();
      let current = first,
        iterations = 0,
        reason = null;
      if (!samples.length || first.missing || !first.minimum) reason = "incomplete tail support";
      while (!reason && current.minimum.gap < 0.0006 && iterations < 12) {
        const pivot = tail.getWorldPosition(new THREE.Vector3()),
          radius = current.minimum.point.clone().sub(pivot),
          horizontal = Math.hypot(radius.x, radius.z);
        if (horizontal < 0.03) {
          reason = "contact is too near the tail pivot";
          break;
        }
        // Lift the offending part of the curled tail toward the local ground,
        // about its real hip attachment. A fixed model-x rotation poorly fits
        // a tail that has already curled sideways around the sleeping body.
        const axis = radius.cross(up).normalize(),
          angle = Math.min(0.22, Math.atan2(0.00065 - current.minimum.gap, horizontal) * 1.03),
          parent = tail.parent.getWorldQuaternion(new THREE.Quaternion()),
          correction = parent.clone().invert().multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle)).multiply(parent);
        tail.quaternion.premultiply(correction);
        iterations++;
        if (original.angleTo(tail.quaternion) > 0.65) {
          reason = "tail rotation exceeds the bounded joint fit";
          break;
        }
        current = measure();
        if (current.missing || !current.minimum) reason = "incomplete rotated tail support";
      }
      if (!reason && current.minimum.gap < 0.0006) reason = "tail contact did not converge";
      const attemptedGap = current.minimum?.gap ?? null;
      if (reason) {
        tail.quaternion.copy(original);
        group.updateMatrixWorld(true);
        current = first;
      }
      const witness = current.minimum;
      return {
        supported: !reason,
        reason,
        samples: samples.length,
        missing: current.missing,
        supportVisible: current.visible,
        beforeGap: first.minimum?.gap ?? null,
        gap: witness?.gap ?? null,
        attemptedGap,
        rotation: !reason && iterations ? original.angleTo(tail.quaternion) : 0,
        iterations,
        witness: witness ? { mesh: witness.mesh, vertex: witness.vertex, supportMesh: witness.supportMesh, triangle: witness.triangle } : null,
      };
    },
  };
}
