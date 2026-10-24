import * as THREE from "../three.module.min.js";
import { collisionBounds, createCollisionGrid, cutawayFootprint, ORBIT_DIRECTION } from "./camera.mjs";

// The camera's collision field (camera.mjs) for the controller. Each static house, room and nearby
// coast mesh is voxelized once it has loaded, then classified, in a worker
// (camera-field-worker.mjs) or, where module workers are unavailable, in small background slices
// here. Until the field is ready the manifest's walls and facade plane still keep the camera
// clear. A room added to the manifest is covered as soon as its model streams in, and any roof
// tagged as the cutaway widens the open-air footprint the whole-house camera may lean over.

// Triangles voxelized per background slice (a count, not a time budget: the scene tests freeze
// the page clock, and the slices must still finish).
const SLICE = 5000;

// Glass, the cut-away roof, sliding doors, props, desk objects and refitted bedding never hold the
// camera back; the made bed does.
export function collidable(object, world) {
  if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh || !object.geometry?.attributes.position) return false;
  for (let node = object; node && node !== world; node = node.parent) {
    const data = node.userData;
    // Native placeholders are the stable proxies, including after they are visually hidden.
    // Streamed levels and held props must not change a field already built for this room.
    if (data.furnitureAnchor || data.furnitureCollision === false) return false;
    if (
      data.glazing ||
      data.noOcclusion ||
      data.shadowOnly ||
      data.caveRoof ||
      data.facadeDoor ||
      data.estateDoor ||
      data.walkPresence ||
      data.activityProp ||
      data.action
    )
      return false;
    if (data.bedding && data.bedding !== "empty") return false;
  }
  return [object.material].flat().some((m) => m && !(m.transparent && m.opacity < 0.5));
}

// Object-space positions as a fresh Float32Array a worker can own.
function packedPositions(attribute) {
  if (!attribute.isInterleavedBufferAttribute && !attribute.normalized && attribute.itemSize === 3 && attribute.array instanceof Float32Array)
    return attribute.array.slice(0, attribute.count * 3);
  const packed = new Float32Array(attribute.count * 3);
  for (let i = 0; i < attribute.count; i++) {
    packed[i * 3] = attribute.getX(i);
    packed[i * 3 + 1] = attribute.getY(i);
    packed[i * 3 + 2] = attribute.getZ(i);
  }
  return packed;
}

// Points known to be open air, from which the field floods: each room's target and its authored
// camera position (the whole-house target too). Whatever the flood cannot reach is a solid's inside.
export function airSeeds(config) {
  const seeds = [];
  for (const room of config?.rooms || []) {
    const { target, camera } = room;
    if (!target) continue;
    seeds.push([...target]);
    if (camera && Number.isFinite(camera.yaw) && Number.isFinite(camera.pitch) && Number.isFinite(camera.radius)) {
      const d = ORBIT_DIRECTION(camera.yaw, camera.pitch);
      seeds.push(target.map((v, k) => v + d[k] * camera.radius));
    }
  }
  if (config?.views?.overview?.target) seeds.push([...config.views.overview.target]);
  return seeds;
}

export function createCameraField({ config, world, onReady = () => {} }) {
  const bounds = collisionBounds(config);
  const seeds = airSeeds(config);
  const grid = bounds ? createCollisionGrid({ ...bounds, seeds }) : null;
  const queue = [],
    roots = [],
    solids = [],
    roofBoxes = [],
    stats = { meshes: 0, classifications: 0, worker: false };
  let worker = null,
    work = null,
    scheduled = false,
    disposed = false,
    footprint = null;

  function startWorker() {
    if (!grid || typeof Worker !== "function") return;
    try {
      let module = false;
      const next = new Worker(new URL("./camera-field-worker.mjs", import.meta.url), {
        get type() {
          module = true;
          return "module";
        },
      });
      if (!module) throw new Error("module workers unavailable");
      next.onmessage = ({ data }) => {
        if (data.type !== "field" || disposed) return;
        if (grid.setFlags(data.flags, data.evidence)) {
          stats.classifications++;
          onReady();
        }
      };
      // A worker that cannot run rebuilds the field here from the roots it was sent.
      next.onerror = (event) => {
        event.preventDefault?.();
        next.terminate();
        if (worker !== next) return;
        worker = null;
        stats.worker = false;
        for (const root of roots.splice(0)) addRoot(root);
        for (const [min, max] of solids) grid.addSolid(min, max);
        schedule();
      };
      next.postMessage({ type: "init", bounds: { min: grid.bounds.min, max: grid.bounds.max, cell: grid.cell, seeds } });
      worker = next;
      stats.worker = true;
    } catch {
      worker = null;
    }
  }

  function addRoot(root) {
    if (!grid || !root || disposed) return;
    root.updateMatrixWorld(true);
    roots.push(root);
    let sent = false,
      roof = false;
    root.traverse((object) => {
      // The lifted roof may be a multi-material group; its tag sits on the group.
      if (object.userData.caveRoof) {
        const box = new THREE.Box3().setFromObject(object);
        if (!box.isEmpty()) {
          roofBoxes.push({ min: box.min.toArray(), max: box.max.toArray() });
          roof = true;
        }
      }
      if (!collidable(object, world)) return;
      if (!worker) {
        queue.push({ mesh: object, from: 0 });
        return;
      }
      const positions = packedPositions(object.geometry.attributes.position),
        index = object.geometry.index ? object.geometry.index.array.slice(0, object.geometry.index.count) : null;
      worker.postMessage(
        { type: "mesh", positions, index, matrix: [...object.matrixWorld.elements] },
        index ? [positions.buffer, index.buffer] : [positions.buffer]
      );
      stats.meshes++;
      sent = true;
    });
    if (roof) footprint = cutawayFootprint(roofBoxes);
    if (sent) worker.postMessage({ type: "classify" });
    else schedule();
  }

  function addSolid(min, max) {
    if (!grid || disposed) return;
    solids.push([min, max]);
    if (worker) {
      worker.postMessage({ type: "solid", min, max });
      worker.postMessage({ type: "classify" });
    } else {
      grid.addSolid(min, max);
      schedule();
    }
  }

  function schedule() {
    if (scheduled || disposed) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      step();
    };
    if (globalThis.scheduler?.postTask) globalThis.scheduler.postTask(run, { priority: "background" }).catch(() => {});
    else setTimeout(run, 0);
  }

  function step() {
    if (disposed || !grid) return;
    let budget = SLICE;
    while (budget > 0 && queue.length) {
      const job = queue[0];
      if (!job.prepared) {
        const geometry = job.mesh.geometry,
          position = geometry.attributes.position,
          index = geometry.index;
        job.mesh.updateWorldMatrix(true, false);
        job.prepared = grid.prepareGeometry({
          position: (i, out) => {
            out[0] = position.getX(i);
            out[1] = position.getY(i);
            out[2] = position.getZ(i);
          },
          count: position.count,
          index: index ? index.array.subarray(0, index.count) : null,
          matrix: job.mesh.matrixWorld.elements,
        });
        budget -= Math.ceil(position.count / 4);
      }
      const end = grid.addPrepared(job.prepared, job.from, job.from + Math.max(1, budget));
      budget -= Math.max(1, end - job.from);
      job.from = end;
      if (end >= job.prepared.total) {
        queue.shift();
        stats.meshes++;
      }
    }
    if (!queue.length) {
      if (!work && grid.dirty) work = grid.classify();
      if (work && work.next().done) {
        work = null;
        stats.classifications++;
        onReady();
      }
    }
    if (queue.length || work || grid.dirty) schedule();
  }

  startWorker();
  return {
    grid,
    get ready() {
      return Boolean(grid?.ready);
    },
    get footprint() {
      return footprint;
    },
    addRoot,
    addSolid,
    evidence: () => (grid ? { ...grid.evidence(), queued: queue.length, ...stats } : null),
    dispose() {
      disposed = true;
      worker?.terminate();
      worker = null;
      queue.length = 0;
    },
  };
}
