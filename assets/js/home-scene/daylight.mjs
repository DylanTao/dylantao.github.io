// NOAA's fractional-year approximation. La Jolla is the authored setting,
// not a surveyed building or weather feed. +X is north, +Z east (sea is west).
export const LA_JOLLA = { latitude: 32.83, longitude: -117.27, timeZone: "America/Los_Angeles" };
const rad = Math.PI / 180;
const smooth = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function coastalDaylight(dateKey, minute) {
  const noon = new Date(`${dateKey}T12:00:00-08:00`),
    fields = new Intl.DateTimeFormat("en-US", { timeZone: LA_JOLLA.timeZone, timeZoneName: "longOffset" }).formatToParts(noon),
    offset = Number(fields.find((p) => p.type === "timeZoneName").value.match(/GMT([+-]\d+)/)[1]),
    [year, month, day] = dateKey.split("-").map(Number),
    dayOfYear = (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86400000,
    days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000,
    gamma = ((Math.PI * 2) / days) * (dayOfYear - 1 + (minute / 60 - 12) / 24),
    equation =
      229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)),
    declination =
      0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) +
      0.00148 * Math.sin(3 * gamma),
    hourAngle = ((minute + equation + 4 * LA_JOLLA.longitude - 60 * offset) / 4 - 180) * rad,
    latitude = LA_JOLLA.latitude * rad,
    east = -Math.cos(declination) * Math.sin(hourAngle),
    up = Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle),
    north = Math.cos(latitude) * Math.sin(declination) - Math.sin(latitude) * Math.cos(declination) * Math.cos(hourAngle),
    altitude = Math.asin(up) / rad,
    daylight = smooth(-6, 3, altitude),
    sunlight = smooth(-0.5, 5, altitude);
  return {
    minute,
    offset,
    altitude,
    daylight,
    sunlight,
    direction: [north, up, east],
    keyDirection: sunlight > 0 ? [north, Math.max(up, 0.03), east] : [-0.45, 0.7, -0.55],
  };
}
