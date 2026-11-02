import { createRainContactTracker } from "./rain-contact.mjs";
import { rainDrop, createRainDrop, RAIN_FIELD } from "./rain-trajectories.mjs";
export { RAIN_FIELD } from "./rain-trajectories.mjs";
import * as THREE from "../three.module.min.js";

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const EMPTY_SHELTERS = Object.freeze([]);
const STILL_WIND = Object.freeze([0, 0, 0]);
// World-stable drop columns are bounded by a moving camera box. Sizes and exposure differ per
// representative drop; wind continues through each vertical recycle and holds at paused active time.
// This is a visual field, not a fluid solver. Absolute active time makes a slow frame, pause and
// recovery produce the same field. `center` is the box centre: horizontally ahead of the camera, at
// the camera's height.
export function rainSegment(
  index,
  seconds,
  center,
  wind = STILL_WIND,
  ground = -8,
  shelters = EMPTY_SHELTERS,
  out = new Float32Array(6),
  displacement = null,
  drop = createRainDrop()
) {
  rainDrop(index, seconds, center, wind, displacement, drop);
  const [x, top, z] = drop.tail,
    endX = drop.point[0],
    endZ = drop.point[2];
  const height = typeof ground === "function" ? ground(x, z, endX, endZ) : ground;
  let floor = Number.isFinite(height) ? height : -8;
  for (const shelter of shelters) {
    if (x >= shelter.min[0] && x <= shelter.max[0] && z >= shelter.min[2] && z <= shelter.max[2]) floor = Math.max(floor, shelter.max[1]);
  }
  drop.solidUpper = floor;
  const bottom = Math.max(floor + 0.025, drop.point[1]);
  out[0] = x;
  out[1] = Math.max(bottom, top);
  out[2] = z;
  out[3] = endX;
  out[4] = bottom;
  out[5] = endZ;
  // A landed drop is degenerate, never a line through terrain or an invisible cutaway roof.
  if (top <= floor + 0.025) {
    out[3] = out[0];
    out[5] = out[2];
  }
  return out;
}

export function createCoastalRain({
  scene,
  compact = false,
  terrainHeight = () => -8,
  shelters = EMPTY_SHELTERS,
  roofEvidence = () => null,
  surfaceAt = null,
  onWaterImpact = null,
  waterMaximumAt = () => Infinity,
}) {
  const maximum = compact ? RAIN_FIELD.compactMaximum : RAIN_FIELD.maximum;
  const positions = new Float32Array(maximum * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0, 0);
  const material = new THREE.LineBasicMaterial({ color: 0xb9cad4, transparent: true, opacity: 0, depthWrite: false });
  const object = new THREE.LineSegments(geometry, material);
  object.name = "Bounded coastal rain";
  object.frustumCulled = false;
  object.userData.noContactOcclusion = true;
  object.userData.activityProp = true;
  // Keep the zero-opacity object present through initial program warmup. Later dry frames hide it.
  scene.add(object);
  const center = [0, 0, 0];
  const eye = [0, 0, 0];
  const forward = new THREE.Vector3();
  const scratch = new Float32Array(6);
  const displacement = new Float64Array(3);
  const fieldWind = new Float64Array(3);
  let previousTime = null;
  const drop = createRainDrop();
  const contacts = surfaceAt ? createRainContactTracker({ maximum, surfaceAt, impact: onWaterImpact }) : null;
  const nearSquared = RAIN_FIELD.near * RAIN_FIELD.near;
  let intensity = 0;
  let drops = 0;
  let fieldTime = 0;
  let sheltered = 0;
  let nearCamera = 0;
  return {
    object,
    update({ seconds = 0, rain = 0, camera, wind = STILL_WIND, daylight = 1 }) {
      intensity = Number.isFinite(rain) ? clamp(rain, 0, 1) : 0;
      fieldTime = Number.isFinite(seconds) ? seconds : 0;
      object.visible = intensity > 0.005;
      drops = object.visible ? Math.max(24, Math.round(maximum * intensity)) : 0;
      geometry.setDrawRange(0, drops * 2);
      if (!drops) {
        contacts?.reset();
        return;
      }
      const delta = previousTime === null ? Infinity : fieldTime - previousTime;
      if (delta !== 0) {
        for (const axis of [0, 2]) {
          const nextWind = Number.isFinite(wind[axis]) ? wind[axis] : 0;
          displacement[axis] = delta > 0 && delta <= 0.25 ? displacement[axis] + ((fieldWind[axis] + nextWind) * delta) / 2 : fieldTime * nextWind;
          fieldWind[axis] = nextWind;
        }
        previousTime = fieldTime;
      }
      if (camera) {
        eye[0] = camera.position.x;
        eye[1] = camera.position.y;
        eye[2] = camera.position.z;
        camera.getWorldDirection(forward);
        const level = Math.hypot(forward.x, forward.z),
          ahead = level > 1e-3 ? RAIN_FIELD.ahead / level : 0;
        center[0] = eye[0] + forward.x * ahead;
        center[1] = eye[1];
        center[2] = eye[2] + forward.z * ahead;
      }
      sheltered = 0;
      nearCamera = 0;
      for (let index = 0; index < drops; index++) {
        rainSegment(index, fieldTime, center, fieldWind, terrainHeight, shelters, scratch, displacement, drop);
        if (contacts) {
          const waterMaximum = waterMaximumAt(drop.point[0], drop.point[2]);
          drop.upper = Number.isFinite(waterMaximum) ? Math.max(drop.solidUpper, waterMaximum) : Infinity;
          contacts.update(index, drop, fieldTime);
          if (contacts.landed(index)) {
            scratch[3] = scratch[0];
            scratch[4] = scratch[1];
            scratch[5] = scratch[2];
          }
        }
        if (scratch[1] === scratch[4]) sheltered++;
        else {
          // A drop this close would streak across the whole view: hold it degenerate instead.
          const dx = scratch[0] - eye[0],
            dy = scratch[1] - eye[1],
            dz = scratch[2] - eye[2];
          if (dx * dx + dy * dy + dz * dz < nearSquared) {
            scratch[3] = scratch[0];
            scratch[4] = scratch[1];
            scratch[5] = scratch[2];
            nearCamera++;
          }
        }
        positions.set(scratch, index * 6);
      }
      geometry.attributes.position.needsUpdate = true;
      material.opacity = (0.26 + 0.2 * clamp(daylight, 0, 1)) * Math.sqrt(intensity);
    },
    evidence: () => ({
      method: "active-time seeded exterior line field in a world-stable camera box, clipped to terrain and covered volumes",
      intensity,
      drops,
      maximum,
      sheltered,
      nearCamera,
      fieldExtent: RAIN_FIELD.extent,
      fieldTime,
      advection: Array.from(displacement),
      extraPasses: 0,
      shadowCasters: 0,
      roofClip: roofEvidence(),
      contacts: contacts?.evidence() ?? null,
      shutterSeconds: RAIN_FIELD.shutter,
      representativeDiameterMetres: [0.00075, 0.002],
    }),
    dispose() {
      object.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
