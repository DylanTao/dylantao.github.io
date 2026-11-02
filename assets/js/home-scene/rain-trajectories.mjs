// Metres/seconds. This bounded field shows representative drops, not every physical drop in a
// shower. The authored diameter distribution is deliberately separate from precipitation rate.
export const RAIN_FIELD = Object.freeze({
  extent: 30,
  ahead: 12,
  above: 8,
  below: 20,
  fall: 4,
  near: 3.5,
  maximum: 1024,
  compactMaximum: 256,
  shutter: Object.freeze([0.018, 0.034]),
});
const fract = (value) => value - Math.floor(value);
const wrap = (value, extent) => ((value % extent) + extent) % extent;
const seeds = Float64Array.from({ length: RAIN_FIELD.maximum * 4 }, (_, at) => {
  const index = Math.floor(at / 4),
    salt = (at % 4) + 1;
  return fract(Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123);
});
const diameters = Float64Array.from({ length: RAIN_FIELD.maximum }, (_, i) => 0.00075 + 0.00125 * seeds[i * 4 + 3] ** 2);
// Atlas et al. (1973), near sea level; also NASA19830016998 Eq1. Diameter is in metres.
// The sampled sizes/speeds are authored representatives, not local weather measurements.
const speeds = Float64Array.from(diameters, (diameter) => 9.65 - 10.3 * Math.exp(-600 * diameter));
function checkIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= RAIN_FIELD.maximum) throw new RangeError("Rain index outside bounded field");
}
export function rainSeed(index, salt) {
  checkIndex(index);
  if (!Number.isInteger(salt) || salt < 1 || salt > 4) throw new RangeError("Rain seed salt must be1..4");
  return seeds[index * 4 + salt - 1];
}
export function rainFall(index) {
  checkIndex(index);
  return speeds[index];
}
export function rainDiameter(index) {
  checkIndex(index);
  return diameters[index];
}
export function createRainDrop() {
  return { point: new Float64Array(3), tail: new Float64Array(3), copy: new Float64Array(3) };
}
const still = Object.freeze([0, 0, 0]);
export function rainDrop(index, seconds, center, wind = still, displacement = null, out = createRainDrop()) {
  checkIndex(index);
  const { above, below, extent, shutter } = RAIN_FIELD,
    span = above + below,
    fall = speeds[index],
    at = index * 4,
    lowX = center[0] - extent / 2,
    lowY = center[1] - below,
    lowZ = center[2] - extent / 2,
    x = seeds[at + 1] * extent + (displacement?.[0] ?? seconds * wind[0]),
    y = seeds[at] * span - seconds * fall,
    z = seeds[at + 2] * extent + (displacement?.[2] ?? seconds * wind[2]),
    exposure = shutter[0] + seeds[at + 3] * (shutter[1] - shutter[0]),
    length = fall * exposure;
  out.copy[0] = Math.floor((x - lowX) / extent);
  out.copy[1] = Math.floor((y - lowY) / span);
  out.copy[2] = Math.floor((z - lowZ) / extent);
  out.tail[0] = lowX + wrap(x - lowX, extent);
  out.tail[1] = lowY + wrap(y - lowY, span);
  out.tail[2] = lowZ + wrap(z - lowZ, extent);
  out.point[0] = out.tail[0] + exposure * wind[0];
  out.point[1] = out.tail[1] - length;
  out.point[2] = out.tail[2] + exposure * wind[2];
  out.length = length;
  out.diameter = diameters[index];
  return out;
}
