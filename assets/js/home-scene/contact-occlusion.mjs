// Browser-sized GTAO subset: analytic cosine-weighted horizon arcs, four fixed
// slices, and a geometry-guided reconstruction. See CONTACT-LIGHTING.md.
export const CONTACT_RADIUS = 0.36;
export const CONTACT_SLICES = 4;
export const CONTACT_STEPS = 4;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function horizonIntegral(lower, upper, gamma, projectedLength = 1) {
  const arc = (h) => (Math.cos(gamma) - Math.cos(2 * h - gamma) + 2 * h * Math.sin(gamma)) / 4;
  return Math.max(0, projectedLength * (arc(lower) + arc(upper)));
}

export function bounceVisibility(visibility, albedo) {
  const a = clamp(visibility, 0, 1),
    rho = clamp(albedo, 0, 1),
    x = 2.0404 * rho - 0.3324,
    y = -4.7951 * rho + 0.6417,
    z = 2.7552 * rho + 0.6903;
  return clamp(Math.max(a, ((a * x + y) * a + z) * a), 0, 1);
}

export function bilateralWeight(spatialPixels, planeDistance, normalDot) {
  return Math.exp(-0.5 * (spatialPixels / 1.25) ** 2 - (planeDistance / 0.018) ** 2) * Math.max(0, normalDot) ** 16;
}

export const horizonFragment = `
uniform highp sampler2D tNormal;
uniform highp sampler2D tDepth;
uniform vec2 resolution;
uniform float kernelRadius;
uniform mat4 cameraProjectionMatrix, cameraInverseProjectionMatrix;
varying vec2 vUv;
const float contactPi=3.141592653589793;
vec3 viewPoint(vec2 uv,float depth) {
 vec4 p=cameraInverseProjectionMatrix*vec4(uv*2.-1.,depth*2.-1.,1.);
 return p.xyz/p.w;
}
float arc(float h,float gamma) {
 return .25*(cos(gamma)-cos(2.*h-gamma)+2.*h*sin(gamma));
}
void main() {
 float depth=texture2D(tDepth,vUv).r;
 if(depth>=.999999) {gl_FragColor=vec4(1.);return;}
 vec3 position=viewPoint(vUv,depth);
 vec3 normal=normalize(texture2D(tNormal,vUv).rgb*2.-1.);
 #if PERSPECTIVE_CAMERA == 1
 vec3 viewDirection=normalize(-position);
 #else
 vec3 viewDirection=vec3(0.,0.,1.);
 #endif
 float pixelRadius=kernelRadius*cameraProjectionMatrix[1][1]*resolution.y*.5;
 #if PERSPECTIVE_CAMERA == 1
 pixelRadius/=max(.05,-position.z);
 #endif
 pixelRadius=clamp(pixelRadius,1.5,40.);
 float visible=0.,unoccluded=0.;
 for(int slice=0;slice<${CONTACT_SLICES};slice++) {
   float phi=(float(slice)+.5)*contactPi/${CONTACT_SLICES.toFixed(1)};
   vec2 screenDirection=vec2(cos(phi),sin(phi));
   vec3 planeNormal=normalize(cross(vec3(screenDirection,0.),viewDirection));
   vec3 tangent=normalize(cross(viewDirection,planeNormal));
   vec3 projectedNormal=normal-planeNormal*dot(normal,planeNormal);
   float projectedLength=length(projectedNormal);
   if(projectedLength<.00001) continue;
   float gamma=atan(dot(projectedNormal,tangent),dot(projectedNormal,viewDirection));
   gamma=clamp(gamma,-contactPi*.5,contactPi*.5);
   vec2 horizon=vec2(-sin(gamma),sin(gamma));
   for(int stepIndex=0;stepIndex<${CONTACT_STEPS};stepIndex++) {
     float fraction=(float(stepIndex)+.5)/${CONTACT_STEPS.toFixed(1)};
     float pixels=max(.75,pow(fraction,1.7)*pixelRadius);
     for(int side=0;side<2;side++) {
       float signSide=side==0 ? 1. : -1.;
       vec2 uv=vUv+screenDirection*(signSide*pixels)/resolution;
       if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.)))) continue;
       float sampledDepth=texture2D(tDepth,uv).r;
       if(sampledDepth>=.999999) continue;
       vec3 delta=viewPoint(uv,sampledDepth)-position;
       float distanceToPoint=length(delta);
       if(distanceToPoint<.0015||distanceToPoint>kernelRadius) continue;
       // A metric normal offset rejects self-occlusion without ignoring the
       // centimeter-scale contacts lost by a far-plane-relative depth bias.
       float cosine=dot(viewDirection,normalize(delta-normal*.002));
       float attenuation=1.-smoothstep(kernelRadius*.65,kernelRadius,distanceToPoint);
       float candidate=mix(horizon[side],cosine,attenuation);
       horizon[side]=max(horizon[side],candidate);
     }
   }
   float low=clamp(-acos(clamp(horizon.y,-1.,1.)),gamma-contactPi*.5,gamma);
   float high=clamp(acos(clamp(horizon.x,-1.,1.)),gamma,gamma+contactPi*.5);
   visible+=projectedLength*(arc(low,gamma)+arc(high,gamma));
   unoccluded+=projectedLength*(arc(gamma-contactPi*.5,gamma)+arc(gamma+contactPi*.5,gamma));
 }
 // Finite-slice normalization leaves every unobstructed plane at exactly one,
 // including silhouettes where quadrature would otherwise shade a flat wall.
 float visibility=clamp(visible/max(.00001,unoccluded),0.,1.);
 gl_FragColor=vec4(vec3(visibility),1.);
}`;

export const bilateralFragment = `
uniform highp sampler2D tDepth;
uniform highp sampler2D tNormal;
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform mat4 cameraInverseProjectionMatrix;
varying vec2 vUv;
vec3 positionAt(vec2 uv,float depth) {
 vec4 p=cameraInverseProjectionMatrix*vec4(uv*2.-1.,depth*2.-1.,1.);
 return p.xyz/p.w;
}
void main() {
 float depth=texture2D(tDepth,vUv).r;
 if(depth>=.999999) {gl_FragColor=vec4(1.);return;}
 vec3 p=positionAt(vUv,depth),n=normalize(texture2D(tNormal,vUv).rgb*2.-1.);
 float sum=0.,weightSum=0.;
 for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
   vec2 delta=vec2(float(x),float(y)),uv=vUv+delta/resolution;
   if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.)))) continue;
   float d=texture2D(tDepth,uv).r;
   if(d>=.999999) continue;
   vec3 q=positionAt(uv,d),m=normalize(texture2D(tNormal,uv).rgb*2.-1.);
   float planeDistance=max(abs(dot(q-p,n)),abs(dot(q-p,m)));
   float weight=exp(-.5*dot(delta,delta)/(1.25*1.25)-pow(planeDistance/.018,2.))*pow(max(0.,dot(n,m)),16.);
   sum+=texture2D(tDiffuse,uv).r*weight;weightSum+=weight;
 }
 gl_FragColor=vec4(vec3(sum/max(.00001,weightSum)),1.);
}`;

export const bounceFragment = `
vec3 contactBounce(float visibility,vec3 albedo) {
 vec3 rho=clamp(albedo,vec3(0.),vec3(1.));
 vec3 a=2.0404*rho-.3324,b=-4.7951*rho+.6417,c=2.7552*rho+.6903;
 return clamp(max(vec3(visibility),((visibility*a+b)*visibility+c)*visibility),vec3(0.),vec3(1.));
}
`;

const boundMaterials = new WeakSet();

export function withoutContactLighting(uniforms, render) {
  if (!uniforms) return render();
  const enabled = uniforms.contactEnabled.value;
  uniforms.contactEnabled.value = false;
  try {
    return render();
  } finally {
    uniforms.contactEnabled.value = enabled;
  }
}

// Keep each material's authored shader and cache identity. Uniform objects are
// owned by one finish pipeline, so another canvas never borrows this AO buffer.
export function bindContactLighting(material, uniforms) {
  if (!uniforms || !material.isMeshStandardMaterial || boundMaterials.has(material)) return material;
  const compile = material.onBeforeCompile,
    cacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader =
      `uniform sampler2D contactTexture;
       uniform vec2 contactResolution;
       uniform bool contactEnabled;
       ${bounceFragment}\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <aomap_fragment>",
      `#include <aomap_fragment>
       if(contactEnabled) {
         float contactVisibility=texture2D(contactTexture,gl_FragCoord.xy/contactResolution).r;
         reflectedLight.indirectDiffuse*=contactBounce(contactVisibility,material.diffuseColor);
       }`
    );
  };
  material.customProgramCacheKey = () => `${cacheKey}:coastal-indirect-contact-v1`;
  material.needsUpdate = true;
  boundMaterials.add(material);
  return material;
}
