// The straight descent is inspected from its real standing entry. The older
// entrance keeps its authored orbit until its geometry and metadata are replaced.
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
  const position = start.position.map((v, axis) => v + (axis === 1 ? eyeHeight : 0));
  if (!position.every((v, axis) => region.min[axis] < region.max[axis] && v > region.min[axis] && v < region.max[axis])) return null;
  return { position, yaw: start.yaw, pitch: start.pitch, fov, destination: "entrance" };
}
