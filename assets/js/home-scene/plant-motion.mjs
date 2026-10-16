import {
  DEFAULT_WIND,
  WIND_MODES,
  coastWind,
  coastGustAt,
  coastVeerAt,
  coastWindGLSL,
  windGLSLFloat,
  windPhases,
  windSumGLSL,
  wrapWindPhase,
} from "./wind-field.mjs";

const TAU = Math.PI * 2;
const smoothstepFloat = (e0, e1, v) => {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Leaves stream back in strong air (reconfiguration), so in the coast's wind a bend saturates softly
// toward this displacement instead of growing without bound.
export const PLANT_BEND_LIMIT = 0.015;

// Exact steady periodic response of q''+2ω0 q'+ω0²q=ω0² target(t).
// Critical damping attenuates every mode; it cannot exceed the wind speed bound.
// `coastalPlantExposure` is (glass plane z, indoor share, outdoor share, coast on 0/1): with the coast
// on, a root's mean wind is the shared breeze times its gust envelope, at the glass front for a plant
// inside and at the plant itself outside, `coastalPlantLag` seconds late (the oscillator's delay).
// The defaults leave the coast off, which is the original room field exactly.
export function createPlantUniforms(seconds = 0, { compliance = 0.018, response = 3.5, rate = 1 } = {}) {
  const uniforms = {
    coastalPlantPhase: { value: new Float32Array(6) },
    coastalPlantScale: { value: new Float32Array(6) },
    coastalPlantCompliance: { value: compliance },
    coastalPlantEnabled: { value: 1 },
    coastalPlantExposure: { value: new Float32Array([-1e6, 1, 1, 0]) },
    coastalPlantLag: { value: 2 / response },
  };
  updatePlantUniforms(uniforms, seconds, { response, rate });
  return uniforms;
}
export function updatePlantUniforms(uniforms, seconds, { response = 3.5, rate = 1, reduced = false } = {}) {
  uniforms.coastalPlantEnabled.value = reduced ? 0 : 1;
  windPhases(seconds, rate, uniforms.coastalPlantPhase.value);
  for (let i = 0; i < WIND_MODES.length; i++) {
    const omega = WIND_MODES[i].rate * rate;
    const real = response * response - omega * omega,
      imaginary = 2 * response * omega;
    uniforms.coastalPlantScale.value[i] = reduced ? 0 : (response * response) / Math.hypot(real, imaginary);
    uniforms.coastalPlantPhase.value[i] = wrapWindPhase(WIND_MODES[i].phase + omega * seconds - Math.atan2(imaginary, real));
  }
}
// The CPU twin of the shader's bend. `coast` (a createCoastWind instance) switches on the coast's
// wind as coastal-wind.mjs binds it: `exposure` [glass z, indoor share, outdoor share] and the
// `mean`/`gust` of `wind` then come from the coast's state.
export function samplePlantDeflection(
  point,
  seconds,
  out = [0, 0, 0],
  { wind = DEFAULT_WIND, compliance = 0.018, response = 3.5, reduced = false, coast = null, exposure = null } = {}
) {
  if (reduced) {
    out.fill(0);
    return out;
  }
  const { mean = DEFAULT_WIND.mean, gust = DEFAULT_WIND.gust, rate = 1 } = wind;
  let share = 1,
    envelope = 1;
  if (coast) {
    const [glassZ, inside, outside] = exposure ?? [-4.48, coast.state.indoorLeak, 0.12],
      indoors = point[2] > glassZ;
    share = indoors ? inside : outside;
    envelope = coast.gust(point[0], indoors ? glassZ : point[2], seconds, 2 / response);
  }
  out[0] = mean[0] * envelope;
  out[1] = 0;
  out[2] = mean[2] * envelope;
  for (const mode of WIND_MODES) {
    const omega = mode.rate * rate,
      real = response * response - omega * omega,
      imaginary = 2 * response * omega;
    const gain = (response * response) / Math.hypot(real, imaginary);
    const phase = wrapWindPhase(mode.phase + omega * seconds - Math.atan2(imaginary, real));
    const s = gust * gain * Math.sin(point[0] * mode.k[0] + point[1] * mode.k[1] + point[2] * mode.k[2] + phase);
    out[0] += mode.velocity[0] * s;
    out[2] += mode.velocity[2] * s;
  }
  out[0] *= compliance * share;
  out[2] *= compliance * share;
  if (coast) {
    const soft = 1 / Math.sqrt(1 + (out[0] * out[0] + out[2] * out[2]) / (PLANT_BEND_LIMIT * PLANT_BEND_LIMIT));
    out[0] *= soft;
    out[2] *= soft;
  }
  return out;
}
export const plantFieldGLSL = `
uniform float coastalPlantPhase[6];
uniform float coastalPlantScale[6];
uniform float coastalPlantCompliance;
uniform float coastalPlantEnabled;
uniform vec4 coastalPlantExposure;
uniform float coastalPlantLag;
attribute vec3 coastalPlantRoot;
attribute float coastalPlantWeight;
attribute vec3 coastalPlantGradient;
vec3 coastalPlantBend(vec3 root) {
  if(coastalPlantWeight<=0.0 || coastalPlantEnabled<=0.0) return vec3(0.0);
  vec3 p=(modelMatrix*vec4(root,1.0)).xyz;
  vec3 v=vec3(0.0);
  ${windSumGLSL("coastalPlantPhase", "coastalPlantScale")}
  bool indoors=p.z>coastalPlantExposure.x;
  float share=indoors?coastalPlantExposure.y:coastalPlantExposure.z;
  float envelope=coastalPlantExposure.w>0.0?coastWindGust(vec2(p.x,indoors?coastalPlantExposure.x:p.z),coastalPlantLag):1.0;
  v=share*(coastalWindMean*envelope+coastalWindGust*v)*coastalPlantCompliance*coastalPlantEnabled;
  v.y=0.0;
  v*=coastalPlantExposure.w>0.0?inversesqrt(1.0+dot(v,v)/${windGLSLFloat(PLANT_BEND_LIMIT * PLANT_BEND_LIMIT)}):1.0;
  // Inverse vector transform for the orthogonal TRS matrices used by this scene.
  return vec3(dot(v,modelMatrix[0].xyz)/dot(modelMatrix[0].xyz,modelMatrix[0].xyz),
              dot(v,modelMatrix[1].xyz)/dot(modelMatrix[1].xyz,modelMatrix[1].xyz),
              dot(v,modelMatrix[2].xyz)/dot(modelMatrix[2].xyz,modelMatrix[2].xyz));
}
vec3 coastalPlantNormal(vec3 n,vec3 bend,vec3 gradient) {
  return normalize(n-gradient*dot(bend,n)/(1.0+dot(gradient,bend)));
}`;

// One-time spatial index of actual supporting stem vertices, in leaf-local meters.
// A resolver may instead return an authored attachment. No guessed mesh-bottom root.
export function createPlantAttachmentIndex(positions, maxDistance = 0.025) {
  if (!Number.isFinite(maxDistance) || maxDistance <= 0) throw new RangeError("Invalid stem search distance");
  const cells = new Map(),
    size = maxDistance;
  const key = (x, y, z) => `${x},${y},${z}`;
  for (let i = 0; i < positions.length; i += 3) {
    const k = key(Math.floor(positions[i] / size), Math.floor(positions[i + 1] / size), Math.floor(positions[i + 2] / size));
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(i);
  }
  return {
    closest(point) {
      const cell = point.map((x) => Math.floor(x / size));
      let best = maxDistance * maxDistance,
        found = null;
      for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
          for (let z = -1; z <= 1; z++) {
            for (const i of cells.get(key(cell[0] + x, cell[1] + y, cell[2] + z)) ?? []) {
              const d = (point[0] - positions[i]) ** 2 + (point[1] - positions[i + 1]) ** 2 + (point[2] - positions[i + 2]) ** 2;
              if (d < best) {
                best = d;
                found = { distance: Math.sqrt(d), point: point.slice() };
              }
            }
          }
      return found;
    },
  };
}

export function buildPlantAttributes(
  positions,
  index,
  { attachmentIndex, resolveRoot, pinRadius = 0.018, maxSpan = 1.2, minSpan = 0.04, weldTolerance = 1e-5 } = {}
) {
  const count = positions.length / 3;
  if (!Number.isInteger(count) || count === 0 || pinRadius <= 0 || weldTolerance <= 0)
    throw new RangeError("Invalid plant geometry/attachment scale");
  const parent = Uint32Array.from({ length: count }, (_, i) => i),
    weld = new Map();
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a, b) => {
    parent[find(a)] = find(b);
  };
  for (let i = 0; i < count; i++) {
    const key = [0, 1, 2].map((a) => Math.round(positions[i * 3 + a] / weldTolerance)).join(",");
    if (weld.has(key)) union(i, weld.get(key));
    else weld.set(key, i);
  }
  const triangles = index ?? Uint32Array.from({ length: count }, (_, i) => i);
  if (triangles.length % 3) throw new RangeError("Plant topology must contain triangles");
  if (triangles.some((i) => !Number.isInteger(i) || i < 0 || i >= count)) throw new RangeError("Invalid plant vertex index");
  for (let i = 0; i < triangles.length; i += 3) {
    union(triangles[i], triangles[i + 1]);
    union(triangles[i], triangles[i + 2]);
  }
  const groups = new Map();
  for (let i = 0; i < count; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }
  const roots = new Float32Array(count * 3),
    weights = new Float32Array(count),
    gradients = new Float32Array(count * 3);
  let enabled = 0;
  for (const indices of groups.values()) {
    const low = [Infinity, Infinity, Infinity],
      high = [-Infinity, -Infinity, -Infinity];
    for (const i of indices)
      for (let a = 0; a < 3; a++) {
        low[a] = Math.min(low[a], positions[i * 3 + a]);
        high[a] = Math.max(high[a], positions[i * 3 + a]);
      }
    if (Math.hypot(...high.map((v, a) => v - low[a])) > maxSpan) continue;
    let root = resolveRoot?.({ indices, positions, bounds: { low, high } }),
      closest = Infinity;
    if (!root && attachmentIndex)
      for (const i of indices) {
        const candidate = attachmentIndex.closest(Array.from(positions.subarray(i * 3, i * 3 + 3)));
        if (candidate && candidate.distance < closest) {
          closest = candidate.distance;
          root = candidate.point;
        }
      }
    if (!root || root.some((v) => !Number.isFinite(v))) continue;
    let radius = 0;
    for (const i of indices) radius = Math.max(radius, Math.hypot(...root.map((v, a) => positions[i * 3 + a] - v)));
    const span = radius - pinRadius;
    if (span < minSpan) continue;
    enabled++;
    for (const i of indices) {
      const d = root.map((v, a) => positions[i * 3 + a] - v),
        r = Math.hypot(...d),
        u = Math.max(0, (r - pinRadius) / span);
      roots.set(root, i * 3);
      weights[i] = u * u;
      if (r > pinRadius) for (let a = 0; a < 3; a++) gradients[i * 3 + a] = (2 * u * d[a]) / (span * r);
    }
  }
  return {
    root: roots,
    weight: weights,
    gradient: gradients,
    evidence: { vertices: count, components: groups.size, enabled, disabled: groups.size - enabled },
  };
}

export function deformPlantVertex(point, root, weight, bend, out = [0, 0, 0]) {
  for (let a = 0; a < 3; a++) out[a] = point[a] + weight * bend[a];
  return out;
}
export function deformPlantNormal(normal, gradient, bend, out = [0, 0, 0]) {
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
    scale = dot(bend, normal) / (1 + dot(gradient, bend));
  for (let a = 0; a < 3; a++) out[a] = normal[a] - gradient[a] * scale;
  const length = Math.hypot(...out);
  for (let a = 0; a < 3; a++) out[a] /= length;
  return out;
}

// Use the identical hook on beauty, depth, distance and normal materials.
// One filtered field evaluation is shared by vertex position and normal stages.
// `coastUniforms` defaults to the scene's shared coast wind (wind-field.mjs).
export function patchPlantShader(shader, windUniforms, plantUniforms, coastUniforms = coastWind.uniforms) {
  if (!shader.vertexShader.includes("#include <begin_vertex>")) throw new Error("Plant shader has no position stage");
  const mainEntry = /\bvoid\s+main\s*\(\s*(?:void\s*)?\)\s*\{/;
  if (!mainEntry.test(shader.vertexShader)) throw new Error("Plant shader has no main entry");
  Object.assign(shader.uniforms, coastUniforms, windUniforms, plantUniforms);
  const declarations = `uniform vec3 coastalWindMean; uniform float coastalWindGust;\n${coastWindGLSL}\n${plantFieldGLSL}\n`;
  shader.vertexShader = declarations + shader.vertexShader;
  // Depth/distance shaders put normals inside USE_DISPLACEMENTMAP. The shared
  // bend must be computed outside that guard so shadow positions always have it.
  shader.vertexShader = shader.vertexShader.replace(mainEntry, "$&\n    vec3 coastalLocalBend=coastalPlantBend(coastalPlantRoot);");
  const hasNormals = shader.vertexShader.includes("#include <beginnormal_vertex>");
  if (hasNormals)
    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      `
    #include <beginnormal_vertex>
    objectNormal=coastalPlantNormal(objectNormal,coastalLocalBend,coastalPlantGradient);
  `
    );
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `
    vec3 transformed=position+coastalPlantWeight*coastalLocalBend;
  `
  );
  return shader;
}

// The clifftop planting (bin/coastal_flora.py) in the coast's wind. Each leaf, needle and blade
// carries a sway weight in uv.x, 0 at its plant's base and 1 at the top, and bends by weight² times a
// horizontal displacement from the shared wind at its own world position:
//   push  = reach (U g)^1.4: drag on a plant that streamlines as the wind rises grows like U^(2+V),
//           with a Vogel exponent V near -0.6 for leaves and grass, so the lean grows slower than U²;
//   g     = the gust envelope 2/omega seconds late, the delay of a damped stem with natural frequency omega;
//   rock  = 0.3 sin(omega psi + ...): the plants' own sway, phased by the retarded time psi, so the
//           sway rolls across the bluff downwind with the fronts, like wind waves over a field of grain;
//   veer  = the wind's slow swing across its mean direction; flutter = small fast leaf motion that
//           grows in with the speed. A tip drops by |lean|²/2h, so a stem keeps about its length.
// Profiles are authored per species: reach (m per (m/s)^1.4 at the top), natural frequency (Hz),
// flutter (m) and nominal height h (m, also the slope used to turn the normals).
export const FLORA_DRAG_EXPONENT = 1.4;
// In the October afternoon breeze (2.75 m/s, so (U g)^1.4 is about 4) grass tips lean about 5 cm and
// twice that in a gust, sage about 3 cm, the pine crowns about 4.5 cm.
export const FLORA_SWAY = Object.freeze({
  grass: Object.freeze({ reach: 0.012, frequency: 1.2, flutter: 0.006, height: 0.6 }),
  sage: Object.freeze({ reach: 0.0075, frequency: 0.9, flutter: 0.004, height: 0.9 }),
  berry: Object.freeze({ reach: 0.004, frequency: 0.7, flutter: 0.003, height: 1.6 }),
  pine: Object.freeze({ reach: 0.011, frequency: 0.35, flutter: 0.003, height: 6 }),
  palm: Object.freeze({ reach: 0.014, frequency: 0.8, flutter: 0.01, height: 1.5 }),
});
export function floraSwayProfile(name) {
  const n = String(name);
  return /grass leaf/i.test(n)
    ? FLORA_SWAY.grass
    : /sage leaf/i.test(n)
      ? FLORA_SWAY.sage
      : /berry leaf/i.test(n)
        ? FLORA_SWAY.berry
        : /pine needle/i.test(n)
          ? FLORA_SWAY.pine
          : /palm leaf/i.test(n)
            ? FLORA_SWAY.palm
            : null;
}

export const floraSwayGLSL = `
${coastWindGLSL}
uniform vec4 floraSway; // reach, natural angular frequency rad/s, flutter m, nominal height m
vec3 floraSwayWorld(vec3 p) {
  vec2 d = coastWindState.xy;
  float psi = coastWindRetarded(p.xz);
  float omega = floraSway.y;
  float speed = coastWindState.z * coastWindGustAt(psi - 2.0 / omega, coastWindAcross(p.xz));
  float push = floraSway.x * pow(max(speed, 0.0), ${windGLSLFloat(FLORA_DRAG_EXPONENT)});
  float rock = 0.3 * sin(omega * psi + 1.3 * sin(dot(p.xz, vec2(0.23, -0.41))));
  vec2 lean = push * ((1.0 + rock) * d + coastWindVeer(psi) * vec2(-d.y, d.x));
  float phase = dot(p.xz, vec2(3.1, 2.3));
  lean += floraSway.z * smoothstep(0.6, 6.0, speed) * vec2(sin(coastWindClock * 17.0 + phase), cos(coastWindClock * 13.0 + 1.3 * phase));
  float reach = length(lean), limit = 0.35 * floraSway.w;
  if (reach > limit) lean *= limit / reach;
  return vec3(lean.x, -dot(lean, lean) / (2.0 * floraSway.w), lean.y);
}
// World to object vector for the orthogonal TRS transforms of the planting's nodes.
vec3 floraSwayObject(vec3 v) {
  return vec3(dot(v, modelMatrix[0].xyz) / dot(modelMatrix[0].xyz, modelMatrix[0].xyz),
              dot(v, modelMatrix[1].xyz) / dot(modelMatrix[1].xyz, modelMatrix[1].xyz),
              dot(v, modelMatrix[2].xyz) / dot(modelMatrix[2].xyz, modelMatrix[2].xyz));
}
// p' = p + w b with w = uv.x² rising over the nominal height: the inverse transpose of I + b (x) grad w.
vec3 floraSwayNormal(vec3 n, vec3 bend) {
  vec3 gradient = (2.0 * uv.x / floraSway.w) * vec3(modelMatrix[0].y, modelMatrix[1].y, modelMatrix[2].y);
  return normalize(n - gradient * dot(bend, n) / max(0.2, 1.0 + dot(gradient, bend)));
}`;

// One hook for the beauty material and the planting's custom depth and distance materials, so the
// shadows sway with the leaves. Per-material profile uniform; one program for every species.
export function patchFloraSway(shader, profile, coastUniforms = coastWind.uniforms) {
  if (!profile) throw new Error("Flora sway needs a species profile");
  if (!shader.vertexShader.includes("#include <begin_vertex>")) throw new Error("Flora shader has no position stage");
  const mainEntry = /\bvoid\s+main\s*\(\s*(?:void\s*)?\)\s*\{/;
  if (!mainEntry.test(shader.vertexShader)) throw new Error("Flora shader has no main entry");
  Object.assign(shader.uniforms, coastUniforms, {
    floraSway: { value: new Float32Array([profile.reach, TAU * profile.frequency, profile.flutter, profile.height]) },
  });
  shader.vertexShader = `${floraSwayGLSL}\n${shader.vertexShader}`.replace(
    mainEntry,
    "$&\n    vec3 floraBend=floraSwayObject(floraSwayWorld((modelMatrix*vec4(position,1.0)).xyz));"
  );
  if (shader.vertexShader.includes("#include <beginnormal_vertex>"))
    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      "#include <beginnormal_vertex>\n    objectNormal=floraSwayNormal(objectNormal,floraBend);"
    );
  shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n    transformed+=uv.x*uv.x*floraBend;");
  return shader;
}

// The gust-driven lean (m at full weight) before rock, veer and flutter: reach (U g)^1.4 with the
// envelope g read 2/omega seconds late at the plant's world point.
export function floraSwayPush(point, profile, { wind = coastWind, seconds = wind.state.seconds } = {}) {
  const speed = wind.state.meanSpeed * wind.gust(point[0], point[2], seconds, 1 / (Math.PI * profile.frequency));
  return profile.reach * Math.max(speed, 0) ** FLORA_DRAG_EXPONENT;
}

// The CPU twin of floraSwayWorld: the world displacement (m) at full weight for a profile, at a world
// point and scene time, in the coast wind's current state.
export function sampleFloraSway(point, profile, { wind = coastWind, seconds = wind.state.seconds } = {}, out = [0, 0, 0]) {
  const [dx, dz] = wind.state.direction,
    psi = seconds - (point[0] * dx + point[2] * dz) / Math.max(wind.state.frontSpeed, 0.5),
    xi = -point[0] * dz + point[2] * dx,
    omega = TAU * profile.frequency,
    speed = wind.state.meanSpeed * coastGustAt(psi - 2 / omega, xi),
    push = profile.reach * Math.max(speed, 0) ** FLORA_DRAG_EXPONENT,
    rock = 0.3 * Math.sin(omega * psi + 1.3 * Math.sin(0.23 * point[0] - 0.41 * point[2])),
    veer = coastVeerAt(psi),
    phase = 3.1 * point[0] + 2.3 * point[2],
    flutter = profile.flutter * smoothstepFloat(0.6, 6, speed);
  let x = push * ((1 + rock) * dx - veer * dz) + flutter * Math.sin(seconds * 17 + phase),
    z = push * ((1 + rock) * dz + veer * dx) + flutter * Math.cos(seconds * 13 + 1.3 * phase);
  const reach = Math.hypot(x, z),
    limit = 0.35 * profile.height;
  if (reach > limit) {
    x *= limit / reach;
    z *= limit / reach;
  }
  out[0] = x;
  out[1] = -(x * x + z * z) / (2 * profile.height);
  out[2] = z;
  return out;
}
