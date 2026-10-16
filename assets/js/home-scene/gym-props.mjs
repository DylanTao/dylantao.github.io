import * as THREE from "../three.module.min.js";
import { platesFor, LIFT_LABELS } from "./training.mjs";

// The gym's moving equipment (Sirui, 2026-10-15): three barbells (in the rack, on the bench's
// uprights, on the platform) loaded with the plates each set calls for, the plate in the hands
// while loading, the working pair of dumbbells, the bench back that rises for incline presses,
// and the whiteboard, drawn from the program itself (gym-session.mjs says where everything is;
// lift-rig.mjs says where the hands put it).

// Plate radius and thickness (m) by weight (lb): bumpers for the big plates, iron change plates.
export const PLATES = { 45: [0.225, 0.062], 35: [0.21, 0.052], 25: [0.18, 0.042], 10: [0.13, 0.028], 5: [0.105, 0.022], 2.5: [0.085, 0.016] };
const HALF = 1.1,
  COLLAR = 0.67,
  SLEEVE = 0.685;
const X = new THREE.Vector3(1, 0, 0);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};

export function createGymProps({ room, world, gym, training, material }) {
  const disposables = [];
  const keep = (thing) => (disposables.push(thing), thing);
  const steel = material(0x9aa19f, { metalness: 0.86, roughness: 0.3 });
  const chrome = material(0xc8cdcb, { metalness: 0.92, roughness: 0.18 });
  const rubber = material(0x1d2220, { roughness: 0.9 });
  const hubs = {
    45: material(0x5f7a5f, { roughness: 0.6 }),
    35: material(0xc09a3e, { roughness: 0.6 }),
    25: material(0x56785a, { roughness: 0.6 }),
    10: material(0xe6e2d6, { roughness: 0.6 }),
    5: material(0xb0563a, { roughness: 0.55 }),
    2.5: material(0x2f5b8f, { roughness: 0.55 }),
  };
  const cylinder = (r, h, segments = 24) => keep(new THREE.CylinderGeometry(r, r, h, segments).rotateZ(Math.PI / 2));
  const plateGeometry = Object.fromEntries(Object.entries(PLATES).map(([w, [r, t]]) => [w, cylinder(r, t, 40)]));
  const hubGeometry = Object.fromEntries(Object.entries(PLATES).map(([w, [r, t]]) => [w, cylinder(Math.min(0.07, r * 0.42), t + 0.004, 24)]));
  const shaft = cylinder(0.0145, 2 * COLLAR, 14),
    sleeve = cylinder(0.025, HALF - SLEEVE, 18),
    collar = cylinder(0.036, 0.03, 18);
  const add = (parent, geometry, mat, x = 0) => {
    const m = new THREE.Mesh(geometry, mat);
    m.position.x = x;
    m.castShadow = m.receiveShadow = true;
    m.userData.dynamic = true;
    m.userData.fixedMaterial = true;
    parent.add(m);
    return m;
  };

  function barbell(rest, axis) {
    const group = new THREE.Group();
    group.userData.dynamic = true;
    add(group, shaft, chrome);
    for (const side of [-1, 1]) {
      add(group, collar, steel, side * COLLAR);
      add(group, sleeve, steel, side * (SLEEVE + (HALF - SLEEVE) / 2));
    }
    const plates = new THREE.Group();
    group.add(plates);
    room.add(group);
    const restAt = new THREE.Vector3(...rest);
    const restQ = new THREE.Quaternion().setFromUnitVectors(X, axis);
    group.position.copy(restAt);
    group.quaternion.copy(restQ);
    const bar = { group, plates, weight: null, restAt, restQ, held: new THREE.Vector3().copy(restAt), heldQ: restQ.clone(), blend: 0 };
    load(bar, 45);
    return bar;
  }
  function load(bar, weight) {
    if (bar.weight === weight) return;
    bar.weight = weight;
    bar.plates.clear();
    for (const side of [-1, 1]) {
      let offset = SLEEVE + 0.004;
      for (const plate of platesFor(weight)) {
        const [, t] = PLATES[plate];
        add(bar.plates, plateGeometry[plate], rubber, side * (offset + t / 2));
        add(bar.plates, hubGeometry[plate], hubs[plate], side * (offset + t / 2));
        offset += t + 0.003;
      }
    }
  }
  const bars = {
    rack: barbell(gym.rack.bar, X),
    platform: barbell(gym.platform.bar, X),
    bench: barbell(gym.bench.bar, gym.bench.barAxis === "z" ? new THREE.Vector3(0, 0, 1) : X),
  };

  // The plate in the hands while loading or stripping.
  const handPlate = new THREE.Group();
  handPlate.visible = false;
  room.add(handPlate);
  let handPlateSize = null;

  // Authored props inside the room: the working dumbbells, the bench back, the whiteboard face.
  const pieces = { "exercise-weight": [], "exercise-weight-left": [], "bench-backrest": [], whiteboard: [] };
  room.traverse((o) => {
    if (pieces[o.userData.activityProp]) pieces[o.userData.activityProp].push(o);
  });
  function pivot(list, at) {
    if (!list.length) return null;
    const group = new THREE.Group();
    group.position.set(...at);
    group.userData.dynamic = true;
    room.add(group);
    room.updateMatrixWorld(true);
    for (const o of list) {
      group.attach(o);
      o.traverse((part) => (part.userData.dynamic = true));
    }
    return { group, rest: new THREE.Vector3(...at) };
  }
  const dumbbells = {
    R: pivot(pieces["exercise-weight"], gym.dumbbells.pair[0]),
    L: pivot(pieces["exercise-weight-left"], gym.dumbbells.pair[1]),
  };
  const backrest = pivot(pieces["bench-backrest"], gym.bench.hinge);
  const inclineAngle = ((gym.bench.inclineDegrees ?? 32) * Math.PI) / 180;
  let incline = 0;

  // The whiteboard: a canvas drawn in marker colours, redrawn only when what it says changes.
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 696;
  const board = keep(new THREE.CanvasTexture(canvas));
  board.colorSpace = THREE.SRGBColorSpace;
  // The board's UVs run along +X, which reads right to left from the room: mirror them back.
  board.flipY = false;
  board.wrapS = THREE.RepeatWrapping;
  board.repeat.set(-1, 1);
  board.offset.set(1, 0);
  board.anisotropy = 4;
  const boardMaterial = material(0xffffff, { map: board, roughness: 0.32, metalness: 0 });
  for (const o of pieces.whiteboard) {
    o.material = boardMaterial;
    o.userData.fixedMaterial = true;
  }
  let boardKey = "";

  const temp = new THREE.Vector3(),
    tempQ = new THREE.Quaternion();
  let evidence = { weightOwner: "rack", weightPosition: null, bars: {}, board: "" };

  function placeBar(bar, held, center, axis, dt, moving) {
    if (held && center) {
      bar.held.fromArray(center);
      bar.heldQ.setFromUnitVectors(X, temp.fromArray(axis).normalize());
    }
    const goal = held && center ? 1 : 0;
    bar.blend = moving ? bar.blend + (goal - bar.blend) * (1 - Math.exp(-dt / 0.08)) : goal;
    if (Math.abs(bar.blend - goal) < 0.002) bar.blend = goal;
    const k = smooth(bar.blend);
    bar.group.position.lerpVectors(bar.restAt, bar.held, k);
    bar.group.quaternion.slerpQuaternions(bar.restQ, bar.heldQ, k);
  }

  return {
    // Follow the session pose and the rig's output (bar, hands, plate) for this frame.
    update(pose, rig, dt = 0, moving = true) {
      for (const [station, bar] of Object.entries(bars)) {
        const state = pose?.bars?.[station];
        if (state) load(bar, state.weight);
        const held = Boolean(state?.held && rig?.center);
        placeBar(bar, held, held ? rig.center.toArray() : null, held ? rig.axis.toArray() : null, dt, moving);
      }
      // A plate in the hands.
      const plate = pose?.plate && rig?.plate ? pose.plate.size : null;
      if (plate !== handPlateSize) {
        handPlate.clear();
        if (plate) {
          add(handPlate, plateGeometry[plate], rubber);
          add(handPlate, hubGeometry[plate], hubs[plate]);
        }
        handPlateSize = plate;
      }
      handPlate.visible = Boolean(plate);
      if (plate) {
        handPlate.position.copy(rig.plate);
        handPlate.quaternion.setFromUnitVectors(X, rig.plateAxis);
      }
      // The dumbbells, in the hands or on the rack's top tier.
      const inHands = pose?.dumbbells === "hands" && rig?.hands;
      for (const side of ["R", "L"]) {
        const d = dumbbells[side];
        if (!d) continue;
        const goal = inHands ? rig.hands[side] : d.rest;
        if (inHands && moving) d.group.position.lerp(goal, 1 - Math.exp(-dt / 0.03));
        else d.group.position.copy(goal);
      }
      // The bench back.
      const goal = pose?.incline ?? incline;
      incline = moving ? incline + (goal - incline) * (1 - Math.exp(-dt / 0.25)) : goal;
      if (backrest) backrest.group.rotation.z = incline * inclineAngle;
      evidence = {
        weightOwner: inHands ? "hand" : "rack",
        weightPosition: dumbbells.R?.group.position.toArray() || null,
        bars: Object.fromEntries(
          Object.entries(bars).map(([k, b]) => [k, { weight: b.weight, held: b.blend > 0.5, position: b.group.position.toArray() }])
        ),
        incline,
      };
    },
    // Redraw the board when today's numbers or the ticks change.
    drawBoard(info) {
      const after = info?.plan && !info.state && info.minute >= info.endMinute;
      const key = info?.plan
        ? `${info.key}|${info.plan.template}|${info.plan.day}|${after ? "done" : JSON.stringify(info.state?.done || {})}|${info.state?.segment?.kind === "set" ? info.state.index : ""}`
        : `none|${info?.key || ""}`;
      if (key === boardKey) return false;
      boardKey = key;
      drawTrainingBoard(canvas.getContext("2d"), info, training);
      board.needsUpdate = true;
      evidence.board = key;
      return true;
    },
    evidence: () => evidence,
    dispose() {
      for (const bar of Object.values(bars)) bar.group.removeFromParent();
      handPlate.removeFromParent();
      disposables.forEach((d) => d.dispose?.());
    },
  };
}

const INK = "#202528",
  TERRA = "#a9532f",
  SAGE = "#4f6f52",
  BLUE = "#2c5585";
const HAND = '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Marker Felt", cursive';

// The training board: the program and its maxes, today's two lifts set by set with ticks for the
// sets done, the supersets, the cycle's progress and the training-max history from Sirui's log.
export function drawTrainingBoard(g, info, training) {
  const W = g.canvas.width,
    H = g.canvas.height;
  const enamel = g.createLinearGradient(0, 0, W, H);
  enamel.addColorStop(0, "#f6f7f5");
  enamel.addColorStop(0.55, "#eef0ee");
  enamel.addColorStop(1, "#f4f5f3");
  g.fillStyle = enamel;
  g.fillRect(0, 0, W, H);
  // Faint ghosts of last week's erased notes.
  g.globalAlpha = 0.05;
  g.fillStyle = INK;
  g.font = `34px ${HAND}`;
  g.fillText("315 × 1+  ·  5×5  ·  ✓✓✓", 560, 640);
  g.globalAlpha = 1;
  const text = (s, x, y, size, color = INK, weight = "") => {
    g.font = `${weight} ${size}px ${HAND}`.trim();
    g.fillStyle = color;
    g.fillText(s, x, y);
    return g.measureText(s).width;
  };
  const underline = (x, y, w, color) => {
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + w * 0.3, y + 3, x + w * 0.7, y - 2, x + w, y + 1);
    g.stroke();
  };
  if (!training) return;
  const tm = training.trainingMax;
  text(training.program || "nSuns 5/3/1 LP", 34, 62, 40, INK, "bold");
  underline(34, 74, 330, TERRA);
  // Training maxes, top right.
  text("TM (lb)", 742, 54, 26, SAGE, "bold");
  [
    ["Bench", tm.bench],
    ["OHP", tm.ohp],
    ["Squat", tm.squat],
    ["Deadlift", tm.deadlift],
  ].forEach(([name, v], i) => {
    text(name, 742, 92 + i * 34, 26, INK);
    text(String(v), 900, 92 + i * 34, 26, BLUE, "bold");
  });
  const plan = info?.plan;
  if (!plan) {
    text("Rest day", 34, 150, 44, TERRA, "bold");
    text("eat · sleep · walk the coast", 34, 200, 28, INK);
  } else {
    text(`${plan.templateLabel} · cycle ${plan.cycle} · day ${plan.day + 1} of 6`, 34, 120, 28, TERRA);
    // Ticks: the sets done so far, or every set once today's session is over.
    const finished = !info.state && info.minute >= info.endMinute;
    const done = finished ? Object.fromEntries(plan.lifts.map((l) => [l.lift, l.sets.length])) : info.state?.done || {};
    const current = info.state?.segment?.kind === "set" && !info.state.segment.warmup ? info.state.segment : null;
    plan.lifts.forEach((lift, row) => {
      const y0 = 178 + row * 168;
      const w = text(`T${lift.tier}  ${LIFT_LABELS[lift.lift] || lift.lift}`, 34, y0, 32, INK, "bold");
      text(`+ ${LIFT_LABELS[lift.superset] || lift.superset}`, 34 + w + 18, y0, 24, SAGE);
      const count = done[lift.lift] || 0;
      lift.sets.forEach((set, i) => {
        const col = i % 5,
          line = Math.floor(i / 5);
        const x = 34 + col * 136,
          y = y0 + 44 + line * 52;
        const label = `${set.weight}×${set.reps}${set.amrap ? "+" : ""}`;
        const isCurrent = current && current.lift === lift.lift && current.set === i;
        const width = text(label, x, y, 26, i < count ? INK : "#5b6266", isCurrent ? "bold" : "");
        if (i < count) {
          // A tick, drawn as a marker stroke.
          g.strokeStyle = SAGE;
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(x + width + 6, y - 10);
          g.lineTo(x + width + 13, y - 2);
          g.lineTo(x + width + 27, y - 22);
          g.stroke();
        }
        if (isCurrent) {
          g.strokeStyle = TERRA;
          g.lineWidth = 3;
          g.beginPath();
          g.ellipse(x + width / 2, y - 9, width / 2 + 10, 20, -0.04, 0, Math.PI * 2);
          g.stroke();
        }
      });
    });
    if (plan.finisher) text(`finisher: ${LIFT_LABELS[plan.finisher]} 3 × 10`, 34, 520, 24, SAGE);
  }
  // The cycle's progress (from the log, plus today's ticks).
  const cycle = training.cycles?.[training.cycles.length - 1];
  if (cycle) {
    const finished = info?.plan && !info.state && info.minute >= info.endMinute;
    const today = finished
      ? info.plan.lifts.reduce((a, l) => a + l.sets.length, 0)
      : Object.values(info?.state?.done || {}).reduce((a, b) => a + b, 0);
    const sets = Math.min(cycle.of, cycle.sets + (info?.key === training.anchor?.date ? today : 0));
    text(`cycle ${sets}/${cycle.of} sets · ${cycle.failed} missed`, 34, 588, 26, INK);
    g.strokeStyle = "#9aa3a0";
    g.lineWidth = 2;
    g.strokeRect(34, 604, 360, 18);
    g.fillStyle = SAGE;
    g.fillRect(36, 606, 356 * (sets / cycle.of), 14);
  }
  // Training-max history, one small line per lift.
  const series = training.progress || {};
  const lifts = [
    ["squat", TERRA],
    ["deadlift", INK],
    ["ohp", BLUE],
  ];
  const x0 = 470,
    y0 = 560,
    w = 520,
    h = 110;
  text("TM history", x0, y0 - 6, 24, SAGE, "bold");
  const values = lifts.flatMap(([k]) => (series[k] || []).map(([, v]) => v));
  if (values.length) {
    const lo = Math.min(...values) - 10,
      hi = Math.max(...values) + 10;
    const times = lifts.flatMap(([k]) => (series[k] || []).map(([d]) => Date.parse(d)));
    const t0 = Math.min(...times),
      t1 = Math.max(...times);
    for (const [k, color] of lifts) {
      const points = series[k] || [];
      if (points.length < 2) continue;
      g.strokeStyle = color;
      g.lineWidth = 3;
      g.beginPath();
      points.forEach(([d, v], i) => {
        const x = x0 + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * w,
          y = y0 + 12 + (1 - (v - lo) / (hi - lo)) * h;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      });
      g.stroke();
      const [, last] = points[points.length - 1];
      text(`${k === "ohp" ? "OHP" : k} ${last}`, x0 + w - 120, y0 + 12 + (1 - (last - lo) / (hi - lo)) * h - 8, 20, color);
    }
  }
}
