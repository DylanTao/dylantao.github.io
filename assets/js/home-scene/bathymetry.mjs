import * as THREE from "../three.module.min.js";
import { SEA_LEVEL, fillSeabed } from "./sea-optics.mjs";

// The seabed under the Pacific, read from the coast's own geometry (2026-10-18). The authored beach
// slopes 0.75 m under the sea and the cliff's foundation goes about a metre down; nothing else in the
// models lies below sea level. One orthographic draw from above records, in each 0.5 m cell, the highest
// surface below a clip plane just over the water: the sand or rock the water covers there. A cell
// whose column is inside a solid that rises through the surface (a back face seen from above below sea
// level) is dry. fillSeabed (sea-optics.mjs) then continues the seabed down offshore and measures each
// cell's distance to dry land, and the sea shader reads the result as a half-float texture.
//
// The draw and its readback run once when the coast loads and again with the hinterland's coves, never
// in the frame loop. Without float render targets the sea keeps its fallback depth (seabedReady 0).
export const SEABED_BOUNDS = Object.freeze({ minX: -200, maxX: 200, minZ: -80, maxZ: 0 });

const captureVertex = `
varying float seabedY;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  seabedY = world.y;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const captureFragment = `
uniform float seabedClip;
uniform float seabedSea;
uniform float seabedKind;
varying float seabedY;
void main() {
  if (seabedY > (gl_FrontFacing ? seabedClip : seabedSea)) discard;
  // A back face seen from above, below sea level, is the inside of a solid that pierces the surface:
  // it wins every depth test and marks the column dry. Dry columns carry no rock, so filtering cannot
  // spread a dark halo of rock into the water lapping at a boulder; its submerged flanks still count.
  gl_FragDepth = gl_FrontFacing ? gl_FragCoord.z : 0.0;
  gl_FragColor = vec4(gl_FrontFacing ? seabedY : seabedClip, gl_FrontFacing ? seabedKind : 0.0, 1.0, 1.0);
}`;

export function createBathymetry(
  renderer,
  { bounds = SEABED_BOUNDS, cell = 0.5, seaLevel = SEA_LEVEL, clip = seaLevel + 0.5, slope = 0.08, curvature = 0.003, floor = seaLevel - 14 } = {}
) {
  const width = Math.round((bounds.maxX - bounds.minX) / cell),
    rows = Math.round((bounds.maxZ - bounds.minZ) / cell),
    toHalf = THREE.DataUtils.toHalfFloat;
  // Until a capture lands the shader uses its fallback; this texel is deep, open sea.
  const placeholder = new THREE.DataTexture(
    new Uint16Array([toHalf(floor), 0, toHalf(1e4), toHalf(1e4)]),
    1,
    1,
    THREE.RGBAFormat,
    THREE.HalfFloatType
  );
  placeholder.needsUpdate = true;
  const uniforms = {
    seabedMap: { value: placeholder },
    seabedBounds: { value: new THREE.Vector4(bounds.minX, bounds.maxZ, 1 / (bounds.maxX - bounds.minX), 1 / (bounds.maxZ - bounds.minZ)) },
    seabedReady: { value: 0 },
  };
  const materials = [0, 1].map(
    (kind) =>
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: { seabedClip: { value: clip }, seabedSea: { value: seaLevel }, seabedKind: { value: kind } },
        vertexShader: captureVertex,
        fragmentShader: captureFragment,
      })
  );
  const camera = new THREE.OrthographicCamera(
    -(bounds.maxX - bounds.minX) / 2,
    (bounds.maxX - bounds.minX) / 2,
    (bounds.maxZ - bounds.minZ) / 2,
    -(bounds.maxZ - bounds.minZ) / 2,
    0.1,
    clip - (seaLevel - 40) + 2
  );
  // Looking straight down with up = -Z: screen right is +X and screen up is -Z, so readback row 0
  // (the bottom) is the shore side, z = maxZ, matching the shader's v = (maxZ - z) / depth.
  camera.position.set((bounds.minX + bounds.maxX) / 2, clip + 2, (bounds.minZ + bounds.maxZ) / 2);
  camera.up.set(0, 0, -1);
  camera.lookAt(camera.position.x, seaLevel - 40, camera.position.z);
  camera.updateMatrixWorld(true);
  let texture = null,
    data = null,
    captures = 0,
    report = { captured: false, reason: "not yet captured" };

  function terrainMeshes(roots) {
    const meshes = [],
      box = new THREE.Box3();
    for (const root of roots.filter(Boolean)) {
      root.updateWorldMatrix(true, true);
      root.traverse((object) => {
        if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh || object.userData.outline || !object.geometry?.attributes?.position)
          return;
        const material = [object.material].flat()[0];
        if (!material || material.transparent || material.transmission > 0) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        box.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
        if (box.min.y > clip || box.max.y < seaLevel - 40) return;
        if (box.max.x < bounds.minX || box.min.x > bounds.maxX || box.max.z < bounds.minZ || box.min.z > bounds.maxZ) return;
        // "dry beach sand" and "wet tideline sand" are sand; every sandstone and bluff is rock.
        meshes.push({ object, sand: /beach sand|tideline sand/i.test(material.name || "") });
      });
    }
    return meshes;
  }

  // Draw the terrain under `roots` into a float target and start reading it back. `read` is "sync"
  // (readPixels now, which waits for the GPU) or "async" (into a pixel-pack buffer behind a fence,
  // collected by poll()).
  function draw(roots, read) {
    const meshes = terrainMeshes(roots);
    if (!meshes.length) return { meshes, pixels: null, pending: null };
    const target = new THREE.WebGLRenderTarget(width, rows, {
        type: THREE.FloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        generateMipmaps: false,
        depthBuffer: true,
      }),
      scene = new THREE.Scene(),
      pixels = new Float32Array(width * rows * 4);
    for (const { object, sand } of meshes) {
      const proxy = new THREE.Mesh(object.geometry, materials[sand ? 0 : 1]);
      proxy.matrixAutoUpdate = false;
      proxy.matrix.copy(object.matrixWorld);
      proxy.frustumCulled = false;
      scene.add(proxy);
    }
    const gl = renderer.getContext(),
      previousTarget = renderer.getRenderTarget(),
      previousClear = renderer.getClearColor(new THREE.Color()),
      previousAlpha = renderer.getClearAlpha(),
      previousAutoClear = renderer.autoClear,
      previousShadows = renderer.shadowMap.autoUpdate;
    let pending = null;
    try {
      renderer.shadowMap.autoUpdate = false;
      renderer.autoClear = true;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      if (read === "sync") renderer.readRenderTargetPixels(target, 0, 0, width, rows, pixels);
      else {
        // The draw's target stays bound for the read. Three tracks no pixel-pack buffer, so this one
        // is bound only around the read here and the copy in poll().
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
        gl.bufferData(gl.PIXEL_PACK_BUFFER, pixels.byteLength, gl.STREAM_READ);
        gl.readPixels(0, 0, width, rows, gl.RGBA, gl.FLOAT, 0);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        pending = { buffer, fence: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), pixels, meshes };
        gl.flush();
      }
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(previousClear, previousAlpha);
      renderer.autoClear = previousAutoClear;
      renderer.shadowMap.autoUpdate = previousShadows;
      target.dispose();
    }
    return { meshes, pixels: read === "sync" ? pixels : null, pending };
  }

  // Turn a readback into the seabed texture: captured heights, the offshore extension and the
  // shoreline distance (fillSeabed), packed as half floats.
  function finish(pixels, meshes, started, drawn) {
    const count = width * rows,
      heights = new Float32Array(count),
      hit = new Uint8Array(count),
      rock = new Float32Array(count);
    for (let k = 0; k < count; k++) {
      hit[k] = pixels[k * 4 + 3] > 0.5 ? 1 : 0;
      heights[k] = pixels[k * 4];
      rock[k] = hit[k] ? pixels[k * 4 + 1] : 0;
    }
    const filled = fillSeabed({ width, rows, cell, heights, hit, slope, curvature, floor, seaLevel });
    // RGBA: seabed height (m), rock share, distance to dry land (m), distance from the captured coast (m).
    data = new Uint16Array(count * 4);
    let shallowest = Infinity,
      deepest = -Infinity;
    for (let k = 0; k < count; k++) {
      const level = filled.level[k];
      data[k * 4] = toHalf(level);
      data[k * 4 + 1] = toHalf(rock[k]);
      data[k * 4 + 2] = toHalf(Math.min(filled.shore[k], 1e4));
      data[k * 4 + 3] = toHalf(Math.min(filled.reach[k], 1e4));
      if (level < seaLevel) {
        shallowest = Math.min(shallowest, seaLevel - level);
        deepest = Math.max(deepest, seaLevel - level);
      }
    }
    if (!texture) {
      texture = new THREE.DataTexture(data, width, rows, THREE.RGBAFormat, THREE.HalfFloatType);
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.generateMipmaps = false;
      texture.colorSpace = THREE.NoColorSpace;
    } else texture.image.data = data;
    texture.needsUpdate = true;
    uniforms.seabedMap.value = texture;
    uniforms.seabedReady.value = 1;
    captures++;
    report = {
      captured: true,
      captures,
      meshes: meshes.length,
      grid: [width, rows],
      cellMeters: cell,
      bounds: { ...bounds },
      capturedCells: filled.captured,
      dryCells: filled.dry,
      shallowestMeters: Number.isFinite(shallowest) ? shallowest : null,
      deepestMeters: Number.isFinite(deepest) ? deepest : null,
      slope,
      curvature,
      floor,
      drawMilliseconds: drawn - started,
      fillMilliseconds: performance.now() - drawn,
      textureBytes: data.byteLength,
    };
    return report;
  }

  const unavailable = () => !renderer.capabilities.isWebGL2 || !renderer.extensions.has("EXT_color_buffer_float");
  // Capture the seabed under `roots` now: one draw, a readback that waits for the GPU and the CPU fill.
  // Used once at load, before the first composed frame, so every frame sees the same seabed.
  function capture(roots) {
    const started = performance.now();
    if (unavailable()) return (report = { captured: false, reason: "float render targets unavailable" });
    const { meshes, pixels } = draw(roots, "sync");
    if (!pixels) return (report = { captured: false, reason: "no terrain below the clip plane" });
    return finish(pixels, meshes, started, performance.now());
  }
  // The same without waiting: the readback lands a frame or two later through poll(), and `done` runs
  // once the texture has changed. Used when the hinterland streams in while the scene is drawing.
  let inFlight = null;
  function captureAsync(roots, done = null) {
    if (unavailable()) return false;
    if (inFlight) {
      const gl = renderer.getContext();
      gl.deleteSync(inFlight.fence);
      gl.deleteBuffer(inFlight.buffer);
    }
    const started = performance.now(),
      { pending } = draw(roots, "async");
    inFlight = pending ? { ...pending, started, done } : null;
    if (inFlight) schedulePoll();
    return Boolean(inFlight);
  }
  // Scheduler tasks rather than timers or frames: a paused page clock freezes both of those.
  const later = (callback) =>
    globalThis.scheduler?.postTask ? globalThis.scheduler.postTask(callback, { delay: 16 }).catch(() => {}) : setTimeout(callback, 16);
  function schedulePoll() {
    later(() => {
      if (inFlight && !poll()) schedulePoll();
    });
  }
  function poll() {
    if (!inFlight) return true;
    const gl = renderer.getContext(),
      status = gl.clientWaitSync(inFlight.fence, 0, 0);
    if (status === gl.TIMEOUT_EXPIRED) return false;
    const { buffer, fence, pixels, meshes, started, done } = inFlight;
    inFlight = null;
    gl.deleteSync(fence);
    if (status === gl.WAIT_FAILED) {
      gl.deleteBuffer(buffer);
      return true;
    }
    const drawn = performance.now();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.deleteBuffer(buffer);
    finish(pixels, meshes, started, drawn);
    done?.();
    return true;
  }

  // The seabed height (m) at a world point from the last capture, for evidence and probes.
  function sample(x, z) {
    if (!data) return null;
    const u = Math.max(0, Math.min(width - 1, Math.floor((x - bounds.minX) / cell))),
      v = Math.max(0, Math.min(rows - 1, Math.floor((bounds.maxZ - z) / cell))),
      k = v * width + u;
    return {
      height: THREE.DataUtils.fromHalfFloat(data[k * 4]),
      rock: THREE.DataUtils.fromHalfFloat(data[k * 4 + 1]),
      shore: THREE.DataUtils.fromHalfFloat(data[k * 4 + 2]),
      reach: THREE.DataUtils.fromHalfFloat(data[k * 4 + 3]),
    };
  }

  return {
    uniforms,
    capture,
    sample,
    captureAsync,
    evidence: () => ({ ...report }),
    dispose() {
      if (inFlight) {
        const gl = renderer.getContext();
        gl.deleteSync(inFlight.fence);
        gl.deleteBuffer(inFlight.buffer);
        inFlight = null;
      }
      placeholder.dispose();
      texture?.dispose();
      materials.forEach((material) => material.dispose());
    },
  };
}
