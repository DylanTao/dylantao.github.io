// The loading sketch's page side: one canvas over the empty scene, drawn by a worker when the
// browser can hand it an OffscreenCanvas (so model parsing never stalls the strokes) and on the
// main thread otherwise. The controller names each stage as its work finishes; the drawings come
// from loading-sketch.json, which bin/build_loading_sketch.cjs traces from the authored views.
import { createSketchEngine, decodeSketch, frameStrokes } from "./loading-sketch-core.mjs";

const SKETCHES = new URL("../../models/home/loading-sketch.json", import.meta.url);

// Where the sun stands in the opening sea: the share of today's daylight already gone, or null
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

function decodeBase64(text) {
  const binary = atob(text),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function createLoadingSketch(container, { reduced = false, timeZone = "America/Los_Angeles" } = {}) {
  const style = getComputedStyle(container),
    daylight = daylightNow(timeZone);
  // Ink follows the page theme; the sun is amber (paler on dark themes) and the moon is ink.
  const colors = () => {
    const ink = style.getPropertyValue("--home-ink").trim() || style.color,
      [r = 0, g = 0, b = 0] = (style.color.match(/\d+(\.\d+)?/g) || []).map(Number),
      darkTheme = 0.2126 * r + 0.7152 * g + 0.0722 * b > 140;
    return { ink, accent: daylight === null ? ink : darkTheme ? "#f2b45f" : "#d2812c" };
  };
  const measure = () => {
    const rect = container.getBoundingClientRect();
    return { width: Math.max(1, rect.width), height: Math.max(1, rect.height), dpr: Math.min(2, devicePixelRatio || 1) };
  };
  const options = { ...measure(), ...colors(), reduced, daylight };
  const views = new Map(),
    shown = [];
  let canvas = null,
    worker = null,
    engine = null,
    frame = 0,
    disposed = false,
    cover = null,
    settle = null,
    requested = null;

  function makeCanvas() {
    const next = document.createElement("canvas");
    next.className = "home-world-sketch";
    next.setAttribute("aria-hidden", "true");
    if (canvas) canvas.replaceWith(next);
    else container.append(next);
    canvas = next;
    return next;
  }

  function wake() {
    if (frame || disposed || !engine) return;
    frame = requestAnimationFrame(function run(time) {
      frame = 0;
      if (disposed || !engine) return;
      const more = engine.tick(time);
      if (engine.settled) settle?.();
      if (more) frame = requestAnimationFrame(run);
    });
  }

  // Drawing here: also the fallback when a worker cannot run the module or draw (a transferred
  // canvas is lost to the page, so the fallback starts on a fresh one and replays the drawings).
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
    for (const [kind, targets] of shown) engine.morph(kind, targets);
    wake();
    return true;
  }

  function send(message, transfer = []) {
    if (worker) return worker.postMessage(message, transfer);
    if (!engine) return;
    if (message.type === "morph") engine.morph(message.kind, message.targets);
    else if (message.type === "finish") engine.finish(message.targets);
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
      worker.onmessage = ({ data }) => {
        if (data.type === "settled") settle?.();
        else if (data.type === "unsupported") drawHere();
      };
      worker.onerror = () => drawHere();
      worker.postMessage({ type: "init", canvas: offscreen, options }, [offscreen]);
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

  function show(id) {
    const targets = views.get(id);
    if (!targets) return;
    const kind = id === "outside" || id === "overview" ? id : "room";
    shown.push([kind, targets]);
    send({ type: "morph", kind, targets });
  }

  fetch(SKETCHES)
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (!data || disposed) return;
      for (const [id, text] of Object.entries(data.views || {})) views.set(id, decodeSketch(decodeBase64(text)));
      if (requested) show(requested);
    })
    .catch(() => {});

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
    // Stages after the opening sea: "outside", "overview", then the occupied room's id.
    stage(id) {
      requested = id;
      show(id);
    },
    // The render stays transparent under the sketch until the hand-off.
    cover(element) {
      cover = element;
      element.style.opacity = "0";
    },
    // Trace the first frame (read in the task that drew it, before the drawing buffer is
    // released), let the strokes settle on its edges while the render fades in, then go. The
    // scene is never held behind the drawing for more than 1.4 s.
    finish(source) {
      if (disposed) return;
      const reveal = () => {
        if (!cover || disposed) return;
        cover.style.transition = "opacity 680ms cubic-bezier(0.25, 0.1, 0.25, 1)";
        cover.style.opacity = "1";
      };
      if (reduced) {
        dispose();
        return;
      }
      // The hand-over is scheduled before anything that could fail, so the drawing always goes.
      let ended = false;
      const end = () => {
        if (ended) return;
        ended = true;
        canvas.style.transition = "opacity 560ms cubic-bezier(0.4, 0, 0.6, 1)";
        canvas.style.opacity = "0";
        setTimeout(dispose, 580);
      };
      settle = end;
      setTimeout(reveal, 240);
      setTimeout(end, 1400);
      let snapshot = Promise.resolve(null);
      try {
        const box = source.getBoundingClientRect(),
          width = Math.max(32, Math.round(box.width / 2)),
          height = Math.max(32, Math.round(box.height / 2));
        snapshot = createImageBitmap(source, { resizeWidth: width, resizeHeight: height, resizeQuality: "medium" }).catch(() => null);
      } catch {
        // Some engines refuse to snapshot a WebGL canvas; the last drawing then stands in.
      }
      snapshot
        .then((bitmap) => {
          if (disposed) return bitmap?.close();
          if (worker) return send({ type: "finish", bitmap }, bitmap ? [bitmap] : []);
          let targets = null;
          if (bitmap) {
            const reader = document.createElement("canvas");
            reader.width = bitmap.width;
            reader.height = bitmap.height;
            const context = reader.getContext("2d", { willReadFrequently: true });
            context.drawImage(bitmap, 0, 0);
            targets = frameStrokes(context.getImageData(0, 0, reader.width, reader.height).data, reader.width, reader.height, engine?.count || 800);
            bitmap.close();
          }
          send({ type: "finish", targets });
        })
        .catch(() => send({ type: "finish", targets: null }));
    },
    dispose,
  };
}
