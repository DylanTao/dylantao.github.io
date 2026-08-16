import { getShaderColorFromString } from "../vendor/paper-shaders/0.0.80/dist/get-shader-color-from-string.js";
import { getShaderNoiseTexture } from "../vendor/paper-shaders/0.0.80/dist/get-shader-noise-texture.js";
import { ShaderMount } from "../vendor/paper-shaders/0.0.80/dist/shader-mount.js";
import { dotOrbitFragmentShader } from "../vendor/paper-shaders/0.0.80/dist/shaders/dot-orbit.js";

const PROCESSED_PIXEL_BUDGET = 480000;
// ShaderMount rounds both dimensions after scaling. Leave enough headroom that
// its unchanged vendor math cannot cross the public processed-pixel budget.
const VENDOR_PIXEL_CAP = PROCESSED_PIXEL_BUDGET - 2000;

const field = document.querySelector("[data-paper-research-field]");

if (field && !window.__siruiPaperResearchField) {
  const section = field.closest("[data-research-motion-section]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const profiles = {
    design: { scale: 1.14, size: 0.3, sizeRange: 0.24, spreading: 0.34, speed: 0.045 },
    evaluate: { scale: 0.82, size: 0.22, sizeRange: 0.1, spreading: 0.12, speed: 0.022 },
    situated: { scale: 1.38, size: 0.27, sizeRange: 0.3, spreading: 0.5, speed: 0.034 },
  };
  const fixedFrame = 2400;
  let mount = null;
  let mode = section?.querySelector("[data-research-mode][aria-pressed='true']")?.dataset.researchMode || "design";

  const cssColor = (name, fallback, alpha) => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    const color = getShaderColorFromString(raw);
    return [color[0], color[1], color[2], alpha];
  };

  const sizingUniforms = (scale) => ({
    u_fit: 0,
    u_scale: scale,
    u_rotation: 0,
    u_offsetX: 0,
    u_offsetY: 0,
    u_originX: 0.5,
    u_originY: 0.5,
    u_worldWidth: 0,
    u_worldHeight: 0,
  });

  const paletteUniforms = () => ({
    u_colorBack: [0, 0, 0, 0],
    u_colors: [
      cssColor("--research-motion-line-a", "#338bc0", 0.48),
      cssColor("--research-motion-line-b", "#f07a38", 0.34),
      cssColor("--research-motion-line-c", "#3b9b7d", 0.42),
    ],
    u_colorsCount: 3,
    u_stepsPerColor: 2,
  });

  const setMode = (nextMode) => {
    if (!profiles[nextMode]) return;
    mode = nextMode;
    field.dataset.paperResearchMode = mode;
    if (!mount) return;

    const profile = profiles[mode];
    mount.setUniforms({
      ...sizingUniforms(profile.scale),
      ...paletteUniforms(),
      u_size: profile.size,
      u_sizeRange: profile.sizeRange,
      u_spreading: profile.spreading,
    });
    mount.setSpeed(reduceMotion.matches ? 0 : profile.speed);
    if (reduceMotion.matches) mount.setFrame(fixedFrame);
  };

  const failSoftly = () => {
    try {
      mount?.dispose();
    } catch (_error) {
      // The complete semantic 2D drawing remains available after context loss.
    }
    mount = null;
    field.replaceChildren();
    field.dataset.paperShaderState = "fallback";
    field.dataset.paperShaderContexts = "0";
  };

  const start = (noiseTexture) => {
    if (!noiseTexture?.complete || noiseTexture.naturalWidth === 0) {
      failSoftly();
      return;
    }

    const profile = profiles[mode];
    try {
      mount = new ShaderMount(
        field,
        dotOrbitFragmentShader,
        {
          ...sizingUniforms(profile.scale),
          ...paletteUniforms(),
          u_size: profile.size,
          u_sizeRange: profile.sizeRange,
          u_spreading: profile.spreading,
          u_noiseTexture: noiseTexture,
        },
        { alpha: true, antialias: false, depth: false, premultipliedAlpha: true },
        reduceMotion.matches ? 0 : profile.speed,
        fixedFrame,
        1,
        VENDOR_PIXEL_CAP
      );
      field.dataset.paperShaderState = reduceMotion.matches ? "still" : "ready";
      field.dataset.paperShaderContexts = "1";
      field.querySelector("canvas")?.addEventListener(
        "webglcontextlost",
        (event) => {
          event.preventDefault();
          failSoftly();
        },
        { once: true }
      );
    } catch (_error) {
      failSoftly();
    }
  };

  const noiseTexture = getShaderNoiseTexture();
  if (noiseTexture?.complete) {
    start(noiseTexture);
  } else if (noiseTexture) {
    noiseTexture.addEventListener("load", () => start(noiseTexture), { once: true });
    noiseTexture.addEventListener("error", failSoftly, { once: true });
  } else {
    failSoftly();
  }

  section?.querySelectorAll("[data-research-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.researchMode));
  });

  reduceMotion.addEventListener("change", () => {
    if (!mount) return;
    const profile = profiles[mode];
    mount.setSpeed(reduceMotion.matches ? 0 : profile.speed);
    if (reduceMotion.matches) mount.setFrame(fixedFrame);
    field.dataset.paperShaderState = reduceMotion.matches ? "still" : "ready";
  });

  const themeObserver = new MutationObserver(() => {
    if (mount) mount.setUniforms(paletteUniforms());
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-theme-mode"],
  });

  window.addEventListener(
    "pagehide",
    () => {
      themeObserver.disconnect();
      mount?.dispose();
    },
    { once: true }
  );
  window.__siruiPaperResearchField = {
    getState: () => ({
      canvasPixels: mount ? mount.canvasElement.width * mount.canvasElement.height : 0,
      contextCount: mount ? 1 : 0,
      currentSpeed: mount?.currentSpeed || 0,
      inViewport: mount?.isInViewport ?? false,
      mode,
      reducedMotion: reduceMotion.matches,
      running: Boolean(mount?.rafId),
      state: field.dataset.paperShaderState,
      uniforms: mount
        ? {
            scale: mount.providedUniforms.u_scale,
            size: mount.providedUniforms.u_size,
            sizeRange: mount.providedUniforms.u_sizeRange,
            spreading: mount.providedUniforms.u_spreading,
          }
        : null,
    }),
    setMode,
  };
}
