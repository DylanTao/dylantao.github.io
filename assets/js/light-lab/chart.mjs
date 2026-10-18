// The light lab's race chart (/projects/light-paths/, drawn by page.mjs): each renderer's error
// against the reference over time, on logarithmic axes. On these axes plain Monte Carlo averaging,
// whose error falls as 1/sqrt(time), is a straight line, so the chart draws that slope as a guide
// through path tracing and an all-black frame as a floor for what "no estimate" scores. Pure
// functions only, so node --test can check the geometry and the copy.

export const MINUTE = 60;
// Time axis starts before the first firefly, while both renderers still show an almost black frame.
export const TIME_START = 0.5;
// 10% to 100,000%: path tracing's first fireflies push it past 10,000% in the opening seconds.
export const ERROR_DOMAIN = Object.freeze([0.1, 1000]);
export const MARGIN = Object.freeze({ left: 70, right: 70, top: 14, bottom: 30 });

export function logScale(d0, d1, r0, r1) {
  const l0 = Math.log10(d0);
  const span = Math.log10(d1) - l0;
  return (v) => r0 + ((Math.log10(Math.min(d1, Math.max(d0, v))) - l0) / span) * (r1 - r0);
}

// Ticks on a 1-2-5 time ladder up to the span; the span itself closes the axis when it is a whole
// number of minutes beyond the last tick.
export function timeTicks(span) {
  const ladder = [0.5, 1, 2, 5, 10, 20, 60, 120, 300, 600, 1200, 1800, 3600];
  const ticks = ladder.filter((t) => t >= TIME_START && t <= span + 1e-9);
  if (span / ticks[ticks.length - 1] >= 1.4) ticks.push(span);
  return ticks.map((t) => ({ value: t, label: t < MINUTE ? `${t} s` : `${t / MINUTE} min` }));
}

export function decadeTicks(min, max) {
  const ticks = [];
  for (let e = Math.ceil(Math.log10(min) - 1e-9); e <= Math.floor(Math.log10(max) + 1e-9); e++) ticks.push(10 ** e);
  return ticks;
}

// The relative error of drawing nothing: an all-black frame against the reference grid. An estimate
// above it is further from the reference, by this measure, than an empty image.
export function blankFrameError(reference) {
  const values = reference.luminance;
  let sum = 0;
  let squares = 0;
  for (const v of values) {
    sum += v;
    squares += v * v;
  }
  return sum > 0 ? Math.sqrt(squares / values.length) / (sum / values.length) : 0;
}

export function percent(fraction) {
  return `${Math.round(fraction * 100).toLocaleString("en-US")}%`;
}

// Endpoints of a line through anchor [t, error] along which error falls as 1/sqrt(t).
export function sqrtGuide(anchor, t0, t1) {
  const [ta, ea] = anchor;
  return [
    [t0, ea * Math.sqrt(ta / t0)],
    [t1, ea * Math.sqrt(ta / t1)],
  ];
}

// Seconds a renderer at `error` after `time` would need to reach `target` if its error kept falling
// as 1/sqrt(time); null when it is already there.
export function timeToReach(time, error, target) {
  if (!(time > 0 && error > 0 && target > 0) || error <= target) return null;
  return time * (error / target) ** 2;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

// "a minute", "two minutes", "40 seconds"
export function describeElapsed(seconds) {
  const minutes = seconds / MINUTE;
  if (Math.abs(minutes - Math.round(minutes)) < 0.02 && minutes >= 1) {
    const m = Math.round(minutes);
    return m === 1 ? "a minute" : `${m <= 10 ? WORDS[m] : m} minutes`;
  }
  return `${Math.round(seconds)} seconds`;
}

// Rounded the way people say long waits: "about 25 minutes", "about 3 hours", "about 2 days".
export function describeWait(seconds) {
  const round = (v) => (v < 10 ? Math.round(v) : v < 60 ? Math.round(v / 5) * 5 : Math.round(v / 10) * 10);
  if (seconds < 90) return `about ${round(seconds)} seconds`;
  if (seconds < 90 * MINUTE) return `about ${round(seconds / MINUTE)} minutes`;
  if (seconds < 36 * 3600) return `about ${round(seconds / 3600)} hours`;
  return `about ${round(seconds / 86400)} days`;
}

// The sentence under the chart. `run` is { time, pt, mlt } with errors as fractions.
export function takeaway(run, { recorded = false } = {}) {
  if (!run || run.pt == null || run.mlt == null || !(run.time >= 2)) return "";
  const elapsed = describeElapsed(run.time);
  const lead = recorded ? "In my recorded run, path tracing" : "Path tracing";
  if (run.mlt >= run.pt) return `${recorded ? "In my recorded run, p" : "P"}ath tracing is ahead after ${elapsed}.`;
  const wait = timeToReach(run.time, run.pt, run.mlt);
  return `${lead} would need ${describeWait(wait)} to get as close to the reference as Metropolis did in ${elapsed}, if its error kept falling as 1/√time.`;
}

const fmt = (v) => v.toFixed(1);

// SVG markup for the chart. `live` and `recorded` map "pt" and "mlt" to [[seconds, error], ...];
// `blank` is the all-black frame's error. Returns the inner markup and the viewBox size.
export function chartMarkup({ width = 600, height = 240, span = MINUTE, live = {}, recorded = null, blank = null, note = "" }) {
  const left = MARGIN.left;
  const right = width - MARGIN.right;
  const top = MARGIN.top;
  const bottom = height - MARGIN.bottom;
  const x = logScale(TIME_START, span, left, right);
  const y = logScale(ERROR_DOMAIN[0], ERROR_DOMAIN[1], bottom, top);
  const out = ['<g class="light-lab-axis">'];
  for (const e of decadeTicks(...ERROR_DOMAIN))
    out.push(
      `<line x1="${left}" x2="${right}" y1="${fmt(y(e))}" y2="${fmt(y(e))}"/><text x="${left - 8}" y="${fmt(y(e) + 4)}" text-anchor="end">${percent(e)}</text>`
    );
  for (const tick of timeTicks(span))
    out.push(
      `<line class="light-lab-tick" x1="${fmt(x(tick.value))}" x2="${fmt(x(tick.value))}" y1="${bottom}" y2="${bottom + 4}"/><text x="${fmt(x(tick.value))}" y="${height - 9}" text-anchor="middle">${tick.label}</text>`
    );
  out.push("</g>");
  const inView = (points) => points.filter(([s]) => s >= TIME_START && s <= span + 1e-9);
  const polyline = (points) =>
    inView(points)
      .map(([s, e]) => `${fmt(x(s))},${fmt(y(e))}`)
      .join(" ");
  // Reference-line labels go on top of the data lines, on a halo, so a steep line never cuts them.
  const labels = [];
  if (blank) {
    out.push(`<line class="light-lab-blank" x1="${left}" x2="${right}" y1="${fmt(y(blank))}" y2="${fmt(y(blank))}"/>`);
    labels.push(`<text class="light-lab-chart-label" x="${left + 6}" y="${fmt(y(blank) - 5)}">all-black frame</text>`);
  }
  const hasLive = ["pt", "mlt"].some((m) => inView(live[m] ?? []).length > 1);
  const guideSource = hasLive && inView(live.pt ?? []).some(([s]) => s >= 2) ? inView(live.pt) : recorded ? recorded.pt : null;
  if (guideSource && guideSource.length) {
    const anchor = guideSource[guideSource.length - 1];
    const [[t0, e0], [t1, e1]] = sqrtGuide(anchor, TIME_START, span);
    out.push(`<line class="light-lab-guide" x1="${fmt(x(t0))}" y1="${fmt(y(e0))}" x2="${fmt(x(t1))}" y2="${fmt(y(e1))}"/>`);
    const labelT = TIME_START * 1.25;
    const labelE = anchor[1] * Math.sqrt(anchor[0] / labelT);
    labels.push(`<text class="light-lab-chart-label" x="${fmt(x(labelT))}" y="${fmt(Math.max(top + 10, y(labelE) - 7))}">∝ 1/√time</text>`);
  }
  if (recorded)
    for (const method of ["pt", "mlt"])
      out.push(`<polyline class="light-lab-line light-lab-line--${method} light-lab-line--recorded" points="${polyline(recorded[method])}"/>`);
  for (const method of ["pt", "mlt"]) {
    const points = inView(live[method] ?? []);
    if (points.length > 1) out.push(`<polyline class="light-lab-line light-lab-line--${method}" points="${polyline(points)}"/>`);
  }
  out.push(...labels);
  // Direct labels at the end of the lines being read: the live run, or the recording before one.
  const labelled = hasLive ? live : recorded;
  if (labelled)
    for (const method of ["pt", "mlt"]) {
      const points = inView(labelled[method] ?? []);
      if (!points.length) continue;
      const [s, e] = points[points.length - 1];
      out.push(
        `<circle class="light-lab-end light-lab-end--${method}" cx="${fmt(x(s))}" cy="${fmt(y(e))}" r="3.5"/><text class="light-lab-end-label" x="${fmt(x(s) + 8)}" y="${fmt(y(e) + 4)}">${percent(e)}</text>`
      );
    }
  if (note) out.push(`<text class="light-lab-chart-note" x="${left + 14}" y="${top + 26}">${note}</text>`);
  return { markup: out.join(""), viewBox: `0 0 ${width} ${height}` };
}
