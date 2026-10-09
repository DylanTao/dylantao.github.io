import { clamp } from "./duh-motion.mjs";

// A bounded inertial shell, separate from the stable center collider.
// The grip/acceleration drives damped secondary motion; contour area is normalized.
export function createDuhBody() {
  const b = { x: 0, y: 0, vx: 0, vy: 0, stretch: 0, angle: 0, sag: 0 };
  return {
    step(dt, { vx = 0, vy = 0, ax = 0, ay = 0, held = false, grounded = true, still = false } = {}) {
      if (still) {
        Object.assign(b, { x: 0, y: 0, vx: 0, vy: 0, stretch: 0, sag: 0 });
        return { ...b };
      }
      dt = clamp(dt, 0, 0.05);
      const tx = clamp(-ax * 0.00055, -8, 8),
        ty = clamp(-ay * 0.00055 + (held ? 4 : 0), -8, 9);
      // Substeps bound even unusually delayed input frames.
      const steps = Math.max(1, Math.ceil(dt * 120)),
        d = dt / steps;
      for (let i = 0; i < steps; i++) {
        b.vx += ((tx - b.x) * 155 - b.vx * 13) * d;
        b.vy += ((ty - b.y) * 155 - b.vy * 13) * d;
        b.x = clamp(b.x + b.vx * d, -10, 10);
        b.y = clamp(b.y + b.vy * d, -10, 10);
      }
      const blend = 1 - Math.exp(-9 * dt);
      b.stretch += (clamp(Math.hypot(vx, vy) / 6500, 0, 0.22) - b.stretch) * blend;
      if (Math.hypot(vx, vy) > 30) {
        const target = Math.atan2(vy, vx);
        b.angle += Math.atan2(Math.sin(target - b.angle), Math.cos(target - b.angle)) * blend;
      }
      b.sag += ((grounded && !held ? 1 : 0) - b.sag) * blend;
      return { ...b };
    },
    active() {
      return Math.abs(b.x) + Math.abs(b.y) + Math.abs(b.vx) + Math.abs(b.vy) + b.stretch + Math.abs(1 - b.sag) > 0.02;
    },
    evidence() {
      return { ...b };
    },
  };
}

export function deformDuhContour(radii, dents, body, squash = 0, contactAngle = Math.PI / 2) {
  const n = radii.length;
  const points = radii.map((r, i) => {
    const a = -Math.PI + (i * Math.PI * 2) / n;
    const wave = (body.x * Math.cos(2 * a) + body.y * Math.sin(3 * a)) * 0.35;
    const radial = 28 * clamp(r + (dents[i] || 0), 0.65, 1.4) + wave;
    const stretch = Math.exp(body.stretch * Math.cos(2 * (a - body.angle)) - squash * Math.cos(2 * (a - contactAngle)));
    let x = Math.cos(a) * radial * stretch * Math.exp(body.sag * 0.09);
    let y = Math.sin(a) * radial * stretch * Math.exp(-body.sag * 0.09);
    // Gravity pools the base; a held shell hangs below the grip.
    y += (Math.min(y, 22) - y) * body.sag + body.sag * 3;
    return [x, y];
  });
  const area =
    Math.abs(
      points.reduce((sum, p, i) => {
        const q = points[(i + 1) % n];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0)
    ) / 2;
  const reference = radii.reduce((sum, r, i) => sum + (r * radii[(i + 1) % n] * 28 * 28 * Math.sin((2 * Math.PI) / n)) / 2, 0);
  const scale = clamp(Math.sqrt(reference / Math.max(1, area)), 0.8, 1.2);
  return points.map(([x, y]) => [x * scale + body.x * 0.45, y * scale + body.y * 0.45]);
}
