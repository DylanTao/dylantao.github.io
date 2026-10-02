import * as THREE from "../three.module.min.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (v) => {
  const t = clamp(v, 0, 1);
  return t * t * t * (10 + t * (-15 + 6 * t));
};
const blinkCurve = (age) => (age < 0 ? 0 : age < 0.085 ? smooth(age / 0.085) : age < 0.125 ? 1 : age < 0.285 ? 1 - smooth((age - 0.125) / 0.16) : 0);

// A local authored attention score, not person detection. Eyes acknowledge an
// invitation before the head; a short hold and habituation protect the routine.
export function createCharacterMotion(seed = 0) {
  let time = 0,
    nextBlink = 2.8 + (seed % 7) * 0.17,
    blinkStart = -10,
    blinkCount = 0;
  let episode = null,
    cooldown = 0,
    eyeX = 0,
    eyeY = 0,
    headX = 0,
    headY = 0;
  let pose = { blink: [0, 0], eye: [0, 0], head: [0, 0, 0], breath: 0, phase: "routine", seconds: 0 };
  return {
    notice(x, y) {
      if (time < cooldown || episode) return false;
      episode = { start: time, x: clamp(x, -1, 1) * 0.2, y: clamp(y, -1, 1) * 0.12 };
      cooldown = time + 8.5 + (seed % 3) * 0.9;
      // An occasional blink bridges an intentional change of attention.
      if (blinkCount % 2 === 0) nextBlink = Math.min(nextBlink, time + 0.1);
      return true;
    },
    advance(delta, { active = true, clip = "idle" } = {}) {
      if (!active) {
        episode = null;
        eyeX = eyeY = headX = headY = 0;
        blinkStart = -10;
        nextBlink = time + 3.2;
        pose = { blink: clip === "sleep" ? [1, 1] : [0, 0], eye: [0, 0], head: [0, 0, 0], breath: 0, phase: "still", seconds: time };
        return pose;
      }
      const dt = Math.max(0, Number.isFinite(delta) ? delta : 0);
      time += dt;
      if (time >= nextBlink) {
        blinkStart = time;
        blinkCount++;
        const intervals = [4.1, 5.8, 3.7, 6.3, 4.9];
        nextBlink = time + intervals[(blinkCount + seed) % intervals.length];
      }
      const age = time - blinkStart;
      const blink = Math.max(blinkCurve(age), blinkCount % 4 === 0 ? blinkCurve(age - 0.34) * 0.88 : 0);
      const protectedPose = /sleep|pullup|dip|workout|coffee-prep|carry|walk/.test(clip);
      const ageAttention = episode ? time - episode.start : -1;
      const hold = ageAttention < 0 ? 0 : ageAttention < 1.35 ? smooth(ageAttention / 0.15) : 1 - smooth((ageAttention - 1.35) / 1.1);
      const headHold =
        ageAttention < 0.15 ? 0 : ageAttention < 1.35 ? smooth((ageAttention - 0.15) / 0.48) : 1 - smooth((ageAttention - 1.35) / 1.25);
      const targetX = protectedPose ? 0 : (episode?.x || 0) * hold;
      const targetY = protectedPose ? 0 : (episode?.y || 0) * hold;
      eyeX += (targetX - eyeX) * (1 - Math.exp(-dt * 22));
      eyeY += (targetY - eyeY) * (1 - Math.exp(-dt * 22));
      headX += ((protectedPose ? 0 : (episode?.x || 0) * headHold * 0.42) - headX) * (1 - Math.exp(-dt * 5));
      headY += ((protectedPose ? 0 : (episode?.y || 0) * headHold * 0.3) - headY) * (1 - Math.exp(-dt * 5));
      if (ageAttention > 2.65) episode = null;
      // Submillimeter breath and a slight neck settle add overlap without
      // touching Spine, Root or the fitted wrists, fingers and feet.
      const breath = protectedPose ? 0 : Math.sin((time * Math.PI * 2) / 4.7 + seed * 0.31);
      pose = {
        blink: clip === "sleep" ? [1, 1] : [blink, Math.max(blinkCurve(age - 0.012), blinkCount % 4 === 0 ? blinkCurve(age - 0.352) * 0.88 : 0)],
        eye: [eyeX - headX, eyeY - headY],
        head: [headX, headY + breath * 0.006, protectedPose ? 0 : Math.sin(time * 0.61) * 0.003],
        breath: breath * 0.00065,
        phase: protectedPose ? "routine" : episode ? (ageAttention < 0.25 ? "glance" : ageAttention < 1.35 ? "acknowledge" : "return") : "routine",
        seconds: time,
      };
      return pose;
    },
    evidence: () => ({
      ...pose,
      blink: [...pose.blink],
      eye: [...pose.eye],
      head: [...pose.head],
      blinkCount,
      cooldownRemaining: Math.max(0, cooldown - time),
    }),
  };
}

export function createCharacterPerformance(actor, avatarId = "") {
  const seed = [...avatarId].reduce((value, c) => value + c.charCodeAt(0), 0);
  const motion = createCharacterMotion(seed);
  const bones = [],
    lids = [];
  actor.traverse((o) => {
    if (o.isBone && (o.name === "Head" || /^Eye[._]?[LR]$/.test(o.name)))
      bones.push({ bone: o, rotation: o.quaternion.clone(), position: o.position.clone() });
    if (o.morphTargetDictionary?.BlinkL !== undefined) lids.push(o);
  });
  let applied = false;
  const offset = new THREE.Quaternion(),
    euler = new THREE.Euler();
  return {
    notice: motion.notice,
    restore() {
      if (!applied) return;
      for (const { bone, rotation, position } of bones) {
        bone.quaternion.copy(rotation);
        bone.position.copy(position);
      }
      applied = false;
    },
    update(delta, { active, clip }) {
      const pose = motion.advance(delta, { active, clip });
      for (const entry of bones) {
        const { bone, rotation, position } = entry;
        rotation.copy(bone.quaternion);
        position.copy(bone.position);
        const isHead = bone.name === "Head";
        const [yaw, pitch] = isHead ? pose.head : pose.eye;
        // Exported optical forward is Three +Z: screen-up is negative X,
        // horizontal attention turns about Y, and only the head rolls about Z.
        euler.set(-pitch, yaw, isHead ? pose.head[2] : 0, "XYZ");
        if (isHead) {
          bone.position.y += pose.breath;
        }
        bone.quaternion.multiply(offset.setFromEuler(euler));
      }
      lids.forEach((mesh) =>
        ["L", "R"].forEach((side, i) => {
          mesh.morphTargetInfluences[mesh.morphTargetDictionary["Blink" + side]] = pose.blink[i];
        })
      );
      applied = true;
    },
    evidence: () => ({ ...motion.evidence(), eyelidMeshes: lids.length, headOnly: true }),
    dispose() {
      this.restore();
      lids.forEach((mesh) =>
        ["L", "R"].forEach((side) => {
          mesh.morphTargetInfluences[mesh.morphTargetDictionary["Blink" + side]] = 0;
        })
      );
      bones.length = lids.length = 0;
    },
  };
}
