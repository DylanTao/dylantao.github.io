// Shared acting primitives for the coastal animals. Every pose is a pure function of active
// scene time: a pause, a slow renderer or a reduced-motion still cannot accumulate drift, and
// any cache here only remembers results it would recompute identically.

export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const ease = (x) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};
// Quintic: zero velocity and acceleration at both ends.
export const smooth = (x) => {
  const u = clamp01(x);
  return u * u * u * (10 + u * (-15 + 6 * u));
};
export const pulse = (x) => {
  const u = clamp01(x);
  return Math.sin(Math.PI * u) ** 2;
};
export const wrap = (x, period) => ((x % period) + period) % period;
export const activeTime = (time) => Math.max(0, Number.isFinite(time) ? time : 0);
export const mix = (a, b, u) => a + (b - a) * u;
export const window01 = (t, start, end, rise, fall = rise) => smooth((t - start) / rise) * (1 - smooth((t - end + fall) / fall));

// Integer hash to [0, 1). Inputs are floored, so callers may pass seeds and indices freely.
export function hash(a, b = 0, c = 0) {
  let h = Math.imul(Math.floor(a) | 0, 0x27d4eb2d) ^ Math.imul(Math.floor(b) | 0, 0x165667b1) ^ Math.imul(Math.floor(c) | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth value noise in [-1, 1], C1 between integer lattice points.
export function noise(t, seed = 0) {
  const i = Math.floor(t),
    f = t - i,
    u = f * f * (3 - 2 * f);
  return (hash(seed, i, 7) * (1 - u) + hash(seed, i + 1, 7) * u) * 2 - 1;
}

// Unit step response of a second-order spring starting at rest (zero value and velocity).
export function springStep(dt, frequency, damping) {
  if (dt <= 0) return 0;
  const w = 2 * Math.PI * frequency;
  if (damping < 1) {
    const wd = w * Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-damping * w * dt) * (Math.cos(wd * dt) + ((damping * w) / wd) * Math.sin(wd * dt));
  }
  return 1 - Math.exp(-w * dt) * (1 + w * dt);
}

// A linear spring driven by piecewise-constant targets is exactly the sum of one step response
// per target change, so follow-through and overshoot need no integration. Keys are [time, value]
// pairs in ascending time; changes older than the settle window are treated as complete.
export function sprung(keys, t, frequency, damping = 0.7) {
  if (!keys.length) return 0;
  const settle = 6 / (Math.min(1, damping) * 2 * Math.PI * frequency);
  let value = keys[0][1],
    index = 1;
  while (index < keys.length && keys[index][0] <= t - settle) value = keys[index++][1];
  let previous = value;
  for (; index < keys.length && keys[index][0] <= t; index++) {
    value += (keys[index][1] - previous) * springStep(t - keys[index][0], frequency, damping);
    previous = keys[index][1];
  }
  return value;
}

// Jittered epochs: boundaries k·period ± jitter·period, so schedules never repeat on a fixed beat
// while any time still maps to its epoch in constant time.
export function epochAt(t, period, jitter, seed) {
  const boundary = (n) => n * period + (hash(seed, n, 3) - 0.5) * 2 * jitter * period;
  let k = Math.floor(t / period);
  while (k > -2 && t < boundary(k)) k--;
  while (t >= boundary(k + 1)) k++;
  return { k, start: boundary(k), end: boundary(k + 1) };
}

// Deterministic per-instance memo of the last few epoch plans.
export function planCache(build, size = 4) {
  const memo = new Map();
  return (k, ...args) => {
    const key = k;
    if (memo.has(key)) return memo.get(key);
    const plan = build(k, ...args);
    memo.set(key, plan);
    if (memo.size > size) memo.delete(memo.keys().next().value);
    return plan;
  };
}

// The segment of a plan containing t, with its local time and normalised progress.
export function segmentAt(segments, t) {
  let low = 0,
    high = segments.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (segments[middle].start <= t) low = middle;
    else high = middle - 1;
  }
  const segment = segments[low];
  return { segment, index: low, local: t - segment.start, u: clamp01((t - segment.start) / Math.max(1e-6, segment.end - segment.start)) };
}

// Saccade-like gaze keys: quick turns with holds of irregular length.
export function glanceKeys(keys, start, end, seed, { yaw = 0.5, pitch = 0.15, hold = [0.5, 1.6], baseYaw = 0, basePitch = 0 } = {}) {
  let t = start + 0.2 + hash(seed, 1) * 0.4,
    n = 0;
  while (t < end - 0.4) {
    keys.yaw.push([t, baseYaw + (hash(seed, n, 11) * 2 - 1) * yaw]);
    keys.pitch.push([t, basePitch + (hash(seed, n, 13) * 2 - 1) * pitch]);
    t += hold[0] + hash(seed, n, 17) * (hold[1] - hold[0]);
    n++;
  }
  keys.yaw.push([Math.max(start, end - 0.4), baseYaw]);
  keys.pitch.push([Math.max(start, end - 0.4), basePitch]);
}

// Flight helpers shared by the birds. A quintic transfer matches position, velocity and
// acceleration at both ends (C2), with a lift bump whose own derivatives vanish at the ends.
export function transfer(from, to, u, duration, arcHeight = 0) {
  const position = [],
    velocity = [],
    acceleration = [];
  for (let axis = 0; axis < 3; axis++) {
    const a = from.position[axis],
      b = from.velocity[axis] * duration,
      c = from.acceleration[axis] * duration ** 2 * 0.5;
    const delta = to.position[axis] - a - b - c,
      speed = to.velocity[axis] * duration - b - 2 * c;
    const accel = to.acceleration[axis] * duration ** 2 - 2 * c;
    const d = 10 * delta - 4 * speed + accel * 0.5,
      e = -15 * delta + 7 * speed - accel,
      f = 6 * delta - 3 * speed + accel * 0.5;
    position.push(a + b * u + c * u ** 2 + d * u ** 3 + e * u ** 4 + f * u ** 5);
    velocity.push((b + 2 * c * u + 3 * d * u ** 2 + 4 * e * u ** 3 + 5 * f * u ** 4) / duration);
    acceleration.push((2 * c + 6 * d * u + 12 * e * u ** 2 + 20 * f * u ** 3) / duration ** 2);
  }
  position[1] += arcHeight * 64 * u ** 3 * (1 - u) ** 3;
  velocity[1] += (arcHeight * 192 * u ** 2 * (1 - u) ** 2 * (1 - 2 * u)) / duration;
  acceleration[1] += (arcHeight * 384 * u * (1 - u) * (1 - 5 * u + 5 * u ** 2)) / duration ** 2;
  return { position, velocity, acceleration };
}

// Heading, climb and a coordinated-turn bank from a trajectory's derivatives. The bank uses an
// exaggerated effective gravity so slow miniature flight still leans visibly into its turns.
export function flightAttitude(velocity, acceleration, { gravity = 3.2, maxBank = 0.75 } = {}) {
  const horizontal = Math.hypot(velocity[0], velocity[2]);
  const turn = horizontal > 1e-4 ? (velocity[2] * acceleration[0] - velocity[0] * acceleration[2]) / horizontal : 0;
  return {
    yaw: Math.atan2(velocity[0], velocity[2]),
    pitch: -Math.atan2(velocity[1], Math.max(1e-4, horizontal)),
    bank: Math.max(-maxBank, Math.min(maxBank, Math.atan2(turn, gravity))),
    speed: Math.hypot(horizontal, velocity[1]),
  };
}

// Wingbeat with a quicker downstroke: phase in cycles, returns {stroke, lag}: stroke in [-1, 1]
// (+1 top of upstroke), and the hand's lagged stroke for the wrist's follow-through.
export function wingbeat(phase, lag = 0.12) {
  const shape = (p) => {
    const u = wrap(p, 1);
    // 45% of the cycle for the downstroke (top to bottom), 55% to recover.
    return u < 0.45 ? Math.cos((Math.PI * u) / 0.45) : -Math.cos((Math.PI * (u - 0.45)) / 0.55);
  };
  return { stroke: shape(phase), lag: shape(phase - lag), downstroke: wrap(phase, 1) < 0.45 };
}
