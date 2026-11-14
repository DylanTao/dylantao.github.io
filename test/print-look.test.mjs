import assert from "node:assert/strict";
import test from "node:test";
import {
  COLOURWAYS,
  DEFAULT_DRAWN_LOOK,
  DRAWN_LOOKS,
  LOOKS,
  OKLAB,
  PRINT_DEFAULTS,
  PRINT_KEY,
  colourwayAt,
  createPrintLook,
  linearToOklab,
  oklabToLinear,
  readDrawnLook,
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
    lift: uniforms.printLift.value,
    crossHue: uniforms.printWeight.value.w,
    grain: uniforms.printGrain.value.x,
  };
  assert.ok(toon.lift < 1, "the darks are opened");
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
  assert.equal(uniforms.printLift.value, 1);
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
