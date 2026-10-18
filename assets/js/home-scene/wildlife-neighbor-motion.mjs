// Deterministic authored neighbours, sampled from active scene time. Planted
// contacts and flight derivatives are explicit; this is not a dynamics solver.
import {
  activeTime,
  clamp01,
  epochAt,
  flightAttitude,
  glanceKeys,
  hash,
  noise,
  planCache,
  pulse,
  segmentAt,
  smooth,
  sprung,
  transfer,
  window01,
  wingbeat,
  wrap,
} from "./wildlife-acting.mjs";
import { sampleOcean } from "./ocean-spectrum.mjs";
import { beachPoint } from "./shore.mjs";

const TAU = Math.PI * 2;
const mix = (a, b, u) => a.map((value, index) => value + (b[index] - value) * u);
const blinkAt = (t, seed, period = 7) => {
  const k = Math.floor(t / period),
    at = k * period + hash(seed, k, 41) * (period - 0.4);
  return pulse((t - at) / 0.18);
};

export function createHabitatRoute(path) {
  const lengths = path.map((point, index) =>
    Math.hypot(point[0] - path[(index + 1) % path.length][0], point[2] - path[(index + 1) % path.length][2])
  );
  const length = lengths.reduce((sum, value) => sum + value, 0);
  const vertices = [];
  let station = 0;
  for (let index = 0; index < path.length; index++) {
    vertices.push(station);
    station += lengths[index];
  }
  const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const tangent = (index) => {
    const from = path[index],
      to = path[(index + 1) % path.length];
    return { yaw: Math.atan2(to[0] - from[0], to[2] - from[2]), slope: Math.atan2(to[1] - from[1], lengths[index]) };
  };
  const gradients = path.map((origin, index) => {
    let xx = 0,
      xz = 0,
      zz = 0,
      xy = 0,
      zy = 0;
    for (const point of path) {
      const x = point[0] - origin[0],
        z = point[2] - origin[2],
        y = point[1] - origin[1];
      const radius = Math.hypot(x, z);
      if (radius > 0.75) continue;
      const weight = Math.exp((-radius * radius) / 0.18);
      xx += x * x * weight;
      xz += x * z * weight;
      zz += z * z * weight;
      xy += x * y * weight;
      zy += z * y * weight;
    }
    const determinant = xx * zz - xz * xz;
    if (determinant > (xx + zz) ** 2 * 0.01) return [(xy * zz - zy * xz) / determinant, (zy * xx - xy * xz) / determinant];
    const direction = tangent(index),
      grade = Math.tan(direction.slope);
    return [Math.sin(direction.yaw) * grade, Math.cos(direction.yaw) * grade];
  });
  function point(distance) {
    let d = wrap(distance, length);
    for (let index = 0; index < path.length; index++) {
      if (d <= lengths[index] || index === path.length - 1) return mix(path[index], path[(index + 1) % path.length], d / lengths[index]);
      d -= lengths[index];
    }
  }
  function sample(distance) {
    const position = point(distance),
      d = wrap(distance, length);
    let segment = vertices.findLastIndex((vertex) => vertex <= d),
      { yaw, slope } = tangent(segment);
    let strongest = 0;
    for (let index = 0; index < vertices.length; index++) {
      // The initial preview begins facing the first segment, rather than
      // inheriting a fictional pre-scene stance on the closing half-turn.
      if (index === 0 && distance < 0.35) continue;
      const delta = wrap(d - vertices[index] + length / 2, length) - length / 2;
      if (Math.abs(delta) >= 0.35) continue;
      const before = tangent((index + path.length - 1) % path.length),
        after = tangent(index);
      const turn = angleDelta(before.yaw, after.yaw),
        strength = Math.abs(turn) * (1 - Math.abs(delta) / 0.35);
      if (strength <= strongest) continue;
      strongest = strength;
      const blend = smooth((delta + 0.35) / 0.7);
      yaw = before.yaw + turn * blend;
      slope = before.slope + (after.slope - before.slope) * blend;
    }
    const segmentU = (d - vertices[segment]) / lengths[segment];
    const gradient = mix(gradients[segment], gradients[(segment + 1) % path.length], segmentU);
    slope = Math.atan(gradient[0] * Math.sin(yaw) + gradient[1] * Math.cos(yaw));
    return { position, yaw, slope, gradient };
  }
  return { length, point, sample };
}

export function plantedFoot(distance, offset, stride = 0.18, stance = 0.68) {
  const phase = distance / stride + offset,
    cycle = Math.floor(phase),
    u = phase - cycle;
  const anchor = (cycle - offset + stance * 0.5) * stride;
  const swing = clamp01((u - stance) / (1 - stance));
  return {
    anchorDistance: anchor + stride * smooth(swing),
    lift: u <= stance ? 0 : Math.sin(Math.PI * swing) ** 2,
    contact: u <= stance,
    phase: u,
  };
}

// ---------------------------------------------------------------- raccoon

// Nocturnal: by day it sleeps curled at its den (the start of its clifftop loop); when the
// house's evening begins it wakes, stretches and forages, digging, rearing up to sniff and
// washing food in its paws; at dawn it walks on round to the den and curls up again.
export const RACCOON_EPOCH = 60;
// A whole number of strides per lap, so the den's foot anchors are the same on every lap.
export const raccoonStride = (routeLength) => routeLength / Math.max(1, Math.round(routeLength / 0.16));
const RACCOON_WAKE = 7;
const RACCOON_STEP = 0.55;
const raccoonPlans = planCache((k, routeLength) => {
  const h = (n, m = 0) => hash(911, k, n * 23 + m);
  const start = 0,
    end = RACCOON_EPOCH;
  const segments = [];
  let t = start;
  const push = (kind, duration) => {
    segments.push({ kind, start: t, end: t + duration });
    t += duration;
  };
  const menu = ["dig", "stand", "wash", "sniff", "dig", "stand"];
  push("walk", 6 + h(1) * 4);
  for (let n = 0; t < end - 16; n++) {
    push(menu[Math.floor(h(2, n) * menu.length)], 3.5 + h(3, n) * 3);
    if (t < end - 12) push("walk", 4 + h(4, n) * 5);
  }
  push("look", end - t);
  const walks = segments.filter((segment) => segment.kind === "walk");
  const time = walks.reduce((sum, segment) => sum + segment.end - segment.start, 0);
  let travelled = 0;
  for (const walk of walks) {
    walk.d0 = travelled;
    travelled += ((walk.end - walk.start) / time) * RACCOON_STEP * routeLength;
    walk.d1 = travelled;
  }
  const keys = { yaw: [[start, 0]], pitch: [[start, 0]] };
  segments.forEach((segment, i) => {
    if (segment.kind === "look" || segment.kind === "stand" || segment.kind === "sniff")
      glanceKeys(keys, segment.start, Math.min(segment.end, end - 2), 977 + k * 11 + i, { yaw: 0.55, pitch: 0.15, hold: [0.5, 1.4] });
  });
  for (const list of Object.values(keys)) list.sort((a, b) => a[0] - b[0]);
  return { segments, keys };
}, 6);

// Distance along the loop at night, with the forage plan in effect.
function forage(local, routeLength) {
  if (local < RACCOON_WAKE) return { distance: 0, segment: { kind: "wake", start: 0, end: RACCOON_WAKE }, local, k: -1, plan: null };
  const shifted = local - RACCOON_WAKE,
    k = Math.floor(shifted / RACCOON_EPOCH),
    within = shifted - k * RACCOON_EPOCH;
  const plan = raccoonPlans(k, routeLength);
  const { segment } = segmentAt(plan.segments, within);
  let distance = k * RACCOON_STEP * routeLength;
  for (const walk of plan.segments) {
    if (walk.kind !== "walk") continue;
    if (within >= walk.end) distance = k * RACCOON_STEP * routeLength + walk.d1;
    else if (within >= walk.start)
      distance = k * RACCOON_STEP * routeLength + walk.d0 + (walk.d1 - walk.d0) * smooth((within - walk.start) / (walk.end - walk.start));
  }
  return { distance, segment, local: within, k, plan };
}

export function raccoonMotion(time, evening = false, routeLength = 5.25, palette = {}) {
  const t = activeTime(time);
  const night = palette.night ?? evening;
  const nightStart = palette.nightStart ?? (night ? -1e4 : -2e4);
  const dayStart = palette.dayStart ?? (night ? -2e4 : -1e4);
  let mode, distance, segment, local, plan, sleep;
  if (night) {
    const state = forage(t - nightStart, routeLength);
    ({ distance, segment, local, plan } = state);
    mode = segment.kind === "wake" ? "wake" : "forage";
    sleep = segment.kind === "wake" ? 1 - smooth((local - 0.6) / 3.2) : 0;
  } else {
    // Walk on to the den at the start of the next lap, then lie down and curl.
    const dawn = dayStart > nightStart ? forage(dayStart - nightStart, routeLength).distance : 0;
    const lapEnd = Math.ceil(dawn / routeLength - 1e-9) * routeLength;
    const walkTime = (lapEnd - dawn) / 0.28;
    const since = t - dayStart;
    if (since < walkTime) {
      distance = dawn + (lapEnd - dawn) * smooth(since / Math.max(1e-6, walkTime));
      segment = { kind: "walk", start: dayStart, end: dayStart + walkTime };
      mode = "return";
      sleep = 0;
    } else {
      distance = lapEnd;
      mode = "sleep";
      segment = { kind: "sleep", start: dayStart + walkTime, end: Infinity };
      sleep = smooth((since - walkTime) / 3);
    }
    local = since;
    plan = null;
  }
  const kind = segment.kind;
  const segLocal = mode === "forage" ? local - segment.start : t - (mode === "return" ? dayStart : nightStart);
  const live = (name, rise = 0.6, fall = 0.6) => (kind === name && mode === "forage" ? window01(local, segment.start, segment.end, rise, fall) : 0);
  const walking =
    kind === "walk"
      ? mode === "return"
        ? smooth(segLocal / 0.5) * (1 - smooth((segLocal - (segment.end - segment.start) + 0.6) / 0.6))
        : window01(local, segment.start, segment.end, 0.4, 0.5)
      : 0;
  const dig = live("dig");
  const stand = live("stand", 0.9, 0.9);
  const wash = live("wash", 0.8, 0.8);
  const sniff = live("sniff", 0.4, 0.4);
  const wake = mode === "wake" ? local : Infinity;
  const stretch = mode === "wake" ? pulse((local - 3.4) / 2.2) : 0;
  const shake = mode === "wake" ? pulse((local - 5.8) / 0.8) : 0;
  const keys = plan?.keys;
  const glanceYaw = keys && mode === "forage" ? sprung(keys.yaw, local, 3, 0.7) : 0;
  const glancePitch = keys && mode === "forage" ? sprung(keys.pitch, local, 3, 0.7) : 0;
  const wakeLook = mode === "wake" ? Math.sin(local * 2.1) * pulse((local - 1) / 2.4) * 0.5 : 0;
  const breathRate = sleep > 0.5 ? 0.25 : 0.42;
  const strideRate = walking * 1.6;
  const stridePhase = distance / raccoonStride(routeLength);
  return {
    distance,
    activity: walking,
    mode,
    state: mode === "sleep" ? "sleep" : mode === "wake" ? "wake" : mode === "return" ? "walk" : kind,
    sleep,
    dig,
    stand,
    wash,
    sniff,
    stretch,
    shake,
    headYaw: glanceYaw + wakeLook + noise(t * 0.4, 5) * 0.05 * (1 - sleep) + sleep * 0.9,
    headPitch: glancePitch + dig * 0.42 + wash * 0.38 + walking * 0.14 + sniff * 0.3 * Math.sin(segLocal * 9) * 0.25 - stand * 0.25 + sleep * 0.42,
    // A gentle bob at twice the stride frequency; the hips sway against the shoulders.
    bodyBob: walking * Math.sin(stridePhase * TAU * 2) * 0.008,
    hipsYaw: walking * Math.sin(stridePhase * TAU) * 0.06,
    chestPitch: -stand * 1.05 - wash * 0.55 + dig * 0.18 + stretch * 0.32,
    hipsPitch: stand * 0.25 + wash * 0.35 - dig * 0.08 - stretch * 0.28,
    curl: sleep,
    earAnswer: pulse(wrap(t / 6.3, 1) / 0.08) * 0.15 * (sleep > 0.5 ? 0.6 : 1),
    tailYaw: Math.sin(t * 0.45 - 0.35) * (0.035 + walking * 0.055) - walking * Math.sin(stridePhase * TAU - 0.9) * 0.12 + sleep * 0.75,
    tailCurl: sleep * 0.8 + stand * 0.2,
    tailLift: walking * 0.1 + stand * -0.25 - sleep * 0.1,
    shakeRoll: shake * Math.sin(segLocal * 38) * 0.18,
    pawScrub: dig * Math.sin(segLocal * TAU * 2.6) + wash * Math.sin(segLocal * TAU * 3.4),
    breath: Math.sin(t * TAU * breathRate) * (sleep > 0.5 ? 0.02 : 0.01),
    blink: Math.max(blinkAt(t, 919, 5), sleep * (0.92 + 0.08 * Math.sin(t))),
    wake: Number.isFinite(wake) ? wake : null,
    strideRate,
    headYawLegacy: glanceYaw,
  };
}

// ---------------------------------------------------------------- sandpipers (sanderlings)

// Sanderlings sprint with the swash: they run up the beach ahead of each wave's run-up and
// chase the drawdown to probe the freshly exposed sand. The water's edge is solved from the
// same displaced sea surface the renderer draws (sampleOcean at the vertex footprint) meeting
// the shared beach section, so the birds track the waves the visitor actually sees.
export const SANDPIPER_HOMES = [-0.8, 2.3, 5.2];
const TICK = 0.5;
const SEA_LEVEL = -7.35;
const OCEAN_Z = 28; // the sea mesh is centred 28 m offshore; its spectrum uses mesh-local z

export function swashEdge(x, time, beach, sea = null) {
  let low = 0.12,
    high = 0.78;
  const wet = (fraction) => {
    const point = beachPoint(x, fraction, beach);
    return SEA_LEVEL + sampleOcean(x, point[2] + OCEAN_Z, time, 1.1, sea).displacement[1] - point[1];
  };
  if (wet(low) > 0) return low;
  if (wet(high) < 0) return high;
  for (let i = 0; i < 16; i++) {
    const middle = (low + high) / 2;
    if (wet(middle) > 0) high = middle;
    else low = middle;
  }
  return (low + high) / 2;
}

const sandpiperStates = new Map();
function sandpiperState(index, beach) {
  let state = sandpiperStates.get(index);
  if (!state || state.beach !== beach) {
    state = { beach, targets: new Map(), points: new Map(), pointCheckpoints: new Map(), segments: new Map(), checkpoints: new Map([[0, 0]]) };
    sandpiperStates.set(index, state);
  }
  return state;
}

function sandpiperTarget(state, index, j) {
  if (state.targets.has(j)) return state.targets.get(j);
  const time = Math.max(0, j * TICK);
  const home = SANDPIPER_HOMES[index % SANDPIPER_HOMES.length];
  const x = home + 1.15 * noise(time / 9 + index * 3.1, index * 13 + 1) + 0.35 * noise(time / 2.6, index * 17 + 2);
  let edge = Infinity;
  for (let q = 0; q <= 5; q++) edge = Math.min(edge, swashEdge(x, time + q * 0.25, state.beach, state.sea));
  // A margin of 0.2-0.6 m of wet sand; now and then the bird lingers to probe where it is.
  const margin = 0.012 + 0.022 * hash(index, j, 3);
  const target = { x, f: Math.max(0.16, edge - margin) };
  state.targets.set(j, target);
  if (state.targets.size > 160) state.targets.delete(state.targets.keys().next().value);
  return target;
}

// Speed-limited path points: each tick the bird moves toward its swash target by at most 1.15 m
// (a 2.3 m/s sprint). The recursion is cached with checkpoints every 32 ticks, so any time
// still maps to the same point, however the frames fall.
const MAX_STEP = 1.15;
function stepToward(beach, from, to) {
  const a = beachPoint(from.x, from.f, beach),
    b = beachPoint(to.x, to.f, beach);
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    distance = Math.hypot(dx, dz);
  if (distance <= MAX_STEP) return to;
  const x = a[0] + (dx * MAX_STEP) / distance,
    z = a[2] + (dz * MAX_STEP) / distance;
  const near = beachPoint(x, 0, beach)[2],
    far = beachPoint(x, 1, beach)[2];
  return { x, f: (z - near) / (far - near) };
}
function sandpiperPoint(state, index, j) {
  if (j <= 0) return sandpiperTarget(state, index, 0);
  if (state.points.has(j)) return state.points.get(j);
  let c = j - 1;
  while (c > 0 && !state.points.has(c) && !state.pointCheckpoints.has(c)) c = c % 32 ? c - (c % 32) : c - 32;
  let point = c <= 0 ? sandpiperTarget(state, index, 0) : state.points.get(c) || state.pointCheckpoints.get(c);
  for (let n = Math.max(1, c + 1); n <= j; n++) {
    point = stepToward(state.beach, point, sandpiperTarget(state, index, n));
    state.points.set(n, point);
    if (n % 32 === 0) state.pointCheckpoints.set(n, point);
  }
  while (state.points.size > 160) state.points.delete(state.points.keys().next().value);
  return point;
}

const catmull = (a, b, c, d, u) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
function pathPoint(state, index, j, u) {
  const p = [j - 1, j, j + 1, j + 2].map((n) => sandpiperPoint(state, index, n));
  const x = catmull(p[0].x, p[1].x, p[2].x, p[3].x, u),
    f = catmull(p[0].f, p[1].f, p[2].f, p[3].f, u);
  return beachPoint(x, Math.max(0.1, Math.min(0.8, f)), state.beach);
}

const SUBSTEPS = 8;
function segmentPolyline(state, index, j) {
  if (state.segments.has(j)) return state.segments.get(j);
  const points = [],
    lengths = [0];
  for (let i = 0; i <= SUBSTEPS; i++) points.push(pathPoint(state, index, j, i / SUBSTEPS));
  for (let i = 1; i <= SUBSTEPS; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][2] - points[i - 1][2]));
  const record = { points, lengths, length: lengths[SUBSTEPS] };
  state.segments.set(j, record);
  if (state.segments.size > 96) state.segments.delete(state.segments.keys().next().value);
  return record;
}

// Cumulative path length to the start of segment j, from cached checkpoints every 32 segments.
function lengthBefore(state, index, j) {
  if (state.before?.j === j) return state.before.total;
  const total = sumBefore(state, index, j);
  state.before = { j, total };
  return total;
}
function sumBefore(state, index, j) {
  const base = Math.max(0, Math.floor(j / 32) * 32);
  let c = base,
    total;
  while (!state.checkpoints.has(c)) c -= 32;
  total = state.checkpoints.get(c);
  for (let n = c; n < j; n++) {
    total += segmentPolyline(state, index, n).length;
    if ((n + 1) % 32 === 0 && !state.checkpoints.has(n + 1)) state.checkpoints.set(n + 1, total);
  }
  return total;
}

function pointAtLength(state, index, j, s) {
  // Search back from segment j for the segment holding arc length s.
  let start = lengthBefore(state, index, j),
    n = j;
  while (n > 0 && s < start) {
    n--;
    start -= segmentPolyline(state, index, n).length;
  }
  const record = segmentPolyline(state, index, n);
  const local = Math.max(0, Math.min(record.length, s - start));
  let i = 1;
  while (i < SUBSTEPS && record.lengths[i] < local) i++;
  const span = record.lengths[i] - record.lengths[i - 1] || 1;
  return mix(record.points[i - 1], record.points[i], (local - record.lengths[i - 1]) / span);
}

// `sea` is the coast's oceanWindState (the wind sea turns and grows with the breeze); new swash
// targets read the state current when they are first needed.
export function shorebirdMotion(time, index, beach, sea = null) {
  const t = activeTime(time);
  const state = sandpiperState(index, beach);
  state.sea = sea;
  const j = Math.floor(t / TICK),
    u = t / TICK - j;
  const record = segmentPolyline(state, index, j);
  const before = lengthBefore(state, index, j);
  let i = Math.min(SUBSTEPS - 1, Math.floor(u * SUBSTEPS));
  const fu = u * SUBSTEPS - i;
  const distance = before + record.lengths[i] + (record.lengths[i + 1] - record.lengths[i]) * fu;
  const position = pathPoint(state, index, j, u);
  const ahead = pathPoint(state, index, j, Math.min(1, u + 0.02)),
    behind = pathPoint(state, index, j, Math.max(0, u - 0.02));
  const speed = Math.hypot(ahead[0] - behind[0], ahead[2] - behind[2]) / ((Math.min(1, u + 0.02) - Math.max(0, u - 0.02)) * TICK || 1);
  // Heading targets per tick (direction of travel, or facing the sea while lingering), unwrapped
  // within the spring's window so a reversal turns the body rather than flipping it.
  const keys = [];
  let previous = null;
  for (let n = j - 2; n <= j + 1; n++) {
    const a = sandpiperPoint(state, index, n),
      b = sandpiperPoint(state, index, n + 1);
    const pa = beachPoint(a.x, a.f, beach),
      pb = beachPoint(b.x, b.f, beach);
    const dx = pb[0] - pa[0],
      dz = pb[2] - pa[2];
    let yaw = Math.hypot(dx, dz) > 0.06 ? Math.atan2(dx, dz) : Math.PI + (hash(index, n, 9) - 0.5) * 0.9;
    if (previous !== null) yaw = previous + Math.atan2(Math.sin(yaw - previous), Math.cos(yaw - previous));
    keys.push([n * TICK - 0.1, yaw]);
    previous = yaw;
  }
  const yaw = sprung(keys, t, 2.8, 0.8);
  const running = smooth((speed - 0.25) / 0.5);
  const probing = 1 - running;
  const probeRate = 3.1 + hash(index, Math.floor(t / 3), 5) * 0.8;
  const peck = probing * Math.max(0, Math.sin(t * TAU * probeRate)) ** 2;
  const look = probing * pulse(wrap(t / 7.3 + index * 0.37, 1) / 0.12);
  return {
    x: position[0],
    position,
    distance,
    speed,
    activity: running,
    state: running > 0.5 ? (speed > 1.2 ? "sprint" : "run") : look > 0.3 ? "look" : "probe",
    yaw,
    edge: () => swashEdge(position[0], t, beach, sea),
    headPitch: probing * (0.32 + peck * 0.34) - look * 0.35 - running * 0.06,
    headYaw: look * Math.sin(t * 2.3) * 0.4,
    bodyPitch: probing * 0.18 + peck * 0.06 - running * 0.05,
    tail: running * 0.08 + noise(t * 1.3, index) * 0.04,
    blink: blinkAt(t, 700 + index, 4.5),
    point: (s) => pointAtLength(state, index, j, s),
  };
}

// ---------------------------------------------------------------- western gulls

export const GULL_EPOCH = 90;
const GULL_DEPART = 4;

export function gullSchedule(time, index) {
  const shifted = activeTime(time) + index * 19;
  const k = Math.floor(shifted / GULL_EPOCH);
  const start = k * GULL_EPOCH - index * 19;
  const glide = 40 + 12 * hash(index, k, 1),
    approach = 12 + 4 * hash(index, k, 2);
  return {
    k,
    start,
    glideEnd: start + glide,
    approachSplit: start + glide + approach - FINAL_APPROACH,
    perchStart: start + glide + approach,
    perchEnd: start + GULL_EPOCH - GULL_DEPART,
    departSplit: start + GULL_EPOCH - GULL_DEPART + CLIMB_OUT,
    end: start + GULL_EPOCH,
  };
}

// The clifftop rises a little above the perches, so a landing glides in over the rim to a point
// 4.2 m out and 1.55 m up, then settles onto the perch; a departure climbs out before it turns
// for the sea. Both joins match position, velocity and acceleration.
const FINAL_APPROACH = 3.4,
  CLIMB_OUT = 1.4;
function horizontalToward(from, to) {
  const dx = to[0] - from[0],
    dz = to[2] - from[2],
    length = Math.hypot(dx, dz) || 1;
  return [dx / length, 0, dz / length];
}
function finalApproach(perch, from) {
  const d = horizontalToward(perch, from);
  return {
    position: [perch[0] + d[0] * 4.2, perch[1] + 1.55, perch[2] + d[2] * 4.2],
    velocity: [-d[0] * 1.7, -0.25, -d[2] * 1.7],
    acceleration: [0, 0, 0],
  };
}
function climbOut(perch, to) {
  const d = horizontalToward(perch, to);
  return {
    position: [perch[0] + d[0] * 1.4, perch[1] + 1.25, perch[2] + d[2] * 1.4],
    velocity: [d[0] * 1.9, 0.9, d[2] * 1.9],
    acceleration: [0, 0, 0],
  };
}

// Soaring track: a slow loop along the bay with circling that comes and goes, rising in the
// turns. Extents keep clear of the headlands (checked against the camera height grid in tests).
function soarPosition(time, index) {
  const w1 = TAU / (38 + index * 6),
    w2 = (TAU / (11.5 + index * 2.2)) * (index % 2 ? -1 : 1);
  const theta = w1 * time + index * 1.5,
    psi = w2 * time + index * 2.1;
  const circling = 0.5 + 0.5 * Math.sin(time * 0.083 + index * 1.7);
  const r = (1.6 + index * 0.35) * (0.3 + 0.7 * circling);
  const cx = -1 + index * 0.8,
    cz = -21.5 - index * 0.7;
  return [
    cx + (9.6 + index * 0.3) * Math.cos(theta) + r * Math.cos(psi),
    8.6 + index * 0.75 + 1.1 * Math.sin(time * 0.11 + index) + 0.45 * Math.sin(psi + 0.8) * circling,
    cz + (5.2 + index * 0.4) * Math.sin(theta) + r * Math.sin(psi),
  ];
}
function soar(time, index) {
  const h = 1e-3,
    a = soarPosition(time - h, index),
    b = soarPosition(time, index),
    c = soarPosition(time + h, index);
  return {
    position: b,
    velocity: b.map((value, axis) => (c[axis] - a[axis]) / (2 * h)),
    acceleration: b.map((value, axis) => (c[axis] - 2 * value + a[axis]) / (h * h)),
  };
}

// Gull 3 sometimes raids the perch gull 0 is holding: it hovers over it, calling, and is driven off.
export function gullRaid(k3, perch) {
  if (hash(3, k3, 77) > 0.55) return null;
  const host = gullSchedule((k3 - 1) * GULL_EPOCH + 1, 0);
  const raider = gullSchedule(k3 * GULL_EPOCH - 57 + 1, 3);
  const begin = Math.max(host.perchStart + 2.5, raider.start + 6);
  const finish = begin + 12;
  if (finish > Math.min(host.perchEnd - 1.5, raider.glideEnd - 0.5) || begin < 0) return null;
  const hover = [perch[0] + 0.35, perch[1] + 1.3, perch[2] - 0.75];
  return { begin, arrive: begin + 4.5, leave: begin + 7.5, finish, hover };
}

function hoverState(time, raid) {
  const w = TAU * 1.2,
    local = time - raid.arrive;
  return {
    position: [raid.hover[0], raid.hover[1] + 0.05 * Math.sin(w * local), raid.hover[2]],
    velocity: [0, 0.05 * w * Math.cos(w * local), 0],
    acceleration: [0, -0.05 * w * w * Math.sin(w * local), 0],
  };
}

// Perched repertoire: glances, preening, a wing stretch, a long call, a ruffle-shake.
const perchedPlans = new Map();
export function perchedPlan(seed, start, end, { threat = null } = {}) {
  const key = `${seed}:${start}:${threat ? threat.begin : ""}`;
  if (perchedPlans.has(key)) return perchedPlans.get(key);
  const h = (n, m = 0) => hash(seed, Math.floor(start * 10), n * 37 + m);
  const names = ["yaw", "pitch", "neck", "crouch", "raise", "stretchL", "stretchR", "fan", "jaw", "preen"];
  const keys = Object.fromEntries(names.map((name) => [name, [[start, 0]]]));
  const set = (time, targets) => {
    for (const [name, value] of Object.entries(targets)) keys[name].push([time, value]);
  };
  const actions = [];
  let t = start + 1.6;
  const menu = ["look", "look", "preen", "stretch", "call", "shake", "look"];
  for (let n = 0; t < end - 3; n++) {
    const kind = menu[Math.floor(h(1, n) * menu.length)];
    const duration = { look: 3 + h(2, n) * 4, preen: 3 + h(3, n) * 2.5, stretch: 2.4, call: 3.2 + h(4, n), shake: 1.4 }[kind];
    const s = t,
      e = Math.min(end - 1.5, t + duration);
    if (e - s < 1.2) break;
    actions.push({ kind, start: s, end: e });
    if (kind === "look") {
      const gaze = { yaw: keys.yaw, pitch: keys.pitch };
      glanceKeys(gaze, s, e, seed * 13 + n, { yaw: 0.7, pitch: 0.2, hold: [0.35, 1.3] });
    }
    if (kind === "preen") {
      const side = h(5, n) < 0.5 ? 1 : -1;
      set(s, { yaw: side * 1.25, neck: 0.35, pitch: 0.55, preen: 1 });
      set(e - 0.4, { yaw: 0, neck: 0, pitch: 0, preen: 0 });
    }
    if (kind === "stretch") {
      const side = h(6, n) < 0.5 ? "stretchL" : "stretchR";
      set(s, { [side]: 1, fan: 0.8, pitch: 0.12 });
      set(s + 1.6, { [side]: 0, fan: 0, pitch: 0 });
    }
    if (kind === "call") {
      // The long call: head bows, then is thrown up and back with the bill open.
      set(s, { neck: 0.55, pitch: 0.6, crouch: 0.4 });
      set(s + 0.7, { neck: -0.6, pitch: -0.95, crouch: 0.1, jaw: 0.3, raise: 0.25 });
      set(e - 0.5, { neck: 0, pitch: 0, crouch: 0, jaw: 0, raise: 0 });
    }
    if (kind === "shake") {
      set(s, { crouch: 0.2, raise: 0.12 });
      set(e - 0.3, { crouch: 0, raise: 0 });
    }
    t = e + 0.6 + h(7, n) * 2.4;
  }
  if (threat) {
    // Defend the perch: crouch, half-raise the wings, stretch toward the raider and gape.
    const s = threat.arrive - 1.2,
      e = threat.leave + 1;
    for (const name of names) keys[name] = keys[name].filter(([time]) => time < s - 2.5 || time > e + 0.6);
    const neutral = Object.fromEntries(names.map((name) => [name, 0]));
    set(s - 2.4, neutral);
    set(s, { ...neutral, crouch: 0.55, raise: 0.55, neck: -0.35, pitch: -0.55, yaw: threat.yaw, jaw: 0.32 });
    set(e, neutral);
    for (let i = actions.length - 1; i >= 0; i--) if (actions[i].end > s - 2.5 && actions[i].start < e + 0.6) actions.splice(i, 1);
    actions.push({ kind: "threat", start: s, end: e });
    actions.sort((a, b) => a.start - b.start);
  }
  for (const list of Object.values(keys)) list.sort((a, b) => a[0] - b[0]);
  const plan = { keys, actions };
  perchedPlans.set(key, plan);
  if (perchedPlans.size > 24) perchedPlans.delete(perchedPlans.keys().next().value);
  return plan;
}

export function perchedActing(plan, t, seed, { settle = Infinity } = {}) {
  const k = plan.keys;
  const action = plan.actions.find((item) => t >= item.start && t < item.end);
  const local = action ? t - action.start : 0;
  const calling = action?.kind === "call" ? window01(t, action.start + 0.7, action.end - 0.5, 0.15, 0.3) : 0;
  const threat = action?.kind === "threat" ? window01(t, action.start, action.end, 0.3, 0.6) : 0;
  const kyow = Math.max(calling, threat) * Math.max(0, Math.sin(local * TAU * 2.4)) ** 2;
  const preening = sprung(k.preen, t, 2, 0.8);
  const shaking = action?.kind === "shake" ? window01(t, action.start, action.end, 0.15, 0.3) : 0;
  // Landing: wings stay up a beat for balance, then fold with a small overshoot.
  const landing = Number.isFinite(settle) ? 1 - smooth((settle - 0.35) / 0.7) : 0;
  return {
    state: action ? action.kind : "perch",
    headYaw: sprung(k.yaw, t, 3.6, 0.72) + preening * 0.12 * Math.sin(local * 13),
    headPitch: sprung(k.pitch, t, 3, 0.65) + preening * 0.08 * Math.sin(local * 17),
    neckPitch: sprung(k.neck, t, 2.4, 0.6),
    crouch: sprung(k.crouch, t, 2.6, 0.55),
    wingRaise: sprung(k.raise, t, 2.4, 0.5) + landing * 0.55 + shaking * 0.12 * Math.sin(local * 40),
    wingStretchL: sprung(k.stretchL, t, 1.8, 0.65),
    wingStretchR: sprung(k.stretchR, t, 1.8, 0.65),
    tailFan: sprung(k.fan, t, 2.5, 0.6) + landing,
    jaw: sprung(k.jaw, t, 5, 0.6) + kyow * 0.28,
    shake: shaking * Math.sin(local * 38) * 0.12,
    blink: blinkAt(t, seed, 4.2),
    calling: Math.max(calling, threat),
  };
}

export function gullMotion(time, index, perch) {
  const t = activeTime(time);
  const schedule = gullSchedule(t, index);
  const { start, glideEnd, perchStart, perchEnd, end } = schedule;
  const still = { position: perch, velocity: [0, 0, 0], acceleration: [0, 0, 0] };
  const approachSpan = perchStart - glideEnd;
  let pose,
    state,
    raid = null;
  if (index === 3) raid = gullRaid(schedule.k, perch);
  if (t < glideEnd) {
    if (raid && t >= raid.begin && t < raid.finish) {
      if (t < raid.arrive) pose = transfer(soar(raid.begin, index), hoverState(raid.arrive, raid), (t - raid.begin) / 4.5, 4.5, 0.6);
      else if (t < raid.leave) pose = hoverState(t, raid);
      else pose = transfer(hoverState(raid.leave, raid), soar(raid.finish, index), (t - raid.leave) / 4.5, 4.5, 0.8);
      state = t >= raid.arrive - 0.6 && t < raid.leave + 0.4 ? "squabble" : "glide";
    } else {
      pose = soar(t, index);
      state = "glide";
    }
  } else if (t < perchStart) {
    const from = soar(glideEnd, index),
      waypoint = finalApproach(perch, from.position);
    pose =
      t < schedule.approachSplit
        ? transfer(from, waypoint, (t - glideEnd) / (approachSpan - FINAL_APPROACH), approachSpan - FINAL_APPROACH, 0.8)
        : transfer(waypoint, still, (t - schedule.approachSplit) / FINAL_APPROACH, FINAL_APPROACH, 0.12);
    state = "approach";
  } else if (t < perchEnd) {
    pose = still;
    state = "perch";
  } else {
    const to = soar(end, index),
      lift = climbOut(perch, to.position);
    pose =
      t < schedule.departSplit
        ? transfer(still, lift, (t - perchEnd) / CLIMB_OUT, CLIMB_OUT, 0)
        : transfer(lift, to, (t - schedule.departSplit) / (GULL_DEPART - CLIMB_OUT), GULL_DEPART - CLIMB_OUT, 1);
    state = "depart";
  }
  const landingDirection = transfer(finalApproach(perch, soar(glideEnd, index).position), still, 0.999, FINAL_APPROACH, 0.12).velocity;
  const landingYaw = Math.atan2(landingDirection[0], landingDirection[2]);
  // An exaggerated effective gravity so slow soaring still leans visibly into its turns.
  const attitude = flightAttitude(state === "perch" ? landingDirection : pose.velocity, pose.acceleration, { gravity: 0.9, maxBank: 0.75 });
  const flightYaw = attitude.yaw;
  const yawDelta = Math.atan2(Math.sin(flightYaw - landingYaw), Math.cos(flightYaw - landingYaw));
  const departTurn = smooth((t - perchEnd) / 0.3);
  let yaw = state === "depart" ? landingYaw + yawDelta * departTurn : state === "perch" ? landingYaw : flightYaw;
  if (raid && t >= raid.arrive - 1.4 && t < raid.leave + 1) {
    const face = Math.atan2(perch[0] - raid.hover[0], perch[2] - raid.hover[2]);
    const hold = t < raid.arrive ? smooth((t - raid.arrive + 1.4) / 1.2) : t < raid.leave ? 1 : 1 - smooth((t - raid.leave) / 0.9);
    const from = t < raid.leave ? transfer(soar(raid.begin, index), hoverState(raid.arrive, raid), 0.995, 4.5, 0.6).velocity : pose.velocity;
    const flightHeading = Math.hypot(from[0], from[2]) > 1e-4 ? Math.atan2(from[0], from[2]) : face;
    yaw = flightHeading + Math.atan2(Math.sin(face - flightHeading), Math.cos(face - flightHeading)) * hold;
  }
  // Flap bouts: in climbs, at random intervals, braking into the perch and beating off it.
  const bout = Math.floor((t + index * 3.7) / 7);
  const boutStart = bout * 7 - index * 3.7 + hash(index, bout, 4) * 3;
  const randomFlap = hash(index, bout, 5) < 0.42 ? window01(t, boutStart, boutStart + 1.6 + hash(index, bout, 6) * 1.8, 0.25) : 0;
  const climbFlap = smooth((pose.velocity[1] - 0.22) / 0.4);
  const brake = state === "approach" ? window01(t, perchStart - 2.1, perchStart, 0.35, 0.25) : 0;
  const takeoff = state === "depart" ? smooth((t - perchEnd) / 0.12) * (1 - smooth((t - perchEnd - 2.6) / 1)) : 0;
  const hover =
    state === "squabble" ? 1 : raid && t >= raid.arrive - 1.2 && t < raid.leave + 1.2 ? window01(t, raid.arrive - 1.2, raid.leave + 1.2, 0.6) : 0;
  const flap = state === "perch" ? 0 : Math.max(randomFlap, climbFlap, brake, takeoff, hover);
  const beatRate = 3 + brake * 1.8 + hover * 1.6 + takeoff * 0.4;
  const beat = wingbeat(t * beatRate + index * 0.3, 0.13);
  const amplitude = 0.5 + takeoff * 0.25 + hover * 0.1 - brake * 0.18;
  // Landing: wings rise and the tail fans over the last 1.8 s and stay so through touchdown,
  // easing after it; the flare's nose-up pitch peaks just before and is level at touchdown.
  const reach = state === "approach" ? smooth((t - (perchStart - 1.8)) / 1.1) : 0;
  const flare = reach * (1 - smooth((t - (perchStart - 0.45)) / 0.45));
  const settleUp = state === "perch" ? 1 - smooth((t - perchStart - 0.35) / 0.7) : 0;
  const absorb = state === "perch" ? pulse((t - perchStart) / 0.6) : 0;
  let wingFold = state === "perch" ? smooth((t - perchStart - 0.35) / 0.65) : state === "depart" ? 1 - smooth((t - perchEnd) / 0.3) : 0;
  const speedFlex = state === "glide" ? smooth((attitude.speed - 2.2) / 1.4) : 0;
  const pitch =
    state === "perch"
      ? 0
      : attitude.pitch * (state === "approach" ? 1 - smooth((t - perchStart + 2) / 2) : state === "depart" ? departTurn : 1) -
        flare * 0.62 -
        hover * 0.5 -
        takeoff * 0.15 * (1 - departTurn) * smooth((t - perchEnd) / 0.25);
  const bank =
    state === "perch"
      ? 0
      : attitude.bank *
        (state === "approach" ? 1 - smooth((t - glideEnd) / 1.2) * 0.4 - flare : state === "depart" ? smooth((t - perchEnd - 1.5) / 1.5) : 1) *
        (1 - hover);
  const footDeploy =
    state === "perch"
      ? 1
      : state === "approach"
        ? smooth((t - (perchStart - 2.2)) / 1.6)
        : state === "depart"
          ? 1 - smooth((t - perchEnd - 0.2) / 0.9)
          : hover * 0.7;
  const contactWeight =
    state === "perch" ? 1 : state === "approach" ? smooth((t - (perchStart - 4)) / 4) : state === "depart" ? 1 - smooth((t - perchEnd) / 0.45) : 0;
  let perched = null;
  if (state === "perch") {
    // Gull 0's perch window in epoch k is raided by gull 3 in its epoch k + 1.
    let threat = null;
    const candidate = index === 0 ? gullRaid(schedule.k + 1, perch) : null;
    if (candidate) {
      const toward = Math.atan2(candidate.hover[0] - perch[0], candidate.hover[2] - perch[2]);
      threat = { ...candidate, yaw: Math.atan2(Math.sin(toward - landingYaw), Math.cos(toward - landingYaw)) * 0.8 };
    }
    perched = perchedActing(perchedPlan(40 + index, perchStart, perchEnd, { threat }), t, 60 + index, { settle: t - perchStart });
  }
  // Raised wings (balance after landing, a long call, a threat) open the fold partway.
  if (perched) wingFold *= 1 - Math.min(0.65, perched.wingRaise * 0.9);
  const glance = state === "glide" ? Math.floor((t + index) / 2.3) : 0;
  const lookDown = state === "glide" ? (hash(index, glance, 8) < 0.35 ? pulse((t + index - glance * 2.3) / 2.3) * 0.35 : 0) : 0;
  return {
    ...pose,
    state,
    schedule,
    raid,
    yaw,
    pitch,
    bank,
    landingYaw,
    landingCycle: schedule.k,
    speed: attitude.speed,
    wingFold,
    wingBeat: flap * beat.stroke * amplitude,
    wingTipLag: flap * beat.lag * amplitude,
    flap,
    downstroke: beat.downstroke,
    wingRaise: (state === "glide" ? 0.1 : 0.04) + reach * 0.85 + (perched ? perched.wingRaise : 0) + settleUp * 0.3,
    wingSweep: speedFlex * 0.42 + flare * -0.35 + (flap > 0.3 && !beat.downstroke ? flap * 0.25 : 0),
    wingTwist: flare * 0.4 + hover * 0.3,
    tailPitch: flare * -0.45 - hover * 0.3 + (state === "glide" ? noise(t * 0.6, index) * 0.06 : 0),
    tailFan: Math.max(reach, hover, perched ? perched.tailFan : 0, takeoff * 0.4) * 0.65,
    tailTwist: -bank * 0.4,
    headYaw: perched ? perched.headYaw : state === "squabble" ? Math.sin(t * 3.1) * 0.25 : bank * 0.45,
    headPitch: perched ? perched.headPitch : -pitch * 0.65 + lookDown,
    headRoll: perched ? 0 : -bank * 0.85,
    neckPitch: perched ? perched.neckPitch : flare * -0.25 + (state === "squabble" ? -0.2 : 0),
    crouch: perched ? perched.crouch + absorb * 0.5 : 0,
    jaw: perched ? perched.jaw : state === "squabble" ? Math.max(0, Math.sin(t * TAU * 2.6)) ** 2 * 0.3 : 0,
    wingStretchL: perched ? perched.wingStretchL : 0,
    wingStretchR: perched ? perched.wingStretchR : 0,
    shake: perched ? perched.shake : 0,
    perchedState: perched?.state,
    blink: perched ? perched.blink : blinkAt(t, index + 30, 9.4),
    footDeploy,
    contactWeight,
  };
}

// The balcony gull keeps the gallery rail: the same perched repertoire, epoch by epoch.
export function balconyGullActing(time) {
  const t = activeTime(time);
  const epoch = epochAt(t, 36, 0.2, 451);
  return perchedActing(perchedPlan(450, epoch.start, epoch.end), t, 452);
}
