import * as THREE from "../three.module.min.js";
import { TOWEL_LINEN, clothBuilder, createClothIsland } from "./cloth-solver.mjs";
import { createCurtainMeshes, createSheerFabric } from "./sheer-fabric.mjs";

const COLUMNS = 11;
const ROWS = 15;
const HEADER = 0.016;
const HALF_SPLIT = 0.014;
const DEPTH = 0.022;
const STEP = 1 / 30;
const LINEN = { ...TOWEL_LINEN, name: "noren flax linen", damping: 0.42 };

export function norenFrameFromScene(scene) {
  let frame = null;
  for (const object of scene.children) {
    object.traverse((part) => {
      if (part.userData.nativeNorenFrame === undefined) return;
      const value = part.userData.nativeNorenFrame;
      const data = typeof value === "string" ? JSON.parse(value) : value;
      if (
        data?.version !== 1 ||
        !Array.isArray(data.translation) ||
        data.translation.length !== 3 ||
        ![...data.translation, data.yaw, data.span, data.drop].every(Number.isFinite) ||
        data.span < 0.6 ||
        data.span > 2 ||
        data.drop < 0.5 ||
        data.drop > 1.5
      )
        throw new RangeError("Invalid native Onsen noren frame");
      const next = { translation: [...data.translation], yaw: data.yaw, span: data.span, drop: data.drop };
      if (frame && JSON.stringify(frame) !== JSON.stringify(next)) throw new RangeError("Conflicting native Onsen noren frames");
      frame = next;
    });
  }
  return frame;
}

// Resample the irregular folds by fabric length so the fixed top sleeve and
// the warp below it agree on the pattern's width.
function headerProfile(start, end, phase) {
  const profile = [];
  let length = 0;
  for (let i = 0; i <= 88; i++) {
    const u = i / 88;
    const x = start + u * (end - start);
    const z = Math.sin(Math.PI * u) * (0.031 * Math.sin(14.1 * u + phase) + 0.006 * Math.sin(6.1 * u + 0.6));
    if (i) length += Math.hypot(x - profile[i - 1].x, z - profile[i - 1].z);
    profile.push({ x, z, length });
  }
  const samples = [];
  let next = 1;
  for (let column = 0; column < COLUMNS; column++) {
    const at = (column * length) / (COLUMNS - 1);
    while (next < profile.length - 1 && profile[next].length < at) next++;
    const a = profile[next - 1],
      b = profile[next],
      t = (at - a.length) / (b.length - a.length);
    samples.push([a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t]);
  }
  return { length, samples };
}

export function createNorenCloth({ frame, wind = null }) {
  const builder = clothBuilder();
  const half = frame.span / 2;
  const grids = [
    { id: "left", start: -half, end: -HALF_SPLIT, depth: -DEPTH, phase: 0.7 },
    { id: "right", start: HALF_SPLIT, end: half, depth: DEPTH, phase: 2.1 },
  ].map(({ id, start, end, depth, phase }) => {
    const profile = headerProfile(start, end, phase);
    const grid = builder.grid({
      id,
      columns: COLUMNS,
      rows: ROWS,
      width: profile.length,
      height: frame.drop,
      fabric: LINEN,
      hemRows: 1,
      hemMass: 0.015,
      windStride: 3,
      place: (_u, v, column) => {
        const [x, fold] = profile.samples[column];
        return [x, -HEADER - v, depth + fold * (1 - (0.1 * v) / frame.drop)];
      },
    });
    for (let c = 0; c < COLUMNS; c++) {
      builder.pin(grid.index(c, 0));
      for (let r = 1; r < ROWS; r++) builder.tether(grid.index(c, r), grid.index(c, 0), r * grid.vy);
    }
    return grid;
  });
  // A narrow central split reveals the recessed oak jamb between the leaves.
  // It widens toward the hem, where a bather would part it to enter.
  for (let r = 1; r < ROWS; r++) {
    const left = grids[0].index(COLUMNS - 1, r);
    const right = grids[1].index(0, r);
    builder.order(left, right, [0, 0, 1], 0.019);
    builder.order(left, right, [1, 0, 0], 0.022 + 0.026 * (r / (ROWS - 1)) ** 2);
  }
  const model = builder.build();
  const island = createClothIsland(model, { id: "onsen-noren", wind, fixedStep: STEP, substeps: 6, sleepWind: 0.025 });
  return { island, model, grids };
}

export function norenWind(coast, frame) {
  const [ox, oy, oz] = frame.translation;
  const c = Math.cos(frame.yaw),
    s = Math.sin(frame.yaw);
  const sampleIndoor = coast.sampleIndoor?.bind(coast);
  return {
    sample(x, y, z, time, out) {
      if (sampleIndoor) {
        sampleIndoor(ox + c * x + s * z, oy + y, oz - s * x + c * z, time, out);
      } else {
        coast.sample(ox + c * x + s * z, oy + y, oz - s * x + c * z, time, out);
      }
      // The onsen sits behind the entry hall. It receives a bounded share of
      // the indoor field and no direct exterior gust.
      const share = sampleIndoor ? 0.72 : 0.055;
      const vx = out[0],
        vy = out[1],
        vz = out[2];
      const scale = Math.min(share, 0.62 / (Math.hypot(vx, vy, vz) || 1));
      out[0] = (c * vx - s * vz) * scale;
      out[1] = vy * scale;
      out[2] = (s * vx + c * vz) * scale;
      return out;
    },
  };
}

function shadeNoren(material) {
  const compile = material.onBeforeCompile;
  const cacheKey = material.customProgramCacheKey();
  material.customProgramCacheKey = () => cacheKey + "-noren-weave";
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 norenCloth;\nvarying vec2 vNorenCloth;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvNorenCloth = norenCloth;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vNorenCloth;").replace(
      "#include <lights_physical_fragment>",
      `{
  // The shared weave models transmitted light. Dense flax also needs the yarn to vary its reflected colour.
  vec2 pixel = max( fwidth( vSheerFabric ), vec2( 0.0001 ) );
  vec2 yarn = vSheerFabric / vec2( 0.0038, 0.0032 );
  float fine = 1.0 - smoothstep( 0.28, 0.63, max( pixel.x / 0.0038, pixel.y / 0.0032 ) );
  float threads = sin( 2.0 * PI * yarn.x ) * sin( 2.0 * PI * yarn.y );
  float slub = sheerNoise2( vSheerFabric / vec2( 0.006, 0.052 ) );
  diffuseColor.rgb *= 1.0 + fine * 0.08 * threads + 0.19 * ( slub - 0.5 );

  float edge = vNorenCloth.x;
  float selvedge = smoothstep( 0.004 - pixel.x, 0.004 + pixel.x, edge ) *
    ( 1.0 - smoothstep( 0.010 - pixel.x, 0.010 + pixel.x, edge ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.19, 0.23, 0.19 ), 0.51 * selvedge );

  float sleeve = sheerBands.w - sheerBands.z;
  float sleeveLayer = smoothstep( sleeve - pixel.y, sleeve + pixel.y, vSheerFabric.y );
  float seam = 1.0 - smoothstep( pixel.y, 0.0015 + pixel.y, abs( vSheerFabric.y - sleeve ) );
  float hem = 1.0 - smoothstep( sheerBands.y - pixel.y, sheerBands.y + pixel.y, vSheerFabric.y );
  diffuseColor.rgb *= 1.0 - 0.065 * sleeveLayer - 0.095 * seam - 0.06 * hem;

  // A shallow fold receives less indirect light on its concave side. The sign comes from the solved surface.
  float occlusion = smoothstep( 0.025, 0.32, vNorenCloth.y * ( gl_FrontFacing ? 1.0 : -1.0 ) );
  diffuseColor.rgb *= 1.0 - 0.24 * occlusion;
}
#include <lights_physical_fragment>`
    );
  };
}

function writeNorenFold(geometry) {
  const position = geometry.getAttribute("position").array;
  const uv = geometry.getAttribute("uv");
  const cloth = geometry.getAttribute("norenCloth");
  const columns = uv.count / ROWS;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 1; col < columns - 1; col++) {
      const offset = Math.min(col, columns - 1 - col, 4);
      const i = row * columns + col;
      const left = i - offset;
      const right = i + offset;
      const depth = position[3 * i + 2] - (position[3 * left + 2] + position[3 * right + 2]) / 2;
      cloth.array[2 * i + 1] = (2 * depth) / (uv.getX(right) - uv.getX(left));
    }
  }
  cloth.needsUpdate = true;
}

function attachNorenCloth(geometry) {
  const uv = geometry.getAttribute("uv");
  const width = uv.getX(uv.count / ROWS - 1);
  const values = new Float32Array(uv.count * 2);
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    values[2 * i] = Math.min(u, width - u);
  }
  geometry.setAttribute("norenCloth", new THREE.BufferAttribute(values, 2).setUsage(THREE.DynamicDrawUsage));
  writeNorenFold(geometry);
}

export function createNorenRig({ scene, coast, bindMaterial = () => {}, frame = norenFrameFromScene(scene) }) {
  if (!frame) return null;
  const group = new THREE.Group();
  group.name = "Onsen entry noren";
  group.position.fromArray(frame.translation);
  group.rotation.y = frame.yaw;
  scene.add(group);
  group.updateWorldMatrix(true, false);

  const extent = new THREE.Box3(
    new THREE.Vector3(-frame.span / 2 - 0.04, -frame.drop - 0.06, -0.22),
    new THREE.Vector3(frame.span / 2 + 0.04, 0.04, 0.22)
  );
  const box = extent.clone().applyMatrix4(group.matrixWorld);
  const center = box.getCenter(new THREE.Vector3());
  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();
  const projectionPosition = new THREE.Vector3();
  let cloth = null,
    fabric = null,
    drawn = null,
    positions = null,
    accumulator = 0,
    steps = 0,
    inView = false,
    stepping = false,
    composed = false,
    revision = -1,
    buildMilliseconds = null;
  const timings = [];

  function build() {
    const start = performance.now();
    cloth = createNorenCloth({ frame, wind: norenWind(coast, frame) });
    const { island, model } = cloth;
    island.settle(0.55);
    positions = new Float32Array(3 * island.count);
    island.writePositions(positions, 1);
    const panels = model.pieces.map((piece) => ({
      ...piece,
      count: piece.columns * piece.rows,
      positions: positions.subarray(piece.base * 3, (piece.base + piece.columns * piece.rows) * 3),
      uv: model.uv.subarray(piece.base * 2, (piece.base + piece.columns * piece.rows) * 2),
      boundingSphere: { center: [0, -frame.drop / 2, 0], radius: Math.hypot(frame.span / 2, frame.drop / 2 + 0.06, 0.22) },
    }));
    fabric = createSheerFabric({
      name: "onsen flax linen",
      coverage: "opaque",
      color: 0xd3c8b1,
      roughness: 0.89,
      openness: 0.028,
      transmission: 0.21,
      transmissionColor: 0xffe9c9,
      sheenColor: 0xe6dfce,
      sheenRoughness: 0.75,
      hemHeight: 0.022,
      tapeHeight: 0.036,
      fabricTop: frame.drop,
      slub: 0.16,
    });
    shadeNoren(fabric.material);
    fabric.material.userData.installationGroup = "upper";
    bindMaterial(fabric.material);
    drawn = createCurtainMeshes(
      {
        panels,
        writePanel(key, output) {
          const panel = typeof key === "number" ? panels[key] : panels.find((part) => part.id === key);
          output.set(panel.positions);
        },
      },
      fabric
    );
    for (let i = 0; i < drawn.meshes.length; i++) {
      const mesh = drawn.meshes[i];
      attachNorenCloth(mesh.geometry);
      mesh.name = "noren " + panels[i].id;
      mesh.userData.walk = "through";
      mesh.userData.noVolumeDepth = false;
      group.add(mesh);
    }
    revision = island.state.revision;
    composed = true;
    buildMilliseconds = performance.now() - start;
  }

  return {
    group,
    step({ delta, moving, reduced, time, camera, canvasHeight }) {
      const start = performance.now();
      inView = false;
      if (camera) {
        camera.updateMatrixWorld();
        frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const distance = camera.getWorldPosition(projectionPosition).distanceTo(center);
        const pixels = camera.isPerspectiveCamera
          ? (canvasHeight * frame.drop) / (2 * Math.max(0.1, distance) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
          : (canvasHeight * frame.drop * camera.zoom) / (camera.top - camera.bottom);
        inView = distance < 5 && pixels > 60 && frustum.intersectsBox(box);
      }
      stepping = Boolean(inView && moving && !reduced);
      if (inView && !cloth) build();
      if (!cloth) return;
      const { island } = cloth;
      if (reduced && !composed) {
        island.settle(0.55);
        composed = true;
      }
      if (stepping) {
        composed = false;
        accumulator = Math.min(accumulator + delta, 3 * STEP);
        const frames = Math.min(2, Math.floor(accumulator / STEP));
        for (let k = 0; k < frames; k++) {
          island.step(time - (frames - 1 - k) * STEP);
          steps++;
        }
        accumulator -= frames * STEP;
      } else {
        accumulator = 0;
      }
      if (revision !== island.state.revision) {
        island.writePositions(positions, 1);
        drawn.update();
        for (const mesh of drawn.meshes) writeNorenFold(mesh.geometry);
        revision = island.state.revision;
      }
      if (stepping) {
        timings.push(performance.now() - start);
        if (timings.length > 120) timings.shift();
      }
    },
    evidence() {
      const island = cloth?.island;
      const sorted = [...timings].sort((a, b) => a - b);
      return {
        frame,
        ready: Boolean(cloth),
        buildMilliseconds,
        hems:
          cloth?.grids.map((grid) => {
            const k = 3 * grid.index(Math.floor(COLUMNS / 2), ROWS - 1);
            return Array.from(island.positions.subarray(k, k + 3));
          }) ?? [],
        inView,
        stepping,
        steps,
        revision,
        sleeping: island?.state.sleeping ?? true,
        windMetersPerSecond: island?.state.windMax ?? 0,
        kineticEnergy: island?.energies().kinetic ?? 0,
        maxStretch: island?.strain(null, true) ?? 0,
        particles: island?.count ?? 0,
        draws: drawn?.meshes.length ?? 0,
        frameMilliseconds: {
          samples: sorted.length,
          median: sorted[Math.floor(sorted.length / 2)] ?? null,
          p95: sorted[Math.floor(sorted.length * 0.95)] ?? null,
        },
      };
    },
    dispose() {
      drawn?.dispose();
      fabric?.dispose();
      group.removeFromParent();
    },
  };
}
