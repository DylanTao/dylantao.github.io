import * as THREE from "../three.module.min.js";

/** Exact triangle subsets for short visibility segments in one bounded region.
 * The proxies share immutable positions/materials, never enter the rendered
 * world and exist only for the selection. Triangle AABBs conservatively include
 * large crossing faces; this is spatial culling, not simplified coast geometry.
 */
export function createOcclusionRegion(objects, worldBounds) {
  const proxies = [],
    owned = [],
    inverse = new THREE.Matrix4(),
    localBounds = new THREE.Box3(),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    triangleBounds = new THREE.Box3();
  let sourceTriangles = 0,
    retainedTriangles = 0;
  for (const object of objects) {
    // Batched/instanced/skinned and custom no-pick meshes have their own
    // intersection semantics; a plain Mesh proxy cannot reproduce them.
    if (object.isSkinnedMesh || object.isInstancedMesh || object.raycast !== THREE.Mesh.prototype.raycast) {
      proxies.push(object);
      continue;
    }
    const source = object.geometry,
      positions = source.getAttribute("position");
    if (!positions) continue;
    // Keep deforming and small meshes on Three's original, correct raycast.
    const count = source.index?.count ?? positions.count;
    if (Object.keys(source.morphAttributes).length || count < 6000) {
      proxies.push(object);
      continue;
    }
    inverse.copy(object.matrixWorld).invert();
    localBounds.copy(worldBounds).applyMatrix4(inverse);
    if (!source.boundingBox) source.computeBoundingBox();
    if (!localBounds.intersectsBox(source.boundingBox)) continue;
    const index = source.index,
      indices = [],
      groups = Array.isArray(object.material) ? source.groups : [{ start: 0, count, materialIndex: 0 }],
      geometry = new THREE.BufferGeometry(),
      bounds = new THREE.Box3();
    geometry.setAttribute("position", positions);
    for (const group of groups) {
      const start = Math.max(group.start, source.drawRange.start),
        end = Math.min(group.start + group.count, source.drawRange.start + source.drawRange.count, count),
        retainedStart = indices.length;
      for (let i = start; i + 2 < end; i += 3) {
        const ia = index ? index.getX(i) : i,
          ib = index ? index.getX(i + 1) : i + 1,
          ic = index ? index.getX(i + 2) : i + 2;
        a.fromBufferAttribute(positions, ia);
        b.fromBufferAttribute(positions, ib);
        c.fromBufferAttribute(positions, ic);
        sourceTriangles++;
        triangleBounds.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c);
        if (!localBounds.intersectsBox(triangleBounds)) continue;
        indices.push(ia, ib, ic);
        bounds.union(triangleBounds);
      }
      if (indices.length > retainedStart) geometry.addGroup(retainedStart, indices.length - retainedStart, group.materialIndex);
    }
    if (!indices.length) {
      geometry.dispose();
      continue;
    }
    geometry.setIndex(indices);
    geometry.boundingBox = bounds;
    geometry.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
    const proxy = new THREE.Mesh(geometry, object.material);
    proxy.matrixAutoUpdate = false;
    proxy.matrixWorld.copy(object.matrixWorld);
    proxy.layers.mask = object.layers.mask;
    proxy.name = object.name;
    proxies.push(proxy);
    owned.push(geometry);
    retainedTriangles += indices.length / 3;
  }
  return {
    objects: proxies,
    evidence: { sourceTriangles, retainedTriangles, proxyMeshes: owned.length },
    dispose() {
      for (const geometry of owned) geometry.dispose();
      owned.length = 0;
      proxies.length = 0;
    },
  };
}
