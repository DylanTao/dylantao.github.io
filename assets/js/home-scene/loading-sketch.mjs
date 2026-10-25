// The loading sketch's page side: one canvas over the empty scene, drawn by a worker when the
// browser can hand it an OffscreenCanvas (so model parsing never stalls the pen, and the drawings
// are fetched and decoded off the main thread) and on the main thread otherwise. The controller
// reports each loading stage and, where it can, the per-segment progress the loading bar shows;
// the pen draws only what that finished work allows. The drawings come from loading-sketch.json,
// which bin/build_loading_sketch.cjs traces from the scene's own views.
import { createSketchEngine, decodeDrawing } from "./loading-sketch-core.mjs";

const SKETCHES = new URL("../../models/home/loading-sketch.json", import.meta.url);
const STAGES = new Set(["home", "coast", "room", "lighting", "first-frame", "ready"]);
// The render arrives beneath the drawing, then the drawing goes; never more than 1.4 s in all.
const REVEAL_DELAY = 240,
  FADE_DELAY = 820,
  FADE = 560;

function bytesOf(text) {
  const binary = atob(text),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Where the sun stands in the opening mark: the share of today's daylight already gone, or null
// at night for a crescent moon.
function daylightNow(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour").value) + Number(parts.find((p) => p.type === "minute").value) / 60;
    return hour >= 6.5 && hour < 18.75 ? (hour - 6.5) / 12.25 : null;
  } catch {
    return 0.55;
  }
}

export function createLoadingSketch(container, { reduced = false, timeZone = "America/Los_Angeles" } = {}) {
  const style = getComputedStyle(container);
  // Ink follows the page theme; the pen's nib and the resting wash are warm amber (paler on dark themes).
  const colors = () => {
    const ink = style.getPropertyValue("--home-ink").trim() || style.color,
      [r = 0, g = 0, b = 0] = (style.color.match(/\d+(\.\d+)?/g) || []).map(Number),
      darkTheme = 0.2126 * r + 0.7152 * g + 0.0722 * b > 140;
    return { ink, accent: darkTheme ? "#f2b45f" : "#d2812c" };
  };
  const measure = () => {
    const rect = container.getBoundingClientRect();
    return { width: Math.max(1, rect.width), height: Math.max(1, rect.height), dpr: Math.min(2, devicePixelRatio || 1) };
  };
  const options = { ...measure(), ...colors(), reduced, daylight: daylightNow(timeZone) };
  // What the page has said so far, replayed into a fallback engine if the worker cannot draw.
  const said = { stages: [], fills: {}, finished: false };
  let canvas = null,
    worker = null,
    engine = null,
    data = null,
    frame = 0,
    reported = -Infinity,
    disposed = false,
    ended = false,
    cover = null,
    roomCalls = 0;

  function makeCanvas() {
    const next = document.createElement("canvas");
    next.className = "home-world-sketch";
    next.setAttribute("aria-hidden", "true");
    next.dataset.sketchVersion = "2";
    if (canvas) canvas.replaceWith(next);
    else container.append(next);
    canvas = next;
    return next;
  }

  // The pen's own account, for tests and evidence: the drawing, the share finished work allows
  // and the share drawn.
  function report(state) {
    if (!canvas || !state) return;
    canvas.dataset.sketchDrawing = state.drawing || "";
    canvas.dataset.sketchAllowed = String(state.allowed);
    canvas.dataset.sketchDrawn = String(state.drawn);
    canvas.dataset.sketchStrokes = String(state.strokes);
    canvas.dataset.sketchResting = String(Boolean(state.resting));
  }

  function addView(id) {
    if (!engine || !data || !id || engine.has(id) || !data.views?.[id]) return;
    engine.add(id, decodeDrawing(bytesOf(data.views[id].strokes), data.grid, data.range), data.plan?.[id === "outside" ? "outside" : "room"]);
  }

  function wake() {
    if (frame || disposed || !engine) return;
    frame = requestAnimationFrame(function run(time) {
      frame = 0;
      if (disposed || !engine) return;
      const more = engine.tick(time);
      if (time - reported > 250) {
        reported = time;
        report(engine.state());
      }
      if (more) frame = requestAnimationFrame(run);
    });
  }

  // Drawing here: also the fallback when a worker cannot run the module or draw (a transferred
  // canvas is lost to the page, so the fallback starts on a fresh one and replays what was said).
  function drawHere() {
    if (disposed || engine) return true;
    worker?.terminate();
    worker = null;
    const target = makeCanvas(),
      context = target.getContext("2d");
    if (!context) return false;
    target.width = Math.round(options.width * options.dpr);
    target.height = Math.round(options.height * options.dpr);
    engine = createSketchEngine(context, options);
    engine.progress(said.fills);
    for (const [stage, room] of said.stages) engine.stage(stage, room);
    if (said.finished) engine.finish();
    fetch(SKETCHES)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (!json || disposed || !engine) return;
        data = json;
        engine.focus(json.focus);
        addView("outside");
        for (const [, room] of said.stages) addView(room);
        wake();
      })
      .catch(() => {});
    wake();
    return true;
  }

  function send(message) {
    if (worker) return worker.postMessage(message);
    if (!engine) return;
    if (message.type === "stage") {
      addView(message.room);
      engine.stage(message.stage, message.room);
    } else if (message.type === "progress") engine.progress(message.fills);
    else if (message.type === "finish") engine.finish();
    else if (message.type === "colors") engine.colors(message.ink, message.accent);
    else if (message.type === "resize") {
      canvas.width = Math.round(message.width * message.dpr);
      canvas.height = Math.round(message.height * message.dpr);
      engine.resize(message.width, message.height, message.dpr);
    }
    wake();
  }

  const first = makeCanvas();
  if ("transferControlToOffscreen" in first && typeof Worker === "function") {
    try {
      let module = false;
      worker = new Worker(new URL("./loading-sketch-worker.mjs", import.meta.url), {
        get type() {
          module = true;
          return "module";
        },
      });
      if (!module) throw new Error("module workers unavailable");
      const offscreen = first.transferControlToOffscreen();
      worker.onmessage = ({ data: message }) => {
        if (message.type === "state" || message.type === "settled") report(message.state);
        else if (message.type === "unsupported") drawHere();
      };
      worker.onerror = () => drawHere();
      worker.postMessage({ type: "init", canvas: offscreen, options, url: SKETCHES.href }, [offscreen]);
    } catch {
      worker?.terminate();
      worker = null;
    }
  }
  if (!worker && !drawHere()) {
    canvas.remove();
    return null;
  }

  const resizeObserver = new ResizeObserver(() => {
    const next = measure();
    if (Math.abs(next.width - options.width) < 1 && Math.abs(next.height - options.height) < 1) return;
    Object.assign(options, next);
    send({ type: "resize", ...next });
  });
  resizeObserver.observe(container);
  const themeChanged = () => send({ type: "colors", ...colors() });
  window.addEventListener("siteThemeChange", themeChanged);

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    window.removeEventListener("siteThemeChange", themeChanged);
    worker?.postMessage({ type: "dispose" });
    worker = null;
    engine = null;
    canvas.remove();
    if (cover) cover.style.opacity = "";
  }

  return {
    // A loading stage ("home", "coast", "room", "lighting", "first-frame", "ready") with the room
    // the visitor will arrive in once it is known. The earlier drawing ids are still understood:
    // "outside" when the coast begins, "overview" when the rooms do, then the occupied room.
    stage(name, room = null) {
      let stage = name;
      if (!STAGES.has(name)) {
        if (name === "outside") stage = "coast";
        else if (name === "overview") stage = "room";
        else {
          room = name;
          stage = roomCalls++ ? "first-frame" : "lighting";
        }
      }
      said.stages.push([stage, room]);
      send({ type: "stage", stage, room });
    },
    // The loading bar's per-segment fills (house, coast, room, sirui, view), each 0 to 1.
    progress(fills) {
      for (const [key, value] of Object.entries(fills || {})) if (Number.isFinite(value)) said.fills[key] = Math.max(said.fills[key] || 0, value);
      send({ type: "progress", fills: { ...said.fills } });
    },
    // The render stays transparent under the sketch until the hand-off.
    cover(element) {
      cover = element;
      element.style.opacity = "0";
    },
    // The first frame is drawn: the pen completes the drawing while the render arrives beneath
    // it on the site's gentle spring (_sass/_springs.scss), then the drawing fades. The timing is
    // CSS transitions, so a paused page clock cannot hold the scene behind the drawing.
    finish() {
      if (disposed || ended) return;
      if (reduced) {
        dispose();
        return;
      }
      ended = true;
      said.finished = true;
      send({ type: "finish" });
      if (cover) {
        cover.style.transition = `opacity var(--spring-gentle-duration, 760ms) var(--spring-gentle, ease) ${REVEAL_DELAY}ms`;
        cover.style.opacity = "1";
      }
      canvas.style.transition = `opacity ${FADE}ms var(--md-lite-easing-standard, ease) ${FADE_DELAY}ms`;
      canvas.style.opacity = "0";
      canvas.addEventListener("transitionend", dispose, { once: true });
      setTimeout(dispose, FADE_DELAY + FADE + 400);
    },
    dispose,
  };
}
