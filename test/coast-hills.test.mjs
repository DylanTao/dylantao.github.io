// The footer coast's backdrop: the physically based sky (atmosphere.mjs, after Hillaire 2020), the
// hills measured from USGS 3DEP elevation and OpenStreetMap houses (skyline.mjs), and how the sky
// layer turns them into light through the day (sky.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEG,
  SKY_VIEW,
  buildSkyView,
  defaultTables,
  luminance,
  sampleSkyView,
  skyRadiance,
  skyViewElevation,
  skyViewElevationV,
  sunTransmittance,
} from "../assets/js/footer-coast/atmosphere.mjs";
import { FRIEZE_BEARINGS, SKYLINE_PEAK, bearingAt, houseLights, skylineAt, xAtBearing } from "../assets/js/footer-coast/skyline.mjs";
import { SKYLINE } from "../assets/js/footer-coast/skyline-data.mjs";
import { skyExposure, skyWeight, twilightWhiteBalance } from "../assets/js/footer-coast/sky.mjs";
import { sunEvents, sunState } from "../assets/js/la-jolla-sun.mjs";

const tables = defaultTables();
const ratio = (c) => c[0] / c[2];

test("blue-hour display adaptation is bounded, continuous and leaves anchor daylight neutral", () => {
  for (const altitude of [null, 55, 0, -3, -15, -24]) assert.deepEqual(twilightWhiteBalance(altitude), [1, 1, 1]);
  const middle = twilightWhiteBalance(-8);
  assert.ok(middle[0] < 1 && middle[1] > 1 && middle[2] === 1, "reduce a magenta cast without a blue intensity boost");
  let previous = twilightWhiteBalance(-24);
  for (let altitude = -24; altitude < 15; altitude += 0.01) {
    const current = twilightWhiteBalance(altitude);
    current.forEach((value, i) => {
      assert.ok(value >= 0.7 && value <= 1.15);
      assert.ok(Math.abs(value - previous[i]) < 0.002, "less than 0.2% channel-gain change per 0.01 degree");
    });
    previous = current;
  }
});

test("the day sky is blue overhead and the low sun is red and dim", () => {
  const zenith = skyRadiance(Math.PI / 2, 0, 50 * DEG, { tables });
  assert.ok(zenith[2] > zenith[1] && zenith[1] > zenith[0], `zenith ${zenith}`);
  const high = sunTransmittance(60 * DEG, { tables }),
    low = sunTransmittance(1 * DEG, { tables });
  assert.ok(high[0] > 0.7 && high[2] > 0.5, `high sun ${high}`);
  assert.ok(low[0] > low[1] && low[1] > low[2], `low sun ${low}`);
  assert.ok(low[1] < 0.05 * high[1], "the setting sun is far dimmer than the high one");
  // Below the sea's horizon there is no direct sun.
  assert.deepEqual(sunTransmittance(-2 * DEG, { tables }), [0, 0, 0]);
});

test("after sunset the Earth's shadow rises in the east under the pink Belt of Venus", () => {
  // Looking away from the sun (180 degrees) with the sun two degrees down.
  const shadow = skyRadiance(1.5 * DEG, Math.PI, -2 * DEG, { tables }),
    belt = skyRadiance(10 * DEG, Math.PI, -2 * DEG, { tables });
  assert.ok(luminance(belt) > luminance(shadow), `belt ${luminance(belt)} over shadow ${luminance(shadow)}`);
  assert.ok(ratio(belt) > ratio(shadow), "the belt is pinker than the shadow beneath it");
  // Toward the hidden sun the horizon stays warmer and brighter than away from it.
  const toward = skyRadiance(3 * DEG, 0, -3 * DEG, { tables }),
    away = skyRadiance(3 * DEG, Math.PI, -3 * DEG, { tables });
  assert.ok(luminance(toward) > 3 * luminance(away) && ratio(toward) > ratio(away));
});

test("twilight darkens steadily, and the eye's adaptation keeps the blue hour legible", () => {
  let previous = Infinity,
    shown = Infinity;
  const view = new Float32Array(SKY_VIEW.columns * SKY_VIEW.rows * 4);
  for (let altitude = 2; altitude >= -12; altitude -= 1) {
    buildSkyView(altitude * DEG, { tables, out: view });
    const reference = luminance(sampleSkyView(view, 8 * DEG, (120 * Math.PI) / 180));
    assert.ok(reference < previous, `the sky darkens at ${altitude} degrees`);
    previous = reference;
    // The reference as displayed falls too, but gently, from about 0.3 at sunset to 0.07.
    const display = reference * skyExposure(reference);
    assert.ok(display < shown + 1e-9 && display > 0.03 && display < 0.4, `display ${display} at ${altitude}`);
    shown = display;
  }
});

test("a sky-view table built in slices equals one built at once", () => {
  const whole = buildSkyView(-2 * DEG, { tables }),
    sliced = new Float32Array(whole.length);
  for (let row = 0; row < SKY_VIEW.rows; row += 4) buildSkyView(-2 * DEG, { tables, out: sliced, from: row, to: row + 4 });
  assert.deepEqual(sliced, whole);
});

test("the sky-view table's elevation mapping round-trips and resolves the horizon finely", () => {
  for (const degrees of [-5, -1, 0, 0.5, 3, 12, 45, 89]) {
    const e = degrees * DEG;
    assert.ok(Math.abs(skyViewElevation(skyViewElevationV(e)) - e) < 1e-9, `${degrees}`);
  }
  // Rows crowd toward the horizon (Hillaire's non-linear latitude): a third of the rows above it
  // cover the lowest ten degrees, where the frieze's sky lies.
  const row = (i) => skyViewElevation((SKY_VIEW.horizonRow + i + 0.5) / SKY_VIEW.rows) / DEG;
  assert.ok(row(7) < 10, `row 7 at ${row(7)}`);
});

test("the frieze's bearings run monotonically through the measured landmarks", () => {
  for (let i = 1; i < FRIEZE_BEARINGS.length; i++)
    assert.ok(FRIEZE_BEARINGS[i][0] > FRIEZE_BEARINGS[i - 1][0] && FRIEZE_BEARINGS[i][1] > FRIEZE_BEARINGS[i - 1][1]);
  for (let x = -96; x <= 96; x += 0.5) assert.ok(Math.abs(xAtBearing(bearingAt(x)) - x) < 1e-9, `x ${x}`);
  // Mount Soledad's summit ridge stands behind Scripps Pier (x 12.6), the open sea lies past Point
  // La Jolla beyond the panorama's end (54), and the setting sun's bearings (242 to 299) are beyond
  // every reachable view: the viewer faces away from the sunset.
  assert.ok(Math.abs(xAtBearing(SKYLINE_PEAK.bearing) - 12.6) < 1.5, `peak at x ${xAtBearing(SKYLINE_PEAK.bearing)}`);
  assert.ok(SKYLINE_PEAK.angle > 4 && SKYLINE_PEAK.angle < 6, "Mount Soledad rises about five degrees over the bay");
  assert.ok(xAtBearing(242) > 54);
  assert.equal(skylineAt(240).farKm, 0, "open sea past the headland");
});

test("the measured skyline and houses are consistent", () => {
  for (let i = 0; i < SKYLINE.far.length; i++) assert.ok(SKYLINE.near[i] <= SKYLINE.far[i], `near ridge over the skyline at ${i}`);
  const lights = houseLights();
  assert.ok(lights.length >= 400, `${lights.length} houses`);
  assert.equal(SKYLINE.footprints.length, lights.length * 6, "every selected building carries its polygon dimensions and height provenance");
  for (const light of lights) {
    // Every house stands on the hills, at or below the skyline of its bearing.
    assert.ok(light.angle < skylineAt(light.bearing).far, `house at ${light.bearing} above the skyline`);
    assert.ok(light.seed >= 0 && light.seed < 1);
    assert.ok(light.width > 0 && light.depth > 0 && light.height > 0, "positive footprint and facade dimensions");
    assert.ok(light.distance >= 450 && light.distance <= 7000, "dimensions retain the building's actual bay distance");
    if (!light.heightTagged) assert.equal(light.height, 6, "untagged heights keep the documented display assumption");
  }
  // Mount Soledad's slopes carry the densest lights.
  const soledad = lights.filter((l) => l.bearing > 130 && l.bearing < 175).length,
    mesa = lights.filter((l) => l.bearing > 10 && l.bearing < 55).length;
  assert.ok(soledad > 2 * mesa, `Soledad ${soledad}, mesa ${mesa}`);
});

test("the physical sky shows from sunset through the blue hour, continuously", () => {
  for (const key of ["2026-06-21", "2026-10-24", "2026-12-21"]) {
    const day = sunEvents(key);
    let previous = null;
    for (let minute = 0; minute < 1440; minute += 1) {
      const w = skyWeight(sunState(key, minute));
      assert.ok(w >= 0 && w <= 1);
      if (previous !== null) assert.ok(Math.abs(w - previous) < 0.12, `${key} ${minute}: ${previous} -> ${w}`);
      previous = w;
    }
    assert.equal(skyWeight(sunState(key, day.solarNoon)), 0, "by day the page is the sky");
    assert.ok(skyWeight(sunState(key, day.sunset + 1)) > 0.95, "sunset");
    assert.ok(skyWeight(sunState(key, day.civilDusk)) > 0.95, "civil dusk");
  }
  assert.equal(skyWeight(null), 0, "a chosen theme shows its anchor");
});
