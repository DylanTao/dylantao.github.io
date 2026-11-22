import * as THREE from "../three.module.min.js";
import { FullScreenQuad } from "../vendor/three-r164/postprocessing/Pass.js";

export function createFieldGuideDrawing(uniforms) {
  const material = new THREE.ShaderMaterial({
    name: "Field guide · ink and opaque colour",
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 sheet;
      void main() { sheet = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tStructure, tAlbedo, tDiffuse;
      uniform vec2 printResolution;
      uniform vec4 printCamera, printSea, printDay;
      uniform float printNight;
      uniform mat4 printWorld;
      varying vec2 sheet;

      float hash(vec2 p) { return fract(sin(dot(p,vec2(19.12,47.4)))*17325.42); }
      vec3 face(vec4 s) { return normalize(vec3(s.xy, sqrt(max(0., 1.-dot(s.xy,s.xy))))); }
      vec3 placed(vec2 uv, float z) {
        vec2 onLens = (uv - .5) * printResolution * printCamera.w;
        return vec3(onLens * mix(1.,z,printCamera.z),-z);
      }
      void main() {
        vec4 shape = texture2D(tStructure,sheet);
        vec4 coat = texture2D(tAlbedo,sheet);
        vec2 px = 1. / printResolution;
        vec3 here = (printWorld * vec4(placed(sheet,shape.w),1.)).xyz;
        vec3 ray = normalize(mat3(printWorld)*placed(sheet,1.));
        vec3 eye = printWorld[3].xyz;
        float sun = clamp(printDay.x,0.,1.);
        vec3 ground = mix(vec3(.69,.715,.71), vec3(.964,.938,.843),sun);
        bool sky = shape.z < .5;
        float line = 0.;
        vec3 colour = ground;
        if (!sky) {
          float bits = floor(coat.a * 255. + .5);
          float kind = floor(bits / 64.);
          float exposed = mod(floor(bits / 32.),2.);
          float key = mod(bits,32.) / 31.;
          vec3 hdr = max(texture2D(tDiffuse,sheet).rgb,0.);
          vec3 localColour = kind > 2.5 ? pow(hdr/(hdr+.23),vec3(.46)) : coat.rgb;
          float grey = dot(localColour,vec3(.26,.61,.13));
          float green = smoothstep(.045,.19,localColour.g - .5*(localColour.r+localColour.b));
          vec3 localDust = mix(vec3(grey),localColour,.86);
          vec3 pigment = mix(ground,localDust,.76);
          pigment = mix(pigment,mix(vec3(.27,.335,.19),vec3(.55,.61,.31),grey),green*.70);
          // A single wash follows the cast shadow; lamps keep their coloured core.
          float cut = smoothstep(.38,.56,key);
          float room = exposed > .5 ? cut : smoothstep(.065,.17,dot(hdr,vec3(.26,.61,.13)));
          float shade = .24 + mix(.15,.30,sun) * (1.-room);
          colour = mix(pigment, pigment*vec3(.64,.72,.72),shade);
          if (kind > .5 && kind < 1.5) colour = mix(colour,vec3(1.,.78,.37),.80);

          vec3 n = face(shape);
          vec2 wobble = vec2(sin(here.x*6. + here.y*3.),sin(here.z*7. - here.y*4.));
          vec2 taps[4] = vec2[4](vec2(1,0),vec2(0,1),vec2(-1,0),vec2(0,-1));
          for (int i=0;i<4;i++) {
            vec2 offset = taps[i] * clamp(printResolution.y/800.,.79,1.36) + .10 * wobble;
            vec4 other = texture2D(tStructure,sheet+offset*px);
            float depth = smoothstep(.022,.085,abs(shape.w-other.w) / max(1.,shape.w*.19));
            float fold = smoothstep(.43,.76,length(n-face(other)));
            float seam = step(.5,abs(other.z-shape.z))*.42;
            line = max(line,max(depth,max(.32*fold,seam)));
          }
          float weight = mix(.66,.35,smoothstep(7.,42.,shape.w));
          colour = mix(colour,vec3(.105,.12,.095),line * weight);
          // Isolated ruled stems and stipple describe plant form in close views.
          vec2 p = vec2(here.x+here.z*.71,here.y-here.z*.21);
          float span = .054;
          vec2 cell = floor(p/span);
          vec2 mark = fract(p/span)-vec2(.3+.34*hash(cell),.44+.13*hash(cell+4.));
          float grain = 1.-smoothstep(.045,.168,length(mark * vec2(1.,.53)));
          float clear = 1.-smoothstep(.2,.74,max(fwidth(p.x),fwidth(p.y))/span);
          colour = mix(colour,vec3(.16,.22,.105),.48*green*grain*clear);
          colour = mix(colour,ground,.87*smoothstep(35.,190.,shape.w));
        }
        // An opaque wash of sea sits on its true plane with sparse, tapered tide lines.
        if (printSea.w > .5 && eye.y > printSea.x && ray.y < -.0002) {
          float t = (printSea.x-eye.y)/ray.y;
          if (t*dot(ray,-printWorld[2].xyz) < shape.w-.02) {
            vec3 p = eye + t*ray;
            vec3 pacific = mix(vec3(.34,.49,.52),vec3(.51,.67,.645),sun);
            float stroke = p.z * .76 + sin(.79*p.x)*.29;
            float tip = smoothstep(.16,.49,fract(p.x*.154+.36*floor(stroke)));
            float wetInk = smoothstep(.91,.99,fract(stroke))*(1.-tip)*exp(-t*.018);
            colour = mix(pacific,vec3(.22,.37,.37),wetInk * .40);
            colour = mix(colour,ground,smoothstep(27.,280.,t)*.76);
          }
        }
        float tooth = hash(floor(gl_FragCoord.xy));
        colour *= .986 + .021 * tooth;
        gl_FragColor = vec4(colour,1.);
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const quad = new FullScreenQuad(material);
  return {
    render: (renderer) => quad.render(renderer),
    dispose() {
      material.dispose();
      quad.dispose();
    },
  };
}
