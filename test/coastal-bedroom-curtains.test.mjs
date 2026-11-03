import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { THREE, loadNativeModel } from "./helpers/coastal-native-avatar.mjs";
import { bedroomCurtainLayout, bedroomCurtainOpen, createBedroomCurtains } from "../assets/js/home-scene/bedroom-curtains.mjs";

test("bedroom privacy follows sleep while other activities retain the open prospect", () => {
  assert.equal(bedroomCurtainOpen({ id: "sleep" }), 0);
  for (const id of ["breakfast", "typing", "reading", "lounge", "soak", "workout", null]) assert.equal(bedroomCurtainOpen({ id }), 1);
  assert.equal(bedroomCurtainOpen(null), 1);
});

test("a missing or tilted glazing frame fails before installing guessed curtain anchors", () => {
  assert.throws(() => bedroomCurtainLayout([], 0), TypeError);
  assert.throws(
    () =>
      bedroomCurtainLayout(
        [
          [
            [0, 0, 0],
            [3, 0, 0],
            [0, 3, 1],
          ],
        ],
        0
      ),
    RangeError
  );
});

test("the bedroom orbit remains on the room side of the actual curtains throughout its authored envelope", () => {
  const config = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
  const room = config.rooms.find((r) => r.id === "sleep");
  const { envelope } = room.camera;
  for (let y = 0; y <= 12; y++)
    for (let p = 0; p <= 12; p++)
      for (let r = 0; r <= 12; r++) {
        const yaw = envelope.yaw[0] + (y / 12) * (envelope.yaw[1] - envelope.yaw[0]);
        const pitch = envelope.pitch[0] + (p / 12) * (envelope.pitch[1] - envelope.pitch[0]);
        const radius = envelope.radius[0] + (r / 12) * (envelope.radius[1] - envelope.radius[0]);
        const z = room.target[2] + radius * Math.cos(pitch) * Math.cos(yaw);
        assert.ok(z > 3.9, "third-person bedroom camera stays behind the drapes and its near plane");
      }
});

test("the actual bedroom drapes retain their aperture, opaque privacy and side access through a complete draw cycle", async () => {
  const model = await loadNativeModel("room-sleep.glb");
  const scene = new THREE.Scene();
  scene.add(model.scene);
  const rig = createBedroomCurtains({ scene, room: model.scene, floor: 1.5, reduced: true, routine: { id: "sleep" } });
  const camera = new THREE.PerspectiveCamera(50, 1.4, 0.01, 60);
  camera.position.set(-6.8, 3, 5.3);
  camera.lookAt(-6.8, 3, 3.6);
  camera.updateProjectionMatrix();
  const sample = (id, moving, reduced, time) => rig.step({ routine: { id }, delta: 1 / 30, moving, reduced, time, camera, canvasHeight: 1000 });
  const sweep = new THREE.Box3();
  const bounds = () => {
    const result = new THREE.Box3();
    for (const mesh of rig.group.children.filter((m) => m.name.startsWith("curtain sleep-"))) {
      assert.equal(mesh.material.transparent, false);
      assert.equal(mesh.material.depthWrite, true);
      const a = mesh.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) result.expandByPoint(new THREE.Vector3().fromBufferAttribute(a, i));
    }
    sweep.union(result);
    return result;
  };
  try {
    assert.equal(rig.layout.sections.length, 33);
    assert.ok(rig.layout.hardware.rodY > 4.5 && rig.layout.hardware.rodY < 4.61);
    for (const section of rig.layout.sections) assert.ok(rig.layout.hardware.rodY + 0.05 < section.top);
    sample("sleep", false, true, 0);
    assert.equal(rig.evidence().target, 0);
    const closed = bounds();
    assert.ok(closed.min.y >= 1.499 && closed.min.y < 1.6);
    assert.ok(closed.min.z > 3.45, "the actual visible cloth stays inside the glass");
    assert.ok(closed.max.z < 3.8, "the visible cloth stays in front of the wardrobe");
    assert.ok(closed.min.x > -8.4 && closed.max.x < -5.28);
    sample("typing", false, true, 0);
    assert.equal(rig.evidence().target, 1);
    const gathered = bounds();
    assert.ok(gathered.min.z > 3.45 && gathered.max.z < 3.8);
    for (let n = 1; n <= 360; n++) {
      sample(n < 180 ? "sleep" : "typing", true, false, n / 30);
      const b = bounds();
      assert.ok(b.min.z > 3.45 && b.max.z < 3.8, `actual drawn cloth depth at frame${n}`);
      assert.ok(b.min.y >= 1.49, `actual hem at frame${n}`);
    }
    const config = JSON.parse(fs.readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url)));
    const files = [...new Set([config.shell, ...config.rooms.map((room) => room.file), "coast.glb", "hinterland.glb"])];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const triangle = new THREE.Triangle(a, b, c);
    for (const file of files) {
      const source = file === "room-sleep.glb" ? model : await loadNativeModel(file);
      const room = config.rooms.find((entry) => entry.file === file);
      if (room?.offset) source.scene.position.fromArray(room.offset);
      source.scene.updateMatrixWorld(true);
      source.scene.traverse((mesh) => {
        if (!mesh.isMesh) return;
        const position = mesh.geometry.attributes.position;
        const index = mesh.geometry.index;
        for (let i = 0; i < (index?.count ?? position.count); i += 3) {
          a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
          b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
          c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
          assert.ok(!sweep.intersectsTriangle(triangle), `${file}:${mesh.userData.name || mesh.name}:${i / 3} enters the actual drape sweep`);
        }
      });
    }
    assert.equal(rig.evidence().hardware.rings, 16);
    assert.equal(rig.evidence().draws, 4);
    sample("sleep", false, true, 12);
    const before = Array.from(rig.group.children[0].geometry.attributes.position.array);
    for (let n = 0; n < 3; n++) sample("sleep", false, true, 12);
    assert.deepEqual(Array.from(rig.group.children[0].geometry.attributes.position.array), before, "a composed paused drape remains exact");
  } finally {
    rig.dispose();
    rig.dispose();
    assert.equal(rig.group.parent, null);
  }
});
