import { createCommitHistory, createCommitRange, coverageFreshness, commitDateEvidence } from "./build-rhythm-calendar.mjs";
import {
  historyGeometry,
  calendarGeometry,
  weeklyGeometry,
  interpolateGeometry,
  interpolateHistoryTransform,
  projectHistory,
} from "./build-rhythm-geometry.mjs";

const NS = "http://www.w3.org/2000/svg";
const DAY_MS = 86_400_000;
const number = new Intl.NumberFormat("en-US");
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const label = (value) => date.format(new Date(`${value}T00:00:00Z`));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const el = (tag, attributes = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
};
const set = (node, attributes) => {
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
};
const text = (parent, value, x, y, anchor = "start") => {
  const node = el("text", { x, y, "text-anchor": anchor });
  node.textContent = value;
  parent.append(node);
  return node;
};
const abbreviated = (value) => (value >= 1000 ? `${number.format(value / 1000)}k` : number.format(value));

export function mountCommitOverview(overview, source) {
  const history = createCommitHistory(source);
  const freshness = coverageFreshness(history);
  const root = overview.closest("[data-github-activity]");
  const historyChart = overview.querySelector("[data-rhythm-chart]");
  const detailChart = overview.querySelector("[data-rhythm-detail-chart]");
  const historyReadout = overview.querySelector("[data-rhythm-history-readout]");
  const detailReadout = overview.querySelector("[data-rhythm-readout]");
  const startPicker = overview.querySelector("[data-rhythm-range-start]");
  const endPicker = overview.querySelector("[data-rhythm-range-end]");
  const yearPicker = overview.querySelector("[data-rhythm-year]");
  const controls = [...overview.querySelectorAll("[data-rhythm-view]")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const firstYear = history.years[0].year,
    lastYear = history.years.at(-1).year;
  let range = createCommitRange(history, firstYear, lastYear);
  let year = range.years.at(-1),
    view = "daily";
  let historyDate = range.coveredThrough,
    detailDate = year.coveredThrough;
  let historyLayout, detailLayout;
  let historyPainted = [],
    detailPainted = [],
    historyTransform;
  let tableScope = null,
    resizeFrame = 0,
    previousWidth = 0;
  let retargets = 0;
  const rangeLabel = () => (range.startYear === range.endYear ? String(range.startYear) : `${range.startYear}–${range.endYear}`);
  for (const row of history.years) {
    startPicker.add(new Option(String(row.year), String(row.year)));
    endPicker.add(new Option(String(row.year), String(row.year)));
  }
  const syncYearPicker = () => {
    yearPicker.replaceChildren(...range.years.map((row) => new Option(String(row.year), String(row.year))));
    yearPicker.value = String(year.year);
  };
  syncYearPicker();

  const coverage = overview.querySelector("[data-rhythm-coverage]");
  coverage.dataset.stale = String(freshness.stale);
  coverage.textContent = `Verified ${label(history.startsOn)}–${label(history.completeThrough)} · ${number.format(history.recordedDays)} recorded dates. Later dates have no verified value.`;
  coverage.title = `${freshness.daysBehind} calendar days before today; completeness checked in ${history.completionTimezone}.`;
  const historyDefs = el("defs");
  const clip = el("clipPath", { id: "rhythm-history-clip" }),
    clipRect = el("rect");
  clip.append(clipRect);
  historyDefs.append(clip);
  historyChart.append(historyDefs);
  const historyAxis = el("g", { "aria-hidden": "true" });
  const line = el("path", { class: "build-rhythm-cumulative-line", "data-rhythm-cumulative-line": "", "clip-path": "url(#rhythm-history-clip)" });
  const dot = el("circle", { class: "build-rhythm-inspection-dot", r: 3.5, "aria-hidden": "true" });
  const historyInspector = inspector("history", "rhythm-history-instructions");
  historyChart.append(historyAxis, line, dot, historyInspector);

  const detailDefs = el("defs");
  for (const kind of ["precoverage", "unverified"]) {
    const pattern = el("pattern", { id: `rhythm-${kind}`, patternUnits: "userSpaceOnUse", width: 5, height: 5 });
    pattern.append(
      el("path", {
        d: kind === "precoverage" ? "M-1 1L1-1M0 5L5 0M4 6L6 4" : "M0 2.5H5",
        fill: "none",
        stroke: "var(--rhythm-muted)",
        "stroke-opacity": 0.4,
        "stroke-width": 0.7,
      })
    );
    detailDefs.append(pattern);
  }
  detailChart.append(detailDefs);
  const detailMarks = el("g", { "aria-hidden": "true" }),
    detailAxis = el("g", { "aria-hidden": "true" });
  const marker = el("rect", { class: "build-rhythm-inspection-mark", rx: 2, "aria-hidden": "true" });
  const detailInspector = inspector("detail", "rhythm-detail-instructions");
  detailChart.append(detailMarks, detailAxis, marker, detailInspector);
  let markNodes = new Map();

  function inspector(kind, instructions) {
    return el("rect", {
      "data-rhythm-inspector": kind,
      class: "build-rhythm-inspector",
      fill: "transparent",
      tabindex: 0,
      role: "slider",
      "aria-describedby": instructions,
      "aria-valuemin": 0,
    });
  }
  function motion(chart) {
    let frame = 0,
      finish = () => {},
      ticket = 0;
    chart.dataset.transitioning = "false";
    return {
      run(paint, animate) {
        if (frame) retargets++;
        cancelAnimationFrame(frame);
        frame = 0;
        const epoch = ++ticket,
          start = performance.now();
        const box = chart.getBoundingClientRect();
        finish = () => {
          cancelAnimationFrame(frame);
          frame = 0;
          paint(1);
          chart.dataset.transitioning = "false";
        };
        if (!animate || reduced.matches || document.hidden || box.bottom < 0 || box.top > innerHeight) {
          finish();
          return;
        }
        chart.dataset.transitioning = "true";
        paint(0);
        const tick = (now) => {
          if (epoch !== ticket) return;
          const progress = clamp((now - start) / 220, 0, 1);
          paint(1 - (1 - progress) ** 3);
          if (progress < 1) frame = requestAnimationFrame(tick);
          else {
            frame = 0;
            chart.dataset.transitioning = "false";
          }
        };
        frame = requestAnimationFrame(tick);
      },
      finish() {
        ticket++;
        finish();
      },
    };
  }
  const historyMotion = motion(historyChart),
    detailMotion = motion(detailChart);
  const absence = (kind) =>
    kind === "precoverage" ? "Before verified coverage" : kind === "future" ? "Future date; no reported value" : "Unverified after the cutoff";
  const dailyEntries = () => year.cells.filter((day) => day.inYear);
  const detailEntries = () => (view === "daily" ? dailyEntries() : year.weeks);
  const selectedDetail = () =>
    detailPainted.find((mark) => (view === "daily" ? mark.date === detailDate : mark.week.days.some((day) => day.date === detailDate)));
  const recordedDays = () => range.days.filter((day) => day.recorded);
  const weekKind = (week) =>
    week.recorded
      ? week.commits === 0
        ? "zero"
        : "recorded"
      : commitDateEvidence(
          week.days.find((day) => day.inYear),
          history,
          freshness.today
        );

  function updateHistorySelection() {
    const point = historyPainted.find((entry) => entry.date === historyDate);
    if (!point) return;
    set(dot, { cx: point.x, cy: point.y });
    const day = range.days.find((entry) => entry.date === historyDate);
    historyReadout.textContent = `${label(day.date)} · ${number.format(day.growth)} cumulative recorded commits in ${rangeLabel()} · ${number.format(day.commits)} on this date.`;
    set(historyInspector, {
      "aria-label": "Explore cumulative recorded dates",
      "aria-valuemax": Math.max(0, historyPainted.length - 1),
      "aria-valuenow": historyPainted.indexOf(point),
      "aria-valuetext": historyReadout.textContent,
    });
  }
  function updateDetailSelection() {
    const mark = selectedDetail();
    if (!mark) return;
    set(marker, { x: mark.x - 1, y: mark.y - 1, width: mark.width + 2, height: mark.height + 2 });
    if (view === "daily") {
      const day = mark.day,
        kind = commitDateEvidence(day, history, freshness.today);
      detailReadout.textContent = `${label(day.date)} · ${day.recorded ? `${number.format(day.commits)} recorded commits${kind === "zero" ? " · Verified zero" : ""}` : absence(kind)}.`;
    } else {
      const week = mark.week;
      detailReadout.textContent = `Week of ${label(week.startsOn)} · ${week.recorded ? `${number.format(week.commits)} recorded commits${week.partial ? ` · ${week.knownDays} of 7 dates verified` : ""}${week.yearDays < 7 ? ` · Only dates in ${year.year} included` : ""}` : absence(weekKind(week))}.`;
    }
    set(detailInspector, {
      "aria-label": `Explore ${view} recorded values for ${year.year}`,
      "aria-valuemax": Math.max(0, detailPainted.length - 1),
      "aria-valuenow": detailPainted.indexOf(mark),
      "aria-valuetext": detailReadout.textContent,
    });
  }
  function metadata() {
    startPicker.value = String(range.startYear);
    endPicker.value = String(range.endYear);
    yearPicker.value = String(year.year);
    overview.querySelector("[data-rhythm-total]").textContent = number.format(range.total);
    overview.querySelector("[data-rhythm-total-label]").textContent = `Recorded commits · ${rangeLabel()}`;
    overview.querySelector("[data-rhythm-detail-note]").textContent =
      `${number.format(year.total)} recorded commits in ${year.year} · ${view === "daily" ? "Each square is one source date" : "Sunday-start weeks; only dates in this year"}.`;
    controls.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.rhythmView === view)));
    set(historyChart, { "data-start-year": range.startYear, "data-end-year": range.endYear, "data-view": "cumulative" });
    set(detailChart, { "data-year": year.year, "data-view": view, "aria-label": `Recorded ${view} commits for ${year.year}` });
    renderTable();
  }
  function renderHistory(animate) {
    const box = historyChart.getBoundingClientRect(),
      width = box.width,
      height = box.height;
    const target = historyGeometry(range, width, height);
    const from = historyTransform ?? target.transform;
    historyLayout = target;
    set(historyChart, { viewBox: `0 0 ${width} ${height}`, "data-y-maximum": target.maximum });
    set(historyInspector, {
      x: target.plot.left,
      y: target.plot.top,
      width: target.plot.right - target.plot.left,
      height: target.plot.bottom - target.plot.top,
    });
    set(clipRect, {
      x: target.plot.left - 2,
      y: target.plot.top - 2,
      width: target.plot.right - target.plot.left + 4,
      height: target.plot.bottom - target.plot.top + 4,
    });
    historyAxis.replaceChildren();
    for (const value of [0, target.maximum / 2, target.maximum]) {
      const y = target.y(value);
      historyAxis.append(el("line", { x1: target.plot.left, x2: target.plot.right, y1: y, y2: y, class: "build-rhythm-gridline" }));
      text(historyAxis, abbreviated(value), target.plot.left - 9, y + 3, "end");
    }
    if (range.startYear === range.endYear) {
      for (const [month, name] of [
        [0, "Jan"],
        [3, "Apr"],
        [6, "Jul"],
        [9, "Oct"],
      ])
        text(historyAxis, name, target.x(`${range.startYear}-${String(month + 1).padStart(2, "0")}-01`), height - 5);
    } else {
      const step = Math.max(1, Math.ceil((range.years.length - 1) / (width < 280 ? 2 : width < 500 ? 3 : 9)));
      range.years.forEach((row, index) => {
        if (index % step === 0 || index === range.years.length - 1)
          text(historyAxis, row.year, target.x(`${row.year}-01-01`), height - 5, index === range.years.length - 1 ? "end" : "start");
      });
    }
    line.dataset.firstDate = range.coveredFrom;
    line.dataset.lastDate = range.coveredThrough;
    line.dataset.endpointValue = String(range.total);
    line.dataset.recordedDays = String(range.recordedDays);
    line.dataset.basis = "selected-range-recorded";
    historyMotion.run((progress) => {
      historyTransform = interpolateHistoryTransform(from, target.transform, progress);
      historyPainted = projectHistory(target.points, historyTransform);
      // Recorded points stop at source coverage; no flat extension into later dates.
      line.setAttribute("d", historyPainted.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(""));
      updateHistorySelection();
    }, animate);
  }
  function renderDetail(animate) {
    const box = detailChart.getBoundingClientRect(),
      width = box.width,
      height = box.height;
    const target = view === "daily" ? calendarGeometry(year, width, height, width < 500) : weeklyGeometry(year, width, height);
    const from = detailPainted.length ? detailPainted : target.marks;
    detailLayout = target;
    set(detailChart, { viewBox: `0 0 ${width} ${height}`, "data-calendar-blocks": target.blocks });
    set(detailInspector, { x: 0, y: 0, width, height });
    detailAxis.replaceChildren();
    target.labels.forEach((entry) => text(detailAxis, entry.text, entry.x, entry.y));
    const nextNodes = new Map();
    const maximum = Math.max(1, ...year.cells.map((day) => day.commits ?? 0));
    for (const mark of target.marks) {
      const node = markNodes.get(mark.key) ?? el("rect", { rx: view === "daily" ? 1.2 : 1 });
      const kind = mark.day ? commitDateEvidence(mark.day, history, freshness.today) : weekKind(mark.week);
      set(node, {
        "data-rhythm-slot": "",
        "data-date": mark.date,
        "data-key": mark.key,
        "data-evidence": kind,
        "data-partial": String(Boolean(mark.week?.partial)),
      });
      node.style.setProperty("--rhythm-intensity", `${mark.day ? 25 + (75 * Math.log1p(mark.day.commits ?? 0)) / Math.log1p(maximum) : 85}%`);
      nextNodes.set(mark.key, node);
      detailMarks.append(node);
    }
    for (const [key, node] of markNodes) if (!nextNodes.has(key)) node.remove();
    markNodes = nextNodes;
    detailMotion.run((progress) => {
      detailPainted = interpolateGeometry(from, target.marks, progress);
      for (const mark of detailPainted) set(markNodes.get(mark.key), { x: mark.x, y: mark.y, width: mark.width, height: mark.height });
      updateDetailSelection();
    }, animate);
  }
  const recordsDisclosure = root.querySelector("[data-rhythm-records]");
  function renderTable() {
    if (!recordsDisclosure?.open || tableScope === year.year) return;
    const rows = source.points.filter((point) => point.personal && Number(point.date.slice(0, 4)) === year.year);
    const fragment = document.createDocumentFragment();
    for (const point of rows) {
      const row = document.createElement("tr"),
        heading = document.createElement("th");
      heading.scope = "row";
      heading.textContent = point.date;
      row.append(heading);
      for (const value of [point.personal.commits, point.personal.authored_commits]) {
        const cell = document.createElement("td");
        cell.textContent = value === null || value === undefined ? "Not reported" : number.format(value);
        row.append(cell);
      }
      fragment.append(row);
    }
    root.querySelector("[data-rhythm-table-body]").replaceChildren(fragment);
    root.querySelector("[data-rhythm-table-caption]").textContent =
      `Reported Personal values for ${year.year} by source date label · ${number.format(rows.length)} verified dates`;
    tableScope = year.year;
  }
  function chooseYear(value, selected = null) {
    const next = range.years.find((row) => row.year === Number(value));
    if (!next) return;
    year = next;
    detailDate = selected ?? year.coveredThrough ?? `${year.year}-01-01`;
    metadata();
    renderDetail(true);
  }
  function chooseRange(start, end) {
    range = createCommitRange(history, start, end);
    year = range.years.find((row) => row.year === year.year) ?? range.years.at(-1);
    if (!detailDate.startsWith(String(year.year))) detailDate = year.coveredThrough ?? `${year.year}-01-01`;
    if (historyDate < range.startsOn || historyDate > range.endsOn) historyDate = range.coveredThrough;
    syncYearPicker();
    metadata();
    renderHistory(true);
    renderDetail(true);
  }
  startPicker.addEventListener("change", () => chooseRange(Number(startPicker.value), Math.max(Number(startPicker.value), range.endYear)));
  endPicker.addEventListener("change", () => chooseRange(Math.min(range.startYear, Number(endPicker.value)), Number(endPicker.value)));
  overview.querySelector("[data-rhythm-range-reset]").addEventListener("click", () => chooseRange(firstYear, lastYear));
  yearPicker.addEventListener("change", () => chooseYear(yearPicker.value));
  controls.forEach((button) =>
    button.addEventListener("click", () => {
      if (view === button.dataset.rhythmView) return;
      view = button.dataset.rhythmView;
      metadata();
      renderDetail(true);
    })
  );

  function point(event, chart) {
    const box = chart.getBoundingClientRect();
    const dimensions = chart.viewBox.baseVal;
    return { x: ((event.clientX - box.left) * dimensions.width) / box.width, y: ((event.clientY - box.top) * dimensions.height) / box.height };
  }
  function inspectHistory(event) {
    const p = point(event, historyChart);
    // Use the last painted positions, including every interrupted motion frame.
    const plot = historyLayout.plot;
    const visible = historyPainted.filter((mark) => mark.x >= plot.left && mark.x <= plot.right && mark.y >= plot.top && mark.y <= plot.bottom);
    const nearest = visible.reduce((best, mark) => (!best || Math.abs(mark.x - p.x) < Math.abs(best.x - p.x) ? mark : best), null);
    if (nearest) {
      historyDate = nearest.date;
      updateHistorySelection();
    }
  }
  function inspectDetail(event) {
    const p = point(event, detailChart);
    const hit = detailPainted.findLast((mark) => p.x >= mark.x && p.x <= mark.x + mark.width && p.y >= mark.y && p.y <= mark.y + mark.height);
    if (hit) {
      detailDate = hit.date;
      updateDetailSelection();
    }
  }
  for (const event of ["pointermove", "pointerdown"]) {
    historyInspector.addEventListener(event, inspectHistory);
    detailInspector.addEventListener(event, inspectDetail);
  }
  historyInspector.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      chooseYear(historyDate.slice(0, 4), historyDate);
      detailInspector.focus();
      return;
    }
    const days = recordedDays(),
      index = days.findIndex((day) => day.date === historyDate);
    const target = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: days.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    historyDate = days[clamp(target, 0, days.length - 1)].date;
    updateHistorySelection();
  });
  detailInspector.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    const entries = detailEntries();
    const index = entries.findIndex((entry) => (view === "daily" ? entry.date === detailDate : entry.days.some((day) => day.date === detailDate)));
    const target = {
      ArrowLeft: index - (view === "daily" ? 7 : 1),
      ArrowRight: index + (view === "daily" ? 7 : 1),
      ArrowUp: view === "daily" ? index - 1 : undefined,
      ArrowDown: view === "daily" ? index + 1 : undefined,
      Home: entries.findIndex((entry) => entry.recorded),
      End: entries.findLastIndex((entry) => entry.recorded),
    }[event.key];
    if (target === undefined || (target < 0 && ["Home", "End"].includes(event.key))) return;
    event.preventDefault();
    const selected = entries[clamp(target, 0, entries.length - 1)];
    detailDate = view === "daily" ? selected.date : (selected.coveredThrough ?? selected.days.find((day) => day.inYear).date);
    updateDetailSelection();
  });
  recordsDisclosure.addEventListener("toggle", renderTable);
  const finishMotion = () => {
    historyMotion.finish();
    detailMotion.finish();
  };
  reduced.addEventListener("change", () => {
    if (reduced.matches) finishMotion();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) finishMotion();
  });
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) finishMotion();
  }).observe(overview);
  new ResizeObserver(([entry]) => {
    if (Math.abs(entry.contentRect.width - previousWidth) < 1) return;
    previousWidth = entry.contentRect.width;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      renderHistory(false);
      renderDetail(false);
    });
  }).observe(historyChart);

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
    cumulativeBasis: "selectedRangeRecorded",
    year: year.year,
    yearTotal: year.total,
    focusYear: year.year,
    view,
    selectedDate: detailDate,
    historySelectedDate: historyDate,
    lastCumulativeDate: range.coveredThrough,
    historyFirstDate: range.coveredFrom,
    historyEndpointValue: range.total,
    transitioning: historyChart.dataset.transitioning === "true" || detailChart.dataset.transitioning === "true",
    historyTransitioning: historyChart.dataset.transitioning === "true",
    detailTransitioning: detailChart.dataset.transitioning === "true",
    historyTransform: { ...historyTransform },
    targetHistoryTransform: { ...historyLayout?.transform },
    historySelectedPoint: historyPainted.find((entry) => entry.date === historyDate),
    detailSelectedBox: selectedDetail()
      ? {
          key: selectedDetail().key,
          date: selectedDetail().date,
          x: selectedDetail().x,
          y: selectedDetail().y,
          width: selectedDetail().width,
          height: selectedDetail().height,
        }
      : null,
    calendarBlocks: detailLayout?.blocks,
    retargets,
    plotHeight: detailChart.getBoundingClientRect().height,
    historyPlotHeight: historyChart.getBoundingClientRect().height,
    summary: overview.querySelector("[data-rhythm-summary]").textContent,
    readout: detailReadout.textContent,
    historyReadout: historyReadout.textContent,
    tabStops: overview.querySelectorAll('svg [tabindex="0"]').length,
  });
  metadata();
  renderHistory(false);
  renderDetail(false);
  overview.dataset.state = "ready";
}
