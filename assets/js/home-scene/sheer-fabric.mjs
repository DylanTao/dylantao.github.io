import * as THREE from "../three.module.min.js";

// Sheer curtain fabric (Sirui, 2026-10-15): light through, around and across a thin woven sheet.
//
// A sheer is a plain weave of fine, round yarns with gaps between them. Three things happen to light:
//  1. Through the gaps it passes untouched. Seen head-on a voile is about a third open; toward grazing
//     angles the round yarns hide the gaps between them and the weave closes up. Each thread direction
//     is a row of cylinders of diameter d at spacing s: viewed at angle a across that row the open
//     fraction is max(0, 1 - (d/s)/cos a), and the two directions multiply. This is the geometric
//     beam-beam model used for screens and drapery in building optics (Kotey, Wright & Collins 2009).
//     The open fraction drives multisampled alpha-to-coverage, so the sheet composites in the opaque
//     pass with per-sample depth and no sorting; without multisampling it falls back to a hashed
//     discard.
//  2. Light that meets yarn is scattered. Toward the viewer's side it reflects (Lambert plus Three's
//     "Charlie" cloth sheen, Estevez & Kulla 2017). From behind it is transmitted: a thin-walled
//     Lambertian part, as in glTF KHR_materials_diffuse_transmission, plus a forward lobe around the
//     light's own direction (Henyey & Greenstein 1941), so a sheer glows hardest where the sun stands
//     behind it and brighter at normal incidence, where more of each yarn faces the light.
//  3. In the sun's shadow map the sheet is a dithered occluder: each texel passes with the probability
//     that light gets through along the light's direction (gaps plus a share of the forward-scattered
//     light), on an ordered 4 x 4 pattern that the soft shadow filter averages back into a partial,
//     angle-dependent shadow. Drawn panels therefore leave a striped, fold-shaped pool of light on the
//     floor, and opening them changes it.
//
// The curtain's own shadow lookup is offset toward the light (not along the room-facing normal), so a
// back-lit sheet is not shadowed by itself while frames and rock still shadow it. Everything here is an
// authored real-time approximation, not a measured BSDF or a yarn-level renderer. See PHYSICS.md
// ("Curtain cloth") for equations, sources and limits.

// Not matched by the scene's name-based routing (realism.mjs, materials.mjs, coastal-wind.mjs).
export const SHEER_FABRIC_NAME = "coastal sheer voile";

export const SHEER_DEFAULTS = Object.freeze({
  color: 0xf2ece0, // yarn reflectance, sRGB
  transmissionColor: 0xffecd6, // tint of light transmitted through the yarn, sRGB
  transmission: 0.42, // diffuse transmittance where light meets yarn
  forward: 0.45, // share of the transmitted light in the forward lobe
  anisotropy: 0.6, // Henyey-Greenstein g of that lobe
  openness: 0.36, // open area at normal incidence
  weaveBalance: 1, // warp density / weft density (1: square weave)
  shadowLeak: 0.7, // share of the forward-scattered light that keeps to the beam in the shadow map
  roughness: 0.85,
  specularIntensity: 0.35,
  sheen: 1,
  sheenRoughness: 0.45,
  sheenColor: 0xd8d4cc,
});

// Yarn diameter / spacing for each thread direction from the open area at normal incidence:
// (1 - r_warp)(1 - r_weft) = openness, with r_warp / r_weft = weaveBalance.
export function weaveYarnRatios(openness, weaveBalance = 1) {
  const target = Math.min(0.95, Math.max(0, openness));
  let lo = 0,
    hi = 1;
  for (let k = 0; k < 60; k++) {
    const r = 0.5 * (lo + hi),
      open = (1 - Math.min(0.999, r * Math.sqrt(weaveBalance))) * (1 - Math.min(0.999, r / Math.sqrt(weaveBalance)));
    if (open > target) lo = r;
    else hi = r;
  }
  const r = 0.5 * (lo + hi);
  return [Math.min(0.999, r * Math.sqrt(weaveBalance)), Math.min(0.999, r / Math.sqrt(weaveBalance))];
}

// The open fraction along unit direction w for unit normal n and weft tangent t (bitangent n x t):
// the JavaScript twin of the shader's sheerOpenness, for tests and for any CPU-side light estimate.
export function weaveOpenness(w, n, t, [warp, weft]) {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const b = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]];
  const wn = Math.abs(dot(w, n)) + 1e-4,
    wt = dot(w, t),
    wb = dot(w, b);
  const across = wn / Math.sqrt(wn * wn + wt * wt),
    along = wn / Math.sqrt(wn * wn + wb * wb);
  return Math.max(0, 1 - warp / across) * Math.max(0, 1 - weft / along);
}

const weaveGLSL = /* glsl */ `
uniform vec2 sheerYarn;
uniform vec3 sheerTransmission;
uniform float sheerForward;
uniform float sheerAnisotropy;
uniform float sheerShadowLeak;
uniform float sheerHashed;
// Open fraction of a plain weave of round yarns seen along w (either side of the sheet).
float sheerOpenness( vec3 w, vec3 n, vec3 t, vec3 b ) {
  float wn = abs( dot( w, n ) ) + 1e-4;
  float wt = dot( w, t ), wb = dot( w, b );
  float across = wn * inversesqrt( wn * wn + wt * wt );
  float along = wn * inversesqrt( wn * wn + wb * wb );
  return max( 0.0, 1.0 - sheerYarn.x / across ) * max( 0.0, 1.0 - sheerYarn.y / along );
}
vec3 sheerWeaveTangent( vec3 n, vec3 t ) {
  vec3 u = t - n * dot( n, t );
  return dot( u, u ) > 1e-8 ? normalize( u ) : normalize( cross( n, abs( n.y ) < 0.9 ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 ) ) );
}
// Interleaved gradient noise (Jimenez 2014): a well-spread per-pixel threshold.
float sheerNoise( vec2 p ) {
  return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) );
}
`;

const shadowGLSL = /* glsl */ `
${weaveGLSL}
// Ordered 3 x 3 dispersed-dot thresholds in shadow-map texels. Three's soft shadow filter
// (PCFSoftShadowMap) is a box three texels wide in each axis, so it covers exactly one period of this
// pattern wherever it lands and reads back the passing fraction without any pattern left over.
float sheerBayer( vec2 p ) {
  ivec2 q = ivec2( mod( floor( p ), 3.0 ) );
  const float m[ 9 ] = float[ 9 ]( 0.0, 7.0, 3.0, 6.0, 5.0, 2.0, 4.0, 1.0, 8.0 );
  return ( m[ q.x + 3 * q.y ] + 0.5 ) / 9.0;
}
// Probability that light along w passes the sheet: the gaps, plus the forward-scattered share of the
// light the yarn transmits.
float sheerPass( vec3 w, vec3 n, vec3 t ) {
  vec3 tt = sheerWeaveTangent( n, t );
  float open = sheerOpenness( w, n, tt, cross( n, tt ) );
  return open + ( 1.0 - open ) * dot( sheerTransmission, vec3( 0.3333 ) ) * sheerForward * sheerShadowLeak;
}
`;

const shadowVertexChunk = (() => {
  const source = THREE.ShaderChunk.shadowmap_vertex;
  const directional = "shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );";
  const point = "shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );";
  if (!source.includes(directional) || !source.includes(point)) return null;
  // The shadow matrix's depth row grows away from a directional light; a point light's shadow matrix
  // is a translation by minus the light position.
  return source
    .replace(
      directional,
      "shadowWorldPosition = worldPosition + vec4( sheerTowardLight( shadowWorldNormal, - vec3( directionalShadowMatrix[ i ][ 0 ][ 2 ], directionalShadowMatrix[ i ][ 1 ][ 2 ], directionalShadowMatrix[ i ][ 2 ][ 2 ] ) ) * directionalLightShadows[ i ].shadowNormalBias, 0 );"
    )
    .replace(
      point,
      "shadowWorldPosition = worldPosition + vec4( sheerTowardLight( shadowWorldNormal, - ( pointShadowMatrix[ i ] * worldPosition ).xyz ) * pointLightShadows[ i ].shadowNormalBias, 0 );"
    );
})();

const replaceOnce = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`sheer fabric: ${label} has no ${marker}`);
  return source.replace(marker, replacement);
};

// The beauty-pass patch. Every include it replaces is kept, so later binders (static light field,
// light installations, contact lighting) still find their markers.
export function patchSheerShader(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  let vertex = shader.vertexShader,
    fragment = shader.fragmentShader;
  vertex = `vec3 sheerTowardLight( vec3 n, vec3 toLight ) { return dot( n, toLight ) < 0.0 ? - n : n; }\n${vertex}`;
  vertex = replaceOnce(
    vertex,
    "#include <common>",
    "#include <common>\nattribute vec3 sheerTangent;\nvarying vec3 vSheerTangent;\nvarying vec2 vSheerFabric;",
    "vertex shader"
  );
  vertex = replaceOnce(
    vertex,
    "#include <project_vertex>",
    "#include <project_vertex>\nvSheerTangent = ( modelViewMatrix * vec4( sheerTangent, 0.0 ) ).xyz;\nvSheerFabric = uv;",
    "vertex shader"
  );
  if (shadowVertexChunk) vertex = vertex.replace("#include <shadowmap_vertex>", shadowVertexChunk);
  fragment = replaceOnce(
    fragment,
    "#include <common>",
    `#include <common>
${weaveGLSL}
varying vec3 vSheerTangent;
varying vec2 vSheerFabric;
vec3 sheerWeaveT;
vec3 sheerWeaveB;
float sheerCover;
float sheerPhase( float cosTheta, float g ) {
  float d = 1.0 + g * g - 2.0 * g * cosTheta;
  return ( 1.0 - g * g ) / ( 4.0 * PI * d * sqrt( d ) );
}
float sheerHash( float n ) {
  return fract( sin( n * 12.9898 ) * 43758.5453 );
}
float sheerValue( float x ) {
  float i = floor( x ), f = fract( x );
  return mix( sheerHash( i ), sheerHash( i + 1.0 ), f * f * ( 3.0 - 2.0 * f ) );
}`,
    "fragment shader"
  );
  fragment = replaceOnce(
    fragment,
    "#include <normal_fragment_maps>",
    `#include <normal_fragment_maps>
sheerWeaveT = sheerWeaveTangent( normal, vSheerTangent );
sheerWeaveB = cross( normal, sheerWeaveT );
sheerCover = 1.0 - sheerOpenness( isOrthographic ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition ), normal, sheerWeaveT, sheerWeaveB );
{
  // A loom never packs threads perfectly evenly: faint warp streaks and weft bars that show against the
  // light, faded out before they are finer than about two pixels. uv is fabric metres, y up from the hem.
  vec2 footprint = fwidth( vSheerFabric );
  float streak = 0.6 * sheerValue( vSheerFabric.x / 0.011 ) + 0.4 * sheerValue( vSheerFabric.x / 0.0047 + 17.0 );
  float bar = sheerValue( vSheerFabric.y / 0.031 + 5.0 );
  float density = 1.0 + 0.11 * ( streak - 0.5 ) * ( 1.0 - smoothstep( 0.0025, 0.0065, footprint.x ) )
                      + 0.07 * ( bar - 0.5 ) * ( 1.0 - smoothstep( 0.007, 0.018, footprint.y ) );
  // The double-folded hem: two layers, so its gaps rarely line up.
  float hem = 1.0 - smoothstep( 0.058, 0.064, vSheerFabric.y );
  float open = clamp( ( 1.0 - sheerCover ) * ( 2.0 - density ), 0.0, 1.0 );
  sheerCover = 1.0 - mix( open, open * open, hem );
}`,
    "fragment shader"
  );
  fragment = replaceOnce(
    fragment,
    "#include <lights_physical_pars_fragment>",
    `#include <lights_physical_pars_fragment>
// Light from behind the sheet: what meets yarn (not the open weave) is transmitted, part diffusely and
// part in a forward lobe around its own direction. Divided by the yarn's visible coverage, because the
// coverage already scales the yarn's share of the pixel.
void RE_Direct_Sheer( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  float dotNL = dot( geometryNormal, directLight.direction );
  if ( dotNL >= 0.0 ) return;
  float meets = 1.0 - sheerOpenness( directLight.direction, geometryNormal, sheerWeaveT, sheerWeaveB );
  float lobe = ( 1.0 - sheerForward ) * RECIPROCAL_PI + sheerForward * 2.0 * sheerPhase( dot( geometryViewDir, - directLight.direction ), sheerAnisotropy );
  reflectedLight.directDiffuse += directLight.color * ( - dotNL * meets / max( sheerCover, 0.25 ) * lobe ) * sheerTransmission;
}
#undef RE_Direct
#define RE_Direct RE_Direct_Sheer`,
    "fragment shader"
  );
  fragment = replaceOnce(
    fragment,
    "#include <lights_fragment_maps>",
    `#include <lights_fragment_maps>
// Irradiance on the far side of the sheet, from the same ambient, hemisphere and environment light.
vec3 sheerBehind = getAmbientLightIrradiance( ambientLightColor );
#if ( NUM_HEMI_LIGHTS > 0 )
  #pragma unroll_loop_start
  for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
    sheerBehind += getHemisphereLightIrradiance( hemisphereLights[ i ], - geometryNormal );
  }
  #pragma unroll_loop_end
#endif
vec3 sheerThrough = sheerBehind * RECIPROCAL_PI;
#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
  sheerBehind += getIBLIrradiance( - geometryNormal );
  // Forward-scattered sky: the environment straight behind the sheet along the view ray, blurred.
  sheerThrough = textureCubeUV( envMap, envMapRotation * inverseTransformDirection( - geometryViewDir, viewMatrix ), 0.65 ).rgb * envMapIntensity;
#endif`,
    "fragment shader"
  );
  fragment = replaceOnce(
    fragment,
    "#include <aomap_fragment>",
    `{
  float sheerMeets = ( 1.0 - ( 1.0 - sheerYarn.x ) * ( 1.0 - sheerYarn.y ) ) / max( sheerCover, 0.25 );
  reflectedLight.indirectDiffuse += sheerTransmission * sheerMeets * ( ( 1.0 - sheerForward ) * sheerBehind * RECIPROCAL_PI + sheerForward * sheerThrough );
}
#include <aomap_fragment>`,
    "fragment shader"
  );
  fragment = replaceOnce(
    fragment,
    "#include <opaque_fragment>",
    `// Coverage: alpha-to-coverage under multisampling, dithered by a quarter sample so four samples
// read as smooth gradations; a hashed discard where the target has no samples.
if ( sheerHashed > 0.5 ) {
  if ( sheerNoise( gl_FragCoord.xy ) >= sheerCover ) discard;
  diffuseColor.a = 1.0;
} else {
  diffuseColor.a = clamp( sheerCover + ( sheerNoise( gl_FragCoord.xy ) - 0.5 ) * 0.25, 0.0, 1.0 );
}
#include <opaque_fragment>`,
    "fragment shader"
  );
  shader.vertexShader = vertex;
  shader.fragmentShader = fragment;
  return shader;
}

// The shadow-pass patch for MeshDepthMaterial (directional/spot) or MeshDistanceMaterial (point).
export function patchSheerShadowShader(shader, uniforms, distance = false) {
  Object.assign(shader.uniforms, uniforms);
  let vertex = shader.vertexShader,
    fragment = shader.fragmentShader;
  vertex = replaceOnce(
    vertex,
    "#include <common>",
    "#include <common>\nattribute vec3 sheerTangent;\nvarying vec3 vSheerNormal;\nvarying vec3 vSheerTangent;\nvarying vec3 vSheerPoint;",
    "shadow vertex shader"
  );
  vertex = replaceOnce(
    vertex,
    "#include <project_vertex>",
    distance
      ? `#include <project_vertex>
vSheerNormal = normalize( mat3( modelMatrix ) * normal );
vSheerTangent = mat3( modelMatrix ) * sheerTangent;
vSheerPoint = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`
      : `#include <project_vertex>
vSheerNormal = normalize( normalMatrix * normal );
vSheerTangent = ( modelViewMatrix * vec4( sheerTangent, 0.0 ) ).xyz;
vSheerPoint = mvPosition.xyz;`,
    "shadow vertex shader"
  );
  fragment = replaceOnce(
    fragment,
    "#include <common>",
    `#include <common>\n${shadowGLSL}\nvarying vec3 vSheerNormal;\nvarying vec3 vSheerTangent;\nvarying vec3 vSheerPoint;`,
    "shadow fragment shader"
  );
  fragment = replaceOnce(
    fragment,
    "#include <clipping_planes_fragment>",
    `#include <clipping_planes_fragment>
{
  vec3 sheerToLight = ${distance ? "normalize( referencePosition - vSheerPoint )" : "isOrthographic ? vec3( 0.0, 0.0, 1.0 ) : normalize( - vSheerPoint )"};
  if ( sheerBayer( gl_FragCoord.xy ) < sheerPass( sheerToLight, normalize( vSheerNormal ), vSheerTangent ) ) discard;
}`,
    "shadow fragment shader"
  );
  shader.vertexShader = vertex;
  shader.fragmentShader = fragment;
  return shader;
}

const linear = (hex) => new THREE.Color(hex);

// The material set for one fabric: beauty, shadow depth and shadow distance materials sharing one set
// of uniforms. Call `bindMesh` on every curtain mesh.
export function createSheerFabric(options = {}) {
  const o = { ...SHEER_DEFAULTS, ...options };
  const uniforms = {
    sheerYarn: { value: new THREE.Vector2(...weaveYarnRatios(o.openness, o.weaveBalance)) },
    sheerTransmission: { value: new THREE.Vector3() },
    sheerForward: { value: o.forward },
    sheerAnisotropy: { value: o.anisotropy },
    sheerShadowLeak: { value: o.shadowLeak },
    sheerHashed: { value: 0 },
  };
  const setTransmission = (amount, color) => {
    const c = linear(color);
    uniforms.sheerTransmission.value.set(c.r, c.g, c.b).multiplyScalar(amount);
  };
  setTransmission(o.transmission, o.transmissionColor);

  const material = new THREE.MeshPhysicalMaterial({
    name: SHEER_FABRIC_NAME,
    color: o.color,
    roughness: o.roughness,
    metalness: 0,
    ior: 1.5,
    specularIntensity: o.specularIntensity,
    sheen: o.sheen,
    sheenRoughness: o.sheenRoughness,
    sheenColor: o.sheenColor,
    side: THREE.DoubleSide,
    // Opaque pass, per-sample coverage: no sorting against the glass or the room.
    transparent: false,
    alphaToCoverage: true,
    depthWrite: true,
    // Covered samples take the fabric's colour; the target's alpha (the page-transparent canvas) is kept.
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.ZeroFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  material.onBeforeCompile = (shader) => patchSheerShader(shader, uniforms);
  material.customProgramCacheKey = () => "coastal-sheer-voile-v1";

  const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depthMaterial.name = `${SHEER_FABRIC_NAME} depth`;
  depthMaterial.onBeforeCompile = (shader) => patchSheerShadowShader(shader, uniforms, false);
  depthMaterial.customProgramCacheKey = () => "coastal-sheer-voile-depth-v1";
  const distanceMaterial = new THREE.MeshDistanceMaterial();
  distanceMaterial.name = `${SHEER_FABRIC_NAME} distance`;
  distanceMaterial.onBeforeCompile = (shader) => patchSheerShadowShader(shader, uniforms, true);
  distanceMaterial.customProgramCacheKey = () => "coastal-sheer-voile-distance-v1";

  // Hashed coverage wherever the current target cannot multisample (the reflection pass, a direct
  // canvas render): alpha-to-coverage would otherwise draw the sheet solid there.
  function chooseCoverage(renderer) {
    const target = renderer.getRenderTarget(),
      hashed = target && target.samples > 0 ? 0 : 1;
    if (uniforms.sheerHashed.value !== hashed) {
      uniforms.sheerHashed.value = hashed;
      material.uniformsNeedUpdate = true;
    }
  }

  return {
    material,
    depthMaterial,
    distanceMaterial,
    uniforms,
    setOpenness(openness, weaveBalance = o.weaveBalance) {
      uniforms.sheerYarn.value.set(...weaveYarnRatios(openness, weaveBalance));
    },
    setTransmission,
    bindMesh(mesh) {
      mesh.material = material;
      mesh.customDepthMaterial = depthMaterial;
      mesh.customDistanceMaterial = distanceMaterial;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.onBeforeRender = chooseCoverage;
      // Keep the scene's binders and bakes off a moving, see-through sheet (glazing.mjs does the same).
      Object.assign(mesh.userData, {
        fixedMaterial: true,
        noOcclusion: true,
        noContactOcclusion: true,
        noVolumeDepth: true,
        dynamic: true,
        sheerFabric: true,
      });
      return mesh;
    },
    dispose() {
      material.dispose();
      depthMaterial.dispose();
      distanceMaterial.dispose();
    },
  };
}

// Meshes for every panel of a curtain-cloth solver, with dynamic position, normal and weave-tangent
// attributes refreshed by `update()` once per frame after the solver has stepped.
export function createCurtainMeshes(cloth, fabric = createSheerFabric()) {
  const entries = cloth.panels.map((panel) => {
    const geometry = new THREE.BufferGeometry();
    const attribute = (size) => new THREE.BufferAttribute(new Float32Array(size * panel.count), size).setUsage(THREE.DynamicDrawUsage);
    const position = attribute(3),
      normal = attribute(3),
      tangent = attribute(3);
    geometry.setAttribute("position", position);
    geometry.setAttribute("normal", normal);
    geometry.setAttribute("sheerTangent", tangent);
    geometry.setAttribute("uv", new THREE.BufferAttribute(panel.uv, 2));
    geometry.setIndex(new THREE.BufferAttribute(panel.index, 1));
    // A fixed, conservative bound: the solver's billow never leaves it, and nothing recomputes it.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...panel.boundingSphere.center), panel.boundingSphere.radius);
    const mesh = new THREE.Mesh(geometry, fabric.material);
    mesh.name = `curtain ${panel.id}`;
    mesh.matrixAutoUpdate = false;
    fabric.bindMesh(mesh);
    cloth.writePanel(panel.id, position.array, normal.array, tangent.array);
    return { mesh, position, normal, tangent, id: panel.id };
  });
  return {
    meshes: entries.map((entry) => entry.mesh),
    update() {
      for (let k = 0; k < entries.length; k++) {
        const entry = entries[k];
        cloth.writePanel(k, entry.position.array, entry.normal.array, entry.tangent.array);
        entry.position.needsUpdate = entry.normal.needsUpdate = entry.tangent.needsUpdate = true;
      }
    },
    dispose() {
      for (const entry of entries) entry.mesh.geometry.dispose();
    },
  };
}
