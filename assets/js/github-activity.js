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
  const isIsoDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const signed = (value, positive) => `${positive ? "+" : "\u2212"}${number.format(value)}`;
  const lineChanges = (row) => row.additions + row.deletions;

  const initBuildRhythmStory = ({ githubRows, tokenRows, codexSourcePromise }) => {
    const storyRoot = document.querySelector("[data-build-rhythm-story]");
    if (!storyRoot || !githubRows.length || !tokenRows.length) return;

    const stage = storyRoot.querySelector("[data-build-rhythm-story-stage]");
    const chart = storyRoot.querySelector("[data-build-rhythm-story-chart]");
    const sceneLabel = storyRoot.querySelector("[data-build-rhythm-story-label]");
    const sceneScope = storyRoot.querySelector("[data-build-rhythm-story-scope]");
    const sceneReadout = storyRoot.querySelector("[data-build-rhythm-story-readout]");
    const steps = Array.from(storyRoot.querySelectorAll("[data-build-rhythm-step]"));
    if (!stage || !chart || !sceneLabel || !sceneScope || !sceneReadout || !steps.length) return;

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

    const isStaticStory = () => compactQuery.matches || reducedMotionQuery.matches || !("IntersectionObserver" in window);
    const palette = () => {
      const style = getComputedStyle(storyRoot);
      return {
        accent: style.getPropertyValue("--global-primary-color").trim() || "#bf470f",
        added: style.getPropertyValue("--global-sky-strong").trim() || "#2c7290",
        removed: style.getPropertyValue("--global-mint-strong").trim() || "#2f7562",
        text: style.getPropertyValue("--global-text-color").trim() || "#252321",
        muted: style.getPropertyValue("--global-text-color-light").trim() || "#625f5a",
        grid: style.getPropertyValue("--global-divider-color").trim() || "rgba(69,86,82,.17)",
        surface: style.getPropertyValue("--global-surface-container-low-color").trim() || "#fbfcf8",
      };
    };
    const dimensions = () => ({
      width: Math.max(300, Math.round(chart.getBoundingClientRect().width || storyRoot.getBoundingClientRect().width || 720)),
      height: Math.max(300, Math.round(chart.getBoundingClientRect().height || 368)),
    });
    const drawSeries = (group, rows, valueForRow, bounds, options) => {
      const values = rows.map(valueForRow);
      const maximum = options.maximum || Math.max(...values.map(Math.abs), 1);
      const transformedMaximum = options.scale === "linear" ? maximum : Math.log1p(maximum);
      const x = (index) => bounds.left + (index / Math.max(1, rows.length - 1)) * (bounds.right - bounds.left);
      const y = (value) => {
        const transformed = (options.scale === "linear" ? Math.abs(value) : Math.log1p(Math.abs(value))) / transformedMaximum;
        if (options.signed) return bounds.baseline - Math.sign(value) * transformed * (bounds.bottom - bounds.top) * 0.45;
        return bounds.bottom - transformed * (bounds.bottom - bounds.top);
      };
      const points = values.map((value, index) => [x(index), y(value)]);
      if (options.fillOpacity) {
        group.append(
          svgElement("path", {
            d: areaPath(points, options.signed ? bounds.baseline : bounds.bottom),
            fill: options.color,
            "fill-opacity": options.fillOpacity,
          })
        );
      }
      group.append(
        svgElement("path", {
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

    const drawCadence = (group, width, height, colors) => {
      const left = width < 620 ? 42 : 50;
      const right = 14;
      const top = 40;
      const bottom = 30;
      const baseline = height - bottom;

      addText(group, "COMMITS / WEEK \u00b7 READABLE LOG1P", left, 20, { color: colors.accent, weight: 700 });
      drawSeries(
        group,
        storyGithubRows,
        (row) => row.commits,
        { left, right: width - right, top, bottom: baseline },
        { color: colors.accent, fillOpacity: 0.12, scale: "log", strokeWidth: 2 }
      );
      const busiest = storyGithubRows.reduce((best, row) => (row.commits > best.commits ? row : best));
      return `Highest commit week in this view \u00b7 ${fullDate.format(busiest.date)} \u00b7 ${number.format(busiest.commits)} commits. Cadence is not a productivity score.`;
    };

    const drawMagnitude = (group, width, height, colors) => {
      const left = width < 620 ? 46 : 54;
      const right = 14;
      const top = 45;
      const bottom = 30;
      const baseline = (top + height - bottom) / 2;
      const maximum = Math.max(...storyGithubRows.flatMap((row) => [row.additions, row.deletions]), 1);

      addText(group, "LINES CHANGED / WEEK \u00b7 READABLE SYMLOG", left, 20, { color: colors.text, weight: 700 });
      addText(group, "+ added", left, 38, { color: colors.added, weight: 650 });
      addText(group, "\u2212 removed", left + 78, 38, { color: colors.removed, weight: 650 });
      group.append(
        svgElement("line", {
          x1: left,
          y1: baseline,
          x2: width - right,
          y2: baseline,
          stroke: colors.text,
          "stroke-opacity": 0.4,
          "stroke-width": 1.4,
        })
      );
      const bounds = { left, right: width - right, top, bottom: height - bottom, baseline };
      drawSeries(group, storyGithubRows, (row) => row.additions, bounds, {
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
      const largest = storyGithubRows.reduce((best, row) => (lineChanges(row) > lineChanges(best) ? row : best));
      return `Largest reported line-change week \u00b7 ${fullDate.format(largest.date)} \u00b7 ${signed(largest.additions, true)} added / ${signed(largest.deletions, false)} removed.`;
    };

    const drawBursts = (group, width, height, colors) => {
      const outer = 10;
      const gap = 16;
      const panelWidth = (width - outer * 2 - gap) / 2;
      const panelTop = 32;
      const panelBottom = height - 26;
      const values = storyGithubRows.map(lineChanges);
      const maximum = Math.max(...values, 1);
      const peakIndex = values.indexOf(maximum);

      [
        { label: "READABLE LOG1P", mode: "log", x: outer },
        { label: "LITERAL LINEAR", mode: "linear", x: outer + panelWidth + gap },
      ].forEach((panel) => {
        addText(group, panel.label, panel.x + 10, 20, { color: panel.mode === "log" ? colors.accent : colors.muted, weight: 700 });
        const left = panel.x + 10;
        const right = panel.x + panelWidth - 10;
        const bottom = panelBottom - 18;
        drawSeries(
          group,
          storyGithubRows,
          lineChanges,
          { left, right, top: panelTop + 14, bottom },
          { color: colors.accent, fillOpacity: panel.mode === "log" ? 0.12 : 0.07, maximum, scale: panel.mode }
        );
      });
      const peak = storyGithubRows[peakIndex];
      return `Same reported values in both panels \u00b7 largest burst ${fullDate.format(peak.date)} \u00b7 ${compactNumber.format(maximum)} lines changed.`;
    };

    const drawTokens = (group, width, height, colors) => {
      const left = width < 620 ? 46 : 54;
      const right = 14;
      const split = Math.round(height * 0.58);
      const latest = tokenRows.at(-1);
      const dailyDeltas = tokenRows.map((row, index) => Math.max(0, row.tokenCount - (tokenRows[index - 1]?.tokenCount || 0)));

      addText(group, "SITE REVAMP · CUMULATIVE RETAINED-SESSION ESTIMATE", left, 20, {
        color: colors.accent,
        weight: 700,
      });
      addText(group, latest.tokensLabel, width - right, 20, { anchor: "end", color: colors.text, weight: 700 });
      drawSeries(
        group,
        tokenRows,
        (row) => row.tokenCount,
        { left, right: width - right, top: 44, bottom: split - 20 },
        { color: colors.accent, fillOpacity: 0.1, scale: "linear", strokeWidth: 2 }
      );

      addText(group, "ROUNDED DAILY INCREASE · READABLE LOG1P", left, split + 8, {
        color: colors.muted,
        weight: 700,
      });
      drawSeries(
        group,
        tokenRows,
        (_row, index) => dailyDeltas[index],
        { left, right: width - right, top: split + 30, bottom: height - 28 },
        { color: colors.added, fillOpacity: 0.1, scale: "log" }
      );

      const largestIndex = dailyDeltas.indexOf(Math.max(...dailyDeltas));
      return `Latest rounded estimate · ${latest.tokensLabel} · ${fullDate.format(latest.date)}. Largest rounded daily increase · ${compactNumber.format(dailyDeltas[largestIndex])} · ${fullDate.format(tokenRows[largestIndex].date)}. Tokens trace retained work, not quality.`;
    };

    const drawLifetime = (group, width, height, colors) => {
      const left = width < 620 ? 46 : 54;
      if (!codexSource?.combined_lifetime) {
        addText(group, "LIFETIME CODEX TOTAL UNAVAILABLE", left, 28, { color: colors.accent, weight: 700 });
        addText(group, "No substitute observation is shown.", left, 66, { color: colors.muted });
        return "The direct lifetime Codex snapshot is unavailable. No substitute observation is shown.";
      }
      addText(group, "LIFETIME CODEX SNAPSHOT \u00b7 ROUNDED", left, 24, {
        color: colors.accent,
        weight: 700,
      });
      addText(group, codexSource.combined_lifetime.tokens_label, left, Math.min(112, height * 0.38), {
        color: colors.text,
        weight: 700,
        size: width < 620 ? 34 : 48,
      });
      addText(group, "COMBINED LIFETIME CODEX TOKENS", left, Math.min(142, height * 0.5), {
        color: colors.muted,
        weight: 700,
      });
      addText(group, "Rounded before publication \u00b7 separate from the repo-scoped trace", left, height - 24, {
        color: colors.muted,
      });
      return `${codexSource.combined_lifetime.tokens_label} combined lifetime Codex tokens. This rounded total stays separate from the repo-scoped retained-session estimate.`;
    };

    const drawComplete = (group, width, height, colors) => {
      const left = 42;
      const right = 12;
      const commitTop = 26;
      const commitBottom = Math.max(76, height * 0.2);
      addText(group, "GITHUB \u00b7 COMMITS / WEEK", left, 16, { color: colors.accent, weight: 700 });
      drawSeries(
        group,
        storyGithubRows,
        (row) => row.commits,
        { left, right: width - right, top: commitTop, bottom: commitBottom },
        { color: colors.accent, scale: "log" }
      );

      const lineTop = commitBottom + 30;
      const lineBottom = Math.max(lineTop + 62, height * 0.52);
      const lineBaseline = (lineTop + lineBottom) / 2;
      const lineMaximum = Math.max(...storyGithubRows.flatMap((row) => [row.additions, row.deletions]), 1);
      addText(group, "SAME WEEKS \u00b7 + ADDED / \u2212 REMOVED", left, lineTop - 12, { color: colors.muted, weight: 700 });
      group.append(
        svgElement("line", {
          x1: left,
          y1: lineBaseline,
          x2: width - right,
          y2: lineBaseline,
          stroke: colors.grid,
          "stroke-width": 1.2,
        })
      );
      const lineBounds = { left, right: width - right, top: lineTop, bottom: lineBottom, baseline: lineBaseline };
      drawSeries(group, storyGithubRows, (row) => row.additions, lineBounds, {
        color: colors.added,
        maximum: lineMaximum,
        scale: "log",
        signed: true,
      });
      drawSeries(group, storyGithubRows, (row) => -row.deletions, lineBounds, {
        color: colors.removed,
        dash: "4 2",
        maximum: lineMaximum,
        scale: "log",
        signed: true,
      });

      const tokenTop = lineBottom + 30;
      const tokenBottom = Math.max(tokenTop + 44, height * 0.79);
      const latestToken = tokenRows.at(-1);
      addText(group, width < 620 ? "REPO TOKEN ESTIMATE" : "SEPARATE CLOCK · REPO RETAINED-SESSION TOKENS", left, tokenTop - 10, {
        color: colors.muted,
        weight: 700,
      });
      addText(group, latestToken.tokensLabel, width - right, tokenTop - 10, {
        anchor: "end",
        color: colors.text,
        weight: 700,
      });
      drawSeries(
        group,
        tokenRows,
        (row) => row.tokenCount,
        { left, right: width - right, top: tokenTop, bottom: tokenBottom },
        { color: colors.added, scale: "linear", strokeWidth: 1.8 }
      );

      const codexTop = tokenBottom + 30;
      addText(group, "SEPARATE MEASURE \u00b7 LIFETIME CODEX TOKENS", left, codexTop - 10, { color: colors.accent, weight: 700 });
      if (codexSource?.combined_lifetime) {
        addText(
          group,
          `${codexSource.combined_lifetime.tokens_label} combined \u00b7 rounded \u00b7 not added to the repo trace`,
          left,
          Math.min(height - 8, codexTop + 18),
          { color: colors.text, weight: 700 }
        );
      } else {
        addText(group, "Direct lifetime snapshot unavailable; no substitute observation.", left, Math.min(height - 8, codexTop + 18), {
          color: colors.muted,
        });
      }
      return `Static summary · GitHub cadence is weekly, the repo token estimate is daily and currently ${latestToken.tokensLabel}, and lifetime Codex usage is a separate rounded total.`;
    };

    const metadata = {
      cadence: { label: "CADENCE", scope: "5 YEARS \u00b7 WEEKLY" },
      magnitude: { label: "MAGNITUDE + DIRECTION", scope: "5 YEARS \u00b7 WEEKLY" },
      bursts: { label: "READABLE / LITERAL", scope: "SAME VALUES \u00b7 TWO SCALES" },
      tokens: { label: "TOKEN RHYTHM", scope: "SITE REVAMP \u00b7 DAILY ESTIMATE" },
      lifetime: { label: "CHANGE THE MEASURE", scope: "LIFETIME \u00b7 ROUNDED" },
      explore: { label: "HANDOFF", scope: "GITHUB EXPLORER BELOW" },
      complete: { label: "COMPLETE VIEW", scope: "5 YEARS + DAILY REPO TOKENS + LIFETIME TOTAL" },
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
      else if (targetScene === "lifetime") readout = drawLifetime(group, width, height, colors);
      else readout = drawComplete(group, width, height, colors);

      const copy = metadata[scene] || metadata.complete;
      sceneLabel.textContent = copy.label;
      sceneScope.textContent = copy.scope;
      sceneReadout.textContent = readout;
      stage.dataset.scene = scene;
      renderedScene = scene;
    };

    const finishTransition = (scene) => {
      if (transitionFrame) cancelAnimationFrame(transitionFrame);
      transitionFrame = 0;
      pendingScene = null;
      stage.style.opacity = "1";
      stage.dataset.transitioning = "false";
      if (renderedScene !== scene) renderScene(scene);
    };

    const cancelTransition = ({ settle = true } = {}) => {
      if (transitionFrame) cancelAnimationFrame(transitionFrame);
      transitionFrame = 0;
      const target = pendingScene;
      pendingScene = null;
      stage.style.opacity = "1";
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
      const startedAt = performance.now();
      const duration = 320;
      let swapped = false;
      const tick = (now) => {
        if (!storyVisible) {
          finishTransition(scene);
          return;
        }
        const progress = clamp((now - startedAt) / duration, 0, 1);
        if (progress < 0.42) {
          stage.style.opacity = String(1 - (progress / 0.42) * 0.72);
        } else {
          if (!swapped) {
            renderScene(scene);
            swapped = true;
          }
          stage.style.opacity = String(0.28 + ((progress - 0.42) / 0.58) * 0.72);
        }
        if (progress < 1) transitionFrame = requestAnimationFrame(tick);
        else finishTransition(scene);
      };
      transitionFrame = requestAnimationFrame(tick);
    };

    const nearestStep = () => {
      const viewportCenter = window.innerHeight * 0.5;
      return steps
        .map((step) => {
          const box = step.getBoundingClientRect();
          return { distance: Math.abs((box.top + box.bottom) / 2 - viewportCenter), step };
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
          storyVisible = Boolean(entry?.isIntersecting);
          storyRoot.dataset.storyVisible = String(storyVisible);
          if (!storyVisible) cancelTransition();
        },
        { threshold: 0.01 }
      );
      rootObserver.observe(storyRoot);
    }

    codexSourcePromise.then((source) => {
      codexSource = source;
      if (renderedScene === "lifetime" || renderedScene === "complete" || renderedScene === "explore") renderScene(renderedScene);
    });
    [compactQuery, reducedMotionQuery].forEach((query) => query.addEventListener("change", refreshMode));
    window.addEventListener("resize", () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        refreshMode();
        renderScene(isStaticStory() ? "complete" : activeScene);
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

  const initCodexUsageTrend = async () => {
    const trendRoot = document.querySelector("[data-codex-usage]");
    if (!trendRoot) return null;

    const status = trendRoot.querySelector("[data-codex-status]");
    const lifetime = trendRoot.querySelector("[data-codex-lifetime]");
    const scopeBadge = trendRoot.querySelector("[data-codex-scope]");
    if (!status || !lifetime || !scopeBadge || !trendRoot.dataset.source) return null;

    const exactKeys = (value, keys) =>
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === keys.length &&
      keys.every((key) => Object.hasOwn(value, key));
    const isIsoDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
    const tokensLabel = (tokenCount) => {
      const billions = Math.floor(tokenCount / 1000000000);
      const tenths = Math.floor((tokenCount % 1000000000) / 100000000);
      return `${billions}.${tenths}B`;
    };
    const validSource = (candidate) => {
      const keys = ["schema", "combined_lifetime", "method", "confidence", "observed_on", "updated_at", "automated_refresh"];
      if (!exactKeys(candidate, keys) || candidate.schema !== 3) return false;
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
        combined.source_count !== 2 ||
        !isIsoDate(candidate.observed_on) ||
        typeof candidate.automated_refresh !== "boolean"
      )
        return false;
      if (candidate.automated_refresh) {
        return (
          candidate.method === "rounded_sum_of_verified_account_lifetime_readings" &&
          ["high", "direct", "complete", "direct complete observation"].includes(candidate.confidence) &&
          typeof candidate.updated_at === "string" &&
          !Number.isNaN(Date.parse(candidate.updated_at)) &&
          candidate.updated_at.slice(0, 10) === candidate.observed_on
        );
      }
      return (
        candidate.method === "user_reported_rounded_lifetime_checkpoint" &&
        candidate.confidence === "user reported" &&
        candidate.updated_at === null &&
        candidate.automated_refresh === false
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
      status.textContent = "Lifetime Codex snapshot is unavailable; the last rendered page does not substitute data.";
      return null;
    }

    lifetime.textContent = source.combined_lifetime.tokens_label;
    if (source.automated_refresh) {
      const observed = new Date(source.updated_at);
      status.textContent =
        "Refreshed " +
        observed.toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        }) +
        " UTC.";
    } else {
      const observed = new Date(`${source.observed_on}T00:00:00Z`);
      status.textContent =
        "User-reported checkpoint · " +
        observed.toLocaleDateString("en-US", {
          dateStyle: "medium",
          timeZone: "UTC",
        }) +
        " · automatic refresh pending.";
    }
    trendRoot.dataset.state = "ready";
    scopeBadge.textContent = "LIFETIME · ROUNDED";
    trendRoot.setAttribute("aria-busy", "false");
    return source;
  };

  const codexSourcePromise = initCodexUsageTrend();

  const root = document.querySelector("[data-github-activity]");
  const dataNode = document.getElementById("github-activity-data");
  const tokenDataNode = document.getElementById("build-rhythm-token-data");
  if (!root || !dataNode) return;

  const validActivitySource = (candidate) =>
    candidate?.schema === 2 &&
    typeof candidate.generatedAt === "string" &&
    Array.isArray(candidate.weeks) &&
    candidate.weeks.length > 0 &&
    candidate.weeks.every(
      (row) =>
        isIsoDate(row?.week) &&
        Number.isInteger(row.commits) &&
        row.commits >= 0 &&
        Number.isInteger(row.additions) &&
        row.additions >= 0 &&
        Number.isInteger(row.deletions) &&
        row.deletions >= 0
    );

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
    root.dataset.state = "error";
    return;
  }
  if (!validActivitySource(source)) {
    root.dataset.state = "error";
    return;
  }

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

  const remoteSource = root.dataset.source;
  const isLocalPreview = /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  if (remoteSource && !isLocalPreview) {
    try {
      const response = await fetch(remoteSource, { cache: "no-store", credentials: "same-origin" });
      const remote = response.ok ? await response.json() : null;
      if (validActivitySource(remote)) source = remote;
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
    additions: row.additions,
    deletions: row.deletions,
  }));
  const tokenRows = tokenSource
    ? tokenSource.points.map((point, index) => ({
        index,
        date: new Date(`${point.date}T00:00:00Z`),
        tokenCount: point.token_count,
        tokensLabel: point.tokens_label,
      }))
    : [];
  const chart = document.getElementById("github-activity-chart");
  const chartTitle = document.getElementById("github-activity-chart-title");
  const selectedDate = document.getElementById("github-activity-selected-date");
  const selectedCommits = document.getElementById("github-activity-selected-commits");
  const selectedAdditions = document.getElementById("github-activity-selected-additions");
  const selectedDeletions = document.getElementById("github-activity-selected-deletions");
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
      added: style.getPropertyValue("--global-sky-strong").trim() || "#2c7290",
      removed: style.getPropertyValue("--global-mint-strong").trim() || "#2f7562",
      addedText: style.getPropertyValue("--github-activity-added-text").trim() || "#28657d",
      removedText: style.getPropertyValue("--github-activity-removed-text").trim() || "#286b58",
      accent: style.getPropertyValue("--global-primary-color").trim() || "#bf470f",
      text: style.getPropertyValue("--global-text-color").trim() || "#252321",
      muted: style.getPropertyValue("--global-text-color-light").trim() || "#625f5a",
      grid: style.getPropertyValue("--global-divider-color").trim() || "rgba(69,86,82,.17)",
      surface: style.getPropertyValue("--global-surface-container-low-color").trim() || "#fbfcf8",
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
    selectedAdditions.textContent = `${signed(row.additions, true)} added`;
    selectedDeletions.textContent = `${signed(row.deletions, false)} removed`;
  };
  const updateTable = (data) => {
    const fragment = document.createDocumentFragment();
    [...data].reverse().forEach((row) => {
      const tr = document.createElement("tr");
      [row.week, number.format(row.commits), signed(row.additions, true), signed(row.deletions, false), number.format(lineChanges(row))].forEach(
        (value, index) => {
          const cell = document.createElement(index === 0 ? "th" : "td");
          if (index === 0) cell.scope = "row";
          cell.textContent = value;
          tr.append(cell);
        }
      );
      fragment.append(tr);
    });
    tableBody.replaceChildren(fragment);
    tableCaption.textContent = selection ? "Reported weekly activity in the selected range" : "Reported weekly activity in the selected time window";
  };
  const updateAggregate = (data, announce = false, refreshTable = true) => {
    const scoped = analysisRows(data);
    const active = scoped.filter((row) => row.commits > 0 || row.additions > 0 || row.deletions > 0);
    const totalCommits = scoped.reduce((sum, row) => sum + row.commits, 0);
    const totalAdditions = scoped.reduce((sum, row) => sum + row.additions, 0);
    const totalDeletions = scoped.reduce((sum, row) => sum + row.deletions, 0);
    const scope = selection
      ? `Selected ${number.format(scoped.length)} ${scoped.length === 1 ? "week" : "weeks"}`
      : range === "all"
        ? "All history"
        : `${range} ${range === "1" ? "year" : "years"}`;
    const dates = `${dateLabel.format(scoped[0].date)} \u2014 ${dateLabel.format(scoped.at(-1).date)}`;
    rangeSummary.textContent = `${scope} \u00b7 ${dates} \u00b7 ${number.format(active.length)} active weeks \u00b7 ${number.format(totalCommits)} commits \u00b7 +${compactNumber.format(totalAdditions)} / \u2212${compactNumber.format(totalDeletions)} lines`;
    clearSelectionButton.hidden = !selection;

    if (active.length) {
      const busiest = active.reduce((best, row) => (row.commits > best.commits ? row : best));
      const largest = active.reduce((best, row) => (lineChanges(row) > lineChanges(best) ? row : best));
      const medianMagnitude = percentile(active.map(lineChanges), 0.5);
      annotation.textContent = `Largest line-change week \u00b7 ${dateLabel.format(largest.date)} \u00b7 ${signed(largest.additions, true)} / ${signed(largest.deletions, false)}. Highest commit week \u00b7 ${dateLabel.format(busiest.date)} \u00b7 ${number.format(busiest.commits)} commits. Median active-week line magnitude \u00b7 ${compactNumber.format(medianMagnitude)}.`;
    } else {
      annotation.textContent = "No active weeks in this scope. Median active-week line magnitude \u00b7 \u2014.";
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
    const left = narrow ? 66 : 82;
    const right = narrow ? 12 : 22;
    const bottom = narrow ? 46 : 52;
    const commitTop = 42;
    const commitHeight = Math.max(92, Math.min(118, height * 0.19));
    const commitBottom = commitTop + commitHeight;
    const lineTop = commitBottom + (narrow ? 58 : 64);
    const lineBottom = height - bottom;
    const plotTop = commitTop;
    const baseline = (lineTop + lineBottom) / 2;
    const lineHalf = Math.max(20, (lineBottom - lineTop) / 2 - 12);
    const start = data[0].date.getTime();
    const end = data.at(-1).date.getTime();
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
      grid.append(svgElement("line", { x1: xx, y1: plotTop, x2: xx, y2: lineBottom, stroke: palette.grid, "stroke-width": 1 }));
      addText(grid, String(year), xx, height - 15, { anchor: "middle", color: palette.muted });
    });
    if (yearTicks.size < 2) {
      addText(grid, data[0].week, left, height - 15, { color: palette.muted });
      addText(grid, data.at(-1).week, width - right, height - 15, { anchor: "end", color: palette.muted });
    }
    chart.append(grid);
    addText(chart, `COMMITS / WEEK \u00b7 ${scale === "linear" ? "LITERAL LINEAR" : "READABLE LOG1P"}`, left, 20, {
      color: palette.accent,
      weight: 700,
    });
    const lineScaleLabel = scale === "linear" ? "LINEAR" : "SYMLOG";
    const lineHeading = narrow
      ? `LINES / WEEK \u00b7 ${lineScaleLabel}`
      : `LINES CHANGED / WEEK \u00b7 ${scale === "linear" ? "LITERAL LINEAR" : "READABLE SYMLOG"}`;
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
      y2: lineBottom,
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
    const overlay = svgElement("rect", {
      class: "github-activity-inspector",
      x: left,
      y: plotTop,
      width: width - left - right,
      height: lineBottom - plotTop,
      fill: "transparent",
      tabindex: 0,
      focusable: "true",
      role: "slider",
      "aria-label": "Weekly commit and line-change inspector",
      "aria-valuemin": 0,
      "aria-valuemax": data.length - 1,
      "aria-describedby": "github-activity-chart-instructions",
    });
    chart.append(guide, commitMarker, addMarker, removeMarker, overlay);

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
      overlay.setAttribute("aria-valuenow", String(selectedIndex - data[0].index));
      overlay.setAttribute(
        "aria-valuetext",
        `Week of ${row.week}, ${number.format(row.commits)} commits, ${signed(row.additions, true)} added, ${signed(row.deletions, false)} removed`
      );
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
  chartTitle.textContent = "Weekly GitHub commits, additions, and deletions";
  setPressedState();
  drawChart();
  initBuildRhythmStory({ githubRows: rows, tokenRows, codexSourcePromise });
  root.dataset.state = "ready";
})();
