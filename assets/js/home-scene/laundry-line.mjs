import { WIND_MODES } from "./wind-field.mjs";
import { SHIRT_LINEN, TOWEL_LINEN, clothBuilder, createClothIsland } from "./cloth-solver.mjs";

// Laundry on the terrace (Sirui, 2026-10-18: "also cloth simulation, etc."; the reference was three
// linen towels pegged on a line on a sunny Mediterranean terrace). A cotton line runs between the
// first two festoon posts on the parapet, and on it hang three flat-woven linen towels (indigo with
// natural warp stripes, natural with an ochre band, terracotta) and Sirui's white linen shirt, pegged
// at its shoulders. The line is a chain of particles in the same island as the cloth, and each peg
// welds the cloth to a line node, so the towels' weight pulls the line into a V at every peg, the
// cloth between two pegs scallops, and a gust that lifts the towels shakes the line. Everything is one
// small-step XPBD island (cloth-solver.mjs); the shirt's front and back are welded at the sides and
// shoulders, its rolled sleeves are tubes welded to the armholes, and separation constraints keep its
// layers apart.
//
// The line stands at the parapet's edge, beyond the cave lip, so it takes 42 % of the open coast's wind
// (an authored exposure, against 12 % for the olive tucked under the lip), gusts and veer included, plus
// the room field's eddies advected onshore. Towels are pegged with slack (their pegs 72 % of the fabric
// apart), so each top edge scallops and soft folds run down from the pegs, as in the reference. The
// afternoon sea breeze blows onshore, so the towels lift toward the house and the sea stays behind them
// from inside. The laundry is out while the house is open (the facade doors' own rule: daylight and
// Sirui up) and taken in at dusk.
//
// Pure JavaScript, no three.js, so it runs under `node --test`. Units: metres, seconds, kilograms;
// three.js world axes (+X north, +Y up, +Z east, the sea toward -Z).

// From bin/coastal_facade.py: the terrace front curve, the parapet centre line 16 cm inside it, the
// cap rail at 1.10 m and the glass balustrade on the centre line from 0.46 to 1.08 m, and the festoon
// posts (manifest terrace.festoon.points).
export const TERRACE_EDGE = Object.freeze({ south: -5.35, north: 5.2, back: 4.58, depth: 3.1, power: 2.3, inset: 0.16 });
export const LAUNDRY_POSTS = Object.freeze([Object.freeze([-2.5409, -7.4546]), Object.freeze([0.5395, -7.1348])]);
export const LAUNDRY_LINE = Object.freeze({
  height: 1.94, // m above the terrace paving, where the line is tied to each post
  postRadius: 0.028,
  sag: 0.06, // the line's sag at mid-span under the laundry, m (2 % of the span)
  massPerMetre: 0.012, // kg/m, a cotton line
  exposure: 0.42, // share of the open coast's wind at the parapet edge
  gather: 0.72, // a towel's pegs stand this fraction of the fabric between them apart, so its top scallops
  eddy: 0.34, // eddy amplitude relative to the local breeze
});

// A wooden clothes peg weighs about 8 g.
const PEG_MASS = 0.008;

// The parapet centre line (x, z in three.js) between two x values, from the facade's superellipse.
export function parapetPath(x0 = LAUNDRY_POSTS[0][0] - 0.3, x1 = LAUNDRY_POSTS[1][0] + 0.3, samples = 8) {
  const t = TERRACE_EDGE,
    a = t.north - t.south,
    curve = (theta) => [t.south + a * Math.sin(theta) ** (2 / t.power), t.back + t.depth * Math.cos(theta) ** (2 / t.power)];
  // theta for a given x: invert the x(theta) monotone map by bisection.
  const thetaAt = (x) => {
    let lo = 0,
      hi = Math.PI / 2;
    for (let k = 0; k < 50; k++) {
      const mid = 0.5 * (lo + hi);
      if (curve(mid)[0] < x) lo = mid;
      else hi = mid;
    }
    return 0.5 * (lo + hi);
  };
  const path = [];
  for (let k = 0; k <= samples; k++) {
    const theta = thetaAt(x0 + ((x1 - x0) * k) / samples),
      p = curve(theta),
      q = curve(Math.min(Math.PI / 2, theta + 1e-4)),
      tx = q[0] - p[0],
      ty = q[1] - p[1],
      length = Math.hypot(tx, ty) || 1;
    // Inward (toward the house) normal of a curve running south to north, then to three.js z = -y.
    const x = p[0] + (ty / length) * t.inset,
      y = p[1] + (-tx / length) * t.inset;
    path.push([x, -y]);
  }
  return path;
}

// What hangs on the line, from the south post northward: offsets along the line (m) of each item's
// left edge, sizes, pegs and colours. Towels are flat-woven linen; the shirt is shirting linen.
export const LAUNDRY_ITEMS = Object.freeze([
  Object.freeze({
    id: "towel-indigo",
    kind: "towel",
    at: 0.2,
    width: 0.56,
    height: 0.82,
    pegs: 2,
    columns: 13,
    rows: 17,
    color: 0x2e4a6e,
    stripe: { axis: "u", period: 0.14, width: 0.018, offset: 0.05, color: 0xe6dfcf, strength: 0.9 },
  }),
  // A white linen shirt with its sleeves rolled to the elbow; a darker button placket down the front.
  Object.freeze({
    id: "shirt",
    kind: "shirt",
    at: 0.95,
    width: 0.54,
    height: 0.74,
    shoulder: 0.42,
    color: 0xf3f0e8,
    stripe: { axis: "u", period: 50, width: 0.032, offset: 0.254, color: 0xdcd6ca, strength: 1 },
  }),
  Object.freeze({
    id: "towel-natural",
    kind: "towel",
    at: 1.72,
    width: 0.5,
    height: 0.72,
    pegs: 3,
    columns: 11,
    rows: 15,
    color: 0xe2d7c1,
    stripe: { axis: "v", period: 0.72, width: 0.05, offset: 0.06, color: 0xc28a37, strength: 1 },
  }),
  Object.freeze({
    id: "towel-terracotta",
    kind: "towel",
    at: 2.37,
    width: 0.44,
    height: 0.62,
    pegs: 2,
    columns: 9,
    rows: 13,
    color: 0xb35f3f,
    stripe: null,
  }),
]);

// The terrace wind for the laundry: the coast's open wind at `exposure`, plus the room field's six
// divergence-free modes at 4.5 times their wavenumber (wavelengths 0.27-1.6 m, the size of a towel's
// ripples), advected onshore (Taylor's frozen turbulence) at `eddy` of the local speed.
// `sampleBatch` fills `out` for `points` at clock[0] without allocating.
export function createTerraceDraft({
  coast,
  exposure = LAUNDRY_LINE.exposure,
  eddy = LAUNDRY_LINE.eddy,
  eddyScale = 4.5,
  advection = [-0.45, 0, 0.9],
} = {}) {
  const modes = new Float64Array(WIND_MODES.length * 7);
  WIND_MODES.forEach((m, i) => {
    const speed = Math.hypot(...m.velocity) || 1;
    modes.set(
      [
        m.k[0] * eddyScale,
        m.k[1] * eddyScale,
        m.k[2] * eddyScale,
        (m.velocity[0] / speed) * m.weight,
        (m.velocity[1] / speed) * m.weight,
        (m.velocity[2] / speed) * m.weight,
        m.phase,
      ],
      i * 7
    );
  });
  const out3 = [0, 0, 0],
    one = { points: new Float64Array(3), out: new Float64Array(3), clock: new Float64Array(1) };
  function sampleBatch(points, count, clock, out) {
    const t = clock[0];
    for (let i3 = 0; i3 < 3 * count; i3 += 3) {
      const x = points[i3],
        y = points[i3 + 1],
        z = points[i3 + 2];
      coast.sample(x, y, z, t, out3);
      const vx = exposure * out3[0],
        vz = exposure * out3[2],
        speed = Math.hypot(vx, vz),
        // Eddies frozen into the breeze, carried onshore at a steady 1 m/s (a steady speed keeps their
        // phase continuous while the breeze itself gusts).
        ax = x - advection[0] * t,
        az = z - advection[2] * t,
        e = eddy * speed;
      let ex = 0,
        ey = 0,
        ez = 0;
      for (let m7 = 0; m7 < modes.length; m7 += 7) {
        const s = e * Math.sin(ax * modes[m7] + y * modes[m7 + 1] + az * modes[m7 + 2] + modes[m7 + 6]);
        ex += modes[m7 + 3] * s;
        ey += modes[m7 + 4] * s;
        ez += modes[m7 + 5] * s;
      }
      out[i3] = vx + ex;
      out[i3 + 1] = ey;
      out[i3 + 2] = vz + ez;
    }
    return out;
  }
  function sample(x, y, z, t, out = [0, 0, 0]) {
    one.points[0] = x;
    one.points[1] = y;
    one.points[2] = z;
    one.clock[0] = t;
    sampleBatch(one.points, 1, one.clock, one.out);
    out[0] = one.out[0];
    out[1] = one.out[1];
    out[2] = one.out[2];
    return out;
  }
  sample.sampleBatch = sampleBatch;
  return { sample, sampleBatch, exposure, eddy };
}

// The laundry is out while the house is open: the facade doors' own rule (controller.mjs syncFacadeDoors).
export function laundryOut({ routine = null, daylight = null } = {}) {
  return Boolean(routine && daylight && daylight.daylight > 0.3 && routine.id !== "sleep");
}

// Builds the line, the pegs and the cloth as one island. Returns the island, the render pieces and the
// pegs' particle indices. `wind` is the terrace draft (or any sampler).
export function createLaundryLine({
  wind = null,
  items = LAUNDRY_ITEMS,
  line = LAUNDRY_LINE,
  posts = LAUNDRY_POSTS,
  fixedStep = 1 / 30,
  substeps = 6,
  seed = 3,
  floorY = 0,
  rail = null,
  postBaseY = 0.4,
  postTopY = 2.5,
} = {}) {
  const [p0, p1] = posts,
    dx = p1[0] - p0[0],
    dz = p1[1] - p0[1],
    span = Math.hypot(dx, dz),
    ux = dx / span,
    uz = dz / span,
    // The line's inward normal (toward the house) in the horizontal plane.
    nx = -uz,
    nz = ux;
  const orient = nz > 0 ? 1 : -1;
  const inward = [orient * nx, orient * nz];
  // Each post's line knot sits on the post's inward face.
  const knot = (p) => [p[0] + inward[0] * line.postRadius, p[1] + inward[1] * line.postRadius];
  const a = knot(p0),
    b = knot(p1),
    length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    along = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const at = (s, drop = 0) => [a[0] + along[0] * s, line.height - drop, a[1] + along[1] * s];
  const sagAt = (s) => 4 * line.sag * (s / length) * (1 - s / length);

  // Line nodes: every peg position, and enough between them that no segment exceeds 12 cm.
  const pegStations = [];
  for (const item of items)
    for (const c of pegColumnsOf(item)) pegStations.push({ s: item.at + c * columnPitch(item) * gatherOf(item), item: item.id });
  const stations = [0, length, ...pegStations.map((p) => p.s)].sort((x, y) => x - y);
  const nodes = [];
  for (let k = 0; k < stations.length - 1; k++) {
    const s0 = stations[k],
      s1 = stations[k + 1],
      n = Math.max(1, Math.ceil((s1 - s0) / 0.12));
    for (let j = 0; j < n; j++) nodes.push(s0 + ((s1 - s0) * j) / n);
  }
  nodes.push(length);
  const b0 = clothBuilder();
  const rope = b0.chain({
    id: "line",
    path: nodes.map((s) => at(s, sagAt(s))),
    massPerMetre: line.massPerMetre,
    // The rest length is the arc of the loaded line, so the laundry's weight (about 4 N) holds it at
    // its sag; a cotton line barely stretches.
    slack: 0,
    compliance: 2e-5,
  });
  b0.pin(rope.index(0));
  b0.pin(rope.index(nodes.length - 1));
  // Long-range attachments along the line to both posts, at the arc length to each, so the laundry's
  // weight cannot stretch it beyond its own length in a handful of passes.
  {
    const arc = [0];
    for (let k = 1; k < nodes.length; k++) {
      const p = at(nodes[k], sagAt(nodes[k])),
        q = at(nodes[k - 1], sagAt(nodes[k - 1]));
      arc.push(arc[k - 1] + Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
    }
    const total = arc[arc.length - 1];
    for (let k = 1; k < nodes.length - 1; k++) {
      b0.tether(rope.index(k), rope.index(0), arc[k]);
      b0.tether(rope.index(k), rope.index(nodes.length - 1), total - arc[k]);
    }
  }
  const nodeAt = (s) => {
    let best = 0;
    for (let k = 1; k < nodes.length; k++) if (Math.abs(nodes[k] - s) < Math.abs(nodes[best] - s)) best = k;
    return rope.index(best);
  };

  // Render groups: each item's grid pieces (the line is drawn from its nodes).
  const pieces = [];
  const pegs = [];
  for (const item of items) {
    if (item.kind === "towel") buildTowel(b0, item);
    else if (item.kind === "shirt") buildShirt(b0, item);
  }

  function buildTowel(builder, item) {
    const s0 = item.at,
      top = line.height - sagAt(s0 + item.width / 2) - 0.012;
    const fabric = { ...TOWEL_LINEN };
    const g = builder.grid({
      id: item.id,
      columns: item.columns,
      rows: item.rows,
      width: item.width,
      height: item.height,
      fabric,
      hemRows: 1,
      hemMass: 0.01,
      windStride: 2,
      bendScale: (r) => (r === 0 || r === item.rows - 1 ? 2.5 : 1),
      // The top edge gathered toward its pegs, bowing a little off the line between them so the slack
      // folds out of plane; the rest hangs at the fabric's own width.
      place: (u, v, c, r) => {
        const k = gatherOf(item),
          bow = r === 0 ? 0.012 * Math.sin((Math.PI * u) / (item.width / Math.max(1, item.pegs - 1))) : 0,
          p = at(s0 + (r === 0 ? u * k : u * k + (u - item.width / 2) * (1 - k) * Math.min(1, v / item.height)));
        return [p[0] + inward[0] * bow, top - v, p[2] + inward[1] * bow];
      },
    });
    const pegColumns = pegColumnsOf(item);
    for (const c of pegColumns) {
      const node = nodeAt(s0 + c * g.hx * gatherOf(item));
      builder.weld(node, g.index(c, 0));
      builder.addMass(node, PEG_MASS);
      pegs.push({ node, item: item.id });
    }
    // Long-range attachments to the nearest peg.
    for (let r = 1; r < item.rows; r++)
      for (let c = 0; c < item.columns; c++) {
        let best = pegColumns[0];
        for (const p of pegColumns) if (Math.abs(p - c) < Math.abs(best - c)) best = p;
        builder.tether(g.index(c, r), g.index(best, 0), Math.hypot((c - best) * g.hx, r * g.vy));
      }
    pieces.push({ id: item.id, kind: "towel", item, pieces: [g.piece] });
  }

  // A shirt pegged at its shoulders: front and back rectangles welded at the shoulders (outside the
  // neck) and at the sides below the armholes, with a rolled sleeve on each side, a tube of two halves
  // welded along its top and underarm and to the armhole. The front hangs toward the house.
  function buildShirt(builder, item) {
    const C = SHIRT_COLUMNS,
      R = 14,
      W = item.width,
      H = item.height,
      hx = W / (C - 1),
      vy = H / (R - 1),
      armRows = 4,
      sleeveRows = 7,
      sleeveLength = 0.4,
      s0 = item.at,
      top = line.height - sagAt(s0 + W / 2) - 0.012,
      gap = 0.012;
    const fabric = { ...SHIRT_LINEN };
    const shirtPieces = [];
    const place = (side) => (u, v) => {
      const p = at(s0 + u);
      return [p[0] + inward[0] * side * gap, top - v, p[2] + inward[1] * side * gap];
    };
    // The collar and yoke (top two rows) are interfaced, stiffer in bending; the back and sleeves sit
    // elsewhere in fabric coordinates, so the front's placket stripe stays on the front.
    const yoke = (r) => (r <= 1 ? 5 : 1);
    const front = builder.grid({
      id: `${item.id}-front`,
      columns: C,
      rows: R,
      width: W,
      height: H,
      fabric,
      hemRows: 1,
      hemMass: 0.004,
      bendScale: yoke,
      place: place(1),
    });
    const back = builder.grid({
      id: `${item.id}-back`,
      columns: C,
      rows: R,
      width: W,
      height: H,
      fabric,
      hemRows: 1,
      hemMass: 0.004,
      bendScale: yoke,
      place: place(-1),
      uvOffset: [2, 0],
    });
    // Shoulders: the top rows meet outside the neck opening (the middle three columns).
    for (let c = 0; c < C; c++) if (c < 4 || c > C - 5) builder.weld(front.index(c, 0), back.index(c, 0));
    // Side seams below the armholes.
    for (let r = armRows - 1; r < R; r++) {
      builder.weld(front.index(0, r), back.index(0, r));
      builder.weld(front.index(C - 1, r), back.index(C - 1, r));
    }
    // Sleeves: columns along the armhole (armRows), rows along the sleeve, hanging down the side.
    for (const [edge, side] of [
      [0, -1],
      [C - 1, 1],
    ]) {
      const halves = [1, -1].map((layer) =>
        builder.grid({
          id: `${item.id}-sleeve-${side < 0 ? "left" : "right"}-${layer > 0 ? "front" : "back"}`,
          columns: armRows,
          rows: sleeveRows,
          width: (armRows - 1) * vy,
          height: sleeveLength,
          fabric,
          hemRows: 1,
          hemMass: 0.006,
          uvOffset: [4 + (side > 0 ? 1 : 0) + (layer > 0 ? 0 : 0.5), 0],
          // Down the body's side from the armhole, a little outside it.
          place: (u, v) => {
            const p = at(s0 + edge * hx + side * (0.02 + 0.25 * v));
            return [p[0] + inward[0] * layer * gap, top - u - 0.6 * v, p[2] + inward[1] * layer * gap];
          },
        })
      );
      const [sf, sb] = halves,
        body = [front, back];
      for (let i = 0; i < armRows; i++) {
        builder.weld(body[0].index(edge, i), sf.index(i, 0));
        builder.weld(body[1].index(edge, i), sb.index(i, 0));
      }
      for (let j = 0; j < sleeveRows; j++) {
        builder.weld(sf.index(0, j), sb.index(0, j));
        builder.weld(sf.index(armRows - 1, j), sb.index(armRows - 1, j));
      }
      for (let j = 1; j < sleeveRows; j++) for (let i = 1; i < armRows - 1; i++) builder.separate(sf.index(i, j), sb.index(i, j), 0.02);
      shirtPieces.push(sf.piece, sb.piece);
    }
    // The layers keep apart (a stand-in for self-collision).
    for (let r = 1; r < R; r++) for (let c = 1; c < C - 1; c++) builder.separate(front.index(c, r), back.index(c, r), 0.016);
    // Pegs at the shoulder points grip both layers.
    const pegColumns = pegColumnsOf(item);
    for (const c of pegColumns) {
      const node = nodeAt(s0 + c * hx);
      builder.weld(node, front.index(c, 0));
      builder.addMass(node, PEG_MASS);
      pegs.push({ node, item: item.id });
    }
    // The unpegged shoulder/collar row also needs a reach to its nearest peg.
    // Without it, the stiff yoke can pull the edge beside a peg beyond its
    // pattern length even though the hanging body has long-range attachments.
    for (const grid of [front, back])
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          const best = Math.abs(c - pegColumns[0]) < Math.abs(c - pegColumns[1]) ? pegColumns[0] : pegColumns[1];
          builder.tether(grid.index(c, r), grid.index(best, 0), Math.hypot((c - best) * hx, r * vy));
        }
    pieces.push({ id: item.id, kind: "shirt", item, pieces: [front.piece, back.piece, ...shirtPieces] });
  }

  const model = b0.build();
  // Contacts: the posts, the cap rail and the glass below it (capsules along the parapet's curve), the
  // paving.
  const railPoints = rail ?? parapetPath(),
    capsules = [];
  for (const p of posts) capsules.push({ a: [p[0], postBaseY, p[1]], b: [p[0], postTopY, p[1]], radius: line.postRadius });
  for (let k = 0; k < railPoints.length - 1; k++) {
    capsules.push({ a: [railPoints[k][0], 1.1, railPoints[k][1]], b: [railPoints[k + 1][0], 1.1, railPoints[k + 1][1]], radius: 0.021 });
    capsules.push({ a: [railPoints[k][0], 0.8, railPoints[k][1]], b: [railPoints[k + 1][0], 0.8, railPoints[k + 1][1]], radius: 0.012 });
  }
  const island = createClothIsland(model, {
    id: "laundry",
    fixedStep,
    substeps,
    wind,
    seed,
    colliders: { capsules, floorY },
    sleepWind: 0.18,
    friction: 0.5,
  });
  island.jitter(0.0005);
  // Map the builder's pegs to island particles.
  const pegParticles = pegs.map((p) => ({ ...p, particle: model.id(p.node) }));
  return {
    island,
    model,
    pieces,
    pegs: pegParticles,
    line: {
      nodes: nodes.length,
      particles: Array.from({ length: nodes.length }, (_, k) => model.id(rope.index(k))),
      length,
      along,
      inward,
      start: a,
      end: b,
    },
    items,
  };
}

// The shirt's body is 11 columns across; its pegs grip the shoulder points.
const SHIRT_COLUMNS = 11;
const columnPitch = (item) => item.width / ((item.kind === "shirt" ? SHIRT_COLUMNS : item.columns) - 1);
const gatherOf = (item) => (item.kind === "towel" ? (item.gather ?? LAUNDRY_LINE.gather) : 1);
function pegColumnsOf(item) {
  if (item.kind === "shirt") {
    const hx = columnPitch(item);
    return [Math.round((item.width - item.shoulder) / 2 / hx), Math.round((item.width + item.shoulder) / 2 / hx)];
  }
  return evenly(0, item.columns - 1, item.pegs).map(Math.round);
}

function evenly(a, b, n) {
  if (n <= 1) return [(a + b) / 2];
  return Array.from({ length: n }, (_, k) => a + ((b - a) * k) / (n - 1));
}
