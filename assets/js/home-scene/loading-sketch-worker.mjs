// Draws the loading sketch off the main thread, so model parsing and the first upload never stall
// the strokes. Messages come from loading-sketch.mjs.
import { createSketchEngine, frameStrokes } from "./loading-sketch-core.mjs";

let engine = null,
  canvas = null,
  scheduled = false,
  settled = false;
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
  if (engine.settled && !settled) {
    settled = true;
    self.postMessage({ type: "settled" });
  }
  if (more) schedule();
}

function size(width, height, ratio) {
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
}

self.onmessage = ({ data }) => {
  if (data.type === "init") {
    canvas = data.canvas;
    const context = canvas.getContext("2d");
    if (!context) {
      self.postMessage({ type: "unsupported" });
      return;
    }
    size(data.options.width, data.options.height, data.options.dpr);
    engine = createSketchEngine(context, data.options);
    self.postMessage({ type: "running" });
    schedule();
  } else if (!engine) {
    return;
  } else if (data.type === "resize") {
    size(data.width, data.height, data.dpr);
    engine.resize(data.width, data.height, data.dpr);
    schedule();
  } else if (data.type === "colors") {
    engine.colors(data.ink, data.accent);
    schedule();
  } else if (data.type === "morph") {
    engine.morph(data.kind, data.targets);
    schedule();
  } else if (data.type === "finish") {
    let targets = null;
    if (data.bitmap) {
      const { width, height } = data.bitmap;
      const reader = new OffscreenCanvas(width, height).getContext("2d", { willReadFrequently: true });
      reader.drawImage(data.bitmap, 0, 0);
      targets = frameStrokes(reader.getImageData(0, 0, width, height).data, width, height, engine.count);
      data.bitmap.close();
    }
    engine.finish(targets);
    schedule();
  } else if (data.type === "dispose") {
    engine = null;
    self.close();
  }
};
