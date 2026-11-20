import * as THREE from "../three.module.min.js";
import { rotorStep } from "./record-motion.mjs";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const X = V(1, 0, 0);
const UP = V(0, 1, 0);
const smooth = (t) => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;

// Exact free response of an underdamped oscillator. A contact supplies velocity;
// the elapsed time, rather than the number of frames, sets the decay.
export function swingStep(angle, velocity, seconds, frequency, drag) {
  const fall = Math.exp(-drag * seconds);
  const omega = Math.sqrt(frequency * frequency - drag * drag);
  const s = Math.sin(omega * seconds) / omega,
    c = Math.cos(omega * seconds);
  return [fall * (angle * c + (velocity + drag * angle) * s), fall * (velocity * c - (frequency * frequency * angle + drag * velocity) * s)];
}

function tether(node, restTip) {
  const origin = node.position.clone();
  const axis = restTip.clone().sub(origin);
  const length = axis.length();
  const inverse = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(axis.normalize(), UP));
  const rotation = new THREE.Quaternion(),
    stretch = new THREE.Matrix4();
  node.matrixAutoUpdate = false;
  return (tip) => {
    axis.copy(tip).sub(origin);
    const distance = axis.length();
    rotation.setFromUnitVectors(UP, axis.normalize());
    node.matrix
      .makeRotationFromQuaternion(rotation)
      .multiply(stretch.makeScale(1, distance / length, 1))
      .multiply(inverse)
      .setPosition(origin);
    node.matrixWorldNeedsUpdate = true;
  };
}

const BAG = {
  bagwork: {
    part: "heavy_bag",
    floor: 0.018,
    height: 1.39,
    radius: 0.175,
    facing: Math.PI,
    reach: 0.58,
    period: 1.28,
    frequency: 2.76,
    drag: 0.82,
    impulse: 0.31,
  },
  "double-end": {
    part: "double_bag",
    floor: 0.018,
    height: 1.46,
    radius: 0.11,
    facing: Math.PI / 2,
    reach: 0.58,
    period: 0.93,
    frequency: 10.4,
    drag: 1.8,
    impulse: 0.62,
  },
  "speed-bag": {
    part: "speed_bag",
    floor: 0.018,
    height: 1.73,
    radius: 0.09,
    facing: Math.PI / 2,
    reach: 0.46,
    period: 0.55,
    frequency: 15,
    drag: 2.8,
    impulse: 1.45,
  },
};

// Setback from each bag's leather surface to the palm target, in metres. The
// wrist skeletons match across skins, but their posed fingers differ by 8 cm.
const PALM_SETBACK = {
  lizard: { bagwork: 0.075, "double-end": 0.0775, "speed-bag": 0.0505 },
  "south-park": { bagwork: 0.077, "double-end": 0.081, "speed-bag": 0.0275 },
  simpsons: { bagwork: 0.0715, "double-end": 0.078, "speed-bag": 0.0285 },
  ghibli: { bagwork: 0.0715, "double-end": 0.078, "speed-bag": 0.0285 },
  "rick-and-morty": { bagwork: -0.002, "double-end": 0.02, "speed-bag": 0.0425 },
};

export function createCardioStations(room, { onContact = () => {} } = {}) {
  const ids = [
    "rower",
    "rower_fan",
    "rower_seat",
    "rower_handle",
    "rower_cord",
    "bike",
    "bike_crank",
    "bike_flywheel",
    "pedal_left",
    "pedal_right",
    "heavy_bag",
    "double_bag",
    "double_top",
    "double_bottom",
    "speed_bag",
  ];
  const parts = Object.fromEntries(ids.map((id) => [id, room.getObjectByName("gym_cardio_" + id)]));
  if (ids.some((id) => !parts[id])) return null;
  const rest = Object.fromEntries(ids.map((id) => [id, parts[id].position.clone()]));
  const cord = tether(parts.rower_cord, rest.rower_handle);
  const elastic = [
    tether(parts.double_bottom, rest.double_bag.clone().add(V(0, -0.195, 0))),
    tether(parts.double_top, rest.double_bag.clone().add(V(0, 0.188, 0))),
  ];
  const pedals = [parts.pedal_right, parts.pedal_left];
  const crankOffsets = pedals.map((pedal) => pedal.position.clone().sub(rest.bike_crank));
  const bags = Object.fromEntries(Object.keys(BAG).map((id) => [id, [0, 0]]));
  let fan = [0, 0],
    wheel = [0, 0],
    previous = null,
    lastBeat = -1,
    drivePhase = null,
    pendingDrive = null,
    pending = null,
    contacts = null,
    settling = false;

  // Station coordinates use the actor's convention (+Z ahead). Both machines
  // face west. Their pivots, the handle and the crank come from the native GLB.
  const sea = (origin, lateral, height, ahead) => V(origin.x - lateral, origin.y + height, origin.z - ahead);
  function update(id, seconds, dt, { moving, reduced, avatar }) {
    const changed = previous !== id;
    if (!id && !previous && !settling) return null;
    pending = pendingDrive = null;
    if (changed) {
      drivePhase = null;
      lastBeat = -1;
      contacts = null;
    }
    const t = reduced ? 0 : seconds;
    // The rower's catch and the bike's alternating pedal loads share their
    // actual drive clock. Seed each station first and drop pulses during stalls.
    const rowCycles = (t * 24) / 60;
    const bikeTurns = (t * 85) / 60;
    const cycle = id === "rowing" ? Math.floor(rowCycles - 0.06) : id === "riding" ? Math.floor(bikeTurns * 2 - 0.22) : null;
    if (moving && dt > 0 && dt <= 0.25 && drivePhase !== null && cycle === drivePhase + 1) pendingDrive = { id, cycle };
    drivePhase = cycle;
    const stroke = rowCycles % 1;
    const drive = stroke < 0.38 ? smooth(stroke / 0.38) : 1 - smooth((stroke - 0.38) / 0.62);
    if (moving) {
      fan = rotorStep(...fan, id === "rowing" && stroke < 0.38 ? 15 : 0, dt, id === "rowing" && stroke < 0.38 ? 0.2 : 1.15);
      wheel = rotorStep(...wheel, id === "riding" ? ((TAU * 85) / 60) * 2.1 : 0, dt, id === "riding" ? 0.34 : 1.42);
    } else if (reduced) {
      fan[1] = wheel[1] = 0;
    }
    parts.rower_fan.rotation.x = fan[0] % TAU;
    parts.bike_flywheel.rotation.x = wheel[0] % TAU;
    let pose = null;
    if (id === "rowing") {
      const base = rest.rower,
        seat = 0.09 - 0.44 * drive;
      const grip = sea(base, 0, 0.505 + 0.11 * drive, seat + 0.43 - 0.14 * drive);
      parts.rower_seat.position.z = base.z - seat;
      parts.rower_handle.position.copy(grip);
      cord(grip);
      pose = {
        phase: stroke < 0.04 ? "catch" : stroke < 0.34 ? "drive" : stroke < 0.43 ? "finish" : "recovery",
        origin: base,
        facing: Math.PI,
        hips: sea(base, 0, 0.37, seat),
        lean: 0.43 - 0.64 * drive,
        feet: [-1, 1].map((s) => sea(base, s * 0.15, 0.3, 0.31)),
        hands: [-1, 1].map((s) => grip.clone().add(V(-s * 0.157, 0, 0))),
      };
    } else if (changed && previous === "rowing") {
      parts.rower_handle.position.copy(rest.rower_handle);
      parts.rower_seat.position.copy(rest.rower_seat);
      cord(rest.rower_handle);
    }
    if (id === "riding") {
      const base = rest.bike,
        angle = ((t * TAU * 85) / 60) % TAU;
      const climb = Math.max(0, Math.min(1, (t % 28) - 17, 22 - (t % 28)));
      const rise = smooth(climb);
      parts.bike_crank.rotation.x = angle;
      pedals.forEach((p, i) => p.position.copy(crankOffsets[i]).applyAxisAngle(X, angle).add(rest.bike_crank));
      pose = {
        phase: rise > 0.35 ? "out of the saddle" : "pedalling",
        origin: base,
        facing: Math.PI,
        hips: sea(base, 0.016 * rise * Math.sin(angle), 0.944 + 0.072 * rise, -0.26 + 0.12 * rise),
        lean: 0.71 - 0.1 * rise,
        feet: pedals.map((p) => p.position.clone().add(V(0, 0.085, 0.065))),
        hands: [-1, 1].map((s) => sea(base, s * 0.205, 1.076, 0.332)),
      };
    }
    for (const [key, spec] of Object.entries(BAG)) {
      let [value, velocity] = bags[key];
      const beat = Math.floor(t / spec.period);
      const phase = t / spec.period - beat;
      if (key !== id && !value && !velocity) continue;
      if (moving) [value, velocity] = swingStep(value, velocity, dt, spec.frequency, spec.drag);
      else if (reduced) value = velocity = 0;
      if (Math.abs(value) + Math.abs(velocity) < 0.0001) value = velocity = 0;
      bags[key] = [value, velocity];
      const bag = parts[spec.part],
        anchor = rest[spec.part];
      const front = V(Math.sin(spec.facing), 0, Math.cos(spec.facing));
      const side = V(Math.cos(spec.facing), 0, -Math.sin(spec.facing));
      let drift;
      if (key === "double-end") {
        bag.position.copy(anchor).addScaledVector(front, value);
        elastic[0](bag.position.clone().add(V(0, -0.195, 0)));
        elastic[1](bag.position.clone().add(V(0, 0.188, 0)));
        drift = value;
      } else {
        bag.quaternion.setFromAxisAngle(side, -value);
        drift = (anchor.y - spec.height) * Math.sin(value);
      }
      if (id !== key) continue;
      const origin = anchor.clone().addScaledVector(front, -spec.reach);
      origin.y = spec.floor;
      const reach = phase < 0.36 ? smooth(phase / 0.36) : 1 - smooth(Math.max(0, Math.min(1, (phase - 0.53) / 0.3)));
      const hitSide = beat % 2;
      const hook = key === "bagwork" && beat % 3 === 2;
      if (moving && reach > 0.96 && beat !== lastBeat) pending = { key, beat, hitSide };
      pose = {
        phase: key === "bagwork" ? ["jab", "cross", "hook"][beat % 3] : ["left", "right"][hitSide],
        origin,
        facing: spec.facing,
        hips: origin.clone().add(V(0, 0.82, 0)),
        lean: 0.12 * reach,
        twist: (hitSide ? -1 : 1) * 0.16 * reach,
        feet: [-1, 1].map((s) =>
          origin
            .clone()
            .addScaledVector(side, s * 0.16)
            .addScaledVector(front, s * 0.09)
            .add(V(0, 0.075, 0))
        ),
        hands: [-1, 1].map((s, i) => {
          const palm = origin
            .clone()
            .addScaledVector(side, s * 0.17)
            .addScaledVector(front, 0.23);
          palm.y += key === "speed-bag" ? 1.55 : 1.31;
          const touch = anchor
            .clone()
            .addScaledVector(front, drift - spec.radius - (PALM_SETBACK[avatar]?.[key] ?? 0.022))
            .addScaledVector(side, s * 0.024);
          touch.y = spec.height;
          if (i !== hitSide) return palm;
          palm.lerp(touch, reach);
          if (hook) palm.addScaledVector(side, s * 0.075 * Math.sin(Math.PI * reach));
          return palm;
        }),
      };
    }
    previous = id;
    settling = fan[1] + wheel[1] > 0.004 || Object.values(bags).some(([angle, speed]) => angle || speed);
    return pose;
  }
  function observeContact(solved) {
    contacts = solved;
    if (pendingDrive?.id === "rowing" && Math.max(...solved.hands) < 0.035) onContact("rower", 0.58, rest.rower);
    if (pendingDrive?.id === "riding" && solved.feet?.[pendingDrive.cycle % 2] < 0.035) onContact("bike", 0.35, rest.bike);
    pendingDrive = null;
    if (pending && solved.hands[pending.hitSide] < 0.035) {
      bags[pending.key][1] += BAG[pending.key].impulse;
      lastBeat = pending.beat;
      const strength = { bagwork: 0.74, "double-end": 0.54, "speed-bag": 0.39 }[pending.key];
      onContact(pending.key, strength, parts[BAG[pending.key].part].position);
    }
    pending = null;
  }
  return {
    update,
    observeContact,
    evidence: () => ({
      active: previous,
      contacts,
      fanSpeed: fan[1],
      wheelSpeed: wheel[1],
      heavyAngle: bags.bagwork[0],
      doubleTravel: bags["double-end"][0],
      speedAngle: bags["speed-bag"][0],
    }),
  };
}
