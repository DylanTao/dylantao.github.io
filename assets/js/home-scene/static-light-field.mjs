import * as THREE from "../three.module.min.js";
import {
  accumulateL1,
  clamp,
  cosineDirections,
  createTriangleBVH,
  deringL1,
  dot,
  evaluateL1,
  normalize,
  octEncode,
  pointAttenuation,
  skyBasis,
  sphereQuadrature,
} from "./light-trace-core.mjs";

export const STATIC_LIGHT_REGIONS = [
  { id: "study", min: [-1.65, 2.55, 2.25], max: [1.3, 4.7, 4.55] },
  { id: "sleep", min: [-4.3, 2.55, 2], max: [-1.85, 4.4, 4.8] },
  { id: "onsen", min: [2, 2.55, 1.9], max: [4.45, 4.9, 4.4] },
  { id: "kitchen", min: [-4.1, -0.05, -4], max: [-1.6, 2.15, -0.1] },
  { id: "gym", min: [-1.1, -0.05, -2.9], max: [1.1, 2.2, -0.55] },
  { id: "lounge", min: [1.9, -0.05, -4.05], max: [4.4, 2.1, -0.2] },
  { id: "nearhouse", min: [-5, -0.05, -5.7], max: [5, 4, -3.7] },
];

const abortError = () => Object.assign(new Error("Static light bake cancelled"), { name: "AbortError" });
let nextFieldIdentity = 0;
const defaultYield = () => new Promise((resolve) => setTimeout(resolve, 0));
const rgb = (value, fallback = [0, 0, 0]) => {
  const a = value?.isColor ? value.toArray() : value || fallback;
  if (a.length !== 3 || !a.every((x) => Number.isFinite(x) && x >= 0)) throw new RangeError("light color must be nonnegative finite linear RGB");
  return [...a];
};
const makeTexture = (data, width, height) => {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
};

// Static, one-bounce, visibility-weighted diffuse field. No dynamic ray tracing.
export function createStaticLightField({
  regions = STATIC_LIGHT_REGIONS,
  practicalSources = [],
  raysPerProbe = 64,
  skyRaysPerHit = 8,
  maxTraceDistance = 16,
  maxTriangles = 750000,
  acceptMesh = () => true,
} = {}) {
  // Three caches uniforms per material/program key. A later field must never
  // reuse a disposed field's uniform objects when binding the same material.
  const fieldIdentity = ++nextFieldIdentity;
  const side = Math.sqrt(raysPerProbe),
    rays = sphereQuadrature(side);
  if (!Number.isInteger(skyRaysPerHit) || skyRaysPerHit < 1 || skyRaysPerHit > 16) throw new RangeError("sky rays per hit must be 1..16");
  if (!Number.isFinite(maxTraceDistance) || maxTraceDistance <= 0 || !Number.isInteger(maxTriangles) || maxTriangles < 1)
    throw new RangeError("invalid trace bounds");
  if (!regions.length || regions.length > 8 || practicalSources.length > 8)
    throw new RangeError("field supports 1..8 regions and at most 8 practicals");
  regions = regions.map((r) => {
    if (r.min.length !== 3 || r.max.length !== 3 || !r.min.every((x, i) => Number.isFinite(x) && Number.isFinite(r.max[i]) && x < r.max[i]))
      throw new RangeError("invalid region bounds");
    return { id: r.id, min: [...r.min], max: [...r.max] };
  });
  practicalSources = practicalSources.map((s) => {
    if (!s.position?.every(Number.isFinite) || s.position.length !== 3) throw new RangeError("invalid practical position");
    return { ...s, position: [...s.position], color: rgb(s.color, [1, 1, 1]), distance: s.distance ?? 0, emitterRadius: s.emitterRadius ?? 0.18 };
  });
  const count = regions.length * 8,
    sourceCount = 3 + practicalSources.length,
    roots = [],
    bindings = new Map();
  const probes = regions.flatMap((r, region) =>
    Array.from({ length: 8 }, (_, corner) => ({
      region,
      corner,
      nominal: r.min.map((x, a) => x + (r.max[a] - x) * (0.25 + ((corner >> a) & 1) * 0.5)),
      position: null,
      valid: false,
      relocation: 0,
    }))
  );
  const coefficientData = new Float32Array(count * 16),
    positionData = new Float32Array(count * 4),
    momentData = new Float32Array(count * raysPerProbe * 4);
  const coefficientTexture = makeTexture(coefficientData, 4, count),
    positionTexture = makeTexture(positionData, count, 1),
    momentTexture = makeTexture(momentData, side, side * count);
  const uniforms = {
    slfReady: { value: 0 },
    slfCoefficients: { value: coefficientTexture },
    slfPositions: { value: positionTexture },
    slfMoments: { value: momentTexture },
    slfRegionMin: { value: regions.map((r) => new THREE.Vector3(...r.min)) },
    slfRegionMax: { value: regions.map((r) => new THREE.Vector3(...r.max)) },
    slfFallback: { value: Array.from({ length: 4 }, () => new THREE.Vector3()) },
  };
  let transport = null,
    bvh = null,
    generation = 0,
    disposed = false,
    baking = false,
    lastLighting = null;
  let lighting = { zenith: [0, 0, 0], horizon: [0, 0, 0], ground: [0, 0, 0], practicalPowers: practicalSources.map(() => 0) };
  let statistics = {
    ready: false,
    triangles: 0,
    meshes: 0,
    skippedMeshes: 0,
    skippedTriangles: 0,
    geometryMs: 0,
    acceleratorMs: 0,
    transportMs: 0,
    bakeMs: 0,
    maxTaskMs: 0,
    relocatedProbes: 0,
    rejectedProbes: 0,
  };
  const roiMin = [0, 1, 2].map((a) => Math.min(...regions.map((r) => r.min[a])) - maxTraceDistance),
    roiMax = [0, 1, 2].map((a) => Math.max(...regions.map((r) => r.max[a])) + maxTraceDistance);

  function addRoot(root, { id = root.name || `root-${roots.length}`, static: isStatic = true } = {}) {
    if (disposed || baking || uniforms.slfReady.value) throw new Error("add roots before baking a live field");
    if (!root?.isObject3D || !isStatic) throw new TypeError("a static Three Object3D root is required");
    if (!roots.some((r) => r.root === root)) roots.push({ root, id });
    return api;
  }
  async function collect(yieldTask, check) {
    const meshes = [];
    let potential = 0;
    for (const entry of roots) {
      entry.root.updateWorldMatrix(true, true);
      entry.root.traverse((mesh) => {
        if (!mesh.isMesh) return;
        let excluded = mesh.isSkinnedMesh || mesh.isInstancedMesh || !acceptMesh(mesh, entry.id);
        for (let a = mesh; a; a = a.parent)
          excluded ||=
            a.userData.outline ||
            a.userData.noOcclusion ||
            a.userData.noContactOcclusion ||
            a.userData.noOpaqueShadow ||
            a.userData.dynamic ||
            (a.userData.renderStyle && a.userData.renderStyle !== "realistic");
        const geometry = mesh.geometry,
          position = geometry?.attributes.position;
        if (excluded || !position) {
          statistics.skippedMeshes++;
          return;
        }
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const count = geometry.index ? geometry.index.count : position.count,
          groups = Array.isArray(mesh.material) ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];
        const drawStart = Math.max(0, geometry.drawRange.start),
          drawEnd = Math.min(count, drawStart + geometry.drawRange.count);
        const accepted = groups
          .map((g) => {
            const start = Math.max(g.start, drawStart),
              end = Math.min(g.start + g.count, drawEnd);
            return { ...g, start, count: Math.max(0, end - start) };
          })
          .filter((g) => {
            const m = materials[Array.isArray(mesh.material) ? g.materialIndex || 0 : 0];
            return g.count >= 3 && m && !m.transparent && m.opacity >= 0.999 && !(m.transmission > 0) && !(m.alphaTest > 0);
          });
        if (!accepted.length) {
          statistics.skippedMeshes++;
          return;
        }
        const triangles = accepted.reduce((s, g) => s + Math.floor(g.count / 3), 0);
        if (potential + triangles > maxTriangles)
          throw new RangeError(`static geometry exceeds explicit ${maxTriangles} triangle budget; native indirect is retained`);
        potential += triangles;
        meshes.push({ mesh, position, geometry, materials, groups: accepted });
      });
    }
    const positions = new Float32Array(potential * 9),
      albedo = new Float32Array(potential * 3),
      point = new THREE.Vector3();
    let n = 0,
      taskStart = performance.now();
    for (const { mesh, position, geometry, materials, groups } of meshes) {
      const world = new Float32Array(position.count * 3);
      for (let v = 0; v < position.count; v++) {
        point
          .fromBufferAttribute(position, v)
          .applyMatrix4(mesh.matrixWorld)
          .toArray(world, v * 3);
        if (v % 1024 === 1023 && performance.now() - taskStart > 6) {
          statistics.maxTaskMs = Math.max(statistics.maxTaskMs, performance.now() - taskStart);
          await yieldTask();
          check();
          taskStart = performance.now();
        }
      }
      for (const group of groups) {
        const material = materials[Array.isArray(mesh.material) ? group.materialIndex || 0 : 0],
          color = rgb(material.color, [1, 1, 1]),
          diffuse = 1 - clamp(material.metalness ?? 0, 0, 1);
        for (let i = group.start; i < Math.min(group.start + group.count, geometry.index?.count || position.count) - 2; i += 3) {
          const indices = [0, 1, 2].map((j) => (geometry.index ? geometry.index.getX(i + j) : i + j) * 3);
          const outside = [0, 1, 2].some((a) => indices.every((v) => world[v + a] < roiMin[a]) || indices.every((v) => world[v + a] > roiMax[a]));
          if (outside) {
            statistics.skippedTriangles++;
            continue;
          }
          for (let v = 0; v < 3; v++) positions.set(world.subarray(indices[v], indices[v] + 3), n * 9 + v * 3);
          albedo.set(
            color.map((x) => clamp(x * diffuse, 0, 0.95)),
            n * 3
          );
          n++;
          if (n % 1024 === 1023 && performance.now() - taskStart > 6) {
            statistics.maxTaskMs = Math.max(statistics.maxTaskMs, performance.now() - taskStart);
            await yieldTask();
            check();
            taskStart = performance.now();
          }
        }
      }
    }
    statistics.meshes = meshes.length;
    statistics.triangles = n;
    return { positions: positions.slice(0, n * 9), albedo: albedo.slice(0, n * 3) };
  }
  async function inspectProbe(position, yieldIfNeeded) {
    let backfaces = 0,
      near = 0,
      shortest = null;
    for (const r of rays) {
      const hit = bvh.ray(position, r.direction, maxTraceDistance, 0.0005);
      if (hit?.backface) {
        backfaces++;
        if (!shortest || hit.distance < shortest.hit.distance) shortest = { hit, direction: r.direction };
      }
      if (hit && hit.distance < 0.035) near++;
      const pending = yieldIfNeeded();
      if (pending) await pending;
    }
    return { valid: backfaces < raysPerProbe * 0.45 && near < raysPerProbe * 0.2, backfaces, near, shortest };
  }
  async function placeProbe(probe, yieldIfNeeded) {
    let position = [...probe.nominal],
      inspection = await inspectProbe(position, yieldIfNeeded);
    // A back-facing exit is evidence of a probe embedded in a closed solid.
    // Only a short outward move is allowed; otherwise reject, never shine through.
    if (!inspection.valid && inspection.shortest?.hit.distance < 0.45) {
      const move = inspection.shortest;
      position = position.map((x, a) => x + move.direction[a] * (move.hit.distance + 0.045));
      const region = regions[probe.region];
      if (position.every((x, a) => x > region.min[a] && x < region.max[a])) inspection = await inspectProbe(position, yieldIfNeeded);
      else inspection = { valid: false };
    }
    probe.position = position;
    probe.valid = inspection.valid;
    probe.relocation = Math.hypot(...position.map((x, a) => x - probe.nominal[a]));
    if (!probe.valid) statistics.rejectedProbes++;
    else if (probe.relocation > 0) statistics.relocatedProbes++;
  }
  async function traceProbe(probe, index, yieldIfNeeded) {
    const distances = new Float64Array(raysPerProbe),
      sourceStride = 12,
      start = index * sourceCount * sourceStride;
    for (let k = 0; k < rays.length; k++) {
      const { direction, weight } = rays[k],
        hit = bvh.ray(probe.position, direction, maxTraceDistance);
      distances[k] = hit?.distance ?? maxTraceDistance;
      if (!hit) {
        const boundary = skyBasis(direction);
        for (let s = 0; s < 3; s++) accumulateL1(transport, start + s * sourceStride, [boundary[s], boundary[s], boundary[s]], direction, weight);
        const pending = yieldIfNeeded();
        if (pending) await pending;
        continue;
      }
      const origin = hit.point.map((x, a) => x + hit.normal[a] * 0.002 - direction[a] * 0.002),
        visibleSky = [0, 0, 0];
      for (const secondary of cosineDirections(hit.normal, skyRaysPerHit)) {
        if (bvh.ray(origin, secondary, maxTraceDistance, 0.001, true)) continue;
        const boundary = skyBasis(secondary);
        for (let s = 0; s < 3; s++) visibleSky[s] += boundary[s] / skyRaysPerHit;
      }
      for (let s = 0; s < 3; s++)
        accumulateL1(
          transport,
          start + s * sourceStride,
          [...hit.albedo].map((x) => x * visibleSky[s]),
          direction,
          weight
        );
      practicalSources.forEach((source, s) => {
        const vector = source.position.map((x, a) => x - origin[a]),
          distance = Math.hypot(...vector);
        if (distance < 1e-5 || (source.distance && distance >= source.distance)) return;
        const lightDirection = vector.map((x) => x / distance),
          cosine = Math.max(0, dot(hit.normal, lightDirection));
        if (!cosine) return;
        const far = Math.max(0, distance - source.emitterRadius);
        if (far > 0.001 && bvh.ray(origin, lightDirection, far, 0.001, true)) return;
        const scale = (cosine * pointAttenuation(distance, source.distance)) / Math.PI;
        accumulateL1(
          transport,
          start + (s + 3) * sourceStride,
          [...hit.albedo].map((x, c) => x * source.color[c] * scale),
          direction,
          weight
        );
      });
      const pending = yieldIfNeeded();
      if (pending) await pending;
    }
    // Angular filtering of moments avoids octahedron-edge wrapping artifacts.
    for (let k = 0; k < rays.length; k++) {
      let mean = 0,
        square = 0,
        sum = 0;
      for (let j = 0; j < rays.length; j++) {
        const w = Math.max(0, dot(rays[k].direction, rays[j].direction) - 0.85) ** 2 * rays[j].weight;
        mean += distances[j] * w;
        square += distances[j] ** 2 * w;
        sum += w;
      }
      const at = (index * raysPerProbe + k) * 4;
      momentData[at] = mean / sum;
      momentData[at + 1] = square / sum;
      momentData[at + 2] = distances[k];
      momentData[at + 3] = 1;
    }
  }
  async function bake({ yieldTask = defaultYield, signal } = {}) {
    if (disposed || baking || uniforms.slfReady.value) throw new Error("field can bake once before disposal");
    baking = true;
    const ticket = ++generation,
      started = performance.now();
    const check = () => {
      if (disposed || signal?.aborted || generation !== ticket) throw abortError();
    };
    let taskStart = performance.now();
    const yielding = async () => {
      statistics.maxTaskMs = Math.max(statistics.maxTaskMs, performance.now() - taskStart);
      await yieldTask();
      check();
      taskStart = performance.now();
    };
    const yieldIfNeeded = () => (performance.now() - taskStart > 6 ? yielding() : null);
    try {
      check();
      const geometry = await collect(yielding, check);
      statistics.geometryMs = performance.now() - started;
      const acceleratorStart = performance.now();
      bvh = await createTriangleBVH(geometry.positions, geometry.albedo, { yieldTask: yielding, check });
      statistics.acceleratorMs = performance.now() - acceleratorStart;
      const transportStart = performance.now();
      transport = new Float64Array(count * sourceCount * 12);
      for (let i = 0; i < count; i++) {
        check();
        await placeProbe(probes[i], yieldIfNeeded);
        positionData.set([...probes[i].position, probes[i].valid ? 1 : 0], i * 4);
        if (probes[i].valid) await traceProbe(probes[i], i, yieldIfNeeded);
        if (performance.now() - taskStart > 8) await yielding();
      }
      check();
      statistics.transportMs = performance.now() - transportStart;
      statistics.bakeMs = performance.now() - started;
      statistics.maxTaskMs = Math.max(statistics.maxTaskMs, performance.now() - taskStart);
      statistics.ready = true;
      uniforms.slfReady.value = 1;
      positionTexture.needsUpdate = momentTexture.needsUpdate = true;
      setLighting(lighting, true);
      statistics.acceleratorBytes = bvh.bytes;
      statistics.trace = bvh.evidence?.() || {};
      bvh = null;
      return evidence();
    } catch (error) {
      bvh = transport = null;
      throw error;
    } finally {
      baking = false;
    }
  }
  function setLighting(next, force = false) {
    if (disposed) return false;
    lighting = {
      zenith: rgb(next.zenith),
      horizon: rgb(next.horizon),
      ground: rgb(next.ground),
      practicalPowers: [...(next.practicalPowers || practicalSources.map(() => 0))],
    };
    if (lighting.practicalPowers.length !== practicalSources.length || !lighting.practicalPowers.every((x) => Number.isFinite(x) && x >= 0))
      throw new RangeError("practical powers must match fixed sources");
    const signature = JSON.stringify(lighting);
    if (!force && signature === lastLighting) return false;
    lastLighting = signature;
    const colors = [lighting.zenith, lighting.horizon, lighting.ground],
      fallback = new Float64Array(12);
    for (const r of rays) {
      const basis = skyBasis(r.direction),
        radiance = [0, 1, 2].map((c) => basis.reduce((sum, weight, i) => sum + weight * colors[i][c], 0));
      accumulateL1(fallback, 0, radiance, r.direction, r.weight);
    }
    deringL1(fallback);
    for (let k = 0; k < 4; k++) uniforms.slfFallback.value[k].fromArray(fallback, k * 3);
    if (!transport) return true;
    const coefficients = new Float64Array(12);
    for (let p = 0; p < count; p++) {
      coefficients.fill(0);
      for (let s = 0; s < sourceCount; s++)
        for (let k = 0; k < 12; k++)
          coefficients[k] += transport[(p * sourceCount + s) * 12 + k] * (s < 3 ? colors[s][k % 3] : lighting.practicalPowers[s - 3]);
      deringL1(coefficients);
      for (let k = 0; k < 4; k++) coefficientData.set([...coefficients.subarray(k * 3, k * 3 + 3), 0], p * 16 + k * 4);
    }
    coefficientTexture.needsUpdate = true;
    return true;
  }
  function regionSupport(point, r) {
    const outside = Math.max(...point.map((x, a) => Math.max(r.min[a] - x, x - r.max[a], 0))),
      t = clamp(outside / 0.25, 0, 1);
    const coverage = 1 - t * t * (3 - 2 * t),
      score = point.reduce((s, x, a) => s + ((x - (r.min[a] + r.max[a]) * 0.5) / (r.max[a] - r.min[a])) ** 2, 0);
    return { coverage, weight: coverage / (0.25 + score) ** 2 };
  }
  function sampleRegion(region, point, normal) {
    const bounds = regions[region],
      f = point.map((x, a) => clamp(((x - bounds.min[a]) / (bounds.max[a] - bounds.min[a])) * 2 - 0.5, 0, 1)),
      biased = point.map((x, a) => x + normal[a] * 0.035),
      result = [0, 0, 0];
    let sum = 0;
    for (let k = 0; k < 8; k++) {
      const p = region * 8 + k,
        probe = probes[p];
      if (!probe.valid) continue;
      let weight = f.reduce((s, x, a) => s * ((k >> a) & 1 ? x : 1 - x), 1);
      const v = biased.map((x, a) => x - probe.position[a]),
        distance = Math.hypot(...v),
        direction = normalize(v),
        uv = octEncode(direction),
        ix = clamp(Math.floor(uv[0] * side), 0, side - 1),
        iy = clamp(Math.floor(uv[1] * side), 0, side - 1),
        at = (p * raysPerProbe + iy * side + ix) * 4;
      const mean = momentData[at],
        variance = Math.max(0.0001, momentData[at + 1] - mean * mean),
        excess = Math.max(0, distance - mean);
      weight *= (variance / (variance + excess * excess)) ** 3;
      weight *=
        Math.max(
          0.05,
          (dot(
            normal,
            direction.map((x) => -x)
          ) +
            1) *
            0.5
        ) ** 2;
      const coefficients = Array.from({ length: 12 }, (_, j) => coefficientData[p * 16 + Math.floor(j / 3) * 4 + (j % 3)]),
        e = evaluateL1(coefficients, normal);
      for (let c = 0; c < 3; c++) result[c] += e[c] * weight;
      sum += weight;
    }
    return { irradiance: result.map((x) => x / Math.max(sum, 1e-6)), region: bounds.id, fallback: false, weight: sum };
  }
  function sample(point, normal) {
    normal = normalize(normal);
    if (!point?.every(Number.isFinite) || point.length !== 3) throw new RangeError("finite world point required");
    const fallback = evaluateL1(
        uniforms.slfFallback.value.flatMap((v) => v.toArray()),
        normal
      ),
      result = [0, 0, 0],
      contributingRegions = [];
    let sum = 0,
      coverage = 0,
      probeWeight = 0;
    if (transport)
      regions.forEach((r, i) => {
        const support = regionSupport(point, r);
        if (!support.weight) return;
        const query = sampleRegion(i, point, normal);
        for (let c = 0; c < 3; c++) result[c] += query.irradiance[c] * support.weight;
        sum += support.weight;
        coverage = Math.max(coverage, support.coverage);
        probeWeight += query.weight * support.weight;
        contributingRegions.push(r.id);
      });
    return {
      irradiance: sum ? result.map((x, c) => fallback[c] * (1 - coverage) + (x / sum) * coverage) : fallback,
      region: contributingRegions[0] || null,
      contributingRegions,
      fallback: !sum,
      coverage,
      weight: sum ? probeWeight / sum : 1,
    };
  }
  const fragment = `
uniform float slfReady;
uniform sampler2D slfCoefficients, slfPositions, slfMoments;
uniform vec3 slfRegionMin[${regions.length}], slfRegionMax[${regions.length}], slfFallback[4];
varying vec3 slfWorldPosition;
vec2 slfOct(vec3 v) {
 v /= max(dot(abs(v),vec3(1.0)),1e-8);
 if(v.z<0.0) v.xy=(1.0-abs(v.yx))*vec2(v.x<0.0?-1.0:1.0,v.y<0.0?-1.0:1.0);
 return v.xy*.5+.5;
}
vec3 slfProbeCage(int region, vec3 n) {
 vec3 f=clamp((slfWorldPosition-slfRegionMin[region])/(slfRegionMax[region]-slfRegionMin[region])*2.0-.5,0.0,1.0);
 vec3 result=vec3(0.0);float total=0.0;
 for(int k=0;k<8;k++) {
  float p=float(region*8+k),row=(p+.5)/${count.toFixed(1)};
  vec4 probe=texture2D(slfPositions,vec2((p+.5)/${count.toFixed(1)},.5));
  if(probe.w<.5)continue;
  vec3 corner=vec3(float(k-k/2*2),float(k/2-k/4*2),float(k/4));
  vec3 weights=mix(vec3(1.0)-f,f,corner);float w=weights.x*weights.y*weights.z;
  vec3 v=slfWorldPosition+n*.035-probe.xyz;float distance=length(v);vec3 d=v/max(distance,1e-8);
  vec2 oct=clamp(floor(slfOct(d)*${side.toFixed(1)}),vec2(0.0),vec2(${(side - 1).toFixed(1)}));
  vec4 moments=texture2D(slfMoments,vec2((oct.x+.5)/${side.toFixed(1)},(p*${side.toFixed(1)}+oct.y+.5)/${(side * count).toFixed(1)}));
  float variance=max(.0001,moments.y-moments.x*moments.x),excess=max(0.0,distance-moments.x);
  float visibility=variance/(variance+excess*excess);w*=visibility*visibility*visibility;
  float facing=max(.05,(dot(n,-d)+1.0)*.5);w*=facing*facing;
  vec3 e=texture2D(slfCoefficients,vec2(.125,row)).rgb;
  e+=texture2D(slfCoefficients,vec2(.375,row)).rgb*n.x;
  e+=texture2D(slfCoefficients,vec2(.625,row)).rgb*n.y;
  e+=texture2D(slfCoefficients,vec2(.875,row)).rgb*n.z;
  result+=max(e,vec3(0.0))*w;total+=w;
 }
 return result/max(total,1e-6);
}
vec3 slfIrradiance(vec3 n) {
 vec3 fallback=max(vec3(0.0),slfFallback[0]+slfFallback[1]*n.x+slfFallback[2]*n.y+slfFallback[3]*n.z);
 vec3 result=vec3(0.0);float total=0.0,coverage=0.0;
 for(int r=0;r<${regions.length};r++) {
  vec3 lo=slfRegionMin[r],hi=slfRegionMax[r];
  vec3 exterior=max(max(lo-slfWorldPosition,slfWorldPosition-hi),vec3(0.0));
  float outside=max(max(exterior.x,exterior.y),exterior.z),support=1.0-smoothstep(0.0,.25,outside);
  if(support>0.0) {
   vec3 d=(slfWorldPosition-(lo+hi)*.5)/(hi-lo);float score=.25+dot(d,d),w=support/(score*score);
   result+=slfProbeCage(r,n)*w;total+=w;coverage=max(coverage,support);
  }
 }
 return total>0.0?mix(fallback,result/total,coverage):fallback;
}
`;
  function bindMaterial(material) {
    if (disposed) throw new Error("cannot bind disposed field");
    if (!material?.isMeshStandardMaterial) return () => {};
    if (bindings.has(material)) return bindings.get(material).dispose;
    const compile = material.onBeforeCompile,
      cache = material.customProgramCacheKey;
    const hook = function (shader, renderer) {
      compile.call(this, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 slfWorldPosition;")
        .replace("#include <project_vertex>", "slfWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>");
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${fragment}`).replace(
        "#include <lights_fragment_end>",
        `
if(slfReady>.5) {
 irradiance=vec3(0.0);
 iblIrradiance=slfIrradiance(inverseTransformDirection(normal,viewMatrix));
}
#include <lights_fragment_end>`
      );
    };
    const key = function () {
      return `${cache.call(this)}|static-light-field-l1-${regions.length}-${side}-${fieldIdentity}`;
    };
    material.onBeforeCompile = hook;
    material.customProgramCacheKey = key;
    material.needsUpdate = true;
    const disposeBinding = () => {
      material.removeEventListener("dispose", disposeBinding);
      if (material.onBeforeCompile === hook) material.onBeforeCompile = compile;
      if (material.customProgramCacheKey === key) material.customProgramCacheKey = cache;
      material.needsUpdate = true;
      bindings.delete(material);
    };
    material.addEventListener("dispose", disposeBinding);
    bindings.set(material, { dispose: disposeBinding });
    return disposeBinding;
  }
  function evidence() {
    const practicalEnergy = practicalSources.map((s, i) => ({
      id: s.id,
      unitDC: transport ? probes.reduce((sum, _, p) => sum + [0, 1, 2].reduce((e, c) => e + transport[(p * sourceCount + i + 3) * 12 + c], 0), 0) : 0,
    }));
    return {
      ...statistics,
      regions: regions.map((r) => r.id),
      probes: probes.map((p) => ({
        region: regions[p.region].id,
        nominal: [...p.nominal],
        position: p.position && [...p.position],
        valid: p.valid,
        relocation: p.relocation,
      })),
      raysPerProbe,
      skyRaysPerHit,
      maxTraceDistance,
      triangleBudget: maxTriangles,
      acceleratorBytes: statistics.acceleratorBytes || bvh?.bytes || 0,
      acceleratorRetainedBytes: bvh?.bytes || 0,
      retainedCpuBytes: coefficientData.byteLength + positionData.byteLength + momentData.byteLength + (transport?.byteLength || 0),
      textureBytes: coefficientData.byteLength + positionData.byteLength + momentData.byteLength,
      transportBytes: transport?.byteLength || 0,
      trace: statistics.trace || bvh?.evidence?.() || {},
      practicalEnergy,
      ready: !!uniforms.slfReady.value,
      disposed,
      limits: [
        "Static opaque geometry and one Lambertian bounce; no dynamic actor/leaf/coast displacement visibility",
        "First-order directional irradiance; sparse moment visibility is approximate and may leak across unsampled thin walls",
        "Material base color/metalness only; texture, vertex color and procedural detail are not baked",
        "Actual sky gradient plus authored far-ground boundary; solar disk/cloud/stars and direct-sun bounce omitted",
        "Final .18m practical emitter segment is unoccluded to model a diffuse bulb within its shade",
        "Transparent, refracted, volumetric and specular transport remain native approximations; no ray-traced caustics",
        "Native direct practical lights remain unshadowed; only cached indirect bounce includes traced visibility",
        "Outside the bounded regions uses unoccluded actual-sky diffuse fallback",
      ],
    };
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    generation++;
    uniforms.slfReady.value = 0;
    [...bindings.values()].forEach((b) => b.dispose());
    coefficientTexture.dispose();
    positionTexture.dispose();
    momentTexture.dispose();
    transport = bvh = null;
    roots.length = 0;
  }
  const api = { addRoot, bake, setLighting, bindMaterial, sample, evidence, dispose };
  setLighting(lighting);
  return api;
}
