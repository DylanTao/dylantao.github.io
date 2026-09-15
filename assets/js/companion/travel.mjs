// Bounded page-space navigation. Obstacles are live rendered rectangles, never
// rewritten text. A squeezed route must still fit its smaller footprint.
import { clearAt } from "./behaviour.mjs";
import { minimumJerk } from "./motion.mjs";

export function segmentClear(a, b, obstacles, size) {
  for (const r of obstacles) {
    let lo = 0,
      hi = 1;
    for (const [key, min, max, pad] of [
      ["x", "left", "right", size * 0.39 + 5],
      ["y", "top", "bottom", size * 0.48 + 5],
    ]) {
      const delta = b[key] - a[key];
      if (Math.abs(delta) < 0.0001) {
        if (a[key] < r[min] - pad || a[key] > r[max] + pad) {
          lo = 2;
          break;
        }
      } else {
        const t1 = (r[min] - pad - a[key]) / delta,
          t2 = (r[max] + pad - a[key]) / delta;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
      }
    }
    if (lo <= hi) return false;
  }
  return true;
}

function route(start, end, obstacles, width, height, size) {
  if (!clearAt(start.x, start.y, obstacles, size) || !clearAt(end.x, end.y, obstacles, size)) return null;
  if (segmentClear(start, end, obstacles, size)) return [start, end];
  // Visibility graph of expanded obstacle corners. Cap to viewport rectangles
  // and deduplicate nested text/link boxes before adding nodes.
  const padX = size * 0.39 + 24,
    padY = size * 0.48 + 24;
  const nodes = [start, end];
  const hulls = obstacles.filter(
    (r, i) =>
      !obstacles.some(
        (q, j) =>
          j !== i &&
          q.left <= r.left &&
          q.top <= r.top &&
          q.right >= r.right &&
          q.bottom >= r.bottom &&
          (j < i || q.width > r.width || q.height > r.height)
      )
  );
  for (const r of hulls.slice(0, 90)) {
    for (const x of [r.left - padX, r.right + padX])
      for (const y of [r.top - padY, r.bottom + padY]) {
        if (x < size * 0.5 + 5 || x > width - size * 0.5 - 5 || y < 90 || y > height - size * 0.5 - 5 || !clearAt(x, y, obstacles, size)) continue;
        if (nodes.length < 72 && !nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 12)) nodes.push({ x, y });
      }
  }
  const distance = nodes.map(() => Infinity),
    previous = nodes.map(() => -1),
    visited = new Set();
  distance[0] = 0;
  while (visited.size < nodes.length) {
    let at = -1,
      score = Infinity;
    for (let i = 0; i < nodes.length; i++)
      if (!visited.has(i) && distance[i] < score) {
        at = i;
        score = distance[i];
      }
    if (at < 0 || at === 1) break;
    visited.add(at);
    for (let i = 0; i < nodes.length; i++) {
      if (visited.has(i) || i === at) continue;
      const next = score + Math.hypot(nodes[i].x - nodes[at].x, nodes[i].y - nodes[at].y);
      if (next < distance[i] && segmentClear(nodes[at], nodes[i], obstacles, size)) {
        distance[i] = next;
        previous[i] = at;
      }
    }
  }
  if (!Number.isFinite(distance[1])) return null;
  const result = [end];
  for (let i = previous[1]; i >= 0; i = previous[i]) result.unshift(nodes[i]);
  return result;
}

// Round a visibility path only where the entire curve has clearance. A single
// arc-length clock carries momentum through bends instead of restarting the
// easing at every graph corner. The sampled chords are also used on reflow.
function softenRoute(points, obstacles, size) {
  const result = [points[0]];
  const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1],
      b = points[i],
      c = points[i + 1];
    const before = Math.hypot(b.x - a.x, b.y - a.y),
      after = Math.hypot(c.x - b.x, c.y - b.y);
    let bend = null;
    for (const radius of [44, 28, 16, 8]) {
      const reach = Math.min(radius, before * 0.35, after * 0.35);
      const entry = mix(b, a, reach / before),
        exit = mix(b, c, reach / after);
      const candidate = Array.from({ length: 13 }, (_, j) => {
        const t = j / 12;
        return mix(mix(entry, b, t), mix(b, exit, t), t);
      });
      if (candidate.slice(1).every((p, j) => segmentClear(candidate[j], p, obstacles, size))) {
        bend = candidate;
        break;
      }
    }
    result.push(...(bend || [b]));
  }
  result.push(points.at(-1));
  return result;
}

export function planTravel(start, end, { obstacles = [], width, height, size = 70, kind } = {}) {
  const direct = Math.hypot(end.x - start.x, end.y - start.y);
  let points = kind === "portal" ? null : route(start, end, obstacles, width, height, size);
  let mode = "fly",
    footprint = size;
  const lengthOf = (points) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
  if (kind === "squeeze" || !points || lengthOf(points) > direct * 2.2 + 120) {
    const narrow = route(start, end, obstacles, width, height, size * 0.56);
    if (narrow && kind !== "portal" && (kind === "squeeze" || !points || lengthOf(narrow) < lengthOf(points) * 0.8)) {
      points = narrow;
      mode = "squeeze";
      footprint = size * 0.56;
    }
  }
  if (!points || kind === "portal") {
    points = [start, end];
    mode = "portal";
  }
  if (mode !== "portal") points = softenRoute(points, obstacles, footprint);
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return { kind: mode, points, lengths, footprint, duration: mode === "portal" ? 1.9 : Math.max(0.85, Math.min(7, lengths.at(-1) / 115 + 0.5)) };
}

export function sampleTravel(plan, seconds) {
  const u = Math.min(1, Math.max(0, seconds / plan.duration));
  const start = plan.points[0],
    end = plan.points.at(-1);
  if (plan.kind === "portal") {
    const entering = u < 0.5;
    const shrink = entering ? 1 - minimumJerk(Math.max(0, (u - 0.12) / 0.3)) : minimumJerk(Math.max(0, (u - 0.57) / 0.3));
    return {
      ...(entering ? start : end),
      scale: Math.max(0.03, shrink),
      opacity: shrink,
      bank: entering ? -12 * (1 - shrink) : 12 * (1 - shrink),
      done: u === 1,
      portal: Math.sin(Math.PI * u),
      phase: entering ? "enter" : "exit",
    };
  }
  const travel = plan.kind === "squeeze" ? Math.min(1, Math.max(0, (u - 0.16) / 0.68)) : Math.max(0, (u - 0.07) / 0.93);
  const length = minimumJerk(travel) * plan.lengths.at(-1);
  let i = 1;
  while (i < plan.lengths.length - 1 && length > plan.lengths[i]) i++;
  const a = plan.points[i - 1],
    b = plan.points[i];
  const t = (length - plan.lengths[i - 1]) / Math.max(0.001, plan.lengths[i] - plan.lengths[i - 1]);
  const span = Math.max(0.001, plan.lengths[i] - plan.lengths[i - 1]);
  const direction = [(b.x - a.x) / span, (b.y - a.y) / span];
  const squeeze = plan.kind === "squeeze" ? 1 - 0.44 * minimumJerk(Math.min(1, u / 0.16, (1 - u) / 0.16)) : 1;
  return {
    x: u === 1 ? end.x : a.x + (b.x - a.x) * t,
    y: u === 1 ? end.y : a.y + (b.y - a.y) * t,
    scale: squeeze,
    opacity: 1,
    bank: direction[0] * 7 * Math.sin(Math.PI * travel),
    gaze: [direction[0] * 0.8, -direction[1] * 0.6],
    done: u === 1,
    portal: 0,
    phase: plan.kind,
    segment: i,
  };
}
