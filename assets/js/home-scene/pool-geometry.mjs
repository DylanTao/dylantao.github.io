import * as THREE from "../three.module.min.js";

// Measure the native basin once at load time. The shallow solver needs a flat
// bottom; five agreeing interior hits keep a wall or nearby furnishing from
// silently becoming that bottom. No collision scan runs in the animation loop.
export function measurePoolGeometry(water, room) {
  room.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(water, true),
    center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3()),
    radius = Math.min(size.x, size.z) / 2,
    surfaceY = bounds.max.y,
    receivers = [];
  room.traverse((o) => {
    if (!o.isMesh || o === water || o.userData.outline) return;
    let visible = true;
    for (let parent = o; parent; parent = parent.parent) visible &&= parent.visible;
    if (visible && [o.material].flat().some((m) => !m.transparent || m.opacity >= 0.9)) receivers.push(o);
  });
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 1),
    hits = [];
  for (const [x, z] of [
    [0, 0],
    [0.36, 0],
    [-0.36, 0],
    [0, 0.36],
    [0, -0.36],
  ]) {
    ray.ray.origin.set(center.x + x * radius, surfaceY - 0.003, center.z + z * radius);
    const hit = ray.intersectObjects(receivers, false)[0];
    if (hit) hits.push(hit.point.y);
  }
  const flat = hits.length === 5 && Math.max(...hits) - Math.min(...hits) < 0.02,
    bottomY = flat ? [...hits].sort((a, b) => a - b)[2] : null,
    measured = bottomY === null ? null : surfaceY - bottomY,
    valid = measured !== null && measured >= 0.02 && measured <= 1;
  return {
    center: [center.x, center.z],
    surfaceY,
    radius,
    depth: valid ? measured : 0.24,
    bottomY: valid ? bottomY : null,
    depthSource: valid ? "five native basin ray hits" : "illustrative fallback; flat receiver not resolved",
  };
}
