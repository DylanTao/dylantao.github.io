// The footer's sea: one water plane whose shader looks through clear shallows to a sandy, rocky
// seabed with caustics, breaks surf over the shelf, trails wakes behind the boards and the swimmer,
// and mirrors the coast. The mirror is a small render of the scene from below the water, redrawn on
// demand like the coast's shadow map, so a steady frame costs no extra draws. The Connect page's
// miniature keeps its own earlier water. Numbers shared with node tests live in water-optics.mjs.
import * as THREE from "../three.module.min.js";
import {
  ABSORB,
  CANYON,
  KELVIN_HALF_ANGLE,
  REEFS,
  SHELF,
  SUN_PATH,
  SURF,
  WATER_IOR,
  WATER_LEVEL,
  createReflectionSchedule,
  mirrorPoint,
  shoreline,
  shorelineStrip,
} from "./water-optics.mjs?v=coast-water-20261018";

const f = (value) => {
  const text = Number(value).toFixed(9);
  return text.includes(".") ? text : `${text}.`;
};
const vec3 = (values) => `vec3(${values.map(f).join(",")})`;
// The water plane spans x = -95 to 95; its waterline is stored in a strip texture of this many texels.
const SHORE_SPAN = 95,
  SHORE_TEXELS = 1024;

function shorelineTexture(profile) {
  const data = Uint16Array.from(shorelineStrip(profile, SHORE_TEXELS, SHORE_SPAN), (z) => THREE.DataUtils.toHalfFloat(z));
  const texture = new THREE.DataTexture(data, SHORE_TEXELS, 1, THREE.RedFormat, THREE.HalfFloatType);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// The Connect miniature's water, unchanged: a tinted plane with surf bands along its curved beach.
function miniatureWater(material, clock) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.coastTime = clock;
    shader.vertexShader = `uniform float coastTime; varying vec3 coastPosition;
      float wave(vec2 p) { return sin(p.y*3.8-p.x*.28-coastTime*.8)*.023 + sin(p.x*2.7+p.y*1.2-coastTime*.6)*.013; }
      ${shader.vertexShader}`
      .replace(
        "#include <beginnormal_vertex>",
        `float a=position.z*3.8-position.x*.28-coastTime*.8;
         float b=position.x*2.7+position.z*1.2-coastTime*.6;
         vec3 objectNormal=normalize(vec3(.00644*cos(a)-.0351*cos(b),1.,-.0874*cos(a)-.0156*cos(b)));`
      )
      .replace("#include <begin_vertex>", `vec3 transformed=position; transformed.y+=wave(position.xz); coastPosition=transformed;`);
    shader.fragmentShader = `uniform float coastTime; varying vec3 coastPosition;\n${shader.fragmentShader}`.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
        float shore = 3.5-.017*coastPosition.x*coastPosition.x-.42*sin(coastPosition.x*.58);
        float depth = coastPosition.z-shore;
        float swell = sin(depth*5.5-coastTime*.62+sin(coastPosition.x*.6)*.45);
        float breakup = smoothstep(-.45,.7,sin(coastPosition.x*1.9+coastTime*.08)+sin(coastPosition.x*5.2+depth));
        float foam = smoothstep(.83,1.,swell)*breakup*(1.-smoothstep(.2,2.5,depth))*.66;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.66,.80,.75), (1.-smoothstep(0.,2.3,depth))*.38);
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.88,.93,.85),foam);
        if(diffuseColor.a<.008) discard;`
    );
  };
  material.customProgramCacheKey = () => "coast-water-miniature";
}

// The footer's sea. All positions are world space: the plane has no transform.
function footerWater(material, uniforms) {
  const reefs = REEFS.map(([x, width]) => `t = (x - ${f(x)}) * ${f(1 / width)}; r = max(r, exp(-t * t));`).join("\n    ");
  const declarations = `
    uniform float coastTime;
    uniform vec3 coastDeep;
    uniform vec3 coastShallow;
    uniform vec3 coastBed;
    uniform vec3 coastRock;
    uniform float coastCaustic;
    uniform float coastReflect;
    uniform float coastFoam;
    uniform float coastHot;
    uniform float coastGlow;
    uniform vec3 coastView;
    uniform vec4 coastMovers[4];
    uniform float coastMoverPower[4];
    uniform int coastMoverCount;
    uniform vec4 coastGlints[4];
    uniform int coastGlintCount;
    uniform vec3 coastGlintColor;
    uniform int coastHotTaps;
    uniform int coastOne;
    uniform sampler2D coastReflection;
    uniform mat4 coastReflectMatrix;
    uniform vec4 coastReflectAxes;
    uniform sampler2D coastShoreline;
    varying vec3 coastPosition;
    vec3 coastNormal;
    vec2 coastSlope;
    float coastFoamAmount;
    float coastDepth;
    // The waterline (water-optics.mjs shoreline), sampled from a strip texture: one fetch instead of
    // a long chain of profile segments, which kept the shader slow to compile.
    float coastShore(float x) {
      return textureLod(coastShoreline, vec2((x + ${f(SHORE_SPAN)}) * ${f((SHORE_TEXELS - 1) / (2 * SHORE_SPAN * SHORE_TEXELS))} + ${f(0.5 / SHORE_TEXELS)}, .5), 0.).r;
    }
    float coastReef(float x) {
      float r = 0., t;
      ${reefs}
      return r;
    }
    // Integer lattice hash: Teschner and colleagues' spatial-hash primes, mixed by the lowbias32
    // finalizer (Chris Wellons, public domain). Stable on every GPU, unlike sine hashes, and short,
    // which keeps the shader quick to compile.
    uint coastMix(uint h) {
      h ^= h >> 16u; h *= 0x7feb352du; h ^= h >> 15u; h *= 0x846ca68bu; h ^= h >> 16u;
      return h;
    }
    uint coastCell(vec2 cell) {
      uvec2 q = uvec2(ivec2(cell) + 8192);
      return coastMix(q.x * 73856093u ^ q.y * 19349663u);
    }
    float coastNoise(vec2 p) {
      vec2 i = floor(p), u = fract(p);
      u = u * u * (3. - 2. * u);
      vec4 h = vec4(coastCell(i), coastCell(i + vec2(1., 0.)), coastCell(i + vec2(0., 1.)), coastCell(i + vec2(1., 1.))) * (1. / 4294967296.);
      return mix(mix(h.x, h.y, u.x), mix(h.z, h.w, u.x), u.y);
    }
    // Distance to the nearest border of an animated Worley lattice (F2 - F1): light focuses there.
    // The loop bounds are uniforms so the compiler keeps a loop instead of unrolling nine cells.
    float coastCells(vec2 p, float t) {
      vec2 i = floor(p), u = fract(p);
      float d1 = 8., d2 = 8.;
      for (int y = -coastOne; y <= coastOne; y++)
        for (int x = -coastOne; x <= coastOne; x++) {
          vec2 g = vec2(float(x), float(y));
          uint h = coastCell(i + g);
          vec2 o = .5 + .38 * sin(t + 6.2831853 * vec2(float(h), float(h * 2654435769u)) * (1. / 4294967296.));
          vec2 r = g + o - u;
          float d = dot(r, r);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
      return sqrt(d2) - sqrt(d1);
    }
    // Seabed below the surface (water-optics.mjs seabedDepth): a sandy shelf, and the canyon's head off the pier.
    float coastBedDepth(float d, float x) {
      float t = max(d, 0.), c = (x - ${f(CANYON.x)}) * ${f(1 / CANYON.width)};
      return ${f(SHELF.start)} + ${f(SHELF.depth)} * (1. - exp(-t * ${f(1 / SHELF.reach)})) + ${f(SHELF.slope)} * t
        + ${f(CANYON.depth)} * exp(-c * c) * (1. - exp(-t * ${f(1 / CANYON.reach)}));
    }
    // Short wind ripples that bend light without moving the surface: their slope (dh/dx, dh/dz).
    vec2 coastRipples(vec2 p, float t) {
      vec2 k1 = vec2(1.9, 10.6), k2 = vec2(-4.6, 8.3), k3 = vec2(7.4, 5.1);
      return k1 * cos(dot(p, k1) - t * 1.7) * .0041 + k2 * cos(dot(p, k2) - t * 1.45 + 1.3) * .0038 + k3 * cos(dot(p, k3) - t * 1.2 + 2.1) * .0027;
    }
    float coastSurfBend(float x, float reef) {
      return ${SURF.bends.map(([k, phase, amplitude]) => `sin(x * ${f(k)} + ${f(phase)}) * ${f(amplitude)}`).join(" + ")} - reef * ${f(SURF.reefBend)};
    }
    // Kelvin wakes: two arms inside ${((KELVIN_HALF_ANGLE * 180) / Math.PI).toFixed(2)} degrees of the track, and the churned line behind a board.
    float coastWakes(vec2 p) {
      float foam = 0.;
      for (int i = 0; i < coastMoverCount; i++) {
        float power = coastMoverPower[i];
        if (power < .01) continue;
        vec2 heading = coastMovers[i].zw, r = p - coastMovers[i].xy;
        float along = -dot(r, heading), across = abs(r.x * heading.y - r.y * heading.x);
        if (along < -.3 || along > 2.8 || across > 1.3) continue;
        float behind = max(along, 0.);
        float arm = across - behind * ${f(Math.tan(KELVIN_HALF_ANGLE))};
        float width = .03 + behind * .045;
        float v = exp(-arm * arm / (width * width)) * .75 * exp(-behind / 1.2);
        v += exp(-across * across / (.0018 + behind * .006)) * .7 * exp(-behind / .55);
        v += exp(-(along * along + across * across) / .006) * .5;
        foam = max(foam, v * smoothstep(-.25, .02, along) * power);
      }
      return foam;
    }
  `;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `uniform float coastTime; varying vec3 coastPosition;
      float wave(vec2 p) { return sin(p.y*3.8-p.x*.28-coastTime*.8)*.023 + sin(p.x*2.7+p.y*1.2-coastTime*.6)*.013; }
      ${shader.vertexShader}`
      .replace(
        "#include <beginnormal_vertex>",
        `float a=position.z*3.8-position.x*.28-coastTime*.8;
         float b=position.x*2.7+position.z*1.2-coastTime*.6;
         vec3 objectNormal=normalize(vec3(.00644*cos(a)-.0351*cos(b),1.,-.0874*cos(a)-.0156*cos(b)));`
      )
      .replace("#include <begin_vertex>", `vec3 transformed=position; transformed.y+=wave(position.xz); coastPosition=transformed;`);
    shader.fragmentShader = `${declarations}\n${shader.fragmentShader}`
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec2 p = coastPosition.xz;
          float d = p.y - coastShore(p.x);
          coastDepth = d;
          // Surface slope: the vertex waves (wave-motion.mjs) and the wind ripples.
          float wa = p.y * 3.8 - p.x * .28 - coastTime * .8, wb = p.x * 2.7 + p.y * 1.2 - coastTime * .6;
          coastSlope = vec2(-.00644 * cos(wa) + .0351 * cos(wb), .0874 * cos(wa) + .0156 * cos(wb)) * .6 + coastRipples(p, coastTime);
          coastNormal = normalize(vec3(-coastSlope.x, 1., -coastSlope.y));
          // Clear shallows: follow the refracted view ray down to the seabed it meets.
          vec3 ray = refract(-coastView, coastNormal, ${f(1 / WATER_IOR)});
          float run = coastBedDepth(d, p.x) / max(-ray.y, .25);
          vec2 bedP = p + ray.xz * run;
          float bedD = d + bedP.y - p.y;
          float bedDepth = coastBedDepth(bedD, bedP.x);
          // Wet sand with ripple marks; dark reef rock off the coves; caustics where the sun focuses.
          vec3 seabed = coastBed * (.93 + .07 * sin(bedD * 19. + sin(bedP.x * 1.1) * 2. + sin(bedP.x * 2.9 + bedD * 3.) * 1.2));
          float reefX = coastReef(p.x);
          float reef = reefX * (1. - smoothstep(2.2, 3.4, bedD));
          if (reef > .01) {
            float blob = coastNoise(bedP * vec2(1.6, 2.4) + 3.1) * .74 + (.5 + .5 * sin(bedP.x * 7.1 + bedP.y * 5.3)) * .26;
            float rock = smoothstep(.66 - .3 * reef, .76 - .3 * reef, blob) * smoothstep(.08, .3, reef);
            seabed = mix(seabed, coastRock * (.55 + .9 * fract(blob * 7.3)), rock);
          }
          if (coastCaustic > .001 && bedDepth < 1.4) {
            // Cells stretched along z, so the view's foreshortening leaves them readable at footer scale.
            float ca = coastCells(bedP * vec2(1.7, 1.05) + vec2(0., coastTime * .06), coastTime * .7);
            float cb = coastCells(bedP * vec2(2.6, 1.6) + vec2(4.7, -coastTime * .045), coastTime * .85 + 1.9);
            float caustic = (1. - smoothstep(.02, .2, ca)) * .75 + (1. - smoothstep(.02, .16, cb)) * .55;
            seabed *= 1. + caustic * coastCaustic * exp(-bedDepth * 1.5) * smoothstep(.02, .2, bedD);
          }
          // Beer-Lambert absorption: red fades first, so sand turns aqua, turquoise, then open sea.
          vec3 transmit = exp(-${vec3(ABSORB)} * (run + bedDepth * ${f(SUN_PATH)}));
          vec3 water = seabed * transmit + mix(coastDeep, coastShallow, exp(-bedDepth * 1.9)) * (1. - transmit);
          // Surf: crests run shoreward, spacing shrinking as they shoal, and break into lacy whitewater.
          float bend = coastSurfBend(p.x, reefX);
          float w = d + bend;
          float phase = (w - ${f(SURF.shoal)} * w * w) * ${f(1 / SURF.spacing)} + coastTime * ${f(1 / SURF.period)};
          float u = fract(phase);
          float crest = smoothstep(0., .04, u) * exp(-u * 5.);
          float start = ${f(SURF.start)} + reefX * ${f(SURF.reefStart)};
          float breaking = smoothstep(start, start - ${f(SURF.reach)}, d) * smoothstep(${f(SURF.edge - 0.08)}, ${f(SURF.edge + 0.12)}, d);
          float lace = coastNoise(vec2(p.x * 2.2, (phase - u) * 3.7 + u * 1.3)) * .7 + (.5 + .5 * sin(p.x * 5.1 + p.y * 9. + phase * 6.2831853)) * .3;
          float foam = crest * breaking * smoothstep(.38, .66, lace + .2 * breaking);
          // The shore break: a foam line at the water's edge that brightens as each wave arrives.
          float arrival = fract((.3 + bend) * ${f(1 / SURF.spacing)} + coastTime * ${f(1 / SURF.period)});
          float shoreFoam = (1. - smoothstep(.22, .5 + .25 * exp(-arrival * 4.), d)) * (.45 + .55 * exp(-arrival * 3.));
          foam = max(foam, shoreFoam * smoothstep(.25, .55, (.5 + .5 * sin(p.x * 3.1 + sin(p.x * .9) * 2. + coastTime * .3)) * .7 + .3));
          foam = max(foam, coastWakes(p));
          coastFoamAmount = clamp(foam * coastFoam, 0., 1.);
          diffuseColor.rgb = mix(water, vec3(.86, .93, .9), coastFoamAmount);
          diffuseColor.a *= smoothstep(0., .12, d);
          if (diffuseColor.a < .008) discard;
        }`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, .85, coastFoamAmount);`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = normalize((viewMatrix * vec4(coastNormal, 0.)).xyz);`
      )
      .replace(
        "#include <opaque_fragment>",
        `{
          // The mirrored coast. A slope across the view sways it; a slope along the view draws lights into
          // the long streaks rippled water makes, and a few taps along the view soften the rest.
          vec4 rc = coastReflectMatrix * vec4(coastPosition.x, ${f(WATER_LEVEL)}, coastPosition.z, 1.);
          vec2 ruv = rc.xy / rc.w + coastReflectAxes.xy * coastSlope.x * 1.8 + coastReflectAxes.zw * coastSlope.y * 6.;
          vec2 along = coastReflectAxes.zw;
          vec3 mirrored = textureLod(coastReflection, ruv, 0.).rgb * .5
            + (textureLod(coastReflection, ruv + along * .4, 0.).rgb + textureLod(coastReflection, ruv - along * .4, 0.).rgb) * .25;
          // Only bright lights streak far on rippled water: the long taps keep what exceeds the theme's threshold.
          // Loop bounds are uniforms, so the compiler keeps loops (quick to compile) instead of unrolling them.
          vec3 hot = vec3(0.);
          for (int i = 1; i <= coastHotTaps; i++) {
            float reach = float(i) * .85;
            hot += max(textureLod(coastReflection, ruv + along * reach, 0.).rgb - coastHot, 0.) * (1.1 - float(i) * .2);
            hot += max(textureLod(coastReflection, ruv - along * reach * .55, 0.).rgb - coastHot, 0.) * (1. - float(i) * .2);
          }
          // Schlick's Fresnel, normalized to the flat surface's view so the theme sets the overall strength.
          // Lights keep their own strength: at night the coast's walls reflect dimly, its lamps brightly.
          float level = pow(1. - clamp(coastView.y, 0., 1.), 5.);
          float facing = (.55 + .45 * pow(1. - clamp(dot(coastNormal, coastView), 0., 1.), 5.) / max(level, .001)) * (1. - coastFoamAmount);
          outgoingLight = mix(outgoingLight, mirrored, clamp(coastReflect * facing, 0., .9)) + hot * coastGlow * .22 * facing;
          // Glitter paths of the fire and the pier lamps: each light's mirror point stretched into a long
          // streak toward the viewer, lit only on ripple facets tilted back toward the light.
          float glitter = 0.;
          for (int i = 0; i < coastGlintCount; i++) {
            vec4 g = coastGlints[i];
            if (g.z < .001) continue;
            float dz = coastPosition.z - g.y;
            float dx = (coastPosition.x - g.x) / (g.w * (1. + .22 * abs(dz)));
            if (abs(dx) > 3.) continue;
            float path = exp(-dx * dx) * exp(-dz * dz / (dz > 0. ? 3.2 : .45));
            glitter += path * g.z * (.3 + .7 * smoothstep(-.02, .09, coastSlope.y + .025 * sin(coastPosition.x * 23. + coastTime * 2.6)));
          }
          outgoingLight += coastGlintColor * glitter * (1. - coastFoamAmount) * smoothstep(.15, .45, coastDepth);
        }
        #include <opaque_fragment>`
      );
  };
  material.customProgramCacheKey = () => "coast-water-footer";
}

const aim = { forward: new THREE.Vector3(), up: new THREE.Vector3(), look: new THREE.Vector3(), point: new THREE.Vector3() };

// Place `mirror` as the reflection of `camera` across the water plane, looking up at the coast, with a
// frustum covering only the band of the view where water shows (from the bottom edge to the farthest
// visible waterline) plus margins for ripples and a drifting camera. A water point keeps its height in
// both views and swaps sides. Returns the horizontal margin in world units.
export function aimMirror(camera, mirror, profile = []) {
  camera.updateMatrixWorld();
  const { forward, up, look, point } = aim;
  forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  forward.y = -forward.y;
  up.y = -up.y;
  mirror.position.set(camera.position.x, 2 * WATER_LEVEL - camera.position.y, camera.position.z);
  mirror.up.copy(up);
  mirror.lookAt(look.copy(mirror.position).add(forward));
  const margin = (camera.right - camera.left) * 0.12;
  let top = camera.bottom;
  for (let x = -SHORE_SPAN; x <= SHORE_SPAN; x += 1) {
    point.set(x, WATER_LEVEL, shoreline(x, profile)).applyMatrix4(camera.matrixWorldInverse);
    if (point.x >= camera.left - margin && point.x <= camera.right + margin) top = Math.max(top, point.y);
  }
  Object.assign(mirror, {
    left: -(camera.right + margin),
    right: -(camera.left - margin),
    bottom: camera.bottom - 0.9,
    top: Math.min(top, camera.top) + 0.9,
    near: camera.near,
    far: camera.far,
  });
  mirror.updateProjectionMatrix();
  mirror.updateMatrixWorld();
  return margin;
}

// World position to the mirror texture's uv (the water shader samples it at each water point).
export function mirrorMatrix(mirror, out = new THREE.Matrix4()) {
  return out.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
}

export function createCoastWater(renderer, { clock, miniature = false, profile = [] } = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x337e90,
    roughness: miniature ? 0.32 : 0.3,
    metalness: miniature ? 0.18 : 0,
    transparent: true,
    depthWrite: false,
  });
  const geometry = new THREE.PlaneGeometry(190, 48, 190, 64).rotateX(-Math.PI / 2).translate(0, WATER_LEVEL, 14);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "CoastSea";
  mesh.userData.noOcclusion = true;
  if (miniature) {
    miniatureWater(material, clock);
    return {
      mesh,
      material,
      exclude() {},
      setTheme(theme) {
        material.color.set(theme.water);
      },
      setMovers() {},
      setLights() {},
      invalidate() {},
      update() {},
      evidence: () => ({ miniature: true }),
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  }

  // The mirror carries the reflections; the studio adds only a faint sheen.
  material.envMapIntensity = 0.15;
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false });
  target.texture.name = "CoastMirror";
  const movers = new Float32Array(16),
    moverPower = new Float32Array(4),
    glints = new Float32Array(16);
  const uniforms = {
    coastTime: clock,
    coastDeep: { value: new THREE.Color(0x337e90) },
    coastShallow: { value: new THREE.Color(0x3fc4cc) },
    // Linear albedos: a cool wet sand close to the authored tidal sand (la-jolla.glb) and a dark, weedy reef stone.
    coastBed: { value: new THREE.Color().setRGB(0.62, 0.61, 0.53) },
    coastRock: { value: new THREE.Color().setRGB(0.16, 0.15, 0.1) },
    coastCaustic: { value: 1 },
    coastReflect: { value: 0.2 },
    coastFoam: { value: 1 },
    coastHot: { value: 1.4 },
    coastGlow: { value: 0.4 },
    coastView: { value: new THREE.Vector3(0, 0.39, 0.92) },
    coastMovers: { value: movers },
    coastMoverPower: { value: moverPower },
    coastGlints: { value: glints },
    coastGlintCount: { value: 0 },
    coastMoverCount: { value: 0 },
    coastHotTaps: { value: 4 },
    coastOne: { value: 1 },
    coastGlintColor: { value: new THREE.Color(1, 0.62, 0.3) },
    coastReflection: { value: target.texture },
    coastReflectMatrix: { value: new THREE.Matrix4() },
    coastReflectAxes: { value: new THREE.Vector4() },
    coastShoreline: { value: shorelineTexture(profile) },
  };
  footerWater(material, uniforms);

  const mirror = new THREE.OrthographicCamera();
  const schedule = createReflectionSchedule({ spacing: 2 });
  const excluded = new Set([mesh]);
  const sky = new THREE.Color(0xdcedf4);
  const snapshot = {
    quaternion: new THREE.Quaternion(),
    projection: new THREE.Matrix4(),
    size: new THREE.Vector2(),
    range: [0, 0],
    position: new THREE.Vector3(),
    valid: false,
  };
  const forward = new THREE.Vector3(),
    point = new THREE.Vector3(),
    clearColor = new THREE.Color();
  let rendered = { width: 0, height: 0 };

  // Horizontal span (world x) of the water this camera shows, from the frustum's plane footprint.
  function viewRange(camera) {
    const center = point.set(0, 0, 0).applyMatrix4(camera.matrixWorld);
    const half = (camera.right - camera.left) / 2;
    return [center.x - half, center.x + half];
  }

  function changed(camera, size) {
    if (!snapshot.valid || !snapshot.size.equals(size)) return true;
    if (snapshot.quaternion.angleTo(camera.quaternion) > 0.004) return true;
    if (!snapshot.projection.equals(camera.projectionMatrix)) return true;
    const [left, right] = viewRange(camera);
    return left < snapshot.range[0] || right > snapshot.range[1] || Math.abs(camera.position.y - snapshot.position.y) > 0.05;
  }

  function renderReflection(scene, camera, size) {
    const margin = aimMirror(camera, mirror, profile);
    // About half the canvas's density: the mirror is rippled and streaked anyway.
    const density = (0.5 * size.x) / Math.max(camera.right - camera.left, 1);
    const width = Math.round(THREE.MathUtils.clamp((mirror.right - mirror.left) * density, 32, 1600));
    const height = Math.round(THREE.MathUtils.clamp((mirror.top - mirror.bottom) * density, 16, 900));
    if (target.width !== width || target.height !== height) target.setSize(width, height);
    const e = mirrorMatrix(mirror, uniforms.coastReflectMatrix.value).elements;
    uniforms.coastReflectAxes.value.set(e[0], e[1], e[8], e[9]);
    // People, boards and the sea itself stay out of the mirror: it is redrawn only on demand, and
    // moving figures would leave stale reflections behind.
    const hidden = [];
    excluded.forEach((object) => {
      if (object.visible) {
        object.visible = false;
        hidden.push(object);
      }
    });
    const previousTarget = renderer.getRenderTarget(),
      previousAlpha = renderer.getClearAlpha();
    renderer.getClearColor(clearColor);
    try {
      renderer.setRenderTarget(target);
      renderer.setClearColor(sky, 1);
      renderer.clear(true, true, false);
      renderer.render(scene, mirror);
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(clearColor, previousAlpha);
      hidden.forEach((object) => (object.visible = true));
    }
    snapshot.quaternion.copy(camera.quaternion);
    snapshot.projection.copy(camera.projectionMatrix);
    snapshot.size.copy(size);
    snapshot.position.copy(camera.position);
    const [left, right] = viewRange(camera);
    snapshot.range = [left - margin * 0.8, right + margin * 0.8];
    snapshot.valid = true;
    rendered = { width, height };
  }

  return {
    mesh,
    material,
    // Objects that never appear in the mirror (people, boards).
    exclude(objects) {
      for (const object of objects) if (object) excluded.add(object);
    },
    setTheme(theme) {
      uniforms.coastDeep.value.set(theme.deep);
      uniforms.coastShallow.value.set(theme.shallow);
      sky.set(theme.mirror);
      uniforms.coastCaustic.value = theme.caustic;
      uniforms.coastReflect.value = theme.reflect;
      uniforms.coastGlow.value = theme.glow;
      uniforms.coastFoam.value = theme.foam;
      // Lit windows and lamps outshine the night; by day only a much brighter highlight would streak,
      // so one pair of long taps suffices.
      uniforms.coastHot.value = 1.6 - theme.night * 1.15;
      uniforms.coastHotTaps.value = theme.night > 0.3 ? 4 : 1;
      schedule.invalidate();
    },
    // Up to four wakes: [{ x, z, heading: [x, z], power }].
    setMovers(list) {
      moverPower.fill(0);
      list.slice(0, 4).forEach((mover, i) => {
        movers.set([mover.x, mover.z, mover.heading[0], mover.heading[1]], i * 4);
        moverPower[i] = mover.power;
      });
      uniforms.coastMoverCount.value = Math.min(list.length, 4);
    },
    // Up to four point lights above the water: [{ x, y, z, power, spread }]. Each glitters around its
    // mirror point, where the camera sees its reflection in a level surface.
    setLights(list, camera) {
      glints.fill(0);
      const view = forward.set(0, 0, -1).applyQuaternion(camera.quaternion).toArray();
      list.slice(0, 4).forEach((light, i) => {
        const [x, z] = mirrorPoint(light.x, light.y, light.z, view);
        // A light behind the beach glitters from the water's edge outward.
        glints.set([x, Math.max(z, shoreline(light.x, profile) + 0.25), light.power, light.spread], i * 4);
      });
      uniforms.coastGlintCount.value = Math.min(list.length, 4);
    },
    invalidate() {
      schedule.invalidate();
    },
    // Before each frame: aim the shading at the camera and redraw the mirror if it is out of date.
    update(scene, camera, { size, live = false }) {
      camera.updateMatrixWorld();
      uniforms.coastView.value.setFromMatrixColumn(camera.matrixWorld, 2).normalize();
      if (changed(camera, size)) schedule.invalidate();
      if (schedule.due(live)) renderReflection(scene, camera, size);
    },
    evidence() {
      return {
        reflection: { renders: schedule.renders, pending: schedule.dirty, ...rendered },
        caustics: uniforms.coastCaustic.value,
        wakes: moverPower.filter((power) => power > 0.01).length,
        glints: [0, 1, 2, 3].filter((i) => glints[i * 4 + 2] > 0.001).map((i) => Array.from(glints.slice(i * 4, i * 4 + 4), (v) => +v.toFixed(3))),
      };
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      target.dispose();
      uniforms.coastShoreline.value.dispose();
    },
  };
}
