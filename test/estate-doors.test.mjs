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
