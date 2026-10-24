import * as THREE from "../three.module.min.js";

// Prototype only: close the actual primary-view clipping section. A narrow rest-space
// patch is selected once; only that patch is skinned/intersected after a pose change.
// The native avatar remains the owner of every material, reflection and shadow.
const BAND = 0.1;
const INSET = 0.0002;
const pointKey = (p) => `${Math.round(p.x * 1e5)},${Math.round(p.z * 1e5)}`;

function contains(loop, p) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i],
      b = loop[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function sectionContours(triangles, vertex, height) {
  const points = new Map(),
    edges = new Map();
  for (const triangle of triangles) {
    const crossed = [];
    for (let k = 0; k < 3; k++) {
      const a = vertex(triangle[k]),
        b = vertex(triangle[(k + 1) % 3]);
      if ((a.y < height && b.y >= height) || (b.y < height && a.y >= height)) {
        crossed.push(a.clone().lerp(b, (height - a.y) / (b.y - a.y)));
      }
    }
    if (crossed.length !== 2) continue;
    const [a, b] = crossed.map(pointKey);
    if (a === b) continue;
    points.set(a, crossed[0]);
    points.set(b, crossed[1]);
    edges.set([a, b].sort().join("|"), [a, b]);
  }
  const graph = new Map();
  for (const [a, b] of edges.values()) {
    if (!graph.has(a)) graph.set(a, new Set());
    if (!graph.has(b)) graph.set(b, new Set());
    graph.get(a).add(b);
    graph.get(b).add(a);
  }
  if ([...graph.values()].some((adjacent) => adjacent.size !== 2)) return { valid: false, loops: [], vertices: graph.size };
  const seen = new Set(),
    loops = [];
  for (const start of graph.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let current = start,
      previous = null;
    do {
      if (seen.has(current)) return { valid: false, loops: [], vertices: graph.size };
      seen.add(current);
      loop.push(points.get(current));
      const next = [...graph.get(current)].find((key) => key !== previous);
      previous = current;
      current = next;
    } while (current !== start);
    if (loop.length >= 3) loops.push(loop);
  }
  return { valid: true, loops, vertices: graph.size };
}

function triangulate(loops, hollow) {
  const flat = loops.map((loop) => loop.map((p) => new THREE.Vector2(p.x, p.z)));
  const depths = flat.map((loop, i) => (hollow ? flat.filter((other, j) => i !== j && contains(other, loop[0])).length : 0));
  const vertices = [],
    indices = [];
  for (let i = 0; i < flat.length; i++) {
    if (depths[i] % 2) continue;
    const holes = hollow ? flat.filter((loop, j) => depths[j] === depths[i] + 1 && contains(flat[i], loop[0])) : [];
    const combined = [flat[i], ...holes].flat(),
      offset = vertices.length;
    const faces = THREE.ShapeUtils.triangulateShape(flat[i], holes);
    vertices.push(...combined);
    for (const face of faces) indices.push(...face.map((v) => offset + v));
  }
  return { vertices, indices };
}

export function createWalkSectionCaps(body, height) {
  const group = new THREE.Group();
  group.name = "primary-neck-section-caps";
  group.visible = false;
  group.userData.walkSectionCap = true;
  group.userData.noVolumeDepth = group.userData.noContactOcclusion = true;
  const rows = [],
    inverse = new THREE.Matrix4(),
    normal = new THREE.Vector3(0, 1, 0);
  let updates = 0,
    maximumMs = 0,
    totalMs = 0,
    invalid = 0;
  body.updateWorldMatrix(true, true);
  body.traverse((mesh) => {
    if (!mesh.isSkinnedMesh || !/^(skin|long black hair)$/.test(mesh.material?.name || "")) return;
    const index = mesh.geometry.index,
      triangles = [],
      all = [],
      source = mesh.geometry.attributes.position;
    const positions = new Map();
    for (let i = 0; i < source.count; i++) positions.set(i, mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
    for (let i = 0; i < index.count; i += 3) {
      const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)],
        ys = triangle.map((j) => positions.get(j).y);
      all.push(triangle);
      if (Math.min(...ys) <= height + BAND && Math.max(...ys) >= height - BAND) triangles.push(triangle);
    }
    if (!triangles.length) return;
    const unique = [...new Set(triangles.flat())],
      posed = new Map(unique.map((i) => [i, new THREE.Vector3()]));
    const geometry = new THREE.BufferGeometry(),
      capacity = triangles.length * 2;
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(capacity * 2), 2));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(capacity * 3).fill(1), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(capacity * 3), 1).setUsage(THREE.DynamicDrawUsage));
    const cap = new THREE.Mesh(geometry, mesh.material);
    cap.name = `primary-section-${mesh.material.name}`;
    cap.frustumCulled = false;
    cap.castShadow = false;
    cap.receiveShadow = true;
    cap.userData.walkSectionCap = cap.userData.noVolumeDepth = cap.userData.noContactOcclusion = true;
    group.add(cap);
    rows.push({ mesh, triangles, all, unique, posed, cap, loops: 0, valid: false, vertices: 0 });
  });
  body.add(group);

  function update(cut) {
    const start = performance.now();
    body.updateWorldMatrix(true, true);
    inverse.copy(body.matrixWorld).invert();
    normal.set(0, 1, 0).transformDirection(inverse);
    for (const row of rows) {
      for (const i of row.unique) row.mesh.getVertexPosition(i, row.posed.get(i)).applyMatrix4(row.mesh.matrixWorld);
      const section = sectionContours(row.triangles, (i) => row.posed.get(i), cut);
      row.valid = section.valid;
      row.loops = section.loops.length;
      row.vertices = section.vertices;
      row.cap.visible = section.valid;
      row.cap.material = row.mesh.material;
      if (!section.valid) {
        invalid++;
        row.cap.geometry.setDrawRange(0, 0);
        continue;
      }
      const shape = triangulate(section.loops, row.mesh.material.name === "long black hair");
      const geometry = row.cap.geometry;
      if (shape.vertices.length > geometry.attributes.position.count || shape.indices.length > geometry.index.count)
        throw new Error("Native neck section exceeded its bounded patch capacity");
      shape.vertices.forEach((p, i) => {
        const local = new THREE.Vector3(p.x, cut - INSET, p.y).applyMatrix4(inverse);
        geometry.attributes.position.setXYZ(i, local.x, local.y, local.z);
        geometry.attributes.normal.setXYZ(i, normal.x, normal.y, normal.z);
      });
      // X/Z triangulation has a -Y normal. Reverse each face to expose its closed top.
      for (let i = 0; i < shape.indices.length; i += 3) {
        geometry.index.setX(i, shape.indices[i]);
        geometry.index.setX(i + 1, shape.indices[i + 2]);
        geometry.index.setX(i + 2, shape.indices[i + 1]);
      }
      geometry.setDrawRange(0, shape.indices.length);
      geometry.attributes.position.needsUpdate = geometry.attributes.normal.needsUpdate = geometry.index.needsUpdate = true;
    }
    const ms = performance.now() - start;
    updates++;
    totalMs += ms;
    maximumMs = Math.max(maximumMs, ms);
  }

  return {
    group,
    update,
    evidence: () => ({
      updates,
      maximumMs,
      meanMs: totalMs / Math.max(1, updates),
      invalid,
      band: BAND,
      rows: rows.map((r) => ({
        material: r.mesh.material.name,
        patchTriangles: r.triangles.length,
        fullTriangles: r.all.length,
        evaluatedVertices: r.unique.length,
        loops: r.loops,
        sectionVertices: r.vertices,
        valid: r.valid,
      })),
    }),
    // CPU/native fixture only: prove no omitted triangle enters the section over sampled clips.
    verifyPatch(cut) {
      let missing = 0;
      for (const row of rows) {
        const selected = new Set(row.triangles),
          points = new Map();
        const vertex = (i) => {
          if (!points.has(i)) points.set(i, row.mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(row.mesh.matrixWorld));
          return points.get(i);
        };
        for (const triangle of row.all) {
          if (selected.has(triangle)) continue;
          const ys = triangle.map((i) => vertex(i).y);
          if (Math.min(...ys) < cut && Math.max(...ys) >= cut) missing++;
        }
      }
      return missing;
    },
    dispose() {
      group.removeFromParent();
      for (const row of rows) row.cap.geometry.dispose();
    },
  };
}
