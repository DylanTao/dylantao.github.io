// La Jolla's sun, the one clock the site's time of day runs on: the theme, the sun arc, the footer
// coast and its credit. NOAA's general solar position equations (a US government work) for the
// authored setting, never the visitor's location. Minutes are La Jolla wall-clock minutes (0-1439);
// the site reads the visitor's own clock as those minutes, so every visitor sees La Jolla's day at
// their hour, and a visitor in California sees it exactly.

export const LA_JOLLA_SUN = Object.freeze({ latitude: 32.83, longitude: -117.27, timeZone: "America/Los_Angeles" });

const RAD = Math.PI / 180;

// The site turns to its evening theme when light ink reads as well as dark on the coast behind the
// footer's credit (measured on the coast's afterglow, 2026-10-19): the sun this far below the horizon,
// between sunset and civil dusk, and back to morning at the same depth before sunrise. Noon is the
// four hours around solar noon.
export const DARK_ALTITUDE = -3;
export const NOON_HALF_MINUTES = 120;
// Standard refraction and the sun's radius put sunrise and sunset at -0.833 degrees; civil twilight
// ends at -6.
export const HORIZON_ALTITUDE = -0.833;
export const CIVIL_ALTITUDE = -6;

// The US rule since 2007: daylight saving time from the second Sunday in March to the first Sunday in
// November. A fallback for browsers without Intl's longOffset names.
export function usPacificOffset(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const sunday = (m, nth) => 1 + ((7 - new Date(Date.UTC(year, m - 1, 1)).getUTCDay()) % 7) + 7 * (nth - 1);
  const t = month * 100 + day;
  return t >= 300 + sunday(3, 2) && t < 1100 + sunday(11, 1) ? -7 : -8;
}

// La Jolla's UTC offset in hours on a date (-7 in daylight saving time, -8 otherwise).
const offsets = new Map();
export function pacificOffset(dateKey) {
  if (!offsets.has(dateKey)) {
    let offset = usPacificOffset(dateKey);
    try {
      const zone = new Intl.DateTimeFormat("en-US", { timeZone: LA_JOLLA_SUN.timeZone, timeZoneName: "longOffset" })
        .formatToParts(new Date(`${dateKey}T20:00:00Z`))
        .find((part) => part.type === "timeZoneName").value;
      const match = zone.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (match) offset = (match[1] === "-" ? -1 : 1) * (Number(match[2]) + Number(match[3] || 0) / 60);
    } catch {
      // The rule above stands in.
    }
    offsets.set(dateKey, offset);
  }
  return offsets.get(dateKey);
}

function fractionalYear(dateKey, minute) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const dayOfYear = (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86400000;
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  return ((Math.PI * 2) / days) * (dayOfYear - 1 + (minute / 60 - 12) / 24);
}

function orbit(gamma) {
  const equation =
    229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  return { equation, declination };
}

// The sun's altitude above the horizon and its azimuth clockwise from north, in degrees.
export function solarPosition(dateKey, minute) {
  const offset = pacificOffset(dateKey);
  const { equation, declination } = orbit(fractionalYear(dateKey, minute));
  const hourAngle = ((minute + equation + 4 * LA_JOLLA_SUN.longitude - 60 * offset) / 4 - 180) * RAD;
  const latitude = LA_JOLLA_SUN.latitude * RAD;
  const cosZenith = Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith)));
  const east = -Math.cos(declination) * Math.sin(hourAngle);
  const north = Math.cos(latitude) * Math.sin(declination) - Math.sin(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  const azimuth = (((Math.atan2(east, north) / RAD) % 360) + 360) % 360;
  return { minute, altitude: 90 - zenith / RAD, azimuth };
}

// The minute in [from, to] where the altitude crosses `altitude`, by bisection (altitude is monotonic
// on each side of solar noon at this latitude).
function crossing(dateKey, altitude, from, to) {
  let lo = from,
    hi = to;
  const rising = solarPosition(dateKey, hi).altitude > solarPosition(dateKey, lo).altitude;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (solarPosition(dateKey, mid).altitude > altitude === rising) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

// The day's events in La Jolla minutes: solar noon, sunrise and sunset, civil dawn and dusk, the
// minutes the site's theme turns dark, and golden hour's start (the setting sun at 6 degrees).
const events = new Map();
export function sunEvents(dateKey) {
  if (!events.has(dateKey)) {
    const offset = pacificOffset(dateKey);
    const { equation } = orbit(fractionalYear(dateKey, 720));
    const solarNoon = 720 - 4 * LA_JOLLA_SUN.longitude - equation + 60 * offset;
    events.set(
      dateKey,
      Object.freeze({
        dateKey,
        offset,
        solarNoon,
        noonAltitude: solarPosition(dateKey, solarNoon).altitude,
        sunrise: crossing(dateKey, HORIZON_ALTITUDE, solarNoon - 720, solarNoon),
        sunset: crossing(dateKey, HORIZON_ALTITUDE, solarNoon, solarNoon + 720),
        civilDawn: crossing(dateKey, CIVIL_ALTITUDE, solarNoon - 720, solarNoon),
        civilDusk: crossing(dateKey, CIVIL_ALTITUDE, solarNoon, solarNoon + 720),
        darkEnds: crossing(dateKey, DARK_ALTITUDE, solarNoon - 720, solarNoon),
        darkStarts: crossing(dateKey, DARK_ALTITUDE, solarNoon, solarNoon + 720),
        goldenStart: crossing(dateKey, 6, solarNoon, solarNoon + 720),
      })
    );
  }
  return events.get(dateKey);
}

// The visitor's calendar date, as the key the sun is computed for.
export function localDateKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The theme's day on a date: the minutes its modes turn (start: morning, noonStart, noonEnd, end:
// evening) and solar noon. theme.js keeps an exact copy for the head (test/la-jolla-sun.test.mjs).
export function themeDay(dateKey) {
  const day = sunEvents(dateKey);
  return {
    start: day.darkEnds,
    noonStart: day.solarNoon - NOON_HALF_MINUTES,
    noon: day.solarNoon,
    noonEnd: day.solarNoon + NOON_HALF_MINUTES,
    end: day.darkStarts,
  };
}

// The site's time-of-day theme for a minute: evening while the sun is below DARK_ALTITUDE, morning
// from then until two hours before solar noon, noon for four hours, afternoon until dark.
export function themeModeAt(minute, day) {
  const m = ((minute % 1440) + 1440) % 1440;
  if (m < day.darkEnds || m >= day.darkStarts) return "evening";
  if (m < day.solarNoon - NOON_HALF_MINUTES) return "morning";
  if (m < day.solarNoon + NOON_HALF_MINUTES) return "noon";
  return "afternoon";
}

// Everything a scene needs to light a minute: the sun's position, which side of noon it is on, and
// the day's events.
export function sunState(dateKey, minute) {
  const day = sunEvents(dateKey);
  const position = solarPosition(dateKey, minute);
  return { ...position, dateKey, rising: minute < day.solarNoon, noonAltitude: day.noonAltitude, day };
}
