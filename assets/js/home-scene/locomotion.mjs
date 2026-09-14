import * as THREE from "../three.module.min.js";
import { supportHeight } from "./shore.mjs";

// Constrain the authored walking pose to the actual floor and stair treads.
// The mixer still supplies the gait; this short two-bone solve prevents a
// climbing foot from passing through a riser or hovering above its support.
export function createFootContacts(actor, terrain) {
  const legs = ["L", "R"]
    .map((side) => {
      const named = (prefix) => {
        let result;
        actor.traverse((o) => {
          if (o.isBone && o.name.replaceAll(".", "") === prefix + side) result = o;
        });
        return result;
      };
      return { hip: named("Thigh"), knee: named("Shin"), foot: named("Foot") };
    })
    .filter((leg) => leg.hip && leg.knee && leg.foot);
  const p = new THREE.Vector3(),
    q = new THREE.Vector3(),
    r = new THREE.Vector3(),
    goal = new THREE.Vector3();
  const direction = new THREE.Vector3(),
    bend = new THREE.Vector3(),
    kneeGoal = new THREE.Vector3();
  const rotation = new THREE.Quaternion(),
    parentRotation = new THREE.Quaternion();
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    forward = new THREE.Vector3();

  function aim(bone, child, target) {
    bone.getWorldPosition(a);
    child.getWorldPosition(b);
    b.sub(a).normalize();
    a.copy(target).sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
    rotation.setFromUnitVectors(b, a);
    rotation.multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    bone.parent.getWorldQuaternion(parentRotation).invert();
    bone.quaternion.copy(parentRotation.multiply(rotation));
    actor.updateMatrixWorld(true);
  }

  return (onStairs) => {
    actor.updateMatrixWorld(true);
    forward.set(0, 0, 1).applyQuaternion(actor.quaternion);
    for (const leg of legs) {
      leg.hip.getWorldPosition(p);
      leg.knee.getWorldPosition(q);
      leg.foot.getWorldPosition(r);
      const floor = supportHeight(r.x, r.z, terrain, actor.position.y, onStairs);
      goal.copy(r);
      const behind = r.clone().sub(p).dot(forward) < 0;
      goal.y = behind ? floor + 0.075 : Math.max(r.y, floor + 0.075);
      const l1 = p.distanceTo(q),
        l2 = q.distanceTo(r);
      direction.copy(goal).sub(p);
      const distance = Math.min(direction.length(), l1 + l2 - 0.0001);
      direction.normalize();
      goal.copy(p).addScaledVector(direction, distance);
      const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
      const height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
      bend.copy(forward).addScaledVector(direction, -forward.dot(direction)).normalize();
      kneeGoal.copy(p).addScaledVector(direction, along).addScaledVector(bend, height);
      aim(leg.hip, leg.knee, kneeGoal);
      aim(leg.knee, leg.foot, goal);
    }
  };
}
