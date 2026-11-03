const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Expose for a shaded room using its direction-independent diffuse mean. A lamp
// entering the view or a turn of the visitor's head cannot change this target.
// This is bounded camera compensation, separate from the physical light field.
export function interiorExposureGain(ambient, maximumGain = 1.8) {
  if (!Number.isFinite(maximumGain) || maximumGain < 1 || maximumGain > 2) throw new RangeError("exposure gain must be 1..2");
  if (
    !ambient?.ready ||
    !Number.isFinite(ambient.coverage) ||
    !Number.isFinite(ambient.luminance) ||
    !Number.isFinite(ambient.unoccludedLuminance) ||
    ambient.luminance <= 0 ||
    ambient.unoccludedLuminance <= 0
  )
    return 1;
  const relative = Math.sqrt(ambient.unoccludedLuminance / ambient.luminance),
    roomGain = clamp(relative, 1, maximumGain);
  return 1 + (roomGain - 1) * clamp(ambient.coverage, 0, 1);
}

export function createInteriorExposure() {
  let gain = 1,
    target = 1,
    initialized = false;
  return {
    update(ambient, delta, { instant = false } = {}) {
      target = interiorExposureGain(ambient);
      if (instant || !initialized) gain = target;
      else {
        const seconds = Number.isFinite(delta) ? clamp(delta, 0, 1) : 0;
        gain += (target - gain) * (1 - Math.exp(-seconds / 0.65));
        if (Math.abs(gain - target) < 0.0001) gain = target;
      }
      initialized = true;
      return gain;
    },
    evidence: () => ({ gain, target, maximumGain: 1.8, method: "position and direction-independent probe mean; 0.65 s adaptation" }),
  };
}
