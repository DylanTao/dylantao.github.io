// Module Worker around one renderer. It computes in slices of about 40 ms, yields to the message
// queue between slices (so pause, stop and path requests are handled promptly), and posts a
// tone-mapped frame at most five times per second.
//
// In:  { type: "start", method, width, height, seed, sunRadiusDegrees, reference?, exposure?, chains?, normalization? }
//      { type: "pause" } | { type: "resume" } | { type: "stop" } | { type: "path" }
// Out: { type: "frame", rgba, width, height, stats }   (rgba is transferred)
//      { type: "path", path }                           (PSSMLT chain 0, null otherwise)
import { DEFAULT_EXPOSURE, createRenderer, luminanceRmse, projectToImage, toneMapToRGBA } from "./core.mjs";

const SLICE_MS = 40;
const FRAME_MS = 200;

let renderer = null;
let job = null;
let paused = false;
let generation = 0;
let lastFrame = 0;
let activeMs = 0;
let resumedAt = 0;

// A MessageChannel ping yields to the event loop without setTimeout's 4 ms clamp.
const channel = new MessageChannel();
channel.port1.onmessage = (event) => step(event.data);

function schedule() {
  channel.port2.postMessage(generation);
}

function elapsedSeconds() {
  return (activeMs + (paused || !renderer ? 0 : performance.now() - resumedAt)) / 1000;
}

function step(gen) {
  if (gen !== generation || !renderer || paused) return;
  renderer.run(SLICE_MS);
  const now = performance.now();
  if (now - lastFrame >= FRAME_MS) {
    lastFrame = now;
    postFrame();
  }
  schedule();
}

function postFrame() {
  const { width, height } = job;
  const image = renderer.image();
  const rgba = toneMapToRGBA(image, width, height, job.exposure);
  const s = renderer.stats();
  const seconds = elapsedSeconds();
  const stats = {
    method: s.method,
    samples: s.samples,
    samplesPerPixel: s.samplesPerPixel,
    samplesPerSecond: seconds > 0 ? s.samples / seconds : 0,
    seconds,
    computeSeconds: s.seconds,
    rays: s.rays,
    raysPerSecond: s.raysPerSecond,
    acceptance: s.method === "mlt" ? s.acceptance : null,
    bootstrapSamples: s.method === "mlt" ? s.bootstrapSamples : null,
    normalization: s.method === "mlt" ? s.normalization : null,
    rmse: null,
    relativeRmse: null,
  };
  if (job.reference) {
    const e = luminanceRmse(image, width, height, job.reference);
    stats.rmse = e.rmse;
    stats.relativeRmse = e.relative;
  }
  self.postMessage({ type: "frame", rgba, width, height, stats }, [rgba.buffer]);
}

function postPath() {
  const p = renderer && renderer.currentPath ? renderer.currentPath() : null;
  if (!p) {
    self.postMessage({ type: "path", path: null });
    return;
  }
  const points = [];
  for (let i = 0; i < p.vertices.length; i += 3) {
    points.push(projectToImage(renderer.scene, job.width, job.height, p.vertices[i], p.vertices[i + 1], p.vertices[i + 2]));
  }
  self.postMessage({ type: "path", path: { vertices: Array.from(p.vertices), points, pixel: [p.x, p.y] } });
}

self.onmessage = (event) => {
  const m = event.data;
  if (m.type === "start") {
    generation++;
    job = {
      width: m.width ?? 240,
      height: m.height ?? 180,
      exposure: m.exposure ?? DEFAULT_EXPOSURE,
      reference: m.reference || null,
    };
    renderer = createRenderer({
      method: m.method,
      width: job.width,
      height: job.height,
      seed: m.seed ?? 1,
      sunRadiusDegrees: m.sunRadiusDegrees ?? 0.8,
      chains: m.chains,
      normalization: m.normalization,
    });
    paused = false;
    activeMs = 0;
    resumedAt = performance.now();
    lastFrame = 0;
    schedule();
  } else if (m.type === "pause") {
    if (renderer && !paused) {
      activeMs += performance.now() - resumedAt;
      paused = true;
      postFrame();
    }
  } else if (m.type === "resume") {
    if (renderer && paused) {
      paused = false;
      resumedAt = performance.now();
      schedule();
    }
  } else if (m.type === "stop") {
    generation++;
    renderer = null;
    job = null;
  } else if (m.type === "path") {
    postPath();
  }
};
