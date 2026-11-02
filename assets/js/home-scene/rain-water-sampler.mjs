// Query the actual displaced grid triangles, rather than treating a Gerstner
// parameter as a world-space position or using a finer spectrum than the rendered geometry.
export function createRenderedWaterSampler(geometry, origin, spectrum, { footprint = 1.1, subdivisions = 160 } = {}) {
  const position = geometry.getAttribute("position"),
    index = geometry.index,
    side = subdivisions + 1;
  if (position.count !== side * side || index.count !== subdivisions * subdivisions * 6) throw new Error("Unexpected ocean grid");
  const xAxis = Array.from({ length: side }, (_, i) => position.getX(i));
  const zAxis = Array.from({ length: side }, (_, i) => position.getZ(i * side));
  for (let i = 1; i < side; i++) if (!(xAxis[i] > xAxis[i - 1] && zAxis[i] > zAxis[i - 1])) throw new Error("Ocean grid must be monotone");
  const locate = (axis, value) => {
    let lo = 0,
      hi = axis.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (axis[mid] <= value) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  function vertex(i, seconds, wind, cache) {
    if (cache.has(i)) return cache.get(i);
    const x = position.getX(i),
      z = position.getZ(i),
      field = spectrum(x, z, seconds, footprint, wind);
    const p = [x + origin[0] + field.displacement[0], position.getY(i) + origin[1] + field.displacement[1], z + origin[2] + field.displacement[2]];
    cache.set(i, p);
    return p;
  }
  function sample(x, z, seconds, wind) {
    if (![x, z, seconds].every(Number.isFinite)) return null;
    let u = x - origin[0],
      v = z - origin[2];
    for (let step = 0; step < 5; step++) {
      const f = spectrum(u, v, seconds, footprint, wind),
        dx = u + f.displacement[0] - (x - origin[0]),
        dz = v + f.displacement[2] - (z - origin[2]);
      const determinant = f.tangentX[0] * f.tangentZ[2] - f.tangentZ[0] * f.tangentX[2];
      if (!(determinant > 0.1)) return null;
      u -= (f.tangentZ[2] * dx - f.tangentZ[0] * dz) / determinant;
      v -= (-f.tangentX[2] * dx + f.tangentX[0] * dz) / determinant;
    }
    const column = locate(xAxis, u),
      row = locate(zAxis, v),
      cache = new Map();
    for (const radius of [1, 3]) {
      for (let j = Math.max(0, row - radius); j <= Math.min(subdivisions - 1, row + radius); j++)
        for (let i = Math.max(0, column - radius); i <= Math.min(subdivisions - 1, column + radius); i++) {
          const base = (j * subdivisions + i) * 6;
          for (let triangle = 0; triangle < 2; triangle++) {
            const at = base + triangle * 3,
              ids = [index.getX(at), index.getX(at + 1), index.getX(at + 2)];
            const [a, b, c] = ids.map((id) => vertex(id, seconds, wind, cache));
            const determinant = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
            if (Math.abs(determinant) < 1e-15) continue;
            const wa = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / determinant;
            const wb = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / determinant,
              wc = 1 - wa - wb;
            if (Math.min(wa, wb, wc) < -1e-8) continue;
            return { y: wa * a[1] + wb * b[1] + wc * c[1], triangle: at / 3, barycentric: [wa, wb, wc], parameter: [u, v], vertices: [a, b, c] };
          }
        }
    }
    return null;
  }
  return { sample, vertex: (id, seconds, wind) => vertex(id, seconds, wind, new Map()), footprint, triangles: index.count / 3 };
}
