// Time-of-day math for the sun-arc control. Minutes run 0-1439 from midnight, local time.
// The arc is drawn for a reference day, 5:00-20:00 above the horizon and the flatter night arc below,
// with noon at the crown. The site passes the theme's real day (la-jolla-sun.mjs themeDay: La Jolla's
// sun for today, as theme.js turns the theme), and every function maps that day's minutes onto the
// reference day piecewise, so dusk always meets the horizon and solar noon the crown. Without a day,
// the reference day is the clock. Geometry is in the control's SVG units (viewBox 0 0 240 124).
export const DAY_START = 300;
export const DAY_END = 1200;
export const GEOMETRY = Object.freeze({ cx: 120, cy: 82, rx: 100, day: 64, night: 26 });

// The minute each theme mode stands for when it is chosen as a stop, on the reference day.
export const MODE_MINUTE = Object.freeze({ morning: 480, noon: 750, afternoon: 1020, evening: 1320 });

const MODE_LABEL = { morning: "Morning", noon: "Noon", afternoon: "Afternoon", evening: "Evening" };

export const wrapMinute = (minute) => ((Math.round(minute) % 1440) + 1440) % 1440;

// The reference day's turns: morning, noon, solar noon, afternoon, evening.
const REFERENCE = [DAY_START, 660, 750, 900, DAY_END];
const turns = (day) => [day.start, day.noonStart, day.noon, day.noonEnd, day.end];
// Map a minute between two increasing lists of turns (both wrapping at midnight through the night).
function remap(minute, from, to) {
  const m = ((minute % 1440) + 1440) % 1440;
  for (let i = 0; i < 4; i++) {
    if (m >= from[i] && m < from[i + 1]) return to[i] + ((m - from[i]) / (from[i + 1] - from[i])) * (to[i + 1] - to[i]);
  }
  const night = (m - from[4] + 1440) % 1440;
  return (to[4] + (night / (from[0] + 1440 - from[4])) * (to[0] + 1440 - to[4])) % 1440;
}
// A real minute of `day` on the reference day, and back.
export const toReference = (minute, day) => (day ? remap(minute, turns(day), REFERENCE) : minute);
export const fromReference = (minute, day) => (day ? remap(minute, REFERENCE, turns(day)) : minute);

export function modeForMinute(minute, day) {
  if (day) {
    // The day's own turns, compared in whole minutes as theme.js compares them.
    const m = wrapMinute(minute);
    if (m < day.start || m >= day.end) return "evening";
    if (m < day.noonStart) return "morning";
    return m < day.noonEnd ? "noon" : "afternoon";
  }
  const m = wrapMinute(minute);
  if (m >= DAY_START && m < 660) return "morning";
  if (m >= 660 && m < 900) return "noon";
  if (m >= 900 && m < DAY_END) return "afternoon";
  return "evening";
}

// The minute a mode's stop stands for on `day`.
export const modeMinute = (mode, day) => wrapMinute(fromReference(MODE_MINUTE[mode] ?? MODE_MINUTE.noon, day));

export const modeLabel = (mode) => MODE_LABEL[mode] || "Noon";

export const isNight = (minute, day) => {
  const m = wrapMinute(minute);
  return day ? m < day.start || m >= day.end : m < DAY_START || m >= DAY_END;
};

// Where the sun (or moon) sits for a minute: day sweeps left to right over the top, night returns
// right to left underneath.
export function minuteToPoint(minute, g = GEOMETRY, day) {
  // Unrounded on a real day, so every whole minute keeps its own point through the stretched night.
  const m = day ? toReference(wrapMinute(minute), day) : wrapMinute(minute);
  if (m >= DAY_START && m < DAY_END) {
    const angle = Math.PI - ((m - DAY_START) / (DAY_END - DAY_START)) * Math.PI;
    return { x: g.cx + g.rx * Math.cos(angle), y: g.cy - g.day * Math.sin(angle) };
  }
  const night = ((m - DAY_END + 1440) % 1440) / (1440 - (DAY_END - DAY_START));
  const angle = -night * Math.PI;
  return { x: g.cx + g.rx * Math.cos(angle), y: g.cy - g.night * Math.sin(angle) };
}

// The inverse for a pointer in SVG units: above the horizon reads the day arc, below the night arc.
export function pointToMinute(x, y, g = GEOMETRY, day) {
  const dx = (x - g.cx) / g.rx;
  if (y <= g.cy) {
    const angle = Math.atan2(Math.max(0, (g.cy - y) / g.day), dx);
    return wrapMinute(fromReference(DAY_START + ((Math.PI - angle) / Math.PI) * (DAY_END - DAY_START), day));
  }
  const angle = Math.atan2(Math.min(0, (g.cy - y) / g.night), dx);
  return wrapMinute(fromReference(DAY_END + (-angle / Math.PI) * (1440 - (DAY_END - DAY_START)), day));
}

// Sky color through the day, interpolated between keyframes (minute, rgb).
const SKY = [
  [0, [36, 44, 88]],
  [240, [60, 58, 110]],
  [330, [240, 160, 124]],
  [450, [250, 206, 150]],
  [750, [140, 198, 236]],
  [1020, [246, 188, 100]],
  [1170, [238, 128, 90]],
  [1260, [104, 90, 164]],
  [1380, [46, 52, 100]],
  [1440, [36, 44, 88]],
];

export function skyColor(minute, day) {
  const m = wrapMinute(toReference(minute, day));
  for (let i = 1; i < SKY.length; i++) {
    const [m1, c1] = SKY[i];
    const [m0, c0] = SKY[i - 1];
    if (m <= m1) {
      const t = (m - m0) / (m1 - m0);
      return c0.map((value, channel) => Math.round(value + (c1[channel] - value) * t));
    }
  }
  return SKY[0][1];
}

export function formatMinute(minute) {
  const m = wrapMinute(minute);
  const hours = Math.floor(m / 60),
    mins = m % 60;
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(mins).padStart(2, "0")} ${hours < 12 ? "am" : "pm"}`;
}

export const minuteOfDate = (date = new Date()) => date.getHours() * 60 + date.getMinutes();
