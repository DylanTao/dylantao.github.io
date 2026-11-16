import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "../assets/js/three.module.min.js";
import {
  BRUSH_SHEET,
  STROKE_ASPECT,
  STROKE_DENSITY,
  STROKE_LAYERS,
  STROKE_LIMITS,
  STROKE_SIZES,
  brushSheetPixels,
  createPaint,
  finestStroke,
  scatterStrokes,
  strokeAlong,
  strokeRandom,
} from "../assets/js/home-scene/paint-strokes.mjs";
import { COLOUR_GLSL, LOOKS, createPrintLook, structureId, structureKind, structureSkips } from "../assets/js/home-scene/print-look.mjs";

const tools = { structureId, structureKind, structureSkips };
const focus = new THREE.Vector3();

// A level square of side `side` metres, two triangles, with painted vertices if asked.
function square(side, { colour = 0x8090a0, painted = null, material = {} } = {}) {
  const geometry = new THREE.BufferGeometry();
  const h = side / 2;
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-h, 0, -h, h, 0, -h, h, 0, h, -h, 0, h]), 3));
  geometry.setIndex([0, 2, 1, 0, 3, 2]);
  if (painted) geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(painted), 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: colour, vertexColors: Boolean(painted), ...material }));
  mesh.name = "test_floor";
  return mesh;
}

test("each stroke size is three times the last, and a surface holds nine times fewer of it", () => {
  assert.equal(STROKE_SIZES.length, 5);
  for (let i = 1; i < STROKE_SIZES.length; i++) {
    assert.ok(Math.abs(STROKE_SIZES[i] / STROKE_SIZES[i - 1] - 3) < 1e-9);
    assert.ok(Math.abs(STROKE_DENSITY[i - 1] / STROKE_DENSITY[i] - 9) < 1e-6);
  }
  // Every size covers a surface about one and a half times over.
  STROKE_SIZES.forEach((size, i) => assert.ok(Math.abs(STROKE_DENSITY[i] * size * size * STROKE_ASPECT - 1.5) < 1e-9));
});

test("a stroke suits the thing it paints", () => {
  assert.equal(finestStroke("cushion linen", 4, 0.6), 0, "a cushion gets the smallest");
  assert.equal(finestStroke("wall plaster", 4, 5), 1, "a wall the next");
  assert.equal(finestStroke("floor oak", 4, 6), 1);
  assert.equal(finestStroke("terrace stone", 4, 30), 2, "nothing in the house is painted more broadly than that");
  // Far from where the view is centred, finer strokes would never be seen.
  assert.equal(finestStroke("cushion linen", 50, 0.6), 1);
  assert.equal(finestStroke("cushion linen", 200, 0.6), 2);
  // Ground and rock are painted broadly whatever their size.
  assert.equal(finestStroke("core_carved_mainland golden coastal sandstone", 10, 300), 2);
  assert.equal(finestStroke("hinterland_ground_00 hinterland sandy loam", 200, 900), 3);
  assert.equal(STROKE_LAYERS, 3);
});

test("the brush follows the boards on a floor, the courses on a wall and the length of a post", () => {
  const out = new THREE.Vector3(),
    east = new THREE.Vector3(1, 0, 0),
    up = new THREE.Vector3(0, 1, 0),
    wall = new THREE.Vector3(0, 0, 1),
    slope = new THREE.Vector3(0.3, 0.9, 0.2).normalize();
  assert.deepEqual(strokeAlong(up, east, false, out).toArray(), [1, 0, 0]);
  strokeAlong(wall, east, false, out);
  assert.ok(Math.abs(out.y) < 1e-9 && Math.abs(Math.abs(out.x) - 1) < 1e-9, "level, across the wall");
  strokeAlong(wall, east, true, out);
  assert.ok(Math.abs(out.y - 1) < 1e-9, "upright on a post");
  for (const normal of [up, wall, slope, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0)])
    for (const upright of [false, true]) {
      strokeAlong(normal, east, upright, out);
      assert.ok(Math.abs(out.length() - 1) < 1e-9, "a direction");
      assert.ok(Math.abs(out.dot(normal)) < 1e-9, "that lies in the surface");
    }
});

test("the same scene is painted with the same strokes every time", () => {
  const a = strokeRandom(42),
    b = strokeRandom(42),
    c = strokeRandom(43);
  let differs = false;
  for (let i = 0; i < 200; i++) {
    const value = a();
    assert.ok(value >= 0 && value < 1);
    assert.equal(value, b());
    if (value !== c()) differs = true;
  }
  assert.ok(differs);
});

test("eight brush marks: each starts loaded, ends dry, and stays inside its cell", () => {
  const pixels = brushSheetPixels(),
    { columns, rows, width, height } = BRUSH_SHEET;
  assert.equal(pixels.length, columns * width * rows * height * 4);
  const sums = [];
  for (let mark = 0; mark < columns * rows; mark++) {
    const ox = (mark % columns) * width,
      oy = Math.floor(mark / columns) * height,
      paint = (x, y) => pixels[((oy + y) * columns * width + ox + x) * 4];
    let head = 0,
      tail = 0,
      edge = 0,
      all = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const value = paint(x, y);
        all += value;
        if (x > width * 0.15 && x < width * 0.4) head += value;
        if (x > width * 0.7 && x < width * 0.95) tail += value;
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) edge = Math.max(edge, value);
      }
    assert.equal(edge, 0, `mark ${mark} would bleed into its neighbour`);
    assert.ok(head > tail * 1.4, `mark ${mark} is loaded at its head and dry at its tail`);
    sums.push(all);
  }
  assert.equal(new Set(sums).size, columns * rows, "no two marks are the same");
});

test("strokes are scattered by area, largest first, in the surface's own colour", () => {
  const side = 2,
    floor = square(side),
    found = scatterStrokes(floor, { focus, tools });
  // A two metre floor: the finest is the smallest size, and three sizes are laid.
  const expected = side * side * (STROKE_DENSITY[0] + STROKE_DENSITY[1] + STROKE_DENSITY[2]);
  assert.ok(Math.abs(found.count - expected) < expected * 0.1, `${found.count} strokes for about ${Math.round(expected)}`);
  assert.equal(found.places.length, found.count * 3);
  const sizes = [];
  for (let i = 0; i < found.count; i++) {
    const [x, y, z] = found.places.subarray(i * 3, i * 3 + 3);
    assert.ok(Math.abs(x) <= side / 2 + 1e-6 && Math.abs(z) <= side / 2 + 1e-6 && Math.abs(y) < 1e-6, "on the floor");
    sizes.push(found.normals[i * 4 + 3]);
    // Facing up, laid level, a unit direction.
    assert.equal(found.normals[i * 4 + 1], 127);
    const along = [found.alongs[i * 4], found.alongs[i * 4 + 1], found.alongs[i * 4 + 2]].map((v) => v / 127);
    assert.ok(Math.abs(Math.hypot(...along) - 1) < 0.03);
    assert.ok(Math.abs(along[1]) < 0.02);
    assert.equal(found.ids[i], structureId(floor.id, 0));
  }
  assert.deepEqual(
    sizes,
    [...sizes].sort((a, b) => b - a),
    "largest strokes first, as a painter blocks in"
  );
  assert.deepEqual([...new Set(sizes)].sort(), [0, 1, 2]);
  // The colour is the material's, kept as its square root in a byte.
  const colour = floor.material.color;
  assert.equal(found.owns[0], Math.round(Math.sqrt(colour.r) * 255));
  assert.equal(found.owns[1], Math.round(Math.sqrt(colour.g) * 255));
  assert.equal(found.owns[2], Math.round(Math.sqrt(colour.b) * 255));
  // Again: the same strokes.
  const again = scatterStrokes(floor, { focus, tools });
  assert.deepEqual(again.places, found.places);
  assert.deepEqual(again.alongs, found.alongs);
  // A limit holds, and thinning thins.
  assert.equal(scatterStrokes(floor, { focus, tools, limit: 100 }).count, 100);
  assert.ok(scatterStrokes(floor, { focus, tools, thin: 0.25 }).count < found.count * 0.35);
});

test("painted vertices tint the strokes, and a moved mesh keeps its strokes in its own space", () => {
  // Red at one corner, white at the others.
  const floor = square(2, { colour: 0xffffff, painted: [1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1] });
  floor.position.set(40, 3, -7);
  floor.rotation.y = 0.6;
  const found = scatterStrokes(floor, { focus: new THREE.Vector3(40, 3, -7), tools });
  // The strokes nearest the red corner and nearest the corner opposite.
  let near = 0,
    far = 0;
  const reach = (i, cx, cz) => Math.hypot(found.places[i * 3] - cx, found.places[i * 3 + 2] - cz);
  for (let i = 0; i < found.count; i++) {
    const x = found.places[i * 3],
      z = found.places[i * 3 + 2];
    assert.ok(Math.abs(x) <= 1 + 1e-6 && Math.abs(z) <= 1 + 1e-6, "places are the mesh's own, so strokes follow it when it moves");
    if (reach(i, -1, -1) < reach(near, -1, -1)) near = i;
    if (reach(i, 1, 1) < reach(far, 1, 1)) far = i;
  }
  assert.ok(reach(near, -1, -1) < 0.3 && reach(far, 1, 1) < 0.3);
  assert.ok(found.owns[near * 4 + 1] < 150, `little green near the red corner: ${found.owns[near * 4 + 1]}`);
  assert.equal(found.owns[near * 4], 255, "all of its red");
  assert.ok(found.owns[far * 4 + 1] > 240, "white far from it");
});

test("what cannot be painted is left to the coat", () => {
  const paintable = (mesh) => scatterStrokes(mesh, { focus, tools }) !== null;
  assert.ok(paintable(square(1)));
  assert.equal(paintable(square(1, { material: { transparent: true, opacity: 0.4 } })), false, "glass");
  assert.equal(paintable(square(1, { material: { map: new THREE.Texture() } })), false, "a picture keeps its own picture");
  assert.equal(paintable(square(1, { material: { emissive: new THREE.Color(1, 0.8, 0.5), emissiveIntensity: 2 } })), false, "a lamp");
  const fern = square(1);
  fern.userData.flora = true;
  assert.equal(paintable(fern), false);
  const steam = square(1);
  steam.userData.noOcclusion = true;
  assert.equal(paintable(steam), false);
  const figure = new THREE.SkinnedMesh(square(1).geometry, new THREE.MeshStandardMaterial());
  assert.equal(paintable(figure), false, "a figure stays a cel");
  // A mesh of two materials is painted where it can be.
  const both = square(1);
  both.material = [new THREE.MeshStandardMaterial({ color: 0x336699 }), new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.2 })];
  both.geometry.addGroup(0, 3, 0);
  both.geometry.addGroup(3, 3, 1);
  const half = scatterStrokes(both, { focus, tools });
  assert.ok(half.count > 0);
  assert.ok(half.ids.every((id) => id === structureId(both.id, 0)));
});

test("the strokes are drawn over the coat, follow their things, and share the look's colour", () => {
  const look = createPrintLook({ look: "paint" });
  assert.equal(look.dials.paint, 1);
  assert.equal(LOOKS.paint.dials.lineStrength, 0, "no outline under the paint");
  assert.ok(LOOKS.paint.dials.lineOver > 0, "edges are drawn back in over it");
  assert.equal(LOOKS.toon.dials.paint, undefined);
  const paint = createPaint({ glsl: COLOUR_GLSL, uniforms: look.material.uniforms, tools });
  // The hour and the dials reach the strokes with no copying.
  for (const name of ["printKey", "printDay", "printLightMix", "printShadeMix", "printDeep", "printSea", "tStructure", "tAlbedo", "tDiffuse"])
    assert.equal(paint.material.uniforms[name], look.material.uniforms[name], name);
  assert.match(paint.material.fragmentShader, /spotFill\(vOwn, seen,/);
  // What lies under the sea is the sea's to paint.
  assert.match(paint.material.vertexShader, /\(modelMatrix \* vec4\(dabPlace, 1\.0\)\)\.y < printSea\.x - 0\.03/);
  assert.equal(paint.material.depthTest, false);

  const root = new THREE.Scene(),
    floor = square(2),
    chair = square(0.5, { colour: 0xaa5533 });
  chair.position.set(0.5, 0.4, 0);
  root.add(floor, chair);
  const calls = [];
  const renderer = {
    autoClear: true,
    info: { render: { calls: 0 } },
    render(scene, camera) {
      calls.push({ scene, camera, autoClear: this.autoClear });
      this.info.render.calls += scene.children.filter((child) => child.visible).length;
    },
  };
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 300);
  const frame = { width: 1600, height: 900, extent: 2 * Math.tan((40 * Math.PI) / 360), centre: focus, dials: look.dials, still: true };
  paint.render(renderer, root, camera, frame);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].scene, paint.scene);
  assert.equal(calls[0].autoClear, false, "the coat under the strokes is kept");
  assert.equal(renderer.autoClear, true);
  const evidence = paint.evidence();
  assert.equal(evidence.meshes, 2);
  assert.equal(evidence.waiting, 0, "a still view is painted in one go");
  assert.equal(evidence.draws, 2);
  assert.ok(evidence.strokes > 1000 && evidence.strokes <= STROKE_LIMITS.scene);
  assert.equal(paint.material.uniforms.paintScale.value.x, 900 / frame.extent);
  // A stroke goes where its thing goes, and is put away with it.
  chair.position.x = 3;
  chair.updateMatrixWorld();
  chair.visible = false;
  paint.render(renderer, root, camera, frame);
  const [floorStrokes, chairStrokes] = paint.scene.children;
  assert.equal(floorStrokes.visible, true);
  assert.equal(chairStrokes.visible, false);
  chair.visible = true;
  paint.render(renderer, root, camera, frame);
  assert.equal(chairStrokes.visible, true);
  assert.deepEqual(chairStrokes.matrixWorld.elements, chair.matrixWorld.elements);
  assert.equal(paint.evidence().strokes, evidence.strokes, "and is scattered once");
  paint.dispose();
  look.dispose();
});
