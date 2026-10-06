import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createCommitHistory, createCommitRange, createCalendarBlocks } from "../assets/js/build-rhythm-calendar.mjs";
import {
  historyGeometry,
  calendarGeometry,
  weeklyGeometry,
  interpolateGeometry,
  interpolateHistoryTransform,
  projectHistory,
} from "../assets/js/build-rhythm-geometry.mjs";

const source = JSON.parse(fs.readFileSync(new URL("../_data/code_activity.json", import.meta.url), "utf8"));
const points = source.points.filter((point) => point.personal),
  cutoff = points.at(-1).date;
const rawTotal = (start, end) =>
  points
    .filter((point) => Number(point.date.slice(0, 4)) >= start && Number(point.date.slice(0, 4)) <= end)
    .reduce((sum, point) => sum + point.personal.commits, 0);
const rawCount = (date) => points.find((point) => point.date === date)?.personal.commits ?? null;
const nextDate = new Date(Date.parse(cutoff) + 86_400_000).toISOString().slice(0, 10);
const weekStart = new Date(cutoff);
weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
const lastWeek = points.filter((point) => point.date >= weekStart.toISOString().slice(0, 10));
const history = createCommitHistory(source);
const year = (value) => history.years.find((row) => row.year === value);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);

test("each mobile half owns every date once, including leap day and the June/July seam", () => {
  for (const value of [2017, 2020, 2026]) {
    const row = year(value),
      blocks = createCalendarBlocks(row, true);
    const days = blocks.flatMap((block) => block.days);
    assert.equal(days.length, value === 2020 ? 366 : 365);
    assert.equal(new Set(days.map((day) => day.date)).size, days.length);
    assert.equal(
      days.reduce((sum, day) => sum + (day.commits ?? 0), 0),
      row.total
    );
    assert.equal(blocks[0].days.at(-1).date, `${value}-06-30`);
    assert.equal(blocks[1].days[0].date, `${value}-07-01`);
    assert.ok(days.every((day) => day.inYear));
    for (const block of blocks) assert.ok(block.days.every((day) => day.column >= 0 && day.column < block.columns));
  }
});

test("the headline and cumulative endpoint share the selected-range metric", () => {
  for (const [start, end] of [
    [2017, 2026],
    [2026, 2026],
    [2024, 2025],
    [2017, 2017],
  ]) {
    const total = rawTotal(start, end);
    const range = createCommitRange(history, start, end),
      geometry = historyGeometry(range, 1000, 220);
    assert.equal(geometry.points.at(-1).value, total);
    assert.equal(range.total, total);
    assert.equal(geometry.points[0].date, range.coveredFrom);
    assert.equal(geometry.points.at(-1).date, range.coveredThrough);
    assert.equal(geometry.points.length, range.recordedDays);
    assert.ok(geometry.points.every((point) => point.date <= history.completeThrough));
    for (const point of projectHistory(geometry.points, geometry.transform)) {
      close(point.x, geometry.x(point.date));
      close(point.y, geometry.y(point.value));
    }
  }
});

test("full-history date spacing has no annual reset or extension beyond the verified cutoff", () => {
  const geometry = historyGeometry(createCommitRange(history, 2017, 2026), 1000, 220);
  assert.equal(geometry.points.length, points.length);
  const lookup = new Map(geometry.points.map((point) => [point.date, point]));
  const gap = geometry.points.at(-1).x - geometry.points.at(-2).x;
  close(lookup.get("2024-01-01").x - lookup.get("2023-12-31").x, gap);
  assert.ok(lookup.get(cutoff).x < geometry.plot.right);
  assert.equal(lookup.has(nextDate), false);
});

test("an interrupted range tween starts exactly at its painted affine date/value scale", () => {
  const full = historyGeometry(createCommitRange(history, 2017, 2026), 1000, 220);
  const single = historyGeometry(createCommitRange(history, 2026, 2026), 1000, 220);
  const partial = interpolateHistoryTransform(full.transform, single.transform, 0.43);
  const latest = historyGeometry(createCommitRange(history, 2024, 2026), 1000, 220);
  const restarted = interpolateHistoryTransform(partial, latest.transform, 0);
  assert.deepEqual(restarted, partial);
  const common = latest.points.find((point) => point.date === cutoff);
  close(projectHistory([common], restarted)[0].x, projectHistory([common], partial)[0].x);
  close(projectHistory([common], restarted)[0].y, projectHistory([common], partial)[0].y);
  assert.deepEqual(interpolateHistoryTransform(partial, latest.transform, 1), latest.transform);
});

test("new dates introduced by a retarget use the current scale instead of the obsolete target", () => {
  const one = historyGeometry(createCommitRange(history, 2026, 2026), 1000, 220);
  const target = historyGeometry(createCommitRange(history, 2017, 2026), 1000, 220);
  const newlyVisible = target.points.find((point) => point.date === "2025-01-01");
  const seeded = projectHistory([newlyVisible], one.transform)[0];
  assert.notEqual(seeded.x, newlyVisible.x);
  close(seeded.x, one.x(newlyVisible.date));
  const settled = projectHistory([newlyVisible], target.transform)[0];
  close(settled.x, newlyVisible.x);
  close(settled.y, newlyVisible.y);
});

test("desktop and split mobile calendars retain source evidence and stay inside their fixed slot", () => {
  for (const [width, height, split] of [
    [1000, 180, false],
    [266, 260, true],
    [196, 260, true],
  ]) {
    const geometry = calendarGeometry(year(2026), width, height, split);
    assert.equal(geometry.blocks, split ? 2 : 1);
    assert.equal(geometry.marks.length, 365);
    assert.equal(geometry.marks.find((mark) => mark.date === cutoff).day.commits, rawCount(cutoff));
    assert.equal(geometry.marks.find((mark) => mark.date === nextDate).day.commits, null);
    assert.ok(
      geometry.marks.every(
        (mark) => mark.width > 0 && mark.height > 0 && mark.x >= 0 && mark.x + mark.width <= width && mark.y + mark.height <= height
      )
    );
  }
});

test("wide daily calendars span the detail slot while dates stay square and month labels stay aligned", () => {
  for (const width of [1500, 1920, 2400]) {
    const geometry = calendarGeometry(year(2026), width, 180, false);
    const rightmost = Math.max(...geometry.marks.map((mark) => mark.x + mark.width));
    assert.ok(rightmost >= width * 0.97, `calendar leaves ${width - rightmost}px unused on the right`);
    assert.ok(geometry.marks.every((mark) => mark.width === mark.height && mark.y + mark.height <= 180));
    for (const [month, label] of geometry.labels.slice(0, 12).entries()) {
      const firstDate = `2026-${String(month + 1).padStart(2, "0")}-01`;
      close(label.x, geometry.marks.find((mark) => mark.date === firstDate).x);
    }
  }
});

test("weekly detail conserves one year's totals and preserves the last partial week", () => {
  const geometry = weeklyGeometry(year(2026), 1000, 180);
  assert.equal(
    geometry.marks.reduce((sum, mark) => sum + (mark.week.commits ?? 0), 0),
    rawTotal(2026, 2026)
  );
  const latest = geometry.marks.find((mark) => mark.week.startsOn === weekStart.toISOString().slice(0, 10));
  assert.equal(
    latest.week.commits,
    lastWeek.reduce((sum, point) => sum + point.personal.commits, 0)
  );
  assert.equal(latest.week.knownDays, lastWeek.length);
  assert.equal(latest.date, cutoff);
  assert.equal(geometry.marks.at(-1).week.commits, null);
});

test("date-keyed detail retargeting retains the partially painted positions and latest payload", () => {
  const daily = calendarGeometry(year(2026), 1000, 180, false).marks;
  const weekly = weeklyGeometry(year(2026), 1000, 180).marks;
  const partial = interpolateGeometry(daily, weekly, 0.37);
  const restarted = interpolateGeometry(partial, daily, 0);
  const date = "2026-09-27",
    old = partial.find((mark) => mark.key === date),
    next = restarted.find((mark) => mark.key === date);
  close(next.x, old.x);
  close(next.y, old.y);
  close(next.width, old.width);
  close(next.height, old.height);
  assert.equal(next.day.commits, rawCount(date));
  assert.equal(next.week, undefined);
  const followingDate = restarted.find((mark) => mark.key === "2026-09-28");
  close(followingDate.x, old.x);
  assert.equal(followingDate.day.commits, rawCount("2026-09-28"));
  assert.deepEqual(interpolateGeometry(partial, daily, 1), daily);
});
