"use strict";

const { createHash } = require("node:crypto");

// Sorting exact triangle tuples makes collection order irrelevant. Winding,
// color, multiplicity, signed zero and all Float32 bits remain part of the key.
async function fingerprintLoungeTriangles(positions, albedo) {
  const count = positions.length / 9;
  if (!Number.isInteger(count) || albedo.length !== count * 3) throw new RangeError("Invalid static light triangle arrays");
  const vertices = new Uint32Array(positions.buffer, positions.byteOffset, positions.length);
  const colors = new Uint32Array(albedo.buffer, albedo.byteOffset, albedo.length);
  const order = Uint32Array.from({ length: count }, (_, i) => i);
  order.sort((a, b) => {
    for (let k = 0; k < 9; k++) {
      const difference = vertices[a * 9 + k] - vertices[b * 9 + k];
      if (difference) return difference;
    }
    for (let k = 0; k < 3; k++) {
      const difference = colors[a * 3 + k] - colors[b * 3 + k];
      if (difference) return difference;
    }
    return 0;
  });
  const payload = new DataView(new ArrayBuffer(count * 48));
  let byte = 0;
  for (const i of order) {
    for (let k = 0; k < 9; k++, byte += 4) payload.setUint32(byte, vertices[i * 9 + k], true);
    for (let k = 0; k < 3; k++, byte += 4) payload.setUint32(byte, colors[i * 3 + k], true);
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", payload));
  return Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
}

function loungeProbeInput(snapshot) {
  const { regions, maxTraceDistance } = JSON.parse(snapshot.configuration);
  const regionIndex = regions.findIndex(({ id }) => id === "lounge");
  if (regionIndex < 0) throw new RangeError("Lounge static-light cage is absent");
  const firstProbe = regionIndex * 8;
  const probes = snapshot.probes.slice(firstProbe, firstProbe + 8).map(({ position, valid }) => ({ position, valid }));
  if (probes.length !== 8 || !probes.some(({ valid }) => valid)) throw new RangeError("Lounge has no usable static-light probes");
  return { region: regions[regionIndex], firstProbe, probes, maxTraceDistance };
}

function loungeGeometryFingerprint(snapshot, triangleFingerprint) {
  if (!/^[0-9a-f]{64}$/.test(triangleFingerprint)) throw new RangeError("Lounge triangle fingerprint is missing");
  // The ordered directional payload is also versioned independently of the main
  // signed snapshot. Geometry and the relocated receiver layout determine reuse.
  return createHash("sha256")
    .update(JSON.stringify({ version: 1, triangleFingerprint, ...loungeProbeInput(snapshot) }))
    .digest("hex");
}

module.exports = { fingerprintLoungeTriangles, loungeProbeInput, loungeGeometryFingerprint };
