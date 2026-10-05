import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  createCommitHistory,
  createCommitRange,
  commitViewValue,
  commitDateEvidence,
  coverageFreshness,
} from "../assets/js/build-rhythm-calendar.mjs";

const DAY_MS = 86_400_000;
const fixture = (startsOn, completeThrough, count = () => 0) => {
  const points = [];
  for (let stamp = Date.parse(`${startsOn}T00:00:00Z`); stamp <= Date.parse(`${completeThrough}T00:00:00Z`); stamp += DAY_MS) {
    const date = new Date(stamp).toISOString().slice(0, 10);
    points.push({ date, personal: { commits: count(date) } });
  }
  return {
    sources: [{ id: "personal", starts_on: startsOn, complete_through: completeThrough, completion_timezone: "America/Los_Angeles" }],
    points,
  };
};

test("actual verified history includes 2017 and conserves every personal commit", () => {
  const source = JSON.parse(fs.readFileSync(new URL("../_data/code_activity.json", import.meta.url), "utf8"));
  const history = createCommitHistory(source);
  assert.equal(history.startsOn, "2017-08-31");
  assert.equal(history.completeThrough, "2026-09-28");
  assert.deepEqual(
    history.years.map((row) => row.year),
    Array.from({ length: 10 }, (_, i) => 2017 + i)
  );
  const personalTotal = source.points.reduce((total, point) => total + (point.personal?.commits ?? 0), 0);
  assert.equal(history.total, personalTotal);
  assert.equal(history.total, 20793);
  assert.equal(history.recordedDays, 3316);
  assert.equal(history.columns, 54);
  assert.equal(history.years[0].total, 0);
  assert.equal(history.years.at(-1).total, 19473);
  assert.equal(
    history.years.reduce((total, year) => total + year.total, 0),
    personalTotal
  );
  for (const year of history.years) {
    assert.equal(
      year.weeks.reduce((total, week) => total + (week.commits ?? 0), 0),
      year.total
    );
    assert.equal(year.weeks.filter((week) => week.recorded).at(-1).cumulative, year.total);
  }
});

test("verified zero differs from dates before coverage and after cutoff", () => {
  const history = createCommitHistory(fixture("2017-08-31", "2017-09-02"));
  const year = history.years[0];
  const lookup = (date) => year.cells.find((day) => day.date === date);
  assert.equal(lookup("2017-08-30").commits, null);
  assert.equal(lookup("2017-08-31").commits, 0);
  assert.equal(lookup("2017-08-31").recorded, true);
  assert.equal(lookup("2017-09-03").commits, null);
  assert.equal(year.weeks.find((week) => week.startsOn === "2017-08-27").knownDays, 3);
  const unknown = year.weeks.find((week) => week.startsOn === "2017-09-03");
  assert.equal(commitViewValue(unknown, "weekly"), null);
  assert.equal(commitViewValue(unknown, "cumulative"), null);
});

test("calendar-year boundaries neither import nor double-count neighboring-year dates", () => {
  const history = createCommitHistory(fixture("2017-12-31", "2018-01-03", (date) => (date === "2017-12-31" ? 5 : 2)));
  assert.equal(history.years[0].total, 5);
  assert.equal(history.years[1].total, 6);
  assert.equal(history.total, 11);
  const first2018 = history.years[1].weeks[0];
  assert.equal(first2018.startsOn, "2017-12-31");
  assert.equal(first2018.days[0].inYear, false);
  assert.equal(first2018.days[0].commits, null);
  assert.equal(first2018.commits, 6);
  assert.equal(first2018.knownDays, 3);
  assert.equal(first2018.cumulative, 6);
});

test("leap day stays in the correct Sunday-start column and year total", () => {
  const year = createCommitHistory(fixture("2020-01-01", "2020-12-31", () => 1)).years[0];
  assert.equal(year.recordedDays, 366);
  assert.equal(year.total, 366);
  assert.equal(year.completeYear, true);
  const leapDay = year.cells.find((day) => day.date === "2020-02-29");
  assert.equal(leapDay.row, 6);
  assert.equal(year.weeks[leapDay.column].startsOn, "2020-02-23");
  assert.equal(year.weeks[leapDay.column].commits, 7);
});

test("a rare 54-column calendar is retained without clipping its last days", () => {
  const year = createCommitHistory(fixture("2028-01-01", "2028-12-31", () => 1)).years[0];
  assert.equal(year.columnCount, 54);
  assert.equal(year.total, 366);
  assert.equal(year.cells.find((day) => day.date === "2028-12-31").commits, 1);
});

test("partial current week reports only known dates and never forecasts cumulative values", () => {
  const year = createCommitHistory(fixture("2026-09-27", "2026-09-28", (date) => (date.endsWith("27") ? 401 : 569))).years[0];
  const week = year.weeks.find((row) => row.startsOn === "2026-09-27");
  assert.equal(week.commits, 970);
  assert.equal(week.knownDays, 2);
  assert.equal(week.partial, true);
  assert.equal(week.coveredThrough, "2026-09-28");
  assert.equal(week.days[2].commits, null);
  assert.equal(commitViewValue(week, "cumulative"), 970);
  assert.equal(
    commitViewValue(
      year.weeks.find((row) => row.startsOn === "2026-10-04"),
      "cumulative"
    ),
    null
  );
});

test("independent intern calendar values never enter the personal history metric", () => {
  const source = fixture("2026-09-01", "2026-09-03", () => 2);
  source.sources.push({ id: "intern" });
  source.points.forEach((point) => (point.intern = { commits: 10000 }));
  assert.equal(createCommitHistory(source).total, 6);
});

test("duplicate dates and invalid values fail rather than distorting counts", () => {
  const source = fixture("2026-09-01", "2026-09-01", () => 2);
  for (const value of [-1, 0.2, null, NaN, Infinity]) {
    const invalid = structuredClone(source);
    invalid.points[0].personal.commits = value;
    assert.throws(() => createCommitHistory(invalid));
  }
  source.points.push(structuredClone(source.points[0]));
  assert.throws(() => createCommitHistory(source));
});

test("freshness uses the source completion calendar across Pacific midnight", () => {
  const history = createCommitHistory(fixture("2026-09-28", "2026-09-28"));
  const before = coverageFreshness(history, new Date("2026-10-05T06:59:59Z"));
  const after = coverageFreshness(history, new Date("2026-10-05T07:00:00Z"));
  assert.equal(before.today, "2026-10-04");
  assert.equal(before.daysBehind, 6);
  assert.equal(after.today, "2026-10-05");
  assert.equal(after.daysBehind, 7);
  assert.equal(after.stale, true);
});

test("canonical Sunday weeks reconcile the actual source independently of split display years", () => {
  const source = JSON.parse(fs.readFileSync(new URL("../_data/code_activity.json", import.meta.url), "utf8"));
  const history = createCommitHistory(source);
  assert.equal(history.canonicalWeeks.length, 475);
  assert.equal(
    history.canonicalWeeks.reduce((total, week) => total + week.commits, 0),
    20793
  );
  assert.equal(history.canonicalWeeks.at(-1).startsOn, "2026-09-27");
  assert.equal(history.canonicalWeeks.at(-1).commits, 970);
  assert.equal(history.canonicalWeeks.at(-1).knownDays, 2);
  assert.equal(history.canonicalWeeks.at(-1).partial, true);
});

test("one cross-year canonical week reconciles both display segments without double counting", () => {
  const history = createCommitHistory(fixture("2017-12-31", "2018-01-03", (date) => (date === "2017-12-31" ? 5 : 2)));
  assert.equal(history.canonicalWeeks.length, 1);
  assert.equal(history.canonicalWeeks[0].commits, 11);
  const segments = history.years.flatMap((year) => year.weeks.filter((week) => week.startsOn === "2017-12-31"));
  assert.deepEqual(
    segments.map((week) => week.commits),
    [5, 6]
  );
  assert.equal(
    segments.reduce((sum, week) => sum + week.commits, 0),
    history.canonicalWeeks[0].commits
  );
});

test("2026 carry-in plus within-year accumulation reconciles the exact lifetime metric", () => {
  const source = JSON.parse(fs.readFileSync(new URL("../_data/code_activity.json", import.meta.url), "utf8"));
  const history = createCommitHistory(source);
  const year = history.years.find((row) => row.year === 2026);
  assert.equal(year.carryIn, 1320);
  assert.equal(year.total, 19473);
  assert.equal(year.carryIn + year.weeks.filter((week) => week.recorded).at(-1).cumulative, 20793);
});

test("zero, precoverage, unverified, future and outside-year slots stay distinct", () => {
  const history = createCommitHistory(fixture("2017-08-31", "2017-09-02", (date) => (date.endsWith("02") ? 3 : 0)));
  const day = (date) => history.years[0].cells.find((row) => row.date === date);
  assert.equal(commitDateEvidence(day("2017-08-30"), history, "2017-09-04"), "precoverage");
  assert.equal(commitDateEvidence(day("2017-08-31"), history, "2017-09-04"), "zero");
  assert.equal(commitDateEvidence(day("2017-09-02"), history, "2017-09-04"), "recorded");
  assert.equal(commitDateEvidence(day("2017-09-03"), history, "2017-09-04"), "unverified");
  assert.equal(commitDateEvidence(day("2017-09-05"), history, "2017-09-04"), "future");
  assert.equal(commitDateEvidence(day("2018-01-01"), history, "2017-09-04"), "outside");
});

test("the full continuous range conserves dates, weeks and every lifetime checkpoint", () => {
  const source = JSON.parse(fs.readFileSync(new URL("../_data/code_activity.json", import.meta.url), "utf8"));
  const history = createCommitHistory(source),
    range = createCommitRange(history, 2017, 2026);
  assert.equal(range.days.length, 3652);
  assert.equal(range.recordedDays, 3316);
  assert.equal(range.total, 20793);
  assert.equal(range.carryIn, 0);
  assert.equal(range.lifetime, 20793);
  assert.equal(range.coveredFrom, "2017-08-31");
  assert.equal(range.coveredThrough, "2026-09-28");
  assert.equal(new Set(range.days.map((day) => day.date)).size, range.days.length);
  assert.equal(range.weeks.filter((week) => week.recorded).length, 475);
  assert.equal(
    range.weeks.reduce((sum, week) => sum + (week.commits ?? 0), 0),
    range.total
  );
  const lookup = new Map(range.days.map((day) => [day.date, day]));
  [0, 17, 17, 24, 279, 485, 569, 976, 1320].forEach((value, index) => {
    assert.equal(lookup.get(`${2017 + index}-12-31`).lifetime, value);
  });
  assert.equal(lookup.get("2026-09-28").lifetime, 20793);
  assert.equal(lookup.get("2026-09-29").lifetime, null);
});

test("selected ranges distinguish range additions from earlier carry and lifetime totals", () => {
  const source = JSON.parse(fs.readFileSync(new URL("../_data/code_activity.json", import.meta.url), "utf8"));
  const history = createCommitHistory(source);
  for (const [start, end, total, carry, lifetime] of [
    [2026, 2026, 19473, 1320, 20793],
    [2024, 2025, 751, 569, 1320],
    [2024, 2026, 20224, 569, 20793],
  ]) {
    const range = createCommitRange(history, start, end);
    assert.equal(range.total, total);
    assert.equal(range.carryIn, carry);
    assert.equal(range.lifetime, lifetime);
    assert.equal(range.days.findLast((day) => day.recorded).growth, total);
    assert.equal(range.days.findLast((day) => day.recorded).lifetime, lifetime);
    assert.equal(
      range.weeks.reduce((sum, week) => sum + (week.commits ?? 0), 0),
      total
    );
  }
});

test("one range week spans a year boundary exactly once and clips only its outside dates", () => {
  const history = createCommitHistory(fixture("2017-12-31", "2018-01-03", (date) => (date === "2017-12-31" ? 5 : 2)));
  const full = createCommitRange(history, 2017, 2018);
  const joint = full.weeks.find((week) => week.startsOn === "2017-12-31");
  assert.equal(joint.commits, 11);
  assert.equal(joint.knownDays, 4);
  assert.equal(full.weeks.filter((week) => week.startsOn === joint.startsOn).length, 1);
  const clipped = createCommitRange(history, 2018, 2018);
  assert.equal(clipped.weeks[0].commits, 6);
  assert.equal(clipped.weeks[0].rangeDays, 6);
  assert.equal(clipped.weeks[0].days[0].inRange, false);
  assert.equal(clipped.weeks[0].days[0].commits, null);
  assert.equal(clipped.total, 6);
  assert.equal(clipped.carryIn, 5);
  assert.equal(clipped.lifetime, 11);
});

test("continuous range days retain leap dates, verified zero and missing or future evidence", () => {
  const source = fixture("2020-02-28", "2021-01-02", () => 1);
  source.points = source.points.filter((point) => point.date !== "2020-03-01");
  source.points[0].personal.commits = 0;
  const history = createCommitHistory(source),
    range = createCommitRange(history, 2020, 2021);
  const lookup = (date) => range.days.find((day) => day.date === date);
  assert.equal(lookup("2020-02-29").commits, 1);
  assert.equal(commitDateEvidence(lookup("2020-02-27"), history, "2021-01-04"), "precoverage");
  assert.equal(commitDateEvidence(lookup("2020-02-28"), history, "2021-01-04"), "zero");
  assert.equal(commitDateEvidence(lookup("2020-03-01"), history, "2021-01-04"), "unverified");
  assert.equal(lookup("2020-03-01").growth, null);
  assert.equal(commitDateEvidence(lookup("2021-01-03"), history, "2021-01-04"), "unverified");
  assert.equal(commitDateEvidence(lookup("2021-01-05"), history, "2021-01-04"), "future");
  assert.equal(lookup("2021-01-05").lifetime, null);
});

test("a range's last partial week stops at the exact verified source date", () => {
  const source = JSON.parse(fs.readFileSync(new URL("../_data/code_activity.json", import.meta.url), "utf8"));
  const range = createCommitRange(createCommitHistory(source), 2024, 2026);
  const last = range.weeks.findLast((week) => week.recorded);
  assert.equal(last.startsOn, "2026-09-27");
  assert.equal(last.commits, 970);
  assert.equal(last.knownDays, 2);
  assert.equal(last.partial, true);
  assert.equal(last.coveredThrough, "2026-09-28");
  assert.equal(last.lifetime, 20793);
  assert.equal(last.days[2].lifetime, null);
  assert.equal(range.weeks.at(-1).lifetime, null);
});

test("range bounds must be ordered whole years within the verified history", () => {
  const history = createCommitHistory(fixture("2017-08-31", "2026-09-28"));
  for (const [start, end] of [
    [2016, 2026],
    [2017, 2027],
    [2026, 2017],
    [2017.5, 2026],
    ["2017", 2026],
    [2017, NaN],
  ]) {
    assert.throws(() => createCommitRange(history, start, end), RangeError);
  }
});
