import * as THREE from "../three.module.min.js";

// Extend the authored coast, sharing its materials and house geometry. The
// central neighborhood stays at its original scale and location.
export function extendCoast(model) {
  const geometries = new Set();
  const materials = new Map();
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    for (const material of [object.material].flat().filter(Boolean)) materials.set(material.name, material);
  });
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

  const wings = new THREE.Group();
  wings.name = "CoastalPanorama";
  const foliage = materials.get("Palm frond");
  const bark = materials.get("Warm oak");
  const stone = materials.get("Sandstone stratum 2");
  const rock = new THREE.IcosahedronGeometry(1, 1);
  const trunk = new THREE.CylinderGeometry(0.1, 0.18, 1, 7);
  geometries.add(rock);
  geometries.add(trunk);
  const add = (geometry, material, position, scale, parent = wings) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  for (const [x, z, height] of [
    [-25, -2.3, 3.6],
    [-32, -2.6, 3.1],
    [27, -2.8, 3.4],
    [38, -3, 3.8],
    [-48, -2.4, 3.5],
    [53, -2.8, 3.3],
  ]) {
    const pine = new THREE.Group();
    pine.name = "TorreyPine";
    pine.position.set(x, 0.9, z);
    add(trunk, bark, [0, height / 2, 0], [1, height, 1], pine).rotation.z = -0.12;
    for (const [dx, dy, dz, size] of [
      [-0.7, 0, 0, 1.25],
      [0.55, 0.15, 0.1, 1.2],
      [0, 0.35, -0.55, 1.1],
    ]) {
      add(rock, foliage, [dx + 0.3, height + dy, dz], [size, 0.4, size * 0.8], pine);
    }
    wings.add(pine);
  }
  for (const [x, z, size] of [
    [-23, 2.2, 0.65],
    [-28, 1.6, 1],
    [-37, 2, 0.85],
    [25, 2.3, 0.6],
    [33, 1.7, 0.9],
    [44, 2.1, 1.1],
    [-52, 2.2, 1],
  ]) {
    add(rock, stone, [x, 0.18, z], [size * 1.5, size * 0.55, size]);
    add(rock, stone, [x + 1.2, 0.1, z + 0.4], [size * 0.8, size * 0.3, size * 0.65]);
  }
  for (const [name, x, z, scale] of [
    ["CasitaCream", -37, -2.5, 0.85],
    ["CasitaApricot", 31, -2.2, 0.9],
    ["CasitaRose", 47, -2.6, 0.8],
  ]) {
    const source = model.getObjectByName(name);
    if (!source) continue;
    const house = source.clone(true);
    house.name = `${name}Panorama`;
    house.scale.multiplyScalar(scale);
    const bounds = new THREE.Box3().setFromObject(house);
    const center = bounds.getCenter(new THREE.Vector3());
    house.position.add(new THREE.Vector3(x - center.x, 0.9 - bounds.min.y, z - center.z));
    wings.add(house);
  }
  model.add(wings);
  return () => geometries.forEach((geometry) => geometry.dispose());
}
