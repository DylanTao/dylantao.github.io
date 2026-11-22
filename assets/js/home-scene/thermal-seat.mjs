import * as THREE from "../three.module.min.js";

export const THERMAL_CHAIR = "living-eames-lounge";

// An upholstered seat warms under pressure, then cools into the room and
// spreads its heat across the leather. Time here is active scene seconds.
export function createSeatHeat() {
  let occupied = false,
    warmth = 0,
    spread = 0;
  return {
    get occupied() {
      return occupied;
    },
    occupy(value, still = false) {
      occupied = Boolean(value);
      if (occupied && still) warmth = Math.max(warmth, 0.88);
    },
    step(seconds) {
      const dt = Math.max(seconds, 0);
      if (occupied) {
        warmth = 1 - (1 - warmth) * Math.exp(-dt / 1.9);
        spread *= Math.exp(-dt / 1.6);
      } else {
        warmth *= Math.exp(-dt / 9);
        spread = warmth > 0.001 ? 1 - (1 - spread) * Math.exp(-dt / 7) : 0;
      }
    },
    sample() {
      // Diffusion conserves the footprint's integral before passive cooling.
      const radius = Math.sqrt(1 + spread * 1.7);
      return { occupied, warmth, radius, peak: (warmth * 15) / (radius * radius) };
    },
  };
}

export function thermalSeatLeather(mesh, material = mesh?.material) {
  return /^eames leather(?:\b|$)/i.test(material?.name ?? "");
}

// Probe both load-bearing lobes against the actual visible furniture level.
// The chair's delivered item-space seat is [0, .35, -.3233]. The cushion and
// ottoman share leather, so restrict contact to the chair's seat height range.
export function measureThermalSeat(group) {
  if (!group?.visible) return null;
  group.updateWorldMatrix(true, true);
  const probes = [-0.101, 0.101].map((side) => {
    const from = group.localToWorld(new THREE.Vector3(side, 0.62, -0.3233));
    const down = new THREE.Vector3(0, -1, 0).transformDirection(group.matrixWorld);
    const ray = new THREE.Raycaster(from, down, 0.15, 0.42);
    return ray.intersectObject(group, true).find((hit) => {
      if (!thermalSeatLeather(hit.object) || !hit.face) return false;
      for (let object = hit.object; object; object = object.parent) if (!object.visible) return false;
      return hit.face.normal.clone().transformDirection(hit.object.matrixWorld).dot(down) < -0.68;
    });
  });
  if (probes.some((hit) => !hit)) return null;
  const points = probes.map((hit) => hit.point);
  const normals = probes.map((hit) => hit.face.normal.clone().transformDirection(hit.object.matrixWorld));
  return {
    points,
    normals,
    anchor: group,
    centre: points[0].clone().lerp(points[1], 0.5),
    forward: new THREE.Vector3(0, 0, 1).transformDirection(group.matrixWorld),
  };
}
