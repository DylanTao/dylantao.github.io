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
