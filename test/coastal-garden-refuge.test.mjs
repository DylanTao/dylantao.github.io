import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createLightInstallations, MAX_POINTS, RECEIVER_TOLERANCE, SCHEDULES } from "../assets/js/home-scene/light-installations.mjs";

// The garden furnishings under the bedroom stay in the kitchen model. The lowered shell and
// shifted lantern are authored together in bin/coastal_sunken_tea.py.
const manifest = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));
const glb = readFileSync(new URL("../assets/models/home/room-kitchen.glb", import.meta.url));
const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
const lamp = manifest.installationPoints.find((point) => point.id === "tea-garden-lantern");
// The furnished bay ends at the inside face of the opaque east fin. In web
// metres the new stone floor is at −1.04 and the retained soffit is at 1.34.
const FLOOR = -1.04;
const BAY = { min: [-8.43, FLOOR, 3.4], max: [-5.45, 1.34, 6.3] };
const GEOMETRY_TOLERANCE = 0.002;

// World bounds of a node whose mesh is untransformed apart from a translation, which is how the
// exporter writes every static object. Draco keeps the POSITION accessor's min and max.
function bounds(node) {
  assert.ok(!node.rotation && !node.scale && !node.matrix, `${node.name} carries only a translation`);
  const offset = node.translation || [0, 0, 0],
    min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  let triangles = 0;
  for (const primitive of gltf.meshes[node.mesh].primitives) {
    const position = gltf.accessors[primitive.attributes.POSITION];
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], position.min[axis] + offset[axis]);
      max[axis] = Math.max(max[axis], position.max[axis] + offset[axis]);
    }
    triangles += gltf.accessors[primitive.indices].count / 3;
  }
  return { min, max, triangles };
}
const garden = gltf.nodes.filter((node) => node.name?.startsWith("kitchen_garden"));

test("the garden stays inside its bay and inside its triangle allowance", () => {
  assert.equal(garden.length, 16, "one object per material, like the rest of the room");
  let triangles = 0;
  for (const node of garden) {
    const box = bounds(node);
    triangles += box.triangles;
    for (let axis = 0; axis < 3; axis++) {
      // Position quantization moves a vertex by well under a millimetre.
      assert.ok(box.min[axis] >= BAY.min[axis] - GEOMETRY_TOLERANCE, `${node.name} crosses the bay's low side on axis ${axis}: ${box.min[axis]}`);
      assert.ok(box.max[axis] <= BAY.max[axis] + GEOMETRY_TOLERANCE, `${node.name} crosses the bay's high side on axis ${axis}: ${box.max[axis]}`);
    }
  }
  assert.ok(triangles <= 4500, `${triangles} triangles`);
  // Containment alone would let all sixteen meshes remain on their old ledge.
  // The 13 mm gravel bed sits on the lowered slab, at the actual Walk sole.
  const gravel = bounds(garden.find((node) => node.name === "kitchen_garden__honed travertine"));
  assert.ok(Math.abs(gravel.min[1] - (FLOOR + 0.002)) <= GEOMETRY_TOLERANCE, "gravel bears on the lowered slab");
  assert.ok(Math.abs(gravel.max[1] - (FLOOR + 0.015)) <= GEOMETRY_TOLERANCE, "gravel top matches the build");
  const walk = manifest.walk.places["tea-garden"];
  assert.equal(walk.room, "kitchen", "this stop streams the furnished garden");
  assert.ok(Math.abs(walk.position[1] - gravel.max[1]) <= GEOMETRY_TOLERANCE, "Walk starts at the gravel top");
});

test("the lantern's lamp sits inside its paper shade and glows with it", () => {
  assert.ok(lamp, "the manifest carries the garden's installation point");
  assert.deepEqual(lamp.position, [-7.27, -0.349, 5.06], "the lamp went down with the bed and inland with the tea platform");
  assert.equal(lamp.transport, false, "the lantern remains a scheduled local point");
  const shades = garden.filter((node) => node.extras?.installationGlow);
  assert.equal(shades.length, 1, "one glowing shade");
  assert.equal(shades[0].extras.installationGlow, lamp.glowTag);
  const shade = bounds(shades[0]);
  for (let axis = 0; axis < 3; axis++)
    assert.ok(
      lamp.position[axis] > shade.min[axis] + 0.02 && lamp.position[axis] < shade.max[axis] - 0.02,
      `the lamp is outside its shade on axis ${axis}`
    );
  // The shade's own material: the shared washi keeps the living room lantern's schedule.
  const material = gltf.materials[gltf.meshes[shades[0].mesh].primitives[0].material];
  assert.equal(material.name, "garden lantern paper");
  const [r, g, b] = material.emissiveFactor;
  assert.ok(r > g && g > b && b > 0, "a warm lamp behind the paper");
  // Off by day, a steady low level through the dark, like the path lights outside.
  assert.equal(lamp.schedule, "steps");
  assert.equal(SCHEDULES.steps({ dark: { outside: 0, inside: 0 } }), 0);
  assert.ok(SCHEDULES.steps({ dark: { outside: 1, inside: 1 } }) > 0.3);
});

test("the lamp lights the garden and the terrace it opens onto, and costs the full receivers nothing", () => {
  for (const node of garden) assert.equal(node.extras?.installationGroup, "exterior", `${node.name} is lit with the terrace`);
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(lamp.position[axis] > lamp.region.min[axis] && lamp.position[axis] < lamp.region.max[axis]);
    // The whole bay is inside the lamp's reach except its outermost centimetres at the walls.
    assert.ok(lamp.region.min[axis] <= BAY.min[axis] + 0.05 && lamp.region.max[axis] >= BAY.max[axis] - 0.05, `axis ${axis}`);
  }
  const overlaps = (region) =>
    [0, 1, 2].every(
      (axis) => lamp.region.min[axis] <= region.max[axis] + RECEIVER_TOLERANCE && lamp.region.max[axis] >= region.min[axis] - RECEIVER_TOLERANCE
    );
  const reached = Object.entries(manifest.installationReceivers.groups)
    .filter(([, value]) => [value].flat().some(overlaps))
    .map(([name]) => name)
    .sort();
  // The living floor, upper floor and shell are at their ten-point capacity.
  // The east fin shields them while the garden and library still receive the lantern.
  assert.deepEqual(reached, ["exterior", "library"]);
  const packs = createLightInstallations(manifest).evidence().receiverPacks;
  for (const [name, pack] of Object.entries(packs)) assert.ok(pack.points <= MAX_POINTS, `${name}: ${pack.points} points`);
  assert.equal(packs.living.points, MAX_POINTS, "the living floor has no room for an eleventh light");
});
