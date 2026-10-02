// One envelope applies to pointer, touch, wheel, keys, and camera settling.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function envelopeFor(config, room) {
  return (config.views[room] || config.rooms.find((r) => r.id === room)?.camera)?.envelope;
}
// An explicitly selected coastal neighbour needs a nearer, model-sized orbit.
// Terrain clearance still uses the same finished mainland/beach height grid.
export function wildlifeEnvelope(modelRadius) {
  const size = clamp(Number.isFinite(modelRadius) ? modelRadius : 0.6, 0.2, 2);
  return { pitch: [0.12, 0.95], radius: [Math.max(1.8, size * 2.9), Math.max(5, size * 7)] };
}
export function constrainOrbit(orbit, envelope) {
  if (!envelope) return orbit;
  let yaw = orbit.yaw;
  if (envelope.yaw) {
    const [a, b] = envelope.yaw,
      middle = (a + b) / 2;
    yaw = middle + Math.atan2(Math.sin(yaw - middle), Math.cos(yaw - middle));
    yaw = clamp(yaw, a, b);
  }
  const pitch = clamp(orbit.pitch, ...envelope.pitch);
  let maxRadius = envelope.radius[1];
  if (envelope.clearance) {
    const { origin, maxX, maxZ } = envelope.clearance;
    // A front room orbit must dolly before reaching the side wall or gallery
    // slab. Bound the orbit ray continuously instead of jumping behind them.
    for (const [direction, distance] of [
      [Math.sin(yaw) * Math.cos(pitch), maxX - origin[0]],
      [Math.cos(yaw) * Math.cos(pitch), maxZ - origin[2]],
    ]) {
      if (direction > 0.000001) maxRadius = Math.min(maxRadius, distance / direction);
    }
  }
  return { yaw, pitch, radius: clamp(orbit.radius, envelope.radius[0], Math.max(envelope.radius[0], maxRadius)) };
}
export function cameraTerrainHeight(x, z, collision) {
  if (!collision) return -Infinity;
  const u = (x - collision.origin[0]) / collision.step,
    v = (z - collision.origin[1]) / collision.step;
  if (u < 0 || v < 0 || u >= collision.width - 1 || v >= collision.height - 1) return -Infinity;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const at = (dx, dz) => collision.elevations[(j + dz) * collision.width + i + dx];
  return (at(0, 0) * (1 - a) + at(1, 0) * a) * (1 - b) + (at(0, 1) * (1 - a) + at(1, 1) * a) * b;
}
export function keepCameraClear(position, config, room) {
  const c = config?.cameraCollision;
  if (!c) return;
  const pad = c.clearance;
  if (room === "outside") {
    position.y = Math.max(position.y, cameraTerrainHeight(position.x, position.z, c) + pad);
    return;
  }
  // During room-to-room interpolation, project an intersecting near plane
  // toward the Pacific opening. Never let a wall become the camera's interior.
  for (const wall of c.walls) {
    const p = position;
    if (
      p.x > wall.min[0] - pad &&
      p.x < wall.max[0] + pad &&
      p.y > wall.min[1] - pad &&
      p.y < wall.max[1] + pad &&
      p.z > wall.min[2] - pad &&
      p.z < wall.max[2] + pad
    )
      p.z = wall.min[2] - pad;
  }
}
