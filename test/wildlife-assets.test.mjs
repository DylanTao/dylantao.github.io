import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function model(name) {
  const data = readFileSync(new URL(`../assets/models/home/${name}.glb`, import.meta.url));
  assert.equal(data.toString("ascii", 0, 4), "glTF");
  const json = JSON.parse(data.toString("utf8", 20, 20 + data.readUInt32LE(12)));
  return { data, json, primitives: json.meshes.flatMap((mesh) => mesh.primitives) };
}

test("each independent animal export keeps canonical acting pivots", () => {
  for (const species of ["BrushRabbit", "CaliforniaSeaLion", "HarborSeal"]) {
    const { json } = model(species),
      names = json.nodes.map((node) => node.name);
    const expected = [
      "Head",
      "BodyPose",
      "EyeL",
      "EyeR",
      ...(species === "BrushRabbit"
        ? ["EarL", "EarR", "FrontPawL", "FrontPawR", "HindPawL", "HindPawR"]
        : ["FrontFlipperL", "FrontFlipperR", "RearFlipperL", "RearFlipperR"]),
    ];
    for (const name of expected)
      assert.equal(
        names.filter((value) => value === name).length,
        1,
        `${species} requires one ${name}; Blender numeric suffixes disable runtime acting`
      );
    assert.ok(names.includes(species));
  }
});

test("marine coat marks remain vertex colors with bounded geometry and draw primitives", () => {
  let bytes = 0,
    instanceTriangles = 0;
  for (const species of ["BrushRabbit", "CaliforniaSeaLion", "HarborSeal"]) {
    const { data, json, primitives } = model(species);
    bytes += data.byteLength;
    const triangles = primitives.reduce((sum, primitive) => sum + json.accessors[primitive.indices].count / 3, 0);
    instanceTriangles += triangles * (species === "BrushRabbit" ? 2 : 3);
    assert.ok(primitives.length <= (species === "BrushRabbit" ? 24 : 12), `${species} draw budget`);
    if (species !== "BrushRabbit") {
      for (const primitive of primitives) {
        const name = json.materials[primitive.material].name;
        if (name.includes("sea lion") || name.includes("Harbor seal"))
          assert.ok(primitive.attributes.COLOR_0 !== undefined, `${species} ${name} lacks its authored vertex coat`);
      }
    }
  }
  assert.ok(bytes < 256 * 1024, `Three selected wildlife masters exceed 256 KiB: ${bytes}`);
  assert.ok(instanceTriangles < 100000, `Eight instances exceed 100k triangles: ${instanceTriangles}`);
});
