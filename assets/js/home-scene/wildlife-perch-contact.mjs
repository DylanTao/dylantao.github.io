import * as THREE from "../three.module.min.js";

const up = new THREE.Vector3(0, 1, 0);
const down = new THREE.Vector3(0, -1, 0);
const surfaceCache = new WeakMap();
const settledCache = new WeakMap();
const smooth = (value) => {
  const u = Math.max(0, Math.min(1, value));
  return u ** 3 * (10 + u * (-15 + 6 * u));
};

export function perchContactWeight(time, index) {
  const t = Number.isFinite(time) ? Math.max(0, time) : 0;
  const cycle = (((t + index * 19) % 90) + 90) % 90;
  return cycle < 68 ? smooth((cycle - 64) / 4) : cycle < 86 ? 1 : 1 - smooth((cycle - 86) / 0.45);
}

export function perchSurface(patch, x, z) {
  let triangles = surfaceCache.get(patch);
  if (!triangles) {
    triangles = patch.triangles.flatMap(([ax, ay, az, bx, by, bz, cx, cy, cz]) => {
      const determinant = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(determinant) < 1e-10) return [];
      const normal = new THREE.Vector3(bx - ax, by - ay, bz - az).cross(new THREE.Vector3(cx - ax, cy - ay, cz - az)).normalize();
      if (normal.y < 0) normal.negate();
      return [{ ay, by, cy, cx, cz, aX: bz - cz, aZ: cx - bx, bX: cz - az, bZ: ax - cx, determinant, normal }];
    });
    surfaceCache.set(patch, triangles);
  }
  const px = x - patch.origin[0],
    pz = z - patch.origin[2];
  let result = null;
  for (const triangle of triangles) {
    const { ay, by, cy, cx, cz, aX, aZ, bX, bZ, determinant, normal } = triangle;
    const a = (aX * (px - cx) + aZ * (pz - cz)) / determinant;
    const b = (bX * (px - cx) + bZ * (pz - cz)) / determinant;
    if (a < -1e-7 || b < -1e-7 || a + b > 1 + 1e-7) continue;
    const y = a * ay + b * by + (1 - a - b) * cy;
    if (y > patch.maximumHeight || (result && y + patch.origin[1] <= result.height)) continue;
    result = { height: y + patch.origin[1], normal };
  }
  return result;
}

function ankleOrientation(yaw, normal) {
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  forward.y = -(normal.x * forward.x + normal.z * forward.z) / normal.y;
  forward.normalize();
  const right = normal.clone().cross(forward).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, normal, forward));
}

export function solvePerchLanding(data, patchIndex, yaw, scale) {
  const patch = data.patches[patchIndex];
  const position = new THREE.Vector3(...(patch.kind === "rail" ? patch.original : patch.origin));
  const quaternion = new THREE.Quaternion().setFromAxisAngle(up, yaw);
  const matrix = new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(scale, scale, scale));
  const inverseMatrix = matrix.clone().invert(),
    inverseQuaternion = quaternion.clone().invert();
  const feet = {};
  for (const side of ["L", "R"]) {
    const foot = data.feet[side],
      center = new THREE.Vector3(...foot.position).applyMatrix4(matrix);
    const support = perchSurface(patch, center.x, center.z);
    if (!support) throw new Error(`No ${patch.id} support under ${side} ankle`);
    const orientation = patch.kind === "rail" ? quaternion.clone() : ankleOrientation(yaw, support.normal);
    let clearance = Infinity,
      supported = 0;
    for (const sample of foot.sole) {
      const point = new THREE.Vector3(...sample).multiplyScalar(scale).applyQuaternion(orientation).add(center);
      const surface = perchSurface(patch, point.x, point.z);
      if (!surface) continue; // Webbed toes can intentionally overhang the narrow rail.
      supported++;
      clearance = Math.min(clearance, point.y - surface.height);
    }
    if (!supported) throw new Error(`No ${patch.id} sole support for ${side}`);
    center.y -= clearance;
    feet[side] = {
      position: center,
      quaternion: orientation,
      localPosition: center.clone().applyMatrix4(inverseMatrix),
      localQuaternion: inverseQuaternion.clone().multiply(orientation),
      supported,
      overhang: foot.sole.length - supported,
    };
  }
  return { position, quaternion, matrix, feet, patchIndex, yaw, scale };
}

export function samplePerchActing(data, landing, position, quaternion, weight) {
  const settled = weight === 1 && position.distanceToSquared(landing.position) < 1e-20 && 1 - Math.abs(quaternion.dot(landing.quaternion)) < 1e-12;
  // Perched roots are stationary. Reuse their read-only contact pose instead
  // of rechecking the same 384 sole points on every active scene frame.
  if (settled && settledCache.has(landing)) return settledCache.get(landing);
  const scale = landing.scale;
  const matrix = new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(scale, scale, scale));
  const feet = {};
  for (const side of ["L", "R"]) {
    const native = data.feet[side],
      goal = landing.feet[side];
    // Feet approach their final pose in body space, rather than reaching for
    // a distant world anchor before the bird has arrived over its perch.
    const footPosition = new THREE.Vector3(...native.position).lerp(goal.localPosition, weight).applyMatrix4(matrix);
    const footQuaternion = quaternion.clone().multiply(new THREE.Quaternion().slerp(goal.localQuaternion, weight));
    let clearance = Infinity;
    if (weight > 0) {
      const patch = data.patches[landing.patchIndex];
      for (const sample of native.sole) {
        const point = new THREE.Vector3(...sample).multiplyScalar(scale).applyQuaternion(footQuaternion).add(footPosition);
        const surface = perchSurface(patch, point.x, point.z);
        if (surface) clearance = Math.min(clearance, point.y - surface.height);
      }
    }
    // A unilateral contact correction keeps the deployed web out of the
    // retained surface while the torso flares or pitches into departure.
    const surfaceLift = Math.max(0, -clearance);
    footPosition.y += surfaceLift;
    const ankle = new THREE.Vector3(...native.ankle).multiplyScalar(scale).applyQuaternion(footQuaternion).add(footPosition);
    const nativeHip = new THREE.Vector3(...native.hip).applyMatrix4(matrix),
      direction = ankle.clone().sub(nativeHip).normalize();
    const hip = ankle.clone().addScaledVector(direction, -native.legLength * scale);
    const legQuaternion = new THREE.Quaternion().setFromUnitVectors(down, direction);
    feet[side] = {
      position: footPosition,
      quaternion: footQuaternion,
      hip,
      legQuaternion,
      surfaceLift,
      hipAccommodation: hip.distanceTo(nativeHip),
    };
  }
  const acting = { feet };
  if (settled) settledCache.set(landing, acting);
  return acting;
}
