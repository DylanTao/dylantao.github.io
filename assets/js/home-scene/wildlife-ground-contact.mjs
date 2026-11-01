import * as THREE from "../three.module.min.js";

const CELL = 0.35;
const clock = () => globalThis.performance?.now() || 0;
const EXCLUDED = /plant|flora|foliage|leaf|grass|sage|agave|water|glass|shadow|furniture|placeholder/i;

// The same physical families as the native coast survey. Colour/opacity alone cannot turn
// a leaf card or an indoor table into ground. Visibility is recorded separately: a cutaway
// does not move the physical roof, and the owning scene must keep visible habitat supported.
export function isCoastalGround(mesh) {
  if (!mesh.isMesh || mesh.isSkinnedMesh || !mesh.geometry?.attributes.position || mesh.geometry.attributes.coastalPlantWeight) return false;
  let coast = false,
    core = false,
    roof = false;
  const names = [];
  for (let o = mesh; o; o = o.parent) {
    if (o.userData.action || o.userData.activityProp || o.userData.furnitureAnchor || o.userData.flora || o.userData.shadowOnly) return false;
    names.push(o.name || "");
    coast ||= /^coast_/i.test(o.name);
    core ||= /^core_/i.test(o.name);
    roof ||= Boolean(o.userData.caveRoof);
  }
  const materials = [mesh.material].flat().filter(Boolean);
  if (!materials.length || materials.some((m) => m.transparent || m.opacity < 0.99 || m.transmission > 0)) return false;
  if (EXCLUDED.test(names.join(" ") + " " + materials.map((m) => m.name).join(" "))) return false;
  return coast || roof || (core && materials.some((m) => /golden[ _]coastal[ _]sandstone|La Jolla bluff sandstone/i.test(m.name)));
}

export function createGroundPatch(path, margin = 0.65, cellSize = CELL) {
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new RangeError("Ground index cell size must be positive and finite");
  const bounds = {
    minX: Math.min(...path.map((p) => p[0])) - margin,
    maxX: Math.max(...path.map((p) => p[0])) + margin,
    minZ: Math.min(...path.map((p) => p[2])) - margin,
    maxZ: Math.max(...path.map((p) => p[2])) + margin,
  };
  const triangles = [],
    cells = new Map(),
    sources = new Set(),
    meshes = new Set(),
    edgeBalances = new Map(),
    boundaryCells = new Map(),
    cellCeilings = new Map(),
    regions = new Map(),
    surfaceRegions = new Map();
  const polygonA = new Float64Array(20),
    polygonB = new Float64Array(20);
  let milliseconds = 0;
  let boundariesDirty = true;
  const a = new THREE.Vector3(),
    b = a.clone(),
    c = a.clone(),
    normal = a.clone(),
    edge = a.clone();
  const cell = (x, z) => `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`;
  function registerEdge(ax, az, bx, bz) {
    const a = `${ax},${az}`,
      b = `${bx},${bz}`;
    if (a === b) return;
    const forward = a < b,
      key = forward ? `${a}|${b}` : `${b}|${a}`;
    const record = edgeBalances.get(key) || {
      balance: 0,
      ax,
      az,
      bx,
      bz,
      minX: Math.min(ax, bx),
      maxX: Math.max(ax, bx),
      minZ: Math.min(az, bz),
      maxZ: Math.max(az, bz),
    };
    record.balance += forward ? 1 : -1;
    edgeBalances.set(key, record);
  }
  function indexBoundaries() {
    edgeBalances.clear();
    boundaryCells.clear();
    for (const t of triangles) {
      registerEdge(t.ax, t.az, t.bx, t.bz);
      registerEdge(t.bx, t.bz, t.cx, t.cz);
      registerEdge(t.cx, t.cz, t.ax, t.az);
    }
    for (const e of edgeBalances.values()) {
      if (e.balance === 0) continue;
      const minX = Math.max(bounds.minX, e.minX),
        maxX = Math.min(bounds.maxX, e.maxX),
        minZ = Math.max(bounds.minZ, e.minZ),
        maxZ = Math.min(bounds.maxZ, e.maxZ);
      if (minX > maxX || minZ > maxZ) continue;
      for (let x = Math.floor(minX / cellSize); x <= Math.floor(maxX / cellSize); x++)
        for (let z = Math.floor(minZ / cellSize); z <= Math.floor(maxZ / cellSize); z++) {
          const key = `${x},${z}`;
          if (!boundaryCells.has(key)) boundaryCells.set(key, []);
          boundaryCells.get(key).push(e);
        }
    }
  }
  function capture(roots) {
    const start = clock();
    for (const root of roots) {
      root.updateWorldMatrix(true, true);
      root.traverse((mesh) => {
        if (meshes.has(mesh) || !isCoastalGround(mesh)) return;
        meshes.add(mesh);
        const positions = mesh.geometry.attributes.position,
          indices = mesh.geometry.index;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
        if (box.max.x < bounds.minX || box.min.x > bounds.maxX || box.max.z < bounds.minZ || box.min.z > bounds.maxZ) return;
        for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
          a.fromBufferAttribute(positions, indices ? indices.getX(i) : i).applyMatrix4(mesh.matrixWorld);
          b.fromBufferAttribute(positions, indices ? indices.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
          c.fromBufferAttribute(positions, indices ? indices.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
          const minX = Math.max(bounds.minX, Math.min(a.x, b.x, c.x)),
            maxX = Math.min(bounds.maxX, Math.max(a.x, b.x, c.x)),
            minZ = Math.max(bounds.minZ, Math.min(a.z, b.z, c.z)),
            maxZ = Math.min(bounds.maxZ, Math.max(a.z, b.z, c.z));
          if (minX > maxX || minZ > maxZ) continue;
          normal.subVectors(b, a).cross(edge.subVectors(c, a)).normalize();
          if (normal.y < 0.25) continue;
          const determinant = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
          if (Math.abs(determinant) < 1e-10) continue;
          const triangle = {
            ax: a.x,
            az: a.z,
            bx: b.x,
            bz: b.z,
            cx: c.x,
            cz: c.z,
            aX: b.z - c.z,
            aZ: c.x - b.x,
            bX: c.z - a.z,
            bZ: a.x - c.x,
            ay: a.y,
            by: b.y,
            cy: c.y,
            determinant,
            normal: normal.clone(),
            mesh,
            triangle: i / 3,
          };
          triangles.push(triangle);
          sources.add(mesh.name);
          for (let x = Math.floor(minX / cellSize); x <= Math.floor(maxX / cellSize); x++)
            for (let z = Math.floor(minZ / cellSize); z <= Math.floor(maxZ / cellSize); z++) {
              const key = `${x},${z}`;
              if (!cells.has(key)) cells.set(key, []);
              cells.get(key).push(triangle);
            }
        }
      });
    }
    boundariesDirty = true;
    cellCeilings.clear();
    regions.clear();
    surfaceRegions.clear();
    milliseconds += clock() - start;
  }
  function sample(x, z, maximum = Infinity) {
    let best = null,
      bestHeight = -Infinity;
    for (const t of cells.get(cell(x, z)) || []) {
      const u = (t.aX * (x - t.cx) + t.aZ * (z - t.cz)) / t.determinant,
        v = (t.bX * (x - t.cx) + t.bZ * (z - t.cz)) / t.determinant;
      if (u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7) continue;
      const height = u * t.ay + v * t.by + (1 - u - v) * t.cy;
      if (height > maximum || (best && height <= bestHeight)) continue;
      best = t;
      bestHeight = height;
    }
    return supportResult(best, bestHeight);
  }
  function supportResult(t, height) {
    if (!t) return null;
    let visible = true;
    for (let o = t.mesh; o; o = o.parent) visible &&= o.visible;
    return { height, normal: t.normal, mesh: t.mesh.name, triangle: t.triangle, visible };
  }
  function maximumHeightInBounds(query, certify = true) {
    const { minX, maxX, minZ, maxZ } = query;
    if (![minX, maxX, minZ, maxZ].every(Number.isFinite) || minX > maxX || minZ > maxZ) return null;
    if (boundariesDirty) {
      indexBoundaries();
      boundariesDirty = false;
    }
    const x0 = Math.floor(minX / cellSize),
      x1 = Math.floor(maxX / cellSize),
      z0 = Math.floor(minZ / cellSize),
      z1 = Math.floor(maxZ / cellSize),
      regionKey = `${x0},${x1},${z0},${z1}`;
    let region = regions.get(regionKey);
    if (!region) {
      const candidates = new Set(),
        boundaries = new Set(),
        owners = new Set();
      let height = -Infinity;
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++) {
          const key = `${x},${z}`,
            list = cells.get(key) || [];
          let ceiling = cellCeilings.get(key);
          if (ceiling === undefined) {
            ceiling = -Infinity;
            // The plane is affine: its maximum over the entire cell is at a
            // corner. Caching this slightly looser bound changes no geometry.
            for (const t of list)
              for (const cx of [x * cellSize, (x + 1) * cellSize])
                for (const cz of [z * cellSize, (z + 1) * cellSize])
                  ceiling = Math.max(ceiling, t.cy - (t.normal.x * (cx - t.cx) + t.normal.z * (cz - t.cz)) / t.normal.y);
            cellCeilings.set(key, ceiling);
          }
          height = Math.max(height, ceiling);
          for (const t of list) {
            candidates.add(t);
            owners.add(t.mesh);
          }
          for (const e of boundaryCells.get(key) || []) boundaries.add(e);
        }
      const planes = new Map();
      for (const t of candidates) {
        const x = t.normal.x / t.normal.y,
          z = t.normal.z / t.normal.y,
          offset = t.cy + x * t.cx + z * t.cz;
        planes.set(`${x},${z},${offset}`, { x, z, offset });
      }
      region = { height, triangles: candidates.size, boundaries: [...boundaries], owners: [...owners], planes: [...planes.values()] };
      regions.set(regionKey, region);
    }
    if (!region.triangles) return null;
    let gap = -Infinity;
    if (query.corners) {
      gap = Infinity;
      for (const plane of region.planes)
        for (const p of query.corners)
          gap = Math.min(gap, p.y + plane.x * p.x + plane.z * p.z - plane.offset - 1e-8 * (1 + Math.abs(plane.x) + Math.abs(plane.z)));
    }
    if (!certify) return { height: region.height + 1e-8, gap };
    let visible = true;
    for (const mesh of region.owners) for (let o = mesh; o; o = o.parent) visible &&= o.visible;
    // Oppositely oriented shared edges are interior to the projected support
    // union. A rectangle touching any remaining edge stays uncertified. Exact
    // opposite edges alone cancel; there is no near-edge welding.
    const withinPatch = minX >= bounds.minX && maxX <= bounds.maxX && minZ >= bounds.minZ && maxZ <= bounds.maxZ;
    const crossesBoundary = region.boundaries.some((e) => {
      const dx = e.bx - e.ax,
        dz = e.bz - e.az;
      let start = 0,
        end = 1;
      for (const [p, q] of [
        [-dx, e.ax - minX + 1e-8],
        [dx, maxX - e.ax + 1e-8],
        [-dz, e.az - minZ + 1e-8],
        [dz, maxZ - e.az + 1e-8],
      ]) {
        if (p === 0) {
          if (q < 0) return false;
          continue;
        }
        const t = q / p;
        if (p < 0) start = Math.max(start, t);
        else end = Math.min(end, t);
        if (start > end) return false;
      }
      return true;
    });
    const covered = withinPatch && !crossesBoundary && !!sample((minX + maxX) / 2, (minZ + maxZ) / 2);
    return { height: region.height + 1e-8, gap, covered, visible, triangles: region.triangles };
  }
  function minimumSurfaceGap(faces, limit = Infinity, hierarchy = null) {
    let minimum = null,
      best = limit,
      tested = 0,
      candidatePairs = 0,
      clippedPairs = 0,
      upward = 0;
    const vertical = [],
      degenerate = [];
    const inputFaces = faces.length;
    let boundsExcludedFaces = 0,
      boundsTestedNodes = 0;
    if (hierarchy) {
      const selected = [];
      const visit = (node) => {
        boundsTestedNodes++;
        const box = hierarchy.bounds(node),
          bound =
            box && maximumHeightInBounds({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, corners: box.contactCorners }, false);
        // Every point of every face lies in this rigid transformed box. This
        // excludes a smaller gap; it does not assert any continuous floor.
        if (bound && bound.gap > limit + 1e-9) {
          boundsExcludedFaces += node.faceCount;
          return;
        }
        if (node.children) node.children.forEach(visit);
        else selected.push(...node.faces);
      };
      visit(hierarchy.root);
      faces = selected.sort((a, b) => a.order - b.order);
    }
    for (const face of faces) {
      const [a, b, c] = face.points,
        abx = b.x - a.x,
        aby = b.y - a.y,
        abz = b.z - a.z,
        acx = c.x - a.x,
        acy = c.y - a.y,
        acz = c.z - a.z,
        nx = aby * acz - abz * acy,
        ny = abz * acx - abx * acz,
        nz = abx * acy - aby * acx,
        square = nx * nx + ny * ny + nz * nz;
      if (square <= 1e-24) {
        degenerate.push({ mesh: face.mesh, triangle: face.triangle });
        continue;
      }
      if (ny * ny <= square * 1e-10) {
        vertical.push({ mesh: face.mesh, triangle: face.triangle });
        continue;
      }
      if (ny > 0) {
        upward++;
        continue;
      }
      tested++;
      const minX = Math.min(a.x, b.x, c.x),
        maxX = Math.max(a.x, b.x, c.x),
        minZ = Math.min(a.z, b.z, c.z),
        maxZ = Math.max(a.z, b.z, c.z),
        x0 = Math.floor(minX / cellSize),
        x1 = Math.floor(maxX / cellSize),
        z0 = Math.floor(minZ / cellSize),
        z1 = Math.floor(maxZ / cellSize),
        key = `${x0},${x1},${z0},${z1}`;
      let terrain = surfaceRegions.get(key);
      if (!terrain) {
        const set = new Set();
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (const t of cells.get(`${x},${z}`) || []) set.add(t);
        terrain = [...set];
        surfaceRegions.set(key, terrain);
      }
      const skinHeight = (x, z) => a.y - (nx * (x - a.x) + nz * (z - a.z)) / ny;
      for (const t of terrain) {
        candidatePairs++;
        const height = (x, z) => {
          const u = (t.aX * (x - t.cx) + t.aZ * (z - t.cz)) / t.determinant,
            v = (t.bX * (x - t.cx) + t.bZ * (z - t.cz)) / t.determinant;
          return u * t.ay + v * t.by + (1 - u - v) * t.cy;
        };
        // An affine gap over the skin triangle is bounded by its three corners.
        // The actual overlap polygon can only have an equal or larger minimum.
        if (Math.min(a.y - height(a.x, a.z), b.y - height(b.x, b.z), c.y - height(c.x, c.z)) > best + 1e-9) continue;
        let input = polygonA,
          output = polygonB,
          count = 3;
        input[0] = a.x;
        input[1] = a.z;
        input[2] = b.x;
        input[3] = b.z;
        input[4] = c.x;
        input[5] = c.z;
        const edges = [
            [t.ax, t.az, t.bx, t.bz],
            [t.bx, t.bz, t.cx, t.cz],
            [t.cx, t.cz, t.ax, t.az],
          ],
          orientation = Math.sign(t.determinant);
        for (const [ax, az, bx, bz] of edges) {
          if (!count) break;
          let written = 0,
            px = input[(count - 1) * 2],
            pz = input[(count - 1) * 2 + 1],
            pd = orientation * ((bx - ax) * (pz - az) - (bz - az) * (px - ax));
          for (let i = 0; i < count; i++) {
            const x = input[i * 2],
              z = input[i * 2 + 1],
              distance = orientation * ((bx - ax) * (z - az) - (bz - az) * (x - ax)),
              inside = distance >= -1e-12,
              previousInside = pd >= -1e-12;
            if (inside !== previousInside) {
              const fraction = pd / (pd - distance);
              output[written * 2] = px + (x - px) * fraction;
              output[written * 2 + 1] = pz + (z - pz) * fraction;
              written++;
            }
            if (inside) {
              output[written * 2] = x;
              output[written * 2 + 1] = z;
              written++;
            }
            px = x;
            pz = z;
            pd = distance;
          }
          [input, output] = [output, input];
          count = written;
        }
        if (!count) continue;
        clippedPairs++;
        for (let i = 0; i < count; i++) {
          const x = input[i * 2],
            z = input[i * 2 + 1],
            y = skinHeight(x, z),
            groundHeight = height(x, z),
            gap = y - groundHeight;
          if (groundHeight > y + 0.5 || gap >= best) continue;
          let visible = true;
          for (let o = t.mesh; o; o = o.parent) visible &&= o.visible;
          // The overlap vertex may be a moving skin vertex, a fixed terrain
          // vertex, or an edge/edge intersection. Its correct motion derivative
          // differs in each case; a skin-plane derivative at a skin vertex can
          // make the joint solver oscillate at a crease.
          const gradient = new THREE.Vector3(t.normal.x / t.normal.y, 1, t.normal.z / t.normal.y),
            skinVertices = [a, b, c],
            terrainVertices = [
              [t.ax, t.az],
              [t.bx, t.bz],
              [t.cx, t.cz],
            ];
          let derivativeKind = "skin vertex";
          if (!skinVertices.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 <= 1e-16)) {
            if (terrainVertices.some((p) => (p[0] - x) ** 2 + (p[1] - z) ** 2 <= 1e-16)) {
              gradient.set(nx / ny, 1, nz / ny);
              derivativeKind = "fixed terrain vertex";
            } else {
              const onEdge = (ax, az, bx, bz) => {
                const dx = bx - ax,
                  dz = bz - az,
                  length = dx * dx + dz * dz,
                  cross = dx * (z - az) - dz * (x - ax),
                  along = (x - ax) * dx + (z - az) * dz;
                return length > 0 && cross * cross <= 1e-16 * length && along >= -1e-8 && along <= length + 1e-8;
              };
              let skinEdge = null,
                terrainEdge = null;
              for (let k = 0; k < 3; k++) {
                const p = skinVertices[k],
                  q = skinVertices[(k + 1) % 3];
                if (onEdge(p.x, p.z, q.x, q.z)) skinEdge = new THREE.Vector3().subVectors(q, p);
                const u = terrainVertices[k],
                  v = terrainVertices[(k + 1) % 3];
                if (onEdge(...u, ...v)) terrainEdge = new THREE.Vector3(v[0] - u[0], 0, v[1] - u[1]);
              }
              const denominator = skinEdge && terrainEdge ? terrainEdge.x * skinEdge.z - terrainEdge.z * skinEdge.x : 0;
              if (skinEdge && terrainEdge && Math.abs(denominator) > 1e-12 * Math.hypot(skinEdge.x, skinEdge.z) * terrainEdge.length()) {
                const factor = gradient.dot(skinEdge) / denominator;
                gradient.addScaledVector(new THREE.Vector3(-terrainEdge.z, 0, terrainEdge.x), -factor);
                derivativeKind = "edge intersection";
              } else derivativeKind = "unqualified edge derivative; measured iteration fallback";
            }
          }
          best = gap;
          minimum = {
            gap,
            point: new THREE.Vector3(x, y, z),
            mesh: face.mesh,
            vertex: null,
            skinTriangle: face.triangle,
            supportMesh: t.mesh.name,
            triangle: t.triangle,
            normal: gradient,
            derivativeKind,
            visible,
            kind: "triangle overlap",
          };
        }
      }
    }
    return {
      minimum,
      scope: "posed downward skin faces versus captured upward terrain; not an all-face audit",
      limit,
      downwardFaces: tested,
      upwardFaces: upward,
      unassessedVerticalFaces: vertical,
      degenerateFaces: degenerate,
      candidatePairs,
      clippedPairs,
      inputFaces,
      boundsTestedNodes,
      boundsExcludedFaces,
    };
  }
  return {
    capture,
    sample,
    maximumHeightInBounds,
    minimumSurfaceGap,
    evidence: () => ({
      ready: triangles.length > 0,
      triangles: triangles.length,
      cells: cells.size,
      meshes: [...sources],
      bounds,
      captureMilliseconds: milliseconds,
    }),
  };
}

// Rigid paw ownership is read from the delivered skin, in the paw's own frame. A small grid
// keeps its lower envelope; the runtime never substitutes an ellipsoid or a nominal thickness.
export function footSole(model, bone) {
  // SkinnedMesh.updateMatrixWorld refreshes its bind inverse; updateWorldMatrix does not.
  model.updateMatrixWorld(true);
  const points = new Map(),
    inverse = bone.matrixWorld.clone().invert(),
    point = new THREE.Vector3();
  model.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const skin = mesh.geometry.attributes.skinIndex,
      weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < skin.count; i++) {
      let owned = 0;
      for (let k = 0; k < 4; k++) if (mesh.skeleton.bones[skin.getComponent(i, k)] === bone) owned += weights.getComponent(i, k);
      if (owned < 0.999) continue;
      mesh.getVertexPosition(i, point);
      point.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
      const key = `${Math.round(point.x / 0.006)},${Math.round(point.z / 0.006)}`;
      if (!points.has(key) || point.y < points.get(key).y) points.set(key, point.clone());
    }
  });
  return [...points.values()];
}

export function groundFootQuaternion(yaw, normal) {
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  forward.y = -(normal.x * forward.x + normal.z * forward.z) / normal.y;
  forward.normalize();
  const right = normal.clone().cross(forward).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, normal, forward));
}

export function fitFootSole(patch, sole, position, quaternion, onlyLift = false) {
  let clearance = Infinity,
    supported = 0,
    visible = true;
  const point = new THREE.Vector3();
  for (const sample of sole) {
    point.copy(sample).applyQuaternion(quaternion).add(position);
    const surface = patch.sample(point.x, point.z, position.y + 0.5);
    if (!surface) continue;
    supported++;
    clearance = Math.min(clearance, point.y - surface.height);
    visible &&= surface.visible;
  }
  const shift = supported ? (onlyLift ? Math.max(0, -clearance) : -clearance) : 0;
  return { position: position.clone().add(new THREE.Vector3(0, shift, 0)), supported, visible, correction: shift };
}
