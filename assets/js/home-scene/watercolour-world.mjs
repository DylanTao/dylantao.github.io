import * as THREE from "../three.module.min.js";
import { FullScreenQuad } from "../vendor/three-r164/postprocessing/Pass.js";

// A small repeatable piece of cotton paper. Water carries two pigments from a
// wet patch to its drying edge. The coarse pigment catches sooner in the tooth.
export function dryPigmentSheet(size = 96) {
  const count = size * size;
  const tooth = new Float32Array(count);
  const water = new Float32Array(count);
  const fine = new Float32Array(count);
  const coarse = new Float32Array(count);
  const stain = new Float32Array(count);
  const grains = new Float32Array(count);
  const tide = new Float32Array(count);
  const flux = [water, fine, coarse].map(() => new Float32Array(count));
  const neighbours = new Uint32Array(count * 4);
  let seed = 1192026;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const u = (2 * Math.PI * x) / size;
      const v = (2 * Math.PI * y) / size;
      tooth[i] = 0.16 + 0.52 * random() + 0.15 * Math.cos(6 * u + 2 * Math.sin(3 * v)) + 0.13 * Math.sin(9 * v - Math.sin(2 * u));
      const brush = Math.sin(u + 0.53 * Math.sin(3 * v)) + 0.7 * Math.cos(2 * v - 0.65 * Math.cos(2 * u));
      water[i] = THREE.MathUtils.clamp(0.68 + brush * 0.58, 0, 1);
      fine[i] = water[i] * 0.71;
      coarse[i] = water[i] * 0.62;
      neighbours.set(
        [y * size + ((x + 1) % size), y * size + ((x + size - 1) % size), ((y + 1) % size) * size + x, ((y + size - 1) % size) * size + x],
        4 * i
      );
    }
  }
  for (let step = 0; step < 54; step++) {
    for (const delta of flux) delta.fill(0);
    for (let i = 0; i < count; i++) {
      if (water[i] < 0.0001) continue;
      for (let d = 0; d < 4; d++) {
        const j = neighbours[4 * i + d];
        const head = water[i] - water[j] + 0.044 * (tooth[i] - tooth[j]);
        const flow = Math.min(water[i] * 0.12, Math.max(head * 0.14, 0));
        const fraction = flow / water[i];
        const dye = fine[i] * fraction;
        const grain = coarse[i] * fraction * 0.75;
        flux[0][i] -= flow;
        flux[0][j] += flow;
        flux[1][i] -= dye;
        flux[1][j] += dye;
        flux[2][i] -= grain;
        flux[2][j] += grain;
      }
    }
    for (let i = 0; i < count; i++) {
      const wet = Math.max(water[i] + flux[0][i], 0);
      const edge = Math.exp(-((wet - 0.16) ** 2) / 0.02);
      water[i] = Math.max(0, wet - 0.016 - 0.011 * edge);
      const settle = water[i] > 0 ? 0.012 + edge * 0.095 : 1;
      fine[i] += flux[1][i];
      coarse[i] += flux[2][i];
      const deposited = fine[i] * settle;
      const granular = coarse[i] * Math.min(1, settle + (1 - tooth[i]) * 0.065);
      stain[i] += deposited;
      grains[i] += granular;
      tide[i] += edge * deposited;
      fine[i] -= deposited;
      coarse[i] -= granular;
    }
  }
  const bytes = new Uint8Array(4 * count);
  for (let i = 0; i < count; i++) {
    for (const [c, value] of [tooth[i], stain[i], grains[i], tide[i] * 3.4].entries()) {
      bytes[4 * i + c] = Math.round(255 * THREE.MathUtils.clamp(value, 0, 1));
    }
  }
  return bytes;
}

const vertexShader = /* glsl */ `
  varying vec2 sheetUV;
  void main() {
    sheetUV = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse, tStructure, tAlbedo, driedPaper;
  uniform vec2 printResolution;
  uniform vec4 printCamera;
  uniform mat4 printWorld;
  varying vec2 sheetUV;
  const vec3 weights = vec3(0.235, 0.66, 0.105);
  const vec2 neighbours[8] = vec2[8](vec2(1,0),vec2(-1,0),vec2(0,1),vec2(0,-1),
    vec2(.71,.71),vec2(-.71,.71),vec2(.71,-.71),vec2(-.71,-.71));

  vec3 viewPoint(vec2 uv, float depth) {
    vec2 v = (uv - 0.5) * vec2(printResolution.x, printResolution.y) * printCamera.w;
    return vec3(v * (printCamera.z > 0.5 ? depth : 1.0), -depth);
  }
  vec4 pigmentOn(vec3 p, vec3 n) {
    vec3 w = pow(abs(n), vec3(4.0));
    w /= max(dot(w, vec3(1)), .001);
    return w.x * texture2D(driedPaper, p.zy * .86) + w.y * texture2D(driedPaper, p.xz * .86)
      + w.z * texture2D(driedPaper, p.xy * .86);
  }
  vec3 reflected(vec3 hdr) { return sqrt(max(hdr, vec3(0)) / (max(hdr, vec3(0)) + vec3(.41))); }
  void main() {
    vec2 px = 1.0 / printResolution;
    vec4 s = texture2D(tStructure, sheetUV);
    vec3 hdr = max(texture2D(tDiffuse, sheetUV).rgb,vec3(0));
    vec3 light = reflected(hdr);
    vec3 face = vec3(s.xy, sqrt(max(0.0, 1.0-dot(s.xy,s.xy))));
    vec3 n = normalize(mat3(printWorld) * face);
    vec3 position = (printWorld * vec4(viewPoint(sheetUV, s.w),1)).xyz;
    vec4 wash = s.z > 0.5 ? pigmentOn(position + 0.067 * sin(position.yzx * 2.35), n)
                           : texture2D(driedPaper, sheetUV * vec2(1.31,.83));
    vec4 own = texture2D(tAlbedo,sheetUV);
    float kind = floor(floor(own.a*255.+.5)/64.);
    vec3 here = s.z > .5 ? own.rgb : light;
    float bright = dot(light, weights);
    float rim = 0.0, total = 1.0;
    vec3 body = here, illumination = light;
    float scale = clamp(printResolution.y/850.0,.70,1.85);
    for (int i=0; i<8; i++) {
      vec2 direction = neighbours[i];
      vec2 nearUV = sheetUV + direction * px * scale * (1.55 + 1.2 * wash.a);
      vec4 nearS = texture2D(tStructure, nearUV);
      vec3 neighbourLight = reflected(texture2D(tDiffuse, nearUV).rgb);
      float crossing = step(.5, abs(s.z - nearS.z));
      float fold = smoothstep(.13,.48,length(s.xy-nearS.xy));
      rim += max(crossing, .33*fold) * (.2 + .8*smoothstep(-.04,.20,dot(neighbourLight,weights)-bright));
      vec2 spreadUV = sheetUV + direction * px * scale * (3.3 + 3.8 * wash.g);
      vec4 farS = texture2D(tStructure, spreadUV);
      float sameSurface = (1.0-step(.5,abs(s.z-farS.z))) * exp(-3.0*abs(s.w-farS.w)) * step(.5,s.z);
      body += texture2D(tAlbedo, spreadUV).rgb * sameSurface;
      illumination += reflected(texture2D(tDiffuse, spreadUV).rgb) * sameSurface;
      total += sameSurface;
    }
    here = mix(here,body / total,.65);
    light = mix(light,illumination / total,.75);
    // Patterned surfaces encode their finish in a texture. Its lit colour
    // carries the charcoal in a log and the veins in a stone counter.
    if(kind>2.5 && s.z>.5) here=light;
    float local = dot(here,weights), lit = dot(light,weights);
    float warm = smoothstep(-.025,.24,here.r - here.b + .38*(light.r-light.b));
    float blue = smoothstep(.018,.21,max(here.b-here.r,.80*(light.b-light.r)));
    float green = smoothstep(.024,.16, max(here.g-here.r+.13*blue,light.g-light.r));
    float raw = clamp(.44*local+.56*lit,0.0,1.0);
    float value = smoothstep(.02,.79,raw);
    float tooth = texture2D(driedPaper, (sheetUV*printResolution)/143.0).r;
    float reserve = smoothstep(.59,.90,value+.09*(tooth-.5));
    float shade = 1.0-smoothstep(.10,.53,lit);
    float dark = 1.0-smoothstep(.075,.32,raw);
    vec4 dry = pigmentOn(position*vec3(1.4,5.3,1.7)+vec3(.21,.43,.79),n);
    float load = pow(1.-value,1.16);
    // The first wash can cross an entire lit wall. The darker second glaze
    // gathers in a few shapes, under the chairs and around the hood.
    float earth = load*(.18+.83*warm)*(.90+.20*wash.g);
    float umber = load*warm*(.14+.68*shade+.37*smoothstep(.11,.39,here.r-here.g));
    float indigo = load*(.11+.47*(1.-warm)+.53*shade+.43*blue)*(.89+.26*wash.b);
    float mineral = dark*(1.35+.65*dry.b+.54*wash.b);
    float coolGlass = blue*(.52+.83*green)*smoothstep(.12,.54,lit);
    // The living room borrows its cool from blue slate and the violet hood.
    // Keep the coastal greens outdoors, where the foliage supplies them.
    vec3 roomEdge = min(position-vec3(-5.8,-.8,3.0),vec3(5.4,4.1,16.2)-position);
    float inLiving = smoothstep(-.35,.15,min(roomEdge.x,min(roomEdge.y,roomEdge.z)));
    vec3 reflectedPigment = mix(vec3(1.52,.12,.16),vec3(.99,1.04,.53),inLiving);
    vec3 absorption = earth*vec3(.12,.42,.76) + umber*vec3(.49,.87,.99)
                  + indigo*vec3(.98,1.05,.62) + mineral*vec3(1.02,.85,.73)
                  + coolGlass*reflectedPigment;
    float edge=min(rim*.23,1.)*smoothstep(.10,.60,load)*(.19+.68*wash.a+.17*dry.b);
    absorption+=edge*mix(vec3(.80,.74,.53),vec3(.32,.58,.71),warm);
    // A dry brush skips across the little high points in a deep wash. At
    // grazing angles the marks follow the surface instead of the display.
    absorption*=1.-.15*dark*smoothstep(.56,.78,dry.r+.07*tooth);
    vec3 paper=vec3(.997,.979,.946)*(.984+.030*tooth);
    vec3 display=paper*exp(-absorption*(1.-.75*reserve));
    // A real lamp has no pigment in its centre. A transparent flame crosses
    // the colour of the opaque log behind it; read its emitted light too.
    float lamp=(kind>.5 && kind<1.5) ? smoothstep(.24,.69,lit) : 0.;
    float fire=smoothstep(.36,2.4,hdr.r)*smoothstep(.20,.72,hdr.r-hdr.b);
    vec3 vermilion=mix(vec3(.83,.22,.065),vec3(1.,.70,.18),smoothstep(.40,2.6,hdr.g));
    vec3 firePaper=mix(vermilion,paper,smoothstep(.82,3.2,hdr.g));
    display=mix(display,mix(vec3(.99,.85,.56),paper,.68),lamp*.83);
    display=mix(display,firePaper,fire);
    vec3 linear = mix(display/12.92,pow((display+.055)/1.055,vec3(2.4)),step(vec3(.04045),display));
    gl_FragColor = vec4(linear,1.0);
    #include <colorspace_fragment>
  }
`;

export function createWatercolourWash(shared) {
  const size = 96;
  const paper = new THREE.DataTexture(dryPigmentSheet(size), size, size);
  paper.wrapS = paper.wrapT = THREE.RepeatWrapping;
  paper.minFilter = THREE.LinearMipmapLinearFilter;
  paper.magFilter = THREE.LinearFilter;
  paper.generateMipmaps = true;
  paper.needsUpdate = true;
  const material = new THREE.ShaderMaterial({
    name: "Watercolour on cotton paper",
    vertexShader,
    fragmentShader,
    uniforms: { ...shared, driedPaper: { value: paper } },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const quad = new FullScreenQuad(material);
  return {
    render: (renderer) => quad.render(renderer),
    dispose() {
      quad.dispose();
      material.dispose();
      paper.dispose();
    },
  };
}
