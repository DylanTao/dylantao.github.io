import assert from "node:assert/strict";
import { tailVertexIndices } from "./coastal-tail-contact.mjs";
import { createTriangleParity } from "./coastal-triangle-parity.mjs";

// Complete actual posed skins; no proxy volume or root-distance exclusion.
export function probeTailAgainstBody(THREE, actor, { triangleCentroids = true, verifyWitnesses = false } = {}) {
  actor.updateMatrixWorld(true);
  const solids = [];
  actor.traverse((mesh) => {
    if (!mesh.isSkinnedMesh || tailVertexIndices(mesh).length === mesh.geometry.attributes.position.count) return;
    const material = mesh.material.name.replace(/\.\d{3}$/, "").replaceAll("_", " ");
    const kind = material === "skin" ? "skin" : material === "Sirui shirt" ? "shirt" : material === "charcoal shorts" ? "shorts" : null;
    if (!kind) return;
    const points = new Float64Array(mesh.geometry.attributes.position.count * 3);
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      const point = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      points.set(point.toArray(), i * 3);
    }
    const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(points, 3));
    geometry.setIndex(mesh.geometry.index.clone());
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    const surface = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    surface.updateMatrixWorld(true);
    solids.push({ kind, name: mesh.name, surface, box: geometry.boundingBox, contains: createTriangleParity(THREE, geometry) });
  });
  for (const kind of ["skin", "shirt", "shorts"])
    assert.ok(
      solids.some((solid) => solid.kind === kind),
      `actual ${kind} geometry is required`
    );
  function inside(point, solid) {
    return solid.contains(point);
  }
  const result = {
    vertices: 0,
    triangleCentroids: 0,
    skin: 0,
    shirt: 0,
    shorts: 0,
    witnesses: [],
    solids: solids.map(({ kind, name, surface }) => ({ kind, name, triangles: surface.geometry.index.count / 3 })),
  };
  actor.traverse((mesh) => {
    const indices = tailVertexIndices(mesh);
    if (!indices.length) return;
    const points = new Map(indices.map((i) => [i, mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)]));
    const probes = [...points].map(([vertex, point]) => ({ vertex, point }));
    result.vertices += points.size;
    if (triangleCentroids)
      for (let i = 0; i < mesh.geometry.index.count; i += 3) {
        const face = [0, 1, 2].map((k) => mesh.geometry.index.getX(i + k));
        if (!face.every((i) => points.has(i))) continue;
        probes.push({ triangle: i / 3, point: face.reduce((sum, i) => sum.add(points.get(i)), new THREE.Vector3()).multiplyScalar(1 / 3) });
        result.triangleCentroids++;
      }
    for (const probe of probes)
      for (const solid of solids)
        if (inside(probe.point, solid)) {
          result[solid.kind]++;
          if (result.witnesses.filter((w) => w.kind === solid.kind).length < 4) {
            if (verifyWitnesses) {
              const ray = new THREE.Raycaster();
              let votes = 0;
              for (const values of [
                [1, 0.317, 0.131],
                [0.193, 1, 0.413],
                [0.271, 0.157, 1],
              ]) {
                ray.set(probe.point, new THREE.Vector3(...values).normalize());
                let count = 0,
                  last = -1;
                for (const hit of ray.intersectObject(solid.surface, false))
                  if (hit.distance - last > 1e-5) {
                    last = hit.distance;
                    count++;
                  }
                votes += count % 2;
              }
              assert.ok(votes >= 2, "accelerated actual-body witness agrees with independent Three.js raycasting");
            }
            result.witnesses.push({
              kind: solid.kind,
              obstacle: solid.name,
              vertex: probe.vertex,
              triangle: probe.triangle,
              position: probe.point.toArray(),
            });
          }
        }
  });
  for (const { surface } of solids) {
    surface.geometry.dispose();
    surface.material.dispose();
  }
  assert.ok(result.vertices > 0, "actual tail geometry is required");
  return result;
}

export function assertTailBodyClearance(receipt) {
  for (const kind of ["skin", "shirt", "shorts"]) assert.equal(receipt[kind], 0, `tail intersects actual ${kind}`);
}
