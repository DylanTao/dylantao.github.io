import * as THREE from "../three.module.min.js";
import { FullScreenQuad } from "../vendor/three-r164/postprocessing/Pass.js";

// The structure pass stores the visible face's view normal, distance and object ID.
// These let a pencil stroke stay on a chair as the visitor moves around it.
const vertexShader = /* glsl */ `
  varying vec2 sheet;
  void main() {
    sheet = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
  }
`;
const fragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse, tStructure, tAlbedo;
  uniform vec2 printResolution;
  uniform vec4 printCamera;
  uniform mat4 printWorld;
  uniform vec3 hearthFoot;
  varying vec2 sheet;
  const vec3 luminance = vec3(.23,.65,.12);
  const vec3 cotton = vec3(.975);
  const vec3 graphite = vec3(.128);

  float tooth(vec2 v) {
    vec3 p = fract(vec3(v.xyx) * vec3(.1031,.1030,.0973));
    p += dot(p, p.yzx + 33.33);
    return fract((p.x+p.y)*p.z);
  }
  // Irregular pressure and a second, crossing stroke follow the two axes of the surface.
  // At a distance the eye sees the pencil's average coverage.
  float pencilLine(vec2 p, float tilt, float spacing, float pressure) {
    float along = p.x - tilt*p.y;
    float phase = (p.y + tilt*p.x) / spacing + .21*sin(6.3*along) + .062*sin(23.*along);
    float radius = .037 + .09*pressure + .025*sin(5.2*along + 1.4*sin(2.1*phase));
    float width = max(.015, fwidth(phase));
    float dist = abs(fract(phase+.5)-.5);
    float covered = 1.-smoothstep(radius-.5*width, radius+.5*width, dist);
    float lift=.26+.74*smoothstep(-.8,.6,sin(along*13.4 + 2.9*sin(floor(phase+.5)*2.23))+.36*cos(2.4*along));
    return mix(covered*lift, 1.46*radius, smoothstep(.45,1.35,width));
  }
  vec2 hatching(vec2 p, float pressure) {
    return vec2(pencilLine(p,.63,.013,pressure), pencilLine(p,-.75,.021,pressure));
  }
  void main() {
    vec4 s = texture2D(tStructure,sheet);
    vec4 material = texture2D(tAlbedo,sheet);
    vec3 hdr = max(texture2D(tDiffuse,sheet).rgb,vec3(0));
    float lit = dot(sqrt(hdr/(hdr+vec3(.34))),luminance);
    vec2 stepPx = 1./printResolution;
    vec3 normal = normalize(mat3(printWorld)*vec3(s.xy,sqrt(max(0.,1.-dot(s.xy,s.xy)))));
    vec2 ray = (sheet-.5)*printResolution*printCamera.w;
    vec3 p = (printWorld*vec4(ray*(printCamera.z>.5 ? s.w : 1.),-s.w,1.)).xyz;
    // Grain follows the slope of the plane. A bent surface carries the drawing around its bend.
    float solid = step(.5,s.z);
    float local = mix(lit,dot(material.rgb,luminance),solid);
    float flags=floor(material.a*255.+.5);
    float sun=mod(flags,32.)/31.;
    float value = .53*local + .47*lit + .018 - solid*.038*(1.-sun);
    vec3 atHearth = p-hearthFoot;
    // The measured fireplace is 90 cm across. Its turned steel and the native flue take
    // one curved stroke family; the shade on the side away from the window takes a soft lead.
    float spun = (1.-smoothstep(.445,.48,length(atHearth.xz))) * smoothstep(.68,.75,atHearth.y)
        * (1.-smoothstep(.13,.36,local)) * solid;
    float rake=smoothstep(-.77,.78,dot(normal,normalize(vec3(.92,.15,-.32))));
    // A rubbed 4B core runs into the narrow ribbon facing the glazing.
    value=mix(value,.042+.395*pow(rake,1.65),spun);
    // The billets are mapped timber. Their material tint alone is white; read the lit
    // split face in the measured fuel bed and keep a dark surround for the lifted flame.
    float billet = (1.-smoothstep(.29,.33,length(atHearth.xz))) * smoothstep(.76,.81,atHearth.y)
        * (1.-smoothstep(.94,.97,atHearth.y)) * smoothstep(.57,.83,local) * solid;
    value=mix(value,.095+.19*lit,billet);
    float pressure = 1.-smoothstep(.08,.59,value);
    vec2 plane=vec2(dot(p,vec3(.86,.04,.51)),dot(p,vec3(-.27,.91,.31)));
    plane.y+=.008*sin(plane.x*4.7+plane.y*.8);
    float angle=atan(atHearth.x,-atHearth.z+1.e-6);
    vec2 curved=vec2(angle*.20,atHearth.y+.026*cos(3.7*angle+1.3*atHearth.y));
    // Short oblique sweeps model the hood's volume without tracing turned-metal rings.
    curved=mat2(.96,.28,-.28,.96)*curved;
    vec2 hatch = mix(hatching(plane,pressure),hatching(curved,pressure),spun);
    float broad = 1.-smoothstep(.25,.72,value);
    float cross = 1.-smoothstep(.14,.38,value);
    float deepest = 1.-smoothstep(.10,.29,value);
    float edge = 0.;
    vec2 directions[4] = vec2[4](vec2(1,0),vec2(0,1),vec2(-1,0),vec2(0,-1));
    for (int i=0;i<4;i++) {
      vec4 other = texture2D(tStructure,sheet + directions[i]*stepPx);
      float depthBreak = smoothstep(.018,.085,abs(s.w-other.w)/max(s.w*.25,1.));
      float fold = smoothstep(.19,.65,length(s.xy-other.xy));
      edge = max(edge, max(depthBreak,.52*fold)*max(solid,step(.5,other.z)));
    }
    // Reserved paper is the largest value. Cast shade and the dark mouth of the fire
    // bring the harder pencil and its cross-hatch out, only where each is called for.
    float body=1.-smoothstep(.11,.73,value);
    float grain=tooth(floor(gl_FragCoord.xy));
    float grainBed=.5+.5*sin(plane.y*93.+5.*sin(5.*plane.x))*sin(plane.x*63.+2.*sin(2.*plane.y));
    float ground = (.40*body*body + .27*cross + .30*deepest)*(.87 + .13*grainBed);
    float stroke = broad*hatch.x*.56 + cross*hatch.y*.22;
    float outline = edge*(.18+.55*pressure);
    float deposit = clamp(ground+(1.-ground)*stroke + outline,0.,1.);
    deposit *= .84+.16*grain;
    deposit *= mix(.21,1.,solid);
    vec3 display = mix(cotton*(.992+.008*grain),graphite,deposit);
    vec3 linear = mix(display/12.92,pow((display+.055)/1.055,vec3(2.4)),step(vec3(.04045),display));
    gl_FragColor = vec4(linear,1.);
    #include <colorspace_fragment>
  }
`;

export function createPencilDrawing(uniforms, hearthFoot) {
  const material = new THREE.ShaderMaterial({
    name: "Graphite on rag paper",
    uniforms: { ...uniforms, hearthFoot: { value: new THREE.Vector3(...(hearthFoot ?? [0, 1e5, 0])) } },
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const quad = new FullScreenQuad(material);
  return {
    render: (renderer) => quad.render(renderer),
    setHearth: (position) => material.uniforms.hearthFoot.value.fromArray(position ?? [0, 1e5, 0]),
    dispose() {
      material.dispose();
      quad.dispose();
    },
  };
}
