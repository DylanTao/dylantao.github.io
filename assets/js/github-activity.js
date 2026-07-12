(async () => {
  const root = document.querySelector("[data-github-activity]");
  const dataNode = document.getElementById("github-activity-data");
  const tierNode = document.getElementById("github-activity-ai-tiers");
  if (!root || !dataNode) return;

  const isValidSource = (candidate) =>
    (candidate?.schema === 1 || candidate?.schema === 2) &&
    typeof candidate.generatedAt === "string" &&
    Array.isArray(candidate.weeks) &&
    candidate.weeks.length > 0 &&
    candidate.weeks.every(
      (row) =>
        /^\d{4}-\d{2}-\d{2}$/.test(row?.week) &&
        (candidate.schema === 1 || (Number.isInteger(row.commits) && row.commits >= 0)) &&
        Number.isInteger(row.additions) &&
        row.additions >= 0 &&
        Number.isInteger(row.deletions) &&
        row.deletions >= 0
    );
  const isValidTierSource = (candidate) =>
    candidate?.schema === 1 &&
    candidate.assignment === "week_midpoint_wednesday" &&
    Array.isArray(candidate.phases) &&
    candidate.phases.every(
      (phase) =>
        typeof phase?.key === "string" &&
        typeof phase?.label === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(phase.start) &&
        (phase.end == null || /^\d{4}-\d{2}-\d{2}$/.test(phase.end)) &&
        [20, 100, 200].includes(phase.tier_usd)
    );

  let source;
  try {
    source = JSON.parse(dataNode.textContent);
  } catch {
    root.setAttribute("data-state", "error");
    return;
  }
  if (!isValidSource(source)) {
    root.setAttribute("data-state", "error");
    return;
  }

  let tierSource = null;
  try {
    const candidate = tierNode ? JSON.parse(tierNode.textContent) : null;
    if (isValidTierSource(candidate)) tierSource = candidate;
  } catch {
    tierSource = null;
  }

  const remoteSource = root.dataset.source;
  const isLocalPreview = /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  if (remoteSource && !isLocalPreview) {
    try {
      const response = await fetch(remoteSource, { cache: "no-store", credentials: "same-origin" });
      const remote = response.ok ? await response.json() : null;
      if (isValidSource(remote)) source = remote;
      else root.setAttribute("data-source-state", "fallback");
    } catch {
      root.setAttribute("data-source-state", "fallback");
    }
  }

  const DAY = 86_400_000;
  const HALF_WEEK = 3.5 * DAY;
  const hasCommitData = source.schema === 2;
  const tierPhases = tierSource?.phases || [];
  const tierForDate = (date) => {
    const midpoint = new Date(date.getTime() + 3 * DAY).toISOString().slice(0, 10);
    return tierPhases.find((phase) => midpoint >= phase.start && (phase.end == null || midpoint <= phase.end)) || null;
  };

  root.setAttribute("data-source-schema", String(source.schema));
  root.setAttribute("data-has-commits", String(hasCommitData));
  root.setAttribute("data-has-tier-context", String(Boolean(tierSource)));
  root.setAttribute("data-input-modality", "pointer");
  root.querySelectorAll("[data-commit-only]").forEach((node) => {
    node.hidden = !hasCommitData;
  });

  const rows = source.weeks.map((row, index) => {
    const date = new Date(row.week + "T00:00:00Z");
    return {
      index,
      week: row.week,
      date,
      commits: hasCommitData ? row.commits : null,
      additions: row.additions,
      deletions: row.deletions,
      tier: tierForDate(date),
    };
  });
  const NS = "http://www.w3.org/2000/svg";
  const chart = document.getElementById("github-activity-chart");
  const chartTitle = document.getElementById("github-activity-chart-title");
  const selectedDate = document.getElementById("github-activity-selected-date");
  const selectedCommits = document.getElementById("github-activity-selected-commits");
  const selectedAdditions = document.getElementById("github-activity-selected-additions");
  const selectedDeletions = document.getElementById("github-activity-selected-deletions");
  const selectedTier = document.getElementById("github-activity-selected-tier");
  const rangeSummary = document.getElementById("github-activity-range-summary");
  const selectionAnnouncement = document.getElementById("github-activity-selection-announcement");
  const annotation = document.getElementById("github-activity-annotation");
  const tableBody = document.getElementById("github-activity-table-body");
  const tableCaption = document.getElementById("github-activity-table-caption");
  const tierTableBody = document.getElementById("github-activity-tier-table-body");
  const tierTableCaption = document.getElementById("github-activity-tier-caption");
  const updated = document.getElementById("github-activity-updated");
  const rangeButtons = Array.from(root.querySelectorAll("[data-range]"));
  const scaleButtons = Array.from(root.querySelectorAll("[data-scale]"));
  const latestButton = root.querySelector("[data-jump-latest]");
  const clearSelectionButton = root.querySelector("[data-clear-selection]");
  const number = new Intl.NumberFormat("en-US");
  const short = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const mobile = window.matchMedia("(max-width: 700px)");
  let range = mobile.matches ? "1" : "5";
  let scale = "symlog";
  let selectedIndex = rows.length - 1;
  let pinnedIndex = rows.length - 1;
  let selection = null;
  let resizeFrame = 0;

  const element = (name, attributes = {}) => {
    const node = document.createElementNS(NS, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };
  const addText = (parent, value, x, y, anchor, color, weight, className) => {
    const node = element("text", {
      x,
      y,
      "text-anchor": anchor || "start",
      fill: color,
      "font-weight": weight || 500,
      ...(className ? { class: className } : {}),
    });
    node.textContent = value;
    parent.append(node);
    return node;
  };
  const compact = (value) => short.format(Math.abs(value));
  const signed = (value, positive) => (positive ? "+" : "\u2212") + number.format(Math.abs(value));
  const pathFor = (points) => points.map((point, index) => (index ? "L " : "M ") + point[0].toFixed(2) + " " + point[1].toFixed(2)).join(" ");
  const areaPath = (points, baseline) =>
    points.length
      ? "M " +
        points[0][0].toFixed(2) +
        " " +
        baseline.toFixed(2) +
        " " +
        points.map((point) => "L " + point[0].toFixed(2) + " " + point[1].toFixed(2)).join(" ") +
        " L " +
        points.at(-1)[0].toFixed(2) +
        " " +
        baseline.toFixed(2) +
        " Z"
      : "";
  const percentile = (values, p) => {
    const ordered = [...values].sort((a, b) => a - b);
    if (ordered.length === 0) return 0;
    const position = Math.min(ordered.length - 1, Math.max(0, (ordered.length - 1) * p));
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
  const buildTierRuns = (data) =>
    data.reduce((runs, row, index) => {
      const key = row.tier?.key ?? null;
      const previous = runs.at(-1);
      const priorRow = data[index - 1];
      const adjacent = !priorRow || row.date.getTime() - priorRow.date.getTime() === 7 * DAY;
      if (!previous || previous.key !== key || !adjacent) {
        runs.push({ key, tier: row.tier, first: row, last: row });
      } else {
        previous.last = row;
      }
      return runs;
    }, []);
  const colors = () => {
    const style = getComputedStyle(root);
    return {
      added: style.getPropertyValue("--global-sky-strong").trim() || "#357f9e",
      removed: style.getPropertyValue("--global-mint-strong").trim() || "#387768",
      addedText: style.getPropertyValue("--github-activity-added-text").trim() || "#316980",
      removedText: style.getPropertyValue("--github-activity-removed-text").trim() || "#326b5d",
      accent: style.getPropertyValue("--global-primary-color").trim() || "#b84f12",
      text: style.getPropertyValue("--global-text-color").trim() || "#211a16",
      muted: style.getPropertyValue("--global-text-color-light").trim() || "#6d6a62",
      grid: style.getPropertyValue("--global-divider-color").trim() || "rgba(90,88,72,.16)",
      surface: style.getPropertyValue("--global-surface-container-low-color").trim() || "#fffaf6",
      tier20: style.getPropertyValue("--github-activity-tier-20").trim() || "#d6a273",
      tier100: style.getPropertyValue("--github-activity-tier-100").trim() || "#c97836",
      tier200: style.getPropertyValue("--github-activity-tier-200").trim() || "#9f4c18",
      tier200Text: style.getPropertyValue("--github-activity-tier-200-text").trim() || "#ffffff",
    };
  };
  const setPressedState = () => {
    rangeButtons.forEach((button) => button.setAttribute("aria-pressed", button.dataset.range === range ? "true" : "false"));
    scaleButtons.forEach((button) => button.setAttribute("aria-pressed", button.dataset.scale === scale ? "true" : "false"));
  };

  const tierDateRange = (tier) => {
    const start = dateLabel.format(new Date(tier.start + "T00:00:00Z"));
    return tier.end ? start + " — " + dateLabel.format(new Date(tier.end + "T00:00:00Z")) : "since " + start;
  };
  const updateTierReadout = (tier) => {
    selectedTier.textContent = tier ? "Plan · " + tier.label + " · " + tierDateRange(tier) : "Plan · before tracked price history";
  };
  const updateWeekReadout = (row) => {
    selectedDate.textContent = "Week of " + dateLabel.format(row.date);
    if (hasCommitData) selectedCommits.textContent = number.format(row.commits) + (row.commits === 1 ? " commit" : " commits");
    selectedAdditions.textContent = signed(row.additions, true) + " added";
    selectedDeletions.textContent = signed(row.deletions, false) + " removed";
    updateTierReadout(row.tier);
  };
  const updateTable = (data) => {
    const fragment = document.createDocumentFragment();
    [...data].reverse().forEach((row) => {
      const tr = document.createElement("tr");
      const values = [
        row.week,
        ...(hasCommitData ? [number.format(row.commits)] : []),
        "+" + number.format(row.additions),
        "\u2212" + number.format(row.deletions),
        number.format(row.additions + row.deletions),
      ];
      values.forEach((value, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        if (index === 0) cell.scope = "row";
        cell.textContent = value;
        tr.append(cell);
      });
      fragment.append(tr);
    });
    tableBody.replaceChildren(fragment);
    tableCaption.textContent = selection ? "Exact weekly values in the selected range" : "Exact weekly values in the selected time window";
  };
  const updateTierTable = (data) => {
    if (!tierTableBody) return;
    const groups = new Map();
    data.forEach((row) => {
      if (!row.tier) return;
      const key = String(row.tier.tier_usd);
      const group = groups.get(key) || {
        label: row.tier.label,
        tier: row.tier.tier_usd,
        observed: 0,
        active: [],
      };
      group.observed += 1;
      if ((hasCommitData && row.commits) || row.additions || row.deletions) group.active.push(row);
      groups.set(key, group);
    });
    const fragment = document.createDocumentFragment();
    if (groups.size === 0) {
      const tr = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.className = "github-activity-tier-empty";
      cell.textContent = "No tracked plan price overlaps this scope.";
      tr.append(cell);
      fragment.append(tr);
    }
    [...groups.values()]
      .sort((a, b) => a.tier - b.tier)
      .forEach((group) => {
        const tr = document.createElement("tr");
        const hasActiveWeeks = group.active.length > 0;
        const medianCommits =
          hasCommitData && hasActiveWeeks
            ? percentile(
                group.active.map((row) => row.commits),
                0.5
              )
            : null;
        const medianLines = hasActiveWeeks
          ? percentile(
              group.active.map((row) => row.additions + row.deletions),
              0.5
            )
          : null;
        [
          group.label,
          number.format(group.active.length) + " / " + number.format(group.observed),
          medianCommits == null ? "\u2014" : number.format(medianCommits),
          medianLines == null ? "\u2014" : number.format(medianLines),
        ].forEach((value, index) => {
          const cell = document.createElement(index === 0 ? "th" : "td");
          if (index === 0) cell.scope = "row";
          cell.textContent = value;
          tr.append(cell);
        });
        fragment.append(tr);
      });
    tierTableBody.replaceChildren(fragment);
    tierTableCaption.textContent = selection ? "Plan-price comparison for the selected range" : "Plan-price comparison for the current time window";
  };
  const updateAggregate = (data, announce = false) => {
    const scoped = analysisRows(data);
    const active = scoped.filter((item) => (hasCommitData && item.commits) || item.additions || item.deletions);
    const commits = hasCommitData ? scoped.reduce((sum, item) => sum + item.commits, 0) : null;
    const additions = scoped.reduce((sum, item) => sum + item.additions, 0);
    const deletions = scoped.reduce((sum, item) => sum + item.deletions, 0);
    const scope = selection
      ? "Selected " + number.format(scoped.length) + (scoped.length === 1 ? " week" : " weeks")
      : range === "all"
        ? "All history"
        : range + (range === "1" ? " year" : " years");
    const dateRange = dateLabel.format(scoped[0].date) + " \u2014 " + dateLabel.format(scoped.at(-1).date);
    rangeSummary.textContent =
      scope +
      " \u00b7 " +
      dateRange +
      " \u00b7 " +
      number.format(active.length) +
      " active weeks \u00b7 " +
      (hasCommitData ? number.format(commits) + " commits \u00b7 " : "") +
      "+" +
      compact(additions) +
      " added \u00b7 \u2212" +
      compact(deletions) +
      " removed";
    clearSelectionButton.hidden = !selection;

    const largest = scoped.reduce((best, item) =>
      Math.max(item.additions, item.deletions) > Math.max(best.additions, best.deletions) ? item : best
    );
    const busiest = hasCommitData ? scoped.reduce((best, item) => (item.commits > best.commits ? item : best)) : null;
    const medianMagnitude = percentile(
      active.map((item) => Math.max(item.additions, item.deletions)),
      0.5
    );
    annotation.textContent = active.length
      ? "Largest line-change week \u00b7 " +
        dateLabel.format(largest.date) +
        " \u00b7 +" +
        compact(largest.additions) +
        " / \u2212" +
        compact(largest.deletions) +
        (hasCommitData ? ". Highest commit week \u00b7 " + dateLabel.format(busiest.date) + " \u00b7 " + number.format(busiest.commits) : "") +
        ". Median active-week line magnitude \u00b7 " +
        compact(medianMagnitude) +
        "."
      : "No active weeks in this scope. Median active-week line magnitude \u00b7 \u2014.";
    updateTable(scoped);
    updateTierTable(scoped);
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
    const height = chart.clientHeight || 608;
    const narrow = width < 620;
    const left = narrow ? 66 : 82;
    const right = narrow ? 12 : 22;
    const bottom = narrow ? 46 : 52;
    const ribbonTop = 31;
    const ribbonHeight = 10;
    const commitTop = tierSource ? 58 : 48;
    const commitHeight = hasCommitData ? Math.max(92, Math.min(122, height * 0.19)) : 0;
    const commitBottom = commitTop + commitHeight;
    const lineTop = hasCommitData ? commitBottom + (narrow ? 58 : 64) : tierSource ? 84 : 54;
    const lineBottom = height - bottom;
    const plotTop = hasCommitData ? commitTop : lineTop;
    const baseline = (lineTop + lineBottom) / 2;
    const half = Math.max(20, (lineBottom - lineTop) / 2 - 12);
    const start = data[0].date.getTime();
    const end = data.at(-1).date.getTime();
    const span = Math.max(1, end - start);
    const rawLineMaximum = Math.max(...data.flatMap((row) => [row.additions, row.deletions]), 1);
    const rawCommitMaximum = hasCommitData ? Math.max(...data.map((row) => row.commits), 1) : 1;
    const lineLinear = niceLinearScale(rawLineMaximum, narrow ? 3 : 4);
    const commitLinear = niceLinearScale(rawCommitMaximum, narrow ? 3 : 4);
    const lineDomainMaximum = scale === "linear" ? lineLinear.domainMaximum : niceLogMaximum(rawLineMaximum);
    const commitDomainMaximum = scale === "linear" ? commitLinear.domainMaximum : niceLogMaximum(rawCommitMaximum);
    const lineLogMaximum = Math.log1p(lineDomainMaximum);
    const commitLogMaximum = Math.log1p(commitDomainMaximum);
    const x = (date) => left + ((date.getTime() - start) / span) * (width - left - right);
    const lineTransform = (value) => (scale === "linear" ? value / lineDomainMaximum : Math.log1p(value) / lineLogMaximum);
    const y = (value) => baseline - Math.sign(value) * lineTransform(Math.abs(value)) * half;
    const commitY = (value) =>
      commitBottom - (scale === "linear" ? value / commitDomainMaximum : Math.log1p(value) / commitLogMaximum) * commitHeight;
    chart.setAttribute("viewBox", "0 0 " + width + " " + height);

    const grid = element("g", { "aria-hidden": "true" });
    chart.append(grid);
    const lineTicks =
      scale === "linear"
        ? lineLinear.ticks
        : Array.from({ length: Math.max(1, Math.ceil(Math.log10(lineDomainMaximum)) + 1) }, (_, index) => 10 ** index).filter(
            (tick) => tick <= lineDomainMaximum
          );
    lineTicks.forEach((tick) => {
      [1, -1].forEach((direction) => {
        const yy = y(direction * tick);
        grid.append(element("line", { x1: left, y1: yy, x2: width - right, y2: yy, stroke: palette.grid, "stroke-width": 1 }));
        addText(grid, (direction > 0 ? "+" : "\u2212") + compact(tick), left - 8, yy + 4, "end", palette.muted, 500);
      });
    });
    grid.append(
      element("line", { x1: left, y1: baseline, x2: width - right, y2: baseline, stroke: palette.text, "stroke-opacity": 0.38, "stroke-width": 1.4 })
    );

    const yearTicks = new Set();
    data.forEach((row) => {
      const year = row.date.getUTCFullYear();
      if (!yearTicks.has(year) && row.date.getUTCMonth() === 0) {
        yearTicks.add(year);
        const xx = x(row.date);
        grid.append(element("line", { x1: xx, y1: plotTop, x2: xx, y2: lineBottom, stroke: palette.grid, "stroke-width": 1 }));
        addText(grid, String(year), xx, height - 17, "middle", palette.muted, 500);
      }
    });
    if (yearTicks.size < 2) {
      addText(grid, data[0].week, left, height - 17, "start", palette.muted, 500);
      addText(grid, data.at(-1).week, width - right, height - 17, "end", palette.muted, 500);
    }

    if (tierSource) {
      const ribbon = element("g", { class: "github-activity-tier-ribbon", "aria-hidden": "true" });
      const tierHits = element("g", { class: "github-activity-tier-hit-layer", "aria-label": "Plan price ribbon" });
      ribbon.append(
        element("rect", {
          class: "github-activity-tier-track",
          x: left,
          y: ribbonTop,
          width: width - left - right,
          height: ribbonHeight,
          fill: palette.grid,
          "fill-opacity": 0.18,
        })
      );
      buildTierRuns(data).forEach((run) => {
        if (!run.tier) return;
        const boundaryStart = Math.max(start, run.first.date.getTime() - HALF_WEEK);
        const boundaryEnd = Math.min(end, run.last.date.getTime() + HALF_WEEK);
        const x1 = data.length === 1 ? left : x(new Date(boundaryStart));
        const x2 = data.length === 1 ? width - right : x(new Date(boundaryEnd));
        const fill = run.tier.tier_usd === 20 ? palette.tier20 : run.tier.tier_usd === 100 ? palette.tier100 : palette.tier200;
        const visualRun = element("rect", {
          class: "github-activity-tier-run",
          "data-tier-key": run.key,
          "data-first-week": run.first.week,
          "data-last-week": run.last.week,
          x: x1,
          y: ribbonTop,
          width: Math.max(1, x2 - x1),
          height: ribbonHeight,
          fill,
        });
        ribbon.append(visualRun);
        if (x2 - x1 >= (narrow ? 52 : 64)) {
          addText(
            ribbon,
            run.tier.label,
            (x1 + x2) / 2,
            ribbonTop + 8,
            "middle",
            run.tier.tier_usd === 200 ? palette.tier200Text : palette.text,
            650,
            "github-activity-tier-label"
          );
        }
        const segmentWidth = Math.max(1, x2 - x1);
        const hitWidth = Math.min(width - left - right, Math.max(24, segmentWidth));
        const hitX = Math.max(left, Math.min(width - right - hitWidth, (x1 + x2 - hitWidth) / 2));
        const titleText = run.tier.label + " · " + tierDateRange(run.tier);
        const hit = element("rect", {
          class: "github-activity-tier-hit",
          "data-tier-key": run.key,
          x: hitX,
          y: ribbonTop - 7,
          width: hitWidth,
          height: 24,
          tabindex: 0,
          focusable: "true",
          role: "button",
          "aria-label": "Plan " + titleText,
        });
        const title = element("title");
        title.textContent = titleText;
        hit.append(title);
        const inspectTier = () => {
          ribbon.querySelectorAll(".github-activity-tier-run").forEach((node) => node.classList.remove("is-inspected"));
          visualRun.classList.add("is-inspected");
          updateTierReadout(run.tier);
        };
        const restoreWeekTier = () => {
          visualRun.classList.remove("is-inspected");
          updateTierReadout(rows[selectedIndex].tier);
        };
        hit.addEventListener("pointerenter", inspectTier);
        hit.addEventListener("pointerdown", (event) => {
          root.dataset.inputModality = "pointer";
          inspectTier();
          if (event.pointerType !== "mouse") hit.focus({ preventScroll: true });
        });
        hit.addEventListener("pointerleave", () => {
          if (document.activeElement !== hit) restoreWeekTier();
        });
        hit.addEventListener("focus", inspectTier);
        hit.addEventListener("blur", restoreWeekTier);
        hit.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          inspectTier();
        });
        tierHits.append(hit);
      });
      chart.append(ribbon, tierHits);
    }

    let renderPeak = () => {};
    const selectionBand = element("rect", {
      class: "github-activity-selection-band",
      y: plotTop,
      height: lineBottom - plotTop,
      fill: palette.accent,
      "fill-opacity": 0.1,
      stroke: palette.accent,
      "stroke-opacity": 0.62,
      "stroke-width": 1.2,
      visibility: "hidden",
      "pointer-events": "none",
    });
    chart.append(selectionBand);
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

    const lineMode = scale === "linear" ? "LITERAL LINEAR" : "READABLE SYMLOG";
    const commitMode = scale === "linear" ? "LITERAL LINEAR" : "READABLE LOG1P";
    if (hasCommitData) addText(chart, "COMMITS / WEEK \u00b7 " + commitMode, left, 18, "start", palette.accent, 700);
    addText(chart, "LINES CHANGED / WEEK \u00b7 " + lineMode, left, lineTop - 34, "start", palette.muted, 700);
    addText(chart, "+ added", left, lineTop - 14, "start", palette.addedText, 650);
    addText(chart, "\u2212 removed", left + (narrow ? 76 : 86), lineTop - 14, "start", palette.removedText, 650);

    const addPoints = data.map((row) => [x(row.date), y(row.additions)]);
    const removePoints = data.map((row) => [x(row.date), y(-row.deletions)]);
    const addStems = data
      .map((row) => "M " + x(row.date).toFixed(2) + " " + baseline.toFixed(2) + " L " + x(row.date).toFixed(2) + " " + y(row.additions).toFixed(2))
      .join(" ");
    const removeStems = data
      .map((row) => "M " + x(row.date).toFixed(2) + " " + baseline.toFixed(2) + " L " + x(row.date).toFixed(2) + " " + y(-row.deletions).toFixed(2))
      .join(" ");
    chart.append(element("path", { d: addStems, fill: "none", stroke: palette.added, "stroke-opacity": 0.2, "stroke-width": 1 }));
    chart.append(element("path", { d: removeStems, fill: "none", stroke: palette.removed, "stroke-opacity": 0.2, "stroke-width": 1 }));
    chart.append(
      element("path", {
        class: "github-activity-add-line",
        d: pathFor(addPoints),
        fill: "none",
        stroke: palette.added,
        "stroke-width": 1.7,
        "stroke-linejoin": "round",
      })
    );
    chart.append(
      element("path", {
        class: "github-activity-remove-line",
        d: pathFor(removePoints),
        fill: "none",
        stroke: palette.removed,
        "stroke-width": 1.7,
        "stroke-dasharray": "4 2",
        "stroke-linejoin": "round",
      })
    );

    if (hasCommitData) {
      grid.append(element("line", { x1: left, y1: commitTop, x2: width - right, y2: commitTop, stroke: palette.grid, "stroke-width": 1 }));
      grid.append(
        element("line", {
          x1: left,
          y1: commitBottom,
          x2: width - right,
          y2: commitBottom,
          stroke: palette.text,
          "stroke-opacity": 0.38,
          "stroke-width": 1.2,
        })
      );
      let commitTicks;
      if (scale === "linear") {
        commitTicks = [0, ...commitLinear.ticks];
      } else {
        const candidates = new Set([0, commitDomainMaximum]);
        for (let power = 0; 10 ** power <= commitDomainMaximum; power += 1) {
          [1, 2, 5].forEach((multiple) => {
            const value = multiple * 10 ** power;
            if (value <= commitDomainMaximum) candidates.add(value);
          });
        }
        const ordered = [...candidates].sort((a, b) => a - b);
        commitTicks = [];
        ordered.forEach((value) => {
          const yy = commitY(value);
          const previous = commitTicks.at(-1);
          if (previous == null || Math.abs(commitY(previous) - yy) >= (narrow ? 14 : 17)) commitTicks.push(value);
        });
        if (!commitTicks.includes(commitDomainMaximum)) {
          if (Math.abs(commitY(commitTicks.at(-1)) - commitY(commitDomainMaximum)) < 14) commitTicks.pop();
          commitTicks.push(commitDomainMaximum);
        }
      }
      commitTicks.forEach((tick) => {
        const yy = commitY(tick);
        grid.append(element("line", { x1: left, y1: yy, x2: width - right, y2: yy, stroke: palette.grid, "stroke-width": 1 }));
        addText(grid, compact(tick), left - 8, yy + 4, "end", palette.muted, 500, "github-activity-commit-tick");
      });
      const commitPoints = data.map((row) => [x(row.date), commitY(row.commits)]);
      chart.append(element("path", { d: areaPath(commitPoints, commitBottom), fill: palette.accent, "fill-opacity": 0.1 }));
      chart.append(
        element("path", {
          class: "github-activity-commit-line",
          d: pathFor(commitPoints),
          fill: "none",
          stroke: palette.accent,
          "stroke-width": 1.7,
          "stroke-linejoin": "round",
        })
      );
    }

    const peakGuide = element("line", {
      y1: plotTop,
      y2: lineBottom,
      stroke: palette.accent,
      "stroke-width": 1.3,
      "stroke-dasharray": "3 4",
      "stroke-opacity": 0.82,
    });
    chart.append(peakGuide);
    renderPeak = () => {
      const scoped = analysisRows(data);
      const largest = scoped.reduce((best, item) =>
        Math.max(item.additions, item.deletions) > Math.max(best.additions, best.deletions) ? item : best
      );
      const largestX = x(largest.date);
      peakGuide.setAttribute("x1", largestX);
      peakGuide.setAttribute("x2", largestX);
    };
    renderPeak();

    const guide = element("line", {
      class: "github-activity-guide",
      y1: plotTop,
      y2: lineBottom,
      stroke: palette.text,
      "stroke-width": 1.2,
      "stroke-opacity": 0.68,
    });
    const commitDot = hasCommitData
      ? element("circle", {
          class: "github-activity-commit-marker",
          r: narrow ? 3.6 : 4,
          fill: palette.surface,
          stroke: palette.accent,
          "stroke-width": 2.1,
        })
      : null;
    const addDot = element("circle", { r: narrow ? 4 : 4.5, fill: palette.surface, stroke: palette.added, "stroke-width": 2.2 });
    const removeDot = element("circle", { r: narrow ? 4 : 4.5, fill: palette.surface, stroke: palette.removed, "stroke-width": 2.2 });
    chart.append(guide);
    if (commitDot) chart.append(commitDot);
    chart.append(addDot, removeDot);

    const overlay = element("rect", {
      class: "github-activity-inspector",
      x: left,
      y: plotTop,
      width: width - left - right,
      height: lineBottom - plotTop,
      fill: "transparent",
      tabindex: 0,
      focusable: "true",
      role: "slider",
      "aria-label": hasCommitData ? "Weekly commit and line-change inspector" : "Weekly line-change inspector",
      "aria-valuemin": 0,
      "aria-valuemax": data.length - 1,
      "aria-describedby": "github-activity-chart-instructions",
    });
    const showIndex = (index, { pin = false } = {}) => {
      const next = Math.max(data[0].index, Math.min(data.at(-1).index, index));
      selectedIndex = next;
      if (pin) pinnedIndex = next;
      const row = rows[selectedIndex];
      const xx = x(row.date);
      guide.setAttribute("x1", xx);
      guide.setAttribute("x2", xx);
      if (commitDot) {
        commitDot.setAttribute("cx", xx);
        commitDot.setAttribute("cy", commitY(row.commits));
      }
      addDot.setAttribute("cx", xx);
      addDot.setAttribute("cy", y(row.additions));
      removeDot.setAttribute("cx", xx);
      removeDot.setAttribute("cy", y(-row.deletions));
      overlay.setAttribute("aria-valuenow", String(selectedIndex - data[0].index));
      overlay.setAttribute(
        "aria-valuetext",
        "Week of " +
          row.week +
          ", " +
          (hasCommitData ? number.format(row.commits) + " commits, " : "") +
          signed(row.additions, true) +
          " added, " +
          signed(row.deletions, false) +
          " removed" +
          (row.tier ? ", plan " + row.tier.label : "")
      );
      updateWeekReadout(row);
    };
    const nearestRow = (event) => {
      const box = chart.getBoundingClientRect();
      const px = ((event.clientX - box.left) / Math.max(1, box.width)) * width;
      const fraction = Math.max(0, Math.min(1, (px - left) / Math.max(1, width - left - right)));
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
      if (overlay.setPointerCapture) overlay.setPointerCapture(event.pointerId);
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
      const clamped = Math.max(data[0].index, Math.min(data.at(-1).index, next));
      if (event.shiftKey && event.key.startsWith("Arrow")) {
        const anchor = selection?.anchor ?? selectedIndex;
        selection = { anchor, start: Math.min(anchor, clamped), end: Math.max(anchor, clamped) };
        showIndex(clamped, { pin: true });
        renderSelection();
        updateAggregate(data, true);
      } else {
        showIndex(clamped, { pin: true });
      }
    });
    chart.append(overlay);
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
      if (document.activeElement?.classList?.contains("github-activity-inspector")) {
        chart.classList.add("is-keyboard-focused");
      }
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
  new MutationObserver(() => drawChart()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-theme-mode"],
  });

  updated.dateTime = source.generatedAt;
  updated.textContent = String(source.generatedAt).slice(0, 10);
  chartTitle.textContent = hasCommitData ? "Weekly commits, additions, and deletions" : "Weekly additions and deletions";
  setPressedState();
  drawChart();
  root.setAttribute("data-state", "ready");
})();
