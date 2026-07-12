(async () => {
  const root = document.querySelector("[data-github-activity]");
  const dataNode = document.getElementById("github-activity-data");
  if (!root || !dataNode) return;

  const isValidSource = (candidate) =>
    candidate?.schema === 1 &&
    typeof candidate.generatedAt === "string" &&
    Array.isArray(candidate.weeks) &&
    candidate.weeks.length > 0 &&
    candidate.weeks.every(
      (row) =>
        /^\d{4}-\d{2}-\d{2}$/.test(row?.week) &&
        Number.isFinite(Number(row.additions)) &&
        Number(row.additions) >= 0 &&
        Number.isFinite(Number(row.deletions)) &&
        Number(row.deletions) >= 0
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

  const rows = source.weeks.map((row, index) => ({
    index,
    week: row.week,
    date: new Date(row.week + "T00:00:00Z"),
    additions: Number(row.additions),
    deletions: Number(row.deletions),
  }));
  const NS = "http://www.w3.org/2000/svg";
  const chart = document.getElementById("github-activity-chart");
  const selectedDate = document.getElementById("github-activity-selected-date");
  const selectedAdditions = document.getElementById("github-activity-selected-additions");
  const selectedDeletions = document.getElementById("github-activity-selected-deletions");
  const rangeSummary = document.getElementById("github-activity-range-summary");
  const annotation = document.getElementById("github-activity-annotation");
  const tableBody = document.getElementById("github-activity-table-body");
  const updated = document.getElementById("github-activity-updated");
  const rangeButtons = Array.from(root.querySelectorAll("[data-range]"));
  const scaleButtons = Array.from(root.querySelectorAll("[data-scale]"));
  const latestButton = root.querySelector("[data-jump-latest]");
  const number = new Intl.NumberFormat("en-US");
  const short = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const mobile = window.matchMedia("(max-width: 700px)");
  let range = mobile.matches ? "1" : "5";
  let scale = "symlog";
  let selectedIndex = rows.length - 1;
  let resizeFrame = 0;

  const element = (name, attributes = {}) => {
    const node = document.createElementNS(NS, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };

  const addText = (parent, value, x, y, anchor, color, weight) => {
    const node = element("text", {
      x,
      y,
      "text-anchor": anchor || "start",
      fill: color,
      "font-weight": weight || 500,
    });
    node.textContent = value;
    parent.append(node);
    return node;
  };

  const compact = (value) => short.format(Math.abs(value));
  const signed = (value, positive) => (positive ? "+" : "−") + number.format(Math.abs(value));

  const selectedRows = () => {
    if (range === "all") return rows;
    const years = Number(range);
    const end = rows.at(-1).date;
    const cutoff = new Date(Date.UTC(end.getUTCFullYear() - years, end.getUTCMonth(), end.getUTCDate()));
    return rows.filter((row) => row.date >= cutoff);
  };

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
    };
  };

  const pathFor = (points) => points.map((point, index) => (index ? "L " : "M ") + point[0].toFixed(2) + " " + point[1].toFixed(2)).join(" ");

  const percentile = (values, p) => {
    const ordered = [...values].sort((a, b) => a - b);
    if (ordered.length === 0) return 0;
    return ordered[Math.min(ordered.length - 1, Math.max(0, Math.round((ordered.length - 1) * p)))];
  };

  const setPressedState = () => {
    rangeButtons.forEach((button) => button.setAttribute("aria-pressed", button.dataset.range === range ? "true" : "false"));
    scaleButtons.forEach((button) => button.setAttribute("aria-pressed", button.dataset.scale === scale ? "true" : "false"));
  };

  const updateReadout = (data) => {
    const row = rows[selectedIndex];
    selectedDate.textContent = "Week of " + dateLabel.format(row.date);
    selectedAdditions.textContent = signed(row.additions, true) + " added";
    selectedDeletions.textContent = signed(row.deletions, false) + " removed";

    const active = data.filter((item) => item.additions || item.deletions);
    const additions = data.reduce((sum, item) => sum + item.additions, 0);
    const deletions = data.reduce((sum, item) => sum + item.deletions, 0);
    const scope = range === "all" ? "All history" : range + (range === "1" ? " year" : " years");
    const dateRange = dateLabel.format(data[0].date) + " — " + dateLabel.format(data.at(-1).date);
    rangeSummary.textContent =
      scope +
      " · " +
      dateRange +
      " · " +
      number.format(active.length) +
      " active weeks · +" +
      compact(additions) +
      " added · −" +
      compact(deletions) +
      " removed";

    const largest = data.reduce((best, item) => (Math.max(item.additions, item.deletions) > Math.max(best.additions, best.deletions) ? item : best));
    const medianMagnitude = percentile(
      active.map((item) => Math.max(item.additions, item.deletions)),
      0.5
    );
    annotation.textContent =
      "Largest observed week · " +
      dateLabel.format(largest.date) +
      " · +" +
      compact(largest.additions) +
      " / −" +
      compact(largest.deletions) +
      ". Median active-week magnitude · " +
      compact(medianMagnitude) +
      ".";
  };

  const updateTable = (data) => {
    const fragment = document.createDocumentFragment();
    [...data].reverse().forEach((row) => {
      const tr = document.createElement("tr");
      const values = [row.week, "+" + number.format(row.additions), "−" + number.format(row.deletions), number.format(row.additions + row.deletions)];
      values.forEach((value, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        if (index === 0) cell.scope = "row";
        cell.textContent = value;
        tr.append(cell);
      });
      fragment.append(tr);
    });
    tableBody.replaceChildren(fragment);
  };

  const drawChart = () => {
    const data = selectedRows();
    if (!data.length) return;
    if (!data.some((row) => row.index === selectedIndex)) selectedIndex = data.at(-1).index;

    chart.replaceChildren();
    const palette = colors();
    const width = chart.clientWidth || 920;
    const height = chart.clientHeight || 480;
    const narrow = width < 620;
    const left = narrow ? 58 : 74;
    const right = narrow ? 14 : 24;
    const top = 42;
    const bottom = narrow ? 48 : 54;
    const baseline = top + (height - top - bottom) / 2;
    const half = (height - top - bottom) / 2 - 12;
    const start = data[0].date.getTime();
    const end = data.at(-1).date.getTime();
    const span = Math.max(1, end - start);
    const maximum = Math.max(...data.flatMap((row) => [row.additions, row.deletions]), 1);
    const logMaximum = Math.log1p(maximum);
    const x = (date) => left + ((date.getTime() - start) / span) * (width - left - right);
    const transform = (value) => (scale === "linear" ? value / maximum : Math.log1p(value) / logMaximum);
    const y = (value) => baseline - Math.sign(value) * transform(Math.abs(value)) * half;
    chart.setAttribute("viewBox", "0 0 " + width + " " + height);

    const grid = element("g", { "aria-hidden": "true" });
    chart.append(grid);
    const ticks =
      scale === "symlog"
        ? [10, 100, 1000, 10000, 100000, 1000000, 10000000].filter((tick) => tick <= maximum)
        : [0.25, 0.5, 0.75, 1].map((fraction) => maximum * fraction);
    ticks.forEach((tick) => {
      [1, -1].forEach((direction) => {
        const yy = y(direction * tick);
        grid.append(element("line", { x1: left, y1: yy, x2: width - right, y2: yy, stroke: palette.grid, "stroke-width": 1 }));
        addText(grid, (direction > 0 ? "+" : "−") + compact(tick), left - 8, yy + 4, "end", palette.muted, 500);
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
        grid.append(element("line", { x1: xx, y1: top, x2: xx, y2: height - bottom, stroke: palette.grid, "stroke-width": 1 }));
        addText(grid, String(year), xx, height - 18, "middle", palette.muted, 500);
      }
    });
    if (yearTicks.size < 2) {
      addText(grid, data[0].week, left, height - 18, "start", palette.muted, 500);
      addText(grid, data.at(-1).week, width - right, height - 18, "end", palette.muted, 500);
    }

    addText(chart, "+ added", left, 23, "start", palette.addedText, 650);
    addText(chart, "− removed", width - right, 23, "end", palette.removedText, 650);

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
    chart.append(element("path", { d: pathFor(addPoints), fill: "none", stroke: palette.added, "stroke-width": 1.7, "stroke-linejoin": "round" }));
    chart.append(
      element("path", {
        d: pathFor(removePoints),
        fill: "none",
        stroke: palette.removed,
        "stroke-width": 1.7,
        "stroke-dasharray": "4 2",
        "stroke-linejoin": "round",
      })
    );

    const largest = data.reduce((best, item) => (Math.max(item.additions, item.deletions) > Math.max(best.additions, best.deletions) ? item : best));
    const largestX = x(largest.date);
    chart.append(
      element("line", {
        x1: largestX,
        y1: top,
        x2: largestX,
        y2: height - bottom,
        stroke: palette.accent,
        "stroke-width": 1.3,
        "stroke-dasharray": "3 4",
        "stroke-opacity": 0.85,
      })
    );

    const guide = element("line", {
      y1: top,
      y2: height - bottom,
      stroke: palette.text,
      "stroke-width": 1.2,
      "stroke-opacity": 0.68,
    });
    const addDot = element("circle", { r: narrow ? 4 : 4.5, fill: palette.surface, stroke: palette.added, "stroke-width": 2.2 });
    const removeDot = element("circle", { r: narrow ? 4 : 4.5, fill: palette.surface, stroke: palette.removed, "stroke-width": 2.2 });
    chart.append(guide, addDot, removeDot);

    const showIndex = (index) => {
      const next = Math.max(data[0].index, Math.min(data.at(-1).index, index));
      selectedIndex = next;
      const row = rows[selectedIndex];
      const xx = x(row.date);
      guide.setAttribute("x1", xx);
      guide.setAttribute("x2", xx);
      addDot.setAttribute("cx", xx);
      addDot.setAttribute("cy", y(row.additions));
      removeDot.setAttribute("cx", xx);
      removeDot.setAttribute("cy", y(-row.deletions));
      overlay.setAttribute("aria-valuenow", String(selectedIndex - data[0].index));
      overlay.setAttribute(
        "aria-valuetext",
        "Week of " + row.week + ", " + signed(row.additions, true) + " added, " + signed(row.deletions, false) + " removed"
      );
      updateReadout(data);
    };

    const pointerIndex = (event) => {
      const box = chart.getBoundingClientRect();
      const px = ((event.clientX - box.left) / Math.max(1, box.width)) * width;
      const fraction = Math.max(0, Math.min(1, (px - left) / Math.max(1, width - left - right)));
      const target = start + fraction * span;
      let best = data[0];
      data.forEach((row) => {
        if (Math.abs(row.date.getTime() - target) < Math.abs(best.date.getTime() - target)) best = row;
      });
      showIndex(best.index);
    };

    const overlay = element("rect", {
      class: "github-activity-inspector",
      x: left,
      y: top,
      width: width - left - right,
      height: height - top - bottom,
      fill: "transparent",
      tabindex: 0,
      focusable: "true",
      role: "slider",
      "aria-label": "Weekly activity inspector",
      "aria-valuemin": 0,
      "aria-valuemax": data.length - 1,
      "aria-describedby": "github-activity-chart-instructions",
    });
    overlay.addEventListener("pointerdown", (event) => {
      if (overlay.setPointerCapture) overlay.setPointerCapture(event.pointerId);
      pointerIndex(event);
      overlay.focus();
    });
    overlay.addEventListener("pointermove", (event) => {
      if (event.pointerType === "mouse" || event.buttons === 1) pointerIndex(event);
    });
    overlay.addEventListener("focus", () => showIndex(selectedIndex));
    overlay.addEventListener("keydown", (event) => {
      let next = selectedIndex;
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 1;
      else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 1;
      else if (event.key === "Home") next = data[0].index;
      else if (event.key === "End") next = data.at(-1).index;
      else if (event.key === "PageUp") next -= 4;
      else if (event.key === "PageDown") next += 4;
      else return;
      event.preventDefault();
      showIndex(next);
    });
    chart.append(overlay);
    showIndex(selectedIndex);
    updateTable(data);
  };

  rangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      range = button.dataset.range;
      const data = selectedRows();
      if (!data.some((row) => row.index === selectedIndex)) selectedIndex = data.at(-1).index;
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

  latestButton.addEventListener("click", () => {
    selectedIndex = rows.length - 1;
    drawChart();
    const inspector = chart.querySelector(".github-activity-inspector");
    if (inspector) inspector.focus();
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
  setPressedState();
  drawChart();
  root.setAttribute("data-state", "ready");
})();
