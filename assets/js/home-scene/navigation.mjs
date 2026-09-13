// Authored circulation, including the actual stair landing and every tread.
// Linear segments stay inside the corridor; a spline can cut through furniture
// or overshoot the first and last riser. Camera easing is independent.
export function roomRoute(config, from, to, start) {
  const nav = config.navigation;
  const begin = [start[0], from?.floor ?? 0, start[2]];
  const end = [to.actor[0], to.floor, to.actor[2]];
  const exit = from?.egress || begin;
  const entry = to.egress;
  const points = [begin, ...(from?.exitPath || [exit])];
  const landing = (room, egress) => {
    const z = room?.floor > 0 ? nav.upperAisleZ : nav.lowerAisleZ;
    return [
      [egress[0], room?.floor ?? 0, z],
      [room?.floor > 0 ? nav.stairX : nav.lowerStairApproach[0][0], room?.floor ?? 0, z],
    ];
  };
  points.push(...landing(from, exit));
  if ((from?.floor ?? 0) !== to.floor) {
    const stairs = [...nav.lowerStairApproach, ...nav.stairs];
    points.push(...(to.floor > 0 ? stairs : [...stairs].reverse()));
  }
  points.push(...landing(to, entry).reverse(), ...[...(to.exitPath || [entry])].reverse(), end);
  const unique = points.filter((p, i) => !i || Math.hypot(...p.map((v, j) => v - points[i - 1][j])) > 0.001);
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
