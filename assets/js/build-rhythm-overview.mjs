import { createCommitHistory, createCommitRange, coverageFreshness, commitDateEvidence } from "./build-rhythm-calendar.mjs";

const NS = "http://www.w3.org/2000/svg";
const DAY_MS = 86_400_000;
const number = new Intl.NumberFormat("en-US");
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const stampFor = (value) => Date.parse(`${value}T00:00:00Z`);
const label = (value) => date.format(new Date(stampFor(value)));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const el = (tag, attributes = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
};
const text = (parent, value, x, y, anchor = "start") => {
  const node = el("text", { x, y, "text-anchor": anchor });
  node.textContent = value;
  parent.append(node);
  return node;
};
const niceMaximum = (value) => {
  const power = 10 ** Math.floor(Math.log10(Math.max(1, value)));
  return [1, 2, 2.5, 5, 10].find((step) => step * power >= value) * power;
};
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function mountCommitOverview(overview, source) {
  const history = createCommitHistory(source);
  const freshness = coverageFreshness(history);
  const chart = overview.querySelector("[data-rhythm-chart]");
  const readout = overview.querySelector("[data-rhythm-readout]");
  const startPicker = overview.querySelector("[data-rhythm-range-start]");
  const endPicker = overview.querySelector("[data-rhythm-range-end]");
  const reset = overview.querySelector("[data-rhythm-range-reset]");
  const controls = [...overview.querySelectorAll("[data-rhythm-view]")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const firstYear = history.years[0].year,
    lastYear = history.years.at(-1).year;
  let range = createCommitRange(history, firstYear, lastYear);
  let year = history.years.at(-1),
    view = "history",
    selectedDate = history.completeThrough;
  let historyIndex = 0,
    dailyIndex = 0,
    weekIndex = 0,
    dateIndex = 0;
  let plot, group, axis, yFor;
  let frame = 0,
    epoch = 0,
    cleanup = () => {};
  let resizeFrame = 0,
    previousWidth = 0;
  const recordsDisclosure = overview.closest("[data-github-activity]").querySelector("[data-rhythm-records]");
  let tableScope = null;
  for (const row of history.years) {
    startPicker.add(new Option(String(row.year), String(row.year)));
    endPicker.add(new Option(String(row.year), String(row.year)));
  }
  const rangeLabel = () => (range.startYear === range.endYear ? String(range.startYear) : `${range.startYear}-${range.endYear}`);
  const selectedIndex = () => ({ history: historyIndex, daily: dailyIndex, weekly: weekIndex, cumulative: dateIndex })[view];
  const dateX = (stamp) => plot.left + ((stamp - range.startStamp) / (range.endStamp + DAY_MS - range.startStamp)) * (plot.right - plot.left);
  const syncSelection = () => {
    if (selectedDate < range.startsOn || selectedDate > range.endsOn) selectedDate = range.coveredThrough ?? range.startsOn;
    year = range.years.find((row) => row.year === Number(selectedDate.slice(0, 4))) ?? range.years.at(-1);
    dailyIndex = Math.max(
      0,
      year.cells.findIndex((day) => day.date === selectedDate)
    );
    historyIndex = range.years.indexOf(year) * history.columns + Math.floor(dailyIndex / 7);
    dateIndex = clamp(Math.floor((stampFor(selectedDate) - range.startStamp) / DAY_MS), 0, range.days.length - 1);
    weekIndex = clamp(Math.floor((stampFor(selectedDate) - range.sunday) / (7 * DAY_MS)), 0, range.weeks.length - 1);
  };
  syncSelection();

  const coverage = overview.querySelector("[data-rhythm-coverage]");
  coverage.dataset.stale = String(freshness.stale);
  coverage.textContent = `Verified ${label(history.startsOn)}-${label(history.completeThrough)}. Later dates are unverified.`;
  coverage.title = `${freshness.daysBehind} calendar days before today; completeness checked in ${history.completionTimezone}.`;
  const defs = el("defs");
  for (const kind of ["precoverage", "unverified"]) {
    const pattern = el("pattern", { id: `rhythm-${kind}`, patternUnits: "userSpaceOnUse", width: 5, height: 5 });
    pattern.append(
      el("path", {
        d: kind === "precoverage" ? "M-1 1L1-1M0 5L5 0M4 6L6 4" : "M0 2.5H5",
        fill: "none",
        stroke: "var(--global-text-color-light)",
        "stroke-opacity": kind === "precoverage" ? 0.35 : 0.7,
        "stroke-width": 1,
      })
    );
    defs.append(pattern);
  }
  chart.append(defs);
  const marker = el("rect", { class: "build-rhythm-inspection-mark", rx: 2 });
  const dot = el("circle", { class: "build-rhythm-inspection-dot", r: 4 });
  const inspector = el("rect", {
    "data-rhythm-inspector": "",
    class: "build-rhythm-inspector",
    fill: "transparent",
    tabindex: 0,
    role: "slider",
    "aria-describedby": "rhythm-chart-instructions",
    "aria-valuemin": 0,
  });
  chart.append(marker, dot, inspector);
  const stop = () => {
    epoch++;
    cancelAnimationFrame(frame);
    frame = 0;
    cleanup();
    cleanup = () => {};
    chart.dataset.transitioning = "false";
  };
  const crossfade = (old) => {
    const incoming = group;
    const finish = () => {
      old.remove();
      incoming.setAttribute("opacity", "1");
    };
    const box = chart.getBoundingClientRect();
    if (reduced.matches || document.hidden || box.bottom < 0 || box.top > innerHeight) {
      finish();
      return;
    }
    cleanup = finish;
    const ticket = epoch,
      start = performance.now();
    incoming.setAttribute("opacity", "0");
    chart.dataset.transitioning = "true";
    const tick = (now) => {
      if (ticket !== epoch) return;
      const progress = clamp((now - start) / 240, 0, 1);
      const eased = 1 - (1 - progress) ** 3;
      old.setAttribute("opacity", String(1 - eased));
      incoming.setAttribute("opacity", String(eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else stop();
    };
    frame = requestAnimationFrame(tick);
  };
  const layout = () => {
    const box = chart.getBoundingClientRect();
    const width = Math.max(280, box.width),
      height = Math.max(260, box.height);
    const left = width < 550 ? 44 : 49,
      right = width - 8,
      top = 32,
      bottom = height - 24;
    const rows = view === "history" ? range.years.length : 7;
    chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
    return { width, height, left, right, top, bottom, rows, rowHeight: (bottom - top) / rows, slot: (right - left) / history.columns };
  };
  const paintKind = (node, kind) => {
    node.setAttribute("data-evidence", kind);
    if (["precoverage", "unverified"].includes(kind)) node.style.fill = `url(#rhythm-${kind})`;
  };
  const unknownWeek = (week) => {
    const day = week?.days.find((value) => value.inRange ?? value.inYear);
    return day ? commitDateEvidence(day, history, freshness.today) : "outside";
  };
  const absentDescription = (kind) =>
    kind === "precoverage"
      ? "Before verified coverage"
      : kind === "future"
        ? "Future date; no reported value"
        : kind === "outside"
          ? "Outside this calendar year"
          : "Unverified after the cutoff";
  const weekDescription = (week, scope) => {
    if (!week) return `${scope} \u00b7 Outside this calendar year.`;
    if (!week.recorded) return `${scope} \u00b7 Week of ${label(week.startsOn)} \u00b7 ${absentDescription(unknownWeek(week))}.`;
    const partial = week.partial ? ` ${week.knownDays} of 7 dates verified.` : "";
    const boundary = (week.rangeDays ?? week.yearDays) < 7 ? ` Only dates in ${scope} are included.` : "";
    return `${scope} \u00b7 Week of ${label(week.startsOn)} \u00b7 ${number.format(week.commits)} recorded commits.${partial}${boundary}`;
  };
  const weekBounds = (week) => ({
    left: dateX(Math.max(range.startStamp, stampFor(week.startsOn))),
    right: dateX(Math.min(range.endStamp + DAY_MS, stampFor(week.endsOn) + DAY_MS)),
  });
  const updateMarker = () => {
    if (!plot) return;
    let x,
      width,
      y = plot.top,
      height = plot.bottom - plot.top;
    if (view === "history" || view === "daily") {
      const index = selectedIndex();
      const column = view === "history" ? index % history.columns : Math.floor(index / 7);
      const row = view === "history" ? Math.floor(index / history.columns) : index % 7;
      x = plot.left + column * plot.slot;
      width = plot.slot;
      y += row * plot.rowHeight;
      height = plot.rowHeight;
    } else if (view === "weekly") {
      const bounds = weekBounds(range.weeks[weekIndex]);
      x = bounds.left;
      width = bounds.right - x;
    } else {
      x = dateX(stampFor(range.days[dateIndex].date));
      width = Math.max(1, (plot.right - plot.left) / range.days.length);
    }
    for (const [key, value] of Object.entries({ x, y, width, height })) marker.setAttribute(key, String(value));
    const day = range.days[dateIndex];
    dot.setAttribute("visibility", view === "cumulative" && day.recorded ? "visible" : "hidden");
    if (view === "cumulative" && day.recorded) {
      dot.setAttribute("cx", String(x));
      dot.setAttribute("cy", String(yFor(day.lifetime)));
    }
  };
  const inspect = (requested, keyboard = false) => {
    const maximum =
      view === "history"
        ? range.years.length * history.columns - 1
        : view === "daily"
          ? history.columns * 7 - 1
          : view === "weekly"
            ? range.weeks.length - 1
            : range.days.length - 1;
    const index = clamp(requested, 0, maximum);
    let description;
    if (view === "history") {
      historyIndex = index;
      const row = range.years[Math.floor(index / history.columns)],
        week = row.weeks[index % history.columns];
      const day = week?.days.findLast((value) => value.recorded) ?? week?.days.find((value) => value.inYear);
      if (day) selectedDate = day.date;
      description = weekDescription(week, row.year);
    } else if (view === "daily") {
      dailyIndex = index;
      const day = year.cells[index],
        kind = day ? commitDateEvidence(day, history, freshness.today) : "outside";
      if (day?.inYear) selectedDate = day.date;
      description =
        !day || kind === "outside"
          ? `${year.year} \u00b7 Outside this calendar year.`
          : `${label(day.date)} \u00b7 ${day.recorded ? `${number.format(day.commits)} recorded commits` : absentDescription(kind)}.`;
    } else if (view === "weekly") {
      weekIndex = index;
      const week = range.weeks[index];
      selectedDate = week.coveredThrough ?? week.days.find((day) => day.inRange).date;
      description = weekDescription(week, rangeLabel());
    } else {
      dateIndex = index;
      const day = range.days[index];
      selectedDate = day.date;
      description = `${label(day.date)} \u00b7 ${day.recorded ? `${number.format(day.lifetime)} lifetime recorded commits (${number.format(day.growth)} added in ${rangeLabel()} + ${number.format(range.carryIn)} recorded earlier)` : absentDescription(commitDateEvidence(day, history, freshness.today))}.`;
    }
    readout.textContent = description;
    readout.setAttribute("aria-live", keyboard ? "polite" : "off");
    inspector.setAttribute("aria-valuemax", String(maximum));
    inspector.setAttribute("aria-valuenow", String(index));
    inspector.setAttribute("aria-valuetext", description);
    inspector.setAttribute(
      "aria-label",
      view === "history"
        ? `Inspect personal history by year and week in ${rangeLabel()}`
        : `Inspect ${view} personal commits in ${view === "daily" ? year.year : rangeLabel()}`
    );
    updateMarker();
  };
  const annualAxis = () => {
    const row = view === "history" ? range.years.at(-1) : year;
    row.months.forEach(({ month, column }) => {
      if (plot.width >= 550 || month % 3 === 0) text(axis, months[month], plot.left + column * plot.slot, 17);
    });
  };
  const continuousAxis = () => {
    if (range.startYear === range.endYear) {
      for (let month = 0; month < 12; month++)
        if (plot.width >= 550 || month % 3 === 0) text(axis, months[month], dateX(Date.UTC(range.startYear, month, 1)), 17);
    } else {
      const capacity = Math.max(2, Math.floor((plot.right - plot.left) / 65));
      const step = Math.max(1, Math.ceil((range.years.length - 1) / (capacity - 1)));
      range.years.forEach((row, index) => {
        if (index % step === 0 || index === range.years.length - 1) text(axis, String(row.year), dateX(Date.UTC(row.year, 0, 1)), 17);
      });
    }
  };
  const countAxis = (maximum) => {
    const domain = niceMaximum(Math.max(maximum, 1));
    yFor = (value) => plot.bottom - (value / domain) * (plot.bottom - plot.top);
    for (const value of [0, domain / 2, domain]) {
      const y = yFor(value);
      axis.append(el("line", { x1: plot.left, x2: plot.right, y1: y, y2: y, class: "build-rhythm-gridline" }));
      text(axis, number.format(value), plot.left - 7, y + 4, "end");
    }
    chart.dataset.yMaximum = String(domain);
  };
  const renderTable = () => {
    if (!recordsDisclosure.open) return;
    const startsOn = view === "daily" ? `${year.year}-01-01` : range.startsOn;
    const endsOn = view === "daily" ? `${year.year}-12-31` : range.endsOn;
    const scope = `${startsOn}/${endsOn}`;
    if (tableScope === scope) return;
    tableScope = scope;
    const fragment = document.createDocumentFragment();
    for (const point of source.points) {
      if (!point.personal || point.date < startsOn || point.date > endsOn) continue;
      const row = document.createElement("tr");
      [point.date, number.format(point.personal.commits), number.format(point.personal.authored_commits)].forEach((value, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        if (index === 0) cell.scope = "row";
        cell.textContent = value;
        row.append(cell);
      });
      fragment.append(row);
    }
    recordsDisclosure.querySelector("[data-rhythm-table-body]").replaceChildren(fragment);
    recordsDisclosure.querySelector("[data-rhythm-table-caption]").textContent =
      `Reported Personal values \u00b7 ${view === "daily" ? year.year : rangeLabel()} \u00b7 source author-date labels`;
  };
  const updateCopy = () => {
    controls.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.rhythmView === view)));
    startPicker.value = String(range.startYear);
    endPicker.value = String(range.endYear);
    reset.setAttribute("aria-label", `Show all years, ${firstYear}-${lastYear}, keeping ${view} view`);
    chart.dataset.view = view;
    chart.dataset.startYear = String(range.startYear);
    chart.dataset.endYear = String(range.endYear);
    chart.dataset.year = view === "daily" ? String(year.year) : range.startYear === range.endYear ? String(range.startYear) : "all";
    chart.setAttribute("aria-label", `${view} Personal commit history in ${view === "daily" ? year.year : rangeLabel()}`);
    const count = view === "daily" ? year.total : view === "cumulative" ? range.lifetime : range.total;
    const strong = document.createElement("strong");
    strong.textContent = number.format(count);
    overview
      .querySelector("[data-rhythm-summary]")
      .replaceChildren(
        strong,
        document.createTextNode(
          view === "cumulative"
            ? ` lifetime recorded commits \u00b7 through ${label(range.coveredThrough)}`
            : ` recorded personal commits \u00b7 ${view === "daily" ? year.year : rangeLabel()}`
        )
      );
    overview.querySelector("[data-rhythm-view-note]").textContent = {
      history: "Sunday-start weeks, grouped by year. Select a year or week to open its days.",
      daily: `Daily detail for ${year.year} within ${rangeLabel()}. Darker cells mean more commits; intensity is logarithmic.`,
      weekly: `Continuous Sunday-start weeks in ${rangeLabel()}. Partial weeks include verified dates only.`,
      cumulative: `${number.format(range.total)} added in ${rangeLabel()} + ${number.format(range.carryIn)} recorded earlier. Lifetime totals on a continuous date axis.`,
    }[view];
    overview.querySelector("[data-rhythm-carry-legend]").hidden = view !== "cumulative" || range.carryIn === 0;
    overview.querySelector("[data-rhythm-carry-label]").textContent = `${number.format(range.carryIn)} recorded before ${range.startYear}`;
    renderTable();
  };
  const buildHistory = () => {
    annualAxis();
    const maximum = Math.max(...range.years.flatMap((row) => row.weeks.map((week) => week.commits ?? 0)), 1);
    range.years.forEach((row, index) => {
      const y = plot.top + index * plot.rowHeight;
      const yearLabel = text(axis, String(row.year), 1, y + plot.rowHeight * 0.65);
      yearLabel.dataset.rhythmYearRow = String(row.year);
      yearLabel.classList.add("build-rhythm-year-link");
      yearLabel.addEventListener("click", () => chooseFocusYear(row.year));
      for (let column = 0; column < history.columns; column++) {
        const week = row.weeks[column];
        const cell = el("rect", {
          x: plot.left + column * plot.slot + 1,
          y: y + 3,
          width: Math.max(1, plot.slot - 2),
          height: plot.rowHeight - 6,
          rx: 2,
          "data-rhythm-history-cell": "",
          "data-year": row.year,
          "data-column": column,
          "data-value": week?.recorded ? week.commits : "unverified",
          "data-partial": week?.partial ? "true" : "false",
        });
        paintKind(cell, week?.recorded ? (week.commits === 0 ? "zero" : "recorded") : unknownWeek(week));
        if (week?.commits > 0) cell.setAttribute("fill-opacity", String(0.24 + (0.76 * Math.log1p(week.commits)) / Math.log1p(maximum)));
        group.append(cell);
      }
    });
  };
  const buildDaily = () => {
    annualAxis();
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((name, row) => text(axis, name, 1, plot.top + (row + 0.62) * plot.rowHeight));
    const maximum = Math.max(...year.cells.map((day) => day.commits ?? 0), 1);
    for (let column = 0; column < history.columns; column++)
      for (let row = 0; row < 7; row++) {
        const day = year.cells[column * 7 + row];
        const cell = el("rect", {
          x: plot.left + column * plot.slot + 1,
          y: plot.top + row * plot.rowHeight + 2,
          width: Math.max(1, plot.slot - 2),
          height: plot.rowHeight - 5,
          rx: 2,
          "data-rhythm-slot": "",
          "data-column": column,
          "data-row": row,
          "data-date": day?.date ?? "",
          "data-value": day?.recorded ? day.commits : "unverified",
        });
        paintKind(cell, day ? commitDateEvidence(day, history, freshness.today) : "outside");
        if (day?.commits > 0) cell.setAttribute("fill-opacity", String(0.24 + (0.76 * Math.log1p(day.commits)) / Math.log1p(maximum)));
        group.append(cell);
      }
  };
  const buildWeekly = () => {
    continuousAxis();
    countAxis(Math.max(...range.weeks.map((week) => week.commits ?? 0), 1));
    for (const week of range.weeks) {
      const bounds = weekBounds(week),
        width = bounds.right - bounds.left,
        gap = Math.min(2, width * 0.24);
      const height = !week.recorded ? plot.bottom - plot.top : week.commits === 0 ? 2 : plot.bottom - yFor(week.commits);
      const cell = el("rect", {
        x: bounds.left + gap / 2,
        y: plot.bottom - height,
        width: width - gap,
        height,
        rx: Math.min(1, width / 4),
        "data-rhythm-slot": "",
        "data-column": week.column,
        "data-row": 0,
        "data-date": week.startsOn,
        "data-value": week.recorded ? week.commits : "unverified",
        "data-partial": week.partial ? "true" : "false",
      });
      paintKind(cell, week.recorded ? (week.commits === 0 ? "zero" : "recorded") : unknownWeek(week));
      group.append(cell);
    }
  };
  const buildCumulative = () => {
    continuousAxis();
    countAxis(range.lifetime);
    const known = range.days.filter((day) => day.recorded);
    const carryY = yFor(range.carryIn);
    if (range.carryIn > 0 && known.length)
      group.append(
        el("rect", {
          class: "build-rhythm-carry",
          "data-rhythm-carry": "",
          "data-value": range.carryIn,
          x: dateX(stampFor(known[0].date)),
          y: carryY,
          width: dateX(stampFor(known.at(-1).date)) - dateX(stampFor(known[0].date)),
          height: plot.bottom - carryY,
        })
      );
    const segments = [];
    let segment = [],
      unknownStart = null,
      unknownKind = null;
    const flushUnknown = (through) => {
      if (unknownStart === null) return;
      const x = dateX(unknownStart);
      const band = el("rect", { x, y: plot.top, width: dateX(through) - x, height: plot.bottom - plot.top, "data-rhythm-unknown-span": "" });
      paintKind(band, unknownKind);
      group.append(band);
      unknownStart = null;
    };
    for (const day of range.days) {
      if (day.recorded) {
        flushUnknown(stampFor(day.date));
        segment.push(day);
      } else {
        if (segment.length) segments.push(segment);
        segment = [];
        const kind = commitDateEvidence(day, history, freshness.today);
        if (kind !== unknownKind) flushUnknown(stampFor(day.date));
        if (unknownStart === null) {
          unknownStart = stampFor(day.date);
          unknownKind = kind;
        }
      }
    }
    if (segment.length) segments.push(segment);
    flushUnknown(range.endStamp + DAY_MS);
    const point = (day) => `${dateX(stampFor(day.date)).toFixed(3)},${yFor(day.lifetime).toFixed(3)}`;
    const linePath = segments.map((days) => `M${days.map(point).join("L")}`).join("");
    const areaPath = segments
      .map(
        (days) =>
          `M${dateX(stampFor(days[0].date)).toFixed(3)},${carryY.toFixed(3)}L${days.map(point).join("L")}L${dateX(stampFor(days.at(-1).date)).toFixed(3)},${carryY.toFixed(3)}Z`
      )
      .join("");
    group.append(el("path", { class: "build-rhythm-cumulative-area", d: areaPath }));
    group.append(
      el("path", {
        class: "build-rhythm-cumulative-line",
        "data-rhythm-cumulative-line": "",
        d: linePath,
        "data-first-date": known[0]?.date ?? "",
        "data-last-date": known.at(-1)?.date ?? "",
        "data-recorded-days": known.length,
        "data-basis": "lifetime-recorded",
        "data-final-value": range.lifetime,
      })
    );
  };
  const render = (animated = false) => {
    stop();
    const old = animated ? group : null;
    if (!old) group?.remove();
    else {
      old.removeAttribute("data-rhythm-marks");
      old.setAttribute("aria-hidden", "true");
      old.style.pointerEvents = "none";
    }
    plot = layout();
    group = el("g", { "data-rhythm-marks": "", opacity: 1 });
    axis = el("g", { class: "build-rhythm-axis" });
    group.append(axis);
    chart.insertBefore(group, marker);
    ({ history: buildHistory, daily: buildDaily, weekly: buildWeekly, cumulative: buildCumulative })[view]();
    for (const [key, value] of Object.entries({ x: plot.left, y: plot.top, width: plot.right - plot.left, height: plot.bottom - plot.top }))
      inspector.setAttribute(key, String(value));
    updateCopy();
    inspect(selectedIndex());
    if (old) crossfade(old);
  };
  const chooseFocusYear = (value, column = null) => {
    const next = range.years.find((row) => row.year === Number(value));
    if (!next) return;
    const week = column === null ? next.weeks.findLast((entry) => entry.recorded) : next.weeks[clamp(column, 0, next.columnCount - 1)];
    selectedDate = week?.coveredThrough ?? week?.days.find((day) => day.inYear)?.date ?? next.coveredThrough ?? `${next.year}-01-01`;
    view = "daily";
    syncSelection();
    render(true);
  };
  const chooseView = (next) => {
    if (next === view || !["history", "daily", "weekly", "cumulative"].includes(next)) return;
    view = next;
    syncSelection();
    render(true);
  };
  const chooseRange = (startYear, endYear) => {
    range = createCommitRange(history, startYear, endYear);
    syncSelection();
    render(true);
  };
  controls.forEach((button) => button.addEventListener("click", () => chooseView(button.dataset.rhythmView)));
  startPicker.addEventListener("change", () => {
    const start = Number(startPicker.value);
    chooseRange(start, Math.max(start, range.endYear));
  });
  endPicker.addEventListener("change", () => {
    const end = Number(endPicker.value);
    chooseRange(Math.min(range.startYear, end), end);
  });
  reset.addEventListener("click", () => chooseRange(firstYear, lastYear));
  const point = (event) => {
    const box = chart.getBoundingClientRect();
    const x = ((event.clientX - box.left) * plot.width) / box.width;
    const y = ((event.clientY - box.top) * plot.height) / box.height;
    const fraction = clamp((x - plot.left) / (plot.right - plot.left), 0, 1);
    const stamp = range.startStamp + fraction * (range.endStamp + DAY_MS - range.startStamp);
    return {
      column: clamp(Math.floor((x - plot.left) / plot.slot), 0, history.columns - 1),
      row: clamp(Math.floor((y - plot.top) / plot.rowHeight), 0, plot.rows - 1),
      week: clamp(Math.floor((stamp - range.sunday) / (7 * DAY_MS)), 0, range.weeks.length - 1),
      day: clamp(Math.floor((stamp - range.startStamp) / DAY_MS), 0, range.days.length - 1),
    };
  };
  const pointerInspect = (event) => {
    const p = point(event);
    inspect(view === "history" ? p.row * history.columns + p.column : view === "daily" ? p.column * 7 + p.row : view === "weekly" ? p.week : p.day);
  };
  inspector.addEventListener("pointermove", pointerInspect);
  inspector.addEventListener("pointerdown", (event) => {
    pointerInspect(event);
    if (view === "history") {
      const p = point(event);
      chooseFocusYear(range.years[p.row].year, p.column);
    }
  });
  const verifiedBounds = () => {
    if (view === "history") {
      const first = range.years.findIndex((row) => row.recordedDays > 0),
        last = range.years.findLastIndex((row) => row.recordedDays > 0);
      return [
        first * history.columns + range.years[first].weeks.findIndex((week) => week.recorded),
        last * history.columns + range.years[last].weeks.findLastIndex((week) => week.recorded),
      ];
    }
    const entries = view === "daily" ? year.cells : view === "weekly" ? range.weeks : range.days;
    return [entries.findIndex((entry) => entry.recorded), entries.findLastIndex((entry) => entry.recorded)];
  };
  inspector.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    if (view === "history" && event.key === "Enter") {
      event.preventDefault();
      chooseFocusYear(range.years[Math.floor(historyIndex / history.columns)].year, historyIndex % history.columns);
      return;
    }
    const index = selectedIndex(),
      [first, last] = verifiedBounds();
    const target = {
      ArrowLeft: index - (view === "daily" ? 7 : 1),
      ArrowRight: index + (view === "daily" ? 7 : 1),
      ArrowUp: view === "history" ? index - history.columns : view === "daily" ? index - 1 : undefined,
      ArrowDown: view === "history" ? index + history.columns : view === "daily" ? index + 1 : undefined,
      Home: first,
      End: last,
    }[event.key];
    if (target === undefined || (target < 0 && ["Home", "End"].includes(event.key))) return;
    event.preventDefault();
    inspect(target, true);
  });
  recordsDisclosure.addEventListener("toggle", renderTable);
  reduced.addEventListener("change", stop);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) stop();
  }).observe(chart);
  new ResizeObserver(([entry]) => {
    if (Math.abs(entry.contentRect.width - previousWidth) < 1) return;
    previousWidth = entry.contentRect.width;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => render(false));
  }).observe(chart);

  window.getCommitOverviewEvidence = () => ({
    years: history.years.map((row) => row.year),
    total: history.total,
    canonicalWeeks: history.canonicalWeeks.length,
    sourceCutoff: history.completeThrough,
    sourceCalendar: "github_profile_author_date",
    completionTimezone: history.completionTimezone,
    rangeStart: range.startYear,
    rangeEnd: range.endYear,
    rangeTotal: range.total,
    recordedDays: range.recordedDays,
    rangeWeeks: range.weeks.length,
    carryIn: range.carryIn,
    lifetimeTotal: range.lifetime,
    cumulativeBasis: "lifetimeRecorded",
    year: year.year,
    yearTotal: year.total,
    focusYear: year.year,
    view,
    selected: selectedIndex(),
    selectedWeek: weekIndex,
    selectedDate,
    lastCumulativeDate: view === "cumulative" ? range.coveredThrough : null,
    transitioning: chart.dataset.transitioning === "true",
    plotHeight: chart.getBoundingClientRect().height,
    summary: overview.querySelector("[data-rhythm-summary]").textContent,
    readout: readout.textContent,
    tabStops: chart.querySelectorAll('[tabindex="0"]').length,
  });
  render(false);
  overview.dataset.state = "ready";
}
