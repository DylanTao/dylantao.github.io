import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createLibraryLadder, LADDER_MOTION } from "../assets/js/home-scene/library-ladder.mjs";

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

function fixture(transformed = false) {
  const root = new THREE.Group(),
    parentA = new THREE.Group(),
    parentB = new THREE.Group(),
    material = new THREE.MeshStandardMaterial();
  root.add(parentA, parentB);
  if (transformed) {
    root.position.set(2, 1, -3);
    root.rotation.y = -0.3;
    parentA.position.set(1, 0.2, 2);
    parentA.rotation.set(0.2, 0.8, 0.1);
    parentA.scale.set(2, 1.3, 0.7);
    parentB.position.set(-1, 0.4, 0.5);
    parentB.rotation.set(-0.2, -0.4, 0.3);
  }
  const parts = [new THREE.Mesh(new THREE.BoxGeometry(0.56, 3, 0.26), material), new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.3), material)];
  parts.forEach((object, i) => {
    object.name = `ladder-${i}`;
    object.position.set(0, i ? 0.05 : 1.5, i * 0.05);
    object.userData.libraryLadder = true;
    (i ? parentB : parentA).add(object);
  });
  root.updateMatrixWorld(true);
  const initial = parts.map((object) => ({
    position: object.position.clone(),
    world: object.getWorldPosition(new THREE.Vector3()),
    matrix: object.matrix.clone(),
  }));
  const definition = { nodes: parts.map((object) => object.name), travelAxis: "z", travel: [-1.8, 1.8], rest: 0, climbable: false };
  return { root, parts, initial, definition, rig: createLibraryLadder(root, definition), material };
}

test("all native parts roll together along world z under translated, rotated and scaled parents", () => {
  const { rig, parts, initial } = fixture(true);
  assert.equal(rig.activate(), true);
  assert.equal(rig.moving, true);
  assert.equal(rig.update(1), true);
  close(rig.evidence().position, LADDER_MOTION.speed);
  parts.forEach((part, i) => {
    const world = part.getWorldPosition(new THREE.Vector3());
    close(world.x, initial[i].world.x);
    close(world.y, initial[i].world.y);
    close(world.z, initial[i].world.z + LADDER_MOTION.speed);
    assert.deepEqual(part.userData.action, { type: "library-ladder" });
    assert.equal(part.userData.dynamic, true);
  });
  rig.update(100);
  close(rig.evidence().position, 1.8);
  assert.equal(rig.moving, false);
  rig.toggle();
  rig.update(100);
  close(rig.evidence().position, -1.8);
  assert.equal(rig.moving, false);
});

test("pause holds the assembly and reduced motion composes a safe endpoint without animation", () => {
  const { rig, parts, initial } = fixture();
  rig.activate();
  assert.equal(rig.update(100, { paused: true, reduced: true }), false);
  assert.equal(rig.moving, false);
  close(rig.evidence().position, 0);
  parts.forEach((part, i) => assert.deepEqual(part.position.toArray(), initial[i].position.toArray()));
  assert.equal(rig.update(0, { reduced: true }), true);
  close(rig.evidence().position, 1.8);
  assert.equal(rig.moving, false);
  rig.activate();
  rig.update(0.5);
  close(rig.evidence().position, 1.45);
  rig.update(NaN);
  rig.update(-10);
  close(rig.evidence().position, 1.45);
});

test("the whole proposed sweep blocks on the active visitor and resumes only after they clear", () => {
  const { rig } = fixture(),
    walk = { active: true, position: [0, 0, 1.1] };
  rig.activate();
  assert.equal(rig.update(10, { walk }), false, "a long frame must not tunnel through the capsule");
  close(rig.evidence().position, 0);
  assert.equal(rig.evidence().blocked, true);
  assert.equal(rig.moving, false, "the held target does not demand a separate spin loop");
  assert.equal(rig.update(0, { walk, reduced: true }), false, "a reduced-motion snap checks the entire sweep too");
  walk.position[0] = 2;
  assert.equal(rig.update(1, { walk }), true);
  close(rig.evidence().position, 0.7);
  assert.equal(rig.evidence().blocked, false);
  assert.equal(rig.moving, true);
});

test("capsule expansion and foot-to-head overlap protect nearby visitors without blocking another floor", () => {
  const { rig } = fixture(),
    walk = { active: true, position: [0.55, -1, 1] };
  rig.activate();
  assert.equal(rig.update(10, { walk }), false, "head overlap counts even when the feet are below the ladder");
  walk.position[1] = 3.1;
  assert.equal(rig.update(10, { walk }), true, "a wholly higher body is clear");
  rig.toggle();
  walk.position = [0, -2, 0];
  assert.equal(rig.update(10, { walk }), true, "a wholly lower body is clear");
});

test("inactive visitors do not obstruct and toggling mid-travel reverses within both bounds", () => {
  const { rig } = fixture();
  rig.activate();
  rig.update(1, { walk: { active: false, position: [0, 0, 0.5] } });
  close(rig.evidence().position, 0.7);
  rig.toggle();
  rig.update(1);
  close(rig.evidence().position, 0);
  rig.update(100);
  close(rig.evidence().position, -1.8);
  rig.activate();
  rig.update(100);
  close(rig.evidence().position, 1.8);
});

test("nested selected meshes move once, preserve shared GPU assets and restore owned state", () => {
  const root = new THREE.Group(),
    material = new THREE.MeshBasicMaterial(),
    outer = new THREE.Mesh(new THREE.BoxGeometry(0.56, 3, 0.26), material),
    inner = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), material);
  outer.name = "outer";
  inner.name = "inner";
  outer.add(inner);
  root.add(outer);
  const oldAction = { type: "existing" };
  outer.userData.action = oldAction;
  outer.userData.dynamic = "original-value";
  const initial = inner.getWorldPosition(new THREE.Vector3()),
    rig = createLibraryLadder(root, { nodes: ["outer", "inner"], travelAxis: "z", travel: [-1.8, 1.8] });
  let disposedAssets = 0;
  for (const resource of [material, outer.geometry, inner.geometry]) resource.addEventListener("dispose", () => disposedAssets++);
  rig.activate();
  rig.update(0, { reduced: true });
  close(inner.getWorldPosition(new THREE.Vector3()).z, initial.z + 1.8);
  assert.equal(outer.material, material);
  assert.equal(inner.material, material);
  rig.dispose();
  rig.dispose();
  close(outer.position.z, 0);
  close(inner.position.z, 0);
  assert.equal(outer.userData.action, oldAction);
  assert.equal(outer.userData.dynamic, "original-value");
  assert.equal(Object.hasOwn(inner.userData, "action"), false);
  assert.equal(Object.hasOwn(inner.userData, "dynamic"), false);
  assert.equal(disposedAssets, 0);
  assert.equal(rig.moving, false);
  assert.equal(rig.activate(), false);
  assert.equal(rig.update(10), false);
});

test("an incomplete native assembly stays unavailable and leaves every part untouched", () => {
  const { root, parts, definition, rig: firstRig } = fixture();
  firstRig.dispose();
  const rig = createLibraryLadder(root, { ...definition, nodes: [...definition.nodes, "missing-wheel"] });
  assert.equal(rig.evidence().available, false);
  assert.deepEqual(rig.evidence().missingNodes, ["missing-wheel"]);
  assert.equal(rig.objects.length, 0);
  assert.equal(rig.activate(), false);
  assert.equal(rig.update(10, { reduced: true }), false);
  assert.ok(parts.every((part) => !Object.hasOwn(part.userData, "dynamic")));
});

test("GLTFLoader's sanitized names retain exact manifest assembly custody", () => {
  const { root, parts, definition, rig: firstRig } = fixture();
  firstRig.dispose();
  const nodes = ["library_ladder__pale oak", "library_ladder__brushed brass"];
  parts.forEach((part, i) => {
    part.userData.name = nodes[i];
    part.name = nodes[i].replaceAll(" ", "_");
  });
  const rig = createLibraryLadder(root, { ...definition, nodes });
  try {
    assert.equal(rig.evidence().available, true);
    assert.deepEqual(rig.evidence().missingNodes, []);
    assert.equal(rig.objects.length, nodes.length);
    assert.equal(rig.activate(), true);
    rig.update(1);
    parts.forEach((part) => assert.equal(part.userData.action.type, "library-ladder"));
  } finally {
    rig.dispose();
  }
});

test("disposal restores transformed-parent positions and does not erase another owner's later tag", () => {
  const { rig, parts, initial } = fixture(true);
  rig.activate();
  rig.update(0, { reduced: true });
  const replacementAction = { type: "another-owner" };
  parts[1].userData.action = replacementAction;
  rig.dispose();
  parts.forEach((part, i) => {
    assert.deepEqual(part.position.toArray(), initial[i].position.toArray());
    assert.ok(part.matrix.equals(initial[i].matrix));
    const world = part.getWorldPosition(new THREE.Vector3());
    close(world.x, initial[i].world.x);
    close(world.y, initial[i].world.y);
    close(world.z, initial[i].world.z);
    assert.equal(part.userData.libraryLadder, true, "the native authoring tag is not owned by the rig");
  });
  assert.equal(parts[1].userData.action, replacementAction);
});
