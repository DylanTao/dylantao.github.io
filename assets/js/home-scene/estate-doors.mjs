import * as THREE from "../three.module.min.js";

// The authored landward thresholds are real leaves: sliding pocket leaves, or a pivot leaf that
// turns about a vertical axis (the main entrance in the living's back wall). Their frame stays
// static; the leaf opens before a visitor, Sirui or P arrives and cannot close on that occupant.
// They are excluded from the static walk map, like the existing facade leaves, rather than leaving
// a voxel wall behind after the visible leaf has moved into its pocket or turned open.
export function nearDoor(bounds, pose, radius = 2.8) {
  if (!pose?.active || !pose.position?.every(Number.isFinite)) return false;
  const [x, foot, z] = pose.position;
  if (Math.abs(foot - bounds.min.y) > 1) return false;
  const dx = Math.max(bounds.min.x - x, 0, x - bounds.max.x);
  const dz = Math.max(bounds.min.z - z, 0, z - bounds.max.z);
  return dx * dx + dz * dz <= radius * radius;
}

const UP = new THREE.Vector3(0, 1, 0),
  TURN = new THREE.Quaternion();

export function createEstateDoors(root, definitions = []) {
  const configured = new Map((Array.isArray(definitions) ? definitions : Object.values(definitions)).map((entry) => [entry.id, entry]));
  const groups = new Map();
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!object.userData.estateDoor) return;
    const id = object.userData.estateDoor;
    const entry = configured.get(id) || {};
    const pivot = entry.pivot ?? null;
    const slide = pivot ? 0 : (entry.slideX ?? object.userData.slideX ?? object.userData.estateSlideX);
    if (pivot && !(Number.isFinite(pivot.x) && Number.isFinite(pivot.z) && Number.isFinite(pivot.angle) && Math.abs(pivot.angle) >= 0.5))
      throw new RangeError(`Invalid pivot for estate door ${id}`);
    if (!pivot && (!Number.isFinite(slide) || Math.abs(slide) < 0.5)) throw new RangeError(`Missing pocket travel for estate door ${id}`);
    if (!groups.has(id))
      groups.set(id, {
        id,
        parts: [],
        bounds: new THREE.Box3(),
        slide,
        pivot,
        fraction: 0,
        target: 0,
        radius: entry.openRadius ?? entry.activationDistance ?? 2.8,
      });
    const door = groups.get(id);
    // A pivot turns each part about the authored world axis, expressed in that part's parent frame.
    const axis = pivot
      ? object.parent
        ? object.parent.worldToLocal(new THREE.Vector3(pivot.x, 0, pivot.z))
        : new THREE.Vector3(pivot.x, 0, pivot.z)
      : null;
    door.parts.push({ object, rest: object.position.clone(), restQuaternion: object.quaternion.clone(), axis });
    door.bounds.union(new THREE.Box3().setFromObject(object));
    object.userData.dynamic = true;
  });
  const doors = [...groups.values()];
  let disposed = false;
  return {
    objects: doors.flatMap((door) => door.parts.map((part) => part.object)),
    update(dt, { walk = null, visitors = [], reduced = false } = {}) {
      if (disposed) return false;
      let changed = false;
      for (const door of doors) {
        // Hysteresis prevents a visitor lingering at the sensor boundary from cycling the leaf.
        const radius = door.radius + (door.target ? 0.5 : 0);
        const near = nearDoor(door.bounds, walk, radius) || visitors.some((pose) => nearDoor(door.bounds, pose, radius));
        door.target = near ? 1 : 0;
        const before = door.fraction;
        const step = Math.max(0, Number.isFinite(dt) ? dt : 0) / 0.6;
        door.fraction = reduced ? door.target : THREE.MathUtils.clamp(door.target, before - step, before + step);
        if (door.fraction === before) continue;
        changed = true;
        const smooth = door.fraction * door.fraction * (3 - 2 * door.fraction);
        for (const { object, rest, restQuaternion, axis } of door.parts) {
          object.position.copy(rest);
          if (door.pivot) {
            const angle = door.pivot.angle * smooth,
              c = Math.cos(angle),
              s = Math.sin(angle),
              dx = rest.x - axis.x,
              dz = rest.z - axis.z;
            object.position.x = axis.x + dx * c + dz * s;
            object.position.z = axis.z - dx * s + dz * c;
            object.quaternion.copy(restQuaternion).premultiply(TURN.setFromAxisAngle(UP, angle));
          } else object.position.x += door.slide * smooth;
          object.updateMatrix();
          object.updateMatrixWorld(true);
        }
      }
      return changed;
    },
    get moving() {
      return !disposed && doors.some((door) => door.fraction !== door.target);
    },
    evidence: () => ({
      doors: doors.map((door) => ({
        id: door.id,
        fraction: door.fraction,
        open: door.target === 1,
        offset: door.slide * door.fraction ** 2 * (3 - 2 * door.fraction),
        angle: door.pivot ? door.pivot.angle * door.fraction ** 2 * (3 - 2 * door.fraction) : 0,
      })),
      automatic: true,
      motionSeconds: 0.6,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const door of doors) {
        for (const { object, rest, restQuaternion } of door.parts) {
          object.position.copy(rest);
          object.quaternion.copy(restQuaternion);
          object.updateMatrix();
          object.updateMatrixWorld(true);
        }
      }
    },
  };
}
