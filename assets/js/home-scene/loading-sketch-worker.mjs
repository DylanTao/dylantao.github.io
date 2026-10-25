// Draws the loading sketch off the main thread, so model parsing and the first upload never stall
// the pen, and fetches and decodes the drawings here too. Messages come from loading-sketch.mjs.
import { createSketchEngine, decodeDrawing } from "./loading-sketch-core.mjs";

let engine = null,
  canvas = null,
  data = null,
  room = null,
  scheduled = false,
  settled = false,
  reported = -Infinity;
const nextFrame = self.requestAnimationFrame ? (run) => self.requestAnimationFrame(run) : (run) => setTimeout(() => run(performance.now()), 16);

function bytesOf(text) {
  const binary = atob(text),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Only the coast drawing and the room the visitor will arrive in are ever decoded.
function addView(id) {
  if (!engine || !data || !id || engine.has(id) || !data.views?.[id]) return;
  engine.add(id, decodeDrawing(bytesOf(data.views[id].strokes), data.grid, data.range), data.plan?.[id === "outside" ? "outside" : "room"]);
}

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
    self.postMessage({ type: "state", state: engine.state() });
  }
  if (engine.settled && !settled) {
    settled = true;
    self.postMessage({ type: "settled", state: engine.state() });
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
    fetch(message.url)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (!json || !engine) return;
        data = json;
        engine.focus(json.focus);
        addView("outside");
        addView(room);
        schedule();
      })
      .catch(() => {});
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
    addView(room);
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
