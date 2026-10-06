import { createCalendarBlocks } from "./build-rhythm-calendar.mjs";

const DAY_MS = 86_400_000;
const stamp = (date) => Date.parse(`${date}T00:00:00Z`);
export const niceMaximum = (value) => {
  const power = 10 ** Math.floor(Math.log10(Math.max(1, value)));
  return [1, 2, 2.5, 5, 10].find((step) => step * power >= value) * power;
};

export function historyGeometry(range, width, height) {
  const plot = { left: 43, right: width - 7, top: 12, bottom: height - 27 };
  const maximum = niceMaximum(range.total);
  const x = (date) => plot.left + ((stamp(date) - range.startStamp) / (range.endStamp + DAY_MS - range.startStamp)) * (plot.right - plot.left);
  const y = (value) => plot.bottom - (value / maximum) * (plot.bottom - plot.top);
  const xScale = (plot.right - plot.left) / (range.endStamp + DAY_MS - range.startStamp);
  const yScale = -(plot.bottom - plot.top) / maximum;
  return {
    plot,
    maximum,
    domain: { start: range.startStamp, end: range.endStamp + DAY_MS, maximum },
    transform: { xScale, xOffset: plot.left - range.startStamp * xScale, yScale, yOffset: plot.bottom - range.carryIn * yScale },
    points: range.days
      .filter((day) => day.recorded)
      .map((day) => ({ key: day.date, date: day.date, value: day.growth, lifetime: day.lifetime, x: x(day.date), y: y(day.growth) })),
    x,
    y,
  };
}

export function calendarGeometry(year, width, height, split) {
  const blocks = createCalendarBlocks(year, split);
  const left = 24,
    right = width - 3;
  const blockHeight = height / blocks.length;
  const marks = [],
    labels = [];
  blocks.forEach((block, index) => {
    const unit = Math.min((right - left) / block.columns, (blockHeight - 30) / 7);
    const gap = Math.max(1.5, Math.min(2.5, unit * 0.13));
    const top = index * blockHeight + 22;
    for (const day of block.days)
      marks.push({ key: day.date, date: day.date, day, x: left + day.column * unit, y: top + day.row * unit, width: unit - gap, height: unit - gap });
    for (const { month, column } of block.months)
      labels.push({
        text: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month],
        x: left + column * unit,
        y: top - 9,
      });
    for (const [row, text] of [
      [1, "M"],
      [3, "W"],
      [5, "F"],
    ])
      labels.push({ text, x: 2, y: top + row * unit + unit * 0.7 });
  });
  return { marks, labels, blocks: blocks.length };
}

export function weeklyGeometry(year, width, height) {
  const plot = { left: 24, right: width - 3, top: 22, bottom: height - 21 };
  const maximum = niceMaximum(Math.max(...year.weeks.map((week) => week.commits ?? 0)));
  const slot = (plot.right - plot.left) / year.columnCount;
  return {
    maximum,
    blocks: 1,
    marks: year.weeks.map((week) => ({
      key: week.days.find((day) => day.inYear).date,
      date: week.coveredThrough ?? week.days.find((day) => day.inYear).date,
      week,
      x: plot.left + week.column * slot,
      y: week.recorded ? plot.bottom - (week.commits / maximum) * (plot.bottom - plot.top) : plot.top,
      width: Math.max(1, slot - Math.max(1.5, slot * 0.17)),
      height: week.recorded ? Math.max(2, (week.commits / maximum) * (plot.bottom - plot.top)) : plot.bottom - plot.top,
    })),
    labels: year.months
      .filter(({ month }) => width >= 550 || month % 3 === 0)
      .map(({ month, column }) => ({
        text: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month],
        x: plot.left + column * slot,
        y: 12,
      })),
  };
}

// Callers keep the last painted frame. Retargeting starts there, including a
// partially completed transition; it never snaps to an obsolete target.
export function interpolateGeometry(from, target, progress) {
  const previous = new Map(from.map((mark) => [mark.key, mark]));
  const t = Math.max(0, Math.min(1, progress));
  if (t === 1) return target.map((mark) => ({ ...mark }));
  return target.map((mark) => {
    const old = previous.get(mark.key) ?? from.find((entry) => entry.week?.days.some((day) => day.date === mark.key)) ?? mark;
    const next = { ...mark };
    for (const property of ["x", "y", "width", "height"]) {
      if (property in mark) next[property] = old[property] + (mark[property] - old[property]) * t;
    }
    return next;
  });
}

// Affine date/value scales preserve every date's visual position when a range
// expands or contracts, including dates introduced during an interrupted tween.
export function interpolateHistoryTransform(from, target, progress) {
  const t = Math.max(0, Math.min(1, progress));
  if (t === 1) return { ...target };
  return Object.fromEntries(Object.keys(target).map((key) => [key, from[key] + (target[key] - from[key]) * t]));
}

export function projectHistory(points, transform) {
  return points.map((point) => ({
    ...point,
    x: stamp(point.date) * transform.xScale + transform.xOffset,
    y: point.lifetime * transform.yScale + transform.yOffset,
  }));
}
