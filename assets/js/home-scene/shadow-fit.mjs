// How the sun's shadow square follows the coast view while it moves (controller.mjs fitSunShadow,
// 2026-10-24). Its half-width moves along a ladder of sizes with one step of hysteresis and a margin,
// and its centre holds still until the view's focus has drifted as far as the margin allows. Fitted
// every frame, the size changed in 1 m steps while zooming, so every shadow's texels changed size
// and the edges shimmered, and any change of the light's matrix redrew the static shadow cache
// (about 260 casters on the coast, shadow-cache.mjs) on nearly every frame of a zoom, a pan or a
// walk. Once the view rests the controller returns to the exact fit, so a still view is unchanged.
// The steps put the authored 48 m view (36 m wanted) at 39 m and the 160 m view at 120 m.
export const SHADOW_STEPS = Object.freeze([12, 16, 21, 28, 39, 52, 70, 94, 120]);
// The centre may lag the focus by the drift below, so the square is that much larger than wanted.
export const SHADOW_MARGIN = 1.08;

// The half-width for a view that wants `wanted` metres, given the current step: it grows at once
// (the square must cover the view) and shrinks only once the view clearly fits the step below.
export function steppedShadowExtent(wanted, current, force = false) {
  const fit = SHADOW_STEPS.find((step) => step >= wanted * SHADOW_MARGIN) ?? SHADOW_STEPS.at(-1);
  if (force || !SHADOW_STEPS.includes(current) || fit >= current) return fit;
  const below = SHADOW_STEPS[SHADOW_STEPS.indexOf(current) - 1] ?? SHADOW_STEPS[0];
  return wanted * SHADOW_MARGIN < below * 0.9 ? fit : current;
}

// How far the focus may drift from the square's centre before it moves. Orbiting, exactly what the
// square has to spare over what the view wants, so it always still covers the view (and at the
// 120 m cap, nothing: it follows the focus as before). Around a walker, whose square stays at the
// 12 m close-up size, a metre.
export const shadowDrift = (extent, walking, wanted = extent / SHADOW_MARGIN) => (walking ? 1 : Math.max(0, extent - wanted));
