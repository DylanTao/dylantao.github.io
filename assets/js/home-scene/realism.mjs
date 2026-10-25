import * as THREE from "../three.module.min.js";
import { EffectComposer } from "../vendor/three-r164/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/three-r164/postprocessing/RenderPass.js";
import { SSAOPass } from "../vendor/three-r164/postprocessing/SSAOPass.js";
import { OutputPass } from "../vendor/three-r164/postprocessing/OutputPass.js";
import { CONTACT_RADIUS, CONTACT_SLICES, CONTACT_STEPS, horizonFragment, bilateralFragment, bindContactLighting } from "./contact-occlusion.mjs";
import { createGpuTimer } from "./gpu-timer.mjs";
import { createVolumeDepth } from "./volume-depth.mjs";
import { floraSwayProfile, patchFloraSway } from "./plant-motion.mjs";

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

// The same noise for the stone surfaces below that call stoneNoise at up to a dozen sites
// (sandstone, plaster, marble, travertine). Its three octaves are computed in a loop whose count is
// a uniform, so ANGLE's Direct3D compiler keeps one octave instead of unrolling three at every
// site: 40-45 % of the cliff sandstone's compile time, 25-35 % of the marble's and travertine's
// on the Intel Arc laptop (docs/performance-notes.md). They are summed by the original expression,
// so the values match the unrolled form. Surfaces with one or two calls keep the plain form,
// which compiles as fast there.
const LOOPED_NOISE_KINDS = new Set([3, 5, 6, 7]);
const surfaceOctaves = { value: 3 };
const loopedSurfaceNoise = surfaceNoise.replace(
  /float stoneNoise\(vec3 p\) \{\s*return grainNoise\(p\)\*\.57 \+ grainNoise\(p\*2\.03\)\*\.28 \+ grainNoise\(p\*4\.17\)\*\.15;\s*\}/,
  `uniform int surfaceOctaves;
float stoneNoise(vec3 p) {
  float octaves[3];
  for (int octave = 0; octave < surfaceOctaves; octave++) octaves[octave] = grainNoise(octave == 0 ? p : p * (octave == 1 ? 2.03 : 4.17));
  return octaves[0]*.57 + octaves[1]*.28 + octaves[2]*.15;
}`
);

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

// The clifftop's leaves, needles and grass (bin/coastal_flora.py) carry a sway weight in uv.x,
// 0 at the plant's base and 1 at its top. They bend in the coast's one wind (plant-motion.mjs,
// patchFloraSway): a lean that follows the sea breeze, gusts that roll across the bluff downwind with
// the fronts that cross the water, and each species' own sway and flutter. The same hook runs on the
// mesh's depth and distance materials, so the shadows move with the leaves. The motion freezes with
// the scene's clock.
function swayInBreeze(material, mesh) {
  const profile = floraSwayProfile(material.name);
  const sway = (shader) => patchFloraSway(shader, profile);
  material.onBeforeCompile = sway;
  material.customProgramCacheKey = () => "coastal-breeze-foliage-v2";
  if (!mesh || mesh.isSkinnedMesh || mesh.customDepthMaterial || Array.isArray(mesh.userData.baseMaterial ?? mesh.material)) return;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }),
    distance = new THREE.MeshDistanceMaterial();
  depth.onBeforeCompile = distance.onBeforeCompile = sway;
  depth.customProgramCacheKey = () => "coastal-breeze-foliage-depth-v2";
  distance.customProgramCacheKey = () => "coastal-breeze-foliage-distance-v2";
  mesh.customDepthMaterial = depth;
  mesh.customDistanceMaterial = distance;
}

// One program per surface finish (2026-10-24). Most of the coast and a few house pieces were
// exported without the baked vertex colour that every other piece of the same surface carries;
// eleven materials came in both forms, so each compiled a second program (the cliff's sandstone
// alone takes 10-25 s on ANGLE/D3D11). Those meshes draw with white, which multiplies the diffuse
// colour by exactly one and is all that vertex colour does in these shaders, so they share the
// painted program. The attribute matches the exports' normalized 8-bit RGBA, keeping one vertex
// layout; about 65,000 vertices, 260 KB.
function shareVertexColorProgram(material, mesh) {
  const geometry = mesh.geometry;
  if (mesh.isSkinnedMesh || mesh.isInstancedMesh || !geometry?.attributes.position) return;
  if (material.vertexColors || material.transparent || material.transmission > 0) return;
  // A geometry shared by several meshes is painted once; each of them then opts in.
  if (!geometry.attributes.color) {
    geometry.setAttribute("color", new THREE.BufferAttribute(new Uint8Array(geometry.attributes.position.count * 4).fill(255), 4, true));
    geometry.userData.whiteVertexColor = true;
  }
  if (geometry.userData.whiteVertexColor) material.vertexColors = true;
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
          // Clear turquoise over the stone (2026-10-18): this colour after 0.6 m of water. At 1.5 m the
          // 13 cm bath read as a white basin under a sheen of sky.
          attenuationColor: new THREE.Color(0x93c8c1),
          attenuationDistance: 0.6,
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
  shareVertexColorProgram(m, mesh);
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
    if (floraSwayProfile(name)) swayInBreeze(m, mesh);
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
  const cloth = /linen|textile|cotton|trousers|woven|boucle/i.test(name);
  // The house's walls are lime plaster (Sirui, 2026-10-16); the renovation's stone family is a
  // milky veined marble, travertine and honed limestone.
  const plaster = /chalk limestone|plaster|limewash/i.test(name);
  const marble = /marble/i.test(name);
  const travertine = /travertine/i.test(name);
  const rock = plaster || marble || /sandstone|sediment|limestone|stone|sand/i.test(name);
  const water = /water|turquoise/i.test(name);
  if (water) {
    // The environment map is the open sky; under the bath's vault it only whitened the water.
    m.envMapIntensity = 0.55;
    return bindContactLighting(m, contactLighting);
  }
  m.roughness = wood ? 0.48 : cloth ? 0.96 : plaster ? 0.62 : marble ? 0.24 : travertine ? 0.62 : rock ? 0.89 : m.roughness;
  m.envMapIntensity = cloth ? 0.35 : plaster ? 0.55 : 0.7;
  if (!wood && !cloth && !rock) return bindContactLighting(m, contactLighting);
  const kind = wood
    ? 1
    : cloth
      ? 2
      : plaster
        ? 5
        : marble
          ? 6
          : travertine
            ? 7
            : /sandstone|sediment/i.test(name)
              ? 3
              : /beach|tideline/i.test(name)
                ? 4
                : 0;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.surfaceOctaves = surfaceOctaves;
    shader.vertexShader = "varying vec3 surfacePoint;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\nsurfacePoint = (modelMatrix * vec4(transformed, 1.0)).xyz;"
    );
    shader.fragmentShader =
      `varying vec3 surfacePoint;\n${LOOPED_NOISE_KINDS.has(kind) ? loopedSurfaceNoise : surfaceNoise}\n${kind === 3 ? cellsGLSL : ""}\n${kind === 5 ? plasterGLSL : ""}\n` +
      shader.fragmentShader;
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
        // Close-range sandstone (Sirui, 2026-10-14). Steepness comes from the surface itself.
        vec3 sandFlat = normalize(cross(dFdx(p), dFdy(p)));
        float sandUp = abs(sandFlat.y);
        float sandFoot = max(length(dFdx(p)), length(dFdy(p)));
        // Bedding planes of uneven thickness, gently warped, each bed its own shade of iron
        // staining. A bedding line shows only in places, as weathering picks it out, and fades
        // before it is thinner than a pixel.
        float bed = (p.y + .2*stoneNoise(vec3(p.x*.18, 3.1, p.z*.18)) - .05*detail) / .26;
        bed += .35*sin(bed*1.9 + 1.3) + .2*sin(bed*4.1);
        float bedDistance = abs(fract(bed + .5) - .5);
        float bedWidth = sandFoot / .26;
        float bedShow = smoothstep(.45, .75, stoneNoise(vec3(p.x*.12, floor(bed)*2.3, p.z*.12)));
        float bedLine = (1.-smoothstep(.05, .05 + bedWidth*1.5, bedDistance)) * (1.-smoothstep(.06, .3, bedWidth)) * smoothstep(.92, .6, sandUp) * bedShow;
        float stain = stoneNoise(vec3(p.x*.12, floor(bed)*1.37, p.z*.12));
        // Honeycomb weathering (tafoni), the pitted cells of La Jolla's sandstone, in patches on
        // steep faces: Worley cells whose walls stand proud of their hollows.
        vec2 sandFace = abs(sandFlat.x) > abs(sandFlat.z) ? p.zy : p.xy;
        float tafoniZone = smoothstep(.6, .74, stoneNoise(vec3(p.x*.17, p.y*.23, p.z*.17))) * smoothstep(.75, .35, sandUp);
        float sandPit = 0.;
        float tafoniFade = 1.-smoothstep(.012, .045, sandFoot);
        if (tafoniZone * tafoniFade > 0.) {
          vec2 cells = sandCells(sandFace / .16);
          // Rounded hollows: the depth eases in from the cell walls rather than stepping.
          sandPit = sqrt(smoothstep(.02, .6, cells.y - cells.x)) * tafoniZone * tafoniFade;
        }
        // Desert varnish: dark streaks where runoff stains the faces.
        float varnish = smoothstep(.6, .86, stoneNoise(vec3(p.x*1.4, p.y*.06, p.z*1.4))) * smoothstep(.8, .3, sandUp);
        diffuseColor.rgb *= pigment * (1. - .08*bedLine) * (1. - .12*sandPit);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.06,.96,.84), smoothstep(.5,.85,erosion)*.18);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.08,.93,.78), smoothstep(.55,.8,stain)*.3*smoothstep(.9,.6,sandUp));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(.72,.68,.64), varnish*.45);
        // The clifftop: dusty topsoil with patches of dry grass between the scrub.
        float ground = smoothstep(.72, .92, sandUp) * smoothstep(4.5, 5.5, p.y);
        float grass = smoothstep(.45, .75, stoneNoise(vec3(p.x*.9, 7.7, p.z*.9)) + .25*grainNoise(p*7.));
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(.34,.24,.14)*(.9+.2*detail), vec3(.4,.34,.15), grass*.7), ground*.5);
        // The intertidal zone (mean sea level -7.35 m; La Jolla's tides range about 1.7 m): rock
        // the high tide reaches stays wet, darker and glossier; green-brown algae band the lower
        // rock and pale barnacles speckle the zone above it.
        float sandWet = 1.-smoothstep(-6.55, -6.1, p.y + .15*(detail-.5));
        float algae = 1.-smoothstep(.0, .22, abs(p.y + 6.95 + .1*(detail-.5)));
        float barnacles = step(.82, grainNoise(p*58.)) * smoothstep(-6.95, -6.7, p.y) * (1.-smoothstep(-6.4, -6.15, p.y)) * (1.-smoothstep(.004, .012, sandFoot));
        diffuseColor.rgb *= 1. - .38*sandWet;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.12,.14,.06), algae*.55);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.62,.6,.55), barnacles*.7);
        float sandHeight = -.014*sandPit + .002*barnacles;
      `
              : kind === 4
                ? `
        float wetSand = 1.0-smoothstep(-7.30,-7.03,p.y + (detail-.5)*.045);
        diffuseColor.rgb = mix(vec3(.76,.64,.45),vec3(.43,.37,.27),wetSand);
        diffuseColor.rgb *= .92 + .08*detail + .025*pores;
      `
                : kind === 5
                  ? `
        // Lime plaster: soft clouds about a metre across, overlapping trowel strokes whose direction
        // changes from patch to patch, and a faint burnish along the strokes. The strokes are drawn
        // in the three axis planes and blended by the surface normal, so curved vaults show no seam.
        #ifdef FLAT_SHADED
          vec3 plasterNormal = normalize(cross(dFdx(p), dFdy(p)));
        #else
          vec3 plasterNormal = inverseTransformDirection(vNormal, viewMatrix);
        #endif
        vec3 plasterAxes = pow(abs(plasterNormal), vec3(4.0));
        plasterAxes /= max(plasterAxes.x + plasterAxes.y + plasterAxes.z, 1e-4);
        float plasterFoot = max(length(dFdx(p)), length(dFdy(p)));
        float plasterFade = 1.0 - smoothstep(.005, .03, plasterFoot);
        float trowel = plasterAxes.x*plasterTrowel(p.zy, 1.3) + plasterAxes.y*plasterTrowel(p.xz, 2.9) + plasterAxes.z*plasterTrowel(p.xy, 4.7);
        float clouds = stoneNoise(p*.85 + 1.7)*.65 + stoneNoise(p*2.6 + 9.1)*.35;
        float plasterBurnish = smoothstep(.52, .86, trowel) * plasterFade * (.4 + .6*clouds);
        diffuseColor.rgb *= .85 + .22*clouds + .1*(trowel - .5)*plasterFade;
        // Lime takes up a little warmth unevenly as it cures.
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.03,1.,.95), smoothstep(.45,.8,stoneNoise(p*.42 + 5.3))*.7);
      `
                  : kind === 6
                    ? `
        // Milky marble: soft clouding, a few soft grey veins that wander and branch, finer hairlines
        // between them. Veins widen and fade with distance instead of shimmering.
        float marbleFoot = max(length(dFdx(p)), length(dFdy(p)));
        float marbleWarp = stoneNoise(p*1.3 + 2.1)*3.2 + stoneNoise(p*4.1)*.8;
        float veinWidth = .03 + .05*stoneNoise(p*.7) + marbleFoot*10.;
        float veins = (1. - smoothstep(0., veinWidth, abs(sin(dot(p, vec3(2.3,1.1,1.7))*2.6 + marbleWarp*2.4))))
          * smoothstep(.32, .62, stoneNoise(p*.9 + 4.));
        float hairlines = (1. - smoothstep(0., .012 + marbleFoot*10., abs(sin(dot(p, vec3(-1.4,2.2,.6))*7. + marbleWarp*4.))))
          * smoothstep(.45, .7, stoneNoise(p*1.7 + 6.)) * .55;
        float marbleCloud = stoneNoise(p*2.2 + 8.);
        float marbleFade = 1. - smoothstep(.01, .06, marbleFoot);
        diffuseColor.rgb *= .955 + .055*marbleCloud;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(.6,.6,.63), max(veins, hairlines)*.5*marbleFade);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.02,.99,.95), smoothstep(.5,.8,marbleCloud)*.4);
      `
                    : kind === 7
                      ? `
        // Travertine: warm bands laid down in layers, and small open pores.
        float travFoot = max(length(dFdx(p)), length(dFdy(p)));
        float travBands = stoneNoise(vec3(p.x*.55, p.y*7. + p.z*7. + stoneNoise(p*.8)*2.5, p.z*.55 + p.x*.2));
        float travPores = step(.83, grainNoise(p*62.)) * (1. - smoothstep(.002, .008, travFoot));
        diffuseColor.rgb *= .88 + .16*travBands + .04*pores;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.05,.98,.9), smoothstep(.55,.8,travBands)*.35);
        diffuseColor.rgb *= 1. - .3*travPores;
      `
                      : `diffuseColor.rgb *= .86 + .20*detail + .045*pores;`
      }
    `
    );
    if (kind === 5)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .3, plasterBurnish);"
      );
    if (kind === 6)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + .07*(marbleCloud - .5), .12, .5);"
      );
    if (kind === 4)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(.96,.34,1.0-smoothstep(-7.30,-7.03,surfacePoint.y));"
      );
    if (kind === 3)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .3, sandWet);"
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
      #include <normal_fragment_maps>
      // Derivative bump mapping on the actual surface; filtered below a pixel.
      float footprint = max(length(dFdx(surfacePoint)), length(dFdy(surfacePoint)));
      float detailFade = 1.0-smoothstep(.025,.12,footprint);
      float height = detailFade * ${
        kind === 1
          ? "grainNoise(vec3(surfacePoint.x*95.0,surfacePoint.y*24.0,surfacePoint.z*2.5)) * .0007"
          : kind === 2
            ? "grainNoise(surfacePoint*140.0)*.0004"
            : kind === 3
              ? "stoneNoise(surfacePoint*3.0)*.022 + sandHeight"
              : kind === 5
                ? "(trowel*.0007 + clouds*.0014)"
                : kind === 6
                  ? "stoneNoise(surfacePoint*40.0)*.00015"
                  : kind === 7
                    ? "stoneNoise(surfacePoint*24.0)*.0006 - travPores*.0012"
                    : "stoneNoise(surfacePoint*32.0)*.001"
      };
      vec3 eyeX = dFdx(-vViewPosition), eyeY = dFdy(-vViewPosition);
      vec3 r1 = cross(eyeY, normal), r2 = cross(normal, eyeX);
      float det = dot(eyeX, r1);
      vec3 gradient = sign(det) * (dFdx(height)*r1 + dFdy(height)*r2);
      normal = normalize(abs(det)*normal - gradient);
    `
    );
  };
  m.customProgramCacheKey = () => `coastal-physical-${kind}-v8`;
  return bindContactLighting(m, contactLighting);
}

// Trowel strokes for lime plaster in one axis plane (q in metres): anisotropic noise along three
// stroke directions, bent into gentle arcs by a bounded warp, with each patch of wall taking its
// own direction, as overlapping passes of a trowel do.
const plasterGLSL = `
float plasterStreak(vec2 q, vec2 d, float seed) {
  vec2 n = vec2(-d.y, d.x);
  return grainNoise(vec3(dot(q, d)*3.1, dot(q, n)*15.0, seed));
}
float plasterTrowel(vec2 q, float seed) {
  q += .16*vec2(grainNoise(vec3(q*.9, seed)), grainNoise(vec3(q*.9, seed + 3.1))) - .08;
  float a = plasterStreak(q, vec2(.97, .24), seed);
  float b = plasterStreak(q, vec2(.42, .91), seed + 2.);
  float c = plasterStreak(q, vec2(.83, -.56), seed + 4.);
  float ab = mix(a, b, smoothstep(.38, .62, grainNoise(vec3(q*1.6, seed + 7.3))));
  return mix(ab, c, smoothstep(.55, .75, grainNoise(vec3(q*1.6, seed + 11.7))));
}`;

// Distances to the nearest and second-nearest feature points of 2D Worley noise (Worley, "A
// Cellular Texture Basis Function", SIGGRAPH 1996): the sandstone's honeycomb cells.
const cellsGLSL = `
vec2 sandHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
vec2 sandCells(vec2 x) {
  vec2 n = floor(x), f = fract(x);
  float f1 = 8., f2 = 8.;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 r = vec2(i, j) + sandHash(n + vec2(i, j)) - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
  return sqrt(vec2(f1, f2));
}`;

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
// loaded on demand; it glows only HDR highlights above the threshold, before tone mapping. `haze`
// (haze.mjs) lays the coast's air over the beauty pass from its resolved depth, before the bloom, so
// a low sun's glow and the lamps bloom through it.
export function createFinish(
  renderer,
  scene,
  camera,
  { transparentOutput = false, profileGPU = false, bloom: bloomLook = null, haze = null, temporalFactory = null } = {}
) {
  if (transparentOutput) return createLegacyFinish(renderer, scene, camera, { transparentOutput });
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: 4,
    depthTexture: haze ? new THREE.DepthTexture(1, 1) : null,
  });
  const composer = new EffectComposer(renderer, target);
  // The composer's second target is a clone, and a cloned DepthTexture shares its source, so both
  // targets would share one GL depth texture. Multisampled targets render depth into their own
  // renderbuffers and only resolve into it; without multisampling (large full-screen buffers,
  // resolution.mjs detailFor) the haze pass would sample the depth texture attached to the very
  // target it draws into, a feedback loop the browser refuses. The second target gets its own.
  if (target.depthTexture) composer.renderTarget2.depthTexture = new THREE.DepthTexture(1, 1);
  const beauty = new RenderPass(scene, camera),
    contact = new SSAOPass(scene, camera, 1, 1, 1),
    output = new OutputPass(),
    bloom = bloomLook ? new bloomLook.Pass(new THREE.Vector2(1, 1), bloomLook.strength, bloomLook.radius, bloomLook.threshold) : null,
    gpuTimer = createGpuTimer(renderer.getContext(), profileGPU),
    volumeDepth = createVolumeDepth(renderer, scene),
    temporal = temporalFactory?.(renderer, scene);
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
  if (temporal) composer.addPass(temporal.pass);
  if (haze) composer.addPass(haze.pass);
  if (bloom) composer.addPass(bloom);
  composer.addPass(output);
  let width = 1,
    height = 1,
    // Full screen (resolution.mjs detailFor) trades multisampling for pixels on large buffers and
    // draws the contact pass larger; the page embed keeps four samples and a 480 px contact pass.
    samples = 4,
    contactLongSide = 480;
  return {
    contactLighting: lighting,
    haze,
    setTemporalEnabled(value) {
      temporal?.setEnabled(value);
    },
    resetTemporal(reason) {
      temporal?.reset(reason);
    },
    // A change of sample count reallocates both composer targets (three rebuilds a disposed target on
    // its next use, with the same depth texture object the haze pass reads).
    setDetail({ samples: nextSamples = samples, contactLongSide: nextContact = contactLongSide } = {}) {
      if (nextSamples === samples && nextContact === contactLongSide) return;
      if (nextSamples !== samples)
        for (const renderTarget of [composer.renderTarget1, composer.renderTarget2]) {
          renderTarget.samples = nextSamples;
          renderTarget.dispose();
        }
      samples = nextSamples;
      contactLongSide = nextContact;
      this.resize(width, height);
    },
    // Programs this pipeline draws beyond the scene's own materials (program-warmup.mjs): the
    // contact pass's normal override on every occluding mesh, and its two full-screen passes.
    programWarmup: {
      get overrides() {
        return [
          { material: contact.normalMaterial, accept: (object) => !object.userData.noOcclusion && !object.userData.noContactOcclusion },
          ...volumeDepth.programWarmup,
        ];
      },
      passes: [
        { material: contact.ssaoMaterial },
        { material: contact.blurMaterial },
        ...(haze ? haze.programWarmup : []),
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
      temporal?.resize(composer.renderTarget1.width, composer.renderTarget1.height);
      volumeDepth.resize(composer.renderTarget1.width, composer.renderTarget1.height);
      lighting.contactResolution.value.set(Math.floor(composer.renderTarget1.width), Math.floor(composer.renderTarget1.height));
      const scale = Math.min(1, contactLongSide / Math.max(w, h));
      contact.setSize(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
    },
    render(activeCamera, exterior, temporalKey = "") {
      temporal?.begin(activeCamera, temporalKey);
      let completed = false;
      try {
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
        haze?.prepare(activeCamera, exterior);
        if (volume?.object.visible) volumeDepth.render(activeCamera, volume);
        composer.render();
        completed = true;
      } finally {
        try {
          haze?.restore();
        } finally {
          try {
            gpuTimer.end();
          } finally {
            temporal?.end(completed);
          }
        }
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
        msaaSamples: samples,
        gpu: gpuTimer.evidence,
        volumeDepth: volume?.object.visible ? volumeDepth.evidence() : null,
        bloom: bloom ? { strength: bloom.strength, radius: bloom.radius, threshold: bloom.threshold } : null,
        haze: haze ? haze.evidence() : null,
        temporal: temporal?.evidence ?? null,
      };
    },
    dispose() {
      lighting.contactEnabled.value = false;
      gpuTimer.dispose();
      temporal?.dispose();
      volumeDepth.dispose();
      haze?.dispose();
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
