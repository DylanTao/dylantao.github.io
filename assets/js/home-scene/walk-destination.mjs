import { BODY } from "./colliders.mjs";

// Plan short walks over the same layered collision field that moves the visitor.
// An edge must reach its requested point; the manual solver's wall-slide is
// never treated as a shortcut when building a route.
export const TAP_WALK = Object.freeze({
  distance: 7,
  pathLength: 11,
  nodes: 1050,
  snap: 0.12,
  arrival: 0.055,
  speed: 1.65,
});

const NEIGHBOURS = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, -1],
  [-1, 1],
];
const EDGE_ERROR = 0.006;
const SAME_FLOOR = 0.095;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dry = (point, waterAt) => (waterAt(point.x, point.z)?.y ?? -Infinity) <= point.foot + 0.002;

function admitted(field, from, x, z, dynamic, waterAt) {
  const next = field.move(from.x, from.z, from.foot, x - from.x, z - from.z, BODY, dynamic);
  return !next.blocked && Math.hypot(next.x - x, next.z - z) <= EDGE_ERROR && dry(next, waterAt) ? next : null;
}

// A visible floor hit supplies the intended story height, rather than asking
// the collision field for the nearest floor anywhere above/below the mouse.
export function planWalkDestination(field, from, hit, { dynamic = [], waterAt = () => null } = {}) {
  if (!field || ![from.x, from.z, from.foot, hit.x, hit.z, hit.y].every(Number.isFinite)) return null;
  if (distance(from, hit) > TAP_WALK.distance || !dry(from, waterAt)) return null;
  const target = field.findStand(hit.x, hit.z, hit.y, { reach: TAP_WALK.snap, tolerance: SAME_FLOOR });
  if (!target || !dry(target, waterAt) || distance(from, target) <= TAP_WALK.arrival) return null;
  if (distance(from, target) > TAP_WALK.distance) return null;

  // The common case is one straight walk. Sample water and support along
  // the edge; a continuous solver sweep alone does not report water.
  const direct = [];
  let current = from;
  const steps = Math.ceil(distance(from, target) / (field.cell * 1.5));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    current = admitted(field, current, from.x + (target.x - from.x) * t, from.z + (target.z - from.z) * t, dynamic, waterAt);
    if (!current) break;
    direct.push(current);
  }
  if (current && Math.abs(current.foot - target.foot) <= SAME_FLOOR) return { target, points: direct, next: 0 };

  const stride = field.cell * 2;
  const score = (point) => distance(point, target) + Math.abs(point.foot - target.foot) * 0.24;
  const layerKey = (ix, iz, foot) => ix + "," + iz + "," + Math.round(foot / 0.045);
  const initial = { point: from, ix: 0, iz: 0, length: 0, total: score(from), parent: null };
  const frontier = [initial];
  const best = new Map([[layerKey(0, 0, from.foot), 0]]);
  for (let explored = 0; frontier.length && explored < TAP_WALK.nodes; explored++) {
    let first = 0;
    for (let i = 1; i < frontier.length; i++) if (frontier[i].total < frontier[first].total) first = i;
    const node = frontier.splice(first, 1)[0];
    if (node.length !== best.get(layerKey(node.ix, node.iz, node.point.foot))) continue;
    if (distance(node.point, target) <= stride * 1.45 && node.length + distance(node.point, target) <= TAP_WALK.pathLength) {
      const final = admitted(field, node.point, target.x, target.z, dynamic, waterAt);
      if (final && Math.abs(final.foot - target.foot) <= SAME_FLOOR) {
        const points = [final];
        for (let at = node; at.parent; at = at.parent) points.push(at.point);
        return { target, points: points.reverse(), next: 0 };
      }
    }
    for (const [di, dj] of NEIGHBOURS) {
      const ix = node.ix + di;
      const iz = node.iz + dj;
      const length = node.length + Math.hypot(di, dj) * stride;
      if (length > TAP_WALK.pathLength || Math.hypot(ix * stride, iz * stride) > TAP_WALK.distance + 1.4) continue;
      const point = admitted(field, node.point, from.x + ix * stride, from.z + iz * stride, dynamic, waterAt);
      if (!point) continue;
      const key = layerKey(ix, iz, point.foot);
      if (length >= (best.get(key) ?? Infinity)) continue;
      best.set(key, length);
      frontier.push({ point, ix, iz, length, total: length + score(point), parent: node });
    }
  }
  return null;
}

// Preflight every requested horizontal displacement against the live capsule
// and moving obstacles. The caller still applies it with the normal flight
// solver, including actual gravity and support.
export function nextWalkDestinationStep(route, field, from, dt, { dynamic = [], waterAt = () => null } = {}) {
  if (from.grounded === false || !dry(from, waterAt)) return { status: "blocked" };
  while (route.next < route.points.length) {
    const point = route.points[route.next];
    const reach = route.next === route.points.length - 1 ? TAP_WALK.arrival : 0.008;
    if (distance(from, point) > reach || Math.abs(from.foot - point.foot) > SAME_FLOOR) break;
    route.next++;
  }
  const point = route.points[route.next];
  if (!point) return { status: "arrived" };
  const left = distance(from, point);
  if (left < 0.001) return { status: "blocked" };
  const scale = Math.min(1, (TAP_WALK.speed * dt) / left);
  const dx = (point.x - from.x) * scale;
  const dz = (point.z - from.z) * scale;
  return admitted(field, from, from.x + dx, from.z + dz, dynamic, waterAt) ? { status: "walking", dx, dz } : { status: "blocked" };
}
