import * as THREE from "../three.module.min.js";

const fract = (value) => value - Math.floor(value);
const wrap = (value, extent) => ((value % extent) + extent) % extent;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const EMPTY_SHELTERS = Object.freeze([]);
const STILL_WIND = Object.freeze([0, 0, 0]);
const hash = (index, salt) => fract(Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123);
const seeds = Float64Array.from({ length: 512 * 4 }, (_, at) => hash(Math.floor(at / 4), (at % 4) + 1));
const seed = (index, salt) => (index >= 0 && index < 512 ? seeds[index * 4 + salt - 1] : hash(index, salt));

// A bounded authored shower, in metres. This is a visual field, not a fluid solver.
// Absolute active time makes a slow frame, pause and recovery produce the same field.
export function rainSegment(index, seconds, center, wind = STILL_WIND, ground = -8, shelters = EMPTY_SHELTERS, out = new Float32Array(6)) {
  const age = wrap(seconds + seed(index, 1) * 7, 7);
  const extent = 64;
  const x = Math.floor(center[0] / 4) * 4 + wrap(seed(index, 2) * extent + age * wind[0], extent) - extent / 2;
  const z = Math.floor(center[2] / 4) * 4 + wrap(seed(index, 3) * extent + age * wind[2], extent) - extent / 2;
  const top = 31 - age * 6;
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
  out[3] = x + (length / 6) * wind[0];
  out[4] = bottom;
  out[5] = z + (length / 6) * wind[2];
  // A landed drop is degenerate, never a line through terrain or an invisible cutaway roof.
  if (top <= floor + 0.025) {
    out[3] = out[0];
    out[5] = out[2];
  }
  return out;
}

export function createCoastalRain({ scene, compact = false, terrainHeight = () => -8, shelters = EMPTY_SHELTERS }) {
  const maximum = compact ? 256 : 512;
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
  const scratch = new Float32Array(6);
  let intensity = 0;
  let drops = 0;
  let fieldTime = 0;
  let sheltered = 0;
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
        center[0] = camera.position.x;
        center[1] = camera.position.y;
        center[2] = camera.position.z;
      }
      sheltered = 0;
      for (let index = 0; index < drops; index++) {
        rainSegment(index, fieldTime, center, wind, terrainHeight, shelters, scratch);
        if (scratch[1] === scratch[4]) sheltered++;
        positions.set(scratch, index * 6);
      }
      geometry.attributes.position.needsUpdate = true;
      material.opacity = (0.2 + 0.17 * clamp(daylight, 0, 1)) * Math.sqrt(intensity);
    },
    evidence: () => ({
      method: "active-time seeded exterior line field, clipped to terrain and covered volumes",
      intensity,
      drops,
      maximum,
      sheltered,
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
