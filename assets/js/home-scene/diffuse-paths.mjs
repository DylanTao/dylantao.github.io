import { accumulateL1, cosineDirections, dot, normalize, pointAttenuation, practicalEmission, skyBasis } from "./light-trace-core.mjs";

const hash = (value) => {
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
};

// Independent deterministic dimensions for deeper cosine-weighted path segments.
// The first hemisphere keeps the existing eight-sample authoring quadrature.
export function diffusePathDirection(normal, seed) {
  const u = (hash(seed) + 0.5) / 4294967296,
    v = (hash(seed ^ 0x9e3779b9) + 0.5) / 4294967296,
    n = normalize(normal),
    tangent = normalize(Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [0, -n[2], n[1]]),
    bitangent = [n[1] * tangent[2] - n[2] * tangent[1], n[2] * tangent[0] - n[0] * tangent[2], n[0] * tangent[1] - n[1] * tangent[0]],
    radius = Math.sqrt(u),
    angle = 2 * Math.PI * v;
  return n.map((value, axis) => value * Math.sqrt(1 - u) + radius * (Math.cos(angle) * tangent[axis] + Math.sin(angle) * bitangent[axis]));
}

// A tangential component along the incoming ray can cross an adjacent wall at
// a thin-shell corner. Start each additional segment on the incident side of
// this surface along its geometric normal only.
const offsetOrigin = (hit) => hit.point.map((value, axis) => value + hit.normal[axis] * 0.002);
// The offset already separates this surface. A millimetre-wide near interval
// could skip a different wall near a corner, falsely treating it as open sky.
const PATH_NEAR = 0.000001;

// Add only paths containing a second or third diffuse surface. The caller owns
// direct environment escape and the first practical bounce, so neither is added
// twice. Cosine / PDF cancels for each sampled Lambertian segment; throughput is
// the product of source albedos divided by the first hemisphere's sample count.
export function traceAdditionalDiffuse({
  bvh,
  first,
  origin,
  direction,
  weight,
  probeIndex,
  rayIndex,
  skyRaysPerHit,
  maxDiffuseBounces,
  bouncePracticals,
  maxTraceDistance,
  practicalSources,
  transport,
  start,
  statistics,
}) {
  if (maxDiffuseBounces <= 1 || first.backface) return;
  const samples = cosineDirections(first.normal, skyRaysPerHit);
  for (let sample = 0; sample < samples.length; sample++) {
    let nextDirection = samples[sample],
      nextOrigin = origin,
      throughput = [...first.albedo].map((value) => value / skyRaysPerHit);
    for (let bounce = 2; bounce <= maxDiffuseBounces; bounce++) {
      const hit = bvh.ray(nextOrigin, nextDirection, maxTraceDistance, PATH_NEAR);
      // First-segment escapes are already in the original sky basis.
      if (!hit) break;
      if (hit.backface) {
        statistics.absorbedBackfaces++;
        break;
      }
      statistics.secondarySurfaces++;
      throughput = throughput.map((value, channel) => value * hit.albedo[channel]);
      nextOrigin = offsetOrigin(hit);
      if (bouncePracticals)
        practicalSources.forEach((source, sourceIndex) => {
          if (source.region && !hit.point.every((value, axis) => value >= source.region.min[axis] && value <= source.region.max[axis])) return;
          const vector = source.position.map((value, axis) => value - nextOrigin[axis]),
            distance = Math.hypot(...vector);
          if (distance < 1e-5 || (source.distance && distance >= source.distance)) return;
          const lightDirection = vector.map((value) => value / distance),
            cosine = Math.max(0, dot(hit.normal, lightDirection)),
            emission = practicalEmission(lightDirection, source.emission);
          if (!cosine || !emission) return;
          const far = Math.max(0, distance - source.emitterRadius);
          if (far > 0.001 && bvh.ray(nextOrigin, lightDirection, far, 0.001, true)) return;
          const scale = (cosine * emission * pointAttenuation(distance, source.distance)) / Math.PI;
          accumulateL1(
            transport,
            start + (sourceIndex + 3) * 12,
            throughput.map((value, channel) => value * source.color[channel] * scale),
            direction,
            weight
          );
        });
      const seed =
        Math.imul(probeIndex + 1, 73856093) ^ Math.imul(rayIndex + 1, 19349663) ^ Math.imul(sample + 1, 83492791) ^ Math.imul(bounce, 2654435761);
      nextDirection = diffusePathDirection(hit.normal, seed);
      const following = bvh.ray(nextOrigin, nextDirection, maxTraceDistance, PATH_NEAR);
      if (!following) {
        const boundary = skyBasis(nextDirection);
        for (let source = 0; source < 3; source++)
          accumulateL1(
            transport,
            start + source * 12,
            throughput.map((value) => value * boundary[source]),
            direction,
            weight
          );
        statistics.secondaryEscapes++;
        break;
      }
    }
  }
}
