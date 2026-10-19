import * as THREE from "../three.module.min.js";
import { mergeGeometries } from "../vendor/three-r164/utils/BufferGeometryUtils.js";
import { surfaceNoise } from "./realism.mjs";
import { createSeaReflection } from "./reflection.mjs";
import { createWildlife } from "./wildlife.mjs";
import { beachPoint } from "./shore.mjs";
import { OCEAN_WAVES, bindOceanWind, oceanFieldGLSL, oceanRipplesGLSL, sampleOcean } from "./ocean-spectrum.mjs";
import { createWindParticles } from "./wind-particles.mjs";
import { coastWind } from "./wind-field.mjs";
import { createBathymetry } from "./bathymetry.mjs";
import { LA_JOLLA_WATER, SEA_LEVEL, SUN_SOLID_ANGLE, causticUniforms, seaOpticsGLSL, seawaterIOPs, sunTint } from "./sea-optics.mjs";

const SAND_NAME = /beach sand|tideline sand/i;
// The facets that throw the sun's glints: capillary ripples about 3 cm across (an authored scale).
const SEA_GLINT_FACET = 0.03;
// The sun's (or the night's moon's) mirror lobe on the sea is kept apart from the other lights' so the
// glitter can break it into facets: three r164's directional-light loop calls RE_Direct_SeaSun, which
// lays down the diffuse light as RE_Direct_Physical does and keeps the GGX lobe, shadow included.
const SEA_SUN_GLSL = `
vec3 seaSunSpecular = vec3(0.);
void RE_Direct_SeaSun(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  vec3 irradiance = saturate(dot(geometryNormal, directLight.direction)) * directLight.color;
  seaSunSpecular += irradiance * BRDF_GGX(directLight.direction, geometryViewDir, geometryNormal, material);
  reflectedLight.directDiffuse += irradiance * BRDF_Lambert(material.diffuseColor);
}`;
const DIRECTIONAL_LIGHTS = "#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )";
export const SEA_LIGHTS_BEGIN = (() => {
  const chunk = THREE.ShaderChunk.lights_fragment_begin,
    at = chunk.indexOf(DIRECTIONAL_LIGHTS);
  // Unpatched (another three release), the sun stays in the ordinary lobe and the glitter is dark.
  return at < 0 ? chunk : chunk.slice(0, at) + chunk.slice(at).replace("RE_Direct( directLight", "RE_Direct_SeaSun( directLight");
})();
// Lamps the water can mirror as streaks.
const SEA_LAMPS = 8;
// Animals the water can show wakes and rings for: the two swimming sea lions and the diving pelican.
const SEA_WAKES = 3;
// Slopes and foam of an expanding ring where an animal broke the surface (radius 0.3 + 1.1 age metres,
// fading over a few seconds) and of a Kelvin wake behind a swimmer: two arms at 19.47 degrees, divergent
// waves along them and white water close behind. A stylized surface pattern, not a wave solver.
const SEA_WAKE_GLSL = `
vec2 seaWakes(vec2 p, inout float foam) {
  vec2 slope = vec2(0.);
  for (int i = 0; i < seaWakeCount; i++) {
    vec4 a = seaWakeA[i], b = seaWakeB[i];
    vec2 rel = p - a.xy;
    float dist = length(rel);
    if (dist > 14.) continue;
    // The ring.
    float age = b.w, radius = .3 + 1.1 * age, spread = .16 + .12 * age;
    float strength = b.z * exp(-1.1 * age) / sqrt(1. + dist);
    if (strength > .002) {
      float x = dist - radius, envelope = exp(-x * x / (spread * spread));
      slope += strength * envelope * .09 * cos(14. * x) * rel / max(dist, .001);
      foam = max(foam, b.z * envelope * exp(-3.2 * age));
    }
    // The V wake behind a swimmer at speed b.x along heading a.zw.
    float speed = b.x;
    if (b.y * speed > .05) {
      vec2 back = -a.zw, side = vec2(-back.y, back.x);
      float u = dot(rel, back), w = dot(rel, side);
      if (u > 0.) {
        float arm = abs(w) - .354 * u, width = .1 + .06 * u;
        float fade = b.y * smoothstep(.2, 1., speed) * exp(-u / (2. + 1.5 * speed));
        float along = 6.2832 * (u * .94 + abs(w) * .34) / max(.35, .38 * speed * speed);
        slope += fade * exp(-arm * arm / (width * width)) * .07 * cos(along) * normalize(back * -.34 + side * sign(w) * .94);
        foam = max(foam, fade * exp(-w * w / .04) * exp(-u / .9));
      }
    }
  }
  return slope;
}`;

// Geometry, light, and a procedural sky. No photograph or illustration is
// placed behind the home. Blender supplies the connected coastal headlands.
export function createPacific(scene, renderer, config) {
  const root = new THREE.Group();
  root.name = "Pacific environment";
  scene.add(root);
  const beach = config.beach;
  const wildlife = createWildlife(root, config);
  const shoreData = new Float32Array(beach.samples.flatMap((row) => [row[3], row[1], row[2], 1]));
  const shoreTexture = new THREE.DataTexture(shoreData, beach.samples.length, 1, THREE.RGBAFormat, THREE.FloatType);
  shoreTexture.minFilter = shoreTexture.magFilter = THREE.LinearFilter;
  shoreTexture.needsUpdate = true;
  const time = { value: 0 },
    ink = { value: 0 };
  let style = "realistic",
    palette = "afternoon",
    skyKey = "",
    environment;
  // The water's body colour comes from its optics (sea-optics.mjs). Its diffuse colour (the palette's)
  // only lets the shader read the light arriving at each point (totalDiffuse / diffuseColor) and does
  // not show.
  const physicalWater = new THREE.MeshPhysicalMaterial({
    color: 0x185462,
    roughness: 0.14,
    metalness: 0,
    ior: 1.333,
    envMapIntensity: 1,
  });
  // The seabed under the sea, captured from the coast's geometry once it loads (bathymetry.mjs), and
  // the sun (or the night's moon light) that lights it through the water.
  const bathymetry = createBathymetry(renderer),
    caustics = causticUniforms(),
    seaIOPs = seawaterIOPs(LA_JOLLA_WATER),
    seaLight = {
      seaSunDirection: { value: new THREE.Vector3(0, 1, 0) },
      seaSunColor: { value: new THREE.Color(0, 0, 0) },
      // The hue the water's sun takes over the scene's sun light (waterSky below).
      seaSunTint: { value: new THREE.Color(1, 1, 1) },
      seaShadowMatrix: { value: new THREE.Matrix4() },
      // The terrace's lamps (festoon, fire bowl, wall lights), mirrored as streaks: flat arrays.
      seaLampPosition: { value: new Float32Array(SEA_LAMPS * 3) },
      seaLampColor: { value: new Float32Array(SEA_LAMPS * 3) },
      seaLampCount: { value: 0 },
      // Where the swimming sea lions and the diving pelican meet the water (wildlife.mjs waterMarks):
      // (x, z, heading x, heading z) and (speed, wake, ring, ring age), flat arrays.
      seaWakeA: { value: new Float32Array(SEA_WAKES * 4) },
      seaWakeB: { value: new Float32Array(SEA_WAKES * 4) },
      seaWakeCount: { value: 0 },
    };
  let sun = null,
    lampSources = null;
  // Lab views of the sea's optics (?sea-debug=depth|seabed|light|leaving|lamps|wake|glints), compiled
  // only when asked for: the seabed depth along the view (red) and shore distance (blue), the captured
  // seabed, the seabed's light relative to open sand, the water-leaving radiance, the lamp streaks, the
  // wakes, and the glitter (red: log glints per patch, green: the patch's draw, blue: one or more).
  const seaDebugMode = typeof location !== "undefined" ? new URLSearchParams(location.search).get("sea-debug") : null;
  const seaDebug =
    {
      depth: "outgoingLight=vec3(bedDepth*.5,captured?.5:0.,distanceToBeach*.1);",
      seabed: "outgoingLight=vec3((seabed.x+9.)*.5,seabed.y,seabed.z*.2);",
      light: "outgoingLight=bottomLight*.5;",
      leaving: "outgoingLight=waterLeaving*4.;",
      lamps: "outgoingLight=lampStreaks*20.;",
      wake: "outgoingLight=vec3(abs(wake)*8.,wakeFoam);",
      glints: "outgoingLight=vec3(clamp(log(max(glints,1e-9))*.1+.5,0.,1.),clamp(sparkle*.1,0.,1.),glints>=1.?1.:0.);",
    }[seaDebugMode] || "";
  physicalWater.onBeforeCompile = (shader) => {
    shader.uniforms.pacificTime = time;
    // The coast's one wind turns and grows the wind sea, and drives ripples and whitecaps per pixel.
    bindOceanWind(shader, ocean.position);
    Object.assign(shader.uniforms, bathymetry.uniforms, seaLight, caustics);
    shader.uniforms.shoreProfile = { value: shoreTexture };
    shader.uniforms.shoreRange = { value: new THREE.Vector2(beach.samples[0][0], beach.samples.at(-1)[0] - beach.samples[0][0]) };
    shader.vertexShader = `uniform float pacificTime; varying vec2 oceanXZ;\n${oceanFieldGLSL}\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      `
      vec3 oceanDisplacement, oceanTx, oceanTz; float vertexVariance;
      // Geometry carries the resolvable swells; the pixel stage carries the
      // shorter ripples, avoiding undersampled high-frequency vertices.
      oceanField(position.xz,pacificTime,1.1,oceanDisplacement,oceanTx,oceanTz,vertexVariance);
      vec3 objectNormal = normalize(cross(oceanTz,oceanTx));
    `
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      vec3 transformed = position + oceanDisplacement;
      oceanXZ = position.xz;
    `
    );
    // The beach slopes a few centimetres under the waterline, inside one shadow-map texel of the water
    // lying on it, so the sand shaded the water (acne in straight-edged patches). The sea's shadow
    // lookup rises 20 cm: rocks, animals and the cliff still shade it, the sand under it no longer.
    shader.vertexShader = shader.vertexShader.replace(
      "#include <shadowmap_vertex>",
      `#include <shadowmap_vertex>
      #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
        vDirectionalShadowCoord[ 0 ] = directionalShadowMatrix[ 0 ] * ( worldPosition + vec4( 0., .2, 0., 0. ) );
      #endif`
    );
    shader.fragmentShader =
      `uniform float pacificTime; uniform sampler2D shoreProfile; uniform vec2 shoreRange; varying vec2 oceanXZ;
      uniform vec3 seaSunDirection; uniform vec3 seaSunColor; uniform vec3 seaSunTint; uniform mat4 seaShadowMatrix;
      uniform vec3 seaLampPosition[${SEA_LAMPS}]; uniform vec3 seaLampColor[${SEA_LAMPS}]; uniform int seaLampCount;
      uniform vec4 seaWakeA[${SEA_WAKES}]; uniform vec4 seaWakeB[${SEA_WAKES}]; uniform int seaWakeCount;\n${surfaceNoise}\n${SEA_WAKE_GLSL}\n${oceanFieldGLSL}\n${oceanRipplesGLSL}\n${seaOpticsGLSL(seaIOPs)}\n` +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <lights_physical_pars_fragment>", `#include <lights_physical_pars_fragment>\n${SEA_SUN_GLSL}`)
      .replace("#include <lights_fragment_begin>", SEA_LIGHTS_BEGIN);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `
      #include <roughnessmap_fragment>
      float footprint=max(length(dFdx(oceanXZ)),length(dFdy(oceanXZ)));
      vec3 fieldDisplacement, fieldTx, fieldTz; float slopeVariance;
      oceanField(oceanXZ,pacificTime,footprint,fieldDisplacement,fieldTx,fieldTz,slopeVariance);
      vec3 ripple=oceanRipples(oceanXZ,pacificTime,footprint);
      // Rings where an animal broke the surface and V wakes behind the swimmers, as slopes and foam.
      float wakeFoam=0.;
      vec2 wake=seaWakeCount>0?seaWakes(oceanXZ+oceanWindOrigin,wakeFoam):vec2(0.);
      fieldTx.y+=wake.x;
      fieldTz.y+=wake.y;
      fieldTx.y+=ripple.x;
      fieldTz.y+=ripple.y;
      slopeVariance+=ripple.z;
      // Unresolved wave energy broadens the GGX lobe instead of vanishing
      // or flickering. This scalar isotropic fit is not the full ocean BRDF.
      roughnessFactor=clamp(pow(pow(roughnessFactor,4.)+slopeVariance,.25),.14,.65);
    `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
      #include <normal_fragment_maps>
      vec3 waveNormal=normalize(cross(fieldTz,fieldTx));
      float slopeX=-waveNormal.x/max(.1,waveNormal.y);
      float slopeZ=-waveNormal.z/max(.1,waveNormal.y);
      normal=normalize(mat3(viewMatrix)*waveNormal);
    `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `
      float x = oceanXZ.x;
      bool captured=seabedReady>.5;
      // The surface point in the world, wave displacement included.
      vec3 seaPoint=vec3(oceanXZ.x+fieldDisplacement.x+oceanWindOrigin.x,${SEA_LEVEL.toFixed(2)}+fieldDisplacement.y,oceanXZ.y+fieldDisplacement.z+oceanWindOrigin.y);
      vec4 seabed=seabedAt(seaPoint.xz);
      // Distance to the waterline: from the captured coast once it is in (the true waterline, rocks
      // included), else from the authored shoreline profile.
      float waterline = texture2D(shoreProfile,vec2(clamp((x-shoreRange.x)/shoreRange.y,0.,1.),.5)).r;
      float distanceToBeach = captured ? seabed.z : 28.-oceanXZ.y-waterline;
      float shoal = (1.-smoothstep(.5,7.,distanceToBeach)) * smoothstep(-.4,.4,distanceToBeach);
      // Compression of the horizontal displacement Jacobian selects crests.
      // Foam is an authored shoreline model; there is no breaking-fluid solver.
      float jacobian=fieldTx.x*fieldTz.z-fieldTx.z*fieldTz.x;
      float compression=1.-smoothstep(.84,.985,jacobian);
      float crest=smoothstep(.035,.22,fieldDisplacement.y);
      float lace = stoneNoise(vec3(oceanXZ*3.8,pacificTime*.16));
      float foam = smoothstep(.11,.52,shoal*(crest*.4+compression*.6))*smoothstep(.25,.66,lace);
      foam = max(foam, oceanWhitecap(oceanXZ,pacificTime,crest,compression)*smoothstep(1.,4.,distanceToBeach));
      // Swash: in the last metres each wave runs up the sand and drains back, so a lacy band at
      // the waterline breathes in width, and each broken front travels in and fades as it goes.
      float swash = pacificTime*.14 + x*.017 + stoneNoise(vec3(x*.08,4.1,pacificTime*.03))*.6;
      float runUp = .5+.5*sin(swash*6.2832);
      float swashLace = stoneNoise(vec3(oceanXZ*vec2(2.6,6.),pacificTime*.21));
      float edgeFoam = (1.-smoothstep(.15+runUp*.55,.45+runUp*.9,distanceToBeach))*smoothstep(-.8,-.1,distanceToBeach);
      float front = fract(swash);
      float breaker = exp(-pow((distanceToBeach-mix(3.2,.4,front))/.16,2.))*(1.-front)*(1.-front);
      foam = max(foam, max(edgeFoam*smoothstep(.4,.7,swashLace+.2*(1.-smoothstep(0.,.6,distanceToBeach))), breaker*smoothstep(.45,.75,swashLace)*.6));
      foam = max(foam, wakeFoam*smoothstep(.3,.6,lace+.15));
      // Lambertian radiance per unit albedo under this pixel's light, so the seabed and the foam are
      // lit like the beach and dim with the evening instead of glowing.
      vec3 lambert=totalDiffuse/max(material.diffuseColor,vec3(1e-4));
      // ---- The water as an optical medium (sea-optics.mjs) ----
      // The view ray refracts at the wave normal and runs down to the captured seabed; the water's
      // reflectance follows Lee et al.'s shallow-water model, so sand under a metre of water reads
      // turquoise and open water deepens to blue. Before the capture lands, the old authored depth.
      vec3 toEye=normalize(cameraPosition-seaPoint);
      float cosEye=max(dot(toEye,waveNormal),0.);
      vec3 inWater=refract(-toEye,waveNormal,${(1 / 1.333).toFixed(6)});
      float cosView=max(-inWater.y,.08);
      float bedDepth=captured?max(seaPoint.y-seabed.x,0.):max(.05,distanceToBeach*.18);
      vec2 bedXZ=seaPoint.xz;
      vec4 bed=seabed;
      if(captured&&bedDepth<14.){
        // Two steps along the refracted ray to where it meets the seabed.
        for(int i=0;i<2;i++){
          bedXZ=seaPoint.xz+inWater.xz/cosView*bedDepth;
          bed=seabedAt(bedXZ);
          bedDepth=max(seaPoint.y-bed.x,0.);
        }
      }
      vec3 sunDir=normalize(seaSunDirection);
      float sunUp=max(sunDir.y,0.);
      vec3 sunInWater=refract(-sunDir,vec3(0.,1.,0.),${(1 / 1.333).toFixed(6)});
      float cosSun=max(-sunInWater.y,.08);
      // The surface lets in (1 - F) of the sun; the sky's share arrives diffuse.
      vec3 sunIrradiance=seaSunColor*sunUp*(1.-seaFresnel(sunUp));
      vec3 skyIrradiance=PI*reflectedLight.indirectDiffuse/max(material.diffuseColor,vec3(1e-4))*.94;
      vec3 bottomLight=vec3(1.);
      vec3 rho=vec3(0.);
      if(bedDepth<14.){
        float path=bedDepth/cosSun;
        // Where the sun ray that lands here crossed the surface: its shadow and its ripples' focus.
        vec2 entry=bedXZ-sunInWater.xz/cosSun*bedDepth;
        float lit=1.;
        #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
          // Looked up a little above both the water and the seabed, so sand just under the surface
          // cannot shade itself; four compares half a texel apart (seen through moving water, the
          // soft kernel's 36 taps bought nothing).
          vec4 seaShadowCoord=seaShadowMatrix*vec4(entry.x,max(seaPoint.y,bed.x)+.2,entry.y,1.);
          seaShadowCoord.xyz/=seaShadowCoord.w;
          seaShadowCoord.z+=directionalLightShadows[0].shadowBias;
          if(all(greaterThanEqual(seaShadowCoord.xy,vec2(0.)))&&all(lessThanEqual(seaShadowCoord.xyz,vec3(1.)))){
            // Explicit-level taps: inside this branch implicit derivatives cost the driver a long compile.
            vec2 texel=.5/directionalLightShadows[0].shadowMapSize;
            lit=.25*(step(seaShadowCoord.z,unpackRGBAToDepth(textureLod(directionalShadowMap[0],seaShadowCoord.xy+vec2(-texel.x,-texel.y),0.)))
              +step(seaShadowCoord.z,unpackRGBAToDepth(textureLod(directionalShadowMap[0],seaShadowCoord.xy+vec2(texel.x,-texel.y),0.)))
              +step(seaShadowCoord.z,unpackRGBAToDepth(textureLod(directionalShadowMap[0],seaShadowCoord.xy+vec2(-texel.x,texel.y),0.)))
              +step(seaShadowCoord.z,unpackRGBAToDepth(textureLod(directionalShadowMap[0],seaShadowCoord.xy+vec2(texel.x,texel.y),0.))));
          }
        #endif
        // Past a 30 cm footprint every ripple is blurred away and the gain is one.
        float caustic=sunUp>.02&&footprint<.3?seaCaustics(entry-oceanWindOrigin,pacificTime,path,footprint):1.;
        bottomLight=(sunIrradiance*lit*caustic+skyIrradiance)/max(sunIrradiance+skyIrradiance,vec3(1e-5));
        rho=seabedAlbedo(vec3(bedXZ.x,bed.x,bedXZ.y),captured?bed.y:0.,bedDepth,captured?bed.w:0.,footprint);
      }
      // In the surf zone the breakers keep fine sand in suspension, so the water there turns milky.
      float silt=.006*(1.-smoothstep(1.,9.,distanceToBeach))*(.45+.55*max(crest,compression))*smoothstep(-.3,.3,distanceToBeach);
      vec3 waterLeaving=seaReflectance(bedDepth,rho,cosSun,cosView,bottomLight,silt)*PI*lambert*(1.-seaFresnel(cosEye))/.98;
      // Glitter: the sun's (or the moon's) path is made of single facets tilted to mirror its disc. A
      // patch of sea (9 cm, or the pixel's footprint in power-of-two steps) holds on average glints =
      // (patch / 3 cm)^2 facets times the share of them the lobe's own GGX distribution aims at the
      // disc. Each patch draws its own count for its own seventh of a second, with mean one: near the
      // house a lone facet flashes (chance glints, then 1/glints times as bright), far out the facets
      // crowd into a twinkling road (spread 1/sqrt(glints)). Half of the sun's GGX lobe draws as that
      // count and half as a steady glow (the glints' glare, which tone mapping would otherwise lose),
      // so the path keeps its mean, widens with the roughness and takes the sun's low-altitude hue.
      vec3 glintH=normalize(sunDir+toEye);
      float glintCos=max(dot(glintH,waveNormal),0.), glintA2=pow(roughnessFactor,4.);
      float glintD=glintA2/(PI*pow(glintCos*glintCos*(glintA2-1.)+1.,2.));
      float patchSize=.09*exp2(max(ceil(log2(footprint/.09)),0.));
      // Facet normals within the disc's reflection: D cos(theta_h) over the disc's solid angle through
      // the reflection Jacobian 1/(4 h.l).
      float glints=glintD*glintCos*${SUN_SOLID_ANGLE.toExponential(6)}/(4.*max(dot(glintH,sunDir),.05))*patchSize*patchSize/${(SEA_GLINT_FACET ** 2).toExponential(3)};
      vec2 patchId=floor(seaPoint.xz/patchSize);
      float glintSlot=pacificTime*7.+hash31(vec3(patchId,patchSize));
      float draw=-log(max(hash31(vec3(patchId,floor(glintSlot)+.5)),1e-4));
      // Below one glint a patch is lit or dark, a lit one exponentially bright; above, a spread around
      // the mean. Both are the same draw at one glint. A lone glint fades in and out.
      float sparkle=glints<1.?step(1.-glints,hash31(vec3(patchId.yx,floor(glintSlot)+19.)))*draw/max(glints,1e-6):1.+(draw-1.)*inversesqrt(glints);
      sparkle*=1.+(1.5708*sin(3.1416*fract(glintSlot))-1.)*max(1.-glints,0.);
      vec3 sunGlow=seaSunSpecular*seaSunTint, glint=sunGlow*(.5*sparkle);
      // A flash stops at 8, already white after tone mapping; brighter would only feed the bloom.
      glint*=min(1.,8./max(max(max(glint.r,glint.g),glint.b),1e-4));
      vec3 glitter=.5*sunGlow+glint;
      // The terrace's lamps after dark: GGX with plain inverse-square falloff (their light's range
      // cut-off is for lighting, not for being seen). At a grazing view the lobe draws out into the
      // long columns of light lamps throw on a harbour. The eye resolves the glints a far pixel's
      // averaged slopes blur away, so the lobe keeps at most the roughness of 2 m of wind ripples,
      // and the bulbs, far brighter than the light they are budgeted to throw, count four times.
      vec3 lampStreaks=vec3(0.);
      if(seaLampCount>0){
        float lampA2=pow(min(roughnessFactor,.3),4.);
        float lampNv=max(dot(waveNormal,toEye),1e-3);
        // A uniform bound, so the compiler keeps the loop instead of unrolling it eight times.
        for(int i=0;i<seaLampCount;i++){
          vec3 toLamp=seaLampPosition[i]-seaPoint;
          float lampD2=max(dot(toLamp,toLamp),.25);
          toLamp*=inversesqrt(lampD2);
          vec3 lampH=normalize(toLamp+toEye);
          float lampNl=max(dot(waveNormal,toLamp),0.), lampNh=max(dot(waveNormal,lampH),0.);
          float lampD=lampA2/(PI*pow(lampNh*lampNh*(lampA2-1.)+1.,2.));
          float lampVis=.5/(lampNl*sqrt(lampNv*lampNv*(1.-lampA2)+lampA2)+lampNv*sqrt(lampNl*lampNl*(1.-lampA2)+lampA2)+1e-5);
          lampStreaks+=4.*seaLampColor[i]/lampD2*lampNl*lampD*lampVis*seaFresnel(max(dot(lampH,toEye),0.));
        }
      }
      outgoingLight=totalSpecular+glitter+lampStreaks+waterLeaving+totalEmissiveRadiance;
      outgoingLight=mix(outgoingLight,vec3(.80,.84,.83)*lambert,foam*.83);
      ${seaDebug}
      #include <opaque_fragment>
    `
    );
  };
  physicalWater.customProgramCacheKey = () => `pacific-optics-v6${seaDebug ? `:${seaDebugMode}` : ""}`;
  const modelWater = new THREE.MeshStandardMaterial({ color: 0x8db9bb, roughness: 0.95 });
  const printWater = new THREE.MeshToonMaterial({ color: 0x287b8a });
  const waterGeometry = new THREE.PlaneGeometry(400, 400, 160, 160);
  waterGeometry.rotateX(-Math.PI / 2);
  // Concentrate vertices near the inhabited coast without growing a uniform
  // high-resolution grid over all 400 meters of the distant sea.
  const waterPositions = waterGeometry.getAttribute("position");
  for (let i = 0; i < waterPositions.count; i++) {
    for (const axis of ["X", "Z"]) {
      const value = waterPositions[`get${axis}`](i) / 200;
      waterPositions[`set${axis}`](i, Math.sign(value) * value * value * 200);
    }
  }
  waterGeometry.computeBoundingSphere();
  const ocean = new THREE.Mesh(waterGeometry, modelWater);
  ocean.position.set(0, -7.35, -28);
  ocean.receiveShadow = true;
  // The normal-depth override does not run this material's wave displacement.
  // Its flat mesh would create false animal contacts up to 26 cm away from
  // the sampled beauty surface. Keep the real sea in beauty/reflections and
  // arrival rays; exclude it only from local indirect-contact reconstruction.
  ocean.userData.noContactOcclusion = true;
  root.add(ocean);
  const reflection = createSeaReflection(renderer, scene, ocean, physicalWater);
  const particleSystems = [];
  function particles(kind, emitters, bounds, warmSeconds, size, maxSize, glow, color, falloff) {
    const started = performance.now(),
      // Spray rides the open coast's wind; dust drifts in the air the glass front lets in.
      wind = kind === "spray" ? coastWind.outdoor : coastWind.indoor,
      population = createWindParticles({ kind, emitters: new Float32Array(emitters), bounds, timeOffset: -warmSeconds, wind }),
      geometry = new THREE.BufferGeometry();
    // Deterministic active-time prewarm supplies a mature still composition,
    // including reduced motion. The history ends at scene time zero.
    for (let i = 0; i < Math.round(warmSeconds * 60); i++) population.advance(1 / 60);
    geometry.setAttribute("position", new THREE.BufferAttribute(population.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("particleOpacity", new THREE.BufferAttribute(population.opacity, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `attribute float particleOpacity; varying float alpha;
        void main(){ vec4 eye=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*eye;
        gl_PointSize=clamp(${size.toFixed(1)}/-eye.z,1.,${maxSize.toFixed(1)});alpha=particleOpacity*${glow.toFixed(3)}; }`,
      fragmentShader: `varying float alpha;void main(){vec2 p=gl_PointCoord-.5;
        gl_FragColor=vec4(vec3(${color.join(",")}),exp(-dot(p,p)*${falloff.toFixed(1)})*alpha);}`,
    });
    const object = new THREE.Points(geometry, material);
    // Bounds are fixed emitter volumes; their particles cannot leave them.
    const box = new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max));
    geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    root.add(object);
    particleSystems.push({ population, geometry, material, prewarmMilliseconds: performance.now() - started });
    return object;
  }
  // Advected surf droplets and sunlit dust: bounded particle lifetimes, not
  // an image overlay. The same clock pauses with the inhabited world.
  const mistPositions = [];
  for (let i = 0; i < 140; i++) {
    const x = -22 + ((i * 3.719) % 67),
      p = beachPoint(x, 0.47, beach);
    mistPositions.push(x, -7.3, p[2] - 1.4);
  }
  const spray = particles("spray", mistPositions, { min: [-23, -7.34, -100], max: [46, -6.8, 20] }, 1, 36, 7, 0.17, [0.86, 0.91, 0.85], 15);
  spray.name = "Breaking-wave spray";
  const dust = particles(
    "dust",
    Array.from({ length: 42 }, (_, i) => [-1.2 + ((i * 0.719) % 2.4), 3 + ((i * 0.31) % 2.2), 2.4 + ((i * 0.437) % 2)]).flat(),
    { min: [-1.45, 2.85, 2.25], max: [1.45, 5.35, 4.55] },
    18,
    6,
    3,
    0.25,
    [1.0, 0.86, 0.62],
    20
  );
  dust.name = "Dust in the study light";

  // The modeled sky also supplies a physically useful environment reflection.
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(0x6c9fc4) },
      horizon: { value: new THREE.Color(0xdde0d7) },
      sunDirection: { value: new THREE.Vector3(-14, 18, -22).normalize() },
      night: { value: 0 },
      sunRadiance: { value: 5 },
      printMode: ink,
    },
    // The view direction from whichever camera draws the dome (the orbit, the sea mirror, the
    // environment capture), so the dome can follow the orbit camera out to a 160 m view.
    vertexShader:
      "varying vec3 direction; void main(){ direction = (modelMatrix * vec4(position,1.0)).xyz - cameraPosition; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `${surfaceNoise}
      uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDirection; uniform float night; uniform float sunRadiance; varying vec3 direction;
      void main(){
        vec3 d = normalize(direction);
        float height = pow(max(0.0,d.y),.45);
        vec3 color = mix(horizon,zenith,height);
        float alignment = max(0.0,dot(d,sunDirection));
        color += vec3(1.0,.83,.58) * pow(alignment,28.0) * .2 * (1.-night);
        color += vec3(1.0,.88,.69) * pow(alignment,2200.0) * sunRadiance;
        vec3 cloudPoint = vec3(d.xz / max(.14,d.y+.18) * 2.4, .4);
        float clouds = smoothstep(.56,.75,stoneNoise(cloudPoint)) * smoothstep(-.02,.16,d.y);
        color = mix(color, horizon*1.08, clouds*.36*(1.-night));
        float stars = pow(hash31(floor(d*780.0)),280.0)*smoothstep(.1,.8,d.y)*night;
        color += stars*vec3(.35,.44,.55);
        gl_FragColor = vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 40, 24), skyMaterial);
  sky.renderOrder = -10;
  root.add(sky);

  // Physical ribbons distinguish a quiet model sea from drawn comic surf.
  const caps = new THREE.Group();
  root.add(caps);
  const capMaterial = new THREE.MeshBasicMaterial({ color: 0xe5eeee, transparent: true, opacity: 0.58 });
  const capGeometries = [];
  for (let i = 0; i < 42; i++) {
    const x = ((i * 5.47) % 46) - 23,
      z = -4 - ((i * 3.73) % 42);
    const points = Array.from(
      { length: 7 },
      (_, j) => new THREE.Vector3(x + j * 0.34, -7.31 + Math.sin(j * 0.52 + i) * 0.014, z + Math.sin(j * 0.6 + i) * 0.13)
    );
    capGeometries.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, 0.018, 3, false));
  }
  caps.add(new THREE.Mesh(mergeGeometries(capGeometries), capMaterial));
  capGeometries.forEach((g) => g.dispose());
  const printSun = new THREE.Mesh(new THREE.SphereGeometry(2.0, 24, 12), new THREE.MeshBasicMaterial({ color: 0xf08a49 }));
  printSun.position.set(-12, 9, -48);
  root.add(printSun);
  // One generator and capture scene for the home's lifetime. A generator disposed after each
  // capture released its blur program, and PMREMGenerator draws a fresh background material behind
  // every capture, so each rebuild (every 20-minute light step, a dragged sun-arc preview) relinked
  // both and the first capture also waited on the sky's program: about 0.3 s of blocked page.
  // A held copy of that background material keeps its program, and all three programs are created
  // here, before the first capture, so the driver compiles them in parallel with the coast's load.
  const capture = new THREE.Scene();
  capture.add(sky.clone());
  const pmrem = new THREE.PMREMGenerator(renderer);
  const captureBackground = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false })
  );
  const captureTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  {
    const previous = renderer.getRenderTarget(),
      captureCamera = new THREE.PerspectiveCamera(90, 1, 0.1, 180);
    // fromScene sizes its targets and creates the blur material on first use (three r164's
    // _setSize/_allocateTargets); doing it here at the same 256 px leaves fromScene that material.
    if (typeof pmrem._setSize === "function" && typeof pmrem._allocateTargets === "function") {
      pmrem._setSize(256);
      pmrem._allocateTargets().dispose();
    }
    renderer.setRenderTarget(captureTarget);
    try {
      renderer.compile(capture, captureCamera);
      renderer.compile(captureBackground, captureCamera);
      if (pmrem._blurMaterial && pmrem._lodPlanes?.[0]) renderer.compile(new THREE.Mesh(pmrem._lodPlanes[0], pmrem._blurMaterial), captureCamera);
    } finally {
      renderer.setRenderTarget(previous);
    }
  }
  function makeEnvironment() {
    if (environment) environment.dispose();
    environment = pmrem.fromScene(capture, 0.04, 0.1, 180);
    scene.environment = environment.texture;
  }
  function setPalette(next, light) {
    // PMREM captures are static across a 20-minute light interval; animation
    // never rebuilds them. The visible sun still follows the current minute.
    if (light) skyMaterial.uniforms.sunDirection.value.fromArray(light.keyDirection).normalize();
    const key = `${next}:${light ? Math.floor(light.minute / 20) : "authored"}`;
    if (skyKey === key && environment) return;
    skyKey = key;
    palette = next;
    const night = light ? light.daylight < 0.15 : next === "evening";
    skyMaterial.uniforms.zenith.value.set(night ? 0x112441 : next === "morning" ? 0x8bb3c8 : 0x4b92bd);
    skyMaterial.uniforms.horizon.value.set(night ? 0x435771 : next === "afternoon" ? 0xbfcfce : 0xd9e5e7);
    skyMaterial.uniforms.night.value = light ? 1 - light.daylight : night ? 1 : 0;
    skyMaterial.uniforms.sunRadiance.value = light ? 0.2 + light.sunlight * 4.8 : night ? 0.2 : 5;
    if (!light) skyMaterial.uniforms.sunDirection.value.set(next === "afternoon" ? -14 : 10, night ? 16 : 18, -22).normalize();
    physicalWater.color.set(night ? 0x122a3c : 0x185462);
    modelWater.color.set(night ? 0x526d86 : 0x8db9bb);
    printWater.color.set(night ? 0x273e66 : 0x267787);
    if (style === "realistic") {
      makeEnvironment();
      scene.fog.color.copy(skyMaterial.uniforms.horizon.value);
    }
  }
  function setStyle(next) {
    style = next;
    ocean.material = style === "realistic" ? physicalWater : style === "illustrated" ? printWater : modelWater;
    sky.visible = style === "realistic";
    caps.visible = style !== "realistic";
    caps.scale.y = 1;
    capMaterial.color.set(style === "illustrated" ? 0xf4e2b3 : 0xe5eeee);
    capMaterial.opacity = style === "illustrated" ? 0.9 : 0.42;
    caps.children.forEach((o) => (o.scale.z = style === "illustrated" ? 1.35 : 1));
    spray.visible = style === "realistic";
    dust.visible = style === "realistic";
    printSun.visible = style === "illustrated";
    scene.environment = style === "realistic" ? environment?.texture || null : null;
    // Keep near-shore surface contrast at the authored 24–72 m exterior
    // distance. This bounded haze is a clear-day art direction, not weather.
    scene.fog = style === "realistic" ? new THREE.Fog(skyMaterial.uniforms.horizon.value, 65, 180) : null;
    // The first palette update builds the sky environment for the actual hour.
    // Building a default environment here compiled and captured the sky twice.
  }
  function syncWakes() {
    const marks = wildlife.waterMarks?.() || [],
      a = seaLight.seaWakeA.value,
      b = seaLight.seaWakeB.value;
    let count = 0;
    for (const mark of marks) {
      if (count >= SEA_WAKES || (mark.wake * mark.speed < 0.05 && (mark.ring <= 0 || mark.ringAge > 4))) continue;
      a.set([mark.x, mark.z, mark.dx, mark.dz], count * 4);
      b.set([mark.speed, mark.wake, mark.ring, mark.ringAge], count * 4);
      count++;
    }
    seaLight.seaWakeCount.value = count;
  }
  // Outdoor lamps for the streaks: the festoon's chords (each at its middle, carrying its length's
  // light), the fire bowl, and the terrace wall lights. Indoor fixtures are left out: their mirror
  // images would need a visibility test through the glass front.
  const lampScratch = new THREE.Vector3();
  function syncLamps() {
    if (!lampSources) return;
    const { installations, practicals } = lampSources,
      position = seaLight.seaLampPosition.value,
      color = seaLight.seaLampColor.value;
    let count = 0;
    const add = (x, y, z, r, g, b) => {
      if (count >= SEA_LAMPS || r + g + b <= 1e-4) return;
      position.set([x, y, z], count * 3);
      color.set([r, g, b], count * 3);
      count++;
    };
    if (installations) {
      const u = installations.uniforms,
        c = u.installLineColor.value;
      // Each swag of the festoon is two chords meeting at its lowest bulbs: one lamp there, with both.
      const lines = installations.lines;
      for (let i = 0; i + 1 < lines.length; i++) {
        if (lines[i].id !== "festoon" || lines[i + 1].id !== "festoon" || !lines[i].b.equals(lines[i + 1].a)) continue;
        const a = lines[i].a.distanceTo(lines[i].b),
          b = lines[i + 1].a.distanceTo(lines[i + 1].b);
        add(
          lines[i].b.x,
          lines[i].b.y,
          lines[i].b.z,
          c[i * 3] * a + c[i * 3 + 3] * b,
          c[i * 3 + 1] * a + c[i * 3 + 4] * b,
          c[i * 3 + 2] * a + c[i * 3 + 5] * b
        );
        i++;
      }
      installations.points.forEach((point, i) => {
        if (point.id !== "fire") return;
        const c = u.installPointColor.value;
        add(point.position.x, point.position.y, point.position.z, c[i * 3], c[i * 3 + 1], c[i * 3 + 2]);
      });
    }
    for (const light of practicals?.lights || []) {
      if (!/terrace/i.test(light.name) || !light.visible) continue;
      light.getWorldPosition(lampScratch);
      add(
        lampScratch.x,
        lampScratch.y,
        lampScratch.z,
        light.color.r * light.intensity,
        light.color.g * light.intensity,
        light.color.b * light.intensity
      );
    }
    seaLight.seaLampCount.value = count;
  }
  // What the water reads from the sky: the sun's direction, its light (linear, intensity included) and
  // the hue the water gives it. The atmosphere work is to back this accessor with its own values
  // (planned as pacific.atmosphere: horizon and zenith colour, the sun's direction, colour and
  // radiance, the haze). Until then it reads the scene's sun light, which keeps its daytime colour
  // down to the horizon, and supplies the hue of direct light low over the sea itself (sunTint in
  // sea-optics.mjs, from the day's real sun altitude). That tint is provisional: once the sun light
  // carries the colour, it goes.
  let daylightNow = null;
  const seaSky = {
    sunDirection: new THREE.Vector3(0, 1, 0),
    sunLight: new THREE.Color(0, 0, 0),
    sunTint: new THREE.Color(1, 1, 1),
    sunAltitude: null,
  };
  function waterSky() {
    if (!sun) return seaSky;
    sun.updateMatrixWorld();
    sun.target.updateMatrixWorld();
    seaSky.sunDirection.setFromMatrixPosition(sun.matrixWorld).sub(lampScratch.setFromMatrixPosition(sun.target.matrixWorld)).normalize();
    seaSky.sunLight.copy(sun.color).multiplyScalar(sun.intensity);
    // The key light is the sun while any of it is up (daylight.mjs keyDirection), the authored moon after.
    const up = daylightNow && daylightNow.sunlight > 0;
    seaSky.sunAltitude = up ? daylightNow.altitude : null;
    if (up) seaSky.sunTint.setRGB(...sunTint(daylightNow.altitude, seaSky.sunLight.toArray()));
    else seaSky.sunTint.setRGB(1, 1, 1);
    return seaSky;
  }
  // The seabed's light: the water's sun (or the night's moon light), unshadowed, and the shadow matrix
  // the sea uses to look up shade where a sun ray reaches the seabed.
  function syncSeaLight() {
    if (!sun) {
      scene.traverse((object) => {
        if (!sun && object.isDirectionalLight && object.castShadow) sun = object;
      });
      if (sun) seaLight.seaShadowMatrix.value = sun.shadow.matrix;
    }
    syncLamps();
    if (!sun) return;
    const { sunDirection, sunLight, sunTint: tint } = waterSky();
    seaLight.seaSunDirection.value.copy(sunDirection);
    seaLight.seaSunColor.value.copy(sunLight).multiply(tint);
    seaLight.seaSunTint.value.copy(tint);
  }
  function update(elapsed, delta = 0) {
    time.value = elapsed;
    for (const { population, geometry } of particleSystems) {
      if (population.advance(delta, { fieldTime: elapsed })) {
        geometry.getAttribute("position").needsUpdate = true;
        geometry.getAttribute("particleOpacity").needsUpdate = true;
      }
    }
    caps.position.x = Math.sin(elapsed * 0.18) * 0.16;
    wildlife.update(elapsed, palette);
    syncWakes();
  }
  function dispose() {
    shoreTexture.dispose();
    bathymetry.dispose();
    wildlife.dispose();
    reflection.dispose();
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    [physicalWater, modelWater, printWater, skyMaterial, capMaterial, printSun.material].forEach((m) => m.dispose());
    environment?.dispose();
    pmrem.dispose();
    captureBackground.geometry.dispose();
    captureBackground.material.dispose();
    captureTarget.dispose();
    particleSystems.forEach(({ material }) => material.dispose());
    root.removeFromParent();
  }
  setStyle(style);
  return {
    setStyle,
    // The water keeps the day's real sun (daylight.mjs coastalDaylight) for its hue.
    setPalette(next, light) {
      if (light) daylightNow = light;
      setPalette(next, light);
    },
    waterSky,
    lightColors: () => ({ zenith: skyMaterial.uniforms.zenith.value.toArray(), horizon: skyMaterial.uniforms.horizon.value.toArray() }),
    update,
    dispose,
    // The dome stays centred on the orbit camera and inside its far plane (camera.mjs farView).
    followCamera(position, radius) {
      sky.position.copy(position);
      sky.scale.setScalar(radius / 120);
    },
    pick: (raycaster) => wildlife.pick?.(raycaster) || null,
    neighbours: () => wildlife.targets?.() || [],
    neighbour: (id) => wildlife.target?.(id) || null,
    evidence: () => ({
      wildlife: wildlife.evidence(),
      beachWidth: beach.width,
      particles: 140 + 42,
      particleMotion: particleSystems.map(({ population, prewarmMilliseconds }) => ({ ...population.evidence(), prewarmMilliseconds })),
      water: {
        waves: OCEAN_WAVES.length,
        vertices: waterPositions.count,
        triangles: waterGeometry.index.count / 3,
        seconds: time.value,
        sample: sampleOcean(0, 0, time.value, 0.02),
        reflection: reflection.evidence(),
        optics: {
          method: "Lee et al. 1998 shallow-water reflectance over a captured seabed / paraxial ripple caustics / Pope and Fry pure-water absorption",
          water: { ...LA_JOLLA_WATER },
          absorption: seaIOPs.a,
          backscatter: seaIOPs.bb,
          seabed: bathymetry.evidence(),
          lamps: seaLight.seaLampCount.value,
          wakes: seaLight.seaWakeCount.value,
          // The water's sun: its altitude (null while the key light is the moon) and hue.
          sun: { altitude: seaSky.sunAltitude, tint: seaLight.seaSunTint.value.toArray(), apart: SEA_LIGHTS_BEGIN.includes("RE_Direct_SeaSun") },
        },
      },
    }),
    reflect(camera, enabled) {
      syncSeaLight();
      reflection.update(camera, enabled);
    },
    // The terrace's light installations and warm practicals, whose lamps the water mirrors at night.
    bindLamps(installations, practicals) {
      lampSources = { installations, practicals };
    },
    // Read the seabed from the coast's geometry (bathymetry.mjs): the coast now, before the first
    // frame; the hinterland's coves later without waiting on the GPU (`done` runs once it lands).
    captureSeabed: (roots) => bathymetry.capture(roots),
    captureSeabedAsync: (roots, done) => bathymetry.captureAsync(roots, done),
    // Beach sand stops casting sun shadows: it lies within a shadow-map texel of the shallow water
    // over it and shaded that water in straight-edged patches.
    quietSand(root) {
      root?.traverse((object) => {
        if (object.isMesh && [object.material].flat().some((m) => SAND_NAME.test(m?.name || ""))) object.castShadow = false;
      });
    },
    seabedAt: (x, z) => bathymetry.sample(x, z),
  };
}
