// Soft duh: a 2D soft body around the stable center collider (duh-motion.mjs).
//
// A ring of particles is solved with extended position-based dynamics (XPBD; Macklin, Müller and
// Chentanez, "XPBD", MIG 2016) in many small substeps with one iteration each (Macklin et al.,
// "Small Steps in Physics Simulation", SCA 2019). Constraints:
//   - neighbour and second-neighbour distances (stretch and bending),
//   - polygon area, so squashing one side bulges the others (pressure soft bodies; Matyka and
//     Ollila, SIGRAD 2003),
//   - shape matching toward the current form's rest outline (Müller et al., "Meshless
//     Deformations Based on Shape Matching", SIGGRAPH 2005): a morph to the apple or the square
//     changes the rest shape, so the body overshoots and settles into it physically,
//   - attachment that depends on what holds the body: a grip arc on top while held (the rest
//     hangs and swings), a footing at the base on a surface (accelerations shear the top), and a
//     soft centroid anchor in the air, so the body lags and catches up (follow-through),
//   - a contact half-plane while grounded or squashed, which pools the base on a surface and
//     flattens the side an impact touches.
// The collider still owns position, gestures and page contacts; this module only shapes the
// outline the portrait draws, in local pixels around the collider.

const TAU = Math.PI * 2;
const SUBSTEP = 1 / 240;
const MAX_SUBSTEPS = 12;

export const SOFT_DEFAULTS = Object.freeze({
  count: 32,
  radius: 28,
  stretchCompliance: 4e-5,
  bendCompliance: 6e-4,
  areaCompliance: 2e-7,
  shapeStiffness: 0.04,
  anchorStiffness: 0.03,
  damping: 5.5,
  inertia: 0.07,
  gripStiffness: 0.3,
  gripArc: 0.65,
  baseStiffness: 0.9,
  gravity: 1600,
  poolDepth: 0.16,
  breathing: 0.012,
  maxAcceleration: 20000,
  maxReach: 44,
});

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Resample a closed list of radii (fixed angles from -PI) to `count` radii by angular interpolation.
export function resampleRadii(radii, count) {
  const n = radii.length;
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    const t = (i * n) / count,
      k = Math.floor(t),
      f = t - k;
    out[i] = radii[k % n] * (1 - f) + radii[(k + 1) % n] * f;
  }
  return out;
}

export function polygonArea(points) {
  let sum = 0;
  for (let i = 0, n = points.length; i < n; i++) {
    const [x0, y0] = points[i],
      [x1, y1] = points[(i + 1) % n];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

export function createDuhSoftBody(options = {}) {
  const o = { ...SOFT_DEFAULTS, ...options };
  const n = o.count;
  const x = new Float64Array(n * 2),
    prev = new Float64Array(n * 2),
    v = new Float64Array(n * 2),
    rest = new Float64Array(n * 2);
  const gx = new Float64Array(n),
    gy = new Float64Array(n);
  let restArea = 0,
    restLengths = new Float64Array(n),
    bendLengths = new Float64Array(n),
    breath = 0,
    energy = 0,
    lastAreaError = 0,
    substeps = 0;

  function setRest(radii) {
    const r = resampleRadii(radii, n);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI + (i * TAU) / n;
      rest[i * 2] = Math.cos(a) * o.radius * r[i];
      rest[i * 2 + 1] = Math.sin(a) * o.radius * r[i];
    }
    restArea = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        k = (i + 2) % n;
      restArea += rest[i * 2] * rest[j * 2 + 1] - rest[j * 2] * rest[i * 2 + 1];
      restLengths[i] = Math.hypot(rest[j * 2] - rest[i * 2], rest[j * 2 + 1] - rest[i * 2 + 1]);
      bendLengths[i] = Math.hypot(rest[k * 2] - rest[i * 2], rest[k * 2 + 1] - rest[i * 2 + 1]);
    }
    restArea /= 2;
  }

  function snapToRest() {
    x.set(rest);
    prev.set(rest);
    v.fill(0);
  }

  setRest(new Array(20).fill(1));
  snapToRest();

  function distance(i, j, length, compliance, h) {
    const dx = x[j * 2] - x[i * 2],
      dy = x[j * 2 + 1] - x[i * 2 + 1];
    const d = Math.hypot(dx, dy) || 1e-9;
    const c = d - length;
    // Equal unit masses: w_i = w_j = 1, so the generalized inverse mass is 2.
    const lambda = -c / (2 + compliance / (h * h));
    const nx = dx / d,
      ny = dy / d;
    x[i * 2] -= lambda * nx;
    x[i * 2 + 1] -= lambda * ny;
    x[j * 2] += lambda * nx;
    x[j * 2 + 1] += lambda * ny;
  }

  function area(target, h) {
    let a = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      a += x[i * 2] * x[j * 2 + 1] - x[j * 2] * x[i * 2 + 1];
    }
    a /= 2;
    const c = a - target;
    // dA/dx_i = (y_{i+1} - y_{i-1}) / 2, dA/dy_i = (x_{i-1} - x_{i+1}) / 2
    let gradient = 0;
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n,
        last = (i - 1 + n) % n;
      gx[i] = (x[next * 2 + 1] - x[last * 2 + 1]) / 2;
      gy[i] = (x[last * 2] - x[next * 2]) / 2;
      gradient += gx[i] * gx[i] + gy[i] * gy[i];
    }
    const lambda = -c / (gradient + o.areaCompliance / (h * h));
    for (let i = 0; i < n; i++) {
      x[i * 2] += lambda * gx[i];
      x[i * 2 + 1] += lambda * gy[i];
    }
    return c / Math.max(1, Math.abs(target));
  }

  function centroid() {
    let cx = 0,
      cy = 0;
    for (let i = 0; i < n; i++) {
      cx += x[i * 2];
      cy += x[i * 2 + 1];
    }
    return [cx / n, cy / n];
  }

  // Optimal 2D rotation of the rest outline onto the current one (polar decomposition of A_pq).
  function shapeMatch(stiffness) {
    const [cx, cy] = centroid();
    let a00 = 0,
      a01 = 0,
      a10 = 0,
      a11 = 0;
    for (let i = 0; i < n; i++) {
      const px = x[i * 2] - cx,
        py = x[i * 2 + 1] - cy,
        qx = rest[i * 2],
        qy = rest[i * 2 + 1];
      a00 += px * qx;
      a01 += px * qy;
      a10 += py * qx;
      a11 += py * qy;
    }
    const angle = Math.atan2(a10 - a01, a00 + a11),
      cos = Math.cos(angle),
      sin = Math.sin(angle);
    for (let i = 0; i < n; i++) {
      const gx = cx + cos * rest[i * 2] - sin * rest[i * 2 + 1],
        gy = cy + sin * rest[i * 2] + cos * rest[i * 2 + 1];
      x[i * 2] += (gx - x[i * 2]) * stiffness;
      x[i * 2 + 1] += (gy - x[i * 2 + 1]) * stiffness;
    }
  }

  function contact(nx, ny, offset) {
    for (let i = 0; i < n; i++) {
      const depth = x[i * 2] * nx + x[i * 2 + 1] * ny - offset;
      if (depth > 0) {
        x[i * 2] -= depth * nx;
        x[i * 2 + 1] -= depth * ny;
      }
    }
  }

  return {
    // The current form's outline as fixed-angle radii (the portrait's 20 radii).
    setShape(radii) {
      setRest(radii);
    },
    // A pet presses the surface inward around `angle`; the body rebounds by itself.
    pet(angle = -Math.PI / 2, strength = 260) {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI + (i * TAU) / n;
        const difference = Math.atan2(Math.sin(a - angle), Math.cos(a - angle));
        const falloff = Math.exp((-difference * difference) / 0.18);
        v[i * 2] -= Math.cos(a) * strength * falloff;
        v[i * 2 + 1] -= Math.sin(a) * strength * falloff;
      }
    },
    step(dt, { ax = 0, ay = 0, held = false, grounded = true, still = false, squash = 0, contactAngle = Math.PI / 2, time = 0 } = {}) {
      if (still) {
        // Reduced motion and pause compose the settled pose at once: the rest outline, pooled on
        // its surface by the same constraints, with no velocity.
        snapToRest();
        if (grounded && !held) {
          const offset = o.radius * (1 - o.poolDepth);
          for (let k = 0; k < 40; k++) {
            contact(0, 1, offset);
            area(restArea, SUBSTEP);
            shapeMatch(o.shapeStiffness);
          }
          contact(0, 1, offset);
          prev.set(x);
        }
        energy = 0;
        lastAreaError = 0;
        substeps = 0;
        return this.points();
      }
      dt = clamp(dt, 0, 0.05);
      substeps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.round(dt / SUBSTEP)));
      const h = dt / substeps;
      // Idle breathing: the rest area swells and settles by about one percent over 3.4 seconds.
      breath = o.breathing * Math.sin((TAU * time) / 3.4);
      const targetArea = restArea * (1 + breath);
      // The collider's acceleration appears as a pseudo-force in its frame; gravity only acts
      // relative to the collider while something supports it (a perch or a grip).
      // A release or a wall hit can report a huge single-frame acceleration; bound it first.
      const magnitude = Math.hypot(ax, ay),
        limit = magnitude > o.maxAcceleration ? o.maxAcceleration / magnitude : 1;
      const fx = -ax * limit * o.inertia,
        fy = -ay * limit * o.inertia + (grounded || held ? o.gravity : 0);
      const nx = Math.cos(contactAngle),
        ny = Math.sin(contactAngle);
      const supported = grounded && !held;
      // Resting on a surface, the base pools a little (poolDepth); an impact squashes it further.
      const contactOffset = o.radius * (1 - clamp(Math.max(squash, supported ? o.poolDepth : 0), 0, 0.35));
      for (let s = 0; s < substeps; s++) {
        prev.set(x);
        for (let i = 0; i < n; i++) {
          v[i * 2] += fx * h;
          v[i * 2 + 1] += fy * h;
          x[i * 2] += v[i * 2] * h;
          x[i * 2 + 1] += v[i * 2 + 1] * h;
        }
        for (let i = 0; i < n; i++) distance(i, (i + 1) % n, restLengths[i], o.stretchCompliance, h);
        for (let i = 0; i < n; i++) distance(i, (i + 2) % n, bendLengths[i], o.bendCompliance, h);
        lastAreaError = area(targetArea, h);
        shapeMatch(o.shapeStiffness);
        if (held) {
          // Held: the grip arc on top moves with the hand; the rest hangs below it and swings.
          for (let i = 0; i < n; i++) {
            const a = -Math.PI + (i * TAU) / n,
              fromTop = Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2));
            if (Math.abs(fromTop) > o.gripArc) continue;
            const weight = o.gripStiffness * (1 - Math.abs(fromTop) / o.gripArc);
            x[i * 2] += (rest[i * 2] - x[i * 2]) * weight;
            x[i * 2 + 1] += (rest[i * 2 + 1] + 4 - x[i * 2 + 1]) * weight;
          }
        } else if (supported) {
          // On a surface: static friction keeps the touching base from sliding, so an acceleration
          // shears the top instead of moving the whole body (the jelly lean). A weak pull keeps the
          // footing centred under the collider over time.
          const [cx] = centroid();
          for (let i = 0; i < n; i++) {
            if (x[i * 2] * nx + x[i * 2 + 1] * ny < contactOffset - 0.5) continue;
            const slide = (x[i * 2] - prev[i * 2]) * -ny + (x[i * 2 + 1] - prev[i * 2 + 1]) * nx;
            x[i * 2] -= -ny * slide * o.baseStiffness;
            x[i * 2 + 1] -= nx * slide * o.baseStiffness;
          }
          for (let i = 0; i < n; i++) x[i * 2] -= cx * o.anchorStiffness * 0.25;
        } else {
          // In the air the collider is the centre of mass: keep the centroid with it.
          const [cx, cy] = centroid();
          for (let i = 0; i < n; i++) {
            x[i * 2] -= cx * o.anchorStiffness;
            x[i * 2 + 1] -= cy * o.anchorStiffness;
          }
        }
        if (supported || squash > 0.001) contact(nx, ny, contactOffset);
        // The portrait canvas is 96 px across; keep every particle inside it.
        for (let i = 0; i < n; i++) {
          const reach = Math.hypot(x[i * 2], x[i * 2 + 1]);
          if (reach > o.maxReach) {
            x[i * 2] *= o.maxReach / reach;
            x[i * 2 + 1] *= o.maxReach / reach;
          }
        }
        const decay = Math.exp(-o.damping * h);
        energy = 0;
        for (let i = 0; i < n * 2; i++) {
          v[i] = ((x[i] - prev[i]) / h) * decay;
          energy += v[i] * v[i];
        }
      }
      energy /= 2 * n;
      return this.points();
    },
    points() {
      const out = new Array(n);
      for (let i = 0; i < n; i++) out[i] = [x[i * 2], x[i * 2 + 1]];
      return out;
    },
    centroid,
    // Moving, not merely deformed: a body pooled on its perch is at rest. Breathing alone stays
    // below this, so the page can fall back to its one-hertz idle schedule.
    active() {
      return energy > 0.2;
    },
    evidence() {
      const points = this.points();
      return {
        model: "xpbd-ring",
        particles: n,
        substeps,
        areaError: lastAreaError,
        areaRatio: polygonArea(points) / restArea,
        energy,
        breath,
      };
    },
  };
}
