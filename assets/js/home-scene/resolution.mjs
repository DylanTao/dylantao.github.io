// How many pixels the home draws. Two bounds, both applied through the size handed to the renderer
// and to the finish composer, never through renderer.setPixelRatio: the composer (realism.mjs,
// EffectComposer) captured the renderer's pixel ratio when it was built and multiplies every size it
// is given by that ratio, so scaling the logical size moves both by exactly the same factor and the
// beauty, contact, bloom and output targets always match the canvas.
//
// 1. A pixel budget. The page embed is about 1000x480 CSS pixels and keeps a 2.1 MP budget at up to
//    1.5 device pixels per CSS pixel, so its frames are unchanged to the pixel. Full screen switches
//    to its own profile (setProfile("fullscreen")): up to a 4K screen's native 8.3 MP, at up to 2
//    device pixels per CSS pixel (October 19, Sirui: "when i go into full page, the details look too
//    rough"). Past the budget, the density drops evenly in both axes.
// 2. An adaptive factor for large buffers only: when frames are slow and the frame is waiting on the
//    GPU rather than on the page's own script, the factor steps down, in proportion to how slow the
//    frames are (frame time scales with pixels, so a frame twice too slow tries about 0.7x the linear
//    density), and keeps the step only if the frame time measurably improved (a draw-bound frame does
//    not get faster with fewer pixels, so its probe is undone and probing stops). It steps back up
//    after sustained fast frames, and never moves while the scene is still (paused, reduced motion),
//    so composed stills keep full resolution. A decision needs a full window of frames or, on a slow
//    GPU, at least ten frames spanning 1.5 s, so a 4 fps start finds its level within seconds.
//
// What else should follow the buffer (multisampling, the contact pass, the sun's shadow map and the
// sea mirror) is detailFor's choice below; the controller applies it with each resize.
//
// Dynamic resolution follows Binks, "Dynamic Resolution Rendering" (Intel, GDC 2011) and the
// hysteresis of drei's PerformanceMonitor; see docs/performance-notes.md.
export const PIXEL_BUDGET = 2_100_000;
export const FULLSCREEN_PIXEL_BUDGET = 8_300_000;
export const COMPACT_FULLSCREEN_PIXEL_BUDGET = 1_800_000;
export const RESOLUTION_PROFILES = Object.freeze({
  embed: Object.freeze({ pixelBudget: PIXEL_BUDGET, maxDensity: 1.5, minFactor: 0.7, quick: false }),
  // The floor (0.35 of the linear density) is about where the old 2.1 MP budget's own floor drew;
  // `quick` takes proportional steps and decides on time-bounded windows.
  fullscreen: Object.freeze({ pixelBudget: FULLSCREEN_PIXEL_BUDGET, maxDensity: 2, minFactor: 0.35, quick: true }),
  // Touch phones: avoid a 2x half-float multisample buffer before adaptation even starts.
  // Only measured GPU-bound moving frames trade further pixels, and unhelpful probes revert.
  compactFullscreen: Object.freeze({ pixelBudget: COMPACT_FULLSCREEN_PIXEL_BUDGET, maxDensity: 1.5, minFactor: 0.6, quick: true }),
});

// The detail that scales with the drawing buffer. Below 3.2 MP (every page embed) nothing changes:
// four MSAA samples, a contact pass 480 px on its long side, a 2048 px sun shadow and a 384 px sea
// mirror. Larger full-screen buffers trade multisampling for pixels (two samples to 6 MP, none above,
// where the density itself carries the edges and four samples would cost about a gigabyte of
// half-float targets), draw the contact pass at about a third of the buffer so its occlusion stays
// on the objects that cast it, double the sun's shadow resolution and widen the sea mirror to the
// screen's aspect.
export function detailFor({ width, height, fullscreen = false, compact = false, maxTextureSize = 4096, maxSamples = 4 }) {
  const pixels = Math.max(0, width * height),
    long = Math.max(width, height),
    large = fullscreen && pixels > 3_200_000;
  const samples = Math.min(maxSamples, compact && fullscreen ? 2 : !large ? 4 : pixels > 6_000_000 ? 0 : 2);
  const contactLongSide = fullscreen ? Math.round(Math.min(1440, Math.max(480, long * 0.36))) : 480;
  const shadowMapSize = fullscreen && pixels > 1_500_000 && maxTextureSize >= 8192 ? 4096 : 2048;
  let reflection = [384, 384];
  if (fullscreen && pixels > 1_500_000) {
    const mirrorWidth = Math.round(Math.min(1024, Math.max(384, width / 3)));
    reflection = [mirrorWidth, Math.max(216, Math.round((mirrorWidth * height) / Math.max(1, width)))];
  }
  return { samples, contactLongSide, shadowMapSize, reflection };
}

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
  // The largest single step down, for frames far slower than the target.
  maxStep = 0.6,
  targetMs = 20,
  slowMs = 24,
  fastMs = 17.5,
  windowFrames = 60,
  minWindowFrames = 10,
  windowMs = 1500,
  decisionMs = 1000,
  settleMs = 400,
  quick = false,
  compact = false,
  enabled = true,
  devicePixelRatio = () => globalThis.devicePixelRatio || 1,
  now = () => globalThis.performance?.now() ?? Date.now(),
} = {}) {
  const ordinaryAdaptiveThreshold = adaptiveFromPixels;
  let factor = 1,
    probe = null,
    failedProbes = 0,
    fastStreak = 0,
    lastDecision = -Infinity,
    settleFrames = 0,
    settleTime = 0,
    windowTime = 0,
    cssWidth = 0,
    cssHeight = 0,
    current = null,
    profile = "embed";
  const intervals = [],
    submits = [];
  const history = [];
  const clear = (settle = 8) => {
    intervals.length = submits.length = 0;
    settleFrames = settle;
    settleTime = 0;
    windowTime = 0;
  };
  const restart = () => {
    factor = 1;
    probe = null;
    failedProbes = 0;
    fastStreak = 0;
    clear();
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
        restart();
      }
      current = layout(width, height);
      return current;
    },
    // Full screen and the page embed have their own budgets (RESOLUTION_PROFILES). A change restarts
    // adaptation from full density; returns true when the profile changed, and the caller resizes.
    setProfile(name) {
      const next = RESOLUTION_PROFILES[compact && name === "fullscreen" ? "compactFullscreen" : name];
      if (!next || name === profile) return false;
      profile = name;
      ({ pixelBudget, maxDensity, minFactor, quick } = next);
      // A phone's full-screen buffer can be below 1 MP and still be fill-bound. It gets the same
      // measured probe/revert logic; an embed and a desktop retain their original threshold.
      adaptiveFromPixels = compact && name === "fullscreen" ? 300_000 : ordinaryAdaptiveThreshold;
      restart();
      if (cssWidth && cssHeight) current = layout(cssWidth, cssHeight);
      return true;
    },
    get profile() {
      return profile;
    },
    // One consecutive moving frame: its interval and the page's own script time in it. Returns true
    // when the factor changed, and the caller then resizes.
    observe(intervalMs, submitMs) {
      if (!current?.adaptive || !(intervalMs > 0)) return false;
      if (settleFrames > 0) {
        settleFrames--;
        settleTime += intervalMs;
        // A slow GPU settles by time rather than by frame count.
        if (quick && settleTime >= settleMs) settleFrames = 0;
        return false;
      }
      intervals.push(intervalMs);
      submits.push(submitMs);
      windowTime += intervalMs;
      if (intervals.length > windowFrames) {
        windowTime -= intervals.shift();
        submits.shift();
      }
      const t = now();
      const full = intervals.length >= windowFrames || (quick && intervals.length >= minWindowFrames && windowTime >= windowMs);
      if (!full || t - lastDecision < decisionMs) return false;
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
        // Fill time scales with the pixel count, the square of the linear factor.
        const proportional = quick ? Math.max(maxStep, Math.min(step, Math.sqrt(targetMs / p75))) : step;
        return change(Math.max(minFactor, factor * proportional), "slow frames");
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
            profile,
            compact,
            css: [Math.round(cssWidth), Math.round(cssHeight)],
            density: current.density,
            cap: Math.round(current.cap * 1000) / 1000,
            factor: current.adaptive ? factor : 1,
            adaptive: current.adaptive,
            pixels: current.pixels,
            budget: pixelBudget,
            minFactor,
            failedProbes,
            history: history.map((entry) => ({ ...entry })),
          }
        : null;
    },
  };
}
