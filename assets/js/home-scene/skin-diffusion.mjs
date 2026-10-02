import * as THREE from "../three.module.min.js";
import { buildDiffusionTable } from "./skin-diffusion-profile.mjs";

export const skinDiffusionFragment = `
uniform sampler2D skinDiffusionTexture;
uniform vec2 skinDiffusionSize;
uniform float skinDiffusionMaxCurvature, skinDiffusionStrength;
uniform bool skinDiffusionEnabled, skinDiffusionMaterialEnabled;
float coastalSkinCurvature = 0.;

float coastalMeanCurvature(vec3 position, vec3 surfaceNormal) {
  vec3 px=dFdx(position), py=dFdy(position);
  vec3 nx=dFdx(surfaceNormal), ny=dFdy(surfaceNormal);
  float g00=dot(px,px), g01=dot(px,py), g11=dot(py,py);
  float determinant=g00*g11-g01*g01;
  if(determinant<=max(1.e-24,g00*g11*1.e-5)) return 0.;
  float b00=dot(nx,px), b11=dot(ny,py);
  float b01=.5*(dot(nx,py)+dot(ny,px));
  float mean=.5*(g11*b00+g00*b11-2.*g01*b01)/determinant;
  return clamp(mean,0.,skinDiffusionMaxCurvature);
}

vec3 coastalSkinResponse(float cosine) {
  float lambert=clamp(cosine,0.,1.);
  if(!skinDiffusionEnabled || !skinDiffusionMaterialEnabled || skinDiffusionStrength<=0. || coastalSkinCurvature<=0.) return vec3(lambert);
  vec2 coordinate=vec2(clamp(cosine*.5+.5,0.,1.),coastalSkinCurvature/skinDiffusionMaxCurvature);
  vec2 uv=(coordinate*(skinDiffusionSize-1.)+.5)/skinDiffusionSize;
  vec3 diffused=texture2D(skinDiffusionTexture,uv).rgb;
  return mix(vec3(lambert),diffused,skinDiffusionStrength);
}
`;

const directDiffuse = "reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );";
const directReplacement =
  "reflectedLight.directDiffuse += coastalSkinResponse( dot( geometryNormal, directLight.direction ) ) * directLight.color * BRDF_Lambert( material.diffuseColor );";
const physicalAnchor = "#include <lights_physical_pars_fragment>";
const normalAnchor = "#include <normal_fragment_maps>";
const boundMaterials = new WeakMap();

// Patch a private chunk string, never Three's globally shared ShaderChunk.
// A changed shader layout fails closed: prior authored shading remains intact.
export function patchSkinDiffusionShader(shader, uniforms, materialEnabled) {
  const physical = THREE.ShaderChunk.lights_physical_pars_fragment;
  if (
    !shader.fragmentShader.includes(physicalAnchor) ||
    !shader.fragmentShader.includes(normalAnchor) ||
    physical.split(directDiffuse).length !== 2
  ) {
    return false;
  }
  const replacement = physical.replace(directDiffuse, directReplacement);
  shader.fragmentShader =
    skinDiffusionFragment +
    shader.fragmentShader.replace(physicalAnchor, replacement).replace(
      normalAnchor,
      `${normalAnchor}
       if(skinDiffusionEnabled && skinDiffusionMaterialEnabled && skinDiffusionStrength>0.) {
         coastalSkinCurvature=coastalMeanCurvature(-vViewPosition,nonPerturbedNormal);
       }`
    );
  Object.assign(shader.uniforms, uniforms, { skinDiffusionMaterialEnabled: materialEnabled });
  return true;
}

// One texture belongs to one finish pipeline. Materials borrow its uniforms.
// Explicit surface:true is reserved for the existing shirt primitive when its
// wardrobe is bare skin; normal hair, glasses and cloth are never auto-bound.
export function createSkinDiffusion({ storage = "half-float", enabled = true, ...options } = {}) {
  if (!["half-float", "unorm8"].includes(storage)) throw new RangeError("Unknown skin diffusion texture storage.");
  const table = buildDiffusionTable(options),
    { config } = table;
  const data = storage === "half-float" ? new Uint16Array(table.data.length) : new Uint8Array(table.data.length);
  for (let i = 0; i < data.length; i++) {
    data[i] = storage === "half-float" ? THREE.DataUtils.toHalfFloat(table.data[i]) : Math.round(table.data[i] * 255);
  }
  const texture = new THREE.DataTexture(
    data,
    config.width,
    config.height,
    THREE.RGBAFormat,
    storage === "half-float" ? THREE.HalfFloatType : THREE.UnsignedByteType
  );
  texture.name = "Coastal normalized skin diffusion";
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  const uniforms = {
    skinDiffusionTexture: { value: texture },
    skinDiffusionSize: { value: new THREE.Vector2(config.width, config.height) },
    skinDiffusionMaxCurvature: { value: config.maxCurvature },
    skinDiffusionStrength: { value: config.strength },
    skinDiffusionEnabled: { value: Boolean(enabled) },
  };
  let disposed = false,
    totalBindings = 0;
  const entries = new Set();

  function bind(material, { enabled: surfaceEnabled = true, surface = material?.name === "skin" } = {}) {
    if (disposed) throw new Error("Cannot bind a disposed skin diffusion pipeline.");
    if (!material?.isMeshStandardMaterial || !surface) return null;
    const existing = boundMaterials.get(material);
    if (existing) {
      if (existing.uniforms !== uniforms) throw new Error("A skin material cannot borrow two finish pipelines; clone it first.");
      existing.released = false;
      entries.add(existing);
      existing.handle.setEnabled(surfaceEnabled);
      return existing.handle;
    }
    const materialEnabled = { value: Boolean(surfaceEnabled) },
      compile = material.onBeforeCompile,
      cacheKey = material.customProgramCacheKey();
    const entry = { uniforms, compiled: false, compatible: null, materialEnabled, released: false, handle: null };
    const handle = {
      setEnabled(value) {
        materialEnabled.value = !disposed && !entry.released && Boolean(value);
      },
      release() {
        entry.released = true;
        materialEnabled.value = false;
        entries.delete(entry);
      },
      get enabled() {
        return materialEnabled.value;
      },
      get evidence() {
        return { compiled: entry.compiled, compatible: entry.compatible, enabled: materialEnabled.value };
      },
    };
    entry.handle = handle;
    material.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer);
      entry.compatible = patchSkinDiffusionShader(shader, uniforms, materialEnabled);
      entry.compiled = true;
    };
    material.customProgramCacheKey = () => `${cacheKey}:coastal-normalized-skin-v1`;
    material.needsUpdate = true;
    material.addEventListener?.("dispose", handle.release);
    entries.add(entry);
    totalBindings++;
    boundMaterials.set(material, entry);
    return handle;
  }

  return {
    uniforms,
    bind,
    setEnabled(value) {
      uniforms.skinDiffusionEnabled.value = !disposed && Boolean(value);
    },
    setStrength(value) {
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError("Skin diffusion strength must lie between zero and one.");
      uniforms.skinDiffusionStrength.value = value;
    },
    get evidence() {
      return {
        method: "normalized local curved-patch diffuse preintegration",
        enabled: uniforms.skinDiffusionEnabled.value && uniforms.skinDiffusionStrength.value > 0,
        strength: uniforms.skinDiffusionStrength.value,
        distancesMeters: [...config.distances],
        maxCurvature: config.maxCurvature,
        width: config.width,
        height: config.height,
        storage,
        textureBytes: data.byteLength,
        totalBindings,
        boundMaterials: entries.size,
        compiledMaterials: [...entries].filter((e) => e.compiled).length,
        incompatibleMaterials: [...entries].filter((e) => e.compatible === false).length,
        activeMaterials:
          uniforms.skinDiffusionEnabled.value && uniforms.skinDiffusionStrength.value > 0
            ? [...entries].filter((e) => e.materialEnabled.value && e.compatible !== false).length
            : 0,
        extraRenderTargets: 0,
        extraPasses: 0,
        disposed,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      uniforms.skinDiffusionEnabled.value = false;
      for (const entry of entries) entry.materialEnabled.value = false;
      texture.dispose();
    },
  };
}
