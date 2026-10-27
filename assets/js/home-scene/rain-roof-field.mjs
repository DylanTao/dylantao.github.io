import * as THREE from "../three.module.min.js";

// Conservative swept-column clipping against the delivered static roof faces.
// Section-view visibility never removes a physical roof from the weather.
export function createRainRoofField(root, cellSize = 1) {
  let built = false,
    triangles = [],
    seen = new Int32Array(),
    stamp = 0;
  const cells = new Map(),
    sources = [];
  function build() {
    root.updateMatrixWorld(true);
    const p = new THREE.Vector3();
    root.traverse((mesh) => {
      if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh) return;
      let roof = /^core_(?:estate|finish)_pavilion/.test(mesh.name);
      for (let owner = mesh; owner && !roof; owner = owner.parent)
        roof = Boolean(owner.userData.caveRoof || owner.userData.roomCeilingFor || owner.userData.bathroomCeilingFor);
      if (!roof) return;
      const geometry = mesh.geometry,
        position = geometry?.attributes.position,
        index = geometry?.index;
      if (!position) return;
      const start = geometry.drawRange.start,
        end = Math.min(index?.count ?? position.count, start + geometry.drawRange.count);
      let count = 0;
      for (let at = start; at + 2 < end; at += 3) {
        const v = [];
        for (let k = 0; k < 3; k++) {
          const i = index ? index.getX(at + k) : at + k;
          p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
          v.push([p.x, p.y, p.z]);
        }
        const [a, b, c] = v,
          bx = b[0] - a[0],
          bz = b[2] - a[2],
          cx = c[0] - a[0],
          cz = c[2] - a[2],
          determinant = bx * cz - bz * cx;
        if (!v.flat().every(Number.isFinite) || Math.abs(determinant) < 1e-9) continue;
        const dx = ((b[1] - a[1]) * cz - (c[1] - a[1]) * bz) / determinant;
        const dz = ((c[1] - a[1]) * bx - (b[1] - a[1]) * cx) / determinant;
        const id = triangles.length;
        triangles.push({ v, sign: Math.sign(determinant), dx, dz });
        count++;
        const x0 = Math.floor(Math.min(...v.map((p) => p[0])) / cellSize),
          x1 = Math.floor(Math.max(...v.map((p) => p[0])) / cellSize);
        const z0 = Math.floor(Math.min(...v.map((p) => p[2])) / cellSize),
          z1 = Math.floor(Math.max(...v.map((p) => p[2])) / cellSize);
        for (let x = x0; x <= x1; x++)
          for (let z = z0; z <= z1; z++) {
            const key = `${x},${z}`;
            if (!cells.has(key)) cells.set(key, []);
            cells.get(key).push(id);
          }
      }
      if (count) sources.push({ name: mesh.name, triangles: count });
    });
    seen = new Int32Array(triangles.length);
    built = true;
  }
  return {
    height(x, z, endX = x, endZ = z) {
      if (!built) build();
      if (++stamp >= 2147483647) {
        seen.fill(0);
        stamp = 1;
      }
      const dx = endX - x,
        dz = endZ - z;
      let height = -Infinity;
      for (let i = Math.floor(Math.min(x, endX) / cellSize); i <= Math.floor(Math.max(x, endX) / cellSize); i++)
        for (let j = Math.floor(Math.min(z, endZ) / cellSize); j <= Math.floor(Math.max(z, endZ) / cellSize); j++)
          for (const id of cells.get(`${i},${j}`) || []) {
            if (seen[id] === stamp) continue;
            seen[id] = stamp;
            const t = triangles[id];
            let enter = 0,
              leave = 1;
            for (let edge = 0; edge < 3; edge++) {
              const a = t.v[edge],
                b = t.v[(edge + 1) % 3],
                ex = b[0] - a[0],
                ez = b[2] - a[2];
              const offset = t.sign * (ex * (z - a[2]) - ez * (x - a[0])),
                slope = t.sign * (ex * dz - ez * dx);
              if (Math.abs(slope) < 1e-12) {
                if (offset < -1e-8) {
                  leave = -1;
                  break;
                }
              } else if (slope > 0) enter = Math.max(enter, (-1e-8 - offset) / slope);
              else leave = Math.min(leave, (-1e-8 - offset) / slope);
            }
            if (leave < enter) continue;
            const a = t.v[0],
              base = a[1] + t.dx * (x - a[0]) + t.dz * (z - a[2]),
              slope = t.dx * dx + t.dz * dz;
            height = Math.max(height, base + slope * enter, base + slope * leave);
          }
      return height;
    },
    evidence: () => ({
      method: "conservative swept XZ footprint over actual static roof triangles",
      built,
      cellSize,
      triangles: triangles.length,
      cells: cells.size,
      sources,
    }),
    dispose() {
      cells.clear();
      triangles = [];
      seen = new Int32Array();
      sources.length = 0;
      built = false;
    },
  };
}
