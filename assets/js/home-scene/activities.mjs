import * as THREE from "../three.module.min.js";
const ease = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * ease(t));
const leg = (a, b, t) => ({ position: mix(a, b, t), facing: Math.atan2(b[0] - a[0], b[2] - a[2]), clip: "walk" });

// Breakfast is one story per visit (Sirui, 2026-10-24: the old 100-second loop made coffee again
// and again): sit, make the coffee, carry it to the nook, drink it looking at the sea, eat breakfast
// with it (dining.mjs), take the cup back to the bar and sit on with the view. Seconds from arrival.
export const COFFEE_TIMELINE = Object.freeze({ table: 39, food: 64, foodEnd: 254, back: 275 });
// The seated breakfast's own clock (dining.mjs plans the meal on it): table time since the coffee
// arrived, paused while he walks the cup back, and whether the cup is still with him.
export function coffeeTableClock(seconds) {
  const T = COFFEE_TIMELINE,
    t = Math.max(0, Number(seconds) || 0);
  if (t < T.table) return { table: false, seconds: 0, cup: false };
  if (t < T.foodEnd) return { table: true, seconds: t - T.table, cup: true, prelude: t < T.food };
  if (t < T.back) return { table: false, seconds: T.foodEnd - T.table, cup: false };
  return { table: true, seconds: T.foodEnd - T.table + (t - T.back), cup: false, after: true };
}

// Short, deterministic sequences use only the exported equipment locations. (The gym's training
// session is choreographed by gym-session.mjs.) Time advances only while the scene is visible and
// system motion is enabled.
export function activityPose(sequence, seconds, equipment, room) {
  if (!equipment) return null;
  if (sequence === "coffee") {
    const c = equipment.coffee,
      t = Math.max(0, seconds),
      T = COFFEE_TIMELINE;
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
    if (t < T.table) return { ...leg(way, c.seat, (t - 36) / 3), phase: "return", cup: true };
    if (t < T.food) return { position: c.seat, facing: room.facing, clip: "drink", phase: "coffee by the ocean", cup: true };
    if (t < T.foodEnd) return { position: c.seat, facing: room.facing, clip: "eat", phase: "breakfast", cup: true };
    const u = t - T.foodEnd;
    if (u < 4) return { ...leg(c.seat, way, u / 4), phase: "return cup", cup: true };
    if (u < 9) return { ...leg(way, brewer, (u - 4) / 5), phase: "return cup", cup: true };
    if (u < 12) return { position: brewer, facing: c.facing, clip: "coffee-prep", hands: [null, c.cup], phase: "set down", cup: u < 11.5 };
    if (u < 17) return { ...leg(brewer, way, (u - 12) / 5), phase: "return" };
    if (u < 21) return { ...leg(way, c.seat, (u - 17) / 4), phase: "return" };
    return { position: c.seat, facing: room.facing, clip: "eat", phase: "at the table" };
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
