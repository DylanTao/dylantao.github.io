import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { THREE, loadNativeModel, loadNativeAvatar, repo } from "./helpers/coastal-native-avatar.mjs";
import { roomTransfer } from "../assets/js/home-scene/room-journey.mjs";
import { createPlantedFeet } from "../assets/js/home-scene/planted-feet.mjs";
import { fitSeatToSurface } from "../assets/js/home-scene/seat-surface.mjs";
import { createRainRoofField } from "../assets/js/home-scene/rain-roof-field.mjs";

const base = new URL("assets/models/home/", repo);
const read = (name) => JSON.parse(fs.readFileSync(new URL(name, base), "utf8"));
const config = read("manifest.json"),
  contacts = read("character-contacts.json");
const room = config.rooms.find((entry) => entry.id === "sleep");

test("five delivered skins retain sole/leg/mattress constraints; separate hard-tail admission remains required", async () => {
  assert.ok(room.bedTransfer, "native bed-transfer contacts must be delivered");
  const native = await loadNativeModel("room-sleep.glb");
  native.scene.updateMatrixWorld(true);
  const cloth = native.scene.getObjectByName("sleep_duvet_empty");
  const mattress = native.scene.getObjectByName("sleep__linen");
  assert.ok(cloth && mattress, "fit actual cloth, not a nominal bed plane");
  const proxy = new THREE.Mesh(mattress.geometry, mattress.material);
  proxy.matrix.copy(mattress.matrixWorld);
  proxy.matrixAutoUpdate = false;
  proxy.userData.caveRoof = true;
  const field = createRainRoofField(proxy, 0.25),
    point = new THREE.Vector3();
  for (const entry of config.avatars) {
    const id = entry.id,
      contact = contacts.avatars[id].lounge;
    const sha = createHash("sha256")
      .update(fs.readFileSync(new URL(entry.file, base)))
      .digest("hex");
    assert.equal(contact.sourceGlbSha256, sha, `${id}: contact must bind actual skin bytes`);
    assert.equal(room.bedTransfer.footSourceGlbSha256[id], sha, `${id}: native floor survey must bind those same bytes`);
    const model = await loadNativeAvatar(id),
      actor = model.scene;
    const mixer = new THREE.AnimationMixer(actor);
    const actions = new Map(model.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
    const fit = fitSeatToSurface({ contact, seat: room.bedTransfer.seat.position, facing: room.bedTransfer.seat.facing, meshes: [cloth] });
    assert.equal(fit.compression, 0);
    assert.ok(fit.samples.length >= 8 && fit.samples.every((sample) => sample.clearance >= -1e-8));
    const transfer = roomTransfer(room, "sleep", { seatedRoot: fit.position, avatarId: id });
    const solver = createPlantedFeet(actor, contact.legs);
    const patches = [];
    actor.traverse((mesh) => {
      if (!mesh.isSkinnedMesh) return;
      const indices = mesh.geometry.attributes.skinIndex,
        weights = mesh.geometry.attributes.skinWeight;
      const body = [],
        feet = { L: [], R: [] };
      for (let i = 0; i < indices.count; i++) {
        let k = 0;
        for (let j = 1; j < 4; j++) if (weights.getComponent(i, j) > weights.getComponent(i, k)) k = j;
        const name = mesh.skeleton.bones[indices.getComponent(i, k)].name.replaceAll(".", "");
        if (/^(Hips|Spine|Chest|Neck|Thigh[LR])$/.test(name)) body.push(i);
        if (/^Foot[LR]$/.test(name)) feet[name.at(-1)].push(i);
      }
      patches.push({ mesh, body, feet });
    });
    for (let i = 0; i <= 248; i++) {
      const pose = transfer.pose((transfer.duration * i) / 248);
      mixer.stopAllAction();
      for (const [name, weight] of pose.blend
        ? [
            [pose.blend.from, 1 - pose.blend.weight],
            [pose.blend.to, pose.blend.weight],
          ]
        : [[pose.clip, 1]]) {
        const action = actions.get(name);
        action.reset().play().setEffectiveWeight(weight);
        action.time = 0;
      }
      mixer.update(0);
      actor.position.fromArray(pose.position);
      actor.rotation.y = pose.facing;
      actor.updateMatrixWorld(true);
      const solved = pose.feet ? solver.apply(pose.feet, pose.plantedWeight || 0) : [];
      for (const leg of solved) {
        assert.ok(leg.reachViolation < 1e-6, `${id} phase ${i}: unreachable leg`);
        assert.ok(leg.reachSlack >= 0.01, `${id} phase ${i}: preserve measured extension margin`);
        assert.ok(leg.drift < 1e-6, `${id} phase ${i}: no bone-length stretch`);
      }
      if (i % 8 !== 0 && i !== 248) continue;
      const soles = { L: [], R: [] };
      for (const { mesh, body, feet } of patches) {
        for (const at of body) {
          mesh.getVertexPosition(at, point).applyMatrix4(mesh.matrixWorld);
          const depth = field.height(point.x, point.z) - point.y;
          // Original lying skins press into the soft mattress by at most 10 mm.
          // Moving transfer samples get no new deep-body exception.
          assert.ok(depth <= (i === 0 ? 0.011 : 0.005), `${id} phase ${i}: body buried ${depth} m in delivered mattress`);
        }
        if (pose.plantedWeight === 1)
          for (const side of ["L", "R"])
            for (const at of feet[side]) {
              mesh.getVertexPosition(at, point).applyMatrix4(mesh.matrixWorld);
              soles[side].push(point.toArray());
            }
      }
      if (pose.plantedWeight === 1)
        for (const side of ["L", "R"]) {
          assert.ok(soles[side].length > 100, `${id}: actual complete foot skin is required`);
          const floor = Math.min(...soles[side].map((p) => p[1]));
          const footprint = soles[side].filter((p) => p[1] <= floor + 0.001);
          const center = [0, 1, 2].map((axis) => (Math.min(...footprint.map((p) => p[axis])) + Math.max(...footprint.map((p) => p[axis]))) / 2);
          assert.ok(Math.abs(floor - pose.feet[side].position[1]) < 0.0015, `${id}: delivered sole must meet the native floor`);
          assert.ok(
            Math.hypot(center[0] - pose.feet[side].position[0], center[2] - pose.feet[side].position[2]) < 0.0015,
            `${id}: actual sole, not ankle, must reach the floor witness`
          );
        }
    }
  }
});
