import { STATIC_LIGHT_SNAPSHOT_VERSION } from "../assets/js/home-scene/static-light-cache-codec.mjs";

function floatBytes(values, width) {
  const bytes = Buffer.alloc(values.length * width);
  for (let i = 0; i < values.length; i++) {
    const offset = i * width,
      value = values[i];
    if (width === 8) bytes.writeDoubleLE(value, offset);
    else bytes.writeFloatLE(value, offset);
    const restored = width === 8 ? bytes.readDoubleLE(offset) : bytes.readFloatLE(offset);
    if (!Number.isFinite(value) || !Object.is(restored, value)) throw new RangeError("Cache packing changed a lighting value");
  }
  return bytes;
}

function packTransport(values) {
  if (values.length % 3) throw new RangeError("Static transport requires RGB triplets");
  const bytes = floatBytes(values, 8);
  const triplets = values.length / 3;
  const bitmap = Buffer.alloc(Math.ceil(triplets / 8));
  const retained = [];
  for (let group = 0; group < triplets; group++) {
    const i = group * 3;
    if (Object.is(values[i], 0) && Object.is(values[i + 1], 0) && Object.is(values[i + 2], 0)) continue;
    bitmap[group >> 3] |= 1 << (group & 7);
    retained.push(i);
  }
  const packed = Buffer.alloc(bitmap.length + retained.length * 24);
  bitmap.copy(packed);
  let i = bitmap.length;
  for (let byte = 0; byte < 8; byte++)
    for (const triplet of retained) {
      const at = triplet * 8 + byte;
      packed[i++] = bytes[at];
      packed[i++] = bytes[at + 8];
      packed[i++] = bytes[at + 16];
    }
  return packed.toString("base64");
}

function packMoments(values) {
  if (values.length % 4) throw new RangeError("Static moments require four lanes");
  const bytes = floatBytes(values, 4);
  const packed = Buffer.alloc(bytes.length);
  let i = 0;
  for (let lane = 0; lane < 4; lane++)
    for (let byte = 0; byte < 4; byte++) for (let source = lane * 4 + byte; source < bytes.length; source += 16) packed[i++] = bytes[source];
  return packed.toString("base64");
}

export function packStaticLightSnapshot(snapshot) {
  return {
    ...snapshot,
    version: STATIC_LIGHT_SNAPSHOT_VERSION,
    transport: packTransport(snapshot.transport),
    moments: packMoments(snapshot.moments),
  };
}
