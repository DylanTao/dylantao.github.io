// Still frames for the light lab page (/projects/light-paths/), shown before the live comparison
// runs and when it cannot: path tracing and PSSMLT after 5 and 60 seconds of equal compute time,
// from the same engine the page runs (assets/js/light-lab/core.mjs), one thread each, seed 1.
//
//   node bin/capture_light_lab_frames.mjs            (about two minutes)
//   node bin/capture_light_lab_frames.mjs --teaser   (about eleven minutes, two threads)
//
// Writes assets/img/project_pics/light-paths/{pt,mlt}-{05,60}s.png and prints each frame's
// relative error against the reference. --teaser instead renders both methods at 800 x 600 for
// 660 s each in parallel, the same compute per pixel as a minute at 240 x 180, and writes
// teaser.png: path tracing on the left half, PSSMLT on the right.
import { readFileSync, writeFileSync } from "node:fs";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { deflateSync } from "node:zlib";
import { createRenderer, luminanceRmse, toneMapToRGBA } from "../assets/js/light-lab/core.mjs";

const WIDTH = 240,
  HEIGHT = 180;
const TEASER = { width: 800, height: 600, seconds: 660 };
const root = new URL("..", import.meta.url);
const reference = JSON.parse(readFileSync(new URL("assets/js/light-lab/onsen-reference.json", root), "utf8"));

// Runs one renderer for each listed compute budget in turn and returns its image at each.
function render(method, width, height, budgets) {
  const renderer = createRenderer({ method, width, height, seed: 1, sunRadiusDegrees: 0.8 });
  let spent = 0;
  return budgets.map((seconds) => {
    while (spent < seconds * 1000) {
      const step = Math.min(250, seconds * 1000 - spent);
      renderer.run(step);
      spent += step;
    }
    return { seconds, image: renderer.image(), samples: renderer.stats().samples };
  });
}

if (!isMainThread) {
  const [frame] = render(workerData.method, TEASER.width, TEASER.height, [TEASER.seconds]);
  parentPort.postMessage(frame);
}

const table = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function png(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const units = { pt: "paths", mlt: "mutations" };
if (!isMainThread) {
  // The teaser workers stop after posting their frame.
} else if (process.argv.includes("--teaser")) {
  const { width, height } = TEASER;
  const frames = await Promise.all(
    ["pt", "mlt"].map(
      (method) =>
        new Promise((resolve, reject) => {
          const worker = new Worker(new URL(import.meta.url), { workerData: { method } });
          worker.once("message", resolve);
          worker.once("error", reject);
        })
    )
  );
  const [left, right] = frames.map((frame) => toneMapToRGBA(frame.image, width, height));
  const split = width / 2;
  for (let y = 0; y < height; y++) {
    for (let x = split; x < width; x++) for (let c = 0; c < 4; c++) left[(y * width + x) * 4 + c] = right[(y * width + x) * 4 + c];
    // A thin pale seam marks the boundary between the two renders.
    for (const x of [split - 1, split]) for (let c = 0; c < 3; c++) left[(y * width + x) * 4 + c] = 236;
  }
  writeFileSync(new URL("assets/img/project_pics/light-paths/teaser.png", root), png(width, height, left));
  ["pt", "mlt"].forEach((method, i) => {
    const error = luminanceRmse(frames[i].image, width, height, reference);
    console.log(`teaser ${method}`, `${Math.round(error.relative * 100)}% relative error`, frames[i].samples, units[method]);
  });
} else {
  for (const method of ["pt", "mlt"]) {
    for (const { seconds, image, samples } of render(method, WIDTH, HEIGHT, [5, 60])) {
      const error = luminanceRmse(image, WIDTH, HEIGHT, reference);
      const name = `${method}-${String(seconds).padStart(2, "0")}s.png`;
      writeFileSync(new URL(`assets/img/project_pics/light-paths/${name}`, root), png(WIDTH, HEIGHT, toneMapToRGBA(image, WIDTH, HEIGHT)));
      console.log(name, `${Math.round(error.relative * 100)}% relative error`, samples, units[method]);
    }
  }
}
