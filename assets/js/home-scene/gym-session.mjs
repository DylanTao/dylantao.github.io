import { REP_SECONDS, SUPERSET_OVERHEAD, LIFT_STATION } from "./training.mjs";

// The training session as staged choreography (Sirui, 2026-10-15). training.mjs says what happens
// when (a timeline of segments); this file says where the body is and what it is doing at any
// second of it, as data the controller and the lift rig (lift-rig.mjs) carry out: the floor
// position and facing, a clip for walking and standing, or a procedural lift with its phase, and
// which bar is in the hands. Walks route around the equipment on a small visibility graph so a
// body never passes through the rack, a loaded bar, the bench or the dip bars. Everything here is
// a pure function of the session clock, so a paused frame, a reduced-motion still and a test all
// see the same pose.
//
// Staging follows the room camera, which looks from the sea toward the back wall: squats, presses
// and deadlifts face it; the bench press is seen from the side, where its bar path reads best; the
// board is written facing the wall.

const PACE = 1.15; // m/s
const PLATE_RADIUS = { 45: 0.225, 35: 0.21, 25: 0.18, 10: 0.13, 5: 0.105, 2.5: 0.085 };
const RAMP = 0.35; // s, blending between a clip and a procedural pose
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), 0, lerp(a[2], b[2], t)];
const dist = (a, b) => Math.hypot(b[0] - a[0], b[2] - a[2]);
const angleLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const ramp = (local, length) => smooth(Math.min(local, length - local) / RAMP);

const layouts = new WeakMap();

// Stations, standing spots and obstacles from the manifest's gym block (three.js metres).
export function gymLayout(gym) {
  if (layouts.has(gym)) return layouts.get(gym);
  const at = (p) => [p[0], 0, p[2]];
  const rackBar = gym.rack.bar,
    platformBar = gym.platform.bar,
    benchBar = gym.bench.bar;
  const half = 1.1; // half a 7 ft bar
  const spot = (p, facing) => ({ at: at(p), facing });
  const spots = {
    // Between sets: a clear spot by the dumbbells, looking out to sea. (The room's own arrival
    // point is by the platform's plates.)
    rest: spot([7.3, 0, -0.95], Math.PI),
    arrival: spot(gym.rest.actor, Math.PI),
    board: spot(gym.whiteboard.actor, 0),
    rackEntry: spot(gym.rack.entry, 0),
    rackUnrack: spot(gym.rack.unrack, Math.PI),
    rackSquat: spot(gym.rack.actor, Math.PI),
    rackPressUnrack: spot(gym.rack.pressUnrack, Math.PI),
    rackPress: spot(gym.rack.press, Math.PI),
    platform: spot(gym.platform.actor, Math.PI),
    benchMount: spot(gym.bench.mount, gym.bench.facing),
    pullup: spot(gym.pullup.actor, Math.PI),
    dipFront: spot(gym.dip.front, Math.PI),
    dip: spot(gym.dip.actor, Math.PI),
    curl: spot(gym.dumbbells.actor, Math.PI),
    // Beside each bar's near sleeve, facing along the bar.
    loadRack: spot([rackBar[0] + half + 0.4, 0, rackBar[2]], -Math.PI / 2),
    loadPlatform: spot([platformBar[0] - half - 0.4, 0, platformBar[2]], Math.PI / 2),
    loadBench: spot([benchBar[0], 0, benchBar[2] + half + 0.4], Math.PI),
    exit: spot(gym.exit || [6.9, 0, -1.55], Math.PI),
  };
  // Plan rectangles [x0, x1, z0, z1], already widened by a body radius. Entering the cage, the dip
  // bars, the platform and the bench are staged moves, so their footprints stay closed here.
  const r = 0.2;
  const box = (x0, x1, z0, z1) => [x0 - r, x1 + r, z0 - r, z1 + r];
  const [px0, px1] = gym.rack.posts.x,
    [pz0, pz1] = gym.rack.posts.z;
  const dipX = gym.dip.hands.map((h) => h[0]);
  const obstacles = [
    // The cage, its safeties and the bar's plates either side.
    box(px0 - 0.5, px1 + 0.5, pz0 - 0.05, pz1 + 0.05),
    // The pull-up and dip frame.
    box(Math.min(...dipX) - 0.05, Math.max(...dipX) + 0.05, 0.27, 1.0),
    // The platform bar with its plates.
    box(platformBar[0] - half, platformBar[0] + half, platformBar[2] - 0.23, platformBar[2] + 0.23),
    // The bench, its uprights and the bar on them.
    box(gym.bench.mount[0] + 0.2, gym.bench.bar[0] + 0.26, gym.bench.bar[2] - 0.16, gym.bench.bar[2] + 0.16),
    box(benchBar[0] - 0.23, benchBar[0] + 0.23, benchBar[2] - half, benchBar[2] + half),
    // The dumbbell rack along the wall and the plate tree by the glass.
    box(6.14, 6.6, -0.79, 0.89),
    box(gym.plates.tree[0] - 0.25, gym.plates.tree[0] + 0.25, gym.plates.tree[2] - 0.25, gym.plates.tree[2] + 0.25),
  ];
  // Open floor between the stations, including the narrow lane between the platform bar's plates
  // and the bench bar's.
  const lane = (platformBar[0] + half + benchBar[0] - 0.23) / 2;
  const waypoints = [
    [6.95, 0, -1.0],
    [rackBar[0], 0, -0.9],
    [10.25, 0, -0.9],
    [7.2, 0, -2.4],
    [gym.bench.mount[0], 0, -2.2],
    [7.35, 0, 0.1],
    [lane, 0, -2.2],
    [lane, 0, -1.25],
  ];
  // Stations that stand inside a footprint (on the platform behind the bar, at the bench's end)
  // are reached only through their approach, so no walk cuts across a bar.
  const approaches = [
    { at: spots.platform.at, via: [platformBar[0], 0, -0.9] },
    { at: spots.benchMount.at, via: [gym.bench.mount[0], 0, -2.2] },
  ];
  const layout = { spots, obstacles, waypoints, approaches, bars: { rack: rackBar, platform: platformBar, bench: benchBar } };
  layouts.set(gym, layout);
  return layout;
}

// Does the segment a-b cross the rectangle (Liang-Barsky)?
function crosses(a, b, [x0, x1, z0, z1]) {
  let t0 = 0,
    t1 = 1;
  const dx = b[0] - a[0],
    dz = b[2] - a[2];
  for (const [p, q] of [
    [-dx, a[0] - x0],
    [dx, x1 - a[0]],
    [-dz, a[2] - z0],
    [dz, z1 - a[2]],
  ]) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return t1 - t0 > 1e-6;
}
const inside = (p, [x0, x1, z0, z1]) => p[0] > x0 && p[0] < x1 && p[2] > z0 && p[2] < z1;

// Shortest walk from a to b around the obstacles. A point inside an obstacle (a station) may leave
// or reach it in a straight line.
export function planRoute(layout, a, b) {
  if (dist(a, b) < 0.02) return [a, b];
  const via = (p) => layout.approaches?.find((x) => dist(x.at, p) < 0.01)?.via;
  const viaA = via(a),
    viaB = via(b);
  if (viaA || viaB) {
    if (viaA && viaB && dist(viaA, viaB) < 0.01) return [a, viaA, b];
    const core = planRoute(layout, viaA || a, viaB || b);
    return [...(viaA ? [a] : []), ...core, ...(viaB ? [b] : [])];
  }
  const blocking = layout.obstacles.filter((o) => !inside(a, o) && !inside(b, o));
  const clear = (p, q) => blocking.every((o) => !crosses(p, q, o));
  if (dist(a, b) < 0.02 || clear(a, b)) return [a, b];
  const nodes = [a, b, ...layout.waypoints];
  const n = nodes.length,
    best = Array(n).fill(Infinity),
    previous = Array(n).fill(-1),
    done = Array(n).fill(false);
  best[0] = 0;
  for (;;) {
    let k = -1;
    for (let i = 0; i < n; i++) if (!done[i] && best[i] < Infinity && (k < 0 || best[i] < best[k])) k = i;
    if (k < 0 || k === 1) break;
    done[k] = true;
    for (let j = 0; j < n; j++) {
      if (done[j] || !clear(nodes[k], nodes[j])) continue;
      const d = best[k] + dist(nodes[k], nodes[j]);
      if (d < best[j]) {
        best[j] = d;
        previous[j] = k;
      }
    }
  }
  if (previous[1] < 0) return [a, b];
  const path = [];
  for (let k = 1; k >= 0; k = previous[k]) path.unshift(nodes[k]);
  return path;
}

function along(path, s) {
  for (let i = 1; i < path.length; i++) {
    const d = dist(path[i - 1], path[i]);
    if (s <= d || i === path.length - 1) {
      const t = d > 0 ? clamp(s / d) : 1;
      return { position: mix(path[i - 1], path[i], t), facing: Math.atan2(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]) };
    }
    s -= d;
  }
  return { position: path[path.length - 1], facing: 0 };
}
const lengthOf = (path) => path.slice(1).reduce((sum, p, i) => sum + dist(path[i], p), 0);

// Where each kind of segment starts and ends.
function workSpots(layout, lift) {
  const s = layout.spots;
  switch (LIFT_STATION[lift]) {
    case "rack":
      return lift === "squat"
        ? { start: s.rackEntry, end: s.rackEntry, work: s.rackSquat }
        : { start: s.rackEntry, end: s.rackEntry, work: s.rackPress };
    case "platform":
      return { start: s.platform, end: s.platform, work: s.platform };
    case "bench":
      return { start: s.benchMount, end: s.benchMount, work: s.benchMount };
    default:
      return { start: s.rest, end: s.rest, work: s.rest };
  }
}
const loadSpot = (layout, station) => layout.spots[{ rack: "loadRack", platform: "loadPlatform", bench: "loadBench" }[station]];
const supersetSpot = (layout, lift) => layout.spots[lift === "dip" ? "dipFront" : lift === "curl" ? "curl" : "pullup"];

function ends(layout, segment, next) {
  const s = layout.spots;
  switch (segment.kind) {
    case "board":
      return { start: s.board, end: next && next.kind !== "leave" ? ends(layout, next, null).start : s.board };
    case "arrive":
      return { start: s.rest, end: next ? ends(layout, next, null).start : s.rest };
    case "load":
      // Loading ends with the walk to wherever the next segment starts.
      return {
        start: loadSpot(layout, segment.station),
        end: next && (next.kind === "setup" || next.kind === "load") ? ends(layout, next, null).start : loadSpot(layout, segment.station),
      };
    case "setup":
    case "set":
    case "rerack": {
      const w = workSpots(layout, segment.lift);
      if (segment.kind === "setup") return { start: w.start, end: w.work };
      if (segment.kind === "set") return { start: w.work, end: w.work };
      return { start: w.work, end: w.end };
    }
    case "walk":
    case "superset":
      return { start: supersetSpot(layout, segment.to || segment.lift), end: supersetSpot(layout, segment.to || segment.lift) };
    case "rest":
      return { start: s.rest, end: next ? ends(layout, next, null).start : s.rest };
    case "leave":
      return { start: s.exit, end: s.exit };
    default:
      return { start: s.rest, end: s.rest };
  }
}

// Plates on each bar at the start of every segment, and the incline of the bench back.
const loads = new WeakMap();
function barLoads(timeline) {
  if (loads.has(timeline)) return loads.get(timeline);
  const state = { rack: 45, platform: 45, bench: 45 };
  let incline = false;
  const out = timeline.segments.map((segment) => {
    const before = { ...state, incline };
    if (segment.kind === "load") state[segment.station] = segment.weight;
    if (segment.kind === "load" && segment.station === "bench") incline = segment.lift === "incline-bench" && !segment.strip;
    return before;
  });
  loads.set(timeline, out);
  return out;
}

// A procedural lift for the rig: its name, the phase within it, extra parameters, a blend weight.
const lift = (name, u, ctx = {}, weight = 1) => ({ name, u, ctx, weight });

// The pose at a session state. `info` is trainingAt(...) with a state; `gym` the manifest block.
export function sessionPose(info, gym) {
  const layout = gymLayout(gym),
    s = layout.spots;
  const { state, timeline } = info;
  const segment = state.segment,
    index = state.index,
    local = state.local,
    length = segment.end - segment.start;
  const next = timeline.segments[index + 1] || null;
  const previous = timeline.segments[index - 1] || null;
  const { start, end } = ends(layout, segment, next);
  const from = previous ? ends(layout, previous, segment).end : s.arrival;
  const plates = barLoads(timeline)[index];
  const nextPlates = barLoads(timeline)[index + 1] || plates;
  const base = {
    phase: segment.kind,
    bars: {
      rack: { weight: plates.rack, held: false },
      platform: { weight: plates.platform, held: false },
      bench: { weight: plates.bench, held: false },
    },
    incline: plates.incline ? 1 : 0,
    plate: null,
    dumbbells: "rack",
    writing: false,
    segment: segment.kind,
    lift: null,
  };
  // Walk in from wherever the last segment ended.
  const walkIn = planRoute(layout, from.at, start.at);
  const walkLength = lengthOf(walkIn);
  const cap = segment.kind === "rest" ? length * 0.4 : segment.kind === "walk" ? length * 0.95 : Math.max(1, length * 0.45);
  const walkTime = walkLength < 0.03 ? 0 : Math.min(cap, walkLength / PACE);
  if (local < walkTime) {
    const p = along(walkIn, (local / walkTime) * walkLength);
    return {
      ...base,
      position: p.position,
      facing: p.facing,
      clip: "walk",
      phase: `walk to ${segment.kind === "rest" ? "rest" : segment.lift || segment.to || segment.kind}`,
    };
  }
  const t = local - walkTime,
    span = length - walkTime;
  const stand = (spot, label, extra = {}) => ({ ...base, position: spot.at, facing: spot.facing, clip: "idle", phase: label, ...extra });
  // The last part of a segment walks on to where the next one starts.
  const trailing = (spot, goal, time, total, label) => {
    const path = planRoute(layout, spot.at, goal.at);
    const length = lengthOf(path);
    const walk = length < 0.03 ? 0 : Math.min(total * 0.4, length / PACE);
    if (!walk || time <= total - walk) return null;
    const p = along(path, ((time - (total - walk)) / walk) * length);
    return { ...base, position: p.position, facing: p.facing, clip: "walk", phase: `${label}, then on` };
  };

  switch (segment.kind) {
    case "arrive": {
      const trailed = trailing(s.rest, end, t, span, "warm up");
      return trailed || stand(s.rest, "warm up");
    }
    case "leave":
      return stand(s.exit, "towel off");
    case "board": {
      const trailed = trailing(s.board, end, t, span, segment.note === "log" ? "log the session" : "read today's plan");
      if (trailed) return trailed;
      const turn = Math.min(0.6, span * 0.1);
      if (t < turn) return stand(s.board, "at the board");
      return {
        ...stand(s.board, segment.note === "log" ? "log the session" : "read today's plan"),
        writing: true,
        lift: lift(
          "board",
          ((t - turn) / 9) % 1,
          { boardDistance: gym.whiteboard.center[2] - gym.whiteboard.actor[2] - 0.006 },
          ramp(t - turn, span - turn)
        ),
      };
    }
    case "load": {
      const spot = loadSpot(layout, segment.station);
      const station = segment.station;
      const barY = layout.bars[station][1];
      const trail = planRoute(layout, spot.at, end.at);
      const trailLength = lengthOf(trail);
      const trailTime = trailLength < 0.03 ? 0 : Math.min(span * 0.45, trailLength / PACE);
      const work = span - trailTime;
      if (t > work) {
        const p = along(trail, ((t - work) / trailTime) * trailLength);
        return {
          ...base,
          bars: { ...base.bars, [station]: { weight: segment.weight, held: false } },
          incline: station === "bench" ? (segment.strip ? 0 : nextPlates.incline) : base.incline,
          position: p.position,
          facing: p.facing,
          clip: "walk",
          phase: "to the bar",
        };
      }
      const cycles = Math.max(1, Math.round(work / 6));
      const u = (t / work) * cycles;
      // Plates go on (or come off) one per cycle; the bar shows the new load from the last push.
      const bars = { ...base.bars, [station]: { weight: u > cycles - 0.35 ? segment.weight : plates[station], held: false } };
      let incline = base.incline;
      if (station === "bench")
        incline = segment.strip ? (plates.incline ? 1 - smooth(t / Math.min(3, work)) : 0) : nextPlates.incline ? smooth(t / Math.min(3, work)) : 0;
      const plateSize =
        segment.weight >= (segment.from ?? 45)
          ? heaviestChange(segment.from ?? 45, segment.weight)
          : heaviestChange(segment.weight, segment.from ?? 45);
      return {
        ...stand(spot, segment.strip ? "strip the bar" : "load plates"),
        bars,
        incline,
        plate: plateSize ? { size: plateSize, cycle: u % 1 } : null,
        lift: lift("load", u % 1, { barHeight: barY, strip: Boolean(segment.strip), plateRadius: PLATE_RADIUS[plateSize] ?? 0.2 }, ramp(t, work)),
      };
    }
    case "setup":
      return setupPose(base, layout, segment, t, span, gym);
    case "set": {
      const w = workSpots(layout, segment.lift);
      const station = LIFT_STATION[segment.lift];
      const u = t / REP_SECONDS[segment.lift];
      const bars = { ...base.bars, [station]: { weight: plates[station], held: true } };
      const label = `${segment.warmup ? "warm-up" : `set ${segment.set + 1}`} · ${segment.weight} lb × ${segment.reps}${segment.amrap ? "+" : ""}`;
      return {
        ...base,
        position: w.work.at,
        facing: w.work.facing,
        clip: "idle",
        phase: label,
        bars,
        lift: lift(segment.lift, u % 1, liftContext(segment.lift, gym)),
        rep: Math.min(segment.reps, Math.floor(u) + 1),
      };
    }
    case "rerack":
      return rerackPose(base, layout, segment, t, span, gym);
    case "walk":
      return stand(start, `to the ${segment.to === "pullup" ? "pull-up bar" : segment.to === "dip" ? "dip bars" : "dumbbells"}`);
    case "superset":
      return supersetPose(base, layout, segment, t, span, gym);
    case "rest": {
      // Breathe, look out to sea; on a long rest walk over and tick the set on the board.
      const trail = planRoute(layout, s.rest.at, end.at);
      const trailLength = lengthOf(trail);
      const trailTime = trailLength < 0.03 ? 0 : Math.min(span * 0.4, trailLength / PACE);
      if (t > span - trailTime) {
        const p = along(trail, ((t - (span - trailTime)) / trailTime) * trailLength);
        return { ...base, position: p.position, facing: p.facing, clip: "walk", phase: "back to the bar" };
      }
      const restSpan = span - trailTime;
      if (restSpan > 70 && !segment.warmup) {
        const there = planRoute(layout, s.rest.at, s.board.at),
          go = lengthOf(there) / PACE;
        const visit = [restSpan * 0.25, restSpan * 0.25 + go, restSpan * 0.25 + go + 7, restSpan * 0.25 + 2 * go + 7];
        if (t >= visit[0] && t < visit[1]) {
          const p = along(there, ((t - visit[0]) / go) * lengthOf(there));
          return { ...base, position: p.position, facing: p.facing, clip: "walk", phase: "tick the set" };
        }
        if (t >= visit[1] && t < visit[2])
          return {
            ...stand(s.board, "tick the set"),
            writing: true,
            lift: lift(
              "board",
              0.82 + ((t - visit[1]) / 7) * 0.17,
              { boardDistance: gym.whiteboard.center[2] - gym.whiteboard.actor[2] - 0.006 },
              ramp(t - visit[1], 7)
            ),
          };
        if (t >= visit[2] && t < visit[3]) {
          const back = [...there].reverse();
          const p = along(back, ((t - visit[2]) / go) * lengthOf(back));
          return { ...base, position: p.position, facing: p.facing, clip: "walk", phase: "rest" };
        }
      }
      return stand(s.rest, "rest");
    }
    default:
      return stand(s.rest, segment.kind);
  }
}

function heaviestChange(lower, higher) {
  const side = (higher - lower) / 2;
  for (const plate of [45, 35, 25, 10, 5, 2.5]) if (side >= plate - 1e-6) return plate;
  return side > 0 ? 2.5 : null;
}

// The lift rig's context for a lift: the room points it reaches for, in the manifest's frame (the
// rig reads them into the body's frame every frame).
function liftContext(name, gym) {
  const station = LIFT_STATION[name];
  if (station === "platform") return { bar: gym.platform.bar };
  if (station === "bench") return { hooks: gym.bench.bar, inclineDegrees: gym.bench.inclineDegrees, hinge: gym.bench.hinge, lie: gym.bench.actor };
  if (station === "rack") return { hooks: gym.rack.bar };
  if (name === "pullup") return { bar: gym.pullup.bar, grip: gym.pullup.grip };
  if (name === "dip") return { handY: gym.dip.hands[0][1], handHalf: Math.abs(gym.dip.hands[1][0] - gym.dip.hands[0][0]) / 2 };
  return {};
}

// Getting into a lift. Back squat: turn to face the room, back under the bar, stand it up, two
// steps back. Press and front squat: duck under the bar into the cage, stand and turn, step to the
// bar, take it on the shoulders, step back. Deadlift: set the feet and hinge down to the bar.
// Bench: sit astride the bench end, lie back, find the grip.
function setupPose(base, layout, segment, t, span, gym) {
  const s = layout.spots,
    name = segment.lift,
    station = LIFT_STATION[name];
  const bars = (held) => ({ ...base.bars, [station]: { ...base.bars[station], held } });
  if (station === "platform") {
    const ctx = liftContext(name, gym);
    return {
      ...base,
      position: s.platform.at,
      facing: s.platform.facing,
      clip: "idle",
      phase: "set the grip",
      bars: bars(false),
      lift: lift(name, 0, { ...ctx, approach: smooth(t / span) }, smooth(t / Math.min(span, 0.8))),
    };
  }
  if (station === "bench") {
    const ctx = liftContext(name, gym);
    const u = t / span;
    // The bar leaves the hooks in the last fifth.
    return {
      ...base,
      position: s.benchMount.at,
      facing: s.benchMount.facing,
      clip: "idle",
      phase: "lie back",
      bars: bars(u > 0.84),
      lift: lift(name, 0, { ...ctx, mount: smooth(u / 0.84) }, smooth(t / RAMP)),
    };
  }
  const ctx = liftContext(name, gym);
  if (name === "squat") {
    // 0-15% turn, 15-45% back under the bar, 45-60% stand it up, 60-100% two steps back.
    const u = t / span;
    if (u < 0.15)
      return {
        ...base,
        position: s.rackEntry.at,
        facing: angleLerp(0, Math.PI, smooth(u / 0.15)),
        clip: "idle",
        phase: "step under the bar",
        bars: bars(false),
      };
    const back = u < 0.45 ? smooth((u - 0.15) / 0.3) : 1;
    const position = u < 0.6 ? mix(s.rackEntry.at, s.rackUnrack.at, back) : mix(s.rackUnrack.at, s.rackSquat.at, smooth((u - 0.6) / 0.4));
    const dip = u < 0.45 ? smooth((u - 0.2) / 0.25) : u < 0.6 ? 1 - smooth((u - 0.45) / 0.15) : 0;
    const step = u < 0.45 ? (u - 0.15) / 0.3 : u >= 0.6 ? (u - 0.6) / 0.4 : null;
    return {
      ...base,
      position,
      facing: Math.PI,
      clip: "idle",
      phase: u < 0.6 ? "unrack" : "walk out",
      bars: bars(u >= 0.45),
      lift: lift("squat", 0, { ...ctx, dip: dip * 0.8, step, carry: u < 0.45 ? smooth((u - 0.3) / 0.15) : 1 }, smooth(((u - 0.15) * span) / RAMP)),
    };
  }
  // Presses and front squats: 0-30% duck under into the cage, 30-45% stand and turn, 45-60% step to
  // the bar, 60-75% take it, 75-100% step back.
  const u = t / span;
  const inside = [s.rackPress.at[0], 0, s.rackPress.at[2] - 0.03];
  if (u < 0.3) {
    const k = u / 0.3;
    return {
      ...base,
      position: mix(s.rackEntry.at, inside, smooth(k)),
      facing: 0,
      clip: "idle",
      phase: "duck into the cage",
      bars: bars(false),
      lift: lift("duck", k, { crouch: Math.sin(Math.PI * clamp(k * 1.15 - 0.05)), gait: k * 3 }, smooth((u * span) / RAMP)),
    };
  }
  if (u < 0.45)
    return {
      ...base,
      position: inside,
      facing: angleLerp(0, Math.PI, smooth((u - 0.3) / 0.15)),
      clip: "idle",
      phase: "turn to the bar",
      bars: bars(false),
      lift: lift("duck", 1, { crouch: 0, gait: 3 }, 1 - smooth((u - 0.3) / 0.06)),
    };
  const take = smooth((u - 0.6) / 0.15);
  const position =
    u < 0.6
      ? mix(inside, s.rackPressUnrack.at, smooth((u - 0.45) / 0.15))
      : u < 0.75
        ? s.rackPressUnrack.at
        : mix(s.rackPressUnrack.at, s.rackPress.at, smooth((u - 0.75) / 0.25));
  return {
    ...base,
    position,
    facing: Math.PI,
    clip: "idle",
    phase: u < 0.75 ? "take the bar" : "step back",
    bars: bars(u >= 0.7),
    lift: lift(
      name,
      0,
      { ...ctx, take, step: u < 0.6 ? (u - 0.45) / 0.15 : u >= 0.75 ? (u - 0.75) / 0.25 : null },
      smooth(((u - 0.45) * span) / RAMP)
    ),
  };
}

function rerackPose(base, layout, segment, t, span, gym) {
  const s = layout.spots,
    name = segment.lift,
    station = LIFT_STATION[name];
  const bars = (held) => ({ ...base.bars, [station]: { ...base.bars[station], held } });
  const u = t / span;
  if (station === "platform") {
    const ctx = liftContext(name, gym);
    return {
      ...base,
      position: s.platform.at,
      facing: s.platform.facing,
      clip: "idle",
      phase: "stand up",
      bars: bars(false),
      lift: lift(name, 0, { ...ctx, approach: 1 - smooth(u) }, 1 - smooth((u * span - (span - RAMP * 1.5)) / (RAMP * 1.5))),
    };
  }
  if (station === "bench") {
    const ctx = liftContext(name, gym);
    return {
      ...base,
      position: s.benchMount.at,
      facing: s.benchMount.facing,
      clip: "idle",
      phase: "rack and sit up",
      bars: bars(u < 0.18),
      lift: lift(name, 0, { ...ctx, mount: 1 - smooth((u - 0.16) / 0.84) }, 1 - smooth((u * span - (span - RAMP)) / RAMP)),
    };
  }
  const ctx = liftContext(name, gym);
  if (name === "squat") {
    // 0-40% two steps forward, 40-60% set the bar in the cups, 60-100% walk out from under it.
    const position =
      u < 0.4
        ? mix(s.rackSquat.at, s.rackUnrack.at, smooth(u / 0.4))
        : u < 0.6
          ? s.rackUnrack.at
          : mix(s.rackUnrack.at, s.rackEntry.at, smooth((u - 0.6) / 0.4));
    const dip = u < 0.4 ? 0 : u < 0.6 ? Math.sin((Math.PI * (u - 0.4)) / 0.2) : 0;
    if (u >= 0.6) {
      const k = (u - 0.6) / 0.4;
      return { ...base, position, facing: Math.PI, clip: "walk", phase: "step out", bars: bars(false) };
    }
    return {
      ...base,
      position,
      facing: Math.PI,
      clip: "idle",
      phase: "rack the bar",
      bars: bars(u < 0.5),
      lift: lift(
        "squat",
        0,
        { ...ctx, dip, step: u < 0.4 ? u / 0.4 : null, carry: u < 0.5 ? 1 : 1 - smooth((u - 0.5) / 0.1) },
        1 - smooth((u * span - 0.6 * span + RAMP) / RAMP)
      ),
    };
  }
  // Presses and front squats: 0-25% step forward, 25-45% set the bar, 45-90% duck out, then stand.
  const outside = s.rackEntry.at;
  if (u < 0.45) {
    const position = u < 0.25 ? mix(s.rackPress.at, s.rackPressUnrack.at, smooth(u / 0.25)) : s.rackPressUnrack.at;
    return {
      ...base,
      position,
      facing: Math.PI,
      clip: "idle",
      phase: "rack the bar",
      bars: bars(u < 0.38),
      lift: lift(name, 0, { ...ctx, take: u < 0.25 ? 1 : 1 - smooth((u - 0.25) / 0.2), step: u < 0.25 ? u / 0.25 : null }, 1),
    };
  }
  const k = clamp((u - 0.45) / 0.45);
  return {
    ...base,
    position: mix(s.rackPressUnrack.at, outside, smooth(k)),
    facing: Math.PI,
    clip: "idle",
    phase: "duck out",
    bars: bars(false),
    lift: lift("duck", k, { crouch: Math.sin(Math.PI * clamp(k * 1.1)), gait: k * 3 }, 1 - smooth((u * span - (span - RAMP)) / RAMP)),
  };
}

// Pull-ups: a small jump to the bar, the reps, a drop. Dips: step between the bars, press up, the
// reps, step down and out. Curls: take both dumbbells off the rack, alternate arms, put them back.
function supersetPose(base, layout, segment, t, span, gym) {
  const s = layout.spots,
    name = segment.lift;
  const label = `${segment.finisher ? "finisher" : segment.accessory ? "accessory" : "superset"} · ${name === "pullup" ? "pull-ups" : name === "dip" ? "dips" : "curls"} × ${segment.reps}`;
  const overhead = SUPERSET_OVERHEAD[name];
  if (name === "pullup") {
    const ctx = liftContext("pullup", gym);
    const jump = 0.95,
      drop = overhead - jump;
    const work = span - overhead;
    if (t < jump)
      return {
        ...base,
        position: s.pullup.at,
        facing: Math.PI,
        clip: "idle",
        phase: label,
        lift: lift("pullup", 0, { ...ctx, mount: t / jump }, smooth(t / 0.25)),
      };
    if (t > span - drop)
      return {
        ...base,
        position: s.pullup.at,
        facing: Math.PI,
        clip: "idle",
        phase: label,
        lift: lift("pullup", 0, { ...ctx, mount: 1 - (t - (span - drop)) / drop }, 1 - smooth((t - (span - 0.25)) / 0.25)),
      };
    const u = ((t - jump) / work) * segment.reps;
    return {
      ...base,
      position: s.pullup.at,
      facing: Math.PI,
      clip: "idle",
      phase: label,
      rep: Math.min(segment.reps, Math.floor(u) + 1),
      lift: lift("pullup", u % 1, { ...ctx, mount: 1 }, 1),
    };
  }
  if (name === "dip") {
    const ctx = liftContext("dip", gym);
    const enter = 1.5,
      leave = overhead - enter;
    const work = span - overhead;
    if (t < enter) {
      const k = t / enter;
      return {
        ...base,
        position: mix(s.dipFront.at, s.dip.at, smooth(k * 1.4)),
        facing: Math.PI,
        clip: "idle",
        phase: label,
        lift: lift("dip", 0, { ...ctx, mount: smooth((k - 0.45) / 0.55), step: clamp(k * 1.4) }, smooth(t / 0.3)),
      };
    }
    if (t > span - leave) {
      const k = (t - (span - leave)) / leave;
      return {
        ...base,
        position: mix(s.dip.at, s.dipFront.at, smooth((k - 0.35) / 0.65)),
        facing: Math.PI,
        clip: "idle",
        phase: label,
        lift: lift("dip", 0, { ...ctx, mount: 1 - smooth(k / 0.45), step: clamp((k - 0.35) / 0.65) }, 1 - smooth((t - (span - 0.3)) / 0.3)),
      };
    }
    const u = ((t - enter) / work) * segment.reps;
    return {
      ...base,
      position: s.dip.at,
      facing: Math.PI,
      clip: "idle",
      phase: label,
      rep: Math.min(segment.reps, Math.floor(u) + 1),
      lift: lift("dip", u % 1, { ...ctx, mount: 1 }, 1),
    };
  }
  // Curls.
  const pickSpan = overhead / 2;
  const toward = -Math.PI / 2;
  const ctx = { dumbbells: gym.dumbbells.pair };
  if (t < pickSpan) {
    const k = t / pickSpan;
    // Turn to the rack, reach and lift, turn back.
    const facing =
      k < 0.25 ? angleLerp(Math.PI, toward, smooth(k / 0.25)) : k < 0.75 ? toward : angleLerp(toward, Math.PI, smooth((k - 0.75) / 0.25));
    return {
      ...base,
      position: s.curl.at,
      facing,
      clip: "idle",
      phase: label,
      dumbbells: k > 0.5 ? "hands" : "rack",
      lift: lift("curl", 0, { ...ctx, pick: k < 0.25 ? 0 : k < 0.75 ? Math.sin((Math.PI * (k - 0.25)) / 0.5) : 0, facing }, smooth(t / 0.3)),
    };
  }
  if (t > span - pickSpan) {
    const k = (t - (span - pickSpan)) / pickSpan;
    const facing =
      k < 0.25 ? angleLerp(Math.PI, toward, smooth(k / 0.25)) : k < 0.75 ? toward : angleLerp(toward, Math.PI, smooth((k - 0.75) / 0.25));
    return {
      ...base,
      position: s.curl.at,
      facing,
      clip: "idle",
      phase: label,
      dumbbells: k < 0.5 ? "hands" : "rack",
      lift: lift(
        "curl",
        0,
        { ...ctx, pick: k < 0.25 ? 0 : k < 0.75 ? Math.sin((Math.PI * (k - 0.25)) / 0.5) : 0, facing },
        1 - smooth((t - (span - 0.3)) / 0.3)
      ),
    };
  }
  const u = (t - pickSpan) / (2 * REP_SECONDS.curl);
  return {
    ...base,
    position: s.curl.at,
    facing: Math.PI,
    clip: "idle",
    phase: label,
    dumbbells: "hands",
    rep: Math.min(segment.reps, Math.floor(u) + 1),
    lift: lift("curl", u % 1, { ...ctx, pick: 0, facing: Math.PI }, 1),
  };
}
