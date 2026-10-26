import * as THREE from "../three.module.min.js";

const CELL = 0.35;
const clock = () => globalThis.performance?.now() || 0;
const EXCLUDED = /plant|flora|foliage|leaf|grass|sage|agave|water|glass|shadow|furniture|placeholder/i;

// The same physical families as the native coast survey. Colour/opacity alone cannot turn
// a leaf card or an indoor table into ground. Visibility is recorded separately: a cutaway
// does not move the physical roof, and the owning scene must keep visible habitat supported.
export function isCoastalGround(mesh) {
  if (!mesh.isMesh || mesh.isSkinnedMesh || !mesh.geometry?.attributes.position || mesh.geometry.attributes.coastalPlantWeight) return false;
  let coast = false,
    core = false,
    roof = false;
  const names = [];
  for (let o = mesh; o; o = o.parent) {
    if (o.userData.action || o.userData.activityProp || o.userData.furnitureAnchor || o.userData.flora || o.userData.shadowOnly) return false;
    names.push(o.name || "");
    coast ||= /^coast_/i.test(o.name);
    core ||= /^core_/i.test(o.name);
    roof ||= Boolean(o.userData.caveRoof);
  }
  const materials = [mesh.material].flat().filter(Boolean);
  if (!materials.length || materials.some((m) => m.transparent || m.opacity < 0.99 || m.transmission > 0)) return false;
  if (EXCLUDED.test(names.join(" ") + " " + materials.map((m) => m.name).join(" "))) return false;
  return coast || roof || (core && materials.some((m) => /golden[ _]coastal[ _]sandstone|La Jolla bluff sandstone/i.test(m.name)));
}

export function createGroundPatch(path, margin = 0.65) {
  const bounds = {
    minX: Math.min(...path.map((p) => p[0])) - margin,
    maxX: Math.max(...path.map((p) => p[0])) + margin,
    minZ: Math.min(...path.map((p) => p[2])) - margin,
    maxZ: Math.max(...path.map((p) => p[2])) + margin,
  };
  const triangles = [],
    cells = new Map(),
    sources = new Set(),
    meshes = new Set();
  let milliseconds = 0;
  const a = new THREE.Vector3(),
    b = a.clone(),
    c = a.clone(),
    normal = a.clone(),
    edge = a.clone();
  const cell = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  function capture(roots) {
    const start = clock();
    for (const root of roots) {
      root.updateWorldMatrix(true, true);
      root.traverse((mesh) => {
        if (meshes.has(mesh) || !isCoastalGround(mesh)) return;
        meshes.add(mesh);
        const positions = mesh.geometry.attributes.position,
          indices = mesh.geometry.index;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
        if (box.max.x < bounds.minX || box.min.x > bounds.maxX || box.max.z < bounds.minZ || box.min.z > bounds.maxZ) return;
        for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
          a.fromBufferAttribute(positions, indices ? indices.getX(i) : i).applyMatrix4(mesh.matrixWorld);
          b.fromBufferAttribute(positions, indices ? indices.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
          c.fromBufferAttribute(positions, indices ? indices.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
          const minX = Math.max(bounds.minX, Math.min(a.x, b.x, c.x)),
            maxX = Math.min(bounds.maxX, Math.max(a.x, b.x, c.x)),
            minZ = Math.max(bounds.minZ, Math.min(a.z, b.z, c.z)),
            maxZ = Math.min(bounds.maxZ, Math.max(a.z, b.z, c.z));
          if (minX > maxX || minZ > maxZ) continue;
          normal.subVectors(b, a).cross(edge.subVectors(c, a)).normalize();
          if (normal.y < 0.25) continue;
          const determinant = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
          if (Math.abs(determinant) < 1e-10) continue;
          const triangle = {
            cx: c.x,
            cz: c.z,
            aX: b.z - c.z,
            aZ: c.x - b.x,
            bX: c.z - a.z,
            bZ: a.x - c.x,
            ay: a.y,
            by: b.y,
            cy: c.y,
            determinant,
            normal: normal.clone(),
            mesh,
            triangle: i / 3,
          };
          triangles.push(triangle);
          sources.add(mesh.name);
          for (let x = Math.floor(minX / CELL); x <= Math.floor(maxX / CELL); x++)
            for (let z = Math.floor(minZ / CELL); z <= Math.floor(maxZ / CELL); z++) {
              const key = `${x},${z}`;
              if (!cells.has(key)) cells.set(key, []);
              cells.get(key).push(triangle);
            }
        }
      });
    }
    milliseconds += clock() - start;
  }
  function sample(x, z, maximum = Infinity) {
    let result = null;
    for (const t of cells.get(cell(x, z)) || []) {
      const u = (t.aX * (x - t.cx) + t.aZ * (z - t.cz)) / t.determinant,
        v = (t.bX * (x - t.cx) + t.bZ * (z - t.cz)) / t.determinant;
      if (u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7) continue;
      const height = u * t.ay + v * t.by + (1 - u - v) * t.cy;
      if (height > maximum || (result && height <= result.height)) continue;
      let visible = true;
      for (let o = t.mesh; o; o = o.parent) visible &&= o.visible;
      result = { height, normal: t.normal, mesh: t.mesh.name, triangle: t.triangle, visible };
    }
    return result;
  }
  return {
    capture,
    sample,
    evidence: () => ({
      ready: triangles.length > 0,
      triangles: triangles.length,
      cells: cells.size,
      meshes: [...sources],
      bounds,
      captureMilliseconds: milliseconds,
    }),
  };
}

// Rigid paw ownership is read from the delivered skin, in the paw's own frame. A small grid
// keeps its lower envelope; the runtime never substitutes an ellipsoid or a nominal thickness.
export function footSole(model, bone) {
  // SkinnedMesh.updateMatrixWorld refreshes its bind inverse; updateWorldMatrix does not.
  model.updateMatrixWorld(true);
  const points = new Map(),
    inverse = bone.matrixWorld.clone().invert(),
    point = new THREE.Vector3();
  model.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const skin = mesh.geometry.attributes.skinIndex,
      weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < skin.count; i++) {
      let owned = 0;
      for (let k = 0; k < 4; k++) if (mesh.skeleton.bones[skin.getComponent(i, k)] === bone) owned += weights.getComponent(i, k);
      if (owned < 0.999) continue;
      mesh.getVertexPosition(i, point);
      point.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
      const key = `${Math.round(point.x / 0.006)},${Math.round(point.z / 0.006)}`;
      if (!points.has(key) || point.y < points.get(key).y) points.set(key, point.clone());
    }
  });
  return [...points.values()];
}

export function groundFootQuaternion(yaw, normal) {
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  forward.y = -(normal.x * forward.x + normal.z * forward.z) / normal.y;
  forward.normalize();
  const right = normal.clone().cross(forward).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, normal, forward));
}

export function fitFootSole(patch, sole, position, quaternion, onlyLift = false) {
  let clearance = Infinity,
    supported = 0,
    visible = true;
  const point = new THREE.Vector3();
  for (const sample of sole) {
    point.copy(sample).applyQuaternion(quaternion).add(position);
    const surface = patch.sample(point.x, point.z, position.y + 0.5);
    if (!surface) continue;
    supported++;
    clearance = Math.min(clearance, point.y - surface.height);
    visible &&= surface.visible;
  }
  const shift = supported ? (onlyLift ? Math.max(0, -clearance) : -clearance) : 0;
  return { position: position.clone().add(new THREE.Vector3(0, shift, 0)), supported, visible, correction: shift };
}
