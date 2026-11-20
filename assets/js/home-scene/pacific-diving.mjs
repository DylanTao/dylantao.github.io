const clamp = (n, lo, hi) => Math.max(lo, Math.min(n, hi));

export const DIVE = Object.freeze({
  eyeHeight: 1.6,
  minimumWater: 2.2,
  initialDepth: 0.58,
  maxDepth: 3.25,
  bottomClearance: 0.035,
  opticalMargin: 0.22,
  bounds: Object.freeze({ minX: -23, maxX: 27, minZ: -45, maxZ: -11 }),
});

export function diveWater(water) {
  return water?.id === "pacific" && Number.isFinite(water.floor) && Number.isFinite(water.y) && water.floor + 0.035 < water.y;
}

export function insideDiveArea(x, z, margin = 0) {
  const { minX, maxX, minZ, maxZ } = DIVE.bounds;
  return x >= minX - margin && x <= maxX + margin && z >= minZ - margin && z <= maxZ + margin;
}

export function canDive(water, foot, x, z) {
  return diveWater(water) && water.y - water.floor >= DIVE.minimumWater && foot < water.y - 0.12 && insideDiveArea(x, z);
}

export function diveDepth(depth, forward, pitch, dt) {
  return clamp(depth - 0.82 * forward * Math.sin(pitch) * dt, 0.42, DIVE.maxDepth);
}

// Keep the visitor's normal capsule. The camera's intended depth is bounded by the
// first solid bed under the body, including the part beyond the native beach mesh.
export function diveAcceleration(water, foot, velocity, intent) {
  if (!intent || !diveWater(water) || foot >= water.y) return null;
  const feetBelowSurface = intent.mode === "surface" ? 1.02 : DIVE.eyeHeight + intent.depth;
  const target = Math.max(water.floor + DIVE.bottomClearance, water.y - feetBelowSurface);
  return clamp((target - foot) * 9 - 4.6 * velocity, -4.1, 5.8);
}

export function diveHasSurfaced(water, foot) {
  return !diveWater(water) || foot + DIVE.eyeHeight >= water.y + 0.26;
}
