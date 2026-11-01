import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { THREE, loadNativeModel } from "./helpers/coastal-native-avatar.mjs";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";
import { createWildlife } from "../assets/js/home-scene/wildlife.mjs";
import { createGroundPatch } from "../assets/js/home-scene/wildlife-ground-contact.mjs";
import { rabbitActing, rabbitSchedule } from "../assets/js/home-scene/wildlife-motion.mjs";

const models = new URL("../assets/models/home/", import.meta.url);
const config = JSON.parse(fs.readFileSync(new URL("manifest.json", models)));
const perches = JSON.parse(fs.readFileSync(new URL("wildlife-perch-support.json", models)));
const species = ["BrushRabbit", "CaliforniaSeaLion", "HarborSeal", "Raccoon", "WesternGull", "Sandpiper", "BrownPelican", "BrandtsCormorant"];
const masters = await Promise.all(species.map((name) => loadNativeModel(name + ".glb", models)));
async function world(manifest, grounds) {
  const scene = new THREE.Group(),
    environment = new THREE.Group();
  scene.add(environment, ...grounds);
  const wildlife = createWildlife(environment, manifest, {
    createModelLoader: () => ({
      loader: { loadAsync: async (url) => masters[species.indexOf(url.split("/").at(-1).replace(".glb", ""))] },
      decoder: { dispose() {} },
    }),
    loadPerchSupport: async () => perches,
  });
  for (let i = 0; i < 100 && !wildlife.evidence().modelsReady; i++) await new Promise(setImmediate);
  assert.equal(wildlife.evidence().modelsReady, true);
  wildlife.captureGround(grounds);
  scene.updateMatrixWorld(true);
  const paws = [0, 1].map((index) => {
    const list = [];
    scene.traverse((mesh) => {
      if (!mesh.isSkinnedMesh || mesh.userData.action?.id !== `rabbit-${index}`) return;
      const skin = mesh.geometry.attributes.skinIndex,
        weights = mesh.geometry.attributes.skinWeight;
      for (let i = 0; i < skin.count; i++) {
        const names = new Map();
        for (let k = 0; k < 4; k++) {
          const name = mesh.skeleton.bones[skin.getComponent(i, k)].name;
          names.set(name, (names.get(name) || 0) + weights.getComponent(i, k));
        }
        for (const [name, weight] of names) if (/^(Front|Hind)Paw[LR]$/.test(name) && weight >= 0.999) list.push({ mesh, index: i, name });
      }
    });
    assert.ok(list.length > 1000);
    return list;
  });
  const patches = ["rabbitWest", "rabbitEast"].map((key) => {
    const p = createGroundPatch(manifest.terrain.habitats[key].path, 1);
    p.capture(grounds);
    assert.ok(p.evidence().ready);
    return p;
  });
  function measure(index) {
    scene.updateMatrixWorld(true);
    for (const mesh of new Set(paws[index].map((p) => p.mesh))) mesh.skeleton.update();
    const feet = Object.fromEntries(
      ["FrontPawL", "FrontPawR", "HindPawL", "HindPawR"].map((n) => [n, { minimum: Infinity, missing: 0, points: [] }])
    );
    for (const p of paws[index]) {
      const v = p.mesh.getVertexPosition(p.index, new THREE.Vector3()).applyMatrix4(p.mesh.matrixWorld),
        hit = patches[index].sample(v.x, v.z, v.y + 0.5),
        foot = feet[p.name];
      foot.points.push(v.toArray());
      if (!hit) foot.missing++;
      else foot.minimum = Math.min(foot.minimum, v.y - hit.height);
    }
    return feet;
  }
  function skinMinimum(index) {
    scene.updateMatrixWorld(true);
    let minimum = Infinity,
      missing = 0,
      witness = null;
    for (const mesh of new Set(paws[index].map((p) => p.mesh))) {
      mesh.skeleton.update();
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        const p = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld),
          hit = patches[index].sample(p.x, p.z, p.y + 0.5);
        if (!hit) {
          missing++;
          continue;
        }
        const gap = p.y - hit.height;
        if (gap < minimum) {
          minimum = gap;
          witness = { vertex: i, mesh: mesh.name, point: p.toArray(), support: hit.mesh, triangle: hit.triangle };
        }
      }
    }
    return { minimum, missing, witness };
  }
  return { scene, wildlife, paws, measure, skinMinimum };
}
function samples() {
  const times = new Set([0, 1, 2, 4, 8, 12, 16, 24, 32, 40, 48, 56, 64, 72]);
  for (const seed of [1, 2])
    for (const at of [0, 40, 80]) {
      const schedule = rabbitSchedule(at, seed);
      for (const s of schedule.segments) for (const t of [s.start + 1e-5, (s.start + s.end) / 2, s.end - 1e-5]) if (t >= 0) times.add(t);
      for (const h of schedule.hops)
        for (const u of [0, 0.05, 0.1, 0.18, 0.2, 0.35, 0.5, 0.7, 0.76, 0.85, 0.95, 1]) {
          const t = h.start + (h.end - h.start) * u;
          if (t >= 0) times.add(t);
        }
    }
  return [...times].sort((a, b) => a - b);
}
test("delivered rabbit contact soles fit retained terrain through idle, grazing and authored hop boundaries", async () => {
  const grounds = await Promise.all([nativeGeometry("home-shell.glb"), nativeGeometry("coast.glb")]);
  const runtime = await world(structuredClone(config), grounds);
  let planted = 0,
    airborne = 0;
  for (const time of samples()) {
    runtime.wildlife.update(time, "day", { force: true });
    const rows = runtime.wildlife.evidence().rabbitHabitats;
    for (let index = 0; index < 2; index++) {
      const pose = rabbitActing(time, index + 1),
        feet = runtime.measure(index);
      for (const [name, foot] of Object.entries(feet)) {
        assert.equal(foot.missing, 0, `missing ${index}/${name} at ${time}`);
        assert.ok(foot.minimum >= -0.002, `penetration ${index}/${name} at ${time}: ${foot.minimum}`);
        const intended =
          pose.contact && (!name.startsWith("Front") || pose.pawRaise < 1e-4) && (name.startsWith("Front") ? pose.foreLift : pose.hindLift) < 1e-5;
        if (intended) {
          const contact = rows[index].contacts.find((c) => c.foot === name);
          assert.ok(contact?.contact, `no fitted contact ${index}/${name} at ${time}`);
          assert.ok(foot.minimum < 0.002, `hover ${index}/${name} at ${time}: ${foot.minimum}`);
          planted++;
        }
      }
      if (pose.airborne) airborne++;
    }
  }
  assert.ok(planted > 200);
  assert.ok(airborne > 100);
});

function plane(gradient, half = 8) {
  const g = new THREE.PlaneGeometry(half * 2, half * 2, 2, 2);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, gradient[0] * p.getX(i) + gradient[1] * p.getZ(i));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: "La Jolla bluff sandstone" }));
  m.name = "coast_rabbit_measured_grade";
  return m;
}
function gradeConfig(gradient) {
  const c = structuredClone(config);
  for (const [i, key] of ["rabbitWest", "rabbitEast"].entries())
    c.terrain.habitats[key].path = Array.from({ length: 40 }, (_, j) => {
      const a = (j * Math.PI * 2) / 40,
        x = (i ? 1 : -1) + 0.5 * Math.cos(a),
        z = 0.5 * Math.sin(a);
      return [x, 0.025 + gradient[0] * x + gradient[1] * z, z];
    });
  return c;
}
test("the actual delivered paws remain supported on crossed grades without an assumed fixed drop", async () => {
  for (const grade of [
    [0.12, 0.18],
    [-0.14, 0.1],
    [0, 0],
  ]) {
    const runtime = await world(gradeConfig(grade), [plane(grade)]);
    for (const time of [0, 1, 2, 4, 8, 12, 16, 20, 24, 28]) {
      runtime.wildlife.update(time, "day", { force: true });
      for (let i = 0; i < 2; i++) {
        const feet = runtime.measure(i),
          pose = rabbitActing(time, i + 1);
        for (const [name, f] of Object.entries(feet)) {
          assert.equal(f.missing, 0);
          assert.ok(f.minimum >= -0.002, `${grade}/${i}/${name}/${time} penetrates ${f.minimum}`);
          if (pose.contact && (!name.startsWith("Front") || pose.pawRaise < 1e-4))
            assert.ok(f.minimum < 0.002, `${grade}/${i}/${name}/${time} floats ${f.minimum}`);
        }
      }
    }
  }
});

test("takeoff and landing remain continuous in actual delivered toe vertices", async () => {
  const runtime = await world(gradeConfig([0.08, -0.06]), [plane([0.08, -0.06])]);
  for (let index = 0; index < 2; index++)
    for (const hop of rabbitSchedule(0, index + 1).hops) {
      const takeoff = hop.kind === "bolt" ? 0.1 : 0.18,
        landing = hop.kind === "bolt" ? 0.85 : 0.76;
      for (const u of [takeoff, takeoff + 0.18 * (landing - takeoff), landing - 0.18 * (landing - takeoff), landing]) {
        const time = hop.start + (hop.end - hop.start) * u;
        if (time < 0) continue;
        runtime.wildlife.update(time - 1e-6, "day", { force: true });
        const a = runtime.measure(index);
        runtime.wildlife.update(time + 1e-6, "day", { force: true });
        const b = runtime.measure(index);
        for (const name of Object.keys(a))
          for (let j = 0; j < a[name].points.length; j++)
            assert.ok(
              new THREE.Vector3(...a[name].points[j]).distanceTo(new THREE.Vector3(...b[name].points[j])) < 0.0005,
              `${index}/${name}/${time} pops`
            );
      }
    }
});

test("fitting the contact paws does not bury the actual compressed hips or chest skin", async () => {
  const runtime = await world(structuredClone(config), await Promise.all([nativeGeometry("home-shell.glb"), nativeGeometry("coast.glb")]));
  for (const time of [
    4, 40.81043622694863, 41.165851385471875, 46.974470049910245, 47.00765733368508, 87.907285655383, 88.88695010004007, 90.21153888622113,
  ]) {
    runtime.wildlife.update(time, "day", { force: true });
    for (let i = 0; i < 2; i++) {
      const skin = runtime.skinMinimum(i);
      assert.equal(skin.missing, 0);
      assert.ok(skin.minimum >= -0.002, `${i}/${time} skin penetrates ${skin.minimum}: ${JSON.stringify(skin.witness)}`);
    }
  }
});

test("a footprint at an edge reports incomplete support and keeps the authored route finite", async () => {
  const runtime = await world(gradeConfig([0, 0]), [plane([0, 0], 0.6)]);
  let rejected = 0;
  for (let time = 0; time <= 40; time += 2) {
    runtime.wildlife.update(time, "day", { force: true });
    for (const row of runtime.wildlife.evidence().rabbitHabitats) {
      assert.ok(row.position.every(Number.isFinite));
      for (const c of row.contacts)
        if (c.reason && c.reason !== "intentional raised paw") {
          assert.equal(c.contact, false);
          assert.ok(c.supported < (c.samples || Infinity));
          rejected++;
        }
    }
  }
  assert.ok(rejected > 10, "the actual missing-edge control must exercise the guarded fallback");
});
