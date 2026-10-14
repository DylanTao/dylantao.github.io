import * as THREE from "../three.module.min.js";

// The light well over the onsen (bin/coastal_lightwell.py). The bath's vault stays in the sun's
// shadow map even while the cutaway lifts the roof, so sunlight reaches the bath only along rays
// that clear both openings of the drilled shaft. One visibility function serves the dust beam
// drawn here and the bath steam (steam-volume.mjs), so the shaft of light, the sun patch it
// throws through the shadow map and the steam it lights all agree.
//
// The shaft leans toward the noon sun, so its horizontal sections are ellipses, longer along the
// lean by 1/cos(tilt). Each opening's edge softens over the sun's own angular radius (about
// 0.27 degrees) at that distance: a penumbra, not a blur.
export const wellLightGLSL = `
uniform vec4 wellAperture, wellTop;
uniform float wellSquash, wellEnabled;
float wellOpening(vec3 p, vec3 toSun, vec4 opening) {
  float t=(opening.y-p.y)/toSun.y;
  vec2 d=p.xz+toSun.xz*t-opening.xz;
  d.x*=wellSquash;
  float penumbra=max(.004,t*.0047);
  return clamp((opening.w-length(d))/penumbra*.5+.5,0.,1.);
}
float wellLight(vec3 p, vec3 toSun) {
  if(wellEnabled<.5) return 1.;
  if(toSun.y<.02||p.y>wellAperture.y) return 0.;
  return wellOpening(p,toSun,wellAperture)*wellOpening(p,toSun,wellTop);
}
`;

export function wellUniforms(well) {
  const tilt = well ? Math.acos(Math.min(1, Math.abs(well.axis[1]))) : 0;
  return {
    wellAperture: { value: well ? new THREE.Vector4(...well.aperture, well.apertureRadius) : new THREE.Vector4() },
    wellTop: { value: well ? new THREE.Vector4(...well.top, well.topRadius) : new THREE.Vector4() },
    wellSquash: { value: Math.cos(tilt) },
    wellEnabled: { value: well ? 1 : 0 },
  };
}

// The share of the aperture the sun can reach through the shaft: stratified points over the
// lower opening, each followed toward the sun to the upper one. Zero when the sun is down or
// the shaft is out of line with it.
export function wellOpenFraction(well, toSun, samples = 12) {
  if (!well || !(toSun[1] > 0.02)) return 0;
  const [ax, ay, az] = well.aperture,
    [tx, ty, tz] = well.top,
    squash = Math.cos(Math.acos(Math.min(1, Math.abs(well.axis[1])))),
    t = (ty - ay) / toSun[1];
  let open = 0,
    total = 0;
  for (let i = 0; i < samples; i++)
    for (let j = 0; j < samples; j++) {
      const u = ((i + 0.5) / samples) * 2 - 1,
        v = ((j + 0.5) / samples) * 2 - 1;
      if (u * u + v * v > 1) continue;
      total++;
      const x = ax + (u * well.apertureRadius) / squash,
        z = az + v * well.apertureRadius,
        dx = (x + toSun[0] * t - tx) * squash,
        dz = z + toSun[2] * t - tz;
      if (dx * dx + dz * dz <= well.topRadius * well.topRadius) open++;
    }
  return total ? open / total : 0;
}

// The radiance the shaft sends down through its aperture, by Monte Carlo path tracing of the
// drilled cylinder: paths start on the aperture, cosine-distributed upward, and either leave
// through the clifftop opening (sky) or meet the limestone wall, where the sun (when it reaches
// that spot through the opening) and the sky light it. A fixed Halton sequence makes the
// estimate move smoothly with the sun instead of flickering between updates. The sun's own disc
// is left out here: that beam arrives through the shadow map and the dust shader.
const HALTON_BASES = [2, 3, 5, 7, 11, 13];
function halton(index, base) {
  let f = 1,
    r = 0;
  for (let i = index; i > 0; i = Math.floor(i / base)) {
    f /= base;
    r += f * (i % base);
  }
  return r;
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  unit = (a) => scale(a, 1 / Math.hypot(...a)),
  cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function shaftExitRadiance(well, { toSun, sunIrradiance = [0, 0, 0], skyRadiance = [0, 0, 0], albedo = 0.62, samples = 512 } = {}) {
  const axis = unit(well.axis),
    origin = well.aperture,
    radius = well.apertureRadius,
    height = dot3(sub(well.top, origin), axis),
    across = unit(cross3(axis, Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])),
    along = cross3(axis, across),
    sun = toSun ? unit(toSun) : null;
  // Distance along a ray from inside the shaft to its wall (the far root) and to the top cap.
  const toWall = (p, d) => {
    const q = sub(p, origin),
      qPerp = sub(q, scale(axis, dot3(q, axis))),
      dPerp = sub(d, scale(axis, dot3(d, axis))),
      a = dot3(dPerp, dPerp),
      b = 2 * dot3(qPerp, dPerp),
      c = dot3(qPerp, qPerp) - radius * radius;
    if (a < 1e-12) return Infinity;
    const disc = b * b - 4 * a * c;
    return disc < 0 ? Infinity : (-b + Math.sqrt(disc)) / (2 * a);
  };
  const toTop = (p, d) => {
    const climb = dot3(d, axis);
    return climb > 1e-6 ? (height - dot3(sub(p, origin), axis)) / climb : Infinity;
  };
  const escapes = (p, d) => toTop(p, d) < toWall(p, d) - 1e-6;
  const total = [0, 0, 0];
  let open = 0;
  for (let i = 1; i <= samples; i++) {
    const [h1, h2, h3, h4, h5, h6] = HALTON_BASES.map((base) => halton(i, base));
    const r = radius * Math.sqrt(h1) * 0.999,
      phi = 2 * Math.PI * h2,
      start = add(origin, add(scale(across, r * Math.cos(phi)), scale(along, r * Math.sin(phi)))),
      cosTheta = Math.sqrt(1 - h3),
      sinTheta = Math.sqrt(h3),
      turn = 2 * Math.PI * h4,
      direction = add(scale(axis, cosTheta), add(scale(across, sinTheta * Math.cos(turn)), scale(along, sinTheta * Math.sin(turn))));
    if (escapes(start, direction)) {
      for (let k = 0; k < 3; k++) total[k] += skyRadiance[k];
      open++;
      continue;
    }
    const hit = add(start, scale(direction, toWall(start, direction))),
      offset = sub(hit, origin),
      normal = unit(scale(sub(offset, scale(axis, dot3(offset, axis))), -1)),
      inside = add(hit, scale(normal, 1e-4));
    let sunlit = 0;
    if (sun && dot3(normal, sun) > 0 && dot3(sun, axis) > 0 && escapes(inside, sun)) sunlit = dot3(normal, sun);
    // The wall's view of the sky: one cosine-distributed sample about its normal per path.
    const tangent = unit(cross3(normal, axis)),
      bitangent = cross3(normal, tangent),
      wallCos = Math.sqrt(1 - h5),
      wallSin = Math.sqrt(h5),
      wallTurn = 2 * Math.PI * h6,
      skyward = add(scale(normal, wallCos), add(scale(tangent, wallSin * Math.cos(wallTurn)), scale(bitangent, wallSin * Math.sin(wallTurn))));
    const skyShare = escapes(inside, skyward) ? 1 : 0;
    for (let k = 0; k < 3; k++) total[k] += (albedo / Math.PI) * (sunIrradiance[k] * sunlit + Math.PI * skyRadiance[k] * skyShare);
  }
  return { radiance: scale(total, 1 / samples), skyShare: open / samples, samples, method: "Halton quasi-Monte Carlo, one wall bounce" };
}

// Two small area lights reach the bath's surfaces. The aperture sends the shaft's exit radiance
// down, and the sun patch it throws on the water or floor sends some of that sunlight back up
// (one diffuse bounce). Both are horizontal ellipses of the aperture's shape: projecting a flat
// shape along the sun onto a parallel plane only moves it. Lambert's polygon formula gives each
// one's exact projected solid angle from a surface point (16 corners), ignoring anything in
// between. Only points inside the bath's region pay for it.
export const wellIrradianceGLSL = `
uniform vec3 wellExit, wellRegionMin, wellRegionMax, wellPatchRadiance;
uniform vec4 wellPatch;
float wellEllipseFactor(vec3 p, vec3 n, vec3 center) {
  float sum=0.;
  vec3 previous=normalize(vec3(center.x+wellAperture.w/wellSquash,center.y,center.z)-p);
  for(int k=1;k<=16;k++) {
    float a=float(k)*.39269908;
    vec3 corner=normalize(vec3(center.x+cos(a)*wellAperture.w/wellSquash,center.y,center.z+sin(a)*wellAperture.w)-p);
    vec3 c=cross(previous,corner);
    float l=length(c);
    if(l>1e-6) sum+=acos(clamp(dot(previous,corner),-1.,1.))*dot(n,c/l);
    previous=corner;
  }
  // The corners turn one way seen from below the ellipse and the other way from above.
  return max(0.,(p.y<center.y?-.5:.5)*sum);
}
vec3 wellIrradiance(vec3 p, vec3 n) {
  if(wellEnabled<.5||any(lessThan(p,wellRegionMin))||any(greaterThan(p,wellRegionMax))||p.y>wellAperture.y-.02) return vec3(0.);
  vec3 light=wellExit*wellEllipseFactor(p,n,wellAperture.xyz);
  if(wellPatch.w>.5&&p.y>wellPatch.y+.01) light+=wellPatchRadiance*wellEllipseFactor(p,n,wellPatch.xyz);
  return light;
}
`;

// Where the sun patch lies and how bright it glows back: the beam's centre followed down from the
// aperture to the water (inside the pool) or the floor, lit at the sun's incidence and reflected
// with a diffuse albedo (the pool's stone through the water is darker than the floor).
export function wellSunPatch(well, toSun, sunIrradiance, open, pool) {
  if (!(open > 0) || !(toSun[1] > 0.02)) return null;
  const s = unit(toSun),
    across = (planeY) => (well.aperture[1] - planeY) / s[1],
    water = pool ? pool.surfaceY : -Infinity;
  let planeY = well.floor,
    albedo = 0.42;
  if (pool) {
    const t = across(water),
      x = well.aperture[0] - s[0] * t,
      z = well.aperture[2] - s[2] * t;
    if (Math.hypot(x - pool.center[0], z - pool.center[1]) < pool.radius) {
      planeY = water;
      albedo = 0.22;
    }
  }
  const t = across(planeY);
  return {
    center: [well.aperture[0] - s[0] * t, planeY, well.aperture[2] - s[2] * t],
    radiance: sunIrradiance.map((e) => (albedo * e * s[1] * open) / Math.PI),
  };
}

// Floating dust in the beam: single scattering with a mildly forward Henyey-Greenstein phase,
// marched only across the stretch of each view ray that lies inside the beam's elliptic cylinder.
export function createLightWell(well, { region, steps = 24 } = {}) {
  const uniforms = {
    ...wellUniforms(well),
    wellSun: { value: new THREE.Vector3(0, 1, 0) },
    wellRadiance: { value: new THREE.Vector3() },
    wellDust: { value: 4.0 },
    wellTime: { value: 0 },
    wellFloor: { value: well.floor },
    wellPool: { value: new THREE.Vector4(0, 0, 0, 0) },
    wellOpaqueDepth: { value: null },
    wellDepthEnabled: { value: false },
    wellExit: { value: new THREE.Vector3() },
    wellPatch: { value: new THREE.Vector4() },
    wellPatchRadiance: { value: new THREE.Vector3() },
    wellRegionMin: { value: new THREE.Vector3(region.min[0], well.floor - 0.05, region.min[2]) },
    wellRegionMax: { value: new THREE.Vector3(region.max[0], well.aperture[1], region.max[2]) },
    wellViewport: { value: new THREE.Vector4(0, 0, 1, 1) },
    wellProjectionInverse: { value: new THREE.Matrix4() },
    wellCameraWorld: { value: new THREE.Matrix4() },
  };
  const min = new THREE.Vector3(region.min[0], well.floor, region.min[2]),
    max = new THREE.Vector3(region.max[0], well.aperture[1], region.max[2]),
    size = max.clone().sub(min),
    geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: "void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `
precision highp float;
uniform vec3 wellSun, wellRadiance;
uniform float wellDust, wellTime, wellFloor;
uniform vec4 wellPool;
uniform sampler2D wellOpaqueDepth;
uniform bool wellDepthEnabled;
uniform vec4 wellViewport;
uniform mat4 wellProjectionInverse, wellCameraWorld;
${wellLightGLSL}
vec3 wellWorld(vec2 uv, float depth) {
  vec4 p=wellProjectionInverse*vec4(uv*2.-1.,depth*2.-1.,1.);
  return (wellCameraWorld*vec4(p.xyz/p.w,1.)).xyz;
}
float wellHash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float wellNoise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(wellHash(i),wellHash(i+vec3(1,0,0)),f.x),mix(wellHash(i+vec3(0,1,0)),wellHash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(wellHash(i+vec3(0,0,1)),wellHash(i+vec3(1,0,1)),f.x),mix(wellHash(i+vec3(0,1,1)),wellHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
void main() {
  vec2 uv=(gl_FragCoord.xy-wellViewport.xy)/wellViewport.zw;
  vec3 origin=wellWorld(uv,0.), ray=normalize(wellWorld(uv,1.)-origin), s=wellSun;
  // Where the view ray projects, along the sun, inside the aperture's ellipse: a quadratic.
  vec2 a=origin.xz+s.xz*(wellAperture.y-origin.y)/s.y-wellAperture.xz, b=ray.xz-s.xz*ray.y/s.y;
  a.x*=wellSquash; b.x*=wellSquash;
  float qa=dot(b,b), qb=2.*dot(a,b), qc=dot(a,a)-wellAperture.w*wellAperture.w*1.1, disc=qb*qb-4.*qa*qc;
  if(qa<1e-8||disc<=0.) discard;
  float root=sqrt(disc), t0=max(0.,(-qb-root)/(2.*qa)), t1=(-qb+root)/(2.*qa);
  // Between the aperture's height and the floor, or the water inside the pool.
  float above=(wellAperture.y-origin.y)/ray.y, below=(wellFloor-origin.y)/ray.y;
  if(ray.y<0.) { t0=max(t0,above); t1=min(t1,below); } else { t0=max(t0,below); t1=min(t1,above); }
  if(wellDepthEnabled) {
    float depth=texture2D(wellOpaqueDepth,uv).r;
    if(depth<.999999) t1=min(t1,dot(wellWorld(uv,depth)-origin,ray));
  }
  if(t1<=t0) discard;
  float ds=(t1-t0)/float(${steps}), column=0.;
  for(int i=0;i<${steps};i++) {
    vec3 p=origin+ray*(t0+(float(i)+.5)*ds);
    if(length(p.xz-wellPool.xy)<wellPool.z&&p.y<wellPool.w) continue;
    float motes=.65+.7*wellNoise(p*7.+vec3(0.,wellTime*.04,wellTime*.015));
    column+=wellLight(p,s)*motes*ds;
  }
  float g=.35, cosine=dot(ray,s);
  float phase=(1.-g*g)/(12.56637061436*pow(max(.001,1.+g*g-2.*g*cosine),1.5));
  gl_FragColor=vec4(wellRadiance*(wellDust*phase*column),0.);
}
`,
    transparent: true,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Light well dust beam";
  mesh.position.copy(min).addScaledVector(size, 0.5);
  mesh.renderOrder = 10001;
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.userData.noOcclusion = mesh.userData.noContactOcclusion = mesh.userData.noVolumeDepth = true;
  let open = 0,
    draws = 0,
    exit = null,
    pool = null,
    patch = null;
  const bindings = new Map();
  mesh.onBeforeRender = (renderer, scene, camera) => {
    renderer.getCurrentViewport(uniforms.wellViewport.value);
    uniforms.wellProjectionInverse.value.copy(camera.projectionMatrixInverse);
    uniforms.wellCameraWorld.value.copy(camera.matrixWorld);
    material.uniformsNeedUpdate = true;
    draws++;
  };
  return {
    object: mesh,
    uniforms,
    // Follow the actual sun (direction toward it, color times intensity) and sky radiance; the
    // shaft's exit radiance is re-traced whenever they change.
    setSun(toSun, radiance, skyRadiance = [0, 0, 0]) {
      uniforms.wellSun.value.fromArray(toSun).normalize();
      uniforms.wellRadiance.value.fromArray(radiance);
      open = wellOpenFraction(well, uniforms.wellSun.value.toArray());
      exit = shaftExitRadiance(well, { toSun: uniforms.wellSun.value.toArray(), sunIrradiance: radiance, skyRadiance });
      uniforms.wellExit.value.fromArray(exit.radiance);
      patch = wellSunPatch(well, uniforms.wellSun.value.toArray(), radiance, open, pool);
      uniforms.wellPatch.value.set(...(patch ? patch.center : [0, 0, 0]), patch ? 1 : 0);
      uniforms.wellPatchRadiance.value.fromArray(patch ? patch.radiance : [0, 0, 0]);
      return open;
    },
    // Surfaces in the bath receive the shaft's light as from an area light at the aperture.
    bindMaterial(material) {
      if (!material?.isMeshStandardMaterial || bindings.has(material)) return;
      const compile = material.onBeforeCompile,
        cache = material.customProgramCacheKey;
      material.onBeforeCompile = function (shader, renderer) {
        compile.call(this, shader, renderer);
        for (const key of [
          "wellAperture",
          "wellSquash",
          "wellEnabled",
          "wellExit",
          "wellRegionMin",
          "wellRegionMax",
          "wellTop",
          "wellPatch",
          "wellPatchRadiance",
        ])
          shader.uniforms[key] = uniforms[key];
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 wellWorldPosition;")
          .replace("#include <project_vertex>", "wellWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", `#include <common>\nvarying vec3 wellWorldPosition;\n${wellLightGLSL}\n${wellIrradianceGLSL}`)
          .replace(
            "#include <aomap_fragment>",
            "reflectedLight.indirectDiffuse+=wellIrradiance(wellWorldPosition,inverseTransformDirection(normal,viewMatrix))*BRDF_Lambert(material.diffuseColor);\n#include <aomap_fragment>"
          );
      };
      material.customProgramCacheKey = function () {
        return `${cache.call(this)}|light-well-v1`;
      };
      material.needsUpdate = true;
      bindings.set(material, true);
    },
    setPool(center, radius, surfaceY) {
      pool = { center, radius, surfaceY };
      uniforms.wellPool.value.set(center[0], center[1], radius, surfaceY);
    },
    setDepth(opaqueDepthTexture, camera) {
      uniforms.wellOpaqueDepth.value = opaqueDepthTexture;
      uniforms.wellDepthEnabled.value = Boolean(opaqueDepthTexture && camera);
    },
    get open() {
      return open;
    },
    evidence() {
      return {
        method: "analytic elliptic-cylinder interval, single-scattering dust, penumbral shaft visibility",
        steps,
        open,
        draws,
        visible: mesh.visible,
        exit: exit && {
          radiance: exit.radiance.map((v) => +v.toFixed(4)),
          skyShare: +exit.skyShare.toFixed(3),
          samples: exit.samples,
          method: exit.method,
        },
        sunPatch: patch && { center: patch.center.map((v) => +v.toFixed(3)), radiance: patch.radiance.map((v) => +v.toFixed(4)) },
        boundMaterials: bindings.size,
      };
    },
    dispose() {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
