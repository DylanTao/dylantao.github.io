import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { ShaderLib, ShaderChunk } from "../assets/js/three.module.min.js";
import { DEFAULT_WIND, sampleWind, createCoastWind } from "../assets/js/home-scene/wind-field.mjs";
import {
  CURTAIN_FACADE,
  CURTAIN_HARDWARE,
  CURTAIN_TRACKS,
  SHEER_LINEN,
  createCurtainCloth,
  createFacadeCurtains,
  createFacadeDraft,
  facadeCurtainPanels,
} from "../assets/js/home-scene/curtain-cloth.mjs";
import {
  SHEER_FABRIC_NAME,
  createCurtainMeshes,
  createSheerFabric,
  linenDensity,
  patchSheerShader,
  patchSheerShadowShader,
  weaveOpenness,
  weaveYarnRatios,
} from "../assets/js/home-scene/sheer-fabric.mjs";

const STEP = 1 / 60;
const run = (cloth, seconds, dt = STEP, t0 = 0) => {
  for (let k = 0, n = Math.round(seconds / dt); k < n; k++) cloth.update(dt, t0 + (k + 1) * dt);
};
// Strong, gusty air blowing into the room: up to about 3.6 m/s, with crosswind and lift.
const gusty =
  (scale = 1) =>
  (x, y, z, t, out) => {
    const g = 0.5 + 0.5 * Math.sin(1.7 * t) * Math.sin(0.43 * t + 0.4 * x);
    out[0] = 0.6 * scale * Math.sin(0.9 * t + y);
    out[1] = 0.2 * scale * Math.sin(2.3 * t + x);
    out[2] = scale * (1.2 + 2.4 * g);
    return out;
  };
const facade = (overrides = {}) => {
  const panels = facadeCurtainPanels();
  panels[0].openFraction = 0.5;
  panels[3].openFraction = 1;
  return createCurtainCloth({ panels, ...overrides });
};
const everyPosition = (cloth, fn) => {
  for (const panel of cloth.panels) for (let i = 0; i < panel.count; i++) fn(panel, i, panel.positions);
};

test("the weave keeps its length: small stretch in still air and the doorway draft, bounded in a gale", () => {
  const still = facade();
  run(still, 3);
  // Six substeps of one pass each leave a few percent of local stretch near the clips of a 3 m drop.
  assert.ok(still.evidence().maxConstraintError < 0.06, `still-air stretch ${still.evidence().maxConstraintError}`);

  // The facade's own doorway draft, both doors open: the realistic case.
  const sim = createFacadeCurtains({ seed: 5 });
  sim.draft.setDoorOpen("kitchen", 1);
  sim.draft.setDoorOpen("lounge", 1);
  sim.cloth.setOpenFraction("kitchen-south", 0.5, { immediate: true });
  let realistic = 0;
  for (let f = 0; f < 600; f++) {
    sim.update(STEP, null, (f + 1) * STEP);
    if (f % 10 === 0) realistic = Math.max(realistic, sim.cloth.evidence().maxConstraintError);
  }
  assert.ok(realistic < 0.08, `doorway-draft stretch ${realistic}`);

  const gale = facade({ wind: gusty(1.5) });
  let worst = 0;
  for (let f = 0; f < 480; f++) {
    gale.update(STEP, (f + 1) * STEP);
    if (f % 15 === 0) worst = Math.max(worst, gale.evidence().maxConstraintError);
  }
  // A 5 m/s gale indoors (twice the strongest doorway jet) fills the panels like sails; one pass per
  // substep cannot hold a sail inextensible, but nothing runs away.
  assert.ok(worst < 0.45, `gale stretch ${worst}`);
});

test("nothing explodes in a gale, and the energy decays once it stops", () => {
  const cloth = facade({ wind: gusty(2) });
  let peak = 0;
  for (let f = 0; f < 360; f++) {
    cloth.update(STEP, (f + 1) * STEP);
    if (f % 10 === 0) peak = Math.max(peak, cloth.evidence().kineticEnergy);
  }
  everyPosition(cloth, (panel, i, p) => {
    for (let a = 0; a < 3; a++) assert.ok(Number.isFinite(p[3 * i + a]), `${panel.id} position is finite`);
    // A gale may lift the hem into the double-height room, never through the floor or far up.
    assert.ok(p[3 * i + 1] > -0.01 && p[3 * i + 1] < 3.6, `${panel.id} stays between the floor and 3.6 m (${p[3 * i + 1]})`);
  });
  cloth.setWind(null);
  for (let f = 0; f < 60 * 10; f++) cloth.update(STEP, 6 + (f + 1) * STEP);
  const after = cloth.evidence();
  assert.ok(after.kineticEnergy < 0.02 * peak, `kinetic ${after.kineticEnergy} J after 10 s of calm (peak ${peak} J)`);
  for (let f = 0; f < 60 * 30 && !cloth.evidence().sleeping; f++) cloth.update(STEP, 16 + (f + 1) * STEP);
  assert.ok(cloth.evidence().sleeping, "every panel sleeps once the air is still");
});

test("the rings stay on the rod, in order, and each clip pinches its columns within its jaw", () => {
  const cloth = facade();
  const rings = new Float64Array(3 * 6);
  const check = () => {
    for (const panel of cloth.panels) {
      cloth.writeRings(panel.id, rings);
      const { positions: p, origin: o, axis: a, room, columns, closedWidth, pinch } = panel;
      let previous = -Infinity;
      for (let k = 0; k < panel.rings; k++) {
        const along = (rings[3 * k] - o[0]) * a[0] + (rings[3 * k + 2] - o[2]) * a[2];
        assert.ok(
          Math.abs(rings[3 * k + 2] - CURTAIN_HARDWARE.rodZ) < 1e-12 && Math.abs(rings[3 * k + 1] - CURTAIN_HARDWARE.rodY) < 0.01,
          `${panel.id} ring off the rod`
        );
        assert.ok(along >= previous + CURTAIN_HARDWARE.ringPitchMin - 1e-9 && along > -1e-9 && along < closedWidth + 1e-9, `${panel.id} ring order`);
        previous = along;
        // The heading row: the pinched columns at the ring, within the clip's jaw.
        const centre = pinch + k * (2 * pinch + 4);
        for (let j = -pinch; j <= pinch; j++) {
          const c = centre + j,
            x = p[3 * c] - rings[3 * k],
            z = p[3 * c + 2] - rings[3 * k + 2];
          assert.ok(Math.hypot(x, z) <= CURTAIN_HARDWARE.pinchHalfWidth + 0.01, `${panel.id} clip ${k} column ${c}`);
          assert.ok(Math.abs(p[3 * c + 1] - (CURTAIN_HARDWARE.rodY - CURTAIN_HARDWARE.clipDrop)) < 1e-12);
        }
      }
      // Every heading column stays on the rod line's height, within a bay's bow of it.
      for (let c = 0; c < columns; c++) {
        const across = (p[3 * c] - o[0]) * room[0] + (p[3 * c + 2] - o[2]) * room[2];
        assert.ok(Math.abs(across) < 0.15, `${panel.id} heading bows ${across} m`);
      }
    }
  };
  check();
  for (const panel of cloth.panels) cloth.setOpenFraction(panel.id, 1 - cloth.openFraction(panel.id));
  for (let f = 0; f < 240; f++) {
    cloth.update(STEP, (f + 1) * STEP);
    if (f % 6 === 0) check();
  }
});

test("openFraction slides the rings together to a stack and spreads them again, no faster than a hand", () => {
  const cloth = facade();
  const id = "kitchen-north",
    view = cloth.panel(id);
  const width = () => cloth.evidence().panels.find((p) => p.id === id).gatheredWidth;
  assert.ok(Math.abs(width() - view.closedWidth) < 1e-9);
  assert.ok(Math.abs(view.stackWidth - 5 * CURTAIN_HARDWARE.ringPitchMin) < 1e-12, "six rings touching");
  cloth.setOpenFraction(id, 1);
  let previous = width();
  for (let f = 0; f < 300; f++) {
    cloth.update(STEP, (f + 1) * STEP);
    const now = width();
    assert.ok(now <= previous + 1e-12, "gathering never reverses");
    // Steps run at 30 Hz: the lead ring moves at most drawSpeed (0.45 m/s) per step.
    assert.ok(previous - now <= 0.45 * (1 / 30) + 1e-9, `lead ring moved ${previous - now} m in a frame`);
    previous = now;
  }
  assert.ok(Math.abs(width() - view.stackWidth) < 1e-9, `stack ${width()} vs ${view.stackWidth}`);
  cloth.setOpenFraction(id, 0.5);
  run(cloth, 4, STEP, 5);
  assert.ok(Math.abs(width() - (0.5 * view.closedWidth + 0.5 * view.stackWidth)) < 1e-6);
  cloth.setOpenFraction(id, 0, { immediate: true });
  assert.ok(Math.abs(width() - view.closedWidth) < 1e-9);
});

test("a gathered stack keeps its folds in order: no bay passes through its neighbour", () => {
  const cloth = createCurtainCloth({ panels: facadeCurtainPanels({ openFraction: 1 }), wind: gusty(1.2) });
  const stride = 2 * 1 + 1 + 3;
  let worst = Infinity;
  for (let f = 0; f < 360; f++) {
    cloth.update(STEP, (f + 1) * STEP);
    if (f % 20) continue;
    for (const panel of cloth.panels) {
      const p = panel.positions,
        a = panel.axis,
        pitch = panel.stackWidth / (panel.rings - 1);
      for (let r = 1; r < panel.rows; r++)
        for (let c = 0; c + stride < panel.columns; c++) {
          const i = r * panel.columns + c,
            j = i + stride,
            along = (p[3 * j] - p[3 * i]) * a[0] + (p[3 * j + 2] - p[3 * i + 2]) * a[2];
          worst = Math.min(worst, along / pitch);
        }
    }
  }
  // The order constraint holds the same phase of neighbouring bays 0.6 ring pitches apart; a single
  // pass per substep lets a gust squeeze them, never to a crossing.
  assert.ok(worst > 0.1, `closest neighbouring bays ${worst} ring pitches apart`);
});

test("the same seed and the same frame deltas give the same cloth, bit for bit", () => {
  const deltas = [STEP, 1 / 30, 1 / 144, 0.05, STEP, 1 / 90, 0.2, STEP];
  const make = (seed) => createFacadeCurtains({ seed, draft: { seed: 3 } });
  const a = make(9),
    b = make(9),
    c = make(10);
  for (const sim of [a, b, c]) {
    sim.draft.setDoorOpen("kitchen", 1);
    sim.cloth.setOpenFraction("kitchen-south", 0.4);
    let t = 0;
    for (let k = 0; k < 120; k++) sim.update(deltas[k % deltas.length], null, (t += deltas[k % deltas.length]));
  }
  let differs = false;
  a.cloth.panels.forEach((panel, i) => {
    const other = b.cloth.panels[i].positions,
      third = c.cloth.panels[i].positions;
    for (let k = 0; k < panel.positions.length; k++) {
      assert.ok(Object.is(panel.positions[k], other[k]), `${panel.id}[${k}] differs between identical runs`);
      if (panel.positions[k] !== third[k]) differs = true;
    }
  });
  assert.ok(differs, "a different seed perturbs the drape");
  // Frame partitioning: one 1/30 s frame is two 1/60 s frames.
  const coarse = facade({ wind: gusty(1) }),
    fine = facade({ wind: gusty(1) });
  for (let k = 0; k < 60; k++) {
    coarse.update(1 / 30, (k + 1) / 30);
    fine.update(STEP, (k + 0.5) / 30);
    fine.update(STEP, (k + 1) / 30);
  }
  coarse.panels.forEach((panel, i) => assert.deepEqual(Array.from(panel.positions), Array.from(fine.panels[i].positions)));
});

test("panels fall asleep in still air, hold still, and wake for a gust or an open door", () => {
  const cloth = facade({ wind: gusty(1) });
  run(cloth, 3);
  cloth.setWind(null);
  for (let f = 0; f < 60 * 40 && !cloth.evidence().sleeping; f++) cloth.update(STEP, 3 + (f + 1) * STEP);
  const e = cloth.evidence();
  assert.ok(e.sleeping, `asleep: ${e.panels.map((p) => p.sleeping)}`);
  const frozen = cloth.panels.map((panel) => Float64Array.from(panel.positions));
  const revision = cloth.revision;
  run(cloth, 1, STEP, 60);
  cloth.panels.forEach((panel, i) => assert.deepEqual(Array.from(panel.positions), Array.from(frozen[i])));
  assert.equal(cloth.revision, revision, "nothing to upload while asleep");
  cloth.setWind(gusty(1));
  run(cloth, 0.2, STEP, 61);
  assert.ok(!cloth.evidence().sleeping);
  assert.ok(cloth.panels.some((panel, i) => panel.positions.some((v, k) => v !== frozen[i][k])));

  // At night the doors close: the draft drops under the sleep threshold and the solver stops.
  const night = createFacadeCurtains({ seed: 2 });
  run(night.cloth, 14);
  assert.ok(night.cloth.evidence().sleeping);
  night.draft.setDoorOpen("kitchen", 1);
  run(night.cloth, 0.5, STEP, 14);
  const rows = night.cloth.evidence().panels;
  assert.ok(!rows.find((p) => p.id === "kitchen-south").sleeping, "the doorway panel wakes");
  assert.ok(rows.find((p) => p.id === "lounge-north").sleeping, "a panel by shut glass sleeps on");
});

test("reduced motion returns a settled, static drape that hangs to just above the floor", () => {
  const cloth = facade({ reducedMotion: true, wind: gusty(2) });
  const still = cloth.panels.map((panel) => Float64Array.from(panel.positions));
  run(cloth, 2);
  cloth.panels.forEach((panel, i) => assert.deepEqual(Array.from(panel.positions), Array.from(still[i])));
  const e = cloth.evidence();
  assert.equal(e.kineticEnergy, 0);
  assert.ok(e.maxConstraintError < 0.06, `settled stretch ${e.maxConstraintError}`);
  assert.ok(e.reducedMotion && e.sleeping);
  for (const panel of cloth.panels) {
    // The hem hangs within a few centimetres of the floor, never on it; the weighted hem keeps it level.
    let low = Infinity,
      high = -Infinity;
    for (let c = 0; c < panel.columns; c++) {
      const y = panel.positions[3 * ((panel.rows - 1) * panel.columns + c) + 1];
      low = Math.min(low, y);
      high = Math.max(high, y);
    }
    assert.ok(low > CURTAIN_FACADE.floorY && high < 0.12, `${panel.id} hem from ${low} to ${high} m`);
  }
  // Drawing a panel jumps straight to its settled stack.
  cloth.setOpenFraction("kitchen-north", 1);
  const row = cloth.evidence().panels.find((p) => p.id === "kitchen-north");
  assert.ok(Math.abs(row.gatheredWidth - cloth.panel("kitchen-north").stackWidth) < 1e-9 && row.openFraction === 1);
  cloth.setReducedMotion(false);
  run(cloth, 0.5, STEP, 2);
  assert.ok(
    cloth.panels.some((panel, i) => panel.positions.some((v, k) => v !== still[i][k])),
    "motion resumes"
  );
});

test("a frame allocates no arrays", () => {
  const coast = createCoastWind({ minute: 15 * 60, doors: 1 });
  const sim = createFacadeCurtains({ seed: 4, draft: { coast } });
  sim.draft.setDoorOpen("kitchen", 1);
  const outputs = sim.cloth.panels.map((panel) => ["position", "normal", "tangent"].map(() => new Float32Array(3 * panel.count)));
  const rings = new Float64Array(18);
  let t = 0;
  for (let f = 0; f < 30; f++) sim.update(STEP, null, (t += STEP));
  const allocationsBefore = sim.cloth.evidence().allocations;
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
    for (let f = 0; f < 180; f++) {
      sim.update(STEP, null, (t += STEP));
      for (let k = 0; k < outputs.length; k++) {
        sim.cloth.writePanel(k, ...outputs[k]);
        sim.cloth.writeRings(k, rings);
      }
    }
  } finally {
    Object.assign(globalThis, originals);
  }
  assert.equal(constructed, 0);
  assert.equal(sim.cloth.evidence().allocations, allocationsBefore);
});

test("the facade draft blows hard through an open door, barely along closed glass, and its eddies are divergence-free", () => {
  const draft = createFacadeDraft({ seed: 1 });
  const speed = (x) => {
    let sum = 0;
    const out = [0, 0, 0];
    for (let t = 0; t < 60; t += 0.1) sum += Math.hypot(...draft.sample(x, 1.5, -4.05, t, out));
    return sum / 600;
  };
  draft.setDoorOpen("kitchen", 1);
  const doorway = speed(-2.0),
    glass = speed(-0.55);
  assert.ok(doorway > 0.6 && doorway < 3, `doorway ${doorway} m/s`);
  assert.ok(doorway > 6 * glass, `doorway ${doorway} vs glass ${glass}`);
  draft.setDoor("kitchen", -1.0); // half slid: only the gap by the post blows
  assert.ok(speed(-1.2) > 4 * speed(-2.6));
  draft.setDoorOpen("kitchen", 0);
  assert.ok(speed(-2.0) < 2 * glass + 0.02, "a shut door leaves only the weak draft");

  // With the doors shut and no boundary layer, the draft is exactly the shared field, scaled.
  const field = createFacadeDraft({ roomLeak: 0.25, glassDraft: 0 });
  const out = [0, 0, 0],
    reference = [0, 0, 0];
  for (const [p, t] of [
    [[-2, 1, -4], 3.1],
    [[3.2, 2.7, -4.2], 47],
  ]) {
    field.sample(...p, t, out);
    sampleWind(p, t, reference, DEFAULT_WIND);
    for (let a = 0; a < 3; a++) assert.ok(Math.abs(out[a] - 0.25 * reference[a]) < 1e-12);
  }
  // The batched typed-array path agrees with the plain one.
  const points = Float64Array.of(-2.2, 1.1, -4.0, 2.5, 2.9, -4.1),
    batch = new Float64Array(6);
  draft.setDoorOpen("kitchen", 1);
  draft.sampleBatch(points, 2, Float64Array.of(12.5), batch);
  for (let i = 0; i < 2; i++) {
    draft.sample(points[3 * i], points[3 * i + 1], points[3 * i + 2], 12.5, out);
    for (let a = 0; a < 3; a++) assert.ok(Math.abs(out[a] - batch[3 * i + a]) < 1e-12);
  }
  // The eddies alone (turbulence on, everything else off) have no divergence: central differences.
  const eddyOnly = createFacadeDraft({ roomLeak: 0, glassDraft: 0, turbulence: 0.5, doorGain: 2.4 });
  const plain = createFacadeDraft({ roomLeak: 0, glassDraft: 0, turbulence: 0, doorGain: 2.4 });
  for (const d of [eddyOnly, plain]) d.setDoorOpen("kitchen", 1);
  const eddy = (x, y, z, t) => {
    const a = eddyOnly.sample(x, y, z, t, [0, 0, 0]),
      b = plain.sample(x, y, z, t, [0, 0, 0]);
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  };
  // In the doorway's flat middle (no shoulders, full height, at the glass), the jet's weight is
  // uniform, so the eddy field there is a pure curl field times a constant.
  // (z just outside the doors' room face, where the jet's decay into the room has not begun).
  const h = 1e-4;
  for (const [x, y, z, t] of [
    [-2.0, 1.4, -4.43, 3],
    [-1.8, 1.8, -4.45, 17],
    [-2.3, 2.2, -4.44, 41],
  ]) {
    const div =
      (eddy(x + h, y, z, t)[0] - eddy(x - h, y, z, t)[0]) / (2 * h) +
      (eddy(x, y + h, z, t)[1] - eddy(x, y - h, z, t)[1]) / (2 * h) +
      (eddy(x, y, z + h, t)[2] - eddy(x, y, z - h, t)[2]) / (2 * h);
    const magnitude = Math.hypot(...eddy(x, y, z, t));
    assert.ok(magnitude > 0.01, "the eddies blow");
    // Each mode's velocity gradient is about |k| |v| (k up to 17 /m); the divergence is round-off.
    assert.ok(Math.abs(div) < 1e-4 * 20 * magnitude + 1e-6, `eddy divergence ${div} at ${x}, ${y}`);
  }
});

test("the tracks clear the authored furniture, the door hardware, the floor and the head", () => {
  for (const track of CURTAIN_TRACKS) {
    const door = CURTAIN_FACADE.doors.find((d) => d.id === track.door);
    assert.ok(track.rail.from < door.opening[1] && track.rail.to > door.opening[0], `${track.id} rail spans its doorway`);
  }
  assert.ok(CURTAIN_HARDWARE.rodZ > CURTAIN_FACADE.headFaceZ && CURTAIN_HARDWARE.rodY + CURTAIN_HARDWARE.rodRadius < CURTAIN_FACADE.doorHead);
  for (const open of [0, 1]) {
    const cloth = createCurtainCloth({ panels: facadeCurtainPanels({ openFraction: open }), reducedMotion: true });
    everyPosition(cloth, (panel, i, p) => {
      const x = p[3 * i],
        y = p[3 * i + 1],
        z = p[3 * i + 2];
      assert.ok(z > CURTAIN_FACADE.hardwareZ + 0.02, `${panel.id} reaches the door pulls (z ${z})`);
      assert.ok(y > CURTAIN_FACADE.floorY && y < CURTAIN_FACADE.doorHead, `${panel.id} height ${y}`);
      // The kitchen's dining table ends at x -2.75 and the lounge's potted plant starts at x 3.5 (authored GLBs).
      assert.ok(x > -2.75 && x < 3.5, `${panel.id} x ${x}`);
    });
  }
});

test("a land breeze pressing the curtains onto the shut glass never pushes them through it", () => {
  const cloth = createCurtainCloth({
    panels: facadeCurtainPanels({ openFraction: 0 }),
    wind: (x, y, z, t, out) => {
      out[0] = 0.4 * Math.sin(t);
      out[1] = 0;
      out[2] = -6 * (0.7 + 0.3 * Math.sin(2.3 * t + x));
      return out;
    },
  });
  let deepest = Infinity;
  for (let f = 0; f < 480; f++) {
    cloth.update(STEP, (f + 1) * STEP);
    if (f % 4) continue;
    everyPosition(cloth, (panel, i, p) => {
      if (i < panel.columns) return;
      deepest = Math.min(deepest, p[3 * i + 2] - (CURTAIN_FACADE.hardwareZ + 0.02));
    });
  }
  assert.ok(deepest >= SHEER_LINEN.thickness - 1e-9, `the cloth came within ${deepest} m of the door pulls' plane`);
});

test("written normals and weft tangents are unit, orthogonal, and agree with the triangles' winding", () => {
  const cloth = facade();
  run(cloth, 1);
  for (const panel of cloth.panels) {
    const position = new Float32Array(3 * panel.count),
      normal = new Float32Array(3 * panel.count),
      tangent = new Float32Array(3 * panel.count);
    cloth.writePanel(panel.id, position, normal, tangent);
    for (let i = 0; i < panel.count; i++) {
      const n = normal.subarray(3 * i, 3 * i + 3),
        t = tangent.subarray(3 * i, 3 * i + 3);
      assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-5 && Math.abs(Math.hypot(...t) - 1) < 1e-5);
      assert.ok(Math.abs(n[0] * t[0] + n[1] * t[1] + n[2] * t[2]) < 1e-5);
    }
    let agree = 0;
    for (let k = 0; k < panel.index.length; k += 3) {
      const [a, b, c] = [panel.index[k], panel.index[k + 1], panel.index[k + 2]],
        e1 = [0, 1, 2].map((q) => position[3 * b + q] - position[3 * a + q]),
        e2 = [0, 1, 2].map((q) => position[3 * c + q] - position[3 * a + q]),
        n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (n[0] * normal[3 * a] + n[1] * normal[3 * a + 1] + n[2] * normal[3 * a + 2] > 0) agree++;
    }
    assert.ok(agree / (panel.index.length / 3) > 0.9, `${panel.id}: ${agree} of ${panel.index.length / 3} triangles agree`);
  }
});

test("the drawn mesh runs a Catmull-Rom spline through every simulated column", () => {
  const cloth = facade();
  run(cloth, 0.5);
  const meshes = createCurtainMeshes(cloth, createSheerFabric(), { refine: 3 });
  const panel = cloth.panels[0],
    mesh = meshes.meshes[0],
    Cr = (panel.columns - 1) * 3 + 1,
    drawn = mesh.geometry.attributes.position.array,
    solver = new Float32Array(3 * panel.count);
  cloth.writePanel(0, solver);
  assert.equal(mesh.geometry.attributes.position.count, Cr * panel.rows);
  for (let r = 0; r < panel.rows; r++)
    for (let c = 0; c < panel.columns; c++)
      for (let a = 0; a < 3; a++) assert.ok(Math.abs(drawn[3 * (r * Cr + 3 * c) + a] - solver[3 * (r * panel.columns + c) + a]) < 1e-6);
  meshes.dispose();
});

test("weave openness is the cover factor head-on and closes toward grazing angles; linen slubs average to 1", () => {
  const ratios = weaveYarnRatios(0.27);
  const n = [0, 0, 1],
    tangent = [1, 0, 0];
  assert.ok(Math.abs(weaveOpenness(n, n, tangent, ratios) - 0.27) < 1e-3);
  let previous = 1;
  for (let degrees = 0; degrees <= 80; degrees += 5) {
    const a = (degrees * Math.PI) / 180;
    const across = weaveOpenness([Math.sin(a), 0, Math.cos(a)], n, tangent, ratios),
      along = weaveOpenness([0, Math.sin(a), Math.cos(a)], n, tangent, ratios);
    assert.ok(across <= previous + 1e-12 && Math.abs(across - along) < 1e-9);
    previous = across;
  }
  assert.equal(weaveOpenness([Math.sin(1.2), 0, Math.cos(1.2)], n, tangent, ratios), 0, "the gaps close before grazing");
  const [warp, weft] = weaveYarnRatios(0.3, 1.5);
  assert.ok(Math.abs((1 - warp) * (1 - weft) - 0.3) < 1e-6 && Math.abs(warp / weft - 1.5) < 1e-6);
  let sum = 0,
    low = Infinity,
    high = -Infinity;
  for (let k = 0; k < 20000; k++) {
    const d = linenDensity((k % 200) * 0.0137, Math.floor(k / 200) * 0.0291);
    sum += d;
    low = Math.min(low, d);
    high = Math.max(high, d);
  }
  assert.ok(Math.abs(sum / 20000 - 1) < 0.02 && low > 0.8 && high < 1.2, `slub density ${sum / 20000} in ${low}..${high}`);
});

test("the linen patches keep the scene's include markers, blend by default, and route clear of name-based finishing", () => {
  assert.ok(
    !/leaf|linen|textile|cotton|woven|wood|oak|ash|walnut|water|turquoise|hair|skin|stone|sand|plaster|foliage|glass/i.test(SHEER_FABRIC_NAME)
  );
  const fabric = createSheerFabric();
  const shader = { vertexShader: ShaderLib.physical.vertexShader, fragmentShader: ShaderLib.physical.fragmentShader, uniforms: {} };
  patchSheerShader(shader, fabric.uniforms);
  for (const marker of ["#include <common>", "#include <project_vertex>"]) assert.ok(shader.vertexShader.includes(marker));
  for (const marker of [
    "#include <common>",
    "#include <lights_fragment_end>",
    "#include <aomap_fragment>",
    "#include <opaque_fragment>",
    "#include <color_fragment>",
  ])
    assert.ok(shader.fragmentShader.includes(marker), marker);
  assert.ok(shader.fragmentShader.includes("#define RE_Direct RE_Direct_Sheer"));
  assert.ok(shader.fragmentShader.includes("#if defined( SHEER_BLEND )"));
  // The r164 shadow chunk was found and its normal offset now points toward each light.
  assert.ok(ShaderChunk.shadowmap_vertex.includes("shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias"));
  assert.ok(shader.vertexShader.includes("sheerTowardLight( shadowWorldNormal, - vec3( directionalShadowMatrix[ i ]"));
  assert.ok(!shader.vertexShader.includes("#include <shadowmap_vertex>"));
  assert.equal(shader.uniforms.sheerYarn, fabric.uniforms.sheerYarn);
  shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_end>", "irradiance = vec3(0.0);\n#include <lights_fragment_end>");
  assert.ok(shader.fragmentShader.indexOf("irradiance = vec3(0.0);") > shader.fragmentShader.indexOf("vec3 sheerBehind"));
  for (const [source, distance] of [
    [ShaderLib.depth, false],
    [ShaderLib.distanceRGBA, true],
  ]) {
    const shadow = { vertexShader: source.vertexShader, fragmentShader: source.fragmentShader, uniforms: {} };
    patchSheerShadowShader(shadow, fabric.uniforms, distance);
    assert.ok(shadow.fragmentShader.includes("sheerBayer( gl_FragCoord.xy ) < sheerPass("));
    assert.ok(shadow.fragmentShader.includes(distance ? "referencePosition - vSheerPoint" : "isOrthographic"));
  }
  const mesh = { userData: {} };
  fabric.bindMesh(mesh);
  assert.equal(mesh.material, fabric.material);
  assert.equal(mesh.customDepthMaterial, fabric.depthMaterial, "the shadow cache sees a moving caster: its own depth material");
  assert.equal(mesh.customDistanceMaterial, fabric.distanceMaterial);
  assert.ok(mesh.castShadow && mesh.receiveShadow && mesh.userData.fixedMaterial && mesh.userData.noContactOcclusion && mesh.userData.noOcclusion);
  // Blended translucency by default (no alpha-to-coverage grain), the October 16 coverage path on request,
  // and an opaque dense cloth for towels.
  assert.ok(
    fabric.material.transparent && !fabric.material.alphaToCoverage && !fabric.material.depthWrite && "SHEER_BLEND" in fabric.material.defines
  );
  assert.ok(fabric.material.forceSinglePass, "both faces in one draw");
  const coverage = createSheerFabric({ coverage: "coverage" }).material;
  assert.ok(coverage.alphaToCoverage && !coverage.transparent && coverage.depthWrite);
  const opaque = createSheerFabric({ coverage: "opaque" }).material;
  assert.ok(!opaque.alphaToCoverage && !opaque.transparent && opaque.depthWrite && "SHEER_OPAQUE" in opaque.defines);
  assert.notEqual(fabric.material.customProgramCacheKey(), coverage.customProgramCacheKey());
  assert.notEqual(fabric.material.customProgramCacheKey(), fabric.depthMaterial.customProgramCacheKey());
});

test("four facade panels step within the frame budget", (t) => {
  const sim = createFacadeCurtains({ seed: 3 });
  sim.draft.setDoorOpen("kitchen", 1);
  sim.draft.setDoorOpen("lounge", 1);
  run(sim.cloth, 1);
  let best = Infinity,
    time = 1;
  for (let trial = 0; trial < 12; trial++) {
    const started = performance.now();
    for (let f = 0; f < 30; f++) sim.update(STEP, null, (time += STEP));
    best = Math.min(best, (performance.now() - started) / 30);
  }
  t.diagnostic(`best of 12 trials: ${best.toFixed(3)} ms per 60 Hz frame (30 Hz steps) for ${sim.cloth.evidence().particles} particles`);
  // About 1.5 ms per frame for all four panels alone on the development machine; node --test runs files
  // in parallel, so this guard only catches pathological regressions.
  assert.ok(best < 15, `${best} ms per frame`);
});
