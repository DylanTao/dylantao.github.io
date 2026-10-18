import * as THREE from "../three.module.min.js";

// The duvet breathes with the sleeper (Sirui, 2026-10-15: "the soft materials like blanket when
// sleep can be better physically simulated"). The draped cover is fitted to each figure lying in
// bed (bin/coastal_bedding.py); here its own vertices rise and fall around the chest: a soft
// Gaussian swell of a few millimetres along each vertex normal, at a resting rate of about 14
// breaths a minute, inhaling over 40 % of the breath and letting it go over the rest (a resting
// adult's inspiration-to-expiration ratio is about 1:1.5). Only the visible sleeper's cover moves;
// the made bed stays static light. The displacement is far below the cover's thickness, so the
// cover never dips into the body or the mattress it was draped over.

export const BREATHS_PER_MINUTE = 14;
export const INHALE = 0.4;
export const SWELL = 0.007; // metres at the chest
export const REACH = 0.3; // Gaussian radius, metres

const smooth = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};

// 0 (breathed out) to 1 (breathed in) at time t in seconds.
export function breathAt(seconds, rate = BREATHS_PER_MINUTE) {
  const period = 60 / rate;
  const u = (((seconds % period) + period) % period) / period;
  return u < INHALE ? smooth(u / INHALE) : 1 - smooth((u - INHALE) / (1 - INHALE));
}

// A breathing cover over one mesh: update() with the chest in the mesh's local space.
export function createBreathingCover(mesh) {
  const position = mesh.geometry.getAttribute("position");
  const normal = mesh.geometry.getAttribute("normal");
  if (!position || !normal) return null;
  const rest = position.array.slice();
  const normals = normal.array.slice();
  // Room for the swell in the bounds, so culling never clips it.
  mesh.geometry.computeBoundingSphere();
  if (mesh.geometry.boundingSphere) mesh.geometry.boundingSphere.radius += SWELL * 2;
  // The local frame may be scaled; express the swell and reach in local units.
  const scale = new THREE.Vector3();
  mesh.updateWorldMatrix(true, false);
  mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  const unit = 1 / Math.max(1e-6, (scale.x + scale.y + scale.z) / 3);
  let last = -1;
  return {
    mesh,
    update(chest, breath) {
      const amount = Math.round(breath * 1000) / 1000;
      if (amount === last) return false;
      last = amount;
      const swell = SWELL * unit * amount,
        reach2 = (REACH * unit) ** 2;
      const a = position.array;
      for (let i = 0; i < a.length; i += 3) {
        const dx = rest[i] - chest.x,
          dy = rest[i + 1] - chest.y,
          dz = rest[i + 2] - chest.z;
        const w = swell * Math.exp(-(dx * dx + dy * dy + dz * dz) / reach2);
        a[i] = rest[i] + normals[i] * w;
        a[i + 1] = rest[i + 1] + normals[i + 1] * w;
        a[i + 2] = rest[i + 2] + normals[i + 2] * w;
      }
      position.needsUpdate = true;
      return true;
    },
    reset() {
      if (last === 0) return;
      position.array.set(rest);
      position.needsUpdate = true;
      last = 0;
    },
  };
}
