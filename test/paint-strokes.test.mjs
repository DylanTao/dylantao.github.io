import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "../assets/js/three.module.min.js";
import {
  BRUSH_MARKS,
  BRUSH_SHEET,
  LAND_GLSL,
  SEA_BANDS,
  SEA_NEAR,
  SEA_SIZES,
  SKY_SIZES,
  STROKE_ASPECT,
  STROKE_COVER,
  STROKE_DENSITY,
  STROKE_FINE,
  STROKE_LAYERS,
  STROKE_LIMITS,
  STROKE_CURVE,
  STROKE_SIZES,
  brushSheetPixels,
  createPaint,
  finestStroke,
  landAlong,
  landClass,
  paintManner,
  paintThin,
  scatterSea,
  scatterSky,
  scatterStrokes,
  strokeAlong,
  strokeRandom,
  strokeWrap,
} from "../assets/js/home-scene/paint-strokes.mjs";
import { COLOUR_GLSL, FIELD_GLSL, LOOKS, createPrintLook, structureId, structureKind, structureSkips } from "../assets/js/home-scene/print-look.mjs";

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
  // At that density a size covers a surface once.
  STROKE_SIZES.forEach((size, i) => assert.ok(Math.abs(STROKE_DENSITY[i] * size * size * STROKE_ASPECT - 1) < 1e-9));
  // Three sizes are laid, and the broad ones under the others cover more than the fine ones over
  // them, so the blocking-in shows between the detail.
  assert.equal(STROKE_COVER.length, STROKE_LAYERS);
  assert.ok(STROKE_COVER[0] < STROKE_COVER[1] && STROKE_COVER[1] < STROKE_COVER[2]);
  assert.ok(STROKE_COVER[0] > 0.5 && STROKE_COVER[2] <= 2);
});

test("a stroke suits the thing it paints", () => {
  assert.equal(finestStroke("cushion linen", 4, 0.6), 0, "a cushion gets the smallest");
  assert.equal(finestStroke("wall plaster", 4, 5), 1, "a wall the next");
  assert.equal(finestStroke("floor oak", 4, 6), 1);
  assert.equal(finestStroke("terrace stone", 4, 30), 2, "nothing in the house is painted more broadly than that");
  // Far from where the view is centred, finer strokes would never be seen.
  assert.equal(finestStroke("cushion linen", 50, 0.6), 1);
  assert.equal(finestStroke("cushion linen", 200, 0.6), 2);
  // Ground and rock are painted more broadly than the house whatever their size: near the house
  // finely enough to say a bed of sandstone, then more broadly with distance.
  assert.equal(finestStroke("core_carved_mainland golden coastal sandstone", 10, 300), 1);
  assert.equal(finestStroke("core_carved_mainland golden coastal sandstone", 100, 300), 2);
  assert.equal(finestStroke("hinterland_ground_00 hinterland sandy loam", 200, 900), 3);
  assert.equal(STROKE_LAYERS, 3);
});

test("land is told from the house, and one kind of land from another, by name", () => {
  assert.equal(landClass("coast_continuous_cliff_foundation", "golden coastal sandstone"), 1, "the cliff");
  assert.equal(landClass("hinterland_cliff_south_4", "distant bluff stone"), 1);
  assert.equal(landClass("core_retreat_liftaway_roof_1", "golden coastal sandstone"), 1, "the rock over a room is still the cliff's top");
  assert.equal(landClass("coast_long_sloping_beach", "dry beach sand"), 2);
  assert.equal(landClass("coast_long_sloping_beach_1", "wet tideline sand"), 2);
  assert.equal(landClass("hinterland_ground_24", "hinterland sandy loam"), 3, "sandy loam is ground, not sand");
  assert.equal(landClass("hinterland_ground_14_3", "hinterland trail dust"), 3);
  assert.equal(landClass("hinterland_flora_09_09_1", "hinterland scrub canopy"), 4);
  assert.equal(
    landClass("core_arrival_wall__golden_coastal_sandstone", "golden coastal sandstone"),
    5,
    "a wall cut from the rock has beds and no tide line"
  );
  assert.equal(landClass("core_retreat_clifftop__pale_oak", "pale oak"), 0);
  assert.equal(landClass("hinterland_lookout_and_gliderport", "bench slat wood"), 0, "a bench on the land is not land");
  assert.equal(landClass(), 0);
  // The shader that paints each kind is the stroke painter's own.
  for (const name of ["rockPaint", "sandPaint", "groundPaint", "scrubPaint", "landPaint"]) assert.ok(LAND_GLSL.includes(`vec3 ${name}(`), name);
  assert.doesNotMatch(LAND_GLSL, /\bpatch\b/, "a word GLSL keeps for itself");
});

test("on land the brush follows the contour, with a slow sway that neighbours share", () => {
  const out = new THREE.Vector3(),
    shore = new THREE.Vector3(1, 0, 0),
    at = new THREE.Vector3(12, 3, -8),
    face = new THREE.Vector3(0.2, 0.1, -0.97).normalize(),
    slope = new THREE.Vector3(0.3, 0.9, 0.2).normalize(),
    level = new THREE.Vector3(0, 1, 0);
  // A cliff's face: level, lying in the face, the way its beds run.
  let sway = landAlong(1, face, at, shore, 0.5, out);
  assert.ok(Math.abs(out.y) < 1e-9 && Math.abs(out.length() - 1) < 1e-9 && Math.abs(out.dot(face)) < 1e-9);
  assert.ok(Math.abs(sway) <= 0.35 / 2 + 1e-9, "a face sways little, so its beds stay beds");
  // One stroke in twelve runs down the face instead.
  landAlong(1, face, at, shore, 0.01, out);
  assert.ok(Math.abs(out.y) > 0.9 && Math.abs(out.dot(face)) < 1e-9, "down the fall line, still in the face");
  // Sand is laid along its shore; level ground follows a drift that is a direction in the ground.
  landAlong(2, level, at, shore, 0.5, out);
  assert.deepEqual(out.toArray(), [1, 0, 0]);
  for (const [land, normal] of [
    [3, level],
    [4, slope],
    [1, level],
    [5, face],
  ]) {
    sway = landAlong(land, normal, at, shore, 0.5, out);
    assert.ok(Math.abs(out.length() - 1) < 1e-9 && Math.abs(out.dot(normal)) < 1e-9, `land ${land}`);
    assert.ok(Math.abs(sway) <= 0.55);
  }
  // Neighbours sway together; far apart they do not.
  const here = landAlong(3, level, at, shore, 0.5, out),
    beside = landAlong(3, level, at.clone().add(new THREE.Vector3(0.3, 0, 0.2)), shore, 0.5, out);
  assert.ok(Math.abs(here - beside) < 0.05);
  const sways = new Set();
  for (let i = 0; i < 40; i++) sways.add(Math.round(landAlong(3, level, new THREE.Vector3(i * 37, 0, i * 53), shore, 0.5, out) * 20));
  assert.ok(sways.size > 5, "the grain wanders from place to place");
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
  const expected = side * side * (STROKE_DENSITY[0] * STROKE_COVER[0] + STROKE_DENSITY[1] * STROKE_COVER[1] + STROKE_DENSITY[2] * STROKE_COVER[2]);
  assert.equal(found.finest, 0);
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
  assert.ok(reach(near, -1, -1) < 0.45 && reach(far, 1, 1) < 0.45);
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
  const paint = createPaint({ glsl: COLOUR_GLSL + FIELD_GLSL, uniforms: look.material.uniforms, tools });
  // The hour and the dials reach the strokes with no copying.
  for (const name of [
    "printKey",
    "printDay",
    "printLightMix",
    "printShadeMix",
    "printDeep",
    "printSun",
    "printGlow",
    "printBounce",
    "printAir",
    "printSkyLow",
    "printSkyTop",
    "printSunDir",
    "printKeyDir",
    "printWeather",
    "printSea",
    "printSeaShallow",
    "printSeaDeep",
    "tStructure",
    "tAlbedo",
    "tDiffuse",
  ])
    assert.equal(paint.material.uniforms[name], look.material.uniforms[name], name);
  // A stroke decides its colour once, where the key light reaches it and where it does not, from
  // the look's own fill and from how its surface lies; only the key light's reach is read a pixel.
  const vertex = paint.material.vertexShader,
    fragment = paint.material.fragmentShader;
  assert.ok(
    vertex.includes("vec3 lit = spotFill(own, own3, light / mix(skyOnly, 1.0, keyHere), spot.x, 1.0, spot.y, vec2(0.0), wander, geo, read);")
  );
  assert.ok(
    vertex.includes("vec3 dark = spotFill(own, own3, light * mix(1.0, skyOnly, keyHere), spot.x, 0.0, spot.y, vec2(0.0), wander, geo, read);")
  );
  assert.ok(vertex.includes("own3 = landPaint(own3, land, world.xyz, up, printSea.x, paintBroken.w, hand.y);"));
  assert.ok(fragment.includes("vec3 colour = mix(vShade, vLit, key);"));
  assert.ok(!fragment.includes("spotFill(own"), "the fill is not asked again at every pixel");
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
  // The full share of strokes whatever machine runs this (paintThin reads its cores and memory).
  look.set({ strokeThin: 1 });
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 300);
  const frame = { width: 1600, height: 900, extent: 2 * Math.tan((40 * Math.PI) / 360), centre: focus, dials: look.dials, still: true };
  paint.render(renderer, root, camera, frame);
  // The sky and the sea first, then the things.
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0].scene, paint.scene);
  assert.deepEqual(
    calls[0].scene.children.map((child) => child.material.name),
    ["Sky strokes", "Sea strokes"]
  );
  assert.equal(calls[1].scene, paint.scene);
  assert.ok(
    calls.every((call) => call.autoClear === false),
    "the coat under the strokes is kept"
  );
  assert.equal(renderer.autoClear, true);
  const evidence = paint.evidence();
  assert.equal(evidence.meshes, 2);
  assert.equal(evidence.waiting, 0, "a still view is painted in one go");
  assert.equal(evidence.draws, 4);
  assert.ok(evidence.strokes > 1000 && evidence.strokes <= STROKE_LIMITS.scene);
  assert.ok(evidence.sky > 10000 && evidence.sea > 30000);
  assert.equal(evidence.fine, 0);
  assert.equal(paint.material.uniforms.paintScale.value.x, 900 / frame.extent);
  // The manner follows the sun unless the dials hold it: gouache lies flat, oil stands up.
  assert.equal(evidence.manner, 0, "a high sun by default");
  const flat = paint.material.uniforms.paintStroke.value.w;
  paint.render(renderer, root, camera, { ...frame, sunHeight: 0.02 });
  assert.equal(paint.evidence().manner, 1);
  assert.ok(paint.material.uniforms.paintStroke.value.w > flat * 1.8);
  paint.render(renderer, root, camera, { ...frame, sunHeight: 0.02, dials: { ...look.dials, manner: 0 } });
  assert.equal(paint.evidence().manner, 0);
  // The floor and the chair were painted with the smallest size already, so they have nothing
  // finer to take when the eye is close.
  assert.equal(paint.evidence().fine, 0);
  calls.length = 0;
  // A terrace is painted broadly. Once it is covered, the part of it the eye stands close to
  // takes finer paint.
  const terrace = square(40, { colour: 0x998877 });
  terrace.name = "terrace";
  const wide = new THREE.Scene();
  wide.add(terrace);
  const second = createPaint({ glsl: COLOUR_GLSL + FIELD_GLSL, uniforms: look.material.uniforms, tools });
  second.render(renderer, wide, camera, frame);
  assert.equal(second.evidence().fine, 0, "the first drawing lays the broad paint");
  second.render(renderer, wide, camera, frame);
  const fine = second.evidence().fine;
  // Within reach of the eye, at the fine cover: about a disc of the smallest size, and a larger
  // one of the next.
  const disc = Math.PI * STROKE_FINE.reach ** 2 * STROKE_FINE.cover * (STROKE_DENSITY[0] + 9 * STROKE_DENSITY[1]);
  assert.ok(fine > disc * 0.6 && fine < disc * 1.2, `${fine} fine strokes for about ${Math.round(disc)}`);
  assert.equal(second.scene.children.length, 2, "its own mesh, laid over the broad one");
  assert.equal(second.scene.children[1].renderOrder, 1);
  // Left behind, it gives the fine paint up.
  camera.position.set(0, 0, STROKE_FINE.far + 60);
  camera.updateMatrixWorld();
  second.render(renderer, wide, camera, frame);
  assert.equal(second.evidence().fine, 0);
  assert.equal(second.scene.children.length, 1);
  camera.position.set(0, 0, 0);
  camera.updateMatrixWorld();
  second.dispose();
  calls.length = 0;
  paint.render(renderer, root, camera, frame);
  // A stroke goes where its thing goes, and is put away with it.
  chair.position.x = 3;
  chair.updateMatrixWorld();
  chair.visible = false;
  paint.render(renderer, root, camera, frame);
  const [floorStrokes, chairStrokes] = paint.scene.children;
  assert.equal(floorStrokes.visible, true);
  assert.equal(chairStrokes.visible, false);
  assert.equal(calls.at(-1).scene, paint.scene);
  chair.visible = true;
  paint.render(renderer, root, camera, frame);
  assert.equal(chairStrokes.visible, true);
  assert.deepEqual(chairStrokes.matrixWorld.elements, chair.matrixWorld.elements);
  assert.equal(paint.evidence().strokes, evidence.strokes, "and is scattered once");
  paint.dispose();
  look.dispose();
});

test("fine paint is laid only as far from the eye as its size can be seen", () => {
  const terrace = square(40, { colour: 0x998877 });
  terrace.name = "terrace";
  const broad = scatterStrokes(terrace, { focus, tools });
  assert.equal(broad.finest, 2, "forty metres of terrace is painted broadly");
  const eye = new THREE.Vector3(5, 1, -3),
    fine = scatterStrokes(terrace, { focus, tools, fine: broad.finest, eye });
  const sizes = new Set();
  for (let i = 0; i < fine.count; i++) {
    const size = fine.normals[i * 4 + 3];
    sizes.add(size);
    const away = Math.hypot(fine.places[i * 3] - eye.x, fine.places[i * 3 + 1] - eye.y, fine.places[i * 3 + 2] - eye.z);
    assert.ok(away <= STROKE_FINE.reach * 3 ** size + 1e-6, `a stroke of size ${size} at ${away.toFixed(1)} m`);
  }
  assert.deepEqual([...sizes].sort(), [0, 1], "every size below its own finest");
  // A thing whose finest stroke is the smallest already has nothing finer to take.
  assert.equal(scatterStrokes(square(1), { focus, tools, fine: 0, eye }), null);
  assert.ok(STROKE_FINE.near < STROKE_FINE.far && STROKE_FINE.step < STROKE_FINE.reach && STROKE_FINE.limit < STROKE_LIMITS.scene);
});

test("the sky is strokes pinned to directions, the sea strokes pinned to the water", () => {
  const sky = scatterSky();
  // Each size covers the dome by its share.
  let expected = 0;
  SKY_SIZES.forEach((size, layer) => (expected += Math.round(((2 * Math.PI * 1.03) / (STROKE_ASPECT * size * size)) * STROKE_COVER[layer])));
  assert.equal(sky.count, expected);
  assert.deepEqual(scatterSky().places, sky.places, "the same sky every time");
  let last = Infinity;
  for (let i = 0; i < sky.count; i++) {
    const place = sky.places.subarray(i * 3, i * 3 + 3),
      along = sky.alongs.subarray(i * 3, i * 3 + 3);
    assert.ok(Math.abs(Math.hypot(...place) - 1) < 1e-5 && place[1] >= -0.031, "a direction on the dome");
    assert.ok(Math.abs(Math.hypot(...along) - 1) < 1e-4, "a direction for the stroke");
    assert.ok(Math.abs(place[0] * along[0] + place[1] * along[1] + place[2] * along[2]) < 1e-4, "that lies across the look");
    assert.ok(sky.hands[i * 3] <= last, "largest first");
    last = sky.hands[i * 3];
  }
  const centre = { x: 3, z: 5 },
    sea = scatterSea(centre);
  assert.deepEqual(scatterSea(centre).places, sea.places);
  const rings = [0, 0, 0, 0];
  last = Infinity;
  for (let i = 0; i < sea.count; i++) {
    const x = sea.places[i * 3] - centre.x,
      z = sea.places[i * 3 + 2] - centre.z,
      radius = Math.hypot(x, z),
      size = sea.hands[i * 3];
    assert.ok(z <= 1e-3, "on the sea's side of the house");
    assert.ok(radius <= SEA_BANDS.at(-1).to + 1e-3);
    assert.equal(sea.places[i * 3 + 1], 0, "the shader lifts it to the sea's level");
    assert.ok(
      Math.abs(Math.hypot(sea.alongs[i * 3], sea.alongs[i * 3 + 2]) - 1) < 1e-5 && Math.abs(sea.alongs[i * 3]) > 0.9,
      "along the shore, nearly"
    );
    assert.ok(size <= last, "largest first");
    last = size;
    // The finest strokes of the far band, by distance.
    if (Math.abs(size - SEA_SIZES[SEA_BANDS[2].finest]) < 1e-4 && radius > 420)
      rings[radius < 1115 ? 0 : radius < 1810 ? 1 : radius < 2505 ? 2 : 3]++;
  }
  // Past SEA_NEAR the strokes thin as the distance grows: equal steps of distance hold about
  // the same number of strokes, where an even scatter would hold more and more.
  assert.ok(rings[0] > 500 && rings[3] > rings[0] * 0.6 && rings[3] < rings[0] * 1.5, `the far band's rings: ${rings}`);
  assert.ok(SEA_NEAR <= SEA_BANDS[0].to);
  assert.ok(sea.count > 40000 && sea.count < 120000, `${sea.count} strokes of sea`);
});

test("the paint is gouache by day and oil as the sun goes down", () => {
  assert.equal(paintManner(1), 0);
  assert.equal(paintManner(0.5), 0);
  assert.equal(paintManner(0.05), 1);
  assert.equal(paintManner(-0.4), 1, "and through the night");
  let last = 0;
  for (let height = 0.6; height >= 0; height -= 0.02) {
    const manner = paintManner(height);
    assert.ok(manner >= last - 1e-12 && manner >= 0 && manner <= 1);
    last = manner;
  }
  // Eight marks, each its own.
  assert.equal(BRUSH_MARKS.length, BRUSH_SHEET.columns * BRUSH_SHEET.rows);
  assert.equal(new Set(BRUSH_MARKS.map((mark) => mark.name)).size, BRUSH_MARKS.length);
  for (const mark of BRUSH_MARKS) assert.ok(mark.half <= 0.34 && mark.half > 0.15 && mark.rise + mark.fall <= 1 && mark.dry <= 1, mark.name);
});

test("a rounded thing is painted around its form; boards and posts keep their grain", () => {
  const out = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0);
  const flat = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)];
  assert.equal(strokeWrap(flat, [up, up, up], up, out), 0, "a flat triangle does not bend");
  // A log lying along x, 0.2 m in radius: it bends five radians a metre around, not at all along.
  const log = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 2, 24, 1, true).rotateZ(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x8a6a4a })
  );
  log.name = "test_log";
  const found = scatterStrokes(log, { focus, tools });
  let around = 0;
  for (let i = 0; i < found.count; i++) if (Math.abs(found.alongs[i * 4]) / 127 < 0.35) around++;
  assert.ok(around > found.count * 0.8, `${around} of ${found.count} strokes go around the log`);
  assert.ok(1 / 0.2 > STROKE_CURVE);
  // A post of the same shape stood upright keeps its strokes along its length.
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a6a4a }));
  post.name = "test_post";
  const posted = scatterStrokes(post, { focus, tools });
  let lengthwise = 0;
  for (let i = 0; i < posted.count; i++) if (Math.abs(posted.alongs[i * 4 + 1]) / 127 > 0.9) lengthwise++;
  assert.ok(lengthwise > posted.count * 0.8, `${lengthwise} of ${posted.count} strokes run up the post`);
});

test("a phone or a small machine carries half the paint, and the dial can say otherwise", () => {
  const desk = { matchMedia: () => ({ matches: false }), navigator: { deviceMemory: 16, hardwareConcurrency: 16 } };
  assert.equal(paintThin(null, desk), 1);
  assert.equal(paintThin(null, { ...desk, matchMedia: () => ({ matches: true }) }), 0.5, "a touch screen");
  assert.equal(paintThin(null, { ...desk, navigator: { deviceMemory: 4, hardwareConcurrency: 16 } }), 0.5, "little memory");
  assert.equal(paintThin(null, { ...desk, navigator: { deviceMemory: 16, hardwareConcurrency: 4 } }), 0.5, "few cores");
  assert.equal(paintThin(null, {}), 1, "nothing known: a desktop");
  assert.equal(paintThin(0.3, desk), 0.3);
  assert.equal(paintThin(0, desk), 0.1);
  assert.equal(paintThin(7, desk), 1);
  // Thinning thins what is scattered.
  const floor = square(4);
  const full = scatterStrokes(floor, { focus, tools }).count,
    half = scatterStrokes(floor, { focus, tools, thin: 0.5 }).count;
  assert.ok(Math.abs(half / full - 0.5) < 0.08, `${half} of ${full}`);
});
