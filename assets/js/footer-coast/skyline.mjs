// The hills behind the footer coast, from real ground and houses (skyline-data.mjs, built by
// bin/coastal_skyline.py from USGS 3DEP elevation and OpenStreetMap buildings), laid onto the frieze.
//
// The frieze is a compressed panorama from a boat in La Jolla Bay, looking at the land: its x axis
// runs through the compass from the north-east (Torrey Pines mesa and the campus, left) through the
// east (the hills above La Jolla Shores) and the south-east (Mount Soledad, behind Scripps Pier) to
// the south (the Village and the Cove, right). Past Point La Jolla the land ends and the open Pacific
// lies to the south-west, where the sun sets; the viewer faces away from it. Bearings pass through
// the frieze's own landmarks (Salk, Geisel, Brockton Villa) and keep their order, but the distances
// between them are compressed as the coast's are. Pure functions, so node tests can check the map.
import { SKYLINE } from "./skyline-data.mjs?v=coast-hills-20261024";

// [frieze x, bearing in degrees east of north]: the Salk and Geisel copies on the mesa
// (coastal_panorama.py campus_panorama), the inhabited centre facing east across the bay, Mount
// Soledad's summit ridge behind Scripps Pier, Brockton Villa above the Cove, Point La Jolla past
// La Valencia, and the open sea beyond the panorama's end.
export const FRIEZE_BEARINGS = Object.freeze([
  [-96, 0],
  [-41.7, 33.8],
  [-28, 51.4],
  [0, 104],
  [13, 161.5],
  [25.8, 198.4],
  [35.5, 205],
  [45.1, 211],
  [54, 222],
  [96, 300],
]);

function piecewise(points, value, from, to) {
  if (value <= points[0][from])
    return points[0][to] + ((value - points[0][from]) * (points[1][to] - points[0][to])) / (points[1][from] - points[0][from]);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (value <= b[from]) return a[to] + ((value - a[from]) * (b[to] - a[to])) / (b[from] - a[from]);
  }
  const a = points.at(-2),
    b = points.at(-1);
  return b[to] + ((value - b[from]) * (b[to] - a[to])) / (b[from] - a[from]);
}
export const bearingAt = (x) => piecewise(FRIEZE_BEARINGS, x, 0, 1);
export const xAtBearing = (bearing) => piecewise(FRIEZE_BEARINGS, bearing, 1, 0);

const [FIRST, LAST, STEP] = SKYLINE.bearings;
function lerpArray(values, step, bearing) {
  const t = Math.min(Math.max((bearing - FIRST) / step, 0), values.length - 1),
    i = Math.min(Math.floor(t), values.length - 2);
  return values[i] + (values[i + 1] - values[i]) * (t - i);
}
// The sea's horizon dips below level for the eye: about -0.11 degrees.
const SEA = SKYLINE.far.at(-1) / 100;

// Past the Village the land falls to Point La Jolla: the frieze tapers the measured skyline into
// the sea's horizon over these bearings, so the hills end as the ground does rather than at a cut
// (the headland's own low bluffs stand in the coast in front).
export const HEADLAND = Object.freeze([205, 214.5]);
const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// The ground along a bearing: skyline and nearer-hills elevation angles (degrees), their distances
// (km) and the skyline ground's height (m). Beyond the headland lies the open sea.
export function skylineAt(bearing) {
  if (bearing >= HEADLAND[1] || bearing > LAST || bearing < FIRST) return { far: SEA, near: SEA, farKm: 0, nearKm: 0, crest: 0 };
  // The ridge sinks to the horizon, and the headland's own ground below it drops away to the sea,
  // so the open water widens toward the point instead of ending at a wall of land.
  const land = smooth(HEADLAND[1], HEADLAND[0], bearing),
    shore = SEA - 8 * smooth(HEADLAND[0] + 4, HEADLAND[1], bearing),
    far = lerpArray(SKYLINE.far, STEP, bearing) / 100,
    near = lerpArray(SKYLINE.near, STEP, bearing) / 100;
  return {
    far: shore + (far - shore) * land,
    near: shore + (near - shore) * land,
    farKm: lerpArray(SKYLINE.farDistance, STEP * 2, bearing) / 10,
    nearKm: lerpArray(SKYLINE.nearDistance, STEP * 2, bearing) / 10,
    crest: lerpArray(SKYLINE.crest, STEP * 2, bearing) * land,
  };
}

// The strip the sky layer samples, over x from `x0` to `x1`: row 0 holds the skyline and nearer
// angles (degrees) and their distances (km); row 1 the skyline ground's height (m) and the bearing.
export function skylineStrip(width = 1024, x0 = -96, x1 = 96) {
  const data = new Float32Array(width * 2 * 4);
  for (let i = 0; i < width; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / width,
      bearing = bearingAt(x),
      s = skylineAt(bearing);
    data.set([s.far, s.near, s.farKm, s.nearKm], i * 4);
    data.set([s.crest, bearing, 0, 1], (width + i) * 4);
  }
  return { width, height: 2, x0, x1, data };
}

// Houses facing the bay, as frieze x and window elevation angle (degrees), each with a stable seed
// for when its light comes on and how warm it is.
// A house on a crest has its windows a little above the bare ground's skyline; they are kept just
// under it, so no light floats in the sky above the hills.
export function houseLights() {
  const out = [];
  let bearing = 0;
  for (let i = 0; i < SKYLINE.lights.length; i += 2) {
    bearing += SKYLINE.lights[i] / 100;
    const x = xAtBearing(bearing),
      h = Math.imul((i / 2 + 1) ^ 0x9e3779b9, 0x85ebca6b) >>> 0,
      seed = ((h ^ (h >>> 13)) >>> 0) / 4294967296;
    out.push({ x, bearing, angle: Math.min(SKYLINE.lights[i + 1] / 100, skylineAt(bearing).far - 0.05), seed });
  }
  return out;
}

export const SKYLINE_PEAK = (() => {
  let best = 0;
  for (let i = 1; i < SKYLINE.far.length; i++) if (SKYLINE.far[i] > SKYLINE.far[best]) best = i;
  return { bearing: FIRST + best * STEP, angle: SKYLINE.far[best] / 100 };
})();
