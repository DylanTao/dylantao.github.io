import * as THREE from "../three.module.min.js";
import { FullScreenQuad } from "../vendor/three-r164/postprocessing/Pass.js";

// This is an apparent surface-temperature model in Celsius, with separate
// baselines and sun response. Polished surfaces reflect the cold sky.
const ambient = [0, 1.2, 0.93];
export function thermalSurface(object, material) {
  const name = `${object.name ?? ""} ${material?.name ?? ""}`.toLowerCase();
  if (/bath_water|onsen_water|onsen water/.test(name)) return { temperature: [19, 0, 0.97], opaque: true };
  if (object.userData?.water || /^(pacific|ocean).*water|pool.water|water.*rill|rill.*water|waterfall/.test(name))
    return { temperature: [-1.5, 0.5, 0.96], opaque: true };
  if (/coastal glazing|glass|mirror/.test(name) && !/washi|eyeglass/.test(name)) return { temperature: [-1, 1, 0.32], opaque: true };
  if (/charred billet|burning wood|ember|fireplace fuel/.test(name)) return { temperature: [53, 0, 0.96] };
  if (/fireplace.*(?:steel|bowl)|soot/.test(name)) return { temperature: [15, 0, 0.81] };
  if (object.isSkinnedMesh && !object.userData?.wildlife) {
    const skin = /skin|face|flesh|hand|scales/.test(name);
    return { temperature: [skin ? 17 : 10, 0, 0.98] };
  }
  if (/flame|bulb|filament|light.*(diode|emitter)|lantern lit/.test(name)) return { temperature: [22, 0, 0.95] };
  if (/washi|lantern|lampshade/.test(name)) return { temperature: [10, 0, 0.96] };
  if (/sandstone|cliff|mainland|boulder|bedrock|travertine|limestone/.test(name)) return { temperature: [1.8, 8, 0.94] };
  if (/greenery|flora|leaf|lavender|agave|grass/.test(name)) return { temperature: [-0.4, 5, 0.97] };
  if (/aluminium|chrome|brass|nickel|polished steel/.test(name)) return { temperature: [0, 2, 0.48] };
  if (/oak|walnut|cedar|leather|fabric|boucle|textile|linen/.test(name)) return { temperature: [0.9, 4.6, 0.96] };
  return { temperature: ambient };
}

export function thermalWeather(minute, day, outdoors) {
  const cycle = Math.cos(((minute - 950) / 1440) * Math.PI * 2);
  const laggedSun = Math.max(0, Math.cos(((minute - 905) / 1440) * Math.PI * 2));
  const air = outdoors ? 18.8 + 3.9 * cycle : 20.2 + 1.4 * cycle;
  return [air, 0.68 * laggedSun + 0.32 * day, outdoors ? 0.47 : 0.13, outdoors ? 11.8 + 1.6 * cycle : 16.4];
}

// The register and dot plates are properties of the viewfinder. They follow
// the measured temperature bands, including at a shadow edge or contact mark.
export function createThermalDrawing(uniforms) {
  const material = new THREE.ShaderMaterial({
    name: "Thermal camera · registered temperature plates",
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 sheet;
      void main() { sheet = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tStructure, tAlbedo;
      uniform vec2 printResolution;
      uniform vec4 printCamera, printSea, thermalSpan;
      uniform mat4 printWorld;
      varying vec2 sheet;

      float seaOrSky(vec2 uv) {
        vec2 onLens = (uv - .5) * printResolution * printCamera.w;
        vec3 ray = normalize(mat3(printWorld) * vec3(onLens, -1.));
        float sea = step(ray.y, -.0004) * printSea.w * step(printSea.x, printWorld[3].y);
        return mix(7. + 4. * exp(-abs(ray.y) * 13.), 17.8 + .32 * sin(ray.x * 19.), sea);
      }
      float temperature(vec2 uv) {
        vec4 s = texture2D(tStructure, uv);
        if (s.z < .5) return seaOrSky(uv);
        // Two channels retain sub-degree differences in the byte target.
        vec2 encoded = texture2D(tAlbedo, uv).rg;
        return 85. * (encoded.x + encoded.y / 255.) - 5.;
      }
      vec3 ink(float heat) {
        vec3 c = mix(vec3(.031,.035,.155), vec3(.145,.087,.420), smoothstep(.00,.22,heat));
        c = mix(c, vec3(.360,.115,.520), smoothstep(.17,.41,heat));
        c = mix(c, vec3(.790,.140,.340), smoothstep(.36,.60,heat));
        c = mix(c, vec3(.987,.345,.140), smoothstep(.52,.75,heat));
        c = mix(c, vec3(1.,.765,.280), smoothstep(.69,.88,heat));
        return mix(c, vec3(1.,.982,.840), smoothstep(.87,1.,heat));
      }
      float dotPlate(vec2 p, float period, float coverage) {
        vec2 cell = fract(p / period) - .5;
        float distance = length(cell);
        float r = mix(.08,.36,coverage);
        return 1.-smoothstep(r-.04,r+.04,distance);
      }
      void main() {
        vec2 px = 1. / printResolution;
        float c = temperature(sheet), left = temperature(sheet - vec2(px.x, 0.)), right = temperature(sheet + vec2(px.x, 0.));
        float above = temperature(sheet + vec2(0., px.y)), under = temperature(sheet - vec2(0., px.y));
        float filtered = (c * .56 + .11 * (left + right + above + under) - thermalSpan.x) * thermalSpan.y;
        vec3 colour = ink(filtered);
        float mid = smoothstep(.09,.36,filtered)*(1.-smoothstep(.72,.99,filtered));
        vec2 paper = mat2(.866,.5,-.5,.866) * gl_FragCoord.xy;
        float period = clamp(printResolution.y / 145., 3.4, 8.);
        float dots = dotPlate(paper, period, mid);
        float edge = smoothstep(.45,4.,max(abs(left-right),abs(above-under)));
        colour = mix(colour, ink(filtered - .19), .48 * dots * mid);
        float shifted = (temperature(sheet + px * vec2(1.35, -.65)) - c) * thermalSpan.y;
        colour += edge * vec3(.34*max(shifted,0.), .09*abs(shifted), .48*max(-shifted,0.));
        float scan = .014 * cos(gl_FragCoord.y * 3.14159);
        float vignette = 1. - .27 * pow(min(length((sheet - .5) * vec2(1.25,1.4)), 1.), 2.);
        gl_FragColor = vec4(max(colour * (vignette + scan), 0.), 1.);
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
