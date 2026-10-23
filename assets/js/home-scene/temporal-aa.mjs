import * as THREE from "../three.module.min.js";
import { Pass, FullScreenQuad } from "../vendor/three-r164/postprocessing/Pass.js";
import { stillPhotoJitter } from "./still-photo.mjs";

// Linear HDR history. Geometry motion is generated from two actual poses, not inferred from
// color. Unsupported deformation/transparency is reactive: it receives the current frame only.
const screenVertex = `varying vec2 vUv;
void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
const motionFragment = `varying vec4 temporalCurrentClip, temporalPreviousClip;
varying float temporalPreviousDepth;
uniform float temporalValid;
void main(){
  vec2 now=temporalCurrentClip.xy/temporalCurrentClip.w*.5+.5;
  vec2 before=temporalPreviousClip.xy/temporalPreviousClip.w*.5+.5;
  gl_FragColor=vec4(now-before,temporalPreviousDepth,temporalValid);
}`;
const previousVertex = `
attribute vec3 temporalPreviousPosition;
uniform mat4 temporalPreviousModelView, temporalPreviousProjection;
uniform mat4 temporalPreviousBind, temporalPreviousBindInverse;
uniform sampler2D temporalPreviousBones;
varying vec4 temporalCurrentClip, temporalPreviousClip;
varying float temporalPreviousDepth;
#ifdef USE_SKINNING
mat4 temporalBone(float i){
  int size=textureSize(temporalPreviousBones,0).x;
  int j=int(i)*4, x=j%size, y=j/size;
  return mat4(texelFetch(temporalPreviousBones,ivec2(x,y),0),
              texelFetch(temporalPreviousBones,ivec2(x+1,y),0),
              texelFetch(temporalPreviousBones,ivec2(x+2,y),0),
              texelFetch(temporalPreviousBones,ivec2(x+3,y),0));
}
#endif
`;
const previousProject = `
vec3 temporalPosition=temporalPreviousPosition;
#ifdef USE_SKINNING
  vec4 temporalSkin=temporalPreviousBind*vec4(temporalPosition,1.);
  vec4 temporalSkinned=temporalBone(skinIndex.x)*temporalSkin*skinWeight.x
    +temporalBone(skinIndex.y)*temporalSkin*skinWeight.y
    +temporalBone(skinIndex.z)*temporalSkin*skinWeight.z
    +temporalBone(skinIndex.w)*temporalSkin*skinWeight.w;
  temporalPosition=(temporalPreviousBindInverse*temporalSkinned).xyz;
#endif
vec4 temporalView=temporalPreviousModelView*vec4(temporalPosition,1.);
temporalPreviousClip=temporalPreviousProjection*temporalView;
temporalPreviousDepth=-temporalView.z;
temporalCurrentClip=gl_Position;
`;

export const temporalResolveFragment = `
varying vec2 vUv;
uniform sampler2D currentColor, historyColor, motion, previousDepth;
uniform mat4 previousProjectionInverse;
uniform vec2 texel;
uniform vec2 jitterDelta;
uniform float historyReady, historyWeight;
uniform float stableBackground;
void main(){
  vec4 now=texture2D(currentColor,vUv), mv=texture2D(motion,vUv);
  bool reactiveCenter=mv.b>0. && mv.a<.5;
  // Resolved MSAA coverage can contain a subpixel edge missed by the single-sample
  // motion/depth raster. Dilate the nearest surface velocity into that one-pixel footprint.
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec4 candidate=texture2D(motion,vUv+vec2(float(x),float(y))*texel);
    if(candidate.a>.5 && candidate.b>0. && (mv.b<=0. || candidate.b<mv.b)) mv=candidate;
  }
  vec2 depthBefore=vUv-mv.xy;
  vec2 before=depthBefore+jitterDelta;
  bool background=mv.b<=0. && stableBackground>.5;
  bool valid=historyReady>.5 && !reactiveCenter && (mv.a>.5 || background)
    && all(greaterThanEqual(before,texel*.5)) && all(lessThanEqual(before,vec2(1.)-texel*.5))
    && all(greaterThanEqual(depthBefore,texel*.5)) && all(lessThanEqual(depthBefore,vec2(1.)-texel*.5));
  if(valid){
    float mismatch=1e10;
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
      vec2 depthUv=depthBefore+vec2(float(x),float(y))*texel;
      float z=texture2D(previousDepth,depthUv).x;
      vec4 p=previousProjectionInverse*vec4(depthUv*2.-1.,z*2.-1.,1.);
      float oldDepth=-p.z/p.w;
      if(background && z>=.999999) mismatch=0.;
      if(!background && z<.999999) mismatch=min(mismatch,abs(oldDepth-mv.b));
    }
    valid=mismatch<max(.01,.005*mv.b);
  }
  vec3 lo=now.rgb, hi=now.rgb;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec3 c=texture2D(currentColor,vUv+vec2(float(x),float(y))*texel).rgb;
    lo=min(lo,c); hi=max(hi,c);
  }
  vec3 unbounded=texture2D(historyColor,clamp(before,vec2(0.),vec2(1.))).rgb;
  vec3 old=clamp(unbounded,lo,hi);
  // Rapidly changing lighting/reflections cannot be described by surface velocity alone.
  float contrast=length(unbounded-old)/max(.25,length(now.rgb));
  float weight=valid?historyWeight*(1.-smoothstep(.3,1.2,contrast)):0.;
  gl_FragColor=vec4(mix(now.rgb,old,weight),now.a);
}`;

export function temporalDepthCompatible(expected, observed) {
  return expected > 0 && observed > 0 && Math.abs(expected - observed) < Math.max(0.01, 0.005 * expected);
}

export function createTemporalAA(renderer, scene, { maxPixels = 1100000, historyWeight = 0.875 } = {}) {
  const make = (depth = false) => {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      minFilter: depth ? THREE.NearestFilter : THREE.LinearFilter,
      magFilter: depth ? THREE.NearestFilter : THREE.LinearFilter,
      depthBuffer: depth,
      stencilBuffer: false,
    });
    if (depth) target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    return target;
  };
  const colors = [make(), make()],
    motions = [make(true), make(true)];
  const objects = new Map(),
    geometries = new Map(),
    skeletons = new Map();
  const previousView = new THREE.Matrix4(),
    previousProjection = new THREE.Matrix4();
  const originalProjection = new THREE.Matrix4(),
    originalInverse = new THREE.Matrix4();
  const jitter = stillPhotoJitter(8),
    currentJitter = new THREE.Vector2(),
    previousJitter = new THREE.Vector2();
  const clearColor = new THREE.Color();
  const uniforms = {
    currentColor: { value: null },
    historyColor: { value: colors[0].texture },
    motion: { value: motions[1].texture },
    previousDepth: { value: motions[0].depthTexture },
    previousProjectionInverse: { value: new THREE.Matrix4() },
    texel: { value: new THREE.Vector2(1, 1) },
    jitterDelta: { value: new THREE.Vector2() },
    historyReady: { value: 0 },
    historyWeight: { value: historyWeight },
    stableBackground: { value: 0 },
  };
  const resolve = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: screenVertex,
    fragmentShader: temporalResolveFragment,
    depthTest: false,
    depthWrite: false,
  });
  const copy = new THREE.ShaderMaterial({
    uniforms: { image: { value: null } },
    vertexShader: screenVertex,
    fragmentShader: "varying vec2 vUv; uniform sampler2D image; void main(){gl_FragColor=texture2D(image,vUv);}",
    depthTest: false,
    depthWrite: false,
  });
  const quad = new FullScreenQuad(resolve);
  let width = 1,
    height = 1,
    read = 0,
    frames = 0,
    resets = 0,
    key = null,
    camera = null,
    previousCamera = null;
  let requested = true,
    active = false,
    reason = "first frame",
    geometryBytes = 0,
    boneBytes = 0,
    lastFrameStats = {};
  const pending = [];

  function reset(why = "explicit") {
    frames = 0;
    reason = why;
    resets++;
  }
  function geometryState(geometry) {
    let state = geometries.get(geometry);
    if (!state) {
      const position = geometry.attributes.position;
      // Interleaved attributes are read through accessors; no assumption about their stride.
      const values = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        values[i * 3] = position.getX(i);
        values[i * 3 + 1] = position.getY(i);
        values[i * 3 + 2] = position.getZ(i);
      }
      const attribute = new THREE.BufferAttribute(values, 3).setUsage(THREE.DynamicDrawUsage);
      state = { attribute, version: position.isInterleavedBufferAttribute ? position.data.version : position.version };
      geometry.setAttribute("temporalPreviousPosition", attribute);
      geometries.set(geometry, state);
      geometryBytes += values.byteLength;
    }
    return state;
  }
  function releaseGeometry(geometry, state) {
    if (geometry.attributes.temporalPreviousPosition === state.attribute) {
      // WebGLAttributes owns the auxiliary buffer. Invalidate GPU buffers before removal;
      // a continued beauty draw recreates the original attributes.
      geometry.dispose();
      geometry.deleteAttribute("temporalPreviousPosition");
    }
    geometryBytes -= state.attribute.array.byteLength;
    geometries.delete(geometry);
  }
  function skeletonState(skeleton) {
    let state = skeletons.get(skeleton);
    skeleton.update();
    if (!skeleton.boneTexture) skeleton.computeBoneTexture();
    if (!state) {
      const source = skeleton.boneTexture.image;
      const values = new Float32Array(source.data);
      const texture = new THREE.DataTexture(values, source.width, source.height, THREE.RGBAFormat, THREE.FloatType);
      texture.needsUpdate = true;
      state = { texture, values };
      skeletons.set(skeleton, state);
      boneBytes += values.byteLength;
    }
    return state;
  }
  function motionMaterial(object, source, state) {
    const custom = object.customDepthMaterial;
    const shaderSource = custom?.isShaderMaterial ? custom : source;
    const customShader = shaderSource.isShaderMaterial;
    const primitive = !object.isMesh;
    const reactive =
      source.transparent ||
      source.transmission > 0 ||
      source.opacity < 0.999 ||
      source.displacementMap ||
      object.isInstancedMesh ||
      object.isBatchedMesh ||
      source.isShaderMaterial ||
      Boolean(object.geometry.attributes.coastalPlantWeight) ||
      Boolean(object.geometry.morphAttributes.position?.length) ||
      Boolean(custom) ||
      primitive;
    const material =
      customShader || primitive
        ? shaderSource.clone()
        : new THREE.MeshDepthMaterial({
            map: source.map,
            alphaMap: source.alphaMap,
            alphaTest: source.alphaTest,
            side: source.side,
            displacementMap: source.displacementMap,
            displacementScale: source.displacementScale,
            displacementBias: source.displacementBias,
          });
    if (customShader) material.uniforms = { ...shaderSource.uniforms };
    if (custom && !customShader) {
      material.onBeforeCompile = custom.onBeforeCompile;
    }
    const compile = material.onBeforeCompile;
    const values = {
      temporalPreviousModelView: { value: new THREE.Matrix4() },
      temporalPreviousProjection: { value: previousProjection },
      temporalPreviousBind: { value: state.bind },
      temporalPreviousBindInverse: { value: state.bindInverse },
      temporalPreviousBones: { value: object.isSkinnedMesh ? skeletonState(object.skeleton).texture : null },
      temporalValid: { value: 0 },
    };
    material.transparent = false;
    material.depthWrite = true;
    material.depthTest = true;
    material.blending = THREE.NoBlending;
    material.toneMapped = false;
    material.fog = false;
    material.onBeforeCompile = (shader, activeRenderer) => {
      compile.call(material, shader, activeRenderer);
      Object.assign(shader.uniforms, values);
      if (customShader) {
        shader.vertexShader = "varying vec4 temporalCurrentClip, temporalPreviousClip; varying float temporalPreviousDepth;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          /}\s*$/,
          "temporalCurrentClip=gl_Position; temporalPreviousClip=gl_Position; temporalPreviousDepth=1.;\n}"
        );
      } else {
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\n" + previousVertex)
          .replace("#include <project_vertex>", "#include <project_vertex>\n" + previousProject);
      }
      // Keep cutout coverage, including its exact texture/UV transform.
      shader.fragmentShader =
        customShader || primitive
          ? motionFragment
          : shader.fragmentShader.replace(
              /void main\(\)\s*{[\s\S]*$/,
              `varying vec4 temporalCurrentClip, temporalPreviousClip; varying float temporalPreviousDepth; uniform float temporalValid;
        void main(){
          #include <clipping_planes_fragment>
          vec4 diffuseColor=vec4(1.);
          #include <map_fragment>
          #include <alphamap_fragment>
          #include <alphatest_fragment>
          vec2 now=temporalCurrentClip.xy/temporalCurrentClip.w*.5+.5;
          vec2 before=temporalPreviousClip.xy/temporalPreviousClip.w*.5+.5;
          gl_FragColor=vec4(now-before,temporalPreviousDepth,temporalValid);
        }`
            );
    };
    material.customProgramCacheKey = () =>
      "coastal-temporal-motion-v1:" + Number(customShader) + ":" + Number(primitive) + ":" + (custom?.customProgramCacheKey() || "");
    state.bindings.push({ values, reactive });
    return material;
  }
  function captureMotion() {
    const target = renderer.getRenderTarget(),
      override = scene.overrideMaterial,
      background = scene.background;
    const shadows = renderer.shadowMap.autoUpdate,
      autoClear = renderer.autoClear,
      clearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(clearColor);
    const saved = [],
      seen = new Set();
    let reprojected = 0,
      reactive = 0;
    try {
      scene.updateMatrixWorld(true);
      scene.traverseVisible((object) => {
        if (!object.material) return;
        saved.push([object, object.material, object.visible]);
        if (
          (!object.isMesh && !object.isLine && !object.isPoints) ||
          [object.material].flat().some((m) => m.isRawShaderMaterial) ||
          !object.geometry?.attributes.position
        ) {
          object.visible = false;
          return;
        }
        let state = objects.get(object);
        if (!state || state.source !== object.material || state.geometry !== object.geometry) {
          state?.materials.forEach((m) => m.dispose());
          state = {
            source: object.material,
            geometry: object.geometry,
            model: object.matrixWorld.clone(),
            bindings: [],
            lastSeen: -1,
            bind: object.bindMatrix?.clone() ?? new THREE.Matrix4(),
            bindInverse: object.bindMatrixInverse?.clone() ?? new THREE.Matrix4(),
          };
          geometryState(object.geometry);
          state.materials = [object.material].flat().map((source) => motionMaterial(object, source, state));
          objects.set(object, state);
        }
        seen.add(object);
        pending.push([object, state]);
        for (const binding of state.bindings) {
          binding.values.temporalPreviousModelView.value.multiplyMatrices(previousView, state.model);
          binding.values.temporalValid.value = !binding.reactive && state.lastSeen === frames - 1 && frames > 0 ? 1 : 0;
          if (binding.reactive) reactive++;
          else reprojected++;
        }
        object.material = Array.isArray(state.source) ? state.materials : state.materials[0];
      });
      scene.overrideMaterial = null;
      scene.background = null;
      renderer.shadowMap.autoUpdate = false;
      renderer.autoClear = false;
      renderer.setRenderTarget(motions[1 - read]);
      renderer.setClearColor(0, 0);
      renderer.clear();
      renderer.render(scene, camera);
    } finally {
      for (const [object, material, visible] of saved) {
        object.material = material;
        object.visible = visible;
      }
      scene.overrideMaterial = override;
      scene.background = background;
      renderer.shadowMap.autoUpdate = shadows;
      renderer.autoClear = autoClear;
      renderer.setClearColor(clearColor, clearAlpha);
      renderer.setRenderTarget(target);
    }
    for (const [object, state] of objects)
      if (!seen.has(object)) {
        state.materials.forEach((m) => m.dispose());
        objects.delete(object);
      }
    const liveGeometries = new Set([...seen].map((object) => object.geometry));
    for (const [geometry, state] of geometries) if (!liveGeometries.has(geometry)) releaseGeometry(geometry, state);
    const liveSkeletons = new Set([...seen].filter((object) => object.isSkinnedMesh).map((object) => object.skeleton));
    for (const [skeleton, state] of skeletons)
      if (!liveSkeletons.has(skeleton)) {
        state.texture.dispose();
        boneBytes -= state.values.byteLength;
        skeletons.delete(skeleton);
      }
    lastFrameStats = { reprojectedMaterials: reprojected, reactiveMaterials: reactive };
  }
  class TemporalPass extends Pass {
    render(activeRenderer, writeBuffer, readBuffer) {
      const write = 1 - read;
      uniforms.currentColor.value = readBuffer.texture;
      uniforms.historyColor.value = colors[read].texture;
      uniforms.motion.value = motions[write].texture;
      uniforms.previousDepth.value = motions[read].depthTexture;
      uniforms.previousProjectionInverse.value.copy(previousProjection).invert();
      uniforms.historyReady.value = frames > 0 ? 1 : 0;
      quad.material = resolve;
      activeRenderer.setRenderTarget(colors[write]);
      quad.render(activeRenderer);
      copy.uniforms.image.value = colors[write].texture;
      quad.material = copy;
      // Resolve through an independent history texture, then replace only beauty's color.
      // Keeping the beauty buffer preserves its current depth for the following haze pass.
      activeRenderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
      const autoClear = activeRenderer.autoClear;
      activeRenderer.autoClear = false;
      try {
        quad.render(activeRenderer);
      } finally {
        activeRenderer.autoClear = autoClear;
      }
    }
  }
  const pass = new TemporalPass();
  pass.needsSwap = false;
  pass.enabled = false;
  return {
    pass,
    setEnabled(value) {
      if (requested !== Boolean(value)) {
        requested = Boolean(value);
        reset("mode");
      }
    },
    reset,
    resize(w, h) {
      width = Math.max(1, Math.floor(w));
      height = Math.max(1, Math.floor(h));
      if (width * height <= maxPixels) for (const target of [...colors, ...motions]) target.setSize(width, height);
      else for (const target of [...colors, ...motions]) target.setSize(1, 1);
      uniforms.texel.value.set(1 / width, 1 / height);
      reset("resize");
    },
    begin(activeCamera, stateKey = "") {
      active = requested && width * height <= maxPixels;
      pass.enabled = active;
      if (!active) {
        reason = requested ? "pixel budget" : "disabled";
        return;
      }
      let unsupported = false;
      scene.traverseVisible((object) => {
        if (
          object.material &&
          ((!object.isMesh && !object.isLine && !object.isPoints) ||
            [object.material].flat().some((material) => material.isRawShaderMaterial) ||
            !object.geometry?.attributes.position)
        )
          unsupported = true;
      });
      if (unsupported) {
        active = pass.enabled = false;
        reset("unsupported coverage");
        return;
      }
      camera = activeCamera;
      uniforms.stableBackground.value = Number(Boolean(scene.background?.isColor));
      camera.updateMatrixWorld();
      if (key !== stateKey || previousCamera !== camera) {
        reset("state/camera cut");
        key = stateKey;
        previousCamera = camera;
      }
      if (frames) {
        const oldWorld = new THREE.Matrix4().copy(previousView).invert();
        const distance = new THREE.Vector3()
          .setFromMatrixPosition(oldWorld)
          .distanceTo(new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld));
        const angle = Math.abs(new THREE.Quaternion().setFromRotationMatrix(oldWorld).dot(camera.quaternion));
        if (distance > 2 || angle < 0.7) reset("camera cut");
      }
      originalProjection.copy(camera.projectionMatrix);
      originalInverse.copy(camera.projectionMatrixInverse);
      // Smooth zoom has valid motion vectors through the two projection matrices. Only an
      // abrupt intrinsic cut resets; resetting every spring step would prevent accumulation.
      if (frames && originalProjection.elements.some((v, i) => Math.abs(v - (this.baseProjection?.[i] ?? v)) > Math.max(0.01, Math.abs(v) * 0.25)))
        reset("projection cut");
      this.baseProjection = originalProjection.toArray();
      const [x, y] = jitter[frames % 8];
      camera.projectionMatrix.elements[camera.isPerspectiveCamera ? 8 : 12] += (x * 2) / width;
      camera.projectionMatrix.elements[camera.isPerspectiveCamera ? 9 : 13] += (y * 2) / height;
      currentJitter.set(x / width, y / height).multiplyScalar(camera.isPerspectiveCamera ? -1 : 1);
      if (!frames) previousJitter.copy(currentJitter);
      uniforms.jitterDelta.value.subVectors(currentJitter, previousJitter);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      if (!frames) {
        previousProjection.copy(camera.projectionMatrix);
        previousView.copy(camera.matrixWorldInverse);
      }
      try {
        captureMotion();
      } catch (error) {
        this.end(false);
        throw error;
      }
    },
    end(success = true) {
      if (!active) return;
      try {
        if (success) {
          for (const [object, state] of pending) {
            state.model.copy(object.matrixWorld);
            if (object.isSkinnedMesh) {
              state.bind.copy(object.bindMatrix);
              state.bindInverse.copy(object.bindMatrixInverse);
            }
            state.lastSeen = frames;
          }
          for (const [geometry, state] of geometries) {
            const p = geometry.attributes.position;
            const version = p.isInterleavedBufferAttribute ? p.data.version : p.version;
            if (version !== state.version) {
              for (let i = 0; i < p.count; i++) {
                state.attribute.setXYZ(i, p.getX(i), p.getY(i), p.getZ(i));
              }
              state.attribute.needsUpdate = true;
              state.version = version;
            }
          }
          for (const [skeleton, state] of skeletons) {
            skeleton.update();
            state.values.set(skeleton.boneTexture.image.data);
            state.texture.needsUpdate = true;
          }
          previousProjection.copy(camera.projectionMatrix);
          previousView.copy(camera.matrixWorldInverse);
          previousJitter.copy(currentJitter);
          read = 1 - read;
          frames++;
        } else reset("failed frame");
      } finally {
        pending.length = 0;
        camera.projectionMatrix.copy(originalProjection);
        camera.projectionMatrixInverse.copy(originalInverse);
        active = false;
      }
    },
    get evidence() {
      return {
        method: "jittered HDR history / geometry velocity / depth rejection / neighborhood clamp",
        frames,
        resets,
        reason,
        width,
        height,
        maxPixels,
        requested,
        active: pass.enabled,
        targetBytes: width * height <= maxPixels ? width * height * 40 : 40,
        geometryHistoryBytes: geometryBytes,
        boneHistoryBytes: boneBytes,
        ...lastFrameStats,
        reactive: "transparent, shader-deformed, instanced, morphed and custom-depth materials",
        movingSkinning: true,
        cpuPositionHistory: true,
      };
    },
    sampleMotion(x, y) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) throw new RangeError("Invalid motion pixel");
      const values = new Uint16Array(4);
      renderer.readRenderTargetPixels(motions[read], x, y, 1, 1, values);
      return Array.from(values, THREE.DataUtils.fromHalfFloat);
    },
    dispose() {
      for (const target of [...colors, ...motions]) target.dispose();
      for (const state of objects.values()) state.materials.forEach((m) => m.dispose());
      for (const [geometry, state] of geometries) releaseGeometry(geometry, state);
      for (const state of skeletons.values()) state.texture.dispose();
      objects.clear();
      geometries.clear();
      skeletons.clear();
      resolve.dispose();
      copy.dispose();
      quad.dispose();
    },
  };
}
