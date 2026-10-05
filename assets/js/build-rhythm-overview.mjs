import { createCommitHistory, coverageFreshness, commitDateEvidence } from "./build-rhythm-calendar.mjs";

const NS = "http://www.w3.org/2000/svg";
const number = new Intl.NumberFormat("en-US");
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const label = (value) => date.format(new Date(`${value}T00:00:00Z`));
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
  return Math.ceil(Math.max(1, value) / power) * power;
};

export function mountCommitOverview(overview, source) {
  const history = createCommitHistory(source);
  const freshness = coverageFreshness(history);
  const chart = overview.querySelector("[data-rhythm-chart]");
  const readout = overview.querySelector("[data-rhythm-readout]");
  const picker = overview.querySelector("[data-rhythm-year]");
  const controls = [...overview.querySelectorAll("[data-rhythm-view]")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let year = history.years.at(-1),
    view = "history";
  let weekIndex = year.weeks.findLastIndex((week) => week.recorded);
  let dailyIndex = year.cells.findLastIndex((day) => day.recorded);
  let historyIndex = (history.years.length - 1) * history.columns + weekIndex;
  let plot,
    group,
    axis,
    cells = [],
    points = [],
    area,
    line,
    carry;
  let frame = 0,
    epoch = 0,
    jobs = [],
    cleanup = () => {},
    afterApply = () => {};
  let resizeFrame = 0,
    previousWidth = 0;
  const recordsDisclosure = overview.closest("[data-github-activity]").querySelector("[data-rhythm-records]");
  let tableScope = null;
  picker.add(new Option("All years", "all"));
  for (const row of [...history.years].reverse()) picker.add(new Option(String(row.year), String(row.year)));

  const coverage = overview.querySelector("[data-rhythm-coverage]");
  coverage.dataset.stale = String(freshness.stale);
  coverage.textContent = `Verified ${label(history.startsOn)}–${label(history.completeThrough)}. Later dates are unverified.`;
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

  const apply = (targets, fraction) => {
    for (const job of targets)
      for (const [attribute, target] of Object.entries(job.to)) {
        job.node.setAttribute(attribute, String(job.from[attribute] + (target - job.from[attribute]) * fraction));
      }
    afterApply();
  };
  const stop = (settle = true) => {
    epoch++;
    cancelAnimationFrame(frame);
    frame = 0;
    if (settle) apply(jobs, 1);
    jobs = [];
    cleanup();
    cleanup = () => {};
    chart.dataset.transitioning = "false";
  };
  const animate = (targets, enabled, finish = () => {}) => {
    stop(false);
    const next = targets.map(({ node, to }) => ({
      node,
      to,
      from: Object.fromEntries(Object.keys(to).map((key) => [key, Number(node.getAttribute(key) ?? 0)])),
    }));
    const box = chart.getBoundingClientRect();
    if (!enabled || reduced.matches || document.hidden || box.bottom < 0 || box.top > innerHeight) {
      apply(next, 1);
      finish();
      return;
    }
    jobs = next;
    cleanup = finish;
    const ticket = epoch,
      start = performance.now();
    chart.dataset.transitioning = "true";
    const tick = (now) => {
      if (ticket !== epoch) return;
      const progress = clamp((now - start) / 240, 0, 1);
      apply(jobs, 1 - (1 - progress) ** 3);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else stop(true);
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
    const rows = view === "history" ? history.years.length : 7;
    chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
    return { width, height, left, right, top, bottom, rows, rowHeight: (bottom - top) / rows, slot: (right - left) / history.columns };
  };
  const paintKind = (node, kind) => {
    node.setAttribute("data-evidence", kind);
    node.style.fill = ["precoverage", "unverified"].includes(kind) ? `url(#rhythm-${kind})` : "";
  };
  const unknownWeek = (week) => {
    const day = week?.days.find((value) => value.inYear);
    return day ? commitDateEvidence(day, history, freshness.today) : "outside";
  };
  const weekDescription = (row, week, mode = "weekly") => {
    if (!week) return `${row.year} · Outside this calendar year.`;
    if (!week.recorded) {
      const kind = unknownWeek(week);
      return `${row.year} · Week of ${label(week.startsOn)} · ${kind === "precoverage" ? "Before verified coverage" : kind === "future" ? "Future dates; no reported values" : "Unverified after the cutoff"}.`;
    }
    const partial = week.partial ? ` ${week.knownDays} of 7 dates verified.` : "";
    const boundary = week.yearDays < 7 ? ` Only ${row.year} dates are included.` : "";
    return mode === "cumulative"
      ? `Through ${label(week.coveredThrough)} · ${number.format(row.carryIn + week.cumulative)} cumulative recorded commits (${number.format(week.cumulative)} in ${row.year} + ${number.format(row.carryIn)} before it).${partial}${boundary}`
      : `${row.year} · Week of ${label(week.startsOn)} · ${number.format(week.commits)} recorded commits.${partial}${boundary}`;
  };
  const selectedColumn = () => (view === "history" ? historyIndex % history.columns : view === "daily" ? Math.floor(dailyIndex / 7) : weekIndex);
  const updateMarker = () => {
    if (!plot) return;
    const column = selectedColumn(),
      row = view === "history" ? Math.floor(historyIndex / history.columns) : view === "daily" ? dailyIndex % 7 : 0;
    marker.setAttribute("x", String(plot.left + column * plot.slot));
    marker.setAttribute("y", String(plot.top + row * plot.rowHeight));
    marker.setAttribute("width", String(plot.slot));
    marker.setAttribute("height", String(["history", "daily"].includes(view) ? plot.rowHeight : plot.bottom - plot.top));
    const week = year.weeks[column];
    dot.setAttribute("visibility", view === "cumulative" && week?.recorded ? "visible" : "hidden");
    if (view === "cumulative" && week?.recorded) {
      dot.setAttribute("cx", String(plot.left + (column + 0.5) * plot.slot));
      dot.setAttribute("cy", String(points[column]?.getAttribute("cy") ?? plot.bottom));
    }
  };
  const inspect = (index, keyboard = false) => {
    const maximum =
      view === "history" ? history.years.length * history.columns - 1 : view === "daily" ? history.columns * 7 - 1 : history.columns - 1;
    index = clamp(index, 0, maximum);
    let description;
    if (view === "history") {
      historyIndex = index;
      const row = history.years[Math.floor(index / history.columns)];
      description = weekDescription(row, row.weeks[index % history.columns]);
    } else if (view === "daily") {
      dailyIndex = index;
      weekIndex = Math.floor(index / 7);
      const day = year.cells[index],
        kind = day ? commitDateEvidence(day, history, freshness.today) : "outside";
      description =
        !day || kind === "outside"
          ? `${year.year} · Outside this calendar year.`
          : `${label(day.date)} · ${day.recorded ? `${number.format(day.commits)} recorded commits` : kind === "precoverage" ? "Before verified coverage" : kind === "future" ? "Future date; no reported value" : "Unverified after the cutoff"}.`;
    } else {
      weekIndex = index;
      description = weekDescription(year, year.weeks[index], view);
    }
    readout.textContent = description;
    readout.setAttribute("aria-live", keyboard ? "polite" : "off");
    inspector.setAttribute("aria-valuemax", String(maximum));
    inspector.setAttribute("aria-valuenow", String(index));
    inspector.setAttribute("aria-valuetext", description);
    inspector.setAttribute(
      "aria-label",
      view === "history" ? "Inspect personal history by year and week" : `Inspect ${view} personal commits in ${year.year}`
    );
    updateMarker();
  };
  const monthLabels = () => {
    const row = view === "history" ? history.years.at(-1) : year;
    row.months.forEach(({ month, column }) => {
      if (plot.width >= 550 || month % 3 === 0)
        text(axis, ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month], plot.left + column * plot.slot, 17);
    });
  };
  const renderTable = () => {
    if (!recordsDisclosure.open) return;
    const scope = view === "history" ? "all" : String(year.year);
    if (tableScope === scope) return;
    tableScope = scope;
    const fragment = document.createDocumentFragment();
    for (const point of source.points) {
      if (!point.personal || (scope !== "all" && !point.date.startsWith(scope))) continue;
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
      `Reported Personal values · ${scope === "all" ? "all recorded years" : scope} · source author-date labels`;
  };
  const updateCopy = () => {
    controls.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.rhythmView === view)));
    picker.value = view === "history" ? "all" : String(year.year);
    chart.dataset.view = view;
    chart.dataset.year = view === "history" ? "all" : String(year.year);
    chart.setAttribute("aria-label", view === "history" ? "Personal commit history by year and week" : `${view} personal commits in ${year.year}`);
    const summary = overview.querySelector("[data-rhythm-summary]");
    const count = view === "history" ? history.total : view === "cumulative" ? year.carryIn + year.total : year.total;
    const strong = document.createElement("strong");
    strong.textContent = number.format(count);
    summary.replaceChildren(
      strong,
      document.createTextNode(
        view === "history"
          ? ` recorded personal commits · ${history.years[0].year}–${history.years.at(-1).year}`
          : view === "cumulative"
            ? ` recorded through ${label(year.coveredThrough)} · ${number.format(year.carryIn)} before ${year.year}`
            : ` recorded personal commits · ${year.year}`
      )
    );
    overview.querySelector("[data-rhythm-view-note]").textContent = {
      history: "One cell per Sunday-start week. Select a year or week to open its days.",
      daily: "One cell per day; darker means more commits. Color intensity is logarithmic.",
      weekly: "Sunday-start weeks on a linear count axis. Partial weeks include verified dates only.",
      cumulative: "A linear running total; the quiet base carries earlier years. The line stops at the cutoff.",
    }[view];
    overview.querySelector("[data-rhythm-carry-legend]").hidden = view !== "cumulative" || year.carryIn === 0;
    renderTable();
  };
  const drawCumulative = () => {
    if (!line || !area) return;
    const known = year.weeks.filter((week) => week.recorded);
    const coords = known.map((week) => `${points[week.column].getAttribute("cx")},${points[week.column].getAttribute("cy")}`);
    const bottom = Number(carry.getAttribute("y"));
    const firstX = points[known[0]?.column]?.getAttribute("cx"),
      lastX = points[known.at(-1)?.column]?.getAttribute("cx");
    line.setAttribute("d", coords.length ? `M${coords.join("L")}` : "");
    area.setAttribute("d", coords.length ? `M${firstX},${bottom}L${coords.join("L")}L${lastX},${bottom}Z` : "");
    updateMarker();
  };
  const paintYear = (enabled = false) => {
    axis.replaceChildren();
    monthLabels();
    const dailyMaximum = Math.max(...year.cells.map((day) => day.commits ?? 0), 1);
    const weeklyMaximum = Math.max(...year.weeks.map((week) => week.commits ?? 0), 1);
    const domain = niceMaximum(view === "cumulative" ? year.carryIn + year.total : weeklyMaximum);
    const yFor = (value) => plot.bottom - (value / domain) * (plot.bottom - plot.top);
    if (view === "daily")
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((name, row) => text(axis, name, 1, plot.top + (row + 0.62) * plot.rowHeight));
    else
      [0, domain / 2, domain].forEach((value) => {
        const y = yFor(value);
        axis.append(el("line", { x1: plot.left, x2: plot.right, y1: y, y2: y, class: "build-rhythm-gridline" }));
        text(axis, number.format(value), plot.left - 7, y + 4, "end");
      });
    const targets = [];
    for (let column = 0; column < history.columns; column++) {
      const week = year.weeks[column],
        kind = week?.recorded ? (week.commits === 0 ? "zero" : "recorded") : unknownWeek(week);
      for (let row = 0; row < 7; row++) {
        const node = cells[column * 7 + row],
          day = year.cells[column * 7 + row];
        const evidence = view === "daily" ? (day ? commitDateEvidence(day, history, freshness.today) : "outside") : kind;
        paintKind(node, evidence);
        node.dataset.date = day?.date ?? "";
        node.dataset.value =
          view === "daily" ? (day?.recorded ? String(day.commits) : "unverified") : week?.recorded ? String(week.commits) : "unverified";
        node.setAttribute("data-partial", view !== "daily" && week?.partial ? "true" : "false");
        node.setAttribute(
          "fill-opacity",
          String(view === "daily" && day?.commits > 0 ? 0.24 + (0.76 * Math.log1p(day.commits)) / Math.log1p(dailyMaximum) : 1)
        );
        const unknown = !week?.recorded;
        const height =
          view === "daily"
            ? plot.rowHeight - 5
            : row === 0 && view === "weekly"
              ? unknown || week.commits === 0
                ? 5
                : plot.bottom - yFor(week.commits)
              : row === 0 && unknown
                ? plot.bottom - plot.top
                : 0;
        const y = view === "daily" ? plot.top + row * plot.rowHeight + 2 : view === "cumulative" && unknown ? plot.top : plot.bottom - height;
        targets.push({
          node,
          to: {
            x: plot.left + column * plot.slot + 1,
            y,
            width: Math.max(1, plot.slot - 2),
            height,
            opacity: view === "daily" || row === 0 ? 1 : 0,
            rx: view === "daily" ? 2 : 1,
          },
        });
      }
      targets.push({
        node: points[column],
        to: { cy: week?.recorded ? yFor(view === "cumulative" ? year.carryIn + week.cumulative : week.commits) : plot.bottom },
      });
    }
    const known = year.weeks.filter((week) => week.recorded);
    const first = known[0],
      last = known.at(-1);
    const carryY = view === "cumulative" ? yFor(year.carryIn) : plot.bottom;
    targets.push({
      node: carry,
      to: {
        x: plot.left + (first?.column ?? 0) * plot.slot,
        y: carryY,
        width: known.length * plot.slot,
        height: plot.bottom - carryY,
        opacity: view === "cumulative" && year.carryIn > 0 ? 1 : 0,
      },
    });
    targets.push({ node: area, to: { opacity: view === "cumulative" ? 1 : 0 } }, { node: line, to: { opacity: view === "cumulative" ? 1 : 0 } });
    afterApply = drawCumulative;
    animate(targets, enabled);
    inspect(view === "daily" ? dailyIndex : weekIndex);
  };
  const buildGroup = () => {
    group = el("g", { "data-rhythm-marks": "" });
    axis = el("g", { class: "build-rhythm-axis" });
    group.append(axis);
    chart.insertBefore(group, marker);
    if (view === "history") {
      monthLabels();
      const maximum = Math.max(...history.years.flatMap((row) => row.weeks.map((week) => week.commits ?? 0)), 1);
      history.years.forEach((row, index) => {
        const y = plot.top + index * plot.rowHeight;
        const yearLabel = text(axis, String(row.year), 1, y + plot.rowHeight * 0.65);
        yearLabel.dataset.rhythmYearRow = String(row.year);
        yearLabel.classList.add("build-rhythm-year-link");
        yearLabel.addEventListener("click", () => chooseYear(row.year));
        for (let column = 0; column < history.columns; column++) {
          const week = row.weeks[column],
            cell = el("rect", {
              x: plot.left + column * plot.slot + 1,
              y: y + 3,
              width: Math.max(1, plot.slot - 2),
              height: plot.rowHeight - 6,
              rx: 2,
              "data-rhythm-history-cell": "",
              "data-year": row.year,
              "data-column": column,
            });
          paintKind(cell, week?.recorded ? (week.commits === 0 ? "zero" : "recorded") : unknownWeek(week));
          if (week?.commits > 0) cell.setAttribute("fill-opacity", String(0.24 + (0.76 * Math.log1p(week.commits)) / Math.log1p(maximum)));
          cell.dataset.value = week?.recorded ? String(week.commits) : "unverified";
          cell.setAttribute("data-partial", week?.partial ? "true" : "false");
          group.append(cell);
        }
      });
      line = area = carry = null;
      afterApply = () => {};
    } else {
      carry = el("rect", { class: "build-rhythm-carry", opacity: 0, y: plot.bottom, height: 0 });
      area = el("path", { class: "build-rhythm-cumulative-area", opacity: 0 });
      line = el("path", { class: "build-rhythm-cumulative-line", opacity: 0, "data-rhythm-cumulative-line": "" });
      group.append(carry, area, line);
      cells = [];
      points = [];
      for (let column = 0; column < history.columns; column++) {
        const point = el("circle", { cx: plot.left + (column + 0.5) * plot.slot, cy: plot.bottom, r: 0 });
        points.push(point);
        group.append(point);
        for (let row = 0; row < 7; row++) {
          const cell = el("rect", {
            "data-rhythm-slot": "",
            "data-column": column,
            "data-row": row,
            x: plot.left + column * plot.slot,
            y: plot.bottom,
            height: 0,
          });
          cells.push(cell);
          group.append(cell);
        }
      }
      paintYear(false);
    }
  };
  const render = (crossfade = false) => {
    stop(true);
    const old = crossfade && group ? group.cloneNode(true) : null;
    group?.remove();
    plot = layout();
    buildGroup();
    for (const [key, value] of Object.entries({ x: plot.left, y: plot.top, width: plot.right - plot.left, height: plot.bottom - plot.top }))
      inspector.setAttribute(key, String(value));
    updateCopy();
    inspect(view === "history" ? historyIndex : view === "daily" ? dailyIndex : weekIndex);
    if (old) {
      old.removeAttribute("data-rhythm-marks");
      old.setAttribute("aria-hidden", "true");
      old.style.pointerEvents = "none";
      chart.insertBefore(old, group);
      const incoming = group;
      incoming.setAttribute("opacity", "0");
      animate(
        [
          { node: old, to: { opacity: 0 } },
          { node: incoming, to: { opacity: 1 } },
        ],
        true,
        () => {
          old.remove();
          incoming.setAttribute("opacity", "1");
        }
      );
    }
  };
  const chooseYear = (value, column = null) => {
    const next = history.years.find((row) => row.year === Number(value));
    if (!next) return;
    stop(true);
    year = next;
    if (view === "history") view = "daily";
    weekIndex = column === null ? year.weeks.findLastIndex((week) => week.recorded) : clamp(column, 0, year.columnCount - 1);
    const week = year.weeks[weekIndex];
    let day = week.days.findLastIndex((value) => value.recorded);
    if (day < 0) day = week.days.findIndex((value) => value.inYear);
    dailyIndex = weekIndex * 7 + Math.max(0, day);
    historyIndex = history.years.indexOf(year) * history.columns + weekIndex;
    render(true);
  };
  const chooseView = (next) => {
    if (next === view) return;
    stop(true);
    const changedScope = next === "history" || view === "history";
    if (view === "daily") weekIndex = Math.floor(dailyIndex / 7);
    if (next === "daily" && view !== "history") {
      const week = year.weeks[weekIndex];
      const day = week?.days.findLastIndex((value) => value.recorded) ?? -1;
      dailyIndex = weekIndex * 7 + Math.max(0, day);
    }
    view = next;
    if (changedScope) render(true);
    else {
      updateCopy();
      paintYear(true);
    }
  };
  controls.forEach((button) => button.addEventListener("click", () => chooseView(button.dataset.rhythmView)));
  picker.addEventListener("change", () => (picker.value === "all" ? chooseView("history") : chooseYear(picker.value)));

  const point = (event) => {
    const box = chart.getBoundingClientRect();
    return {
      column: clamp(Math.floor((((event.clientX - box.left) * plot.width) / box.width - plot.left) / plot.slot), 0, history.columns - 1),
      row: clamp(Math.floor((((event.clientY - box.top) * plot.height) / box.height - plot.top) / plot.rowHeight), 0, plot.rows - 1),
    };
  };
  const pointerInspect = (event) => {
    const p = point(event);
    inspect(view === "history" ? p.row * history.columns + p.column : view === "daily" ? p.column * 7 + p.row : p.column);
  };
  inspector.addEventListener("pointermove", pointerInspect);
  inspector.addEventListener("pointerdown", (event) => {
    pointerInspect(event);
    if (view === "history") {
      const p = point(event);
      chooseYear(history.years[p.row].year, p.column);
    }
  });
  inspector.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    if (view === "history" && event.key === "Enter") {
      event.preventDefault();
      chooseYear(history.years[Math.floor(historyIndex / history.columns)].year, historyIndex % history.columns);
      return;
    }
    const index = view === "history" ? historyIndex : view === "daily" ? dailyIndex : weekIndex;
    const first =
      view === "history"
        ? history.years[0].weeks.findIndex((week) => week.recorded)
        : view === "daily"
          ? year.cells.findIndex((day) => day.recorded)
          : year.weeks.findIndex((week) => week.recorded);
    const last =
      view === "history"
        ? (history.years.length - 1) * history.columns + history.years.at(-1).weeks.findLastIndex((week) => week.recorded)
        : view === "daily"
          ? year.cells.findLastIndex((day) => day.recorded)
          : year.weeks.findLastIndex((week) => week.recorded);
    const target = {
      ArrowLeft: index - (view === "daily" ? 7 : 1),
      ArrowRight: index + (view === "daily" ? 7 : 1),
      ArrowUp: view === "history" ? index - history.columns : view === "daily" ? index - 1 : undefined,
      ArrowDown: view === "history" ? index + history.columns : view === "daily" ? index + 1 : undefined,
      Home: first,
      End: last,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    inspect(target, true);
  });
  recordsDisclosure.addEventListener("toggle", renderTable);
  reduced.addEventListener("change", () => stop(true));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(true);
  });
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) stop(true);
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
    year: year.year,
    yearTotal: year.total,
    carryIn: year.carryIn,
    view,
    selected: view === "history" ? historyIndex : view === "daily" ? dailyIndex : weekIndex,
    selectedWeek: weekIndex,
    selectedDate: view === "daily" ? (year.cells[dailyIndex]?.date ?? null) : null,
    transitioning: chart.dataset.transitioning === "true",
    plotHeight: chart.getBoundingClientRect().height,
    summary: overview.querySelector("[data-rhythm-summary]").textContent,
    readout: readout.textContent,
    tabStops: chart.querySelectorAll('[tabindex="0"]').length,
  });
  render(false);
  overview.dataset.state = "ready";
}
