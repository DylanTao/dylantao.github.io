import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/js/three.module.min.js";
import { createCameraField } from "../assets/js/home-scene/camera-field.mjs";

// Node has no module Worker, so the field runs its main-thread slices: the same hold and release.
const settle = async (tasks = 200) => {
  for (let i = 0; i < tasks; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

function scene() {
  const config = { rooms: [{ id: "study", target: [0, 1, 0], camera: { yaw: 0.4, pitch: 0.2, radius: 3 } }] };
  const world = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.3), new THREE.MeshBasicMaterial());
  wall.position.set(0, 1.5, -2);
  world.add(wall);
  return { config, world };
}

test("a held camera field voxelizes arriving models but classifies only once released", async () => {
  const { config, world } = scene();
  let classified = 0;
  const field = createCameraField({ config, world, onReady: () => classified++, hold: true });
  field.addRoot(world);
  await settle();
  assert.equal(classified, 0, "no full-grid classification while the arrival is still loading");
  assert.equal(field.ready, false);
  assert.equal(field.evidence().holding, true);
  field.release();
  await settle();
  assert.equal(classified, 1, "one classification for everything that arrived");
  assert.equal(field.ready, true);
  assert.equal(field.evidence().holding, false);
});

test("an unheld camera field classifies as each model arrives, as before", async () => {
  const { config, world } = scene();
  let classified = 0;
  const field = createCameraField({ config, world, onReady: () => classified++ });
  field.addRoot(world);
  await settle();
  assert.equal(classified, 1);
  assert.equal(field.ready, true);
});
