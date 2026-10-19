import * as THREE from "../three.module.min.js";

// Linen in light (Sirui, 2026-10-15; linen and blended translucency 2026-10-18): light through,
// around and across a woven sheet, for the sheer curtains and the laundry on the terrace.
//
// A sheer is a plain weave of yarns with gaps between them. Three things happen to light:
//  1. Through the gaps it passes untouched. Seen head-on a sheer linen is about a quarter open; toward
//     grazing angles the round yarns hide the gaps between them and the weave closes up. Each thread
//     direction is a row of cylinders of diameter d at spacing s: viewed at angle a across that row the
//     open fraction is max(0, 1 - (d/s)/cos a), and the two directions multiply. It shares its endpoints
//     (open area (1 - d/s)^2 head-on, cut-off at cos a = d/s) with the crossed-cylinder geometry used for
//     insect screens in building optics (Kotey, Wright & Collins 2009).
//     The covered fraction is the fragment's alpha, blended over what lies behind in the transparent
//     pass. (Until October 18 it drove multisampled alpha-to-coverage with a dithered threshold, which
//     at the scene's canvas size read as a grainy screen door; ?sheer=coverage restores that path.)
//  2. Light that meets yarn is scattered. Toward the viewer's side it reflects (Lambert plus Three's
//     "Charlie" cloth sheen, Estevez & Kulla 2017). From behind it is transmitted: a thin-walled
//     Lambertian part, as in glTF KHR_materials_diffuse_transmission, plus a forward lobe around the
//     light's own direction (Henyey & Greenstein 1941), so linen glows hardest where the sun stands
//     behind it and brighter at normal incidence, where more of each yarn faces the light.
//  3. In the sun's shadow map a sheer is a dithered occluder: each texel passes with the probability
//     that light gets through along the light's direction (gaps plus a share of the forward-scattered
//     light), on an ordered 3 x 3 pattern that the soft shadow filter averages back into a partial,
//     angle-dependent shadow. Drawn panels therefore leave a striped, fold-shaped pool of light on the
//     floor, and folds shade the folds behind them.
//
// Linen's yarns are uneven: thick slubs and thin stretches along each thread, so a back-lit linen shows
// soft streaks along the warp and a faint cloudiness, never a regular grid. The density here is a smooth
// two-dimensional noise stretched along the warp (slubs 3-9 cm long), faded before it is finer than about
// two pixels. A heading tape and a doubled hem are denser bands. Towels and shirting use the same
// shader with a denser weave, a colour and optional woven stripes.
//
// The fabric's own shadow lookup is offset toward the light (not along the room-facing normal), so a
// back-lit sheet is not shadowed by itself while its other folds, frames and rock still shadow it.
// Everything here is an authored real-time approximation, not a measured BSDF or a yarn-level renderer.
// See PHYSICS.md ("Curtain cloth") for equations, sources and limits.

// Not matched by the scene's name-based routing (realism.mjs, materials.mjs, coastal-wind.mjs).
export const SHEER_FABRIC_NAME = "coastal sheer voile";

export const SHEER_DEFAULTS = Object.freeze({
  color: 0xebe4d6, // natural linen, sRGB
  transmissionColor: 0xfff0dc, // tint of light transmitted through the yarn, sRGB
  transmission: 0.46, // diffuse transmittance where light meets yarn
  forward: 0.45, // share of the transmitted light in the forward lobe
  anisotropy: 0.6, // Henyey-Greenstein g of that lobe
  openness: 0.27, // open area at normal incidence: a sheer linen
  weaveBalance: 1, // warp density / weft density (1: square weave)
  shadowLeak: 0.7, // share of the forward-scattered light that keeps to the beam in the shadow map
  roughness: 0.82,
  specularIntensity: 0.35,
  sheen: 1,
  sheenRoughness: 0.5,
  sheenColor: 0xddd4c4,
  slub: 0.16, // contrast of the slub density
  hemHeight: 0.06, // m, the doubled hem
  tapeHeight: 0, // m below `fabricTop`, the heading tape (0: none)
  fabricTop: 0, // m, the fabric's height in its own coordinates (uv.y at the top edge)
  stripe: null, // { axis: "u" | "v", period, width, offset, color, strength }
  coverage: "blend", // "blend": alpha in the transparent pass; "opaque": a dense cloth; "coverage": alpha-to-coverage (the October 16 path)
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

// The slub density at fabric point (u, v) metres, before the pixel-footprint fade: the JavaScript twin
// of the shader's linen noise, mean 1.
export function linenDensity(u, v, contrast = SHEER_DEFAULTS.slub) {
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise = (x, y) => {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy,
      sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy),
      b = hash(ix + 1, iy),
      c = hash(ix, iy + 1),
      d = hash(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  // Slubs: stretched along the warp (v), a couple of millimetres across; then a coarser cloudiness.
  const slub = 0.65 * noise(u / 0.0035, v / 0.055) + 0.35 * noise(u / 0.0019 + 17, v / 0.03 + 5),
    cloud = noise(u / 0.07 + 3, v / 0.21 + 11);
  return 1 + contrast * (slub - 0.5) + 0.6 * contrast * (cloud - 0.5);
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
uniform vec4 sheerBands; // slub contrast, hem height, tape height, fabric top
uniform vec4 sheerStripe; // period, width, offset, strength (0: none)
uniform vec4 sheerStripeColor; // linear rgb, axis (0: along u, 1: along v)
varying vec3 vSheerTangent;
varying vec2 vSheerFabric;
vec3 sheerWeaveT;
vec3 sheerWeaveB;
float sheerCover;
float sheerPhase( float cosTheta, float g ) {
  float d = 1.0 + g * g - 2.0 * g * cosTheta;
  return ( 1.0 - g * g ) / ( 4.0 * PI * d * sqrt( d ) );
}
float sheerHash2( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
}
// Smooth two-dimensional value noise (smoothstep in both axes), mean 0.5.
float sheerNoise2( vec2 p ) {
  vec2 i = floor( p ), f = fract( p ), s = f * f * ( 3.0 - 2.0 * f );
  float a = sheerHash2( i ), b = sheerHash2( i + vec2( 1.0, 0.0 ) ), c = sheerHash2( i + vec2( 0.0, 1.0 ) ), d = sheerHash2( i + vec2( 1.0, 1.0 ) );
  return a + ( b - a ) * s.x + ( c - a ) * s.y + ( a - b - c + d ) * s.x * s.y;
}`,
    "fragment shader"
  );
  fragment = replaceOnce(
    fragment,
    "#include <color_fragment>",
    `#include <color_fragment>
if ( sheerStripe.w > 0.0 ) {
  // Woven stripes in fabric metres, softened to the pixel footprint so they never alias.
  float along = sheerStripeColor.w > 0.5 ? vSheerFabric.y : vSheerFabric.x;
  float w = fwidth( along );
  float phase = fract( ( along - sheerStripe.z ) / sheerStripe.x ) * sheerStripe.x;
  float band = smoothstep( -w, w, phase ) * ( 1.0 - smoothstep( sheerStripe.y - w, sheerStripe.y + w, phase ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, sheerStripeColor.rgb, band * sheerStripe.w );
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
  // Linen slubs: a smooth noise stretched along the warp (fabric metres, y up from the hem), faded
  // before it is finer than about two pixels; and a coarser cloudiness that survives at a distance.
  vec2 footprint = fwidth( vSheerFabric );
  float fine = 1.0 - smoothstep( 0.0012, 0.0036, footprint.x );
  float slub = 0.65 * sheerNoise2( vec2( vSheerFabric.x / 0.0035, vSheerFabric.y / 0.055 ) ) + 0.35 * sheerNoise2( vec2( vSheerFabric.x / 0.0019 + 17.0, vSheerFabric.y / 0.03 + 5.0 ) );
  float cloud = sheerNoise2( vec2( vSheerFabric.x / 0.07 + 3.0, vSheerFabric.y / 0.21 + 11.0 ) );
  float coarse = 1.0 - smoothstep( 0.02, 0.06, footprint.x );
  float density = 1.0 + sheerBands.x * ( slub - 0.5 ) * fine + 0.6 * sheerBands.x * ( cloud - 0.5 ) * coarse;
  // The doubled hem and the heading tape: two layers, so their gaps rarely line up.
  float hem = 1.0 - smoothstep( sheerBands.y - 0.004, sheerBands.y + 0.002, vSheerFabric.y );
  float tape = sheerBands.z > 0.0 ? smoothstep( sheerBands.w - sheerBands.z - 0.004, sheerBands.w - sheerBands.z + 0.002, vSheerFabric.y ) : 0.0;
  float open = clamp( ( 1.0 - sheerCover ) * ( 2.0 - density ), 0.0, 1.0 );
  sheerCover = 1.0 - mix( open, open * open, max( hem, tape ) );
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
  reflectedLight.directDiffuse += directLight.color * ( - dotNL * meets / max( sheerCover, 0.25 ) * lobe ) * sheerTransmission * material.diffuseColor / max( max( material.diffuseColor.r, material.diffuseColor.g ), max( material.diffuseColor.b, 0.05 ) );
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
  vec3 sheerTint = material.diffuseColor / max( max( material.diffuseColor.r, material.diffuseColor.g ), max( material.diffuseColor.b, 0.05 ) );
  reflectedLight.indirectDiffuse += sheerTransmission * sheerTint * sheerMeets * ( ( 1.0 - sheerForward ) * sheerBehind * RECIPROCAL_PI + sheerForward * sheerThrough );
}
#include <aomap_fragment>`,
    "fragment shader"
  );
  fragment = replaceOnce(
    fragment,
    "#include <opaque_fragment>",
    `// Coverage: blended alpha in the transparent pass; or (the October 16 path) alpha-to-coverage under
// multisampling dithered by a quarter sample, with a hashed discard where the target has no samples.
#if defined( SHEER_BLEND )
  diffuseColor.a = clamp( sheerCover, 0.0, 1.0 );
#elif defined( SHEER_OPAQUE )
  diffuseColor.a = 1.0;
#else
  if ( sheerHashed > 0.5 ) {
    if ( sheerNoise( gl_FragCoord.xy ) >= sheerCover ) discard;
    diffuseColor.a = 1.0;
  } else {
    diffuseColor.a = clamp( sheerCover + ( sheerNoise( gl_FragCoord.xy ) - 0.5 ) * 0.25, 0.0, 1.0 );
  }
#endif
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
// of uniforms. Call `bindMesh` on every mesh drawn in it.
export function createSheerFabric(options = {}) {
  const o = { ...SHEER_DEFAULTS, ...options };
  const blend = o.coverage === "blend",
    opaque = o.coverage === "opaque";
  const stripe = o.stripe;
  const stripeColor = stripe ? linear(stripe.color ?? 0x2f4a6b) : new THREE.Color(0, 0, 0);
  const uniforms = {
    sheerYarn: { value: new THREE.Vector2(...weaveYarnRatios(o.openness, o.weaveBalance)) },
    sheerTransmission: { value: new THREE.Vector3() },
    sheerForward: { value: o.forward },
    sheerAnisotropy: { value: o.anisotropy },
    sheerShadowLeak: { value: o.shadowLeak },
    sheerHashed: { value: 0 },
    sheerBands: { value: new THREE.Vector4(o.slub, o.hemHeight, o.tapeHeight, o.fabricTop) },
    sheerStripe: { value: new THREE.Vector4(stripe?.period ?? 1, stripe?.width ?? 0, stripe?.offset ?? 0, stripe ? (stripe.strength ?? 1) : 0) },
    sheerStripeColor: { value: new THREE.Vector4(stripeColor.r, stripeColor.g, stripeColor.b, stripe?.axis === "v" ? 1 : 0) },
  };
  const setTransmission = (amount, color) => {
    const c = linear(color);
    uniforms.sheerTransmission.value.set(c.r, c.g, c.b).multiplyScalar(amount);
  };
  setTransmission(o.transmission, o.transmissionColor);

  const material = new THREE.MeshPhysicalMaterial({
    name: o.name ?? SHEER_FABRIC_NAME,
    color: o.color,
    roughness: o.roughness,
    metalness: 0,
    ior: 1.5,
    specularIntensity: o.specularIntensity,
    sheen: o.sheen,
    sheenRoughness: o.sheenRoughness,
    sheenColor: o.sheenColor,
    side: THREE.DoubleSide,
    // Blended: the transparent pass, both faces in one draw, not writing depth, so folds show through
    // folds; covered fragments take the fabric's colour and the canvas's alpha is kept.
    // Coverage: the opaque pass with per-sample alpha-to-coverage.
    transparent: blend,
    alphaToCoverage: !blend && !opaque,
    depthWrite: !blend,
    blending: THREE.CustomBlending,
    blendSrc: blend ? THREE.SrcAlphaFactor : THREE.OneFactor,
    blendDst: blend ? THREE.OneMinusSrcAlphaFactor : THREE.ZeroFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  // One pass for both faces: a uniform sheer blends nearly order-independently, and the two-pass
  // back-then-front draw would double the curtains' draws (and the sea mirror's).
  if (blend) {
    material.defines = { SHEER_BLEND: "" };
    material.forceSinglePass = true;
  }
  if (opaque) material.defines = { SHEER_OPAQUE: "" };
  material.onBeforeCompile = (shader) => patchSheerShader(shader, uniforms);
  material.customProgramCacheKey = () => `coastal-sheer-linen-v2-${o.coverage}`;

  const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depthMaterial.name = `${material.name} depth`;
  depthMaterial.onBeforeCompile = (shader) => patchSheerShadowShader(shader, uniforms, false);
  depthMaterial.customProgramCacheKey = () => "coastal-sheer-voile-depth-v1";
  const distanceMaterial = new THREE.MeshDistanceMaterial();
  distanceMaterial.name = `${material.name} distance`;
  distanceMaterial.onBeforeCompile = (shader) => patchSheerShadowShader(shader, uniforms, true);
  distanceMaterial.customProgramCacheKey = () => "coastal-sheer-voile-distance-v1";

  // Hashed coverage wherever the current target cannot multisample (the reflection pass, a direct
  // canvas render): alpha-to-coverage would otherwise draw the sheet solid there.
  function chooseCoverage(renderer) {
    if (blend || opaque) return;
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
    blend,
    opaque,
    setOpenness(openness, weaveBalance = o.weaveBalance) {
      uniforms.sheerYarn.value.set(...weaveYarnRatios(openness, weaveBalance));
    },
    setTransmission,
    bindMesh(mesh) {
      mesh.material = material;
      // A sheer's partial shadow needs its own depth material (which also tells the shadow cache it
      // moves). A dense cloth casts an ordinary shadow: the cache sees its positions change and keeps
      // it while it sleeps.
      if (!opaque) {
        mesh.customDepthMaterial = depthMaterial;
        mesh.customDistanceMaterial = distanceMaterial;
      }
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

// Meshes for every panel of a curtain cloth, with dynamic position, normal and weave-tangent
// attributes refreshed by `update(revisions)` once per frame after the solver has stepped. The solver's
// grid is coarse (a gathered bay is four 7 cm cells, which drawn as is reads as a brick pattern of flat
// facets), so each row is drawn through a uniform Catmull-Rom spline across its columns at `refine`
// times the resolution: the cloth is simulated coarse and drawn smooth. Normals are central
// differences on the refined grid.
export function createCurtainMeshes(cloth, fabric = createSheerFabric(), { refine = 3 } = {}) {
  const K = Math.max(1, refine | 0);
  const entries = cloth.panels.map((panel) => {
    const C = panel.columns,
      R = panel.rows,
      Cr = (C - 1) * K + 1,
      count = Cr * R;
    const geometry = new THREE.BufferGeometry();
    const attribute = (size) => new THREE.BufferAttribute(new Float32Array(size * count), size).setUsage(THREE.DynamicDrawUsage);
    const position = attribute(3),
      normal = attribute(3),
      tangent = attribute(3),
      uv = new Float32Array(2 * count),
      solver = new Float32Array(3 * panel.count);
    for (let r = 0; r < R; r++)
      for (let c = 0; c < Cr; c++) {
        const f = c / K,
          c0 = Math.min(C - 2, Math.floor(f)),
          t = f - c0,
          k = 2 * (r * Cr + c);
        uv[k] = panel.uv[2 * (r * C + c0)] + (panel.uv[2 * (r * C + c0 + 1)] - panel.uv[2 * (r * C + c0)]) * t;
        uv[k + 1] = panel.uv[2 * (r * C + c0) + 1];
      }
    const index = new (count < 65536 ? Uint16Array : Uint32Array)((Cr - 1) * (R - 1) * 6);
    for (let r = 0, k = 0; r < R - 1; r++)
      for (let c = 0; c < Cr - 1; c++, k += 6) {
        const i00 = r * Cr + c,
          i10 = i00 + 1,
          i01 = i00 + Cr,
          i11 = i01 + 1;
        // Alternating diagonals, the same winding (du x dv) as the solver's triangles.
        if ((r + c) % 2 === 0) index.set([i00, i10, i11, i00, i11, i01], k);
        else index.set([i00, i10, i01, i10, i11, i01], k);
      }
    geometry.setAttribute("position", position);
    geometry.setAttribute("normal", normal);
    geometry.setAttribute("sheerTangent", tangent);
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    // A fixed, conservative bound: the solver's billow never leaves it, and nothing recomputes it.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...panel.boundingSphere.center), panel.boundingSphere.radius);
    const mesh = new THREE.Mesh(geometry, fabric.material);
    mesh.name = `curtain ${panel.id}`;
    mesh.matrixAutoUpdate = false;
    fabric.bindMesh(mesh);
    const entry = { mesh, position, normal, tangent, solver, id: panel.id, revision: -1, C, R, Cr };
    write(entry, panel.id);
    return entry;
  });

  function write(entry, id) {
    const { solver, C, R, Cr } = entry,
      p = entry.position.array,
      n = entry.normal.array,
      tg = entry.tangent.array;
    cloth.writePanel(id, solver);
    // Catmull-Rom across each row.
    for (let r = 0; r < R; r++) {
      const row = r * C;
      for (let c = 0; c < C - 1; c++) {
        const a = 3 * (row + Math.max(0, c - 1)),
          b = 3 * (row + c),
          d = 3 * (row + c + 1),
          e = 3 * (row + Math.min(C - 1, c + 2));
        for (let j = 0; j < K; j++) {
          const t = j / K,
            t2 = t * t,
            t3 = t2 * t,
            w0 = 0.5 * (-t3 + 2 * t2 - t),
            w1 = 0.5 * (3 * t3 - 5 * t2 + 2),
            w2 = 0.5 * (-3 * t3 + 4 * t2 + t),
            w3 = 0.5 * (t3 - t2),
            o = 3 * (r * Cr + c * K + j);
          p[o] = w0 * solver[a] + w1 * solver[b] + w2 * solver[d] + w3 * solver[e];
          p[o + 1] = w0 * solver[a + 1] + w1 * solver[b + 1] + w2 * solver[d + 1] + w3 * solver[e + 1];
          p[o + 2] = w0 * solver[a + 2] + w1 * solver[b + 2] + w2 * solver[d + 2] + w3 * solver[e + 2];
        }
      }
      const last = 3 * (row + C - 1),
        o = 3 * (r * Cr + Cr - 1);
      p[o] = solver[last];
      p[o + 1] = solver[last + 1];
      p[o + 2] = solver[last + 2];
    }
    // Central differences: du across the refined row, dv down the column; normal du x dv.
    for (let r = 0; r < R; r++)
      for (let c = 0; c < Cr; c++) {
        const l = 3 * (r * Cr + (c > 0 ? c - 1 : c)),
          rr = 3 * (r * Cr + (c < Cr - 1 ? c + 1 : c)),
          u = 3 * ((r > 0 ? r - 1 : r) * Cr + c),
          dn = 3 * ((r < R - 1 ? r + 1 : r) * Cr + c),
          o = 3 * (r * Cr + c);
        const ux = p[rr] - p[l],
          uy = p[rr + 1] - p[l + 1],
          uz = p[rr + 2] - p[l + 2],
          vx = p[dn] - p[u],
          vy = p[dn + 1] - p[u + 1],
          vz = p[dn + 2] - p[u + 2];
        let nx = uy * vz - uz * vy,
          ny = uz * vx - ux * vz,
          nz = ux * vy - uy * vx;
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= length;
        ny /= length;
        nz /= length;
        n[o] = nx;
        n[o + 1] = ny;
        n[o + 2] = nz;
        const along = ux * nx + uy * ny + uz * nz,
          tx = ux - along * nx,
          ty = uy - along * ny,
          tz = uz - along * nz,
          tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
        tg[o] = tx / tl;
        tg[o + 1] = ty / tl;
        tg[o + 2] = tz / tl;
      }
    entry.position.needsUpdate = entry.normal.needsUpdate = entry.tangent.needsUpdate = true;
  }

  return {
    meshes: entries.map((entry) => entry.mesh),
    refine: K,
    vertices: entries.reduce((sum, entry) => sum + entry.Cr * entry.R, 0),
    // Rewrites the panels whose solver revision changed (all of them without `revisions`).
    update(revisions = null) {
      for (let k = 0; k < entries.length; k++) {
        const entry = entries[k];
        if (revisions && revisions[k] === entry.revision) continue;
        if (revisions) entry.revision = revisions[k];
        write(entry, k);
      }
    },
    dispose() {
      for (const entry of entries) entry.mesh.geometry.dispose();
    },
  };
}
