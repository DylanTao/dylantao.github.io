// Rows exported by Blender: x, cliff foot, width, waterline, 21 elevations.
function sample(x, data) {
  const rows = data.samples;
  if (!rows?.length) throw new Error("The coastal manifest is missing terrain samples.");
  const u = Math.max(0, Math.min(rows.length - 1, (x - rows[0][0]) / (rows[1][0] - rows[0][0])));
  const i = Math.min(rows.length - 2, Math.floor(u)),
    t = u - i;
  return rows[i].map((v, j) => v + (rows[i + 1][j] - v) * t);
}
export const coastline = (x, data) => sample(x, data)[1];
export const beachWidth = (x, data) => sample(x, data)[2];
export const waterline = (x, data) => sample(x, data)[3];
export function beachPoint(x, fraction, data) {
  const row = sample(x, data),
    u = Math.max(0, Math.min(20, fraction * 20));
  const i = Math.min(19, Math.floor(u)),
    height = row[i + 4] + (row[i + 5] - row[i + 4]) * (u - i);
  return [x, height, -(row[1] + fraction * row[2])];
}
export function habitatPoint(path, progress) {
  const u = (((progress % 1) + 1) % 1) * path.length;
  const a = path[Math.floor(u)],
    b = path[(Math.floor(u) + 1) % path.length];
  return a.map((v, i) => v + (b[i] - v) * (u % 1));
}

// Shared support polygons are exported from the authored floors and treads.
export function supportHeight(x, z, terrain, referenceHeight = 0, stairs = false) {
  const inside = (polygon) => {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i],
        b = polygon[j];
      if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  };
  const supports = terrain.supportSurfaces.filter((s) => inside(s.polygon));
  const tread = stairs && supports.find((s) => s.id.startsWith("tread-"));
  if (tread) return tread.height;
  return (
    supports.filter((s) => !s.id.startsWith("tread-")).sort((a, b) => Math.abs(a.height - referenceHeight) - Math.abs(b.height - referenceHeight))[0]
      ?.height ?? referenceHeight
  );
}
