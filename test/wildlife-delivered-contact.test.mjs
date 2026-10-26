import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { THREE, loadNativeModel } from "./helpers/coastal-native-avatar.mjs";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";
import { createWildlife } from "../assets/js/home-scene/wildlife.mjs";
import { createGroundPatch, isCoastalGround } from "../assets/js/home-scene/wildlife-ground-contact.mjs";
import { gullSchedule, gullRaid } from "../assets/js/home-scene/wildlife-neighbor-motion.mjs";

// A worker may inspect the coordinator's frozen export without copying or committing its files.
// CI and ordinary runs always verify this repository's own delivered models.
const verifiedRoot = process.env.COASTAL_VERIFY_ROOT
  ? pathToFileURL(path.resolve(process.env.COASTAL_VERIFY_ROOT) + path.sep)
  : new URL("../", import.meta.url);
const models = new URL("assets/models/home/", verifiedRoot);
const config = JSON.parse(fs.readFileSync(new URL("manifest.json", models)));
const perches = JSON.parse(fs.readFileSync(new URL("wildlife-perch-support.json", models)));
const PAWS = ["FrontPawL", "FrontPawR", "HindPawL", "HindPawR"];
const tick = () => new Promise(setImmediate);

async function loadedWildlife(manifest, grounds) {
  const scene = new THREE.Group(),
    environment = new THREE.Group();
  scene.add(environment, ...grounds);
  const wildlife = createWildlife(environment, manifest, {
    createModelLoader: () => ({ loader: { loadAsync: (url) => loadNativeModel(url.split("/").at(-1), models) }, decoder: { dispose() {} } }),
    loadPerchSupport: async () => perches,
  });
  for (let i = 0; i < 300 && !wildlife.evidence().modelsReady; i++) await tick();
  assert.equal(wildlife.evidence().modelsReady, true, "all actual delivered animal skins loaded");
  wildlife.captureGround([scene]);
  const first = wildlife.evidence().raccoon.ground.triangles;
  wildlife.captureGround([scene]);
  assert.equal(wildlife.evidence().raccoon.ground.triangles, first, "a repeated capture does not duplicate the patch");
  return {
    scene,
    wildlife,
    pose(t, palette) {
      wildlife.update(t, palette, { force: true });
      scene.updateMatrixWorld(true);
      scene.traverse((o) => o.isSkinnedMesh && o.skeleton.update());
    },
    dispose: () => wildlife.dispose(),
  };
}

// Independent intersection oracle: a real Three.js raycaster against a bounded copy of
// delivered triangles. It does not query the production contact patch or its height function.
function groundOracle(roots, path, allowOverhang = false) {
  const lo = [Math.min(...path.map((p) => p[0])) - 0.7, Math.min(...path.map((p) => p[2])) - 0.7],
    hi = [Math.max(...path.map((p) => p[0])) + 0.7, Math.max(...path.map((p) => p[2])) + 0.7];
  const vertices = [],
    a = new THREE.Vector3(),
    b = a.clone(),
    c = a.clone(),
    normal = a.clone(),
    edge = a.clone();
  for (const root of roots) {
    root.updateMatrixWorld(true);
    root.traverse((mesh) => {
      if (!mesh.isMesh || /plant|flora|leaf|water|glass|shadow/i.test(mesh.name + mesh.material?.name)) return;
      const attr = mesh.geometry.attributes.position,
        ix = mesh.geometry.index;
      for (let i = 0; i < (ix?.count ?? attr.count); i += 3) {
        a.fromBufferAttribute(attr, ix ? ix.getX(i) : i).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(attr, ix ? ix.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
        c.fromBufferAttribute(attr, ix ? ix.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
        if (Math.max(a.x, b.x, c.x) < lo[0] || Math.min(a.x, b.x, c.x) > hi[0] || Math.max(a.z, b.z, c.z) < lo[1] || Math.min(a.z, b.z, c.z) > hi[1])
          continue;
        normal.subVectors(b, a).cross(edge.subVectors(c, a)).normalize();
        if (normal.y > 0.25) vertices.push(...a.toArray(), ...b.toArray(), ...c.toArray());
      }
    });
  }
  assert.ok(vertices.length > 0, "the independent oracle has real upward triangles");
  const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  return (point) => {
    ray.set(new THREE.Vector3(point.x, point.y + 0.5, point.z), new THREE.Vector3(0, -1, 0));
    ray.far = 2;
    const hit = ray.intersectObject(mesh, false)[0];
    if (!hit && allowOverhang) return null;
    assert.ok(hit, `no actual support at ${point.toArray()}`);
    return point.y - hit.point.y;
  };
}

function pawVertices(root, names = PAWS, minimum = 100) {
  const result = Object.fromEntries(names.map((name) => [name, []]));
  root.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const skin = mesh.geometry.attributes.skinIndex,
      weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < skin.count; i++)
      for (const name of names) {
        let owned = 0;
        for (let k = 0; k < 4; k++) if (mesh.skeleton.bones[skin.getComponent(i, k)].name === name) owned += weights.getComponent(i, k);
        if (owned >= 0.999) result[name].push({ mesh, index: i });
      }
  });
  for (const entries of Object.values(result)) assert.ok(entries.length > minimum, "real paw vertices, not nominal ankle targets");
  return result;
}

// The gull's actual web is five vertices, so rail contact must also sample its
// deformed triangle interiors. These are barycentric points on the loaded skin,
// independently reconstructed rather than copied from the perch-support metadata.
function webSamples(root) {
  const result = { FootL: [], FootR: [] };
  root.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const skin = mesh.geometry.attributes.skinIndex,
      weights = mesh.geometry.attributes.skinWeight,
      ix = mesh.geometry.index;
    const owned = (i, name) => {
      let total = 0;
      for (let k = 0; k < 4; k++) if (mesh.skeleton.bones[skin.getComponent(i, k)].name === name) total += weights.getComponent(i, k);
      return total >= 0.999;
    };
    for (let f = 0; f < ix.count; f += 3) {
      const indices = [ix.getX(f), ix.getX(f + 1), ix.getX(f + 2)];
      for (const name of Object.keys(result))
        if (indices.every((i) => owned(i, name)))
          for (let a = 0; a <= 8; a++)
            for (let b = 0; b <= 8 - a; b++) result[name].push({ mesh, indices, weights: [a / 8, b / 8, 1 - (a + b) / 8] });
    }
  });
  for (const samples of Object.values(result)) assert.ok(samples.length > 100, "actual deformed web triangles were sampled");
  return result;
}
function webPoint(sample, out) {
  out.set(0, 0, 0);
  for (let k = 0; k < 3; k++) out.addScaledVector(sample.mesh.getVertexPosition(sample.indices[k], new THREE.Vector3()), sample.weights[k]);
  return out.applyMatrix4(sample.mesh.matrixWorld);
}

async function verifyRaccoon(manifest, grounds, times) {
  const fixture = await loadedWildlife(manifest, grounds),
    { wildlife } = fixture;
  try {
    assert.ok(wildlife.evidence().raccoon.ground.ready, "missing ground is a failure, never a proxy-height pass");
    const root = wildlife.target("raccoon-0").root,
      points = pawVertices(root),
      gap = groundOracle(grounds, manifest.terrain.habitats.raccoon.path),
      p = new THREE.Vector3();
    const states = new Set();
    let contacts = 0;
    for (const [t, palette] of times) {
      fixture.pose(t, palette);
      const e = wildlife.evidence().raccoon;
      states.add(e.state);
      for (const contact of e.contacts) {
        assert.ok(contact.supported > 20, `${contact.foot} has no delivered support samples`);
        assert.equal(contact.supportVisible, true);
        let minimum = Infinity;
        for (const { mesh, index } of points[contact.foot]) {
          mesh.getVertexPosition(index, p);
          p.applyMatrix4(mesh.matrixWorld);
          minimum = Math.min(minimum, gap(p));
        }
        assert.ok(minimum >= -0.002, `${e.state} ${contact.foot} penetrates ${minimum}m at ${t}`);
        if (contact.contact) {
          assert.ok(Math.abs(minimum) < 0.002, `${e.state} ${contact.foot} floats ${minimum}m at ${t}`);
          contacts++;
        }
      }
    }
    assert.ok(contacts > 50);
    // Repeated composed/paused times and a backwards seek must reproduce the skin exactly.
    const snapshot = () =>
      Object.values(points)
        .flat()
        .filter((_, i) => i % 11 === 0)
        .map(({ mesh, index }) => mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).toArray());
    fixture.pose(20, "evening");
    const before = snapshot();
    fixture.pose(800, "evening");
    fixture.pose(20, "evening");
    assert.deepEqual(snapshot(), before);
    fixture.pose(20, "evening");
    assert.deepEqual(snapshot(), before);
    return states;
  } finally {
    fixture.dispose();
  }
}

test("actual delivered raccoon paws meet decoded terrain through sleep, wake, forage and complete walking strides", async () => {
  const grounds = await Promise.all(["home-shell.glb", "coast.glb"].map((name) => nativeGeometry(name, models)));
  const times = [
    [0, "afternoon"],
    [2, "afternoon"],
    [10, "afternoon"],
    [0, "evening"],
  ];
  for (let t = 0.25; t <= 360; t += 2) times.push([t, "evening"]);
  for (let t = 7; t <= 8.1; t += 1 / 60) times.push([t, "evening"]);
  const states = await verifyRaccoon(config, grounds, times);
  for (const state of ["sleep", "wake", "walk", "dig", "stand", "wash", "sniff", "look"]) assert.ok(states.has(state), state);
});

test("loaded paws follow changed paths and slopes, while leaves, furniture and missing patches cannot count as ground", async () => {
  for (const [gx, gz] of [
    [0.45, 0.18],
    [-0.4, 0.3],
  ]) {
    const manifest = structuredClone(config),
      path = Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * Math.PI * 2,
          x = Math.cos(a) * 0.9,
          z = Math.sin(a) * 0.7;
        return [x, 2 + gx * x + gz * z + 0.025, z];
      });
    manifest.terrain.habitats.raccoon.path = path;
    const positions = [-3, 2 - 3 * gx + 3 * gz, 3, 3, 2 + 3 * gx + 3 * gz, 3, 3, 2 + 3 * gx - 3 * gz, -3, -3, 2 - 3 * gx - 3 * gz, -3];
    const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)).setIndex([0, 1, 2, 0, 2, 3]);
    const plane = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    plane.name = "coast_test_sandstone";
    const times = [
      [0, "afternoon"],
      [0, "evening"],
    ];
    for (let t = 0.25; t <= 60; t += 2) times.push([t, "evening"]);
    await verifyRaccoon(manifest, [plane], times);
    const patch = createGroundPatch(path),
      impostor = plane.clone();
    impostor.name = "coast_sage_leaf";
    assert.equal(isCoastalGround(impostor), false);
    patch.capture([impostor]);
    assert.equal(patch.evidence().ready, false);
    assert.equal(patch.sample(0, 0), null);
    const table = plane.clone();
    table.name = "table";
    table.userData.furnitureAnchor = "a-table";
    assert.equal(isCoastalGround(table), false);
  }
});

test("actual gull skins clear delivered rock and rail through four land/perch/depart cycles, with intentional airborne hover", async () => {
  const grounds = await Promise.all(["home-shell.glb", "coast.glb"].map((name) => nativeGeometry(name, models)));
  const fixture = await loadedWildlife(config, grounds),
    { wildlife } = fixture;
  try {
    const records = [];
    for (const id of ["gull-0", "gull-1", "gull-2", "gull-3", "balcony-gull-0"]) {
      const group = wildlife.target(id).root,
        index = id === "balcony-gull-0" ? 3 : Number(id.at(-1)) % 3;
      records.push({
        id,
        group,
        vertices: webSamples(group),
        gap: groundOracle(grounds, [perches.patches[index].origin], true),
      });
    }
    const times = new Set();
    for (let index = 0; index < 4; index++)
      for (let epoch = 0; epoch < 4; epoch++) {
        const s = gullSchedule(epoch * 90 + 1 - index * 19, index);
        for (const dt of [-2, -1, -0.25, 0, 0.1, 0.4, 1, 3]) times.add(s.perchStart + dt);
        for (const dt of [-0.25, 0, 0.1, 0.3, 0.45, 0.8, 1.4, 2.5]) times.add(s.perchEnd + dt);
      }
    let planted = 0,
      transient = 0;
    const p = new THREE.Vector3();
    for (const t of [...times].filter((t) => t >= 0).sort((a, b) => a - b)) {
      fixture.pose(t, "afternoon");
      const e = wildlife.evidence();
      for (const record of records) {
        const index = Number(record.id.at(-1)),
          bird = record.id === "balcony-gull-0" ? { state: "perch", contacts: e.balconyGullContacts } : e.birds[index];
        if (!bird.contacts.length) continue;
        for (const contact of bird.contacts) {
          let min = Infinity,
            n = 0;
          for (const sample of record.vertices[contact.foot]) {
            webPoint(sample, p);
            const distance = record.gap(p);
            if (distance === null) continue;
            n++;
            min = Math.min(min, distance);
          }
          assert.ok(n > 0, `${record.id} has no real rock/rail under any sole vertex`);
          assert.ok(min >= -0.002, `${record.id} ${contact.foot} penetrates ${min}m at ${t}`);
          if (bird.state === "perch") {
            assert.ok(Math.abs(min) < 0.003, `${record.id} floats ${min}m at ${t}`);
            planted++;
          } else transient++;
        }
      }
    }
    assert.ok(planted > 200 && transient > 50, "actual landed and transient feet were measured");
    let hovers = 0;
    for (let epoch = 0; epoch < 20; epoch++) {
      const raid = gullRaid(epoch, perches.patches[0].origin);
      if (!raid) continue;
      for (const t of [raid.arrive, (raid.arrive + raid.leave) / 2, raid.leave - 0.01]) {
        fixture.pose(t, "afternoon");
        const e = wildlife.evidence().birds[3];
        assert.equal(e.state, "squabble");
        assert.equal(e.contacts.length, 0, "a hovering bird has no planted contact claim");
        for (const sample of Object.values(records[3].vertices).flat()) {
          webPoint(sample, p);
          assert.ok(p.y - perches.patches[0].origin[1] > 0.5, "the actual deployed web is airborne over the perch");
        }
        hovers++;
      }
    }
    assert.ok(hovers > 3);
  } finally {
    fixture.dispose();
  }
});
