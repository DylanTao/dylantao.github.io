import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import { resolveRoutine } from "../assets/js/home-scene/routine.mjs";
import {
  BREATH,
  PEN,
  allowedInk,
  breathDepth,
  createSketchEngine,
  decodeDrawing,
  loadSketches,
  parsePlan,
  stageFills,
} from "../assets/js/home-scene/loading-sketch-core.mjs";

const require = createRequire(import.meta.url);
const generator = require("../bin/build_loading_sketch.cjs");
const MODELS = new URL("../assets/models/home/", import.meta.url);
const sketch = JSON.parse(readFileSync(new URL("loading-sketch.json", MODELS), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("manifest.json", MODELS), "utf8"));
// The coast view's strokes sit in the index; each room's sit in the file the index names.
const strokesOf = (id) => sketch.views[id].strokes ?? JSON.parse(readFileSync(new URL(sketch.views[id].file, MODELS), "utf8")).strokes;

function formFixture({ split = null, category = "furniture", flat = false } = {}) {
  const width = 128,
    height = 80,
    id = new Int32Array(width * height),
    normal = new Float32Array(width * height * 3),
    depth = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x,
        angle = flat ? 0 : -0.8 + (1.6 * x) / (width - 1);
      id[i] = split === "gap" && y === 39 ? 0 : split === "object" && y >= height / 2 ? 2 : 1;
      depth[i] = (split === "thin-depth" && y === 39) || (split === "depth" && y >= height / 2) ? 2 : 1;
      normal[i * 3] = Math.sin(angle);
      normal[i * 3 + 2] = Math.cos(angle);
    }
  return {
    width,
    height,
    id,
    normal,
    depth,
    categories: new Map([
      [1, category],
      [2, category],
    ]),
  };
}

test("fine form lines follow real normal variation and leave a planar surface blank", () => {
  assert.deepEqual(generator.normalContourLines(formFixture({ flat: true })), []);
  const lines = generator.normalContourLines(formFixture());
  assert.ok(lines.length >= 3, "the smooth curved fixture has several distinct form contours");
  for (const line of lines) {
    assert.equal(line.category, "detail", "form curves wait for the existing late detail group");
    assert.equal(line.form, true);
    for (const [x] of line.points) {
      const angle = -0.8 + (1.6 * x) / 127,
        value = -0.5 * Math.sin(angle) + 0.6245 * Math.cos(angle);
      assert.ok(Math.min(...[-0.1, 0.15, 0.4, 0.65, 0.85].map((level) => Math.abs(value - level))) < 0.01);
    }
  }
});

test("fine form lines stop at object and depth boundaries and never hatch water or foliage", () => {
  for (const split of ["object", "depth", "gap", "thin-depth"]) {
    const lines = generator.normalContourLines(formFixture({ split }));
    assert.ok(lines.length >= 6, `${split} splits each curved contour into separate visible pieces`);
    for (const line of lines) {
      const ys = line.points.map((point) => point[1]);
      assert.ok(Math.max(...ys) < 40 || Math.min(...ys) >= 40, `${split}: no invented line crosses the discontinuity`);
    }
  }
  for (const category of ["sea", "cliff", "plants", "background"]) assert.deepEqual(generator.normalContourLines(formFixture({ category })), []);
});

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
  assert.equal(sketch.version, 3);
  // Include the actual daily routine's furniture stations as well as each base activity.
  const rooms = [
    ...new Set(
      Array.from({ length: 7 }, (_, day) =>
        Object.entries(manifest.activities)
          .filter(([, spec]) => !spec.previewOnly)
          .map(([activity, spec]) => resolveRoutine(manifest, new Date(`2026-10-0${day + 1}T12:00:00-07:00`), { activity, minute: spec.minute }).room)
      ).flat()
    ),
  ].sort();
  assert.deepEqual(Object.keys(sketch.views), ["outside", ...rooms]);
  // The index carries the coast view; each room is its own file beside it, and nothing else is there.
  assert.ok(sketch.views.outside.strokes);
  assert.deepEqual(
    rooms.map((room) => sketch.views[room].file),
    rooms.map((room) => `loading-sketch/${room}.json`)
  );
  assert.deepEqual(readdirSync(new URL("loading-sketch/", MODELS)).sort(), rooms.map((room) => `${room}.json`).sort());
  for (const room of rooms) assert.equal(JSON.parse(readFileSync(new URL(sketch.views[room].file, MODELS), "utf8")).view, room);
  const gzipped = (file) => gzipSync(readFileSync(new URL(file, MODELS))).length,
    index = gzipped("loading-sketch.json"),
    roomFiles = rooms.map((room) => gzipped(sketch.views[room].file));
  // A load fetches the index and its arrival room only; all drawings keep the original allowance.
  assert.ok(index + Math.max(...roomFiles) < 100 * 1024, `${index} + ${Math.max(...roomFiles)} gzipped bytes per load`);
  assert.ok(index + roomFiles.reduce((sum, size) => sum + size, 0) < 250 * 1024);
  for (const [id, view] of Object.entries(sketch.views)) {
    const plan = parsePlan(sketch.plan[id === "outside" ? "outside" : "room"]),
      drawing = decodeDrawing(Buffer.from(strokesOf(id), "base64"), sketch.grid, sketch.range);
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

test("a load fetches the index and only the rooms it is told about, each once", async () => {
  const requested = [];
  const fetch = async (target) => {
    const file = new URL(target).pathname.split("/models/home/")[1];
    requested.push(file);
    if (file === "loading-sketch/gym.json") return { ok: false, json: async () => null };
    return { ok: true, json: async () => JSON.parse(readFileSync(new URL(file, MODELS), "utf8")) };
  };
  const delivered = [];
  let focus = null;
  const loader = loadSketches("https://example.test/assets/models/home/loading-sketch.json", {
    fetch,
    onIndex: (index) => (focus = index.focus),
    onDrawing: (id, drawing, plan) => delivered.push({ id, strokes: drawing.strokes.length, plan }),
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  // Wanted before the index arrives, and again after: each file is fetched once.
  loader.want("outside");
  loader.want("study");
  loader.want(null);
  assert.deepEqual(loader.pending(), ["outside", "study"], "both are on their way");
  await settle();
  assert.deepEqual(loader.pending(), []);
  loader.want("study");
  loader.want("gym");
  loader.want("attic");
  await settle();
  assert.deepEqual(requested, ["loading-sketch.json", "loading-sketch/study.json", "loading-sketch/gym.json"]);
  // A missing room file, or a room the index does not know, leaves only that drawing out.
  assert.deepEqual(loader.pending(), []);
  assert.deepEqual(
    delivered.map(({ id }) => id),
    ["outside", "study"]
  );
  assert.equal(delivered[0].strokes, sketch.views.outside.count);
  assert.equal(delivered[0].plan, sketch.plan.outside);
  assert.equal(delivered[1].strokes, sketch.views.study.count);
  assert.equal(delivered[1].plan, sketch.plan.room);
  assert.ok(Number.isFinite(focus.study.u));
});
