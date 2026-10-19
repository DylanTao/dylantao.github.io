// How many pixels the home draws. Two bounds, both applied through the size handed to the renderer
// and to the finish composer, never through renderer.setPixelRatio: the composer (realism.mjs,
// EffectComposer) captured the renderer's pixel ratio when it was built and multiplies every size it
// is given by that ratio, so scaling the logical size moves both by exactly the same factor and the
// beauty, contact, bloom and output targets always match the canvas.
//
// 1. A pixel budget. The canvas is normally about 1000x480 CSS pixels; full screen can make it
//    2560x1440 at a device pixel ratio of 1.5, about 8 MP, and the 4x multisampled half-float
//    composer targets then take on the order of a gigabyte. Past the budget, the density drops
//    evenly in both axes (a 2560x1440 screen at DPR 1.5 draws 1920x1080 and the browser scales it).
// 2. An adaptive factor for large buffers only: when frames are slow and the frame is waiting on the
//    GPU rather than on the page's own script, the factor steps down, and keeps the step only if the
//    frame time measurably improved (a draw-bound frame does not get faster with fewer pixels, so its
//    probe is undone and probing stops). It steps back up after sustained fast frames, and never
//    moves while the scene is still (paused, reduced motion), so composed stills keep full resolution.
//
// Dynamic resolution follows Binks, "Dynamic Resolution Rendering" (Intel, GDC 2011) and the
// hysteresis of drei's PerformanceMonitor; see docs/performance-notes.md.
export const PIXEL_BUDGET = 2_100_000;

const quantile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] : 0;
};

export function createResolutionGovernor({
  basePixelRatio = 1,
  maxDensity = 1.5,
  pixelBudget = PIXEL_BUDGET,
  // The adaptive factor runs only when the budgeted buffer is at least this large; the ordinary
  // canvas (0.25-1 MP) is bound by draws and vertices, not fill.
  adaptiveFromPixels = 1_000_000,
  minFactor = 0.7,
  step = 0.85,
  slowMs = 24,
  fastMs = 17.5,
  windowFrames = 60,
  decisionMs = 1000,
  enabled = true,
  devicePixelRatio = () => globalThis.devicePixelRatio || 1,
  now = () => globalThis.performance?.now() ?? Date.now(),
} = {}) {
  let factor = 1,
    probe = null,
    failedProbes = 0,
    fastStreak = 0,
    lastDecision = -Infinity,
    settleFrames = 0,
    cssWidth = 0,
    cssHeight = 0,
    current = null;
  const intervals = [],
    submits = [];
  const history = [];
  const clear = (settle = 8) => {
    intervals.length = submits.length = 0;
    settleFrames = settle;
  };
  function layout(width, height) {
    const density = Math.min(devicePixelRatio(), maxDensity);
    const wanted = width * height * density * density;
    const cap = wanted > pixelBudget ? Math.sqrt(pixelBudget / wanted) : 1;
    const adaptive = enabled && wanted * cap * cap >= adaptiveFromPixels;
    const applied = adaptive ? factor : 1;
    // Exactly the CSS size when nothing scales, so ordinary frames are unchanged to the pixel.
    const scale = (density * cap * applied) / basePixelRatio;
    return {
      width: scale === 1 ? width : width * scale,
      height: scale === 1 ? height : height * scale,
      density,
      cap,
      factor: applied,
      adaptive,
      pixels: Math.round(width * height * (density * cap * applied) ** 2),
    };
  }
  return {
    // The logical size to give renderer.setSize(…, false) and finish.resize for a canvas of this CSS
    // size. A new CSS size (full screen, a rotated phone) restarts adaptation from full density.
    size(width, height) {
      if (Math.abs(width - cssWidth) > 0.5 || Math.abs(height - cssHeight) > 0.5) {
        cssWidth = width;
        cssHeight = height;
        factor = 1;
        probe = null;
        failedProbes = 0;
        fastStreak = 0;
        clear();
      }
      current = layout(width, height);
      return current;
    },
    // One consecutive moving frame: its interval and the page's own script time in it. Returns true
    // when the factor changed, and the caller then resizes.
    observe(intervalMs, submitMs) {
      if (!current?.adaptive || !(intervalMs > 0)) return false;
      if (settleFrames > 0) {
        settleFrames--;
        return false;
      }
      intervals.push(intervalMs);
      submits.push(submitMs);
      if (intervals.length > windowFrames) {
        intervals.shift();
        submits.shift();
      }
      const t = now();
      if (intervals.length < windowFrames || t - lastDecision < decisionMs) return false;
      lastDecision = t;
      const p75 = quantile(intervals, 0.75),
        p90 = quantile(intervals, 0.9),
        scriptBound = quantile(submits, 0.5) > 0.8 * quantile(intervals, 0.5);
      const change = (next, reason) => {
        next = Math.round(next * 1e6) / 1e6;
        history.push({ at: Math.round(t), from: factor, to: next, reason, p75: Math.round(p75 * 10) / 10 });
        if (history.length > 12) history.shift();
        factor = next;
        clear();
        return true;
      };
      if (probe) {
        const kept = p75 <= probe.before * 0.9;
        const previous = probe.previous;
        probe = null;
        if (!kept) {
          failedProbes++;
          return change(previous, "probe did not help");
        }
      }
      if (p75 > slowMs && factor > minFactor && failedProbes < 2 && !scriptBound) {
        probe = { before: p75, previous: factor };
        fastStreak = 0;
        return change(Math.max(minFactor, factor * step), "slow frames");
      }
      if (p90 < fastMs && factor < 1) {
        if (++fastStreak >= 3) {
          fastStreak = 0;
          return change(Math.min(1, factor / step), "sustained fast frames");
        }
      } else fastStreak = 0;
      return false;
    },
    // Visibility, pause and view changes restart the frame window (not the factor).
    reset() {
      clear();
      probe = null;
    },
    evidence() {
      return current
        ? {
            css: [Math.round(cssWidth), Math.round(cssHeight)],
            density: current.density,
            cap: Math.round(current.cap * 1000) / 1000,
            factor: current.adaptive ? factor : 1,
            adaptive: current.adaptive,
            pixels: current.pixels,
            budget: pixelBudget,
            failedProbes,
            history: history.map((entry) => ({ ...entry })),
          }
        : null;
    },
  };
}
