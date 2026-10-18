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
// `walls: false` skips the wall boxes once the voxel collision field (below) keeps the camera clear:
// the boxes predate it and know nothing of rooms added beyond them.
export function keepCameraClear(position, config, room, { walls = true } = {}) {
  const c = config?.cameraCollision;
  if (!c) return;
  const pad = c.clearance;
  if (room === "outside") {
    position.y = Math.max(position.y, cameraTerrainHeight(position.x, position.z, c) + pad);
    return;
  }
  // The glass front may be crossed (zooming into the kitchen or lounge walks in through the
  // doorway), but the camera never rests close enough for its near plane to slice a pane.
  const facade = c.facade;
  if (facade) {
    const offset = position.z - facade.planeZ;
    if (Math.abs(offset) < facade.clearance && position.x > facade.xRange[0] && position.x < facade.xRange[1] && position.y < facade.top)
      position.z = facade.planeZ + (offset < 0 ? -1 : 1) * facade.clearance;
  }
  // During room-to-room interpolation, project an intersecting near plane
  // toward the Pacific opening. Never let a wall become the camera's interior.
  if (!walls) return;
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

// ---------------------------------------------------------------------------------------------
// Camera navigation, October 15 (Sirui: "further improve the navigability", "allow bigger zoom out",
// "optimize weird camera angles that might make you see into the 3D model").
//
// A room orbit used to stop at a hand-set yaw arc, and inside that arc the camera could still end
// up behind the cedar slats, inside the cave-mouth rock or in the terrace olive tree. Wider arcs
// are only safe with a spring arm: the camera sits on the visible side of whatever lies between it
// and the orbit target. The arm reads an occupancy field voxelized at runtime from the meshes that
// are actually loaded, so a new room (or new furniture) is covered as soon as its model streams in.

export const ORBIT_DIRECTION = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];

// Where the field is built: every room target with a margin wide enough for its widest orbit, the
// terrace and doorway cameras in front of the glass, and the cave-mouth rock around them. Derived
// from the room list, so a room added to the manifest extends the field; cameraCollision.grid can
// still pin it explicitly.
export function collisionBounds(config) {
  const authored = config?.cameraCollision?.grid;
  if (authored?.min && authored?.max) return { min: [...authored.min], max: [...authored.max], cell: authored.cell || 0.12 };
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const room of config?.rooms || []) {
    const target = room.target || room.actor;
    if (!target) continue;
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], target[k]);
      max[k] = Math.max(max[k], target[k]);
    }
  }
  if (!Number.isFinite(min[0])) return null;
  const margin = { below: [4.2, 2.2, 6.8], above: [4.2, 5.4, 4.2] };
  return {
    min: min.map((v, k) => Math.floor((v - margin.below[k]) * 10) / 10),
    max: max.map((v, k) => Math.ceil((v + margin.above[k]) * 10) / 10),
    cell: 0.12,
  };
}

// How surfaces become obstacles. Every connected piece of a mesh is sorted by size first: a piece
// smaller than DETAIL_SIZE in every direction (a laptop, a cup, a book, a single leaf) is detail;
// anything larger or longer (a wall, a board, a slat, a rail) is structure. A structural voxel
// seeds a "sheet" when its 7-cell neighbourhood holds a plane's worth of structure (walls, floors,
// cabinets, beds, rock, a dense slat screen); sheets grow back over their own edges; the rest of
// the structure is thin (rails, posts, frames, mullions, chair legs, the rack's uprights) and never
// stops the camera, because a camera that dollies in front of every rail jumps instead of moving.
// Detail blocks only where it is dense in all three directions (a foliage canopy), so the laptop
// and books in front of a reader never box the camera into the reader's head. Blocking voxels
// then grow a clearance shell that keeps the near plane off their surfaces. Finally the air is
// flooded from known open points (room targets and their authored camera positions): whatever the
// flood cannot reach without crossing a blocking surface is the inside of a solid (the rock around
// the cave mouth, a wall's core), where a camera may never stand.
const SHEET_RADIUS = 3,
  SHEET_COUNT = 30,
  DENSE_DETAIL = 90,
  DETAIL_SIZE = 0.45,
  CLEARANCE_CELLS = 2;
export const BLOCKING = 1,
  CLEARANCE = 2,
  INSIDE = 4;
const RESTRICTED = BLOCKING | CLEARANCE | INSIDE;
// Surface bits: 1 structure, 2 explicit solid, 4 detail.
const STRUCTURE = 1,
  SOLID = 2,
  DETAIL = 4;

// Connected pieces of an indexed mesh (vertices shared by triangles), as a per-triangle flag:
// 1 where the triangle's piece fits inside a DETAIL_SIZE box. `world` holds xyz per vertex.
export function detailTriangles(world, indices, size = DETAIL_SIZE) {
  const count = world.length / 3,
    parent = new Int32Array(count);
  for (let i = 0; i < count; i++) parent[i] = i;
  const find = (v) => {
    while (parent[v] !== v) {
      parent[v] = parent[parent[v]];
      v = parent[v];
    }
    return v;
  };
  const triangles = indices.length / 3;
  for (let t = 0; t < triangles; t++) {
    const a = find(indices[t * 3]);
    for (let corner = 1; corner < 3; corner++) {
      const b = find(indices[t * 3 + corner]);
      if (a !== b) parent[b] = a;
    }
  }
  const bounds = new Float64Array(count * 6).fill(Infinity);
  for (let v = 0; v < count; v++) {
    const r = find(v) * 6;
    for (let k = 0; k < 3; k++) {
      bounds[r + k] = Math.min(bounds[r + k], world[v * 3 + k]);
      bounds[r + 3 + k] = Math.min(bounds[r + 3 + k], -world[v * 3 + k]);
    }
  }
  const small = new Uint8Array(triangles);
  for (let t = 0; t < triangles; t++) {
    const r = find(indices[t * 3]) * 6;
    small[t] = -bounds[r + 3] - bounds[r] < size && -bounds[r + 4] - bounds[r + 1] < size && -bounds[r + 5] - bounds[r + 2] < size ? 1 : 0;
  }
  return small;
}

export function createCollisionGrid({ min, max, cell = 0.12, seeds = [] }) {
  const nx = Math.max(1, Math.ceil((max[0] - min[0]) / cell)),
    ny = Math.max(1, Math.ceil((max[1] - min[1]) / cell)),
    nz = Math.max(1, Math.ceil((max[2] - min[2]) / cell));
  const size = nx * ny * nz,
    inv = 1 / cell,
    [ox, oy, oz] = min,
    ex = ox + nx * cell,
    ey = oy + ny * cell,
    ez = oz + nz * cell;
  // Surface bits per voxel (STRUCTURE, SOLID, DETAIL above).
  const surface = new Uint8Array(size);
  let flags = new Uint8Array(size),
    ready = false,
    triangles = 0,
    samples = 0,
    blockingCount = 0,
    insideCount = 0,
    dirty = false,
    bit = STRUCTURE;
  const index = (i, j, k) => i + nx * (j + ny * k);
  function mark(x, y, z) {
    const i = Math.floor((x - ox) * inv),
      j = Math.floor((y - oy) * inv),
      k = Math.floor((z - oz) * inv);
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return;
    surface[index(i, j, k)] |= bit;
    samples++;
  }
  const leaf = cell * 8;
  // Barycentric samples no farther apart than half a cell leave no gap a voxel-walking ray could
  // slip through; large triangles split first so only their parts inside the field are sampled.
  function triangle(ax, ay, az, bx, by, bz, cx, cy, cz, depth = 0) {
    if (
      Math.max(ax, bx, cx) < ox ||
      Math.min(ax, bx, cx) > ex ||
      Math.max(ay, by, cy) < oy ||
      Math.min(ay, by, cy) > ey ||
      Math.max(az, bz, cz) < oz ||
      Math.min(az, bz, cz) > ez
    )
      return;
    const ab = Math.hypot(bx - ax, by - ay, bz - az),
      ac = Math.hypot(cx - ax, cy - ay, cz - az),
      bc = Math.hypot(cx - bx, cy - by, cz - bz),
      longest = Math.max(ab, ac, bc);
    if (longest > leaf && depth < 12) {
      const mabx = (ax + bx) / 2,
        maby = (ay + by) / 2,
        mabz = (az + bz) / 2,
        macx = (ax + cx) / 2,
        macy = (ay + cy) / 2,
        macz = (az + cz) / 2,
        mbcx = (bx + cx) / 2,
        mbcy = (by + cy) / 2,
        mbcz = (bz + cz) / 2;
      triangle(ax, ay, az, mabx, maby, mabz, macx, macy, macz, depth + 1);
      triangle(mabx, maby, mabz, bx, by, bz, mbcx, mbcy, mbcz, depth + 1);
      triangle(macx, macy, macz, mbcx, mbcy, mbcz, cx, cy, cz, depth + 1);
      triangle(mabx, maby, mabz, mbcx, mbcy, mbcz, macx, macy, macz, depth + 1);
      return;
    }
    const n = Math.max(1, Math.ceil(longest * inv * 2));
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= n - i; j++) {
        const u = i / n,
          v = j / n,
          w = 1 - u - v;
        mark(ax * w + bx * u + cx * v, ay * w + by * u + cy * v, az * w + bz * u + cz * v);
      }
  }
  function addTriangle(ax, ay, az, bx, by, bz, cx, cy, cz, detail = false) {
    triangles++;
    dirty = true;
    bit = detail ? DETAIL : STRUCTURE;
    triangle(ax, ay, az, bx, by, bz, cx, cy, cz);
    bit = STRUCTURE;
  }
  // A whole indexed or soup geometry, prepared once: `position(i, out)` writes vertex i in object
  // space and `matrix` is a column-major 4x4 (three.js Matrix4.elements) to world space. Pieces are
  // sorted into structure and detail here.
  function prepareGeometry({ position, count, index: indices = null, matrix }) {
    const m = matrix,
      p = [0, 0, 0],
      world = new Float64Array(count * 3);
    for (let v = 0; v < count; v++) {
      position(v, p);
      world[v * 3] = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
      world[v * 3 + 1] = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
      world[v * 3 + 2] = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
    }
    const total = (indices ? indices.length : count) / 3;
    return { world, indices, total, detail: indices ? detailTriangles(world, indices) : null };
  }
  // `from`/`to` select a triangle range so a large mesh can be added in slices.
  function addPrepared({ world, indices, total, detail }, from = 0, to = Infinity) {
    const end = Math.min(total, to);
    for (let t = from; t < end; t++) {
      const a = (indices ? indices[t * 3] : t * 3) * 3,
        b = (indices ? indices[t * 3 + 1] : t * 3 + 1) * 3,
        c = (indices ? indices[t * 3 + 2] : t * 3 + 2) * 3;
      addTriangle(
        world[a],
        world[a + 1],
        world[a + 2],
        world[b],
        world[b + 1],
        world[b + 2],
        world[c],
        world[c + 1],
        world[c + 2],
        detail?.[t] === 1
      );
    }
    return end;
  }
  function addGeometry(geometry, from = 0, to = Infinity) {
    return addPrepared(prepareGeometry(geometry), from, to);
  }
  // Solid volumes (the onsen steam) the camera stays outside of, whatever their surface says.
  function addSolid(lo, hi) {
    dirty = true;
    const i0 = clamp(Math.floor((lo[0] - ox) * inv), 0, nx - 1),
      i1 = clamp(Math.floor((hi[0] - ox) * inv), 0, nx - 1),
      j0 = clamp(Math.floor((lo[1] - oy) * inv), 0, ny - 1),
      j1 = clamp(Math.floor((hi[1] - oy) * inv), 0, ny - 1),
      k0 = clamp(Math.floor((lo[2] - oz) * inv), 0, nz - 1),
      k1 = clamp(Math.floor((hi[2] - oz) * inv), 0, nz - 1);
    if (hi[0] < ox || lo[0] > ex || hi[1] < oy || lo[1] > ey || hi[2] < oz || lo[2] > ez) return;
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) surface[index(i, j, k)] |= SOLID;
  }

  // Sliding-window sums along one axis. `threshold` 0 keeps the sum; otherwise the result is 1
  // where the sum reaches the threshold (1 makes a binary dilation).
  // The y and z passes slide whole rows and planes at once (a running-sum row or plane), which
  // keeps memory access sequential; x slides along each row.
  const rowSums = new Int32Array(nx),
    planeSums = new Int32Array(nx * ny);
  function axisPass(src, dst, axis, radius, threshold = 0) {
    if (axis === 0) {
      const head = Math.min(radius, nx - 1);
      for (let line = 0, rows = ny * nz; line < rows; line++) {
        const start = line * nx;
        let sum = 0;
        for (let t = 0; t <= head; t++) sum += src[start + t];
        for (let t = 0; t < nx; t++) {
          dst[start + t] = threshold === 0 ? sum : sum >= threshold ? 1 : 0;
          if (t + radius + 1 < nx) sum += src[start + t + radius + 1];
          if (t >= radius) sum -= src[start + t - radius];
        }
      }
      return;
    }
    const span = axis === 1 ? nx : nx * ny,
      length = axis === 1 ? ny : nz,
      blocks = axis === 1 ? nz : 1,
      sums = axis === 1 ? rowSums : planeSums,
      head = Math.min(radius, length - 1),
      layer = axis === 1 ? nx : nx * ny;
    for (let block = 0; block < blocks; block++) {
      const base = block * nx * ny;
      sums.fill(0);
      for (let t = 0; t <= head; t++) {
        const offset = base + t * layer;
        for (let p = 0; p < span; p++) sums[p] += src[offset + p];
      }
      for (let t = 0; t < length; t++) {
        const offset = base + t * layer;
        if (threshold === 0) for (let p = 0; p < span; p++) dst[offset + p] = sums[p];
        else for (let p = 0; p < span; p++) dst[offset + p] = sums[p] >= threshold ? 1 : 0;
        if (t + radius + 1 < length) {
          const enter = base + (t + radius + 1) * layer;
          for (let p = 0; p < span; p++) sums[p] += src[enter + p];
        }
        if (t >= radius) {
          const leave = base + (t - radius) * layer;
          for (let p = 0; p < span; p++) sums[p] -= src[leave + p];
        }
      }
    }
  }
  // The classification, as a generator so the browser can spread it over idle slices.
  function* classify() {
    // Triangles added while this runs mark the field dirty again for another pass.
    dirty = false;
    const a = new Uint8Array(size),
      b = new Uint8Array(size),
      c = new Uint8Array(size);
    // Dense detail (a canopy): c.
    for (let i = 0; i < size; i++) a[i] = surface[i] & DETAIL ? 1 : 0;
    axisPass(a, b, 0, SHEET_RADIUS);
    yield;
    axisPass(b, a, 1, SHEET_RADIUS);
    yield;
    axisPass(a, c, 2, SHEET_RADIUS, DENSE_DETAIL);
    yield;
    // Structural sheets: b.
    for (let i = 0; i < size; i++) a[i] = surface[i] & STRUCTURE;
    axisPass(a, b, 0, SHEET_RADIUS);
    yield;
    axisPass(b, a, 1, SHEET_RADIUS);
    yield;
    axisPass(a, b, 2, SHEET_RADIUS, SHEET_COUNT);
    yield;
    for (let i = 0; i < size; i++) if (surface[i] & SOLID) b[i] = 1;
    // Grow the sheet seeds back over their own structural edges (a wall's end, the slab's front lip).
    axisPass(b, a, 0, SHEET_RADIUS, 1);
    yield;
    axisPass(a, b, 1, SHEET_RADIUS, 1);
    yield;
    axisPass(b, a, 2, SHEET_RADIUS, 1);
    yield;
    let blocking = 0;
    for (let i = 0; i < size; i++) {
      const s = surface[i];
      a[i] = s & SOLID || (s & STRUCTURE && a[i]) || (s & DETAIL && c[i]) ? 1 : 0;
      blocking += a[i];
    }
    axisPass(a, b, 0, CLEARANCE_CELLS, 1);
    yield;
    axisPass(b, c, 1, CLEARANCE_CELLS, 1);
    yield;
    axisPass(c, b, 2, CLEARANCE_CELLS, 1);
    yield;
    // Air: c marks every voxel the seeds reach without crossing a blocking one.
    const reached = flood(a, c);
    for (let i = 0; i < size; i++) c[i] = a[i] ? BLOCKING : (b[i] ? CLEARANCE : 0) | (reached && !c[i] ? INSIDE : 0);
    flags = c;
    blockingCount = blocking;
    insideCount = 0;
    if (reached) for (let i = 0; i < size; i++) insideCount += c[i] & INSIDE ? 1 : 0;
    ready = true;
  }
  // Breadth-first from the seed points through non-blocking voxels (6-connected), writing 1 into
  // `air`. A ring buffer holds the frontier; if it ever overflowed the field would treat
  // everything unblocked as air, which is merely the field without this refinement.
  function flood(blocking, air) {
    air.fill(0);
    const capacity = 1 << 20,
      queue = new Int32Array(capacity);
    let head = 0,
      tail = 0,
      count = 0;
    for (const [x, y, z] of seeds) {
      const at = cellOf(x, y, z);
      if (at < 0 || blocking[at] || air[at]) continue;
      air[at] = 1;
      queue[tail] = at;
      tail = (tail + 1) & (capacity - 1);
      count++;
    }
    if (!count) return false;
    const layer = nx * ny;
    let overflow = false;
    const visit = (next) => {
      if (air[next] || blocking[next]) return;
      if (count === capacity) {
        overflow = true;
        return;
      }
      air[next] = 1;
      queue[tail] = next;
      tail = (tail + 1) & (capacity - 1);
      count++;
    };
    while (count && !overflow) {
      const at = queue[head];
      head = (head + 1) & (capacity - 1);
      count--;
      const i = at % nx,
        j = ((at - i) / nx) % ny,
        k = (at - i - j * nx) / layer;
      if (i > 0) visit(at - 1);
      if (i < nx - 1) visit(at + 1);
      if (j > 0) visit(at - nx);
      if (j < ny - 1) visit(at + nx);
      if (k > 0) visit(at - layer);
      if (k < nz - 1) visit(at + layer);
    }
    return !overflow;
  }
  function finish() {
    for (const _ of classify());
  }
  const cellOf = (x, y, z) => {
    const i = Math.floor((x - ox) * inv),
      j = Math.floor((y - oy) * inv),
      k = Math.floor((z - oz) * inv);
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return -1;
    return index(i, j, k);
  };
  // How far along the unit direction from `origin` (up to maxDistance) a camera may stand: the
  // path may pass close to surfaces but never through a blocking voxel, and the camera itself
  // must rest in a free voxel, outside every clearance shell and solid interior. A start inside a
  // solid (a target passing through a screen or a wall while the view changes rooms) walks out of
  // it first. Returns { distance, blocked, exit }: `exit` is where the ray left the field, so the
  // caller can follow it over the terrain beyond. A `mask` without CLEARANCE ignores the clearance
  // shells: the hard limit a smoothed camera may never pass.
  function march(origin, direction, maxDistance, mask = RESTRICTED) {
    const open = { distance: maxDistance, blocked: false, exit: 0 };
    if (!ready) return open;
    const [px, py, pz] = origin,
      [dx, dy, dz] = direction;
    let t0 = 0,
      t1 = maxDistance;
    for (const [p, d, lo, hi] of [
      [px, dx, ox, ex],
      [py, dy, oy, ey],
      [pz, dz, oz, ez],
    ]) {
      if (Math.abs(d) < 1e-12) {
        if (p < lo || p > hi) return open;
        continue;
      }
      let ta = (lo - p) / d,
        tb = (hi - p) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
    }
    if (t0 > t1) return open;
    const sx = px + dx * (t0 + 1e-9),
      sy = py + dy * (t0 + 1e-9),
      sz = pz + dz * (t0 + 1e-9);
    let i = clamp(Math.floor((sx - ox) * inv), 0, nx - 1),
      j = clamp(Math.floor((sy - oy) * inv), 0, ny - 1),
      k = clamp(Math.floor((sz - oz) * inv), 0, nz - 1);
    const stepX = dx > 0 ? 1 : -1,
      stepY = dy > 0 ? 1 : -1,
      stepZ = dz > 0 ? 1 : -1;
    const next = (p, d, n, o) => (Math.abs(d) < 1e-12 ? Infinity : (o + (n + (d > 0 ? 1 : 0)) * cell - p) / d);
    let tMaxX = next(px, dx, i, ox),
      tMaxY = next(py, dy, j, oy),
      tMaxZ = next(pz, dz, k, oz);
    const tDeltaX = Math.abs(dx) < 1e-12 ? Infinity : cell / Math.abs(dx),
      tDeltaY = Math.abs(dy) < 1e-12 ? Infinity : cell / Math.abs(dy),
      tDeltaZ = Math.abs(dz) < 1e-12 ? Infinity : cell / Math.abs(dz);
    // Outside the field before it enters, a camera is the terrain's business, not the field's.
    let lastFree = t0;
    let escaping = t0 === 0 && Boolean(flags[index(i, j, k)] & mask & (BLOCKING | INSIDE));
    let t = t0;
    for (let guard = nx + ny + nz + 3; guard > 0; guard--) {
      const value = flags[index(i, j, k)] & mask,
        leave = Math.min(tMaxX, tMaxY, tMaxZ);
      if (escaping && !(value & (BLOCKING | INSIDE))) escaping = false;
      if (!escaping) {
        if (value & BLOCKING) return { distance: lastFree, blocked: true, exit: t };
        if (!value) lastFree = Math.min(leave, maxDistance);
        if (leave >= maxDistance)
          return value ? { distance: lastFree, blocked: true, exit: maxDistance } : { distance: maxDistance, blocked: false, exit: maxDistance };
      } else if (leave >= maxDistance) return { distance: lastFree, blocked: true, exit: maxDistance };
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        i += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
        if (i < 0 || i >= nx) break;
      } else if (tMaxY < tMaxZ) {
        j += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        if (j < 0 || j >= ny) break;
      } else {
        k += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        if (k < 0 || k >= nz) break;
      }
    }
    // The ray left the field: free so far, terrain from here on.
    return { distance: maxDistance, blocked: false, exit: t };
  }
  // A field classified elsewhere (the worker in camera-field-worker.mjs) replaces this one's.
  function setFlags(next, stats = {}) {
    if (!(next instanceof Uint8Array) || next.length !== size) return false;
    flags = next;
    blockingCount = stats.blocking ?? blockingCount;
    insideCount = stats.inside ?? insideCount;
    triangles = stats.triangles ?? triangles;
    samples = stats.samples ?? samples;
    ready = true;
    return true;
  }
  return {
    bounds: { min: [ox, oy, oz], max: [ex, ey, ez] },
    cell,
    size: [nx, ny, nz],
    addTriangle,
    addGeometry,
    prepareGeometry,
    addPrepared,
    addSolid,
    classify,
    finish,
    setFlags,
    flags: () => flags,
    march,
    flagAt: (x, y, z) => {
      const at = cellOf(x, y, z);
      return at < 0 ? -1 : flags[at];
    },
    contains: (x, y, z) => x >= ox && x <= ex && y >= oy && y <= ey && z >= oz && z <= ez,
    get ready() {
      return ready;
    },
    get dirty() {
      return dirty;
    },
    evidence: () => ({ ready, cell, size: [nx, ny, nz], triangles, samples, blocking: blockingCount, inside: insideCount, seeds: seeds.length }),
  };
}

// How far the camera may stand from `target` along a direction: the first blocking voxel (or
// its clearance shell) inside the field, then the mainland height grid outside it. Rays that
// leave the field above the cut-away roof continue over the real cliff, so the whole-house view
// can lean over the mainland but never into it. `footprint` ({ min: [x, z], max: [x, z] }) is
// where the cut-away roof leaves open air: there the height grid (which includes the roof) does
// not apply.
export function clearDistance(
  grid,
  collision,
  target,
  direction,
  maxDistance,
  { mask = RESTRICTED, back = 0.02, pad = null, footprint = null } = {}
) {
  let from = 0;
  if (grid?.ready) {
    const hit = grid.march(target, direction, maxDistance, mask);
    if (hit.blocked) return Math.max(0, hit.distance - back);
    from = hit.exit;
  }
  if (!collision) return maxDistance;
  pad ??= collision.clearance ?? 0.32;
  const step = 0.4;
  let previous = from;
  for (let t = from + step; t <= maxDistance + step - 1e-9; t += step) {
    const reach = Math.min(t, maxDistance),
      x = target[0] + direction[0] * reach,
      y = target[1] + direction[1] * reach,
      z = target[2] + direction[2] * reach;
    const open =
      (grid?.ready && grid.contains(x, y, z)) ||
      (footprint && x > footprint.min[0] && x < footprint.max[0] && z > footprint.min[1] && z < footprint.max[1]);
    if (!open && y < cameraTerrainHeight(x, z, collision) + pad) return Math.max(0, previous - back);
    previous = reach;
  }
  return maxDistance;
}

// The whole-house view looks across the house's own partitions (its target sits behind the gym's
// back panel), so it needs a clear path only over the cliff and headlands outside the cut-away
// footprint, and somewhere in open air to stand: the farthest point along the ray, up to that
// path, that is a free voxel of the field (or above the mainland outside it). Inside the
// footprint the roof is gone, so only the field speaks there.
export function houseDistance(grid, collision, target, direction, maxDistance, options = {}) {
  return standDistance(grid, collision, target, direction, clearDistance(null, collision, target, direction, maxDistance, options), options);
}
export function standDistance(
  grid,
  collision,
  target,
  direction,
  maxDistance,
  { mask = RESTRICTED, back = 0.02, pad = null, footprint = null } = {}
) {
  pad ??= collision?.clearance ?? 0.32;
  const step = grid?.cell ? grid.cell / 2 : 0.1;
  for (let t = maxDistance; t > 0; t -= step) {
    const x = target[0] + direction[0] * t,
      y = target[1] + direction[1] * t,
      z = target[2] + direction[2] * t;
    let open;
    if (grid?.ready && grid.contains(x, y, z)) open = !(grid.flagAt(x, y, z) & mask);
    else if (footprint && x > footprint.min[0] && x < footprint.max[0] && z > footprint.min[1] && z < footprint.max[1]) open = true;
    else open = !collision || y >= cameraTerrainHeight(x, z, collision) + pad;
    if (open) return t === maxDistance ? t : Math.max(0, t - back);
  }
  return 0;
}

// The spring arm. Eight rays on a narrow cone around the orbit ray let an obstacle edge pull the
// camera in before the orbit ray reaches it (each side ray's hit counts `slope` metres per radian
// farther away), so sliding past a wall end or a screen mostly dollies instead of jumping; the
// controller smooths what remains and never lets the camera pass `hardArm`. `stand` measures with
// standDistance instead of the visible path (the whole-house view).
const CONE_RAYS = 8;
export function cameraArm(grid, collision, target, yaw, pitch, radius, { cone = 0.12, slope = 11, footprint = null, stand = false } = {}) {
  if (!grid?.ready && !collision) return radius;
  const measure = stand ? houseDistance : clearDistance;
  const d = ORBIT_DIRECTION(yaw, pitch);
  let arm = measure(grid, collision, target, d, radius, { footprint });
  const u = [Math.cos(yaw), 0, -Math.sin(yaw)],
    v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]],
    cosA = Math.cos(cone),
    sinA = Math.sin(cone),
    penalty = slope * cone;
  for (let n = 0; n < CONE_RAYS; n++) {
    const phi = (n / CONE_RAYS) * Math.PI * 2,
      c = Math.cos(phi) * sinA,
      s = Math.sin(phi) * sinA;
    const side = [d[0] * cosA + u[0] * c + v[0] * s, d[1] * cosA + u[1] * c + v[1] * s, d[2] * cosA + u[2] * c + v[2] * s];
    const reach = radius - penalty;
    if (reach <= 0) continue;
    const clear = measure(grid, collision, target, side, reach, { footprint });
    // Beside the target a side ray only grazes what the orbit ray itself passed (a target beside
    // the rack or the desk), so hits within 1.5 m count progressively less; the orbit ray's own
    // verdict stands there. The discount is continuous, so it adds no jump of its own.
    arm = Math.min(arm, clear + penalty + Math.max(0, 1.5 - clear) * 4);
  }
  return Math.max(0, Math.min(radius, arm));
}
// The limit a smoothed arm may never pass: the orbit ray against blocking surfaces themselves,
// stopping 0.1 m short (twice the near plane), and 0.1 m over the mainland outside the field.
export function hardArm(grid, collision, target, yaw, pitch, radius, footprint = null, stand = false) {
  if (!grid?.ready && !collision) return radius;
  const measure = stand ? houseDistance : clearDistance;
  return Math.min(
    radius,
    measure(grid, collision, target, ORBIT_DIRECTION(yaw, pitch), radius, { mask: BLOCKING | INSIDE, back: 0.1, pad: 0.1, footprint })
  );
}
// Where the lifted roof leaves open air above the house: the x/z extent of the meshes tagged as
// the cutaway (caveRoof). The mainland height grid includes that roof, so inside this footprint
// the grid does not limit an interior or whole-house camera.
export function cutawayFootprint(boxes) {
  if (!boxes?.length) return null;
  const min = [Infinity, Infinity],
    max = [-Infinity, -Infinity];
  for (const box of boxes) {
    min[0] = Math.min(min[0], box.min[0]);
    min[1] = Math.min(min[1], box.min[2]);
    max[0] = Math.max(max[0], box.max[0]);
    max[1] = Math.max(max[1], box.max[2]);
  }
  return Number.isFinite(min[0]) ? { min, max } : null;
}

// Input steering: an orbit change that would press the camera closer than `minArm` to its target
// slides along the obstacle (yaw alone, then pitch alone) or stops short of it. A change that
// improves an already cramped view is always allowed, so nothing can trap the camera.
export function steerOrbit(armAt, from, to, minArm) {
  const fromArm = armAt(from.yaw, from.pitch);
  const allowed = (yaw, pitch) => {
    const arm = armAt(yaw, pitch);
    return arm >= minArm || arm >= fromArm - 0.001;
  };
  if (allowed(to.yaw, to.pitch)) return { yaw: to.yaw, pitch: to.pitch, blocked: false };
  if (to.yaw !== from.yaw && allowed(to.yaw, from.pitch)) return { yaw: to.yaw, pitch: from.pitch, blocked: true };
  if (to.pitch !== from.pitch && allowed(from.yaw, to.pitch)) return { yaw: from.yaw, pitch: to.pitch, blocked: true };
  // Approach the obstacle as far as it allows.
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 5; i++) {
    const mid = (lo + hi) / 2;
    if (allowed(from.yaw + (to.yaw - from.yaw) * mid, from.pitch + (to.pitch - from.pitch) * mid)) lo = mid;
    else hi = mid;
  }
  return { yaw: from.yaw + (to.yaw - from.yaw) * lo, pitch: from.pitch + (to.pitch - from.pitch) * lo, blocked: true };
}

// A cushioned envelope edge: input slows over the last `margin` radians before a limit instead of
// stopping dead, and never pushes past it.
export function cushion(value, delta, range, margin = 0.14) {
  if (!range || !delta) return value + delta;
  const [lo, hi] = range,
    room = delta > 0 ? hi - value : value - lo;
  if (room <= 0) return delta > 0 ? Math.min(value, hi) : Math.max(value, lo);
  const scale = clamp(room / margin, 0.18, 1);
  const next = value + delta * scale;
  return clamp(next, Math.min(lo, value), Math.max(hi, value));
}

// The far view (Sirui: "allow bigger zoom out"). Haze and both clip planes follow the orbit
// radius. Up to the authored 48 m coast view nothing changes (fog 65-180 m, planes 0.05-300 m);
// beyond it the haze starts just past the house and thickens over the distant land and sea, so
// the 400 m sea plane's edge is fully hazed before it can show against the sky, and the near plane
// moves out to keep depth precision at 160 m, under half the camera's ground clearance.
export function farView(radius, clearance = Infinity) {
  const r = Math.max(0, radius);
  const fogNear = Math.max(65, r + 15),
    fogFar = Math.max(180, 1.9 * r + 26);
  const far = Math.max(300, fogFar + 100);
  const near = r <= 48 ? 0.05 : clamp(Math.min(0.05 + (r - 48) * 0.005, clearance * 0.45), 0.05, 0.6);
  return { fogNear, fogFar, far, near };
}

// Outside, the camera rides over the terrain with a ground clearance that grows with distance, so
// a far view never skims the clifftop (the controller also raises its look point by most of the
// lift, so a camera lifted over the cliff keeps looking along its orbit instead of down into the
// sandstone that hides the terrace).
export function outsideClearance(radius, base = 0.32) {
  return Math.max(base, Math.min(6, radius * 0.06));
}
