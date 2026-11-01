import * as THREE from "../three.module.min.js";
import { plateLoad } from "./training.mjs";
import { drawTrainingScreen, trainingSessionKey, trainingDashboardModel } from "./gym-dashboard.mjs?v=gym-close-20261101";

// The gym's moving equipment (Sirui, 2026-10-15): three barbells (in the rack, on the bench's
// uprights, on the platform) loaded with the plates each set calls for, the plate in the hands
// while loading, the working pair of dumbbells, the bench back that rises for incline presses,
// and the whiteboard, drawn from the program itself (gym-session.mjs says where everything is;
// lift-rig.mjs says where the hands put it).

// Plate radius and thickness (m) by set and weight (lb). Bumpers share the 450 mm competition
// diameter and grow thicker with weight; black plates shrink with weight as cast plates do.
export const PLATES = {
  bumper: { 55: [0.225, 0.088], 45: [0.225, 0.074], 35: [0.225, 0.059], 25: [0.225, 0.044], 10: [0.225, 0.026] },
  iron: { 45: [0.225, 0.04], 35: [0.178, 0.036], 25: [0.14, 0.032], 10: [0.115, 0.024], 5: [0.1, 0.02], 2.5: [0.08, 0.016] },
};
// Pound bumper colours: 55 red, 45 blue, 35 yellow, 25 green, 10 gray.
const BUMPER_COLOURS = { 55: 0xb3262d, 45: 0x1f4e9a, 35: 0xe0b324, 25: 0x2f7a44, 10: 0x8d9295 };
const HALF = 1.1,
  COLLAR = 0.67,
  SLEEVE = 0.685;
const X = new THREE.Vector3(1, 0, 0);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};

export function createTrainingScreen({ room, training }) {
  // Reuse the authored face/UVs as a self-lit digital panel. Equipment remains a
  // physical gym receiver; a screen's pixels do not depend on a room-light visit.
  const objects = [];
  room.traverse((o) => {
    if (o.userData.activityProp === "whiteboard") objects.push(o);
  });
  const originals = objects.map((object) => ({
    object,
    material: object.material,
    action: object.userData.action,
    fixed: object.userData.fixedMaterial,
  }));
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1392;
  const board = new THREE.CanvasTexture(canvas);
  board.colorSpace = THREE.SRGBColorSpace;
  // The board's UVs run along +X, which reads right to left from the room: mirror them back.
  board.flipY = false;
  board.wrapS = THREE.RepeatWrapping;
  board.repeat.set(-1, 1);
  board.offset.set(1, 0);
  board.anisotropy = 4;
  const boardMaterial = new THREE.MeshStandardMaterial({
    color: 0x070a0b,
    map: board,
    emissive: 0xffffff,
    emissiveMap: board,
    emissiveIntensity: 1,
    roughness: 0.45,
    metalness: 0,
    toneMapped: false,
  });
  boardMaterial.name = "Coastal training display";
  for (const o of objects) {
    o.material = boardMaterial;
    o.userData.fixedMaterial = true;
    o.userData.action = { type: "training-screen" };
  }
  let boardKey = "",
    boardInfo = null,
    display = {},
    uploads = 0,
    disposed = false;
  function drawBoard(info, force = false) {
    if (!training) return false;
    boardInfo = info;
    const key = trainingSessionKey(info, display);
    if (!force && key === boardKey) return false;
    boardKey = key;
    const model = trainingDashboardModel(training, info, display);
    drawTrainingScreen(canvas.getContext("2d"), model);
    board.needsUpdate = true;
    uploads++;
    return true;
  }
  // Canvas font choice is captured in pixels, so finish loading Inter once before
  // its final upload. This does not schedule a per-frame redraw.
  document.fonts?.ready.then(() => {
    if (!disposed && boardKey) drawBoard(boardInfo, true);
  });

  return {
    drawBoard,
    setDisplay(next) {
      display = { ...next };
      return drawBoard(boardInfo);
    },
    objects: () => objects,
    evidence: () => ({
      board: boardKey,
      screen: {
        width: canvas.width,
        height: canvas.height,
        uploads,
        textureVersion: board.version,
        selfLit: true,
        display: { ...display },
        diffuse: boardMaterial.color.toArray(),
        emissiveOnlyAppearance: true,
      },
    }),
    dispose() {
      disposed = true;
      for (const old of originals) {
        if (old.object.material !== boardMaterial) continue;
        old.object.material = old.material;
        if (old.action === undefined) delete old.object.userData.action;
        else old.object.userData.action = old.action;
        if (old.fixed === undefined) delete old.object.userData.fixedMaterial;
        else old.object.userData.fixedMaterial = old.fixed;
      }
      board.dispose();
      boardMaterial.dispose();
    },
  };
}

export function createGymProps({ room, world, gym, training, material: makeMaterial, screen: installedScreen = null }) {
  // These runtime replacements belong to the same physical receiver as the
  // native gym. Declare that before the shared factory binds its lighting.
  const material = (color, extra = {}) => makeMaterial(color, { ...extra, userData: { ...extra.userData, installationGroup: "gym" } });
  const disposables = [];
  const keep = (thing) => (disposables.push(thing), thing);
  const steel = material(0x9aa19f, { metalness: 0.86, roughness: 0.3 });
  const chrome = material(0xc8cdcb, { metalness: 0.92, roughness: 0.18 });
  const rubber = material(0x1d2220, { roughness: 0.9 });
  const iron = material(0x202322, { roughness: 0.55, metalness: 0.45 });
  const bumper = Object.fromEntries(Object.entries(BUMPER_COLOURS).map(([lb, c]) => [lb, material(c, { roughness: 0.82 })]));
  const insert = material(0xb8bdbb, { metalness: 0.85, roughness: 0.3 });
  const cylinder = (r, h, segments = 24) => keep(new THREE.CylinderGeometry(r, r, h, segments).rotateZ(Math.PI / 2));
  const geometry = (kind, part) =>
    Object.fromEntries(
      Object.entries(PLATES[kind]).map(([lb, [r, t]]) => [
        lb,
        part === "plate" ? cylinder(r, t, 40) : cylinder(kind === "bumper" ? 0.05 : Math.min(0.06, r * 0.42), t + 0.004, 24),
      ])
    );
  const plateGeometry = { bumper: geometry("bumper", "plate"), iron: geometry("iron", "plate") };
  const hubGeometry = { bumper: geometry("bumper", "hub"), iron: geometry("iron", "hub") };
  const plateMaterial = (kind, lb) => (kind === "bumper" ? bumper[lb] : iron);
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

  function barbell(rest, axis, station) {
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
    const bar = { group, plates, station, weight: null, restAt, restQ, held: new THREE.Vector3().copy(restAt), heldQ: restQ.clone(), blend: 0 };
    load(bar, 45);
    return bar;
  }
  function load(bar, weight) {
    if (bar.weight === weight) return;
    bar.weight = weight;
    bar.plates.clear();
    for (const side of [-1, 1]) {
      let offset = SLEEVE + 0.004;
      for (const { lb, kind } of plateLoad(weight, bar.station)) {
        const [, t] = PLATES[kind][lb];
        add(bar.plates, plateGeometry[kind][lb], plateMaterial(kind, lb), side * (offset + t / 2));
        add(bar.plates, hubGeometry[kind][lb], kind === "bumper" ? insert : rubber, side * (offset + t / 2));
        offset += t + 0.003;
      }
    }
  }
  const bars = {
    rack: barbell(gym.rack.bar, X, "rack"),
    platform: barbell(gym.platform.bar, X, "platform"),
    bench: barbell(gym.bench.bar, gym.bench.barAxis === "z" ? new THREE.Vector3(0, 0, 1) : X, "bench"),
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

  const screen = installedScreen || createTrainingScreen({ room, training });

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
      // The plate in the hands comes from the set its bar uses.
      const plate = pose?.plate && rig?.plate ? `${pose.plate.kind}:${pose.plate.size}` : null;
      if (plate !== handPlateSize) {
        handPlate.clear();
        if (plate) {
          const { kind, size } = pose.plate;
          add(handPlate, plateGeometry[kind][size], plateMaterial(kind, size));
          add(handPlate, hubGeometry[kind][size], kind === "bumper" ? insert : rubber);
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
        d.group.position.copy(inHands ? rig.hands[side] : d.rest);
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
    drawBoard: screen.drawBoard,
    setDisplay: screen.setDisplay,
    screenObjects: screen.objects,
    evidence: () => ({ ...evidence, ...screen.evidence() }),
    dispose() {
      if (!installedScreen) screen.dispose();
      for (const bar of Object.values(bars)) bar.group.removeFromParent();
      handPlate.removeFromParent();
      disposables.forEach((d) => d.dispose?.());
    },
  };
}

// Retained export for callers that render a board outside the 3D prop factory.
export function drawTrainingBoard(g, info, training, display = {}) {
  drawTrainingScreen(g, trainingDashboardModel(training, info, display));
}
