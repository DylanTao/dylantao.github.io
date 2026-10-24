import * as THREE from "../three.module.min.js";

// The two landward thresholds are real sliding leaves. Their frame stays static; the leaf
// opens before a walking capsule arrives and cannot close on that capsule. They are excluded
// from the static walk map, like the existing facade leaves, rather than leaving a voxel wall
// behind after the visible leaf has moved into its pocket.
export function nearDoor(bounds, pose, radius = 2.8) {
  if (!pose?.active || !pose.position?.every(Number.isFinite)) return false;
  const [x, foot, z] = pose.position;
  if (Math.abs(foot - bounds.min.y) > 1) return false;
  const dx = Math.max(bounds.min.x - x, 0, x - bounds.max.x);
  const dz = Math.max(bounds.min.z - z, 0, z - bounds.max.z);
  return dx * dx + dz * dz <= radius * radius;
}

export function createEstateDoors(root, definitions = []) {
  const configured = new Map((Array.isArray(definitions) ? definitions : Object.values(definitions)).map((entry) => [entry.id, entry]));
  const groups = new Map();
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!object.userData.estateDoor) return;
    const id = object.userData.estateDoor;
    const entry = configured.get(id) || {};
    const slide = entry.slideX ?? object.userData.slideX ?? object.userData.estateSlideX;
    if (!Number.isFinite(slide) || Math.abs(slide) < 0.5) throw new RangeError(`Missing pocket travel for estate door ${id}`);
    if (!groups.has(id))
      groups.set(id, {
        id,
        parts: [],
        bounds: new THREE.Box3(),
        slide,
        fraction: 0,
        target: 0,
        radius: entry.openRadius ?? entry.activationDistance ?? 2.8,
      });
    const door = groups.get(id);
    door.parts.push({ object, rest: object.position.clone() });
    door.bounds.union(new THREE.Box3().setFromObject(object));
    object.userData.dynamic = true;
  });
  const doors = [...groups.values()];
  let disposed = false;
  return {
    objects: doors.flatMap((door) => door.parts.map((part) => part.object)),
    update(dt, { walk = null, reduced = false } = {}) {
      if (disposed) return false;
      let changed = false;
      for (const door of doors) {
        // Hysteresis prevents a visitor lingering at the sensor boundary from cycling the leaf.
        const near = nearDoor(door.bounds, walk, door.radius + (door.target ? 0.5 : 0));
        door.target = near ? 1 : 0;
        const before = door.fraction;
        const step = Math.max(0, Number.isFinite(dt) ? dt : 0) / 0.6;
        door.fraction = reduced ? door.target : THREE.MathUtils.clamp(door.target, before - step, before + step);
        if (door.fraction === before) continue;
        changed = true;
        const smooth = door.fraction * door.fraction * (3 - 2 * door.fraction);
        for (const { object, rest } of door.parts) {
          object.position.copy(rest);
          object.position.x += door.slide * smooth;
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
      })),
      automatic: true,
      motionSeconds: 0.6,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const door of doors) {
        for (const { object, rest } of door.parts) {
          object.position.copy(rest);
          object.updateMatrix();
          object.updateMatrixWorld(true);
        }
      }
    },
  };
}
