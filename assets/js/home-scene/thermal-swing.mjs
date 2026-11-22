import * as THREE from "../three.module.min.js";

const candidates = [
  [-1.96, 4.3],
  [-1.86, 4.51],
  [-1.78, 4.35],
];
const halfWidth = 0.29;

function supportMeshes(world) {
  const meshes = [];
  world.updateWorldMatrix(true, true);
  world.traverseVisible((object) => {
    if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh || object.userData.noOcclusion || !object.geometry) return;
    if (object.material.transparent || object.material.colorWrite === false) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
    if (box.max.x < -3.4 || box.min.x > 4.11 || box.max.z < 2.7 || box.min.z > 9.2) return;
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
    const anchors = [-1, 1].map((side) => cast(x + side * halfWidth, 1.15, z, up, 5.4));
    if (anchors.some((hit) => !hit?.face || hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y > -0.68)) continue;
    const points = anchors.map((hit) => hit.point);
    if (Math.abs(points[0].y - points[1].y) > 0.14) continue;
    const floor = cast(x, 0.9, z, down, 1.37);
    if (!floor || floor.point.y > 0.14) continue;
    const centre = new THREE.Vector3(x, floor.point.y + 0.51, z);
    const length = (points[0].y + points[1].y) / 2 - centre.y - 0.042;
    if (length < 1.25) continue;
    const limit = Math.min(0.3, Math.asin(0.58 / length));
    const travel = length * Math.sin(limit) + 0.18;
    // A three-height sweep includes the board's travel and the occupied zone.
    let blocked = false;
    for (const sx of [x - halfWidth, x, x + halfWidth]) {
      for (const lift of [0, 0.32, 0.63]) {
        const across = new THREE.Vector3(0, 0, 1);
        if (cast(sx, centre.y + lift, z - travel, across, 2 * travel)) blocked = true;
        if (cast(sx, centre.y + lift, z + travel, across.negate(), 2 * travel)) blocked = true;
      }
    }
    if (!blocked) {
      const top = points[0].clone().lerp(points[1], 0.5).addScaledVector(down, 0.08);
      const eyes = [
        new THREE.Vector3(x + 2.92, 1.62, z + 3.04),
        new THREE.Vector3(x + 3.89, 1.62, z + 1.71),
        new THREE.Vector3(x + 2.18, 1.72, z + 3.85),
      ];
      const rays = [centre, top, centre.clone().lerp(top, 0.5)];
      const sightlines = eyes.map((eye) =>
        rays.reduce((clear, point) => {
          const direction = point.clone().sub(eye);
          const max = direction.length() - 0.07;
          return clear + Number(!cast(eye.x, eye.y, eye.z, direction.normalize(), max));
        }, 0)
      );
      const eye = eyes[sightlines.indexOf(Math.max(...sightlines))];
      const lower = centre.clone().sub(eye).normalize();
      const upper = top.sub(eye).normalize();
      const target = lower.clone().add(upper).normalize().add(eye);
      const fov = Math.max(58, THREE.MathUtils.radToDeg(lower.angleTo(upper)) * 1.29 + 5.5);
      return { centre, anchors: points, length, limit, eye, target, fov, supports: anchors.map((hit) => hit.object.name) };
    }
  }
  return null;
}

export function createThermalSwing(parent, support) {
  const { centre, length, anchors, limit } = support;
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
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.019, 1, 9), hemp);
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
    view: { eye: support.eye, target: support.target, fov: support.fov },
    root,
    push(still = false) {
      if (still) {
        angle = limit * 0.78;
        angularVelocity = 0;
        compose();
      } else {
        const impulse = Math.sqrt(((2 * 9.81) / length) * (1 - Math.cos(limit)));
        angularVelocity = Math.min(angularVelocity + impulse, impulse);
      }
    },
    update(dt) {
      if (!dt) return;
      const steps = Math.max(1, Math.ceil(dt * 90));
      const step = dt / steps;
      for (let i = 0; i < steps; i++) {
        angularVelocity += ((-9.81 / length) * Math.sin(angle) - angularVelocity * 0.44) * step;
        angle += angularVelocity * step;
        if (Math.abs(angle) > limit) {
          angle = Math.sign(angle) * limit;
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
