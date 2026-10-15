import * as THREE from "../three.module.min.js";

// Anti-reflective low-iron glass for the cave front and the terrace balustrade
// (bin/refresh_coastal_facade.py), the kind used where the view is the point: about 1 % reflectance
// head-on instead of plain glass's 4 %, so the house reads through it by day. The pane is drawn over
// whatever is behind it with premultiplied blending: its colour is only what it reflects (sky, sun
// glint), and the view through is dimmed only by that reflected share plus a little absorption.
// Toward grazing angles the Schlick term still turns the pane into sky, as real glass does. A
// transmission material would refract a copy of the opaque scene instead, and lose the
// transparent onsen water and steam behind the front.
export const GLASS_NAME = "facade low-iron glass";

export function createGlazing() {
  const material = new THREE.MeshPhysicalMaterial({
    name: GLASS_NAME,
    color: 0x000000,
    metalness: 0,
    roughness: 0.035,
    ior: 1.5,
    // F0 = 0.04 x 0.25: the coating's 1 % reflectance at normal incidence.
    specularIntensity: 0.25,
    envMapIntensity: 1,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `float glazingCos = clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0);
      float glazingFresnel = 0.01 + 0.99 * pow(1.0 - glazingCos, 5.0);
      gl_FragColor = vec4(outgoingLight, clamp(glazingFresnel + 0.02, 0.0, 1.0));`
    );
    // Fog would add its colour at full strength over a premultiplied pane.
    shader.fragmentShader = shader.fragmentShader.replace("#include <fog_fragment>", "");
  };
  material.customProgramCacheKey = () => "coastal-glazing-v2";
  return material;
}

// The glass neither occludes the contact pass, the volume depth or the static light field, nor
// casts a shadow; its frames do all of that.
export function glaze(mesh, material) {
  mesh.material = material;
  mesh.castShadow = false;
  mesh.renderOrder = 2;
  Object.assign(mesh.userData, { fixedMaterial: true, noOcclusion: true, noContactOcclusion: true, noVolumeDepth: true, glazing: true });
}
