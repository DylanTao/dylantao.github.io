// Exact output-change accounting. Dirty tiles are an offline oracle, not a
// runtime visibility predictor or evidence that those pixels can be skipped.
function compareTiles(before, after, width, height, { tileSize = 32, threshold = 0 } = {}) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    before.length !== width * height * 4 ||
    after.length !== before.length ||
    !Number.isInteger(tileSize) ||
    tileSize < 1 ||
    !Number.isInteger(threshold) ||
    threshold < 0 ||
    threshold > 255
  )
    throw Error("Invalid RGBA image, tile size or threshold");
  const cols = Math.ceil(width / tileSize),
    rows = Math.ceil(height / tileSize),
    mask = new Uint8Array(cols * rows);
  let changedPixels = 0,
    maximumChannelDelta = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let delta = 0;
      for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(before[i + c] - after[i + c]));
      maximumChannelDelta = Math.max(maximumChannelDelta, delta);
      if (delta > threshold) {
        changedPixels++;
        mask[Math.floor(y / tileSize) * cols + Math.floor(x / tileSize)] = 1;
      }
    }
  let dirtyTileCapacityPixels = 0;
  const dirtyTiles = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (mask[y * cols + x]) {
        dirtyTiles.push(y * cols + x);
        dirtyTileCapacityPixels += Math.min(tileSize, width - x * tileSize) * Math.min(tileSize, height - y * tileSize);
      }
  return {
    width,
    height,
    tileSize,
    threshold,
    changedPixels,
    changedFraction: changedPixels / (width * height),
    maximumChannelDelta,
    tileCount: cols * rows,
    dirtyTiles,
    dirtyTileCapacityPixels,
    dirtyTileCapacityFraction: dirtyTileCapacityPixels / (width * height),
  };
}

function oracleReconstruct(before, after, report) {
  const { width, height, tileSize, dirtyTiles } = report,
    cols = Math.ceil(width / tileSize),
    result = Uint8Array.from(before);
  if (report.threshold !== 0) throw Error("Only exact masks may certify reconstruction");
  for (const tile of dirtyTiles) {
    const x = (tile % cols) * tileSize,
      y = Math.floor(tile / cols) * tileSize;
    for (let row = y; row < Math.min(y + tileSize, height); row++) {
      const start = (row * width + x) * 4,
        end = (row * width + Math.min(x + tileSize, width)) * 4;
      result.set(after.subarray(start, end), start);
    }
  }
  return result;
}
module.exports = { compareTiles, oracleReconstruct };
