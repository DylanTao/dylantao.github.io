import * as THREE from "../three.module.min.js";
import { WATER_IOR } from "./ocean-spectrum.mjs";
import { SEA_LEVEL } from "./sea-optics.mjs";

// The mirror's size: 384x384 for the page embed. Full screen widens it to the screen's aspect
// (resolution.mjs detailFor) through setMirrorSize, applied at the mirror's next update, so the
// controller needs no handle on the sea's own objects.
const mirrorSize = { width: 384, height: 384 };
// Keep the beauty viewport and the wave filter away from the mirror's fade at its edge.
const MIRROR_LENS_SCALE = 1 / 1.18;
const mirrorLens = new THREE.Matrix4().makeScale(MIRROR_LENS_SCALE, MIRROR_LENS_SCALE, 1);
export function setMirrorSize(width, height) {
  mirrorSize.width = Math.max(1, Math.round(width));
  mirrorSize.height = Math.max(1, Math.round(height));
}

// A small live mirror of the actual land and home. Oblique near-plane clipping
// follows Three r164's Water implementation; no landscape image is sampled.
export function createSeaReflection(renderer, scene, ocean, material) {
  const target = new THREE.WebGLRenderTarget(384, 384, {
    type: THREE.HalfFloatType,
    depthTexture: new THREE.DepthTexture(384, 384, THREE.UnsignedIntType),
  });
  const mirror = new THREE.PerspectiveCamera();
  const textureMatrix = new THREE.Matrix4();
  const worldFromClip = new THREE.Matrix4();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SEA_LEVEL);
  const clip = new THREE.Vector4(),
    q = new THREE.Vector4();
  const direction = new THREE.Vector3();
  // Transmissive meshes (the onsen water, the coffee glass) make Three render a whole extra opaque
  // pass at full canvas size before drawing them. In a 384 px mirror they are a few texels, so the
  // mirror skips them. Model preparation invalidates this list before its next draw; the periodic
  // refresh remains a fallback for material changes that do not load a model.
  let transmissive = [],
    transmissiveAge = Infinity;
  const refreshTransmissive = () => {
    transmissive = [];
    scene.traverse((object) => {
      if (object.isMesh && [object.material].flat().some((m) => m?.transmission > 0)) transmissive.push(object);
    });
    transmissiveAge = 0;
  };
  const uniforms = {
    coastalReflection: { value: target.texture },
    coastalReflectionDepth: { value: target.depthTexture },
    coastalProjection: { value: textureMatrix },
    coastalWorldFromClip: { value: worldFromClip },
    coastalMirrorTexel: { value: new THREE.Vector2(1 / target.width, 1 / target.height) },
    reflectionStrength: { value: 0 },
  };
  const compile = material.onBeforeCompile;
  material.onBeforeCompile = (shader) => {
    compile(shader);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = "uniform mat4 coastalProjection; varying vec4 reflectionPoint;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\nreflectionPoint = coastalProjection * modelMatrix * vec4(transformed,1.0);"
    );
    shader.fragmentShader =
      `uniform sampler2D coastalReflection, coastalReflectionDepth;
      uniform mat4 coastalProjection, coastalWorldFromClip;
      uniform vec2 coastalMirrorTexel; uniform float reflectionStrength;
      varying vec4 reflectionPoint;
      float mirrorEdge(vec2 uv) {
        vec2 edge=min(uv,1.-uv);
        return min(edge.x,edge.y);
      }
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_end>",
      `
      #include <lights_fragment_end>
      if(reflectionStrength>.0 && reflectionPoint.w>.0001){
        vec2 planarUv=reflectionPoint.xy/reflectionPoint.w;
        // Reproject the real wave's reflection ray at the depth of the planar witness.
        // The depth comes from the same oblique camera as the color, in one mirror draw.
        float depth=texture2D(coastalReflectionDepth,clamp(planarUv,vec2(0.),vec2(1.))).r;
        vec4 witness=coastalWorldFromClip*vec4(planarUv*2.-1.,depth*2.-1.,1.);
        float reach=clamp(length(witness.xyz-witness.w*rainSurfaceWorld)/max(abs(witness.w),1e-6),.85,100.);
        if(depth>.99998||witness.w<=.000001) reach=120.;
        vec3 incoming=normalize(rainSurfaceWorld-cameraPosition);
        vec3 ray=reflect(incoming,waveNormal);
        vec4 aimed=coastalProjection*vec4(rainSurfaceWorld+ray*reach,1.);
        vec2 aimedUv=aimed.xy/max(aimed.w,.001);
        // Planar and off-axis rays can see different objects; fall back smoothly
        // at the capture edge or when a very steep facet aims back into the water.
        float available=smoothstep(.001,.055,mirrorEdge(aimedUv))*smoothstep(0.,.045,ray.y)*step(.001,aimed.w);
        vec2 reflectedUv=mix(planarUv,aimedUv,available);
        float cosine=max(0.,dot(normal,normalize(vViewPosition)));
        float fresnel=seaFresnel(cosine), meanCosine=max(-incoming.y,0.);
        // A coarse grazing pixel sees a distribution of slopes. When both mirror
        // samples reach the sky, temper the local Fresnel by the mean incidence.
        if(depth>=.999999&&footprint>.18&&meanCosine<.29&&swashWeight<.02){
          float resolvedDepth=texture2D(coastalReflectionDepth,clamp(reflectedUv,vec2(0.),vec2(1.))).r;
          if(resolvedDepth>=.999999){
            // Project half the isotropic slope variance onto the viewing direction.
            float variance=.5*slopeVariance*(1.-meanCosine*meanCosine);
            float overlap=variance/(variance+meanCosine*meanCosine+1e-6);
            float aperture=smoothstep(.18,.82,footprint);
            float grazing=1.-smoothstep(.035,.135,meanCosine);
            // A broad grazing sky reflection samples many facet angles. The reflected sky
            // radiance is still looked up along the real wave; temper only the resolved
            // Fresnel swing in sky-to-sky pixels beyond the local rippling shallows.
            float range=length(rainSurfaceWorld.xz-cameraPosition.xz);
            float broad=smoothstep(.18,.60,footprint)*(1.-smoothstep(.14,.29,meanCosine))*smoothstep(16.,32.,range);
            float aggregate=1.-(1.-aperture*grazing*overlap)*(1.-.67*broad);
            fresnel=mix(fresnel,seaFresnel(meanCosine),aggregate);
          }
        }
        float inside=smoothstep(.001,.028,mirrorEdge(reflectedUv));
        float streak=clamp(.0015+.54*sqrt(max(slopeVariance,0.))+roughnessFactor*.003,.0015,.055);
        streak*=mix(1.14,.72,cosine)*${MIRROR_LENS_SCALE.toFixed(8)};
        vec2 across=vec2(max(coastalMirrorTexel.x,streak*.12),0.);
        vec2 along=vec2(0.,max(coastalMirrorTexel.y,streak));
        vec3 reflectedColor=texture2D(coastalReflection,reflectedUv).rgb*.24;
        reflectedColor+=texture2D(coastalReflection,reflectedUv+across).rgb*.1;
        reflectedColor+=texture2D(coastalReflection,reflectedUv-across).rgb*.1;
        reflectedColor+=texture2D(coastalReflection,reflectedUv+along*.45).rgb*.15;
        reflectedColor+=texture2D(coastalReflection,reflectedUv-along*.45).rgb*.15;
        reflectedColor+=texture2D(coastalReflection,reflectedUv+along).rgb*.13;
        reflectedColor+=texture2D(coastalReflection,reflectedUv-along).rgb*.13;
        reflectedLight.indirectSpecular=mix(reflectedLight.indirectSpecular,reflectedColor*fresnel,reflectionStrength*inside);
      }
    `
    );
  };
  return {
    invalidate() {
      transmissiveAge = Infinity;
    },
    update(camera, enabled) {
      uniforms.reflectionStrength.value = enabled ? 1 : 0;
      if (!enabled) return;
      if (target.width !== mirrorSize.width || target.height !== mirrorSize.height) {
        target.setSize(mirrorSize.width, mirrorSize.height);
        uniforms.coastalMirrorTexel.value.set(1 / target.width, 1 / target.height);
      }
      mirror.copy(camera);
      mirror.position.y = 2 * SEA_LEVEL - camera.position.y;
      camera.getWorldDirection(direction);
      direction.y *= -1;
      mirror.up.set(0, -1, 0);
      mirror.lookAt(direction.add(mirror.position));
      mirror.updateMatrixWorld();
      // Open the mirrored frustum at the same target size. Both lookup and depth clipping use it.
      mirror.projectionMatrix.premultiply(mirrorLens);
      // Construct the texture transform before changing the clipping plane.
      textureMatrix
        .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
        .multiply(mirror.projectionMatrix)
        .multiply(mirror.matrixWorldInverse);
      const viewPlane = plane.clone().applyMatrix4(mirror.matrixWorldInverse);
      clip.set(viewPlane.normal.x, viewPlane.normal.y, viewPlane.normal.z, viewPlane.constant);
      const p = mirror.projectionMatrix.elements;
      q.set((Math.sign(clip.x) + p[8]) / p[0], (Math.sign(clip.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
      clip.multiplyScalar(2 / clip.dot(q));
      p[2] = clip.x;
      p[6] = clip.y;
      p[10] = clip.z + 1;
      p[14] = clip.w;
      mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
      worldFromClip.multiplyMatrices(mirror.matrixWorld, mirror.projectionMatrixInverse);
      const previousTarget = renderer.getRenderTarget();
      const previousShadowUpdate = renderer.shadowMap.autoUpdate;
      const previousToneMapping = renderer.toneMapping,
        previousVisibility = ocean.visible;
      if (++transmissiveAge > 60) refreshTransmissive();
      const hidden = transmissive.filter((object) => object.visible);
      try {
        ocean.visible = false;
        for (const object of hidden) object.visible = false;
        renderer.shadowMap.autoUpdate = false;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setRenderTarget(target);
        renderer.clear();
        renderer.render(scene, mirror);
      } finally {
        for (const object of hidden) object.visible = true;
        renderer.setRenderTarget(previousTarget);
        renderer.toneMapping = previousToneMapping;
        renderer.shadowMap.autoUpdate = previousShadowUpdate;
        ocean.visible = previousVisibility;
      }
    },
    dispose() {
      target.dispose();
    },
    evidence: () => ({
      width: target.width,
      height: target.height,
      linear: true,
      fresnelIOR: WATER_IOR,
      depthReprojection: Boolean(target.depthTexture),
      active: uniforms.reflectionStrength.value === 1,
    }),
  };
}
