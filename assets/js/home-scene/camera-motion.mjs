// Analytic critically damped camera coordinates retain velocity through a
// changed destination. No substep loop or backlog after a slow render.
export function createCameraMotion() {
  const velocities = new Map();
  return {
    step(key, position, target, delta, still = false, frequency = 14) {
      if (still) {
        velocities.delete(key);
        return target;
      }
      const dt = Math.max(0, Number.isFinite(delta) ? delta : 0);
      const displacement = position - target;
      const velocity = velocities.get(key) || 0;
      const c = velocity + frequency * displacement;
      const decay = Math.exp(-frequency * dt);
      const next = target + (displacement + c * dt) * decay;
      velocities.set(key, (velocity - frequency * c * dt) * decay);
      return next;
    },
    stop(key) {
      if (key === undefined) velocities.clear();
      else velocities.delete(key);
    },
    evidence: () => Object.fromEntries(velocities),
  };
}

// Release inertia for drags (orbit and pan). A flick keeps turning or sliding and coasts to rest
// with exponential decay, integrated analytically so the distance covered is the same at 20 Hz
// and 144 Hz: a velocity v decaying with time constant tau travels v * tau in total.
export function createInertia({ tau = 0.32, rest = 0.02, window = 0.12 } = {}) {
  const velocity = new Map(),
    samples = [];
  return {
    // Pointer history while dragging: amounts already applied, timestamped in seconds.
    track(time, amounts) {
      samples.push({ time, amounts });
      while (samples.length > 2 && time - samples[0].time > window * 2.5) samples.shift();
    },
    clearTrack() {
      samples.length = 0;
    },
    // On release: the mean rate over the last `window` seconds. A pause before release (the
    // pointer held still) leaves no velocity, so a deliberate stop never coasts; neither does a
    // burst of events with no measurable duration. `caps` bounds each rate (units per second).
    release(time, caps = {}) {
      velocity.clear();
      const recent = samples.filter((sample) => time - sample.time <= window);
      samples.length = 0;
      if (recent.length < 2) return false;
      const span = recent.at(-1).time - recent[0].time;
      if (!(span >= 0.012)) return false;
      const totals = {};
      for (const sample of recent.slice(1)) for (const [key, value] of Object.entries(sample.amounts)) totals[key] = (totals[key] || 0) + value;
      for (const [key, total] of Object.entries(totals)) {
        const cap = caps[key] ?? Infinity,
          rate = Math.max(-cap, Math.min(cap, total / span));
        if (Math.abs(rate) > rest) velocity.set(key, rate);
      }
      return velocity.size > 0;
    },
    // The displacement over `delta` seconds; velocities decay and stop below `rest`.
    step(delta) {
      const moved = {};
      if (!velocity.size) return moved;
      const dt = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, 1)),
        decay = Math.exp(-dt / tau);
      for (const [key, rate] of velocity) {
        moved[key] = rate * tau * (1 - decay);
        const next = rate * decay;
        if (Math.abs(next) <= rest) velocity.delete(key);
        else velocity.set(key, next);
      }
      return moved;
    },
    stop(key) {
      if (key === undefined) velocity.clear();
      else velocity.delete(key);
    },
    get active() {
      return velocity.size > 0;
    },
    evidence: () => Object.fromEntries(velocity),
  };
}
