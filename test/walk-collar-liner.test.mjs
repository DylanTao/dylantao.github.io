import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadNativeAvatar, THREE } from "./helpers/coastal-native-avatar.mjs";
import { createWalkPresence, cloneWalkSkeleton } from "../assets/js/home-scene/walk-presence.mjs";
import { createWalkCollarLiner } from "../assets/js/home-scene/walk-collar-liner.mjs";

const avatars = ["ghibli", "lizard", "south-park", "simpsons", "rick-and-morty"];
const hash = (array) =>
  createHash("sha256")
    .update(Buffer.from(array.buffer, array.byteOffset, array.byteLength))
    .digest("hex");
const bones = (root) => {
  const rows = [];
  root.traverse((o) => {
    if (o.isBone) rows.push([o.name, ...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()]);
  });
  return JSON.stringify(rows);
};
const linerOf = (presence) => presence.object.getObjectByName("primary-native-collar-liner");

for (const id of avatars) {
  test(`${id}: native collar fit is independent of source routine pose and equals the full-scan reference`, async () => {
    const native = await loadNativeAvatar(id),
      mixer = new THREE.AnimationMixer(native.scene);
    let canonical;
    for (const pose of ["idle", "sleep", "soak", "walk"]) {
      mixer.stopAllAction();
      const clip = native.animations.find((c) => c.name === pose),
        action = mixer.clipAction(clip).reset().play();
      mixer.setTime(pose === "idle" ? 0 : clip.duration * 0.37);
      native.scene.updateMatrixWorld(true);
      const original = bones(native.scene),
        presence = createWalkPresence({ renderer: {} });
      presence.setSource(native.scene, native.animations);
      assert.equal(presence.evidence().collarFailure, null);
      const body = presence.object.getObjectByName("walk-avatar"),
        liner = linerOf(presence);
      assert.ok(liner, `${id} retains a native fitted liner`);
      const fitted = hash(liner.geometry.attributes.position.array);
      canonical ??= fitted;
      assert.equal(fitted, canonical, `${pose} does not leak its routine bone pose into the fitting`);
      assert.equal(bones(native.scene), original, "the routine skeleton remains untouched");
      const cut = body.getObjectByName("Head").getWorldPosition(new THREE.Vector3()).y + 0.04;
      const full = createWalkCollarLiner(body, cut, { fullScan: true });
      assert.equal(hash(full.group.children[0].geometry.attributes.position.array), fitted, "narrow initialization preserves exact anatomy");
      assert.equal(liner.castShadow, false);
      assert.equal(liner.userData.noVolumeDepth, true);
      assert.equal(liner.parent.visible, false, "the liner never appears in ordinary/mirror draws");
      full.dispose();
      presence.dispose();
      action.stop();
    }
  });

  test(`${id}: complete native idle/walk cycles keep the bounded liner finite and primary-only`, async () => {
    const native = await loadNativeAvatar(id);
    for (const clipName of ["idle", "walk"]) {
      const presence = createWalkPresence({ renderer: {} });
      presence.setSource(native.scene, native.animations);
      const liner = linerOf(presence),
        duration = native.animations.find((c) => c.name === clipName).duration;
      let vertexCalls = 0;
      presence.object.traverse((m) => {
        if (m.isSkinnedMesh) {
          const previous = m.getVertexPosition;
          m.getVertexPosition = function (...args) {
            vertexCalls++;
            return previous.apply(this, args);
          };
        }
      });
      for (let i = 0; i <= 120; i++) {
        vertexCalls = 0;
        presence.update({
          active: true,
          position: [0, 0, clipName === "walk" ? (2.5 * i) / 120 : 0],
          yaw: 0,
          velocity: clipName === "walk" ? [0, 2.5 / duration] : [0, 0],
          elapsed: (duration * i) / 120,
        });
        assert.ok(vertexCalls <= 512, "only the retained native boundary samples are evaluated");
        const e = presence.evidence();
        assert.equal(e.collarFailure, null);
        assert.equal(e.collarLiner.perFrameCuts, 0);
        assert.ok(e.collarLiner.maximumInset < 0.0025, "the fitted ends stay inside the measured native neck/cloth overlap");
        assert.ok([...liner.geometry.attributes.position.array].every(Number.isFinite));
        presence.withoutHead(() => assert.equal(liner.parent.visible, true));
        assert.equal(liner.parent.visible, false, "the primary scope restores before reflections/shadows");
      }
      const e = presence.evidence();
      if (clipName === "walk") assert.ok(e.gaitTime >= duration - 1e-6, "the sweep reaches the complete native gait cycle");
      else assert.ok(e.idleTime >= duration - 1e-6, "the sweep reaches the complete idle cycle");
      presence.dispose();
    }
  });
}

test("the Ghibli collar liner closes actual native trouser sightlines through complete idle and walk cycles", async () => {
  const native = await loadNativeAvatar("ghibli");
  for (const clipName of ["idle", "walk"]) {
    const presence = createWalkPresence({ renderer: {} });
    presence.setSource(native.scene, native.animations);
    const liner = linerOf(presence),
      meshes = [];
    presence.object.traverse((m) => {
      if (m.isSkinnedMesh) meshes.push(m);
    });
    const camera = new THREE.PerspectiveCamera(62, 1.25, 0.025, 50),
      rays = new THREE.Raycaster(),
      duration = native.animations.find((c) => c.name === clipName).duration;
    let negativeControl = 0;
    for (let i = 0; i <= 120; i++) {
      const z = clipName === "walk" ? (2.5 * i) / 120 : 0;
      presence.update({
        active: true,
        position: [0, 0, z],
        yaw: 0,
        velocity: clipName === "walk" ? [0, 2.5 / duration] : [0, 0],
        elapsed: (duration * i) / 120,
      });
      if (i % 10) continue;
      camera.position.set(0, 1.6, z + Math.min(0.14, presence.opticalForwardOffset));
      camera.lookAt(camera.position.clone().add(new THREE.Vector3(0, -Math.sin(1.4), Math.cos(1.4))));
      camera.updateMatrixWorld(true);
      presence.object.updateWorldMatrix(true, true);
      for (const y of [580, 600, 620]) {
        rays.setFromCamera(new THREE.Vector2(0, 1 - y / 400), camera);
        const nativeHits = rays.intersectObjects(meshes, false).filter((h) => h.point.y <= presence.evidence().headCutHeight);
        if (nativeHits[0]?.object.material.name === "olive trousers") negativeControl++;
        const withLiner = rays.intersectObjects([...meshes, liner], false).filter((h) => h.point.y <= presence.evidence().headCutHeight);
        assert.equal(withLiner[0]?.object.material.name, "skin", `${clipName} ${i}/120 closes the actual collar sightline ${y}`);
      }
    }
    assert.ok(negativeControl > 10, "the unchanged native mesh still exhibits the diagnosed opening");
    presence.dispose();
  }
});

test("receiver appearance, failed draws, replacement and unsupported garments preserve borrowed native assets", async () => {
  const native = await loadNativeAvatar("ghibli"),
    presence = createWalkPresence({ renderer: {} });
  let nativeDisposals = 0;
  native.scene.traverse((m) => {
    if (m.isMesh) {
      m.geometry.addEventListener("dispose", () => nativeDisposals++);
      m.material.addEventListener("dispose", () => nativeDisposals++);
    }
  });
  presence.setSource(native.scene, native.animations);
  presence.update({ active: true, elapsed: 0 });
  const liner = linerOf(presence),
    body = presence.object.getObjectByName("walk-avatar"),
    skin = body.getObjectByName(presence.evidence().collarLiner.skinMesh);
  const replacement = skin.material.clone();
  replacement.color.set(0xd9ba97);
  skin.material = replacement;
  presence.refreshMaterials();
  assert.throws(
    () =>
      presence.withoutHead(() => {
        assert.equal(liner.material, replacement);
        throw new Error("failed primary draw");
      }),
    /failed primary draw/
  );
  assert.equal(liner.parent.visible, false);
  assert.equal(replacement.clippingPlanes, null);
  let ownDisposals = 0;
  liner.geometry.addEventListener("dispose", () => ownDisposals++);
  // A fresh native load retains the original skeleton correspondence for failure recovery.
  const next = await loadNativeAvatar("lizard");
  next.scene.traverse((m) => {
    if (m.isMesh && m.material.name === "Sirui shirt") m.material.name = "unsupported future garment";
  });
  presence.setSource(next.scene, next.animations);
  presence.update({ active: true, elapsed: 1 });
  assert.ok(presence.evidence().collarFailure);
  assert.equal(presence.evidence().active, true);
  assert.equal(presence.evidence().skeletons, 1);
  assert.equal(ownDisposals, 1);
  assert.equal(nativeDisposals, 0, "only the owned liner/skeleton are released");
  presence.dispose();
  replacement.dispose();
});

test("a failed initial native-boundary update removes and releases the unfinished liner", async () => {
  const native = await loadNativeAvatar("ghibli"),
    body = cloneWalkSkeleton(native.scene),
    originals = [];
  const nativeGeometries = new Set();
  body.traverse((mesh) => {
    if (mesh.isSkinnedMesh) {
      nativeGeometries.add(mesh.geometry);
      originals.push([mesh, mesh.getVertexPosition]);
      const get = mesh.getVertexPosition;
      mesh.getVertexPosition = function (...args) {
        if (body.getObjectByName("primary-collar-liner")) throw new Error("injected initial update failure");
        return get.apply(this, args);
      };
    }
  });
  const previous = THREE.BufferGeometry.prototype.dispose;
  let owned = 0,
    borrowed = 0;
  THREE.BufferGeometry.prototype.dispose = function () {
    if (nativeGeometries.has(this)) borrowed++;
    else owned++;
    return previous.call(this);
  };
  try {
    assert.throws(() => createWalkCollarLiner(body, 1.4000000143051148), /injected initial update failure/);
    assert.equal(body.getObjectByName("primary-collar-liner"), undefined);
    assert.equal(owned, 1);
    assert.equal(borrowed, 0);
  } finally {
    THREE.BufferGeometry.prototype.dispose = previous;
    for (const [mesh, get] of originals) mesh.getVertexPosition = get;
  }
  const recovery = createWalkCollarLiner(body, 1.4000000143051148);
  assert.equal(recovery.evidence().vertices, 320);
  recovery.dispose();
});
