import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { cloneWalkSkeleton, createWalkPresence } from "../assets/js/home-scene/walk-presence.mjs";

function avatar() {
  const source = new THREE.Group(),
    hips = new THREE.Bone(),
    head = new THREE.Bone();
  source.name = "selected-Sirui";
  hips.name = "Hips";
  hips.position.y = 0.8;
  head.name = "Head";
  head.position.y = 0.56; // The delivered rigs' neck-root Head anchor is at 1.36 m.
  for (const [name, x] of [
    ["Eye.L", -0.045],
    ["Eye.R", 0.045],
  ]) {
    const eye = new THREE.Bone();
    eye.name = name;
    eye.position.set(x, 0.16, 0.11);
    head.add(eye);
  }
  hips.add(head);
  source.add(hips);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.8, 0, 0, 1.6, 0, 0.1, 1.6, 0.1], 3));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const material = new THREE.MeshStandardMaterial(),
    skeleton = new THREE.Skeleton([hips, head]),
    mesh = new THREE.SkinnedMesh(geometry, material),
    eyelids = new THREE.SkinnedMesh(geometry, material);
  mesh.name = "body";
  eyelids.name = "eyelids";
  mesh.castShadow = true;
  source.add(mesh, eyelids);
  source.updateMatrixWorld(true);
  mesh.bind(skeleton);
  eyelids.bind(skeleton);
  const idle = new THREE.AnimationClip("idle", 2, [new THREE.NumberKeyframeTrack("Head.rotation[x]", [0, 1, 2], [0, 0.1, 0])]),
    walk = new THREE.AnimationClip("walk", 2, [new THREE.NumberKeyframeTrack("Head.rotation[x]", [0, 0.5, 1, 1.5, 2], [0, -0.2, 0, 0.2, 0])]);
  return { source, hips, head, mesh, eyelids, geometry, material, skeleton, clips: [idle, walk] };
}

function fixture() {
  let target = { original: true },
    probeDisposals = 0;
  const knownProbes = new WeakSet();
  const model = avatar(),
    draws = [],
    renderer = {
      localClippingEnabled: false,
      compileAsync: async () => {},
      shadowMap: { autoUpdate: true, needsUpdate: true },
      autoClear: false,
      xr: { enabled: true },
      getRenderTarget: () => target,
      setRenderTarget: (next) => {
        target = next;
      },
      clear: () => {},
      render: (scene) => {
        assert.equal(target.width, 1);
        assert.equal(target.height, 1);
        assert.equal(target.texture.colorSpace, THREE.LinearSRGBColorSpace);
        assert.equal(target.texture.type, THREE.HalfFloatType);
        if (!knownProbes.has(target)) {
          knownProbes.add(target);
          target.addEventListener("dispose", () => probeDisposals++);
        }
        assert.equal(renderer.shadowMap.autoUpdate, false);
        assert.equal(renderer.shadowMap.needsUpdate, false);
        scene.traverseVisible((part) => {
          if (!part.isMesh) return;
          let insidePresence = false;
          for (let parent = part; parent; parent = parent.parent) insidePresence ||= parent === presence.object;
          assert.ok(insidePresence, "the one-pixel prime draws only the selected walking body");
        });
        draws.push({ clipped: Boolean(model.material.clippingPlanes), target });
      },
    },
    presence = createWalkPresence({ renderer }),
    scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera();
  presence.setSource(model.source, model.clips);
  scene.add(model.source, presence.object);
  return { ...model, renderer, presence, scene, camera, draws, probeDisposals: () => probeDisposals };
}

test("the selected avatar clone has independent bound bones and skeleton buffers with shared GPU assets", () => {
  const f = avatar(),
    clone = cloneWalkSkeleton(f.source),
    mesh = clone.getObjectByName("body"),
    eyelids = clone.getObjectByName("eyelids"),
    head = clone.getObjectByName("Head");
  assert.equal(mesh.geometry, f.geometry);
  assert.equal(mesh.material, f.material);
  assert.notEqual(mesh.skeleton, f.skeleton);
  assert.notEqual(mesh.skeleton.boneMatrices, f.skeleton.boneMatrices);
  assert.equal(mesh.skeleton, eyelids.skeleton, "material primitives retain the source's single shared skin");
  assert.equal(mesh.skeleton.bones[1], head);
  assert.equal(eyelids.skeleton.bones[1], head);
  assert.notEqual(head, f.head);
  head.rotation.x = 0.8;
  assert.equal(f.head.rotation.x, 0, "new presence cannot mutate the routine's skeleton");
  assert.deepEqual(mesh.bindMatrix.toArray(), f.mesh.bindMatrix.toArray());
});

test("activation embodies one Sirui at the exact capsule position and +Z Walk yaw without changing the routine", () => {
  const f = fixture();
  f.source.position.set(8, 2.6, -4);
  f.source.rotation.y = 0.7;
  f.presence.update({ active: true, position: [-6, 0, 3.4], yaw: Math.PI / 2, elapsed: 10 });
  assert.equal(f.source.visible, false);
  assert.equal(f.presence.object.visible, true);
  assert.deepEqual(f.presence.object.position.toArray(), [-6, 0, 3.4]);
  assert.equal(f.presence.object.rotation.y, Math.PI / 2);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(f.presence.object.quaternion);
  assert.ok(forward.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-7);
  assert.deepEqual(f.source.position.toArray(), [8, 2.6, -4]);
  assert.equal(f.source.rotation.y, 0.7);
  f.presence.update({ active: false });
  assert.equal(f.source.visible, true);
  assert.equal(f.presence.object.visible, false);
  f.presence.dispose();
});

test("native gait advances from actual capsule travel while blocked velocity stays in idle", () => {
  const f = fixture();
  f.presence.update({ active: true, position: [0, 0, 0], velocity: [2, 0], elapsed: 1 });
  f.presence.update({ active: true, position: [0.2, 0, 0], velocity: [2, 0], elapsed: 1.1 });
  const traveling = f.presence.evidence();
  assert.equal(traveling.moving, true);
  assert.ok(traveling.gaitTime > 0);
  f.presence.update({ active: true, position: [0.2, 0, 0], velocity: [2, 0], elapsed: 1.2 });
  const blocked = f.presence.evidence();
  assert.equal(blocked.moving, false);
  assert.equal(blocked.gaitTime, traveling.gaitTime, "a wall does not cause treadmill steps");
  assert.ok(blocked.idleTime > 0);
  assert.equal(f.head.rotation.x, 0, "routine bones remain independent of Walk's mixer");
  f.presence.dispose();
});

test("Pause and reduced motion compose stills, while explicit reduced-motion walking changes the mirror version", () => {
  const f = fixture();
  f.presence.update({ active: true, position: [0, 0, 0], elapsed: 0, reduced: true });
  const version = f.presence.contentVersion;
  assert.equal(f.presence.update({ active: true, position: [0, 0, 0], elapsed: 2, reduced: true }), false);
  assert.equal(f.presence.contentVersion, version);
  assert.equal(f.presence.update({ active: true, position: [0.2, 0, 0], velocity: [2, 0], elapsed: 2, reduced: true }), true);
  assert.ok(f.presence.contentVersion > version);
  const moved = f.presence.evidence();
  assert.equal(f.presence.update({ active: true, position: [0.2, 0, 0], elapsed: 2, reduced: true }), true);
  assert.equal(f.presence.contentVersion, moved.contentVersion + 1, "stopping changes native gait weights even with a frozen clock");
  const stopped = f.presence.contentVersion;
  assert.equal(f.presence.update({ active: true, position: [0.2, 0, 0], elapsed: 2, reduced: true }), false);
  assert.equal(f.presence.contentVersion, stopped, "a repeated reduced-motion still does not invalidate the mirror");
  f.presence.update({ active: true, position: [0.2, 0, 0], elapsed: 5, paused: true });
  assert.equal(f.presence.evidence().idleTime, moved.idleTime);
  assert.equal(f.presence.evidence().gaitTime, moved.gaitTime);
  f.presence.dispose();
});

test("primary-view head clipping preserves full bones and shadows, then restores shared material and renderer state", () => {
  const f = fixture(),
    existing = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 12)];
  f.material.clippingPlanes = existing;
  f.material.clipIntersection = true;
  f.material.clipShadows = true;
  f.presence.update({ active: true, position: [-6, 2.6, 3.4], elapsed: 0, reduced: true });
  assert.ok(Math.abs(f.presence.evidence().headCutHeight - 4) < 1e-7, "the cut retains the native shirt and shoulders below the neck");
  const scale = f.presence.object.getObjectByName("Head").scale.clone();
  let planes;
  f.presence.withoutHead(() => {
    assert.equal(f.renderer.localClippingEnabled, true);
    assert.equal(f.material.clippingPlanes.length, 2);
    assert.equal(f.material.clippingPlanes[0], existing[0]);
    planes = f.material.clippingPlanes;
    const clip = planes[1],
      cut = f.presence.evidence().headCutHeight;
    assert.ok(clip.distanceToPoint(new THREE.Vector3(-6, cut + 0.1, 3.4)) < 0, "eye/head interior is excluded from primary view");
    assert.ok(clip.distanceToPoint(new THREE.Vector3(-6, cut - 0.2, 3.4)) > 0, "looking down still shows the body");
    assert.equal(f.material.clipShadows, false, "complete head geometry remains in shadow-map pass");
    assert.deepEqual(f.presence.object.getObjectByName("Head").scale.toArray(), scale.toArray());
  });
  assert.equal(f.renderer.localClippingEnabled, false);
  assert.equal(f.material.clippingPlanes, existing);
  assert.equal(f.material.clipShadows, true);
  assert.equal(f.material.clipIntersection, true);
  f.presence.withoutHead(() => assert.equal(f.material.clippingPlanes, planes, "stable arrays avoid per-frame allocation"));
  f.presence.dispose();
});

test("receiver material changes retain head clipping on the current walking body", () => {
  const f = fixture();
  f.presence.update({ active: true });
  const replacement = f.material.clone();
  f.presence.object.traverse((part) => {
    if (part.isMesh) part.material = replacement;
  });
  f.presence.refreshMaterials();
  f.presence.withoutHead(() => {
    assert.equal(replacement.clippingPlanes.length, 1);
    assert.equal(f.material.clippingPlanes, null);
  });
  assert.equal(replacement.clippingPlanes, null);
  f.presence.dispose();
  replacement.dispose();
});

test("primary draws discover replaced style materials without a lifecycle refresh and restore them after failure", () => {
  const f = fixture();
  f.presence.update({ active: true, position: [-6.25, 2.6, 3.65], yaw: -Math.PI / 2 });
  const replacement = f.material.clone(),
    originalPlanes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 5)];
  replacement.clippingPlanes = originalPlanes;
  replacement.clipShadows = replacement.clipIntersection = true;
  f.presence.object.traverse((part) => {
    if (part.isMesh) part.material = replacement;
  });
  const duringDraw = () => {
    assert.equal(replacement.clippingPlanes.length, 2);
    assert.equal(replacement.clippingPlanes[0], originalPlanes[0]);
    assert.ok(Math.abs(replacement.clippingPlanes[1].constant - 4) < 1e-6);
    assert.equal(replacement.clipShadows, false);
    assert.equal(replacement.clipIntersection, false);
    assert.equal(f.material.clippingPlanes, null, "the obsolete material is untouched");
  };
  f.presence.withoutHead(duringDraw);
  assert.equal(replacement.clippingPlanes, originalPlanes);
  assert.equal(replacement.clipShadows, true);
  assert.equal(replacement.clipIntersection, true);
  assert.throws(
    () =>
      f.presence.withoutHead(() => {
        duringDraw();
        throw new Error("replacement draw failed");
      }),
    /replacement draw failed/
  );
  assert.equal(replacement.clippingPlanes, originalPlanes);
  assert.equal(replacement.clipShadows, true);
  assert.equal(replacement.clipIntersection, true);
  assert.equal(f.material.clippingPlanes, null);
  assert.equal(f.renderer.localClippingEnabled, false);
  f.presence.dispose();
  replacement.dispose();
});

test("a failed or asynchronous primary draw always restores clipping custody", async () => {
  const f = fixture();
  f.presence.update({ active: true });
  assert.throws(
    () =>
      f.presence.withoutHead(() => {
        throw new Error("draw failed");
      }),
    /draw failed/
  );
  assert.equal(f.material.clippingPlanes, null);
  assert.equal(f.renderer.localClippingEnabled, false);
  await assert.rejects(
    f.presence.withoutHead(async () => {
      await Promise.resolve();
      assert.equal(f.renderer.localClippingEnabled, true);
      throw new Error("async failed");
    }),
    /async failed/
  );
  assert.equal(f.material.clippingPlanes, null);
  assert.equal(f.renderer.localClippingEnabled, false);
  f.presence.dispose();
});

test("warmup compiles full and primary-clipped variants before Walk, then restores the hidden presence", async () => {
  const f = fixture(),
    variants = [];
  f.renderer.compileAsync = async () => {
    variants.push(Boolean(f.material.clippingPlanes));
    assert.equal(f.source.visible, false);
    assert.equal(f.presence.object.visible, true);
  };
  await f.presence.prepare({ scene: f.scene, camera: f.camera });
  assert.deepEqual(variants, [false, true]);
  assert.equal(f.presence.evidence().prepared, true);
  assert.equal(f.source.visible, true);
  assert.equal(f.presence.object.visible, false);
  assert.equal(f.renderer.localClippingEnabled, false);
  assert.equal(f.material.clippingPlanes, null);
  assert.equal(f.probeDisposals(), 1, "the temporary one-pixel target is released after both variants finish");
  f.presence.dispose();
});

test("warmup primes the renderer's clipping state with empty draws instead of drawing the body", async () => {
  // A real body draw links its programs on the main thread (25 s frozen on ANGLE/D3D11). The
  // prime draws an empty scene so r164's clipping state holds 0, then 1, planes for compileAsync.
  const f = fixture(),
    primed = [],
    render = f.renderer.render;
  f.renderer.render = (scene) => {
    let meshes = 0;
    scene.traverse((part) => (meshes += part.isMesh ? 1 : 0));
    primed.push({ planes: f.renderer.clippingPlanes.length, local: f.renderer.localClippingEnabled, meshes });
    render(scene);
  };
  await f.presence.prepare({ scene: f.scene, camera: f.camera });
  assert.deepEqual(primed, [
    { planes: 0, local: true, meshes: 0 },
    { planes: 1, local: true, meshes: 0 },
  ]);
  assert.equal(f.renderer.localClippingEnabled, false);
  assert.equal(f.presence.evidence().prepared, true);
  f.presence.dispose();
});

test("warmup failure and disposal during warmup do not reveal a body or leave the routine hidden", async () => {
  const f = fixture();
  f.renderer.compileAsync = async () => {
    throw new Error("compile failed");
  };
  await assert.rejects(f.presence.prepare({ scene: f.scene, camera: f.camera }), /compile failed/);
  assert.equal(f.source.visible, true);
  assert.equal(f.presence.object.visible, false);
  assert.equal(f.presence.evidence().prepared, false);
  assert.equal(f.probeDisposals(), 1, "failed warmup releases its temporary target too");
  f.renderer.compileAsync = async () => f.presence.dispose();
  await f.presence.prepare({ scene: f.scene, camera: f.camera });
  assert.equal(f.source.visible, true);
  assert.equal(f.presence.object.visible, false);
});

test("switching avatars and disposal restore source visibility and release only clone-owned skeleton data", () => {
  const f = fixture(),
    next = avatar();
  let geometryDisposals = 0,
    materialDisposals = 0,
    originalSkeletonDisposals = 0,
    cloneSkeletonDisposals = 0;
  f.geometry.addEventListener("dispose", () => geometryDisposals++);
  f.material.addEventListener("dispose", () => materialDisposals++);
  f.skeleton.dispose = () => originalSkeletonDisposals++;
  f.presence.object.traverse((part) => {
    if (part.isSkinnedMesh) part.skeleton.dispose = () => cloneSkeletonDisposals++;
  });
  f.presence.update({ active: true });
  f.presence.setSource(next.source, next.clips);
  assert.equal(f.source.visible, true);
  assert.equal(next.source.visible, false);
  assert.equal(cloneSkeletonDisposals, 1);
  f.presence.dispose();
  f.presence.dispose();
  assert.equal(next.source.visible, true);
  assert.equal(geometryDisposals, 0);
  assert.equal(materialDisposals, 0);
  assert.equal(originalSkeletonDisposals, 0);
});

test("a source originally hidden stays hidden after Walk ends", () => {
  const f = fixture();
  f.source.visible = false;
  f.presence.update({ active: true });
  f.presence.update({ active: false });
  assert.equal(f.source.visible, false);
  f.presence.dispose();
});

test("native optical offset is measured in bind/idle space independently of the source's routine pose", () => {
  const f = fixture();
  assert.ok(Math.abs(f.presence.opticalForwardOffset - 0.11) < 1e-7);
  f.presence.update({ active: true, position: [3, 2.6, -4], yaw: 1.2 });
  assert.ok(Math.abs(f.presence.opticalForwardOffset - 0.11) < 1e-7);
  const next = avatar();
  next.source.position.set(10, 2.6, 12);
  next.source.rotation.y = 0.8;
  next.head.rotation.x = 0.7;
  for (const eye of next.head.children) eye.position.z = 0.2;
  f.presence.setSource(next.source, next.clips);
  assert.ok(Math.abs(f.presence.opticalForwardOffset - 0.2) < 1e-7, "sleep/reading head tilt does not rotate the optical measurement");
  assert.ok(Math.abs(f.presence.evidence().opticalEyeOffset[0]) < 1e-7);
  f.presence.setSource(null);
  assert.equal(f.presence.opticalForwardOffset, 0);
  f.presence.dispose();
});

test("an obsolete asynchronous warmup cannot steal visibility or clipping from a replacement avatar", async () => {
  const f = fixture(),
    next = avatar(),
    releases = [],
    variants = [];
  f.renderer.compileAsync = () =>
    new Promise((resolve) => {
      variants.push(Boolean(next.material.clippingPlanes));
      releases.push(resolve);
    });
  const obsolete = f.presence.prepare({ scene: f.scene, camera: f.camera });
  f.presence.setSource(next.source, next.clips);
  f.scene.add(next.source);
  const current = f.presence.prepare({ scene: f.scene, camera: f.camera });
  releases.shift()();
  await obsolete;
  assert.equal(f.source.visible, true);
  assert.equal(next.source.visible, true, "driver polling never hides the current routine between frames");
  releases.shift()();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(variants.at(-1), true, "the replacement warms its primary clipped program too");
  releases.shift()();
  await current;
  assert.equal(next.source.visible, true);
  assert.equal(next.material.clippingPlanes, null);
  assert.equal(f.renderer.localClippingEnabled, false);
  assert.equal(f.presence.evidence().prepared, true);
  f.presence.dispose();
});

test("driver polling retains no render target, visibility, clipping or shadow mutation between warmup submissions", async () => {
  const f = fixture(),
    releases = [],
    originalTarget = f.renderer.getRenderTarget();
  f.renderer.compileAsync = (body, camera, lightingScene) => {
    assert.equal(body, f.presence.object.children[0], "compile only the avatar while using real scene lighting");
    assert.equal(lightingScene, f.scene);
    assert.equal(camera, f.camera);
    return new Promise((resolve) => releases.push(resolve));
  };
  const pending = f.presence.prepare({ scene: f.scene, camera: f.camera });
  function restored() {
    assert.equal(f.renderer.getRenderTarget(), originalTarget);
    assert.equal(f.source.visible, true);
    assert.equal(f.presence.object.visible, false);
    assert.equal(f.material.clippingPlanes, null);
    assert.equal(f.renderer.localClippingEnabled, false);
    assert.equal(f.renderer.shadowMap.autoUpdate, true);
    assert.equal(f.renderer.shadowMap.needsUpdate, true);
    assert.equal(f.renderer.xr.enabled, true);
    assert.equal(f.renderer.autoClear, false);
  }
  restored();
  f.presence.withoutHead(() => assert.equal(f.material.clippingPlanes, null, "ordinary frames stay unclipped during inactive warmup"));
  releases.shift()();
  await Promise.resolve();
  await Promise.resolve();
  restored();
  assert.deepEqual(
    f.draws.map((d) => d.clipped),
    [false, true],
    "the actual one-pixel draws prime both native variants"
  );
  releases.shift()();
  await pending;
  restored();
  f.presence.dispose();
});

test("ephemeral held props are excluded and optional first-person geometry cannot write un-clipped volume depth", () => {
  const f = fixture(),
    prop = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  prop.name = "routine-book";
  prop.userData.activityProp = "book";
  f.head.add(prop);
  f.presence.setSource(null);
  f.presence.setSource(f.source, f.clips);
  assert.equal(f.presence.object.getObjectByName("routine-book"), undefined);
  assert.equal(prop.parent, f.head, "routine ownership and source contact remain unchanged");
  assert.equal(f.presence.object.userData.noVolumeDepth, true);
  f.presence.object.traverse((part) => {
    if (part.isMesh) assert.equal(part.userData.noVolumeDepth, true);
  });
  assert.equal(f.mesh.userData.noVolumeDepth, undefined, "shared source metadata is not changed");
  f.presence.dispose();
});

test("a failed actual clipped warmup draw restores shared state and releases the one-pixel target", async () => {
  const f = fixture(),
    render = f.renderer.render,
    originalTarget = f.renderer.getRenderTarget();
  f.renderer.render = (scene) => {
    if (f.material.clippingPlanes) throw new Error("prime draw failed");
    render(scene);
  };
  await assert.rejects(f.presence.prepare({ scene: f.scene, camera: f.camera }), /prime draw failed/);
  assert.equal(f.material.clippingPlanes, null);
  assert.equal(f.renderer.localClippingEnabled, false);
  assert.equal(f.renderer.getRenderTarget(), originalTarget);
  assert.equal(f.source.visible, true);
  assert.equal(f.presence.object.visible, false);
  assert.equal(f.renderer.shadowMap.autoUpdate, true);
  assert.equal(f.renderer.shadowMap.needsUpdate, true);
  assert.equal(f.probeDisposals(), 1);
  f.presence.dispose();
});

test("primary draws submit a body-only index for rigid Head-owned triangles; shadows, mirrors and the source keep the head", () => {
  const f = fixture();
  // One rigid body triangle (Hips) and one rigid head triangle (Head), as in the delivered rigs.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.8, 0, 0.1, 0.8, 0, 0, 1.0, 0, 0, 1.3, 0, 0.1, 1.3, 0, 0, 1.5, 0], 3));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  geometry.setIndex([0, 1, 2, 3, 4, 5]);
  const face = new THREE.SkinnedMesh(geometry, f.material);
  face.name = "jaw";
  f.source.add(face);
  f.source.updateMatrixWorld(true);
  face.bind(f.skeleton);
  f.presence.setSource(null);
  f.presence.setSource(f.source, f.clips);
  f.presence.update({ active: true, position: [0, 0, 0], elapsed: 0, reduced: true });
  assert.deepEqual(f.presence.evidence().primaryHeadExclusion, { primitives: 1, triangles: 1 });
  const walking = f.presence.object.getObjectByName("jaw"),
    full = geometry.index,
    draw = () => {
      walking.onBeforeRender(f.renderer, f.scene, f.camera, geometry, f.material, null);
      const submitted = Array.from(geometry.index.array);
      walking.onAfterRender(f.renderer, f.scene, f.camera, geometry, f.material, null);
      return submitted;
    };
  assert.equal(walking.geometry, geometry, "the walking clone shares the delivered geometry");
  assert.deepEqual(draw(), [0, 1, 2, 3, 4, 5], "mirror and other draws outside the primary scope see the whole person");
  f.presence.withoutHead(() => {
    assert.deepEqual(draw(), [0, 1, 2], "the primary view draws only the body triangle");
    assert.equal(geometry.index, full, "the full index returns after each draw");
  });
  assert.equal(walking.onBeforeShadow, THREE.Object3D.prototype.onBeforeShadow, "the shadow pass is untouched and keeps the head");
  assert.throws(
    () =>
      f.presence.withoutHead(() => {
        walking.onBeforeRender(f.renderer, f.scene, f.camera, geometry, f.material, null);
        throw new Error("draw failed mid-pass");
      }),
    /mid-pass/
  );
  assert.equal(geometry.index, full, "a failed primary draw cannot leave the shared geometry headless");
  const rebuilt = f.presence.evidence().primaryHeadExclusion;
  f.presence.setSource(null);
  f.presence.setSource(f.source, f.clips);
  assert.deepEqual(f.presence.evidence().primaryHeadExclusion, rebuilt, "a style switch reuses the cached body-only index");
  f.presence.dispose();
});
