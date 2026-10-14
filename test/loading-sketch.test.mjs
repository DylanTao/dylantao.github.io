import test from "node:test";
import assert from "node:assert/strict";
import {
  createSketchEngine,
  decodeSketch,
  frameStrokes,
  hilbertIndex,
  springStep,
  strokeBudget,
} from "../assets/js/home-scene/loading-sketch-core.mjs";

function recordingContext(width, height) {
  const segments = [];
  let alpha = 1,
    color = "";
  return {
    canvas: { width, height },
    segments,
    setTransform() {},
    clearRect() {
      segments.length = 0;
    },
    beginPath() {},
    moveTo(x, y) {
      segments.push({ x0: x, y0: y, alpha, color });
    },
    lineTo(x, y) {
      Object.assign(segments.at(-1), { x1: x, y1: y });
    },
    stroke() {},
    set globalAlpha(value) {
      alpha = value;
    },
    get globalAlpha() {
      return alpha;
    },
    set strokeStyle(value) {
      color = value;
    },
    lineCap: "",
    lineWidth: 1,
  };
}

test("the stroke spring starts still, overshoots by about five percent and settles by its end", () => {
  assert.equal(springStep(0), 0);
  let peak = 0;
  for (let s = 0; s <= 1.5; s += 0.005) peak = Math.max(peak, springStep(s));
  assert.ok(peak > 1.03 && peak < 1.08, `overshoot ${peak}`);
  assert.ok(Math.abs(springStep(1) - 1) < 0.01);
  assert.ok(springStep(0.02) < 0.01, "a stroke leaves gently");
});

test("Hilbert order visits every cell once and keeps neighbours close", () => {
  const seen = new Set();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) seen.add(hilbertIndex(x, y, 16));
  assert.equal(seen.size, 256);
  const cells = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) cells[hilbertIndex(x, y, 16)] = [x, y];
  for (let d = 1; d < 256; d++) assert.equal(Math.abs(cells[d][0] - cells[d - 1][0]) + Math.abs(cells[d][1] - cells[d - 1][1]), 1);
});

test("packed sketches decode inside the view and keep their directions modulo pi", () => {
  const bytes = Uint8Array.from([0, 0, 0, 255, 255, 255, 128, 128, 64]);
  const strokes = decodeSketch(bytes);
  assert.equal(strokes.length, 9);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(strokes[i * 3]) <= 1.66 && Math.abs(strokes[i * 3 + 1]) <= 1.01);
    assert.ok(strokes[i * 3 + 2] >= 0 && strokes[i * 3 + 2] < Math.PI);
  }
  assert.ok(Math.abs(strokes[8] - Math.PI / 4) < 1e-6);
});

test("the stroke budget scales with the scene's area within bounds", () => {
  assert.equal(strokeBudget(100, 100), 480);
  assert.equal(strokeBudget(545, 461), 1256);
  assert.equal(strokeBudget(2000, 1200), 1400);
});

test("frame strokes follow a drawn edge and run along it", () => {
  const width = 160,
    height = 120,
    rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4,
        dark = x > 80;
      rgba[i] = rgba[i + 1] = rgba[i + 2] = dark ? 40 : 220;
      rgba[i + 3] = 255;
    }
  const strokes = frameStrokes(rgba, width, height, 200);
  assert.ok(strokes.length >= 30 * 3, `found ${strokes.length / 3}`);
  for (let i = 0; i < strokes.length; i += 3) {
    const x = strokes[i] * (height / 2) + width / 2;
    assert.ok(Math.abs(x - 80.5) < 2.5, `stroke at x=${x}`);
    // A vertical edge gives vertical strokes.
    assert.ok(Math.abs(Math.cos(strokes[i + 2])) < 0.2, `direction ${strokes[i + 2]}`);
  }
  assert.equal(frameStrokes(new Uint8ClampedArray(width * height * 4), width, height, 200).length, 0);
});

test("a stage lands every stroke on the drawing; reduced motion places it at once", () => {
  const targets = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) {
    targets[i * 3] = -0.5 + (i % 30) / 30;
    targets[i * 3 + 1] = -0.3 + Math.floor(i / 30) / 40;
    targets[i * 3 + 2] = 0;
  }
  for (const reduced of [false, true]) {
    const context = recordingContext(400, 300);
    const engine = createSketchEngine(context, { width: 400, height: 300, dpr: 1, reduced });
    let time = 0;
    engine.tick(time);
    engine.morph("overview", targets);
    for (let frame = 0; frame < 300; frame++) engine.tick((time += 1000 / 60));
    assert.equal(engine.stage, "overview");
    const half = 150;
    const misses = context.segments.filter(({ x0, y0, x1, y1 }) => {
      const u = ((x0 + x1) / 2 - 200) / half,
        v = ((y0 + y1) / 2 - half) / half;
      return u < -0.56 || u > 0.52 || v < -0.36 || v > 0.2;
    });
    assert.equal(misses.length, 0, `${misses.length} strokes outside the drawing (reduced=${reduced})`);
    assert.equal(context.segments.length, engine.count);
  }
});

test("finishing on a blank frame keeps the last drawing and reports settled", () => {
  const context = recordingContext(320, 240);
  const engine = createSketchEngine(context, { width: 320, height: 240 });
  const targets = new Float32Array(500 * 3).map((_, i) => (i % 3 === 2 ? 1 : ((i * 7919) % 100) / 200 - 0.25));
  let time = 0;
  engine.tick(time);
  engine.morph("room", targets);
  for (let frame = 0; frame < 150; frame++) engine.tick((time += 1000 / 60));
  engine.finish(new Float32Array(0));
  for (let frame = 0; frame < 120 && !engine.settled; frame++) engine.tick((time += 1000 / 60));
  assert.equal(engine.stage, "frame");
  assert.ok(engine.settled);
});
