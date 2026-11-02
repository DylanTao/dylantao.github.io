export function createRainContactTracker({ maximum = 1024, maxStep = 0.25, surfaceAt, impact } = {}) {
  if (
    !Number.isInteger(maximum) ||
    maximum < 1 ||
    maximum > 1024 ||
    !(maxStep > 0) ||
    maxStep > 0.25 ||
    !Number.isFinite(maxStep) ||
    typeof surfaceAt !== "function"
  )
    throw new RangeError("Bounded rain-contact inputs required");
  // x/y/z, time, three world-copy indices and an optional conservative height bound.
  // An absent/nonfinite bound disables the broad phase. No per-drop history allocations.
  const state = new Float64Array(maximum * 8),
    valid = new Uint8Array(maximum),
    landed = new Uint8Array(maximum);
  const counts = { impacts: 0, solid: 0, wraps: 0, resets: 0, queries: 0, aboveSurface: 0 };
  const point = [0, 0, 0];
  let last = null;
  function store(index, drop, seconds) {
    const at = index * 8;
    for (let axis = 0; axis < 3; axis++) {
      state[at + axis] = drop.point[axis];
      state[at + 4 + axis] = drop.copy[axis];
    }
    state[at + 3] = seconds;
    state[at + 7] = Number.isFinite(drop.upper) ? drop.upper : Infinity;
    valid[index] = 1;
  }
  function surface(x, z, t, bottom, top) {
    counts.queries++;
    return surfaceAt(x, z, t, bottom, top);
  }
  function update(index, drop, seconds) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= maximum ||
      drop?.point?.length !== 3 ||
      !drop.point.every(Number.isFinite) ||
      drop.copy?.length !== 3 ||
      !drop.copy.every(Number.isInteger) ||
      !Number.isFinite(seconds)
    )
      throw new RangeError("Finite rain trajectory required");
    const at = index * 8,
      oldTime = state[at + 3],
      dt = seconds - oldTime;
    if (!valid[index] || dt <= 0 || dt > maxStep) {
      if (!valid[index] || dt !== 0) {
        landed[index] = 0;
        store(index, drop, seconds);
        counts.resets++;
      }
      return null;
    }
    if (drop.copy[0] !== state[at + 4] || drop.copy[1] !== state[at + 5] || drop.copy[2] !== state[at + 6]) {
      landed[index] = 0;
      store(index, drop, seconds);
      counts.wraps++;
      return null;
    }
    if (landed[index] || drop.point[1] >= state[at + 1]) {
      store(index, drop, seconds);
      return null;
    }
    const top = state[at + 1],
      bottom = drop.point[1];
    // The owner must bound both endpoint queries for the entire supplied [bottom,top] interval.
    // This preserves the narrow phase exactly: it already rejects two above-surface endpoints.
    if (top > state[at + 7] && bottom > (Number.isFinite(drop.upper) ? drop.upper : Infinity)) {
      counts.aboveSurface++;
      store(index, drop, seconds);
      return null;
    }
    const a = surface(state[at], state[at + 2], oldTime, bottom, top),
      b = surface(drop.point[0], drop.point[2], seconds, bottom, top);
    if (!a || !b || !Number.isFinite(a.y) || !Number.isFinite(b.y)) {
      store(index, drop, seconds);
      return null;
    }
    if (top <= a.y) {
      landed[index] = 1;
      store(index, drop, seconds);
      return null;
    }
    if (bottom > b.y) {
      store(index, drop, seconds);
      return null;
    }
    let lo = 0,
      hi = 1,
      hit = b;
    for (let step = 0; step < 12; step++) {
      const f = (lo + hi) / 2;
      for (let axis = 0; axis < 3; axis++) point[axis] = state[at + axis] + (drop.point[axis] - state[at + axis]) * f;
      const s = surface(point[0], point[2], oldTime + dt * f, bottom, top);
      if (!s || !Number.isFinite(s.y)) {
        store(index, drop, seconds);
        return null;
      }
      if (point[1] > s.y) lo = f;
      else {
        hi = f;
        hit = s;
      }
    }
    for (let axis = 0; axis < 3; axis++) point[axis] = state[at + axis] + (drop.point[axis] - state[at + axis]) * hi;
    const relativeSpeed = (top - bottom + b.y - a.y) / dt;
    landed[index] = 1;
    store(index, drop, seconds);
    if (hit.kind !== "water") {
      counts.solid++;
      return null;
    }
    const event = {
      diameter: drop.diameter,
      index,
      copy: Array.from(drop.copy),
      seconds: oldTime + dt * hi,
      position: [point[0], hit.y, point[2]],
      water: hit.id,
      triangle: hit.triangle ?? null,
      relativeSpeed,
    };
    counts.impacts++;
    last = event;
    impact?.(event);
    return event;
  }
  return {
    update,
    landed: (index) => Boolean(landed[index]),
    reset() {
      valid.fill(0);
      landed.fill(0);
    },
    evidence: () => ({ ...counts, last, historyBytes: state.byteLength + valid.byteLength + landed.byteLength }),
  };
}
