import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "../assets/js/three.module.min.js";
import { createRoofLift, ROOF_LIFT, roofLiftPose } from "../assets/js/home-scene/roof-lift.mjs";

test("roof opens from back to front, fades after rising, and returns along the same curve", () => {
  assert.equal(ROOF_LIFT.seconds, 0.4);
  assert.equal(roofLiftPose(0, 0).onSeat, true);
  assert.equal(roofLiftPose(0.12, 1).onSeat, true);
  const early = roofLiftPose(0.12, 0);
  assert.ok(early.lift > 0 && early.opacity < 1);
  const halfway = roofLiftPose(0.5, 0);
  assert.ok(halfway.lift > 0.3 && halfway.opacity > 0 && halfway.opacity < 1);
  assert.equal(roofLiftPose(1, 0.7).gone, true);
  assert.equal(roofLiftPose(1, 0.7).lift, 0.5);
});

test("exact roof and rooted plant geometry follows the lift while native transforms stay on the seat", () => {
  const scene = new THREE.Scene();
  const world = new THREE.Group();
  scene.add(world);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), new THREE.MeshStandardMaterial());
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 3), new THREE.MeshStandardMaterial());
  const mainlandLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 3), new THREE.MeshStandardMaterial());
  roof.position.set(1, 5, 2);
  leaf.position.set(0.6, 5.65, 2);
  world.add(roof, leaf, mainlandLeaf);
  scene.updateMatrixWorld(true);
  const original = [roof.matrixWorld.clone(), leaf.matrixWorld.clone()];
  const plants = [{ plant: leaf, support: roof }];
  const lift = createRoofLift(scene);
  lift.sync([roof], plants, false);
  lift.sync([roof], plants, true, { dt: 0.08 });
  const moving = scene.getObjectByName("Moving section roof");
  const [proxy, companion] = moving.children;
  assert.equal(lift.evidence().moving, 1);
  assert.equal(roof.visible, false);
  assert.equal(leaf.visible, false);
  assert.equal(mainlandLeaf.visible, true);
  assert.equal(proxy.geometry, roof.geometry);
  assert.equal(companion.geometry, leaf.geometry);
  assert.ok(proxy.matrix.elements[13] > roof.position.y);
  assert.ok(Math.abs(proxy.matrix.elements[13] - roof.position.y - (companion.matrix.elements[13] - leaf.position.y)) < 1e-8);
  assert.ok(roof.matrixWorld.equals(original[0]) && leaf.matrixWorld.equals(original[1]));
  assert.ok(proxy.material.transparent && proxy.material.depthWrite === false);
  assert.equal(roof.material.transparent, false);
  // A direction change from the same frame recovers without a jump.
  const partial = lift.evidence().progress;
  lift.sync([roof], plants, false, { dt: 0.02 });
  assert.ok(Math.abs(lift.evidence().progress - (partial - 0.05)) < 1e-8);
  // A walking or reduced-motion request restores the native enclosure now.
  lift.sync([roof], plants, false, { instant: true });
  assert.ok(roof.visible && leaf.visible && !moving.visible && !lift.sectionOpen && !lift.busy);
  lift.sync([roof], plants, true, { dt: 0.08 });
  lift.settle();
  assert.ok(!roof.visible && !leaf.visible && !moving.visible && lift.sectionOpen && !lift.busy);
  lift.dispose();
  assert.equal(moving.parent, null);
});

test("local ceiling bays lift in the ordinary whole-home section and seat on the way into a room", () => {
  const scene = new THREE.Scene();
  const main = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const bay = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  bay.userData.cutawayOverviewOnly = true;
  scene.add(main, bay);
  const lift = createRoofLift(scene);
  lift.sync([main, bay], [], true, { overview: false });
  assert.deepEqual(lift.sectionPieces, [main]);
  assert.equal(main.visible, false);
  assert.equal(bay.visible, true);

  lift.sync([main, bay], [], true, { overview: true, dt: 0.14 });
  assert.deepEqual(lift.sectionPieces, [main, bay]);
  assert.equal(lift.evidence().moving, 1);
  assert.equal(bay.visible, false);
  assert.equal(lift.busy, true);
  lift.settle();

  lift.sync([main, bay], [], true, { overview: false, dt: 0.12 });
  assert.equal(lift.evidence().moving, 1);
  assert.equal(lift.evidence().progress, 1);
  lift.sync([main, bay], [], true, { overview: false, instant: true });
  assert.deepEqual(lift.sectionPieces, [main]);
  assert.equal(bay.visible, true);
  assert.equal(lift.evidence().overviewProgress, 0);
  assert.equal(lift.busy, false);
  lift.dispose();
});
