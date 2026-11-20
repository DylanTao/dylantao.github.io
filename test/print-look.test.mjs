import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "../assets/js/three.module.min.js";
import {
  COLOURWAYS,
  DEFAULT_DRAWN_LOOK,
  DRAWN_LOOKS,
  FIELD_GLSL,
  LOOKS,
  METER_SIZE,
  OKLAB,
  PRINT_DEFAULTS,
  PRINT_KEY,
  STRUCTURE_IDS,
  TOON_HOURS,
  afterglow,
  colourwayAt,
  createPrintLook,
  createStructure,
  displayToOklab,
  isLand,
  linearToOklab,
  oklabToLinear,
  readDrawnLook,
  readMeter,
  structureId,
  structureKind,
  structureSkips,
  toonHourAt,
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
      way = LOOKS.toon.way(hour, minute);
    assert.deepEqual(way.palette, toonHourAt(minute), "and it brings the cartoon's own hour");
    assert.equal(way.name, hour.name, "a dusk is still a dusk");
    way.paper.forEach((value, i) => assert.ok(value >= hour.paper[i] && value <= 1));
    assert.ok(way.chroma > hour.chroma * 1.2);
    assert.ok(way.shadow[2] < hour.shadow[2] * 0.5);
    assert.ok(Math.min(...way.paper) > Math.max(...way.ink) + 0.6);
    assert.ok(way.sky.every((value) => value >= 0 && value <= 1));
  }
  assert.equal(LOOKS.print.way(colourwayAt(780)).chroma, colourwayAt(780).chroma, "the woodblock keeps the hour's colourway as it is");
  assert.equal(LOOKS.print.way(colourwayAt(780), 780).palette, undefined, "and has no designed light of its own");
  assert.equal(drawn.dials.localColour, 1);
  assert.equal(PRINT_DEFAULTS.localColour, 0);

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
  assert.equal(drawn.setLook("watercolour"), "watercolour", "the public watercolour look is supported");
  assert.equal(drawn.enabled, true);
  assert.equal(drawn.setLook("unknown-look"), "realistic", "an unknown look uses the realistic renderer");
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
  assert.equal(pass.target.textures.length, 2, "structure, and the surfaces' own colour");
  assert.equal(pass.target.textures[1].type, THREE.UnsignedByteType);
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
  assert.equal(drawn.material.uniforms.tAlbedo.value, pass.target.textures[1]);
  assert.equal(drawn.material.uniforms.printKey.value.w, 1, "fills come from the surfaces' own colour");
  assert.deepEqual(drawn.evidence().structure, {
    draws: 1,
    calls: 3,
    width: 1600,
    height: 900,
    targets: 2,
    sky: { draws: 0, size: 1024, extent: 0 },
  });
  assert.equal(drawn.evidence().renderTargets, 3);
  assert.equal(drawn.evidence().textureReads, 53);
  assert.equal(drawn.evidence().hour, "noon");

  // Each object brings its number and is culled as its own material is.
  const structure = pass.override,
    object = structure.uniforms.structureObject.value;
  structure.onBeforeRender(null, null, null, null, wall, null);
  assert.equal(object.x, structureId(wall.id, 0));
  assert.equal(object.y, 0);
  assert.equal(object.z, 0, "a surface with a colour of its own");
  assert.equal(object.w, 0, "whose vertices are not painted");
  assert.equal(structure.uniforms.structureTint.value.getHex(), wall.material.color.getHex());
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
  assert.equal(drawn.evidence().textureReads, 23);
  assert.equal(drawn.material.uniforms.printKey.value.w, 0, "and its colour is the hour's colourway over the frame");
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
  assert.match(source, /float same = structured \? step\(abs\(texture2D\(tStructure, tap\)\.z - who\), 0\.5\) : 1\.0;/);
  // What has no colour of its own (a picture, the sea, a plant) still prints in three hard steps.
  assert.equal(LOOKS.toon.dials.bands, 3);
  assert.equal(LOOKS.toon.dials.bandMix, 1);
  // The world is painted softly and a figure is a cel: its edge between two tones is hard.
  assert.match(source, /float soft = kind > 1\.5 \? 0\.05 : mix\(printKey\.z, 0\.25, open\);/);
  assert.ok(PRINT_DEFAULTS.keySoftness > 0.5);
});

test("a surface says what colour it is, unless a picture or a shader holds it", () => {
  const colour = new THREE.Color(0.5, 0.4, 0.3);
  assert.equal(structureKind({ color: colour }), 0);
  assert.equal(structureKind({ color: colour, emissive: new THREE.Color(0, 0, 0), emissiveIntensity: 4 }), 0);
  assert.equal(structureKind({ color: colour, emissive: new THREE.Color(1, 0.8, 0.5), emissiveIntensity: 1.7 }), 0.25, "a lamp");
  assert.equal(
    structureKind({ color: colour, emissive: new THREE.Color(1, 0.8, 0.5), emissiveIntensity: 0.1 }),
    0,
    "a faint glow is still a surface"
  );
  assert.equal(structureKind({ color: colour, map: {} }), 1, "a picture keeps the frame's colours");
  assert.equal(structureKind({ color: colour, emissiveMap: {} }), 1, "and so does a screen");
  assert.equal(structureKind({}), 1, "a shader of its own has no colour to give");
  assert.equal(structureKind(null), 1);

  // The pass tells a figure from the world, and a painted surface from a plain one.
  const drawn = createPrintLook({ look: "toon" });
  const calls = [];
  const renderer = {
    toneMapping: 4,
    toneMappingExposure: 1,
    shadowMap: { autoUpdate: true },
    info: { render: { calls: 0 } },
    getRenderTarget: () => null,
    setRenderTarget() {},
    getClearAlpha: () => 0,
    getClearColor: (c) => c.setHex(0),
    setClearColor() {},
    clear() {},
    render: (scene) => calls.push(scene.overrideMaterial),
  };
  const scene = new THREE.Scene();
  drawn.prepare(new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 300), { scene, minute: 780 });
  drawn.tap.render(renderer, null, { depthTexture: {}, width: 800, height: 450, texture: {} });
  const structure = calls[0],
    object = structure.uniforms.structureObject.value;
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ emissive: 0xffcc88, emissiveIntensity: 2 }));
  structure.onBeforeRender(null, null, null, null, lamp, null);
  assert.equal(object.z, 1);
  const figure = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x336699, vertexColors: true }));
  structure.onBeforeRender(null, null, null, null, figure, null);
  assert.equal(object.z, 2, "a figure is a cel on the painted world");
  assert.equal(object.w, 1, "painted vertices are read");
  const poster = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: new THREE.Texture() }));
  structure.onBeforeRender(null, null, null, null, poster, null);
  assert.equal(object.z, 3);
  assert.equal(structure.vertexColors, true);
  drawn.dispose();
});

test("the cartoon's hour says what colour the light, the shade, the sky, moonlight and the sea are", () => {
  assert.equal(toonHourAt(780).name, "noon");
  assert.equal(toonHourAt(0).name, "night");
  assert.deepEqual(toonHourAt(1440 + 930), toonHourAt(930));
  assert.ok(TOON_HOURS.every((hour, i) => i === 0 || hour.at > TOON_HOURS[i - 1].at));
  const white = displayToOklab([1, 1, 1]);
  assert.ok(Math.abs(white[0] - 1) < 1e-6 && Math.abs(white[1]) < 1e-6 && Math.abs(white[2]) < 1e-6);
  let previous = toonHourAt(0);
  for (let minute = 1; minute <= 1440; minute++) {
    const hour = toonHourAt(minute);
    for (const key of ["light", "shade", "skyTop", "skyLow", "moon", "seaShallow", "seaDeep"])
      hour[key].forEach((value, i) => {
        assert.ok(value >= 0 && value <= 1, `${key}[${i}] at ${minute}`);
        assert.ok(Math.abs(value - previous[key][i]) < 0.012, `${key}[${i}] jumps at minute ${minute}`);
      });
    // Warm light against a cool shade at every hour: the light leans to yellow, the shade to blue.
    const light = displayToOklab(hour.light.slice(0, 3)),
      shade = displayToOklab(hour.shade.slice(0, 3));
    assert.ok(light[2] > 0.02, `the light is warm at ${minute}`);
    assert.ok(shade[2] < -0.05, `the shade is cool at ${minute}`);
    assert.ok(light[0] > shade[0] + 0.25, `and lighter than the shade at ${minute}`);
    // The sky is darker overhead than at the horizon, and the sea darker where it is deep.
    assert.ok(displayToOklab(hour.skyTop)[0] < displayToOklab(hour.skyLow)[0]);
    assert.ok(displayToOklab(hour.seaDeep)[0] < displayToOklab(hour.seaShallow)[0] - 0.08, `the sea deepens at ${minute}`);
    previous = hour;
  }
  // The look hands these to the pass, and the lab can try another over them.
  const drawn = createPrintLook({ look: "toon" });
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 300);
  drawn.prepare(camera, { minute: 930 });
  const uniforms = drawn.material.uniforms,
    afternoon = displayToOklab(toonHourAt(930).shade.slice(0, 3));
  assert.ok(Math.abs(uniforms.printShadeMix.value.x - afternoon[1]) < 1e-6 && Math.abs(uniforms.printShadeMix.value.y - afternoon[2]) < 1e-6);
  drawn.set({ hour: { shade: [1, 0, 0, 0.5, 0.7] } });
  assert.ok(uniforms.printShadeMix.value.x > 0.2, "a red shade, for the look of it");
  // A level camera has the horizon across the middle of the sheet; looking down lifts it off the top.
  assert.ok(Math.abs(uniforms.printHorizon.value.x - 0.5) < 1e-6);
  camera.lookAt(0, -10, -10);
  camera.updateMatrixWorld();
  drawn.prepare(camera, { minute: 930 });
  assert.ok(uniforms.printHorizon.value.x > 1);
  // By day the key light is the sun; by night it is the moon, and a room's shade leans to indigo.
  drawn.prepare(camera, { minute: 930, day: 1 });
  assert.deepEqual([uniforms.printDay.value.x, uniforms.printDay.value.y], [1, 0]);
  assert.equal(uniforms.printDay.value.w, PRINT_DEFAULTS.roomLean[0]);
  assert.ok(Math.abs(uniforms.printKey.value.y - PRINT_DEFAULTS.strongStops) < 1e-9, "only a lamp or a glare is light without the sun");
  drawn.prepare(camera, { minute: 1300, day: 0 });
  assert.deepEqual([uniforms.printDay.value.x, uniforms.printDay.value.y], [0, 1]);
  // A scene with a sea says where its level is; the look then designs the sea, from a view with
  // perspective, and knows where the camera stands.
  assert.equal(uniforms.printSea.value.w, 0, "no sea was named");
  drawn.prepare(camera, { minute: 1300, day: 0, sea: -7.35, seconds: 12, still: false });
  assert.deepEqual(uniforms.printSea.value.toArray(), [-7.35, 12, drawn.dials.brushwork, 1]);
  assert.deepEqual(uniforms.printWorld.value.elements, camera.matrixWorld.elements);
  drawn.prepare(camera, { still: true });
  assert.equal(uniforms.printSea.value.y, 0, "a still view holds its waves still");
  assert.equal(uniforms.printSea.value.x, -7.35, "and the sea stays where it was");
  drawn.prepare(new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10), {});
  assert.equal(uniforms.printSea.value.w, 0, "a view without perspective keeps the frame's sea");
  assert.ok(Math.abs(uniforms.printSeaShallow.value.w - PRINT_DEFAULTS.seaDepth) < 1e-9);
  // The cartoon lays the sea and the sky in long cells; the painting lays real strokes there
  // instead (paint-strokes.mjs), and the woodblock neither.
  assert.ok(LOOKS.toon.dials.brushwork > 0 && LOOKS.paint.dials.brushwork === 0);
  assert.ok(PRINT_DEFAULTS.skyStrokes > 0 && PRINT_DEFAULTS.seaStrokes > 0);
  assert.equal(PRINT_DEFAULTS.brushwork, 0);
  const sea = drawn.material.fragmentShader;
  assert.match(sea, /float under = bed\.w > 50000\.0 \? 60\.0 : printSea\.x - /, "the colour goes by the water over the bed");
  assert.match(sea, /\* \(1\.0 - isSea\);/, "and what lies under the sea draws no line through it");
  assert.equal(uniforms.printDay.value.w, PRINT_DEFAULTS.roomLean[1]);
  assert.ok(uniforms.printKey.value.y < PRINT_DEFAULTS.strongStops, "by night the lamps' pools are the light");
  assert.deepEqual(uniforms.printDeep.value.toArray(), PRINT_DEFAULTS.deepNight, "and the dark goes deeper");
  drawn.prepare(camera, { minute: 930, day: 1 });
  assert.deepEqual(uniforms.printDeep.value.toArray(), PRINT_DEFAULTS.deepShade);
  drawn.prepare(camera, { minute: 1300, day: 0 });
  drawn.dispose();
});

test("the meter puts a room's darkest surfaces in shade and finds the lamps' pools", () => {
  const [width, height] = METER_SIZE,
    pixels = new Uint8Array(width * height * 4);
  const fill = (stops, kind) => {
    for (let i = 0; i < width * height; i++) {
      pixels[i * 4] = Math.round(((stops(i) + 8) / 10) * 255);
      pixels[i * 4 + 1] = kind(i);
    }
  };
  // A room: light from -4 to -1 stops, evenly.
  fill(
    (i) => -4 + (3 * i) / (width * height),
    () => 255
  );
  const room = readMeter(pixels);
  assert.equal(room.samples, width * height);
  assert.ok(Math.abs(room.room - (-4 + 3 * PRINT_DEFAULTS.roomShare[0])) < 0.05, `shade begins at ${room.room}`);
  assert.ok(Math.abs(room.pool - (-4 + 3 * PRINT_DEFAULTS.roomShare[1])) < 0.05, `a pool begins at ${room.pool}`);
  // An evenly lit room has no pool: one would have to stand 0.9 stops above the room's middle.
  fill(
    () => -2,
    () => 255
  );
  assert.ok(readMeter(pixels).pool >= -2 + 0.9 - 0.05);
  // Only a room's own surfaces are read: what lies under the open sky is the sky's to light.
  fill(
    (i) => (i % 10 === 0 ? -4 + (3 * (i % 100)) / 100 : 1.5),
    (i) => (i % 10 === 0 ? 255 : 128)
  );
  const outdoors = readMeter(pixels);
  assert.equal(outdoors.samples, Math.ceil((width * height) / 10));
  assert.ok(outdoors.room < -2.5, `the bright land outdoors does not move a room's shade: ${outdoors.room}`);
  // By night a room is mostly shade, and only its brightest surfaces are a lamp's pool.
  fill(
    (i) => -4 + (3 * i) / (width * height),
    () => 255
  );
  const night = readMeter(pixels, PRINT_DEFAULTS, 0);
  assert.ok(Math.abs(night.room - (-4 + 3 * PRINT_DEFAULTS.nightShare[0])) < 0.05, `by night shade begins at ${night.room}`);
  assert.ok(night.room > room.room + 0.3, "more of a room is shade by night");
  assert.ok(Math.abs(night.pool - (-4 + 3 * PRINT_DEFAULTS.nightShare[1])) < 0.05);
  // Limits hold, and too little room is no reading.
  fill(
    () => 1.5,
    () => 255
  );
  assert.equal(readMeter(pixels).room, PRINT_DEFAULTS.roomStops[1]);
  assert.equal(readMeter(pixels).pool, PRINT_DEFAULTS.poolStops[1]);
  fill(
    () => -2,
    (i) => (i < 20 ? 255 : 128)
  );
  assert.equal(readMeter(pixels), null);
});

test("cast shadows come from the key light's own map, and the open sky from a map drawn from above", () => {
  const calls = [];
  let target = null;
  const renderer = {
    toneMapping: 4,
    toneMappingExposure: 1,
    shadowMap: { autoUpdate: true },
    info: { render: { calls: 0 } },
    getRenderTarget: () => target,
    setRenderTarget: (value) => (target = value),
    getClearAlpha: () => 0,
    getClearColor: (c) => c.setHex(0),
    setClearColor() {},
    clear() {},
    render(scene, camera) {
      const structure = scene.overrideMaterial;
      if (structure)
        calls.push({
          camera,
          material: structure,
          target,
          key: structure.uniforms.structureKey.value.w,
          sky: structure.uniforms.structureSky.value.w,
          roof: roof.visible,
          figure: figure.visible,
          fern: fern.visible,
        });
      else calls.push({ quad: true, target });
    },
    readRenderTargetPixels(_target, _x, _y, width, height, buffer) {
      for (let i = 0; i < width * height; i++) {
        buffer[i * 4] = Math.round(((-3 + (2 * i) / (width * height) + 8) / 10) * 255);
        buffer[i * 4 + 1] = 255;
      }
    },
  };
  const scene = new THREE.Scene();
  const roof = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()),
    figure = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()),
    fern = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  // A section view has lifted the roof away.
  roof.userData.caveRoof = true;
  roof.visible = false;
  fern.userData.flora = true;
  scene.add(roof, figure, fern);
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 300);
  camera.updateMatrixWorld();
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(30, 60, 20);
  sun.castShadow = true;
  sun.shadow.map = { texture: { isTexture: true } };
  sun.shadow.camera.right = 16;
  sun.shadow.bias = -0.001;
  sun.shadow.normalBias = 0.04;
  const frame = { depthTexture: {}, width: 800, height: 450, texture: {} };

  const drawn = createPrintLook({ look: "toon" });
  drawn.prepare(camera, { scene, minute: 900, key: sun, day: 1 });
  drawn.tap.render(renderer, null, frame);
  assert.equal(calls.length, 2, "the scene from above, then the scene as the camera sees it");
  const [above, seen] = calls;
  assert.ok(above.camera.isOrthographicCamera);
  assert.equal(above.camera.right, 16, "over the square the key light's shadow covers");
  assert.ok(above.camera.position.y > 100);
  assert.equal(above.target.width, 1024);
  assert.deepEqual([above.key, above.sky], [0, 0], "while the map is drawn nothing asks it anything");
  assert.equal(above.roof, true, "the lifted roof still counts: a room is not outdoors because its lid is off");
  assert.equal(above.figure, false, "a figure would leave its outline where it last stood");
  assert.equal(above.fern, false);
  assert.equal(seen.camera, camera);
  assert.deepEqual([seen.key, seen.sky], [1, 1]);
  assert.equal(seen.roof, false, "the view itself keeps its section");
  assert.equal(seen.figure, true);
  assert.equal(roof.visible, false);
  assert.ok(figure.visible && fern.visible);
  const sky = drawn.evidence().structure.sky;
  assert.deepEqual(sky, { draws: 1, size: 1024, extent: 16 });
  // A still view does not draw the map again; a view that has moved on does.
  drawn.tap.render(renderer, null, frame);
  assert.equal(drawn.evidence().structure.sky.draws, 1);
  sun.target.position.set(40, 0, 0);
  drawn.tap.render(renderer, null, frame);
  assert.equal(drawn.evidence().structure.sky.draws, 2);

  // The last pass reads the view through its meter first, small, and then draws.
  calls.length = 0;
  drawn.pass.renderToScreen = true;
  drawn.pass.render(renderer, null, { texture: {}, depthTexture: null, width: 800, height: 450 });
  assert.equal(calls.length, 2);
  assert.deepEqual([calls[0].target.width, calls[0].target.height], METER_SIZE);
  assert.equal(calls[1].target, null);
  const meter = drawn.evidence().meter;
  assert.equal(meter.readings, 1);
  assert.ok(Math.abs(meter.room - (-3 + 2 * PRINT_DEFAULTS.roomShare[0])) < 0.05, `shade begins at ${meter.room}`);
  assert.equal(drawn.material.uniforms.printKey.value.x, meter.room);
  assert.equal(drawn.material.uniforms.printMore.value.y, 0, "the meter's view is put away again");
  // Seen from outdoors the land is under the open sky, all of it: whether one spot of rough rock
  // sees the sky is too noisy to ask. A room, a terrace and a chair keep their own answers.
  const structure = above.material,
    cliff = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: "La Jolla bluff sandstone" })),
    floor = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: "pale oak" }));
  cliff.name = "core_carved_mainland001_1";
  floor.name = "core_lounge_floor";
  assert.equal(isLand(cliff, cliff.material), true);
  assert.equal(isLand({ name: "coast_long_sloping_beach" }, { name: "dry beach sand" }), true);
  assert.equal(isLand(floor, floor.material), false);
  assert.equal(isLand(null, null), false);
  structure.onBeforeRender(null, null, null, null, cliff, null);
  assert.equal(structure.uniforms.structureLand.value, 0, "a view inside the house asks each spot");
  drawn.prepare(camera, { outdoors: true });
  drawn.tap.render(renderer, null, frame);
  structure.onBeforeRender(null, null, null, null, cliff, null);
  assert.equal(structure.uniforms.structureLand.value, 1);
  structure.onBeforeRender(null, null, null, null, floor, null);
  assert.equal(structure.uniforms.structureLand.value, 0);
  assert.match(structure.fragmentShader, /if \(structureSky\.w < 0\.5 \|\| structureLand > 0\.5\) return 1\.0;/);
  // Cast shadows are massed: eight taps over a disc that grows with distance, each compared with
  // the surface as it lies there, and the shadow map's width per metre comes from the light.
  assert.deepEqual(structure.uniforms.structureMass.value.toArray(), [drawn.dials.shadowMass, 1 / 32]);
  assert.ok(LOOKS.paint.dials.shadowMass > LOOKS.toon.dials.shadowMass && LOOKS.toon.dials.shadowMass > 0);
  assert.equal(PRINT_DEFAULTS.shadowMass, 0);
  assert.match(
    structure.fragmentShader,
    /float radius = max\(structureShadowBias\.z \* 0\.5, structureMass\.x \* vStructureDepth \* structureMass\.y\);/
  );
  assert.match(structure.fragmentShader, /clamp\(dot\(slope, o\), -0\.02, 0\.02\)/);
  drawn.prepare(camera, { outdoors: false });
  drawn.tap.render(renderer, null, frame);
  structure.onBeforeRender(null, null, null, null, cliff, null);
  assert.equal(structure.uniforms.structureLand.value, 0);
  drawn.dispose();
});

test("the painted look turns forms from the light, lights shade from the sky and the ground, and puts air before far things", () => {
  // Off by default, so the cartoon and the woodblock are as they were.
  assert.equal(PRINT_DEFAULTS.formTurn, 0);
  assert.equal(PRINT_DEFAULTS.air[1], 0);
  assert.ok(LOOKS.paint.dials.formTurn > 0 && LOOKS.paint.dials.air[1] > 0);
  assert.equal(LOOKS.toon.dials.formTurn, undefined);
  // The afterglow: none by day or deep in the night, all of it with the sun on the horizon.
  assert.equal(afterglow(0.5), 0);
  assert.equal(afterglow(-0.3), 0);
  assert.equal(afterglow(0), 1);
  assert.ok(afterglow(0.1) > 0 && afterglow(0.1) < 1 && afterglow(-0.1) > 0 && afterglow(-0.1) < 1);
  // The sky and the sea are one design, shared by the coat and the strokes; the coat's fill knows
  // how its surface lies, and far things take the air's colour.
  const look = createPrintLook({ look: "paint" }),
    shader = look.material.fragmentShader;
  for (const name of ["skyClear", "skyPaint", "seaPaint"]) assert.ok(FIELD_GLSL.includes(`vec3 ${name}(`) && shader.includes(`vec3 ${name}(`), name);
  assert.ok(shader.includes("airFill(shelteredWindow(fill,printWorld[3].xyz,surface,seen/weight,kind.x), lies.w)"));
  // The scene's sky reaches the look: the sun below the horizon too, and the day's weather.
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 300),
    uniforms = look.material.uniforms;
  look.prepare(camera, {
    minute: 1040,
    seconds: 5,
    still: false,
    sky: { sun: [0.6, -0.02, -0.8], weather: { cloudCover: 0.4, cirrus: 0.2 }, marine: 0.3, overcast: 0.1 },
  });
  assert.deepEqual(uniforms.printWeather.value.toArray(), [0.4, 0.2, 0.3, 5]);
  look.prepare(camera, { still: true, sky: { sun: [0, 1, 0], weather: {}, marine: 0, overcast: 0.9 } });
  assert.ok(Math.abs(uniforms.printWeather.value.x - 0.81) < 1e-9, "an overcast sky is cloud");
  assert.equal(uniforms.printWeather.value.w, 0, "and a still view holds its clouds still");
  look.dispose();
});

test("painted firelight follows the visible living hearth, the visitor's gaze and the hour", () => {
  const look = createPrintLook({ look: "paint" });
  const scene = new THREE.Scene();
  const furniture = new THREE.Group();
  const fire = new THREE.Object3D();
  fire.name = "Living hearth · flame volume";
  furniture.position.set(0.95, -0.42, 6.85);
  fire.position.y = 0.971;
  furniture.add(fire);
  scene.add(furniture);
  const camera = new THREE.PerspectiveCamera(40);
  camera.position.set(0.34, 2.6, 1.99);
  camera.lookAt(0.55, 0.67, 7.45);
  const frame = (room = "lounge", sun = -0.3) => {
    look.prepare(camera, { scene, room, sky: { sun: [1, sun, 0] } });
    return look.material.uniforms.printHearth.value;
  };
  const source = frame();
  assert.ok(source.w > 0.99);
  assert.ok(new THREE.Vector3(source.x, source.y, source.z).distanceTo(fire.getWorldPosition(new THREE.Vector3())) < 1e-6);
  assert.equal(frame("kitchen").w, 0);
  assert.equal(frame("lounge", 0.5).w, 0);
  furniture.visible = false;
  assert.equal(frame().w, 0);
  furniture.visible = true;
  camera.lookAt(-8, 2, 1);
  assert.equal(frame().w, 0);
  look.dispose();
});

test("painted foliage keeps an object ID in the view mask while ordinary structure keeps its original exclusions", () => {
  const structure = createStructure(),
    scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera();
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial());
  leaf.userData.flora = leaf.userData.noContactOcclusion = true;
  const unsupported = leaf.clone();
  unsupported.geometry = leaf.geometry.clone();
  unsupported.geometry.setAttribute("coastalPlantRoot", new THREE.Float32BufferAttribute([0, 0, 0], 3));
  scene.add(leaf, unsupported);
  const visibility = [];
  const renderer = {
    shadowMap: { autoUpdate: true },
    info: { render: { calls: 0 } },
    getRenderTarget: () => null,
    getClearAlpha: () => 1,
    getClearColor: (colour) => colour.set(0),
    setRenderTarget() {},
    setClearColor() {},
    clear() {},
    render() {
      visibility.push([leaf.visible, unsupported.visible]);
    },
  };
  structure.render(renderer, scene, camera);
  structure.render(renderer, scene, camera, null, { paintFoliage: true });
  assert.deepEqual(visibility, [
    [false, false],
    [true, false],
  ]);
  assert.equal(leaf.visible, true);
  assert.equal(unsupported.visible, true);
  structure.dispose();
});
