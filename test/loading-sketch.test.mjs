import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import {
  BREATH,
  PEN,
  allowedInk,
  breathDepth,
  createSketchEngine,
  decodeDrawing,
  parsePlan,
  stageFills,
} from "../assets/js/home-scene/loading-sketch-core.mjs";

const require = createRequire(import.meta.url);
const generator = require("../bin/build_loading_sketch.cjs");
const sketch = JSON.parse(readFileSync(new URL("../assets/models/home/loading-sketch.json", import.meta.url), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("../assets/models/home/manifest.json", import.meta.url), "utf8"));

// A 2D context that records what is stroked, and a layer factory that hands out recording canvases.
function recordingContext(width, height) {
  const strokes = [];
  let path = [],
    alpha = 1;
  const context = {
    canvas: { width, height },
    strokes,
    images: 0,
    setTransform() {},
    clearRect() {},
    fillRect() {},
    beginPath() {
      path = [];
    },
    moveTo(x, y) {
      path.push([x, y]);
    },
    lineTo(x, y) {
      path.push([x, y]);
    },
    arc() {},
    fill() {},
    stroke() {
      strokes.push({ points: path, alpha });
    },
    drawImage() {
      context.images++;
    },
    set globalAlpha(value) {
      alpha = value;
    },
    get globalAlpha() {
      return alpha;
    },
    strokeStyle: "",
    fillStyle: "",
    lineCap: "",
    lineJoin: "",
    lineWidth: 1,
  };
  return context;
}
const layers = [];
function layer(width, height) {
  const canvas = { width, height, context: recordingContext(width, height), getContext: () => canvas.context };
  layers.push(canvas);
  return canvas;
}

// Three straight lines, one per layer, packed by the generator's own encoder.
function syntheticDrawing() {
  const lines = [0, 1, 2].map((layerIndex) => ({
    layer: layerIndex,
    weight: 3 - layerIndex,
    kind: 3,
    uv: Array.from({ length: 11 }, (_, k) => [-1 + 0.2 * k, -0.5 + 0.5 * layerIndex]),
  }));
  return generator.encode(lines).bytes;
}

test("the generator's packed polylines decode to the same points, layers and lengths", () => {
  const drawing = decodeDrawing(syntheticDrawing(), generator.GRID, generator.RANGE);
  assert.equal(drawing.strokes.length, 3);
  for (const [index, stroke] of drawing.strokes.entries()) {
    assert.equal(stroke.layer, index);
    assert.equal(stroke.weight, 3 - index);
    assert.ok(Math.abs(stroke.points[0] + 1) < 1e-3 && Math.abs(stroke.points.at(-2) - 1) < 1e-3);
    assert.ok(Math.abs(stroke.points[1] - (-0.5 + 0.5 * index)) < 1e-3);
    assert.ok(Math.abs(stroke.length - 2) < 2e-3, `length ${stroke.length}`);
  }
  assert.ok(Math.abs(drawing.ink - 6) < 6e-3);
  assert.ok(Math.abs(drawing.layerInk[1] - 2) < 2e-3);
  assert.deepEqual([0, -1, 1, -2, 63, -64].map(generator.zigzag), [0, 1, 2, 3, 126, 127]);
});

test("a plan gates each group by its own segment and never runs past an unfinished group", () => {
  const plan = parsePlan("house:a,b coast:c room:d");
  assert.deepEqual(
    plan.map((g) => [g.segment, g.from, g.to]),
    [
      ["house", 0, 2],
      ["coast", 2, 3],
      ["room", 3, 4],
    ]
  );
  const drawing = { ink: 10, layerInk: [2, 2, 3, 3] };
  assert.equal(allowedInk(drawing, plan, {}), 0);
  assert.equal(allowedInk(drawing, plan, { house: 0.5 }), 2);
  // The coast is complete but the house is not: the pen waits on the house.
  assert.equal(allowedInk(drawing, plan, { house: 0.5, coast: 1, room: 1 }), 2);
  assert.equal(allowedInk(drawing, plan, { house: 1, coast: 1 / 3 }), 5);
  assert.equal(allowedInk(drawing, plan, { house: 1, coast: 1, room: 1 }), 10);
  assert.deepEqual(stageFills("lighting"), { house: 1, coast: 1, room: 1, sirui: 1 });
});

function engineWith(drawings, options = {}) {
  const context = recordingContext(400, 300),
    engine = createSketchEngine(context, { width: 400, height: 300, dpr: 1, layer, ...options });
  for (const [id, plan] of drawings) engine.add(id, decodeDrawing(syntheticDrawing(), generator.GRID, generator.RANGE), plan);
  return { context, engine };
}
function run(engine, seconds, clock = { t: 0 }) {
  for (let frame = 0; frame < seconds * 60; frame++) engine.tick((clock.t += 1000 / 60));
  return clock;
}

test("the pen follows finished work, never runs ahead and holds through a stall", () => {
  const { engine } = engineWith([["outside", "house:a coast:b room:c"]]);
  const clock = run(engine, 0.5);
  assert.equal(engine.state().drawn, 0, "nothing is drawn before work finishes");
  engine.progress({ house: 0.5 });
  let last = 0;
  for (let frame = 0; frame < 120; frame++) {
    engine.tick((clock.t += 1000 / 60));
    const { allowed, drawn } = engine.state();
    assert.ok(drawn <= allowed + 1e-9, `drawn ${drawn} > allowed ${allowed}`);
    assert.ok(drawn >= last, "ink never disappears");
    last = drawn;
  }
  assert.ok(Math.abs(engine.state().drawn - 1 / 6) < 1e-3, "the pen catches up within a second");
  // A stall: no new work for ten seconds. The pen rests and breathes; no ink is added.
  run(engine, 10, clock);
  assert.ok(Math.abs(engine.state().drawn - 1 / 6) < 1e-3);
  assert.equal(engine.state().resting, true);
  engine.progress({ house: 1, coast: 1, room: 1 });
  run(engine, 2.5, clock);
  assert.equal(engine.state().drawn, 1, "a jump to complete work is drawn within a few seconds");
});

test("without measured progress only completed stages count, and the room drawing takes over", () => {
  const { engine } = engineWith([
    ["outside", "house:a coast:b room:c"],
    ["study", "room:a,b view:c"],
  ]);
  const clock = run(engine, 0.2);
  engine.stage("coast");
  run(engine, 1.5, clock);
  assert.equal(engine.state().drawing, "outside");
  assert.ok(Math.abs(engine.state().drawn - 1 / 3) < 1e-3, "the house layer once the shell is in");
  engine.stage("room", "study");
  run(engine, 1.5, clock);
  // The room's work has not begun: the coast drawing stays, complete as far as house and coast.
  assert.equal(engine.state().drawing, "outside");
  assert.ok(Math.abs(engine.state().drawn - 2 / 3) < 1e-3);
  engine.stage("lighting", "study");
  run(engine, 2, clock);
  assert.equal(engine.state().drawing, "study");
  assert.ok(Math.abs(engine.state().drawn - 2 / 3) < 1e-3, "structure and furniture before the view's programs");
  engine.stage("first-frame", "study");
  run(engine, 1, clock);
  assert.ok(Math.abs(engine.state().drawn - 2 / 3) < 1e-3, "the view's layers wait for its programs, which no stage reports");
  engine.finish();
  run(engine, 1, clock);
  assert.equal(engine.state().drawn, 1);
  assert.equal(engine.settled, true);
});

test("measured progress hands over once the room's own work has begun", () => {
  const { engine } = engineWith([
    ["outside", "house:a coast:b room:c"],
    ["study", "room:a,b view:c"],
  ]);
  const clock = run(engine, 0.2);
  engine.progress({ house: 1, coast: 1 });
  engine.stage("room", "study");
  run(engine, 1, clock);
  assert.equal(engine.state().drawing, "outside");
  engine.progress({ room: (PEN.handover * 3) / 2 + 0.01 });
  run(engine, 1, clock);
  assert.equal(engine.state().drawing, "study");
  assert.ok(engine.state().drawn > PEN.handover && engine.state().drawn <= engine.state().allowed + 1e-9);
});

test("reduced motion draws what is allowed at once and needs no further frames", () => {
  const { engine } = engineWith([["outside", "house:a coast:b room:c"]], { reduced: true });
  engine.progress({ house: 1, coast: 0.5 });
  engine.tick(0);
  assert.equal(engine.state().drawn, 0.5);
  assert.equal(engine.tick(16), false, "a still drawing asks for no animation frames");
  // New work redraws once, on the frame the page schedules for the message, and stays still.
  engine.progress({ coast: 1 });
  assert.equal(engine.tick(32), false);
  assert.ok(Math.abs(engine.state().drawn - 2 / 3) < 1e-3);
});

test("the opening sun is a flourish in amber, never counted as progress ink", () => {
  const context = recordingContext(400, 300);
  let accentStrokes = 0;
  const stroke = context.stroke;
  context.stroke = () => {
    if (context.strokeStyle === "#c46a2c") accentStrokes++;
    stroke();
  };
  const engine = createSketchEngine(context, { width: 400, height: 300, dpr: 1, layer, daylight: 0.4 });
  engine.add("outside", decodeDrawing(syntheticDrawing(), generator.GRID, generator.RANGE), "house:a coast:b room:c");
  run(engine, 1.5);
  assert.ok(accentStrokes > 0, "the sun is drawn before any work finishes");
  assert.equal(engine.state().drawn, 0);
});

test("a resting drawing's breath eases in, never exceeds its depth and decays to a quiet floor", () => {
  assert.equal(breathDepth(0), 0);
  assert.ok(breathDepth(0.2) < breathDepth(1.0), "it eases in");
  let peak = 0;
  for (let t = 0; t < 60; t += 0.05) peak = Math.max(peak, breathDepth(t));
  assert.ok(peak <= BREATH.depth + 1e-12);
  assert.ok(breathDepth(40) < 0.4 * peak, "it decays");
  assert.ok(breathDepth(40) > 0, "it never stops entirely");
});

test("the shipped drawings cover the coast and every room an activity opens in, within budget", () => {
  assert.equal(sketch.version, 2);
  const rooms = [...new Set(Object.values(manifest.activities).map((activity) => activity.room))].sort();
  assert.deepEqual(Object.keys(sketch.views), ["outside", ...rooms]);
  const gzipped = gzipSync(readFileSync(new URL("../assets/models/home/loading-sketch.json", import.meta.url))).length;
  assert.ok(gzipped < 250 * 1024, `${gzipped} gzipped bytes`);
  for (const [id, view] of Object.entries(sketch.views)) {
    const plan = parsePlan(sketch.plan[id === "outside" ? "outside" : "room"]),
      drawing = decodeDrawing(Buffer.from(view.strokes, "base64"), sketch.grid, sketch.range);
    assert.equal(drawing.strokes.length, view.count, id);
    assert.ok(drawing.strokes.length > 200, `${id} has ${drawing.strokes.length} strokes`);
    // Pen order follows the plan: layers never go backward.
    for (let k = 1; k < drawing.strokes.length; k++) assert.ok(drawing.strokes[k].layer >= drawing.strokes[k - 1].layer, `${id} stroke ${k}`);
    assert.ok(drawing.strokes.at(-1).layer < plan.at(-1).to);
    for (const stroke of drawing.strokes)
      for (let k = 0; k < stroke.points.length; k += 2)
        assert.ok(Math.abs(stroke.points[k]) <= sketch.range.u + 1e-6 && Math.abs(stroke.points[k + 1]) <= sketch.range.v + 1e-6);
    assert.equal(allowedInk(drawing, plan, { house: 1, coast: 1, room: 1, sirui: 1, view: 1 }).toFixed(6), drawing.ink.toFixed(6));
  }
  for (const room of rooms) assert.ok(Number.isFinite(sketch.focus[room]?.u), `${room} has a dive point`);
});
