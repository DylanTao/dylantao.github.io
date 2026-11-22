import * as THREE from "../three.module.min.js";

const candidates = [
  [3.39, 6.61],
  [3.55, 7.35],
  [3.33, 5.8],
  [2.9, 4.48],
];
const halfWidth = 0.29;
const swingLimit = 0.3;

function supportMeshes(world) {
  const meshes = [];
  world.updateWorldMatrix(true, true);
  world.traverseVisible((object) => {
    if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh || object.userData.noOcclusion || !object.geometry) return;
    if (object.material.transparent || object.material.colorWrite === false) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
    if (box.max.x < 2.35 || box.min.x > 4.11 || box.max.z < 2.7 || box.min.z > 9.2) return;
    meshes.push(object);
  });
  return meshes;
}

export function findThermalSwing(world) {
  const meshes = supportMeshes(world);
  const up = new THREE.Vector3(0, 1, 0);
  const down = new THREE.Vector3(0, -1, 0);
  const ray = new THREE.Raycaster();
  const cast = (x, y, z, direction, max) => {
    ray.set(new THREE.Vector3(x, y, z), direction);
    ray.far = max;
    return ray.intersectObjects(meshes, false)[0];
  };
  for (const [x, z] of candidates) {
    const anchors = [-1, 1].map((side) => cast(x + side * halfWidth, 1.15, z, up, 3.55));
    if (anchors.some((hit) => !hit?.face || hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y > -0.68)) continue;
    const points = anchors.map((hit) => hit.point);
    if (Math.abs(points[0].y - points[1].y) > 0.14) continue;
    const floor = cast(x, 0.9, z, down, 1.37);
    if (!floor || floor.point.y > 0.14) continue;
    const centre = new THREE.Vector3(x, floor.point.y + 0.51, z);
    const length = (points[0].y + points[1].y) / 2 - centre.y - 0.042;
    if (length < 1.25) continue;
    const travel = length * Math.sin(swingLimit) + 0.21;
    // A three-height sweep includes the board's travel and the occupied zone.
    let blocked = false;
    for (const sx of [x - halfWidth, x, x + halfWidth]) {
      for (const lift of [0, 0.32, 0.63]) {
        const across = new THREE.Vector3(0, 0, 1);
        if (cast(sx, centre.y + lift, z - travel, across, 2 * travel)) blocked = true;
        if (cast(sx, centre.y + lift, z + travel, across.negate(), 2 * travel)) blocked = true;
      }
    }
    if (!blocked) return { centre, anchors: points, length, supports: anchors.map((hit) => hit.object.name) };
  }
  return null;
}

export function createThermalSwing(parent, support) {
  const { centre, length, anchors } = support;
  const root = new THREE.Group();
  root.name = "Thermal rope swing";
  const oak = new THREE.MeshStandardMaterial({ color: 0xba8353, name: "thermal swing walnut" });
  const hemp = new THREE.MeshStandardMaterial({ color: 0xd6b47e, name: "thermal swing hemp" });
  const brass = new THREE.MeshStandardMaterial({ color: 0x9d7848, name: "thermal swing brass" });
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.055, 0.37), oak);
  board.name = "Thermal swing seat";
  root.add(board);
  const ropes = anchors.map((anchor) => {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.043, 0.08, 12), brass);
    pin.position.copy(anchor).y -= 0.026;
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.014, 1, 9), hemp);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.029, 12, 8), hemp);
    root.add(pin, rope, knot);
    return { rope, knot };
  });
  parent.add(root);
  const up = new THREE.Vector3(0, 1, 0);
  const span = new THREE.Vector3();
  let angle = 0;
  let angularVelocity = 0;

  function compose() {
    board.position.copy(centre);
    board.position.z += length * Math.sin(angle);
    board.position.y += length * (1 - Math.cos(angle));
    board.rotation.x = -angle;
    for (let i = 0; i < ropes.length; i++) {
      const { rope, knot } = ropes[i];
      knot.position
        .set((i ? 1 : -1) * halfWidth, 0.042, 0)
        .applyEuler(board.rotation)
        .add(board.position);
      span.subVectors(anchors[i], knot.position);
      rope.position.copy(knot.position).addScaledVector(span, 0.5);
      rope.scale.y = span.length();
      rope.quaternion.setFromUnitVectors(up, span.normalize());
    }
  }
  compose();
  return {
    centre,
    root,
    push(still = false) {
      if (still) {
        angle = swingLimit * 0.78;
        angularVelocity = 0;
        compose();
      } else angularVelocity = Math.min(angularVelocity + 0.62, 0.66);
    },
    update(dt) {
      if (!dt) return;
      const steps = Math.max(1, Math.ceil(dt * 90));
      const step = dt / steps;
      for (let i = 0; i < steps; i++) {
        angularVelocity += ((-9.81 / length) * Math.sin(angle) - angularVelocity * 0.44) * step;
        angle += angularVelocity * step;
        if (Math.abs(angle) > swingLimit) {
          angle = Math.sign(angle) * swingLimit;
          angularVelocity *= -0.16;
        }
      }
      compose();
    },
    evidence() {
      return { angle, seat: board.position.toArray(), anchors: anchors.map((point) => point.toArray()), supports: support.supports };
    },
    dispose() {
      root.removeFromParent();
      root.traverse((object) => object.geometry?.dispose());
      oak.dispose();
      hemp.dispose();
      brass.dispose();
    },
  };
}
