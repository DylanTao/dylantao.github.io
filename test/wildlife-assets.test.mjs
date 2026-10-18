import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function model(name) {
  const data = readFileSync(new URL(`../assets/models/home/${name}.glb`, import.meta.url));
  assert.equal(data.toString("ascii", 0, 4), "glTF");
  const json = JSON.parse(data.toString("utf8", 20, 20 + data.readUInt32LE(12)));
  return { data, json, primitives: json.meshes.flatMap((mesh) => mesh.primitives) };
}

const pair = (name) => [`${name}L`, `${name}R`];
const BIRD = ["Head", "BodyPose", "Muzzle", "Tail", ...pair("Eye"), ...pair("Wing"), ...pair("WingTip"), ...pair("Leg"), ...pair("Foot")];
// Canonical acting bones per species and the number of instances the coast shows.
const SPECIES = {
  BrushRabbit: {
    instances: 2,
    bones: [
      "Head",
      "BodyPose",
      "Hips",
      "Chest",
      "Muzzle",
      "Tail",
      ...pair("Eye"),
      ...pair("Ear"),
      ...pair("Foreleg"),
      ...pair("FrontPaw"),
      ...pair("Hindleg"),
      ...pair("HindPaw"),
    ],
  },
  CaliforniaSeaLion: {
    instances: 5,
    bones: [
      "Head",
      "BodyPose",
      "Hips",
      "Chest",
      "Neck",
      "Jaw",
      ...pair("Eye"),
      ...pair("FrontFlipper"),
      ...pair("FrontFlipperTip"),
      ...pair("RearFlipper"),
    ],
  },
  HarborSeal: {
    instances: 3,
    bones: ["Head", "BodyPose", "Hips", "Chest", "Jaw", ...pair("Eye"), ...pair("FrontFlipper"), ...pair("FrontFlipperTip"), ...pair("RearFlipper")],
  },
  Raccoon: {
    instances: 1,
    bones: [
      "Head",
      "BodyPose",
      "Hips",
      "Chest",
      "Muzzle",
      "Tail",
      "TailMid",
      "TailTip",
      ...pair("Eye"),
      ...pair("Ear"),
      ...pair("Foreleg"),
      ...pair("LowerForeleg"),
      ...pair("FrontPaw"),
      ...pair("Hindleg"),
      ...pair("LowerHindleg"),
      ...pair("HindPaw"),
    ],
  },
  WesternGull: { instances: 5, bones: [...BIRD, "Neck", "Jaw"] },
  Sandpiper: { instances: 3, bones: [...BIRD, "Neck"] },
  BrownPelican: { instances: 5, bones: [...BIRD, "NeckBase", "NeckMid", "Jaw"] },
  BrandtsCormorant: { instances: 4, bones: [...BIRD, "NeckBase", "NeckMid", "Jaw"] },
};

test("each animal is one skinned mesh whose canonical acting bones rest unrotated", () => {
  for (const [species, { bones }] of Object.entries(SPECIES)) {
    const { json, primitives } = model(species),
      names = json.nodes.map((node) => node.name);
    assert.ok(names.includes(species), `${species} root`);
    for (const name of bones)
      assert.equal(
        names.filter((value) => value === name).length,
        1,
        `${species} requires one ${name}; Blender numeric suffixes disable runtime acting`
      );
    assert.equal(json.skins.length, 1, `${species} has one skeleton`);
    const joints = new Set(json.skins[0].joints.map((index) => json.nodes[index].name));
    for (const name of bones) assert.ok(joints.has(name), `${species} ${name} is a joint`);
    // Joints are authored along +Z with zero roll, so the runtime rotates about the model's own axes.
    for (const index of json.skins[0].joints) {
      const rotation = json.nodes[index].rotation || [0, 0, 0, 1];
      assert.ok(Math.abs(rotation[3]) > 1 - 1e-6, `${species} ${json.nodes[index].name} rests rotated`);
    }
    assert.equal(json.meshes.length, 1);
    assert.equal(primitives.length, 2, `${species} draws as a coat and a gloss primitive`);
    for (const primitive of primitives) {
      for (const attribute of ["POSITION", "NORMAL", "COLOR_0", "JOINTS_0", "WEIGHTS_0"])
        assert.ok(primitive.attributes[attribute] !== undefined, `${species} ${attribute}`);
      assert.ok(primitive.extensions?.KHR_draco_mesh_compression, `${species} Draco geometry`);
    }
  }
});

test("marine coats keep their authored vertex colours under the named coat materials", () => {
  for (const [species, label] of [
    ["CaliforniaSeaLion", "sea lion"],
    ["HarborSeal", "Harbor seal"],
  ]) {
    const { json, primitives } = model(species);
    const coat = primitives.find((primitive) => json.materials[primitive.material].name.includes(label));
    assert.ok(coat, `${species} coat material`);
    assert.ok(coat.attributes.COLOR_0 !== undefined, `${species} lacks its authored vertex coat`);
  }
});

test("the coast's wildlife stays within explicit payload, triangle and draw budgets", () => {
  let bytes = 0,
    triangles = 0,
    draws = 0,
    instances = 0;
  for (const [species, { instances: count }] of Object.entries(SPECIES)) {
    const { data, json, primitives } = model(species);
    bytes += data.byteLength;
    const each = primitives.reduce((sum, primitive) => sum + json.accessors[primitive.indices].count / 3, 0);
    assert.ok(each < 16000, `${species} ${each} triangles`);
    triangles += each * count;
    draws += primitives.length * count;
    instances += count;
  }
  assert.equal(instances, 28);
  // Eight masters weigh less than the former six (353 KiB), and 28 animals draw 56 primitives,
  // a fifth of the former seventeen animals' 256.
  assert.ok(bytes < 300 * 1024, `wildlife masters ${bytes} bytes`);
  assert.equal(draws, 56);
  assert.ok(triangles < 240000, `${triangles} instance triangles`);
});
