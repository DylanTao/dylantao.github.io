// A lit window's streak in a capture of the coast's canvas, shared by the footer's browser case
// (footer-coast.spec.js) and the capture tool (bin/capture_footer_coast.cjs).
//
// `png` is a decoded image ({ width, height, data } in RGBA bytes) and `at` the window's mirror point
// as fractions of it. Warm light (red over blue) is weighed in a box around that point:
//   strength  how much there is per pixel of the box;
//   column    how far its centre lies from the mirror point's column, as a fraction of the width;
//   lean      the slope of x on y (a streak that hangs below its light has none);
//   orange    the share of it whose green is under 0.62 of its red, the colour a pale lamp's streak
//             took when its dim rim lost its green and blue.
function streakOf(png, at) {
  const { width, height, data } = png;
  const x0 = Math.max(0, Math.round((at[0] - 0.07) * width)),
    x1 = Math.min(width - 1, Math.round((at[0] + 0.07) * width)),
    y0 = Math.max(0, Math.round((at[1] - 0.1) * height)),
    y1 = Math.min(height - 1, Math.round((at[1] + 0.16) * height));
  let light = 0,
    orange = 0,
    sx = 0,
    sy = 0,
    syy = 0,
    sxy = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const o = (y * width + x) * 4,
        weight = Math.max(0, (data[o] - data[o + 2]) / 255 - 0.12) * (data[o] / 255);
      if (weight <= 0) continue;
      light += weight;
      if (data[o + 1] < 0.62 * data[o]) orange += weight;
      sx += weight * x;
      sy += weight * y;
      syy += weight * y * y;
      sxy += weight * x * y;
    }
  if (!light) return { strength: 0, column: 0, lean: 0, orange: 0 };
  const mx = sx / light,
    my = sy / light;
  return {
    strength: light / ((x1 - x0 + 1) * (y1 - y0 + 1)),
    column: mx / width - at[0],
    lean: (sxy / light - mx * my) / Math.max(syy / light - my * my, 1e-9),
    orange: orange / light,
  };
}

module.exports = { streakOf };
