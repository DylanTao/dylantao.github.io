import * as THREE from "../three.module.min.js";
import { fitSeatedRoot } from "./character-contacts.mjs";

// Fit the measured proximal skin patch to the surface actually shown in the
// room. A folded duvet is not the bare mattress plane beneath it. This keeps
// zero hidden compression and reports the vertical adjustment for the reach
// and full-skin gates rather than assuming that the center point is enough.
export function fitSeatToSurface({ contact, seat, facing = 0, meshes }) {
  if (!meshes?.length || !contact?.witnesses?.length) throw new TypeError("A seat fit requires the actual support meshes and measured witnesses");
  const root = fitSeatedRoot({ contact, seat, facing }),
    ray = new THREE.Raycaster(),
    direction = new THREE.Vector3(0, -1, 0),
    c = Math.cos(facing),
    s = Math.sin(facing),
    samples = [];
  meshes.forEach((mesh) => mesh.updateWorldMatrix(true, false));
  let y = root[1];
  for (const witness of contact.witnesses) {
    const p = witness.point,
      x = root[0] + c * p[0] + s * p[2],
      z = root[2] - s * p[0] + c * p[2];
    ray.set(new THREE.Vector3(x, seat[1] + 1, z), direction);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) throw new Error("The actual seated skin patch extends beyond its delivered support");
    y = Math.max(y, hit.point.y - p[1]);
    samples.push({ local: [...p], x, z, surfaceY: hit.point.y, mesh: hit.object.name });
  }
  const lift = y - root[1];
  root[1] = y;
  return {
    position: root,
    lift,
    compression: 0,
    method: "highest actual support under measured proximal-patch witnesses",
    samples: samples.map((sample) => ({ ...sample, clearance: y + sample.local[1] - sample.surfaceY })),
  };
}
