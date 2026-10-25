import * as THREE from "../three.module.min.js";

const fract = (value) => value - Math.floor(value);
const wrap = (value, extent) => ((value % extent) + extent) % extent;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const EMPTY_SHELTERS = Object.freeze([]);
const STILL_WIND = Object.freeze([0, 0, 0]);
// A bounded authored shower, in metres and seconds. Drops fall through world space at a light-rain
// drop's terminal speed (about 4 m/s for 1 mm). Only where they wrap follows the camera: a box
// `extent` wide, centred `ahead` of the camera, from `below` under it to `above` over it. Moving the
// camera keeps each drop where it is (only drops leaving the box reappear on its far side), and a few
// hundred drops read as rain in front of the house instead of vanishing into a 64 m square. Wind
// drift is measured from a drop's entry at the box's top, so it resets only up there. The field
// repeats every (above + below) / fall = 7 seconds.
export const RAIN_FIELD = Object.freeze({ extent: 30, ahead: 12, above: 8, below: 20, fall: 4, near: 3.5, maximum: 1024, compactMaximum: 256 });
const hash = (index, salt) => fract(Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123);
const seeds = Float64Array.from({ length: RAIN_FIELD.maximum * 4 }, (_, at) => hash(Math.floor(at / 4), (at % 4) + 1));
const seed = (index, salt) => (index >= 0 && index < RAIN_FIELD.maximum ? seeds[index * 4 + salt - 1] : hash(index, salt));

// This is a visual field, not a fluid solver. Absolute active time makes a slow frame, pause and
// recovery produce the same field. `center` is the box centre: horizontally ahead of the camera, at
// the camera's height.
export function rainSegment(index, seconds, center, wind = STILL_WIND, ground = -8, shelters = EMPTY_SHELTERS, out = new Float32Array(6)) {
  const { extent, above, below, fall } = RAIN_FIELD,
    span = above + below,
    lowY = center[1] - below,
    phase = wrap(seed(index, 1) * span - seconds * fall - lowY, span),
    top = lowY + phase,
    age = (span - phase) / fall,
    lowX = center[0] - extent / 2,
    lowZ = center[2] - extent / 2,
    x = lowX + wrap(seed(index, 2) * extent + age * wind[0] - lowX, extent),
    z = lowZ + wrap(seed(index, 3) * extent + age * wind[2] - lowZ, extent);
  const height = typeof ground === "function" ? ground(x, z) : ground;
  let floor = Number.isFinite(height) ? height : -8;
  for (const shelter of shelters) {
    if (x >= shelter.min[0] && x <= shelter.max[0] && z >= shelter.min[2] && z <= shelter.max[2]) floor = Math.max(floor, shelter.max[1]);
  }
  const length = 0.28 + seed(index, 4) * 0.42;
  const bottom = Math.max(floor + 0.025, top - length);
  out[0] = x;
  out[1] = Math.max(bottom, top);
  out[2] = z;
  out[3] = x + (length / fall) * wind[0];
  out[4] = bottom;
  out[5] = z + (length / fall) * wind[2];
  // A landed drop is degenerate, never a line through terrain or an invisible cutaway roof.
  if (top <= floor + 0.025) {
    out[3] = out[0];
    out[5] = out[2];
  }
  return out;
}

export function createCoastalRain({ scene, compact = false, terrainHeight = () => -8, shelters = EMPTY_SHELTERS }) {
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
      if (!drops) return;
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
        rainSegment(index, fieldTime, center, wind, terrainHeight, shelters, scratch);
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
      extraPasses: 0,
      shadowCasters: 0,
    }),
    dispose() {
      object.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
