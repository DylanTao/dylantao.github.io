import * as THREE from "../three.module.min.js";
import { createFurnitureFire } from "./furniture-fire.mjs";

// The bronze fire pan and concealed grille come from Blender. The patio fire
// fits their surveyed seat and uses the same evolving fuel as the living fire.
export function createTerraceHearth(world) {
  const root = new THREE.Group();
  root.name = "Loggia · live hearth";
  root.userData.walk = "through";
  const position = new THREE.Vector3(),
    clip = new THREE.Matrix4(),
    frustum = new THREE.Frustum();
  const extent = new THREE.Sphere(position, 0.83),
    grilles = new Set();
  let fire = null,
    temperature = 19,
    demand = false;
  return {
    bind(object) {
      if (object.userData.radiantSeat && object.isMesh)
        for (const m of [object.material].flat()) if (m.name?.includes("radiator") && m.emissive) grilles.add(m);
      const place = object.userData.terraceFireWorld;
      if (fire || !Array.isArray(place)) return;
      position.fromArray(place);
      root.position.copy(position);
      root.scale.set(1.21, 1.04, 1);
      root.position.y -= 0.81 * root.scale.y;
      root.rotation.y = 0.67;
      world.add(root);
      fire = createFurnitureFire(root, { name: "Terrace hearth", breeze: 0.85 });
    },
    update(camera, seconds, dt, minute, daylight, still, look) {
      if (!fire) return;
      const near = camera.position.distanceToSquared(position) < 18 * 18;
      frustum.setFromProjectionMatrix(clip.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const visible = near && frustum.intersectsSphere(extent);
      root.visible = visible;
      const evening = minute >= 990 && minute <= 1410;
      demand = evening || (near && daylight < 0.52 && minute >= 380);
      // Mild warmth stored in the seating persists when someone leaves.
      // The recessed grille has a faint pilot; its warmth casts no red wash.
      const target = demand ? 32 : 18;
      temperature = still ? target : temperature + (target - temperature) * -Math.expm1(-Math.min(dt, 0.25) / 24);
      for (const material of grilles) {
        material.emissive.setRGB(0.16, 0.068, 0.019);
        material.emissiveIntensity = 0.11 * Math.max(0, (temperature - 18) / 14);
      }
      fire.update(seconds, { reduced: still, visible, look });
    },
    evidence: () => fire && { ...fire.evidence(), visible: root.visible, seatCelsius: temperature, heating: demand },
    dispose() {
      fire?.dispose();
      root.removeFromParent();
      grilles.clear();
    },
  };
}
