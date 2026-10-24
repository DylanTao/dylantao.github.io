// What a walking visitor stands on and what stops them (walk-controls.mjs), derived at runtime from the
// meshes that are actually loaded, so a sunken pit, a new entrance stair or a moved sofa flows through
// without hand-placed colliders or room coordinates.
//
// The field is a 2.5D column map. The floor plan is cut into columns (10 cm, coarser only for a very
// large house), and each column keeps the vertical intervals its surfaces occupy, merged across
// hairline gaps, at most `layers` per column (an overflowing column merges its closest pair, which
// only ever adds obstruction). Triangles are rasterized by sampling them no more than half a column
// apart, so a wall becomes one tall interval per column, a floor a thin one at its exact height, a
// stair a staircase of them and a suspended fireplace an interval in mid-air. Water (the onsen, a
// swimming pool) is extruded upward into a block: a visitor walks around it, never on or into it.
//
// The map records surfaces, not interiors: a closed solid's core looks like a floor under a ceiling,
// but its faces block every way in, and spawning only searches near a room's own floor.
//
// A vertical capsule (BODY) may occupy a column when the highest surface top within a step of its
// feet has head room above it and is no more than `maxDrop` below the feet. The last rule is the fall
// guard: a cliff edge, an open gallery side and a drop at the terrace read as walls, so a visitor
// can never walk off the property or into a hole they could not climb out of. Moving resolves the
// capsule against blocked columns by pushing it out of the deepest one, repeatedly, in sub-steps
// short enough that nothing a column thick can be tunnelled through, then follows the floor under
// its centre (steps, a sunken pit's edge, stairs).

export const WALK_CELL = 0.1;
const LAYERS = 10,
  MERGE = 0.03,
  // Columns in the largest field; a bigger house gets coarser columns rather than more memory.
  MAX_COLUMNS = 220_000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The walker's body: 1.75 m tall in a 0.24 m capsule. Steps up to 0.46 m climb (a stair riser here is
// 0.17 m, a sunken pit's or nook's edge about 0.40-0.45 m); a drop deeper than 0.5 m stops them.
export const BODY = Object.freeze({ radius: 0.24, height: 1.75, maxStep: 0.46, maxDrop: 0.5 });
// How far water is raised into a block: above any head.
export const WATER_BLOCK = 2.2;

export function createWalkField({ min, max, cell = WALK_CELL, layers = LAYERS, merge = MERGE }) {
  const [ox, oy, oz] = min;
  // A field larger than MAX_COLUMNS columns coarsens its cells.
  const area = Math.max(0, (max[0] - ox) * (max[2] - oz));
  cell = Math.max(cell, Math.sqrt(area / MAX_COLUMNS));
  const nx = Math.max(1, Math.ceil((max[0] - ox) / cell)),
    nz = Math.max(1, Math.ceil((max[2] - oz) / cell)),
    ymin = oy,
    ymax = max[1],
    inv = 1 / cell,
    columns = nx * nz;
  let lo = new Float32Array(columns * layers),
    hi = new Float32Array(columns * layers),
    count = new Uint8Array(columns);
  // Per-triangle scratch: each column the triangle touches and the y range it covers there.
  const stamp = new Int32Array(columns).fill(-1),
    tmin = new Float32Array(columns),
    tmax = new Float32Array(columns),
    touched = new Int32Array(columns);
  let touchedCount = 0,
    triangleId = 0,
    triangles = 0,
    samples = 0,
    overflows = 0,
    meshes = 0;
  const ex = ox + nx * cell,
    ez = oz + nz * cell;

  // Adds [a, b] to column c, keeping its intervals sorted, disjoint and at most `layers` long.
  function insert(c, a, b) {
    const base = c * layers;
    let n = count[c];
    let first = -1,
      last = -1;
    for (let j = 0; j < n; j++) {
      if (lo[base + j] > b + merge) break;
      if (hi[base + j] >= a - merge) {
        if (first < 0) first = j;
        last = j;
      }
    }
    if (first >= 0) {
      lo[base + first] = Math.min(a, lo[base + first]);
      hi[base + first] = Math.max(b, hi[base + last]);
      const removed = last - first;
      if (removed) {
        for (let j = last + 1; j < n; j++) {
          lo[base + j - removed] = lo[base + j];
          hi[base + j - removed] = hi[base + j];
        }
        count[c] = n - removed;
      }
      return;
    }
    let at = 0;
    while (at < n && lo[base + at] < a) at++;
    if (n === layers) {
      overflows++;
      let best = Infinity,
        merged = -1;
      for (let j = 0; j + 1 < n; j++) {
        const gap = lo[base + j + 1] - hi[base + j];
        if (gap < best) {
          best = gap;
          merged = j;
        }
      }
      const gapBefore = at > 0 ? a - hi[base + at - 1] : Infinity,
        gapAfter = at < n ? lo[base + at] - b : Infinity;
      if (Math.min(gapBefore, gapAfter) <= best) {
        // The new interval joins its nearer neighbour.
        if (gapBefore <= gapAfter) hi[base + at - 1] = Math.max(hi[base + at - 1], b);
        else lo[base + at] = Math.min(lo[base + at], a);
        return;
      }
      hi[base + merged] = hi[base + merged + 1];
      for (let j = merged + 1; j + 1 < n; j++) {
        lo[base + j] = lo[base + j + 1];
        hi[base + j] = hi[base + j + 1];
      }
      n--;
      if (at > merged) at--;
    }
    for (let j = n; j > at; j--) {
      lo[base + j] = lo[base + j - 1];
      hi[base + j] = hi[base + j - 1];
    }
    lo[base + at] = a;
    hi[base + at] = b;
    count[c] = n + 1;
  }

  function sample(x, y, z) {
    const i = Math.floor((x - ox) * inv),
      k = Math.floor((z - oz) * inv);
    if (i < 0 || k < 0 || i >= nx || k >= nz) return;
    const height = clamp(y, ymin, ymax),
      c = i + nx * k;
    samples++;
    if (stamp[c] !== triangleId) {
      stamp[c] = triangleId;
      tmin[c] = tmax[c] = height;
      touched[touchedCount++] = c;
    } else if (height < tmin[c]) tmin[c] = height;
    else if (height > tmax[c]) tmax[c] = height;
  }

  // Big triangles split first, so only their parts inside the field are sampled; each part is then
  // swept in rows parallel to its longest edge, no more than half a column apart in either
  // direction, which costs about its area in samples (a long sliver takes one row, not a grid).
  const leaf = cell * 20,
    spacing = cell / 2;
  function sweep(ax, ay, az, bx, by, bz, cx, cy, cz) {
    const ab = Math.hypot(bx - ax, by - ay, bz - az),
      bc = Math.hypot(cx - bx, cy - by, cz - bz),
      ca = Math.hypot(ax - cx, ay - cy, az - cz);
    // Rotate the corners so that A-B is the longest edge.
    if (bc > ab && bc >= ca) [ax, ay, az, bx, by, bz, cx, cy, cz] = [bx, by, bz, cx, cy, cz, ax, ay, az];
    else if (ca > ab && ca > bc) [ax, ay, az, bx, by, bz, cx, cy, cz] = [cx, cy, cz, ax, ay, az, bx, by, bz];
    const ux = bx - ax,
      uy = by - ay,
      uz = bz - az,
      vx = cx - ax,
      vy = cy - ay,
      vz = cz - az,
      base = Math.hypot(ux, uy, uz);
    const crossX = uy * vz - uz * vy,
      crossY = uz * vx - ux * vz,
      crossZ = ux * vy - uy * vx,
      height = base > 1e-9 ? Math.hypot(crossX, crossY, crossZ) / base : Math.hypot(vx, vy, vz);
    const rows = Math.max(1, Math.ceil(height / spacing));
    for (let r = 0; r <= rows; r++) {
      const t = r / rows,
        px = ax + vx * t,
        py = ay + vy * t,
        pz = az + vz * t,
        qx = bx + (cx - bx) * t,
        qy = by + (cy - by) * t,
        qz = bz + (cz - bz) * t,
        n = Math.max(1, Math.ceil((base * (1 - t)) / spacing));
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        sample(px + (qx - px) * k, py + (qy - py) * k, pz + (qz - pz) * k);
      }
    }
  }
  function triangle(ax, ay, az, bx, by, bz, cx, cy, cz, depth) {
    if (
      Math.max(ax, bx, cx) < ox ||
      Math.min(ax, bx, cx) > ex ||
      Math.max(az, bz, cz) < oz ||
      Math.min(az, bz, cz) > ez ||
      Math.max(ay, by, cy) < ymin ||
      Math.min(ay, by, cy) > ymax
    )
      return;
    const ab = Math.hypot(bx - ax, bz - az, by - ay),
      ac = Math.hypot(cx - ax, cz - az, cy - ay),
      bc = Math.hypot(cx - bx, cz - bz, cy - by),
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
    sweep(ax, ay, az, bx, by, bz, cx, cy, cz);
  }

  // One world-space triangle; `extrude` raises every column it covers by that much (water).
  function addTriangle(ax, ay, az, bx, by, bz, cx, cy, cz, extrude = 0) {
    triangleId++;
    triangles++;
    touchedCount = 0;
    triangle(ax, ay, az, bx, by, bz, cx, cy, cz, 0);
    for (let t = 0; t < touchedCount; t++) {
      const c = touched[t];
      insert(c, tmin[c], Math.min(ymax, tmax[c] + extrude));
    }
    touchedCount = 0;
  }

  // An object-space mesh: `positions` xyz per vertex, an optional index, its column-major world matrix
  // (three.js Matrix4.elements) and an optional upward extrusion.
  function addGeometry({ positions, index = null, matrix, extrude = 0 }) {
    const m = matrix,
      vertices = positions.length / 3,
      world = new Float64Array(vertices * 3);
    for (let v = 0; v < vertices; v++) {
      const x = positions[v * 3],
        y = positions[v * 3 + 1],
        z = positions[v * 3 + 2];
      world[v * 3] = m[0] * x + m[4] * y + m[8] * z + m[12];
      world[v * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      world[v * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    }
    const total = (index ? index.length : vertices) / 3;
    for (let t = 0; t < total; t++) {
      const a = (index ? index[t * 3] : t * 3) * 3,
        b = (index ? index[t * 3 + 1] : t * 3 + 1) * 3,
        c = (index ? index[t * 3 + 2] : t * 3 + 2) * 3;
      addTriangle(world[a], world[a + 1], world[a + 2], world[b], world[b + 1], world[b + 2], world[c], world[c + 1], world[c + 2], extrude);
    }
    meshes++;
  }

  const columnOf = (x, z) => {
    const i = Math.floor((x - ox) * inv),
      k = Math.floor((z - oz) * inv);
    return i < 0 || k < 0 || i >= nx || k >= nz ? -1 : i + nx * k;
  };

  // Where feet at `foot` would stand in column c: the highest surface top within a step, if it has
  // head room and lies no deeper than the fall guard allows; NaN when the column is blocked.
  function standIn(c, foot, body) {
    if (c < 0) return NaN;
    const base = c * layers,
      n = count[c],
      reach = foot + body.maxStep;
    let top = -Infinity,
      next = Infinity;
    for (let j = 0; j < n; j++) {
      if (hi[base + j] <= reach) top = hi[base + j];
      else {
        next = lo[base + j];
        break;
      }
    }
    if (top === -Infinity || top < foot - body.maxDrop) return NaN;
    // Anything between the step and the head blocks: a table top, a wall, a stair's underside.
    if (next < top + body.height) return NaN;
    return top;
  }
  const standAt = (x, z, foot, body = BODY) => standIn(columnOf(x, z), foot, body);

  // The highest surface top at or below `fromY` with head room above it (spawning onto a floor).
  function floorBelow(x, z, fromY, body = BODY) {
    const c = columnOf(x, z);
    if (c < 0) return NaN;
    const base = c * layers,
      n = count[c];
    for (let j = n - 1; j >= 0; j--) {
      const top = hi[base + j];
      if (top > fromY) continue;
      const next = j + 1 < n ? lo[base + j + 1] : Infinity;
      if (next >= top + body.height) return top;
    }
    return NaN;
  }

  // Pushes a capsule at (x, z) out of every blocked column and dynamic obstacle, deepest first.
  function resolve(x, z, foot, body, dynamic, iterations = 6) {
    const r = body.radius;
    for (let iteration = 0; iteration < iterations; iteration++) {
      let deepest = 1e-7,
        px = 0,
        pz = 0;
      const i0 = Math.floor((x - r - ox) * inv),
        i1 = Math.floor((x + r - ox) * inv),
        k0 = Math.floor((z - r - oz) * inv),
        k1 = Math.floor((z + r - oz) * inv);
      for (let k = k0; k <= k1; k++)
        for (let i = i0; i <= i1; i++) {
          const inside = i >= 0 && k >= 0 && i < nx && k < nz;
          if (inside && !Number.isNaN(standIn(i + nx * k, foot, body))) continue;
          const x0 = ox + i * cell,
            z0 = oz + k * cell,
            qx = clamp(x, x0, x0 + cell),
            qz = clamp(z, z0, z0 + cell),
            dx = x - qx,
            dz = z - qz,
            d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          let normalX, normalZ, depth;
          if (d2 > 1e-12) {
            const d = Math.sqrt(d2);
            normalX = dx / d;
            normalZ = dz / d;
            depth = r - d;
          } else {
            // The centre is inside the column: leave by its nearest side.
            const exits = [x - x0, x0 + cell - x, z - z0, z0 + cell - z],
              side = exits.indexOf(Math.min(...exits));
            normalX = side === 0 ? -1 : side === 1 ? 1 : 0;
            normalZ = side === 2 ? -1 : side === 3 ? 1 : 0;
            depth = r + exits[side];
          }
          if (depth > deepest) {
            deepest = depth;
            px = normalX * depth;
            pz = normalZ * depth;
          }
        }
      // Moving obstacles: a circle { x, z, radius } (Sirui) or a box footprint { min, max } (a
      // closed sliding door), each optionally limited to a height band { bottom, top }.
      for (const o of dynamic || []) {
        if (o.top !== undefined && (o.top < foot + body.maxStep || o.bottom > foot + body.height)) continue;
        let normalX, normalZ, depth;
        if (o.radius !== undefined) {
          const dx = x - o.x,
            dz = z - o.z,
            d = Math.hypot(dx, dz);
          depth = r + o.radius - d;
          normalX = d > 1e-9 ? dx / d : 1;
          normalZ = d > 1e-9 ? dz / d : 0;
        } else {
          const qx = clamp(x, o.min[0], o.max[0]),
            qz = clamp(z, o.min[1], o.max[1]),
            dx = x - qx,
            dz = z - qz,
            d = Math.hypot(dx, dz);
          if (d > 1e-9) {
            depth = r - d;
            normalX = dx / d;
            normalZ = dz / d;
          } else {
            const exits = [x - o.min[0], o.max[0] - x, z - o.min[1], o.max[1] - z],
              side = exits.indexOf(Math.min(...exits));
            normalX = side === 0 ? -1 : side === 1 ? 1 : 0;
            normalZ = side === 2 ? -1 : side === 3 ? 1 : 0;
            depth = r + exits[side];
          }
        }
        if (depth > deepest) {
          deepest = depth;
          px = normalX * depth;
          pz = normalZ * depth;
        }
      }
      if (deepest <= 1e-7) return { x, z, clear: true };
      x += px * 1.0001;
      z += pz * 1.0001;
    }
    return { x, z, clear: false };
  }

  // Moves a capsule standing at (x, z, foot) by (dx, dz): sub-steps of 40 % of a column, each pushed
  // clear and then lifted or lowered onto the floor under its centre. A sub-step that cannot be made
  // clear is refused. `blocked` reports that the capsule covered less than 90 % of the way asked.
  function move(x, z, foot, dx, dz, body = BODY, dynamic = null) {
    const length = Math.hypot(dx, dz),
      steps = Math.max(1, Math.ceil(length / (cell * 0.4))),
      sx = dx / steps,
      sz = dz / steps;
    const startX = x,
      startZ = z;
    for (let s = 0; s < steps; s++) {
      let next = resolve(x + sx, z + sz, foot, body, dynamic);
      if (!next.clear) break;
      const floor = standAt(next.x, next.z, foot, body);
      if (Number.isNaN(floor)) break;
      let nextFoot = floor;
      if (floor !== foot) {
        // A step up or down changes what counts as an obstacle; settle again at the new height.
        const settled = resolve(next.x, next.z, floor, body, dynamic);
        const settledFloor = settled.clear ? standAt(settled.x, settled.z, floor, body) : NaN;
        if (Number.isNaN(settledFloor)) break;
        next = settled;
        nextFoot = settledFloor;
      }
      x = next.x;
      z = next.z;
      foot = nextFoot;
    }
    const moved = Math.hypot(x - startX, z - startZ);
    return { x, z, foot, moved, blocked: length > 1e-9 && moved < length * 0.9 };
  }

  // The nearest place within `reach` of (x, z) where a capsule fits with its feet within `tolerance`
  // of `foot`, searched ring by ring; null if there is none.
  function findStand(x, z, foot, { body = BODY, reach = 2.5, tolerance = 0.45 } = {}) {
    const probe = { ...body, maxStep: tolerance, maxDrop: tolerance };
    const test = (px, pz) => {
      const floor = standAt(px, pz, foot, probe);
      if (Number.isNaN(floor)) return null;
      return resolve(px, pz, floor, body, null, 1).clear ? { x: px, z: pz, foot: floor } : null;
    };
    const first = test(x, z);
    if (first) return first;
    const rings = Math.ceil(reach * inv);
    for (let ring = 1; ring <= rings; ring++) {
      let best = null,
        bestDistance = Infinity;
      for (let dk = -ring; dk <= ring; dk++)
        for (let di = -ring; di <= ring; di++) {
          if (Math.max(Math.abs(di), Math.abs(dk)) !== ring) continue;
          const distance = Math.hypot(di, dk);
          if (distance >= bestDistance || distance > reach * inv) continue;
          const found = test(x + di * cell, z + dk * cell);
          if (found) {
            best = found;
            bestDistance = distance;
          }
        }
      if (best) return best;
    }
    return null;
  }

  return {
    bounds: { min: [ox, ymin, oz], max: [ex, ymax, ez] },
    cell,
    size: [nx, nz],
    layers,
    addTriangle,
    addGeometry,
    standAt,
    floorBelow,
    resolve: (x, z, foot, body = BODY, dynamic = null) => resolve(x, z, foot, body, dynamic),
    move,
    findStand,
    // The intervals of the column under (x, z), for tests and the lab.
    column(x, z) {
      const c = columnOf(x, z);
      if (c < 0) return null;
      const out = [];
      for (let j = 0; j < count[c]; j++) out.push([lo[c * layers + j], hi[c * layers + j]]);
      return out;
    },
    // Transferable copies of the field: a worker builds it, the page queries it.
    snapshot() {
      return { lo: lo.slice(), hi: hi.slice(), count: count.slice(), stats: { triangles, samples, overflows, meshes } };
    },
    load({ lo: nextLo, hi: nextHi, count: nextCount, stats }) {
      if (nextCount?.length !== columns || nextLo?.length !== columns * layers || nextHi?.length !== columns * layers) return false;
      lo = nextLo;
      hi = nextHi;
      count = nextCount;
      if (stats) ({ triangles, samples, overflows, meshes } = stats);
      return true;
    },
    evidence() {
      let filled = 0,
        intervals = 0;
      for (let c = 0; c < columns; c++) {
        if (count[c]) filled++;
        intervals += count[c];
      }
      return { cell: Math.round(cell * 1000) / 1000, size: [nx, nz], columns, filled, intervals, triangles, samples, overflows, meshes };
    },
  };
}

// Water is a block, not a floor: the onsen, a swimming pool, anything tagged userData.water. The
// kitchen's waterfall island is stone.
const WATER = /(^|[^a-z])(water|pool[ _-]?water|swimming)([^a-z]|$)/i;
export function isWater(object) {
  if (object.userData?.water) return true;
  for (const material of [object.material].flat())
    if (material && (material.transmission > 0 || (WATER.test(material.name || "") && !/waterfall/i.test(material.name || "")))) return true;
  return WATER.test(object.name || "") && !/waterfall/i.test(object.name || "");
}

// How a loaded mesh meets a walker: "solid", "water" (raised into a block) or null (walked through).
// Glass fronts and the terrace's glass parapet are solid; the sliding doors (they open, and the
// walk keeps a closed one as a moving obstacle), shadow-only copies, held props,
// the desk's interactive objects, skinned characters and animals, and faint transparent effects are
// not. userData.walk = "solid" | "water" | "through" overrides the guess for any authored piece.
export function walkKind(object, root) {
  if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh || !object.geometry?.attributes?.position) return null;
  let glazing = false,
    ghost = false,
    flora = false,
    cutawayStructure = false,
    authored = null;
  for (let node = object; node && node !== root; node = node.parent) {
    const data = node.userData || {};
    // Furniture keeps the native placeholder's triangles after its visual replacement arrives.
    // Only that placeholder may be hidden: a hidden ancestor room still stays out of the field.
    if (data.furnitureAnchor || data.furnitureCollision === false) return null;
    // Cutaways change visibility, never structural transforms: the roof remains clifftop support,
    // and the lower bathroom's ceiling is also the upper bathroom's real floor. A hidden ancestor
    // room still stays out, just as it does for a hidden furniture placeholder.
    if (node.visible === false && data.furnitureCollision !== true && !data.caveRoof && !data.bathroomCeilingFor && !data.roomCeilingFor) return null;
    authored ??= data.walk ?? null;
    if (data.shadowOnly || data.facadeDoor || data.estateDoor || data.libraryLadder || data.walkPresence || data.activityProp || data.action)
      return null;
    if (data.caveRoof || data.bathroomCeilingFor || data.roomCeilingFor) cutawayStructure = true;
    if (data.glazing) glazing = true;
    if (data.flora) flora = true;
    if (data.noOcclusion) ghost = true;
  }
  if (authored === "through") return null;
  if (authored === "solid" || authored === "water") return authored;
  if (cutawayStructure) return "solid";
  if (glazing) return "solid";
  // Wind-blown leaves/grass are not rigid walls. Native tree trunks still stop the body, and an
  // authored walk tag can opt any plant back in. Avoid voxelizing the outdoor planting's hundreds
  // of thousands of leaf triangles, which otherwise creates a thicket of unseen capsule stops.
  const materials = [object.material].flat();
  if (flora && !materials.some((material) => /\b(?:bark|trunk)\b/i.test(material?.name || ""))) return null;
  if (materials.every((material) => material?.name === "hinterland scrub canopy")) return null;
  if (isWater(object)) return "water";
  if (ghost) return null;
  return materials.some((m) => m && m.visible !== false && !(m.transparent && m.opacity < 0.5)) ? "solid" : null;
}

// Object-space positions as a fresh Float32Array a worker can own.
function packedPositions(attribute) {
  if (!attribute.isInterleavedBufferAttribute && !attribute.normalized && attribute.itemSize === 3 && attribute.array instanceof Float32Array)
    return attribute.array.slice(0, attribute.count * 3);
  const packed = new Float32Array(attribute.count * 3);
  for (let i = 0; i < attribute.count; i++) {
    packed[i * 3] = attribute.getX(i);
    packed[i * 3 + 1] = attribute.getY(i);
    packed[i * 3 + 2] = attribute.getZ(i);
  }
  return packed;
}

// Builds a walk field for the page: meshes are rasterized in a module worker (walk-field-worker.mjs)
// or, where module workers are unavailable, in background slices here, and `onReady` runs each time
// a new state of the field lands. addRoots adds every walkable mesh of the given roots not added
// before, so streamed rooms join a field that already exists.
export function createWalkFieldBuilder({ bounds, onReady = () => {} }) {
  let field = createWalkField(bounds);
  const added = new WeakSet(),
    queue = [],
    sources = [];
  let worker = null,
    version = 0,
    landed = 0,
    ready = false,
    scheduled = false,
    disposed = false,
    meshCount = 0;
  const started = globalThis.performance?.now() ?? 0;
  let builtMilliseconds = null;
  const landedNow = () => {
    ready = true;
    builtMilliseconds ??= Math.round((globalThis.performance?.now() ?? 0) - started);
    onReady();
  };
  if (typeof Worker === "function")
    try {
      let module = false;
      const next = new Worker(new URL("./walk-field-worker.mjs", import.meta.url), {
        get type() {
          module = true;
          return "module";
        },
      });
      if (!module) throw new Error("module workers unavailable");
      next.onmessage = ({ data }) => {
        if (disposed || data.type !== "field" || data.version < landed) return;
        landed = data.version;
        if (field.load(data)) landedNow();
      };
      next.onerror = (event) => {
        event.preventDefault?.();
        next.terminate();
        if (disposed || worker !== next) return;
        worker = null;
        // A failed module worker has already received transferred (detached) arrays. Replay from
        // the retained native geometry, rather than leaving Walk permanently immobile or missing
        // whichever rooms had not reached the last snapshot. Packing happens one fallback job at
        // a time, so recovery does not copy every loaded model in one main-thread task.
        field = createWalkField(bounds);
        ready = false;
        queue.push(...sources);
        schedule();
      };
      next.postMessage({ type: "init", bounds: { min: field.bounds.min, max: field.bounds.max, cell: field.cell } });
      worker = next;
    } catch {
      worker = null;
    }

  function schedule() {
    if (scheduled || disposed) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      step();
    };
    if (globalThis.scheduler?.postTask) globalThis.scheduler.postTask(run, { priority: "user-visible" }).catch(() => {});
    else setTimeout(run, 0);
  }
  // Main-thread fallback: about 30 000 triangles a slice.
  const packedJob = ({ geometry, matrix, extrude }) => ({
    type: "mesh",
    positions: packedPositions(geometry.attributes.position),
    index: geometry.index ? geometry.index.array.slice(0, geometry.index.count) : null,
    matrix,
    extrude,
  });
  function step() {
    if (disposed) return;
    let budget = 30_000;
    while (budget > 0 && queue.length) {
      const job = packedJob(queue.shift());
      field.addGeometry(job);
      budget -= (job.index ? job.index.length : job.positions.length / 3) / 3;
    }
    if (queue.length) schedule();
    else landedNow();
  }

  function addRoots(roots, root) {
    if (disposed) return 0;
    let sent = 0;
    for (const start of roots) {
      if (!start) continue;
      start.updateMatrixWorld(true);
      start.traverse((object) => {
        if (added.has(object)) return;
        const kind = walkKind(object, root);
        if (!kind) return;
        added.add(object);
        const source = {
          geometry: object.geometry,
          matrix: [...object.matrixWorld.elements],
          extrude: kind === "water" ? WATER_BLOCK : 0,
        };
        sources.push(source);
        sent++;
        meshCount++;
        if (worker) {
          const job = packedJob(source);
          worker.postMessage(job, job.index ? [job.positions.buffer, job.index.buffer] : [job.positions.buffer]);
        } else queue.push(source);
      });
    }
    if (!sent) {
      // Worker jobs are not in the main-thread queue. A later empty/effect root must not mark its
      // still-pending first snapshot ready, or Walk briefly starts against an empty collision map.
      if (!ready && !queue.length && (!worker || version === landed)) landedNow();
      return 0;
    }
    if (worker) worker.postMessage({ type: "snapshot", version: ++version });
    else schedule();
    return sent;
  }

  return {
    get field() {
      return field;
    },
    addRoots,
    get ready() {
      return ready;
    },
    evidence: () => ({ ready, worker: Boolean(worker), meshes: meshCount, builtMilliseconds, ...field.evidence() }),
    dispose() {
      disposed = true;
      worker?.terminate();
      worker = null;
      queue.length = 0;
      sources.length = 0;
    },
  };
}
