// Renders a long, converged reference of the light lab's default scene (/projects/light-paths/)
// and writes assets/js/light-lab/onsen-reference.json (an 80 x 60 luminance grid for the page's
// error measure), assets/img/project_pics/light-paths/reference.png (full colour, 240 x 180) and
// reference-pool.png (the magnified pool floor). With --prefix the files go to that folder
// instead; --linear keeps the float image so the PNGs can be re-exposed exactly later. The shipped
// reference took 24 minutes on 18 threads:
//
//   node bin/make_light_lab_reference.mjs [--minutes 24] [--threads 18] [--prefix dir] [--linear image.f32] [--parts base]
//   node bin/make_light_lab_reference.mjs --from-parts base [--pt-extra more-pt.f32:samples]   (recombine a saved run)
//
// Path space is split by what the camera ray meets first, and each part gets the estimator that
// suits it (the two parts add up to exactly the image PT and PSSMLT converge to):
//   diffuse surface in air -> light tracing with camera connections. It follows sunlight through
//     the water and connects to the eye, so the L-S-D-E reflected caustics on the walls and the
//     light bounced out of the pool converge quickly.
//   water (seen through or reflected in it) -> PSSMLT restricted to those paths, for the shape of
//     the pool image, scaled to the normalization b pooled from every independent sample: the
//     MLT bootstraps and large steps plus dedicated restricted path tracers.
// A 100k bootstrap almost never contains a sun-lit pool path, so every chain starts in the sky-lit
// mode and needs about 2e4 mutations to reach the sun-lit one. Each MLT worker therefore runs a few
// long chains and discards the first 1e5 mutations per chain before it starts splatting.
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const WIDTH = 240;
const HEIGHT = 180;
const GRID_W = 80;
const GRID_H = 60;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

if (!isMainThread) {
  const { createRenderer, luminance } = await import("../assets/js/light-lab/core.mjs");
  const { role, seed, seconds, reportEvery, scene, chains, burnIn } = workerData;
  const options = { width: WIDTH, height: HEIGHT, seed, scene };
  const renderer =
    role === "lt" ? createRenderer({ ...options, method: "lt" }) : createRenderer({ ...options, method: role, firstHit: "specular", chains });
  let burned = role !== "mlt";
  const t0 = performance.now();
  let nextReport = reportEvery * 1000;
  const report = (final) => {
    const image = renderer.image();
    const stats = renderer.stats();
    let lum = 0;
    for (let i = 0; i < image.length; i += 3) lum += luminance(image[i], image[i + 1], image[i + 2]);
    const message = { role, seed, final, burned, image, stats, meanLuminance: lum / (WIDTH * HEIGHT) };
    if (role === "mlt") {
      // Independent uniform samples behind this chain's b: bootstrap plus large-step proposals.
      message.independent = {
        sum: renderer.normalization() * (stats.bootstrapSamples + renderer.largeProposed),
        count: stats.bootstrapSamples + renderer.largeProposed,
      };
    }
    parentPort.postMessage(message, [image.buffer]);
  };
  while (performance.now() - t0 < seconds * 1000) {
    renderer.run(1000);
    if (!burned && renderer.mutations >= burnIn * chains) {
      renderer.resetImage();
      burned = true;
    }
    if (performance.now() - t0 > nextReport) {
      report(false);
      nextReport += reportEvery * 1000;
    }
  }
  report(true);
} else {
  const core = await import("../assets/js/light-lab/core.mjs");
  // Scene overrides exist for previews; the shipped reference uses the defaults.
  const sceneOverrides = JSON.parse(arg("scene", "{}"));
  const scene = core.createScene({ scene: sceneOverrides });
  const prefix = arg("prefix", "");
  const fromParts = arg("from-parts", "");
  if (fromParts) {
    // Recombine a saved run (--parts) without rendering again, optionally pooling extra restricted
    // PT images given as --pt-extra file.f32:samples[,file.f32:samples].
    const load = (f) => new Float32Array(readFileSync(f).buffer.slice(0));
    const meta = JSON.parse(readFileSync(`${fromParts}.json`, "utf8"));
    let pt = Float64Array.from(load(`${fromParts}-pt.f32`), (v) => v * meta.samples.pt);
    let ptSamples = meta.samples.pt;
    for (const spec of arg("pt-extra", "").split(",").filter(Boolean)) {
      const [f, n] = spec.split(":");
      const img = load(f);
      for (let i = 0; i < pt.length; i++) pt[i] += img[i] * +n;
      ptSamples += +n;
    }
    pt = pt.map((v) => v / ptSamples);
    const saved = meta.run || {};
    finish(
      core,
      scene,
      prefix,
      { lt: load(`${fromParts}-lt.f32`), shape: load(`${fromParts}-shape.f32`), pt, b: meta.b, ptSamples, samples: meta.samples, run: saved },
      true
    );
  } else {
    const minutes = +arg("minutes", "24");
    const chains = +arg("chains", "64");
    const burnIn = +arg("burn", "100000");
    const threads = +arg("threads", "18");
    const reportEvery = +arg("report", "120");
    // Thread split: the restricted PSSMLT gets the most, light tracing converges fastest.
    const nLt = Math.max(1, Math.round(threads * 0.17));
    const nPt = Math.max(1, Math.round(threads * 0.33));
    const nMlt = Math.max(1, threads - nLt - nPt);
    const roles = [...Array(nLt).fill("lt"), ...Array(nMlt).fill("mlt"), ...Array(nPt).fill("pt")];
    const latest = new Map();
    const started = performance.now();
    console.log(`reference: ${minutes} min on ${threads} threads (lt ${nLt}, mlt ${nMlt}, pt ${nPt})`);

    const collect = () => {
      const n = WIDTH * HEIGHT;
      const lt = new Float64Array(3 * n);
      const shape = new Float64Array(3 * n);
      const pt = new Float64Array(3 * n);
      let nLtDone = 0;
      let nShape = 0;
      let bSum = 0;
      let bCount = 0;
      const samples = { lt: 0, mlt: 0, pt: 0, independent: 0 };
      for (const m of latest.values()) {
        if (m.role === "lt") {
          for (let i = 0; i < 3 * n; i++) lt[i] += m.image[i];
          nLtDone++;
          samples.lt += m.stats.samples;
        } else if (m.role === "mlt") {
          // Each worker's image divided by its own b has mean luminance 1: that is its shape.
          if (m.burned && m.meanLuminance > 0) {
            const k = 1 / m.meanLuminance;
            for (let i = 0; i < 3 * n; i++) shape[i] += m.image[i] * k;
            nShape++;
          }
          bSum += m.independent.sum;
          bCount += m.independent.count;
          samples.mlt += m.stats.samples;
          samples.independent += m.independent.count;
        } else {
          for (let i = 0; i < 3 * n; i++) pt[i] += m.image[i] * m.stats.samples;
          bSum += m.meanLuminance * m.stats.samples;
          bCount += m.stats.samples;
          samples.pt += m.stats.samples;
          samples.independent += m.stats.samples;
        }
      }
      return {
        lt: lt.map((v) => v / Math.max(1, nLtDone)),
        shape: shape.map((v) => v / Math.max(1, nShape)),
        pt: pt.map((v) => v / Math.max(1, samples.pt)),
        ptSamples: samples.pt,
        b: bCount > 0 ? bSum / bCount : 0,
        samples,
        nShape,
        run: {
          threads: { lt: nLt, mlt: nMlt, pt: nPt },
          chainsPerMltWorker: chains,
          burnInMutationsPerChain: burnIn,
          wallSeconds: Math.round((performance.now() - started) / 1000),
        },
      };
    };
    const write = (final) => {
      const parts = collect();
      if (parts.nShape === 0) {
        console.log("checkpoint skipped: PSSMLT workers are still in burn-in");
        return;
      }
      const partsBase = arg("parts", "");
      if (partsBase) {
        for (const k of ["lt", "shape", "pt"]) writeFileSync(`${partsBase}-${k}.f32`, Buffer.from(Float32Array.from(parts[k]).buffer));
        writeFileSync(`${partsBase}.json`, JSON.stringify({ b: parts.b, samples: parts.samples, run: parts.run }));
      }
      finish(core, scene, prefix, parts, final);
    };
    const workers = roles.map(
      (role, k) =>
        new Promise((resolve, reject) => {
          const w = new Worker(fileURLToPath(import.meta.url), {
            workerData: { role, seed: 7919 * (k + 1), seconds: minutes * 60, reportEvery, scene: sceneOverrides, chains, burnIn },
          });
          w.on("message", (m) => {
            latest.set(k, m);
            if (m.final) resolve();
          });
          w.on("error", reject);
          w.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker ${k} exited with ${code}`))));
        })
    );
    const timer = setInterval(
      () => {
        if (latest.size === roles.length) write(false);
      },
      reportEvery * 1000 + 5000
    );
    await Promise.all(workers);
    clearInterval(timer);
    write(true);
  }
}

// PSSMLT's chains move between parts of the sun-lit mode (the floor patch seen directly, light
// trapped in the pool by total internal reflection) slowly enough that a finite run can weight
// them wrongly by tens of percent. The unbiased restricted PT image fixes the low frequencies: the
// PSSMLT image is multiplied by a smooth field, bilinear in log space between the centres of gw x gh
// blocks, fitted so each block's luminance matches PT's. Blocks holding under 5 % of the brightest
// block's luminance are not fitted (their PT total is mostly noise) and take their neighbours'
// value instead; corrections are clamped to [1/2, 2].
function correctLowFrequencies(core, mlt, pt, gw, gh) {
  const n = WIDTH * HEIGHT;
  const lumM = new Float64Array(n);
  const block = new Int32Array(n);
  const sp = new Float64Array(gw * gh);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const i = y * WIDTH + x;
      const k = Math.min(gh - 1, Math.floor((y * gh) / HEIGHT)) * gw + Math.min(gw - 1, Math.floor((x * gw) / WIDTH));
      block[i] = k;
      lumM[i] = core.luminance(mlt[3 * i], mlt[3 * i + 1], mlt[3 * i + 2]);
      sp[k] += core.luminance(pt[3 * i], pt[3 * i + 1], pt[3 * i + 2]);
    }
  const top = Math.max(...sp);
  const fitted = new Uint8Array(gw * gh);
  for (let k = 0; k < gw * gh; k++) fitted[k] = sp[k] > 0.05 * top ? 1 : 0;
  const logR = new Float64Array(gw * gh);
  const fill = () => {
    const known = fitted.slice();
    for (let pass = 0; pass < gw + gh; pass++) {
      const next = known.slice();
      for (let by = 0; by < gh; by++)
        for (let bx = 0; bx < gw; bx++) {
          const k = by * gw + bx;
          if (known[k]) continue;
          let sum = 0;
          let count = 0;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const x = bx + dx;
            const y = by + dy;
            if (x >= 0 && x < gw && y >= 0 && y < gh && known[y * gw + x]) {
              sum += logR[y * gw + x];
              count++;
            }
          }
          if (count) {
            logR[k] = sum / count;
            next[k] = 1;
          }
        }
      known.set(next);
    }
  };
  const field = new Float64Array(n);
  const interpolate = () => {
    for (let y = 0; y < HEIGHT; y++) {
      const fy = Math.min(gh - 1, Math.max(0, ((y + 0.5) * gh) / HEIGHT - 0.5));
      const y0 = Math.floor(fy);
      const y1 = Math.min(gh - 1, y0 + 1);
      const ty = fy - y0;
      for (let x = 0; x < WIDTH; x++) {
        const fx = Math.min(gw - 1, Math.max(0, ((x + 0.5) * gw) / WIDTH - 0.5));
        const x0 = Math.floor(fx);
        const x1 = Math.min(gw - 1, x0 + 1);
        const tx = fx - x0;
        field[y * WIDTH + x] = Math.exp(
          (1 - ty) * ((1 - tx) * logR[y0 * gw + x0] + tx * logR[y0 * gw + x1]) + ty * ((1 - tx) * logR[y1 * gw + x0] + tx * logR[y1 * gw + x1])
        );
      }
    }
  };
  // Fixed-point fit: nudge each fitted block's log-ratio by its remaining luminance mismatch.
  for (let iter = 0; iter < 40; iter++) {
    fill();
    interpolate();
    const sc = new Float64Array(gw * gh);
    for (let i = 0; i < n; i++) sc[block[i]] += lumM[i] * field[i];
    let worst = 0;
    for (let k = 0; k < gw * gh; k++) {
      if (!fitted[k] || !(sc[k] > 0)) continue;
      const step = Math.log(sp[k] / sc[k]);
      worst = Math.max(worst, Math.abs(step));
      logR[k] = Math.max(-Math.LN2, Math.min(Math.LN2, logR[k] + step));
    }
    if (worst < 1e-4) break;
  }
  fill();
  interpolate();
  const out = new Float32Array(mlt.length);
  for (let i = 0; i < n; i++) {
    out[3 * i] = mlt[3 * i] * field[i];
    out[3 * i + 1] = mlt[3 * i + 1] * field[i];
    out[3 * i + 2] = mlt[3 * i + 2] * field[i];
  }
  const ratios = [];
  for (let k = 0; k < gw * gh; k++) if (fitted[k]) ratios.push(+Math.exp(logR[k]).toFixed(3));
  return { image: out, ratios };
}

function finish(core, scene, prefix, parts, final) {
  const n = WIDTH * HEIGHT;
  const mlt = new Float32Array(3 * n);
  for (let i = 0; i < 3 * n; i++) mlt[i] = parts.shape[i] * parts.b;
  const corrected = parts.ptSamples > 0 ? correctLowFrequencies(core, mlt, parts.pt, 8, 6) : { image: mlt, ratios: [] };
  const image = new Float32Array(3 * n);
  for (let i = 0; i < 3 * n; i++) image[i] = parts.lt[i] + corrected.image[i];
  const grid = core.downsampleLuminance(image, WIDTH, HEIGHT, GRID_W, GRID_H);
  const o = scene.options;
  const json = {
    description: "Converged luminance (linear, Rec. 709 weights) of the light-lab onsen scene, box-filtered to 80 x 60.",
    width: GRID_W,
    height: GRID_H,
    renderWidth: WIDTH,
    renderHeight: HEIGHT,
    sunRadiusDegrees: o.sunRadiusDegrees,
    exposure: core.DEFAULT_EXPOSURE,
    parameters: {
      sunElevationDegrees: o.sunElevationDegrees,
      sunAzimuthDegrees: o.sunAzimuthDegrees,
      sunDirection: scene.sun.map((v) => +v.toFixed(6)),
      sunIrradiance: o.sunIrradiance,
      sunRadianceRGB: scene.sunRadiance.map((v) => +v.toPrecision(6)),
      skyRadianceRGB: scene.skyRadiance.map((v) => +v.toPrecision(6)),
      hole: o.hole,
      pool: o.pool,
      waterLevel: o.waterLevel,
      ior: o.ior,
      sigmaA: o.sigmaA,
      waves: o.waves,
      ripple: o.ripple,
      camera: o.camera,
      maxDepth: o.maxDepth,
    },
    method: {
      summary: [
        "Light tracing for paths whose camera ray first meets a diffuse surface.",
        "For paths whose camera ray first meets the water: PSSMLT restricted to them (long chains, burn-in discarded),",
        "scaled by b pooled from all independent samples, then low-frequency corrected on 8 x 6 blocks by unbiased restricted path tracing.",
      ].join(" "),
      ...parts.run,
      lightTracerParticles: parts.samples.lt,
      restrictedMutations: parts.samples.mlt,
      independentSamplesForB: parts.samples.independent,
      restrictedPathTracerSamples: parts.ptSamples,
      restrictedNormalization: +parts.b.toPrecision(6),
      blockCorrections: corrected.ratios,
      final,
    },
    luminance: Array.from(grid, (v) => +v.toPrecision(4)),
  };
  const root = fileURLToPath(new URL("..", import.meta.url));
  writeFileSync(prefix ? join(prefix, "onsen-reference.json") : join(root, "assets/js/light-lab/onsen-reference.json"), JSON.stringify(json));
  const rgba = core.toneMapToRGBA(image, WIDTH, HEIGHT, +arg("exposure", core.DEFAULT_EXPOSURE));
  writeFileSync(
    prefix ? join(prefix, "reference.png") : join(root, "assets/img/project_pics/light-paths/reference.png"),
    encodePNG(WIDTH, HEIGHT, rgba)
  );
  // The magnified pool floor the page shows under the race, at its own darker exposure.
  const pool = core.toneMapRegionToRGBA(image, WIDTH, HEIGHT, core.POOL_CROP, core.POOL_EXPOSURE);
  writeFileSync(
    prefix ? join(prefix, "reference-pool.png") : join(root, "assets/img/project_pics/light-paths/reference-pool.png"),
    encodePNG(pool.width, pool.height, pool.rgba)
  );
  const linear = arg("linear", "");
  if (linear) writeFileSync(linear, Buffer.from(image.buffer));
  console.log(
    [
      `${final ? "final" : "checkpoint"}: b(restricted) ${parts.b.toPrecision(5)}`,
      `PT samples ${parts.ptSamples}, independent ${parts.samples.independent}, lt ${parts.samples.lt}, mlt ${parts.samples.mlt}`,
      `block ratios ${corrected.ratios.join(" ")}`,
    ].join(", ")
  );
}

function encodePNG(width, height, rgba) {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  const crc = (buf) => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let i = 0; i < width * 4; i++) raw[y * (width * 4 + 1) + 1 + i] = rgba[y * width * 4 + i];
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
