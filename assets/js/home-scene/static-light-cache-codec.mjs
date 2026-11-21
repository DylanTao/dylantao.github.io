// Packed fields use little-endian IEEE words. Version 3 omits all-+0 RGB
// triplets and stores retained Float64s in byte planes. Each of the four
// Float32 moment lanes has its own four planes.
export const STATIC_LIGHT_SNAPSHOT_VERSION = 3;

function base64Bytes(encoded, minimum, maximum = minimum) {
  if (
    typeof encoded !== "string" ||
    encoded.length % 4 ||
    encoded.length < 4 * Math.ceil(minimum / 3) ||
    encoded.length > 4 * Math.ceil(maximum / 3) ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
  )
    return null;
  try {
    const binary = atob(encoded);
    if (binary.length < minimum || binary.length > maximum) return null;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function expandTransport(encoded, length) {
  const triplets = length / 3;
  if (!Number.isInteger(triplets)) return null;
  const bitmap = Math.ceil(triplets / 8);
  const bytes = base64Bytes(encoded, bitmap, bitmap + length * 8);
  if (!bytes) return null;
  const remainder = triplets % 8;
  if (remainder && bytes[bitmap - 1] >> remainder) return null;
  let present = 0;
  for (let group = 0; group < triplets; group++) present += (bytes[group >> 3] >> (group & 7)) & 1;
  const plane = present * 3;
  if (bytes.length !== bitmap + plane * 8) return null;
  const expanded = new Uint8Array(length * 8);
  let literal = bitmap;
  for (let group = 0; group < triplets; group++) {
    if (!((bytes[group >> 3] >> (group & 7)) & 1)) continue;
    const target = group * 24;
    for (let byte = 0; byte < 8; byte++) {
      const at = literal + byte * plane;
      expanded[target + byte] = bytes[at];
      expanded[target + 8 + byte] = bytes[at + 1];
      expanded[target + 16 + byte] = bytes[at + 2];
    }
    literal += 3;
  }
  return expanded;
}

function expandMoments(encoded, length) {
  if (length % 4) return null;
  const bytes = base64Bytes(encoded, length * 4);
  if (!bytes) return null;
  const expanded = new Uint8Array(bytes.length);
  let i = 0;
  for (let lane = 0; lane < 4; lane++)
    for (let byte = 0; byte < 4; byte++) for (let target = lane * 4 + byte; target < bytes.length; target += 16) expanded[target] = bytes[i++];
  return expanded;
}

function readFloats(bytes, length, width) {
  if (!bytes) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = width === 8 ? new Float64Array(length) : new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const value = width === 8 ? view.getFloat64(i * width, true) : view.getFloat32(i * width, true);
    if (!Number.isFinite(value)) return null;
    values[i] = value;
  }
  return values;
}

export function decodeStaticLightArrays(snapshot, transportLength, momentLength) {
  if (snapshot?.version === 1) {
    const { transport, moments } = snapshot;
    const valid = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
    if (!valid(transport, transportLength) || !valid(moments, momentLength)) return null;
    const decodedTransport = Float64Array.from(transport);
    const decodedMoments = Float32Array.from(moments);
    if (!decodedTransport.every(Number.isFinite) || !decodedMoments.every(Number.isFinite)) return null;
    return { transport: decodedTransport, moments: decodedMoments };
  }
  if (snapshot?.version !== 2 && snapshot?.version !== STATIC_LIGHT_SNAPSHOT_VERSION) return null;
  const packed = snapshot.version === STATIC_LIGHT_SNAPSHOT_VERSION;
  const transport = readFloats(
    packed ? expandTransport(snapshot.transport, transportLength) : base64Bytes(snapshot.transport, transportLength * 8),
    transportLength,
    8
  );
  if (!transport) return null;
  const moments = readFloats(
    packed ? expandMoments(snapshot.moments, momentLength) : base64Bytes(snapshot.moments, momentLength * 4),
    momentLength,
    4
  );
  return moments && { transport, moments };
}
