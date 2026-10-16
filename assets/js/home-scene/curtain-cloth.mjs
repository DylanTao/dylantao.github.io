import { DEFAULT_WIND, WIND_MODES, sampleWind } from "./wind-field.mjs";

// Curtains for the glass front (Sirui, 2026-10-15): sheer panels on rails inside the doors, blown by
// the same breeze as the plants, harder where a sliding door stands open, barely where the glass is
// shut. Pure JavaScript, no three.js, so the solver runs under `node --test`.
//
// Each panel is a particle grid (columns across the fabric, rows down it) solved with extended
// position-based dynamics in small steps: one constraint pass per substep, compliance alpha/h^2,
// multipliers reset every substep (Macklin, Mueller & Chentanez 2016; Macklin et al. 2019).
// Structural and shear distance constraints keep the weave, skip-one distance constraints give it
// a soft bend (Provot 1995 springs, here compliant), and each particle is tethered to the top of its
// own column by a one-sided long-range attachment, so a 3 m drop does not sag with only five passes
// per frame (Kim, Chentanez & Mueller 2012). Constraints run in colour batches (no two in a batch
// share a particle), which lets the processor overlap them: the same pass costs a third as much.
//
// The heading row is kinematic, like a ripple-fold tape. Every fourth heading column is a carrier ring
// on the rail; the columns between two rings sit at equal arc length along a half-sine wave fold whose
// length is the fabric between them, alternating room side and glass side. Opening a panel slides the
// lead ring toward the stack end and spaces the rings evenly, so the folds deepen into narrow loops
// and the panel gathers into a stack; closing spreads them again. Rest lengths across the cloth follow
// the heading's fold, and the bends keep a little memory of the closed pleat, so a gathered stack
// flares slightly at the hem, as real stacks do.
//
// Air acts per triangle from the velocity of the air relative to the cloth: a flat-plate normal force
// 0.5 rho C_N A |u| (u.n) n, which carries both drag and lift, plus a little skin friction along the
// sheet. The force is divided by 1 + k dt, with k the drag's own damping rate (semi-implicit), so a
// strong gust cannot fling the cloth past the air's speed. Wind is sampled on a coarse lattice of
// particles per panel and interpolated, so the injected sampler runs thirty times per panel per step.
//
// Units: metres, seconds, kilograms; three.js world axes (+Y up). Fixed 60 Hz steps with an
// accumulator, deterministic for a given seed and sequence of update() deltas. After construction a
// step allocates nothing: hot loops take typed arrays, per-frame scalars live in typed slots, and the
// facade wind offers a batched typed-array path. See PHYSICS.md ("Curtain cloth").

const GRAVITY = 9.80665;
const AIR_DENSITY = 1.2; // kg/m^3, sea-level air at about 20 C
const TAU = Math.PI * 2;

// A light polyester voile. Compliances are XPBD alpha (m/N) for this grid's spacing (about 8 by 12 cm);
// they are authored for the drape and are not measured fabric moduli.
export const SHEER_VOILE = Object.freeze({
  name: "sheer voile",
  arealDensity: 0.075, // kg/m^2 (voiles weigh roughly 60-90 g/m^2)
  hemMass: 0.03, // kg per metre of hem: a weighted hem cord keeps the panel hanging plumb
  pressureCoefficient: 0.9, // normal-force coefficient; a solid plate is about 1.2, the open weave leaks air
  frictionCoefficient: 0.02, // skin friction along the sheet
  stretchCompliance: 0,
  shearCompliance: 0.02,
  bendCompliance: 1.2,
  pleatMemory: 0.2, // 0: bends follow the heading's fold, 1: they remember the closed pleat
  damping: 0.25, // 1/s, internal (inter-yarn) damping in addition to the air's own drag
  thickness: 0.012, // m, collision clearance
});

// A heavier lined drape, for a blackout panel if the integrator wants one.
export const LINED_DRAPE = Object.freeze({
  ...SHEER_VOILE,
  name: "lined drape",
  arealDensity: 0.32,
  hemMass: 0.06,
  pressureCoefficient: 1.15,
  bendCompliance: 0.25,
  thickness: 0.016,
});

// The glass front in three.js world coordinates, from bin/coastal_facade.py (Blender (x, y, z) maps to
// three.js (x, z, -y): +X north, +Y up, +Z east, the sea toward -Z) and the authored GLB bounds.
export const CURTAIN_FACADE = Object.freeze({
  glassZ: -4.48, // FACADE_Y
  doorTrackZ: -4.44, // INNER_TRACK: the sliding doors run inside the fixed panes
  doorFaceZ: -4.41, // room face of the door stiles and the mullions
  hardwareZ: -4.351, // tip of the door pulls, the deepest thing on the room side of the glass
  doorHead: 3.19, // underside of the bronze door head beam (DOOR_HEAD)
  floorY: 0,
  doors: Object.freeze([
    Object.freeze({ id: "kitchen", opening: Object.freeze([-3.4, -0.85]), slideX: -2.55, rate: 1 }),
    Object.freeze({ id: "lounge", opening: Object.freeze([2.0, 4.0]), slideX: 2.0, rate: 1.27 }),
  ]),
});

// Proposed tracks, measured against the authored models (room-kitchen.glb, room-lounge.glb,
// home-shell.glb, decoded 2026-10-15): the kitchen's breakfast counter runs against the glass from
// x -4.25 to -2.75 (top at 0.74-0.83 m, reaching z -4.37), and the lounge's potted olive and daybed
// stand inside the glass from x 3.5 northward (leaves at z -4.21). The clear stretch of floor along the
// front runs from the counter's end to the olive, so each door gets a centre-opening pair there.
// Rails stand 25 cm in front of the door head's room face (z -4.40) on return brackets, far enough that a
// gathered stack's glass-side folds clear the door pulls; the ring line sits 7 cm under the head and the
// hem clears the floor by 1.5 cm. Each pair stacks one panel over its open doorway and one over fixed glass, which is what
// makes the two sides of a door blow differently.
const RAIL_Y = 3.12;
const RAIL_Z = -4.15;
const HEM_CLEARANCE = 0.015;
export const CURTAIN_TRACKS = Object.freeze([
  Object.freeze({
    id: "kitchen",
    door: "kitchen",
    rail: Object.freeze({ y: RAIL_Y, z: RAIL_Z, from: -2.7, to: -0.5 }),
    brackets: Object.freeze([-2.66, -1.6, -0.54]),
    panels: Object.freeze([
      // Stacks beside the counter's end, inside the open doorway: the windward panel.
      Object.freeze({ id: "kitchen-south", stackX: -2.7, closeToward: 1, keepOut: Object.freeze({ min: -2.735 }) }),
      // Stacks over the mullion at -0.85 and the gym bay's fixed glass: the sheltered panel.
      Object.freeze({ id: "kitchen-north", stackX: -0.5, closeToward: -1 }),
    ]),
  }),
  Object.freeze({
    id: "lounge",
    door: "lounge",
    rail: Object.freeze({ y: RAIL_Y, z: RAIL_Z, from: 1.65, to: 3.45 }),
    brackets: Object.freeze([1.69, 2.55, 3.41]),
    panels: Object.freeze([
      // Stacks over the gym bay's glass south of the mullion at 2.0: sheltered.
      Object.freeze({ id: "lounge-south", stackX: 1.65, closeToward: 1 }),
      // Stacks inside the open doorway beside the potted olive: windward.
      Object.freeze({ id: "lounge-north", stackX: 3.45, closeToward: -1, keepOut: Object.freeze({ max: 3.47 }) }),
    ]),
  }),
]);
// The bedroom alcove was considered and left out: the bed fills the alcove up to the cedar screen and
// the stair wall, so there is no clear line to hang a panel (room-sleep.glb, home-shell.glb).

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

// A wave fold between two rings is a half sine y = A sin(pi x / s) over the ring pitch s whose arc
// length equals the fabric between the rings, L. With m = A pi / s the arc length is
// (s / pi) * integral_0^pi sqrt(1 + m^2 cos^2 u) du, so L / s depends on m alone; this table inverts it.
const FOLD_TABLE_SIZE = 2048,
  FOLD_M_MAX = 48,
  FOLD_SAMPLES = 48;
const foldRatio = new Float64Array(FOLD_TABLE_SIZE);
for (let i = 0; i < FOLD_TABLE_SIZE; i++) {
  const m = (FOLD_M_MAX * i) / (FOLD_TABLE_SIZE - 1);
  let sum = 0;
  // Simpson's rule on 64 intervals.
  for (let k = 0; k <= 64; k++) {
    const u = (Math.PI * k) / 64,
      w = k === 0 || k === 64 ? 1 : k % 2 ? 4 : 2;
    sum += w * Math.sqrt(1 + m * m * Math.cos(u) ** 2);
  }
  foldRatio[i] = ((Math.PI / 64 / 3) * sum) / Math.PI;
}
function foldAmplitude(ratio) {
  if (!(ratio > 1)) return 0;
  if (ratio >= foldRatio[FOLD_TABLE_SIZE - 1]) return FOLD_M_MAX;
  let lo = 0,
    hi = FOLD_TABLE_SIZE - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (foldRatio[mid] < ratio) lo = mid;
    else hi = mid;
  }
  const t = (ratio - foldRatio[lo]) / (foldRatio[hi] - foldRatio[lo]);
  return (FOLD_M_MAX * (lo + t)) / (FOLD_TABLE_SIZE - 1);
}
const foldArc = new Float64Array(FOLD_SAMPLES + 1);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generic panel specs for createCurtainCloth from the proposed tracks.
export function facadeCurtainPanels({
  tracks = CURTAIN_TRACKS,
  fabric = SHEER_VOILE,
  columns = 29,
  rows = 25,
  pleat = 4,
  fullness = 1.8,
  overlap = 0.02,
  openFraction = 0,
  facade = CURTAIN_FACADE,
} = {}) {
  const panels = [];
  for (const track of tracks) {
    const span = Math.abs(track.rail.to - track.rail.from);
    for (const panel of track.panels) {
      // Room side of the door hardware, the deepest part of the glass front.
      const planes = [{ normal: [0, 0, 1], offset: facade.hardwareZ + 0.02 }];
      if (panel.keepOut?.min !== undefined) planes.push({ normal: [1, 0, 0], offset: panel.keepOut.min });
      if (panel.keepOut?.max !== undefined) planes.push({ normal: [-1, 0, 0], offset: -panel.keepOut.max });
      panels.push({
        id: panel.id,
        track: track.id,
        door: track.door,
        origin: [panel.stackX, track.rail.y, track.rail.z],
        axis: [panel.closeToward, 0, 0],
        room: [0, 0, 1],
        closedWidth: span / 2 + overlap,
        drop: track.rail.y - facade.floorY - HEM_CLEARANCE,
        fullness,
        columns,
        rows,
        pleat,
        openFraction,
        floorY: facade.floorY,
        planes,
        fabric,
      });
    }
  }
  return panels;
}

// Wind for the curtains by the glass front: the shared six-mode room field (wind-field.mjs) leaks in
// weakly everywhere; an open doorway adds a jet driven by the outdoor field's onshore component
// through a soft clamp, with its own faster flutter so each door has its own rate; and closed glass
// carries a thin convective boundary layer (rising along sun-warmed glass, falling along cold glass).
// The jet profile is an authored engineering sketch, not a ventilation or CFD model.
//
// `sample(x, y, z, t, out)` is the plain interface. `sampleBatch(points, count, clock, out)` fills
// `out` (3 x count, m/s) for `points` (3 x count, m) at time clock[0] without allocating; the cloth
// uses it automatically because `sample.sampleBatch` points to it.
export function createFacadeDraft({
  field = sampleWind,
  fieldOptions = DEFAULT_WIND,
  doors = CURTAIN_FACADE.doors,
  glassZ = CURTAIN_FACADE.doorFaceZ,
  roomLeak = 0.25,
  onshore = 0.6,
  doorGain = 2.4,
  turbulence = 0.32,
  softness = 0.25,
  reach = 1.8,
  glassDraft = 0.05,
  seed = 11,
} = {}) {
  const random = mulberry32(seed);
  const D = doors.length,
    ids = doors.map((door) => door.id);
  // Per door: x0, x1, slideX, rate, offset, open a, open b, jet speed, lateral drift, five phases.
  const STRIDE = 14,
    door = new Float64Array(D * STRIDE);
  doors.forEach((d, i) => {
    const o = i * STRIDE;
    door[o] = d.opening[0];
    door[o + 1] = d.opening[1];
    door[o + 2] = d.slideX;
    door[o + 3] = d.rate ?? 1;
    for (let k = 0; k < 5; k++) door[o + 9 + k] = random() * TAU;
  });
  // The shared field, evaluated inline exactly as sampleWind does (same operations, same order).
  const inline = field === sampleWind,
    mean = Float64Array.from(fieldOptions.mean ?? DEFAULT_WIND.mean),
    gust = fieldOptions.gust ?? DEFAULT_WIND.gust,
    windRate = fieldOptions.rate ?? 1,
    modes = new Float64Array(WIND_MODES.length * 8);
  WIND_MODES.forEach((m, i) => modes.set([...m.k, ...m.velocity, m.phase, m.rate], i * 8));
  const doorPoints = new Float64Array(3 * D),
    doorField = new Float64Array(3 * D),
    // [time of the cached jets, glass draft speed]
    cache = Float64Array.of(NaN, glassDraft),
    one = { points: new Float64Array(3), out: new Float64Array(3), clock: new Float64Array(1) },
    fieldPoint = [0, 0, 0],
    fieldOut = [0, 0, 0];

  function evaluateField(points, count, out, clock) {
    const t = clock[0];
    if (!inline) {
      for (let i3 = 0; i3 < 3 * count; i3 += 3) {
        fieldPoint[0] = points[i3];
        fieldPoint[1] = points[i3 + 1];
        fieldPoint[2] = points[i3 + 2];
        const v = field(fieldPoint, t, fieldOut, fieldOptions) || fieldOut;
        out[i3] = v[0];
        out[i3 + 1] = v[1];
        out[i3 + 2] = v[2];
      }
      return;
    }
    for (let i3 = 0; i3 < 3 * count; i3 += 3) {
      const x = points[i3],
        y = points[i3 + 1],
        z = points[i3 + 2];
      let vx = mean[0],
        vy = mean[1],
        vz = mean[2];
      for (let m8 = 0; m8 < modes.length; m8 += 8) {
        const phase = (((modes[m8 + 6] + modes[m8 + 7] * t * windRate) % TAU) + TAU) % TAU;
        const s = gust * Math.sin(x * modes[m8] + y * modes[m8 + 1] + z * modes[m8 + 2] + phase);
        vx += modes[m8 + 3] * s;
        vy += modes[m8 + 4] * s;
        vz += modes[m8 + 5] * s;
      }
      out[i3] = vx;
      out[i3 + 1] = vy;
      out[i3 + 2] = vz;
    }
  }

  function updateJets(clock) {
    cache[0] = clock[0];
    for (let i = 0, o = 0; i < D; i++, o += STRIDE) {
      doorPoints[3 * i] = 0.5 * (door[o + 5] + door[o + 6]);
      doorPoints[3 * i + 1] = 1.4;
      doorPoints[3 * i + 2] = glassZ - 0.8;
    }
    evaluateField(doorPoints, D, doorField, clock);
    const t = clock[0];
    for (let i = 0, o = 0; i < D; i++, o += STRIDE) {
      if (door[o + 6] - door[o + 5] < 0.02) {
        door[o + 7] = 0;
        door[o + 8] = 0;
        continue;
      }
      // Soft clamp: a lull lets the panel fall back; the jet does not reverse into suction.
      const inflow = onshore + doorField[3 * i + 2],
        soft = inflow > 2 ? inflow : 0.12 * Math.log1p(Math.exp(inflow / 0.12));
      const r = door[o + 3];
      const flutter =
        1 +
        turbulence *
          (0.55 * Math.sin(0.9 * r * t + door[o + 9]) + 0.3 * Math.sin(2.1 * r * t + door[o + 10]) + 0.15 * Math.sin(4.3 * r * t + door[o + 11]));
      door[o + 7] = doorGain * soft * flutter;
      door[o + 8] = 0.6 * doorField[3 * i];
    }
  }

  function sampleBatch(points, count, clock, out) {
    if (clock[0] !== cache[0]) updateJets(clock);
    evaluateField(points, count, out, clock);
    const t = clock[0],
      draft = cache[1];
    for (let i3 = 0; i3 < 3 * count; i3 += 3) {
      const x = points[i3],
        y = points[i3 + 1],
        z = points[i3 + 2];
      let vx = roomLeak * out[i3],
        vy = roomLeak * out[i3 + 1],
        vz = roomLeak * out[i3 + 2],
        inDoor = 0;
      const depth = z > glassZ ? z - glassZ : 0;
      for (let i = 0, o = 0; i < D; i++, o += STRIDE) {
        const speed = door[o + 7];
        if (speed === 0) continue;
        const a = door[o + 5],
          b = door[o + 6];
        // Smoothstep shoulders at both jambs of the open gap.
        let u = (x - a + softness) / (2 * softness),
          w = (x - b + softness) / (2 * softness);
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        w = w < 0 ? 0 : w > 1 ? 1 : w;
        const lateral = u * u * (3 - 2 * u) * (1 - w * w * (3 - 2 * w));
        if (lateral <= 0) continue;
        if (lateral > inDoor) inDoor = lateral;
        const r = door[o + 3];
        // Gust cells travel across the doorway, so neighbouring folds do not move in lockstep.
        const cells = 1 + 0.35 * Math.sin(2.1 * x + 1.3 * y - 2.4 * r * t + door[o + 12]) * Math.sin(0.9 * y + 1.7 * r * t + door[o + 13]);
        let foot = y / 0.6,
          top = (y - 3.0) / 0.4;
        foot = foot < 0 ? 0 : foot > 1 ? 1 : foot;
        top = top < 0 ? 0 : top > 1 ? 1 : top;
        const height = (0.55 + 0.45 * foot * foot * (3 - 2 * foot)) * (1 - top * top * (3 - 2 * top));
        const jet = (speed * lateral * height * cells) / (1 + depth / reach);
        const half = b - a > 0.2 ? 0.5 * (b - a) : 0.1;
        let across = (x - 0.5 * (a + b)) / half;
        across = across < -1 ? -1 : across > 1 ? 1 : across;
        vz += jet;
        vx += lateral * door[o + 8] + 0.25 * jet * across;
        vy += 0.08 * jet;
      }
      vy += draft * (1 - inDoor) * Math.exp(-depth / 0.18);
      out[i3] = vx;
      out[i3 + 1] = vy;
      out[i3 + 2] = vz;
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

  // The door panel's slide offset in metres, as the controller animates it (0 closed, slideX open).
  function setDoor(id, offset) {
    const i = ids.indexOf(id);
    if (i < 0) return;
    const o = i * STRIDE,
      slide = door[o + 2],
      next = slide < 0 ? clamp(Number(offset) || 0, slide, 0) : clamp(Number(offset) || 0, 0, slide);
    if (next === door[o + 4]) return;
    door[o + 4] = next;
    // The panel slides toward its jamb, uncovering the opening from the post it closes against.
    door[o + 5] = slide < 0 ? Math.max(door[o], door[o + 1] + next) : door[o];
    door[o + 6] = slide < 0 ? door[o + 1] : Math.min(door[o + 1], door[o] + next);
    cache[0] = NaN;
  }
  // Closed: the open gap is empty at the post each door closes against.
  for (let i = 0, o = 0; i < D; i++, o += STRIDE) {
    door[o + 5] = door[o + 2] < 0 ? door[o + 1] : door[o];
    door[o + 6] = door[o + 5];
  }

  return {
    sample,
    sampleBatch,
    setDoor,
    setDoorOpen(id, fraction) {
      const i = ids.indexOf(id);
      if (i >= 0) setDoor(id, clamp(Number(fraction) || 0, 0, 1) * door[i * STRIDE + 2]);
    },
    // Signed speed of the convective layer along closed glass, m/s: + rising (warm glass), - falling.
    setGlassDraft(speed) {
      cache[1] = Number(speed) || 0;
    },
    evidence: () => ({
      method: "room field leak + soft-clamped doorway jets + glass boundary layer",
      roomLeak,
      onshoreMetersPerSecond: onshore,
      doorGain,
      glassDraftMetersPerSecond: cache[1],
      doors: ids.map((id, i) => ({
        id,
        offset: door[i * STRIDE + 4],
        open: [door[i * STRIDE + 5], door[i * STRIDE + 6]],
        jetMetersPerSecond: door[i * STRIDE + 7],
      })),
    }),
  };
}

// The cloth solver. `panels` are generic specs (see facadeCurtainPanels for the facade's). `wind` is
// `(x, y, z, t, out) => [vx, vy, vz]` in m/s, preferably filling and returning `out`; when it carries a
// `sampleBatch(points, count, clock, out)` method (the facade draft's does), that typed-array path is
// used instead, which keeps the step allocation-free.
export function createCurtainCloth({
  panels: specs = [],
  wind = null,
  seed = 1,
  fixedStep = 1 / 60,
  substeps = 5,
  maxStepsPerUpdate = 4,
  maxFrameDelta = 0.1,
  gravity = GRAVITY,
  airDensity = AIR_DENSITY,
  reducedMotion = false,
  startTime = 0,
  sleepDeflection = 0.03,
  sleepSpeed = 0.01,
  sleepDelay = 0.75,
  settleSeconds = 1.5,
  lattice = [5, 6],
  drawSpeed = 0.45,
  topology = { shear: "alternate", verticalBend: false },
  profile = false,
} = {}) {
  if (!Array.isArray(specs) || !specs.length) throw new RangeError("curtain cloth needs at least one panel");
  if (!(fixedStep > 0) || !Number.isInteger(substeps) || substeps < 1 || !Number.isInteger(maxStepsPerUpdate) || maxStepsPerUpdate < 1)
    throw new RangeError("invalid curtain time step");
  let allocations = 0;
  const alloc = (Type, length) => {
    allocations++;
    return new Type(length);
  };
  const random = mulberry32(seed);
  const h = fixedStep / substeps,
    gh = gravity * h,
    inverseH = 1 / h,
    settleDamping = Math.exp(-6 * h);
  // Per-frame scalars live in typed slots: [step time, accumulator, interpolation alpha, update ms].
  const clock = alloc(Float64Array, 4);
  const windOut = [0, 0, 0];
  let windFn = null,
    batch = null,
    reduced = Boolean(reducedMotion),
    steps = 0;
  setWind(wind);
  const ids = new Map();
  const panels = specs.map((spec, index) => buildPanel(spec, index));

  function setWind(next) {
    windFn = typeof next === "function" ? next : null;
    batch = next && typeof next.sampleBatch === "function" ? next.sampleBatch : null;
  }

  function buildPanel(spec, index) {
    const fabric = { ...SHEER_VOILE, ...(spec.fabric ?? {}) };
    const C = spec.columns ?? 29,
      R = spec.rows ?? 25,
      pleat = spec.pleat ?? 4;
    if (!Number.isInteger(pleat) || pleat < 2) throw new RangeError("curtain pleat must be an integer >= 2 (columns per fold)");
    if (!Number.isInteger(C) || C < 2 * pleat + 1 || (C - 1) % pleat !== 0)
      throw new RangeError("curtain columns must be 1 + a multiple of the pleat, with at least two folds");
    if (!Number.isInteger(R) || R < 4) throw new RangeError("curtain rows must be an integer >= 4");
    const id = String(spec.id ?? `panel-${index}`);
    if (ids.has(id)) throw new RangeError(`duplicate curtain panel id ${id}`);
    const N = C * R,
      rings = (C - 1) / pleat + 1;
    const origin = spec.origin ?? [0, 2.5, 0];
    let ax = spec.axis?.[0] ?? 1,
      az = spec.axis?.[2] ?? 0;
    const axisLength = Math.hypot(ax, az);
    if (!(axisLength > 0)) throw new RangeError("curtain rail axis must be horizontal and nonzero");
    ax /= axisLength;
    az /= axisLength;
    // The room normal is horizontal and perpendicular to the rail.
    let rx = spec.room?.[0] ?? -az,
      rz = spec.room?.[2] ?? ax;
    const along = rx * ax + rz * az;
    rx -= along * ax;
    rz -= along * az;
    const roomLength = Math.hypot(rx, rz);
    if (!(roomLength > 0)) throw new RangeError("curtain room normal must not be parallel to the rail");
    rx /= roomLength;
    rz /= roomLength;
    const closedWidth = spec.closedWidth ?? 1,
      drop = spec.drop ?? 2.5,
      fullness = spec.fullness ?? 1.8,
      ringPitch = spec.ringPitch ?? 0.022;
    const W = fullness * closedWidth,
      hx = W / (C - 1),
      vy = drop / (R - 1),
      stackWidth = (rings - 1) * ringPitch;
    if (!(closedWidth > stackWidth) || !(fullness >= 1) || !(drop > 0) || !(ringPitch > 0))
      throw new RangeError("curtain panel needs fullness >= 1 and a closed width wider than its stack");
    if (pleat * hx < ringPitch) throw new RangeError("curtain ring pitch exceeds the fabric between rings");
    const open = clamp(Number(spec.openFraction) || 0, 0, 1);
    const P = {
      id,
      index,
      track: spec.track ?? null,
      door: spec.door ?? null,
      C,
      R,
      N,
      rings,
      pleat,
      wave: alloc(Float64Array, 2 * (pleat + 1)),
      W,
      hx,
      vy,
      drop,
      closedWidth,
      stackWidth,
      fullness,
      ox: origin[0],
      oy: origin[1],
      oz: origin[2],
      ax,
      az,
      rx,
      rz,
      // Grid normal du x dv with du along the axis and dv down is (az, 0, -ax); it faces the room
      // when (az, -ax) . (rx, rz) > 0, otherwise normals and winding flip.
      orient: az * rx - ax * rz > 0 ? 1 : -1,
      fabric,
      open,
      target: open,
      headFrom: open,
      drawSpeed: Number(spec.drawSpeed ?? drawSpeed),
      windScale: Math.max(0, Number(spec.windScale ?? 1)),
      floorY: (spec.floorY ?? 0) + fabric.thickness,
      pos: alloc(Float64Array, 3 * N),
      prev: alloc(Float64Array, 3 * N),
      vel: alloc(Float64Array, 3 * N),
      last: alloc(Float64Array, 3 * N),
      force: alloc(Float64Array, 3 * N),
      mass: alloc(Float64Array, N),
      // Constraint weights: 0 on the kinematic heading row.
      invMass: alloc(Float64Array, N),
      // 1 / m for every particle, for applying forces.
      inverseMass: alloc(Float64Array, N),
      headA: alloc(Float64Array, 3 * C),
      headB: alloc(Float64Array, 3 * C),
      planes: alloc(Float64Array, 4 * (spec.planes?.length ?? 0)),
      planeCount: spec.planes?.length ?? 0,
      sleeping: false,
      settled: false,
      calm: 0,
      windMax: 0,
      maxSpeed: 0,
      sleepWind: 0,
      wakeWind: 0,
      damp: Math.exp(-fabric.damping * h),
    };
    for (let k = 0; k < P.planeCount; k++) {
      const plane = spec.planes[k],
        n = plane.normal,
        length = Math.hypot(n[0], n[1], n[2]);
      if (!(length > 0)) throw new RangeError("curtain collision plane needs a normal");
      P.planes[4 * k] = n[0] / length;
      P.planes[4 * k + 1] = n[1] / length;
      P.planes[4 * k + 2] = n[2] / length;
      P.planes[4 * k + 3] = plane.offset / length + (plane.clearance ?? fabric.thickness);
    }
    // Masses: lumped rest area per particle, a weighted hem on the bottom row.
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        const i = r * C + c,
          wc = c === 0 || c === C - 1 ? 0.5 : 1,
          wr = r === 0 || r === R - 1 ? 0.5 : 1;
        let m = fabric.arealDensity * hx * vy * wc * wr;
        if (r === R - 1) m += fabric.hemMass * hx * wc;
        P.mass[i] = m;
        P.inverseMass[i] = 1 / m;
        P.invMass[i] = r === 0 ? 0 : 1 / m;
      }
    // The sleep threshold: wind whose dynamic pressure would lean the sheet by under ~sleepDeflection rad.
    P.sleepWind = Math.sqrt((2 * sleepDeflection * fabric.arealDensity * gravity) / (airDensity * fabric.pressureCoefficient));
    P.wakeWind = 1.3 * P.sleepWind;

    // Rest lengths across the cloth follow the fold the heading imposes (refreshRest): the fabric
    // between two columns hangs in the same curve all the way down. Bends keep a little memory of the
    // closed pleat, so a gathered stack flares slightly at the hem. Down the cloth, rest is the row pitch.
    const closedHead = new Float64Array(3 * C);
    heading(P, closedHead, 2);
    P.chord1 = alloc(Float64Array, C - 1);
    P.chord2 = alloc(Float64Array, C - 2);
    P.closedChord2 = alloc(Float64Array, C - 2);
    for (let c = 0; c < C - 2; c++)
      P.closedChord2[c] = Math.hypot(closedHead[3 * c + 6] - closedHead[3 * c], closedHead[3 * c + 8] - closedHead[3 * c + 2]);
    const list = [];
    const add = (r0, c0, r1, c1, kind) => {
      if (r1 >= R || c1 >= C || c1 < 0) return;
      if (r0 === 0 && r1 === 0) return; // both kinematic
      // Role: -1 fixed rest (down the cloth), else type * C + column for refreshRest.
      const role = c0 === c1 ? -1 : r0 === r1 ? (c1 - c0 === 1 ? c0 : 2 * C + c0) : C + Math.min(c0, c1);
      list.push([r0 * C + c0, r1 * C + c1, Math.abs(r1 - r0) * vy, kind, role]);
    };
    // Colour batches: no two constraints in a batch share a particle, so consecutive projections are
    // independent and the processor overlaps their square roots instead of waiting on each one.
    // Batches run top-down within themselves and in the order bend, shear, stretch, so the stiff
    // structural constraints have the last word in every pass.
    for (let parity = 0; parity < 2; parity++)
      for (let r = 0; r < R; r++) for (let c = 0; c < C - 2; c++) if (((c >> 1) & 1) === parity) add(r, c, r, c + 2, 2);
    if (topology.verticalBend)
      for (let parity = 0; parity < 2; parity++)
        for (let r = 0; r < R - 2; r++) if (((r >> 1) & 1) === parity) for (let c = 0; c < C; c++) add(r, c, r + 2, c, 2);
    for (let pr = 0; pr < 2; pr++)
      for (let pc = 0; pc < 2; pc++)
        for (let r = pr; r < R - 1; r += 2)
          for (let c = pc; c < C - 1; c += 2) {
            // Alternating diagonals resist shear in both senses at half the cost of crossed pairs.
            if (topology.shear === "both" || (r + c) % 2 === 0) add(r, c, r + 1, c + 1, 1);
            if (topology.shear === "both" || (r + c) % 2 === 1) add(r, c + 1, r + 1, c, 1);
          }
    for (let parity = 0; parity < 2; parity++) for (let r = 0; r < R; r++) for (let c = parity; c < C - 1; c += 2) add(r, c, r, c + 1, 0);
    for (let parity = 0; parity < 2; parity++) for (let r = parity; r < R - 1; r += 2) for (let c = 0; c < C; c++) add(r, c, r + 1, c, 0);
    // Packed for the projection kernel: coordinate offsets (3i, 3j), then per constraint the two
    // inverse masses, the rest length and 1 / (w_i + w_j + alpha/h^2). Inverse masses never change.
    const count = list.length;
    P.cCount = count;
    P.cIndex = alloc(Int32Array, 2 * count);
    P.cData = alloc(Float64Array, 4 * count);
    P.cKind = alloc(Uint8Array, count);
    P.cRole = alloc(Int32Array, count);
    const compliance = [fabric.stretchCompliance, fabric.shearCompliance, fabric.bendCompliance];
    list.forEach(([a, b, rest, kind, role], k) => {
      const wa = P.invMass[a],
        wb = P.invMass[b];
      P.cIndex[2 * k] = 3 * a;
      P.cIndex[2 * k + 1] = 3 * b;
      P.cData[4 * k] = wa;
      P.cData[4 * k + 1] = wb;
      P.cData[4 * k + 2] = rest;
      P.cData[4 * k + 3] = 1 / (wa + wb + compliance[kind] / (h * h));
      P.cKind[k] = kind;
      P.cRole[k] = role;
    });
    // Long-range attachments: no particle may stray farther from its column's heading point than
    // the fabric between them.
    P.tCount = (R - 2) * C;
    P.tIndex = alloc(Int32Array, 2 * P.tCount);
    P.tRest = alloc(Float64Array, P.tCount);
    for (let r = 2, k = 0; r < R; r++)
      for (let c = 0; c < C; c++, k++) {
        P.tIndex[2 * k] = 3 * (r * C + c);
        P.tIndex[2 * k + 1] = 3 * c;
        P.tRest[k] = r * vy;
      }
    // Wind lattice: a coarse grid of particles whose positions sample the field each step.
    const LC = Math.max(2, Math.min(C, lattice[0] | 0)),
      LR = Math.max(2, Math.min(R, lattice[1] | 0));
    const latticeColumns = Array.from({ length: LC }, (_, k) => Math.round((k * (C - 1)) / (LC - 1))),
      latticeRows = Array.from({ length: LR }, (_, k) => Math.round((k * (R - 1)) / (LR - 1)));
    P.LC = LC;
    P.L = LC * LR;
    P.lNode = alloc(Uint32Array, P.L);
    P.lPoints = alloc(Float64Array, 3 * P.L);
    P.lWind = alloc(Float64Array, 3 * P.L);
    for (let j = 0; j < LR; j++) for (let k = 0; k < LC; k++) P.lNode[j * LC + k] = latticeRows[j] * C + latticeColumns[k];
    const quads = (C - 1) * (R - 1);
    P.qCell = alloc(Uint32Array, quads);
    P.qFx = alloc(Float64Array, quads);
    P.qFy = alloc(Float64Array, quads);
    const cell = (marks, x) => {
      let k = 0;
      while (k < marks.length - 2 && x > marks[k + 1]) k++;
      return [k, (x - marks[k]) / (marks[k + 1] - marks[k])];
    };
    for (let r = 0; r < R - 1; r++)
      for (let c = 0; c < C - 1; c++) {
        const [kx, fx] = cell(latticeColumns, c + 0.5),
          [ky, fy] = cell(latticeRows, r + 0.5),
          q = r * (C - 1) + c;
        P.qCell[q] = ky * LC + kx;
        P.qFx[q] = clamp(fx, 0, 1);
        P.qFy[q] = clamp(fy, 0, 1);
      }
    // Static render topology: two triangles per quad, wound so the front faces the room.
    const IndexType = N < 65536 ? Uint16Array : Uint32Array;
    P.triangles = alloc(IndexType, quads * 6);
    P.uv = alloc(Float32Array, 2 * N);
    for (let r = 0, k = 0; r < R - 1; r++)
      for (let c = 0; c < C - 1; c++, k += 6) {
        const i00 = r * C + c,
          i10 = i00 + 1,
          i01 = i00 + C,
          i11 = i01 + 1;
        P.triangles.set(P.orient > 0 ? [i00, i10, i01, i10, i11, i01] : [i00, i01, i10, i10, i01, i11], k);
      }
    // Fabric coordinates in metres: across the cloth from the stack edge, and up from the hem.
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        P.uv[2 * (r * C + c)] = c * hx;
        P.uv[2 * (r * C + c) + 1] = (R - 1 - r) * vy;
      }
    ids.set(id, P);
    drape(P, true);
    if (reduced) settle(P);
    return P;
  }

  // Heading points: a ring every `pleat` columns, and between rings the columns at equal arc length
  // along a half-sine fold whose length is the fabric between the rings; folds alternate room side and
  // glass side. `which`: 0 the current open fraction, 1 the fraction at the start of this step, 2 closed.
  function heading(P, out, which) {
    const o = which === 0 ? P.open : which === 1 ? P.headFrom : 0;
    const span = P.closedWidth * (1 - o) + P.stackWidth * o,
      pitch = span / (P.rings - 1),
      m = foldAmplitude((P.pleat * P.hx) / pitch),
      amplitude = (m * pitch) / Math.PI,
      wave = P.wave,
      pleat = P.pleat;
    // Cumulative arc length of one half wave, then the columns at equal fractions of it.
    foldArc[0] = 0;
    for (let k = 1; k <= FOLD_SAMPLES; k++) {
      const u = (Math.PI * (k - 0.5)) / FOLD_SAMPLES,
        cu = Math.cos(u);
      foldArc[k] = foldArc[k - 1] + Math.sqrt(1 + m * m * cu * cu);
    }
    const total = foldArc[FOLD_SAMPLES];
    for (let j = 0, k = 1; j <= pleat; j++) {
      const want = (total * j) / pleat;
      while (k < FOLD_SAMPLES && foldArc[k] < want) k++;
      const t = foldArc[k] > foldArc[k - 1] ? (want - foldArc[k - 1]) / (foldArc[k] - foldArc[k - 1]) : 0,
        u = (Math.PI * (k - 1 + (t < 0 ? 0 : t > 1 ? 1 : t))) / FOLD_SAMPLES;
      wave[2 * j] = j === 0 ? 0 : j === pleat ? 1 : u / Math.PI;
      wave[2 * j + 1] = j === 0 || j === pleat ? 0 : Math.sin(u);
    }
    for (let c = 0; c < P.C; c++) {
      const k = (c / pleat) | 0,
        j = c - k * pleat,
        s = (k + wave[2 * j]) * pitch,
        d = (k & 1 ? -amplitude : amplitude) * wave[2 * j + 1],
        c3 = 3 * c;
      out[c3] = P.ox + P.ax * s + P.rx * d;
      out[c3 + 1] = P.oy;
      out[c3 + 2] = P.oz + P.az * s + P.rz * d;
    }
  }

  // Rest lengths across the cloth from the current heading (headB): chords between neighbouring
  // columns and between columns two apart, the latter blended toward the closed pleat.
  function refreshRest(P) {
    const { C, headB, chord1, chord2, closedChord2, cData, cRole, vy } = P,
      memory = P.fabric.pleatMemory;
    for (let c = 0; c < C - 1; c++) chord1[c] = Math.hypot(headB[3 * c + 3] - headB[3 * c], headB[3 * c + 5] - headB[3 * c + 2]);
    for (let c = 0; c < C - 2; c++) {
      const chord = Math.hypot(headB[3 * c + 6] - headB[3 * c], headB[3 * c + 8] - headB[3 * c + 2]);
      chord2[c] = chord + memory * (closedChord2[c] - chord);
    }
    for (let k = 0; k < P.cCount; k++) {
      const role = cRole[k];
      if (role < 0) continue;
      const type = (role / C) | 0,
        c = role - type * C;
      cData[4 * k + 2] = type === 0 ? chord1[c] : type === 1 ? Math.sqrt(chord1[c] * chord1[c] + vy * vy) : chord2[c];
    }
  }

  // Every column hanging straight from its heading point: the zero-wind drape before bending.
  function drape(P, jitter = false) {
    heading(P, P.headB, 0);
    P.headA.set(P.headB);
    refreshRest(P);
    const { C, R, pos } = P;
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        const i3 = 3 * (r * C + c),
          c3 = 3 * c,
          // A sub-millimetre seeded jitter breaks the grid's perfect symmetry.
          e = jitter && r > 0 ? 0.0006 : 0;
        pos[i3] = P.headB[c3] + e * (random() - 0.5);
        pos[i3 + 1] = Math.max(P.floorY, P.oy - r * P.vy);
        pos[i3 + 2] = P.headB[c3 + 2] + e * (random() - 0.5);
      }
    P.prev.set(pos);
    P.last.set(pos);
    P.vel.fill(0);
    P.force.fill(0);
  }

  // The lead carrier eases toward its target at up to drawSpeed m/s. Returns whether it moved.
  function advanceOpen(P) {
    P.headFrom = P.open;
    const diff = P.target - P.open;
    if (diff === 0) return false;
    if (diff < 1e-4 && diff > -1e-4) {
      P.open = P.target;
      return true;
    }
    const maxRate = P.drawSpeed / (P.closedWidth - P.stackWidth);
    let rate = 4 * diff;
    rate = rate > maxRate ? maxRate : rate < -maxRate ? -maxRate : rate;
    const next = P.open + rate * fixedStep;
    P.open = diff > 0 ? (next > P.target ? P.target : next) : next < P.target ? P.target : next;
    return true;
  }

  function sampleLattice(P) {
    const { pos, lNode, lWind, lPoints, L } = P;
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
    const scale = P.windScale;
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
    P.windMax = Math.sqrt(max2);
  }

  // Per-triangle air force from the wind relative to the triangle's mean velocity, a third to each
  // corner: F = 0.5 rho A |u| (C_N (u.n) n + C_F u_t) / (1 + k dt), k = 0.5 rho C_N |u| / (areal density).
  function aerodynamics(P) {
    const { C, R, pos, vel, force, lWind, qCell, qFx, qFy, LC, fabric } = P;
    force.fill(0);
    const k0 = 0.5 * airDensity,
      Cn = fabric.pressureCoefficient,
      Cf = fabric.frictionCoefficient,
      rate = (k0 * Cn * fixedStep) / fabric.arealDensity,
      row = 3 * LC,
      third = 1 / 3;
    for (let r = 0; r < R - 1; r++)
      for (let c = 0; c < C - 1; c++) {
        const q = r * (C - 1) + c,
          l3 = 3 * qCell[q],
          fx = qFx[q],
          fy = qFy[q];
        const w00 = (1 - fx) * (1 - fy),
          w10 = fx * (1 - fy),
          w01 = (1 - fx) * fy,
          w11 = fx * fy;
        const wx = lWind[l3] * w00 + lWind[l3 + 3] * w10 + lWind[l3 + row] * w01 + lWind[l3 + row + 3] * w11,
          wy = lWind[l3 + 1] * w00 + lWind[l3 + 4] * w10 + lWind[l3 + row + 1] * w01 + lWind[l3 + row + 4] * w11,
          wz = lWind[l3 + 2] * w00 + lWind[l3 + 5] * w10 + lWind[l3 + row + 2] * w01 + lWind[l3 + row + 5] * w11;
        const i00 = r * C + c;
        for (let tri = 0; tri < 2; tri++) {
          // (i00, i10, i01) then (i10, i11, i01)
          const a3 = 3 * (tri === 0 ? i00 : i00 + 1),
            b3 = 3 * (tri === 0 ? i00 + 1 : i00 + C + 1),
            c3 = 3 * (i00 + C);
          const ex = pos[b3] - pos[a3],
            ey = pos[b3 + 1] - pos[a3 + 1],
            ez = pos[b3 + 2] - pos[a3 + 2];
          const gx = pos[c3] - pos[a3],
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
          const ux = wx - (vel[a3] + vel[b3] + vel[c3]) * third,
            uy = wy - (vel[a3 + 1] + vel[b3 + 1] + vel[c3 + 1]) * third,
            uz = wz - (vel[a3 + 2] + vel[b3 + 2] + vel[c3 + 2]) * third;
          const speed = Math.sqrt(ux * ux + uy * uy + uz * uz);
          if (speed < 1e-6) continue;
          const un = ux * nx + uy * ny + uz * nz,
            scale = (k0 * 0.5 * twice * speed * third) / (1 + rate * speed),
            normal = Cn * un;
          const fx3 = scale * (normal * nx + Cf * (ux - un * nx)),
            fy3 = scale * (normal * ny + Cf * (uy - un * ny)),
            fz3 = scale * (normal * nz + Cf * (uz - un * nz));
          force[a3] += fx3;
          force[a3 + 1] += fy3;
          force[a3 + 2] += fz3;
          force[b3] += fx3;
          force[b3 + 1] += fy3;
          force[b3 + 2] += fz3;
          force[c3] += fx3;
          force[c3 + 1] += fy3;
          force[c3 + 2] += fz3;
        }
      }
  }

  // One small step: predict, move the heading, one constraint pass, tethers, contacts, velocities.
  // `settling` selects the heavy damping used for the reduced-motion drape.
  function substep(P, s, settling) {
    const { C, N, pos, prev, vel, force, inverseMass, headA, headB, planes, planeCount, floorY } = P;
    const damping = settling ? settleDamping : P.damp;
    for (let i3 = 3 * C, i = C; i < N; i++, i3 += 3) {
      const im = inverseMass[i] * h;
      const x = (vel[i3] + force[i3] * im) * damping,
        y = (vel[i3 + 1] + force[i3 + 1] * im - gh) * damping,
        z = (vel[i3 + 2] + force[i3 + 2] * im) * damping;
      vel[i3] = x;
      vel[i3 + 1] = y;
      vel[i3 + 2] = z;
      prev[i3] = pos[i3];
      prev[i3 + 1] = pos[i3 + 1];
      prev[i3 + 2] = pos[i3 + 2];
      pos[i3] += x * h;
      pos[i3 + 1] += y * h;
      pos[i3 + 2] += z * h;
    }
    const f = (s + 1) / substeps;
    for (let c3 = 0; c3 < 3 * C; c3++) {
      prev[c3] = pos[c3];
      pos[c3] = headA[c3] + (headB[c3] - headA[c3]) * f;
      vel[c3] = (pos[c3] - prev[c3]) * inverseH;
    }
    project(pos, P.cIndex, P.cData, P.cCount);
    tether(pos, P.tIndex, P.tRest, P.tCount);
    let max2 = 0;
    for (let i3 = 3 * C; i3 < 3 * N; i3 += 3) {
      if (pos[i3 + 1] < floorY) {
        pos[i3 + 1] = floorY;
        // Floor friction: the contact keeps only part of this substep's sliding.
        pos[i3] = prev[i3] + (pos[i3] - prev[i3]) * 0.4;
        pos[i3 + 2] = prev[i3 + 2] + (pos[i3 + 2] - prev[i3 + 2]) * 0.4;
      }
      for (let k4 = 0; k4 < 4 * planeCount; k4 += 4) {
        const nx = planes[k4],
          ny = planes[k4 + 1],
          nz = planes[k4 + 2],
          d = nx * pos[i3] + ny * pos[i3 + 1] + nz * pos[i3 + 2] - planes[k4 + 3];
        if (d < 0) {
          pos[i3] -= d * nx;
          pos[i3 + 1] -= d * ny;
          pos[i3 + 2] -= d * nz;
        }
      }
      const x = (pos[i3] - prev[i3]) * inverseH,
        y = (pos[i3 + 1] - prev[i3 + 1]) * inverseH,
        z = (pos[i3 + 2] - prev[i3 + 2]) * inverseH;
      vel[i3] = x;
      vel[i3 + 1] = y;
      vel[i3 + 2] = z;
      const s2 = x * x + y * y + z * z;
      if (s2 > max2) max2 = s2;
    }
    if (s === substeps - 1) P.maxSpeed = Math.sqrt(max2);
  }

  function stepPanel(P) {
    const moving = advanceOpen(P);
    sampleLattice(P);
    if (P.sleeping) {
      if (!moving && P.windMax <= P.wakeWind) return;
      P.sleeping = false;
      P.calm = 0;
    }
    P.last.set(P.pos);
    heading(P, P.headA, 1);
    heading(P, P.headB, 0);
    if (moving) refreshRest(P);
    aerodynamics(P);
    for (let s = 0; s < substeps; s++) substep(P, s, false);
    if (!moving && P.windMax < P.sleepWind && P.maxSpeed < sleepSpeed) {
      P.calm += fixedStep;
      if (P.calm >= sleepDelay) {
        P.sleeping = true;
        P.vel.fill(0);
        P.last.set(P.pos);
      }
    } else P.calm = 0;
  }

  // Reduced motion: jump to the target, relax without wind under heavy damping, then hold still.
  function settle(P) {
    P.open = P.target;
    drape(P);
    const count = Math.ceil(settleSeconds / fixedStep);
    for (let k = 0; k < count; k++) for (let s = 0; s < substeps; s++) substep(P, s, true);
    P.vel.fill(0);
    P.last.set(P.pos);
    P.sleeping = true;
    P.settled = true;
    P.calm = 0;
  }

  function panelOf(id) {
    const P = typeof id === "number" ? panels[id] : ids.get(id);
    if (!P) throw new RangeError(`unknown curtain panel ${id}`);
    return P;
  }

  function update(dt) {
    if (!(dt > 0)) return api;
    if (reduced) {
      for (let k = 0; k < panels.length; k++) if (!panels[k].settled || panels[k].open !== panels[k].target) settle(panels[k]);
      clock[2] = 1;
      return api;
    }
    const started = profile ? performance.now() : 0;
    clock[1] += dt < maxFrameDelta ? dt : maxFrameDelta;
    let taken = 0;
    while (clock[1] >= fixedStep && taken < maxStepsPerUpdate) {
      clock[0] = startTime + steps * fixedStep;
      for (let k = 0; k < panels.length; k++) stepPanel(panels[k]);
      steps++;
      taken++;
      clock[1] -= fixedStep;
    }
    // Beyond the step budget, drop the backlog instead of spiralling.
    if (clock[1] >= fixedStep) clock[1] = fixedStep * 0.999;
    clock[2] = clock[1] / fixedStep;
    if (profile && taken) clock[3] = performance.now() - started;
    return api;
  }

  // Interpolated positions, room-facing normals and weft tangents into Float32Arrays of 3 x count.
  function writePanel(id, position, normal = null, tangent = null) {
    const P = panelOf(id),
      { C, R, N, pos, last } = P;
    if (P.sleeping) for (let k = 0; k < 3 * N; k++) position[k] = pos[k];
    else {
      const a = clock[2];
      for (let k = 0; k < 3 * N; k++) position[k] = last[k] + (pos[k] - last[k]) * a;
    }
    if (!normal && !tangent) return position;
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        const left = 3 * (r * C + (c > 0 ? c - 1 : c)),
          right = 3 * (r * C + (c < C - 1 ? c + 1 : c)),
          up = 3 * ((r > 0 ? r - 1 : r) * C + c),
          down = 3 * ((r < R - 1 ? r + 1 : r) * C + c),
          i3 = 3 * (r * C + c);
        const ux = position[right] - position[left],
          uy = position[right + 1] - position[left + 1],
          uz = position[right + 2] - position[left + 2];
        const vx = position[down] - position[up],
          vy = position[down + 1] - position[up + 1],
          vz = position[down + 2] - position[up + 2];
        let nx = (uy * vz - uz * vy) * P.orient,
          ny = (uz * vx - ux * vz) * P.orient,
          nz = (ux * vy - uy * vx) * P.orient;
        let length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (length < 1e-12) {
          nx = P.rx;
          ny = 0;
          nz = P.rz;
          length = 1;
        }
        nx /= length;
        ny /= length;
        nz /= length;
        if (normal) {
          normal[i3] = nx;
          normal[i3 + 1] = ny;
          normal[i3 + 2] = nz;
        }
        if (tangent) {
          const along = ux * nx + uy * ny + uz * nz;
          const tx = ux - along * nx,
            ty = uy - along * ny,
            tz = uz - along * nz;
          const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
          tangent[i3] = tx / tl;
          tangent[i3 + 1] = ty / tl;
          tangent[i3 + 2] = tz / tl;
        }
      }
    return position;
  }

  // Largest relative length error of the structural (stretch) constraints.
  function strain(P) {
    let max = 0;
    const { pos, cIndex, cData, cKind } = P;
    for (let k = 0; k < P.cCount; k++) {
      if (cKind[k] !== 0) continue;
      const a = cIndex[2 * k],
        b = cIndex[2 * k + 1],
        rest = cData[4 * k + 2];
      const e = Math.abs(Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]) - rest) / rest;
      if (e > max) max = e;
    }
    return max;
  }

  // Kinetic energy and gravitational potential above the straight hanging drape.
  function energies(P) {
    let kinetic = 0,
      potential = 0;
    const { C, R, pos, vel, mass } = P;
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        const i = r * C + c,
          i3 = 3 * i;
        kinetic += 0.5 * mass[i] * (vel[i3] ** 2 + vel[i3 + 1] ** 2 + vel[i3 + 2] ** 2);
        potential += mass[i] * gravity * (pos[i3 + 1] - Math.max(P.floorY, P.oy - r * P.vy));
      }
    return { kinetic, potential };
  }

  // Distance along the rail from the stack-end ring to the lead ring.
  function gathered(P) {
    const { pos } = P,
      last = 3 * (P.C - 1);
    const s0 = (pos[0] - P.ox) * P.ax + (pos[2] - P.oz) * P.az,
      s1 = (pos[last] - P.ox) * P.ax + (pos[last + 2] - P.oz) * P.az;
    return Math.abs(s1 - s0);
  }

  const views = panels.map((P) =>
    Object.freeze({
      id: P.id,
      track: P.track,
      door: P.door,
      columns: P.C,
      rows: P.R,
      count: P.N,
      pleat: P.pleat,
      rings: P.rings,
      index: P.triangles,
      uv: P.uv,
      positions: P.pos,
      fabricSize: Object.freeze([P.W, P.drop]),
      origin: Object.freeze([P.ox, P.oy, P.oz]),
      axis: Object.freeze([P.ax, 0, P.az]),
      room: Object.freeze([P.rx, 0, P.rz]),
      closedWidth: P.closedWidth,
      stackWidth: P.stackWidth,
      // A conservative bound for culling: the panel's hanging box widened by the farthest billow.
      boundingSphere: Object.freeze({
        center: Object.freeze([P.ox + P.ax * 0.5 * P.closedWidth, P.oy - 0.5 * P.drop, P.oz + P.az * 0.5 * P.closedWidth]),
        radius: Math.hypot(0.5 * P.closedWidth, 0.5 * P.drop) + 0.35 * P.drop,
      }),
    })
  );

  const api = {
    panels: views,
    update,
    writePanel,
    panel: (id) => views[panelOf(id).index],
    // 0 closed (spread across the rail) .. 1 open (gathered at the stack end). The lead carrier
    // travels at drawSpeed m/s unless `immediate`; reduced motion jumps to the settled drape.
    setOpenFraction(id, fraction, { immediate = false } = {}) {
      const P = panelOf(id),
        next = clamp(Number(fraction) || 0, 0, 1);
      if (next === P.target && !immediate) return api;
      P.target = next;
      if (reduced) {
        settle(P);
        return api;
      }
      if (immediate) {
        P.open = next;
        drape(P);
      }
      P.sleeping = false;
      P.calm = 0;
      return api;
    },
    openFraction: (id) => panelOf(id).open,
    targetOpenFraction: (id) => panelOf(id).target,
    setWindScale(id, scale) {
      panelOf(id).windScale = Math.max(0, Number(scale) || 0);
      return api;
    },
    setWind(next) {
      setWind(next);
      return api;
    },
    setReducedMotion(flag) {
      const next = Boolean(flag);
      if (next === reduced) return api;
      reduced = next;
      for (const P of panels) {
        if (reduced) settle(P);
        else {
          P.sleeping = false;
          P.settled = false;
          P.calm = 0;
        }
      }
      clock[1] = 0;
      clock[2] = reduced ? 1 : 0;
      return api;
    },
    wake(id) {
      if (!reduced)
        for (const P of id === undefined ? panels : [panelOf(id)]) {
          P.sleeping = false;
          P.calm = 0;
        }
      return api;
    },
    evidence() {
      let kinetic = 0,
        potential = 0,
        maxError = 0,
        particles = 0,
        constraints = 0;
      const rows = panels.map((P) => {
        const e = energies(P),
          error = strain(P);
        kinetic += e.kinetic;
        potential += e.potential;
        maxError = Math.max(maxError, error);
        particles += P.N;
        constraints += P.cCount + P.tCount;
        return {
          id: P.id,
          particles: P.N,
          columns: P.C,
          rows: P.R,
          openFraction: P.open,
          targetOpenFraction: P.target,
          gatheredWidth: gathered(P),
          sleeping: P.sleeping,
          windMetersPerSecond: P.windMax,
          sleepWindMetersPerSecond: P.sleepWind,
          windScale: P.windScale,
          maxConstraintError: error,
          kineticEnergy: e.kinetic,
          potentialEnergy: e.potential,
        };
      });
      return {
        method: "XPBD small steps: stretch/shear/bend distance constraints, long-range tethers, per-triangle flat-plate air force",
        fixedStep,
        substeps,
        steps,
        simulatedSeconds: steps * fixedStep,
        reducedMotion: reduced,
        particles,
        constraints,
        maxConstraintError: maxError,
        kineticEnergy: kinetic,
        potentialEnergy: potential,
        energy: kinetic + potential,
        sleeping: panels.every((P) => P.sleeping),
        openFractions: Object.fromEntries(panels.map((P) => [P.id, P.open])),
        lastUpdateMilliseconds: profile ? clock[3] : null,
        allocations,
        panels: rows,
      };
    },
  };
  return api;
}

// One XPBD pass with the multiplier starting at zero (small steps): dlambda = -C / (w + alpha~),
// so each endpoint moves by w (1 - rest/|d|) / (w_i + w_j + alpha~) along d.
function project(pos, index, data, count) {
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

// One-sided long-range attachments to the kinematic heading: pull back only when beyond reach.
function tether(pos, index, rest, count) {
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

// One call for the facade: the four proposed panels, the facade draft, and a per-frame hook that
// takes the controller's door offsets. `doors` maps door id to the panel's slide offset in metres.
export function createFacadeCurtains({ panels = {}, draft = {}, ...cloth } = {}) {
  const facadeDraft = createFacadeDraft(draft);
  const solver = createCurtainCloth({ ...cloth, panels: facadeCurtainPanels(panels), wind: facadeDraft.sample });
  return {
    cloth: solver,
    draft: facadeDraft,
    update(dt, doors = null) {
      if (doors) for (const id in doors) facadeDraft.setDoor(id, doors[id]);
      return solver.update(dt);
    },
  };
}
