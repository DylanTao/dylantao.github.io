import { supportHeight } from "./shore.mjs";

// Authored circulation, including the actual stair landing and every tread.
// Linear segments stay inside the corridor; a spline can cut through furniture
// or overshoot the first and last riser. Camera easing is independent.

// A room path can span a whole sunken opening (the nook's coffee walk). Insert the actual
// intermediate rectangular tread it crosses. Already authored pit/main-stair risers remain exact.
function crossedLocalTreads(a, b, terrain) {
  const low = Math.min(a[1], b[1]),
    high = Math.max(a[1], b[1]);
  if (high - low < 0.001) return [];
  const crossed = [];
  for (const support of terrain.supportSurfaces) {
    if (!support.id.includes("-tread-") || support.height <= low + 0.0001 || support.height >= high - 0.0001) continue;
    let enter = 0,
      leave = 1;
    for (const [axis, column] of [
      [0, 0],
      [2, 1],
    ]) {
      const values = support.polygon.map((p) => p[column]);
      const lo = Math.min(...values),
        hi = Math.max(...values),
        delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-8) {
        if (a[axis] <= lo || a[axis] >= hi) leave = -1;
      } else {
        const first = (lo - a[axis]) / delta,
          last = (hi - a[axis]) / delta;
        enter = Math.max(enter, Math.min(first, last));
        leave = Math.min(leave, Math.max(first, last));
      }
    }
    if (leave - enter <= 0.0001) continue;
    const t = (enter + leave) / 2;
    crossed.push({ t, point: [a[0] + (b[0] - a[0]) * t, support.height, a[2] + (b[2] - a[2]) * t] });
  }
  return crossed.sort((a, b) => a.t - b.t).map((p) => p.point);
}

export function roomRoute(config, from, to, start) {
  const nav = config.navigation;
  from = from && { ...from, ...config.terrain.contacts[from.id] };
  to = { ...to, ...config.terrain.contacts[to.id] };
  const ground = (point) => [point[0], supportHeight(point[0], point[2], config.terrain, point[1]), point[2]];
  // Seated/bathing roots are pose offsets, and room.floor is the corridor storey. Neither is the
  // walking floor inside a sunken nook or conversation pit.
  const begin = ground(start);
  const end = ground(to.actor);
  const exit = from?.egress || begin;
  const entry = to.egress;
  const points = [begin, ...(from?.exitPath || [exit])];
  const storeyMiddle = (nav.stairs[0][1] + nav.stairs.at(-1)[1]) / 2;
  const upper = (egress) => egress[1] > storeyMiddle;
  const landing = (egress) => {
    const z = upper(egress) ? nav.upperAisleZ : nav.lowerAisleZ;
    return [
      [egress[0], egress[1], z],
      [upper(egress) ? nav.stairX : nav.lowerStairApproach[0][0], egress[1], z],
    ];
  };
  points.push(...landing(exit));
  if (upper(exit) !== upper(entry)) {
    const stairs = [...nav.lowerStairApproach, ...nav.stairs];
    points.push(...(upper(entry) ? stairs : [...stairs].reverse()));
  }
  points.push(...landing(entry).reverse(), ...[...(to.exitPath || [entry])].reverse(), end);
  const supported = points.flatMap((point, i) => (i ? [...crossedLocalTreads(points[i - 1], point, config.terrain), point] : [point]));
  const unique = supported.filter((p, i) => !i || Math.hypot(...p.map((v, j) => v - supported[i - 1][j])) > 0.001);
  const distances = [0];
  for (let i = 1; i < unique.length; i++) distances.push(distances.at(-1) + Math.hypot(...unique[i].map((v, j) => v - unique[i - 1][j])));
  return { points: unique, distances, length: distances.at(-1) };
}

export function sampleRoute(route, progress) {
  const d = Math.max(0, Math.min(1, progress)) * route.length;
  let i = route.distances.findIndex((v) => v >= d && v > 0);
  if (i < 1) i = route.points.length - 1;
  const a = route.points[i - 1],
    b = route.points[i];
  const t = (d - route.distances[i - 1]) / (route.distances[i] - route.distances[i - 1]);
  return {
    position: a.map((v, j) => v + (b[j] - v) * t),
    facing: Math.atan2(b[0] - a[0], b[2] - a[2]),
    onStairs: Math.abs(b[1] - a[1]) > 0.01,
  };
}
