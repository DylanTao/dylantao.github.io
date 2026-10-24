// A translated architectural installation may keep its authored constraints and
// buffers local. Render/culling use the world offset; wind samples actual world
// positions once. This adapter changes no wind state or allocation per sample.
export function localSceneOffset(offset = [0, 0, 0]) {
  if (!Array.isArray(offset) || offset.length !== 3 || !offset.every(Number.isFinite)) throw new RangeError("Invalid local scene offset");
  return offset.slice();
}

export function localSceneWind(coast, offset) {
  if (!coast || offset.every((value) => value === 0)) return coast;
  const [dx, dy, dz] = offset;
  return {
    ...coast,
    sample: (x, y, z, time, out) => coast.sample(x + dx, y + dy, z + dz, time, out),
    sampleIndoor: (x, y, z, time, out) => coast.sampleIndoor(x + dx, y + dy, z + dz, time, out),
  };
}
