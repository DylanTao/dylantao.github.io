// Original show direction for P. Pointer proximity stands in for a visitor;
// no camera, microphone, person tracking or physical robot control is involved.
// Disney Research's attention habituation and layered gaze are references:
// https://la.disneyresearch.com/wp-content/uploads/root.pdf
import { minimumJerk } from "./motion.mjs";
import { randomSource } from "./behaviour.mjs";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

export function createPipDirector(seed = 1037) {
  const random = randomSource(seed);
  let time = 0,
    phase = "task",
    entered = 0,
    cooldown = 0,
    absent = 1,
    armed = true,
    greetings = 0,
    blinkStart = -10,
    nextBlink = 2 + random() * 3;
  const durations = { notice: 0.28, greet: 2.6, listen: 3.3, return: 1.2 };
  return {
    update(dt, { near = false, pointer = [0, 0], task = [0, 0], traveling = false, still = false } = {}) {
      let gesture = null;
      if (still) {
        // Stillness clears the shared motor gesture. End the encounter too;
        // resuming must not claim a wave that no longer exists. Keep cooldown
        // and habituation, so resume is not treated as a second arrival.
        phase = "task";
        entered = time;
        armed = false;
        return { phase: "still", gaze: [0, 0], gesture, hold: true, blink: 0, time, greetings, cooldown: Math.max(0, cooldown - time) };
      }
      time += Math.max(0, dt);
      absent = near ? 0 : absent + Math.max(0, dt);
      if (absent > 1) armed = true;
      if (phase === "task" && near && armed && time >= cooldown && !traveling) {
        phase = "notice";
        entered = time;
        armed = false;
      }
      while (phase !== "task" && time - entered >= durations[phase]) {
        entered += durations[phase];
        phase = { notice: "greet", greet: "listen", listen: "return", return: "task" }[phase];
        if (phase === "greet") {
          gesture = "hello";
          greetings++;
          cooldown = entered + 18;
        }
        if (phase === "listen") gesture = "listen";
        if (phase === "return" || phase === "task") gesture = null;
      }
      if (!near && (phase === "notice" || phase === "listen")) {
        phase = "return";
        entered = time;
      }
      if (time >= nextBlink) {
        blinkStart = time;
        nextBlink = time + 3.5 + random() * 4;
      }
      const blinkAge = time - blinkStart;
      const blink = blinkAge < 0.18 ? Math.sin((Math.PI * blinkAge) / 0.18) : 0;
      const attention = phase === "task" ? 0 : phase === "return" ? 1 - minimumJerk((time - entered) / durations.return) : 1;
      // Small deliberate task glances survive habituation. A visitor sees a
      // complete greeting, a listening beat, then a quiet return to the room.
      return {
        phase,
        phaseAge: time - entered,
        gaze: mix(task, pointer, attention),
        gesture,
        hold: phase !== "task",
        blink,
        time,
        greetings,
        cooldown: Math.max(0, cooldown - time),
      };
    },
  };
}

// Round circulation corners inside a 12 cm envelope. Straight corridors and
// stair support stay authored; an unconstrained spline could cut furniture.
export function createPipFlight(points) {
  const unique = points.filter((p, i) => !i || distance(p, points[i - 1]) > 0.001);
  if (unique.length < 2) unique.push([...unique[0]]);
  const path = [[...unique[0]]];
  for (let i = 1; i < unique.length - 1; i++) {
    const a = unique[i - 1],
      b = unique[i],
      c = unique[i + 1];
    const radius = Math.min(0.12, distance(a, b) * 0.22, distance(b, c) * 0.22);
    const entry = mix(b, a, radius / distance(a, b)),
      exit = mix(b, c, radius / distance(b, c));
    path.push(entry);
    for (let j = 1; j <= 6; j++) {
      const u = j / 6;
      path.push(mix(mix(entry, b, u), mix(b, exit, u), u));
    }
  }
  path.push([...unique.at(-1)]);
  const distances = [0];
  for (let i = 1; i < path.length; i++) distances.push(distances.at(-1) + distance(path[i - 1], path[i]));
  const length = distances.at(-1);
  // Quintic peak speed is 1.875 times average. Never exceed 1.6 m/s.
  const travel = Math.max(1.05, (length * 1.875) / 1.6);
  return { points: path, distances, length, anticipate: 0.34, travel, settle: 0.75, duration: 0.34 + travel + 0.75 };
}

export function samplePipFlight(flight, time) {
  const { anticipate, travel, settle } = flight;
  const age = clamp(time - anticipate, 0, travel);
  const pointAt = (t) => {
    const d = minimumJerk(clamp(t / travel, 0, 1)) * flight.length;
    let i = flight.distances.findIndex((v) => v > d);
    if (i < 1) return [...flight.points.at(-1)];
    const span = flight.distances[i] - flight.distances[i - 1];
    return mix(flight.points[i - 1], flight.points[i], span > 0 ? (d - flight.distances[i - 1]) / span : 0);
  };
  const position = pointAt(age),
    before = pointAt(Math.max(0, age - 0.012)),
    after = pointAt(Math.min(travel, age + 0.012));
  const window = Math.min(travel, age + 0.012) - Math.max(0, age - 0.012);
  const velocity = window ? after.map((v, i) => (v - before[i]) / window) : [0, 0, 0];
  const direction = time < anticipate ? flight.points[1].map((v, i) => v - position[i]) : velocity;
  const settleAge = Math.max(0, time - anticipate - travel);
  const phase = time < anticipate ? "anticipate" : time < anticipate + travel ? "fly" : time < flight.duration ? "settle" : "rest";
  // One damped settling beat, less than 1 cm, above the support plane.
  const lift = phase === "settle" ? Math.sin((Math.PI * settleAge) / settle) * Math.exp(-settleAge * 4) * 0.018 : 0;
  return { position, velocity, direction, phase, lift, done: time >= flight.duration };
}
