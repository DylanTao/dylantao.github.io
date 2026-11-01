import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../assets/js/three.module.min.js";
import { createGymProps } from "../assets/js/home-scene/gym-props.mjs";
import { createLightInstallations } from "../assets/js/home-scene/light-installations.mjs";

test("moving gym equipment retains its emitters while the actual digital face is self-lit", () => {
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
      const canvas = { width: 0, height: 0 };
      const context = new Proxy({ canvas }, { get: (target, key) => (key in target ? target[key] : () => {}) });
      canvas.getContext = () => context;
      return canvas;
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
    assert.equal(created.length, 10, "all ten physical equipment materials still pass through the gym receiver factory");
    assert.notEqual(face.material, original);
    assert.equal(face.userData.fixedMaterial, true);
    for (const material of created) {
      assert.equal(material.userData.installationGroup, "gym");
      assert.equal(material.userData.installationReceiverGroup, "gym");
    }
    assert.equal(face.material.isMeshStandardMaterial, true);
    assert.equal(face.material.emissiveMap, face.material.map, "a digital screen's pixels emit independently of the room's schedule");
    assert.ok(
      face.material.color.toArray().every((x) => x < 0.004),
      "the static collector sees a dark diffuse surface, not a bright white wall"
    );
    assert.equal(face.material.toneMapped, false);
    assert.equal(face.material.map.image.width, 2048);
    assert.equal(face.material.map.image.height, 1392);
    assert.equal(face.material.map.repeat.x, -1, "the board keeps its readable authored orientation");
    assert.equal(face.material.map.flipY, false);
    assert.deepEqual(props.screenObjects(), [face]);
    assert.deepEqual(face.userData.action, { type: "training-screen" });
    props.drawBoard(null);
    const version = face.material.map.version;
    for (let i = 0; i < 1000; i++) assert.equal(props.drawBoard(null), false);
    assert.equal(face.material.map.version, version, "unchanged frames never upload the large texture");
    props.setDisplay({ view: "progress", unit: "kg", lift: "bench" });
    assert.equal(face.material.map.version, version + 1, "a real display interaction uploads exactly once");
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
