import * as THREE from "../three.module.min.js";
import { createHandContacts } from "./activities.mjs";

const ease = (t) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * u * (10 + u * (-15 + 6 * u));
};

// Original slow, prescribed gesture. Only the existing anatomical arm joints
// change; the water receives measured effector velocities, never this curve.
export function samplePoolStroke(seconds) {
  const t = ((seconds % 10) + 10) % 10;
  if (t < 1.2) return { phase: "rest", lift: 0, sweep: 0 };
  if (t < 2.4) return { phase: "lift", lift: ease((t - 1.2) / 1.2), sweep: 0 };
  if (t < 5) return { phase: "skim", lift: 1, sweep: 0.18 * ease((t - 2.4) / 2.6) };
  if (t < 7.6) return { phase: "return", lift: 1, sweep: 0.18 * (1 - ease((t - 5) / 2.6)) };
  if (t < 8.8) return { phase: "lower", lift: 1 - ease((t - 7.6) / 1.2), sweep: 0 };
  return { phase: "rest", lift: 0, sweep: 0 };
}

export function createPoolStroke(actor, { side = "L", palmOffset = 0.045, spread = 0.1 } = {}) {
  if (!["L", "R"].includes(side) || ![palmOffset, spread].every(Number.isFinite) || palmOffset <= 0 || palmOffset > 0.08 || spread < 0.086)
    throw new RangeError("bounded anatomical palm and resolved contact required");
  const named = new Map();
  actor.traverse((o) => {
    if (o.isBone) named.set(o.name.replaceAll(".", ""), o);
  });
  const hand = named.get("Hand" + side),
    otherHand = named.get("Hand" + (side === "L" ? "R" : "L")),
    chain = [named.get("Arm" + side), named.get("Forearm" + side), hand].filter(Boolean),
    available = chain.length === 3 && Boolean(otherHand),
    contacts = available ? createHandContacts(actor) : null,
    palmLocal = new THREE.Vector3(0, palmOffset, 0),
    palm = new THREE.Vector3(),
    wrist = new THREE.Vector3(),
    other = new THREE.Vector3(),
    target = new THREE.Vector3(),
    offset = new THREE.Vector3(),
    desiredWrist = new THREE.Vector3(),
    parentRotation = new THREE.Quaternion(),
    handRotation = new THREE.Quaternion(),
    baselines = chain.map((bone) => ({ bone, rotation: new THREE.Quaternion() }));
  let applied = false,
    restPalm = null,
    inward = null,
    previousPalm = null,
    seconds = 0,
    phase = "rest",
    lastElapsed = null,
    latestContacts = [],
    sampledContacts = 0,
    suppressedSamples = 0,
    maximumSpeed = 0,
    wristError = 0;

  function restore() {
    if (!applied) return;
    baselines.forEach(({ bone, rotation }) => bone.quaternion.copy(rotation));
    applied = false;
    actor.updateMatrixWorld(true);
  }
  function reset() {
    restore();
    restPalm = inward = previousPalm = null;
    seconds = 0;
    phase = "rest";
    lastElapsed = null;
    latestContacts = [];
    wristError = 0;
  }
  function update(delta, { active = true, surfaceY, depth = 0.2, elapsed = null } = {}) {
    if (
      !Number.isFinite(delta) ||
      delta < 0 ||
      !Number.isFinite(surfaceY) ||
      !Number.isFinite(depth) ||
      depth <= 0 ||
      depth > 1 ||
      (elapsed !== null && !Number.isFinite(elapsed))
    )
      throw new RangeError("finite active frame and world-space surface required");
    latestContacts = [];
    if (!available) return latestContacts;
    // Reapplying the held pose after restore is intentional during pause.
    // Leaving the activity or changing avatar must call reset() instead.
    restore();
    actor.updateMatrixWorld(true);
    hand.localToWorld(palm.copy(palmLocal));
    if (!restPalm) {
      restPalm = palm.clone();
      otherHand.getWorldPosition(other);
      inward = other.sub(palm).setY(0).normalize();
      lastElapsed = elapsed;
      previousPalm = null;
    } else if (active && delta > 0) {
      seconds += elapsed !== null && lastElapsed !== null ? Math.max(0, elapsed - lastElapsed) : delta;
    }
    if (elapsed !== null) lastElapsed = elapsed;
    // Arrival can still be blending from walk into soak. Let the independent
    // gesture clock run while its first rest tracks the authored pose; then
    // freeze the settled anchor. That blend never supplies a fluid impulse.
    const settling = seconds < 1.2;
    if (settling && active && delta > 0) {
      restPalm.copy(palm);
      otherHand.getWorldPosition(other);
      inward = other.sub(palm).setY(0).normalize();
    }
    const pose = samplePoolStroke(seconds),
      fade = ease(seconds / 2);
    phase = pose.phase;
    // At rest all joint transforms remain exactly the authored clip. The palm
    // skims 8 mm under the actual composed surface; lift stays below 12 cm.
    target.copy(restPalm).addScaledVector(inward, pose.sweep * fade);
    target.y += THREE.MathUtils.clamp(surfaceY - 0.008 - restPalm.y, -0.12, 0.12) * pose.lift * fade;
    if (pose.lift > 0 || pose.sweep > 0) {
      baselines.forEach(({ bone, rotation }) => rotation.copy(bone.quaternion));
      hand.getWorldPosition(wrist);
      hand.getWorldQuaternion(handRotation);
      offset.copy(palm).sub(wrist);
      desiredWrist.copy(target).sub(offset);
      const targets = side === "L" ? [desiredWrist.toArray(), null] : [null, desiredWrist.toArray()];
      contacts.solve(targets);
      // Keep the authored palm direction as the elbow changes, instead of
      // rolling the hand through the water with the forearm's inherited turn.
      hand.parent.getWorldQuaternion(parentRotation).invert();
      hand.quaternion.copy(parentRotation.multiply(handRotation));
      actor.updateMatrixWorld(true);
      hand.getWorldPosition(wrist);
      wristError = wrist.distanceTo(desiredWrist);
      applied = true;
    } else wristError = 0;
    hand.localToWorld(palm.copy(palmLocal));
    // First samples, zero-time composition and stalls cannot turn placement
    // jumps into fluid kicks. Resume seeds the current effector before forcing.
    const dt = delta,
      submergence = Math.max(0, surfaceY + 0.018 - palm.y);
    if (!settling && active && dt > 0 && dt <= 0.25 && previousPalm) {
      const velocity = palm.clone().sub(previousPalm).divideScalar(dt),
        speed = Math.hypot(velocity.x, velocity.z);
      if (speed <= 0.4 && submergence > 0 && submergence <= 0.2 && palm.y >= surfaceY - depth && speed > 1e-5) {
        latestContacts = [{ x: palm.x, y: palm.y, z: palm.z, vx: velocity.x, vz: velocity.z, submergence, spread }];
        maximumSpeed = Math.max(maximumSpeed, speed);
        sampledContacts++;
      } else if (speed > 0.4) suppressedSamples++;
    } else if (active && dt > 0.25) suppressedSamples++;
    previousPalm = !settling && active && dt > 0 ? palm.clone() : null;
    return latestContacts;
  }
  return {
    restore,
    reset,
    update,
    evidence: () => ({
      method: "prescribed anatomical IK / measured submerged palm velocity",
      available,
      side,
      phase,
      seconds,
      restPalm: restPalm?.toArray() || null,
      palm: available && restPalm ? palm.toArray() : null,
      wristError,
      contacts: latestContacts.map((c) => ({ ...c })),
      sampledContacts,
      suppressedSamples,
      maximumSpeed,
      applied,
    }),
  };
}
