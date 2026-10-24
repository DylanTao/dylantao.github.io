import * as THREE from "../three.module.min.js";

export const LADDER_MOTION = Object.freeze({ speed: 0.7, capsuleRadius: 0.28, capsuleHeight: 1.75 });

// The native ladder is a rolling assembly, not a climbing interaction. Keep its meshes, materials
// and rail authored in Blender; this rig owns only a bounded world-z translation and action tags.
export function createLibraryLadder(root, definition) {
  const names = new Set(definition?.nodes || []),
    objects = [],
    missingNodes = new Set(names);
  root?.updateWorldMatrix(true, true);
  root?.traverse((object) => {
    // The pinned GLTFLoader sanitizes spaces for animation bindings but retains the exact
    // native node name in userData.name. The manifest's assembly custody uses that name.
    const nativeName = names.has(object.userData.name) ? object.userData.name : object.name;
    if (!object.isMesh || !(names.size ? names.has(nativeName) : definition && object.userData.libraryLadder)) return;
    objects.push(object);
    missingNodes.delete(nativeName);
  });
  const minimum = definition?.travel?.[0],
    maximum = definition?.travel?.[1],
    rest = definition?.rest ?? 0,
    available = objects.length > 0 && missingNodes.size === 0;
  if (
    available &&
    (definition.travelAxis !== "z" || ![minimum, maximum, rest].every(Number.isFinite) || minimum >= maximum || rest < minimum || rest > maximum)
  )
    throw new RangeError("The library ladder needs finite world-z travel bounds containing its rest position.");

  // Refuse a partial assembly rather than leaving a rung or wheel behind after streaming failure.
  if (!available) objects.length = 0;
  const selected = new Set(objects),
    inverse = new THREE.Matrix4(),
    relative = new THREE.Matrix4(),
    meshBox = new THREE.Box3(),
    bounds = new THREE.Box3(),
    sweep = new THREE.Box3(),
    ownedAction = { type: "library-ladder" },
    tags = objects.map((object) => ({
      object,
      actionPresent: Object.hasOwn(object.userData, "action"),
      action: object.userData.action,
      dynamicPresent: Object.hasOwn(object.userData, "dynamic"),
      dynamic: object.userData.dynamic,
    }));
  const movers = objects
    .filter((object) => {
      for (let ancestor = object.parent; ancestor; ancestor = ancestor.parent) if (selected.has(ancestor)) return false;
      return true;
    })
    .map((object) => {
      const localBounds = new THREE.Box3();
      inverse.copy(object.matrixWorld).invert();
      object.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;
        child.geometry.computeBoundingBox();
        if (!child.geometry.boundingBox || child.geometry.boundingBox.isEmpty()) return;
        relative.multiplyMatrices(inverse, child.matrixWorld);
        localBounds.union(meshBox.copy(child.geometry.boundingBox).applyMatrix4(relative));
      });
      return {
        object,
        rest: object.position.clone(),
        restMatrix: object.matrix.clone(),
        localBounds,
        parentMatrix: new THREE.Matrix4(),
        inverseParent: new THREE.Matrix4(),
        worldRestMatrix: new THREE.Matrix4(),
        restBounds: new THREE.Box3(),
        initialized: false,
      };
    });
  let position = rest,
    target = rest,
    blocked = false,
    paused = false,
    disposed = false;

  function syncBounds() {
    let changed = false;
    for (const mover of movers) {
      mover.object.parent?.updateWorldMatrix(true, false);
      const parent = mover.object.parent?.matrixWorld;
      if (mover.initialized && (parent ? mover.parentMatrix.equals(parent) : mover.parentMatrix.equals(identity))) continue;
      mover.parentMatrix.copy(parent || identity);
      if (Math.abs(mover.parentMatrix.determinant()) < 1e-12)
        throw new RangeError("The library ladder cannot move under a singular parent transform.");
      mover.inverseParent.copy(mover.parentMatrix).invert();
      mover.worldRestMatrix.multiplyMatrices(mover.parentMatrix, mover.restMatrix);
      mover.restBounds.copy(mover.localBounds).applyMatrix4(mover.worldRestMatrix);
      mover.initialized = true;
      changed = true;
    }
    if (changed) {
      bounds.makeEmpty();
      for (const mover of movers) bounds.union(mover.restBounds);
    }
  }

  const identity = new THREE.Matrix4();
  syncBounds();
  for (const { object } of tags) {
    object.userData.action = ownedAction;
    object.userData.dynamic = true;
  }

  function capsuleBlocks(next, walk) {
    if (!walk?.active || !walk.position?.every(Number.isFinite) || bounds.isEmpty()) return false;
    const [x, foot, z] = walk.position;
    if (foot >= bounds.max.y || foot + LADDER_MOTION.capsuleHeight <= bounds.min.y) return false;
    sweep.copy(bounds);
    sweep.min.z += Math.min(position, next) - rest;
    sweep.max.z += Math.max(position, next) - rest;
    // Conservative swept AABB expanded by the walking capsule's radius. Test the whole proposed
    // interval, including reduced-motion snaps, so a long frame cannot tunnel through the visitor.
    return (
      x >= sweep.min.x - LADDER_MOTION.capsuleRadius &&
      x <= sweep.max.x + LADDER_MOTION.capsuleRadius &&
      z >= sweep.min.z - LADDER_MOTION.capsuleRadius &&
      z <= sweep.max.z + LADDER_MOTION.capsuleRadius
    );
  }

  function compose() {
    const offset = position - rest;
    for (const mover of movers) {
      const elements = mover.inverseParent.elements;
      mover.object.position.set(mover.rest.x + elements[8] * offset, mover.rest.y + elements[9] * offset, mover.rest.z + elements[10] * offset);
      mover.object.updateMatrix();
      mover.object.updateWorldMatrix(false, true);
    }
  }

  function toggle() {
    if (disposed || !available) return false;
    target = target === maximum ? minimum : maximum;
    blocked = false;
    return true;
  }

  return {
    objects,
    activate: toggle,
    toggle,
    update(dt, { walk = null, reduced = false, paused: hold = false } = {}) {
      if (disposed || !available) return false;
      paused = Boolean(hold);
      if (paused || position === target) return false;
      syncBounds();
      const step = Math.max(0, Number.isFinite(dt) ? dt : 0) * LADDER_MOTION.speed,
        next = reduced ? target : THREE.MathUtils.clamp(target, position - step, position + step);
      if (next === position) return false;
      blocked = capsuleBlocks(next, walk);
      if (blocked) return false;
      position = next;
      compose();
      return true;
    },
    get moving() {
      // Walking and explicit activation already request frames. A blocked ladder must not keep a
      // separate animation loop spinning while its target remains queued for a later clear update.
      return available && !disposed && !paused && !blocked && position !== target;
    },
    get blocked() {
      return blocked;
    },
    evidence: () => ({
      available,
      missingNodes: [...missingNodes],
      nodes: objects.map((object) => object.name),
      position,
      target,
      travel: available ? [minimum, maximum] : null,
      speed: LADDER_MOTION.speed,
      blocked,
      paused,
      disposed,
      climbable: false,
      axis: "world-z",
      bounds: bounds.isEmpty()
        ? null
        : { min: [bounds.min.x, bounds.min.y, bounds.min.z + position - rest], max: [bounds.max.x, bounds.max.y, bounds.max.z + position - rest] },
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const mover of movers) {
        mover.object.position.copy(mover.rest);
        mover.object.matrix.copy(mover.restMatrix);
        mover.object.updateWorldMatrix(false, true);
      }
      for (const tag of tags) {
        if (tag.object.userData.action === ownedAction) {
          if (tag.actionPresent) tag.object.userData.action = tag.action;
          else delete tag.object.userData.action;
        }
        if (tag.object.userData.dynamic === true) {
          if (tag.dynamicPresent) tag.object.userData.dynamic = tag.dynamic;
          else delete tag.object.userData.dynamic;
        }
      }
    },
  };
}
