import * as THREE from "../three.module.min.js";

// A full XYZ two-bone solve for an authored transfer's measured sole contacts.
// Bone lengths never change. An unreachable request remains visible in the
// evidence instead of silently stretching a leg to satisfy a contact claim.
export function createPlantedFeet(actor, reference) {
  const finite = (values, length) => Array.isArray(values) && values.length === length && values.every(Number.isFinite);
  const named = new Map();
  actor.traverse((object) => {
    if (object.isBone) named.set(object.name.replaceAll(".", ""), object);
  });
  const legs = ["L", "R"].map((side) => ({
    side,
    hip: named.get("Thigh" + side),
    knee: named.get("Shin" + side),
    foot: named.get("Foot" + side),
    reference: reference?.[side],
  }));
  if (
    legs.some(
      (leg) => !leg.hip || !leg.knee || !leg.foot || !finite(leg.reference?.soleCenterOffsetXYZ, 3) || !finite(leg.reference.footQuaternion, 4)
    )
  )
    throw new TypeError("Planted transfers require both actual leg chains and a model-bound sole reference");
  const p = new THREE.Vector3(),
    q = new THREE.Vector3(),
    r = new THREE.Vector3(),
    goal = new THREE.Vector3(),
    direction = new THREE.Vector3(),
    bend = new THREE.Vector3(),
    kneeGoal = new THREE.Vector3(),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    forward = new THREE.Vector3(),
    soleOffset = new THREE.Vector3(),
    rotation = new THREE.Quaternion(),
    parentRotation = new THREE.Quaternion(),
    worldRotation = new THREE.Quaternion(),
    footRotation = new THREE.Quaternion();
  let last = [];
  const aim = (bone, child, target) => {
    bone.getWorldPosition(a);
    child.getWorldPosition(b).sub(a).normalize();
    a.subVectors(target, a).normalize();
    rotation.setFromUnitVectors(b, a);
    bone.getWorldQuaternion(worldRotation);
    rotation.multiply(worldRotation);
    bone.parent.getWorldQuaternion(parentRotation).invert();
    bone.quaternion.copy(parentRotation.multiply(rotation));
    actor.updateMatrixWorld(true);
  };
  return {
    apply(feet, weight = 1) {
      const w = Math.max(0, Math.min(1, weight));
      last = [];
      if (!w) return last;
      actor.updateMatrixWorld(true);
      actor.getWorldQuaternion(worldRotation);
      forward.set(0, 0, 1).applyQuaternion(worldRotation);
      const actorRotation = worldRotation.clone();
      for (const leg of legs) {
        const contact = feet?.[leg.side]?.position;
        if (!finite(contact, 3)) throw new TypeError("A planted foot requires its exported actual floor point");
        leg.hip.getWorldPosition(p);
        leg.knee.getWorldPosition(q);
        leg.foot.getWorldPosition(r);
        leg.foot.getWorldQuaternion(footRotation);
        const l1 = p.distanceTo(q),
          l2 = q.distanceTo(r);
        goal.fromArray(contact);
        soleOffset.fromArray(leg.reference.soleCenterOffsetXYZ).applyQuaternion(actorRotation);
        goal.sub(soleOffset);
        goal.lerpVectors(r, goal, w);
        direction.subVectors(goal, p);
        const asked = direction.length(),
          limit = l1 + l2 - 0.0001,
          length = Math.max(Math.abs(l1 - l2) + 0.0001, Math.min(asked, limit)),
          reachViolation = Math.max(0, asked - limit, Math.abs(l1 - l2) + 0.0001 - asked);
        direction.normalize();
        goal.copy(p).addScaledVector(direction, length);
        const along = (l1 * l1 - l2 * l2 + length * length) / (2 * length),
          height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
        bend.copy(forward).addScaledVector(direction, -forward.dot(direction));
        // A nearly straight leg still keeps the authored knee plane.
        if (bend.lengthSq() < 1e-10) bend.subVectors(q, p).addScaledVector(direction, -q.clone().sub(p).dot(direction));
        bend.normalize();
        kneeGoal.copy(p).addScaledVector(direction, along).addScaledVector(bend, height);
        aim(leg.hip, leg.knee, kneeGoal);
        aim(leg.knee, leg.foot, goal);
        rotation.fromArray(leg.reference.footQuaternion).premultiply(actorRotation);
        footRotation.slerp(rotation, w);
        leg.foot.parent.getWorldQuaternion(parentRotation).invert();
        leg.foot.quaternion.copy(parentRotation.multiply(footRotation));
        actor.updateMatrixWorld(true);
        leg.foot.getWorldPosition(r);
        last.push({
          side: leg.side,
          weight: w,
          ankle: r.toArray(),
          goal: goal.toArray(),
          drift: r.distanceTo(goal),
          reachViolation,
          reachSlack: limit - asked,
        });
      }
      return last;
    },
    evidence: () => last.map((entry) => ({ ...entry })),
  };
}
