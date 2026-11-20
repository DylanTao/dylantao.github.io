import * as THREE from "../three.module.min.js";

// Site sound listens after opt-in. The scene never loads samples or creates an audio context.
export function createSceneFoley({ emit, plantAt = () => false }) {
  let active = false,
    medium = null,
    stride = 0,
    brushDistance = 0,
    brushCooldown = 0,
    impact = false;

  function resetWalk() {
    medium = null;
    stride = 0;
    brushDistance = 0;
    brushCooldown = 0;
    impact = false;
  }

  function contact(name, strength) {
    if (active) emit({ name, strength });
  }

  return {
    setActive(value) {
      if (active === Boolean(value)) return;
      active = Boolean(value);
      resetWalk();
      emit({ name: active ? "prepare" : "quiet" });
    },
    get active() {
      return active;
    },
    resetWalk,
    contact,
    splash(speed) {
      if (!active) return;
      impact = true;
      contact("splash", Math.min(1, 0.32 + 0.14 * Math.max(0, speed)));
    },
    walk({ x, z, foot, moved, dt, grounded, wet, depth, material }) {
      if (!active || !(dt > 0)) return;
      const wetStride = wet ? (grounded && depth <= 0.55 ? "wade" : "swim") : null;
      const next = wetStride || (grounded ? "land" : "air");
      if (next !== medium) {
        if (wetStride && (medium === "land" || (medium === "air" && moved > 0.006)) && !impact) contact("splash", 0.2);
        stride = 0;
        medium = next;
      }
      impact = false;
      brushCooldown = Math.max(0, brushCooldown - dt);
      if (!(moved > 0.002)) return;
      const speed = moved / dt;
      if (next !== "air") {
        const length = next === "land" ? (speed >= 2.5 ? 0.81 : 0.61) : next === "swim" ? 0.59 : 0.66;
        stride += moved;
        if (stride >= length) {
          const cue = wetStride || material;
          if (cue) contact(cue, Math.min(1, 0.26 + speed * 0.15));
          stride %= length;
        }
      }
      if (wet || !grounded) return;
      brushDistance += moved;
      if (brushDistance < 0.16) return;
      brushDistance %= 0.16;
      if (brushCooldown === 0 && plantAt(x, foot, z)) {
        contact("foliage", Math.min(0.6, 0.2 + speed * 0.09));
        brushCooldown = 0.54;
      }
    },
  };
}

const WIDTH = 0.25;
const BRUSH_RADIUS = 0.29;
const VEGETATION = /\b(?:leaves|leaf|foliage|fern|fronds?|grass blades?)\b/i;
const cellKey = (x, z) => `${x},${z}`;

// Sources arrive with streamed models. Only an opted-in visitor near a real plant
// builds that mesh's small leaf-point grid; the solid Walk field remains untouched.
export function createPlantBrush() {
  const known = new WeakSet();
  const leaves = [];
  const pendingRoots = new Set();
  const point = new THREE.Vector3();

  function collect(root) {
    root.traverse((mesh) => {
      if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || known.has(mesh)) return;
      const position = mesh.geometry?.attributes?.position;
      if (!position || ![mesh.material].flat().some((material) => VEGETATION.test(material?.name || ""))) return;
      known.add(mesh);
      leaves.push({ mesh, bounds: new THREE.Box3(), matrix: new THREE.Matrix4(), indexed: false, grid: null });
    });
  }

  function rebuild(leaf) {
    const { mesh, bounds, matrix } = leaf;
    const { geometry } = mesh;
    mesh.updateWorldMatrix(true, false);
    if (leaf.indexed && matrix.equals(mesh.matrixWorld)) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    matrix.copy(mesh.matrixWorld);
    bounds.copy(geometry.boundingBox).applyMatrix4(matrix);
    leaf.indexed = true;
    leaf.grid = null;
  }

  function gridFor(leaf) {
    if (leaf.grid) return leaf.grid;
    const result = new Map();
    const position = leaf.mesh.geometry.attributes.position;
    const step = Math.max(1, Math.ceil(position.count / 24000));
    for (let i = 0; i < position.count; i += step) {
      point.fromBufferAttribute(position, i).applyMatrix4(leaf.matrix);
      const key = cellKey(Math.floor(point.x / WIDTH), Math.floor(point.z / WIDTH));
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(point.x, point.y, point.z);
    }
    leaf.grid = result;
    return result;
  }

  function near(x, foot, z) {
    for (const root of pendingRoots) collect(root);
    pendingRoots.clear();
    const xr = [Math.floor((x - BRUSH_RADIUS) / WIDTH), Math.floor((x + BRUSH_RADIUS) / WIDTH)];
    const zr = [Math.floor((z - BRUSH_RADIUS) / WIDTH), Math.floor((z + BRUSH_RADIUS) / WIDTH)];
    for (const leaf of leaves) {
      let reachable = leaf.mesh;
      while (reachable && reachable.visible) reachable = reachable.parent;
      if (reachable) continue;
      rebuild(leaf);
      const { min, max } = leaf.bounds;
      const low = foot + 0.08;
      const high = foot + 1.6;
      if (x < min.x - BRUSH_RADIUS || x > max.x + BRUSH_RADIUS || z < min.z - BRUSH_RADIUS || z > max.z + BRUSH_RADIUS || max.y < low || min.y > high)
        continue;
      const grid = gridFor(leaf);
      for (let k = zr[0]; k <= zr[1]; k++) {
        for (let i = xr[0]; i <= xr[1]; i++) {
          const p = grid.get(cellKey(i, k));
          if (!p) continue;
          for (let j = 0; j < p.length; j += 3) {
            if (p[j + 1] >= low && p[j + 1] <= high && (p[j] - x) ** 2 + (p[j + 2] - z) ** 2 <= BRUSH_RADIUS ** 2) return true;
          }
        }
      }
    }
    return false;
  }

  return { add: (root) => pendingRoots.add(root), near };
}
