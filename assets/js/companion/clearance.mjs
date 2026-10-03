import { minimumJerk } from "./motion.mjs";
import { createPipFlight, samplePipFlight } from "./performance.mjs";

// P uses the authored circulation path, but not the human's waist height.
// The current shell extends 26 cm below its group origin. A 1.65 m cruise
// clears the kitchen island and upper guard; it stays below the lower deck.
// This is a measured route profile, not a general collision/flight solver.
export function createPipClearanceFlight(points, startHover = 0.72, endHover = 0.72) {
  // Native shelf contents fill the human upper aisle; the lower stair's coat
  // hangs beside its landing. P has its own measured air corridor around both.
  // Keep the endpoints/perches and every human circulation point untouched.
  const airPoints = points.map(([x, y, z], i) =>
    i === 0 || i === points.length - 1
      ? [x, y, z]
      : y >= 2.55 && z >= 3.7 && z <= 5
        ? [x, y, 2.15]
        : y < 2.55 && z >= 4.6 && z <= 4.7
          ? [x, y, 4.45]
          : [x, y, z]
  );
  const flight = createPipFlight(airPoints);
  const cruise = flight.length > 0.55 ? Math.max(1.65, startHover, endHover) : Math.max(startHover, endHover);
  flight.clearance = { startHover, endHover, cruise };
  flight.anticipate = Math.max(flight.anticipate, (cruise - startHover) * 1.2);
  flight.settle = Math.max(flight.settle, (cruise - endHover) * 1.2);
  flight.duration = flight.anticipate + flight.travel + flight.settle;
  return flight;
}

export function samplePipClearanceFlight(flight, time) {
  const pose = samplePipFlight(flight, time);
  const { startHover, endHover, cruise } = flight.clearance;
  const mix = (a, b, u) => a + (b - a) * minimumJerk(Math.max(0, Math.min(1, u)));
  pose.hover =
    time < flight.anticipate
      ? mix(startHover, cruise, time / flight.anticipate)
      : time < flight.anticipate + flight.travel
        ? cruise
        : mix(cruise, endHover, (time - flight.anticipate - flight.travel) / flight.settle);
  return pose;
}
