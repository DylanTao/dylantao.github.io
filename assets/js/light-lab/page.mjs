// The light lab (/projects/light-paths/): path tracing and Metropolis light transport race to draw
// sunlight falling through the onsen's light well onto rippled water. Each method runs in its own
// worker for the same wall-clock time (core.mjs, worker.mjs). Before a run the panels show still
// frames from the same engine. The race starts by itself once the panels come into view (Sirui,
// 2026-10-19: just play it), pauses after each minute, and pauses while the lab is scrolled away or
// the tab is hidden; the Run button is its pause control. Reduced motion, Save-Data, a processor
// with fewer than four threads and automation (unless ?cinematic=live) keep the still frames until
// the visitor presses Run. A second row magnifies the pool floor, where the ripples focus the sun,
// and the chart (chart.mjs) plots each renderer's error on log axes.
import { MINUTE, blankFrameError, chartMarkup, percent, takeaway } from "./chart.mjs";

const METHODS = ["pt", "mlt"];
const PATH_EVERY_MS = 400;
const ANNOUNCE_EVERY = 20;
// One run recorded in headless Chromium 145 on the laptop that built this page (Core Ultra 7 155H,
// seed 1, 0.8° sun, both workers at once), drawn thin so visitors can compare their own machine.
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
  const zoom = Object.fromEntries(METHODS.map((m) => [m, root.querySelector(`[data-light-lab-zoom="${m}"]`)]));
  const readout = Object.fromEntries(METHODS.map((m) => [m, root.querySelector(`[data-light-lab-stats="${m}"]`)]));
  const controls = root.querySelector("[data-light-lab-controls]");
  const runButton = root.querySelector("[data-light-lab-run]");
  const restartButton = root.querySelector("[data-light-lab-restart]");
  const sunSelect = root.querySelector("[data-light-lab-sun]");
  const normalizationSelect = root.querySelector("[data-light-lab-normalization]");
  const pathToggle = root.querySelector("[data-light-lab-path]");
  const pathLayer = root.querySelector("[data-light-lab-path-layer]");
  const chart = root.querySelector("[data-light-lab-chart]");
  const summary = root.querySelector("[data-light-lab-takeaway]");
  const status = root.querySelector("[data-light-lab-status]");
  let workers = null,
    run = 0,
    state = "idle", // idle | running | paused | done
    autoPaused = false,
    touched = false,
    budget = MINUTE,
    history = { pt: [], mlt: [] },
    latest = {},
    pathTimer = 0,
    announced = 0,
    reference = null,
    blank = null;

  if (typeof Worker === "undefined") return;
  const referenceReady = fetch(new URL("./onsen-reference.json", import.meta.url))
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
    .then((json) => {
      reference = json;
      blank = json ? blankFrameError(json) : null;
      drawChart();
      summarize();
    });
  const referenceFor = () =>
    reference && Math.abs(reference.sunRadiusDegrees - Number(sunSelect.value)) < 1e-9
      ? { width: reference.width, height: reference.height, luminance: reference.luminance }
      : null;
  // The recording used the default settings, so it is only a fair comparison under them.
  const recordedApplies = () => Number(sunSelect.value) === 0.8 && normalizationSelect.value !== "ratio";

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
      zoom[method]?.getContext("2d").clearRect(0, 0, zoom[method].width, zoom[method].height);
      readout[method].textContent = "Starting…";
    }
    root.classList.add("is-live");
    setState("running");
    status.textContent = "Racing. Each renderer gets the same minute on its own thread.";
    summary.textContent = "";
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
    if (message.pool && zoom[method])
      zoom[method].getContext("2d").putImageData(new ImageData(message.pool.rgba, message.pool.width, message.pool.height), 0, 0);
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

  // The live comparison at a moment both renderers have reported, or null without an error measure.
  function liveRun(seconds) {
    const [pt, mlt] = METHODS.map((m) => latest[m]?.relativeRmse);
    return pt != null && mlt != null ? { time: seconds, pt, mlt } : null;
  }

  // The sentence under the chart: the live run once it has a checkpoint, the recording before.
  function summarize(seconds) {
    if (state === "idle") {
      const pt = RECORDED.pt[RECORDED.pt.length - 1];
      const mlt = RECORDED.mlt[RECORDED.mlt.length - 1];
      summary.textContent = recordedApplies() ? takeaway({ time: pt[0], pt: pt[1], mlt: mlt[1] }, { recorded: true }) : "";
      return "";
    }
    const sentence = seconds == null ? "" : takeaway(liveRun(seconds));
    summary.textContent = sentence;
    return sentence;
  }

  function announce(seconds, lead) {
    announced = seconds;
    const now = liveRun(seconds);
    const projection = summarize(seconds);
    status.textContent = now
      ? `${lead}: path tracing is off by ${percent(now.pt)}, Metropolis by ${percent(now.mlt)}.${projection ? ` ${projection}` : ""}`
      : `${lead}. The error is measured against the reference only for the 0.8° sun.`;
  }

  // Log-log error over time. The coordinate system follows the chart's own size, so its labels keep
  // their type size at every width.
  function drawChart() {
    const width = Math.round(chart.clientWidth) || 600,
      height = Math.round(chart.clientHeight) || 240;
    const { markup, viewBox } = chartMarkup({
      width,
      height,
      span: Math.max(MINUTE, budget),
      live: state === "idle" ? {} : history,
      recorded: recordedApplies() ? RECORDED : null,
      blank: referenceFor() ? blank : null,
      note: state !== "idle" && !referenceFor() ? "The reference exists for the 0.8° sun only, so this run has no error curve." : "",
    });
    chart.setAttribute("viewBox", viewBox);
    chart.innerHTML = markup;
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
    touched = true;
    if (state === "idle") start();
    else if (state === "running") setPaused(true);
    else if (state === "paused") setPaused(false);
    else if (state === "done") {
      budget += MINUTE;
      setPaused(false);
    }
  });
  restartButton.addEventListener("click", () => {
    touched = true;
    start();
  });
  for (const control of [sunSelect, normalizationSelect])
    control.addEventListener("change", () => {
      if (state !== "idle") start();
      else {
        drawChart();
        summarize();
      }
    });
  pathToggle.addEventListener("change", schedulePath);

  // A run spends a visitor's processor time only while they can see it.
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting && state === "running") setPaused(true, true);
    else if (entry.isIntersecting && autoPaused && !document.hidden) setPaused(false);
  }).observe(root);

  // The race starts by itself the first time the panels are mostly in view, unless the visitor has
  // already pressed a control or the device should stay still.
  const forceLive = /[?&]cinematic=live(?:&|$)/.test(location.search);
  const autoplay =
    !matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !navigator.connection?.saveData &&
    (navigator.hardwareConcurrency || 4) >= 4 &&
    (!navigator.webdriver || forceLive);
  const panels = root.querySelector(".light-lab-panels");
  if (autoplay && panels) {
    const starter = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || touched || state !== "idle" || document.hidden) return;
        starter.disconnect();
        start();
      },
      { threshold: 0.5 }
    );
    starter.observe(panels);
  }
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
    summarize();
  });
  controls.hidden = false;
  new ResizeObserver(() => drawChart()).observe(chart);
  setState("idle");
  drawChart();
  summarize();
}

function formatCount(n) {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
}
