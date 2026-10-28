import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as THREE from "../assets/js/three.module.min.js";
import { nativeGeometry } from "./helpers/coastal-native-geometry.mjs";
import { loadNativeModel } from "./helpers/coastal-native-avatar.mjs";

const base = process.env.COASTAL_MODELS_ROOT
  ? pathToFileURL(`${resolve(process.env.COASTAL_MODELS_ROOT)}/`)
  : new URL("../assets/models/home/", import.meta.url);
const config = JSON.parse(readFileSync(new URL("manifest.json", base), "utf8"));

test("delivered static geology retains active nonwhite COLOR_0 AO and finite split normals", async (t) => {
  const records = [];
  for (const file of [config.shell, config.coast]) {
    const { scene } = await loadNativeModel(file, base);
    scene.traverse((mesh) => {
      if (!mesh.isMesh || ![mesh.material].flat().some((material) => /sandstone/i.test(material.name))) return;
      const color = mesh.geometry.attributes.color,
        normal = mesh.geometry.attributes.normal;
      // Legacy unbaked caps/shadow shells have no authored AO. The regression
      // concerns the retained bake field, which must reach primary COLOR_0.
      if (!color) return;
      assert.ok(normal, `${mesh.name}: actual split normal attribute`);
      assert.equal(mesh.geometry.attributes.color1, undefined, "AO must be active COLOR_0, not an unused secondary stream");
      assert.ok([mesh.material].flat().every((material) => material.vertexColors));
      let low = Infinity,
        high = -Infinity,
        maximumNormalLengthError = 0;
      for (let i = 0; i < color.count; i++) {
        low = Math.min(low, color.getX(i));
        high = Math.max(high, color.getX(i));
        const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
        assert.ok(Number.isFinite(length));
        maximumNormalLengthError = Math.max(maximumNormalLengthError, Math.abs(length - 1));
      }
      assert.ok(maximumNormalLengthError < 0.025, "actual eight-bit decoded normals remain unit length");
      records.push({ file, mesh: mesh.name, vertices: color.count, minimumAO: low, maximumAO: high, maximumNormalLengthError });
    });
  }
  assert.ok(records.length >= 2);
  for (const file of [config.shell, config.coast])
    assert.ok(
      records.some((row) => row.file === file && row.minimumAO < 0.95 && row.maximumAO - row.minimumAO > 0.1),
      `${file}: retained authored AO has nonwhite contrast`
    );
  t.diagnostic(JSON.stringify(records));
});

function inside(polygon, [x, z]) {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}

test("pool activity contacts and traversable surfaces bind to the decoded coping, every tread and basin floor", async (t) => {
  assert.ok(config.infinityPool.activity, "final house provides an authored activity, without making pool water public Walk support");
  const activity = config.infinityPool.activity;
  assert.equal(activity.path.length, 10);
  assert.equal(activity.path.filter((point) => point.id.startsWith("entry-tread-")).length, 7);
  assert.deepEqual(activity.entry, activity.path[0].position);
  assert.deepEqual(activity.recovery, activity.entry);
  assert.deepEqual(activity.exit, [...activity.path].reverse());
  assert.equal(config.activities.pool.clip, "idle");
  assert.equal(config.activities.pool.previewOnly, true);
  const root = await nativeGeometry(config.shell, base),
    meshes = [];
  root.traverse((node) => {
    if (!node.isMesh || node.material.transparent || node.material.transmission || node.material.opacity < 0.99) return;
    let name = "";
    for (let p = node; p; p = p.parent) name += ` ${p.name}`;
    if (/core_estate_(pool|terrace)__|core_finish_pool_entry_coping/.test(name)) {
      node.material.side = THREE.DoubleSide;
      meshes.push(node);
    }
  });
  assert.ok(meshes.length > 5, "use all actual pool solids, not a proxy height plane");
  const caster = new THREE.Raycaster(),
    direction = new THREE.Vector3(0, -1, 0),
    errors = [];
  function actual(point, expected, label) {
    caster.set(new THREE.Vector3(point[0], activity.waterline + 0.5, point[1]), direction);
    const hits = caster.intersectObjects(meshes, false);
    assert.ok(hits.length, `${label}: decoded opaque surface exists`);
    const hit = hits[0];
    const error = Math.abs(hit.point.y - expected);
    errors.push(error);
    assert.ok(error <= 0.003, `${label}: actual nearest opaque surface differs ${error}m from native support`);
  }
  for (const point of activity.path) {
    const surface = activity.supportSurfaces.find((surface) => surface.id === point.supportId);
    assert.ok(surface && inside(surface.polygon, [point.position[0], point.position[2]]), `${point.id}: route is within its owned face`);
    actual([point.position[0], point.position[2]], point.position[1], point.id);
  }
  for (const surface of activity.supportSurfaces) {
    const centroid = surface.polygon.reduce((sum, p) => [sum[0] + p[0] / surface.polygon.length, sum[1] + p[1] / surface.polygon.length], [0, 0]);
    // Inset from exact riser edges to avoid accepting either side of a shared
    // quantized edge; inspect the full interior, not a single route witness.
    for (const point of [centroid, ...surface.polygon.map((p) => p.map((value, k) => value * 0.94 + centroid[k] * 0.06))])
      actual(point, surface.height, surface.id);
    assert.ok(!config.terrain.supportSurfaces.some((p) => p.id === surface.id), "activity support never admits public Walk into water");
  }
  t.diagnostic(JSON.stringify({ decodedSamples: errors.length, maximumHeightErrorM: Math.max(...errors), meshes: meshes.length }));
});

test("bedside to study distance includes real stair endpoints, and the compact stair retains physical dimensions", () => {
  const room = (id) => config.rooms.find((room) => room.id === id),
    layout = config.estateLibrary.adjacentBedchamber;
  assert.ok(layout);
  assert.equal(config.estateLibrary.bridgeRemoved, true);
  assert.equal(config.estateLibrary.stairRoute.length, layout.riserCount);
  assert.ok(layout.clearTreadWidth >= 0.9 && layout.rise <= 0.178 && layout.going >= 0.18);
  const points = [
    room("sleep").walkActor,
    ...config.estateLibrary.bedroomApproach.slice(1),
    ...config.estateLibrary.privateConnection,
    room("study").actor,
  ];
  const length = points.slice(1).reduce((sum, point, i) => sum + Math.hypot(...point.map((v, k) => v - points[i][k])), 0);
  assert.ok(length <= 6, `complete standing bedside to seated study route: ${length}m`);
  assert.ok(
    Math.abs(layout.helixLength - Math.hypot((layout.walkRadius * layout.sweepDegrees * Math.PI) / 180, layout.floor)) < 1e-8,
    "a helix's full angular travel and actual rise are included"
  );
  assert.notDeepEqual(room("sleep").actor, room("sleep").walkActor, "lying pelvis cannot be used as a standing navigation target");
  const transfer = room("sleep").bedTransfer;
  assert.ok(transfer && transfer.nominalRootRoute.length > points.length, "the nominal audit includes real bed and chair transfers too");
  const whole = transfer.nominalRootRoute
    .slice(1)
    .reduce((sum, point, i) => sum + Math.hypot(...point.map((v, k) => v - transfer.nominalRootRoute[i][k])), 0);
  assert.ok(
    Math.abs(whole - transfer.nominalRootRouteMetres) < 1e-8 && whole <= 6,
    `nominal complete contact route ${whole}m; actual per-rig skin sweep remains independent`
  );
  assert.equal(Object.keys(transfer.feetByAvatar).length, 5);
  assert.ok(transfer.nativeFootControlSummary.maximumSoleSurfaceDistanceM <= 0.003);
});

test("actual delivered bedside planks support the five distinct seated foot stations", async () => {
  const room = config.rooms.find((room) => room.id === "sleep"),
    transfer = room.bedTransfer;
  const root = await nativeGeometry(config.shell, base),
    floor = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    let names = "";
    for (let node = mesh; node; node = node.parent) names += ` ${node.name}`;
    if (names.includes("core_finish_bedchamber_floor__")) {
      mesh.material.side = THREE.DoubleSide;
      floor.push(mesh);
    }
  });
  assert.ok(floor.length > 0);
  const caster = new THREE.Raycaster(),
    down = new THREE.Vector3(0, -1, 0);
  for (const [avatar, feet] of Object.entries(transfer.feetByAvatar))
    for (const side of ["L", "R"]) {
      const point = feet[side].position;
      caster.set(new THREE.Vector3(point[0], point[1] + 0.08, point[2]), down);
      const hit = caster.intersectObjects(floor, false)[0];
      assert.ok(hit && Math.abs(hit.point.y - point[1]) <= 0.003, `${avatar} ${side}: decoded actual plank within3mm`);
      assert.notEqual(point[0], room.walkActor[0], "standing approach is not used as a seated sole target");
    }
});

test("delivered spiral rails cap on the real wardrobe and the roof reveal survives Draco", async (t) => {
  const layout = config.estateLibrary.adjacentBedchamber,
    definition = layout.wardrobeRailTermination;
  assert.equal(definition.nativeCapCenters.length, 4);
  const shell = await nativeGeometry(config.shell, base),
    bedroom = await nativeGeometry(config.rooms.find((room) => room.id === "sleep").file, base);
  const rail = [],
    cabinet = [],
    core = [],
    roof = [];
  for (const root of [shell, bedroom])
    root.traverse((mesh) => {
      if (!mesh.isMesh) return;
      let names = "";
      for (let node = mesh; node; node = node.parent) names += ` ${node.name}`;
      mesh.material.side = THREE.DoubleSide;
      if (names.includes("core_finish_bedroom_spiral__honey ash")) rail.push(mesh);
      if (names.includes("sleep_reno_wardrobe__pale oak")) cabinet.push(mesh);
      if (names.includes("core__golden coastal sandstone")) core.push(mesh);
      if (names.includes("core_bathwing_liftaway_roof")) roof.push(mesh);
    });
  assert.ok(rail.length && cabinet.length && core.length && roof.length);
  const cabinetBounds = new THREE.Box3();
  for (const mesh of cabinet) cabinetBounds.union(new THREE.Box3().setFromObject(mesh));
  const railBounds = new THREE.Box3();
  for (const mesh of rail) railBounds.union(new THREE.Box3().setFromObject(mesh));
  assert.ok(cabinetBounds.max.y - railBounds.max.y > 0.8, "the actual closed wardrobe rises above the guard interval");
  const caster = new THREE.Raycaster(),
    capErrors = [],
    gaps = [];
  for (const native of definition.nativeCapCenters) {
    const point = new THREE.Vector3(native[0], native[2], -native[1]);
    const toward =
      Math.abs(point.x - cabinetBounds.min.x) < Math.abs(point.z - cabinetBounds.max.z) ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, -1);
    caster.set(point.clone().addScaledVector(toward, -0.04), toward);
    caster.far = 0.08;
    for (const [label, meshes] of [
      ["rail", rail],
      ["wardrobe", cabinet],
    ]) {
      const distances = caster.intersectObjects(meshes, false).map((hit) => hit.point.distanceTo(point));
      const error = Math.min(...distances);
      capErrors.push(error);
      assert.ok(error <= 0.003, `${label}: actual decoded end contact within3mm, got${error}m`);
    }
  }
  caster.far = 0.1;
  for (const [x, z] of [
    [-7.5, 6.36],
    [-6.8, 6.36],
    [-6.5, 6.36],
  ]) {
    caster.set(new THREE.Vector3(x, 5.21, z), new THREE.Vector3(0, -1, 0));
    const a = caster.intersectObjects(core, false)[0],
      b = caster.intersectObjects(roof, false)[0];
    assert.ok(a && b, "both actual ceiling surfaces exist at the old coplanar patch");
    const gap = b.point.y - a.point.y;
    gaps.push(gap);
    assert.ok(gap > 0.003 && Math.abs(gap - layout.roofReveal.gapM) < 0.006, `real decoded roof reveal: ${gap}m`);
  }
  t.diagnostic(
    JSON.stringify({
      maximumDecodedCapErrorM: Math.max(...capErrors),
      decodedRoofGapsM: gaps,
      guardHeightAboveRailM: cabinetBounds.max.y - railBounds.max.y,
    })
  );
});
