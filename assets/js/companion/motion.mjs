// Original browser choreography. Reachy Mini's independently posed head,
// antennae and body, and its minimum-jerk timing, informed this small rig.
// See /projects/pip/#credits. No recorded robot motions or SDK are bundled.
import { randomSource, spring } from "./behaviour.mjs";

const rest = { pitch: 0, yaw: 0, roll: 0, lift: 0, lean: 0, left: 0, right: 0, armL: 0, armR: 0, close: 0 };
export const gestures = {
  hello: [
    [0.35, { lift: 0.07, pitch: -0.09, left: -0.2, right: 0.28 }],
    [0.85, { roll: -0.12, armR: -0.65, right: 0.48 }],
    [1.25, { roll: 0.08, armR: -0.45, right: -0.08 }],
    [1.65, { roll: -0.08, armR: -0.7, right: 0.3 }],
    [2.6, {}],
  ],
  curious: [
    [0.5, { yaw: -0.16, pitch: -0.08, lift: 0.035 }],
    [1.15, { roll: 0.24, yaw: 0.1, left: 0.28, right: 0.08 }],
    [2.25, { roll: 0.24, yaw: 0.1, left: 0.28, right: 0.08 }],
    [3.2, {}],
  ],
  nod: [
    [0.35, { pitch: -0.13, lift: 0.035 }],
    [0.7, { pitch: 0.2, left: 0.14, right: -0.12 }],
    [1.05, { pitch: -0.1 }],
    [1.4, { pitch: 0.12 }],
    [2.1, {}],
  ],
  peek: [
    [0.65, { yaw: -0.35, roll: -0.12, lean: -0.06, left: -0.2 }],
    [1.45, { yaw: 0.3, roll: 0.1, right: 0.26 }],
    [2.6, {}],
  ],
  repair: [
    [0.25, { pitch: -0.2, lift: 0.07, armL: -0.22, armR: 0.22, left: -0.35, right: 0.35 }],
    [0.65, { pitch: 0.23, roll: -0.16, lift: -0.025, armL: 0.4, armR: -0.4 }],
    [1.35, { pitch: 0.16, roll: 0.09, armL: 0.22, armR: -0.22 }],
    [1.8, { pitch: -0.1, armR: -0.25 }],
    [2.7, {}],
  ],
  sleepy: [
    [0.8, { pitch: 0.15, lift: -0.055, close: 0.65, left: 0.3, right: -0.3 }],
    [2, { pitch: 0.19, roll: -0.12, lift: -0.06, close: 1, left: 0.38, right: -0.38 }],
    [3.8, {}],
  ],
};

// The standard zero-velocity, zero-acceleration quintic trajectory.
export function minimumJerk(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (10 + x * (-15 + 6 * x));
}

export function sampleGesture(name, time, start = rest) {
  let previous = [0, start];
  for (const frame of gestures[name] || []) {
    if (time <= frame[0]) {
      const u = minimumJerk((time - previous[0]) / (frame[0] - previous[0]));
      return Object.fromEntries(Object.keys(rest).map((k) => [k, (previous[1][k] || 0) * (1 - u) + (frame[1][k] || 0) * u]));
    }
    previous = frame;
  }
  return { ...rest };
}

export function createPipMotion(seed = 61) {
  const random = randomSource(seed);
  let time = 0,
    started = 0,
    name = null,
    pose = { ...rest },
    start = { ...rest },
    next = 8 + random() * 10;
  let gx = 0,
    gy = 0,
    al = 0,
    ar = 0,
    vl = 0,
    vr = 0;
  return {
    play(gesture) {
      if (!gestures[gesture]) return false;
      start = { ...pose };
      name = gesture;
      started = time;
      next = time + 13 + random() * 15;
      return true;
    },
    update(dt, { gaze = [0, 0], still = false, nap = false, blink = 0, flight = 0, autonomous = true } = {}) {
      const step = Math.min(0.05, Math.max(0, dt));
      if (still || nap) {
        pose = { ...rest };
        name = null;
        gx = gy = al = ar = vl = vr = 0;
        next = time + 12;
      } else {
        time += step;
        if (autonomous && time > next && !name) this.play(["curious", "nod", "peek"][Math.floor(random() * 3)]);
        pose = name ? sampleGesture(name, time - started, start) : { ...rest };
        if (name && time - started >= gestures[name].at(-1)[0]) name = null;
        const ease = 1 - Math.exp(-step * 9);
        gx += (Math.min(1, Math.max(-1, gaze[0])) - gx) * ease;
        gy += (Math.min(1, Math.max(-1, gaze[1])) - gy) * ease;
        [al, vl] = spring(al, vl, pose.left - pose.roll * 0.45 + Math.sin(time * 2.3) * 0.025, step, 6);
        [ar, vr] = spring(ar, vr, pose.right - pose.roll * 0.45 + Math.sin(time * 2.3 + 1) * 0.025, step, 6);
      }
      const idle = still || nap ? 0 : 1;
      return {
        head: [nap ? 0.16 : pose.pitch - gy * 0.25, pose.yaw + gx * 0.35, nap ? -0.09 : pose.roll - gx * 0.045],
        gaze: [gx, gy],
        lift: nap ? -0.055 : pose.lift + Math.sin(time * 2.05) * 0.024 * idle,
        lean: pose.lean + Math.min(0.12, Math.max(-0.12, flight)) * idle,
        antennas: nap ? [0.34, -0.34] : [al, ar],
        arms: [pose.armL + Math.sin(time * 1.7) * 0.04 * idle, pose.armR - Math.sin(time * 1.7 + 0.7) * 0.04 * idle],
        blink: nap ? 1 : Math.max(blink, pose.close),
        gesture: name || (nap ? "nap" : "rest"),
      };
    },
  };
}
