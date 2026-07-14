(async () => {
  const NS = "http://www.w3.org/2000/svg";
  const number = new Intl.NumberFormat("en-US");
  const compactNumber = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const fullDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const shortDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const svgElement = (name, attributes = {}) => {
    const node = document.createElementNS(NS, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };
  const addText = (parent, value, x, y, options = {}) => {
    const node = svgElement("text", {
      x,
      y,
      "text-anchor": options.anchor || "start",
      ...(options.color ? { fill: options.color } : {}),
      ...(options.weight ? { "font-weight": options.weight } : {}),
      ...(options.className ? { class: options.className } : {}),
    });
    node.textContent = value;
    parent.append(node);
    return node;
  };
  const linePath = (points) => points.map(([x, y], index) => `${index ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const areaPath = (points, baseline) => {
    if (!points.length) return "";
    return `M ${points[0][0].toFixed(2)} ${baseline.toFixed(2)} ${points
      .map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(" ")} L ${points.at(-1)[0].toFixed(2)} ${baseline.toFixed(2)} Z`;
  };
  const isIsoDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

  const initCodexUsageTrend = async () => {
    const trendRoot = document.querySelector("[data-codex-usage]");
    if (!trendRoot) return;

    const chart = document.getElementById("github-activity-codex-chart");
    const selectedDate = document.getElementById("github-activity-codex-date");
    const selectedTokens = document.getElementById("github-activity-codex-tokens");
    const selectedCoverage = document.getElementById("github-activity-codex-coverage");
    const status = trendRoot.querySelector("[data-codex-status]");
    const tableSection = document.querySelector("[data-codex-table]");
    const tableBody = document.getElementById("github-activity-codex-table-body");
    const tableCaption = document.getElementById("github-activity-codex-table-caption");
    const grainButtons = Array.from(trendRoot.querySelectorAll("[data-codex-grain]"));
    const scopeBadge = trendRoot.querySelector("[data-codex-scope]");
    if (!chart || !selectedDate || !selectedTokens || !selectedCoverage || !status || !trendRoot.dataset.source) return;

    const selectionReadout = [selectedDate, selectedTokens, selectedCoverage];
    const setUnavailable = () => {
      trendRoot.dataset.state = "error";
      trendRoot.setAttribute("aria-busy", "false");
      status.textContent = "Recent Codex token data is unavailable.";
      status.hidden = false;
      selectionReadout.forEach((node) => {
        node.hidden = true;
        node.textContent = "";
      });
      grainButtons.forEach((button) => {
        button.disabled = true;
      });
      if (tableSection) tableSection.hidden = true;
      chart.replaceChildren();
    };
    const validRows = (rows, key) =>
      Array.isArray(rows) && rows.length > 0 && rows.every((row) => isIsoDate(row?.[key]) && Number.isInteger(row.tokens) && row.tokens >= 0);
    const validSource = (candidate) =>
      candidate?.schema === 1 &&
      typeof candidate.sourceAsOf === "string" &&
      Number.isInteger(candidate?.lifetime?.tokens) &&
      candidate.lifetime.tokens > 0 &&
      validRows(candidate?.recent?.daily, "date") &&
      validRows(candidate?.recent?.weekly, "week") &&
      typeof candidate?.recent?.partialLastDay === "boolean";

    let source;
    try {
      const response = await fetch(trendRoot.dataset.source, {
        cache: "no-store",
        credentials: "same-origin",
      });
      source = response.ok ? await response.json() : null;
    } catch {
      source = null;
    }
    if (!validSource(source)) {
      setUnavailable();
      return;
    }

    const dateFrom = (value) => new Date(`${value}T00:00:00Z`);
    let grain = "daily";
    let selectedIndex = source.recent.daily.length - 1;
    let pinnedIndex = selectedIndex;
    let resizeFrame = 0;

    const coverageLabel = (row) => {
      if (grain === "daily") return row.partial ? "Partial day" : "Observed day";
      if (!row.partial) return "7 of 7 days";
      if (row.partialReason === "range-start") return `${row.observedDays} of 7 days \u00b7 range starts here`;
      return `${row.observedDays} of 7 days \u00b7 week in progress`;
    };
    const rowsForGrain = () => {
      if (grain === "weekly") {
        return source.recent.weekly.map((row) => ({
          ...row,
          key: row.week,
          date: dateFrom(row.week),
        }));
      }
      return source.recent.daily.map((row, index, rows) => ({
        ...row,
        key: row.date,
        date: dateFrom(row.date),
        observedDays: 1,
        partial: index === rows.length - 1 && source.recent.partialLastDay,
        partialReason: index === rows.length - 1 && source.recent.partialLastDay ? "range-end" : null,
      }));
    };
    const updateTable = (rows) => {
      if (!tableBody) return;
      const fragment = document.createDocumentFragment();
      rows.forEach((row) => {
        const tr = document.createElement("tr");
        const period = grain === "daily" ? fullDate.format(row.date) : `Week of ${fullDate.format(row.date)}`;
        [period, coverageLabel(row), number.format(row.tokens)].forEach((value, index) => {
          const cell = document.createElement(index === 0 ? "th" : "td");
          if (index === 0) cell.scope = "row";
          cell.textContent = value;
          tr.append(cell);
        });
        fragment.append(tr);
      });
      tableBody.replaceChildren(fragment);
      if (tableCaption) tableCaption.textContent = `${grain === "daily" ? "Daily" : "Sunday-week"} Codex account tokens`;
    };
    const updateReadout = (row) => {
      selectedDate.textContent = `${grain === "daily" ? "Day of" : "Week of"} ${fullDate.format(row.date)}`;
      selectedTokens.textContent = `${number.format(row.tokens)} tokens`;
      selectedCoverage.textContent = coverageLabel(row);
    };
    const setPressedState = () => {
      grainButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.codexGrain === grain)));
      if (scopeBadge) scopeBadge.textContent = `LAST 30 DAYS \u00b7 ${grain.toUpperCase()}`;
    };
    const draw = () => {
      const rows = rowsForGrain();
      if (!rows.length) return;
      selectedIndex = clamp(selectedIndex, 0, rows.length - 1);
      pinnedIndex = clamp(pinnedIndex, 0, rows.length - 1);
      const restoreFocus = chart.contains(document.activeElement);
      chart.replaceChildren();

      const style = getComputedStyle(trendRoot);
      const accent = style.getPropertyValue("--global-primary-color").trim() || "#b84f12";
      const text = style.getPropertyValue("--global-text-color").trim() || "#211a16";
      const gridColor = style.getPropertyValue("--global-divider-color").trim() || "rgba(90,88,72,.16)";
      const surface = style.getPropertyValue("--global-surface-color").trim() || "#fffaf6";
      const width = chart.clientWidth || 920;
      const height = chart.clientHeight || 210;
      const narrow = width < 620;
      const left = narrow ? 54 : 66;
      const right = narrow ? 10 : 18;
      const top = 18;
      const bottom = 34;
      const baseline = height - bottom;
      const plotHeight = baseline - top;
      const maximum = Math.max(...rows.map((row) => row.tokens), 1);
      const magnitude = 10 ** Math.floor(Math.log10(maximum));
      const domainMaximum = Math.max(magnitude, Math.ceil(maximum / magnitude) * magnitude);
      const x = (index) => left + (index / Math.max(1, rows.length - 1)) * (width - left - right);
      const y = (value) => baseline - (value / domainMaximum) * plotHeight;
      chart.setAttribute("viewBox", `0 0 ${width} ${height}`);

      const grid = svgElement("g", { class: "github-activity-codex-grid", "aria-hidden": "true" });
      [0, 0.25, 0.5, 0.75, 1].forEach((fraction) => {
        const value = domainMaximum * fraction;
        const yy = y(value);
        grid.append(svgElement("line", { x1: left, y1: yy, x2: width - right, y2: yy, stroke: gridColor, "stroke-width": 1 }));
        addText(grid, compactNumber.format(value), left - 8, yy + 4, { anchor: "end", className: "github-activity-codex-tick" });
      });
      addText(grid, shortDate.format(rows[0].date), left, height - 10, { className: "github-activity-codex-axis-label" });
      addText(grid, shortDate.format(rows.at(-1).date), width - right, height - 10, {
        anchor: "end",
        className: "github-activity-codex-axis-label",
      });
      chart.append(grid);

      const points = rows.map((row, index) => [x(index), y(row.tokens)]);
      chart.append(
        svgElement("path", {
          class: "github-activity-codex-area",
          d: areaPath(points, baseline),
          fill: accent,
          "fill-opacity": 0.1,
        }),
        svgElement("path", {
          class: "github-activity-codex-line",
          d: linePath(points),
          fill: "none",
          stroke: accent,
          "stroke-width": 2,
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
        })
      );
      rows.forEach((row, index) => {
        chart.append(
          svgElement("circle", {
            class: `github-activity-codex-point${row.partial ? " is-partial" : ""}`,
            cx: x(index),
            cy: y(row.tokens),
            r: row.partial ? 4.2 : 2.8,
            fill: row.partial ? surface : accent,
            stroke: accent,
            "stroke-width": row.partial ? 2 : 1,
          })
        );
      });

      const guide = svgElement("line", {
        class: "github-activity-codex-guide",
        y1: top,
        y2: baseline,
        stroke: text,
        "stroke-width": 1.2,
      });
      const marker = svgElement("circle", {
        class: "github-activity-codex-marker",
        r: 4.5,
        fill: surface,
        stroke: accent,
        "stroke-width": 2.2,
      });
      const overlay = svgElement("rect", {
        class: "github-activity-codex-inspector",
        x: left,
        y: top,
        width: width - left - right,
        height: plotHeight,
        fill: "transparent",
        tabindex: 0,
        focusable: "true",
        role: "slider",
        "aria-label": `${grain === "daily" ? "Daily" : "Weekly"} Codex token inspector`,
        "aria-valuemin": 0,
        "aria-valuemax": rows.length - 1,
        "aria-describedby": "github-activity-codex-instructions",
      });
      chart.append(guide, marker, overlay);

      const showIndex = (index, pin = false) => {
        selectedIndex = clamp(index, 0, rows.length - 1);
        if (pin) pinnedIndex = selectedIndex;
        const row = rows[selectedIndex];
        const xx = x(selectedIndex);
        guide.setAttribute("x1", xx);
        guide.setAttribute("x2", xx);
        marker.setAttribute("cx", xx);
        marker.setAttribute("cy", y(row.tokens));
        overlay.setAttribute("aria-valuenow", selectedIndex);
        overlay.setAttribute(
          "aria-valuetext",
          `${grain === "daily" ? "Day of" : "Week of"} ${row.key}, ${number.format(row.tokens)} tokens, ${coverageLabel(row)}`
        );
        updateReadout(row);
      };
      const nearestIndex = (event) => {
        const box = chart.getBoundingClientRect();
        const px = ((event.clientX - box.left) / Math.max(1, box.width)) * width;
        const fraction = clamp((px - left) / Math.max(1, width - left - right), 0, 1);
        return Math.round(fraction * (rows.length - 1));
      };
      overlay.addEventListener("pointermove", (event) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") showIndex(nearestIndex(event));
      });
      overlay.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
        showIndex(nearestIndex(event), true);
        overlay.focus({ preventScroll: true });
      });
      overlay.addEventListener("pointerleave", (event) => {
        if (event.pointerType === "mouse") showIndex(pinnedIndex);
      });
      overlay.addEventListener("focus", () => chart.classList.add("is-keyboard-focused"));
      overlay.addEventListener("blur", () => chart.classList.remove("is-keyboard-focused"));
      overlay.addEventListener("keydown", (event) => {
        let next = selectedIndex;
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 1;
        else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 1;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = rows.length - 1;
        else return;
        event.preventDefault();
        showIndex(next, true);
      });
      showIndex(selectedIndex);
      updateTable(rows);
      if (restoreFocus) overlay.focus({ preventScroll: true });
    };

    grainButtons.forEach((button) => {
      button.addEventListener("click", () => {
        grain = button.dataset.codexGrain;
        selectedIndex = rowsForGrain().length - 1;
        pinnedIndex = selectedIndex;
        setPressedState();
        draw();
        chart.querySelector(".github-activity-codex-inspector")?.focus({ preventScroll: true });
      });
    });
    window.addEventListener("resize", () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(draw);
    });
    new MutationObserver(draw).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-theme-mode"],
    });

    status.hidden = true;
    selectionReadout.forEach((node) => {
      node.hidden = false;
    });
    grainButtons.forEach((button) => {
      button.disabled = false;
    });
    if (tableSection) tableSection.hidden = false;
    setPressedState();
    draw();
    trendRoot.dataset.state = "ready";
    trendRoot.setAttribute("aria-busy", "false");
  };

  void initCodexUsageTrend();

  const root = document.querySelector("[data-github-activity]");
  const dataNode = document.getElementById("github-activity-data");
  if (!root || !dataNode) return;

  const validCommitSource = (candidate) =>
    candidate?.schema === 2 &&
    typeof candidate.generatedAt === "string" &&
    Array.isArray(candidate.weeks) &&
    candidate.weeks.length > 0 &&
    candidate.weeks.every((row) => isIsoDate(row?.week) && Number.isInteger(row.commits) && row.commits >= 0);

  let source;
  try {
    source = JSON.parse(dataNode.textContent);
  } catch {
    root.dataset.state = "error";
    return;
  }
  if (!validCommitSource(source)) {
    root.dataset.state = "error";
    return;
  }

  const remoteSource = root.dataset.source;
  const isLocalPreview = /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  if (remoteSource && !isLocalPreview) {
    try {
      const response = await fetch(remoteSource, { cache: "no-store", credentials: "same-origin" });
      const remote = response.ok ? await response.json() : null;
      if (validCommitSource(remote)) source = remote;
      else root.dataset.sourceState = "fallback";
    } catch {
      root.dataset.sourceState = "fallback";
    }
  }

  const rows = source.weeks.map((row, index) => ({
    index,
    week: row.week,
    date: new Date(`${row.week}T00:00:00Z`),
    commits: row.commits,
  }));
  const chart = document.getElementById("github-activity-chart");
  const chartTitle = document.getElementById("github-activity-chart-title");
  const selectedDate = document.getElementById("github-activity-selected-date");
  const selectedCommits = document.getElementById("github-activity-selected-commits");
  const rangeSummary = document.getElementById("github-activity-range-summary");
  const selectionAnnouncement = document.getElementById("github-activity-selection-announcement");
  const annotation = document.getElementById("github-activity-annotation");
  const tableBody = document.getElementById("github-activity-table-body");
  const tableCaption = document.getElementById("github-activity-table-caption");
  const updated = document.getElementById("github-activity-updated");
  const scopeBadge = root.querySelector("[data-github-scope]");
  const rangeButtons = Array.from(root.querySelectorAll("[data-range]"));
  const scaleButtons = Array.from(root.querySelectorAll("[data-scale]"));
  const latestButton = root.querySelector("[data-jump-latest]");
  const clearSelectionButton = root.querySelector("[data-clear-selection]");
  if (
    !chart ||
    !chartTitle ||
    !selectedDate ||
    !selectedCommits ||
    !rangeSummary ||
    !selectionAnnouncement ||
    !annotation ||
    !tableBody ||
    !tableCaption ||
    !updated ||
    !latestButton ||
    !clearSelectionButton
  ) {
    root.dataset.state = "error";
    return;
  }

  root.dataset.sourceSchema = String(source.schema);
  root.dataset.inputModality = "pointer";
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  let range = "5";
  let scale = "log";
  let selectedIndex = rows.length - 1;
  let pinnedIndex = selectedIndex;
  let selection = null;
  let resizeFrame = 0;

  const percentile = (values, fraction) => {
    const ordered = [...values].sort((a, b) => a - b);
    if (!ordered.length) return 0;
    const position = clamp((ordered.length - 1) * fraction, 0, ordered.length - 1);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return ordered[lower];
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower);
  };
  const niceLinearScale = (maximum, count = 4) => {
    const rough = Math.max(1, maximum) / Math.max(1, count);
    const power = 10 ** Math.floor(Math.log10(rough));
    const fraction = rough / power;
    const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
    const step = niceFraction * power;
    const domainMaximum = Math.max(step, Math.ceil(maximum / step) * step);
    const ticks = [];
    for (let tick = step; tick <= domainMaximum + step * 0.01; tick += step) ticks.push(tick);
    return { domainMaximum, ticks };
  };
  const niceLogMaximum = (maximum) => {
    const safe = Math.max(1, maximum);
    const power = 10 ** Math.floor(Math.log10(safe));
    const fraction = safe / power;
    const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return niceFraction * power;
  };
  const selectedRows = () => {
    if (range === "all") return rows;
    const years = Number(range);
    const end = rows.at(-1).date;
    const cutoff = new Date(Date.UTC(end.getUTCFullYear() - years, end.getUTCMonth(), end.getUTCDate()));
    return rows.filter((row) => row.date >= cutoff);
  };
  const analysisRows = (data) => (selection ? data.filter((row) => row.index >= selection.start && row.index <= selection.end) : data);
  const colors = () => {
    const style = getComputedStyle(root);
    return {
      accent: style.getPropertyValue("--global-primary-color").trim() || "#b84f12",
      text: style.getPropertyValue("--global-text-color").trim() || "#211a16",
      muted: style.getPropertyValue("--global-text-color-light").trim() || "#6d6a62",
      grid: style.getPropertyValue("--global-divider-color").trim() || "rgba(90,88,72,.16)",
      surface: style.getPropertyValue("--global-surface-container-low-color").trim() || "#fffaf6",
    };
  };
  const setPressedState = () => {
    rangeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.range === range)));
    scaleButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.scale === scale)));
    if (scopeBadge) {
      const rangeLabel = range === "all" ? "ALL HISTORY" : `${range} ${range === "1" ? "YEAR" : "YEARS"}`;
      scopeBadge.textContent = `${rangeLabel} \u00b7 WEEKLY`;
    }
  };
  const updateWeekReadout = (row) => {
    selectedDate.textContent = `Week of ${dateLabel.format(row.date)}`;
    selectedCommits.textContent = `${number.format(row.commits)} ${row.commits === 1 ? "commit" : "commits"}`;
  };
  const updateTable = (data) => {
    const fragment = document.createDocumentFragment();
    [...data].reverse().forEach((row) => {
      const tr = document.createElement("tr");
      [row.week, number.format(row.commits)].forEach((value, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        if (index === 0) cell.scope = "row";
        cell.textContent = value;
        tr.append(cell);
      });
      fragment.append(tr);
    });
    tableBody.replaceChildren(fragment);
    tableCaption.textContent = selection ? "Exact weekly commits in the selected range" : "Exact weekly commits in the selected time window";
  };
  const updateAggregate = (data, announce = false) => {
    const scoped = analysisRows(data);
    const active = scoped.filter((row) => row.commits > 0);
    const totalCommits = scoped.reduce((sum, row) => sum + row.commits, 0);
    const scope = selection
      ? `Selected ${number.format(scoped.length)} ${scoped.length === 1 ? "week" : "weeks"}`
      : range === "all"
        ? "All history"
        : `${range} ${range === "1" ? "year" : "years"}`;
    const dates = `${dateLabel.format(scoped[0].date)} \u2014 ${dateLabel.format(scoped.at(-1).date)}`;
    rangeSummary.textContent = `${scope} \u00b7 ${dates} \u00b7 ${number.format(active.length)} active weeks \u00b7 ${number.format(totalCommits)} commits`;
    clearSelectionButton.hidden = !selection;

    if (active.length) {
      const busiest = active.reduce((best, row) => (row.commits > best.commits ? row : best));
      const median = percentile(
        active.map((row) => row.commits),
        0.5
      );
      annotation.textContent = `Highest commit week \u00b7 ${dateLabel.format(busiest.date)} \u00b7 ${number.format(busiest.commits)} commits. Median active week \u00b7 ${number.format(median)} commits.`;
    } else {
      annotation.textContent = "No active weeks in this scope. Median active week \u00b7 \u2014.";
    }
    updateTable(scoped);
    if (announce) selectionAnnouncement.textContent = selection ? rangeSummary.textContent : "Selection cleared.";
  };

  const drawChart = () => {
    const data = selectedRows();
    if (!data.length) return;
    if (!data.some((row) => row.index === selectedIndex)) selectedIndex = data.at(-1).index;
    if (!data.some((row) => row.index === pinnedIndex)) pinnedIndex = data.at(-1).index;
    const restoreKeyboardFocus = chart.contains(document.activeElement) && root.dataset.inputModality === "keyboard";
    chart.replaceChildren();

    const palette = colors();
    const width = chart.clientWidth || 920;
    const height = chart.clientHeight || 384;
    const narrow = width < 620;
    const left = narrow ? 58 : 72;
    const right = narrow ? 10 : 18;
    const top = 48;
    const bottom = narrow ? 44 : 48;
    const baseline = height - bottom;
    const plotHeight = baseline - top;
    const start = data[0].date.getTime();
    const end = data.at(-1).date.getTime();
    const span = Math.max(1, end - start);
    const rawMaximum = Math.max(...data.map((row) => row.commits), 1);
    const linear = niceLinearScale(rawMaximum, narrow ? 3 : 4);
    const domainMaximum = scale === "linear" ? linear.domainMaximum : niceLogMaximum(rawMaximum);
    const logMaximum = Math.log1p(domainMaximum);
    const x = (date) => left + ((date.getTime() - start) / span) * (width - left - right);
    const y = (value) => baseline - (scale === "linear" ? value / domainMaximum : Math.log1p(value) / logMaximum) * plotHeight;
    chart.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const grid = svgElement("g", { "aria-hidden": "true" });
    let ticks;
    if (scale === "linear") {
      ticks = [0, ...linear.ticks];
    } else {
      const candidates = new Set([0, domainMaximum]);
      for (let power = 0; 10 ** power <= domainMaximum; power += 1) {
        [1, 2, 5].forEach((multiple) => {
          const value = multiple * 10 ** power;
          if (value <= domainMaximum) candidates.add(value);
        });
      }
      ticks = [];
      [...candidates]
        .sort((a, b) => a - b)
        .forEach((value) => {
          const previous = ticks.at(-1);
          if (previous == null || Math.abs(y(previous) - y(value)) >= (narrow ? 15 : 18)) ticks.push(value);
        });
      if (!ticks.includes(domainMaximum)) {
        if (Math.abs(y(ticks.at(-1)) - y(domainMaximum)) < 15) ticks.pop();
        ticks.push(domainMaximum);
      }
    }
    ticks.forEach((tick) => {
      const yy = y(tick);
      grid.append(svgElement("line", { x1: left, y1: yy, x2: width - right, y2: yy, stroke: palette.grid, "stroke-width": 1 }));
      addText(grid, compactNumber.format(tick), left - 8, yy + 4, { anchor: "end", color: palette.muted, className: "github-activity-commit-tick" });
    });

    const yearTicks = new Set();
    data.forEach((row) => {
      const year = row.date.getUTCFullYear();
      if (yearTicks.has(year) || row.date.getUTCMonth() !== 0) return;
      yearTicks.add(year);
      const xx = x(row.date);
      grid.append(svgElement("line", { x1: xx, y1: top, x2: xx, y2: baseline, stroke: palette.grid, "stroke-width": 1 }));
      addText(grid, String(year), xx, height - 15, { anchor: "middle", color: palette.muted });
    });
    if (yearTicks.size < 2) {
      addText(grid, data[0].week, left, height - 15, { color: palette.muted });
      addText(grid, data.at(-1).week, width - right, height - 15, { anchor: "end", color: palette.muted });
    }
    chart.append(grid);
    addText(chart, `COMMITS / WEEK \u00b7 ${scale === "linear" ? "LITERAL LINEAR" : "READABLE LOG1P"}`, left, 22, {
      color: palette.accent,
      weight: 700,
    });

    let renderPeak = () => {};
    const selectionBand = svgElement("rect", {
      class: "github-activity-selection-band",
      y: top,
      height: plotHeight,
      fill: palette.accent,
      "fill-opacity": 0.1,
      stroke: palette.accent,
      "stroke-opacity": 0.62,
      "stroke-width": 1.2,
      visibility: "hidden",
      "pointer-events": "none",
    });
    chart.append(selectionBand);

    const points = data.map((row) => [x(row.date), y(row.commits)]);
    chart.append(
      svgElement("path", {
        class: "github-activity-commit-area",
        d: areaPath(points, baseline),
        fill: palette.accent,
        "fill-opacity": 0.1,
      }),
      svgElement("path", {
        class: "github-activity-commit-line",
        d: linePath(points),
        fill: "none",
        stroke: palette.accent,
        "stroke-width": 1.9,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      })
    );

    const peakGuide = svgElement("line", {
      class: "github-activity-peak-guide",
      y1: top,
      y2: baseline,
      stroke: palette.accent,
      "stroke-width": 1.3,
      "stroke-dasharray": "3 4",
      "stroke-opacity": 0.72,
    });
    chart.append(peakGuide);
    renderPeak = () => {
      const scoped = analysisRows(data);
      const active = scoped.filter((row) => row.commits > 0);
      if (!active.length) {
        peakGuide.setAttribute("visibility", "hidden");
        return;
      }
      const busiest = active.reduce((best, row) => (row.commits > best.commits ? row : best));
      const xx = x(busiest.date);
      peakGuide.setAttribute("x1", xx);
      peakGuide.setAttribute("x2", xx);
      peakGuide.setAttribute("visibility", "visible");
    };
    const renderSelection = () => {
      if (!selection) {
        selectionBand.setAttribute("visibility", "hidden");
        renderPeak();
        return;
      }
      const startPosition = data.findIndex((row) => row.index === selection.start);
      const endPosition = data.findIndex((row) => row.index === selection.end);
      if (startPosition < 0 || endPosition < 0) {
        selectionBand.setAttribute("visibility", "hidden");
        renderPeak();
        return;
      }
      const step = data.length > 1 ? (width - left - right) / (data.length - 1) : width - left - right;
      const x1 = Math.max(left, x(data[startPosition].date) - step / 2);
      const x2 = Math.min(width - right, x(data[endPosition].date) + step / 2);
      selectionBand.setAttribute("x", x1);
      selectionBand.setAttribute("width", Math.max(1, x2 - x1));
      selectionBand.setAttribute("visibility", "visible");
      renderPeak();
    };
    renderSelection();

    const guide = svgElement("line", {
      class: "github-activity-guide",
      y1: top,
      y2: baseline,
      stroke: palette.text,
      "stroke-width": 1.2,
      "stroke-opacity": 0.68,
    });
    const marker = svgElement("circle", {
      class: "github-activity-commit-marker",
      r: narrow ? 3.8 : 4.2,
      fill: palette.surface,
      stroke: palette.accent,
      "stroke-width": 2.1,
    });
    const overlay = svgElement("rect", {
      class: "github-activity-inspector",
      x: left,
      y: top,
      width: width - left - right,
      height: plotHeight,
      fill: "transparent",
      tabindex: 0,
      focusable: "true",
      role: "slider",
      "aria-label": "Weekly commit inspector",
      "aria-valuemin": 0,
      "aria-valuemax": data.length - 1,
      "aria-describedby": "github-activity-chart-instructions",
    });
    chart.append(guide, marker, overlay);

    const showIndex = (index, { pin = false } = {}) => {
      selectedIndex = clamp(index, data[0].index, data.at(-1).index);
      if (pin) pinnedIndex = selectedIndex;
      const row = rows[selectedIndex];
      const xx = x(row.date);
      guide.setAttribute("x1", xx);
      guide.setAttribute("x2", xx);
      marker.setAttribute("cx", xx);
      marker.setAttribute("cy", y(row.commits));
      overlay.setAttribute("aria-valuenow", String(selectedIndex - data[0].index));
      overlay.setAttribute("aria-valuetext", `Week of ${row.week}, ${number.format(row.commits)} commits`);
      updateWeekReadout(row);
    };
    const nearestRow = (event) => {
      const box = chart.getBoundingClientRect();
      const px = ((event.clientX - box.left) / Math.max(1, box.width)) * width;
      const fraction = clamp((px - left) / Math.max(1, width - left - right), 0, 1);
      return data[Math.round(fraction * (data.length - 1))];
    };
    let dragState = null;
    const restorePreviousSelection = () => {
      if (!dragState) return;
      chart.classList.remove("is-selecting");
      selection = dragState.previousSelection;
      renderSelection();
      updateAggregate(data);
      showIndex(pinnedIndex);
      dragState = null;
    };
    overlay.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
      root.dataset.inputModality = "pointer";
      chart.classList.remove("is-keyboard-focused");
      const row = nearestRow(event);
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startIndex: row.index,
        dragging: false,
        previousSelection: selection ? { ...selection } : null,
      };
      overlay.setPointerCapture?.(event.pointerId);
      showIndex(row.index);
      overlay.focus({ preventScroll: true });
    });
    overlay.addEventListener("pointermove", (event) => {
      const row = nearestRow(event);
      if (!dragState || dragState.pointerId !== event.pointerId) {
        if (event.pointerType === "mouse" || event.pointerType === "pen") showIndex(row.index);
        return;
      }
      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;
      if (event.pointerType !== "mouse" && Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) {
        if (overlay.hasPointerCapture?.(event.pointerId)) overlay.releasePointerCapture(event.pointerId);
        restorePreviousSelection();
        return;
      }
      if (!dragState.dragging && Math.abs(dx) >= 6 && row.index !== dragState.startIndex && Math.abs(dx) >= Math.abs(dy)) {
        dragState.dragging = true;
        chart.classList.add("is-selecting");
      }
      if (!dragState.dragging) {
        showIndex(row.index);
        return;
      }
      event.preventDefault();
      selection = {
        anchor: dragState.startIndex,
        start: Math.min(dragState.startIndex, row.index),
        end: Math.max(dragState.startIndex, row.index),
      };
      showIndex(row.index);
      renderSelection();
      updateAggregate(data);
    });
    overlay.addEventListener("pointerup", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const row = nearestRow(event);
      const wasDragging = dragState.dragging;
      chart.classList.remove("is-selecting");
      if (overlay.hasPointerCapture?.(event.pointerId)) overlay.releasePointerCapture(event.pointerId);
      dragState = null;
      showIndex(row.index, { pin: true });
      if (wasDragging) {
        renderSelection();
        updateAggregate(data, true);
      } else if (selection) {
        selection = null;
        renderSelection();
        updateAggregate(data, true);
      }
      overlay.focus({ preventScroll: true });
    });
    overlay.addEventListener("pointercancel", restorePreviousSelection);
    overlay.addEventListener("pointerleave", (event) => {
      if (!dragState && event.pointerType === "mouse") showIndex(pinnedIndex);
    });
    overlay.addEventListener("focus", () => {
      chart.classList.toggle("is-keyboard-focused", root.dataset.inputModality === "keyboard");
      showIndex(pinnedIndex);
    });
    overlay.addEventListener("blur", () => chart.classList.remove("is-keyboard-focused"));
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (!selection) return;
        event.preventDefault();
        selection = null;
        renderSelection();
        updateAggregate(data, true);
        return;
      }
      let next = selectedIndex;
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 1;
      else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 1;
      else if (event.key === "Home") next = data[0].index;
      else if (event.key === "End") next = data.at(-1).index;
      else if (event.key === "PageUp") next -= 4;
      else if (event.key === "PageDown") next += 4;
      else return;
      event.preventDefault();
      const nextIndex = clamp(next, data[0].index, data.at(-1).index);
      if (event.shiftKey && event.key.startsWith("Arrow")) {
        const anchor = selection?.anchor ?? selectedIndex;
        selection = { anchor, start: Math.min(anchor, nextIndex), end: Math.max(anchor, nextIndex) };
        showIndex(nextIndex, { pin: true });
        renderSelection();
        updateAggregate(data, true);
      } else {
        showIndex(nextIndex, { pin: true });
      }
    });

    showIndex(selectedIndex);
    updateAggregate(data);
    if (restoreKeyboardFocus) overlay.focus({ preventScroll: true });
  };

  root.addEventListener(
    "pointerdown",
    () => {
      root.dataset.inputModality = "pointer";
    },
    true
  );
  root.addEventListener(
    "keydown",
    () => {
      root.dataset.inputModality = "keyboard";
      if (document.activeElement?.classList?.contains("github-activity-inspector")) chart.classList.add("is-keyboard-focused");
    },
    true
  );
  rangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      range = button.dataset.range;
      selection = null;
      const data = selectedRows();
      selectedIndex = data.at(-1).index;
      pinnedIndex = selectedIndex;
      setPressedState();
      drawChart();
    });
  });
  scaleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      scale = button.dataset.scale;
      setPressedState();
      drawChart();
    });
  });
  latestButton.addEventListener("click", (event) => {
    selection = null;
    selectedIndex = rows.length - 1;
    pinnedIndex = selectedIndex;
    root.dataset.inputModality = event.detail === 0 ? "keyboard" : "pointer";
    drawChart();
    chart.querySelector(".github-activity-inspector")?.focus({ preventScroll: true });
  });
  clearSelectionButton.addEventListener("click", (event) => {
    selection = null;
    root.dataset.inputModality = event.detail === 0 ? "keyboard" : "pointer";
    selectionAnnouncement.textContent = "Selection cleared.";
    drawChart();
    chart.querySelector(".github-activity-inspector")?.focus({ preventScroll: true });
  });
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(drawChart);
  });
  new MutationObserver(drawChart).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-theme-mode"],
  });

  updated.dateTime = source.generatedAt;
  updated.textContent = String(source.generatedAt).slice(0, 10);
  chartTitle.textContent = "Weekly GitHub commits";
  setPressedState();
  drawChart();
  root.dataset.state = "ready";
})();
