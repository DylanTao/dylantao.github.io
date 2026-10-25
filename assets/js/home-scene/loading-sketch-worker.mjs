// Draws the loading sketch off the main thread, so model parsing and the first upload never stall
// the pen, and fetches and decodes the drawings here too. Messages come from loading-sketch.mjs.
import { createSketchEngine, loadSketches } from "./loading-sketch-core.mjs";

let engine = null,
  canvas = null,
  loader = null,
  room = null,
  scheduled = false,
  settled = false,
  reported = -Infinity;
const nextFrame = self.requestAnimationFrame ? (run) => self.requestAnimationFrame(run) : (run) => setTimeout(() => run(performance.now()), 16);

function schedule() {
  if (scheduled || !engine) return;
  scheduled = true;
  nextFrame(run);
}

function run(time) {
  scheduled = false;
  if (!engine) return;
  const more = engine.tick(time);
  if (time - reported > 250) {
    reported = time;
    self.postMessage({ type: "state", state: { ...engine.state(), pending: loader?.pending() ?? [] } });
  }
  if (engine.settled && !settled) {
    settled = true;
    self.postMessage({ type: "settled", state: { ...engine.state(), pending: loader?.pending() ?? [] } });
  }
  if (more) schedule();
}

function size(width, height, ratio) {
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
}

self.onmessage = ({ data: message }) => {
  if (message.type === "init") {
    canvas = message.canvas;
    const context = canvas.getContext("2d");
    if (!context) {
      self.postMessage({ type: "unsupported" });
      return;
    }
    size(message.options.width, message.options.height, message.options.dpr);
    engine = createSketchEngine(context, { ...message.options, layer: (width, height) => new OffscreenCanvas(width, height) });
    self.postMessage({ type: "running" });
    // Only the coast drawing and the room the visitor will arrive in are ever fetched and decoded.
    loader = loadSketches(message.url, {
      onIndex: (index) => engine?.focus(index.focus),
      onDrawing: (id, drawing, plan) => {
        if (!engine || engine.has(id)) return;
        engine.add(id, drawing, plan);
        schedule();
      },
    });
    loader.want("outside");
    loader.want(room);
    schedule();
  } else if (!engine) {
    return;
  } else if (message.type === "resize") {
    size(message.width, message.height, message.dpr);
    engine.resize(message.width, message.height, message.dpr);
    schedule();
  } else if (message.type === "colors") {
    engine.colors(message.ink, message.accent);
    schedule();
  } else if (message.type === "stage") {
    if (message.room) room = message.room;
    loader?.want(room);
    engine.stage(message.stage, message.room);
    schedule();
  } else if (message.type === "progress") {
    engine.progress(message.fills);
    schedule();
  } else if (message.type === "finish") {
    engine.finish();
    schedule();
  } else if (message.type === "dispose") {
    engine = null;
    self.close();
  }
};
