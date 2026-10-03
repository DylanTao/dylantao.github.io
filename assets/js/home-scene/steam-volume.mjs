import * as THREE from "../three.module.min.js";

// Original short-range single-scattering integrator, informed by Wronski's
// 2014 volumetric fog notes. This is a local volume, not his frustum-grid system.
// RGBA8 tiles use native bilinear XY and explicit linear Z interpolation: two
// taps per density lookup, without floating-point linear filtering support.
export const steamSamplingGLSL = `
uniform sampler2D steamAtlas;
uniform vec3 steamGrid, steamMin, steamMax;
uniform vec2 steamAtlasSize;
uniform float steamTiles, steamMaximumDensity;
vec2 steamSliceUV(vec2 cell, float slice) {
  vec2 tile=vec2(mod(slice,steamTiles),floor(slice/steamTiles));
  return (tile*steamGrid.xy+cell+.5)/steamAtlasSize;
}
float steamDensity(vec3 p) {
  vec3 cell=clamp((p-steamMin)/(steamMax-steamMin)*steamGrid-.5,vec3(0.),steamGrid-1.);
  float z=floor(cell.z), nextZ=min(z+1.,steamGrid.z-1.);
  float a=texture2D(steamAtlas,steamSliceUV(cell.xy,z)).r;
  float b=texture2D(steamAtlas,steamSliceUV(cell.xy,nextZ)).r;
  // Gentle boundary taper is static support, not animated opacity noise.
  vec3 q=(p-steamMin)/(steamMax-steamMin);
  float edge=smoothstep(0.,.08,q.x)*smoothstep(0.,.08,1.-q.x)
    *smoothstep(0.,.08,q.z)*smoothstep(0.,.08,1.-q.z);
  float top=1.-smoothstep(.68,1.,q.y);
  return mix(a,b,fract(cell.z))*steamMaximumDensity*edge*top;
}
`;

// The same interval logic has a CPU reference for geometry/order acceptance.
// Only the nearest transmissive interface is represented. Three supplies an
// approximate screen-space refracted background, not a multi-interface path.
export function steamRayIntervals(entry, exit, opaque, transmission = Infinity) {
  const start = Math.max(0, entry),
    end = Math.min(exit, opaque),
    split = Number.isFinite(transmission) && transmission < opaque - 0.0001;
  if (!(end > start)) return { background: null, foreground: null };
  const interval = (a, b) => (b > a ? [a, b] : null);
  return split
    ? { background: interval(Math.max(start, transmission), end), foreground: interval(start, Math.min(end, transmission)) }
    : { background: [start, end], foreground: null };
}

export function integrateSteamSamples(samples, stepLength, { extinction = 4.5, albedo = 0.94, incident = [1, 1, 1] } = {}) {
  if (
    !Number.isFinite(stepLength) ||
    stepLength < 0 ||
    !Number.isFinite(extinction) ||
    extinction < 0 ||
    !Number.isFinite(albedo) ||
    albedo < 0 ||
    albedo > 1
  )
    throw new RangeError("bounded Beer–Lambert coefficients required");
  let transmission = 1;
  const radiance = [0, 0, 0];
  for (const density of samples) {
    const attenuation = Math.exp(-Math.max(0, density) * extinction * stepLength),
      weight = transmission * (1 - attenuation) * albedo;
    for (let axis = 0; axis < 3; axis++) radiance[axis] += incident[axis] * weight;
    transmission *= attenuation;
  }
  return { radiance, transmission, alpha: 1 - transmission };
}

export function steamPhase(cosine, anisotropy = 0.25) {
  const g = Math.max(-0.8, Math.min(0.8, anisotropy)),
    c = Math.max(-1, Math.min(1, cosine));
  return (1 - g * g) / (4 * Math.PI * (1 + g * g - 2 * g * c) ** 1.5);
}

export function createSteamVolume(field, { steps = 40, extinction = 4.5, albedo = 0.94, anisotropy = 0.25 } = {}) {
  if (
    !Number.isInteger(steps) ||
    steps < 16 ||
    steps > 64 ||
    !Number.isFinite(extinction) ||
    extinction < 0 ||
    !Number.isFinite(albedo) ||
    albedo < 0 ||
    albedo > 1
  )
    throw new RangeError("bounded steam raymarch required");
  const { domain, atlas } = field,
    texture = new THREE.DataTexture(field.writeAtlas(), atlas.width, atlas.height, THREE.RGBAFormat, THREE.UnsignedByteType),
    object = new THREE.Group(),
    uniforms = {
      steamAtlas: { value: texture },
      steamAtlasSize: { value: new THREE.Vector2(atlas.width, atlas.height) },
      steamTiles: { value: atlas.tiles },
      steamGrid: { value: new THREE.Vector3(...domain.grid) },
      steamMin: { value: new THREE.Vector3(...domain.min) },
      steamMax: { value: new THREE.Vector3(...domain.max) },
      steamMaximumDensity: { value: atlas.maximumDensity },
      steamOpaqueDepth: { value: null },
      steamTransmissionDepth: { value: null },
      steamDepthEnabled: { value: false },
      steamViewport: { value: new THREE.Vector4(0, 0, 1, 1) },
      steamProjectionInverse: { value: new THREE.Matrix4() },
      steamCameraWorld: { value: new THREE.Matrix4() },
      steamExtinction: { value: extinction },
      steamAlbedo: { value: albedo },
      steamAmbient: { value: new THREE.Vector3(0.46, 0.48, 0.48) },
      steamDirectional: { value: new THREE.Vector3(1.8, 1.45, 1.1) },
      steamLightDirection: { value: new THREE.Vector3(0.3, 0.8, 0.2).normalize() },
      steamAnisotropy: { value: THREE.MathUtils.clamp(anisotropy, -0.8, 0.8) },
    },
    fragmentShader = `
precision highp float;
uniform sampler2D steamOpaqueDepth, steamTransmissionDepth;
uniform bool steamDepthEnabled;
uniform vec4 steamViewport;
uniform mat4 steamProjectionInverse, steamCameraWorld;
uniform float steamExtinction, steamAlbedo, steamAnisotropy, steamSegment;
uniform vec3 steamAmbient, steamDirectional, steamLightDirection;
${steamSamplingGLSL}
vec3 steamWorldPoint(vec2 uv, float depth) {
  vec4 p=steamProjectionInverse*vec4(uv*2.-1.,depth*2.-1.,1.);
  return (steamCameraWorld*vec4(p.xyz/p.w,1.)).xyz;
}
void main() {
  vec2 uv=(gl_FragCoord.xy-steamViewport.xy)/steamViewport.zw;
  vec3 origin=steamWorldPoint(uv,0.), farPoint=steamWorldPoint(uv,1.);
  vec3 ray=normalize(farPoint-origin);
  vec3 safeRay=vec3(abs(ray.x)<.000001?.000001:ray.x,
    abs(ray.y)<.000001?.000001:ray.y,abs(ray.z)<.000001?.000001:ray.z);
  vec3 a=(steamMin-origin)/safeRay, b=(steamMax-origin)/safeRay;
  vec3 lo=min(a,b), hi=max(a,b);
  float entry=max(0.,max(lo.x,max(lo.y,lo.z))), end=min(hi.x,min(hi.y,hi.z));
  float opaque=1.e10, boundary=1.e10;
  bool split=false;
  if(steamDepthEnabled) {
    float depth=texture2D(steamOpaqueDepth,uv).r;
    float transparentDepth=texture2D(steamTransmissionDepth,uv).r;
    if(depth<.999999) opaque=dot(steamWorldPoint(uv,depth)-origin,ray);
    if(transparentDepth<.999999) boundary=dot(steamWorldPoint(uv,transparentDepth)-origin,ray);
    split=transparentDepth<.999999 && boundary<opaque-.0001;
  }
  end=min(end,opaque);
  if(steamSegment<.5) { if(split) entry=max(entry,boundary); }
  else { if(!split) discard; end=min(end,boundary); }
  if(end<=entry) discard;
  float ds=(end-entry)/float(${steps}), transmittance=1.;
  vec3 radiance=vec3(0.);
  // ray is camera→scene and lightDirection is point→source: looking toward
  // the source has cosine1 and therefore the forward-scattering maximum.
  float g=steamAnisotropy, cosine=dot(ray,steamLightDirection);
  float phase=(1.-g*g)/(12.56637061436*pow(max(.001,1.+g*g-2.*g*cosine),1.5));
  for(int i=0;i<${steps};i++) {
    vec3 p=origin+ray*(entry+(float(i)+.5)*ds);
    float density=steamDensity(p), sigma=density*steamExtinction;
    float attenuation=exp(-sigma*ds);
    // Two short light-direction samples approximate LOCAL single-scatter
    // self attenuation. No opaque light shadow map or multiple scattering.
    float lightDensity=steamDensity(clamp(p+steamLightDirection*.10,steamMin,steamMax))
      +steamDensity(clamp(p+steamLightDirection*.25,steamMin,steamMax));
    float lightTransmission=exp(-lightDensity*steamExtinction*.15);
    vec3 incident=steamAmbient+steamDirectional*(phase*lightTransmission);
    radiance+=transmittance*(1.-attenuation)*steamAlbedo*incident;
    transmittance*=attenuation;
    if(transmittance<.02) break;
  }
  // Linear, premultiplied scattering + extinction. Final OutputPass owns
  // tone mapping and display transfer; this volume never emits light.
  gl_FragColor=vec4(radiance,1.-transmittance);
}
`,
    size = new THREE.Vector3(...domain.max).sub(new THREE.Vector3(...domain.min)),
    geometry = new THREE.BoxGeometry(size.x, size.y, size.z),
    meshes = [];
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  object.name = "Thermal onsen steam volume";
  object.userData.noOcclusion = object.userData.noContactOcclusion = true;
  let depthCamera = null,
    lastRevision = field.revision,
    uploads = 1,
    draws = 0,
    disposed = false;
  for (let segment = 0; segment < 2; segment++) {
    const material = new THREE.ShaderMaterial({
        uniforms: { ...uniforms, steamSegment: { value: segment } },
        vertexShader: "void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader,
        transparent: segment === 1,
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendEquationAlpha: THREE.AddEquation,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        toneMapped: false,
      }),
      mesh = new THREE.Mesh(geometry, material);
    mesh.name = segment ? "Steam before nearest glass" : "Steam behind nearest glass";
    mesh.position.copy(new THREE.Vector3(...domain.min).addScaledVector(size, 0.5));
    mesh.renderOrder = 10000;
    mesh.userData.noOcclusion = mesh.userData.noContactOcclusion = true;
    mesh.userData.steamVolume = true;
    mesh.onBeforeRender = (renderer, scene, camera) => {
      // Both regular beauty and Three's transmission-background capture call
      // this hook. Their pixel viewports can differ with device pixel ratio.
      renderer.getCurrentViewport(uniforms.steamViewport.value);
      uniforms.steamProjectionInverse.value.copy(camera.projectionMatrixInverse);
      uniforms.steamCameraWorld.value.copy(camera.matrixWorld);
      uniforms.steamDepthEnabled.value = Boolean(depthCamera === camera && uniforms.steamOpaqueDepth.value && uniforms.steamTransmissionDepth.value);
      material.uniformsNeedUpdate = true;
      draws++;
    };
    meshes.push(mesh);
    object.add(mesh);
  }
  return {
    object,
    uniforms,
    field,
    sync() {
      if (disposed) return false;
      const revision = field.revision;
      if (revision === lastRevision) return false;
      field.writeAtlas();
      texture.needsUpdate = true;
      lastRevision = revision;
      uploads++;
      return true;
    },
    setDepth(opaqueDepthTexture, transmissionDepthTexture, camera) {
      uniforms.steamOpaqueDepth.value = opaqueDepthTexture;
      uniforms.steamTransmissionDepth.value = transmissionDepthTexture;
      depthCamera = camera;
    },
    setLighting({ ambient, directional, direction, anisotropy: nextAnisotropy } = {}) {
      if (ambient) uniforms.steamAmbient.value.fromArray(ambient);
      if (directional) uniforms.steamDirectional.value.fromArray(directional);
      if (direction) uniforms.steamLightDirection.value.fromArray(direction).normalize();
      if (Number.isFinite(nextAnisotropy)) uniforms.steamAnisotropy.value = THREE.MathUtils.clamp(nextAnisotropy, -0.8, 0.8);
    },
    evidence() {
      return {
        method: "Beer–Lambert emission-free single scattering / nearest transmission-interface split",
        steps,
        densityTapsPerStep: 6,
        texture: { width: atlas.width, height: atlas.height, type: "RGBA8", bytes: atlas.data.length, floatLinearRequired: false },
        extinction: uniforms.steamExtinction.value,
        albedo: uniforms.steamAlbedo.value,
        uploads,
        draws,
        depthBound: Boolean(depthCamera && uniforms.steamOpaqueDepth.value && uniforms.steamTransmissionDepth.value),
        segments: meshes.map((mesh) => ({
          transparent: mesh.material.transparent,
          renderOrder: mesh.renderOrder,
          depthWrite: mesh.material.depthWrite,
        })),
        scalar: field.evidence(),
        disposed,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      object.removeFromParent();
      geometry.dispose();
      for (const mesh of meshes) mesh.material.dispose();
      texture.dispose();
    },
  };
}
