import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { THREE, loadNativeModel } from "./helpers/coastal-native-avatar.mjs";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";
import { createWildlife } from "../assets/js/home-scene/wildlife.mjs";
import { createGroundPatch } from "../assets/js/home-scene/wildlife-ground-contact.mjs";
import { createRestingTailFit, createSkinContactSampler } from "../assets/js/home-scene/wildlife-resting-contact.mjs";
import { createHabitatRoute, raccoonMotion } from "../assets/js/home-scene/wildlife-neighbor-motion.mjs";
import {
  pinnipedActing,
  pinnipedBlendWeight,
  pinnipedFlipperActivation,
  pinnipedSchedule,
  sealShuffleOffset,
} from "../assets/js/home-scene/wildlife-motion.mjs";

const models = new URL("../assets/models/home/", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL("manifest.json", models)));
const perches = JSON.parse(fs.readFileSync(new URL("wildlife-perch-support.json", models)));
const species = ["BrushRabbit", "CaliforniaSeaLion", "HarborSeal", "Raccoon", "WesternGull", "Sandpiper", "BrownPelican", "BrandtsCormorant"];
const masters = await Promise.all(species.map((name) => loadNativeModel(name + ".glb", models)));
const grounds = await Promise.all([nativeGeometry("home-shell.glb", models), nativeGeometry("coast.glb", models)]);
const routeLength = createHabitatRoute(manifest.terrain.habitats.raccoon.path.map(([x, y, z]) => [x, y - 0.025, z])).length;

async function world(config = manifest, terrain = grounds) {
  const scene = new THREE.Group();
  const wildlife = createWildlife(scene, structuredClone(config), {
    createModelLoader: () => ({
      loader: { loadAsync: async (url) => masters[species.indexOf(url.split("/").at(-1).replace(".glb", ""))] },
      decoder: { dispose() {} },
    }),
    loadPerchSupport: async () => perches,
  });
  for (let i = 0; i < 100 && !wildlife.evidence().modelsReady; i++) await new Promise(setImmediate);
  assert.equal(wildlife.evidence().modelsReady, true);
  wildlife.captureGround(terrain);
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

function landAnimals(scene) {
  const animals = new Map();
  scene.traverse((mesh) => {
    const id = mesh.userData.action?.id;
    if (!mesh.isSkinnedMesh || !/^(seaLion|seal)-/.test(id || "")) return;
    if (!animals.has(id)) {
      let group = mesh;
      while (group.parent && group.parent.name !== "Coastal neighbours") group = group.parent;
      animals.set(id, { id, group, meshes: [], bones: Object.fromEntries(mesh.skeleton.bones.map((b) => [b.name, b])) });
    }
    animals.get(id).meshes.push(mesh);
  });
  return [...animals.values()];
}

function actualSkinMinimum(animal, patch) {
  animal.group.updateMatrixWorld(true);
  let gap = Infinity,
    missing = 0,
    witness = null;
  for (const mesh of animal.meshes)
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      const p = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld),
        hit = patch.sample(p.x, p.z, p.y + 0.5);
      if (!hit) {
        missing++;
        continue;
      }
      const d = p.y - hit.height;
      if (d < gap) {
        gap = d;
        witness = { mesh: mesh.name, vertex: i, point: p.toArray(), support: hit.mesh, triangle: hit.triangle };
      }
    }
  return { gap, missing, witness };
}

test("pinniped skin caching preserves every actual Three skin point without removing samples", async () => {
  const w = await world(),
    animals = landAnimals(w.scene),
    samplers = animals.map((a) => createSkinContactSampler(a.group)),
    features = new Map(samplers.map((sampler) => [sampler, sampler.groups(sampler.points)]));
  for (const sampler of samplers) {
    const leaves = (node) => (node.children ? node.children.flatMap(leaves) : node.samples),
      retained = features.get(sampler).flatMap(leaves);
    assert.equal(retained.length, sampler.points.length);
    assert.equal(new Set(retained).size, sampler.points.length);
  }
  for (const t of [0, 8, 14.4167, 28, 48, 88, 120]) {
    w.wildlife.update(t, "noon", { force: true });
    for (const sampler of samplers) {
      sampler.refresh();
      const actualPoints = new Map();
      for (const point of sampler.points) {
        const expected = point.mesh.getVertexPosition(point.index, new THREE.Vector3()).applyMatrix4(point.mesh.matrixWorld),
          actual = sampler.position(point, new THREE.Vector3());
        assert.ok(actual.distanceTo(expected) < 1e-12, `${t}/${point.mesh.name}/${point.index}`);
        actualPoints.set(point, expected);
      }
      const checkBounds = (feature) => {
        const box = sampler.bounds(feature, new THREE.Box3());
        for (const p of feature.samples) {
          const actual = actualPoints.get(p);
          assert.ok(box.containsPoint(actual), `${t}/${p.mesh.name}/${p.index} escaped its conservative skin bound`);
        }
        feature.children?.forEach(checkBounds);
      };
      features.get(sampler).forEach(checkBounds);
    }
  }
});

test("feasible pinniped contacts retain mapped clearance and bounded poses on delivered terrain", async () => {
  const w = await world(),
    animals = landAnimals(w.scene).filter((a) => a.id !== "seaLion-0"),
    patches = {};
  for (const key of ["seaLion", "seal"]) {
    patches[key] = createGroundPatch(manifest.terrain.habitats[key].path, 3);
    patches[key].capture(grounds);
  }
  for (const t of [0, 4, 8, 12, 14.4167, 18.8007, 24, 28, 32, 40, 48, 52, 56, 64, 72, 80, 88, 96, 112, 120]) {
    w.wildlife.update(t, "noon", { force: true });
    const evidence = w.wildlife.evidence();
    for (const animal of animals) {
      const [key, index] = animal.id.split("-"),
        row = evidence.contacts.filter((r) => r.habitat === key)[Number(index)],
        actual = actualSkinMinimum(animal, patches[key]);
      assert.equal(row.surfaceContact.supported, true, `${animal.id}/${t}: ${JSON.stringify(row.surfaceContact)}`);
      assert.equal(row.surfaceContact.contactFitResolved, true);
      assert.equal(row.surfaceContact.fullSkinProjectionCoverage, null);
      assert.equal(
        row.surfaceContact.contactQueryCoverage.missing,
        row.surfaceContact.bodyMissing + row.surfaceContact.flippers.reduce((n, c) => n + c.missing, 0)
      );
      assert.ok(actual.gap >= -0.002, `${animal.id}/${t}: ${JSON.stringify(actual)}`);
      assert.ok(Math.abs(row.surfaceContact.rootCorrection) <= 0.15);
      assert.ok(
        Math.abs(row.surfaceContact.rootCorrection - row.surfaceContact.bodyLiftCorrection + row.surfaceContact.gravitySeating.lowering) < 1e-12
      );
      for (const contact of row.surfaceContact.flippers) {
        assert.ok(contact.rotation <= 0.750001);
        if (contact.contactWeight === 1) assert.ok(contact.gap <= 0.002, `${animal.id}/${t}/${contact.name} is floating ${contact.gap} m`);
      }
    }
  }
});

test("the overlapping western rock is rejected consistently without lifting the sea lion", async () => {
  const fixture = structuredClone(manifest);
  // Retain the unsafe historical fixture even after the public habitat moves.
  fixture.terrain.habitats.seaLion.path[0] = [-10, -6.6084, -14.5115];
  const w = await world(fixture),
    animal = landAnimals(w.scene).find((a) => a.id === "seaLion-0");
  for (let t = 0; t <= 120; t += 2) {
    w.wildlife.update(t, "noon", { force: true });
    const contact = w.wildlife.evidence().contacts[0].surfaceContact;
    assert.equal(contact.supported, false);
    assert.equal(contact.reason, "rest torso crosses a raised rock shoulder");
    assert.ok(contact.bearing.relief > 0.12);
    assert.equal(contact.rootCorrection, 0);
    assert.deepEqual(animal.group.position.toArray(), fixture.terrain.habitats.seaLion.path[0]);
    assert.ok(animal.group.quaternion.angleTo(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.4, 0))) < 1e-7);
  }
});

test("the surveyed native sea-lion anchor supports delivered skin without a whole-body lift", async () => {
  const fixture = structuredClone(manifest),
    patch = createGroundPatch(
      [
        [-10, -6.6084, -14.5115],
        [-9.7, -6.64, -14.8115],
      ],
      2
    );
  patch.capture(grounds);
  // The native survey retains the authored 12.2658 micrometre root offset,
  // then rounds the final metadata point. Do not infer intent from Draco error.
  fixture.terrain.habitats.seaLion.path[0] = [-9.7, -6.6382, -14.8115];
  const w = await world(fixture),
    animal = landAnimals(w.scene).find((a) => a.id === "seaLion-0");
  for (const t of [0, 8, 14.4167, 28, 32, 48, 64, 88, 120]) {
    w.wildlife.update(t, "noon", { force: true });
    const contact = w.wildlife.evidence().contacts[0].surfaceContact,
      actual = actualSkinMinimum(animal, patch);
    assert.equal(contact.supported, true, `${t}: ${JSON.stringify(contact)}`);
    assert.equal(contact.bodyLiftCorrection, 0);
    assert.ok(contact.rootCorrection <= 0);
    assert.ok(actual.gap >= -0.002);
  }
});

test("released rolling bodies settle onto their delivered skin instead of hanging above terrain", async () => {
  const fixture = structuredClone(manifest);
  fixture.terrain.habitats.seaLion.path[0] = [-9.7, -6.6382, -14.8115];
  const w = await world(fixture),
    animals = new Map(landAnimals(w.scene).map((a) => [a.id, a])),
    patch = createGroundPatch(fixture.terrain.habitats.seaLion.path, 3);
  patch.capture(grounds);
  for (const [id, time, priorHover] of [
    ["seaLion-0", 35, 0.02842757778359939],
    ["seaLion-2", 97.5, 0.02712367625986989],
    ["seaLion-2", 100.5, 0.027013445459704855],
    ["seaLion-2", 163.5, 0.027009268885554327],
  ]) {
    w.wildlife.update(time, "noon", { force: true });
    const fit = w.wildlife.evidence().contacts[Number(id.split("-")[1])].surfaceContact,
      animal = animals.get(id),
      actual = actualSkinMinimum(animal, patch),
      faces = animal.meshes.flatMap((mesh) => {
        const positions = Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) =>
            mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)
          ),
          indices = mesh.geometry.index;
        return Array.from({ length: (indices?.count ?? positions.length) / 3 }, (_, i) => ({
          mesh: mesh.name,
          triangle: i,
          points: [0, 1, 2].map((k) => positions[indices ? indices.getX(i * 3 + k) : i * 3 + k]),
        }));
      }),
      surface = patch.minimumSurfaceGap(faces, actual.gap),
      trueGap = Math.min(actual.gap, surface.minimum?.gap ?? Infinity);
    assert.equal(fit.contactFitResolved, true);
    assert.equal(fit.plantedContactQueryCoverage.limbs, 0, "the actual body carries a released roll");
    assert.ok(fit.gravitySeating.lowering > priorHover - 0.003);
    assert.ok(trueGap >= 0.00064 && trueGap < 0.002, `${id}/${time}: ${JSON.stringify({ actual, surface })}`);
    assert.ok(fit.gravitySeating.witness.supportMesh);
    assert.ok(fit.gravitySeating.surfaceQueries.inputFaces > 7000, "every delivered skin face participates in seating");
    for (const fin of fit.flippers) assert.ok(fin.gap >= 0.00064);
  }
});

test("the real delivered seal fits crossed grades and rejects an incomplete bearing edge", async () => {
  for (const [gx, gz, width] of [
    [0.15, -0.1, 20],
    [-0.12, 0.18, 20],
    [0, 0, 0.12],
  ]) {
    const fixture = structuredClone(manifest);
    fixture.terrain.habitats.seal.path[0] = [0, 0, 0];
    const geometry = new THREE.PlaneGeometry(width, width).rotateX(-Math.PI / 2),
      p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, gx * p.getX(i) + gz * p.getZ(i));
    const plane = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    plane.name = "coast_pinniped_bearing_fixture";
    const w = await world(fixture, [plane]),
      animal = landAnimals(w.scene).find((a) => a.id === "seal-0"),
      patch = createGroundPatch([[0, 0, 0]], 3);
    patch.capture([plane]);
    for (const t of [0, 14.4167, 48]) {
      w.wildlife.update(t, "noon", { force: true });
      const contact = w.wildlife.evidence().contacts.filter((r) => r.habitat === "seal")[0].surfaceContact;
      if (width < 1) {
        assert.equal(contact.supported, false);
        assert.equal(contact.reason, "incomplete bearing footprint");
        assert.equal(contact.rootCorrection, 0);
        assert.deepEqual(animal.group.position.toArray(), [0, 0, 0]);
      } else {
        assert.equal(contact.supported, true, `${gx}/${gz}/${t}: ${JSON.stringify(contact)}`);
        assert.ok(actualSkinMinimum(animal, patch).gap >= -0.002);
      }
    }
  }
});

test("paddle correction preserves posed shape and attachment within native skin-weight precision", async () => {
  const w = await world(),
    animals = landAnimals(w.scene).filter((a) => a.id !== "seaLion-0");
  for (const t of [0, 14.4167, 28, 48, 88]) {
    w.wildlife.update(t, "noon", { force: true });
    for (const animal of animals)
      for (const name of ["FrontFlipperL", "FrontFlipperR", "RearFlipperL", "RearFlipperR"]) {
        const bone = animal.bones[name],
          saved = bone.quaternion.clone(),
          points = [];
        for (const mesh of animal.meshes) {
          const skin = mesh.geometry.attributes.skinIndex,
            weights = mesh.geometry.attributes.skinWeight;
          for (let i = 0; i < skin.count; i++) {
            let owned = 0,
              total = 0;
            for (let k = 0; k < 4; k++) {
              const weight = weights.getComponent(i, k);
              total += weight;
              if (mesh.skeleton.bones[skin.getComponent(i, k)].name.replace("Tip", "") === name) owned += weight;
            }
            if (owned > 0.999) points.push({ mesh, index: i, weightError: Math.abs(total - 1) });
          }
        }
        const local = () => {
          animal.group.updateMatrixWorld(true);
          const inverse = bone.matrixWorld.clone().invert();
          return points.map((p) => p.mesh.getVertexPosition(p.index, new THREE.Vector3()).applyMatrix4(p.mesh.matrixWorld).applyMatrix4(inverse));
        };
        const before = local(),
          [key, index] = animal.id.split("-"),
          pose = pinnipedActing(t, Number(index), key === "seaLion"),
          side = name.endsWith("L") ? -1 : 1,
          active = pinnipedFlipperActivation(pose, name.endsWith("L") ? "L" : "R");
        if (name.startsWith("Front"))
          bone.rotation.set(-pose.chestPitch * (key === "seaLion" ? 0.85 : 0.4), 0, side * pose.flipper * active * (key === "seaLion" ? 1 : 0.8));
        else bone.rotation.set(pose.rearFlipper - pose.hipsPitch * 0.5, side * 0.04 * Math.sin(t * 0.8 + side), 0);
        const after = local();
        assert.ok(points.length > 100);
        const maximum = Math.max(...before.map((p, i) => p.distanceTo(after[i])));
        // Float32 weights are not exactly a partition of unity. Their unchanged
        // sum gives an explicit affine-origin error bound under a rigid rotation.
        const precisionBound = Math.max(
          1e-10,
          2 * Math.max(...points.map((p) => p.weightError)) * (bone.getWorldPosition(new THREE.Vector3()).length() + 1)
        );
        assert.ok(precisionBound < 3e-6, "native weight error exceeds the micrometre bound");
        assert.ok(maximum < precisionBound, `${animal.id}/${name}/${t}: ${maximum} m exceeds ${precisionBound} m`);
        assert.deepEqual(bone.scale.toArray(), [1, 1, 1]);
        bone.quaternion.copy(saved);
      }
  }
});

test("the seal shuffle joins its rest position without a visible body-position pop", async () => {
  const w = await world(),
    animals = landAnimals(w.scene).filter((a) => a.id.startsWith("seal-")),
    boundaries = [];
  for (let index = 0; index < 3; index++)
    for (const at of [0, 60, 120])
      for (const segment of pinnipedSchedule(at, index, false).segments)
        if (segment.kind === "shuffle") boundaries.push({ index, time: segment.start + 0.385 });
  assert.ok(boundaries.length > 0);
  for (const { index, time } of boundaries) {
    if (time < 1e-5 || sealShuffleOffset(time + 1e-5, index) <= 0) continue;
    const animal = animals[index];
    w.wildlife.update(time - 1e-5, "noon", { force: true });
    animal.group.updateMatrixWorld(true);
    const before = animal.bones.Chest.getWorldPosition(new THREE.Vector3());
    w.wildlife.update(time + 1e-5, "noon", { force: true });
    animal.group.updateMatrixWorld(true);
    const after = animal.bones.Chest.getWorldPosition(new THREE.Vector3());
    assert.ok(before.distanceTo(after) < 0.0005, `seal-${index} popped ${before.distanceTo(after)} m at ${time}`);
  }
});

test("a rolling seal releases its raised native shoulder while retaining the bounded collision fit", async () => {
  const fixture = structuredClone(manifest);
  fixture.terrain.habitats.seaLion.path[0] = [-9.7, -6.6382, -14.8115];
  const w = await world(fixture),
    animal = landAnimals(w.scene).find((a) => a.id === "seal-2");
  for (const time of [11.724430543, 11.724440543, 11.724450543]) {
    w.wildlife.update(time, "noon", { force: true });
    const fit = w.wildlife.evidence().contacts.filter((r) => r.habitat === "seal")[2].surfaceContact,
      upper = fit.flippers.find((f) => f.name === "FrontFlipperR");
    assert.ok(animal.bones.FrontFlipperR.position.x > 0);
    assert.equal(fit.supported, true);
    assert.equal(upper.rollRelease, 1);
    assert.equal(upper.contactWeight, 0);
    for (const flipper of fit.flippers) {
      assert.ok(flipper.rotation <= 0.750001);
      assert.ok(flipper.gap >= -0.002);
      if (flipper.contactWeight === 1) assert.ok(flipper.gap <= 0.002);
    }
    // Missing upward projections remain explicit; this is a contact-fit result,
    // not a claim that raised anatomy has a floor beneath every skin vertex.
    assert.equal(typeof fit.bodyMissing, "number");
  }
});

test("actual pinniped skin and velocity remain continuous across the retained side-switch witnesses", async () => {
  const fixture = structuredClone(manifest);
  fixture.terrain.habitats.seaLion.path[0] = [-9.7, -6.6382, -14.8115];
  const w = await world(fixture),
    animals = new Map(landAnimals(w.scene).map((a) => [a.id, a]));
  const events = [
    ["seal-1", 29.609660901827738],
    ["seal-1", 23.50402294495143],
    ["seaLion-0", 35.0166365748737],
    ["seaLion-0", 21.94291925127618],
    ["seal-2", 133.2305416909512],
    ["seaLion-0", 27.692575177730753],
    ["seaLion-2", 97.2781108620984],
    ["seaLion-2", 155.63578344280248],
    ["seaLion-2", 155.49223302040025],
    ["seaLion-2", 54.146691484431486],
    ["seal-1", 160.21853028496952],
    ["seaLion-0", 122.5726781925276],
    ["seaLion-0", 122.61199625105097],
    ["seaLion-2", 108.76490770923947],
    ["seaLion-2", 108.80422576776282],
    ["seaLion-2", 165.46567827077303],
    ["seaLion-2", 165.50499632931968],
    ["seal-1", 32.23965700097632],
    ["seal-2", 12.077876922732656],
    ["seal-2", 12.11719498125601],
  ];
  function points(animal, time) {
    w.wildlife.update(time, "noon", { force: true });
    animal.group.updateMatrixWorld(true);
    return animal.meshes.flatMap((mesh) =>
      Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) =>
        mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)
      )
    );
  }
  for (const [id, time] of events) {
    const animal = animals.get(id),
      before = points(animal, time - 1e-5),
      after = points(animal, time + 1e-5);
    assert.ok(Math.max(...before.map((p, i) => p.distanceTo(after[i]))) < 0.0005, `${id}/${time} changed discontinuously`);
    const h = 1e-4,
      left = points(animal, time - h),
      centre = points(animal, time),
      right = points(animal, time + h);
    const velocityDifference = Math.max(...left.map((p, i) => right[i].clone().add(p).addScaledVector(centre[i], -2).length() / h));
    assert.ok(velocityDifference < 0.25, `${id}/${time}: one-sided velocity differs by ${velocityDifference} m/s`);
    const pose = pinnipedActing(time, Number(id.split("-")[1]), id.startsWith("seaLion")),
      l = pinnipedFlipperActivation(pose, "L"),
      r = pinnipedFlipperActivation(pose, "R");
    assert.ok(l >= 0.15 && l <= 1 && r >= 0.15 && r <= 1);
    assert.ok(Math.abs(l + r - 1.15) < 1e-12);
  }
});

test("pinniped blend weights stay within their physical range at release endpoints", () => {
  let previous = 0;
  for (const value of [-0.1, 0, 1e-16, 0.25, 0.5, 0.75, 1 - 1e-14, 1 - 1e-16, 1, 1.1]) {
    const weight = pinnipedBlendWeight(value);
    assert.ok(weight >= 0 && weight <= 1 && weight >= previous);
    assert.ok(Math.abs(weight + pinnipedBlendWeight(1 - value) - 1) < 1e-15);
    previous = weight;
  }
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
