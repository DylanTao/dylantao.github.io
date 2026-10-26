// Authored underwater relief for the compressed La Jolla miniature, not surveyed bathymetry.
// The shoreline, canyon head and reef locations follow the existing scene. Sand ripples and low
// rock shelves add actual relief; the same sampled height field supplies geometry and ray hits.
import { SHELF, WATER_LEVEL } from "./water-optics.mjs?v=coast-water-20261026";

export function bottomDepth(sea, x, z) {
  const d = Math.max(z - sea.shore(x), 0);
  const c = (x - sea.canyon.x - Math.sin(d * 0.33) * sea.canyon.width * 0.13) / sea.canyon.width;
  const shelf = SHELF.start + SHELF.depth * (1 - Math.exp(-d / SHELF.reach)) + SHELF.slope * d;
  const canyon = sea.canyon.depth * Math.exp(-c * c) * (1 - Math.exp(-d / sea.canyon.reach));
  let reef = 0;
  for (const [center, width] of sea.reefs) reef = Math.max(reef, Math.exp(-(((x - center) / width) ** 2)));
  const rock = reef * Math.exp(-(((d - 1.45) / 1.2) ** 2));
  const ledges = (0.55 + 0.24 * Math.sin(x * 3.7 + z * 2.1) + 0.21 * Math.sin(x * 1.3 - z * 4.2)) * rock;
  const sand = Math.sin(d * 19 + Math.sin(x * 1.1) * 2) * 0.009 * (1 - rock) * Math.exp(-d * 0.22);
  const depth = Math.max(0.02, shelf + canyon - ledges * Math.min(0.42, shelf * 0.68) + sand);
  return { depth, rock, sand };
}

export function buildBottomRelief(sea, { columns = 385, rows = 129, z0 = -10, z1 = 38 } = {}) {
  const count = columns * rows;
  const depths = new Float32Array(count),
    positions = new Float32Array(count * 3),
    colors = new Float32Array(count * 3),
    indices = new Uint32Array((columns - 1) * (rows - 1) * 6);
  let low = Infinity,
    high = 0;
  for (let j = 0; j < rows; j++) {
    const z = z0 + ((z1 - z0) * j) / (rows - 1);
    for (let i = 0; i < columns; i++) {
      const x = -sea.span + (2 * sea.span * i) / (columns - 1),
        at = j * columns + i,
        { depth, rock, sand } = bottomDepth(sea, x, z);
      depths[at] = depth;
      positions.set([x, WATER_LEVEL - depth, z], at * 3);
      // Wet sand and darker reef stone, in linear light. Relief supplies the normal and shading.
      const grit = 0.97 + sand * 1.5 + 0.03 * Math.sin(x * 8.1 + z * 11.3);
      const amount = Math.min(rock * 1.5, 0.88);
      colors.set(
        [0.62 * (1 - amount) + 0.13 * amount, 0.61 * (1 - amount) + 0.15 * amount, 0.53 * (1 - amount) + 0.11 * amount].map((v) => v * grit),
        at * 3
      );
      low = Math.min(low, depth);
      high = Math.max(high, depth);
    }
  }
  let at = 0;
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < columns - 1; i++) {
      const a = j * columns + i,
        b = a + 1,
        c = a + columns,
        d = c + 1;
      indices.set([a, c, b, b, c, d], at);
      at += 6;
    }
  return { columns, rows, span: sea.span, z0, z1, depths, positions, colors, indices, range: [low, high] };
}

// Bilinear texel-centered lookup, matching the shader's height texture and actual mesh samples.
export function sampleBottomDepth(relief, x, z) {
  const tx = Math.max(0, Math.min(relief.columns - 1, ((x + relief.span) / (2 * relief.span)) * (relief.columns - 1))),
    tz = Math.max(0, Math.min(relief.rows - 1, ((z - relief.z0) / (relief.z1 - relief.z0)) * (relief.rows - 1))),
    i = Math.min(Math.floor(tx), relief.columns - 2),
    j = Math.min(Math.floor(tz), relief.rows - 2),
    u = tx - i,
    v = tz - j,
    at = j * relief.columns + i;
  return (
    (relief.depths[at] * (1 - u) + relief.depths[at + 1] * u) * (1 - v) +
    (relief.depths[at + relief.columns] * (1 - u) + relief.depths[at + relief.columns + 1] * u) * v
  );
}

// A bracketed ray/height-field hit, mirrored by the GPU. Unlike one flat-depth offset, this reaches
// the canyon slopes and reef shelves the mesh actually contains. No total-internal reflection
// occurs entering water from air; the caller supplies the Snell-refracted downward ray.
export function intersectBottom(relief, x, z, ray, surfaceOffset = 0) {
  let lo = 0,
    hi = (relief.range[1] + Math.abs(surfaceOffset) + 0.05) / Math.max(-ray[1], 0.25);
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) * 0.5,
      depth = sampleBottomDepth(relief, x + ray[0] * mid, z + ray[2] * mid);
    if (-surfaceOffset - ray[1] * mid < depth) lo = mid;
    else hi = mid;
  }
  const distance = (lo + hi) * 0.5;
  return { x: x + ray[0] * distance, y: WATER_LEVEL + surfaceOffset + ray[1] * distance, z: z + ray[2] * distance, distance };
}
