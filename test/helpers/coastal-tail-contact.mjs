import assert from "node:assert/strict";

// Part selection is followed by actual deformed GLB vertices and triangles.
// Every tail root vertex participates; there is no attachment-distance ignore.
export function tailVertexIndices(mesh) {
  if (!mesh.isSkinnedMesh || mesh.userData.tailPortTrial) return [];
  if (mesh.userData.tailArticulation?.version === 1) return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => i);
  if (mesh.userData.tailCorrective?.version === 1) return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => i);
  const ids = mesh.geometry.attributes.skinIndex,
    weights = mesh.geometry.attributes.skinWeight,
    result = [];
  for (let i = 0; i < ids.count; i++) {
    let influence = 0;
    for (let k = 0; k < 4; k++) if (/^Tail/.test(mesh.skeleton.bones[ids.getComponent(i, k)].name)) influence += weights.getComponent(i, k);
    if (influence > 0) result.push(i);
  }
  return result;
}

export function createTailObstacleProbe(THREE, room) {
  room.updateMatrixWorld(true);
  const cloth = room.getObjectByName("sleep_duvet_empty"),
    hard = [];
  room.traverse((mesh) => {
    if (!mesh.isMesh || !/^(sleep__|sleep_reno_wardrobe__)/.test(mesh.name)) return;
    if (/linen|olive[ _]leaf|terracotta/i.test(mesh.name)) return;
    hard.push({ mesh, box: new THREE.Box3().setFromObject(mesh) });
  });
  assert.ok(cloth?.isMesh, "actual decoded made cover is required");
  assert.ok(hard.length >= 3 && hard.some(({ mesh }) => /^sleep__/.test(mesh.name)), "actual material-batched hard bed surfaces are required");
  const solids = [...hard, { mesh: cloth, box: new THREE.Box3().setFromObject(cloth), soft: true }];
  for (const { mesh } of solids) for (const material of [].concat(mesh.material)) material.side = THREE.DoubleSide;
  const ray = new THREE.Raycaster(),
    directions = [
      [1, 0.317, 0.131],
      [0.193, 1, 0.413],
      [0.271, 0.157, 1],
    ].map((v) => new THREE.Vector3(...v).normalize());
  // Exact decoded triangles, accelerated for the 249-phase sweep. Keep the
  // independent Three.js raycaster below for regression readback.
  function triangleTree(mesh) {
    const geometry = mesh.geometry,
      index = geometry.index,
      triangles = [];
    for (let i = 0; i < (index?.count || geometry.attributes.position.count); i += 3) {
      const points = [0, 1, 2].map((k) =>
        new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, index ? index.getX(i + k) : i + k).applyMatrix4(mesh.matrixWorld)
      );
      const box = new THREE.Box3().setFromPoints(points);
      triangles.push({ points, box, center: box.getCenter(new THREE.Vector3()) });
    }
    function build(items) {
      const box = new THREE.Box3();
      for (const item of items) box.union(item.box);
      if (items.length <= 12) return { box, items };
      const size = box.getSize(new THREE.Vector3()),
        axis = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";
      items.sort((a, b) => a.center[axis] - b.center[axis]);
      const mid = items.length >> 1;
      return { box, left: build(items.slice(0, mid)), right: build(items.slice(mid)) };
    }
    return { root: build(triangles), triangles: triangles.length };
  }
  const trees = new Map(solids.map(({ mesh }) => [mesh, triangleTree(mesh)])),
    hitPoint = new THREE.Vector3();
  function acceleratedHits(point, direction, mesh) {
    ray.set(point, direction);
    const hits = [],
      stack = [trees.get(mesh).root];
    while (stack.length) {
      const node = stack.pop();
      if (!ray.ray.intersectsBox(node.box)) continue;
      if (node.items) {
        for (const { points } of node.items) if (ray.ray.intersectTriangle(...points, false, hitPoint)) hits.push(hitPoint.distanceTo(point));
      } else stack.push(node.left, node.right);
    }
    return hits.sort((a, b) => a - b);
  }
  function parity(distances) {
    let count = 0,
      last = -1;
    for (const distance of distances)
      if (distance - last > 1e-5) {
        last = distance;
        count++;
      }
    return count % 2;
  }
  function inside(point, mesh) {
    let votes = 0;
    for (const direction of directions) votes += parity(acceleratedHits(point, direction, mesh));
    return votes >= 2;
  }
  function referenceInside(point, mesh) {
    let votes = 0;
    for (const direction of directions) {
      ray.set(point, direction);
      votes += parity(ray.intersectObject(mesh, false).map((hit) => hit.distance));
    }
    return votes >= 2;
  }
  function pointHits(point, { soft = true } = {}) {
    return solids.filter((solid) => (soft || !solid.soft) && solid.box.containsPoint(point) && inside(point, solid.mesh));
  }
  function probeTail(actor, { triangleCentroids = true, maxWitnesses = 4 } = {}) {
    actor.updateMatrixWorld(true);
    const result = { vertices: 0, triangleCentroids: 0, hard: 0, soft: 0, witnesses: [] };
    actor.traverse((mesh) => {
      const indices = tailVertexIndices(mesh);
      if (!indices.length) return;
      const points = new Map(indices.map((i) => [i, mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)]));
      result.vertices += points.size;
      const surface = [...points].map(([vertex, point]) => ({ vertex, point }));
      if (triangleCentroids) {
        const order = mesh.geometry.index;
        for (let i = 0; i < (order?.count || mesh.geometry.attributes.position.count); i += 3) {
          const face = [0, 1, 2].map((k) => (order ? order.getX(i + k) : i + k));
          if (!face.every((at) => points.has(at))) continue;
          const point = face.reduce((sum, at) => sum.add(points.get(at)), new THREE.Vector3()).multiplyScalar(1 / 3);
          surface.push({ triangle: i / 3, point });
          result.triangleCentroids++;
        }
      }
      for (const sample of surface)
        for (const solid of pointHits(sample.point)) {
          if (solid.soft) result.soft++;
          else result.hard++;
          if (result.witnesses.length < maxWitnesses)
            result.witnesses.push({
              mesh: mesh.name,
              vertex: sample.vertex,
              triangle: sample.triangle,
              obstacle: solid.mesh.name,
              position: sample.point.toArray(),
            });
        }
    });
    assert.ok(result.vertices > 0, "actual tail geometry must be present");
    return result;
  }
  return {
    hardMeshes: hard.map(({ mesh }) => mesh.name),
    triangleCounts: Object.fromEntries(solids.map(({ mesh }) => [mesh.name, trees.get(mesh).triangles])),
    probeTail,
    pointHits,
    referencePointHits: (point) => solids.filter((solid) => solid.box.containsPoint(point) && referenceInside(point, solid.mesh)),
  };
}

export function assertTailClearance(receipt) {
  assert.equal(receipt.maxTailHard, 0, "tail intersects actual hard furniture");
  assert.equal(receipt.maxTailSoft, 0, "tail intersects the actual made-cover volume");
}
