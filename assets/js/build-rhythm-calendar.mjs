const DAY_MS = 86_400_000;
const isoDate = (stamp) => new Date(stamp).toISOString().slice(0, 10);
const stampFor = (label) => {
  const stamp = Date.parse(`${label}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(label) || !Number.isFinite(stamp) || isoDate(stamp) !== label) throw new Error("Invalid calendar date");
  return stamp;
};

// The validated source's recorded values are the sole input. Unreported dates
// stay null, including the beginning of 2017 and the unfinished current year.
export function createCommitHistory(source) {
  const contract = source.sources.find((entry) => entry.id === "personal");
  if (!contract) throw new Error("Personal coverage is unavailable");
  const firstStamp = stampFor(contract.starts_on);
  const lastStamp = stampFor(contract.complete_through);
  if (lastStamp < firstStamp) throw new Error("Invalid coverage order");
  const records = new Map();
  for (const point of source.points) {
    if (!point.personal) continue;
    const stamp = stampFor(point.date);
    const value = point.personal.commits;
    if (stamp < firstStamp || stamp > lastStamp || !Number.isSafeInteger(value) || value < 0 || records.has(point.date)) {
      throw new Error("Invalid recorded commit value");
    }
    records.set(point.date, value);
  }
  const canonical = new Map();
  for (const [date, commits] of [...records].sort(([a], [b]) => a.localeCompare(b))) {
    const stamp = stampFor(date);
    const startsOn = isoDate(stamp - new Date(stamp).getUTCDay() * DAY_MS);
    const week = canonical.get(startsOn) ?? { startsOn, commits: 0, knownDays: 0, coveredFrom: date, coveredThrough: date };
    week.commits += commits;
    week.knownDays++;
    week.coveredThrough = date;
    canonical.set(startsOn, week);
  }
  const years = [];
  let carryIn = 0;
  for (let year = new Date(firstStamp).getUTCFullYear(); year <= new Date(lastStamp).getUTCFullYear(); year++) {
    const yearStart = Date.UTC(year, 0, 1),
      yearEnd = Date.UTC(year + 1, 0, 1) - DAY_MS;
    const sunday = yearStart - new Date(yearStart).getUTCDay() * DAY_MS;
    const columnCount = Math.ceil((yearEnd - sunday + DAY_MS) / (7 * DAY_MS));
    const cells = [];
    const weeks = [];
    let cumulative = 0;
    for (let column = 0; column < columnCount; column++) {
      const weekStart = sunday + column * 7 * DAY_MS;
      const days = [];
      for (let row = 0; row < 7; row++) {
        const stamp = weekStart + row * DAY_MS;
        const date = isoDate(stamp);
        const inYear = stamp >= yearStart && stamp <= yearEnd;
        const recorded = inYear && records.has(date);
        const day = {
          date,
          year,
          column,
          row,
          inYear,
          recorded,
          commits: recorded ? records.get(date) : null,
        };
        days.push(day);
        cells.push(day);
      }
      const known = days.filter((day) => day.recorded);
      const commits = known.length ? known.reduce((total, day) => total + day.commits, 0) : null;
      if (commits !== null) cumulative += commits;
      weeks.push({
        year,
        column,
        startsOn: isoDate(weekStart),
        endsOn: isoDate(weekStart + 6 * DAY_MS),
        days,
        recorded: known.length > 0,
        knownDays: known.length,
        yearDays: days.filter((day) => day.inYear).length,
        coveredFrom: known[0]?.date ?? null,
        coveredThrough: known.at(-1)?.date ?? null,
        commits,
        cumulative: known.length ? cumulative : null,
        partial: known.length > 0 && known.length < 7,
      });
    }
    const known = cells.filter((day) => day.recorded);
    const total = known.reduce((sum, day) => sum + day.commits, 0);
    years.push({
      year,
      columnCount,
      cells,
      weeks,
      total,
      carryIn,
      recordedDays: known.length,
      coveredFrom: known[0]?.date ?? null,
      coveredThrough: known.at(-1)?.date ?? null,
      completeYear: known.length === (yearEnd - yearStart) / DAY_MS + 1,
      months: Array.from({ length: 12 }, (_, month) => ({ month, column: Math.floor((Date.UTC(year, month, 1) - sunday) / (7 * DAY_MS)) })),
    });
    carryIn += total;
  }
  return {
    years,
    total: [...records.values()].reduce((total, value) => total + value, 0),
    recordedDays: records.size,
    startsOn: contract.starts_on,
    completeThrough: contract.complete_through,
    completionTimezone: contract.completion_timezone,
    // A leap year beginning on Saturday uses 54 Sunday-start columns. Reserve
    // those display slots without manufacturing dates or values in other years.
    columns: 54,
    canonicalWeeks: [...canonical.values()].map((week) => ({ ...week, partial: week.knownDays < 7 })),
  };
}

export function commitDateEvidence(day, history, today) {
  if (!(day.inRange ?? day.inYear)) return "outside";
  if (day.recorded) return day.commits === 0 ? "zero" : "recorded";
  if (day.date < history.startsOn) return "precoverage";
  return day.date > today ? "future" : "unverified";
}

// A range is one continuous calendar, not a concatenation of annual charts.
// Boundary weeks include only selected dates; earlier recorded work stays in
// carryIn so range growth and lifetime totals remain separate quantities.
export function createCommitRange(history, startYear, endYear) {
  const firstYear = history.years[0].year;
  const lastYear = history.years.at(-1).year;
  if (!Number.isSafeInteger(startYear) || !Number.isSafeInteger(endYear) || startYear < firstYear || endYear > lastYear || startYear > endYear) {
    throw new RangeError("Invalid recorded year range");
  }
  const startsOn = `${startYear}-01-01`,
    endsOn = `${endYear}-12-31`;
  const startStamp = stampFor(startsOn),
    endStamp = stampFor(endsOn);
  const sunday = startStamp - new Date(startStamp).getUTCDay() * DAY_MS;
  const records = new Map(history.years.flatMap((year) => year.cells.filter((day) => day.recorded).map((day) => [day.date, day.commits])));
  const carryIn = history.years.find((year) => year.year === startYear).carryIn;
  const days = [];
  let growth = 0;
  for (let stamp = startStamp; stamp <= endStamp; stamp += DAY_MS) {
    const date = isoDate(stamp),
      recorded = records.has(date),
      commits = recorded ? records.get(date) : null;
    if (recorded) growth += commits;
    days.push({ date, inRange: true, recorded, commits, growth: recorded ? growth : null, lifetime: recorded ? carryIn + growth : null });
  }
  const lookup = new Map(days.map((day) => [day.date, day]));
  const weeks = [];
  const columnCount = Math.ceil((endStamp - sunday + DAY_MS) / (7 * DAY_MS));
  let weeklyGrowth = 0;
  for (let column = 0; column < columnCount; column++) {
    const weekStamp = sunday + column * 7 * DAY_MS;
    const weekDays = Array.from({ length: 7 }, (_, row) => {
      const date = isoDate(weekStamp + row * DAY_MS);
      return lookup.get(date) ?? { date, inRange: false, recorded: false, commits: null, growth: null, lifetime: null };
    });
    const known = weekDays.filter((day) => day.recorded);
    const commits = known.length ? known.reduce((sum, day) => sum + day.commits, 0) : null;
    if (commits !== null) weeklyGrowth += commits;
    weeks.push({
      column,
      startsOn: isoDate(weekStamp),
      endsOn: isoDate(weekStamp + 6 * DAY_MS),
      days: weekDays,
      recorded: known.length > 0,
      knownDays: known.length,
      rangeDays: weekDays.filter((day) => day.inRange).length,
      coveredFrom: known[0]?.date ?? null,
      coveredThrough: known.at(-1)?.date ?? null,
      commits,
      growth: known.length ? weeklyGrowth : null,
      lifetime: known.length ? carryIn + weeklyGrowth : null,
      partial: known.length > 0 && known.length < 7,
    });
  }
  const known = days.filter((day) => day.recorded);
  return {
    startYear,
    endYear,
    startsOn,
    endsOn,
    startStamp,
    endStamp,
    sunday,
    days,
    weeks,
    columnCount,
    years: history.years.filter((year) => year.year >= startYear && year.year <= endYear),
    total: growth,
    carryIn,
    lifetime: carryIn + growth,
    recordedDays: known.length,
    coveredFrom: known[0]?.date ?? null,
    coveredThrough: known.at(-1)?.date ?? null,
  };
}

export function commitViewValue(week, view) {
  if (!week.recorded) return null;
  return view === "cumulative" ? week.cumulative : week.commits;
}

export function coverageFreshness(history, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: history.completionTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value])
  );
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const daysBehind = Math.max(0, (stampFor(today) - stampFor(history.completeThrough)) / DAY_MS);
  return { today, daysBehind, stale: daysBehind > 1 };
}
