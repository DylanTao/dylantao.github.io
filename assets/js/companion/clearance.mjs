import { minimumJerk } from "./motion.mjs";
import { createPipFlight, samplePipFlight } from "./performance.mjs";

// P uses the authored circulation path, but not the human's waist height.
// The current shell extends 26 cm below its group origin. A 1.65 m cruise
// clears the kitchen island and upper guard; it stays below the lower deck.
// This is a measured route profile, not a general collision/flight solver.
// The stair's landward line (navigation.stairs z) and P's air corridor beside its treads. Since the
// October 2026 renovation the stair stands 2.4 m further inland, and the human upper walk runs
// behind the office's bookshelf (z 6.1), clear at P's cruise height, so P follows that walk.
const STAIR_LINE = [7.0, 7.1],
  STAIR_AIR = 6.85;
export function createPipClearanceFlight(points, startHover = 0.72, endHover = 0.72) {
  // The lower stair's side wall hangs beside its treads; P has its own measured air corridor
  // seaward of them. Keep the endpoints/perches and every human circulation point untouched.
  const airPoints = points.map(([x, y, z], i) =>
    i === 0 || i === points.length - 1 ? [x, y, z] : y < 2.55 && z >= STAIR_LINE[0] && z <= STAIR_LINE[1] ? [x, y, STAIR_AIR] : [x, y, z]
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
