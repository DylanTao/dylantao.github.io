// Rectangular, reflecting basin modes with finite-depth gravity-wave dispersion:
// omega^2 = g k tanh(k h). See MIT Marine Hydrodynamics, lecture20, dispersion relationship.
// This is a bounded linear surface model at one effective depth, not a breaking-wave/3D fluid solver.
const G = 9.80665,
  RHO = 1000,
  NX = 12,
  NZ = 8;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createPoolImpact({ width, length, depth = 1.35, damping = 0.65 } = {}) {
  if (
    ![width, length, depth, damping].every(Number.isFinite) ||
    width <= 0 ||
    width > 20 ||
    length <= 0 ||
    length > 12 ||
    depth <= 0 ||
    depth > 3 ||
    damping <= 0
  )
    throw new RangeError("finite bounded basin dimensions required");
  const modes = [];
  for (let n = 0; n <= NX; n++)
    for (let m = 0; m <= NZ; m++) {
      if (!n && !m) continue; // No uniform mode: impacts never add water volume.
      const kx = (n * Math.PI) / width,
        kz = (m * Math.PI) / length,
        k = Math.hypot(kx, kz),
        omega2 = G * k * Math.tanh(k * depth),
        norm = (width * length) / ((n ? 2 : 1) * (m ? 2 : 1));
      modes.push({ n, m, kx, kz, omega2, norm, q: 0, v: 0 });
    }
  let seconds = 0,
    impacts = 0,
    lastImpact = null,
    basis = null;
  const energy = () => modes.reduce((sum, mode) => sum + (RHO * G * mode.norm * (mode.q ** 2 + mode.v ** 2 / mode.omega2)) / 2, 0);
  const bound = () => modes.reduce((sum, mode) => sum + Math.hypot(mode.q, mode.v / Math.sqrt(mode.omega2)), 0);
  function impact({ x, z, speed, radius = 0.24, mass = 80 }) {
    if (
      ![x, z, speed, radius, mass].every(Number.isFinite) ||
      Math.abs(x) > width / 2 ||
      Math.abs(z) > length / 2 ||
      speed <= 0 ||
      speed > 100 ||
      mass <= 0 ||
      mass > 200 ||
      radius <= 0 ||
      radius > 1
    )
      return false;
    const spread = clamp(radius + speed * 0.006, 0.25, 0.48),
      available = Math.max(0, 0.12 - bound()),
      incoming = modes.map(({ n, m, kx, kz }) => {
        const k2 = kx * kx + kz * kz;
        return (
          -k2 *
          spread *
          spread *
          Math.exp(-0.5 * spread * spread * k2) *
          Math.cos((n * Math.PI * (x + width / 2)) / width) *
          Math.cos((m * Math.PI * (z + length / 2)) / length)
        );
      }),
      rawBound = incoming.reduce((sum, q) => sum + Math.abs(q), 0),
      rawEnergy = incoming.reduce((sum, q, i) => sum + (RHO * G * modes[i].norm * q * q) / 2, 0),
      entryEnergy = 0.5 * mass * speed * speed,
      budget = Math.min(18, entryEnergy * 0.002),
      scale = Math.min(available / Math.max(1e-12, rawBound), Math.sqrt(budget / Math.max(1e-12, rawEnergy)));
    for (let i = 0; i < modes.length; i++) modes[i].q += incoming[i] * scale;
    impacts++;
    lastImpact = { x, z, speed, spread, entryEnergy, waveBudgetJ: budget, addedPotentialJ: rawEnergy * scale * scale, at: seconds };
    return true;
  }
  function advance(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError("finite nonnegative active seconds required");
    for (const mode of modes) {
      const drag = Math.min(damping, Math.sqrt(mode.omega2) * 0.7),
        decay = Math.exp(-drag * dt),
        w = Math.sqrt(mode.omega2 - drag * drag),
        c = Math.cos(w * dt),
        s = Math.sin(w * dt),
        q = mode.q,
        v = mode.v;
      mode.q = decay * (q * c + ((v + drag * q) * s) / w);
      mode.v = decay * (v * c - ((mode.omega2 * q + drag * v) * s) / w);
    }
    seconds += dt;
  }
  function sample(x, z) {
    let height = 0,
      sx = 0,
      sz = 0;
    for (const { kx, kz, q } of modes) {
      const ax = kx * (x + width / 2),
        az = kz * (z + length / 2),
        cx = Math.cos(ax),
        cz = Math.cos(az);
      height += q * cx * cz;
      sx -= q * kx * Math.sin(ax) * cz;
      sz -= q * kz * cx * Math.sin(az);
    }
    return [height, sx, sz];
  }
  // Separable evaluation avoids a per-pixel/per-mode trigonometric loop. Upload a small surface
  // texture; the existing native water grid and physical material retain the authored basin.
  function writeSurface(target, cols = 64, rows = 32) {
    if (target.length !== cols * rows * 4) throw new RangeError("surface buffer dimensions differ");
    if (!basis || basis.cols !== cols || basis.rows !== rows) {
      const axis = (count, modes, extent) => {
        const cos = new Float32Array(count * (modes + 1)),
          slope = new Float32Array(cos.length);
        for (let i = 0; i < count; i++)
          for (let n = 0; n <= modes; n++) {
            const a = (n * Math.PI * i) / (count - 1),
              at = i * (modes + 1) + n;
            cos[at] = Math.cos(a);
            slope[at] = (-n * Math.PI * Math.sin(a)) / extent;
          }
        return { cos, slope };
      };
      basis = { cols, rows, x: axis(cols, NX, width), z: axis(rows, NZ, length), q: new Float64Array(NX + 1), dz: new Float64Array(NX + 1) };
    }
    for (let j = 0; j < rows; j++) {
      basis.q.fill(0);
      basis.dz.fill(0);
      for (const mode of modes) {
        const at = j * (NZ + 1) + mode.m;
        basis.q[mode.n] += mode.q * basis.z.cos[at];
        basis.dz[mode.n] += mode.q * basis.z.slope[at];
      }
      for (let i = 0; i < cols; i++) {
        const at = (j * cols + i) * 4;
        target[at] = target[at + 1] = target[at + 2] = 0;
        target[at + 3] = 1;
        for (let n = 0; n <= NX; n++) {
          const b = i * (NX + 1) + n;
          target[at] += basis.q[n] * basis.x.cos[b];
          target[at + 1] += basis.q[n] * basis.x.slope[b];
          target[at + 2] += basis.dz[n] * basis.x.cos[b];
        }
      }
    }
    return target;
  }
  return {
    impact,
    advance,
    sample,
    writeSurface,
    get busy() {
      return bound() > 0.00015;
    },
    evidence: () => ({
      method: "finite-depth linear cosine basin modes; effective uniform depth",
      width,
      length,
      depth,
      modes: modes.length,
      seconds,
      impacts,
      meanDisplacement: 0,
      amplitudeBound: bound(),
      energyJ: energy(),
      lastImpact,
    }),
  };
}

// Spray is a bounded visual proxy. Its drops travel under gravity and return to the water plane;
// they do not claim to resolve a splash sheet or transfer their volume back into the surface model.
export function sprayDrop(speed, index, count) {
  const fraction = (index + 0.5) / count,
    angle = index * 2.399963229728653,
    variant = (index * 0.61803398875 + 0.13) % 1,
    radial = clamp(speed * 0.12, 0.5, 2.2) * (0.3 + 0.7 * Math.sin(index * 4.1) ** 2),
    up = Math.sqrt(2 * G * clamp(speed * speed * 0.0025, 0.08, 0.85)) * (0.38 + 0.62 * variant ** 1.7),
    startRadius = 0.1 + 0.14 * Math.sin(index * 3.7) ** 2;
  return {
    vx: radial * Math.cos(angle),
    vz: radial * Math.sin(angle),
    vy: up,
    x: startRadius * Math.cos(angle),
    z: startRadius * Math.sin(angle),
    radius: 0.003 + 0.006 * fraction,
    lifetime: (2 * up) / G,
  };
}

export function sprayPosition(drop, age) {
  return [(drop.x || 0) + drop.vx * age, drop.vy * age - 0.5 * G * age * age, (drop.z || 0) + drop.vz * age];
}

// An illustrative thin crown around the entering body. Each unequal rim section rises and falls
// ballistically; this attached sheet proxy does not solve free-surface topology changes.
export function crownSection(speed, angle, age) {
  const up = Math.sqrt(2 * G * clamp(speed * speed * 0.002, 0.05, 0.35)) * (0.72 + 0.18 * Math.sin(3 * angle + 0.7) + 0.1 * Math.sin(7 * angle)),
    radial = clamp(speed * 0.13, 0.3, 1.5) * (0.75 + 0.15 * Math.sin(5 * angle) + 0.1 * Math.cos(9 * angle));
  return {
    base: 0.22 + 0.35 * age,
    rim: 0.24 + radial * age,
    height: Math.max(0, up * age - 0.5 * G * age * age),
    lifetime: (2 * Math.sqrt(2 * G * clamp(speed * speed * 0.002, 0.05, 0.35))) / G,
  };
}
