import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "../assets/js/three.module.min.js";
import {
  COLOURWAYS,
  DEFAULT_DRAWN_LOOK,
  DRAWN_LOOKS,
  LOOKS,
  OKLAB,
  PRINT_DEFAULTS,
  PRINT_KEY,
  STRUCTURE_IDS,
  colourwayAt,
  createPrintLook,
  linearToOklab,
  oklabToLinear,
  readDrawnLook,
  structureId,
  structureSkips,
  writeDrawnLook,
} from "../assets/js/home-scene/print-look.mjs";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test("the render is realistic unless the URL or this session asked for a drawn look", () => {
  const storage = memoryStorage();
  assert.equal(readDrawnLook("", storage), "realistic");
  // The older switch asks for the default drawn look, which is the cartoon.
  assert.equal(DEFAULT_DRAWN_LOOK, "toon");
  assert.equal(readDrawnLook("?print=1", storage), "toon");
  assert.equal(storage.getItem(PRINT_KEY), "toon");
  assert.equal(readDrawnLook("", storage), "toon", "the choice survives moving around the site");
  assert.equal(readDrawnLook("?look=print", storage), "print");
  assert.equal(readDrawnLook("?print=1", storage), "print", "the older switch returns to the drawn look last used");
  assert.equal(readDrawnLook("?print=0", storage), "realistic");
  assert.equal(storage.getItem(PRINT_KEY), null);
  assert.equal(readDrawnLook("?look=toon&print=0", storage), "toon", "a named look wins over the older switch");
  assert.equal(readDrawnLook("?look=realistic", storage), "realistic");
  assert.equal(readDrawnLook("?look=oil-painting", storage), "realistic", "an unknown name changes nothing");
  writeDrawnLook("print", storage);
  assert.equal(readDrawnLook("?scene-lab=1", storage), "print");
  // A session that switched the print on before the looks had names.
  assert.equal(readDrawnLook("", memoryStorage({ [PRINT_KEY]: "1" })), "toon");
  assert.deepEqual([...DRAWN_LOOKS].sort(), Object.keys(LOOKS).sort());
  const refusing = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(readDrawnLook("?print=1", refusing), "toon", "the URL still applies without storage");
  assert.equal(readDrawnLook("?look=print", refusing), "print");
  assert.equal(readDrawnLook("", refusing), "realistic");
});

test("the cartoon is the same pass with brighter, flatter, fuller settings, and switching compiles nothing", () => {
  const drawn = createPrintLook({ look: "toon" });
  assert.equal(drawn.look, "toon");
  assert.equal(drawn.enabled, true);
  const uniforms = drawn.material.uniforms,
    version = drawn.material.version;
  const toon = {
    bands: uniforms.printTone.value.x,
    lift: uniforms.printLift.value.x,
    ceiling: uniforms.printLift.value.y,
    open: uniforms.printLift.value.z,
    crossHue: uniforms.printWeight.value.w,
    grain: uniforms.printGrain.value.x,
  };
  assert.ok(toon.lift < 1, "the darks are opened");
  assert.ok(toon.ceiling < 1, "the top step is kept for lamps and sky, so a sunlit surface stays one tone");
  assert.ok(toon.open < 1, "the lit and shadow steps print light");
  assert.equal(toon.crossHue, 1, "greens stay green");
  assert.equal(toon.grain, 0, "no paper tooth");
  assert.ok(uniforms.printGrain.value.z > PRINT_DEFAULTS.inkFloor, "the darkest step is held further off black");
  assert.ok(
    uniforms.printLine.value.x > PRINT_DEFAULTS.lineRadius && uniforms.printWeight.value.x > PRINT_DEFAULTS.foldStrength,
    "one even, heavier outline"
  );
  // At every hour: lighter paper, fuller colour, a weaker blue lean in the shadows, ink still dark.
  for (let minute = 0; minute < 1440; minute += 45) {
    const hour = colourwayAt(minute),
      way = LOOKS.toon.way(hour);
    assert.equal(way.name, hour.name, "a dusk is still a dusk");
    way.paper.forEach((value, i) => assert.ok(value >= hour.paper[i] && value <= 1));
    assert.ok(way.chroma > hour.chroma * 1.2);
    assert.ok(way.shadow[2] < hour.shadow[2] * 0.5);
    assert.ok(Math.min(...way.paper) > Math.max(...way.ink) + 0.6);
    assert.ok(way.sky.every((value) => value >= 0 && value <= 1));
  }
  assert.equal(LOOKS.print.way(colourwayAt(780)).chroma, colourwayAt(780).chroma, "the woodblock keeps the hour's colourway as it is");

  // Woodblock: the shipped defaults again. Realistic: the pass is off and remembers the last look.
  assert.equal(drawn.setLook("print"), "print");
  assert.equal(uniforms.printTone.value.x, PRINT_DEFAULTS.bands);
  assert.deepEqual(uniforms.printLift.value.toArray(), [1, 1, 1], "the woodblock steps lightness as it comes");
  assert.equal(uniforms.printWeight.value.w, PRINT_DEFAULTS.crossHue);
  assert.equal(drawn.setLook("realistic"), "realistic");
  assert.equal(drawn.enabled, false);
  drawn.enabled = true;
  assert.equal(drawn.look, "print", "the older switch returns to the look last drawn");
  assert.equal(drawn.setLook("toon"), "toon");
  assert.equal(uniforms.printTone.value.x, toon.bands);
  assert.equal(drawn.setLook("watercolour"), "realistic", "an unknown look is the render itself");
  assert.equal(drawn.material.version, version, "a look is uniforms only: no program is rebuilt");
  assert.equal(drawn.evidence().look, "realistic");
  // The older option still works for callers that only know on and off.
  assert.equal(createPrintLook({ enabled: true }).look, "toon");
  assert.equal(createPrintLook().look, "realistic");
});

test("OKLab is one set of matrices: white is L 1, and a colour survives the round trip", () => {
  const white = linearToOklab([1, 1, 1]);
  assert.ok(Math.abs(white[0] - 1) < 1e-6 && Math.abs(white[1]) < 1e-6 && Math.abs(white[2]) < 1e-6);
  for (const rgb of [
    [0.2, 0.5, 0.8],
    [0.94, 0.48, 0.22],
    [0.02, 0.02, 0.03],
    [0, 0, 0],
  ]) {
    const back = oklabToLinear(linearToOklab(rgb));
    rgb.forEach((value, i) => assert.ok(Math.abs(back[i] - value) < 1e-6, `${rgb} returned ${back}`));
  }
  // The shader is generated from these same rows.
  for (const matrix of Object.values(OKLAB)) assert.deepEqual([matrix.length, ...matrix.map((row) => row.length)], [3, 3, 3, 3]);
});

test("the hour picks the colourway continuously, midnight included", () => {
  assert.equal(colourwayAt(780).name, "noon");
  assert.equal(colourwayAt(420).name, "dawn");
  assert.equal(colourwayAt(0).name, "night");
  assert.deepEqual(colourwayAt(1440 + 780), colourwayAt(780));
  assert.deepEqual(colourwayAt(-660), colourwayAt(780));
  let previous = colourwayAt(0);
  for (let minute = 1; minute <= 1440; minute++) {
    const way = colourwayAt(minute);
    for (const key of ["paper", "ink", "shadow", "sky"])
      way[key].forEach((value, i) => {
        assert.ok(Number.isFinite(value));
        assert.ok(Math.abs(value - previous[key][i]) < 0.012, `${key}[${i}] jumps at minute ${minute}`);
      });
    assert.ok(Math.abs(way.chroma - previous.chroma) < 0.012);
    // Paper stays lighter than the ink printed on it at every hour.
    assert.ok(Math.min(...way.paper) > Math.max(...way.ink) + 0.5);
    previous = way;
  }
  assert.ok(COLOURWAYS.every((way, i) => i === 0 || way.at > COLOURWAYS[i - 1].at));
});

test("the pass keeps the output pass's place and reports what it draws", () => {
  const print = createPrintLook();
  assert.equal(print.enabled, false);
  assert.equal(print.pass.needsSwap, false);
  assert.equal(print.tap.needsSwap, false);
  assert.equal(print.material.toneMapped, false);
  print.enabled = true;
  assert.equal(print.pass.enabled, true);
  const camera = { isPerspectiveCamera: true, near: 0.05, far: 300, fov: 40, zoom: 1 };
  print.prepare(camera, { minute: 1035, seconds: 2.4, still: false });
  assert.equal(print.evidence().colourway, "dusk");
  assert.notEqual(print.material.uniforms.printGrain.value.w, 0, "moving, the lines resettle on a slow step");
  print.prepare(camera, { minute: 1035, seconds: 2.4, still: true });
  assert.equal(print.material.uniforms.printGrain.value.w, 0, "paused or reduced, they hold still");
  print.prepare(camera, { minute: undefined });
  assert.equal(print.evidence().minute, 1035, "a missing routine keeps the last hour");
  print.set({ bands: 4 });
  assert.equal(print.material.uniforms.printTone.value.x, 4);
  assert.equal(PRINT_DEFAULTS.bands, 5, "a dial change never edits the shipped defaults");
  // The scene's depth comes from the beauty target the tap saw, never from the frame being read.
  const depth = { isDepthTexture: true };
  print.tap.render(null, null, { depthTexture: depth });
  let target = "unset";
  const renderer = {
    toneMapping: 4,
    toneMappingExposure: 1.05,
    setRenderTarget: (value) => (target = value),
    render() {},
  };
  print.pass.renderToScreen = true;
  print.pass.render(renderer, null, { texture: { isTexture: true }, depthTexture: null, width: 1600, height: 900 });
  assert.equal(target, null);
  assert.equal(print.material.uniforms.tDepth.value, depth);
  assert.deepEqual(print.material.defines, { ACES_FILMIC_TONE_MAPPING: "" });
  assert.equal(print.material.uniforms.toneMappingExposure.value, 1.05);
  assert.ok(Math.abs(print.material.uniforms.printCamera.value.w - (2 * Math.tan((40 * Math.PI) / 360)) / 900) < 1e-9);
  assert.equal(print.evidence().draws, 1);
  print.dispose();
});

test("objects are told apart by a number a half-float holds exactly", () => {
  const seen = new Set();
  for (let id = 1; id <= 4000; id++) {
    const number = structureId(id);
    assert.ok(Number.isInteger(number) && number >= 1 && number <= STRUCTURE_IDS, `id ${id} gives ${number}`);
    assert.notEqual(number, structureId(id + 1), "neighbouring objects never share a number");
    seen.add(number);
  }
  assert.ok(seen.size > 1500, "the numbers are spread over the range");
  // A part with its own material is its own object.
  assert.notEqual(structureId(7, 0), structureId(7, 1));
  assert.equal(structureId(7), structureId(7, 0));
});

test("the structure pass leaves out what a line could not follow", () => {
  const solid = { visible: true, opacity: 1 };
  assert.equal(structureSkips(solid), false);
  assert.equal(structureSkips(null), true);
  for (const change of [
    { transparent: true },
    { opacity: 0.4 },
    { alphaTest: 0.5 },
    { transmission: 0.9 },
    { alphaMap: {} },
    { colorWrite: false },
    { visible: false },
  ])
    assert.equal(structureSkips({ ...solid, ...change }), true, JSON.stringify(change));
});

test("the cartoon draws the scene's structure; the woodblock and the render do not", () => {
  // three's normal shader is patched in two places; a new three must still have them.
  const vertex = THREE.ShaderLib.normal.vertexShader;
  assert.equal(vertex.split("void main() {").length, 2);
  assert.equal(vertex.split("#include <project_vertex>").length, 2);

  const calls = [];
  let target = null,
    clear = [0, 0];
  const renderer = {
    toneMapping: 4,
    toneMappingExposure: 1,
    shadowMap: { autoUpdate: true },
    info: { render: { calls: 0 } },
    getRenderTarget: () => target,
    setRenderTarget: (value) => (target = value),
    getClearAlpha: () => clear[1],
    getClearColor: (colour) => colour.setHex(clear[0]),
    setClearColor: (colour, alpha) => (clear = [colour.isColor ? colour.getHex() : colour, alpha]),
    clear: () => calls.push("clear"),
    render(scene, camera) {
      calls.push({
        override: scene.overrideMaterial,
        background: scene.background,
        target,
        shadows: this.shadowMap.autoUpdate,
        clear: [...clear],
        camera,
      });
      this.info.render.calls += 3;
    },
  };
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x123456);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ side: THREE.FrontSide })),
    steam = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()),
    stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial()),
    fern = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  steam.userData.noOcclusion = true;
  fern.userData.flora = true;
  scene.add(wall, steam, stars, fern);
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 300);
  const frame = { depthTexture: { isDepthTexture: true }, width: 1600, height: 900, texture: { isTexture: true } };

  const drawn = createPrintLook({ look: "toon" });
  assert.equal(drawn.dials.structure, 1);
  // Without a scene there is nothing to draw from, and the lines fall back to the frame's depth.
  drawn.tap.render(renderer, null, frame);
  assert.equal(calls.length, 0);
  assert.equal(drawn.material.uniforms.printStructure.value.x, 0);
  assert.equal(drawn.evidence().structure, null);

  drawn.prepare(camera, { scene, minute: 780 });
  drawn.tap.render(renderer, null, frame);
  const pass = calls.find((call) => call.override);
  assert.ok(pass, "the scene is drawn once more");
  assert.equal(pass.override.name, "Scene structure");
  assert.equal(pass.camera, camera, "with the frame's own camera");
  assert.equal(pass.background, null);
  assert.equal(pass.shadows, false, "shadow maps are not drawn again");
  assert.deepEqual(pass.clear, [0, 60000], "nothing: no object, farther than anything drawn");
  assert.equal(pass.target.width, 1600);
  assert.equal(pass.target.height, 900);
  assert.equal(pass.target.texture.type, THREE.HalfFloatType);
  assert.equal(pass.target.texture.magFilter, THREE.NearestFilter, "ids are never blended between neighbours");
  // Everything is handed back as it was found.
  assert.equal(scene.overrideMaterial, null);
  assert.equal(scene.background.getHex(), 0x123456);
  assert.equal(renderer.shadowMap.autoUpdate, true);
  assert.equal(target, null);
  assert.deepEqual(clear, [0, 0]);
  assert.ok(wall.visible && steam.visible && stars.visible && fern.visible, "what was hidden for the pass is shown again");
  assert.equal(drawn.material.uniforms.printStructure.value.x, 1);
  assert.equal(drawn.material.uniforms.tStructure.value, pass.target.texture);
  assert.deepEqual(drawn.evidence().structure, { draws: 1, calls: 3, width: 1600, height: 900 });
  assert.equal(drawn.evidence().renderTargets, 1);

  // Each object brings its number and is culled as its own material is.
  const structure = pass.override,
    object = structure.uniforms.structureObject.value;
  structure.onBeforeRender(null, null, null, null, wall, null);
  assert.equal(object.x, structureId(wall.id, 0));
  assert.equal(object.y, 0);
  assert.equal(structure.side, THREE.FrontSide);
  assert.equal(structure.uniformsNeedUpdate, true);
  const pane = new THREE.Mesh(new THREE.BoxGeometry(), [
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.3 }),
  ]);
  structure.onBeforeRender(null, null, null, null, pane, { materialIndex: 1 });
  assert.equal(object.x, structureId(pane.id, 1));
  assert.equal(object.y, 1, "glass is left out, so what is behind it keeps its lines");
  structure.onBeforeRender(null, null, null, null, pane, { materialIndex: 0 });
  assert.equal(object.y, 0);
  assert.equal(structure.side, THREE.DoubleSide);

  // The woodblock cuts its keyblock from depth: no extra pass. The render has none either.
  const before = calls.length;
  drawn.setLook("print");
  drawn.tap.render(renderer, null, frame);
  assert.equal(calls.length, before);
  assert.equal(drawn.material.uniforms.printStructure.value.x, 0);
  assert.equal(drawn.evidence().structure, null);
  assert.equal(drawn.evidence().renderTargets, 0);
  drawn.setLook("realistic");
  drawn.tap.render(renderer, null, frame);
  assert.equal(calls.length, before);
  drawn.setLook("toon");
  drawn.tap.render(renderer, null, frame);
  assert.equal(drawn.evidence().structure.draws, 2);
  drawn.dispose();
});

test("the cartoon's lines come in three weights from one ring", () => {
  const source = createPrintLook({ look: "toon" }).material.fragmentShader;
  // A break in depth is measured off each surface's own plane, so a sloping floor draws no line.
  assert.match(source, /float gap = max\(abs\(dot\(p - p0, n0\)\), abs\(dot\(p - p0, n\)\)\);/);
  // Outline, contact, fold: each needs more of the ring than the one before.
  assert.match(source, /smoothstep\(0\.05, 0\.19, broken \/ ALL\)/);
  assert.match(source, /smoothstep\(0\.13, 0\.3, \(meets \+ broken\) \/ ALL\)/);
  assert.match(source, /smoothstep\(0\.25, 0\.42, \(folds \+ meets \+ broken\) \/ ALL\)/);
  // A fill is averaged inside one object only.
  assert.match(source, /if \(structured\) w \*= step\(abs\(texture2D\(tStructure, tap\)\.z - who\), 0\.5\);/);
  // Three hard steps, not a gradient.
  assert.equal(LOOKS.toon.dials.bands, 3);
  assert.equal(LOOKS.toon.dials.bandMix, 1);
});
