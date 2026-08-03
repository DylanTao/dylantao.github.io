(async () => {
  const NS = "http://www.w3.org/2000/svg";
  const number = new Intl.NumberFormat("en-US");
  const compactNumber = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const familyNumber = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
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
  const DAY_MS = 86_400_000;
  const CODEX_DAILY_HISTORY_START = "2026-04-30";
  const CLAUDE_DAILY_HISTORY_START = "2026-07-29";
  const utcDate = (value) => new Date(`${value}T00:00:00Z`);
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
      ...(options.size ? { "font-size": options.size } : {}),
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
  const bandPath = (upper, lower) => {
    if (!upper.length || upper.length !== lower.length) return "";
    return `${linePath(upper)} ${lower
      .slice()
      .reverse()
      .map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(" ")} Z`;
  };
  const isIsoDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const signed = (value, positive) => `${positive ? "+" : "\u2212"}${number.format(value)}`;
  const lineChanges = (row) => row.additions + row.deletions;
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
  const spacedLogTicks = (domainMaximum, yForValue, minimumGap = 18) => {
    const candidates = new Set([0, domainMaximum]);
    for (let power = 0; 10 ** power <= domainMaximum; power += 1) {
      [1, 2, 5].forEach((multiple) => {
        const value = multiple * 10 ** power;
        if (value <= domainMaximum) candidates.add(value);
      });
    }
    const ticks = [];
    [...candidates]
      .sort((a, b) => a - b)
      .forEach((value) => {
        const previous = ticks.at(-1);
        if (previous == null || Math.abs(yForValue(previous) - yForValue(value)) >= minimumGap) ticks.push(value);
      });
    if (!ticks.includes(domainMaximum)) {
      if (ticks.length > 1 && Math.abs(yForValue(ticks.at(-1)) - yForValue(domainMaximum)) < minimumGap) ticks.pop();
      ticks.push(domainMaximum);
    }
    return ticks;
  };
  const drawYAxis = (group, { name, ticks, y, left, right, colors, format = (value) => compactNumber.format(value) }) => {
    if (!ticks.length) return null;
    const axis = svgElement("g", {
      class: "build-rhythm-y-axis",
      "data-build-rhythm-y-axis": name,
      "aria-hidden": "true",
    });
    const positions = ticks.map(y);
    axis.append(
      svgElement("line", {
        class: "build-rhythm-axis-line",
        x1: left,
        y1: Math.min(...positions),
        x2: left,
        y2: Math.max(...positions),
        stroke: colors.text,
        "stroke-opacity": 0.32,
        "stroke-width": 1,
      })
    );
    ticks.forEach((tick) => {
      const yy = y(tick);
      const isZero = tick === 0;
      axis.append(
        svgElement("line", {
          class: `build-rhythm-axis-grid${isZero ? " is-zero" : ""}`,
          x1: left,
          y1: yy,
          x2: right,
          y2: yy,
          stroke: isZero ? colors.text : colors.grid,
          "stroke-opacity": isZero ? 0.42 : 1,
          "stroke-width": isZero ? 1.2 : 1,
        })
      );
      addText(axis, format(tick), left - 7, yy + 4, {
        anchor: "end",
        color: colors.muted,
        className: `build-rhythm-axis-tick${isZero ? " is-zero" : ""}`,
      }).dataset.axisValue = String(tick);
    });
    group.prepend(axis);
    return axis;
  };
  const drawSeries = (group, rows, valueForRow, bounds, options) => {
    const values = rows.map(valueForRow);
    const maximum = options.maximum || Math.max(...values.map(Math.abs), 1);
    const transformedMaximum = options.scale === "linear" ? maximum : Math.log1p(maximum);
    const x = (index) =>
      options.xForRow ? options.xForRow(rows[index], index) : bounds.left + (index / Math.max(1, rows.length - 1)) * (bounds.right - bounds.left);
    const y = (value) => {
      const transformed = (options.scale === "linear" ? Math.abs(value) : Math.log1p(Math.abs(value))) / transformedMaximum;
      if (options.signed) return bounds.baseline - Math.sign(value) * transformed * (bounds.bottom - bounds.top) * 0.45;
      return bounds.bottom - transformed * (bounds.bottom - bounds.top);
    };
    const points = values.map((value, index) => [x(index), y(value)]);
    if (options.fillOpacity) {
      group.append(
        svgElement("path", {
          ...(options.className ? { class: `${options.className}-area` } : {}),
          d: areaPath(points, options.signed ? bounds.baseline : bounds.bottom),
          fill: options.color,
          "fill-opacity": options.fillOpacity,
        })
      );
    }
    group.append(
      svgElement("path", {
        ...(options.className ? { class: options.className } : {}),
        d: linePath(points),
        fill: "none",
        stroke: options.color,
        "stroke-width": options.strokeWidth || 1.8,
        ...(options.dash ? { "stroke-dasharray": options.dash } : {}),
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      })
    );
    return { maximum, values, x, y };
  };
  const lifetimeHistoryRows = (source) => {
    if (source?.combined_daily_usage) {
      const usage = source.combined_daily_usage;
      let cumulative = usage.coverage.prior_unallocated_tokens;
      const familyCumulative =
        usage.schema === 2
          ? {
              codex: usage.coverage.prior_unallocated_by_agent.codex,
              claude: usage.coverage.prior_unallocated_by_agent.claude,
            }
          : null;
      return usage.points.map((point, index) => {
        cumulative += point.tokens;
        if (familyCumulative) {
          familyCumulative.codex += point.agent_tokens.codex;
          familyCumulative.claude += point.agent_tokens.claude;
        }
        return {
          index,
          date: utcDate(point.date),
          tokenCount: cumulative,
          tokensLabel: compactNumber.format(cumulative),
          dailyTokens: point.tokens,
          dailyAgentTokens: point.agent_tokens || null,
          cumulativeAgentTokens: familyCumulative ? { ...familyCumulative } : null,
          observation: "exact_daily",
        };
      });
    }
    return (
      source?.combined_lifetime_history?.points?.map((point, index) => ({
        index,
        date: utcDate(point.date),
        tokenCount: point.token_count,
        tokensLabel: point.tokens_label,
        dailyTokens: null,
        observation: point.observation,
      })) || []
    );
  };
  const hasAgentFamilyBreakdown = (source) => source?.combined_daily_usage?.schema === 2;
  const agentFamilyTotals = (source) => {
    if (!hasAgentFamilyBreakdown(source)) return null;
    const rows = lifetimeHistoryRows(source);
    return rows.at(-1)?.cumulativeAgentTokens || null;
  };
  const agentFamilyPercentages = (totals) => {
    const total = totals.codex + totals.claude;
    if (total <= 0) return { codex: 0, claude: 0 };
    const codexBasisPoints = Math.round((totals.codex / total) * 10_000);
    const claudeBasisPoints = 10_000 - codexBasisPoints;
    return { codex: codexBasisPoints / 100, claude: claudeBasisPoints / 100 };
  };
  const codexUsageForDay = (source, row) => {
    const daily = source?.combined_daily_usage;
    if (daily) {
      const coverage = daily.coverage;
      if (row.date < utcDate(coverage.starts_on)) {
        return coverage.before_start === "zero"
          ? { date: row.date, tokenCount: 0, tokensLabel: "0", dailyTokens: 0, observation: "exact_daily" }
          : null;
      }
      if (row.date > utcDate(coverage.complete_through)) return null;
      return lifetimeHistoryRows(source).find((point) => point.date.getTime() === row.date.getTime()) || null;
    }
    return lifetimeHistoryRows(source)
      .filter((point) => point.date.getTime() <= row.date.getTime())
      .at(-1);
  };
  const drawAgentHistory = (group, source, width, height, colors) => {
    const points = lifetimeHistoryRows(source);
    if (!points.length) return null;
    const left = width < 620 ? 48 : 58;
    const right = width < 620 ? 10 : 14;
    const top = 24;
    const bottom = height - 30;
    const start = points[0].date.getTime();
    const end = points.at(-1).date.getTime();
    const span = end - start;
    const x = (date) => (span === 0 ? (left + width - right) / 2 : left + ((date.getTime() - start) / span) * (width - left - right));
    const maximum = Math.max(points.at(-1).tokenCount, 1);
    const y = (value) => bottom - (value / maximum) * (bottom - top);

    [0, maximum].forEach((tick) => {
      const yy = y(tick);
      group.append(svgElement("line", { x1: left, y1: yy, x2: width - right, y2: yy, stroke: colors.grid, "stroke-width": 1 }));
      addText(group, compactNumber.format(tick), left - 7, yy + 4, { anchor: "end", color: colors.muted, size: 10 });
    });

    if (points.length > 1) {
      const combinedPoints = points.map((point) => [x(point.date), y(point.tokenCount)]);
      if (hasAgentFamilyBreakdown(source)) {
        const codexPoints = points.map((point) => [x(point.date), y(point.cumulativeAgentTokens.codex)]);
        group.append(
          svgElement("path", {
            class: "github-activity-agent-history-codex-area",
            d: areaPath(codexPoints, bottom),
            fill: colors.codex,
            "fill-opacity": 0.22,
          }),
          svgElement("path", {
            class: "github-activity-agent-history-claude-area",
            d: bandPath(combinedPoints, codexPoints),
            fill: colors.claude,
            "fill-opacity": 0.72,
          })
        );
      } else {
        group.append(
          svgElement("path", {
            class: "github-activity-agent-history-total-area",
            d: areaPath(combinedPoints, bottom),
            fill: colors.text,
            "fill-opacity": 0.16,
          })
        );
      }
      group.append(
        svgElement("path", {
          class: "github-activity-agent-history-line",
          d: linePath(combinedPoints),
          fill: "none",
          stroke: colors.text,
          "stroke-width": 2,
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
        })
      );
    }

    points.forEach((point, index) => {
      group.append(
        svgElement("circle", {
          class: `github-activity-agent-history-marker${index === points.length - 1 ? " is-latest" : ""}`,
          cx: x(point.date),
          cy: y(point.tokenCount),
          r: index === points.length - 1 ? 4 : 2.3,
          fill: index === points.length - 1 ? colors.surface : colors.text,
          stroke: colors.text,
          "stroke-width": index === points.length - 1 ? 2 : 1,
        })
      );
    });

    addText(group, shortDate.format(points[0].date), points.length === 1 ? (left + width - right) / 2 : left, height - 7, {
      anchor: points.length === 1 ? "middle" : "start",
      color: colors.muted,
      size: 10,
    });
    if (points.length > 1) {
      addText(group, shortDate.format(points.at(-1).date), width - right, height - 7, { anchor: "end", color: colors.muted, size: 10 });
    }
    return { points, x, y };
  };
  const drawSharedAgentRail = (group, { source, domainStart, domainEnd, x, top, bottom, left, right, colors }) => {
    const points = lifetimeHistoryRows(source).filter((point) => point.date >= domainStart && point.date <= domainEnd);
    if (!points.length) return null;
    const maximum = Math.max(source.combined_lifetime.token_count, ...points.map((point) => point.tokenCount), 1);
    const linear = niceLinearScale(maximum, 2);
    const y = (value) => bottom - (value / linear.domainMaximum) * (bottom - top);
    drawYAxis(group, {
      name: "github-agent-history",
      ticks: [0, ...linear.ticks],
      y,
      left,
      right,
      colors,
      format: (value) => compactNumber.format(value),
    });

    if (points.length > 1) {
      const combinedPoints = points.map((point) => [x(point.date), y(point.tokenCount)]);
      if (hasAgentFamilyBreakdown(source)) {
        const familyPoints = points.filter((point) => point.cumulativeAgentTokens);
        const codexPoints = familyPoints.map((point) => [x(point.date), y(point.cumulativeAgentTokens.codex)]);
        const familyCombinedPoints = familyPoints.map((point) => [x(point.date), y(point.tokenCount)]);
        group.append(
          svgElement("path", {
            class: "github-activity-agent-rail-codex-area",
            d: areaPath(codexPoints, bottom),
            fill: colors.codex,
            "fill-opacity": 0.18,
          }),
          svgElement("path", {
            class: "github-activity-agent-rail-claude-area",
            d: bandPath(familyCombinedPoints, codexPoints),
            fill: colors.claude,
            "fill-opacity": 0.58,
          })
        );
      } else {
        group.append(
          svgElement("path", {
            class: "github-activity-agent-rail-total-area",
            d: areaPath(combinedPoints, bottom),
            fill: colors.text,
            "fill-opacity": 0.14,
          })
        );
      }
      group.append(
        svgElement("path", {
          class: "github-activity-agent-rail-line",
          d: linePath(combinedPoints),
          fill: "none",
          stroke: colors.text,
          "stroke-width": 2,
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
        })
      );
    }

    points.forEach((point, index) => {
      group.append(
        svgElement("circle", {
          class: `github-activity-agent-rail-marker${index === points.length - 1 ? " is-latest" : ""}`,
          cx: x(point.date),
          cy: y(point.tokenCount),
          r: index === points.length - 1 ? 4 : 2.2,
          fill: index === points.length - 1 ? colors.surface : colors.text,
          stroke: colors.text,
          "stroke-width": index === points.length - 1 ? 2 : 1,
        })
      );
    });
    return { points, y };
  };
  const drawTokenRhythm = (group, tokenRows, width, height, colors) => {
    const left = width < 620 ? 58 : 64;
    const right = 14;
    const split = Math.round(height * 0.58);
    const latest = tokenRows.at(-1);
    const dailyDeltas = tokenRows.map((row, index) => Math.max(0, row.tokenCount - (tokenRows[index - 1]?.tokenCount || 0)));
    const cumulativeScale = niceLinearScale(latest.tokenCount, width < 620 ? 2 : 3);
    const dailyDomainMaximum = niceLogMaximum(Math.max(...dailyDeltas, 1));

    addText(group, "SITE-BUILD \u00b7 CUMULATIVE REPO ESTIMATE", left, 20, {
      color: colors.accent,
      weight: 700,
    });
    addText(group, latest.tokensLabel, width - right, 20, { anchor: "end", color: colors.text, weight: 700 });
    const cumulativeSeries = drawSeries(
      group,
      tokenRows,
      (row) => row.tokenCount,
      { left, right: width - right, top: 44, bottom: split - 20 },
      {
        className: "github-activity-token-cumulative-line",
        color: colors.accent,
        fillOpacity: 0.1,
        maximum: cumulativeScale.domainMaximum,
        scale: "linear",
        strokeWidth: 2,
      }
    );
    drawYAxis(group, {
      name: "token-cumulative",
      ticks: [0, ...cumulativeScale.ticks],
      y: cumulativeSeries.y,
      left,
      right: width - right,
      colors,
    });

    addText(group, "ROUNDED DAILY INCREASE \u00b7 READABLE LOG1P", left, split + 8, {
      color: colors.muted,
      weight: 700,
    });
    const dailySeries = drawSeries(
      group,
      tokenRows,
      (_row, index) => dailyDeltas[index],
      { left, right: width - right, top: split + 30, bottom: height - 34 },
      {
        className: "github-activity-token-delta-line",
        color: colors.added,
        fillOpacity: 0.1,
        maximum: dailyDomainMaximum,
        scale: "log",
      }
    );
    drawYAxis(group, {
      name: "token-daily-increase",
      ticks: spacedLogTicks(dailyDomainMaximum, dailySeries.y, width < 620 ? 24 : 28),
      y: dailySeries.y,
      left,
      right: width - right,
      colors,
    });
    addText(group, shortDate.format(tokenRows[0].date), left, height - 8, { color: colors.muted });
    addText(group, shortDate.format(latest.date), width - right, height - 8, { anchor: "end", color: colors.muted });

    const largestIndex = dailyDeltas.indexOf(Math.max(...dailyDeltas));
    return `Latest rounded estimate \u00b7 ${latest.tokensLabel} \u00b7 ${fullDate.format(latest.date)}. Biggest adjacent jump \u00b7 ${compactNumber.format(dailyDeltas[largestIndex])} \u00b7 ${fullDate.format(tokenRows[largestIndex].date)}.`;
  };

  const initBuildRhythmStory = ({ githubRows, tokenRows, codexSourcePromise }) => {
    const storyRoot = document.querySelector("[data-build-rhythm-story]");
    if (!storyRoot || !githubRows.length || !tokenRows.length) return;

    const stageWrap = storyRoot.querySelector(".build-rhythm-story-stage-wrap");
    const stage = storyRoot.querySelector("[data-build-rhythm-story-stage]");
    const chart = storyRoot.querySelector("[data-build-rhythm-story-chart]");
    const sceneLabel = storyRoot.querySelector("[data-build-rhythm-story-label]");
    const sceneScope = storyRoot.querySelector("[data-build-rhythm-story-scope]");
    const sceneReadout = storyRoot.querySelector("[data-build-rhythm-story-readout]");
    const steps = Array.from(storyRoot.querySelectorAll("[data-build-rhythm-step]"));
    const agentStepHeading = storyRoot.querySelector("[data-build-rhythm-agent-heading]");
    const agentStepCopy = storyRoot.querySelector("[data-build-rhythm-agent-copy]");
    if (!stageWrap || !stage || !chart || !sceneLabel || !sceneScope || !sceneReadout || !steps.length) return;

    const compactQuery = window.matchMedia("(max-width: 820px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const latestGithubDate = githubRows.at(-1).date;
    const githubCutoff = new Date(Date.UTC(latestGithubDate.getUTCFullYear() - 5, latestGithubDate.getUTCMonth(), latestGithubDate.getUTCDate()));
    const storyGithubRows = githubRows.filter((row) => row.date >= githubCutoff);
    let codexSource = null;
    let activeScene = "cadence";
    let renderedScene = null;
    let pendingScene = null;
    let transitionFrame = 0;
    let resizeFrame = 0;
    let storyVisible = true;
    let stepObserver = null;
    let rootObserver = null;
    let stageResizeObserver = null;

    const isStaticStory = () => compactQuery.matches || reducedMotionQuery.matches || !("IntersectionObserver" in window);
    const palette = () => {
      const style = getComputedStyle(storyRoot);
      return {
        accent: style.getPropertyValue("--global-primary-color").trim() || "#3b6a98",
        added: style.getPropertyValue("--global-sky-strong").trim() || "#236e8c",
        removed: style.getPropertyValue("--global-mint-strong").trim() || "#26735d",
        codex: style.getPropertyValue("--github-activity-codex-color").trim() || "#3b6a98",
        claude: style.getPropertyValue("--github-activity-claude-color").trim() || "#c96548",
        text: style.getPropertyValue("--global-text-color").trim() || "#23282a",
        muted: style.getPropertyValue("--global-text-color-light").trim() || "#5d6565",
        grid: style.getPropertyValue("--global-divider-color").trim() || "rgba(45,101,112,.2)",
        surface: style.getPropertyValue("--global-surface-container-low-color").trim() || "#f7fbfa",
      };
    };
    const dimensions = () => ({
      width: Math.max(300, Math.round(chart.getBoundingClientRect().width || storyRoot.getBoundingClientRect().width || 720)),
      height: Math.max(300, Math.round(chart.getBoundingClientRect().height || 368)),
    });
    const syncAgentStepCopy = (source) => {
      if (!agentStepHeading || !agentStepCopy) return;
      const points = lifetimeHistoryRows(source);
      if (hasAgentFamilyBreakdown(source)) {
        const coverageStart = utcDate(source.combined_daily_usage.coverage.starts_on);
        agentStepHeading.textContent = "Codex leads the trace. Claude joins later.";
        agentStepCopy.textContent = `The daily Codex record starts ${fullDate.format(coverageStart)}. Claude joins the trace on ${fullDate.format(
          utcDate(CLAUDE_DAILY_HISTORY_START)
        )}.`;
      } else if (points.length) {
        agentStepHeading.textContent = "Then I zoom into the recent aggregate history.";
        agentStepCopy.textContent = `Daily aggregate history runs from ${fullDate.format(points[0].date)} through ${fullDate.format(
          points.at(-1).date
        )}. This close-up keeps the cumulative total readable without changing the shared five-year explorer below.`;
      } else {
        agentStepHeading.textContent = "Recent agent history is unavailable.";
        agentStepCopy.textContent = "A validated agent snapshot is unavailable. The shared five-year code explorer below remains available.";
      }
    };
    const drawCadence = (group, width, height, colors) => {
      const left = width < 620 ? 58 : 64;
      const right = 14;
      const top = 40;
      const bottom = 30;
      const baseline = height - bottom;
      const domainMaximum = niceLogMaximum(Math.max(...storyGithubRows.map((row) => row.commits), 1));

      addText(group, "COMMITS / DAY \u00b7 READABLE LOG1P", left, 20, { color: colors.accent, weight: 700 });
      const series = drawSeries(
        group,
        storyGithubRows,
        (row) => row.commits,
        { left, right: width - right, top, bottom: baseline },
        { color: colors.accent, fillOpacity: 0.12, maximum: domainMaximum, scale: "log", strokeWidth: 2 }
      );
      drawYAxis(group, {
        name: "story-cadence",
        ticks: spacedLogTicks(domainMaximum, series.y, width < 620 ? 22 : 26),
        y: series.y,
        left,
        right: width - right,
        colors,
      });
      const busiest = storyGithubRows.reduce((best, row) => (row.commits > best.commits ? row : best));
      return `Busiest day in this view \u00b7 ${fullDate.format(busiest.date)} \u00b7 ${number.format(busiest.commits)} commits.`;
    };

    const drawMagnitude = (group, width, height, colors) => {
      const left = width < 620 ? 62 : 68;
      const right = 14;
      const top = 45;
      const bottom = 30;
      const baseline = (top + height - bottom) / 2;
      const maximum = niceLogMaximum(Math.max(...storyGithubRows.flatMap((row) => [row.additions, row.deletions]), 1));

      addText(group, "LINES CHANGED / DAY \u00b7 READABLE SYMLOG", left, 20, { color: colors.text, weight: 700 });
      addText(group, "+ added", left, 38, { color: colors.added, weight: 650 });
      addText(group, "\u2212 removed", left + 78, 38, { color: colors.removed, weight: 650 });
      const bounds = { left, right: width - right, top, bottom: height - bottom, baseline };
      const additionsSeries = drawSeries(group, storyGithubRows, (row) => row.additions, bounds, {
        color: colors.added,
        maximum,
        scale: "log",
        signed: true,
      });
      drawSeries(group, storyGithubRows, (row) => -row.deletions, bounds, {
        color: colors.removed,
        dash: "4 2",
        maximum,
        scale: "log",
        signed: true,
      });
      const positiveTicks = spacedLogTicks(maximum, additionsSeries.y, width < 620 ? 24 : 28).filter((value) => value > 0);
      drawYAxis(group, {
        name: "story-magnitude",
        ticks: [...positiveTicks.map((value) => -value), 0, ...positiveTicks],
        y: additionsSeries.y,
        left,
        right: width - right,
        colors,
        format: (value) => (value === 0 ? "0" : `${value > 0 ? "+" : "\u2212"}${compactNumber.format(Math.abs(value))}`),
      });
      const largest = storyGithubRows.reduce((best, row) => (lineChanges(row) > lineChanges(best) ? row : best));
      return `Biggest line-change day \u00b7 ${fullDate.format(largest.date)} \u00b7 ${signed(largest.additions, true)} added / ${signed(largest.deletions, false)} removed.`;
    };

    const drawBursts = (group, width, height, colors) => {
      const outer = 10;
      const gap = 16;
      const panelWidth = (width - outer * 2 - gap) / 2;
      const panelTop = 32;
      const panelBottom = height - 26;
      const values = storyGithubRows.map(lineChanges);
      const rawMaximum = Math.max(...values, 1);
      const maximum = Math.max(niceLogMaximum(rawMaximum), niceLinearScale(rawMaximum, 2).domainMaximum);
      const peakIndex = values.indexOf(rawMaximum);

      [
        { label: "READABLE LOG1P", mode: "log", x: outer },
        { label: "LITERAL LINEAR", mode: "linear", x: outer + panelWidth + gap },
      ].forEach((panel) => {
        addText(group, panel.label, panel.x + 10, 20, { color: panel.mode === "log" ? colors.accent : colors.muted, weight: 700 });
        const left = panel.x + (width < 620 ? 44 : 50);
        const right = panel.x + panelWidth - 10;
        const bottom = panelBottom - 18;
        const series = drawSeries(
          group,
          storyGithubRows,
          lineChanges,
          { left, right, top: panelTop + 14, bottom },
          { color: colors.accent, fillOpacity: panel.mode === "log" ? 0.12 : 0.07, maximum, scale: panel.mode }
        );
        const ticks = panel.mode === "log" ? spacedLogTicks(maximum, series.y, 30) : [0, ...niceLinearScale(maximum, width < 620 ? 1 : 2).ticks];
        drawYAxis(group, {
          name: `story-bursts-${panel.mode === "log" ? "readable" : "literal"}`,
          ticks,
          y: series.y,
          left,
          right,
          colors,
        });
      });
      const peak = storyGithubRows[peakIndex];
      return `Same days, two scales \u00b7 biggest burst ${fullDate.format(peak.date)} \u00b7 ${compactNumber.format(values[peakIndex])} lines changed.`;
    };

    const drawTokens = (group, width, height, colors) => {
      return drawTokenRhythm(group, tokenRows, width, height, colors);
    };

    const drawAgents = (group, width, height, colors) => {
      const heading = !codexSource
        ? "PERSONAL AGENT TOKENS \u00b7 RECENT HISTORY"
        : hasAgentFamilyBreakdown(codexSource)
          ? "PERSONAL AGENT TOKENS \u00b7 STACKED CUMULATIVE"
          : "PERSONAL AGENT TOKENS \u00b7 CUMULATIVE TOTAL";
      addText(group, heading, width < 620 ? 48 : 58, 16, {
        color: colors.text,
        weight: 700,
        className: "github-activity-agent-history-heading",
      });
      if (!codexSource) return "Recent personal agent history is unavailable.";
      const plot = drawAgentHistory(group, codexSource, width, height, colors);
      if (!plot) return "Recent personal agent history is unavailable.";
      const latest = plot.points.at(-1);
      const familyTotals = agentFamilyTotals(codexSource);
      return familyTotals
        ? `${shortDate.format(plot.points[0].date)}–${shortDate.format(latest.date)} \u00b7 Codex area ${familyNumber.format(
            familyTotals.codex
          )} \u00b7 Claude area ${familyNumber.format(familyTotals.claude)} \u00b7 Total line ${familyNumber.format(latest.tokenCount)}.`
        : `${shortDate.format(plot.points[0].date)}–${shortDate.format(latest.date)} \u00b7 ${familyNumber.format(latest.tokenCount)} total.`;
    };

    const drawComplete = (group, width, height, colors) => {
      const compact = width < 620;
      const left = compact ? 58 : 64;
      const right = 12;
      const domainStart = storyGithubRows[0].date;
      const domainEnd = storyGithubRows.at(-1).date;
      const domainSpan = Math.max(1, domainEnd.getTime() - domainStart.getTime());
      const sharedX = (date) => left + ((date.getTime() - domainStart.getTime()) / domainSpan) * (width - left - right);
      const commitTop = 26;
      const commitBottom = Math.max(76, height * 0.2);
      const commitMaximum = niceLogMaximum(Math.max(...storyGithubRows.map((row) => row.commits), 1));
      addText(group, compact ? "COMMITS / DAY" : "COMBINED \u00b7 COMMITS / DAY", left, 16, { color: colors.accent, weight: 700 });
      const commitSeries = drawSeries(
        group,
        storyGithubRows,
        (row) => row.commits,
        { left, right: width - right, top: commitTop, bottom: commitBottom },
        { color: colors.accent, maximum: commitMaximum, scale: "log", xForRow: (row) => sharedX(row.date) }
      );
      drawYAxis(group, {
        name: "story-complete-commits",
        ticks: compact ? [0, commitMaximum] : spacedLogTicks(commitMaximum, commitSeries.y, 16),
        y: commitSeries.y,
        left,
        right: width - right,
        colors,
      });

      const lineTop = commitBottom + 30;
      const lineBottom = height - 28;
      const lineBaseline = (lineTop + lineBottom) / 2;
      const lineMaximum = niceLogMaximum(Math.max(...storyGithubRows.flatMap((row) => [row.additions, row.deletions]), 1));
      addText(group, compact ? "+ ADDED / \u2212 REMOVED" : "SAME DAYS \u00b7 + ADDED / \u2212 REMOVED", left, lineTop - 12, {
        color: colors.muted,
        weight: 700,
      });
      const lineBounds = { left, right: width - right, top: lineTop, bottom: lineBottom, baseline: lineBaseline };
      const additionsSeries = drawSeries(group, storyGithubRows, (row) => row.additions, lineBounds, {
        color: colors.added,
        maximum: lineMaximum,
        scale: "log",
        signed: true,
        xForRow: (row) => sharedX(row.date),
      });
      const completePositiveTicks = compact ? [lineMaximum] : spacedLogTicks(lineMaximum, additionsSeries.y, 18).filter((value) => value > 0);
      drawYAxis(group, {
        name: "story-complete-lines",
        ticks: [...completePositiveTicks.map((value) => -value), 0, ...completePositiveTicks],
        y: additionsSeries.y,
        left,
        right: width - right,
        colors,
        format: (value) => (value === 0 ? "0" : `${value > 0 ? "+" : "\u2212"}${compactNumber.format(Math.abs(value))}`),
      });
      drawSeries(group, storyGithubRows, (row) => -row.deletions, lineBounds, {
        color: colors.removed,
        dash: "4 2",
        maximum: lineMaximum,
        scale: "log",
        signed: true,
        xForRow: (row) => sharedX(row.date),
      });

      const timeGrid = svgElement("g", { class: "build-rhythm-shared-time-grid", "aria-hidden": "true" });
      const yearTicks = new Set();
      storyGithubRows.forEach((row) => {
        const year = row.date.getUTCFullYear();
        if (yearTicks.has(year) || row.date.getUTCMonth() !== 0) return;
        yearTicks.add(year);
        const xx = sharedX(row.date);
        timeGrid.append(
          svgElement("line", {
            x1: xx,
            y1: commitTop,
            x2: xx,
            y2: lineBottom,
            stroke: colors.grid,
            "stroke-width": 1,
          })
        );
        addText(timeGrid, String(year), xx, height - 5, { anchor: "middle", color: colors.muted });
      });
      group.prepend(timeGrid);

      return "Five years, day by day \u00b7 personal commits and line movement.";
    };

    const metadata = {
      cadence: { label: "WHEN", scope: "5 YEARS \u00b7 DAILY" },
      magnitude: { label: "HOW MUCH MOVED", scope: "5 YEARS \u00b7 DAILY" },
      bursts: { label: "TWO SCALES", scope: "SAME VALUES \u00b7 READABLE / LITERAL" },
      tokens: { label: "THIS SITE", scope: "DAILY \u00b7 ROUNDED ESTIMATE" },
      agents: { label: "PERSONAL AGENTS", scope: "OBSERVED DAYS \u00b7 CUMULATIVE" },
      explore: { label: "YOUR TURN", scope: "PERSONAL COMMITS + LINES" },
      complete: { label: "THE WHOLE RHYTHM", scope: "PERSONAL COMMITS + LINES" },
    };

    const syncStageOffset = () => {
      if (isStaticStory()) {
        stageWrap.style.removeProperty("--build-rhythm-sticky-top");
        return;
      }
      const navBottom = Math.max(0, document.querySelector("nav")?.getBoundingClientRect().bottom || 0);
      const usableHeight = Math.max(0, window.innerHeight - navBottom);
      const stageHeight = stage.getBoundingClientRect().height;
      const centeredTop = navBottom + (usableHeight - stageHeight) / 2;
      stageWrap.style.setProperty("--build-rhythm-sticky-top", `${Math.round(Math.max(navBottom + 12, centeredTop))}px`);
    };

    const renderScene = (scene) => {
      const targetScene = scene === "explore" ? "complete" : scene;
      const { width, height } = dimensions();
      const colors = palette();
      const group = svgElement("g", { "data-build-rhythm-story-layer": targetScene });
      chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
      chart.replaceChildren(group);
      let readout;
      if (targetScene === "cadence") readout = drawCadence(group, width, height, colors);
      else if (targetScene === "magnitude") readout = drawMagnitude(group, width, height, colors);
      else if (targetScene === "bursts") readout = drawBursts(group, width, height, colors);
      else if (targetScene === "tokens") readout = drawTokens(group, width, height, colors);
      else if (targetScene === "agents") readout = drawAgents(group, width, height, colors);
      else readout = drawComplete(group, width, height, colors);

      const copy = metadata[scene] || metadata.complete;
      sceneLabel.textContent = copy.label;
      sceneScope.textContent = copy.scope;
      sceneReadout.textContent = readout;
      stage.dataset.scene = scene;
      renderedScene = scene;
      requestAnimationFrame(syncStageOffset);
    };

    const resetTransitionStyles = () => {
      stage.style.opacity = "1";
      chart.style.opacity = "1";
      chart.style.transform = "translateY(0)";
      sceneReadout.style.opacity = "1";
      sceneReadout.style.transform = "translateY(0)";
    };

    const finishTransition = (scene) => {
      if (transitionFrame) cancelAnimationFrame(transitionFrame);
      transitionFrame = 0;
      pendingScene = null;
      resetTransitionStyles();
      stage.dataset.transitioning = "false";
      if (renderedScene !== scene) renderScene(scene);
    };

    const cancelTransition = ({ settle = true } = {}) => {
      if (transitionFrame) cancelAnimationFrame(transitionFrame);
      transitionFrame = 0;
      const target = pendingScene;
      pendingScene = null;
      resetTransitionStyles();
      stage.dataset.transitioning = "false";
      if (settle && target && renderedScene !== target) renderScene(target);
    };

    const transitionTo = (requestedScene, { animate = true } = {}) => {
      const scene = isStaticStory() ? "complete" : requestedScene;
      if (scene === pendingScene || (scene === renderedScene && !pendingScene)) return;
      cancelTransition({ settle: false });
      if (!animate || isStaticStory() || !storyVisible || renderedScene == null) {
        renderScene(scene);
        return;
      }

      pendingScene = scene;
      stage.dataset.transitioning = "true";
      renderScene(scene);
      const startedAt = performance.now();
      const duration = 240;
      const tick = (now) => {
        if (!storyVisible) {
          finishTransition(scene);
          return;
        }
        const progress = clamp((now - startedAt) / duration, 0, 1);
        const eased = 1 - (1 - progress) ** 3;
        chart.style.opacity = String(0.38 + eased * 0.62);
        chart.style.transform = `translateY(${((1 - eased) * 6).toFixed(2)}px)`;
        sceneReadout.style.opacity = String(0.55 + eased * 0.45);
        sceneReadout.style.transform = `translateY(${((1 - eased) * 3).toFixed(2)}px)`;
        if (progress < 1) transitionFrame = requestAnimationFrame(tick);
        else finishTransition(scene);
      };
      transitionFrame = requestAnimationFrame(tick);
    };

    const nearestStep = () => {
      const stageBox = stage.getBoundingClientRect();
      const stageCenter = (stageBox.top + stageBox.bottom) / 2;
      return steps
        .map((step) => {
          const box = step.getBoundingClientRect();
          return { distance: Math.abs((box.top + box.bottom) / 2 - stageCenter), step };
        })
        .sort((a, b) => a.distance - b.distance)[0]?.step;
    };

    const activateStep = (step, { animate = true } = {}) => {
      if (!step) return;
      activeScene = step.dataset.buildRhythmStep || "cadence";
      steps.forEach((candidate) => candidate.classList.toggle("is-active", candidate === step));
      transitionTo(activeScene, { animate });
    };

    const connectStepObserver = () => {
      stepObserver?.disconnect();
      stepObserver = null;
      if (isStaticStory()) {
        steps.forEach((step) => step.classList.remove("is-active"));
        transitionTo("complete", { animate: false });
        return;
      }
      stepObserver = new IntersectionObserver(
        () => {
          if (!storyVisible) return;
          activateStep(nearestStep());
        },
        { rootMargin: "-28% 0px -28% 0px", threshold: [0, 0.25, 0.5, 0.75] }
      );
      steps.forEach((step) => stepObserver.observe(step));
      activateStep(nearestStep(), { animate: false });
    };

    const refreshMode = () => {
      const staticStory = isStaticStory();
      storyRoot.dataset.storyStatic = String(staticStory);
      cancelTransition({ settle: false });
      syncStageOffset();
      connectStepObserver();
      if (staticStory) transitionTo("complete", { animate: false });
      else activateStep(nearestStep(), { animate: false });
    };

    storyRoot.dataset.state = "ready";
    const initialBox = storyRoot.getBoundingClientRect();
    storyVisible = initialBox.bottom > 0 && initialBox.top < window.innerHeight;
    storyRoot.dataset.storyVisible = String(storyVisible);
    refreshMode();

    if ("IntersectionObserver" in window) {
      rootObserver = new IntersectionObserver(
        ([entry]) => {
          const wasVisible = storyVisible;
          storyVisible = Boolean(entry?.isIntersecting);
          storyRoot.dataset.storyVisible = String(storyVisible);
          if (!storyVisible) cancelTransition();
          else if (!wasVisible && !isStaticStory()) activateStep(nearestStep(), { animate: false });
        },
        { threshold: 0.01 }
      );
      rootObserver.observe(storyRoot);
    }

    codexSourcePromise.then((source) => {
      codexSource = source;
      syncAgentStepCopy(source);
      if (["agents", "complete", "explore"].includes(renderedScene)) renderScene(renderedScene);
    });
    if ("ResizeObserver" in window) {
      stageResizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(syncStageOffset);
      });
      stageResizeObserver.observe(stage);
    }
    [compactQuery, reducedMotionQuery].forEach((query) => query.addEventListener("change", refreshMode));
    window.addEventListener("resize", () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        refreshMode();
        renderScene(isStaticStory() ? "complete" : activeScene);
        syncStageOffset();
      });
    });
    new MutationObserver(() => {
      cancelTransition({ settle: false });
      renderScene(isStaticStory() ? "complete" : activeScene);
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-theme-mode"],
    });
  };

  const initTokenRhythmChart = ({ tokenRows }) => {
    const rhythmRoot = document.querySelector("[data-token-rhythm]");
    if (!rhythmRoot) return;

    const chart = rhythmRoot.querySelector("[data-token-rhythm-chart]");
    const readout = rhythmRoot.querySelector("[data-token-rhythm-readout]");
    if (!chart || !readout || !tokenRows.length) {
      rhythmRoot.dataset.state = "error";
      if (readout) readout.textContent = "The chart is unavailable; the exact server-rendered table remains below.";
      return;
    }

    let resizeFrame = 0;
    const colors = () => {
      const style = getComputedStyle(rhythmRoot);
      return {
        accent: style.getPropertyValue("--global-primary-color").trim() || "#3b6a98",
        added: style.getPropertyValue("--global-sky-strong").trim() || "#236e8c",
        text: style.getPropertyValue("--global-text-color").trim() || "#23282a",
        muted: style.getPropertyValue("--global-text-color-light").trim() || "#5d6565",
        grid: style.getPropertyValue("--global-divider-color").trim() || "rgba(45,101,112,.2)",
      };
    };
    const render = () => {
      const box = chart.getBoundingClientRect();
      const width = Math.max(300, Math.round(box.width || rhythmRoot.getBoundingClientRect().width || 920));
      const height = Math.max(300, Math.round(box.height || 368));
      const group = svgElement("g", { "data-token-rhythm-layer": "complete" });
      chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
      chart.replaceChildren(group);
      readout.textContent = drawTokenRhythm(group, tokenRows, width, height, colors());
    };
    const scheduleRender = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(render);
    };

    rhythmRoot.dataset.state = "ready";
    render();
    if ("ResizeObserver" in window) new ResizeObserver(scheduleRender).observe(chart);
    else window.addEventListener("resize", scheduleRender);
    new MutationObserver(scheduleRender).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-theme-mode"],
    });
  };

  const initCodexUsageSnapshot = async () => {
    const trendRoot = document.querySelector("[data-codex-usage]");
    if (!trendRoot) return null;

    const status = trendRoot.querySelector("[data-codex-status]");
    const familyStatus = trendRoot.querySelector("[data-agent-family-summary]");
    const lifetime = trendRoot.querySelector("[data-codex-lifetime]");
    const lifetimeHeading = document.getElementById("github-activity-agent-summary-title");
    const cost = trendRoot.querySelector("[data-codex-cost]");
    const costValue = trendRoot.querySelector("[data-codex-cost-value]");
    const codexValue = trendRoot.querySelector("[data-agent-codex-value]");
    const claudeValue = trendRoot.querySelector("[data-agent-claude-value]");
    const composition = trendRoot.querySelector("[data-agent-composition]");
    const codexSegment = trendRoot.querySelector("[data-agent-codex-segment]");
    const claudeSegment = trendRoot.querySelector("[data-agent-claude-segment]");
    if (!status || !lifetime || !lifetimeHeading || !cost || !costValue || !trendRoot.dataset.source) return null;

    const exactKeys = (value, keys) =>
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === keys.length &&
      keys.every((key) => Object.hasOwn(value, key));
    const isIsoDate = (value) => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    };
    const tokensLabel = (tokenCount) => {
      const billions = Math.floor(tokenCount / 1000000000);
      const tenths = Math.floor((tokenCount % 1000000000) / 100000000);
      return `${billions}.${tenths}B`;
    };
    const costLabel = (usdMidpoint) => `~$${(usdMidpoint / 1000).toFixed(1)}K API-rate replay`;
    const validCost = (candidate, tokenCount) => {
      if (!exactKeys(candidate, ["method", "reference_scope", "usd_per_million_tokens", "pricing_as_of", "usd_midpoint", "usd_label"])) return false;
      const replay = (tokenCount / 1000000) * candidate.usd_per_million_tokens;
      const roundedReplay = Math.floor(replay + 0.5);
      if (
        candidate.method !== "flat_reference_rate_replay" ||
        candidate.reference_scope !== "current_site_build_blended_public_api_rate" ||
        typeof candidate.usd_per_million_tokens !== "number" ||
        !Number.isFinite(candidate.usd_per_million_tokens) ||
        candidate.usd_per_million_tokens <= 0 ||
        !Number.isSafeInteger(candidate.usd_midpoint) ||
        candidate.usd_midpoint <= 0 ||
        candidate.usd_midpoint !== roundedReplay ||
        candidate.usd_label !== costLabel(candidate.usd_midpoint) ||
        !isIsoDate(candidate.pricing_as_of)
      )
        return false;
      return true;
    };
    // Strict provenance tuples for the two verified Codex accounts alone, or
    // those two plus observed local Claude Code usage.
    const sourceContracts = {
      2: {
        dailyLabel: "Combined daily Codex usage",
        method: "rounded_sum_of_verified_account_lifetime_readings",
        confidence: "high",
      },
      3: {
        dailyLabel: "Combined daily agent usage",
        method: "rounded_sum_of_observed_agent_usage_sources",
        confidence: "mixed",
      },
    };
    const validDailyUsage = (candidate, combined, observedOn, profileSchema) => {
      const split = candidate?.schema === 2;
      const usageKeys = split
        ? ["schema", "label", "units", "grain", "aggregation", "agent_families", "coverage", "points"]
        : ["schema", "label", "units", "grain", "aggregation", "coverage", "points"];
      const coverageKeys = split
        ? ["starts_on", "complete_through", "before_start", "completeness", "prior_unallocated_tokens", "prior_unallocated_by_agent"]
        : ["starts_on", "complete_through", "before_start", "completeness", "prior_unallocated_tokens"];
      if (
        !exactKeys(candidate, usageKeys) ||
        ![1, 2].includes(candidate.schema) ||
        (profileSchema === 7 ? !split || combined.source_count !== 3 : split) ||
        (split &&
          (!Array.isArray(candidate.agent_families) ||
            candidate.agent_families.length !== 2 ||
            candidate.agent_families[0] !== "codex" ||
            candidate.agent_families[1] !== "claude")) ||
        candidate.label !== sourceContracts[combined.source_count]?.dailyLabel ||
        candidate.units !== "tokens" ||
        candidate.grain !== "day" ||
        candidate.aggregation !== "sum_of_sources" ||
        !exactKeys(candidate.coverage, coverageKeys) ||
        !isIsoDate(candidate.coverage.starts_on) ||
        !isIsoDate(candidate.coverage.complete_through) ||
        !["zero", "unobserved"].includes(candidate.coverage.before_start) ||
        !["whole_lifetime", "rolling_window_partial"].includes(candidate.coverage.completeness) ||
        !Number.isSafeInteger(candidate.coverage.prior_unallocated_tokens) ||
        candidate.coverage.prior_unallocated_tokens < 0 ||
        !Array.isArray(candidate.points) ||
        candidate.points.length === 0
      )
        return false;

      let familyTotals = null;
      if (split) {
        const priorByAgent = candidate.coverage.prior_unallocated_by_agent;
        if (
          candidate.coverage.starts_on < CODEX_DAILY_HISTORY_START ||
          !exactKeys(priorByAgent, ["codex", "claude"]) ||
          !Number.isSafeInteger(priorByAgent.codex) ||
          !Number.isSafeInteger(priorByAgent.claude) ||
          priorByAgent.codex < 0 ||
          priorByAgent.claude < 0 ||
          (candidate.coverage.starts_on <= CLAUDE_DAILY_HISTORY_START && priorByAgent.claude !== 0) ||
          priorByAgent.codex + priorByAgent.claude !== candidate.coverage.prior_unallocated_tokens
        )
          return false;
        familyTotals = { ...priorByAgent };
      }

      const wholeLifetime = candidate.coverage.completeness === "whole_lifetime";
      if (
        (combined.source_count === 3 && wholeLifetime) ||
        (wholeLifetime && (candidate.coverage.before_start !== "zero" || candidate.coverage.prior_unallocated_tokens !== 0)) ||
        (!wholeLifetime && (candidate.coverage.before_start !== "unobserved" || candidate.coverage.prior_unallocated_tokens <= 0))
      )
        return false;
      const latestCompleted = new Date(utcDate(observedOn).getTime() - DAY_MS).toISOString().slice(0, 10);

      let previousDate = null;
      let tokenTotal = candidate.coverage.prior_unallocated_tokens;
      const validPoints = candidate.points.every((point) => {
        const pointKeys = split ? ["date", "tokens", "agent_tokens"] : ["date", "tokens"];
        if (!exactKeys(point, pointKeys) || !isIsoDate(point.date) || !Number.isSafeInteger(point.tokens) || point.tokens < 0) return false;
        if (split) {
          const agentTokens = point.agent_tokens;
          if (
            !exactKeys(agentTokens, ["codex", "claude"]) ||
            !Number.isSafeInteger(agentTokens.codex) ||
            !Number.isSafeInteger(agentTokens.claude) ||
            agentTokens.codex < 0 ||
            agentTokens.claude < 0 ||
            (point.date < CLAUDE_DAILY_HISTORY_START && agentTokens.claude !== 0) ||
            agentTokens.codex + agentTokens.claude !== point.tokens
          )
            return false;
          familyTotals.codex += agentTokens.codex;
          familyTotals.claude += agentTokens.claude;
          if (!Number.isSafeInteger(familyTotals.codex) || !Number.isSafeInteger(familyTotals.claude)) return false;
        }
        const date = utcDate(point.date);
        if (previousDate && date.getTime() - previousDate.getTime() !== DAY_MS) return false;
        previousDate = date;
        tokenTotal += point.tokens;
        return Number.isSafeInteger(tokenTotal);
      });
      return (
        validPoints &&
        candidate.coverage.starts_on === candidate.points[0].date &&
        candidate.coverage.complete_through === candidate.points.at(-1).date &&
        candidate.coverage.complete_through === latestCompleted &&
        (!wholeLifetime ||
          (candidate.points[0].tokens === 0 &&
            (!split || (candidate.points[0].agent_tokens.codex === 0 && candidate.points[0].agent_tokens.claude === 0)))) &&
        Math.round(tokenTotal / 100_000_000) * 100_000_000 === combined.token_count
      );
    };
    const validSource = (candidate) => {
      const requiredKeys = ["schema", "combined_lifetime", "method", "confidence", "observed_on", "updated_at", "automated_refresh"];
      if (![6, 7].includes(candidate?.schema) || !exactKeys(candidate, [...requiredKeys, "cost", "combined_daily_usage"])) return false;
      const combined = candidate.combined_lifetime;
      if (
        !exactKeys(combined, ["token_count", "tokens_label", "units", "aggregation", "rounding", "source_count"]) ||
        !Number.isSafeInteger(combined.token_count) ||
        combined.token_count <= 0 ||
        combined.token_count % 100000000 !== 0 ||
        combined.tokens_label !== tokensLabel(combined.token_count) ||
        combined.units !== "tokens" ||
        combined.aggregation !== "sum_of_sources" ||
        combined.rounding !== "nearest_0.1B" ||
        !Number.isSafeInteger(combined.source_count) ||
        !Object.hasOwn(sourceContracts, combined.source_count) ||
        !isIsoDate(candidate.observed_on) ||
        typeof candidate.automated_refresh !== "boolean"
      )
        return false;
      if (!validCost(candidate.cost, combined.token_count)) return false;
      if (!validDailyUsage(candidate.combined_daily_usage, combined, candidate.observed_on, candidate.schema)) return false;
      return (
        candidate.method === sourceContracts[combined.source_count].method &&
        candidate.confidence === sourceContracts[combined.source_count].confidence &&
        typeof candidate.updated_at === "string" &&
        !Number.isNaN(Date.parse(candidate.updated_at)) &&
        candidate.updated_at.slice(0, 10) === candidate.observed_on &&
        candidate.automated_refresh === true
      );
    };

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
      trendRoot.dataset.state = "error";
      trendRoot.setAttribute("aria-busy", "false");
      trendRoot.hidden = true;
      lifetime.textContent = "Unavailable";
      lifetime.dataset.format = "unavailable";
      cost.hidden = true;
      status.textContent = "Personal agent daily usage unavailable; code activity remains available.";
      if (familyStatus) familyStatus.hidden = true;
      return null;
    }

    lifetime.textContent = source.combined_lifetime.tokens_label;
    lifetime.dataset.format = "readable";
    const statusDate = source.combined_daily_usage.coverage.complete_through;
    const familyTotals = agentFamilyTotals(source);
    const exactLifetime = lifetimeHistoryRows(source).at(-1)?.tokenCount || source.combined_lifetime.token_count;
    lifetimeHeading.setAttribute("aria-label", `${number.format(exactLifetime)} total tokens`);
    if (familyStatus && familyTotals && codexValue && claudeValue && composition && codexSegment && claudeSegment) {
      const percentages = agentFamilyPercentages(familyTotals);
      codexValue.textContent = `${familyNumber.format(familyTotals.codex)} \u00b7 ${percentages.codex.toFixed(2)}%`;
      codexValue.setAttribute("aria-label", `${number.format(familyTotals.codex)} Codex tokens, ${percentages.codex.toFixed(2)} percent`);
      claudeValue.textContent = `${familyNumber.format(familyTotals.claude)} \u00b7 ${percentages.claude.toFixed(2)}%`;
      claudeValue.setAttribute("aria-label", `${number.format(familyTotals.claude)} Claude tokens, ${percentages.claude.toFixed(2)} percent`);
      const exactTotal = familyTotals.codex + familyTotals.claude;
      const codexShare = Number(((familyTotals.codex / exactTotal) * 100).toFixed(4));
      const claudeShare = Number((100 - codexShare).toFixed(4));
      codexSegment.style.width = `${codexShare}%`;
      claudeSegment.style.width = `${claudeShare}%`;
      composition.setAttribute(
        "aria-label",
        `Token composition: Codex ${number.format(familyTotals.codex)} tokens, ${percentages.codex.toFixed(2)} percent; Claude ${number.format(
          familyTotals.claude
        )} tokens, ${percentages.claude.toFixed(2)} percent.`
      );
      familyStatus.hidden = false;
    } else if (familyStatus) {
      familyStatus.hidden = true;
    }
    const coverageStart = source.combined_daily_usage.coverage.starts_on;
    status.textContent =
      hasAgentFamilyBreakdown(source) && source.combined_daily_usage.coverage.before_start === "unobserved"
        ? `Daily Codex history begins ${fullDate.format(utcDate(coverageStart))}. Claude joins ${fullDate.format(
            utcDate(CLAUDE_DAILY_HISTORY_START)
          )}. History is complete through ${fullDate.format(utcDate(statusDate))}.`
        : source.combined_daily_usage.coverage.before_start === "unobserved"
          ? `Daily history begins ${fullDate.format(utcDate(coverageStart))}. Earlier usage is included in the total; its daily timing is unavailable.`
          : `Daily history is complete through ${fullDate.format(utcDate(statusDate))}.`;
    if (source.cost) {
      costValue.textContent = source.cost.usd_label.replace(/ API-rate replay$/, "");
      cost.hidden = false;
    } else {
      costValue.textContent = "";
      cost.hidden = true;
    }
    trendRoot.dataset.state = "ready";
    trendRoot.setAttribute("aria-busy", "false");
    trendRoot.hidden = false;
    return source;
  };

  const root = document.querySelector("[data-github-activity]");
  const dataNode = document.getElementById("personal-code-activity-data");
  const tokenDataNode = document.getElementById("build-rhythm-token-data");
  if (!root || !dataNode) return;
  const availabilityBadge = root.querySelector("[data-github-scope]");

  const hasExactKeys = (value, keys) =>
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
  const validCodeCounts = (row) =>
    hasExactKeys(row, ["date", "commits", "additions", "deletions"]) &&
    isIsoDate(row.date) &&
    Number.isSafeInteger(row.commits) &&
    row.commits >= 0 &&
    Number.isSafeInteger(row.additions) &&
    row.additions >= 0 &&
    Number.isSafeInteger(row.deletions) &&
    row.deletions >= 0;
  const fiveCalendarYearsBefore = (value) => {
    const year = value.getUTCFullYear() - 5;
    const month = value.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(value.getUTCDate(), lastDay)));
  };
  const validPersonalActivitySource = (candidate) => {
    if (
      !hasExactKeys(candidate, ["schema", "updated_on", "timezone", "scope", "coverage", "points"]) ||
      candidate.schema !== 3 ||
      candidate.timezone !== "UTC" ||
      candidate.scope !== "personal_code_activity" ||
      !isIsoDate(candidate.updated_on) ||
      !hasExactKeys(candidate.coverage, ["starts_on", "complete_through", "status"]) ||
      !isIsoDate(candidate.coverage.starts_on) ||
      !isIsoDate(candidate.coverage.complete_through) ||
      candidate.coverage.status !== "complete" ||
      !Array.isArray(candidate.points) ||
      candidate.points.length === 0 ||
      !candidate.points.every(validCodeCounts)
    )
      return false;
    let previousDate = null;
    const ordered = candidate.points.every((point) => {
      const date = utcDate(point.date);
      if (previousDate && date.getTime() - previousDate.getTime() !== DAY_MS) return false;
      previousDate = date;
      return true;
    });
    const startsOn = utcDate(candidate.coverage.starts_on);
    const completeThrough = utcDate(candidate.coverage.complete_through);
    const expectedStart = fiveCalendarYearsBefore(new Date(completeThrough.getTime() + DAY_MS));
    const expectedLength = Math.round((completeThrough - startsOn) / DAY_MS) + 1;
    return (
      ordered &&
      startsOn.getTime() === expectedStart.getTime() &&
      candidate.coverage.starts_on === candidate.points[0].date &&
      candidate.coverage.complete_through === candidate.points.at(-1).date &&
      candidate.updated_on === candidate.coverage.complete_through &&
      candidate.points.length === expectedLength &&
      completeThrough < utcDate(new Date().toISOString().slice(0, 10))
    );
  };

  const validTokenRhythmSource = (candidate) => {
    const keys = ["schema", "label", "units", "grain", "aggregation", "method", "since", "updated_at", "confidence", "privacy_note", "points"];
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate) ||
      Object.keys(candidate).length !== keys.length ||
      !keys.every((key) => Object.hasOwn(candidate, key)) ||
      candidate.schema !== 1 ||
      candidate.label !== "Site revamp retained-session estimate" ||
      candidate.units !== "estimated tokens" ||
      candidate.grain !== "day" ||
      candidate.aggregation !== "cumulative" ||
      candidate.method !== "deduplicated_repo_retained_logs" ||
      candidate.confidence !== "estimate" ||
      !isIsoDate(candidate.since) ||
      !isIsoDate(candidate.updated_at) ||
      typeof candidate.privacy_note !== "string" ||
      !candidate.privacy_note ||
      !Array.isArray(candidate.points) ||
      candidate.points.length < 2
    )
      return false;

    let previousDate = null;
    let previousCount = -1;
    const validPoints = candidate.points.every((point) => {
      const pointKeys = ["date", "token_count", "tokens_label"];
      if (
        !point ||
        typeof point !== "object" ||
        Array.isArray(point) ||
        Object.keys(point).length !== pointKeys.length ||
        !pointKeys.every((key) => Object.hasOwn(point, key)) ||
        !isIsoDate(point.date) ||
        !Number.isSafeInteger(point.token_count) ||
        point.token_count < 0 ||
        point.token_count < previousCount ||
        typeof point.tokens_label !== "string" ||
        !point.tokens_label
      )
        return false;
      const date = new Date(`${point.date}T00:00:00Z`);
      if (previousDate && date.getTime() - previousDate.getTime() !== 86_400_000) return false;
      previousDate = date;
      previousCount = point.token_count;
      return true;
    });
    return validPoints && candidate.since === candidate.points[0].date && candidate.updated_at === candidate.points.at(-1).date;
  };

  let source;
  try {
    source = JSON.parse(dataNode.textContent);
  } catch {
    source = null;
  }
  const validPersonalSource = validPersonalActivitySource(source);

  let tokenSource = null;
  if (tokenDataNode) {
    try {
      const candidate = JSON.parse(tokenDataNode.textContent);
      if (validTokenRhythmSource(candidate)) tokenSource = candidate;
    } catch {
      tokenSource = null;
    }
  }
  root.dataset.tokenState = tokenSource ? "ready" : "error";

  const tokenRows = tokenSource
    ? tokenSource.points.map((point, index) => ({
        index,
        date: new Date(`${point.date}T00:00:00Z`),
        tokenCount: point.token_count,
        tokensLabel: point.tokens_label,
      }))
    : [];
  initTokenRhythmChart({ tokenRows });
  const codexSourcePromise = initCodexUsageSnapshot();

  if (!validPersonalSource) {
    root.dataset.sourceSchema = source?.schema == null ? "none" : String(source.schema);
    root.dataset.state = "unavailable";
    if (availabilityBadge) availabilityBadge.textContent = "PERSONAL";
    return;
  }
  if (availabilityBadge) availabilityBadge.textContent = "5 YEARS · DAILY";

  const rows = source.points.map((row, index) => ({
    index,
    dateKey: row.date,
    date: utcDate(row.date),
    commits: row.commits,
    additions: row.additions,
    deletions: row.deletions,
  }));
  let range = "5";
  let scale = "log";
  const chart = document.getElementById("github-activity-chart");
  const chartTitle = document.getElementById("github-activity-chart-title");
  const selectedDate = document.getElementById("github-activity-selected-date");
  const selectedCommits = document.getElementById("github-activity-selected-commits");
  const selectedAdditions = document.getElementById("github-activity-selected-additions");
  const selectedDeletions = document.getElementById("github-activity-selected-deletions");
  const selectedTokens = document.getElementById("github-activity-selected-tokens");
  const codexReadout = root.querySelector("[data-personal-codex-readout]");
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
    !selectedAdditions ||
    !selectedDeletions ||
    !selectedTokens ||
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
  let codexSource = null;
  let codexSourceSettled = false;
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
  const selectedDomain = () => {
    const latestAgentDate = lifetimeHistoryRows(codexSource).at(-1)?.date;
    const end = latestAgentDate && latestAgentDate > rows.at(-1).date ? latestAgentDate : rows.at(-1).date;
    const start = range === "all" ? rows[0].date : new Date(Date.UTC(end.getUTCFullYear() - Number(range), end.getUTCMonth(), end.getUTCDate()));
    return { start, end };
  };
  const selectedRows = () => {
    const domain = selectedDomain();
    return rows.filter((row) => row.date >= domain.start && row.date <= domain.end);
  };
  const analysisRows = (data) => (selection ? data.filter((row) => row.index >= selection.start && row.index <= selection.end) : data);
  const colors = () => {
    const style = getComputedStyle(root);
    return {
      added: style.getPropertyValue("--global-sky-strong").trim() || "#236e8c",
      removed: style.getPropertyValue("--global-mint-strong").trim() || "#26735d",
      addedText: style.getPropertyValue("--github-activity-added-text").trim() || "#28657d",
      removedText: style.getPropertyValue("--github-activity-removed-text").trim() || "#286b58",
      accent: style.getPropertyValue("--global-primary-color").trim() || "#3b6a98",
      codex: style.getPropertyValue("--github-activity-codex-color").trim() || "#3b6a98",
      claude: style.getPropertyValue("--github-activity-claude-color").trim() || "#c96548",
      text: style.getPropertyValue("--global-text-color").trim() || "#23282a",
      muted: style.getPropertyValue("--global-text-color-light").trim() || "#5d6565",
      grid: style.getPropertyValue("--global-divider-color").trim() || "rgba(45,101,112,.2)",
      surface: style.getPropertyValue("--global-surface-container-low-color").trim() || "#f7fbfa",
    };
  };
  const setPressedState = () => {
    rangeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.range === range)));
    scaleButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.scale === scale)));
    if (scopeBadge) {
      const rangeLabel = range === "all" ? "ALL HISTORY" : `${range} ${range === "1" ? "YEAR" : "YEARS"}`;
      scopeBadge.textContent = `${rangeLabel} \u00b7 DAILY`;
    }
  };
  const updateDayReadout = (row) => {
    selectedDate.textContent = dateLabel.format(row.date);
    selectedCommits.textContent = `${number.format(row.commits)} ${row.commits === 1 ? "commit" : "commits"}`;
    selectedAdditions.textContent = `${signed(row.additions, true)} added`;
    selectedDeletions.textContent = `${signed(row.deletions, false)} removed`;
    const tokenObservation = codexUsageForDay(codexSource, row);
    if (tokenObservation) {
      if (tokenObservation.dailyAgentTokens) {
        selectedTokens.textContent = `+${familyNumber.format(tokenObservation.dailyTokens)} tokens \u00b7 Codex +${familyNumber.format(
          tokenObservation.dailyAgentTokens.codex
        )} \u00b7 Claude +${familyNumber.format(tokenObservation.dailyAgentTokens.claude)} \u00b7 ${compactNumber.format(
          tokenObservation.tokenCount
        )} total`;
        selectedTokens.setAttribute(
          "aria-label",
          `${number.format(tokenObservation.dailyTokens)} tokens that day: ${number.format(
            tokenObservation.dailyAgentTokens.codex
          )} Codex and ${number.format(tokenObservation.dailyAgentTokens.claude)} Claude; ${number.format(
            tokenObservation.tokenCount
          )} cumulative tokens.`
        );
      } else {
        selectedTokens.textContent =
          tokenObservation.dailyTokens == null
            ? `${tokenObservation.tokensLabel} lifetime tokens \u00b7 legacy observation ${dateLabel.format(tokenObservation.date)}`
            : `+${familyNumber.format(tokenObservation.dailyTokens)} tokens \u00b7 ${compactNumber.format(tokenObservation.tokenCount)} total`;
        selectedTokens.setAttribute(
          "aria-label",
          tokenObservation.dailyTokens == null
            ? `${number.format(tokenObservation.tokenCount)} lifetime tokens, legacy observation ${dateLabel.format(tokenObservation.date)}.`
            : `${number.format(tokenObservation.dailyTokens)} tokens that day; ${number.format(tokenObservation.tokenCount)} cumulative tokens.`
        );
      }
    } else if (!codexSourceSettled) {
      selectedTokens.textContent = "Token usage loading";
      selectedTokens.removeAttribute("aria-label");
    } else {
      selectedTokens.textContent = "Token usage \u00b7 unobserved or awaiting a completed day";
      selectedTokens.removeAttribute("aria-label");
    }
  };
  const updateTable = (data) => {
    const fragment = document.createDocumentFragment();
    [...data].reverse().forEach((row) => {
      const tr = document.createElement("tr");
      const tokenObservation = codexUsageForDay(codexSource, row);
      const tokenCells = tokenObservation
        ? [
            tokenObservation.dailyTokens == null ? "Legacy observation" : number.format(tokenObservation.dailyTokens),
            tokenObservation.dailyAgentTokens ? number.format(tokenObservation.dailyAgentTokens.codex) : "\u2014",
            tokenObservation.dailyAgentTokens ? number.format(tokenObservation.dailyAgentTokens.claude) : "\u2014",
            number.format(tokenObservation.tokenCount),
          ]
        : ["\u2014", "\u2014", "\u2014", "\u2014"];
      [
        row.dateKey,
        number.format(row.commits),
        signed(row.additions, true),
        signed(row.deletions, false),
        number.format(lineChanges(row)),
        ...tokenCells,
      ].forEach((value, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        if (index === 0) cell.scope = "row";
        cell.textContent = value;
        tr.append(cell);
      });
      fragment.append(tr);
    });
    tableBody.replaceChildren(fragment);
    tableCaption.textContent = selection ? "Reported daily activity in the selected range" : "Reported daily activity in the selected time window";
  };
  const updateAggregate = (data, announce = false, refreshTable = true) => {
    const scoped = analysisRows(data);
    const active = scoped.filter((row) => row.commits > 0 || row.additions > 0 || row.deletions > 0);
    const totalCommits = scoped.reduce((sum, row) => sum + row.commits, 0);
    const totalAdditions = scoped.reduce((sum, row) => sum + row.additions, 0);
    const totalDeletions = scoped.reduce((sum, row) => sum + row.deletions, 0);
    const scope = selection
      ? `Selected ${number.format(scoped.length)} ${scoped.length === 1 ? "day" : "days"}`
      : range === "all"
        ? "All history"
        : `${range} ${range === "1" ? "year" : "years"}`;
    const dates = `${dateLabel.format(scoped[0].date)} \u2014 ${dateLabel.format(scoped.at(-1).date)}`;
    rangeSummary.textContent = `${scope} \u00b7 ${dates} \u00b7 ${number.format(active.length)} active days \u00b7 ${number.format(totalCommits)} commits \u00b7 +${compactNumber.format(totalAdditions)} / \u2212${compactNumber.format(totalDeletions)} lines`;
    clearSelectionButton.hidden = !selection;

    if (active.length) {
      const busiest = active.reduce((best, row) => (row.commits > best.commits ? row : best));
      const largest = active.reduce((best, row) => (lineChanges(row) > lineChanges(best) ? row : best));
      const medianMagnitude = percentile(active.map(lineChanges), 0.5);
      annotation.textContent = `Largest line-change day \u00b7 ${dateLabel.format(largest.date)} \u00b7 ${signed(largest.additions, true)} / ${signed(largest.deletions, false)}. Highest commit day \u00b7 ${dateLabel.format(busiest.date)} \u00b7 ${number.format(busiest.commits)} commits. Median active-day line magnitude \u00b7 ${compactNumber.format(medianMagnitude)}.`;
    } else {
      annotation.textContent = "No active days in this scope. Median active-day line magnitude \u00b7 \u2014.";
    }
    // Range feedback follows the pointer, while the reported-value table only
    // rebuilds after the selection is finalized.
    if (refreshTable) updateTable(scoped);
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
    const historyAvailable = Boolean(codexSource?.combined_daily_usage || codexSource?.combined_lifetime_history);
    const left = narrow ? 66 : 82;
    const right = narrow ? 12 : 22;
    const bottom = narrow ? 26 : 30;
    const agentBandHeight = historyAvailable ? (narrow ? 92 : 106) : 0;
    const agentGap = historyAvailable ? (narrow ? 42 : 48) : 0;
    const commitTop = 42;
    const commitHeight = Math.max(92, Math.min(118, height * 0.19));
    const commitBottom = commitTop + commitHeight;
    const lineTop = commitBottom + (narrow ? 58 : 64);
    const agentBottom = height - bottom;
    const agentTop = agentBottom - agentBandHeight;
    const agentHeadingY = agentTop - 14;
    const lineBottom = historyAvailable ? agentHeadingY - agentGap : agentBottom - (narrow ? 20 : 24);
    const yearLabelY = height - (narrow ? 5 : 7);
    const plotTop = commitTop;
    const plotBottom = historyAvailable ? agentBottom : lineBottom;
    const baseline = (lineTop + lineBottom) / 2;
    const lineHalf = Math.max(20, (lineBottom - lineTop) / 2 - 12);
    const domain = selectedDomain();
    const start = domain.start.getTime();
    const end = domain.end.getTime();
    const span = Math.max(1, end - start);
    const rawLineMaximum = Math.max(...data.flatMap((row) => [row.additions, row.deletions]), 1);
    const rawCommitMaximum = Math.max(...data.map((row) => row.commits), 1);
    const lineLinear = niceLinearScale(rawLineMaximum, narrow ? 3 : 4);
    const commitLinear = niceLinearScale(rawCommitMaximum, narrow ? 3 : 4);
    const lineDomainMaximum = scale === "linear" ? lineLinear.domainMaximum : niceLogMaximum(rawLineMaximum);
    const commitDomainMaximum = scale === "linear" ? commitLinear.domainMaximum : niceLogMaximum(rawCommitMaximum);
    const lineLogMaximum = Math.log1p(lineDomainMaximum);
    const commitLogMaximum = Math.log1p(commitDomainMaximum);
    const x = (date) => left + ((date.getTime() - start) / span) * (width - left - right);
    const lineTransform = (value) => (scale === "linear" ? value / lineDomainMaximum : Math.log1p(value) / lineLogMaximum);
    const lineY = (value) => baseline - Math.sign(value) * lineTransform(Math.abs(value)) * lineHalf;
    const commitY = (value) =>
      commitBottom - (scale === "linear" ? value / commitDomainMaximum : Math.log1p(value) / commitLogMaximum) * commitHeight;
    chart.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const grid = svgElement("g", { "aria-hidden": "true" });
    let lineTicks;
    if (scale === "linear") {
      lineTicks = lineLinear.ticks;
    } else {
      const candidates = new Set([0, lineDomainMaximum]);
      for (let power = 0; 10 ** power <= lineDomainMaximum; power += 1) {
        [1, 2, 5].forEach((multiple) => {
          const value = multiple * 10 ** power;
          if (value <= lineDomainMaximum) candidates.add(value);
        });
      }
      lineTicks = [];
      [...candidates]
        .sort((a, b) => a - b)
        .forEach((value) => {
          const previous = lineTicks.at(-1);
          if (previous == null || Math.abs(lineY(previous) - lineY(value)) >= (narrow ? 15 : 18)) lineTicks.push(value);
        });
      if (!lineTicks.includes(lineDomainMaximum)) {
        if (Math.abs(lineY(lineTicks.at(-1)) - lineY(lineDomainMaximum)) < (narrow ? 15 : 18)) lineTicks.pop();
        lineTicks.push(lineDomainMaximum);
      }
      lineTicks = lineTicks.filter((value) => value > 0);
    }
    lineTicks.forEach((tick) => {
      [1, -1].forEach((direction) => {
        const yy = lineY(direction * tick);
        grid.append(svgElement("line", { x1: left, y1: yy, x2: width - right, y2: yy, stroke: palette.grid, "stroke-width": 1 }));
        addText(grid, `${direction > 0 ? "+" : "\u2212"}${compactNumber.format(tick)}`, left - 8, yy + 4, {
          anchor: "end",
          color: palette.muted,
          className: `github-activity-line-tick is-${direction > 0 ? "positive" : "negative"}`,
        });
      });
    });
    grid.append(
      svgElement("line", {
        x1: left,
        y1: baseline,
        x2: width - right,
        y2: baseline,
        stroke: palette.text,
        "stroke-opacity": 0.38,
        "stroke-width": 1.4,
      })
    );
    addText(grid, "0", left - 8, baseline + 4, {
      anchor: "end",
      color: palette.muted,
      className: "github-activity-line-tick is-zero",
    });

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
      commitTicks = [];
      [...candidates]
        .sort((a, b) => a - b)
        .forEach((value) => {
          const previous = commitTicks.at(-1);
          if (previous == null || Math.abs(commitY(previous) - commitY(value)) >= (narrow ? 14 : 17)) commitTicks.push(value);
        });
      if (!commitTicks.includes(commitDomainMaximum)) {
        if (Math.abs(commitY(commitTicks.at(-1)) - commitY(commitDomainMaximum)) < 14) commitTicks.pop();
        commitTicks.push(commitDomainMaximum);
      }
    }
    commitTicks.forEach((tick) => {
      const yy = commitY(tick);
      grid.append(svgElement("line", { x1: left, y1: yy, x2: width - right, y2: yy, stroke: palette.grid, "stroke-width": 1 }));
      addText(grid, compactNumber.format(tick), left - 8, yy + 4, {
        anchor: "end",
        color: palette.muted,
        className: "github-activity-commit-tick",
      });
    });

    const yearTicks = new Set();
    data.forEach((row) => {
      const year = row.date.getUTCFullYear();
      if (yearTicks.has(year) || row.date.getUTCMonth() !== 0) return;
      yearTicks.add(year);
      const xx = x(row.date);
      grid.append(
        svgElement("line", {
          class: "github-activity-year-grid",
          "data-year": year,
          x1: xx,
          y1: plotTop,
          x2: xx,
          y2: plotBottom,
          stroke: palette.grid,
          "stroke-width": 1,
        })
      );
      addText(grid, String(year), xx, yearLabelY, { anchor: "middle", color: palette.muted });
    });
    if (yearTicks.size < 2) {
      addText(grid, data[0].dateKey, left, yearLabelY, { color: palette.muted });
      addText(grid, data.at(-1).dateKey, width - right, yearLabelY, { anchor: "end", color: palette.muted });
    }
    chart.append(grid);
    addText(chart, `COMMITS / DAY \u00b7 ${scale === "linear" ? "LITERAL LINEAR" : "READABLE LOG1P"}`, left, 20, {
      color: palette.accent,
      weight: 700,
    });
    const lineScaleLabel = scale === "linear" ? "LINEAR" : "SYMLOG";
    const lineHeading = narrow
      ? `LINES / DAY \u00b7 ${lineScaleLabel}`
      : `LINES CHANGED / DAY \u00b7 ${scale === "linear" ? "LITERAL LINEAR" : "READABLE SYMLOG"}`;
    addText(chart, lineHeading, left, lineTop - 34, {
      color: palette.muted,
      weight: 700,
      className: "github-activity-line-heading",
    });
    addText(chart, "+ added", left, lineTop - 14, { color: palette.addedText, weight: 650 });
    addText(chart, "\u2212 removed", left + (narrow ? 76 : 86), lineTop - 14, { color: palette.removedText, weight: 650 });

    let renderPeak = () => {};
    const selectionBand = svgElement("rect", {
      class: "github-activity-selection-band",
      y: plotTop,
      height: plotBottom - plotTop,
      fill: palette.accent,
      "fill-opacity": 0.1,
      stroke: palette.accent,
      "stroke-opacity": 0.62,
      "stroke-width": 1.2,
      visibility: "hidden",
      "pointer-events": "none",
    });
    chart.append(selectionBand);

    const commitPoints = data.map((row) => [x(row.date), commitY(row.commits)]);
    const addPoints = data.map((row) => [x(row.date), lineY(row.additions)]);
    const removePoints = data.map((row) => [x(row.date), lineY(-row.deletions)]);
    const addStems = data
      .map((row) => `M ${x(row.date).toFixed(2)} ${baseline.toFixed(2)} L ${x(row.date).toFixed(2)} ${lineY(row.additions).toFixed(2)}`)
      .join(" ");
    const removeStems = data
      .map((row) => `M ${x(row.date).toFixed(2)} ${baseline.toFixed(2)} L ${x(row.date).toFixed(2)} ${lineY(-row.deletions).toFixed(2)}`)
      .join(" ");
    chart.append(
      svgElement("path", {
        class: "github-activity-commit-area",
        d: areaPath(commitPoints, commitBottom),
        fill: palette.accent,
        "fill-opacity": 0.1,
      }),
      svgElement("path", {
        class: "github-activity-commit-line",
        d: linePath(commitPoints),
        fill: "none",
        stroke: palette.accent,
        "stroke-width": 1.9,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }),
      svgElement("path", {
        class: "github-activity-add-stems",
        d: addStems,
        fill: "none",
        stroke: palette.added,
        "stroke-opacity": 0.18,
        "stroke-width": 1,
      }),
      svgElement("path", {
        class: "github-activity-remove-stems",
        d: removeStems,
        fill: "none",
        stroke: palette.removed,
        "stroke-opacity": 0.18,
        "stroke-width": 1,
      }),
      svgElement("path", {
        class: "github-activity-add-line",
        d: linePath(addPoints),
        fill: "none",
        stroke: palette.added,
        "stroke-width": 1.7,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }),
      svgElement("path", {
        class: "github-activity-remove-line",
        d: linePath(removePoints),
        fill: "none",
        stroke: palette.removed,
        "stroke-width": 1.7,
        "stroke-dasharray": "4 2",
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      })
    );

    let agentPlot = null;
    if (historyAvailable) {
      const agentRailHeading = narrow
        ? "AGENT TOKENS · CUMULATIVE"
        : hasAgentFamilyBreakdown(codexSource)
          ? "PERSONAL AGENT TOKENS · STACKED CUMULATIVE"
          : "PERSONAL AGENT TOKENS · CUMULATIVE TOTAL";
      addText(chart, agentRailHeading, left, agentHeadingY, {
        color: palette.accent,
        weight: 700,
        className: "github-activity-agent-rail-heading",
      });
      addText(chart, `TOTAL LINE \u00b7 ${codexSource.combined_lifetime.tokens_label}`, width - right, agentHeadingY, {
        anchor: "end",
        color: palette.text,
        weight: 700,
        className: "github-activity-agent-rail-value",
      });
      agentPlot = drawSharedAgentRail(chart, {
        source: codexSource,
        domainStart: domain.start,
        domainEnd: domain.end,
        x,
        top: agentTop,
        bottom: agentBottom,
        left,
        right: width - right,
        colors: palette,
      });
    }

    const peakGuide = svgElement("line", {
      class: "github-activity-peak-guide",
      y1: plotTop,
      y2: lineBottom,
      stroke: palette.accent,
      "stroke-width": 1.3,
      "stroke-dasharray": "3 4",
      "stroke-opacity": 0.72,
    });
    chart.append(peakGuide);
    renderPeak = () => {
      const scoped = analysisRows(data);
      const active = scoped.filter((row) => row.commits > 0 || row.additions > 0 || row.deletions > 0);
      if (!active.length) {
        peakGuide.setAttribute("visibility", "hidden");
        return;
      }
      const largest = active.reduce((best, row) => (lineChanges(row) > lineChanges(best) ? row : best));
      const xx = x(largest.date);
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
      y1: plotTop,
      y2: plotBottom,
      stroke: palette.text,
      "stroke-width": 1.2,
      "stroke-opacity": 0.68,
    });
    const commitMarker = svgElement("circle", {
      class: "github-activity-commit-marker",
      r: narrow ? 3.8 : 4.2,
      fill: palette.surface,
      stroke: palette.accent,
      "stroke-width": 2.1,
    });
    const addMarker = svgElement("circle", {
      class: "github-activity-add-marker",
      r: narrow ? 4 : 4.5,
      fill: palette.surface,
      stroke: palette.added,
      "stroke-width": 2.2,
    });
    const removeMarker = svgElement("circle", {
      class: "github-activity-remove-marker",
      r: narrow ? 4 : 4.5,
      fill: palette.surface,
      stroke: palette.removed,
      "stroke-width": 2.2,
    });
    const agentMarker = svgElement("circle", {
      class: "github-activity-agent-rail-inspector-marker",
      r: narrow ? 3.8 : 4.3,
      fill: palette.surface,
      stroke: palette.text,
      "stroke-width": 2.1,
      visibility: "hidden",
    });
    const overlay = svgElement("rect", {
      class: "github-activity-inspector",
      x: left,
      y: plotTop,
      width: width - left - right,
      height: plotBottom - plotTop,
      fill: "transparent",
      tabindex: 0,
      focusable: "true",
      role: "slider",
      "aria-label": "Daily personal commits, line changes, and agent token usage inspector",
      "aria-valuemin": 0,
      "aria-valuemax": data.length - 1,
      "aria-describedby": "github-activity-chart-instructions",
    });
    chart.append(guide, commitMarker, addMarker, removeMarker, agentMarker, overlay);

    const showIndex = (index, { pin = false } = {}) => {
      selectedIndex = clamp(index, data[0].index, data.at(-1).index);
      if (pin) pinnedIndex = selectedIndex;
      const row = rows[selectedIndex];
      const xx = x(row.date);
      guide.setAttribute("x1", xx);
      guide.setAttribute("x2", xx);
      commitMarker.setAttribute("cx", xx);
      commitMarker.setAttribute("cy", commitY(row.commits));
      addMarker.setAttribute("cx", xx);
      addMarker.setAttribute("cy", lineY(row.additions));
      removeMarker.setAttribute("cx", xx);
      removeMarker.setAttribute("cy", lineY(-row.deletions));
      const tokenObservation = codexUsageForDay(codexSource, row);
      if (agentPlot && tokenObservation) {
        agentMarker.setAttribute("cx", xx);
        agentMarker.setAttribute("cy", agentPlot.y(tokenObservation.tokenCount));
        agentMarker.setAttribute("visibility", "visible");
      } else {
        agentMarker.setAttribute("visibility", "hidden");
      }
      overlay.setAttribute("aria-valuenow", String(selectedIndex - data[0].index));
      const tokenValue = tokenObservation
        ? tokenObservation.dailyTokens == null
          ? `${tokenObservation.tokensLabel} lifetime tokens, legacy observation ${fullDate.format(tokenObservation.date)}`
          : tokenObservation.dailyAgentTokens
            ? `${number.format(tokenObservation.dailyTokens)} tokens that day, ${number.format(
                tokenObservation.dailyAgentTokens.codex
              )} Codex and ${number.format(tokenObservation.dailyAgentTokens.claude)} Claude, ${number.format(
                tokenObservation.tokenCount
              )} cumulative tokens`
            : `${number.format(tokenObservation.dailyTokens)} tokens that day, ${number.format(tokenObservation.tokenCount)} cumulative tokens`
        : "token usage unobserved or awaiting a completed day";
      overlay.setAttribute(
        "aria-valuetext",
        `${row.dateKey}, ${number.format(row.commits)} commits, ${signed(row.additions, true)} added, ${signed(row.deletions, false)} removed, ${tokenValue}`
      );
      updateDayReadout(row);
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
      updateAggregate(data, false, false);
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
      else if (event.key === "PageUp") next -= 7;
      else if (event.key === "PageDown") next += 7;
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

  codexSourcePromise.then((source) => {
    codexSourceSettled = true;
    codexSource = source;
    if (codexReadout) codexReadout.hidden = !source;
    chartTitle.textContent = source
      ? "Daily personal commits, additions and deletions, plus personal agent token usage"
      : "Daily personal commits, additions and deletions";
    drawChart();
  });

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

  updated.dateTime = source.updated_on;
  updated.textContent = source.updated_on;
  chartTitle.textContent = "Daily personal commits, additions and deletions";
  setPressedState();
  drawChart();
  initBuildRhythmStory({ githubRows: rows, tokenRows, codexSourcePromise });
  root.dataset.state = "ready";
})();
