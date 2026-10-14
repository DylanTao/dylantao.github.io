import * as THREE from "../three.module.min.js";
import { EffectComposer } from "../vendor/three-r164/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/three-r164/postprocessing/RenderPass.js";
import { SSAOPass } from "../vendor/three-r164/postprocessing/SSAOPass.js";
import { OutputPass } from "../vendor/three-r164/postprocessing/OutputPass.js";
import { CONTACT_RADIUS, CONTACT_SLICES, CONTACT_STEPS, horizonFragment, bilateralFragment, bindContactLighting } from "./contact-occlusion.mjs";
import { createGpuTimer } from "./gpu-timer.mjs";
import { createVolumeDepth } from "./volume-depth.mjs";

// Physical scale survives batching and the many different UV layouts in glTF.
// No scenic image, texture download, or screen-space grain is involved.
export const surfaceNoise = `
float hash31(vec3 p) {
  p = fract(p * .1031); p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float grainNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i), hash31(i+vec3(1,0,0)), f.x),
                 mix(hash31(i+vec3(0,1,0)), hash31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i+vec3(0,0,1)), hash31(i+vec3(1,0,1)), f.x),
                 mix(hash31(i+vec3(0,1,1)), hash31(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float stoneNoise(vec3 p) {
  return grainNoise(p)*.57 + grainNoise(p*2.03)*.28 + grainNoise(p*4.17)*.15;
}
`;

export const physicalTime = { value: 0 };

// Look-lab surface options (look.mjs), set before any room loads; the shipped look turns sheen on.
export const surfaceLook = { sheen: false };

// Hair reads as hair through its highlights. Light leaving a strand's cuticle forms a cone around
// the strand, so the highlight is a band running across the strands (Kajiya & Kay, SIGGRAPH 1989):
// a near-white primary shifted toward the tips and a broader, hair-tinted secondary shifted toward
// the roots (the R and TRT lobes of Marschner et al., SIGGRAPH 2003, in Scheuermann's GDC 2004
// real-time form). The avatars carry no strand tangents, so each strand is combed from the crown of
// the hair mesh's bind pose along the surface and skinned with the normal. Direct light only; the
// lobes ride Three's per-light loop, so shadows and every lamp apply.
function strandHighlights(material, mesh) {
  const box = new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position);
  const crown = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
  const span = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z, 1e-3);
  const compile = material.onBeforeCompile,
    cacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.uniforms.hairCrown = { value: crown };
    shader.uniforms.hairSpan = { value: span };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform vec3 hairCrown;\nvarying vec3 hairStrand;\nvarying vec3 hairPoint;")
      .replace(
        "#include <skinnormal_vertex>",
        `vec3 hairComb = position - hairCrown;
        hairComb -= dot(hairComb, normal) * normal;
        #include <skinnormal_vertex>
        #ifdef USE_SKINNING
          hairComb = (skinMatrix * vec4(hairComb, 0.0)).xyz;
        #endif
        hairStrand = normalMatrix * hairComb;
        hairPoint = position;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float hairSpan;
        varying vec3 hairStrand;
        varying vec3 hairPoint;
        float hairHash(vec3 p) {
          p = fract(p * .1031); p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }
        float hairNoise(vec3 p) {
          vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
          return mix(mix(mix(hairHash(i), hairHash(i + vec3(1, 0, 0)), f.x), mix(hairHash(i + vec3(0, 1, 0)), hairHash(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(hairHash(i + vec3(0, 0, 1)), hairHash(i + vec3(1, 0, 1)), f.x), mix(hairHash(i + vec3(0, 1, 1)), hairHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }`
      )
      .replace(
        "#include <lights_physical_pars_fragment>",
        `#include <lights_physical_pars_fragment>
        // The hairline's fine modeled detail turns the strand direction faster than a pixel, which
        // sparkled. The lobe widens by the normal's variance across the pixel and keeps its energy
        // (geometric specular antialiasing: Kaplanyan et al. 2016, Tokuyoshi & Kaplanyan 2019).
        float hairKernel;
        float hairLobe(vec3 T, vec3 H, float exponent) {
          float TdotH = dot(T, H);
          float widened = max(2.0, 2.0 / (2.0 / (exponent + 2.0) + hairKernel) - 2.0);
          return smoothstep(-1.0, 0.0, TdotH) * pow(sqrt(max(0.0, 1.0 - TdotH * TdotH)), widened) * (widened + 2.0) / (exponent + 2.0);
        }
        void RE_Direct_Hair(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
          RE_Direct_Physical(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
          vec3 T = hairStrand - dot(hairStrand, geometryNormal) * geometryNormal;
          float strandLength = length(T);
          if (strandLength < 1e-6) return;
          T /= strandLength;
          // Clumps of strands shift the band a little: slow along a strand, faster across.
          vec3 q = hairPoint / hairSpan;
          float clump = hairNoise(vec3(q.x * 34.0, q.y * 3.0, q.z * 34.0));
          float shift = (clump - 0.5) * 0.24;
          vec3 H = normalize(directLight.direction + geometryViewDir);
          float primary = hairLobe(normalize(T + geometryNormal * (0.08 + shift)), H, 72.0);
          float secondary = hairLobe(normalize(T + geometryNormal * (-0.12 + shift)), H, 16.0) * smoothstep(0.25, 0.75, clump);
          float facing = smoothstep(0.0, 0.4, dot(geometryNormal, directLight.direction));
          vec3 tint = material.diffuseColor / max(1e-3, max(material.diffuseColor.r, max(material.diffuseColor.g, material.diffuseColor.b)));
          reflectedLight.directSpecular += directLight.color * facing * (0.1 * primary + 0.06 * secondary * mix(vec3(1.0), tint, 0.75));
        }
        #undef RE_Direct
        #define RE_Direct RE_Direct_Hair`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec3 hairDx = dFdx(normal), hairDy = dFdy(normal);
        hairKernel = min(0.5 * (dot(hairDx, hairDx) + dot(hairDy, hairDy)), 0.18);`
      );
  };
  material.customProgramCacheKey = () => `${cacheKey}|strand-highlights-v1`;
  material.needsUpdate = true;
  return material;
}

// A woven fabric with a sheen lobe: Three's physical shader adds the "Charlie" sheen of Estevez and
// Kulla (SIGGRAPH 2017 course), a soft rim of retroreflection that cloth fibers show at grazing angles.
// Everything else matches the standard material it replaces (IOR 1.5 gives the same 4% specular).
function sheenFabric(source) {
  const m = new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(m, source);
  m.defines = { STANDARD: "", PHYSICAL: "" };
  m.sheen = 1;
  m.sheenRoughness = 0.62;
  m.sheenColor.copy(source.color).lerp(new THREE.Color(1, 1, 1), 0.35);
  return m;
}

export function finishPhysicalMaterial(source, mesh, contactLighting) {
  const name = source.name;
  const m =
    /water|turquoise/i.test(name) && !mesh.isSkinnedMesh
      ? new THREE.MeshPhysicalMaterial({
          name,
          color: 0xffffff,
          roughness: 0.065,
          metalness: 0,
          ior: 1.333,
          transmission: 0.86,
          thickness: 0.24,
          attenuationColor: new THREE.Color(0x93c8c1),
          attenuationDistance: 1.5,
        })
      : name === "coffee hopper glass" && !mesh.isSkinnedMesh
        ? new THREE.MeshPhysicalMaterial({
            name,
            color: 0xffffff,
            roughness: source.roughness,
            metalness: 0,
            ior: 1.5,
            transmission: 0.96,
            thickness: 0.008,
            attenuationColor: source.color.clone(),
            attenuationDistance: 2,
            side: source.side,
          })
        : surfaceLook.sheen && !mesh.isSkinnedMesh && /linen|textile|cotton|woven/i.test(name)
          ? sheenFabric(source)
          : source.clone();
  if (mesh.isSkinnedMesh) {
    m.roughness = /hair/i.test(name) ? 0.7 : /skin/i.test(name) ? 0.68 : 0.9;
    m.envMapIntensity = /hair/i.test(name) ? 0.28 : 0.5;
    if (name === "Sirui shirt") {
      m.onBeforeCompile = (shader) => {
        shader.vertexShader = "varying vec3 clothPoint;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\nclothPoint = position;");
        shader.fragmentShader = "varying vec3 clothPoint;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float clothFootprint=max(length(dFdx(clothPoint)),length(dFdy(clothPoint)));
          float clothFilter=exp(-.5*pow(clothFootprint*480.,2.));
          float clothWeave=sin(clothPoint.x*480.)*sin((clothPoint.y+clothPoint.z)*480.);
          diffuseColor.rgb *= .96+.04*clothWeave*clothFilter;`
        );
      };
      m.customProgramCacheKey = () => "coastal-woven-garment-v1";
    }
    if (/hair/i.test(name)) strandHighlights(m, mesh);
    return bindContactLighting(m, contactLighting);
  }
  if (/leaf|foliage/i.test(name)) {
    m.side = THREE.DoubleSide;
    m.roughness = 0.56;
    m.envMapIntensity = 0.6;
    return bindContactLighting(m, contactLighting);
  }
  if (name === "coffee hopper glass") {
    // Raster transmission uses an illustrative local pane thickness. It does
    // not solve paths through the actual hollow hopper or multiple interfaces.
    m.envMapIntensity = 0.7;
    mesh.castShadow = false;
    mesh.userData.noContactOcclusion = true;
    return bindContactLighting(m, contactLighting);
  }
  const wood = /wood|oak|ash|walnut/i.test(name);
  const cloth = /linen|textile|cotton|trousers|woven/i.test(name);
  const rock = /sandstone|sediment|limestone|stone|sand|plaster/i.test(name);
  const water = /water|turquoise/i.test(name);
  if (water) {
    m.envMapIntensity = 1.2;
    return bindContactLighting(m, contactLighting);
  }
  m.roughness = wood ? 0.48 : cloth ? 0.96 : rock ? 0.89 : m.roughness;
  m.envMapIntensity = cloth ? 0.35 : 0.7;
  if (!wood && !cloth && !rock) return bindContactLighting(m, contactLighting);
  const kind = wood ? 1 : cloth ? 2 : /sandstone|sediment/i.test(name) ? 3 : /beach|tideline/i.test(name) ? 4 : 0;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec3 surfacePoint;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\nsurfacePoint = (modelMatrix * vec4(transformed, 1.0)).xyz;"
    );
    shader.fragmentShader = `varying vec3 surfacePoint;\n${surfaceNoise}\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      #include <color_fragment>
      vec3 p = surfacePoint;
      float detail = stoneNoise(p * 3.2);
      float pores = grainNoise(p * 95.0);
      float pigment = 1.0;
      ${
        kind === 1
          ? `
        float warp = stoneNoise(vec3(p.x*1.6, p.y*2.0, p.z*.38));
        float growth = sin(p.x*115.0 + warp*23.0 + sin(p.z*.9)*1.2);
        float fibers = grainNoise(vec3(p.x*330.0,p.y*180.0,p.z*5.0));
        float grainFade = 1.-smoothstep(.003,.025,max(length(dFdx(p)),length(dFdy(p))));
        pigment = .86 + .025*growth*grainFade + .07*fibers*grainFade + .08*warp;
        diffuseColor.rgb *= pigment;
      `
          : kind === 2
            ? `
        float weave = sin(p.x*590.0) * sin(p.z*590.0 + p.y*590.0);
        float weaveFootprint=max(length(dFdx(p)),length(dFdy(p)));
        float weaveFilter=exp(-.5*pow(weaveFootprint*590.,2.));
        diffuseColor.rgb *= .90 + .07*weave*weaveFilter + .10*pores;
      `
            : kind === 3
              ? `
        float layers = stoneNoise(vec3(p.x*.45, p.y*9.0 + detail*1.8, p.z*.45));
        float erosion = stoneNoise(vec3(p.x*2.0,p.y*.30,p.z*2.0));
        pigment = .89 + .10*detail + .07*layers;
        diffuseColor.rgb *= pigment;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.06,.96,.84), smoothstep(.5,.85,erosion)*.18);
      `
              : kind === 4
                ? `
        float wetSand = 1.0-smoothstep(-7.30,-7.03,p.y + (detail-.5)*.045);
        diffuseColor.rgb = mix(vec3(.76,.64,.45),vec3(.43,.37,.27),wetSand);
        diffuseColor.rgb *= .92 + .08*detail + .025*pores;
      `
                : `diffuseColor.rgb *= .86 + .20*detail + .045*pores;`
      }
    `
    );
    if (kind === 4)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(.96,.34,1.0-smoothstep(-7.30,-7.03,surfacePoint.y));"
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
      #include <normal_fragment_maps>
      // Derivative bump mapping on the actual surface; filtered below a pixel.
      float footprint = max(length(dFdx(surfacePoint)), length(dFdy(surfacePoint)));
      float detailFade = 1.0-smoothstep(.025,.12,footprint);
      float height = detailFade * ${kind === 1 ? "grainNoise(vec3(surfacePoint.x*95.0,surfacePoint.y*24.0,surfacePoint.z*2.5)) * .0007" : kind === 2 ? "grainNoise(surfacePoint*140.0)*.0004" : kind === 3 ? "stoneNoise(surfacePoint*3.0)*.022" : "stoneNoise(surfacePoint*32.0)*.001"};
      vec3 eyeX = dFdx(-vViewPosition), eyeY = dFdy(-vViewPosition);
      vec3 r1 = cross(eyeY, normal), r2 = cross(normal, eyeX);
      float det = dot(eyeX, r1);
      vec3 gradient = sign(det) * (dFdx(height)*r1 + dFdy(height)*r2);
      normal = normalize(abs(det)*normal - gradient);
    `
    );
  };
  m.customProgramCacheKey = () => `coastal-physical-${kind}`;
  return bindContactLighting(m, contactLighting);
}

// The transparent footer retains its existing pipeline. It has its own scene,
// authored fade and budget; this room-lighting change does not modify it.
export function createLegacyFinish(renderer, scene, camera, { transparentOutput = false } = {}) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const beauty = new RenderPass(scene, camera);
  const contact = new SSAOPass(scene, camera, 1, 1, 16);
  contact.kernelRadius = 0.34;
  contact.minDistance = 0.00015;
  contact.maxDistance = 0.016;
  const saveVisibility = contact.overrideVisibility.bind(contact);
  const renderContact = contact.render.bind(contact);
  contact.render = (activeRenderer, ...buffers) => {
    const updateShadows = activeRenderer.shadowMap.autoUpdate;
    activeRenderer.shadowMap.autoUpdate = false;
    try {
      renderContact(activeRenderer, ...buffers);
    } finally {
      activeRenderer.shadowMap.autoUpdate = updateShadows;
    }
  };
  contact.overrideVisibility = () => {
    saveVisibility();
    scene.traverse((object) => {
      if (object.userData.noOcclusion) {
        contact._visibilityCache.set(object, object.visible);
        object.visible = false;
      }
    });
  };
  // Ambient contact, not a dark halo around every object.
  contact.ssaoMaterial.fragmentShader = contact.ssaoMaterial.fragmentShader.replace("1.0 - occlusion", "1.0 - occlusion * 0.65");
  const output = new OutputPass();
  if (transparentOutput) {
    // Tone-map straight color, then premultiply again for the transparent page
    // canvas. Applying the transfer curve to premultiplied foam creates a neon
    // fringe where the coastline fades into paper.
    output.material.fragmentShader = output.material.fragmentShader
      .replace("// tone mapping", "gl_FragColor.rgb /= max(gl_FragColor.a, 0.00001);\n// tone mapping")
      .replace(/\}\s*$/, "gl_FragColor.rgb *= gl_FragColor.a;\n}");
  }
  composer.addPass(beauty);
  composer.addPass(contact);
  composer.addPass(output);
  let width = 1,
    height = 1;
  return {
    resize(w, h) {
      width = w;
      height = h;
      composer.setSize(w, h);
      // A bounded AO buffer is sufficient for soft contact at widget scale.
      const scale = Math.min(1, 480 / Math.max(w, h));
      contact.setSize(Math.round(w * scale), Math.round(h * scale));
    },
    render(activeCamera, exterior) {
      beauty.camera = contact.camera = activeCamera;
      contact.enabled = !exterior;
      contact.kernelRadius = 0.28;
      contact.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(activeCamera.projectionMatrix);
      contact.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(activeCamera.projectionMatrixInverse);
      composer.render();
    },
    get evidence() {
      return { contactShadows: true, samples: 16, aoWidth: contact.width, aoHeight: contact.height, width, height };
    },
    dispose() {
      beauty.dispose();
      contact.dispose();
      output.dispose();
      composer.dispose();
      // r164's upstream dispose omits these two allocations.
      contact.ssaoMaterial.dispose();
      contact.noiseTexture.dispose();
    },
  };
}

// OutputPass rebuilds its defines on its first draw; doing the same beforehand lets its program
// compile with the rest (program-warmup.mjs). Mirrors OutputPass.render for this pipeline's modes.
function syncOutputDefines(pass, activeRenderer) {
  if (pass._outputColorSpace === activeRenderer.outputColorSpace && pass._toneMapping === activeRenderer.toneMapping) return;
  const toneMappingDefines = {
    [THREE.LinearToneMapping]: "LINEAR_TONE_MAPPING",
    [THREE.ReinhardToneMapping]: "REINHARD_TONE_MAPPING",
    [THREE.CineonToneMapping]: "CINEON_TONE_MAPPING",
    [THREE.ACESFilmicToneMapping]: "ACES_FILMIC_TONE_MAPPING",
    [THREE.AgXToneMapping]: "AGX_TONE_MAPPING",
    [THREE.NeutralToneMapping]: "NEUTRAL_TONE_MAPPING",
  };
  pass._outputColorSpace = activeRenderer.outputColorSpace;
  pass._toneMapping = activeRenderer.toneMapping;
  pass.material.defines = {};
  if (THREE.ColorManagement.getTransfer(pass._outputColorSpace) === THREE.SRGBTransfer) pass.material.defines.SRGB_TRANSFER = "";
  if (toneMappingDefines[pass._toneMapping]) pass.material.defines[toneMappingDefines[pass._toneMapping]] = "";
  pass.material.needsUpdate = true;
}

// `bloom` (look lab) is { Pass, strength, radius, threshold }, with Pass the vendored UnrealBloomPass
// loaded on demand; it glows only HDR highlights above the threshold, before tone mapping.
export function createFinish(renderer, scene, camera, { transparentOutput = false, profileGPU = false, bloom: bloomLook = null } = {}) {
  if (transparentOutput) return createLegacyFinish(renderer, scene, camera, { transparentOutput });
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const beauty = new RenderPass(scene, camera),
    contact = new SSAOPass(scene, camera, 1, 1, 1),
    output = new OutputPass(),
    bloom = bloomLook ? new bloomLook.Pass(new THREE.Vector2(1, 1), bloomLook.strength, bloomLook.radius, bloomLook.threshold) : null,
    gpuTimer = createGpuTimer(renderer.getContext(), profileGPU),
    volumeDepth = createVolumeDepth(renderer, scene);
  let volume;
  const lighting = {
    contactTexture: { value: contact.blurRenderTarget.texture },
    contactResolution: { value: new THREE.Vector2(1, 1) },
    contactEnabled: { value: true },
  };
  contact.ssaoMaterial.fragmentShader = horizonFragment;
  contact.ssaoMaterial.uniforms.kernelRadius.value = CONTACT_RADIUS;
  contact.blurMaterial.fragmentShader = bilateralFragment;
  Object.assign(contact.blurMaterial.uniforms, {
    tDepth: { value: contact.normalRenderTarget.depthTexture },
    tNormal: { value: contact.normalRenderTarget.texture },
    cameraInverseProjectionMatrix: { value: camera.projectionMatrixInverse.clone() },
  });
  // This pass produces only a visibility texture. Beauty materials consume it
  // before tone mapping; it never multiplies sunlight, emission or reflection.
  contact.needsSwap = false;
  contact.render = (activeRenderer) => {
    const updateShadows = activeRenderer.shadowMap.autoUpdate,
      overrideMaterial = scene.overrideMaterial;
    activeRenderer.shadowMap.autoUpdate = false;
    contact.overrideVisibility();
    scene.traverse((object) => {
      if (object.userData.noOcclusion || object.userData.noContactOcclusion) object.visible = false;
    });
    try {
      contact.renderOverride(activeRenderer, contact.normalMaterial, contact.normalRenderTarget, 0x7777ff, 1);
      contact.renderPass(activeRenderer, contact.ssaoMaterial, contact.ssaoRenderTarget);
      contact.renderPass(activeRenderer, contact.blurMaterial, contact.blurRenderTarget);
    } finally {
      scene.overrideMaterial = overrideMaterial;
      contact.restoreVisibility();
      activeRenderer.shadowMap.autoUpdate = updateShadows;
    }
  };
  composer.addPass(contact);
  composer.addPass(beauty);
  if (bloom) composer.addPass(bloom);
  composer.addPass(output);
  let width = 1,
    height = 1;
  return {
    contactLighting: lighting,
    // Programs this pipeline draws beyond the scene's own materials (program-warmup.mjs): the
    // contact pass's normal override on every occluding mesh, and its two full-screen passes.
    programWarmup: {
      overrides: [{ material: contact.normalMaterial, accept: (object) => !object.userData.noOcclusion && !object.userData.noContactOcclusion }],
      passes: [
        { material: contact.ssaoMaterial },
        { material: contact.blurMaterial },
        ...(bloom
          ? [bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial].map((material) => ({
              material,
            }))
          : []),
        { material: output.material, toScreen: true, prepare: (activeRenderer) => syncOutputDefines(output, activeRenderer) },
      ],
    },
    setVolume(next) {
      volume = next;
    },
    resize(w, h) {
      width = w;
      height = h;
      composer.setSize(w, h);
      volumeDepth.resize(composer.renderTarget1.width, composer.renderTarget1.height);
      lighting.contactResolution.value.set(Math.floor(composer.renderTarget1.width), Math.floor(composer.renderTarget1.height));
      const scale = Math.min(1, 480 / Math.max(w, h));
      contact.setSize(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
    },
    render(activeCamera, exterior) {
      beauty.camera = contact.camera = activeCamera;
      lighting.contactEnabled.value = contact.enabled = !exterior;
      const perspective = activeCamera.isPerspectiveCamera ? 1 : 0;
      if (contact.ssaoMaterial.defines.PERSPECTIVE_CAMERA !== perspective) {
        contact.ssaoMaterial.defines.PERSPECTIVE_CAMERA = perspective;
        contact.ssaoMaterial.needsUpdate = true;
      }
      contact.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(activeCamera.projectionMatrix);
      contact.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(activeCamera.projectionMatrixInverse);
      contact.blurMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(activeCamera.projectionMatrixInverse);
      gpuTimer.begin();
      try {
        if (volume?.object.visible) volumeDepth.render(activeCamera, volume);
        composer.render();
      } finally {
        gpuTimer.end();
      }
    },
    get evidence() {
      return {
        contactShadows: true,
        contactActive: contact.enabled,
        method: "cosine-weighted horizons / indirect diffuse",
        slices: CONTACT_SLICES,
        samples: CONTACT_SLICES * CONTACT_STEPS * 2,
        radiusMeters: CONTACT_RADIUS,
        aoWidth: contact.width,
        aoHeight: contact.height,
        width,
        height,
        gpu: gpuTimer.evidence,
        volumeDepth: volume?.object.visible ? volumeDepth.evidence() : null,
        bloom: bloom ? { strength: bloom.strength, radius: bloom.radius, threshold: bloom.threshold } : null,
      };
    },
    dispose() {
      lighting.contactEnabled.value = false;
      gpuTimer.dispose();
      volumeDepth.dispose();
      beauty.dispose();
      contact.dispose();
      bloom?.dispose();
      output.dispose();
      composer.dispose();
      contact.ssaoMaterial.dispose();
      contact.noiseTexture.dispose();
    },
  };
}
