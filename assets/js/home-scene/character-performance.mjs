import * as THREE from "../three.module.min.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (v) => {
  const t = clamp(v, 0, 1);
  return t * t * t * (10 + t * (-15 + 6 * t));
};
const blinkCurve = (age) => (age < 0 ? 0 : age < 0.085 ? smooth(age / 0.085) : age < 0.125 ? 1 : age < 0.285 ? 1 - smooth((age - 0.125) / 0.16) : 0);
const protectedClip = (clip) => /sleep|pullup|dip|workout|coffee-prep|carry|walk/.test(clip);
const faceContactClip = (clip) => /^(drink|eat)$/.test(clip);
const gazeRange = [0.2, 0.12];

// The visitor's screen point is a ray through the real camera. Its target lies
// halfway between the eyes and the visitor, rather than in the eye plane (which
// would demand a 90-degree turn). Resolve it in the authored head's optical +Z
// frame: screen-right is not always character-right in an inhabited room.
export function cameraAttentionTarget(x, y, camera, origin, headRotation) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  camera.updateWorldMatrix(true, false);
  const visitor = camera.getWorldPosition(new THREE.Vector3());
  if (visitor.distanceToSquared(origin) < 0.0001) return null;
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), visitor.clone().lerp(origin, 0.5));
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(clamp(x, -1, 1), clamp(y, -1, 1)), camera);
  const target = ray.ray.intersectPlane(plane, new THREE.Vector3());
  if (!target) return null;
  const worldDirection = target.sub(origin).normalize();
  const direction = worldDirection.clone().applyQuaternion(headRotation.clone().invert());
  if (direction.z <= 0) return null; // A rear view cannot invite a visible gaze.
  const requested = [Math.atan2(direction.x, direction.z), Math.atan2(direction.y, Math.hypot(direction.x, direction.z))];
  return {
    direction: direction.toArray(),
    worldDirection: worldDirection.toArray(),
    requested,
    angles: requested.map((v, i) => clamp(v, -gazeRange[i], gazeRange[i])),
  };
}

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
    canNotice: () => time >= cooldown && !episode,
    notice(x, y) {
      if (time < cooldown || episode || !Number.isFinite(x) || !Number.isFinite(y)) return false;
      episode = { start: time, x: clamp(x, -1, 1) * gazeRange[0], y: clamp(y, -1, 1) * gazeRange[1] };
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
      const protectedPose = protectedClip(clip);
      const headLocked = protectedPose || faceContactClip(clip);
      if (protectedPose) {
        episode = null;
        eyeX = eyeY = headX = headY = 0;
      }
      const ageAttention = episode ? time - episode.start : -1;
      const hold = ageAttention < 0 ? 0 : ageAttention < 1.35 ? smooth(ageAttention / 0.15) : 1 - smooth((ageAttention - 1.35) / 1.1);
      const headHold =
        ageAttention < 0.15 ? 0 : ageAttention < 1.35 ? smooth((ageAttention - 0.15) / 0.48) : 1 - smooth((ageAttention - 1.35) / 1.25);
      const targetX = protectedPose ? 0 : (episode?.x || 0) * hold;
      const targetY = protectedPose ? 0 : (episode?.y || 0) * hold;
      eyeX += (targetX - eyeX) * (1 - Math.exp(-dt * 22));
      eyeY += (targetY - eyeY) * (1 - Math.exp(-dt * 22));
      if (headLocked) headX = headY = 0;
      else {
        headX += ((episode?.x || 0) * headHold * 0.42 - headX) * (1 - Math.exp(-dt * 5));
        headY += ((episode?.y || 0) * headHold * 0.3 - headY) * (1 - Math.exp(-dt * 5));
      }
      if (ageAttention > 2.65) episode = null;
      // Submillimeter breath and a slight neck settle add overlap without
      // touching Spine, Root or the fitted wrists, fingers and feet.
      const breath = headLocked ? 0 : Math.sin((time * Math.PI * 2) / 4.7 + seed * 0.31);
      pose = {
        blink: clip === "sleep" ? [1, 1] : [blink, Math.max(blinkCurve(age - 0.012), blinkCount % 4 === 0 ? blinkCurve(age - 0.352) * 0.88 : 0)],
        eye: [eyeX - headX, eyeY - headY],
        head: [headX, headY + breath * 0.006, headLocked ? 0 : Math.sin(time * 0.61) * 0.003],
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
  let canAttend = true,
    attentionTarget = null;
  const head = bones.find(({ bone }) => bone.name === "Head"),
    eyes = bones.filter(({ bone }) => bone !== head?.bone);
  const offset = new THREE.Quaternion(),
    euler = new THREE.Euler(),
    origin = new THREE.Vector3(),
    opticalRotation = new THREE.Quaternion(),
    eyePosition = new THREE.Vector3();
  return {
    notice(x, y, camera) {
      if (!canAttend || !motion.canNotice()) return false;
      if (!camera) return motion.notice(x, y);
      if (!head || !eyes.length) return false;
      actor.updateWorldMatrix(true, true);
      origin.set(0, 0, 0);
      eyes.forEach(({ bone }) => origin.add(bone.getWorldPosition(eyePosition)));
      origin.divideScalar(eyes.length);
      // Exclude our previous additive turn; its authored baseline is retained
      // for restoration before the next mixer/contact update.
      if (head.bone.parent) head.bone.parent.getWorldQuaternion(opticalRotation);
      else opticalRotation.identity();
      opticalRotation.multiply(applied ? head.rotation : head.bone.quaternion);
      attentionTarget = cameraAttentionTarget(x, y, camera, origin, opticalRotation);
      return attentionTarget ? motion.notice(...attentionTarget.angles.map((v, i) => v / gazeRange[i])) : false;
    },
    restore() {
      if (!applied) return;
      for (const { bone, rotation, position } of bones) {
        bone.quaternion.copy(rotation);
        bone.position.copy(position);
      }
      applied = false;
    },
    update(delta, { active, clip }) {
      canAttend = active && !protectedClip(clip);
      const pose = motion.advance(delta, { active, clip });
      if (!canAttend) attentionTarget = null;
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
    evidence: () => ({
      ...motion.evidence(),
      eyelidMeshes: lids.length,
      headOnly: true,
      attentionTarget: attentionTarget
        ? {
            direction: [...attentionTarget.direction],
            worldDirection: [...attentionTarget.worldDirection],
            requested: [...attentionTarget.requested],
            angles: [...attentionTarget.angles],
          }
        : null,
    }),
    dispose() {
      this.restore();
      canAttend = false;
      attentionTarget = null;
      lids.forEach((mesh) =>
        ["L", "R"].forEach((side) => {
          mesh.morphTargetInfluences[mesh.morphTargetDictionary["Blink" + side]] = 0;
        })
      );
      bones.length = lids.length = 0;
    },
  };
}
