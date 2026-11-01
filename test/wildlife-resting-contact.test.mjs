import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { THREE, loadNativeModel } from "./helpers/coastal-native-avatar.mjs";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";
import { createWildlife } from "../assets/js/home-scene/wildlife.mjs";
import { createGroundPatch } from "../assets/js/home-scene/wildlife-ground-contact.mjs";
import { createRestingTailFit } from "../assets/js/home-scene/wildlife-resting-contact.mjs";
import { createHabitatRoute, raccoonMotion } from "../assets/js/home-scene/wildlife-neighbor-motion.mjs";

const models = new URL("../assets/models/home/", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL("manifest.json", models)));
const perches = JSON.parse(fs.readFileSync(new URL("wildlife-perch-support.json", models)));
const species = ["BrushRabbit", "CaliforniaSeaLion", "HarborSeal", "Raccoon", "WesternGull", "Sandpiper", "BrownPelican", "BrandtsCormorant"];
const masters = await Promise.all(species.map((name) => loadNativeModel(name + ".glb", models)));
const grounds = await Promise.all([nativeGeometry("home-shell.glb", models), nativeGeometry("coast.glb", models)]);
const routeLength = createHabitatRoute(manifest.terrain.habitats.raccoon.path.map(([x, y, z]) => [x, y - 0.025, z])).length;

async function world() {
  const scene = new THREE.Group();
  const wildlife = createWildlife(scene, structuredClone(manifest), {
    createModelLoader: () => ({
      loader: { loadAsync: async (url) => masters[species.indexOf(url.split("/").at(-1).replace(".glb", ""))] },
      decoder: { dispose() {} },
    }),
    loadPerchSupport: async () => perches,
  });
  for (let i = 0; i < 100 && !wildlife.evidence().modelsReady; i++) await new Promise(setImmediate);
  assert.equal(wildlife.evidence().modelsReady, true);
  wildlife.captureGround(grounds);
  const patch = createGroundPatch(manifest.terrain.habitats.raccoon.path, 1.15);
  patch.capture(grounds);
  const meshes = [];
  scene.traverse((mesh) => {
    if (mesh.isSkinnedMesh && mesh.userData.action?.id === "raccoon-0") meshes.push(mesh);
  });
  assert.equal(meshes.length, 2);
  let group = meshes[0];
  while (group.parent && group.parent.name !== "Coastal neighbours") group = group.parent;
  const bones = Object.fromEntries(meshes[0].skeleton.bones.map((bone) => [bone.name, bone]));
  const tail = [],
    retained = [];
  for (const mesh of meshes) {
    const skin = mesh.geometry.attributes.skinIndex,
      weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < skin.count; i++) {
      let owner = 0;
      for (let k = 0; k < 4; k++) if (/^Tail/.test(mesh.skeleton.bones[skin.getComponent(i, k)].name)) owner += weights.getComponent(i, k);
      (owner > 1e-4 ? tail : retained).push({ mesh, index: i });
    }
  }
  assert.equal(tail.length, 500);
  const fit = createRestingTailFit({ model: group, group, tail: bones.Tail, ground: patch });
  function points(list) {
    group.updateMatrixWorld(true);
    return list.map((p) => p.mesh.getVertexPosition(p.index, new THREE.Vector3()).applyMatrix4(p.mesh.matrixWorld).toArray());
  }
  function minimum() {
    let gap = Infinity,
      missing = 0;
    for (const [x, y, z] of points(tail)) {
      const hit = patch.sample(x, z, y + 0.5);
      if (!hit) missing++;
      else gap = Math.min(gap, y - hit.height);
    }
    return { gap, missing };
  }
  function authoredTail(t) {
    const pose = raccoonMotion(t, false, routeLength, wildlife.evidence().palette);
    bones.Tail.rotation.set(pose.tailLift, pose.tailYaw, 0);
    group.updateMatrixWorld(true);
  }
  return { wildlife, scene, group, bones, meshes, tail, retained, fit, points, minimum, authoredTail };
}

test("the actual curled tail rests above delivered ground through sleep, wake and forage", async () => {
  const w = await world(),
    states = new Set();
  for (const palette of ["noon", "evening"])
    for (let t = 0; t <= 160; t += 0.5) {
      w.wildlife.update(t, palette, { force: true });
      const evidence = w.wildlife.evidence().raccoon,
        contact = evidence.tailContact,
        actual = w.minimum();
      states.add(evidence.state);
      assert.equal(contact.supported, true, `${palette}/${t}: ${JSON.stringify(contact)}`);
      assert.equal(actual.missing, 0);
      assert.ok(actual.gap >= 0.00059, `${palette}/${t}: tail entered by ${actual.gap}`);
      assert.ok(contact.rotation <= 0.65);
      if (contact.beforeGap >= 0.0006) assert.equal(contact.rotation, 0);
      if (evidence.state === "sleep") assert.ok(actual.gap < 0.001, `sleeping tail floats ${actual.gap}`);
    }
  for (const state of ["sleep", "wake", "walk", "dig", "stand", "sniff", "look"]) assert.ok(states.has(state), state);
});

test("the tail fit preserves every non-tail joint, root and delivered body/paw vertex", async () => {
  const w = await world();
  for (const palette of ["noon", "evening"])
    for (const t of [0, 1, 2, 3, 4, 8, 14.4167, 18.8007, 23.5357, 32, 48, 64, 80, 96, 112, 128]) {
      w.wildlife.update(t, palette, { force: true });
      w.authoredTail(t);
      const beforeVertices = w.points(w.retained),
        beforeRoot = w.group.matrixWorld.toArray(),
        joints = Object.entries(w.bones).filter(([name]) => !/^Tail/.test(name)),
        beforeJoints = joints.map(([, bone]) => bone.matrixWorld.toArray()),
        original = w.bones.Tail.quaternion.clone(),
        raw = w.minimum(),
        fit = w.fit.update();
      assert.equal(fit.supported, true);
      assert.deepEqual(w.group.matrixWorld.toArray(), beforeRoot);
      assert.deepEqual(
        joints.map(([, bone]) => bone.matrixWorld.toArray()),
        beforeJoints
      );
      assert.deepEqual(w.points(w.retained), beforeVertices);
      assert.ok(w.minimum().gap >= 0.00059);
      if (raw.gap >= 0.0006) assert.ok(original.angleTo(w.bones.Tail.quaternion) < 1e-7);
    }
});

test("an incomplete real edge footprint rejects the fit and restores the authored tail", async () => {
  const w = await world();
  w.wildlife.update(2, "noon", { force: true });
  w.authoredTail(2);
  const p = w.group.position,
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial()),
    edge = createGroundPatch([[p.x, p.y, p.z]], 2);
  mesh.name = "coast_tail_edge_fixture";
  mesh.position.copy(p);
  edge.capture([mesh]);
  const original = w.bones.Tail.quaternion.toArray(),
    fit = createRestingTailFit({ model: w.group, group: w.group, tail: w.bones.Tail, ground: edge }).update();
  assert.equal(fit.supported, false);
  assert.ok(fit.missing > 0);
  assert.equal(fit.reason, "incomplete tail support");
  assert.deepEqual(w.bones.Tail.quaternion.toArray(), original);
});

test("actual tail vertices stay continuous through wake and contact-release boundaries", async () => {
  const w = await world();
  w.wildlife.update(0, "noon", { force: true });
  w.wildlife.update(0, "evening", { force: true });
  for (const t of [0.6, 1, 2, 2.5, 2.8, 3, 3.2, 3.5, 3.8, 4, 4.4, 8, 14.4]) {
    w.wildlife.update(t - 1e-5, "evening", { force: true });
    const before = w.points(w.tail);
    w.wildlife.update(t + 1e-5, "evening", { force: true });
    const after = w.points(w.tail),
      jump = Math.max(...before.map((p, i) => Math.hypot(...p.map((v, axis) => v - after[i][axis]))));
    assert.ok(jump < 0.00025, `tail popped by ${jump} m at ${t}`);
  }
});
