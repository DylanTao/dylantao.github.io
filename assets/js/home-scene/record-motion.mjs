// The platter is a driven rotor; the cue mechanism is two critically damped
// coordinates. All time is active time, so hiding the player adds no impulse.
export const RECORD_RPM = 33 + 1 / 3;
const speed = (RECORD_RPM * Math.PI * 2) / 60;
const inertia = 0.0036; // kg m², a 180 g, 12-inch disc plus a light platter

export function criticalStep(position, velocity, target, seconds, frequency = 18) {
  const dt = Math.max(0, seconds),
    displacement = position - target,
    c = velocity + frequency * displacement,
    decay = Math.exp(-frequency * dt);
  return [target + (displacement + c * dt) * decay, (velocity - frequency * c * dt) * decay];
}

export function rotorStep(angle, velocity, target, seconds, response = 0.72) {
  const dt = Math.max(0, seconds),
    decay = Math.exp(-dt / response);
  return [angle + target * dt + (velocity - target) * response * (1 - decay), target + (velocity - target) * decay];
}

export function createRecordMotion() {
  let angle = 0,
    velocity = 0,
    yaw = 0.28,
    yawVelocity = 0,
    lift = 0.36,
    liftVelocity = 0,
    playing = false,
    cueRemaining = 0,
    cueHeld = false,
    heldYaw = yaw,
    phase = "parked";
  const raised = 0.46,
    contact = 0.1;
  function raise() {
    heldYaw = yaw;
    phase = "lifting";
  }
  const evidence = () => ({
    angle,
    velocity,
    rpm: (velocity * 60) / (Math.PI * 2),
    yaw,
    lift,
    yawVelocity,
    liftVelocity,
    phase,
    playing,
    energy: 0.5 * inertia * velocity ** 2,
  });
  return {
    setPlaying(next) {
      if (playing !== next) raise();
      playing = next;
    },
    cue(hold = false) {
      cueRemaining = 0.28;
      cueHeld = hold;
      raise();
    },
    completeCue() {
      cueHeld = false;
    },
    advance(seconds) {
      const dt = Math.max(0, seconds);
      // Split exactly at the motor's cue boundary; its angle integral is
      // independent of frame cadence, including a rapid brake/restart.
      const braking = cueHeld ? dt : Math.min(cueRemaining, dt);
      if (braking) [angle, velocity] = rotorStep(angle, velocity, 0, braking, 0.3);
      [angle, velocity] = rotorStep(angle, velocity, playing ? speed : 0, dt - braking, playing ? 0.72 : 0.3);
      const steps = Math.max(1, Math.ceil(dt * 120)),
        step = dt / steps;
      for (let i = 0; i < steps; i++) {
        cueRemaining = Math.max(0, cueRemaining - step);
        const targetYaw = playing ? 0 : 0.28,
          targetLift = playing ? contact : 0.36;
        if (phase === "lifting") {
          [yaw, yawVelocity] = criticalStep(yaw, yawVelocity, heldYaw, step);
          [lift, liftVelocity] = criticalStep(lift, liftVelocity, raised, step);
          if (lift > raised - 0.004) phase = "swinging";
        } else if (phase === "swinging") {
          [lift, liftVelocity] = criticalStep(lift, liftVelocity, raised, step);
          [yaw, yawVelocity] = criticalStep(yaw, yawVelocity, targetYaw, step);
          if (Math.abs(yaw - targetYaw) < 0.003 && cueRemaining === 0 && !cueHeld) phase = "lowering";
        } else {
          [yaw, yawVelocity] = criticalStep(yaw, yawVelocity, targetYaw, step);
          [lift, liftVelocity] = criticalStep(lift, liftVelocity, targetLift, step, 14);
          if (Math.abs(lift - targetLift) < 0.0003 && Math.abs(liftVelocity) < 0.003) phase = playing ? "tracking" : "parked";
        }
        // Unilateral stylus contact: the needle cannot pass through the disc.
        if (lift < contact) {
          lift = contact;
          liftVelocity = Math.max(0, liftVelocity);
        }
      }
      if (!playing && velocity < 0.00002) velocity = 0;
      return evidence();
    },
    compose() {
      yaw = playing ? 0 : 0.28;
      lift = playing ? contact : 0.36;
      yawVelocity = liftVelocity = 0;
      cueRemaining = 0;
      cueHeld = false;
      phase = playing ? "tracking" : "parked";
      return evidence();
    },
    evidence,
    needsFrame: () => playing || velocity > 0 || !["tracking", "parked"].includes(phase),
  };
}
