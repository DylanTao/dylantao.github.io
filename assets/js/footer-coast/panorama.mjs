import * as THREE from "../three.module.min.js";

// Extend only the outer terrain. The wide-screen architecture is authored in
// Blender alongside the central neighborhood, with the same material batches.
export function extendCoast(model) {
  const geometries = new Set();
  model.updateMatrixWorld(true);
  const terrain = model.getObjectByName("Coast");
  const point = new THREE.Vector3();
  terrain?.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry.clone();
    geometries.add(geometry);
    const positions = geometry.attributes.position;
    const inverse = object.matrixWorld.clone().invert();
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      if (Math.abs(point.x) > 20) point.x = Math.sign(point.x) * (20 + (Math.abs(point.x) - 20) * 4);
      point.applyMatrix4(inverse);
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    object.geometry = geometry;
  });

  return () => geometries.forEach((geometry) => geometry.dispose());
}
