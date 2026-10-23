import { projectDistance } from "./cloth-solver.mjs";

// Incremental XPBD cloth around the authored, avatar-specific contact envelope. The fitted drape
// supplies body/mattress/hem contact, rather than guessing a capsule through a stylized sleeper.
// Welded coarse particles carry the original solidified surface; thickness and quilting survive.
// Stretch and two-edge bending are compliant distance constraints, not a prescribed vertex swell.
export function createDuvetSolver(rest, triangles, normals, { unit = 1, up = [0, 1, 0], spacing = 0.15 } = {}) {
  const count = rest.length / 3;
  let groups,
    mapping,
    cell = spacing * unit;
  do {
    groups = [];
    mapping = new Uint32Array(count);
    const cells = new Map();
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      const key = `${Math.round(rest[j] / cell)},${Math.round(rest[j + 1] / cell)},${Math.round(rest[j + 2] / cell)}`;
      let node = cells.get(key);
      if (node === undefined) {
        node = groups.length;
        cells.set(key, node);
        groups.push([]);
      }
      groups[node].push(i);
      mapping[i] = node;
    }
    cell *= 1.3;
  } while (groups.length > 480);
  const n = groups.length,
    origin = new Float64Array(n * 3),
    contact = new Float64Array(n * 3);
  const links = new Map(),
    neighbours = Array.from({ length: n }, () => new Set());
  groups.forEach((members, i) => {
    let best = -Infinity;
    for (const k of members) {
      for (let q = 0; q < 3; q++) origin[3 * i + q] += rest[3 * k + q] / members.length;
      const dot = normals[3 * k] * up[0] + normals[3 * k + 1] * up[1] + normals[3 * k + 2] * up[2];
      if (dot > best) {
        best = dot;
        contact.set(normals.subarray(3 * k, 3 * k + 3), 3 * i);
      }
    }
    // Side hems need a little upward contact too, to preserve the offline bed/frame clearance.
    let dot = contact[3 * i] * up[0] + contact[3 * i + 1] * up[1] + contact[3 * i + 2] * up[2];
    for (let q = 0; q < 3; q++) contact[3 * i + q] += Math.max(0, 0.35 - dot) * up[q];
    const length = Math.hypot(...contact.subarray(3 * i, 3 * i + 3));
    for (let q = 0; q < 3; q++) contact[3 * i + q] /= length || 1;
  });
  const add = (a, b, bend = false) => {
    if (a === b) return;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (links.has(key)) return;
    links.set(key, { a, b, bend });
    if (!bend) {
      neighbours[a].add(b);
      neighbours[b].add(a);
    }
  };
  for (let i = 0; i < triangles.length; i += 3) {
    const a = mapping[triangles[i]],
      b = mapping[triangles[i + 1]],
      c = mapping[triangles[i + 2]];
    add(a, b);
    add(b, c);
    add(c, a);
  }
  // Opposite sides of a hinge resist sharp creases without flattening the fitted rest shape.
  neighbours.forEach((near, i) => {
    for (const j of near) for (const k of neighbours[j]) if (k > i && !near.has(k)) add(i, k, true);
  });
  const h = 1 / 120,
    indices = new Int32Array(2 * links.size),
    data = new Float64Array(4 * links.size);
  let l = 0;
  for (const { a, b, bend } of links.values()) {
    indices.set([a * 3, b * 3], l * 2);
    const length = Math.hypot(...[0, 1, 2].map((q) => origin[a * 3 + q] - origin[b * 3 + q]));
    data.set([1, 1, length, 1 / (2 + (bend ? 2e-4 : 2e-7) / (h * h))], l * 4);
    l++;
  }
  const positions = origin.slice(),
    previous = origin.slice(),
    velocities = new Float64Array(n * 3);
  const lift = new Float64Array(n);
  let remainder = 0,
    steps = 0,
    changed = false;
  function contacts() {
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      let dot = 0;
      for (let q = 0; q < 3; q++) dot += (positions[j + q] - origin[j + q]) * contact[j + q];
      if (dot < lift[i]) for (let q = 0; q < 3; q++) positions[j + q] += (lift[i] - dot) * contact[j + q];
      // Fail-safe envelope: never let a late tab, corrupt delta or a bad mesh escape the bed.
      const length = Math.hypot(positions[j] - origin[j], positions[j + 1] - origin[j + 1], positions[j + 2] - origin[j + 2]);
      if (!Number.isFinite(length)) {
        positions.set(origin);
        velocities.fill(0);
        return;
      }
      if (length > 0.025 * unit)
        for (let q = 0; q < 3; q++) positions[j + q] = origin[j + q] + ((positions[j + q] - origin[j + q]) * 0.025 * unit) / length;
    }
  }
  return {
    positions,
    origin,
    mapping,
    counts: { particles: n, constraints: links.size },
    get steps() {
      return steps;
    },
    advance(delta, chest, breath) {
      if (!(delta > 0) || !Number.isFinite(delta)) return false;
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        const d2 = (origin[j] - chest.x) ** 2 + (origin[j + 1] - chest.y) ** 2 + (origin[j + 2] - chest.z) ** 2;
        lift[i] = 0.007 * unit * Math.max(0, Math.min(1, breath)) * Math.exp(-d2 / (0.3 * unit) ** 2);
      }
      remainder += Math.min(delta, 1 / 15);
      changed = false;
      while (remainder + 1e-10 >= h) {
        remainder -= h;
        steps++;
        previous.set(positions);
        for (let j = 0; j < positions.length; j++) {
          velocities[j] = (velocities[j] - up[j % 3] * 9.80665 * unit * h) * 0.96;
          positions[j] += velocities[j] * h;
        }
        for (let pass = 0; pass < 2; pass++) {
          projectDistance(positions, indices, data, links.size);
          contacts();
        }
        for (let j = 0; j < positions.length; j++) velocities[j] = ((positions[j] - previous[j]) / h) * 0.88;
        changed = true;
      }
      return changed;
    },
    write(out) {
      for (let i = 0; i < count; i++)
        for (let q = 0; q < 3; q++) {
          const j = mapping[i] * 3 + q;
          out[i * 3 + q] = rest[i * 3 + q] + positions[j] - origin[j];
        }
    },
    reset() {
      positions.set(origin);
      previous.set(origin);
      velocities.fill(0);
      remainder = 0;
    },
  };
}
