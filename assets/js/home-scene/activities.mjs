import * as THREE from "../three.module.min.js";
const ease = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * ease(t));
const leg = (a, b, t) => ({ position: mix(a, b, t), facing: Math.atan2(b[0] - a[0], b[2] - a[2]), clip: "walk" });

// Short, deterministic sequences use only the exported equipment locations.
// Time advances only while the scene is visible and system motion is enabled.
export function activityPose(sequence, seconds, equipment, room) {
  if (!equipment) return null;
  if (sequence === "coffee") {
    const c = equipment.coffee,
      t = seconds % 100;
    const brewer = [c.actor[0] - 0.34, c.actor[1], c.actor[2] - 0.2],
      grinder = [brewer[0], brewer[1], c.grinder[2] - 0.2];
    const way = c.approach[1];
    if (t < 3) return { position: c.seat, facing: room.facing, clip: "eat", phase: "at the table" };
    if (t < 5) return { ...leg(c.seat, way, (t - 3) / 2), phase: "approach" };
    if (t < 9) return { ...leg(way, grinder, (t - 5) / 4), phase: "approach" };
    if (t < 15) return { position: grinder, facing: c.facing, clip: "coffee-prep", hands: [null, c.grinder], phase: "grind" };
    if (t < 17) return { ...leg(grinder, brewer, (t - 15) / 2), phase: "prepare" };
    if (t < 23) return { position: brewer, facing: c.facing, clip: "coffee-prep", hands: [null, c.brew], phase: "prepare" };
    if (t < 29) return { position: brewer, facing: c.facing, clip: "idle", phase: "brew", brew: true };
    if (t < 31) return { position: brewer, facing: c.facing, clip: "coffee-prep", hands: [null, c.cup], phase: "pick up", cup: t >= 30 };
    if (t < 36) return { ...leg(brewer, way, (t - 31) / 5), phase: "carry", cup: true };
    if (t < 39) return { ...leg(way, c.seat, (t - 36) / 3), phase: "return", cup: true };
    if (t < 65) return { position: c.seat, facing: room.facing, clip: "drink", phase: "coffee by the ocean", cup: true };
    if (t < 69) return { ...leg(c.seat, way, (t - 65) / 4), phase: "return cup", cup: true };
    if (t < 74) return { ...leg(way, brewer, (t - 69) / 5), phase: "return cup", cup: true };
    if (t < 77) return { position: brewer, facing: c.facing, clip: "coffee-prep", hands: [null, c.cup], phase: "set down", cup: t < 76.5 };
    if (t < 82) return { ...leg(brewer, way, (t - 77) / 5), phase: "return" };
    if (t < 86) return { ...leg(way, c.seat, (t - 82) / 4), phase: "return" };
    return { position: c.seat, facing: room.facing, clip: "eat", phase: "at the table" };
  }
  if (sequence === "strength") {
    const t = seconds % 76,
      p = equipment.pullup,
      d = equipment.dip,
      w = equipment.dumbbell;
    const rest = room.actor;
    if (t < 3) return { ...leg(rest, p.actor, t / 3), phase: "approach pull-up bar" };
    if (t < 19)
      return {
        position: p.actor,
        facing: p.facing,
        clip: "pullup",
        hands: p.hands,
        contactBlend: ease((t - 3) / 1.2) * ease((19 - t) / 1.2),
        phase: "pull-ups",
      };
    if (t < 23) return { ...leg(p.actor, rest, (t - 19) / 4), phase: "rest" };
    if (t < 28) return { position: rest, facing: room.facing, clip: "idle", phase: "rest" };
    if (t < 30) return { ...leg(rest, d.actor, (t - 28) / 2), phase: "approach dip bars" };
    if (t < 46)
      return {
        position: d.actor,
        facing: d.facing,
        clip: "dip",
        hands: d.hands,
        contactBlend: ease((t - 30) / 1.2) * ease((46 - t) / 1.2),
        phase: "dips",
      };
    if (t < 50) return { ...leg(d.actor, w.actor, (t - 46) / 4), phase: "approach dumbbells" };
    if (t < 54)
      return {
        position: w.actor,
        facing: w.facing,
        clip: "idle",
        hands: [null, w.rest],
        contactBlend: ease((t - 50) / 1.2),
        weight: t >= 53,
        phase: "pick up weight",
      };
    if (t < 66) return { position: w.actor, facing: w.facing, clip: "workout", weight: true, phase: "dumbbell set" };
    if (t < 70)
      return {
        position: w.actor,
        facing: w.facing,
        clip: "idle",
        hands: [null, w.rest],
        contactBlend: ease((t - 66) / 1.2),
        weight: t < 69,
        phase: "return weight",
      };
    if (t < 74) return { ...leg(w.actor, rest, (t - 70) / 4), phase: "return" };
    return { position: rest, facing: room.facing, clip: "idle", phase: "rest" };
  }
  return null;
}

export function createHandContacts(actor) {
  const named = (name) => {
    let found;
    actor.traverse((o) => {
      if (o.isBone && o.name.replaceAll(".", "") === name) found = o;
    });
    return found;
  };
  const limbs = ["L", "R"].map((s) => ({ upper: named("Arm" + s), lower: named("Forearm" + s), hand: named("Hand" + s), side: s }));
  const v = () => new THREE.Vector3(),
    a = v(),
    b = v(),
    c = v(),
    goal = v(),
    direction = v(),
    bend = v(),
    elbow = v(),
    u = v(),
    w = v();
  const q = new THREE.Quaternion(),
    parent = new THREE.Quaternion();
  function aim(bone, child, target) {
    bone.getWorldPosition(u);
    child.getWorldPosition(w);
    w.sub(u).normalize();
    u.copy(target).sub(bone.getWorldPosition(v())).normalize();
    q.setFromUnitVectors(w, u).multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    bone.parent.getWorldQuaternion(parent).invert();
    bone.quaternion.copy(parent.multiply(q));
    actor.updateMatrixWorld(true);
  }
  let drift = [];
  return {
    solve(targets, weight = 1) {
      drift = [];
      actor.updateMatrixWorld(true);
      limbs.forEach((limb, i) => {
        if (!targets?.[i] || !limb.hand) return;
        limb.upper.getWorldPosition(a);
        limb.lower.getWorldPosition(b);
        limb.hand.getWorldPosition(c);
        goal.fromArray(targets[i]).lerp(c, 1 - weight);
        const l1 = a.distanceTo(b),
          l2 = b.distanceTo(c);
        direction.copy(goal).sub(a);
        const distance = Math.min(direction.length(), l1 + l2 - 0.00001);
        direction.normalize();
        const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * Math.max(distance, 0.00001));
        bend.set(limb.side === "L" ? -0.7 : 0.7, -0.4, 0.45).applyQuaternion(actor.quaternion);
        bend.addScaledVector(direction, -bend.dot(direction)).normalize();
        elbow
          .copy(a)
          .addScaledVector(direction, along)
          .addScaledVector(bend, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
        aim(limb.upper, limb.lower, elbow);
        aim(limb.lower, limb.hand, goal);
        drift.push(limb.hand.getWorldPosition(c).distanceTo(goal));
      });
    },
    evidence: () => drift,
  };
}
