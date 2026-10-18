// Brown pelicans and Brandt's cormorants, sampled from active scene time like the other animals.
// Pelicans glide in a line low over the swell, riding the displaced sea surface the renderer
// draws; each bird repeats the leader's flaps at the same place, so a wave of wingbeats runs
// down the line. Now and then the last bird climbs, folds and plunge-dives, sits on the swell to
// swallow, runs off the water and trails the line until it has caught up with its slot.
import {
  activeTime,
  clamp01,
  epochAt,
  flightAttitude,
  glanceKeys,
  hash,
  noise,
  pulse,
  segmentAt,
  smooth,
  sprung,
  transfer,
  window01,
  wingbeat,
} from "./wildlife-acting.mjs";
import { sampleOcean } from "./ocean-spectrum.mjs";

const TAU = Math.PI * 2;
const SEA_LEVEL = -7.35;
const OCEAN_Z = 28;
const blinkAt = (t, seed, period = 6) => {
  const k = Math.floor(t / period),
    at = k * period + hash(seed, k, 41) * (period - 0.4);
  return pulse((t - at) / 0.18);
};
// `sea` is the coast's oceanWindState; without it the authored spectrum is sampled.
export const seaSurface = (x, z, time, footprint = 2.4, sea = null) => SEA_LEVEL + sampleOcean(x, z + OCEAN_Z, time, footprint, sea).displacement[1];

// ---------------------------------------------------------------- pelican route

// A closed loop: the low pass runs west along the bay just beyond the surf, then the line climbs
// out to sea, returns east behind the outside camera and descends back to the swell.
const ROUTE = [
  [46, -24.5, 0],
  [22, -25, 0],
  [0, -25.8, 0],
  [-22, -25, 0],
  [-46, -25.5, 0],
  [-64, -42, 0.55],
  [-56, -72, 1],
  [-20, -84, 1],
  [20, -84, 1],
  [58, -72, 1],
  [66, -43, 0.55],
];
const SAMPLES = 720;
const route = (() => {
  const n = ROUTE.length,
    points = [];
  const cubic = (a, b, c, d, u) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  for (let i = 0; i < SAMPLES; i++) {
    const g = (i / SAMPLES) * n,
      k = Math.floor(g),
      u = g - k;
    const p = [k - 1, k, k + 1, k + 2].map((m) => ROUTE[((m % n) + n) % n]);
    points.push([0, 1, 2].map((axis) => cubic(p[0][axis], p[1][axis], p[2][axis], p[3][axis], u)));
  }
  const lengths = [0];
  for (let i = 1; i <= SAMPLES; i++) {
    const a = points[i - 1],
      b = points[i % SAMPLES];
    lengths.push(lengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { points, lengths, length: lengths[SAMPLES] };
})();
export const PELICAN_ROUTE_LENGTH = route.length;
const PELICAN_SPEED = 4.3;
const SPACING = 4.4;
const LATERAL = [0, 0.55, -0.35, 0.7, -0.25];
const HIGH = 7.5;

function routeAt(s) {
  const L = route.length,
    d = ((s % L) + L) % L;
  let low = 0,
    high = SAMPLES - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (route.lengths[middle] <= d) low = middle;
    else high = middle - 1;
  }
  const a = route.points[low],
    b = route.points[(low + 1) % SAMPLES];
  const u = (d - route.lengths[low]) / (route.lengths[low + 1] - route.lengths[low] || 1);
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

// Position on the route at arc length s, offset sideways and riding the swell on the low pass.
function routePosition(s, time, lateral = 0, sea = null) {
  const p = routeAt(s),
    q = routeAt(s + 0.5),
    r = routeAt(s - 0.5);
  const dx = q[0] - r[0],
    dz = q[1] - r[1],
    norm = Math.hypot(dx, dz) || 1;
  const x = p[0] + (dz / norm) * lateral,
    z = p[1] - (dx / norm) * lateral;
  const low = seaSurface(x, z, time, 2.4, sea) + 0.95;
  return [x, low + (HIGH - low) * smooth(p[2]), z];
}

function routeState(s, time, lateral, speed = PELICAN_SPEED, sea = null) {
  const h = 0.02,
    dt = h / speed;
  const a = routePosition(s - h, time - dt, lateral, sea),
    b = routePosition(s, time, lateral, sea),
    c = routePosition(s + h, time + dt, lateral, sea);
  return {
    position: b,
    velocity: b.map((value, axis) => (c[axis] - a[axis]) / (2 * dt)),
    acceleration: b.map((value, axis) => (c[axis] - 2 * value + a[axis]) / (dt * dt)),
  };
}

// Flap zones along the route: the climb out, and four-beat bouts every ~45 m of the low pass.
const BEAT = 1.6;
function flapAt(s) {
  const L = route.length,
    d = ((s % L) + L) % L;
  const climb = window01(d, route.length * 0.37, route.length * 0.47, 6, 6);
  const zone = Math.floor((d - 6) / 46),
    start = 6 + zone * 46 + hash(91, zone) * 8,
    span = (4 * PELICAN_SPEED) / BEAT;
  const bout = d < route.length * 0.34 ? window01(d, start, start + span, 1.2, 1.2) : 0;
  return { flap: Math.max(climb, bout), phase: ((d - start) * BEAT) / PELICAN_SPEED };
}

// ---------------------------------------------------------------- dives

// Only the last bird of the line dives, so it never has to overtake another to regain its slot,
// and only on even laps, so each catch-up ends before its next dive.
const DIVE = { climb: 2.4, dive: 3.75, surface: 5.2, float: 13, airborne: 15.5 };
export const PELICAN_DIVER = 4;
const LEAD = 40; // the leader is 40 m into the low pass at time 0, so the line starts in view
const diveCache = new Map();
const S1 = (u) => u ** 4 * (2.5 - 3 * u + u * u); // integral of the quintic ease from 0 to u
export function pelicanDive(lap) {
  if (diveCache.has(lap)) return diveCache.get(lap);
  let dive = null;
  if (lap % 2 === 0 && hash(17, lap, 1) < 0.75) {
    const sDive = 30 + hash(17, lap, 2) * 22;
    const start = (lap * route.length + sDive + PELICAN_DIVER * SPACING - LEAD) / PELICAN_SPEED;
    const at = routeState(sDive, start, LATERAL[PELICAN_DIVER]);
    const norm = Math.hypot(at.velocity[0], at.velocity[2]) || 1;
    const forward = [at.velocity[0] / norm, 0, at.velocity[2] / norm];
    const sJoin = sDive + 18;
    // The slot is ahead by what the line flew while this bird climbed, dived, floated and ran.
    const gap = sDive + PELICAN_SPEED * DIVE.airborne - sJoin;
    dive = { lap, sDive, start, origin: at.position, forward, sJoin, join: start + DIVE.airborne, gap, catchUp: gap / (0.2 * PELICAN_SPEED) + 4 };
  }
  diveCache.set(lap, dive);
  if (diveCache.size > 12) diveCache.delete(diveCache.keys().next().value);
  return dive;
}

// Route distance flown since rejoining: 20 % faster, eased in and out over 4 s, until the gap closes.
function catchUpDistance(local, total) {
  const tau = Math.max(0, local);
  let boost;
  if (tau <= 4) boost = 4 * S1(tau / 4);
  else if (tau <= total - 4) boost = 2 + (tau - 4);
  else if (tau <= total) boost = total - 6 + (tau - total + 4) - 4 * S1((tau - total + 4) / 4);
  else boost = total - 4;
  return PELICAN_SPEED * tau + 0.2 * PELICAN_SPEED * boost;
}

const V_SLOW = 1.8;
function divingPose(dive, t, sea = null) {
  const tau = t - dive.start,
    f = dive.forward,
    o = dive.origin;
  const at = (d, height) => [o[0] + f[0] * d, height, o[2] + f[2] * d];
  const water = (d) => seaSurface(o[0] + f[0] * d, o[2] + f[2] * d, t, 2.4, sea);
  const climbLength = ((PELICAN_SPEED + V_SLOW) / 2) * DIVE.climb;
  if (tau < DIVE.climb) {
    // Climb and slow, flapping, to about six metres above the swell.
    const d = PELICAN_SPEED * tau - ((PELICAN_SPEED - V_SLOW) * tau * tau) / (2 * DIVE.climb);
    return {
      state: "climb",
      position: at(d, water(d) + 0.95 + 5.25 * smooth(tau / DIVE.climb)),
      flap: 1,
      pitch: -0.35 * Math.sin((Math.PI * tau) / DIVE.climb),
      fold: 0,
      roll: 0,
    };
  }
  const fall = DIVE.dive - DIVE.climb;
  if (tau < DIVE.dive) {
    // Tip over and fall, wings swept back, with a quarter twist, gaining speed to the water.
    const u = (tau - DIVE.climb) / fall;
    const d = climbLength + V_SLOW * fall * (u - 0.15 * u * u);
    const top = water(climbLength) + 6.2;
    return {
      state: "dive",
      position: at(d, top - (top - water(d) + 0.25) * u * u),
      flap: 0,
      pitch: 0.35 + 1.0 * smooth(u * 1.5),
      fold: smooth(u * 2.2),
      roll: 0.7 * Math.sin(Math.PI * u),
    };
  }
  const entry = climbLength + V_SLOW * fall * 0.85;
  if (tau < DIVE.surface) {
    const u = (tau - DIVE.dive) / (DIVE.surface - DIVE.dive);
    const d = entry + 0.7 * smooth(u);
    // Carried on from the entry 0.25 m down, about 0.8 m deep, then bobbing back up to float.
    const depth = (0.25 + 0.55 * Math.sin(Math.PI * u)) * (1 - smooth((u - 0.55) / 0.45));
    return {
      state: u < 0.55 ? "under" : "surface",
      position: at(d, water(d) - depth),
      flap: 0,
      pitch: 1.35 * (1 - smooth(u * 1.4)),
      fold: 1,
      roll: 0,
      splash: 1 - u,
    };
  }
  const floatAt = entry + 0.7;
  if (tau < DIVE.float) {
    const u = tau - DIVE.surface;
    const d = floatAt + 0.25 * Math.sin(u * 0.4);
    return {
      state: u > 0.4 && u < 2.4 ? "gulp" : "float",
      position: at(d, water(d)),
      flap: 0,
      pitch: 0,
      fold: 1,
      roll: 0,
      gulp: window01(u, 0.4, 2.4, 0.4, 0.6),
      shake: pulse((u - 4.2) / 0.7),
    };
  }
  // Run off the water and rejoin the route as a straggler.
  const last = floatAt + 0.25 * Math.sin((DIVE.float - DIVE.surface) * 0.4);
  const floating = {
    position: at(last, seaSurface(o[0] + f[0] * last, o[2] + f[2] * last, dive.start + DIVE.float, 2.4, sea)),
    velocity: [0, 0, 0],
    acceleration: [0, 0, 0],
  };
  const joinState = routeState(dive.lap * route.length + dive.sJoin, dive.join, LATERAL[PELICAN_DIVER], PELICAN_SPEED, sea);
  const u = (tau - DIVE.float) / (DIVE.airborne - DIVE.float);
  const pose = transfer(floating, joinState, u, DIVE.airborne - DIVE.float, 0.15);
  return {
    state: "takeoff",
    ...pose,
    flap: 1,
    pitch: -0.18 * Math.sin(Math.PI * u),
    fold: 1 - smooth(u * 4),
    roll: 0,
    patter: 1 - smooth((u - 0.55) / 0.3),
  };
}

export function pelicanMotion(time, index, sea = null) {
  const t = activeTime(time);
  const slot = PELICAN_SPEED * t + LEAD - index * SPACING;
  const lap = Math.floor(slot / route.length);
  let s = slot,
    special = null,
    trailing = false;
  if (index === PELICAN_DIVER) {
    for (const candidate of [pelicanDive(lap), pelicanDive(lap - 1)]) {
      if (!candidate) continue;
      const local = t - candidate.start;
      if (local >= 0 && local < DIVE.airborne) special = { ...divingPose(candidate, t, sea), dive: candidate };
      else if (local >= DIVE.airborne && local < DIVE.airborne + candidate.catchUp) {
        s = candidate.lap * route.length + candidate.sJoin + catchUpDistance(local - DIVE.airborne, candidate.catchUp);
        trailing = true;
      }
      if (special) break;
    }
  }
  const flight = special?.velocity ? special : special ? null : routeState(s, t, LATERAL[index], PELICAN_SPEED, sea);
  const attitude = flight ? flightAttitude(flight.velocity, flight.acceleration, { gravity: 3.4, maxBank: 0.5 }) : null;
  const heading = special ? Math.atan2(special.dive.forward[0], special.dive.forward[2]) : 0;
  const zone = flapAt(s);
  const flap = special ? special.flap : trailing ? Math.max(zone.flap, 0.35) : zone.flap;
  const beat = wingbeat(special || trailing ? t * BEAT * (special ? 1.25 : 1) : zone.phase, 0.14);
  const onWater = special ? ["float", "gulp", "surface", "under"].includes(special.state) : false;
  const gulp = special?.gulp ?? 0;
  return {
    position: (special ?? flight).position,
    velocity: flight ? flight.velocity : [0, 0, 0],
    routeDistance: s,
    state: special ? special.state : trailing ? "trail" : flap > 0.4 ? "flap" : "glide",
    yaw: special && special.state !== "takeoff" ? heading : attitude.yaw,
    pitch: special && special.state !== "takeoff" ? special.pitch : attitude.pitch * 0.6 + (special ? special.pitch : 0),
    bank: special ? special.roll : attitude.bank,
    speed: attitude ? attitude.speed : 0,
    wingFold: special ? special.fold : 0,
    wingBeat: flap * beat.stroke * 0.42,
    wingTipLag: flap * beat.lag * 0.42,
    flap,
    downstroke: beat.downstroke,
    wingSweep: special?.state === "dive" ? 0.6 : 0.08,
    neck: onWater ? 1 - gulp : 0,
    gulp,
    shake: special?.shake ?? 0,
    jaw: gulp * (0.25 + 0.1 * Math.sin(t * 9)),
    patter: special?.patter ?? 0,
    splash: special?.splash ?? 0,
    onWater,
    headYaw: noise(t * 0.4, index + 3) * 0.12,
    blink: blinkAt(t, 200 + index, 5),
  };
}

// ---------------------------------------------------------------- cormorants

export const CORMORANT_EPOCH = 70;
const cormorantPlans = new Map();
function cormorantPlan(index, k, start, end) {
  const key = `${index}:${k}`;
  if (cormorantPlans.has(key)) return cormorantPlans.get(key);
  const h = (n, m = 0) => hash(800 + index, k, n * 19 + m);
  const segments = [];
  let t = start;
  const push = (kind, duration) => {
    segments.push({ kind, start: t, end: t + duration });
    t += duration;
  };
  push("stand", 2 + h(1) * 4);
  const menu = ["look", "dry", "preen", "dry", "shake", "stretch", "look", "dry"];
  for (let n = 0; t < end - 10; n++) {
    const kind = menu[Math.floor(h(2, n) * menu.length)];
    const duration = { look: 4 + h(3, n) * 4, dry: 14 + h(4, n) * 18, preen: 4 + h(5, n) * 3, shake: 1.6, stretch: 2.6 }[kind];
    push(kind, Math.min(duration, end - 5 - t));
    push("stand", Math.min(1 + h(6, n) * 3, Math.max(0, end - t)));
  }
  if (t < end) push("stand", end - t);
  segments.at(-1).end = end;
  const names = ["yaw", "pitch", "neck", "spread", "preen", "gape"];
  const keys = Object.fromEntries(names.map((name) => [name, [[start, 0]]]));
  const set = (time, targets) => {
    for (const [name, value] of Object.entries(targets)) keys[name].push([time, value]);
  };
  segments.forEach((segment, i) => {
    const s = segment.start,
      e = segment.end,
      back = Math.max(s + 0.5, e - 1.1);
    if (segment.kind === "look" || segment.kind === "dry")
      glanceKeys(keys, s + (segment.kind === "dry" ? 1.4 : 0), back, 810 + index * 31 + k * 7 + i, { yaw: 0.65, pitch: 0.12, hold: [0.6, 2.2] });
    if (segment.kind === "dry") {
      set(s, { spread: 1 });
      set(back, { spread: 0 });
    }
    if (segment.kind === "preen") {
      const side = h(7, i) < 0.5 ? 1 : -1;
      set(s, { preen: side, neck: 0.5, pitch: 0.4 });
      set(back, { preen: 0, neck: 0, pitch: 0 });
    }
    if (segment.kind === "stretch") {
      set(s, { neck: -0.45, pitch: -0.55, gape: 1 });
      set(back, { neck: 0, pitch: 0, gape: 0 });
    }
  });
  for (const list of Object.values(keys)) list.sort((a, b) => a[0] - b[0]);
  const plan = { segments, keys };
  cormorantPlans.set(key, plan);
  if (cormorantPlans.size > 16) cormorantPlans.delete(cormorantPlans.keys().next().value);
  return plan;
}

export function cormorantMotion(time, index) {
  const t = activeTime(time) + index * 13.3;
  const epoch = epochAt(t, CORMORANT_EPOCH, 0.15, 820 + index);
  const plan = cormorantPlan(index, epoch.k, epoch.start, epoch.end);
  const { segment } = segmentAt(plan.segments, t);
  const local = t - segment.start;
  const k = plan.keys;
  const spread = sprung(k.spread, t, 1.1, 0.75);
  const drying = segment.kind === "dry" ? window01(t, segment.start + 1, segment.end - 1, 1, 1) : 0;
  // While drying, the wings shrug and now and then fan in a few slow beats.
  const fanWindow = Math.floor(local / 6),
    fanStart = segment.start + fanWindow * 6 + hash(index, fanWindow + epoch.k * 50, 3) * 2;
  const fanning = drying * (hash(index, fanWindow + epoch.k * 50, 4) < 0.45 ? window01(t, fanStart, fanStart + 2.5, 0.4) : 0);
  const shaking = segment.kind === "shake" ? window01(t, segment.start, segment.end, 0.2, 0.4) : 0;
  const preen = sprung(k.preen, t, 2, 0.8);
  // Gular flutter: the throat pulses in bursts while standing in the sun.
  const flutterBurst = Math.floor(t / 4.3);
  const flutter =
    (segment.kind !== "stretch" ? 1 : 0) *
    (hash(index, flutterBurst, 5) < 0.5 ? window01(t, flutterBurst * 4.3, flutterBurst * 4.3 + 2.2, 0.2, 0.3) : 0) *
    Math.sin(t * TAU * 5.5);
  return {
    state: segment.kind,
    epoch: epoch.k,
    bodyPitch: -0.95 + noise(t * 0.2, index) * 0.03 + shaking * 0.05 * Math.sin(local * 30),
    neckPitch: sprung(k.neck, t, 2, 0.6),
    headPitch: sprung(k.pitch, t, 3, 0.65),
    headYaw: sprung(k.yaw, t, 3.4, 0.72) + preen * 1.2,
    preen,
    spread,
    shrug: drying * (0.06 * Math.sin(t * 0.9 + index) + 0.04 * noise(t * 0.5, index + 7)),
    fanBeat: fanning * Math.sin(t * TAU * 1.1),
    gape: sprung(k.gape, t, 3, 0.7) * 0.35,
    flutter: flutter * 0.05,
    shake: shaking * Math.sin(local * 34) * 0.15,
    tailFan: drying * 0.35,
    blink: blinkAt(t, 830 + index, 5),
  };
}
