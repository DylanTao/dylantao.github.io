import { DEFAULT_WIND, WIND_MODES, sampleWind } from "./wind-field.mjs";
import { SHEER_LINEN, clothBuilder, createClothIsland, mulberry32 } from "./cloth-solver.mjs";

// Linen curtains for the glass front (Sirui, 2026-10-15; rebuilt 2026-10-18 after "the current
// curtain feel a bit weird"). Sheer linen panels hang from rings on a bronze rod inside the two
// sliding doors, blown by the coast's one wind: hard where a door stands open, barely where the glass
// is shut. Pure JavaScript, no three.js, so the cloth runs under `node --test`.
//
// What the October 16 panels did wrong, and what this module does instead:
//  - Their heading row was kinematic on a sine template and every horizontal rest length followed its
//    chord, so the same corrugation ran from the rail to the floor: a vertical blind by night, and by
//    day, gathered into 13 cm stacks, a white pole that twisted in the doorway jet like a ribbon.
//    Here the rest lengths are the fabric's own and only the heading is kinematic: six rings on the
//    rod each pinch three columns of the top edge in a clip, and the stiff heading tape between two
//    pinches bows as a half sine at its own length, alternately to the room and the glass. Gathering
//    slides the rings together and the bays deepen into loops; below the heading, gravity and the
//    linen's bending (a 2.9 cm bending length) let the folds soften and the stack flare toward a
//    weighted, doubled hem.
//  - Ordering constraints keep each bay's folds in order along the rod (a gathered stack's layers
//    cannot pass through each other), in place of self-collision.
//  - Their draft fluttered on three fixed sinusoids. Here the doorway jet follows the coast's gusts
//    and carries eddies of the room's divergence-free field through the doorway with the air.
// The solver is cloth-solver.mjs: small-step XPBD with isometric bending, long-range attachments,
// contacts against the glass front, the door head, the rod and the floor. See PHYSICS.md
// ("Curtain cloth").

const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

export { SHEER_LINEN };

// The glass front in three.js world coordinates, from bin/coastal_facade.py (Blender (x, y, z) maps to
// three.js (x, z, -y): +X north, +Y up, +Z east, the sea toward -Z) and the authored GLB bounds.
export const CURTAIN_FACADE = Object.freeze({
  glassZ: -4.48, // FACADE_Y
  doorTrackZ: -4.44, // INNER_TRACK: the sliding doors run inside the fixed panes
  doorFaceZ: -4.41, // room face of the door stiles and the mullions
  headFaceZ: -4.4, // room face of the bronze door head beam
  hardwareZ: -4.351, // tip of the door pulls, the deepest thing on the room side of the glass
  doorHead: 3.19, // underside of the door head beam (DOOR_HEAD)
  headTop: 3.29, // HEAD_TOP
  floorY: 0,
  doors: Object.freeze([
    Object.freeze({ id: "kitchen", opening: Object.freeze([-3.4, -0.85]), slideX: -2.55, rate: 1 }),
    Object.freeze({ id: "lounge", opening: Object.freeze([2.0, 4.0]), slideX: 2.0, rate: 1.27 }),
  ]),
});

// The rod and its rings. A 25 mm bronze rod 25 cm in front of the door head's room face, on return
// brackets from the head; rings 34 mm across hang on it and each carries a clip that pinches the
// linen's top edge 5 cm under the rod's centre. Rings touch at 41 mm, which sets a stack's width
// (six rings: 20.5 cm).
export const CURTAIN_HARDWARE = Object.freeze({
  rodY: 3.135,
  rodZ: -4.15,
  rodRadius: 0.0125,
  ringRadius: 0.017, // centre line of the ring
  ringTube: 0.0032,
  clipDrop: 0.05, // rod centre to the fabric's top edge
  ringPitchMin: 0.041,
  pinchHalfWidth: 0.007, // the clip's jaw: the three pinched columns lie within +-7 mm of the ring
  bracketOverhang: 0.035, // end brackets stand this far outside the rails
  finialOverhang: 0.075,
});

// The tracks, measured against the authored models (room-kitchen.glb, room-lounge.glb, home-shell.glb,
// decoded 2026-10-15, and rendered in place): the kitchen's round dining table and its chairs stand
// against the glass from x -4.25 to -2.75 (top at 0.74-0.83 m, reaching z -4.37), and the lounge's
// potted plant and armchair stand inside the glass from x 3.5 northward (leaves at z -4.21). The clear
// stretch of floor along the front runs from the table to the plant, so each door gets a
// centre-opening pair there. Each pair stacks one panel over its open doorway and one over the
// mullion and fixed glass, which is what makes the two sides of a door blow differently.
const HEM_CLEARANCE = 0.015;
export const CURTAIN_TRACKS = Object.freeze([
  Object.freeze({
    id: "kitchen",
    door: "kitchen",
    rail: Object.freeze({ from: -2.7, to: -0.5 }),
    panels: Object.freeze([
      // Stacks beside the dining table, inside the open doorway: the windward panel.
      Object.freeze({ id: "kitchen-south", stackX: -2.7, closeToward: 1, keepOut: Object.freeze({ min: -2.735 }) }),
      // Stacks over the mullion at -0.85 and the gym bay's fixed glass: the sheltered panel.
      Object.freeze({ id: "kitchen-north", stackX: -0.5, closeToward: -1 }),
    ]),
  }),
  Object.freeze({
    id: "lounge",
    door: "lounge",
    rail: Object.freeze({ from: 1.65, to: 3.45 }),
    panels: Object.freeze([
      // Stacks over the gym bay's glass south of the mullion at 2.0: sheltered.
      Object.freeze({ id: "lounge-south", stackX: 1.65, closeToward: 1 }),
      // Stacks inside the open doorway beside the potted plant: windward.
      Object.freeze({ id: "lounge-north", stackX: 3.45, closeToward: -1, keepOut: Object.freeze({ max: 3.47 }) }),
    ]),
  }),
]);
// The bedroom alcove was considered and left out: the bed fills the alcove up to the cedar screen and
// the stair wall, so there is no clear line to hang a panel (room-sleep.glb, home-shell.glb).

// A bay between two pinches bows as a half sine y = A sin(pi x / s) over its chord s, with arc length
// equal to the fabric in it, L. With m = A pi / s, L / s depends on m alone; this table inverts it.
const FOLD_TABLE_SIZE = 2048,
  FOLD_M_MAX = 48,
  FOLD_SAMPLES = 48;
const foldRatio = new Float64Array(FOLD_TABLE_SIZE);
for (let i = 0; i < FOLD_TABLE_SIZE; i++) {
  const m = (FOLD_M_MAX * i) / (FOLD_TABLE_SIZE - 1);
  let sum = 0;
  for (let k = 0; k <= 64; k++) {
    const u = (Math.PI * k) / 64,
      w = k === 0 || k === 64 ? 1 : k % 2 ? 4 : 2;
    sum += w * Math.sqrt(1 + m * m * Math.cos(u) ** 2);
  }
  foldRatio[i] = ((Math.PI / 64 / 3) * sum) / Math.PI;
}
export function foldAmplitude(ratio) {
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

// Panel specs for createCurtainCloth from the tracks. Columns: six rings, each pinching three
// columns, with three columns in each bay between pinches (33 columns, 7 cm apart on a 2.24 m kitchen
// panel); 21 rows over the 3.07 m drop. Seven rings, 25 rows and eight substeps cost three times as
// much a step in the live scene; with six substeps a doorway panel stretches under 6 %.
export function facadeCurtainPanels({
  tracks = CURTAIN_TRACKS,
  fabric = SHEER_LINEN,
  rings = 6,
  pinch = 1,
  flat = 3,
  rows = 21,
  fullness = 2,
  overlap = 0.02,
  openFraction = 0,
  // Per-panel starting fractions ({ "kitchen-south": 1, ... }); others take `openFraction`.
  openFractions = {},
  hemMass = 0.045,
  facade = CURTAIN_FACADE,
  hardware = CURTAIN_HARDWARE,
} = {}) {
  const panels = [];
  const top = hardware.rodY - hardware.clipDrop;
  for (const track of tracks) {
    const span = Math.abs(track.rail.to - track.rail.from),
      rodFrom = Math.min(track.rail.from, track.rail.to) - hardware.finialOverhang,
      rodTo = Math.max(track.rail.from, track.rail.to) + hardware.finialOverhang;
    for (const panel of track.panels) {
      // The room side of the door hardware (the deepest part of the glass front), and keep-outs.
      const planes = [{ normal: [0, 0, 1], offset: facade.hardwareZ + 0.02 }];
      if (panel.keepOut?.min !== undefined) planes.push({ normal: [1, 0, 0], offset: panel.keepOut.min });
      if (panel.keepOut?.max !== undefined) planes.push({ normal: [-1, 0, 0], offset: -panel.keepOut.max });
      panels.push({
        id: panel.id,
        track: track.id,
        door: track.door,
        origin: [panel.stackX, top, hardware.rodZ],
        axis: [panel.closeToward, 0, 0],
        room: [0, 0, 1],
        closedWidth: span / 2 + overlap,
        drop: top - facade.floorY - HEM_CLEARANCE,
        top,
        fullness,
        rings,
        pinch,
        flat,
        rows,
        openFraction: openFractions[panel.id] ?? openFraction,
        hemMass,
        floorY: facade.floorY,
        planes,
        boxes: [{ min: [rodFrom - 0.3, facade.doorHead, facade.glassZ - 0.05], max: [rodTo + 0.3, facade.headTop, facade.headFaceZ] }],
        capsules: [{ a: [rodFrom, hardware.rodY, hardware.rodZ], b: [rodTo, hardware.rodY, hardware.rodZ], radius: hardware.rodRadius }],
        rod: { from: rodFrom, to: rodTo, y: hardware.rodY, z: hardware.rodZ },
        hardware,
        fabric,
      });
    }
  }
  return panels;
}

// Wind for the curtains by the glass front: the shared six-mode room field (wind-field.mjs) leaks in
// weakly everywhere; an open doorway adds a jet driven by the outdoor field's onshore component
// through a soft clamp, carrying eddies through the doorway; closed glass carries a thin convective
// boundary layer (rising along sun-warmed glass, falling along cold glass). The jet profile is an
// authored engineering sketch, not a ventilation or CFD model.
//
// With `coast` (a createCoastWind instance, normally the scene's coastWind) the draft reads the coast's
// one wind: the room leak is the coast's indoor air (its share rises with the doors open), and each
// doorway jet is `coastDoorGain` times the soft-clamped onshore component of the outdoor breeze 0.8 m
// outside the door, gusts included (about 1.2 m/s in an October afternoon's 2.3 m/s onshore flow), so a
// gust front that has crossed the water and the terrace arrives at the curtains when it meets the
// glass, lifts them over its 1.2 s rise and lets them settle over its 3.5 s decay. A breeze blowing
// off the land feeds no jet.
//
// The eddies are the room field's six divergence-free modes at 3.2 times their wavenumber
// (wavelengths 0.4-2.2 m), advected into the room at `advection` m/s: x - advection t z_hat, so a
// puff that lifts one fold reaches the next fold a moment later. Their amplitude is `turbulence`
// times the local jet; being a curl field they stay divergence-free.
//
// `sample(x, y, z, t, out)` is the plain interface. `sampleBatch(points, count, clock, out)` fills
// `out` (3 x count, m/s) for `points` (3 x count, m) at time clock[0] without allocating; the cloth
// uses it automatically because `sample.sampleBatch` points to it.
export function createFacadeDraft({
  field = sampleWind,
  fieldOptions = DEFAULT_WIND,
  coast = null,
  doors = CURTAIN_FACADE.doors,
  glassZ = CURTAIN_FACADE.doorFaceZ,
  roomLeak = 0.25,
  onshore = 0.6,
  doorGain = 2.4,
  coastDoorGain = 0.55,
  turbulence = 0.5,
  eddyScale = 3.2,
  advection = 0.8,
  softness = 0.25,
  reach = 1.8,
  glassDraft = 0.05,
  seed = 11,
} = {}) {
  const random = mulberry32(seed);
  const D = doors.length,
    ids = doors.map((door) => door.id);
  // Per door: x0, x1, slideX, rate, offset, open a, open b, jet speed, lateral drift, eddy phase.
  const STRIDE = 10,
    door = new Float64Array(D * STRIDE);
  doors.forEach((d, i) => {
    const o = i * STRIDE;
    door[o] = d.opening[0];
    door[o + 1] = d.opening[1];
    door[o + 2] = d.slideX;
    door[o + 3] = d.rate ?? 1;
    door[o + 9] = random() * TAU;
  });
  // The shared field, evaluated inline exactly as sampleWind does (same operations, same order).
  const inline = field === sampleWind,
    mean = Float64Array.from(fieldOptions.mean ?? DEFAULT_WIND.mean),
    gust = fieldOptions.gust ?? DEFAULT_WIND.gust,
    windRate = fieldOptions.rate ?? 1,
    modes = new Float64Array(WIND_MODES.length * 8),
    // The doorway eddies: wavevector k (scaled) and velocity direction times weight, per mode.
    eddies = new Float64Array(WIND_MODES.length * 7);
  WIND_MODES.forEach((m, i) => {
    modes.set([...m.k, ...m.velocity], i * 8);
    modes[i * 8 + 6] = m.phase;
    modes[i * 8 + 7] = m.rate;
    const speed = Math.hypot(...m.velocity) || 1;
    eddies.set(
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
  const doorPoints = new Float64Array(3 * D),
    doorField = new Float64Array(3 * D),
    // [time of the cached jets, glass draft speed]
    cache = Float64Array.of(NaN, glassDraft),
    one = { points: new Float64Array(3), out: new Float64Array(3), clock: new Float64Array(1) },
    fieldPoint = [0, 0, 0],
    fieldOut = [0, 0, 0];
  // In coast mode the coast's indoor air already carries its own share of the breeze.
  const leak = coast ? 1 : roomLeak,
    inflowOffset = coast ? 0 : onshore,
    jetGain = coast ? coastDoorGain : doorGain,
    driftGain = coast ? 0.25 * coastDoorGain : 0.6;

  // `outdoor` selects the coast's open-air wind (the doorway jets) over its indoor air (the room).
  function evaluateField(points, count, out, clock, outdoor = false) {
    const t = clock[0];
    if (coast) {
      const sampler = outdoor ? coast.sample : coast.sampleIndoor;
      for (let i3 = 0; i3 < 3 * count; i3 += 3) {
        sampler(points[i3], points[i3 + 1], points[i3 + 2], t, fieldOut);
        out[i3] = fieldOut[0];
        out[i3 + 1] = fieldOut[1];
        out[i3 + 2] = fieldOut[2];
      }
      return;
    }
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
    evaluateField(doorPoints, D, doorField, clock, true);
    for (let i = 0, o = 0; i < D; i++, o += STRIDE) {
      if (door[o + 6] - door[o + 5] < 0.02) {
        door[o + 7] = 0;
        door[o + 8] = 0;
        continue;
      }
      // Soft clamp: a lull lets the panel fall back; the jet does not reverse into suction.
      const inflow = inflowOffset + doorField[3 * i + 2],
        soft = inflow > 2 ? inflow : 0.12 * Math.log1p(Math.exp(inflow / 0.12));
      // A door part way open passes a narrower, weaker jet.
      const opening = Math.min(1, (door[o + 6] - door[o + 5]) / 0.9);
      door[o + 7] = jetGain * soft * (0.4 + 0.6 * opening);
      door[o + 8] = driftGain * doorField[3 * i];
    }
  }

  function sampleBatch(points, count, clock, out) {
    if (clock[0] !== cache[0]) updateJets(clock);
    evaluateField(points, count, out, clock);
    const t = clock[0],
      draft = cache[1],
      advected = advection * t;
    for (let i3 = 0; i3 < 3 * count; i3 += 3) {
      const x = points[i3],
        y = points[i3 + 1],
        z = points[i3 + 2];
      let vx = leak * out[i3],
        vy = leak * out[i3 + 1],
        vz = leak * out[i3 + 2],
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
        let foot = y / 0.6,
          top = (y - 3.0) / 0.4;
        foot = foot < 0 ? 0 : foot > 1 ? 1 : foot;
        top = top < 0 ? 0 : top > 1 ? 1 : top;
        const height = (0.55 + 0.45 * foot * foot * (3 - 2 * foot)) * (1 - top * top * (3 - 2 * top));
        const jet = (speed * lateral * height) / (1 + depth / reach);
        const half = b - a > 0.2 ? 0.5 * (b - a) : 0.1;
        let across = (x - 0.5 * (a + b)) / half;
        across = across < -1 ? -1 : across > 1 ? 1 : across;
        vz += jet;
        vx += lateral * door[o + 8] + 0.25 * jet * across;
        vy += 0.08 * jet;
        // Eddies carried through the doorway with the air.
        const e = turbulence * jet,
          zz = z - advected,
          phase = door[o + 9];
        for (let m7 = 0; m7 < eddies.length; m7 += 7) {
          const s = e * Math.sin(x * eddies[m7] + y * eddies[m7 + 1] + zz * eddies[m7 + 2] + eddies[m7 + 6] + phase);
          vx += eddies[m7 + 3] * s;
          vy += eddies[m7 + 4] * s;
          vz += eddies[m7 + 5] * s;
        }
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
      method: coast
        ? "coast indoor air + soft-clamped jets of the coast's onshore breeze with advected curl eddies + glass boundary layer"
        : "room field leak + soft-clamped doorway jets with advected curl eddies + glass boundary layer",
      coast: Boolean(coast),
      roomLeak: leak,
      onshoreMetersPerSecond: inflowOffset,
      doorGain: jetGain,
      turbulence,
      eddyWavelengths: WIND_MODES.map((m) => m.wavelength / eddyScale),
      advectionMetersPerSecond: advection,
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

// The curtains. `panels` are specs (see facadeCurtainPanels); `wind` is `(x, y, z, t, out) => out` in
// m/s, preferably with a `sampleBatch(points, count, clock, out)` method (the facade draft's has one),
// which keeps a step allocation-free. Each panel is its own island in cloth-solver.mjs, so a panel off
// screen or asleep costs nothing. Fixed steps with an accumulator; update(dt, time) moves the steps'
// time base so the frame's last step lands on the scene's clock.
export function createCurtainCloth({
  panels: specs = [],
  wind = null,
  seed = 1,
  fixedStep = 1 / 30,
  substeps = 6,
  maxStepsPerUpdate = 2,
  maxFrameDelta = 0.1,
  reducedMotion = false,
  startTime = 0,
  drawSpeed = 0.45,
  settleSeconds = 1.5,
  // A panel in the house's own air sleeps below 0.18 m/s (a lean of about 0.015 rad) and wakes above
  // 0.23 m/s, so the panels by fixed glass rest in the lulls and stir in the gusts.
  sleepWind = 0.18,
  profile = false,
} = {}) {
  if (!Array.isArray(specs) || !specs.length) throw new RangeError("curtain cloth needs at least one panel");
  if (!(fixedStep > 0) || !Number.isInteger(substeps) || substeps < 1 || !Number.isInteger(maxStepsPerUpdate) || maxStepsPerUpdate < 1)
    throw new RangeError("invalid curtain time step");
  // [accumulator, interpolation alpha, update ms]
  const clock = new Float64Array(3);
  let reduced = Boolean(reducedMotion),
    // Panels still waiting for their starting drape (settlePending).
    pendingCount = 0,
    steps = 0,
    timeBase = startTime,
    lastTime = startTime,
    revision = 0,
    windSource = wind;
  const ids = new Map();
  const panels = specs.map((spec, index) => buildPanel(spec, index));

  function buildPanel(spec, index) {
    const fabric = { ...SHEER_LINEN, ...(spec.fabric ?? {}) },
      rings = spec.rings ?? 6,
      pinch = spec.pinch ?? 1,
      flat = spec.flat ?? 3,
      stride = 2 * pinch + 1 + flat,
      C = (rings - 1) * stride + 2 * pinch + 1,
      R = spec.rows ?? 25,
      hardware = spec.hardware ?? CURTAIN_HARDWARE;
    if (!Number.isInteger(rings) || rings < 2) throw new RangeError("curtain panels need at least two rings");
    if (!Number.isInteger(R) || R < 4) throw new RangeError("curtain rows must be an integer >= 4");
    const id = String(spec.id ?? `panel-${index}`);
    if (ids.has(id)) throw new RangeError(`duplicate curtain panel id ${id}`);
    let ax = spec.axis?.[0] ?? 1,
      az = spec.axis?.[2] ?? 0;
    const axisLength = Math.hypot(ax, az);
    if (!(axisLength > 0)) throw new RangeError("curtain rail axis must be horizontal and nonzero");
    ax /= axisLength;
    az /= axisLength;
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
      fullness = spec.fullness ?? 2,
      W = fullness * closedWidth,
      hx = W / (C - 1),
      vy = drop / (R - 1),
      stackWidth = (rings - 1) * hardware.ringPitchMin;
    if (!(closedWidth > stackWidth) || !(fullness >= 1) || !(drop > 0))
      throw new RangeError("curtain panel needs fullness >= 1 and a closed width wider than its stack");
    const open = clamp(Number(spec.openFraction) || 0, 0, 1);
    const origin = spec.origin ?? [0, 2.5, 0];
    const P = {
      id,
      index,
      track: spec.track ?? null,
      door: spec.door ?? null,
      C,
      R,
      rings,
      pinch,
      flat,
      stride,
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
      fabric,
      hardware,
      open,
      target: open,
      drawSpeed: Number(spec.drawSpeed ?? drawSpeed),
      active: true,
      heading: new Float64Array(3 * C),
      below: new Float64Array(3 * C),
      ringS: new Float64Array(rings),
      rod: spec.rod ?? null,
    };
    // Initial heading at the starting fraction; every column hangs straight down from it.
    layout(P, P.open, P.below, P.ringS, true);
    layout(P, P.open, P.heading, P.ringS);
    const b = clothBuilder();
    const grid = b.grid({
      id,
      columns: C,
      rows: R,
      width: W,
      height: drop,
      fabric,
      hemRows: 1,
      hemMass: spec.hemMass ?? 0.045,
      // The heading tape's lower edge and the doubled hem are stiffer in bending.
      bendScale: (r) => (r <= 1 ? 8 : r >= R - 1 ? 6 : 1),
      place: (u, v, c, r) => (r === 0 ? [P.heading[3 * c], P.oy, P.heading[3 * c + 2]] : [P.below[3 * c], P.oy - v, P.below[3 * c + 2]]),
    });
    // The heading row is the stiff tape: each ring's clip pinches 2p + 1 columns, and the tape between
    // two pinches bows as a half sine at its own length (layout). Rows below are free.
    P.pinned = [];
    for (let c = 0; c < C; c++) {
      b.pin(grid.index(c, 0));
      P.pinned.push(c);
    }
    // Long-range attachments: no particle strays farther from its column's top than the fabric between.
    for (let r = 1; r < R; r++) for (let c = 0; c < C; c++) b.tether(grid.index(c, r), grid.index(c, 0), r * vy);
    // Fold order along the rod: the same phase of neighbouring bays stays at least a fraction of the
    // current ring pitch apart, so a gathered stack's layers never cross.
    const axis = [ax, 0, az];
    for (let r = 1; r < R; r++) for (let c = 0; c + stride < C; c++) b.order(grid.index(c, r), grid.index(c + stride, r), axis, 1);
    P.model = b.build();
    P.grid = grid;
    P.island = createClothIsland(P.model, {
      id,
      fixedStep,
      substeps,
      wind: windSource,
      seed: seed * 977 + index * 131,
      sleepWind,
      settleSeconds,
      colliders: { planes: spec.planes ?? [], boxes: spec.boxes ?? [], capsules: spec.capsules ?? [], floorY: (spec.floorY ?? 0) + 0.004 },
      drive: () => drive(P),
    });
    P.island.jitter(0.0006);
    P.index16 = Uint16Array.from(P.island.triangles);
    ids.set(id, P);
    // A composed drape from the start, so a panel never visibly relaxes from straight columns when it
    // first comes into view; the breeze wakes it. One second of damped relaxation reaches rest from the
    // hanging columns. Under reduced motion it happens now; otherwise settlePending does it later, so the
    // page's loading task stays short: the rig calls it on background tasks while the page loads, and
    // update() settles any panel still pending, one a step.
    P.pending = true;
    pendingCount++;
    if (reduced) settle(P, Math.min(1, settleSeconds));
    return P;
  }

  function ringColumn(P, k) {
    return P.pinch + k * P.stride;
  }

  // Heading points for open fraction o: rings evenly spaced from the stack end; each pinches 2p + 1
  // columns within its clip's jaw (a W: the outer columns toward the room, the middle one toward the
  // glass); the free columns of each bay at equal arc length on a half-sine bow whose length is the bay's
  // fabric, alternately to the room and to the glass. Writes ring positions along the rod into `ringS`.
  function layout(P, o, out, ringS, relaxed = false) {
    const span = P.closedWidth * (1 - o) + P.stackWidth * o,
      pitch = span / (P.rings - 1),
      p = P.pinch,
      // Under the clip the pinched fabric fans out toward its own width (the drape's starting rows).
      jaw = relaxed ? Math.min(0.42 * pitch, 0.8 * p * P.hx) : P.hardware.pinchHalfWidth;
    for (let k = 0; k < P.rings; k++) ringS[k] = k * pitch;
    const put = (c, s, d) => {
      out[3 * c] = P.ox + P.ax * s + P.rx * d;
      out[3 * c + 1] = P.oy;
      out[3 * c + 2] = P.oz + P.az * s + P.rz * d;
    };
    for (let k = 0; k < P.rings; k++) {
      const rc = ringColumn(P, k);
      for (let j = -p; j <= p; j++) put(rc + j, ringS[k] + (p ? (jaw * j) / p : 0), relaxed ? 0 : j === 0 ? -0.003 : 0.006);
      if (k === P.rings - 1) break;
      // The bay to the next ring: from this pinch's last column to the next pinch's first.
      const s0 = ringS[k] + jaw,
        s1 = ringS[k + 1] - jaw,
        chord = Math.max(1e-4, s1 - s0),
        fabric = (P.flat + 1) * P.hx,
        m = foldAmplitude(fabric / chord),
        side = k % 2 === 0 ? 1 : -1;
      foldArc[0] = 0;
      for (let q = 1; q <= FOLD_SAMPLES; q++) {
        const u = (Math.PI * (q - 0.5)) / FOLD_SAMPLES,
          cu = Math.cos(u);
        foldArc[q] = foldArc[q - 1] + Math.sqrt(1 + m * m * cu * cu);
      }
      const total = foldArc[FOLD_SAMPLES],
        amplitude = (m * chord) / Math.PI;
      for (let f = 1, q = 1; f <= P.flat; f++) {
        const want = (total * f) / (P.flat + 1);
        while (q < FOLD_SAMPLES && foldArc[q] < want) q++;
        const t = foldArc[q] > foldArc[q - 1] ? (want - foldArc[q - 1]) / (foldArc[q] - foldArc[q - 1]) : 0,
          u = (Math.PI * (q - 1 + clamp(t, 0, 1))) / FOLD_SAMPLES;
        put(rc + p + f, s0 + (u / Math.PI) * chord, side * amplitude * Math.sin(u));
      }
    }
  }

  // The lead ring eases toward its target at up to drawSpeed m/s. Returns whether it moved.
  function advanceOpen(P) {
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

  // Each step: move the rings, and with them the clips' targets and the fold order's gap.
  function drive(P) {
    advanceOpen(P);
    layout(P, P.open, P.heading, P.ringS);
    const island = P.island;
    for (const c of P.pinned) island.setTarget(P.grid.index(c, 0), P.heading[3 * c], P.heading[3 * c + 1], P.heading[3 * c + 2]);
    island.state.orderScale = 0.6 * (P.ringS[1] - P.ringS[0]);
  }

  // A fresh straight drape at the current fraction: clips placed, columns hanging from the heading.
  function drape(P) {
    layout(P, P.open, P.below, P.ringS, true);
    layout(P, P.open, P.heading, P.ringS);
    const island = P.island;
    for (const c of P.pinned) island.placeTarget(P.grid.index(c, 0), P.heading[3 * c], P.heading[3 * c + 1], P.heading[3 * c + 2]);
    island.state.orderScale = 0.6 * (P.ringS[1] - P.ringS[0]);
    island.reset((i, out) => {
      const c = i % P.C,
        r = Math.floor(i / P.C),
        from = r === 0 ? P.heading : P.below;
      out[0] = from[3 * c];
      out[1] = P.oy - r * P.vy;
      out[2] = from[3 * c + 2];
    });
    island.jitter(0.0004);
  }

  // Reduced motion and composed stills: the target drape, relaxed without wind, then held.
  function settle(P, seconds = settleSeconds) {
    P.open = P.target;
    drape(P);
    P.island.settle(seconds);
    if (P.pending) pendingCount--;
    P.pending = false;
    revision++;
  }

  // Settles up to `limit` panels still waiting for their starting drape, the active ones first, at
  // their current fraction (a target set meanwhile is then drawn by the rings).
  function settlePending(limit = 1) {
    let done = 0;
    for (const active of [true, false])
      for (const P of panels) {
        if (done >= limit) return done;
        if (!P.pending || P.active !== active) continue;
        const target = P.target;
        P.target = P.open;
        settle(P, Math.min(1, settleSeconds));
        P.target = target;
        if (!reduced) P.island.state.settled = false;
        if (target !== P.open) P.island.wake();
        done++;
      }
    return done;
  }

  function panelOf(id) {
    const P = typeof id === "number" ? panels[id] : ids.get(id);
    if (!P) throw new RangeError(`unknown curtain panel ${id}`);
    return P;
  }

  // `time` (optional, seconds) is the scene's clock at the end of this frame. With it the steps sample
  // the wind at the scene's own instants, so a gust reaches the cloth when it reaches everything else
  // even after dropped backlog or frames the caller skipped; without it the solver keeps its own clock.
  function update(dt, time) {
    if (!(dt > 0)) return api;
    if (reduced) {
      for (const P of panels) if (!P.island.state.settled || P.open !== P.target) settle(P);
      clock[1] = 1;
      return api;
    }
    const started = profile ? performance.now() : 0;
    clock[0] += dt < maxFrameDelta ? dt : maxFrameDelta;
    if (time !== undefined && Number.isFinite(time)) {
      let due = 0;
      for (let backlog = clock[0]; backlog >= fixedStep && due < maxStepsPerUpdate; backlog -= fixedStep) due++;
      if (due) timeBase = time - (steps + due - 1) * fixedStep;
    }
    let taken = 0;
    while (clock[0] >= fixedStep && taken < maxStepsPerUpdate) {
      lastTime = timeBase + steps * fixedStep;
      // One panel still waiting for its starting drape settles per step (not per call, so how a frame's
      // time is split does not change the result).
      if (pendingCount) settlePending(1);
      for (let k = 0; k < panels.length; k++) {
        const P = panels[k];
        if (!P.active) continue;
        if (P.island.step(lastTime)) revision++;
      }
      steps++;
      taken++;
      clock[0] -= fixedStep;
    }
    // Beyond the step budget, drop the backlog instead of spiralling.
    if (clock[0] >= fixedStep) clock[0] = fixedStep * 0.999;
    clock[1] = clock[0] / fixedStep;
    if (profile && taken) clock[2] = performance.now() - started;
    return api;
  }

  // Interpolated positions, normals and weft tangents into Float32Arrays of 3 x count.
  function writePanel(id, position, normal = null, tangent = null) {
    const P = panelOf(id);
    P.island.writePositions(position, P.island.state.sleeping ? 1 : clock[1]);
    if (normal) P.island.writeFrame(position, normal, tangent);
    return position;
  }

  // Ring centres on the rod (x, y, z per ring) for the current pose.
  function writeRings(id, out) {
    const P = panelOf(id),
      h = P.hardware,
      drop = h.ringRadius - h.ringTube - h.rodRadius;
    for (let k = 0; k < P.rings; k++) {
      const s = P.ringS[k];
      out[3 * k] = P.ox + P.ax * s;
      out[3 * k + 1] = h.rodY - drop;
      out[3 * k + 2] = P.oz + P.az * s;
    }
    return out;
  }

  function gathered(P) {
    return Math.abs(P.ringS[P.rings - 1] - P.ringS[0]);
  }

  const views = panels.map((P) =>
    Object.freeze({
      id: P.id,
      track: P.track,
      door: P.door,
      columns: P.C,
      rows: P.R,
      count: P.island.count,
      rings: P.rings,
      pinch: P.pinch,
      index: P.index16,
      uv: P.island.uv,
      positions: P.island.positions,
      fabricSize: Object.freeze([P.W, P.drop]),
      origin: Object.freeze([P.ox, P.oy, P.oz]),
      axis: Object.freeze([P.ax, 0, P.az]),
      room: Object.freeze([P.rx, 0, P.rz]),
      closedWidth: P.closedWidth,
      stackWidth: P.stackWidth,
      rod: P.rod,
      // A conservative bound for culling: the panel's hanging box widened by the farthest billow.
      boundingSphere: Object.freeze({
        center: Object.freeze([P.ox + P.ax * 0.5 * P.closedWidth, P.oy - 0.5 * P.drop, P.oz + P.az * 0.5 * P.closedWidth]),
        radius: Math.hypot(0.5 * P.closedWidth, 0.5 * P.drop) + 0.4 * P.drop,
      }),
    })
  );

  const api = {
    panels: views,
    update,
    settlePending,
    get pending() {
      return pendingCount;
    },
    writePanel,
    writeRings,
    get revision() {
      return revision;
    },
    panel: (id) => views[panelOf(id).index],
    // The panel's solver island (cloth-solver.mjs), for evidence and tests.
    island: (id) => panelOf(id).island,
    // 0 closed (spread across the rail) .. 1 open (gathered at the stack end). The lead ring travels at
    // drawSpeed m/s unless `immediate` (a straight drape at once) or `compose` (the settled drape at
    // once, for a paused or preview still); reduced motion always composes.
    setOpenFraction(id, fraction, { immediate = false, compose = false } = {}) {
      const P = panelOf(id),
        next = clamp(Number(fraction) || 0, 0, 1);
      if (next === P.target && !immediate && !compose) return api;
      P.target = next;
      if (reduced || compose) {
        settle(P);
        return api;
      }
      if (immediate) {
        // Off screen: the new drape relaxed for a second, so it is near rest when it is seen.
        settle(P, 1);
        P.island.state.settled = false;
      }
      P.island.wake();
      return api;
    },
    openFraction: (id) => panelOf(id).open,
    targetOpenFraction: (id) => panelOf(id).target,
    setWindScale(id, scale) {
      panelOf(id).island.state.windScale = Math.max(0, Number(scale) || 0);
      return api;
    },
    // Hold a panel still while nobody can see it (its draw target still applies on its next step).
    setActive(id, flag) {
      panelOf(id).active = Boolean(flag);
      return api;
    },
    isActive: (id) => panelOf(id).active,
    setWind(next) {
      windSource = next;
      for (const P of panels) P.island.setWind(next);
      return api;
    },
    setReducedMotion(flag) {
      const next = Boolean(flag);
      if (next === reduced) return api;
      reduced = next;
      for (const P of panels) {
        if (reduced) settle(P);
        else P.island.wake();
      }
      clock[0] = 0;
      clock[1] = reduced ? 1 : 0;
      return api;
    },
    wake(id) {
      if (!reduced) for (const P of id === undefined ? panels : [panelOf(id)]) P.island.wake();
      return api;
    },
    evidence() {
      let kinetic = 0,
        potential = 0,
        bending = 0,
        maxError = 0,
        particles = 0,
        constraints = 0;
      const rows = panels.map((P) => {
        // Stretch only: a compressed weft edge is a fold, not an error.
        const e = P.island.energies(),
          error = P.island.strain(null, true),
          counts = P.island.counts;
        kinetic += e.kinetic;
        potential += e.potential;
        bending += e.bend;
        maxError = Math.max(maxError, error);
        particles += counts.particles;
        constraints += counts.distance + counts.bending + counts.tethers + counts.orders;
        return {
          id: P.id,
          particles: counts.particles,
          columns: P.C,
          rows: P.R,
          rings: P.rings,
          openFraction: P.open,
          targetOpenFraction: P.target,
          gatheredWidth: gathered(P),
          sleeping: P.island.state.sleeping,
          active: P.active,
          windMetersPerSecond: P.island.state.windMax,
          windScale: P.island.state.windScale,
          maxConstraintError: error,
          kineticEnergy: e.kinetic,
          potentialEnergy: e.potential,
          bendingEnergy: e.bend,
          steps: P.island.state.steps,
        };
      });
      return {
        method:
          "XPBD small steps (cloth-solver.mjs): stretch/shear distance constraints, isometric bending, long-range attachments to the ring clips, fold ordering, contacts with friction, per-triangle flat-plate air force",
        fixedStep,
        substeps,
        steps,
        simulatedSeconds: steps * fixedStep,
        lastStepTime: lastTime,
        reducedMotion: reduced,
        particles,
        constraints,
        maxConstraintError: maxError,
        kineticEnergy: kinetic,
        potentialEnergy: potential,
        bendingEnergy: bending,
        energy: kinetic + potential + bending,
        sleeping: panels.every((P) => P.island.state.sleeping),
        openFractions: Object.fromEntries(panels.map((P) => [P.id, P.open])),
        lastUpdateMilliseconds: profile ? clock[2] : null,
        allocations: panels.reduce((sum, P) => sum + P.island.allocations, 0),
        panels: rows,
      };
    },
  };
  return api;
}

// One call for the facade: the four panels, the facade draft, and a per-frame hook that takes the
// controller's door offsets. `doors` maps door id to the panel's slide offset in metres; `time` is the
// scene's clock (see the cloth's update). Pass `draft: { coast }` for the coast's wind.
export function createFacadeCurtains({ panels = {}, draft = {}, ...cloth } = {}) {
  const facadeDraft = createFacadeDraft(draft);
  const solver = createCurtainCloth({ ...cloth, panels: facadeCurtainPanels(panels), wind: facadeDraft.sample });
  return {
    cloth: solver,
    draft: facadeDraft,
    update(dt, doors = null, time) {
      if (doors) for (const id in doors) facadeDraft.setDoor(id, doors[id]);
      return solver.update(dt, time);
    },
  };
}

// When the curtains are drawn (Sirui, 2026-10-15). Panels are gathered by day, so the sea stays in
// view and the doorway panels billow in the breeze. Against a low western sun they draw part way, the
// panels over fixed glass deeper than the doorway ones, which keeps the breeze coming in and leaves
// gaps where the sun falls through onto the floor. At night, with the house lit and the doors shut,
// and while Sirui sleeps, they are drawn closed, except where his evening activity looks out to sea:
// the room he is in keeps the panel across its camera's line of sight open (the kitchen and lounge
// cameras look in through the door openings), so dinner and watching the Pacific stay visible. By day
// the room a visitor is looking into (`visit`) keeps that panel open too, and its neighbour shows the
// drawn, sunlit sheer.
//
// CURTAIN_DRAW: how far each panel draws across in full glare (1 = closed).
export const CURTAIN_DRAW = Object.freeze({ "kitchen-south": 0.55, "kitchen-north": 0.8, "lounge-south": 0.75, "lounge-north": 0.5 });
// The panel that crosses each room camera's line of sight when drawn: the kitchen camera's sightline
// crosses the rail near x -2.0 m, the lounge camera's near x 2.9 m.
export const CURTAIN_VIEW_PANELS = Object.freeze({ kitchen: "kitchen-south", lounge: "lounge-north" });
// A view panel never draws past this open fraction while its room is occupied by day.
export const CURTAIN_VIEW_OPEN = 0.8;
// The sun's glare through the west-facing glass: sun low (altitude under 32°, full under 16°), above
// the horizon, and standing out to sea rather than along the front.
export function curtainGlare(daylight) {
  if (!daylight) return 0;
  const [north, , east] = daylight.direction,
    horizontal = Math.hypot(north, east),
    facing = horizontal > 1e-6 ? -east / horizontal : 0,
    a = daylight.altitude;
  return smoothstepRange(32, 16, a) * smoothstepRange(-1, 3, a) * smoothstepRange(0.3, 0.75, facing);
}
const smoothstepRange = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
// `daylight` is daylight.mjs's coastalDaylight; `activity` and `room` the routine's; `visit` the room the
// camera is visiting, if it is one. Open fractions are quantized to 0.05, so a creeping sun moves the
// rings in small steps and a still re-composes rarely. The night threshold is the facade doors' own
// (controller.mjs), so curtains and doors change together.
export function curtainSchedule({ activity = null, room = null, visit = null, daylight = null } = {}, panels = Object.keys(CURTAIN_DRAW)) {
  const view = CURTAIN_VIEW_PANELS[room] ?? null,
    visited = CURTAIN_VIEW_PANELS[visit] ?? null,
    asleep = activity === "sleep",
    night = !daylight || daylight.daylight <= 0.3,
    glare = asleep || night ? 0 : curtainGlare(daylight),
    state = asleep ? "asleep" : night ? "night" : glare > 0.02 ? "low sun" : "day",
    fractions = {};
  for (const id of panels) {
    let open;
    if (state === "asleep") open = 0;
    else if (state === "night") open = id === view ? 1 : 0;
    else {
      open = 1 - glare * (CURTAIN_DRAW[id] ?? 0.6);
      if (id === view || id === visited) open = Math.max(open, CURTAIN_VIEW_OPEN);
    }
    fractions[id] = Math.round(open * 20) / 20;
  }
  return { state, glare, view, visited, fractions };
}
