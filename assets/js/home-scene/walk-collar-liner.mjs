import * as THREE from "../three.module.min.js";

// Close the native shirt's collar opening below the primary-view head clip.
// A short upper-chest liner joins the native neck to the native cloth interior.
// Fit once, retain native edge bindings, then follow only those bounded samples.
// In particular Rick's cloth collar also carries small arm weights.
const COUNT = 64;
const pointKey = (p) => `${Math.round(p.x * 1e5)},${Math.round(p.z * 1e5)}`;
const area = (loop) => Math.abs(THREE.ShapeUtils.area(loop.map((p) => new THREE.Vector2(p.x, p.z))));

function contains(loop, p) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i],
      b = loop[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function contours(triangles, vertex, height) {
  const points = new Map(),
    edges = new Map();
  for (const triangle of triangles) {
    const crossed = [];
    for (let k = 0; k < 3; k++) {
      const a = vertex(triangle[k]),
        b = vertex(triangle[(k + 1) % 3]);
      if ((a.y < height && b.y >= height) || (b.y < height && a.y >= height)) {
        const t = (height - a.y) / (b.y - a.y),
          point = a.clone().lerp(b, t);
        point.sectionBinding = { a: triangle[k], b: triangle[(k + 1) % 3], t };
        crossed.push(point);
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
  const seen = new Set(),
    loops = [];
  let ignoredOpenComponents = 0;
  for (const start of graph.keys()) {
    if (seen.has(start)) continue;
    const component = new Set(),
      queue = [start];
    while (queue.length) {
      const key = queue.pop();
      if (component.has(key)) continue;
      component.add(key);
      queue.push(...[...graph.get(key)].filter((other) => !component.has(other)));
    }
    // A face/mouth can be open at this height (South Park). It is independent of
    // the closed neck component, and must never be welded into the collar.
    if ([...component].some((key) => graph.get(key).size !== 2)) {
      component.forEach((key) => seen.add(key));
      ignoredOpenComponents++;
      continue;
    }
    const loop = [];
    let current = start,
      previous = null;
    do {
      if (seen.has(current)) throw new Error("Native collar section branches");
      seen.add(current);
      loop.push(points.get(current));
      const next = [...graph.get(current)].find((key) => key !== previous);
      previous = current;
      current = next;
    } while (current !== start);
    if (loop.length >= 3) loops.push(loop);
  }
  return { loops, ignoredOpenComponents };
}

function ring(mesh, height, axis, { fullScan = false } = {}) {
  const indices = mesh.geometry.index,
    triangles = [],
    vertices = new Map();
  const position = mesh.geometry.attributes.position,
    e = mesh.matrixWorld.elements,
    restY = new Float32Array(position.count);
  // Source composition has already restored idle0. Select a guarded 5mm bind-space
  // band before doing expensive skinning; the fixture compares it with a full scan.
  for (let i = 0; i < position.count; i++) restY[i] = e[1] * position.getX(i) + e[5] * position.getY(i) + e[9] * position.getZ(i) + e[13];
  const get = (i) => {
    if (!vertices.has(i)) vertices.set(i, mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
    return vertices.get(i);
  };
  for (let i = 0; i < indices.count; i += 3) {
    const a = indices.getX(i),
      b = indices.getX(i + 1),
      c = indices.getX(i + 2);
    if (fullScan || (Math.min(restY[a], restY[b], restY[c]) <= height + 0.005 && Math.max(restY[a], restY[b], restY[c]) >= height - 0.005))
      triangles.push([a, b, c]);
  }
  const section = contours(triangles, get, height);
  const loops = section.loops.filter((loop) => contains(loop, axis));
  if (!loops.length) throw new Error(`No closed central native collar section for ${mesh.material.name}`);
  const loop = loops.sort((a, b) => area(a) - area(b))[0];
  const bounds = new THREE.Box3().setFromPoints(loop),
    size = bounds.getSize(new THREE.Vector3());
  if (size.x < 0.07 || size.x > 0.5 || size.z < 0.05 || size.z > 0.35)
    throw new Error(`Native collar section is outside the measured anatomical envelope: ${mesh.material.name}`);
  return {
    loop,
    evaluatedVertices: vertices.size,
    sourceTriangles: indices.count / 3,
    selectedTriangles: triangles.length,
    ignoredOpenComponents: section.ignoredOpenComponents,
  };
}

function resample(loop) {
  const points = [...loop];
  if (THREE.ShapeUtils.isClockWise(points.map((p) => new THREE.Vector2(p.x, p.z)))) points.reverse();
  const centre = new THREE.Vector3();
  points.forEach((p) => centre.add(p));
  centre.multiplyScalar(1 / points.length);
  let start = 0;
  for (let i = 1; i < points.length; i++)
    if (
      Math.abs(Math.atan2(points[i].z - centre.z, points[i].x - centre.x)) <
      Math.abs(Math.atan2(points[start].z - centre.z, points[start].x - centre.x))
    )
      start = i;
  const ordered = [...points.slice(start), ...points.slice(0, start)],
    cumulative = [0];
  for (let i = 0; i < ordered.length; i++) cumulative.push(cumulative.at(-1) + ordered[i].distanceTo(ordered[(i + 1) % ordered.length]));
  const sampled = [];
  for (let k = 0, i = 0; k < COUNT; k++) {
    const distance = (cumulative.at(-1) * k) / COUNT;
    while (cumulative[i + 1] < distance) i++;
    const blend = (distance - cumulative[i]) / (cumulative[i + 1] - cumulative[i]);
    sampled.push({
      point: ordered[i].clone().lerp(ordered[(i + 1) % ordered.length], blend),
      a: ordered[i].sectionBinding,
      b: ordered[(i + 1) % ordered.length].sectionBinding,
      blend,
    });
  }
  return sampled;
}

export function createWalkCollarLiner(body, cutHeight, options = {}) {
  const started = performance.now(),
    height = cutHeight - 0.04,
    meshes = [];
  body.updateWorldMatrix(true, false);
  body.updateMatrixWorld(true);
  body.traverse((mesh) => {
    if (mesh.isSkinnedMesh) meshes.push(mesh);
  });
  const shirt = meshes.find((m) => m.material.name === "Sirui shirt"),
    spine = body.getObjectByName("Spine"),
    head = body.getObjectByName("Head");
  if (!shirt || !spine || !head) throw new Error("The native collar, neck and Spine must all be present");
  // Upper end overlaps the real neck; the lower end sits inside the shirt wall.
  const upperHeight = height - 0.01,
    lowerHeight = height - 0.055;
  const axis = head?.getWorldPosition(new THREE.Vector3()) || new THREE.Vector3(0, height, 0);
  let skin, upperSection;
  for (const mesh of meshes.filter((m) => m.material.name === "skin")) {
    // A morph primitive can have a raw box below the neck while its posed eyelids
    // are above it. Require the actual closed central section, not its raw bounds.
    try {
      upperSection = ring(mesh, upperHeight, axis, options);
      skin = mesh;
      break;
    } catch {
      /* Try the next native skin primitive. */
    }
  }
  if (!skin) throw new Error("No closed central native neck section");
  const lowerSection = ring(shirt, lowerHeight, axis, options);
  const upper = resample(upperSection.loop),
    lower = resample(lowerSection.loop);
  const positions = new Float32Array(COUNT * 5 * 3),
    indices = [],
    rows = 5;
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < COUNT; i++) {
      const a = j * COUNT + i,
        b = j * COUNT + ((i + 1) % COUNT),
        c = a + COUNT,
        d = b + COUNT;
      indices.push(a, b, c, b, d, c);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(positions.length).fill(1), 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  geometry.setIndex(indices);
  const group = new THREE.Group(),
    liner = new THREE.Mesh(geometry, skin.material);
  group.name = "primary-collar-liner";
  group.visible = false;
  liner.name = "primary-native-collar-liner";
  liner.castShadow = false;
  liner.receiveShadow = true;
  for (const node of [group, liner]) node.userData.walkCollarLiner = node.userData.noVolumeDepth = node.userData.noContactOcclusion = true;
  liner.frustumCulled = false;
  group.add(liner);
  body.add(group);
  const inverse = new THREE.Matrix4(),
    point = new THREE.Vector3(),
    temporary = new THREE.Vector3();
  const uc = new THREE.Vector3(),
    lc = new THREE.Vector3();
  const tracked = [
    { mesh: skin, samples: upper },
    { mesh: shirt, samples: lower },
  ].map((row) => ({
    ...row,
    vertices: new Map([...new Set(row.samples.flatMap((s) => [s.a.a, s.a.b, s.b.a, s.b.b]))].map((i) => [i, new THREE.Vector3()])),
  }));
  let updates = 0,
    totalMs = 0,
    maximumMs = 0,
    maximumInset = 0;
  function update() {
    const start = performance.now();
    // SkinnedMesh.updateMatrixWorld also refreshes its attached bind inverse.
    // Object3D.updateWorldMatrix alone would double-translate posed CPU vertices.
    body.updateWorldMatrix(true, false);
    body.updateMatrixWorld(true);
    inverse.copy(body.matrixWorld).invert();
    for (const row of tracked) {
      for (const [i, p] of row.vertices) row.mesh.getVertexPosition(i, p).applyMatrix4(row.mesh.matrixWorld);
      for (const s of row.samples) {
        s.point.copy(row.vertices.get(s.a.a)).lerp(row.vertices.get(s.a.b), s.a.t);
        temporary.copy(row.vertices.get(s.b.a)).lerp(row.vertices.get(s.b.b), s.b.t);
        s.point.lerp(temporary, s.blend);
      }
    }
    uc.set(0, 0, 0);
    lc.set(0, 0, 0);
    for (let i = 0; i < COUNT; i++) {
      uc.add(upper[i].point);
      lc.add(lower[i].point);
    }
    uc.multiplyScalar(1 / COUNT);
    lc.multiplyScalar(1 / COUNT);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < COUNT; i++) {
        const t = j / (rows - 1),
          u = upper[i].point,
          l = lower[i].point;
        const ux = uc.x + (u.x - uc.x) * 0.99,
          uz = uc.z + (u.z - uc.z) * 0.99;
        const lx = lc.x + (l.x - lc.x) * 1.015,
          lz = lc.z + (l.z - lc.z) * 1.015;
        point.set(THREE.MathUtils.lerp(lx, ux, t), THREE.MathUtils.lerp(l.y, u.y, t * t), THREE.MathUtils.lerp(lz, uz, t)).applyMatrix4(inverse);
        geometry.attributes.position.setXYZ(j * COUNT + i, point.x, point.y, point.z);
        maximumInset = Math.max(maximumInset, Math.hypot(ux - u.x, uz - u.z), Math.hypot(lx - l.x, lz - l.z));
      }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    liner.material = skin.material;
    const ms = performance.now() - start;
    updates++;
    totalMs += ms;
    maximumMs = Math.max(maximumMs, ms);
  }
  try {
    update();
  } catch (error) {
    group.removeFromParent();
    geometry.dispose();
    throw error;
  }
  const normals = geometry.attributes.normal;
  let vertical = 0;
  for (let i = 0; i < normals.count; i++) vertical += normals.getY(i);
  if (vertical < 0) {
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  }
  const setupMs = performance.now() - started;
  return {
    group,
    update,
    syncMaterial() {
      liner.material = skin.material;
    },
    evidence: () => ({
      method: "native neck-to-collar upper-chest liner",
      setupMs,
      updates,
      perFrameCuts: 0,
      meanMs: totalMs / Math.max(1, updates),
      maximumMs,
      maximumInset,
      trackedVertices: tracked.reduce((sum, r) => sum + r.vertices.size, 0),
      vertices: positions.length / 3,
      triangles: indices.length / 3,
      upperHeight,
      lowerHeight,
      spine: spine.name,
      skinMesh: skin.name,
      shirtMesh: shirt.name,
      upperSection: { ...upperSection, loop: undefined },
      lowerSection: { ...lowerSection, loop: undefined },
    }),
    dispose() {
      group.removeFromParent();
      geometry.dispose();
    },
  };
}
