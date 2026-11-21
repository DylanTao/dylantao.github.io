import { LA_JOLLA } from "../assets/js/home-scene/daylight.mjs";
import { accumulateL1, createTriangleBVH, deringL1, dot, sphereQuadrature } from "../assets/js/home-scene/light-trace-core.mjs";
import geometryProof from "./coastal_lounge_solar_geometry.cjs";

export const shadowMetres = 64;
export const probeRays = 256;
export const angleUnit = Math.PI / 180;

const components = 8 * 12;
const lattice = { azimuth: 60, elevation: 0, azimuthStep: 4, elevationStep: 2, width: 62, height: 44 };
const latitude = LA_JOLLA.latitude * angleUnit;
const octahedron = sphereQuadrature(Math.sqrt(probeRays));

export function createLoungeTracer(bvh, probes, maxTraceDistance, rotation = 0) {
  const c = Math.cos(rotation),
    s = Math.sin(rotation);
  const byProbe = probes.map(({ position, valid }) =>
    valid
      ? octahedron.flatMap(({ direction: d, weight }) => {
          const direction = rotation ? [d[0] * c - d[2] * s, d[1], d[0] * s + d[2] * c] : d;
          const hit = bvh.ray(position, direction, maxTraceDistance);
          if (!hit) return [];
          const origin = hit.point.map((x, axis) => x + hit.normal[axis] * 0.002 - direction[axis] * 0.002);
          return [{ ...hit, origin, direction, weight }];
        })
      : []
  );
  return (direction, sun = null) => {
    const result = new Float64Array(components);
    for (const [probe, hits] of byProbe.entries()) {
      for (const hit of hits) {
        const cosine = dot(hit.normal, direction);
        if (cosine <= 0 || bvh.ray(hit.origin, direction, shadowMetres, 0.001, true)) continue;
        const radiance = Array.from(hit.albedo, (value, c) => (value * cosine * (sun?.[c] ?? 1)) / Math.PI);
        accumulateL1(result, probe * 12, radiance, hit.direction, hit.weight);
      }
      deringL1(result, probe * 12);
    }
    return result;
  };
}

export function sampleLoungeLattice(trace, geometryFingerprint) {
  const { azimuth, elevation, azimuthStep, elevationStep, width, height } = lattice;
  const samples = new Float32Array(width * height * components);
  let highest = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const az = (azimuth + x * azimuthStep) * angleUnit;
      const el = (elevation + y * elevationStep) * angleUnit;
      const direction = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
      // The 28° declination envelope leaves space beyond both solstices and the key's low-altitude clamp.
      if (Math.abs(direction[0] * Math.cos(latitude) + direction[1] * Math.sin(latitude)) > Math.sin(28 * angleUnit)) continue;
      const cell = Float32Array.from(trace(direction));
      highest = Math.max(highest, ...cell.map(Math.abs));
      samples.set(cell, (y * width + x) * components);
    }

  const scale = highest ? highest / 127 : 1 / 127;
  const quantized = Int8Array.from(samples, (value) => Math.round(value / scale));
  const data = Buffer.alloc(quantized.length);
  const stride = width * components;
  const channelDifference = (i, channel) => quantized[i] - (channel ? quantized[i - channel] : 0);
  for (let i = 0; i < quantized.length; i++) {
    const channel = i % 3;
    const previous = i >= stride ? channelDifference(i - stride, channel) : 0;
    data[i] = (channelDifference(i, channel) - previous) & 255;
  }
  return { version: 1, geometryFingerprint, ...lattice, scale, data: data.toString("base64") };
}

export async function bakeLoungeSolar(snapshot, { positions, albedo }, geometryFingerprint) {
  const { probes, maxTraceDistance } = geometryProof.loungeProbeInput(snapshot);
  const bvh = await createTriangleBVH(positions, albedo);
  return sampleLoungeLattice(createLoungeTracer(bvh, probes, maxTraceDistance), geometryFingerprint);
}
