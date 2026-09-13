import * as THREE from "../three.module.min.js";
import { EffectComposer } from "../vendor/three-r164/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/three-r164/postprocessing/RenderPass.js";
import { SSAOPass } from "../vendor/three-r164/postprocessing/SSAOPass.js";
import { OutputPass } from "../vendor/three-r164/postprocessing/OutputPass.js";

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

export function finishPhysicalMaterial(source, mesh) {
  const name = source.name;
  const m =
    /water|turquoise/i.test(name) && !mesh.isSkinnedMesh
      ? new THREE.MeshPhysicalMaterial({ name, color: source.color, roughness: 0.12, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1 })
      : source.clone();
  if (mesh.isSkinnedMesh) {
    m.roughness = /hair/i.test(name) ? 0.7 : /skin/i.test(name) ? 0.68 : 0.9;
    m.envMapIntensity = /hair/i.test(name) ? 0.28 : 0.5;
    return m;
  }
  if (/leaf|foliage/i.test(name)) {
    m.side = THREE.DoubleSide;
    m.roughness = 0.56;
    m.envMapIntensity = 0.6;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.leafTime = physicalTime;
      shader.vertexShader = "uniform float leafTime;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        vec3 transformed=position;
        float phase=position.x*.7+position.z*.9+leafTime*.65;
        transformed.x+=sin(phase)*.008+sin(phase*2.3)*.003;
        transformed.z+=cos(phase*.83)*.006;
      `
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `
        outgoingLight+=diffuseColor.rgb*vec3(.16,.23,.065)*pow(max(0.,-dot(normal,normalize(vec3(-.4,.8,.3)))),2.);
        #include <opaque_fragment>
      `
      );
    };
    m.customProgramCacheKey = () => "coastal-botanical-v1";
    return m;
  }
  const wood = /wood|oak|ash|walnut/i.test(name);
  const cloth = /linen|textile|cotton|trousers|woven/i.test(name);
  const rock = /sandstone|sediment|limestone|stone|sand|plaster/i.test(name);
  const water = /water|turquoise/i.test(name);
  if (water) {
    m.color.multiplyScalar(0.56);
    m.envMapIntensity = 1.2;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.waterTime = physicalTime;
      shader.vertexShader = "varying vec3 poolPoint;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\npoolPoint = (modelMatrix * vec4(transformed,1.0)).xyz;"
      );
      shader.fragmentShader = `uniform float waterTime; varying vec3 poolPoint;\n${surfaceNoise}\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `
        #include <normal_fragment_maps>
        vec2 ripple = poolPoint.xz * 15.0;
        float a = sin(ripple.x + ripple.y*.71 + waterTime*.65);
        float b = cos(ripple.y*.93-ripple.x*.6-waterTime*.4);
        normal = normalize(mat3(viewMatrix)*vec3(a*.075,1.0,b*.075));
      `
      );
    };
    return m;
  }
  m.roughness = wood ? 0.48 : cloth ? 0.96 : rock ? 0.89 : m.roughness;
  m.envMapIntensity = cloth ? 0.35 : 0.7;
  if (!wood && !cloth && !rock) return m;
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
        float growth = sin(p.x*115.0 + warp*13.0 + sin(p.z*.9)*1.2);
        float fibers = grainNoise(vec3(p.x*330.0,p.y*180.0,p.z*5.0));
        pigment = .91 + .055*growth + .075*fibers;
        diffuseColor.rgb *= pigment;
      `
          : kind === 2
            ? `
        float weave = sin(p.x*590.0) * sin(p.z*590.0 + p.y*590.0);
        diffuseColor.rgb *= .90 + .07*weave + .10*pores;
      `
            : kind === 3
              ? `
        float layers = stoneNoise(vec3(p.x*.45, p.y*9.0 + detail*1.8, p.z*.45));
        float erosion = stoneNoise(vec3(p.x*2.0,p.y*.30,p.z*2.0));
        pigment = .68 + .32*detail + .14*layers;
        diffuseColor.rgb *= pigment;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(.67,.74,.80), smoothstep(.5,.85,erosion)*.3);
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
      float height = ${kind === 1 ? "grainNoise(vec3(surfacePoint.x*95.0,surfacePoint.y*24.0,surfacePoint.z*2.5)) * .0018" : kind === 2 ? "grainNoise(surfacePoint*140.0)*.0015" : kind === 3 ? "stoneNoise(surfacePoint*7.0)*.065 + grainNoise(surfacePoint*55.0)*.006" : "stoneNoise(surfacePoint*32.0)*.008"};
      vec3 eyeX = dFdx(-vViewPosition), eyeY = dFdy(-vViewPosition);
      vec3 r1 = cross(eyeY, normal), r2 = cross(normal, eyeX);
      float det = dot(eyeX, r1);
      vec3 gradient = sign(det) * (dFdx(height)*r1 + dFdy(height)*r2);
      normal = normalize(abs(det)*normal - gradient);
    `
    );
  };
  m.customProgramCacheKey = () => `coastal-physical-${kind}`;
  return m;
}

export function createFinish(renderer, scene, camera) {
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
      contact.kernelRadius = exterior ? 1.1 : 0.34;
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
