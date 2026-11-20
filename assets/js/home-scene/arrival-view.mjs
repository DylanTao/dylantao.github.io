// The original stair head remains the route anchor. When a garden approach is authored,
// its standing view and Walk share the same supported sole position and heading.
export function arrivalStandingView(config, { eyeHeight, fov }) {
  const entrance = config?.entrance;
  const start = config?.walk?.start;
  const region = config?.walk?.region;
  const vector = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
  if (entrance?.straightDescent !== true || !start || !vector(start.position) || !vector(entrance.portal)) return null;
  if (!vector(region?.min) || !vector(region?.max) || !Number.isFinite(eyeHeight) || eyeHeight <= 0 || !Number.isFinite(fov)) return null;
  if (!Number.isFinite(start.yaw) || !Number.isFinite(start.pitch) || Math.abs(start.pitch) > 1.4 || fov < 24 || fov > 75) return null;
  if (!Number.isFinite(entrance.headroom) || eyeHeight + 0.05 >= entrance.headroom) return null;
  if (!Number.isFinite(entrance.top) || Math.abs(start.position[1] - entrance.top) > 0.00001) return null;
  if (!start.position.every((v, axis) => Math.abs(v - entrance.portal[axis]) <= 0.00001)) return null;
  const garden = config.walk.places?.entrance;
  const stand = garden || start;
  const viewFov = garden?.fov ?? fov;
  if (garden && (garden.room !== "outside" || !vector(garden.position))) return null;
  if (!Number.isFinite(stand.yaw) || !Number.isFinite(stand.pitch) || Math.abs(stand.pitch) > 1.4) return null;
  if (!Number.isFinite(viewFov) || viewFov < 24 || viewFov > 75) return null;
  const position = stand.position.map((v, axis) => v + (axis === 1 ? eyeHeight : 0));
  if (!position.every((v, axis) => region.min[axis] < region.max[axis] && v > region.min[axis] && v < region.max[axis])) return null;
  return { position, yaw: stand.yaw, pitch: stand.pitch, fov: viewFov, destination: "entrance" };
}
