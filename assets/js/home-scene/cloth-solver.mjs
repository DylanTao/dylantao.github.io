// Small-step XPBD cloth for the coastal home (Sirui, 2026-10-18): the linen curtains in the glass front
// and the laundry on the terrace share this solver. Pure JavaScript, no three.js, so it runs under
// `node --test`.
//
// A cloth is a triangle mesh of particles built from flat patterns (a curtain panel, a towel, the two
// halves of a shirt) whose seams are welded, plus chains (a clothes line). Each fixed step runs a few
// substeps of extended position-based dynamics with one constraint pass each, compliance alpha/h^2 and
// the multipliers reset every substep (Macklin, Mueller & Chentanez 2016; Macklin et al. 2019):
//   - stretch and shear: distance constraints on the mesh edges and the quads' crossing diagonals;
//   - bending: the isometric quadratic bending energy of Bergou, Wardetzky, Harmon, Zorin & Grinspun
//     (2006) on every interior edge, E = (3 B / 2 (A0 + A1)) |sum_i K_i x_i|^2 with K the edge's four
//     cotangent weights, projected as one linear vector constraint C = sum_i K_i x_i (so its gradient
//     is constant and a projection costs a few multiplies);
//   - long-range attachments, one-sided, from each particle to the nearest pin or peg (Kim, Chentanez
//     & Mueller 2012), so a 3 m drop does not sag with a handful of passes;
//   - ordering constraints, one-sided, that keep the folds of a gathered stack in order along the rod,
//     and separation constraints that keep two welded layers (a shirt's front and back) apart: cheap
//     stand-ins for self-collision in the two places this scene needs it;
//   - contacts against half-spaces, boxes and capsules (the glass front, the door head, the rod, the
//     floor, the festoon posts, the cap rail and the balustrade), with position-based friction.
// Constraints run in colour batches (no two in a batch share a particle), so consecutive projections
// are independent and the processor overlaps them; the order is bending, shear, stretch, so the stiff
// weave has the last word.
//
// Air acts per triangle from the wind relative to the cloth: a flat-plate normal force
// 0.5 rho C_N A |u| (u.n) n plus skin friction along the sheet, divided by 1 + k dt with k the drag's
// own damping rate (semi-implicit), so a gust cannot fling the cloth past the air's speed (after
// Keckeisen et al. 2004). The wind is sampled on a coarse lattice of particles and interpolated.
//
// Units: metres, seconds, kilograms; three.js world axes (+Y up). Steps are fixed and deterministic for
// a given seed and sequence of step times (the callers keep the accumulator that turns frames into
// steps). After construction a step allocates nothing. See PHYSICS.md ("Curtain cloth" and "Laundry on
// the terrace").

export const GRAVITY = 9.80665;
export const AIR_DENSITY = 1.2; // kg/m^3, sea-level air at about 20 C

// Fabrics. Areal densities are measured textile weights. Bending rigidities B set the bending length
// (B / (rho_A g))^(1/3), the scale below which a fabric resists folding: about 2-3 cm for sheer linen
// and 3-4 cm for a towel or shirting, in line with cantilever measurements of light woven fabrics.
// Shear compliances are authored for the drape at this mesh's 5-12 cm spacing.
export const SHEER_LINEN = Object.freeze({
  name: "sheer linen",
  arealDensity: 0.105, // kg/m^2: sheer linen weighs about 90-120 g/m^2
  stretchCompliance: 0, // m/N: a woven yarn barely stretches
  shearCompliance: 0.012, // m/N per diagonal: linen shears easily, which is how it drapes
  bendingRigidity: 2.4e-5, // N m: a bending length of 2.9 cm
  damping: 0.22, // 1/s, inter-yarn damping on top of the air's drag
  pressureCoefficient: 0.75, // flat-plate normal coefficient; a solid plate is about 1.2, the open weave leaks
  frictionCoefficient: 0.02,
  thickness: 0.006, // m, contact clearance
});
export const TOWEL_LINEN = Object.freeze({
  name: "linen towel",
  arealDensity: 0.23, // kg/m^2: a flat-woven linen towel
  stretchCompliance: 0,
  shearCompliance: 0.008,
  bendingRigidity: 6e-5, // N m: 3.0 cm
  damping: 0.3,
  pressureCoefficient: 1.05,
  frictionCoefficient: 0.02,
  thickness: 0.004,
});
export const SHIRT_LINEN = Object.freeze({
  name: "shirt linen",
  arealDensity: 0.14, // kg/m^2: shirting linen
  stretchCompliance: 0,
  shearCompliance: 0.01,
  bendingRigidity: 6e-5, // N m: 3.5 cm
  damping: 0.35,
  pressureCoefficient: 0.95,
  frictionCoefficient: 0.02,
  thickness: 0.004,
});

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The four cotangent weights of the isometric bending stencil for the hinge (x0, x1) with opposite
// corners x2 (triangle x0 x1 x2) and x3 (triangle x1 x0 x3), from the rest angles: alpha at x0 and beta
// at x1 in each triangle. For any flat (or rigidly moved) hinge sum_i K_i x_i = 0.
export function bendingWeights(alpha0, beta0, alpha1, beta1) {
  const ca0 = 1 / Math.tan(alpha0),
    cb0 = 1 / Math.tan(beta0),
    ca1 = 1 / Math.tan(alpha1),
    cb1 = 1 / Math.tan(beta1);
  return [cb0 + cb1, ca0 + ca1, -(ca0 + cb0), -(ca1 + cb1)];
}

const angleAt = (ax, ay, bx, by, cx, cy) => {
  // Interior angle at a in the triangle a b c.
  const ux = bx - ax,
    uy = by - ay,
    vx = cx - ax,
    vy = cy - ay;
  return Math.atan2(Math.abs(ux * vy - uy * vx), ux * vx + uy * vy);
};

// Builds the particles, triangles and constraints of one island. Patterns are rectangular grids in
// fabric coordinates (metres across `u` and down `v` from their first corner) placed in the world by
// a function; chains are polylines. Weld merges two particles (a seam, or a towel corner pegged to a
// line node); the merged particle keeps the first's position and sums the masses.
export function clothBuilder() {
  const points = [], // [x, y, z]
    masses = [],
    uvs = [],
    pieceOf = [],
    triangles = [], // [a, b, c, piece, restAngleA, restAngleB, restAngleC, area]
    edges = new Map(), // "a:b" -> { a, b, rest, kind, piece }
    extra = [], // [a, b, rest, kind]
    pieces = [],
    welds = [],
    tethers = [],
    orders = [],
    separations = [],
    pinned = new Set(),
    windNodes = []; // [particle, [neighbours with weights]] built per pattern
  const parent = [];
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  function particle(position, mass, uv, piece) {
    const index = points.length;
    points.push([...position]);
    masses.push(mass);
    uvs.push(uv ? [...uv] : [0, 0]);
    pieceOf.push(piece);
    parent.push(index);
    return index;
  }

  // A grid pattern: `columns` x `rows` particles over `width` x `height` metres of fabric, placed by
  // `place(u, v, c, r) -> [x, y, z]`. Returns index(c, r). Options: fabric (mass per area), hem rows and
  // mass per metre, bending and shear-compliance scales per row (a heading tape, a doubled hem), wind
  // lattice stride, crossing shear diagonals.
  function grid({
    id,
    columns,
    rows,
    width,
    height,
    place,
    fabric,
    hemRows = 0,
    hemMass = 0,
    bendScale = null,
    shearScale = null,
    windStride = 4,
    crossShear = true,
    uvOffset = [0, 0],
  }) {
    const piece = pieces.length,
      hx = width / (columns - 1),
      vy = height / (rows - 1),
      base = points.length;
    const index = (c, r) => base + r * columns + c;
    const shearAt = (r) => (shearScale ? shearScale(r) : 1) * fabric.shearCompliance;
    rowOf = (i) => Math.floor((i - base) / columns);
    shearOf = shearAt;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++) {
        const wc = c === 0 || c === columns - 1 ? 0.5 : 1,
          wr = r === 0 || r === rows - 1 ? 0.5 : 1;
        let m = fabric.arealDensity * hx * vy * wc * wr;
        if (hemRows && r >= rows - hemRows) m += (hemMass * hx * wc) / hemRows;
        // Fabric coordinates in metres: across from the first column, up from the last row.
        particle(place(c * hx, r * vy, c, r), m, [uvOffset[0] + c * hx, uvOffset[1] + (rows - 1 - r) * vy], piece);
      }
    const pieceRecord = {
      id: String(id ?? `piece-${piece}`),
      kind: "grid",
      piece,
      base,
      columns,
      rows,
      width,
      height,
      hx,
      vy,
      fabric,
      bendScale,
      triangles: [],
    };
    pieces.push(pieceRecord);
    // Triangles with alternating diagonals, which keeps the grid's response the same in both senses.
    for (let r = 0; r < rows - 1; r++)
      for (let c = 0; c < columns - 1; c++) {
        const i00 = index(c, r),
          i10 = index(c + 1, r),
          i01 = index(c, r + 1),
          i11 = index(c + 1, r + 1),
          // Rest corners in the pattern's plane: (across, down).
          p00 = [c * hx, r * vy],
          p10 = [(c + 1) * hx, r * vy],
          p01 = [c * hx, (r + 1) * vy],
          p11 = [(c + 1) * hx, (r + 1) * vy];
        if ((r + c) % 2 === 0) {
          triangle(i00, i10, i11, p00, p10, p11, piece);
          triangle(i00, i11, i01, p00, p11, p01, piece);
          if (crossShear) extra.push([i10, i01, Math.hypot(hx, vy), 1, shearAt(r), piece]);
        } else {
          triangle(i00, i10, i01, p00, p10, p01, piece);
          triangle(i10, i11, i01, p10, p11, p01, piece);
          if (crossShear) extra.push([i00, i11, Math.hypot(hx, vy), 1, shearAt(r), piece]);
        }
      }
    rowOf = null;
    shearOf = null;
    // Wind lattice: every `windStride` columns and rows, plus the last.
    const marks = (n) => {
      const out = [];
      for (let k = 0; k < n - 1; k += windStride) out.push(k);
      out.push(n - 1);
      return out;
    };
    const mc = marks(columns),
      mr = marks(rows);
    const cell = (marks, x) => {
      let k = 0;
      while (k < marks.length - 2 && x > marks[k + 1]) k++;
      return [k, (x - marks[k]) / (marks[k + 1] - marks[k] || 1)];
    };
    const nodeBase = windNodes.length;
    for (const r of mr) for (const c of mc) windNodes.push({ particle: index(c, r) });
    pieceRecord.windGrid = { nodeBase, mc, mr };
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++) {
        const [kx, fx] = cell(mc, c),
          [ky, fy] = cell(mr, r),
          n00 = nodeBase + ky * mc.length + kx,
          n10 = n00 + (mc.length > 1 ? 1 : 0),
          n01 = n00 + (mr.length > 1 ? mc.length : 0),
          n11 = n01 + (mc.length > 1 ? 1 : 0);
        windWeights[index(c, r)] = [
          [n00, (1 - fx) * (1 - fy)],
          [n10, fx * (1 - fy)],
          [n01, (1 - fx) * fy],
          [n11, fx * fy],
        ];
      }
    return { piece, base, columns, rows, hx, vy, index };
  }
  const windWeights = [];
  // While a grid builds its triangles: the row of a particle and the shear compliance of a row.
  let rowOf = null,
    shearOf = null;

  // A chain (a rope or a line): particles along `path` (array of [x, y, z]), each carrying
  // `massPerMetre` of rope; rest lengths are the path's segments times (1 + slack).
  function chain({
    id,
    path,
    massPerMetre,
    slack = 0,
    compliance = 0,
    windStride = 3,
    fabric = { pressureCoefficient: 0, frictionCoefficient: 0, damping: 0.4, thickness: 0.004 },
  }) {
    const piece = pieces.length,
      base = points.length,
      n = path.length;
    const lengths = path.map((p, k) => (k ? Math.hypot(p[0] - path[k - 1][0], p[1] - path[k - 1][1], p[2] - path[k - 1][2]) : 0));
    let along = 0;
    for (let k = 0; k < n; k++) {
      const left = k ? lengths[k] : 0,
        right = k < n - 1 ? lengths[k + 1] : 0;
      along += left;
      particle(path[k], massPerMetre * 0.5 * (left + right), [along, 0], piece);
    }
    const record = { id: String(id ?? `chain-${piece}`), kind: "chain", piece, base, count: n, fabric, triangles: [] };
    pieces.push(record);
    for (let k = 1; k < n; k++) extra.push([base + k - 1, base + k, lengths[k] * (1 + slack), 3, compliance, piece]);
    const nodeBase = windNodes.length,
      marks = [];
    for (let k = 0; k < n - 1; k += windStride) marks.push(k);
    marks.push(n - 1);
    for (const k of marks) windNodes.push({ particle: base + k });
    for (let k = 0; k < n; k++) {
      let j = 0;
      while (j < marks.length - 2 && k > marks[j + 1]) j++;
      const f = (k - marks[j]) / (marks[j + 1] - marks[j] || 1);
      windWeights[base + k] = [
        [nodeBase + j, 1 - f],
        [nodeBase + Math.min(j + 1, marks.length - 1), f],
      ];
    }
    return { piece, base, count: n, index: (k) => base + k };
  }

  function triangle(a, b, c, pa, pb, pc, piece) {
    const A = angleAt(pa[0], pa[1], pb[0], pb[1], pc[0], pc[1]),
      B = angleAt(pb[0], pb[1], pc[0], pc[1], pa[0], pa[1]),
      C = Math.PI - A - B,
      area = 0.5 * Math.abs((pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]));
    triangles.push([a, b, c, piece, A, B, C, area]);
    edge(a, b, pa, pb, piece);
    edge(b, c, pb, pc, piece);
    edge(c, a, pc, pa, piece);
  }
  // An edge along the weave (warp or weft) is a stretch constraint; a diagonal one is shear.
  function edge(a, b, p, q, piece) {
    const key = pairKey(a, b);
    if (edges.has(key)) return;
    const du = q[0] - p[0],
      dv = q[1] - p[1],
      kind = Math.abs(du) < 1e-9 || Math.abs(dv) < 1e-9 ? 0 : 1,
      compliance = kind === 1 && shearOf && rowOf ? shearOf(Math.min(rowOf(a), rowOf(b))) : null;
    edges.set(key, { a: Math.min(a, b), b: Math.max(a, b), rest: Math.hypot(du, dv), piece, kind, compliance });
  }

  return {
    grid,
    chain,
    // Merge particle j into particle i (a seam, or a towel corner pegged onto a line node).
    weld(i, j) {
      welds.push([i, j]);
    },
    pin(i) {
      pinned.add(i);
    },
    // Extra mass at a particle (a wooden peg on the line).
    addMass(i, m) {
      masses[i] += m;
    },
    // One-sided reach: particle i stays within `rest` of `anchor` (the anchor is not moved).
    tether(i, anchor, rest) {
      tethers.push([i, anchor, rest]);
    },
    // One-sided order along a horizontal axis: (x_j - x_i) . axis >= gap * scale(step).
    order(i, j, axis, gap) {
      orders.push([i, j, axis[0], axis[1], axis[2], gap]);
    },
    // One-sided separation: |x_j - x_i| >= gap.
    separate(i, j, gap) {
      separations.push([i, j, gap]);
    },
    // An extra distance constraint (kind 0 stretch, 1 shear, 3 rope) with its own compliance.
    link(i, j, rest, kind = 0, compliance = null) {
      extra.push([i, j, rest, kind, compliance, pieceOf[i]]);
    },
    get count() {
      return points.length;
    },
    position: (i) => points[i],
    build() {
      // Resolve welds: the second particle's mass moves onto the first, and every reference follows.
      for (const [i, j] of welds) {
        const a = find(i),
          b = find(j);
        if (a === b) continue;
        parent[b] = a;
        masses[a] += masses[b];
        masses[b] = 0;
      }
      const remap = new Int32Array(points.length).fill(-1);
      let count = 0;
      for (let i = 0; i < points.length; i++) if (find(i) === i) remap[i] = count++;
      const id = (i) => remap[find(i)];
      const position = new Float64Array(3 * count),
        mass = new Float64Array(count),
        uv = new Float32Array(2 * count),
        piece = new Uint16Array(count),
        kinematic = new Uint8Array(count);
      for (let i = 0; i < points.length; i++) {
        const k = remap[i];
        if (k < 0) continue;
        position.set(points[i], 3 * k);
        mass[k] = masses[i];
        uv.set(uvs[i], 2 * k);
        piece[k] = pieceOf[i];
      }
      for (const i of pinned) kinematic[id(i)] = 1;
      const tri = triangles.map(([a, b, c, p, A, B, C, area]) => [id(a), id(b), id(c), p, A, B, C, area]);
      const distance = [];
      const seen = new Set();
      for (const { a, b, rest, kind, compliance, piece: p } of edges.values()) {
        const ia = id(a),
          ib = id(b);
        if (ia === ib) continue;
        const key = pairKey(ia, ib);
        if (seen.has(key)) continue;
        seen.add(key);
        distance.push([ia, ib, rest, kind, compliance, p]);
      }
      for (const [a, b, rest, kind, compliance, p] of extra) {
        const ia = id(a),
          ib = id(b);
        if (ia !== ib) distance.push([ia, ib, rest, kind, compliance ?? null, p ?? pieceOf[a]]);
      }
      // Hinges: every edge shared by exactly two triangles.
      const hinges = new Map();
      tri.forEach((t, k) => {
        for (let e = 0; e < 3; e++) {
          const a = t[e],
            b = t[(e + 1) % 3],
            key = pairKey(a, b);
          if (!hinges.has(key)) hinges.set(key, []);
          hinges.get(key).push([k, e]);
        }
      });
      const bending = [];
      for (const list of hinges.values()) {
        if (list.length !== 2) continue;
        const [[t0, e0], [t1, e1]] = list,
          T0 = tri[t0],
          T1 = tri[t1];
        // x0, x1: the shared edge as triangle t0 runs it; x2, x3 the opposite corners.
        const x0 = T0[e0],
          x1 = T0[(e0 + 1) % 3],
          x2 = T0[(e0 + 2) % 3],
          x3 = T1[(e1 + 2) % 3];
        const angle0 = (v) => T0[4 + T0.slice(0, 3).indexOf(v)],
          angle1 = (v) => T1[4 + T1.slice(0, 3).indexOf(v)];
        const K = bendingWeights(angle0(x0), angle0(x1), angle1(x0), angle1(x1));
        // Bending scale: the larger of the two triangles' pieces' row scales at this hinge.
        bending.push({ index: [x0, x1, x2, x3], K, area: T0[7] + T1[7], pieces: [T0[3], T1[3]], seam: T0[3] !== T1[3] });
      }
      return {
        count,
        position,
        mass,
        uv,
        piece,
        kinematic,
        triangles: tri,
        distance,
        bending,
        tethers: tethers.map(([i, a, rest]) => [id(i), id(a), rest]).filter(([i, a]) => i !== a),
        orders: orders.map(([i, j, ax, ay, az, gap]) => [id(i), id(j), ax, ay, az, gap]).filter(([i, j]) => i !== j),
        separations: separations.map(([i, j, gap]) => [id(i), id(j), gap]).filter(([i, j]) => i !== j),
        pieces,
        // Each grid's particles in row-major order (island indices), for smooth grid normals.
        grids: pieces
          .filter((p) => p.kind === "grid")
          .map((p) => ({
            piece: p.piece,
            columns: p.columns,
            rows: p.rows,
            index: Int32Array.from({ length: p.columns * p.rows }, (_, k) => id(p.base + k)),
          })),
        // Particles that more than one pattern shares (seams, pegs).
        shared: (() => {
          const owners = new Uint8Array(count);
          for (const p of pieces) if (p.kind === "grid") for (let k = 0; k < p.columns * p.rows; k++) owners[id(p.base + k)]++;
          return Uint8Array.from(owners, (n) => (n > 1 ? 1 : 0));
        })(),
        windNodes: windNodes.map((node) => id(node.particle)),
        windWeights: (() => {
          const out = new Array(count);
          for (let i = 0; i < points.length; i++) if (remap[i] >= 0) out[remap[i]] = (windWeights[i] || []).map(([n, w]) => [n, w]);
          return out;
        })(),
        id,
      };
    },
  };
}

// Greedy colouring: constraints in the same colour share no particle. Returns the order to run them.
// The colours taken at each particle are bits of a 32-bit mask per pass of 32 colours, so a
// constraint's colour is the lowest bit free at all its particles (a few dozen colours at most here).
function colourOrder(list, particlesOf, count) {
  const colourOf = new Int32Array(list.length),
    passes = [];
  let colours = 0;
  for (let k = 0; k < list.length; k++) {
    const ps = particlesOf(list[k]);
    let c = -1;
    for (let pass = 0; c < 0; pass++) {
      if (!passes[pass]) passes[pass] = new Uint32Array(count);
      const taken = passes[pass];
      let used = 0;
      for (let q = 0; q < ps.length; q++) used |= taken[ps[q]];
      if (used !== -1) {
        const bit = 31 - Math.clz32(~used & (used + 1));
        c = 32 * pass + bit;
        for (let q = 0; q < ps.length; q++) taken[ps[q]] |= 1 << bit;
      }
    }
    colourOf[k] = c;
    if (c + 1 > colours) colours = c + 1;
  }
  const order = Array.from(list.keys()).sort((a, b) => colourOf[a] - colourOf[b] || a - b);
  return { order, colours };
}

// A Map key for an unordered particle pair.
const pairKey = (a, b) => (a < b ? a * 4194304 + b : b * 4194304 + a);

// One island: the particles of one model and everything that acts on them. `wind` is
// `(x, y, z, t, out) => out` in m/s, or an object with `sampleBatch(points, count, clock, out)`.
// `colliders`: { planes: [{ normal, offset, clearance }], boxes: [{ min, max }], capsules: [{ a, b, radius }],
// floorY }. `drive(island, time)` runs at the start of each step and moves kinematic targets.
export function createClothIsland(model, options = {}) {
  const {
    fixedStep = 1 / 30,
    substeps = 6,
    gravity = GRAVITY,
    airDensity = AIR_DENSITY,
    wind = null,
    colliders = {},
    friction = 0.45,
    drive = null,
    sleepWind = 0.15,
    sleepSpeed = 0.012,
    sleepDelay = 1,
    settleSeconds = 2,
    seed = 1,
    id = "cloth",
    windScale = 1,
  } = options;
  const h = fixedStep / substeps,
    inverseH = 1 / h,
    N = model.count,
    random = mulberry32(seed);
  let allocations = 0;
  const alloc = (Type, n) => {
    allocations++;
    return new Type(n);
  };
  const pos = alloc(Float64Array, 3 * N),
    prev = alloc(Float64Array, 3 * N),
    vel = alloc(Float64Array, 3 * N),
    last = alloc(Float64Array, 3 * N),
    force = alloc(Float64Array, 3 * N),
    windAt = alloc(Float64Array, 3 * N),
    targetA = alloc(Float64Array, 3 * N),
    targetB = alloc(Float64Array, 3 * N),
    rest = alloc(Float64Array, 3 * N),
    mass = Float64Array.from(model.mass),
    invMass = alloc(Float64Array, N),
    inverseMass = alloc(Float64Array, N),
    kinematic = Uint8Array.from(model.kinematic),
    pieceOf = Uint16Array.from(model.piece),
    damp = alloc(Float64Array, N);
  pos.set(model.position);
  prev.set(pos);
  last.set(pos);
  targetA.set(pos);
  targetB.set(pos);
  rest.set(pos);
  const pieces = model.pieces;
  for (let i = 0; i < N; i++) {
    const fabric = pieces[pieceOf[i]].fabric;
    inverseMass[i] = mass[i] > 0 ? 1 / mass[i] : 0;
    invMass[i] = kinematic[i] ? 0 : inverseMass[i];
    damp[i] = Math.exp(-(fabric.damping ?? 0.3) * h);
  }
  // Distance constraints, coloured; kinds 0 stretch, 1 shear, 3 rope. Shear runs before stretch. A
  // constraint takes its compliance from the piece that made it (a pegged particle belongs to the line).
  const fabricOf = (i) => pieces[pieceOf[i]].fabric;
  const compliance = (kind, piece, explicit) => {
    if (explicit !== null && explicit !== undefined) return explicit;
    const f = pieces[piece].fabric;
    return (kind === 1 ? f.shearCompliance : f.stretchCompliance) ?? 0;
  };
  // A constraint between two kinematic particles can do nothing, so it is left out.
  const distances = model.distance
    .filter(([a, b]) => !(kinematic[a] && kinematic[b]))
    .map(([a, b, restLength, kind, explicit, piece]) => ({ a, b, rest: restLength, kind, alpha: compliance(kind, piece ?? pieceOf[a], explicit) }));
  const shearFirst = [...distances.filter((d) => d.kind === 1), ...distances.filter((d) => d.kind !== 1)];
  const dOrder = [];
  for (const group of [shearFirst.filter((d) => d.kind === 1), shearFirst.filter((d) => d.kind !== 1)]) {
    const { order } = colourOrder(group, (d) => [d.a, d.b], N);
    for (const k of order) dOrder.push(group[k]);
  }
  const D = dOrder.length,
    dIndex = alloc(Int32Array, 2 * D),
    dData = alloc(Float64Array, 4 * D),
    dKind = alloc(Uint8Array, D);
  dOrder.forEach((d, k) => {
    const wa = invMass[d.a],
      wb = invMass[d.b];
    dIndex[2 * k] = 3 * d.a;
    dIndex[2 * k + 1] = 3 * d.b;
    dData[4 * k] = wa;
    dData[4 * k + 1] = wb;
    dData[4 * k + 2] = d.rest;
    dData[4 * k + 3] = wa + wb > 0 ? 1 / (wa + wb + d.alpha / (h * h)) : 0;
    dKind[k] = d.kind;
  });
  // Bending: per hinge four particle offsets, the four weights K_i, four coefficients
  // a_i = -w_i K_i / (sum w K^2 + alpha~) and the stiffness 1 / alpha for the energy.
  // Each grid's rows by island particle (after welds), for row-dependent bending (a tape, a hem).
  const rowsByPiece = new Map(
    (model.grids || []).map((g) => [g.piece, new Map(Array.from(g.index, (particle, k) => [particle, Math.floor(k / g.columns)]))])
  );
  const bendScale = (hinge) => {
    let scale = 0;
    for (const p of hinge.pieces) {
      const record = pieces[p],
        rows = rowsByPiece.get(p);
      if (!record.bendScale || !rows) {
        scale = Math.max(scale, 1);
        continue;
      }
      let best = 0;
      for (const i of hinge.index) {
        const r = rows.get(i);
        if (r !== undefined) best = Math.max(best, record.bendScale(r));
      }
      scale = Math.max(scale, best || 1);
    }
    return (hinge.seam ? 0.25 : 1) * (scale || 1);
  };
  const hinges = model.bending.filter((b) => b.index.some((i) => !kinematic[i]));
  const { order: bOrderIdx } = colourOrder(hinges, (b) => b.index, N);
  const B = hinges.length,
    bIndex = alloc(Int32Array, 4 * B),
    bData = alloc(Float64Array, 9 * B);
  bOrderIdx.forEach((k, slot) => {
    const hinge = hinges[k],
      rigidity = Math.max(...hinge.pieces.map((p) => pieces[p].fabric.bendingRigidity ?? 0)) * bendScale(hinge),
      // E = (3 B / 2 (A0 + A1)) |C|^2 = |C|^2 / 2 alpha  =>  alpha = (A0 + A1) / (3 B).
      alpha = hinge.area / (3 * Math.max(1e-12, rigidity));
    let denominator = alpha / (h * h);
    for (let q = 0; q < 4; q++) denominator += invMass[hinge.index[q]] * hinge.K[q] * hinge.K[q];
    for (let q = 0; q < 4; q++) {
      bIndex[4 * slot + q] = 3 * hinge.index[q];
      bData[9 * slot + q] = hinge.K[q];
      bData[9 * slot + 4 + q] = (-invMass[hinge.index[q]] * hinge.K[q]) / denominator;
    }
    bData[9 * slot + 8] = 1 / alpha;
  });
  // Tethers (one-sided reach to an anchor), orders and separations.
  const tetherList = model.tethers.filter(([i]) => !kinematic[i]);
  const T = tetherList.length,
    tIndex = alloc(Int32Array, 2 * T),
    tRest = alloc(Float64Array, T);
  tetherList.forEach(([i, a, r], k) => {
    tIndex[2 * k] = 3 * i;
    tIndex[2 * k + 1] = 3 * a;
    tRest[k] = r;
  });
  const O = model.orders.length,
    oIndex = alloc(Int32Array, 2 * O),
    oData = alloc(Float64Array, 6 * O);
  model.orders.forEach(([i, j, ax, ay, az, gap], k) => {
    oIndex[2 * k] = 3 * i;
    oIndex[2 * k + 1] = 3 * j;
    const wi = invMass[i],
      wj = invMass[j];
    oData.set([ax, ay, az, gap, wi + wj > 0 ? wi / (wi + wj) : 0, wi + wj > 0 ? wj / (wi + wj) : 0], 6 * k);
  });
  const S = model.separations.length,
    sIndex = alloc(Int32Array, 2 * S),
    sData = alloc(Float64Array, 3 * S);
  model.separations.forEach(([i, j, gap], k) => {
    sIndex[2 * k] = 3 * i;
    sIndex[2 * k + 1] = 3 * j;
    const wi = invMass[i],
      wj = invMass[j];
    sData.set([gap, wi + wj > 0 ? wi / (wi + wj) : 0, wi + wj > 0 ? wj / (wi + wj) : 0], 3 * k);
  });
  // Triangles for air and rendering.
  const TR = model.triangles.length,
    triIndex = alloc(Uint32Array, 3 * TR),
    triPiece = alloc(Uint16Array, TR);
  model.triangles.forEach(([a, b, c, p], k) => {
    triIndex[3 * k] = a;
    triIndex[3 * k + 1] = b;
    triIndex[3 * k + 2] = c;
    triPiece[k] = p;
  });
  const pieceAir = alloc(Float64Array, 3 * pieces.length);
  pieces.forEach((p, k) => {
    pieceAir[3 * k] = p.fabric.pressureCoefficient ?? 0;
    pieceAir[3 * k + 1] = p.fabric.frictionCoefficient ?? 0;
    pieceAir[3 * k + 2] = p.fabric.arealDensity ?? 0.1;
  });
  // Wind lattice.
  const L = model.windNodes.length,
    lNode = Uint32Array.from(model.windNodes),
    lPoints = alloc(Float64Array, 3 * L),
    lWind = alloc(Float64Array, 3 * L),
    wCount = alloc(Uint8Array, N),
    wNode = alloc(Uint32Array, 4 * N),
    wWeight = alloc(Float64Array, 4 * N);
  for (let i = 0; i < N; i++) {
    const list = model.windWeights[i] || [];
    wCount[i] = Math.min(4, list.length);
    for (let q = 0; q < wCount[i]; q++) {
      wNode[4 * i + q] = list[q][0];
      wWeight[4 * i + q] = list[q][1];
    }
  }
  // Colliders.
  const planes = (colliders.planes || []).map((p) => {
    const n = p.normal,
      length = Math.hypot(n[0], n[1], n[2]);
    return [n[0] / length, n[1] / length, n[2] / length, p.offset / length + (p.clearance ?? 0)];
  });
  const P4 = alloc(Float64Array, 4 * planes.length);
  planes.forEach((p, k) => P4.set(p, 4 * k));
  const boxes = colliders.boxes || [],
    BX = alloc(Float64Array, 6 * boxes.length);
  boxes.forEach((b, k) => BX.set([...b.min, ...b.max], 6 * k));
  const capsules = colliders.capsules || [],
    CP = alloc(Float64Array, 7 * capsules.length),
    // Each capsule's bounding box, widened by the thickest fabric, for a cheap reject.
    CB = alloc(Float64Array, 6 * capsules.length);
  capsules.forEach((c, k) => {
    CP.set([...c.a, ...c.b, c.radius], 7 * k);
    const pad = c.radius + 0.02;
    CB.set(
      [
        Math.min(c.a[0], c.b[0]) - pad,
        Math.min(c.a[1], c.b[1]) - pad,
        Math.min(c.a[2], c.b[2]) - pad,
        Math.max(c.a[0], c.b[0]) + pad,
        Math.max(c.a[1], c.b[1]) + pad,
        Math.max(c.a[2], c.b[2]) + pad,
      ],
      6 * k
    );
  });
  const floorY = colliders.floorY ?? -Infinity;
  const thickness = alloc(Float64Array, N);
  for (let i = 0; i < N; i++) thickness[i] = fabricOf(i).thickness ?? 0.005;

  const state = {
    sleeping: false,
    calm: 0,
    active: true,
    settled: false,
    windMax: 0,
    maxSpeed: 0,
    orderScale: 1,
    windScale,
    revision: 0,
    steps: 0,
  };
  const clock = alloc(Float64Array, 1);
  let windFn = null,
    batch = null;
  setWind(wind);
  function setWind(next) {
    windFn = typeof next === "function" ? next : typeof next?.sample === "function" ? next.sample : null;
    batch = next && typeof next.sampleBatch === "function" ? next.sampleBatch : null;
  }
  const windOut = [0, 0, 0];

  function sampleWind() {
    if (batch) {
      for (let l = 0; l < L; l++) {
        const i3 = 3 * lNode[l];
        lPoints[3 * l] = pos[i3];
        lPoints[3 * l + 1] = pos[i3 + 1];
        lPoints[3 * l + 2] = pos[i3 + 2];
      }
      batch(lPoints, L, clock, lWind);
    } else if (windFn) {
      const t = clock[0];
      for (let l = 0; l < L; l++) {
        const i3 = 3 * lNode[l];
        const v = windFn(pos[i3], pos[i3 + 1], pos[i3 + 2], t, windOut) || windOut;
        lWind[3 * l] = v[0];
        lWind[3 * l + 1] = v[1];
        lWind[3 * l + 2] = v[2];
      }
    } else lWind.fill(0);
    const scale = state.windScale;
    let max2 = 0;
    for (let k = 0; k < 3 * L; k += 3) {
      const x = lWind[k] * scale,
        y = lWind[k + 1] * scale,
        z = lWind[k + 2] * scale;
      lWind[k] = x;
      lWind[k + 1] = y;
      lWind[k + 2] = z;
      const s2 = x * x + y * y + z * z;
      if (s2 > max2) max2 = s2;
    }
    state.windMax = Math.sqrt(max2);
    for (let i = 0; i < N; i++) {
      let x = 0,
        y = 0,
        z = 0;
      for (let q = 0, n = wCount[i]; q < n; q++) {
        const l3 = 3 * wNode[4 * i + q],
          w = wWeight[4 * i + q];
        x += lWind[l3] * w;
        y += lWind[l3 + 1] * w;
        z += lWind[l3 + 2] * w;
      }
      windAt[3 * i] = x;
      windAt[3 * i + 1] = y;
      windAt[3 * i + 2] = z;
    }
  }

  // Per-triangle air force from the wind relative to the triangle's mean velocity, a third to each corner.
  function aerodynamics() {
    force.fill(0);
    const k0 = 0.5 * airDensity,
      third = 1 / 3;
    for (let t = 0; t < TR; t++) {
      const p3 = 3 * triPiece[t],
        Cn = pieceAir[p3];
      if (Cn === 0) continue;
      const Cf = pieceAir[p3 + 1],
        rate = (k0 * Cn * fixedStep) / pieceAir[p3 + 2];
      const a3 = 3 * triIndex[3 * t],
        b3 = 3 * triIndex[3 * t + 1],
        c3 = 3 * triIndex[3 * t + 2];
      const ex = pos[b3] - pos[a3],
        ey = pos[b3 + 1] - pos[a3 + 1],
        ez = pos[b3 + 2] - pos[a3 + 2],
        gx = pos[c3] - pos[a3],
        gy = pos[c3 + 1] - pos[a3 + 1],
        gz = pos[c3 + 2] - pos[a3 + 2];
      let nx = ey * gz - ez * gy,
        ny = ez * gx - ex * gz,
        nz = ex * gy - ey * gx;
      const twice = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (twice < 1e-12) continue;
      nx /= twice;
      ny /= twice;
      nz /= twice;
      const ux = (windAt[a3] + windAt[b3] + windAt[c3] - vel[a3] - vel[b3] - vel[c3]) * third,
        uy = (windAt[a3 + 1] + windAt[b3 + 1] + windAt[c3 + 1] - vel[a3 + 1] - vel[b3 + 1] - vel[c3 + 1]) * third,
        uz = (windAt[a3 + 2] + windAt[b3 + 2] + windAt[c3 + 2] - vel[a3 + 2] - vel[b3 + 2] - vel[c3 + 2]) * third;
      const speed = Math.sqrt(ux * ux + uy * uy + uz * uz);
      if (speed < 1e-6) continue;
      const un = ux * nx + uy * ny + uz * nz,
        scale = (k0 * 0.5 * twice * speed * third) / (1 + rate * speed),
        normal = Cn * un;
      const fx = scale * (normal * nx + Cf * (ux - un * nx)),
        fy = scale * (normal * ny + Cf * (uy - un * ny)),
        fz = scale * (normal * nz + Cf * (uz - un * nz));
      force[a3] += fx;
      force[a3 + 1] += fy;
      force[a3 + 2] += fz;
      force[b3] += fx;
      force[b3 + 1] += fy;
      force[b3 + 2] += fz;
      force[c3] += fx;
      force[c3 + 1] += fy;
      force[c3 + 2] += fz;
    }
  }

  function substep(s, settling) {
    const gh = gravity * h,
      settle = settling ? Math.exp(-8 * h) : 1;
    for (let i = 0, i3 = 0; i < N; i++, i3 += 3) {
      prev[i3] = pos[i3];
      prev[i3 + 1] = pos[i3 + 1];
      prev[i3 + 2] = pos[i3 + 2];
      if (kinematic[i]) {
        const f = (s + 1) / substeps;
        pos[i3] = targetA[i3] + (targetB[i3] - targetA[i3]) * f;
        pos[i3 + 1] = targetA[i3 + 1] + (targetB[i3 + 1] - targetA[i3 + 1]) * f;
        pos[i3 + 2] = targetA[i3 + 2] + (targetB[i3 + 2] - targetA[i3 + 2]) * f;
        continue;
      }
      const im = inverseMass[i] * h,
        d = damp[i] * settle;
      const x = (vel[i3] + force[i3] * im) * d,
        y = (vel[i3 + 1] + force[i3 + 1] * im - gh) * d,
        z = (vel[i3 + 2] + force[i3 + 2] * im) * d;
      pos[i3] += x * h;
      pos[i3 + 1] += y * h;
      pos[i3 + 2] += z * h;
    }
    projectBending(pos, bIndex, bData, B);
    projectDistance(pos, dIndex, dData, D);
    projectTethers(pos, tIndex, tRest, T);
    if (O) projectOrders(pos, oIndex, oData, O, state.orderScale);
    if (S) projectSeparations(pos, sIndex, sData, S);
    collide();
    let max2 = 0;
    for (let i = 0, i3 = 0; i < N; i++, i3 += 3) {
      const x = (pos[i3] - prev[i3]) * inverseH,
        y = (pos[i3 + 1] - prev[i3 + 1]) * inverseH,
        z = (pos[i3 + 2] - prev[i3 + 2]) * inverseH;
      vel[i3] = x;
      vel[i3 + 1] = y;
      vel[i3 + 2] = z;
      if (!kinematic[i]) {
        const s2 = x * x + y * y + z * z;
        if (s2 > max2) max2 = s2;
      }
    }
    if (s === substeps - 1) state.maxSpeed = Math.sqrt(max2);
  }

  // Contacts: push out of every collider, then keep only part of this substep's sliding (friction).
  function collide() {
    const np = P4.length,
      nb = BX.length,
      nc = CP.length;
    for (let i = 0, i3 = 0; i < N; i++, i3 += 3) {
      if (kinematic[i]) continue;
      const r = thickness[i];
      let touched = 0,
        nx = 0,
        ny = 0,
        nz = 0;
      if (pos[i3 + 1] < floorY + r) {
        pos[i3 + 1] = floorY + r;
        touched = 1;
        ny = 1;
      }
      for (let k = 0; k < np; k += 4) {
        const d = P4[k] * pos[i3] + P4[k + 1] * pos[i3 + 1] + P4[k + 2] * pos[i3 + 2] - P4[k + 3] - r;
        if (d < 0) {
          pos[i3] -= d * P4[k];
          pos[i3 + 1] -= d * P4[k + 1];
          pos[i3 + 2] -= d * P4[k + 2];
          touched = 1;
          nx = P4[k];
          ny = P4[k + 1];
          nz = P4[k + 2];
        }
      }
      for (let k = 0; k < nb; k += 6) {
        const x = pos[i3],
          y = pos[i3 + 1],
          z = pos[i3 + 2];
        const lx = BX[k] - r,
          ly = BX[k + 1] - r,
          lz = BX[k + 2] - r,
          hx = BX[k + 3] + r,
          hy = BX[k + 4] + r,
          hz = BX[k + 5] + r;
        if (x <= lx || x >= hx || y <= ly || y >= hy || z <= lz || z >= hz) continue;
        // Out along the axis of least penetration.
        const d0 = x - lx,
          d1 = hx - x,
          d2 = y - ly,
          d3 = hy - y,
          d4 = z - lz,
          d5 = hz - z;
        let m = d0,
          axis = 0;
        if (d1 < m) ((m = d1), (axis = 1));
        if (d2 < m) ((m = d2), (axis = 2));
        if (d3 < m) ((m = d3), (axis = 3));
        if (d4 < m) ((m = d4), (axis = 4));
        if (d5 < m) ((m = d5), (axis = 5));
        nx = ny = nz = 0;
        if (axis === 0) ((pos[i3] = lx), (nx = -1));
        else if (axis === 1) ((pos[i3] = hx), (nx = 1));
        else if (axis === 2) ((pos[i3 + 1] = ly), (ny = -1));
        else if (axis === 3) ((pos[i3 + 1] = hy), (ny = 1));
        else if (axis === 4) ((pos[i3 + 2] = lz), (nz = -1));
        else ((pos[i3 + 2] = hz), (nz = 1));
        touched = 1;
      }
      for (let k = 0, k6 = 0; k < nc; k += 7, k6 += 6) {
        const px0 = pos[i3],
          py0 = pos[i3 + 1],
          pz0 = pos[i3 + 2];
        if (px0 < CB[k6] || px0 > CB[k6 + 3] || py0 < CB[k6 + 1] || py0 > CB[k6 + 4] || pz0 < CB[k6 + 2] || pz0 > CB[k6 + 5]) continue;
        const ax = CP[k],
          ay = CP[k + 1],
          az = CP[k + 2],
          bx = CP[k + 3] - ax,
          by = CP[k + 4] - ay,
          bz = CP[k + 5] - az,
          radius = CP[k + 6] + r;
        const px = pos[i3] - ax,
          py = pos[i3 + 1] - ay,
          pz = pos[i3 + 2] - az,
          bb = bx * bx + by * by + bz * bz,
          t = bb > 0 ? clamp((px * bx + py * by + pz * bz) / bb, 0, 1) : 0;
        const dx = px - t * bx,
          dy = py - t * by,
          dz = pz - t * bz,
          d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= radius * radius || d2 < 1e-16) continue;
        const d = Math.sqrt(d2),
          push = (radius - d) / d;
        pos[i3] += dx * push;
        pos[i3 + 1] += dy * push;
        pos[i3 + 2] += dz * push;
        nx = dx / d;
        ny = dy / d;
        nz = dz / d;
        touched = 1;
      }
      if (touched) {
        // Friction against the last contact's normal: remove most of the tangential slide.
        const sx = pos[i3] - prev[i3],
          sy = pos[i3 + 1] - prev[i3 + 1],
          sz = pos[i3 + 2] - prev[i3 + 2],
          sn = sx * nx + sy * ny + sz * nz;
        pos[i3] -= friction * (sx - sn * nx);
        pos[i3 + 1] -= friction * (sy - sn * ny);
        pos[i3 + 2] -= friction * (sz - sn * nz);
      }
    }
  }

  function step(time, settling = false) {
    clock[0] = time;
    if (!settling) {
      targetA.set(targetB);
      if (drive) drive(api, time);
    }
    let moving = false;
    for (let i = 0, i3 = 0; i < N; i++, i3 += 3)
      if (kinematic[i] && (targetA[i3] !== targetB[i3] || targetA[i3 + 1] !== targetB[i3 + 1] || targetA[i3 + 2] !== targetB[i3 + 2])) {
        moving = true;
        break;
      }
    if (settling) force.fill(0);
    else {
      sampleWind();
      if (state.sleeping) {
        if (!moving && state.windMax <= 1.3 * sleepWind) return false;
        state.sleeping = false;
        state.calm = 0;
      }
      aerodynamics();
    }
    last.set(pos);
    for (let s = 0; s < substeps; s++) substep(s, settling);
    state.steps++;
    state.revision++;
    if (!settling) {
      if (!moving && state.windMax < sleepWind && state.maxSpeed < sleepSpeed) {
        state.calm += fixedStep;
        if (state.calm >= sleepDelay) {
          state.sleeping = true;
          vel.fill(0);
          last.set(pos);
        }
      } else state.calm = 0;
    }
    return true;
  }

  // Relax without wind under heavy damping from the current pose, then hold still (reduced motion,
  // a paused still, a composed preview).
  function settle(seconds = settleSeconds) {
    targetA.set(targetB);
    const count = Math.ceil(seconds / fixedStep);
    for (let k = 0; k < count; k++) step(clock[0], true);
    vel.fill(0);
    last.set(pos);
    state.sleeping = true;
    state.settled = true;
    state.calm = 0;
    state.revision++;
  }

  // Place every dynamic particle by `place(i, out)` (a fresh drape), zero velocities.
  function reset(place) {
    for (let i = 0; i < N; i++) {
      if (!kinematic[i]) {
        place(i, windOut);
        pos[3 * i] = windOut[0];
        pos[3 * i + 1] = windOut[1];
        pos[3 * i + 2] = windOut[2];
      } else {
        pos[3 * i] = targetB[3 * i];
        pos[3 * i + 1] = targetB[3 * i + 1];
        pos[3 * i + 2] = targetB[3 * i + 2];
      }
    }
    targetA.set(targetB);
    prev.set(pos);
    last.set(pos);
    vel.fill(0);
    force.fill(0);
    state.sleeping = false;
    state.calm = 0;
    state.revision++;
  }

  // Interpolated positions (alpha in [0, 1] between the last step's start and end) into a Float32Array.
  function writePositions(out, alpha = 1) {
    if (state.sleeping || alpha >= 1) for (let k = 0; k < 3 * N; k++) out[k] = pos[k];
    else for (let k = 0; k < 3 * N; k++) out[k] = last[k] + (pos[k] - last[k]) * alpha;
    return out;
  }

  // Vertex normals and weft (u) tangents of the rendered positions: central differences across each
  // grid (symmetric, so the alternating diagonals leave no ripple in the shading), area-weighted face
  // normals where patterns meet (seams, pegs) and for anything else.
  function writeFrame(position, normal, tangent, uv = model.uv) {
    writeFaceFrame(position, normal, tangent, uv);
    const grids = model.grids || [],
      shared = model.shared;
    for (const g of grids) {
      const { columns: C, rows: R, index } = g;
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          const i = index[r * C + c];
          if (shared && shared[i]) continue;
          const l3 = 3 * index[r * C + (c > 0 ? c - 1 : c)],
            r3 = 3 * index[r * C + (c < C - 1 ? c + 1 : c)],
            u3 = 3 * index[(r > 0 ? r - 1 : r) * C + c],
            d3 = 3 * index[(r < R - 1 ? r + 1 : r) * C + c];
          const ux = position[r3] - position[l3],
            uy = position[r3 + 1] - position[l3 + 1],
            uz = position[r3 + 2] - position[l3 + 2],
            vx = position[d3] - position[u3],
            vy = position[d3 + 1] - position[u3 + 1],
            vz = position[d3 + 2] - position[u3 + 2];
          // du x dv with dv pointing down the pattern: the same sense as the triangles' winding.
          let nx = uy * vz - uz * vy,
            ny = uz * vx - ux * vz,
            nz = ux * vy - uy * vx;
          const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (length < 1e-12) continue;
          nx /= length;
          ny /= length;
          nz /= length;
          const i3 = 3 * i;
          normal[i3] = nx;
          normal[i3 + 1] = ny;
          normal[i3 + 2] = nz;
          if (tangent) {
            const along = ux * nx + uy * ny + uz * nz,
              tx = ux - along * nx,
              ty = uy - along * ny,
              tz = uz - along * nz,
              tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
            tangent[i3] = tx / tl;
            tangent[i3 + 1] = ty / tl;
            tangent[i3 + 2] = tz / tl;
          }
        }
    }
  }

  // Area-weighted vertex normals and weft (u) tangents.
  function writeFaceFrame(position, normal, tangent, uv) {
    normal.fill(0);
    if (tangent) tangent.fill(0);
    for (let t = 0; t < TR; t++) {
      const a = triIndex[3 * t],
        b = triIndex[3 * t + 1],
        c = triIndex[3 * t + 2],
        a3 = 3 * a,
        b3 = 3 * b,
        c3 = 3 * c;
      const ex = position[b3] - position[a3],
        ey = position[b3 + 1] - position[a3 + 1],
        ez = position[b3 + 2] - position[a3 + 2],
        gx = position[c3] - position[a3],
        gy = position[c3 + 1] - position[a3 + 1],
        gz = position[c3 + 2] - position[a3 + 2];
      const nx = ey * gz - ez * gy,
        ny = ez * gx - ex * gz,
        nz = ex * gy - ey * gx;
      normal[a3] += nx;
      normal[a3 + 1] += ny;
      normal[a3 + 2] += nz;
      normal[b3] += nx;
      normal[b3 + 1] += ny;
      normal[b3 + 2] += nz;
      normal[c3] += nx;
      normal[c3 + 1] += ny;
      normal[c3 + 2] += nz;
      if (tangent) {
        // dP/du from the triangle's fabric coordinates.
        const du1 = uv[2 * b] - uv[2 * a],
          dv1 = uv[2 * b + 1] - uv[2 * a + 1],
          du2 = uv[2 * c] - uv[2 * a],
          dv2 = uv[2 * c + 1] - uv[2 * a + 1],
          det = du1 * dv2 - du2 * dv1;
        if (Math.abs(det) > 1e-12) {
          const f = 1 / det,
            tx = (ex * dv2 - gx * dv1) * f,
            ty = (ey * dv2 - gy * dv1) * f,
            tz = (ez * dv2 - gz * dv1) * f;
          tangent[a3] += tx;
          tangent[a3 + 1] += ty;
          tangent[a3 + 2] += tz;
          tangent[b3] += tx;
          tangent[b3 + 1] += ty;
          tangent[b3 + 2] += tz;
          tangent[c3] += tx;
          tangent[c3 + 1] += ty;
          tangent[c3 + 2] += tz;
        }
      }
    }
    for (let i3 = 0; i3 < 3 * N; i3 += 3) {
      const x = normal[i3],
        y = normal[i3 + 1],
        z = normal[i3 + 2],
        l = Math.sqrt(x * x + y * y + z * z);
      if (l > 1e-12) {
        normal[i3] = x / l;
        normal[i3 + 1] = y / l;
        normal[i3 + 2] = z / l;
      } else {
        normal[i3] = 0;
        normal[i3 + 1] = 0;
        normal[i3 + 2] = 1;
      }
      if (tangent) {
        const tx = tangent[i3],
          ty = tangent[i3 + 1],
          tz = tangent[i3 + 2],
          tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
        tangent[i3] = tx / tl;
        tangent[i3 + 1] = ty / tl;
        tangent[i3 + 2] = tz / tl;
      }
    }
  }

  // Largest relative error of the stretch (kind 0) and rope (kind 3) constraints; `where` receives the
  // worst constraint's particles. Compression is a fold, not an error, when `stretchOnly`.
  function strain(where = null, stretchOnly = false) {
    let max = 0;
    for (let k = 0; k < D; k++) {
      if (dKind[k] === 1) continue;
      const a = dIndex[2 * k],
        b = dIndex[2 * k + 1],
        r = dData[4 * k + 2];
      const signed = (Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]) - r) / r,
        e = stretchOnly ? signed : Math.abs(signed);
      if (e > max) {
        max = e;
        if (where) {
          where[0] = a / 3;
          where[1] = b / 3;
        }
      }
    }
    return max;
  }
  function energies() {
    let kinetic = 0,
      potential = 0,
      bend = 0;
    for (let i = 0, i3 = 0; i < N; i++, i3 += 3) {
      kinetic += 0.5 * mass[i] * (vel[i3] ** 2 + vel[i3 + 1] ** 2 + vel[i3 + 2] ** 2);
      potential += mass[i] * gravity * pos[i3 + 1];
    }
    for (let k = 0; k < B; k++) {
      let cx = 0,
        cy = 0,
        cz = 0;
      for (let q = 0; q < 4; q++) {
        const i3 = bIndex[4 * k + q],
          K = bData[9 * k + q];
        cx += K * pos[i3];
        cy += K * pos[i3 + 1];
        cz += K * pos[i3 + 2];
      }
      bend += 0.5 * bData[9 * k + 8] * (cx * cx + cy * cy + cz * cz);
    }
    return { kinetic, potential, bend };
  }

  const api = {
    id,
    model,
    count: N,
    fixedStep,
    substeps,
    positions: pos,
    velocities: vel,
    targets: targetB,
    rest,
    triangles: triIndex,
    triPiece,
    uv: model.uv,
    pieceOf,
    state,
    step,
    settle,
    reset,
    setWind,
    writePositions,
    writeFrame,
    strain,
    energies,
    // The box of the current positions (of `particles`, or all), padded, and the sphere around it:
    // [cx, cy, cz, r, x0, y0, z0, x1, y1, z1] into `out`.
    bounds(out, pad = 0, particles = null) {
      let x0 = Infinity,
        y0 = Infinity,
        z0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity,
        z1 = -Infinity;
      const n = particles ? particles.length : N;
      for (let k = 0; k < n; k++) {
        const i3 = 3 * (particles ? particles[k] : k),
          x = pos[i3],
          y = pos[i3 + 1],
          z = pos[i3 + 2];
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (z < z0) z0 = z;
        if (z > z1) z1 = z;
      }
      out[0] = 0.5 * (x0 + x1);
      out[1] = 0.5 * (y0 + y1);
      out[2] = 0.5 * (z0 + z1);
      out[3] = 0.5 * Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2 + (z1 - z0) ** 2) + pad;
      out[4] = x0 - pad;
      out[5] = y0 - pad;
      out[6] = z0 - pad;
      out[7] = x1 + pad;
      out[8] = y1 + pad;
      out[9] = z1 + pad;
      return out;
    },
    // Move kinematic particle i's target for the end of this step.
    setTarget(i, x, y, z) {
      targetB[3 * i] = x;
      targetB[3 * i + 1] = y;
      targetB[3 * i + 2] = z;
    },
    // Jump kinematic particle i (no interpolation this step).
    placeTarget(i, x, y, z) {
      targetA[3 * i] = targetB[3 * i] = pos[3 * i] = prev[3 * i] = last[3 * i] = x;
      targetA[3 * i + 1] = targetB[3 * i + 1] = pos[3 * i + 1] = prev[3 * i + 1] = last[3 * i + 1] = y;
      targetA[3 * i + 2] = targetB[3 * i + 2] = pos[3 * i + 2] = prev[3 * i + 2] = last[3 * i + 2] = z;
    },
    isKinematic: (i) => kinematic[i] === 1,
    wake() {
      state.sleeping = false;
      state.settled = false;
      state.calm = 0;
    },
    get allocations() {
      return allocations;
    },
    counts: { particles: N, distance: D, bending: B, tethers: T, orders: O, separations: S, triangles: TR, windNodes: L },
    jitter(amount = 0.0006) {
      for (let i = 0, i3 = 0; i < N; i++, i3 += 3)
        if (!kinematic[i]) {
          pos[i3] += amount * (random() - 0.5);
          pos[i3 + 2] += amount * (random() - 0.5);
        }
      prev.set(pos);
      last.set(pos);
    },
  };
  return api;
}

// One XPBD pass with the multiplier starting at zero (small steps): dlambda = -C / (w + alpha~),
// so each endpoint moves by w (1 - rest/|d|) / (w_i + w_j + alpha~) along d.
export function projectDistance(pos, index, data, count) {
  for (let k = 0, k2 = 0, k4 = 0; k < count; k++, k2 += 2, k4 += 4) {
    const i3 = index[k2],
      j3 = index[k2 + 1];
    const dx = pos[j3] - pos[i3],
      dy = pos[j3 + 1] - pos[i3 + 1],
      dz = pos[j3 + 2] - pos[i3 + 2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < 1e-18) continue;
    const s = (1 - data[k4 + 2] / Math.sqrt(d2)) * data[k4 + 3],
      si = data[k4] * s,
      sj = data[k4 + 1] * s;
    pos[i3] += si * dx;
    pos[i3 + 1] += si * dy;
    pos[i3 + 2] += si * dz;
    pos[j3] -= sj * dx;
    pos[j3 + 1] -= sj * dy;
    pos[j3 + 2] -= sj * dz;
  }
}

// Isometric bending as one linear vector constraint per hinge: C = sum_i K_i x_i, and each corner moves
// by a_i C with a_i = -w_i K_i / (sum_j w_j K_j^2 + alpha~).
export function projectBending(pos, index, data, count) {
  for (let k = 0, k4 = 0, k9 = 0; k < count; k++, k4 += 4, k9 += 9) {
    const a = index[k4],
      b = index[k4 + 1],
      c = index[k4 + 2],
      d = index[k4 + 3];
    const Ka = data[k9],
      Kb = data[k9 + 1],
      Kc = data[k9 + 2],
      Kd = data[k9 + 3];
    const cx = Ka * pos[a] + Kb * pos[b] + Kc * pos[c] + Kd * pos[d],
      cy = Ka * pos[a + 1] + Kb * pos[b + 1] + Kc * pos[c + 1] + Kd * pos[d + 1],
      cz = Ka * pos[a + 2] + Kb * pos[b + 2] + Kc * pos[c + 2] + Kd * pos[d + 2];
    const sa = data[k9 + 4],
      sb = data[k9 + 5],
      sc = data[k9 + 6],
      sd = data[k9 + 7];
    pos[a] += sa * cx;
    pos[a + 1] += sa * cy;
    pos[a + 2] += sa * cz;
    pos[b] += sb * cx;
    pos[b + 1] += sb * cy;
    pos[b + 2] += sb * cz;
    pos[c] += sc * cx;
    pos[c + 1] += sc * cy;
    pos[c + 2] += sc * cz;
    pos[d] += sd * cx;
    pos[d + 1] += sd * cy;
    pos[d + 2] += sd * cz;
  }
}

// One-sided long-range attachments: pull back only when beyond reach; the anchor is not moved.
export function projectTethers(pos, index, rest, count) {
  for (let k = 0; k < count; k++) {
    const i3 = index[2 * k],
      t3 = index[2 * k + 1];
    const dx = pos[i3] - pos[t3],
      dy = pos[i3 + 1] - pos[t3 + 1],
      dz = pos[i3 + 2] - pos[t3 + 2];
    const d2 = dx * dx + dy * dy + dz * dz,
      r = rest[k];
    if (d2 <= r * r) continue;
    const s = 1 - r / Math.sqrt(d2);
    pos[i3] -= dx * s;
    pos[i3 + 1] -= dy * s;
    pos[i3 + 2] -= dz * s;
  }
}

// One-sided order along an axis: (x_j - x_i) . a >= gap * scale, split by inverse mass.
export function projectOrders(pos, index, data, count, scale) {
  for (let k = 0, k6 = 0; k < count; k++, k6 += 6) {
    const i3 = index[2 * k],
      j3 = index[2 * k + 1],
      ax = data[k6],
      ay = data[k6 + 1],
      az = data[k6 + 2];
    const gap = data[k6 + 3] * scale,
      along = (pos[j3] - pos[i3]) * ax + (pos[j3 + 1] - pos[i3 + 1]) * ay + (pos[j3 + 2] - pos[i3 + 2]) * az;
    if (along >= gap) continue;
    const c = gap - along,
      si = c * data[k6 + 4],
      sj = c * data[k6 + 5];
    pos[i3] -= si * ax;
    pos[i3 + 1] -= si * ay;
    pos[i3 + 2] -= si * az;
    pos[j3] += sj * ax;
    pos[j3 + 1] += sj * ay;
    pos[j3 + 2] += sj * az;
  }
}

// One-sided separation: |x_j - x_i| >= gap, split by inverse mass.
export function projectSeparations(pos, index, data, count) {
  for (let k = 0, k3 = 0; k < count; k++, k3 += 3) {
    const i3 = index[2 * k],
      j3 = index[2 * k + 1];
    const dx = pos[j3] - pos[i3],
      dy = pos[j3 + 1] - pos[i3 + 1],
      dz = pos[j3 + 2] - pos[i3 + 2],
      d2 = dx * dx + dy * dy + dz * dz,
      gap = data[k3];
    if (d2 >= gap * gap || d2 < 1e-16) continue;
    const d = Math.sqrt(d2),
      c = (gap - d) / d,
      si = c * data[k3 + 1],
      sj = c * data[k3 + 2];
    pos[i3] -= dx * si;
    pos[i3 + 1] -= dy * si;
    pos[i3 + 2] -= dz * si;
    pos[j3] += dx * sj;
    pos[j3 + 1] += dy * sj;
    pos[j3 + 2] += dz * sj;
  }
}
