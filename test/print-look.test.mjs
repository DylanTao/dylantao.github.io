import assert from "node:assert/strict";
import test from "node:test";
import {
  COLOURWAYS,
  OKLAB,
  PRINT_DEFAULTS,
  PRINT_KEY,
  colourwayAt,
  createPrintLook,
  linearToOklab,
  oklabToLinear,
  readPrintLook,
  writePrintLook,
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

test("the print treatment is off unless the URL or this session asked for it", () => {
  const storage = memoryStorage();
  assert.equal(readPrintLook("", storage), false);
  assert.equal(readPrintLook("?print=1", storage), true);
  assert.equal(storage.getItem(PRINT_KEY), "1");
  assert.equal(readPrintLook("", storage), true, "the choice survives moving around the site");
  assert.equal(readPrintLook("?print=0", storage), false);
  assert.equal(storage.getItem(PRINT_KEY), null);
  writePrintLook(true, storage);
  assert.equal(readPrintLook("?scene-lab=1", storage), true);
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
  assert.equal(readPrintLook("?print=1", refusing), true, "the URL still applies without storage");
  assert.equal(readPrintLook("", refusing), false);
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
