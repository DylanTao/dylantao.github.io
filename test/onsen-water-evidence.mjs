// Bounded, CPU-only numerical audit. Optional argv[2] writes the JSON result.
import { performance } from "node:perf_hooks";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { cpus } from "node:os";
import { createHeightfieldWater } from "../assets/js/home-scene/heightfield-water.mjs";
import { createOnsenWater } from "../assets/js/home-scene/onsen-water.mjs";

const pulse = createHeightfieldWater();
pulse.disturb({ x: 0.2, z: 0.1, amplitude: 0.008, spread: 0.12 });
const initial = pulse.evidence();
let maximumRelativeMassError = Math.abs(initial.relativeMassError),
  maximumEnergy = initial.energy,
  minimumDepth = initial.minimumDepth,
  maximumDepth = initial.maximumDepth;
for (let i = 0; i < 600; i++) {
  pulse.advance(1 / 60);
  const e = pulse.evidence();
  maximumRelativeMassError = Math.max(maximumRelativeMassError, Math.abs(e.relativeMassError));
  maximumEnergy = Math.max(maximumEnergy, e.energy);
  minimumDepth = Math.min(minimumDepth, e.minimumDepth);
  maximumDepth = Math.max(maximumDepth, e.maximumDepth);
}

const mode = createHeightfieldWater({ nx: 64, nz: 8, width: 2, length: 1, radius: null, depth: 0.1, damping: 0 }),
  basis = (i) => Math.cos((Math.PI * (i + 0.5)) / 64),
  period = 4 / Math.sqrt(9.80665 * 0.1),
  amplitude = 0.0001,
  standingWave = [];
for (let j = 0; j < 8; j++) for (let i = 0; i < 64; i++) mode.state.h[j * 64 + i] += amplitude * basis(i);
for (const fraction of [0.25, 0.5, 1]) {
  const ticks = Math.floor((fraction * period) / (1 / 120));
  while (mode.evidence().simulationTime < ticks / 120 - 1e-10) mode.advance(1 / 120);
  const time = mode.evidence().simulationTime,
    measured = (2 / (64 * 8)) * mode.state.h.reduce((sum, h, k) => sum + (h - 0.1) * basis(k % 64), 0),
    expected = amplitude * Math.cos((2 * Math.PI * time) / period);
  standingWave.push({
    time,
    fraction,
    measured,
    expected,
    absoluteError: Math.abs(measured - expected),
    errorRelativeToInitialAmplitude: Math.abs(measured - expected) / amplitude,
  });
}

const occupied = createHeightfieldWater(),
  obstacleMass = occupied.evidence().mass;
occupied.setObstacle({ x: 0, z: -0.1, radius: 0.17 });
const arrival = occupied.evidence();
occupied.disturb({ x: 0.18, z: -0.1, amplitude: 0.012, spread: 0.14 });
for (let i = 0; i < 180; i++) occupied.advance(1 / 60);
occupied.setObstacle({ x: 0.1, z: -0.1, radius: 0.17 });
const movement = occupied.evidence();
occupied.setObstacle(null);
const departure = occupied.evidence();

const rendered = createOnsenWater();
rendered.setBather({ x: 3.02, z: -1.92 });
for (let i = 0; i < 120; i++) rendered.advance(1 / 60);
const timing = [];
for (let i = 0; i < 300; i++) {
  if (i % 60 === 0) rendered.disturb({ x: 3.2, z: -1.92, amplitude: 0.003 });
  const start = performance.now();
  rendered.advance(1 / 60);
  timing.push(performance.now() - start);
}
timing.sort((a, b) => a - b);
const geometry = rendered.surfaceGeometry(),
  modulePayload = ["heightfield-water.mjs", "onsen-water.mjs"].map((name) => {
    const bytes = readFileSync(new URL(`../assets/js/home-scene/${name}`, import.meta.url));
    return { name, sha256: createHash("sha256").update(bytes).digest("hex"), sourceBytes: bytes.length, gzipBytes: gzipSync(bytes).length };
  });
const result = {
  timestamp: new Date().toISOString(),
  primarySource: "https://matthias-research.github.io/pages/publications/hfFluid.pdf",
  limitations:
    "CPU Node audit; no browser, GPU upload, WebGL compiler, transparent material, or native actor contact measurement. First-order advection and staircase solid mask are approximations, not a full paper reproduction.",
  modules: modulePayload,
  impulse: {
    initial,
    final: pulse.evidence(),
    maximumRelativeMassError,
    maximumEnergy,
    minimumDepth,
    maximumDepth,
    finalEnergyFraction: pulse.evidence().energy / initial.energy,
  },
  standingWave,
  obstacle: {
    initialMass: obstacleMass,
    arrival,
    movement,
    departure,
    maximumMassDifference: Math.max(...[arrival, movement, departure].map((e) => Math.abs(e.mass - obstacleMass))),
  },
  runtime: {
    node: process.version,
    cpu: cpus()[0]?.model,
    samples: timing.length,
    warmupFrames: 120,
    frameDelta: 1 / 60,
    medianCpuMilliseconds: timing[Math.floor(timing.length / 2)],
    p95CpuMilliseconds: timing[Math.floor(timing.length * 0.95)],
    maximumCpuMilliseconds: timing.at(-1),
    includes: "solver advance + Float32 packing + Three texture dirty marking; excludes GPU execution/upload and evidence scanning",
    state: rendered.evidence(),
    vertices: geometry.getAttribute("position").count,
    triangles: geometry.index.count / 3,
    geometryBytes: Object.values(geometry.attributes).reduce((sum, a) => sum + a.array.byteLength, 0) + geometry.index.array.byteLength,
  },
};
geometry.dispose();
rendered.dispose();
const json = JSON.stringify(result, null, 2) + "\n";
if (process.argv[2]) writeFileSync(process.argv[2], json);
process.stdout.write(json);
