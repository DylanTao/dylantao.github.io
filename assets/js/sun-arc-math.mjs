// Time-of-day math for the sun-arc control. Minutes run 0-1439 from midnight, local time.
// Day is 5:00-20:00 on the arc above the horizon (the theme boundaries in theme.js); night is the
// flatter arc below, 20:00-5:00. Geometry is in the control's SVG units (viewBox 0 0 240 124).
export const DAY_START = 300;
export const DAY_END = 1200;
export const GEOMETRY = Object.freeze({ cx: 120, cy: 82, rx: 100, day: 64, night: 26 });

// The minute each theme mode stands for when it is chosen as a stop.
export const MODE_MINUTE = Object.freeze({ morning: 480, noon: 750, afternoon: 1020, evening: 1320 });

const MODE_LABEL = { morning: "Morning", noon: "Noon", afternoon: "Afternoon", evening: "Evening" };

export const wrapMinute = (minute) => ((Math.round(minute) % 1440) + 1440) % 1440;

export function modeForMinute(minute) {
  const m = wrapMinute(minute);
  if (m >= DAY_START && m < 660) return "morning";
  if (m >= 660 && m < 900) return "noon";
  if (m >= 900 && m < DAY_END) return "afternoon";
  return "evening";
}

export const modeLabel = (mode) => MODE_LABEL[mode] || "Noon";

export const isNight = (minute) => {
  const m = wrapMinute(minute);
  return m < DAY_START || m >= DAY_END;
};

// Where the sun (or moon) sits for a minute: day sweeps left to right over the top, night returns
// right to left underneath.
export function minuteToPoint(minute, g = GEOMETRY) {
  const m = wrapMinute(minute);
  if (!isNight(m)) {
    const angle = Math.PI - ((m - DAY_START) / (DAY_END - DAY_START)) * Math.PI;
    return { x: g.cx + g.rx * Math.cos(angle), y: g.cy - g.day * Math.sin(angle) };
  }
  const night = ((m - DAY_END + 1440) % 1440) / (1440 - (DAY_END - DAY_START));
  const angle = -night * Math.PI;
  return { x: g.cx + g.rx * Math.cos(angle), y: g.cy - g.night * Math.sin(angle) };
}

// The inverse for a pointer in SVG units: above the horizon reads the day arc, below the night arc.
export function pointToMinute(x, y, g = GEOMETRY) {
  const dx = (x - g.cx) / g.rx;
  if (y <= g.cy) {
    const angle = Math.atan2(Math.max(0, (g.cy - y) / g.day), dx);
    return wrapMinute(DAY_START + ((Math.PI - angle) / Math.PI) * (DAY_END - DAY_START));
  }
  const angle = Math.atan2(Math.min(0, (g.cy - y) / g.night), dx);
  return wrapMinute(DAY_END + (-angle / Math.PI) * (1440 - (DAY_END - DAY_START)));
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

export function skyColor(minute) {
  const m = wrapMinute(minute);
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
