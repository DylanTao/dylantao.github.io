import { DEFAULT_WIND, sampleWind } from "./wind-field.mjs";

const SETTINGS = Object.freeze({
  steam: { lifetime: 9, drift: [0, 0.085, 0], windGain: 0.12, jitter: 0.018 },
  dust: { lifetime: 18, drift: [0, -0.004, 0], windGain: 0.035, jitter: 0.012 },
  spray: { lifetime: 0.48, launch: [0, 1.9, 0.35], gravity: [0, -9.81, 0], drag: 0.55, windGain: 1, jitter: 0.06 },
});
const random = (seed) => {
  let x = seed | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
};

// Fixed count, fixed active-time ticks, midpoint position AND time. Emitters and
// bounds are in world meters. No Three dependency, RAF, timer or wall clock.
export function createWindParticles({
  kind = "dust",
  emitters,
  bounds,
  wind = DEFAULT_WIND,
  seed = 431,
  timeOffset = 0,
  step = 1 / 60,
  maxSteps = 30,
  maxFrame = 0.25,
  ...overrides
}) {
  if (!SETTINGS[kind] || !emitters || emitters.length % 3 || emitters.length === 0 || emitters.length / 3 > 256)
    throw new RangeError("Invalid bounded particle population");
  if (!Number.isFinite(step) || step <= 0 || step > 1 / 30 || !Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 120)
    throw new RangeError("Invalid particle tick budget");
  if (!Number.isFinite(maxFrame) || maxFrame <= 0 || maxFrame > 1 || !Number.isFinite(timeOffset) || !emitters.every(Number.isFinite))
    throw new RangeError("Invalid particle frame/emitter scale");
  const config = { ...SETTINGS[kind], ...overrides },
    count = emitters.length / 3;
  if (!Number.isFinite(config.lifetime) || config.lifetime <= 0 || (kind === "spray" && (!Number.isFinite(config.drag) || config.drag <= 0)))
    throw new RangeError("Invalid particle physical scale");
  const positions = new Float32Array(emitters.length),
    opacity = new Float32Array(count);
  const state = new Float64Array(emitters.length),
    velocity = new Float64Array(emitters.length),
    age = new Float64Array(count),
    lives = new Float64Array(count),
    cycles = new Uint32Array(count);
  const w0 = [0, 0, 0],
    w1 = [0, 0, 0],
    midpoint = [0, 0, 0],
    point = [0, 0, 0],
    halfVelocity = [0, 0, 0];
  let ticks = 0,
    pending = 0,
    fieldClock = timeOffset,
    droppedTime = 0;
  function emit(i) {
    const key = seed + i * 1009 + cycles[i] * 9176;
    lives[i] = config.lifetime * (0.85 + 0.3 * random(key + 11));
    age[i] = 0;
    for (let a = 0; a < 3; a++) {
      state[i * 3 + a] = emitters[i * 3 + a] + (random(key + a * 37) - 0.5) * config.jitter;
      if (bounds) state[i * 3 + a] = Math.max(bounds.min[a], Math.min(bounds.max[a], state[i * 3 + a]));
      velocity[i * 3 + a] = kind === "spray" ? config.launch[a] * (0.9 + 0.2 * random(key + 61 + a)) : 0;
    }
  }
  function publish() {
    positions.set(state);
    for (let i = 0; i < count; i++) opacity[i] = Math.max(0, Math.sin((Math.PI * age[i]) / lives[i]));
  }
  for (let i = 0; i < count; i++) {
    emit(i);
    age[i] = (lives[i] * (i + 0.5)) / count;
  }
  publish();
  function tick(time) {
    for (let i = 0; i < count; i++) {
      const offset = i * 3;
      for (let a = 0; a < 3; a++) point[a] = state[offset + a];
      sampleWind(point, time, w0, wind);
      if (kind === "spray") {
        for (let a = 0; a < 3; a++) {
          const acceleration = config.gravity[a] + (w0[a] * config.windGain - velocity[offset + a]) / config.drag;
          midpoint[a] = point[a] + velocity[offset + a] * step * 0.5;
          halfVelocity[a] = velocity[offset + a] + acceleration * step * 0.5;
        }
        sampleWind(midpoint, time + step * 0.5, w1, wind);
        for (let a = 0; a < 3; a++) {
          state[offset + a] += halfVelocity[a] * step;
          velocity[offset + a] += (config.gravity[a] + (w1[a] * config.windGain - halfVelocity[a]) / config.drag) * step;
        }
      } else {
        for (let a = 0; a < 3; a++) midpoint[a] = point[a] + (w0[a] * config.windGain + config.drift[a]) * step * 0.5;
        sampleWind(midpoint, time + step * 0.5, w1, wind);
        for (let a = 0; a < 3; a++) state[offset + a] += (w1[a] * config.windGain + config.drift[a]) * step;
      }
      age[i] += step;
      const outside = bounds && [0, 1, 2].some((a) => state[offset + a] < bounds.min[a] || state[offset + a] > bounds.max[a]);
      const landed = kind === "spray" && age[i] > step && state[offset + 1] < emitters[offset + 1] - 0.015;
      if (age[i] >= lives[i] || outside || landed) {
        cycles[i]++;
        emit(i);
      }
    }
    ticks++;
  }
  return {
    positions,
    opacity,
    advance(seconds, { active = true, reduced = false, fieldTime } = {}) {
      if (!active || reduced) return false;
      if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("Particle time must be finite and nonnegative");
      const previousPending = pending;
      const accepted = Math.min(seconds, maxFrame, maxSteps * step);
      droppedTime += seconds - accepted;
      fieldClock = fieldTime ?? fieldClock + seconds;
      if (!Number.isFinite(fieldClock)) throw new RangeError("Wind field time must be finite");
      // Sample the accepted recent interval on the shared active-time field.
      // Dropped stall time is reported; it never becomes a catch-up queue.
      const start = fieldClock - accepted - previousPending;
      pending += accepted;
      const steps = Math.min(maxSteps, Math.floor((pending + 1e-10) / step));
      for (let i = 0; i < steps; i++) tick(start + i * step);
      pending = Math.max(0, pending - steps * step);
      if (pending < 1e-10) pending = 0;
      if (steps) publish();
      return steps > 0;
    },
    evidence: () => ({
      kind,
      count,
      seconds: ticks * step,
      fieldSeconds: fieldClock,
      droppedTime,
      ticks,
      backlogSeconds: pending,
      step,
      maxSteps,
      integrator: "midpoint",
      windSamplesPerTick: count * 2,
    }),
    snapshot: () => ({
      positions: Array.from(positions),
      opacity: Array.from(opacity),
      age: Array.from(age),
      cycles: Array.from(cycles),
      seconds: ticks * step,
      backlogSeconds: pending,
    }),
  };
}
