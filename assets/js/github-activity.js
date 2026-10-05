(async () => {
  const activityScriptBase = new URL(".", document.currentScript.src);
  const root = document.querySelector("[data-github-activity]");
  const dataNode = document.getElementById("code-activity-data");
  if (!root || !dataNode) return;
  const DAY_MS = 86_400_000;
  // Calendar-only labels use a UTC-midnight Date as a stable arithmetic and
  // formatting surrogate. This does not turn a source-reported label into a
  // shared UTC interval.
  const calendarDate = (value) => new Date(`${value}T00:00:00Z`);
  const calendarLabelFor = (instant, timeZone) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(instant)
        .filter(({ type }) => type !== "literal")
        .map(({ type, value }) => [type, value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const isIsoDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = calendarDate(value);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  const hasExactKeys = (value, keys) =>
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
  // `commits` is each source's reported total; Personal counts attributable
  // commits on eligible branches. `authored_commits` excludes merges and deploys.
  // Schema 6 retires line statistics.
  const validSourceCounts = (entry, schema) =>
    hasExactKeys(entry, schema === 6 ? ["commits", "authored_commits"] : ["commits", "authored_commits", "additions", "deletions"]) &&
    Object.values(entry).every((value) => Number.isSafeInteger(value) && value >= 0) &&
    entry.authored_commits <= entry.commits &&
    (schema === 6 || entry.authored_commits > 0 || (entry.additions === 0 && entry.deletions === 0));
  const codeActivitySourceContracts = {
    personal: {
      label: "Personal",
      basis: "github_contribution_parity",
      dateBasis: "github_profile_author_date",
      completionTimeZone: "America/Los_Angeles",
      startsOn: "2017-08-31",
    },
    intern: {
      label: "Intern work",
      basis: "reported_daily_summary",
      dateBasis: "utc_calendar_date",
      completionTimeZone: "UTC",
    },
  };
  const validSourceDescriptor = (descriptor) => {
    if (
      !hasExactKeys(descriptor, ["id", "label", "basis", "date_basis", "completion_timezone", "starts_on", "complete_through"]) ||
      typeof descriptor.id !== "string" ||
      !/^[a-z0-9-]{1,24}$/.test(descriptor.id) ||
      !isIsoDate(descriptor.starts_on) ||
      !isIsoDate(descriptor.complete_through) ||
      calendarDate(descriptor.starts_on) > calendarDate(descriptor.complete_through)
    )
      return false;
    const contract = codeActivitySourceContracts[descriptor.id];
    return (
      Boolean(contract) &&
      descriptor.label === contract.label &&
      descriptor.basis === contract.basis &&
      descriptor.date_basis === contract.dateBasis &&
      descriptor.completion_timezone === contract.completionTimeZone &&
      (!contract.startsOn || descriptor.starts_on === contract.startsOn)
    );
  };
  const validCodeActivitySource = (candidate) => {
    if (
      !hasExactKeys(candidate, ["schema", "updated_on", "date_basis", "scope", "sources", "coverage", "points"]) ||
      ![5, 6].includes(candidate.schema) ||
      candidate.date_basis !== "source_reported_calendar" ||
      candidate.scope !== "code_activity" ||
      !isIsoDate(candidate.updated_on) ||
      !Array.isArray(candidate.sources) ||
      candidate.sources.length === 0 ||
      !candidate.sources.every(validSourceDescriptor) ||
      new Set(candidate.sources.map((entry) => entry.id)).size !== candidate.sources.length ||
      !hasExactKeys(candidate.coverage, ["starts_on", "complete_through", "status"]) ||
      !isIsoDate(candidate.coverage.starts_on) ||
      !isIsoDate(candidate.coverage.complete_through) ||
      candidate.coverage.status !== "complete" ||
      !Array.isArray(candidate.points) ||
      candidate.points.length === 0 ||
      !candidate.points.every((point) => point && typeof point === "object" && !Array.isArray(point) && isIsoDate(point.date))
    )
      return false;

    const startsOn = calendarDate(candidate.coverage.starts_on);
    const completeThrough = calendarDate(candidate.coverage.complete_through);
    const sourceStarts = candidate.sources.map((descriptor) => calendarDate(descriptor.starts_on).getTime());
    const sourceEnds = candidate.sources.map((descriptor) => calendarDate(descriptor.complete_through).getTime());
    const expectedLength = Math.round((completeThrough - startsOn) / DAY_MS) + 1;
    if (
      !candidate.sources.some((descriptor) => descriptor.id === "personal") ||
      candidate.coverage.starts_on !== codeActivitySourceContracts.personal.startsOn ||
      startsOn.getTime() !== Math.min(...sourceStarts) ||
      completeThrough.getTime() !== Math.max(...sourceEnds) ||
      candidate.points.length !== expectedLength ||
      candidate.coverage.starts_on !== candidate.points[0].date ||
      candidate.coverage.complete_through !== candidate.points.at(-1).date ||
      candidate.updated_on !== candidate.coverage.complete_through ||
      candidate.sources.some((descriptor) => descriptor.complete_through >= calendarLabelFor(new Date(), descriptor.completion_timezone))
    )
      return false;

    let previousDate = null;
    return candidate.points.every((point) => {
      const date = calendarDate(point.date);
      if (previousDate && date.getTime() - previousDate.getTime() !== DAY_MS) return false;
      previousDate = date;
      // A source that starts late is absent on earlier days rather than padded
      // with zeroes, so "no data yet" never reads as "a quiet day".
      const covered = candidate.sources
        .filter((descriptor) => date >= calendarDate(descriptor.starts_on) && date <= calendarDate(descriptor.complete_through))
        .map((descriptor) => descriptor.id);
      const keys = Object.keys(point).filter((key) => key !== "date");
      return (
        keys.length === covered.length &&
        covered.every((id) => Object.hasOwn(point, id)) &&
        covered.every((id) => validSourceCounts(point[id], candidate.schema))
      );
    });
  };

  let source;
  try {
    source = JSON.parse(dataNode.textContent);
    if (!validCodeActivitySource(source)) throw new Error("Invalid source coverage");
    const { mountCommitOverview } = await import(new URL("build-rhythm-overview.mjs", activityScriptBase));
    mountCommitOverview(root.querySelector("[data-build-rhythm-overview]"), source);
    root.dataset.state = "ready";
  } catch {
    root.dataset.sourceSchema = source?.schema == null ? "none" : String(source.schema);
    root.dataset.state = "unavailable";
  }
})();
