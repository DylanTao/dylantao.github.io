// Same physical section used by coastal_section.py and its exported beach.
export const coastline = (x) => 5.7 + 1.2 * Math.sin(x * 0.12) + 7.5 * Math.exp(-(((x - 24) / 10) ** 2)) + 3.3 * Math.exp(-(((x + 22) / 7) ** 2));
export const beachWidth = (x, data) => data.width + data.bulge * Math.exp(-(((x - 9) / 11) ** 2)) + data.ripple * Math.sin(x * 0.19);
export function beachPoint(x, fraction, data) {
  return [x, -6.82 - 1.13 * fraction + 0.04 * Math.sin(x * 0.6 + fraction * 2), -(coastline(x) - 0.35 + fraction * beachWidth(x, data))];
}
