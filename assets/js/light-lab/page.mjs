// The light lab (/projects/light-paths/): path tracing and Metropolis light transport race to draw
// sunlight falling through the onsen's light well onto rippled water. Each method runs in its own
// worker for the same wall-clock time (core.mjs, worker.mjs). Before a run the panels show still
// frames from the same engine; a run never starts by itself, pauses after each minute, and pauses
// while the lab is scrolled away or the tab is hidden.
const METHODS = ["pt", "mlt"];
const MINUTE = 60;
const PATH_EVERY_MS = 400;
const ANNOUNCE_EVERY = 20;
// One run recorded in headless Chromium 145 on the laptop that built this page (Core Ultra 7 155H,
// seed 1, 0.8° sun, both workers at once), drawn dashed so visitors can compare their own machine.
const RECORDED = {
  pt: [
    [5, 30.97],
    [10, 25.43],
    [20, 16.09],
    [40, 11.88],
    [60, 9.84],
  ],
  mlt: [
    [5, 2.88],
    [10, 2.94],
    [20, 3.0],
    [40, 2.37],
    [60, 1.8],
  ],
};
const root = document.querySelector("[data-light-lab]");
if (root) init(root);

function init(root) {
  const canvas = Object.fromEntries(METHODS.map((m) => [m, root.querySelector(`[data-light-lab-canvas="${m}"]`)]));
  const readout = Object.fromEntries(METHODS.map((m) => [m, root.querySelector(`[data-light-lab-stats="${m}"]`)]));
  const controls = root.querySelector("[data-light-lab-controls]");
  const runButton = root.querySelector("[data-light-lab-run]");
  const restartButton = root.querySelector("[data-light-lab-restart]");
  const sunSelect = root.querySelector("[data-light-lab-sun]");
  const normalizationSelect = root.querySelector("[data-light-lab-normalization]");
  const pathToggle = root.querySelector("[data-light-lab-path]");
  const pathLayer = root.querySelector("[data-light-lab-path-layer]");
  const chart = root.querySelector("[data-light-lab-chart]");
  const status = root.querySelector("[data-light-lab-status]");
  let workers = null,
    run = 0,
    state = "idle", // idle | running | paused | done
    autoPaused = false,
    budget = MINUTE,
    history = { pt: [], mlt: [] },
    latest = {},
    pathTimer = 0,
    announced = 0,
    reference = null;

  if (typeof Worker === "undefined") return;
  const referenceReady = fetch(new URL("./onsen-reference.json", import.meta.url))
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
    .then((json) => (reference = json));
  const referenceFor = () =>
    reference && Math.abs(reference.sunRadiusDegrees - Number(sunSelect.value)) < 1e-9
      ? { width: reference.width, height: reference.height, luminance: reference.luminance }
      : null;

  async function start() {
    stop();
    const thisRun = ++run;
    await referenceReady;
    if (thisRun !== run) return;
    history = { pt: [], mlt: [] };
    latest = {};
    announced = 0;
    budget = MINUTE;
    try {
      workers = {};
      for (const method of METHODS) {
        const worker = new Worker(new URL("./worker.mjs", import.meta.url), { type: "module" });
        worker.onmessage = (event) => receive(method, event.data);
        worker.onerror = fail;
        worker.postMessage({
          type: "start",
          method,
          width: canvas[method].width,
          height: canvas[method].height,
          seed: 1,
          sunRadiusDegrees: Number(sunSelect.value),
          normalization: method === "mlt" ? normalizationSelect.value : undefined,
          reference: referenceFor(),
        });
        workers[method] = worker;
      }
    } catch {
      return fail();
    }
    for (const method of METHODS) {
      canvas[method].getContext("2d").clearRect(0, 0, canvas[method].width, canvas[method].height);
      readout[method].textContent = "Starting…";
    }
    root.classList.add("is-live");
    setState("running");
    status.textContent = "Racing. Each renderer gets the same minute on its own thread.";
    drawChart();
    schedulePath();
  }

  function stop() {
    run++;
    if (workers) for (const worker of Object.values(workers)) worker.terminate();
    workers = null;
    clearTimeout(pathTimer);
    pathLayer.replaceChildren();
  }

  // Older browsers without module workers keep the still frames.
  function fail() {
    stop();
    root.classList.remove("is-live");
    setState("idle");
    status.textContent = "This browser cannot run the race, so the panels keep the still frames from the same renderer.";
  }

  function setState(next) {
    state = next;
    root.dataset.lightLabState = state;
    runButton.textContent = { idle: "Run the race", running: "Pause", paused: "Continue", done: "Run another minute" }[state];
    runButton.setAttribute("aria-pressed", String(state === "running"));
    restartButton.disabled = state === "idle";
  }

  function setPaused(paused, automatic = false) {
    if (!workers) return;
    if (paused && state === "running") {
      for (const worker of Object.values(workers)) worker.postMessage({ type: "pause" });
      autoPaused = automatic;
      setState("paused");
      clearTimeout(pathTimer);
    } else if (!paused && (state === "paused" || state === "done")) {
      for (const worker of Object.values(workers)) worker.postMessage({ type: "resume" });
      autoPaused = false;
      setState("running");
      schedulePath();
    }
  }

  function receive(method, message) {
    if (message.type === "path") return drawPath(message.path);
    if (message.type !== "frame") return;
    canvas[method].getContext("2d").putImageData(new ImageData(message.rgba, message.width, message.height), 0, 0);
    latest[method] = message.stats;
    if (message.stats.relativeRmse != null) history[method].push([message.stats.seconds, message.stats.relativeRmse]);
    readout[method].textContent = describe(method, message.stats);
    drawChart();
    if (state !== "running") return;
    const seconds = Math.min(...METHODS.map((m) => latest[m]?.seconds ?? 0));
    if (seconds >= budget) {
      setPaused(true);
      setState("done");
      announce(seconds, `Paused after ${budget === MINUTE ? "a minute" : `${budget / MINUTE} minutes`}`);
    } else if (seconds - announced >= ANNOUNCE_EVERY) announce(seconds, `After ${Math.round(seconds)} seconds`);
  }

  function describe(method, stats) {
    const error = stats.relativeRmse == null ? "" : ` · error ${percent(stats.relativeRmse)}`;
    if (method === "pt") return `${formatCount(stats.samples)} paths · ${Math.round(stats.samplesPerPixel)} per pixel${error}`;
    return `${formatCount(stats.samples)} mutations · ${Math.round((stats.acceptance ?? 0) * 100)}% accepted${error}`;
  }

  function announce(seconds, lead) {
    announced = seconds;
    const [pt, mlt] = METHODS.map((m) => latest[m]?.relativeRmse);
    status.textContent =
      pt != null && mlt != null
        ? `${lead}: path tracing is off by ${percent(pt)}, Metropolis by ${percent(mlt)}.`
        : `${lead}. The error is measured against the reference only for the 0.8° sun.`;
  }

  // Relative error over time on a log scale from 10% to 10,000%. The coordinate system follows the
  // chart's own size, so its labels keep their type size at every width.
  function drawChart() {
    const width = Math.round(chart.clientWidth) || 600,
      height = Math.round(chart.clientHeight) || 220,
      left = 64,
      right = 24,
      top = 12,
      bottom = 30;
    const span = Math.max(MINUTE, budget);
    const x = (s) => left + ((width - left - right) * Math.min(s, span)) / span;
    const y = (e) => top + ((height - top - bottom) * (2 - Math.log10(Math.min(100, Math.max(0.1, e))))) / 3;
    const svg = ['<g class="light-lab-axis">'];
    for (const e of [0.1, 1, 10, 100])
      svg.push(
        `<line x1="${left}" x2="${width - right}" y1="${y(e)}" y2="${y(e)}"/><text x="${left - 8}" y="${y(e) + 4}" text-anchor="end">${(e * 100).toLocaleString("en-US")}%</text>`
      );
    for (let i = 0; i <= 4; i++) svg.push(`<text x="${x((span * i) / 4)}" y="${height - 8}" text-anchor="middle">${(span * i) / 4} s</text>`);
    svg.push("</g>");
    if (state !== "idle" && !referenceFor())
      svg.push(
        `<text class="light-lab-chart-note" x="${left + 14}" y="${top + 26}">The reference exists for the 0.8° sun only, so this run has no error curve.</text>`
      );
    const recorded = Number(sunSelect.value) === 0.8 && normalizationSelect.value !== "ratio";
    for (const method of METHODS)
      if (recorded)
        svg.push(
          `<polyline class="light-lab-line light-lab-line--${method} light-lab-line--recorded" points="${RECORDED[method].map(([s, e]) => `${x(s).toFixed(1)},${y(e).toFixed(1)}`).join(" ")}"/>`
        );
    for (const method of METHODS)
      if (history[method].length > 1)
        svg.push(
          `<polyline class="light-lab-line light-lab-line--${method}" points="${history[method].map(([s, e]) => `${x(s).toFixed(1)},${y(e).toFixed(1)}`).join(" ")}"/>`
        );
    chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
    chart.innerHTML = svg.join("");
  }

  // One Metropolis chain's current light path, drawn over its panel a few times a second.
  function schedulePath() {
    clearTimeout(pathTimer);
    if (!pathToggle.checked || state !== "running" || !workers) {
      if (!pathToggle.checked) pathLayer.replaceChildren();
      return;
    }
    workers.mlt.postMessage({ type: "path" });
    pathTimer = setTimeout(schedulePath, PATH_EVERY_MS);
  }
  function drawPath(path) {
    if (!path || !pathToggle.checked) return pathLayer.replaceChildren();
    const points = [path.pixel, ...path.points.filter(Boolean)].map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`);
    pathLayer.innerHTML = `<polyline points="${points.join(" ")}"/><circle cx="${path.pixel[0].toFixed(1)}" cy="${path.pixel[1].toFixed(1)}" r="2.4"/>`;
  }

  runButton.addEventListener("click", () => {
    if (state === "idle") start();
    else if (state === "running") setPaused(true);
    else if (state === "paused") setPaused(false);
    else if (state === "done") {
      budget += MINUTE;
      setPaused(false);
    }
  });
  restartButton.addEventListener("click", start);
  for (const control of [sunSelect, normalizationSelect]) control.addEventListener("change", () => state !== "idle" && start());
  pathToggle.addEventListener("change", schedulePath);

  // A run spends a visitor's processor time only while they can see it.
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting && state === "running") setPaused(true, true);
    else if (entry.isIntersecting && autoPaused && !document.hidden) setPaused(false);
  }).observe(root);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") setPaused(true, true);
    else if (!document.hidden && autoPaused) setPaused(false);
  });
  window.addEventListener("pagehide", stop);
  // Coming back from the back-forward cache, the stopped run shows its still frames again.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || state === "idle") return;
    root.classList.remove("is-live");
    setState("idle");
    drawChart();
  });
  controls.hidden = false;
  new ResizeObserver(() => drawChart()).observe(chart);
  setState("idle");
  drawChart();
}

function percent(fraction) {
  return `${Math.round(fraction * 100).toLocaleString("en-US")}%`;
}

function formatCount(n) {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
}
