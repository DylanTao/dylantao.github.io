// Which level of detail each piece of furniture draws (Sirui, 2026-10-19: "maybe some level of
// details impleemntation need to be done there to allow more details as people zoom in"). Pure
// functions: furniture.mjs measures the camera and the drawing buffer each frame and asks these which
// level each anchor wants, which finer levels stay loaded, and what to fetch next.
//
// An item lists its levels coarse to fine (assets/models/home/furniture/index.json): the first is the
// default and always resident; each finer level names `near`, the distance in metres inside which it
// is worth drawing on a drawing buffer DETAIL.referenceHeight pixels tall (about the page embed's). A
// taller buffer resolves detail proportionally farther away, so full screen at 4K reaches about three
// times as far, and a level marked `fullscreen` reaches a further quarter in full screen. Switching
// has hysteresis: a finer level is taken at (1 - h) of its reach and kept until (1 + h), so a camera
// resting on the boundary never flickers between levels.

export const DETAIL = {
  hysteresis: 0.12,
  referenceHeight: 600,
  fullscreenBoost: 1.25,
  // Below this many pixels of projected radius an item is not drawn at all.
  cullPixels: 1.5,
  // Bytes of finer levels kept resident: the page embed, full screen.
  budget: { embed: 3_000_000, fullscreen: 12_000_000 },
  // A finer level nobody has wanted for this long (wall-clock milliseconds) is released.
  linger: 20000,
  // Finer levels fetched at once.
  concurrent: 2,
};

// How far a finer level reaches for this view, in metres.
export function reachFor(level, { bufferHeight = DETAIL.referenceHeight, fullscreen = false } = {}) {
  if (!(level?.near > 0)) return 0;
  const scale = Math.max(1, bufferHeight / DETAIL.referenceHeight);
  return level.near * scale * (fullscreen && level.fullscreen ? DETAIL.fullscreenBoost : 1);
}

// The level an anchor wants: 0 (the default) unless it is in view and within a finer level's reach.
// `current` is the level it shows now, for the hysteresis.
export function chooseLevel(levels, current, { distance, bufferHeight, fullscreen = false, inView = true }) {
  let wanted = 0;
  if (!inView || !Array.isArray(levels)) return 0;
  for (let i = 1; i < levels.length; i++) {
    const reach = reachFor(levels[i], { bufferHeight, fullscreen });
    if (!reach) break;
    const threshold = reach * (current >= i ? 1 + DETAIL.hysteresis : 1 - DETAIL.hysteresis);
    if (distance <= threshold) wanted = i;
    else break;
  }
  return wanted;
}

// The radius in pixels of a sphere of `radius` metres at `distance`, for a perspective camera with a
// vertical field of view `fov` (degrees) drawing into `bufferHeight` pixels.
export function projectedPixels(radius, distance, fov, bufferHeight) {
  if (!(distance > 0)) return Infinity;
  return (radius / (distance * Math.tan((fov * Math.PI) / 360))) * (bufferHeight / 2);
}

// Which finer levels to keep, fetch and release. `requests` are the finer levels anchors want now:
// { key, bytes, priority } with a smaller priority more urgent (distance over reach); `resident` maps
// each loaded or loading key to { bytes, lastWanted, loading }. Wanted levels are granted in priority
// order while they fit the budget; a resident level outside the grant is released once it has lingered
// (or at once when the grant needs its bytes); `fetch` lists granted levels not yet resident, at most
// `concurrent` loads in flight.
export function planDetail(requests, resident, { budget, now, linger = DETAIL.linger, concurrent = DETAIL.concurrent }) {
  const byKey = new Map();
  for (const request of requests) {
    const known = byKey.get(request.key);
    if (!known || request.priority < known.priority) byKey.set(request.key, request);
  }
  const ordered = [...byKey.values()].sort((a, b) => a.priority - b.priority || (a.key < b.key ? -1 : 1));
  const keep = new Set();
  let used = 0;
  for (const request of ordered) {
    if (used + request.bytes > budget) continue;
    keep.add(request.key);
    used += request.bytes;
  }
  // Resident levels nobody asked for still count until they are released.
  let held = used;
  const release = [];
  const idle = Object.entries(resident)
    .filter(([key, entry]) => !keep.has(key) && !entry.loading)
    .sort((a, b) => a[1].lastWanted - b[1].lastWanted);
  for (const [key, entry] of idle) {
    if (now - entry.lastWanted >= linger || held + entry.bytes > budget) release.push(key);
    else held += entry.bytes;
  }
  const inFlight = Object.values(resident).filter((entry) => entry.loading).length;
  const fetch = ordered
    .filter((request) => keep.has(request.key) && !resident[request.key])
    .slice(0, Math.max(0, concurrent - inFlight))
    .map((request) => request.key);
  return { keep, release, fetch, bytes: used };
}
