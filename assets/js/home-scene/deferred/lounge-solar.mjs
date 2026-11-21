import { deringL1 } from "../light-trace-core.mjs";

const PER_PROBE = 12;
const CHANNELS = 8 * PER_PROBE;
const DEG = 180 / Math.PI;

// Rows hold signed coefficient bytes. Each channel is predicted from the same
// channel one elevation row below. Green and blue are stored relative to red.
export function decodeLoungeSolar(record, expectedGeometry) {
  const { version, geometryFingerprint, azimuth, elevation, azimuthStep, elevationStep, width, height, scale, data } = record;
  if (
    version !== 1 ||
    !/^[a-f0-9]{64}$/.test(geometryFingerprint ?? "") ||
    geometryFingerprint !== expectedGeometry ||
    ![azimuth, elevation, azimuthStep, elevationStep, width, height].every(Number.isInteger) ||
    azimuth < 0 ||
    elevation < 0 ||
    azimuthStep < 1 ||
    elevationStep < 1 ||
    width < 2 ||
    height < 2 ||
    azimuth + (width - 1) * azimuthStep >= 360 ||
    elevation + (height - 1) * elevationStep > 90 ||
    !(scale > 0 && scale <= 1 / 127) ||
    typeof data !== "string" ||
    data.length !== 4 * Math.ceil((width * height * CHANNELS) / 3)
  )
    throw new RangeError("Invalid or obsolete lounge solar transport");

  const encoded = atob(data);
  const values = new Int8Array(width * height * CHANNELS);
  if (encoded.length !== values.length) throw new RangeError("Truncated lounge solar transport");
  const stride = width * CHANNELS;
  for (let i = 0; i < values.length; i++) {
    const channel = i % 3,
      previous = i - stride;
    const below = previous < 0 ? 0 : values[previous] - (channel ? values[previous - channel] : 0);
    values[i] = encoded.charCodeAt(i) + below + (channel ? values[i - channel] : 0);
  }

  const result = new Float64Array(CHANNELS);
  let last = null;
  return (sun) => {
    if (!sun) return null;
    if (sun === last) return result;
    last = sun;
    const [direction, rgb] = sun;
    const az = (((Math.atan2(direction[2], direction[0]) * DEG + 360) % 360) - azimuth) / azimuthStep;
    const el = (Math.asin(Math.min(1, direction[1])) * DEG - elevation) / elevationStep;
    if (az < 0 || az > width - 1 || el < 0 || el > height - 1) {
      result.fill(0);
      return result;
    }
    const x = Math.min(Math.floor(az), width - 2),
      y = Math.min(Math.floor(el), height - 2);
    const a = az - x,
      b = el - y,
      start = (y * width + x) * CHANNELS;
    for (let i = 0; i < CHANNELS; i++) {
      const k = start + i;
      const low = values[k] * (1 - a) + values[k + CHANNELS] * a;
      const high = values[k + stride] * (1 - a) + values[k + stride + CHANNELS] * a;
      result[i] = (low * (1 - b) + high * b) * scale * rgb[i % 3];
    }
    // Quantization can move an exactly tangent first-order lobe just below zero.
    for (let i = 0; i < CHANNELS; i += PER_PROBE) deringL1(result, i);
    return result;
  };
}

export async function fetchLoungeSolar(cache, manifestUrl, signal) {
  const url = new URL(cache.loungeSolar, manifestUrl);
  url.searchParams.set("v", cache.loungeSolarSha256);
  const response = await fetch(url, { signal, priority: "low" });
  if (!response.ok) throw new Error("Lounge solar transport unavailable");
  const bytes = await response.arrayBuffer();
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  if (Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("") !== cache.loungeSolarSha256)
    throw new Error("Lounge solar transport checksum changed");
  return decodeLoungeSolar(JSON.parse(new TextDecoder().decode(bytes)), cache.loungeSolarGeometry);
}
