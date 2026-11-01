import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { createGymProps } from "../assets/js/home-scene/gym-props.mjs";
import { createLightInstallations } from "../assets/js/home-scene/light-installations.mjs";

test("the actual whiteboard replacement and moving gym materials retain their room's emitters", () => {
  const config = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
  const lights = createLightInstallations(config),
    world = new THREE.Group(),
    room = new THREE.Group(),
    original = new THREE.MeshStandardMaterial(),
    face = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.95), original),
    created = [];
  face.userData.activityProp = "whiteboard";
  room.add(face);
  world.add(room);
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "canvas");
      return { width: 0, height: 0 };
    },
  };
  let props;
  try {
    props = createGymProps({
      room,
      world,
      gym: config.equipment.gym,
      training: config.training,
      material(color, extra) {
        const result = new THREE.MeshStandardMaterial({ color, ...extra });
        created.push(result);
        return lights.bindMaterial(result);
      },
    });
    assert.ok(created.length > 10, "the real prop constructor exercised the bars, plates and board factories");
    assert.notEqual(face.material, original);
    assert.equal(face.userData.fixedMaterial, true);
    for (const material of created) {
      assert.equal(material.userData.installationGroup, "gym");
      assert.equal(material.userData.installationReceiverGroup, "gym");
    }
    assert.equal(face.material.map.image.width, 1024);
    assert.equal(face.material.map.image.height, 696);
    assert.equal(face.material.map.repeat.x, -1, "the board keeps its readable authored orientation");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    props?.dispose();
    for (const material of created) material.dispose();
    face.geometry.dispose();
    original.dispose();
    lights.dispose();
  }
});
