import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createEstateDoors, nearDoor } from "../assets/js/home-scene/estate-doors.mjs";

function fixture() {
  const root = new THREE.Group();
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.3, 0.06), new THREE.MeshStandardMaterial());
  leaf.position.set(-2.8, 1.15, 7.35);
  leaf.userData.estateDoor = "main";
  leaf.userData.slideX = -1.6;
  root.add(leaf);
  const doors = createEstateDoors(root);
  return { leaf, doors, rest: leaf.position.clone(), bounds: new THREE.Box3().setFromObject(leaf) };
}

test("the entry sensor uses the real framed opening and the walker's floor", () => {
  const { bounds } = fixture();
  assert.equal(nearDoor(bounds, { active: true, position: [-2.8, 0, 9.8] }), true);
  assert.equal(nearDoor(bounds, { active: true, position: [-2.8, 2.6, 7.35] }), false);
  assert.equal(nearDoor(bounds, { active: false, position: [-2.8, 0, 7.35] }), false);
  assert.equal(nearDoor(bounds, { active: true, position: [-2.8, 0, 11] }), false);
});

test("a walking arrival opens the physical leaf and holds it clear until the capsule leaves", () => {
  const { leaf, doors, rest } = fixture();
  const walk = { active: true, position: [-2.8, 0, 9.8] };
  doors.update(0.3, { walk });
  assert.ok(leaf.position.x < rest.x && leaf.position.x > rest.x - 1.6);
  assert.equal(doors.moving, true);
  doors.update(0.3, { walk });
  assert.equal(leaf.position.x, rest.x - 1.6);
  assert.equal(doors.moving, false);
  walk.position = [-2.8, 0, 7.35];
  doors.update(1, { walk });
  assert.equal(leaf.position.x, rest.x - 1.6, "never close on the capsule");
  walk.position = [-2.8, 0, 3];
  doors.update(0.6, { walk });
  assert.equal(leaf.position.x, rest.x);
});

test("reduced motion snaps functional doors and disposal restores the authored pose", () => {
  const { leaf, doors, rest } = fixture();
  doors.update(0, { walk: { active: true, position: [-2.8, 0, 7.35] }, reduced: true });
  assert.equal(leaf.position.x, rest.x - 1.6);
  assert.equal(doors.moving, false);
  doors.dispose();
  assert.deepEqual(leaf.position.toArray(), rest.toArray());
  assert.equal(doors.update(1, { walk: { active: true, position: [-2.8, 0, 7.35] } }), false);
});

test("autonomous house occupants open the same physical leaf on their actual storey", () => {
  const { leaf, doors, rest } = fixture();
  const visitor = { active: true, position: [-2.8, 0, 8] };
  try {
    doors.update(0.6, { visitors: [{ ...visitor, position: [-2.8, 2.6, 8] }] });
    assert.equal(leaf.position.x, rest.x, "someone upstairs does not open the lower foyer");
    doors.update(0.6, { visitors: [visitor] });
    assert.equal(leaf.position.x, rest.x - 1.6, "a real base pose admits Sirui or P without a walking visitor");
    visitor.active = false;
    doors.update(0.6, { visitors: [visitor] });
    assert.equal(leaf.position.x, rest.x, "page-owned or hidden P cannot hold a door open");
  } finally {
    doors.dispose();
  }
});

test("material-batched glass and pulls travel together as one logical threshold", () => {
  const root = new THREE.Group();
  const parts = [new THREE.BoxGeometry(1.5, 2.3, 0.06), new THREE.BoxGeometry(0.04, 0.5, 0.07)].map((geometry, i) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.position.set(-2.8 + i * 0.5, 1.15, 7.35 + i * 0.04);
    mesh.userData.estateDoor = "main";
    root.add(mesh);
    return mesh;
  });
  const rest = parts.map((mesh) => mesh.position.clone());
  const doors = createEstateDoors(root, [{ id: "main", slideX: -1.56 }]);
  doors.update(0.6, { walk: { active: true, position: [-2.8, 0, 8] } });
  assert.equal(doors.evidence().doors.length, 1);
  assert.equal(doors.objects.length, 2);
  parts.forEach((mesh, i) => assert.deepEqual(mesh.position.toArray(), [rest[i].x - 1.56, rest[i].y, rest[i].z]));
  doors.dispose();
  parts.forEach((mesh, i) => assert.deepEqual(mesh.position.toArray(), rest[i].toArray()));
});

test("a pivot leaf turns its batched parts about the authored axis and closes back flush", () => {
  // The living's main entrance: a 1.5 m sandstone leaf in the back wall (z 15.62..15.72) whose axis
  // stands 0.35 m in from its west jamb; it turns a quarter into the stair hall behind the wall.
  const root = new THREE.Group();
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 0.1), new THREE.MeshStandardMaterial());
  leaf.geometry.translate(0, 1.5, 15.67);
  const pull = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.9, 0.03), new THREE.MeshStandardMaterial());
  pull.geometry.translate(0.59, 1.25, 15.77);
  for (const mesh of [leaf, pull]) {
    mesh.userData.estateDoor = "main";
    root.add(mesh);
  }
  const doors = createEstateDoors(root, [{ id: "main", pivot: { x: -0.4, z: 15.67, angle: -Math.PI / 2 }, activationDistance: 2.4 }]);
  doors.update(0, { walk: { active: true, position: [0.2, 0, 14.4] }, reduced: true });
  root.updateMatrixWorld(true);
  const open = new THREE.Box3().setFromObject(leaf);
  assert.ok(Math.abs(open.min.x + 0.45) < 0.01 && Math.abs(open.max.x + 0.35) < 0.01, "the open leaf stands edge-on at the axis");
  assert.ok(
    Math.abs(open.min.z - 15.32) < 0.01 && Math.abs(open.max.z - 16.82) < 0.01,
    "the long side turns into the hall, the short side into the living"
  );
  const handle = new THREE.Box3().setFromObject(pull);
  assert.ok(handle.max.x < -0.2 && handle.min.z > 16.5, "the pull travels with the leaf");
  assert.ok(Math.abs(doors.evidence().doors[0].angle + Math.PI / 2) < 1e-9);
  doors.update(0, { walk: { active: true, position: [0.2, 0, 9] }, reduced: true });
  root.updateMatrixWorld(true);
  const closed = new THREE.Box3().setFromObject(leaf);
  assert.ok(Math.abs(closed.min.x + 0.75) < 1e-6 && Math.abs(closed.max.z - 15.72) < 1e-6, "closed flush with the wall again");
  doors.dispose();
});

test("a pivot needs a real axis and a real turn", () => {
  const root = new THREE.Group();
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.1), new THREE.MeshStandardMaterial());
  leaf.userData.estateDoor = "main";
  root.add(leaf);
  assert.throws(() => createEstateDoors(root, [{ id: "main", pivot: { x: 0, z: 0, angle: 0.1 } }]), /Invalid pivot/);
});
