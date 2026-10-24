import * as THREE from "../three.module.min.js";

// The bone correspondence follows SkeletonUtils.clone from three.js r164 (MIT):
// https://github.com/mrdoob/three.js/blob/r164/examples/jsm/utils/SkeletonUtils.js
// Copyright 2010-2024 three.js authors; license: ../vendor/three-r164/LICENSE.
// Geometry, materials and clips stay shared. Only the hierarchy and skeleton buffers belong
// to this presence, so disposing it must never release the selected avatar's GPU assets.
export function cloneWalkSkeleton(source) {
  const clone = source.clone(true),
    correspondence = new Map(),
    skeletonCopies = new Map();
  function pair(original, copy) {
    correspondence.set(original, copy);
    copy.userData = { ...original.userData };
    copy.onBeforeRender = original.onBeforeRender;
    copy.onAfterRender = original.onAfterRender;
    copy.customDepthMaterial = original.customDepthMaterial;
    copy.customDistanceMaterial = original.customDistanceMaterial;
    original.children.forEach((child, i) => pair(child, copy.children[i]));
  }
  pair(source, clone);
  source.traverse((original) => {
    if (!original.isSkinnedMesh) return;
    const copy = correspondence.get(original);
    // The delivered GLB has one skin shared by 10-12 material primitives. Keep that sharing
    // instead of allocating/uploading an identical bone texture for every primitive.
    if (!skeletonCopies.has(original.skeleton)) {
      const skeleton = original.skeleton.clone();
      skeleton.bones = original.skeleton.bones.map((bone) => {
        const clonedBone = correspondence.get(bone);
        if (!clonedBone) throw new Error("Walk avatar bones must belong to the selected avatar hierarchy.");
        return clonedBone;
      });
      skeletonCopies.set(original.skeleton, skeleton);
    }
    copy.skeleton = skeletonCopies.get(original.skeleton);
    copy.bindMatrix.copy(original.bindMatrix);
    copy.bind(copy.skeleton, copy.bindMatrix);
  });
  return clone;
}

const STRIDE = 1.25;
// In the delivered rigs Head is the neck root (1.36 m), not the face centre. Keep the
// closed shirt/shoulders below it and clip just above the neck instead of cutting a broad
// open cross-section through the torso. The primary camera remains at Walk's 1.6 m eyes.
const HEAD_CUT_ABOVE_NECK = 0.04;

export function createWalkPresence({ renderer }) {
  const object = new THREE.Group();
  object.name = "walking-Sirui";
  object.visible = false;
  // Walk's own capsule is the only collision body. Camera/world acceleration structures must
  // not treat this animated representation as an additional wall or static-light occluder.
  object.userData.walkPresence = true;
  object.userData.noContactOcclusion = true;
  const headClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.4),
    headPosition = new THREE.Vector3(),
    opticalEyeOffset = new THREE.Vector3();
  let source = null,
    body = null,
    head = null,
    mixer = null,
    idle = null,
    walk = null,
    active = false,
    sourceVisibility = null,
    disposed = false,
    prepared = false,
    warmCount = 0,
    version = 0,
    idleTime = 0,
    gaitTime = 0,
    lastElapsed = null,
    lastPosition = null,
    lastYaw = null,
    moving = false;
  const materials = new Set(),
    skeletons = new Set(),
    planeBindings = new WeakMap();

  function restoreSource() {
    if (source && sourceVisibility !== null && source.visible === false) source.visible = sourceVisibility;
    sourceVisibility = null;
  }
  function hideSource() {
    if (!source || sourceVisibility !== null) return;
    sourceVisibility = source.visible;
    source.visible = false;
  }
  function clearBody() {
    restoreSource();
    mixer?.stopAllAction();
    if (body) mixer?.uncacheRoot(body);
    for (const skeleton of skeletons) skeleton.dispose();
    skeletons.clear();
    materials.clear();
    body?.removeFromParent();
    body = head = mixer = idle = walk = null;
    opticalEyeOffset.set(0, 0, 0);
    prepared = false;
  }
  function setSource(next, clips = []) {
    if (disposed || next === source) return;
    clearBody();
    source = next;
    lastElapsed = lastPosition = lastYaw = null;
    idleTime = gaitTime = 0;
    if (source) {
      body = cloneWalkSkeleton(source);
      body.name = "walk-avatar";
      body.position.set(0, 0, 0);
      body.rotation.set(0, 0, 0);
      body.visible = true;
      object.add(body);
      body.traverse((part) => {
        if (part.isSkinnedMesh) skeletons.add(part.skeleton);
        if (part.isMesh) for (const material of [part.material].flat()) materials.add(material);
        if (part.isBone && part.name === "Head") head = part;
      });
      // Start from bind pose, not a snapshot of the routine's lounge/sleep/performance layer.
      for (const skeleton of skeletons) skeleton.pose();
      mixer = new THREE.AnimationMixer(body);
      const action = (name) => {
        const clip = clips.find((entry) => entry.name === name);
        return clip ? mixer.clipAction(clip).play() : null;
      };
      idle = action("idle");
      walk = action("walk");
      idle?.setEffectiveWeight(1);
      walk?.setEffectiveWeight(0);
      mixer.update(0);
      // Measure the native optical anchor after bind/idle composition, never from the
      // routine's current sleep/lounge pose. Root may shift the Walk camera forward by a
      // conservative portion of this offset while leaving its height and capsule intact.
      body.updateWorldMatrix(true, true);
      let eyeCount = 0;
      body.traverse((part) => {
        if (!part.isBone || !/^Eye[._]?[LR]$/.test(part.name)) return;
        opticalEyeOffset.add(part.getWorldPosition(new THREE.Vector3()));
        eyeCount++;
      });
      if (eyeCount) body.worldToLocal(opticalEyeOffset.multiplyScalar(1 / eyeCount));
      if (active) hideSource();
    }
    object.visible = active && Boolean(body);
    version++;
  }

  function update({
    active: requested = false,
    position = [0, 0, 0],
    yaw = 0,
    velocity = [0, 0],
    elapsed = 0,
    reduced = false,
    paused = false,
  } = {}) {
    if (disposed) return false;
    const nextActive = Boolean(requested && body);
    if (nextActive !== active) {
      active = nextActive;
      if (active) hideSource();
      else restoreSource();
      object.visible = active;
      lastPosition = lastElapsed = lastYaw = null;
      version++;
    }
    if (!active) return false;
    const nextPosition = new THREE.Vector3(...position),
      displacement = lastPosition ? Math.hypot(nextPosition.x - lastPosition.x, nextPosition.z - lastPosition.z) : 0,
      dt = lastElapsed === null ? 0 : Math.max(0, Math.min(0.1, elapsed - lastElapsed));
    // Ground truth is displacement, not input/desired velocity: a blocked capsule stands still.
    // A deliberate lab/portal placement is not a ten-metre stride.
    const distance = displacement < 1.5 ? displacement : 0;
    moving = distance > 1e-5 && Math.hypot(...velocity) > 1e-4;
    const priorIdle = idleTime,
      priorGait = gaitTime;
    if (!reduced && !paused && !moving) idleTime += dt;
    if (moving && walk) gaitTime += (distance / STRIDE) * (walk.getClip().duration / 2);
    if (idle) {
      idle.time = idleTime % idle.getClip().duration;
      idle.setEffectiveWeight(moving && walk ? 0 : 1);
    }
    if (walk) {
      walk.time = gaitTime % walk.getClip().duration;
      walk.setEffectiveWeight(moving ? 1 : 0);
    }
    const changed =
      !lastPosition || nextPosition.distanceToSquared(lastPosition) > 1e-12 || yaw !== lastYaw || idleTime !== priorIdle || gaitTime !== priorGait;
    object.position.copy(nextPosition);
    // Both Walk.forward and the authored avatar face +Z at zero yaw.
    object.rotation.y = yaw;
    mixer.update(0);
    object.updateWorldMatrix(true, true);
    if (head) {
      head.getWorldPosition(headPosition);
      headClip.constant = headPosition.y + HEAD_CUT_ABOVE_NECK;
    } else headClip.constant = nextPosition.y + 1.4;
    lastPosition = nextPosition;
    lastYaw = yaw;
    lastElapsed = elapsed;
    if (changed) version++;
    return changed;
  }

  // Built-in material clipping affects the primary view only. The head's actual geometry,
  // bones and shadow remain intact. Mirrors run outside this scope and see the whole person.
  // Reuse plane/array objects; the renderer changes only its normal clipping-program variant.
  function withoutHead(draw) {
    if ((!active && warmCount === 0) || !body || disposed) return draw();
    const localClipping = renderer.localClippingEnabled,
      saved = [];
    for (const material of materials) {
      const original = material.clippingPlanes;
      let binding = planeBindings.get(material);
      if (!binding || binding.original !== original) {
        binding = { original, planes: [...(original || []), headClip] };
        planeBindings.set(material, binding);
      }
      saved.push([material, original, material.clipShadows, material.clipIntersection]);
      material.clippingPlanes = binding.planes;
      material.clipShadows = false;
      material.clipIntersection = false;
    }
    renderer.localClippingEnabled = true;
    const restore = () => {
      renderer.localClippingEnabled = localClipping;
      for (const [material, planes, shadows, intersection] of saved) {
        material.clippingPlanes = planes;
        material.clipShadows = shadows;
        material.clipIntersection = intersection;
      }
    };
    try {
      const result = draw();
      if (result?.then) return Promise.resolve(result).finally(restore);
      restore();
      return result;
    } catch (error) {
      restore();
      throw error;
    }
  }

  async function prepare({ scene, camera, shouldContinue = () => true } = {}) {
    if (disposed || prepared || !body || !shouldContinue()) return;
    const expectedBody = body,
      expectedSource = source,
      visible = object.visible,
      heldSource = sourceVisibility !== null;
    warmCount++;
    object.visible = true;
    hideSource();
    object.updateWorldMatrix(true, true);
    try {
      await renderer.compileAsync(scene, camera);
      if (disposed || body !== expectedBody || !shouldContinue()) return;
      await withoutHead(() => renderer.compileAsync(scene, camera));
      prepared = !disposed && body === expectedBody && shouldContinue();
    } finally {
      warmCount--;
      if (!disposed && body === expectedBody) {
        object.visible = active || visible;
        if (source === expectedSource && !active && !heldSource) restoreSource();
      }
    }
  }

  return {
    object,
    setSource,
    update,
    withoutHead,
    prepare,
    get contentVersion() {
      return version;
    },
    get opticalForwardOffset() {
      return Math.max(0, opticalEyeOffset.z);
    },
    evidence: () => ({
      active,
      source: source?.name || null,
      sourceHidden: active && source?.visible === false,
      prepared,
      skeletons: skeletons.size,
      sharedGeometryAndMaterials: true,
      position: object.position.toArray(),
      yaw: object.rotation.y,
      moving,
      idleTime,
      gaitTime,
      contentVersion: version,
      opticalEyeOffset: opticalEyeOffset.toArray(),
      opticalForwardOffset: Math.max(0, opticalEyeOffset.z),
      headCutHeight: headClip.constant,
      fullShadow: true,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      clearBody();
      source = null;
      active = false;
      object.visible = false;
      object.removeFromParent();
    },
  };
}
