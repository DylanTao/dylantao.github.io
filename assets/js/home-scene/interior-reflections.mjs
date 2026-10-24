import * as THREE from "../three.module.min.js";

const MIRROR = "bathroom satin mirror";
const FRAME_INTERVAL = 1000 / 15;
const BLACK = new THREE.Color(0, 0, 0);

// The authored thin mirror boxes face +X. Use their delivered world-space front face, rather
// than an approximate room centre or a probe position that loses nearby-wall parallax.
export function mirrorPlane(mesh) {
  const bounds = new THREE.Box3().setFromObject(mesh);
  return new THREE.Plane(new THREE.Vector3(1, 0, 0), -bounds.max.x);
}

export function reflectInteriorCamera(camera, plane, reflected = new THREE.PerspectiveCamera()) {
  camera.updateMatrixWorld(true);
  const eye = camera.getWorldPosition(new THREE.Vector3());
  if (plane.distanceToPoint(eye) <= 0.005) return null;
  reflected.copy(camera);
  reflected.position.copy(eye).addScaledVector(plane.normal, -2 * plane.distanceToPoint(eye));
  const direction = camera.getWorldDirection(new THREE.Vector3()).reflect(plane.normal);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion())).reflect(plane.normal);
  reflected.up.copy(up);
  reflected.lookAt(reflected.position.clone().add(direction));
  reflected.far = Math.min(camera.far, 12);
  reflected.updateProjectionMatrix();
  reflected.updateMatrixWorld(true);
  const projection = new THREE.Matrix4()
    .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
    .multiply(reflected.projectionMatrix)
    .multiply(reflected.matrixWorldInverse);
  // Oblique near-plane clipping is the same construction as the existing sea reflection,
  // applied to the actual vertical mirror plane. Geometry behind the mirror cannot leak in.
  const viewPlane = plane.clone().applyMatrix4(reflected.matrixWorldInverse);
  const clip = new THREE.Vector4(...viewPlane.normal, viewPlane.constant);
  const p = reflected.projectionMatrix.elements;
  const q = new THREE.Vector4((Math.sign(clip.x) + p[8]) / p[0], (Math.sign(clip.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
  clip.multiplyScalar(2 / clip.dot(q));
  p[2] = clip.x;
  p[6] = clip.y;
  p[10] = clip.z + 1 - 0.0005;
  p[14] = clip.w;
  reflected.projectionMatrixInverse.copy(reflected.projectionMatrix).invert();
  return { camera: reflected, projection };
}

export function createInteriorReflections({ renderer, scene, world, shell, rooms, compact = false, withoutContact = (draw) => draw() }) {
  const size = compact ? 128 : 256;
  const target = new THREE.WebGLRenderTarget(size, size, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const reflected = new THREE.PerspectiveCamera();
  const mirrors = new Map();
  const materialBindings = [];
  let disposed = false;
  let prepared = false;
  let captures = 0;
  let milliseconds = 0;
  let capturedId = null;
  let capturedAt = -Infinity;
  let capturedLight = null;
  let latestLevels = "";
  let lastPose = null;
  let observed = null;

  for (const [id, root] of rooms) {
    root.traverse((mesh) => {
      if (!mesh.isMesh || ![mesh.userData.baseMaterial || mesh.material].flat().some((material) => material?.name === MIRROR)) return;
      const uniforms = { indoorMirror: { value: target.texture }, indoorProjection: { value: new THREE.Matrix4() }, indoorActive: { value: 0 } };
      const record = { id, root, mesh, plane: mirrorPlane(mesh), uniforms };
      mirrors.set(id, record);
      const materials = new Set([mesh.material, mesh.userData.styleMaterials?.realistic].flat().filter(Boolean));
      for (const material of materials) {
        if (!material.isMeshStandardMaterial || material.name !== MIRROR) continue;
        const compile = material.onBeforeCompile;
        const cache = material.customProgramCacheKey;
        const environment = material.envMapIntensity;
        const hook = function (shader, renderer) {
          compile.call(this, shader, renderer);
          Object.assign(shader.uniforms, uniforms);
          shader.vertexShader = "uniform mat4 indoorProjection; varying vec4 indoorPoint;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <project_vertex>",
            "#include <project_vertex>\nindoorPoint=indoorProjection*modelMatrix*vec4(transformed,1.0);"
          );
          shader.fragmentShader = "uniform sampler2D indoorMirror; uniform float indoorActive; varying vec4 indoorPoint;\n" + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <lights_fragment_end>",
            `#include <lights_fragment_end>
            vec2 indoorUv=indoorPoint.xy/max(indoorPoint.w,1e-6);
            float indoorInside=step(0.0,indoorPoint.w)*step(0.0,indoorUv.x)*step(indoorUv.x,1.0)*step(0.0,indoorUv.y)*step(indoorUv.y,1.0);
            vec3 indoorRadiance=texture2D(indoorMirror,clamp(indoorUv,0.0,1.0)).rgb;
            vec3 indoorFresnel=F_Schlick(material.specularColor,material.specularF90,max(dot(normal,normalize(vViewPosition)),0.0));
            reflectedLight.indirectSpecular=indoorRadiance*indoorFresnel*indoorActive*indoorInside;`
          );
        };
        material.onBeforeCompile = hook;
        material.customProgramCacheKey = function () {
          return `${cache.call(this)}|indoor-planar-mirror-v1`;
        };
        material.envMapIntensity = 0;
        material.needsUpdate = true;
        materialBindings.push({ material, compile, cache, environment, hook });
      }
    });
  }

  // Every temporary mutation, including an aborted asynchronous warmup, uses this custody.
  async function inRoomAsync(record, draw) {
    const restore = captureState(record);
    try {
      return await draw();
    } finally {
      restore();
    }
  }
  function inRoom(record, draw) {
    const restore = captureState(record);
    try {
      return draw();
    } finally {
      restore();
    }
  }
  function captureState(record) {
    const visibility = new Map();
    const remember = (object, visible) => {
      if (!visibility.has(object)) visibility.set(object, object.visible);
      object.visible = visible;
    };
    const state = {
      target: renderer.getRenderTarget(),
      shadowAuto: renderer.shadowMap.autoUpdate,
      shadowNeeds: renderer.shadowMap.needsUpdate,
      toneMapping: renderer.toneMapping,
      autoClear: renderer.autoClear,
      xr: renderer.xr?.enabled,
      background: scene.background,
      viewport: renderer.getViewport?.(new THREE.Vector4()),
      scissor: renderer.getScissor?.(new THREE.Vector4()),
      scissorTest: renderer.getScissorTest?.(),
    };
    for (const child of scene.children) {
      let hasLight = false;
      child.traverse((object) => (hasLight ||= Boolean(object.isLight)));
      if (child !== world && !hasLight) remember(child, false);
    }
    for (const child of world.children) remember(child, child === shell || child === record.root);
    shell.traverse((object) => {
      if (object.userData.caveRoof || object.userData.bathroomCeilingFor) remember(object, true);
    });
    for (const { mesh } of mirrors.values()) remember(mesh, false);
    renderer.shadowMap.autoUpdate = renderer.shadowMap.needsUpdate = false;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = true;
    if (renderer.xr) renderer.xr.enabled = false;
    scene.background = BLACK;
    renderer.setRenderTarget(target);
    renderer.setScissorTest?.(false);
    return () => {
      for (const [object, visible] of visibility) object.visible = visible;
      scene.background = state.background;
      renderer.shadowMap.autoUpdate = state.shadowAuto;
      renderer.shadowMap.needsUpdate = state.shadowNeeds;
      renderer.toneMapping = state.toneMapping;
      renderer.autoClear = state.autoClear;
      if (renderer.xr) renderer.xr.enabled = state.xr;
      renderer.setRenderTarget(state.target);
      if (state.viewport) renderer.setViewport(state.viewport);
      if (state.scissor) renderer.setScissor(state.scissor);
      if (state.scissorTest !== undefined) renderer.setScissorTest(state.scissorTest);
    };
  }

  function bind(levels) {
    if (levels) latestLevels = JSON.stringify(Object.entries(levels).sort(([a], [b]) => a.localeCompare(b)));
    for (const { material } of materialBindings) material.envMapIntensity = 0;
  }
  async function prepare({
    camera = new THREE.PerspectiveCamera(54, 1, 0.05, 12),
    lightRoom = () => {},
    restoreLight = () => {},
    shouldContinue = () => true,
  } = {}) {
    if (prepared || disposed) return;
    const start = performance.now();
    try {
      for (const record of mirrors.values()) {
        if (disposed || !shouldContinue()) return;
        lightRoom(record.id);
        const view = reflectInteriorCamera(camera, record.plane, reflected);
        if (!view) continue;
        await inRoomAsync(record, async () => {
          renderer.clear();
          await renderer.compileAsync(scene, view.camera);
        });
      }
      prepared = !disposed && shouldContinue();
    } finally {
      restoreLight();
      milliseconds += performance.now() - start;
    }
  }
  function update(camera, { room, levels, lightKey = "", now = performance.now() } = {}) {
    if (disposed) return false;
    bind(levels);
    for (const record of mirrors.values()) record.uniforms.indoorActive.value = 0;
    const record = mirrors.get(room);
    if (!record || !camera?.isPerspectiveCamera) {
      observed = null;
      return false;
    }
    camera.updateMatrixWorld(true);
    const position = camera.getWorldPosition(new THREE.Vector3());
    const rotation = camera.getWorldQuaternion(new THREE.Quaternion());
    const projection = camera.projectionMatrix.elements;
    const light = `${latestLevels}|${lightKey}`;
    const projectionChanged = !lastPose || projection.some((value, i) => Math.abs(value - lastPose.projection[i]) > 1e-6);
    const shift = lastPose ? position.distanceTo(lastPose.position) : Infinity;
    const turn = lastPose ? rotation.angleTo(lastPose.rotation) : Infinity;
    const sameRoom = observed?.room === room;
    const jumpShift = sameRoom ? position.distanceTo(observed.position) : Infinity;
    const jumpTurn = sameRoom ? rotation.angleTo(observed.rotation) : Infinity;
    const lensJump =
      !sameRoom ||
      Math.abs(camera.aspect - observed.aspect) > 1e-4 ||
      Math.abs(camera.fov - observed.fov) > 8 ||
      Math.abs(camera.zoom / observed.zoom - 1) > 0.1;
    const changed = capturedId !== room || light !== capturedLight || projectionChanged || shift > 1e-5 || turn > 1e-5;
    const immediate = capturedId !== room || light !== capturedLight || lensJump || jumpShift > 0.3 || jumpTurn > 0.12;
    observed = { room, position: position.clone(), rotation: rotation.clone(), aspect: camera.aspect, fov: camera.fov, zoom: camera.zoom };
    let captured = false;
    if (changed && (immediate || now - capturedAt >= FRAME_INTERVAL)) {
      const view = reflectInteriorCamera(camera, record.plane, reflected);
      if (!view) return false;
      const start = performance.now();
      record.uniforms.indoorProjection.value.copy(view.projection);
      inRoom(record, () =>
        withoutContact(() => {
          renderer.clear();
          renderer.render(scene, view.camera);
        })
      );
      capturedId = room;
      capturedAt = now;
      capturedLight = light;
      lastPose = { position, rotation, projection: [...projection] };
      captures++;
      captured = true;
      milliseconds += performance.now() - start;
    }
    record.uniforms.indoorActive.value = capturedId === room ? 1 : 0;
    return captured;
  }
  return {
    prepare,
    update,
    bind,
    evidence: () => ({
      method: "bounded planar room reflections",
      rooms: [...mirrors.keys()],
      size,
      sharedTargets: 1,
      maximumHz: 15,
      captures,
      capturedRoom: capturedId,
      milliseconds,
      prepared,
    }),
    dispose() {
      disposed = true;
      for (const record of mirrors.values()) record.uniforms.indoorActive.value = 0;
      for (const { material, compile, cache, environment, hook } of materialBindings) {
        if (material.onBeforeCompile === hook) {
          material.onBeforeCompile = compile;
          material.customProgramCacheKey = cache;
          material.envMapIntensity = environment;
          material.needsUpdate = true;
        }
      }
      target.dispose();
    },
  };
}
