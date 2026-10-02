// Original local preintegration of Christensen/Burley's normalized diffusion.
// Distances are meters; this is a curved-patch irradiance model, not a BSSRDF
// solver. See SKIN-DIFFUSION.md for the normalization and omitted transport.
export const SKIN_DIFFUSION_DEFAULTS = Object.freeze({
  distances: Object.freeze([0.0032, 0.0012, 0.00065]),
  maxCurvature: 160,
  width: 257,
  height: 49,
  radialSamples: 96,
  tail: 30,
  strength: 0.7,
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function radialDensity(t) {
  return t < 0 ? 0 : (Math.exp(-t) + Math.exp(-t / 3)) / 4;
}

export function radialCDF(t) {
  return t <= 0 ? 0 : 1 - Math.exp(-t) / 4 - (3 * Math.exp(-t / 3)) / 4;
}

// The exact average of max(a+b*cos(phi),0) around one spherical ring.
export function clampedCosineRing(mu, theta) {
  const m = clamp(mu, -1, 1);
  const a = m * Math.cos(theta),
    b = Math.sqrt(Math.max(0, 1 - m * m)) * Math.sin(theta);
  if (a >= b) return Math.max(0, a);
  if (a <= -b) return 0;
  const phi = Math.acos(clamp(-a / b, -1, 1));
  return (a * phi + b * Math.sin(phi)) / Math.PI;
}

function gaussLegendre(count) {
  const nodes = new Float64Array(count),
    weights = new Float64Array(count);
  for (let i = 0; i < Math.ceil(count / 2); i++) {
    let root = Math.cos((Math.PI * (i + 0.75)) / (count + 0.5)),
      derivative = 0;
    for (let step = 0; step < 20; step++) {
      let current = 1,
        previous = 0;
      for (let n = 1; n <= count; n++) {
        const older = previous;
        previous = current;
        current = ((2 * n - 1) * root * previous - (n - 1) * older) / n;
      }
      derivative = (count * (root * current - previous)) / (root * root - 1);
      const delta = current / derivative;
      root -= delta;
      if (Math.abs(delta) < 1e-14) break;
    }
    const weight = 2 / ((1 - root * root) * derivative * derivative);
    nodes[i] = -root;
    nodes[count - 1 - i] = root;
    weights[i] = weights[count - 1 - i] = weight;
  }
  return { nodes, weights };
}

// sinc(theta) converts the planar radial measure to a sphere's area measure.
// The finite positive quadrature is normalized so a constant field stays one.
function curvedKernel(q, quadrature, tail) {
  const limit = Math.min(tail, Math.PI / q),
    result = [];
  let mass = 0;
  for (let i = 0; i < quadrature.nodes.length; i++) {
    const t = ((quadrature.nodes[i] + 1) * limit) / 2,
      theta = q * t,
      sinc = Math.abs(theta) < 1e-7 ? 1 - (theta * theta) / 6 : Math.sin(theta) / theta,
      weight = (quadrature.weights[i] * limit * radialDensity(t) * sinc) / 2;
    result.push({ cosine: Math.cos(theta), sine: Math.sin(theta), weight });
    mass += weight;
  }
  for (const ring of result) ring.weight /= mass;
  return result;
}

function ringSum(mu, kernel) {
  const tangent = Math.sqrt(Math.max(0, 1 - mu * mu));
  let result = 0;
  for (const ring of kernel) {
    const a = mu * ring.cosine,
      b = tangent * ring.sine;
    if (a >= b) result += Math.max(0, a) * ring.weight;
    else if (a > -b) {
      const phi = Math.acos(clamp(-a / b, -1, 1));
      result += ((a * phi + b * Math.sin(phi)) / Math.PI) * ring.weight;
    }
  }
  return clamp(result, 0, 1);
}

export function diffuseResponse(mu, curvature, distance, { radialSamples = 96, tail = 30 } = {}) {
  if (!Number.isFinite(mu) || !Number.isFinite(curvature) || !Number.isFinite(distance) || distance <= 0) {
    throw new RangeError("Finite cosine/curvature and a positive scattering distance are required.");
  }
  const m = clamp(mu, -1, 1),
    q = Math.max(0, curvature) * distance;
  if (!Number.isFinite(q) || !Number.isInteger(radialSamples) || radialSamples < 2 || radialSamples > 256 || !Number.isFinite(tail) || tail <= 0) {
    throw new RangeError("Finite curvature-distance product and a bounded positive radial quadrature are required.");
  }
  if (q < 1e-8) return Math.max(0, m);
  return ringSum(m, curvedKernel(q, gaussLegendre(radialSamples), tail));
}

export function resolveDiffusionOptions(options = {}) {
  const config = { ...SKIN_DIFFUSION_DEFAULTS, ...options, distances: [...(options.distances ?? SKIN_DIFFUSION_DEFAULTS.distances)] };
  if (config.distances.length !== 3 || config.distances.some((d) => !Number.isFinite(d) || d <= 0)) {
    throw new RangeError("Three positive, finite RGB scattering distances in meters are required.");
  }
  for (const key of ["width", "height", "radialSamples"]) {
    if (!Number.isInteger(config[key]) || config[key] < 2 || config[key] > (key === "radialSamples" ? 256 : 1024)) {
      throw new RangeError(`Invalid skin diffusion ${key}.`);
    }
  }
  if (!Number.isFinite(config.maxCurvature) || config.maxCurvature <= 0 || !Number.isFinite(config.tail) || config.tail <= 0) {
    throw new RangeError("Positive finite curvature bound and integration tail are required.");
  }
  if (config.distances.some((d) => !Number.isFinite(config.maxCurvature * d))) {
    throw new RangeError("The curvature-distance product must be finite.");
  }
  if (!Number.isFinite(config.strength) || config.strength < 0 || config.strength > 1) {
    throw new RangeError("Skin diffusion strength must lie between zero and one.");
  }
  return config;
}

export function buildDiffusionTable(options = {}) {
  const config = resolveDiffusionOptions(options),
    { width, height, maxCurvature, distances, radialSamples, tail } = config,
    quadrature = gaussLegendre(radialSamples),
    data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const curvature = (y * maxCurvature) / (height - 1);
    const kernels = curvature === 0 ? null : distances.map((d) => curvedKernel(curvature * d, quadrature, tail));
    for (let x = 0; x < width; x++) {
      const mu = (2 * x) / (width - 1) - 1,
        index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) data[index + channel] = kernels ? ringSum(mu, kernels[channel]) : Math.max(0, mu);
      data[index + 3] = 1;
    }
  }
  return { data, config };
}

// CPU mirror of bilinear texture sampling, including endpoint texel centers.
export function sampleDiffusionTable(table, mu, curvature) {
  const { data, config } = table,
    x = ((clamp(mu, -1, 1) + 1) * (config.width - 1)) / 2,
    y = (clamp(curvature, 0, config.maxCurvature) * (config.height - 1)) / config.maxCurvature,
    x0 = Math.floor(x),
    x1 = Math.min(x0 + 1, config.width - 1),
    y0 = Math.floor(y),
    y1 = Math.min(y0 + 1, config.height - 1),
    tx = x - x0,
    ty = y - y0;
  return [0, 1, 2].map((channel) => {
    const read = (xx, yy) => data[(yy * config.width + xx) * 4 + channel];
    return (1 - ty) * ((1 - tx) * read(x0, y0) + tx * read(x1, y0)) + ty * ((1 - tx) * read(x0, y1) + tx * read(x1, y1));
  });
}

// Mean curvature in inverse meters from the first/second fundamental forms.
// A convex outward-normal sphere yields +1/r; concave/degenerate input is flat.
export function estimateMeanCurvature(positionX, positionY, normalX, normalY, maximum = SKIN_DIFFUSION_DEFAULTS.maxCurvature) {
  if ([...positionX, ...positionY, ...normalX, ...normalY].some((v) => !Number.isFinite(v))) return 0;
  const g00 = dot(positionX, positionX),
    g01 = dot(positionX, positionY),
    g11 = dot(positionY, positionY),
    determinant = g00 * g11 - g01 * g01;
  if (determinant <= Math.max(1e-24, g00 * g11 * 1e-5)) return 0;
  const b00 = dot(normalX, positionX),
    b01 = (dot(normalX, positionY) + dot(normalY, positionX)) / 2,
    b11 = dot(normalY, positionY),
    mean = (g11 * b00 + g00 * b11 - 2 * g01 * b01) / (2 * determinant);
  return clamp(mean, 0, maximum);
}
