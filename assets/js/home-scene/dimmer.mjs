// A dimmer for the house's lamps.
//
// The light schedules (light-installations.mjs, warm-practicals.mjs) depend on which room the
// visitor is in, so walking past the kitchen at night took its lights from 20-30 % to full and back
// within two seconds, in one frame each way (measured November 14, 2026; Sirui: "the 3d scene
// sometimes has weird flashing issue"). When a change is eased, a level moves toward its target
// with these time constants in seconds: up as a lamp on a presence sensor comes up, down more
// slowly, so a short visit reads as a swell and not as a flash. A still, a paused scene and the
// lab's direct controls skip the dimmer and arrive at once.
export const DIMMER = Object.freeze({ rise: 0.3, fall: 0.8, epsilon: 0.004 });

// One step of that approach. `scale` puts the tolerance in the quantity's own units (a lamp's
// power can be several units; a level is 0..1). An infinite step arrives exactly.
export function dimmerStep(shown, target, seconds, scale = 1) {
  const gap = target - shown;
  if (Math.abs(gap) <= DIMMER.epsilon * scale) return target;
  const next = shown + gap * (1 - Math.exp(-seconds / (gap > 0 ? DIMMER.rise : DIMMER.fall)));
  return Math.abs(target - next) <= DIMMER.epsilon * scale ? target : next;
}
