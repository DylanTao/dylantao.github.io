// Hardware-adaptive quality (2026-10-24). Sirui: "for higher res screen and better spec hardware, we
// can optionally push the rendering quality, lighting, shadow etc quality higher without pushing it
// so much that it becomes laggy or crash". Three tiers change what the home costs, never what it
// shows: every tier draws the same house, coast, people and animals with the same shader programs
// (no tier setting is part of a program's key). They differ in the pixel budget and density, the
// multisampling ceiling, the sun's shadow resolution, the contact pass, the sea and bathroom
// mirrors, the haze march, texture filtering and how far fine furniture reaches.
//
// Standard is the home exactly as it was drawn before tiers (null below keeps a device's own
// value). A device starts at standard, or low on a compact touch screen or a small GPU. Measured
// frames, and only while the view rests, promote a device with clear GPU headroom to high and demote
// one whose GPU keeps missing its frames. A reduction must improve frame pacing to stay, and a
// recovered device can regain detail after a longer cooldown. A lost WebGL context restarts one
// tier lower (sessionStorage), and ?quality=low|standard|high pins a tier.

export const TIERS = Object.freeze(["low", "standard", "high"]);
export const QUALITY_CAP_KEY = "sirui-scene-quality-cap";

export const QUALITY_TIERS = Object.freeze({
  low: Object.freeze({
    embed: Object.freeze({ pixelBudget: 1_200_000, maxDensity: 1.25 }),
    fullscreen: Object.freeze({ pixelBudget: 1_800_000, maxDensity: 1.25 }),
    maxSamples: 2,
    shadowMapSize: 1024,
    contactScale: 0.5,
    reflectionScale: 0.67,
    mirrorSize: 128,
    hazeSteps: 0.67,
    hazeDivisor: 1,
    anisotropy: Object.freeze({ embed: 1, fullscreen: 4 }),
    lodReach: 0.8,
    memoryBudget: 192 * 2 ** 20,
  }),
  standard: Object.freeze({
    embed: null,
    fullscreen: null,
    maxSamples: 4,
    shadowMapSize: null,
    contactScale: 1,
    reflectionScale: 1,
    mirrorSize: null,
    hazeSteps: 1,
    hazeDivisor: 0,
    anisotropy: Object.freeze({ embed: 1, fullscreen: 8 }),
    lodReach: 1,
    memoryBudget: 768 * 2 ** 20,
  }),
  high: Object.freeze({
    embed: Object.freeze({ pixelBudget: 4_200_000, maxDensity: 2 }),
    fullscreen: Object.freeze({ pixelBudget: 8_300_000, maxDensity: 2 }),
    maxSamples: 4,
    shadowMapSize: 4096,
    contactScale: 1.5,
    reflectionScale: 1.5,
    mirrorSize: 512,
    hazeSteps: 1.25,
    hazeDivisor: -1,
    anisotropy: Object.freeze({ embed: 8, fullscreen: 16 }),
    lodReach: 1.4,
    memoryBudget: 1280 * 2 ** 20,
  }),
});

export function requestedTier(search = globalThis.location?.search || "") {
  const value = new URLSearchParams(search).get("quality");
  return TIERS.includes(value) ? value : null;
}

export const lowerTier = (tier) => TIERS[Math.max(0, TIERS.indexOf(tier) - 1)];

// The tier to start at. A pinned tier wins; a cap (one tier below a context that was lost) bounds
// the rest. Compact touch screens, small texture limits and little memory start low; everything
// else starts at standard and can earn high only from measured frames.
export function initialTier({ pinned = null, cap = null, compact = false, maxTextureSize = null, deviceMemory = null } = {}) {
  if (TIERS.includes(pinned)) return pinned;
  const small = (Number.isFinite(maxTextureSize) && maxTextureSize < 8192) || (Number.isFinite(deviceMemory) && deviceMemory <= 2);
  let tier = compact || small ? "low" : "standard";
  if (TIERS.includes(cap) && TIERS.indexOf(tier) > TIERS.indexOf(cap)) tier = cap;
  return tier;
}

// Render-target memory (bytes) for one drawing-buffer size and detail, from what three r164 and this
// pipeline allocate: two composer targets (multisampled half-float colour and depth, a resolved colour
// and depth texture), three's transmission target (four samples, mipmapped), the bloom chain, the
// contact pass, the haze volume, the sun's shadow map and its cache copy, and both mirrors. An
// estimate for budgeting, not a measurement of driver allocations.
export function targetMemory({
  width,
  height,
  samples = 4,
  shadowMapSize = 2048,
  contactLongSide = 480,
  reflection = [384, 384],
  mirrorSize = 256,
  hazeDivisor = 2,
}) {
  const pixels = width * height;
  const composer = 2 * pixels * (samples > 0 ? 12 * samples + 12 : 24);
  const transmission = pixels * (12 * 4 + 8 * 1.34);
  const bloom = pixels * 5;
  const contactPixels = contactLongSide * contactLongSide * Math.min(1, height / Math.max(1, width), width / Math.max(1, height));
  const contact = contactPixels * 14;
  const haze = (pixels / (hazeDivisor * hazeDivisor)) * 8;
  const shadow = shadowMapSize * shadowMapSize * 16;
  const mirrors = reflection[0] * reflection[1] * 12 + mirrorSize * mirrorSize * 12;
  return Math.round(composer + transmission + bloom + contact + haze + shadow + mirrors);
}

// Promotion and demotion from measured frames. `observe` takes one moving frame: its interval, the
// GPU's time per frame where a timer exists (a number, or a function read only when a decision is
// due), the page's own script time, and whether the view is moving. It returns the tier to switch to,
// or null. Decisions need a full window of frames, never land while the view moves, and wait a few
// seconds after any change. Frames bound by the page's script are not demoted: fewer pixels would
// not make them faster.
export function createQualityGovernor({
  tier = "standard",
  pinned = false,
  canPromote = true,
  windowFrames = 90,
  promoteGpuMs = 6,
  promoteIntervalMs = 19,
  demoteIntervalMs = 40,
  demoteGpuMs = 25,
  recoveryMs = 15000,
  scriptBound = 0.6,
  settleMs = 3000,
  now = () => globalThis.performance?.now() ?? Date.now(),
} = {}) {
  const intervals = [],
    submits = [];
  let current = tier,
    demoted = false,
    trial = null,
    failedReductions = 0,
    lastReduction = -Infinity,
    lastChange = now(),
    history = [];
  const quantile = (values, fraction) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] : null;
  };
  const clear = () => {
    intervals.length = submits.length = 0;
  };
  const change = (next, reason, evidence) => {
    history.push({ from: current, to: next, reason, at: Math.round(now()), ...evidence });
    if (history.length > 8) history = history.slice(-8);
    if (TIERS.indexOf(next) < TIERS.indexOf(current)) demoted = true;
    current = next;
    clear();
    lastChange = now();
    return next;
  };
  return {
    get tier() {
      return current;
    },
    observe(intervalMs, gpuMs = null, { holding = false, submitMs = null } = {}) {
      if (pinned || !(intervalMs > 0)) return null;
      // Frames during interaction count toward the evidence, but nothing switches mid-motion.
      intervals.push(intervalMs);
      submits.push(Number.isFinite(submitMs) ? submitMs : 0);
      if (intervals.length > windowFrames) {
        intervals.shift();
        submits.shift();
      }
      if (holding || intervals.length < windowFrames || now() - lastChange < settleMs) return null;
      const p50 = quantile(intervals, 0.5),
        p75 = quantile(intervals, 0.75),
        script = quantile(submits, 0.5);
      const gpu = typeof gpuMs === "function" ? gpuMs() : gpuMs;
      const evidence = {
        p50: Math.round(p50 * 10) / 10,
        p75: Math.round(p75 * 10) / 10,
        script: Math.round(script * 10) / 10,
        gpu: Number.isFinite(gpu) ? Math.round(gpu * 10) / 10 : null,
      };
      // A paced/background/compositor gap is not evidence that the scene's GPU work is slow.
      // Without timer support the reduction remains a measured, reversible trial.
      const gpuBound = !Number.isFinite(gpu) || (gpu >= demoteGpuMs && gpu >= p50 * 0.4);
      if (trial) {
        const { from, before } = trial;
        trial = null;
        if (p75 > before * 0.85) {
          failedReductions++;
          return change(from, "tier reduction did not help", evidence);
        }
      }
      if (p75 > demoteIntervalMs && current !== "low" && script < scriptBound * p50 && gpuBound && failedReductions < 2) {
        trial = { from: current, before: p75 };
        lastReduction = now();
        return change(lowerTier(current), "sustained GPU pressure", evidence);
      }
      if (p75 > promoteIntervalMs || (demoted && now() - lastReduction < recoveryMs)) return null;
      // Low on a compact/small device is its starting tier, not a temporary pressure reduction.
      // Recover standard only when this session actually lost it; high keeps its memory guard.
      if (current === "low" && demoted && tier !== "low") {
        const recovered = Number.isFinite(gpu) ? gpu <= promoteGpuMs : p50 <= promoteIntervalMs * 0.8;
        return recovered ? change("standard", "recovered headroom", evidence) : null;
      }
      if (current !== "standard" || !canPromote) return null;
      // High needs measured GPU headroom where a timer exists, and clearly fast frames without one
      // (a 60 Hz display's paced frames alone are not headroom).
      const headroom = Number.isFinite(gpu) ? gpu <= promoteGpuMs : p50 <= promoteIntervalMs * 0.8;
      if (!headroom) return null;
      return change("high", demoted ? "recovered headroom" : "headroom", evidence);
    },
    // View, visibility and background-work changes start a clean window (the tier stays).
    reset: clear,
    // An explicit switch (the lab's comparison control); returns whether the tier changed.
    set(next, reason = "set") {
      if (!TIERS.includes(next) || next === current) return false;
      change(next, reason, {});
      return true;
    },
    evidence() {
      return {
        tier: current,
        pinned,
        demoted,
        canPromote,
        failedReductions,
        trial: trial ? { ...trial } : null,
        history: history.map((entry) => ({ ...entry })),
      };
    },
  };
}
