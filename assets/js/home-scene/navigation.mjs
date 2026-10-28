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

const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const pathLength = (points) => points.slice(1).reduce((total, point, i) => total + distance(points[i], point), 0);

// Room exit polylines often share an aisle. Join on that actual shared line,
// rather than walking to its remote end and immediately retracing it. Only an
// existing authored segment is shortened: no diagonal crosses furniture.
function joinSharedAisle(from, to) {
  let best = null;
  const consider = (point, a, b) => {
    const points = [...from.slice(0, a + 1), point, ...to.slice(0, b + 1).reverse()];
    const length = pathLength(points);
    if (!best || length < best.length) best = { points, length };
  };
  const onSegment = (point, a, b) => {
    const span = distance(a, b);
    return span > 1e-6 && Math.abs(distance(a, point) + distance(point, b) - span) < 1e-5;
  };
  for (let a = 0; a < from.length; a++)
    for (let b = 0; b + 1 < to.length; b++) if (onSegment(from[a], to[b], to[b + 1])) consider(from[a], Math.max(0, a - 1), b);
  for (let b = 0; b < to.length; b++)
    for (let a = 0; a + 1 < from.length; a++) if (onSegment(to[b], from[a], from[a + 1])) consider(to[b], a, Math.max(0, b - 1));
  return best?.points;
}

export function roomRoute(config, from, to, start, { companion = false } = {}) {
  const nav = config.navigation;
  // Air departures can clear fitted shelves and screens without changing a
  // human exit, supported floor or riser. Their Y is base position, before hover.
  const airExits = companion ? config.companion?.roomExits : null;
  from = from && { ...from, ...config.terrain.contacts[from.id], ...airExits?.[from.id] };
  to = { ...to, ...config.terrain.contacts[to.id], ...airExits?.[to.id] };
  const ground = (point) => [point[0], supportHeight(point[0], point[2], config.terrain, point[1]), point[2]];
  // Seated/bathing roots are pose offsets, and room.floor is the corridor storey. Neither is the
  // walking floor inside a sunken nook or conversation pit.
  const begin = ground(start);
  const end = ground((!companion && to.walkActor) || to.actor);
  const exit = from?.egress || begin;
  const entry = to.egress;
  let points = [begin, ...(from?.exitPath || [exit])];
  let connection = "main-aisles";
  const storeyMiddle = (nav.stairs[0][1] + nav.stairs.at(-1)[1]) / 2;
  const upper = (egress) => egress[1] > storeyMiddle;
  const landing = (egress) => {
    const z = upper(egress) ? nav.upperAisleZ : nav.lowerAisleZ;
    return [
      [egress[0], egress[1], z],
      [upper(egress) ? nav.stairX : nav.lowerStairApproach[0][0], egress[1], z],
    ];
  };
  const privateLibrary = config.estateLibrary;
  const privatePair = from && [from.id, to.id].sort().join(":") === "sleep:study";
  const airConnection = companion && config.companion?.privateLibraryConnection;
  if (privatePair && (airConnection?.length > 1 || (privateLibrary?.bedroomApproach?.length > 1 && privateLibrary?.privateConnection?.length > 1))) {
    const path = airConnection || [...privateLibrary.bedroomApproach, ...privateLibrary.privateConnection];
    points = [begin, ...(from.id === "sleep" ? path : [...path].reverse()), end];
    connection = "bedroom-study";
  } else if (upper(exit) === upper(entry) && from?.id !== to.id) {
    const joined = joinSharedAisle([...points, ...landing(exit)], [end, ...(to.exitPath || [entry]), ...landing(entry)]);
    points = joined || [...points, ...landing(exit), ...landing(entry).reverse(), ...[...(to.exitPath || [entry])].reverse(), end];
    connection = joined ? "shared-aisle" : connection;
  } else {
    points.push(...landing(exit));
    if (upper(exit) !== upper(entry)) {
      const stairs = [...nav.lowerStairApproach, ...nav.stairs];
      points.push(...(upper(entry) ? stairs : [...stairs].reverse()));
    }
    points.push(...landing(entry).reverse(), ...[...(to.exitPath || [entry])].reverse(), end);
  }
  // Authored air arcs already describe their vertical travel; inserting a
  // projected floor tread would pull an airborne companion down into furniture.
  const supported =
    companion && airExits
      ? points
      : points.flatMap((point, i) => (i ? [...crossedLocalTreads(points[i - 1], point, config.terrain), point] : [point]));
  const unique = supported.filter((p, i) => !i || Math.hypot(...p.map((v, j) => v - supported[i - 1][j])) > 0.001);
  const distances = [0];
  for (let i = 1; i < unique.length; i++) distances.push(distances.at(-1) + Math.hypot(...unique[i].map((v, j) => v - unique[i - 1][j])));
  return { points: unique, distances, length: distances.at(-1), connection };
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
