import { DEFAULT_WIND, WIND_MODES, windPhases, windSumGLSL, wrapWindPhase } from "./wind-field.mjs";

// Exact steady periodic response of q''+2ω0 q'+ω0²q=ω0² target(t).
// Critical damping attenuates every mode; it cannot exceed the wind speed bound.
export function createPlantUniforms(seconds = 0, { compliance = 0.018, response = 3.5, rate = 1 } = {}) {
  const uniforms = {
    coastalPlantPhase: { value: new Float32Array(6) },
    coastalPlantScale: { value: new Float32Array(6) },
    coastalPlantCompliance: { value: compliance },
    coastalPlantEnabled: { value: 1 },
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
export function samplePlantDeflection(
  point,
  seconds,
  out = [0, 0, 0],
  { wind = DEFAULT_WIND, compliance = 0.018, response = 3.5, reduced = false } = {}
) {
  if (reduced) {
    out.fill(0);
    return out;
  }
  const { mean = DEFAULT_WIND.mean, gust = DEFAULT_WIND.gust, rate = 1 } = wind;
  out[0] = mean[0];
  out[1] = 0;
  out[2] = mean[2];
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
  out[0] *= compliance;
  out[2] *= compliance;
  return out;
}
export const plantFieldGLSL = `
uniform float coastalPlantPhase[6];
uniform float coastalPlantScale[6];
uniform float coastalPlantCompliance;
uniform float coastalPlantEnabled;
attribute vec3 coastalPlantRoot;
attribute float coastalPlantWeight;
attribute vec3 coastalPlantGradient;
vec3 coastalPlantBend(vec3 root) {
  if(coastalPlantWeight<=0.0 || coastalPlantEnabled<=0.0) return vec3(0.0);
  vec3 p=(modelMatrix*vec4(root,1.0)).xyz;
  vec3 v=vec3(0.0);
  ${windSumGLSL("coastalPlantPhase", "coastalPlantScale")}
  v=(coastalWindMean+coastalWindGust*v)*coastalPlantCompliance*coastalPlantEnabled;
  v.y=0.0;
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
export function patchPlantShader(shader, windUniforms, plantUniforms) {
  if (!shader.vertexShader.includes("#include <begin_vertex>")) throw new Error("Plant shader has no position stage");
  Object.assign(shader.uniforms, windUniforms, plantUniforms);
  const declarations = `uniform vec3 coastalWindMean; uniform float coastalWindGust;\n${plantFieldGLSL}\n`;
  shader.vertexShader = declarations + shader.vertexShader;
  const hasNormals = shader.vertexShader.includes("#include <beginnormal_vertex>");
  if (hasNormals)
    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      `
    #include <beginnormal_vertex>
    vec3 coastalLocalBend=coastalPlantBend(coastalPlantRoot);
    objectNormal=coastalPlantNormal(objectNormal,coastalLocalBend,coastalPlantGradient);
  `
    );
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `
    ${hasNormals ? "" : "vec3 coastalLocalBend=coastalPlantBend(coastalPlantRoot);"}
    vec3 transformed=position+coastalPlantWeight*coastalLocalBend;
  `
  );
  return shader;
}
