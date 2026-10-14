import * as THREE from "../three.module.min.js";

// Three.js compiles a material's shader program the first time it draws it, and the draw then
// blocks until the driver finishes. On ANGLE/D3D11 each of this scene's programs takes 0.1-1.8 s,
// so the first composed view froze the page for 13 s. With KHR_parallel_shader_compile the driver
// compiles on worker threads instead: create every program a frame will need, then wait without
// blocking. Programs are shared by cache key, so a proxy compiled under the same state as the real
// draw (target, lights, object) is the program that draw later finds.

// WebGLShadowMap draws front faces' backs (and vice versa) into the depth map.
const SHADOW_SIDE = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };

function withTarget(renderer, target, compile) {
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  try {
    return compile();
  } finally {
    renderer.setRenderTarget(previous);
  }
}

// Compile `material` against the real meshes it will draw, then restore their own materials.
function compileAsOverride(renderer, scene, camera, material, accept) {
  const swapped = [];
  scene.traverse((object) => {
    if (!object.isMesh || !accept(object)) return;
    swapped.push([object, object.material]);
    object.material = material;
  });
  try {
    renderer.compile(scene, camera);
  } finally {
    for (const [object, original] of swapped) object.material = original;
  }
}

// Mirror WebGLShadowMap.getDepthMaterial: the depth proxy copies the caster's alpha, map, clipping,
// displacement, and shadow side, which with the mesh's skinning, morphs, and attributes select the
// depth program's variant. One proxy per distinct variant is kept for the renderer's lifetime: the
// shadow pass's own material shares its program, and disposing the proxy could release it.
const shadowProxies = new WeakMap();
// The shadow pass writes the same state onto a caster's custom depth material before every draw,
// so a double-sided plant's wind-depth material draws double-sided: compile it that way.
function copyShadowState(target, material) {
  Object.assign(target, {
    side: material.shadowSide ?? SHADOW_SIDE[material.side],
    alphaMap: material.alphaMap,
    alphaTest: material.alphaTest,
    map: material.map,
    clipShadows: material.clipShadows,
    clippingPlanes: material.clippingPlanes,
    clipIntersection: material.clipIntersection,
    displacementMap: material.displacementMap,
    displacementScale: material.displacementScale,
    displacementBias: material.displacementBias,
  });
}
const textureSlot = (texture) => (texture ? `t${texture.channel}` : "");
function casterVariant(object, material, light) {
  const geometry = object.geometry;
  return [
    light.isPointLight ? "distance" : "depth",
    object.isSkinnedMesh,
    object.isInstancedMesh,
    object.isBatchedMesh,
    Object.keys(geometry.morphAttributes).sort().join(),
    object.morphTargetInfluences?.length || 0,
    Object.keys(geometry.attributes).sort().join(),
    material.shadowSide ?? SHADOW_SIDE[material.side],
    textureSlot(material.map),
    textureSlot(material.alphaMap),
    material.alphaTest > 0,
    textureSlot(material.displacementMap),
    material.clipShadows && material.clippingPlanes?.length,
  ].join("|");
}
function compileShadowCasters(renderer, scene, camera) {
  // The shadow pass draws without a scene, so its programs are keyed without fog.
  const fog = scene.fog;
  scene.fog = null;
  try {
    return compileShadowCastersWithoutFog(renderer, scene, camera);
  } finally {
    scene.fog = fog;
  }
}
function compileShadowCastersWithoutFog(renderer, scene, camera) {
  const lights = [];
  scene.traverseVisible((object) => {
    if (object.isLight && object.castShadow) lights.push(object);
  });
  if (!renderer.shadowMap.enabled || !lights.length) return [];
  let proxies = shadowProxies.get(renderer);
  if (!proxies) shadowProxies.set(renderer, (proxies = new Map()));
  const used = new Set(),
    pending = [];
  for (const light of lights) {
    const custom = light.isPointLight ? "customDistanceMaterial" : "customDepthMaterial";
    scene.traverse((object) => {
      if (!object.isMesh || !object.castShadow) return;
      for (const material of [object.material].flat()) {
        if (!material) continue;
        if (object[custom]) {
          pending.push([object, object[custom], material]);
          continue;
        }
        const variant = casterVariant(object, material, light);
        if (used.has(variant)) continue;
        used.add(variant);
        let proxy = proxies.get(variant);
        if (!proxy) {
          proxy = light.isPointLight ? new THREE.MeshDistanceMaterial() : new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
          copyShadowState(proxy, material);
          proxies.set(variant, proxy);
        }
        pending.push([object, proxy]);
      }
    });
  }
  // Each proxy compiles against the caster that selects its variant, with the scene's lights.
  for (const [object, material, caster] of pending) {
    if (caster) copyShadowState(material, caster);
    const original = object.material;
    object.material = material;
    try {
      renderer.compile(object, camera, scene);
    } finally {
      object.material = original;
    }
  }
  return pending.map(([, material]) => material);
}

// A transmissive, double-sided, opaque material also draws its back faces into the transmission
// target, a variant WebGLRenderer.compile does not create (it splits only transparent materials).
function compileTransmissionBackfaces(renderer, scene, camera) {
  const materials = [];
  scene.traverse((object) => {
    if (!object.isMesh) return;
    for (const material of [object.material].flat()) {
      if (!(material?.transmission > 0) || material.side !== THREE.DoubleSide || material.transparent) continue;
      material.side = THREE.BackSide;
      material.needsUpdate = true;
      try {
        renderer.compile(object, camera, scene);
      } finally {
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      }
      materials.push(material);
    }
  });
  return materials;
}

// Creating a program is synchronous JavaScript (assembling and preprocessing its source): for this
// scene's first view, 0.1-1.6 s in a single task, which froze scrolling and the loading bar. Batches
// of a few materials with a task boundary between them keep the page responsive. Each batch is an
// ordinary compile of the whole scene with the other meshes' materials set aside, so the lights,
// fog and environment, and therefore every program key, are those compile(scene) would use.
// The driver compiles on a worker pool as wide as the CPU, and this scene's first view is about
// 35 s of D3D11 compiler time. Submitting every batch at once kept the test machine's 22 logical
// cores busy, and the page's own thread then waited up to 1.5 s for a turn while doing 3-7 ms of
// work. After its task boundary, the next batch waits until no more than `slots` programs are
// compiling.
async function compileSceneInBatches(renderer, scene, camera, target, queue, slots, onBatch, size = 6) {
  const holders = [],
    pending = new Set();
  scene.traverse((object) => {
    if (!object.material) return;
    holders.push([object, object.material]);
    for (const material of [object.material].flat()) if (material) pending.add(material);
  });
  const all = [...pending];
  for (let start = 0; start < all.length; start += size) {
    const batch = new Set(all.slice(start, start + size)),
      compiled = [];
    withTarget(renderer, target, () => {
      try {
        for (const [object, material] of holders)
          object.material = Array.isArray(material) ? material.filter((entry) => batch.has(entry)) : batch.has(material) ? material : null;
        for (const material of renderer.compile(scene, camera)) compiled.push(material);
      } finally {
        for (const [object, material] of holders) object.material = material;
      }
    });
    queue.add(compiled);
    onBatch?.(Math.min(all.length, start + size), all.length);
    await new Promise((resolve) => later(resolve, 0));
    await queue.drain(slots);
  }
}

// Full-screen passes draw a position/uv triangle with no lights (Pass.js FullScreenQuad).
const fullscreenGeometry = new THREE.BufferGeometry();
fullscreenGeometry.setAttribute("position", new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
fullscreenGeometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
const fullscreenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function programsOf(renderer, materials) {
  const programs = new Set();
  for (const material of materials) {
    const properties = renderer.properties.get(material);
    for (const program of properties.programs?.values() || []) programs.add(program);
  }
  return programs;
}

// Driver completion is wall-clock work, so polling uses the browser scheduler where it exists:
// timers and animation frames can be virtualized (a paused test clock would otherwise hold
// streamed rooms back indefinitely). The deadline counts polls for the same reason.
const later = (callback, delay) =>
  globalThis.scheduler?.postTask ? globalThis.scheduler.postTask(callback, { delay }).catch(() => {}) : setTimeout(callback, delay);

// A finished program still needs a main-thread link resolution on first use (about 0.1 s each for
// this scene's largest programs on ANGLE/D3D11). Resolve each one in its own task as soon as the
// driver reports it complete, so the first frame does not pay for all of them at once.
function createCompileQueue(renderer, timeout) {
  const seen = new Set(),
    compiling = new Set();
  let waited = 0,
    resolved = 0;
  return {
    get seen() {
      return seen.size;
    },
    get resolved() {
      return resolved;
    },
    add(materials) {
      for (const program of programsOf(renderer, materials)) {
        if (seen.has(program)) continue;
        seen.add(program);
        compiling.add(program);
      }
    },
    // Resolves to whether no more than `limit` programs are still compiling; false once the
    // timeout (counted in polls) has run out.
    async drain(limit, onResolved) {
      while (compiling.size > limit && waited <= timeout) {
        const ready = [...compiling].find((program) => program.isReady());
        if (ready) {
          compiling.delete(ready);
          ready.getUniforms();
          ready.getAttributes();
          resolved++;
          onResolved?.();
        } else waited += 16;
        await new Promise((resolve) => later(resolve, ready ? 0 : 16));
      }
      return compiling.size <= limit;
    },
  };
}

// Half the logical cores, so the page, the compositor and the GPU process's own thread keep theirs.
const compileSlots = () => Math.max(2, Math.floor((globalThis.navigator?.hardwareConcurrency || 4) / 2));

/**
 * Create every program one composed frame needs and resolve once the driver has finished them.
 * `target` matches the beauty pass's render target; `overrides` are scene-wide override materials
 * with the meshes they draw; `passes` are full-screen materials with the target each draws into and
 * an optional `prepare(renderer)` that sets the defines the pass would set on its first draw.
 * `onProgress(fraction)` reports the work done for the loading bar: submitting the scene's batches
 * is the first 40%, programs the driver has finished the rest (counted once every program is known,
 * so the fraction never runs ahead of the work).
 * Resolves to true when every program is ready, false after `timeout` (a lost context never
 * reports completion; the first draw then falls back to the blocking path) or at once when the
 * driver cannot compile in parallel or is a software rasterizer.
 */
// Software rasterizers (SwiftShader, llvmpipe) compile on the same few CPU cores that draw, so
// warming every variant up front only adds work there; they keep the draw-time path.
function softwareRenderer(renderer) {
  if (!renderer.extensions.has("WEBGL_debug_renderer_info")) return false;
  const info = renderer.extensions.get("WEBGL_debug_renderer_info");
  return /swiftshader|llvmpipe|softpipe|software/i.test(String(renderer.getContext().getParameter(info.UNMASKED_RENDERER_WEBGL)));
}

export async function prepareFramePrograms(renderer, scene, camera, { target, overrides = [], passes = [], timeout = 12000, onProgress } = {}) {
  if (!renderer.extensions.has("KHR_parallel_shader_compile") || softwareRenderer(renderer)) return false;
  const queue = createCompileQueue(renderer, timeout),
    slots = compileSlots();
  await compileSceneInBatches(renderer, scene, camera, target, queue, slots, (done, total) => onProgress?.((0.4 * done) / total));
  const extra = new Set();
  withTarget(renderer, target, () => {
    for (const { material, accept } of overrides) {
      compileAsOverride(renderer, scene, camera, material, accept);
      extra.add(material);
    }
    for (const material of compileShadowCasters(renderer, scene, camera)) extra.add(material);
    for (const material of compileTransmissionBackfaces(renderer, scene, camera)) extra.add(material);
  });
  for (const { material, toScreen = false, prepare } of passes) {
    prepare?.(renderer);
    withTarget(renderer, toScreen ? null : target, () => renderer.compile(new THREE.Mesh(fullscreenGeometry, material), fullscreenCamera));
    extra.add(material);
  }
  queue.add(extra);
  const report = () => onProgress?.(0.4 + 0.6 * (queue.seen ? queue.resolved / queue.seen : 1));
  report();
  return queue.drain(0, report);
}
