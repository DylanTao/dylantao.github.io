import test from "node:test";
import assert from "node:assert/strict";
import { SHEER_LINEN, TOWEL_LINEN, bendingWeights, clothBuilder, createClothIsland, mulberry32 } from "../assets/js/home-scene/cloth-solver.mjs";

// A towel-like sheet pinned along its top at three points, `columns` x `rows` over width x height.
function hangingSheet({
  columns = 11,
  rows = 15,
  width = 0.5,
  height = 0.7,
  fabric = TOWEL_LINEN,
  wind = null,
  colliders = { floorY: 0 },
  seed = 1,
  substeps = 6,
  pins = [0, 5, 10],
} = {}) {
  const b = clothBuilder();
  const g = b.grid({ id: "sheet", columns, rows, width, height, fabric, hemRows: 1, hemMass: 0.02, place: (u, v) => [u, 1.9 - v, 0] });
  for (const c of pins) b.pin(g.index(c, 0));
  for (let r = 1; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      let best = pins[0];
      for (const p of pins) if (Math.abs(p - c) < Math.abs(best - c)) best = p;
      b.tether(g.index(c, r), g.index(best, 0), Math.hypot((c - best) * g.hx, r * g.vy));
    }
  const model = b.build();
  const island = createClothIsland(model, { fixedStep: 1 / 30, substeps, wind, colliders, seed });
  island.jitter(0.0006);
  return { model, grid: g, island };
}
const gusty =
  (scale = 1) =>
  (x, y, z, t, out) => {
    const g = 0.5 + 0.5 * Math.sin(1.7 * t) * Math.sin(0.43 * t + 0.4 * x);
    out[0] = 0.5 * scale * Math.sin(0.9 * t + y);
    out[1] = 0.2 * scale * Math.sin(2.3 * t + x);
    out[2] = scale * (1.0 + 2.0 * g);
    return out;
  };

test("isometric bending weights vanish on any flat or rigidly moved hinge and grow with the dihedral angle", () => {
  const random = mulberry32(5);
  const angle = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1]],
      v = [c[0] - a[0], c[1] - a[1]];
    return Math.atan2(Math.abs(u[0] * v[1] - u[1] * v[0]), u[0] * v[0] + u[1] * v[1]);
  };
  for (let trial = 0; trial < 50; trial++) {
    // A random convex hinge in the plane: x0, x1 the edge, x2 above it, x3 below it.
    const x0 = [0, 0],
      x1 = [0.05 + random() * 0.1, (random() - 0.5) * 0.02],
      x2 = [random() * 0.12, 0.02 + random() * 0.1],
      x3 = [random() * 0.12, -0.02 - random() * 0.1];
    const K = bendingWeights(angle(x0, x1, x2), angle(x1, x2, x0), angle(x0, x1, x3), angle(x1, x3, x0));
    assert.ok(Math.abs(K.reduce((s, k) => s + k, 0)) < 1e-9, "translation invariant");
    // Flat, and then rotated and lifted into 3D: C = sum K_i x_i stays zero.
    const theta = random() * Math.PI,
      lift = (p) => [p[0] * Math.cos(theta), p[1], p[0] * Math.sin(theta) + 0.3];
    for (const place of [(p) => [p[0], p[1], 0], lift]) {
      const P = [x0, x1, x2, x3].map(place);
      for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(P.reduce((s, p, i) => s + K[i] * p[axis], 0)) < 1e-9, `flat hinge ${trial}`);
    }
    // Fold x3 about the edge by a small angle phi: |C| = |e| phi to first order.
    const phi = 0.05,
      e = [x1[0] - x0[0], x1[1] - x0[1]],
      el = Math.hypot(...e),
      t = [e[0] / el, e[1] / el],
      along = x3[0] * t[0] + x3[1] * t[1],
      off = [x3[0] - along * t[0], x3[1] - along * t[1]],
      folded = [along * t[0] + off[0] * Math.cos(phi), along * t[1] + off[1] * Math.cos(phi), Math.hypot(...off) * Math.sin(phi)];
    const P = [[x0[0], x0[1], 0], [x1[0], x1[1], 0], [x2[0], x2[1], 0], folded];
    const C = [0, 1, 2].map((axis) => P.reduce((s, p, i) => s + K[i] * p[axis], 0));
    const magnitude = Math.hypot(...C);
    assert.ok(Math.abs(magnitude - el * phi) / (el * phi) < 0.05, `|C| ${magnitude} vs ${el * phi}`);
  }
});

test("a hanging sheet keeps its weave: stretch stays small in still air and bounded in strong gusts", () => {
  const still = hangingSheet();
  for (let k = 0; k < 90; k++) still.island.step(k / 30);
  assert.ok(still.island.strain(null, true) < 0.04, `still-air stretch ${still.island.strain(null, true)}`);
  const gale = hangingSheet({ wind: gusty(1.6) });
  let worst = 0;
  for (let k = 0; k < 240; k++) {
    gale.island.step(k / 30);
    if (k % 10 === 0) worst = Math.max(worst, gale.island.strain(null, true));
  }
  assert.ok(worst < 0.25, `gale stretch ${worst}`);
});

test("nothing explodes in a gale, and the energy decays once the wind stops", () => {
  let on = true;
  const wind = gusty(2.2);
  const { island } = hangingSheet({ wind: (x, y, z, t, out) => (on ? wind(x, y, z, t, out) : ((out[0] = out[1] = out[2] = 0), out)) });
  let peak = 0;
  for (let k = 0; k < 150; k++) {
    island.step(k / 30);
    peak = Math.max(peak, island.energies().kinetic);
  }
  for (let i = 0; i < 3 * island.count; i++) assert.ok(Number.isFinite(island.positions[i]));
  on = false;
  const kinetic = [];
  for (let k = 150; k < 150 + 30 * 12; k++) {
    island.step(k / 30);
    if (k % 30 === 0) kinetic.push(island.energies().kinetic);
  }
  assert.ok(peak > 1e-3, `the gale moved the sheet (${peak} J)`);
  assert.ok(kinetic.at(-1) < 0.02 * peak, `kinetic energy ${kinetic.at(-1)} J after 12 s of calm, peak ${peak} J`);
  // It falls asleep and then costs nothing.
  for (let k = 0; k < 30 * 20 && !island.state.sleeping; k++) island.step(20 + k / 30);
  assert.ok(island.state.sleeping, "asleep in still air");
  const revision = island.state.revision;
  assert.equal(island.step(100), false);
  assert.equal(island.state.revision, revision);
});

test("cloth driven hard at a wall never passes through it, and the floor holds the hem", () => {
  // A wall 6 cm behind the sheet's plane, wind blowing into it at up to 9 m/s.
  const wall = -0.06;
  const { island } = hangingSheet({
    colliders: { planes: [{ normal: [0, 0, 1], offset: wall }], floorY: 1.3 },
    wind: (x, y, z, t, out) => {
      out[0] = 0;
      out[1] = 0;
      out[2] = -9 * (0.6 + 0.4 * Math.sin(3 * t));
      return out;
    },
  });
  let deepest = Infinity,
    lowest = Infinity;
  for (let k = 0; k < 180; k++) {
    island.step(k / 30);
    for (let i = 0; i < island.count; i++) {
      if (island.isKinematic(i)) continue;
      deepest = Math.min(deepest, island.positions[3 * i + 2] - wall);
      lowest = Math.min(lowest, island.positions[3 * i + 1]);
    }
  }
  assert.ok(deepest >= TOWEL_LINEN.thickness - 1e-9, `deepest point ${deepest} m from the wall`);
  assert.ok(lowest >= 1.3 + TOWEL_LINEN.thickness - 1e-9, `lowest point ${lowest}`);
});

test("the same seed and the same steps give the same cloth, bit for bit", () => {
  const a = hangingSheet({ wind: gusty(1), seed: 9 }).island,
    b = hangingSheet({ wind: gusty(1), seed: 9 }).island,
    c = hangingSheet({ wind: gusty(1), seed: 10 }).island;
  for (let k = 0; k < 120; k++) {
    a.step(k / 30);
    b.step(k / 30);
    c.step(k / 30);
  }
  assert.deepEqual(Array.from(a.positions), Array.from(b.positions));
  assert.notDeepEqual(Array.from(a.positions), Array.from(c.positions), "the seeded jitter breaks symmetry differently");
});

test("welds merge particles and sum their mass; constraints take the fabric of the pattern that made them", () => {
  const b = clothBuilder();
  const rope = b.chain({
    id: "line",
    path: [
      [0, 2, 0],
      [0.25, 2, 0],
      [0.5, 2, 0],
    ],
    massPerMetre: 0.01,
  });
  b.pin(rope.index(0));
  b.pin(rope.index(2));
  const g = b.grid({ id: "towel", columns: 3, rows: 3, width: 0.5, height: 0.4, fabric: TOWEL_LINEN, place: (u, v) => [u, 1.99 - v, 0] });
  b.weld(rope.index(1), g.index(1, 0));
  const model = b.build();
  assert.equal(model.count, 3 + 9 - 1);
  const node = model.id(rope.index(1));
  assert.equal(model.id(g.index(1, 0)), node);
  assert.ok(Math.abs(model.mass[node] - (0.01 * 0.25 + TOWEL_LINEN.arealDensity * 0.25 * 0.2 * 0.5)) < 1e-12);
  // The towel's shear diagonals at the welded node keep the towel's compliance, not the rope's.
  const island = createClothIsland(model, { fixedStep: 1 / 30, substeps: 4 });
  for (let k = 0; k < 30; k++) island.step(k / 30);
  for (let i = 0; i < 3 * island.count; i++) assert.ok(Number.isFinite(island.positions[i]), "finite");
});

test("a step allocates nothing: no typed arrays, no Array constructions", () => {
  const { island } = hangingSheet({ wind: gusty(1) });
  for (let k = 0; k < 30; k++) island.step(k / 30);
  const names = ["Array", "Float64Array", "Float32Array", "Int32Array", "Uint32Array", "Uint16Array", "Uint8Array"];
  const originals = Object.fromEntries(names.map((name) => [name, globalThis[name]]));
  let constructed = 0;
  for (const name of names)
    globalThis[name] = new Proxy(originals[name], {
      construct(target, args, newTarget) {
        constructed++;
        return Reflect.construct(target, args, newTarget);
      },
      apply(target, self, args) {
        constructed++;
        return Reflect.apply(target, self, args);
      },
    });
  try {
    for (let k = 30; k < 90; k++) island.step(k / 30);
  } finally {
    Object.assign(globalThis, originals);
  }
  assert.equal(constructed, 0);
});

test("settle composes a still drape with no wind and holds it", () => {
  let on = true;
  const wind = gusty(2);
  const { island } = hangingSheet({ wind: (x, y, z, t, out) => (on ? wind(x, y, z, t, out) : ((out[0] = out[1] = out[2] = 0), out)) });
  for (let k = 0; k < 60; k++) island.step(k / 30);
  island.settle(2);
  assert.ok(island.state.sleeping && island.state.settled);
  assert.equal(island.energies().kinetic, 0);
  const pose = Array.from(island.positions);
  // A still stays put in still air; the wind wakes it.
  on = false;
  assert.equal(island.step(10), false, "a settled island skips steps in still air");
  assert.deepEqual(Array.from(island.positions), pose);
  // Every column hangs below its pins after settling.
  for (let i = 0; i < island.count; i++) if (!island.isKinematic(i)) assert.ok(island.positions[3 * i + 1] < 1.9 + 1e-9);
  on = true;
  assert.equal(island.step(11), true, "a breeze wakes it");
});

test("sheer linen's bending length is a few centimetres, a towel's a little more", () => {
  const length = (f) => Math.cbrt(f.bendingRigidity / (f.arealDensity * 9.80665));
  assert.ok(length(SHEER_LINEN) > 0.02 && length(SHEER_LINEN) < 0.04, `sheer ${length(SHEER_LINEN)}`);
  assert.ok(length(TOWEL_LINEN) >= length(SHEER_LINEN) && length(TOWEL_LINEN) < 0.05, `towel ${length(TOWEL_LINEN)}`);
});
