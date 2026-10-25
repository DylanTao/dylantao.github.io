import * as THREE from "../three.module.min.js";
import { createWalkCollarLiner } from "./walk-collar-liner.mjs";

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
// open cross-section through the torso. Walk keeps its 1.6 m eye height and the
// controller adds the measured native optical forward offset within the capsule.
const HEAD_CUT_ABOVE_NECK = 0.04;

// Every delivered rig binds its head rigidly: Head and Eye vertices carry the whole skin
// weight, and no triangle mixes head and body. The plane cut still leaves the head's
// lower parts in the primary view (South Park's jaw, mouth and teeth, chins, long hair).
// Those primitives draw a body-only index there. Cached per shared geometry, so switching
// styles never rebuilds or re-uploads it.
const bodyOnlyIndices = new WeakMap();
export function headFreeIndex(mesh, headBones) {
  const geometry = mesh.geometry;
  if (bodyOnlyIndices.has(geometry)) return bodyOnlyIndices.get(geometry);
  const index = geometry.index,
    skinIndex = geometry.attributes.skinIndex,
    skinWeight = geometry.attributes.skinWeight;
  let result = null;
  // Material groups would address the original index; no delivered avatar primitive has any.
  if (mesh.isSkinnedMesh && index && skinIndex && skinWeight && !geometry.groups.length) {
    const slots = mesh.skeleton.bones.map((bone) => headBones.has(bone)),
      owned = new Uint8Array(skinIndex.count);
    for (let vertex = 0; vertex < skinIndex.count; vertex++) {
      let weight = 0;
      for (let k = 0; k < 4; k++) if (slots[skinIndex.getComponent(vertex, k)]) weight += skinWeight.getComponent(vertex, k);
      owned[vertex] = weight >= 0.5 ? 1 : 0;
    }
    const source = index.array,
      kept = new source.constructor(source.length);
    let count = 0;
    for (let i = 0; i < source.length; i += 3) {
      const a = source[i],
        b = source[i + 1],
        c = source[i + 2];
      if (owned[a] && owned[b] && owned[c]) continue;
      kept[count++] = a;
      kept[count++] = b;
      kept[count++] = c;
    }
    if (count < source.length) result = { index: new THREE.BufferAttribute(kept.slice(0, count), 1), headTriangles: (source.length - count) / 3 };
  }
  bodyOnlyIndices.set(geometry, result);
  return result;
}

export function createWalkPresence({ renderer, excludeHead = true }) {
  const object = new THREE.Group();
  object.name = "walking-Sirui";
  object.visible = false;
  // Walk's own capsule is the only collision body. Camera/world acceleration structures must
  // not treat this animated representation as an additional wall or static-light occluder.
  object.userData.walkPresence = true;
  object.userData.noContactOcclusion = true;
  object.userData.noVolumeDepth = true;
  const headClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.4),
    headPosition = new THREE.Vector3(),
    opticalEyeOffset = new THREE.Vector3();
  let source = null,
    body = null,
    head = null,
    mixer = null,
    idle = null,
    walk = null,
    collar = null,
    collarFailure = null,
    active = false,
    sourceVisibility = null,
    disposed = false,
    prepared = false,
    version = 0,
    idleTime = 0,
    gaitTime = 0,
    lastElapsed = null,
    lastPosition = null,
    lastYaw = null,
    moving = false,
    primaryView = false,
    headFree = { primitives: 0, triangles: 0 };
  const materials = new Set(),
    skeletons = new Set(),
    planeBindings = new WeakMap(),
    swapped = new Map();

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
    collar?.dispose();
    collar = null;
    collarFailure = null;
    mixer?.stopAllAction();
    if (body) mixer?.uncacheRoot(body);
    for (const skeleton of skeletons) skeleton.dispose();
    skeletons.clear();
    materials.clear();
    body?.removeFromParent();
    body = head = mixer = idle = walk = null;
    opticalEyeOffset.set(0, 0, 0);
    headFree = { primitives: 0, triangles: 0 };
    prepared = false;
  }
  // three's shadow pass calls onBeforeShadow, not onBeforeRender, and mirrors draw outside
  // withoutHead, so both keep the complete person; only primary-view draws swap the index.
  function excludeHeadFromPrimaryView(headBones) {
    body.traverse((part) => {
      if (!part.isSkinnedMesh || part.userData.walkCollarLiner) return;
      const cut = headFreeIndex(part, headBones);
      if (!cut) return;
      headFree.primitives++;
      headFree.triangles += cut.headTriangles;
      const before = part.onBeforeRender,
        after = part.onAfterRender;
      part.onBeforeRender = function (...args) {
        before.apply(this, args);
        if (!primaryView || swapped.has(this)) return;
        swapped.set(this, this.geometry.index);
        this.geometry.index = cut.index;
      };
      part.onAfterRender = function (...args) {
        restoreIndex(this);
        after.apply(this, args);
      };
    });
  }
  // The geometry is shared with the routine avatar; a draw that throws mid-pass must not
  // leave it headless for shadows, mirrors or the 3D view.
  function restoreIndex(part) {
    if (!swapped.has(part)) return;
    part.geometry.index = swapped.get(part);
    swapped.delete(part);
  }
  function refreshMaterials() {
    materials.clear();
    body?.traverse((part) => {
      if (part.isMesh && !part.userData.walkCollarLiner) for (const material of [part.material].flat()) if (material) materials.add(material);
    });
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
      const ephemeral = [];
      body.traverse((part) => {
        // Held routine props have their own lifetime and pose. They are not part of the
        // walking avatar and must not retain assets that propFor() can release later.
        if (part !== body && (part.userData.activityProp || part.userData.action)) ephemeral.push(part);
      });
      for (const part of ephemeral) part.removeFromParent();
      body.traverse((part) => {
        if (part.isSkinnedMesh) skeletons.add(part.skeleton);
        if (part.isMesh) {
          // The volume pass substitutes a generic depth material, losing primary-view head
          // clipping. Exclude this optional first-person body from that approximation so an
          // invisible full head cannot occlude onsen steam. Beauty, mirror and shadow remain.
          part.userData.noVolumeDepth = true;
          for (const material of [part.material].flat()) materials.add(material);
        }
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
      try {
        head?.getWorldPosition(headPosition);
        collar = createWalkCollarLiner(body, (head ? headPosition.y : 1.36) + HEAD_CUT_ABOVE_NECK);
      } catch (error) {
        // An unsupported future garment must not remove the real walking person.
        collarFailure = error.message;
      }
      if (excludeHead && head) {
        const headBones = new Set();
        head.traverse((part) => part.isBone && headBones.add(part));
        excludeHeadFromPrimaryView(headBones);
      }
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
    const distance = displacement < 1.5 ? displacement : 0,
      wasMoving = moving;
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
      !lastPosition ||
      nextPosition.distanceToSquared(lastPosition) > 1e-12 ||
      yaw !== lastYaw ||
      moving !== wasMoving ||
      idleTime !== priorIdle ||
      gaitTime !== priorGait;
    object.position.copy(nextPosition);
    // Both Walk.forward and the authored avatar face +Z at zero yaw.
    object.rotation.y = yaw;
    mixer.update(0);
    object.updateWorldMatrix(true, true);
    if (head) {
      head.getWorldPosition(headPosition);
      headClip.constant = headPosition.y + HEAD_CUT_ABOVE_NECK;
    } else headClip.constant = nextPosition.y + 1.4;
    if (changed) collar?.update();
    lastPosition = nextPosition;
    lastYaw = yaw;
    lastElapsed = elapsed;
    if (changed) version++;
    return changed;
  }

  // Built-in material clipping affects the primary view only. The head's actual geometry,
  // bones and shadow remain intact. Mirrors run outside this scope and see the whole person.
  // Reuse plane/array objects; the renderer changes only its normal clipping-program variant.
  function withoutHead(draw, preparing = false) {
    if ((!active && !preparing) || !body || disposed) return draw();
    // Style/receiver bindings can replace pointers after update; clip the actual draw materials.
    refreshMaterials();
    const localClipping = renderer.localClippingEnabled,
      saved = [];
    const currentCollar = collar,
      priorCollarVisible = currentCollar?.group.visible;
    if (currentCollar) {
      currentCollar.syncMaterial();
      currentCollar.group.visible = true;
    }
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
    primaryView = true;
    const restore = () => {
      primaryView = false;
      for (const part of [...swapped.keys()]) restoreIndex(part);
      if (currentCollar) currentCollar.group.visible = priorCollarVisible;
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

  // r164 WebGLClipping keeps the plane count of the last init/setGlobalState; compile() reads it.
  // A draw of an empty scene with `count` global planes and local clipping on sets numPlanes to
  // exactly `count` (the head cut adds one local plane to unclipped bodies), and draws nothing.
  const primingScene = new THREE.Scene(),
    primingCamera = new THREE.PerspectiveCamera(),
    primingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];
  function primeClippingState(count) {
    const planes = renderer.clippingPlanes,
      local = renderer.localClippingEnabled;
    renderer.clippingPlanes = count ? primingPlanes.slice(0, count) : [];
    renderer.localClippingEnabled = true;
    try {
      renderer.render(primingScene, primingCamera);
    } finally {
      renderer.clippingPlanes = planes;
      renderer.localClippingEnabled = local;
    }
  }

  async function prepare({ scene, camera, shouldContinue = () => true } = {}) {
    if (disposed || prepared || !body || !shouldContinue()) return;
    const expectedBody = body;
    const probe = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, stencilBuffer: false });
    probe.texture.colorSpace = THREE.LinearSRGBColorSpace;
    // Pinned r164 compile() does not initialize per-material clipping. Prime the real
    // variants with a one-pixel, body-only draw in the beauty pass's linear target state,
    // then await their compilation. No temporary scene mutation spans driver link polling.
    function queueVariant(clipped) {
      const visibility = new Map(),
        culling = new Map(),
        meshes = new Set();
      expectedBody.traverse((part) => part.isMesh && meshes.add(part));
      const remember = (part, visible) => {
        if (!visibility.has(part)) visibility.set(part, part.visible);
        part.visible = visible;
      };
      const state = {
        target: renderer.getRenderTarget(),
        background: scene.background,
        override: scene.overrideMaterial,
        autoClear: renderer.autoClear,
        shadowAuto: renderer.shadowMap.autoUpdate,
        shadowNeeds: renderer.shadowMap.needsUpdate,
        xr: renderer.xr?.enabled,
        viewport: renderer.getViewport?.(new THREE.Vector4()),
        scissor: renderer.getScissor?.(new THREE.Vector4()),
        scissorTest: renderer.getScissorTest?.(),
      };
      try {
        scene.traverse((part) => {
          if ((part.isMesh || part.isPoints || part.isLine) && !meshes.has(part)) remember(part, false);
        });
        remember(object, true);
        if (source) remember(source, false);
        for (const mesh of meshes) {
          culling.set(mesh, mesh.frustumCulled);
          mesh.frustumCulled = false;
        }
        scene.background = null;
        scene.overrideMaterial = null;
        renderer.shadowMap.autoUpdate = renderer.shadowMap.needsUpdate = false;
        renderer.autoClear = true;
        if (renderer.xr) renderer.xr.enabled = false;
        renderer.setRenderTarget(probe);
        renderer.setScissorTest?.(false);
        object.updateWorldMatrix(true, true);
        const submit = () => {
          renderer.state?.buffers?.depth?.setMask(true);
          renderer.clear();
          // Pinned r164 keys a program's clipping variant on the renderer's live clipping state,
          // not on the material's planes, and a real draw of the body links its programs on the
          // main thread: 25 s of one frozen task on the Intel Arc laptop (2026-10-24 profile).
          // An empty draw sets that state (one plane for the head cut, none otherwise) without
          // drawing anything, so compileAsync then creates the very variants the walk's draws
          // request and the driver compiles them on its worker threads.
          primeClippingState(clipped ? 1 : 0);
          // A plain holder restores withoutHead immediately; compileAsync's promise only
          // polls readiness after its synchronous compile(body,camera,scene) submission.
          return { pending: renderer.compileAsync(expectedBody, camera, scene) };
        };
        return (clipped ? withoutHead(submit, true) : submit()).pending;
      } finally {
        for (const [part, visible] of visibility) part.visible = visible;
        for (const [mesh, culled] of culling) mesh.frustumCulled = culled;
        scene.background = state.background;
        scene.overrideMaterial = state.override;
        renderer.autoClear = state.autoClear;
        renderer.shadowMap.autoUpdate = state.shadowAuto;
        renderer.shadowMap.needsUpdate = state.shadowNeeds;
        if (renderer.xr) renderer.xr.enabled = state.xr;
        renderer.setRenderTarget(state.target);
        if (state.viewport) renderer.setViewport(state.viewport);
        if (state.scissor) renderer.setScissor(state.scissor);
        if (state.scissorTest !== undefined) renderer.setScissorTest(state.scissorTest);
        if (disposed) object.visible = false;
      }
    }
    try {
      await queueVariant(false);
      if (disposed || body !== expectedBody || !shouldContinue()) return;
      await queueVariant(true);
      prepared = !disposed && body === expectedBody && shouldContinue();
    } finally {
      probe.dispose();
    }
  }

  return {
    object,
    setSource,
    refreshMaterials,
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
      primaryHeadExclusion: { ...headFree },
      fullShadow: true,
      volumeDepth: "first-person body excluded",
      collarLiner: collar?.evidence() ?? null,
      collarFailure,
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
