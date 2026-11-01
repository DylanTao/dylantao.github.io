import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { THREE, loadNativeModel } from "./helpers/coastal-native-avatar.mjs";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";
import { createWildlife } from "../assets/js/home-scene/wildlife.mjs";
import { createGroundPatch } from "../assets/js/home-scene/wildlife-ground-contact.mjs";
import { createHabitatRoute, raccoonMotion } from "../assets/js/home-scene/wildlife-neighbor-motion.mjs";
import { pulse, wrap } from "../assets/js/home-scene/wildlife-acting.mjs";

const models = new URL("../assets/models/home/", import.meta.url),
  manifest = JSON.parse(fs.readFileSync(new URL("manifest.json", models))),
  perches = JSON.parse(fs.readFileSync(new URL("wildlife-perch-support.json", models))),
  names = ["BrushRabbit", "CaliforniaSeaLion", "HarborSeal", "Raccoon", "WesternGull", "Sandpiper", "BrownPelican", "BrandtsCormorant"],
  masters = await Promise.all(names.map((name) => loadNativeModel(name + ".glb", models))),
  retained = await Promise.all([nativeGeometry("home-shell.glb", models), nativeGeometry("coast.glb", models)]);

async function world(config = manifest, terrain = retained) {
  const scene = new THREE.Group(),
    wildlife = createWildlife(scene, structuredClone(config), {
      createModelLoader: () => ({
        loader: { loadAsync: async (url) => masters[names.indexOf(url.split("/").at(-1).replace(".glb", ""))] },
        decoder: { dispose() {} },
      }),
      loadPerchSupport: async () => perches,
    });
  for (let i = 0; i < 100 && !wildlife.evidence().modelsReady; i++) await new Promise(setImmediate);
  assert.equal(wildlife.evidence().modelsReady, true);
  wildlife.captureGround(terrain);
  const meshes = [];
  scene.traverse((mesh) => {
    if (mesh.isSkinnedMesh && mesh.userData.action?.id === "raccoon-0") meshes.push(mesh);
  });
  let group = meshes[0];
  while (group.parent && group.parent.name !== "Coastal neighbours") group = group.parent;
  const bones = Object.fromEntries(meshes[0].skeleton.bones.map((bone) => [bone.name, bone])),
    patch = createGroundPatch(config.terrain.habitats.raccoon.path, 2);
  patch.capture(terrain);
  return { scene, wildlife, meshes, group, bones, patch };
}

function skin(w) {
  w.group.updateMatrixWorld(true);
  const parts = {};
  let count = 0;
  for (const mesh of w.meshes) {
    const indices = mesh.geometry.attributes.skinIndex,
      weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < indices.count; i++) {
      const p = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      let dominant = 0;
      for (let k = 1; k < 4; k++) if (weights.getComponent(i, k) > weights.getComponent(i, dominant)) dominant = k;
      const name = mesh.skeleton.bones[indices.getComponent(i, dominant)].name,
        part = (parts[name] ||= { missing: 0, gap: Infinity, count: 0 }),
        hit = w.patch.sample(p.x, p.z, p.y + 0.5);
      part.count++;
      count++;
      if (!hit) part.missing++;
      else part.gap = Math.min(part.gap, p.y - hit.height);
    }
  }
  return { parts, count };
}

test("the delivered curled trunk clears its native slope while every paw stays planted", async () => {
  const w = await world();
  for (const time of [0, 3, 14.4167, 18.8007, 23.5357]) {
    w.wildlife.update(time, "noon", { force: true });
    const record = w.wildlife.evidence().raccoon,
      actual = skin(w);
    assert.equal(actual.count, 7024);
    assert.equal(record.bodyContact.supportResolved, true);
    assert.ok(record.bodyContact.beforeGap < -0.04);
    assert.ok(record.bodyContact.lift > 0.04 && record.bodyContact.lift < 0.08);
    assert.equal(record.bodyContact.missing, 0);
    for (const name of ["Hips", "Chest"]) assert.ok(actual.parts[name].gap >= 0.00064);
    for (const name of ["FrontPawL", "FrontPawR", "HindPawL", "HindPawR"]) {
      assert.equal(actual.parts[name].missing, 0);
      assert.ok(Math.abs(actual.parts[name].gap) < 1e-7);
      const anchor = record.contacts.find((c) => c.foot === name).position;
      assert.ok(w.bones[name].getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(...anchor)) < 1e-12);
    }
    for (const [name, part] of Object.entries(actual.parts)) assert.ok(part.gap >= -1e-7, `${time}/${name}: ${part.gap}`);
  }
});

test("curled and waking forelegs retain their lengths and connected joints above real terrain", async () => {
  const w = await world();
  for (const palette of ["noon", "evening"])
    for (const time of [0, 0.6, 1, 2, 2.2, 3, 3.8, 5.8, 7, 12]) {
      w.wildlife.update(time, palette, { force: true });
      const actual = skin(w);
      for (const side of ["L", "R"])
        for (const fore of [true, false]) {
          const name = (fore ? "Foreleg" : "Hindleg") + side,
            upper = w.bones[name],
            lower = w.bones["Lower" + name],
            knee = lower.getWorldPosition(new THREE.Vector3()),
            upperEnd = upper.localToWorld(new THREE.Vector3(0, -0.15, 0));
          assert.ok(upperEnd.distanceTo(knee) < 1e-12, `${palette}/${time}/${name} joint separated`);
          assert.ok(upper.scale.y >= 1 - 1e-12 && upper.scale.y <= 1.0450001);
          assert.ok(lower.scale.y >= 1 - 1e-12 && lower.scale.y <= 1.0450001);
          assert.ok(actual.parts[name].gap >= -1e-7, `${palette}/${time}/${name} entered terrain`);
          assert.ok(actual.parts["Lower" + name].gap >= -1e-7, `${palette}/${time}/Lower${name} entered terrain`);
        }
    }
});

test("a native curled body fits crossed grades and refuses missing ground", async () => {
  for (const [gx, gz, width] of [
    [0.15, -0.1, 4],
    [-0.12, 0.18, 4],
    [0, 0, 0.12],
  ]) {
    const config = structuredClone(manifest);
    config.terrain.habitats.raccoon.path = [
      [0, 0.025, 0],
      [0.6, 0.025 + 0.6 * gx, 0],
      [0.6, 0.025 + 0.6 * (gx + gz), 0.6],
      [0, 0.025 + 0.6 * gz, 0.6],
    ];
    const geometry = new THREE.PlaneGeometry(width, width).rotateX(-Math.PI / 2),
      positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setY(i, gx * positions.getX(i) + gz * positions.getZ(i));
    const plane = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    plane.name = "coast_raccoon_contact_fixture";
    const w = await world(config, [plane]);
    w.wildlife.update(18.8007, "noon", { force: true });
    const contact = w.wildlife.evidence().raccoon.bodyContact;
    if (width < 1) {
      assert.equal(contact.supportResolved, false);
      assert.equal(contact.reason, "incomplete curled-body footprint");
      assert.equal(contact.lift, 0);
    } else {
      assert.equal(contact.supportResolved, true, JSON.stringify(contact));
      for (const [name, part] of Object.entries(skin(w).parts)) {
        assert.equal(part.missing, 0);
        assert.ok(part.gap >= -1e-7, `${gx}/${gz}/${name}: ${part.gap}`);
      }
    }
  }
});

test("waking and returning blend the authored breath and ear waves continuously", () => {
  const length = createHabitatRoute(manifest.terrain.habitats.raccoon.path).length;
  for (const [night, palette, instants] of [
    [false, { night: false, nightStart: -2e4, dayStart: -1e4 }, [0, 1, 18.8007, 25.3]],
    [true, { night: true, nightStart: 0, dayStart: -1e4 }, [8, 12.7, 25.3]],
  ])
    for (const time of instants) {
      const p = raccoonMotion(time, night, length, palette);
      assert.equal(p.sleep, night ? 0 : 1);
      assert.equal(p.breath, Math.sin(time * Math.PI * 2 * (night ? 0.42 : 0.25)) * (night ? 0.01 : 0.02));
      assert.equal(p.earAnswer, pulse(wrap(time / 6.3, 1) / 0.08) * 0.15 * (night ? 1 : 0.6));
    }
  for (const [time, night, palette] of [
    [2.2, true, { night: true, nightStart: 0, dayStart: -1e4 }],
    [99.07140073225949, false, { night: false, nightStart: 0, dayStart: 95 }],
  ]) {
    const h = 1e-5,
      a = raccoonMotion(time - h, night, length, palette),
      b = raccoonMotion(time, night, length, palette),
      c = raccoonMotion(time + h, night, length, palette);
    for (const name of ["breath", "earAnswer"]) {
      assert.ok(Math.abs(a[name] - c[name]) < 1e-6, `${time}/${name} jumps`);
      assert.ok(Math.abs(a[name] + c[name] - 2 * b[name]) / h < 0.001, `${time}/${name} changes velocity abruptly`);
    }
  }
});
